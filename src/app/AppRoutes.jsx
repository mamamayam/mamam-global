import HomeView from '../features/home/HomeView';
import ShiftView from '../features/finance/ShiftView';
import PosView from '../features/pos/PosView';
import HistoryView from '../features/reports/HistoryView';
import MenuManagement from '../features/menu/MenuMgmt';
import VariantManagement from '../features/menu/VariantMgmt';
import HppView from '../features/hpp/HppView';
import IncomeView from '../features/finance/IncomeView';
import ExpenseView from '../features/finance/ExpenseView';
import CustomerView from '../features/customer/CustomerView';
import ReportsView from '../features/reports/ReportsView';
import EmployeesView from '../features/hrd/EmployeesView';
import SettingsView from '../features/settings/SettingsView';
import StockView from '../features/stock/StockView';
import AccountView from '../auth/AccountView';

const VIEWS = {
    beranda: HomeView,
    dompet: ShiftView,
    kasir: PosView,
    riwayat: HistoryView,
    menu: MenuManagement,
    varian: VariantManagement,
    hpp: HppView,
    pemasukan: IncomeView,
    pengeluaran: ExpenseView,
    pelanggan: CustomerView,
    laporan: ReportsView,
    karyawan: EmployeesView,
    pengaturan: SettingsView,
    stok: StockView,
    akun: AccountView,
};

export default function AppRoutes({ currentView }) {
    const ActiveView = VIEWS[currentView];

    if (!ActiveView) {
        return <div>View tidak ditemukan</div>;
    }

    return <ActiveView />;
}