import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString } from '../../../utils/formatters';
import { Card, Button, Input, Select, IconButton, Badge, SegmentedControl, Alert, EmptyState, SortModal } from '../../../components/ui';
import CategoryModal from '../../../components/CategoryModal';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly, trashedOnly, markDeleted, restoreItem } from '../../../utils/softDelete';
import { pushTransactionDelete } from '../../../storage/realtimeSync';
import { Calendar, Wallet, Plus, Trash2, Save, History, Clock, Edit3, Settings2, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import {
  WORK_START_MINUTES, WORK_END_MINUTES, EARLY_OVERTIME_THRESHOLD_MINUTES, OVERTIME_THRESHOLD_MINUTES, OVERTIME_RATE_PER_30MIN,
  LEMBUR_CATEGORY_KEYWORD, KASBON_CATEGORY_KEYWORD,
  getEmployeeStatus, calculateHoursFromTimes, formatTimeFromDate, timeStrToMinutes, getClockOutMinutesContinuous, calculateBolongMinutes
} from '../utils/payrollLogic';

const AUTO_ADJUSTMENT_CATEGORIES = ['Bonus Full Time', 'Bonus Lembur'];

const StatField = ({ label, value, highlight }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
    <p className="text-[11px] font-bold text-slate-400 mb-1">{label}</p>
    <p className={`text-sm font-bold ${highlight ? 'text-green-700' : 'text-slate-700'}`}>{value || '-'}</p>
  </div>
);

// Helper murni: hitung status absensi dari attendanceLog untuk 1 karyawan & 1 tanggal.
// Dipisah jadi function sendiri (bukan inline di useEffect) supaya bisa dipakai ulang
// untuk SEMUA karyawan sekaligus (auto-sync), bukan cuma karyawan yang dipilih di dropdown.
const computeAttendanceFromLogs = (employeeId, dateStr, logs) => {
  const todayStr = toLocalDateString();
  const isPast7PM = (dateStr < todayStr) || (dateStr === todayStr && new Date().getHours() >= 19);

  const empLogs = activeOnly(logs ?? [])
    .filter(r => r.employeeId === employeeId && r.dateStr === dateStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const hasMasuk = empLogs.some(r => r.type === 'masuk');

  let status = '';
  let cIn = '';
  let cOut = '';
  let cBolong = 0;
  let cHours = 0;
  let cDayOff = false;

  if (hasMasuk) {
    status = 'Hadir';
    const masukRec = empLogs.find(r => r.type === 'masuk');
    const keluarRec = [...empLogs].reverse().find(r => r.type === 'keluar');

    cIn = formatTimeFromDate(masukRec.date);
    if (keluarRec) {
      cOut = formatTimeFromDate(keluarRec.date);
      const bolongFallbackEnd = new Date(`${dateStr}T${cOut}:00`);
      cBolong = calculateBolongMinutes(empLogs, bolongFallbackEnd);
      const rawHours = calculateHoursFromTimes(cIn, cOut);
      const netHours = Number((rawHours - (cBolong / 60)).toFixed(4));
      cHours = netHours > 0 ? Math.ceil(netHours * 10) / 10 : 0;
    } else {
      cBolong = calculateBolongMinutes(empLogs, new Date());
      cOut = '';
    }
  } else if (isPast7PM) {
    status = 'Libur';
    cDayOff = true;
  } else {
    status = 'Belum Absen';
  }

  return { status, clockIn: cIn, clockOut: cOut, bolongMinutes: cBolong, hoursWorked: cHours, isDayOff: cDayOff, hasMasuk };
};

const InputDailyTab = () => {
  const { employees, triggerAlert, triggerConfirm, employeeDailyRecords, setEmployeeDailyRecords, additionCategories, setAdditionCategories, deductionCategories, setDeductionCategories, expenses, setExpenses, attendanceLog } = useAppContext();

  const [dailyDate, setDailyDate] = useState(toLocalDateString());
  const [dailyEmpId, setDailyEmpId] = useState('');

  // State Absensi sekarang bersifat Read-Only, ditarik dari attendanceLog
  const [attendanceStatus, setAttendanceStatus] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [hoursWorked, setHoursWorked] = useState(0);
  const [bolongMinutes, setBolongMinutes] = useState(0);
  const [isDayOff, setIsDayOff] = useState(false);

  const [additions, setAdditions] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [catModalType, setCatModalType] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [dailySortKey, setDailySortKey] = useState('date-desc');
  const [isDailySortOpen, setIsDailySortOpen] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  const [adjType, setAdjType] = useState('addition');
  const [adjCategory, setAdjCategory] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjPaymentMethod, setAdjPaymentMethod] = useState('Tunai');

  // 1. Tarik & Kalkulasi Data Absensi murni dari AttendanceLog
  useEffect(() => {
    if (!dailyEmpId || !dailyDate) {
      setAttendanceStatus('');
      setClockIn('');
      setClockOut('');
      setHoursWorked(0);
      setBolongMinutes(0);
      setIsDayOff(false);
      return;
    }

    const todayStr = toLocalDateString();
    const isPast7PM = (dailyDate < todayStr) || (dailyDate === todayStr && new Date().getHours() >= 19);

    const empLogs = activeOnly(attendanceLog ?? [])
      .filter(r => r.employeeId === dailyEmpId && r.dateStr === dailyDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const hasMasuk = empLogs.some(r => r.type === 'masuk');

    let currentStatus = '';
    let cIn = '';
    let cOut = '';
    let cBolong = 0;
    let cHours = 0;
    let cDayOff = false;

    if (hasMasuk) {
      currentStatus = 'Hadir';
      const masukRec = empLogs.find(r => r.type === 'masuk');
      const keluarRec = [...empLogs].reverse().find(r => r.type === 'keluar');

      cIn = formatTimeFromDate(masukRec.date);
      if (keluarRec) {
        cOut = formatTimeFromDate(keluarRec.date);
        const bolongFallbackEnd = new Date(`${dailyDate}T${cOut}:00`);
        cBolong = calculateBolongMinutes(empLogs, bolongFallbackEnd);
        const rawHours = calculateHoursFromTimes(cIn, cOut);
        const netHours = Number((rawHours - (cBolong / 60)).toFixed(4));
        cHours = netHours > 0 ? Math.ceil(netHours * 10) / 10 : 0;
      } else {
        cBolong = calculateBolongMinutes(empLogs, new Date());
        cOut = '';
      }
    } else if (isPast7PM) {
      currentStatus = 'Libur';
      cDayOff = true;
    } else {
      currentStatus = 'Belum Absen';
    }

    setAttendanceStatus(currentStatus);
    setClockIn(cIn);
    setClockOut(cOut);
    setBolongMinutes(cBolong);
    setHoursWorked(cHours);
    setIsDayOff(cDayOff);

  }, [dailyEmpId, dailyDate, attendanceLog]);

  // 2. Auto-Sync Absensi ke Pembukuan (Hanya jika Hadir / Libur)
  useEffect(() => {
    if (!dailyEmpId || !dailyDate) return;
    if (attendanceStatus === 'Belum Absen' || attendanceStatus === '') return;

    setEmployeeDailyRecords(prev => {
      const prevExisting = prev.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      const isSame = prevExisting &&
        prevExisting.isDayOff === isDayOff &&
        prevExisting.clockIn === clockIn &&
        prevExisting.clockOut === clockOut &&
        prevExisting.hoursWorked === hoursWorked &&
        (prevExisting.bolongMinutes || 0) === bolongMinutes;

      if (isSame) return prev; // Jika sama persis, abaikan

      if (prevExisting) {
        return prev.map(r => r.id === prevExisting.id ? {
          ...r, isDayOff, clockIn, clockOut, hoursWorked, bolongMinutes
        } : r);
      } else {
        return [{
          id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: dailyEmpId,
          date: new Date(dailyDate),
          dateStr: dailyDate,
          isDayOff,
          clockIn,
          clockOut,
          hoursWorked,
          bolongMinutes,
          additions: [],
          deductions: []
        }, ...prev];
      }
    });
  }, [attendanceStatus, isDayOff, clockIn, clockOut, hoursWorked, bolongMinutes, dailyEmpId, dailyDate, setEmployeeDailyRecords]);

  // 2b. FIX BUG: Auto-Sync Absensi untuk SEMUA karyawan yang sudah ada rekaman 'masuk' di tanggal terpilih.
  // Sebelumnya, data absen Hadir cuma kebawa ke pembukuan kalau karyawan itu kebetulan
  // sedang dipilih di dropdown (lihat effect di atas). Sekarang berjalan otomatis untuk semua karyawan,
  // independen dari dailyEmpId / dropdown (dropdown sekarang cuma dipakai untuk Tambahan & Potongan).
  useEffect(() => {
    if (!dailyDate) return;

    const employeeIdsWithMasuk = [...new Set(
      activeOnly(attendanceLog ?? [])
        .filter(r => r.dateStr === dailyDate && r.type === 'masuk')
        .map(r => r.employeeId)
    )];

    if (employeeIdsWithMasuk.length === 0) return;

    setEmployeeDailyRecords(prev => {
      let next = prev;
      let changed = false;

      employeeIdsWithMasuk.forEach(empId => {
        const result = computeAttendanceFromLogs(empId, dailyDate, attendanceLog);
        const prevExisting = next.find(r => !r.deletedAt && r.employeeId === empId && r.dateStr === dailyDate);

        const isSame = prevExisting &&
          prevExisting.isDayOff === result.isDayOff &&
          prevExisting.clockIn === result.clockIn &&
          prevExisting.clockOut === result.clockOut &&
          prevExisting.hoursWorked === result.hoursWorked &&
          (prevExisting.bolongMinutes || 0) === result.bolongMinutes;

        if (isSame) return; // Jika sama persis, abaikan

        changed = true;
        if (prevExisting) {
          next = next.map(r => r.id === prevExisting.id ? {
            ...r, isDayOff: result.isDayOff, clockIn: result.clockIn, clockOut: result.clockOut, hoursWorked: result.hoursWorked, bolongMinutes: result.bolongMinutes
          } : r);
        } else {
          next = [{
            id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            employeeId: empId,
            date: new Date(dailyDate),
            dateStr: dailyDate,
            isDayOff: result.isDayOff,
            clockIn: result.clockIn,
            clockOut: result.clockOut,
            hoursWorked: result.hoursWorked,
            bolongMinutes: result.bolongMinutes,
            additions: [],
            deductions: []
          }, ...next];
        }
      });

      return changed ? next : prev;
    });
  }, [attendanceLog, dailyDate, setEmployeeDailyRecords]);

  // 3. Muat Data Tambahan & Potongan dari pembukuan saat tanggal / Karyawan berganti
  useEffect(() => {
    if (dailyEmpId && dailyDate) {
      const existingRecord = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      if (existingRecord) {
        setAdditions(existingRecord.additions || []);
        setDeductions(existingRecord.deductions || []);
      } else {
        setAdditions([]);
        setDeductions([]);
      }
    } else {
      setAdditions([]);
      setDeductions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyEmpId, dailyDate]); // Dipicu murni karena pergantian seleksi form

  // 4. Kalkulasi Bonus Full Time Otomatis
  useEffect(() => {
    if (!dailyEmpId || isDayOff || !clockIn || !clockOut) {
      setAdditions(prev => prev.filter(a => a.category !== 'Bonus Full Time'));
      return;
    }
    const emp = employees.find(e => e.id === dailyEmpId);
    if (!emp) return;

    const bonusAmount = emp.fullTimeBonus || 0;
    const outMinutes = getClockOutMinutesContinuous(clockIn, clockOut);
    const isEligibleForBonus = timeStrToMinutes(clockIn) <= WORK_START_MINUTES && outMinutes >= WORK_END_MINUTES;

    if (isEligibleForBonus && bonusAmount > 0) {
      setAdditions(prev => {
        if (!prev.some(a => a.category === 'Bonus Full Time')) {
          return [...prev, { id: Date.now() + Math.random(), category: 'Bonus Full Time', amount: Number(bonusAmount), note: '(Masuk ≤ 09:00 & Pulang ≥ 19:00)', expenseRecorded: false }];
        }
        return prev;
      });
    } else {
      setAdditions(prev => prev.filter(a => a.category !== 'Bonus Full Time'));
    }
  }, [clockIn, clockOut, isDayOff, dailyEmpId, employees]);

  // 5. Kalkulasi Bonus Lembur Otomatis
  useEffect(() => {
    if (!dailyEmpId || isDayOff || !clockIn || !clockOut) {
      setAdditions(prev => prev.filter(a => a.category !== 'Bonus Lembur'));
      return;
    }
    const inMinutes = timeStrToMinutes(clockIn);
    const outMinutes = getClockOutMinutesContinuous(clockIn, clockOut);
    let earlyOvertimeMinutes = inMinutes <= EARLY_OVERTIME_THRESHOLD_MINUTES ? WORK_START_MINUTES - inMinutes : 0;
    let lateOvertimeMinutes = outMinutes >= OVERTIME_THRESHOLD_MINUTES ? outMinutes - WORK_END_MINUTES : 0;
    const totalBlocks = Math.floor(earlyOvertimeMinutes / 30) + Math.floor(lateOvertimeMinutes / 30);
    const lemburAmount = totalBlocks * OVERTIME_RATE_PER_30MIN;

    setAdditions(prev => {
      const withoutAuto = prev.filter(a => a.category !== 'Bonus Lembur');
      if (lemburAmount > 0) {
        const notes = [];
        if (earlyOvertimeMinutes > 0) notes.push(`Awal ${Math.floor(earlyOvertimeMinutes / 30) * 30}m`);
        if (lateOvertimeMinutes > 0) notes.push(`Akhir ${Math.floor(lateOvertimeMinutes / 30) * 30}m`);
        return [...withoutAuto, { id: Date.now() + Math.random(), category: 'Bonus Lembur', amount: lemburAmount, note: `(${notes.join(', ')})`, expenseRecorded: false }];
      }
      return withoutAuto;
    });
  }, [clockIn, clockOut, isDayOff, dailyEmpId]);

  const handleAddAdjustment = () => {
    if (!adjCategory) return triggerAlert('Pilih kategori terlebih dahulu!');
    if (!adjAmount || Number(adjAmount) <= 0) return triggerAlert('Masukkan nominal yang valid!');
    const newItem = { id: Date.now() + Math.random(), category: adjCategory, amount: Number(adjAmount), note: adjNote, paymentMethod: adjType === 'deduction' ? adjPaymentMethod : null, expenseRecorded: false };
    if (adjType === 'addition') setAdditions(prev => [...prev, newItem]);
    else setDeductions(prev => [...prev, newItem]);
    setAdjAmount(''); setAdjNote('');
  };

  const handleRemoveAdjustment = (type, id) => {
    if (type === 'addition') setAdditions(prev => prev.filter(a => a.id !== id));
    else setDeductions(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveDailyRecord = () => {
    if (!dailyEmpId || !dailyDate) return triggerAlert('Pilih karyawan & tanggal terlebih dahulu!');
    const validAdditions = additions.filter(a => a.category && a.amount > 0);
    const validDeductions = deductions.filter(d => d.category && d.amount > 0);
    const empName = employees.find(e => e.id === dailyEmpId)?.name || 'Karyawan';
    const generatedExpenses = [];

    const updatedDeductions = validDeductions.map(d => {
      if (d.paymentMethod === 'Tunai' && !d.expenseRecorded) {
        generatedExpenses.push({ id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, amount: d.amount, category: 'Lain-lain', note: `Potongan ${empName} (${d.category})${d.note ? ' - ' + d.note : ''}`, date: new Date(dailyDate), paymentMethod: 'Tunai', employeeId: dailyEmpId });
        return { ...d, expenseRecorded: true };
      }
      return d;
    });

    if (generatedExpenses.length > 0) setExpenses([...generatedExpenses, ...expenses]);

    setEmployeeDailyRecords(prev => {
      const existing = prev.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      if (existing) return prev.map(r => r.id === existing.id ? { ...r, additions: validAdditions, deductions: updatedDeductions } : r);

      return [{
        id: `REC-${Date.now()}`, employeeId: dailyEmpId, date: new Date(dailyDate), dateStr: dailyDate,
        isDayOff, clockIn, clockOut, hoursWorked, bolongMinutes, additions: validAdditions, deductions: updatedDeductions
      }, ...prev];
    });
    triggerAlert('Perubahan tambahan & potongan berhasil disimpan!');
  };

  const hasUnsavedAdjustments = useMemo(() => {
    const existing = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
    return JSON.stringify(additions) !== JSON.stringify(existing?.additions || []) || JSON.stringify(deductions) !== JSON.stringify(existing?.deductions || []);
  }, [additions, deductions, dailyEmpId, dailyDate, employeeDailyRecords]);

  const adjustmentRows = useMemo(() => ([
    ...additions.map(a => ({ ...a, _type: 'addition' })),
    ...deductions.map(d => ({ ...d, _type: 'deduction' }))
  ]), [additions, deductions]);

  const totalAdditions = useMemo(() => additions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0), [additions]);
  const totalDeductions = useMemo(() => deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0), [deductions]);
  const netAdjustment = totalAdditions - totalDeductions;

  const visibleDailyRecords = showTrash ? trashedOnly(employeeDailyRecords) : activeOnly(employeeDailyRecords);
  const sortedDailyRecords = applySort(visibleDailyRecords, dailySortKey, { date: r => new Date(r.date), name: r => employees.find(e => e.id === r.employeeId)?.name || '', hours: r => r.hoursWorked || 0 });

  const attendanceOverview = useMemo(() => {
    return employees
      .filter(emp => getEmployeeStatus(emp) !== 'resign')
      .map(emp => ({ ...emp, _attendance: computeAttendanceFromLogs(emp.id, dailyDate, attendanceLog) }));
  }, [employees, dailyDate, attendanceLog]);

  const formatRupiah = (amount) => `Rp${Number(amount || 0).toLocaleString('id-ID')}`;

  const formatJam = (hours) => {
    const h = Number(hours) || 0;
    if (h <= 0) return '';
    const rounded = Math.ceil(Number(h.toFixed(4)) * 10) / 10;
    return rounded.toFixed(1).replace('.', ',');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="lg:col-span-1 flex flex-col gap-6">

        {/* CARD ABSENSI (AUTOMATIC, SEMUA KARYAWAN) */}
        <Card padding="lg" className="flex flex-col h-fit relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-slate-800" />
            <h3 className="font-heading font-bold flex-1">Data Absensi</h3>
          </div>
          <div className="space-y-4">
            <Input type="date" label="Tanggal" variant="muted" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
              {attendanceOverview.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Belum ada data karyawan.</p>
              ) : attendanceOverview.map(emp => (
                <div key={emp.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                  <span className="text-sm font-semibold text-slate-700 truncate">{emp.name}</span>
                  {emp._attendance.status === 'Hadir' && <Badge variant="success">Hadir</Badge>}
                  {emp._attendance.status === 'Libur' && <Badge variant="neutral">Libur</Badge>}
                  {emp._attendance.status === 'Belum Absen' && <Badge variant="warning">Belum Absen</Badge>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">Absen tersinkron otomatis dari attendance untuk semua karyawan. Rincian jam masuk, keluar, jam bolong & total jam kerja bisa dilihat lewat ikon mata di Riwayat Input.</p>
          </div>
        </Card>

        {/* CARD TAMBAHAN & POTONGAN */}
        <Card padding="lg" className="flex flex-col h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100"><Wallet className="w-5 h-5 text-green-600" /><h3 className="font-heading font-bold">Tambahan & Potongan</h3></div>
          <div className="space-y-4">
            <div>
              <Select label="Karyawan" variant="muted" value={dailyEmpId} onChange={e => setDailyEmpId(e.target.value)}>
                <option value="">Pilih Karyawan</option>
                {employees.filter(emp => getEmployeeStatus(emp) !== 'resign' || emp.id === dailyEmpId).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              {dailyEmpId && <p className="text-[11px] text-slate-400 mt-1.5">Untuk tanggal: <span className="font-bold text-slate-600">{dailyDate}</span></p>}
            </div>
            <SegmentedControl options={[{ value: 'addition', label: 'Penghasilan (+)', tone: 'green' }, { value: 'deduction', label: 'Potongan (-)', tone: 'red' }]} value={adjType} onChange={(val) => { setAdjType(val); setAdjCategory(''); }} />
            <div>
              <label className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">Kategori <Button type="button" size="xs" variant="secondary" onClick={() => setCatModalType(adjType)} icon={<Settings2 className="w-3 h-3" />}>Kelola</Button></label>
              <Select variant="muted" value={adjCategory} onChange={(e) => setAdjCategory(e.target.value)}>
                <option value="">Pilih Kategori</option>
                {adjType === 'addition'
                  ? [...new Set(additionCategories)].filter(c => !c.toLowerCase().includes(LEMBUR_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                  : [...new Set(deductionCategories)].filter(c => !c.toLowerCase().includes(KASBON_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                }
              </Select>
            </div>
            <Input type="number" label="Nominal" variant="muted" icon={<span>Rp</span>} value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
            <Input label="Catatan" variant="muted" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            {adjType === 'deduction' && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Metode Pembayaran</label>
                <SegmentedControl options={[{ value: 'Tunai', label: 'Tunai' }, { value: 'Non-Tunai', label: 'Non-Tunai' }]} value={adjPaymentMethod} onChange={setAdjPaymentMethod} />
                <p className="text-[10px] text-slate-400 mt-1">Tunai = otomatis tercatat sebagai pengeluaran kas.</p>
              </div>
            )}
            <Button variant={adjType === 'addition' ? 'success' : 'danger'} size="full" icon={<Plus className="w-4 h-4" />} onClick={handleAddAdjustment}>{adjType === 'addition' ? 'Tambah Penghasilan' : 'Tambah Potongan'}</Button>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2">Rincian Hari Ini</p>
              {adjustmentRows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Belum ada tambahan/potongan hari ini.</p>
              ) : (
                <div className="space-y-2">
                  {adjustmentRows.map(item => {
                    const isAddition = item._type === 'addition';
                    const isAuto = AUTO_ADJUSTMENT_CATEGORIES.includes(item.category);
                    return (
                      <div key={item.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${isAddition ? 'bg-green-50/60 border-green-100' : 'bg-red-50/60 border-red-100'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isAddition ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.category}</span>
                            {isAuto && <span className="text-[10px] font-semibold text-slate-400">Otomatis</span>}
                          </div>
                          {item.note && <p className="text-[11px] text-slate-500 truncate mt-1">{item.note}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-sm font-bold ${isAddition ? 'text-green-700' : 'text-red-700'}`}>{isAddition ? '+' : '-'}{formatRupiah(item.amount)}</span>
                          {!isAuto && (
                            <IconButton variant="delete" onClick={() => handleRemoveAdjustment(item._type, item.id)}><Trash2 className="w-3.5 h-3.5" /></IconButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {adjustmentRows.length > 0 && (
              <div className="space-y-1 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500"><span>Total Tambahan</span><span className="font-bold text-green-700">+{formatRupiah(totalAdditions)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Total Potongan</span><span className="font-bold text-red-700">-{formatRupiah(totalDeductions)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-100"><span>Net</span><span>{netAdjustment >= 0 ? '+' : ''}{formatRupiah(netAdjustment)}</span></div>
              </div>
            )}

            {hasUnsavedAdjustments && <Alert type="callout" variant="warning">Ada perubahan yang belum disimpan.</Alert>}

            <Button variant="primary" size="full" icon={<Save className="w-4 h-4" />} onClick={handleSaveDailyRecord}>Simpan Perubahan</Button>
          </div>
        </Card>
      </div>

      <Card padding="none" className="lg:col-span-2 flex flex-col h-[650px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-2xl">
          <h3 className="font-heading font-bold flex items-center gap-2"><History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Input'}</h3>
          <div className="flex gap-3">
            <button onClick={() => setShowTrash(!showTrash)} className="text-xs font-bold text-slate-500">{showTrash ? 'Kembali' : 'Recycle Bin'}</button>
            <button onClick={() => setIsDailySortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 border rounded-lg px-2 py-1.5"><ArrowUpDown className="w-3.5 h-3.5" /> Urutkan</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedDailyRecords.slice(0, 50).map(rec => {
            const isExpanded = expandedRecordId === rec.id;
            return (
              <div key={rec.id} className="flex flex-col p-4 border border-slate-100 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm truncate">{employees.find(e => e.id === rec.employeeId)?.name}</p>
                      <button type="button" onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)} className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Lihat Detail Absensi">
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {rec.dateStr} • {formatJam(rec.hoursWorked)} Jam</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!showTrash && <IconButton variant="edit" onClick={() => { setDailyEmpId(rec.employeeId); setDailyDate(rec.dateStr); }}><Edit3 className="w-4 h-4" /></IconButton>}
                    <IconButton variant="delete" onClick={() => { setEmployeeDailyRecords(prev => prev.map(r => r.id === rec.id ? markDeleted(r) : r)) }}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-1 pt-3 border-t border-slate-100">
                    {rec.isDayOff ? (
                      <p className="text-xs text-slate-400 text-center py-2">Tidak ada data absensi (Libur).</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <StatField label="Jam Masuk" value={rec.clockIn} />
                        <StatField label="Jam Keluar" value={rec.clockOut} />
                        <StatField label="Jam Bolong (Jam)" value={!rec.bolongMinutes ? '0,0' : (rec.bolongMinutes / 60).toFixed(1).replace('.', ',')} />
                        <StatField label="Total Jam Kerja" value={formatJam(rec.hoursWorked) || '0,0'} highlight />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <SortModal isOpen={isDailySortOpen} onClose={() => setIsDailySortOpen(false)} value={dailySortKey} onChange={setDailySortKey} options={[{ key: 'date-desc', label: 'Terbaru Dulu' }, { key: 'name-asc', label: 'Nama (A-Z)' }]} />
      <CategoryModal isOpen={catModalType === 'addition'} onClose={() => setCatModalType(null)} title="Kategori Penghasilan" categories={additionCategories} setCategories={setAdditionCategories} triggerAlert={triggerAlert} triggerConfirm={triggerConfirm} onDeleteFallback={'Lainnya'} />
      <CategoryModal isOpen={catModalType === 'deduction'} onClose={() => setCatModalType(null)} title="Kategori Potongan" categories={deductionCategories} setCategories={setDeductionCategories} triggerAlert={triggerAlert} triggerConfirm={triggerConfirm} onDeleteFallback={'Lainnya'} />
    </div>
  );
};

export default InputDailyTab;