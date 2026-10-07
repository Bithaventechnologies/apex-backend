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

const { checkAdmin } = require("../../middleware/auth");

const router = express.Router();

router.get("/all", checkAdmin, getAllWithdrawals);

router.get("/user/:uid", checkAdmin, getUserWithdrawals);

router.get("/:id", checkAdmin, getWithdrawalById);

router.patch("/:id/processing", checkAdmin, processWithdrawal);

router.patch("/:id/approve", checkAdmin, approveWithdrawal);

router.patch("/:id/decline", checkAdmin, declineWithdrawal);

router.delete("/:id", checkAdmin, deleteWithdrawal);

module.exports = router;