
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const { jwtSign } = require("../services/jwtService");
const { sendEmail } = require("../services/emailService");

const APP_NAME = "Trust Signal Trade";
const OTP_EXPIRY_MINUTES = 10;

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const getOtpExpiry = () => {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
};

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const escapeHtml = (value = "") => {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
};

const getFirstName = (user) => {
  return user?.name?.trim().split(/\s+/)[0] || "there";
};

const generateToken = (user) => {
  return new Promise((resolve, reject) => {
    jwtSign(
      {
        id: user.id,
        uid: user.uid,
        email: user.email,
        type: user.type,
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

const sendVerificationEmail = async (email, firstName, otp) => {
  await sendEmail({
    to: email,
    subject: `Verify Your ${APP_NAME} Account`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
        <h2>Welcome to ${APP_NAME}</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Thank you for creating an account. Use the verification code below
        to verify your email address.</p>
        <div style="margin:25px 0;padding:20px;background:#f4f4f4;
          text-align:center;border-radius:8px">
          <h1 style="letter-spacing:8px;margin:0;font-size:32px">
            ${otp}
          </h1>
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  await sendEmail({
    to: email,
    subject: `Reset Your ${APP_NAME} Password`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
        <h2>Password Reset Request</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Use the code below to reset your password.</p>
        <div style="margin:25px 0;padding:20px;background:#f4f4f4;
          text-align:center;border-radius:8px">
          <h1 style="letter-spacing:8px;margin:0;font-size:32px">
            ${otp}
          </h1>
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request a password reset, ignore this email.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

const sendPasswordChangedEmail = async (email, firstName) => {
  await sendEmail({
    to: email,
    subject: `Your ${APP_NAME} Password Was Changed`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
        <h2>Password Changed Successfully</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your password has been changed successfully.</p>
        <p>If you did not make this change, contact support immediately.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

/**
 * REGISTER
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      !firstName.trim() ||
      !lastName.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
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

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`;
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    // Save the combined name in the existing Prisma `name` field.
    const user = await prisma.user.create({
      data: {
        name: fullName,
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: false,
        verified: false,
        verificationOtp,
        verificationOtpExpiresAt,
      },
      select: {
        id: true,
        uid: true,
        name: true,
        email: true,
        emailVerified: true,
        verified: true,
        createdAt: true,
      },
    });

    try {
      await sendVerificationEmail(
        normalizedEmail,
        cleanFirstName,
        verificationOtp
      );
    } catch (emailError) {
      console.error("Registration email failed:", emailError.message);

      // The account exists, so the user can request a new OTP.
      return res.status(201).json({
        success: true,
        emailSent: false,
        message:
          "Your account was created, but the verification email could not be sent. Please request a new verification code.",
        user,
      });
    }

    return res.status(201).json({
      success: true,
      emailSent: true,
      message:
        "Registration successful. Please check your email for the verification OTP.",
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to register at this time. Please try again.",
    });
  }
};

/**
 * VERIFY EMAIL
 * POST /api/auth/verify-email
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email and 6-digit OTP are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    if (!user.verificationOtp || !user.verificationOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "No verification OTP found. Please request a new OTP.",
      });
    }

    if (user.verificationOtpExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Verification OTP has expired. Please request a new one.",
      });
    }

    if (user.verificationOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification OTP",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verified: true,
        verificationOtp: null,
        verificationOtpExpiresAt: null,
      },
      select: {
        id: true,
        uid: true,
        name: true,
        username: true,
        email: true,
        emailVerified: true,
        verified: true,
        createdAt: true,
      },
    });

    try {
      await sendEmail({
        to: updatedUser.email,
        subject: `Welcome to ${APP_NAME}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
            <h2>Email Verified Successfully</h2>
            <p>Hello ${escapeHtml(getFirstName(updatedUser))},</p>
            <p>Your email address has been verified successfully.</p>
            <p>You can now log in to your account.</p>
            <p>Regards,<br/><strong>${APP_NAME}</strong></p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Verify email error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify email at this time. Please try again.",
    });
  }
};

/**
 * RESEND VERIFICATION OTP
 * POST /api/auth/resend-verification
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    // Send first; only replace the stored code if delivery succeeds.
    try {
      await sendVerificationEmail(
        normalizedEmail,
        getFirstName(user),
        verificationOtp
      );
    } catch (emailError) {
      console.error("Resend verification email failed:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send a verification code. Please try again.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationOtp,
        verificationOtpExpiresAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: "A new verification OTP has been sent to your email",
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to resend the verification code. Please try again.",
    });
  }
};

/**
 * LOGIN
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

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
        uid: user.uid,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        verified: user.verified,
        type: user.type,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in at this time. Please try again.",
    });
  }
};

/**
 * FORGOT PASSWORD
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Do not reveal whether an account exists.
    const genericMessage =
      "If an account exists with this email, a password reset OTP will be sent.";

    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    const resetPasswordOtp = generateOtp();
    const resetPasswordOtpExpiresAt = getOtpExpiry();

    try {
      await sendPasswordResetEmail(
        normalizedEmail,
        getFirstName(user),
        resetPasswordOtp
      );
    } catch (emailError) {
      console.error("Password reset email failed:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send a password reset email. Please try again.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp,
        resetPasswordOtpExpiresAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process your request. Please try again.",
    });
  }
};

/**
 * RESET PASSWORD
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp) ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Email, valid 6-digit OTP and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.resetPasswordOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid password reset request",
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

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiresAt: null,
      },
    });

    try {
      await sendPasswordChangedEmail(
        normalizedEmail,
        getFirstName(user)
      );
    } catch (emailError) {
      console.error(
        "Password reset confirmation email failed:",
        emailError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset your password. Please try again.",
    });
  }
};

/**
 * CHANGE PASSWORD
 * POST /api/auth/change-password
 * Requires your authentication middleware.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
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

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Your new password must differ from your current password",
      });
    }

    // Your JWT must contain the user's numeric database ID.
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Please log in again",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    try {
      await sendPasswordChangedEmail(
        user.email,
        getFirstName(user)
      );
    } catch (emailError) {
      console.error(
        "Password change email failed:",
        emailError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to change your password. Please try again.",
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
};
