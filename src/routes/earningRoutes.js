const express = require("express");

const router = express.Router();

const {
  getAllEarnings,
  getEarningById,
} = require("../controllers/earningController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// Get all earnings belonging to the logged-in user
router.get(
  "/all",
  verifyToken,
  checkUser,
  getAllEarnings
);

// Get one earning belonging to the logged-in user
router.get(
  "/:id",
  verifyToken,
  checkUser,
  getEarningById
);

module.exports = router;