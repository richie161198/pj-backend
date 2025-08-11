const asyncHandler = require("express-async-handler");
const express = require("express");
const {
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory, depositINR, withdrawINR, buyOrSellGold } = require("../controller/orderController")
// const { validateToken } = require("../middleware/tokenValidation");

const router = express.Router();

router.route("/depositInr").post(depositINR);
// router.route("/depositInr").post(validateToken,depositINR);
router.route("/withdrawInr").post(withdrawINR);
// router.route("/withdrawInr").post(validateToken,withdrawINR);
// router.route("/getBalance").post(getBalance);
router.route("/orderGold").post(buyOrSellGold);
router.route("/allorder").get(getAllOrderHistory);
router.route("/userOrderHistory").get(getUserOrderHistory);
router.route("/orderTransaction").get(getParticularOrderHistory);


module.exports = router;