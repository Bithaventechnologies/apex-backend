
const express = require("express");
const router = express.Router();

const {
  getAllTransactions,
  getTransactionById,
} = require("../controllers/transactionController");

// Import your authentication middleware
const { checkUser, verifyToken } = require("../middleware/auth");

// ============================================
// TRANSACTION ROUTES
// ============================================

// GET all transactions belonging to the authenticated user
router.get("/", verifyToken, checkUser, getAllTransactions);

// GET a single transaction by ID
router.get("/:id", verifyToken, checkUser, getTransactionById);

module.exports = router;
