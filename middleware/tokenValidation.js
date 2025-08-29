// const expressAsyncHandler = require("express-async-handler");
// const jwt = require("jsonwebtoken");

// module.exports.validateToken = expressAsyncHandler(async (req, res, next) => {
//     const authHeader = req.headers.authorization || req.headers.Authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         res.status(401);
//         throw new Error("Authorization token is missing or malformed");
//     }

//     const token = authHeader.split(" ")[1];

//     if (!token) {
//         res.status(400);
//         throw new Error("Token is missing after Bearer");
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.ACCESS_TOKEN);
//         req.user = decoded.user;
//         console.log("Authenticated user:", decoded.user);
//         next();
//     } catch (err) {
//         res.status(401);
//         throw new Error("Invalid or expired token");
//     }
// });

const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const isAuth = asyncHandler(async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ status: false, message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("decoded user:", decoded.user.id);

    // const user = await User.findById(decoded.user.id);
    // console.log("Authenticated user:", user);

    // if (!user) {
    //   return res.status(401).json({ status: false, message: "User not found" });
    // }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ status: false, message: "Token invalid/expired" });
  }
});

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ status: false, message: "Forbidden" });
  }
  next();
};

module.exports = { isAuth, isAdmin };
