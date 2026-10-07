const express = require("express");
const cors = require("cors");
require("dotenv").config();
const AuthRoutes = require("./routes/authRoutes")

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running",
  });
});

//ROUTES

app.use("/api/auth", AuthRoutes)

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});