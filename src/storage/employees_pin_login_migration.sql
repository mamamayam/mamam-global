-- employees_pin_login_migration.sql
--
-- Tabel `employees` dipakai LoginView.jsx, AccountView.jsx, App.jsx, dan
-- kedua Edge Function baru (create-employee, reset-employee-pin) -- tapi
-- belum pernah didefinisikan di mana pun di repo (gak ada di
-- supabase_schema.sql). Jalankan ini di Supabase Dashboard -> SQL Editor.
--
-- Aman dijalankan ulang (idempotent): kalau tabel/policy udah ada duluan,
-- `create table if not exists` dilewatin, dan policy di-drop+create ulang
-- tanpa nyentuh data yang udah ada.

create table if not exists public.employees (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

-- Daftar nama di LoginView ("Siapa yang masuk?") harus kebaca SEBELUM
-- employee login -- device saat itu cuma pegang sesi anonim
-- (signInAnonymously(), lihat syncClient.js). Sesi anonim tetap dianggap
-- role `authenticated` di Supabase, jadi policy `to authenticated` ini
-- otomatis nutup kasus itu juga -- gak perlu policy terpisah buat role `anon`.
drop policy if exists "employees_select_active" on public.employees;
create policy "employees_select_active"
  on public.employees for select
  to authenticated
  using (is_active = true);

-- Toggle aktif/nonaktif di AccountView.jsx jalan langsung dari client
-- (bukan lewat Edge Function) -- dibatasi cuma admin aktif yang lagi login.
drop policy if exists "employees_update_admin_only" on public.employees;
create policy "employees_update_admin_only"
  on public.employees for update
  to authenticated
  using (
    exists (
      select 1 from public.employees me
      where me.id = auth.uid() and me.role = 'admin' and me.is_active = true
    )
  );

-- INSERT/DELETE SENGAJA tidak dikasih policy buat role authenticated biasa
-- -- bikin akun baru cuma boleh lewat Edge Function create-employee (pakai
-- service role key, otomatis bypass RLS), bukan insert langsung dari client.
