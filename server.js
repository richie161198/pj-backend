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
const puppeteer = require("puppeteer");
const fs = require("fs");

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
app.use(cors());

app.get("/", (req, res) => {
  console.log("started");
  res.status(200).json({ status: "true", message: "api is working properly" });
  console.log("api is working properly");
});


// app.use("/api/v1", apiRoutes);

// app.use(notFound);
// app.use(errorHandler);

// app.post("/create-order", async (req, res) => {
//   console.log("sddsds");
//   try {
//     var request = {
//       order_amount: 100,
//       order_currency: "INR",
//       order_id: "order_34708045",
//       customer_details: {
//         customer_id: "walterwNdrcMi",
//         customer_phone: "9999999999",
//       },
//       order_meta: {
//         return_url:
//           "https://www.cashfree.com/devstudio/preview/pg/web/checkout?order_id={order_id}",
//       },
//     };
//     cashfree
//       .PGCreateOrder(request)
//       .then((response) => {
//         console.log("Order Created successfully:", response.data);
//         res.json({ message: response.data });
//       })
//       .catch((error) => {
//         console.error("Error:", error.response.data.message);
//         res.json({ message: response.data.message });
//       });
//   } catch (err) {
//     console.error(err.response?.data || err);
//     res
//       .status(500)
//       .json({
//         error: "Create order failed",
//         details: err.response?.data || err.message,
//       });
//   }
// });

const CLIENT_ID = process.env.TCLIENT_ID;
const CLIENT_SECRET = process.env.TCLIENT_SECRET;
const API_VERSION = "2025-01-01";

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
app.use("/api/v0/images", require("./routers/imageRouter"));
app.use("/api/v0/chat", require("./routers/chatRouter"));
app.use("/api/v0/notifications", require("./routers/notificationRouter"));
app.use("/api/v0/maintenance", require("./routers/maintenanceRouter"));
app.use("/api/v0/invoices", require("./routers/invoiceRouter"));


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

    // Launch Puppeteer & generate PDF
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20px", bottom: "20px" }
    });

    await browser.close();

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
const Chat = require('./models/chatModel');

// Store online users
const onlineUsers = new Map();

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.userName = user.name;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
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

  // If admin, join admin room
  if (socket.userRole === 'admin') {
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

server.listen(process.env.PORT, () => {
  console.log(`Server on ${process.env.PORT} `);
});
