const express = require('express');
const multer = require('multer');
const path = require('path');
const { addProduct, updateProduct, deleteProduct, getAllProducts, bulkAddProducts } = require('../controller/productController');

const router = express.Router();

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Routes
router.post('/addProduct', addProduct);
router.put('/updateProduct/:id', updateProduct);
router.delete('/deleteProduct/:id', deleteProduct);
router.get('/getAllProducts', getAllProducts);
router.post('/bulk-add', upload.single('file'), bulkAddProducts);

module.exports = router;
