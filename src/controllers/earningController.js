const prisma = require("../lib/prisma");

// GET /api/earnings/all
const getAllEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the authenticated user first
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

    // Your Earning model stores uid as a string
    const earnings = await prisma.earning.findMany({
      where: {
        uid: user.uid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get the plans associated with the earnings
    const planIds = [
      ...new Set(
        earnings
          .map((earning) => Number(earning.plan_id))
          .filter((id) => !Number.isNaN(id))
      ),
    ];

    const plans =
      planIds.length > 0
        ? await prisma.plan.findMany({
            where: {
              id: {
                in: planIds,
              },
            },
          })
        : [];

    const planMap = new Map(
      plans.map((plan) => [plan.id.toString(), plan])
    );

    const data = earnings.map((earning) => {
      const plan = planMap.get(earning.plan_id);

      return {
        id: earning.id,
        uid: earning.uid,
        amount: earning.amount,
        plan_name: earning.plan_name,
        plan_id: earning.plan_id,
        duration: plan?.duration || "",
        investment_id: earning.investment_id,
        createdAt: earning.createdAt.getTime(),
        updatedAt: earning.updatedAt.getTime(),
      };
    });

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all earnings error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// GET /api/earnings/:id
const getEarningById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const earningId = parseInt(id, 10);

    if (Number.isNaN(earningId)) {
      return res.status(406).json({
        message: "Invalid earning id.",
      });
    }

    // Find the authenticated user
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

    // Make sure the earning belongs to this user
    const earning = await prisma.earning.findFirst({
      where: {
        id: earningId,
        uid: user.uid,
      },
    });

    if (!earning) {
      return res.status(404).json({
        message: "Earning not found.",
      });
    }

    const data = {
      id: earning.id,
      uid: earning.uid,
      amount: earning.amount,
      plan_name: earning.plan_name,
      plan_id: earning.plan_id,
      investment_id: earning.investment_id,
      createdAt: earning.createdAt?.getTime(),
      updatedAt: earning.updatedAt?.getTime(),
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get earning by ID error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllEarnings,
  getEarningById,
};