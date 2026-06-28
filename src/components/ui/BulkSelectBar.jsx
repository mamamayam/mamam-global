import { Trash2 } from 'lucide-react';
import Button from './Button';

export default function BulkSelectBar({ count, total, allSelected, onToggleAll, onDeleteSelected, label = 'Pilih Semua' }) {
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-4">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                />
                {label} ({count}/{total})
            </label>
            <Button
                size="sm"
                variant="secondary"
                disabled={count === 0}
                onClick={onDeleteSelected}
                className="!bg-accent-50 dark:!bg-accent-500/10 !text-accent-600 dark:!text-accent-400 hover:!bg-accent-100 dark:hover:!bg-accent-500/15 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
                <Trash2 className="w-4 h-4" /> Hapus Terpilih ({count})
            </Button>
        </div>
    );
}