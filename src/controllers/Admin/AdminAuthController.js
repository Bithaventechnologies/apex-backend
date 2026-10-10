
const bcrypt = require("bcryptjs");
const prisma = require("../../lib/prisma");
const { jwtSign } = require("../../services/jwtService");

// Generate a JWT specifically for admins.
const createAdminToken = (admin) => {
  return new Promise((resolve, reject) => {
    jwtSign(
      {
        id: admin.id,
        uid: admin.uid,
        email: admin.email,
        type: "admin",
      },
      (error, token) => {
        if (error) return reject(error);
        resolve(token);
      }
    );
  });
};

// Never return the password hash.
const sanitizeAdmin = (admin) => {
  const { password, ...safeAdmin } = admin;
  return safeAdmin;
};

// POST /api/admin/auth/register
const registerAdmin = async (req, res) => {
  try {
    const { name, username, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // Check whether the email already exists.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create an admin in the existing users table.
    const admin = await prisma.user.create({
      data: {
        name: name.trim(),
        username:
          typeof username === "string" && username.trim()
            ? username.trim()
            : "",
        email: normalizedEmail,
        password: hashedPassword,
        type: "admin",
        verified: true,
        emailVerified: true,
      },
    });

    const token = await createAdminToken(admin);

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully.",
      token,
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error("Admin registration error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email or username already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to register admin at this time.",
    });
  }
};

// POST /api/admin/auth/login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const admin = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Do not allow ordinary users to log in through admin login.
    if (!admin || admin.type !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password.",
      });
    }

    const token = await createAdminToken(admin);

    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      token,
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in admin at this time.",
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
};
