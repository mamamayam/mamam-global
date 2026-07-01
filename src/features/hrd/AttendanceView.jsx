import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Fingerprint, Users, Trash2, RotateCcw,
  AlertTriangle, Camera, AlarmClock, X, PenLine,
  History, Search, Calendar, ChevronRight, Filter, ArrowUpDown,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString } from '../../utils/formatters';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { isSupabaseConfigured } from '../../storage/syncClient';
import { pushTransactionDelete } from '../../storage/realtimeSync';
import {
  Card, Button, PageHeader, EmptyState, Badge, IconButton, Alert, SortModal, BulkSelectBar,
} from '../../components/ui';
import { applySort } from '../../utils/sortUtils';
import { useBulkSelect } from '../../hook/useBulkSelect';
import { OVERTIME_THRESHOLD_MINUTES, WORK_END_MINUTES } from './utils/payrollLogic';

const AUTO_CLOSE_HOUR = 21; // Sistem mendeteksi kelalaian jika sudah lewat jam 21:00
// Jam pulang otomatis yang akan dicatat — diturunkan dari WORK_END_MINUTES
// (payrollLogic.js) supaya selalu sama dengan jam tutup kerja yang dipakai
// untuk hitung Bonus Full Time & lembur, bukan angka 19 yang berdiri sendiri.
const OUTLET_CLOSE_HOUR = WORK_END_MINUTES / 60;

const LOG_FILTER_TABS = [
  { id: 'hari-ini', label: 'Hari Ini' },
  { id: '7-hari', label: '7 Hari' },
  { id: '30-hari', label: '30 Hari' },
  { id: 'bulan-berjalan', label: 'Bulan Ini' },
  { id: 'semua', label: 'Semua Waktu' },
  { id: 'kustom', label: 'Pilih Tanggal' },
];

const TYPE_OPTIONS = [
  { value: 'semua', label: 'Semua Tipe' },
  { value: 'masuk', label: 'Masuk' },
  { value: 'bolong', label: 'Jam Bolong' },
  { value: 'masuk_lagi', label: 'Masuk Lagi' },
  { value: 'keluar', label: 'Pulang' },
];

const TYPE_LABEL = { masuk: 'Masuk', keluar: 'Pulang', bolong: 'Mulai Bolong', masuk_lagi: 'Masuk Lagi' };
const TYPE_VARIANT = { masuk: 'success', keluar: 'neutral', bolong: 'warning', masuk_lagi: 'success' };

const SORT_OPTIONS = [
  { key: 'date-desc', label: 'Terbaru Dulu' },
  { key: 'date-asc', label: 'Terlama Dulu' },
  { key: 'name-asc', label: 'Nama Karyawan (A-Z)' },
  { key: 'name-desc', label: 'Nama Karyawan (Z-A)' },
  { key: 'type-asc', label: 'Tipe Absen (A-Z)' },
];

export default function Attendance() {
  const { employees, attendanceLog, setAttendanceLog, isAdminMode, triggerConfirm, currentShift } = useAppContext();

  const [autoClosedEmployees, setAutoClosedEmployees] = useState([]);
  const autoCloseRef = useRef('');

  // Refs supaya watchdog auto-close (lihat useEffect di bawah) selalu baca
  // data TERBARU tanpa perlu nge-recreate interval-nya tiap kali
  // attendanceLog/employees berubah (yang notabene sering berubah sepanjang
  // hari kerja di kasir).
  const attendanceLogRef = useRef(attendanceLog);
  const employeesRef = useRef(employees);
  const currentShiftRef = useRef(currentShift);
  useEffect(() => { attendanceLogRef.current = attendanceLog; }, [attendanceLog]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { currentShiftRef.current = currentShift; }, [currentShift]);

  // Status "Dompet (shift kasir) masih kebuka dari hari sebelumnya" — kemungkinan
  // lupa ditutup. Versi sebelumnya numpang di state `now` yang tick tiap detik
  // biar "tetep update live" — tapi tick itu sendiri yang jadi sumber re-render
  // berat (lihat catatan watchdog di bawah), jadi sekarang dipecah jadi dua:
  //  1) instan tiap kali currentShift berubah (effect ini), dan
  //  2) dicek ulang tiap 1 menit lewat watchdog auto-close di bawah, supaya
  //     tetap akurat kalau tanggal berganti hari sementara shift-nya sendiri
  //     tidak berubah (mis. dompet dibuka jam 23:50, halaman ini masih
  //     kebuka pas lewat tengah malam).
  // Presisi 1 menit lebih dari cukup untuk peringatan dompet belum ditutup —
  // tidak perlu balik ke tick tiap detik.
  const [isShiftCarriedOver, setIsShiftCarriedOver] = useState(false);

  useEffect(() => {
    setIsShiftCarriedOver(
      currentShift ? new Date(currentShift.startTime).toDateString() !== new Date().toDateString() : false
    );
  }, [currentShift]);

  // Koreksi manual (Status Hari Ini)
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [editType, setEditType] = useState('masuk');
  const [editTime, setEditTime] = useState('');

  // History section
  const [showHistoryTrash, setShowHistoryTrash] = useState(false);
  const [dateFilter, setDateFilter] = useState('hari-ini');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('semua');
  const [empFilter, setEmpFilter] = useState('semua');
  const [sortKey, setSortKey] = useState('date-desc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Watchdog gabungan: (1) auto-close jam 21:00 — otomatis insert record
  // keluar pukul 19:00 bagi karyawan yang lupa absen pulang, dan (2) recheck
  // berkala status dompet-kebawa-dari-kemarin (lihat catatan di atas).
  //
  // Dulu auto-close di-drive oleh state `now` yang di-tick tiap 1 detik, yang
  // artinya SELURUH halaman (termasuk sampai 300 baris riwayat absen) ikut
  // re-render 60x/menit walau gak ada apa pun yang berubah secara visual.
  // Sekarang dicek lewat setInterval biasa yang gak nyentuh state React sama
  // sekali kecuali memang ada perubahan nyata yang perlu ditampilkan — jauh
  // lebih ringan dipakai seharian nyala di kasir.
  useEffect(() => {
    const checkAutoClose = () => {
      const nowDate = new Date();
      if (nowDate.getHours() < AUTO_CLOSE_HOUR) return;

      const todayStr = toLocalDateString();
      if (autoCloseRef.current === todayStr) return;
      autoCloseRef.current = todayStr;

      const todayActiveAll = activeOnly(attendanceLogRef.current).filter(r => r.dateStr === todayStr);

      const getLastRecord = (empId) => {
        const recs = todayActiveAll
          .filter(r => r.employeeId === empId)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        return recs[recs.length - 1];
      };

      const toAutoCloseMasuk = employeesRef.current.filter(emp => {
        const lastType = getLastRecord(emp.id)?.type;
        return lastType === 'masuk' || lastType === 'masuk_lagi';
      });
      const toAutoCloseBolong = employeesRef.current.filter(emp => getLastRecord(emp.id)?.type === 'bolong');

      if (toAutoCloseMasuk.length === 0 && toAutoCloseBolong.length === 0) return;

      const outletCloseDate = new Date(nowDate);
      outletCloseDate.setHours(OUTLET_CLOSE_HOUR, 0, 0, 0);

      const newRecords = [
        ...toAutoCloseMasuk.map(emp => ({
          id: `AUTO-KELUAR-${emp.id}-${todayStr}`,
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'keluar',
          date: outletCloseDate.toISOString(),
          dateStr: todayStr,
          isAutoClose: true,
          deletedAt: null,
        })),
        ...toAutoCloseBolong.map(emp => {
          const bolongRec = getLastRecord(emp.id);
          return {
            id: `AUTO-KELUAR-BOLONG-${emp.id}-${todayStr}`,
            employeeId: emp.id,
            employeeName: emp.name,
            type: 'keluar',
            date: bolongRec.date,
            dateStr: todayStr,
            isAutoClose: true,
            isFromBolong: true,
            deletedAt: null,
          };
        }),
      ];

      setAttendanceLog(prev => [...prev, ...newRecords]);
      setAutoClosedEmployees([
        ...toAutoCloseMasuk.map(e => ({ name: e.name, fromBolong: false })),
        ...toAutoCloseBolong.map(e => ({ name: e.name, fromBolong: true })),
      ]);
    };

    const checkShiftCarriedOver = () => {
      const shift = currentShiftRef.current;
      setIsShiftCarriedOver(shift ? new Date(shift.startTime).toDateString() !== new Date().toDateString() : false);
    };

    checkAutoClose(); // langsung cek sekali saat mount (siapa tau dibuka udah lewat jam 21:00)
    checkShiftCarriedOver();
    const watchdog = setInterval(() => {
      checkAutoClose();
      checkShiftCarriedOver();
    }, 60000); // cek tiap 1 menit, bukan tiap detik
    return () => clearInterval(watchdog);
  }, [setAttendanceLog]);

  const todayStr = toLocalDateString();

  const todayActive = useMemo(
    () => activeOnly(attendanceLog).filter(r => r.dateStr === todayStr),
    [attendanceLog, todayStr]
  );

  const employeeStatuses = useMemo(() => employees.map(emp => {
    const records = todayActive
      .filter(r => r.employeeId === emp.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const lastRecord = records[records.length - 1];
    const bolongRecords = records.filter(r => r.type === 'bolong');
    const masukLagiRecords = records.filter(r => r.type === 'masuk_lagi');

    const bolong = bolongRecords[bolongRecords.length - 1];
    const masukLagi = masukLagiRecords[masukLagiRecords.length - 1];
    const keluarRecord = records.find(r => r.type === 'keluar');

    let durasiBolongText = '';
    if (bolong && masukLagi && new Date(masukLagi.date) > new Date(bolong.date)) {
      const diffMins = Math.round((new Date(masukLagi.date) - new Date(bolong.date)) / 60000);
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      durasiBolongText = `(${h}j ${m}m)`;
    }

    let isLembur = false;
    if (keluarRecord) {
      const outDate = new Date(keluarRecord.date);
      const outMins = outDate.getHours() * 60 + outDate.getMinutes();
      if (outMins >= OVERTIME_THRESHOLD_MINUTES) isLembur = true;
    }

    return {
      employee: emp,
      masuk: records.find(r => r.type === 'masuk'),
      bolong,
      masukLagi,
      durasiBolongText,
      keluar: records.find(r => r.type === 'keluar'),
      lastRecord,
      isLembur,
    };
  }), [employees, todayActive]);

  const sudahMasukCount = employeeStatuses.filter(s => s.masuk).length;

  const uniqueLogEmployees = useMemo(() => {
    const map = new Map();
    attendanceLog.forEach(r => {
      if (!map.has(r.employeeId))
        map.set(r.employeeId, r.employeeName || r.employeeId);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [attendanceLog]);

  const filteredLogs = useMemo(() => {
    const baseLogSource = showHistoryTrash ? trashedOnly(attendanceLog) : activeOnly(attendanceLog);

    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const inRange = (dateString) => {
      const d = new Date(dateString);
      switch (dateFilter) {
        case 'hari-ini': return d >= todayMid;
        case '7-hari': {
          const cutoff = new Date(todayMid); cutoff.setDate(cutoff.getDate() - 7);
          return d >= cutoff;
        }
        case '30-hari': {
          const cutoff = new Date(todayMid); cutoff.setDate(cutoff.getDate() - 30);
          return d >= cutoff;
        }
        case 'bulan-berjalan':
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        case 'kustom': {
          if (!customStartDate || !customEndDate) return true;
          const start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate); end.setHours(23, 59, 59, 999);
          return d >= start && d <= end;
        }
        case 'semua':
        default: return true;
      }
    };

    const lower = searchTerm.trim().toLowerCase();

    return applySort(
      baseLogSource
        .filter(r => inRange(r.date))
        .filter(r => typeFilter === 'semua' || r.type === typeFilter)
        .filter(r => empFilter === 'semua' || r.employeeId === empFilter)
        .filter(r => !lower || (r.employeeName ?? '').toLowerCase().includes(lower)),
      sortKey,
      {
        date: r => new Date(r.date),
        name: r => r.employeeName || '',
        type: r => r.type || '',
      }
    );
  }, [attendanceLog, showHistoryTrash, dateFilter, customStartDate, customEndDate, typeFilter, empFilter, sortKey, searchTerm]);

  const handleDeleteRecord = (id) =>
    setAttendanceLog(prev => prev.map(r => r.id === id ? markDeleted(r) : r));

  const handleRestoreRecord = (id) =>
    setAttendanceLog(prev => prev.map(r => r.id === id ? restoreItem(r) : r));

  const handlePermanentDeleteRecord = (id) => {
    triggerConfirm(
      'Hapus record absen ini secara permanen? Tindakan ini tidak bisa dibatalkan.',
      () => {
        setAttendanceLog(prev => prev.filter(r => r.id !== id));
        pushTransactionDelete('attendanceLog', id).catch(err =>
          console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
        );
      }
    );
  };

  // Daftar log yang benar-benar tampil di tabel (dibatasi 300 baris terbaru)
  const visibleLogs = filteredLogs.slice(0, 300);

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(visibleLogs);

  const handleBulkSoftDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} record absen terpilih ke Recycle Bin?`, () => {
      setAttendanceLog(prev => prev.map(r => selectedIds.has(r.id) ? markDeleted(r) : r));
      resetSelection();
    });
  };

  const handleBulkPermanentDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} record absen terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setAttendanceLog(prev => prev.filter(r => !selectedIds.has(r.id)));
      ids.forEach(id => pushTransactionDelete('attendanceLog', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      ));
      resetSelection();
    });
  };

  const handleAddManualRecord = (employeeId, employeeName) => {
    if (!editTime) return;
    const [h, m] = editTime.split(':').map(Number);
    const date = new Date(); date.setHours(h, m, 0, 0);
    setAttendanceLog(prev => [...prev, {
      id: `MANUAL-${employeeId}-${editType}-${Date.now()}`,
      employeeId,
      employeeName,
      type: editType,
      date: date.toISOString(),
      dateStr: toLocalDateString(),
      isManual: true,
      deletedAt: null,
    }]);
    setEditEmployeeId(null);
  };

  const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const trashedCount = useMemo(() => trashedOnly(attendanceLog).length, [attendanceLog]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <PageHeader
        title="Absensi Karyawan"
        subtitle={`${sudahMasukCount} dari ${employees.length} karyawan sudah absen masuk hari ini`}
        icon={<Fingerprint className="w-6 h-6" />}
      />

      {currentShift && isShiftCarriedOver && (
        <div className="mb-4 border-2 border-red-500 bg-accent-50 dark:bg-accent-950/40 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-accent-100 dark:bg-accent-900/60 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-accent-700 dark:text-accent-400 text-sm">
                ⚠️ Dompet Belum Ditutup dari Hari Sebelumnya
              </p>
              <p className="text-xs text-accent-600 dark:text-accent-500 mt-0.5">
                Dompet {currentShift.id} masih kebuka sejak {new Date(currentShift.startTime).toLocaleString('id-ID')}. Cek menu Manajemen Dompet untuk segera ditutup sebelum transaksi hari ini kecampur sama shift lama.
              </p>
            </div>
          </div>
        </div>
      )}

      {autoClosedEmployees.length > 0 && (
        <div className="mb-4 border-2 border-red-500 bg-accent-50 dark:bg-accent-950/40 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-accent-100 dark:bg-accent-900/60 rounded-full flex items-center justify-center">
              <AlarmClock className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-accent-700 dark:text-accent-400 text-sm">
                ⚠️ Absen Pulang Otomatis — Dicatat Jam {OUTLET_CLOSE_HOUR}:00
              </p>
              <p className="text-xs text-accent-600 dark:text-accent-500 mt-0.5 mb-2">
                Karyawan berikut tidak absen pulang sampai jam {AUTO_CLOSE_HOUR}:00, sehingga jam pulang dicatat otomatis
                pukul <span className="font-semibold">{OUTLET_CLOSE_HOUR}:00</span> (jam tutup outlet). Admin bisa melakukan pengeditan secara manual jika diperlukan.
                Yang bertanda <span className="font-semibold italic">(jam bolong)</span> — pulang dicatat saat mereka keluar bolong karena tidak absen balik.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {autoClosedEmployees.map(({ name, fromBolong }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-100 dark:bg-accent-900/60 text-accent-800 dark:text-accent-300 text-xs font-bold"
                  >
                    {name}
                    {fromBolong && <span className="font-normal opacity-70">(jam bolong)</span>}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setAutoClosedEmployees([])}
              title="Tutup peringatan"
              className="shrink-0 text-accent-400 hover:text-accent-600 dark:text-accent-500 dark:hover:text-accent-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!isSupabaseConfigured() && (
        <Alert type="callout" variant="warning" className="mb-4">
          Sinkronisasi cloud belum aktif. Karyawan belum bisa absen lewat HP sendiri
          sampai Supabase disambungkan di Pengaturan.
        </Alert>
      )}

      <Card padding="none" className="mb-6 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4" /> Status Hari Ini
          </h3>
        </div>

        {employees.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Users className="w-8 h-8" />}
            title="Belum ada data karyawan"
            description="Tambahkan karyawan dulu di menu Karyawan"
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {employeeStatuses.map(({ isLembur, employee, masuk, bolong, masukLagi, durasiBolongText, keluar, lastRecord }) => (
              <div key={employee.id} className="flex flex-col">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {employee.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {masuk ? `Masuk ${fmtTime(masuk.date)}` : 'Belum absen masuk'}
                      {bolong && ` · Bolong ${fmtTime(bolong.date)}`}
                      {masukLagi && ` - ${fmtTime(masukLagi.date)} `}
                      {durasiBolongText && <span className="text-amber-500 font-medium">{durasiBolongText}</span>}
                      {keluar && ` · Pulang ${fmtTime(keluar.date)}`}
                      {keluar?.isAutoClose && (
                        <span className={`ml-1 font-medium ${keluar.isFromBolong ? 'text-accent-400' : 'text-amber-500'}`}>
                          {keluar.isFromBolong ? '(dari bolong)' : '(auto)'}
                        </span>
                      )}
                      {lastRecord?.isManual && <span className="ml-1 text-blue-400 font-medium">(manual)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isLembur && <Badge variant="warning">Lembur</Badge>} {/* Munculkan indikator lembur */}
                    {(masuk?.photoUrl || keluar?.photoUrl) && (
                      <a
                        href={keluar?.photoUrl || masuk?.photoUrl}
                        target="_blank" rel="noreferrer"
                        title="Lihat foto selfie"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <Camera className="w-4 h-4" />
                      </a>
                    )}
                    {(masuk?.location?.flagged || keluar?.location?.flagged) && (
                      <span title="Lokasi jauh dari outlet">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </span>
                    )}
                    {lastRecord?.type === 'keluar' ? (
                      <Badge variant="neutral" dot>Pulang</Badge>
                    ) : lastRecord?.type === 'bolong' ? (
                      <Badge variant="warning" dot>Jam Bolong</Badge>
                    ) : lastRecord?.type === 'masuk' ? (
                      <Badge variant="success" dot>Masuk</Badge>
                    ) : (
                      <Badge variant="warning" dot>Belum Absen</Badge>
                    )}
                    {isAdminMode && (
                      <IconButton
                        variant="neutral" ghost
                        title="Tambah record manual"
                        onClick={() => {
                          if (editEmployeeId === employee.id) { setEditEmployeeId(null); return; }
                          const d = new Date();
                          setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          setEditType('masuk');
                          setEditEmployeeId(employee.id);
                        }}
                      >
                        <PenLine className="w-4 h-4" />
                      </IconButton>
                    )}
                    {isAdminMode && lastRecord && (
                      <IconButton
                        variant="delete" ghost
                        title={`Hapus record ${lastRecord.type} terakhir`}
                        onClick={() => handleDeleteRecord(lastRecord.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    )}
                  </div>
                </div>

                {isAdminMode && editEmployeeId === employee.id && (
                  <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pt-3 mb-2">
                      Tambah Record Manual
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value)}
                        className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent-400"
                      >
                        <option value="masuk">Masuk</option>
                        <option value="bolong">Jam Bolong</option>
                        <option value="masuk_lagi">Masuk Lagi</option>
                        <option value="keluar">Keluar</option>
                      </select>
                      <input
                        type="time" value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent-400"
                      />
                      <button
                        onClick={() => handleAddManualRecord(employee.id, employee.name)}
                        disabled={!editTime}
                        className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setEditEmployeeId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg transition"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4" />
            {showHistoryTrash ? 'Recycle Bin Log Absen' : 'Riwayat Log Absen'}
          </h3>
          {isAdminMode && (
            <button
              onClick={() => { setShowHistoryTrash(v => !v); resetSelection(); }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showHistoryTrash ? '← Kembali ke Riwayat' : `Recycle Bin (${trashedCount})`}
            </button>
          )}
        </div>

        <Card className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-3 p-3">
          <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mr-1" />
          {LOG_FILTER_TABS.map(tab => (
            <Button
              key={tab.id}
              variant={dateFilter === tab.id ? 'dark' : 'secondary'}
              size="sm"
              onClick={() => setDateFilter(tab.id)}
              className="shrink-0 whitespace-nowrap rounded-full"
            >
              {tab.label}
            </Button>
          ))}
        </Card>

        {dateFilter === 'kustom' && (
          <Card className="flex items-center gap-2 p-3 mb-3 max-w-fit">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">
                Dari Tanggal
              </label>
              <input
                type="date" value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 text-slate-700 dark:text-slate-200 dark:bg-slate-900"
              />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-4 shrink-0" />
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">
                Sampai Tanggal
              </label>
              <input
                type="date" value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 text-slate-700 dark:text-slate-200 dark:bg-slate-900"
              />
            </div>
          </Card>
        )}

        <Card className="flex flex-col sm:flex-row gap-3 mb-3 p-4">
          <div className="relative w-full sm:w-52">
            <select
              value={empFilter}
              onChange={e => setEmpFilter(e.target.value)}
              className="w-full appearance-none pl-4 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="semua">Semua Karyawan</option>
              {uniqueLogEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
          </div>

          <div className="relative w-full sm:w-44">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full appearance-none pl-4 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => setIsSortOpen(true)}
            className="w-full sm:w-44 flex items-center justify-between gap-2 pl-4 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-accent-300 dark:hover:border-accent-500/40 transition-colors text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <span className="truncate">{SORT_OPTIONS.find(o => o.key === sortKey)?.label || 'Urutkan'}</span>
            <ArrowUpDown className="text-slate-400 dark:text-slate-500 w-4 h-4 shrink-0" />
          </button>

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama karyawan..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            />
          </div>
        </Card>

        {isAdminMode && visibleLogs.length > 0 && (
          <div className="mb-3">
            <BulkSelectBar
              count={count}
              total={visibleLogs.length}
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              onDeleteSelected={showHistoryTrash ? handleBulkPermanentDelete : handleBulkSoftDelete}
            />
          </div>
        )}

        <Card padding="none" className="overflow-hidden">
          {filteredLogs.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<History className="w-8 h-8" />}
              title={showHistoryTrash ? 'Recycle bin kosong' : 'Tidak ada log ditemukan'}
              description={showHistoryTrash
                ? 'Belum ada record absen yang dihapus.'
                : 'Coba ubah filter atau rentang tanggal.'}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleLogs.map(r => (
                <div
                  key={r.id}
                  className={`p-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${isAdminMode && selectedIds.has(r.id) ? 'bg-orange-50/60 dark:bg-orange-500/5' : ''}`}
                >
                  {isAdminMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelectOne(r.id)}
                      className="w-4 h-4 rounded accent-orange-500 cursor-pointer shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate leading-snug">
                      {r.employeeName}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                      {fmtDate(r.date)} · {fmtTime(r.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.photoUrl && (
                      <a
                        href={r.photoUrl}
                        target="_blank" rel="noreferrer"
                        title="Lihat foto selfie"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <Camera className="w-4 h-4" />
                      </a>
                    )}
                    {r.location?.flagged && (
                      <span title={`Lokasi ${r.location?.distance ?? '?'}m dari outlet`}>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </span>
                    )}
                    {r.isAutoClose && (
                      <Badge size="sm" variant="neutral">Auto</Badge>
                    )}
                    {r.isManual && (
                      <Badge size="sm" variant="neutral">Manual</Badge>
                    )}
                    <Badge variant={TYPE_VARIANT[r.type]} dot>
                      {TYPE_LABEL[r.type]}
                    </Badge>
                    {isAdminMode && (
                      showHistoryTrash ? (
                        <>
                          <IconButton
                            variant="success" ghost
                            title="Kembalikan"
                            onClick={() => handleRestoreRecord(r.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            variant="delete" ghost
                            title="Hapus Permanen"
                            onClick={() => handlePermanentDeleteRecord(r.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          variant="delete" ghost
                          title="Hapus (pindah ke recycle bin)"
                          onClick={() => handleDeleteRecord(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-right mt-2">
          {filteredLogs.length} record
          {filteredLogs.length > 300 ? ' · menampilkan 300 terbaru' : ''}
        </p>
      </div>

      <SortModal
        isOpen={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        value={sortKey}
        onChange={setSortKey}
        options={SORT_OPTIONS}
      />
    </div>
  );
}