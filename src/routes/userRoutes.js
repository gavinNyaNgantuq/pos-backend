const express = require("express");

const router = express.Router();

const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require("../controllers/userController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

// CREATE — admin only
router.post(
  "/",
  authMiddleware,
  requireRole("admin"),
  createUser
);

// READ ALL — admin only
router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getUsers
);

// READ BY ID — admin only
router.get(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  getUserById
);

// UPDATE — admin only
router.put(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  updateUser
);

// DELETE (SOFT DELETE) — admin only
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  deleteUser
);

module.exports = router;