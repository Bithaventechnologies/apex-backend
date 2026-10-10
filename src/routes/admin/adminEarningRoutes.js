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

const {
  checkAdmin,
  verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

router.get("/all", verifyToken, checkAdmin, getAllEarnings);

router.get("/user/:uid", verifyToken, checkAdmin, getUserEarnings);

router.get("/total/:uid", verifyToken, checkAdmin, getTotalEarnings);

router.get("/:id", verifyToken, checkAdmin, getEarningById);

router.post("/:uid", verifyToken, checkAdmin, addEarning);

router.post("/deduct/:uid", verifyToken, checkAdmin, deductEarning);

router.delete("/:id", verifyToken, checkAdmin, deleteEarning);

module.exports = router;