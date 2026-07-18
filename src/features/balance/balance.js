// features/balance/BalanceLogic.js
//
// Logic murni (pure functions) untuk laporan Laba Rugi bulanan.
//
// Bagian ini baru meng-cover sisi Penghasilan & Biaya (dari salesHistory
// dan expenses yang sudah ada di App.jsx). Sisi Stok Opname (HPP aktual
// dari stock_checklists mamam-absensi + rawMaterials) menyusul di file
// terpisah (stockOpnameLogic.js), lalu digabung di BalanceTab.jsx.
//
// Kenapa dipisah dari komponen: supaya gampang di-unit-test tanpa perlu
// render React, dan supaya BalanceTab.jsx tetap tipis (cuma UI + wiring).

import { toLocalMonthString } from '../../utils/formatters';
import { activeOnly } from '../../utils/softDelete';

export const KASBON_CATEGORY = 'Kasbon Karyawan';
export const BAHAN_BAKU_CATEGORY = 'Belanja';

/**
 * Total omzet penjualan kasir untuk 1 periode ("YYYY-MM").
 * Sumber: salesHistory (BUKAN incomes — incomes dianggap pemasukan
 * di luar operasional usaha inti, mis. modal tambahan/titipan uang,
 * dan sengaja tidak dihitung sebagai "Penghasilan" di laporan ini).
 *
 * Soft-deleted order (recycle bin) otomatis dikecualikan lewat activeOnly().
 */
export function getTotalPenghasilan(salesHistory, period) {
  return activeOnly(salesHistory)
    .filter(order => toLocalMonthString(order.date) === period)
    .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
}

/**
 * Pisahkan expenses 1 periode jadi 3 kelompok:
 * - belanjaBahanBaku: kategori "Belanja" -> masuk komponen HPP
 * - biayaOperasional: semua kategori LAIN selain "Belanja" dan
 *   "Kasbon Karyawan" -> pengurang Laba Kotor
 * - kasbon: kategori "Kasbon Karyawan" -> TIDAK dihitung sama sekali
 *   (itu piutang ke karyawan, sudah otomatis kepotong di payroll,
 *   bukan biaya usaha)
 *
 * Dikembalikan juga breakdown per-kategori untuk biaya operasional,
 * supaya UI bisa nampilin rincian, bukan cuma angka total.
 */
export function splitExpenses(expenses, period) {
  const periodExpenses = activeOnly(expenses)
    .filter(exp => toLocalMonthString(exp.date) === period);

  let belanjaBahanBaku = 0;
  let biayaOperasional = 0;
  let kasbon = 0;
  const operasionalByCategory = {};

  for (const exp of periodExpenses) {
    const amount = Number(exp.amount) || 0;

    if (exp.category === KASBON_CATEGORY) {
      kasbon += amount;
      continue;
    }

    if (exp.category === BAHAN_BAKU_CATEGORY) {
      belanjaBahanBaku += amount;
      continue;
    }

    biayaOperasional += amount;
    operasionalByCategory[exp.category] = (operasionalByCategory[exp.category] || 0) + amount;
  }

  return {
    belanjaBahanBaku,
    biayaOperasional,
    kasbon,
    operasionalByCategory, // { "Biaya": 2500000, "Lain-lain": 650000, ... }
  };
}

/**
 * Rumus inti Laba Rugi.
 *
 *   HPP          = Stok Awal + Belanja Bahan Baku − Stok Akhir
 *   Laba Kotor   = Penghasilan − HPP
 *   Laba Bersih  = Laba Kotor − Biaya Operasional
 *
 * stokAwalValue / stokAkhirValue diteruskan dari luar (hasil
 * stockOpnameLogic.js) — fungsi ini sengaja tidak tahu-menahu soal
 * stok opname, supaya tetap reusable meski sumber stok berubah nanti.
 */
export function computeBalance({
  penghasilan,
  belanjaBahanBaku,
  biayaOperasional,
  stokAwalValue,
  stokAkhirValue,
}) {
  const hpp = (Number(stokAwalValue) || 0) + belanjaBahanBaku - (Number(stokAkhirValue) || 0);
  const labaKotor = penghasilan - hpp;
  const labaBersih = labaKotor - biayaOperasional;

  return { hpp, labaKotor, labaBersih };
}

/**
 * Helper gabungan: hitung semua bagian "penghasilan & biaya" untuk 1
 * periode, TANPA sisi stok opname (stokAwalValue/stokAkhirValue diisi 0
 * secara default supaya fungsi ini tetap bisa dipanggil sendiri sebelum
 * data stok opname tersedia — mis. buat preview cepat di UI).
 *
 * BalanceTab.jsx akan override stokAwalValue/stokAkhirValue dengan nilai
 * asli begitu snapshot stok opname sudah di-generate.
 */
export function getBalanceSummary(salesHistory, expenses, period, stok = {}) {
  const penghasilan = getTotalPenghasilan(salesHistory, period);
  const { belanjaBahanBaku, biayaOperasional, kasbon, operasionalByCategory } = splitExpenses(expenses, period);

  const hasil = computeBalance({
    penghasilan,
    belanjaBahanBaku,
    biayaOperasional,
    stokAwalValue: stok.stokAwalValue || 0,
    stokAkhirValue: stok.stokAkhirValue || 0,
  });

  return {
    period,
    penghasilan,
    belanjaBahanBaku,
    biayaOperasional,
    kasbon, // ditampilkan sebagai info, bukan komponen hitungan
    operasionalByCategory,
    ...hasil,
  };
}