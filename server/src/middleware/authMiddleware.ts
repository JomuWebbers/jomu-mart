
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided' })
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, malformed token' })
  }

  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    return res.status(500).json({ message: 'Server misconfiguration: missing JWT secret' })
  }

  let decoded: { userId: string; role: string }
  try {
    decoded = jwt.verify(token, jwtSecret) as unknown as {
      userId: string
      role: string
    }
  } catch {
    return res.status(401).json({ message: 'Not authorized, invalid token' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { accountAnonymizedAt: true },
    })
    if (!user || user.accountAnonymizedAt) {
      return res.status(401).json({ message: 'This account is no longer active' })
    }

    req.userId = decoded.userId
    req.userRole = decoded.role
    next()
  } catch (error) {
    console.error('Failed to validate authenticated account:', error)
    return res.status(500).json({ message: 'Failed to validate account' })
  }
}

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}

export const isCustomer = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ message: 'Customer access required' })
  }
  next()
}

export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }
  const token = authHeader.split(' ')[1]
  const jwtSecret = process.env.JWT_SECRET
  if (!token || !jwtSecret) {
    return next()
  }
  try {
    const decoded = jwt.verify(token, jwtSecret) as unknown as { userId: string; role: string }
    req.userId = decoded.userId
    req.userRole = decoded.role
  } catch {
    // invalid/expired token — proceed as an unauthenticated visitor rather than blocking
  }
  next()
}



