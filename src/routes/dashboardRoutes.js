const express = require("express");

const router = express.Router();

const {
  getStats
} = require("../controllers/dashboardController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

router.get(
  "/stats",
  authMiddleware,
  requireRole("admin"),
  getStats
);

module.exports = router;
