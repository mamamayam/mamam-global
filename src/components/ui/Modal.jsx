import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — komponen global untuk semua dialog overlay.
 *
 * Props:
 *   isOpen        boolean              — tampilkan modal
 *   onClose       () => void           — callback close (backdrop click / tombol X)
 *   children      ReactNode
 *   title         string               — judul di header modal (opsional)
 *   size          'xs' | 'sm' | 'md' | 'lg'  — lebar dialog (default: 'sm')
 *   zLevel        'modal' | 'top' | 'pin'  — level tumpukan (default: 'modal')
 *   sheet         boolean              — gunakan bottom sheet style (mobile-friendly)
 *   side          'right' | 'top'      — panel slide dari kanan (full-height) atau dari atas (dropdown, di bawah header)
 *   closeOnBackdrop boolean            — close saat klik backdrop (default: true)
 *   maxHeight     boolean              — batasi tinggi + scroll inner (default: false, gak dipakai kalau side dipakai karena udah diatur sendiri per-variant)
 *   className     string               — class tambahan untuk container dialog
 *
 * Z-index:
 *   modal → z-[60]   : modal umum (CategoryModal, PaymentModal, dll)
 *   top   → z-[100]  : alert/confirm global (App.jsx)
 *   pin   → z-[300]  : PinModal
 *
 * Contoh:
 *   <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit Kategori">
 *     <p>Konten di sini</p>
 *   </Modal>
 *
 *   // Bottom sheet
 *   <Modal isOpen={isOpen} onClose={onClose} sheet size="md">
 *     ...
 *   </Modal>
 *
 *   // Panel slide dari kanan
 *   <Modal isOpen={isOpen} onClose={onClose} side="right" size="md">
 *     ...
 *   </Modal>
 *
 *   // Panel drop-down dari atas (bell notifikasi, dll)
 *   <Modal isOpen={isOpen} onClose={onClose} side="top">
 *     ...
 *   </Modal>
 */

const Z_LEVELS = {
  modal: 'z-[60]',
  top: 'z-[100]',
  pin: 'z-[300]',
};

const SIZES = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'sm',
  zLevel = 'modal',
  sheet = false,
  side,
  closeOnBackdrop = true,
  maxHeight = false,
  className = '',
}) {
  // State transisi buat variant `side` (right/top) — proyek ini gak install
  // plugin `tailwindcss-animate`/`tw-animate-css` (Tailwind v4 gak nyediain
  // animate-in/slide-in-from-* built-in), jadi slide beneran digerakkan
  // manual: render dulu dalam posisi translate penuh (di luar layar), abis
  // mount toggle ke translate-0 biar transition-transform jalan. Hooks WAJIB
  // selalu jalan tiap render (rules of hooks) makanya ditaro sebelum early
  // return `if (!isOpen)` — untuk caller lain yang gak pernah pakai prop
  // `side`, effect di bawah langsung no-op, gak ada efek samping.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!side) return;
    if (!isOpen) { setEntered(false); return; }
    setEntered(false);
    const id = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(id);
  }, [isOpen, side]);

  if (!isOpen) return null;

  const zClass = Z_LEVELS[zLevel] ?? Z_LEVELS.modal;
  const sizeClass = SIZES[size] ?? SIZES.sm;

  const handleBackdrop = () => { if (closeOnBackdrop && onClose) onClose(); };

  // ── Side drawer variant (slide dari kanan, full-height) ──────────────────
  if (side === 'right') {
    return (
      <div
        className={`fixed inset-0 ${zClass} flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleBackdrop}
      >
        <div
          onClick={e => e.stopPropagation()}
          className={`
            bg-white dark:bg-slate-900 h-full w-full ${sizeClass} shadow-2xl
            flex flex-col transition-transform duration-300 ease-out
            ${entered ? 'translate-x-0' : 'translate-x-full'}
            ${className}
          `}
        >
          {/* Header opsional */}
          {title && (
            <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg min-w-0 truncate">{title}</h3>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-accent-100 dark:hover:bg-accent-500/20 hover:text-accent-600 dark:hover:text-accent-400 active:scale-95 transition-all duration-300 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Konten — selalu scrollable karena panel udah full-height */}
          <div className="overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // ── Top drawer variant (drop-down dari atas, di bawah header) ────────────
  if (side === 'top') {
    return (
      <div
        className={`fixed inset-0 ${zClass} flex flex-col bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleBackdrop}
      >
        <div
          onClick={e => e.stopPropagation()}
          className={`
            bg-white dark:bg-slate-900 w-full max-h-[75dvh] shadow-2xl rounded-b-3xl
            flex flex-col transition-transform duration-300 ease-out
            ${entered ? 'translate-y-0' : '-translate-y-full'}
            ${className}
          `}
        >
          {/* Header opsional */}
          {title && (
            <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg min-w-0 truncate">{title}</h3>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-accent-100 dark:hover:bg-accent-500/20 hover:text-accent-600 dark:hover:text-accent-400 active:scale-95 transition-all duration-300 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Konten — selalu scrollable, panel dibatasi max-h */}
          <div className="overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // ── Bottom sheet variant ─────────────────────────────────────────────────
  if (sheet) {
    return (
      <div
        className={`fixed inset-0 ${zClass} flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300`}
        onClick={handleBackdrop}
      >
        <div
          onClick={e => e.stopPropagation()}
          className={`
            bg-white dark:bg-slate-900 w-full ${sizeClass} rounded-t-3xl
            animate-in slide-in-from-bottom-4 duration-300 ease-out
            ${maxHeight ? 'max-h-[90dvh] flex flex-col' : ''}
            ${className}
          `}
        >
          {/* Handle bar */}
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

          {/* Header opsional */}
          {title && (
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-base">{title}</h3>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-accent-100 dark:hover:bg-accent-500/20 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Konten */}
          <div className={maxHeight ? 'overflow-y-auto flex-1' : ''}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // ── Dialog variant (default) ─────────────────────────────────────────────
  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300`}
      onClick={handleBackdrop}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`
          bg-white dark:bg-slate-900 ${sizeClass} w-full rounded-3xl shadow-2xl
          animate-in zoom-in-95 duration-300 ease-out
          ${maxHeight ? 'max-h-[90dvh] flex flex-col' : ''}
          ${className}
        `}
      >
        {/* Header opsional */}
        {title && (
          <div className="flex items-start justify-between gap-3 p-5 pb-0 shrink-0">
            <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg min-w-0 truncate">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-accent-100 dark:hover:bg-accent-500/20 hover:text-accent-600 dark:hover:text-accent-400 active:scale-95 transition-all duration-300 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Konten */}
        <div className={maxHeight ? 'overflow-y-auto flex-1' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
}