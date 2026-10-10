const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const { jwtSign } = require("../services/jwtService");
const { sendEmail } = require("../services/emailService");

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
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, email and password are required",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name cannot be empty",
      });
    }

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

    // Your Prisma schema uses `name` and `username`,
    // not `firstName` and `lastName`.
    const fullName = `${trimmedFirstName} ${trimmedLastName}`;
    const username = normalizedEmail.split("@")[0];

    const user = await prisma.user.create({
      data: {
        name: fullName,
        username,
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: false,
        verificationOtp,
        verificationOtpExpiresAt,
      },
      select: {
        id: true,
        uid: true,
        name: true,
        username: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Send verification email.
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Verify Your Apex Signal Trade Account",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Welcome to Apex Signal Trade</h2>

            <p>Hello ${trimmedFirstName},</p>

            <p>
              Thank you for creating an Apex Signal Trade account.
              Please use the verification code below to verify your email address.
            </p>

            <div style="
              margin: 25px 0;
              padding: 20px;
              background: #f4f4f4;
              text-align: center;
              border-radius: 8px;
            ">
              <h1 style="
                letter-spacing: 8px;
                margin: 0;
                font-size: 32px;
              ">
                ${verificationOtp}
              </h1>
            </div>

            <p>
              This verification code will expire in
              <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not create this account, please ignore this email.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Registration email failed:",
        emailError.message
      );

      // The account has already been created.
      // Registration remains successful, but the user may need
      // to request another verification OTP.
    }

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email for the verification OTP.",
      user: {
        ...user,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    // Handle a duplicate email safely if concurrent requests occur.
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

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
        message:
          "No verification OTP found. Please request a new OTP.",
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
        verified: true,
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

    /**
     * Optional welcome email after successful verification
     */
    try {
      await sendEmail({
        to: updatedUser.email,
        subject: "Welcome to Apex Signal Trade",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Email Verified Successfully</h2>

            <p>Hello ${updatedUser.firstName},</p>

            <p>
              Your Apex Signal Trade email address has been successfully verified.
            </p>

            <p>
              You can now log in and access your account.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Welcome email failed:",
        emailError.message
      );
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
      message: "Internal server error",
      error: error.message,
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

    /**
     * Send new verification OTP
     */
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Your New Apex Signal Trade Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Email Verification</h2>

            <p>Hello ${user.firstName},</p>

            <p>
              You requested a new email verification code.
            </p>

            <div style="
              margin: 25px 0;
              padding: 20px;
              background: #f4f4f4;
              text-align: center;
              border-radius: 8px;
            ">
              <h1 style="
                letter-spacing: 8px;
                margin: 0;
                font-size: 32px;
              ">
                ${verificationOtp}
              </h1>
            </div>

            <p>
              This code will expire in <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not request this code, please ignore this email.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Resend verification email failed:",
        emailError.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Verification code was generated but could not be sent. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new verification OTP has been sent to your email",
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
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
      error: error.message,
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

    /**
     * Don't reveal whether the email exists.
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

    /**
     * Send password reset email
     */
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Reset Your Apex Signal Trade Password",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Password Reset Request</h2>

            <p>Hello ${user.firstName},</p>

            <p>
              We received a request to reset your Apex Signal Trade password.
            </p>

            <p>
              Your password reset OTP is:
            </p>

            <div style="
              margin: 25px 0;
              padding: 20px;
              background: #f4f4f4;
              text-align: center;
              border-radius: 8px;
            ">
              <h1 style="
                letter-spacing: 8px;
                margin: 0;
                font-size: 32px;
              ">
                ${resetPasswordOtp}
              </h1>
            </div>

            <p>
              This OTP expires in <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not request a password reset, please ignore this email.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Password reset email failed:",
        emailError.message
      );

      /**
       * Don't expose the OTP or internal email error.
       */
      return res.status(500).json({
        success: false,
        message:
          "Unable to send password reset email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset OTP will be sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
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
        message:
          "Email, OTP and new password are required",
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

    /**
     * Send confirmation email
     */
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Your Apex Signal Trade Password Was Changed",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Password Changed Successfully</h2>

            <p>Hello ${user.firstName},</p>

            <p>
              Your Apex Signal Trade password has been successfully changed.
            </p>

            <p>
              If you did not make this change, please contact support immediately.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
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
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * CHANGE PASSWORD
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
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

    /**
     * Send password changed notification
     */
    try {
      await sendEmail({
        to: user.email,
        subject: "Your Apex Signal Trade Password Was Changed",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
            <h2>Password Changed</h2>

            <p>Hello ${user.firstName},</p>

            <p>
              Your Apex Signal Trade password has been changed successfully.
            </p>

            <p>
              If you did not make this change, please contact support immediately.
            </p>

            <p>
              Regards,<br />
              <strong>Apex Signal Trade</strong>
            </p>
          </div>
        `,
      });
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
      message: "Internal server error",
      error: error.message,
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