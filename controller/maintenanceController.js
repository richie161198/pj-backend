const asyncHandler = require("express-async-handler");
const Maintenance = require("../models/maintenance_model");

/**
 * Get current maintenance status
 */
const getMaintenanceStatus = asyncHandler(async (req, res) => {
  try {
    const maintenance = await Maintenance.findOne().sort({ updatedAt: -1 });
    
    if (!maintenance) {
      return res.status(200).json({
        status: true,
        message: "Maintenance status retrieved successfully",
        data: {
          isMaintenanceMode: false,
          maintenanceMessage: "",
          maintenanceTitle: "",
          estimatedEndTime: null,
          maintenanceType: "emergency",
          affectedServices: ["all"]
        }
      });
    }

    res.status(200).json({
      status: true,
      message: "Maintenance status retrieved successfully",
      data: {
        isMaintenanceMode: maintenance.isMaintenanceMode,
        maintenanceMessage: maintenance.maintenanceMessage,
        maintenanceTitle: maintenance.maintenanceTitle,
        estimatedEndTime: maintenance.estimatedEndTime,
        maintenanceType: maintenance.maintenanceType,
        affectedServices: maintenance.affectedServices,
        lastUpdated: maintenance.updatedAt
      }
    });
  } catch (error) {
    console.error("Error getting maintenance status:", error);
    res.status(500).json({
      status: false,
      message: "Failed to get maintenance status",
      error: error.message
    });
  }
});

/**
 * Update maintenance status (Admin only)
 */
const updateMaintenanceStatus = asyncHandler(async (req, res) => {
  try {
    const {
      isMaintenanceMode,
      maintenanceMessage,
      maintenanceTitle,
      estimatedEndTime,
      maintenanceType,
      affectedServices,
      allowedIPs,
      allowedUserIds
    } = req.body;

    // Validate required fields
    if (typeof isMaintenanceMode !== 'boolean') {
      return res.status(400).json({
        status: false,
        message: "isMaintenanceMode is required and must be a boolean"
      });
    }

    // Get or create maintenance record
    let maintenance = await Maintenance.findOne().sort({ updatedAt: -1 });
    
    if (!maintenance) {
      maintenance = new Maintenance({
        createdBy: req.admin.id
      });
    }

    // Update fields
    maintenance.isMaintenanceMode = isMaintenanceMode;
    maintenance.lastUpdatedBy = req.admin.id;
    
    if (maintenanceMessage) maintenance.maintenanceMessage = maintenanceMessage;
    if (maintenanceTitle) maintenance.maintenanceTitle = maintenanceTitle;
    if (estimatedEndTime) maintenance.estimatedEndTime = new Date(estimatedEndTime);
    if (maintenanceType) maintenance.maintenanceType = maintenanceType;
    if (affectedServices) maintenance.affectedServices = affectedServices;
    if (allowedIPs) maintenance.allowedIPs = allowedIPs;
    if (allowedUserIds) maintenance.allowedUserIds = allowedUserIds;

    // Set scheduled maintenance
    if (isMaintenanceMode && maintenanceType === 'scheduled') {
      maintenance.isScheduled = true;
      if (estimatedEndTime) {
        maintenance.scheduledEndTime = new Date(estimatedEndTime);
      }
    }

    await maintenance.save();

    res.status(200).json({
      status: true,
      message: `Maintenance mode ${isMaintenanceMode ? 'enabled' : 'disabled'} successfully`,
      data: {
        isMaintenanceMode: maintenance.isMaintenanceMode,
        maintenanceMessage: maintenance.maintenanceMessage,
        maintenanceTitle: maintenance.maintenanceTitle,
        estimatedEndTime: maintenance.estimatedEndTime,
        maintenanceType: maintenance.maintenanceType,
        affectedServices: maintenance.affectedServices,
        lastUpdated: maintenance.updatedAt
      }
    });
  } catch (error) {
    console.error("Error updating maintenance status:", error);
    res.status(500).json({
      status: false,
      message: "Failed to update maintenance status",
      error: error.message
    });
  }
});

/**
 * Get maintenance history (Admin only)
 */
const getMaintenanceHistory = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const maintenanceHistory = await Maintenance.find()
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Maintenance.countDocuments();

    res.status(200).json({
      status: true,
      message: "Maintenance history retrieved successfully",
      data: {
        maintenanceHistory,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Error getting maintenance history:", error);
    res.status(500).json({
      status: false,
      message: "Failed to get maintenance history",
      error: error.message
    });
  }
});

/**
 * Check if user is allowed during maintenance
 */
const checkMaintenanceAccess = asyncHandler(async (req, res, next) => {
  try {
    const maintenance = await Maintenance.findOne({ isMaintenanceMode: true }).sort({ updatedAt: -1 });
    
    if (!maintenance) {
      return next();
    }

    // Check if user is in allowed list
    if (maintenance.allowedUserIds && maintenance.allowedUserIds.length > 0) {
      if (req.user && maintenance.allowedUserIds.includes(req.user.id)) {
        return next();
      }
    }

    // Check if IP is in allowed list
    if (maintenance.allowedIPs && maintenance.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (maintenance.allowedIPs.includes(clientIP)) {
        return next();
      }
    }

    // Check if service is affected
    const serviceType = req.headers['x-service-type'] || 'all';
    if (maintenance.affectedServices.includes('all') || maintenance.affectedServices.includes(serviceType)) {
      return res.status(503).json({
        status: false,
        message: "Service temporarily unavailable",
        data: {
          isMaintenanceMode: true,
          maintenanceMessage: maintenance.maintenanceMessage,
          maintenanceTitle: maintenance.maintenanceTitle,
          estimatedEndTime: maintenance.estimatedEndTime,
          maintenanceType: maintenance.maintenanceType
        }
      });
    }

    next();
  } catch (error) {
    console.error("Error checking maintenance access:", error);
    next();
  }
});

module.exports = {
  getMaintenanceStatus,
  updateMaintenanceStatus,
  getMaintenanceHistory,
  checkMaintenanceAccess
};
