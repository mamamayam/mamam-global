// utils/chunkReload.js
//
// Deploy baru = hash nama file JS/CSS ikut berubah (Vite content-hash).
// Kalau sebuah tab masih pegang bundle LAMA pas ada deploy baru, dynamic
// import (React.lazy di AppRoutes.jsx, atau prefetch bawaan Vite sendiri)
// ke chunk lama bakal gagal (404 di server, karena file lama udah gak ada
// lagi) — muncul sebagai "Failed to fetch dynamically imported module...".
//
// Satu-satunya cara benerin TAB yang udah kepalang kebuka itu ya reload
// penuh (ambil index.html baru yang nunjuk ke chunk hash yang benar) —
// makanya errornya "kalo di refresh ilang": refresh manual = reload penuh,
// tombol "Coba Lagi" di error boundary = cuma render ulang React, gak
// pernah benar-benar ambil bundle baru, jadi errornya balik lagi persis sama.
//
// Helper ini dipakai di 2 titik:
// - main.jsx: dengerin event 'vite:preloadError' langsung dari Vite (jaring
//   pengaman paling awal/luas, nangkep dynamic import yang gagal bahkan di
//   luar React tree).
// - AppRoutes.jsx: ViewErrorBoundary, buat nangkep error yang lolos sampai
//   ke React (misal gagal pas resolve Suspense lazy()) dan otomatis reload
//   sekali, bukan cuma nawarin "Coba Lagi" yang gak bakal pernah berhasil.
//
// Guard sessionStorage nyegah infinite-reload kalau ternyata masalahnya
// BUKAN cuma chunk basi (misal internet putus beneran pas reload) — reload
// otomatis cuma dicoba SEKALI per sesi tab ini, sisanya fallback ke tombol
// manual di error boundary.

const GUARD_KEY = 'mamam-chunk-reload-attempted';

/** Cek apakah sebuah Error itu kegagalan dynamic import/chunk (bukan bug fitur biasa). */
export function isChunkLoadError(error) {
  const msg = error?.message || '';
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to import/i.test(msg);
}

/**
 * Reload sekali (guarded lewat sessionStorage) buat ambil bundle terbaru.
 * @returns {boolean} true kalau reload beneran dijalankan, false kalau udah pernah dicoba di sesi ini.
 */
export function reloadOnceForFreshChunk() {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(GUARD_KEY)) return false;
  sessionStorage.setItem(GUARD_KEY, '1');
  window.location.reload();
  return true;
}

/**
 * Dipanggil setelah app berhasil render normal — reset guard biar deploy
 * baru berikutnya (di sesi tab yang sama) tetap bisa dapet 1x auto-reload lagi.
 */
export function clearChunkReloadGuard() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(GUARD_KEY);
}