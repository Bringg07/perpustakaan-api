const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const { __setSupabaseForTest } = require('../src/config/supabase');
const { createFakeSupabase } = require('./helpers/fakeSupabase');

/** Format tanggal YYYY-MM-DD relatif terhadap hari ini. */
function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SEED = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    member_name: 'Budi Santoso',
    member_number: 'M001',
    book_title: 'Laskar Pelangi',
    book_code: 'BK-001',
    loan_date: dateOffset(-20),
    due_date: dateOffset(-6),
    return_date: null,
    status: 'Terlambat',
    notes: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    member_name: 'Siti Aminah',
    member_number: 'M002',
    book_title: 'Bumi Manusia',
    book_code: 'BK-002',
    loan_date: dateOffset(-10),
    due_date: dateOffset(4),
    return_date: null,
    status: 'Dipinjam',
    notes: null,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    member_name: 'Andi Wijaya',
    member_number: 'M003',
    book_title: 'Negeri 5 Menara',
    book_code: 'BK-003',
    loan_date: dateOffset(-30),
    due_date: dateOffset(-16),
    return_date: dateOffset(-17),
    status: 'Dikembalikan',
    notes: null,
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  },
];

beforeEach(() => {
  __setSupabaseForTest(createFakeSupabase(SEED));
});

/* -------------------------------------------------------------------------- */

test('GET /health -> 200 dan status ok', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.service, 'perpustakaan-api');
});

test('GET / (root) mengembalikan health check', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('GET /loans mengembalikan daftar + meta paginasi', async () => {
  const res = await request(app).get('/loans');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 3);
  assert.equal(res.body.meta.total, 3);
  assert.equal(res.body.meta.page, 1);
});

test('GET /api/loans (alias) juga berfungsi', async () => {
  const res = await request(app).get('/api/loans');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 3);
});

test('GET /loans?status=Terlambat hanya mengembalikan yang terlambat', async () => {
  const res = await request(app).get('/loans?status=Terlambat');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].member_name, 'Budi Santoso');
});

test('GET /loans?status=TidakValid -> 400', async () => {
  const res = await request(app).get('/loans?status=TidakValid');
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('GET /loans?search=bumi menemukan berdasarkan judul', async () => {
  const res = await request(app).get('/loans?search=bumi');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].book_title, 'Bumi Manusia');
});

test('GET /loans?limit=1&page=2 membagi hasil dengan benar', async () => {
  const res = await request(app).get('/loans?limit=1&page=2');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.meta.total_pages, 3);
});

test('GET /loans/:id mengembalikan satu data', async () => {
  const res = await request(app).get('/loans/22222222-2222-4222-8222-222222222222');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.member_name, 'Siti Aminah');
});

test('GET /loans/:id dengan UUID tidak valid -> 400', async () => {
  const res = await request(app).get('/loans/bukan-uuid');
  assert.equal(res.status, 400);
});

test('GET /loans/:id yang tidak ada -> 404', async () => {
  const res = await request(app).get('/loans/99999999-9999-4999-8999-999999999999');
  assert.equal(res.status, 404);
});

test('POST /loans membuat data baru dan menghitung status otomatis', async () => {
  const res = await request(app).post('/loans').send({
    member_name: 'Rina Marlina',
    member_number: 'M010',
    book_title: 'Pulang',
    book_code: 'BK-010',
    loan_date: dateOffset(-5),
    due_date: dateOffset(-1),
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'Terlambat'); // jatuh tempo kemarin
  assert.ok(res.body.data.id);
});

test('POST /loans dengan body tidak lengkap -> 422 dan detail field', async () => {
  const res = await request(app).post('/loans').send({ member_name: 'Tanpa Judul' });
  assert.equal(res.status, 422);
  assert.equal(res.body.success, false);
  assert.ok(res.body.details.book_title);
  assert.ok(res.body.details.member_number);
});

test('POST /loans dengan due_date lebih awal dari loan_date -> 422', async () => {
  const res = await request(app).post('/loans').send({
    member_name: 'Test',
    member_number: 'M011',
    book_title: 'Test',
    book_code: 'BK-011',
    loan_date: dateOffset(0),
    due_date: dateOffset(-3),
  });
  assert.equal(res.status, 422);
  assert.ok(res.body.details.due_date);
});

test('PUT /loans/:id memperbarui data dan menghitung ulang status', async () => {
  const res = await request(app)
    .put('/loans/22222222-2222-4222-8222-222222222222')
    .send({ return_date: dateOffset(0) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'Dikembalikan');
  assert.equal(res.body.data.return_date, dateOffset(0));
  assert.equal(res.body.data.book_title, 'Bumi Manusia'); // field lain tetap
});

test('DELETE /loans/:id menghapus data', async () => {
  const res = await request(app).delete('/loans/33333333-3333-4333-8333-333333333333');
  assert.equal(res.status, 200);

  const check = await request(app).get('/loans/33333333-3333-4333-8333-333333333333');
  assert.equal(check.status, 404);
});

test('POST /loans/sync-overdue menandai peminjaman terlambat', async () => {
  const res = await request(app).post('/loans/sync-overdue');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.data.updated_count, 'number');
});

test('Endpoint tidak dikenal -> 404', async () => {
  const res = await request(app).get('/tidak-ada-endpoint');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
