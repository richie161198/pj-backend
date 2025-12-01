const express = require("express");
const router = express.Router();
const shipmentController = require("../controller/shipmentController");
const { isAuth } = require("../middleware/tokenValidation");
const { adminAuth } = require("../middleware/adminAuth");

/**
 * Shipment Routes
 *
 * User Routes (require user authentication):
 * - POST /bvc/create          - Create shipment for order
 * - POST /bvc/track/order     - Track shipment by order code
 * - GET  /user/shipments      - Get user's shipments list
 * - GET  /order/:orderId      - Get shipment by order ID/code
 * - POST /return              - Create return shipment
 * - POST /cancel              - Cancel shipment
 *
 * Public Routes:
 * - GET  /track/:docketNo     - Track shipment by docket number
 *
 * Admin Routes (require admin authentication):
 * - GET  /                    - Get all shipments
 * - PUT  /:id/status          - Update shipment status
 * - POST /sync                - Sync shipments with BVC
 */

// ============== USER ROUTES ==============

// Create shipment for order (called after order is placed)
router.post("/bvc/create", isAuth, shipmentController.createShipment);

// Track shipment by order code
router.post("/bvc/track/order", isAuth, shipmentController.trackShipmentByOrder);

// Get user's shipment list
router.get("/user/shipments", isAuth, shipmentController.getUserShipments);

// Get shipment by order ID or order code
router.get("/order/:orderId", isAuth, shipmentController.getShipmentByOrder);

// Create return/reverse shipment
router.post("/return", isAuth, shipmentController.createReturnShipment);

// Cancel shipment
router.post("/cancel", isAuth, shipmentController.cancelShipment);

// ============== PUBLIC ROUTES ==============

// Track shipment by docket/AWB number (public - for tracking page)
router.get("/track/:docketNo", shipmentController.trackShipmentByDocket);

// ============== ADMIN ROUTES ==============

// Get all shipments (admin)
router.get("/", adminAuth, shipmentController.getAllShipments);

// Update shipment status (admin)
router.put("/:id/status", adminAuth, shipmentController.updateShipmentStatus);

// Sync all pending shipments with BVC (admin/cron)
router.post("/sync", adminAuth, shipmentController.syncShipments);

module.exports = router;

