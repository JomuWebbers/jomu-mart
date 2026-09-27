
import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

// Customer creates a return request for an order
export const createReturnRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { reason, comments, images, refundMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!orderId || typeof orderId !== "string") {
      return res.status(400).json({ message: "Order ID is required" });
    }

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ message: "Return reason is required" });
    }

    // Verify order exists and belongs to this user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId !== userId && req.userRole !== "admin") {
      return res.status(403).json({ message: "Not authorized to return this order" });
    }

    // Only orders marked as "Delivered" can be returned
    if (order.status !== "Delivered") {
      return res
        .status(400)
        .json({ message: "Only delivered orders are eligible for return requests" });
    }

    // Check if a pending or approved return request already exists
    const existingReturn = await prisma.returnRequest.findFirst({
      where: {
        orderId,
        status: { in: ["pending", "approved", "item_picked_up"] },
      },
    });

    if (existingReturn) {
      return res.status(400).json({
        message: "A return request is already in progress for this order",
      });
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        userId,
        reason,
        comments: comments || "",
        images: Array.isArray(images) ? images : [],
        refundAmount: order.total,
        refundMethod: refundMethod || "wallet",
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
            note: "Return request submitted by customer",
          },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            items: true,
            total: true,
            status: true,
          },
        },
      },
    });

    return res.status(201).json(returnRequest);
  } catch (error) {
    console.error("Create return error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Customer retrieves their own return requests
export const getMyReturns = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const returns = await prisma.returnRequest.findMany({
      where: { userId },
      include: {
        order: {
          select: {
            id: true,
            items: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(returns);
  } catch (error) {
    console.error("Get my returns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Admin lists all return requests
export const getAllReturns = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const whereClause: { status?: string } = {};
    if (typeof status === "string" && status.trim() !== "") {
      whereClause.status = status;
    }

    const returns = await prisma.returnRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            items: true,
            total: true,
            paymentMethod: true,
            shippingAddress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(returns);
  } catch (error) {
    console.error("Get all returns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Admin updates return request status (approve, reject, refund)
export const updateReturnStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Return ID is required" });
    }

    const validStatuses = ["pending", "approved", "rejected", "item_picked_up", "refunded"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid return status" });
    }

    const currentReturn = await prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!currentReturn) {
      return res.status(404).json({ message: "Return request not found" });
    }

    const history = Array.isArray(currentReturn.statusHistory)
      ? [...(currentReturn.statusHistory as object[])]
      : [];

    history.push({
      status,
      timestamp: new Date().toISOString(),
      note: adminNote || `Status updated to ${status}`,
    });

    // If status is refunded, credit user's accountBalance automatically
    if (status === "refunded" && currentReturn.status !== "refunded") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: currentReturn.userId },
          data: {
            accountBalance: {
              increment: currentReturn.refundAmount,
            },
          },
        }),
        prisma.returnRequest.update({
          where: { id },
          data: {
            status,
            adminNote: adminNote || currentReturn.adminNote,
            statusHistory: history,
          },
        }),
      ]);
    } else {
      await prisma.returnRequest.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote || currentReturn.adminNote,
          statusHistory: history,
        },
      });
    }

    const updated = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, accountBalance: true } },
        order: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Update return status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};




