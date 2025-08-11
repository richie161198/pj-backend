const Product = require("../models/product_model");
const xlsx = require("xlsx");

// Add single product
const addProduct = async (req, res) => {
  console.log(req.body);
  const { name, description, price, category, stock, imageUrl } = req.body;

  try {
    // const product = Product.create({
    //   name,
    //   description,
    //   price,
    //   category,
    //   stock,
    //   imageUrl,
    // });
    const product = new Product(req.body); 
    await product.save();
    res
      .status(201)
      .json({ status: true, message: "Product added successfully", product });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedProduct)
      return res
        .status(404)
        .json({ status: false, message: "Product not found" });
    res.status(200).json({
      status: true,
      message: "Product updated successfully",
      updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  console.log("req.params.id", req.params.id);
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ status: false, message: "Product not found" });
    res
      .status(200)
      .json({ status: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json({ status: true, products });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// Bulk add products from Excel
const bulkAddProducts = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    await Product.insertMany(sheetData);

    res.status(201).json({
      status: true,
      message: "Bulk products added successfully",
      count: sheetData.length,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = {
  bulkAddProducts,
  getAllProducts,
  deleteProduct,
  updateProduct,
  addProduct,
};
