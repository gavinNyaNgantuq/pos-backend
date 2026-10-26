const express = require("express");

const router = express.Router();

const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/rolesController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getRoles
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  getRoleById
);

router.post(
  "/",
  authMiddleware,
  requireRole("admin"),
  createRole
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  updateRole
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  deleteRole
);

module.exports = router;