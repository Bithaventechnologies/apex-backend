
const express = require("express");

const {
  getAllUsers,
  getUserByUid,
  deleteUser,
} = require("../../controllers/Admin/adminUsersControllers");

const {
  checkAdmin,
} = require("../../middleware/auth");

const router = express.Router();

// ============================================
// ADMIN USERS
// ============================================

// GET /api/admin/users
router.get(
  "/",
  checkAdmin,
  getAllUsers
);

// GET /api/admin/users/:uid
router.get(
  "/:uid",
  checkAdmin,
  getUserByUid
);

// DELETE /api/admin/users/:uid
router.delete(
  "/:uid",
  checkAdmin,
  deleteUser
);

module.exports = router;

