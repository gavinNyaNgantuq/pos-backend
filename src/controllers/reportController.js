"use strict";

// =====================================================
// Sales reports — agregasi nyata dari database.
//
// GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
//   &group_by=day|product|payment_method
// Default: 30 hari terakhir, group_by=day.
// =====================================================

const db = require("../config/database");

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const date = new Date(value + "T00:00:00");

  return !Number.isNaN(date.getTime());
};

const getSales = async (req, res) => {
  try {
    let { from, to, group_by = "day" } = req.query;

    if (!from || !isValidDate(from)) {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
    }

    if (!to || !isValidDate(to)) {
      to = new Date().toISOString().slice(0, 10);
    }

    if (from > to) {
      return res.status(400).json({
        message: "Rentang tanggal tidak valid"
      });
    }

    if (
      !["day", "product", "payment_method"].includes(
        group_by
      )
    ) {
      return res.status(400).json({
        message:
          "group_by harus day, product, atau payment_method"
      });
    }

    let rows;

    if (group_by === "day") {
      [rows] = await db.query(
        `SELECT DATE(t.created_at) AS label,
                COUNT(DISTINCT t.id) AS transactions,
                COALESCE(SUM(tp.quantity), 0) AS items,
                COALESCE(SUM(t.total_after_tax), 0) AS revenue
         FROM transactions t
         LEFT JOIN transaction_products tp
           ON tp.transaction_id = t.id
         WHERE t.status = 1
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY DATE(t.created_at)
         ORDER BY label ASC`,
        [from, to]
      );
    } else if (group_by === "product") {
      [rows] = await db.query(
        `SELECT tp.product_name AS label,
                SUM(tp.quantity) AS items,
                COUNT(DISTINCT tp.transaction_id) AS transactions,
                SUM(tp.subtotal) AS revenue
         FROM transaction_products tp
         JOIN transactions t
           ON t.id = tp.transaction_id
         WHERE t.status = 1
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY tp.product_id, tp.product_name
         ORDER BY revenue DESC`,
        [from, to]
      );
    } else {
      [rows] = await db.query(
        `SELECT t.payment_method AS label,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_after_tax), 0) AS revenue
         FROM transactions t
         WHERE t.status = 1
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY t.payment_method
         ORDER BY revenue DESC`,
        [from, to]
      );
    }

    const [[totals]] = await db.query(
      `SELECT COUNT(*) AS transactions,
              COALESCE(SUM(t.total_after_tax), 0) AS revenue
       FROM transactions t
       WHERE t.status = 1
         AND DATE(t.created_at) BETWEEN ? AND ?`,
      [from, to]
    );

    return res.status(200).json({
      message: "Laporan berhasil diambil",
      data: {
        from,
        to,
        group_by,
        rows,
        totals: {
          transactions: Number(totals.transactions),
          revenue: Number(totals.revenue)
        }
      }
    });
  } catch (error) {
    console.error("SALES REPORT ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  getSales
};
