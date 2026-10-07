
const express = require("express");

const router = express.Router();

const {
  getProfile,
  updateProfile,
} = require("../controllers/userController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// Get logged-in user's profile
router.get("/profile", verifyToken, checkUser, getProfile);

// Update logged-in user's profile
router.patch("/profile", verifyToken, checkUser, updateProfile);

module.exports = router;