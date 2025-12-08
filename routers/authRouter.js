const express = require("express");
const router = express.Router();
const { validateToken, isAuth } = require("../middleware/tokenValidation");
const multer = require("multer");
const {
  signUpRequest,
  signInRequest,forgotPassword,forgotPasswordRequest,
  // adminSignUpRequest,
  mail,
  SendOTP,
  verifyOtp,
  updatePassword,
  activateAccount,
  verifyPan,
  verifyBankAccount,
  sendMobileOtp,
  verifyMobileOtp,
  // adminSignInRequest
  // sendLoginOtp,
  // verifyOtp,
} = require("../controller/authController");

router.route("/register").post(signUpRequest);
router.route("/login").post(signInRequest);
router.route("/forgotPasswordRequest").post(forgotPasswordRequest);
router.route("/SendOTP").post(SendOTP);
router.route("/verifyOtp").post(verifyOtp);
router.route("/sendMobileOtp").post(isAuth,sendMobileOtp);
router.route("/verifyMobileOtp").post(isAuth,verifyMobileOtp);
router.route("/updatePassword").post(updatePassword);
router.route("/activateAccount").post(activateAccount);
router.route("/verifypan").post(isAuth,verifyPan);
router.route("/verifyBankAccount").post(isAuth,verifyBankAccount);
router.route("/mail").post(mail);

module.exports = router;
