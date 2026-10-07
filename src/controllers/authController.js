const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const { jwtSign } = require("../services/jwtService");

/**
 * Generate a 6-digit OTP
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * OTP expires in 10 minutes
 */
const getOtpExpiry = () => {
  return new Date(Date.now() + 10 * 60 * 1000);
};

/**
 * Generate JWT
 */
const generateToken = (user) => {
  return new Promise((resolve, reject) => {
    jwtSign(
      {
        id: user.id,
        email: user.email,
      },
      (error, token) => {
        if (error) {
          return reject(error);
        }

        resolve(token);
      }
    );
  });
};

/**
 * REGISTER
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verificationOtp = generateOtp();
    const verificationOtpExpiresAt = getOtpExpiry();

    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,

        emailVerified: false,

        verificationOtp,
        verificationOtpExpiresAt,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    /*
     * TODO:
     * Send verificationOtp to user's email.
     *
     * For development we return it.
     * REMOVE otp from the response in production.
     */

    console.log(
      `Verification OTP for ${normalizedEmail}: ${verificationOtp}`
    );

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please verify your email with the OTP sent to you.",
      user,
      verificationOtp,
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * VERIFY EMAIL
 * POST /api/auth/verify-email
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    if (!user.verificationOtp) {
      return res.status(400).json({
        success: false,
        message: "No verification OTP found. Please request a new OTP.",
      });
    }

    if (
      !user.verificationOtpExpiresAt ||
      user.verificationOtpExpiresAt < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Verification OTP has expired",
      });
    }

    if (user.verificationOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification OTP",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        verificationOtp: null,
        verificationOtpExpiresAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerified: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Verify email error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * RESEND VERIFICATION OTP
 * POST /api/auth/resend-verification
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const verificationOtp = generateOtp();
    const verificationOtpExpiresAt = getOtpExpiry();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        verificationOtp,
        verificationOtpExpiresAt,
      },
    });

    console.log(
      `New verification OTP for ${normalizedEmail}: ${verificationOtp}`
    );

    return res.status(200).json({
      success: true,
      message: "A new verification OTP has been generated",
      verificationOtp,
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * LOGIN
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
        emailVerified: false,
      });
    }

    const token = await generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,

      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * FORGOT PASSWORD
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    /*
     * We don't reveal whether the email exists.
     */
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset OTP will be sent.",
      });
    }

    const resetPasswordOtp = generateOtp();
    const resetPasswordOtpExpiresAt = getOtpExpiry();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordOtp,
        resetPasswordOtpExpiresAt,
      },
    });

    console.log(
      `Password reset OTP for ${normalizedEmail}: ${resetPasswordOtp}`
    );

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset OTP will be sent.",

      /*
       * Remove this before production.
       */
      resetPasswordOtp,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * RESET PASSWORD
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const {
      email,
      otp,
      newPassword,
    } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset request",
      });
    }

    if (!user.resetPasswordOtp) {
      return res.status(400).json({
        success: false,
        message: "No password reset OTP found",
      });
    }

    if (
      !user.resetPasswordOtpExpiresAt ||
      user.resetPasswordOtpExpiresAt < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Password reset OTP has expired",
      });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid password reset OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiresAt: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * CHANGE PASSWORD
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET CURRENT USER
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get me error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};