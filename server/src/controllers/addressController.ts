import { Response } from 'express'
import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/authMiddleware'
import { LGA_COORDINATES, STATE_WAREHOUSE } from '../data/lgaCoordinates'

type AddressInput = {
  label?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  zip?: unknown
  isDefault?: unknown
}

function validateAddressInput(
  input: AddressInput,
  partial = false,
): string | null {
  if (!input || typeof input !== 'object') {
    return 'Valid address details are required'
  }
  if (partial && !Object.values(input).some((value) => value !== undefined)) {
    return 'At least one address field is required'
  }

  const requiredFields: (keyof AddressInput)[] = [
    'label',
    'address',
    'city',
    'state',
    'zip',
  ]
  for (const field of requiredFields) {
    const value = input[field]
    if (
      (!partial || value !== undefined) &&
      (typeof value !== 'string' || !value.trim())
    ) {
      return `${field} is required`
    }
  }
  if (input.isDefault !== undefined && typeof input.isDefault !== 'boolean') {
    return 'isDefault must be a boolean'
  }
  return null
}

function coordinatesFor(city: string, state: string) {
  const cityCoordinates = LGA_COORDINATES[city]
  const stateCoordinates = STATE_WAREHOUSE[state]
  return cityCoordinates ?? stateCoordinates
}

export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const addresses = await prisma.address.findMany({
      where: { userId: req.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return res.json(addresses)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to load addresses' })
  }
}

export const createAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }

    const input = req.body as AddressInput
    const validationError = validateAddressInput(input)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    const label = (input.label as string).trim()
    const address = (input.address as string).trim()
    const city = (input.city as string).trim()
    const state = (input.state as string).trim()
    const zip = (input.zip as string).trim()
    const coordinates = coordinatesFor(city, state)
    if (!coordinates) {
      return res.status(400).json({ message: 'Select a supported Nigerian state' })
    }

    const created = await prisma.$transaction(async (transaction) => {
      const existingCount = await transaction.address.count({
        where: { userId },
      })
      const isDefault = input.isDefault === true || existingCount === 0
      if (isDefault) {
        await transaction.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        })
      }
      return transaction.address.create({
        data: {
          userId,
          label,
          address,
          city,
          state,
          zip,
          isDefault,
          ...coordinates,
        },
      })
    })

    return res.status(201).json(created)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to create address' })
  }
}

export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    const addressId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id
    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' })
    }

    const input = req.body as AddressInput
    const validationError = validateAddressInput(input, true)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    })
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' })
    }

    const city = typeof input.city === 'string' ? input.city.trim() : existing.city
    const state =
      typeof input.state === 'string' ? input.state.trim() : existing.state
    const coordinates = coordinatesFor(city, state)
    if (!coordinates) {
      return res.status(400).json({ message: 'Select a supported Nigerian state' })
    }
    const data = {
      ...(typeof input.label === 'string' ? { label: input.label.trim() } : {}),
      ...(typeof input.address === 'string'
        ? { address: input.address.trim() }
        : {}),
      ...(typeof input.city === 'string' ? { city } : {}),
      ...(typeof input.state === 'string' ? { state } : {}),
      ...(typeof input.zip === 'string' ? { zip: input.zip.trim() } : {}),
      ...(typeof input.isDefault === 'boolean'
        ? { isDefault: input.isDefault }
        : {}),
      ...(input.city !== undefined || input.state !== undefined
        ? coordinates
        : {}),
    }

    const updated = await prisma.$transaction(async (transaction) => {
      if (input.isDefault === true) {
        await transaction.address.updateMany({
          where: { userId, id: { not: existing.id } },
          data: { isDefault: false },
        })
      }
      return transaction.address.update({
        where: { id: existing.id },
        data,
      })
    })

    return res.json(updated)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to update address' })
  }
}

export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    const addressId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id
    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' })
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    })
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' })
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.address.delete({ where: { id: existing.id } })
      if (existing.isDefault) {
        const nextDefault = await transaction.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })
        if (nextDefault) {
          await transaction.address.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to delete address' })
  }
}
