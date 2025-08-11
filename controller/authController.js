const asyncHandler = require("express-async-handler");
const crypto = require("../helpers/crypto");
const helper = require("../helpers/helpers")
const multer = require('multer');
const { generateToken } = require("../helpers/helpers");
// const User = require("../models/userModel");
// const adminModel = require("../models/admin_model");
const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { sendMail } = require("../helpers/mailer")

const signUpRequest = asyncHandler(async (req, res) => {

    const { name, email, phone, password, referredBy } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error("Please enter all fields");
    }
try {
        const userAvailable = await userModel.findOne({ email });

    if (userAvailable) {
        res.status(400);
        throw new Error("User already exists");
    }



    const hashedPassword = await bcrypt.hash(password, 12);
    const referralCode = helper.referral();
    const appId = helper.appId();
    const user = await userModel.create({
        name,
        email,
        referralCode: referralCode,
        referredBy: referredBy,
        appId: appId,
        phone,
        password: hashedPassword,
    });

        console.log("user", "user");
    if (user) {
        console.log("user", user);

        const data = sendMail(email, "Registration", "You registered successfully");
        console.log("sddsds",data)
        if (data == true)
            res.status(200).json({
                status: true, message: "successfully Registered", data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                }
            })
        if (data == false)
            res.status(404).json({ message: "Failed - Please try again" })

    } else {
        res.status(400).json({message:"User already exist"});
        throw new Error("Use already Exist");
    }
} catch (error) {
    console.log("err signup: ", error);
}
});

const signInRequest = asyncHandler(async (req, res) => {
    console.log(req.headers);
    // console.log(req.header);

    const { email, password } = req.body;
    console.log(req.body);
    console.log(email, password);

    if (!email || !password) {
        res.status(400);
        throw new Error("Please enter all fields");
    }
    const user = await userModel.findOne({ email });

    if (!user) {
        res.status(400);
        throw new Error("User not found");
    }
    const userAvailable = await bcrypt.compare(password, user.password);
    if (!userAvailable) {
        res.status(400);
        throw new Error("Invalid password");
    }
    console.log("approved");

    user.lastLogin = new Date();
    await user.save();
    const accessToken = generateToken({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
        },

    });


    res.status(200).json({
        status: "success",
        token: accessToken,
    });
});


const mail = async (req, res) => {

    try {

        const data = sendMail(req.body.to, req.body.subject, req.body.text);
        if (data == true)
            res.status(200).json({ message: "successfully send mail" })
        if (data == false)
            res.status(404).json({ message: "Failed to send mail" })
    } catch (error) {
        res.status(404).json({ message: "failed", err: error })
    }

}

// const adminSignUpRequest = async (req, res) => {
//     const { name, email, password } = req.body;

//     try {
//         if (!name || !email || !password) return res.status(403).json({ status: false, message: "All fields must be provided" });
//         const adminExist = await adminModel.findOne({ email })
//         if (adminExist) {
//             res.status(400);
//             throw new Error("Admin already exists");
//         } else {
//             const hashedPassword = await bcrypt.hash(password, 10);
//             const admin = await adminModel.create({ name, email, hashedPassword });

//             res.status(200).json({ status: true, message: "Created successfully", details: admin });

//         }
//     } catch (error) {

//         res.status(400).json({ message: error.message });
//         // throw Error();

//     }



// }

module.exports = {
    signUpRequest, signInRequest, mail
    // adminSignInRequest
}