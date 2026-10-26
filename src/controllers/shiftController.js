"use strict";

// =====================================================
// Shifts — Open / Close kasir.
//
// - Satu user hanya boleh punya 1 shift open.
// - Checkout TIDAK wajib shift (transisi bertahap):
//   shift_id opsional, disimpan bila dikirim & valid.
// - Tutup shift menghitung expected_cash dari transaksi
//   cash pada shift tersebut.
// =====================================================

const db = require("../config/database");
const { logAudit } = require("../services/auditService");

const getOpenShift = async (userId) => {
  const [rows] = await db.query(
    `SELECT id, user_id, opened_at, opening_cash,
            status, notes
     FROM shifts
     WHERE user_id = ? AND status = 'open'
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  return rows.length > 0 ? rows[0] : null;
};

const openShift = async (req, res) => {
  try {
    const { opening_cash = 0, notes = null } = req.body || {};

    if (Number.isNaN(Number(opening_cash))) {
      return res.status(400).json({
        message: "Modal awal tidak valid"
      });
    }

    const existing = await getOpenShift(req.user.id);

    if (existing) {
      return res.status(409).json({
        message: "Masih ada shift yang terbuka",
        data: existing
      });
    }

    const [inserted] = await db.query(
      `INSERT INTO shifts
       (user_id, opened_at, opening_cash, status,
        notes, created_at, created_by)
       VALUES (?, NOW(), ?, 'open', ?, NOW(), ?)`,
      [
        req.user.id,
        Number(opening_cash),
        notes ? String(notes).slice(0, 255) : null,
        req.user.id
      ]
    );

    const shift = await getOpenShift(req.user.id);

    logAudit({
      userId: req.user.id,
      action: "shift.open",
      entity: "shift",
      entityId: inserted.insertId,
      meta: { opening_cash: Number(opening_cash) },
      ip: req.ip
    });

    return res.status(201).json({
      message: "Shift berhasil dibuka",
      data: shift
    });
  } catch (error) {
    console.error("OPEN SHIFT ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const closeShift = async (req, res) => {
  try {
    const { closing_cash, notes = null } = req.body || {};

    if (
      closing_cash === undefined ||
      Number.isNaN(Number(closing_cash))
    ) {
      return res.status(400).json({
        message: "Kas akhir tidak valid"
      });
    }

    const shift = await getOpenShift(req.user.id);

    if (!shift) {
      return res.status(404).json({
        message: "Tidak ada shift yang terbuka"
      });
    }

    const [sums] = await db.query(
      `SELECT COALESCE(SUM(total_after_tax), 0) AS cash_in
       FROM transactions
       WHERE shift_id = ?
         AND payment_method = 'cash'
         AND status = 1`,
      [shift.id]
    );

    const expectedCash =
      Number(shift.opening_cash) +
      Number(sums[0].cash_in);

    const diff =
      Number(closing_cash) - expectedCash;

    await db.query(
      `UPDATE shifts
       SET closed_at = NOW(),
           closing_cash = ?,
           expected_cash = ?,
           diff = ?,
           notes = COALESCE(?, notes),
           status = 'closed',
           updated_at = NOW(),
           updated_by = ?
       WHERE id = ? AND status = 'open'`,
      [
        Number(closing_cash),
        expectedCash,
        diff,
        notes ? String(notes).slice(0, 255) : null,
        req.user.id,
        shift.id
      ]
    );

    logAudit({
      userId: req.user.id,
      action: "shift.close",
      entity: "shift",
      entityId: shift.id,
      meta: {
        expected_cash: expectedCash,
        closing_cash: Number(closing_cash),
        diff
      },
      ip: req.ip
    });

    return res.status(200).json({
      message: "Shift berhasil ditutup",
      data: {
        id: shift.id,
        expected_cash: expectedCash,
        closing_cash: Number(closing_cash),
        diff
      }
    });
  } catch (error) {
    console.error("CLOSE SHIFT ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getShiftStatus = async (req, res) => {
  try {
    const shift = await getOpenShift(req.user.id);

    return res.status(200).json({
      message: "Status shift berhasil diambil",
      data: shift
    });
  } catch (error) {
    console.error("SHIFT STATUS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

const getShifts = async (req, res) => {
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

    const [rows] = await db.query(
      `SELECT s.id, s.user_id, u.username,
              s.opened_at, s.opening_cash,
              s.closed_at, s.closing_cash,
              s.expected_cash, s.diff,
              s.status, s.notes
       FROM shifts s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [counts] = await db.query(
      `SELECT COUNT(*) AS total FROM shifts`
    );

    return res.status(200).json({
      message: "Data shift berhasil diambil",
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(counts[0].total)
      }
    });
  } catch (error) {
    console.error("GET SHIFTS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  openShift,
  closeShift,
  getShiftStatus,
  getShifts
};
