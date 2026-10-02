import { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/authMiddleware";

type OrderItem = { productId?: unknown };

function orderContainsProduct(items: unknown, productId: string) {
  return (
    Array.isArray(items) &&
    (items as OrderItem[]).some((item) => item?.productId === productId)
  );
}

export const getProductReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, status: true, sellerId: true },
    });

    if (
      !product ||
      (product.status !== "approved" &&
        product.sellerId !== req.userId &&
        req.userRole !== "admin")
    ) {
      return res.status(404).json({ message: "Product not found" });
    }

    const [reviews, myReview, deliveredOrders] = await Promise.all([
      prisma.review.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      req.userId
        ? prisma.review.findUnique({
            where: {
              userId_productId: { userId: req.userId, productId: id },
            },
            select: { id: true, rating: true, comment: true },
          })
        : Promise.resolve(null),
      req.userId
        ? prisma.order.findMany({
            where: { userId: req.userId, status: "Delivered" },
            orderBy: { createdAt: "desc" },
            select: { id: true, items: true },
          })
        : Promise.resolve([]),
    ]);

    const eligibleOrder = deliveredOrders.find((order) =>
      orderContainsProduct(order.items, id),
    );

    res.json({
      reviews,
      canReview: Boolean(eligibleOrder),
      alreadyReviewed: Boolean(myReview),
      myReview,
    });
  } catch (error) {
    console.error("Failed to load product reviews:", error);
    res.status(500).json({ message: "Failed to load product reviews" });
  }
};

export const submitProductReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!userId) {
      return res.status(401).json({ message: "Sign in to write a review" });
    }
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Choose a rating from 1 to 5" });
    }
    if (comment.length < 10 || comment.length > 1500) {
      return res.status(400).json({
        message: "Review text must be between 10 and 1,500 characters",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, status: true, sellerId: true },
    });
    if (!product || product.status !== "approved") {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.sellerId === userId) {
      return res.status(403).json({ message: "You can’t review your own listing" });
    }

    const deliveredOrders = await prisma.order.findMany({
      where: { userId, status: "Delivered" },
      orderBy: { createdAt: "desc" },
      select: { id: true, items: true },
    });
    const eligibleOrder = deliveredOrders.find((order) =>
      orderContainsProduct(order.items, id),
    );

    if (!eligibleOrder) {
      return res.status(403).json({
        message: "You can review this product after an order containing it is delivered",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.review.upsert({
        where: { userId_productId: { userId, productId: id } },
        create: {
          userId,
          productId: id,
          orderId: eligibleOrder.id,
          rating,
          comment,
        },
        update: {
          orderId: eligibleOrder.id,
          rating,
          comment,
        },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { productId: id },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.product.update({
        where: { id },
        data: {
          rating: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count._all,
        },
      });

      return {
        review,
        rating: aggregate._avg.rating ?? 0,
        reviewCount: aggregate._count._all,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Failed to submit product review:", error);
    res.status(500).json({ message: "Failed to submit product review" });
  }
};
