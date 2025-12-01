const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/tokenValidation');
const {
  createInvoiceFromOrder,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  markInvoiceAsPaid,
  deleteInvoice,
  getInvoiceStats,
  downloadInvoice,
  downloadInvoiceByOrderCode,
  updateInvoiceProductData,
  createTestInvoice,
  debugProductData
} = require('../controller/invoiceController');

// @desc    Create invoice from order
// @route   POST /api/v0/invoices/create-from-order
// @access  Private (Admin)
router.post('/create-from-order',  createInvoiceFromOrder);
// router.post('/create-from-order', isAdmin, createInvoiceFromOrder);

// @desc    Create test invoice with complete product data
// @route   POST /api/v0/invoices/create-test
// @access  Private (Admin)
router.post('/create-test',  createTestInvoice);

// @desc    Debug product data extraction
// @route   GET /api/v0/invoices/debug-product-data
// @access  Private (Admin)
router.get('/debug-product-data',  debugProductData);

// @desc    Get all invoices
// @route   GET /api/v0/invoices
// @access  Private (Admin)
router.get('/',  getAllInvoices);

// @desc    Get invoice statistics
// @route   GET /api/v0/invoices/stats
// @access  Private (Admin)
router.get('/stats',  getInvoiceStats);

// @desc    Update invoice product data
// @route   PUT /api/v0/invoices/:id/update-product-data
// @access  Private (Admin)
router.put('/:id/update-product-data',  updateInvoiceProductData);

// @desc    Download invoice as PDF by order code
// @route   GET /api/v0/invoices/order/:orderCode/download
// @access  Private
router.get('/order/:orderCode/download',  downloadInvoiceByOrderCode);

// @desc    Download invoice as PDF
// @route   GET /api/v0/invoices/:id/download
// @access  Private (Admin)
router.get('/:id/download',  downloadInvoice);

// @desc    Get invoice by ID
// @route   GET /api/v0/invoices/:id
// @access  Private (Admin)
router.get('/:id',  getInvoiceById);

// @desc    Update invoice
// @route   PUT /api/v0/invoices/:id
// @access  Private (Admin)
router.put('/:id',  updateInvoice);

// @desc    Mark invoice as paid
// @route   PUT /api/v0/invoices/:id/mark-paid
// @access  Private (Admin)
router.put('/:id/mark-paid',  markInvoiceAsPaid);

// @desc    Delete invoice
// @route   DELETE /api/v0/invoices/:id
// @access  Private (Admin)
router.delete('/:id',  deleteInvoice);

module.exports = router;
