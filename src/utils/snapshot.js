// utils/snapshot.js
// Helper generik buat bikin "snapshot" data master ke dalam record histori/transaksi.
//
// Prinsip: data master (menus, employees, customers, dst) BOLEH berubah kapan
// saja. Data histori/transaksi TIDAK BOLEH ikut berubah setelah dibuat — jadi
// begitu sebuah record histori dibuat, field-field yang relevan dari data
// master di-copy (snapshot) langsung ke dalam record itu, bukan diambil ulang
// dari master tiap kali ditampilkan/dihitung ulang.
//
// ID/relasi ke data master (mis. employeeId, customerId, menuId) TETAP
// disimpan seperti biasa — snapshot ini NAMBAHIN, bukan gantiin, referensi
// itu. ID tetap dipertahankan buat keperluan lain (filter per
// customer/employee, grouping, dst), snapshot cuma dipakai buat DISPLAY &
// KALKULASI biar histori gak ikut berubah kalau data master diedit belakangan.
//
// Dipakai bareng di: features/hrd/utils/payrollLogic.js (snapshot tarif &
// nama karyawan buat payroll), dan modul lain yang butuh pola serupa —
// tinggal import createSnapshot/resolveSnapshot, gak perlu nulis ulang
// logikanya tiap nambah fitur baru.

/**
 * Ambil subset field tertentu dari objek master jadi objek snapshot polos.
 * Field yang gak ada di source diisi `null` (bukan di-skip) biar shape
 * objek snapshot selalu konsisten walau data sumbernya bervariasi.
 *
 * @param {object} source - objek master (misal: employee, menu, customer)
 * @param {string[]} fields - daftar nama field yang mau di-snapshot
 * @returns {object|null} objek snapshot, atau null kalau source-nya kosong
 */
export function createSnapshot(source, fields) {
  if (!source) return null;
  const snap = {};
  fields.forEach(f => { snap[f] = source[f] !== undefined ? source[f] : null; });
  return snap;
}

/**
 * Resolve data "efektif" buat sebuah record histori: PRIORITASKAN snapshot
 * yang sudah dibekukan di record itu sendiri (record[snapshotKey]), baru
 * fallback ke data master LIVE (dicari by id di masterList) kalau record-nya
 * belum punya snapshot sama sekali.
 *
 * Fallback ini yang bikin record LAMA (dibuat sebelum pola snapshot ini ada)
 * tetap tampil & terhitung normal — persis seperti perilaku sebelumnya —
 * sampai record itu tersentuh lagi (disimpan/diedit) dan otomatis
 * "dibekukan" jadi snapshot permanen.
 *
 * @param {object} record - record histori (misal: employeeDailyRecord, expense)
 * @param {string} snapshotKey - nama field snapshot di record (misal: 'employeeSnapshot')
 * @param {Array} masterList - array data master (misal: employees)
 * @param {string} idKey - nama field id di record yang mengacu ke master (misal: 'employeeId')
 * @returns {object|null}
 */
export function resolveSnapshot(record, snapshotKey, masterList, idKey) {
  if (record && record[snapshotKey]) return record[snapshotKey];
  return (masterList || []).find(m => m.id === record?.[idKey]) || null;
}
