// ============================================================================
// MOCK AUTH — TAHAP 1 (data dummy)
// ============================================================================
// File ini mensimulasikan apa yang nantinya akan dilakukan Supabase Auth +
// tabel `users`/`branches` di database. Semua fungsi di sini sengaja dibuat
// dengan SIGNATURE (nama fungsi, parameter, bentuk return) yang sama seperti
// yang akan dipakai nanti saat sudah terhubung ke Supabase — jadi saat
// Tahap 2 (schema) & Tahap 3 (wiring Supabase) dikerjakan, komponen UI
// (Login.jsx, AuthContext.jsx, BranchSwitcher.jsx) TIDAK PERLU diubah,
// cukup isi ulang file ini dengan panggilan supabase.auth.* + query asli.
//
// JANGAN dipakai di production — password di sini plaintext & disimpan
// di memori, cuma untuk keperluan desain alur UI.
// ============================================================================

// ── Data dummy cabang ────────────────────────────────────────────────────
export const MOCK_BRANCHES = [
  { id: 'branch-1', name: 'Mamam Ayam - Cikarang Pusat' },
  { id: 'branch-2', name: 'Mamam Ayam - Lippo Cikarang' },
  { id: 'branch-3', name: 'Mamam Ayam - Jababeka' },
];

// ── Data dummy user ──────────────────────────────────────────────────────
// role: 'owner' | 'admin' | 'kasir'
// branchId: null untuk owner (akses semua cabang), wajib diisi untuk admin/kasir
// pin: khusus kasir, dipakai PinModal yang sudah ada di app
// lockedDeviceId: null jika belum pernah login di device manapun
const MOCK_USERS = [
  {
    id: 'user-owner-1',
    email: 'owner@mamamayam.com',
    password: 'owner123',
    name: 'Budi Santoso',
    role: 'owner',
    branchId: null,
    pin: null,
    lockedDeviceId: null,
  },
  {
    id: 'user-admin-1',
    email: 'admin.cikarang@mamamayam.com',
    password: 'admin123',
    name: 'Siti Aminah',
    role: 'admin',
    branchId: 'branch-1',
    pin: null,
    lockedDeviceId: null,
  },
  {
    id: 'user-kasir-1',
    email: 'kasir.cikarang@mamamayam.com',
    password: 'kasir123',
    name: 'Dedi Kurniawan',
    role: 'kasir',
    branchId: 'branch-1',
    pin: '123456',
    lockedDeviceId: null,
  },
];

const SESSION_KEY = 'mamam_mock_session';

// ── Simulasi delay network supaya UI loading state kerasa natural ────────
const fakeDelay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulasi supabase.auth.signInWithPassword({ email, password }).
 * Termasuk pengecekan device lock: 1 akun cuma boleh aktif di 1 device.
 *
 * @returns {{ user: object|null, error: string|null }}
 */
export async function mockSignIn(email, password, deviceId) {
  await fakeDelay();

  const user = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (!user || user.password !== password) {
    return { user: null, error: 'Email atau kata sandi salah.' };
  }

  // ── Device lock check ──────────────────────────────────────────────────
  if (user.lockedDeviceId && user.lockedDeviceId !== deviceId) {
    return {
      user: null,
      error:
        'Akun ini sudah terhubung ke device lain. Hubungi Owner untuk reset akses device.',
    };
  }

  // Device pertama kali login → kunci akun ke device ini
  if (!user.lockedDeviceId) {
    user.lockedDeviceId = deviceId;
  }

  const branch = MOCK_BRANCHES.find((b) => b.id === user.branchId) || null;

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    branchName: branch?.name ?? null,
    pin: user.pin,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

  return { user: sessionUser, error: null };
}

/**
 * Simulasi supabase.auth.signOut().
 */
export async function mockSignOut() {
  await fakeDelay(200);
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Simulasi supabase.auth.getSession() — dipanggil saat app pertama kali load
 * untuk cek apakah user sudah login sebelumnya (persist across refresh).
 */
export async function mockGetSession() {
  await fakeDelay(150);
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return { user: null };
  try {
    return { user: JSON.parse(raw) };
  } catch {
    return { user: null };
  }
}

/**
 * Owner-only: pindah cabang aktif tanpa perlu login ulang.
 * Nanti di Supabase, ini cukup update state lokal `activeBranchId`
 * (bukan re-auth) karena RLS owner akan pakai role check, bukan branchId di JWT.
 */
export function getBranchList() {
  return MOCK_BRANCHES;
}

/**
 * Helper reset khusus testing manual di console browser:
 *   import { __resetDeviceLock } from './mockAuth'
 *   __resetDeviceLock('kasir.cikarang@mamamayam.com')
 */
export function __resetDeviceLock(email) {
  const user = MOCK_USERS.find((u) => u.email === email);
  if (user) user.lockedDeviceId = null;
}
