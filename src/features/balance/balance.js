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
import {
  resolveEmployeeForRecord,
  summarizeAutoBonuses,
  AUTO_ADJUSTMENT_CATEGORIES,
} from '../hrd/utils/payrollLogic';

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
 * Total BIAYA GAJI (upah kotor) untuk 1 periode — dipakai sebagai salah
 * satu komponen Biaya Operasional di Laba Rugi.
 *
 * Sistem penggajian di app ini TIDAK PERNAH mengurangi upah karyawan —
 * semua dihitung murni akumulasi: (jam kerja × tarif) + Bonus Full Time +
 * Uang Lembur + tambahan lain (ongkir, potong ayam, dll, lewat
 * rec.additions). Field rec.deductions ada di struktur data untuk jaga-jaga
 * fitur potongan manual di masa depan, tapi saat ini kosong/tidak dipakai.
 *
 * Kasbon (expenses kategori "Kasbon Karyawan") itu piutang ke karyawan,
 * BUKAN biaya. Kasbon hanya mengurangi jumlah kas yang perlu dikeluarkan
 * saat gajian (karena sebagian sudah "dicicil" duluan) — kewajiban gaji
 * yang dicatat sebagai biaya di Laba Rugi tidak pernah berubah karena
 * kasbon, berapa pun besarnya.
 *
 * PENTING — ini SENGAJA BUKAN netPay (lihat ReportsTab.jsx SECTION 1):
 *   netPay = basicPay + totalAdditions - totalDeductions
 * di mana totalDeductions itu SUDAH termasuk kasbon (expenses kategori
 * "Kasbon Karyawan" ditambahkan langsung ke totalDeductions per karyawan,
 * karena netPay memang dipakai untuk "berapa yang harus dibayar tunai" —
 * beda tujuan dengan biaya gaji di Laba Rugi ini).
 *
 * Rumus yang dipakai:
 *   Biaya Gaji = basicPay + totalAdditions - (totalDeductions - totalKasbon)
 *
 * Kalau rec.deductions memang selalu kosong (sesuai kondisi sistem saat
 * ini), maka totalDeductions HANYA berisi kasbon, sehingga
 * (totalDeductions - totalKasbon) = 0 dan rumus di atas otomatis menjadi
 * murni akumulasi: Biaya Gaji = basicPay + totalAdditions (upah kotor
 * penuh, tidak dikurangi apa pun). Kalau nanti fitur potongan manual mulai
 * dipakai, potongan itu akan otomatis ikut mengurangi biaya gaji — kasbon
 * tetap tidak pernah dihitung sebagai biaya, berapa pun kondisinya.
 */
export function getTotalBiayaGaji(employeeDailyRecords, expenses, employees, period) {
  const periodRecords = activeOnly(employeeDailyRecords)
    .filter(rec => toLocalMonthString(rec.date) === period);

  const perf = {}; // employeeId -> { basicPay, totalAdditions, totalDeductions, totalKasbon, records }

  const ensure = (employeeId) => {
    if (!perf[employeeId]) {
      perf[employeeId] = { basicPay: 0, totalAdditions: 0, totalDeductions: 0, totalKasbon: 0, records: [] };
    }
    return perf[employeeId];
  };

  periodRecords.forEach(rec => {
    const data = ensure(rec.employeeId);
    data.records.push(rec);

    const recEmp = resolveEmployeeForRecord(rec, employees);
    data.basicPay += (rec.hoursWorked || 0) * (recEmp?.hourlyRate || 0);

    // Tambahan manual non-auto (ongkir, potong ayam, dll) — Bonus Full
    // Time & Bonus Lembur dihitung terpisah lewat summarizeAutoBonuses di
    // bawah, sama seperti pola di ReportsTab.jsx, supaya masing-masing
    // record tetap pakai tarif/konfigurasi yang dibekukan saat itu.
    data.totalAdditions += (rec.additions || [])
      .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
      .reduce((sum, a) => sum + a.amount, 0);
    // rec.deductions saat ini tidak pernah diisi di sistem ini (tidak ada
    // fitur potongan gaji manual) — baris ini disiapkan untuk kompatibilitas
    // ke depan saja, hasilnya akan selalu 0 selama field itu tetap kosong.
    data.totalDeductions += (rec.deductions || []).reduce((sum, d) => sum + d.amount, 0);
  });

  // Kasbon (expenses kategori "Kasbon Karyawan") bulan ini per karyawan —
  // dicatat terpisah supaya bisa "dibalikin" dari totalDeductions.
  activeOnly(expenses || []).forEach(exp => {
    if (
      exp.employeeId &&
      toLocalMonthString(exp.date) === period &&
      exp.category === KASBON_CATEGORY
    ) {
      const data = ensure(exp.employeeId);
      data.totalKasbon += Number(exp.amount) || 0;
      // Kasbon manual biasanya JUGA tercatat sebagai deduction di record
      // harian (lihat ReportsTab.jsx) — supaya konsisten, kasbon yang masuk
      // lewat expenses ini turut ditambahkan ke totalDeductions dulu,
      // baru nanti dikurangi balik di bawah. Ini menjaga behaviour sama
      // persis dengan SECTION 1 ReportsTab.jsx (sumber kebenaran existing).
      data.totalDeductions += Number(exp.amount) || 0;
    }
  });

  let totalBiayaGaji = 0;
  Object.values(perf).forEach(data => {
    const { fullTimeBonusTotal, overtimePayTotal } = summarizeAutoBonuses(data.records, employees);
    const upahKotor = data.basicPay + data.totalAdditions + fullTimeBonusTotal + overtimePayTotal;
    const potonganNonKasbon = data.totalDeductions - data.totalKasbon;
    totalBiayaGaji += upahKotor - potonganNonKasbon;
  });

  return totalBiayaGaji;
}

/**
 * Pisahkan expenses 1 periode jadi 2 kelompok:
 * - belanjaBahanBaku: kategori "Belanja" -> masuk komponen HPP
 * - biayaOperasional: semua kategori LAIN selain "Belanja" dan
 *   "Kasbon Karyawan" -> pengurang Laba Kotor (mis. listrik, sewa, dll)
 *
 * Expenses kategori "Kasbon Karyawan" tidak masuk ke belanjaBahanBaku
 * maupun biayaOperasional — kasbon adalah piutang ke karyawan, bukan
 * pengeluaran usaha. Satu-satunya tempat kasbon relevan adalah
 * getTotalBiayaGaji() di atas (untuk menyamakan angka dengan
 * totalDeductions di ReportsTab.jsx), dan di situ pun kasbon tidak pernah
 * ikut menjadi biaya.
 *
 * Dikembalikan juga breakdown per-kategori untuk biaya operasional,
 * supaya UI bisa nampilin rincian, bukan cuma angka total.
 */
export function splitExpenses(expenses, period) {
  const periodExpenses = activeOnly(expenses)
    .filter(exp => toLocalMonthString(exp.date) === period);

  let belanjaBahanBaku = 0;
  let biayaOperasional = 0;
  const operasionalByCategory = {};

  for (const exp of periodExpenses) {
    const amount = Number(exp.amount) || 0;

    if (exp.category === KASBON_CATEGORY) {
      continue; // kasbon bukan biaya, tidak dihitung di sini — lihat docblock di atas
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
    operasionalByCategory, // { "Biaya": 2500000, "Lain-lain": 650000, ... }
  };
}

/**
 * Rumus inti Laba Rugi.
 *
 *   HPP          = Stok Awal + Belanja Bahan Baku − Stok Akhir
 *   Laba Kotor   = Penghasilan − HPP
 *   Laba Bersih  = Laba Kotor − Biaya Operasional − Biaya Gaji
 *
 * stokAwalValue / stokAkhirValue diteruskan dari luar (hasil
 * stockOpnameLogic.js) — fungsi ini sengaja tidak tahu-menahu soal
 * stok opname, supaya tetap reusable meski sumber stok berubah nanti.
 */
export function computeBalance({
  penghasilan,
  belanjaBahanBaku,
  biayaOperasional,
  biayaGaji,
  stokAwalValue,
  stokAkhirValue,
}) {
  const hpp = (Number(stokAwalValue) || 0) + belanjaBahanBaku - (Number(stokAkhirValue) || 0);
  const labaKotor = penghasilan - hpp;
  const labaBersih = labaKotor - biayaOperasional - biayaGaji;

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
export function getBalanceSummary(salesHistory, expenses, employeeDailyRecords, employees, period, stok = {}) {
  const penghasilan = getTotalPenghasilan(salesHistory, period);
  const { belanjaBahanBaku, biayaOperasional, operasionalByCategory } = splitExpenses(expenses, period);
  const biayaGaji = getTotalBiayaGaji(employeeDailyRecords, expenses, employees, period);

  const hasil = computeBalance({
    penghasilan,
    belanjaBahanBaku,
    biayaOperasional,
    biayaGaji,
    stokAwalValue: stok.stokAwalValue || 0,
    stokAkhirValue: stok.stokAkhirValue || 0,
  });

  return {
    period,
    penghasilan,
    belanjaBahanBaku,
    biayaOperasional,
    biayaGaji,
    operasionalByCategory,
    ...hasil,
  };
}

/**
 * Versi RINCI dari splitExpenses/getTotalBiayaGaji — dipakai khusus untuk
 * tab "Rincian" (bukan dashboard ringkas BalanceTab). Mengembalikan grup
 * per kategori LENGKAP dengan daftar transaksi mentah di dalamnya, supaya
 * UI bisa expand tiap grup untuk lihat satu-satu.
 *
 * Sengaja dipisah dari getBalanceSummary supaya dashboard utama tidak perlu
 * memproses/menyimpan daftar transaksi mentah kalau cuma butuh subtotal.
 */
export function getBalanceDetail(salesHistory, expenses, employeeDailyRecords, employees, period) {
  const periodExpenses = activeOnly(expenses)
    .filter(exp => toLocalMonthString(exp.date) === period);

  // ── Belanja Bahan Baku: grup per kategori (hanya ada 1 kategori,
  //    "Belanja", tapi tetap dibentuk sebagai grup untuk konsistensi
  //    bentuk data dengan biayaOperasionalGroups) ──────────────────────
  const bahanBakuTransactions = periodExpenses
    .filter(exp => exp.category === BAHAN_BAKU_CATEGORY)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const belanjaBahanBakuGroups = bahanBakuTransactions.length > 0
    ? [{
        category: BAHAN_BAKU_CATEGORY,
        total: bahanBakuTransactions.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        transactions: bahanBakuTransactions,
      }]
    : [];

  // ── Biaya Operasional: grup per kategori (semua kategori expense
  //    selain "Belanja" dan "Kasbon Karyawan") ─────────────────────────
  const operasionalByCategoryMap = {};
  periodExpenses.forEach(exp => {
    if (exp.category === BAHAN_BAKU_CATEGORY || exp.category === KASBON_CATEGORY) return;
    if (!operasionalByCategoryMap[exp.category]) operasionalByCategoryMap[exp.category] = [];
    operasionalByCategoryMap[exp.category].push(exp);
  });

  const biayaOperasionalGroups = Object.entries(operasionalByCategoryMap)
    .map(([category, transactions]) => ({
      category,
      total: transactions.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      transactions: transactions.sort((a, b) => new Date(a.date) - new Date(b.date)),
    }))
    .sort((a, b) => b.total - a.total); // kategori dengan biaya terbesar duluan

  // ── Biaya Gaji: grup per karyawan ────────────────────────────────────
  const periodRecords = activeOnly(employeeDailyRecords)
    .filter(rec => toLocalMonthString(rec.date) === period);

  const perEmployee = {}; // employeeId -> { basicPay, totalAdditions, totalDeductions, totalKasbon, records }
  const ensure = (employeeId) => {
    if (!perEmployee[employeeId]) {
      perEmployee[employeeId] = { basicPay: 0, totalAdditions: 0, totalDeductions: 0, totalKasbon: 0, records: [] };
    }
    return perEmployee[employeeId];
  };

  periodRecords.forEach(rec => {
    const data = ensure(rec.employeeId);
    data.records.push(rec);

    const recEmp = resolveEmployeeForRecord(rec, employees);
    data.basicPay += (rec.hoursWorked || 0) * (recEmp?.hourlyRate || 0);
    data.totalAdditions += (rec.additions || [])
      .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
      .reduce((sum, a) => sum + a.amount, 0);
    data.totalDeductions += (rec.deductions || []).reduce((sum, d) => sum + d.amount, 0);
  });

  activeOnly(expenses || []).forEach(exp => {
    if (
      exp.employeeId &&
      toLocalMonthString(exp.date) === period &&
      exp.category === KASBON_CATEGORY
    ) {
      const data = ensure(exp.employeeId);
      data.totalKasbon += Number(exp.amount) || 0;
      data.totalDeductions += Number(exp.amount) || 0;
    }
  });

  const biayaGajiGroups = Object.entries(perEmployee)
    .map(([employeeId, data]) => {
      const emp = employees.find(e => e.id === employeeId);
      const { fullTimeBonusTotal, overtimePayTotal } = summarizeAutoBonuses(data.records, employees);
      const upahKotor = data.basicPay + data.totalAdditions + fullTimeBonusTotal + overtimePayTotal;
      const potonganNonKasbon = data.totalDeductions - data.totalKasbon;
      const total = upahKotor - potonganNonKasbon;

      return {
        employeeId,
        employeeName: emp?.name || 'Karyawan (tidak ditemukan)',
        total,
        basicPay: data.basicPay,
        fullTimeBonusTotal,
        overtimePayTotal,
        totalAdditions: data.totalAdditions,
        totalKasbon: data.totalKasbon, // ditampilkan sebagai info, tidak mengurangi total
        hariKerja: data.records.length,
        records: data.records.sort((a, b) => new Date(a.date) - new Date(b.date)),
      };
    })
    .sort((a, b) => b.total - a.total); // karyawan dengan biaya terbesar duluan

  return {
    period,
    belanjaBahanBakuGroups,
    biayaOperasionalGroups,
    biayaGajiGroups,
  };
}