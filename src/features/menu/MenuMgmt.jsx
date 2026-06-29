import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "../../context/AppContext";
import { ChevronLeft, Plus, Edit3, Trash2, Settings2, Search, X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import CategoryModal from "../../components/CategoryModal";
import { Card, Button, IconButton, Input, Select, PageHeader, EmptyState, Badge } from "../../components/ui";

// ─── Hook drag & drop reorder (mouse + touch) ───
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

// ─── Komponen Kelompok Kategori Menu ───
const MenuCategorySection = ({ 
  category, 
  menus, 
  variantGroups, 
  onReorderItem, 
  onEdit, 
  onDelete, 
  formatRupiah, 
  categoryDrag, 
  isDragEnabled 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const itemDrag = useDragReorder(onReorderItem);

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
          {isDragEnabled && (
            <div 
              onPointerDown={categoryDrag?.startDrag(category)}
              className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 shrink-0 p-1 -ml-1 touch-none"
              title="Tahan & geser untuk mengurutkan kategori"
            >
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{category}</span>
          <Badge variant="neutral">{menus.length} Item</Badge>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={isExpanded ? "Tutup Kategori" : "Buka Kategori"}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* --- DAFTAR MENU RINGKAS --- */}
      {isExpanded && (
        <div className="flex flex-col gap-2">
          {menus.map((menu) => {
            const isDragging = itemDrag.dragId === menu.id;
            const isDropTarget = itemDrag.overId === menu.id && itemDrag.dragId !== null && itemDrag.dragId !== menu.id;
            
            return (
              <div 
                key={menu.id} 
                ref={itemDrag.registerRef(menu.id)}
                className={getDragRowClass(
                  isDragging,
                  isDropTarget,
                  "group flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border shadow-sm transition-all gap-3 sm:gap-4",
                  "border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-500/30"
                )}
              >
                {/* --- Info Kiri: Drag Handle, Nama, HPP, Varian --- */}
                <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                  {isDragEnabled && (
                    <div 
                      onPointerDown={itemDrag.startDrag(menu.id)}
                      className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400 shrink-0 p-1 -ml-1 touch-none"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

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
                </div>

                {/* --- Info Kanan: Harga & Tombol Aksi --- */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t border-slate-50 dark:border-slate-800/50 sm:border-0 pt-2 sm:pt-0">
                  <span className="font-bold text-accent-600 dark:text-accent-400 text-sm">
                    {formatRupiah(menu.price)}
                  </span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <IconButton variant="edit" onClick={() => onEdit(menu)} title="Edit Menu">
                      <Edit3 className="w-4 h-4" />
                    </IconButton>
                    <IconButton variant="delete" onClick={() => onDelete(menu.id)} title="Hapus Menu">
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
    const dataToSave = { ...formData, price: Number(formData.price), hpp: Number(formData.hpp || 0) };
    if (formData.id) {
      setMenus(menus.map(m => m.id === formData.id ? dataToSave : m));
    } else {
      setMenus([...menus, { ...dataToSave, id: `m${Date.now()}` }]);
    }
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    triggerConfirm("Yakin ingin menghapus menu ini?", () => setMenus(menus.filter(m => m.id !== id)));
  };

  // Drag Reorder Menu Item (dalam kategori)
  const handleReorderMenu = (categoryName) => (draggedId, overId) => {
    setMenus(prev => {
      const list = [...prev];
      const categoryIds = list.filter(m => (m.category || 'Lainnya') === categoryName).map(m => m.id);
      const fromIdx = categoryIds.indexOf(draggedId);
      const toIdx = categoryIds.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;

      const reorderedIds = [...categoryIds];
      const [movedId] = reorderedIds.splice(fromIdx, 1);
      reorderedIds.splice(toIdx, 0, movedId);

      let cursor = 0;
      return list.map(m => {
        if ((m.category || 'Lainnya') !== categoryName) return m;
        const newId = reorderedIds[cursor++];
        return list.find(x => x.id === newId);
      });
    });
  };

  // Drag Reorder Kategori
  const handleReorderCategory = (draggedCat, overCat) => {
    setCategories(prev => {
      const list = [...prev];
      const fromIdx = list.indexOf(draggedCat);
      const toIdx = list.indexOf(overCat);
      if(fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return list;
    });
  };
  const categoryDrag = useDragReorder(handleReorderCategory);

  const groupedMenus = useMemo(() => {
    const groups = {};
    menus.forEach(menu => {
      const cat = menu.category || 'Lainnya';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(menu);
    });
    return groups;
  }, [menus]);

  // Urutkan kategori berdasarkan urutan di state 'categories' (mempertahankan hasil drag)
  const sortedCategoryKeys = useMemo(() => {
    const allCats = Object.keys(groupedMenus);
    const orderedCats = categories.filter(c => allCats.includes(c));
    const missingCats = allCats.filter(c => !orderedCats.includes(c));
    return [...orderedCats, ...missingCats];
  }, [categories, groupedMenus]);

  if (isEditing) {
    // Form Edit / Tambah Menu - (Sama dengan aslinya, dipersingkat untuk render)
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
            <Input id="menuName" label="Nama Menu" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Lumpia Semarang" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="menuCategory" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</label>
                <Button type="button" size="xs" variant="secondary" onClick={() => setIsCategoryModalOpen(true)} icon={<Settings2 className="w-3 h-3" />}>Kelola Kategori</Button>
              </div>
              <Select id="menuCategory" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                {!categories.includes(formData.category) && formData.category && (
                  <option value={formData.category}>{formData.category}</option>
                )}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input id="menuPrice" label="Harga Jual" type="number" icon={<span className="font-bold">Rp</span>} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0" />
              <Input id="menuHpp" label="HPP / Modal" type="number" icon={<span className="font-bold">Rp</span>} value={formData.hpp} onChange={e => setFormData({ ...formData, hpp: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0" />
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
                  <label key={vg.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${formData.variantGroupIds.includes(vg.id) ? 'bg-accent-50 dark:bg-accent-500/10 border-orange-200 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100'}`}>
                    <input type="checkbox" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.variantGroupIds.includes(vg.id)} onChange={() => setFormData(prev => ({ ...prev, variantGroupIds: prev.variantGroupIds.includes(vg.id) ? prev.variantGroupIds.filter(id => id !== vg.id) : [...prev.variantGroupIds, vg.id] }))} />
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
        <div className="max-w-4xl mt-8 pt-6 border-t border-slate-200 flex justify-end">
          <Button onClick={handleSave} size="lg" className="w-full md:w-auto">{formData.id ? 'Simpan Perubahan' : 'Tambah Menu'}</Button>
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
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => {
            setFormData({ id: '', name: '', price: '', hpp: '', category: categories[0] || 'Lainnya', variantGroupIds: [] });
            setIsEditing(true);
          }}>Tambah Data Menu</Button>
        }
      />
      
      {/* Input Pencarian */}
      <div className="relative w-full sm:w-72 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
        <input
          type="text"
          placeholder="Cari nama menu atau kategori..."
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 transition-all"><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="space-y-6 pb-10">
        {sortedCategoryKeys
          .filter(category => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return category.toLowerCase().includes(q) || groupedMenus[category].some(menu => menu.name.toLowerCase().includes(q));
          })
          .map(category => {
            const q = searchQuery.toLowerCase();
            const visibleMenus = (!searchQuery || category.toLowerCase().includes(q))
              ? groupedMenus[category]
              : groupedMenus[category].filter(menu => menu.name.toLowerCase().includes(q));

            return (
              <MenuCategorySection
                key={category}
                category={category}
                menus={visibleMenus}
                variantGroups={variantGroups}
                onReorderItem={handleReorderMenu(category)}
                onEdit={(menu) => { setFormData(menu); setIsEditing(true); }}
                onDelete={handleDelete}
                formatRupiah={formatRupiah}
                categoryDrag={categoryDrag}
                isDragEnabled={!searchQuery} // Nonaktifkan drag & drop saat mencari
              />
            );
          })}
        {menus.length === 0 && (
          <EmptyState icon={<Plus className="w-8 h-8" />} title="Belum ada data menu" description="Tambah menu pertama untuk mulai menerima pesanan" action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsEditing(true)}>Tambah Menu Pertama</Button>} />
        )}
      </div>
    </div>
  );
};

export default MenuManagement;