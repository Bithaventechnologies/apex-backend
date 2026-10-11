

const prisma = require("../../lib/prisma");

const ALLOWED_CURRENCIES = ["BTC", "ETH", "SOL", "USDT"];

function validateGateway(body) {
  const name = String(body.name || "").trim();
  const currency = String(body.currency || "").toUpperCase().trim();
  const network = String(body.network || "").trim();
  const address = String(body.address || "").trim();

  if (!name || !currency || !network || !address) {
    return {
      error: "name, currency, network, and address are required.",
    };
  }

  if (!ALLOWED_CURRENCIES.includes(currency)) {
    return {
      error: "Currency must be BTC, ETH, SOL, or USDT.",
    };
  }

  return {
    data: {
      name,
      currency,
      network,
      address,
      qrCode: body.qrCode ? String(body.qrCode).trim() : null,
      instructions: body.instructions
        ? String(body.instructions).trim()
        : null,
    },
  };
}

// GET /api/deposit-gateways
// Authenticated users can see active gateways.
const getActiveGateways = async (req, res) => {
  try {
    const gateways = await prisma.depositGateway.findMany({
      where: { isActive: true },
      orderBy: [{ currency: "asc" }, { createdAt: "desc" }],
    });

    return res.status(200).json({
      message: "success",
      data: gateways,
    });
  } catch (error) {
    console.error("Get active gateways error:", error);
    return res.status(500).json({
      message: "Unable to fetch deposit gateways.",
    });
  }
};

// GET /api/admin/deposit-gateways
// Admin can see active and inactive gateways.
const getAllGateways = async (req, res) => {
  try {
    const gateways = await prisma.depositGateway.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      message: "success",
      data: gateways,
    });
  } catch (error) {
    console.error("Get all gateways error:", error);
    return res.status(500).json({
      message: "Unable to fetch deposit gateways.",
    });
  }
};

// POST /api/admin/deposit-gateways
const createGateway = async (req, res) => {
  try {
    const result = validateGateway(req.body);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const gateway = await prisma.depositGateway.create({
      data: {
        ...result.data,
        isActive: req.body.isActive === undefined
          ? true
          : req.body.isActive === true,
      },
    });

    return res.status(201).json({
      message: "Deposit gateway created successfully.",
      data: gateway,
    });
  } catch (error) {
    console.error("Create gateway error:", error);
    return res.status(500).json({
      message: "Unable to create deposit gateway.",
    });
  }
};

// PATCH /api/admin/deposit-gateways/:id
const updateGateway = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid gateway ID." });
    }

    const existing = await prisma.depositGateway.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        message: "Deposit gateway not found.",
      });
    }

    const data = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ message: "Name cannot be empty." });
      }
      data.name = name;
    }

    if (req.body.currency !== undefined) {
      const currency = String(req.body.currency).toUpperCase().trim();
      if (!ALLOWED_CURRENCIES.includes(currency)) {
        return res.status(400).json({
          message: "Currency must be BTC, ETH, SOL, or USDT.",
        });
      }
      data.currency = currency;
    }

    for (const field of ["network", "address"]) {
      if (req.body[field] !== undefined) {
        const value = String(req.body[field]).trim();
        if (!value) {
          return res.status(400).json({
            message: `${field} cannot be empty.`,
          });
        }
        data[field] = value;
      }
    }

    for (const field of ["qrCode", "instructions"]) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field]
          ? String(req.body[field]).trim()
          : null;
      }
    }

    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be true or false.",
        });
      }
      data.isActive = req.body.isActive;
    }

    const gateway = await prisma.depositGateway.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      message: "Deposit gateway updated successfully.",
      data: gateway,
    });
  } catch (error) {
    console.error("Update gateway error:", error);
    return res.status(500).json({
      message: "Unable to update deposit gateway.",
    });
  }
};

// PATCH /api/admin/deposit-gateways/:id/status
const setGatewayStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isActive } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid gateway ID." });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false.",
      });
    }

    const gateway = await prisma.depositGateway.update({
      where: { id },
      data: { isActive },
    });

    return res.status(200).json({
      message: isActive ? "Gateway activated." : "Gateway deactivated.",
      data: gateway,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Deposit gateway not found.",
      });
    }

    console.error("Set gateway status error:", error);
    return res.status(500).json({
      message: "Unable to update gateway status.",
    });
  }
};

// DELETE /api/admin/deposit-gateways/:id
const deleteGateway = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid gateway ID." });
    }

    // Historical deposits remain in the database.
    // Their gatewayId becomes null because of onDelete: SetNull.
    await prisma.depositGateway.delete({ where: { id } });

    return res.status(200).json({
      message: "Deposit gateway deleted successfully.",
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Deposit gateway not found.",
      });
    }

    console.error("Delete gateway error:", error);
    return res.status(500).json({
      message: "Unable to delete deposit gateway.",
    });
  }
};


module.exports= {
    deleteGateway, 
    setGatewayStatus,
    updateGateway,
    createGateway,
    getActiveGateways,
    getAllGateways,
}