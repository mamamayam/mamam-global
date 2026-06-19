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
 *   closeOnBackdrop boolean            — close saat klik backdrop (default: true)
 *   maxHeight     boolean              — batasi tinggi + scroll inner (default: false)
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
 */

const Z_LEVELS = {
  modal: 'z-[60]',
  top:   'z-[100]',
  pin:   'z-[300]',
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
  closeOnBackdrop = true,
  maxHeight = false,
  className = '',
}) {
  if (!isOpen) return null;

  const zClass   = Z_LEVELS[zLevel] ?? Z_LEVELS.modal;
  const sizeClass = SIZES[size]     ?? SIZES.sm;

  const handleBackdrop = () => { if (closeOnBackdrop && onClose) onClose(); };

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
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
          <div className="flex items-center justify-between p-5 pb-0 shrink-0">
            <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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