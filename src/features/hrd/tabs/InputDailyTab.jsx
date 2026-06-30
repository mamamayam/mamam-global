import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString } from '../../../utils/formatters';
import { Card, Button, Input, Select, IconButton, Badge, SegmentedControl, Alert, SortModal, BulkSelectBar } from '../../../components/ui';
import CategoryModal from '../../../components/CategoryModal';
import { activeOnly, trashedOnly, markDeleted } from '../../../utils/softDelete';
import { useBulkSelect } from '../../../hook/useBulkSelect';
import {
  Wallet, Plus, Trash2, Save, History, Clock, Edit3, Settings2,
  ArrowUpDown, Eye, EyeOff, X, ChevronDown, ChevronRight, User,
} from 'lucide-react';
import {
  WORK_START_MINUTES, WORK_END_MINUTES, EARLY_OVERTIME_THRESHOLD_MINUTES, OVERTIME_THRESHOLD_MINUTES,
  LEMBUR_CATEGORY_KEYWORD, KASBON_CATEGORY_KEYWORD,
  getEmployeeStatus, calculateHoursFromTimes, formatTimeFromDate, timeStrToMinutes,
  calculateBolongMinutes, getOvertimeRate, calculateOvertimePay,
  AUTO_ADJUSTMENT_CATEGORIES, mergeAutoAdjustments,
} from '../utils/payrollLogic';

const StatField = ({ label, value, highlight }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
    <p className="text-[11px] font-bold text-slate-400 mb-1">{label}</p>
    <p className={`text-sm font-bold ${highlight ? 'text-green-700' : 'text-slate-700'}`}>{value || '-'}</p>
  </div>
);

const computeAttendanceFromLogs = (employeeId, dateStr, logs) => {
  const todayStr = toLocalDateString();
  const isPast7PM = (dateStr < todayStr) || (dateStr === todayStr && new Date().getHours() >= 19);

  const empLogs = activeOnly(logs ?? [])
    .filter(r => r.employeeId === employeeId && r.dateStr === dateStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const hasMasuk = empLogs.some(r => r.type === 'masuk');

  let status = '', cIn = '', cOut = '', cBolong = 0, cHours = 0, cDayOff = false, cOvertime = 0;

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
      const inMins = timeStrToMinutes(cIn);
      const outMins = timeStrToMinutes(cOut);
      const earlyOvertimeMins = inMins <= EARLY_OVERTIME_THRESHOLD_MINUTES ? WORK_START_MINUTES - inMins : 0;
      const lateOvertimeMins = outMins >= OVERTIME_THRESHOLD_MINUTES ? outMins - WORK_END_MINUTES : 0;
      cOvertime = earlyOvertimeMins + lateOvertimeMins;
    } else {
      cBolong = calculateBolongMinutes(empLogs, new Date());
      cOut = '';
    }
  } else if (isPast7PM) {
    status = 'Libur'; cDayOff = true;
  } else {
    status = 'Belum Absen';
  }

  return { status, clockIn: cIn, clockOut: cOut, bolongMinutes: cBolong, hoursWorked: cHours, overtimeMinutes: cOvertime, isDayOff: cDayOff, hasMasuk };
};

/* ─────────────────────────────────────────────────────── */
/* Komponen kecil untuk form item di dalam modal edit       */
/* ─────────────────────────────────────────────────────── */
const AdjRow = ({ item, onRemove, formatRupiah }) => {
  const isAddition = item._type === 'addition';
  const isAuto = AUTO_ADJUSTMENT_CATEGORIES.includes(item.category);
  return (
    <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${isAddition ? 'bg-green-50/60 border-green-100' : 'bg-red-50/60 border-red-100'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isAddition ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.category}</span>
          {isAuto && <span className="text-[10px] font-semibold text-slate-400">Otomatis</span>}
        </div>
        {item.note && <p className="text-[11px] text-slate-500 truncate mt-1">{item.note}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-sm font-bold ${isAddition ? 'text-green-700' : 'text-red-700'}`}>{isAddition ? '+' : '-'}{formatRupiah(item.amount)}</span>
        {!isAuto && <IconButton variant="delete" onClick={() => onRemove(item._type, item.id)}><Trash2 className="w-3.5 h-3.5" /></IconButton>}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────── */

const InputDailyTab = () => {
  const {
    employees, triggerAlert, triggerConfirm,
    employeeDailyRecords, setEmployeeDailyRecords,
    additionCategories, setAdditionCategories,
    deductionCategories, setDeductionCategories,
    expenses, setExpenses, attendanceLog,
  } = useAppContext();

  /* ── State Form Utama ── */
  const [dailyDate, setDailyDate]   = useState(toLocalDateString());
  const [dailyEmpId, setDailyEmpId] = useState('');
  const formRef = useRef(null);
  const [additions, setAdditions]   = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [catModalType, setCatModalType]       = useState(null);
  const [showTrash, setShowTrash]             = useState(false);
  const [dailySortKey, setDailySortKey]       = useState('date-desc');
  const [isDailySortOpen, setIsDailySortOpen] = useState(false);
  const [expandedRecordId, setExpandedRecordId]     = useState(null);
  const [collapsedEmployees, setCollapsedEmployees] = useState(new Set());

  const [adjType, setAdjType]                   = useState('addition');
  const [adjCategory, setAdjCategory]           = useState('');
  const [adjAmount, setAdjAmount]               = useState('');
  const [adjNote, setAdjNote]                   = useState('');
  const [adjPaymentMethod, setAdjPaymentMethod] = useState('Tunai');

  /* ── State Modal Edit ── */
  const [editingRecord, setEditingRecord]               = useState(null);
  const [editAdditions, setEditAdditions]               = useState([]);
  const [editDeductions, setEditDeductions]             = useState([]);
  const [editAdjType, setEditAdjType]                   = useState('addition');
  const [editAdjCategory, setEditAdjCategory]           = useState('');
  const [editAdjAmount, setEditAdjAmount]               = useState('');
  const [editAdjNote, setEditAdjNote]                   = useState('');
  const [editAdjPaymentMethod, setEditAdjPaymentMethod] = useState('Tunai');

  /* ── Helpers ── */
  const formatRupiah = (amount) => `Rp${Number(amount || 0).toLocaleString('id-ID')}`;
  const formatJam = (hours) => {
    const h = Number(hours) || 0;
    if (h <= 0) return '';
    return (Math.ceil(Number(h.toFixed(4)) * 10) / 10).toFixed(1).replace('.', ',');
  };
  const toggleEmployeeCollapse = (empId) => {
    setCollapsedEmployees(prev => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  };

  /* ── hasAdjustments ── */
  const hasAdjustments = useMemo(() => {
    const r = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
    return r && (r.additions?.length > 0 || r.deductions?.length > 0);
  }, [dailyEmpId, dailyDate, employeeDailyRecords]);

  /* ── Effect 1: Auto-sync absensi → employeeDailyRecords ──
     Nyimak SEMUA tanggal yang ada di attendanceLog (bukan cuma dailyDate
     yang sedang dibuka di form), dan langsung ngitung + nempelin Bonus
     Full Time / Bonus Lembur via mergeAutoAdjustments. Ini satu-satunya
     sumber kebenaran sync data, jadi gak peduli datanya masuk dari absensi
     auto, web app karyawan, atau record dibuat manual — begitu masuk ke
     attendanceLog, record + bonusnya langsung kebentuk/keupdate sendiri,
     tanpa nunggu admin buka tanggal itu di form atau pencet Simpan.
     Juga ikut nyimak `employees` supaya kalau fullTimeBonus/overtimeRate30
     diubah di Kelola Karyawan, bonus yang udah tersimpan ikut ke-update. */
  useEffect(() => {
    if (!attendanceLog) return;
    const activeLogs = activeOnly(attendanceLog);
    if (activeLogs.length === 0) return;

    const pairsMap = new Map();
    activeLogs.forEach(r => {
      pairsMap.set(`${r.employeeId}|${r.dateStr}`, { employeeId: r.employeeId, dateStr: r.dateStr });
    });

    setEmployeeDailyRecords(prev => {
      let next = [...prev]; let changed = false;
      pairsMap.forEach(({ employeeId: empId, dateStr }) => {
        const result = computeAttendanceFromLogs(empId, dateStr, attendanceLog);
        if (result.status === 'Belum Absen' && !result.isDayOff) return;
        const emp = employees.find(e => e.id === empId);
        const prevIndex = next.findIndex(r => !r.deletedAt && r.employeeId === empId && r.dateStr === dateStr);
        const prevExisting = prevIndex >= 0 ? next[prevIndex] : null;

        const baseFields = { isDayOff: result.isDayOff, clockIn: result.clockIn, clockOut: result.clockOut, hoursWorked: result.hoursWorked, bolongMinutes: result.bolongMinutes, overtimeMinutes: result.overtimeMinutes };
        const recordSnapshot = { ...prevExisting, ...baseFields, employeeId: empId, dateStr };
        const recalculatedAdditions = mergeAutoAdjustments(prevExisting?.additions, recordSnapshot, emp);

        const isSame = prevExisting &&
          prevExisting.isDayOff === baseFields.isDayOff &&
          prevExisting.clockIn === baseFields.clockIn &&
          prevExisting.clockOut === baseFields.clockOut &&
          prevExisting.hoursWorked === baseFields.hoursWorked &&
          (prevExisting.bolongMinutes || 0) === baseFields.bolongMinutes &&
          (prevExisting.overtimeMinutes || 0) === baseFields.overtimeMinutes &&
          JSON.stringify(prevExisting.additions || []) === JSON.stringify(recalculatedAdditions);
        if (isSame) return;

        changed = true;
        if (prevExisting) {
          next[prevIndex] = { ...prevExisting, ...baseFields, additions: recalculatedAdditions };
        } else {
          next.unshift({ id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, employeeId: empId, date: new Date(dateStr), dateStr, ...baseFields, additions: recalculatedAdditions, deductions: [] });
        }
      });
      return changed ? next : prev;
    });
  }, [attendanceLog, employees, setEmployeeDailyRecords]);

  /* ── Effect 2: Load adj dari record yang sudah ada ──
     Record yang dimuat ke sini udah pasti termasuk Bonus Full Time/Lembur
     yang fresh (dari Effect 1 di atas) — form ini sekarang cuma dipakai
     buat nambah/edit item MANUAL (kasbon, bonus custom, dll). */
  useEffect(() => {
    if (dailyEmpId && dailyDate) {
      const r = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      setAdditions(r?.additions || []);
      setDeductions(r?.deductions || []);
    } else {
      setAdditions([]); setDeductions([]);
    }
  }, [dailyEmpId, dailyDate, employeeDailyRecords]);

  /* ── Handler Form Utama ── */
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
    const validDeductions = deductions.filter(d => d.category && d.amount > 0);
    const emp = employees.find(e => e.id === dailyEmpId);
    const empName = emp?.name || 'Karyawan';
    const generatedExpenses = [];
    const updatedDeductions = validDeductions.map(d => {
      if (d.paymentMethod === 'Tunai' && !d.expenseRecorded) {
        generatedExpenses.push({ id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, amount: d.amount, category: 'Lain-lain', note: `Potongan ${empName} (${d.category})${d.note ? ' - ' + d.note : ''}`, date: new Date(dailyDate), paymentMethod: 'Tunai', employeeId: dailyEmpId });
        return { ...d, expenseRecorded: true };
      }
      return d;
    });
    if (generatedExpenses.length > 0) setExpenses([...generatedExpenses, ...expenses]);
    const validAdditions = additions.filter(a => a.category && a.amount > 0);
    setEmployeeDailyRecords(prev => {
      const existing = prev.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      // Hitung ulang auto-adjustment (Bonus Full Time/Lembur) dari data absensi
      // terkini—jaga-jaga kalau Effect 1 belum sempat jalan duluan. Item manual
      // (additions dari state form) digabung, item auto lama otomatis diganti baru.
      if (existing) {
        const finalAdditions = mergeAutoAdjustments(validAdditions, existing, emp);
        return prev.map(r => r.id === existing.id ? { ...r, additions: finalAdditions, deductions: updatedDeductions } : r);
      }
      const computed = computeAttendanceFromLogs(dailyEmpId, dailyDate, attendanceLog);
      const newRecordBase = { employeeId: dailyEmpId, dateStr: dailyDate, isDayOff: computed.isDayOff, clockIn: computed.clockIn, clockOut: computed.clockOut, hoursWorked: computed.hoursWorked, bolongMinutes: computed.bolongMinutes, overtimeMinutes: computed.overtimeMinutes };
      const finalAdditions = mergeAutoAdjustments(validAdditions, newRecordBase, emp);
      return [{ id: `REC-${Date.now()}`, date: new Date(dailyDate), ...newRecordBase, additions: finalAdditions, deductions: updatedDeductions }, ...prev];
    });
    triggerAlert(hasAdjustments ? 'Perubahan berhasil diupdate!' : 'Data berhasil disimpan!');
  };

  /* ── Handler Delete / Move to Trash ── */
  const handleDeleteRecord = (rec) => {
    if (showTrash) {
      // Jika berada di Recycle Bin, konfirmasi sebelum hapus permanen
      triggerConfirm('Apakah Anda yakin ingin menghapus permanen data ini? Tindakan ini tidak dapat dibatalkan.', () => {
        setEmployeeDailyRecords(prev => prev.filter(r => r.id !== rec.id));
        triggerAlert('Data berhasil dihapus secara permanen!');
      });
    } else {
      // Jika di riwayat biasa, lakukan soft delete (pindah ke trash)
      setEmployeeDailyRecords(prev => prev.map(r => r.id === rec.id ? markDeleted(r) : r));
      triggerAlert('Data berhasil dipindahkan ke Recycle Bin!');
    }
  };

  /* ── Handler Modal Edit ── */
  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    setEditAdditions(rec.additions || []);
    setEditDeductions(rec.deductions || []);
    setEditAdjType('addition');
    setEditAdjCategory(''); setEditAdjAmount(''); setEditAdjNote(''); setEditAdjPaymentMethod('Tunai');
  };

  const handleCloseEdit = () => setEditingRecord(null);

  const handleEditAddAdjustment = () => {
    if (!editAdjCategory) return triggerAlert('Pilih kategori terlebih dahulu!');
    if (!editAdjAmount || Number(editAdjAmount) <= 0) return triggerAlert('Masukkan nominal yang valid!');
    const newItem = { id: Date.now() + Math.random(), category: editAdjCategory, amount: Number(editAdjAmount), note: editAdjNote, paymentMethod: editAdjType === 'deduction' ? editAdjPaymentMethod : null, expenseRecorded: false };
    if (editAdjType === 'addition') setEditAdditions(prev => [...prev, newItem]);
    else setEditDeductions(prev => [...prev, newItem]);
    setEditAdjAmount(''); setEditAdjNote('');
  };

  const handleEditRemoveAdjustment = (type, id) => {
    if (type === 'addition') setEditAdditions(prev => prev.filter(a => a.id !== id));
    else setEditDeductions(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    const emp = employees.find(e => e.id === editingRecord.employeeId);
    const empName = emp?.name || 'Karyawan';
    const validAdditions = editAdditions.filter(a => a.category && a.amount > 0);
    const validDeductions = editDeductions.filter(d => d.category && d.amount > 0);
    const generatedExpenses = [];
    const updatedDeductions = validDeductions.map(d => {
      if (d.paymentMethod === 'Tunai' && !d.expenseRecorded) {
        generatedExpenses.push({ id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, amount: d.amount, category: 'Lain-lain', note: `Potongan ${empName} (${d.category})${d.note ? ' - ' + d.note : ''}`, date: new Date(editingRecord.dateStr), paymentMethod: 'Tunai', employeeId: editingRecord.employeeId });
        return { ...d, expenseRecorded: true };
      }
      return d;
    });
    if (generatedExpenses.length > 0) setExpenses([...generatedExpenses, ...expenses]);
    // Sama seperti handleSaveDailyRecord: hitung ulang Bonus Full Time/Lembur dari
    // data absensi yang tersimpan di record ini, jangan cuma percaya additions lama.
    const finalAdditions = mergeAutoAdjustments(validAdditions, editingRecord, emp);
    setEmployeeDailyRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...r, additions: finalAdditions, deductions: updatedDeductions } : r));
    triggerAlert('Perubahan berhasil disimpan!');
    handleCloseEdit();
  };

  /* ── Computed values form utama ── */
  const hasUnsavedAdjustments = useMemo(() => {
    const existing = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
    return JSON.stringify(additions) !== JSON.stringify(existing?.additions || []) || JSON.stringify(deductions) !== JSON.stringify(existing?.deductions || []);
  }, [additions, deductions, dailyEmpId, dailyDate, employeeDailyRecords]);

  const adjustmentRows = useMemo(() => ([...additions.map(a => ({ ...a, _type: 'addition' })), ...deductions.map(d => ({ ...d, _type: 'deduction' }))]), [additions, deductions]);
  const totalAdditions = useMemo(() => additions.reduce((s, a) => s + (Number(a.amount) || 0), 0), [additions]);
  const totalDeductions = useMemo(() => deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0), [deductions]);
  const netAdjustment = totalAdditions - totalDeductions;

  /* ── Computed values modal edit ── */
  const editAdjRows = useMemo(() => ([...editAdditions.map(a => ({ ...a, _type: 'addition' })), ...editDeductions.map(d => ({ ...d, _type: 'deduction' }))]), [editAdditions, editDeductions]);
  const editTotalAdditions = useMemo(() => editAdditions.reduce((s, a) => s + (Number(a.amount) || 0), 0), [editAdditions]);
  const editTotalDeductions = useMemo(() => editDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0), [editDeductions]);
  const editNetAdjustment = editTotalAdditions - editTotalDeductions;
  const editingEmpName = editingRecord ? employees.find(e => e.id === editingRecord.employeeId)?.name : '';

  /* ── Riwayat dikelompokkan per karyawan ── */
  const groupedRecords = useMemo(() => {
    const rawList = showTrash ? trashedOnly(employeeDailyRecords) : activeOnly(employeeDailyRecords);
    const groups = new Map();
    rawList.forEach(rec => {
      if (!groups.has(rec.employeeId)) groups.set(rec.employeeId, []);
      groups.get(rec.employeeId).push(rec);
    });

    const grouped = Array.from(groups.entries()).map(([empId, recs]) => ({
      employee: employees.find(e => e.id === empId),
      records: recs.sort((a, b) => new Date(b.date) - new Date(a.date)),
    }));

    // Sort antar kelompok karyawan
    if (dailySortKey === 'name-asc') {
      grouped.sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''));
    } else {
      // date-desc: urut berdasar record terbaru tiap karyawan
      grouped.sort((a, b) => new Date(b.records[0]?.date) - new Date(a.records[0]?.date));
    }

    return grouped;
  }, [employeeDailyRecords, showTrash, dailySortKey, employees]);

  // Daftar flat semua record yang sedang tampil (lintas semua grup karyawan, termasuk yang collapsed)
  const allVisibleRecords = useMemo(() => groupedRecords.flatMap(g => g.records), [groupedRecords]);

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(allVisibleRecords);

  const handleBulkSoftDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} data input terpilih ke Recycle Bin?`, () => {
      setEmployeeDailyRecords(prev => prev.map(r => selectedIds.has(r.id) ? markDeleted(r) : r));
      resetSelection();
      triggerAlert('Data terpilih dipindahkan ke Recycle Bin.');
    });
  };

  const handleBulkPermanentDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} data input terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setEmployeeDailyRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      resetSelection();
      triggerAlert('Data terpilih dihapus permanen.');
    });
  };

  /* ══════════════════════════════════════════════════ */
  /*  RENDER                                           */
  /* ══════════════════════════════════════════════════ */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in fade-in slide-in-from-right-4 duration-300">

      {/* ─── KOLOM KIRI: Form Tambahan & Potongan ─── */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div ref={formRef}>
          <Card padding="lg" className="flex flex-col h-fit relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-600" />
                <h3 className="font-heading font-bold">Tambahan & Potongan</h3>
              </div>
              {hasAdjustments && <Badge variant="warning" className="animate-in zoom-in duration-200">Mode Edit</Badge>}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" label="Tanggal" variant="muted" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
                <Select label="Karyawan" variant="muted" value={dailyEmpId} onChange={e => setDailyEmpId(e.target.value)}>
                  <option value="">Pilih Karyawan</option>
                  {employees.filter(emp => getEmployeeStatus(emp) !== 'resign' || emp.id === dailyEmpId).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </Select>
              </div>

              {dailyEmpId && hasAdjustments && (
                <Alert type="callout" variant="info">Mengedit rincian pada <strong>{dailyDate}</strong>.</Alert>
              )}

              <SegmentedControl
                options={[{ value: 'addition', label: 'Penghasilan (+)', tone: 'green' }, { value: 'deduction', label: 'Potongan (-)', tone: 'red' }]}
                value={adjType}
                onChange={(val) => { setAdjType(val); setAdjCategory(''); }}
              />
              <div>
                <label className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                  Kategori
                  <Button type="button" size="xs" variant="secondary" onClick={() => setCatModalType(adjType)} icon={<Settings2 className="w-3 h-3" />}>Kelola</Button>
                </label>
                <Select variant="muted" value={adjCategory} onChange={e => setAdjCategory(e.target.value)}>
                  <option value="">Pilih Kategori</option>
                  {adjType === 'addition'
                    ? [...new Set(additionCategories)].filter(c => !c.toLowerCase().includes(LEMBUR_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                    : [...new Set(deductionCategories)].filter(c => !c.toLowerCase().includes(KASBON_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                  }
                </Select>
              </div>
              <Input type="number" label="Nominal" variant="muted" icon={<span>Rp</span>} value={adjAmount} onChange={e => setAdjAmount(e.target.value)} />
              <Input label="Catatan" variant="muted" value={adjNote} onChange={e => setAdjNote(e.target.value)} />
              {adjType === 'deduction' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Metode Pembayaran</label>
                  <SegmentedControl options={[{ value: 'Tunai', label: 'Tunai' }, { value: 'Non-Tunai', label: 'Non-Tunai' }]} value={adjPaymentMethod} onChange={setAdjPaymentMethod} />
                  <p className="text-[10px] text-slate-400 mt-1">Tunai = otomatis tercatat sebagai pengeluaran kas.</p>
                </div>
              )}
              <Button variant={adjType === 'addition' ? 'success' : 'danger'} size="full" icon={<Plus className="w-4 h-4" />} onClick={handleAddAdjustment}>
                {adjType === 'addition' ? 'Tambah Penghasilan' : 'Tambah Potongan'}
              </Button>

              {/* Rincian transaksi yang sedang di-compose */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-2">Rincian Transaksi</p>
                {adjustmentRows.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-3">Belum ada tambahan/potongan.</p>
                  : <div className="space-y-2">{adjustmentRows.map(item => <AdjRow key={item.id} item={item} onRemove={handleRemoveAdjustment} formatRupiah={formatRupiah} />)}</div>
                }
              </div>

              {adjustmentRows.length > 0 && (
                <div className="space-y-1 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500"><span>Total Tambahan</span><span className="font-bold text-green-700">+{formatRupiah(totalAdditions)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>Total Potongan</span><span className="font-bold text-red-700">-{formatRupiah(totalDeductions)}</span></div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-100"><span>Net</span><span>{netAdjustment >= 0 ? '+' : ''}{formatRupiah(netAdjustment)}</span></div>
                </div>
              )}

              {hasUnsavedAdjustments && <Alert type="callout" variant="warning">Ada perubahan yang belum disimpan.</Alert>}

              <Button variant="primary" size="full" icon={<Save className="w-4 h-4" />} onClick={handleSaveDailyRecord}>
                {hasAdjustments ? 'Simpan Perubahan (Update)' : 'Simpan Data'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── KOLOM KANAN: Riwayat Dikelompokkan per Karyawan ─── */}
      <Card padding="none" className="lg:col-span-2 flex flex-col h-[700px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-2xl">
          <h3 className="font-heading font-bold flex items-center gap-2">
            <History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Input'}
          </h3>
          <div className="flex gap-3">
            <button onClick={() => { setShowTrash(!showTrash); resetSelection(); }} className="text-xs font-bold text-slate-500">
              {showTrash ? 'Kembali' : 'Recycle Bin'}
            </button>
            <button onClick={() => setIsDailySortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 border rounded-lg px-2 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {allVisibleRecords.length > 0 && (
            <BulkSelectBar
              count={count}
              total={allVisibleRecords.length}
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              onDeleteSelected={showTrash ? handleBulkPermanentDelete : handleBulkSoftDelete}
            />
          )}

          {groupedRecords.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-10">Belum ada riwayat input.</p>
          )}

          {groupedRecords.map(({ employee, records }) => {
            const empId = employee?.id || records[0]?.employeeId;
            const isCollapsed = collapsedEmployees.has(empId);

            // Total akumulasi per karyawan (semua record)
            const empTotalAdd = records.reduce((s, r) => s + (r.additions || []).reduce((ss, a) => ss + (a.amount || 0), 0), 0);
            const empTotalDed = records.reduce((s, r) => s + (r.deductions || []).reduce((ss, d) => ss + (d.amount || 0), 0), 0);

            return (
              <div key={empId} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">

                {/* ── Header Karyawan (klik untuk collapse) ── */}
                <button
                  onClick={() => toggleEmployeeCollapse(empId)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-slate-800">{employee?.name || 'Tidak Dikenal'}</p>
                      <p className="text-[11px] text-slate-400">{records.length} record</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {empTotalAdd > 0 && <span className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">+{formatRupiah(empTotalAdd)}</span>}
                    {empTotalDed > 0 && <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">-{formatRupiah(empTotalDed)}</span>}
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* ── List Record Karyawan ── */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {records.map(rec => {
                      const isExpanded = expandedRecordId === rec.id;
                      const recTotalAdd = (rec.additions || []).reduce((s, a) => s + (a.amount || 0), 0);
                      const recTotalDed = (rec.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
                      const hasAdj = (rec.additions?.length || 0) + (rec.deductions?.length || 0) > 0;

                      return (
                        <div key={rec.id} className={`px-3 py-2.5 bg-white ${selectedIds.has(rec.id) ? 'bg-orange-50/60' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(rec.id)}
                                onChange={() => toggleSelectOne(rec.id)}
                                className="w-4 h-4 mt-0.5 rounded accent-orange-500 cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                              {/* Baris 1: Tanggal + jam kerja */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">{rec.dateStr}</span>
                                {rec.isDayOff ? (
                                  <Badge variant="neutral">Libur</Badge>
                                ) : (
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatJam(rec.hoursWorked) ? `${formatJam(rec.hoursWorked)} jam` : 'Belum clock-out'}
                                  </span>
                                )}
                              </div>

                              {/* Baris 2: Ringkasan tambahan/potongan */}
                              {hasAdj ? (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {recTotalAdd > 0 && (
                                    <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-md">
                                      +{formatRupiah(recTotalAdd)} ({rec.additions.length})
                                    </span>
                                  )}
                                  {recTotalDed > 0 && (
                                    <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md">
                                      -{formatRupiah(recTotalDed)} ({rec.deductions.length})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 mt-1">Belum ada rincian tambahan/potongan.</p>
                              )}
                              </div>
                            </div>

                            {/* Tombol aksi */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                                className="p-1.5 rounded-md text-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                title="Detail Jam Kerja"
                              >
                                {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              {!showTrash && (
                                <IconButton variant="edit" onClick={() => handleOpenEdit(rec)} title="Edit Tambahan/Potongan">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </IconButton>
                              )}
                              <IconButton 
                                variant="delete" 
                                onClick={() => handleDeleteRecord(rec)}
                                title={showTrash ? "Hapus Permanen" : "Hapus ke Recycle Bin"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>
                          </div>

                          {/* Expanded: detail jam absensi + rincian adj */}
                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 animate-in fade-in duration-200">
                              {rec.isDayOff ? (
                                <p className="text-xs text-slate-400 text-center py-2">Tidak ada data absensi (Libur).</p>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                    <StatField label="Jam Masuk" value={rec.clockIn} />
                                    <StatField label="Jam Keluar" value={rec.clockOut} />
                                    <StatField label="Bolong (Jam)" value={!rec.bolongMinutes ? '0,0' : (rec.bolongMinutes / 60).toFixed(1).replace('.', ',')} />
                                    <StatField label="Lembur (Jam)" value={!rec.overtimeMinutes ? '0,0' : (rec.overtimeMinutes / 60).toFixed(1).replace('.', ',')} highlight={rec.overtimeMinutes > 0} />
                                    <StatField label="Uang Lembur" value={rec.overtimeMinutes > 0 ? formatRupiah(calculateOvertimePay(rec.overtimeMinutes, getOvertimeRate(employees.find(e => e.id === rec.employeeId)))) : '-'} highlight={rec.overtimeMinutes > 0} />
                                    <StatField label="Total Jam" value={formatJam(rec.hoursWorked) || '0,0'} highlight />
                                  </div>

                                  {/* Rincian adj inline */}
                                  {hasAdj && (
                                    <div className="bg-slate-50 rounded-lg p-2.5">
                                      <p className="text-[11px] font-bold text-slate-500 mb-2">Rincian Tambahan / Potongan</p>
                                      <div className="space-y-1">
                                        {[...(rec.additions || []).map(a => ({ ...a, _type: 'addition' })), ...(rec.deductions || []).map(d => ({ ...d, _type: 'deduction' }))].map(item => (
                                          <div key={item.id} className={`flex justify-between items-center text-[11px] px-2 py-1.5 rounded-md ${item._type === 'addition' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                            <span className="font-semibold truncate pr-2">{item.category}{item.note ? ` · ${item.note}` : ''}</span>
                                            <span className="font-bold shrink-0">{item._type === 'addition' ? '+' : '-'}{formatRupiah(item.amount)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ════════════════════════════════════════ */}
      {/* MODAL EDIT TAMBAHAN & POTONGAN           */}
      {/* ════════════════════════════════════════ */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-slate-800">{editingEmpName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingRecord.dateStr} · Edit Tambahan & Potongan</p>
              </div>
              <button onClick={handleCloseEdit} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <SegmentedControl
                options={[{ value: 'addition', label: 'Penghasilan (+)', tone: 'green' }, { value: 'deduction', label: 'Potongan (-)', tone: 'red' }]}
                value={editAdjType}
                onChange={(val) => { setEditAdjType(val); setEditAdjCategory(''); }}
              />
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Kategori</label>
                <Select variant="muted" value={editAdjCategory} onChange={e => setEditAdjCategory(e.target.value)}>
                  <option value="">Pilih Kategori</option>
                  {editAdjType === 'addition'
                    ? [...new Set(additionCategories)].filter(c => !c.toLowerCase().includes(LEMBUR_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                    : [...new Set(deductionCategories)].filter(c => !c.toLowerCase().includes(KASBON_CATEGORY_KEYWORD)).map(c => <option key={c} value={c}>{c}</option>)
                  }
                </Select>
              </div>
              <Input type="number" label="Nominal" variant="muted" icon={<span>Rp</span>} value={editAdjAmount} onChange={e => setEditAdjAmount(e.target.value)} />
              <Input label="Catatan" variant="muted" value={editAdjNote} onChange={e => setEditAdjNote(e.target.value)} />
              {editAdjType === 'deduction' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Metode Pembayaran</label>
                  <SegmentedControl options={[{ value: 'Tunai', label: 'Tunai' }, { value: 'Non-Tunai', label: 'Non-Tunai' }]} value={editAdjPaymentMethod} onChange={setEditAdjPaymentMethod} />
                  <p className="text-[10px] text-slate-400 mt-1">Tunai = otomatis tercatat sebagai pengeluaran kas.</p>
                </div>
              )}
              <Button
                variant={editAdjType === 'addition' ? 'success' : 'danger'}
                size="full"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleEditAddAdjustment}
              >
                {editAdjType === 'addition' ? 'Tambah Penghasilan' : 'Tambah Potongan'}
              </Button>

              {/* Daftar adj yang sedang diedit */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-2">Rincian Saat Ini</p>
                {editAdjRows.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-3">Belum ada tambahan/potongan.</p>
                  : <div className="space-y-2">{editAdjRows.map(item => <AdjRow key={item.id} item={item} onRemove={handleEditRemoveAdjustment} formatRupiah={formatRupiah} />)}</div>
                }
              </div>

              {editAdjRows.length > 0 && (
                <div className="space-y-1 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500"><span>Total Tambahan</span><span className="font-bold text-green-700">+{formatRupiah(editTotalAdditions)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>Total Potongan</span><span className="font-bold text-red-700">-{formatRupiah(editTotalDeductions)}</span></div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-slate-100"><span>Net</span><span>{editNetAdjustment >= 0 ? '+' : ''}{formatRupiah(editNetAdjustment)}</span></div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <Button variant="secondary" size="full" onClick={handleCloseEdit}>Batal</Button>
              <Button variant="primary" size="full" icon={<Save className="w-4 h-4" />} onClick={handleSaveEdit}>
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      <SortModal isOpen={isDailySortOpen} onClose={() => setIsDailySortOpen(false)} value={dailySortKey} onChange={setDailySortKey} options={[{ key: 'date-desc', label: 'Terbaru Dulu' }, { key: 'name-asc', label: 'Nama (A-Z)' }]} />
      <CategoryModal isOpen={catModalType === 'addition'} onClose={() => setCatModalType(null)} title="Kategori Penghasilan" categories={additionCategories} setCategories={setAdditionCategories} triggerAlert={triggerAlert} triggerConfirm={triggerConfirm} onDeleteFallback={'Lainnya'} />
      <CategoryModal isOpen={catModalType === 'deduction'} onClose={() => setCatModalType(null)} title="Kategori Potongan" categories={deductionCategories} setCategories={setDeductionCategories} triggerAlert={triggerAlert} triggerConfirm={triggerConfirm} onDeleteFallback={'Lainnya'} />
    </div>
  );
};

export default InputDailyTab;