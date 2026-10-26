
import { Router } from "express";
import {
  createReturnRequest,
  getMyReturns,
  getAllReturns,
  updateReturnStatus,
} from "../controllers/returnControllers";
import { protect, isAdmin, isCustomer } from "../middleware/authMiddleware";

const router = Router();

// Customer routes
router.post("/order/:orderId", protect, isCustomer, createReturnRequest);
router.get("/my-returns", protect, isCustomer, getMyReturns);

// Admin routes
router.get("/admin", protect, isAdmin, getAllReturns);
router.patch("/admin/:id/status", protect, isAdmin, updateReturnStatus);

export default router;

