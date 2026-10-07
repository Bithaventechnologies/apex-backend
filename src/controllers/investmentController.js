
const prisma = require("../lib/prisma");
const { sendEmail } = require("../services/emailService");

// =====================================================
// GET ALL INVESTMENTS
// GET /api/investments/all
// =====================================================

const getAllInvestments = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find logged-in user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    const investments = await prisma.investment.findMany({
      where: {
        uid: user.uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = investments.map((investment) => ({
      id: investment.id,
      uid: investment.uid,
      name: user.name,
      email: user.email,
      plan_name: investment.plan_name,
      method: investment.method,
      plan_id: investment.plan_id,
      duration: investment.duration,
      amount: investment.amount,
      returns: investment.returns,
      status: investment.status,
      active: investment.active,
      creditedAmount: investment.creditedAmount,
      lastCreditedAt: investment.lastCreditedAt
        ? investment.lastCreditedAt.getTime()
        : null,
      createdAt: investment.createdAt.getTime(),
      updatedAt: investment.updatedAt.getTime(),
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all investments error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// GET INVESTMENT BY ID
// GET /api/investments/:id
// =====================================================

const getInvestmentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const investmentId = parseInt(id, 10);

    if (Number.isNaN(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment id.",
      });
    }

    // Find logged-in user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    const investment = await prisma.investment.findFirst({
      where: {
        id: investmentId,
        uid: user.uid,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    const data = {
      id: investment.id,
      uid: investment.uid,
      name: user.name,
      email: user.email,
      plan_name: investment.plan_name,
      method: investment.method,
      plan_id: investment.plan_id,
      duration: investment.duration,
      amount: investment.amount,
      returns: investment.returns,
      status: investment.status,
      active: investment.active,
      creditedAmount: investment.creditedAmount,
      lastCreditedAt: investment.lastCreditedAt
        ? investment.lastCreditedAt.getTime()
        : null,
      createdAt: investment.createdAt.getTime(),
      updatedAt: investment.updatedAt.getTime(),
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get investment by ID error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// CREATE INVESTMENT
// POST /api/investments
// =====================================================

const createInvestment = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      plan_id,
      amount,
      method,
    } = req.body;

    const amountNumber = parseFloat(amount);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!plan_id || !amountNumber || amountNumber <= 0 || !method) {
      return res.status(400).json({
        message:
          "Bad Request `plan_id`, `amount`, and `method` are required.",
      });
    }

    // =====================================================
    // FIND USER
    // =====================================================

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    // =====================================================
    // FIND INVESTMENT PLAN
    // =====================================================

    const planId = parseInt(plan_id, 10);

    if (Number.isNaN(planId)) {
      return res.status(400).json({
        message: "Invalid plan_id.",
      });
    }

    const investmentPlan = await prisma.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!investmentPlan) {
      return res.status(404).json({
        message: "Investment Plan not found.",
      });
    }

    // =====================================================
    // VALIDATE METHOD
    // =====================================================

    const validMethods = ["BTC", "ETH", "SOL", "USDT"];

    if (!validMethods.includes(method)) {
      return res.status(400).json({
        message:
          "Invalid investment method. Allowed methods are BTC, ETH, SOL, and USDT.",
      });
    }

    // =====================================================
    // CHECK MAIN BALANCE
    // =====================================================

    if (user.balance < amountNumber) {
      return res.status(406).json({
        message: "User does not have sufficient balance.",
      });
    }

    // =====================================================
    // ATOMIC INVESTMENT TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(async (tx) => {
      // ---------------------------------------------------
      // Re-fetch user inside transaction
      // ---------------------------------------------------

      const currentUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!currentUser) {
        throw new Error("User does not exist.");
      }

      // ---------------------------------------------------
      // Check main balance again
      // ---------------------------------------------------

      if (currentUser.balance < amountNumber) {
        throw new Error("INSUFFICIENT_MAIN_BALANCE");
      }

      // ---------------------------------------------------
      // Check and deduct crypto balance
      // ---------------------------------------------------

      const updateData = {
        balance: {
          decrement: amountNumber,
        },
      };

      switch (method) {
        case "BTC":
          if (currentUser.btcBal < amountNumber) {
            throw new Error("INSUFFICIENT_BTC_BALANCE");
          }

          updateData.btcBal = {
            decrement: amountNumber,
          };
          break;

        case "ETH":
          if (currentUser.ethBal < amountNumber) {
            throw new Error("INSUFFICIENT_ETH_BALANCE");
          }

          updateData.ethBal = {
            decrement: amountNumber,
          };
          break;

        case "SOL":
          if (currentUser.solBal < amountNumber) {
            throw new Error("INSUFFICIENT_SOL_BALANCE");
          }

          updateData.solBal = {
            decrement: amountNumber,
          };
          break;

        case "USDT":
          if (currentUser.usdtBal < amountNumber) {
            throw new Error("INSUFFICIENT_USDT_BALANCE");
          }

          updateData.usdtBal = {
            decrement: amountNumber,
          };
          break;
      }

      // ---------------------------------------------------
      // Update user balances
      // ---------------------------------------------------

      const updatedUser = await tx.user.update({
        where: {
          id: userId,
        },
        data: updateData,
      });

      // ---------------------------------------------------
      // Create investment
      // ---------------------------------------------------

      const investment = await tx.investment.create({
        data: {
          uid: currentUser.uid,

          name: currentUser.name,
          email: currentUser.email,

          plan_id: investmentPlan.id.toString(),
          plan_name: investmentPlan.name,

          method,

          duration: investmentPlan.duration,

          amount: amountNumber,

          // Your Plan.returns is String while Investment.returns is Float
          returns: parseFloat(investmentPlan.returns) || 0,

          active: false,

          creditedAmount: 0,

          status: "pending",
        },
      });

      // ---------------------------------------------------
      // Create transaction
      // ---------------------------------------------------

      const transaction = await tx.transaction.create({
        data: {
          uid: currentUser.uid,

          amount: amountNumber,

          from: currentUser.uid,

          to: "admin",

          method: "transfer",

          status: "pending",

          type: "investment",

          investment_id: investment.id.toString(),

          plan_id: investmentPlan.id.toString(),

          plan_name: investmentPlan.name,
        },
      });

      return {
        investment,
        transaction,
        updatedUser,
      };
    });

    const {
      investment,
      transaction,
      updatedUser,
    } = result;

    // =====================================================
    // SEND EMAIL
    // =====================================================

    try {
      const firstName =
        user.name && user.name.trim()
          ? user.name.trim().split(" ")[0]
          : "User";

      await sendEmail({
        to: user.email,
        subject: "Investment",
        html: `
          <html lang="en">
            <head>
              <meta charset="UTF-8" />

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />

              <title>Investment Notification</title>

              <style>
                body {
                  font-family: Arial, sans-serif;
                  background-color: #191c24;
                  margin: 0;
                  padding: 20px;
                }

                .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  border-radius: 8px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                  padding: 20px;
                }

                h2 {
                  color: #0056b3;
                  margin-top: 0;
                }

                p {
                  color: #333333;
                  line-height: 1.6;
                }

                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 20px;
                }

                th,
                td {
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #dddddd;
                  text-transform: capitalize;
                }

                th {
                  background-color: #f2f2f2;
                }

                tr:last-child td {
                  border-bottom: none;
                }

                .footer {
                  margin-top: 20px;
                  text-align: center;
                  color: #666666;
                }
              </style>
            </head>

            <body>
              <div class="container">
                <h2>Investment Notification</h2>

                <p>Hello ${firstName},</p>

                <p>
                  We would like to inform you about the recent investment
                  transaction made on your account.
                </p>

                <h3>Transaction Details:</h3>

                <table>
                  <tr>
                    <th>Investment ID:</th>
                    <td>${investment.id}</td>
                  </tr>

                  <tr>
                    <th>Plan Name:</th>
                    <td>${investment.plan_name.toUpperCase()}</td>
                  </tr>

                  <tr>
                    <th>Amount Invested:</th>
                    <td>
                      ${investment.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                  </tr>

                  <tr>
                    <th>Duration:</th>
                    <td>${investment.duration}</td>
                  </tr>

                  <tr>
                    <th>Status:</th>
                    <td>${investment.status.toUpperCase()}</td>
                  </tr>

                  <tr>
                    <th>Transaction Date:</th>
                    <td>
                      ${new Date(
                        investment.createdAt
                      ).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                </table>

                <p>
                  If you have any questions or concerns, feel free to contact
                  our support team.
                </p>

                <div class="footer">
                  <p>
                    Best regards,<br />
                    Apex Signal Trade
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      // Email failure should not undo a successful investment
      console.error(
        "Investment email failed:",
        emailError.message
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    const data = {
      id: investment.id,
      uid: investment.uid,

      plan_id: investment.plan_id,
      plan_name: investment.plan_name,

      method: investment.method,

      amount: investment.amount,

      returns: investment.returns,

      duration: investment.duration,

      status: investment.status,

      active: investment.active,

      creditedAmount: investment.creditedAmount,

      lastCreditedAt: investment.lastCreditedAt
        ? investment.lastCreditedAt.getTime()
        : null,

      transaction_id: transaction.id.toString(),

      createdAt: investment.createdAt.getTime(),
      updatedAt: investment.updatedAt.getTime(),

      balance: updatedUser.balance,
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Create investment error:", error);

    // Handle specific balance errors
    if (error.message === "INSUFFICIENT_MAIN_BALANCE") {
      return res.status(406).json({
        message: "User does not have sufficient balance.",
      });
    }

    if (error.message === "INSUFFICIENT_BTC_BALANCE") {
      return res.status(406).json({
        message: "User does not have sufficient BTC balance.",
      });
    }

    if (error.message === "INSUFFICIENT_ETH_BALANCE") {
      return res.status(406).json({
        message: "User does not have sufficient ETH balance.",
      });
    }

    if (error.message === "INSUFFICIENT_SOL_BALANCE") {
      return res.status(406).json({
        message: "User does not have sufficient SOL balance.",
      });
    }

    if (error.message === "INSUFFICIENT_USDT_BALANCE") {
      return res.status(406).json({
        message: "User does not have sufficient USDT balance.",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllInvestments,
  getInvestmentById,
  createInvestment,
};



