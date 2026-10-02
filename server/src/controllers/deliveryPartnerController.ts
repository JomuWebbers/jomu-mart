import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

export const createDeliveryPartner = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, vehicleType } = req.body;

    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "Name, email, and phone are required" });
    }

    const partner = await prisma.deliveryPartner.create({
      data: { name, email, password: "not-used-yet", phone, vehicleType },
    });

    res.status(201).json(partner);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ message: "A delivery partner with this email already exists" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to create delivery partner" });
  }
};

export const getDeliveryPartners = async (_req: Request, res: Response) => {
  try {
    const partners = await prisma.deliveryPartner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(partners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch delivery partners" });
  }
};

export const deleteDeliveryPartner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Delivery partner id is required' })
    }

    await prisma.deliveryPartner.delete({ where: { id } })

    res.json({ message: 'Delivery partner deleted successfully' })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Delivery partner not found' })
    }
    console.error(error)
    res.status(500).json({ message: 'Failed to delete delivery partner' })
  }
}


