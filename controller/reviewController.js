const expressAsyncHandler = require("express-async-handler");
const Review = require("../models/review_model");
const Product = require("../models/product_model");
const User = require("../models/userModel");

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

    // Create review
    const review = new Review({
      userId,
      productId,
      userName: user.name,
      userEmail: user.email,
      rating: parseInt(rating),
      title: title || "",
      body,
    });

    await review.save();

    // Update product rating
    const allReviews = await Review.find({ productId });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;
    const reviewCount = allReviews.length;

    product.rating = {
      value: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      count: reviewCount,
    };

    await product.save();

    // Populate user details for response
    await review.populate("userId", "name email profilePhoto");

    res.status(201).json({
      status: true,
      message: "Review added successfully",
      review,
      updatedProductRating: product.rating,
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
 * Get all reviews for a product
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

    const reviews = await Review.find({ productId })
      .populate("userId", "name email profilePhoto")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ productId });

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
 * Get all reviews (Admin)
 */
const getAllReviews = expressAsyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, userId, rating } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {};
    if (productId) filter.productId = productId;
    if (userId) filter.userId = userId;
    if (rating) filter.rating = parseInt(rating);

    const reviews = await Review.find(filter)
      .populate("userId", "name email profilePhoto")
      .populate("productId", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);

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
    console.error("Get all reviews error:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching reviews",
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

    // Delete review
    await Review.findByIdAndDelete(reviewId);

    // Update product rating
    const allReviews = await Review.find({ productId });
    
    if (allReviews.length === 0) {
      // No reviews left, reset rating
      await Product.findByIdAndUpdate(productId, {
        "rating.value": 0,
        "rating.count": 0,
      });
    } else {
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / allReviews.length;
      const reviewCount = allReviews.length;

      await Product.findByIdAndUpdate(productId, {
        "rating.value": Math.round(averageRating * 10) / 10,
        "rating.count": reviewCount,
      });
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
 * Update a review (User can update their own review)
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
    review.updatedAt = new Date();

    await review.save();

    // Update product rating
    const allReviews = await Review.find({ productId: review.productId });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;

    await Product.findByIdAndUpdate(review.productId, {
      "rating.value": Math.round(averageRating * 10) / 10,
    });

    await review.populate("userId", "name email profilePhoto");

    res.status(200).json({
      status: true,
      message: "Review updated successfully",
      review,
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
};

