const axios = require("axios");
const orderModel = require("../models/orderModel");
const productOrder = require("../models/commerce_order_model");
const transactionSchema = require("../models/transcationModel");
const InvestmentInvoice = require("../models/investmentInvoice_model");

const Shipment = require('../models/shipment_model');
const User = require('../models/userModel');
const Product = require('../models/product_model');
const bmcService = require('../services/bmcService');
const bvcService = require('../services/bvcService');
const { sendEmail, sendEmailWithAttachment } = require('../helpers/mailer');
const { generateOrderInvoicePdf, generateInvestmentInvoicePdf, logoBase64 } = require('../services/pdfService');
const twilio = require("twilio");

const fs = require('fs');
const { Cashfree, CFEnvironment } = require("cashfree-pg");
var cashfree = new Cashfree(
  CFEnvironment.PRODUCTION,
  process.env.CASHFREE_APP_ID_prod,
  process.env.CASHFREE_SECRET_prod
);
const userModel = require("../models/userModel");

// Initialize Twilio client for WhatsApp messaging
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// WhatsApp Content Template SID
// const WHATSAPP_TEMPLATE_SID = "HXf4af99bd1ba1e9a90b4b5fb2a872d441";
const WHATSAPP_TEMPLATE_SID = "HXf40a829bf471a210c132870232e28a42";

// Helper function to send WhatsApp message using Content Template
async function sendWhatsAppMessage(phoneNumber, orderCode, invoiceNumber, totalAmount) {
  try {
    // Format phone number (ensure it starts with +91 for India)
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      // Remove any leading zeros or country code if present
      formattedPhone = formattedPhone.replace(/^0+/, '').replace(/^91/, '');
      formattedPhone = `whatsapp:+91${formattedPhone}`;
    } else {
      formattedPhone = `whatsapp:${formattedPhone}`;
    }

    console.log(`📱 Sending WhatsApp message to: ${formattedPhone}`);

    // Send WhatsApp message using Content Template
    const message = await twilioClient.messages.create({
      from: `whatsapp:+919933661149`,
      to: formattedPhone,
      contentSid: WHATSAPP_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        "1": orderCode,           // Order Code
        "2": invoiceNumber,        // Invoice Number
        "3": `₹${parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` // Total Amount
      })
    });

    console.log(`✅ WhatsApp message sent successfully. SID: ${message.sid} ${message.body}`);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.message);
    // Don't throw error - WhatsApp is optional, order should still succeed
    return { success: false, error: error.message };
  }
}

// Helper function to generate order confirmation email HTML
function generateOrderConfirmationEmailHTML(order, customer, products, pricing, invoiceNumber) {
  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  const productRows = products.map(product => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${product.name}</strong><br>
        <span style="color: #666; font-size: 12px;">SKU: ${product.sku || 'N/A'} | Qty: ${product.quantity}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${formatCurrency(product.finalPrice)}
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4E4BC 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">Order Confirmed! 🎉</h1>
        <p style="color: #333; margin: 10px 0 0; font-size: 16px;">Thank you for shopping with Precious Goldsmith</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          Dear <strong>${customer.name || 'Valued Customer'}</strong>,
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Your order has been successfully placed! We're preparing your precious items with care and will notify you once shipped.
        </p>
        
        <!-- Order Info Box -->
        <div style="background: linear-gradient(135deg, #f8f4e8 0%, #fff9e6 100%); padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #D4AF37;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0;">
                <span style="color: #666;">Order Number:</span><br>
                <strong style="color: #D4AF37; font-size: 18px;">${order.orderCode}</strong>
              </td>
              <td style="padding: 5px 0; text-align: right;">
                <span style="color: #666;">Invoice Number:</span><br>
                <strong style="color: #333;">${invoiceNumber}</strong>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 10px 0 0;">
                <span style="color: #666;">Order Date:</span>
                <strong style="color: #333; margin-left: 10px;">${formatDate(new Date())}</strong>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Products Table -->
        <h3 style="color: #333; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; margin-top: 30px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${productRows}
        </table>
        
        <!-- Total Summary - Simple display since cart prices are final (include GST, charges, discounts) -->
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin-top: 20px;">
          <table style="width: 100%;">
            <tr style="border-top: 2px solid #D4AF37;">
              <td style="padding: 15px 0 8px; font-weight: bold; font-size: 18px; color: #333;">Total Amount:</td>
              <td style="padding: 15px 0 8px; text-align: right; font-weight: bold; font-size: 20px; color: #D4AF37;">${formatCurrency(pricing.grandTotal)}</td>
            </tr>
          </table>
          <p style="margin: 10px 0 0; font-size: 12px; color: #888; text-align: center;">
            (Inclusive of all taxes, making charges, and applicable discounts)
          </p>
        </div>
        
        <!-- Invoice Attachment Note -->
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 25px; text-align: center;">
          <p style="margin: 0; color: #1565c0;">
            📎 <strong>Your tax invoice is attached to this email as a PDF.</strong>
          </p>
        </div>
        
        <!-- Shipping Info -->
        <div style="margin-top: 25px; padding: 20px; border: 1px dashed #D4AF37; border-radius: 10px;">
          <h4 style="margin: 0 0 15px; color: #D4AF37;">📦 Shipping Information</h4>
          <p style="margin: 0; color: #555; line-height: 1.6;">
            Your order will be shipped within 2-3 business days. You will receive a tracking link via email once your order is dispatched.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
            Questions about your order? Contact us at<br>
            <a href="mailto:contact@preciousgoldsmith.com" style="color: #D4AF37;">contact@preciousgoldsmith.com</a>
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 20px;">
            This is an automated email. Please do not reply directly.<br>
            © ${new Date().getFullYear()} Precious Goldsmith. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

// Helper function to generate invoice PDF for order (uses pdfService)
async function generateOrderInvoicePDF(invoice, customerDetails, products, pricing) {
  // Helper to safely convert to string
  const toString = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'object' && val.toString) return val.toString();
    return String(val);
  };

  // Format shipping address if available
  let shippingAddr = customerDetails.shippingAddress || customerDetails.address;
  if (invoice.shippingDetails?.shippingAddress) {
    const addr = invoice.shippingDetails.shippingAddress;
    if (typeof addr === 'object') {
      shippingAddr = `${addr.street || ''}${addr.landmark ? ', ' + addr.landmark : ''}\n${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`;
    } else {
      shippingAddr = addr;
    }
  }

  // Format billing address
  let billingAddr = customerDetails.address;
  if (typeof billingAddr === 'object') {
    billingAddr = `${billingAddr.street || ''}\n${billingAddr.city || ''}, ${billingAddr.state || ''} - ${billingAddr.pincode || ''}`;
  }

  // Prepare data for pdfService - matching the exact invoice design
  const pdfInvoiceData = {
    invoiceNumber: toString(invoice.invoiceNumber),
    orderId: toString(invoice.orderId?.orderCode || invoice.orderId),
    orderDate: invoice.orderDate || invoice.createdAt,
    customerName: toString(customerDetails.name) || 'Customer',
    customerEmail: toString(customerDetails.email) || '',
    customerPhone: toString(customerDetails.phone) || '',
    billingAddress: billingAddr,
    shippingAddress: shippingAddr,
    customerAddress: billingAddr, // Fallback
    items: products.map(product => ({
      name: toString(product.name) || 'Product',
      purity: toString(product.purity) || '22Karat',
      quantity: parseInt(product.quantity) || 1,
      weight: parseFloat(product.weight) || 0,
      makingCharges: parseFloat(product.makingCharges) || 0,
      gst: parseFloat(product.gst) || 0,
      gstPercent: toString(product.gstPercentage || product.gstPercent) || '',
      discount: parseFloat(product.discount) || 0,
      discountPercent: toString(product.discountPercentage || product.discountPercent) || '',
      price: parseFloat(product.finalPrice) || parseFloat(product.price) || 0
    })),
    totalAmount: parseFloat(pricing.grandTotal) || 0,
    totalMakingCharges: parseFloat(pricing.totalMakingCharges) || 0,
    totalGST: parseFloat(pricing.totalGST) || 0,
    totalDiscount: parseFloat(pricing.totalDiscount) || 0,
    subtotal: parseFloat(pricing.subtotal) || 0,
    createdAt: invoice.createdAt || new Date()
  };

  console.log('📄 Generating order invoice PDF...');
  const pdfBuffer = await generateOrderInvoicePdf(pdfInvoiceData);
  console.log('📄 PDF generated, size:', pdfBuffer.length, 'bytes');
  
  return pdfBuffer;
}

// Helper function to generate Investment Invoice PDF (uses pdfService)
async function generateInvestmentInvoicePDF(invoiceData) {
  console.log('📄 Generating investment invoice PDF...');
  const pdfBuffer = await generateInvestmentInvoicePdf(invoiceData);
  console.log('📄 Investment Invoice PDF generated, size:', pdfBuffer.length, 'bytes');
  return pdfBuffer;
}


async function fetchLiveGoldPriceINR() {
  try {
    const response = await axios.get("https://www.goldapi.io/api/XAU/INR", {
      headers: {
        "x-access-token": "goldapi-4y761smdi9d802-io", // move to process.env in production
        "Content-Type": "application/json",
      },
    });

    // GoldAPI returns price in troy ounces; convert to grams
    if (response.data && response.data.price) {
      const pricePerOunce = parseFloat(response.data.price);
      const pricePerGram = +(pricePerOunce / 31.1035).toFixed(2); // 1 oz = 31.1035 g
      return pricePerGram;
    }
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
  }
  return null; // fallback if API fails
}
const depositINR = async (req, res) => {
  const amount = req.body.amount;
  const userId = req.user.id;
  try {
    const options = {
      amount: amount,
      currency: "INR",
      receipt: "order_receipt23",
    };
    // await razorpay.orders.create(options, async (err, result) => {
    //     if (err) res.status(201).json({ status: false, message: err });

    //     if (result) {
    //         console.log(result);
    //         const user = await userModel.findById({ _id: userId });
    //         const updatedBalance = +user.balanceINR + +result.amount;

    //         await userModel.findByIdAndUpdate({ _id: userId }, { balanceINR: updatedBalance })
    //         await orderModel.create({ userId, transactionType: "Deposit", asset: result.currency, amount: result.amount, hash: result.id })
    //         res.status(200).json({ status: true, message: result })
    //     };
    // })
  } catch (error) {
    res.status(500).json({ status: false, message: error });
  }
};

const withdrawINR = async (req, res) => {
  console.log(req.body);
};

const buyOrSellGold = async (req, res) => {
  const userId = req.user.id;
  const {
    orderType, // "buy" or "sell"
    transactionType, // "gold"
    product, // e.g., "Gold 24K"
    goldQty, // optional for buy
    gstAmount,
    goldPrice,
    Payment_method,
    inrAmount, // INR total for buy/sell
  } = req.body;

  try {
    const user = await userModel.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const orderId = `PGORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Ensure balances are numbers
    const currentGoldBalance = parseFloat(user.goldBalance) || 0;
    const currentINRBalance = parseFloat(user.balanceINR) || 0;

    if (orderType === "buy") {
      const newGoldBalance = +(currentGoldBalance + parseFloat(goldQty)).toFixed(4);

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance,
      });

      await transactionSchema.create({
        userId,
        orderId,
        orderType,
        transactionType,
        gst_value: parseFloat(gstAmount),
        goldCurrentPrice: parseFloat(goldPrice),
        goldQtyInGm: parseFloat(goldQty),
        Payment_method,
        inramount: parseFloat(inrAmount),
        status: "created",
      });

      // Create invoice for this order
      let invoiceNumber = `INV-BUY-${Date.now()}`;
      try {
        console.log(`🔄 Attempting to create invoice for order: ${orderId}`);
        console.log(`User details - Name: ${user.name}, Email: ${user.email}, Phone: ${user.phone}`);

        const invoiceData = {
          orderId,
          userId,
          customerName: user.name || 'Customer',
          customerEmail: user.email || 'noemail@example.com',
          customerPhone: user.phone || '0000000000',
          orderType: 'buy',
          transactionType: transactionType.toUpperCase(),
          product: transactionType.toUpperCase() === 'GOLD' ? 'GOLD24' : 'SILVER',
          quantity: parseFloat(goldQty),
          ratePerGram: parseFloat(goldPrice),
          amount: parseFloat(inrAmount) - parseFloat(gstAmount),
          gstRate: 3,
          gstAmount: parseFloat(gstAmount),
          totalInvoiceValue: parseFloat(inrAmount),
          paymentMethod: Payment_method,
          transactionId: orderId,
          status: 'issued',
        };

        console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));

        const invoice = await InvestmentInvoice.create(invoiceData);
        invoiceNumber = invoice.invoiceNumber;
        console.log(`✅ Invoice created successfully: ${invoice.invoiceNumber} for order: ${orderId}`);
      } catch (invoiceError) {
        console.error(`❌ Error creating invoice for order ${orderId}:`, invoiceError.message);
        console.error('Full error:', invoiceError);
        // Don't fail the order if invoice creation fails
      }

      // Send confirmation email with Investment Invoice PDF
      try {
        console.log('📧 Generating investment invoice PDF for BUY order:', orderId);
        
        // Generate Investment Invoice PDF
        const pdfBuffer = await generateInvestmentInvoicePDF({
          invoiceNumber,
          orderId,
          orderType: 'buy',
          transactionType: transactionType.toUpperCase(),
          customerName: user.name || 'Customer',
          customerEmail: user.email || 'noemail@example.com',
          customerPhone: user.phone || '0000000000',
          quantity: parseFloat(goldQty),
          ratePerGram: parseFloat(goldPrice),
          baseAmount: parseFloat(inrAmount) - parseFloat(gstAmount),
          gstRate: 3,
          gstAmount: parseFloat(gstAmount),
          totalAmount: parseFloat(inrAmount),
          paymentMethod: Payment_method,
          newBalance: newGoldBalance,
          createdAt: new Date()
        });

        const emailSubject = `${transactionType.toUpperCase()} Purchase Confirmation - Order #${orderId}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4E4BC 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #1a1a1a; margin: 0;">Purchase Successful!</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; color: #333;">Dear <strong>${user.name || 'Valued Customer'}</strong>,</p>
              <p style="font-size: 16px; color: #333;">Your ${transactionType.toUpperCase()} purchase has been completed successfully.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #D4AF37; margin-top: 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Order ID:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${orderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Invoice Number:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Transaction Type:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">BUY ${transactionType.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Quantity:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${goldQty} grams</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">${transactionType.toUpperCase()} Price (per gram):</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">₹${parseFloat(goldPrice).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">GST (3%):</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">₹${parseFloat(gstAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Payment Method:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${Payment_method}</td>
                  </tr>
                  <tr style="background-color: #D4AF37;">
                    <td style="padding: 15px 10px; color: #1a1a1a; font-weight: bold; font-size: 18px;">Total Amount Paid:</td>
                    <td style="padding: 15px 10px; color: #1a1a1a; font-weight: bold; text-align: right; font-size: 18px;">₹${parseFloat(inrAmount).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32; font-weight: bold;">✓ Your updated ${transactionType.toUpperCase()} balance: ${newGoldBalance} grams</p>
              </div>

              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #1565c0;">📎 <strong>Your investment invoice is attached to this email as a PDF.</strong></p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 20px;">Thank you for investing with Precious Goldsmith. Your digital ${transactionType.toLowerCase()} is securely stored in your account.</p>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
                <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} Precious Goldsmith. All rights reserved.</p>
              </div>
            </div>
          </div>
        `;
        
        await sendEmailWithAttachment(
          user.email,
          emailSubject,
          emailHtml,
          user.name || 'Customer',
          pdfBuffer,
          `Investment-Invoice-${invoiceNumber}.pdf`
        );
        console.log(`✅ Purchase confirmation email with invoice PDF sent to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Error sending purchase confirmation email:`, emailError.message);
        // Don't fail the order if email fails
      }

      return res.status(201).json({
        status: true,
        message: `Bought ${goldQty}g gold for ₹${inrAmount} (₹${gstAmount} GST applied)`,
        goldBalance: newGoldBalance,
        createdAt: Date.now(),
        orderId: orderId,
        Payment_method: Payment_method
      });
    }

    else if (orderType === "sell") {
      if (currentGoldBalance < goldQty) {
        return res.status(400).json({ status: false, message: "Insufficient gold balance" });
      }

      const receivedAmount = parseFloat(inrAmount);
      const newGoldBalance = +(currentGoldBalance - parseFloat(goldQty)).toFixed(4);
      const newINRBalance = +(currentINRBalance + receivedAmount).toFixed(2);

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
      });

      await transactionSchema.create({
        userId,
        orderId,
        orderType,
        transactionType,
        gst_value: parseFloat(gstAmount),
        goldCurrentPrice: parseFloat(goldPrice),
        goldQtyInGm: parseFloat(goldQty),
        Payment_method,
        inramount: receivedAmount,
        status: "created",
      });

      // Create invoice for this order
      let invoiceNumberSell = `INV-SELL-${Date.now()}`;
      try {
        console.log(`🔄 Attempting to create invoice for SELL order: ${orderId}`);
        console.log(`User details - Name: ${user.name}, Email: ${user.email}, Phone: ${user.phone}`);

        const invoiceData = {
          orderId,
          userId,
          customerName: user.name || 'Customer',
          customerEmail: user.email || 'noemail@example.com',
          customerPhone: user.phone || '0000000000',
          orderType: 'sell',
          transactionType: transactionType.toUpperCase(),
          product: transactionType.toUpperCase() === 'GOLD' ? 'GOLD24' : 'SILVER',
          quantity: parseFloat(goldQty),
          ratePerGram: parseFloat(goldPrice),
          amount: receivedAmount,
          gstRate: 0,
          gstAmount: parseFloat(gstAmount),
          totalInvoiceValue: receivedAmount,
          paymentMethod: Payment_method,
          transactionId: orderId,
          status: 'issued',
        };

        console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));

        const invoice = await InvestmentInvoice.create(invoiceData);
        invoiceNumberSell = invoice.invoiceNumber;
        console.log(`✅ Invoice created successfully: ${invoice.invoiceNumber} for SELL order: ${orderId}`);
      } catch (invoiceError) {
        console.error(`❌ Error creating invoice for SELL order ${orderId}:`, invoiceError.message);
        console.error('Full error:', invoiceError);
        // Don't fail the order if invoice creation fails
      }

      // Send confirmation email with Investment Invoice PDF
      try {
        console.log('📧 Generating investment invoice PDF for SELL order:', orderId);
        
        // Generate Investment Invoice PDF
        const pdfBuffer = await generateInvestmentInvoicePDF({
          invoiceNumber: invoiceNumberSell,
          orderId,
          orderType: 'sell',
          transactionType: transactionType.toUpperCase(),
          customerName: user.name || 'Customer',
          customerEmail: user.email || 'noemail@example.com',
          customerPhone: user.phone || '0000000000',
          quantity: parseFloat(goldQty),
          ratePerGram: parseFloat(goldPrice),
          baseAmount: parseFloat(goldQty) * parseFloat(goldPrice),
          gstRate: 0,
          gstAmount: parseFloat(gstAmount),
          totalAmount: receivedAmount,
          paymentMethod: Payment_method,
          newBalance: newGoldBalance,
          newINRBalance: newINRBalance,
          createdAt: new Date()
        });

        const emailSubject = `${transactionType.toUpperCase()} Sale Confirmation - Order #${orderId}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4E4BC 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #1a1a1a; margin: 0;">Sale Successful!</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; color: #333;">Dear <strong>${user.name || 'Valued Customer'}</strong>,</p>
              <p style="font-size: 16px; color: #333;">Your ${transactionType.toUpperCase()} sale has been completed successfully.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #D4AF37; margin-top: 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Transaction Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Order ID:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${orderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Invoice Number:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${invoiceNumberSell}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Transaction Type:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">SELL ${transactionType.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Quantity Sold:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${goldQty} grams</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">${transactionType.toUpperCase()} Price (per gram):</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">₹${parseFloat(goldPrice).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">GST Deducted:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">₹${parseFloat(gstAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style="background-color: #4CAF50;">
                    <td style="padding: 15px 10px; color: #ffffff; font-weight: bold; font-size: 18px;">Amount Received:</td>
                    <td style="padding: 15px 10px; color: #ffffff; font-weight: bold; text-align: right; font-size: 18px;">₹${parseFloat(receivedAmount).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #e65100; font-weight: bold;">📊 Your Updated Balances:</p>
                <p style="margin: 5px 0; color: #333;">• ${transactionType.toUpperCase()} Balance: <strong>${newGoldBalance} grams</strong></p>
                <p style="margin: 5px 0; color: #333;">• INR Wallet Balance: <strong>₹${newINRBalance.toLocaleString('en-IN')}</strong></p>
              </div>

              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #1565c0;">📎 <strong>Your investment invoice is attached to this email as a PDF.</strong></p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 20px;">Thank you for using Precious Goldsmith. The amount has been credited to your INR wallet.</p>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
                <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} Precious Goldsmith. All rights reserved.</p>
              </div>
            </div>
          </div>
        `;
        
        await sendEmailWithAttachment(
          user.email,
          emailSubject,
          emailHtml,
          user.name || 'Customer',
          pdfBuffer,
          `Investment-Invoice-${invoiceNumberSell}.pdf`
        );
        console.log(`✅ Sale confirmation email with invoice PDF sent to ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Error sending sale confirmation email:`, emailError.message);
        // Don't fail the order if email fails
      }

      return res.status(201).json({
        status: true,
        message: `Sold ${goldQty}g gold for ₹${receivedAmount} (₹${gstAmount} GST deducted)`,
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
        createdAt: Date.now(),
        orderId: orderId,
        Payment_method: Payment_method
      });
    }

    else {
      return res.status(400).json({ status: false, message: "Invalid order type" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: error.message });
  }
};

const getAllOrderHistory = async (req, res) => {
  try {
    const orders = await transactionSchema.find({});
    res.status(200).json({
      status: true,
      message: "All order history fetched successfully",
      details: orders,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// ==========================
// 2. SINGLE USER ORDER HISTORY
// ==========================
const getUserOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    // const userId = "6895539eb12327731f85535f";

    if (!userId) {
      return res
        .status(400)
        .json({ status: false, message: "User ID missing" });
    }

    const orders = await transactionSchema.find({ userId });
    res.status(200).json({
      status: true,
      message: "User order history fetched successfully",
      details: orders,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// ==========================
// 3. PARTICULAR ORDER HISTORY
// ==========================
const getParticularOrderHistory = async (req, res) => {
  try {

    console.log("order", req.body)
    const { orderId } = req.body;

    console.log("order", orderId)
    if (!orderId) {
      return res
        .status(400)
        .json({ status: false, message: "Order ID missing" });
    }

    const order = await orderModel.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }

    res.status(200).json({
      status: true,
      message: "Order details fetched successfully",
      details: order,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};




// Place Order
const placeOrder = async (req, res) => {
  try {
    const { items, totalAmount, deliveryAddress,name,phone,street,
city,
state,
pincode,
landmark, } = req.body;

    console.log(deliveryAddress, req.user.id,);
    // console.log(deliveryAddress.name,deliveryAddress.phone,deliveryAddress.street,deliveryAddress.city,deliveryAddress.state,deliveryAddress.pincode,deliveryAddress.landmark,deliveryAddress.type);
    const orderId = `PGCOM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const order = new productOrder({
      user: req.user.id,
      orderCode: orderId,
      items,
      totalAmount,
      deliveryAddress
    });

    await order.save();

    // Parse delivery address - prioritize direct fields from req.body, then deliveryAddress object/string
    // This needs to be outside try-catch blocks so it's accessible for both shipment and invoice creation
    let parsedDeliveryAddress = null;
    
    // Try to parse deliveryAddress if it's a JSON string
    if (deliveryAddress) {
      if (typeof deliveryAddress === 'string') {
        try {
          parsedDeliveryAddress = JSON.parse(deliveryAddress);
          console.log('✅ Parsed deliveryAddress JSON:', parsedDeliveryAddress);
        } catch (e) {
          // Not JSON, keep as string
          console.log('⚠️ deliveryAddress is not valid JSON:', e.message);
          parsedDeliveryAddress = null;
        }
      } else if (typeof deliveryAddress === 'object') {
        parsedDeliveryAddress = deliveryAddress;
        console.log('✅ Using deliveryAddress as object:', parsedDeliveryAddress);
      }
    }
    
    // Debug: Log what we have
    console.log('📦 Address Fields from req.body:', { name, phone, street, city, state, pincode, landmark });
    console.log('📦 Parsed deliveryAddress:', parsedDeliveryAddress);

    // Get customer details once (used in both shipment and invoice creation)
      const customer = await User.findById(req.user.id);

    // Automatically create shipment with BMC integration
    try {
      if (customer) {
        console.log('🚀 Starting BMC shipment creation for order:', order.orderCode);

        // Prepare items with product names
        const orderItems = await Promise.all(items.map(async (item) => {
          const product = await Product.findById(item.productDataid);
          return {
            name: product ? product.name : 'Product',
            quantity: item.quantity,
            price: item.price,
          };
        }));

        // Use direct fields from req.body first, then parsed deliveryAddress, then customer address
        // Priority: req.body fields > parsedDeliveryAddress fields > customer address > defaults
        let addressLine1 = street;
        let addressLine2 = landmark;
        let addressCity = city;
        let addressState = state;
        let addressPincode = pincode;
        
        // If req.body fields are missing, use parsedDeliveryAddress
        if (!addressLine1 || addressLine1.trim() === '') {
          addressLine1 = parsedDeliveryAddress?.street || parsedDeliveryAddress?.addressLine1 || parsedDeliveryAddress?.address || null;
        }
        if (!addressLine2 || addressLine2.trim() === '') {
          addressLine2 = parsedDeliveryAddress?.landmark || parsedDeliveryAddress?.addressLine2 || "";
        }
        if (!addressCity || addressCity.trim() === '') {
          addressCity = parsedDeliveryAddress?.city || null;
        }
        if (!addressState || addressState.trim() === '') {
          addressState = parsedDeliveryAddress?.state || null;
        }
        if (!addressPincode || addressPincode.trim() === '') {
          addressPincode = parsedDeliveryAddress?.pincode || parsedDeliveryAddress?.zipcode || null;
        }
        
        // Final fallback to customer address, then defaults
        const addressData = {
          addressLine1: addressLine1 || (customer.address && customer.address.length > 0 ? customer.address[0].street : null) || "N/A",
          addressLine2: addressLine2 || "",
          city: addressCity || (customer.address && customer.address.length > 0 ? customer.address[0].city : null) || "Chennai",
          state: addressState || (customer.address && customer.address.length > 0 ? customer.address[0].state : null) || "Tamil Nadu",
          pincode: addressPincode || (customer.address && customer.address.length > 0 ? customer.address[0].pincode : null) || "600091",
        };
        
        // Final validation - ensure no undefined or empty required fields
        if (!addressData.addressLine1 || addressData.addressLine1 === "N/A" || addressData.addressLine1.trim() === '') {
          addressData.addressLine1 = "N/A";
        }
        if (!addressData.city || addressData.city.trim() === '') {
          addressData.city = "Chennai";
        }
        if (!addressData.state || addressData.state.trim() === '') {
          addressData.state = "Tamil Nadu";
        }
        if (!addressData.pincode || addressData.pincode.trim() === '') {
          addressData.pincode = "600091";
        }
        
        console.log('✅ Final addressData:', addressData);

        // Use delivery person name and phone if provided, otherwise use customer details
        const recipientName = name || parsedDeliveryAddress?.name || customer.name || "Customer";
        const recipientPhone = phone || parsedDeliveryAddress?.phone || customer.phone || "0000000000";

        // Calculate total weight (estimate based on items)
        const estimatedWeight = orderItems.length * 0.5; // 0.5 kg per item average

        // Check if COD order
        const isCOD = items.some(item => item.paymentMode === 'COD') || false;
        const codAmount = isCOD ? totalAmount : 0;

        // Create BMC shipment
        let bmcResponse = null;
        let trackingNumber = null;
        let courierService = "Blue Mountain Courier";

        try {
          bmcResponse = await bmcService.createShipment({
            orderId: order._id.toString(),
            orderCode: order.orderCode,
            customerName: recipientName, // Use delivery person name
            customerPhone: recipientPhone, // Use delivery person phone
            customerEmail: customer.email || "",
            deliveryAddress: addressData,
            items: orderItems,
            totalAmount: totalAmount,
            codAmount: codAmount,
            weight: estimatedWeight,
            packageCount: orderItems.length,
          });

          if (bmcResponse && bmcResponse.success) {
            trackingNumber = bmcResponse.awbNumber || bmcResponse.trackingNumber;
            console.log('✅ BMC Shipment Created - AWB:', trackingNumber);
          } else {
            console.log('⚠️ BMC API returned non-success:', bmcResponse);
            // Fall back to manual tracking number
            trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            bmcResponse = null; // Set to null to indicate failure
          }
        } catch (bmcError) {
          console.error('❌ BMC Shipment Creation Failed:', bmcError.message);
          // Fall back to manual tracking number
          trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          courierService = "Delhivery"; // Fallback courier
          bmcResponse = null; // Ensure bmcResponse is null on error
        }

        // Calculate estimated delivery date (5-7 days from now)
        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 6);
        
        // Create shipment record in database (matching Shipment model schema)
        const shipment = new Shipment({
          orderId: order._id,
          orderCode: order.orderCode,
          userId: req.user.id,
          docketNo: trackingNumber, // Use docketNo for tracking number
          awbNo: trackingNumber, // Also store as awbNo
          customerName: recipientName, // Use delivery person name (required)
          customerPhone: recipientPhone, // Use delivery person phone (required)
          customerEmail: customer.email || "",
          deliveryAddress: {
            addressLine1: addressData.addressLine1, // Required
            addressLine2: addressData.addressLine2 || "",
            city: addressData.city, // Required
            state: addressData.state, // Required
            pincode: addressData.pincode, // Required
            landmark: landmark || parsedDeliveryAddress?.landmark || "",
          },
          packageDetails: {
            weight: estimatedWeight, // in KG
            noOfPieces: orderItems.length,
          },
          items: orderItems.map(item => ({
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          paymentMode: isCOD ? "COD" : "PREPAID",
          codAmount: codAmount,
          totalAmount: totalAmount, // Required
          serviceType: "Express",
          status: "PENDING",
          estimatedDeliveryDate: estimatedDeliveryDate,
          trackingHistory: [
            {
              status: "PENDING",
              description: (bmcResponse && bmcResponse.success)
                ? `Order placed successfully with ${courierService}. AWB: ${trackingNumber}`
                : "Order placed successfully, shipment will be processed soon",
              timestamp: new Date(),
              updatedBy: "System",
            },
          ],
        });

        await shipment.save();
        console.log('✅ Shipment record created in database:', shipment._id);
        
        // Call BVC tracking API to get DocketTrackList and update trackingHistory
        // Use trackingNumber as docketNo if available
        if (trackingNumber && trackingNumber.trim() !== '') {
          try {
            console.log('🔍 Calling BVC trackShipment for docket:', trackingNumber);
            const trackingData = await bvcService.trackShipment(trackingNumber);
            
            if (trackingData && trackingData.success) {
              // Update shipment with BVC tracking data
              shipment.docketNo = trackingData.docketNo || trackingNumber;
              shipment.bvcStatus = trackingData.status;
              shipment.bvcTrackingCode = trackingData.statusCode;
              
              // Map BVC orderStatus to valid Shipment model status enum
              // Shipment model accepts: PENDING, CREATED, PICKUP_SCHEDULED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED
              const statusMap = {
                'PICKUP_SCHEDULED': 'PICKUP_SCHEDULED',
                'PICKED_UP': 'PICKED_UP',
                'IN_TRANSIT': 'IN_TRANSIT',
                'OUT_FOR_DELIVERY': 'OUT_FOR_DELIVERY',
                'DELIVERED': 'DELIVERED',
                'FAILED': 'FAILED',
                'CANCELLED': 'CANCELLED',
                'RTO_INITIATED': 'RTO_INITIATED',
                'RTO_IN_TRANSIT': 'RTO_IN_TRANSIT',
                'RTO_DELIVERED': 'RTO_DELIVERED',
                'PROCESSING': 'CREATED', // Map PROCESSING to CREATED
                'PENDING': 'PENDING',
                'CREATED': 'CREATED',
              };
              
              const mappedStatus = trackingData.orderStatus 
                ? (statusMap[trackingData.orderStatus] || shipment.status)
                : shipment.status;
              
              // Only update if mapped status is valid for Shipment model
              const validStatuses = ['PENDING', 'CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED', 'CANCELLED'];
              if (validStatuses.includes(mappedStatus)) {
                shipment.status = mappedStatus;
              } else {
                console.warn(`⚠️ Invalid status from BVC: ${trackingData.orderStatus}, keeping current status: ${shipment.status}`);
              }
              
              // Add DocketTrackList to trackingHistory
              if (trackingData.trackingHistory && trackingData.trackingHistory.length > 0) {
                // Merge with existing tracking history (avoid duplicates)
                const existingHistory = shipment.trackingHistory || [];
                const newHistoryEntries = trackingData.trackingHistory.map((entry) => ({
                  status: entry.status,
                  statusCode: entry.statusCode,
                  description: entry.status,
                  location: entry.city || '',
                  city: entry.city || '',
                  timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
                  updatedBy: 'BVC System',
                }));
                
                // Combine and remove duplicates based on timestamp and status
                const combinedHistory = [...existingHistory, ...newHistoryEntries];
                const uniqueHistory = combinedHistory.filter((entry, index, self) => 
                  index === self.findIndex((e) => 
                    e.timestamp?.getTime() === entry.timestamp?.getTime() && 
                    e.status === entry.status
                  )
                );
                
                // Sort by timestamp (oldest first)
                uniqueHistory.sort((a, b) => {
                  const timeA = a.timestamp?.getTime() || 0;
                  const timeB = b.timestamp?.getTime() || 0;
                  return timeA - timeB;
                });
                
                shipment.trackingHistory = uniqueHistory;
              }
              
              // Store raw BVC tracking response
              shipment.bvcTrackResponse = trackingData.rawResponse;
              
              await shipment.save();
              console.log('✅ Shipment tracking history updated from BVC');
              
              // Update order status with DocketStatus
              if (trackingData.orderStatus) {
                // Map BVC order status to order model status enum
                // Order model accepts: PLACED, CONFIRMED, SHIPPED, DELIVERED, RETURNED, REFUNDED, RETURN_IN_PROGRESS, REFUND_IN_PROGRESS
                const statusMap = {
                  'PICKUP_SCHEDULED': 'CONFIRMED',
                  'PICKED_UP': 'CONFIRMED',
                  'IN_TRANSIT': 'SHIPPED',
                  'OUT_FOR_DELIVERY': 'SHIPPED',
                  'DELIVERED': 'DELIVERED',
                  'FAILED': 'FAILED',
                  'CANCELLED': 'CANCELLED',
                  'RTO_INITIATED': 'RETURN_IN_PROGRESS',
                  'RTO_IN_TRANSIT': 'RETURN_IN_PROGRESS',
                  'RTO_DELIVERED': 'RETURNED',
                  'PROCESSING': 'CONFIRMED',
                };
                
                const mappedStatus = statusMap[trackingData.orderStatus] || order.status;
                // Only update if the mapped status is valid for the order model
                const validStatuses = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'FAILED','CANCELLED','RETURNED', 'REFUNDED', 'RETURN_IN_PROGRESS', 'REFUND_IN_PROGRESS'];
                if (validStatuses.includes(mappedStatus) && mappedStatus !== order.status) {
                  order.status = mappedStatus;
                  await order.save();
                  console.log(`✅ Order status updated to: ${mappedStatus} (from BVC status: ${trackingData.status}, orderStatus: ${trackingData.orderStatus})`);
                }
              }
            } else {
              console.log('⚠️ BVC tracking returned non-success, skipping update');
            }
          } catch (trackingError) {
            console.error('❌ Error calling BVC trackShipment:', trackingError.message);
            // Don't fail the order if tracking fails - it's optional
          }
        } else {
          console.log('⚠️ No tracking number available, skipping BVC tracking');
        }
    
        // Update order with shipment reference (optional)
        order.shipmentId = shipment._id;
        await order.save();
      }
    } catch (shipmentError) {
      console.error('❌ Error in shipment creation flow:', shipmentError);
    }

    // Automatically create invoice for the order
    try {
      const Invoice = require('../models/invoice_model');
      const Product = require('../models/product_model');

      // Use customer already fetched above (customer is defined in outer scope)
      if (customer) {
        // Prepare customer details - use delivery person details if provided, otherwise customer details
        const customerDetails = {
          name: name || parsedDeliveryAddress?.name || customer.name || 'N/A',
          email: customer.email,
          phone: phone || parsedDeliveryAddress?.phone || customer.phone || 'N/A',
          address: {
            street: street || parsedDeliveryAddress?.street || (customer.address && customer.address.length > 0 ? customer.address[0].street : 'N/A'),
            city: city || parsedDeliveryAddress?.city || (customer.address && customer.address.length > 0 ? customer.address[0].city : 'N/A'),
            state: state || parsedDeliveryAddress?.state || (customer.address && customer.address.length > 0 ? customer.address[0].state : 'N/A'),
            pincode: pincode || parsedDeliveryAddress?.pincode || (customer.address && customer.address.length > 0 ? customer.address[0].pincode : 'N/A')
          }
        };

        // Prepare products with detailed pricing and complete product data
        // IMPORTANT: Use cart prices (orderItem.price) as they are FINAL prices (already include GST, making charges, discounts)
        const products = await Promise.all(items.map(async (orderItem) => {
          const product = await Product.findById(orderItem.productDataid);
          if (!product) {
            throw new Error(`Product not found: ${orderItem.productDataid}`);
          }

          // Extract detailed product information
          const productDetails = product.productDetails || [];
          const priceDetails = product.priceDetails || [];

          // Get weight and purity from product details
          let weight = 0;
          let purity = '22Karat';
          let metalType = 'gold';

          // Try to extract weight and purity from productDetails first
          productDetails.forEach(detail => {
            if (detail.type === 'Metal') {
              if (detail.attributes && detail.attributes['Gross Weight']) {
                const weightStr = String(detail.attributes['Gross Weight']).replace('g', '').trim();
                weight = parseFloat(weightStr) || 0;
              }
              if (detail.attributes && detail.attributes.Karatage) {
                purity = detail.attributes.Karatage;
              }
              if (detail.attributes && detail.attributes.Material) {
                metalType = detail.attributes.Material.toLowerCase();
              }
            }
          });

          // Extract GST, Discount, and Weight from priceDetails
          let gstValue = 0;
          let gstPercentage = 0;
          let discountValue = 0;
          let discountPercentage = 0;
          let makingChargesValue = 0;
          let goldValue = 0;

          priceDetails.forEach(price => {
            if (price.name === 'GST') {
              gstValue = parseFloat(price.value) || 0;
              // Extract percentage from weight field if available (e.g., "2.97%" or "3%")
              if (price.weight && String(price.weight).includes('%')) {
                gstPercentage = parseFloat(String(price.weight).replace('%', '')) || 0;
              }
            } else if (price.name === 'Discount') {
              discountValue = parseFloat(price.value) || 0;
              if (price.weight && String(price.weight).includes('%')) {
                discountPercentage = parseFloat(String(price.weight).replace('%', '')) || 0;
              }
            } else if (price.name === 'Making Charges') {
              makingChargesValue = parseFloat(price.value) || 0;
            } else if (price.name === 'Gold' || price.name === 'Silver') {
              goldValue += parseFloat(price.value) || 0; // Add up gold and silver values
            } else if (price.name === 'Sub Total') {
              // Extract weight from Sub Total row - format: "5.900g Gross Wt." or "8.000g Gross Wt."
              if (price.weight && weight === 0) {
                const weightMatch = String(price.weight).match(/(\d+\.?\d*)\s*g/i);
                if (weightMatch) {
                  weight = parseFloat(weightMatch[1]) || 0;
                  console.log(`📦 Extracted weight from Sub Total: ${weight}g for product: ${product.name}`);
                }
              }
            }
          });
          
          // If still no weight, try to get from product's direct weight field
          if (weight === 0 && product.weight) {
            weight = parseFloat(product.weight) || 0;
          }

          // Use the cart price as the FINAL price (it already includes GST, making charges, discounts)
          const cartItemPrice = orderItem.price || 0;
          const finalPrice = cartItemPrice * orderItem.quantity;
          
          // For display - multiply by quantity
          const gst = gstValue * orderItem.quantity;
          const discount = discountValue * orderItem.quantity;
          const makingCharges = makingChargesValue * orderItem.quantity;

          return {
            productId: product._id,
            name: product.name,
            sku: product.skuId || 'N/A',
            category: product.categories || 'N/A',
            brand: product.brand || 'N/A',
            quantity: orderItem.quantity,
            unitPrice: cartItemPrice,
            totalPrice: finalPrice,
            weight: weight * orderItem.quantity, // Total weight for quantity
            weightPerUnit: weight, // Weight per single unit
            metalType: metalType,
            purity: purity,
            makingCharges,
            gst,
            gstPercentage,
            discount,
            discountPercentage,
            goldValue: goldValue * orderItem.quantity,
            finalPrice,
            // Store complete product details for invoice
            productDetails: productDetails,
            priceDetails: priceDetails,
            images: product.images || [],
            description: product.description || '',
            selectedCaret: product.selectedCaret || purity
          };
        }));

        // Use the cart's totalAmount as the grand total - this is what customer agreed to pay
        const grandTotal = totalAmount;
        
        // Calculate totals for display from extracted values
        const totalWeight = products.reduce((sum, p) => sum + (p.weight || 0), 0);
        const totalGST = products.reduce((sum, p) => sum + (p.gst || 0), 0);
        const totalDiscount = products.reduce((sum, p) => sum + (p.discount || 0), 0);
        const totalMakingCharges = products.reduce((sum, p) => sum + (p.makingCharges || 0), 0);
        const subtotal = products.reduce((sum, p) => sum + (p.goldValue || 0), 0);

        // Generate invoice number in format: PGINV/2025-26/00001
        // Financial year: April to March (e.g., 2025-26 = April 2025 to March 2026)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        
        // Financial year starts in April (month 4)
        let financialYearStart, financialYearEnd;
        if (currentMonth >= 4) {
          // April to December: Current year to next year
          financialYearStart = currentYear;
          financialYearEnd = currentYear + 1;
        } else {
          // January to March: Previous year to current year
          financialYearStart = currentYear - 1;
          financialYearEnd = currentYear;
        }
        
        const financialYear = `${financialYearStart}-${String(financialYearEnd).slice(-2)}`;
        
        // Count invoices for current financial year
        const financialYearStartDate = new Date(financialYearStart, 3, 1); // April 1
        const financialYearEndDate = new Date(financialYearEnd, 2, 31, 23, 59, 59); // March 31
        
        const invoiceCount = await Invoice.countDocuments({
          createdAt: {
            $gte: financialYearStartDate,
            $lte: financialYearEndDate
          }
        });
        
        const sequence = String(invoiceCount + 1).padStart(5, '0');
        const invoiceNumber = `PGINV/${financialYear}/${sequence}`;

        // Get shipping address from order with delivery person details
        const shippingAddressData = {
          name: name || parsedDeliveryAddress?.name || customerDetails.name,
          phone: phone || parsedDeliveryAddress?.phone || customerDetails.phone,
          street: street || parsedDeliveryAddress?.street || parsedDeliveryAddress?.addressLine1 || parsedDeliveryAddress?.address || customerDetails.address.street || 'N/A',
          city: city || parsedDeliveryAddress?.city || customerDetails.address.city || 'N/A',
          state: state || parsedDeliveryAddress?.state || customerDetails.address.state || 'N/A',
          pincode: pincode || parsedDeliveryAddress?.pincode || parsedDeliveryAddress?.zipcode || customerDetails.address.pincode || 'N/A',
          landmark: landmark || parsedDeliveryAddress?.landmark || parsedDeliveryAddress?.addressLine2 || ''
        };
        // let shippingAddressData = customerDetails.address;
        // if (deliveryAddress && typeof deliveryAddress === 'object') {
        //   shippingAddressData = {
        //     name: customerDetails.name,
        //     phone: customerDetails.phone,
        //     street: deliveryAddress.street || deliveryAddress.addressLine1 || deliveryAddress.address || 'N/A',
        //     city: deliveryAddress.city || 'N/A',
        //     state: deliveryAddress.state || 'N/A',
        //     pincode: deliveryAddress.pincode || deliveryAddress.zipcode || 'N/A',
        //     landmark: deliveryAddress.landmark || deliveryAddress.addressLine2 || ''
        //   };
        // } else if (deliveryAddress && typeof deliveryAddress === 'string') {
        //   // Try to parse if it's JSON string
        //   try {
        //     const parsed = JSON.parse(deliveryAddress);
        //     shippingAddressData = {
        //       name: customerDetails.name,
        //       phone: customerDetails.phone,
        //       street: parsed.street || parsed.addressLine1 || parsed.address || deliveryAddress,
        //       city: parsed.city || 'N/A',
        //       state: parsed.state || 'N/A',
        //       pincode: parsed.pincode || parsed.zipcode || 'N/A',
        //       landmark: parsed.landmark || parsed.addressLine2 || ''
        //     };
        //   } catch (e) {
        //     // If not JSON, use as street address
        //     shippingAddressData = {
        //       name: customerDetails.name,
        //       phone: customerDetails.phone,
        //       street: deliveryAddress,
        //       city: customerDetails.address.city || 'N/A',
        //       state: customerDetails.address.state || 'N/A',
        //       pincode: customerDetails.address.pincode || 'N/A',
        //       landmark: ''
        //     };
        //   }
        // }

        // Create invoice with complete data (same as what's sent in email)
        const invoice = new Invoice({
          invoiceNumber,
          orderId: order._id,
          customerId: req.user.id,
          customerDetails: {
            name: customerDetails.name, // Use delivery person name or customer name
            email: customerDetails.email,
            phone: customerDetails.phone, // Use delivery person phone or customer phone
            address: customerDetails.address // Billing address
          },
          products: products.map(p => ({
            productId: p.productId,
            name: p.name,
            sku: p.sku,
            category: p.category,
            brand: p.brand,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            totalPrice: p.totalPrice,
            weight: p.weight,
            metalType: p.metalType,
            purity: p.purity,
            makingCharges: p.makingCharges || 0, // Save making charges
            gst: p.gst || 0, // Save GST
            discount: p.discount || 0, // Save discount
            finalPrice: p.finalPrice
          })),
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
            shippingAddress: shippingAddressData // Save shipping address
          },
          status: 'sent', // Mark as sent since it's being emailed
          createdBy: req.user.id, // Using user ID as admin for now
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        });

        await invoice.save();
        console.log('✅ Invoice created and saved to database:', invoice.invoiceNumber);

        // Send order confirmation email with invoice PDF
        try {
          console.log('📧 Starting email with invoice PDF for order:', order.orderCode);
          
          // Generate invoice PDF
          const pdfBuffer = await generateOrderInvoicePDF(invoice, customerDetails, products, {
            subtotal, totalMakingCharges, totalGST, totalDiscount, grandTotal
          });
          
          // Prepare email content
          const emailSubject = `Order Confirmation - ${order.orderCode} | Precious Goldsmith`;
          const emailHtml = generateOrderConfirmationEmailHTML(order, customer, products, {
            subtotal, totalMakingCharges, totalGST, totalDiscount, grandTotal
          }, invoice.invoiceNumber);
          
          // Send email with PDF attachment
          await sendEmailWithAttachment(
            customer.email,
            emailSubject,
            emailHtml,
            customer.name || 'Valued Customer',
            pdfBuffer,
            `Invoice-${invoice.invoiceNumber}.pdf`
          );
          
          console.log(`✅ Order confirmation email with invoice sent to ${customer.email}`);
        } catch (emailError) {
          console.error('❌ Error sending order confirmation email:', emailError?.message || emailError);
          if (emailError?.stack) {
            console.error('Stack trace:', emailError.stack);
          }
          // Don't fail the order if email fails
        }
      }
    } catch (invoiceError) {
      console.error('Error creating automatic invoice:', invoiceError);
      // Don't fail the order if invoice creation fails
    }

    // Send WhatsApp message to user
    try {
      if (customer && customer.phone) {
        const Invoice = require('../models/invoice_model');
        const invoice = await Invoice.findOne({ orderId: order._id });
        const invoiceNumber = invoice ? invoice.invoiceNumber : 'N/A';
        
        await sendWhatsAppMessage(
          customer.phone,
          order.orderCode,
          invoiceNumber,
          totalAmount
        );
      } else {
        console.log('⚠️ Customer phone not available, skipping WhatsApp message');
      }
    } catch (whatsappError) {
      console.error('❌ Error sending WhatsApp message:', whatsappError);
      // Don't fail the order if WhatsApp fails
    }

    res.status(201).json({ success: true, message: "Order placed", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Return/Refund Request - Comprehensive API
const createReturnRefundRequest = async (req, res) => {
  try {
    const { orderId, requestType, items, reason, additionalNotes } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!orderId || !requestType || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: orderId, requestType, and items are required" 
      });
    }

    if (!['return', 'refund'].includes(requestType.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        error: "requestType must be either 'return' or 'refund'" 
      });
    }

    // Find the order and verify it belongs to the user
    const order = await productOrder.findById(orderId).populate('items.productDataid');
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: "You don't have permission to return/refund this order" 
      });
    }

    // Check if order is eligible for return/refund (not already returned/refunded)
    if (['RETURNED', 'REFUNDED'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Order is already ${order.status.toLowerCase()}` 
      });
    }

    // Validate items
    const ReturnRequest = require('../models/returnRequest');
    const validItems = [];
    let totalRefundAmount = 0;

    for (const item of items) {
      const orderItem = order.items.find((oi) => {
        // Handle both populated and unpopulated productDataid
        const productId = oi.productDataid._id 
          ? oi.productDataid._id.toString() 
          : oi.productDataid.toString();
        return productId === item.productId;
      });

      if (!orderItem) {
        return res.status(400).json({ 
          success: false, 
          error: `Product ${item.productId} not found in order` 
        });
      }

      if (item.qty > orderItem.quantity) {
        return res.status(400).json({ 
          success: false, 
          error: `Requested quantity (${item.qty}) exceeds ordered quantity (${orderItem.quantity}) for product ${item.productId}` 
        });
      }

      // Get productId for ReturnRequest (use ObjectId)
      const productIdForRequest = orderItem.productDataid._id 
        ? orderItem.productDataid._id 
        : orderItem.productDataid;

      validItems.push({
        productId: productIdForRequest,
        qty: item.qty,
        reason: item.reason || reason || 'Not specified'
      });

      // Calculate refund amount for this item
      // orderItem.price is the total price for the item (quantity * unit price)
      // So we need to calculate: (total_price / quantity) * return_quantity
      let itemUnitPrice = 0;
      if (orderItem.price && orderItem.quantity > 0) {
        // Price is total for the item, so divide by quantity to get unit price
        itemUnitPrice = orderItem.price / orderItem.quantity;
      } else if (orderItem.productDataid?.sellingprice) {
        // Fallback to product selling price if order item price is not available
        itemUnitPrice = orderItem.productDataid.sellingprice;
      }
      
      const itemRefundAmount = itemUnitPrice * item.qty;
      totalRefundAmount += itemRefundAmount;
    }

    // Create return request
    // Always store refund amount for both return and refund requests
    const returnRequest = new ReturnRequest({
      orderId: order._id,
      userId: userId,
      items: validItems,
      status: 'requested',
      requestType: requestType.toLowerCase(),
      refundAmount: totalRefundAmount, // Always store refund amount
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await returnRequest.save();

    // Update order status if it's a full return/refund
    const totalOrderedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalRequestedQty = validItems.reduce((sum, item) => sum + item.qty, 0);

    if (totalRequestedQty === totalOrderedQty) {
      // Full return/refund
      if (requestType.toLowerCase() === 'refund') {
        order.status = 'REFUNDED';
        order.refundAmount = totalRefundAmount;
      } else {
        order.status = 'RETURNED';
        order.returnReason = reason || additionalNotes || 'Return requested';
      }
      await order.save();
    }

    res.status(201).json({ 
      success: true, 
      message: `${requestType} request created successfully`, 
      returnRequest: {
        id: returnRequest._id,
        orderId: returnRequest.orderId,
        status: returnRequest.status,
        items: returnRequest.items,
        refundAmount: returnRequest.refundAmount,
        createdAt: returnRequest.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating return/refund request:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Return Order (Legacy - kept for backward compatibility)
const returnOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await productOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = "RETURNED";
    order.returnReason = reason;
    await order.save();

    res.json({ success: true, message: "Order marked as returned", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Refund Order (Legacy - kept for backward compatibility)
const refundOrder = async (req, res) => {
  try {
    const { orderId, refundAmount } = req.body;

    const order = await productOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = "REFUNDED";
    order.refundAmount = refundAmount;
    await order.save();

    res.json({ success: true, message: "Refund processed", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get Order History
const getOrderHistory = async (req, res) => {
  console.log(req.user.id);
  try {
    const orders = await productOrder.find({ user: req.user.id }).sort({ createdAt: -1 }).populate("items.productDataid");
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ==========================
// ADMIN: GET ALL ORDERS WITH PAGINATION AND FILTERING
// ==========================
const getAllOrdersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get orders with pagination and populate user data
    const orders = await transactionSchema
      .find(filter)
      .populate('userId', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalOrders = await transactionSchema.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    // Calculate summary statistics
    const stats = await transactionSchema.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$amount' }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalAmount: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    res.status(200).json({
      status: true,
      message: "All orders fetched successfully for admin",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalOrders: summary.totalOrders,
          averageOrderValue: Math.round(summary.averageOrderValue * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error("Error fetching orders for admin:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching orders",
      error: error.message
    });
  }
};

// ==========================
// ADMIN: GET ALL PRODUCT ORDERS WITH PAGINATION AND FILTERING
// ==========================
const getAllProductOrdersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } },
        { 'items.productDataid.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get product orders with pagination and populate user and product data
    const orders = await productOrder
      .find(filter)
      .populate('user', 'name email phone')
      .populate('items.productDataid', 'name brand price images')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalOrders = await productOrder.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    // Calculate summary statistics
    const stats = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalAmount: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    // Get status-wise breakdown
    const statusBreakdown = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get payment status breakdown
    const paymentStatusBreakdown = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      status: true,
      message: "All product orders fetched successfully for admin",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalOrders: summary.totalOrders,
          averageOrderValue: Math.round(summary.averageOrderValue * 100) / 100
        },
        breakdown: {
          status: statusBreakdown,
          paymentStatus: paymentStatusBreakdown
        }
      }
    });
  } catch (error) {
    console.error("Error fetching product orders for admin:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching product orders",
      error: error.message
    });
  }
};



// 1️⃣ Generate Access Token
const  generateTokenPhonePe = async (req, res) => {
  try {
    const requestHeaders = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const requestBodyJson = {
      client_version: 1,
      grant_type: "client_credentials",
      // client_id: process.env.PHONEPE_CLIENT_ID || "TEST-M23HLKE4QF87Z_25102",
      client_id: "SU2510291510109164659318",
      client_secret:
        "ddb63c2f-a914-4a9b-9fc1-cef4b97a7a24",
      // client_id: "TEST-M23HLKE4QF87Z_25102",
      // client_secret:
      //   "Y2E1NWFhOGQtZjQ1YS00MjNmLThiZDYtYjA1NjlhMWUwOTVl",
    };

    const requestBody = new URLSearchParams(requestBodyJson).toString();

    const { data } = await axios.post(
      // "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
      "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
      requestBody,
      { headers: requestHeaders }
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Token Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: error.response?.data || error.message,
    });
  }
};

// 2️⃣ Create Payment Order
const createOrderPhonePe = async (req, res) => {
  try {
    const { access_token, merchantOrderId, amount } = req.body;

    if (!access_token)
      return res
        .status(400)
        .json({ success: false, message: "Missing access_token" });

    const data = {
      merchantOrderId: merchantOrderId || `TXN-${Date.now()}`,
      amount: amount || 100,
      expireAfter: 1200,
      metaInfo: { udf1: "extra-info" },
      paymentFlow: { type: "PG_CHECKOUT" },
    };

    const config = {
      method: "post",
      // url: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/sdk/order",
      url: "https://api.phonepe.com/apis/pg/checkout/v2/sdk/order",
      headers: {
        Authorization: `O-Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(data),
    };

    const response = await axios.request(config);

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Order Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.response?.data || error.message,
    });
  }
};


const checkPhonePeOrderStatus = async (req, res) => {
  try {
    const { access_token, merchantOrderId } = req.body;

    if (!access_token)
      return res.status(400).json({
        success: false,
        message: "Missing access_token",
      });

    if (!merchantOrderId)
      return res.status(400).json({
        success: false,
        message: "Missing merchantOrderId",
      });

    const config = {
      method: "get",
      url: `https://api.phonepe.com/apis/pg-sandbox/checkout/v2/order/${merchantOrderId}/status`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${access_token}`,
      },
    };

    const response = await axios.request(config);

    return res.status(200).json({
      success: true,
      message: "Order status fetched successfully",
      data: response.data,
    });

  } catch (error) {
    console.error("PhonePe Status Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order status",
      error: error.response?.data || error.message,
    });
  }
};







// ==========================
// ADMIN: GET ALL RETURN/REFUND REQUESTS
// ==========================
const getAllReturnRefundRequestsAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      requestType,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const ReturnRequest = require('../models/returnRequest');
    
    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (requestType) {
      filter.requestType = requestType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get return requests with pagination and populate order and user data
    const returnRequests = await ReturnRequest
      .find(filter)
      .populate('orderId', 'orderCode totalAmount status deliveryAddress')
      .populate('userId', 'name email phone')
      .populate('items.productId', 'name brand images sellingprice')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Filter by search term if provided (after population)
    let filteredRequests = returnRequests;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRequests = returnRequests.filter(request => {
        const orderCode = request.orderId?.orderCode?.toLowerCase() || '';
        const userName = request.userId?.name?.toLowerCase() || '';
        const userEmail = request.userId?.email?.toLowerCase() || '';
        return orderCode.includes(searchLower) || 
               userName.includes(searchLower) || 
               userEmail.includes(searchLower);
      });
    }

    // Get total count for pagination
    const totalRequests = await ReturnRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / parseInt(limit));

    // Calculate summary statistics
    const stats = await ReturnRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRefundAmount: { 
            $sum: { 
              $ifNull: ['$refundAmount', 0] 
            } 
          },
          totalRequests: { $sum: 1 },
          averageRefundAmount: { 
            $avg: { 
              $ifNull: ['$refundAmount', 0] 
            } 
          }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalRefundAmount: 0,
      totalRequests: 0,
      averageRefundAmount: 0
    };

    // Get status-wise breakdown
    const statusBreakdown = await ReturnRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRefundAmount: { 
            $sum: { 
              $ifNull: ['$refundAmount', 0] 
            } 
          }
        }
      }
    ]);

    res.status(200).json({
      status: true,
      message: "All return/refund requests fetched successfully",
      data: {
        returnRequests: filteredRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRequests,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          totalRefundAmount: summary.totalRefundAmount || 0,
          totalRequests: summary.totalRequests || 0,
          averageRefundAmount: Math.round((summary.averageRefundAmount || 0) * 100) / 100
        },
        breakdown: {
          status: statusBreakdown
        }
      }
    });
  } catch (error) {
    console.error("Error fetching return/refund requests for admin:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching return/refund requests",
      error: error.message
    });
  }
};

// ==========================
// ADMIN: ACCEPT RETURN/REFUND REQUEST
// ==========================
const acceptReturnRefundRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: "Request ID is required"
      });
    }

    const ReturnRequest = require('../models/returnRequest');
    const returnRequest = await ReturnRequest.findById(requestId)
      .populate('orderId')
      .populate('items.productId');

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        error: "Return/refund request not found"
      });
    }

    if (returnRequest.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: `Request is already ${returnRequest.status}`
      });
    }

    // Update request status
    returnRequest.status = 'approved';
    returnRequest.updatedAt = new Date();
    await returnRequest.save();

    // Update order status when return/refund is approved
    // Handle both populated and unpopulated orderId
    const orderId = returnRequest.orderId._id 
      ? returnRequest.orderId._id.toString() 
      : returnRequest.orderId.toString();
    
    const order = await productOrder.findById(orderId);
    if (order) {
      const totalOrderedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalRequestedQty = returnRequest.items.reduce((sum, item) => sum + item.qty, 0);

      // Always update refund amount when return/refund is approved
      if (returnRequest.refundAmount) {
        order.refundAmount = (order.refundAmount || 0) + returnRequest.refundAmount;
      }

      if (totalRequestedQty === totalOrderedQty) {
        // Full return/refund - mark order as fully returned/refunded
        if (returnRequest.requestType === 'refund') {
          order.status = 'REFUNDED';
        } else {
          order.status = 'RETURNED';
          order.returnReason = returnRequest.items[0]?.reason || 'Return approved';
        }
      } else {
        // Partial return/refund - mark order as in progress
        if (returnRequest.requestType === 'refund') {
          order.status = 'REFUND_IN_PROGRESS';
        } else {
          order.status = 'RETURN_IN_PROGRESS';
          order.returnReason = returnRequest.items[0]?.reason || 'Return approved';
        }
      }
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: "Return/refund request approved successfully",
      returnRequest
    });
  } catch (err) {
    console.error('Error accepting return/refund request:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==========================
// GET RETURN/REFUND REQUEST BY ORDER ID (USER)
// ==========================
const getReturnRefundRequestByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required"
      });
    }

    const ReturnRequest = require('../models/returnRequest');
    
    // Find return request for this order and user (get the latest one)
    const returnRequests = await ReturnRequest
      .find({ orderId: orderId, userId: userId })
      .populate('orderId', 'orderCode totalAmount status')
      .populate('items.productId', 'name brand images')
      .sort({ createdAt: -1 })
      .limit(1);
    
    const returnRequest = returnRequests.length > 0 ? returnRequests[0] : null;

    if (!returnRequest) {
      return res.status(200).json({
        success: true,
        hasRequest: false,
        message: "No return/refund request found for this order"
      });
    }

    res.status(200).json({
      success: true,
      hasRequest: true,
      returnRequest: {
        id: returnRequest._id,
        orderId: returnRequest.orderId?._id || returnRequest.orderId,
        status: returnRequest.status,
        requestType: returnRequest.requestType,
        items: returnRequest.items,
        refundAmount: returnRequest.refundAmount || 0,
        rejectionMessage: returnRequest.rejectionMessage,
        createdAt: returnRequest.createdAt,
        updatedAt: returnRequest.updatedAt
      }
    });
  } catch (err) {
    console.error('Error fetching return/refund request:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==========================
// GET USER RETURN/REFUND HISTORY
// ==========================
const getUserReturnRefundHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status,
      requestType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const ReturnRequest = require('../models/returnRequest');
    
    // Build filter object
    const filter = { userId: userId };

    if (status) {
      filter.status = status;
    }

    if (requestType) {
      filter.requestType = requestType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get return requests with pagination and populate order and product data
    const returnRequests = await ReturnRequest
      .find(filter)
      .populate({
        path: 'orderId',
        select: 'orderCode totalAmount status deliveryAddress createdAt items',
        populate: {
          path: 'items.productDataid',
          select: 'name brand images sellingprice'
        }
      })
      .populate({
        path: 'items.productId',
        select: 'name brand images sellingprice',
        model: 'Product'
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalRequests = await ReturnRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / parseInt(limit));

    // Format response with fallback to order items if productId is not populated
    const Product = require('../models/product_model');
    const formattedRequests = await Promise.all(returnRequests.map(async (request) => {
      const formattedItems = await Promise.all(request.items.map(async (item) => {
        let productName = 'Unknown Product';
        let productImage = '';
        let productPrice = 0;
        let productId = item.productId;

        // Try to get product data from populated productId
        // Check if productId is populated (has name property) or is just an ObjectId
        if (item.productId) {
          if (typeof item.productId === 'object' && item.productId.name) {
            // Product is populated
            productName = item.productId.name || 'Unknown Product';
            productImage = (item.productId.images && item.productId.images.length > 0) 
              ? item.productId.images[0] 
              : '';
            productPrice = item.productId.sellingprice || 0;
            productId = item.productId._id || item.productId;
          } else {
            // productId is just an ObjectId, need to fetch or use fallback
            productId = item.productId._id || item.productId;
          }
        }
        
        // If we still don't have product data, try fallbacks
        if (productName === 'Unknown Product') {
          // Fallback: Try to get product from order items
          if (request.orderId && request.orderId.items) {
            const itemProductIdStr = productId?.toString();
            const orderItem = request.orderId.items.find(oi => {
              if (!oi.productDataid) return false;
              
              const oiProductId = oi.productDataid._id 
                ? oi.productDataid._id.toString() 
                : oi.productDataid.toString();
              
              return oiProductId === itemProductIdStr;
            });

            if (orderItem && orderItem.productDataid) {
              if (orderItem.productDataid.name) {
                productName = orderItem.productDataid.name;
                productImage = orderItem.productDataid.images?.[0] || '';
                productPrice = orderItem.productDataid.sellingprice || 0;
              }
            }
          }

          // Last fallback: Fetch product directly from database
          if (productName === 'Unknown Product' && productId) {
            try {
              const product = await Product.findById(productId);
              if (product) {
                productName = product.name || 'Unknown Product';
                productImage = product.images?.[0] || '';
                productPrice = product.sellingprice || 0;
              }
            } catch (err) {
              console.error('Error fetching product:', err);
            }
          }
        }

        return {
          productId: productId,
          productName: productName,
          productImage: productImage,
          qty: item.qty,
          reason: item.reason,
          price: productPrice
        };
      }));

      return {
        id: request._id,
        orderId: request.orderId?._id || request.orderId,
        orderCode: request.orderId?.orderCode || 'N/A',
        status: request.status,
        requestType: request.requestType,
        items: formattedItems,
        refundAmount: request.refundAmount || 0,
        rejectionMessage: request.rejectionMessage,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      };
    }));

    res.status(200).json({
      success: true,
      message: "Return/refund history fetched successfully",
      data: {
        returnRequests: formattedRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRequests,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching user return/refund history:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==========================
// ADMIN: REJECT RETURN/REFUND REQUEST
// ==========================
const rejectReturnRefundRequest = async (req, res) => {
  try {
    const { requestId, rejectionMessage } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: "Request ID is required"
      });
    }

    if (!rejectionMessage || rejectionMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "Rejection message is required"
      });
    }

    const ReturnRequest = require('../models/returnRequest');
    const returnRequest = await ReturnRequest.findById(requestId);

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        error: "Return/refund request not found"
      });
    }

    if (returnRequest.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: `Request is already ${returnRequest.status}`
      });
    }

    // Update request status and rejection message
    returnRequest.status = 'rejected';
    returnRequest.rejectionMessage = rejectionMessage.trim();
    returnRequest.updatedAt = new Date();
    await returnRequest.save();

    res.status(200).json({
      success: true,
      message: "Return/refund request rejected successfully",
      returnRequest
    });
  } catch (err) {
    console.error('Error rejecting return/refund request:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Get investment orders grouped by month for chart
const getInvestmentOrdersByMonth = (async (req, res) => {
  try {
    const { months = 12 } = req.query; // Default to last 12 months
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    
    // Aggregate investment orders by month, separated by gold and silver
    const monthlyData = await transactionSchema.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          transactionType: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          normalizedType: {
            $toUpper: {
              $ifNull: ['$transactionType', '']
            }
          }
        }
      },
      {
        $match: {
          normalizedType: { $in: ['GOLD', 'SILVER'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$normalizedType'
          },
          totalValue: { $sum: { $ifNull: ['$inramount', 0] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.type': 1
        }
      }
    ]);
    
    // Get all months in the range
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsList = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const monthKey = `${year}-${month}`;
      monthsList.push({
        key: monthKey,
        year,
        month,
        label: `${monthNames[month - 1]} ${year}`
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Initialize data structure
    const goldData = new Array(monthsList.length).fill(0);
    const silverData = new Array(monthsList.length).fill(0);
    const goldOrderCounts = new Array(monthsList.length).fill(0);
    const silverOrderCounts = new Array(monthsList.length).fill(0);
    
    // Fill in the data
    monthlyData.forEach(item => {
      const monthIndex = monthsList.findIndex(m => 
        m.year === item._id.year && m.month === item._id.month
      );
      
      if (monthIndex !== -1) {
        if (item._id.type === 'GOLD') {
          goldData[monthIndex] = item.totalValue || 0;
          goldOrderCounts[monthIndex] = item.orderCount || 0;
        } else if (item._id.type === 'SILVER') {
          silverData[monthIndex] = item.totalValue || 0;
          silverOrderCounts[monthIndex] = item.orderCount || 0;
        }
      }
    });
    
    // Format response
    const chartData = {
      categories: monthsList.map(m => m.label),
      series: [
        {
          name: 'Gold',
          data: goldData,
          orderCounts: goldOrderCounts
        },
        {
          name: 'Silver',
          data: silverData,
          orderCounts: silverOrderCounts
        }
      ],
      summary: {
        totalGoldValue: goldData.reduce((sum, val) => sum + val, 0),
        totalSilverValue: silverData.reduce((sum, val) => sum + val, 0),
        totalGoldOrders: goldOrderCounts.reduce((sum, val) => sum + val, 0),
        totalSilverOrders: silverOrderCounts.reduce((sum, val) => sum + val, 0)
      }
    };
    
    res.status(200).json({
      status: true,
      message: "Investment orders by month fetched successfully",
      data: chartData
    });
  } catch (error) {
    console.error("Error fetching investment orders by month:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching investment orders by month",
      error: error.message
    });
  }
});

// Get Total Revenue from Commerce Orders (excluding returns/refunds)
const getTotalRevenue = (async (req, res) => {
  try {
    // Calculate revenue from all orders, properly handling returns/refunds
    // For fully returned/refunded orders: exclude from revenue (netAmount = 0)
    // For partial returns/refunds: subtract refundAmount from totalAmount
    // For normal orders: use totalAmount as-is
    const revenueData = await productOrder.aggregate([
      {
        $project: {
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          status: 1,
          refundAmount: { $ifNull: ['$refundAmount', 0] },
          // Calculate net amount per order
          netAmount: {
            $cond: {
              if: { $in: ['$status', ['RETURNED', 'REFUNDED']] },
              then: 0, // Fully returned/refunded orders contribute 0 to revenue
              else: {
                $subtract: [
                  { $ifNull: ['$totalAmount', 0] },
                  { $ifNull: ['$refundAmount', 0] }
                ]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$netAmount' },
          totalOrders: {
            $sum: {
              $cond: {
                if: { $in: ['$status', ['RETURNED', 'REFUNDED']] },
                then: 0, // Don't count fully returned/refunded orders
                else: 1
              }
            }
          },
          averageOrderValue: { $avg: '$netAmount' },
          totalRefunded: {
            $sum: {
              $cond: {
                if: { $gt: [{ $ifNull: ['$refundAmount', 0] }, 0] },
                then: { $ifNull: ['$refundAmount', 0] },
                else: 0
              }
            }
          },
          refundedOrders: {
            $sum: {
              $cond: {
                if: { $gt: [{ $ifNull: ['$refundAmount', 0] }, 0] },
                then: 1,
                else: 0
              }
            }
          }
        }
      }
    ]);

    const result = revenueData.length > 0 ? revenueData[0] : {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      totalRefunded: 0,
      refundedOrders: 0
    };

    res.status(200).json({
      status: true,
      message: "Total revenue calculated successfully",
      data: {
        totalRevenue: result.totalRevenue || 0,
        totalOrders: result.totalOrders || 0,
        averageOrderValue: result.averageOrderValue || 0,
        totalRefunded: result.totalRefunded || 0,
        refundedOrders: result.refundedOrders || 0,
        netRevenue: result.totalRevenue || 0 // Already net (totalAmount - refundAmount for each order)
      }
    });
  } catch (error) {
    console.error("Error calculating total revenue:", error);
    res.status(500).json({
      status: false,
      message: "Error calculating total revenue",
      error: error.message
    });
  }
});

// Get Total Investment Orders Value and Count
const getTotalInvestmentOrders = (async (req, res) => {
  try {
    // Aggregate investment orders (GOLD and SILVER) to get total value and count
    const investmentData = await transactionSchema.aggregate([
      {
        $addFields: {
          normalizedType: {
            $toUpper: {
              $ifNull: ['$transactionType', '']
            }
          }
        }
      },
      {
        $match: {
          normalizedType: { $in: ['GOLD', 'SILVER'] }
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $ifNull: ['$inramount', 0] } },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const result = investmentData.length > 0 ? investmentData[0] : {
      totalValue: 0,
      totalOrders: 0
    };

    res.status(200).json({
      status: true,
      message: "Total investment orders calculated successfully",
      data: {
        totalValue: result.totalValue || 0,
        totalOrders: result.totalOrders || 0
      }
    });
  } catch (error) {
    console.error("Error calculating total investment orders:", error);
    res.status(500).json({
      status: false,
      message: "Error calculating total investment orders",
      error: error.message
    });
  }
});

// ==========================
// UPDATE ORDER ITEM HUIDs API
// ==========================
const updateOrderItemHUIDs = async (req, res) => {
  try {
    const { orderId, itemIndex, huids } = req.body;

    // Validate input
    if (!orderId || itemIndex === undefined || !Array.isArray(huids)) {
      return res.status(400).json({
        success: false,
        error: "orderId, itemIndex, and huids array are required",
      });
    }

    // Find the order
    const order = await productOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Check if order is confirmed
    if (order.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        error: "HUID can only be added for confirmed orders",
      });
    }

    // Validate item index
    if (itemIndex < 0 || itemIndex >= order.items.length) {
      return res.status(400).json({
        success: false,
        error: "Invalid item index",
      });
    }

    const item = order.items[itemIndex];

    // Validate HUID count matches quantity
    if (huids.length > item.quantity) {
      return res.status(400).json({
        success: false,
        error: `Cannot add more than ${item.quantity} HUIDs for this item (quantity: ${item.quantity})`,
      });
    }

    // Validate HUID format (basic validation - alphanumeric, typically 6-16 characters)
    const huidPattern = /^[A-Z0-9]{6,16}$/i;
    const invalidHuids = huids.filter(huid => huid && !huidPattern.test(huid.trim()));
    if (invalidHuids.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid HUID format: ${invalidHuids.join(', ')}. HUID should be 6-16 alphanumeric characters.`,
      });
    }

    // Update HUIDs (trim whitespace and filter empty strings)
    order.items[itemIndex].huids = huids
      .map(huid => huid ? huid.trim() : '')
      .filter(huid => huid.length > 0);

    await order.save();

    res.status(200).json({
      success: true,
      message: "HUIDs updated successfully",
      data: {
        orderId: order._id,
        itemIndex: itemIndex,
        huids: order.items[itemIndex].huids,
        quantity: item.quantity,
      },
    });
  } catch (error) {
    console.error("❌ Update Order Item HUIDs Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==========================
// SEND WHATSAPP MESSAGE API
// ==========================
const sendOrderWhatsAppMessage = async (req, res) => {
  try {
    const { orderCode, orderId, phoneNumber } = req.body;

    // // Validate input
    // if (!orderCode && !orderId) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Either orderCode or orderId is required"
    //   });
    // }

    // // Find the order
    // let order = null;
    // if (orderCode) {
    //   order = await productOrder.findOne({ orderCode });
    // } else if (orderId) {
    //   order = await productOrder.findById(orderId);
    // }

    // if (!order) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Order not found"
    //   });
    // }

    // // Get customer details
    // const customer = await User.findById(order.user);
    // if (!customer) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Customer not found for this order"
    //   });
    // }

    // Use provided phone number or customer's phone
    // const recipientPhone = phoneNumber || customer.phone;
    // if (!recipientPhone) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Phone number is required. Please provide phoneNumber in request or ensure customer has a phone number."
    //   });
    // }

    // // Find invoice for this order
    // const Invoice = require('../models/invoice_model');
    // const invoice = await Invoice.findOne({ orderId: order._id });
    // const invoiceNumber = invoice ? invoice.invoiceNumber : 'N/A';

    // Send WhatsApp message
    const result = await sendWhatsAppMessage(
      "+917092053592",
      "PGCOM-1764065481098-94200",
      "1764065481098-94200",
       0
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "WhatsApp message sent successfully",
        // data: {
        //   orderCode: order.orderCode,
        //   invoiceNumber: invoiceNumber,
        //   phoneNumber: recipientPhone,
        //   messageSid: result.messageSid
        // }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to send WhatsApp message",
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in sendOrderWhatsAppMessage:', error);
    return res.status(500).json({
      success: false,
      message: "Error sending WhatsApp message",
      error: error.message
    });
  }
};

module.exports = {
  placeOrder, returnOrder, refundOrder, createReturnRefundRequest, getOrderHistory,generateTokenPhonePe,createOrderPhonePe,checkPhonePeOrderStatus,
  buyOrSellGold,
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory,
  depositINR,
  withdrawINR,
  getAllOrdersAdmin,
  getAllProductOrdersAdmin,
  updateOrderItemHUIDs,
  getAllReturnRefundRequestsAdmin,
  acceptReturnRefundRequest,
  rejectReturnRefundRequest,
  getReturnRefundRequestByOrderId,
  getUserReturnRefundHistory,
  getInvestmentOrdersByMonth,
  getTotalRevenue,
  getTotalInvestmentOrders,
  sendOrderWhatsAppMessage
};
