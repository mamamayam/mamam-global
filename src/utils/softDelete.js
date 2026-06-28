// utils/softDelete.js
// Helper pola "Recycle Bin" (soft delete) — dipakai bareng di semua view
// transaksi: salesHistory, expenses, incomes, shiftHistory,
// employeeDailyRecords, claimsHistory, savedBills.
//
// Konsep: hapus = tandai `deletedAt`, BUKAN di-filter/hilang dari array.
// Baru beneran hilang kalau di-purge permanen (lihat isExpired/splitExpired).
// Field `deletedAt` otomatis ikut ke-sync ke Supabase lewat upsert biasa,
// karena cuma 1 field tambahan di payload — gak perlu ubah schema.

/**
 * Tandai 1 item sebagai "dihapus" (masuk recycle bin).
 * Pakai ini di handler hapus, GANTI yang biasanya `.filter(x => x.id !== id)`
 * jadi `.map(x => x.id === id ? markDeleted(x) : x)`.
 */
export function markDeleted(item) {
  return { ...item, deletedAt: new Date().toISOString() };
}

/** Balikin item dari recycle bin ke aktif lagi (restore). */
export function restoreItem(item) {
  return { ...item, deletedAt: null };
}

/** Filter buat tampilan NORMAL — cuma yang masih aktif. */
export function activeOnly(list) {
  return (list || []).filter(item => !item.deletedAt);
}

/** Filter buat tampilan RECYCLE BIN — yang sudah ditandai dihapus. */
export function trashedOnly(list) {
  return (list || []).filter(item => !!item.deletedAt);
}

/**
 * Cek apakah sebuah item sudah lewat masa retensi recycle bin
 * (default 30 hari sejak ditandai dihapus) — kalau true, boleh dipurge permanen.
 */
export function isExpired(item, retentionDays = 30) {
  if (!item.deletedAt) return false;
  const deletedAtMs = new Date(item.deletedAt).getTime();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  return Date.now() - deletedAtMs >= retentionMs;
}

/**
 * Dari satu list, pisahin mana yang masih boleh disimpan (aktif + masih
 * dalam masa retensi) vs mana yang sudah lewat retensi dan boleh dipurge.
 * Berguna buat auto-purge berkala (misal ditempel di timer auto-sync).
 */
export function splitExpired(list, retentionDays = 30) {
  const keep = [];
  const expired = [];
  (list || []).forEach(item => {
    if (isExpired(item, retentionDays)) expired.push(item);
    else keep.push(item);
  });
  return { keep, expired };
}

export function purgeByIds(list, ids) {
  const idSet = new Set(ids);
  return (list || []).filter(item => !idSet.has(item.id));
}
