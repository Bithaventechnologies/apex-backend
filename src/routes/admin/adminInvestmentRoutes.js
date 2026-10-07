const express = require("express");

const {
  getAllInvestments,
  getUserInvestments,
  getInvestmentById,
  approveInvestment,
  processInvestment,
  declineInvestment,
  endInvestment,
} = require("../../controllers/Admin/AdminInvestmentController");

const { checkAdmin } = require("../../middleware/auth");

const router = express.Router();

router.get("/all", checkAdmin, getAllInvestments);

router.get("/user/:uid", checkAdmin, getUserInvestments);

router.get("/:id", checkAdmin, getInvestmentById);

router.patch("/:id/approve", checkAdmin, approveInvestment);

router.patch("/:id/processing", checkAdmin, processInvestment);

router.patch("/:id/decline", checkAdmin, declineInvestment);

router.patch("/:id/end", checkAdmin, endInvestment);

module.exports = router;