import { Router } from "express";
import {
  getPendingPayoutRequests,
  getWallet,
  getWalletTransactions,
  initializeWalletFunding,
  requestWalletPayout,
  reviewPayoutRequest,
  verifyWalletFunding,
} from "../controllers/walletController";
import { isAdmin, isCustomer, protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, isCustomer, getWallet);
router.get("/transactions", protect, isCustomer, getWalletTransactions);
router.post("/fund/initialize", protect, isCustomer, initializeWalletFunding);
router.post("/fund/verify", protect, isCustomer, verifyWalletFunding);
router.post("/payout", protect, isCustomer, requestWalletPayout);

router.get("/admin/payout-requests", protect, isAdmin, getPendingPayoutRequests);
router.patch(
  "/admin/payout-requests/:id",
  protect,
  isAdmin,
  reviewPayoutRequest,
);

export default router;
