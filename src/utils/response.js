/**
 * Mengirim response sukses dengan format yang konsisten.
 *
 * @param {import('express').Response} res
 * @param {object} [options]
 * @param {number} [options.statusCode=200]
 * @param {string} [options.message='Berhasil.']
 * @param {unknown} [options.data]
 * @param {object} [options.meta]
 */
function sendSuccess(res, options = {}) {
  const { statusCode = 200, message = 'Berhasil.', data, meta } = options;

  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;

  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };
