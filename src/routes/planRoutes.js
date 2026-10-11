
const express = require("express");

const router = express.Router();

const {
  getAllPlans,
  getPlanById,
} = require("../controllers/planController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

// Get all plans
router.get(
  "/all",
  verifyToken,
  checkUser,
  getAllPlans
);

// Get a single plan
router.get(
  "/:id",
  verifyToken,
  checkUser,
  getPlanById
);

//get all plans everyone

router.get(
  "/all",
  getAllPlans
)

module.exports = router;
