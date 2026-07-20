import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString, toLocalMonthString, getWeekRange } from '../../../utils/formatters';
import { Card, Button, Input, Select, EmptyState, SortModal, SegmentedControl, Modal, Textarea } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly } from '../../../utils/softDelete';
import {
  PieChart, Printer, ArrowUpDown, Activity, ChevronDown,
  TrendingUp, Clock, CalendarCheck, AlarmClockOff, Share2, Wallet,
} from 'lucide-react';
import {
  AUTO_ADJUSTMENT_CATEGORIES, summarizeAutoBonuses, resolveEmployeeForRecord,
  WORK_START_MINUTES, timeStrToMinutes, dedupeDailyRecords,
  getOpeningBalance, setOpeningBalance,
} from '../utils/payrollLogic';

// ============================================================================
// Bagian "Rekap Kinerja Karyawan" — helper & konstanta lokal
// ============================================================================

// Toleransi keterlambatan (menit) sebelum dianggap "Telat" — jam masuk resmi
// adalah WORK_START_MINUTES (09:00), dikasih toleransi 5 menit biar variasi
// kecil (mis. selisih detik pembulatan) gak dianggap telat.
const LATE_TOLERANCE_MINUTES = 5;

const isLateRecord = (rec) => {
  if (!rec || rec.isDayOff || !rec.clockIn) return false;
  return timeStrToMinutes(rec.clockIn) > (WORK_START_MINUTES + LATE_TOLERANCE_MINUTES);
};

const performanceFilterModeOptions = [
  { value: 'week', label: 'Mingguan', tone: 'orange' },
  { value: 'range', label: 'Rentang Tanggal', tone: 'orange' },
  { value: 'month', label: 'Per Bulan', tone: 'orange' },
];

const KpiChip = ({ label, value, tone = 'default' }) => {
  const toneClass = {
    default: 'text-slate-700 dark:text-slate-300',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-500 dark:text-red-400',
    orange: 'text-accent-600 dark:text-accent-400',
  }[tone];
  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 py-2.5">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
};

// Header seksi dengan nomor urut kecil — dipakai buat menandai kedua bagian
// report (Penggajian & Kinerja) sebagai satu alur laporan yang sama, bukan
// dua widget lepas yang kebetulan ditumpuk.
const SectionHeader = ({ step, icon, title, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-full bg-accent-100 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400 text-xs font-black flex items-center justify-center shrink-0">{step}</span>
      <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        {icon} {title}
      </h3>
    </div>
    {action}
  </div>
);

const ReportsTab = () => {
  const {
    employees, employeeDailyRecords, expenses, setPayslipModal, setPerfShareModal, formatRupiah,
    openingBalances, setOpeningBalances,
  } = useAppContext();

  // ==========================================================================
  // SECTION 1 — Rekap Penggajian (ringkas, per bulan)
  // ==========================================================================
  const [reportMonth, setReportMonth] = useState(toLocalMonthString());
  const [payrollSortKey, setPayrollSortKey] = useState('name-asc');
  const [isPayrollSortOpen, setIsPayrollSortOpen] = useState(false);
  // Employee yang rincian kasbonnya lagi dibuka (biar gak makan tempat kalau
  // kasbonnya banyak item — user klik buat lihat detail per catatan).
  const [expandedKasbonEmpId, setExpandedKasbonEmpId] = useState(null);
  // Modal "Set Saldo Awal Bulan" — { isOpen, employeeId, employeeName }
  const [openingBalanceModal, setOpeningBalanceModal] = useState({ isOpen: false, employeeId: null, employeeName: '' });
  const [openingBalanceDirection, setOpeningBalanceDirection] = useState('owed_by_employee'); // 'owed_by_employee' | 'owed_to_employee'
  const [openingBalanceAmountInput, setOpeningBalanceAmountInput] = useState('');
  const [openingBalanceNoteInput, setOpeningBalanceNoteInput] = useState('');

  const filteredRecordsForReport = useMemo(() => {
    // Dedup DULU (sebelum filter bulan) — kalau ada record duplikat lintas
    // bulan (jarang, tapi tetap dijaga), dedup per employeeId+dateStr harus
    // jalan di seluruh dataset, bukan cuma di dalam 1 bulan.
    return dedupeDailyRecords(activeOnly(employeeDailyRecords))
      .filter(r => toLocalMonthString(r.date) === reportMonth);
  }, [employeeDailyRecords, reportMonth]);

  const employeePayroll = useMemo(() => {
    const perf = {};
    filteredRecordsForReport.forEach(rec => {
      if (!perf[rec.employeeId]) {
        const emp = resolveEmployeeForRecord(rec, employees);
        perf[rec.employeeId] = {
          // employeeId disimpan terpisah dari `employee` (dipakai buat key React)
          // — supaya tetap stabil walau `employee` di bawah ini adalah objek
          // snapshot polos (gak punya `.id`) atau placeholder "Karyawan Dihapus".
          employeeId: rec.employeeId,
          employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 },
          totalHours: 0,
          totalOvertimeMinutes: 0,
          totalAdditions: 0,
          totalDeductions: 0,
          // Kasbon dipisah dari potongan lain (lihat totalDeductions) supaya
          // gaji bersih hasil kerja dan tagihan kasbon gak tercampur jadi satu
          // angka net yang bisa minus. Kasbon itu piutang perusahaan, bukan
          // pengurang upah — lihat grossPay/netPay di bawah.
          totalKasbon: 0,
          // Rincian per-item kasbon (tanggal, nominal, note) — dipakai buat
          // breakdown di UI supaya jelas asal-usul tiap potongan kasbon,
          // termasuk catatan manual seperti "minus bulan sebelumnya".
          kasbonRecords: [],
          netPay: 0,
          basicPay: 0,
          records: [],
        };
      }
      const data = perf[rec.employeeId];
      data.records.push(rec);

      // hoursWorked sudah dibulatkan ke atas (per 0,1 jam) sekali saat
      // disimpan — jadi tinggal diakumulasi langsung, tanpa perlu dibulatkan
      // ulang lagi di sini.
      data.totalHours += rec.hoursWorked || 0;
      data.totalOvertimeMinutes += rec.overtimeMinutes || 0;

      // Upah dasar dihitung PER RECORD (jam hari itu × tarif yang dibekukan
      // di record itu sendiri) lalu diakumulasi — BUKAN totalHours × 1 tarif
      // tunggal di akhir. Ini yang bikin hasilnya tetap akurat walau tarif
      // karyawan berubah di TENGAH periode laporan (misal naik gaji tgl 15),
      // dan gak ikut berubah kalau tarif diedit belakangan dari laporan bulan
      // lalu — masing-masing hari tetap pakai tarif yang berlaku saat itu.
      const recEmp = resolveEmployeeForRecord(rec, employees);
      data.basicPay += (rec.hoursWorked || 0) * (recEmp?.hourlyRate || 0);

      // Hanya tambahan/potongan MANUAL yang diakumulasi di sini. Bonus Full
      // Time & Bonus Lembur (auto) sengaja dikecualikan & dihitung terpisah
      // di bawah lewat summarizeAutoBonuses — masing-masing record tetap
      // pakai tarif/konfigurasi yang dibekukan waktu record itu dibuat
      // (lihat resolveEmployeeForRecord), bukan data karyawan TERKINI.
      data.totalAdditions += (rec.additions || [])
        .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
        .reduce((sum, a) => sum + a.amount, 0);
      data.totalDeductions += (rec.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    });

    // Kasbon (dari expenses berkategori "Kasbon Karyawan") pada bulan pelaporan.
    const activeExpenses = activeOnly(expenses || []);
    activeExpenses.forEach(exp => {
      if (
        exp.employeeId &&
        toLocalMonthString(exp.date) === reportMonth &&
        (exp.category === 'Kasbon Karyawan' || (exp.category || '').toLowerCase().includes('kasbon'))
      ) {
        if (!perf[exp.employeeId]) {
          const emp = employees.find(e => e.id === exp.employeeId);
          perf[exp.employeeId] = {
            employeeId: exp.employeeId,
            employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 },
            totalHours: 0,
            totalOvertimeMinutes: 0,
            totalAdditions: 0,
            totalDeductions: 0,
            totalKasbon: 0,
            kasbonRecords: [],
            netPay: 0,
            basicPay: 0,
            records: [],
          };
        }
        perf[exp.employeeId].totalDeductions += exp.amount;
        perf[exp.employeeId].totalKasbon += exp.amount;
        perf[exp.employeeId].kasbonRecords.push(exp);
      }
    });

    // Saldo awal bulan ("sisa bulan kemarin") — universal, bisa POSITIF
    // (karyawan berhutang) atau NEGATIF (perusahaan berhutang ke karyawan).
    // Beda dari kasbon: ini bukan transaksi baru di bulan ini, jadi TIDAK
    // masuk totalDeductions/totalKasbon (yang basisnya expense tercatat) —
    // ditambahkan langsung ke netPay di bawah, dan ditampilkan terpisah.
    (activeOnly(openingBalances || [])).forEach(bal => {
      if (bal.month !== reportMonth || !bal.employeeId) return;
      if (!perf[bal.employeeId]) {
        const emp = employees.find(e => e.id === bal.employeeId);
        if (!emp) return; // karyawan sudah dihapus permanen — skip
        perf[bal.employeeId] = {
          employeeId: bal.employeeId,
          employee: emp,
          totalHours: 0,
          totalOvertimeMinutes: 0,
          totalAdditions: 0,
          totalDeductions: 0,
          totalKasbon: 0,
          kasbonRecords: [],
          netPay: 0,
          basicPay: 0,
          records: [],
        };
      }
      perf[bal.employeeId].openingBalance = bal;
    });

    Object.values(perf).forEach(data => {
      const { fullTimeBonusTotal, overtimePayTotal, overtimeRate, overtimeByDay } =
        summarizeAutoBonuses(data.records, employees);

      data.overtimeRate = overtimeRate; // Tarif/30 menit, dipakai juga di Payslip
      data.overtimePay = overtimePayTotal; // Simpan variabel ini untuk dipakai di Payslip
      data.overtimeByDay = overtimeByDay;
      data.totalAdditions += fullTimeBonusTotal + overtimePayTotal;

      // grossPay = gaji bersih HASIL KERJA bulan ini, sebelum dipotong
      // kasbon MAUPUN saldo awal — ini angka yang ditampilkan sebagai "Gaji
      // Bersih" utama, dan yang jadi dasar Total Expenses Payroll (expense
      // akuntansi yang sebenarnya, gak boleh berkurang gara-gara piutang).
      data.grossPay = data.basicPay + data.totalAdditions - (data.totalDeductions - data.totalKasbon);

      // netPay = gaji bersih dikurangi kasbon bulan ini DAN saldo awal.
      // openingBalance.amount positif (karyawan berhutang) ikut MENGURANGI
      // netPay; negatif (perusahaan berhutang) ikut MENAMBAH netPay.
      const openingAmount = data.openingBalance?.amount || 0;
      data.netPay = data.basicPay + data.totalAdditions - data.totalDeductions - openingAmount;

      // Urutkan rincian kasbon per tanggal (lama -> baru) supaya catatan
      // seperti "minus bulan sebelumnya" kelihatan duluan di breakdown.
      data.kasbonRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Dibawa serta buat buildPayslipRows() di Payslip — supaya baris
      // "Upah Jam Kerja" per hari di slip gaji juga resolve tarif per
      // record (bukan cuma total di tabel rekap ini).
      data.employees = employees;
    });

    return Object.values(perf);
  }, [filteredRecordsForReport, employees, expenses, reportMonth, openingBalances]);

  // Total Expenses Payroll = jumlah gaji bersih (sebelum kasbon) semua
  // karyawan. Kasbon TIDAK mengurangi angka ini karena kasbon adalah
  // piutang perusahaan (aset), bukan biaya gaji.
  const totalPayrollExpense = employeePayroll.reduce((sum, p) => sum + p.grossPay, 0);
  const totalKasbonTertagih = employeePayroll.reduce((sum, p) => sum + (p.totalKasbon || 0), 0);
  // Bertanda: positif = total karyawan berhutang, negatif = total
  // perusahaan berhutang ke karyawan (bisa saling menutup, sengaja gak
  // di-Math.abs supaya kelihatan arah bersihnya).
  const totalOpeningBalance = employeePayroll.reduce((sum, p) => sum + (p.openingBalance?.amount || 0), 0);

  const sortedEmployeePayroll = applySort(employeePayroll, payrollSortKey, {
    name: p => p.employee?.name || '',
    netpay: p => p.grossPay || 0,
    hours: p => p.totalHours || 0,
  });

  const payrollSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'netpay-desc', label: 'Gaji Bersih Terbesar' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
  ];

  // Buka modal "Set Saldo Awal Bulan" — prefill dari record existing (kalau
  // ada) supaya edit ulang gak perlu mulai dari nol.
  const openOpeningBalanceModal = (p) => {
    const existing = getOpeningBalance(openingBalances, p.employeeId, reportMonth);
    setOpeningBalanceDirection(existing && existing.amount < 0 ? 'owed_to_employee' : 'owed_by_employee');
    setOpeningBalanceAmountInput(existing ? String(Math.abs(existing.amount)) : '');
    setOpeningBalanceNoteInput(existing?.note || '');
    setOpeningBalanceModal({ isOpen: true, employeeId: p.employeeId, employeeName: p.employee?.name || '' });
  };

  const closeOpeningBalanceModal = () => {
    setOpeningBalanceModal({ isOpen: false, employeeId: null, employeeName: '' });
    setOpeningBalanceAmountInput('');
    setOpeningBalanceNoteInput('');
  };

  const handleSaveOpeningBalance = () => {
    const rawAmount = Number(openingBalanceAmountInput) || 0;
    // Arah nentuin tanda: karyawan berhutang = POSITIF, perusahaan
    // berhutang ke karyawan = NEGATIF. Lihat definisi tanda di
    // payrollLogic.js (openingBalanceId/setOpeningBalance).
    const signedAmount = openingBalanceDirection === 'owed_to_employee' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
    setOpeningBalance(setOpeningBalances, openingBalanceModal.employeeId, reportMonth, signedAmount, openingBalanceNoteInput.trim());
    closeOpeningBalanceModal();
  };

  const handleClearOpeningBalance = () => {
    setOpeningBalance(setOpeningBalances, openingBalanceModal.employeeId, reportMonth, 0, '');
    closeOpeningBalanceModal();
  };

  // ==========================================================================
  // SECTION 2 — Rekap Kinerja Karyawan (periode fleksibel, independen dari
  // filter bulan di Section 1)
  // ==========================================================================
  const [perfFilterMode, setPerfFilterMode] = useState('week'); // 'week' | 'range' | 'month'
  const defaultPerfWeek = useMemo(() => getWeekRange(), []);
  const [perfWeekAnchor, setPerfWeekAnchor] = useState(toLocalDateString());
  const [perfRangeStart, setPerfRangeStart] = useState(defaultPerfWeek.start);
  const [perfRangeEnd, setPerfRangeEnd] = useState(defaultPerfWeek.end);
  const [perfFilterMonth, setPerfFilterMonth] = useState(toLocalMonthString());
  const [perfEmployeeFilter, setPerfEmployeeFilter] = useState('all'); // 'all' | employeeId

  const [perfSortKey, setPerfSortKey] = useState('name-asc');
  const [isPerfSortOpen, setIsPerfSortOpen] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState(null);

  // Rentang tanggal aktual (start/end string "YYYY-MM-DD") berdasarkan mode filter.
  const perfActiveRange = useMemo(() => {
    if (perfFilterMode === 'week') return getWeekRange(perfWeekAnchor);
    if (perfFilterMode === 'range') return { start: perfRangeStart, end: perfRangeEnd };
    // month
    const start = `${perfFilterMonth}-01`;
    const [y, m] = perfFilterMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${perfFilterMonth}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }, [perfFilterMode, perfWeekAnchor, perfRangeStart, perfRangeEnd, perfFilterMonth]);

  const matchesPerfRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (perfActiveRange.start && dateStr < perfActiveRange.start) return false;
    if (perfActiveRange.end && dateStr > perfActiveRange.end) return false;
    return true;
  }, [perfActiveRange]);

  const perfFilteredRecords = useMemo(() => {
    return dedupeDailyRecords(activeOnly(employeeDailyRecords))
      .filter(r => matchesPerfRange(r.dateStr))
      .filter(r => perfEmployeeFilter === 'all' || r.employeeId === perfEmployeeFilter);
  }, [employeeDailyRecords, matchesPerfRange, perfEmployeeFilter]);

  const performance = useMemo(() => {
    const perf = {};

    perfFilteredRecords.forEach(rec => {
      if (!perf[rec.employeeId]) {
        const emp = resolveEmployeeForRecord(rec, employees);
        perf[rec.employeeId] = {
          employeeId: rec.employeeId,
          employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 },
          hariMasuk: 0,
          hariLibur: 0,
          hariTelat: 0,
          totalHours: 0,
          totalOvertimeMinutes: 0,
          totalAdditions: 0,
          totalDeductions: 0,
          totalKasbon: 0,
          basicPay: 0,
          netPay: 0,
          records: [],
          lateDays: [],
        };
      }
      const data = perf[rec.employeeId];
      data.records.push(rec);

      if (rec.isDayOff) {
        data.hariLibur += 1;
      } else if (rec.hoursWorked > 0 || rec.clockIn) {
        data.hariMasuk += 1;
        if (isLateRecord(rec)) {
          data.hariTelat += 1;
          data.lateDays.push({ dateStr: rec.dateStr, clockIn: rec.clockIn });
        }
      }

      data.totalHours += rec.hoursWorked || 0;
      data.totalOvertimeMinutes += rec.overtimeMinutes || 0;

      // Upah dasar per record, pakai tarif yang dibekukan di record itu
      // sendiri (snapshot) — konsisten dengan Section 1, supaya rekap
      // periode lalu gak berubah kalau tarif karyawan diedit belakangan.
      const recEmp = resolveEmployeeForRecord(rec, employees);
      data.basicPay += (rec.hoursWorked || 0) * (recEmp?.hourlyRate || 0);

      data.totalAdditions += (rec.additions || [])
        .filter(a => !AUTO_ADJUSTMENT_CATEGORIES.includes(a.category))
        .reduce((sum, a) => sum + a.amount, 0);
      data.totalDeductions += (rec.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    });

    // Kasbon (dari expenses berkategori "Kasbon Karyawan") dalam rentang aktif.
    const activeExpenses = activeOnly(expenses || []);
    activeExpenses.forEach(exp => {
      if (
        exp.employeeId &&
        (perfEmployeeFilter === 'all' || exp.employeeId === perfEmployeeFilter) &&
        matchesPerfRange(toLocalDateString(exp.date)) &&
        (exp.category === 'Kasbon Karyawan' || (exp.category || '').toLowerCase().includes('kasbon'))
      ) {
        if (!perf[exp.employeeId]) {
          const emp = employees.find(e => e.id === exp.employeeId);
          perf[exp.employeeId] = {
            employeeId: exp.employeeId,
            employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 },
            hariMasuk: 0,
            hariLibur: 0,
            hariTelat: 0,
            totalHours: 0,
            totalOvertimeMinutes: 0,
            totalAdditions: 0,
            totalDeductions: 0,
            totalKasbon: 0,
            basicPay: 0,
            netPay: 0,
            records: [],
            lateDays: [],
          };
        }
        perf[exp.employeeId].totalDeductions += exp.amount;
        perf[exp.employeeId].totalKasbon += exp.amount;
      }
    });

    Object.values(perf).forEach(data => {
      const { fullTimeBonusTotal, overtimePayTotal, overtimeRate, overtimeByDay } =
        summarizeAutoBonuses(data.records, employees);

      data.overtimeRate = overtimeRate;
      data.overtimePay = overtimePayTotal;
      data.fullTimeBonusTotal = fullTimeBonusTotal;
      data.overtimeByDay = overtimeByDay;
      data.totalAdditions += fullTimeBonusTotal + overtimePayTotal;
      data.netPay = data.basicPay + data.totalAdditions - data.totalDeductions;
      data.avgHoursPerWorkDay = data.hariMasuk > 0 ? data.totalHours / data.hariMasuk : 0;
      data.lateDays.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    });

    return Object.values(perf);
  }, [perfFilteredRecords, employees, expenses, matchesPerfRange, perfEmployeeFilter]);

  // Sertakan juga karyawan AKTIF yang tidak punya record sama sekali di
  // periode ini (mis. libur sepanjang periode) — biar kelihatan "0" bukan
  // hilang dari daftar, khususnya berguna untuk rentang mingguan pendek.
  // Kalau lagi filter ke 1 karyawan spesifik, cuma karyawan itu yang
  // di-fallback-in (bukan seluruh karyawan aktif lainnya).
  const performanceWithIdleEmployees = useMemo(() => {
    const coveredIds = new Set(performance.map(p => p.employeeId));
    const idlePool = perfEmployeeFilter === 'all'
      ? activeOnly(employees || []).filter(e => e.status !== 'resign')
      : (employees || []).filter(e => e.id === perfEmployeeFilter);
    const idle = idlePool
      .filter(e => !coveredIds.has(e.id))
      .map(e => ({
        employeeId: e.id,
        employee: e,
        hariMasuk: 0, hariLibur: 0, hariTelat: 0,
        totalHours: 0, totalOvertimeMinutes: 0,
        totalAdditions: 0, totalDeductions: 0, totalKasbon: 0,
        basicPay: 0, netPay: 0, records: [], lateDays: [],
        overtimeRate: 0, overtimePay: 0, fullTimeBonusTotal: 0, overtimeByDay: [],
        avgHoursPerWorkDay: 0,
      }));
    return [...performance, ...idle];
  }, [performance, employees, perfEmployeeFilter]);

  const performanceTotals = useMemo(() => {
    return performanceWithIdleEmployees.reduce((acc, p) => ({
      totalHours: acc.totalHours + p.totalHours,
      totalOvertimeMinutes: acc.totalOvertimeMinutes + p.totalOvertimeMinutes,
      totalNetPay: acc.totalNetPay + p.netPay,
      totalHariTelat: acc.totalHariTelat + p.hariTelat,
    }), { totalHours: 0, totalOvertimeMinutes: 0, totalNetPay: 0, totalHariTelat: 0 });
  }, [performanceWithIdleEmployees]);

  // Total Jam Kerja / Total Lembur / Total Telat itu metrik performa
  // INDIVIDU — menjumlahkannya lintas semua karyawan sekaligus ("Semua
  // Karyawan") gak informatif (mis. "60,4 Jam" gabungan banyak orang
  // kelihatan kayak 1 orang kerja 60 jam). Makanya 3 kartu itu ditampilkan
  // 0 sampai user pilih 1 karyawan spesifik. Total gaji (Expenses Payroll)
  // dikecualikan karena itu memang metrik AGREGAT perusahaan, relevan
  // dilihat gabungan.
  const isSingleEmployeeSelected = perfEmployeeFilter !== 'all';

  const sortedPerformance = applySort(performanceWithIdleEmployees, perfSortKey, {
    name: p => p.employee?.name || '',
    hours: p => p.totalHours || 0,
    netpay: p => p.netPay || 0,
    hadir: p => p.hariMasuk || 0,
    telat: p => p.hariTelat || 0,
  });

  const perfSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
    { key: 'netpay-desc', label: 'Pendapatan Bersih Terbesar' },
    { key: 'hadir-desc', label: 'Hari Masuk Terbanyak' },
    { key: 'telat-desc', label: 'Paling Sering Telat' },
  ];

  // Format "YYYY-MM-DD" -> "Jum, 10 Jul 2026" — dipakai khusus buat label
  // periode aktif, supaya hari & tanggal kelihatan sekaligus (gak cuma
  // angka mentah yang bikin keder harus itung manual itu hari apa).
  const formatTanggalDenganHari = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const perfRangeLabel = perfActiveRange.start === perfActiveRange.end
    ? formatTanggalDenganHari(perfActiveRange.start)
    : `${formatTanggalDenganHari(perfActiveRange.start)} s/d ${formatTanggalDenganHari(perfActiveRange.end)}`;

  const employeeOptions = useMemo(() => {
    return [...(employees || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
  }, [employees]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* ===================== SECTION 1 — REKAP PENGGAJIAN ===================== */}
      <div className="space-y-4">
        <Card className="space-y-4">
          <SectionHeader
            step="1"
            icon={<PieChart className="w-5 h-5 text-accent-600 dark:text-accent-400" />}
            title="Rekap Penggajian"
            action={
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bulan Laporan:</label>
                <div className="w-40"><Input type="month" variant="muted" value={reportMonth} onChange={e => setReportMonth(e.target.value)} /></div>
              </div>
            }
          />
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Rekap Gaji Karyawan</h3>
            <button type="button" onClick={() => setIsPayrollSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 active:scale-95 transition-all duration-300">
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
            </button>
          </div>
          {/* Header grid — 3 kolom sama lebar, sinkron dengan baris data di bawah */}
          <div className="grid grid-cols-3 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <div className="p-4 text-left">Nama Karyawan</div>
            <div className="p-4 text-center">Gaji Bersih (Net)</div>
            <div className="p-4 text-center">Aksi</div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedEmployeePayroll.length === 0 ? (
              <EmptyState size="sm" icon={<PieChart className="w-8 h-8" />} title="Tidak ada data penggajian pada bulan ini." />
            ) : (
              sortedEmployeePayroll.map(p => {
                const hasKasbon = (p.totalKasbon || 0) > 0;
                const isKasbonExpanded = expandedKasbonEmpId === p.employeeId;
                const openingAmount = p.openingBalance?.amount || 0;
                const hasOpeningBalance = openingAmount !== 0;
                return (
                  <div key={p.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors duration-300">
                    <div className="grid grid-cols-3 items-center">
                      <div className="p-4 text-left min-w-0">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{p.employee.name}</p>
                      </div>
                      <div className="p-4 text-center">
                        {/* Gaji bersih HASIL KERJA — sebelum dipotong kasbon.
                            Ini yang selalu jadi angka "Gaji Bersih" utama, dan
                            gak akan pernah minus akibat kasbon. */}
                        <p className="font-black text-slate-900 dark:text-slate-100 text-sm">
                          {formatRupiah(p.grossPay)}
                        </p>
                        {hasKasbon && (
                          <button
                            type="button"
                            onClick={() => setExpandedKasbonEmpId(isKasbonExpanded ? null : p.employeeId)}
                            className="text-[11px] font-semibold text-red-500 dark:text-red-400 mt-1 underline decoration-dotted underline-offset-2 hover:text-red-600 dark:hover:text-red-300"
                          >
                            Potongan kasbon: -{formatRupiah(p.totalKasbon)}
                          </button>
                        )}
                        {hasOpeningBalance && (
                          <p className={`text-[11px] font-semibold mt-1 ${openingAmount > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {openingAmount > 0
                              ? `Sisa bulan lalu: -${formatRupiah(openingAmount)}`
                              : `Sisa ke karyawan: +${formatRupiah(Math.abs(openingAmount))}`}
                          </p>
                        )}
                      </div>
                      <div className="p-4 flex flex-col items-center gap-1.5">
                        <Button variant="ghost" size="sm" icon={<Printer className="w-3 h-3" />} onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })}>Cetak Slip</Button>
                        <button
                          type="button"
                          onClick={() => openOpeningBalanceModal(p)}
                          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors duration-300 ${
                            hasOpeningBalance
                              ? 'text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10'
                              : 'text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Wallet className="w-3 h-3" /> {hasOpeningBalance ? 'Edit Saldo Awal' : 'Saldo Awal'}
                        </button>
                      </div>
                    </div>

                    {/* Rincian per-item kasbon — pakai note apa adanya (mis.
                        "Minus bulan sebelumnya", "Kasbon dompet"), gak ada
                        kategori/label yang di-hardcode di sini. Apapun yang
                        dicatat di tab Pengeluaran otomatis muncul di sini. */}
                    {hasKasbon && isKasbonExpanded && (
                      <div className="px-4 pb-4">
                        <div className="bg-red-50/60 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-2xl divide-y divide-red-100 dark:divide-red-500/10 overflow-hidden">
                          {p.kasbonRecords.map(exp => (
                            <div key={exp.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{toLocalDateString(exp.date)}</p>
                                <p className="text-slate-500 dark:text-slate-400 truncate">{exp.note || 'Tanpa catatan'}</p>
                              </div>
                              <p className="font-bold text-red-500 dark:text-red-400 shrink-0">-{formatRupiah(exp.amount)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {sortedEmployeePayroll.length > 0 && (
            <div className="grid grid-cols-3 items-center bg-slate-900 dark:bg-slate-950 border-t border-slate-800">
              <div className="p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Expenses Payroll</p>
                {totalKasbonTertagih > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Total Kasbon Tertagih</p>
                )}
                {totalOpeningBalance !== 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                    {totalOpeningBalance > 0 ? 'Total Sisa Bulan Lalu' : 'Total Hutang ke Karyawan'}
                  </p>
                )}
              </div>
              <div className="p-4 text-center">
                <p className="font-heading text-lg font-black text-white">{formatRupiah(totalPayrollExpense)}</p>
                {totalKasbonTertagih > 0 && (
                  <p className="font-heading text-xs font-bold text-red-400 mt-1">-{formatRupiah(totalKasbonTertagih)}</p>
                )}
                {totalOpeningBalance !== 0 && (
                  <p className={`font-heading text-xs font-bold mt-1 ${totalOpeningBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {totalOpeningBalance > 0 ? '-' : '+'}{formatRupiah(Math.abs(totalOpeningBalance))}
                  </p>
                )}
              </div>
              <div className="p-4" />
            </div>
          )}
        </Card>

        {/* Modal "Set Saldo Awal Bulan" — universal: bisa karyawan berhutang
            (kasbon nyisa) atau perusahaan berhutang ke karyawan (gaji nyisa
            kurang bayar). Diikat ke reportMonth aktif, jadi laporan bulan
            lain gak ikut berubah kalau ini diedit lagi nanti. */}
        <Modal
          isOpen={openingBalanceModal.isOpen}
          onClose={closeOpeningBalanceModal}
          title={`Saldo Awal — ${openingBalanceModal.employeeName}`}
          size="sm"
        >
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apakah <span className="font-bold">{openingBalanceModal.employeeName}</span> punya sisa dari bulan sebelumnya untuk periode <span className="font-bold">{reportMonth}</span>?
            </p>

            <SegmentedControl
              options={[
                { value: 'owed_by_employee', label: 'Karyawan Berhutang', tone: 'orange' },
                { value: 'owed_to_employee', label: 'Kita Berhutang', tone: 'orange' },
              ]}
              value={openingBalanceDirection}
              onChange={setOpeningBalanceDirection}
              size="sm"
            />

            <Input
              type="number"
              label="Nominal (Rp)"
              variant="muted"
              icon={<span className="font-bold">Rp</span>}
              value={openingBalanceAmountInput}
              onChange={e => setOpeningBalanceAmountInput(e.target.value)}
              placeholder="0"
            />

            <Textarea
              label="Catatan (opsional)"
              variant="muted"
              value={openingBalanceNoteInput}
              onChange={e => setOpeningBalanceNoteInput(e.target.value)}
              placeholder="Mis. Kasbon Juni belum lunas"
              rows={2}
            />

            <div className="flex gap-2 pt-2">
              {getOpeningBalance(openingBalances, openingBalanceModal.employeeId, reportMonth) && (
                <Button variant="ghost-danger" onClick={handleClearOpeningBalance} className="flex-1">
                  Hapus
                </Button>
              )}
              <Button variant="primary" onClick={handleSaveOpeningBalance} className="flex-1">
                Simpan
              </Button>
            </div>
          </div>
        </Modal>

        <SortModal isOpen={isPayrollSortOpen} onClose={() => setIsPayrollSortOpen(false)} value={payrollSortKey} onChange={setPayrollSortKey} options={payrollSortOptions} />
      </div>

      {/* ===================== SECTION 2 — REKAP KINERJA KARYAWAN ===================== */}
      <div className="space-y-4 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
        <Card className="space-y-4">
          <SectionHeader
            step="2"
            icon={<Activity className="w-5 h-5 text-accent-600 dark:text-accent-400" />}
            title="Rekap Kinerja Karyawan"
            action={
              <div className="w-full sm:w-56">
                <Select variant="muted" value={perfEmployeeFilter} onChange={e => setPerfEmployeeFilter(e.target.value)}>
                  <option value="all">Semua Karyawan</option>
                  {employeeOptions.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}{emp.status === 'resign' ? ' (Resign)' : ''}</option>
                  ))}
                </Select>
              </div>
            }
          />

          <SegmentedControl options={performanceFilterModeOptions} value={perfFilterMode} onChange={setPerfFilterMode} size="sm" />

          {perfFilterMode === 'week' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Minggu berisi tanggal:</label>
              <div className="w-40"><Input type="date" variant="muted" value={perfWeekAnchor} onChange={e => setPerfWeekAnchor(e.target.value)} /></div>
            </div>
          )}

          {perfFilterMode === 'range' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Dari:</label>
              <div className="w-40"><Input type="date" variant="muted" value={perfRangeStart} onChange={e => setPerfRangeStart(e.target.value)} /></div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sampai:</label>
              <div className="w-40"><Input type="date" variant="muted" value={perfRangeEnd} onChange={e => setPerfRangeEnd(e.target.value)} /></div>
            </div>
          )}

          {perfFilterMode === 'month' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bulan:</label>
              <div className="w-40"><Input type="month" variant="muted" value={perfFilterMonth} onChange={e => setPerfFilterMonth(e.target.value)} /></div>
            </div>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500">Periode aktif: <span className="font-bold text-slate-600 dark:text-slate-300">{perfRangeLabel}</span></p>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card variant="dark" padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Total Jam Kerja</p>
            <h3 className="font-heading text-xl font-black text-white">
              {isSingleEmployeeSelected ? `${performanceTotals.totalHours.toFixed(1).replace('.', ',')} Jam` : '0 Jam'}
            </h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total Lembur</p>
            <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">
              {isSingleEmployeeSelected ? `${(performanceTotals.totalOvertimeMinutes / 60).toFixed(1).replace('.', ',')} Jam` : '0 Jam'}
            </h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><AlarmClockOff className="w-3 h-3" /> Total Telat</p>
            <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">
              {isSingleEmployeeSelected ? performanceTotals.totalHariTelat : 0} Kali
            </h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            {/* Total gaji SELALU ditampilkan (gak di-nol-in) walau belum pilih
                karyawan spesifik — ini expense payroll perusahaan buat
                periode aktif, bukan metrik performa 1 orang, jadi tetap
                relevan dilihat gabungan semua karyawan. */}
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Expenses Payroll</p>
            <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{formatRupiah(performanceTotals.totalNetPay)}</h3>
          </Card>
        </div>

        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Detail Kinerja per Karyawan</h3>
            <button type="button" onClick={() => setIsPerfSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 active:scale-95 transition-all duration-300">
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedPerformance.length === 0 ? (
              <EmptyState size="sm" icon={<Activity className="w-8 h-8" />} title="Tidak ada data kinerja pada periode ini." />
            ) : (
              sortedPerformance.map(p => {
                const isExpanded = expandedEmpId === p.employeeId || (perfEmployeeFilter !== 'all' && expandedEmpId === null);
                return (
                  <div key={p.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors duration-300">
                    <button
                      type="button"
                      onClick={() => setExpandedEmpId(isExpanded ? null : p.employeeId)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{p.employee.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {p.hariMasuk} hari masuk · {p.hariLibur} libur{p.hariTelat > 0 ? ` · ${p.hariTelat}x telat` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-black text-sm text-slate-900 dark:text-slate-100">{formatRupiah(p.netPay)}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{p.totalHours.toFixed(1).replace('.', ',')} jam kerja</p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setPerfShareModal({ isOpen: true, data: p, rangeLabel: perfRangeLabel }); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setPerfShareModal({ isOpen: true, data: p, rangeLabel: perfRangeLabel }); } }}
                          title="Bagikan laporan kinerja"
                          className="w-8 h-8 rounded-xl bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 hover:bg-accent-100 dark:hover:bg-accent-500/20 active:scale-95 transition-all duration-300"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <KpiChip label="Hari Masuk" value={`${p.hariMasuk} Hari`} tone="green" />
                          <KpiChip label="Hari Libur" value={`${p.hariLibur} Hari`} />
                          <KpiChip label="Telat" value={`${p.hariTelat} Kali`} tone={p.hariTelat > 0 ? 'red' : 'default'} />
                          <KpiChip label="Rata² Jam/Hari Masuk" value={`${p.avgHoursPerWorkDay.toFixed(1).replace('.', ',')} Jam`} />
                          <KpiChip label="Total Jam Kerja" value={`${p.totalHours.toFixed(1).replace('.', ',')} Jam`} />
                          <KpiChip label="Total Lembur" value={p.totalOvertimeMinutes > 0 ? `${(p.totalOvertimeMinutes / 60).toFixed(1).replace('.', ',')} Jam` : '-'} tone="orange" />
                          <KpiChip label="Upah Pokok" value={formatRupiah(p.basicPay)} />
                          <KpiChip label="Bonus Full Time" value={p.fullTimeBonusTotal > 0 ? formatRupiah(p.fullTimeBonusTotal) : '-'} tone="green" />
                          <KpiChip label="Uang Lembur" value={p.overtimePay > 0 ? formatRupiah(p.overtimePay) : '-'} tone="green" />
                          <KpiChip label="Tambahan Lain" value={formatRupiah(Math.max(0, p.totalAdditions - p.fullTimeBonusTotal - p.overtimePay))} tone="green" />
                          <KpiChip label="Kasbon" value={p.totalKasbon > 0 ? formatRupiah(p.totalKasbon) : '-'} tone="red" />
                          <KpiChip label="Potongan Lain" value={p.totalDeductions - p.totalKasbon > 0 ? formatRupiah(p.totalDeductions - p.totalKasbon) : '-'} tone="red" />
                        </div>

                        {p.hariTelat > 0 && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Rincian Hari Telat</p>
                            <div className="flex flex-wrap gap-2">
                              {p.lateDays.map(d => (
                                <span key={d.dateStr} className="text-xs bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-2.5 py-1.5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{d.dateStr}</span>
                                  <span className="text-red-500 dark:text-red-400 font-bold ml-1.5">Masuk {d.clockIn}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.totalOvertimeMinutes > 0 && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Rincian Lembur Harian (Rp{p.overtimeRate.toLocaleString('id-ID')}/30 menit)</p>
                            <div className="flex flex-wrap gap-2">
                              {p.overtimeByDay.map(d => (
                                <span key={d.dateStr} className="text-xs bg-white dark:bg-slate-900 border border-accent-200 dark:border-accent-500/30 rounded-xl px-2.5 py-1.5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{d.dateStr}</span>
                                  <span className="text-accent-600 dark:text-accent-400 font-bold ml-1.5">{(d.overtimeMinutes / 60).toFixed(1).replace('.', ',')} jam</span>
                                  <span className="text-slate-400 ml-1.5">({formatRupiah(d.pay)})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <SortModal isOpen={isPerfSortOpen} onClose={() => setIsPerfSortOpen(false)} value={perfSortKey} onChange={setPerfSortKey} options={perfSortOptions} />
      </div>
    </div>
  );
};

export default ReportsTab;