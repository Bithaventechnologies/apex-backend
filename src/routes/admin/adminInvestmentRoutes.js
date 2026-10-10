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

const {
  checkAdmin,
  verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

router.get("/all", verifyToken, checkAdmin, getAllInvestments);

router.get("/user/:uid", verifyToken, checkAdmin, getUserInvestments);

router.get("/:id", verifyToken, checkAdmin, getInvestmentById);

router.patch("/:id/approve", verifyToken, checkAdmin, approveInvestment);

router.patch("/:id/processing", verifyToken, checkAdmin, processInvestment);

router.patch("/:id/decline", verifyToken, checkAdmin, declineInvestment);

router.patch("/:id/end", verifyToken, checkAdmin, endInvestment);

module.exports = router;