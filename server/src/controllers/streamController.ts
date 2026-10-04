
import { Response } from 'express'
import prisma from '../lib/prisma'
import {
  getStreamChatServer,
  streamApiKey,
  streamUserId,
  streamDisplayName,
  ensureSupportChannel,
} from '../lib/stream'
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
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
    if (!admin) {
      return res.status(404).json({ message: 'No support agent configured yet' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const server = getStreamChatServer()
    const sid = streamUserId(admin.id)
    const name = streamDisplayName(admin.role, admin.name)

    await server.upsertUser({ id: sid, name })

    // Create/repair the customer's support channel here, server-side, instead
    // of letting the browser create it.
    //
    // ChatContext.tsx calls chatClient.channel(...) + watch() from the client,
    // which is a user-scoped request. If the channel does not already exist,
    // that becomes a GetOrCreateChannel the user has no permission for, and
    // Stream rejects it with error 17:
    //   "GetOrCreateChannel failed ... not allowed to perform action
    //    ReadChannel in scope 'messaging'"  (a 403 in the console)
    // and the widget hangs on "Connecting to support..." forever.
    //
    // This client holds the API secret, so it can both create the channel and
    // add the customer as a member. The browser then only ever WATCHES an
    // existing channel it belongs to, which is always permitted.
    await ensureSupportChannel({
      server,
      userId: user.id,
      userName: user.name,
      adminId: admin.id,
      adminName: admin.name,
    })

    res.json({ agentId: sid, agentName: name })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch support agent' })
  }
}

