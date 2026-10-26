"use strict";

// =====================================================
// Audit logs — read-only untuk admin.
// Tabel append-only, tidak ada endpoint tulis/update.
// =====================================================

const db = require("../config/database");

const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );
    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );
    const offset = (page - 1) * limit;

    const { entity, action } = req.query;

    const conditions = [];
    const params = [];

    if (entity) {
      conditions.push("l.entity = ?");
      params.push(String(entity).slice(0, 64));
    }

    if (action) {
      conditions.push("l.action = ?");
      params.push(String(action).slice(0, 64));
    }

    const where =
      conditions.length > 0
        ? "WHERE " + conditions.join(" AND ")
        : "";

    const [rows] = await db.query(
      `SELECT l.id, l.user_id, u.username,
              l.action, l.entity, l.entity_id,
              l.meta, l.ip, l.created_at
       FROM audit_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ${where}
       ORDER BY l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [counts] = await db.query(
      `SELECT COUNT(*) AS total
       FROM audit_logs l
       ${where}`,
      params
    );

    return res.status(200).json({
      message: "Audit log berhasil diambil",
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(counts[0].total)
      }
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  getAuditLogs
};
