
const prisma = require("../lib/prisma");

// =====================================================
// GET USER PROFILE
// GET /api/users/profile
// =====================================================

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
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

    if (!user) {
      return res.status(404).json({
        message: "User does not exist.",
      });
    }

    return res.status(200).json({
      message: "success",
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// PATCH USER PROFILE
// PATCH /api/users/profile
// =====================================================

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      name,
      username,
      phoneNumber,
      dob,
      state,
      city,
      bankName,
      accountNumber,
      routingNumber,
      bitcoin,
      sol,
      ethereum,
      profilePic,
      referralId,
    } = req.body;

    // Build update object only with fields that were provided
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (dob !== undefined) updateData.dob = dob;
    if (state !== undefined) updateData.state = state;
    if (city !== undefined) updateData.city = city;

    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) {
      updateData.accountNumber = accountNumber;
    }
    if (routingNumber !== undefined) {
      updateData.routingNumber = routingNumber;
    }

    if (bitcoin !== undefined) updateData.bitcoin = bitcoin;
    if (sol !== undefined) updateData.sol = sol;
    if (ethereum !== undefined) updateData.ethereum = ethereum;

    if (profilePic !== undefined) {
      updateData.profilePic = profilePic;
    }

    if (referralId !== undefined) {
      updateData.referralId = referralId;
    }

    // Make sure at least one field was provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No profile fields were provided for update.",
      });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: updateData,
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

    return res.status(200).json({
      message: "Profile updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};



