
const Product = require("../models/product_model");
const User = require("../models/userModel");
const xlsx = require("xlsx");

const Cart = require("../models/cart_model");
const Order = require("../models/orderModel");

/**
 * Add a single product
 */
const addProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    res.status(201).json({
      status: true,
      message: "✅ Product added successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update product
 */
const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        status: false,
        message: "❌ Product not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "✅ Product updated successfully",
      updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete product
 */
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        status: false,
        message: "❌ Product not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "🗑️ Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get all products
 */
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json({ status: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get product by ID
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "❌ Product not found",
      });
    }

    res.status(200).json({ status: true, product });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk upload products from Excel
 */
const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: false, message: "No file uploaded" });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (data.length === 0) {
      return res.status(400).json({ status: false, message: "Uploaded file is empty" });
    }

    const inserted = await Product.insertMany(data);

    res.status(201).json({
      status: true,
      message: "✅ Products uploaded successfully",
      insertedCount: inserted.length,
      inserted,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

const addToCart = async (req, res) => {
  try {
    const { userId, productId, qty = 1 } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "❌ User not found" });
    }
    // find cart
    let cart = await Cart.findOne({ userId });
    console.log("cart", cart);
    // fetch product price for priceAtAdded
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: "❌ Product not found" });
    }
    console.log("product", product);
    // always cast to number
    const price = Number(product.sellingprice);
    const quantity = Number(qty) || 1;

    if (!cart) {
      // create new cart
      cart = new Cart({
        userId,
        items: [{ productId, qty: quantity, priceAtAdded: price }],
        total: price * quantity,
      });
    } else {
      // check if product already exists in cart
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId.toString()
      );

      if (itemIndex > -1) {
        // increment qty
        cart.items[itemIndex].qty += quantity;
      } else {
        // add new item
        cart.items.push({ productId, qty: quantity, priceAtAdded: price });
      }

      // recalc total safely
      cart.total = cart.items.reduce(
        (acc, item) => acc + Number(item.qty) * Number(item.priceAtAdded || 0),
        0
      );
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.status(200).json({ status: true, message: "✅ Added to cart", cart });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};



const removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ status: false, message: "❌ Cart not found" });
    }

    // filter out the product
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );

    // recalc total
    cart.total = cart.items.reduce(
      (acc, item) => acc + Number(item.qty) * Number(item.priceAtAdded || 0),
      0
    );

    // if cart empty → optional: reset total
    if (cart.items.length === 0) {
      cart.total = 0;
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.status(200).json({ status: true, message: "🗑️ Item removed", cart });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};



const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(404).json({ status: false, message: "❌ Cart not found" });
    }

    res.status(200).json({ status: true, cart });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;

    await Cart.findOneAndDelete({ userId });

    res.status(200).json({ status: true, message: "🛒 Cart cleared" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

const checkout = async (req, res) => {
  try {
    const { userId, addressId, paymentMethod } = req.body;

    // fetch cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ status: false, message: "❌ Cart is empty" });
    }

    // subtotal = sum of items
    const subtotal = cart.items.reduce(
      (acc, item) => acc + item.qty * item.priceAtAdded,
      0
    );

    // delivery fee (example: free if subtotal > 5000)
    const deliveryFee = subtotal > 5000 ? 0 : 100;

    // GST (example: 5%)
    const gst = subtotal * 0.05;

    // final total
    const total = subtotal + deliveryFee + gst;

    // create order
    const order = new Order({
      userId,
      items: cart.items,
      address: addressId, // assuming you have an Address model
      paymentMethod,
      subtotal,
      deliveryFee,
      gst,
      total,
      status: "Pending Payment", // default status
      createdAt: Date.now(),
    });

    await order.save();

    // OPTIONAL: clear user cart after checkout
    await Cart.findOneAndUpdate({ userId }, { items: [], total: 0 });

    res.status(200).json({
      status: true,
      message: "✅ Checkout successful, order created",
      order,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};



module.exports = {
  addProduct, addToCart, removeFromCart, getCart,clearCart,checkout,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  bulkUploadProducts,
};
