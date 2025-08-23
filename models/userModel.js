const mongoose = require("mongoose");
const OtpSchema = new mongoose.Schema({
  codeHash: { type: String },     // hashed OTP
  expiresAt: { type: Date }       // expiry time
}, { _id: false });
const ResetTokenSchema = new mongoose.Schema({
  token: { type: String },
  expiresAt: { type: Date }
}, { _id: false });
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
    appId: {
      type: String,
    },
    referralCode: {
      type: String,
    },

    otpExpiry: {
      type: String
    },
    lastLogin: {
      type: Date,
    },
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
    },  activeAccount: {
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
    },
    level: [
      {
        type: String,
        enum: ["Beginner", "Intermediate", "Pro"],
        default: "Beginner",
      },
    ],
  },
  { timestamp: true, toJSON: { virtuals: true } }
);
// authSchema.virtual("blockedUsers").get(function () {
//   return this.blockList.length;
// });

module.exports = mongoose.model("Users", userSchema);
