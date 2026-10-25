import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/authMiddleware";

export const getWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const items = await prisma.wishlist.findMany({
      where: { userId, product: { status: "approved" } },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(items.map(({ product }) => product));
  } catch (error) {
    console.error("Failed to fetch wishlist:", error);
    res.status(500).json({ message: "Failed to fetch saved items" });
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (!productId || Array.isArray(productId)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== "approved") {
      return res.status(404).json({ message: "Product not found" });
    }

    await prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });

    res.status(204).send();
  } catch (error) {
    console.error("Failed to save wishlist item:", error);
    res.status(500).json({ message: "Failed to save item" });
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (!productId || Array.isArray(productId)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    await prisma.wishlist.deleteMany({ where: { userId, productId } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to remove wishlist item:", error);
    res.status(500).json({ message: "Failed to remove saved item" });
  }
};
