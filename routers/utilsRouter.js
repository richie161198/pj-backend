const asyncHandler = require("express-async-handler");
const { getGoldPrice, getbanners, uploadimages, sendMailotp, createInvestmentSettings, getInvestmentSettings, updateAllProductPricesManually, updateSingleProductPrice, getProductPriceBreakdown, getInvestmentOption, updateInvestmentOption } = require("../controller/utilsController");
const { getPolicyByType, getAllPolicies, createOrUpdatePolicy, deletePolicy } = require("../controller/policyController");
const express = require("express");
const multer = require('multer');
const { adminAuth } = require("../middleware/adminAuth");
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Investment Settings Routes
router.route("/investmentSettingsDetails").get(getInvestmentSettings);
router.route("/admin/createinvestmentSettings").post(adminAuth, createInvestmentSettings);

// Investment Option Routes
router.route("/investmentOption").get(getInvestmentOption);
router.route("/admin/investmentOption").put(adminAuth, updateInvestmentOption);

// Product Price Update Routes - Admin Protected
router.route("/admin/updateAllProductPrices").post(adminAuth, updateAllProductPricesManually);
router.route("/admin/updateProductPrice/:id").post(adminAuth, updateSingleProductPrice);
router.route("/admin/productPriceBreakdown/:id").get(adminAuth, getProductPriceBreakdown);

// Utility Routes
router.route("/sendOtp").post(sendMailotp);
router.route("/banners").get(getbanners);
router.route("/upload").post(upload.single("file"), uploadimages);

// Policy Routes - Public
router.route("/policies").get(getAllPolicies);
router.route("/policies/:type").get(getPolicyByType);

// Policy Routes - Admin Protected
router.route("/admin/policies").post(adminAuth, createOrUpdatePolicy);
router.route("/admin/policies/:type").delete(adminAuth, deletePolicy);

module.exports = router;
