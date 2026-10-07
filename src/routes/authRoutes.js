const express = require("express");

const {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  changePassword,

} = require("../controllers/authController");

const {
  verifyToken,
  checkUser,
} = require("../middleware/auth");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
*/

/**
 * Register
 * POST /api/auth/register
 */
router.post("/register", register);

/**
 * Verify email
 * POST /api/auth/verify-email
 */
router.post("/verify-email", verifyEmail);

/**
 * Resend verification OTP
 * POST /api/auth/resend-verification
 */
router.post(
  "/resend-verification",
  resendVerification
);

/**
 * Login
 * POST /api/auth/login
 */
router.post("/login", login);

/**
 * Forgot password
 * POST /api/auth/forgot-password
 */
router.post(
  "/forgot-password",
  forgotPassword
);

/**
 * Reset password
 * POST /api/auth/reset-password
 */
router.post(
  "/reset-password",
  resetPassword
);

/*
|--------------------------------------------------------------------------
| Protected Authentication Routes
|--------------------------------------------------------------------------
*/

/**
 * Change password
 * POST /api/auth/change-password
 */
router.post(
  "/change-password",
  verifyToken,
  checkUser,
  changePassword
);


module.exports = router;