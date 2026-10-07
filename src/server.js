const express = require("express");
const cors = require("cors");
require("dotenv").config();
const AuthRoutes = require("./routes/authRoutes")
const DepositRoutes = require("./routes/depositRoutes")
const userRoutes = require("./routes/userRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const planRoutes = require("./routes/planRoutes");
const investmentRoutes = require("./routes/investmentRoutes");
const earningRoutes = require("./routes/earningRoutes");

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
app.use("/api/deposits", DepositRoutes)
app.use("/api/users", userRoutes)
app.use('/api/withdrawals', withdrawalRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/investments', investmentRoutes)
app.use('/api/earnings', earningRoutes)
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});