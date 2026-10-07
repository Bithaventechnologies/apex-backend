
const express = require("express");

const router = express.Router();

const {
  getAllInvestments,
  getInvestmentById,
  createInvestment,
} = require("../controllers/investmentController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// Get all investments belonging to logged-in user
router.get(
  "/all",
  verifyToken,
  checkUser,
  getAllInvestments
);

// Get one investment
router.get(
  "/:id",
  verifyToken,
  checkUser,
  getInvestmentById
);

// Create investment
router.post(
  "/",
  verifyToken,
  checkUser,
  createInvestment
);

module.exports = router;
