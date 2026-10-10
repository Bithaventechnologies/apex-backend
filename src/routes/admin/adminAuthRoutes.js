
const express = require("express");

const {
  registerAdmin,
  loginAdmin,
} = require("../../controllers/Admin/AdminAuthController");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

module.exports = router;
