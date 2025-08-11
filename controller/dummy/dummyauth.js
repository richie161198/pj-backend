const asyncHandler = require("express-async-handler");
const User = require("../../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require("sib-api-v3-sdk");

// helper to send sign-up email via SendinBlue
const sendSignupEmail = async (user) => {
  try {
    if (!process.env.SENDINBLUE_API_KEY) return;
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = process.env.SENDINBLUE_API_KEY;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Welcome to " + (process.env.SENDINBLUE_SENDER_NAME || "Our Store");
    sendSmtpEmail.htmlContent = `<html><body><h2>Hi ${user.name || "Customer"},</h2><p>Thank you for registering.</p></body></html>`;
    sendSmtpEmail.sender = { email: process.env.SENDINBLUE_SENDER_EMAIL, name: process.env.SENDINBLUE_SENDER_NAME };
    sendSmtpEmail.to = [{ email: user.email, name: user.name }];
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err) {
    console.error("SendinBlue send error:", err);
  }
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: false, message: "Email and password required" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ status: false, message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, phone, password: hashed });
  await user.save();

  // fire-and-forget email
  sendSignupEmail(user);

  res.status(201).json({
    status: true,
    message: "User registered",
    details: {
      id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id)
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: false, message: "Email and password required" });
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ status: false, message: "Invalid credentials" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ status: false, message: "Invalid credentials" });

  res.json({
    status: true,
    details: {
      id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
      role: user.role
    }
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  res.json({ status: true, details: user });
});

module.exports = { register, login, getProfile };
