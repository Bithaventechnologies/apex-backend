
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

    // Map supported currencies to Prisma user fields
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

    // Validate amount: allow up to 8 decimal places
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

    // Check that the user exists
    const user = await prisma.user.findFirst({
      where: { uid: uid.trim() },
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

    const previousBalance = Number(user[balanceField] ?? 0);

    // Prevent deductions that exceed the available balance.
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

    // Perform the adjustment atomically.
    // The balance condition prevents concurrent deductions from
    // reducing the wallet below zero.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.user.updateMany({
        where: {
          id: user.id,
          ...(action === "deduct"
            ? {
                [balanceField]: {
                  gte: adjustmentAmount,
                },
              }
            : {}),
        },
        data: {
          [balanceField]:
            action === "add"
              ? { increment: adjustmentAmount }
              : { decrement: adjustmentAmount },
        },
      });

      if (updateResult.count === 0) {
        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
          select: { [balanceField]: true },
        });

        if (!currentUser) {
          const error = new Error("User not found.");
          error.statusCode = 404;
          throw error;
        }

        const error = new Error(
          `Insufficient ${normalizedCurrency} balance.`
        );
        error.statusCode = 400;
        throw error;
      }

      return tx.user.findUnique({
        where: { id: user.id },
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
    });

    const newBalance = Number(result[balanceField] ?? 0);

    // Log the operation for operational monitoring.
    console.info("Admin crypto balance adjustment", {
      adminId: req.user?.id ?? req.user?.uid ?? "unknown",
      userUid: user.uid,
      action,
      currency: normalizedCurrency,
      amount: adjustmentAmount,
      previousBalance,
      newBalance,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
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
          newBalance,
        },
      },
    });
  } catch (error) {
    console.error("Admin crypto balance adjustment error:", error);

    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode === 400 || error.statusCode === 404
          ? error.message
          : "Unable to adjust user crypto balance.",
    });
  }
};



module.exports = {
  getAllUsers,
  getUserByUid,
  deleteUser,
  adjustUserBalance,
};

