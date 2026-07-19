import { createSnapshot, resolveSnapshot } from '../../../utils/snapshot';
import { activeOnly } from '../../../utils/softDelete';
import { toLocalDateString } from '../../../utils/formatters';

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

/* ═══════════════════════════════════════════════════════════════ */
/*  SNAPSHOT TARIF KARYAWAN — bikin histori payroll immutable        */
/*                                                                   */
/*  Data karyawan (hourlyRate, overtimeRate30, fullTimeBonus) BOLEH  */
/*  berubah kapan aja (kenaikan gaji, dst). Tapi begitu sebuah       */
/*  employeeDailyRecord dibuat, tarif yang dipakai buat hari itu     */
/*  harus DIBEKUKAN di record itu sendiri — supaya laporan/slip gaji */
/*  bulan lalu gak ikut berubah kalau tarif karyawan diubah hari ini.*/
/*  ID (employeeId) tetap disimpan seperti biasa, snapshot ini cuma  */
/*  nambahin data buat display & kalkulasi, bukan gantiin relasinya. */
/* ═══════════════════════════════════════════════════════════════ */

// Field karyawan yang relevan buat kalkulasi payroll & perlu dibekukan.
// Nambah field baru yang perlu di-snapshot? Cukup tambahin di sini —
// semua tempat yang pakai snapshotEmployeeForPayroll()/resolveEmployeeForRecord()
// otomatis ikut kebawa, gak perlu diubah satu-satu.
export const EMPLOYEE_PAYROLL_SNAPSHOT_FIELDS = ['name', 'hourlyRate', 'overtimeRate30', 'fullTimeBonus'];

/** Bekukan data karyawan TERKINI jadi snapshot buat ditempel ke 1 record histori. */
export function snapshotEmployeeForPayroll(emp) {
  return createSnapshot(emp, EMPLOYEE_PAYROLL_SNAPSHOT_FIELDS);
}

/**
 * Resolve "data karyawan efektif" buat 1 record (employeeDailyRecord, dkk):
 * prioritaskan snapshot yang sudah dibekukan di record itu sendiri, baru
 * fallback ke data karyawan LIVE (by employeeId) kalau record-nya belum
 * punya snapshot — supaya record lama (dibuat sebelum fitur ini ada) tetap
 * kebaca normal sampai tersentuh lagi (disimpan/diedit) dan otomatis
 * kebekukan jadi snapshot permanen saat itu.
 *
 * @param {object} record - record yang punya employeeId (& mungkin employeeSnapshot)
 * @param {Array} employees - array data karyawan TERKINI (dari AppContext)
 * @returns {object|null}
 */
export function resolveEmployeeForRecord(record, employees) {
  return resolveSnapshot(record, 'employeeSnapshot', employees, 'employeeId');
}

/**
 * Dedup employeeDailyRecords per (employeeId, dateStr) — ambil SATU record
 * terbaru saja per hari per karyawan.
 *
 * KENAPA INI PERLU: employeeDailyRecords disinkronkan per-record (upsert by
 * `id`, lihat syncKeys.js TRANSACTION_KEYS). Kalau 2 device sama-sama
 * memicu watchdog auto-attendance (App.jsx/InputDailyTab.jsx) untuk
 * employeeId+dateStr yang sama SEBELUM realtime sync sempat menyebarkan
 * record dari device satu ke device lain, masing-masing device insert
 * record BARU dengan `id` unik sendiri — jadi bukan saling menimpa
 * (upsert-nya sah, id-nya memang beda), tapi hasilnya 2 record valid untuk
 * hari yang sama. Efeknya: kehadiran/keterlambatan/jam kerja hari itu
 * kehitung dobel di semua laporan (Rekap Penggajian, Rekap Kinerja, dst).
 *
 * Dedup dilakukan di titik PEMBACAAN (bukan menghapus data mentahnya),
 * supaya aman dipanggil berkali-kali & gak butuh migrasi data. Record yang
 * dipertahankan = yang `updatedAt`/`updated_at` paling baru; kalau field itu
 * gak ada di keduanya, fallback ke urutan array (record belakangan menang,
 * konsisten dengan pola upsert prevIndex di InputDailyTab.jsx).
 *
 * @param {Array} records - employeeDailyRecords (sudah/belum difilter activeOnly)
 * @returns {Array} records unik per (employeeId, dateStr)
 */
export function dedupeDailyRecords(records) {
  const byKey = new Map();
  (records || []).forEach(rec => {
    if (!rec || !rec.employeeId || !rec.dateStr) return;
    const key = `${rec.employeeId}|${rec.dateStr}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, rec);
      return;
    }
    const existingTime = new Date(existing.updatedAt || existing.updated_at || 0).getTime();
    const currentTime = new Date(rec.updatedAt || rec.updated_at || 0).getTime();
    // Kalau timestamp gak ada di keduanya (0 === 0) atau currentTime lebih
    // baru/sama, menangkan yang belakangan diproses — konsisten dengan
    // upsert prevIndex di InputDailyTab.jsx (record terakhir yang menang).
    if (currentTime >= existingTime) {
      byKey.set(key, rec);
    }
  });
  return Array.from(byKey.values());
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

// Role operasional karyawan — dipakai buat nentuin siapa yang bisa jadi
// "pemegang kas" (cash holder) di modul Pengeluaran/Setoran Kurir.
// Simple & satu role per karyawan (bukan multi-role) sesuai kebutuhan saat ini.
export const EMPLOYEE_ROLE_OPTIONS = [
  { value: 'kasir', label: 'Kasir', badgeVariant: 'info' },
  { value: 'kurir', label: 'Kurir', badgeVariant: 'warning' },
];

export function getEmployeeRole(emp) {
  return emp?.role || 'kasir';
}

export function getEmployeeRoleInfo(role) {
  return EMPLOYEE_ROLE_OPTIONS.find(r => r.value === role) || EMPLOYEE_ROLE_OPTIONS[0];
}

// Dipakai di ExpenseView/CashTransfer buat nge-list karyawan yang bisa jadi
// pemegang kas kurir. Cuma karyawan aktif yang boleh dipilih.
export function getActiveCouriers(employees) {
  return (employees || []).filter(e => getEmployeeRole(e) === 'kurir' && getEmployeeStatus(e) !== 'resign');
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

/**
 * Hitung menit kerja NORMAL (yang dibayar pakai upah per jam) — TIDAK
 * termasuk porsi waktu yang sudah dibayar sebagai uang lembur
 * (earlyOvertimeMins / lateOvertimeMins).
 *
 * Sebelumnya hoursWorked dihitung dari SELURUH rentang clock-in–clock-out,
 * jadi menit yang masuk kategori lembur ikut kehitung juga di jam kerja
 * biasa → karyawan dibayar dua kali untuk menit yang sama (upah per jam +
 * uang lembur). Fungsi ini motong porsi lembur itu dari jam kerja normal,
 * biar cuma dibayar sekali lewat uang lembur.
 */
export function calculateRegularMinutes(clockInStr, clockOutStr, earlyOvertimeMins, lateOvertimeMins) {
  const inMins = timeStrToMinutes(clockInStr);
  const outMinsContinuous = getClockOutMinutesContinuous(clockInStr, clockOutStr);

  // Kalau ada lembur pagi, jam kerja normal mulai dihitung dari jam masuk
  // resmi (WORK_START_MINUTES), bukan dari jam masuk aktual yang lebih pagi.
  const regularInMins = earlyOvertimeMins > 0 ? WORK_START_MINUTES : inMins;
  // Kalau ada lembur sore, jam kerja normal berhenti dihitung di jam
  // pulang resmi (WORK_END_MINUTES), bukan di jam pulang aktual yang lebih malam.
  const regularOutMins = lateOvertimeMins > 0 ? WORK_END_MINUTES : outMinsContinuous;

  return Math.max(0, regularOutMins - regularInMins);
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

/**
 * Resolve status kehadiran 1 karyawan pada 1 tanggal berdasarkan
 * attendanceLog mentah. Dipindahin ke sini (dari InputDailyTab, dulu private
 * function) supaya jadi SATU sumber kebenaran yang bisa dipanggil dari mana
 * aja — InputDailyTab (Rekap Penggajian & Kinerja) MAUPUN App.jsx (watchdog
 * backfill "Libur" di level root, lihat App.jsx) — hasilnya selalu konsisten
 * gak peduli jalur pemanggilnya.
 *
 * Cabang `isPastCloseHour` di bawah ini BULLETPROOF/LAZY: dihitung ulang tiap
 * kali fungsi ini dipanggil berdasarkan `dateStr` vs tanggal SEKARANG — jadi
 * gak butuh app kebuka pas jam tertentu buat "menangkap" statusnya. Ini
 * sengaja disamakan pola dengan auto clock-out (uang lembur/jam pulang
 * otomatis) yang juga lazy-computed, bukan bergantung watchdog interval saja.
 *
 * Ambang jamnya SENGAJA dirujuk dari WORK_END_MINUTES (bukan angka 19
 * literal) — supaya kalau nanti jam tutup toko berubah (mis. jadi setting
 * yang bisa diubah dari UI), cabang ini otomatis ikut menyesuaikan tanpa
 * perlu diingat-ingat untuk diedit manual di tempat terpisah.
 */
export function computeAttendanceFromLogs(employeeId, dateStr, logs) {
  const todayStr = toLocalDateString();
  const isPastCloseHour = (dateStr < todayStr) ||
    (dateStr === todayStr && new Date().getHours() >= WORK_END_MINUTES / 60);

  const empLogs = activeOnly(logs ?? [])
    .filter(r => r.employeeId === employeeId && r.dateStr === dateStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const hasMasuk = empLogs.some(r => r.type === 'masuk');
  const hasLibur = empLogs.some(r => r.type === 'libur');

  let status = '', cIn = '', cOut = '', cBolong = 0, cHours = 0, cDayOff = false, cOvertime = 0;

  if (hasLibur) {
    status = 'Libur'; cDayOff = true;
  } else if (hasMasuk) {
    status = 'Hadir';
    const masukRec = empLogs.find(r => r.type === 'masuk');
    const keluarRec = [...empLogs].reverse().find(r => r.type === 'keluar');
    cIn = formatTimeFromDate(masukRec.date);
    if (keluarRec) {
      cOut = formatTimeFromDate(keluarRec.date);
      const bolongFallbackEnd = new Date(`${dateStr}T${cOut}:00`);
      cBolong = calculateBolongMinutes(empLogs, bolongFallbackEnd);
      const inMins = timeStrToMinutes(cIn);
      const outMins = timeStrToMinutes(cOut);
      const earlyOvertimeMins = inMins <= EARLY_OVERTIME_THRESHOLD_MINUTES ? WORK_START_MINUTES - inMins : 0;
      const lateOvertimeMins = outMins >= OVERTIME_THRESHOLD_MINUTES ? outMins - WORK_END_MINUTES : 0;
      cOvertime = earlyOvertimeMins + lateOvertimeMins;
      const regularMinutes = calculateRegularMinutes(cIn, cOut, earlyOvertimeMins, lateOvertimeMins);
      const rawHours = Number((regularMinutes / 60).toFixed(2));
      const netHours = Number((rawHours - (cBolong / 60)).toFixed(4));
      cHours = netHours > 0 ? Math.ceil(netHours * 10) / 10 : 0;
    } else {
      cBolong = calculateBolongMinutes(empLogs, new Date());
      cOut = '';
    }
  } else if (isPastCloseHour) {
    status = 'Libur'; cDayOff = true;
  } else {
    status = 'Belum Absen';
  }

  return { status, clockIn: cIn, clockOut: cOut, bolongMinutes: cBolong, hoursWorked: cHours, overtimeMinutes: cOvertime, isDayOff: cDayOff, hasMasuk };
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
/*  [UPDATE] Sebelumnya Bonus Full Time & Bonus Lembur SELALU        */
/*  dihitung ulang pakai tarif karyawan TERKINI (satu `emp` yang     */
/*  sama buat semua record) — konsisten satu sama lain, tapi jadi    */
/*  "mutable history": kalau tarif/fullTimeBonus karyawan diubah,    */
/*  SEMUA laporan bulan-bulan sebelumnya ikut berubah juga.          */
/*                                                                   */
/*  Sekarang tarif di-resolve PER RECORD lewat                       */
/*  resolveEmployeeForRecord() — prioritas ke rec.employeeSnapshot   */
/*  (tarif yang dibekukan saat record itu dibuat), fallback ke data  */
/*  karyawan live cuma buat record lama yang belum punya snapshot.   */
/*  Konsistensi Full Time & Lembur tetap terjaga (sama-sama lewat    */
/*  computeAutoAdjustments di setiap record), tapi sekarang juga     */
/*  immutable terhadap perubahan tarif di kemudian hari.             */
/* ═══════════════════════════════════════════════════════════════ */

/**
 * Hitung total Bonus Full Time & Bonus Lembur dari sekumpulan record harian
 * dalam 1 periode laporan. Tarif dipakai PER RECORD (snapshot-nya masing-
 * masing kalau ada), bukan satu tarif tunggal buat semua record — supaya
 * tetap akurat walau tarif karyawan berubah di tengah periode laporan.
 *
 * @param {Array} records - employeeDailyRecords milik 1 karyawan dalam periode
 * @param {Array} employees - array data karyawan TERKINI (buat fallback record lama)
 * @returns {{fullTimeBonusTotal:number, overtimePayTotal:number, overtimeRate:number, overtimeByDay:Array}}
 */
export function summarizeAutoBonuses(records, employees) {
  let fullTimeBonusTotal = 0;
  let overtimePayTotal = 0;
  const overtimeByDay = [];
  let representativeRate = OVERTIME_RATE_PER_30MIN; // buat label header slip gaji

  (records || []).forEach(rec => {
    const emp = resolveEmployeeForRecord(rec, employees);
    representativeRate = getOvertimeRate(emp);
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
  return { fullTimeBonusTotal, overtimePayTotal, overtimeRate: representativeRate, overtimeByDay };
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
 *   (punya: employee, employees, records, overtimeRate)
 * @returns {Array<{rec:object, items:Array<{desc:string,in:number,out:number}>}>}
 */
export function buildPayslipRows(data) {
  const sortedRecords = [...(data.records || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  const rows = sortedRecords.map(rec => {
    const items = [];
    // Tarif dipakai PER RECORD (prioritas ke snapshot yang dibekukan di
    // record itu sendiri) — bukan data.employee tunggal — supaya baris
    // "Upah Jam Kerja" tiap hari tetap akurat walau tarif berubah di
    // tengah periode, dan gak ikut berubah kalau tarif diedit belakangan.
    const emp = resolveEmployeeForRecord(rec, data.employees) || data.employee;

    if (rec.hoursWorked > 0) {
      items.push({
        desc: `Upah Jam Kerja (${rec.hoursWorked} Jam)`,
        in: rec.hoursWorked * (emp?.hourlyRate || 0),
        out: 0,
      });
    }

    computeAutoAdjustments(rec, emp).forEach(auto => {
      const desc = auto.category === 'Bonus Lembur'
        ? `Uang Lembur (${((rec.overtimeMinutes || 0) / 60).toFixed(1).replace('.', ',')} jam)`
        : auto.category + (auto.note ? ` ${auto.note}` : '');
      items.push({ desc, in: auto.amount, out: 0 });
    });

    (rec.additions || [])
      .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
      .forEach(a => {
        items.push({ desc: a.category + (a.note ? ` (${a.note})` : ''), in: a.amount, out: 0 });
      });

    (rec.deductions || []).forEach(d => {
      items.push({ desc: d.category + (d.note ? ` (${d.note})` : ''), in: 0, out: d.amount });
    });

    // Tanggal libur yang gak punya tambahan/potongan apa pun bakal punya
    // items kosong — kalau dibiarkan, baris tanggal itu jadi HILANG total
    // dari tabel payslip (karena rendering-nya nge-loop lewat items).
    // Supaya tanggal liburnya tetap kelihatan di slip gaji, kasih 1 baris
    // keterangan "Libur" tanpa nominal.
    if (items.length === 0 && rec.isDayOff) {
      items.push({ desc: 'Libur', in: 0, out: 0 });
    }

    // [+] PERBAIKAN: Mengembalikan format ke bentuk { rec, items }
    return { rec, items }; 
  });

  if (data.kasbonRecords && data.kasbonRecords.length > 0) {
    data.kasbonRecords.forEach(kasbon => {
      // Ambil format YYYY-MM-DD dari tanggal kasbon untuk pencocokan record
      const kDate = new Date(kasbon.date);
      const y = kDate.getFullYear();
      const m = String(kDate.getMonth() + 1).padStart(2, '0');
      const d = String(kDate.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${d}`;

      // Cari record hari terkait lewat rec.dateStr — ini satu-satunya field
      // yang reliable dipakai buat matching tanggal di seluruh app (semua
      // row, baik dari data.records maupun phantom row kasbon di bawah,
      // selalu punya dateStr yang valid). Sebelumnya ada fallback
      // `r.rec.date.startsWith(dateString)`, tapi itu nganggep rec.date
      // selalu berupa string — padahal begitu direvive dari Dexie, rec.date
      // itu objek Date, dan Date gak punya method .startsWith(), jadi malah
      // crash ("...date.startsWith is not a function") tiap kali kasbon-nya
      // bukan di record paling awal periode laporan.
      const existingRow = rows.find(r => r.rec.dateStr === dateString);
      
      const kasbonItem = {
        desc: `${kasbon.category}${kasbon.note ? ` (${kasbon.note})` : ''}`,
        in: 0,
        out: kasbon.amount
      };

      if (existingRow) {
        existingRow.items.push(kasbonItem);
      } else {
        // [+] PERBAIKAN: Jika transaksi kasbon terjadi di hari libur, buat record buatan 
        // agar layar slip gaji tidak crash saat mencari jam masuk/keluar
        rows.push({
          rec: {
            id: `kasbon-${kasbon.id}`,
            date: kasbon.date,
            dateStr: dateString,
            clockIn: null, // UI akan otomatis menampilkan '--:--'
            clockOut: null
          },
          items: [kasbonItem]
        });
      }
    });

    // Urutkan ulang secara kronologis
    rows.sort((a, b) => new Date(a.rec.date) - new Date(b.rec.date));
  }

  return rows;
}