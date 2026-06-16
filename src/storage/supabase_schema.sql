-- =========================================================================
-- MAMAM KASIR — Supabase schema untuk realtime sync (tanpa auth)
-- Jalankan di Supabase SQL Editor.
-- =========================================================================
-- Catatan keamanan:
-- RLS di bawah mengizinkan akses penuh (read/write) ke anon key.
-- Aman dipakai karena akses ke aplikasi sudah dijaga PIN modal di app,
-- dan anon key TIDAK pernah expose service role / akses admin Supabase.
--
-- Kolom `updated_by` menyimpan device_id pengirim perubahan, dipakai oleh
-- storage/realtimeSync.js untuk "echo suppression" — device yang mengirim
-- perubahan tidak akan memproses ulang event realtime dari perubahannya sendiri.
-- =========================================================================

-- ── Tabel transaksi (1 tabel per key) ───────────────────────────────────
-- Skema sama untuk semua: id (text PK, sama dengan id di Dexie),
-- payload (jsonb, seluruh object record), updated_at (auto), updated_by (device id).

create table if not exists public.salesHistory (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.expenses (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.incomes (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.shiftHistory (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.employeeDailyRecords (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.claimsHistory (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.savedBills (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ── Tabel config (1 baris per key, JSON blob) ────────────────────────────
-- CATATAN: value sengaja nullable karena beberapa config bisa di-set null
-- (misal: currentShift = null saat dompet ditutup). Constraint NOT NULL
-- yang lama menyebabkan push null gagal silent dan dompet terus terbuka
-- ulang dari nilai lama di Supabase setiap kali app dimuat.
create table if not exists public.app_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ── Trigger: auto-update updated_at saat row diubah ──────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'salesHistory','expenses','incomes','shiftHistory',
    'employeeDailyRecords','claimsHistory','savedBills','app_config'
  ]
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I;
       create trigger trg_set_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ── RLS: enable + allow anon full access (app sudah dijaga PIN modal) ────
do $$
declare
  t text;
begin
  foreach t in array array[
    'salesHistory','expenses','incomes','shiftHistory',
    'employeeDailyRecords','claimsHistory','savedBills','app_config'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists allow_anon_all on public.%I;', t);
    execute format(
      'create policy allow_anon_all on public.%I for all to anon using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ── Realtime: aktifkan publication untuk semua tabel di atas ─────────────
-- (Supabase Realtime butuh tabel masuk publication supabase_realtime)
do $$
declare
  t text;
begin
  foreach t in array array[
    'salesHistory','expenses','incomes','shiftHistory',
    'employeeDailyRecords','claimsHistory','savedBills','app_config'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then
      null; -- sudah ditambahkan sebelumnya, skip
    end;
  end loop;
end $$;