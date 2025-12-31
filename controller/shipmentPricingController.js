const asyncHandler = require("express-async-handler");
const ShipmentPricing = require("../models/shipment_pricing_model");

// @desc    Get shipment pricing settings
// @route   GET /api/v0/shipment-pricing
// @access  Private (Admin)
const getShipmentPricing = asyncHandler(async (req, res) => {
  try {
    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    // If no settings exist, create default
    if (!settings) {
      settings = await ShipmentPricing.create({
        fixedPrice: 0,
        locationRules: [],
        isLocationBasedEnabled: false,
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching shipment pricing:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching shipment pricing",
      error: error.message,
    });
  }
});

// @desc    Update fixed shipping price
// @route   PUT /api/v0/shipment-pricing/fixed-price
// @access  Private (Admin)
const updateFixedPrice = asyncHandler(async (req, res) => {
  try {
    const { fixedPrice } = req.body;

    if (fixedPrice === undefined || fixedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed price is required and must be >= 0",
      });
    }

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      settings = await ShipmentPricing.create({
        fixedPrice: parseFloat(fixedPrice),
        locationRules: [],
        isLocationBasedEnabled: false,
        updatedBy: req.admin?.id,
      });
    } else {
      settings.fixedPrice = parseFloat(fixedPrice);
      settings.updatedBy = req.admin?.id;
      await settings.save();
    }

    return res.status(200).json({
      success: true,
      message: "Fixed shipping price updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating fixed price:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating fixed price",
      error: error.message,
    });
  }
});

// @desc    Toggle location-based pricing
// @route   PUT /api/v0/shipment-pricing/toggle-location-based
// @access  Private (Admin)
const toggleLocationBased = asyncHandler(async (req, res) => {
  try {
    const { isLocationBasedEnabled } = req.body;

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      settings = await ShipmentPricing.create({
        fixedPrice: 0,
        locationRules: [],
        isLocationBasedEnabled: isLocationBasedEnabled ?? false,
        updatedBy: req.admin?.id,
      });
    } else {
      settings.isLocationBasedEnabled = isLocationBasedEnabled ?? !settings.isLocationBasedEnabled;
      settings.updatedBy = req.admin?.id;
      await settings.save();
    }

    return res.status(200).json({
      success: true,
      message: "Location-based pricing toggled successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error toggling location-based pricing:", error);
    return res.status(500).json({
      success: false,
      message: "Error toggling location-based pricing",
      error: error.message,
    });
  }
});

// @desc    Add location-based pricing rule
// @route   POST /api/v0/shipment-pricing/location-rules
// @access  Private (Admin)
const addLocationRule = asyncHandler(async (req, res) => {
  try {
    const { type, value, price, isActive } = req.body;

    if (!type || !value || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Type, value, and price are required",
      });
    }

    if (!["city", "place", "pincode"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be one of: city, place, pincode",
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be >= 0",
      });
    }

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      settings = await ShipmentPricing.create({
        fixedPrice: 0,
        locationRules: [],
        isLocationBasedEnabled: true,
        updatedBy: req.admin?.id,
      });
    }

    // Check for duplicate rule
    const duplicate = settings.locationRules.find(
      (rule) => rule.type === type && rule.value.toLowerCase().trim() === value.toLowerCase().trim()
    );

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A rule with this type and value already exists",
      });
    }

    settings.locationRules.push({
      type,
      value: value.trim(),
      price: parseFloat(price),
      isActive: isActive !== undefined ? isActive : true,
    });

    settings.updatedBy = req.admin?.id;
    await settings.save();

    return res.status(201).json({
      success: true,
      message: "Location rule added successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error adding location rule:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding location rule",
      error: error.message,
    });
  }
});

// @desc    Update location-based pricing rule
// @route   PUT /api/v0/shipment-pricing/location-rules/:ruleId
// @access  Private (Admin)
const updateLocationRule = asyncHandler(async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { type, value, price, isActive } = req.body;

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Shipment pricing settings not found",
      });
    }

    const ruleIndex = settings.locationRules.findIndex(
      (rule) => rule._id.toString() === ruleId
    );

    if (ruleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Location rule not found",
      });
    }

    // Check for duplicate rule (excluding current rule)
    if (type && value) {
      const duplicate = settings.locationRules.find(
        (rule, index) =>
          index !== ruleIndex &&
          rule.type === type &&
          rule.value.toLowerCase().trim() === value.toLowerCase().trim()
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "A rule with this type and value already exists",
        });
      }
    }

    // Update rule fields
    if (type) {
      if (!["city", "place", "pincode"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Type must be one of: city, place, pincode",
        });
      }
      settings.locationRules[ruleIndex].type = type;
    }

    if (value !== undefined) {
      settings.locationRules[ruleIndex].value = value.trim();
    }

    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be >= 0",
        });
      }
      settings.locationRules[ruleIndex].price = parseFloat(price);
    }

    if (isActive !== undefined) {
      settings.locationRules[ruleIndex].isActive = isActive;
    }

    settings.updatedBy = req.admin?.id;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Location rule updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating location rule:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating location rule",
      error: error.message,
    });
  }
});

// @desc    Delete location-based pricing rule
// @route   DELETE /api/v0/shipment-pricing/location-rules/:ruleId
// @access  Private (Admin)
const deleteLocationRule = asyncHandler(async (req, res) => {
  try {
    const { ruleId } = req.params;

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Shipment pricing settings not found",
      });
    }

    const initialLength = settings.locationRules.length;
    settings.locationRules = settings.locationRules.filter(
      (rule) => rule._id.toString() !== ruleId
    );

    if (settings.locationRules.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Location rule not found",
      });
    }

    settings.updatedBy = req.admin?.id;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Location rule deleted successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error deleting location rule:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting location rule",
      error: error.message,
    });
  }
});

// @desc    Get applicable shipping price based on address
// @route   POST /api/v0/shipment-pricing/calculate
// @access  Public (or Private for authenticated users)
const calculateShippingPrice = asyncHandler(async (req, res) => {
  try {
    const { city, state, pincode, place } = req.body;

    let settings = await ShipmentPricing.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      // Return default price if no settings exist
      return res.status(200).json({
        success: true,
        data: {
          shippingPrice: 0,
          appliedRule: null,
          isFixedPrice: true,
        },
      });
    }

    let shippingPrice = settings.fixedPrice;
    let appliedRule = null;
    let isFixedPrice = true;

    // Check location-based rules if enabled
    if (settings.isLocationBasedEnabled && settings.locationRules.length > 0) {
      // Priority: Pincode > Place > City
      const activeRules = settings.locationRules.filter((rule) => rule.isActive);

      // Check pincode first
      if (pincode) {
        const pincodeRule = activeRules.find(
          (rule) =>
            rule.type === "pincode" &&
            rule.value.toLowerCase().trim() === pincode.toString().toLowerCase().trim()
        );
        if (pincodeRule) {
          shippingPrice = pincodeRule.price;
          appliedRule = {
            type: pincodeRule.type,
            value: pincodeRule.value,
            price: pincodeRule.price,
          };
          isFixedPrice = false;
        }
      }

      // Check place if no pincode match
      if (isFixedPrice && place) {
        const placeRule = activeRules.find(
          (rule) =>
            rule.type === "place" &&
            rule.value.toLowerCase().trim() === place.toString().toLowerCase().trim()
        );
        if (placeRule) {
          shippingPrice = placeRule.price;
          appliedRule = {
            type: placeRule.type,
            value: placeRule.value,
            price: placeRule.price,
          };
          isFixedPrice = false;
        }
      }

      // Check city if no pincode or place match
      if (isFixedPrice && city) {
        const cityRule = activeRules.find(
          (rule) =>
            rule.type === "city" &&
            rule.value.toLowerCase().trim() === city.toString().toLowerCase().trim()
        );
        if (cityRule) {
          shippingPrice = cityRule.price;
          appliedRule = {
            type: cityRule.type,
            value: cityRule.value,
            price: cityRule.price,
          };
          isFixedPrice = false;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        shippingPrice,
        appliedRule,
        isFixedPrice,
        fixedPrice: settings.fixedPrice,
      },
    });
  } catch (error) {
    console.error("Error calculating shipping price:", error);
    return res.status(500).json({
      success: false,
      message: "Error calculating shipping price",
      error: error.message,
    });
  }
});

module.exports = {
  getShipmentPricing,
  updateFixedPrice,
  toggleLocationBased,
  addLocationRule,
  updateLocationRule,
  deleteLocationRule,
  calculateShippingPrice,
};

