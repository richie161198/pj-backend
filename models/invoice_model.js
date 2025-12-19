const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customerDetails: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: {
        type: String,
        default: 'India'
      }
    }
  },
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    sku: String,
    category: String,
    brand: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    weight: {
      type: Number,
      default: 0
    },
    metalType: {
      type: String,
      enum: ['gold', 'silver', 'diamond', 'other'],
      default: 'gold'
    },
    purity: String,
    makingCharges: {
      type: Number,
      default: 0
    },
    gst: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    totalMakingCharges: {
      type: Number,
      default: 0
    },
    totalGST: {
      type: Number,
      default: 0
    },
    totalDiscount: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'netbanking', 'wallet', 'emi'],
      required: true
    },
    transactionId: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    paidAt: Date
  },
  shippingDetails: {
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup'],
      default: 'standard'
    },
    trackingNumber: String,
    estimatedDelivery: Date,
    actualDelivery: Date,
    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    }
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  notes: String,
  termsAndConditions: String,
  dueDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ 'customerDetails.email': 1 });

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      // Generate invoice number in format: PGINV/2025-26/00001
      // Financial year: April to March (e.g., 2025-26 = April 2025 to March 2026)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      
      // Financial year starts in April (month 4)
      let financialYearStart, financialYearEnd;
      if (currentMonth >= 4) {
        // April to December: Current year to next year
        financialYearStart = currentYear;
        financialYearEnd = currentYear + 1;
      } else {
        // January to March: Previous year to current year
        financialYearStart = currentYear - 1;
        financialYearEnd = currentYear;
      }
      
      const financialYear = `${financialYearStart}-${String(financialYearEnd).slice(-2)}`;
      
      // Count invoices for current financial year
      const financialYearStartDate = new Date(financialYearStart, 3, 1); // April 1
      const financialYearEndDate = new Date(financialYearEnd, 2, 31, 23, 59, 59); // March 31
      
      const invoiceCount = await this.constructor.countDocuments({
        createdAt: {
          $gte: financialYearStartDate,
          $lte: financialYearEndDate
        }
      });
      
      const sequence = String(invoiceCount + 1).padStart(5, '0');
      this.invoiceNumber = `PGINV/${financialYear}/${sequence}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback to timestamp-based number
      this.invoiceNumber = `PGINV/${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}/${Date.now()}`;
    }
  }
  next();
});

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function() {
  return this.invoiceNumber;
});

// Method to calculate totals
invoiceSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  let totalMakingCharges = 0;
  let totalGST = 0;
  let totalDiscount = 0;

  this.products.forEach(product => {
    subtotal += product.totalPrice;
    totalMakingCharges += product.makingCharges || 0;
    totalGST += product.gst || 0;
    totalDiscount += product.discount || 0;
  });

  this.pricing = {
    subtotal,
    totalMakingCharges,
    totalGST,
    totalDiscount,
    grandTotal: subtotal + totalMakingCharges + totalGST - totalDiscount,
    currency: 'INR'
  };

  return this.pricing;
};

// Method to mark as paid
invoiceSchema.methods.markAsPaid = function(transactionId, paidAmount) {
  this.paymentDetails.paymentStatus = 'completed';
  this.paymentDetails.paidAmount = paidAmount;
  this.paymentDetails.paidAt = new Date();
  this.paymentDetails.transactionId = transactionId;
  this.status = 'paid';
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Invoice', invoiceSchema);
