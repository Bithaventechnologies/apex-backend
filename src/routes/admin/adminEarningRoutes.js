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

const { checkAdmin } = require("../../middleware/auth");

const router = express.Router();

router.get("/all", checkAdmin, getAllEarnings);

router.get("/user/:uid", checkAdmin, getUserEarnings);

router.get("/total/:uid", checkAdmin, getTotalEarnings);

router.get("/:id", checkAdmin, getEarningById);

router.post("/:uid", checkAdmin, addEarning);

router.post("/deduct/:uid", checkAdmin, deductEarning);

router.delete("/:id", checkAdmin, deleteEarning);

module.exports = router;