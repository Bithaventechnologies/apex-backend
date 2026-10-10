const express = require("express");

const {
  getAllDeposits,
  getUserDeposits,
  processDeposit,
  approveDeposit,
  declineDeposit,
} = require("../../controllers/Admin/AdminDepositController");

const {
  checkAdmin,
  verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

// GET /api/admin/deposits
router.get("/", verifyToken, checkAdmin, getAllDeposits);

// GET /api/admin/deposits/user/:uid
router.get("/user/:uid", verifyToken, checkAdmin, getUserDeposits);

// PATCH /api/admin/deposits/:id/processing
router.patch("/:id/processing", verifyToken, checkAdmin, processDeposit);

// PATCH /api/admin/deposits/:id/approve
router.patch("/:id/approve", verifyToken, checkAdmin, approveDeposit);

// PATCH /api/admin/deposits/:id/decline
router.patch("/:id/decline", verifyToken, checkAdmin, declineDeposit);

module.exports = router;