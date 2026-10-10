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

const { checkAdmin, verifyToken, } = require("../../middleware/auth");

const router = express.Router();

router.get("/all", checkAdmin,  verifyToken, getAllInvestments);

router.get("/user/:uid", checkAdmin,  verifyToken, getUserInvestments);

router.get("/:id", checkAdmin,  verifyToken, getInvestmentById);

router.patch("/:id/approve", checkAdmin,  verifyToken, approveInvestment);

router.patch("/:id/processing", checkAdmin,  verifyToken, processInvestment);

router.patch("/:id/decline", checkAdmin,  verifyToken, declineInvestment);

router.patch("/:id/end", checkAdmin,  verifyToken, endInvestment);

module.exports = router;