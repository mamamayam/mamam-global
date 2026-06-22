/**
 * Card — container section konsisten.
 *
 * Props:
 *   variant   'default' | 'elevated' | 'flush' | 'dark' | 'muted' | 'dark-elevated' | 'dark-muted'
 *             default → rounded-2xl, border tipis, shadow kecil (paling umum)
 *             elevated → rounded-3xl, shadow-lg (untuk hero card / summary)
 *             flush → rounded-2xl tanpa border/shadow (untuk nested card)
 *             dark → bg-slate-800, text putih (untuk metric/summary card yang ditonjolkan)
 *             muted → bg-slate-50 dark:bg-slate-950, rounded-xl (panel "sunken"/nested
 *                     di dalam card putih, mis. pembungkus daftar/radio group — pasangan
 *                     dari Input variant="muted")
 *             dark-elevated → bg-slate-900, rounded-3xl, shadow-2xl (hero panel gelap,
 *                     mis. panel hasil kalkulasi/simulasi yang ditonjolkan)
 *             dark-muted → bg-slate-800, rounded-2xl (nested sub-box di dalam
 *                     dark-elevated, mis. highlight box angka di dalam panel gelap)
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
 *   <Card variant="dark" padding="lg">
 *     <p className="text-slate-400 text-xs uppercase">Total Pengeluaran</p>
 *     <h3 className="text-white text-2xl font-black">Rp 1.000.000</h3>
 *   </Card>
 *
 *   <Card variant="muted" padding="sm">
 *     <p className="text-xs font-bold uppercase">Daftar Penyesuaian</p>
 *     ...
 *   </Card>
 *
 *   <Card variant="dark-elevated" padding="lg" className="text-white space-y-6">
 *     <h4 className="font-black border-b border-slate-800 dark:border-slate-100 pb-3">HASIL ANALISA</h4>
 *     <Card variant="dark-muted" padding="lg" className="text-center">
 *       <span className="block text-xs uppercase text-slate-400">HPP per Unit</span>
 *       <span className="block text-3xl font-black text-green-400">Rp 12.500</span>
 *     </Card>
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
  dark: `
    bg-slate-800 text-white
    rounded-2xl shadow-sm
    border border-slate-700 dark:border-slate-300
  `,
  muted: `
    bg-slate-50 dark:bg-slate-950
    rounded-xl
    border border-slate-100 dark:border-slate-800
  `,
  'dark-elevated': `
    bg-slate-900 text-white
    rounded-3xl shadow-2xl
    border border-slate-800 dark:border-slate-100
  `,
  'dark-muted': `
    bg-slate-800
    rounded-2xl
    border border-slate-700 dark:border-slate-300
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
