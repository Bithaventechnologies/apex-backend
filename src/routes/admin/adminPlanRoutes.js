const express = require("express");

const {
  createPlan,
  getAllPlans,
  getPlanById,
  deletePlan,
} = require("../../controllers/Admin/AdminPlanController");

const {
  checkAdmin,
  verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

// Get all plans
router.get("/", verifyToken, checkAdmin, getAllPlans);

// Get single plan
router.get("/:id", verifyToken, checkAdmin, getPlanById);

// Create plan
router.post("/", verifyToken, checkAdmin, createPlan);

// Delete plan
router.delete("/:id", verifyToken, checkAdmin, deletePlan);

module.exports = router;