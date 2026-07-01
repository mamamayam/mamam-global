import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { TrendingUp, TrendingDown, Receipt, Wallet, ShoppingBag, Eye, Sparkles, Clock } from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';
import { DetailModal } from '../../components/ui';
import { activeOnly } from '../../utils/softDelete';

const HomeView = () => {
    const { salesHistory, expenses, setReceiptModal } = useAppContext();
    const [now, setNow] = useState(new Date());
    const [detailOrder, setDetailOrder] = useState(null);

    // Jam berjalan biar dashboard terasa hidup
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000 * 30);
        return () => clearInterval(timer);
    }, []);

    // Helper untuk mengecek apakah tanggal adalah hari ini
    const isToday = (dateString) => {
        const d = new Date(dateString);
        return d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
    };

    // Sapaan dinamis sesuai jam
    const greeting = useMemo(() => {
        const h = now.getHours();
        if (h < 11) return 'Selamat Pagi';
        if (h < 15) return 'Selamat Siang';
        if (h < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    }, [now]);

    // Kalkulasi Hari Ini
    const salesToday = useMemo(
        () => activeOnly(salesHistory).filter(order => isToday(order.date)).sort((a, b) => new Date(b.date) - new Date(a.date)),
        [salesHistory, now]
    );
    const totalSalesToday = salesToday.reduce((sum, order) => sum + order.total, 0);
    const totalTransaksiToday = salesToday.length;
    const avgTransaksi = totalTransaksiToday > 0 ? totalSalesToday / totalTransaksiToday : 0;

    const expensesToday = useMemo(
        () => activeOnly(expenses).filter(exp => isToday(exp.date)),
        [expenses, now]
    );
    const totalExpensesToday = expensesToday.reduce((sum, exp) => sum + exp.amount, 0);

    const netProfitToday = totalSalesToday - totalExpensesToday;

    // Persentase progress bar penjualan vs pengeluaran (visual, dibatasi max 100%)
    const expenseRatio = totalSalesToday > 0
        ? Math.min(100, Math.round((totalExpensesToday / totalSalesToday) * 100))
        : (totalExpensesToday > 0 ? 100 : 0);

    return (
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">

            {/* Header Sapaan */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h2 className="font-heading text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {greeting} <Sparkles className="w-5 h-5 text-orange-400" />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full px-4 py-2 shadow-sm w-fit">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-bold tabular-nums">
                        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {/* Kartu Ringkasan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {/* Penjualan */}
                <div className="relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg shadow-green-500/20 flex flex-col justify-between">
                    <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Penjualan Hari Ini</p>
                    </div>
                    <p className="font-heading text-2xl font-black text-white relative">{formatRupiah(totalSalesToday)}</p>
                </div>

                {/* Pengeluaran */}
                <div className="relative overflow-hidden bg-gradient-to-br from-accent-500 to-orange-600 p-5 rounded-2xl shadow-lg shadow-orange-500/20 flex flex-col justify-between">
                    <TrendingDown className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <TrendingDown className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Pengeluaran Hari Ini</p>
                    </div>
                    <p className="font-heading text-2xl font-black text-white relative">{formatRupiah(totalExpensesToday)}</p>
                </div>

                {/* Laba Bersih */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${netProfitToday >= 0 ? 'bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400' : 'bg-accent-50 dark:bg-accent-500/10 text-accent-500 dark:text-accent-400'}`}>
                            <Wallet className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Laba Bersih</p>
                    </div>
                    <p className={`font-heading text-2xl font-black ${netProfitToday >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-accent-500 dark:text-accent-400'}`}>
                        {formatRupiah(netProfitToday)}
                    </p>
                    {/* Progress bar rasio pengeluaran terhadap penjualan */}
                    <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${expenseRatio >= 80 ? 'bg-accent-500' : 'bg-green-500'}`}
                            style={{ width: `${expenseRatio}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{expenseRatio}% dari penjualan terpakai untuk pengeluaran</p>
                </div>

                {/* Jumlah Transaksi */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaksi Hari Ini</p>
                    </div>
                    <p className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100">{totalTransaksiToday}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Rata-rata {formatRupiah(avgTransaksi)} / transaksi</p>
                </div>
            </div>

            {/* Riwayat Pesanan Hari Ini */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100">Riwayat Pesanan Hari Ini</h3>
                {salesToday.length > 0 && (
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{salesToday.length} pesanan</span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {salesToday.map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 relative flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                        <div className="flex justify-between items-start mb-3 border-b border-dashed border-slate-200 dark:border-slate-700 pb-3">
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">#{order.id}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${order.paymentMethod === 'Ojol' ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 border-orange-100 dark:border-orange-500/20' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-100 dark:border-green-500/20'}`}>
                                {order.paymentMethod} {order.paymentMethod === 'Ojol' && `(${order.ojolName})`}
                            </span>
                        </div>

                        <div className="mb-4 flex-1 space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Pelanggan: {order.customerName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{order.items.length} Item • {order.orderType}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-900 pt-3 mt-auto">
                            <span className="font-black text-slate-800 dark:text-slate-100">{formatRupiah(order.total)}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setDetailOrder(order)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Detail">
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => setReceiptModal({ isOpen: true, data: order, kembalian: 0 })} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold">
                                    <Receipt className="w-4 h-4" /> Struk
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {salesToday.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                        <ShoppingBag className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
                        <h3 className="text-slate-600 dark:text-slate-300 font-bold mb-1">Belum ada pesanan hari ini</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">Pesanan baru akan langsung muncul di sini.</p>
                    </div>
                )}
            </div>

            {/* Modal Detail Pesanan (khusus lihat, tanpa opsi hapus) */}
            <DetailModal
                isOpen={!!detailOrder}
                onClose={() => setDetailOrder(null)}
                icon={<Receipt className="w-4 h-4 text-accent-500 dark:text-accent-400" />}
                title={detailOrder && `#${detailOrder.id}`}
                subtitle={detailOrder && new Date(detailOrder.date).toLocaleString('id-ID')}
                badges={detailOrder ? [
                    {
                        label: detailOrder.paymentMethod === 'Ojol' ? `Ojol (${detailOrder.ojolName})` : detailOrder.paymentMethod,
                        variant: detailOrder.paymentMethod === 'Ojol' ? 'orange' : 'success',
                    },
                    { label: detailOrder.orderType, variant: 'neutral' },
                ] : []}
                sections={[{
                    rows: [
                        { label: 'Pelanggan', value: detailOrder?.customerName },
                        { label: 'No. Order', value: detailOrder?.orderNumber },
                    ]
                }]}
                items={detailOrder?.items?.map(it => ({
                    name: it.name,
                    note: [it.variantName, it.note].filter(Boolean).join(' • '),
                    qty: it.qty,
                    price: it.price,
                }))}
                summaryRows={[
                    { label: 'Subtotal', value: detailOrder?.subtotal, type: 'currency' },
                    { label: 'Diskon Voucher', value: detailOrder?.discount ? -detailOrder.discount : 0, type: 'currency' },
                    { label: 'Potong Poin', value: detailOrder?.pointDiscount ? -detailOrder.pointDiscount : 0, type: 'currency' },
                    { label: 'Diskon Manual', value: detailOrder?.manualDiscountAmount ? -detailOrder.manualDiscountAmount : 0, type: 'currency' },
                    { label: 'Pajak', value: detailOrder?.taxAmount, type: 'currency' },
                    { label: 'Service', value: detailOrder?.serviceAmount, type: 'currency' },
                    { label: 'Ongkir', value: detailOrder?.deliveryFee, type: 'currency' },
                ]}
                highlight={{ label: 'Total Tagihan', value: detailOrder?.total }}
                actions={[{
                    label: 'Cetak Struk',
                    icon: <Receipt className="w-4 h-4" />,
                    onClick: () => {
                        setReceiptModal({ isOpen: true, data: detailOrder, kembalian: 0 });
                        setDetailOrder(null);
                    },
                }]}
            />
        </div>
    );
};

export default HomeView;