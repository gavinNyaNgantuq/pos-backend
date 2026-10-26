const db = require("../config/database");

const createCheckout = async (req, res) => {
  let connection;

  try {
    const {
      products,
      discount = 0,
      payment,
      payment_method = "cash",
      promotion_code = null,
      payment_ref = null,
      shift_id = null
    } = req.body || {};

    const userId = req.user.id;
    const userRole = req.user.role;

    // VALIDASI PRODUCTS
    if (
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        message: "Products wajib diisi"
      });
    }

    // VALIDASI DISCOUNT
    const discountRate = Number(discount);

    if (
      Number.isNaN(discountRate) ||
      discountRate < 0 ||
      discountRate > 100
    ) {
      return res.status(400).json({
        message:
          "Discount harus antara 0 sampai 100 persen"
      });
    }

    // CUSTOMER TIDAK BOLEH MEMBERIKAN DISCOUNT
    if (
      userRole !== "admin" &&
      userRole !== "staff" &&
      discountRate > 0
    ) {
      return res.status(403).json({
        message:
          "Customer tidak dapat memberikan discount"
      });
    }

    // VALIDASI PAYMENT METHOD
    const allowedPaymentMethods = [
      "cash",
      "qris",
      "transfer",
      "debit",
      "credit"
    ];

    if (
      !allowedPaymentMethods.includes(
        payment_method
      )
    ) {
      return res.status(400).json({
        message:
          "Payment method harus cash, qris, transfer, debit, atau credit"
      });
    }

    // AMBIL CONNECTION
    connection =
      await db.getConnection();

    await connection.beginTransaction();

    // VALIDASI SHIFT (opsional — enforcement penuh menyusul
    // setelah flow shift terbukti stabil).
    let shiftId = null;

    if (shift_id !== null && shift_id !== undefined) {
      const [shiftRows] = await connection.query(
        `SELECT id
         FROM shifts
         WHERE id = ?
           AND user_id = ?
           AND status = 'open'
         LIMIT 1`,
        [shift_id, userId]
      );

      if (shiftRows.length === 0) {
        throw new Error(
          "Shift tidak valid atau sudah ditutup"
        );
      }

      shiftId = shiftRows[0].id;
    }

    // VALIDASI PROMOTION CODE (opsional).
    let promotion = null;

    if (
      promotion_code !== null &&
      promotion_code !== undefined &&
      String(promotion_code).trim() !== ""
    ) {
      const [promoRows] = await connection.query(
        `SELECT id, code, type, value, min_purchase,
                quota, used, starts_at, ends_at
         FROM promotions
         WHERE code = ?
           AND status = 1
         LIMIT 1`,
        [String(promotion_code).trim()]
      );

      if (promoRows.length === 0) {
        throw new Error(
          "Kode promo tidak valid"
        );
      }

      promotion = promoRows[0];

      const now = new Date();

      if (
        (promotion.starts_at &&
          new Date(promotion.starts_at) > now) ||
        (promotion.ends_at &&
          new Date(promotion.ends_at) < now)
      ) {
        throw new Error(
          "Kode promo sudah tidak berlaku"
        );
      }

      if (
        promotion.quota !== null &&
        Number(promotion.used) >=
          Number(promotion.quota)
      ) {
        throw new Error(
          "Kuota kode promo sudah habis"
        );
      }
    }

    // CARI PPN 11%
    const [taxRows] =
      await connection.query(
        `SELECT
          id,
          name,
          rate
        FROM ms_taxes
        WHERE status = 1
          AND rate = 11
          AND (
            name = 'PPN'
            OR name LIKE 'PPN%'
          )
        ORDER BY id ASC
        LIMIT 1`
      );

    if (taxRows.length === 0) {
      throw new Error(
        "Tax PPN 11% belum tersedia di database"
      );
    }

    const taxData = taxRows[0];

    const taxId = taxData.id;
    const taxName = taxData.name;
    const taxRate = Number(
      taxData.rate
    );

    // CEK PRODUK
    let totalBeforeDiscount = 0;

    const productData = [];

    for (const item of products) {
      if (!item.product_id) {
        throw new Error(
          "product_id wajib diisi"
        );
      }

      const quantity = Number(
        item.quantity
      );

      if (
        Number.isNaN(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          "Quantity harus lebih dari 0"
        );
      }

      const [rows] =
        await connection.query(
          `SELECT
            id,
            product_name,
            price,
            stock
          FROM products
          WHERE id = ?
            AND status = 1
          FOR UPDATE`,
          [item.product_id]
        );

      if (rows.length === 0) {
        throw new Error(
          `Product dengan id ${item.product_id} tidak ditemukan`
        );
      }

      const product = rows[0];

      // CEK STOCK
      if (
        quantity >
        Number(product.stock)
      ) {
        throw new Error(
          `Stock ${product.product_name} tidak mencukupi`
        );
      }

      const price = Number(
        product.price
      );

      const subtotal =
        price * quantity;

      totalBeforeDiscount +=
        subtotal;

      productData.push({
        product_id: product.id,
        product_name:
          product.product_name,
        quantity,
        price,
        subtotal
      });
    }

    // HITUNG PROMO (opsional, sebelum diskon manual).
    let promotionId = null;
    let promotionCode = null;
    let promotionAmount = 0;

    if (promotion) {
      if (
        totalBeforeDiscount <
        Number(promotion.min_purchase)
      ) {
        throw new Error(
          `Minimum pembelian promo ini ${Number(
            promotion.min_purchase
          )}`
        );
      }

      if (promotion.type === "nominal") {
        promotionAmount = Math.min(
          Number(promotion.value),
          totalBeforeDiscount
        );
      } else {
        promotionAmount =
          totalBeforeDiscount *
          (Number(promotion.value) / 100);
      }

      promotionId = promotion.id;
      promotionCode = promotion.code;

      // Kunci kuota promo (atomic, anti race).
      const [quotaResult] = await connection.query(
        `UPDATE promotions
         SET used = used + 1,
             updated_at = NOW()
         WHERE id = ?
           AND (quota IS NULL OR used < quota)`,
        [promotion.id]
      );

      if (quotaResult.affectedRows === 0) {
        throw new Error(
          "Kuota kode promo sudah habis"
        );
      }
    }

    const totalAfterPromo =
      totalBeforeDiscount - promotionAmount;

    // HITUNG DISCOUNT (manual, persen).
    const discountAmount =
      totalAfterPromo *
      (discountRate / 100);

    const totalAfterDiscount =
      totalAfterPromo -
      discountAmount;

    // TOTAL SEBELUM TAX
    const totalBeforeTax =
      totalAfterDiscount;

    // HITUNG PPN
    const taxAmount =
      totalAfterDiscount *
      (taxRate / 100);

    // TOTAL AKHIR
    const totalAfterTax =
      totalBeforeTax +
      taxAmount;

    // PAYMENT
    const paymentAmount =
      payment === undefined
        ? totalAfterTax
        : Number(payment);

    if (
      Number.isNaN(paymentAmount) ||
      paymentAmount < 0
    ) {
      throw new Error(
        "Payment tidak valid"
      );
    }

    // CEK PAYMENT
    if (
      paymentAmount <
      totalAfterTax
    ) {
      throw new Error(
        `Payment kurang. Total pembayaran: ${totalAfterTax}`
      );
    }

    // HITUNG KEMBALIAN
    const change =
      paymentAmount -
      totalAfterTax;

    // CREATE TRANSACTION
    const [
      transactionResult
    ] = await connection.query(
      `INSERT INTO transactions
      (
        user_id,
        total_before_discount,
        discount,
        promotion_id,
        total_after_discount,
        total_before_tax,
        tax_id,
        tax_name,
        tax_rate,
        tax_amount,
        total_after_tax,
        payment,
        payment_method,
        payment_ref,
        shift_id,
        \`change\`,
        status,
        created_at,
        created_by
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
      [
        userId,
        totalBeforeDiscount,
        discountRate,
        promotionId,
        totalAfterDiscount,
        totalBeforeTax,
        taxId,
        taxName,
        taxRate,
        taxAmount,
        totalAfterTax,
        paymentAmount,
        payment_method,
        payment_ref,
        shiftId,
        change,
        userId
      ]
    );

    const transactionId =
      transactionResult.insertId;

    // NOMOR INVOICE PROFESIONAL: INV-YYYYMMDD-XXXX
    // (XXXX dari id auto-increment — unik by construction,
    // kompatibel dengan transaksi lama yang di-backfill
    // dengan formula yang sama).
    await connection.query(
      `UPDATE transactions
       SET invoice_no = CONCAT(
         'INV-',
         DATE_FORMAT(NOW(), '%Y%m%d'),
         '-',
         LPAD(?, 4, '0')
       )
       WHERE id = ?`,
      [transactionId, transactionId]
    );

    const [invoiceRows] = await connection.query(
      `SELECT invoice_no
       FROM transactions
       WHERE id = ?`,
      [transactionId]
    );

    const invoiceNo =
      invoiceRows.length > 0
        ? invoiceRows[0].invoice_no
        : null;

    // CREATE TRANSACTION PRODUCTS
    for (const item of productData) {
      await connection.query(
        `INSERT INTO transaction_products
        (
          transaction_id,
          product_id,
          product_name,
          quantity,
          price,
          subtotal,
          status,
          created_at,
          created_by
        )
        VALUES
        (?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
        [
          transactionId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.price,
          item.subtotal,
          userId
        ]
      );

      // KURANGI STOCK
      const [
        stockResult
      ] = await connection.query(
        `UPDATE products
         SET
           stock = stock - ?,
           updated_at = NOW(),
           updated_by = ?
         WHERE id = ?
           AND status = 1
           AND stock >= ?`,
        [
          item.quantity,
          userId,
          item.product_id,
          item.quantity
        ]
      );

      if (
        stockResult.affectedRows === 0
      ) {
        throw new Error(
          `Stock ${item.product_name} tidak mencukupi`
        );
      }
    }

    // COMMIT
    await connection.commit();

    const { logAudit } = require("../services/auditService");

    logAudit({
      userId,
      action: "transaction.checkout",
      entity: "transaction",
      entityId: transactionId,
      meta: {
        invoice_no: invoiceNo,
        total: totalAfterTax,
        payment_method
      },
      ip: req.ip
    });

    // RESPONSE
    return res.status(201).json({
      message:
        "Checkout berhasil",

      data: {
        transaction_id:
          transactionId,

        invoice_no:
          invoiceNo,

        total_before_discount:
          totalBeforeDiscount,

        discount_rate:
          discountRate,

        discount_amount:
          discountAmount,

        promotion_id:
          promotionId,

        promotion_code:
          promotionCode,

        promotion_amount:
          promotionAmount,

        total_after_discount:
          totalAfterDiscount,

        total_before_tax:
          totalBeforeTax,

        tax_id:
          taxId,

        tax_name:
          taxName,

        tax_rate:
          taxRate,

        tax_amount:
          taxAmount,

        total_after_tax:
          totalAfterTax,

        payment:
          paymentAmount,

        payment_method:
          payment_method,

        payment_ref:
          payment_ref,

        shift_id:
          shiftId,

        change:
          change
      }
    });

  } catch (error) {
    // ROLLBACK
    if (connection) {
      await connection.rollback();
    }

    console.error(
      "CHECKOUT ERROR:",
      error
    );

    return res.status(400).json({
      message:
        error.message ||
        "Checkout gagal"
    });

  } finally {
    // RELEASE CONNECTION
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createCheckout
};