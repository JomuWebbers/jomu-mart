import { randomUUID } from "crypto";
import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthRequest } from "../middleware/authMiddleware";
import {
  getStreamChatServer,
  streamDisplayName,
  streamUserId,
} from "../lib/stream";

const prisma = new PrismaClient();
const MONTHLY_FEE_NAIRA = 1000;
const MONTHLY_FEE_KOBO = MONTHLY_FEE_NAIRA * 100;

function currentMonthInLagos(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Could not determine the current billing month");
  }

  return `${year}-${month}`;
}

function parseMonthKey(monthKey: string) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!yearStr || !monthStr || Number.isNaN(year) || Number.isNaN(month)) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function monthWindow(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);

  // Lagos is UTC+1: its month starts at 23:00 UTC on the previous day.
  return {
    start: new Date(Date.UTC(year, month - 1, 1, -1)),
    end: new Date(Date.UTC(year, month, 1, -1)),
  };
}

async function notifySellerInChat(
  seller: { id: string; name: string },
  monthKey: string,
) {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
    });
    if (!admin) return;

    const { year, month } = parseMonthKey(monthKey);
    const monthEnd = new Date(Date.UTC(year, month, 0, 12));
    const monthEndLabel = new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(monthEnd);

    const sellerSid = streamUserId(seller.id);
    const adminSid = streamUserId(admin.id);
    const server = getStreamChatServer();

    await server.upsertUsers([
      { id: sellerSid, name: seller.name },
      {
        id: adminSid,
        name: streamDisplayName(admin.role, admin.name),
      },
    ]);

    const channel = server.channel("messaging", `support-${seller.id}`, {
      members: [sellerSid, adminSid],
      created_by_id: adminSid,
    });

    await channel.create();
    await channel.sendMessage({
      user_id: adminSid,
      text:
        `Hi ${seller.name}, we confirmed your ₦${MONTHLY_FEE_NAIRA.toLocaleString()} ` +
        `Naija Mart monthly listing fee for ${monthKey}. Your first listing is now ` +
        `with our team for review. Additional listings are free through ${monthEndLabel}.`,
    });
  } catch (error) {
    // A chat notification failure must not undo a confirmed payment.
    console.error("Could not send monthly listing-fee chat message:", error);
  }
}

export const initializeListingFee = async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.userId;
    const { id } = req.params;

    if (!sellerId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Listing not found" });
    }
    if (product.sellerId !== sellerId) {
      return res.status(403).json({ message: "This is not your listing" });
    }

    // Admin-created products do not incur a seller listing fee.
    if (product.seller.role === "admin") {
      return res.json({ requiresPayment: false, productId: product.id });
    }

    const monthKey = currentMonthInLagos();
    const existingFee = await prisma.sellerListingFee.findUnique({
      where: {
        sellerId_monthKey: { sellerId, monthKey },
      },
    });

    if (existingFee?.status === "paid") {
      await prisma.product.update({
        where: { id: product.id },
        data: { listingFeePaid: true, listingFeeAmount: 0 },
      });

      return res.json({ requiresPayment: false, productId: product.id });
    }

    // Reuse an outstanding checkout so repeat clicks do not start another fee.
    if (
      existingFee?.status === "pending" &&
      existingFee.reference &&
      existingFee.authorizationUrl
    ) {
      return res.json({
        requiresPayment: true,
        authorizationUrl: existingFee.authorizationUrl,
        reference: existingFee.reference,
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        message: "Server configuration is missing PAYSTACK_SECRET_KEY",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const callbackUrl = new URL("/sell/fee/verify", frontendUrl);
    callbackUrl.searchParams.set("productId", product.id);

    const reference = `listingfee-${monthKey}-${randomUUID().replace(/-/g, "")}`;

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: product.seller.email,
          amount: String(MONTHLY_FEE_KOBO),
          currency: "NGN",
          reference,
          callback_url: callbackUrl.toString(),
          metadata: {
            purpose: "monthly_listing_fee",
            sellerId,
            productId: product.id,
            monthKey,
          },
        }),
      },
    );

    const paystackData = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      !paystackData.status ||
      !paystackData.data?.authorization_url
    ) {
      console.error(
        "Paystack listing-fee initialization failed:",
        paystackData,
      );
      return res.status(502).json({
        message: "Could not start the Paystack listing-fee payment",
      });
    }

    await prisma.sellerListingFee.upsert({
      where: {
        sellerId_monthKey: { sellerId, monthKey },
      },
      create: {
        sellerId,
        monthKey,
        firstProductId: product.id,
        reference,
        authorizationUrl: paystackData.data.authorization_url,
        amountKobo: MONTHLY_FEE_KOBO,
        status: "pending",
      },
      update: {
        firstProductId: product.id,
        reference,
        authorizationUrl: paystackData.data.authorization_url,
        amountKobo: MONTHLY_FEE_KOBO,
        status: "pending",
        paidAt: null,
      },
    });

    res.json({
      requiresPayment: true,
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error("Failed to initialize listing fee:", error);
    res.status(500).json({ message: "Failed to initialize listing fee" });
  }
};

export const verifyListingFee = async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.userId;
    const { reference } = req.body;

    if (!sellerId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (typeof reference !== "string" || !reference) {
      return res.status(400).json({ message: "Payment reference is required" });
    }

    const fee = await prisma.sellerListingFee.findUnique({
      where: { reference },
      include: {
        seller: {
          select: { id: true, name: true },
        },
      },
    });

    if (!fee || fee.sellerId !== sellerId) {
      return res.status(404).json({ message: "Listing-fee payment not found" });
    }

    if (fee.status === "paid") {
      return res.json({ paid: true, monthKey: fee.monthKey });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        message: "Server configuration is missing PAYSTACK_SECRET_KEY",
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const paystackData = await response.json();
    const transaction = paystackData.data;

    if (
      !response.ok ||
      !paystackData.status ||
      transaction?.status !== "success" ||
      transaction?.reference !== reference ||
      transaction?.amount !== fee.amountKobo ||
      transaction?.currency !== "NGN"
    ) {
      return res.status(400).json({
        message: "The ₦1,000 listing-fee payment has not been confirmed",
      });
    }

    const { start, end } = monthWindow(fee.monthKey);

    const newlyPaid = await prisma.$transaction(async (tx) => {
      const claimed = await tx.sellerListingFee.updateMany({
        where: { id: fee.id, status: "pending" },
        data: { status: "paid", paidAt: new Date() },
      });

      if (claimed.count === 0) return false;

      // The monthly fee covers all of this seller's listings submitted this month.
      await tx.product.updateMany({
        where: {
          sellerId,
          status: "pending",
          listingFeePaid: false,
          createdAt: { gte: start, lt: end },
        },
        data: { listingFeePaid: true, listingFeeAmount: 0 },
      });

      await tx.product.update({
        where: { id: fee.firstProductId },
        data: {
          listingFeePaid: true,
          listingFeeAmount: MONTHLY_FEE_NAIRA,
        },
      });

      return true;
    });

    if (newlyPaid) {
      await notifySellerInChat(fee.seller, fee.monthKey);
    }

    res.json({ paid: true, monthKey: fee.monthKey });
  } catch (error) {
    console.error("Failed to verify listing fee:", error);
    res.status(500).json({ message: "Failed to verify listing-fee payment" });
  }
};
