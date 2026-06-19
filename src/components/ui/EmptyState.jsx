/**
 * EmptyState — tampilan konsisten saat list atau data kosong.
 *
 * Props:
 *   icon        ReactNode    — icon besar di tengah (lucide, emoji, dll)
 *   title       string       — judul singkat (wajib)
 *   description string       — penjelasan atau instruksi
 *   action      ReactNode    — tombol aksi (misal "Tambah Pertama")
 *   size        'sm' | 'md' | 'lg'   — ukuran area (default: 'md')
 *   className   string
 *
 * Contoh:
 *   // Minimal
 *   <EmptyState icon={<Package className="w-8 h-8" />} title="Belum ada menu" />
 *
 *   // Dengan aksi
 *   <EmptyState
 *     icon={<Users className="w-8 h-8" />}
 *     title="Belum ada karyawan"
 *     description="Tambahkan data karyawan pertama untuk mulai mencatat absensi"
 *     action={<Button icon={<Plus className="w-4 h-4" />}>Tambah Karyawan</Button>}
 *   />
 *
 *   // Kecil untuk list row kosong
 *   <EmptyState size="sm" title="Tidak ada hasil pencarian" />
 */

const SIZES = {
  sm: { wrapper: 'py-6',  icon: 'w-10 h-10 mb-2', title: 'text-xs', desc: 'text-[11px]' },
  md: { wrapper: 'py-10', icon: 'w-14 h-14 mb-3', title: 'text-sm', desc: 'text-xs'    },
  lg: { wrapper: 'py-16', icon: 'w-16 h-16 mb-4', title: 'text-base', desc: 'text-sm'  },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  size      = 'md',
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md;

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.wrapper} ${className}`}>
      {icon && (
        <div className={`text-slate-300 dark:text-slate-600 ${s.icon}`}>
          {icon}
        </div>
      )}
      <p className={`font-bold text-slate-500 dark:text-slate-400 ${s.title}`}>
        {title}
      </p>
      {description && (
        <p className={`text-slate-400 dark:text-slate-500 mt-1 max-w-xs leading-relaxed ${s.desc}`}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
