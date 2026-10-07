
const prisma = require("../lib/prisma");
const { sendEmail } = require("../services/emailService");

// =====================================================
// GET ALL WITHDRAWALS
// GET /api/withdrawals/all
// =====================================================

const getAllWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the logged-in user
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
      error: error.message,
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

    const withdrawalId = parseInt(id, 10);

    if (Number.isNaN(withdrawalId)) {
      return res.status(406).json({
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
      error: error.message,
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

    const amountNumber = parseFloat(amount);

    // Basic validation
    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({
        message: "A valid withdrawal amount is required.",
      });
    }

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

    // Create transaction + withdrawal together
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          uid: user.uid,

          amount: amountNumber,

          from: user.uid,
          to: to || "",

          method: method || "",

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
          method: method || "",

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

    const { transaction, withdrawal } = result;

    // =====================================================
    // SEND WITHDRAWAL EMAIL
    // =====================================================

    try {
      await sendEmail({
        to: user.email,
        subject: "Withdrawal Transaction Notification",
        html: `
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />

              <title>Withdrawal Notification</title>

              <style>
                body {
                  font-family: Arial, sans-serif;
                  background-color: #191c24;
                  margin: 0;
                  padding: 0;
                }

                .container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: #fff;
                  color: #191c24;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                h2 {
                  color: #010647;
                  margin-top: 0;
                }

                table {
                  width: 100%;
                  border-collapse: collapse;
                }

                th,
                td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: left;
                  text-transform: capitalize;
                }

                th {
                  background-color: #f2f2f2;
                }

                td {
                  background-color: #ffffff;
                }

                ul {
                  list-style-type: none;
                  padding: 0;
                }

                a {
                  color: #007bff;
                  text-decoration: none;
                }

                a:hover {
                  text-decoration: underline;
                }
              </style>
            </head>

            <body>
              <div class="container">
                <h2>Apex Signal Trade Electronic Notification</h2>

                <p>
                  We wish to inform you that a transaction occurred on your
                  account with us.
                </p>

                <h3>Transaction Notification</h3>

                <table>
                  <tr>
                    <th>Transaction ID:</th>
                    <td>${transaction.id}</td>
                  </tr>

                  <tr>
                    <th>Transaction Type:</th>
                    <td>WITHDRAWAL</td>
                  </tr>

                  <tr>
                    <th>Amount:</th>
                    <td>
                      ${transaction.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr>
                    <th>From:</th>
                    <td>Apex Signal Trade</td>
                  </tr>

                  <tr>
                    <th>To:</th>
                    <td>${user.name.toUpperCase()}</td>
                  </tr>

                  <tr>
                    <th>Status:</th>
                    <td>${transaction.status.toUpperCase()}</td>
                  </tr>

                  <tr>
                    <th>Transaction Method:</th>
                    <td>${transaction.method}</td>
                  </tr>
                </table>

                <ul>
                  <li>
                    <strong>Current Balance:</strong>
                    ${user.balance.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                    })}
                  </li>
                </ul>

                <p>
                  The privacy and security of your account details are
                  important to us. If you have any concerns or questions,
                  please contact our support team.
                </p>

                <p>
                  Thank you for choosing Apex Signal Trade.
                </p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      // Do not fail the withdrawal because email failed
      console.error(
        "Withdrawal email failed:",
        emailError.message
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================

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
      error: error.message,
    });
  }
};

module.exports = {
  getAllWithdrawals,
  getWithdrawalById,
  createWithdrawal,
};



