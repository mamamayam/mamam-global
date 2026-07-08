// --- Supabase Client & Device Identity ---
//
// Satu client Supabase untuk seluruh app, dipakai untuk:
// - Push perubahan (insert/update/delete) per-record ke Supabase
// - Subscribe Realtime Postgres Changes supaya device lain (misal HP kasir
//   & HP owner) langsung dapat update tanpa refresh manual.
//
// AUTH: pakai Supabase Anonymous Auth — sign-in sekali per device, silent,
// gak ada layar login. Ini BUKAN buat identifikasi user/role (semua device
// tetap dapat akses yang sama persis kayak sebelumnya); tujuannya murni
// supaya request ke Supabase jalan sebagai role `authenticated`, bukan `anon`.
// Alasannya: anon key nempel di JS bundle & kebaca siapa aja yang buka
// devtools/network tab — PIN modal cuma ngunci UI aplikasi, gak ngunci baris
// di database. RLS sekarang dikunci ke `authenticated` saja
// (lihat storage/supabase_auth_migration.sql).

let _client = null;
let _authReadyPromise = null;

// ── TIMEOUT HELPER — dipakai di file ini & realtimeSync.js ─────────────────
// Supabase-js gak punya timeout bawaan. Kalau koneksi macet/setengah putus
// (bukan bener-bener offline, jadi listener 'online'/'offline' browser gak
// kedeteksi), promise-nya bisa nge-hang SELAMANYA tanpa pernah resolve/reject.
// Ini yang bikin manual sync bisa "muter" puluhan menit gak kelar — satu
// request macet, semua proses di belakangnya (yang jalan serial) ikut
// nunggu selama-lamanya. withTimeout() maksa promise itu "nyerah" setelah
// N ms — request aslinya mungkin masih jalan diam-diam di background (gak
// di-abort, cuma hasilnya diabaikan), tapi kode kita gak pernah stuck lagi.
export function withTimeout(promise, ms, label = 'operasi') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Pastikan client punya sesi Supabase Auth (anonymous, silent).
 * - Cek sesi tersimpan dulu (getSession) — kalau device ini sudah pernah
 *   sign-in sebelumnya, sesi ke-restore dari localStorage, gak ada request baru.
 * - Kalau belum ada sesi sama sekali, signInAnonymously() SEKALI. SDK yang
 *   nyimpen sesi hasilnya ke localStorage & auto-refresh token-nya sendiri.
 * - Gagal (mis. device offline pas pertama kali buka app) → jangan lempar
 *   error, cukup log & reset promise-nya supaya percobaan BERIKUTNYA (push
 *   atau auto-sync selanjutnya) retry dari awal, bukan dianggap gagal permanen.
 *
 * Sengaja dipanggil dari DALAM getSupabaseClient() (bukan dari App.jsx atau
 * realtimeSync.js) supaya SATU tempat ini otomatis nge-cover SEMUA jalur yang
 * minta client — push per-record, initial pull, maupun runAutoSync — tanpa
 * perlu nambahin await di file lain sama sekali.
 */
const AUTH_TIMEOUT_MS = 8000;

function ensureAuthSession(client) {
  if (!_authReadyPromise) {
    _authReadyPromise = (async () => {
      try {
        const { data: { session } } = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'auth.getSession');
        if (session) return session;

        const { data, error } = await withTimeout(client.auth.signInAnonymously(), AUTH_TIMEOUT_MS, 'auth.signInAnonymously');
        if (error) throw error;
        return data.session;
      } catch (err) {
        console.warn('[auth] silent sign-in gagal/timeout (device offline?), akan dicoba lagi nanti:', err.message);
        _authReadyPromise = null;
        return null;
      }
    })();
  }
  return _authReadyPromise;
}

/**
 * Ambil Supabase client (lazy-init, singleton) — sudah lewat silent
 * anonymous sign-in sebelum dikembalikan ke pemanggil.
 * Return null kalau env var belum diset (sync otomatis akan nonaktif tanpa error).
 */
export async function getSupabaseClient() {
  if (!_client) {
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;

    const { createClient } = await import('@supabase/supabase-js');
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }

  await ensureAuthSession(_client);
  return _client;
}

export function isSupabaseConfigured() {
  return Boolean(import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY);
}

const DEVICE_ID_KEY = 'mamam_device_id';

/**
 * ID unik per device/browser, dibuat sekali & disimpan permanen di localStorage.
 * Dipakai untuk menandai asal perubahan (echo-suppression) supaya device yang
 * mengirim perubahan tidak memproses ulang perubahannya sendiri saat realtime
 * event balik masuk.
 */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}