const express = require("express");
const router = express.Router();
const { isAuth } = require("../middleware/tokenValidation");

const {
  getAuthToken,
  setupSubscription,
  checkOrderStatus,
  checkSubscriptionStatus,
  notifyRedemption,
  executeRedemption,
  revokeSubscription,
  pauseSubscription,
  unpauseSubscription,
  validateUpiAddress,
  getUserSubscriptions,
  syncSubscriptionStatuses,
  initiateRefund,
  handleWebhook,
  cancelSubscription,
} = require("../controller/autopayController");

// Public routes
router.post("/auth-token", getAuthToken);
router.post("/webhook", handleWebhook);

// Protected routes (require authentication)
router.post("/setup", isAuth, setupSubscription);
router.get("/order/:merchantOrderId/status", isAuth, checkOrderStatus);
router.get("/subscription/:merchantSubscriptionId/status", isAuth, checkSubscriptionStatus);
router.post("/notify", isAuth, notifyRedemption);
router.post("/execute", isAuth, executeRedemption);
router.post("/revoke", isAuth, revokeSubscription);
router.post("/autopaycancel",  cancelSubscription);
router.post("/pause", isAuth, pauseSubscription);
router.post("/unpause", isAuth, unpauseSubscription);
router.post("/validate-upi", isAuth, validateUpiAddress);
router.get("/subscriptions", isAuth, getUserSubscriptions);
router.post("/subscriptions/sync-statuses", isAuth, syncSubscriptionStatuses);
router.post("/refund", isAuth, initiateRefund);

module.exports = router;

