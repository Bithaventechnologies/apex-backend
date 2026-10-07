
const prisma = require("../../lib/prisma");
const { sendEmail } = require("../../services/emailService");

// ============================================
// GET ALL DEPOSITS
// ============================================
const getAllDeposits = async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = await Promise.all(
      deposits.map(async (deposit) => {
        const user = await prisma.user.findFirst({
          where: {
            uid: deposit.uid,
          },
        });

        return {
          id: deposit.id,
          uid: deposit.uid,
          amount: deposit.amount,
          from: deposit.from,
          to: deposit.to,
          method: deposit.method,
          status: deposit.status,
          transaction_id: deposit.transaction_id,

          user: user
            ? {
                name: user.name,
                email: user.email,
              }
            : null,

          createdAt: deposit.createdAt,
          updatedAt: deposit.updatedAt,
        };
      })
    );

    return res.status(200).json({
      message: "success",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get all admin deposits error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// GET USER DEPOSITS
// ============================================
const getUserDeposits = async (req, res) => {
  try {
    const { uid } = req.params;

    const deposits = await prisma.deposit.findMany({
      where: {
        uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "success",
      count: deposits.length,
      data: deposits,
    });
  } catch (error) {
    console.error("Get user deposits error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// PROCESS DEPOSIT
// ============================================
const processDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const depositId = parseInt(id, 10);

    if (Number.isNaN(depositId)) {
      return res.status(400).json({
        message: "Invalid deposit ID.",
      });
    }

    const deposit = await prisma.deposit.findUnique({
      where: {
        id: depositId,
      },
    });

    if (!deposit) {
      return res.status(404).json({
        message: "Deposit not found.",
      });
    }

    const transactionId = parseInt(
      deposit.transaction_id,
      10
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedDeposit =
        await tx.deposit.update({
          where: {
            id: depositId,
          },
          data: {
            status: "processing",
          },
        });

      let updatedTransaction = null;

      if (!Number.isNaN(transactionId)) {
        updatedTransaction =
          await tx.transaction.update({
            where: {
              id: transactionId,
            },
            data: {
              status: "processing",
            },
          });
      }

      return {
        updatedDeposit,
        updatedTransaction,
      };
    });

    return res.status(200).json({
      message: "Deposit is now processing.",
      data: result.updatedDeposit,
    });
  } catch (error) {
    console.error("Process deposit error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// APPROVE DEPOSIT
// ============================================
const approveDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const depositId = parseInt(id, 10);

    if (Number.isNaN(depositId)) {
      return res.status(400).json({
        message: "Invalid deposit ID.",
      });
    }

    const deposit = await prisma.deposit.findUnique({
      where: {
        id: depositId,
      },
    });

    if (!deposit) {
      return res.status(404).json({
        message: "Deposit not found.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: deposit.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const transactionId = parseInt(
      deposit.transaction_id,
      10
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const updatedUser =
          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              balance:
                Number(user.balance || 0) +
                Number(deposit.amount),
            },
          });

        const updatedDeposit =
          await tx.deposit.update({
            where: {
              id: depositId,
            },
            data: {
              status: "approved",
            },
          });

        let updatedTransaction = null;

        if (!Number.isNaN(transactionId)) {
          updatedTransaction =
            await tx.transaction.update({
              where: {
                id: transactionId,
              },
              data: {
                status: "approved",
              },
            });
        }

        return {
          updatedUser,
          updatedDeposit,
          updatedTransaction,
        };
      }
    );

    // ========================================
    // EMAIL USER
    // ========================================
    try {
      await sendEmail({
        to: user.email,
        subject: "Deposit Approved - PatchPay",
        html: `
          <h2>Deposit Approved</h2>

          <p>Hello ${user.name || "there"},</p>

          <p>
            Your deposit has been approved successfully.
          </p>

          <p>
            <strong>Amount:</strong>
            $${Number(deposit.amount).toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
              }
            )}
          </p>

          <p>
            <strong>Transaction ID:</strong>
            ${deposit.transaction_id}
          </p>

          <p>
            <strong>Status:</strong>
            Approved
          </p>

          <p>
            Your updated balance is
            <strong>
              $${Number(
                result.updatedUser.balance
              ).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </strong>.
          </p>

          <p>
            Thank you for using PatchPay.
          </p>
        `,
      });
    } catch (emailError) {
      console.error(
        "Deposit approval email failed:",
        emailError.message
      );
    }

    return res.status(200).json({
      message: "Deposit approved successfully.",
      data: result.updatedDeposit,
    });
  } catch (error) {
    console.error("Approve deposit error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// DECLINE DEPOSIT
// ============================================
const declineDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const depositId = parseInt(id, 10);

    if (Number.isNaN(depositId)) {
      return res.status(400).json({
        message: "Invalid deposit ID.",
      });
    }

    const deposit = await prisma.deposit.findUnique({
      where: {
        id: depositId,
      },
    });

    if (!deposit) {
      return res.status(404).json({
        message: "Deposit not found.",
      });
    }

    const transactionId = parseInt(
      deposit.transaction_id,
      10
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const updatedDeposit =
          await tx.deposit.update({
            where: {
              id: depositId,
            },
            data: {
              status: "declined",
            },
          });

        let updatedTransaction = null;

        if (!Number.isNaN(transactionId)) {
          updatedTransaction =
            await tx.transaction.update({
              where: {
                id: transactionId,
              },
              data: {
                status: "declined",
              },
            });
        }

        return {
          updatedDeposit,
          updatedTransaction,
        };
      }
    );

    const user = await prisma.user.findFirst({
      where: {
        uid: deposit.uid,
      },
    });

    if (user) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Deposit Declined - PatchPay",
          html: `
            <h2>Deposit Declined</h2>

            <p>Hello ${user.name || "there"},</p>

            <p>
              Unfortunately, your deposit request has been
              declined.
            </p>

            <p>
              <strong>Amount:</strong>
              $${Number(deposit.amount).toLocaleString(
                "en-US",
                {
                  minimumFractionDigits: 2,
                }
              )}
            </p>

            <p>
              <strong>Transaction ID:</strong>
              ${deposit.transaction_id}
            </p>

            <p>
              <strong>Status:</strong>
              Declined
            </p>

            <p>
              Please contact support if you believe this
              was done in error.
            </p>
          `,
        });
      } catch (emailError) {
        console.error(
          "Deposit decline email failed:",
          emailError.message
        );
      }
    }

    return res.status(200).json({
      message: "Deposit declined successfully.",
      data: result.updatedDeposit,
    });
  } catch (error) {
    console.error("Decline deposit error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllDeposits,
  getUserDeposits,
  processDeposit,
  approveDeposit,
  declineDeposit,
};

