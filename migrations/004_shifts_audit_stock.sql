-- =====================================================
-- Migration 004: POS upgrade — shifts, audit logs,
-- stock adjustments, shift link di transactions.
--
-- RULE:
-- - Aditif saja. Tidak mengubah/menghapus kolom existing.
-- - Tidak DROP TABLE, tidak recreate database.
-- - audit_logs append-only (tanpa kolom update/delete).
-- =====================================================

-- ---------- SHIFTS (baru) ----------

CREATE TABLE IF NOT EXISTS shifts (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  opened_at DATETIME NOT NULL,
  opening_cash DECIMAL(15,2) NOT NULL DEFAULT 0,
  closed_at DATETIME NULL DEFAULT NULL,
  closing_cash DECIMAL(15,2) NULL DEFAULT NULL,
  expected_cash DECIMAL(15,2) NULL DEFAULT NULL,
  diff DECIMAL(15,2) NULL DEFAULT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  notes VARCHAR(255) NULL DEFAULT NULL,
  created_at DATETIME NULL DEFAULT NULL,
  created_by INT(11) NULL DEFAULT NULL,
  updated_at DATETIME NULL DEFAULT NULL,
  updated_by INT(11) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_shifts_user_status (user_id, status),
  CONSTRAINT fk_shifts_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- AUDIT LOGS (baru, append-only) ----------

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NULL DEFAULT NULL,
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id INT(11) NULL DEFAULT NULL,
  meta JSON NULL DEFAULT NULL,
  ip VARCHAR(45) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- STOCK ADJUSTMENTS (baru) ----------

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT(11) NOT NULL AUTO_INCREMENT,
  product_id INT(11) NOT NULL,
  qty_change INT(11) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_by INT(11) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_adj_product (product_id),
  CONSTRAINT fk_stock_adj_product
    FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_stock_adj_user
    FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- TRANSACTIONS: shift link ----------

ALTER TABLE transactions
  ADD COLUMN shift_id INT(11) NULL DEFAULT NULL
    AFTER promotion_id;

ALTER TABLE transactions
  ADD KEY idx_transactions_shift (shift_id),
  ADD CONSTRAINT fk_transactions_shift
    FOREIGN KEY (shift_id) REFERENCES shifts (id);
