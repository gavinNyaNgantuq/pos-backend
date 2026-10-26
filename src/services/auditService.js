"use strict";

// =====================================================
// Audit Service — append-only audit_logs.
//
// - TIDAK PERNAH menyimpan password, JWT, Firebase key,
//   OTP, secret, atau data sensitif. Caller hanya boleh
//   mengirim meta non-sensitif.
// - Gagal tulis audit TIDAK PERNAH menggagalkan flow
//   utama (catch + console, tanpa throw).
// =====================================================

const db = require("../config/database");

const SENSITIVE_KEYS = [
  "password",
  "password_confirmation",
  "token",
  "reset_token",
  "otp",
  "secret",
  "private_key",
  "api_key",
  "apikey"
];

const sanitizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const clean = {};

  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();

    if (
      SENSITIVE_KEYS.some((bad) =>
        lower.includes(bad)
      )
    ) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      clean[key] = value;
    }
  }

  return Object.keys(clean).length > 0
    ? JSON.stringify(clean)
    : null;
};

const logAudit = async ({
  userId = null,
  action = "",
  entity = "",
  entityId = null,
  meta = null,
  ip = null
}) => {
  try {
    if (!action || !entity) {
      return;
    }

    await db.query(
      `INSERT INTO audit_logs
       (user_id, action, entity, entity_id, meta, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entity,
        entityId,
        sanitizeMeta(meta),
        ip
      ]
    );
  } catch (error) {
    console.error(
      "AUDIT LOG ERROR:",
      error.message
    );
  }
};

module.exports = {
  logAudit
};
