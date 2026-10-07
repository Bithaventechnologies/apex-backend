
const express = require("express");

const router = express.Router();

const {
  getAllWithdrawals,
  getWithdrawalById,
  createWithdrawal,
} = require("../controllers/withdrawalController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// Get all withdrawals for logged-in user
router.get(
  "/all",
  verifyToken,
  checkUser,
  getAllWithdrawals
);

// Get one withdrawal
router.get(
  "/:id",
  verifyToken,
  checkUser,
  getWithdrawalById
);

// Create withdrawal
router.post(
  "/",
  verifyToken,
  checkUser,
  createWithdrawal
);

module.exports = router;