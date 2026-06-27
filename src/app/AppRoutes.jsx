import { lazy, Suspense, Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui';

const HomeView          = lazy(() => import('../features/home/HomeView'));
const ShiftView         = lazy(() => import('../features/finance/ShiftView'));
const PosView           = lazy(() => import('../features/pos/PosView'));
const HistoryView       = lazy(() => import('../features/reports/HistoryView'));
const MenuManagement    = lazy(() => import('../features/menu/MenuMgmt'));
const VariantManagement = lazy(() => import('../features/menu/VariantMgmt'));
const HppView           = lazy(() => import('../features/hpp/HppView'));
const IncomeView        = lazy(() => import('../features/finance/IncomeView'));
const ExpenseView       = lazy(() => import('../features/finance/ExpenseView'));
const CustomerView      = lazy(() => import('../features/customer/CustomerView'));
const ReportsView       = lazy(() => import('../features/reports/ReportsView'));
const EmployeesView     = lazy(() => import('../features/hrd/EmployeesView'));
const Attendance        = lazy(() => import('../features/hrd/AttendanceView'));
const SettingsView      = lazy(() => import('../features/settings/SettingsView'));
const BackupView        = lazy(() => import('../storage/BackupView'));
const StockView         = lazy(() => import('../features/stock/StockView'));
const AccountView       = lazy(() => import('../auth/AccountView'));

const VIEWS = {
    beranda:     HomeView,
    dompet:      ShiftView,
    kasir:       PosView,
    riwayat:     HistoryView,
    menu:        MenuManagement,
    varian:      VariantManagement,
    hpp:         HppView,
    pemasukan:   IncomeView,
    pengeluaran: ExpenseView,
    pelanggan:   CustomerView,
    laporan:     ReportsView,
    karyawan:    EmployeesView,
    absensi:     Attendance,
    pengaturan:  SettingsView,
    backup:      BackupView,
    stok:        StockView,
    akun:        AccountView,
};

// --- Error Boundary (harus class component, React belum support hooks untuk ini) ---
class ViewErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Fitur crash:', error, info);
    }

    // Reset error saat berpindah halaman
    componentDidUpdate(prevProps) {
        if (prevProps.viewKey !== this.props.viewKey && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                    <div className="w-16 h-16 bg-accent-50 dark:bg-accent-500/10 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-accent-500 dark:text-accent-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">Halaman ini mengalami error</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Data kamu aman, hanya tampilan ini yang bermasalah.</p>
                        {this.state.error && (
                            <p className="text-xs text-accent-400 dark:text-accent-400 font-mono bg-accent-50 dark:bg-accent-500/10 rounded px-3 py-1 mt-2 max-w-xs mx-auto break-all">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <Button onClick={this.handleRetry} icon={<RefreshCw className="w-4 h-4" />}>
                        Coba Lagi
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

// --- Loading Skeleton ---
function ViewSkeleton() {
    return (
        <div className="flex-1 flex flex-col p-4 gap-4 animate-pulse">
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-3/4" />
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
            <div className="grid grid-cols-2 gap-4 mt-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

// --- Main AppRoutes ---
export default function AppRoutes({ currentView }) {
    const ActiveView = VIEWS[currentView];

    if (!ActiveView) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
                Halaman tidak ditemukan: <code className="ml-1 text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{currentView}</code>
            </div>
        );
    }

    return (
        <ViewErrorBoundary viewKey={currentView}>
            <Suspense fallback={<ViewSkeleton />}>
                <ActiveView />
            </Suspense>
        </ViewErrorBoundary>
    );
}