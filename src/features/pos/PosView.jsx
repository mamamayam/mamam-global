import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package, Star } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from '../pos/modals/PaymentModal';
import VariantSelectionModal from '../pos/modals/VariantSelectionModal';


const PosView = () => {
    // Temukan baris ini di PosView
    const { menus, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
        setSelectedMenuForVariant, setVariantSelectedOptions, addToCart, formatRupiah,
        setIsCartOpen, cart, getTotal, currentShift, triggerAlert, setActiveTab, setCurrentView,
        salesHistory
    } = useAppContext();

    const categories = ['Favorit', ...new Set(menus.map(m => m.category))];

    // Hitung jumlah terjual per menu dari seluruh riwayat penjualan,
    // untuk menentukan menu yang paling sering dipesan (Favorit).
    const menuOrderCounts = useMemo(() => {
        const counts = {};
        salesHistory.forEach(order => {
            (order.items || []).forEach(item => {
                if (!item.menuId) return;
                counts[item.menuId] = (counts[item.menuId] || 0) + (item.qty || 0);
            });
        });
        return counts;
    }, [salesHistory]);

    const FAVORITE_LIMIT = 12;
    const favoriteMenus = useMemo(() => {
        return [...menus]
            .filter(m => (menuOrderCounts[m.id] || 0) > 0)
            .sort((a, b) => (menuOrderCounts[b.id] || 0) - (menuOrderCounts[a.id] || 0))
            .slice(0, FAVORITE_LIMIT);
    }, [menus, menuOrderCounts]);

    const filteredMenus = (selectedCategory === 'Favorit' ? favoriteMenus : menus).filter(m =>
        (m.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (selectedCategory === 'Favorit' || selectedCategory === 'Semua' || m.category === selectedCategory));

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
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            {!currentShift && (
                <div className="bg-red-500 dark:bg-red-600 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Shift Kasir belum dibuka! Transaksi tidak akan masuk ke laporan Shift ini.
                </div>
            )}
            <div className="p-4 bg-white dark:bg-slate-900 shadow-sm z-10 sticky top-0">
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                    <input type="text" placeholder="Cari menu pesanan..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600 dark:focus:ring-orange-500 bg-slate-50 dark:bg-slate-950 transition-all text-sm font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 snap-x">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border duration-300 ${selectedCategory === cat ? 'bg-orange-600 dark:bg-orange-500 text-white border-orange-600 dark:border-orange-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredMenus.map(menu => (
                        <div key={menu.id} onClick={() => handleMenuClick(menu)}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/30 active:scale-95 transition-all duration-300 relative overflow-hidden group">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-50 dark:from-orange-500/10 to-orange-100 dark:to-orange-500/15 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300">
                                {menu.category === 'Minuman' ? <Coffee className="w-6 h-6 md:w-8 md:h-8 text-orange-600 dark:text-orange-400" /> : <UtensilsCrossed className="w-6 h-6 md:w-8 md:h-8 text-orange-600 dark:text-orange-400" />}
                            </div>
                            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs md:text-sm mb-1 leading-tight">{menu.name}</h3>
                            <p className="text-orange-600 dark:text-orange-400 font-bold text-xs md:text-sm mt-auto">{formatRupiah(menu.price)}</p>
                            {menu.variantGroupIds.length > 0 && (
                                <div className="absolute top-2 right-2 flex gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></span></div>
                            )}
                            {selectedCategory !== 'Favorit' && (menuOrderCounts[menu.id] || 0) > 0 && (
                                <div className="absolute top-2 left-2"><Star className="w-3.5 h-3.5 text-yellow-400 dark:text-yellow-500 fill-yellow-400 dark:fill-yellow-500" /></div>
                            )}
                        </div>
                    ))}
                </div>
                {filteredMenus.length === 0 && selectedCategory === 'Favorit' && (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10 animate-in fade-in duration-300">
                        <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Belum ada menu favorit</p>
                        <p className="text-xs mt-1">Menu yang sering dipesan akan otomatis muncul di sini</p>
                    </div>
                )}
                {filteredMenus.length === 0 && selectedCategory !== 'Favorit' && (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10 animate-in fade-in duration-300">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Menu tidak ditemukan</p>
                    </div>
                )}
            </div>



            <div className="fixed bottom-20 right-6 z-50">
                <button onClick={() => setIsCartOpen(true)} className="bg-slate-800 text-white rounded-full py-3 px-5 shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-3 hover:bg-slate-900 transition-all active:scale-95 border border-slate-700 dark:border-slate-300">
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-2.5 -right-2.5 bg-orange-600 dark:bg-orange-500 text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center border-2 border-slate-800 dark:border-slate-100 animate-in zoom-in duration-300">
                                {cart.reduce((sum, item) => sum + item.qty, 0)}
                            </span>
                        )}
                    </div>
                    <div className="border-l border-slate-700 dark:border-slate-300 pl-3 flex flex-col items-start leading-tight">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Total</span>
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