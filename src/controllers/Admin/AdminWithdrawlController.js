const prisma = require("../../lib/prisma");
const { sendEmail } = require("../../services/emailService");

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).getTime();
};

const getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = [];

    for (const withdrawal of withdrawals) {
      const user = await prisma.user.findFirst({
        where: {
          uid: withdrawal.uid,
        },
        select: {
          name: true,
          email: true,
        },
      });

      data.push({
        id: withdrawal.id,
        uid: withdrawal.uid,
        user: user
          ? {
              name: user.name,
              email: user.email,
            }
          : "",
        amount: withdrawal.amount,
        to: withdrawal.to,
        method: withdrawal.method,
        status: withdrawal.status,
        transaction_id: withdrawal.transaction_id,
        createdAt: formatDate(withdrawal.createdAt),
        updatedAt: formatDate(withdrawal.updatedAt),
      });
    }

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all withdrawals error:", error);

    return res.status(500).json({
      message: "Failed to fetch withdrawals.",
    });
  }
};

const getUserWithdrawals = async (req, res) => {
  try {
    const { uid } = req.params;

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      uid: withdrawal.uid,
      amount: withdrawal.amount,
      to: withdrawal.to,
      method: withdrawal.method,
      status: withdrawal.status,
      transaction_id: withdrawal.transaction_id,
      createdAt: formatDate(withdrawal.createdAt),
      updatedAt: formatDate(withdrawal.updatedAt),
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get user withdrawals error:", error);

    return res.status(500).json({
      message: "Failed to fetch user withdrawals.",
    });
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId)) {
      return res.status(406).json({
        message: "Invalid withdrawal ID.",
      });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
    });

    if (!withdrawal || !withdrawal.uid) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: withdrawal.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const transaction = await prisma.transaction.findUnique({
      where: {
        id: Number(withdrawal.transaction_id),
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found.",
      });
    }

    const withdrawalAmount = Number(withdrawal.amount);
    const userBalance = Number(user.balance || 0);

    if (withdrawalAmount > userBalance) {
      return res.status(400).json({
        message: "User does not have sufficient balance.",
      });
    }

    /*
     * Get all earnings.
     * We preserve the old behaviour where the withdrawal
     * amount must be covered by the user's earnings.
     */
    const earnings = await prisma.earning.findMany({
      where: {
        uid: user.uid,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const totalEarnings = earnings.reduce(
      (sum, earning) => sum + Number(earning.amount || 0),
      0
    );

    if (withdrawalAmount > totalEarnings) {
      return res.status(400).json({
        message: "Insufficient earnings to cover the withdrawal.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: {
          id: withdrawalId,
        },
        data: {
          status: "approved",
        },
      });

      await tx.transaction.update({
        where: {
          id: Number(withdrawal.transaction_id),
        },
        data: {
          status: "approved",
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          balance: userBalance - withdrawalAmount,
        },
      });

      /*
       * Deduct the withdrawal amount from earnings.
       * This follows the exact logic from the old API.
       */
      let remainingAmount = withdrawalAmount;

      for (const earning of earnings) {
        if (remainingAmount <= 0) {
          break;
        }

        const earningAmount = Number(earning.amount || 0);

        if (earningAmount <= 0) {
          continue;
        }

        if (earningAmount >= remainingAmount) {
          await tx.earning.update({
            where: {
              id: earning.id,
            },
            data: {
              amount: earningAmount - remainingAmount,
            },
          });

          remainingAmount = 0;
        } else {
          await tx.earning.update({
            where: {
              id: earning.id,
            },
            data: {
              amount: 0,
            },
          });

          remainingAmount -= earningAmount;
        }
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; background:#191c24; padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            <h2 style="color:#010647;">
              Withdrawal Approved
            </h2>

            <p>
              Hello ${user.name || "Customer"},
            </p>

            <p>
              Your withdrawal request has been approved successfully.
            </p>

            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Transaction ID
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${transaction.id}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Transaction Type
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  Withdrawal
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Amount
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${withdrawalAmount.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
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

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Method
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${withdrawal.method || ""}
                </td>
              </tr>
            </table>

            <p>
              <strong>Current Balance:</strong>
              ${Number(updatedUser?.balance || 0).toLocaleString("en-US", {
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
        subject: "Withdrawal Approved Transaction",
        html,
      });
    } catch (emailError) {
      console.error("Withdrawal approval email failed:", emailError);
    }

    return res.status(200).json({
      message: "Withdrawal approved and earnings deducted successfully.",
    });
  } catch (error) {
    console.error("Approve withdrawal error:", error);

    return res.status(500).json({
      message: "An error occurred while processing the withdrawal.",
    });
  }
};

const processWithdrawal = async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId)) {
      return res.status(406).json({
        message: "Invalid withdrawal ID.",
      });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
    });

    if (!withdrawal || !withdrawal.uid) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: withdrawal.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const transaction = await prisma.transaction.findUnique({
      where: {
        id: Number(withdrawal.transaction_id),
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found.",
      });
    }

    /*
     * IMPORTANT:
     * Your current Prisma TransactionStatus enum does not contain
     * "processing".
     *
     * Therefore we do NOT write processing to Transaction here.
     *
     * We can only do this after adding "processing" to the enum.
     */

    return res.status(400).json({
      message:
        'Processing status is not available in the current Prisma TransactionStatus enum. Add "processing" to the enum before enabling this action.',
    });
  } catch (error) {
    console.error("Process withdrawal error:", error);

    return res.status(500).json({
      message: "An error occurred while processing the request.",
    });
  }
};

const declineWithdrawal = async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId)) {
      return res.status(406).json({
        message: "Invalid withdrawal ID.",
      });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
    });

    if (!withdrawal || !withdrawal.uid) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: withdrawal.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const transaction = await prisma.transaction.findUnique({
      where: {
        id: Number(withdrawal.transaction_id),
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found.",
      });
    }

    await prisma.$transaction([
      prisma.withdrawal.update({
        where: {
          id: withdrawalId,
        },
        data: {
          status: "declined",
        },
      }),

      prisma.transaction.update({
        where: {
          id: Number(withdrawal.transaction_id),
        },
        data: {
          status: "declined",
        },
      }),
    ]);

    const html = `
      <html>
        <body style="font-family:Arial;background:#191c24;padding:20px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:25px;border-radius:8px;">
            <h2 style="color:#010647;">
              Withdrawal Declined
            </h2>

            <p>Hello ${user.name || "Customer"},</p>

            <p>
              Your withdrawal request has been declined.
            </p>

            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Transaction ID
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${transaction.id}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Amount
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  ${Number(withdrawal.amount).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>

              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #ddd;">
                  Status
                </th>
                <td style="padding:8px;border:1px solid #ddd;">
                  Declined
                </td>
              </tr>
            </table>

            <p>
              If you believe this was done in error, please contact support.
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Withdrawal Declined Transaction",
        html,
      });
    } catch (emailError) {
      console.error("Withdrawal decline email failed:", emailError);
    }

    return res.status(200).json({
      message: "Withdrawal declined successfully.",
    });
  } catch (error) {
    console.error("Decline withdrawal error:", error);

    return res.status(500).json({
      message: "An error occurred while processing the request.",
    });
  }
};

const getWithdrawalById = async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId)) {
      return res.status(406).json({
        message: "Invalid withdrawal ID.",
      });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: withdrawal.uid,
      },
      select: {
        name: true,
        email: true,
        uid: true,
      },
    });

    return res.status(200).json({
      message: "success",
      data: {
        ...withdrawal,
        user,
        createdAt: formatDate(withdrawal.createdAt),
        updatedAt: formatDate(withdrawal.updatedAt),
      },
    });
  } catch (error) {
    console.error("Get withdrawal error:", error);

    return res.status(500).json({
      message: "Failed to fetch withdrawal.",
    });
  }
};

const deleteWithdrawal = async (req, res) => {
  try {
    const withdrawalId = Number(req.params.id);

    if (!Number.isInteger(withdrawalId)) {
      return res.status(406).json({
        message: "Invalid withdrawal ID.",
      });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.delete({
        where: {
          id: withdrawalId,
        },
      });

      if (withdrawal.transaction_id) {
        const transactionId = Number(withdrawal.transaction_id);

        if (Number.isInteger(transactionId)) {
          await tx.transaction.deleteMany({
            where: {
              id: transactionId,
            },
          });
        }
      }
    });

    return res.status(200).json({
      message: "Withdrawal deleted successfully.",
    });
  } catch (error) {
    console.error("Delete withdrawal error:", error);

    return res.status(500).json({
      message: "Failed to delete withdrawal.",
    });
  }
};

module.exports = {
  getAllWithdrawals,
  getUserWithdrawals,
  getWithdrawalById,
  processWithdrawal,
  approveWithdrawal,
  declineWithdrawal,
  deleteWithdrawal,
};