import React, { useState, useMemo } from "react";
import { useAppContext } from "../../context/AppContext"; 

// Asumsi menggunakan library lucide-react atau react-feather untuk ikon
import { ChevronLeft, Plus, Edit3, Trash2, Settings2 } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";

const VariantManagement = () => {
  const { variantGroups, setVariantGroups, variantCategories, setVariantCategories, menus, setMenus, triggerAlert, triggerConfirm, formatRupiah } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', category: variantCategories[0] || 'Lainnya', isRequired: false, maxSelection: 1, options: [] });
  const [newOption, setNewOption] = useState({ name: '', extraPrice: '' });

  const handleSave = () => {
    if (formData.options.length === 0) { triggerAlert("Tambahkan minimal 1 opsi varian."); return; }
    if (formData.id) setVariantGroups(variantGroups.map(vg => vg.id === formData.id ? formData : vg));
    else setVariantGroups([...variantGroups, { ...formData, id: `vg${Date.now()}` }]);
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    setVariantGroups(variantGroups.filter(vg => vg.id !== id));
    setMenus(menus.map(m => ({ ...m, variantGroupIds: m.variantGroupIds.filter(vid => vid !== id) })));
  };

  const handleAddOption = () => {
    if (!newOption.name) return;
    setFormData({ ...formData, options: [...formData.options, { id: `opt${Date.now()}`, name: newOption.name, extraPrice: Number(newOption.extraPrice) || 0 }] });
    setNewOption({ name: '', extraPrice: '' });
  };

  const handleRemoveOption = (optId) => setFormData({ ...formData, options: formData.options.filter(o => o.id !== optId) });

  const groupedVariantGroups = useMemo(() => {
    const groups = {};
    variantGroups.forEach(vg => {
      const cat = vg.category || 'Umum';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(vg);
    });
    return groups;
  }, [variantGroups]);

  if (isEditing) {
    return (
      /* PERBAIKAN 1: Container utama diubah menjadi flex flex-col tanpa padding */
      <div className="bg-white dark:bg-slate-900 flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300 ease-out">
        
        /* PERBAIKAN 2: Area form ini yang akan menampung scroll */
        <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => setIsEditing(false)} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors">
            <ChevronLeft className="w-5 h-5" /> Kembali
          </button>
          <h2 className="font-heading text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">{formData.id ? 'Edit Kategori Varian' : 'Tambah Kategori Varian'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl pb-10">
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Pengaturan Kategori</h3>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Kategori Varian</label>
                <input type="text" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Topping, Level Pedas" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">Kelompok</label>
                  <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                    <Settings2 className="w-3.5 h-3.5" /> Kelola Kelompok
                  </button>
                </div>
                <select className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none bg-white dark:bg-slate-900 transition-colors" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {variantCategories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                  {!variantCategories.includes(formData.category) && formData.category && <option value={formData.category}>{formData.category}</option>}
                </select>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Untuk mengelompokkan tampilan daftar kategori varian di bawah.</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <input type="checkbox" id="isRequired" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.isRequired} onChange={e => setFormData({ ...formData, isRequired: e.target.checked })} />
                <label htmlFor="isRequired" className="font-bold text-sm text-slate-700 dark:text-slate-200 cursor-pointer flex-1">Wajib Dipilih (Required)</label>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Maksimal Pilihan Diizinkan</label>
                <input type="number" min="1" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none transition-colors" value={formData.maxSelection} onChange={e => setFormData({ ...formData, maxSelection: Math.max(1, Number(e.target.value)) })} />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Isi 1 jika hanya boleh pilih salah satu (Radio Button).</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Daftar Pilihan (Opsi)</h3>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Nama Opsi" className="p-2 border rounded-lg text-sm outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={newOption.name} onChange={e => setNewOption({ ...newOption, name: e.target.value })} />
                  <input type="number" placeholder="Harga (+)" className="p-2 border rounded-lg text-sm outline-none focus:border-orange-600 dark:focus:border-orange-500 transition-colors" value={newOption.extraPrice} onChange={e => setNewOption({ ...newOption, extraPrice: e.target.value })} />
                </div>
                <button onClick={handleAddOption} className="w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Tambah Opsi</button>
              </div>

              <div className="space-y-2">
                {formData.options.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 italic">Belum ada opsi ditambahkan.</p>}
                {formData.options.map(opt => (
                  <div key={opt.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl animate-in fade-in slide-in-from-left-2 duration-300">
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{opt.name}</p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">+{formatRupiah(opt.extraPrice)}</p>
                    </div>
                    <button onClick={() => handleRemoveOption(opt.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        /* PERBAIKAN 3: Tombol ditempatkan sebagai balok tersendiri di posisi paling bawah */
        <div className="p-4 md:px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shrink-0 flex justify-end z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button onClick={handleSave} className="w-full md:w-auto px-8 py-3 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            {formData.id ? 'Simpan Perubahan' : 'Simpan Kategori Varian'}
          </button>
        </div>

        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Kelola Kelompok Varian"
          categories={variantCategories}
          setCategories={setVariantCategories}
          triggerAlert={triggerAlert}
          triggerConfirm={triggerConfirm}
          onRename={(oldCat, newCat) => {
            const updated = variantGroups.map(vg => vg.category === oldCat ? { ...vg, category: newCat } : vg);
            if (JSON.stringify(updated) !== JSON.stringify(variantGroups)) setVariantGroups(updated);
            if (formData.category === oldCat) setFormData(prev => ({ ...prev, category: newCat }));
          }}
          onDelete={(deletedCat) => {
            const updated = variantGroups.map(vg => vg.category === deletedCat ? { ...vg, category: 'Umum' } : vg);
            if (JSON.stringify(updated) !== JSON.stringify(variantGroups)) setVariantGroups(updated);
            if (formData.category === deletedCat) setFormData(prev => ({ ...prev, category: 'Umum' }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Library Varian</h2>
        <button onClick={() => { setFormData({ id: '', name: '', category: variantCategories[0] || 'Lainnya', isRequired: false, maxSelection: 1, options: [] }); setIsEditing(true); }} className="bg-orange-600 dark:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-md transition-all duration-300">
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <div className="space-y-8">
        {Object.keys(groupedVariantGroups).map(cat => (
          <div key={cat} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{cat}</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">{groupedVariantGroups[cat].length} Item</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedVariantGroups[cat].map((vg) => (
                <div key={vg.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 relative hover:shadow-md transition-shadow duration-300 group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{vg.name}</h4>
                      <div className="flex gap-2 mt-1">
                        {vg.isRequired ? <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded">WAJIB</span> : <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">OPSIONAL</span>}
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">MAX: {vg.maxSelection}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button onClick={() => { setFormData(vg); setIsEditing(true); }} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(vg.id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase">Daftar Opsi ({vg.options.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {vg.options.map(opt => (
                        <div key={opt.id} className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md flex gap-2 items-center hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{opt.name}</span><span className="text-slate-400 dark:text-slate-500">|</span><span className="font-bold text-slate-500 dark:text-slate-400">+{opt.extraPrice}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {variantGroups.length === 0 && <div className="p-8 text-center text-slate-400 dark:text-slate-500 animate-in fade-in">Belum ada data varian</div>}
      </div>
    </div>
  );
};

export default VariantManagement;