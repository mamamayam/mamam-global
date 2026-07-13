import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString, toLocalMonthString, getWeekRange } from '../../../utils/formatters';
import { Card, Button, Input, Select, EmptyState, SortModal, SegmentedControl } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly } from '../../../utils/softDelete';
import {
  PieChart, Printer, ArrowUpDown, Activity, ChevronDown,
  TrendingUp, Clock, CalendarCheck, AlarmClockOff,
} from 'lucide-react';
import {
  AUTO_ADJUSTMENT_CATEGORIES, summarizeAutoBonuses, resolveEmployeeForRecord,
  WORK_START_MINUTES, timeStrToMinutes,
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
  const { employees, employeeDailyRecords, expenses, setPayslipModal, formatRupiah } = useAppContext();

  // ==========================================================================
  // SECTION 1 — Rekap Penggajian (ringkas, per bulan)
  // ==========================================================================
  const [reportMonth, setReportMonth] = useState(toLocalMonthString());
  const [payrollSortKey, setPayrollSortKey] = useState('name-asc');
  const [isPayrollSortOpen, setIsPayrollSortOpen] = useState(false);

  const filteredRecordsForReport = useMemo(() => {
    return activeOnly(employeeDailyRecords).filter(r => toLocalMonthString(r.date) === reportMonth);
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
            netPay: 0,
            basicPay: 0,
            records: [],
          };
        }
        perf[exp.employeeId].totalDeductions += exp.amount;

        if (!perf[exp.employeeId].kasbonRecords) {
          perf[exp.employeeId].kasbonRecords = [];
        }
        perf[exp.employeeId].kasbonRecords.push(exp);
      }
    });

    Object.values(perf).forEach(data => {
      const { fullTimeBonusTotal, overtimePayTotal, overtimeRate, overtimeByDay } =
        summarizeAutoBonuses(data.records, employees);

      data.overtimeRate = overtimeRate; // Tarif/30 menit, dipakai juga di Payslip
      data.overtimePay = overtimePayTotal; // Simpan variabel ini untuk dipakai di Payslip
      data.overtimeByDay = overtimeByDay;
      data.totalAdditions += fullTimeBonusTotal + overtimePayTotal;

      // data.basicPay sudah diakumulasi per-record di loop atas (lihat
      // komentar di sana) — TIDAK dihitung ulang di sini pakai tarif tunggal.
      data.netPay = data.basicPay + data.totalAdditions - data.totalDeductions;

      // Dibawa serta buat buildPayslipRows() di Payslip — supaya baris
      // "Upah Jam Kerja" per hari di slip gaji juga resolve tarif per
      // record (bukan cuma total di tabel rekap ini).
      data.employees = employees;
    });

    return Object.values(perf);
  }, [filteredRecordsForReport, employees, expenses, reportMonth]);

  const totalPayrollExpense = employeePayroll.reduce((sum, p) => sum + p.netPay, 0);

  const sortedEmployeePayroll = applySort(employeePayroll, payrollSortKey, {
    name: p => p.employee?.name || '',
    netpay: p => p.netPay || 0,
    hours: p => p.totalHours || 0,
  });

  const payrollSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'netpay-desc', label: 'Gaji Bersih Terbesar' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
  ];

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
    return activeOnly(employeeDailyRecords)
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

  const perfRangeLabel = perfActiveRange.start === perfActiveRange.end
    ? perfActiveRange.start
    : `${perfActiveRange.start} s/d ${perfActiveRange.end}`;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="dark" padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400">Total Expenses Payroll</p>
            <h3 className="font-heading text-2xl font-black text-white">{formatRupiah(totalPayrollExpense)}</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Karyawan Aktif (Bulan Ini)</p>
            <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100">{employeePayroll.length} Orang</h3>
          </Card>
        </div>

        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Rekap Gaji Karyawan</h3>
            <button type="button" onClick={() => setIsPayrollSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 active:scale-95 transition-all duration-300">
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[420px]">
              <thead>
                <tr className="bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Nama Karyawan</th>
                  <th className="p-4 text-right">Gaji Bersih (Net)</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployeePayroll.length === 0 ? (
                  <tr><td colSpan="3"><EmptyState size="sm" icon={<PieChart className="w-8 h-8" />} title="Tidak ada data penggajian pada bulan ini." /></td></tr>
                ) : (
                  sortedEmployeePayroll.map(p => (
                    <tr key={p.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors duration-300">
                      <td className="p-4"><p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.employee.name}</p></td>
                      <td className="p-4 text-right font-black text-slate-900 dark:text-slate-100 text-sm">{formatRupiah(p.netPay)}</td>
                      <td className="p-4 text-center">
                        <Button variant="ghost" size="sm" icon={<Printer className="w-3 h-3" />} onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })}>Cetak Slip</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

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
            <h3 className="font-heading text-xl font-black text-white">{performanceTotals.totalHours.toFixed(1).replace('.', ',')} Jam</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total Lembur</p>
            <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{(performanceTotals.totalOvertimeMinutes / 60).toFixed(1).replace('.', ',')} Jam</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><AlarmClockOff className="w-3 h-3" /> Total Telat</p>
            <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{performanceTotals.totalHariTelat} Kali</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Pendapatan Bersih</p>
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