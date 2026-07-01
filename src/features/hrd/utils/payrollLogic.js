export const WORK_START_MINUTES = 9 * 60;
export const WORK_END_MINUTES = 19 * 60;
export const EARLY_OVERTIME_THRESHOLD_MINUTES = WORK_START_MINUTES - 30;
export const OVERTIME_THRESHOLD_MINUTES = WORK_END_MINUTES + 30;
export const OVERTIME_RATE_PER_30MIN = 5000;

// Tarif lembur per 30 menit milik karyawan (diisi di Manajemen Karyawan).
// Kalau karyawan belum punya tarif sendiri, fallback ke tarif default di atas (Rp5.000/30 menit).
export function getOvertimeRate(emp) {
  const rate = Number(emp?.overtimeRate30);
  return rate > 0 ? rate : OVERTIME_RATE_PER_30MIN;
}

// Nominal uang lembur = jumlah blok 30 menit (dibulatkan ke bawah) x tarif per 30 menit.
export function calculateOvertimePay(overtimeMinutes, ratePer30Min) {
  return Math.floor((overtimeMinutes || 0) / 30) * ratePer30Min;
}

export const LEMBUR_CATEGORY_KEYWORD = 'lembur';
export const KASBON_CATEGORY_KEYWORD = 'kasbon';

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif', badgeVariant: 'success' },
  { value: 'freelance', label: 'Freelance', badgeVariant: 'info' },
  { value: 'cuti', label: 'Cuti', badgeVariant: 'warning' },
  { value: 'resign', label: 'Resign', badgeVariant: 'neutral' },
];

export function getEmployeeStatus(emp) {
  return emp?.status || 'aktif';
}

export function getEmployeeStatusInfo(status) {
  return EMPLOYEE_STATUS_OPTIONS.find(s => s.value === status) || EMPLOYEE_STATUS_OPTIONS[0];
}

export function calculateHoursFromTimes(clockInStr, clockOutStr) {
  const [inHours, inMinutes] = clockInStr.split(':').map(Number);
  const [outHours, outMinutes] = clockOutStr.split(':').map(Number);

  const totalInMinutes = (inHours * 60) + inMinutes;
  let totalOutMinutes = (outHours * 60) + outMinutes;

  if (totalOutMinutes < totalInMinutes) {
    totalOutMinutes += 24 * 60;
  }

  const diffMinutes = totalOutMinutes - totalInMinutes;
  return Number((diffMinutes / 60).toFixed(2));
}

export function formatTimeFromDate(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeStrToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}

export function getClockOutMinutesContinuous(clockInStr, clockOutStr) {
  const inTotal = timeStrToMinutes(clockInStr);
  let outTotal = timeStrToMinutes(clockOutStr);
  if (outTotal < inTotal) outTotal += 24 * 60;
  return outTotal;
}

export function calculateBolongMinutes(sortedLogs, fallbackEndDate = null) {
  let totalMinutes = 0;
  for (let i = 0; i < sortedLogs.length; i++) {
    if (sortedLogs[i].type === 'bolong') {
      const nextLog = sortedLogs[i + 1];
      const gapEndDate = nextLog ? new Date(nextLog.date) : fallbackEndDate;
      if (!gapEndDate) continue;
      const gapStart = new Date(sortedLogs[i].date).getTime();
      const gapEnd = gapEndDate.getTime();
      totalMinutes += Math.max(0, (gapEnd - gapStart) / 60000);
    }
  }
  return totalMinutes;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  AUTO ADJUSTMENT (Bonus Full Time & Bonus Lembur)                */
/*                                                                   */
/*  Dipindahin ke sini (dari InputDailyTab) supaya jadi SATU sumber  */
/*  kebenaran yang bisa dipanggil dari mana aja: auto-sync absensi,  */
/*  modal edit manual, ataupun form input manual — hasilnya selalu  */
/*  konsisten gak peduli jalur datanya dari mana.                    */
/* ═══════════════════════════════════════════════════════════════ */

// Kategori adjustment yang dihitung otomatis oleh sistem (bukan input manual admin).
// Item dengan kategori ini gak boleh dihapus manual lewat UI (lihat isAuto check di AdjRow).
export const AUTO_ADJUSTMENT_CATEGORIES = ['Bonus Full Time', 'Bonus Lembur'];

/**
 * Hitung ulang item adjustment otomatis (Bonus Full Time & Bonus Lembur)
 * berdasarkan data absensi (clockIn/clockOut/overtimeMinutes/isDayOff) dan
 * konfigurasi karyawan (fullTimeBonus, overtimeRate30).
 *
 * Pure function — gak nyimpen state, gak peduli record-nya berasal dari mana
 * (auto-sync, edit manual, dst). Selalu menghitung ulang dari data kanonik.
 *
 * @param {object} record - minimal punya: isDayOff, clockIn, clockOut, overtimeMinutes
 * @param {object} emp - data karyawan, minimal punya: fullTimeBonus, overtimeRate30
 * @returns {Array} array item adjustment otomatis (bisa kosong kalau gak eligible)
 */
export function computeAutoAdjustments(record, emp) {
  const items = [];
  if (!record || record.isDayOff || !record.clockIn || !record.clockOut || !emp) {
    return items;
  }

  // Bonus Full Time: masuk ≤ jam mulai kerja & pulang ≥ jam tutup kerja.
  const bonusAmount = Number(emp.fullTimeBonus) || 0;
  const outMinutesContinuous = getClockOutMinutesContinuous(record.clockIn, record.clockOut);
  const eligibleFullTime =
    timeStrToMinutes(record.clockIn) <= WORK_START_MINUTES &&
    outMinutesContinuous >= WORK_END_MINUTES;

  if (eligibleFullTime && bonusAmount > 0) {
    items.push({
      id: `auto-fulltime-${record.employeeId || 'x'}-${record.dateStr || 'x'}`,
      category: 'Bonus Full Time',
      amount: bonusAmount,
      note: '(Masuk ≤ 09:00 & Pulang ≥ 19:00)',
      expenseRecorded: false,
    });
  }

  // Bonus Lembur: dihitung per blok 30 menit dari overtimeMinutes, lewat
  // calculateOvertimePay() yang sama dipakai di Reports & Payslip — supaya
  // formulanya cuma ada SATU implementasi di seluruh aplikasi.
  const overtimeRate = getOvertimeRate(emp);
  const lemburPay = calculateOvertimePay(record.overtimeMinutes, overtimeRate);
  if (lemburPay > 0) {
    const paidMinutes = Math.floor((record.overtimeMinutes || 0) / 30) * 30;
    items.push({
      id: `auto-lembur-${record.employeeId || 'x'}-${record.dateStr || 'x'}`,
      category: 'Bonus Lembur',
      amount: lemburPay,
      note: `(${paidMinutes} menit · Rp${overtimeRate.toLocaleString('id-ID')}/30m)`,
      expenseRecorded: false,
    });
  }

  return items;
}

/**
 * Gabungkan item manual yang sudah ada (kasbon, bonus custom dari admin, dll)
 * dengan item otomatis yang dihitung ULANG dari data terkini. Item auto yang
 * lama (kalau ada, dari hitungan sebelumnya) selalu dibuang dulu lalu diganti
 * yang baru — jadi idempotent, aman dipanggil berkali-kali dari mana pun.
 *
 * @param {Array} existingAdditions - additions yang sudah ada (manual + auto lama)
 * @param {object} record - data absensi terkini, lihat computeAutoAdjustments
 * @param {object} emp - data karyawan terkini
 * @returns {Array} additions final (manual asli + auto terbaru)
 */
export function mergeAutoAdjustments(existingAdditions, record, emp) {
  const manualOnly = (existingAdditions || []).filter(
    a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category)
  );
  const freshAutoItems = computeAutoAdjustments(record, emp);
  return [...manualOnly, ...freshAutoItems];
}

/* ═══════════════════════════════════════════════════════════════ */
/*  REKAP & SLIP GAJI — helper bareng buat ReportsTab & Payslip      */
/*                                                                   */
/*  Dulu Bonus Lembur SELALU dihitung ulang pakai tarif terkini di   */
/*  ReportsTab, tapi Bonus Full Time malah dipercaya dari cache lama */
/*  di rec.additions — jadi kalau fullTimeBonus diubah belakangan,   */
/*  cuma Lembur yang ikut update, Full Time bisa nyangkut basi.      */
/*  Kedua bonus auto sekarang lewat computeAutoAdjustments() yang    */
/*  sama, jadi keduanya selalu fresh & konsisten satu sama lain.     */
/* ═══════════════════════════════════════════════════════════════ */

/**
 * Hitung total Bonus Full Time & Bonus Lembur (data + tarif TERKINI milik
 * emp) dari sekumpulan record harian dalam 1 periode laporan.
 *
 * @param {Array} records - employeeDailyRecords milik 1 karyawan dalam periode
 * @param {object} emp - data karyawan TERKINI (bukan snapshot lama)
 * @returns {{fullTimeBonusTotal:number, overtimePayTotal:number, overtimeRate:number, overtimeByDay:Array}}
 */
export function summarizeAutoBonuses(records, emp) {
  const overtimeRate = getOvertimeRate(emp);
  let fullTimeBonusTotal = 0;
  let overtimePayTotal = 0;
  const overtimeByDay = [];

  (records || []).forEach(rec => {
    computeAutoAdjustments(rec, emp).forEach(item => {
      if (item.category === 'Bonus Full Time') {
        fullTimeBonusTotal += item.amount;
      } else if (item.category === 'Bonus Lembur') {
        overtimePayTotal += item.amount;
        overtimeByDay.push({ dateStr: rec.dateStr, overtimeMinutes: rec.overtimeMinutes || 0, pay: item.amount });
      }
    });
  });

  overtimeByDay.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
  return { fullTimeBonusTotal, overtimePayTotal, overtimeRate, overtimeByDay };
}

/**
 * Hitung jumlah hari masuk kerja (hoursWorked > 0) dalam sekumpulan record.
 * Dipakai di Payslip untuk baris "Hari Kerja Masuk".
 */
export function countWorkDays(records) {
  return (records || []).filter(r => r.hoursWorked > 0).length;
}

/**
 * Bangun baris "Rincian Pemasukan & Pengeluaran Harian" buat slip gaji.
 * SATU sumber kebenaran yang dipakai bareng oleh tampilan layar
 * (PayslipModal) & dokumen PDF (PayslipPDFDocument) supaya angka yang
 * dilihat admin di layar dan yang didownload/dibagikan selalu identik.
 *
 * @param {object} data - 1 item employeePerformance hasil ReportsTab
 *   (punya: employee, records, overtimeRate)
 * @returns {Array<{rec:object, items:Array<{desc:string,in:number,out:number}>}>}
 */
export function buildPayslipRows(data) {
  const sortedRecords = [...(data.records || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  return sortedRecords
    .map(rec => {
      const items = [];

      if (rec.hoursWorked > 0) {
        items.push({
          desc: `Upah Jam Kerja (${rec.hoursWorked} Jam)`,
          in: rec.hoursWorked * data.employee.hourlyRate,
          out: 0,
        });
      }

      // Bonus Full Time & Bonus Lembur dihitung ulang dari data + tarif
      // TERKINI (computeAutoAdjustments), bukan dari cache rec.additions —
      // jadi slip gaji gak pernah nampilin angka basi.
      computeAutoAdjustments(rec, data.employee).forEach(auto => {
        const desc = auto.category === 'Bonus Lembur'
          ? `Uang Lembur (${((rec.overtimeMinutes || 0) / 60).toFixed(1).replace('.', ',')} jam)`
          : auto.category + (auto.note ? ` ${auto.note}` : '');
        items.push({ desc, in: auto.amount, out: 0 });
      });

      (rec.additions || [])
        .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
        .forEach(a => items.push({ desc: a.category + (a.note ? ` (${a.note})` : ''), in: a.amount, out: 0 }));

      (rec.deductions || [])
        .forEach(d => items.push({ desc: d.category + (d.note ? ` (${d.note})` : ''), in: 0, out: d.amount }));

      return { rec, items };
    })
    .filter(row => row.items.length > 0);
}