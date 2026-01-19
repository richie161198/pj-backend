const express = require('express');
const multer = require('multer');
const path = require('path');
const { addProduct, updateProduct,checkout, deleteProduct, getAllProducts,deleteCategory,createCategory, updateCategory, getAllCategories, getCategoryWithProducts, bulkUploadProducts,addToCart, removeFromCart, decrementCartItem, getCart, getProductById, getCategoryById } = require('../controller/productController');
const { isAuth } = require('../middleware/tokenValidation');

const router = express.Router();

// // File upload setup
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, 'uploads/'),
//     filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
// });
// const upload = multer({ storage });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'), // make sure 'uploads/' folder exists
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Routes
router.post('/addProduct', addProduct);
router.put('/updateProduct/:id', updateProduct);
router.delete('/deleteProduct/:id', deleteProduct);
router.get('/singleProduct/:id', getProductById);
router.get('/getAllProducts', getAllProducts);
router.post('/bulk-add', upload.single('file'), bulkUploadProducts);
router.route("/addcart").post(isAuth,addToCart);
router.route("/cart").get(isAuth,getCart);
router.route("/removecart").post(isAuth,removeFromCart);
router.route("/decrementcart").post(isAuth,decrementCartItem);

router.route("/createCategory").post(isAuth,createCategory);
router.route("/updateCategory/:id").put(isAuth,updateCategory);
router.route("/getAllCategories").get(getAllCategories);
router.route("/getCategoryById/:id").get(getCategoryById);
router.delete('/deleteCategory/:id', deleteCategory);
router.route("/categories/:id/products").get(getCategoryWithProducts);
router.post("/cart/checkout", checkout);

module.exports = router;
