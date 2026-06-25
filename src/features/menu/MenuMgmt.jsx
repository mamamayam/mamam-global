import React, { useState, useMemo, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { ChevronLeft, Plus, Edit3, Trash2, Settings2, Search, X } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";
import { Card, Button, IconButton, Input, Select, PageHeader, EmptyState, Badge } from "../../components/ui";

const MenuManagement = () => {
  const {
    menus, setMenus, variantGroups, formatRupiah, triggerAlert,
    triggerConfirm, categories, setCategories, hppLibrary, setHppLibrary
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: []
  });

  // ✨ REVISI: SINKRONISASI KATEGORI OTOMATIS (FIX DOUBLE)
  useEffect(() => {
    if (!menus || menus.length === 0) return;

    const externalCategories = [...new Set(menus.map(item => item.category).filter(Boolean))];

    setCategories(prevCategories => {
      const missingCategories = externalCategories.filter(cat => !prevCategories.includes(cat));
      if (missingCategories.length > 0) {
        return [...prevCategories, ...missingCategories];
      }
      return prevCategories;
    });
  }, [menus, setCategories]);

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
    triggerConfirm("Yakin ingin menghapus menu ini?", () => {
      setMenus(menus.filter(m => m.id !== id));
    });
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="space-y-6">
            <Card className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Informasi Dasar</Card>
            <Input
              id="menuName"
              label="Nama Menu"
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Misal: Lumpia Semarang"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="menuCategory" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</label>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setIsCategoryModalOpen(true)}
                  icon={<Settings2 className="w-3 h-3" />}
                >
                  Kelola Kategori
                </Button>
              </div>
              <Select
                id="menuCategory"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                {!categories.includes(formData.category) && formData.category && (
                  <option value={formData.category}>{formData.category}</option>
                )}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="menuPrice"
                label="Harga Jual"
                type="number"
                icon={<span className="font-bold">Rp</span>}
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="0"
              />
              <Input
                id="menuHpp"
                label="HPP / Modal"
                type="number"
                icon={<span className="font-bold">Rp</span>}
                value={formData.hpp}
                onChange={e => setFormData({ ...formData, hpp: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="0"
              />
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

        <div className="max-w-4xl mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <Button onClick={handleSave} size="lg" className="w-full md:w-auto">
            {formData.id ? 'Simpan Perubahan' : 'Tambah Menu'}
          </Button>
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
            const updatedMenus = menus.map(m => m.category === oldCat ? { ...m, category: newCat } : m);
            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
            if (formData.category === oldCat) setFormData(prev => ({ ...prev, category: newCat }));

            const updatedLibrary = hppLibrary.map(recipe => recipe.category === oldCat ? { ...recipe, category: newCat } : recipe);
            if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
          }}
          onDelete={(deletedCat) => {
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
      <PageHeader
        title="Manajemen Menu"
        action={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setFormData({ id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: [] });
              setIsEditing(true);
            }}
          >
            Tambah Data Menu
          </Button>
        }
      />

      {/* Input Pencarian */}
      <div className="relative w-full sm:w-72 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
        <input
          type="text"
          placeholder="Cari nama menu atau kategori..."
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

      <div className="space-y-8 pb-10">
        {Object.keys(groupedMenus)
          .filter(category => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const categoryMatch = category.toLowerCase().includes(q);
            const menuMatch = groupedMenus[category].some(menu => menu.name.toLowerCase().includes(q));
            return categoryMatch || menuMatch;
          })
          .map(category => {
            const q = searchQuery.toLowerCase();
            const categoryMatch = category.toLowerCase().includes(q);
            const visibleMenus = (!searchQuery || categoryMatch)
              ? groupedMenus[category]
              : groupedMenus[category].filter(menu => menu.name.toLowerCase().includes(q));

            return (
              <div key={category} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* --- Header Kategori --- */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{category}</span>
                  <Badge variant="neutral">{visibleMenus.length} Item</Badge>
                </div>

                {/* --- DAFTAR MENU RINGKAS (1 BARIS) --- */}
                <div className="flex flex-col gap-2">
                  {visibleMenus.map((menu) => (
                    <div key={menu.id} className="group flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-orange-200 dark:hover:border-orange-500/30 transition-all gap-3 sm:gap-4">

                      {/* --- Info Kiri: Nama, HPP, Varian --- */}
                      <div className="flex flex-col flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate mb-0.5">
                          {menu.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium">HPP: {formatRupiah(menu.hpp || 0)}</span>
                          {menu.variantGroupIds?.length > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span>
                              <span className="truncate">
                                Varian: {menu.variantGroupIds.map(vid => variantGroups.find(v => v.id === vid)?.name).filter(Boolean).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* --- Info Kanan: Harga & Tombol Aksi --- */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t border-slate-50 dark:border-slate-800/50 sm:border-0 pt-2 sm:pt-0">
                        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                          {formatRupiah(menu.price)}
                        </span>

                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <IconButton
                            variant="edit"
                            onClick={() => { setFormData(menu); setIsEditing(true); }}
                            title="Edit Menu"
                          >
                            <Edit3 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            variant="delete"
                            onClick={() => handleDelete(menu.id)}
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        {menus.length === 0 && (
          <EmptyState
            icon={<Plus className="w-8 h-8" />}
            title="Belum ada data menu"
            description="Tambah menu pertama untuk mulai menerima pesanan"
            action={
              <Button
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setFormData({ id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: [] });
                  setIsEditing(true);
                }}
              >
                Tambah Menu Pertama
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

export default MenuManagement;