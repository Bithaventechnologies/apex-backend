
const express = require("express");
const router = express.Router();

const {
  getAllTransactions,
  getTransactionById,
} = require("../controllers/transactionController");

// Import your authentication middleware
const { checkUser } = require("../middleware/auth");

// ============================================
// TRANSACTION ROUTES
// ============================================

// GET all transactions belonging to the authenticated user
router.get("/", checkUser, getAllTransactions);

// GET a single transaction by ID
router.get("/:id", checkUser, getTransactionById);

module.exports = router;
