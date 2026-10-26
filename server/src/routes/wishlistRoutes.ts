import { Router } from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController";
import { protect, isCustomer } from "../middleware/authMiddleware";

const router = Router();

router.use(protect, isCustomer);
router.get("/", getWishlist);
router.post("/:productId", addToWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;
