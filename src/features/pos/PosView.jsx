import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package, Star, X } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from '../pos/modals/PaymentModal';
import VariantSelectionModal from '../pos/modals/VariantSelectionModal';

const PosView = () => {
    const {
        menus, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
        setSelectedMenuForVariant, setVariantSelectedOptions, addToCart, formatRupiah,
        setIsCartOpen, cart, getTotal, currentShift, triggerAlert, setActiveTab, navigate,
        salesHistory
    } = useAppContext();

    const categoryTabsRef = useRef(null);
    const [gridVisible, setGridVisible] = useState(true);

    // ─── Statistik order ────────────────────────────────────────────────────
    const menuOrderCounts = useMemo(() => {
        const counts = {};
        salesHistory.forEach(order =>
            (order.items || []).forEach(item => {
                if (item.menuId) counts[item.menuId] = (counts[item.menuId] || 0) + (item.qty || 0);
            })
        );
        return counts;
    }, [salesHistory]);

    // Hitung total order per kategori untuk sorting tab
    const categoryOrderCounts = useMemo(() => {
        const counts = {};
        menus.forEach(m => {
            counts[m.category] = (counts[m.category] || 0) + (menuOrderCounts[m.id] || 0);
        });
        return counts;
    }, [menus, menuOrderCounts]);

    // ─── Daftar kategori diurutkan berdasarkan popularitas ──────────────────
    const categories = useMemo(() => {
        const raw = [...new Set(menus.map(m => m.category))];
        raw.sort((a, b) => (categoryOrderCounts[b] || 0) - (categoryOrderCounts[a] || 0));
        return ['Favorit', 'Semua', ...raw];
    }, [menus, categoryOrderCounts]);

    // ─── Menu favorit ────────────────────────────────────────────────────────
    const FAVORITE_LIMIT = 12;
    const favoriteMenus = useMemo(() =>
        [...menus]
            .filter(m => (menuOrderCounts[m.id] || 0) > 0)
            .sort((a, b) => (menuOrderCounts[b.id] || 0) - (menuOrderCounts[a.id] || 0))
            .slice(0, FAVORITE_LIMIT),
        [menus, menuOrderCounts]
    );

    // ─── Filter menu ─────────────────────────────────────────────────────────
    // Saat ada query → cari di SELURUH menu (abaikan kategori).
    // Saat tidak ada query → filter berdasarkan kategori yang dipilih.
    const isSearching = Boolean(searchQuery.trim());

    const filteredMenus = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (q) return menus.filter(m => m.name.toLowerCase().includes(q));
        const base = selectedCategory === 'Favorit' ? favoriteMenus : menus;
        return base.filter(m =>
            selectedCategory === 'Favorit' ||
            selectedCategory === 'Semua' ||
            m.category === selectedCategory
        );
    }, [menus, favoriteMenus, selectedCategory, searchQuery]);

    // ─── Ganti kategori dengan transisi fade-slide ──────────────────────────
    const handleCategoryClick = useCallback((cat) => {
        // Tidak ada yang berubah → tidak perlu animasi
        if (cat === selectedCategory && !searchQuery.trim()) return;
        setGridVisible(false);
        setTimeout(() => {
            setSearchQuery('');
            setSelectedCategory(cat);
            setGridVisible(true);
        }, 170);
    }, [selectedCategory, searchQuery, setSelectedCategory, setSearchQuery]);

    // Auto-scroll tab aktif ke tengah layar
    useEffect(() => {
        const el = categoryTabsRef.current?.querySelector('[data-active="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [selectedCategory]);

    // ─── Klik menu ───────────────────────────────────────────────────────────
    const handleMenuClick = useCallback((menu) => {
        if (!currentShift) {
            triggerAlert('Peringatan: Dompet belum dibuka. Harap buka dompet terlebih dahulu di menu "Dompet Kasir".');
            navigate('dompet');
            return;
        }
        if (menu.variantGroupIds.length > 0) {
            setSelectedMenuForVariant(menu);
            setVariantSelectedOptions({});
        } else {
            addToCart(menu);
        }
    }, [currentShift, triggerAlert, navigate, setSelectedMenuForVariant, setVariantSelectedOptions, addToCart]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">

            {/* Banner peringatan shift */}
            {!currentShift && (
                <div className="bg-red-500 dark:bg-red-600 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Shift Kasir belum dibuka! Transaksi tidak akan masuk ke laporan Shift ini.
                </div>
            )}

            {/* ── Header sticky ──────────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 bg-white dark:bg-slate-900 shadow-sm z-10 sticky top-0">

                {/* Search bar */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari menu pesanan..."
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50 dark:bg-slate-950 transition-all text-sm font-medium"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {/* Tombol X — muncul saat ada teks */}
                    {isSearching && (
                        <button
                            onClick={() => setSearchQuery('')}
                            aria-label="Hapus pencarian"
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 animate-in zoom-in duration-150"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Tab kategori */}
                <div ref={categoryTabsRef} className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 snap-x">
                    {categories.map(cat => {
                        const isActive = selectedCategory === cat && !isSearching;
                        return (
                            <button
                                key={cat}
                                data-active={isActive}
                                onClick={() => handleCategoryClick(cat)}
                                className={[
                                    'snap-center shrink-0 px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-300',
                                    isActive
                                        ? 'bg-orange-600 dark:bg-orange-500 text-white border-transparent shadow-md scale-[1.05]'
                                        : isSearching
                                            // Tab ter-dim saat mode pencarian
                                            ? 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 opacity-50 hover:opacity-90 hover:bg-orange-50 dark:hover:bg-slate-800'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-slate-800 hover:border-orange-200 dark:hover:border-orange-500/40',
                                ].join(' ')}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Info bar hasil pencarian */}
            {isSearching && (
                <div className="px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border-b border-orange-100 dark:border-orange-500/20 flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span>
                        <span className="font-bold">{filteredMenus.length}</span> menu ditemukan untuk{' '}
                        <span className="font-bold">"{searchQuery}"</span>
                    </span>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="ml-auto text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                    >
                        Hapus
                    </button>
                </div>
            )}

            {/* ── Grid menu ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    style={{
                        opacity: gridVisible ? 1 : 0,
                        transform: gridVisible ? 'translateY(0)' : 'translateY(8px)',
                        transition: 'opacity 0.17s ease, transform 0.17s ease',
                    }}
                >
                    {filteredMenus.map(menu => (
                        <div
                            key={menu.id}
                            onClick={() => handleMenuClick(menu)}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/30 active:scale-95 transition-all duration-300 relative overflow-hidden group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-50 dark:from-orange-500/10 to-orange-100 dark:to-orange-500/15 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300">
                                {menu.category === 'Minuman'
                                    ? <Coffee className="w-6 h-6 md:w-8 md:h-8 text-orange-600 dark:text-orange-400" />
                                    : <UtensilsCrossed className="w-6 h-6 md:w-8 md:h-8 text-orange-600 dark:text-orange-400" />
                                }
                            </div>
                            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs md:text-sm mb-1 leading-tight">
                                {menu.name}
                            </h3>

                            {/* Badge kategori — hanya muncul saat pencarian lintas kategori */}
                            {isSearching && (
                                <span className="inline-block text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full mb-1">
                                    {menu.category}
                                </span>
                            )}

                            <p className="text-orange-600 dark:text-orange-400 font-bold text-xs md:text-sm mt-auto">
                                {formatRupiah(menu.price)}
                            </p>

                            {/* Indikator varian */}
                            {menu.variantGroupIds.length > 0 && (
                                <div className="absolute top-2 right-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500 block" />
                                </div>
                            )}

                            {/* Bintang favorit */}
                            {(selectedCategory !== 'Favorit' || isSearching) && (menuOrderCounts[menu.id] || 0) > 0 && (
                                <div className="absolute top-2 left-2">
                                    <Star className="w-3.5 h-3.5 text-yellow-400 dark:text-yellow-500 fill-yellow-400 dark:fill-yellow-500" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Empty state: tab Favorit kosong */}
                {filteredMenus.length === 0 && selectedCategory === 'Favorit' && !isSearching && (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10 animate-in fade-in duration-300">
                        <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">Belum ada menu favorit</p>
                        <p className="text-xs mt-1">Menu yang sering dipesan akan otomatis muncul di sini</p>
                    </div>
                )}

                {/* Empty state: pencarian/kategori tidak ada hasil */}
                {filteredMenus.length === 0 && (selectedCategory !== 'Favorit' || isSearching) && (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10 animate-in fade-in duration-300">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">Menu tidak ditemukan</p>
                        {isSearching && <p className="text-xs mt-1">Coba kata kunci yang berbeda</p>}
                    </div>
                )}
            </div>

            {/* ── FAB keranjang ───────────────────────────────────────────── */}
            <div className="fixed bottom-20 right-6 z-50">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="bg-slate-800 text-white rounded-full py-3 px-5 shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-3 hover:bg-slate-900 transition-all active:scale-95 border border-slate-700 dark:border-slate-300"
                >
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