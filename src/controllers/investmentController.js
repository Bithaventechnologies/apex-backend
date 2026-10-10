
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


// =====================================================
// CREATE INVESTMENT
// POST /api/investments
// Deducts ONLY from user.balance
// =====================================================

const createInvestment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan_id, amount, method } = req.body;

    const amountNumber = Number(amount);

    // VALIDATION
    if (
      !plan_id ||
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0
    ) {
      return res.status(400).json({
        message: "A valid plan_id and investment amount are required.",
      });
    }

    // The investment must use the main account balance.
    if (method !== "BALANCE") {
      return res.status(400).json({
        message: "Invalid payment method. Use your main account balance.",
      });
    }

    // FIND USER
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

    // FIND PLAN
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

    // VALIDATE PLAN AMOUNT
    const minimum = Number(investmentPlan.minAmount);

    const maximum =
      investmentPlan.maxAmount === null ||
      investmentPlan.maxAmount === undefined ||
      investmentPlan.maxAmount === ""
        ? null
        : Number(investmentPlan.maxAmount);

    if (amountNumber < minimum) {
      return res.status(400).json({
        message: `The minimum investment for ${investmentPlan.name} is ${minimum}.`,
      });
    }

    if (maximum !== null && amountNumber > maximum) {
      return res.status(400).json({
        message: `The maximum investment for ${investmentPlan.name} is ${maximum}.`,
      });
    }

    // ATOMIC TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      /*
       * Only update the main balance.
       *
       * updateMany with a balance condition prevents a concurrent
       * request from deducting funds if the balance is no longer
       * sufficient.
       *
       * Crypto balances are deliberately NOT updated.
       */
      const deduction = await tx.user.updateMany({
        where: {
          id: userId,
          balance: {
            gte: amountNumber,
          },
        },
        data: {
          balance: {
            decrement: amountNumber,
          },
        },
      });

      if (deduction.count !== 1) {
        throw new Error("INSUFFICIENT_MAIN_BALANCE");
      }

      const updatedUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!updatedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      // CREATE INVESTMENT
      const investment = await tx.investment.create({
        data: {
          uid: updatedUser.uid,
          name: updatedUser.name,
          email: updatedUser.email,

          plan_id: investmentPlan.id.toString(),
          plan_name: investmentPlan.name,

          method: "BALANCE",
          duration: investmentPlan.duration,
          amount: amountNumber,
          returns: parseFloat(investmentPlan.returns) || 0,

          active: false,
          creditedAmount: 0,
          status: "pending",
        },
      });

      // CREATE TRANSACTION HISTORY
      const transaction = await tx.transaction.create({
        data: {
          uid: updatedUser.uid,
          amount: amountNumber,

          from: updatedUser.uid,
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

    const { investment, transaction, updatedUser } = result;

    // SEND EMAIL
    try {
      const firstName =
        user.name && user.name.trim()
          ? user.name.trim().split(" ")[0]
          : "User";

      await sendEmail({
        to: user.email,
        subject: "Investment",
        html: `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Investment Notification</title>
            </head>
            <body style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
              <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:24px;">
                <h2 style="color:#25166B;">Investment Notification</h2>

                <p>Hello ${firstName},</p>

                <p>Your investment request has been submitted successfully.</p>

                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Investment ID</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${investment.id}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Plan</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${investment.plan_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Amount</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">
                      ${investment.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Payment source</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Main account balance</td>
                  </tr>
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Duration</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${investment.duration} days</td>
                  </tr>
                  <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">Status</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${investment.status.toUpperCase()}</td>
                  </tr>
                </table>

                <p>If you have any questions, please contact our support team.</p>

                <p>Best regards,<br />Apex Signal Trade</p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      // Email failure must not undo a completed database transaction.
      console.error("Investment email failed:", emailError.message);
    }

    // RESPONSE
    return res.status(201).json({
      message: "success",
      data: {
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
      },
    });
  } catch (error) {
    console.error("Create investment error:", error);

    if (error.message === "INSUFFICIENT_MAIN_BALANCE") {
      return res.status(400).json({
        message: "You do not have sufficient main account balance.",
      });
    }

    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        message: "User does not exist.",
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



