
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { jwtSign } = require("../services/jwtService");
const { sendEmail } = require("../services/emailService");

const APP_NAME = "Trust Signal Trade";
const OTP_EXPIRY_MINUTES = 10;

/**
 * Send email without making the API request wait for SMTP.
 * Failures are logged instead of causing the API request to fail.
 */
const sendEmailInBackground = (emailTask, label) => {
  setImmediate(() => {
    Promise.resolve()
      .then(emailTask)
      .then(() => {
        console.log(`${label} sent successfully.`);
      })
      .catch((error) => {
        console.error(
          `${label} failed:`,
          error?.message || error
        );
      });
  });
};

/**
 * Helpers
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const getOtpExpiry = () => {
  return new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );
};

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const getFirstName = (user) => {
  const name = String(user?.name || "").trim();
  return name.split(/\s+/)[0] || "there";
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

/**
 * Email templates
 */
const sendVerificationEmail = (email, firstName, otp) => {
  return sendEmail({
    to: email,
    subject: `Verify your email - ${APP_NAME}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
        <h2>Verify Your Email Address</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Thank you for registering with ${APP_NAME}.</p>
        <p>Use the verification code below to verify your email address:</p>
        <h1 style="letter-spacing:8px;color:#25166B">${escapeHtml(otp)}</h1>
        <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = (email, firstName, otp) => {
  return sendEmail({
    to: email,
    subject: `Password reset code - ${APP_NAME}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
        <h2>Password Reset Request</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>We received a request to reset your password.</p>
        <p>Use the code below to continue:</p>
        <h1 style="letter-spacing:8px;color:#25166B">${escapeHtml(otp)}</h1>
        <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

const sendPasswordChangedEmail = (email, firstName) => {
  return sendEmail({
    to: email,
    subject: `Password changed - ${APP_NAME}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
        <h2>Password Changed Successfully</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your ${APP_NAME} account password has been changed successfully.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

const sendWelcomeEmail = (user) => {
  return sendEmail({
    to: user.email,
    subject: `Welcome to ${APP_NAME}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
        <h2>Email Verified Successfully</h2>
        <p>Hello ${escapeHtml(getFirstName(user))},</p>
        <p>Your email address has been verified successfully.</p>
        <p>You can now log in to your account.</p>
        <p>Regards,<br/><strong>${APP_NAME}</strong></p>
      </div>
    `,
  });
};

/**
 * REGISTER
 * Creates an account and sends the verification email in the background.
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, fullName, email, password } =
      req.body || {};

    const normalizedEmail = normalizeEmail(email);

    // Supports either fullName or firstName + lastName.
    const suppliedName =
      String(fullName || "").trim() ||
      `${String(firstName || "").trim()} ${String(
        lastName || ""
      ).trim()}`.trim();

    if (!suppliedName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationOtp = generateOtp();
    const verificationOtpExpiresAt = getOtpExpiry();

    const user = await prisma.user.create({
      data: {
        name: suppliedName,
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
        type: true,
        verified: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Do not wait for SMTP to finish.
    sendEmailInBackground(
      () =>
        sendVerificationEmail(
          normalizedEmail,
          getFirstName(user),
          verificationOtp
        ),
      "Registration verification email"
    );

    return res.status(201).json({
      success: true,
      emailQueued: true,
      message:
        "Registration successful. Your verification code is being sent to your email.",
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * VERIFY EMAIL
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const submittedOtp = String(otp || "").trim();

    if (!normalizedEmail || !submittedOtp) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    if (!/^\d{6}$/.test(submittedOtp)) {
      return res.status(400).json({
        success: false,
        message: "The verification code must contain 6 digits.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.emailVerified || user.verified) {
      return res.status(400).json({
        success: false,
        message: "This email address has already been verified.",
      });
    }

    if (
      !user.verificationOtp ||
      !user.verificationOtpExpiresAt
    ) {
      return res.status(400).json({
        success: false,
        message: "No active verification code was found. Please request another code.",
      });
    }

    if (new Date(user.verificationOtpExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Your verification code has expired. Please request another code.",
      });
    }

    if (user.verificationOtp !== submittedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
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
        email: true,
        type: true,
        verified: true,
        emailVerified: true,
      },
    });

    // The email is sent after the account has been verified.
    sendEmailInBackground(
      () => sendWelcomeEmail(updatedUser),
      "Welcome email"
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Verify email error:", error);

    return res.status(500).json({
      success: false,
      message: "Email verification failed. Please try again.",
    });
  }
};

/**
 * RESEND VERIFICATION CODE
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.emailVerified || user.verified) {
      return res.status(400).json({
        success: false,
        message: "This email address has already been verified.",
      });
    }

    const verificationOtp = generateOtp();
    const verificationOtpExpiresAt = getOtpExpiry();

    // Save the new OTP before scheduling the email.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationOtp,
        verificationOtpExpiresAt,
      },
    });

    sendEmailInBackground(
      () =>
        sendVerificationEmail(
          user.email,
          getFirstName(user),
          verificationOtp
        ),
      "Resend verification email"
    );

    return res.status(200).json({
      success: true,
      emailQueued: true,
      message: "A new verification code is being sent to your email.",
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
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.emailVerified && !user.verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        emailVerified: false,
      });
    }

    const token = await generateToken(user);

    const safeUser = {
      id: user.id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      type: user.type,
      verified: user.verified,
      emailVerified: user.emailVerified,
      balance: user.balance,
      btcBal: user.btcBal,
      usdtBal: user.usdtBal,
      ethBal: user.ethBal,
      solBal: user.solBal,
      profilePic: user.profilePic,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

/**
 * FORGOT PASSWORD
 */
const forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message:
      "If an account exists with that email, a password reset code will be sent.",
  };

  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(200).json(genericResponse);
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Keep the response the same whether or not the account exists.
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetPasswordOtp = generateOtp();
    const resetPasswordOtpExpiresAt = getOtpExpiry();

    // Store the OTP before sending the email in the background.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp,
        resetPasswordOtpExpiresAt,
      },
    });

    sendEmailInBackground(
      () =>
        sendPasswordResetEmail(
          user.email,
          getFirstName(user),
          resetPasswordOtp
        ),
      "Password reset email"
    );

    return res.status(200).json(genericResponse);
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
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } =
      req.body || {};

    const normalizedEmail = normalizeEmail(email);
    const submittedOtp = String(otp || "").trim();

    if (!normalizedEmail || !submittedOtp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset code and new password are required.",
      });
    }

    if (!/^\d{6}$/.test(submittedOtp)) {
      return res.status(400).json({
        success: false,
        message: "The reset code must contain 6 digits.",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (
      confirmPassword !== undefined &&
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset code.",
      });
    }

    if (
      !user.resetPasswordOtp ||
      !user.resetPasswordOtpExpiresAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset code.",
      });
    }

    if (new Date(user.resetPasswordOtpExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Your password reset code has expired.",
      });
    }

    if (user.resetPasswordOtp !== submittedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset code.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiresAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    sendEmailInBackground(
      () =>
        sendPasswordChangedEmail(
          updatedUser.email,
          getFirstName(updatedUser)
        ),
      "Password reset confirmation email"
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
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
 * Requires your existing authentication middleware.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } =
      req.body || {};

    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long.",
      });
    }

    if (
      confirmPassword !== undefined &&
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Your new password must be different from your current password.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: "Your current password is incorrect.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    sendEmailInBackground(
      () =>
        sendPasswordChangedEmail(
          updatedUser.email,
          getFirstName(updatedUser)
        ),
      "Password change confirmation email"
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
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