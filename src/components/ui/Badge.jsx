/**
 * Badge — chip status / label kecil.
 *
 * Props:
 *   variant   'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'
 *             default: 'neutral'
 *   dot       boolean — tampilkan dot sebelum teks (default: false)
 *   size      'sm' | 'md'   (default: 'sm')
 *   className string
 *   children  ReactNode
 *
 * Contoh:
 *   <Badge variant="success">Aktif</Badge>
 *   <Badge variant="warning" dot>Menunggu</Badge>
 *   <Badge variant="danger">Dihapus</Badge>
 *   <Badge variant="orange">On Progress</Badge>
 */

const VARIANTS = {
  success: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400',
  warning: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  danger:  'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400',
  info:    'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  orange:  'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400',
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

const DOT_COLORS = {
  success: 'bg-green-500 dark:bg-green-400',
  warning: 'bg-yellow-500 dark:bg-yellow-400',
  danger:  'bg-accent-500 dark:bg-accent-400',
  info:    'bg-blue-500 dark:bg-blue-400',
  orange:  'bg-accent-500 dark:bg-accent-400',
  neutral: 'bg-slate-400 dark:bg-slate-500',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({
  variant   = 'neutral',
  dot       = false,
  size      = 'sm',
  className = '',
  children,
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-bold rounded-full
        ${VARIANTS[variant] ?? VARIANTS.neutral}
        ${SIZES[size]       ?? SIZES.sm}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[variant] ?? DOT_COLORS.neutral}`}
        />
      )}
      {children}
    </span>
  );
}
