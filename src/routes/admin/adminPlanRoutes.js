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
router.get("/", checkAdmin,  verifyToken, getAllPlans);

// Get single plan
router.get("/:id", checkAdmin,  verifyToken, getPlanById);

// Create plan
router.post("/", checkAdmin,  verifyToken, createPlan);

// Delete plan
router.delete("/:id", checkAdmin , verifyToken, deletePlan);

module.exports = router;