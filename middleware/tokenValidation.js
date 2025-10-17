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
    console.log("Decoded token:", decoded);

    // Handle both token structures:
    // User tokens: { user: { id: ..., name: ... } }
    // Admin tokens: { id: ..., ... }
    if (decoded.user) {
      // User token structure
      req.user = decoded.user;
      console.log("Authenticated user (user token):", req.user);
    } else if (decoded.id) {
      // Admin token structure - normalize it to match user structure
      req.user = {
        id: decoded.id,
        _id: decoded.id,
        role: 'admin'
      };
      console.log("Authenticated user (admin token):", req.user);
    } else {
      return res.status(401).json({ status: false, message: "Invalid token structure" });
    }

    next();
  } catch (err) {
    console.error("Token verification error:", err);
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
