-- ============================================================================
--  Skema Database: Layanan Pencatatan Peminjaman Buku Perpustakaan
--  Database : Supabase (PostgreSQL)
--
--  CARA PAKAI:
--    1. Buka Supabase Dashboard > SQL Editor > New query.
--    2. Tempel seluruh isi file ini, lalu klik "Run".
--    3. Skema, kebijakan akses, dan data contoh akan otomatis dibuat.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ekstensi
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Tabel utama: loans (data peminjaman buku oleh anggota)
-- ---------------------------------------------------------------------------
drop table if exists public.loans cascade;

create table public.loans (
  id            uuid          primary key default gen_random_uuid(),
  member_name   varchar(120)  not null,                 -- nama anggota
  member_number varchar(30)   not null,                 -- nomor identitas anggota
  book_title    varchar(200)  not null,                 -- judul buku
  book_code     varchar(30)   not null,                 -- kode buku
  loan_date     date          not null default current_date, -- tanggal pinjam
  due_date      date          not null,                 -- tanggal jatuh tempo
  return_date   date,                                   -- tanggal kembali (null = belum kembali)
  status        varchar(20)   not null default 'Dipinjam'
                check (status in ('Dipinjam', 'Dikembalikan', 'Terlambat')),
  notes         text,                                   -- catatan tambahan
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),

  -- Jatuh tempo tidak boleh lebih awal dari tanggal pinjam.
  constraint chk_loans_due_after_loan check (due_date >= loan_date),
  -- Tanggal kembali tidak boleh lebih awal dari tanggal pinjam.
  constraint chk_loans_return_after_loan check (return_date is null or return_date >= loan_date)
);

comment on table  public.loans              is 'Data peminjaman buku oleh anggota perpustakaan.';
comment on column public.loans.status       is 'Dipinjam | Dikembalikan | Terlambat (dihitung otomatis dari tanggal).';
comment on column public.loans.return_date  is 'NULL berarti buku belum dikembalikan.';

-- ---------------------------------------------------------------------------
-- 2. Index untuk mempercepat filter yang sering dipakai
-- ---------------------------------------------------------------------------
create index idx_loans_status        on public.loans (status);
create index idx_loans_member_name   on public.loans (member_name);
create index idx_loans_member_number on public.loans (member_number);
create index idx_loans_book_title    on public.loans (book_title);
create index idx_loans_due_date      on public.loans (due_date);
create index idx_loans_loan_date     on public.loans (loan_date);

-- ---------------------------------------------------------------------------
-- 3. Trigger: perbarui kolom updated_at secara otomatis
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_loans_set_updated_at on public.loans;
create trigger trg_loans_set_updated_at
  before update on public.loans
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Fungsi: tandai peminjaman yang melewati jatuh tempo sebagai "Terlambat"
--    Bisa dipanggil manual: select public.mark_overdue_loans();
--    Bisa juga dijadwalkan dengan pg_cron bila diinginkan.
-- ---------------------------------------------------------------------------
create or replace function public.mark_overdue_loans()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.loans
     set status = 'Terlambat'
   where return_date is null
     and due_date < current_date
     and status <> 'Terlambat';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--    Policy di bawah memberi akses penuh (cukup untuk tugas/responsi).
--    Untuk produksi, ganti dengan policy yang lebih ketat (mis. berbasis JWT).
-- ---------------------------------------------------------------------------
alter table public.loans enable row level security;

drop policy if exists "loans_full_access" on public.loans;
create policy "loans_full_access"
  on public.loans
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 6. Data contoh (seed)
--    Tanggal dibuat relatif terhadap hari ini supaya filter status
--    "Terlambat" langsung menampilkan hasil saat diuji.
-- ---------------------------------------------------------------------------
insert into public.loans
  (member_name, member_number, book_title, book_code, loan_date, due_date, return_date, status, notes)
values
  ('Budi Santoso',  'M001', 'Laskar Pelangi',       'BK-001', current_date - 20, current_date - 6,  null,               'Terlambat',   'Belum dikembalikan, melewati jatuh tempo'),
  ('Siti Aminah',   'M002', 'Bumi Manusia',         'BK-002', current_date - 10, current_date + 4,  null,               'Dipinjam',    null),
  ('Andi Wijaya',   'M003', 'Negeri 5 Menara',      'BK-003', current_date - 30, current_date - 16, current_date - 17,  'Dikembalikan','Dikembalikan tepat waktu'),
  ('Dewi Lestari',  'M004', 'Pulang',               'BK-004', current_date - 15, current_date - 1,  null,               'Terlambat',   null),
  ('Rizky Pratama', 'M005', 'Perahu Kertas',        'BK-005', current_date - 3,  current_date + 11, null,               'Dipinjam',    null),
  ('Nadia Safira',  'M006', 'Cantik Itu Luka',      'BK-006', current_date - 25, current_date - 11, null,               'Terlambat',   'Menunggu konfirmasi anggota'),
  ('Fajar Nugroho', 'M007', 'Ronggeng Dukuh Paruk', 'BK-007', current_date - 40, current_date - 26, current_date - 28,  'Dikembalikan', null);

-- ---------------------------------------------------------------------------
-- 7. Verifikasi
-- ---------------------------------------------------------------------------
-- select * from public.loans order by created_at desc;
-- select * from public.loans where status = 'Terlambat';
-- select public.mark_overdue_loans() as jumlah_ditandai;
