/**
 * Card — container section konsisten.
 *
 * Props:
 *   variant   'default' | 'elevated' | 'flush'
 *             default → rounded-2xl, border tipis, shadow kecil (paling umum)
 *             elevated → rounded-3xl, shadow-lg (untuk hero card / summary)
 *             flush → rounded-2xl tanpa border/shadow (untuk nested card)
 *   padding   'none' | 'sm' | 'md' | 'lg'
 *             default: 'md'
 *   onClick   () => void — kalau diisi, card jadi clickable
 *   className string
 *   children  ReactNode
 *
 * Contoh:
 *   <Card>
 *     <p>Konten biasa</p>
 *   </Card>
 *
 *   <Card variant="elevated" padding="lg">
 *     <h2>Summary Keuangan</h2>
 *   </Card>
 *
 *   <Card variant="flush" padding="none" className="border-t border-slate-100 dark:border-slate-800">
 *     ...
 *   </Card>
 */

const VARIANTS = {
  default: `
    bg-white dark:bg-slate-900
    rounded-2xl shadow-sm
    border border-slate-100 dark:border-slate-800
  `,
  elevated: `
    bg-white dark:bg-slate-900
    rounded-3xl shadow-lg
    border border-slate-100 dark:border-slate-800
  `,
  flush: `
    bg-white dark:bg-slate-900
    rounded-2xl
  `,
};

const PADDINGS = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

export default function Card({
  variant   = 'default',
  padding   = 'md',
  onClick,
  className = '',
  children,
  ...rest
}) {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      className={`
        ${VARIANTS[variant] ?? VARIANTS.default}
        ${PADDINGS[padding] ?? PADDINGS.md}
        ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''}
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  );
}
