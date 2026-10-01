# 📚 Perpustakaan API — REST API Pencatatan Peminjaman Buku

REST API sederhana untuk layanan **pencatatan peminjaman buku perpustakaan**. Dibuat dengan
**Node.js + Express.js** dan menggunakan **Supabase (PostgreSQL)** sebagai basis data, serta
siap di-*deploy* ke **Vercel**.

> **Link Deployment (Vercel):**
> `https://perpustakaan-api.vercel.app`
>
> ⚠️ Status 01-10-2026: URL di atas **belum live** (`DEPLOYMENT_NOT_FOUND` saat dicek
> `/health`). Lakukan deploy ulang sesuai **Bagian 7**, lalu URL ini akan aktif.
>
> **Link Repository GitHub:**
> `https://github.com/Bringg07/perpustakaan-api`

---

## 1. Deskripsi Umum & Tujuan Proyek

### Deskripsi
**Perpustakaan API** adalah layanan *backend* yang menyediakan operasi **CRUD** (Create, Read,
Update, Delete) untuk data peminjaman buku oleh anggota perpustakaan. Setiap data peminjaman
mencatat identitas anggota, buku yang dipinjam, tanggal pinjam, tanggal jatuh tempo, tanggal
pengembalian, serta status peminjaman.

Status peminjaman dihitung **secara otomatis** dari tanggal, sehingga tidak pernah basi:

| Kondisi | Status |
| --- | --- |
| `return_date` sudah terisi | `Dikembalikan` |
| `return_date` kosong & `due_date` sudah lewat | `Terlambat` |
| `return_date` kosong & `due_date` belum lewat | `Dipinjam` |

### Tujuan
1. Menyediakan API CRUD data peminjaman buku yang bersih, konsisten, dan mudah diuji.
2. Menyediakan **fitur filter query** untuk memudahkan pencarian dan pelaporan
   (contoh: `GET /loans?status=Terlambat`).
3. Menjadi contoh penerapan arsitektur **Express.js berlapis** (routes → controller → validator
   → database) yang siap dijalankan secara serverless di Vercel.

### Fitur Utama
- ✅ CRUD lengkap data peminjaman buku.
- ✅ Filter & pencarian: `status`, `member_name`, `member_number`, `book_title`, `book_code`,
  `search`, dan rentang `loan_date`.
- ✅ Paginasi (`page`, `limit`) + meta hasil.
- ✅ Pengurutan (`sort`, `order`).
- ✅ Validasi input dengan pesan error per-field (HTTP `422`).
- ✅ Penanganan error terpusat dengan format response konsisten.
- ✅ Sinkronisasi otomatis status `Terlambat`.
- ✅ CORS aktif, health check, dan kompatibel dengan Vercel serverless.

---

## 2. Teknologi yang Digunakan

| Teknologi | Kegunaan |
| --- | --- |
| [Node.js](https://nodejs.org) (≥ 20) | Runtime JavaScript |
| [Express.js](https://expressjs.com) 4 | Framework web/HTTP |
| [Supabase](https://supabase.com) | Basis data PostgreSQL terkelola |
| [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) | Klien resmi Supabase |
| [Vercel](https://vercel.com) | Hosting & deployment serverless |
| `node:test` + `supertest` | Pengujian endpoint |

---

## 3. Struktur Proyek

```
perpustakaan-api/
├── api/
│   └── index.js                 # Entry point Vercel Serverless Function
├── database/
│   └── schema.sql               # Skema tabel, index, trigger, seed data
├── src/
│   ├── app.js                   # Konfigurasi aplikasi Express
│   ├── server.js                # Menjalankan server untuk lokal
│   ├── config/
│   │   └── supabase.js          # Klien Supabase (singleton)
│   ├── controllers/
│   │   ├── healthController.js  # Health check
│   │   └── loanController.js    # Logika CRUD & filter peminjaman
│   ├── middleware/
│   │   └── errorHandler.js      # Handler 404 & error terpusat
│   ├── routes/
│   │   ├── index.js             # Router utama
│   │   └── loanRoutes.js        # Rute /loans
│   ├── utils/
│   │   ├── ApiError.js          # Kelas error kustom
│   │   ├── dates.js             # Helper tanggal & status
│   │   └── response.js          # Helper response sukses
│   └── validators/
│       └── loanValidator.js     # Validasi payload peminjaman
├── postman/
│   └── perpustakaan-api.postman_collection.json  # Koleksi uji Postman
├── tests/
│   ├── api.test.js              # Pengujian endpoint
│   └── helpers/fakeSupabase.js  # Fake Supabase untuk test
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## 4. Struktur Data / Schema

Tabel tunggal **`loans`** menyimpan seluruh data peminjaman.

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | `uuid` | Primary key, dibuat otomatis (`gen_random_uuid()`) |
| `member_name` | `varchar(120)` | Nama anggota *(wajib)* |
| `member_number` | `varchar(30)` | Nomor identitas anggota *(wajib)* |
| `book_title` | `varchar(200)` | Judul buku *(wajib)* |
| `book_code` | `varchar(30)` | Kode buku *(wajib)* |
| `loan_date` | `date` | Tanggal pinjam *(default: hari ini)* |
| `due_date` | `date` | Tanggal jatuh tempo *(wajib)* |
| `return_date` | `date` | Tanggal kembali (`null` = belum kembali) |
| `status` | `varchar(20)` | `Dipinjam` \| `Dikembalikan` \| `Terlambat` |
| `notes` | `text` | Catatan tambahan (opsional) |
| `created_at` | `timestamptz` | Waktu data dibuat |
| `updated_at` | `timestamptz` | Waktu data terakhir diubah (otomatis via trigger) |

**Constraint penting:**
- `due_date >= loan_date`
- `return_date >= loan_date` (bila diisi)
- `status` hanya boleh salah satu dari tiga nilai di atas.

### Bentuk objek JSON

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "member_name": "Budi Santoso",
  "member_number": "M001",
  "book_title": "Laskar Pelangi",
  "book_code": "BK-001",
  "loan_date": "2026-09-11",
  "due_date": "2026-09-25",
  "return_date": null,
  "status": "Terlambat",
  "notes": "Belum dikembalikan",
  "created_at": "2026-09-11T02:10:00.000Z",
  "updated_at": "2026-09-26T08:00:00.000Z"
}
```

### Membuat tabel di Supabase
Salin isi **`database/schema.sql`** ke Supabase Dashboard → **SQL Editor** → **Run**.
Skrip tersebut membuat tabel, index, trigger `updated_at`, fungsi `mark_overdue_loans()`,
kebijakan RLS, dan **7 baris data contoh**.

---

## 5. Dokumentasi Endpoint

**Base URL lokal:** `http://localhost:3000`
**Base URL produksi:** `https://perpustakaan-api.vercel.app`

> Seluruh endpoint tersedia di **root** (`/loans`) **dan** dengan prefiks **`/api`**
> (`/api/loans`). Gunakan salah satu; keduanya memberikan hasil yang sama.

### Ringkasan

| Method | Endpoint | Deskripsi |
| --- | --- | --- |
| `GET` | `/` atau `/health` | Health check API |
| `GET` | `/loans` | Ambil semua peminjaman (filter, cari, paginasi) |
| `GET` | `/loans/:id` | Ambil detail satu peminjaman |
| `POST` | `/loans` | Buat data peminjaman baru |
| `PUT` / `PATCH` | `/loans/:id` | Perbarui data peminjaman |
| `DELETE` | `/loans/:id` | Hapus data peminjaman |
| `POST` | `/loans/sync-overdue` | Tandai semua peminjaman terlambat menjadi `Terlambat` |

### Parameter Query untuk `GET /loans`

| Parameter | Contoh | Keterangan |
| --- | --- | --- |
| `status` | `Terlambat` | `Dipinjam` \| `Dikembalikan` \| `Terlambat` |
| `member_name` | `Budi` | Pencarian sebagian nama anggota |
| `member_number` | `M00` | Pencarian sebagian nomor anggota |
| `book_title` | `Bumi` | Pencarian sebagian judul buku |
| `book_code` | `BK-0` | Pencarian sebagian kode buku |
| `search` | `bumi` | Cari di nama anggota, nomor anggota, dan judul buku |
| `loan_date_from` | `2026-01-01` | Batas awal tanggal pinjam |
| `loan_date_to` | `2026-12-31` | Batas akhir tanggal pinjam |
| `sort` | `due_date` | Kolom urutan (default `created_at`) |
| `order` | `asc` | `asc` \| `desc` (default `desc`) |
| `page` | `1` | Halaman (default `1`) |
| `limit` | `10` | Jumlah per halaman, maksimal `100` (default `10`) |

---

### 5.1 Health Check

**Request**
```http
GET /health
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "API Pencatatan Peminjaman Buku Perpustakaan berjalan dengan baik.",
  "data": {
    "service": "perpustakaan-api",
    "version": "1.0.0",
    "environment": "production",
    "timestamp": "2026-10-01T07:30:00.000Z"
  }
}
```

---

### 5.2 Ambil Semua Peminjaman

**Request**
```http
GET /loans?page=1&limit=10
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "Daftar peminjaman berhasil diambil.",
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "member_name": "Budi Santoso",
      "member_number": "M001",
      "book_title": "Laskar Pelangi",
      "book_code": "BK-001",
      "loan_date": "2026-09-11",
      "due_date": "2026-09-25",
      "return_date": null,
      "status": "Terlambat",
      "notes": "Belum dikembalikan",
      "created_at": "2026-09-11T02:10:00.000Z",
      "updated_at": "2026-09-26T08:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 7,
    "total_pages": 1,
    "filters": { "status": null, "sort": "created_at", "order": "desc" }
  }
}
```

---

### 5.3 Filter Berdasarkan Status

**Request**
```http
GET /loans?status=Terlambat
```

**Response `200 OK`** — hanya mengembalikan peminjaman berstatus `Terlambat` (struktur `meta`
sama seperti di atas, dengan `"filters": { "status": "Terlambat", ... }`).

---

### 5.4 Ambil Detail Peminjaman

**Request**
```http
GET /loans/11111111-1111-4111-8111-111111111111
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "Detail peminjaman berhasil diambil.",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "member_name": "Budi Santoso",
    "member_number": "M001",
    "book_title": "Laskar Pelangi",
    "book_code": "BK-001",
    "loan_date": "2026-09-11",
    "due_date": "2026-09-25",
    "return_date": null,
    "status": "Terlambat",
    "notes": "Belum dikembalikan",
    "created_at": "2026-09-11T02:10:00.000Z",
    "updated_at": "2026-09-26T08:00:00.000Z"
  }
}
```

**Response `404 Not Found`** (jika id tidak ada)
```json
{
  "success": false,
  "message": "Data peminjaman dengan id 99999999-9999-4999-8999-999999999999 tidak ditemukan."
}
```

---

### 5.5 Buat Peminjaman Baru

**Request**
```http
POST /loans
Content-Type: application/json

{
  "member_name": "Rina Marlina",
  "member_number": "M010",
  "book_title": "Pulang",
  "book_code": "BK-010",
  "loan_date": "2026-09-20",
  "due_date": "2026-10-04",
  "notes": "Peminjaman pertama"
}
```

> `status` **tidak perlu** dikirim — akan dihitung otomatis. Bila ingin menandai buku sudah
> dikembalikan, kirim `"status": "Dikembalikan"` (maka `return_date` diisi otomatis dengan
> tanggal hari ini) atau kirim `return_date` secara langsung.

**Response `201 Created`**
```json
{
  "success": true,
  "message": "Data peminjaman berhasil dibuat.",
  "data": {
    "id": "4f1c9d2a-2b3e-4c5d-8e9f-0a1b2c3d4e5f",
    "member_name": "Rina Marlina",
    "member_number": "M010",
    "book_title": "Pulang",
    "book_code": "BK-010",
    "loan_date": "2026-09-20",
    "due_date": "2026-10-04",
    "return_date": null,
    "status": "Dipinjam",
    "notes": "Peminjaman pertama",
    "created_at": "2026-10-01T07:35:00.000Z",
    "updated_at": "2026-10-01T07:35:00.000Z"
  }
}
```

**Response `422 Unprocessable Entity`** (validasi gagal)
```json
{
  "success": false,
  "message": "Validasi data gagal.",
  "details": {
    "member_number": "member_number wajib diisi.",
    "due_date": "due_date wajib diisi dengan format YYYY-MM-DD."
  }
}
```

---

### 5.6 Perbarui Peminjaman

Field yang tidak dikirim akan memakai nilai lama (perilaku `PATCH`; `PUT` juga menerima
payload parsial).

**Request** — mengembalikan buku
```http
PATCH /loans/4f1c9d2a-2b3e-4c5d-8e9f-0a1b2c3d4e5f
Content-Type: application/json

{
  "return_date": "2026-10-02"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "Data peminjaman berhasil diperbarui.",
  "data": {
    "id": "4f1c9d2a-2b3e-4c5d-8e9f-0a1b2c3d4e5f",
    "member_name": "Rina Marlina",
    "member_number": "M010",
    "book_title": "Pulang",
    "book_code": "BK-010",
    "loan_date": "2026-09-20",
    "due_date": "2026-10-04",
    "return_date": "2026-10-02",
    "status": "Dikembalikan",
    "notes": "Peminjaman pertama",
    "created_at": "2026-10-01T07:35:00.000Z",
    "updated_at": "2026-10-02T09:00:00.000Z"
  }
}
```

---

### 5.7 Hapus Peminjaman

**Request**
```http
DELETE /loans/4f1c9d2a-2b3e-4c5d-8e9f-0a1b2c3d4e5f
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "Data peminjaman berhasil dihapus.",
  "data": { "id": "4f1c9d2a-2b3e-4c5d-8e9f-0a1b2c3d4e5f", "member_name": "Rina Marlina" }
}
```

---

### 5.8 Sinkronisasi Status Terlambat

**Request**
```http
POST /loans/sync-overdue
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "3 peminjaman ditandai sebagai Terlambat.",
  "data": {
    "updated_count": 3,
    "updated_ids": [
      "11111111-1111-4111-8111-111111111111",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ]
  }
}
```

> Catatan: status `Terlambat` juga diperbarui otomatis setiap `GET /loans` dipanggil
> (dapat dimatikan dengan `AUTO_SYNC_OVERDUE=false`).

---

## 6. Panduan Instalasi & Menjalankan Secara Lokal

### Prasyarat
- **Node.js ≥ 20** dan **npm** ([unduh](https://nodejs.org))
- Akun & proyek **Supabase** ([daftar gratis](https://supabase.com))
- Git (opsional, untuk clone repository)

### Langkah-langkah

**1) Clone repository**
```bash
git clone https://github.com/Bringg07/perpustakaan-api.git
cd perpustakaan-api
```

**2) Instal dependensi**
```bash
npm install
```

**3) Siapkan database Supabase**
1. Buat proyek baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka **SQL Editor** → **New query**.
3. Tempel isi file `database/schema.sql`, lalu klik **Run**.
   Ini akan membuat tabel `loans`, index, trigger, dan data contoh.

**4) Ambil kredensial Supabase**
Buka **Project Settings → API**, lalu salin:
- **Project URL** → `SUPABASE_URL`
- **anon public** key → `SUPABASE_ANON_KEY`
- *(opsional)* **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

**5) Buat file `.env`**
```bash
cp .env.example .env
```
Isi file `.env`:
```env
SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
NODE_ENV=development
AUTO_SYNC_OVERDUE=true
```

**6) Jalankan server**
```bash
npm run dev      # dengan auto-reload (nodemon)
# atau
npm start        # tanpa auto-reload
```
Server berjalan di **http://localhost:3000**.

**7) Uji cepat**
```bash
# Health check
curl http://localhost:3000/health

# Daftar peminjaman
curl http://localhost:3000/loans

# Filter status
curl "http://localhost:3000/loans?status=Terlambat"

# Buat data baru
curl -X POST http://localhost:3000/loans \
  -H "Content-Type: application/json" \
  -d '{
    "member_name":"Rina Marlina",
    "member_number":"M010",
    "book_title":"Pulang",
    "book_code":"BK-010",
    "loan_date":"2026-09-20",
    "due_date":"2026-10-04"
  }'
```

### Menjalankan Pengujian
```bash
npm test
```
Pengujian berjalan tanpa koneksi database (memakai fake Supabase in-memory).

### Menguji dengan Postman
Import file **`postman/perpustakaan-api.postman_collection.json`** ke Postman.
Koleksi ini berisi **11 request** siap pakai untuk seluruh endpoint.
Ubah variabel koleksi `baseUrl` sesuai target:
- Lokal  : `http://localhost:3000`
- Vercel : `https://perpustakaan-api.vercel.app`

Request **Buat Peminjaman** otomatis menyimpan `id` hasil response ke variabel
`loanId`, sehingga request Detail / Perbarui / Hapus bisa langsung dijalankan.

---

## 7. Deployment ke Vercel

### Cara 1 — Lewat Dashboard Vercel (disarankan)
1. Pastikan kode sudah di-*push* ke repository GitHub (lihat bagian 8).
2. Buka [vercel.com/new](https://vercel.com/new) dan **Import** repository
   `perpustakaan-api`.
3. Pada bagian **Environment Variables**, tambahkan:
   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Project URL Supabase |
   | `SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(opsional)* service role key |
   | `AUTO_SYNC_OVERDUE` | `true` |
4. Klik **Deploy**. Tunggu hingga selesai.
5. Vercel memberi URL produksi, mis. `https://perpustakaan-api.vercel.app`.

### Cara 2 — Lewat Vercel CLI
```bash
npm i -g vercel
vercel login
vercel                 # deploy preview (pertama kali akan membuat proyek)
vercel --prod          # deploy ke produksi
```

### Konfigurasi `vercel.json`
Seluruh request di-*rewrite* ke satu serverless function (`api/index.js`) yang menjalankan
aplikasi Express:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

### Verifikasi setelah deploy
```bash
curl https://perpustakaan-api.vercel.app/health
curl https://perpustakaan-api.vercel.app/loans?status=Terlambat
```

---

## 8. Push ke GitHub (Membuat Repository)

```bash
# dari dalam folder perpustakaan-api
git init
git add .
git commit -m "feat: REST API pencatatan peminjaman buku (Express + Supabase)"

# Buat repository kosong di github.com, lalu:
git branch -M main
git remote add origin https://github.com/Bringg07/perpustakaan-api.git
git push -u origin main
```

> **Catatan:** file `.env` **tidak** ikut ter-*commit* (sudah masuk `.gitignore`) sehingga
> kredensial tetap aman. Repository yang di-*push* berisi kode sumber + `README.md` +
> `database/schema.sql`.

---

## 9. Format Response

Semua response memakai format konsisten.

**Sukses**
```json
{ "success": true, "message": "...", "data": { }, "meta": { } }
```

**Gagal**
```json
{ "success": false, "message": "...", "details": { } }
```

| Status Code | Arti |
| --- | --- |
| `200 OK` | Permintaan berhasil |
| `201 Created` | Data berhasil dibuat |
| `400 Bad Request` | Parameter/format request tidak valid |
| `404 Not Found` | Data/endpoint tidak ditemukan |
| `422 Unprocessable Entity` | Validasi field gagal |
| `500 Internal Server Error` | Kesalahan pada server/database |

---

## 10. Daftar Perintah npm

| Perintah | Fungsi |
| --- | --- |
| `npm start` | Menjalankan server produksi lokal |
| `npm run dev` | Menjalankan server dengan auto-reload |
| `npm test` | Menjalankan seluruh pengujian |

---

## 11. Lisensi

Proyek ini dibuat untuk keperluan **Responsi** dan bebas digunakan untuk pembelajaran.
