import React, { useState } from 'react';
import { X, Plus, Edit3, Trash2, Save, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import Modal      from './ui/Modal';
import Button     from './ui/Button';
import IconButton from './ui/IconButton';
import EmptyState from './ui/EmptyState';

/**
 * Modal generic untuk kelola daftar kategori (tambah/edit/hapus/urutkan).
 *
 * Props:
 * - isOpen, onClose
 * - title: string
 * - categories: string[]
 * - setCategories: (string[]) => void
 * - onRename(oldName, newName): callback setelah rename (opsional)
 * - onDelete(deletedName): callback setelah hapus (opsional)
 * - onDeleteFallback: string — nama kategori pengganti di teks konfirmasi
 * - triggerAlert, triggerConfirm: dari useAppContext
 */
const CategoryModal = ({
    isOpen, onClose, title = 'Kelola Kategori',
    categories = [], setCategories,
    onRename, onDelete, onDeleteFallback = 'Uncategorized',
    triggerAlert, triggerConfirm,
}) => {
    const [newCat, setNewCat]       = useState('');
    const [editIndex, setEditIndex] = useState(-1);
    const [editValue, setEditValue] = useState('');

    // ── Handlers ────────────────────────────────────────────────────────────
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

    const startEdit = (cat, idx) => { setEditIndex(idx); setEditValue(cat); };

    const saveEdit = (oldCat, idx) => {
        if (!editValue.trim() || editValue === oldCat) return setEditIndex(-1);
        if (categories.some((c, i) => i !== idx && c.toLowerCase() === editValue.trim().toLowerCase())) {
            return triggerAlert?.('Nama kategori sudah digunakan!');
        }
        const next    = [...categories];
        const trimmed = editValue.trim();
        next[idx]     = trimmed;
        setCategories(next);
        onRename?.(oldCat, trimmed);
        setEditIndex(-1);
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

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" zLevel="modal" maxHeight>

            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 px-6 pt-6 pb-4 mb-5 shrink-0">
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                    <Layers className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                    {title}
                </h3>
                <button
                    onClick={onClose}
                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Form tambah kategori */}
            <div className="flex gap-2 px-6 mb-5 shrink-0">
                <input
                    type="text"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Tambah kategori baru..."
                    className="flex-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-500 dark:focus:border-orange-500 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
                />
                <Button icon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
                    Tambah
                </Button>
            </div>

            {/* Daftar kategori */}
            <div className="mx-6 mb-6 overflow-y-auto flex-1 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 min-h-[200px]">
                {categories.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={<Layers className="w-8 h-8" />}
                        title="Belum ada kategori terdaftar."
                    />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {categories.map((cat, idx) => (
                            <li
                                key={idx}
                                className="flex justify-between items-center p-3 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                            >
                                {editIndex === idx ? (
                                    // Mode edit inline — border biru intentional (bukan orange)
                                    // karena ini edit state, bukan input form biasa
                                    <div className="flex flex-1 gap-2 mr-2 animate-in fade-in">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && saveEdit(cat, idx)}
                                            className="flex-1 p-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-500/40 rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-colors"
                                            autoFocus
                                        />
                                        <IconButton variant="success" onClick={() => saveEdit(cat, idx)}>
                                            <Save className="w-4 h-4" />
                                        </IconButton>
                                        <IconButton variant="neutral" onClick={() => setEditIndex(-1)}>
                                            <X className="w-4 h-4" />
                                        </IconButton>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate mr-2">
                                            {cat}
                                        </span>
                                        <div className="flex gap-1 shrink-0">
                                            <IconButton
                                                variant="neutral"
                                                size="sm"
                                                onClick={() => moveUp(idx)}
                                                disabled={idx === 0}
                                                title="Pindah ke atas"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </IconButton>
                                            <IconButton
                                                variant="neutral"
                                                size="sm"
                                                onClick={() => moveDown(idx)}
                                                disabled={idx === categories.length - 1}
                                                title="Pindah ke bawah"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </IconButton>
                                            <IconButton variant="edit" onClick={() => startEdit(cat, idx)}>
                                                <Edit3 className="w-4 h-4" />
                                            </IconButton>
                                            <IconButton variant="delete" onClick={() => handleDelete(cat, idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </IconButton>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

        </Modal>
    );
};

export default CategoryModal;
