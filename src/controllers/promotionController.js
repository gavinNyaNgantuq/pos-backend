"use strict";

// =====================================================
// Promotions — kode promo percent / nominal.
// Dipakai checkout via promotion_code (opsional).
// Diskon manual existing TIDAK diubah.
// =====================================================

const db = require("../config/database");
const { logAudit } = require("../services/auditService");

const validatePromotionInput = (body) => {
  const {
    code,
    type = "percent",
    value,
    min_purchase = 0,
    quota = null,
    starts_at = null,
    ends_at = null,
    status = 1
  } = body || {};

  if (!code || String(code).trim() === "") {
    return { error: "Kode promo wajib diisi" };
  }

  if (!["percent", "nominal"].includes(type)) {
    return {
      error: "Tipe promo harus percent atau nominal"
    };
  }

  if (value === undefined || Number(value) < 0) {
    return {
      error: "Nilai promo tidak valid"
    };
  }

  if (
    type === "percent" &&
    Number(value) > 100
  ) {
    return {
      error: "Promo persen maksimal 100"
    };
  }

  if (Number(min_purchase) < 0) {
    return {
      error: "Minimum pembelian tidak valid"
    };
  }

  if (
    quota !== null &&
    quota !== undefined &&
    quota !== "" &&
    Number(quota) < 0
  ) {
    return {
      error: "Kuota tidak valid"
    };
  }

  return {
    data: {
      code: String(code).trim().toUpperCase(),
      type,
      value: Number(value),
      min_purchase: Number(min_purchase),
      quota:
        quota === null ||
        quota === undefined ||
        quota === ""
          ? null
          : Number(quota),
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      status: Number(status) === 0 ? 0 : 1
    }
  };
};

const createPromotion = async (req, res) => {
  try {
    const { error, data } = validatePromotionInput(
      req.body
    );

    if (error) {
      return res.status(400).json({ message: error });
    }

    const [inserted] = await db.query(
      `INSERT INTO promotions
       (code, type, value, min_purchase, quota,
        starts_at, ends_at, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        data.code,
        data.type,
        data.value,
        data.min_purchase,
        data.quota,
        data.starts_at,
        data.ends_at,
        data.status,
        req.user.id
      ]
    );

    logAudit({
      userId: req.user.id,
      action: "promotion.create",
      entity: "promotion",
      entityId: inserted.insertId,
      meta: { code: data.code, type: data.type },
      ip: req.ip
    });

    return res.status(201).json({
      message: "Promo berhasil dibuat",
      data: { id: inserted.insertId }
    });
  } catch (error) {
    console.error("CREATE PROMOTION ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Kode promo sudah digunakan"
      });
    }

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getPromotions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, code, type, value, min_purchase,
              quota, used, starts_at, ends_at, status,
              created_at
       FROM promotions
       WHERE status = 1
       ORDER BY id DESC`
    );

    return res.status(200).json({
      message: "Data promo berhasil diambil",
      data: rows
    });
  } catch (error) {
    console.error("GET PROMOTIONS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, data } = validatePromotionInput(
      req.body
    );

    if (error) {
      return res.status(400).json({ message: error });
    }

    const [existing] = await db.query(
      `SELECT id FROM promotions
       WHERE id = ? AND status = 1`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Promo tidak ditemukan"
      });
    }

    await db.query(
      `UPDATE promotions
       SET code = ?, type = ?, value = ?,
           min_purchase = ?, quota = ?,
           starts_at = ?, ends_at = ?,
           status = ?, updated_at = NOW(),
           updated_by = ?
       WHERE id = ?`,
      [
        data.code,
        data.type,
        data.value,
        data.min_purchase,
        data.quota,
        data.starts_at,
        data.ends_at,
        data.status,
        req.user.id,
        id
      ]
    );

    logAudit({
      userId: req.user.id,
      action: "promotion.update",
      entity: "promotion",
      entityId: Number(id),
      meta: { code: data.code },
      ip: req.ip
    });

    return res.status(200).json({
      message: "Promo berhasil diupdate"
    });
  } catch (error) {
    console.error("UPDATE PROMOTION ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Kode promo sudah digunakan"
      });
    }

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      `SELECT id FROM promotions
       WHERE id = ? AND status = 1`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Promo tidak ditemukan"
      });
    }

    await db.query(
      `UPDATE promotions
       SET status = 0, deleted_at = NOW(),
           deleted_by = ?
       WHERE id = ?`,
      [req.user.id, id]
    );

    logAudit({
      userId: req.user.id,
      action: "promotion.delete",
      entity: "promotion",
      entityId: Number(id),
      meta: null,
      ip: req.ip
    });

    return res.status(200).json({
      message: "Promo berhasil dihapus"
    });
  } catch (error) {
    console.error("DELETE PROMOTION ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  createPromotion,
  getPromotions,
  updatePromotion,
  deletePromotion
};
