// --- Supabase Client & Device Identity ---
//
// Satu client Supabase untuk seluruh app, dipakai untuk:
// - Push perubahan (insert/update/delete) per-record ke Supabase
// - Subscribe Realtime Postgres Changes supaya device lain (misal HP kasir
//   & HP owner) langsung dapat update tanpa refresh manual.
//
// Tidak menggunakan Supabase Auth — akses dikontrol via PIN modal di app ini,
// jadi semua request memakai anon key + RLS policy yang mengizinkan akses publik
// (lihat file SQL schema yang disertakan).

let _client = null;

/**
 * Ambil Supabase client (lazy-init, singleton).
 * Return null kalau env var belum diset (sync otomatis akan nonaktif tanpa error).
 */
export async function getSupabaseClient() {
  if (_client) return _client;

  const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const { createClient } = await import('@supabase/supabase-js');
  _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
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