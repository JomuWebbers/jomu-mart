
import { Router } from 'express'
import {
  createOrder,
  getMyOrders,
  getPendingRatings,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  assignDeliveryPartner,
} from '../controllers/orderController'

import { protect, isAdmin } from '../middleware/authMiddleware'
import { verifyPayment } from '../controllers/paymentController'
import { payoutSeller } from '../controllers/orderController'


const router = Router()

// Logged-in user routes
router.post('/', protect, createOrder)
router.get('/my-orders', protect, getMyOrders)
router.get('/pending-ratings', protect, getPendingRatings)
router.get('/:id', protect, getOrderById)

// Admin-only routes
router.get('/', protect, isAdmin, getAllOrders)
router.patch('/:id/status', protect, isAdmin, updateOrderStatus)
router.patch('/:id/assign', protect, isAdmin, assignDeliveryPartner)
router.patch('/:id/verify-payment', protect, verifyPayment)
router.patch('/:orderId/items/:productId/payout', protect, isAdmin, payoutSeller)


export default router

