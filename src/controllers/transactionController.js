const prisma = require("../lib/prisma");

// ============================================
// GET ALL TRANSACTIONS
// ============================================
const getAllTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await prisma.transaction.findMany({
      where: {
        uid: userId.toString(),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "success",
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("Get all transactions error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// GET TRANSACTION BY ID
// ============================================
const getTransactionById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transactionId = parseInt(id, 10);

    if (Number.isNaN(transactionId)) {
      return res.status(400).json({
        message: "Invalid transaction ID.",
      });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        uid: userId.toString(),
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction does not exist.",
      });
    }

    return res.status(200).json({
      message: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction by ID error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};



module.exports = {

  getAllTransactions,
  getTransactionById,
};