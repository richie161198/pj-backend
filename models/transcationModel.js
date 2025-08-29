const mongoose = require('mongoose');


const transactionSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
   orderId: { type: String, unique: true },
   orderType: { type: String},
   transactionType: { type: String},
   gst_value: { type: Number},
   goldCurrentPrice: { type: Number},
   goldQtyInGm: { type: Number},
     Payment_method: { type: String},

   inramount: { type: Number},

   status: { type: String },
 
 
   // shipment: {
   //   carrier: String,
   //   trackingId: String,
   //   estimatedDelivery: Date
   // },
   // notes: String,
   createdAt: { type: Date, default: Date.now },
   updatedAt: Date
}, { timestamp: true })

module.exports = mongoose.model("PG_ORD_Transaction", transactionSchema);