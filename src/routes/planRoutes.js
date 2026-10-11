
const express = require("express");
const router = express.Router();

const {
  getAllPlans,
  getPlanById,
} = require("../controllers/planController");

// const {
//   verifyToken,
//   checkUser,
// } = require("../middleware/auth");

// Get all plans — PUBLIC
// Visitors can view plans without logging in
router.get("/all", getAllPlans);

// Get a single plan — PUBLIC
router.get("/:id", getPlanById);

module.exports = router;
