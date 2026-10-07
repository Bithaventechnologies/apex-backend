const { jwtVerify } = require("../services/jwtService");

const verifyToken = (req, res, next) => {
  const bearer = req.header("Authorization");

  if (!bearer) {
    return res.status(401).json({
      message: "Access denied",
    });
  }

  if (!bearer.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authorization type is Bearer <token>",
    });
  }

  const token = bearer.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  jwtVerify(token, (error, user) => {
    if (error) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    req.user = user;

    next();
  });
};

const checkAdmin = async (req, res, next) => {
  try {
    const type = req.user?.type;

    if (type === "admin") {
      return next();
    }

    return res.status(403).json({
      message: "Access denied. You are not an admin.",
    });
  } catch (error) {
    console.error("Error checking admin:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

const checkUser = async (req, res, next) => {
  try {
    if (req.user?.id) {
      return next();
    }

    return res.status(403).json({
      message: "Access denied. You are not a user.",
    });
  } catch (error) {
    console.error("Error checking user:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

module.exports = {
  verifyToken,
  checkAdmin,
  checkUser,
};