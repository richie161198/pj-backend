const asyncHandler = require("express-async-handler");
const Review = require("../../models/review_model");
const Product = require("../../models/product_model");

const listProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, q, category, minPrice, maxPrice } = req.query;
  const filter = { active: true };
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.categories = category;
  if (minPrice || maxPrice) filter.price = {};
  if (minPrice) filter.price.$gte = Number(minPrice);
  if (maxPrice) filter.price.$lte = Number(maxPrice);
  const products = await Product.find(filter).skip((page-1)*limit).limit(Number(limit));
  res.json({ status: true, page, details: products });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ status: false, message: "Product not found" });
  res.json({ status: true, details: product });
});

const createProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  const payload = req.body;
  const p = new Product(payload);
  await p.save();
  res.status(201).json({ status: true, details: p });
});

const updateProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ status: true, details: p });
});

const deleteProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  await Product.findByIdAndDelete(req.params.id);
  res.json({ status: true, message: "Deleted" });
});

const addReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, rating, title, body } = req.body;
  const review = new Review({ userId, productId, rating, title, body });
  await review.save();

  const reviews = await Review.find({ productId });
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  await Product.findByIdAndUpdate(productId, { rating: avg });

  res.status(201).json({ status: true, details: review });
});

const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const reviews = await Review.find({ productId }).populate("userId", "name");
  res.json({ status: true, details: reviews });
});


module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct ,addReview, getProductReviews };
