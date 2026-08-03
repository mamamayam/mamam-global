import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, Trash2,
  AlertTriangle, Camera, AlarmClock, X, PenLine,
  History, Search, Calendar, ChevronRight, Filter, ArrowUpDown,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString } from '../../utils/formatters';
import { activeOnly } from '../../utils/softDelete';
import { isSupabaseConfigured } from '../../storage/syncClient';
import {
  Card, Button, EmptyState, Badge, IconButton, Alert, SortModal, BulkSelectBar, Modal,
} from '../../components/ui';
import { applySort } from '../../utils/sortUtils';
import { useBulkSelect } from '../../hook/useBulkSelect';
import { useRecycleBin } from '../../hook/useRecycleBin';
import { OVERTIME_THRESHOLD_MINUTES, WORK_END_MINUTES, calculateBolongMinutes } from './utils/payrollLogic';

const AUTO_CLOSE_HOUR = 21; // Sistem mendeteksi kelalaian jika sudah lewat jam 21:00
// Jam pulang otomatis yang akan dicatat — diturunkan dari WORK_END_MINUTES
// (payrollLogic.js) supaya selalu sama dengan jam tutup kerja yang dipakai
// untuk hitung Bonus Full Time & lembur, bukan angka 19 yang berdiri sendiri.
const OUTLET_CLOSE_HOUR = WORK_END_MINUTES / 60;
const LOG_FILTER_TABS = [
  { id: 'hari-ini', label: 'Hari Ini' },
  { id: 'kemarin', label: 'Kemarin' },
  { id: 'bulan-ini', label: 'Bulan Ini' },
  { id: 'semua', label: 'Semua' },
  { id: 'tanggal-terpilih', label: 'Tanggal Terpilih' },
];

const TYPE_OPTIONS = [
  { value: 'semua', label: 'Semua Tipe' },
  { value: 'masuk', label: 'Masuk' },
  { value: 'bolong', label: 'Jam Bolong' },
  { value: 'masuk_lagi', label: 'Masuk Lagi' },
  { value: 'keluar', label: 'Pulang' },
  { value: 'libur', label: 'Libur' },
];

const TYPE_LABEL = { masuk: 'Masuk', keluar: 'Pulang', bolong: 'Mulai Bolong', masuk_lagi: 'Masuk Lagi', libur: 'Libur' }; // [+] Tambah Libur
const TYPE_VARIANT = { masuk: 'success', keluar: 'neutral', bolong: 'warning', masuk_lagi: 'success', libur: 'neutral' }; // [+] Tambah Libur

const SORT_OPTIONS = [
  { key: 'date-desc', label: 'Terbaru Dulu' },
  { key: 'date-asc', label: 'Terlama Dulu' },
  { key: 'name-asc', label: 'Nama Karyawan (A-Z)' },
  { key: 'name-desc', label: 'Nama Karyawan (Z-A)' },
  { key: 'type-asc', label: 'Tipe Absen (A-Z)' },
];

export default function Attendance() {
  const { employees, attendanceLog, setAttendanceLog, isAdminMode, triggerConfirm, currentShift, allDataLoaded, syncStatus } = useAppContext();

  const [autoClosedEmployees, setAutoClosedEmployees] = useState([]);
  const autoCloseRef = useRef('');

  // Refs supaya watchdog auto-close (lihat useEffect di bawah) selalu baca
  // data TERBARU tanpa perlu nge-recreate interval-nya tiap kali
  // attendanceLog/employees berubah (yang notabene sering berubah sepanjang
  // hari kerja di kasir).
  const attendanceLogRef = useRef(attendanceLog);
  const employeesRef = useRef(employees);
  const currentShiftRef = useRef(currentShift);
  // [FIX] allDataLoaded HARUS dicek juga di dalam ref, bukan cuma di effect
  // guard biasa — karena checkAutoClose() dipanggil sinkron sekali saat
  // mount (lihat pemanggilan langsung di bawah), dan watchdog-nya sendiri
  // idle 60 detik lewat setInterval yang TIDAK di-recreate ketika
  // allDataLoaded berubah dari false -> true. Tanpa ref ini, closure lama
  // (yang dibuat sebelum data selesai load) akan terus baca allDataLoaded
  // versi awal (false) selamanya, PADAHAL yang benar-benar mau dicegah
  // adalah checkAutoClose() jalan SAAT data masih kosong/parsial — bukan
  // dicegah permanen.
  const allDataLoadedRef = useRef(allDataLoaded);
  // [FIX] allDataLoaded SENDIRIAN TIDAK CUKUP — itu cuma menjamin Dexie
  // LOKAL device ini sudah selesai dibaca, BUKAN menjamin attendanceLog
  // sudah lengkap ter-merge dari Supabase (initial pull jalan async
  // SETELAH allDataLoaded true, lihat App.jsx). Kalau device ini baru
  // pertama kali dipakai / baru reinstall / karyawan absen dari device
  // lain, attendanceLog lokal saat allDataLoaded=true bisa masih kosong
  // untuk log yang sebenarnya ada di server. syncStatus 'ready'/'error'
  // (atau 'idle' kalau Supabase memang tidak dikonfigurasi) menjamin fase
  // itu sudah lewat. Ini akar dari bug "karyawan ke-declare Libur padahal
  // ada log masuk" yang ditemukan lewat audit database.
  const syncStatusRef = useRef(syncStatus);
  useEffect(() => { attendanceLogRef.current = attendanceLog; }, [attendanceLog]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { currentShiftRef.current = currentShift; }, [currentShift]);
  useEffect(() => { allDataLoadedRef.current = allDataLoaded; }, [allDataLoaded]);
  useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);

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

  // Koreksi manual (Status Hari Ini) — sekarang tampil sebagai popup/modal,
  // bukan panel inline di bawah baris karyawan. editEmployeeId tetap dipakai
  // sebagai penanda "modal ini untuk karyawan siapa" sekaligus flag buka/tutup.
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editType, setEditType] = useState('masuk');
  const [editTime, setEditTime] = useState('');

  // Tab "Status Hari Ini" vs "Riwayat" — dipisah biar gak numpuk dalam satu
  // scroll panjang.
  const [activeTab, setActiveTab] = useState('status');

  // History section
  const {
    activeItems: visibleAttendanceLog,
    handleDelete: handleDeleteRecord,
    handleBulkSoftDelete: bulkSoftDeleteRecords,
  } = useRecycleBin(attendanceLog, setAttendanceLog, {
    tableKey: 'attendanceLog',
    itemLabel: 'record absen',
    triggerConfirm,
  });
  const [dateFilter, setDateFilter] = useState('hari-ini');
  // NB: untuk filter "Tanggal Terpilih" — kalau customEndDate dibiarkan kosong,
  // filter otomatis jadi single-day (customStartDate aja). Kalau diisi dua-duanya,
  // jadi range Dari-Sampai (hybrid, sesuai request Agung).
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

      // [FIX] Jangan pernah declare auto-libur/auto-close berdasarkan data
      // yang belum selesai dimuat dari Dexie/Supabase. Sebelum fix ini,
      // checkAutoClose() dipanggil langsung saat mount tanpa menunggu
      // attendanceLog terisi — kalau kebetulan tab Absensi dibuka/direfresh
      // setelah jam 21:00 SAAT data masih fetching, attendanceLogRef.current
      // kebaca kosong/parsial sesaat, bikin SEMUA karyawan (bukan cuma yang
      // beneran belum absen) lolos filter toAutoLibur dan langsung di-mark
      // "Libur" untuk hari itu. Begitu autoCloseRef ke-set, watchdog gak
      // akan cek ulang hari itu lagi walau attendanceLog susulan sudah
      // lengkap — jadi karyawan yang sebenarnya masuk tetap "kehitung"
      // absen di history, tapi payroll (yang baca employeeDailyRecords,
      // bukan recompute live) sudah kadung ke-snapshot sebagai Libur.
      // Retry otomatis di tick berikutnya begitu allDataLoaded jadi true.
      if (!allDataLoadedRef.current) return;
      // [FIX] allDataLoaded doang TERBUKTI TIDAK CUKUP (lihat audit
      // database employeeDailyRecords: puluhan hari ke-declare Libur
      // walau attendanceLog aslinya ADA log masuk) — attendanceLog lokal
      // bisa saja belum lengkap ter-merge dari Supabase walau Dexie lokal
      // sudah "selesai load". Tunggu syncStatus keluar dari 'syncing'.
      if (syncStatusRef.current === 'syncing') return;

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

      // [+] 1. Tambahkan kode ini untuk mencari karyawan yang tidak ada rekam absensi sama sekali hari ini
      const toAutoLibur = employeesRef.current.filter(emp => {
        const recs = todayActiveAll.filter(r => r.employeeId === emp.id);
        return recs.length === 0;
      });

      // [+] 2. Update baris kondisi IF ini agar juga mengecek toAutoLibur
      if (toAutoCloseMasuk.length === 0 && toAutoCloseBolong.length === 0 && toAutoLibur.length === 0) return;

      const outletCloseDate = new Date(); 
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
          // [FIX] Jam pulang otomatis buat karyawan yang lupa "Masuk Lagi"
          // setelah bolong HARUS tetap outletCloseDate (jam tutup outlet),
          // SAMA seperti toAutoCloseMasuk di atas — BUKAN jam mulai bolong
          // itu sendiri.
          //
          // Sebelumnya dipakai `date: bolongRec.date`, yang secara tidak
          // sengaja bikin log 'keluar' PERSIS bertepatan waktu dengan log
          // 'bolong' pasangannya. Efeknya di calculateBolongMinutes/
          // computeAttendanceFromLogs (payrollLogic.js): gap bolong dihitung
          // dari bolong ke keluar = 0 menit (karena timestamp-nya sama),
          // DAN seluruh sisa jam kerja setelah titik bolong itu (yang
          // seharusnya masih dihitung sampai jam tutup) ikut lenyap dari
          // hoursWorked — karyawan yang harusnya kerja sampai sore cuma
          // kebayar sampai jam dia mulai istirahat. Ini akar dari keluhan
          // "jam bolong gak dihitung" / jam kerja hilang.
          //
          // isFromBolong tetap dipertahankan (bukan cuma kosmetik) — dipakai
          // buat notice "Absen Pulang Otomatis" di UI supaya admin tahu
          // kasus ini butuh perhatian ekstra (karyawan lupa balik dari
          // bolong, BUKAN auto-close normal), dan tetap disarankan untuk
          // dikoreksi manual kalau jam pulang sebenarnya beda dari jam
          // tutup outlet.
          return {
            id: `AUTO-KELUAR-BOLONG-${emp.id}-${todayStr}`,
            employeeId: emp.id,
            employeeName: emp.name,
            type: 'keluar',
            date: outletCloseDate.toISOString(),
            dateStr: todayStr,
            isAutoClose: true,
            isFromBolong: true,
            deletedAt: null,
          };
        }),
        // [+] 3. Sisipkan generator pembuat record Libur otomatis
        ...toAutoLibur.map(emp => ({
          id: `AUTO-LIBUR-${emp.id}-${todayStr}`,
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'libur', // Tipe log otomatis diisi libur
          date: outletCloseDate.toISOString(),
          dateStr: todayStr,
          isAutoClose: true,
          deletedAt: null,
        })),
      ];

      setAttendanceLog(prev => [...prev, ...newRecords]);
      
      // [+] 4. Update data notifikasi UI dengan tambahan `isLibur`
      setAutoClosedEmployees([
        ...toAutoCloseMasuk.map(e => ({ name: e.name, fromBolong: false, isLibur: false })),
        ...toAutoCloseBolong.map(e => ({ name: e.name, fromBolong: true, isLibur: false })),
        ...toAutoLibur.map(e => ({ name: e.name, fromBolong: false, isLibur: true })),
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
    // [FIX] allDataLoaded ditambahkan ke dependency array supaya effect ini
    // re-run TEPAT saat data selesai loading (transisi false -> true),
    // bukan menunggu tick interval 60 detik berikutnya. Sebelumnya effect
    // ini cuma bergantung pada setAttendanceLog (referensi stabil, gak
    // pernah berubah) sehingga checkAutoClose() praktis cuma jalan SEKALI
    // di titik mount awal — kalau titik itu kebetulan sebelum data siap,
    // pengecekan yang valid baru terjadi di tick berikutnya (celah ~1
    // menit). Menambahkan allDataLoaded di sini membuat pengecekan valid
    // pertama terjadi sesegera mungkin, tanpa mengubah bagian lain dari
    // logic guard (checkAutoClose tetap idempotent per-hari lewat
    // autoCloseRef, jadi re-run ini aman/tidak dobel-declare).
  }, [setAttendanceLog, allDataLoaded, syncStatus]);

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

    // bolong/masukLagi (sesi TERAKHIR) tetap dipakai buat label "Bolong
    // HH:MM - HH:MM" di teks status (baris di bawah JSX render) — itu
    // memang cuma nunjukin sesi bolong yang lagi/terakhir berjalan hari
    // itu, bukan total.
    const bolong = bolongRecords[bolongRecords.length - 1];
    const masukLagi = masukLagiRecords[masukLagiRecords.length - 1];
    const keluarRecord = records.find(r => r.type === 'keluar');
    const liburRecord = records.find(r => r.type === 'libur');

    // [FIX] Durasi yang ditampilkan HARUS total dari SEMUA sesi bolong hari
    // itu, bukan cuma sesi terakhir — sebelumnya kalau karyawan bolong 2x
    // (mis. istirahat siang + istirahat sore), sesi pertama hilang total
    // dari tampilan status, padahal payroll (payrollLogic.js) sudah benar
    // mengakumulasi semuanya. Pakai calculateBolongMinutes yang sama biar
    // satu sumber kebenaran dgn hoursWorked/bolongMinutes di rekap gaji,
    // bukan implementasi kedua yang bisa ketinggalan sinkron.
    // fallbackEndDate: kalau ada keluarRecord pakai jam itu (sesi bolong
    // terakhir yang belum sempat masuk_lagi dianggap berhenti pas pulang),
    // kalau belum ada keluar sama sekali pakai waktu SEKARANG (sesi bolong
    // yang masih berjalan live).
    const totalBolongMinutes = calculateBolongMinutes(records, keluarRecord ? new Date(keluarRecord.date) : new Date());

    let durasiBolongText = '';
    if (totalBolongMinutes > 0) {
      const diffMins = Math.round(totalBolongMinutes);
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      durasiBolongText = bolongRecords.length > 1 ? `(total ${h}j ${m}m)` : `(${h}j ${m}m)`;
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
      libur: liburRecord,
      lastRecord,
      isLembur,
    };
  }), [employees, todayActive]);

  const sudahMasukCount = employeeStatuses.filter(s => s.masuk).length;

  // Konfirmasi cepat "Libur" dari notice "Belum Clock-in" — beda dari
  // handleAddManualRecord (form edit lengkap, pilih jam & tipe manual): ini
  // 1 klik (+ dialog konfirmasi) langsung catat log 'libur' jam SEKARANG,
  // tanpa perlu buka form. Begitu tersimpan, employeeStatuses otomatis
  // update (libur terisi) → karyawan itu otomatis hilang dari notice ini di
  // render berikutnya.
  const handleQuickConfirmLibur = (employeeId, employeeName) => {
    triggerConfirm(`Yakin ${employeeName} libur hari ini?`, () => {
      const liburDateStr = toLocalDateString();
      // [FIX] ID deterministik (employeeId+dateStr, TANPA Date.now()) —
      // beda dari MANUAL-${type} di handleAddManualRecord yang butuh
      // timeKey (karena bolong/masuk_lagi boleh berkali-kali sehari),
      // 'libur' secara bisnis maksimal 1x per employeeId per hari, jadi ID
      // tanpa komponen waktu ini yang benar: klik dobel/retry jaringan
      // upsert ke record yang sama, bukan bikin 2 log 'libur' terpisah.
      setAttendanceLog(prev => [...prev, {
        id: `MANUAL-LIBUR-${employeeId}-${liburDateStr}`,
        employeeId,
        employeeName,
        type: 'libur',
        date: new Date().toISOString(),
        dateStr: liburDateStr,
        isManual: true,
        deletedAt: null,
      }]);
    });
  };

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
    const baseLogSource = visibleAttendanceLog;

    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const inRange = (dateString) => {
      const d = new Date(dateString);
      switch (dateFilter) {
        case 'hari-ini': {
          const end = new Date(todayMid); end.setDate(end.getDate() + 1);
          return d >= todayMid && d < end;
        }
        case 'kemarin': {
          const start = new Date(todayMid); start.setDate(start.getDate() - 1);
          return d >= start && d < todayMid;
        }
        case 'bulan-ini':
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        case 'tanggal-terpilih': {
          if (!customStartDate) return true;
          const start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
          // Hybrid: kalau customEndDate kosong, otomatis single-day (= customStartDate)
          const end = customEndDate ? new Date(customEndDate) : new Date(customStartDate);
          end.setHours(23, 59, 59, 999);
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
  }, [visibleAttendanceLog, dateFilter, customStartDate, customEndDate, typeFilter, empFilter, sortKey, searchTerm]);

  // Daftar log yang benar-benar tampil di tabel (dibatasi 300 baris terbaru)
  const visibleLogs = filteredLogs.slice(0, 300);

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(visibleLogs);

  const handleBulkSoftDelete = () => bulkSoftDeleteRecords([...selectedIds], resetSelection);

  const closeManualModal = () => {
    setEditEmployeeId(null);
    setEditEmployeeName('');
  };

  const handleAddManualRecord = () => {
    if (!editTime || !editEmployeeId) return;
    const [h, m] = editTime.split(':').map(Number);
    const date = new Date(); date.setHours(h, m, 0, 0);
    const manualDateStr = toLocalDateString();
    // [FIX] ID deterministik (employeeId+type+dateStr+JAM:MENIT yang
    // diinput admin) — sebelumnya pakai Date.now() (submit-time), yang
    // artinya klik dobel/retry jaringan buat input MANUAL YANG SAMA PERSIS
    // (karyawan sama, tipe sama, jam sama) menghasilkan 2 record log
    // terpisah alih-alih menyatu lewat upsert, konsisten dengan pola ID
    // deterministik yang sudah dipakai di seluruh module ini (lihat
    // REC-${empId}-${dateStr} di InputDailyTab.jsx, AUTO-KELUAR-* di atas).
    //
    // Waktu (h:m) SENGAJA ikut jadi bagian ID, bukan cuma employeeId+type+
    // dateStr — beda dari record harian (employeeDailyRecords) yang
    // maksimal 1 per employeeId+dateStr, log absensi (attendanceLog) BOLEH
    // berkali-kali untuk employeeId+type+dateStr yang sama dalam 1 hari
    // (mis. 2x 'bolong' buat istirahat siang & sore) — kalau waktu gak ikut
    // dalam ID, sesi kedua akan menimpa sesi pertama yang jamnya beda.
    const timeKey = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
    setAttendanceLog(prev => [...prev, {
      id: `MANUAL-${editEmployeeId}-${editType}-${manualDateStr}-${timeKey}`,
      employeeId: editEmployeeId,
      employeeName: editEmployeeName,
      type: editType,
      date: date.toISOString(),
      dateStr: manualDateStr,
      isManual: true,
      deletedAt: null,
    }]);
    closeManualModal();
  };

  const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {currentShift && isShiftCarriedOver && (
        <div className="mb-4 border-2 border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/60 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">
                ⚠️ Dompet Belum Ditutup dari Hari Sebelumnya
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                Dompet {currentShift.id} masih kebuka sejak {new Date(currentShift.startTime).toLocaleString('id-ID')}. Cek menu Manajemen Dompet untuk segera ditutup sebelum transaksi hari ini kecampur sama shift lama.
              </p>
            </div>
          </div>
        </div>
      )}

      {autoClosedEmployees.length > 0 && (
        <div className="mb-4 border-2 border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/60 rounded-full flex items-center justify-center">
              <AlarmClock className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">
                ⚠️ Absen Pulang Otomatis — Dicatat Jam {OUTLET_CLOSE_HOUR}:00
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5 mb-2">
                Karyawan berikut tidak absen pulang sampai jam {AUTO_CLOSE_HOUR}:00, sehingga jam pulang dicatat otomatis
                pukul <span className="font-semibold">{OUTLET_CLOSE_HOUR}:00</span> (jam tutup outlet). Admin bisa melakukan pengeditan secara manual jika diperlukan.
                Yang bertanda <span className="font-semibold italic">(jam bolong)</span> — sempat mulai istirahat (bolong) tapi lupa absen "Masuk Lagi"; seluruh
                waktu sejak mereka mulai bolong sampai jam {OUTLET_CLOSE_HOUR}:00 ikut terhitung sebagai <span className="font-semibold">durasi bolong</span>, BUKAN jam kerja.
                Kalau karyawan itu sebenarnya balik kerja sebelum tutup, <span className="font-semibold">wajib dikoreksi manual</span> lewat tombol Edit di tabel bawah supaya jam kerja & lemburnya benar.
                {/* [+] Keterangan Teks Tambahan */}
                <br />Yang bertanda <span className="font-semibold italic">(libur)</span> — otomatis diliburkan karena tidak memiliki catatan absensi sama sekali hari ini.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {/* [+] Update parameter map dari `isLibur` di sini */}
                {autoClosedEmployees.map(({ name, fromBolong, isLibur }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300 text-xs font-bold"
                  >
                    {name}
                    {fromBolong && <span className="font-normal opacity-70">(jam bolong)</span>}
                    {/* [+] Tampilkan tag "(libur)" */}
                    {isLibur && <span className="font-normal opacity-70">(libur)</span>}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setAutoClosedEmployees([])}
              title="Tutup peringatan"
              className="shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-all duration-300 active:scale-90"
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

      <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-6 overflow-x-auto hide-scrollbar">
        <Button
          variant={activeTab === 'status' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('status')}
          className="whitespace-nowrap"
        >
          Status Hari Ini
        </Button>
        <Button
          variant={activeTab === 'riwayat' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('riwayat')}
          className="whitespace-nowrap"
        >
          Riwayat
        </Button>
      </div>

      {activeTab === 'status' && (
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
            {employeeStatuses.map(({ employee, masuk, bolong, masukLagi, durasiBolongText, keluar, lastRecord, isLembur, libur }) => (
              <div key={employee.id} className="flex flex-col">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {employee.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {libur ? `Tercatat Libur pada ${fmtTime(libur.date)}` : (
                        <>
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
                        </>
                      )}
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
                    ) : lastRecord?.type === 'libur' ? ( // [+] Tambahan baru
                      <Badge variant="neutral" dot>Libur</Badge>
                    ) : lastRecord?.type === 'bolong' ? (
                      <Badge variant="warning" dot>Jam Bolong</Badge>
                    ) : lastRecord?.type === 'masuk' || lastRecord?.type === 'masuk_lagi' ? (
                      // [FIX] 'masuk_lagi' sebelumnya gak ke-cover cabang manapun
                      // di switch ini, jadi jatuh ke fallback "Belum Absen" +
                      // tombol quick-confirm Libur — padahal karyawan ini justru
                      // SEDANG KERJA (baru balik dari bolong). Kalau admin gak
                      // sadar dan klik "Libur" karena percaya badge-nya, seluruh
                      // hari itu tertimpa jadi Libur (hasLibur dicek duluan di
                      // computeAttendanceFromLogs), menghapus semua jam kerja &
                      // lembur yang sudah tercatat. Badge "Masuk" dipakai lagi di
                      // sini (bukan badge baru) karena secara status kehadiran
                      // keduanya sama: karyawan aktif, belum pulang.
                      <Badge variant="success" dot>Masuk</Badge>
                    ) : (
                      <>
                        <Badge variant="warning" dot>Belum Absen</Badge>
                        {isAdminMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuickConfirmLibur(employee.id, employee.name)}
                          >
                            Libur
                          </Button>
                        )}
                      </>
                    )}
                    {isAdminMode && (
                      <IconButton
                        variant="neutral" ghost
                        title="Tambah record manual"
                        onClick={() => {
                          const d = new Date();
                          setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          setEditType('masuk');
                          setEditEmployeeId(employee.id);
                          setEditEmployeeName(employee.name);
                        }}
                      >
                        <PenLine className="w-4 h-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {activeTab === 'riwayat' && (
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4" />
            Riwayat Log Absen
          </h3>
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

        {dateFilter === 'tanggal-terpilih' && (
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
                Sampai Tanggal (opsional)
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
              className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
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
              className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => setIsSortOpen(true)}
            className="w-full sm:w-44 flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-accent-300 dark:hover:border-accent-500/40 active:scale-[0.98] transition-all duration-300 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
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
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
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
              onDeleteSelected={handleBulkSoftDelete}
            />
          </div>
        )}

        <Card padding="none" className="overflow-hidden">
          {filteredLogs.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<History className="w-8 h-8" />}
              title="Tidak ada log ditemukan"
              description="Coba ubah filter atau rentang tanggal."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleLogs.map(r => (
                <div
                  key={r.id}
                  className={`p-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${isAdminMode && selectedIds.has(r.id) ? 'bg-accent-50/60 dark:bg-accent-500/5' : ''}`}
                >
                  {isAdminMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelectOne(r.id)}
                      className="w-4 h-4 rounded accent-[#ea580c] dark:accent-[#f97316] cursor-pointer shrink-0"
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
                      <IconButton
                        variant="delete" ghost
                        title="Hapus (pindah ke recycle bin)"
                        onClick={() => handleDeleteRecord(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
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
      )}

      <Modal
        isOpen={!!editEmployeeId}
        onClose={closeManualModal}
        title="Tambah Record Manual"
      >
        <div className="px-5 pb-5 pt-1 flex flex-col gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-1 truncate">
            {editEmployeeName}
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tipe Absen
            </label>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              <option value="masuk">Masuk</option>
              <option value="bolong">Jam Bolong</option>
              <option value="masuk_lagi">Masuk Lagi</option>
              <option value="keluar">Keluar</option>
              <option value="libur">Libur</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Jam
            </label>
            <input
              type="time" value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
          </div>
          <div className="flex items-center gap-2 justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={closeManualModal}>
              Batal
            </Button>
            <Button variant="dark" size="sm" onClick={handleAddManualRecord} disabled={!editTime}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

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