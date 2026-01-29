const express = require("express");
const router = express.Router();
const { isAuth, isAdmin } = require("../middleware/tokenValidation");
const {
  addReview,
  getProductReviews,
  getAllReviews,
  deleteReview,
  updateReview,
  approveReview,
  rejectReview,
} = require("../controller/reviewController");

// User routes
router.post("/", isAuth, addReview);
router.get("/product/:productId", getProductReviews);
router.put("/:reviewId", isAuth, updateReview);

// Admin routes
router.get("/admin/all", isAuth, isAdmin, getAllReviews);
router.put("/admin/:reviewId/approve", isAuth, isAdmin, approveReview);
router.put("/admin/:reviewId/reject", isAuth, isAdmin, rejectReview);
router.delete("/admin/:reviewId", isAuth, isAdmin, deleteReview);

// User can delete their own review
router.delete("/:reviewId", isAuth, deleteReview);

module.exports = router;

