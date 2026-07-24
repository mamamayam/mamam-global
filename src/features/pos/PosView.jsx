import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package, Star, X, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from './PaymentModal';
import VariantSelectionModal from './VariantSelectionModal';
import { Badge, EmptyState, Button } from '../../components/ui';

// 1. IMPORT STORE ZUSTAND
import { usePosStore } from '../../store/usePosStore';
// 2. IMPORT CONTEXT LAMA
import { useAppContext } from '../../context/AppContext';

// ─── Tab kategori bergaya teks + underline (bukan pill button) ─────────
function CategoryTextTab({ cat, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={() => onClick(cat)}
            data-active={isActive}
            className={`
                shrink-0 whitespace-nowrap select-none cursor-pointer
                pb-2 text-sm font-bold border-b-2 transition-colors duration-200

                ${isActive
                    ? 'text-accent-600 dark:text-accent-400 border-accent-500'
                    : 'text-slate-400 dark:text-slate-500 border-transparent'
                }
            `}
        >
            {cat}
        </button>
    );
}

const PosView = () => {
    // ─── AMBIL DARI ZUSTAND (Granular / Dipisah-pisah) ───
    const addToCart = usePosStore((state) => state.addToCart);
    const searchQuery = usePosStore((state) => state.searchQuery);
    const setSearchQuery = usePosStore((state) => state.setSearchQuery);
    const selectedCategory = usePosStore((state) => state.selectedCategory);
    const setSelectedCategory = usePosStore((state) => state.setSelectedCategory);
    const cart = usePosStore((state) => state.cart);
    const setIsCartOpen = usePosStore((state) => state.setIsCartOpen);
    const setSelectedMenuForVariant = usePosStore((state) => state.setSelectedMenuForVariant);
    const setVariantSelectedOptions = usePosStore((state) => state.setVariantSelectedOptions);

    // ─── AMBIL DARI CONTEXT LAMA ───
    const {
        menus, formatRupiah, getTotal, currentShift, triggerAlert,
        salesHistory, setCurrentView, variantGroups
    } = useAppContext();

    const categoryTabsRef = useRef(null);
    const [gridVisible, setGridVisible] = useState(true);

    // ─── Filter sheet (kategori, rentang harga, urutan, tampilan) ──────────
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const PRICE_PRESETS = [
        { key: 'semua', label: 'Semua harga', max: null },
        { key: 'under10', label: 'Di bawah 10rb', max: 10000 },
        { key: 'under25', label: 'Di bawah 25rb', max: 25000 },
        { key: 'under50', label: 'Di bawah 50rb', max: 50000 },
    ];
    const PRICE_SLIDER_MAX = 100000;
    const [pricePreset, setPricePreset] = useState('semua');
    const [priceMax, setPriceMax] = useState(PRICE_SLIDER_MAX);
    const SORT_OPTIONS = [
        { key: 'default', label: 'Terlaris' },
        { key: 'name_asc', label: 'Nama A-Z' },
        { key: 'name_desc', label: 'Nama Z-A' },
        { key: 'price_asc', label: 'Harga naik' },
        { key: 'price_desc', label: 'Harga turun' },
    ];
    const [sortBy, setSortBy] = useState('default');

    // Draft state di dalam sheet — biar perubahan cuma "ngefek" pas user
    // pencet "Terapkan", bukan langsung nyaring grid tiap geser slider.
    const [draftPricePreset, setDraftPricePreset] = useState(pricePreset);
    const [draftPriceMax, setDraftPriceMax] = useState(priceMax);
    const [draftSortBy, setDraftSortBy] = useState(sortBy);
    const [draftViewMode, setDraftViewMode] = useState(viewMode);
    const [draftCategory, setDraftCategory] = useState(selectedCategory);

    const openFilterSheet = useCallback(() => {
        setDraftPricePreset(pricePreset);
        setDraftPriceMax(priceMax);
        setDraftSortBy(sortBy);
        setDraftViewMode(viewMode);
        setDraftCategory(selectedCategory);
        setIsFilterOpen(true);
    }, [pricePreset, priceMax, sortBy, viewMode, selectedCategory]);

    const handlePricePresetClick = useCallback((preset) => {
        setDraftPricePreset(preset.key);
        setDraftPriceMax(preset.max ?? PRICE_SLIDER_MAX);
    }, []);

    const handleResetFilter = useCallback(() => {
        setDraftPricePreset('semua');
        setDraftPriceMax(PRICE_SLIDER_MAX);
        setDraftSortBy('default');
        setDraftViewMode('grid');
        setDraftCategory('Semua');
    }, []);

    const handleApplyFilter = useCallback(() => {
        setPricePreset(draftPricePreset);
        setPriceMax(draftPriceMax);
        setSortBy(draftSortBy);
        setViewMode(draftViewMode);
        setSearchQuery('');
        setSelectedCategory(draftCategory);
        setIsFilterOpen(false);
    }, [draftPricePreset, draftPriceMax, draftSortBy, draftViewMode, draftCategory, setSearchQuery, setSelectedCategory]);

    // ─── Statistik order (untuk favorit) ────────────────────────────────────
    const menuOrderCounts = useMemo(() => {
        const counts = {};
        salesHistory.forEach(order =>
            (order.items || []).forEach(item => {
                if (item.menuId) counts[item.menuId] = (counts[item.menuId] || 0) + (item.qty || 0);
            })
        );
        return counts;
    }, [salesHistory]);

    // ─── Manajemen Urutan Kategori ──────────────────────────────────────────
    const [tabs, setTabs] = useState(['Favorit', 'Semua']);

    // Sinkronisasi kategori baru tanpa merusak urutan yang sudah diatur pengguna
    useEffect(() => {
        const base = ['Favorit', 'Semua'];
        const activeCats = [...new Set(menus.map(m => m.category).filter(Boolean))];

        setTabs(prev => {
            const valid = [...base, ...activeCats];
            // Hapus yang sudah tidak ada
            let updated = prev.filter(c => valid.includes(c));
            // Tambahkan yang baru di belakang
            const missing = valid.filter(c => !updated.includes(c));
            if (missing.length > 0) {
                updated = [...updated, ...missing];
            }
            if (updated.length !== prev.length || updated.some((v, i) => v !== prev[i])) {
                return updated;
            }
            return prev;
        });
    }, [menus]);

    // ─── Menu favorit & Filter Menu ─────────────────────────────────────────
    const FAVORITE_LIMIT = 12;
    const favoriteMenus = useMemo(() =>
        [...menus]
            .filter(m => (menuOrderCounts[m.id] || 0) > 0)
            .sort((a, b) => (menuOrderCounts[b.id] || 0) - (menuOrderCounts[a.id] || 0))
            .slice(0, FAVORITE_LIMIT),
        [menus, menuOrderCounts]
    );

    const isSearching = Boolean(searchQuery.trim());

    const filteredMenus = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        let result;
        if (q) {
            result = menus.filter(m => m.name.toLowerCase().includes(q));
        } else {
            const base = selectedCategory === 'Favorit' ? favoriteMenus : menus;
            result = base.filter(m =>
                selectedCategory === 'Favorit' ||
                selectedCategory === 'Semua' ||
                m.category === selectedCategory
            );
        }

        if (priceMax < PRICE_SLIDER_MAX) {
            result = result.filter(m => (m.price || 0) <= priceMax);
        }

        if (sortBy !== 'default') {
            result = [...result].sort((a, b) => {
                if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
                if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
                if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
                if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
                return 0;
            });
        } else if (!q && selectedCategory !== 'Favorit') {
            // "Terlaris" (default): urutkan berdasarkan jumlah order terbanyak
            result = [...result].sort((a, b) => (menuOrderCounts[b.id] || 0) - (menuOrderCounts[a.id] || 0));
        }

        return result;
    }, [menus, favoriteMenus, selectedCategory, searchQuery, priceMax, sortBy, menuOrderCounts, PRICE_SLIDER_MAX]);

    // Preview live count di dalam sheet filter, dihitung dari draft state
    // (biar tombol "Terapkan (N)" nunjukin hasil SEBELUM di-apply)
    const draftFilteredCount = useMemo(() => {
        let result = draftCategory === 'Favorit' ? favoriteMenus : menus;
        result = result.filter(m =>
            draftCategory === 'Favorit' ||
            draftCategory === 'Semua' ||
            m.category === draftCategory
        );
        if (draftPriceMax < PRICE_SLIDER_MAX) {
            result = result.filter(m => (m.price || 0) <= draftPriceMax);
        }
        return result.length;
    }, [menus, favoriteMenus, draftCategory, draftPriceMax, PRICE_SLIDER_MAX]);

    // ─── Ganti kategori ─────────────────────────────────────────────────────
    const handleCategoryClick = useCallback((cat) => {
        if (cat === selectedCategory && !searchQuery.trim()) return;
        setGridVisible(false);
        setTimeout(() => {
            setSearchQuery('');
            setSelectedCategory(cat);
            setGridVisible(true);
        }, 170);
    }, [selectedCategory, searchQuery, setSelectedCategory, setSearchQuery]);

    useEffect(() => {
        const el = categoryTabsRef.current?.querySelector('[data-active="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [selectedCategory]);

    // ─── Swipe kiri/kanan buat pindah kategori (di area grid menu) ──────────
    // Nyimpen titik sentuh awal di ref (bukan state) biar gak micu re-render
    // tiap gerakan jari — cuma dibaca ulang pas jari diangkat (touchend).
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const SWIPE_MIN_DISTANCE = 50; // px, jarak horizontal minimum biar dianggap swipe
    const SWIPE_MAX_VERTICAL = 60; // px, toleransi gerak vertikal (biar gak nabrak scroll)
    const SWIPE_MAX_DURATION = 600; // ms, swipe harus cukup cepat

    const handleTouchStart = useCallback((e) => {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (isSearching || tabs.length === 0) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;

        if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
        if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;
        if (dt > SWIPE_MAX_DURATION) return;

        const currentIdx = tabs.indexOf(selectedCategory);
        if (currentIdx === -1) return;

        // Swipe ke kiri (dx negatif) → kategori berikutnya
        // Swipe ke kanan (dx positif) → kategori sebelumnya
        const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx < 0 || nextIdx >= tabs.length) return;

        handleCategoryClick(tabs[nextIdx]);
    }, [isSearching, tabs, selectedCategory, handleCategoryClick]);

    // ─── Klik menu ──────────────────────────────────────────────────────────
    const handleMenuClick = useCallback((menu) => {
        if (!currentShift) {
            triggerAlert('Peringatan: Dompet belum dibuka. Harap buka dompet terlebih dahulu di menu "Dompet Kasir".');
            setCurrentView('dompet');
            return;
        }
        if (menu.variantGroupIds.length > 0) {
            setSelectedMenuForVariant(menu);
            setVariantSelectedOptions({});
        } else {
            addToCart(menu, {}, variantGroups);
        }
        // Kosongin search bar begitu menu hasil pencarian sudah diklik/dipilih
        if (searchQuery.trim()) {
            setSearchQuery('');
        }
    }, [currentShift, triggerAlert, setCurrentView, setSelectedMenuForVariant, setVariantSelectedOptions, addToCart, variantGroups, searchQuery, setSearchQuery]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative">

            {!currentShift && (
                <Badge variant="danger" className="w-full justify-center py-2 text-xs font-bold gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Shift Kasir belum dibuka! Transaksi tidak masuk laporan Shift ini.
                </Badge>
            )}

            {/* ── Header sticky ──────────────────────────────────────────── */}
            <div className="px-4 short:px-3 pt-4 short:pt-2 pb-3 short:pb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm z-10 sticky top-0">

                {/* Search bar + tombol filter + tombol grid/list */}
                <div className="flex items-center gap-2 mb-3 short:mb-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 short:w-3.5 short:h-3.5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Cari menu..."
                            className="w-full pl-10 short:pl-9 pr-10 py-2.5 short:py-1.5 rounded-full border border-slate-100 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100 transition-all duration-300 text-sm short:text-xs font-medium"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isSearching && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Tombol Filter (buka bottom sheet) */}
                    <button
                        onClick={openFilterSheet}
                        className="shrink-0 rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-400 p-3 short:!p-2 active:scale-95 transition-all duration-300"
                        aria-label="Filter"
                    >
                        <SlidersHorizontal size={18} className="short:!w-4 short:!h-4" />
                    </button>

                    {/* Tombol toggle Grid / List */}
                    <button
                        onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
                        className="shrink-0 rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-400 p-3 short:!p-2 active:scale-95 transition-all duration-300"
                        aria-label="Ganti tampilan grid/list"
                    >
                        {viewMode === 'grid' ? <List size={18} className="short:!w-4 short:!h-4" /> : <LayoutGrid size={18} className="short:!w-4 short:!h-4" />}
                    </button>
                </div>

                {/* Tab kategori (teks + underline, bukan pill — swipe biasa) */}
                <div className="relative">
                    <div ref={categoryTabsRef} className="flex overflow-x-auto hide-scrollbar gap-5 short:gap-3">
                        {tabs.map((cat) => {
                            const isActive = selectedCategory === cat && !isSearching;
                            return (
                                <CategoryTextTab
                                    key={cat}
                                    cat={cat}
                                    isActive={isActive}
                                    onClick={handleCategoryClick}
                                />
                            );
                        })}
                    </div>
                    {/* Garis pemisah tipis di bawah strip kategori */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-100 dark:bg-slate-800" />
                </div>
            </div>

            {isSearching && (
                <div className="px-4 py-2 bg-accent-50 dark:bg-accent-500/10 border-b border-accent-100 dark:border-accent-500/20 flex items-center gap-2 text-xs text-accent-700 dark:text-accent-400 animate-in fade-in">
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span><span className="font-bold">{filteredMenus.length}</span> menu ditemukan untuk "{searchQuery}"</span>
                </div>
            )}

            {/* ── Grid menu (swipe kiri/kanan buat pindah kategori) ────────── */}
            <div
                className="flex-1 overflow-y-auto p-4 short:p-2 pb-32 short:pb-20"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className={viewMode === 'grid'
                        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 short:!grid-cols-4 gap-4 short:gap-2"
                        : "flex flex-col gap-3 short:gap-2"
                    }
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
                            // Di HP landscape (short:), layout diubah dari vertical-stack
                            // (icon atas, teks bawah) jadi horizontal (icon kiri, teks
                            // kanan) — lebih hemat tinggi per-card, jadi gak kepotong/sesak.
                            // Mode List: selalu horizontal (icon kiri, teks kanan), gak
                            // ngikutin breakpoint short: lagi.
                            className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-accent-200 dark:hover:border-accent-500/30 active:scale-95 transition-all duration-300 relative overflow-hidden group ${
                                viewMode === 'grid'
                                    ? 'rounded-3xl short:rounded-xl p-4 md:p-4 short:!p-2 flex flex-col short:!flex-row items-center text-center short:!text-left'
                                    : 'rounded-2xl p-3 flex flex-row items-center text-left'
                            }`}
                        >
                            <div className={`bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                                viewMode === 'grid'
                                    ? 'w-14 h-14 md:w-16 md:h-16 short:!w-9 short:!h-9 rounded-2xl short:!rounded-lg mb-2.5 md:mb-3 short:!mb-0 short:!mr-2'
                                    : 'w-12 h-12 rounded-xl mr-3'
                            }`}>
                                {menu.category === 'Minuman'
                                    ? <Coffee className="w-6 h-6 md:w-8 md:h-8 short:!w-4 short:!h-4 text-accent-600 dark:text-accent-400" />
                                    : <UtensilsCrossed className="w-6 h-6 md:w-8 md:h-8 short:!w-4 short:!h-4 text-accent-600 dark:text-accent-400" />
                                }
                            </div>
                            <div className={`min-w-0 flex-1 flex flex-col ${viewMode === 'grid' ? 'short:justify-center' : 'justify-center'}`}>
                                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs md:text-sm short:!text-[11px] mb-1 short:!mb-0.5 leading-tight short:truncate">
                                    {menu.name}
                                </h3>
                                {isSearching && <Badge variant="neutral" className="mb-1 short:hidden">{menu.category}</Badge>}
                                <p className="text-accent-600 dark:text-accent-400 font-bold text-xs md:text-sm short:!text-[11px] mt-auto short:!mt-0">
                                    {formatRupiah(menu.price)}
                                </p>
                            </div>
                            {menu.variantGroupIds.length > 0 && (
                                <div className="absolute top-2 right-2 short:!top-1.5 short:!right-1.5"><span className="w-2 h-2 short:!w-1.5 short:!h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 block" /></div>
                            )}
                        </div>
                    ))}
                </div>

                {filteredMenus.length === 0 && selectedCategory === 'Favorit' && !isSearching && (
                    <EmptyState icon={<Star className="w-12 h-12" />} title="Belum ada menu favorit" className="mt-10 animate-in fade-in duration-300" />
                )}
                {filteredMenus.length === 0 && (selectedCategory !== 'Favorit' || isSearching) && (
                    <EmptyState icon={<Package className="w-12 h-12" />} title="Menu tidak ditemukan" className="mt-10 animate-in fade-in duration-300" />
                )}
            </div>

            {/* ── FAB keranjang ───────────────────────────────────────────── */}
            <div
                className="fixed right-6 short:!right-4 z-50 bottom-[var(--fab-bottom)] short:!bottom-4"
                style={{ '--fab-bottom': 'calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
            >
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white rounded-full py-3 short:!py-2 px-5 short:!px-4 shadow-[0_10px_28px_rgba(var(--color-accent-500),0.4)] flex items-center gap-3 short:!gap-2 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(var(--color-accent-500),0.45)] transition-all duration-300 active:scale-95"
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-2.5 -right-2.5 bg-white text-accent-600 text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center border-2 border-accent-600 animate-in zoom-in duration-300">
                                {cart.reduce((sum, item) => sum + item.qty, 0)}
                            </span>
                        )}
                    </div>
                    <div className="border-l border-white/25 pl-3 flex flex-col items-start leading-tight">
                        <span className="text-[10px] text-white/75 font-medium">Total</span>
                        <span className="font-bold text-sm">{formatRupiah(getTotal())}</span>
                    </div>
                </button>
            </div>

            {/* ── Bottom sheet Filter ─────────────────────────────────────── */}
            {isFilterOpen && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
                        onClick={() => setIsFilterOpen(false)}
                    />
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                        {/* Grip handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
                            <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-slate-100">Filter</h2>
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body scrollable */}
                        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
                            {/* Kategori */}
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2.5">Kategori</h3>
                                <div className="flex flex-wrap gap-2">
                                    {tabs.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setDraftCategory(cat)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 ${
                                                draftCategory === cat
                                                    ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Rentang Harga */}
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2.5">Rentang Harga</h3>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {PRICE_PRESETS.map(preset => (
                                        <button
                                            key={preset.key}
                                            onClick={() => handlePricePresetClick(preset)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 ${
                                                draftPricePreset === preset.key
                                                    ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={PRICE_SLIDER_MAX}
                                    step={1000}
                                    value={draftPriceMax}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setDraftPriceMax(val);
                                        const matched = PRICE_PRESETS.find(p => p.max === val);
                                        setDraftPricePreset(val >= PRICE_SLIDER_MAX ? 'semua' : (matched ? matched.key : 'custom'));
                                    }}
                                    className="w-full accent-accent-500 h-2 rounded-full cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 font-medium mt-1.5">
                                    <span>Rp 0</span>
                                    <span>Rp {PRICE_SLIDER_MAX.toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            {/* Urutkan */}
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2.5">Urutkan</h3>
                                <div className="flex flex-wrap gap-2">
                                    {SORT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setDraftSortBy(opt.key)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 ${
                                                draftSortBy === opt.key
                                                    ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tampilan */}
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2.5">Tampilan</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setDraftViewMode('grid')}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all duration-200 active:scale-95 ${
                                            draftViewMode === 'grid'
                                                ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        <LayoutGrid className="w-4 h-4" /> Grid
                                    </button>
                                    <button
                                        onClick={() => setDraftViewMode('list')}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all duration-200 active:scale-95 ${
                                            draftViewMode === 'list'
                                                ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        <List className="w-4 h-4" /> List
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer: Reset + Terapkan */}
                        <div className="safe-bottom flex items-center gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                            <button
                                onClick={handleResetFilter}
                                className="flex-1 py-3 rounded-full border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200 active:scale-95 transition-transform duration-200"
                            >
                                Reset
                            </button>
                            <button
                                onClick={handleApplyFilter}
                                className="flex-[1.4] py-3 rounded-full bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white font-bold text-sm shadow-[0_6px_18px_rgba(var(--color-accent-500),0.35)] active:scale-95 transition-transform duration-200"
                            >
                                Terapkan ({draftFilteredCount})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CartDrawer />
            <PaymentModal />
            <VariantSelectionModal />
        </div>
    );
};

export default PosView;