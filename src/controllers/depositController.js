const prisma = require("../lib/prisma");
const { sendEmail } = require("../services/emailService");

// ============================================
// CREATE DEPOSIT
// ============================================
const createDeposit = async (req, res) => {
  try {
    const userId = req.user.id;

    const { amount, method, from } = req.body;

    const amountNumber = parseFloat(amount);

    // -----------------------------
    // Validate request
    // -----------------------------
    if (!method || !amountNumber || amountNumber <= 0 || !from) {
      return res.status(400).json({
        message:
          "Bad Request, `method`, `amount`, and `from` are required.",
      });
    }

    // -----------------------------
    // Validate payment method
    // -----------------------------
    const validMethods = ["BTC", "SOL", "ETH"];

    if (!validMethods.includes(method)) {
      return res.status(400).json({
        message: `Invalid payment method. Allowed methods are: ${validMethods.join(
          ", "
        )}.`,
      });
    }

    // -----------------------------
    // Find user
    // -----------------------------
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

    // -----------------------------
    // Create transaction + deposit
    // -----------------------------
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

    // ============================================
    // SEND DEPOSIT EMAIL
    // ============================================
    try {
      await sendEmail({
        to: user.email,
        subject: "Deposit Request Received - PatchPay",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>

          <body style="
            margin: 0;
            padding: 0;
            background-color: #f4f4f7;
            font-family: Arial, Helvetica, sans-serif;
          ">

            <div style="
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 10px;
              overflow: hidden;
            ">

              <!-- Header -->
              <div style="
                background-color: #25166B;
                padding: 25px;
                text-align: center;
              ">
                <h1 style="
                  color: #ffffff;
                  margin: 0;
                  font-size: 26px;
                ">
                  PatchPay
                </h1>
              </div>

              <!-- Content -->
              <div style="padding: 35px 30px;">

                <h2 style="
                  color: #222222;
                  margin-top: 0;
                ">
                  Deposit Request Received
                </h2>

                <p style="
                  color: #333333;
                  font-size: 15px;
                  line-height: 1.6;
                ">
                  Hello ${user.firstName || "there"},
                </p>

                <p style="
                  color: #555555;
                  font-size: 15px;
                  line-height: 1.6;
                ">
                  We have received your deposit request. Your deposit is
                  currently pending and will be processed once it has been
                  reviewed.
                </p>

                <!-- Amount -->
                <div style="
                  background-color: #f5f3ff;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 25px 0;
                  text-align: center;
                ">

                  <p style="
                    margin: 0 0 8px;
                    color: #777777;
                    font-size: 13px;
                  ">
                    Deposit Amount
                  </p>

                  <h2 style="
                    margin: 0;
                    color: #25166B;
                    font-size: 28px;
                  ">
                    USD ${Number(deposit.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h2>

                </div>

                <!-- Deposit Details -->
                <table style="
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 20px;
                ">

                  <tr>
                    <td style="
                      padding: 10px 0;
                      color: #777777;
                    ">
                      Transaction ID
                    </td>

                    <td style="
                      padding: 10px 0;
                      text-align: right;
                      font-weight: bold;
                    ">
                      ${transaction.id}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding: 10px 0;
                      color: #777777;
                    ">
                      Payment Method
                    </td>

                    <td style="
                      padding: 10px 0;
                      text-align: right;
                      font-weight: bold;
                    ">
                      ${deposit.method}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding: 10px 0;
                      color: #777777;
                    ">
                      From
                    </td>

                    <td style="
                      padding: 10px 0;
                      text-align: right;
                      font-weight: bold;
                    ">
                      ${deposit.from}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding: 10px 0;
                      color: #777777;
                    ">
                      Status
                    </td>

                    <td style="
                      padding: 10px 0;
                      text-align: right;
                      font-weight: bold;
                      color: #d97706;
                    ">
                      Pending
                    </td>
                  </tr>

                </table>

                <p style="
                  margin-top: 30px;
                  color: #555555;
                  font-size: 14px;
                  line-height: 1.6;
                ">
                  You will receive another email once your deposit has been
                  reviewed and processed.
                </p>

                <p style="
                  color: #555555;
                  font-size: 14px;
                  line-height: 1.6;
                ">
                  Thank you for using PatchPay.
                </p>

              </div>

              <!-- Footer -->
              <div style="
                background-color: #f8f8f8;
                padding: 20px;
                text-align: center;
              ">

                <p style="
                  margin: 0;
                  color: #888888;
                  font-size: 12px;
                ">
                  © ${new Date().getFullYear()} PatchPay. All rights reserved.
                </p>

              </div>

            </div>

          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error(
        "Deposit email failed:",
        emailError.message
      );
    }

    // -----------------------------
    // Response
    // -----------------------------
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
      error: error.message,
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
      error: error.message,
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

    const depositId = parseInt(id, 10);

    if (Number.isNaN(depositId)) {
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
      error: error.message,
    });
  }
};

module.exports = {
  createDeposit,
  getAllDeposits,
  getDepositById,
};