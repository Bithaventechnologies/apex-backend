
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

    // 1. Validate UID
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid user UID is required.",
      });
    }

    // 2. Validate action
    if (!["add", "deduct"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "add" or "deduct".',
      });
    }

    // 3. Map currencies to the correct Prisma User fields
    const currencyFields = {
      BTC: "btcBal",
      SOL: "solBal",
      USDT: "usdtBal",
      ETH: "ethBal",
    };

    const normalizedCurrency =
      typeof currency === "string" ? currency.toUpperCase() : "";

    const balanceField = currencyFields[normalizedCurrency];

    if (!balanceField) {
      return res.status(400).json({
        success: false,
        message: "Currency must be BTC, SOL, USDT, or ETH.",
      });
    }

    // 4. Validate amount
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
        success: false,
        message:
          "Amount must be positive and have no more than 8 decimal places.",
      });
    }

    // 5. Find user and retrieve their current balances
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
        btcBal: true,
        solBal: true,
        usdtBal: true,
        ethBal: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // 6. Read the selected balance.
    // These fields are assumed to be String fields in Prisma.
    const storedBalance = user[balanceField] ?? "0";
    const previousBalance = Number(storedBalance);

    if (
      !Number.isFinite(previousBalance) ||
      previousBalance < 0
    ) {
      return res.status(400).json({
        success: false,
        message: `The user's ${normalizedCurrency} balance is invalid.`,
      });
    }

    // 7. Prevent overdrafts
    if (
      action === "deduct" &&
      previousBalance < adjustmentAmount
    ) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${normalizedCurrency} balance.`,
        data: {
          currency: normalizedCurrency,
          availableBalance: previousBalance,
          requestedAmount: adjustmentAmount,
        },
      });
    }

    // 8. Calculate the new balance
    const calculatedBalance =
      action === "add"
        ? previousBalance + adjustmentAmount
        : previousBalance - adjustmentAmount;

    const balanceToStore = String(
      Number(calculatedBalance.toFixed(8))
    );

    // 9. Update the balance transactionally.
    // Only update if the stored balance has not changed since it was read.
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.user.updateMany({
        where: {
          id: user.id,
          [balanceField]: storedBalance,
        },
        data: {
          [balanceField]: balanceToStore,
        },
      });

      if (updateResult.count !== 1) {
        const error = new Error(
          "The balance changed during this request. Please refresh and try again."
        );
        error.statusCode = 409;
        throw error;
      }

      const updated = await tx.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          id: true,
          uid: true,
          name: true,
          username: true,
          email: true,
          btcBal: true,
          solBal: true,
          usdtBal: true,
          ethBal: true,
        },
      });

      if (!updated) {
        const error = new Error(
          "User not found after balance update."
        );
        error.statusCode = 404;
        throw error;
      }

      return updated;
    });

    const actualNewBalance = Number(
      updatedUser[balanceField] ?? "0"
    );

    // 10. Log the adjustment for operational monitoring
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

    // 11. Send response
    return res.status(200).json({
      success: true,
      message:
        action === "add"
          ? `${normalizedCurrency} added successfully.`
          : `${normalizedCurrency} deducted successfully.`,
      data: {
        user: updatedUser,
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






module.exports = {
  getAllUsers,
  getUserByUid,
  deleteUser,
  adjustUserBalance,
};

