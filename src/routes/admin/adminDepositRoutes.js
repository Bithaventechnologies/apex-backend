
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
} = require("../../middleware/auth");

const router = express.Router();

// ============================================
// ADMIN DEPOSITS
// ============================================

// GET /api/admin/deposits
router.get(
  "/",
  checkAdmin,
  getAllDeposits
);

// GET /api/admin/deposits/user/:uid
router.get(
  "/user/:uid",
  checkAdmin,
  getUserDeposits
);

// PATCH /api/admin/deposits/:id/processing
router.patch(
  "/:id/processing",
  checkAdmin,
  processDeposit
);

// PATCH /api/admin/deposits/:id/approve
router.patch(
  "/:id/approve",
  checkAdmin,
  approveDeposit
);

// PATCH /api/admin/deposits/:id/decline
router.patch(
  "/:id/decline",
  checkAdmin,
  declineDeposit
);

module.exports = router;

