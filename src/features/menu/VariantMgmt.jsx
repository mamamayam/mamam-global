import React, { useState, useMemo, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { ChevronLeft, Plus, Edit3, Trash2, Settings2, Trash } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";
import { Button, IconButton, Input, Select, PageHeader, EmptyState, Badge } from "../../components/ui";

const VariantManagement = () => {
  const {
    variantGroups, setVariantGroups,
    variantCategories, setVariantCategories,
    menus, setMenus, triggerAlert, triggerConfirm, formatRupiah
  } = useAppContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', category: variantCategories?.[0] || 'Lainnya',
    isRequired: false, maxSelection: 1, options: []
  });
  const [newOption, setNewOption] = useState({ name: '', extraPrice: '' });

  // ✨ SINKRONISASI KATEGORI VARIAN OTOMATIS (FIX CRASH & DOUBLE)
  useEffect(() => {
    if (!variantGroups || variantGroups.length === 0) return;

    // Mencegah crash jika AppContext belum mengekspor fungsi ini
    if (typeof setVariantCategories !== 'function') {
      console.warn("Peringatan: setVariantCategories belum ditambahkan ke AppContext.jsx");
      return;
    }

    const externalCategories = [...new Set(variantGroups.map(item => item.category).filter(Boolean))];

    setVariantCategories(prevCategories => {
      const safePrev = prevCategories || []; // Mencegah error jika prevCategories null/undefined
      const missingCategories = externalCategories.filter(cat => !safePrev.includes(cat));
      if (missingCategories.length > 0) {
        return [...safePrev, ...missingCategories];
      }
      return safePrev;
    });
  }, [variantGroups, setVariantCategories]);

  const handleSave = () => {
    if ((formData.options ?? []).length === 0) {
      triggerAlert("Tambahkan minimal 1 opsi varian.");
      return;
    }
    if (!formData.name) {
      triggerAlert("Nama grup varian harus diisi.");
      return;
    }

    if (formData.id) {
      setVariantGroups((variantGroups ?? []).map(vg => vg.id === formData.id ? formData : vg));
    } else {
      setVariantGroups([...(variantGroups ?? []), { ...formData, id: `vg${Date.now()}` }]);
    }
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    triggerConfirm("Yakin ingin menghapus grup varian ini?", () => {
      setVariantGroups((variantGroups ?? []).filter(vg => vg.id !== id));
      setMenus((menus ?? []).map(m => ({
        ...m,
        variantGroupIds: (m.variantGroupIds ?? []).filter(vId => vId !== id)
      })));
    });
  };

  const handleAddOption = () => {
    if (!newOption.name || newOption.extraPrice === '') {
      triggerAlert("Nama opsi dan harga tambahan harus diisi.");
      return;
    }
    const opt = {
      id: `opt${Date.now()}`,
      name: newOption.name,
      extraPrice: Number(newOption.extraPrice)
    };
    setFormData(prev => ({ ...prev, options: [...(prev.options ?? []), opt] }));
    setNewOption({ name: '', extraPrice: '' });
  };

  const handleRemoveOption = (optId) => {
    setFormData(prev => ({ ...prev, options: (prev.options ?? []).filter(o => o.id !== optId) }));
  };

  const groupedVariantGroups = useMemo(() => {
    const groups = {};
    (variantGroups ?? []).forEach(vg => {
      const cat = vg.category || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(vg);
    });
    return groups;
  }, [variantGroups]);

  if (isEditing) {
    return (
      <div className="p-4 md:p-6 bg-white dark:bg-slate-900 flex-1 animate-in fade-in slide-in-from-right-4 duration-300 h-full overflow-y-auto ease-out">
        <button onClick={() => setIsEditing(false)} className="mb-4 text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors">
          <ChevronLeft className="w-5 h-5" /> Kembali
        </button>
        <h2 className="font-heading text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
          {formData.id ? 'Edit Grup Varian' : 'Tambah Grup Varian Baru'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Informasi Dasar</h3>
            <Input
              id="vgName"
              label="Nama Grup Varian"
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Misal: Level Pedas, Topping"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="vgCategory" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori Varian</label>
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
                id="vgCategory"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {(variantCategories ?? []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                {!(variantCategories ?? []).includes(formData.category) && formData.category && (
                  <option value={formData.category}>{formData.category}</option>
                )}
              </Select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.isRequired} onChange={e => setFormData({ ...formData, isRequired: e.target.checked })} />
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Wajib Dipilih</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pelanggan harus memilih minimal satu opsi sebelum memesan.</p>
                </div>
              </label>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label htmlFor="maxSel" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Maksimal Jumlah Pilihan Opsi</label>
                <input
                  id="maxSel"
                  type="number"
                  min="1"
                  className="w-24 p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg focus:border-orange-500 dark:focus:border-orange-500 outline-none transition-colors text-sm font-bold"
                  value={formData.maxSelection}
                  onChange={e => setFormData({ ...formData, maxSelection: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Opsi Pilihan Varian</h3>

            <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Nama Opsi</label>
                <input
                  type="text"
                  placeholder="Misal: Mozzarella"
                  className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
                  value={newOption.name}
                  onChange={e => setNewOption({ ...newOption, name: e.target.value })}
                />
              </div>
              <div className="w-28">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Harga + (Rp)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
                  value={newOption.extraPrice}
                  onChange={e => setNewOption({ ...newOption, extraPrice: e.target.value })}
                />
              </div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddOption} className="shrink-0 h-9">
                Tambah
              </Button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {(formData.options ?? []).length === 0 ? (
                <EmptyState size="sm" title="Belum ada opsi pilihan dimasukkan." />
              ) : (
                (formData.options ?? []).map((opt, idx) => (
                  <div key={opt.id || idx} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{opt.name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">+{formatRupiah(opt.extraPrice)}</span>
                    </div>
                    <IconButton variant="delete" size="sm" onClick={() => handleRemoveOption(opt.id)}>
                      <Trash className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <Button onClick={handleSave} size="lg" className="w-full md:w-auto">
            {formData.id ? 'Simpan Perubahan' : 'Simpan Grup Varian'}
          </Button>
        </div>

        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Kelola Kategori Varian"
          categories={variantCategories}
          setCategories={setVariantCategories}
          triggerAlert={triggerAlert}
          triggerConfirm={triggerConfirm}
          onRename={(oldCat, newCat) => {
            const updatedVgs = (variantGroups ?? []).map(v => v.category === oldCat ? { ...v, category: newCat } : v);
            if (JSON.stringify(updatedVgs) !== JSON.stringify(variantGroups)) setVariantGroups(updatedVgs);
            if (formData.category === oldCat) setFormData(prev => ({ ...prev, category: newCat }));
          }}
          onDelete={(deletedCat) => {
            const updatedVgs = (variantGroups ?? []).map(v => v.category === deletedCat ? { ...v, category: 'Lainnya' } : v);
            if (JSON.stringify(updatedVgs) !== JSON.stringify(variantGroups)) setVariantGroups(updatedVgs);
            if (formData.category === deletedCat) setFormData(prev => ({ ...prev, category: 'Lainnya' }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <PageHeader
        title="Library Varian"
        action={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setFormData({ id: '', name: '', category: variantCategories?.[0] || 'Lainnya', isRequired: false, maxSelection: 1, options: [] });
              setIsEditing(true);
            }}
          >
            Tambah Grup Varian
          </Button>
        }
      />

      <div className="space-y-8 pb-10">
        {Object.keys(groupedVariantGroups).map(category => (
          <div key={category} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* --- Header Kategori --- */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{category}</span>
              <Badge variant="neutral">{groupedVariantGroups[category].length} Grup</Badge>
            </div>

            {/* --- DAFTAR GRUP VARIAN RINGKAS (1 BARIS) --- */}
            <div className="flex flex-col gap-2">
              {groupedVariantGroups[category]?.map((vg) => (
                <div key={vg.id} className="group flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-orange-200 dark:hover:border-orange-500/30 transition-all gap-3 sm:gap-4">

                  {/* --- Info Kiri: Nama & Atribut Status --- */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                        {vg.name}
                      </h3>
                      <Badge variant={vg.isRequired ? 'danger' : 'neutral'}>
                        {vg.isRequired ? 'Wajib' : 'Opsional'}
                      </Badge>
                      <Badge variant="orange">Max: {vg.maxSelection} Pilihan</Badge>
                    </div>

                    {/* --- Daftar Opsi Horizontal --- */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-400">Opsi:</span>
                      {vg.options?.map((opt, oIdx) => (
                        <span key={opt.id || oIdx} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          {opt.name} {opt.extraPrice > 0 && `(+${opt.extraPrice})`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* --- Info Kanan: Tombol Aksi --- */}
                  <div className="flex items-center justify-end gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-t border-slate-50 dark:border-slate-800/50 sm:border-0 pt-2 sm:pt-0">
                    <IconButton
                      variant="edit"
                      onClick={() => { setFormData({ ...vg, options: vg.options ?? [] }); setIsEditing(true); }}
                      title="Edit Grup Varian"
                    >
                      <Edit3 className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      variant="delete"
                      onClick={() => handleDelete(vg.id)}
                      title="Hapus Grup Varian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>

                </div>
              ))}
            </div>

          </div>
        ))}
        {(variantGroups ?? []).length === 0 && (
          <EmptyState
            icon={<Plus className="w-8 h-8" />}
            title="Belum ada data grup varian"
            description="Tambah grup varian pertama untuk mulai mengatur pilihan menu"
            action={
              <Button
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setFormData({ id: '', name: '', category: variantCategories?.[0] || 'Lainnya', isRequired: false, maxSelection: 1, options: [] });
                  setIsEditing(true);
                }}
              >
                Tambah Grup Varian
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

export default VariantManagement;