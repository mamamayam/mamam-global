/**
 * Button — komponen tombol global.
 *
 * Props:
 *   variant   'primary' | 'secondary' | 'danger' | 'success' | 'dark' | 'ghost' | 'ghost-danger' | 'ghost-success'
 *             default: 'primary'
 *   size      'xs' | 'sm' | 'md' | 'lg' | 'full'
 *             default: 'md'
 *   disabled  boolean
 *   loading   boolean  — tampilkan spinner, disable klik
 *   icon      ReactNode — icon di kiri label
 *   iconRight ReactNode — icon di kanan label
 *   onClick, type, className, children, ...rest
 *
 * Variants:
 *   primary        → orange-600 / orange-500 dark — CTA utama
 *   secondary      → slate-100 / slate-800 dark   — aksi netral / batal
 *   danger         → red-500 / red-600 dark        — hapus / aksi destruktif
 *   success        → green-600 / green-500 dark    — aksi penambahan / konfirmasi positif
 *   dark           → slate-800 / slate-700 dark    — aksi sekunder yang ditonjolkan (mis. "Tambah X", "Kelola Y")
 *   ghost          → orange-50/10 dengan border    — secondary CTA, outline feel
 *   ghost-danger   → red-50/10 dengan border       — delete yang lebih subtle
 *   ghost-success  → green-50/10 dengan border     — aksi penambahan yang lebih subtle
 *
 * Size:
 *   xs   → px-3 py-1.5 text-[11px]  — badge/chip action
 *   sm   → px-3 py-2   text-xs      — inline action
 *   md   → px-4 py-2.5 text-sm      — default
 *   lg   → px-8 py-3.5 text-sm      — modal CTA
 *   full → w-full py-3.5 text-sm    — full width (modal / form submit)
 *
 * Contoh:
 *   <Button>Simpan</Button>
 *   <Button variant="secondary" onClick={onClose}>Batal</Button>
 *   <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}>Hapus</Button>
 *   <Button variant="success" icon={<Plus className="w-4 h-4" />}>Tambah Penghasilan</Button>
 *   <Button variant="dark" icon={<Plus className="w-4 h-4" />}>Tambah Karyawan</Button>
 *   <Button size="full" loading={isSaving}>Simpan Perubahan</Button>
 */

const VARIANTS = {
  // Gradient accent — senada tombol aktif Sidebar/BottomNav/FAB
  primary: `
    bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white
    hover:shadow-[0_6px_20px_rgba(var(--color-accent-500),0.35)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(var(--color-accent-500),0.25)]
  `,
  secondary: `
    bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200
    hover:bg-slate-200 dark:hover:bg-slate-700
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white
    hover:shadow-[0_6px_20px_rgba(239,68,68,0.35)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(239,68,68,0.25)]
  `,
  success: `
    bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-600 text-white
    hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(16,185,129,0.25)]
  `,
  dark: `
    bg-slate-900 dark:bg-white text-white dark:text-slate-900
    hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(0,0,0,0.1)]
  `,
  // Ganti semua 'orange' menjadi 'accent'
  ghost: `
    bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400
    border border-accent-200 dark:border-accent-500/30
    hover:bg-accent-100 dark:hover:bg-accent-500/15
  `,
  'ghost-danger': `
    bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400
    border border-red-200 dark:border-red-500/30
    hover:bg-red-100 dark:hover:bg-red-500/15
  `,
  'ghost-success': `
    bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
    border border-emerald-200 dark:border-emerald-500/30
    hover:bg-emerald-100 dark:hover:bg-emerald-500/15
  `,
};

const SIZES = {
  xs:   'px-3 py-1.5 text-[11px]',
  sm:   'px-3 py-2 text-xs',
  md:   'px-4 py-2.5 text-sm',
  lg:   'px-8 py-3.5 text-sm',
  full: 'w-full py-3.5 text-sm',
};

export default function Button({
  variant  = 'primary',
  size     = 'md',
  disabled = false,
  loading  = false,
  icon,
  iconRight,
  onClick,
  type     = 'button',
  className = '',
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-bold rounded-2xl transition-all duration-300
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none disabled:active:scale-100
        ${VARIANTS[variant] ?? VARIANTS.primary}
        ${SIZES[size]       ?? SIZES.md}
        ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}