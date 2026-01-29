const expressAsyncHandler = require("express-async-handler");
const Review = require("../models/review_model");
const Product = require("../models/product_model");
const User = require("../models/userModel");

/**
 * Helper function to recalculate product rating based on approved reviews only
 */
const recalculateProductRating = async (productId) => {
  const approvedReviews = await Review.find({ productId, status: "approved" });
  
  if (approvedReviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      "rating.value": 0,
      "rating.count": 0,
    });
    return { value: 0, count: 0 };
  }
  
  const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = totalRating / approvedReviews.length;
  const reviewCount = approvedReviews.length;
  
  const rating = {
    value: Math.round(averageRating * 10) / 10,
    count: reviewCount,
  };
  
  await Product.findByIdAndUpdate(productId, { rating });
  return rating;
};

/**
 * Add a review for a product
 */
const addReview = expressAsyncHandler(async (req, res) => {
  console.log("Add review request body:", req.body);
  try {
    const { productId, rating, title, body } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!productId || !rating || !body) {
      return res.status(400).json({
        status: false,
        message: "Product ID, rating, and review body are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      return res.status(400).json({
        status: false,
        message: "You have already reviewed this product",
      });
    }

    // Create review with pending status
    const review = new Review({
      userId,
      productId,
      userName: user.name,
      userEmail: user.email,
      rating: parseInt(rating),
      title: title || "",
      body,
      status: "pending", // New reviews require admin approval
    });

    await review.save();

    // Note: Product rating is NOT updated here - only when review is approved
    // Populate user details for response
    await review.populate("userId", "name email profilePhoto");

    res.status(201).json({
      status: true,
      message: "Review submitted successfully! It will be visible once approved by admin.",
      review,
      pendingApproval: true,
    });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({
      status: false,
      message: "Error adding review",
      error: error.message,
    });
  }
});

/**
 * Get all approved reviews for a product (for app/public)
 */
const getProductReviews = expressAsyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sortObj = { createdAt: -1 }; // Default: newest first
    if (sort === "oldest") {
      sortObj = { createdAt: 1 };
    } else if (sort === "highest") {
      sortObj = { rating: -1 };
    } else if (sort === "lowest") {
      sortObj = { rating: 1 };
    }

    // Only return approved reviews for public/app
    const reviews = await Review.find({ productId, status: "approved" })
      .populate("userId", "name email profilePhoto")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ productId, status: "approved" });

    res.status(200).json({
      status: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReviews: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching reviews",
      error: error.message,
    });
  }
});

/**
 * Get all reviews (Admin) with status filter
 */
const getAllReviews = expressAsyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, userId, rating, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {};
    if (productId) filter.productId = productId;
    if (userId) filter.userId = userId;
    if (rating) filter.rating = parseInt(rating);
    if (status) filter.status = status;

    const reviews = await Review.find(filter)
      .populate("userId", "name email profilePhoto phone")
      .populate("productId", "name images skuId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);
    
    // Get counts by status
    const pendingCount = await Review.countDocuments({ ...filter, status: "pending" });
    const approvedCount = await Review.countDocuments({ ...filter, status: "approved" });
    const rejectedCount = await Review.countDocuments({ ...filter, status: "rejected" });

    res.status(200).json({
      status: true,
      reviews,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReviews: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching reviews",
      error: error.message,
    });
  }
});

/**
 * Approve a review (Admin only)
 */
const approveReview = expressAsyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        status: false,
        message: "Review not found",
      });
    }

    if (review.status === "approved") {
      return res.status(400).json({
        status: false,
        message: "Review is already approved",
      });
    }

    // Update review status
    review.status = "approved";
    review.reviewedBy = adminId;
    review.reviewedAt = new Date();
    await review.save();

    // Recalculate product rating with the newly approved review
    const updatedRating = await recalculateProductRating(review.productId);

    await review.populate("userId", "name email profilePhoto");
    await review.populate("productId", "name images");

    res.status(200).json({
      status: true,
      message: "Review approved successfully",
      review,
      updatedProductRating: updatedRating,
    });
  } catch (error) {
    console.error("Approve review error:", error);
    res.status(500).json({
      status: false,
      message: "Error approving review",
      error: error.message,
    });
  }
});

/**
 * Reject a review (Admin only)
 */
const rejectReview = expressAsyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        status: false,
        message: "Review not found",
      });
    }

    if (review.status === "rejected") {
      return res.status(400).json({
        status: false,
        message: "Review is already rejected",
      });
    }

    const wasApproved = review.status === "approved";

    // Update review status
    review.status = "rejected";
    review.rejectionReason = reason || "";
    review.reviewedBy = adminId;
    review.reviewedAt = new Date();
    await review.save();

    // If was previously approved, recalculate product rating
    if (wasApproved) {
      await recalculateProductRating(review.productId);
    }

    await review.populate("userId", "name email profilePhoto");
    await review.populate("productId", "name images");

    res.status(200).json({
      status: true,
      message: "Review rejected successfully",
      review,
    });
  } catch (error) {
    console.error("Reject review error:", error);
    res.status(500).json({
      status: false,
      message: "Error rejecting review",
      error: error.message,
    });
  }
});

/**
 * Delete a review (Admin or own review)
 */
const deleteReview = expressAsyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        status: false,
        message: "Review not found",
      });
    }

    // Check if user is admin or review owner
    if (userRole !== "admin" && review.userId.toString() !== userId) {
      return res.status(403).json({
        status: false,
        message: "Unauthorized: You can only delete your own reviews",
      });
    }

    const productId = review.productId;
    const wasApproved = review.status === "approved";

    // Delete review
    await Review.findByIdAndDelete(reviewId);

    // Only recalculate product rating if the deleted review was approved
    if (wasApproved) {
      await recalculateProductRating(productId);
    }

    res.status(200).json({
      status: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      status: false,
      message: "Error deleting review",
      error: error.message,
    });
  }
});

/**
 * Update a review (User can update their own review - resets to pending status)
 */
const updateReview = expressAsyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, body } = req.body;
    const userId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        status: false,
        message: "Review not found",
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        status: false,
        message: "Unauthorized: You can only update your own reviews",
      });
    }

    const wasApproved = review.status === "approved";

    // Update review
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          status: false,
          message: "Rating must be between 1 and 5",
        });
      }
      review.rating = parseInt(rating);
    }
    if (title !== undefined) review.title = title;
    if (body !== undefined) review.body = body;
    
    // Reset status to pending for re-approval
    review.status = "pending";
    review.reviewedBy = null;
    review.reviewedAt = null;
    review.rejectionReason = null;
    review.updatedAt = new Date();

    await review.save();

    // If was previously approved, recalculate product rating (remove this review from calculation)
    if (wasApproved) {
      await recalculateProductRating(review.productId);
    }

    await review.populate("userId", "name email profilePhoto");

    res.status(200).json({
      status: true,
      message: "Review updated successfully. It will be visible once approved by admin.",
      review,
      pendingApproval: true,
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      status: false,
      message: "Error updating review",
      error: error.message,
    });
  }
});

module.exports = {
  addReview,
  getProductReviews,
  getAllReviews,
  deleteReview,
  updateReview,
  approveReview,
  rejectReview,
};

