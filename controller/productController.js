
const Product = require("../models/product_model");
const User = require("../models/userModel");
const xlsx = require("xlsx");

const Cart = require("../models/cart_model");
const Order = require("../models/orderModel");
const Category = require("../models//category_model.js");

const expressAsyncHandler = require("express-async-handler");

/**
 * Add a single product
 */
const addProduct = expressAsyncHandler(async (req, res) => {
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
});

/**
 * Update product
 */
const updateProduct = expressAsyncHandler(async (req, res) => {
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
});

/**
 * Delete product
 */
const deleteProduct = expressAsyncHandler(async (req, res) => {
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
});

/**
 * Get all products
 */
const getAllProducts = expressAsyncHandler(async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json({ status: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

/**
 * Get product by ID
 */
const getProductById = expressAsyncHandler(async (req, res) => {
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
});

/**
 * Bulk upload products from Excel
 */
const bulkUploadProducts = expressAsyncHandler(async (req, res) => {
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
});

const addToCart = expressAsyncHandler(async (req, res) => {
  try {
    const { productId, qty = 1 } = req.body;
    let userId = req.user.id;
    console.log("user id $, ", req.user.id)
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
        items: [{ productId, productDataid: productId, qty: quantity, priceAtAdded: price }],
        total: price * quantity,
      });
      await cart.save();
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
        cart.items.push({ productId, productDataid: productId, qty: quantity, priceAtAdded: price });


        await cart.save();
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
});



const removeFromCart = expressAsyncHandler(async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;
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
});



const getCart = expressAsyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("userId", userId, req.user.id);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(404).json({ status: false, message: "❌ Cart not found" });
    }

    res.status(200).json({ status: true, cart });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

const clearCart = expressAsyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;

    await Cart.findOneAndDelete({ userId });

    res.status(200).json({ status: true, message: "🛒 Cart cleared" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

const checkout = expressAsyncHandler(async (req, res) => {
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
});



// Create Category
const createCategory = expressAsyncHandler(async (req, res) => {
  try {
    const { name, description, image, newTag} = req.body;

    const category = new Category({ name, description, image, newTag });
    await category.save();

    res.status(201).json({ status: true, category });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Get All Categories
const getAllCategories = expressAsyncHandler(async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).json({ status: true, count: categories.length, categories });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Get Category by ID + Products
const getCategoryWithProducts = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ categoryId: id });
    res.status(200).json({ status: true, category, products });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});




module.exports = {
  addProduct, addToCart, removeFromCart, getCart, clearCart, checkout, createCategory, getAllCategories, getCategoryWithProducts,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  bulkUploadProducts,
};
