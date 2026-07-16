// utils/cashHolders.js
//
// ═══════════════════════════════════════════════════════════════════════
//  KONSEP "PEMEGANG KAS" (cash holder)
// ═══════════════════════════════════════════════════════════════════════
// Realita di lapangan: uang cash toko gak selalu ada di tangan kasir.
// Kurir juga pegang cash — TAPI cuma dari SATU sumber: pesanan Delivery
// yang dibayar customer LANGSUNG ke kurir pas barang nyampe (COD),
// bukan dari "pemasukan lain" atau modal apapun.
//
// Jadi cash masuk ke kurir itu bukan record baru yang diketik manual,
// melainkan MELEKAT pada transaksi penjualan itu sendiri (`salesHistory`)
// — order dengan `orderType: 'Delivery'` yang `deliveryPaidTo: 'kurir'`.
// Kasir tinggal pilih siapa kurirnya & cara bayarnya pas checkout di POS;
// gak ada input manual "pemasukan kurir" di modul Income sama sekali.
//
// Kadang kurir juga langsung belanja pakai uang itu sebelum sempat
// disetor ke kasir — itu dicatat di ExpenseView dengan `cashHolder` yang
// sama, jadi tetap SATU ledger (bukan 2 source of truth).
//
// Struktur `cashHolder` yang ditempel di record expense ATAUPUN order
// salesHistory:
//   { type: 'kasir' }                                  -> uang toko/laci kasir (default, berlaku utk data lama)
//   { type: 'kurir', employeeId: 'EMP-xxx', employeeName: 'Budi' }  -> uang di tangan kurir tsb
//
// employeeName di-snapshot (dibekukan) saat transaksi dicatat, mengikuti
// pola snapshot yang sudah ada di kasbon (ExpenseView) & payroll —
// supaya histori lama tetap tampil benar walau nama karyawan diedit/dihapus.
//
// Field ini OPSIONAL & backward-compatible: record lama tanpa `cashHolder`
// otomatis dianggap `{ type: 'kasir' }` (lihat getCashHolder di bawah).
//
// Selain expense/salesHistory, ada `cashTransfers` — ledger TERPISAH khusus
// buat mencatat "setoran" kurir -> kasir (transfer internal, bukan
// pengeluaran ataupun pemasukan bisnis baru, jadi sengaja gak dicampur ke
// expenses/incomes supaya gak dobel-hitung di laporan Laba/Rugi — uangnya
// kan sudah tercatat masuk lewat penjualan Delivery COD itu sendiri).

export const CASH_HOLDER_KASIR = { type: 'kasir' };

export function makeCourierCashHolder(employee) {
  return { type: 'kurir', employeeId: employee.id, employeeName: employee.name };
}

/** Resolve cash holder efektif dari sebuah record expense/order (default: kasir, utk data lama). */
export function getCashHolder(record) {
  return record?.cashHolder && record.cashHolder.type ? record.cashHolder : CASH_HOLDER_KASIR;
}

export function isCourierHolder(record) {
  return getCashHolder(record).type === 'kurir';
}

/** Label singkat buat ditampilkan di UI (badge/list). */
export function cashHolderLabel(record) {
  const holder = getCashHolder(record);
  if (holder.type === 'kurir') return holder.employeeName || 'Kurir';
  return 'Kasir/Toko';
}

/**
 * Hitung saldo cash yang sedang dipegang SATU kurir tertentu, di luar
 * kas kasir/toko:
 *
 *   saldo = uang masuk (order Delivery COD yg dibayar customer ke kurir)
 *         - uang keluar (expense yg dibayar pakai cash kurir, misal belanja)
 *         - total sudah disetor ke kasir (cashTransfers)
 *
 * Semua parameter sudah harus di-filter `activeOnly` dulu oleh pemanggil
 * (biar util ini gak perlu tau soal recycle bin).
 */
export function computeCourierBalance(employeeId, { expenses = [], salesHistory = [], cashTransfers = [] } = {}) {
  const cashIn = salesHistory
    .filter(order => isCourierHolder(order) && getCashHolder(order).employeeId === employeeId)
    .reduce((sum, order) => sum + (order.total || 0), 0);

  const cashOut = expenses
    .filter(exp => isCourierHolder(exp) && getCashHolder(exp).employeeId === employeeId)
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const deposited = cashTransfers
    .filter(t => t.employeeId === employeeId)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return cashIn - cashOut - deposited;
}

/**
 * Hitung saldo semua kurir sekaligus (dipakai buat dashboard ringkasan).
 * Mengembalikan array [{ employeeId, employeeName, balance }], hanya
 * kurir yang punya aktivitas kas (cashIn/cashOut/deposit != 0) ATAU
 * yang saat ini masih berstatus kurir aktif (dari daftar `couriers`).
 */
export function computeAllCourierBalances(couriers, { expenses = [], salesHistory = [], cashTransfers = [] } = {}) {
  return (couriers || []).map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    balance: computeCourierBalance(emp.id, { expenses, salesHistory, cashTransfers }),
  }));
}
