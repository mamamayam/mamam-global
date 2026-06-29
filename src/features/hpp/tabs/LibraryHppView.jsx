import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { getIngredientCost } from '../../../utils/hppUtils';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, IconButton, PageHeader, EmptyState, Badge, SortModal } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { markDeleted, activeOnly } from '../../../utils/softDelete';
import { BookOpen, Search, X, Edit3, Trash2, TrendingDown, ArrowUpDown, Save } from 'lucide-react';

const LibraryHppView = () => {
    const { hppLibrary, setHppLibrary, availableMaterials, categories, triggerConfirm, triggerAlert } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('name-asc');
    const [isSortOpen, setIsSortOpen] = useState(false);

    // STATE UNTUK MODAL EDIT RECIPE
    const [editingRecipeLocal, setEditingRecipeLocal] = useState(null);
    const [editMargin, setEditMargin] = useState(35);
    const [editFinalPrice, setEditFinalPrice] = useState('');

    const sortOptions = [
        { key: 'name-asc', label: 'Nama Menu (A-Z)' },
        { key: 'name-desc', label: 'Nama Menu (Z-A)' },
        { key: 'price-desc', label: 'Harga Jual Tertinggi' },
        { key: 'price-asc', label: 'Harga Jual Terendah' },
        { key: 'margin-desc', label: 'Margin Terbesar' },
        { key: 'margin-asc', label: 'Margin Terkecil' },
    ];

    const handleDelete = (id) => {
        triggerConfirm('Yakin ingin memindahkan resep menu ini ke Recycle Bin?', () => {
            setHppLibrary(hppLibrary.map(item => item.id === id ? markDeleted(item) : item));
        });
    };

    const handleEdit = (recipe) => {
        setEditingRecipeLocal(recipe);
        setEditMargin(recipe.marginPercent || 35);
        setEditFinalPrice(String(recipe.finalPrice || ''));
    };

    // SAVE DARI DALAM MODAL
    const handleSaveEdit = () => {
        if (!editingRecipeLocal) return;
        
        // Hitung ulang berdasarkan input di Modal
        const liveIngredientCost = editingRecipeLocal.ingredients.reduce((sum, ing) => {
            const liveMaterial = availableMaterials.find(rm => rm.id === ing.rawMaterialId);
            const currentPrice = liveMaterial ? liveMaterial.price : ing.snapshotPrice;
            return sum + (currentPrice * ing.qtyUsed);
        }, 0);

        const materialCostPerUnit = editingRecipeLocal.yieldQty > 0 ? (liveIngredientCost / editingRecipeLocal.yieldQty) : 0;
        const totalHpp = materialCostPerUnit + (editingRecipeLocal.laborCost || 0) + (editingRecipeLocal.overheadCost || 0);
        
        const recommendedPrice = totalHpp > 0 ? totalHpp / (1 - (editMargin / 100)) : 0;
        const roundedRecommendedPrice = Math.ceil(recommendedPrice / 100) * 100;
        const finalPriceValue = editFinalPrice !== '' ? Number(editFinalPrice) : roundedRecommendedPrice;

        const updatedRecipe = {
            ...editingRecipeLocal,
            marginPercent: editMargin,
            suggestedPrice: roundedRecommendedPrice,
            finalPrice: finalPriceValue,
            date: new Date()
        };

        setHppLibrary(hppLibrary.map(item => item.id === editingRecipeLocal.id ? updatedRecipe : item));
        triggerAlert(`Resep "${updatedRecipe.name}" berhasil diperbarui!`);
        setEditingRecipeLocal(null);
    };

    const activeLibrary = activeOnly(hppLibrary);

    const libraryWithLiveCalc = useMemo(() => {
        const enriched = activeLibrary.map(recipe => {
            const liveIngredientCost = recipe.ingredients.reduce((sum, ing) => {
                const liveMaterial = availableMaterials.find(rm => rm.id === ing.rawMaterialId);
                const currentPrice = liveMaterial ? liveMaterial.price : ing.snapshotPrice;
                return sum + (currentPrice * ing.qtyUsed);
            }, 0);

            const liveMaterialPerUnit = recipe.yieldQty > 0 ? (liveIngredientCost / recipe.yieldQty) : 0;
            const liveHpp = liveMaterialPerUnit + (recipe.laborCost || 0) + (recipe.overheadCost || 0);

            const actualMarginValue = recipe.finalPrice - liveHpp;
            const actualMarginPercent = recipe.finalPrice > 0 ? (actualMarginValue / recipe.finalPrice) * 100 : 0;

            return { ...recipe, liveHpp, actualMarginPercent };
        });

        const groups = {};
        categories.forEach(cat => groups[cat] = []);
        groups['Uncategorized'] = [];

        enriched.forEach(item => {
            if (groups[item.category]) groups[item.category].push(item);
            else groups['Uncategorized'].push(item);
        });

        return groups;
    }, [activeLibrary, availableMaterials, categories]);


    // Hitungan Real-time untuk MODAL
    let modalLiveHpp = 0;
    let modalRecommendedPrice = 0;
    let modalActualProfit = 0;
    let modalActualProfitPercent = 0;

    if (editingRecipeLocal) {
        const liveIngredientCost = editingRecipeLocal.ingredients.reduce((sum, ing) => {
            const liveMaterial = availableMaterials.find(rm => rm.id === ing.rawMaterialId);
            const currentPrice = liveMaterial ? liveMaterial.price : ing.snapshotPrice;
            return sum + (currentPrice * ing.qtyUsed);
        }, 0);
        const materialCostPerUnit = editingRecipeLocal.yieldQty > 0 ? (liveIngredientCost / editingRecipeLocal.yieldQty) : 0;
        modalLiveHpp = materialCostPerUnit + (editingRecipeLocal.laborCost || 0) + (editingRecipeLocal.overheadCost || 0);
        
        modalRecommendedPrice = modalLiveHpp > 0 ? Math.ceil((modalLiveHpp / (1 - (editMargin / 100))) / 100) * 100 : 0;
        const currentFinalPrice = editFinalPrice !== '' ? Number(editFinalPrice) : modalRecommendedPrice;
        
        modalActualProfit = currentFinalPrice - modalLiveHpp;
        modalActualProfitPercent = currentFinalPrice > 0 ? (modalActualProfit / currentFinalPrice) * 100 : 0;
    }


    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out relative">
            <PageHeader
                title="Katalog Library Menu (Final)"
                subtitle="Daftar menu dengan total HPP terhitung otomatis berdasarkan harga bahan baku pasar & bahan setengah jadi terbaru."
                icon={<BookOpen className="w-6 h-6 text-accent-600 dark:text-accent-400" />}
                className="border-b border-slate-200 dark:border-slate-700 pb-5"
            />

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Cari menu..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsSortOpen(true)}
                    className="w-full sm:w-48 flex items-center justify-between gap-2 pl-4 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 transition-colors text-sm bg-white dark:bg-slate-900"
                >
                    <span className="truncate">{sortOptions.find(o => o.key === sortKey)?.label || 'Urutkan'}</span>
                    <ArrowUpDown className="text-slate-400 w-4 h-4 shrink-0" />
                </button>
            </div>

            {activeLibrary.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm p-12 py-24 animate-in zoom-in-95 duration-300">
                    <EmptyState icon={<BookOpen className="w-16 h-16" />} title="Belum ada resep / menu final yang disimpan ke Library." />
                </div>
            ) : (
                <div className="space-y-10">
                    {[...categories, 'Uncategorized'].map(category => {
                        const items = (libraryWithLiveCalc[category] || []).filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
                        if (!items || items.length === 0) return null;

                        const sortedItems = applySort(items, sortKey, {
                            name: i => i.name || '',
                            price: i => i.finalPrice || 0,
                            margin: i => i.actualMarginPercent || 0,
                        });

                        return (
                            <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{category}</span>
                                    <Badge variant="neutral" size="md">{items.length} Menu</Badge>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1 ml-2"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {sortedItems.map(item => {
                                        const isMarginDanger = item.actualMarginPercent < (item.marginPercent / 2);
                                        return (
                                            <Card key={item.id} padding="lg" className="relative group hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <Badge variant="neutral" size="sm">Yield: {item.yieldQty} Porsi</Badge>
                                                        <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                            <IconButton variant="edit" size="sm" onClick={() => handleEdit(item)}><Edit3 className="w-4 h-4" /></IconButton>
                                                            <IconButton variant="delete" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></IconButton>
                                                        </div>
                                                    </div>

                                                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight mb-4 group-hover:text-accent-600 transition-colors">{item.name}</h4>

                                                    <div className="space-y-3 mb-5">
                                                        <Card variant="muted" padding="sm" className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-500 font-bold">HPP Aktual</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-100">{formatRupiah(item.liveHpp)}</span>
                                                        </Card>

                                                        <div className="flex justify-between items-end text-sm p-1">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Harga Jual</span>
                                                                <span className="font-black text-accent-600 text-base">{formatRupiah(item.finalPrice)}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Margin Aktual</span>
                                                                <span className={`font-black text-sm px-2 py-1 rounded-md ${isMarginDanger ? 'bg-accent-100 text-accent-600' : 'bg-green-100 text-green-700'}`}>
                                                                    {item.actualMarginPercent.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isMarginDanger && (
                                                    <div className="mt-2 pt-3 border-t border-red-100 flex items-start gap-2 text-accent-600">
                                                        <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <p className="text-[11px] font-bold leading-relaxed">Margin kritis! Periksa harga bahan baku / prep Anda.</p>
                                                    </div>
                                                )}
                                            </Card>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <SortModal isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} value={sortKey} onChange={setSortKey} options={sortOptions} />

            {/* MODAL EDIT RECIPE DARI LIBRARY */}
            {editingRecipeLocal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <div>
                                <h3 className="font-heading font-black text-lg text-white">Edit Margin & Harga Final</h3>
                                <p className="text-xs text-slate-400 mt-1">{editingRecipeLocal.name}</p>
                            </div>
                            <IconButton variant="neutral" className="rounded-full text-white hover:bg-slate-800" onClick={() => setEditingRecipeLocal(null)}>
                                <X className="w-5 h-5" />
                            </IconButton>
                        </div>

                        <div className="p-5 space-y-6 overflow-y-auto">
                            {/* LIVE HPP INFO */}
                            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">HPP Live Per Porsi</span>
                                <span className="text-xl font-black text-accent-400">{formatRupiah(modalLiveHpp)}</span>
                            </div>

                            {/* ADJUST MARGIN */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-300">Target Profit Margin (%)</span>
                                    <span className="font-black text-accent-400 text-base bg-accent-950/50 px-3 py-1 rounded-lg border border-orange-500/50">{editMargin}%</span>
                                </div>
                                <input type="range" min="5" max="95" className="w-full accent-orange-600 cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none" value={editMargin} onChange={e => setEditMargin(Number(e.target.value))} />
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {[20, 35, 50, 70].map(m => <button key={m} onClick={() => setEditMargin(m)} className={`py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${editMargin === m ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{m}%</button>)}
                                </div>
                            </div>

                            {/* REKOMENDASI & HARGA FINAL */}
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <div className="flex justify-between text-sm text-slate-400">
                                    <span>Rekomendasi Harga:</span>
                                    <span className="font-bold text-white">{formatRupiah(modalRecommendedPrice)}</span>
                                </div>
                                <label className="block text-xs font-bold text-slate-300 uppercase mt-4">Tentukan Harga Jual Final</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rp</span>
                                    <input type="number" className="w-full p-4 pl-12 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-orange-500 text-base font-bold text-white transition-all shadow-inner" value={editFinalPrice} onChange={e => setEditFinalPrice(e.target.value)} placeholder={String(modalRecommendedPrice)} />
                                </div>
                            </div>

                            {/* ANALISA PROFIT AKTUAL */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 mt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Estimasi Laba / Porsi:</span>
                                    <span className={`font-black ${modalActualProfit >= 0 ? 'text-green-400' : 'text-accent-400'}`}>{formatRupiah(modalActualProfit)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Margin Aktual:</span>
                                    <span className={`font-black ${modalActualProfitPercent >= 0 ? 'text-green-400' : 'text-accent-400'}`}>{modalActualProfitPercent.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setEditingRecipeLocal(null)}>Batal</Button>
                            <Button variant="success" icon={<Save className="w-4 h-4" />} onClick={handleSaveEdit}>Simpan Perubahan</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryHppView;