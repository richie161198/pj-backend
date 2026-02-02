const mongoose = require("mongoose");
const OtpSchema = new mongoose.Schema({
  codeHash: { type: String },     // hashed OTP
  expiresAt: { type: Date }       // expiry time
}, { _id: false });
const ResetTokenSchema = new mongoose.Schema({
  token: { type: String },
  expiresAt: { type: Date }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  type: { type: String, default: "Home" },
  landmark: { type: String },
});

const panSchema = new mongoose.Schema({
  pan: { type: String },
  type: { type: String },
  reference_id: { type: Number },
  name_provided: { type: String },
  registered_name: { type: String },
  father_name: { type: String },
  valid: { type: Boolean },
  message: { type: String },
})
const bankSchema = new mongoose.Schema({
  reference_id: { type: Number },
  name_at_bank: { type: String },
  account_number: { type: String },
  bank_name: { type: String },
  city: { type: String },
  micr: { type: Number },
  branch: { type: String },
  account_status: { type: String },
  account_status_code: { type: String },
  ifsc_details: {
    bank: { type: String },
    ifsc: { type: String },
    micr: { type: Number },
    nbin: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    branch: { type: String },
    ifsc_subcode: { type: String },
    category: { type: String },
    swift_code: { type: String },
  },
})

const mobileOtpSchema = new mongoose.Schema(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 }, // verification attempts
    lastSentAt: { type: Date, default: null }, // last OTP request time
    requestCount: { type: Number, default: 0 }, // OTPs sent in the window
  },
  { _id: false }
);

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a username"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: [true, "Please add a valid email"],
    },
    state: {
      type: String,
      required: [true, "Please add a state"],
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    resetToken: ResetTokenSchema,

    balance: {
      type: String,
      default: 0,
    },
    otp: OtpSchema,
    balanceINR: {
      type: String,
      default: 0,
    },
    goldBalance: {
      type: String,
      default: 0,
    },
    address: [addressSchema],
    appId: {
      type: String,
    }, wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    referralCode: {
      type: String,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    referralPoints: {
      type: Number,
      default: 0,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    kycVerified: {
      type: Boolean,
      default: false,
    },
    referralRewardGiven: {
      type: Boolean,
      default: false,
    },

    otpExpiry: {
      type: String
    },
    lastLogin: {
      type: Date,
    },
    mobileOtp: mobileOtpSchema,
    role: {
      type: String,
      default: "user",
    }, transactionPin: {
      type: String,
      default: null
    }
    ,

    phone: {
      type: String,

      required: [true, "Please add a phone"],
      default: "",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    }, activeAccount: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
    },

    active: {
      type: Boolean,
      default: true,
    }, panVerified: {
      type: Boolean,
      default: false,
    }, mobileVerified: {
      type: Boolean,
      default: false,
    },

    panDetails: panSchema,
    bankDetails: [bankSchema],
    level: [
      {
        type: String,
        enum: ["Beginner", "Intermediate", "Pro"],
        default: "Beginner",
      },
    ],
    
    // Customer Order Statistics
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalOrderValue: {
      type: Number,
      default: 0,
    },
    customerTier: {
      type: String,
      enum: ["Bronze", "Silver", "Gold", "Elite"],
      default: "Bronze",
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

module.exports = mongoose.model("User", userSchema);
