
const prisma = require("../../lib/prisma");

// ============================================
// GET ALL USERS
// ============================================
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = await Promise.all(
      users.map(async (user) => {
        const [
          activeInvestments,
          pendingWithdrawals,
          totalWithdrawals,
          totalDeposits,
          earnings,
        ] = await Promise.all([
          prisma.investment.aggregate({
            where: {
              uid: user.id.toString(),
              active: true,
            },
            _sum: {
              amount: true,
            },
          }),

          prisma.withdrawal.aggregate({
            where: {
              uid: user.id.toString(),
              status: "pending",
            },
            _sum: {
              amount: true,
            },
          }),

          prisma.withdrawal.aggregate({
            where: {
              uid: user.id.toString(),
              status: "approved",
            },
            _sum: {
              amount: true,
            },
          }),

          prisma.deposit.aggregate({
            where: {
              uid: user.id.toString(),
              status: "approved",
            },
            _sum: {
              amount: true,
            },
          }),

          prisma.earning.aggregate({
            where: {
              uid: user.id.toString(),
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          uid: user.uid,
          email: user.email,

          // NEVER return password
          balance: user.balance,

          activeInvestments:
            activeInvestments._sum.amount || 0,

          pendingWithdrawals:
            pendingWithdrawals._sum.amount || 0,

          totalWithdrawals:
            totalWithdrawals._sum.amount || 0,

          totalDeposits:
            totalDeposits._sum.amount || 0,

          earnings:
            earnings._sum.amount || 0,

          verified: user.verified,
          referralId: user.referralId,

          bitcoin: user.bitcoin,
          sol: user.sol,
          ethereum: user.ethereum,

          type: user.type,

          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      })
    );

    return res.status(200).json({
      message: "success",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get all admin users error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// GET USER BY UID
// ============================================
const getUserByUid = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const [
      activeInvestments,
      pendingWithdrawals,
      totalWithdrawals,
      totalDeposits,
      earnings,
    ] = await Promise.all([
      prisma.investment.aggregate({
        where: {
          uid,
          active: true,
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.withdrawal.aggregate({
        where: {
          uid,
          status: "pending",
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.withdrawal.aggregate({
        where: {
          uid,
          status: "approved",
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.deposit.aggregate({
        where: {
          uid,
          status: "approved",
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.earning.aggregate({
        where: {
          uid,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return res.status(200).json({
      message: "success",

      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        uid: user.uid,
        email: user.email,
        balance: user.balance,

        activeInvestments:
          activeInvestments._sum.amount || 0,

        pendingWithdrawals:
          pendingWithdrawals._sum.amount || 0,

        totalWithdrawals:
          totalWithdrawals._sum.amount || 0,

        totalDeposits:
          totalDeposits._sum.amount || 0,

        earnings:
          earnings._sum.amount || 0,

        verified: user.verified,
        referralId: user.referralId,

        bitcoin: user.bitcoin,
        sol: user.sol,
        ethereum: user.ethereum,

        type: user.type,

        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get admin user error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// DELETE USER
// ============================================
const deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.investment.deleteMany({
        where: {
          uid,
        },
      });

      await tx.withdrawal.deleteMany({
        where: {
          uid,
        },
      });

      await tx.deposit.deleteMany({
        where: {
          uid,
        },
      });

      await tx.earning.deleteMany({
        where: {
          uid,
        },
      });

      await tx.transaction.deleteMany({
        where: {
          uid,
        },
      });

      await tx.user.delete({
        where: {
          id: user.id,
        },
      });
    });

    return res.status(200).json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Delete admin user error:", error);

    return res.status(500).json({
      message: "Something went wrong.",
      error: error.message,
    });
  }
};





/* ============================================
   ADMIN TOP UP USER ACCOUNT
============================================ */

/**
 * ADMIN: ADD OR DEDUCT CRYPTO FUNDS
 *
 * POST /api/admin/users/:uid/adjust-balance
 *
 * Request body:
 * {
 *   "action": "add",
 *   "currency": "BTC",
 *   "amount": 0.005
 * }
 *
 * Supported actions: add, deduct
 * Supported currencies: BTC, SOL, ETH
 */


const adjustUserBalance = async (req, res) => {
  try {
    const { uid } = req.params;
    const { action, currency, amount } = req.body;

    // Validate user UID
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      return res.status(400).json({
        message: "A valid user UID is required.",
      });
    }

    // Validate action
    if (!["add", "deduct"].includes(action)) {
      return res.status(400).json({
        message: 'Action must be either "add" or "deduct".',
      });
    }

    // Map currencies to Prisma user fields
    const currencyFields = {
      BTC: "bitcoin",
      SOL: "sol",
      ETH: "ethereum",
    };

    const normalizedCurrency =
      typeof currency === "string" ? currency.toUpperCase() : "";

    const balanceField = currencyFields[normalizedCurrency];

    if (!balanceField) {
      return res.status(400).json({
        message: "Currency must be BTC, SOL, or ETH.",
      });
    }

    // Validate amount: positive number, maximum 8 decimal places
    const adjustmentAmount = Number(amount);

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(adjustmentAmount) ||
      adjustmentAmount <= 0 ||
      Math.round(adjustmentAmount * 100000000) !==
        adjustmentAmount * 100000000
    ) {
      return res.status(400).json({
        message:
          "Amount must be positive and have no more than 8 decimal places.",
      });
    }

    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        uid: uid.trim(),
      },
      select: {
        id: true,
        uid: true,
        name: true,
        username: true,
        email: true,
        bitcoin: true,
        sol: true,
        ethereum: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Convert the stored String balance to a number for calculation
    const storedBalance = user[balanceField] ?? "0";
    const previousBalance = Number(storedBalance);

    if (
      !Number.isFinite(previousBalance) ||
      previousBalance < 0
    ) {
      return res.status(400).json({
        message: `The user's ${normalizedCurrency} balance is invalid.`,
      });
    }

    // Prevent deductions greater than the available balance
    if (
      action === "deduct" &&
      previousBalance < adjustmentAmount
    ) {
      return res.status(400).json({
        message: `Insufficient ${normalizedCurrency} balance.`,
        data: {
          currency: normalizedCurrency,
          availableBalance: previousBalance,
          requestedAmount: adjustmentAmount,
        },
      });
    }

    // Calculate the new balance
    const calculatedBalance =
      action === "add"
        ? previousBalance + adjustmentAmount
        : previousBalance - adjustmentAmount;

    // Avoid floating-point residue and store as a String
    const newBalance = Number(calculatedBalance.toFixed(8));
    const balanceToStore = String(newBalance);

    // Update inside a transaction.
    // The balance condition detects if the value changed since it was read.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.user.updateMany({
        where: {
          id: user.id,
          [balanceField]: storedBalance,
        },
        data: {
          [balanceField]: balanceToStore,
        },
      });

      if (updateResult.count === 0) {
        const error = new Error(
          "The balance changed during this request. Please refresh and try again."
        );
        error.statusCode = 409;
        throw error;
      }

      const updatedUser = await tx.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          id: true,
          uid: true,
          name: true,
          username: true,
          email: true,
          bitcoin: true,
          sol: true,
          ethereum: true,
        },
      });

      if (!updatedUser) {
        const error = new Error("User not found after balance update.");
        error.statusCode = 404;
        throw error;
      }

      return updatedUser;
    });

    const actualNewBalance = Number(result[balanceField] ?? "0");

    // Operational log
    console.info("Admin crypto balance adjustment", {
      adminId: req.user?.id ?? req.user?.uid ?? "unknown",
      userUid: user.uid,
      action,
      currency: normalizedCurrency,
      amount: adjustmentAmount,
      previousBalance,
      newBalance: actualNewBalance,
      timestamp: new Date().toISOString(),
    });

    // Success response
    return res.status(200).json({
      success: true,
      message:
        action === "add"
          ? `${normalizedCurrency} added successfully.`
          : `${normalizedCurrency} deducted successfully.`,
      data: {
        user: result,
        adjustment: {
          action,
          currency: normalizedCurrency,
          amount: adjustmentAmount,
          previousBalance,
          newBalance: actualNewBalance,
        },
      },
    });
  } catch (error) {
    console.error("Admin crypto balance adjustment error:", error);

    const statusCode = [400, 404, 409].includes(error.statusCode)
      ? error.statusCode
      : 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode !== 500
          ? error.message
          : "Unable to adjust user crypto balance.",
    });
  }
};

export { adjustUserBalance };




module.exports = {
  getAllUsers,
  getUserByUid,
  deleteUser,
  adjustUserBalance,
};

