const LOAN_STATUSES = ['Dipinjam', 'Dikembalikan', 'Terlambat'];

/** Tanggal hari ini dalam format YYYY-MM-DD (timezone lokal server). */
function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Memeriksa apakah string merupakan tanggal valid dengan format YYYY-MM-DD.
 * @param {unknown} value
 * @returns {boolean}
 */
function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // Pastikan tidak "roll over" (mis. 2024-02-31 menjadi 2024-03-02).
  return date.toISOString().slice(0, 10) === value;
}

/**
 * Menentukan status peminjaman berdasarkan tanggal.
 *  - Sudah ada return_date      -> "Dikembalikan"
 *  - Belum kembali & lewat tempo -> "Terlambat"
 *  - Selain itu                  -> "Dipinjam"
 *
 * @param {string} dueDate format YYYY-MM-DD
 * @param {string|null} returnDate format YYYY-MM-DD atau null
 * @param {string} [today] format YYYY-MM-DD
 * @returns {'Dipinjam'|'Dikembalikan'|'Terlambat'}
 */
function deriveStatus(dueDate, returnDate, today = todayISO()) {
  if (returnDate) return 'Dikembalikan';
  if (dueDate && dueDate < today) return 'Terlambat';
  return 'Dipinjam';
}

/**
 * Membentuk URL absolut (dipakai untuk info deployment).
 * @param {import('express').Request} req
 */
function buildBaseUrl(req) {
  const prot = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${prot}://${host}`;
}

module.exports = {
  LOAN_STATUSES,
  todayISO,
  isDateString,
  deriveStatus,
  buildBaseUrl,
};
