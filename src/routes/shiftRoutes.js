const express = require("express");

const router = express.Router();

const {
  openShift,
  closeShift,
  getShiftStatus,
  getShifts
} = require("../controllers/shiftController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

// Status shift milik sendiri — staff & admin kasir.
router.get(
  "/status",
  authMiddleware,
  getShiftStatus
);

router.post(
  "/open",
  authMiddleware,
  openShift
);

router.post(
  "/close",
  authMiddleware,
  closeShift
);

// Riwayat shift — admin only.
router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getShifts
);

module.exports = router;
