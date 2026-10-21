
import { Response } from 'express'
import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/authMiddleware'
import { getStreamChatServer, streamUserId, ensureSupportChannel } from '../lib/stream'

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { reference } = req.body
    const userId = req.userId

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Order id is required' })
    }
    if (!reference) {
      return res.status(400).json({ message: 'Payment reference is required' })
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }
    if (order.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to verify this order' })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return res.status(500).json({ message: 'Server misconfiguration: missing Paystack secret key' })
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const paystackData = await paystackRes.json()

    const amountMatches = paystackData.data?.amount === Math.round(order.total * 100)
    const isSuccessful = paystackData.data?.status === 'success'

    if (!isSuccessful || !amountMatches) {
      return res.status(400).json({ message: 'Payment verification failed' })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { isPaid: true },
    })

    // Notify the customer in their support chat that payment was confirmed
    try {
      const customer = await prisma.user.findUnique({ where: { id: order.userId } })
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } })

      if (customer && admin) {
        const server = getStreamChatServer()
        const channel = await ensureSupportChannel({
          server,
          userId: customer.id,
          userName: customer.name,
          adminId: admin.id,
          adminName: admin.name,
        })

        await channel.sendMessage({
          user_id: streamUserId(admin.id),
          text: `✅ Payment confirmed for Order #${order.id} — ₦${order.total}. Your items are being prepared.`,
        })
      }
    } catch (chatError) {
      // A chat notification failure must not undo a successful payment
      console.error('Payment confirmation chat failed:', chatError)
    }

    res.json(updated)
  }
  
  catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to verify payment' })
  }
}

