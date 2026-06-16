import React, { useState, useMemo, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { usePersistState } from '../hook/usePersistState';
import { initRealtimeSync } from '../storage/realtimeSync';
import { reviveDates as reviveDatesForKey } from '../storage/db';
import { INITIAL_MENUS, INITIAL_VARIANT_GROUPS, INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from '../data/initialData';
import { toLocalDateString } from '../utils/formatters';
import { AppContext, useAppContext } from '../context/AppContext';
import PinModal from '../auth/PinModal';
import AppRoutes from '../app/AppRoutes';
import AppLayout from '../app/AppLayout';
import Sidebar from '../app/layout/Sidebar';
import Header from '../app/layout/Header';
import BottomNav from '../app/layout/BottomNav';
import ReceiptModal from '../features/pos/modals/ReceiptModal';

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
  History,
  Home,
  Info,
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
} from 'lucide-react';







export default function App() {


  // --- BACK NAVIGATION ---
  const [viewHistory, setViewHistory]     = useState([]);
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef  = useRef(null);
  const exitToastTimerRef = useRef(null);


  const { isAdminMode, setIsAdminMode } = useAppContext();
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

  // --- SYNC READY REF ---
  // Promise ini di-resolve setelah initial pull Supabase selesai.
  // Semua usePersistState dengan syncMode menerima ref ini supaya push
  // tidak jalan sebelum data dari Supabase selesai di-merge ke lokal.
  const syncReadyRef = useRef(Promise.resolve());

  // --- DATABASE STATES ---
  const [variantGroups, setVariantGroups, l1, setVariantGroupsRemote] = usePersistState('variantGroups', INITIAL_VARIANT_GROUPS, { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [variantCategories, setVariantCategories, l24, setVariantCategoriesRemote] = usePersistState('variantCategories', ['Topping', 'Level Pedas', 'Ukuran'], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [menus, setMenus, l2, setMenusRemote] = usePersistState('menus', INITIAL_MENUS, { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [salesHistory, setSalesHistory, l3, setSalesHistoryRemote] = usePersistState('salesHistory', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });
  const [hppLibrary, setHppLibrary, l4, setHppLibraryRemote] = usePersistState('hppLibrary', [], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [savedBills, setSavedBills, l5, setSavedBillsRemote] = usePersistState('savedBills', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });

  // --- HPP & BAHAN BAKU ---
  const [rawMaterials, setRawMaterials, l6, setRawMaterialsRemote] = usePersistState('rawMaterials', INITIAL_RAW_MATERIALS, { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [semiFinished, setSemiFinished, l7, setSemiFinishedRemote] = usePersistState('semiFinished', [], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [categories, setCategories, l8, setCategoriesRemote] = usePersistState('categories', INITIAL_CATEGORIES, { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [editingRecipe, setEditingRecipe] = useState(null);

  // --- KEUANGAN ---
  const [expenseCategories, setExpenseCategories, l9, setExpenseCategoriesRemote] = usePersistState('expenseCategories', ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain'], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [expenses, setExpenses, l10, setExpensesRemote] = usePersistState('expenses', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });
  const [incomeCategories, setIncomeCategories, l11, setIncomeCategoriesRemote] = usePersistState('incomeCategories', ['Modal Tambahan', 'Pendapatan Lain', 'Titipan Uang'], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [incomes, setIncomes, l12, setIncomesRemote] = usePersistState('incomes', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });

  // --- SHIFT ---
  const [currentShift, setCurrentShift, l13, setCurrentShiftRemote] = usePersistState('currentShift', null, { syncMode: 'config', syncReadyPromise: syncReadyRef.current, pushDelay: 0 }); // pushDelay:0 = langsung push tanpa debounce, kritis untuk tutup shift
  const [shiftHistory, setShiftHistory, l14, setShiftHistoryRemote] = usePersistState('shiftHistory', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });

  // --- PELANGGAN ----
  const [customers, setCustomers, l15, setCustomersRemote] = usePersistState('customers', [
    { id: 'c1', name: 'Budi Santoso', phone: '08123456789', points: 120 },
    { id: 'c2', name: 'Siti Rahma', phone: '08571234567', points: 250 },
    { id: 'c3', name: 'Andi Wijaya', phone: '08998765432', points: 45 }
  ], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [vouchers, setVouchers, l16, setVouchersRemote] = usePersistState('vouchers', [
    { id: 'v1', code: 'MAMAMKENYANG', discountType: 'fixed', discountValue: 5000, minPurchase: 30000 }
  ], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [claimsHistory, setClaimsHistory, l17, setClaimsHistoryRemote] = usePersistState('claimsHistory', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });

  // --- PAYROLL STATES ---
  const [employees, setEmployees, l18, setEmployeesRemote] = usePersistState('employees', [
    { id: 'EMP-001', name: 'Budi Pekerja', phone: '0812345678', address: 'Jl. Melati', hourlyRate: 15000, startDate: '2023-01-10' }
  ], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [employeeDailyRecords, setEmployeeDailyRecords, l19, setEmployeeDailyRecordsRemote] = usePersistState('employeeDailyRecords', [], { syncMode: 'transaction', syncReadyPromise: syncReadyRef.current });
  const [additionCategories, setAdditionCategories, l20, setAdditionCategoriesRemote] = usePersistState('additionCategories', ['Ongkir', 'Lembur', 'Bonus', 'Potongin Ayam'], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });
  const [deductionCategories, setDeductionCategories, l21, setDeductionCategoriesRemote] = usePersistState('deductionCategories', ['Kasbon', 'Denda', 'Ganti Rugi'], { syncMode: 'config', syncReadyPromise: syncReadyRef.current });


  // --- SETTINGS ---
  const [storeSettings, setStoreSettings, l22, setStoreSettingsRemote] = usePersistState('storeSettings', {
    autoPrint: false, paperSize: '58mm', printLogo: true, taxRate: 0, serviceCharge: 0
  }, { syncMode: 'config', syncReadyPromise: syncReadyRef.current });

  // --- TEMA (LIGHT / DARK) — preferensi per-device, tidak disinkron ke device lain
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
  const allDataLoaded = ![l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21, l22, l23, l24].some(Boolean);

  // ── REALTIME SYNC (Supabase) ────────────────────────────────────────────
  // Push per-record sudah dihandle otomatis oleh usePersistState (syncMode).
  // Di sini kita hanya tangani arah sebaliknya: terima perubahan dari device
  // lain (realtime) dan terapkan ke state lokal supaya UI langsung update.
  // Pakai setter *Remote* supaya update yang datang dari Supabase (device lain)
  // tidak di-push balik ke Supabase → mencegah loop & konflik data.
  const transactionSetters = useRef({});
  transactionSetters.current = {
    salesHistory: setSalesHistoryRemote,
    expenses: setExpensesRemote,
    incomes: setIncomesRemote,
    shiftHistory: setShiftHistoryRemote,
    employeeDailyRecords: setEmployeeDailyRecordsRemote,
    claimsHistory: setClaimsHistoryRemote,
    savedBills: setSavedBillsRemote,
  };

  const configSetters = useRef({});
  configSetters.current = {
    menus: setMenusRemote,
    variantGroups: setVariantGroupsRemote,
    variantCategories: setVariantCategoriesRemote,
    categories: setCategoriesRemote,
    hppLibrary: setHppLibraryRemote,
    customers: setCustomersRemote,
    vouchers: setVouchersRemote,
    employees: setEmployeesRemote,
    expenseCategories: setExpenseCategoriesRemote,
    incomeCategories: setIncomeCategoriesRemote,
    additionCategories: setAdditionCategoriesRemote,
    deductionCategories: setDeductionCategoriesRemote,
    rawMaterials: setRawMaterialsRemote,
    semiFinished: setSemiFinishedRemote,
    storeSettings: setStoreSettingsRemote,
    currentShift: setCurrentShiftRemote,
  };

  useEffect(() => {
    if (!allDataLoaded) return;

    // initRealtimeSync sekarang return { unsubscribe, syncReadyPromise }
    const { unsubscribe, syncReadyPromise } = initRealtimeSync({
      // item === null -> hasil initial pull (fullArray = array hasil merge, replace state)
      // item !== null -> 1 record baru/berubah dari device lain (realtime), upsert ke array
      onTransactionUpsert: (tableKey, item, fullArray) => {
        const setter = transactionSetters.current[tableKey];
        if (!setter) return;
        if (item === null && fullArray) {
          setter(reviveDatesForKey(tableKey, fullArray));
          return;
        }
        const revived = reviveDatesForKey(tableKey, [item])[0];
        setter(prev => {
          const arr = Array.isArray(prev) ? prev : [];
          const idx = arr.findIndex(p => String(p?.id) === String(revived?.id));
          if (idx === -1) return [...arr, revived];
          const next = [...arr];
          next[idx] = revived;
          return next;
        });
      },
      onTransactionDelete: (tableKey, id) => {
        const setter = transactionSetters.current[tableKey];
        if (!setter) return;
        setter(prev => (Array.isArray(prev) ? prev.filter(p => String(p?.id) !== String(id)) : prev));
      },
      onConfigUpdate: (key, value) => {
        const setter = configSetters.current[key];
        if (!setter) return;
        setter(reviveDatesForKey(key, value));
      },
    });

    // Simpan syncReadyPromise ke ref supaya push dari usePersistState
    // bisa await sampai initial pull benar-benar selesai.
    syncReadyRef.current = syncReadyPromise;

    return unsubscribe;
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
    return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29));
  };
  const [reportDateRange, setReportDateRange] = useState({ start: getBulanIniStart(), end: toLocalDateString() });
  const [activePreset, setActivePreset] = useState('bulan_ini');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Favorit');
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
    const todayStr = toLocalDateString();
    const d = new Date();
    setActivePreset(preset);

    if (preset === 'hari_ini') setReportDateRange({ start: todayStr, end: todayStr });
    else if (preset === 'minggu_ini') setReportDateRange({ start: toLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6)), end: todayStr });
    else if (preset === 'bulan_ini') setReportDateRange({ start: toLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29)), end: todayStr });
    else if (preset === 'bulan_berjalan') setReportDateRange({ start: toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1)), end: todayStr });
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
    variantCategories, setVariantCategories,
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
  };

  const menuItems = [

    { id: 'dompet', icon: Clock, label: 'Dompet Kasir' },
    { id: 'kasir', icon: ShoppingCart, label: 'Kasir Utama' },
    { id: 'riwayat', icon: History, label: 'Riwayat Pesanan' },
    { id: 'pemasukan', icon: TrendingUp, label: 'Pemasukan' },
    { id: 'pengeluaran', icon: TrendingDown, label: 'Pengeluaran' },
    { id: 'laporan', icon: PieChart, label: 'Laporan & Profit' },
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
      ['dompet', 'kasir', 'riwayat', 'pengeluaran', 'pemasukan'].includes(item.id)
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
        // PRIORITAS 3: Tutup modal pilih varian
        else if (selectedMenuForVariant) {
          setSelectedMenuForVariant(null);
        }
        // PRIORITAS 4: Tutup keranjang belanja
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
    selectedMenuForVariant,
    isCartOpen,
    isSidebarOpen,
    navigateBack,
  ]);


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
        @keyframes exitToastIn {
          from { opacity: 0; transform: translate(-50%, 12px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0)    scale(1); }
        }
        .exit-toast { animation: exitToastIn 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `
      }} />

      <AppLayout
      isSidebarOpen={isSidebarOpen}
        onSwipeOpen={() => setIsSidebarOpen(true)}
        onSwipeClose={() => setIsSidebarOpen(false)}
        sidebar={
          <Sidebar
            currentView={currentView}
            navigate={navigate}
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
              <div className="fixed bottom-24 left-1/2 z-[300] pointer-events-none exit-toast">
                <div className="flex items-center gap-2 bg-slate-800/95 dark:bg-slate-700/95 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl backdrop-blur-sm border border-white/10 whitespace-nowrap">
                  <span>👋</span>
                  <span>Ketuk sekali lagi untuk keluar</span>
                </div>
              </div>
            )}

            {/* Overlay backdrop sidebar mobile */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Alert modal */}
            {customAlert.isOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black backdrop-blur-sm transition-opacity duration-300">
                <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
                  <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Pemberitahuan</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{customAlert.message}</p>
                  <button
                    onClick={() => setCustomAlert({ isOpen: false, message: '' })}
                    className="w-full py-3 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {/* Confirm modal */}
            {confirmModal.isOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black backdrop-blur-sm transition-opacity duration-300">
                <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Konfirmasi Tindakan</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => {
                        if (confirmModal.onConfirm) confirmModal.onConfirm();
                        setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                      }}
                      className="flex-1 py-3 bg-red-500 dark:bg-red-600 text-white font-bold rounded-xl hover:bg-red-600 dark:hover:bg-red-500 transition-colors"
                    >
                      Ya
                    </button>
                  </div>
                </div>
              </div>
            )}

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

function Layers(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 12 12 17 22 12"></polyline>
      <polyline points="2 17 12 22 22 17"></polyline>
    </svg>
  );
}