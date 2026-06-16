import React, { useState } from 'react';
import { X, Plus, Edit3, Trash2, Save, Layers, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Modal generic untuk kelola daftar kategori (tambah/edit/hapus).
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - title: judul modal (misal "Kelola Kategori Menu")
 * - categories: string[]
 * - setCategories: (string[]) => void
 * - onRename(oldName, newName): dipanggil setelah kategori di-edit, untuk
 *   update referensi di tempat lain (misal `menus`/`hppLibrary`/`variantGroups`
 *   yang menyimpan nama kategori). Opsional.
 * - onDeleteFallback: nama kategori pengganti saat kategori dihapus dan masih
 *   dipakai di tempat lain (default: 'Uncategorized'). Dipakai untuk teks
 *   konfirmasi saja — pemanggil tetap perlu handle reassignment via onDelete.
 * - onDelete(deletedName): dipanggil setelah kategori dihapus dari daftar,
 *   untuk membersihkan/reassign referensi di tempat lain. Opsional.
 * - triggerAlert, triggerConfirm: dari useAppContext (untuk validasi & konfirmasi)
 */
const CategoryModal = ({
    isOpen, onClose, title = 'Kelola Kategori',
    categories, setCategories,
    onRename, onDelete, onDeleteFallback = 'Uncategorized',
    triggerAlert, triggerConfirm,
}) => {
    const [newCat, setNewCat] = useState('');
    const [editIndex, setEditIndex] = useState(-1);
    const [editValue, setEditValue] = useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        if (!newCat.trim()) return;
        if (categories.some(c => c.toLowerCase() === newCat.trim().toLowerCase())) {
            return triggerAlert?.('Kategori sudah ada!');
        }
        setCategories([...categories, newCat.trim()]);
        setNewCat('');
    };

    const handleDelete = (cat, idx) => {
        triggerConfirm?.(
            `Yakin ingin menghapus kategori "${cat}"? Item yang menggunakan kategori ini akan masuk ke "${onDeleteFallback}".`,
            () => {
                setCategories(categories.filter((_, i) => i !== idx));
                onDelete?.(cat);
            }
        );
    };

    const startEdit = (cat, idx) => {
        setEditIndex(idx); setEditValue(cat);
    };

    const moveUp = (idx) => {
        if (idx === 0) return;
        const next = [...categories];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        setCategories(next);
    };

    const moveDown = (idx) => {
        if (idx === categories.length - 1) return;
        const next = [...categories];
        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
        setCategories(next);
    };

    const saveEdit = (oldCat, idx) => {
        if (!editValue.trim() || editValue === oldCat) return setEditIndex(-1);
        if (categories.some((c, i) => i !== idx && c.toLowerCase() === editValue.trim().toLowerCase())) {
            return triggerAlert?.('Nama kategori sudah digunakan!');
        }

        const newCategories = [...categories];
        const trimmed = editValue.trim();
        newCategories[idx] = trimmed;
        setCategories(newCategories);

        onRename?.(oldCat, trimmed);

        setEditIndex(-1);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-300 ease-out flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-5 shrink-0">
                    <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                        <Layers className="w-5 h-5 text-orange-600 dark:text-orange-400" /> {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex gap-2 mb-5 shrink-0">
                    <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Tambah kategori baru..." className="flex-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors" />
                    <button onClick={handleAdd} className="bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 shadow-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Tambah</button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 min-h-[250px]">
                    {categories.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 dark:text-slate-500 p-6 italic mt-4">Belum ada kategori terdaftar.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {categories.map((cat, idx) => (
                                <li key={idx} className="flex justify-between items-center p-4 hover:bg-white dark:hover:bg-slate-900 transition-colors duration-200">
                                    {editIndex === idx ? (
                                        <div className="flex flex-1 gap-2 mr-2 animate-in fade-in">
                                            <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(cat, idx)} className="flex-1 p-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-500/40 rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-500 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm" autoFocus />
                                            <button onClick={() => saveEdit(cat, idx)} className="p-2 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/20 transition-colors"><Save className="w-4 h-4" /></button>
                                            <button onClick={() => setEditIndex(-1)} className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{cat}</span>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => moveUp(idx)} disabled={idx === 0} title="Pindah ke atas" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => moveDown(idx)} disabled={idx === categories.length - 1} title="Pindah ke bawah" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => startEdit(cat, idx)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(cat, idx)} className="p-2 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoryModal;
