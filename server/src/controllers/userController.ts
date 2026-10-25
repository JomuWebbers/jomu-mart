
import { Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/authMiddleware'

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountBalance: true,
        linkedBankAccountNumber: true,
        linkedBankName: true,
        isTrustedVendor: true,
        trustedVendorRequestStatus: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch account details' })
  }
}

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const { currentPassword, newPassword, confirmPassword } = req.body
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      typeof confirmPassword !== 'string' ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: 'All password fields are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      user.password,
    )
    if (!currentPasswordMatches) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const password = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password },
    })

    return res.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to update password' })
  }
}

export const linkBankAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const { accountNumber, bankName } = req.body
    if (!accountNumber || !bankName) {
      return res.status(400).json({ message: 'Account number and bank name are required' })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { linkedBankAccountNumber: accountNumber, linkedBankName: bankName },
      select: { id: true, linkedBankAccountNumber: true, linkedBankName: true },
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to link bank account' })
  }
}

export const withdraw = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const { password } = req.body
    if (!password) {
      return res.status(400).json({ message: 'Password is required to confirm withdrawal' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.linkedBankAccountNumber || !user.linkedBankName) {
      return res.status(400).json({ message: 'Please link a bank account before withdrawing' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' })
    }

    if (user.accountBalance <= 0) {
      return res.status(400).json({ message: 'No balance available to withdraw' })
    }

    const withdrawnAmount = user.accountBalance

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountBalance: 0 },
      select: { id: true, accountBalance: true },
    })

    res.json({
      message: 'Withdraw successful, thanks for shopping with us',
      amountWithdrawn: withdrawnAmount,
      newBalance: updated.accountBalance,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to process withdrawal' })
  }
}


export const requestTrustedVendor = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { trustedVendorRequestStatus: 'pending' },
      select: { id: true, trustedVendorRequestStatus: true },
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to submit trusted vendor request' })
  }
}

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { trustedOnly, pendingOnly } = req.query

    const users = await prisma.user.findMany({
      where: {
        role: 'customer',
        ...(trustedOnly === 'true' ? { isTrustedVendor: true } : {}),
        ...(pendingOnly === 'true' ? { trustedVendorRequestStatus: 'pending' } : {}),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        accountBalance: true, isTrustedVendor: true, trustedVendorRequestStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(users)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch users' })
  }
}

export const reviewTrustedVendorRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { approve } = req.body

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'User id is required' })
    }
    if (typeof approve !== 'boolean') {
      return res.status(400).json({ message: 'approve (true/false) is required' })
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isTrustedVendor: approve,
        trustedVendorRequestStatus: approve ? 'approved' : 'rejected',
      },
      select: { id: true, isTrustedVendor: true, trustedVendorRequestStatus: true },
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to review trusted vendor request' })
  }
}


