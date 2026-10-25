import { Router } from 'express'
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from '../controllers/addressController'
import { protect } from '../middleware/authMiddleware'

const router = Router()

router.use(protect)
router.get('/', getAddresses)
router.post('/', createAddress)
router.patch('/:id', updateAddress)
router.delete('/:id', deleteAddress)

export default router
