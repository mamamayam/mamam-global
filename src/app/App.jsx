import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { usePersistState } from '../hook/usePersistState';
import { useOnlineStatus } from '../hook/useOnlineStatus';
import { INITIAL_MENUS, INITIAL_VARIANT_GROUPS, INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from '../data/initialData';
import { AppContext } from '../context/AppContext';
import { usePosStore } from '../store/usePosStore';
import { Modal, Button } from '../components/ui';
import PinModal from '../auth/PinModal';
import LoginView from '../auth/LoginView';
import UpdatePrompt from '../components/UpdatePrompt';
import AppRoutes from '../app/AppRoutes';
import AppLayout from '../app/AppLayout';
import Sidebar from '../app/layout/Sidebar';
import Header from '../app/layout/Header';
import BottomNav from '../app/layout/BottomNav';
import ReceiptModal from '../features/pos/ReceiptModal';
import { toLocalDateString } from '../utils/formatters';
import { activeOnly } from '../utils/softDelete';
import { computeAvailableMaterials } from '../utils/hppUtils';
import { registerPushNotifications } from '../storage/pushNotifications';
import {
  getEmployeeStatus, computeAttendanceFromLogs,
  snapshotEmployeeForPayroll, mergeAutoAdjustments,
} from '../features/hrd/utils/payrollLogic';

import {
  AlertCircle,
  Briefcase,
  Calculator,
  CheckCircle2,
  TrendingDown,
  Clock,
  Fingerprint,
  History,
  List,
  RefreshCw,
  Settings,
  ShoppingCart,
  TrendingUp,
  UserCog,
  Users,
  Download,
  Warehouse,
  BarChart3,
  Scale,
  Wifi,
  WifiOff,
} from 'lucide-react';

// Interval auto-sync berkala (lihat useEffect di bawah). 10 menit — cukup
// sering buat nangkep perubahan config selama jam kerja, tapi murah karena
// runAutoSync cuma push kalau BENERAN ada yang beda (gak ada network call
// kalau nggak ada perubahan).
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

// Batas mundur (hari) buat watchdog backfill "Libur" otomatis (lihat
// useEffect di bawah). 60 hari cukup longgar buat nutup kasus "app gak
// dibuka berminggu-minggu", tapi tetap mencegah karyawan lama (bertahun-
// tahun kerja) tiba-tiba nge-generate ratusan/ribuan record "Libur"
// backdated sekaligus pas app dibuka lagi setelah lama nganggur.
const AUTO_LIBUR_BACKFILL_DAYS = 60;




export default function App() {


  // --- BACK NAVIGATION ---
  const [viewHistory, setViewHistory] = useState([]);
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef(null);
  const exitToastTimerRef = useRef(null);

  const [variantCategories, setVariantCategories] = useState(['Lainnya']);

  // --- TOAST KONEKSI ONLINE/OFFLINE ---
  const { isOnline, justWentOnline, justWentOffline, clearTransition } = useOnlineStatus();
  const [connectionToast, setConnectionToast] = useState(null); // { msg, type: 'offline'|'syncing'|'online' }
  const connectionToastTimerRef = useRef(null);


  const [isAdminMode, setIsAdminMode] = useState(false);

  // ── Employee yang lagi "login", terpisah dari sesi anonim otomatis ──────
  // getSupabaseClient()/ensureAuthSession di syncClient.js SELALU nyoba
  // signInAnonymously() kalau belum ada sesi apapun -- itu buat keperluan
  // sync/echo-suppression doang (lihat komentar di syncClient.js), BUKAN
  // berarti "sudah login". Kalau ada sesi employee ASLI (is_anonymous ===
  // false, dari alur PIN lama), itu tetap dipakai buat resolve di bawah.
  //
  // SEMENTARA (atas permintaan Agung, 1 Sep 2026): LoginView.jsx udah gak
  // manggil signInWithPassword lagi (PIN dicabut dulu), jadi jalur utama
  // ngisi currentEmployee sekarang lewat handleManualEmployeeLogin di bawah,
  // bukan dari resolveEmployeeFromSession. Effect di bawah ini dibiarkan
  // apa adanya (gak ngefek kalau gak ada sesi employee asli), biar gampang
  // diaktifin lagi kalau PIN dipasang balik nanti.
  //
  // undefined = lagi dicek, null = belum ada employee yang login,
  // {id,name,role,is_active} = login sebagai employee itu.
  const [currentEmployee, setCurrentEmployee] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = null;

    (async () => {
      const { getSupabaseClient } = await import('../storage/syncClient');
      const supabase = await getSupabaseClient();
      if (!supabase) { if (!cancelled) setCurrentEmployee(null); return; }

      const resolveEmployeeFromSession = async (session) => {
        if (!session?.user || session.user.is_anonymous) {
          if (!cancelled) { setCurrentEmployee(null); setIsAdminMode(false); }
          return;
        }
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('id, name, role, is_active')
            .eq('id', session.user.id)
            .single();
          if (error || !data || !data.is_active) {
            // Baris employees-nya kehapus/dinonaktifkan tapi sesi masih
            // nyangkut di device ini -- paksa logout, jangan biarin akses.
            await supabase.auth.signOut();
            if (!cancelled) { setCurrentEmployee(null); setIsAdminMode(false); }
            return;
          }
          if (!cancelled) {
            setCurrentEmployee(data);
            setIsAdminMode(data.role === 'admin');
          }
        } catch (err) {
          console.warn('[App] gagal resolve employee dari sesi:', err.message);
          if (!cancelled) setCurrentEmployee(null);
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      await resolveEmployeeFromSession(session);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
        resolveEmployeeFromSession(newSession);
      });
      unsubscribeAuth = () => sub.subscription.unsubscribe();
    })();

    return () => { cancelled = true; unsubscribeAuth?.(); };
  }, []);

  // Login manual TANPA PIN (atas permintaan Agung, 1 Sep 2026) -- dipanggil
  // dari LoginView.jsx pas tap nama / abis bootstrap admin pertama. SENGAJA
  // gak lewat Supabase Auth sama sekali (gak ada signInWithPassword lagi di
  // LoginView), jadi currentEmployee di-set langsung di sini, gak nunggu
  // onAuthStateChange kayak alur lama. Sesi anonim buat sync tetap jalan
  // apa adanya di background, gak kesentuh sama sekali oleh ini.
  const handleManualEmployeeLogin = useCallback((emp) => {
    setCurrentEmployee(emp);
    setIsAdminMode(emp.role === 'admin');
  }, []);

  const signOutEmployee = useCallback(async () => {
    // Selama login manual (tanpa PIN) yang dipakai, gak ada sesi auth
    // per-employee yang beneran berubah pas "logout" -- reset manual di
    // sini juga, jangan cuma andelin signOut() + onAuthStateChange.
    setCurrentEmployee(null);
    setIsAdminMode(false);
    try {
      const { getSupabaseClient } = await import('../storage/syncClient');
      const supabase = await getSupabaseClient();
      await supabase?.auth.signOut();
    } catch (err) {
      console.warn('[App] signOut error:', err.message);
    }
  }, []);
  const [showPinModal, setShowPinModal] = useState(false);

  const [currentView, setCurrentView] = useState('kasir');
  const [activeTab, setActiveTab] = useState('materials');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- FUNGSI NAVIGASI DENGAN HISTORY STACK ---
  // Root views = tab utama; navigasi ke sini me-reset history
  const ROOT_VIEWS = useMemo(() => new Set(['beranda', 'kasir', 'pengaturan']), []);

  // Tampilkan toast "ketuk sekali lagi" dan handle double-tap exit
  const handleExitAttempt = useCallback(() => {
    const now = Date.now();
    if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
      // Tekan kedua dalam 2 detik → keluar aplikasi
      CapacitorApp.exitApp();
    } else {
      // Tekan pertama → tampilkan toast
      lastBackPressRef.current = now;
      setShowExitToast(true);
      clearTimeout(exitToastTimerRef.current);
      exitToastTimerRef.current = setTimeout(() => {
        setShowExitToast(false);
        lastBackPressRef.current = null;
      }, 2000);
    }
  }, []);

  // navigate(view) → push ke history stack, lalu pindah view
  const navigate = useCallback((view) => {
    if (view === currentView) return;
    if (ROOT_VIEWS.has(view)) {
      // Navigasi ke root → reset stack
      setViewHistory([]);
    } else {
      // Navigasi ke sub-halaman → simpan halaman saat ini ke stack
      setViewHistory(prev => [...prev, currentView]);
    }
    setCurrentView(view);
  }, [currentView, ROOT_VIEWS]);

  // navigateBack() → dipanggil saat tombol back ditekan
  const navigateBack = useCallback(() => {
    if (viewHistory.length > 0) {
      // Ada history → kembali ke view sebelumnya
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory(h => h.slice(0, -1));
      setCurrentView(prev);
    } else if (currentView !== 'beranda') {
      // Tidak ada history, bukan beranda → ke beranda
      setCurrentView('beranda');
    } else {
      // Di beranda tanpa history → double-tap exit
      handleExitAttempt();
    }
  }, [viewHistory, currentView, handleExitAttempt]);

  // ── Sync status (dipakai untuk UI blocking saat startup) ────────────────
  // 'idle'     = Supabase tidak dikonfigurasi, langsung masuk app
  // 'syncing'  = sedang initial pull dari Supabase (semua push diblok)
  // 'ready'    = pull selesai, push diizinkan, realtime aktif
  // 'error'    = pull gagal, masuk app dengan data lokal
  // Kalau Supabase dikonfigurasi, langsung mulai dengan 'syncing' supaya
  // overlay muncul SEGERA tanpa gap antara allDataLoaded dan async IIFE
  const [syncStatus, setSyncStatus] = useState(() => {
    const url = import.meta.env?.VITE_SUPABASE_URL;
    const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    return (url && key) ? 'syncing' : 'idle';
  });
  const [syncStep, setSyncStep] = useState('Menghubungkan ke server...');

  const cleanupRef = useRef(null);
  const reconnectRef = useRef(null);
  const pullNowRef = useRef(null);

  // ── Status sync buat UI (indikator "terakhir sync" + tombol manual) ────
  // mamam_last_supabase_sync & event mamam_sync_updated SUDAH ada dari dulu
  // di realtimeSync.js (di-set tiap push instan sukses & tiap runAutoSync
  // selesai) — sebelumnya cuma disimpan ke localStorage tanpa ada yang
  // dengerin buat nampilin ke user. Effect ini yang baru: dengerin event-nya
  // dan taruh ke state biar bisa dipakai re-render (HistoryView, dkk).
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    try { return localStorage.getItem('mamam_last_supabase_sync'); } catch (err) { console.warn('[App] localStorage gak bisa diakses:', err.message); return null; }
  });
  // BARU (anti-error): sebelumnya push yang gagal cuma console.warn — invisible
  // buat user, gak ada cara tau ada data yang nyangkut kecuali buka console.
  // Sekarang jumlah item gagal disimpan di state, biar bisa ditampilin di UI
  // (misal "⚠ 2 gagal sync"). Di-reset ke 0 begitu ada siklus yang 100% sukses.
  const [lastSyncFailedCount, setLastSyncFailedCount] = useState(0);
  useEffect(() => {
    const handleSyncUpdated = () => {
      try { setLastSyncedAt(localStorage.getItem('mamam_last_supabase_sync')); } catch (err) { console.warn('[App] localStorage gak bisa diakses:', err.message); }
    };
    window.addEventListener('mamam_sync_updated', handleSyncUpdated);
    return () => window.removeEventListener('mamam_sync_updated', handleSyncUpdated);
  }, []);

  // Sync manual "push + pull" dalam satu tombol — dipakai HistoryView (dan
  // layar lain kalau perlu) buat maksa re-check ke database, bukan cuma
  // ngirim perubahan lokal doang kayak "Sync Manual Sekarang" yang lama di
  // BackupView (itu cuma runAutoSync push-only, sengaja gak diubah biar
  // behaviour lama gak berubah — ini tambahan jalur baru).
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const triggerManualSync = useCallback(async () => {
    if (isManualSyncing) return { sent: 0, failed: 0 };
    setIsManualSyncing(true);
    try {
      const { runAutoSync } = await import('../storage/realtimeSync');
      const { sent, failed, failedItems } = await runAutoSync({ force: true });
      setLastSyncFailedCount(failed);
      if (failed > 0) console.warn('[App] Detail item gagal (sync manual):', failedItems);
      // pullNow return-nya status ({ok, reason}), bukan data — biar caller
      // (tombol UI) bisa ngasih tau user kalau kena cooldown/lagi jalan,
      // bukan diem-diem dianggap "sukses tapi gak ngapa-ngapain".
      const pullResult = await pullNowRef.current?.();
      try { setLastSyncedAt(localStorage.getItem('mamam_last_supabase_sync')); } catch (err) { console.warn('[App] localStorage gak bisa diakses:', err.message); }
      return { sent, failed, pullSkippedReason: pullResult?.ok === false ? pullResult.reason : null };
    } catch (e) {
      console.warn('[App] triggerManualSync error:', e?.message);
      return { sent: 0, failed: 0, error: e?.message };
    } finally {
      setIsManualSyncing(false);
    }
  }, [isManualSyncing]);

  const syncGateRef = useRef(null);
  if (!syncGateRef.current) {
    let resolveSync;
    const promise = new Promise(r => { resolveSync = r; });
    syncGateRef.current = { promise, resolveSync };
  }
  const syncReadyPromise = syncGateRef.current.promise;

  const [variantGroups, setVariantGroups, l1, setVariantGroupsRemote] = usePersistState('variantGroups', INITIAL_VARIANT_GROUPS, { syncMode: 'config', syncReadyPromise });
  const [menus, setMenus, l2, setMenusRemote] = usePersistState('menus', INITIAL_MENUS, { syncMode: 'config', syncReadyPromise });
  const [salesHistory, setSalesHistory, l3, setSalesHistoryRemote] = usePersistState('salesHistory', [], { syncMode: 'transaction', syncReadyPromise });
  const [hppLibrary, setHppLibrary, l4, setHppLibraryRemote] = usePersistState('hppLibrary', [], { syncMode: 'config', syncReadyPromise });
  const [savedBills, setSavedBills, l5, setSavedBillsRemote] = usePersistState('savedBills', [], { syncMode: 'transaction', syncReadyPromise });

  // --- HPP & BAHAN BAKU ---
  const [rawMaterials, setRawMaterials, l6, setRawMaterialsRemote] = usePersistState('rawMaterials', INITIAL_RAW_MATERIALS, { syncMode: 'config', syncReadyPromise });
  const [semiFinished, setSemiFinished, l7, setSemiFinishedRemote] = usePersistState('semiFinished', [], { syncMode: 'config', syncReadyPromise });
  const [categories, setCategories, l8, setCategoriesRemote] = usePersistState('categories', INITIAL_CATEGORIES, { syncMode: 'config', syncReadyPromise });
  const [editingRecipe, setEditingRecipe] = useState(null);
  // Koreksi Stok Opname (Patch 3) — layer TERPISAH dari stock_checklists
  // (yang datanya punya mamam-absensi & dibaca read-only). Owner override
  // qty per (tanggal, rawMaterialId) di sini tanpa nyentuh data checklist
  // asli karyawan sama sekali — lihat stockChecklistApi.js: valuateChecklist.
  const [stockOpnameCorrections, setStockOpnameCorrections] = usePersistState('stockOpnameCorrections', [], { syncMode: 'config', syncReadyPromise });

  // --- KEUANGAN ---
  const [expenseCategories, setExpenseCategories, l9, setExpenseCategoriesRemote] = usePersistState('expenseCategories', ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain'], { syncMode: 'config', syncReadyPromise });
  const [expenses, setExpenses, l10, setExpensesRemote] = usePersistState('expenses', [], { syncMode: 'transaction', syncReadyPromise });
  const [incomeCategories, setIncomeCategories, l11, setIncomeCategoriesRemote] = usePersistState('incomeCategories', ['Modal Tambahan', 'Pendapatan Lain', 'Titipan Uang'], { syncMode: 'config', syncReadyPromise });
  const [incomes, setIncomes, l12, setIncomesRemote] = usePersistState('incomes', [], { syncMode: 'transaction', syncReadyPromise });
  // Setoran kurir -> kasir. Ledger TERPISAH dari expenses/incomes (bukan
  // pemasukan/pengeluaran bisnis, cuma perpindahan kas internal) — lihat
  // penjelasan lengkap di utils/cashHolders.js
  const [cashTransfers, setCashTransfers, l25, setCashTransfersRemote] = usePersistState('cashTransfers', [], { syncMode: 'transaction', syncReadyPromise });

  // --- SHIFT ---
  const [currentShift, setCurrentShift, l13, setCurrentShiftRemote] = usePersistState('currentShift', null, { syncMode: 'live', syncReadyPromise });
  const [shiftHistory, setShiftHistory, l14, setShiftHistoryRemote] = usePersistState('shiftHistory', [], { syncMode: 'transaction', syncReadyPromise });

  // --- PELANGGAN ----
  const [customers, setCustomers, l15, setCustomersRemote] = usePersistState('customers', [], { syncMode: 'transaction', syncReadyPromise });
  const [vouchers, setVouchers, l16, setVouchersRemote] = usePersistState('vouchers', [], { syncMode: 'config', syncReadyPromise });
  const [claimsHistory, setClaimsHistory, l17, setClaimsHistoryRemote] = usePersistState('claimsHistory', [], { syncMode: 'transaction', syncReadyPromise });

  // --- PAYROLL STATES ---
  const [employees, setEmployees, l18, setEmployeesRemote] = usePersistState('employees', [], { syncMode: 'config', syncReadyPromise });
  const [employeeDailyRecords, setEmployeeDailyRecords, l19, setEmployeeDailyRecordsRemote] = usePersistState('employeeDailyRecords', [], { syncMode: 'transaction', syncReadyPromise });
  const [attendanceLog, setAttendanceLog, l24, setAttendanceLogRemote] = usePersistState('attendanceLog', [], { syncMode: 'transaction', syncReadyPromise });
  const [additionCategories, setAdditionCategories, l20, setAdditionCategoriesRemote] = usePersistState('additionCategories', ['Ongkir', 'Lembur', 'Bonus', 'Potongin Ayam'], { syncMode: 'config', syncReadyPromise });
  const [deductionCategories, setDeductionCategories, l21, setDeductionCategoriesRemote] = usePersistState('deductionCategories', ['Kasbon', 'Denda', 'Ganti Rugi'], { syncMode: 'config', syncReadyPromise });
  // Saldo awal bulan per karyawan ("sisa kasbon/gaji bulan kemarin") — satu
  // record per (employeeId, month), diinput manual di Rekap Penggajian.
  // syncMode 'transaction' (bukan 'config') karena ini array-of-record
  // dengan `id`, konsisten dengan employeeDailyRecords/expenses — supaya
  // upsert per-baris & aman dari race condition antar device (lihat
  // catatan id deterministik di payrollLogic.js).
  const [openingBalances, setOpeningBalances, l26, setOpeningBalancesRemote] = usePersistState('openingBalances', [], { syncMode: 'transaction', syncReadyPromise });

  // --- SETTINGS ---
  const [storeSettings, setStoreSettings, l22, setStoreSettingsRemote] = usePersistState('storeSettings', {
    autoPrint: false, paperSize: '58mm', printLogo: true, taxRate: 0, serviceCharge: 0
  }, { syncMode: 'config', syncReadyPromise });

  const [theme, setTheme, l23] = usePersistState('theme', 'light');
  const [colorTheme, setColorThemeState] = usePersistState('colorTheme', 'orange');

  useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, [colorTheme]);

  const setColorTheme = (newTheme) => {
    setColorThemeState(newTheme);
  };

  // Terapkan class .dark ke <html> setiap kali tema berubah
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Semua data dari Dexie sudah selesai dimuat?
  const allDataLoaded = ![l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21, l22, l23, l24, l25].some(Boolean);

  // ── Map setter remote — dipakai oleh realtime callback ──────────────────
  const remoteSetterMap = useRef({});
  useEffect(() => {
    remoteSetterMap.current = {
      variantGroups: setVariantGroupsRemote,
      menus: setMenusRemote,
      salesHistory: setSalesHistoryRemote,
      hppLibrary: setHppLibraryRemote,
      savedBills: setSavedBillsRemote,
      rawMaterials: setRawMaterialsRemote,
      semiFinished: setSemiFinishedRemote,
      categories: setCategoriesRemote,
      expenseCategories: setExpenseCategoriesRemote,
      expenses: setExpensesRemote,
      incomeCategories: setIncomeCategoriesRemote,
      incomes: setIncomesRemote,
      cashTransfers: setCashTransfersRemote,
      currentShift: setCurrentShiftRemote,
      shiftHistory: setShiftHistoryRemote,
      customers: setCustomersRemote,
      vouchers: setVouchersRemote,
      claimsHistory: setClaimsHistoryRemote,
      employees: setEmployeesRemote,
      employeeDailyRecords: setEmployeeDailyRecordsRemote,
      attendanceLog: setAttendanceLogRemote,
      additionCategories: setAdditionCategoriesRemote,
      deductionCategories: setDeductionCategoriesRemote,
      storeSettings: setStoreSettingsRemote,
      openingBalances: setOpeningBalancesRemote,
    };
  });

  // ── Inisialisasi Realtime Sync — jalankan SETELAH Dexie selesai dimuat ──
  // Urutan wajib: (1) connect → (2) initial pull server → (3) merge lokal
  // → (4) simpan → (5) resolve syncReadyPromise → (6) push diizinkan
  useEffect(() => {
    if (!allDataLoaded) return;

    let cancelled = false;

    // Fallback timeout 15 detik — kalau Supabase stuck, buka app dengan data lokal
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      console.warn('[App] Sync timeout 15s — masuk dengan data lokal');
      syncGateRef.current.resolveSync?.();
      setSyncStatus('error');
      setSyncStep('');
    }, 15000);

    (async () => {
      // Dynamic import agar tidak error saat modul tidak tersedia
      let isSupabaseConfigured, initRealtimeSync;
      try {
        ({ isSupabaseConfigured } = await import('../storage/syncClient'));
        ({ initRealtimeSync } = await import('../storage/realtimeSync'));
      } catch {
        syncGateRef.current.resolveSync?.();
        return;
      }

      // Jika Supabase tidak dikonfigurasi, langsung resolve supaya push tidak diblok
      if (!isSupabaseConfigured()) {
        syncGateRef.current.resolveSync?.();
        return;
      }

      if (cancelled) return;

      // syncStatus sudah 'syncing' dari initial state — tidak perlu set ulang
      setSyncStep('Mengambil data dari server...');

      const { unsubscribe, reconnect, pullNow, syncReadyPromise: enginePromise } = initRealtimeSync({
        // Dipanggil saat initial pull SELESAI untuk satu tableKey (transaksi)
        // atau saat realtime event datang dari device lain.
        // `fullArray` = array penuh hasil merge (initial pull); `item` = satu record (realtime)
        onTransactionUpsert: (tableKey, item, fullArray) => {
          const setter = remoteSetterMap.current[tableKey];
          if (!setter) return;
          if (fullArray) {
            // Initial pull → set langsung array penuh hasil merge
            setter(fullArray);
          } else if (item) {
            // Realtime event → upsert satu item ke dalam state
            setter(prev => {
              const arr = Array.isArray(prev) ? prev : [];
              const idx = arr.findIndex(e => String(e.id) === String(item.id));
              return idx >= 0 ? arr.map((e, i) => i === idx ? item : e) : [...arr, item];
            });
          }
        },
        onTransactionDelete: (tableKey, id) => {
          const setter = remoteSetterMap.current[tableKey];
          if (!setter) return;
          setter(prev => (Array.isArray(prev) ? prev : []).filter(e => String(e.id) !== String(id)));
        },
        onConfigUpdate: (key, value) => {
          const setter = remoteSetterMap.current[key];
          if (setter) setter(value);
        },
      });

      enginePromise.then(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        syncGateRef.current.resolveSync?.();
        setSyncStatus('ready');
        setSyncStep('');
        console.log('[App] Sinkronisasi awal selesai ✅ — push diizinkan');

        // Catch-up otomatis begitu app kebuka: kalo sesi sebelumnya ketutup
        // sebelum sempat sync (config/transaksi numpuk), langsung coba kirim
        // SEKARANG — gak nunggu user pencet manual atau nunggu jam tertentu.
        (async () => {
          try {
            const { runAutoSync } = await import('../storage/realtimeSync');
            const { sent, failed, failedItems } = await runAutoSync({ force: true });
            if (sent > 0 || failed > 0) {
              console.log(`[App] Catch-up sync startup: ${sent} terkirim, ${failed} gagal`);
              if (failed > 0) console.warn('[App] Detail item gagal (catch-up startup):', failedItems);
            }
          } catch (e) {
            console.warn('[App] Catch-up sync startup error:', e?.message);
          }
        })();
      }).catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.warn('[App] Sync awal gagal, masuk dengan data lokal:', err?.message);
        syncGateRef.current.resolveSync?.();
        setSyncStatus('error');
        setSyncStep('');
      });

      // Simpan unsubscribe & reconnect ke ref agar bisa dipanggil dari luar
      // effect ini (cleanup & listener resume di effect terpisah di bawah).
      cleanupRef.current = unsubscribe;
      reconnectRef.current = reconnect;
      pullNowRef.current = pullNow;
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanupRef.current?.();
    };
  }, [allDataLoaded]);

  useEffect(() => {
    if (allDataLoaded) {
      registerPushNotifications();
    }
  }, [allDataLoaded]);

  // ── Toast koneksi: reaksi ke transisi online/offline ────────────────────
  // - Baru mati → toast "Mode Offline", nempel sampai online lagi (gak auto-hide).
  // - Baru nyala → toast "Menyinkronkan ulang..." lalu trigger runAutoSync
  //   force, baru toast "Tersinkronisasi" dan auto-hide.
  useEffect(() => {
    if (justWentOffline) {
      clearTimeout(connectionToastTimerRef.current);
      setConnectionToast({ msg: 'Mode Offline — perubahan disimpan lokal', type: 'offline' });
      clearTransition();
      return;
    }

    if (justWentOnline) {
      clearTimeout(connectionToastTimerRef.current);
      setConnectionToast({ msg: 'Online — menyinkronkan ulang...', type: 'syncing' });
      clearTransition();

      (async () => {
        try {
          const { isSupabaseConfigured } = await import('../storage/syncClient');
          if (!isSupabaseConfigured()) {
            setConnectionToast(null);
            return;
          }
          const { runAutoSync } = await import('../storage/realtimeSync');
          const { sent, failed, failedItems } = await runAutoSync({ force: true });
          if (failed > 0) console.warn('[App] Detail item gagal (reconnect):', failedItems);
          setConnectionToast({
            msg: failed > 0
              ? `Tersinkronisasi sebagian — ${sent} terkirim, ${failed} gagal`
              : sent > 0 ? `Tersinkronisasi — ${sent} perubahan terkirim` : 'Tersinkronisasi ✓',
            type: 'online',
          });
        } catch {
          setConnectionToast({ msg: 'Online, tapi sync gagal — coba manual sync', type: 'online' });
        } finally {
          connectionToastTimerRef.current = setTimeout(() => setConnectionToast(null), 3500);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justWentOffline, justWentOnline]);

  useEffect(() => () => clearTimeout(connectionToastTimerRef.current), []);

  // ── Watchdog backfill "Libur" otomatis ──────────────────────────────────
  // Karyawan yang SAMA SEKALI gak absen (gak login/logout, gak ada
  // attendanceLog apa pun) di suatu hari harusnya otomatis kehitung "Libur"
  // di employeeDailyRecords. Sebelumnya ini cuma ditangani lewat 2 jalur
  // yang SAMA-SAMA cuma jalan kalau ada device yang MEMBUKA halaman
  // tertentu hari itu:
  //   1. AttendanceView.jsx (toAutoLibur, watchdog checkAutoClose) — cuma
  //      jalan kalau tab Absensi kebuka.
  //   2. InputDailyTab.jsx (computeAttendanceFromLogs via pairsMap) — cuma
  //      jalan buat karyawan yang PUNYA minimal 1 attendanceLog hari itu,
  //      dan cuma kalau tab Input Harian/Rekap Laporan kebuka.
  // Kalau di suatu hari gak ada satu device pun yang buka salah satu dari
  // 2 halaman itu, karyawan yang nihil absen hari itu gak pernah ke-mark
  // Libur — hilang dari rekap kinerja, bukan kehitung 0.
  //
  // Fix: watchdog ini jalan di level App.jsx (ROOT), sama seperti pola
  // auto-sync berkala di atas — jadi ke-trigger begitu app dibuka lewat
  // MODUL MANAPUN (Kasir, HRD, dst), gak perlu masuk ke menu HRD dulu.
  // Sifatnya lazy/computed-on-read (dihitung ulang tiap kali jalan
  // berdasarkan tanggal SEKARANG vs tanggal yang di-scan) — BUKAN
  // bergantung pada jam tertentu, sama seperti bulletproofing auto
  // clock-out yang sudah ada. AttendanceView.jsx (toAutoLibur) TETAP
  // dibiarkan seperti aslinya — watchdog ini cuma nutup celah kalau
  // kebetulan tab Absensi gak sempat kebuka hari itu.
  useEffect(() => {
    // Data belum selesai dimuat dari Dexie → jangan jalan dulu, nanti bisa
    // salah backfill berdasarkan data kosong/parsial.
    if (!allDataLoaded) return;
    if (!employees || employees.length === 0) return;

    // [FIX] ROOT CAUSE dari "karyawan selalu ke-declare Libur padahal ada
    // log masuk": `allDataLoaded` HANYA menjamin Dexie LOKAL device ini
    // sudah selesai dibaca — BUKAN menjamin `attendanceLog` sudah lengkap.
    // Initial pull dari Supabase (yang narik & merge log dari device LAIN,
    // lihat useEffect "Inisialisasi Realtime Sync" di atas) berjalan async
    // SETELAH allDataLoaded jadi true, dan baru selesai saat syncStatus
    // berubah jadi 'ready' (atau 'error' kalau pull gagal & fallback ke
    // data lokal). Tanpa guard ini, watchdog bisa nge-scan & nge-declare
    // Libur berdasarkan attendanceLog yang masih versi LOKAL PARSIAL (mis.
    // device ini baru pertama kali dipakai employee tsb, atau baru
    // reinstall/clear data) — padahal log 'masuk' aslinya sudah ada di
    // Supabase / device lain, cuma belum sempat ke-pull & masuk ke state.
    //
    // 'idle' tetap diizinkan lanjut (artinya Supabase memang tidak
    // dikonfigurasi sama sekali di device ini — tidak ada apa pun yang
    // perlu ditunggu, attendanceLog lokal SUDAH final).
    if (syncStatus === 'syncing') return;

    const todayStr = toLocalDateString();

    setEmployeeDailyRecords(prev => {
      // [FIX] ROOT CAUSE dari "Libur nimpa data absen yang udah ada dan gak
      // pernah kekoreksi": eligibility "boleh direcompute otomatis atau
      // tidak" SEBELUMNYA dicek dari pola id ("bukan AUTO-LIBUR" = dianggap
      // final). Itu keliru — record hasil hitung OTOMATIS dari
      // InputDailyTab.jsx (id prefix "REC-", lihat efek "Generator record
      // harian otomatis" di sana) JUGA bisa salah dari awal, misalnya kalau
      // efek itu sempat jalan SAAT attendanceLog di device itu belum
      // lengkap (log 'masuk' asli belum sempat ke-sync dari device lain,
      // tapi record 'libur' hasil watchdog checkAutoClose di
      // AttendanceView.jsx sudah kebaca duluan). Karena id-nya "REC-"
      // (bukan "AUTO-LIBUR..."), record salah ini lolos dari pengecekan
      // lama SELAMANYA — gak pernah direcompute ulang walau log 'masuk'
      // aslinya akhirnya nyampe, jadi karyawan yang beneran hadir tetap
      // ke-declare Libur di rekap/gajian. Sumber kebenaran yang benar buat
      // "boleh disentuh otomatis" adalah flag `isManualOverride` (cuma
      // diset true lewat form koreksi manual admin — lihat handleSaveEdit
      // di InputDailyTab.jsx) — bukan pola id-nya.
      const manualOverrideKeys = new Set(
        activeOnly(prev)
          .filter(r => r.isManualOverride)
          .map(r => `${r.employeeId}|${r.dateStr}`)
      );
      const recordByKey = new Map(
        activeOnly(prev).map(r => [`${r.employeeId}|${r.dateStr}`, r])
      );
      const earliestBackfillDate = new Date();
      earliestBackfillDate.setDate(earliestBackfillDate.getDate() - AUTO_LIBUR_BACKFILL_DAYS);

      const pairsToBackfill = [];
      employees.forEach(emp => {
        // Karyawan resign gak perlu terus di-backfill.
        if (getEmployeeStatus(emp) === 'resign') return;

        const empStart = emp.startDate ? new Date(`${emp.startDate}T00:00:00`) : null;
        const scanStart = empStart && empStart > earliestBackfillDate ? empStart : earliestBackfillDate;

        const cursor = new Date(scanStart);
        cursor.setHours(0, 0, 0, 0);
        // [FIX] HARI INI sekarang IKUT ter-scan (dulu cutoff = hari ini dan
        // loop berhenti SEBELUM mencapainya, jadi employeeDailyRecords hari
        // berjalan gak PERNAH disentuh watchdog root ini — self-heal-nya
        // 100% bergantung InputDailyTab.jsx kebetulan kebuka, padahal itu
        // gak dijamin, apalagi kalau device lagi standby di tab Kasir
        // seharian). Ini TIDAK mengubah kapan Libur BARU pertama kali boleh
        // di-declare untuk hari ini — itu tetap sepenuhnya kewenangan
        // checkAutoClose (AttendanceView.jsx) / computeAttendanceFromLogs
        // (lihat cabang `dateStr === todayStr` di bawah) — cuma menambah
        // kemampuan MENGOREKSI record hari ini yang SUDAH TERLANJUR salah
        // declare Libur, secepat log 'masuk' yang bener nyampe, bukan
        // nunggu sampai besok (atau nunggu InputDailyTab dibuka).
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);

        while (cursor <= cutoff) {
          const dateStr = toLocalDateString(cursor);
          const key = `${emp.id}|${dateStr}`;
          const existing = recordByKey.get(key);

          if (!manualOverrideKeys.has(key)) {
            if (dateStr === todayStr) {
              // Hari ini: JANGAN declare record baru dari sini kalau belum
              // ada record sama sekali — biarkan checkAutoClose &
              // computeAttendanceFromLogs yang nentuin kapan waktunya
              // (masih bisa "Belum Absen" sebelum jam tutup). Tapi kalau
              // SUDAH ada record auto yang bilang isDayOff:true, verifikasi
              // ulang tiap kali attendanceLog berubah — supaya begitu log
              // 'masuk' yang telat sync akhirnya nyampe, record ini ikut
              // kekoreksi HARI ITU JUGA.
              if (existing?.isDayOff) pairsToBackfill.push({ employeeId: emp.id, dateStr });
            } else if (!existing || existing.isDayOff) {
              // Hari lampau: backfill kalau belum ada record sama sekali
              // (celah lama, biasa kejadian kalau gak ada device yang buka
              // Absensi/Input Harian hari itu), ATAU verifikasi ulang kalau
              // record yang ada bilang Libur (kandidat paling rawan salah).
              // Record yang sudah "Hadir" gak perlu diverifikasi ulang di
              // sini — kalau InputDailyTab.jsx kebuka, itu tetap menjaganya
              // tetap sinkron; ini cuma nutup celah spesifik "kadung
              // ke-declare Libur & gak pernah kekoreksi".
              pairsToBackfill.push({ employeeId: emp.id, dateStr });
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      if (pairsToBackfill.length === 0) return prev;

      let next = [...prev]; let changed = false;
      pairsToBackfill.forEach(({ employeeId: empId, dateStr }) => {
        // computeAttendanceFromLogs dipanggil dengan attendanceLog TERKINI
        // — pasangan (karyawan, tanggal) yang record-nya masih auto (bukan
        // isManualOverride) ikut masuk sini walau attendanceLog buat
        // pasangan itu sudah ada isinya, justru supaya bisa dicek ulang:
        // kalau ternyata ada log 'masuk' asli (mis. baru sampai lewat sync
        // device lain), hasMasuk menang dan status jadi "Hadir" — bukan
        // lagi selalu "Libur". Untuk pasangan yang BENERAN belum py log
        // apa pun, cabang isPastCloseHour tetap aktif seperti semula.
        const result = computeAttendanceFromLogs(empId, dateStr, attendanceLog);
        if (result.status === 'Belum Absen' && !result.isDayOff) return;

        const emp = employees.find(e => e.id === empId);
        const prevIndex = next.findIndex(r => !r.deletedAt && r.employeeId === empId && r.dateStr === dateStr);
        const prevExisting = prevIndex >= 0 ? next[prevIndex] : null;

        // [FIX] isManualOverride sudah difilter di TAHAP PEMBENTUKAN
        // pairsToBackfill di atas (manualOverrideKeys) — jadi prevExisting
        // di sini, kalau ada, DIJAMIN bukan hasil koreksi manual admin,
        // aman buat ditimpa kalau hasil hitung terbaru berbeda. Koreksi
        // manual admin TIDAK PERNAH sampai sini sama sekali (sudah
        // di-exclude dari pairsToBackfill), jadi keputusan admin (mis.
        // tetap menandai Libur walau ada absen nyasar) tidak pernah
        // ketiban logic otomatis. Bandingkan SEMUA field hasil hitung
        // (bukan cuma isDayOff/clockIn/clockOut) supaya perubahan
        // bolongMinutes/hoursWorked/overtimeMinutes akibat log bolong yang
        // berubah ikut ke-capture juga, bukan cuma kasus Libur↔Hadir.
        const resultChanged = prevExisting && (
          prevExisting.isDayOff !== result.isDayOff ||
          prevExisting.clockIn !== result.clockIn ||
          prevExisting.clockOut !== result.clockOut ||
          (prevExisting.hoursWorked || 0) !== result.hoursWorked ||
          (prevExisting.bolongMinutes || 0) !== result.bolongMinutes ||
          (prevExisting.overtimeMinutes || 0) !== result.overtimeMinutes
        );

        if (prevExisting && !resultChanged) return; // sudah ada & sudah sesuai — jangan timpa

        const employeeSnapshot = snapshotEmployeeForPayroll(emp);
        const baseFields = {
          isDayOff: result.isDayOff,
          clockIn: result.clockIn,
          clockOut: result.clockOut,
          hoursWorked: result.hoursWorked,
          bolongMinutes: result.bolongMinutes,
          overtimeMinutes: result.overtimeMinutes,
        };
        const recordSnapshot = { ...baseFields, employeeId: empId, dateStr };
        const recalculatedAdditions = mergeAutoAdjustments(
          prevExisting?.additions,
          recordSnapshot,
          employeeSnapshot
        );

        changed = true;
        const correctedRecord = {
          id: prevExisting ? prevExisting.id : `AUTO-LIBUR-BACKFILL-${empId}-${dateStr}`,
          employeeId: empId,
          date: new Date(dateStr),
          dateStr,
          ...baseFields,
          additions: recalculatedAdditions,
          deductions: prevExisting?.deductions ?? [],
          employeeSnapshot,
        };

        if (prevIndex >= 0) {
          next[prevIndex] = correctedRecord;
        } else {
          next.unshift(correctedRecord);
        }
      });
      return changed ? next : prev;
    });
  }, [allDataLoaded, syncStatus, employees, attendanceLog, setEmployeeDailyRecords]);

  // ── Auto-sync berkala — GANTI cara lama (cek jam 21:00 yang cuma jalan
  // kalau layar BackupView lagi kebuka). Ini jalan di level App.jsx, tiap
  // AUTO_SYNC_INTERVAL_MS, SELAMA app kebuka — gak peduli user lagi di layar
  // mana. force:false aman dipanggil berkali-kali (lihat komen runAutoSync
  // di storage/realtimeSync.js soal kenapa itu gak akan bulk-upload key yang
  // belum pernah ke-baseline).
  const syncStatusRef = useRef(syncStatus);
  useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'ready' && syncStatus !== 'error') return;

    const id = setInterval(async () => {
      try {
        const { isAutoSyncEnabled, runAutoSync } = await import('../storage/realtimeSync');
        if (!isAutoSyncEnabled()) return;
        const { sent, failed } = await runAutoSync({ force: false });
        setLastSyncFailedCount(failed);
        if (sent > 0) console.log(`[App] Auto-sync berkala: ${sent} terkirim`);
        if (failed > 0) console.warn(`[App] Auto-sync berkala: ${failed} gagal, dicoba lagi nanti`);

        // FIX "ANGKA BEDA-BEDA DI KEMARIN": runAutoSync di atas cuma PUSH
        // (diff local vs snapshot local -> upsert). Sebelum ini, satu-satunya
        // jalur PULL cuma initial-pull sekali pas app mount + reconnect()
        // pas visibilitychange/resume. Kalau tab/app kebuka terus tanpa
        // pernah background, gak ada mekanisme apapun yang narik ulang data
        // dari device lain -> laporan closed-period (Kemarin, dll) bisa
        // nyangkut stale walau app-nya udah berjam-jam kebuka. Tambahin
        // pull tiap siklus yang sama biar interval ini beneran dua arah.
        // pullNow udah punya guard in-flight/cooldown sendiri (realtimeSync.js)
        // jadi aman dipanggil dari sini meski tombol manual/reconnect lagi
        // jalan bersamaan — gak perlu guard tambahan di sini.
        await pullNowRef.current?.();
      } catch (e) {
        console.warn('[App] Auto-sync berkala error:', e?.message);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(id);
  }, [syncStatus]);

  // ── Flush pas app di-background / dibuka lagi ───────────────────────────
  // Best-effort: begitu app diminimize/dikunci (karyawan pulang & HP
  // ditinggal, dll), coba kirim sisa perubahan SEBELUM device idle. Juga
  // coba lagi pas app dibuka balik, sebagai jaring pengaman ekstra selain
  // auto-sync berkala di atas.
  // CATATAN JUJUR: OS/browser bisa langsung suspend eksekusi JS begitu app
  // di-background — ini best-effort, BUKAN jaminan 100%. Auto-sync berkala
  // di atas tetap jalur paling reliable karena jalan selama app aktif.
  useEffect(() => {
    let lastFlush = 0;
    const FLUSH_COOLDOWN_MS = 5000; // cegah dobel-trigger kalo pause & visibilitychange nembak bareng

    const flush = async (label) => {
      if (syncStatusRef.current !== 'ready' && syncStatusRef.current !== 'error') return;
      const now = Date.now();
      if (now - lastFlush < FLUSH_COOLDOWN_MS) return;
      lastFlush = now;
      try {
        const { runAutoSync } = await import('../storage/realtimeSync');
        const { sent, failed, failedItems } = await runAutoSync({ force: true });
        console.log(`[App] Flush (${label}): ${sent} terkirim, ${failed} gagal`);
        if (failed > 0) console.warn(`[App] Detail item gagal (flush ${label}):`, failedItems);
      } catch (e) {
        console.warn(`[App] Flush (${label}) error:`, e?.message);
      }
    };

    // reconnectRef juga dipanggil dari 2 listener (visibilitychange +
    // Capacitor 'resume') yang di Android sering nembak BARENG pas app
    // dibuka dari background. Cooldown terpisah dari lastFlush di sini
    // (realtimeSync.js sendiri juga sudah punya guard-nya — ini lapis kedua)
    // supaya niatnya jelas di level caller & tetap aman kalau salah satu
    // lapis suatu saat dihapus/berubah. Lihat komen notif dobel/triple di
    // storage/realtimeSync.js untuk kronologi lengkap masalahnya.
    let lastReconnect = 0;
    const RECONNECT_COOLDOWN_MS = 5000;
    const doReconnect = (label) => {
      const now = Date.now();
      if (now - lastReconnect < RECONNECT_COOLDOWN_MS) return;
      lastReconnect = now;
      console.log(`[App] Reconnect realtime (${label})`);
      reconnectRef.current?.();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush('visibility-hidden');
      } else if (document.visibilityState === 'visible') {
        flush('visibility-visible');
        doReconnect('visibility-visible');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let pauseHandle, resumeHandle;
    (async () => {
      pauseHandle = await CapacitorApp.addListener('pause', () => flush('capacitor-pause'));
      resumeHandle = await CapacitorApp.addListener('resume', () => {
        flush('capacitor-resume');
        doReconnect('capacitor-resume');
      });
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      pauseHandle?.remove?.();
      resumeHandle?.remove?.();
    };
  }, []);

  // --- STATES APLIKASI ---
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherInputCode, setVoucherInputCode] = useState('');

  const getBulanIniStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).toISOString().split('T')[0];
  };
  const [reportDateRange, setReportDateRange] = useState({ start: getBulanIniStart(), end: new Date().toISOString().split('T')[0] });
  const [activePreset, setActivePreset] = useState('bulan_ini');

  const searchQuery = usePosStore((state) => state.searchQuery);
  const setSearchQuery = usePosStore((state) => state.setSearchQuery);
  const selectedCategory = usePosStore((state) => state.selectedCategory);
  const setSelectedCategory = usePosStore((state) => state.setSelectedCategory);
  const selectedMenuForVariant = usePosStore((state) => state.selectedMenuForVariant);
  const setSelectedMenuForVariant = usePosStore((state) => state.setSelectedMenuForVariant);
  const cart = usePosStore((state) => state.cart);
  const setCart = usePosStore((state) => state.setCart);
  const isCartOpen = usePosStore((state) => state.isCartOpen);
  const setIsCartOpen = usePosStore((state) => state.setIsCartOpen);
  const variantSelectedOptions = usePosStore((state) => state.variantSelectedOptions);
  const setVariantSelectedOptions = usePosStore((state) => state.setVariantSelectedOptions);
  const editingCartItemId = usePosStore((state) => state.editingCartItemId);
  const setEditingCartItemId = usePosStore((state) => state.setEditingCartItemId);
  const isCategoryModalOpen = usePosStore((state) => state.isCategoryModalOpen);
  const setIsCategoryModalOpen = usePosStore((state) => state.setIsCategoryModalOpen);
  const customerName = usePosStore((state) => state.customerName);
  const setCustomerName = usePosStore((state) => state.setCustomerName);
  const selectedCustomerId = usePosStore((state) => state.selectedCustomerId);
  const setSelectedCustomerId = usePosStore((state) => state.setSelectedCustomerId);
  const orderType = usePosStore((state) => state.orderType);
  const setOrderType = usePosStore((state) => state.setOrderType);
  const deliveryFee = usePosStore((state) => state.deliveryFee);
  const setDeliveryFee = usePosStore((state) => state.setDeliveryFee);
  const customDeliveryFee = usePosStore((state) => state.customDeliveryFee);
  const setCustomDeliveryFee = usePosStore((state) => state.setCustomDeliveryFee);
  const deliveryCourierId = usePosStore((state) => state.deliveryCourierId);
  const setDeliveryCourierId = usePosStore((state) => state.setDeliveryCourierId);
  const deliveryPaidTo = usePosStore((state) => state.deliveryPaidTo);
  const setDeliveryPaidTo = usePosStore((state) => state.setDeliveryPaidTo);
  const manualDiscount = usePosStore((state) => state.manualDiscount);
  const setManualDiscount = usePosStore((state) => state.setManualDiscount);
  const pointsToRedeem = usePosStore((state) => state.pointsToRedeem);
  const setPointsToRedeem = usePosStore((state) => state.setPointsToRedeem);
  const resetDraft = usePosStore((state) => state.resetDraft);
  // paymentModal pindah ke zustand — root cause "semua layar kedap-kedip
  // pas ngetik nominal bayar" adalah state ini dulu tinggal di useState
  // App.jsx, jadi tiap keystroke bikin object contextValue baru dan
  // nge-trigger re-render semua consumer useAppContext() di seluruh app.
  const paymentModal = usePosStore((state) => state.paymentModal);
  const setPaymentModal = usePosStore((state) => state.setPaymentModal);

  const [receiptModal, setReceiptModal] = useState({ isOpen: false, data: null });
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

  const [payslipModal, setPayslipModal] = useState({ isOpen: false, data: null, month: '' });
  const [perfShareModal, setPerfShareModal] = useState({ isOpen: false, data: null, rangeLabel: '' });

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

  // Fix: activeCustomer sekarang ID-based, BUKAN name-matching lagi.
  // Alasan: cocokin nama pakai string (walau udah .toLowerCase()) tetap rapuh
  // terhadap spasi nyempil di data lama & gak bisa nentuin customer yang mana
  // kalau ada 2 nama persis sama. ID gak pernah ambigu.
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (!activeCustomer || cart.length === 0) setPointsToRedeem(0);
  }, [activeCustomer, cart.length]);

  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const getDiscount = () => {
    if (!appliedVoucher) return 0;
    const subtotal = getSubtotal();
    if (subtotal < appliedVoucher.minPurchase) return 0;
    if (appliedVoucher.discountType === 'percent') return subtotal * (appliedVoucher.discountValue / 100);
    return appliedVoucher.discountValue;
  };

  const getPointDiscount = () => pointsToRedeem * 100;

  const getManualDiscountAmount = () => {
    if (!manualDiscount || !manualDiscount.value) return 0;
    if (manualDiscount.type === 'percent') return (getSubtotal() * manualDiscount.value) / 100;
    return manualDiscount.value;
  };

  const getTaxableAmount = () => Math.max(0, getSubtotal() - getDiscount() - getPointDiscount() - getManualDiscountAmount());
  const getTaxAmount = () => getTaxableAmount() * (storeSettings.taxRate / 100);
  const getServiceChargeAmount = () => getTaxableAmount() * (storeSettings.serviceCharge / 100);

  const getTotal = () => Math.max(0, getTaxableAmount() + getTaxAmount() + getServiceChargeAmount() + (orderType === 'Delivery' ? deliveryFee : 0));

  const getRoundedTotal = () => {
    const originalTotal = getTotal();

    switch (storeSettings?.roundingMode) {
      case '500':
        return Math.floor(originalTotal / 500) * 500;

      default:
        return originalTotal;
    }
  };

  const getRoundingAdjustment = () => {
    return getRoundedTotal() - getTotal();
  };

  const triggerAlert = (message) => setCustomAlert({ isOpen: true, message });
  const triggerConfirm = (message, onConfirm) => setConfirmModal({ isOpen: true, message, onConfirm });

  const applyDatePreset = (preset) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    setActivePreset(preset);

    if (preset === 'hari_ini') setReportDateRange({ start: todayStr, end: todayStr });
    else if (preset === 'minggu_ini') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).toISOString().split('T')[0], end: todayStr });
    else if (preset === 'bulan_ini') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).toISOString().split('T')[0], end: todayStr });
    else if (preset === 'bulan_berjalan') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], end: todayStr });
  };

  const updateCartItemVariants = (oldCartItemId, newVariants) => {
    setCart(cart.map(item => {
      if (item.cartItemId === oldCartItemId) {
        let extraPriceTotal = 0, variantNames = [], selectedVariantDetails = [];

        Object.entries(newVariants).forEach(([groupId, optionIds]) => {
          const group = variantGroups.find(g => g.id === groupId);
          if (group) {
            optionIds.forEach(optId => {
              const opt = group.options.find(o => o.id === optId);
              if (opt) { extraPriceTotal += opt.extraPrice; variantNames.push(opt.name); selectedVariantDetails.push({ optionId: opt.id }); }
            });
          }
        });

        const menu = menus.find(m => m.id === item.menuId);
        const basePrice = menu ? menu.price : 0;
        const newVariantNameStr = variantNames.join(', ');
        const optionKeys = selectedVariantDetails.map(v => v.optionId).sort().join('-');
        const newCartItemId = optionKeys ? `${item.menuId}-${optionKeys}` : item.menuId;

        return {
          ...item,
          cartItemId: newCartItemId,
          variantName: newVariantNameStr,
          price: basePrice + extraPriceTotal,
          variantSelectedOptions: newVariants
        };
      }
      return item;
    }));
  };

  const updateCartQty = (cartItemId, delta) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const updateCartItemNote = (cartItemId, note) => {
    setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, note } : item));
  };

  const handleOpenBill = () => {
    if (cart.length === 0) return;

    // Buat ID Transaksi
    const idTransaksi = `BILL-${Date.now().toString().slice(-4)}`;

    // 1. Format untuk disimpan ke "Saved Bills" (Draft)
    const bill = {
      id: idTransaksi,
      customerName: customerName || 'Tanpa Nama',
      customerId: activeCustomer?.id || null,
      cart,
      orderType,
      date: new Date()
    };
    setSavedBills([...savedBills, bill]);

    // 2. Format untuk dilempar ke Struk (Receipt Modal)
    const openBillData = {
      id: idTransaksi,
      date: new Date().toISOString(),
      orderType,
      customerName: customerName || 'Tanpa Nama',
      customerId: activeCustomer?.id || null,
      items: cart,
      subtotal: getSubtotal(),
      discount: getDiscount(),
      pointDiscount: getPointDiscount(),
      manualDiscountAmount: getManualDiscountAmount(),
      taxAmount: getTaxAmount(),
      serviceAmount: getServiceChargeAmount(),
      deliveryFee: orderType === 'Delivery' ? deliveryFee : 0,
      total: getTotal(),

      // --- KUNCI PENANDA BELUM LUNAS ---
      status: 'OPEN',
      paymentMethod: 'Belum Bayar'
    };

    // 3. Tampilkan Pop-up Struk!
    setReceiptModal({
      isOpen: true,
      data: openBillData,
      kembalian: 0
    });

    // 4. Reset Cart dan tutup sidebar/modal keranjang
    setCart([]);
    setCustomerName('');
    setSelectedCustomerId(null);
    setAppliedVoucher(null);
    setPointsToRedeem(0);
    setManualDiscount({ type: 'fixed', value: 0 });
    setOrderType('Takeaway');
    setDeliveryFee(0);
    setCustomDeliveryFee('');
    setDeliveryCourierId('');
    setDeliveryPaidTo('kasir');
    setIsCartOpen(false);
  };

  const loadSavedBill = (bill) => {
    setCart(bill.cart);
    setCustomerName(bill.customerName);
    // Bill lama cuma nyimpen customerName (string), belum ada selectedCustomerId.
    // Coba cocokkan ulang sekali ke customer terdaftar biar poin tetap ke-attach;
    // kalau gak ketemu (nama diketik ulang/beda), biarin null — kasir cukup
    // buka CustomerPickerModal lagi buat resolve manual, gak ada poin yang
    // "ke-klaim diam-diam" ke customer yang salah.
    // Bill baru udah nyimpen customerId langsung (reliable). Bill lama
    // (sebelum fitur ini) cuma punya customerName string — buat itu, coba
    // cocokkan ulang sekali; kalau gak ketemu, biarin null (Guest), gak ada
    // poin yang "ke-klaim diam-diam" ke customer yang salah.
    const matched = bill.customerId
      ? customers.find(c => c.id === bill.customerId)
      : bill.customerName
        ? customers.find(c => c.name.trim().toLowerCase() === bill.customerName.trim().toLowerCase())
        : null;
    setSelectedCustomerId(matched ? matched.id : null);
    setOrderType(bill.orderType);
    setSavedBills(savedBills.filter(b => b.id !== bill.id));
    triggerAlert('Bill berhasil dimuat!');
  };

  const printReceipt = () => window.print();

  // LIVE MATERIALS POOL (RAW + PREP) — logic sebenarnya ada di
  // computeAvailableMaterials (hppUtils.js), dipakai bareng oleh HppView.jsx
  // (provider terpisah yang sebelumnya punya salinan logic ini sendiri).
  const availableMaterials = useMemo(
    () => computeAvailableMaterials(rawMaterials, semiFinished),
    [rawMaterials, semiFinished]
  );

  // Membungkus semua props di Context Value
  const contextValue = {

    // POS / Cart
    getRoundedTotal,
    getRoundingAdjustment,
    isAdminMode,
    currentEmployee, // {id, name, role, is_active} employee yang lagi login, atau null
    signOutEmployee,
    cart, setCart,
    updateCartQty,
    updateCartItemNote,
    isCartOpen, setIsCartOpen,
    editingCartItemId,
    setEditingCartItemId,
    updateCartItemVariants,
    menus, setMenus,
    selectedMenuForVariant, setSelectedMenuForVariant,
    variantGroups, setVariantGroups,
    variantCategories, setVariantCategories,
    variantSelectedOptions, setVariantSelectedOptions,
    isSidebarOpen,

    resetDraft,

    vouchers, setVouchers,
    savedBills, setSavedBills,
    storeSettings, setStoreSettings,
    theme, setTheme,
    colorTheme, setColorTheme,

    // Payment / Discount
    appliedVoucher, setAppliedVoucher,
    manualDiscount, setManualDiscount,
    voucherInputCode, setVoucherInputCode,
    getDiscount,
    getManualDiscountAmount,
    getPointDiscount,

    // Order / Checkout
    customerName, setCustomerName,
    selectedCustomerId, setSelectedCustomerId,
    orderType, setOrderType,
    deliveryFee, setDeliveryFee,
    deliveryCourierId, setDeliveryCourierId,
    deliveryPaidTo, setDeliveryPaidTo,
    customDeliveryFee, setCustomDeliveryFee,

    // Customer
    activeCustomer,
    customers, setCustomers,
    pointsToRedeem, setPointsToRedeem,

    // Employee / Payroll
    allDataLoaded,
    employees, setEmployees,
    employeeDailyRecords, setEmployeeDailyRecords,
    attendanceLog, setAttendanceLog,
    additionCategories, setAdditionCategories,
    deductionCategories, setDeductionCategories,
    payslipModal, setPayslipModal,
    perfShareModal, setPerfShareModal,
    openingBalances, setOpeningBalances,

    // Inventory / HPP / Materials
    availableMaterials,
    editingRecipe, setEditingRecipe,
    hppLibrary, setHppLibrary,
    rawMaterials, setRawMaterials,
    semiFinished, setSemiFinished,
    stockOpnameCorrections, setStockOpnameCorrections,

    // Categories
    categories, setCategories,
    expenseCategories, setExpenseCategories,
    incomeCategories, setIncomeCategories,
    selectedCategory, setSelectedCategory,

    // Finance / History / Report
    claimsHistory, setClaimsHistory,
    expenses, setExpenses,
    incomes, setIncomes,
    cashTransfers, setCashTransfers,
    reportDateRange, setReportDateRange,
    salesHistory, setSalesHistory,
    shiftHistory, setShiftHistory,

    // Shift
    currentShift, setCurrentShift,

    // UI State
    currentView, setCurrentView, navigate,
    activeTab, setActiveTab,
    activePreset, setActivePreset,
    searchQuery, setSearchQuery,

    receiptModal, setReceiptModal,
    customAlert, setCustomAlert,
    confirmModal, setConfirmModal,
    isCategoryModalOpen, setIsCategoryModalOpen,

    // Helpers / Calculations
    getSubtotal,
    getTaxableAmount,
    getTaxAmount,
    getServiceChargeAmount,
    getTotal,
    formatRupiah,

    // Actions
    applyDatePreset,
    handleOpenBill,
    loadSavedBill,
    printReceipt,
    triggerAlert,
    triggerConfirm,

    // Sync
    syncStatus, // 'idle' | 'syncing' | 'ready' | 'error'
    lastSyncedAt, // ISO string terakhir kali push/pull ke Supabase sukses, atau null
    lastSyncFailedCount, // jumlah item gagal push di siklus terakhir (0 = bersih)
    isManualSyncing,
    triggerManualSync, // () => Promise<{sent, failed}> — push + pull manual on-demand
  };

  const menuItems = [

    // Operasional Harian
    { id: 'kasir', icon: ShoppingCart, label: 'Kasir Utama', category: 'Operasional Harian' },
    { id: 'dompet', icon: Clock, label: 'Dompet Kasir', category: 'Operasional Harian' },
    { id: 'riwayat', icon: History, label: 'Riwayat Pesanan', category: 'Operasional Harian' },
    { id: 'absensi', icon: Fingerprint, label: 'Absensi Karyawan', category: 'Operasional Harian' },

    // Keuangan
    { id: 'pemasukan', icon: TrendingUp, label: 'Pemasukan', category: 'Keuangan' },
    { id: 'pengeluaran', icon: TrendingDown, label: 'Pengeluaran', category: 'Keuangan' },
    { id: 'laporan', icon: BarChart3, label: 'Laporan & Profit', category: 'Keuangan' },
    { id: 'labarugi', icon: Scale, label: 'Laba Rugi', category: 'Keuangan' },

    // Produk & Stok
    { id: 'menu', icon: List, label: 'Manajemen Menu', category: 'Produk & Stok' },
    { id: 'hpp', icon: Calculator, label: 'Manajemen HPP', category: 'Produk & Stok' },
    { id: 'stok', icon: Warehouse, label: 'Stok Opname', category: 'Produk & Stok' },

    // Pegawai & Pelanggan
    { id: 'karyawan', icon: Briefcase, label: 'Manajemen Pegawai', category: 'Pegawai & Pelanggan' },
    { id: 'pelanggan', icon: Users, label: 'Pelanggan & Voucher', category: 'Pegawai & Pelanggan' },

    // Sistem
    { id: 'pengaturan', icon: Settings, label: 'Pengaturan', category: 'Sistem' },
    { id: 'backup', icon: Download, label: 'Backup & Restore', category: 'Sistem' },
    { id: 'akun', icon: UserCog, label: 'Manajemen Akun', category: 'Sistem' },

  ];

  const visibleMenus = isAdminMode
    ? menuItems
    : menuItems.filter(item =>
      ['dompet', 'absensi', 'riwayat', 'pengeluaran'].includes(item.id)
    );

  useEffect(() => {
    // 1. Buat variabel untuk menyimpan handle listener
    let backListenerHandle = null;

    // 2. Daftarkan listener tombol back hardware (Capacitor/Android)
    const setupListener = async () => {
      backListenerHandle = await CapacitorApp.addListener('backButton', () => {
        // PRIORITAS 1: Tutup Modal Struk
        if (receiptModal.isOpen) {
          setReceiptModal(r => ({ ...r, isOpen: false }));
        }
        // PRIORITAS 2: Tutup Modal Pembayaran
        else if (paymentModal.isOpen) {
          setPaymentModal(p => ({ ...p, isOpen: false }));
        }
        // PRIORITAS 3: Tutup keranjang belanja
        else if (isCartOpen) {
          setIsCartOpen(false);
        }
        // PRIORITAS 4: Tutup sidebar mobile
        else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
        // PRIORITAS 5: Navigasi kembali (pop history stack / toast exit)
        else {
          navigateBack();
        }
      });
    };

    // 3. Panggil setup
    setupListener();

    // 4. Cleanup saat unmount atau deps berubah
    return () => {
      if (backListenerHandle) backListenerHandle.remove();
      clearTimeout(exitToastTimerRef.current);
    };
  }, [
    receiptModal.isOpen,
    paymentModal.isOpen,
    isCartOpen,
    isSidebarOpen,
    navigateBack,
  ]);


  // ── Tampilan saat Supabase belum siap (blocking overlay) ────────────────
  if (!allDataLoaded || syncStatus === 'syncing') {
    const isSyncing = syncStatus === 'syncing';
    const appNameLoading = storeSettings?.appName || 'Mamam Kasir';
    const initialLoading = appNameLoading.trim().charAt(0).toUpperCase() || 'M';

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-100/40 dark:bg-slate-950/60 backdrop-blur-xl transition-all p-4 overflow-hidden">

        <style dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500&display=swap');
          .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body    { font-family: 'Inter', sans-serif; }
          @keyframes loadbar {
            0%   { transform: translateX(-100%); }
            50%  { transform: translateX(20%); }
            100% { transform: translateX(120%); }
          }
          @keyframes floatGlow {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50%      { transform: translate(10px, -14px) scale(1.06); }
          }
          .loadbar-fill { animation: loadbar 1.8s cubic-bezier(0.4,0,0.2,1) infinite; }
          .glow-orb { animation: floatGlow 6s ease-in-out infinite; }
        `
        }} />

        {/* Ambient glow orbs di background */}
        <div className="absolute -top-24 -left-16 w-72 h-72 bg-accent-300/20 dark:bg-accent-600/10 rounded-full blur-3xl glow-orb pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-accent-400/20 dark:bg-accent-500/10 rounded-full blur-3xl glow-orb pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-9 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.4)] border border-white/60 dark:border-slate-800/60 flex flex-col items-center max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-700 ease-out">

          {/* Logo mark + Loader cincin */}
          <div className="relative flex items-center justify-center w-24 h-24 mb-7">
            {/* Lingkaran statis tipis */}
            <div className="absolute inset-0 rounded-full border-[1px] border-slate-200 dark:border-slate-700/50"></div>

            {/* Lingkaran berputar elegan */}
            <div className="absolute inset-0 rounded-full border-[2px] border-accent-500 border-r-transparent border-b-transparent animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
            <div className="absolute inset-[6px] rounded-full border-[1.5px] border-accent-300 dark:border-accent-700 border-l-transparent border-t-transparent animate-[spin_2s_cubic-bezier(0.4,0,0.2,1)_infinite_reverse]"></div>

            {/* Logo mark di tengah */}
            <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-accent-500 to-accent-600 dark:from-accent-400 dark:to-accent-600 flex items-center justify-center shadow-[0_4px_18px_rgba(var(--color-accent-500),0.4)]">
              <span className="font-heading font-black text-2xl text-white">{initialLoading}</span>
            </div>
          </div>

          {/* Tipografi Bersih */}
          <div className="text-center space-y-1.5 mb-2">
            <h1 className="font-heading text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 tracking-tight">
              {appNameLoading}
            </h1>
            <p className="font-body text-sm font-medium text-slate-400 dark:text-slate-500">
              {isSyncing ? 'Menyinkronkan ekosistem...' : 'Menyiapkan ruang kerjamu...'}
            </p>
          </div>

          {/* Indikator Progress Casual */}
          <div className="mt-6 flex flex-col items-center gap-3 w-full">
            {syncStep && (
              <p className="font-body text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] text-center animate-pulse">
                {syncStep}
              </p>
            )}
            <div className="w-40 h-[3px] bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-accent-400 via-accent-500 to-accent-400 rounded-full loadbar-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Gerbang login PIN (employee asli) ───────────────────────────────
  // Ditaruh SETELAH gate sync di atas (bukan sebelum) -- data lokal & sesi
  // anonim buat sync tetap boleh siap-siap di background, cuma render UI
  // aplikasinya yang ditahan sampai ada employee asli yang login.
  if (currentEmployee === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (currentEmployee === null) {
    return <LoginView onLogin={handleManualEmployeeLogin} />;
  }

  return (
    <AppContext.Provider value={contextValue}>

      <UpdatePrompt />

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
      `
      }} />

      <AppLayout
        isSidebarOpen={isSidebarOpen}
        onSwipeOpen={() => setIsSidebarOpen(true)}
        onSwipeClose={() => setIsSidebarOpen(false)}
        sidebar={
          <Sidebar
            currentView={currentView}
            setCurrentView={setCurrentView}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            visibleMenus={visibleMenus}
            isAdminMode={isAdminMode}
            setShowPinModal={setShowPinModal}
            triggerConfirm={triggerConfirm}
            setIsAdminMode={setIsAdminMode}
          />
        }
        header={
          <Header
            currentView={currentView}
            currentShift={currentShift}
            setIsSidebarOpen={setIsSidebarOpen}
            today={today}
            salesHistory={salesHistory}
          />
        }
        content={
          <AppRoutes currentView={currentView} />
        }
        bottomNav={
          <BottomNav
            currentView={currentView}
            navigate={navigate}
          />
        }
        overlays={
          <>
            {/* Toast "Ketuk sekali lagi untuk keluar" */}
            {showExitToast && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[200] pointer-events-none exit-toast animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 bg-accent-600/95 dark:bg-accent-500/95 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl backdrop-blur-sm border border-white/20 dark:border-orange-400/30 whitespace-nowrap">
                  <span>Ketuk sekali lagi untuk keluar</span>
                </div>
              </div>
            )}

            {/* Badge status koneksi — pojok kanan atas, nempel selama offline */}
            {!isOnline && (
              <div
                className="fixed right-4 z-[190] animate-in fade-in slide-in-from-top-3 duration-300"
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
              >
                <div className="flex items-center gap-1.5 bg-slate-800/95 dark:bg-slate-900/95 text-slate-100 text-[11px] font-semibold pl-2.5 pr-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-white/10 whitespace-nowrap">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                  </span>
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Offline</span>
                </div>
              </div>
            )}

            {/* Toast koneksi online/offline */}
            {connectionToast && (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300"
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
              >
                <div className={`flex items-center gap-2 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl backdrop-blur-sm border whitespace-nowrap
                  ${connectionToast.type === 'offline'
                    ? 'bg-slate-700/95 dark:bg-slate-800/95 border-white/20'
                    : connectionToast.type === 'syncing'
                      ? 'bg-indigo-600/95 border-white/20'
                      : 'bg-emerald-600/95 border-white/20'}`}>
                  {connectionToast.type === 'offline' ? (
                    <WifiOff className="w-4 h-4 shrink-0" />
                  ) : connectionToast.type === 'syncing' ? (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4 shrink-0" />
                  )}
                  <span>{connectionToast.msg}</span>
                </div>
              </div>
            )}

            {/* Overlay backdrop sidebar mobile */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-slate-500/30 dark:bg-slate-800/40 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Alert modal */}
            <Modal
              isOpen={customAlert.isOpen}
              onClose={() => setCustomAlert({ isOpen: false, message: '' })}
              zLevel="top"
              size="sm"
              className="p-6 text-center"
            >
              <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Pemberitahuan</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{customAlert.message}</p>
              <Button
                size="full"
                onClick={() => setCustomAlert({ isOpen: false, message: '' })}
              >
                Tutup
              </Button>
            </Modal>

            {/* Confirm modal */}
            <Modal
              isOpen={confirmModal.isOpen}
              onClose={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}
              closeOnBackdrop={false}
              zLevel="top"
              size="sm"
              className="p-6 text-center"
            >
              <div className="w-12 h-12 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Konfirmasi Tindakan</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}
                >
                  Batal
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                    setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                  }}
                >
                  Ya
                </Button>
              </div>
            </Modal>

            {/* PIN Modal */}
            <PinModal
              isOpen={showPinModal}
              onClose={() => setShowPinModal(false)}
              onSuccess={() => {
                setIsAdminMode(true);
                setShowPinModal(false);
              }}
              triggerAlert={triggerAlert}
            />

            <ReceiptModal />
          </>
        }
      />

    </AppContext.Provider>
  );
}