
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

//========================
//Top Up User acct 
//======================



/* ============================================
   ADMIN TOP UP USER ACCOUNT
============================================ */
const topUpUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const { amount } = req.body;

    // Validate user UID
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      return res.status(400).json({
        message: "A valid user UID is required.",
      });
    }

    // Validate top-up amount
    const topUpAmount = Number(amount);

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(topUpAmount) ||
      topUpAmount <= 0 ||
      Math.round(topUpAmount * 100) !== topUpAmount * 100
    ) {
      return res.status(400).json({
        message: "Amount must be a valid positive number with at most 2 decimal places.",
      });
    }

    // Find user by UID
    const user = await prisma.user.findFirst({
      where: { uid: uid.trim() },
      select: {
        id: true,
        uid: true,
        name: true,
        username: true,
        email: true,
        balance: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Update the balance atomically inside a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      return await tx.user.update({
        where: { id: user.id },
        data: {
          balance: {
            increment: topUpAmount,
          },
        },
        select: {
          id: true,
          uid: true,
          name: true,
          username: true,
          email: true,
          balance: true,
        },
      });
    });

    // Record the action in server logs.
    // Ensure your admin authentication middleware populates req.user.
    console.info("Admin account top-up completed", {
      adminId: req.user?.id ?? req.user?.uid ?? "unknown",
      userUid: updatedUser.uid,
      amount: topUpAmount,
      previousBalance: user.balance,
      newBalance: updatedUser.balance,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      message: "User account topped up successfully.",
      data: {
        user: updatedUser,
        topUp: {
          amount: topUpAmount,
          previousBalance: user.balance,
          newBalance: updatedUser.balance,
        },
      },
    });
  } catch (error) {
    console.error("Admin top-up user error:", error);

    return res.status(500).json({
      message: "Unable to top up user account.",
    });
  }
};


module.exports = {
  getAllUsers,
  getUserByUid,
  deleteUser,
  topUpUser,
};

