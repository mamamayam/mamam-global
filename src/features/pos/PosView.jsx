import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { GripHorizontal, Search, Coffee, UtensilsCrossed, ShoppingCart, AlertCircle, Package, Star, X, ChevronLeft, ChevronRight, Settings2, Check } from 'lucide-react';
import CartDrawer from '../pos/CartDrawer';
import PaymentModal from './PaymentModal';
import VariantSelectionModal from './VariantSelectionModal';
import { Badge, EmptyState, Button } from '../../components/ui';

// 1. IMPORT STORE ZUSTAND
import { usePosStore } from '../../store/usePosStore';
// 2. IMPORT CONTEXT LAMA
import { useAppContext } from '../../context/AppContext';

// ─── Hook drag & drop reorder HORIZONTAL (Khusus Tab Kategori) ───
function useHorizontalDragReorder(onReorder) {
    const [dragId, setDragId] = useState(null);
    const [overId, setOverId] = useState(null);
    const overIdRef = useRef(null);
    const itemRefs = useRef({});

    const registerRef = useCallback((id) => (el) => {
        if (el) itemRefs.current[id] = el;
        else delete itemRefs.current[id];
    }, []);

    const startDrag = useCallback((id) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { e.target.setPointerCapture?.(e.pointerId); } catch (_) { }
        overIdRef.current = id;
        setDragId(id);
        setOverId(id);
    }, []);

    useEffect(() => {
        if (dragId === null) return;
        const getX = (e) => (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);

        const handleMove = (e) => {
            const x = getX(e);
            if (x == null) return;
            let closestId = null;
            let closestDist = Infinity;
            Object.entries(itemRefs.current).forEach(([id, el]) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                // Hitung titik tengah elemen secara horizontal
                const mid = rect.left + rect.width / 2;
                const dist = Math.abs(x - mid);
                if (dist < closestDist) { closestDist = dist; closestId = id; }
            });
            if (closestId !== null && closestId !== overIdRef.current) {
                overIdRef.current = closestId;
                setOverId(closestId);
            }
        };

        const finishDrag = () => {
            const finalOverId = overIdRef.current;
            if (dragId !== null && finalOverId !== null && dragId !== finalOverId) {
                onReorder(dragId, finalOverId);
            }
            setDragId(null);
            setOverId(null);
            overIdRef.current = null;
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', finishDrag);
        };
    }, [dragId, onReorder]);

    return { dragId, overId, registerRef, startDrag };
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

    const [draggedIdx, setDraggedIdx] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // Wajib agar bisa di-drop
    };

    const handleDrop = (e, index) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;

        const newTabs = [...tabs];
        const draggedItem = newTabs[draggedIdx];

        newTabs.splice(draggedIdx, 1);
        newTabs.splice(index, 0, draggedItem);

        setTabs(newTabs);
        setDraggedIdx(null);
    };

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

    const moveTab = (index, direction) => {
        const newTabs = [...tabs];
        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < newTabs.length) {
            [newTabs[index], newTabs[newIndex]] = [newTabs[newIndex], newTabs[index]];
            setTabs(newTabs);
        }
    };

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

    const tabDrag = useHorizontalDragReorder(handleReorderTab);

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
                    <div ref={categoryTabsRef} className="flex-1 flex overflow-x-auto hide-scrollbar gap-2 p-1 snap-x">
                        {tabs.map((cat, idx) => {
                            const isActive = selectedCategory === cat && !isSearching;
                            const isDragging = draggedIdx === idx;

                            return (
                                <button
                                    key={cat}
                                    draggable={isReorderMode}
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onDragEnd={() => setDraggedIdx(null)}
                                    onClick={() => !isReorderMode && handleCategoryClick(cat)}
                                    className={`
                        shrink-0 rounded-full font-bold border transition-all 
                        whitespace-nowrap select-none flex items-center gap-2
                        
                        {/* UTAMA: Ukuran besar di HP, normal di PC */}
                        px-6 py-3.5 text-base md:px-5 md:py-2.5 md:text-sm
                        
                        ${isActive
                                            ? 'bg-orange-600 text-white border-transparent shadow-md'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                                        } 
                        ${isReorderMode
                                            ? 'cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-700 border-dashed border-2 border-slate-400'
                                            : 'cursor-pointer'
                                        }
                        ${isDragging ? 'opacity-40 scale-95 shadow-inner' : 'opacity-100'}
                    `}
                                >
                                    {isReorderMode && <GripHorizontal className="w-5 h-5 md:w-4 md:h-4 text-slate-400" />}
                                    {cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tombol toggle mode reorder (Ikut membesar di HP) */}
                    <button
                        onClick={() => setIsReorderMode(!isReorderMode)}
                        className={`rounded-xl border transition-colors shrink-0 p-3.5 md:p-2.5 ${isReorderMode
                            ? 'bg-accent-600 text-white border-accent-600'
                            : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600'
                            }`}
                    >
                        {isReorderMode ? <Check size={22} className="md:w-5 md:h-5" /> : <Settings2 size={22} className="md:w-5 md:h-5" />}
                    </button>
                </div>
            </div>

            {isSearching && (
                <div className="px-4 py-2 bg-accent-50 border-b border-orange-100 flex items-center gap-2 text-xs text-accent-700 animate-in fade-in">
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
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/30 active:scale-95 transition-all duration-300 relative overflow-hidden group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-50 dark:from-orange-500/10 to-orange-100 dark:to-orange-500/15 rounded-full flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300">
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
                                <div className="absolute top-2 right-2"><span className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500 block" /></div>
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
                    className="bg-slate-800 text-white rounded-full py-3 px-5 shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-3 hover:bg-slate-900 transition-all active:scale-95 border border-slate-700 dark:border-slate-300"
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-2.5 -right-2.5 bg-accent-600 dark:bg-accent-500 text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center border-2 border-slate-800 dark:border-slate-100 animate-in zoom-in duration-300">
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