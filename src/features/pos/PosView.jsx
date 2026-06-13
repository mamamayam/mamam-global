import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from '../pos/modals/PaymentModal';
import VariantSelectionModal from '../pos/modals/VariantSelectionModal';


const PosView = () => {
    // Temukan baris ini di PosView
    const { menus, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
        setSelectedMenuForVariant, setVariantSelectedOptions, addToCart, formatRupiah,
        setIsCartOpen, cart, getTotal, currentShift, triggerAlert, setActiveTab, setCurrentView
    } = useAppContext();

    const categories = ['Semua', ...new Set(menus.map(m => m.category))];
    const filteredMenus = menus.filter(m =>
        (m.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (selectedCategory === 'Semua' || m.category === selectedCategory));

    const handleMenuClick = (menu) => {
        if (!currentShift) {
            triggerAlert('Peringatan: Dompet belum dibuka. Harap buka dompet terlebih dahulu di menu "Dompet Kasir".');
            setCurrentView('dompet');
            return;
        }
        if (menu.variantGroupIds.length > 0) {
            setSelectedMenuForVariant(menu);
            setVariantSelectedOptions({});
        } else {
            addToCart(menu);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            {!currentShift && (
                <div className="bg-red-500 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Shift Kasir belum dibuka! Transaksi tidak akan masuk ke laporan Shift ini.
                </div>
            )}
            <div className="p-4 bg-white shadow-sm z-10 sticky top-0">
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="Cari menu pesanan..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-600 bg-slate-50 transition-all text-sm font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 snap-x">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border duration-300 ${selectedCategory === cat ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredMenus.map(menu => (
                        <div key={menu.id} onClick={() => handleMenuClick(menu)}
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 md:p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-orange-200 active:scale-95 transition-all duration-300 relative overflow-hidden group">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-50 to-orange-100 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300">
                                {menu.category === 'Minuman' ? <Coffee className="w-6 h-6 md:w-8 md:h-8 text-orange-600" /> : <UtensilsCrossed className="w-6 h-6 md:w-8 md:h-8 text-orange-600" />}
                            </div>
                            <h3 className="font-heading font-bold text-slate-800 text-xs md:text-sm mb-1 leading-tight">{menu.name}</h3>
                            <p className="text-orange-600 font-bold text-xs md:text-sm mt-auto">{formatRupiah(menu.price)}</p>
                            {menu.variantGroupIds.length > 0 && (
                                <div className="absolute top-2 right-2 flex gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span></div>
                            )}
                        </div>
                    ))}
                </div>
                {filteredMenus.length === 0 && (
                    <div className="text-center text-slate-400 mt-10 animate-in fade-in duration-300">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Menu tidak ditemukan</p>
                    </div>
                )}
            </div>


            <div className="fixed bottom-20 right-6 z-50">
                <button onClick={() => setIsCartOpen(true)} className="bg-slate-800 text-white rounded-full py-3 px-5 shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-3 hover:bg-slate-900 transition-all active:scale-95 border border-slate-700">
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-2.5 -right-2.5 bg-orange-600 text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center border-2 border-slate-800 animate-in zoom-in duration-300">
                                {cart.reduce((sum, item) => sum + item.qty, 0)}
                            </span>
                        )}
                    </div>
                    <div className="border-l border-slate-700 pl-3 flex flex-col items-start leading-tight">
                        <span className="text-[10px] text-slate-400 font-medium">Total</span>
                        <span className="font-bold text-sm">{formatRupiah(getTotal())}</span>
                    </div>
                </button>
            </div>
            <CartDrawer />
            <PaymentModal />
            <VariantSelectionModal />
        </div>
    );
};

export default PosView;