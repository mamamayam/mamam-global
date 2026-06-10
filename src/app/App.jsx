import React, { useState, useMemo, useEffect, createContext, useContext, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { loadData, saveData } from '../storage/localStorage';
import { INITIAL_MENUS, INITIAL_VARIANT_GROUPS, INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from '../data/initialData';
import { AppContext, useAppContext } from '../context/AppContext';
import CartDrawer from '../features/pos/CartDrawer';
import PosView from '../features/pos/PosView';
import HomeView from '../features/home/HomeView';
import CustomerView from '../features/customer/CustomerView';
import AccountView from '../auth/AccountView';
import ExpenseView from '../features/finance/ExpenseView';
import EmployeesView from '../features/hrd/EmployeesView';
import HppView from '../features/hpp/HppView';
import HistoryView from '../features/reports/HistoryView';
import IncomeView from '../features/finance/IncomeView';
import PinModal from '../auth/PinModal';
import ReportsView from '../features/reports/ReportsView';
import SettingsView from '../features/settings/SettingsView';
import ShiftView from '../features/finance/ShiftView';
import ReceiptModal from '../features/pos/modals/ReceiptModal';
import PaymentModal from '../features/pos/modals/PaymentModal';
import PayslipModal from '../features/hrd/modals/PayslipModal';
import MenuManagement from '../features/menu/MenuMgmt';
import VariantManagement from '../features/menu/VariantMgmt';
import VariantSelectionModal from '../features/pos/modals/VariantSelectionModal';

import {
  AlertCircle,
  ArrowDownCircle,
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Clock,
  Coffee,
  Copy,
  CreditCard,
  DollarSign,
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
  X
} from 'lucide-react';







export default function App() {


  const [showExitConfirm, setShowExitConfirm] = useState(false);


  const { isAdminMode, setIsAdminMode } = useAppContext();
  const [showPinModal, setShowPinModal] = useState(false);

  const handleAdminLogin = () => {
    setIsAdminMode(true);
  };

  const [currentView, setCurrentView] = useState('pos');
  const [activeTab, setActiveTab] = useState('materials');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- DATABASE STATES ---
  const [variantGroups, setVariantGroups] = useState(() => loadData('variantGroups', INITIAL_VARIANT_GROUPS));
  const [menus, setMenus] = useState(() => loadData('menus', INITIAL_MENUS));
  const [salesHistory, setSalesHistory] = useState(() => loadData('salesHistory', []));
  const [hppLibrary, setHppLibrary] = useState(() => loadData('hppLibrary', []));
  const [savedBills, setSavedBills] = useState(() => loadData('savedBills', []));

  // --- HPP & BAHAN BAKU ---
  const [rawMaterials, setRawMaterials] = useState(() => loadData('rawMaterials', INITIAL_RAW_MATERIALS));
  const [semiFinished, setSemiFinished] = useState(() => loadData('semiFinished', []));
  const [categories, setCategories] = useState(() => loadData('categories', INITIAL_CATEGORIES));
  const [editingRecipe, setEditingRecipe] = useState(null);

  // --- KEUANGAN ---
  const [expenseCategories, setExpenseCategories] = useState(() => loadData('expenseCategories', ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain']));
  const [expenses, setExpenses] = useState(() => loadData('expenses', []));
  const [incomeCategories, setIncomeCategories] = useState(() => loadData('incomeCategories', ['Modal Tambahan', 'Pendapatan Lain', 'Titipan Uang']));
  const [incomes, setIncomes] = useState(() => loadData('incomes', []));

  // --- SHIFT ---
  const [currentShift, setCurrentShift] = useState(() => loadData('currentShift', null));
  const [shiftHistory, setShiftHistory] = useState(() => loadData('shiftHistory', []));

  // --- PELANGGAN ----
  const [customers, setCustomers] = useState(() => loadData('customers', [
    { id: 'c1', name: 'Budi Santoso', phone: '08123456789', points: 120 },
    { id: 'c2', name: 'Siti Rahma', phone: '08571234567', points: 250 },
    { id: 'c3', name: 'Andi Wijaya', phone: '08998765432', points: 45 }
  ]));
  const [vouchers, setVouchers] = useState(() => loadData('vouchers', [
    { id: 'v1', code: 'MAMAMKENYANG', discountType: 'fixed', discountValue: 5000, minPurchase: 30000 }
  ]));
  const [claimsHistory, setClaimsHistory] = useState(() => loadData('claimsHistory', []));

  // --- PAYROLL STATES ---
  const [employees, setEmployees] = useState(() => loadData('employees', [
    { id: 'EMP-001', name: 'Budi Pekerja', phone: '0812345678', address: 'Jl. Melati', hourlyRate: 15000, startDate: '2023-01-10' }
  ]));
  const [employeeDailyRecords, setEmployeeDailyRecords] = useState(() => loadData('employeeDailyRecords', []));
  const [additionCategories, setAdditionCategories] = useState(() => loadData('additionCategories', ['Ongkir', 'Lembur', 'Bonus', 'Potongin Ayam']));
  const [deductionCategories, setDeductionCategories] = useState(() => loadData('deductionCategories', ['Kasbon', 'Denda', 'Ganti Rugi']));


  // --- SETTINGS ---
  const [storeSettings, setStoreSettings] = useState(() => loadData('storeSettings', {
    autoPrint: false, paperSize: '58mm', printLogo: true, taxRate: 0, serviceCharge: 0
  }));

  // --- SIMPAN PERUBAHAN KE "DATABASE" (localStorage) ---
  useEffect(() => { saveData('variantGroups', variantGroups); }, [variantGroups]);
  useEffect(() => { saveData('menus', menus); }, [menus]);
  useEffect(() => { saveData('salesHistory', salesHistory); }, [salesHistory]);
  useEffect(() => { saveData('hppLibrary', hppLibrary); }, [hppLibrary]);
  useEffect(() => { saveData('savedBills', savedBills); }, [savedBills]);
  useEffect(() => { saveData('expenseCategories', expenseCategories); }, [expenseCategories]);
  useEffect(() => { saveData('expenses', expenses); }, [expenses]);
  useEffect(() => { saveData('incomeCategories', incomeCategories); }, [incomeCategories]);
  useEffect(() => { saveData('incomes', incomes); }, [incomes]);
  useEffect(() => { saveData('currentShift', currentShift); }, [currentShift]);
  useEffect(() => { saveData('shiftHistory', shiftHistory); }, [shiftHistory]);
  useEffect(() => { saveData('customers', customers); }, [customers]);
  useEffect(() => { saveData('vouchers', vouchers); }, [vouchers]);
  useEffect(() => { saveData('claimsHistory', claimsHistory); }, [claimsHistory]);
  useEffect(() => { saveData('storeSettings', storeSettings); }, [storeSettings]);
  useEffect(() => { saveData('rawMaterials', rawMaterials); }, [rawMaterials]);
  useEffect(() => { saveData('semiFinished', semiFinished); }, [semiFinished]);
  useEffect(() => { saveData('categories', categories); }, [categories]);
  useEffect(() => { saveData('employees', employees); }, [employees]);
  useEffect(() => { saveData('employeeDailyRecords', employeeDailyRecords); }, [employeeDailyRecords]);
  useEffect(() => { saveData('additionCategories', additionCategories); }, [additionCategories]);
  useEffect(() => { saveData('deductionCategories', deductionCategories); }, [deductionCategories]);

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
    const bill = { id: `BILL-${Date.now().toString().slice(-4)}`, customerName: customerName || 'Tanpa Nama', cart, orderType, date: new Date() };
    setSavedBills([...savedBills, bill]);
    triggerAlert('Bill disimpan sebagai Open Bill!');
    setCart([]); setCustomerName(''); setAppliedVoucher(null); setPointsToRedeem(0); setManualDiscount({ type: 'fixed', value: 0 }); setIsCartOpen(false);
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
    currentView, setCurrentView,
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

    { id: 'shift', icon: Clock, label: 'Shift Kasir' },
    { id: 'pos', icon: ShoppingCart, label: 'Kasir Utama' },
    { id: 'history', icon: History, label: 'Riwayat Pesanan' },
    { id: 'incomes', icon: TrendingUp, label: 'Pemasukan' },
    { id: 'expenses', icon: TrendingDown, label: 'Pengeluaran' },
    { id: 'reports', icon: PieChart, label: 'Laporan & Profit' },
    { id: 'employees', icon: Briefcase, label: 'Manajemen Pegawai' },
    { id: 'menu-mgt', icon: List, label: 'Manajemen Menu' },
    { id: 'variant-mgt', icon: Layers, label: 'Manajemen Varian' },
    { id: 'hpp-calc', icon: Calculator, label: 'Manajemen HPP' },
    { id: 'customers', icon: Users, label: 'Pelanggan & Voucher' },
    { id: 'settings', icon: Settings, label: 'Pengaturan Sistem' },
    { id: 'account', icon: UserCog, label: 'Manajemen Akun' }
  ];

  const visibleMenus = isAdminMode
    ? menuItems
    : menuItems.filter(item =>
      ['shift', 'pos', 'history', 'expenses', 'incomes'].includes(item.id) // Pastikan 'history' ada di sini
    );


  useEffect(() => {
    // 1. Buat variabel untuk menyimpan handle listener
    let backListenerHandle = null;

    // 2. Buat fungsi async untuk mendaftarkan listener
    const setupListener = async () => {
      backListenerHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // 1. PRIORITAS 1: Tutup Modal Struk (jika sedang terbuka)
        if (receiptModal.isOpen) {
          setReceiptModal({ ...receiptModal, isOpen: false });
        }
        // 2. PRIORITAS 2: Tutup Modal Pembayaran (jika sedang terbuka)
        else if (paymentModal.isOpen) {
          setPaymentModal({ ...paymentModal, isOpen: false });
        }
        // 3. PRIORITAS 3: Batal keluar jika modal exit terbuka
        else if (showExitConfirm) {
          setShowExitConfirm(false);
        }
        // 4. PRIORITAS 4: Tutup keranjang belanja
        else if (isCartOpen) {
          setIsCartOpen(false);
        }
        // 5. PRIORITAS 5: Tutup menu sidebar
        else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
        // 6. Navigasi kembali (jika ada history)
        else if (canGoBack) {
          window.history.back();
        }
        // 7. Jika di halaman paling awal, munculkan konfirmasi exit
        else {
          setShowExitConfirm(true);
        }
      });
    };

    // 3. Panggil fungsi setup
    setupListener();

    // 4. Cleanup function
    return () => {
      // Pastikan handle sudah ada sebelum mencoba menghapusnya
      if (backListenerHandle) {
        backListenerHandle.remove();
      }
    };
  }, [
    receiptModal.isOpen,
    paymentModal.isOpen,
    showExitConfirm,
    isCartOpen,
    isSidebarOpen
  ]);


  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-slate-50 font-body text-slate-800 overflow-hidden w-full relative">
        <style dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'Inter', sans-serif; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
        `}} />

        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
        )}

        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl md:shadow-none border-r border-slate-100 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 bg-orange-600 text-white flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-heading font-black text-xl md:text-2xl tracking-normal md:tracking-wide whitespace-nowrap flex items-center gap-2">
                MAMAM AYAM
              </h2>
              <p className="text-[10px] text-white uppercase tracking-widest mt-1 font-bold">Ecosystem</p>
            </div>
            <button className="md:hidden p-1.5 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors" onClick={() => setIsSidebarOpen(false)}><X className="w-4 h-4" /></button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            {visibleMenus.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold text-sm ${currentView === item.id
                  ? 'bg-slate-100 text-slate-900 shadow-sm translate-x-1'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-1'
                  }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors duration-300 ${currentView === item.id
                    ? 'text-slate-900'
                    : 'text-slate-400'
                    }`}
                />
                {item.label}
              </button>
            ))}

            <div className="p-3 border-t">
              {!isAdminMode ? (
                <button
                  onClick={() => setShowPinModal(true)}
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold"
                >
                  Login Admin
                </button>
              ) : (
                <button
                  onClick={() =>
                    triggerConfirm(
                      'Yakin ingin keluar dari mode admin?',
                      () => setIsAdminMode(false)
                    )
                  }
                  className="w-full bg-red-500 text-white py-3 rounded-xl font-bold"
                >
                  Keluar Admin
                </button>
              )}
            </div>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 relative">
          <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-4 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-100 rounded-lg md:hidden text-slate-600 transition-colors" onClick={() => setIsSidebarOpen(true)}><MenuIcon className="w-6 h-6" /></button>
              <div><h2 className="font-heading font-black text-slate-900 text-xl tracking-tight capitalize">{currentView.replace('-', ' ')}</h2></div>
            </div>
            <div className="flex items-center gap-3">
              {currentShift && <span className="hidden md:inline-block bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100"><Clock className="w-3 h-3 inline-block mr-1 mb-0.5" /> Shift Aktif</span>}
              <div className="flex items-center bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-[10px] md:text-xs font-bold border border-slate-200 whitespace-nowrap">{today}</div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative print:overflow-visible flex flex-col">
            {currentView === 'beranda' && <HomeView />}
            {currentView === 'shift' && <ShiftView />}
            {currentView === 'pos' && <PosView />}
            {currentView === 'history' && <HistoryView />}
            {currentView === 'menu-mgt' && <MenuManagement />}
            {currentView === 'variant-mgt' && <VariantManagement />}
            {currentView === 'hpp-calc' && <HppView />}
            {currentView === 'incomes' && <IncomeView />}
            {currentView === 'expenses' && <ExpenseView />}
            {currentView === 'customers' && <CustomerView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'employees' && <EmployeesView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'account' && <AccountView />}
          </div>

          {/* BOTTOM NAVIGATION BAR (TOMBOL PINTAS) */}
          <div className="bg-white border-t border-slate-200 flex justify-around items-center h-16 shrink-0 z-50 print:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <button
              onClick={() => setCurrentView('beranda')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === 'beranda' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-bold">Beranda</span>
            </button>

            <button
              onClick={() => setCurrentView('pos')} // atau 'beranda'/'kasir' sesuai state-mu
              className="relative flex flex-col items-center justify-end pb-1 h-12 flex-1 group"
            >
              {/* Lingkaran Besar yang Menonjol ke Atas */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-md border-4 border-white transition-all duration-200 group-hover:scale-105 active:scale-95 z-10">
                {/* Ganti dengan Icon Kasir/Keranjang yang kamu gunakan (misal: ShoppingCart atau Store) */}
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>

              {/* Label Teks tetap di bawah, sejajar dengan menu lainnya */}
              <span className={`text-xs font-semibold ${currentView === 'pos' ? 'text-red-500' : 'text-slate-600'}`}>
                Kasir
              </span>
            </button>

            <button
              onClick={() => setCurrentView('settings')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === 'settings' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-bold">Pengaturan</span>
            </button>
          </div>
        </main>

        {customAlert.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><CheckCircle2 className="w-6 h-6" /></div>
              <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">Pemberitahuan</h3>
              <p className="text-slate-500 text-sm mb-6">{customAlert.message}</p>
              <button onClick={() => setCustomAlert({ isOpen: false, message: '' })} className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors">Tutup</button>
            </div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><AlertCircle className="w-6 h-6" /></div>
              <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">Konfirmasi Tindakan</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Batal</button>
                <button onClick={() => { if (confirmModal.onConfirm) confirmModal.onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">Ya</button>
              </div>
            </div>
          </div>
        )}

        {/* Global Modals */}
        <CartDrawer />
        <VariantSelectionModal />
        <PaymentModal />
        <ReceiptModal />
        <PayslipModal />

        <PinModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setIsAdminMode(true);
            setShowPinModal(false);
          }}
          triggerAlert={triggerAlert}
        />

      </div>
    </AppContext.Provider >
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