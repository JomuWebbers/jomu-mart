
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
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

  try {
    const decoded = jwt.verify(token, jwtSecret) as unknown as {
      userId: string
      role: string
    }
    req.userId = decoded.userId
    req.userRole = decoded.role
    next()
  } catch {
    return res.status(401).json({ message: 'Not authorized, invalid token' })
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




