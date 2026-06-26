/**
 * IconButton — tombol aksi icon (edit, hapus, dll) di dalam baris list / card.
 *
 * Props:
 *   variant   'edit' | 'delete' | 'neutral' | 'success' | 'warning'
 *             default: 'neutral'
 *   size      'sm' | 'md'
 *             default: 'md'
 *   ghost     boolean  — transparan saat idle, baru tampil tinted saat hover
 *             (berlaku untuk variant 'edit'/'delete'; varian lain sudah transparan by default)
 *             default: false
 *   label     string   — teks di kanan icon (opsional, untuk action yang butuh label)
 *   onClick   () => void
 *   disabled  boolean
 *   className string
 *   children  ReactNode  — icon element (wajib)
 *
 * Contoh:
 *   <IconButton variant="edit" onClick={() => handleEdit(item)}>
 *     <Pencil className="w-4 h-4" />
 *   </IconButton>
 *
 *   <IconButton variant="delete" onClick={() => handleDelete(item.id)}>
 *     <Trash2 className="w-4 h-4" />
 *   </IconButton>
 *
 *   // Versi subtle, idle transparan — cocok untuk aksi di pojok card yang hanya
 *   // muncul saat hover/group-hover
 *   <IconButton variant="edit" ghost onClick={() => handleEdit(item)}>
 *     <Pencil className="w-4 h-4" />
 *   </IconButton>
 *
 *   <IconButton variant="neutral" label="Detail">
 *     <ChevronRight className="w-4 h-4" />
 *   </IconButton>
 */

const VARIANTS = {
  edit: `
    bg-blue-50 dark:bg-blue-500/10
    text-blue-600 dark:text-blue-400
    hover:bg-blue-100 dark:hover:bg-blue-500/15
  `,
  delete: `
    bg-accent-50 dark:bg-accent-500/10
    text-accent-600 dark:text-accent-400
    hover:bg-accent-100 dark:hover:bg-accent-500/15
  `,
  neutral: `
    text-slate-400 dark:text-slate-500
    hover:bg-slate-100 dark:hover:bg-slate-800
    hover:text-slate-700 dark:hover:text-slate-300
  `,
  success: `
    bg-green-50 dark:bg-green-500/10
    text-green-600 dark:text-green-400
    hover:bg-green-100 dark:hover:bg-green-500/15
  `,
  warning: `
    bg-yellow-50 dark:bg-yellow-500/10
    text-yellow-600 dark:text-yellow-400
    hover:bg-yellow-100 dark:hover:bg-yellow-500/15
  `,
};

// Versi 'ghost': transparan saat idle, warnanya baru muncul saat hover.
// Dipakai untuk aksi di pojok card/list yang ingin tampil minim sampai di-hover.
const GHOST_VARIANTS = {
  edit: `
    text-blue-600 dark:text-blue-400
    hover:bg-blue-50 dark:hover:bg-blue-500/10
  `,
  delete: `
    text-accent-500 dark:text-accent-400
    hover:bg-accent-50 dark:hover:bg-accent-500/10
  `,
};

const SIZES = {
  sm: 'p-1.5',
  md: 'p-2',
};

export default function IconButton({
  variant  = 'neutral',
  size     = 'md',
  ghost    = false,
  label,
  onClick,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const toneClasses = ghost
    ? (GHOST_VARIANTS[variant] ?? VARIANTS[variant] ?? VARIANTS.neutral)
    : (VARIANTS[variant] ?? VARIANTS.neutral);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5
        rounded-lg transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${toneClasses}
        ${SIZES[size]       ?? SIZES.md}
        ${label ? 'pr-2.5' : ''}
        ${className}
      `}
      {...rest}
    >
      {children}
      {label && (
        <span className="text-[10px] font-bold leading-none">{label}</span>
      )}
    </button>
  );
}
