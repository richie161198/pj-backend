const asyncHandler = require('express-async-handler');
const InvestmentInvoice = require('../models/investmentInvoice_model');
const Order = require('../models/orderModel');
const User = require('../models/userModel');
const fs = require('fs');
const path = require('path');
const { generateInvestmentInvoicePdf, logoBase64 } = require('../services/pdfService');

// @desc    Create invoice for investment order
// @route   POST /api/v0/investment-invoices/create
// @access  Private
const createInvestmentInvoice = asyncHandler(async (req, res) => {
  const {
    orderId,
    userId,
    customerName,
    customerEmail,
    customerPhone,
    orderType, // 'buy' or 'sell'
    transactionType, // 'GOLD' or 'SILVER'
    quantity, // in grams
    ratePerGram,
    amount,
    gstAmount,
    discountCode,
    discount,
    totalInvoiceValue,
    paymentMethod,
    transactionId,
  } = req.body;

  try {
    // Check if invoice already exists
    const existingInvoice = await InvestmentInvoice.findOne({ orderId });
    if (existingInvoice) {
      return res.status(200).json({
        status: true,
        message: 'Invoice already exists',
        data: existingInvoice,
      });
    }

    // Determine product name
    let product = 'GOLD24';
    if (transactionType === 'GOLD') {
      product = 'GOLD24';
    } else if (transactionType === 'SILVER') {
      product = 'SILVER';
    }

    // Create invoice
    const invoice = await InvestmentInvoice.create({
      orderId,
      userId,
      customerName,
      customerEmail,
      customerPhone,
      orderType,
      transactionType,
      product,
      quantity: parseFloat(quantity),
      ratePerGram: parseFloat(ratePerGram),
      amount: parseFloat(amount),
      gstRate: 3,
      gstAmount: parseFloat(gstAmount || 0),
      discountCode: discountCode || null,
      discount: parseFloat(discount || 0),
      totalInvoiceValue: parseFloat(totalInvoiceValue),
      paymentMethod: paymentMethod || 'UPI',
      transactionId: transactionId || orderId,
      status: 'issued',
      invoiceDate: new Date(),
      createdBy: 'System',
    });

    res.status(201).json({
      status: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (error) {
    console.error('Error creating investment invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error creating invoice',
      error: error.message,
    });
  }
});

// @desc    Get invoice by ID
// @route   GET /api/v0/investment-invoices/:id
// @access  Private
const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await InvestmentInvoice.findById(req.params.id).populate('userId', 'name email phone');

  if (!invoice) {
    return res.status(404).json({
      status: false,
      message: 'Invoice not found',
    });
  }

  res.status(200).json({
    status: true,
    data: invoice,
  });
});

// @desc    Get invoice by order ID
// @route   GET /api/v0/investment-invoices/order/:orderId
// @access  Private
const getInvoiceByOrderId = asyncHandler(async (req, res) => {
  const invoice = await InvestmentInvoice.findOne({ orderId: req.params.orderId }).populate('userId', 'name email phone');

  if (!invoice) {
    return res.status(404).json({
      status: false,
      message: 'Invoice not found for this order',
    });
  }

  res.status(200).json({
    status: true,
    data: invoice,
  });
});

// @desc    Get user's invoices
// @route   GET /api/v0/investment-invoices/user/:userId
// @access  Private
const getUserInvoices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, orderType, transactionType } = req.query;

  const query = { userId: req.params.userId };
  if (orderType) query.orderType = orderType;
  if (transactionType) query.transactionType = transactionType;

  const invoices = await InvestmentInvoice.find(query)
    .sort({ invoiceDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'name email phone');

  const count = await InvestmentInvoice.countDocuments(query);

  res.status(200).json({
    status: true,
    data: invoices,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
});

// @desc    Get all invoices (Admin)
// @route   GET /api/v0/investment-invoices/all
// @access  Private (Admin)
const getAllInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    orderType,
    transactionType,
    status,
    search,
    startDate,
    endDate,
  } = req.query;

  // Build query
  const query = {};

  if (orderType) query.orderType = orderType;
  if (transactionType) query.transactionType = transactionType;
  if (status) query.status = status;

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDateTime;
    }
  }

  // Search filter
  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { orderId: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerEmail: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
    ];
  }

  // Execute query
  const invoices = await InvestmentInvoice.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'name email phone state address');

  const count = await InvestmentInvoice.countDocuments(query);

  // Calculate summary stats
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalInvoiceValue || 0), 0);
  const totalGST = invoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);

  res.status(200).json({
    success: true,
    data: invoices,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    },
    summary: {
      totalInvoices: count,
      totalAmount: totalAmount,
      totalGST: totalGST,
    },
  });
});

// Generate HTML for investment invoice
// const generateInvestmentInvoiceHTML = (invoice) => {
//   const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: '2-digit',
//     year: 'numeric',
//   });

//   const orderTypeLabel = invoice.orderType === 'buy' ? 'BUY' : 'SELL';
//   const typeColor = invoice.orderType === 'buy' ? '#4CAF50' : '#F44336';

//   return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8">
//   <style>
//     * { margin: 0; padding: 0; box-sizing: border-box; }
//     body {
//        font-family: Arial, sans-serif;
//        font-size: 11px;
//        line-height: 1.3;
//        color: #000;
//        padding: 10px;
//      }
//      .invoice-container {
//        width: 100%;
//        margin: 0 auto;
//        background: #fff;
//      }
//     .header {
//       color: white;
//       padding: 30px;
//       text-align: center;
//     }
//     .header .logo {
//       width: 80px;
//       height: 80px;
//       margin: 0 auto 15px;
//       background: white;
//       border-radius: 50%;
//       padding: 10px;
//     }
//     .header .company-name {
//       font-size: 24px;
//       font-weight: bold;
//       margin-bottom: 5px;
//     }
//     .header .company-tagline {
//       font-size: 14px;
//       opacity: 0.9;
//     }
//     .invoice-title {
//       text-align: center;
//       padding: 20px;
//       background: #f5f5f5;
//     }
//     .invoice-title h1 {
//       font-size: 28px;
//       color: #333;
//       margin-bottom: 5px;
//     }
//     .invoice-title .type-badge {
//       display: inline-block;
//       padding: 5px 15px;
//       background: ${typeColor};
//       color: white;
//       border-radius: 20px;
//       font-size: 12px;
//       font-weight: bold;
//     }
//     .content {
//       padding: 30px;
//     }
//     .info-section {
//       display: flex;
//       justify-content: space-between;
//       margin-bottom: 30px;
//       padding-bottom: 20px;
//       border-bottom: 2px solid #eee;
//     }
//     .info-box {
//       flex: 1;
//     }
//     .info-box h3 {
//       font-size: 14px;
//       color: #E9BE8C;
//       margin-bottom: 10px;
//       font-weight: bold;
//     }
//     .info-box p {
//       margin: 5px 0;
//       font-size: 11px;
//       color: #555;
//     }
//     .info-box strong {
//       color: #333;
//     }
//     table {
//       width: 100%;
//       border-collapse: collapse;
//       margin: 20px 0;
//     }
//     table th {
//       background: linear-gradient(135deg, #E9BE8C 0%, #764ba2 100%);
//       color: white;
//       padding: 12px;
//       text-align: left;
//       font-size: 11px;
//       font-weight: bold;
//       text-transform: uppercase;
//     }
//     table td {
//       padding: 12px;
//       border-bottom: 1px solid #eee;
//       font-size: 11px;
//     }
//     table tr:last-child td {
//       border-bottom: none;
//     }
//     table tr:nth-child(even) {
//       background: #f9f9f9;
//     }
//     .text-right {
//       text-align: right;
//     }
//     .summary-table {
//       margin-top: 30px;
//       margin-left: auto;
//       width: 350px;
//     }
//     .summary-table table {
//       margin: 0;
//     }
//     .summary-table td {
//       padding: 8px 12px;
//       font-size: 12px;
//     }
//     .summary-table .total-row td {
//       background: linear-gradient(135deg, #E9BE8C 0%, #764ba2 100%);
//       color: white;
//       font-weight: bold;
//       font-size: 14px;
//       padding: 15px 12px;
//     }
//     .declaration {
//       margin-top: 30px;
//       padding: 20px;
//       background: #f9f9f9;
//       border-left: 4px solid #E9BE8C;
//     }
//     .declaration h3 {
//       font-size: 14px;
//       color: #E9BE8C;
//       margin-bottom: 10px;
//     }
//     .declaration ul {
//       list-style-position: inside;
//       padding-left: 0;
//     }
//     .declaration li {
//       margin: 8px 0;
//       font-size: 10px;
//       line-height: 1.5;
//       color: #555;
//     }
//     .footer {
//       text-align: center;
//       padding: 20px;
//       background: #f5f5f5;
//       margin-top: 30px;
//     }
//     .footer p {
//       font-size: 10px;
//       color: #666;
//       margin: 5px 0;
//     }
//     .signature {
//       margin-top: 50px;
//       text-align: right;
//     }
//     .signature-line {
//       width: 200px;
//       border-top: 1px solid #000;
//       margin-left: auto;
//       padding-top: 5px;
//       font-size: 10px;
//     }
//   </style>
// </head>
// <body>
//   <div class="invoice-container">
//     <!-- Header -->
//     <div class="header">
//       ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="logo" />` : '<div class="logo"></div>'}
//       <div class="company-name">${invoice.company.name}</div>
//       <div class="company-tagline">Digital Gold & Silver Investment Platform</div>
//     </div>

//     <!-- Invoice Title -->
//     <div class="invoice-title">
//       <h1>Tax Invoice</h1>
//       <span class="type-badge">Type: ${orderTypeLabel}</span>
//     </div>

//     <!-- Content -->
//     <div class="content">
//       <!-- Info Section -->
//       <div class="info-section">
//         <div class="info-box">
//           <h3>Customer Details</h3>
//           <p><strong>Name:</strong> ${invoice.customerName}</p>
//           ${invoice.customerEmail ? `<p><strong>Email:</strong> ${invoice.customerEmail}</p>` : ''}
//           ${invoice.customerPhone ? `<p><strong>Phone:</strong> ${invoice.customerPhone}</p>` : ''}
//           <p><strong>Type:</strong> ${invoice.orderType === 'buy' ? 'AUTOPAY' : 'WITHDRAWAL'}</p>
//         </div>

//         <div class="info-box">
//           <h3>Invoice Details</h3>
//           <p><strong>Customer Name:</strong> ${invoice.customerName}</p>
//           <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
//           <p><strong>Order ID:</strong> ${invoice.orderId}</p>
//           <p><strong>Date:</strong> ${invoiceDate}</p>
//           <p><strong>Product:</strong> ${invoice.product}</p>
//         </div>

//         <div class="info-box">
//           <h3>Company Details</h3>
//           <p><strong>${invoice.company.name}</strong></p>
//           <p>${invoice.company.address}</p>
//           <p><strong>GSTIN:</strong> ${invoice.company.gstin}</p>
//           <p><strong>PAN:</strong> ${invoice.company.pan}</p>
//           <p><strong>CIN:</strong> ${invoice.company.cin}</p>
//           <p>Need Help? email us at ${invoice.company.email}</p>
//         </div>
//       </div>

//       <!-- Product Details Table -->
//       <table>
//         <thead>
//           <tr>
//             <th>Description</th>
//             <th>Quantity(grams)</th>
//             <th>Rate/gm(₹)</th>
//             <th class="text-right">Amount(₹)</th>
//           </tr>
//         </thead>
//         <tbody>
//           <tr>
//             <td>${invoice.product}</td>
//             <td>${invoice.quantity.toFixed(4)}</td>
//             <td>${invoice.ratePerGram.toFixed(2)}</td>
//             <td class="text-right">${invoice.amount.toFixed(2)}</td>
//           </tr>
//           <tr>
//             <td colspan="3">GST(${invoice.gstRate}%)</td>
//             <td class="text-right">${invoice.gstAmount.toFixed(2)}</td>
//           </tr>
//           ${invoice.discountCode ? `
//           <tr>
//             <td colspan="3">DISCOUNT CODE</td>
//             <td class="text-right">${invoice.discountCode}</td>
//           </tr>
//           <tr>
//             <td colspan="3">DISCOUNT</td>
//             <td class="text-right">${invoice.discount.toFixed(2)}</td>
//           </tr>
//           ` : ''}
//         </tbody>
//       </table>

//       <!-- Summary -->
//       <div class="summary-table">
//         <table>
//           <tr class="total-row">
//             <td>TOTAL INVOICE VALUE</td>
//             <td class="text-right">₹${invoice.totalInvoiceValue.toFixed(2)}</td>
//           </tr>
//         </table>
//       </div>

//       <!-- Transaction Details -->
//       <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
//         <h3 style="font-size: 14px; color: #E9BE8C; margin-bottom: 10px;">Transaction Details</h3>
//         <p style="margin: 5px 0; font-size: 11px;"><strong>Transaction ID:</strong> ${invoice.transactionId}</p>
//         <p style="margin: 5px 0; font-size: 11px;"><strong>Payment Mode:</strong> ${invoice.paymentMethod}</p>
//       </div>

//       <!-- Declaration -->
//       <div class="declaration">
//         <h3>Declaration:</h3>
//         <ul>
//           ${invoice.declaration.map(item => `<li>${item}</li>`).join('')}
//         </ul>
//       </div>

//       <!-- Signature -->
//       <div class="signature">
//         <div style="width: 200px; margin-left: auto; text-align: center;">
//           <div style="height: 50px; margin-bottom: 10px;">
//             <!-- Signature space -->
//           </div>
//           <div class="signature-line">
//             <strong>Authorised Signatory</strong><br/>
//             ${invoice.company.name}.
//           </div>
//         </div>
//       </div>
//     </div>

//     <!-- Footer -->
//     <div class="footer">
//       <p><strong>Thank you for choosing ${invoice.company.name}</strong></p>
//       <p>For any queries, please contact us at ${invoice.company.email}</p>
//       <p>This is a computer-generated invoice and does not require a physical signature.</p>
//     </div>
//   </div>
// </body>
// </html>
//   `;
// };


// Generate HTML for compact single-page investment invoice
const generateInvestmentInvoiceHTML = (invoice) => {
  const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const orderTypeLabel = invoice.orderType === 'buy' ? 'BUY' : 'SELL';
  const typeColor = invoice.orderType === 'buy' ? '#4CAF50' : '#F44336';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      padding: 10px;
    }
    .invoice-container {
      width: 100%;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      color: #fff;
      padding: 10px 0;
    }
    .header .logo {
      width: 50px;
      height: 50px;
      margin: 0 auto 5px;
      background: white;
      border-radius: 50%;
      padding: 5px;
    }
    .header .company-name { font-size: 16px; font-weight: bold; color:black}
    .header .company-tagline { font-size: 10px;color:black }
    .invoice-title {
      text-align: center;
      padding: 8px 0;
      background: #f3f3f3;
    }
    .invoice-title h1 {
      font-size: 16px;
      color: #333;
      margin-bottom: 3px;
    }
    .invoice-title .type-badge {
      padding: 2px 8px;
      background: ${typeColor};
      color: #fff;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
    }
    .content { padding: 10px; }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 8px;
    }
    .info-box { flex: 1; padding: 0 5px; }
    .info-box h3 {
      font-size: 11px;
      color: #E9BE8C;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .info-box p {
      margin: 2px 0;
      font-size: 10px;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    th {
      background: #E9BE8C;
      color: #fff;
      padding: 6px;
      text-align: left;
      font-size: 10px;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #eee;
      font-size: 10px;
    }
    .text-right { text-align: right; }
    .summary-table {
      width: 280px;
      margin-left: auto;
      margin-top: 10px;
    }
    .summary-table td {
      padding: 5px;
      font-size: 10px;
    }
    .summary-table .total-row td {
      background: #E9BE8C;
      color: #fff;
      font-weight: bold;
      font-size: 11px;
    }
    .transaction, .declaration {
      margin-top: 10px;
      background: #f9f9f9;
      padding: 8px;
      border-radius: 4px;
    }
    .transaction h3, .declaration h3 {
      font-size: 11px;
      color: #E9BE8C;
      margin-bottom: 5px;
    }
    .transaction p, .declaration li {
      font-size: 9.5px;
      margin: 2px 0;
      color: #444;
    }
    .declaration ul { padding-left: 12px; margin: 0; }
    .signature {
      margin-top: 15px;
      text-align: right;
      font-size: 9.5px;
    }
    .signature-line {
      width: 160px;
      border-top: 1px solid #000;
      margin-left: auto;
      padding-top: 3px;
    }
    .footer {
      text-align: center;
      padding: 8px 0;
      background: #f3f3f3;
      margin-top: 10px;
    }
    .footer p {
      font-size: 9px;
      color: #555;
      margin: 2px 0;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="logo" />` : ''}
      <div class="company-name">Precious Goldsmith</div>
      <div class="company-tagline">Digital Gold & Silver Investment Platform</div>
    </div>

    <div class="invoice-title">
      <h1>Invoice Statement - ${orderTypeLabel} Order</h1>
    </div>

    <div class="content">
      <div class="info-section">
        <div class="info-box">
          <h3>Customer Details</h3>
          <p><strong>${invoice.customerName}</strong></p>
          ${invoice.customerEmail ? `<p>${invoice.customerEmail}</p>` : ''}
          ${invoice.customerPhone ? `<p>${invoice.customerPhone}</p>` : ''}
          <p>${invoice.orderType === 'buy' ? 'AUTOPAY' : 'WITHDRAWAL'}</p>
        </div>
        <div class="info-box">
          <h3>Invoice Details</h3>
          <p>Invoice No: ${invoice.invoiceNumber}</p>
          <p>Order ID: ${invoice.orderId}</p>
          <p>Date: ${invoiceDate}</p>
          <p>Product: ${invoice.product}</p>
        </div>
        <div class="info-box">
          <h3>Company</h3>
          <p><strong>${invoice.company.name}</strong></p>
          <p>${invoice.company.address}</p>
          <p>GSTIN: ${invoice.company.gstin}</p>
          <p>PAN: ${invoice.company.pan}</p>
          <p>CIN: ${invoice.company.cin}</p>
          <p>${invoice.company.email}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty(g)</th>
            <th>Rate/g(₹)</th>
            <th class="text-right">Amount(₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoice.product}</td>
            <td>${invoice.quantity.toFixed(4)}</td>
            <td>${invoice.ratePerGram.toFixed(2)}</td>
            <td class="text-right">${invoice.amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3">GST(${invoice.gstRate}%)</td>
            <td class="text-right">${invoice.gstAmount.toFixed(2)}</td>
          </tr>
          ${invoice.discountCode ? `
          <tr>
            <td colspan="3">Discount (${invoice.discountCode})</td>
            <td class="text-right">-${invoice.discount.toFixed(2)}</td>
          </tr>` : ''}
        </tbody>
      </table>

      <div class="summary-table">
        <table>
          <tr class="total-row">
            <td>Total</td>
            <td class="text-right">₹${invoice.totalInvoiceValue.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div class="transaction">
        <h3>Transaction Details</h3>
        <p><strong>ID:</strong> ${invoice.transactionId}</p>
        <p><strong>Mode:</strong> ${invoice.paymentMethod}</p>
      </div>

      <div class="declaration">
        <h3>Declaration:</h3>
        <ul>${invoice.declaration.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>

      <div class="signature">
        <div class="signature-line">
          <strong>Authorised Signatory</strong><br/>${invoice.company.name}
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>Thank you for choosing ${invoice.company.name}</strong></p>
      <p>For queries: ${invoice.company.email}</p>
      <p>This is a computer-generated invoice. No signature required.</p>
    </div>
  </div>
</body>
</html>
  `;
};

// @desc    Download invoice as PDF
// @route   GET /api/v0/investment-invoices/download/:id
// @access  Private
const downloadInvoicePDF = asyncHandler(async (req, res) => {
  try {
    const invoice = await InvestmentInvoice.findById(req.params.id).populate('userId', 'name email phone state address');

    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found',
      });
    }

    // Get user state from populated userId
    const userState = invoice.userId?.state || '';
    const userAddress = invoice.userId?.address || '';
    const customerAddressStr = typeof userAddress === 'string' ? userAddress : (userAddress?.street || '');

    // Generate PDF using pdfmake
    // Map invoice fields correctly: amount -> baseAmount, totalInvoiceValue -> totalAmount
    const pdfInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      orderType: invoice.orderType,
      transactionType: invoice.transactionType,
      customerName: invoice.userId?.name || invoice.customerName || 'Customer',
      customerEmail: invoice.userId?.email || invoice.customerEmail || '',
      customerPhone: invoice.userId?.phone || invoice.customerPhone || '',
      quantity: invoice.quantity,
      ratePerGram: invoice.ratePerGram,
      baseAmount: invoice.amount || 0, // Use 'amount' field from model (base amount without GST)
      gstRate: invoice.gstRate || 0,
      gstAmount: invoice.gstAmount || 0,
      totalAmount: invoice.totalInvoiceValue || 0, // Use 'totalInvoiceValue' field from model (final amount with GST)
      paymentMethod: invoice.paymentMethod || 'UPI',
      newBalance: invoice.newBalance || null, // May not exist for all invoices
      newINRBalance: invoice.newINRBalance || null, // May not exist for all invoices
      customerState: userState,
      customerAddress: customerAddressStr,
      createdAt: invoice.createdAt || invoice.invoiceDate
    };

    const pdfBuffer = await generateInvestmentInvoicePdf(pdfInvoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      status: false,
      message: 'Error generating PDF',
      error: error.message,
    });
  }
});

// @desc    Download invoice by order ID
// @route   GET /api/v0/investment-invoices/download-by-order/:orderId
// @access  Private
const downloadInvoiceByOrderId = asyncHandler(async (req, res) => {
  try {
    const invoice = await InvestmentInvoice.findOne({ orderId: req.params.orderId }).populate('userId', 'name email phone state address');

    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: 'Invoice not found for this order',
      });
    }

    // Get user state from populated userId
    const userState = invoice.userId?.state || '';
    const userAddress = invoice.userId?.address || '';
    const customerAddressStr = typeof userAddress === 'string' ? userAddress : (userAddress?.street || '');

    // Generate PDF using pdfmake
    // Map invoice fields correctly: amount -> baseAmount, totalInvoiceValue -> totalAmount
    const pdfInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      orderType: invoice.orderType,
      transactionType: invoice.transactionType,
      customerName: invoice.userId?.name || invoice.customerName || 'Customer',
      customerEmail: invoice.userId?.email || invoice.customerEmail || '',
      customerPhone: invoice.userId?.phone || invoice.customerPhone || '',
      quantity: invoice.quantity,
      ratePerGram: invoice.ratePerGram,
      baseAmount: invoice.amount || 0, // Use 'amount' field from model (base amount without GST)
      gstRate: invoice.gstRate || 0,
      gstAmount: invoice.gstAmount || 0,
      totalAmount: invoice.totalInvoiceValue || 0, // Use 'totalInvoiceValue' field from model (final amount with GST)
      paymentMethod: invoice.paymentMethod || 'UPI',
      newBalance: invoice.newBalance || null, // May not exist for all invoices
      newINRBalance: invoice.newINRBalance || null, // May not exist for all invoices
      customerState: userState,
      customerAddress: customerAddressStr,
      createdAt: invoice.createdAt || invoice.invoiceDate
    };

    const pdfBuffer = await generateInvestmentInvoicePdf(pdfInvoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      status: false,
      message: 'Error generating PDF',
      error: error.message,
    });
  }
});

module.exports = {
  createInvestmentInvoice,
  getInvoiceById,
  getInvoiceByOrderId,
  getUserInvoices,
  getAllInvoices,
  downloadInvoicePDF,
  downloadInvoiceByOrderId,
};

