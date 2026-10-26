-- =====================================================
-- Migration 003: POS upgrade — product identity,
-- professional invoice number, payment reference,
-- promotions.
--
-- RULE:
-- - Aditif saja. Tidak mengubah/menghapus kolom existing.
-- - Tidak DROP TABLE, tidak recreate database.
-- - Kolom baru NULL-able/DEFAULT agar backward-compatible
--   dengan kode lama dan data existing.
-- =====================================================

-- ---------- PRODUCTS: sku / barcode / min_stock ----------

ALTER TABLE products
  ADD COLUMN sku VARCHAR(64) NULL DEFAULT NULL
    AFTER product_name,
  ADD COLUMN barcode VARCHAR(64) NULL DEFAULT NULL
    AFTER sku,
  ADD COLUMN min_stock INT NOT NULL DEFAULT 0
    AFTER stock;

ALTER TABLE products
  ADD UNIQUE KEY uq_products_sku (sku),
  ADD UNIQUE KEY uq_products_barcode (barcode),
  ADD KEY idx_products_min_stock (stock, min_stock);

-- ---------- PROMOTIONS (baru) ----------

CREATE TABLE IF NOT EXISTS promotions (
  id INT(11) NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  type ENUM('percent','nominal') NOT NULL DEFAULT 'percent',
  value DECIMAL(15,2) NOT NULL,
  min_purchase DECIMAL(15,2) NOT NULL DEFAULT 0,
  quota INT(11) NULL DEFAULT NULL,
  used INT(11) NOT NULL DEFAULT 0,
  starts_at DATETIME NULL DEFAULT NULL,
  ends_at DATETIME NULL DEFAULT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL DEFAULT NULL,
  created_by INT(11) NULL DEFAULT NULL,
  updated_at DATETIME NULL DEFAULT NULL,
  updated_by INT(11) NULL DEFAULT NULL,
  deleted_at DATETIME NULL DEFAULT NULL,
  deleted_by INT(11) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promotions_code (code),
  KEY idx_promotions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- TRANSACTIONS: invoice_no / payment_ref / promotion ----------

ALTER TABLE transactions
  ADD COLUMN invoice_no VARCHAR(32) NULL DEFAULT NULL
    AFTER user_id,
  ADD COLUMN payment_ref VARCHAR(64) NULL DEFAULT NULL
    AFTER payment_method,
  ADD COLUMN promotion_id INT(11) NULL DEFAULT NULL
    AFTER discount;

ALTER TABLE transactions
  ADD UNIQUE KEY uq_transactions_invoice_no (invoice_no),
  ADD KEY idx_transactions_promotion (promotion_id),
  ADD CONSTRAINT fk_transactions_promotion
    FOREIGN KEY (promotion_id) REFERENCES promotions (id);

-- Backfill nomor invoice untuk transaksi lama.
-- Format: INV-YYYYMMDD-XXXX (XXXX dari id, unik by construction).
UPDATE transactions
SET invoice_no = CONCAT(
  'INV-',
  DATE_FORMAT(COALESCE(created_at, NOW()), '%Y%m%d'),
  '-',
  LPAD(id, 4, '0')
)
WHERE invoice_no IS NULL;
