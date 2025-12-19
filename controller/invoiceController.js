const asyncHandler = require('express-async-handler');
const Invoice = require('../models/invoice_model');
const Order = require('../models/commerce_order_model');
const User = require('../models/userModel');
const Product = require('../models/product_model');
const fs = require("fs");
const { generateOrderInvoicePdf, logoBase64 } = require('../services/pdfService');

// @desc    Create invoice from order
// @route   POST /api/v0/invoices/create-from-order
// @access  Private (Admin)
const createInvoiceFromOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const adminId = req.user?.id || 'admin';

  try {
    // Find the order
    const order = await Order.findById(orderId).populate('user products.product');
    if (!order) {
      return res.status(404).json({
        status: false,
        message: 'Order not found'
      });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ orderId });
    if (existingInvoice) {
      return res.status(400).json({
        status: false,
        message: 'Invoice already exists for this order'
      });
    }

    // Get customer details
    const customer = await User.findById(order.user);
    if (!customer) {
      return res.status(404).json({
        status: false,
        message: 'Customer not found'
      });
    }

    // Prepare customer details
    const customerDetails = {
      name: customer.name || 'N/A',
      email: customer.email,
      phone: customer.phone || 'N/A',
      address: customer.address && customer.address.length > 0 ? customer.address[0] : {
        street: 'N/A',
        city: 'N/A',
        state: 'N/A',
        pincode: 'N/A'
      }
    };

    // Prepare products with detailed pricing
    const products = await Promise.all(order.products.map(async (orderProduct) => {
      const product = await Product.findById(orderProduct.product);
      if (!product) {
        throw new Error(`Product not found: ${orderProduct.product}`);
      }

      // Calculate pricing details
      const unitPrice = product.sellingprice || product.priceDetails?.finalPrice || 0;
      const totalPrice = unitPrice * orderProduct.quantity;
      const makingCharges = (product.priceDetails?.makingCharges || 0) * orderProduct.quantity;
      const gst = (product.priceDetails?.gst || 0) * orderProduct.quantity;
      const discount = (product.priceDetails?.discount || 0) * orderProduct.quantity;
      const finalPrice = totalPrice + makingCharges + gst - discount;

      return {
        productId: product._id,
        name: product.name,
        sku: product.skuId || 'N/A',
        category: product.categoryId?.name || 'N/A',
        brand: product.brand || 'N/A',
        quantity: orderProduct.quantity,
        unitPrice,
        totalPrice,
        weight: product.weight || 0,
        metalType: product.metalType || 'gold',
        purity: product.purity || 'N/A',
        makingCharges,
        gst,
        discount,
        finalPrice
      };
    }));

    // Calculate totals
    const subtotal = products.reduce((sum, product) => sum + product.totalPrice, 0);
    const totalMakingCharges = products.reduce((sum, product) => sum + product.makingCharges, 0);
    const totalGST = products.reduce((sum, product) => sum + product.gst, 0);
    const totalDiscount = products.reduce((sum, product) => sum + product.discount, 0);
    const grandTotal = subtotal + totalMakingCharges + totalGST - totalDiscount;

    // Create invoice
    const invoice = new Invoice({
      orderId,
      customerId: order.user,
      customerDetails,
      products,
      pricing: {
        subtotal,
        totalMakingCharges,
        totalGST,
        totalDiscount,
        grandTotal,
        currency: 'INR'
      },
      paymentDetails: {
        method: order.paymentMethod || 'cash',
        paymentStatus: order.paymentStatus || 'pending',
        paidAmount: order.paidAmount || 0
      },
      shippingDetails: {
        method: order.shippingMethod || 'standard',
        shippingAddress: customerDetails.address
      },
      status: 'draft',
      createdBy: adminId,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    await invoice.save();

    res.status(201).json({
      status: true,
      message: 'Invoice created successfully',
      data: invoice
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error creating invoice',
      error: error.message
    });
  }
});

// @desc    Get all invoices
// @route   GET /api/v0/invoices
// @access  Private (Admin)
const getAllInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    customerId,
    startDate,
    endDate,
    search
  } = req.query;

  try {
    console.log('📋 Commerce Invoices Query Params:', { page, limit, status, customerId, startDate, endDate, search });
    
    const query = {};

    // Add filters
    if (status && status !== 'all') query.status = status;
    if (customerId) query.customerId = customerId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDateTime;
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDateTime;
      }
      console.log('📅 Date filter applied:', query.createdAt);
    }

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.email': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('🔍 Final query:', JSON.stringify(query, null, 2));

    const invoices = await Invoice.find(query)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber status')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      status: true,
      data: invoices,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
});

// @desc    Get invoice by ID
// @route   GET /api/v0/invoices/:id
// @access  Private (Admin)
const getInvoiceById = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber status')
      .populate('createdBy', 'name email')
      .populate('products.productId', 'name images');

    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      status: true,
      data: invoice
    });

  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
});

// @desc    Update invoice
// @route   PUT /api/v0/invoices/:id
// @access  Private (Admin)
const updateInvoice = asyncHandler(async (req, res) => {
  try {
    const { status, notes, termsAndConditions } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    // Update fields
    if (status) invoice.status = status;
    if (notes !== undefined) invoice.notes = notes;
    if (termsAndConditions !== undefined) invoice.termsAndConditions = termsAndConditions;

    invoice.updatedAt = new Date();
    await invoice.save();

    res.json({
      status: true,
      message: 'Invoice updated successfully',
      data: invoice
    });

  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error updating invoice',
      error: error.message
    });
  }
});

// @desc    Mark invoice as paid
// @route   PUT /api/v0/invoices/:id/mark-paid
// @access  Private (Admin)
const markInvoiceAsPaid = asyncHandler(async (req, res) => {
  try {
    const { transactionId, paidAmount } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    await invoice.markAsPaid(transactionId, paidAmount);

    res.json({
      status: true,
      message: 'Invoice marked as paid successfully',
      data: invoice
    });

  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({
      status: false,
      message: 'Error marking invoice as paid',
      error: error.message
    });
  }
});

// @desc    Delete invoice
// @route   DELETE /api/v0/invoices/:id
// @access  Private (Admin)
const deleteInvoice = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        status: false,
        message: 'Only draft invoices can be deleted'
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({
      status: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error deleting invoice',
      error: error.message
    });
  }
});

// @desc    Get invoice statistics
// @route   GET /api/v0/invoices/stats
// @access  Private (Admin)
const getInvoiceStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.grandTotal' }
        }
      }
    ]);

    const totalInvoices = await Invoice.countDocuments();
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }
    ]);

    res.json({
      status: true,
      data: {
        totalInvoices,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching invoice stats',
      error: error.message
    });
  }
});

// @desc    Download invoice as PDF
// @route   GET /api/v0/invoices/:id/download
// @access  Private (Admin)
// const downloadInvoice = asyncHandler(async (req, res) => {
//   try {
//     const invoice = await Invoice.findById(req.params.id)
//       .populate('customerId', 'name email phone')
//       .populate('orderId', 'orderNumber status')
//       .populate('createdBy', 'name email');

//     if (!invoice) {
//       return res.status(404).json({
//         status: false,
//         message: 'Invoice not found'
//       });
//     }

//     // Fetch complete product details for each product in the invoice
//     const Product = require('../models/product_model');
//     const InvestmentSettings = require('../models/investment_settings_model');
    
//     // Get current investment settings for gold rates
//     const investmentSettings = await InvestmentSettings.findOne().sort({ createdAt: -1 });
    
//     // Enhance products with complete details
//     const enhancedProducts = await Promise.all(invoice.products.map(async (product) => {
//       const fullProduct = await Product.findById(product.productId);
//       if (fullProduct) {
//         // Extract detailed information
//         const productDetails = fullProduct.productDetails || [];
//         const priceDetails = fullProduct.priceDetails || [];
        
//         // Extract weight and purity from product details
//         let weight = product.weight || 0;
//         let purity = product.purity || '22Karat';
//         let metalType = product.metalType || 'gold';
        
//         productDetails.forEach(detail => {
//           if (detail.type === 'Metal') {
//             if (detail.attributes && detail.attributes['Gross Weight']) {
//               weight = parseFloat(detail.attributes['Gross Weight']) || weight;
//             }
//             if (detail.attributes && detail.attributes.Karatage) {
//               purity = detail.attributes.Karatage;
//             }
//             if (detail.attributes && detail.attributes.Material) {
//               metalType = detail.attributes.Material.toLowerCase();
//             }
//           }
//         });

//         return {
//           ...product,
//           weight: weight,
//           purity: purity,
//           metalType: metalType,
//           productDetails: productDetails,
//           priceDetails: priceDetails,
//           description: fullProduct.description || '',
//           images: fullProduct.images || []
//         };
//       }
//       return product;
//     }));

//     // Create enhanced invoice with complete product details
//     const enhancedInvoice = {
//       ...invoice.toObject(),
//       products: enhancedProducts,
//       investmentSettings: investmentSettings
//     };

//     // Generate HTML for the invoice
//     const html = generateInvoiceHTML(enhancedInvoice);

//     // Generate PDF using Puppeteer
//     const browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     });

//     const page = await browser.newPage();
//     await page.setContent(html, { waitUntil: 'networkidle0' });
    
//     const pdf = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       margin: {
//         top: '20mm',
//         right: '20mm',
//         bottom: '20mm',
//         left: '20mm'
//       }
//     });

//     await browser.close();

//     // Set response headers for PDF download
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
//     res.setHeader('Content-Length', pdf.length);

//     res.send(pdf);

//   } catch (error) {
//     console.error('Error generating invoice PDF:', error);
//     res.status(500).json({
//       status: false,
//       message: 'Error generating invoice PDF',
//       error: error.message
//     });
//   }
// });

// // Helper function to generate HTML for invoice
// const generateInvoiceHTML = (invoice) => {

//   console.log('Generating HTML for invoice:', invoice);
//   const formatCurrency = (amount) => {
//     return new Intl.NumberFormat('en-IN', {
//       style: 'currency',
//       currency: 'INR'
//     }).format(amount);
//   };

//   const formatDate = (date) => {
//     return new Date(date).toLocaleDateString('en-IN', {
//       year: 'numeric',
//       month: '2-digit',
//       day: '2-digit'
//     });
//   };

//   const formatDateFull = (date) => {
//     return new Date(date).toLocaleDateString('en-IN', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     });
//   };

//   const numberToWords = (num) => {
//     const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
//     const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
//     const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
//     if (num === 0) return 'Zero';
//     if (num < 0) return 'Negative ' + numberToWords(-num);
    
//     let result = '';
    
//     if (num >= 10000000) {
//       result += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
//       num %= 10000000;
//     }
    
//     if (num >= 100000) {
//       result += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
//       num %= 100000;
//     }
    
//     if (num >= 1000) {
//       result += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
//       num %= 1000;
//     }
    
//     if (num >= 100) {
//       result += ones[Math.floor(num / 100)] + ' Hundred ';
//       num %= 100;
//     }
    
//     if (num >= 20) {
//       result += tens[Math.floor(num / 10)] + ' ';
//       num %= 10;
//     } else if (num >= 10) {
//       result += teens[num - 10] + ' ';
//       num = 0;
//     }
    
//     if (num > 0) {
//       result += ones[num] + ' ';
//     }
    
//     return result.trim() + ' Rupees Only';
//   };

//   // Calculate CGST and SGST (assuming 3% total GST = 1.5% each)
//   const cgst = invoice.pricing.totalGST / 2;
//   const sgst = invoice.pricing.totalGST / 2;

//   return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="utf-8">
//       <title>Tax Invoice ${invoice.invoiceNumber}</title>
//       <style>
//         * {
//           margin: 0;
//           padding: 0;
//           box-sizing: border-box;
//         }
        
//         body {
//           font-family: 'Arial', sans-serif;
//           font-size: 12px;
//           line-height: 1.4;
//           color: #000;
//           background: white;
      
//         }
//         .invoice-container {
       
//           margin: 0 auto;
//           background: white;
//           border: 1px solid #ddd;
//         }
        
//         .header {
//           text-align: center;
//           padding: 20px;
//           border-bottom: 2px solid #000;
//         }
        
//         .logo {
//           font-size: 24px;
//           font-weight: bold;
//           color: #D4AF37;
//           margin-bottom: 10px;
//         }
        
//         .company-name {
//           font-size: 18px;
//           font-weight: bold;
//           margin-bottom: 5px;
//         }
        
//         .company-legal {
//           font-size: 10px;
//           color: #666;
//           margin-bottom: 5px;
//         }
        
//         .gstin {
//           font-size: 11px;
//           font-weight: bold;
//           margin-bottom: 10px;
//         }
        
//         .company-address {
//           font-size: 11px;
//           line-height: 1.3;
//           margin-bottom: 10px;
//         }
        
//         .contact-info {
//           font-size: 10px;
//           color: #666;
//         }
        
//         .invoice-title {
//           text-align: center;
//           font-size: 16px;
//           font-weight: bold;
//           margin: 20px 0;
//           text-decoration: underline;
//         }
        
//         .invoice-details {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 20px;
//           padding: 0 20px;
//         }
        
//         .invoice-info {
//           flex: 1;
//         }
        
//         .order-info {
//           flex: 1;
//           text-align: right;
//         }
        
//         .info-row {
//           display: flex;
//           margin-bottom: 5px;
//         }
        
//         .info-label {
//           font-weight: bold;
//           width: 120px;
//         }
        
//         .info-value {
//           flex: 1;
//         }
        
//         .address-section {
//           display: flex;
//           margin-bottom: 20px;
//           padding: 0 20px;
//         }
        
//         .billing-address, .shipping-address {
//           flex: 1;
//           margin-right: 20px;
//         }
        
//         .address-title {
//           font-weight: bold;
//           margin-bottom: 10px;
//           text-decoration: underline;
//         }
        
//         .address-content {
//           font-size: 11px;
//           line-height: 1.3;
//         }
        
//         .products-table {
//           width: 100%;
//           border-collapse: collapse;
//           margin-bottom: 20px;
//           font-size: 10px;
//         }
        
//         .products-table th,
//         .products-table td {
//           border: 1px solid #000;
//           padding: 4px;
//           text-align: center;
//           vertical-align: top;
//         }
        
//         .products-table th {
//           background-color: #f0f0f0;
//           font-weight: bold;
//           font-size: 9px;
//         }
        
//         .products-table .product-desc {
//           text-align: left;
//           width: 200px;
//         }
        
//         .products-table .purity-hsn {
//           width: 80px;
//           font-size: 9px;
//         }
        
//         .products-table .qty {
//           width: 40px;
//         }
        
//         .products-table .weight {
//           width: 60px;
//         }
        
//         .products-table .amount {
//           width: 80px;
//           text-align: right;
//         }
        
//         .totals-section {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 20px;
//           padding: 0 20px;
//         }
        
//         .amount-in-words {
//           flex: 1;
//           margin-right: 20px;
//         }
        
//         .amount-in-words-title {
//           font-weight: bold;
//           margin-bottom: 5px;
//         }
        
//         .payment-info {
//           flex: 1;
//         }
        
//         .payment-row {
//           display: flex;
//           margin-bottom: 3px;
//         }
        
//         .payment-label {
//           font-weight: bold;
//           width: 120px;
//         }
        
//         .payment-value {
//           flex: 1;
//         }
        
//         .tax-breakdown {
//           margin-top: 10px;
//         }
        
//         .tax-row {
//           display: flex;
//           margin-bottom: 2px;
//         }
        
//         .tax-label {
//           width: 100px;
//         }
        
//         .tax-value {
//           flex: 1;
//           text-align: right;
//         }
        
//         .total-amount {
//           font-weight: bold;
//           font-size: 14px;
//           border-top: 2px solid #000;
//           padding-top: 5px;
//         }
        
//         .gold-rates {
//           margin: 20px 0;
//           padding: 0 20px;
//         }
        
//         .gold-rates-title {
//           font-weight: bold;
//           margin-bottom: 10px;
//           text-decoration: underline;
//         }
        
//         .gold-rates-content {
//           font-size: 10px;
//           line-height: 1.3;
//         }
        
//         .terms-conditions {
//           margin: 20px 0;
//           padding: 0 20px;
//         }
        
//         .terms-title {
//           font-weight: bold;
//           margin-bottom: 10px;
//           text-decoration: underline;
//         }
        
//         .terms-content {
//           font-size: 9px;
//           line-height: 1.3;
//         }
        
//         .terms-list {
//           margin-left: 15px;
//         }
        
//         .terms-list li {
//           margin-bottom: 3px;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="invoice-container">
//         <!-- Header -->
//         <div class="header">
//           <div class="logo">P G</div>
//           <div class="company-name">PRECIOUS GOLDSMITH</div>
//           <div class="company-legal">KSAN INDUSTRIES LLP</div>
//           <div class="gstin">GSTIN NO: 33ABAFK98176AIZK</div>
//           <div class="company-address">
//             New No:46, Old No:70/1, Bazullah Road, T Nagar,<br>
//             Chennai - 600017, Tamil Nadu, India.
//           </div>
//           <div class="contact-info">
//             Email: contact@preciousgoldsmith.com<br>
//             Website: preciousgoldsmith.com
//           </div>
//         </div>

//         <!-- Invoice Title -->
//         <div class="invoice-title">TAX INVOICE</div>

//         <!-- Invoice Details -->
//         <div class="invoice-details">
//           <div class="invoice-info">
//             <div class="info-row">
//               <div class="info-label">Invoice No:</div>
//               <div class="info-value">${invoice.invoiceNumber}</div>
//             </div>
//             <div class="info-row">
//               <div class="info-label">Invoice Date:</div>
//               <div class="info-value">${formatDate(invoice.createdAt)}</div>
//             </div>
//           </div>
//           <div class="order-info">
//             <div class="info-row">
//               <div class="info-label">Order No:</div>
//               <div class="info-value">${invoice.orderId?.orderNumber || 'N/A'}</div>
//             </div>
//             <div class="info-row">
//               <div class="info-label">Order Date & Time:</div>
//               <div class="info-value">${formatDateFull(invoice.createdAt)}</div>
//             </div>
//           </div>
//         </div>

//         <!-- Customer Addresses -->
//         <div class="address-section">
//           <div class="billing-address">
//             <div class="address-title">Customer Billing Address:</div>
//             <div class="address-content">
//               <strong>${invoice.customerDetails.name}</strong><br>
//               ${invoice.customerDetails.address.street}<br>
//               ${invoice.customerDetails.address.city} - ${invoice.customerDetails.address.pincode}<br>
//               ${invoice.customerDetails.address.state}, India.
//             </div>
//           </div>
//           <div class="shipping-address">
//             <div class="address-title">Customer Shipping Address:</div>
//             <div class="address-content">
//               <strong>${invoice.customerDetails.name}</strong><br>
//               ${invoice.customerDetails.address.street}<br>
//               ${invoice.customerDetails.address.city} - ${invoice.customerDetails.address.pincode}<br>
//               ${invoice.customerDetails.address.state}, India.
//             </div>
//           </div>
//         </div>

//         <!-- Products Table -->
//         <table class="products-table">
//           <thead>
//             <tr>
//               <th>SI No</th>
//               <th class="product-desc">Product Name</th>
//               <th class="purity-hsn">Purity HSN</th>
//               <th class="qty">Qty</th>
//               <th class="weight">Gross Wt (gram)</th>
//               <th class="weight">Net Stone Wt (Carats/gram)</th>
//               <th class="weight">Net Wt (gram)</th>
//               <th class="amount">Making Charges</th>
//               <th class="amount">Product Value</th>
//               <th class="amount">Discount Amount</th>
//               <th class="amount">Taxable Value</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${invoice.products.map((product, index) => {
//               // Extract stone weight from product details if available

//               console.log('Processing product for HTML generation:', product);
//               console.log('Processing product for productDetails:', product.productDetails);
//               let stoneWeight = '-';
//               // if (product.productDetails) {
//               //   const stoneDetail = product.productDetails.find(detail => detail.type === 'Stone');
//               //   if (stoneDetail && stoneDetail.attributes && stoneDetail.attributes.weight) {
//               //     stoneWeight = stoneDetail.attributes.weight;
//               //   }
//               // }
              
//               return `
//                 <tr>
//                   <td>${index + 1}</td>
//                   <td class="product-desc">${product.name}</td>
//                   <td class="purity-hsn">${product.purity || '22Karat'} 711319</td>
//                   <td class="qty">${product.quantity}</td>
//                   <td class="weight">${(product.weight || 0).toFixed(3)}</td>
//                   <td class="weight">${stoneWeight}</td>
//                   <td class="weight">${(product.weight || 0).toFixed(3)}</td>
//                   <td class="amount">${(product.makingCharges || 0).toFixed(2)}</td>
//                   <td class="amount">${(product.totalPrice || 0).toLocaleString('en-IN')}</td>
//                   <td class="amount">${(product.discount || 0) > 0 ? (product.discount || 0).toFixed(2) : '-'}</td>
//                   <td class="amount">${(product.finalPrice || 0).toLocaleString('en-IN')}</td>
//                 </tr>
//               `;
//             }).join('')}
//             <tr style="font-weight: bold;">
//               <td></td>
//               <td class="product-desc">TOTAL</td>
//               <td class="purity-hsn"></td>
//               <td class="qty">${invoice.products.reduce((sum, p) => sum + (p.quantity || 0), 0)}</td>
//               <td class="weight">${invoice.products.reduce((sum, p) => sum + (p.weight || 0), 0).toFixed(3)}</td>
//               <td class="weight">-</td>
//               <td class="weight">${invoice.products.reduce((sum, p) => sum + (p.weight || 0), 0).toFixed(3)}</td>
//               <td class="amount">${(invoice.pricing.totalMakingCharges || 0).toFixed(2)}</td>
//               <td class="amount">${(invoice.pricing.subtotal || 0).toLocaleString('en-IN')}</td>
//               <td class="amount">${(invoice.pricing.totalDiscount || 0).toFixed(2)}</td>
//               <td class="amount">${((invoice.pricing.subtotal || 0) + (invoice.pricing.totalMakingCharges || 0) - (invoice.pricing.totalDiscount || 0)).toLocaleString('en-IN')}</td>
//             </tr>
//           </tbody>
//         </table>

//         <!-- Amount and Payment Info -->
//         <div class="totals-section">
//           <div class="amount-in-words">
//             <div class="amount-in-words-title">Invoice Amount (In Words):</div>
//             <div>${numberToWords(Math.round(invoice.pricing.grandTotal || 0))}</div>
//           </div>
//           <div class="payment-info">
//             <div class="payment-row">
//               <div class="payment-label">Payment Mode:</div>
//               <div class="payment-value">Non COD</div>
//             </div>
//             <div class="payment-row">
//               <div class="payment-label">Balance payable:</div>
//               <div class="payment-value">Nil</div>
//             </div>
//             <div class="tax-breakdown">
//               <div class="tax-row">
//                 <div class="tax-label">CGST @ 1.5%:</div>
//                 <div class="tax-value">${cgst.toFixed(2)}</div>
//               </div>
//               <div class="tax-row">
//                 <div class="tax-label">SGST @ 1.5%:</div>
//                 <div class="tax-value">${sgst.toFixed(2)}</div>
//               </div>
//               <div class="tax-row total-amount">
//                 <div class="tax-label">Total Amount:</div>
//                 <div class="tax-value">${(invoice.pricing.grandTotal || 0).toLocaleString('en-IN')}</div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <!-- Gold Rates -->
//         <div class="gold-rates">
//           <div class="gold-rates-title">Standard Rate of Gold:</div>
//           <div class="gold-rates-content">
//             ${invoice.investmentSettings ? `
//               24 kt: ${invoice.investmentSettings.goldPrice24kt || 11120} Rs./<br>
//               22kt: ${invoice.investmentSettings.goldPrice22kt || 10185} Rs./<br>
//               18kt: ${invoice.investmentSettings.goldPrice18kt || 8340} Rs./<br>
//               14kt: ${invoice.investmentSettings.goldPrice14kt || 6487} Rs./
//             ` : `
//               24 kt: 11,120 Rs./<br>
//               22kt: 10,185 Rs./<br>
//               18kt: 8340 Rs./<br>
//               14kt: 6487 Rs./
//             `}
//           </div>
//         </div>

//         <!-- Terms and Conditions -->
//         <div class="terms-conditions">
//           <div class="terms-title">Terms and Conditions:</div>
//           <div class="terms-content">
//             <ol class="terms-list">
//               <li>Refer our app/website for our detailed terms and policies.</li>
//               <li>Subject to Chennai Jurisdiction.</li>
//               <li>Weight tolerance of ±0.020 g per product is considered normal due to measurement fluctuations.</li>
//               <li>Any of our products sold can be verified for purity at any BIS-recognised Assaying & Hallmarking Centre. The hallmarking verification charges are Rs.45/- plus GST, payable directly to the centre.</li>
//             </ol>
//           </div>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;
// };


// Download invoice by order code/ID
const downloadInvoiceByOrderCode = asyncHandler(async (req, res) => {
  try {
    const { orderCode } = req.params;
    console.log(`🔍 Looking for invoice with order code: ${orderCode}`);

    // First, find the order by orderCode
    const ProductOrder = require('../models/commerce_order_model');
    const order = await ProductOrder.findOne({ orderCode: orderCode });

    if (!order) {
      console.log(`❌ Order not found for order code: ${orderCode}`);
      return res.status(404).json({
        status: false,
        message: 'Order not found'
      });
    }

    console.log(`✅ Order found: ${order._id}`);

    // Now find the invoice by orderId (MongoDB ObjectId)
    const invoice = await Invoice.findOne({ orderId: order._id })
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderCode status')
      .populate('createdBy', 'name email');

    if (!invoice) {
      console.log(`❌ Invoice not found for order: ${order._id}`);
      return res.status(404).json({
        status: false,
        message: 'Invoice not found for this order. It may not have been generated yet.'
      });
    }

    console.log(`✅ Invoice found: ${invoice._id}`);

    // Use saved invoice data directly (same as what was sent in email)
    // This ensures consistency between email and download
    const shippingAddr = invoice.shippingDetails?.shippingAddress || invoice.customerDetails?.address || {};
    
    // Format shipping address
    const formattedShippingAddress = shippingAddr.street 
      ? `${shippingAddr.street || ''}${shippingAddr.landmark ? ', ' + shippingAddr.landmark : ''}\n${shippingAddr.city || ''}, ${shippingAddr.state || ''} - ${shippingAddr.pincode || ''}`
      : (typeof shippingAddr === 'string' ? shippingAddr : 'N/A');

    // Format billing address
    const billingAddr = invoice.customerDetails?.address || {};
    const formattedBillingAddress = billingAddr.street
      ? `${billingAddr.street || ''}\n${billingAddr.city || ''}, ${billingAddr.state || ''} - ${billingAddr.pincode || ''}`
      : 'N/A';

    // Generate PDF using saved invoice data (same structure as email)
    const pdfInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId?.orderCode || invoice.orderId?.orderNumber || invoice.orderId,
      orderDate: invoice.orderId?.createdAt || invoice.createdAt,
      customerName: invoice.customerDetails?.name || invoice.customerId?.name || 'Customer',
      customerEmail: invoice.customerDetails?.email || invoice.customerId?.email || '',
      customerPhone: invoice.customerDetails?.phone || invoice.customerId?.phone || '',
      billingAddress: formattedBillingAddress,
      shippingAddress: formattedShippingAddress,
      customerAddress: formattedBillingAddress, // Fallback
      items: invoice.products.map((product) => ({
        name: product.name || 'Product',
        purity: product.purity || '22Karat',
        quantity: product.quantity || 1,
        weight: product.weight || 0,
        makingCharges: product.makingCharges || 0, // Use saved making charges
        gst: product.gst || 0, // Use saved GST
        discount: product.discount || 0, // Use saved discount
        price: product.totalPrice || product.finalPrice || 0,
        finalPrice: product.finalPrice || product.totalPrice || 0
      })),
      totalAmount: invoice.pricing?.grandTotal || invoice.grandTotal || 0,
      totalMakingCharges: invoice.pricing?.totalMakingCharges || 0,
      totalGST: invoice.pricing?.totalGST || 0,
      totalDiscount: invoice.pricing?.totalDiscount || 0,
      subtotal: invoice.pricing?.subtotal || 0,
      createdAt: invoice.createdAt || invoice.invoiceDate || new Date()
    };

    const pdf = await generateOrderInvoicePdf(pdfInvoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);

  } catch (error) {
    console.error('❌ Error generating invoice PDF:', error);
    res.status(500).json({
      status: false,
      message: 'Error generating invoice PDF',
      error: error.message
    });
  }
});

const downloadInvoice = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderCode orderNumber status')
      .populate('createdBy', 'name email');

    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    // Use saved invoice data directly (same as what was sent in email)
    // This ensures consistency between email, app, and admin panel
    const shippingAddr = invoice.shippingDetails?.shippingAddress || invoice.customerDetails?.address || {};
    
    // Format shipping address
    const formattedShippingAddress = shippingAddr.street 
      ? `${shippingAddr.street || ''}${shippingAddr.landmark ? ', ' + shippingAddr.landmark : ''}\n${shippingAddr.city || ''}, ${shippingAddr.state || ''} - ${shippingAddr.pincode || ''}`
      : (typeof shippingAddr === 'string' ? shippingAddr : 'N/A');

    // Format billing address
    const billingAddr = invoice.customerDetails?.address || {};
    const formattedBillingAddress = billingAddr.street
      ? `${billingAddr.street || ''}\n${billingAddr.city || ''}, ${billingAddr.state || ''} - ${billingAddr.pincode || ''}`
      : 'N/A';

    // Generate PDF using saved invoice data (same structure as email and app)
    const pdfInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId?.orderCode || invoice.orderId?.orderNumber || invoice.orderId,
      orderDate: invoice.orderId?.createdAt || invoice.createdAt,
      customerName: invoice.customerDetails?.name || invoice.customerId?.name || 'Customer',
      customerEmail: invoice.customerDetails?.email || invoice.customerId?.email || '',
      customerPhone: invoice.customerDetails?.phone || invoice.customerId?.phone || '',
      billingAddress: formattedBillingAddress,
      shippingAddress: formattedShippingAddress,
      customerAddress: formattedBillingAddress, // Fallback
      items: invoice.products.map((product) => ({
        name: product.name || 'Product',
        purity: product.purity || '22Karat',
        quantity: product.quantity || 1,
        weight: product.weight || 0,
        makingCharges: product.makingCharges || 0, // Use saved making charges
        gst: product.gst || 0, // Use saved GST
        discount: product.discount || 0, // Use saved discount
        price: product.totalPrice || product.finalPrice || 0,
        finalPrice: product.finalPrice || product.totalPrice || 0
      })),
      totalAmount: invoice.pricing?.grandTotal || invoice.grandTotal || 0,
      totalMakingCharges: invoice.pricing?.totalMakingCharges || 0,
      totalGST: invoice.pricing?.totalGST || 0,
      totalDiscount: invoice.pricing?.totalDiscount || 0,
      subtotal: invoice.pricing?.subtotal || 0,
      createdAt: invoice.createdAt || invoice.invoiceDate || new Date()
    };

    const pdf = await generateOrderInvoicePdf(pdfInvoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({
      status: false,
      message: 'Error generating invoice PDF',
      error: error.message
    });
  }
});


// ✅ Helper function to generate HTML safely
const generateInvoiceHTML = (invoice) => {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const formatDateFull = (date) =>
    new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    if (num === 0) return 'Zero Rupees Only';
    if (num < 0) return 'Negative ' + numberToWords(-num);
    let result = '';
    if (num >= 10000000) { result += numberToWords(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
    if (num >= 100000) { result += numberToWords(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
    if (num >= 1000) { result += numberToWords(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
    if (num >= 100) { result += ones[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
    if (num >= 20) { result += tens[Math.floor(num / 10)] + ' '; num %= 10; }
    else if (num >= 10) { result += teens[num - 10] + ' '; num = 0; }
    if (num > 0) { result += ones[num] + ' '; }
    return result.trim() + ' Rupees Only';
  };

  const cgst = (invoice.pricing.totalGST || 0) / 2;
  const sgst = (invoice.pricing.totalGST || 0) / 2;

  const products = invoice.products.map(p => (typeof p.toObject === 'function' ? p.toObject() : p));

  const productRows = products.map((product, index) => {
    const name = product.name || 'N/A';
    const purity = product.purity || '22Karat';
    const qty = product.quantity || 0;
    const grossWt = (product.weight || 0).toFixed(3);
    const netWt = (product.weight || 0).toFixed(3);
    const makingCharges = (product.makingCharges || 0).toFixed(2);
    const productValue = (product.totalPrice || 0).toLocaleString('en-IN');
    const discount = product.discount > 0 ? product.discount.toFixed(2) : '-';
    const taxableValue = (product.finalPrice || 0).toLocaleString('en-IN');
    const stoneWeight = '-';

    return `
      <tr>
        <td>${index + 1}</td>
        <td class="product-desc">${name}</td>
        <td class="purity-hsn">${purity} 711319</td>
        <td class="qty">${qty}</td>
        <td class="weight">${grossWt}</td>
        <td class="weight">${stoneWeight}</td>
        <td class="weight">${netWt}</td>
        <td class="amount">${makingCharges}</td>
        <td class="amount">${productValue}</td>
        <td class="amount">${discount}</td>
        <td class="amount">${taxableValue}</td>
      </tr>
    `;
  }).join('');

  const totalQty = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalWeight = products.reduce((sum, p) => sum + (p.weight || 0), 0).toFixed(3);
  const totalRow = `
    <tr style="font-weight: bold;">
      <td></td>
      <td class="product-desc">TOTAL</td>
      <td class="purity-hsn"></td>
      <td class="qty">${totalQty}</td>
      <td class="weight">${totalWeight}</td>
      <td class="weight">-</td>
      <td class="weight">${totalWeight}</td>
      <td class="amount">${(invoice.pricing.totalMakingCharges || 0).toFixed(2)}</td>
      <td class="amount">${(invoice.pricing.subtotal || 0).toLocaleString('en-IN')}</td>
      <td class="amount">${(invoice.pricing.totalDiscount || 0).toFixed(2)}</td>
      <td class="amount">${(
        (invoice.pricing.subtotal || 0) +
        (invoice.pricing.totalMakingCharges || 0) -
        (invoice.pricing.totalDiscount || 0)
      ).toLocaleString('en-IN')}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tax Invoice ${invoice.invoiceNumber}</title>
    <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          background: white;
      
        }
        .invoice-container {
       
          margin: 0 auto;
          background: white;
          border: 1px solid #ddd;
        }
        
        .header {
          text-align: center;
          padding: 20px;
          border-bottom: 2px solid #000;
        }
        
        .logo { width: 50px; margin-bottom: 8px; }
        
        .company-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .company-legal {
          font-size: 10px;
          color: #666;
          margin-bottom: 5px;
        }
        
        .gstin {
          font-size: 11px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .company-address {
          font-size: 11px;
          line-height: 1.3;
          margin-bottom: 10px;
        }
        
        .contact-info {
          font-size: 10px;
          color: #666;
        }
        
        .invoice-title {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin: 20px 0;
          text-decoration: underline;
        }
        
        .invoice-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 20px;
        }
        
        .invoice-info {
          flex: 1;
        }
        
        .order-info {
          flex: 1;
          text-align: right;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 5px;
        }
        
        .info-label {
          font-weight: bold;
          width: 120px;
        }
        
        .info-value {
          flex: 1;
        }
        
        .address-section {
          display: flex;
          margin-bottom: 20px;
          padding: 0 20px;
        }
        
        .billing-address, .shipping-address {
          flex: 1;
          margin-right: 20px;
        }
        
        .address-title {
          font-weight: bold;
          margin-bottom: 10px;
          text-decoration: underline;
        }
        
        .address-content {
          font-size: 11px;
          line-height: 1.3;
        }
        
        .products-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 10px;
        }
        
        .products-table th,
        .products-table td {
          border: 1px solid #000;
          padding: 4px;
          text-align: center;
          vertical-align: top;
        }
        
        .products-table th {
          background-color: #f0f0f0;
          font-weight: bold;
          font-size: 9px;
        }
        
        .products-table .product-desc {
          text-align: left;
          width: 200px;
        }
        
        .products-table .purity-hsn {
          width: 80px;
          font-size: 9px;
        }
        
        .products-table .qty {
          width: 40px;
        }
        
        .products-table .weight {
          width: 60px;
        }
        
        .products-table .amount {
          width: 80px;
          text-align: right;
        }
        
        .totals-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 20px;
        }
        
        .amount-in-words {
          flex: 1;
          margin-right: 20px;
        }
        
        .amount-in-words-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .payment-info {
          flex: 1;
        }
        
        .payment-row {
          display: flex;
          margin-bottom: 3px;
        }
        
        .payment-label {
          font-weight: bold;
          width: 120px;
        }
        
        .payment-value {
          flex: 1;
        }
        
        .tax-breakdown {
          margin-top: 10px;
        }
        
        .tax-row {
          display: flex;
          margin-bottom: 2px;
        }
        
        .tax-label {
          width: 100px;
        }
        
        .tax-value {
          flex: 1;
          text-align: right;
        }
        
        .total-amount {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #000;
          padding-top: 5px;
        }
        
        .gold-rates {
          margin: 20px 0;
          padding: 0 20px;
        }
        
        .gold-rates-title {
          font-weight: bold;
          margin-bottom: 10px;
          text-decoration: underline;
        }
        
        .gold-rates-content {
          font-size: 10px;
          line-height: 1.3;
        }
        
        .terms-conditions {
          margin: 20px 0;
          padding: 0 20px;
        }
        
        .terms-title {
          font-weight: bold;
          margin-bottom: 10px;
          text-decoration: underline;
        }
        
        .terms-content {
          font-size: 9px;
          line-height: 1.3;
        }
        
        .terms-list {
          margin-left: 15px;
        }
        
        .terms-list li {
          margin-bottom: 3px;
        }
      </style>
    </head>
    <body>


        <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
           <img src="data:image/png;base64,${logoBase64}" class="logo"/>

          <div class="company-name">PRECIOUS GOLDSMITH</div>
          <div class="company-legal">KSAN INDUSTRIES LLP</div>
          <div class="gstin">GSTIN NO: 33ABAFK98176AIZK</div>
          <div class="company-address">
            New No:46, Old No:70/1, Bazullah Road, T Nagar,<br>
            Chennai - 600017, Tamil Nadu, India.
          </div>
          <div class="contact-info">
            Email: contact@preciousgoldsmith.com<br>
            Website: preciousgoldsmith.com
          </div>
        </div>

        <!-- Invoice Title -->
        <div class="invoice-title">TAX INVOICE</div>

        <!-- Invoice Details -->
        <div class="invoice-details">
          <div class="invoice-info">
            <div class="info-row">
              <div class="info-label">Invoice No:</div>
              <div class="info-value">${invoice.invoiceNumber}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Invoice Date:</div>
              <div class="info-value">${formatDate(invoice.createdAt)}</div>
            </div>
          </div>
          <div class="order-info">
            <div class="info-row">
              <div class="info-label">Order No:</div>
              <div class="info-value">${invoice.orderId?.orderNumber || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Order Date & Time:</div>
              <div class="info-value">${formatDateFull(invoice.createdAt)}</div>
            </div>
          </div>
        </div>

        <!-- Customer Addresses -->
        <div class="address-section">
          <div class="billing-address">
            <div class="address-title">Customer Billing Address:</div>
            <div class="address-content">
              <strong>${invoice.customerDetails.name}</strong><br>
              ${invoice.customerDetails.address.street}<br>
              ${invoice.customerDetails.address.city} - ${invoice.customerDetails.address.pincode}<br>
              ${invoice.customerDetails.address.state}, India.
            </div>
          </div>
          <div class="shipping-address">
            <div class="address-title">Customer Shipping Address:</div>
            <div class="address-content">
              <strong>${invoice.customerDetails.name}</strong><br>
              ${invoice.customerDetails.address.street}<br>
              ${invoice.customerDetails.address.city} - ${invoice.customerDetails.address.pincode}<br>
              ${invoice.customerDetails.address.state}, India.
            </div>
          </div>
        </div>
   <table class="products-table">
        <thead>
          <tr>
            <th>SI No</th>
            <th class="product-desc">Product Name</th>
            <th class="purity-hsn">Purity HSN</th>
            <th class="qty">Qty</th>
            <th class="weight">Gross Wt (gram)</th>
            <th class="weight">Net Stone Wt (Carats/gram)</th>
            <th class="weight">Net Wt (gram)</th>
            <th class="amount">Making Charges</th>
            <th class="amount">Product Value</th>
            <th class="amount">Discount Amount</th>
            <th class="amount">Taxable Value</th>
          </tr>
        </thead>
        <tbody>${productRows}${totalRow}</tbody>
      </table>

        <!-- Amount and Payment Info -->
        <div class="totals-section">
          <div class="amount-in-words">
            <div class="amount-in-words-title">Invoice Amount (In Words):</div>
            <div>${numberToWords(Math.round(invoice.pricing.grandTotal || 0))}</div>
          </div>
          <div class="payment-info">
            <div class="payment-row">
              <div class="payment-label">Payment Mode:</div>
              <div class="payment-value">Non COD</div>
            </div>
            <div class="payment-row">
              <div class="payment-label">Balance payable:</div>
              <div class="payment-value">Nil</div>
            </div>
            <div class="tax-breakdown">
              <div class="tax-row">
                <div class="tax-label">CGST @ 1.5%:</div>
                <div class="tax-value">${cgst.toFixed(2)}</div>
              </div>
              <div class="tax-row">
                <div class="tax-label">SGST @ 1.5%:</div>
                <div class="tax-value">${sgst.toFixed(2)}</div>
              </div>
              <div class="tax-row total-amount">
                <div class="tax-label">Total Amount:</div>
                <div class="tax-value">${(invoice.pricing.grandTotal || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>

     

        <!-- Terms and Conditions -->
        <div class="terms-conditions">
          <div class="terms-title">Terms and Conditions:</div>
          <div class="terms-content">
            <ol class="terms-list">
              <li>Refer our app/website for our detailed terms and policies.</li>
              <li>Subject to Chennai Jurisdiction.</li>
              <li>Weight tolerance of ±0.020 g per product is considered normal due to measurement fluctuations.</li>
              <li>Any of our products sold can be verified for purity at any BIS-recognised Assaying & Hallmarking Centre. The hallmarking verification charges are Rs.45/- plus GST, payable directly to the centre.</li>
            </ol>
          </div>
        </div>
      </div>

  </body>
    </html>
  `;
};


// @desc    Update invoice with correct product data
// @route   PUT /api/v0/invoices/:id/update-product-data
// @access  Private (Admin)
const updateInvoiceProductData = asyncHandler(async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found'
      });
    }

    const Product = require('../models/product_model');
    
    // Update products with correct data
    const updatedProducts = await Promise.all(invoice.products.map(async (product) => {
      const fullProduct = await Product.findById(product.productId);
      if (fullProduct) {
        const productDetails = fullProduct.productDetails || [];
        const priceDetails = fullProduct.priceDetails || [];
        
        // Extract weight and purity from product details
        let weight = 0;
        let purity = '22Karat';
        let metalType = 'gold';
        
        productDetails.forEach(detail => {
          if (detail.type === 'Metal') {
            if (detail.attributes && detail.attributes['Gross Weight']) {
              weight = parseFloat(detail.attributes['Gross Weight']) || 0;
            }
            if (detail.attributes && detail.attributes.Karatage) {
              purity = detail.attributes.Karatage;
            }
            if (detail.attributes && detail.attributes.Material) {
              metalType = detail.attributes.Material.toLowerCase();
            }
          }
        });

        // Extract making charges, GST, and discount from priceDetails
        let makingCharges = 0;
        let gst = 0;
        let discount = 0;
        
        priceDetails.forEach(price => {
          if (price.name === 'Making Charges') {
            makingCharges = (parseFloat(price.value) || 0) * product.quantity;
          } else if (price.name === 'GST') {
            gst = (parseFloat(price.value) || 0) * product.quantity;
          } else if (price.name === 'Discount') {
            discount = (parseFloat(price.value) || 0) * product.quantity;
          }
        });

        // If no making charges found in priceDetails, calculate from percentage
        if (makingCharges === 0) {
          const goldValue = priceDetails.find(p => p.name === 'Gold')?.value || 0;
          const makingChargesPercentage = priceDetails.find(p => p.name === 'Making Charges')?.weight;
          if (makingChargesPercentage && makingChargesPercentage.includes('%')) {
            const percentage = parseFloat(makingChargesPercentage.replace('%', '')) / 100;
            makingCharges = (goldValue * percentage) * product.quantity;
          }
        }

        // If no GST found in priceDetails, use the product's GST field
        if (gst === 0 && fullProduct.gst) {
          gst = (product.totalPrice * fullProduct.gst / 100) * product.quantity;
        }

        // If no discount found in priceDetails, use the product's Discount field
        if (discount === 0 && fullProduct.Discount) {
          discount = (product.totalPrice * fullProduct.Discount / 100) * product.quantity;
        }

        const finalPrice = (product.totalPrice || 0) + (makingCharges || 0) + (gst || 0) - (discount || 0);

        console.log(`Product ${product.name}: weight=${weight}, purity=${purity}, makingCharges=${makingCharges}, gst=${gst}, discount=${discount}, finalPrice=${finalPrice}`);

        return {
          ...product,
          weight: weight || 0,
          purity: purity || '22Karat',
          metalType: metalType || 'gold',
          makingCharges: makingCharges || 0,
          gst: gst || 0,
          discount: discount || 0,
          finalPrice: finalPrice || product.totalPrice || 0
        };
      }
      return product;
    }));

    // Update pricing totals
    const subtotal = updatedProducts.reduce((sum, product) => sum + (product.totalPrice || 0), 0);
    const totalMakingCharges = updatedProducts.reduce((sum, product) => sum + (product.makingCharges || 0), 0);
    const totalGST = updatedProducts.reduce((sum, product) => sum + (product.gst || 0), 0);
    const totalDiscount = updatedProducts.reduce((sum, product) => sum + (product.discount || 0), 0);
    const grandTotal = subtotal + totalMakingCharges + totalGST - totalDiscount;

    // Update the invoice
    invoice.products = updatedProducts;
    invoice.pricing = {
      subtotal,
      totalMakingCharges,
      totalGST,
      totalDiscount,
      grandTotal,
      currency: 'INR'
    };

    await invoice.save();

    res.status(200).json({
      status: true,
      message: 'Invoice product data updated successfully',
      data: invoice
    });

  } catch (error) {
    console.error('Error updating invoice product data:', error);
    res.status(500).json({
      status: false,
      message: 'Error updating invoice product data',
      error: error.message
    });
  }
});

// @desc    Create test invoice with complete product data
// @route   POST /api/v0/invoices/create-test
// @access  Private (Admin)
const createTestInvoice = asyncHandler(async (req, res) => {
  try {
    const Product = require('../models/product_model');
    const User = require('../models/userModel');
    
    // Get sample products with complete data
    const products = await Product.find({}).limit(3);
    if (products.length === 0) {
      return res.status(404).json({
        status: false,
        message: 'No products found'
      });
    }

    // Get a sample user
    const user = await User.findOne({});
    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'No users found'
      });
    }

    // Prepare products with complete data extraction
    const invoiceProducts = await Promise.all(products.map(async (product, index) => {
      const productDetails = product.productDetails || [];
      const priceDetails = product.priceDetails || [];
      
      // Extract weight and purity from product details
      let weight = 0;
      let purity = '22Karat';
      let metalType = 'gold';
      
      productDetails.forEach(detail => {
        if (detail.type === 'Metal') {
          // Handle MongooseMap attributes
          if (detail.attributes && detail.attributes.get) {
            // It's a Map - use .get() method
            const grossWeight = detail.attributes.get('Gross Weight');
            if (grossWeight) {
              const weightStr = grossWeight.toString().replace('g', '').trim();
              weight = parseFloat(weightStr) || 0;
              console.log(`Extracted weight for ${product.name}: ${weight} from ${grossWeight} (processed: ${weightStr})`);
            }
            
            const karatage = detail.attributes.get('Karatage');
            if (karatage) {
              purity = karatage;
              console.log(`Extracted purity for ${product.name}: ${purity}`);
            }
            
            const material = detail.attributes.get('Material');
            if (material) {
              metalType = material.toLowerCase();
              console.log(`Extracted metalType for ${product.name}: ${metalType}`);
            }
          } else if (detail.attributes) {
            // It's a regular object
            if (detail.attributes['Gross Weight']) {
              const weightStr = detail.attributes['Gross Weight'].toString().replace('g', '').trim();
              weight = parseFloat(weightStr) || 0;
              console.log(`Extracted weight for ${product.name}: ${weight} from ${detail.attributes['Gross Weight']} (processed: ${weightStr})`);
            }
            if (detail.attributes.Karatage) {
              purity = detail.attributes.Karatage;
              console.log(`Extracted purity for ${product.name}: ${purity}`);
            }
            if (detail.attributes.Material) {
              metalType = detail.attributes.Material.toLowerCase();
              console.log(`Extracted metalType for ${product.name}: ${metalType}`);
            }
          }
        }
      });

      // Calculate pricing details
      const unitPrice = product.sellingprice || 0;
      const quantity = index + 1; // Sample quantities: 1, 2, 3
      const totalPrice = unitPrice * quantity;
      
      // Extract making charges, GST, and discount from priceDetails
      let makingCharges = 0;
      let gst = 0;
      let discount = 0;
      
      priceDetails.forEach(price => {
        if (price.name === 'Making Charges') {
          makingCharges = (parseFloat(price.value) || 0) * quantity;
        } else if (price.name === 'GST') {
          gst = (parseFloat(price.value) || 0) * quantity;
        } else if (price.name === 'Discount') {
          discount = (parseFloat(price.value) || 0) * quantity;
        }
      });

      // If no making charges found, calculate from percentage
      if (makingCharges === 0) {
        const goldValue = priceDetails.find(p => p.name === 'Gold')?.value || 0;
        const makingChargesPercentage = priceDetails.find(p => p.name === 'Making Charges')?.weight;
        if (makingChargesPercentage && makingChargesPercentage.includes('%')) {
          const percentage = parseFloat(makingChargesPercentage.replace('%', '')) / 100;
          makingCharges = (goldValue * percentage) * quantity;
        }
      }

      // If no GST found, use the product's GST field
      if (gst === 0 && product.gst) {
        gst = (totalPrice * product.gst / 100) * quantity;
      }

      // If no discount found, use the product's Discount field
      if (discount === 0 && product.Discount) {
        discount = (totalPrice * product.Discount / 100) * quantity;
      }

      const finalPrice = totalPrice + makingCharges + gst - discount;

      return {
        productId: product._id,
        name: product.name,
        sku: product.skuId || 'N/A',
        category: product.categories || 'N/A',
        brand: product.brand || 'N/A',
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        weight: weight,
        metalType: metalType,
        purity: purity,
        makingCharges: makingCharges,
        gst: gst,
        discount: discount,
        finalPrice: finalPrice,
        productDetails: productDetails,
        priceDetails: priceDetails,
        images: product.images || [],
        description: product.description || ''
      };
    }));

    // Calculate totals
    const subtotal = invoiceProducts.reduce((sum, product) => sum + product.totalPrice, 0);
    const totalMakingCharges = invoiceProducts.reduce((sum, product) => sum + product.makingCharges, 0);
    const totalGST = invoiceProducts.reduce((sum, product) => sum + product.gst, 0);
    const totalDiscount = invoiceProducts.reduce((sum, product) => sum + product.discount, 0);
    const grandTotal = subtotal + totalMakingCharges + totalGST - totalDiscount;

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const sequence = String(invoiceCount + 1).padStart(4, '0');
    const invoiceNumber = `INV-${year}${month}${day}-${sequence}`;

    // Prepare customer details
    const customerDetails = {
      name: user.name || 'Test Customer',
      email: user.email,
      phone: user.phone || 'N/A',
      address: user.address && user.address.length > 0 ? user.address[0] : {
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456'
      }
    };

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      orderId: null, // Test invoice
      customerId: user._id,
      customerDetails,
      products: invoiceProducts,
      pricing: {
        subtotal,
        totalMakingCharges,
        totalGST,
        totalDiscount,
        grandTotal,
        currency: 'INR'
      },
      paymentDetails: {
        method: 'cash',
        paymentStatus: 'pending',
        paidAmount: 0
      },
      shippingDetails: {
        method: 'standard',
        shippingAddress: customerDetails.address
      },
      status: 'draft',
      createdBy: user._id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    await invoice.save();

    res.status(201).json({
      status: true,
      message: 'Test invoice created successfully with complete product data',
      data: invoice
    });

  } catch (error) {
    console.error('Error creating test invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error creating test invoice',
      error: error.message
    });
  }
});

// @desc    Debug product data extraction
// @route   GET /api/v0/invoices/debug-product-data
// @access  Private (Admin)
const debugProductData = asyncHandler(async (req, res) => {
  try {
    const Product = require('../models/product_model');
    
    // Get first product with complete data
    const product = await Product.findOne({});
    if (!product) {
      return res.status(404).json({
        status: false,
        message: 'No products found'
      });
    }

    const productDetails = product.productDetails || [];
    const priceDetails = product.priceDetails || [];
    
    // Extract weight and purity from product details
    let weight = 0;
    let purity = '22Karat';
    let metalType = 'gold';
    const processingSteps = [];
    
    processingSteps.push(`Product Details length: ${productDetails.length}`);
    
    for (let i = 0; i < productDetails.length; i++) {
      const detail = productDetails[i];
      processingSteps.push(`Processing detail ${i}: type=${detail.type}`);
      
      if (detail.type === 'Metal') {
        processingSteps.push('Found Metal detail!');
        
        // Try different ways to access the attributes
        processingSteps.push(`Detail attributes type: ${typeof detail.attributes}`);
        processingSteps.push(`Detail attributes constructor: ${detail.attributes?.constructor?.name}`);
        
        // Try accessing as Map
        let attributes = {};
        if (detail.attributes && detail.attributes.get) {
          // It's a Map
          processingSteps.push('Attributes is a Map');
          attributes = {
            'Gross Weight': detail.attributes.get('Gross Weight'),
            'Karatage': detail.attributes.get('Karatage'),
            'Material': detail.attributes.get('Material')
          };
        } else if (detail.attributes && detail.attributes.toObject) {
          // It's a Mongoose document
          processingSteps.push('Attributes is a Mongoose document');
          attributes = detail.attributes.toObject();
        } else {
          // It's a plain object
          processingSteps.push('Attributes is a plain object');
          attributes = detail.attributes || {};
        }
        
        processingSteps.push(`Metal detail attributes: ${JSON.stringify(attributes)}`);
        processingSteps.push(`Attributes keys: ${Object.keys(attributes)}`);
        
        if (attributes && attributes['Gross Weight']) {
          processingSteps.push('Found Gross Weight attribute!');
          // Remove 'g' suffix if present and parse the number
          const weightStr = attributes['Gross Weight'].toString().replace('g', '').trim();
          weight = parseFloat(weightStr) || 0;
          processingSteps.push(`Extracted weight: ${weight} from ${attributes['Gross Weight']} (processed: ${weightStr})`);
        } else {
          processingSteps.push(`Gross Weight attribute not found or empty`);
        }
        
        if (attributes && attributes.Karatage) {
          processingSteps.push('Found Karatage attribute!');
          purity = attributes.Karatage;
          processingSteps.push(`Extracted purity: ${purity}`);
        } else {
          processingSteps.push('Karatage attribute not found or empty');
        }
        
        if (attributes && attributes.Material) {
          processingSteps.push('Found Material attribute!');
          metalType = attributes.Material.toLowerCase();
          processingSteps.push(`Extracted metalType: ${metalType}`);
        } else {
          processingSteps.push('Material attribute not found or empty');
        }
      } else {
        processingSteps.push(`Detail type is not Metal: ${detail.type}`);
      }
    }

    processingSteps.push(`Final extracted data: weight=${weight}, purity=${purity}, metalType=${metalType}`);

    res.status(200).json({
      status: true,
      message: 'Product data extraction debug',
      data: {
        productName: product.name,
        originalProductDetails: productDetails,
        extractedData: {
          weight,
          purity,
          metalType
        },
        priceDetails: priceDetails,
        debugInfo: {
          productDetailsLength: productDetails.length,
          processingSteps: processingSteps
        }
      }
    });

  } catch (error) {
    console.error('Error debugging product data:', error);
    res.status(500).json({
      status: false,
      message: 'Error debugging product data',
      error: error.message
    });
  }
});

module.exports = {
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
};
