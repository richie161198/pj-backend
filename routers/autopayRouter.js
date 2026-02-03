const express = require("express");
const router = express.Router();
const { isAuth } = require("../middleware/tokenValidation");
const { adminAuth } = require("../middleware/adminAuth");

const {
  getAuthToken,
  setupSubscription,
  checkOrderStatus,
  checkSubscriptionStatus,
  notifyRedemption,
  executeRedemption,
  runDailyAutopayCharges,
  revokeSubscription,
  pauseSubscription,
  unpauseSubscription,
  validateUpiAddress,
  getUserSubscriptions,
  getAllSubscriptionsAdmin,
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

// Admin routes
router.get("/admin/subscriptions", adminAuth, getAllSubscriptionsAdmin);

// Temporary: trigger daily autopay cron manually (for testing). Remove after testing.
router.post("/cron/daily", adminAuth, async (req, res) => {
  try {
    await runDailyAutopayCharges();
    res.status(200).json({ success: true, message: "Daily autopay cron triggered" });
  } catch (err) {
    console.error("cron/daily error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

