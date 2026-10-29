
import { Router } from 'express'
import {
  getMe,
  requestAccountDeletion,
  cancelAccountDeletion,
  reviewAccountDeletion,
  changePassword,
  linkBankAccount,
  requestTrustedVendor,
  getUsers,
  reviewTrustedVendorRequest,
} from '../controllers/userController'
import { protect, isAdmin, isCustomer } from '../middleware/authMiddleware'

const router = Router()

router.get('/me', protect, isCustomer, getMe)
router.post('/me/deletion-request', protect, isCustomer, requestAccountDeletion)
router.delete('/me/deletion-request', protect, isCustomer, cancelAccountDeletion)
router.patch('/password', protect, isCustomer, changePassword)
router.patch('/bank-account', protect, isCustomer, linkBankAccount)
router.post('/trusted-vendor-request', protect, isCustomer, requestTrustedVendor)

router.get('/', protect, isAdmin, getUsers)
router.patch('/:id/deletion-request', protect, isAdmin, reviewAccountDeletion)
router.patch('/:id/trusted-vendor-request', protect, isAdmin, reviewTrustedVendorRequest)

export default router
