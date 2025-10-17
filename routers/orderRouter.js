const asyncHandler = require("express-async-handler");
const express = require("express");
const {
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory, depositINR, withdrawINR, buyOrSellGold, placeOrder, returnOrder, refundOrder, getOrderHistory,
  createOrder, getAllOrdersAdmin, getAllProductOrdersAdmin} = require("../controller/orderController")
// const { validateToken } = require("../middleware/tokenValidation");
const { isAuth } = require("../middleware/tokenValidation");

const router = express.Router();

router.route("/depositInr").post(depositINR);
// router.route("/depositInr").post(validateToken,depositINR);
router.route("/withdrawInr").post(withdrawINR);
// router.route("/withdrawInr").post(validateToken,withdrawINR);
// router.route("/getBalance").post(getBalance);
router.route("/orderGold").post(isAuth,buyOrSellGold);
router.route("/allorder").get(getAllOrderHistory);
router.route("/admin/allorders").get(isAuth, getAllOrdersAdmin);
router.route("/admin/allproductorders").get(isAuth, getAllProductOrdersAdmin);
router.route("/userOrderHistory").get(isAuth,getUserOrderHistory);
router.route("/orderTransaction").get(isAuth,getParticularOrderHistory);
router.route("/create-order").post(isAuth,createOrder);



router.route("/placeOrder").post(isAuth,placeOrder);
router.route("/refundOrder").post(isAuth,refundOrder);
router.route("/returnOrder").post(isAuth,returnOrder);
router.route("/getOrderHistory").get(isAuth,getOrderHistory);


module.exports = router;