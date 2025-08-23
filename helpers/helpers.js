const mongoose = require("mongoose");
const expressAsyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const bcrypt = require("bcryptjs");
const crypto = require('crypto');

function generateToken  (data)  {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "1d" });
};

function referral () {
  let result = "",
    characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    Length = characters.length;
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * Length));
  }
  return result;
};

function generateOTP  ()  {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

function appId  ()  {
  let result = "EST",
    characters = "0123456789",
    Length = characters.length;
  for (let i = 0; i < 9; i++) {
    result += characters.charAt(Math.floor(Math.random() * Length));
  }
  return result;
};



// /** Generate a 6-digit OTP as a string */
function generateNumericOtp(length = 6) {
  // cryptographically strong random digits
  let otp = '';
  while (otp.length < length) {
    otp += (crypto.randomInt(0, 10)).toString();
  }
  return otp;
}
function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).toLowerCase());
}
/** Hash any sensitive value (OTP) */
async function hashValue(value) {
  const saltRounds = 10;
  return bcrypt.hash(value, saltRounds);
}

async function compareValue(value, hash) {
  return bcrypt.compare(value, hash);
}

module.exports = {
  generateNumericOtp,referral,
  hashValue,
  compareValue,isEmail,generateOTP,appId,generateToken
};
