const express = require("express");
const router = express.Router();
const { isAuth, isAdmin } = require("../middleware/tokenValidation");
const {
  addReview,
  getProductReviews,
  getAllReviews,
  deleteReview,
  updateReview,
} = require("../controller/reviewController");

// User routes
router.post("/", isAuth, addReview);
router.get("/product/:productId", getProductReviews);
router.put("/:reviewId", isAuth, updateReview);

// Admin routes
router.get("/admin/all", isAuth, isAdmin, getAllReviews);
router.delete("/admin/:reviewId", isAuth, isAdmin, deleteReview);

// User can delete their own review
router.delete("/:reviewId", isAuth, deleteReview);

module.exports = router;

