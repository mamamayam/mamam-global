/**
 * SegmentedControl — toggle pilihan (2 opsi atau lebih), gaya tombol sejajar
 * sama lebar. Dipakai untuk status biner / metode pilihan, mis. Masuk-Libur,
 * Tunai-Non Tunai, Penghasilan-Potongan.
 *
 * Tiap opsi bisa punya warna aktifnya sendiri (tone) — jadi cocok dipakai
 * baik untuk toggle "semantik" (mis. hijau utk Masuk, merah utk Libur)
 * maupun toggle "satu warna" (mis. semua opsi pakai merah saat aktif).
 * Saat tidak aktif, semua opsi memakai gaya netral yang sama.
 *
 * Props:
 *   options   Array<{ value, label, tone? }>
 *             tone: 'orange' | 'green' | 'red' | 'red-soft'  (default: 'orange')
 *               orange    → solid bg-accent-600, teks putih
 *               green     → solid bg-green-600, teks putih
 *               red       → solid bg-accent-500, teks putih
 *               red-soft  → bg-accent-50 + border, teks merah (lebih subtle)
 *   value     value yang sedang aktif
 *   onChange  (value) => void
 *   size      'sm' | 'md'   (default: 'md')
 *             sm → py-2 text-xs   md → py-2.5 text-sm
 *   className string — class tambahan untuk wrapper (flex gap-2)
 *
 * Contoh:
 *   <SegmentedControl
 *     options={[
 *       { value: 'masuk', label: 'Masuk', tone: 'green' },
 *       { value: 'libur', label: 'Libur', tone: 'red' },
 *     ]}
 *     value={status}
 *     onChange={setStatus}
 *   />
 *
 *   <SegmentedControl
 *     size="sm"
 *     options={[
 *       { value: 'Tunai', label: 'Tunai', tone: 'red-soft' },
 *       { value: 'Non-Tunai', label: 'Non-Tunai', tone: 'red-soft' },
 *     ]}
 *     value={method}
 *     onChange={setMethod}
 *   />
 */

const ACTIVE_TONES = {
  orange: `
    bg-accent-600 dark:bg-accent-500 text-white
    border-orange-600 dark:border-orange-500
    shadow-sm
  `,
  green: `
    bg-green-600 dark:bg-green-500 text-white
    border-green-600 dark:border-green-500
    shadow-sm
  `,
  red: `
    bg-accent-500 dark:bg-accent-600 text-white
    border-red-500 dark:border-red-600
    shadow-sm
  `,
  'red-soft': `
    bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400
    border-red-200 dark:border-red-500/30
  `,
};

const INACTIVE = `
  bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400
  border-slate-200 dark:border-slate-700
  hover:bg-slate-100 dark:hover:bg-slate-800
`;

const SIZES = {
  sm: 'py-2 text-xs',
  md: 'py-2.5 text-sm',
};

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  className = '',
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              flex-1 rounded-xl font-bold border transition-all duration-200
              ${SIZES[size] ?? SIZES.md}
              ${isActive ? (ACTIVE_TONES[opt.tone] ?? ACTIVE_TONES.orange) : INACTIVE}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
