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

//Additional imports for admin routes
const adminUserRoutes = require("./routes/admin/adminUseRoutes");
const adminDepositRoutes = require("./routes/admin/adminDepositRoutes")
const adminWithdrawalRoutes = require("./routes/admin/adminWithdrawalRoutes")
const adminEarningRoutes = require("./routes/admin/adminEarningRoutes")
const adminInvestmentRoutes = require("./routes/admin/adminInvestmentRoutes")
const adminPlanRoutes = require("./routes/admin/adminPlanRoutes")

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);
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
app.use('/api/admin/users', adminUserRoutes)
app.use('/api/admin/deposits', adminDepositRoutes)
app.use('/api/admin/withdrawals', adminWithdrawalRoutes)
app.use('/api/admin/earnings', adminEarningRoutes)
app.use('/api/admin/investments', adminInvestmentRoutes)
app.use('/api/admin/plans', adminPlanRoutes)
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});