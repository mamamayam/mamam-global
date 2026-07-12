import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { GripHorizontal, Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package, Star, X, Settings2, Check } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from './PaymentModal';
import VariantSelectionModal from './VariantSelectionModal';
import { Badge, EmptyState, Button } from '../../components/ui';

// 1. IMPORT STORE ZUSTAND
import { usePosStore } from '../../store/usePosStore';
// 2. IMPORT CONTEXT LAMA
import { useAppContext } from '../../context/AppContext';

// 3. DRAG & DROP REORDER TAB KATEGORI (pointer-based, jalan di touch & mouse)
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Tombol Tab Kategori yang sortable (drag reorder pakai dnd-kit) ───
// Kenapa dnd-kit: HTML5 native drag-and-drop (draggable=true + onDragStart/
// onDrop) itu API mouse-only, gak ada event touch-nya sama sekali di HP.
// dnd-kit's PointerSensor jalan di touch & mouse, jadi reorder-mode ini
// beneran bisa dipakai dari layar HP, bukan cuma pas di-test pake mouse.
function SortableCategoryTab({ cat, isActive, isReorderMode, onClick }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: cat, disabled: !isReorderMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // touch-action: none WAJIB pas lagi bisa di-drag, biar browser gak
        // rebutan sama dnd-kit buat interpretasiin gesture-nya. Di luar mode
        // reorder, dibiarin default (pan-x dari class hide-scrollbar) supaya
        // strip-nya tetep bisa di-scroll normal.
        touchAction: isReorderMode ? 'none' : undefined,
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...(isReorderMode ? attributes : {})}
            {...(isReorderMode ? listeners : {})}
            type="button"
            onClick={() => !isReorderMode && onClick(cat)}
            data-active={isActive}
            className={`
                shrink-0 rounded-2xl font-bold border transition-all duration-300
                whitespace-nowrap select-none flex items-center gap-2

                px-6 py-3.5 text-base md:px-5 md:py-2.5 md:text-sm

                ${isActive
                    ? 'bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white border-transparent shadow-[0_4px_16px_rgba(var(--color-accent-500),0.35)]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }
                ${isReorderMode
                    ? 'cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-700 border-dashed border-2 border-slate-400'
                    : 'cursor-pointer active:scale-95'
                }
                ${isDragging ? 'opacity-40 scale-95 shadow-inner' : 'opacity-100'}
            `}
        >
            {isReorderMode && <GripHorizontal className="w-5 h-5 md:w-4 md:h-4 text-slate-400" />}
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

    const [isReorderMode, setIsReorderMode] = useState(false);

    const categoryTabsRef = useRef(null);
    const [gridVisible, setGridVisible] = useState(true);

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

    // ─── Manajemen Urutan Kategori (Bisa di-drag) ──────────────────────────
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

    // Fungsi Reorder untuk Drag & Drop
    const handleReorderTab = useCallback((draggedId, overId) => {
        setTabs(prev => {
            const list = [...prev];
            const fromIdx = list.indexOf(draggedId);
            const toIdx = list.indexOf(overId);
            if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
            const [moved] = list.splice(fromIdx, 1);
            list.splice(toIdx, 0, moved);
            return list;
        });
    }, []);

    // dnd-kit: PointerSensor jalan di touch & mouse. distance:8 biar tap
    // biasa (buat pilih kategori) gak kepicu jadi drag secara gak sengaja.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over) return;
        handleReorderTab(active.id, over.id);
    }, [handleReorderTab]);

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
        if (q) return menus.filter(m => m.name.toLowerCase().includes(q));
        const base = selectedCategory === 'Favorit' ? favoriteMenus : menus;
        return base.filter(m =>
            selectedCategory === 'Favorit' ||
            selectedCategory === 'Semua' ||
            m.category === selectedCategory
        );
    }, [menus, favoriteMenus, selectedCategory, searchQuery]);

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
    }, [currentShift, triggerAlert, setCurrentView, setSelectedMenuForVariant, setVariantSelectedOptions, addToCart, variantGroups]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative">

            {!currentShift && (
                <Badge variant="danger" className="w-full justify-center py-2 text-xs font-bold gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Shift Kasir belum dibuka! Transaksi tidak masuk laporan Shift ini.
                </Badge>
            )}

            {/* ── Header sticky ──────────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm z-10 sticky top-0">

                {/* Search bar */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari menu pesanan..."
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all duration-300 text-sm font-medium"
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

                {/* Tab kategori (Draggable & Lebih Besar di HP) */}
                <div className="flex items-center gap-2 mt-3">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
                            <div ref={categoryTabsRef} className="flex-1 flex overflow-x-auto hide-scrollbar gap-2 p-1 snap-x">
                                {tabs.map((cat) => {
                                    const isActive = selectedCategory === cat && !isSearching;
                                    return (
                                        <SortableCategoryTab
                                            key={cat}
                                            cat={cat}
                                            isActive={isActive}
                                            isReorderMode={isReorderMode}
                                            onClick={handleCategoryClick}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Tombol toggle mode reorder (Ikut membesar di HP) */}
                    <button
                        onClick={() => setIsReorderMode(!isReorderMode)}
                        className={`rounded-2xl border transition-all duration-300 shrink-0 p-3.5 md:p-2.5 active:scale-95 ${isReorderMode
                            ? 'bg-gradient-to-br from-accent-600 to-accent-500 text-white border-transparent shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)]'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                    >
                        {isReorderMode ? <Check size={22} className="md:w-5 md:h-5" /> : <Settings2 size={22} className="md:w-5 md:h-5" />}
                    </button>
                </div>
            </div>

            {isSearching && (
                <div className="px-4 py-2 bg-accent-50 dark:bg-accent-500/10 border-b border-accent-100 dark:border-accent-500/20 flex items-center gap-2 text-xs text-accent-700 dark:text-accent-400 animate-in fade-in">
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span><span className="font-bold">{filteredMenus.length}</span> menu ditemukan untuk "{searchQuery}"</span>
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
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-accent-200 dark:hover:border-accent-500/30 active:scale-95 transition-all duration-300 relative overflow-hidden group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-accent-50 dark:from-accent-500/10 to-accent-100 dark:to-accent-500/15 rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300">
                                {menu.category === 'Minuman'
                                    ? <Coffee className="w-6 h-6 md:w-8 md:h-8 text-accent-600 dark:text-accent-400" />
                                    : <UtensilsCrossed className="w-6 h-6 md:w-8 md:h-8 text-accent-600 dark:text-accent-400" />
                                }
                            </div>
                            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs md:text-sm mb-1 leading-tight">
                                {menu.name}
                            </h3>
                            {isSearching && <Badge variant="neutral" className="mb-1">{menu.category}</Badge>}
                            <p className="text-accent-600 dark:text-accent-400 font-bold text-xs md:text-sm mt-auto">
                                {formatRupiah(menu.price)}
                            </p>
                            {menu.variantGroupIds.length > 0 && (
                                <div className="absolute top-2 right-2"><span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500 block" /></div>
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
            <div className="fixed bottom-20 right-6 z-50">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white rounded-2xl py-3 px-5 shadow-[0_10px_28px_rgba(var(--color-accent-500),0.4)] flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(var(--color-accent-500),0.45)] transition-all duration-300 active:scale-95"
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

            <CartDrawer />
            <PaymentModal />
            <VariantSelectionModal />
        </div>
    );
};

export default PosView;