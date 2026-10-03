import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/authMiddleware";

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    const products = await prisma.product.findMany({
      where: {
        status: "approved",
        ...(category ? { category: category as string } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const isOwner = req.userId === product.sellerId;
    const isAdminUser = req.userRole === "admin";

    if (product.status !== "approved" && !isOwner && !isAdminUser) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.userId;
    if (!sellerId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const {
      name,
      description,
      price,
      originalPrice,
      image,
      images,
      category,
      subcategory: incomingSubcategory,
      subCategory,
      stock,
      negotiable,
      fulfillmentMethod,
      sellerState,
      sellerLga,
      sellerAddress,
      deliveryDays,
      chargesDeliveryFee,
      deliveryFeeAmount,
    } = req.body;

    const subcategory = incomingSubcategory ?? subCategory;

    const numericPrice = Number(price);
    const numericOriginalPrice = originalPrice === undefined || originalPrice === null || originalPrice === "" ? 0 : Number(originalPrice);
    const numericStock = stock === undefined || stock === null || stock === "" ? 0 : Number(stock);
    const numericDeliveryDays = deliveryDays === undefined || deliveryDays === null || deliveryDays === "" ? null : Number(deliveryDays);
    const numericDeliveryFee = deliveryFeeAmount === undefined || deliveryFeeAmount === null || deliveryFeeAmount === "" ? 0 : Number(deliveryFeeAmount);
    const imageList = Array.isArray(images) && images.length > 0 ? images : [image];

    if (typeof name !== "string" || !name.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0 || typeof image !== "string" || !image || typeof category !== "string" || !category) {
      return res
        .status(400)
        .json({ message: "Name, price, image, and category are required" });
    }
    if (!Number.isFinite(numericOriginalPrice) || numericOriginalPrice < 0 || !Number.isInteger(numericStock) || numericStock < 0) {
      return res.status(400).json({ message: "Price and stock values must be valid positive amounts" });
    }
    if (!Array.isArray(imageList) || imageList.length > 5 || imageList.some((url) => typeof url !== "string" || !url)) {
      return res.status(400).json({ message: "Provide up to five valid product image URLs" });
    }
    if (fulfillmentMethod && fulfillmentMethod !== "dropoff" && fulfillmentMethod !== "pickup") {
      return res.status(400).json({ message: "Fulfillment method must be dropoff or pickup" });
    }
    if (fulfillmentMethod === "pickup" && (!sellerState || !sellerLga || !sellerAddress)) {
      return res.status(400).json({ message: "Pickup state, LGA, and address are required" });
    }
    if ((numericDeliveryDays !== null && (!Number.isInteger(numericDeliveryDays) || numericDeliveryDays < 1)) || !Number.isFinite(numericDeliveryFee) || numericDeliveryFee < 0) {
      return res.status(400).json({ message: "Delivery estimate and fee must be valid non-negative amounts" });
    }

    const status = req.userRole === "admin" ? "approved" : "pending";

    // Track lifetime listings so the free quota cannot be reset by deleting products.
    // Admins bypass listing fees entirely, so they do not consume quota.
    if (req.userRole !== "admin") {
      await prisma.user.update({
        where: { id: sellerId },
        data: { freeListingsUsed: { increment: 1 } },
      });
    }

    const product = await prisma.product.create({
      data: {
        // name,
        name: name.trim(),
        description,
        price: numericPrice,
        originalPrice: numericOriginalPrice,
        image,
        images: imageList,
        category,
        subcategory,
        stock: numericStock,
        negotiable: negotiable ?? "no",
        fulfillmentMethod: fulfillmentMethod ?? "dropoff",
        sellerState: sellerState || null,
        sellerLga: sellerLga || null,
        sellerAddress: sellerAddress || null,
        deliveryDays: numericDeliveryDays,
        chargesDeliveryFee: chargesDeliveryFee === true,
        deliveryFeeAmount: numericDeliveryFee,
        sellerId,
        status,
      },
    })


    res.status(201).json(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ message: "A product with this value already exists" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to create product" });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    //Only allow specific fields to be updated
    const allowedFields = [
      "name",
      "description",
      "price",
      "originalPrice",
      "image",
      "images",
      "category",
      "subcategory",
      "stock",
      "status",
      "negotiable",
      "fulfillmentMethod",
      "sellerState",
      "sellerLga",
      "sellerAddress",
      "deliveryDays",
      "chargeDeliveryFee",
      "deliveryFeeAmount"
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({message: "No valid fields to update"})
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    res.json(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Product not found" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to update product" });
  }
};



export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }

    await prisma.product.delete({ where: { id } });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Product not found" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to delete product" });
  }
};

export const getMyListings = async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.userId;
    if (!sellerId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const products = await prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch your listings" });
  }
};

export const reviewListing = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: "Product id is required" });
    }
    if (status !== "approved" && status !== "rejected") {
      return res
        .status(400)
        .json({ message: 'Status must be "approved" or "rejected"' });
    }

    

    const listing = await prisma.product.findUnique({
  where: { id },
  select: {
    listingFeePaid: true,
    seller: { select: { role: true } },
  },
});

if (!listing) {
  return res.status(404).json({ message: "Product not found" });
}

if (
  status === "approved" &&
  listing.seller.role !== "admin" &&
  !listing.listingFeePaid
) {
  return res.status(402).json({
    message: "The seller must pay this month's listing fee before approval",
  });
}

    const product = await prisma.product.update({
      where: { id },
      data: { status },
    });

    res.json(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Product not found" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to review listing" });
  }
};


export const getPendingListings = async (_req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "pending", listingFeePaid: true },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch pending listings" });
  }
};




