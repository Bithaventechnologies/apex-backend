
const prisma = require("../lib/prisma");

// ============================================
// CREATE DEPOSIT
// ============================================
const createDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, from } = req.body;

    const amountNumber = Number(amount);

    // Validate request
    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !method ||
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      !from
    ) {
      return res.status(400).json({
        message:
          "Bad Request: method, amount, and from are required.",
      });
    }

    // Validate payment method
    const validMethods = ["BTC", "SOL", "ETH"];

    if (!validMethods.includes(method)) {
      return res.status(400).json({
        message: `Invalid payment method. Allowed methods are: ${validMethods.join(
          ", "
        )}.`,
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    // Create transaction and deposit atomically
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          uid: user.id.toString(),
          amount: amountNumber,
          from,
          to: "Admin",
          method,
          type: "deposit",
          status: "pending",
        },
      });

      const deposit = await tx.deposit.create({
        data: {
          uid: user.id.toString(),
          amount: amountNumber,
          from,
          to: "Admin",
          method,
          transaction_id: transaction.id.toString(),
          status: "pending",
        },
      });

      return {
        transaction,
        deposit,
      };
    });

    const { transaction, deposit } = result;

    // Return immediately after the database operation completes.
    // No email or external SMTP request is made here.
    return res.status(200).json({
      message: "success",
      data: {
        id: deposit.id,
        uid: deposit.uid,
        amount: deposit.amount,
        from: deposit.from,
        to: deposit.to,
        method: deposit.method,
        status: deposit.status,
        transaction_id: deposit.transaction_id,
        createdAt: deposit.createdAt.getTime(),
        updatedAt: deposit.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error("Create deposit error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ============================================
// GET ALL DEPOSITS
// ============================================
const getAllDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    const deposits = await prisma.deposit.findMany({
      where: {
        uid: userId.toString(),
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
    console.error("Get all deposits error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ============================================
// GET DEPOSIT BY ID
// ============================================
const getDepositById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const depositId = Number.parseInt(id, 10);

    if (Number.isNaN(depositId) || depositId <= 0) {
      return res.status(400).json({
        message: "Invalid deposit ID.",
      });
    }

    const deposit = await prisma.deposit.findFirst({
      where: {
        id: depositId,
        uid: userId.toString(),
      },
    });

    if (!deposit) {
      return res.status(404).json({
        message: "Deposit does not exist.",
      });
    }

    return res.status(200).json({
      message: "success",
      data: deposit,
    });
  } catch (error) {
    console.error("Get deposit by ID error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createDeposit,
  getAllDeposits,
  getDepositById,
};
