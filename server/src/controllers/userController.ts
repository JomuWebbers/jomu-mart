
import { Response } from 'express'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/authMiddleware'

const anonymizeReturnStatusHistory = (
  history: Prisma.JsonValue | null,
): Prisma.InputJsonValue => {
  if (!Array.isArray(history)) {
    return []
  }

  return history.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return []
    }

    return [{
      ...(typeof entry.status === 'string' ? { status: entry.status } : {}),
      ...(typeof entry.timestamp === 'string' ? { timestamp: entry.timestamp } : {}),
      ...(typeof entry.at === 'string' ? { at: entry.at } : {}),
    }]
  })
}

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
        trustedVendorBusinessName: true,
        trustedVendorCategories: true,
        trustedVendorLocation: true,
        trustedVendorDescription: true,
        trustedVendorWebsite: true,
        trustedVendorRequestedAt: true,
        trustedVendorRejectionReason: true,
        accountDeletionRequestedAt: true,
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

export const requestAccountDeletion = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const { password } = req.body

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Password is required' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        accountDeletionRequestedAt: true,
        accountAnonymizedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (user.accountAnonymizedAt) {
      return res.status(409).json({ message: 'This account has already been anonymized' })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Password is incorrect' })
    }

    const requestedAt = user.accountDeletionRequestedAt ?? new Date()
    await prisma.user.update({
      where: { id: userId },
      data: { accountDeletionRequestedAt: requestedAt },
    })

    return res.json({
      message: 'Account deletion request submitted',
      accountDeletionRequestedAt: requestedAt,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to submit account deletion request' })
  }
}

export const cancelAccountDeletion = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { accountDeletionRequestedAt: null },
    })

    return res.json({ message: 'Account deletion request cancelled' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to cancel account deletion request' })
  }
}

export const reviewAccountDeletion = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { approve } = req.body

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'User id is required' })
    }
    if (typeof approve !== 'boolean') {
      return res.status(400).json({ message: 'approve (true/false) is required' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, accountDeletionRequestedAt: true, accountAnonymizedAt: true },
    })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (!user.accountDeletionRequestedAt) {
      return res.status(409).json({ message: 'This user has no pending account deletion request' })
    }

    if (approve) {
      const replacementPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
      const anonymized = await prisma.$transaction(async (tx) => {
        const claimed = await tx.user.updateMany({
          where: {
            id,
            accountDeletionRequestedAt: { not: null },
            accountAnonymizedAt: null,
          },
          data: {
            name: 'Deleted account',
            email: `deleted-${id}@deleted.invalid`,
            password: replacementPassword,
            phone: '',
            avatar: null,
            linkedBankAccountNumber: null,
            linkedBankName: null,
            isTrustedVendor: false,
            trustedVendorRequestStatus: 'none',
            trustedVendorBusinessName: null,
            trustedVendorCategories: [],
            trustedVendorLocation: null,
            trustedVendorDescription: null,
            trustedVendorWebsite: null,
            trustedVendorRequestedAt: null,
            trustedVendorRejectionReason: null,
            accountDeletionRequestedAt: null,
            accountAnonymizedAt: new Date(),
          },
        })
        if (claimed.count === 0) {
          return false
        }

        await tx.address.deleteMany({ where: { userId: id } })
        await tx.wishlist.deleteMany({ where: { userId: id } })
        await tx.product.updateMany({
          where: { sellerId: id },
          data: {
            status: 'archived',
            sellerState: null,
            sellerLga: null,
            sellerAddress: null,
          },
        })
        await tx.order.updateMany({
          where: { userId: id },
          data: {
            shippingAddress: {
              name: 'Deleted account',
              phone: '',
              address: '',
              city: '',
              state: '',
              zip: '',
            },
          },
        })
        await tx.review.updateMany({
          where: { userId: id },
          data: { comment: '' },
        })
        await tx.walletTransaction.updateMany({
          where: { userId: id },
          data: { metadata: Prisma.DbNull },
        })

        const returnRequests = await tx.returnRequest.findMany({
          where: { userId: id },
          select: { id: true, statusHistory: true },
        })
        for (const returnRequest of returnRequests) {
          await tx.returnRequest.update({
            where: { id: returnRequest.id },
            data: {
              comments: '',
              images: [],
              adminNote: '',
              statusHistory: anonymizeReturnStatusHistory(returnRequest.statusHistory),
            },
          })
        }

        return true
      })
      if (!anonymized) {
        return res.status(409).json({ message: 'This deletion request has already been reviewed' })
      }
      return res.json({ message: 'Account anonymized; order and financial records retained' })
    }

    await prisma.user.update({
      where: { id },
      data: { accountDeletionRequestedAt: null },
    })
    return res.json({ message: 'Account deletion request rejected' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to review account deletion request' })
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

export const requestTrustedVendor = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const {
      businessName,
      categories,
      location,
      description,
      website,
    } = req.body

    if (
      typeof businessName !== 'string' ||
      businessName.trim().length < 2 ||
      businessName.trim().length > 100 ||
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.length > 10 ||
      categories.some((category: unknown) =>
        typeof category !== 'string' ||
        category.trim().length === 0 ||
        category.trim().length > 80
      ) ||
      typeof location !== 'string' ||
      location.trim().length < 2 ||
      location.trim().length > 160 ||
      typeof description !== 'string' ||
      description.trim().length < 20 ||
      description.trim().length > 1000 ||
      (website !== undefined &&
        (typeof website !== 'string' || website.trim().length > 200))
    ) {
      return res.status(400).json({
        message: 'Provide a business name, at least one product category, a location, and a description between 20 and 1,000 characters.',
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTrustedVendor: true, trustedVendorRequestStatus: true },
    })
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (existingUser.isTrustedVendor || existingUser.trustedVendorRequestStatus === 'approved') {
      return res.status(409).json({ message: 'Your trusted-vendor application is already approved.' })
    }
    if (existingUser.trustedVendorRequestStatus === 'pending') {
      return res.status(409).json({ message: 'Your trusted-vendor application is already under review.' })
    }

    const normalizedWebsite = typeof website === 'string' ? website.trim() : ''
    if (normalizedWebsite) {
      try {
        const parsedWebsite = new URL(normalizedWebsite)
        if (parsedWebsite.protocol !== 'https:' && parsedWebsite.protocol !== 'http:') {
          throw new Error('Unsupported website protocol')
        }
      } catch {
        return res.status(400).json({ message: 'Enter a valid website URL beginning with http:// or https://.' })
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        trustedVendorRequestStatus: 'pending',
        trustedVendorBusinessName: businessName.trim(),
        trustedVendorCategories: [...new Set(categories.map((category: string) => category.trim()))],
        trustedVendorLocation: location.trim(),
        trustedVendorDescription: description.trim(),
        trustedVendorWebsite: normalizedWebsite || null,
        trustedVendorRequestedAt: new Date(),
        trustedVendorRejectionReason: null,
      },
      select: {
        id: true,
        isTrustedVendor: true,
        trustedVendorRequestStatus: true,
        trustedVendorBusinessName: true,
        trustedVendorCategories: true,
        trustedVendorLocation: true,
        trustedVendorDescription: true,
        trustedVendorWebsite: true,
        trustedVendorRequestedAt: true,
        trustedVendorRejectionReason: true,
      },
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to submit trusted vendor request' })
  }
}

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { trustedOnly, pendingOnly, deletionRequestedOnly } = req.query

    const users = await prisma.user.findMany({
      where: {
        role: 'customer',
        accountAnonymizedAt: null,
        ...(trustedOnly === 'true' ? { isTrustedVendor: true } : {}),
        ...(pendingOnly === 'true' ? { trustedVendorRequestStatus: 'pending' } : {}),
        ...(deletionRequestedOnly === 'true'
          ? { accountDeletionRequestedAt: { not: null } }
          : {}),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        accountBalance: true, isTrustedVendor: true, trustedVendorRequestStatus: true,
        trustedVendorBusinessName: true, trustedVendorCategories: true,
        trustedVendorLocation: true, trustedVendorDescription: true,
        trustedVendorWebsite: true, trustedVendorRequestedAt: true,
        trustedVendorRejectionReason: true,
        accountDeletionRequestedAt: true,
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
    const { approve, rejectionReason } = req.body

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'User id is required' })
    }
    if (typeof approve !== 'boolean') {
      return res.status(400).json({ message: 'approve (true/false) is required' })
    }
    if (
      rejectionReason !== undefined &&
      (typeof rejectionReason !== 'string' || rejectionReason.trim().length > 500)
    ) {
      return res.status(400).json({ message: 'Rejection reason must be 500 characters or fewer' })
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isTrustedVendor: approve,
        trustedVendorRequestStatus: approve ? 'approved' : 'rejected',
        trustedVendorRejectionReason: approve
          ? null
          : typeof rejectionReason === 'string' && rejectionReason.trim()
            ? rejectionReason.trim()
            : null,
      },
      select: {
        id: true,
        isTrustedVendor: true,
        trustedVendorRequestStatus: true,
        trustedVendorRejectionReason: true,
      },
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to review trusted vendor request' })
  }
}
