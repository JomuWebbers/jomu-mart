import { randomUUID } from "crypto";
import { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/authMiddleware";
import {
  getStreamChatServer,
  streamDisplayName,
  streamUserId,
} from "../lib/stream";
const MONTHLY_FEE_NAIRA = 1000;
const MONTHLY_FEE_KOBO = MONTHLY_FEE_NAIRA * 100;
const FREE_LISTINGS_QUOTA = 5;

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
  variant:
    | { kind: "paystack"; }
    | {
        kind: "free";
        listingName: string;
        freeUsed: number;
      }
    | {
        kind: "wallet";
        listingName: string;
        newBalance: number;
      }
    | {
        kind: "low-balance";
        listingName: string;
        balance: number;
      } = { kind: "paystack" },
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
    let text: string;
    if (variant.kind === "free") {
      const remaining = FREE_LISTINGS_QUOTA - variant.freeUsed;
      text =
        `Hi ${seller.name}, your listing '${variant.listingName}' ` +
        `(${variant.freeUsed} of ${FREE_LISTINGS_QUOTA} free) is with our team for review. ` +
        (remaining > 0
          ? `You have ${remaining} free listing${remaining === 1 ? "" : "s"} left. After your ` +
            `${FREE_LISTINGS_QUOTA}th free listing, a ₦${MONTHLY_FEE_NAIRA.toLocaleString()} ` +
            `monthly fee will apply, deducted automatically from your seller balance.`
          : `This was your last free listing — your next listing will trigger the ` +
            `₦${MONTHLY_FEE_NAIRA.toLocaleString()} monthly fee, deducted automatically ` +
            `from your seller balance.`);
    } else if (variant.kind === "wallet") {
      text =
        `Hi ${seller.name}, we deducted your ₦${MONTHLY_FEE_NAIRA.toLocaleString()} ` +
        `Jomu Mart monthly listing fee for ${monthKey} from your seller balance ` +
        `(new balance ₦${variant.newBalance.toLocaleString()}). '${variant.listingName}' is now ` +
        `with our team for review. Further listings are free through ${monthEndLabel}.`;
    } else if (variant.kind === "low-balance") {
      text =
        `Hi ${seller.name}, your seller balance (₦${variant.balance.toLocaleString()}) is below ` +
        `the ₦${MONTHLY_FEE_NAIRA.toLocaleString()} monthly fee, so we're taking you to Paystack ` +
        `to complete it for '${variant.listingName}'. Future months will deduct automatically ` +
        `once your balance covers the fee.`;
    } else {
      text =
        `Hi ${seller.name}, we confirmed your ₦${MONTHLY_FEE_NAIRA.toLocaleString()} ` +
        `Jomu Mart monthly listing fee for ${monthKey}. Your first listing is now ` +
        `with our team for review. Additional listings are free through ${monthEndLabel}.`;
    }
    await channel.sendMessage({
      user_id: adminSid,
      text,
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
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            freeListingsUsed: true,
            accountBalance: true,
          },
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

    // Step A: a seller's first FREE_LISTINGS_QUOTA listings are free.
    // freeListingsUsed is incremented once in createProduct, so it already
    // reflects this listing.
    if (product.seller.freeListingsUsed < FREE_LISTINGS_QUOTA) {
      const freeUsed = product.seller.freeListingsUsed;

      await prisma.product.updateMany({
        where: { id: product.id, listingFeePaid: false },
        data: { listingFeePaid: true, listingFeeAmount: 0 },
      });

      await notifySellerInChat(
        { id: sellerId, name: product.seller.name },
        monthKey,
        { kind: "free", listingName: product.name, freeUsed },
      );

      return res.json({
        requiresPayment: false,
        freeListing: true,
        freeUsed,
        freeRemaining: FREE_LISTINGS_QUOTA - freeUsed,
        productId: product.id,
      });
    }

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

    // Step C: deduct the fee from the seller balance when it covers the amount.
    if ((product.seller.accountBalance ?? 0) >= MONTHLY_FEE_NAIRA) {
      const { start, end } = monthWindow(monthKey);

      const walletPayment = await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction so concurrent withdrawals cannot oversell it.
        const freshSeller = await tx.user.findUnique({
          where: { id: sellerId },
          select: { accountBalance: true },
        });

        if (
          !freshSeller ||
          (freshSeller.accountBalance ?? 0) < MONTHLY_FEE_NAIRA
        ) {
          return null;
        }

        const newBalance = (freshSeller.accountBalance ?? 0) - MONTHLY_FEE_NAIRA;

        await tx.user.update({
          where: { id: sellerId },
          data: { accountBalance: newBalance },
        });

        await tx.sellerListingFee.upsert({
          where: { sellerId_monthKey: { sellerId, monthKey } },
          create: {
            sellerId,
            monthKey,
            firstProductId: product.id,
            reference: null,
            authorizationUrl: null,
            amountKobo: MONTHLY_FEE_KOBO,
            status: "paid",
            paymentMethod: "wallet",
            paidAt: new Date(),
          },
          update: {
            firstProductId: product.id,
            reference: null,
            authorizationUrl: null,
            amountKobo: MONTHLY_FEE_KOBO,
            status: "paid",
            paymentMethod: "wallet",
            paidAt: new Date(),
          },
        });

        // The monthly fee also covers this seller's other listings this month.
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
          where: { id: product.id },
          data: {
            listingFeePaid: true,
            listingFeeAmount: MONTHLY_FEE_NAIRA,
          },
        });

        return newBalance;
      });

      if (walletPayment !== null) {
        await notifySellerInChat(
          { id: sellerId, name: product.seller.name },
          monthKey,
          {
            kind: "wallet",
            listingName: product.name,
            newBalance: walletPayment,
          },
        );

        return res.json({
          requiresPayment: false,
          paidViaWallet: true,
          monthKey,
          newBalance: walletPayment,
          productId: product.id,
        });
      }
    }

    // Step D: fall back to Paystack when the balance cannot cover the fee.

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
        paymentMethod: "paystack",
      },
      update: {
        firstProductId: product.id,
        reference,
        authorizationUrl: paystackData.data.authorization_url,
        amountKobo: MONTHLY_FEE_KOBO,
        status: "pending",
        paymentMethod: "paystack",
        paidAt: null,
      },
    });

    await notifySellerInChat(
      { id: sellerId, name: product.seller.name },
      monthKey,
      {
        kind: "low-balance",
        listingName: product.name,
        balance: product.seller.accountBalance ?? 0,
      },
    );

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
