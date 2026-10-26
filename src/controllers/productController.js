const db = require("../config/database");
const { logAudit } = require("../services/auditService");

// =========================
// CREATE PRODUCT
// =========================
const createProduct = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const {
      category_id,
      product_name,
      price,
      stock,
      sku = null,
      barcode = null,
      min_stock = 0
    } = req.body || {};

    if (
      category_id === undefined ||
      !product_name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        message: "Category, product name, price, and stock are required"
      });
    }

    if (
      Number(price) < 0 ||
      Number(stock) < 0 ||
      Number(min_stock) < 0
    ) {
      return res.status(400).json({
        message: "Price, stock, dan minimum stock tidak boleh negatif"
      });
    }

    const [category] = await db.query(
      "SELECT id FROM categories WHERE id = ? AND status = 1",
      [category_id]
    );

    if (category.length === 0) {
      return res.status(404).json({
        message: "Category tidak ditemukan"
      });
    }

    const createdBy = req.user.id;
    const image = req.file ? req.file.filename : null;

    const [productResult] = await db.query(
      `INSERT INTO products
      (
        category_id,
        product_name,
        sku,
        barcode,
        image,
        price,
        stock,
        min_stock,
        status,
        created_at,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
      [
        category_id,
        product_name,
        sku || null,
        barcode || null,
        image,
        price,
        stock,
        min_stock,
        createdBy
      ]
    );

    logAudit({
      userId: createdBy,
      action: "product.create",
      entity: "product",
      entityId: productResult.insertId,
      meta: { product_name },
      ip: req.ip
    });

    return res.status(201).json({
      message: "Product berhasil dibuat"
    });

  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "SKU atau barcode sudah digunakan"
      });
    }

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


// =========================
// GET ALL PRODUCTS
// =========================
const getProducts = async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT
        p.id,
        p.category_id,
        c.name AS category_name,
        p.product_name,
        p.sku,
        p.barcode,
        p.image,
        p.price,
        p.stock,
        p.min_stock,
        p.status,
        p.created_at,
        p.created_by,
        p.updated_at,
        p.updated_by
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      WHERE p.status = 1`
    );

    return res.status(200).json({
      message: "Data product berhasil diambil",
      data: products
    });

  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


// =========================
// GET PRODUCT BY ID
// =========================
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await db.query(
      `SELECT
        p.id,
        p.category_id,
        c.name AS category_name,
        p.product_name,
        p.sku,
        p.barcode,
        p.image,
        p.price,
        p.stock,
        p.min_stock,
        p.status,
        p.created_at,
        p.created_by,
        p.updated_at,
        p.updated_by
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      WHERE p.id = ? AND p.status = 1`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        message: "Product tidak ditemukan"
      });
    }

    return res.status(200).json({
      message: "Data product berhasil diambil",
      data: products[0]
    });

  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


// =========================
// UPDATE PRODUCT
// =========================
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      category_id,
      product_name,
      price,
      stock,
      sku = null,
      barcode = null,
      min_stock = 0
    } = req.body || {};

    if (
      category_id === undefined ||
      !product_name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        message: "Category, product name, price, and stock are required"
      });
    }

    if (
      Number(price) < 0 ||
      Number(stock) < 0 ||
      Number(min_stock) < 0
    ) {
      return res.status(400).json({
        message: "Price, stock, dan minimum stock tidak boleh negatif"
      });
    }

    const [product] = await db.query(
      "SELECT id FROM products WHERE id = ? AND status = 1",
      [id]
    );

    if (product.length === 0) {
      return res.status(404).json({
        message: "Product tidak ditemukan"
      });
    }

    const [category] = await db.query(
      "SELECT id FROM categories WHERE id = ? AND status = 1",
      [category_id]
    );

    if (category.length === 0) {
      return res.status(404).json({
        message: "Category tidak ditemukan"
      });
    }

    const updatedBy = req.user.id;

    if (req.file) {
      await db.query(
        `UPDATE products
         SET category_id = ?,
             product_name = ?,
             sku = ?,
             barcode = ?,
             image = ?,
             price = ?,
             stock = ?,
             min_stock = ?,
             updated_at = NOW(),
             updated_by = ?
         WHERE id = ? AND status = 1`,
        [
          category_id,
          product_name,
          sku || null,
          barcode || null,
          req.file.filename,
          price,
          stock,
          min_stock,
          updatedBy,
          id
        ]
      );
    } else {
      await db.query(
        `UPDATE products
         SET category_id = ?,
             product_name = ?,
             sku = ?,
             barcode = ?,
             price = ?,
             stock = ?,
             min_stock = ?,
             updated_at = NOW(),
             updated_by = ?
         WHERE id = ? AND status = 1`,
        [
          category_id,
          product_name,
          sku || null,
          barcode || null,
          price,
          stock,
          min_stock,
          updatedBy,
          id
        ]
      );
    }

    logAudit({
      userId: updatedBy,
      action: "product.update",
      entity: "product",
      entityId: Number(id),
      meta: { product_name },
      ip: req.ip
    });

    return res.status(200).json({
      message: "Product berhasil diupdate"
    });

  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "SKU atau barcode sudah digunakan"
      });
    }

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


// =========================
// DELETE PRODUCT - SOFT DELETE
// =========================
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [product] = await db.query(
      "SELECT id FROM products WHERE id = ? AND status = 1",
      [id]
    );

    if (product.length === 0) {
      return res.status(404).json({
        message: "Product tidak ditemukan"
      });
    }

    const deletedBy = req.user.id;

    await db.query(
      `UPDATE products
       SET status = 0,
           deleted_at = NOW(),
           deleted_by = ?
       WHERE id = ?`,
      [deletedBy, id]
    );

    logAudit({
      userId: deletedBy,
      action: "product.delete",
      entity: "product",
      entityId: Number(id),
      meta: null,
      ip: req.ip
    });

    return res.status(200).json({
      message: "Product berhasil dihapus"
    });

  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    return res.status(500).json({
      message: "Product gagal dihapus"
    });
  }
};


// (exports didefinisikan di akhir file)


// =====================================================
// GET LOW STOCK PRODUCTS (stock <= min_stock)
// =====================================================
const getLowStockProducts = async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT
        p.id,
        p.category_id,
        c.name AS category_name,
        p.product_name,
        p.sku,
        p.barcode,
        p.image,
        p.price,
        p.stock,
        p.min_stock,
        p.status
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      WHERE p.status = 1
        AND p.stock <= p.min_stock
      ORDER BY p.stock ASC`
    );

    return res.status(200).json({
      message: "Data produk stok rendah berhasil diambil",
      data: products
    });

  } catch (error) {
    console.error("GET LOW STOCK ERROR:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


// =====================================================
// ADJUST STOCK (penyesuaian tercatat + tercatat audit)
// =====================================================
const adjustStock = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;

    const {
      qty_change,
      reason
    } = req.body || {};

    if (
      qty_change === undefined ||
      Number.isNaN(Number(qty_change)) ||
      Number(qty_change) === 0 ||
      !reason ||
      String(reason).trim() === ""
    ) {
      return res.status(400).json({
        message: "qty_change (non-nol) dan reason wajib diisi"
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, product_name, stock
       FROM products
       WHERE id = ? AND status = 1
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      throw new Error("Product tidak ditemukan");
    }

    const newStock =
      Number(rows[0].stock) + Number(qty_change);

    if (newStock < 0) {
      throw new Error(
        "Hasil penyesuaian membuat stok negatif"
      );
    }

    await connection.query(
      `UPDATE products
       SET stock = ?,
           updated_at = NOW(),
           updated_by = ?
       WHERE id = ?`,
      [newStock, req.user.id, id]
    );

    await connection.query(
      `INSERT INTO stock_adjustments
       (product_id, qty_change, reason, created_by)
       VALUES (?, ?, ?, ?)`,
      [
        id,
        Number(qty_change),
        String(reason).trim().slice(0, 100),
        req.user.id
      ]
    );

    await connection.commit();

    logAudit({
      userId: req.user.id,
      action: "product.adjust_stock",
      entity: "product",
      entityId: Number(id),
      meta: {
        qty_change: Number(qty_change),
        stock_after: newStock
      },
      ip: req.ip
    });

    return res.status(200).json({
      message: "Stok berhasil disesuaikan",
      data: { stock: newStock }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("ADJUST STOCK ERROR:", error);

    return res.status(400).json({
      message: error.message || "Gagal menyesuaikan stok"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getLowStockProducts,
  updateProduct,
  deleteProduct,
  adjustStock
};
