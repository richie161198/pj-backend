const express = require("express");
const router = express.Router();
const shipmentPricingController = require("../controller/shipmentPricingController");
const { adminAuth } = require("../middleware/adminAuth");
const { isAuth } = require("../middleware/tokenValidation");

/**
 * Shipment Pricing Routes
 * 
 * Admin Routes (require admin authentication):
 * - GET    /                           - Get shipment pricing settings
 * - PUT    /fixed-price                 - Update fixed shipping price
 * - PUT    /toggle-location-based       - Toggle location-based pricing
 * - POST   /location-rules              - Add location-based pricing rule
 * - PUT    /location-rules/:ruleId      - Update location-based pricing rule
 * - DELETE /location-rules/:ruleId      - Delete location-based pricing rule
 * 
 * Public/User Routes:
 * - POST   /calculate                  - Calculate shipping price based on address
 */

// ============== ADMIN ROUTES ==============

// Get shipment pricing settings
router.get("/", adminAuth, shipmentPricingController.getShipmentPricing);

// Update fixed shipping price
router.put("/fixed-price", adminAuth, shipmentPricingController.updateFixedPrice);

// Toggle location-based pricing
router.put("/toggle-location-based", adminAuth, shipmentPricingController.toggleLocationBased);

// Add location-based pricing rule
router.post("/location-rules", adminAuth, shipmentPricingController.addLocationRule);

// Update location-based pricing rule
router.put("/location-rules/:ruleId", adminAuth, shipmentPricingController.updateLocationRule);

// Delete location-based pricing rule
router.delete("/location-rules/:ruleId", adminAuth, shipmentPricingController.deleteLocationRule);

// ============== PUBLIC/USER ROUTES ==============

// Calculate shipping price based on address (public - no auth required for checkout)
router.post("/calculate", shipmentPricingController.calculateShippingPrice);

module.exports = router;

