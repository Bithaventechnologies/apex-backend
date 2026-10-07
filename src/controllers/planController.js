
const prisma = require("../lib/prisma");

// =====================================================
// GET ALL PLANS
// GET /api/plans/all
// =====================================================

const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get all user UIDs attached to plans
    const uids = plans
      .map((plan) => plan.uid)
      .filter((uid) => uid);

    // Get users belonging to those UIDs
    const users =
      uids.length > 0
        ? await prisma.user.findMany({
            where: {
              uid: {
                in: uids,
              },
            },
            select: {
              id: true,
              name: true,
              username: true,
              uid: true,
              email: true,
              balance: true,
              btcBal: true,
              usdtBal: true,
              ethBal: true,
              solBal: true,
              verified: true,
              emailVerified: true,
              referralId: true,
              bitcoin: true,
              sol: true,
              ethereum: true,
              profilePic: true,
              phoneNumber: true,
              dob: true,
              state: true,
              city: true,
              bankName: true,
              accountNumber: true,
              routingNumber: true,
              type: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [];

    // Create a map so we can quickly attach users to plans
    const userMap = users.reduce((map, user) => {
      map[user.uid] = user;
      return map;
    }, {});

    const data = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      returns: plan.returns,
      minAmount: plan.minAmount,
      duration: plan.duration,
      maxAmount: plan.maxAmount,
      uid: plan.uid || "",
      user: plan.uid ? userMap[plan.uid] || null : null,
      createdAt: plan.createdAt.getTime(),
      updatedAt: plan.updatedAt.getTime(),
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Error fetching plans:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// GET PLAN BY ID
// GET /api/plans/:id
// =====================================================

const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const planId = parseInt(id, 10);

    if (Number.isNaN(planId)) {
      return res.status(406).json({
        message: "Invalid plan id.",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found.",
      });
    }

    let attachedUser = null;

    // Find user attached to the plan
    if (plan.uid) {
      attachedUser = await prisma.user.findUnique({
        where: {
          uid: plan.uid,
        },
        select: {
          id: true,
          name: true,
          username: true,
          uid: true,
          email: true,
          balance: true,
          btcBal: true,
          usdtBal: true,
          ethBal: true,
          solBal: true,
          verified: true,
          emailVerified: true,
          referralId: true,
          bitcoin: true,
          sol: true,
          ethereum: true,
          profilePic: true,
          phoneNumber: true,
          dob: true,
          state: true,
          city: true,
          bankName: true,
          accountNumber: true,
          routingNumber: true,
          type: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const data = {
      id: plan.id,
      name: plan.name,
      returns: plan.returns,
      minAmount: plan.minAmount,
      duration: plan.duration,
      maxAmount: plan.maxAmount,
      uid: plan.uid || "",
      user: attachedUser,
      createdAt: plan.createdAt.getTime(),
      updatedAt: plan.updatedAt.getTime(),
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Error fetching plan:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
};









