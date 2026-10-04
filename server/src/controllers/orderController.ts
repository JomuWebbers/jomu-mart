
import { Response } from 'express'
import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/authMiddleware'
import { LGA_COORDINATES, STATE_WAREHOUSE } from '../data/lgaCoordinates'
import { getStreamChatServer, streamUserId, streamDisplayName } from '../lib/stream'

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Thrown inside the order transaction when a concurrent order took the last
// units. Rolling the transaction back is what keeps stock and orders consistent.
class StockConflictError extends Error {
  constructor(public readonly productId: string) {
    super(`Insufficient stock for product ${productId}`)
    this.name = 'StockConflictError'
  }
}

export const assignDeliveryPartner = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { deliveryPartnerId } = req.body

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Order id is required' })
    }
    if (!deliveryPartnerId) {
      return res.status(400).json({ message: 'deliveryPartnerId is required' })
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } })
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' })
    }

    const shippingAddress = order.shippingAddress as { state?: string; city?: string }
    const state = shippingAddress?.state
    const startPoint = state ? STATE_WAREHOUSE[state] : undefined

    if (!startPoint) {
      return res.status(400).json({ message: 'No warehouse configured for this order\'s state' })
    }

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : []

    const updated = await prisma.order.update({
      where: { id },
      data: {
        deliveryPartnerId,
        deliveryOtp: generateOtp(),
        liveLocation: startPoint,
        status: 'Assigned',
        statusHistory: [...history, { status: 'Assigned', at: new Date().toISOString() }],
      },
    })

    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to assign delivery partner' })
  }
}


export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const { items, shippingAddress, paymentMethod, subtotal, deliveryFee, tax } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' })
    }

    const productIds = items.map((item: { productId?: unknown }) => item?.productId);

if (productIds.some((id: unknown) => typeof id !== "string")) {
  return res.status(400).json({ message: "Every order item must have a valid product" });
}

// Quantities are validated up front: stock is decremented per unit below, so a
// malformed qty must never reach the decrement.
const typedItems = items as { productId: string; qty?: unknown }[];

for (const item of typedItems) {
  const qty = Number(item.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({
      message: "Every order item needs a whole quantity of at least 1",
    });
  }
}

const products = await prisma.product.findMany({
  where: { id: { in: productIds as string[] } },
  select: {
    id: true,
    name: true,
    price: true,
    sellerId: true,
    status: true,
    stock: true,
    chargesDeliveryFee: true,
    deliveryFeeAmount: true,
  },
});

const productsById = new Map(products.map((product) => [product.id, product]));

// Delivery is never trusted from the client. Each seller may set their own fee
// per listing, so a mixed-seller cart sums every applicable listing fee.
//
// The stored line items are rebuilt from these database rows further down
// rather than saved as sent: `price` and `sellerId` decide what a seller is
// later paid out, so a client that edited them would redirect payouts.
let serverDeliveryFee = 0;

for (const item of typedItems) {
  const product = productsById.get(item.productId);
  const qty = Number(item.qty);

  if (!product || product.status !== "approved") {
    return res.status(400).json({
      message: "A product in your cart is no longer available",
    });
  }

  if (product.sellerId === userId) {
    return res.status(403).json({
      message: "You can't purchase your own product",
    });
  }

  // null means unlimited stock; a number is decremented per unit placed.
  if (product.stock !== null && product.stock < qty) {
    return res.status(409).json({
      message:
        product.stock <= 0
          ? `${product.name} is out of stock`
          : `Only ${product.stock} left of ${product.name}`,
    });
  }

  if (product.chargesDeliveryFee) {
    serverDeliveryFee += Number(product.deliveryFeeAmount ?? 0);
  }
}

// Reject rather than silently correct a tampered delivery fee, so the buyer is
// never charged a different amount than the one they reviewed.
const claimedDeliveryFee = Number(deliveryFee ?? 0);
if (Math.abs(claimedDeliveryFee - serverDeliveryFee) > 1) {
  return res.status(409).json({
    message: "The delivery fee for your cart changed. Please review it and try again.",
    deliveryFee: serverDeliveryFee,
  });
}

// Rebuild every line from the database. Price, seller and name come from the
    // product row, never the request body: payoutSeller pays out from the stored
    // item, so a forged price or sellerId would pay the wrong account for the
    // wrong amount. Only the quantity is taken from the client.
    const orderItems = typedItems.map((item) => {
      const product = productsById.get(item.productId)!;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: Number(item.qty),
        sellerId: product.sellerId,
        image: (item as { image?: unknown }).image ?? null,
        payoutStatus: 'pending',
      };
    });

    const serverSubtotal = orderItems.reduce(
      (sum: number, item: { price: number; qty: number }) => sum + item.price * item.qty,
      0,
    );

    // A client subtotal that disagrees with the live prices means the buyer
    // reviewed a stale total, so reject rather than silently charge differently.
    if (Math.abs(Number(subtotal) - serverSubtotal) > 1) {
      return res.status(409).json({
        message: 'A price in your cart changed. Please review it and try again.',
        subtotal: serverSubtotal,
      });
    }


    if (!shippingAddress || !paymentMethod || subtotal === undefined) {
      return res.status(400).json({ message: 'Missing required order fields' })
    }

    // serverSubtotal comes from the database prices above, so a tampered
    // subtotal can never become the charged amount.
    const total = serverSubtotal + serverDeliveryFee + (tax || 0)

    // Order creation and stock decrement share one transaction: if any line runs
    // out, nothing is written. updateMany's `stock >= qty` guard is what makes
    // this safe when two buyers race for the last unit.
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        for (const item of typedItems) {
          const qty = Number(item.qty);
          const product = productsById.get(item.productId);

          // null means unlimited, so there is nothing to decrement.
          if (product?.stock === null) continue;

          const decremented = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });

          if (decremented.count === 0) {
            throw new StockConflictError(item.productId);
          }
        }

        return tx.order.create({
          data: {
            userId,
            items: orderItems,
            shippingAddress,
            paymentMethod,
            subtotal: serverSubtotal,
            deliveryFee: serverDeliveryFee,
            tax: tax || 0,
            total,
            status: 'Placed',
            statusHistory: [{ status: 'Placed', at: new Date().toISOString() }],
            isPaid: paymentMethod !== 'Pay on Delivery' && paymentMethod !== 'Card (Paystack)',
          },
        });
      }, {
        // Prisma's 5s default is too tight once several buyers are checking out
        // at once against a pooled connection; the transaction is tiny but can
        // queue behind other checkouts.
        timeout: 15000,
        maxWait: 10000,
      });
    } catch (error) {
      if (error instanceof StockConflictError) {
        return res.status(409).json({
          message: "Someone bought the last of one of these items while you were checking out. Please review your cart.",
        });
      }
      throw error;
    }

        // Notify the customer in their existing support chat.
    // A chat error should not undo a successfully created order.
    try {
      const [customer, admin] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true },
        }),
        prisma.user.findFirst({
          where: { role: "admin" },
          select: { id: true, name: true, role: true },
        }),
      ]);

      if (customer && admin) {
        const server = getStreamChatServer();
        const customerSid = streamUserId(customer.id);
        const adminSid = streamUserId(admin.id);

        await server.upsertUsers([
          { id: customerSid, name: customer.name },
          {
            id: adminSid,
            name: streamDisplayName(admin.role, admin.name),
          },
        ]);

        const channel = server.channel(
          "messaging",
          `support-${customer.id}`,
          {
            members: [customerSid, adminSid],
            created_by_id: adminSid,
          },
        );

        // watch() gets or creates the support channel.
        await channel.watch();

        const frontendUrl =
          process.env.FRONTEND_URL || "http://localhost:5173";
        const trackingUrl =
          `${frontendUrl}/track/${encodeURIComponent(order.id)}`;

        await channel.sendMessage({
          user_id: adminSid,
          text:
            `Hi ${customer.name}, your Jomu Mart order has been placed.\n\n` +
            `Order ID: ${order.id}\n` +
            `Track your order: ${trackingUrl}\n\n` +
            `You can also find this order anytime under My Orders.`,
        });
      }
    } catch (chatError) {
      console.error("Could not send order confirmation chat message:", chatError);
    }
    
    res.status(201).json(order)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create order' })
  }
}

export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    type OrderItemSnapshot = {
      productId?: string;
      name?: string;
      qty?: number;
      price?: number;
      image?: string;
    };

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        returnRequests: {
          select: {
            id: true,
            status: true,
            reason: true,
            refundAmount: true,
            refundMethod: true,
            adminNote: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Order items are a checkout snapshot and carry no image, so the current
    // product image is attached for the order history thumbnails.
    const productIds = orders.flatMap((order) =>
      ((order.items ?? []) as unknown as OrderItemSnapshot[])
        .map((item) => item.productId)
        .filter((id): id is string => typeof id === 'string'),
    )

    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, image: true, images: true },
        })
      : []

    const imageById = new Map(
      products.map((product) => [
        product.id,
        product.image || product.images[0] || '',
      ]),
    )

    res.json(
      orders.map((order) => ({
        ...order,
        items: ((order.items ?? []) as unknown as OrderItemSnapshot[]).map(
          (item) => ({
            ...item,
            image: imageById.get(item.productId ?? '') ?? '',
          }),
        ),
      })),
    )
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
}

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.userId

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Order id is required' })
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { deliveryPartner: true  } })

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    // Only the order's owner or an admin can view it
    if (order.userId !== userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this order' })
    }

    res.json(order)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch order' })
  }
}

export const getAllOrders = async (_req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
}

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Order id is required' })
    }
    if (!status) {
      return res.status(400).json({ message: 'Status is required' })
    }

    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : []

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        statusHistory: [...history, { status, at: new Date().toISOString() }],
      },
    })

    res.json(order)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update order status' })
  }
}





const PLATFORM_FEE_PERCENT = 10

export const payoutSeller = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, productId } = req.params

    if (!orderId || Array.isArray(orderId) || !productId || Array.isArray(productId)) {
      return res.status(400).json({ message: 'orderId and productId are required' })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const items = Array.isArray(order.items) ? (order.items as any[]) : []
    const itemIndex = items.findIndex(i => i.productId === productId)

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in this order' })
    }

    const item = items[itemIndex]

    if (!item.sellerId) {
      return res.status(400).json({ message: 'This item has no seller on record (likely an older order) and cannot be paid out' })
    }
    if (item.payoutStatus === 'paid') {
      return res.status(409).json({ message: 'This item has already been paid out' })
    }

    const grossAmount = item.price * item.qty
    const payoutAmount = grossAmount * (1 - PLATFORM_FEE_PERCENT / 100)

    items[itemIndex] = { ...item, payoutStatus: 'paid' }

    const [, seller] = await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { items } }),
      prisma.user.update({
        where: { id: item.sellerId },
        data: { accountBalance: { increment: payoutAmount } },
      }),
    ])

    // Send an automated chat message to the seller
    try {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
      if (admin) {
        const server = getStreamChatServer()
        const sellerSid = streamUserId(seller.id)
        const adminSid = streamUserId(admin.id)

        await server.upsertUsers([
          { id: sellerSid, name: seller.name },
          { id: adminSid, name: streamDisplayName(admin.role, admin.name) },
        ])

        const channel = server.channel('messaging', `support-${seller.id}`, {
          members: [sellerSid, adminSid],
          created_by_id: adminSid,
        })
        await channel.create()
        await channel.sendMessage({
          text: 'Congratulations, your product has been sold and payment processing soon to be reflected on your dashboard for withdrawal.',
          user_id: adminSid,
        })
      }
    } catch (chatError) {
      console.error('Failed to send payout chat notification:', chatError)
      // Don't fail the whole payout if the chat message fails to send
    }

    res.json({ message: 'Seller paid out successfully', payoutAmount, sellerBalance: seller.accountBalance })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to process seller payout' })
  }
}







