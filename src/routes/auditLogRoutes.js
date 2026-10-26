const express = require("express");

const router = express.Router();

const {
  getAuditLogs
} = require("../controllers/auditLogController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getAuditLogs
);

module.exports = router;
