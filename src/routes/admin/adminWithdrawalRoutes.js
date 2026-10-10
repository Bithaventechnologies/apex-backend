const express = require("express");

const {
  getAllWithdrawals,
  getUserWithdrawals,
  getWithdrawalById,
  processWithdrawal,
  approveWithdrawal,
  declineWithdrawal,
  deleteWithdrawal,
} = require("../../controllers/Admin/AdminWithdrawlController");

const {
  verifyToken,
  checkAdmin,
} = require("../../middleware/auth");

const router = express.Router();

// All routes require a valid token and admin access
router.get("/all", verifyToken, checkAdmin, getAllWithdrawals);

router.get("/user/:uid", verifyToken, checkAdmin, getUserWithdrawals);

router.get("/:id", verifyToken, checkAdmin, getWithdrawalById);

router.patch("/:id/processing", verifyToken, checkAdmin, processWithdrawal);

router.patch("/:id/approve", verifyToken, checkAdmin, approveWithdrawal);

router.patch("/:id/decline", verifyToken, checkAdmin, declineWithdrawal);

router.delete("/:id", verifyToken, checkAdmin, deleteWithdrawal);

module.exports = router;