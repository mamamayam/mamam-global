import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { TrendingUp, TrendingDown, Receipt, Trash2 } from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';

const HomeView = () => {
    const { salesHistory, expenses, setReceiptModal } = useAppContext();

    // Helper untuk mengecek apakah tanggal adalah hari ini
    const isToday = (dateString) => {
        const d = new Date(dateString);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    // Kalkulasi Hari Ini
    const salesToday = salesHistory.filter(order => isToday(order.date));
    const totalSalesToday = salesToday.reduce((sum, order) => sum + order.total, 0);

    const expensesToday = expenses.filter(exp => isToday(exp.date));
    const totalExpensesToday = expensesToday.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto pb-6 animate-in fade-in duration-300">
            {/* Kartu Ringkasan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Penjualan Hari Ini</p>
                        <p className="font-heading text-2xl font-black text-slate-800">{formatRupiah(totalSalesToday)}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengeluaran Hari Ini</p>
                        <p className="font-heading text-2xl font-black text-slate-800">{formatRupiah(totalExpensesToday)}</p>
                    </div>
                </div>
            </div>

            {/* Riwayat Pesanan Singkat */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-heading text-lg font-bold text-slate-800">Riwayat Pesanan Terbaru</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {salesHistory.slice(0, 10).map(order => ( // Tampilkan maksimal 10 terakhir agar tidak berat
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 relative flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3 border-b border-dashed border-slate-200 pb-3">
                            <div>
                                <h3 className="font-bold text-sm text-slate-800">#{order.id}</h3>
                                <p className="text-[10px] text-slate-500">{new Date(order.date).toLocaleString('id-ID')}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${order.paymentMethod === 'Ojol' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                {order.paymentMethod} {order.paymentMethod === 'Ojol' && `(${order.ojolName})`}
                            </span>
                        </div>

                        <div className="mb-4 flex-1 space-y-1">
                            <p className="text-xs font-bold text-slate-700">Pelanggan: {order.customerName}</p>
                            <p className="text-xs text-slate-500">{order.items.length} Item • {order.orderType}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-auto">
                            <span className="font-black text-slate-800">{formatRupiah(order.total)}</span>
                            <button onClick={() => setReceiptModal({ isOpen: true, data: order, kembalian: 0 })} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold">
                                <Receipt className="w-4 h-4" /> Struk
                            </button>
                        </div>
                    </div>
                ))}

                {salesHistory.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400">
                        Belum ada pesanan hari ini.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeView;