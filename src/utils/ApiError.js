/**
 * Error khusus API dengan HTTP status code dan detail opsional.
 * Dilempar dari controller/validator lalu ditangkap oleh error handler.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Pesan error yang aman ditampilkan ke client
   * @param {unknown} [details] Detail tambahan (mis. daftar field yang gagal divalidasi)
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isApiError = true;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static validation(details, message = 'Validasi data gagal.') {
    return new ApiError(422, message, details);
  }

  static notFound(message = 'Data tidak ditemukan.') {
    return new ApiError(404, message);
  }

  static internal(message = 'Terjadi kesalahan pada server.', details) {
    return new ApiError(500, message, details);
  }
}

module.exports = ApiError;
