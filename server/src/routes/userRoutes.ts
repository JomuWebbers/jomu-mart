
import { Router } from 'express'
import {
  getMe, changePassword, linkBankAccount, withdraw, requestTrustedVendor, getUsers, reviewTrustedVendorRequest,
} from '../controllers/userController'
import { protect, isAdmin } from '../middleware/authMiddleware'

const router = Router()

router.get('/me', protect, getMe)
router.patch('/password', protect, changePassword)
router.patch('/bank-account', protect, linkBankAccount)
router.post('/withdraw', protect, withdraw)
router.post('/trusted-vendor-request', protect, requestTrustedVendor)

router.get('/', protect, isAdmin, getUsers)
router.patch('/:id/trusted-vendor-request', protect, isAdmin, reviewTrustedVendorRequest)

export default router

