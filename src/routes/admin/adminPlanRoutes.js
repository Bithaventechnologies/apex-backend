const express = require("express");

const {
  createPlan,
  getAllPlans,
  getPlanById,
  deletePlan,
} = require("../../controllers/Admin/AdminPlanController");

const {
  checkAdmin,
} = require("../../middleware/auth");

const router = express.Router();

// Get all plans
router.get("/", checkAdmin, getAllPlans);

// Get single plan
router.get("/:id", checkAdmin, getPlanById);

// Create plan
router.post("/", checkAdmin, createPlan);

// Delete plan
router.delete("/:id", checkAdmin, deletePlan);

module.exports = router;