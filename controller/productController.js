
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
const { getCurrentPrices, calculateProductPrice } = require('../services/priceCalculationService');

const addProduct = expressAsyncHandler(async (req, res) => {
  try {
    console.log('\n========== ADD PRODUCT ==========');
    console.log('Product name:', req.body.name);
    console.log('productDetails from request:', JSON.stringify(req.body.productDetails, null, 2));
    console.log('priceDetails from request:', JSON.stringify(req.body.priceDetails, null, 2));
    
    const product = new Product(req.body);
    
    console.log('productDetails after Product model creation:', JSON.stringify(product.productDetails, null, 2));
    console.log('priceDetails after Product model creation:', JSON.stringify(product.priceDetails, null, 2));
    
    // ✅ NEW LOGIC: Smart price calculation
    // If admin provided manual priceDetails with gold/silver, keep them
    // Otherwise, calculate from productDetails
    const hasManualGoldSilver = req.body.priceDetails?.some(item => 
      item.name?.toLowerCase().includes('gold') || item.name?.toLowerCase().includes('silver')
    );

    if (hasManualGoldSilver) {
      console.log('✅ Manual gold/silver values detected in priceDetails - keeping them as-is');
      // Admin manually entered gold/silver in price details, keep them
      // Just calculate the totals
      try {
        const priceDetails = product.priceDetails || [];
        let total = 0;
        
        priceDetails.forEach(item => {
          if (!item.name?.toLowerCase().includes('total') && 
              !item.name?.toLowerCase().includes('grand')) {
            total += parseFloat(item.value) || 0;
          }
        });
        
        // Update or add Grand Total
        const grandTotalIndex = priceDetails.findIndex(item => 
          item.name?.toLowerCase().includes('grand total')
        );
        
        if (grandTotalIndex >= 0) {
          priceDetails[grandTotalIndex].value = total;
        } else {
          priceDetails.push({
            name: 'Grand Total',
            weight: 'Final Price',
            value: total
          });
        }
        
        product.priceDetails = priceDetails;
        product.sellingprice = total;
        
        console.log('Manual price details kept with calculated total:', total);
      } catch (e) {
        console.log('Error calculating manual totals:', e.message);
      }
    } else {
      console.log('🔄 No manual gold/silver - calculating from productDetails');
      // No manual gold/silver values, calculate from productDetails
      try {
        const { goldPrice, silverPrice } = await getCurrentPrices();
        console.log(`Live rates: Gold=₹${goldPrice}, Silver=₹${silverPrice}`);
        
        const makingPctFromBody = Number(req.body?.makingChargesPercentage);
        const calc = calculateProductPrice(product, goldPrice, silverPrice, isNaN(makingPctFromBody) ? undefined : makingPctFromBody);
        
        console.log('Calculation result:');
        console.log('  - Gold Value:', calc.goldValue);
        console.log('  - Silver Value:', calc.silverValue);
        console.log('  - Final Price:', calc.finalPrice);
        console.log('  - Updated Price Details:', JSON.stringify(calc.updatedPriceDetails, null, 2));
        
        product.priceDetails = calc.updatedPriceDetails;
        product.sellingprice = calc.finalPrice;
        
        console.log('priceDetails assigned to product:', JSON.stringify(product.priceDetails, null, 2));
      } catch (e) {
        // Continue without blocking product creation
        console.log('❌ Price calc skipped on addProduct:', e?.message);
        console.error(e.stack);
      }
    }
    
    await product.save();
    console.log('Product saved. Final priceDetails:', JSON.stringify(product.priceDetails, null, 2));
    console.log('========================================\n');

    res.status(201).json({
      status: true,
      message: "✅ Product added successfully",
      product,
    });
  } catch (error) {
    console.error('❌ Error in addProduct:', error);
    res.status(500).json({ status: false, message: error.message });
  }
});

/**
 * Update product
 */
const updateProduct = expressAsyncHandler(async (req, res) => {
  try {
    console.log('\n========== UPDATE PRODUCT ==========');
    console.log('Product ID:', req.params.id);
    console.log('Product name:', req.body.name);
    console.log('productDetails from request:', JSON.stringify(req.body.productDetails, null, 2));
    console.log('priceDetails from request:', JSON.stringify(req.body.priceDetails, null, 2));
    
    let updatedProduct = await Product.findByIdAndUpdate(
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

    console.log('productDetails after findByIdAndUpdate:', JSON.stringify(updatedProduct.productDetails, null, 2));
    console.log('priceDetails after findByIdAndUpdate:', JSON.stringify(updatedProduct.priceDetails, null, 2));

    // ✅ NEW LOGIC: Smart price calculation
    // If admin provided manual priceDetails with gold/silver, keep them
    // Otherwise, recalculate from productDetails
    const hasManualGoldSilver = req.body.priceDetails?.some(item => 
      item.name?.toLowerCase().includes('gold') || item.name?.toLowerCase().includes('silver')
    );

    if (hasManualGoldSilver) {
      console.log('✅ Manual gold/silver values detected in priceDetails - keeping them as-is');
      // Admin manually entered gold/silver in price details, keep them
      // Just calculate the totals
      try {
        const priceDetails = updatedProduct.priceDetails || [];
        let total = 0;
        
        priceDetails.forEach(item => {
          if (!item.name?.toLowerCase().includes('total') && 
              !item.name?.toLowerCase().includes('grand')) {
            total += parseFloat(item.value) || 0;
          }
        });
        
        // Update or add Grand Total
        const grandTotalIndex = priceDetails.findIndex(item => 
          item.name?.toLowerCase().includes('grand total')
        );
        
        if (grandTotalIndex >= 0) {
          priceDetails[grandTotalIndex].value = total;
        } else {
          priceDetails.push({
            name: 'Grand Total',
            weight: 'Final Price',
            value: total
          });
        }
        
        updatedProduct.priceDetails = priceDetails;
        updatedProduct.sellingprice = total;
        await updatedProduct.save();
        
        console.log('Manual price details saved with calculated total:', total);
      } catch (e) {
        console.log('Error calculating manual totals:', e.message);
      }
    } else {
      console.log('🔄 No manual gold/silver - recalculating from productDetails');
      // No manual gold/silver values, calculate from productDetails
      try {
        const { goldPrice, silverPrice } = await getCurrentPrices();
        console.log(`Live rates: Gold=₹${goldPrice}, Silver=₹${silverPrice}`);
        
        const makingPctFromBody = Number(req.body?.makingChargesPercentage);
        const calc = calculateProductPrice(updatedProduct, goldPrice, silverPrice, isNaN(makingPctFromBody) ? undefined : makingPctFromBody);
        
        console.log('Calculation result:');
        console.log('  - Gold Value:', calc.goldValue);
        console.log('  - Silver Value:', calc.silverValue);
        console.log('  - Final Price:', calc.finalPrice);
        console.log('  - Updated Price Details:', JSON.stringify(calc.updatedPriceDetails, null, 2));
        
        updatedProduct.priceDetails = calc.updatedPriceDetails;
        updatedProduct.sellingprice = calc.finalPrice;
        await updatedProduct.save();
        
        console.log('Product saved. Final priceDetails:', JSON.stringify(updatedProduct.priceDetails, null, 2));
      } catch (e) {
        console.log('❌ Price calc skipped on updateProduct:', e?.message);
        console.error(e.stack);
      }
    }
    
    console.log('========================================\n');

    res.status(200).json({
      status: true,
      message: "✅ Product updated successfully",
      updatedProduct,
    });
  } catch (error) {
    console.error('❌ Error in updateProduct:', error);
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

const decrementCartItem = expressAsyncHandler(async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      return res.status(404).json({ status: false, message: "❌ Cart not found" });
    }

    // Find the item in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({ status: false, message: "❌ Item not found in cart" });
    }

    const item = cart.items[itemIndex];
    const wasRemoved = item.qty === 1;
    
    // Decrement quantity by 1
    if (item.qty > 1) {
      item.qty -= 1;
    } else {
      // If quantity is 1, remove the item from cart
      cart.items.splice(itemIndex, 1);
    }

    // Recalculate total
    cart.total = cart.items.reduce(
      (acc, item) => acc + Number(item.qty) * Number(item.priceAtAdded || 0),
      0
    );

    // If cart is empty, reset total
    if (cart.items.length === 0) {
      cart.total = 0;
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.status(200).json({ 
      status: true, 
      message: wasRemoved ? "🗑️ Item removed" : "✅ Quantity decreased", 
      cart 
    });
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
const getCategoryById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }
    res.status(200).json({ status: true, category });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

const deleteCategory = expressAsyncHandler(async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        status: false,
        message: "❌ Category not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "🗑️ Category deleted successfully",
    });
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
  bulkUploadProducts,getCategoryById,deleteCategory,decrementCartItem
};
