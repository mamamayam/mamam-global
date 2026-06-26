import React, { useState, useMemo, useEffect } from 'react';
import { formatRupiah, toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import { useAppContext } from '../../context/AppContext';
import PayslipModal from '../hrd/modals/PayslipModal';
import CategoryModal from '../../components/CategoryModal';
import {
  Select, Card, Button, PageHeader, EmptyState, Input,
  SegmentedControl, Badge, Alert, IconButton, SortModal
} from '../../components/ui';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { applySort } from '../../utils/sortUtils';
import { pushTransactionDelete } from '../../storage/realtimeSync';
import {
  Calendar,
  UserCog,
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
  Settings2,
  RotateCcw,
  Users,
  ArrowUpDown
} from 'lucide-react';

// Hitung jumlah jam kerja dari jam masuk & jam keluar (format "HH:MM").
// Dipakai di efek otomatis & saat reset form pilih karyawan baru, supaya
// keduanya konsisten dan jam kerja selalu langsung terhitung (tidak perlu
// toggle Libur/Masuk dulu baru muncul).
function calculateHoursFromTimes(clockInStr, clockOutStr) {
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

// Format ISO datetime → "HH:MM" (dipakai buat auto-fill dari attendanceLog).
function formatTimeFromDate(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// === Konstanta aturan jam kerja & lembur ===
const OVERTIME_THRESHOLD_MINUTES = 19 * 60 + 30; // 19:30 — mulai dihitung lembur otomatis
const OVERTIME_RATE_PER_30MIN = 5000;            // Rp per 30 menit lembur setelah 19:30
const SIANG_SHIFT_START_MINUTES = 11 * 60;       // jam masuk >= 11:00 dianggap shift siang (tidak dapat Bonus Full Time)

// "HH:MM" → total menit dari tengah malam.
function timeStrToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}

// Total menit jam masuk→keluar yang kontinu (nambah 24 jam kalau keluar
// "lewat tengah malam"), dipakai biar perbandingan ke jam 19:30 tetap benar.
function getClockOutMinutesContinuous(clockInStr, clockOutStr) {
  const inTotal = timeStrToMinutes(clockInStr);
  let outTotal = timeStrToMinutes(clockOutStr);
  if (outTotal < inTotal) outTotal += 24 * 60;
  return outTotal;
}

// Hitung total menit "jam bolong" dari rangkaian absensi satu karyawan dalam
// satu hari (sudah diurutkan ascending by date). Tiap record 'bolong' jadi
// awal jeda; jeda berakhir di record berikutnya, baik itu 'masuk' lagi
// (balik kerja) atau 'keluar' (lupa absen balik, sampai hari ditutup).
function calculateBolongMinutes(sortedLogs) {
  let totalMinutes = 0;
  for (let i = 0; i < sortedLogs.length - 1; i++) {
    if (sortedLogs[i].type === 'bolong') {
      const gapStart = new Date(sortedLogs[i].date).getTime();
      const gapEnd = new Date(sortedLogs[i + 1].date).getTime();
      totalMinutes += Math.max(0, (gapEnd - gapStart) / 60000);
    }
  }
  return totalMinutes;
}

// === Status Karyawan ===
// Mau nambah status baru? Tinggal tambahin object baru di array ini —
// form, badge, sama filter di bawah otomatis ngikut, gak perlu ubah di
// banyak tempat.
const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif', badgeVariant: 'success' },
  { value: 'freelance', label: 'Freelance', badgeVariant: 'info' },
  { value: 'cuti', label: 'Cuti', badgeVariant: 'warning' },
  { value: 'resign', label: 'Resign', badgeVariant: 'neutral' },
];

// Data karyawan lama (sebelum fitur status ada) gak punya field `status` —
// default-in ke 'aktif' di sini biar karyawan lama otomatis kebaca Aktif
// tanpa perlu migration data manual.
function getEmployeeStatus(emp) {
  return emp?.status || 'aktif';
}

function getEmployeeStatusInfo(status) {
  return EMPLOYEE_STATUS_OPTIONS.find(s => s.value === status) || EMPLOYEE_STATUS_OPTIONS[0];
}


// =========================================================================
// KOMPONEN: MANAJEMEN KARYAWAN (HR / PAYROLL)
// =========================================================================
const EmployeesView = () => {
  const {
    employees, setEmployees, formatRupiah, triggerAlert, triggerConfirm,
    employeeDailyRecords, setEmployeeDailyRecords,
    additionCategories, setAdditionCategories, deductionCategories, setDeductionCategories,
    payslipModal, setPayslipModal,
    expenses, setExpenses,
    attendanceLog,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState('input'); // 'input', 'reports', 'manage'

  // --- STATE UNTUK TAB: KELOLA KARYAWAN ---
  const [isEditingEmp, setIsEditingEmp] = useState(false);
  const [empFormData, setEmpFormData] = useState({ id: '', name: '', phone: '', address: '', hourlyRate: 0, fullTimeBonus: 0, startDate: toLocalDateString(), status: 'aktif', resignDate: '' });

  // --- STATE UNTUK TAB: INPUT HARIAN ---
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('19:00');
  const [dailyDate, setDailyDate] = useState(toLocalDateString());
  const [dailyEmpId, setDailyEmpId] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [bolongMinutes, setBolongMinutes] = useState(0); // total menit jam bolong yang dipotong dari jam kerja
  const [isDayOff, setIsDayOff] = useState(false);
  const [additions, setAdditions] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [isEditRecordMode, setIsEditRecordMode] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [catModalType, setCatModalType] = useState(null); // null | 'addition' | 'deduction'
  const [showTrash, setShowTrash] = useState(false); // toggle: riwayat normal vs recycle bin

  // State urutan buat 3 list di view ini (masing-masing independen)
  const [dailySortKey, setDailySortKey] = useState('date-desc'); // Riwayat Input Harian
  const [isDailySortOpen, setIsDailySortOpen] = useState(false);
  const [perfSortKey, setPerfSortKey] = useState('name-asc'); // Performa & Gaji Karyawan
  const [isPerfSortOpen, setIsPerfSortOpen] = useState(false);
  const [empSortKey, setEmpSortKey] = useState('name-asc'); // Daftar Karyawan (Kelola)
  const [isEmpSortOpen, setIsEmpSortOpen] = useState(false);
  const [empStatusFilter, setEmpStatusFilter] = useState('semua'); // filter status Daftar Karyawan

  // Flag: jam masuk/keluar terisi otomatis dari data attendanceLog
  const [absenFromAttendance, setAbsenFromAttendance] = useState(false);

  const [adjType, setAdjType] = useState('addition');
  const [adjCategory, setAdjCategory] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [adjPaymentMethod, setAdjPaymentMethod] = useState('Tunai');

  // Hitung otomatis jumlah jam kerja setiap kali jam masuk/keluar/status libur
  // (atau total jam bolong) berubah. Jam bolong memotong jam kerja: jam masuk
  // & jam keluar di sini cuma catatan jam akhir, bukan dasar hitung langsung.
  useEffect(() => {
    if (isDayOff) {
      // Jika libur, paksa jam kerja jadi 0
      setHoursWorked(0);
    } else if (clockIn && clockOut) {
      const rawHours = calculateHoursFromTimes(clockIn, clockOut);
      const netHours = Math.max(0, rawHours - (bolongMinutes / 60));
      setHoursWorked(Number(netHours.toFixed(2)));
    }
  }, [clockIn, clockOut, isDayOff, bolongMinutes]);

  // 1. AUTO BONUS FULL TIME (Jika jam kerja >= 10, kecuali shift siang)
  useEffect(() => {
    if (!dailyEmpId) return;
    const emp = employees.find(e => e.id === dailyEmpId);
    if (!emp) return;

    const bonusAmount = emp.fullTimeBonus || 0;
    // Shift siang (jam masuk >= 11:00) tidak dapat Bonus Full Time walaupun
    // jam kerja tembus 10 jam — shift ini dapat Bonus Lembur sendiri (lihat efek di bawah).
    const isShiftSiang = clockIn ? timeStrToMinutes(clockIn) >= SIANG_SHIFT_START_MINUTES : false;

    // Jika kerja 10 jam atau lebih, upah bonusnya ada, dan bukan shift siang
    if (Number(hoursWorked) >= 10 && bonusAmount > 0 && !isShiftSiang) {
      setAdditions(prev => {
        // Cek apakah bonus sudah masuk biar tidak duplikat
        const hasBonus = prev.some(a => a.category === 'Bonus Full Time');
        if (!hasBonus) {
          return [...prev, {
            id: Date.now() + Math.random(),
            category: 'Bonus Full Time',
            amount: Number(bonusAmount),
            note: '(10 jam)',
            expenseRecorded: false
          }];
        }
        return prev;
      });
    } else {
      // Jam kerja < 10, atau shift siang, atau upah bonus belum diset → tarik kembali bonusnya
      setAdditions(prev => prev.filter(a => a.category !== 'Bonus Full Time'));
    }
  }, [hoursWorked, dailyEmpId, employees, clockIn]);

  // 1B. AUTO BONUS LEMBUR (jam keluar lewat dari 19:30 → Rp5.000 / 30 menit)
  // Berlaku untuk semua shift, termasuk shift siang yang tidak dapat Bonus Full Time.
  useEffect(() => {
    if (!dailyEmpId || isDayOff || !clockIn || !clockOut) {
      setAdditions(prev => prev.filter(a => a.category !== 'Bonus Lembur'));
      return;
    }

    const outMinutes = getClockOutMinutesContinuous(clockIn, clockOut);
    const overtimeMinutes = Math.max(0, outMinutes - OVERTIME_THRESHOLD_MINUTES);
    const blocks = Math.floor(overtimeMinutes / 30);
    const lemburAmount = blocks * OVERTIME_RATE_PER_30MIN;

    setAdditions(prev => {
      const withoutAuto = prev.filter(a => a.category !== 'Bonus Lembur');
      if (lemburAmount > 0) {
        return [...withoutAuto, {
          id: Date.now() + Math.random(),
          category: 'Bonus Lembur',
          amount: lemburAmount,
          note: `(${blocks * 30} menit setelah 19:30)`,
          expenseRecorded: false
        }];
      }
      return withoutAuto;
    });
  }, [clockIn, clockOut, isDayOff, dailyEmpId]);

  // 2. AUTO HITUNG UANG LEMBUR
  useEffect(() => {
    // Mengecek apakah kategori yang dipilih bernama "Lembur"
    if (adjCategory.toLowerCase() === 'lembur') {
      const emp = employees.find(e => e.id === dailyEmpId);
      if (emp && overtimeHours) {
        // Otomatis ubah Nominal = Jam Lembur * Upah per Jam
        setAdjAmount(Number(overtimeHours) * (emp.hourlyRate || 0));
      } else {
        setAdjAmount('');
      }
    }
  }, [overtimeHours, adjCategory, dailyEmpId, employees]);

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
    setEmpFormData({ id: '', name: '', phone: '', address: '', hourlyRate: 0, fullTimeBonus: 0, startDate: toLocalDateString(), status: 'aktif', resignDate: '' });
  };

  const handleDeleteEmployee = (id) => {
    triggerConfirm('Yakin ingin menghapus data karyawan ini? Data riwayat mungkin akan kehilangan referensi.', () => {
      setEmployees(employees.filter(e => e.id !== id));
      triggerAlert('Karyawan dihapus.');
    });
  };

  // --- LOGIC: INPUT HARIAN ---
  // Load existing daily record saat karyawan/tanggal dipilih,
  // atau auto-fill dari attendanceLog jika record belum ada.
  useEffect(() => {
    if (activeTab === 'input' && dailyEmpId && dailyDate) {
      const existingRecord = employeeDailyRecords.find(r => !r.deletedAt && r.employeeId === dailyEmpId && r.dateStr === dailyDate);
      if (existingRecord) {
        // Record sudah ada — load seperti biasa
        setIsEditRecordMode(true);
        setCurrentRecordId(existingRecord.id);
        const wasOff = existingRecord.isDayOff || false;
        setClockIn(wasOff ? '00:00' : (existingRecord.clockIn && existingRecord.clockIn !== '-' ? existingRecord.clockIn : '09:00'));
        setClockOut(wasOff ? '00:00' : (existingRecord.clockOut && existingRecord.clockOut !== '-' ? existingRecord.clockOut : '19:00'));
        setHoursWorked(existingRecord.hoursWorked || '');
        setBolongMinutes(0); // jam kerja record lama sudah final, gak perlu dipotong ulang
        setIsDayOff(wasOff);
        setAdditions(existingRecord.additions || []);
        setDeductions(existingRecord.deductions || []);
        setAbsenFromAttendance(false); // record manual, bukan dari absensi
      } else {
        // Belum ada record — coba ambil dari attendanceLog
        setIsEditRecordMode(false);
        setCurrentRecordId(null);
        setAdditions([]);
        setDeductions([]);

        const empLogs = activeOnly(attendanceLog ?? [])
          .filter(r => r.employeeId === dailyEmpId && r.dateStr === dailyDate)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Ambil record masuk pertama & keluar terakhir sebagai catatan jam akhir saja —
        // jam kerja sesungguhnya dihitung (masuk→keluar) dikurangi total jam bolong di tengah.
        const masukRec  = empLogs.find(r => r.type === 'masuk');
        const keluarRec = [...empLogs].reverse().find(r => r.type === 'keluar');

        if (masukRec) {
          // Ada data absensi → auto-fill
          const masukStr  = formatTimeFromDate(masukRec.date);
          const keluarStr = keluarRec ? formatTimeFromDate(keluarRec.date) : '19:00';
          setClockIn(masukStr);
          setClockOut(keluarStr);
          setIsDayOff(false);
          setAbsenFromAttendance(true);
          setBolongMinutes(calculateBolongMinutes(empLogs));
        } else {
          // Tidak ada data sama sekali → default libur (perilaku asli)
          setClockIn('09:00');
          setClockOut('19:00');
          setIsDayOff(true);
          setAbsenFromAttendance(false);
          setBolongMinutes(0);
        }
      }
    }
  }, [dailyEmpId, dailyDate, employeeDailyRecords, activeTab, attendanceLog]);

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
    setOvertimeHours('');
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
      setEmployeeDailyRecords(employeeDailyRecords.map(r => r.id === id ? markDeleted(r) : r));
      triggerAlert('Catatan dihapus!');
      setDailyEmpId('');
    });
  };

  const handleRestoreDailyRecord = (id) => {
    setEmployeeDailyRecords(employeeDailyRecords.map(r => r.id === id ? restoreItem(r) : r));
    triggerAlert('Catatan dipulihkan!');
  };

  const handlePermanentDeleteDailyRecord = (id) => {
    triggerConfirm('Hapus permanen catatan ini? Tindakan ini tidak bisa dibatalkan', () => {
      setEmployeeDailyRecords(employeeDailyRecords.filter(r => r.id !== id));
      // Langsung kirim delete ke Supabase saat ini juga — gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
      pushTransactionDelete('employeeDailyRecords', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Catatan dihapus permanen');
    });
  };

  // Daftar yang ditampilkan di kartu "Riwayat Input Harian": aktif kalau
  // mode normal, atau yang sudah dihapus (recycle bin) kalau showTrash aktif.
  const visibleDailyRecords = showTrash ? trashedOnly(employeeDailyRecords) : activeOnly(employeeDailyRecords);

  // Urutkan riwayat input harian pakai dailySortKey terpilih
  const sortedDailyRecords = applySort(visibleDailyRecords, dailySortKey, {
    date: r => new Date(r.date),
    name: r => employees.find(e => e.id === r.employeeId)?.name || '',
    hours: r => r.hoursWorked || 0,
  });

  const dailyRecordSortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'name-asc', label: 'Nama Karyawan (A-Z)' },
    { key: 'name-desc', label: 'Nama Karyawan (Z-A)' },
    { key: 'hours-desc', label: 'Jam Kerja Terbanyak' },
  ];

  const filteredRecordsForReport = useMemo(() => {
    return activeOnly(employeeDailyRecords).filter(r => toLocalMonthString(r.date) === reportMonth);
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

  // Urutkan tabel performa & gaji pakai perfSortKey terpilih
  const sortedEmployeePerformance = applySort(employeePerformance, perfSortKey, {
    name: p => p.employee?.name || '',
    netpay: p => p.netPay || 0,
    hours: p => p.totalHours || 0,
  });

  const perfSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'netpay-desc', label: 'Gaji Bersih Terbesar' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
  ];

  // Filter daftar karyawan (tab Kelola) berdasarkan status terpilih
  const filteredEmployeesByStatus = empStatusFilter === 'semua'
    ? employees
    : employees.filter(e => getEmployeeStatus(e) === empStatusFilter);

  // Urutkan daftar karyawan (tab Kelola) pakai empSortKey terpilih
  const sortedEmployees = applySort(filteredEmployeesByStatus, empSortKey, {
    name: e => e.name || '',
    rate: e => e.hourlyRate || 0,
    date: e => new Date(e.startDate),
  });

  const empListSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'rate-desc', label: 'Upah Tertinggi' },
    { key: 'date-desc', label: 'Gabung Terbaru' },
    { key: 'date-asc', label: 'Gabung Terlama' },
  ];

  const renderInputTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <Card padding="lg" className="lg:col-span-1 flex flex-col h-fit">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Calendar className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Form Input Harian</h3>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                label="Karyawan"
                variant="muted"
                value={dailyEmpId}
                onChange={e => setDailyEmpId(e.target.value)}
              >
                <option value="">Pilih Karyawan</option>
                {employees
                  .filter(emp => getEmployeeStatus(emp) !== 'resign' || emp.id === dailyEmpId)
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {getEmployeeStatus(emp) !== 'aktif' ? ` (${getEmployeeStatusInfo(getEmployeeStatus(emp)).label})` : ''}
                    </option>
                  ))
                }
              </Select>
            </div>
            <div className="w-1/3">
              <Input
                type="date"
                label="Tanggal"
                variant="muted"
                value={dailyDate}
                onChange={e => setDailyDate(e.target.value)}
              />
            </div>
          </div>

          {employees.length === 0 && (
            <Alert
              type="callout"
              variant="warning"
              action={<Button size="xs" variant="secondary" onClick={() => setActiveTab('manage')}>Tambah</Button>}
            >
              Belum ada data karyawan.
            </Alert>
          )}

          {isEditRecordMode && (
            <Alert type="callout" variant="info">
              Data sudah ada, mengubah data yang ada.
            </Alert>
          )}

          {/* Toggle Masuk / Libur */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Status Kehadiran
            </label>
            <SegmentedControl
              options={[
                { value: false, label: 'Masuk', tone: 'green' },
                { value: true, label: 'Libur', tone: 'red' },
              ]}
              value={isDayOff}
              onChange={(val) => {
                setIsDayOff(val);
                setAbsenFromAttendance(false);
                setBolongMinutes(0); // toggle manual → bukan lagi dari data absensi
                if (val) {
                  setClockIn('00:00');
                  setClockOut('00:00');
                } else {
                  setClockIn('09:00');
                  setClockOut('19:00');
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {absenFromAttendance && !isDayOff && (
              <div className="col-span-2">
                <Alert type="callout" variant="info">
                  Jam terisi otomatis dari data absensi. Edit jika perlu koreksi.
                  {bolongMinutes > 0 && (
                    <> Jam kerja sudah dipotong <strong>{Math.round(bolongMinutes)} menit</strong> jam bolong.</>
                  )}
                </Alert>
              </div>
            )}
            <Input
              type="time"
              label="Jam Masuk"
              variant="muted"
              value={clockIn}
              onChange={e => { setClockIn(e.target.value); setAbsenFromAttendance(false); }}
              disabled={isDayOff}
            />
            <Input
              type="time"
              label="Jam Keluar"
              variant="muted"
              value={clockOut}
              onChange={e => { setClockOut(e.target.value); setAbsenFromAttendance(false); }}
              disabled={isDayOff}
            />
          </div>

          <Input
            type="number"
            label="Jumlah Jam Kerja"
            variant="muted"
            value={hoursWorked}
            readOnly
            placeholder="0"
            className="opacity-75 cursor-not-allowed"
          />

          <Card padding="md" className="mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Tambahan & Potongan</h4>
            </div>

            <div className="space-y-4">
              <SegmentedControl
                options={[
                  { value: 'addition', label: 'Penghasilan (+)', tone: 'green' },
                  { value: 'deduction', label: 'Potongan (-)', tone: 'red' },
                ]}
                value={adjType}
                onChange={(val) => { setAdjType(val); setAdjCategory(''); }}
              />

              <div>
                <label className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Kategori
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => setCatModalType(adjType)}
                    icon={<Settings2 className="w-3 h-3" />}
                  >
                    Kelola Kategori
                  </Button>
                </label>
                <Select
                  variant="muted"
                  value={adjCategory}
                  onChange={(e) => setAdjCategory(e.target.value)}
                >
                  <option value="">Pilih Kategori</option>
                  {adjType === 'addition'
                    ? [...new Set(additionCategories)].map(c => <option key={c} value={c}>{c}</option>)
                    : [...new Set(deductionCategories)].map(c => <option key={c} value={c}>{c}</option>)
                  }
                </Select>
              </div>

              {adjCategory.toLowerCase() === 'lembur' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    label="Total Jam Lembur"
                    variant="muted"
                    placeholder="Contoh: 2.5"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                  />
                </div>
              )}

              <Input
                type="number"
                label={adjCategory.toLowerCase() === 'lembur' ? 'Nominal Lembur' : 'Nominal'}
                variant="muted"
                icon={<span className="font-bold">Rp</span>}
                placeholder="0"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                readOnly={adjCategory.toLowerCase() === 'lembur'}
                className={adjCategory.toLowerCase() === 'lembur' ? 'opacity-80 cursor-not-allowed' : ''}
              />

              {adjType === 'deduction' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Metode (Sumber Potongan)
                  </label>
                  <SegmentedControl
                    size="sm"
                    options={[
                      { value: 'Tunai', label: 'Tunai', tone: 'red-soft' },
                      { value: 'Non-Tunai', label: 'Non-Tunai (Bank)', tone: 'red-soft' },
                    ]}
                    value={adjPaymentMethod}
                    onChange={setAdjPaymentMethod}
                  />
                </div>
              )}

              <Input
                label="Catatan"
                variant="muted"
                placeholder="Opsional"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
              />

              <Button
                variant={adjType === 'addition' ? 'success' : 'danger'}
                size="full"
                className="mt-2"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleAddAdjustment}
              >
                {adjType === 'addition' ? 'Tambah Penghasilan' : 'Tambah Potongan'}
              </Button>
            </div>
          </Card>

          {(additions.length > 0 || deductions.length > 0) && (
            <Card variant="muted" padding="sm" className="space-y-3">
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daftar Penyesuaian</h5>

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
                          <IconButton variant="delete" size="sm" onClick={() => setAdditions(additions.filter(a => a.id !== add.id))}>
                            <Trash2 className="w-3 h-3" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deductions.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-accent-500 dark:text-accent-400 flex items-center gap-1 mb-1 mt-2"><Minus className="w-3 h-3" /> POTONGAN</span>
                  <div className="space-y-1.5">
                    {deductions.map((ded) => (
                      <div key={ded.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm text-xs">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{ded.category}</span>
                          {ded.paymentMethod && <Badge size="sm" variant="neutral" className="ml-1">{ded.paymentMethod}</Badge>}
                          {ded.note && <span className="text-slate-400 dark:text-slate-500 ml-1 text-[10px]">({ded.note})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-accent-500 dark:text-accent-400">-{formatRupiah(ded.amount)}</span>
                          <IconButton variant="delete" size="sm" onClick={() => setDeductions(deductions.filter(d => d.id !== ded.id))}>
                            <Trash2 className="w-3 h-3" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Button variant="primary" size="full" className="mt-4" icon={<Save className="w-4 h-4" />} onClick={handleSaveDailyRecord}>
            {isEditRecordMode ? 'Simpan Perubahan' : 'Simpan Data Harian'}
          </Button>
        </div>
      </Card>

      <Card padding="none" className="lg:col-span-2 flex flex-col h-[650px]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Input Harian'}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTrash(v => !v)}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
            >
              {showTrash ? 'Kembali ke Riwayat' : `Recycle Bin (${trashedOnly(employeeDailyRecords).length})`}
            </button>
            <button
              type="button"
              onClick={() => setIsDailySortOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
            </button>
            <Badge variant="neutral">{visibleDailyRecords.length} Catatan</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {sortedDailyRecords.length === 0 ? (
            <EmptyState
              className="h-full opacity-50"
              icon={showTrash ? <Trash2 className="w-12 h-12" /> : <Calendar className="w-12 h-12" />}
              title={showTrash ? 'Recycle bin kosong.' : 'Belum ada riwayat input karyawan.'}
            />
          ) : (
            sortedDailyRecords.slice(0, 50).map(rec => {
              const emp = employees.find(e => e.id === rec.employeeId);
              const addSum = rec.additions.reduce((s, a) => s + a.amount, 0);
              const dedSum = rec.deductions.reduce((s, d) => s + d.amount, 0);
              return (
                <div key={rec.id} className="flex flex-col p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-accent-200 dark:hover:border-accent-500/30 transition-all duration-200 animate-in slide-in-from-left-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{emp ? emp.name : 'Karyawan (Dihapus)'}</p>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(rec.date).toLocaleDateString('id-ID')} • {rec.hoursWorked} Jam</p>
                    </div>
                    <div className="flex gap-1">
                      {showTrash ? (
                        <>
                          <IconButton variant="success" onClick={() => handleRestoreDailyRecord(rec.id)} title="Kembalikan">
                            <RotateCcw className="w-4 h-4" />
                          </IconButton>
                          <IconButton variant="delete" onClick={() => handlePermanentDeleteDailyRecord(rec.id)} title="Hapus Permanen">
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton variant="edit" onClick={() => { setDailyEmpId(rec.employeeId); setDailyDate(rec.dateStr); }}>
                            <Edit3 className="w-4 h-4" />
                          </IconButton>
                          <IconButton variant="delete" onClick={() => handleDeleteDailyRecord(rec.id)}>
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-bold block mb-1">Tambahan: +{formatRupiah(addSum)}</span>
                      {rec.additions.map((a, i) => <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400">- {a.category} ({formatRupiah(a.amount)})</div>)}
                    </div>
                    <div>
                      <span className="text-accent-500 dark:text-accent-400 font-bold block mb-1">Potongan: -{formatRupiah(dedSum)}</span>
                      {rec.deductions.map((d, i) => <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400">- {d.category} ({formatRupiah(d.amount)})</div>)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="flex justify-between items-center">
        <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><PieChart className="w-5 h-5 text-accent-600 dark:text-accent-400" /> Rekap Penggajian</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Bulan Laporan:</label>
          <div className="w-40">
            <Input
              type="month"
              variant="muted"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="dark" padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400 dark:text-slate-500">Total Expenses Payroll</p>
          <h3 className="font-heading text-2xl font-black text-white">{formatRupiah(totalPayrollExpense)}</h3>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Karyawan Aktif (Bulan Ini)</p>
          <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100">{employeePerformance.length} Orang</h3>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">Performa & Rincian Gaji Karyawan</h3>
          <button
            type="button"
            onClick={() => setIsPerfSortOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
          </button>
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
              {sortedEmployeePerformance.length === 0 ? (
                <tr><td colSpan="6"><EmptyState size="sm" icon={<PieChart className="w-8 h-8" />} title="Tidak ada data penggajian pada bulan ini." /></td></tr>
              ) : (
                sortedEmployeePerformance.map(p => (
                  <tr key={p.employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.employee.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Upah/Jam: {formatRupiah(p.employee.hourlyRate)}</p>
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-sm">{p.totalHours}</td>
                    <td className="p-4 text-right font-bold text-green-600 dark:text-green-400 text-sm">+{formatRupiah(p.totalAdditions)}</td>
                    <td className="p-4 text-right font-bold text-accent-500 dark:text-accent-400 text-sm">-{formatRupiah(p.totalDeductions)}</td>
                    <td className="p-4 text-right font-black text-slate-900 dark:text-slate-50 text-sm">{formatRupiah(p.netPay)}</td>
                    <td className="p-4 text-center">
                      <Button variant="ghost" size="sm" icon={<Printer className="w-3 h-3" />} onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })}>
                        Cetak Slip
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="lg" className="mt-6 mb-10">
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
      </Card>
    </div>
  );

  const renderManageTab = () => (
    <div className="h-full animate-in fade-in slide-in-from-left-4 duration-300">
      {isEditingEmp ? (
        <Card padding="lg" className="max-w-3xl">
          <IconButton
            variant="neutral"
            label="Kembali"
            className="mb-4"
            onClick={() => setIsEditingEmp(false)}
          >
            <ChevronLeft className="w-5 h-5" />
          </IconButton>

          <h2 className="font-heading text-xl font-bold mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
            {empFormData.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input
              label="Nama Lengkap"
              variant="muted"
              value={empFormData.name}
              onChange={e => setEmpFormData({ ...empFormData, name: e.target.value })}
              placeholder="Misal: Budi Santoso"
            />
            <Input
              label="No. Handphone (WA)"
              variant="muted"
              value={empFormData.phone}
              onChange={e => setEmpFormData({ ...empFormData, phone: e.target.value })}
              placeholder="Misal: 081234567890"
            />
            <Select
              label="Status Karyawan"
              variant="muted"
              value={empFormData.status || 'aktif'}
              onChange={e => setEmpFormData({ ...empFormData, status: e.target.value })}
            >
              {EMPLOYEE_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            {empFormData.status === 'resign' && (
              <Input
                type="date"
                label="Tanggal Resign"
                variant="muted"
                value={empFormData.resignDate || ''}
                onChange={e => setEmpFormData({ ...empFormData, resignDate: e.target.value })}
              />
            )}
            <div className="md:col-span-2">
              <Input
                label="Alamat"
                variant="muted"
                value={empFormData.address}
                onChange={e => setEmpFormData({ ...empFormData, address: e.target.value })}
                placeholder="Alamat lengkap..."
              />
            </div>
            <Input
              type="number"
              label="Upah per Jam (Rp)"
              variant="muted"
              icon={<span className="font-bold">Rp</span>}
              value={empFormData.hourlyRate === 0 ? "" : empFormData.hourlyRate}
              onChange={e => {
                const val = e.target.value;
                setEmpFormData({
                  ...empFormData,
                  hourlyRate: val === "" ? "" : Number(val)
                });
              }}
              placeholder="0"
            />
            <Input
              type="number"
              label="Bonus Full Time >= 10 Jam (Rp)"
              variant="muted"
              icon={<span className="font-bold">Rp</span>}
              value={empFormData.fullTimeBonus === 0 ? "" : empFormData.fullTimeBonus}
              onChange={e => {
                const val = e.target.value;
                setEmpFormData({
                  ...empFormData,
                  fullTimeBonus: val === "" ? "" : Number(val)
                });
              }}
              placeholder="0"
            />
            <Input
              type="date"
              label="Mulai Kerja"
              variant="muted"
              value={empFormData.startDate}
              onChange={e => setEmpFormData({ ...empFormData, startDate: e.target.value })}
            />
          </div>

          <Button variant="primary" size="lg" onClick={handleSaveEmployee}>
            Simpan Data Karyawan
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Briefcase className="w-5 h-5 text-slate-700 dark:text-slate-200" /> Daftar Karyawan</h3>
            <div className="flex items-center gap-2">
              <select
                value={empStatusFilter}
                onChange={e => setEmpStatusFilter(e.target.value)}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent focus:outline-none"
              >
                <option value="semua">Semua Status</option>
                {EMPLOYEE_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsEmpSortOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
              <Button
                variant="dark"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEmpFormData({ id: '', name: '', phone: '', address: '', hourlyRate: 0, fullTimeBonus: 0, startDate: toLocalDateString(), status: 'aktif', resignDate: '' });
                  setIsEditingEmp(true);
                }}
              >
                Tambah Karyawan
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
            {sortedEmployees.map(emp => (
              <Card key={emp.id} padding="lg" className="relative group hover:shadow-md transition-shadow duration-300">
                <div className="absolute top-4 right-4 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton variant="edit" ghost onClick={() => { setEmpFormData({ status: 'aktif', resignDate: '', ...emp }); setIsEditingEmp(true); }}>
                    <Edit3 className="w-4 h-4" />
                  </IconButton>
                  <IconButton variant="delete" ghost onClick={() => handleDeleteEmployee(emp.id)}>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full flex items-center justify-center font-heading font-black text-xl">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base leading-tight pr-10">{emp.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge size="sm" variant={getEmployeeStatusInfo(getEmployeeStatus(emp)).badgeVariant}>
                        {getEmployeeStatusInfo(getEmployeeStatus(emp)).label}
                      </Badge>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Gabung: {new Date(emp.startDate).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-medium">No. HP:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{emp.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-medium">Upah/Jam:</span><span className="font-bold text-accent-600 dark:text-accent-400">{formatRupiah(emp.hourlyRate)}</span></div>
                  {emp.status === 'resign' && emp.resignDate && (
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-medium">Resign:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(emp.resignDate).toLocaleDateString('id-ID')}</span></div>
                  )}
                  <div className="flex flex-col mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Alamat:</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{emp.address || '-'}</span>
                  </div>
                </div>
              </Card>
            ))}
            {sortedEmployees.length === 0 && employees.length > 0 && (
              <EmptyState
                className="col-span-full"
                icon={<Users className="w-10 h-10" />}
                title="Gak ada karyawan dengan status ini"
                description="Coba pilih filter status lain di atas."
              />
            )}
            {employees.length === 0 && (
              <EmptyState
                className="col-span-full"
                icon={<Users className="w-10 h-10" />}
                title="Belum ada data karyawan"
                description="Tambahkan data karyawan pertama untuk mulai mencatat absensi & penggajian"
                action={
                  <Button
                    variant="dark"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEmpFormData({ id: '', name: '', phone: '', address: '', hourlyRate: 0, fullTimeBonus: 0, startDate: toLocalDateString(), status: 'aktif', resignDate: '' });
                      setIsEditingEmp(true);
                    }}
                  >
                    Tambah Karyawan
                  </Button>
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <div className="shrink-0 mb-6">
        <PageHeader title="Manajemen Pegawai (HR)" icon={<UserCog className="w-6 h-6" />} className="mb-4" />

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 p-4 overflow-x-auto hide-scrollbar">
          <Button size="md" variant={activeTab === 'input' ? 'primary' : 'secondary'} onClick={() => setActiveTab('input')}>Input Harian</Button>
          <Button size="md" variant={activeTab === 'reports' ? 'primary' : 'secondary'} onClick={() => setActiveTab('reports')}>Rekap Laporan</Button>
          <Button size="md" variant={activeTab === 'manage' ? 'primary' : 'secondary'} onClick={() => setActiveTab('manage')}>Kelola Karyawan</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'input' && renderInputTab()}
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'manage' && renderManageTab()}
      </div>
      <PayslipModal />

      <SortModal
        isOpen={isDailySortOpen}
        onClose={() => setIsDailySortOpen(false)}
        value={dailySortKey}
        onChange={setDailySortKey}
        options={dailyRecordSortOptions}
      />
      <SortModal
        isOpen={isPerfSortOpen}
        onClose={() => setIsPerfSortOpen(false)}
        value={perfSortKey}
        onChange={setPerfSortKey}
        options={perfSortOptions}
      />
      <SortModal
        isOpen={isEmpSortOpen}
        onClose={() => setIsEmpSortOpen(false)}
        value={empSortKey}
        onChange={setEmpSortKey}
        options={empListSortOptions}
      />

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