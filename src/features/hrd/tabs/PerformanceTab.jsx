import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString, toLocalMonthString, getWeekRange } from '../../../utils/formatters';
import { Card, Input, Select, EmptyState, SortModal, SegmentedControl } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly } from '../../../utils/softDelete';
import { Activity, ArrowUpDown, ChevronDown, TrendingUp, Clock, CalendarCheck, AlarmClockOff } from 'lucide-react';
import {
  AUTO_ADJUSTMENT_CATEGORIES, summarizeAutoBonuses, resolveEmployeeForRecord,
  WORK_START_MINUTES, timeStrToMinutes,
} from '../utils/payrollLogic';

// Toleransi keterlambatan (menit) sebelum dianggap "Telat" — jam masuk resmi
// adalah WORK_START_MINUTES (09:00), dikasih toleransi 5 menit biar variasi
// kecil (mis. selisih detik pembulatan) gak dianggap telat.
const LATE_TOLERANCE_MINUTES = 5;

const isLateRecord = (rec) => {
  if (!rec || rec.isDayOff || !rec.clockIn) return false;
  return timeStrToMinutes(rec.clockIn) > (WORK_START_MINUTES + LATE_TOLERANCE_MINUTES);
};

const filterModeOptions = [
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

const PerformanceTab = () => {
  const { employees, employeeDailyRecords, expenses, formatRupiah } = useAppContext();

  const [filterMode, setFilterMode] = useState('week'); // 'week' | 'range' | 'month'
  const defaultWeek = useMemo(() => getWeekRange(), []);
  const [weekAnchor, setWeekAnchor] = useState(toLocalDateString()); // tanggal acuan minggu berjalan
  const [rangeStart, setRangeStart] = useState(defaultWeek.start);
  const [rangeEnd, setRangeEnd] = useState(defaultWeek.end);
  const [filterMonth, setFilterMonth] = useState(toLocalMonthString());
  const [employeeFilter, setEmployeeFilter] = useState('all'); // 'all' | employeeId

  const [sortKey, setSortKey] = useState('name-asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState(null);

  // Rentang tanggal aktual (start/end string "YYYY-MM-DD") berdasarkan mode filter.
  const activeRange = useMemo(() => {
    if (filterMode === 'week') return getWeekRange(weekAnchor);
    if (filterMode === 'range') return { start: rangeStart, end: rangeEnd };
    // month
    const start = `${filterMonth}-01`;
    const [y, m] = filterMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${filterMonth}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }, [filterMode, weekAnchor, rangeStart, rangeEnd, filterMonth]);

  const matchesActiveRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (activeRange.start && dateStr < activeRange.start) return false;
    if (activeRange.end && dateStr > activeRange.end) return false;
    return true;
  }, [activeRange]);

  const filteredRecords = useMemo(() => {
    return activeOnly(employeeDailyRecords)
      .filter(r => matchesActiveRange(r.dateStr))
      .filter(r => employeeFilter === 'all' || r.employeeId === employeeFilter);
  }, [employeeDailyRecords, matchesActiveRange, employeeFilter]);

  const performance = useMemo(() => {
    const perf = {};

    filteredRecords.forEach(rec => {
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
      // sendiri (snapshot) — konsisten dengan pola immutable history di
      // ReportsTab, supaya rekap periode lalu gak berubah kalau tarif
      // karyawan diedit belakangan.
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
        (employeeFilter === 'all' || exp.employeeId === employeeFilter) &&
        matchesActiveRange(toLocalDateString(exp.date)) &&
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
  }, [filteredRecords, employees, expenses, matchesActiveRange, employeeFilter]);

  // Sertakan juga karyawan AKTIF yang tidak punya record sama sekali di
  // periode ini (mis. libur sepanjang periode) — biar kelihatan "0" bukan
  // hilang dari daftar, khususnya berguna untuk rentang mingguan pendek.
  // Kalau lagi filter ke 1 karyawan spesifik, cuma karyawan itu yang
  // di-fallback-in (bukan seluruh karyawan aktif lainnya).
  const performanceWithIdleEmployees = useMemo(() => {
    const coveredIds = new Set(performance.map(p => p.employeeId));
    const idlePool = employeeFilter === 'all'
      ? activeOnly(employees || []).filter(e => e.status !== 'resign')
      : (employees || []).filter(e => e.id === employeeFilter);
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
  }, [performance, employees, employeeFilter]);

  const totals = useMemo(() => {
    return performanceWithIdleEmployees.reduce((acc, p) => ({
      totalHours: acc.totalHours + p.totalHours,
      totalOvertimeMinutes: acc.totalOvertimeMinutes + p.totalOvertimeMinutes,
      totalNetPay: acc.totalNetPay + p.netPay,
      totalHariTelat: acc.totalHariTelat + p.hariTelat,
    }), { totalHours: 0, totalOvertimeMinutes: 0, totalNetPay: 0, totalHariTelat: 0 });
  }, [performanceWithIdleEmployees]);

  const sortedPerformance = applySort(performanceWithIdleEmployees, sortKey, {
    name: p => p.employee?.name || '',
    hours: p => p.totalHours || 0,
    netpay: p => p.netPay || 0,
    hadir: p => p.hariMasuk || 0,
    telat: p => p.hariTelat || 0,
  });

  const sortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
    { key: 'netpay-desc', label: 'Pendapatan Bersih Terbesar' },
    { key: 'hadir-desc', label: 'Hari Masuk Terbanyak' },
    { key: 'telat-desc', label: 'Paling Sering Telat' },
  ];

  const rangeLabel = activeRange.start === activeRange.end
    ? activeRange.start
    : `${activeRange.start} s/d ${activeRange.end}`;

  const employeeOptions = useMemo(() => {
    return [...(employees || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
  }, [employees]);

  return (
    <div className="space-y-6 pt-2 border-t border-slate-200 dark:border-slate-800">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-600 dark:text-accent-400" /> Rekap Kinerja Karyawan
          </h3>
          <div className="w-full sm:w-56">
            <Select variant="muted" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
              <option value="all">Semua Karyawan</option>
              {employeeOptions.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}{emp.status === 'resign' ? ' (Resign)' : ''}</option>
              ))}
            </Select>
          </div>
        </div>

        <SegmentedControl options={filterModeOptions} value={filterMode} onChange={setFilterMode} size="sm" />

        {filterMode === 'week' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Minggu berisi tanggal:</label>
            <div className="w-40"><Input type="date" variant="muted" value={weekAnchor} onChange={e => setWeekAnchor(e.target.value)} /></div>
          </div>
        )}

        {filterMode === 'range' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Dari:</label>
            <div className="w-40"><Input type="date" variant="muted" value={rangeStart} onChange={e => setRangeStart(e.target.value)} /></div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sampai:</label>
            <div className="w-40"><Input type="date" variant="muted" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} /></div>
          </div>
        )}

        {filterMode === 'month' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bulan:</label>
            <div className="w-40"><Input type="month" variant="muted" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} /></div>
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500">Periode aktif: <span className="font-bold text-slate-600 dark:text-slate-300">{rangeLabel}</span></p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card variant="dark" padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Total Jam Kerja</p>
          <h3 className="font-heading text-xl font-black text-white">{totals.totalHours.toFixed(1).replace('.', ',')} Jam</h3>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total Lembur</p>
          <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{(totals.totalOvertimeMinutes / 60).toFixed(1).replace('.', ',')} Jam</h3>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><AlarmClockOff className="w-3 h-3" /> Total Telat</p>
          <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{totals.totalHariTelat} Kali</h3>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Pendapatan Bersih</p>
          <h3 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">{formatRupiah(totals.totalNetPay)}</h3>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Detail Kinerja per Karyawan</h3>
          <button type="button" onClick={() => setIsSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 active:scale-95 transition-all duration-300">
            <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedPerformance.length === 0 ? (
            <EmptyState size="sm" icon={<Activity className="w-8 h-8" />} title="Tidak ada data kinerja pada periode ini." />
          ) : (
            sortedPerformance.map(p => {
              const isExpanded = expandedEmpId === p.employeeId || (employeeFilter !== 'all' && expandedEmpId === null);
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

      <SortModal isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} value={sortKey} onChange={setSortKey} options={sortOptions} />
    </div>
  );
};

export default PerformanceTab;