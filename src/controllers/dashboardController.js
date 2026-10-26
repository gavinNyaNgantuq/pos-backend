"use strict";

// =====================================================
// Dashboard statistics — agregasi nyata dari database.
// Tanpa dummy data.
// =====================================================

const db = require("../config/database");

const getStats = async (req, res) => {
  try {
    const [[today]] = await db.query(
      `SELECT
         COALESCE(SUM(total_after_tax), 0) AS revenue,
         COUNT(*) AS transactions
       FROM transactions
       WHERE status = 1
         AND DATE(created_at) = CURDATE()`
    );

    const [[week]] = await db.query(
      `SELECT COALESCE(SUM(total_after_tax), 0) AS revenue,
              COUNT(*) AS transactions
       FROM transactions
       WHERE status = 1
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );

    const [[month]] = await db.query(
      `SELECT COALESCE(SUM(total_after_tax), 0) AS revenue,
              COUNT(*) AS transactions
       FROM transactions
       WHERE status = 1
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
    );

    const [[items]] = await db.query(
      `SELECT COALESCE(SUM(tp.quantity), 0) AS items
       FROM transaction_products tp
       JOIN transactions t ON t.id = tp.transaction_id
       WHERE t.status = 1
         AND DATE(t.created_at) = CURDATE()`
    );

    const [[lowStock]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM products
       WHERE status = 1 AND stock <= min_stock`
    );

    const [topProducts] = await db.query(
      `SELECT tp.product_id, tp.product_name,
              SUM(tp.quantity) AS qty,
              SUM(tp.subtotal) AS revenue
       FROM transaction_products tp
       JOIN transactions t ON t.id = tp.transaction_id
       WHERE t.status = 1
         AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY tp.product_id, tp.product_name
       ORDER BY qty DESC
       LIMIT 5`
    );

    const [recent] = await db.query(
      `SELECT t.id, t.invoice_no, t.total_after_tax,
              t.payment_method, t.created_at, u.username
       FROM transactions t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.status = 1
       ORDER BY t.id DESC
       LIMIT 5`
    );

    return res.status(200).json({
      message: "Statistik berhasil diambil",
      data: {
        revenue_today: Number(today.revenue),
        transactions_today: Number(today.transactions),
        items_today: Number(items.items),
        revenue_7d: Number(week.revenue),
        transactions_7d: Number(week.transactions),
        revenue_30d: Number(month.revenue),
        transactions_30d: Number(month.transactions),
        low_stock_count: Number(lowStock.total),
        top_products: topProducts,
        recent_transactions: recent
      }
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  getStats
};
