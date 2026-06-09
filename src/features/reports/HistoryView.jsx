import React, { useState } from 'react'; // Tambahkan useState
import { useAppContext } from '../../context/AppContext';
import { Trash2, Receipt, Search } from 'lucide-react'; // Tambahkan Search
import { formatRupiah } from '../../utils/formatters';

const HistoryView = () => {
    const { salesHistory, setSalesHistory, isAdminMode, setReceiptModal, triggerConfirm } = useAppContext();
    
    // 1. State untuk pencarian
    const [searchTerm, setSearchTerm] = useState('');

    // 2. Logika Filter
    // Filter berdasarkan ID Order atau Nomor Order Ojol
    const filteredHistory = salesHistory.filter(order => 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.orderNumber && order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDelete = (id) => {
        triggerConfirm('Hapus riwayat pesanan ini? Aksi ini tidak dapat dibatalkan.', () => {
            setSalesHistory(salesHistory.filter(order => order.id !== id));
        });
    };

    return (
        <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800">Riwayat Pesanan</h2>
                
                {/* 3. Input Pencarian */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text"
                        placeholder="Cari No. Order..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Gunakan filteredHistory sebagai data yang di-map */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {filteredHistory.length > 0 ? (
                    filteredHistory.map(order => (
                        <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 relative flex flex-col">
                            {/* ... (isi kartu pesanan tetap sama seperti sebelumnya) ... */}
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
                                {order.paymentMethod === 'Ojol' && (
                                    <p className="text-[10px] text-slate-500 font-bold">No. Order: <span className="text-orange-600">{order.orderNumber}</span></p>
                                )}
                            </div>

                            <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-auto">
                                <span className="font-black text-slate-800">{formatRupiah(order.total)}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setReceiptModal({ isOpen: true, data: order, kembalian: 0 })} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold">
                                        <Receipt className="w-4 h-4" /> Struk
                                    </button>
                                    {isAdminMode && (
                                        <button onClick={() => handleDelete(order.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-10 text-center text-slate-400">
                        Tidak ada pesanan yang ditemukan.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;