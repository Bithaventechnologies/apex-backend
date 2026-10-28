
const express = require("express");

const {
  getAllUsers,
  getUserByUid,
  deleteUser,
  adjustUserBalance,
} = require("../../controllers/Admin/adminUsersControllers");

const {
  checkAdmin,
  verifyToken,
} = require("../../middleware/auth");

const router = express.Router();

// GET /api/admin/users
router.get("/", verifyToken, checkAdmin, getAllUsers);

// GET /api/admin/users/:uid
router.get("/:uid", verifyToken, checkAdmin, getUserByUid);

// DELETE /api/admin/users/:uid
router.delete("/:uid", verifyToken, checkAdmin, deleteUser);

// POST /api/admin/users/:uid/adjust-balance
router.post(
  "/:uid/adjust-balance",
  verifyToken,
  checkAdmin,
  adjustUserBalance
);

module.exports = router;
