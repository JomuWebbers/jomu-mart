import { Router } from 'express'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyListings,
  reviewListing,
  getPendingListings,
} from "../controllers/productController";

import {
  initializeListingFee,
  verifyListingFee,
} from "../controllers/listingFeeController";
import {
  getProductReviews,
  submitProductReview,
} from "../controllers/productReviewController";

import { protect, isAdmin, optionalAuth } from '../middleware/authMiddleware'

const router = Router()

// Public
router.get("/", getProducts);

// Specific paths must come before /:id
router.get("/pending", protect, isAdmin, getPendingListings);
router.get("/my-listings", protect, getMyListings);
router.post("/listing-fee/verify", protect, verifyListingFee);
router.get("/:id/reviews", optionalAuth, getProductReviews);
router.post("/:id/reviews", protect, submitProductReview);
router.post("/:id/listing-fee/initialize", protect, initializeListingFee);


// Generic product path goes after specific paths
router.get("/:id", optionalAuth, getProductById);

// Any logged-in user
router.post("/", protect, createProduct);

// Admin-only
router.patch("/:id", protect, isAdmin, updateProduct);
router.delete("/:id", protect, isAdmin, deleteProduct);
router.patch("/:id/review", protect, isAdmin, reviewListing);

export default router




