import React from "react";
import { useAppContext } from '../../context/AppContext';
import { X, CheckCircle2 } from 'lucide-react';

const VariantSelectionModal = () => {
  const { selectedMenuForVariant, setSelectedMenuForVariant, variantGroups, formatRupiah, addToCart, variantSelectedOptions, setVariantSelectedOptions } = useAppContext();

  if (!selectedMenuForVariant) return null;
  const menuVariants = variantGroups.filter(vg => selectedMenuForVariant.variantGroupIds.includes(vg.id));

  const handleToggleOption = (groupId, optionId, maxSelection) => {
    setVariantSelectedOptions(prev => {
      const currentGroupSelections = prev[groupId] || [];
      if (currentGroupSelections.includes(optionId)) return { ...prev, [groupId]: currentGroupSelections.filter(id => id !== optionId) };
      else {
        if (maxSelection === 1) return { ...prev, [groupId]: [optionId] };
        else if (currentGroupSelections.length < maxSelection) return { ...prev, [groupId]: [...currentGroupSelections, optionId] };
        else return prev;
      }
    });
  };

  const isSelectionValid = menuVariants.every(vg => {
    if (vg.isRequired) return (variantSelectedOptions[vg.id] || []).length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white dark:bg-slate-900 w-full md:w-[450px] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300 ease-out max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div>
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">{selectedMenuForVariant.name}</h3>
            <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatRupiah(selectedMenuForVariant.price)}</p>
          </div>
          <button onClick={() => setSelectedMenuForVariant(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50 dark:bg-slate-950/50">
          {menuVariants.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4">Tidak ada variasi untuk menu ini.</p>}

          {menuVariants.map(vg => {
            const currentSelections = variantSelectedOptions[vg.id] || [];
            const isMaxReached = currentSelections.length >= vg.maxSelection;

            return (
              <div key={vg.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">{vg.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih maksimal {vg.maxSelection}</p>
                  </div>
                  {vg.isRequired ? <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md uppercase tracking-wider">Wajib</span> : <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md uppercase tracking-wider">Opsional</span>}
                </div>
                <div className="p-2">
                  {vg.options.map(opt => {
                    const isSelected = currentSelections.includes(opt.id);
                    const isDisabled = !isSelected && isMaxReached;
                    return (
                      <label key={opt.id} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-950 border border-transparent'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-orange-600 dark:bg-orange-500 border-orange-600 dark:border-orange-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white animate-in zoom-in" />}
                          </div>
                          <span className={`font-semibold text-sm ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200'}`}>{opt.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{opt.extraPrice > 0 ? `+${formatRupiah(opt.extraPrice)}` : 'Gratis'}</span>
                        <input type="checkbox" className="hidden" checked={isSelected} disabled={isDisabled} onChange={() => handleToggleOption(vg.id, opt.id, vg.maxSelection)} />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button onClick={() => isSelectionValid && addToCart(selectedMenuForVariant, variantSelectedOptions)} disabled={!isSelectionValid} className="w-full py-3.5 rounded-xl bg-orange-600 dark:bg-orange-500 text-white font-bold disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-lg transition-all duration-300">
            {isSelectionValid ? 'Tambah ke Keranjang' : 'Lengkapi Pilihan Wajib'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VariantSelectionModal;