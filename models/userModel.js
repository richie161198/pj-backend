const mongoose = require("mongoose");

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
    balance: {
      type: String,
      default: 0,
    },
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
    lastLogin: {
      type: Date,
    },

    phone: {
      type: String,

      required: [true, "Please add a phone"],
      default: "",
    },
    isBlocked: {
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
