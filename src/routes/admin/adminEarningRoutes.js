const express = require("express");

const {
  getAllEarnings,
  getUserEarnings,
  getEarningById,
  addEarning,
  deductEarning,
  getTotalEarnings,
  deleteEarning,
} = require("../../controllers/Admin/AdminEarningController");

const { checkAdmin, verifyToken, } = require("../../middleware/auth");

const router = express.Router();

router.get("/all", checkAdmin, verifyToken, getAllEarnings);

router.get("/user/:uid", checkAdmin, verifyToken, getUserEarnings);

router.get("/total/:uid", checkAdmin, verifyToken, getTotalEarnings);

router.get("/:id", checkAdmin, verifyToken, getEarningById);

router.post("/:uid", checkAdmin, verifyToken, addEarning);

router.post("/deduct/:uid", checkAdmin, verifyToken, deductEarning);

router.delete("/:id", checkAdmin, verifyToken, deleteEarning);

module.exports = router;