const asyncHandler = require("express-async-handler");
const crypto = require("../helpers/crypto");
const helper = require("../helpers/helpers");
const multer = require("multer");
const { generateToken } = require("../helpers/helpers");
// const User = require("../models/userModel");
// const adminModel = require("../models/admin_model");
const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { sendMail, sendEmail } = require("../helpers/mailer");

const signUpRequest = asyncHandler(async (req, res) => {
  const { name, email, phone, password, referredBy } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please enter all fields");
  }
  try {
    const userAvailable = await userModel.findOne({ email });

    if (userAvailable) {
      res.status(400);
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const referralCode = helper.referral();
    const appId = helper.appId();

    const otp = helper.generateOTP();
    const htmlContent = `
      <h2>Your OTP Code</h2>
      <p>Dear ${name || "User"},</p>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

    await sendEmail(email, "Your OTP Code", htmlContent, name);
    const user = await userModel.create({
      name,
      email,
      otp: otp,
      referralCode: referralCode,
      referredBy: referredBy,
      appId: appId,
      phone,
      password: hashedPassword,
    });

    if (user) {
      if (data == true)
        res.status(200).json({
          status: true,
          message: "We have sent otp your email to verify it",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        });
      if (data == false)
        res.status(404).json({ message: "Failed - Please try again" });
    } else {
      res.status(400).json({ message: "User already exist" });
      throw new Error("Use already Exist");
    }
  } catch (error) {
    console.log("err signup: ", error);
  }
});

const signInRequest = asyncHandler(async (req, res) => {
  console.log(req.headers);

  const { email, password } = req.body;
  console.log(req.body);
  console.log(email, password);

  if (!email || !password) {
    res.status(400);
    throw new Error("Please enter all fields");
  }
  const user = await userModel.findOne({ email });

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }
  const userAvailable = await bcrypt.compare(password, user.password);
  if (!userAvailable) {
    res.status(400);
    throw new Error("Invalid password");
  }
  console.log("approved");

  user.lastLogin = new Date();
  await user.save();
  const accessToken = generateToken({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  res.status(200).json({
    status: "success",
    token: accessToken,
  });
});

const mail = async (req, res) => {
  try {
    const data = sendMail(req.body.to, req.body.subject, req.body.text);
    if (data == true)
      res.status(200).json({ message: "successfully send mail" });
    if (data == false) res.status(404).json({ message: "Failed to send mail" });
  } catch (error) {
    res.status(404).json({ message: "failed", err: error });
  }
};

// Forgot Password Request
const SendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
console.log("Forgot Password Request for:", email);
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    // Generate OTP
    const otp = helper.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
console.log("OTP:", otp, "Expiry:", otpExpiry);
    // Send Email
    const htmlContent = `
      <h2>Password Reset OTP</h2>
      <p>Dear ${user.name || "User"},</p>
      <p>Your OTP for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

    await sendEmail(email, "Password Reset OTP", htmlContent, user.name);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    res.status(200).json({
      status: true,
      message: "OTP sent to your email for password reset",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Please provide email and OTP");
  }
  try{
      const user = await userModel.findOne({ email });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      res.status(400);
      throw new Error("Invalid or expired OTP");
    }
    res.status(200).json({
      status: true,
      message: "OTP verified successfully",
    });
    // Optionally, you can clear the OTP after verification
    user.otp = null; // Clear OTP after successful verification
    user.otpExpiry = null; // Clear OTP expiry
    await user.save();  

  }catch (error) {
    console.error("Error in OTP verification:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});


const forgotPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error("Please provide all fields");
  }

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    if (user.otp !== otp || user.otpExpiry < new Date()) {
      res.status(400);
      throw new Error("Invalid or expired OTP");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.otp = null; // Clear OTP after successful reset
    user.otpExpiry = null; // Clear OTP expiry
    await user.save();

    res.status(200).json({
      status: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error in password reset:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});


// const adminSignUpRequest = async (req, res) => {
//     const { name, email, password } = req.body;

//     try {
//         if (!name || !email || !password) return res.status(403).json({ status: false, message: "All fields must be provided" });
//         const adminExist = await adminModel.findOne({ email })
//         if (adminExist) {
//             res.status(400);
//             throw new Error("Admin already exists");
//         } else {
//             const hashedPassword = await bcrypt.hash(password, 10);
//             const admin = await adminModel.create({ name, email, hashedPassword });

//             res.status(200).json({ status: true, message: "Created successfully", details: admin });

//         }
//     } catch (error) {

//         res.status(400).json({ message: error.message });
//         // throw Error();

//     }

// }

module.exports = {
  signUpRequest,
  signInRequest,
  forgotPassword,
  verifyOtp,
  SendOTP,
  mail,
  // adminSignInRequest
};
