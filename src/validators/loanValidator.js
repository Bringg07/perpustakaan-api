const ApiError = require('../utils/ApiError');
const { LOAN_STATUSES, isDateString, todayISO, deriveStatus } = require('../utils/dates');

const LIMITS = {
  member_name: 120,
  member_number: 30,
  book_title: 200,
  book_code: 30,
  notes: 1000,
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Mengubah payload request menjadi baris database yang tervalidasi.
 *
 * Aturan penting:
 *  - Field yang tidak dikirim client akan diisi dari `existing` (mode update).
 *  - `status` **selalu** dihitung ulang dari tanggal supaya tidak pernah basi.
 *  - Mengirim `status: "Dikembalikan"` tanpa `return_date` akan mengisi
 *    `return_date` dengan tanggal hari ini.
 *
 * @param {object} body body request
 * @param {object|null} [existing] baris lama dari database (mode update)
 * @returns {object} payload siap kirim ke Supabase
 */
function buildLoanPayload(body, existing = null) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Body request harus berupa objek JSON.');
  }

  const errors = {};
  const valueOf = (key) => (hasOwn(body, key) ? body[key] : existing ? existing[key] : undefined);

  const payload = {};

  // ---------- Field teks wajib ----------
  for (const [key, max] of Object.entries(LIMITS)) {
    if (key === 'notes') continue; // notes opsional, ditangani terpisah
    const raw = valueOf(key);
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      errors[key] = `${key} wajib diisi.`;
    } else if (String(raw).trim().length > max) {
      errors[key] = `${key} maksimal ${max} karakter.`;
    } else {
      payload[key] = String(raw).trim();
    }
  }

  // ---------- Tanggal ----------
  const loanDate = normalizeDate(valueOf('loan_date'), 'loan_date', errors, todayISO());
  const dueDate = normalizeDate(valueOf('due_date'), 'due_date', errors);

  const rawReturn = valueOf('return_date');
  let returnDate = normalizeOptionalDate(rawReturn, 'return_date', errors);

  const explicitStatus = hasOwn(body, 'status') ? body.status : undefined;
  if (explicitStatus !== undefined && !LOAN_STATUSES.includes(explicitStatus)) {
    errors.status = `status harus salah satu dari: ${LOAN_STATUSES.join(', ')}.`;
  }

  // Mengirim status "Dikembalikan" tanpa tanggal kembali -> isi otomatis hari ini.
  if (!returnDate && explicitStatus === 'Dikembalikan' && errors.status === undefined) {
    returnDate = todayISO();
  }

  // ---------- Konsistensi antar-tanggal ----------
  if (loanDate && dueDate && dueDate < loanDate) {
    errors.due_date = 'due_date tidak boleh lebih awal dari loan_date.';
  }
  if (loanDate && returnDate && returnDate < loanDate) {
    errors.return_date = 'return_date tidak boleh lebih awal dari loan_date.';
  }

  // ---------- Notes (opsional) ----------
  const rawNotes = valueOf('notes');
  let notes = null;
  if (rawNotes !== undefined && rawNotes !== null) {
    if (typeof rawNotes !== 'string') {
      errors.notes = 'notes harus berupa teks.';
    } else if (rawNotes.length > LIMITS.notes) {
      errors.notes = `notes maksimal ${LIMITS.notes} karakter.`;
    } else {
      notes = rawNotes.trim() === '' ? null : rawNotes.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    throw ApiError.validation(errors);
  }

  return {
    member_name: payload.member_name,
    member_number: payload.member_number,
    book_title: payload.book_title,
    book_code: payload.book_code,
    loan_date: loanDate,
    due_date: dueDate,
    return_date: returnDate,
    status: deriveStatus(dueDate, returnDate),
    notes,
  };
}

/**
 * Validasi tanggal wajib (YYYY-MM-DD).
 * @returns {string|undefined}
 */
function normalizeDate(raw, field, errors, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    if (fallback) return fallback;
    errors[field] = `${field} wajib diisi dengan format YYYY-MM-DD.`;
    return undefined;
  }
  if (!isDateString(raw)) {
    errors[field] = `${field} harus berupa tanggal valid dengan format YYYY-MM-DD.`;
    return undefined;
  }
  return raw;
}

/**
 * Validasi tanggal opsional. Kosong -> null.
 * @returns {string|null}
 */
function normalizeOptionalDate(raw, field, errors) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!isDateString(raw)) {
    errors[field] = `${field} harus berupa tanggal valid dengan format YYYY-MM-DD.`;
    return null;
  }
  return raw;
}

module.exports = { buildLoanPayload, LIMITS };
