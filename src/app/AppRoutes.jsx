import { lazy, Suspense } from 'react';

const HomeView        = lazy(() => import('../features/home/HomeView'));
const ShiftView       = lazy(() => import('../features/finance/ShiftView'));
const PosView         = lazy(() => import('../features/pos/PosView'));
const HistoryView     = lazy(() => import('../features/reports/HistoryView'));
const MenuManagement  = lazy(() => import('../features/menu/MenuMgmt'));
const VariantManagement = lazy(() => import('../features/menu/VariantMgmt'));
const HppView         = lazy(() => import('../features/hpp/HppView'));
const IncomeView      = lazy(() => import('../features/finance/IncomeView'));
const ExpenseView     = lazy(() => import('../features/finance/ExpenseView'));
const CustomerView    = lazy(() => import('../features/customer/CustomerView'));
const ReportsView     = lazy(() => import('../features/reports/ReportsView'));
const EmployeesView   = lazy(() => import('../features/hrd/EmployeesView'));
const SettingsView    = lazy(() => import('../features/settings/SettingsView'));
const BackupView      = lazy(() => import('../features/settings/BackupView'));
const StockView       = lazy(() => import('../features/stock/StockView'));
const AccountView     = lazy(() => import('../auth/AccountView'));

const VIEWS = {
    beranda:    HomeView,
    dompet:     ShiftView,
    kasir:      PosView,
    riwayat:    HistoryView,
    menu:       MenuManagement,
    varian:     VariantManagement,
    hpp:        HppView,
    pemasukan:  IncomeView,
    pengeluaran: ExpenseView,
    pelanggan:  CustomerView,
    laporan:    ReportsView,
    karyawan:   EmployeesView,
    pengaturan: SettingsView,
    backup:     BackupView,
    stok:       StockView,
    akun:       AccountView,
};

export default function AppRoutes({ currentView }) {
    const ActiveView = VIEWS[currentView];

    if (!ActiveView) {
        return <div>View tidak ditemukan</div>;
    }

    return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400">Memuat...</div>}>
            <ActiveView />
        </Suspense>
    );
}