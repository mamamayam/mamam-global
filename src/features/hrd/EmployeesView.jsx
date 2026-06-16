import React, { useState, useMemo, useEffect, createContext, useContext, useRef } from 'react';
import { formatRupiah, toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import { useAppContext } from '../../context/AppContext';
import PayslipModal from '../hrd/modals/PayslipModal';
import CategoryModal from '../../components/CategoryModal';
import {
  Calendar,
  ChevronDown,
  UserCog,
  Info,
  Wallet,
  Plus,
  Trash2,
  Minus,
  Save,
  History,
  Clock,
  Edit3,
  PieChart,
  Printer,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Settings2
} from 'lucide-react';


// =========================================================================
// KOMPONEN: MANAJEMEN KARYAWAN (HR / PAYROLL)
// =========================================================================
const EmployeesView = () => {
  const {
    employees, setEmployees, formatRupiah, triggerAlert, triggerConfirm,
    employeeDailyRecords, setEmployeeDailyRecords,
    additionCategories, setAdditionCategories, deductionCategories, setDeductionCategories,
    payslipModal, setPayslipModal,
    expenses, setExpenses
  } = useAppContext();

  const [activeTab, setActiveTab] = useState('input'); // 'input', 'reports', 'manage'

  // --- STATE UNTUK TAB: KELOLA KARYAWAN ---
  const [isEditingEmp, setIsEditingEmp] = useState(false);
  const [empFormData, setEmpFormData] = useState({ id: '', name: '', phone: '', address: '', hourlyRate: 0, startDate: toLocalDateString() });

  // --- STATE UNTUK TAB: INPUT HARIAN ---
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('19:00');
  const [dailyDate, setDailyDate] = useState(toLocalDateString());
  const [dailyEmpId, setDailyEmpId] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [isDayOff, setIsDayOff] = useState(false);
  const [additions, setAdditions] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [isEditRecordMode, setIsEditRecordMode] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [catModalType, setCatModalType] = useState(null); // null | 'addition' | 'deduction'

  const [adjType, setAdjType] = useState('addition');
  const [adjCategory, setAdjCategory] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjPaymentMethod, setAdjPaymentMethod] = useState('Tunai');

  const empDropdownRef = useRef(null);

  // TUKANG HITUNG OTOMATIS (TAMBAHKAN KODE INI)
  useEffect(() => {
    if (isDayOff) {
      // Jika libur, paksa jam kerja jadi 0
      setHoursWorked(0);
    } else if (clockIn && clockOut) {
      const [inHours, inMinutes] = clockIn.split(':').map(Number);
      const [outHours, outMinutes] = clockOut.split(':').map(Number);

      const totalInMinutes = (inHours * 60) + inMinutes;
      let totalOutMinutes = (outHours * 60) + outMinutes;

      if (totalOutMinutes < totalInMinutes) {
        totalOutMinutes += 24 * 60;
      }

      const diffMinutes = totalOutMinutes - totalInMinutes;
      const calculatedHours = diffMinutes / 60;

      setHoursWorked(Number(calculatedHours.toFixed(2)));
    }
  }, [clockIn, clockOut, isDayOff]); // <-- Tambahkan isDayOff di sini

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
        setShowEmpDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- STATE UNTUK TAB: REKAP LAPORAN ---
  const [reportMonth, setReportMonth] = useState(toLocalMonthString());

  // --- LOGIC: KELOLA KARYAWAN ---
  const handleSaveEmployee = () => {
    if (!empFormData.name || empFormData.hourlyRate <= 0) return triggerAlert('Nama dan Upah per jam harus diisi dengan benar!');

    if (empFormData.id) {
      setEmployees(employees.map(e => e.id === empFormData.id ? empFormData : e));
      triggerAlert('Data Karyawan berhasil diupdate.');
    } else {
      setEmployees([...employees, { ...empFormData, id: `EMP-${Date.now()}` }]);
      triggerAlert('Karyawan baru berhasil ditambahkan.');
    }
    setIsEditingEmp(false);
    setEmpFormData({ id: '', name: '', phone: '', address: '', hourlyRate: 0, startDate: toLocalDateString() });
  };

  const handleDeleteEmployee = (id) => {
    triggerConfirm('Yakin ingin menghapus data karyawan ini? Data riwayat mungkin akan kehilangan referensi.', () => {
      setEmployees(employees.filter(e => e.id !== id));
      triggerAlert('Karyawan dihapus.');
    });
  };

  // --- LOGIC: INPUT HARIAN ---
  useEffect(() => {
    if (activeTab === 'input' && dailyEmpId && dailyDate) {
      const existingRecord = employeeDailyRecords.find(r => r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      if (existingRecord) {
        setIsEditRecordMode(true);
        setCurrentRecordId(existingRecord.id);
        // Pastikan format jam valid untuk input type="time"
        setClockIn(existingRecord.clockIn && existingRecord.clockIn !== '-' ? existingRecord.clockIn : '09:00');
        setClockOut(existingRecord.clockOut && existingRecord.clockOut !== '-' ? existingRecord.clockOut : '19:00');
        setHoursWorked(existingRecord.hoursWorked || '');
        setIsDayOff(existingRecord.isDayOff || false); // <-- Tarik data libur
        setAdditions(existingRecord.additions || []);
        setDeductions(existingRecord.deductions || []);
      } else {
        setIsEditRecordMode(false);
        setCurrentRecordId(null);
        setClockIn('09:00');
        setClockOut('19:00');
        setHoursWorked('');
        setIsDayOff(false); // <-- Reset status libur
        setAdditions([]);
        setDeductions([]);
      }
    }
  }, [dailyEmpId, dailyDate, employeeDailyRecords, activeTab]);

  const handleAddAdjustment = () => {
    if (!adjCategory) return triggerAlert('Pilih kategori terlebih dahulu!');
    if (!adjAmount || Number(adjAmount) <= 0) return triggerAlert('Masukkan nominal yang valid!');

    const newItem = {
      id: Date.now(),
      category: adjCategory,
      amount: Number(adjAmount),
      note: adjNote,
      paymentMethod: adjType === 'deduction' ? adjPaymentMethod : null,
      expenseRecorded: false
    };

    if (adjType === 'addition') {
      setAdditions([...additions, newItem]);
    } else {
      setDeductions([...deductions, newItem]);
    }

    setAdjAmount('');
    setAdjNote('');
  };

  const handleSaveDailyRecord = () => {
    if (!dailyEmpId) return triggerAlert('Pilih karyawan terlebih dahulu!');
    if (!dailyDate) return triggerAlert('Pilih tanggal input!');

    const validAdditions = additions.filter(a => a.category && a.amount > 0);
    const validDeductions = deductions.filter(d => d.category && d.amount > 0);
    const empName = employees.find(e => e.id === dailyEmpId)?.name || 'Karyawan';

    // Integrasi Pengeluaran (Kasbon manual via form daily di-log sbg pengeluaran)
    const generatedExpenses = [];
    const updatedDeductions = validDeductions.map(d => {
      if (d.paymentMethod === 'Tunai' && !d.expenseRecorded) {
        let expCategory = 'Lain-lain';
        if (d.category.toLowerCase().includes('kasbon')) expCategory = 'Kasbon Karyawan';

        generatedExpenses.push({
          id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          amount: d.amount,
          category: expCategory,
          note: `Potongan ${empName} (${d.category})${d.note ? ' - ' + d.note : ''}`,
          date: new Date(dailyDate),
          paymentMethod: 'Tunai',
          employeeId: dailyEmpId
        });

        return { ...d, expenseRecorded: true };
      }
      return d;
    });

    if (generatedExpenses.length > 0) {
      setExpenses([...generatedExpenses, ...expenses]);
    }

    const recordData = {
      id: isEditRecordMode ? currentRecordId : `REC-${Date.now()}`,
      employeeId: dailyEmpId,
      date: new Date(dailyDate),
      dateStr: dailyDate,
      isDayOff: isDayOff, // <-- Simpan status libur
      clockIn: isDayOff ? '' : clockIn,   // <-- Kosongkan jam jika libur
      clockOut: isDayOff ? '' : clockOut, // <-- Kosongkan jam jika libur
      hoursWorked: isDayOff ? 0 : (Number(hoursWorked) || 0),
      additions: validAdditions,
      deductions: updatedDeductions
    };

    if (isEditRecordMode) {
      setEmployeeDailyRecords(employeeDailyRecords.map(r => r.id === currentRecordId ? recordData : r));
      triggerAlert('Data harian berhasil diubah!');
    } else {
      setEmployeeDailyRecords([recordData, ...employeeDailyRecords]);
      triggerAlert('Data harian berhasil disimpan!');
    }
  };

  const handleDeleteDailyRecord = (id) => {
    triggerConfirm('Hapus catatan harian ini?', () => {
      setEmployeeDailyRecords(employeeDailyRecords.filter(r => r.id !== id));
      triggerAlert('Catatan dihapus.');
      setDailyEmpId('');
    });
  };

  const filteredRecordsForReport = useMemo(() => {
    return employeeDailyRecords.filter(r => toLocalMonthString(r.date) === reportMonth);
  }, [employeeDailyRecords, reportMonth]);

  const employeePerformance = useMemo(() => {
    const perf = {};
    filteredRecordsForReport.forEach(rec => {
      if (!perf[rec.employeeId]) {
        const emp = employees.find(e => e.id === rec.employeeId);
        perf[rec.employeeId] = {
          employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 },
          totalHours: 0, totalAdditions: 0, totalDeductions: 0, netPay: 0, records: []
        };
      }
      const data = perf[rec.employeeId];
      data.records.push(rec);
      data.totalHours += rec.hoursWorked;

      const addSum = rec.additions.reduce((sum, a) => sum + a.amount, 0);
      const dedSum = rec.deductions.reduce((sum, d) => sum + d.amount, 0);

      data.totalAdditions += addSum;
      data.totalDeductions += dedSum;
    });

    Object.values(perf).forEach(p => {
      const basicPay = p.totalHours * p.employee.hourlyRate;
      p.netPay = basicPay + p.totalAdditions - p.totalDeductions;
    });

    return Object.values(perf);
  }, [filteredRecordsForReport, employees]);

  const totalPayrollExpense = employeePerformance.reduce((sum, p) => sum + p.netPay, 0);

  const renderInputTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-fit">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Calendar className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Form Input Harian</h3>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative" ref={empDropdownRef}>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Karyawan</label>
              <div
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-semibold text-sm cursor-pointer flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setShowEmpDropdown(!showEmpDropdown)}
              >
                <span>{dailyEmpId ? employees.find(e => e.id === dailyEmpId)?.name : '-- Pilih Karyawan --'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>

              {showEmpDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-10 overflow-hidden flex flex-col animate-in slide-in-from-top-1 duration-200 max-h-60">
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {employees.map(emp => (
                      <div
                        key={emp.id}
                        className={`p-3 text-sm font-semibold cursor-pointer transition-colors ${dailyEmpId === emp.id ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-200'}`}
                        onClick={() => { setDailyEmpId(emp.id); setShowEmpDropdown(false); }}
                      >
                        {emp.name}
                      </div>
                    ))}
                    {employees.length === 0 && <div className="p-3 text-xs text-slate-400 dark:text-slate-500 text-center">Belum ada karyawan</div>}
                  </div>
                  <div
                    className="p-3 bg-slate-800 text-white text-xs font-bold text-center cursor-pointer hover:bg-slate-900 flex items-center justify-center gap-2 transition-colors border-t border-slate-700 dark:border-slate-300"
                    onClick={() => { setShowEmpDropdown(false); setActiveTab('manage'); }}
                  >
                    <UserCog className="w-4 h-4" /> Kelola Karyawan
                  </div>
                </div>
              )}
            </div>
            <div className="w-1/3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal</label>
              <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold text-sm outline-none focus:border-slate-800 dark:focus:border-slate-100 transition-colors" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
            </div>
          </div>

          {isEditRecordMode && (
            <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-blue-100 dark:border-blue-500/20 animate-in fade-in">
              <Info className="w-4 h-4" /> Data sudah ada, mengubah data yang ada.
            </div>
          )}

          {/* Checkbox Libur */}
          <div className="flex items-center gap-2 mb-2 p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl">
            <input
              type="checkbox"
              id="isDayOffToggle"
              checked={isDayOff}
              onChange={(e) => setIsDayOff(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer accent-orange-600"
            />
            <label htmlFor="isDayOffToggle" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
              Tandai sebagai Hari Libur / Off (Jam Kerja = 0)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Jam Masuk</label>
              <input type="time" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={clockIn} onChange={e => setClockIn(e.target.value)} disabled={isDayOff} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Jam Keluar</label>
              <input type="time" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={clockOut} onChange={e => setClockOut(e.target.value)} disabled={isDayOff} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Jumlah Jam Kerja (Otomatis)</label>
            <input
              type="number"
              className="w-full p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none cursor-not-allowed opacity-75"
              value={hoursWorked}
              readOnly
              placeholder="0"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 mt-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Tambahan & Potongan</h4>
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="adjType"
                  checked={adjType === 'addition'}
                  onChange={() => { setAdjType('addition'); setAdjCategory(''); }}
                  className="w-4 h-4 text-orange-600 dark:text-orange-400 focus:ring-orange-500 dark:focus:ring-orange-500"
                />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Penghasilan (+)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="adjType"
                  checked={adjType === 'deduction'}
                  onChange={() => { setAdjType('deduction'); setAdjCategory(''); }}
                  className="w-4 h-4 text-orange-600 dark:text-orange-400 focus:ring-orange-500 dark:focus:ring-orange-500"
                />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Potongan (-)</span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Kategori
                  <button type="button" onClick={() => setCatModalType(adjType)} className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                    <Settings2 className="w-3 h-3" /> Kelola
                  </button>
                </label>
                <select
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
                  value={adjCategory}
                  onChange={(e) => setAdjCategory(e.target.value)}
                >
                  <option value="">-- Pilih Kategori --</option>
                  {adjType === 'addition'
                    ? additionCategories.map(c => <option key={c} value={c}>{c}</option>)
                    : deductionCategories.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
                  placeholder="0"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
              </div>

              {adjType === 'deduction' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Metode (Sumber Potongan)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAdjPaymentMethod('Tunai')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${adjPaymentMethod === 'Tunai' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      Tunai
                    </button>
                    <button
                      onClick={() => setAdjPaymentMethod('Non-Tunai')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${adjPaymentMethod === 'Non-Tunai' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      Non-Tunai (Bank)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Catatan</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
                  placeholder="Opsional"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                />
              </div>

              <button
                onClick={handleAddAdjustment}
                className={`w-full py-3 mt-2 text-white font-bold rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center gap-2 ${adjType === 'addition' ? 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600' : 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500'}`}
              >
                <Plus className="w-4 h-4" />
                {adjType === 'addition' ? 'Tambah Penghasilan' : 'Tambah Potongan'}
              </button>
            </div>
          </div>

          {(additions.length > 0 || deductions.length > 0) && (
            <div className="border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 space-y-3">
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Daftar Penyesuaian</h5>

              {additions.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 mb-1"><Plus className="w-3 h-3" /> PENGHASILAN</span>
                  <div className="space-y-1.5">
                    {additions.map((add) => (
                      <div key={add.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm text-xs">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{add.category}</span>
                          {add.note && <span className="text-slate-400 dark:text-slate-500 ml-1 text-[10px]">({add.note})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600 dark:text-green-400">+{formatRupiah(add.amount)}</span>
                          <button onClick={() => setAdditions(additions.filter(a => a.id !== add.id))} className="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deductions.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-red-500 dark:text-red-400 flex items-center gap-1 mb-1 mt-2"><Minus className="w-3 h-3" /> POTONGAN</span>
                  <div className="space-y-1.5">
                    {deductions.map((ded) => (
                      <div key={ded.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm text-xs">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{ded.category}</span>
                          {ded.paymentMethod && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded text-[9px] ml-1">{ded.paymentMethod}</span>}
                          {ded.note && <span className="text-slate-400 dark:text-slate-500 ml-1 text-[10px]">({ded.note})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-500 dark:text-red-400">-{formatRupiah(ded.amount)}</span>
                          <button onClick={() => setDeductions(deductions.filter(d => d.id !== ded.id))} className="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button onClick={handleSaveDailyRecord} className="w-full py-3.5 mt-4 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> {isEditRecordMode ? 'Simpan Perubahan' : 'Simpan Data Harian'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[650px]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="w-4 h-4" /> Riwayat Input Harian</h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{employeeDailyRecords.length} Catatan</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {employeeDailyRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <Calendar className="w-12 h-12 mb-2 text-slate-400 dark:text-slate-500" />
              <p className="text-center text-slate-500 dark:text-slate-400 font-medium">Belum ada riwayat input karyawan.</p>
            </div>
          ) : (
            employeeDailyRecords.slice(0, 50).map(rec => {
              const emp = employees.find(e => e.id === rec.employeeId);
              const addSum = rec.additions.reduce((s, a) => s + a.amount, 0);
              const dedSum = rec.deductions.reduce((s, d) => s + d.amount, 0);
              return (
                <div key={rec.id} className="flex flex-col p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-orange-200 dark:hover:border-orange-500/30 transition-all duration-200 animate-in slide-in-from-left-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{emp ? emp.name : 'Karyawan (Dihapus)'}</p>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(rec.date).toLocaleDateString('id-ID')} • {rec.hoursWorked} Jam</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        setDailyEmpId(rec.employeeId); setDailyDate(rec.dateStr);
                      }} className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteDailyRecord(rec.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-bold block mb-1">Tambahan: +{formatRupiah(addSum)}</span>
                      {rec.additions.map((a, i) => <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400">- {a.category} ({formatRupiah(a.amount)})</div>)}
                    </div>
                    <div>
                      <span className="text-red-500 dark:text-red-400 font-bold block mb-1">Potongan: -{formatRupiah(dedSum)}</span>
                      {rec.deductions.map((d, i) => <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400">- {d.category} ({formatRupiah(d.amount)})</div>)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><PieChart className="w-5 h-5 text-orange-600 dark:text-orange-400" /> Rekap Penggajian</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Bulan Laporan:</label>
          <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="p-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-700 dark:text-slate-200 focus:border-orange-500 dark:focus:border-orange-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-sm border border-slate-700 dark:border-slate-300 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 dark:text-slate-500">Total Expenses Payroll</p>
          <h3 className="font-heading text-2xl font-black text-white">{formatRupiah(totalPayrollExpense)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Karyawan Aktif (Bulan Ini)</p>
          <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100">{employeePerformance.length} Orang</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Performa & Rincian Gaji Karyawan</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="p-4">Nama Karyawan</th>
                <th className="p-4 text-center">Total Jam</th>
                <th className="p-4 text-right">Tambahan</th>
                <th className="p-4 text-right">Potongan</th>
                <th className="p-4 text-right">Gaji Bersih (Net)</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {employeePerformance.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">Tidak ada data penggajian pada bulan ini.</td></tr>
              ) : (
                employeePerformance.map(p => (
                  <tr key={p.employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.employee.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Upah/Jam: {formatRupiah(p.employee.hourlyRate)}</p>
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-sm">{p.totalHours}</td>
                    <td className="p-4 text-right font-bold text-green-600 dark:text-green-400 text-sm">+{formatRupiah(p.totalAdditions)}</td>
                    <td className="p-4 text-right font-bold text-red-500 dark:text-red-400 text-sm">-{formatRupiah(p.totalDeductions)}</td>
                    <td className="p-4 text-right font-black text-slate-900 dark:text-slate-50 text-sm">{formatRupiah(p.netPay)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })} className="px-3 py-1.5 bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/20 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1">
                        <Printer className="w-3 h-3" /> Cetak Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 mt-6 mb-10">
        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-4">Riwayat Bulan Sebelumnya</h4>
        <div className="space-y-2">
          {[1, 2, 3].map(i => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const pastMonth = toLocalMonthString(d);
            return (
              <div key={i} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-colors" onClick={() => setReportMonth(pastMonth)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"><Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" /></div>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderManageTab = () => (
    <div className="h-full animate-in fade-in slide-in-from-left-4 duration-300">
      {isEditingEmp ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 max-w-3xl">
          <button onClick={() => setIsEditingEmp(false)} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors">
            <ChevronLeft className="w-5 h-5" /> Kembali
          </button>
          <h2 className="font-heading text-xl font-bold mb-6 text-slate-800 dark:text-slate-100 border-b pb-2">{empFormData.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nama Lengkap</label>
              <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-semibold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={empFormData.name} onChange={e => setEmpFormData({ ...empFormData, name: e.target.value })} placeholder="Misal: Budi Santoso" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">No. Handphone (WA)</label>
              <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-semibold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={empFormData.phone} onChange={e => setEmpFormData({ ...empFormData, phone: e.target.value })} placeholder="Misal: 0812345678" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Alamat</label>
              <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-semibold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={empFormData.address} onChange={e => setEmpFormData({ ...empFormData, address: e.target.value })} placeholder="Alamat lengkap..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Upah per Jam (Rp)</label>
              <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={empFormData.hourlyRate} onChange={e => setEmpFormData({ ...empFormData, hourlyRate: Number(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Mulai Kerja</label>
              <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-semibold outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={empFormData.startDate} onChange={e => setEmpFormData({ ...empFormData, startDate: e.target.value })} />
            </div>
          </div>

          <button onClick={handleSaveEmployee} className="px-8 py-3 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            Simpan Data Karyawan
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Briefcase className="w-5 h-5 text-slate-700 dark:text-slate-200" /> Daftar Karyawan</h3>
            <button onClick={() => {
              setEmpFormData({ id: '', name: '', phone: '', address: '', hourlyRate: 0, startDate: toLocalDateString() });
              setIsEditingEmp(true);
            }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-slate-900 transition-all duration-300">
              <Plus className="w-4 h-4" /> Tambah Karyawan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
            {employees.map(emp => (
              <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 relative group hover:shadow-md transition-shadow duration-300">
                <div className="absolute top-4 right-4 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEmpFormData(emp); setIsEditingEmp(true); }} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-heading font-black text-xl">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base leading-tight pr-10">{emp.name}</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Gabung: {new Date(emp.startDate).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-medium">No. HP:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{emp.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-medium">Upah/Jam:</span><span className="font-bold text-orange-600 dark:text-orange-400">{formatRupiah(emp.hourlyRate)}</span></div>
                  <div className="flex flex-col mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Alamat:</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{emp.address || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
            {employees.length === 0 && <div className="col-span-full p-8 text-center text-slate-400 dark:text-slate-500 italic">Belum ada data karyawan.</div>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <div className="shrink-0 mb-6">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><UserCog className="w-6 h-6 text-slate-800 dark:text-slate-100" /> Manajemen Pegawai (HR)</h2>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('input')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'input' ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Input Harian</button>
          <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'reports' ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Rekap Laporan</button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'manage' ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Kelola Karyawan</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'input' && renderInputTab()}
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'manage' && renderManageTab()}
      </div>
      <PayslipModal />

      <CategoryModal
        isOpen={catModalType === 'addition'}
        onClose={() => setCatModalType(null)}
        title="Kelola Kategori Penghasilan Tambahan"
        categories={additionCategories}
        setCategories={setAdditionCategories}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        onDeleteFallback={additionCategories[0] || 'Lainnya'}
        onDelete={(deletedCat) => {
          if (adjCategory === deletedCat) setAdjCategory('');
        }}
      />
      <CategoryModal
        isOpen={catModalType === 'deduction'}
        onClose={() => setCatModalType(null)}
        title="Kelola Kategori Potongan"
        categories={deductionCategories}
        setCategories={setDeductionCategories}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        onDeleteFallback={deductionCategories[0] || 'Lainnya'}
        onDelete={(deletedCat) => {
          if (adjCategory === deletedCat) setAdjCategory('');
        }}
      />
    </div>
  );
};

export default EmployeesView;