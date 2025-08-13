const mongoose = require("mongoose");
const expressAsyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

module.exports.generateToken = (data) => {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "1d" });
};

module.exports.referral = () => {
  let result = "",
    characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    Length = characters.length;
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * Length));
  }
  return result;
};

module.exports.generateOTP = () => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

module.exports.appId = () => {
  let result = "EST",
    characters = "0123456789",
    Length = characters.length;
  for (let i = 0; i < 9; i++) {
    result += characters.charAt(Math.floor(Math.random() * Length));
  }
  return result;
};
