
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
    if (typeof reference !== 'string' || !reference) {
      return res.status(400).json({ message: 'Payment reference is required' })
    }
    if (reference !== id) {
      return res.status(400).json({ message: 'Payment reference does not match this order' })
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }
    if (order.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to verify this order' })
    }
    if (order.paymentMethod !== 'Card (Paystack)') {
      return res.status(409).json({ message: 'This order does not use Paystack card payment' })
    }
    if (order.isPaid) {
      return res.json(order)
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return res.status(500).json({ message: 'Server misconfiguration: missing Paystack secret key' })
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const paystackData: {
      status?: boolean
      data?: {
        amount?: number
        currency?: string
        reference?: string
        status?: string
      }
    } = await paystackRes.json()
    const payment = paystackData.data

    const isValidPayment =
      paystackRes.ok &&
      paystackData.status === true &&
      payment?.status === 'success' &&
      payment.reference === reference &&
      payment.currency === 'NGN' &&
      payment.amount === Math.round(order.total * 100)

    if (!isValidPayment) {
      return res.status(400).json({ message: 'Payment verification failed' })
    }

    const claimed = await prisma.order.updateMany({
      where: { id, userId, isPaid: false },
      data: { isPaid: true },
    })
    const updated = await prisma.order.findUnique({ where: { id } })
    if (!updated) {
      return res.status(404).json({ message: 'Order not found' })
    }

    if (claimed.count > 0) {
      // Notify once after the payment state transitions to paid.
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
    }

    res.json(updated)
  }
  
  catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to verify payment' })
  }
}
