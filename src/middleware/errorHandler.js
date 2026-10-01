const ApiError = require('../utils/ApiError');

/**
 * Handler untuk endpoint yang tidak terdaftar.
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
}

/**
 * Handler error terpusat. Selalu mengembalikan JSON dengan format konsisten.
 * Signature 4 argumen wajib agar Express mengenalinya sebagai error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Error dari body JSON yang tidak valid (express.json).
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Body request bukan JSON yang valid.',
    });
  }

  if (err instanceof ApiError || err.isApiError) {
    const body = { success: false, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Error konfigurasi Supabase yang belum lengkap — beri pesan yang jelas.
  if (err instanceof Error && /Konfigurasi Supabase belum lengkap/.test(err.message)) {
    return res.status(500).json({ success: false, message: err.message });
  }

  console.error('[UnhandledError]', err);
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server.',
  });
}

module.exports = { notFoundHandler, errorHandler };
