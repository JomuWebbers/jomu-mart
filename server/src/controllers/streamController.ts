
import { Response } from 'express'
import prisma from '../lib/prisma'
import { getStreamChatServer, streamApiKey, streamUserId, streamDisplayName } from '../lib/stream'
import type { AuthRequest } from '../middleware/authMiddleware'

export const createStreamToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const server = getStreamChatServer()
    const sid = streamUserId(user.id)
    const name = streamDisplayName(user.role, user.name)

    await server.upsertUser({ id: sid, name })
    const token = server.createToken(sid)

    res.json({ token, apiKey: streamApiKey, userId: sid, name })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create chat token' })
  }
}

export const getSupportAgent = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
    if (!admin) {
      return res.status(404).json({ message: 'No support agent configured yet' })
    }

    const server = getStreamChatServer()
    const sid = streamUserId(admin.id)
    const name = streamDisplayName(admin.role, admin.name)

    await server.upsertUser({ id: sid, name })

    res.json({ agentId: sid, agentName: name })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch support agent' })
  }
}

