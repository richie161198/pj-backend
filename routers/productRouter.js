const express = require('express');
const multer = require('multer');
const path = require('path');
const { addProduct, updateProduct,checkout, deleteProduct, getAllProducts, bulkUploadProducts,addToCart, removeFromCart, getCart, getProductById } = require('../controller/productController');

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

router.post("/addcart", addToCart);
router.post("/removecart", removeFromCart);
router.get("/cart/:userId", getCart);
router.post("/cart/checkout", checkout);

module.exports = router;
