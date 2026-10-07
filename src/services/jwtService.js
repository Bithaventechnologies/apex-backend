const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

const jwtSign = (payload, callback) => {
  jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
    callback
  );
};

const jwtVerify = (token, callback) => {
  jwt.verify(token, JWT_SECRET, callback);
};

module.exports = {
  jwtSign,
  jwtVerify,
};