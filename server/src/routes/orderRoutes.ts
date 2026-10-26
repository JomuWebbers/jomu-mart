
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

import { protect, isAdmin, isCustomer } from '../middleware/authMiddleware'
import { verifyPayment } from '../controllers/paymentController'
import { payoutSeller } from '../controllers/orderController'


const router = Router()

// Logged-in user routes
router.post('/', protect, isCustomer, createOrder)
router.get('/my-orders', protect, isCustomer, getMyOrders)
router.get('/pending-ratings', protect, isCustomer, getPendingRatings)
router.get('/:id', protect, isCustomer, getOrderById)

// Admin-only routes
router.get('/', protect, isAdmin, getAllOrders)
router.patch('/:id/status', protect, isAdmin, updateOrderStatus)
router.patch('/:id/assign', protect, isAdmin, assignDeliveryPartner)
router.patch('/:id/verify-payment', protect, isCustomer, verifyPayment)
router.patch('/:orderId/items/:productId/payout', protect, isAdmin, payoutSeller)


export default router
