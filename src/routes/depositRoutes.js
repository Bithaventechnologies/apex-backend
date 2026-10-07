const express = require("express");

const router = express.Router();

const {
  createDeposit,
  getAllDeposits,
  getDepositById,
} = require("../controllers/depositController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// ============================================
// GET ALL DEPOSITS
// ============================================

router.get(
  "/",
  verifyToken,
  checkUser,
  getAllDeposits
);

// ============================================
// GET DEPOSIT BY ID
// ============================================

router.get(
  "/:id",
  verifyToken,
  checkUser,
  getDepositById
);

// ============================================
// CREATE DEPOSIT
// ============================================

router.post(
  "/",
  verifyToken,
  checkUser,
  createDeposit
);

module.exports = router;