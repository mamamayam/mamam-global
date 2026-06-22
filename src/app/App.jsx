import React, { useState, useMemo, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { usePersistState } from '../hook/usePersistState';
import { INITIAL_MENUS, INITIAL_VARIANT_GROUPS, INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from '../data/initialData';
import { AppContext, useAppContext } from '../context/AppContext';
import { Modal, Button } from '../components/ui';
import PinModal from '../auth/PinModal';
import AppRoutes from '../app/AppRoutes';
import AppLayout from '../app/AppLayout';
import Sidebar from '../app/layout/Sidebar';
import Header from '../app/layout/Header';
import BottomNav from '../app/layout/BottomNav';
import ReceiptModal from '../features/pos/ReceiptModal';

import {
  AlertCircle,
  Briefcase,
  Calculator,
  Calendar,
  CheckCircle2,
  TrendingDown,
  Clock,
  Coffee,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  FileText,
  Fingerprint,
  History,
  Home,
  Info,
  Layers,
  List,
  Menu as MenuIcon,
  Minus,
  MoreHorizontal,
  Motorbike,
  Package,
  Pencil,
  PieChart,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingCart,
  SplitSquareHorizontal,
  Store,
  Ticket,
  Trash2,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  Warehouse,
  BarChart3,
} from 'lucide-react';







export default function App() {


  // --- BACK NAVIGATION ---
  const [viewHistory, setViewHistory] = useState([]);
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef(null);
  const exitToastTimerRef = useRef(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);


  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const handleAdminLogin = () => {
    setIsAdminMode(true);
  };

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
  const syncReadyRef = useRef(null); // Promise resolve untuk unblock push
  const cleanupRef = useRef(null);   // unsubscribe realtime

  // --- DATABASE STATES ---
  // usePersistState sekarang menerima syncReadyPromise supaya push hanya
  // bisa berjalan setelah initial pull dari Supabase selesai (step 1-4).
  const syncReadyPromise = useRef(new Promise(r => { syncReadyRef.current = r; })).current;

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

  // --- KEUANGAN ---
  const [expenseCategories, setExpenseCategories, l9, setExpenseCategoriesRemote] = usePersistState('expenseCategories', ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain'], { syncMode: 'config', syncReadyPromise });
  const [expenses, setExpenses, l10, setExpensesRemote] = usePersistState('expenses', [], { syncMode: 'transaction', syncReadyPromise });
  const [incomeCategories, setIncomeCategories, l11, setIncomeCategoriesRemote] = usePersistState('incomeCategories', ['Modal Tambahan', 'Pendapatan Lain', 'Titipan Uang'], { syncMode: 'config', syncReadyPromise });
  const [incomes, setIncomes, l12, setIncomesRemote] = usePersistState('incomes', [], { syncMode: 'transaction', syncReadyPromise });

  // --- SHIFT ---
  const [currentShift, setCurrentShift, l13, setCurrentShiftRemote] = usePersistState('currentShift', null, { syncMode: 'config', pushDelay: 0, syncReadyPromise });
  const [shiftHistory, setShiftHistory, l14, setShiftHistoryRemote] = usePersistState('shiftHistory', [], { syncMode: 'transaction', syncReadyPromise });

  // --- PELANGGAN ----
  const [customers, setCustomers, l15, setCustomersRemote] = usePersistState('customers', [], { syncMode: 'config', syncReadyPromise });
  const [vouchers, setVouchers, l16, setVouchersRemote] = usePersistState('vouchers', [], { syncMode: 'config', syncReadyPromise });
  const [claimsHistory, setClaimsHistory, l17, setClaimsHistoryRemote] = usePersistState('claimsHistory', [], { syncMode: 'transaction', syncReadyPromise });

  // --- PAYROLL STATES ---
  const [employees, setEmployees, l18, setEmployeesRemote] = usePersistState('employees', [], { syncMode: 'config', syncReadyPromise });
  const [employeeDailyRecords, setEmployeeDailyRecords, l19, setEmployeeDailyRecordsRemote] = usePersistState('employeeDailyRecords', [], { syncMode: 'transaction', syncReadyPromise });
  const [attendanceLog, setAttendanceLog, l24, setAttendanceLogRemote] = usePersistState('attendanceLog', [], { syncMode: 'transaction', syncReadyPromise });
  const [additionCategories, setAdditionCategories, l20, setAdditionCategoriesRemote] = usePersistState('additionCategories', ['Ongkir', 'Lembur', 'Bonus', 'Potongin Ayam'], { syncMode: 'config', syncReadyPromise });
  const [deductionCategories, setDeductionCategories, l21, setDeductionCategoriesRemote] = usePersistState('deductionCategories', ['Kasbon', 'Denda', 'Ganti Rugi'], { syncMode: 'config', syncReadyPromise });

  // --- SETTINGS ---
  const [storeSettings, setStoreSettings, l22, setStoreSettingsRemote] = usePersistState('storeSettings', {
    autoPrint: false, paperSize: '58mm', printLogo: true, taxRate: 0, serviceCharge: 0
  }, { syncMode: 'config', syncReadyPromise });

  const [theme, setTheme, l23] = usePersistState('theme', 'light');

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
  const allDataLoaded = ![l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21, l22, l24].some(Boolean);

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
      syncReadyRef.current?.();
      setSyncStatus('error');
      setSyncStep('');
    }, 15000);

    (async () => {
      // Dynamic import agar tidak error saat modul tidak tersedia
      let isSupabaseConfigured, initRealtimeSync;
      try {
        ({ isSupabaseConfigured } = await import('../storage/syncClient'));
        ({ initRealtimeSync } = await import('../storage/realtimeSync'));
      } catch (e) {
        syncReadyRef.current?.();
        return;
      }

      // Jika Supabase tidak dikonfigurasi, langsung resolve supaya push tidak diblok
      if (!isSupabaseConfigured()) {
        syncReadyRef.current?.();
        return;
      }

      if (cancelled) return;

      // syncStatus sudah 'syncing' dari initial state — tidak perlu set ulang
      setSyncStep('Mengambil data dari server...');

      const { unsubscribe, syncReadyPromise: enginePromise } = initRealtimeSync({
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
        syncReadyRef.current?.();
        setSyncStatus('ready');
        setSyncStep('');
        console.log('[App] Sinkronisasi awal selesai ✅ — push diizinkan');
      }).catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.warn('[App] Sync awal gagal, masuk dengan data lokal:', err?.message);
        syncReadyRef.current?.();
        setSyncStatus('error');
        setSyncStep('');
      });

      // Simpan unsubscribe ke ref agar bisa dipanggil saat cleanup
      cleanupRef.current = unsubscribe;
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDataLoaded]);

  // --- STATES APLIKASI ---
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherInputCode, setVoucherInputCode] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [manualDiscount, setManualDiscount] = useState({ type: 'fixed', value: 0 });
  const [isCustomerDropdownMode, setIsCustomerDropdownMode] = useState(false);

  const getBulanIniStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).toISOString().split('T')[0];
  };
  const [reportDateRange, setReportDateRange] = useState({ start: getBulanIniStart(), end: new Date().toISOString().split('T')[0] });
  const [activePreset, setActivePreset] = useState('bulan_ini');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [selectedMenuForVariant, setSelectedMenuForVariant] = useState(null);
  const [variantSelectedOptions, setVariantSelectedOptions] = useState({});

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [paymentModal, setPaymentModal] = useState({ isOpen: false, isSplitMode: false, splitPayments: [], method: 'Tunai', amountPaid: '', status: 'pending', ojolName: '', orderNumber: '' });
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, data: null });
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

  const [payslipModal, setPayslipModal] = useState({ isOpen: false, data: null, month: '' });

  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Takeaway');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customDeliveryFee, setCustomDeliveryFee] = useState('');

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

  const activeCustomer = useMemo(() => {
    if (!customerName) return null;
    return customers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
  }, [customerName, customers]);

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

  const addToCart = (menu, selectedOptions = {}) => {
    let extraPriceTotal = 0, variantNames = [], selectedVariantDetails = [];

    Object.entries(selectedOptions).forEach(([groupId, optionIds]) => {
      const group = variantGroups.find(g => g.id === groupId);
      if (group) {
        optionIds.forEach(optId => {
          const opt = group.options.find(o => o.id === optId);
          if (opt) { extraPriceTotal += opt.extraPrice; variantNames.push(opt.name); selectedVariantDetails.push({ groupId, optionId: opt.id, name: opt.name, price: opt.extraPrice }); }
        });
      }
    });

    const price = menu.price + extraPriceTotal;
    const variantNameStr = variantNames.join(', ');
    const optionKeys = selectedVariantDetails.map(v => v.optionId).sort().join('-');
    const cartItemId = optionKeys ? `${menu.id}-${optionKeys}` : menu.id;

    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    if (existingItem) setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: item.qty + 1 } : item));
    else setCart([...cart, { cartItemId, menuId: menu.id, name: menu.name, variantName: variantNameStr, price, qty: 1, hpp: menu.hpp, note: '' }]);
    setSelectedMenuForVariant(null);
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
    setAppliedVoucher(null);
    setPointsToRedeem(0);
    setManualDiscount({ type: 'fixed', value: 0 });
    setIsCartOpen(false);
  };

  const loadSavedBill = (bill) => {
    setCart(bill.cart); setCustomerName(bill.customerName); setOrderType(bill.orderType);
    setSavedBills(savedBills.filter(b => b.id !== bill.id));
    triggerAlert('Bill berhasil dimuat!');
  };

  const printReceipt = () => window.print();

  // LIVE MATERIALS POOL (RAW + PREP)
  const availableMaterials = useMemo(() => {
    const prepsAsMaterials = semiFinished.map(prep => {
      // 1. Hitung total biaya bahan mentah yang masuk ke Prep berdasarkan harga pasar live
      const totalIngCost = prep.ingredients.reduce((sum, ing) => {
        const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
        const currentPrice = rm ? rm.price : (ing.snapshotPrice || 0);
        return sum + (currentPrice * ing.qtyUsedFraction);
      }, 0);

      // 2. Tambahkan cost labor & overhead dari Prep
      const totalBatchCost = totalIngCost + (Number(prep.laborCost) || 0) + (Number(prep.overheadCost) || 0);

      // 3. Bagi dengan yield untuk dapat Harga per Satuan
      const costPerUnit = totalBatchCost / Math.max(1, Number(prep.yieldQty) || 1);

      return {
        id: prep.id,
        name: `${prep.name} [Prep]`, // Kasih penanda
        unit: prep.resultUnit,
        price: costPerUnit,
        isPrep: true,
        lastUpdated: prep.lastUpdated || new Date()
      };
    });

    return [...rawMaterials, ...prepsAsMaterials];
  }, [rawMaterials, semiFinished]);

  // Membungkus semua props di Context Value
  const contextValue = {

    // POS / Cart
    getRoundedTotal,
    getRoundingAdjustment,
    isAdminMode,
    cart, setCart,
    addToCart,
    updateCartQty,
    updateCartItemNote,
    isCartOpen, setIsCartOpen,
    menus, setMenus,
    selectedMenuForVariant, setSelectedMenuForVariant,
    variantGroups, setVariantGroups,
    variantSelectedOptions, setVariantSelectedOptions,
    isSidebarOpen,

    vouchers, setVouchers,
    savedBills, setSavedBills,
    storeSettings, setStoreSettings,
    theme, setTheme,

    // Payment / Discount
    appliedVoucher, setAppliedVoucher,
    manualDiscount, setManualDiscount,
    voucherInputCode, setVoucherInputCode,
    getDiscount,
    getManualDiscountAmount,
    getPointDiscount,

    // Order / Checkout
    customerName, setCustomerName,
    orderType, setOrderType,
    deliveryFee, setDeliveryFee,
    customDeliveryFee, setCustomDeliveryFee,

    // Customer
    activeCustomer,
    customers, setCustomers,
    isCustomerDropdownMode, setIsCustomerDropdownMode,
    pointsToRedeem, setPointsToRedeem,

    // Employee / Payroll
    employees, setEmployees,
    employeeDailyRecords, setEmployeeDailyRecords,
    attendanceLog, setAttendanceLog,
    additionCategories, setAdditionCategories,
    deductionCategories, setDeductionCategories,
    payslipModal, setPayslipModal,

    // Inventory / HPP / Materials
    availableMaterials,
    editingRecipe, setEditingRecipe,
    hppLibrary, setHppLibrary,
    rawMaterials, setRawMaterials,
    semiFinished, setSemiFinished,

    // Categories
    categories, setCategories,
    expenseCategories, setExpenseCategories,
    incomeCategories, setIncomeCategories,
    selectedCategory, setSelectedCategory,

    // Finance / History / Report
    claimsHistory, setClaimsHistory,
    expenses, setExpenses,
    incomes, setIncomes,
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

    paymentModal, setPaymentModal,
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
  };

  const menuItems = [

    { id: 'dompet', icon: Clock, label: 'Dompet Kasir' },
    { id: 'absensi', icon: Fingerprint, label: 'Absensi Karyawan' },
    { id: 'kasir', icon: ShoppingCart, label: 'Kasir Utama' },
    { id: 'riwayat', icon: History, label: 'Riwayat Pesanan' },
    { id: 'pemasukan', icon: TrendingUp, label: 'Pemasukan' },
    { id: 'pengeluaran', icon: TrendingDown, label: 'Pengeluaran' },
    { id: 'laporan', icon: BarChart3, label: 'Laporan & Profit' },
    { id: 'karyawan', icon: Briefcase, label: 'Manajemen Pegawai' },
    { id: 'menu', icon: List, label: 'Manajemen Menu' },
    { id: 'varian', icon: Layers, label: 'Manajemen Varian' },
    { id: 'hpp', icon: Calculator, label: 'Manajemen HPP' },
    { id: 'pelanggan', icon: Users, label: 'Pelanggan & Voucher' },
    { id: 'pengaturan', icon: Settings, label: 'Pengaturan Sistem' },
    { id: 'backup', icon: Download, label: 'Backup & Restore' },
    { id: 'stok', icon: Warehouse, label: 'Stok Opname' },
    { id: 'akun', icon: UserCog, label: 'Manajemen Akun' },

  ];

  const visibleMenus = isAdminMode
    ? menuItems
    : menuItems.filter(item =>
      ['dompet', 'absensi', 'riwayat', 'pengeluaran', 'pemasukan', 'menu', 'varian', 'backup'].includes(item.id)
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
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[9999] gap-4 p-8">
        <style dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500&display=swap');
          .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body    { font-family: 'Inter', sans-serif; }
          @keyframes spin-slow { to { transform: rotate(360deg); } }
          .spin-slow { animation: spin-slow 1.4s linear infinite; }
          @keyframes pulse-dot { 0%,100% { opacity:.3 } 50% { opacity:1 } }
          .dot1 { animation: pulse-dot 1.2s ease-in-out infinite; }
          .dot2 { animation: pulse-dot 1.2s ease-in-out .2s infinite; }
          .dot3 { animation: pulse-dot 1.2s ease-in-out .4s infinite; }
        `
        }} />

        {/* Logo / ikon app */}
        <div className="w-16 h-16 rounded-3xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l19-9-9 19-2-8-8-2z" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="font-heading font-extrabold text-2xl text-slate-900">Mamam Kasir</h1>
          <p className="font-body text-sm text-slate-400 mt-1">
            {isSyncing ? 'Sinkronisasi data...' : 'Memuat data lokal...'}
          </p>
        </div>

        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="spin-slow absolute inset-0 rounded-full border-4 border-orange-100 border-t-orange-500" />
        </div>

        {/* Step label */}
        {syncStep ? (
          <p className="font-body text-xs text-slate-500 text-center max-w-[240px] leading-relaxed">
            {syncStep}
          </p>
        ) : null}

        {/* Titik animasi */}
        <div className="flex gap-1.5 mt-1">
          <span className="dot1 w-2 h-2 rounded-full bg-orange-400 inline-block" />
          <span className="dot2 w-2 h-2 rounded-full bg-orange-400 inline-block" />
          <span className="dot3 w-2 h-2 rounded-full bg-orange-400 inline-block" />
        </div>

        {/* Info hemat kuota */}
        {isSyncing && (
          <p className="font-body text-[11px] text-slate-300 text-center mt-2 max-w-[240px]">
            Mengambil data terbaru dari server.<br />Push akan aktif setelah sinkronisasi selesai.
          </p>
        )}
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>

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
                <div className="flex items-center gap-2 bg-orange-600/95 dark:bg-orange-500/95 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl backdrop-blur-sm border border-white/20 dark:border-orange-400/30 whitespace-nowrap">
                  <span>Ketuk sekali lagi untuk keluar</span>
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
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
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


/**
 * Badge kecil di pojok kanan bawah layar.
 * - Tidak muncul jika Supabase tidak dikonfigurasi (status 'idle')
 * - Muncul sebentar saat 'ready' lalu fade out
 * - Tetap muncul merah saat 'error'
 */
function SyncStatusBadge({ status }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'ready') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
    if (status === 'error') {
      setVisible(true);
    }
  }, [status]);

  if (status === 'idle' || !visible) return null;

  const cfg = status === 'ready'
    ? { bg: 'bg-emerald-500', text: 'Tersinkronisasi ✓' }
    : { bg: 'bg-red-500', text: 'Sync gagal — data lokal' };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full text-white text-xs font-medium shadow-lg transition-opacity duration-500 ${cfg.bg}`}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {cfg.text}
    </div>
  );
}