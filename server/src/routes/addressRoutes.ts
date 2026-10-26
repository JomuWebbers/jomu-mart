import { Router } from 'express'
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from '../controllers/addressController'
import { protect, isCustomer } from '../middleware/authMiddleware'

const router = Router()

router.use(protect, isCustomer)
router.get('/', getAddresses)
router.post('/', createAddress)
router.patch('/:id', updateAddress)
router.delete('/:id', deleteAddress)

export default router
