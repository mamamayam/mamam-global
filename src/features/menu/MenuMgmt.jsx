import React, { useState, useMemo } from "react";
import { useAppContext } from "../../context/AppContext";
import { ChevronLeft, Plus, Edit3, Trash2, Settings2 } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";

const MenuManagement = () => {
  const { menus, setMenus, variantGroups, formatRupiah, triggerAlert, triggerConfirm, categories, setCategories, hppLibrary, setHppLibrary } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: [] });

  const handleSave = () => {
    if (!formData.name || formData.price === '' || formData.price < 0) {
      triggerAlert("Nama dan harga menu harus diisi dengan benar.");
      return;
    }

    const dataToSave = {
      ...formData,
      price: Number(formData.price),
      hpp: Number(formData.hpp || 0)
    };

    if (formData.id) {
      setMenus(menus.map(m => m.id === formData.id ? dataToSave : m));
    } else {
      setMenus([...menus, { ...dataToSave, id: `m${Date.now()}` }]);
    }
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Yakin ingin menghapus menu ini?")) {
      setMenus(menus.filter(m => m.id !== id));
    }
  };

  const toggleVariantGroup = (vgId) => {
    setFormData(prev => {
      const has = prev.variantGroupIds.includes(vgId);
      return { ...prev, variantGroupIds: has ? prev.variantGroupIds.filter(id => id !== vgId) : [...prev.variantGroupIds, vgId] };
    });
  };

  const groupedMenus = useMemo(() => {
    const groups = {};
    menus.forEach(menu => {
      if (!groups[menu.category]) groups[menu.category] = [];
      groups[menu.category].push(menu);
    });
    return groups;
  }, [menus]);

  if (isEditing) {
    return (
      <div className="p-4 md:p-6 bg-white dark:bg-slate-900 flex-1 animate-in fade-in slide-in-from-right-4 duration-300 h-full overflow-y-auto ease-out">
        <button onClick={() => setIsEditing(false)} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors">
          <ChevronLeft className="w-5 h-5" /> Kembali
        </button>
        <h2 className="font-heading text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
          {formData.id ? 'Edit Menu' : 'Tambah Menu Baru'}
        </h2>

        {/* Hapus pb-20 karena tombol fix di bawah sudah dihilangkan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Informasi Dasar</h3>
            <div>
              <label htmlFor="menuName" className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Menu</label>
              <input id="menuName" type="text" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Lumpia Semarang" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="menuCategory" className="block text-sm font-bold text-slate-600 dark:text-slate-300">Kategori</label>
                <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                  <Settings2 className="w-3.5 h-3.5" /> Kelola Kategori
                </button>
              </div>
              <select id="menuCategory" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none bg-white dark:bg-slate-900 transition-colors" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                {!categories.includes(formData.category) && formData.category && <option value={formData.category}>{formData.category}</option>}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="menuPrice" className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1" >Harga Jual (Rp)</label>
                <input id="menuPrice" type="number" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none transition-colors" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value === '' ? '' : Number(e.target.value) })} placeholder='0' />
              </div>
              <div>
                <label htmlFor="menuHpp" className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">HPP / Modal (Rp)</label>
                <input id="menuHpp" type="number" className="w-full p-3 border rounded-xl focus:border-orange-600 dark:focus:border-orange-500 outline-none transition-colors" value={formData.hpp} onChange={e => setFormData({ ...formData, hpp: e.target.value === '' ? '' : Number(e.target.value) })} placeholder='0' />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Varian Terkait</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Pilih kategori varian yang berlaku untuk menu ini.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {variantGroups.length === 0 ? (
                <p className="text-sm italic text-slate-400 dark:text-slate-500">Belum ada grup varian. Tambahkan di menu Library Varian.</p>
              ) : (
                variantGroups.map(vg => (
                  <label key={vg.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${formData.variantGroupIds.includes(vg.id) ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <input type="checkbox" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.variantGroupIds.includes(vg.id)} onChange={() => toggleVariantGroup(vg.id)} />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{vg.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{vg.options.map(o => o.name).join(', ')}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PERBAIKAN TOMBOL: Diletakkan di dalam flow normal (bukan fixed) agar pasti terlihat */}
        <div className="max-w-4xl mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button onClick={handleSave} className="w-full md:w-auto px-8 py-3 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            {/* Teks otomatis menyesuaikan aksi */}
            {formData.id ? 'Simpan Perubahan' : 'Tambah Menu'}
          </button>
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
            // Update kategori di semua menu yang memakainya
            const updatedMenus = menus.map(m => m.category === oldCat ? { ...m, category: newCat } : m);
            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
            // Form yang sedang dibuka juga ikut diupdate
            if (formData.category === oldCat) setFormData(prev => ({ ...prev, category: newCat }));

            // Kategori ini dipakai bersama HPP Library juga
            const updatedLibrary = hppLibrary.map(recipe => recipe.category === oldCat ? { ...recipe, category: newCat } : recipe);
            if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
          }}
          onDelete={(deletedCat) => {
            // Menu yang pakai kategori terhapus dipindah ke "Umum"
            const updatedMenus = menus.map(m => m.category === deletedCat ? { ...m, category: 'Umum' } : m);
            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
            if (formData.category === deletedCat) setFormData(prev => ({ ...prev, category: 'Umum' }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Manajemen Menu</h2>
        <button onClick={() => { setFormData({ id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: [] }); setIsEditing(true); }} className="bg-orange-600 dark:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-orange-700 dark:hover:bg-orange-600 hover:-translate-y-0.5 transition-all duration-300">
          <Plus className="w-4 h-4" /> Tambah Data Menu
        </button>
      </div>

      <div className="space-y-8 pb-10">
        {Object.keys(groupedMenus).map(category => (
          <div key={category} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{category}</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">{groupedMenus[category].length} Item</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedMenus[category].map((menu) => (
                <div key={menu.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 flex flex-col relative group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 uppercase">{menu.category}</span>
                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button onClick={() => { setFormData(menu); setIsEditing(true); }} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(menu.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base leading-tight mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{menu.name}</h3>
                  <p className="text-orange-600 dark:text-orange-400 font-bold mb-3">{formatRupiah(menu.price)}</p>

                  <div className="mt-auto pt-3 border-t border-slate-50 dark:border-slate-900">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">VARIAN TERKAIT:</p>
                    <div className="flex flex-wrap gap-1">
                      {menu.variantGroupIds.length === 0 ? <span className="text-[10px] text-gray-400 dark:text-slate-500 italic">Tidak ada varian</span> : (
                        menu.variantGroupIds.map(vid => {
                          const vg = variantGroups.find(v => v.id === vid);
                          return vg ? <span key={vid} className="text-[10px] bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-500/20 transition-colors hover:bg-orange-100 dark:hover:bg-orange-500/15">{vg.name}</span> : null;
                        })
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {menus.length === 0 && <div className="p-8 text-center text-slate-400 dark:text-slate-500 animate-in fade-in">Belum ada data menu</div>}
      </div>
    </div>
  );
};

export default MenuManagement;