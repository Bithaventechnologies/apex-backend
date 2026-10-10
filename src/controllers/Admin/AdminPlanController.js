
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
      name === undefined ||
      name === null ||
      returns === undefined ||
      returns === null ||
      minAmount === undefined ||
      minAmount === null ||
      duration === undefined ||
      duration === null ||
      maxAmount === undefined ||
      maxAmount === null
    ) {
      return res.status(400).json({
        message:
          "name, returns, minAmount, duration, and maxAmount are required.",
      });
    }

    const planName = String(name).trim();
    const returnValue = String(returns).trim();

    const minimum = Number(minAmount);
    const maximum = Number(maxAmount);
    const planDuration = Number(duration);
    const numericReturns = Number(returnValue);

    // Validate the values before saving them as strings
    if (
      !planName ||
      !returnValue ||
      !Number.isFinite(numericReturns) ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      !Number.isFinite(planDuration) ||
      numericReturns <= 0 ||
      minimum <= 0 ||
      maximum < minimum ||
      !Number.isInteger(planDuration) ||
      planDuration <= 0
    ) {
      return res.status(400).json({
        message: "Please provide valid plan details.",
      });
    }

    // Check for duplicate plan names
    const existingPlan = await prisma.plan.findFirst({
      where: {
        name: planName,
      },
    });

    if (existingPlan) {
      return res.status(409).json({
        message: "A plan with the same name already exists.",
      });
    }

    // Create the plan.
    // These fields are strings in the current Prisma schema.
    const plan = await prisma.plan.create({
      data: {
        name: planName,
        returns: returnValue,
        minAmount: String(minAmount).trim(),
        duration: String(duration).trim(),
        maxAmount: String(maxAmount).trim(),
        uid: uid ? String(uid) : "",
      },
    });

    return res.status(201).json({
      message: "success",
      data: {
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
      },
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
      count: data.length,
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
    const planId = Number(req.params.id);

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({
        message: "Invalid plan ID.",
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

    return res.status(200).json({
      message: "success",
      data: {
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
      },
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
    const planId = Number(req.params.id);

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({
        message: "Invalid plan ID.",
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
      message_detail: "Plan deleted successfully.",
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
