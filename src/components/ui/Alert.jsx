import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/**
 * Alert — komponen notifikasi inline.
 *
 * Tiga type untuk tiga konteks berbeda:
 *
 * ── banner (default) ────────────────────────────────────────────────────────
 * Full-width, centered, animasi zoom-in. Untuk feedback form di dalam modal.
 *
 *   <Alert>PIN salah, coba lagi.</Alert>
 *   <Alert variant="success">Berhasil disimpan!</Alert>
 *
 * ── callout ─────────────────────────────────────────────────────────────────
 * Info box dengan icon di kiri. Untuk peringatan kontekstual di dalam view.
 * Icon default diambil dari variant, bisa di-override dengan prop `icon`.
 *
 *   <Alert type="callout" variant="info">
 *     Koreksi saldo hanya bisa dilakukan oleh Admin.
 *   </Alert>
 *
 *   <Alert type="callout" variant="warning" icon={<FileText className="w-4 h-4 mt-0.5 shrink-0" />}>
 *     File terlalu besar. Maksimal 5MB.
 *   </Alert>
 *
 * ── stripe ──────────────────────────────────────────────────────────────────
 * Bar full-width dengan border-b, konten kiri & kanan (mirip tabel header).
 * Untuk section summary bar seperti "Total Periode Ini: Rp X".
 *
 *   <Alert type="stripe" variant="error" action={<span className="font-black">{formatRupiah(total)}</span>}>
 *     Total Periode Ini
 *   </Alert>
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *   type      'banner' | 'callout' | 'stripe'   default: 'banner'
 *   variant   'error' | 'success' | 'warning' | 'info' | 'neutral'   default: 'error'
 *   icon      ReactNode    override icon (callout); pass null untuk hide icon
 *   action    ReactNode    konten sisi kanan (stripe); aksi tambahan (callout)
 *   animate   boolean      paksa animasi on/off (default: true untuk banner, false untuk lainnya)
 *   className string
 *   children  ReactNode    konten utama
 */

// ── Color tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  error: {
    bg:         'bg-red-50    dark:bg-red-500/10',
    border:     'border-red-100  dark:border-red-500/20',
    borderB:    'border-red-100  dark:border-red-500/20',
    text:       'text-red-500    dark:text-red-400',
    textStrong: 'text-red-700    dark:text-red-300',
    icon:       'text-red-500    dark:text-red-400',
  },
  success: {
    bg:         'bg-green-50   dark:bg-green-500/10',
    border:     'border-green-100 dark:border-green-500/20',
    borderB:    'border-green-100 dark:border-green-500/20',
    text:       'text-green-600   dark:text-green-400',
    textStrong: 'text-green-700   dark:text-green-300',
    icon:       'text-green-600   dark:text-green-400',
  },
  warning: {
    bg:         'bg-orange-50  dark:bg-orange-500/10',
    border:     'border-orange-200 dark:border-orange-500/30',
    borderB:    'border-orange-200 dark:border-orange-500/30',
    text:       'text-orange-600  dark:text-orange-400',
    textStrong: 'text-orange-700  dark:text-orange-300',
    icon:       'text-orange-500  dark:text-orange-400',
  },
  info: {
    bg:         'bg-blue-50    dark:bg-blue-500/10',
    border:     'border-blue-100  dark:border-blue-500/20',
    borderB:    'border-blue-100  dark:border-blue-500/20',
    text:       'text-blue-600    dark:text-blue-400',
    textStrong: 'text-blue-800    dark:text-blue-300',
    icon:       'text-blue-500    dark:text-blue-400',
  },
  neutral: {
    bg:         'bg-slate-100  dark:bg-slate-800',
    border:     'border-slate-200 dark:border-slate-700',
    borderB:    'border-slate-200 dark:border-slate-700',
    text:       'text-slate-600   dark:text-slate-400',
    textStrong: 'text-slate-700   dark:text-slate-300',
    icon:       'text-slate-500   dark:text-slate-400',
  },
};

// ── Default icons per variant ─────────────────────────────────────────────────
const DEFAULT_ICONS = {
  error:   AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info:    Info,
  neutral: null,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Alert({
  type      = 'banner',
  variant   = 'error',
  icon,
  action,
  animate,
  className = '',
  children,
}) {
  const c = COLORS[variant] ?? COLORS.error;

  // ── Banner ──────────────────────────────────────────────────────────────────
  if (type === 'banner') {
    const shouldAnimate = animate ?? true;
    return (
      <div
        className={`
          w-full ${c.bg} ${c.text}
          text-xs font-bold p-2.5 rounded-xl text-center
          border ${c.border}
          ${shouldAnimate ? 'animate-in zoom-in duration-200' : ''}
          ${className}
        `}
      >
        {children}
      </div>
    );
  }

  // ── Callout ─────────────────────────────────────────────────────────────────
  if (type === 'callout') {
    const shouldAnimate = animate ?? false;

    // Resolve icon: prop override → default for variant → null
    let resolvedIcon = null;
    if (icon !== undefined) {
      // caller passed explicit icon (including null to hide)
      resolvedIcon = icon;
    } else {
      const DefaultIcon = DEFAULT_ICONS[variant];
      if (DefaultIcon) {
        resolvedIcon = <DefaultIcon className={`w-4 h-4 mt-0.5 shrink-0 ${c.icon}`} />;
      }
    }

    return (
      <div
        className={`
          ${c.bg} ${c.textStrong}
          p-3 rounded-xl text-xs
          flex items-start gap-2
          border ${c.border}
          ${shouldAnimate ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''}
          ${className}
        `}
      >
        {resolvedIcon}
        <div className="flex-1 min-w-0">
          {children}
        </div>
        {action && (
          <div className="shrink-0 ml-1">{action}</div>
        )}
      </div>
    );
  }

  // ── Stripe ──────────────────────────────────────────────────────────────────
  if (type === 'stripe') {
    const shouldAnimate = animate ?? false;
    return (
      <div
        className={`
          w-full ${c.bg} ${c.textStrong}
          p-3 border-b ${c.borderB}
          flex justify-between items-center gap-3
          ${shouldAnimate ? 'animate-in fade-in duration-200' : ''}
          ${className}
        `}
      >
        <span className="text-xs font-bold truncate">{children}</span>
        {action && (
          <span className="shrink-0">{action}</span>
        )}
      </div>
    );
  }

  return null;
}
