// utils/cashHolders.js
//
// ═══════════════════════════════════════════════════════════════════════
//  KONSEP "PEMEGANG KAS" (cash holder) — dipakai di salesHistory & expenses
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
// salesHistory (field ini TIDAK berubah dari sebelumnya — PosView.jsx &
// ExpenseView.jsx TIDAK disentuh oleh rombakan model transaksi kurir):
//   { type: 'kasir' }                                  -> uang toko/laci kasir (default, berlaku utk data lama)
//   { type: 'kurir', employeeId: 'EMP-xxx', employeeName: 'Budi' }  -> uang di tangan kurir tsb
//
// employeeName di-snapshot (dibekukan) saat transaksi dicatat, mengikuti
// pola snapshot yang sudah ada di kasbon (ExpenseView) & payroll —
// supaya histori lama tetap tampil benar walau nama karyawan diedit/dihapus.
//
// Field ini OPSIONAL & backward-compatible: record lama tanpa `cashHolder`
// otomatis dianggap `{ type: 'kasir' }` (lihat getCashHolder di bawah).

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

// ═══════════════════════════════════════════════════════════════════════
//  MODEL LEDGER "DARI -> KE" (rombakan total, gantiin sistem 5-tipe lama)
// ═══════════════════════════════════════════════════════════════════════
// Sebelumnya: cashTransfers punya field `type` (deposit/writeoff/reimburse/
// owner), masing-masing punya efek TERSEMBUNYI & BEDA-BEDA ke 3 akumulator
// terpisah (totalHeldByCouriers, totalWrittenOff, totalTransferredToOwner)
// yang harus disinkronin manual satu-satu ke formula totalCashBisnis. Itu
// sumber bug berulang (termasuk salah hitung yang sempat kejadian pas
// nambah tipe baru) — gampang lupa update satu tempat pas nambah kasus.
//
// Sekarang: SETIAP transaksi kurir cuma py 2 field lokasi — `from` & `to`.
// Uang bisnis SELALU ada di salah satu dari 4 lokasi:
//   'dompet'      -> laci kasir fisik
//   'kurir:<id>'  -> di tangan kurir tsb (belum disetor)
//   'owner'       -> sudah di tangan pemilik bisnis (transfer/tunai)
//   'hilang'      -> dianggap lenyap (write-off, kecolongan, dst)
//
// Amount SELALU POSITIF (gak ada lagi trik "amount disimpan negatif" buat
// reimburse — itu jebakan baca kode). Saldo di lokasi manapun dihitung
// dengan RUMUS YANG SAMA PERSIS, gak peduli lokasinya apa:
//
//   saldo(X) = jumlah(to === X) - jumlah(from === X)
//
// Ini satu-satunya rumus saldo di seluruh modul Shift. Gak ada akumulator
// terpisah yang harus disinkronin manual lagi.
//
// Field record cashTransfers (BARU):
//   { id, from, to, amount (selalu positif), note, date }
//
// Contoh pemetaan kejadian dunia nyata -> from/to:
//   Kurir setor tunai ke kasir              -> from: 'kurir:X', to: 'dompet'
//   Kasir ganti uang kurir yg nombokin       -> from: 'dompet', to: 'kurir:X'
//   Uang kurir hilang/gak balik              -> from: 'kurir:X', to: 'hilang'
//   Kasir narik dari laci buat setor Owner   -> from: 'dompet', to: 'owner'
//   Kurir transfer COD LANGSUNG ke Owner     -> from: 'kurir:X', to: 'owner'
//   Owner nombokin belanja kurir duluan      -> from: 'owner', to: 'kurir:X'
//   Selisih/uang di laci ketahuan hilang     -> from: 'dompet', to: 'hilang'

export const LOCATION_DOMPET = 'dompet';
export const LOCATION_OWNER = 'owner';
export const LOCATION_HILANG = 'hilang';
export const LOCATION_CUSTOMER = 'customer'; // dipakai KHUSUS transaksi virtual dari penjualan, gak pernah muncul di cashTransfers beneran

export function courierLocationKey(employeeId) {
  return `kurir:${employeeId}`;
}

export function isCourierLocation(key) {
  return typeof key === 'string' && key.startsWith('kurir:');
}

export function courierIdFromLocation(key) {
  return isCourierLocation(key) ? key.slice('kurir:'.length) : null;
}

/** Label tampilan buat sebuah location key ('dompet'/'owner'/'hilang'/'kurir:xxx'/'customer'). */
export function locationLabel(key, employeesById) {
  if (key === LOCATION_DOMPET) return 'Dompet';
  if (key === LOCATION_OWNER) return 'Owner';
  if (key === LOCATION_HILANG) return 'Hilang';
  if (key === LOCATION_CUSTOMER) return 'Customer';
  if (isCourierLocation(key)) {
    const id = courierIdFromLocation(key);
    return employeesById?.get(id)?.name || 'Kurir';
  }
  return key || '-';
}

/**
 * Saldo di SATU lokasi, dihitung dari ledger transaksi manual
 * (cashTransfers, format from/to baru) DITAMBAH transaksi virtual yang
 * diteruskan lewat parameter `extraTransactions` (lihat
 * buildVirtualTransactions di useShiftLogic.js — hasil "terjemahan"
 * salesHistory/expenses jadi bentuk from/to, TANPA menulis balik ke
 * tabel manapun).
 *
 * `openingBalance` dipakai KHUSUS lokasi 'dompet' (uang kas awal shift);
 * default 0 buat lokasi lain (kurir/owner/hilang selalu mulai dari 0).
 */
export function computeLocationBalance(locationKey, transactions, openingBalance = 0) {
  return (transactions || []).reduce((bal, t) => {
    if (t.to === locationKey) bal += (t.amount || 0);
    if (t.from === locationKey) bal -= (t.amount || 0);
    return bal;
  }, openingBalance);
}

/**
 * Saldo SEMUA kurir sekaligus (dipakai buat breakdown "Rincian Posisi
 * Uang" & dropdown form transaksi). `couriers` idealnya hasil
 * getCourierBalanceTargets() (termasuk kurir non-aktif yg masih ada
 * saldo nyangkut).
 */
export function computeAllCourierBalances(couriers, transactions) {
  return (couriers || []).map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    isActive: emp.isActive !== false,
    balance: computeLocationBalance(courierLocationKey(emp.id), transactions),
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
 * tapi baris buat nyelesaiinnya juga ikut hilang dari UI (gak pernah
 * dirender sama sekali) — bikin Saldo Akhir keliatan gak balance dengan
 * kas fisik yang sebenarnya ada.
 *
 * Fungsi ini menggabungkan kurir aktif dengan SEMUA employeeId yang
 * pernah tercatat sebagai cashHolder kurir di ledger manapun (expense,
 * salesHistory, cashTransfers) — supaya baris saldo kurir yang sudah
 * resign/ganti role TETAP muncul & tetap bisa diselesaikan lewat form
 * transaksi, sampai benar-benar tuntas, bukan cuma menghilang begitu saja.
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
    [t.from, t.to].forEach(locKey => {
      const id = courierIdFromLocation(locKey);
      if (!id || byId.has(id)) return;
      byId.set(id, { id, name: t.employeeNameSnapshot?.[id] || 'Kurir (non-aktif)', isActive: false });
    });
  });

  return Array.from(byId.values());
}

// ═══════════════════════════════════════════════════════════════════════
//  MIGRASI DATA LAMA (format type/employeeId -> format from/to)
// ═══════════════════════════════════════════════════════════════════════
// Dipanggil SEKALI oleh useShiftLogic.js saat data cashTransfers lama
// terdeteksi (record punya field `type` tapi belum punya `from`/`to`).
// Permanen — hasil migrasi ditulis balik menggantikan data lama.
export function migrateLegacyCashTransfer(t) {
  if (t.from && t.to) return t; // sudah format baru, gak perlu migrasi
  const kurirKey = t.employeeId ? courierLocationKey(t.employeeId) : null;
  const base = { id: t.id, note: t.note, date: t.date, isDeleted: t.isDeleted, deletedAt: t.deletedAt };

  switch (t.type) {
    case 'writeoff':
      return { ...base, from: kurirKey, to: LOCATION_HILANG, amount: Math.abs(t.amount || 0) };
    case 'reimburse':
      // amount lama disimpan NEGATIF -> uang keluar dari Dompet ke Kurir
      return { ...base, from: LOCATION_DOMPET, to: kurirKey, amount: Math.abs(t.amount || 0) };
    case 'owner':
      return { ...base, from: LOCATION_DOMPET, to: LOCATION_OWNER, amount: Math.abs(t.amount || 0) };
    case 'courier_owner':
      return { ...base, from: kurirKey, to: LOCATION_OWNER, amount: Math.abs(t.amount || 0) };
    case 'deposit':
    default:
      return { ...base, from: kurirKey, to: LOCATION_DOMPET, amount: Math.abs(t.amount || 0) };
  }
}