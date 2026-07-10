import { Trash2 } from 'lucide-react';
import Button from './Button';

export default function BulkSelectBar({ count, total, allSelected, onToggleAll, onDeleteSelected, label = 'Pilih Semua' }) {
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 mb-4">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="w-4 h-4 rounded accent-[#ea580c] dark:accent-[#f97316] cursor-pointer"
                />
                {label} ({count}/{total})
            </label>
            <Button
                size="sm"
                variant="ghost-danger"
                disabled={count === 0}
                onClick={onDeleteSelected}
                className="flex items-center gap-1.5"
            >
                <Trash2 className="w-4 h-4" /> Hapus Terpilih ({count})
            </Button>
        </div>
    );
}