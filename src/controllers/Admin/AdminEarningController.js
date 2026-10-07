const prisma = require("../../lib/prisma");
const { sendEmail } = require("../../services/emailService");

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).getTime();
};

const getAllEarnings = async (req, res) => {
  try {
    const earnings = await prisma.earning.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = [];

    for (const earning of earnings) {
      const user = await prisma.user.findFirst({
        where: {
          uid: earning.uid,
        },
        select: {
          name: true,
          email: true,
        },
      });

      const investment = await prisma.investment.findFirst({
        where: {
          id: Number(earning.investment_id),
        },
      });

      data.push({
        id: earning.id,
        uid: earning.uid,
        name: user?.name || "",
        email: user?.email || "",
        amount: earning.amount,
        duration: investment?.duration || null,
        plan_name: earning.plan_name,
        plan_id: earning.plan_id,
        plan_price: investment?.amount || 0,
        investment_id: earning.investment_id,
        createdAt: formatDate(earning.createdAt),
        updatedAt: formatDate(earning.updatedAt),
      });
    }

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all earnings error:", error);

    return res.status(500).json({
      message: "Failed to fetch earnings.",
    });
  }
};

const getUserEarnings = async (req, res) => {
  try {
    const { uid } = req.params;

    const earnings = await prisma.earning.findMany({
      where: {
        uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = earnings.map((earning) => ({
      id: earning.id,
      uid: earning.uid,
      amount: earning.amount,
      plan_name: earning.plan_name,
      plan_id: earning.plan_id,
      investment_id: earning.investment_id,
      createdAt: formatDate(earning.createdAt),
      updatedAt: formatDate(earning.updatedAt),
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get user earnings error:", error);

    return res.status(500).json({
      message: "Failed to fetch user earnings.",
    });
  }
};

const getEarningById = async (req, res) => {
  try {
    const earningId = Number(req.params.id);

    if (!Number.isInteger(earningId)) {
      return res.status(406).json({
        message: "Invalid earning ID.",
      });
    }

    const earning = await prisma.earning.findUnique({
      where: {
        id: earningId,
      },
    });

    if (!earning) {
      return res.status(404).json({
        message: "Earning not found.",
      });
    }

    return res.status(200).json({
      message: "success",
      data: earning,
    });
  } catch (error) {
    console.error("Get earning error:", error);

    return res.status(500).json({
      message: "Failed to fetch earning.",
    });
  }
};

const addEarning = async (req, res) => {
  try {
    const { uid } = req.params;

    const {
      amount,
      plan_id,
      investment_id,
    } = req.body;

    const amountNumber = Number(amount);

    if (
      !plan_id ||
      !investment_id ||
      !amountNumber ||
      amountNumber <= 0
    ) {
      return res.status(400).json({
        message:
          "investment_id, plan_id, and amount are required.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: Number(investment_id),
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment does not exist.",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: {
        id: Number(plan_id),
      },
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan does not exist.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const earning = await tx.earning.create({
        data: {
          uid: user.uid,
          amount: amountNumber,
          plan_name: plan.name,
          plan_id: String(plan.id),
          investment_id: String(investment.id),
        },
      });

      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          balance: Number(user.balance || 0) + amountNumber,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          uid: user.uid,
          amount: amountNumber,
          from: "admin",
          to: String(user.id),
          plan_name: plan.name,
          plan_id: String(plan.id),
          investment_id: String(investment.id),
          type: "earn",
          status: "approved",
        },
      });

      return {
        earning,
        updatedUser,
        transaction,
      };
    });

    const html = `
      <html>
        <body style="font-family:Arial;background:#191c24;padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            <h2 style="color:#007bff;">Earnings Notification</h2>

            <p>
              Hello ${user.name || "Customer"},
            </p>

            <p>
              We are pleased to inform you that earnings have been added
              to your account.
            </p>

            <h3>Earnings Details</h3>

            <ul>
              <li>
                <strong>Amount Earned:</strong>
                ${amountNumber.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                })}
              </li>

              <li>
                <strong>Investment Plan:</strong>
                ${plan.name}
              </li>

              <li>
                <strong>Investment Amount:</strong>
                ${Number(investment.amount).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                })}
              </li>
            </ul>

            <p>
              The earnings have been added to your account balance.
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Earnings Notification",
        html,
      });
    } catch (emailError) {
      console.error("Earning email failed:", emailError);
    }

    return res.status(200).json({
      message: "success",
      data: result,
    });
  } catch (error) {
    console.error("Add earning error:", error);

    return res.status(500).json({
      message: "Failed to add earning.",
    });
  }
};

const deductEarning = async (req, res) => {
  try {
    const { uid } = req.params;

    const {
      amount,
      plan_id,
      investment_id,
    } = req.body;

    const amountNumber = Number(amount);

    if (
      !plan_id ||
      !investment_id ||
      !amountNumber ||
      amountNumber <= 0
    ) {
      return res.status(400).json({
        message:
          "investment_id, plan_id, and amount are required.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    if (Number(user.balance || 0) < amountNumber) {
      return res.status(400).json({
        message: "Insufficient balance for deduction.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: Number(investment_id),
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment does not exist.",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: {
        id: Number(plan_id),
      },
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan does not exist.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const earning = await tx.earning.create({
        data: {
          uid: user.uid,
          amount: -amountNumber,
          plan_name: plan.name,
          plan_id: String(plan.id),
          investment_id: String(investment.id),
        },
      });

      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          balance: Number(user.balance || 0) - amountNumber,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          uid: user.uid,
          amount: -amountNumber,
          from: String(user.id),
          to: "admin",
          plan_name: plan.name,
          plan_id: String(plan.id),
          investment_id: String(investment.id),
          type: "earn",
          status: "approved",
        },
      });

      return {
        earning,
        updatedUser,
        transaction,
      };
    });

    const html = `
      <html>
        <body style="font-family:Arial;background:#191c24;padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            <h2 style="color:#ff0000;">
              Earnings Deduction Notification
            </h2>

            <p>
              Hello ${user.name || "Customer"},
            </p>

            <p>
              A deduction has been made from your account.
            </p>

            <p>
              <strong>Amount Deducted:</strong>
              ${amountNumber.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
              })}
            </p>

            <p>
              <strong>Investment Plan:</strong>
              ${plan.name}
            </p>

            <p>
              Your updated balance can be viewed from your dashboard.
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Earnings Deduction Notification",
        html,
      });
    } catch (emailError) {
      console.error("Earning deduction email failed:", emailError);
    }

    return res.status(200).json({
      message: "success",
      data: result,
    });
  } catch (error) {
    console.error("Deduct earning error:", error);

    return res.status(500).json({
      message: "Failed to deduct earning.",
    });
  }
};

const getTotalEarnings = async (req, res) => {
  try {
    const { uid } = req.params;

    const earnings = await prisma.earning.findMany({
      where: {
        uid,
      },
    });

    const total = earnings.reduce(
      (sum, earning) => sum + Number(earning.amount || 0),
      0
    );

    return res.status(200).json({
      message: "success",
      total,
    });
  } catch (error) {
    console.error("Get total earnings error:", error);

    return res.status(500).json({
      message: "Failed to calculate total earnings.",
    });
  }
};

const deleteEarning = async (req, res) => {
  try {
    const earningId = Number(req.params.id);

    if (!Number.isInteger(earningId)) {
      return res.status(406).json({
        message: "Invalid earning ID.",
      });
    }

    const earning = await prisma.earning.findUnique({
      where: {
        id: earningId,
      },
    });

    if (!earning) {
      return res.status(404).json({
        message: "Earning not found.",
      });
    }

    await prisma.earning.delete({
      where: {
        id: earningId,
      },
    });

    return res.status(200).json({
      message: "Earning deleted successfully.",
    });
  } catch (error) {
    console.error("Delete earning error:", error);

    return res.status(500).json({
      message: "Failed to delete earning.",
    });
  }
};

module.exports = {
  getAllEarnings,
  getUserEarnings,
  getEarningById,
  addEarning,
  deductEarning,
  getTotalEarnings,
  deleteEarning,
};