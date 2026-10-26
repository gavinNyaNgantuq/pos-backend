const express = require("express");

const router = express.Router();

const {
  getSales
} = require("../controllers/reportController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

router.get(
  "/sales",
  authMiddleware,
  requireRole("admin"),
  getSales
);

module.exports = router;
