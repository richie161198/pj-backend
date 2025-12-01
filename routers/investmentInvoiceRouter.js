const express = require('express');
const router = express.Router();
const {
  createInvestmentInvoice,
  getInvoiceById,
  getInvoiceByOrderId,
  getUserInvoices,
  getAllInvoices,
  downloadInvoicePDF,
  downloadInvoiceByOrderId,
} = require('../controller/investmentInvoiceController');
// const { isAuth } = require('../middleware/userAuth');
const { validateToken, isAuth } = require("../middleware/tokenValidation");
const { adminAuth } = require('../middleware/adminAuth');

// Create invoice (system/admin)
router.post('/create', createInvestmentInvoice);

// Get all invoices (Admin only)
router.get('/all', adminAuth, getAllInvoices);

// Get invoice by ID
router.get('/:id', isAuth, getInvoiceById);

// Get invoice by order ID
router.get('/order/:orderId', isAuth, getInvoiceByOrderId);

// Get user invoices
router.get('/user/:userId', isAuth, getUserInvoices);

// Download invoice PDF by ID
router.get('/download/:id', isAuth, downloadInvoicePDF);

// Download invoice PDF by order ID
router.get('/download-by-order/:orderId', isAuth, downloadInvoiceByOrderId);

module.exports = router;

