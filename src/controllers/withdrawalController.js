
const prisma = require("../lib/prisma");

// =====================================================
// GET ALL WITHDRAWALS
// GET /api/withdrawals/all
// =====================================================
const getAllWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        uid: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        uid: user.uid,
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
      transaction_id: withdrawal.transaction_id,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt.getTime(),
      updatedAt: withdrawal.updatedAt.getTime(),
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all withdrawals error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// =====================================================
// GET WITHDRAWAL BY ID
// GET /api/withdrawals/:id
// =====================================================
const getWithdrawalById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const withdrawalId = Number.parseInt(id, 10);

    if (Number.isNaN(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({
        message: "Invalid withdrawal id.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        uid: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        id: withdrawalId,
        uid: user.uid,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found.",
      });
    }

    const data = {
      id: withdrawal.id,
      uid: withdrawal.uid,
      amount: withdrawal.amount,
      to: withdrawal.to,
      method: withdrawal.method,
      transaction_id: withdrawal.transaction_id,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt.getTime(),
      updatedAt: withdrawal.updatedAt.getTime(),
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get withdrawal by ID error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// =====================================================
// CREATE WITHDRAWAL
// POST /api/withdrawals
// =====================================================
const createWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      amount,
      to,
      method,
      emailAddress,
      walletAddress,
      bankName,
      bankAccount,
      accountName,
      routingNumber,
    } = req.body;

    const amountNumber = Number(amount);

    // Validate amount
    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0
    ) {
      return res.status(400).json({
        message: "A valid withdrawal amount is required.",
      });
    }

    // Validate method
    if (!method) {
      return res.status(400).json({
        message: "`method` is required.",
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

    // Check balance
    if (user.balance < amountNumber) {
      return res.status(406).json({
        message: "User does not have sufficient balance.",
      });
    }

    // Create transaction and withdrawal together
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          uid: user.uid,
          amount: amountNumber,
          from: user.uid,
          to: to || "",
          method,
          emailAddress: emailAddress || user.email,
          walletAddress: walletAddress || "",
          bankName: bankName || "",
          bankAccount: bankAccount || "",
          accountName: accountName || "",
          routingNumber: routingNumber || "",
          status: "pending",
          type: "withdrawal",
        },
      });

      const withdrawal = await tx.withdrawal.create({
        data: {
          uid: user.uid,
          amount: amountNumber,
          to: to || "",
          method,
          emailAddress: emailAddress || user.email,
          walletAddress: walletAddress || "",
          bankName: bankName || "",
          bankAccount: bankAccount || "",
          accountName: accountName || "",
          routingNumber: routingNumber || "",
          transaction_id: transaction.id.toString(),
          status: "pending",
        },
      });

      return {
        transaction,
        withdrawal,
      };
    });

    const { withdrawal } = result;

    // Return immediately after the database transaction.
    // No email service is called.
    const data = {
      id: withdrawal.id,
      uid: withdrawal.uid,
      amount: withdrawal.amount,
      to: withdrawal.to,
      method: withdrawal.method,
      transaction_id: withdrawal.transaction_id,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt.getTime(),
      updatedAt: withdrawal.updatedAt.getTime(),
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Create withdrawal error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAllWithdrawals,
  getWithdrawalById,
  createWithdrawal,
};
