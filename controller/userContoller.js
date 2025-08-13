const { default: axios } = require("axios");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const getAllUser = asyncHandler(async (req, res) => {
    const user = await User.find({});
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    if (user) {
        res.status(200).json({ status: true, details: user });
    }
});
const getuserById = asyncHandler(async (req, res) => {
    console.log("req.user", req.user);
    try {
        const user = await User.findById(req.user.id);
        console.log(user);
        if (!user || user === null || user === undefined) {
            // res.status(404).json({ message: "Not found", details: user });
            res.status(404);
            throw new Error("Not found ");
        }

        res.status(200).json({ message: "success", details: user });
    } catch (error) {

        res.status(500).json(error);
    }
});
// Set Transaction PIN
const setTransactionPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
console.log("req.user", req.user,req.body);
  // Validate 4-digit PIN
  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ status: false, message: "PIN must be a 4-digit number" });
  }

  try {
    const hashedPin = await bcrypt.hash(pin, 10);

    await User.findByIdAndUpdate(req.user.id, { transactionPin: hashedPin });

    res.status(200).json({ status: true, message: "Transaction PIN set successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Verify Transaction PIN
const verifyTransactionPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ status: false, message: "PIN must be a 4-digit number" });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.transactionPin) {
      return res.status(404).json({ status: false, message: "Transaction PIN not set" });
    }

    const isMatch = await bcrypt.compare(pin, user.transactionPin);

    if (!isMatch) {
      return res.status(401).json({ status: false, message: "Invalid Transaction PIN" });
    }

    res.status(200).json({ status: true, message: "Transaction PIN verified successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});



const getGoldprice = asyncHandler(async (req, res) => {
 try {
      const response = await axios.get("https://api.metalpriceapi.com/v1/latest", {
      params: {
        base: "INR",
        symbols: "XAU",
        apikey: "75a775b84af3b34f9f259dd510de2284"  // replace with your real API key
      }
    });

    // const goldPrice = response.data.rates.XAU;
    console.log(`Current Gold Price (INR): ₹${response.data}`);
     
     res.status(200).json({ message: "success", details: response.data });
  } catch (error) {
    console.error('Error fetching gold price:', error.message);
  }
});

const updateuserById = asyncHandler(async (req, res) => {
    console.log(req.params.id);
    console.log(req.body);
    const user = await User.findById(req.params.id);
    console.log(user);
    if (!user || user === undefined || user === null) {
        res.status(404);
        throw new Error("Not found ");
    }
    const userData = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });


    res.status(200).json({ message: "success", details: userData });
});

const deleteuserById = asyncHandler(async (req, res) => {
    console.log(req.params.id);
    const user = await User.findById(req.params.id);
    console.log(user);
    if (!user || user === undefined || user === null) {
        res.status(404);
        throw new Error("Not found ");
    }
    const userData = await User.findByIdAndDelete(req.params.id);


    res.status(200).json({ message: "success", details: `${user.name} profile has been deleted` });
});






module.exports = { updateuserById, getuserById, getAllUser, deleteuserById,getGoldprice,setTransactionPin, verifyTransactionPin }