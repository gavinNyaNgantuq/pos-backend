const express = require("express");

const router = express.Router();

const {
  createPromotion,
  getPromotions,
  updatePromotion,
  deletePromotion
} = require("../controllers/promotionController");

const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/requireRole");

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getPromotions
);

router.post(
  "/",
  authMiddleware,
  requireRole("admin"),
  createPromotion
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  updatePromotion
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  deletePromotion
);

module.exports = router;
