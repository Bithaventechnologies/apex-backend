
const express = require("express");

const {
  getAllUsers,
  getUserByUid,
  deleteUser,
} = require("../../controllers/Admin/adminUsersControllers");

const {
  checkAdmin,
   verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

// ============================================
// ADMIN USERS
// ============================================

// GET /api/admin/users
router.get(
  "/",
  checkAdmin,
   verifyToken,
  getAllUsers
);

// GET /api/admin/users/:uid
router.get(
  "/:uid",
  checkAdmin,
   verifyToken,
  getUserByUid
);

// DELETE /api/admin/users/:uid
router.delete(
  "/:uid",
  checkAdmin,
   verifyToken,
  deleteUser
);

module.exports = router;

