const prisma = require("../../lib/prisma");
const { sendEmail } = require("../../services/emailService");

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).getTime();
};

const getAllInvestments = async (req, res) => {
  try {
    const investments = await prisma.investment.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = [];

    for (const investment of investments) {
      const earnings = await prisma.earning.findMany({
        where: {
          investment_id: String(investment.id),
        },
      });

      const totalEarnings = earnings.reduce(
        (sum, earning) => sum + Number(earning.amount || 0),
        0
      );

      data.push({
        id: investment.id,
        uid: investment.uid,
        name: investment.name,
        email: investment.email,
        plan_name: investment.plan_name,
        method: investment.method,
        duration: investment.duration,
        totalEarnings,
        plan_id: investment.plan_id,
        amount: investment.amount,
        returns: investment.returns,
        status: investment.status,
        createdAt: formatDate(investment.createdAt),
        updatedAt: formatDate(investment.updatedAt),
      });
    }

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all investments error:", error);

    return res.status(500).json({
      message: "Failed to fetch investments.",
    });
  }
};

const getUserInvestments = async (req, res) => {
  try {
    const { uid } = req.params;

    const investments = await prisma.investment.findMany({
      where: {
        uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = [];

    for (const investment of investments) {
      const earnings = await prisma.earning.findMany({
        where: {
          investment_id: String(investment.id),
        },
      });

      const totalEarnings = earnings.reduce(
        (sum, earning) => sum + Number(earning.amount || 0),
        0
      );

      data.push({
        id: investment.id,
        uid: investment.uid,
        name: investment.name,
        email: investment.email,
        plan_name: investment.plan_name,
        method: investment.method,
        duration: investment.duration,
        totalEarnings,
        plan_id: investment.plan_id,
        amount: investment.amount,
        returns: investment.returns,
        status: investment.status,
        createdAt: formatDate(investment.createdAt),
        updatedAt: formatDate(investment.updatedAt),
      });
    }

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get user investments error:", error);

    return res.status(500).json({
      message: "Failed to fetch user investments.",
    });
  }
};

const getInvestmentById = async (req, res) => {
  try {
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment ID.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: investmentId,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    const earnings = await prisma.earning.findMany({
      where: {
        investment_id: String(investment.id),
      },
    });

    const totalEarnings = earnings.reduce(
      (sum, earning) => sum + Number(earning.amount || 0),
      0
    );

    return res.status(200).json({
      message: "success",
      data: {
        ...investment,
        totalEarnings,
        createdAt: formatDate(investment.createdAt),
        updatedAt: formatDate(investment.updatedAt),
      },
    });
  } catch (error) {
    console.error("Get investment error:", error);

    return res.status(500).json({
      message: "Failed to fetch investment.",
    });
  }
};

const approveInvestment = async (req, res) => {
  try {
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment ID.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: investmentId,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: investment.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (Number(investment.amount) > Number(user.balance || 0)) {
      return res.status(406).json({
        message: "User does not have sufficient balance.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedInvestment = await tx.investment.update({
        where: {
          id: investmentId,
        },
        data: {
          status: "approved",
        },
      });

      /*
       * The old code did NOT deduct balance here because that line
       * was commented out.
       *
       * We preserve that behaviour.
       */

      const transaction = await tx.transaction.create({
        data: {
          uid: investment.uid,
          amount: investment.amount,
          from: user.uid,
          to: "admin",
          plan_id: String(investment.plan_id),
          plan_name: investment.plan_name,
          investment_id: String(investment.id),
          method: investment.method,
          status: "approved",
          type: "investment",
        },
      });

      return {
        updatedInvestment,
        transaction,
      };
    });

    const dailyReturn =
      (Number(investment.amount) * Number(investment.returns)) /
      (100 * Number(investment.duration));

    const firstName =
      user.name?.split(" ")[0] || "Customer";

    const html = `
      <html>
        <body style="font-family:Arial;background:#191c24;padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            
            <h2 style="color:#0056b3;">
              Investment Notification
            </h2>

            <p>
              Hello ${firstName},
            </p>

            <p>
              Your investment transaction has been approved.
            </p>

            <h3>Transaction Details</h3>

            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Investment ID
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${investment.id}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Plan
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${investment.plan_name}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Amount
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${Number(investment.amount).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Duration
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${investment.duration} days
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Status
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  Approved
                </td>
              </tr>
            </table>

            <p>
              Daily return: 
              ${dailyReturn.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
              })}
            </p>

            <p>
              Thank you for choosing us.
            </p>

          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Investment Transaction Approval",
        html,
      });
    } catch (emailError) {
      console.error("Investment approval email failed:", emailError);
    }

    return res.status(200).json({
      message: "success",
      dailyReturn,
      totalDuration: investment.duration,
      data: result,
    });
  } catch (error) {
    console.error("Error approving investment:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};

const processInvestment = async (req, res) => {
  try {
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment ID.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: investmentId,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    /*
     * Your current investment status field needs to support
     * "processing" for this endpoint.
     *
     * If it is a String, this works directly.
     * If it is an enum without processing, the enum must be updated.
     */

    const updatedInvestment = await prisma.investment.update({
      where: {
        id: investmentId,
      },
      data: {
        status: "processing",
      },
    });

    const user = await prisma.user.findFirst({
      where: {
        uid: investment.uid,
      },
    });

    if (user) {
      const html = `
        <html>
          <body style="font-family:Arial;background:#191c24;padding:20px;">
            <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
              <h2 style="color:#0056b3;">
                Investment Processing
              </h2>

              <p>
                Hello ${user.name || "Customer"},
              </p>

              <p>
                Your investment is now being processed.
              </p>

              <p>
                <strong>Investment ID:</strong>
                ${investment.id}
              </p>

              <p>
                <strong>Plan:</strong>
                ${investment.plan_name}
              </p>

              <p>
                <strong>Amount:</strong>
                ${Number(investment.amount).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </div>
          </body>
        </html>
      `;

      try {
        await sendEmail({
          to: user.email,
          subject: "Investment Processing Notification",
          html,
        });
      } catch (emailError) {
        console.error("Investment processing email failed:", emailError);
      }
    }

    return res.status(200).json({
      message: "Investment is now processing.",
      data: updatedInvestment,
    });
  } catch (error) {
    console.error("Process investment error:", error);

    return res.status(500).json({
      message: "Failed to process investment.",
    });
  }
};

const declineInvestment = async (req, res) => {
  try {
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment ID.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: investmentId,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: investment.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    /*
     * Preserve the old behaviour:
     * refund the investment amount to the user's balances.
     */
    const updateData = {
      balance:
        Number(user.balance || 0) +
        Number(investment.amount || 0),
    };

    if (investment.method === "BTC") {
      updateData.btcBal =
        Number(user.btcBal || 0) +
        Number(investment.amount || 0);
    }

    if (investment.method === "ETH") {
      updateData.ethBal =
        Number(user.ethBal || 0) +
        Number(investment.amount || 0);
    }

    if (investment.method === "SOL") {
      updateData.solBal =
        Number(user.solBal || 0) +
        Number(investment.amount || 0);
    }

    const updatedInvestment = await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id: user.id,
          },
          data: updateData,
        });

        return tx.investment.update({
          where: {
            id: investmentId,
          },
          data: {
            status: "declined",
          },
        });
      }
    );

    const html = `
      <html>
        <body style="font-family:Arial;background:#191c24;padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            <h2 style="color:#0056b3;">
              Investment Declined
            </h2>

            <p>
              Hello ${user.name || "Customer"},
            </p>

            <p>
              Your investment transaction has been declined.
            </p>

            <p>
              The investment amount has been returned to your account.
            </p>

            <p>
              <strong>Investment ID:</strong>
              ${investment.id}
            </p>

            <p>
              <strong>Amount:</strong>
              ${Number(investment.amount).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: investment.email || user.email,
        subject: "Investment Transaction Declined",
        html,
      });
    } catch (emailError) {
      console.error("Investment decline email failed:", emailError);
    }

    return res.status(200).json({
      message: "Investment declined successfully.",
      data: updatedInvestment,
    });
  } catch (error) {
    console.error("Decline investment error:", error);

    return res.status(500).json({
      message: "Failed to decline investment.",
    });
  }
};

const endInvestment = async (req, res) => {
  try {
    const investmentId = Number(req.params.id);

    if (!Number.isInteger(investmentId)) {
      return res.status(406).json({
        message: "Invalid investment ID.",
      });
    }

    const investment = await prisma.investment.findUnique({
      where: {
        id: investmentId,
      },
    });

    if (!investment) {
      return res.status(404).json({
        message: "Investment not found.",
      });
    }

    const updatedInvestment = await prisma.investment.update({
      where: {
        id: investmentId,
      },
      data: {
        status: "ended",
      },
    });

    const user = await prisma.user.findFirst({
      where: {
        uid: investment.uid,
      },
    });

    if (user) {
      const html = `
        <html>
          <body style="font-family:Arial;background:#191c24;padding:20px;">
            <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
              <h2 style="color:#0056b3;">
                Investment Ended
              </h2>

              <p>
                Hello ${user.name || "Customer"},
              </p>

              <p>
                Your investment has reached its end status.
              </p>

              <p>
                <strong>Investment ID:</strong>
                ${investment.id}
              </p>

              <p>
                <strong>Plan:</strong>
                ${investment.plan_name}
              </p>

              <p>
                <strong>Amount:</strong>
                ${Number(investment.amount).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </div>
          </body>
        </html>
      `;

      try {
        await sendEmail({
          to: user.email,
          subject: "Investment Transaction Ended",
          html,
        });
      } catch (emailError) {
        console.error("Investment end email failed:", emailError);
      }
    }

    return res.status(200).json({
      message: "success",
      data: updatedInvestment,
    });
  } catch (error) {
    console.error("End investment error:", error);

    return res.status(500).json({
      message: "Failed to end investment.",
    });
  }
};

module.exports = {
  getAllInvestments,
  getUserInvestments,
  getInvestmentById,
  approveInvestment,
  processInvestment,
  declineInvestment,
  endInvestment,
};