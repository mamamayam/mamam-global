import { Check, ArrowUpDown } from 'lucide-react';
import Modal from './Modal';

/**
 * SortModal — bottom sheet generic buat pilih urutan data (riwayat, laporan,
 * daftar apa aja). Tinggal kasih daftar opsi, dia urus tampilan radio-list-nya.
 *
 * Props:
 *   isOpen, onClose      wajib
 *   title                string (default: 'Urutkan')
 *   options              [{ key, label, icon? }] — daftar pilihan urutan, wajib
 *   value                string — key opsi yang sedang aktif (dicentang)
 *   onChange             (key) => void — dipanggil pas user milih opsi
 *   closeOnSelect        boolean (default: true) — auto-nutup sheet pas pilih
 *
 * Catatan: key opsi sengaja digabung "field-direction" (mis. "date-desc")
 * biar gampang dipasangin ke helper `applySort` di utils/sortUtils.js.
 *
 * Contoh:
 *   const sortOptions = [
 *     { key: 'date-desc', label: 'Terbaru Dulu' },
 *     { key: 'date-asc',  label: 'Terlama Dulu' },
 *     { key: 'name-asc',  label: 'Nama (A-Z)' },
 *     { key: 'name-desc', label: 'Nama (Z-A)' },
 *     { key: 'type-asc',  label: 'Tipe Order' },
 *   ];
 *
 *   <SortModal
 *     isOpen={isSortOpen}
 *     onClose={() => setIsSortOpen(false)}
 *     value={sortKey}
 *     onChange={setSortKey}
 *     options={sortOptions}
 *   />
 */
export default function SortModal({
  isOpen,
  onClose,
  title = 'Urutkan',
  options = [],
  value,
  onChange,
  closeOnSelect = true,
}) {
  if (!isOpen) return null;

  const handleSelect = (key) => {
    onChange?.(key);
    if (closeOnSelect) onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" sheet>
      <div className="px-2 pb-3">
        {options.map(opt => {
          const active = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelect(opt.key)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-colors
                ${active
                  ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <span className="flex items-center gap-2.5">
                {opt.icon || <ArrowUpDown className="w-4 h-4 opacity-50" />}
                {opt.label}
              </span>
              {active && <Check className="w-4 h-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}