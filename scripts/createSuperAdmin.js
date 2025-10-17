const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('Super admin already exists:', existingSuperAdmin.email);
      process.exit(0);
    }

    // Create super admin
    const superAdminData = {
      name: 'Super Admin',
      email: 'admin@preciousjewels.com',
      password: 'Admin@123456', // This will be hashed by the pre-save middleware
      role: 'super_admin',
      permissions: [
        'users_manage',
        'products_manage',
        'orders_manage',
        'categories_manage',
        'settings_manage',
        'reports_view',
        'analytics_view',
        'support_manage',
        'finance_manage'
      ],
      department: 'Administration',
      isEmailVerified: true,
      isActive: true
    };

    const superAdmin = new Admin(superAdminData);
    await superAdmin.save();

    console.log('Super admin created successfully:');
    console.log('Email:', superAdmin.email);
    console.log('Password: Admin@123456');
    console.log('Role:', superAdmin.role);
    console.log('Permissions:', superAdmin.permissions);

    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();
