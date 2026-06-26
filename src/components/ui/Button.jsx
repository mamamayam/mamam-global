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
  // Ganti semua 'orange' menjadi 'accent'
  primary: `
    bg-accent-600 dark:bg-accent-500 text-white
    hover:bg-accent-700 dark:hover:bg-accent-600
    hover:shadow-md hover:-translate-y-0.5
    shadow-sm
  `,
  secondary: `
    bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200
    hover:bg-slate-200 dark:hover:bg-slate-700
  `,
  danger: `
    bg-accent-500 dark:bg-accent-600 text-white
    hover:bg-accent-600 dark:hover:bg-accent-500
    hover:shadow-md hover:-translate-y-0.5
    shadow-sm
  `,
  success: `
    bg-green-600 dark:bg-green-500 text-white
    hover:bg-green-700 dark:hover:bg-green-600
    hover:shadow-md hover:-translate-y-0.5
    shadow-sm
  `,
  dark: `
    bg-slate-800 dark:bg-slate-700 text-white
    hover:bg-slate-900 dark:hover:bg-slate-600
    hover:shadow-md hover:-translate-y-0.5
    shadow-sm
  `,
  // Ganti semua 'orange' menjadi 'accent'
  ghost: `
    bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400
    border border-accent-200 dark:border-accent-500/30
    hover:bg-accent-100 dark:hover:bg-accent-500/15
  `,
  'ghost-danger': `
    bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400
    border border-red-200 dark:border-red-500/30
    hover:bg-accent-100 dark:hover:bg-accent-500/15
  `,
  'ghost-success': `
    bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400
    border border-green-200 dark:border-green-500/30
    hover:bg-green-100 dark:hover:bg-green-500/15
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
        font-bold rounded-xl transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
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
