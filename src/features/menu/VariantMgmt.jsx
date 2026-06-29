import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "../../context/AppContext";
import { ChevronLeft, Plus, Edit3, Trash2, Settings2, Trash, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";
import { Button, IconButton, Input, Select, PageHeader, EmptyState, Badge } from "../../components/ui";

// ─── Hook drag & drop reorder ───
function useDragReorder(onReorder) {
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
    try { e.target.setPointerCapture?.(e.pointerId); } catch (_) {}
    overIdRef.current = id;
    setDragId(id);
    setOverId(id);
  }, []);

  useEffect(() => {
    if (dragId === null) return;
    const getY = (e) => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
    const handleMove = (e) => {
      const y = getY(e);
      if (y == null) return;
      let closestId = null;
      let closestDist = Infinity;
      Object.entries(itemRefs.current).forEach(([id, el]) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(y - mid);
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

function getDragRowClass(isDragging, isDropTarget, baseClass, idleClass) {
  if (isDragging) return `${baseClass} opacity-50 ring-2 ring-orange-400 z-10`;
  if (isDropTarget) return `${baseClass} border-orange-400 bg-accent-50/60 dark:bg-accent-500/10`;
  return `${baseClass} ${idleClass}`;
}

// ─── Komponen Kelompok Kategori Varian ───
const VariantCategorySection = ({ category, groups, onReorder, onEdit, onDelete, categoryDrag }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const itemDrag = useDragReorder(onReorder);

  const isDraggingCat = categoryDrag?.dragId === category;
  const isDropTargetCat = categoryDrag?.overId === category && categoryDrag?.dragId !== null && categoryDrag?.dragId !== category;

  return (
    <div 
      ref={categoryDrag?.registerRef(category)}
      className={getDragRowClass(
        isDraggingCat, 
        isDropTargetCat, 
        "animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-xl p-2 -mx-2 transition-all", 
        "border border-transparent hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
      )}
    >
      {/* --- Header Kategori --- */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div 
            onPointerDown={categoryDrag?.startDrag(category)}
            className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 shrink-0 p-1 -ml-1 touch-none"
            title="Tahan & geser untuk mengurutkan kategori"
          >
            <GripVertical className="w-5 h-5" />
          </div>
          <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{category}</span>
          <Badge variant="neutral">{groups.length} Grup</Badge>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={isExpanded ? "Tutup Kategori" : "Buka Kategori"}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* --- DAFTAR GRUP VARIAN --- */}
      {isExpanded && (
        <div className="flex flex-col gap-2">
          {groups.map((vg) => {
            const isDragging = itemDrag.dragId === vg.id;
            const isDropTarget = itemDrag.overId === vg.id && itemDrag.dragId !== null && itemDrag.dragId !== vg.id;
            return (
              <div
                key={vg.id}
                ref={itemDrag.registerRef(vg.id)}
                className={getDragRowClass(
                  isDragging,
                  isDropTarget,
                  "group flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border shadow-sm transition-all gap-3 sm:gap-4",
                  "border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-500/30"
                )}
              >
                {/* --- Drag handle + Info Kiri --- */}
                <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                  <div
                    onPointerDown={itemDrag.startDrag(vg.id)}
                    className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400 shrink-0 p-1 -ml-1 touch-none"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{vg.name}</h3>
                      <Badge variant={vg.isRequired ? 'danger' : 'neutral'}>{vg.isRequired ? 'Wajib' : 'Opsional'}</Badge>
                      <Badge variant="orange">Max: {vg.maxSelection} Pilihan</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-400">Opsi:</span>
                      {vg.options?.map((opt, oIdx) => (
                        <span key={opt.id || oIdx} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 px-1.5 py-0.5 rounded font-medium text-slate-600 dark:text-slate-300">
                          {opt.name} {opt.extraPrice > 0 && `(+${opt.extraPrice})`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* --- Info Kanan: Tombol Aksi --- */}
                <div className="flex items-center justify-end gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-t border-slate-50 dark:border-slate-800/50 sm:border-0 pt-2 sm:pt-0">
                  <IconButton variant="edit" onClick={() => onEdit(vg)} title="Edit Grup Varian"><Edit3 className="w-4 h-4" /></IconButton>
                  <IconButton variant="delete" onClick={() => onDelete(vg.id)} title="Hapus Grup Varian"><Trash2 className="w-4 h-4" /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const VariantManagement = () => {
  const {
    variantGroups, setVariantGroups, variantCategories, setVariantCategories,
    menus, setMenus, triggerAlert, triggerConfirm, formatRupiah
  } = useAppContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', category: variantCategories?.[0] || 'Lainnya',
    isRequired: false, maxSelection: 1, options: []
  });
  const [newOption, setNewOption] = useState({ name: '', extraPrice: '' });

  useEffect(() => {
    if (!variantGroups || variantGroups.length === 0) return;
    if (typeof setVariantCategories !== 'function') return;

    const externalCategories = [...new Set(variantGroups.map(item => item.category).filter(Boolean))];
    setVariantCategories(prevCategories => {
      const safePrev = prevCategories || [];
      const missingCategories = externalCategories.filter(cat => !safePrev.includes(cat));
      if (missingCategories.length > 0) return [...safePrev, ...missingCategories];
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
      setMenus((menus ?? []).map(m => ({ ...m, variantGroupIds: (m.variantGroupIds ?? []).filter(vId => vId !== id) })));
    });
  };

  const handleAddOption = () => {
    if (!newOption.name || newOption.extraPrice === '') return triggerAlert("Nama opsi dan harga tambahan harus diisi.");
    const opt = { id: `opt${Date.now()}`, name: newOption.name, extraPrice: Number(newOption.extraPrice) };
    setFormData(prev => ({ ...prev, options: [...(prev.options ?? []), opt] }));
    setNewOption({ name: '', extraPrice: '' });
  };

  const handleRemoveOption = (optId) => {
    setFormData(prev => ({ ...prev, options: (prev.options ?? []).filter(o => o.id !== optId) }));
  };

  // Drag Reorder Group (dalam kategori)
  const handleReorderGroup = (categoryName) => (draggedId, overId) => {
    setVariantGroups(prev => {
      const list = prev ?? [];
      const categoryIds = list.filter(vg => (vg.category || 'Lainnya') === categoryName).map(vg => vg.id);
      const fromIdx = categoryIds.indexOf(draggedId);
      const toIdx = categoryIds.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;

      const reorderedIds = [...categoryIds];
      const [movedId] = reorderedIds.splice(fromIdx, 1);
      reorderedIds.splice(toIdx, 0, movedId);

      let cursor = 0;
      return list.map(vg => {
        if ((vg.category || 'Lainnya') !== categoryName) return vg;
        const newId = reorderedIds[cursor++];
        return list.find(v => v.id === newId);
      });
    });
  };

  // Drag Reorder Kategori Varian
  const handleReorderCategory = (draggedCat, overCat) => {
    setVariantCategories(prev => {
      const list = [...(prev || [])];
      const fromIdx = list.indexOf(draggedCat);
      const toIdx = list.indexOf(overCat);
      if(fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return list;
    });
  };
  const categoryDrag = useDragReorder(handleReorderCategory);

  const handleReorderOption = (draggedId, overId) => {
    setFormData(prev => {
      const options = prev.options ?? [];
      const fromIdx = options.findIndex(o => o.id === draggedId);
      const toIdx = options.findIndex(o => o.id === overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const reordered = [...options];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      return { ...prev, options: reordered };
    });
  };
  const optionsDrag = useDragReorder(handleReorderOption);

  const groupedVariantGroups = useMemo(() => {
    const groups = {};
    (variantGroups ?? []).forEach(vg => {
      const cat = vg.category || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(vg);
    });
    return groups;
  }, [variantGroups]);

  const sortedCategoryKeys = useMemo(() => {
    const allCats = Object.keys(groupedVariantGroups);
    const orderedCats = (variantCategories || []).filter(c => allCats.includes(c));
    const missingCats = allCats.filter(c => !orderedCats.includes(c));
    return [...orderedCats, ...missingCats];
  }, [variantCategories, groupedVariantGroups]);

  if (isEditing) {
    // Form Edit / Tambah Varian - (Sama dengan aslinya, dipersingkat untuk render)
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
            <Input id="vgName" label="Nama Grup Varian" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Level Pedas, Topping" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="vgCategory" className="text-xs font-bold text-slate-500 uppercase">Kategori Varian</label>
                <Button type="button" size="xs" variant="secondary" onClick={() => setIsCategoryModalOpen(true)} icon={<Settings2 className="w-3 h-3" />}>Kelola Kategori</Button>
              </div>
              <Select id="vgCategory" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pelanggan harus memilih minimal satu opsi.</p>
                </div>
              </label>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label htmlFor="maxSel" className="block text-xs font-bold text-slate-500 uppercase mb-1">Maksimal Jumlah Pilihan Opsi</label>
                <input id="maxSel" type="number" min="1" className="w-24 p-2 border border-slate-200 bg-white text-slate-800 rounded-lg text-sm font-bold" value={formData.maxSelection} onChange={e => setFormData({ ...formData, maxSelection: Number(e.target.value) || 1 })} />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Opsi Pilihan Varian</h3>
            <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Opsi</label>
                <input type="text" placeholder="Misal: Mozzarella" className="w-full p-2 text-xs border border-slate-200 rounded-lg" value={newOption.name} onChange={e => setNewOption({ ...newOption, name: e.target.value })} />
              </div>
              <div className="w-28">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga + (Rp)</label>
                <input type="number" placeholder="0" className="w-full p-2 text-xs border border-slate-200 rounded-lg" value={newOption.extraPrice} onChange={e => setNewOption({ ...newOption, extraPrice: e.target.value })} />
              </div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddOption} className="shrink-0 h-9">Tambah</Button>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {(formData.options ?? []).length === 0 ? (
                <EmptyState size="sm" title="Belum ada opsi pilihan dimasukkan." />
              ) : (
                (formData.options ?? []).map((opt) => {
                  const isDragging = optionsDrag.dragId === opt.id;
                  const isDropTarget = optionsDrag.overId === opt.id && optionsDrag.dragId !== null && optionsDrag.dragId !== opt.id;
                  return (
                    <div key={opt.id} ref={optionsDrag.registerRef(opt.id)} className={getDragRowClass(isDragging, isDropTarget, "flex justify-between items-center p-2.5 bg-white border rounded-xl shadow-sm transition-all", "border-slate-100")}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div onPointerDown={optionsDrag.startDrag(opt.id)} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 shrink-0 p-1 touch-none">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-800 truncate">{opt.name}</span>
                          <span className="text-[10px] text-slate-500">+{formatRupiah(opt.extraPrice)}</span>
                        </div>
                      </div>
                      <IconButton variant="delete" size="sm" onClick={() => handleRemoveOption(opt.id)}><Trash className="w-4 h-4" /></IconButton>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="max-w-4xl mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <Button onClick={handleSave} size="lg" className="w-full md:w-auto">{formData.id ? 'Simpan Perubahan' : 'Simpan Grup Varian'}</Button>
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
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => {
            setFormData({ id: '', name: '', category: variantCategories?.[0] || 'Lainnya', isRequired: false, maxSelection: 1, options: [] });
            setIsEditing(true);
          }}>Tambah Grup Varian</Button>
        }
      />
      <div className="space-y-6 pb-10">
        {sortedCategoryKeys.map(category => (
          <VariantCategorySection
            key={category}
            category={category}
            groups={groupedVariantGroups[category]}
            onReorder={handleReorderGroup(category)}
            onEdit={(vg) => { setFormData({ ...vg, options: vg.options ?? [] }); setIsEditing(true); }}
            onDelete={handleDelete}
            categoryDrag={categoryDrag}
          />
        ))}
        {(variantGroups ?? []).length === 0 && (
          <EmptyState icon={<Plus className="w-8 h-8" />} title="Belum ada data grup varian" action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsEditing(true)}>Tambah Grup Varian</Button>} />
        )}
      </div>
    </div>
  );
};

export default VariantManagement;