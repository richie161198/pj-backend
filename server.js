const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const cloudinary = require("cloudinary").v2;
const connetDb = require("./config/dbConfig");
const dotenv = require("dotenv").config();
const socket = require("socket.io");
// const errorHandler = require("./middleware/error");
// const { default: axios } = require('axios');
const multer = require("multer");
// const apiRoutes = require("./routers/api");
const { notFound, errorHandler } = require("./middleware/error");
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const axios = require("axios");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const { sendEmail } = require("./helpers/mailer");
const { generateOTP } = require("./helpers/helpers");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { startGoldPriceScheduler } = require("./controller/goldPriceController");
const { startNotificationScheduler } = require("./services/notificationScheduler");
const { CronJob } = require("cron");
const { runDailyAutopayCharges } = require("./controller/autopayController");

const logoBase64 = fs.readFileSync("public/logo/23.png").toString("base64");


// import { v4 as  } =require("uuid");
// const encrypt = require("./helpers/crypto")

var cashfree = new Cashfree(
  CFEnvironment.PRODUCTION,
  process.env.CASHFREE_APP_ID_prod,
  process.env.CASHFREE_SECRET_prod
);


connetDb();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const app = express();

// app.use(helmet());
// app.use(express.json({ limit: "5mb" }));
// app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = socket(server);
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://www.preciousgoldsmith.net',
      'https://preciousgoldsmith.net',
      'https://admin.preciousgoldsmith.net',
      'http://admin.preciousgoldsmith.net'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now - you can restrict this in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
// app.options('*', cors(corsOptions));

app.get("/", (req, res) => {
  console.log("started");
  res.status(200).json({ status: "true", message: "api is working properly" });
  console.log("api is working properly");
});

// app.use(notFound);
app.use(errorHandler);

const CLIENT_ID = process.env.TCLIENT_ID;
const CLIENT_SECRET = process.env.TCLIENT_SECRET;
const API_VERSION = "2025-01-01";

BVC_AUTH_URL="https://bvcmars.com/RestService/OrderUploadService.svc/GenerateAuthenticationToken"
BVC_ORDER_UPLOAD_URL="https://bvcmars.com/RestService/OrderUploadService.svc/PushOrderUpload"
BVC_REVERSE_UPLOAD_URL="https://bvcmars.com/RestService/OrderUploadService.svc/PushReverseOrder"
BVC_TRACK_URL="https://bvcmars.com/RestService/TrackingService.svc/GetDocketTrackingDetails"
BVC_CANCEL_URL="http://bvc.cloudapp.net/RestService/DocketCancelService.svc/PushDocketCancel"

// CUSTOMER_AUTH_TOKEN="7DxYpMa0LhYvwp0tyo+9iQ=="
CUSTOMER_AUTH_TOKEN="oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv"
CUSTOMER_PUBLIC_KEY="174EE6D5-B9FB-482B-AA1B-1378673661A2"


async function generateAuthToken() {
try {
    const payload = {
    CustomerAuthToken: CUSTOMER_AUTH_TOKEN,
    CustomerPublicKey: CUSTOMER_PUBLIC_KEY
  };
  const { data } = await axios.post(BVC_AUTH_URL, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
console.log("token",data?.XXAuthenticationToken)

  return {
    token: data?.XXAuthenticationToken,
    // token: "oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv",
    timeStamp: data?.TimeStamp
  };
} catch (error) {
    console.log("err data0",error);

}
}

async function uploadOrder(order) {
try {
    const { token, timeStamp } = await generateAuthToken();

  const payload = {
    CustomerId: order.customerId,
    OrderUploadData: [order]
  };
console.log("BVC_ORDER_UPLOAD_URL",BVC_ORDER_UPLOAD_URL);
console.log("BVC_ORDER_timeStamp",timeStamp);
console.log("BVC_ORDER_token ",token);
  const { data } = await axios.post(BVC_ORDER_UPLOAD_URL, payload, {
    headers: {
      'XX-Authentication-Token': token,
      'TimeStamp': timeStamp,
      // 'TimeStamp': "202510131455560291",
      'Content-Type': 'application/json'
    }
  });

  return data;
} catch (error) {
  console.log("err data1",error);
  
}
}

app.post('/order/upload', async (req, res) => {
  try {
    const response = await uploadOrder(req.body);
    res.json(response);
  } catch (err) {

  console.log("err data2",err);
    res.status(500).json({ error: err.message });
  }
});

// app.post("/create-subscription", async (req, res) => {
//   try {
//     // you can accept customer details & plan from req.body
//     // const { subscription_id = sub_${Date.now()}, customer } = req.body;

//     const payload = {
//       subscription_id: "34545322",
//       plan_details: {
//         plan_id: "test", // from dashboard or API
//         plan_note: "Monthly UPI AutoPay plan",
//       },
//       authorization_details: {
//         // include "upi" to enable UPI AutoPay; you can include other supported modes if needed
//         payment_methods: ["upi"],
//       },
//       // minimal customer details - expand per docs
//       customer_details: {
//         customer_name: "FUser",
//         customer_email: "test@perciousgoldsmith.com",
//         customer_phone: "7092053592",
//       },
//       // return_url where Cashfree will POST form on completion (set to your endpoint)
//       return_url: "https://your-server.example.com/subscription-return",
//       // plan or amount fields depend on your chosen subscription model — check docs
//       // e.g. "plan" or "amount" and "period" for periodic subscriptions
//     };
// console.log("payload",payload);
//     const r = await axios.post(
//       "https://sandbox.cashfree.com/pg/subscriptions",
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "x-client-id": CLIENT_ID,
//           "x-client-secret": CLIENT_SECRET,
//           "x-api-version": API_VERSION,
//           // "x-request-id": uuidv4()
//         },
//       }
//     );

//     console.log("res",r.data,r.status);

//     // Response contains subscription_id and subscription_session_id
//     return res.json(r.data);
//   } catch (err) {
//     console.error(
//       "create-subscription error:",
//       err?.response?.data || err.message
//     );
//     return res.status(500).json({ error: err?.response?.data || err.message });
//   }
// });

// app.post('/upload', upload.single('image'), async (req, res) => {

//     console.log("image", req.file);
//   try {
//     if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

//     const result = await cloudinary.uploader.upload(req.file.path
//       async (error, result) => {
//         if (error) return res.status(500).json({ error });

//         // Save to MongoDB
//         const image = new Image({
//           url: result.secure_url,
//           public_id: result.public_id
//         });
//         await image.save();

//         res.json({ message: 'Image uploaded', url: result.secure_url });
//       }
//     );
//       console.log(result);
//     // // Pipe image buffer to cloudinary
//     // streamifier = require('streamifier');
//     // streamifier.createReadStream(req.file.buffer).pipe(result);
//   } catch (err) {
//     console.error('Upload error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

//  app.post('/upload', upload.single('image'), async (req, res) => {
//         try {
//             if (!req.file) {
//                 return res.status(400).json({ message: 'No file uploaded' });
//             }

//             const result = await cloudinary.uploader.upload(req.file.path, {
//                 folder: 'my_app_images' // Optional: specify a folder in Cloudinary
//             });

//             // Remove the temporary local file after successful upload
//             // fs.unlinkSync(req.file.path);

//             res.status(200).json({
//                 message: 'Image uploaded successfully',
//                 imageUrl: result.secure_url
//             });
//         } catch (error) {
//             console.error('Error uploading image:', error);
//             res.status(500).json({ message: 'Error uploading image' });
//         }
//     });


// app.post("/create-subscription", async (req, res) => {
//   try {
//     const { customer_name, customer_email, customer_phone, plan_id } = req.body;

//     // unique subscription id for every request
//     const subscriptionId = `sub_${Date.now()}`;

//     const payload = {
//       subscription_id: subscriptionId,
//       plan_details: {
//         plan_id: plan_id || "plan_test", // from Cashfree Dashboard
//         plan_note: "Monthly UPI AutoPay plan",
//       },
//       authorization_details: {
//         payment_methods: ["upi"], // can also add ["card", "netbanking"] etc
//       },
//       customer_details: {
//         customer_name: customer_name || "Test User",
//         customer_email: customer_email || "test@example.com",
//         customer_phone: customer_phone || "9876543210",
//       },
//       return_url: "https://your-server.example.com/subscription-return",
//     };

//     console.log("📤 Subscription Payload:", payload);

//     const r = await axios.post(
//       "https://sandbox.cashfree.com/pg/subscriptions",
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "x-client-id": CLIENT_ID,
//           "x-client-secret": CLIENT_SECRET,
//           "x-api-version": API_VERSION,
//           "x-request-id": uuidv4()
//         },
//       }
//     );

//     console.log("✅ Cashfree Response:", r.data);
//     return res.json({ status: true, data: r.data });
//   } catch (err) {
//     console.error(
//       "❌ create-subscription error:",
//       err?.response?.data || err.message
//     );
//     return res
//       .status(500)
//       .json({ status: false, error: err?.response?.data || err.message });
//   }
// });

// const CLIENT_ID = "YOUR_CLIENT_ID";
// const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
// const API_VERSION = "2022-09-01"; // as per Cashfree docs
const CASHFREE_BASE = "https://sandbox.cashfree.com/pg/subscriptions";

app.post("/create-subscription", async (req, res) => {
  console.log(CLIENT_ID, CLIENT_SECRET, API_VERSION, "sdsd");
  try {
    const { plan_id, customer_name, customer_email, customer_phone } = req.body;

    const payload = {
      subscription_id: `sub_${Date.now()}`,
      plan_details: {
        plan_id,
        plan_note: "Monthly UPI AutoPay plan",
      },
      authorization_details: {
        payment_methods: ["upi"], // you can add "debitcard"/"creditcard" if needed
      },
      customer_details: {
        customer_name,
        customer_email,
        customer_phone,
      },
      return_url: "https://your-server.example.com/subscription-return",
    };

    const response = await axios.post(CASHFREE_BASE, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CLIENT_ID,
        "x-client-secret": CLIENT_SECRET,
        "x-api-version": API_VERSION,
        "x-request-id": uuidv4(),
      },
    });

    return res.json(response.data); // returns subscription_id + subscription_session_id
  } catch (err) {
    console.error("Error:", err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data || err.message });
  }
});




app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  cloudinary.uploader
    .upload_stream({ resource_type: "auto" }, (error, result) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ error: "Error uploading to Cloudinary" });
      }
      res.json({ public_id: result.public_id, url: result.secure_url });
    })
    .end(req.file.buffer);
});

app.use("/api/v0/auth", require("./routers/authRouter"));
app.use("/api/v0/admin", require("./routers/adminRouter"));
app.use("/api/v0/users", require("./routers/userRouter"));
app.use("/api/v0/utils", require("./routers/utilsRouter"));
app.use("/api/v0/order", require("./routers/orderRouter"));
app.use("/api/v0/commerce", require("./routers/productRouter"));
app.use("/api/v0/reviews", require("./routers/reviewRouter"));
app.use("/api/v0/images", require("./routers/imageRouter"));
app.use("/api/v0/chat", require("./routers/chatRouter"));
app.use("/api/v0/notifications", require("./routers/notificationRouter"));
app.use("/api/v0/maintenance", require("./routers/maintenanceRouter"));
app.use("/api/v0/invoices", require("./routers/invoiceRouter"));
app.use("/api/v0/investment-invoices", require("./routers/investmentInvoiceRouter"));
app.use("/api/v0/banners", require("./routers/bannerRouter"));
app.use("/api/v0/shipments", require("./routers/shipmentRouter"));
app.use("/api/v0/shipment-pricing", require("./routers/shipmentPricingRouter"));
app.use("/api/v0/autopay", require("./routers/autopayRouter"));
app.use("/api/v0/gold-price", require("./routers/goldPriceRouter"));
app.use("/api/v0/appointments", require("./routers/appointmentRouter"));

// Debug endpoint for investment invoices
app.get("/debug-invoice/:orderId", async (req, res) => {
  try {
    const InvestmentInvoice = require("./models/investmentInvoice_model");
    const invoice = await InvestmentInvoice.findOne({ orderId: req.params.orderId });
    
    if (invoice) {
      res.json({
        found: true,
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          orderId: invoice.orderId,
          customerName: invoice.customerName,
          orderType: invoice.orderType,
          transactionType: invoice.transactionType,
          totalInvoiceValue: invoice.totalInvoiceValue,
          createdAt: invoice.createdAt
        }
      });
    } else {
      // Check if order exists in transactions
      const Transaction = require("./models/transcationModel");
      const transaction = await Transaction.findOne({ orderId: req.params.orderId });
      
      res.json({
        found: false,
        orderId: req.params.orderId,
        transactionExists: !!transaction,
        transactionData: transaction ? {
          orderType: transaction.orderType,
          transactionType: transaction.transactionType,
          goldQty: transaction.goldQtyInGm,
          inrAmount: transaction.inramount,
          gstAmount: transaction.gst_value,
        } : null
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual invoice creation for existing order
app.post("/create-invoice-for-order/:orderId", async (req, res) => {
  try {
    const InvestmentInvoice = require("./models/investmentInvoice_model");
    const Transaction = require("./models/transcationModel");
    const User = require("./models/userModel");
    
    const orderId = req.params.orderId;
    
    // Check if invoice already exists
    const existingInvoice = await InvestmentInvoice.findOne({ orderId });
    if (existingInvoice) {
      return res.json({
        success: true,
        message: "Invoice already exists",
        invoiceNumber: existingInvoice.invoiceNumber
      });
    }
    
    // Get transaction details
    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    
    // Get user details
    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Create invoice
    const invoice = await InvestmentInvoice.create({
      orderId: transaction.orderId,
      userId: transaction.userId,
      customerName: user.name || 'Customer',
      customerEmail: user.email,
      customerPhone: user.phone,
      orderType: transaction.orderType,
      transactionType: transaction.transactionType.toUpperCase(),
      product: transaction.transactionType.toUpperCase() === 'GOLD' ? 'GOLD24' : 'SILVER',
      quantity: parseFloat(transaction.goldQtyInGm),
      ratePerGram: parseFloat(transaction.goldCurrentPrice),
      amount: transaction.orderType === 'buy' 
        ? parseFloat(transaction.inramount) - parseFloat(transaction.gst_value)
        : parseFloat(transaction.inramount),
      gstRate: transaction.orderType === 'buy' ? 3 : 0,
      gstAmount: transaction.orderType === 'buy' ? parseFloat(transaction.gst_value) : 0,
      totalInvoiceValue: parseFloat(transaction.inramount),
      paymentMethod: transaction.Payment_method,
      transactionId: transaction.orderId,
      status: 'issued',
    });
    
    res.json({
      success: true,
      message: "Invoice created successfully",
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Debug banner routes
app.get("/debug-banner-routes", (req, res) => {
  res.json({
    success: true,
    message: "Banner routes are loaded",
    routes: [
      "GET /api/v0/banners/active",
      "GET /api/v0/banners/stats", 
      "GET /api/v0/banners",
      "POST /api/v0/banners",
      "GET /api/v0/banners/:id",
      "PUT /api/v0/banners/:id",
      "DELETE /api/v0/banners/:id",
      "PATCH /api/v0/banners/:id/toggle",
      "PATCH /api/v0/banners/:id/position"
    ]
  });
});


// Start server
// app.all("*", (req, res) => {
//   res.status(404).json({ status: "false", message: "route not found" });
// });

// app.use(errorHandler);






// Utility: Convert number to words (simple Indian currency words)
// function numberToWords(num) {
//   const inWords = require("number-to-words").toWords;
//   return inWords(num).replace(/\b\w/g, l => l.toUpperCase());
// }

app.post("/api/v0/generate-invoice", async (req, res) => {
  try {
    const invoice = req.body; // Your order JSON

    console.log(invoice);

    // // Prepare items rows
    // const itemsHtml = invoice.items
    //   .map(
    //     (item, idx) => `
    //   <tr>
    //     <td>${idx + 1}</td>
    //     <td>${item.productDataid.name}</td>
    //     <td>${item.productDataid.selectedCaret}</td>
    //     <td>${item.quantity}</td>
    //     <td>${item.productDataid.productDetails[0].attributes.grossWeight} g</td>
    //     <td>${
    //       item.productDataid.productDetails.find(p => p.type === "Stone")
    //         ?.attributes?.carat || "-"
    //     }</td>
    //     <td>${item.price.toFixed(2)}</td>
    //     <td>${item.productDataid.total.toLocaleString()}</td>
    //   </tr>`
    //   )
    //   .join("");

    // // Build invoice HTML
    // const html = `
    //   <html>
    //     <head>
    //       <style>
    //         body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
    //         .header { text-align: center; }
    //         .logo { width: 100px; margin-bottom: 10px; }
    //         .title { font-size: 18px; font-weight: bold; margin: 5px 0; }
    //         table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    //         th, td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 12px; }
    //         th { background: #f2f2f2; }
    //         .footer { margin-top: 30px; font-size: 11px; }
    //         .right { text-align: right; }
    //       </style>
    //     </head>
    //     <body>
    //       <div class="header">
    //         <img src="https://i.ibb.co/7nk3Qv7/logo.png" class="logo" />
    //         <div class="title">PRECIOUS GOLDSMITH</div>
    //         <div>KSAN INDUSTRIES LLP | GSTIN NO: 33BAFK98176AIZK</div>
    //         <div>New No:46, Old No:70/1, Bazullah Road, T Nagar, Chennai</div>
    //       </div>
          
    //       <h3 style="text-align:center;margin-top:20px;">TAX INVOICE</h3>

    //       <div>
    //         <strong>Invoice No:</strong> ${invoice.orderCode}<br/>
    //         <strong>Invoice Date:</strong> ${new Date(
    //           invoice.createdAt
    //         ).toLocaleDateString()}
    //       </div>

    //       <div style="margin-top:10px;">
    //         <strong>Billing Address:</strong><br/>
    //         ${invoice.deliveryAddress}
    //       </div>

    //       <table>
    //         <thead>
    //           <tr>
    //             <th>Sl No</th>
    //             <th>Product Description</th>
    //             <th>Purity</th>
    //             <th>Qty</th>
    //             <th>Gross Wt</th>
    //             <th>Stone Carat</th>
    //             <th>Unit Price</th>
    //             <th>Total</th>
    //           </tr>
    //         </thead>
    //         <tbody>
    //           ${itemsHtml}
    //         </tbody>
    //       </table>

    //       <div class="right" style="margin-top:10px;">
    //         <strong>Total Amount:</strong> ₹${invoice.totalAmount.toLocaleString()}<br/>
    //         <strong>Amount in Words:</strong>
    //         ${Math.round(invoice.totalAmount)} 
    //          Rupees Only
    //       </div>

    //       <div class="footer">
    //         <p><strong>Payment Mode:</strong> Non-COD</p>
    //         <p><strong>Terms:</strong> Subject to Chennai Jurisdiction</p>
    //       </div>
    //     </body>
    //   </html>
    // `;


    // Prepare items rows
const itemsHtml = invoice.items
  .map(
    (item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.productDataid.name}</td>
        <td>${item.productDataid.selectedCaret || "-"}</td>
        <td>${item.quantity}</td>
        <td>${item.productDataid.productDetails[0].attributes.grossWeight || "-"}</td>
        <td>${
          item.productDataid.productDetails.find(p => p.type === "Stone")?.attributes?.carat || "-"
        }</td>
        <td>${item.productDataid.productDetails[0].attributes.netWeight || "-"}</td>
        <td>${item.makingCharges?.toLocaleString() || "-"}</td>
        <td>${item.productValue?.toLocaleString() || "-"}</td>
        <td>${item.discount || "-"}</td>
        <td>${item.taxableValue?.toLocaleString() || "-"}</td>
      </tr>`
  )
  .join("");

// Build invoice HTML
const html = `
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
      .header { text-align: center; }
      .logo { width: 80px; margin-bottom: 8px; }
      .company { font-size: 16px; font-weight: bold; }
      .subhead { font-size: 12px; margin: 2px 0; }
      h3 { text-align: center; margin: 15px 0; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 11px; }
      th { background: #f2f2f2; }
      .two-col { display: flex; justify-content: space-between; margin-top: 10px; }
      .address { width: 48%; font-size: 11px; }
      .right { text-align: right; }
      .footer { margin-top: 15px; font-size: 11px; }
      .totals td { font-weight: bold; }
    </style>
  </head>
  <body>
    <!-- HEADER -->
    <div class="header">
 <img src="data:image/png;base64,${logoBase64}" class="logo"/>
      <div class="company">PRECIOUS GOLDSMITH</div>
      <div class="subhead">KSAN INDUSTRIES LLP &nbsp; | &nbsp; GSTIN NO: 33BAFK98176AIZK</div>
      <div class="subhead">New No:46, Old No:70/1, Bazullah Road, T Nagar, Chennai - 600017</div>
      <div class="subhead">contact@preciousgoldsmith.com | website: preciousgoldsmith.com</div>
    </div>

    <h3>Tax Invoice</h3>

    <!-- INVOICE DETAILS -->
    <table>
      <tr>
        <td><b>Invoice No:</b> ${invoice.orderCode}</td>
        <td><b>Order No:</b> ${invoice.orderNumber || "xxxxxxxxxxxx"}</td>
      </tr>
      <tr>
        <td><b>Invoice Date:</b> ${new Date(invoice.createdAt).toLocaleDateString()}</td>
        <td><b>Order Date & Time:</b> ${invoice.orderDateTime || "xxxxxxxxxxxx"}</td>
      </tr>
    </table>

    <!-- ADDRESSES -->
    <div class="two-col">
      <div class="address">
        <b>Customer Billing Address:</b><br/>
        ${invoice.billingAddress}
      </div>
      <div class="address">
        <b>Customer Shipping Address:</b><br/>
        ${invoice.shippingAddress}
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead>
        <tr>
          <th>Sl No</th>
          <th>Product Description</th>
          <th>Purity HSN</th>
          <th>Qty</th>
          <th>Gross Wt (g)</th>
          <th>Net Stone Wt (ct)</th>
          <th>Net Wt (g)</th>
          <th>Making Charges</th>
          <th>Product Value</th>
          <th>Discount</th>
          <th>Taxable Value</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td colspan="3">Total</td>
          <td>${invoice.totalQty}</td>
          <td>${invoice.totalGrossWt}</td>
          <td>${invoice.totalStoneCt || "-"}</td>
          <td>${invoice.totalNetWt}</td>
          <td>${invoice.totalMakingCharges}</td>
          <td>${invoice.totalProductValue}</td>
          <td>${invoice.totalDiscount}</td>
          <td>${invoice.totalTaxableValue}</td>
        </tr>
      </tfoot>
    </table>

    <!-- SUMMARY -->
    <table style="margin-top:10px;">
      <tr>
        <td><b>Invoice Amount (In Words):</b> ${invoice.amountInWords}</td>
      </tr>
      <tr>
        <td><b>Payment Mode:</b> ${invoice.paymentMode || "Non COD"}</td>
      </tr>
      <tr>
        <td><b>Balance Payable:</b> ${invoice.balance || "Nil"}</td>
      </tr>
    </table>

    <!-- TAX -->
    <table style="margin-top:10px;">
      <tr>
        <td>CGST @ 1.5%</td>
        <td class="right">${invoice.cgst}</td>
      </tr>
      <tr>
        <td>SGST @ 1.5%</td>
        <td class="right">${invoice.sgst}</td>
      </tr>
      <tr>
        <td><b>Total Amount</b></td>
        <td class="right"><b>${invoice.totalAmount.toLocaleString()}</b></td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div class="footer">
      <p><b>Standard Rate of Gold:</b> 24kt/22kt/18kt etc …</p>
      <p><b>Terms and Conditions:</b></p>
      <ol>
        <li>Refer our app/website for detailed terms and policies.</li>
        <li>Subject to Chennai Jurisdiction.</li>
        <li>Weight tolerance of ±0.020 g per product is considered normal.</li>
        <li>Products can be verified at BIS recognised Assaying & Hallmarking Centres.</li>
      </ol>
    </div>
  </body>
</html>
`;

    // Generate PDF using pdfmake service
    const { generateOrderInvoicePdf } = require('./services/pdfService');
    
    // Prepare invoice data for pdfmake
    const pdfInvoiceData = {
      invoiceNumber: invoice.orderCode,
      orderId: invoice.orderCode,
      customerName: invoice.customerName || 'Customer',
      customerEmail: invoice.customerEmail || '',
      customerPhone: invoice.customerPhone || '',
      customerAddress: invoice.deliveryAddress || '',
      items: invoice.items.map(item => ({
        name: item.productDataid?.name || 'Product',
        purity: item.productDataid?.selectedCaret || '-',
        quantity: item.quantity || 1,
        weight: item.productDataid?.productDetails?.[0]?.attributes?.grossWeight || '-',
        price: item.taxableValue || item.price || 0
      })),
      totalAmount: invoice.totalAmount,
      createdAt: invoice.createdAt
    };

    const pdfBuffer = await generateOrderInvoicePdf(pdfInvoiceData);

    // Send PDF response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=invoice.pdf",
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating invoice");
  }
});





// Socket.IO setup
const jwt = require('jsonwebtoken');
const User = require('./models/userModel');
const Admin = require('./models/adminModel');
const Chat = require('./models/chatModel');

// Store online users
const onlineUsers = new Map();

// Helper function to check if a role is an admin role
const isAdminRole = (role) => {
  if (!role) return false;
  const adminRoles = ['admin', 'super-admin', 'super_admin', 'moderator', 'support'];
  return adminRoles.includes(role);
};

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    // Try to get token from auth object first, then from query, then from headers
    let token = socket.handshake.auth?.token;
    
    if (!token) {
      // Try query parameter
      token = socket.handshake.query?.token;
    }
    
    if (!token) {
      // Try Authorization header
      const authHeader = socket.handshake.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      console.log('Socket auth: No token found');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is an admin token (has issuer and audience)
    const isAdminToken = decoded.iss === 'precious-jewels-admin' && decoded.aud === 'precious-jewels-admin-panel';
    
    let userId;
    let user, admin;
    
    if (isAdminToken) {
      // Admin token structure: { id: ..., email: ..., role: ..., ... }
      userId = decoded.id;
      admin = await Admin.findById(userId).select('-password -twoFactorSecret');
      
      if (!admin) {
        console.log('Socket auth: Admin not found for ID:', userId);
        return next(new Error('Admin not found'));
      }
      
      if (!admin.isActive) {
        console.log('Socket auth: Admin account is inactive');
        return next(new Error('Admin account is inactive'));
      }
      
      socket.userId = admin._id.toString();
      // Store the actual role from the admin model
      socket.userRole = admin.role || 'admin';
      socket.userName = admin.name || admin.email || 'Admin';
      
      console.log('Socket auth: Admin authenticated', {
        userId: socket.userId,
        role: socket.userRole,
        name: socket.userName
      });
    } else {
      // User token structure: { user: { id: ..., name: ... } } or { id: ... }
      if (decoded.user && decoded.user.id) {
        userId = decoded.user.id;
      } else if (decoded.id) {
        userId = decoded.id;
      } else {
        console.log('Socket auth: Invalid token structure', decoded);
        return next(new Error('Authentication error: Invalid token structure'));
      }

      user = await User.findById(userId).select('-password');
      
      if (!user) {
        console.log('Socket auth: User not found for ID:', userId);
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role || 'user';
      socket.userName = user.name || 'Unknown';
      
      console.log('Socket auth: User authenticated', {
        userId: socket.userId,
        role: socket.userRole,
        name: socket.userName
      });
    }
    
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    } else {
      return next(new Error('Authentication error: ' + error.message));
    }
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.userRole})`);
  
  // Add user to online users
  onlineUsers.set(socket.userId, {
    socketId: socket.id,
    userId: socket.userId,
    userRole: socket.userRole,
    userName: socket.userName,
    isOnline: true,
    lastSeen: new Date()
  });

  // Join user to their personal room
  socket.join(`user_${socket.userId}`);

  // If admin (any admin role), join admin room
  if (isAdminRole(socket.userRole)) {
    socket.join('admin_room');
  }

  // Handle joining chat room
  socket.on('join_chat', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Check if user is participant
      const isParticipant = chat.participants.some(
        p => p.userId.toString() === socket.userId
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(`chat_${chatId}`);
      socket.emit('joined_chat', { chatId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Handle sending message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, message, messageType = 'text', attachments = [] } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Check if user is participant
      const participant = chat.participants.find(
        p => p.userId.toString() === socket.userId
      );

      if (!participant) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Add message to chat
      const newMessage = {
        senderId: socket.userId,
        senderRole: participant.role,
        message,
        messageType,
        attachments,
        timestamp: new Date()
      };

      chat.messages.push(newMessage);
      await chat.save();

      // Populate sender info
      await chat.populate('messages.senderId', 'name email profilePhoto');

      const messageWithSender = chat.messages[chat.messages.length - 1];

      // Emit to all participants in the chat
      io.to(`chat_${chatId}`).emit('new_message', {
        chatId,
        message: messageWithSender,
        sender: {
          id: socket.userId,
          name: socket.userName,
          role: participant.role
        }
      });

      // Notify other participants if they're not in the chat room
      chat.participants.forEach(participant => {
        if (participant.userId.toString() !== socket.userId) {
          const userSocket = Array.from(onlineUsers.values()).find(
            user => user.userId === participant.userId.toString()
          );
          
          if (userSocket) {
            io.to(userSocket.socketId).emit('chat_notification', {
              chatId,
              message: message,
              sender: socket.userName,
              unreadCount: chat.messages.filter(msg => !msg.isRead).length
            });
          }
        }
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ========== TICKET SOCKET EVENTS ==========
  
  // Handle joining ticket room
  socket.on('join_ticket', async (ticketId) => {
    try {
      const Ticket = require('./models/ticket_model');
      // Handle both string and object ticketId
      const id = typeof ticketId === 'string' ? ticketId : (ticketId?.ticketId || ticketId);
      const ticket = await Ticket.findById(id);
      
      if (!ticket) {
        socket.emit('error', { message: 'Ticket not found' });
        return;
      }

      // Check if user has access (user who created or admin)
      const isOwner = ticket.user.toString() === socket.userId;
      const isAdmin = isAdminRole(socket.userRole);

      if (!isOwner && !isAdmin) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(`ticket_${ticketId}`);
      socket.emit('joined_ticket', { ticketId });
      
      // Send current ticket data - convert to plain object
      await ticket.populate('user', 'name email phone');
      await ticket.populate('replies.repliedBy', 'name email');
      
      // Convert Mongoose document to plain object
      const ticketObj = ticket.toObject();
      // Ensure user is a string ID for Flutter compatibility
      if (ticketObj.user && typeof ticketObj.user === 'object') {
        ticketObj.user = ticketObj.user._id ? ticketObj.user._id.toString() : ticketObj.user.toString();
      }
      // Ensure repliedBy is a string ID for each reply
      if (ticketObj.replies) {
        ticketObj.replies = ticketObj.replies.map(reply => ({
          ...reply,
          repliedBy: reply.repliedBy && typeof reply.repliedBy === 'object' 
            ? (reply.repliedBy._id ? reply.repliedBy._id.toString() : reply.repliedBy.toString())
            : reply.repliedBy?.toString() || reply.repliedBy,
          timestamp: reply.timestamp ? new Date(reply.timestamp).toISOString() : new Date().toISOString(),
          _id: reply._id ? reply._id.toString() : undefined
        }));
      }
      // Ensure dates are ISO strings
      if (ticketObj.createdAt) ticketObj.createdAt = new Date(ticketObj.createdAt).toISOString();
      if (ticketObj.updatedAt) ticketObj.updatedAt = new Date(ticketObj.updatedAt).toISOString();
      
      socket.emit('ticket_data', { ticket: ticketObj });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join ticket' });
    }
  });

  // Handle sending ticket message
  socket.on('send_ticket_message', async (data) => {
    try {
      const { ticketId, message, isInternal = false } = data;
      const Ticket = require('./models/ticket_model');
      
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        socket.emit('error', { message: 'Ticket not found' });
        return;
      }

      // Check access
      const isOwner = ticket.user.toString() === socket.userId;
      const isAdmin = isAdminRole(socket.userRole);

      if (!isOwner && !isAdmin) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Add reply to ticket
      const reply = {
        message,
        repliedBy: socket.userId,
        isInternal: isInternal && isAdmin, // Only admins can send internal notes
        timestamp: new Date()
      };

      if (!ticket.replies) ticket.replies = [];
      ticket.replies.push(reply);
      // Admin non-internal reply -> mark as unread for user
      if (!isOwner && isAdminRole(socket.userRole) && !(isInternal && isAdmin)) {
        ticket.readByUser = false;
      }
      await ticket.save();

      // Populate reply data
      await ticket.populate('replies.repliedBy', 'name email');
      await ticket.populate('user', 'name email phone');

      const newReply = ticket.replies[ticket.replies.length - 1];
      
      // Convert reply to plain object with proper formatting
      const replyObj = newReply.toObject ? newReply.toObject() : newReply;
      replyObj._id = replyObj._id ? replyObj._id.toString() : undefined;
      replyObj.repliedBy = replyObj.repliedBy && typeof replyObj.repliedBy === 'object'
        ? (replyObj.repliedBy._id ? replyObj.repliedBy._id.toString() : replyObj.repliedBy.toString())
        : replyObj.repliedBy?.toString() || replyObj.repliedBy;
      replyObj.timestamp = replyObj.timestamp ? new Date(replyObj.timestamp).toISOString() : new Date().toISOString();

      // Determine if sender is admin or user
      const isAdminSender = isAdminRole(socket.userRole);
      
      // Emit to all users in the ticket room
      io.to(`ticket_${ticketId}`).emit('new_ticket_message', {
        ticketId,
        reply: replyObj,
        sender: {
          id: socket.userId,
          name: socket.userName,
          role: socket.userRole,
          isAdmin: isAdminSender,
          isInternal: reply.isInternal
        }
      });

      // Notify the other party if they're not in the room
      const otherUserId = isOwner ? null : ticket.user.toString();
      if (otherUserId) {
        const otherUserSocket = Array.from(onlineUsers.values()).find(
          user => user.userId === otherUserId
        );
        
        if (otherUserSocket && !reply.isInternal) {
          io.to(otherUserSocket.socketId).emit('ticket_notification', {
            ticketId,
            message: message,
            sender: socket.userName,
            subject: ticket.subject
          });
        }

        // Create in-app notification for user when admin sends unread reply (same as chat workflow)
        if (!reply.isInternal) {
          try {
            const Notification = require('./models/notification_model');
            const messagePreview = message.length > 100 ? message.substring(0, 97) + '...' : message;
            const ticketNotification = new Notification({
              title: 'New reply on your support ticket',
              message: `${ticket.subject}: ${messagePreview}`,
              type: 'support_ticket',
              priority: 'normal',
              targetAudience: 'specific_users',
              targetUsers: [ticket.user],
              status: 'sent',
              createdBy: socket.userId,
              metadata: { ticketId: ticket._id.toString() },
              actionType: 'open_screen',
              screenName: 'support_ticket',
            });
            await ticketNotification.save();
          } catch (notifErr) {
            console.error('Failed to create ticket reply notification:', notifErr);
          }
        }
      }

      // Notify admins if user sent a message
      if (isOwner && !reply.isInternal) {
        // Convert ticket to plain object for admin notification
        const ticketObj = ticket.toObject();
        if (ticketObj.user && typeof ticketObj.user === 'object') {
          ticketObj.user = ticketObj.user._id ? ticketObj.user._id.toString() : ticketObj.user.toString();
        }
        io.to('admin_room').emit('new_ticket_reply', {
          ticketId,
          ticket: ticketObj,
          reply: replyObj
        });
      }

    } catch (error) {
      console.error('Send ticket message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle ticket status update
  socket.on('update_ticket_status', async (data) => {
    try {
      const { ticketId, status, adminNote } = data;
      const Ticket = require('./models/ticket_model');
      
      // Only admins can update status
      if (!isAdminRole(socket.userRole)) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        socket.emit('error', { message: 'Ticket not found' });
        return;
      }

      ticket.status = status || ticket.status;
      if (adminNote) ticket.adminNote = adminNote;
      ticket.updatedBy = socket.userId;
      await ticket.save();

      await ticket.populate('user', 'name email phone');
      await ticket.populate('replies.repliedBy', 'name email');

      // Convert ticket to plain object with proper formatting
      const ticketObj = ticket.toObject();
      if (ticketObj.user && typeof ticketObj.user === 'object') {
        ticketObj.user = ticketObj.user._id ? ticketObj.user._id.toString() : ticketObj.user.toString();
      }
      if (ticketObj.replies) {
        ticketObj.replies = ticketObj.replies.map(reply => ({
          ...reply,
          repliedBy: reply.repliedBy && typeof reply.repliedBy === 'object' 
            ? (reply.repliedBy._id ? reply.repliedBy._id.toString() : reply.repliedBy.toString())
            : reply.repliedBy?.toString() || reply.repliedBy,
          timestamp: reply.timestamp ? new Date(reply.timestamp).toISOString() : new Date().toISOString(),
          _id: reply._id ? reply._id.toString() : undefined
        }));
      }
      if (ticketObj.createdAt) ticketObj.createdAt = new Date(ticketObj.createdAt).toISOString();
      if (ticketObj.updatedAt) ticketObj.updatedAt = new Date(ticketObj.updatedAt).toISOString();

      // Emit status update to all users in ticket room
      io.to(`ticket_${ticketId}`).emit('ticket_status_updated', {
        ticketId,
        ticket: ticketObj,
        updatedBy: {
          id: socket.userId,
          name: socket.userName
        }
      });

      // Notify ticket owner
      const ownerSocket = Array.from(onlineUsers.values()).find(
        user => user.userId === ticket.user.toString()
      );
      
      if (ownerSocket) {
        io.to(ownerSocket.socketId).emit('ticket_status_notification', {
          ticketId,
          status: ticket.status,
          subject: ticket.subject
        });
      }

    } catch (error) {
      socket.emit('error', { message: 'Failed to update ticket status' });
    }
  });

  // Handle typing indicator for tickets
  socket.on('ticket_typing', (data) => {
    const { ticketId, isTyping } = data;
    socket.to(`ticket_${ticketId}`).emit('user_typing_ticket', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping
    });
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping
    });
  });

  // Handle marking messages as read
  socket.on('mark_read', async (data) => {
    try {
      const { chatId } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) return;

      // Mark messages as read
      chat.messages.forEach(msg => {
        if (!msg.readBy.some(read => read.userId.toString() === socket.userId)) {
          msg.readBy.push({
            userId: socket.userId,
            readAt: new Date()
          });
        }
      });

      await chat.save();

      // Notify other participants
      socket.to(`chat_${chatId}`).emit('messages_read', {
        chatId,
        userId: socket.userId,
        userName: socket.userName
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    onlineUsers.delete(socket.userId);
    
    // Notify admin room about user going offline
    socket.to('admin_room').emit('user_offline', {
      userId: socket.userId,
      userName: socket.userName
    });
  });

  // Handle user going online/offline
  socket.on('user_status', (data) => {
    const { isOnline } = data;
    const user = onlineUsers.get(socket.userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = new Date();
    }
  });
});




const BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const CLIENT_VERSION = "1";
// Get access token
async function getAuthToken() {
  try {
    
  const url = `https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token`;
  const params = new URLSearchParams({
    client_id: "TEST-M23HLKE4QF87Z_25102",
    client_secret: "Y2E1NWFhOGQtZjQ1YS00MjNmLThiZDYtYjA1NjlhMWUwOTVl",
    grant_type: "client_credentials",
    client_version: CLIENT_VERSION,
  });
  const res = await axios.post(url, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  console.log('resrseres',res.data)
  return res.data.access_token;
  } catch (error) {
    console.log('getoken',error);
  }
}

// Create Subscription
// app.post("/autopay/create", async (req, res) => {
//   try {
//     const { amount } = req.body;
//     const token = await getAuthToken();

//     console.log("token",token);

//     const payload = {
//       merchantOrderId: "ORDER-" + Date.now(),
//       amount,
//       expireAt: Date.now() + 10 * 60 * 1000,
//       paymentFlow: {
//         type: "SUBSCRIPTION_SETUP",
//         merchantSubscriptionId: "SUB-" + Date.now(),
//         authWorkflowType: "TRANSACTION",
//         amountType: "FIXED",
//         maxAmount: amount,
//         frequency: "ON_DEMAND",
//         paymentMode: {
//           type: "UPI_INTENT",
//           targetApp: "com.precious.goldsmith",
//         },
//       },
//       deviceContext: { deviceOS: "ANDROID" },
//     };

//     const resp = await axios.post(`${BASE_URL}/subscriptions/v2/setup`, payload, {
//       headers: {
//         Authorization: `O-Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//     });

//     res.json(resp.data);
//   } catch (err) {
//     res.status(500).json({
//       error: err.response?.data || err.message,
//     });
//   }
// });

 
// app.post("/autopay/setup", async (req, res) => {
//   try {
//     // Replace these values with dynamic ones if needed
//     const merchantOrderId = `MO${Date.now()}`;
//     const merchantSubscriptionId = `MS${Date.now()}`;
//     const amount = 200; // in paise
//     const expireAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours later

//     const requestBody = {
//       merchantOrderId,
//       amount,
//       expireAt,
//       paymentFlow: {
//         type: "SUBSCRIPTION_SETUP",
//         merchantSubscriptionId,
//         authWorkflowType: "TRANSACTION",
//         amountType: "FIXED",
//         maxAmount: amount,
//         frequency: "ON_DEMAND",
//         expireAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
//         paymentMode: {
//           type: "UPI_INTENT",
//           targetApp: "com.phonepe.app",
//         },
//       },
//       deviceContext: {
//         deviceOS: "ANDROID",
//       },
//     };
//     const token = await getAuthToken();
// console.log("token",token);
//     // Authorization token (from PhonePe)
//     // const token =
//     //   "O-Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzT24iOjE3MTIyNTM2MjU2NDQsIm1lcmNoYW50SWQiOiJWMlNVQlVBVCJ9.7aVzYI_f_77-bBicEcRNuYx093b2wCsgl_WFNkKqAPY";

//     const response = await axios.post(
//       "https://api-preprod.phonepe.com/apis/pg-sandbox/subscriptions/v2/setup",
//       requestBody,
//       {
//         headers: {
//           Accept: "application/json",
//           Authorization: token,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("PhonePe Response:", response.data);
//     return res.status(200).json(response.data);
//   } catch (error) {
//     console.error("PhonePe Subscription Error:", error.response?.data || error.message);
//     return res.status(500).json({ error: error.response?.data || error.message });
//   }
// });


// 📍 Subscription setup API
app.post("/autopay/setup", async (req, res) => {
  try {
    // const {
    //   merchantOrderId,
    //   amount,
    //   vpa,
    //   maxAmount,
    //   merchantSubscriptionId,
    // } = req.body;

    // Prepare payload
    const payload = {
      merchantOrderId: `MO${Date.now()}`,
      amount:  200,
      expireAt: Date.now() + 1000 * 60 * 60, // 1 hour from now
      metaInfo: {
        udf1: "some meta info 1",
        udf2: "some meta info 2",
        udf3: "some meta info 3",
        udf4: "some meta info 4",
        udf5: "some meta info 5",
      },
      paymentFlow: {
        type: "SUBSCRIPTION_SETUP",
        merchantSubscriptionId: `MS${Date.now()}`,
        authWorkflowType: "TRANSACTION",
        amountType: "VARIABLE",
        maxAmount: 2000,
        frequency: "ON_DEMAND",
        expireAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
        paymentMode: {
          type: "UPI_COLLECT",
          details: {
            type: "VPA",
            vpa: "7092053592@ybl",
          },
        },
      },
    };
    const token = await getAuthToken();
        console.log(" token response:", token);

    // Axios config
 
    const body=
//       {
//     "merchantOrderId": "MO1709025691805",
//     "amount": 200,
//     "expireAt": 1709058548000,
//     "metaInfo": {
//         "udf1": "some meta info of max length 256",
//         "udf2": "some meta info of max length 256",
//         "udf3": "some meta info of max length 256",
//         "udf4": "some meta info of max length 256",
//         "udf5": "some meta info of max length 256"
//     },
//     "paymentFlow": {
//         "type": "SUBSCRIPTION_SETUP",
//         "merchantSubscriptionId": "MS1709025691805",
//         "authWorkflowType": "TRANSACTION",
//         "amountType": "VARIABLE",
//         "maxAmount": 2000,
//         "frequency": "ON_DEMAND",
//         "expireAt": 1737278524000,
//         "paymentMode": {
//             "type": "UPI_COLLECT",
//             "details": {
//                 "type": "VPA",
//                 "vpa": "999@ybl"
//             }
//         }
//     }
// }

{
    "merchantOrderId": "MO1709025658932",
    "amount": 200,
    "expireAt": 1709058548000,
    "metaInfo": {
        "udf1": "some meta info of max length 256",
        "udf2": "some meta info of max length 256",
        "udf3": "some meta info of max length 256",
        "udf4": "some meta info of max length 256",
        "udf5": "some meta info of max length 256"
    },
    "paymentFlow": {
        "type": "SUBSCRIPTION_SETUP",
        "merchantSubscriptionId": "MS1709025658932",
        "authWorkflowType": "TRANSACTION",
        "amountType": "FIXED",
        "maxAmount": 200,
        "frequency": "ON_DEMAND",
        "expireAt": 1737278524000,
        "paymentMode": {
            "type": "UPI_INTENT",
            "targetApp": "com.phonepe.app"
        }
    },
    "deviceContext": {
        "deviceOS": "ANDROID"
    }
}
    

    // const resp = await axios.post("https://api-preprod.phonepe.com/apis/pg-sandbox/subscriptions/v2/setup", payload, {
    //   headers: {
    //     Authorization: `O-Bearer ${token}`,
    //     "Content-Type": "application/json",
    //   },
    // });


   const config = {
      method: "post",
      url: "https://api-preprod.phonepe.com/apis/pg-sandbox/subscriptions/v2/setup",
      // url: "https://api-preprod.phonepe.com/apis/pg-sandbox/v2/validate/upi",
      headers: {
        "Content-Type": "application/json",
      Authorization: `O-Bearer ${token}`,
      },
      data: JSON.stringify(body),
      maxBodyLength: Infinity,
    };
    
        const response = await axios.request(config);

    // // Send request to PhonePe
    // const response = await axios.request(config);
    console.log("✅ PhonePe response:", response.data);

    // Send back to Flutter app
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ PhonePe subscription setup failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});






// Check subscription status
app.get("/autopay/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const token = await getAuthToken();
    const resp = await axios.get(`${BASE_URL}/subscriptions/v2/order/${orderId}/status`, {
      headers: { Authorization: `O-Bearer ${token}` },
    });
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Execute AutoPay charge
app.post("/autopay/execute", async (req, res) => {
  try {
    const { subscriptionId, amount } = req.body;
    const token = await getAuthToken();

    const payload = {
      merchantOrderId: "ORDER-" + Date.now(),
      amount,
      merchantSubscriptionId: subscriptionId,
    };

    const resp = await axios.post(`${BASE_URL}/subscriptions/v2/execute`, payload, {
      headers: {
        Authorization: `O-Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    res.json(resp.data);
  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Revoke/Cancel subscription
app.post("/autopay/revoke", async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const token = await getAuthToken();

    const payload = {
      merchantSubscriptionId: subscriptionId,
    };

    const resp = await axios.post(`${BASE_URL}/subscriptions/v2/revoke`, payload, {
      headers: {
        Authorization: `O-Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    res.json(resp.data);
  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});



const CONFIG = {
  baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  clientId: 'TEST-M23HLKE4QF87Z_25102',
  clientSecret: 'Y2E1NWFhOGQtZjQ1YS00MjNmLThiZDYtYjA1NjlhMWUwOTVl',
  merchantId: 'M23HLKE4QF87Z',
};

// Get Auth Token
app.post('/api/phonepe/auth-token', async (req, res) => {
  try {
    const response = await axios.post(
      `${CONFIG.baseUrl}/v1/oauth/token`,
      {
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
        grant_type: 'client_credentials',
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Order
app.post('/api/phonepe/create-order', async (req, res) => {
  try {
    const { amount, merchantOrderId, userId } = req.body;
    
    // First get auth token
    const tokenResponse = await axios.post(
      `${CONFIG.baseUrl}/v1/oauth/token`,
      {
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
        grant_type: 'client_credentials',
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Create order
    const orderResponse = await axios.post(
      `${CONFIG.baseUrl}/checkout/v2/sdk/order`,
      {
        amount: amount,
        currency: 'INR',
        merchantOrderId: merchantOrderId,
        merchantUserId: userId,
        redirectUrl: 'https://yourwebsite.com/callback',
        redirectMode: 'POST',
        callbackUrl: 'https://yourwebsite.com/webhook',
      },
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    res.json(orderResponse.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check Status
app.get('/api/phonepe/check-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get auth token first
    const tokenResponse = await axios.post(
      `${CONFIG.baseUrl}/v1/oauth/token`,
      {
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
        grant_type: 'client_credentials',
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Check status
    const statusResponse = await axios.get(
      `${CONFIG.baseUrl}/checkout/v2/sdk/order/${orderId}`,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
        },
      }
    );
    
    res.json(statusResponse.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT} (accessible from local network)`);
  startGoldPriceScheduler();
  startNotificationScheduler();
  // Daily autopay: run at 9:00 AM IST for ACTIVE + DAILY subscriptions not yet charged today
  const dailyAutopayJob = CronJob.from({
    cronTime: "0 9 * * *",
    onTick: runDailyAutopayCharges,
    timeZone: "Asia/Kolkata",
    start: true,
  });
  console.log("Autopay daily cron scheduled at 9:00 AM IST");
});
