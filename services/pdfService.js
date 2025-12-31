/**
 * PDF Generation Service using pdfmake
 * Replaces Puppeteer for lightweight PDF generation
 */

const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

// Use standard PDF fonts (built into PDF format, no external files needed)
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Initialize printer with standard fonts
const printer = new PdfPrinter(fonts);
console.log('📄 PDF Service initialized with Helvetica fonts');

// Load logo as base64
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '../public/logo/23.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64');
  }
} catch (err) {
  console.log('Logo not found for PDF generation');
}

/**
 * Generate PDF buffer from document definition
 * @param {Object} docDefinition - pdfmake document definition
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generatePdfBuffer = (docDefinition) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('📄 Creating PDF document...');
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('📄 PDF created successfully, size:', buffer.length, 'bytes');
        resolve(buffer);
      });
      pdfDoc.on('error', (err) => {
        console.error('📄 PDF generation error:', err);
        reject(err);
      });
      
      pdfDoc.end();
    } catch (err) {
      console.error('📄 PDF creation failed:', err);
      reject(err);
    }
  });
};

/**
 * Format currency in Indian format
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Format date
 */
const formatDate = (date) => {
  return new Date(date || new Date()).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Number to words converter
 */
const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';
  if (num < 0) return 'Negative ' + numberToWords(-num);
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  let result = '';
  
  if (num >= 10000000) {
    result += numberToWords(Math.floor(num / 10000000)).replace(' Rupees Only', '') + ' Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    result += numberToWords(Math.floor(num / 100000)).replace(' Rupees Only', '') + ' Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    result += numberToWords(Math.floor(num / 1000)).replace(' Rupees Only', '') + ' Thousand ';
    num %= 1000;
  }
  if (num >= 100) {
    result += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    result += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 10) {
    result += teens[num - 10] + ' ';
    num = 0;
  }
  if (num > 0) {
    result += ones[num] + ' ';
  }
  
  return result.trim() + ' Rupees Only';
};

/**
 * Generate Investment Invoice PDF - Exact design match
 */
const generateInvestmentInvoicePdf = async (invoiceData) => {
  // Helper to safely convert any value to string (handles ObjectIds, etc.)
  const safeStr = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && val.toString) return val.toString();
    return String(val);
  };

  const {
    invoiceNumber,
    orderId,
    orderType,
    transactionType,
    customerName,
    customerEmail,
    customerPhone,
    quantity,
    ratePerGram,
    baseAmount,
    gstRate,
    gstAmount,
    totalAmount,
    paymentMethod,
    newBalance,
    newINRBalance,
    createdAt
  } = invoiceData;

  // Ensure all string values are properly converted
  const invNum = safeStr(invoiceNumber) || 'N/A';
  const orderNum = safeStr(orderId) || 'N/A';
  const custName = safeStr(customerName) || 'Customer';
  const custEmail = safeStr(customerEmail) || '';
  const custPhone = safeStr(customerPhone) || '';

  const isBuy = orderType === 'buy';
  const productName = transactionType === 'GOLD' ? 'GOLD24' : 'SILVER';
  const goldColor = '#D4A84B';
  const lightGoldBg = '#F5EFE0';
  const grayBg = '#F8F8F8';

  const formatAmt = (amt) => {
    const num = parseFloat(amt) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDateShort = (date) => {
    return new Date(date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 9
    },
    content: [
      // Logo centered
      logoBase64 ? {
        image: `data:image/png;base64,${logoBase64}`,
        width: 30,
        alignment: 'center',
        margin: [0, 0, 0, 8]
      } : { text: 'PG', fontSize: 30, bold: true, color: goldColor, alignment: 'center', margin: [0, 0, 0, 8] },

      // Company Name
      { text: 'Precious Goldsmith', fontSize: 15, bold: true, color: goldColor, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: 'Digital Gold & Silver Investment Platform', fontSize: 9, color: goldColor, alignment: 'center', margin: [0, 0, 0, 20] },

      // Invoice Title Bar
      {
        table: {
          widths: ['*'],
          body: [[
            { text: `Invoice Statement - ${isBuy ? 'BUY' : 'SELL'} Order`, fontSize: 12, bold: true, color: '#333333', margin: [15, 10, 15, 10] }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => lightGoldBg
        },
        margin: [0, 0, 0, 20]
      },

      // Three Column Details Section
      {
        columns: [
          // Customer Details
          {
            width: '30%',
            stack: [
              { text: 'Customer Details', fontSize: 10, color: goldColor, margin: [0, 0, 0, 8] },
              { text: custName, fontSize: 9, bold: true, margin: [0, 0, 0, 3] },
              { text: custEmail || 'N/A', fontSize: 9, color: '#333', margin: [0, 0, 0, 3] },
              { text: custPhone || 'N/A', fontSize: 9, color: '#333', margin: [0, 0, 0, 3] },
              { text: isBuy ? 'DEPOSIT' : 'WITHDRAWAL', fontSize: 9, color: '#333' }
            ]
          },
          // Invoice Details
          {
            width: '35%',
            stack: [
              { text: 'Invoice Details', fontSize: 10, color: goldColor, margin: [0, 0, 0, 8] },
              { text: `Invoice No: ${invNum}`, fontSize: 9, margin: [0, 0, 0, 3] },
              { text: `Order ID: ${orderNum}`, fontSize: 9, margin: [0, 0, 0, 3] },
              { text: `Date: ${formatDateShort(createdAt)}`, fontSize: 9, margin: [0, 0, 0, 3] },
              { text: `Product: ${productName}`, fontSize: 9 }
            ]
          },
          // Company
          {
            width: '35%',
            stack: [
              { text: 'Company', fontSize: 10, color: goldColor, margin: [0, 0, 0, 8] },
              { text: 'KSAN Industries LLP', fontSize: 9, bold: true, margin: [0, 0, 0, 3] },
              { text: 'New No:46, Old No:70/1, Bazullah Road,', fontSize: 8, color: '#333' },
              { text: 'T Nagar, Chennai - 600017', fontSize: 8, color: '#333', margin: [0, 0, 0, 3] },
              { text: 'GSTIN: 33ABAFK98176AIZK', fontSize: 8, color: '#333', margin: [0, 0, 0, 2] },
              { text: 'PAN: ABAFK9817G', fontSize: 8, color: '#333', margin: [0, 0, 0, 2] },
              { text: 'CIN: AAP-8899', fontSize: 8, color: '#333', margin: [0, 0, 0, 2] },
              { text: 'support@preciousgoldsmith.com', fontSize: 8, color: '#333' }
            ]
          }
        ],
        margin: [0, 0, 0, 25]
      },

      // Horizontal line
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }], margin: [0, 0, 0, 15] },

      // Transaction Table
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 100, 80],
          body: [
            // Header row
            [
              { text: 'Description', fontSize: 9, bold: true, color: '#333', fillColor: lightGoldBg, margin: [8, 8, 8, 8] },
              { text: 'Qty(g)', fontSize: 9, bold: true, color: '#333', fillColor: lightGoldBg, alignment: 'center', margin: [8, 8, 8, 8] },
              { text: 'Rate/g', fontSize: 9, bold: true, color: '#333', fillColor: lightGoldBg, alignment: 'center', margin: [8, 8, 8, 8] },
              { text: 'Amount', fontSize: 9, bold: true, color: '#333', fillColor: lightGoldBg, alignment: 'right', margin: [8, 8, 8, 8] }
            ],
            // Product row
            [
              { text: productName, fontSize: 9, margin: [8, 10, 8, 10] },
              { text: quantity?.toString() || '0', fontSize: 9, alignment: 'center', margin: [8, 10, 8, 10] },
              { text: formatAmt(ratePerGram), fontSize: 9, alignment: 'center', margin: [8, 10, 8, 10] },
              { text: formatAmt(baseAmount), fontSize: 9, alignment: 'right', margin: [8, 10, 8, 10] }
            ],
            // GST row
            [
              { text: `GST(${isBuy ? gstRate || 3 : 0}%)`, fontSize: 9, margin: [8, 10, 8, 10] },
              { text: '', margin: [8, 10, 8, 10] },
              { text: '', margin: [8, 10, 8, 10] },
              { text: isBuy ? formatAmt(gstAmount) : '0.00', fontSize: 9, alignment: 'right', margin: [8, 10, 8, 10] }
            ]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.3,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC'
        },
        margin: [0, 0, 0, 0]
      },

      // Total row (separate table for styling)
      {
        table: {
          widths: ['*', 80],
          body: [
            [
              { text: 'Total', fontSize: 10, bold: true, fillColor: lightGoldBg, alignment: 'right', margin: [8, 10, 20, 10] },
              { text: `${formatAmt(totalAmount)}`, fontSize: 10, bold: true, fillColor: lightGoldBg, alignment: 'right', margin: [8, 10, 8, 10] }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC'
        },
        margin: [0, 0, 0, 25]
      },

      // Transaction Details Box
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Transaction Details', fontSize: 10, color: goldColor, margin: [0, 0, 0, 8] },
                { text: `ID: ${orderNum}`, fontSize: 9, bold: true, margin: [0, 0, 0, 4] },
                { text: `Mode: ${paymentMethod || 'Online Payment'}`, fontSize: 9, bold: true }
              ],
              margin: [12, 12, 12, 12]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => i === 0 ? 3 : 0,
          vLineColor: () => goldColor,
          fillColor: () => grayBg
        },
        margin: [0, 0, 0, 15]
      },

      // Declaration Box
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Declaration:', fontSize: 10, color: goldColor, margin: [0, 0, 0, 8] },
                {
                  ul: [
                    { text: 'We declare that the above quantity of goods are kept by the seller in a secure vault and the same is insured by the seller. The seller shall be liable to pay the customer the value of the goods in case of any loss or damage to the goods.', fontSize: 8, color: '#555', margin: [0, 0, 0, 5] },
                    { text: 'It can be delivered in a form of a minted coin upon request as per the Terms and Conditions.', fontSize: 8, color: '#555' }
                  ],
                  markerColor: '#555'
                }
              ],
              margin: [12, 12, 12, 12]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => i === 0 ? 3 : 0,
          vLineColor: () => goldColor,
          fillColor: () => grayBg
        },
        margin: [0, 0, 0, 30]
      },

      // Authorized Signatory - Right aligned
      // {
      //   columns: [
      //     { width: '*', text: '' },
      //     {
      //       width: 'auto',
      //       stack: [
      //         { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: '#333' }] },
      //         { text: 'Authorised Signatory', fontSize: 9, bold: true, alignment: 'right', margin: [0, 5, 0, 2] },
      //         { text: 'KSAN Industries LLP', fontSize: 8, alignment: 'right' }
      //       ]
      //     }
      //   ],
      //   margin: [0, 0, 0, 30]
      // },

      // Footer
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Thank you for choosing Precious Goldsmith', fontSize: 9, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
                { text: 'For queries: support@preciousgoldsmith.com', fontSize: 8, alignment: 'center', margin: [0, 0, 0, 5] },
                { text: 'This is a computer-generated invoice. No signature required.', fontSize: 7, color: '#888', alignment: 'center' }
              ],
              margin: [0, 15, 0, 15]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => grayBg
        }
      }
    ]
  };

  return generatePdfBuffer(docDefinition);
};

/**
 * Generate Product Order Invoice PDF - Professional Clean Design
 */
const generateOrderInvoicePdf = async (invoiceData) => {
  // Helper to safely convert any value to string (handles ObjectIds, etc.)
  const safeStr = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && val.toString) return val.toString();
    return String(val);
  };

  const {
    invoiceNumber,
    orderId,
    orderDate,
    customerName,
    customerEmail,
    customerPhone,
    billingAddress,
    shippingAddress,
    customerAddress,
    items,
    totalAmount,
    totalMakingCharges,
    totalGST,
    totalDiscount,
    subtotal,
    createdAt
  } = invoiceData;

  // Ensure all string values are properly converted
  const invNum = safeStr(invoiceNumber) || 'N/A';
  const orderNum = safeStr(orderId) || 'N/A';
  const custName = safeStr(customerName) || 'Customer';
  const custEmail = safeStr(customerEmail) || '';
  const custPhone = safeStr(customerPhone) || '';

  const goldColor = '#D4A84B';
  const lightGoldBg = '#F5EFE0';
  const grayBg = '#F8F8F8';

  const formatDateShort = (date) => {
    try {
      return new Date(date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };
  const formatDateLong = (date) => {
    try {
      return new Date(date || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };
  const formatAmt = (amt) => {
    const num = parseFloat(amt) || 0;
    return '' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals from items (use provided totals if available, otherwise calculate)
  let totalQty = 0;
  let totalWeight = 0;
  let calculatedMakingCharges = 0;
  let calculatedGst = 0;
  let calculatedDiscount = 0;
  let grandTotal = 0;

  // Process items
  (items || []).forEach((item) => {
    const qty = parseInt(item.quantity) || 1;
    const weight = parseFloat(item.weight) || 0;
    const makingCharges = parseFloat(item.makingCharges) || 0;
    const gst = parseFloat(item.gst) || 0;
    const discount = parseFloat(item.discount) || 0;
    const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;

    totalQty += qty;
    totalWeight += weight;
    calculatedMakingCharges += makingCharges;
    calculatedGst += gst;
    calculatedDiscount += discount;
    grandTotal += price;
  });

  // Use provided totals if available (from saved invoice), otherwise use calculated
  const finalMakingCharges = totalMakingCharges !== undefined ? totalMakingCharges : calculatedMakingCharges;
  const finalGst = totalGST !== undefined ? totalGST : calculatedGst;
  const finalDiscount = totalDiscount !== undefined ? totalDiscount : calculatedDiscount;
  const finalTotal = totalAmount || grandTotal;
  
  // Calculate subtotal after discount (for GST percentage calculation)
  // Subtotal = sum of (item totalPrice + making charges) for all items
  // Subtotal after discount = subtotal - discount
  // GST is calculated on subtotal after discount
  const calculatedSubtotal = (items || []).reduce((sum, item) => {
    const totalPrice = parseFloat(item.totalPrice) || (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 1);
    const makingCharges = parseFloat(item.makingCharges) || 0;
    return sum + totalPrice + makingCharges;
  }, 0);
  const finalSubtotal = subtotal !== undefined ? subtotal : calculatedSubtotal;
  const subtotalAfterDiscount = Math.max(0, finalSubtotal - finalDiscount);
  
  // Calculate GST percentage dynamically (GST is calculated on subtotal after discount)
  const gstPercentage = subtotalAfterDiscount > 0 ? ((finalGst / subtotalAfterDiscount) * 100) : 0;
  const cgstSgstPercentage = gstPercentage / 2; // Each CGST and SGST is half of total GST percentage

  // Build items table body
  const itemsBody = [
    // Header row
    [
      { text: 'SI\nNo', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Product Name', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'left', margin: [4, 4, 4, 4] },
      { text: 'Purity /\nHSN', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Qty', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Weight', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Making\nCharges', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'GST', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Discount', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'center', margin: [4, 4, 4, 4] },
      { text: 'Total ', fontSize: 8, bold: true, fillColor: lightGoldBg, alignment: 'right', margin: [4, 4, 4, 4] }
    ]
  ];

  // Add item rows
  (items || []).forEach((item, idx) => {
    const qty = parseInt(item.quantity) || 1;
    const weight = parseFloat(item.weight) || 0;
    const makingCharges = parseFloat(item.makingCharges) || 0;
    const gst = parseFloat(item.gst) || 0;
    const gstPercent = item.gstPercent || item.gstPercentage || '';
    const discount = parseFloat(item.discount) || 0;
    const discountPercent = item.discountPercent || item.discountPercentage || '';
    const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;

    itemsBody.push([
      { text: (idx + 1).toString(), fontSize: 9, alignment: 'center', margin: [4, 7, 4, 7] },
      { text: item.name || 'N/A', fontSize: 9, alignment: 'left', margin: [4, 7, 4, 7] },
      { text: `${item.purity || '22Karat'}\nHSN:\n711319`, fontSize: 7, alignment: 'center', margin: [2, 6, 2, 6] },
      { text: qty.toString(), fontSize: 9, alignment: 'center', margin: [4, 7, 4, 7] },
      { text: weight > 0 ? `${weight.toFixed(3)}g` : '-', fontSize: 9, alignment: 'center', margin: [4, 7, 4, 7] },
      { text: makingCharges > 0 ? formatAmt(makingCharges) : '-', fontSize: 8, alignment: 'center', margin: [2, 7, 2, 7] },
      { text: gst > 0 ? `${formatAmt(gst)}${gstPercent ? `\n(${gstPercent}%)` : ''}` : '-', fontSize: 8, alignment: 'center', margin: [2, 8, 2, 8] },
      { text: discount > 0 ? `${formatAmt(discount)}${discountPercent ? `\n(${discountPercent}%)` : ''}` : '-', fontSize: 8, alignment: 'center', margin: [2, 8, 2, 8] },
      { text: formatAmt(price), fontSize: 9, alignment: 'right', margin: [4, 7, 4, 7] }
    ]);
  });

  // Add TOTAL row
  itemsBody.push([
    { text: '', fillColor: lightGoldBg, margin: [4, 7, 4, 7] },
    { text: '', fillColor: lightGoldBg, margin: [4, 7, 4, 7] },
    { text: 'TOTAL', fontSize: 9, bold: true, alignment: 'right', fillColor: lightGoldBg, margin: [4, 7, 4, 7] },
    { text: totalQty.toString(), fontSize: 9, bold: true, alignment: 'center', fillColor: lightGoldBg, margin: [4, 7, 4, 7] },
    { text: `${totalWeight.toFixed(3)}g`, fontSize: 9, bold: true, alignment: 'center', fillColor: lightGoldBg, margin: [4, 7, 4, 7] },
    { text: finalMakingCharges > 0 ? formatAmt(finalMakingCharges) : '-', fontSize: 8, bold: true, alignment: 'center', fillColor: lightGoldBg, margin: [2, 7, 2, 7] },
    { text: finalGst > 0 ? formatAmt(finalGst) : '-', fontSize: 8, bold: true, alignment: 'center', fillColor: lightGoldBg, margin: [2, 7, 2, 7] },
    { text: finalDiscount > 0 ? formatAmt(finalDiscount) : '-', fontSize: 8, bold: true, alignment: 'center', fillColor: lightGoldBg, margin: [2, 7, 2, 7] },
    { text: formatAmt(finalTotal), fontSize: 9, bold: true, alignment: 'right', fillColor: lightGoldBg, margin: [4, 7, 4, 7] }
  ]);

  // Format address for display
  const formatAddr = (addr) => {
    if (!addr) return 'N/A';
    if (typeof addr === 'string') return addr;
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city + (addr.pincode ? ' - ' + addr.pincode : ''));
    if (addr.state) parts.push(addr.state + ' , India.');
    return parts.join('\n') || 'N/A';
  };

  // Check if address is in Tamil Nadu
  const isTamilNaduAddress = (addr) => {
    if (!addr) return false;
    const addrStr = typeof addr === 'string' 
      ? addr.toUpperCase() 
      : `${addr.state || ''} ${addr.city || ''} ${addr.street || ''}`.toUpperCase();
    return addrStr.includes('TAMILNADU') || addrStr.includes('TAMIL NADU') || addrStr.includes(' TN ') || addrStr.endsWith(' TN');
  };

  const billing = billingAddress || customerAddress;
  const shipping = shippingAddress || customerAddress;
  
  // Determine if GST should be split (Tamil Nadu) or shown as IGST (other states)
  const isTamilNadu = isTamilNaduAddress(billing) || isTamilNaduAddress(shipping);
  
  // Calculate CGST and SGST (split equally) or IGST
  const cgstAmount = isTamilNadu ? (finalGst / 2) : 0;
  const sgstAmount = isTamilNadu ? (finalGst / 2) : 0;
  const igstAmount = isTamilNadu ? 0 : finalGst;

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [35, 35, 35, 35],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 9
    },
    content: [
      // Logo centered
      logoBase64 ? {
        image: `data:image/png;base64,${logoBase64}`,
        width: 40,
        alignment: 'center',
        margin: [0, 0, 0, 10]
      } : { text: 'PG', fontSize: 30, bold: true, color: goldColor, alignment: 'center', margin: [0, 0, 0, 10] },

      // Company Name
      { text: 'PRECIOUS GOLDSMITH', fontSize: 15, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: 'KSAN INDUSTRIES LLP', fontSize: 10, alignment: 'center', color: '#444', margin: [0, 0, 0, 4] },
      { text: 'GSTIN NO: 33ABAFK98176AIZK', fontSize: 9, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
      { text: 'New No:46, Old No:70/1, Bazullah Road, T Nagar,\nChennai - 600017, Tamil Nadu, India.', fontSize: 8, alignment: 'center', color: '#555', margin: [0, 0, 0, 4] },
      { text: 'Email: contact@preciousgoldsmith.com | Website: preciousgoldsmith.com', fontSize: 7, color: '#666', alignment: 'center', margin: [0, 0, 0, 15] },

      // Horizontal line
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 525, y2: 0, lineWidth: 1, lineColor: '#333' }], margin: [0, 0, 0, 20] },

      // TAX INVOICE title
      { text: 'TAX INVOICE', fontSize: 14, bold: true, decoration: 'underline', alignment: 'center', margin: [0, 0, 0, 20] },

      // Invoice Details - 2 columns with better spacing
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: [{ text: 'Invoice No:  ', bold: true }, invNum], fontSize: 9, margin: [0, 0, 0, 6] },
              { text: [{ text: 'Invoice Date:  ', bold: true }, formatDateShort(createdAt)], fontSize: 9 }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: [{ text: 'Order No:  ', bold: true }, orderNum], fontSize: 9, alignment: 'right', margin: [0, 0, 0, 6] },
              { text: [{ text: 'Order Date:  ', bold: true }, formatDateLong(orderDate || createdAt)], fontSize: 9, alignment: 'right' }
            ]
          }
        ],
        margin: [0, 0, 0, 25]
      },

      // Customer Addresses - 2 columns
      {
        columns: [
          {
            width: '48%',
            stack: [
              { text: 'Customer Billing Address:', fontSize: 10, bold: true, decoration: 'underline', margin: [0, 0, 0, 10] },
              { text: custName, fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
              { text: formatAddr(billing), fontSize: 9, color: '#333', lineHeight: 1.4 }
            ]
          },
          { width: '4%', text: '' },
          {
            width: '48%',
            stack: [
              { text: 'Customer Shipping Address:', fontSize: 10, bold: true, decoration: 'underline', margin: [0, 0, 0, 10] },
              { text: custName, fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
              { text: formatAddr(shipping), fontSize: 9, color: '#333', lineHeight: 1.4 }
            ]
          }
        ],
        margin: [0, 0, 0, 25]
      },

      // Products Table
      {
        table: {
          headerRows: 1,
          widths: [22, '*', 40, 22, 42, 52, 48, 48, 58],
          body: itemsBody
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#AAAAAA',
          vLineColor: () => '#AAAAAA'
        },
        margin: [0, 0, 0, 15]
      },

      // Note box with gold left border
      {
        table: {
          widths: ['*'],
          body: [[
            {
              text: [{ text: 'Note: ', bold: true }, 'All prices shown are inclusive of GST, making charges, and any applicable discounts.'],
              fontSize: 8,
              color: '#555',
              margin: [10, 10, 10, 10]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => i === 0 ? 3 : 0,
          vLineColor: () => goldColor,
          fillColor: () => '#FFFDF5'
        },
        margin: [0, 0, 0, 20]
      },
      /// GST amount here - Show CGST/SGST for Tamil Nadu, IGST for other states
      isTamilNadu ? {
        columns: [
          {
            width: '50%',
            stack: [
              { text: `CGST (1.5%) : ` + formatAmt(cgstAmount), fontSize: 9, color: '#333', margin: [0, 0, 0, 5] },
              { text: `SGST (1.5%) : ` + formatAmt(sgstAmount), fontSize: 9, color: '#333' }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'Total GST Amount: ' + formatAmt(finalGst), fontSize: 9, bold: true, color: '#333', alignment: 'right', margin: [0, 0, 0, 5] },
              { text: `(CGST + SGST: 3%)`, fontSize: 8, color: '#666', alignment: 'right' }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      } : {
        text: `IGST (3%) : ` + formatAmt(igstAmount),
        fontSize: 9,
        color: '#333',
        margin: [0, 0, 0, 20]
      },
      // Invoice Amount and Total Amount Payable
      {
        columns: [
          {
            width: '55%',
            stack: [
              { text: 'Invoice Amount (In Words):', fontSize: 10, bold: true, margin: [0, 0, 0, 8] },
              { text: numberToWords(Math.round(finalTotal)), fontSize: 9, color: '#333', lineHeight: 1.4 }
            ]
          },
          {
            width: '45%',
            table: {
              widths: ['*'],
              body: [[
                {
                  stack: [
                    { text: 'Total Amount Payable', alignment: 'center', fontSize: 10, color: '#555', margin: [0, 12, 0, 6] },
                    { text: formatAmt(finalTotal), fontSize: 20, bold: true, color: goldColor, alignment: 'center', margin: [0, 0, 0, 12] }
                  ]
                }
              ]]
            },
            layout: {
              hLineWidth: () => 2,
              vLineWidth: () => 2,
              hLineColor: () => goldColor,
              vLineColor: () => goldColor
            }
          }
        ],
        margin: [0, 0, 0, 25]
      },

      // Terms and Conditions with gold left border
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Terms and Conditions:', fontSize: 10, bold: true, margin: [0, 0, 0, 10] },
                {
                  ol: [
                    { text: 'Refer our app/website for our detailed terms and policies.', fontSize: 8, color: '#444', margin: [0, 0, 0, 4] },
                    { text: 'Subject to Chennai Jurisdiction.', fontSize: 8, color: '#444', margin: [0, 0, 0, 4] },
                    { text: 'Weight tolerance of ±0.020 g per product is considered normal due to measurement fluctuations.', fontSize: 8, color: '#444', margin: [0, 0, 0, 4] },
                    { text: 'Any of our products sold can be verified for purity at any BIS-recognised Assaying & Hallmarking Centre.', fontSize: 8, color: '#444' }
                  ]
                }
              ],
              margin: [10, 12, 10, 12]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => i === 0 ? 3 : 0,
          vLineColor: () => goldColor,
          fillColor: () => grayBg
        },
        margin: [0, 0, 0, 25]
      },

      // Authorized Signatory
      // {
      //   columns: [
      //     { width: '*', text: '' },
      //     {
      //       width: 'auto',
      //       stack: [
      //         { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: '#333' }] },
      //         { text: 'Authorised Signatory', fontSize: 9, bold: true, alignment: 'right', margin: [0, 6, 0, 2] },
      //         { text: 'KSAN Industries LLP', fontSize: 8, color: '#555', alignment: 'right' }
      //       ]
      //     }
      //   ],
      //   margin: [0, 0, 0, 25]
      // },

      // Footer
      {
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'Thank you for choosing Precious Goldsmith', fontSize: 9, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
                { text: 'For queries: support@preciousgoldsmith.com', fontSize: 8, alignment: 'center', color: '#555', margin: [0, 0, 0, 6] },
                { text: 'This is a computer-generated invoice. No signature required.', fontSize: 7, color: '#888', alignment: 'center' }
              ],
              margin: [0, 15, 0, 15]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => grayBg
        }
      }
    ]
  };

  return generatePdfBuffer(docDefinition);
};

module.exports = {
  generatePdfBuffer,
  generateInvestmentInvoicePdf,
  generateOrderInvoicePdf,
  formatCurrency,
  formatDate,
  numberToWords,
  logoBase64
};

