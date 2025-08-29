const { default: axios } = require("axios");
const asyncHandler = require("express-async-handler");
const { generateOTP } = require("../helpers/helpers");
const { sendEmail } = require("../helpers/mailer");


const getGoldPrice = asyncHandler(async (req, res) => {
    console.log("gold price");
  try {
    const response = await axios.get('https://www.goldapi.io/api/XAU/INR', {
      headers: {
        'x-access-token': "goldapi-4y761smdi9d802-io",
        'Content-Type': 'application/json'
      }
    });
    const data = response.data;
      
    const result = {
      name: "Gold",
      price: data.price,
      symbol: "XAU",
        updatedAt: data.timestamp,
        price_gram_24k: data.price_gram_24k,
        price_gram_22k:data.price_gram_22k,
      
      updatedAtReadable: data.date
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching gold price:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});
const getbanners = asyncHandler(async (req, res) => {
    res.status(200).json({message:"banners"})
})

const sendMailotp = asyncHandler( async (req, res) => {
  try {
    const { toEmail, toName } = req.body;
console.log("sendMailotp", toEmail, toName);
    if (!toEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const otp = generateOTP();
    const htmlContent = `
      <h2>Your OTP Code</h2>
      <p>Dear ${toName || 'User'},</p>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

  

    const response = await sendEmail(toEmail, 'Your OTP Code', htmlContent, toName);


    res.json({ success: true, data: response, otp });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

const uploadimages = asyncHandler(async (req, res) => {
  // console.log(req.file);
  //   if (!req.file) {
  //   return res.status(400).json({ error: 'No file uploaded' });
  // }

  // cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     return res.status(500).json({ error: 'Error uploading to Cloudinary' });
  //   }
  //   res.json({ public_id: result.public_id, url: result.secure_url });
  // }).end(req.file.buffer);
})

module.exports={getGoldPrice,sendMailotp,getbanners,uploadimages}