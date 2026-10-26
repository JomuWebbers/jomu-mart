import { randomUUID } from "crypto";
import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/authMiddleware";

const MIN_TRANSACTION_NAIRA = 100;
const MAX_FUNDING_NAIRA = 5_000_000;

function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const kobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(kobo) || Math.abs(amount * 100 - kobo) > 0.001) {
    return null;
  }
  return { naira: kobo / 100, kobo };
}

export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Not authorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountBalance: true,
        linkedBankName: true,
        linkedBankAccountNumber: true,
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Failed to load wallet:", error);
    res.status(500).json({ message: "Failed to load wallet" });
  }
};

export const getWalletTransactions = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Not authorized" });

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        direction: true,
        amount: true,
        status: true,
        description: true,
        reference: true,
        createdAt: true,
      },
    });
    res.json(transactions);
  } catch (error) {
    console.error("Failed to load wallet transactions:", error);
    res.status(500).json({ message: "Failed to load wallet transactions" });
  }
};

export const initializeWalletFunding = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Not authorized" });

    const amount = parseAmount(req.body.amount);
    if (!amount || amount.naira < MIN_TRANSACTION_NAIRA) {
      return res.status(400).json({
        message: `Enter an amount of at least ₦${MIN_TRANSACTION_NAIRA}`,
      });
    }
    if (amount.naira > MAX_FUNDING_NAIRA) {
      return res.status(400).json({
        message: `The maximum wallet funding amount is ₦${MAX_FUNDING_NAIRA.toLocaleString()}`,
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        message: "Server configuration is missing PAYSTACK_SECRET_KEY",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const reference = `wallet-${randomUUID().replace(/-/g, "")}`;
    const transaction = await prisma.walletTransaction.create({
      data: {
        userId,
        type: "funding",
        direction: "received",
        amount: amount.naira,
        status: "pending",
        description: "Wallet funding via Paystack",
        reference,
      },
    });

    const callbackUrl = new URL(
      "/my-account/wallet",
      process.env.FRONTEND_URL || "http://localhost:5173",
    );
    let paymentResponse: Awaited<ReturnType<typeof fetch>>;
    let paymentData: {
      status?: boolean;
      data?: { authorization_url?: string };
    };
    try {
      paymentResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            amount: String(amount.kobo),
            currency: "NGN",
            reference,
            callback_url: callbackUrl.toString(),
            metadata: {
              purpose: "wallet_funding",
              userId,
              transactionId: transaction.id,
            },
          }),
        },
      );
      paymentData = await paymentResponse.json();
    } catch (error) {
      await prisma.walletTransaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });
      throw error;
    }

    if (
      !paymentResponse.ok ||
      !paymentData.status ||
      !paymentData.data?.authorization_url
    ) {
      await prisma.walletTransaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });
      console.error("Paystack wallet initialization failed:", paymentData);
      return res.status(502).json({ message: "Could not start wallet funding" });
    }

    res.json({ authorizationUrl: paymentData.data.authorization_url });
  } catch (error) {
    console.error("Failed to initialize wallet funding:", error);
    res.status(500).json({ message: "Failed to initialize wallet funding" });
  }
};

export const verifyWalletFunding = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId;
    const reference = req.body.reference;
    if (!userId) return res.status(401).json({ message: "Not authorized" });
    if (typeof reference !== "string" || !reference) {
      return res.status(400).json({ message: "Payment reference is required" });
    }

    const transaction = await prisma.walletTransaction.findFirst({
      where: { userId, reference, type: "funding" },
    });
    if (!transaction) {
      return res.status(404).json({ message: "Wallet funding transaction not found" });
    }
    if (transaction.status === "completed") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountBalance: true },
      });
      return res.json({ accountBalance: user?.accountBalance ?? 0 });
    }
    if (transaction.status !== "pending") {
      return res.status(409).json({ message: "This wallet funding payment is no longer pending" });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        message: "Server configuration is missing PAYSTACK_SECRET_KEY",
      });
    }

    const verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const verification = await verificationResponse.json();
    const payment = verification.data;
    const expectedKobo = Math.round(transaction.amount * 100);
    if (
      !verificationResponse.ok ||
      !verification.status ||
      payment?.status !== "success" ||
      payment?.reference !== reference ||
      payment?.currency !== "NGN" ||
      payment?.amount !== expectedKobo
    ) {
      return res.status(400).json({ message: "Wallet funding payment could not be verified" });
    }

    const balance = await prisma.$transaction(async (tx) => {
      const claimed = await tx.walletTransaction.updateMany({
        where: { id: transaction.id, status: "pending" },
        data: { status: "completed" },
      });
      if (claimed.count === 0) {
        const existingUser = await tx.user.findUnique({
          where: { id: userId },
          select: { accountBalance: true },
        });
        return existingUser?.accountBalance ?? 0;
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { accountBalance: { increment: transaction.amount } },
        select: { accountBalance: true },
      });
      return updatedUser.accountBalance;
    });

    res.json({ accountBalance: balance });
  } catch (error) {
    console.error("Failed to verify wallet funding:", error);
    res.status(500).json({ message: "Failed to verify wallet funding" });
  }
};

export const requestWalletPayout = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId;
    const amount = parseAmount(req.body.amount);
    const bankName =
      typeof req.body.bankName === "string" ? req.body.bankName.trim() : "";
    const accountNumber =
      typeof req.body.accountNumber === "string"
        ? req.body.accountNumber.trim()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!userId) return res.status(401).json({ message: "Not authorized" });
    if (!amount || amount.naira < MIN_TRANSACTION_NAIRA) {
      return res.status(400).json({
        message: `Enter a payout amount of at least ₦${MIN_TRANSACTION_NAIRA}`,
      });
    }
    if (!bankName || !/^\d{10}$/.test(accountNumber) || !password) {
      return res.status(400).json({
        message: "Bank name, a valid 10-digit account number, and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: userId, accountBalance: { gte: amount.naira } },
        data: { accountBalance: { decrement: amount.naira } },
      });
      if (debit.count === 0) return null;

      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          type: "payout",
          direction: "sent",
          amount: amount.naira,
          status: "pending",
          description: `Payout request to ${bankName}`,
          metadata: { bankName, accountNumber },
        },
      });
      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        select: { accountBalance: true },
      });
      return { transaction, accountBalance: updatedUser?.accountBalance ?? 0 };
    });

    if (!result) {
      return res.status(400).json({ message: "Payout amount exceeds your available balance" });
    }
    res.status(201).json({
      transaction: result.transaction,
      accountBalance: result.accountBalance,
    });
  } catch (error) {
    console.error("Failed to request wallet payout:", error);
    res.status(500).json({ message: "Failed to request payout" });
  }
};

export const getPendingPayoutRequests = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const requests = await prisma.walletTransaction.findMany({
      where: { type: "payout", status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(requests);
  } catch (error) {
    console.error("Failed to load payout requests:", error);
    res.status(500).json({ message: "Failed to load payout requests" });
  }
};

export const reviewPayoutRequest = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const action = req.body.action;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Payout request id is required" });
    }
    if (action !== "paid" && action !== "reject") {
      return res.status(400).json({ message: "Choose paid or reject" });
    }

    const request = await prisma.walletTransaction.findUnique({ where: { id } });
    if (!request || request.type !== "payout") {
      return res.status(404).json({ message: "Payout request not found" });
    }
    if (request.status !== "pending") {
      return res.status(409).json({ message: "This payout request has already been processed" });
    }

    const status = action === "paid" ? "completed" : "rejected";
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.walletTransaction.updateMany({
        where: { id, status: "pending", type: "payout" },
        data: { status },
      });
      if (claimed.count === 0) return null;

      if (action === "reject") {
        await tx.user.update({
          where: { id: request.userId },
          data: { accountBalance: { increment: request.amount } },
        });
      }
      return tx.walletTransaction.findUnique({ where: { id } });
    });

    if (!updated) {
      return res.status(409).json({ message: "This payout request has already been processed" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Failed to review payout request:", error);
    res.status(500).json({ message: "Failed to process payout request" });
  }
};
