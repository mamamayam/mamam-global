import React, { useState, useMemo } from 'react';
import { AppContext, useAppContext } from '../../context/AppContext';
import { usePersistState } from '../../hook/usePersistState';
import CategoryModal from '../../components/CategoryModal';
import { Button } from '../../components/ui';
import { INITIAL_RAW_MATERIALS } from '../../data/initialData';
import { computeAvailableMaterials } from '../../utils/hppUtils';

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

    // LIVE MATERIALS POOL (RAW + PREP) — sumber tunggalnya di
    // computeAvailableMaterials (hppUtils.js), dipakai bareng App.jsx.
    const availableMaterials = useMemo(
        () => computeAvailableMaterials(rawMaterials, semiFinished),
        [rawMaterials, semiFinished]
    );

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
                    
                    <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-8 overflow-x-auto hide-scrollbar shrink-0">
                        {[
                            { key: 'materials', label: 'Database Bahan Baku' },
                            { key: 'semi-finished', label: 'Bahan Setengah Jadi (Prep)' },
                            { key: 'calculator', label: editingRecipe ? '✏️ Edit Resep Menu' : 'Kalkulator HPP Final' },
                            { key: 'library', label: `Library Menu (${hppLibrary.length})` },
                        ].map(tab => (
                            <Button
                                key={tab.key}
                                variant={activeTab === tab.key ? 'primary' : 'secondary'}
                                onClick={() => setActiveTab(tab.key)}
                                className="whitespace-nowrap"
                            >
                                {tab.label}
                            </Button>
                        ))}
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