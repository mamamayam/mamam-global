/**
 * PageHeader — header konsisten untuk semua view/halaman.
 *
 * Props:
 *   title     string       — judul halaman (wajib)
 *   subtitle  string       — info sekunder di bawah atau di samping judul
 *   icon      ReactNode    — icon di kiri judul (lucide, dsb)
 *   action    ReactNode    — elemen di kanan (tombol tambah, dll)
 *   className string
 *
 * Layout: icon? + judul / subtitle — [action]
 *
 * Contoh:
 *   <PageHeader
 *     title="Manajemen Menu"
 *     subtitle={`${menus.length} item`}
 *     icon={<UtensilsCrossed className="w-6 h-6" />}
 *     action={<Button icon={<Plus className="w-4 h-4" />}>Tambah Menu</Button>}
 *   />
 *
 *   // Minimal
 *   <PageHeader title="Laporan Keuangan" />
 */

export default function PageHeader({
  title,
  subtitle,
  icon,
  action,
  className = '',
}) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="text-accent-500 dark:text-accent-400 shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-xl md:text-2xl font-black tracking-tight leading-tight truncate bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="shrink-0 ml-3">
          {action}
        </div>
      )}
    </div>
  );
}
