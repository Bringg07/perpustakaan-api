const { getSupabase } = require('../config/supabase');
const { sendSuccess } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const { buildLoanPayload } = require('../validators/loanValidator');
const { LOAN_STATUSES, todayISO, isDateString } = require('../utils/dates');

const TABLE = 'loans';
const SELECT_COLUMNS =
  'id, member_name, member_number, book_title, book_code, loan_date, due_date, return_date, status, notes, created_at, updated_at';

const SORTABLE_COLUMNS = [
  'created_at',
  'updated_at',
  'loan_date',
  'due_date',
  'return_date',
  'member_name',
  'book_title',
  'status',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/*  Helper                                                                    */
/* -------------------------------------------------------------------------- */

/** Ambil nilai query sebagai string tunggal (query bisa berupa array). */
function asString(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Ubah query menjadi integer positif dengan default. */
function toPositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const num = Number.parseInt(asString(value), 10);
  if (Number.isNaN(num) || num < 1) return fallback;
  return Math.min(num, max);
}

/** Bersihkan karakter khusus agar aman dipakai pada filter `or` PostgREST. */
function sanitizeSearch(value) {
  return String(value).replace(/[%_,()*\\]/g, ' ').trim();
}

/**
 * Tandai otomatis peminjaman yang melewati jatuh tempo sebagai "Terlambat".
 * Bersifat best-effort: kegagalan tidak boleh menggagalkan request utama.
 */
async function syncOverdueStatus(supabase) {
  if (process.env.AUTO_SYNC_OVERDUE === 'false') return;
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'Terlambat', updated_at: new Date().toISOString() })
      .is('return_date', null)
      .lt('due_date', todayISO())
      .neq('status', 'Terlambat');

    if (error) throw error;
  } catch (err) {
    console.warn('[syncOverdueStatus] dilewati:', err.message);
  }
}

/** Pastikan `id` berformat UUID, jika tidak langsung 400. */
function ensureValidId(id) {
  if (!UUID_REGEX.test(id)) {
    throw ApiError.badRequest('Parameter id harus berupa UUID yang valid.');
  }
}

/** Fetch satu baris berdasarkan id, melempar 404 bila tidak ada. */
async function findLoanById(supabase, id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw ApiError.internal('Gagal mengambil data peminjaman.', error.message);
  if (!data) throw ApiError.notFound(`Data peminjaman dengan id ${id} tidak ditemukan.`);
  return data;
}

/* -------------------------------------------------------------------------- */
/*  Handlers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /loans
 * Menampilkan daftar peminjaman dengan filter, pencarian, urutan, dan paginasi.
 */
async function listLoans(req, res, next) {
  try {
    const supabase = getSupabase();
    await syncOverdueStatus(supabase);

    const page = toPositiveInt(req.query.page, 1);
    const limit = toPositiveInt(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;

    let query = supabase.from(TABLE).select(SELECT_COLUMNS, { count: 'exact' });

    // ---------- Filter ----------
    const status = asString(req.query.status);
    if (status) {
      if (!LOAN_STATUSES.includes(status)) {
        throw ApiError.badRequest(
          `Filter status tidak valid. Pilihan: ${LOAN_STATUSES.join(', ')}.`,
          { status: `Harus salah satu dari: ${LOAN_STATUSES.join(', ')}.` }
        );
      }
      query = query.eq('status', status);
    }

    const memberName = asString(req.query.member_name);
    if (memberName) query = query.ilike('member_name', `%${memberName}%`);

    const memberNumber = asString(req.query.member_number);
    if (memberNumber) query = query.ilike('member_number', `%${memberNumber}%`);

    const bookTitle = asString(req.query.book_title);
    if (bookTitle) query = query.ilike('book_title', `%${bookTitle}%`);

    const bookCode = asString(req.query.book_code);
    if (bookCode) query = query.ilike('book_code', `%${bookCode}%`);

    // Pencarian bebas pada nama anggota / nomor anggota / judul buku.
    const search = asString(req.query.search);
    if (search && sanitizeSearch(search)) {
      const term = sanitizeSearch(search);
      query = query.or(
        `member_name.ilike.%${term}%,member_number.ilike.%${term}%,book_title.ilike.%${term}%`
      );
    }

    // Rentang tanggal pinjam.
    const loanDateFrom = asString(req.query.loan_date_from);
    if (loanDateFrom) {
      if (!isDateString(loanDateFrom)) throw ApiError.badRequest('loan_date_from harus format YYYY-MM-DD.');
      query = query.gte('loan_date', loanDateFrom);
    }

    const loanDateTo = asString(req.query.loan_date_to);
    if (loanDateTo) {
      if (!isDateString(loanDateTo)) throw ApiError.badRequest('loan_date_to harus format YYYY-MM-DD.');
      query = query.lte('loan_date', loanDateTo);
    }

    // ---------- Urutan & paginasi ----------
    const sort = SORTABLE_COLUMNS.includes(asString(req.query.sort))
      ? asString(req.query.sort)
      : 'created_at';
    const ascending = asString(req.query.order) === 'asc';

    const { data, error, count } = await query
      .order(sort, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal('Gagal mengambil daftar peminjaman.', error.message);

    const total = count ?? data.length;

    return sendSuccess(res, {
      message: 'Daftar peminjaman berhasil diambil.',
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
        filters: {
          status: status || null,
          member_name: memberName || null,
          member_number: memberNumber || null,
          book_title: bookTitle || null,
          book_code: bookCode || null,
          search: search || null,
          loan_date_from: loanDateFrom || null,
          loan_date_to: loanDateTo || null,
          sort,
          order: ascending ? 'asc' : 'desc',
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /loans/:id
 */
async function getLoan(req, res, next) {
  try {
    const supabase = getSupabase();
    ensureValidId(req.params.id);

    const loan = await findLoanById(supabase, req.params.id);
    return sendSuccess(res, { message: 'Detail peminjaman berhasil diambil.', data: loan });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /loans
 */
async function createLoan(req, res, next) {
  try {
    const supabase = getSupabase();
    const payload = buildLoanPayload(req.body);

    const { data, error } = await supabase.from(TABLE).insert(payload).select(SELECT_COLUMNS).single();

    if (error) throw ApiError.internal('Gagal menyimpan data peminjaman.', error.message);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Data peminjaman berhasil dibuat.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /loans/:id  dan  PATCH /loans/:id
 * Field yang tidak dikirim akan memakai nilai lama.
 */
async function updateLoan(req, res, next) {
  try {
    const supabase = getSupabase();
    ensureValidId(req.params.id);

    const existing = await findLoanById(supabase, req.params.id);
    const payload = buildLoanPayload(req.body, existing);

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', req.params.id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw ApiError.internal('Gagal memperbarui data peminjaman.', error.message);

    return sendSuccess(res, { message: 'Data peminjaman berhasil diperbarui.', data });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /loans/:id
 */
async function deleteLoan(req, res, next) {
  try {
    const supabase = getSupabase();
    ensureValidId(req.params.id);

    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', req.params.id)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) throw ApiError.internal('Gagal menghapus data peminjaman.', error.message);
    if (!data) throw ApiError.notFound(`Data peminjaman dengan id ${req.params.id} tidak ditemukan.`);

    return sendSuccess(res, {
      message: 'Data peminjaman berhasil dihapus.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /loans/sync-overdue
 * Menandai seluruh peminjaman yang terlambat sebagai status "Terlambat".
 */
async function syncOverdue(req, res, next) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'Terlambat', updated_at: new Date().toISOString() })
      .is('return_date', null)
      .lt('due_date', todayISO())
      .neq('status', 'Terlambat')
      .select('id');

    if (error) throw ApiError.internal('Gagal menyinkronkan status keterlambatan.', error.message);

    return sendSuccess(res, {
      message: `${data.length} peminjaman ditandai sebagai Terlambat.`,
      data: { updated_count: data.length, updated_ids: data.map((row) => row.id) },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listLoans,
  getLoan,
  createLoan,
  updateLoan,
  deleteLoan,
  syncOverdue,
};
