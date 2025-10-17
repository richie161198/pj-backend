const asyncHandler = require("express-async-handler");
const Policy = require("../models/policy_model");

// ✅ GET Policy by Type
const getPolicyByType = asyncHandler(async (req, res) => {
  try {
    const { type } = req.params;

    // Validate type
    const validTypes = ['privacy', 'return', 'shipping', 'cancellation', 'terms'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: false,
        message: `Invalid policy type. Valid types: ${validTypes.join(', ')}`
      });
    }

    const policy = await Policy.findOne({ type, isActive: true })
      .populate('updatedBy', 'name email')
      .select('-__v');

    if (!policy) {
      return res.status(404).json({
        status: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} policy not found`
      });
    }

    return res.status(200).json({
      status: true,
      data: policy
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// ✅ GET All Policies
const getAllPolicies = asyncHandler(async (req, res) => {
  try {
    const policies = await Policy.find({ isActive: true })
      .populate('updatedBy', 'name email')
      .select('-__v')
      .sort({ type: 1 });

    return res.status(200).json({
      status: true,
      count: policies.length,
      data: policies
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// ✅ CREATE or UPDATE Policy
const createOrUpdatePolicy = asyncHandler(async (req, res) => {
  console.log("createOrUpdatePolicy:", req.body);
  try {
    const { type, title, content } = req.body;
console.log("Parsed Input:", { type, title, content });
    // Validate required fields
    if (!type || !title || !content) {
      return res.status(400).json({
        status: false,
        message: 'Type, title, and content are required'
      });
    }

    // Validate type
    const validTypes = ['privacy', 'return', 'shipping', 'cancellation', 'terms'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: false,
        message: `Invalid policy type. Valid types: ${validTypes.join(', ')}`
      });
    }

    // Get admin ID from request (set by authentication middleware)
    const adminId = req.admin?.id || req.admin?._id;

    // Check if policy exists
    let policy = await Policy.findOne({ type });

    if (policy) {
      // Update existing policy
      policy.title = title;
      policy.content = content;
      policy.lastUpdated = Date.now();
      if (adminId) {
        policy.updatedBy = adminId;
      }
      await policy.save();

      return res.status(200).json({
        status: true,
        message: '✅ Policy updated successfully',
        data: policy
      });
    } else {
      // Create new policy
      policy = await Policy.create({
        type,
        title,
        content,
        updatedBy: adminId || null
      });

      return res.status(201).json({
        status: true,
        message: '✅ Policy created successfully',
        data: policy
      });
    }
  } catch (error) {
    console.error('Error creating/updating policy:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// ✅ DELETE Policy (soft delete by setting isActive to false)
const deletePolicy = asyncHandler(async (req, res) => {
  try {
    const { type } = req.params;

    const policy = await Policy.findOne({ type });

    if (!policy) {
      return res.status(404).json({
        status: false,
        message: 'Policy not found'
      });
    }

    policy.isActive = false;
    await policy.save();

    return res.status(200).json({
      status: true,
      message: '🗑️ Policy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting policy:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

module.exports = {
  getPolicyByType,
  getAllPolicies,
  createOrUpdatePolicy,
  deletePolicy
};

