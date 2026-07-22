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
//
// Field `type` pada record cashTransfers (opsional, default 'deposit' utk
// data lama yang belum punya field ini):
//   'deposit'   -> setoran normal, uang BENERAN pindah ke laci kasir.
//                  Menurunkan saldo kurir DAN menaikkan Saldo Akhir Dompet
//                  (lihat expectedCash di ShiftView.jsx).
//   'writeoff'  -> kerugian/uang hilang (kurir kehilangan uang, dsb).
//                  Menurunkan saldo kurir SAMA seperti deposit (dari sisi
//                  computeCourierBalance di bawah, keduanya identik — cuma
//                  pengurang), TAPI TIDAK menaikkan Saldo Akhir Dompet,
//                  karena duitnya emang hilang, bukan pindah ke laci.
//                  ShiftView.jsx yang membedakan efeknya ke expectedCash.
//   'reimburse' -> kebalikan dari deposit/writeoff. Dipakai kalau saldo
//                  kurir NEGATIF (kurir nombokin belanja bisnis pakai duit
//                  pribadinya karena saldo COD dia gak cukup) — kasir
//                  ganti uang kurir dari laci. `amount` pada record jenis
//                  ini SENGAJA disimpan NEGATIF (kebalikan tanda dari
//                  deposit/writeoff yang selalu positif), supaya formula
//                  `deposited = sum(amount)` di computeCourierBalance
//                  otomatis MENAMBAH saldo kurir tanpa perlu cabang logic
//                  terpisah. Efek ke Saldo Dompet juga otomatis: saldo
//                  kurir naik -> totalHeldByCouriers naik -> expectedCash
//                  turun sejumlah yang diganti (uang beneran keluar dari
//                  laci fisik ke tangan kurir).

export const CASH_TRANSFER_TYPE_DEPOSIT = 'deposit';
export const CASH_TRANSFER_TYPE_WRITEOFF = 'writeoff';
export const CASH_TRANSFER_TYPE_REIMBURSE = 'reimburse';

export function isWriteoffTransfer(transfer) {
  return transfer?.type === CASH_TRANSFER_TYPE_WRITEOFF;
}

export function isReimburseTransfer(transfer) {
  return transfer?.type === CASH_TRANSFER_TYPE_REIMBURSE;
}

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
 * Mengembalikan array [{ employeeId, employeeName, isActive, balance }],
 * hanya kurir yang punya aktivitas kas (cashIn/cashOut/deposit != 0) ATAU
 * yang saat ini masih berstatus kurir aktif (dari daftar `couriers`).
 *
 * `couriers` idealnya array hasil `getCourierBalanceTargets()` di bawah
 * (sudah termasuk kurir non-aktif yang masih ada saldo nyangkut), TAPI
 * tetap backward-compatible kalau cuma di-pass array employee biasa
 * ({ id, name }) — `isActive` default true kalau field-nya gak ada.
 */
export function computeAllCourierBalances(couriers, { expenses = [], salesHistory = [], cashTransfers = [] } = {}) {
  return (couriers || []).map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    isActive: emp.isActive !== false,
    balance: computeCourierBalance(emp.id, { expenses, salesHistory, cashTransfers }),
  }));
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KENAPA FUNGSI INI ADA — kasus "saldo kurir nyangkut, gak bisa diapa-apain"
 * ═══════════════════════════════════════════════════════════════════════
 * `getActiveCouriers()` (di payrollLogic.js) cuma mengembalikan karyawan
 * yang SAAT INI role-nya 'kurir' & status-nya bukan 'resign'. Itu cocok
 * dipakai buat dropdown "pilih kurir" saat mencatat transaksi BARU (gak
 * boleh nempelin cash ke orang yang udah resign).
 *
 * TAPI kalau list yang sama juga dipakai buat MENGHITUNG & MENAMPILKAN
 * saldo kurir (ShiftView), begitu status seorang kurir diubah jadi
 * 'resign' (atau role-nya diganti), dia LANGSUNG hilang dari daftar —
 * padahal saldo cash dia di salesHistory/expenses/cashTransfers TETAP
 * ada & TIDAK ikut nol. Akibatnya: uang itu masih "nyangkut" di data,
 * tapi tombol Setor/Hapus/Ganti Uang buat nyelesaiinnya juga ikut hilang
 * (gak pernah dirender sama sekali) — dan totalHeldByCouriers jadi
 * under-count, bikin Saldo Akhir Dompet di shiftStats keliatan LEBIH
 * BESAR dari kas fisik yang sebenarnya ada.
 *
 * Fungsi ini menggabungkan kurir aktif dengan SEMUA employeeId yang
 * pernah tercatat sebagai cashHolder kurir di ledger manapun (expense,
 * salesHistory, cashTransfers) — supaya baris saldo kurir yang sudah
 * resign/ganti role TETAP muncul & tetap bisa di-Setor/Hapus/Ganti Uang
 * sampai benar-benar tuntas, bukan cuma menghilang begitu saja.
 *
 * Dipakai KHUSUS untuk menghitung/menampilkan saldo (ShiftView) — BUKAN
 * untuk dropdown pilih kurir di transaksi baru (ExpenseView/PaymentModal
 * tetap pakai getActiveCouriers() apa adanya).
 */
export function getCourierBalanceTargets(activeCouriers, { expenses = [], salesHistory = [], cashTransfers = [] } = {}) {
  const byId = new Map();

  (activeCouriers || []).forEach(emp => {
    byId.set(emp.id, { id: emp.id, name: emp.name, isActive: true });
  });

  const addFromCashHolderRecord = (record) => {
    if (!isCourierHolder(record)) return;
    const holder = getCashHolder(record);
    if (!holder.employeeId || byId.has(holder.employeeId)) return;
    byId.set(holder.employeeId, {
      id: holder.employeeId,
      name: holder.employeeName || 'Kurir (non-aktif)',
      isActive: false,
    });
  };

  (expenses || []).forEach(addFromCashHolderRecord);
  (salesHistory || []).forEach(addFromCashHolderRecord);

  (cashTransfers || []).forEach(t => {
    if (!t.employeeId || byId.has(t.employeeId)) return;
    byId.set(t.employeeId, {
      id: t.employeeId,
      name: t.employeeName || 'Kurir (non-aktif)',
      isActive: false,
    });
  });

  return Array.from(byId.values());
}