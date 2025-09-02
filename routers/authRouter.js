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
router.route("/sendMobileOtp").post(sendMobileOtp);
router.route("/verifyMobileOtp").post(verifyMobileOtp);
router.route("/updatePassword").post(updatePassword);
router.route("/activateAccount").post(activateAccount);
router.route("/verifypan").post(isAuth,verifyPan);
router.route("/verifyBankAccount").post(isAuth,verifyBankAccount);
// router.route("/adminRegister").post(adminSignUpRequest);
// router.route("/adminLogin").post(adminSignInRequest);
router.route("/mail").post(mail);

// const storage = multer.memoryStorage();
// const upload = multer({storage:storage});
// router.route("/uploadPic").post(upload.single("file"), uploadImage);
// router.route("/rdata").post(validateToken, test);
// router.route("/sendOtp").post(sendLoginOtp);
// router.route("/verifyOtp").post(verifyOtp);

module.exports = router;
