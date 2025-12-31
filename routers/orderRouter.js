const asyncHandler = require("express-async-handler");
const express = require("express");
const {
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory, depositINR, withdrawINR, buyOrSellGold,generateTokenPhonePe,createOrderPhonePe, placeOrder, returnOrder, refundOrder, createReturnRefundRequest, getOrderHistory,
   getAllOrdersAdmin, getAllProductOrdersAdmin, getAllReturnRefundRequestsAdmin,checkPhonePeOrderStatus, acceptReturnRefundRequest, rejectReturnRefundRequest, getReturnRefundRequestByOrderId, getUserReturnRefundHistory, getInvestmentOrdersByMonth, getTotalRevenue, getTotalInvestmentOrders, sendOrderWhatsAppMessage, updateOrderItemHUIDs} = require("../controller/orderController")
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
router.route("/admin/investmentOrdersByMonth").get(isAuth, getInvestmentOrdersByMonth);
router.route("/admin/totalRevenue").get(isAuth, getTotalRevenue);
router.route("/admin/totalInvestmentOrders").get(isAuth, getTotalInvestmentOrders);
router.route("/admin/returnRefundRequests").get(isAuth, getAllReturnRefundRequestsAdmin);
router.route("/admin/acceptReturnRefundRequest").post(isAuth, acceptReturnRefundRequest);
router.route("/admin/rejectReturnRefundRequest").post(isAuth, rejectReturnRefundRequest);
router.route("/userOrderHistory").get(isAuth,getUserOrderHistory);
router.route("/orderTransaction").get(isAuth,getParticularOrderHistory);


router.post("/generateTokenPhonePe", generateTokenPhonePe);
router.post("/createOrderPhonePe", createOrderPhonePe);
router.post("/checkPhonePeOrderStatus", checkPhonePeOrderStatus);

router.route("/placeOrder").post(isAuth,placeOrder);
router.route("/refundOrder").post(isAuth,refundOrder);
router.route("/returnOrder").post(isAuth,returnOrder);
router.post("/returnRefundRequest", isAuth, createReturnRefundRequest);
router.get("/returnRefundRequest/:orderId", isAuth, getReturnRefundRequestByOrderId);
router.get("/returnRefundHistory", isAuth, getUserReturnRefundHistory);
router.route("/getOrderHistory").get(isAuth,getOrderHistory);

// Send WhatsApp message for an order
router.post("/sendWhatsAppMessage", isAuth, sendOrderWhatsAppMessage);

// Update HUIDs for order item (Admin)
router.post("/admin/updateItemHuids", isAuth, updateOrderItemHUIDs);

module.exports = router;