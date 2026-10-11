
const express = require("express");
const router = express.Router();

const {
    deleteGateway, 
    createGateway,
    getActiveGateways,
    getAllGateways,
    updateGateway,
    setGatewayStatus
} = require("../controllers/Admin/DepositgatewayConroller");
const {
    verifyToken, 
    checkAdmin, 
    checkUser
} = require("../middleware/auth")

// Admin endpoints: list all, create, update, activate/deactivate, delete.
router.get(
  "/admin",
  verifyToken,
  checkAdmin,
  getAllGateways
);

router.post(
  "/admin",
  verifyToken,
  checkAdmin,
createGateway
);

router.patch(
  "/admin/:id",
  verifyToken,
  checkAdmin,
updateGateway
);

router.patch(
  "/admin/:id/status",
  verifyToken,
  checkAdmin,
setGatewayStatus
);

router.delete(
  "/admin/:id",
  verifyToken,
  checkAdmin,
deleteGateway
);

// User endpoint: only active gateways.
router.get(
  "/",
  verifyToken,
  checkUser,
getActiveGateways
);

module.exports = router;
