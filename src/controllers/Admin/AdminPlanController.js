const prisma = require("../../lib/prisma");

// ==========================================
// CREATE PLAN
// POST /api/admin/plans
// ==========================================
const createPlan = async (req, res) => {
  try {
    const {
      name,
      returns,
      minAmount,
      duration,
      maxAmount,
      uid,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      returns === undefined ||
      minAmount === undefined ||
      duration === undefined ||
      maxAmount === undefined
    ) {
      return res.status(400).json({
        message:
          "Bad Request: `name`, `returns`, `minAmount`, `duration`, and `maxAmount` are required.",
      });
    }

    // Optional duplicate check
    const existingPlan = await prisma.plan.findFirst({
      where: {
        name,
      },
    });

    if (existingPlan) {
      return res.status(409).json({
        message: "A plan with the same name already exists.",
      });
    }

    // Create plan
    const plan = await prisma.plan.create({
      data: {
        name,
        returns: Number(returns),
        minAmount: Number(minAmount),
        duration: Number(duration),
        maxAmount: Number(maxAmount),
        uid: uid || "",
      },
    });

    const data = {
      id: plan.id,
      name: plan.name,
      returns: plan.returns,
      minAmount: plan.minAmount,
      duration: plan.duration,
      maxAmount: plan.maxAmount,
      uid: plan.uid || "",
      createdAt: plan.createdAt
        ? plan.createdAt.getTime()
        : null,
      updatedAt: plan.updatedAt
        ? plan.updatedAt.getTime()
        : null,
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Create plan error:", error);

    return res.status(500).json({
      message: "Failed to create plan.",
      error: error.message,
    });
  }
};

// ==========================================
// GET ALL PLANS
// GET /api/admin/plans
// ==========================================
const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      returns: plan.returns,
      minAmount: plan.minAmount,
      duration: plan.duration,
      maxAmount: plan.maxAmount,
      uid: plan.uid || "",
      createdAt: plan.createdAt
        ? plan.createdAt.getTime()
        : null,
      updatedAt: plan.updatedAt
        ? plan.updatedAt.getTime()
        : null,
    }));

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get all plans error:", error);

    return res.status(500).json({
      message: "Failed to fetch plans.",
      error: error.message,
    });
  }
};

// ==========================================
// GET PLAN BY ID
// GET /api/admin/plans/:id
// ==========================================
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const planId = Number(id);

    if (!Number.isInteger(planId)) {
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

    const data = {
      id: plan.id,
      name: plan.name,
      returns: plan.returns,
      minAmount: plan.minAmount,
      duration: plan.duration,
      maxAmount: plan.maxAmount,
      uid: plan.uid || "",
      createdAt: plan.createdAt
        ? plan.createdAt.getTime()
        : null,
      updatedAt: plan.updatedAt
        ? plan.updatedAt.getTime()
        : null,
    };

    return res.status(200).json({
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Get plan by ID error:", error);

    return res.status(500).json({
      message: "Failed to fetch plan.",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE PLAN
// DELETE /api/admin/plans/:id
// ==========================================
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const planId = Number(id);

    if (!Number.isInteger(planId)) {
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

    await prisma.plan.delete({
      where: {
        id: planId,
      },
    });

    return res.status(200).json({
      message: "success",
    });
  } catch (error) {
    console.error("Delete plan error:", error);

    return res.status(500).json({
      message: "Failed to delete plan.",
      error: error.message,
    });
  }
};

module.exports = {
  createPlan,
  getAllPlans,
  getPlanById,
  deletePlan,
};