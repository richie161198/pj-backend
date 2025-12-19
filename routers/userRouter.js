const asyncHandler = require("express-async-handler");
const { updateTicketStatus, getTicketById, getMyTickets, createTicket, addToWishlist, removeFromWishlist, getWishlist, updateuserById, getuserById, getAllUser, addAddress, getAddresses, deleteAddress, deleteuserById, setTransactionPin, verifyTransactionPin, updateAddress, getuserByIds, getAllTickets, getTicketByIdAdmin, updateTicketStatusAdmin, getTicketStats, addTicketReply, getReferredUsers, getReferralStats } = require("../controller/userContoller")
const express = require("express");
const multer = require('multer');
const { isAuth } = require("../middleware/tokenValidation");
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage })

router.route("/getAllUser").get(getAllUser);
router.route("/getuserById").get(isAuth, getuserById);
router.route("/getuserByIds/:id").get( getuserByIds);
router.route("/updateuserById/:id").post(updateuserById);
router.route("/deleteuserById/:id").post(deleteuserById);
// router.route("/set-transaction-pin").post(isAuth, setTransactionPin);
// router.route("/verify-transaction-pin").post(isAuth, verifyTransactionPin);

router.post("/set-transaction-pin", isAuth, setTransactionPin);
router.post("/verify-transaction-pin", isAuth, verifyTransactionPin);
router.route("/addAddress").post(isAuth, addAddress);
// Support both PUT and POST for updateAddress
router.put("/updateAddress/:addressId", isAuth, updateAddress);
router.post("/updateAddress/:addressId", isAuth, updateAddress); // Keep POST for backward compatibility
router.route("/deleteAddress").delete(isAuth, deleteAddress);
router.route("/getAddress").get(isAuth, getAddresses);


// wishlist
router.route("/addToWishlist").post(isAuth, addToWishlist);
router.route("/removeFromWishlist").post(isAuth, removeFromWishlist);
router.route("/getWishlist").get(isAuth, getWishlist);

// tickets
router.route("/getMyTickets").get(isAuth, getMyTickets);
router.route("/createTicket").post(isAuth, createTicket);
router.route("/getTicketById/:id").get(isAuth, getTicketById);
router.route("/getTicketById/:id/reply").post(isAuth, addTicketReply);
router.route("/updateTicketStatus/:id").post(isAuth, updateTicketStatus);

// Admin ticket routes
router.route("/admin/getAllTickets").get(isAuth, getAllTickets);
router.route("/admin/getTicketById/:id").get(isAuth, getTicketByIdAdmin);
router.route("/admin/updateTicketStatus/:id").post(isAuth, updateTicketStatusAdmin);
router.route("/admin/getTicketStats").get(isAuth, getTicketStats);
router.route("/admin/addTicketReply/:id").post(isAuth, addTicketReply);

// Admin referral routes
router.route("/admin/getReferredUsers").get(isAuth, getReferredUsers);
router.route("/admin/getReferralStats").get(isAuth, getReferralStats);

module.exports = router;





