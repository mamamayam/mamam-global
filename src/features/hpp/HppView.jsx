import React, { useState, useMemo } from 'react';
import { AppContext, useAppContext } from '../../context/AppContext';
import { usePersistState } from '../../hook/usePersistState';
import CategoryModal from '../../components/CategoryModal';
import { Button, PageHeader } from '../../components/ui';
import { INITIAL_RAW_MATERIALS } from '../../data/initialData';

// Import Tabs
import BahanBakuView from './tabs/BahanBakuView';
import BahanSetengahJadiView from './tabs/BahanSetengahJadiView';
import KalkulatorHppView from './tabs/KalkulatorHppView';
import LibraryHppView from './tabs/LibraryHppView';

export default function HppView() {
    const [activeTab, setActiveTab] = useState('materials');

    // Ambil dari outer AppContext (App.jsx)
    const {
        categories,
        setCategories,
        menus,
        setMenus,
        hppLibrary: outerHppLibrary,
        setHppLibrary: setOuterHppLibrary,
        triggerAlert,
        triggerConfirm,
    } = useAppContext();

    // Database States
    const [rawMaterials, setRawMaterials] = usePersistState('rawMaterials', INITIAL_RAW_MATERIALS, { syncMode: 'config' });
    const [semiFinished, setSemiFinished] = usePersistState('semiFinished', [], { syncMode: 'config' });
    
    const hppLibrary = outerHppLibrary;
    const setHppLibrary = setOuterHppLibrary;
    const [editingRecipe, setEditingRecipe] = useState(null);

    // Modals
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // LIVE MATERIALS POOL (RAW + PREP)
    const availableMaterials = useMemo(() => {
        const prepsAsMaterials = semiFinished.map(prep => {
            const totalIngCost = prep.ingredients.reduce((sum, ing) => {
                const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
                const currentPrice = rm ? rm.price : (ing.snapshotPrice || 0);
                return sum + (currentPrice * ing.qtyUsedFraction);
            }, 0);

            const totalBatchCost = totalIngCost + (Number(prep.laborCost) || 0) + (Number(prep.overheadCost) || 0);
            const costPerUnit = totalBatchCost / Math.max(1, Number(prep.yieldQty) || 1);

            return {
                id: prep.id,
                name: `${prep.name} [Prep]`,
                unit: prep.resultUnit,
                price: costPerUnit,
                isPrep: true,
                lastUpdated: prep.lastUpdated || new Date()
            };
        });

        return [...rawMaterials, ...prepsAsMaterials];
    }, [rawMaterials, semiFinished]);

    const contextValue = {
        rawMaterials, setRawMaterials,
        semiFinished, setSemiFinished,
        availableMaterials,
        hppLibrary, setHppLibrary,
        categories, setCategories,
        isCategoryModalOpen, setIsCategoryModalOpen,
        editingRecipe, setEditingRecipe,
        activeTab, setActiveTab,
        triggerAlert, triggerConfirm
    };

    return (
        <AppContext.Provider value={contextValue}>
            <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-slate-950 font-body text-slate-800 dark:text-slate-100">
                <div className="flex-1 overflow-hidden relative flex flex-col p-4 md:p-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
                    
                    <PageHeader title="Kalkulator HPP Cerdas" />

                    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pt-2 pb-5 mb-8 overflow-x-auto hide-scrollbar shrink-0">
                        <Button variant={activeTab === 'materials' ? 'dark' : 'secondary'} onClick={() => setActiveTab('materials')}>
                            Database Bahan Baku
                        </Button>
                        <Button variant={activeTab === 'semi-finished' ? 'dark' : 'secondary'} onClick={() => setActiveTab('semi-finished')}>
                            Bahan Setengah Jadi (Prep)
                        </Button>
                        <Button variant={activeTab === 'calculator' ? 'dark' : 'secondary'} onClick={() => setActiveTab('calculator')}>
                            {editingRecipe ? '✏️ Edit Resep Menu' : 'Kalkulator HPP Final'}
                        </Button>
                        <Button variant={activeTab === 'library' ? 'dark' : 'secondary'} onClick={() => setActiveTab('library')}>
                            Library Menu ({hppLibrary.length})
                        </Button>
                    </div>

                    {activeTab === 'materials' && <BahanBakuView />}
                    {activeTab === 'semi-finished' && <BahanSetengahJadiView />}
                    {activeTab === 'calculator' && <KalkulatorHppView />}
                    {activeTab === 'library' && <LibraryHppView />}
                </div>

                <CategoryModal
                    isOpen={isCategoryModalOpen}
                    onClose={() => setIsCategoryModalOpen(false)}
                    title="Kelola Kategori Menu"
                    categories={categories}
                    setCategories={setCategories}
                    triggerAlert={triggerAlert}
                    triggerConfirm={triggerConfirm}
                    onRename={(oldCat, newCat) => {
                        const updatedLibrary = hppLibrary.map(recipe => recipe.category === oldCat ? { ...recipe, category: newCat } : recipe);
                        if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
                        if (menus && setMenus) {
                            const updatedMenus = menus.map(m => m.category === oldCat ? { ...m, category: newCat } : m);
                            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
                        }
                    }}
                    onDelete={(deletedCat) => {
                        const updatedLibrary = hppLibrary.map(recipe => recipe.category === deletedCat ? { ...recipe, category: 'Umum' } : recipe);
                        if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
                        if (menus && setMenus) {
                            const updatedMenus = menus.map(m => m.category === deletedCat ? { ...m, category: 'Umum' } : m);
                            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
                        }
                    }}
                />
            </div>
        </AppContext.Provider>
    );
}