const asyncHandler = require("express-async-handler");
const Cart = require("../../models/cart_model");
const Product = require("../../models/product_model");
const Wishlist = require("../../models/wishlist");
const Coupon = require("../../models/coupon");

const getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cart = await Cart.findOne({ userId }).populate("items.productId");
  res.json({ status: true, details: cart || { items: [] } });
});

const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, qty = 1, attributes } = req.body;
  if (!productId) return res.status(400).json({ status: false, message: "productId required" });
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ status: false, message: "Product not found" });
  if (product.stock - product.reserved < qty) return res.status(400).json({ status: false, message: "Insufficient stock" });

  let cart = await Cart.findOne({ userId });
  if (!cart) cart = new Cart({ userId, items: [] });

  const idx = cart.items.findIndex(i => i.productId.toString() === productId.toString() && JSON.stringify(i.attributes||{}) === JSON.stringify(attributes||{}));
  if (idx > -1) {
    cart.items[idx].qty = Math.max(1, cart.items[idx].qty + qty);
    cart.items[idx].priceAtAdded = product.price;
  } else {
    cart.items.push({ productId, qty, priceAtAdded: product.price, attributes });
  }
  cart.updatedAt = new Date();
  await cart.save();
  res.json({ status: true, message: "Item added", details: cart });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, qty, attributes } = req.body;
  let cart = await Cart.findOne({ userId });
  if (!cart) return res.status(404).json({ status: false, message: "Cart not found" });

  cart.items = cart.items.filter(i => !(i.productId.toString() === productId.toString() && JSON.stringify(i.attributes||{}) === JSON.stringify(attributes||{})));
  if (qty && qty > 0) {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ status: false, message: "Product not found" });
    cart.items.push({ productId, qty, priceAtAdded: product.price, attributes });
  }
  cart.updatedAt = new Date();
  await cart.save();
  res.json({ status: true, message: "Cart updated", details: cart });
});

const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await Cart.findOneAndUpdate({ userId }, { items: [] }, { upsert: true });
  res.json({ status: true, message: "Cart cleared" });
});


const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const w = await Wishlist.findOne({ userId }).populate("productIds");
  res.json({ status: true, details: w || { productIds: [] } });
});

const toggleWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ status: false, message: "productId required" });
  let w = await Wishlist.findOne({ userId });
  if (!w) w = new Wishlist({ userId, productIds: [] });
  const exists = w.productIds.map(id => id.toString()).includes(productId);
  if (exists) w.productIds = w.productIds.filter(id => id.toString() !== productId);
  else w.productIds.push(productId);
  w.updatedAt = new Date();
  await w.save();
  res.json({ status: true, message: exists ? "Removed" : "Added", details: w });
});



const createCoupon = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  const c = new Coupon(req.body);
  await c.save();
  res.status(201).json({ status: true, details: c });
});

const validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartValue } = req.body;
  const coupon = await Coupon.findOne({ code, active: true });
  if (!coupon) return res.json({ status: false, valid: false, message: "Invalid coupon" });
  const now = new Date();
  if ((coupon.validFrom && coupon.validFrom > now) || (coupon.validTo && coupon.validTo < now)) {
    return res.json({ status: false, valid: false, message: "Coupon expired or not yet valid" });
  }
  if (coupon.minCartValue && cartValue < coupon.minCartValue) {
    return res.json({ status: false, valid: false, message: "Cart value too small" });
  }
  res.json({ status: true, valid: true, details: coupon });
});




module.exports = { getCart, addToCart, updateCartItem, clearCart, getWishlist, toggleWishlist ,createCoupon, validateCoupon  };
