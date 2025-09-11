const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
    newTag: { type: Boolean,default:false },
    // slug: { type: String, unique: true }, // optional, for SEO friendly URLs
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
