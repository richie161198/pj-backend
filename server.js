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
app.use("/api/v0/users", require("./routers/userRouter"));
app.use("/api/v0/utils", require("./routers/utilsRouter"));
app.use("/api/v0/order", require("./routers/orderRouter"));
app.use("/api/v0/commerce", require("./routers/productRouter"));


// Start server
// app.all("*", (req, res) => {
//   res.status(404).json({ status: "false", message: "route not found" });
// });

// app.use(errorHandler);

server.listen(process.env.PORT, () => {
  console.log(`Server on ${process.env.PORT} `);
});
