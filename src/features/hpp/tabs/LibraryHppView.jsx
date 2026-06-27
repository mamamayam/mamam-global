import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, IconButton, PageHeader, EmptyState, Badge } from '../../../components/ui';
import { BookOpen, Search, X, Edit3, Trash2, TrendingDown } from 'lucide-react';

const LibraryHppView = () => {
    const { hppLibrary, setHppLibrary, availableMaterials, categories, triggerConfirm, setEditingRecipe, setActiveTab } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');

    const handleDelete = (id) => {
        triggerConfirm('Yakin ingin menghapus resep menu ini dari Library?', () => {
            setHppLibrary(hppLibrary.filter(item => item.id !== id));
        });
    };

    const handleEdit = (recipe) => {
        setEditingRecipe(recipe);
        setActiveTab('calculator');
    };

    const libraryWithLiveCalc = useMemo(() => {
        const enriched = hppLibrary.map(recipe => {
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
    }, [hppLibrary, availableMaterials, categories]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <PageHeader
                title="Katalog Library Menu (Final)"
                subtitle="Daftar menu dengan total HPP terhitung otomatis berdasarkan harga bahan baku pasar & bahan setengah jadi terbaru."
                icon={<BookOpen className="w-6 h-6 text-accent-600 dark:text-accent-400" />}
                className="border-b border-slate-200 dark:border-slate-700 pb-5"
            />

            {/* Input Pencarian */}
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Cari menu..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 transition-all text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        aria-label="Hapus pencarian"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {hppLibrary.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm p-12 py-24 animate-in zoom-in-95 duration-300">
                    <EmptyState
                        icon={<BookOpen className="w-16 h-16" />}
                        title="Belum ada resep / menu final yang disimpan ke Library."
                    />
                </div>
            ) : (
                <div className="space-y-10">
                    {[...categories, 'Uncategorized'].map(category => {
                        const items = (libraryWithLiveCalc[category] || []).filter(item =>
                            item.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        if (!items || items.length === 0) return null;

                        return (
                            <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{category}</span>
                                    <Badge variant="neutral" size="md">{items.length} Menu</Badge>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1 ml-2"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {items.map(item => {
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

                                                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight mb-4 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">{item.name}</h4>

                                                    <div className="space-y-3 mb-5">
                                                        <Card variant="muted" padding="sm" className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-500 dark:text-slate-400 font-bold">HPP Aktual</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-100">{formatRupiah(item.liveHpp)}</span>
                                                        </Card>

                                                        <div className="flex justify-between items-end text-sm p-1">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Harga Jual</span>
                                                                <span className="font-black text-accent-600 dark:text-accent-400 text-base">{formatRupiah(item.finalPrice)}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Margin Saat Ini</span>
                                                                <span className={`font-black text-sm px-2 py-1 rounded-md ${isMarginDanger ? 'bg-accent-100 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400' : 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'}`}>
                                                                    {item.actualMarginPercent.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isMarginDanger && (
                                                    <div className="mt-2 pt-3 border-t border-red-100 dark:border-red-500/20 flex items-start gap-2 text-accent-600 dark:text-accent-400">
                                                        <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <p className="text-[11px] font-bold leading-relaxed">Margin kritis! Periksa kembali harga bahan baku / prep Anda.</p>
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
        </div>
    );
};

export default LibraryHppView;