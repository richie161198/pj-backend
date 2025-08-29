const asyncHandler = require("express-async-handler");
const { updateuserById, getuserById, getAllUser,getGoldprice, deleteuserById, setTransactionPin, verifyTransactionPin} = require("../controller/userContoller")
const express = require("express");
const multer = require('multer');
const { isAuth } = require("../middleware/tokenValidation");
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage })

router.route("/getAllUser").post(getAllUser);
router.route("/getuserById").get(isAuth,getuserById);
router.route("/updateuserById/:id").post(updateuserById);
router.route("/deleteuserById/:id").post(deleteuserById);
// router.route("/set-transaction-pin").post(isAuth, setTransactionPin);
// router.route("/verify-transaction-pin").post(isAuth, verifyTransactionPin);

router.post("/set-transaction-pin", isAuth, setTransactionPin);
router.post("/verify-transaction-pin", isAuth, verifyTransactionPin);

module.exports = router;
