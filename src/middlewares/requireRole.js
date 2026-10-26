"use strict";

// =====================================================
// requireRole — otorisasi berbasis role JWT POS.
// Dipakai SETELAH authMiddleware (req.user wajib ada).
//
// Contoh: router.get("/", authMiddleware,
//   requireRole("admin"), getUsers);
//
// TIDAK MENGUBAH: authMiddleware, format JWT, login,
// Google login, OTP, forgot/reset password.
// =====================================================

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role =
      req.user && req.user.role
        ? req.user.role
        : null;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        message: "Akses ditolak"
      });
    }

    next();
  };
};

module.exports = requireRole;
