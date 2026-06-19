import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { History, Trash2, Receipt, Search, Calendar, ChevronRight, Filter } from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';
import { PageHeader, Card, Button } from '../../components/ui';

const HistoryView = () => {
    const { salesHistory, setSalesHistory, isAdminMode, setReceiptModal, triggerConfirm } = useAppContext();

    // State Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('semua');
    const [orderTypeFilter, setOrderTypeFilter] = useState('semua'); // State baru untuk Tipe Order

    // State khusus untuk rentang tanggal kustom
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Daftar opsi tab periode tanggal
    const filterTabs = [
        { id: 'semua', label: 'Semua Waktu' },
        { id: 'hari-ini', label: 'Hari Ini' },
        { id: '7-hari', label: '7 Hari' },
        { id: '30-hari', label: '30 Hari' },
        { id: 'bulan-berjalan', label: 'Bulan Ini' },
        { id: 'kustom', label: 'Pilih Tanggal' }
    ];

    // Mengambil daftar tipe order unik dari data riwayat untuk dropdown
    const uniqueOrderTypes = [...new Set(salesHistory.map(order => order.orderType).filter(Boolean))];

    // Fungsi mengecek apakah tanggal pesanan masuk dalam rentang filter
    const isWithinDateRange = (dateString, filterType) => {
        if (filterType === 'semua') return true;

        const orderDate = new Date(dateString);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filterType) {
            case 'hari-ini':
                return orderDate >= startOfToday;
            case '7-hari':
                const sevenDaysAgo = new Date(startOfToday);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return orderDate >= sevenDaysAgo;
            case '30-hari':
                const thirtyDaysAgo = new Date(startOfToday);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return orderDate >= thirtyDaysAgo;
            case 'bulan-berjalan':
                return orderDate.getMonth() === now.getMonth() &&
                    orderDate.getFullYear() === now.getFullYear();
            case 'kustom':
                if (!customStartDate || !customEndDate) return true;

                const start = new Date(customStartDate);
                start.setHours(0, 0, 0, 0);

                const end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);

                return orderDate >= start && orderDate <= end;
            default:
                return true;
        }
    };

    // Logika Filter Gabungan (Pencarian Teks + Periode Tanggal + Tipe Order)
    const filteredHistory = salesHistory.filter(order => {
        const searchLower = searchTerm.toLowerCase();

        // 1. Filter Teks (Mencakup ID, No Order, ATAU Nama Pelanggan)
        const matchesSearch =
            (order.id && String(order.id).toLowerCase().includes(searchLower)) ||
            (order.orderNumber && String(order.orderNumber).toLowerCase().includes(searchLower)) ||
            (order.customerName && String(order.customerName).toLowerCase().includes(searchLower));

        // 2. Filter Tanggal
        const matchesDate = isWithinDateRange(order.date, dateFilter);

        // 3. Filter Tipe Order
        const matchesOrderType = orderTypeFilter === 'semua' || order.orderType === orderTypeFilter;

        return matchesSearch && matchesDate && matchesOrderType;
    });

    const handleDelete = (id) => {
        triggerConfirm('Hapus riwayat pesanan ini? Aksi ini tidak dapat dibatalkan.', () => {
            setSalesHistory(salesHistory.filter(order => order.id !== id));
        });
    };

    return (
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <PageHeader
                    title="Riwayat Pesanan"
                    icon={<History className="w-6 h-6 text-green-500 dark:text-green-400" />}
                />
            </div>

            {/* CONTAINER UTAMA FILTER*/}
            <div className="flex-shrink-0 w-full flex flex-col gap-4 mb-6">

                {/* Card 1: Tab Filter Periode Tanggal */}
                <Card className="flex items-center gap-2 overflow-x-auto p-4 w-full scrollbar-hide">
                    <Calendar className="text-slate-400 dark:text-slate-500 w-5 h-5 flex-shrink-0 mr-1" />
                    {filterTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setDateFilter(tab.id)}
                            className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${dateFilter === tab.id
                                ? 'bg-slate-800 text-white border-slate-800 dark:border-slate-100 shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </Card>

                {/* Card 3: Input Khusus Tanggal Kustom */}
                {dateFilter === 'kustom' && (
                    <Card className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-fit shadow-sm">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">Dari Tanggal</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-4" />
                        <div className="flex flex-col">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </Card>
                )}

                {/* Card 2: Dropdown Filter Tipe Order & Input Pencarian */}
                <Card className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto p-4">
                    {/* Dropdown Filter Tipe Order */}
                    <div className="relative w-full sm:w-48">
                        <select
                            className="w-full appearance-none pl-4 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 transition-all text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
                            value={orderTypeFilter}
                            onChange={(e) => setOrderTypeFilter(e.target.value)}
                        >
                            <option value="semua">Semua Tipe Order</option>
                            {uniqueOrderTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
                    </div>

                    {/* Input Pencarian */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Cari No. Order, ID, atau Nama..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </Card>

            </div>

            {/* Grid Riwayat Pesanan */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {filteredHistory.length > 0 ? (
                    filteredHistory.map(order => (
                        <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 relative flex flex-col hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3 border-b border-dashed border-slate-200 dark:border-slate-700 pb-3">
                                <div>
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">#{order.id}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleString('id-ID')}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${order.paymentMethod === 'Ojol' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/20' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-100 dark:border-green-500/20'}`}>
                                    {order.paymentMethod} {order.paymentMethod === 'Ojol' && `(${order.ojolName})`}
                                </span>
                            </div>

                            <div className="mb-4 flex-1 space-y-1">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Pelanggan: {order.customerName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{order.items.length} Item • {order.orderType}</p>
                                {order.paymentMethod === 'Ojol' && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">No. Order: <span className="text-orange-600 dark:text-orange-400">{order.orderNumber}</span></p>
                                )}
                            </div>

                            <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-900 pt-3 mt-auto">
                                <span className="font-black text-slate-800 dark:text-slate-100">{formatRupiah(order.total)}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setReceiptModal({ isOpen: true, data: order, kembalian: 0 })} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold">
                                        <Receipt className="w-4 h-4" /> Struk
                                    </button>
                                    {isAdminMode && (
                                        <button onClick={() => handleDelete(order.id)} className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                        <Calendar className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
                        <h3 className="text-slate-600 dark:text-slate-300 font-bold mb-1">Tidak ada pesanan</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">Coba ubah rentang filter atau kata kunci pencarian.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;