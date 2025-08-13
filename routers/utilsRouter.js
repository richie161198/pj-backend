const asyncHandler = require("express-async-handler");
const { getGoldPrice, getbanners, uploadimages, sendMailotp,} = require("../controller/utilsController")
const express = require("express");
const multer = require('multer');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage })

router.route("/goldPrice").get(getGoldPrice);
router.route("/sendOtp").post(sendMailotp);
router.route("/banners").get(getbanners);

router.route("/upload").post(upload.single("file"),uploadimages);
module.exports = router;
