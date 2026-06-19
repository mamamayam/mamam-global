/**
 * Input / Select / Textarea — form field components dengan dark mode konsisten.
 *
 * Semua field pakai base yang sama:
 *   bg-white dark:bg-slate-900
 *   border border-slate-200 dark:border-slate-700
 *   focus:border-orange-500 dark:focus:border-orange-500
 *   text-slate-800 dark:text-slate-100
 *   rounded-xl
 *
 * === Input ===
 * Props:
 *   label       string       — label di atas field
 *   error       string       — pesan error (merah, di bawah field)
 *   hint        string       — hint text abu-abu (di bawah field)
 *   icon        ReactNode    — icon di kiri (absolute positioned)
 *   disabled    boolean
 *   className   string       — class tambahan untuk <input>
 *   ...rest                  — semua props HTML input (type, value, onChange, placeholder, dll)
 *
 * Contoh:
 *   <Input label="Nama Menu" placeholder="e.g. Nasi Goreng" value={name} onChange={e => setName(e.target.value)} />
 *   <Input type="number" label="Harga" icon={<DollarSign className="w-4 h-4" />} error={errors.harga} />
 *
 * === Select ===
 * Props sama seperti Input.
 * children berisi <option> elements.
 *
 * Contoh:
 *   <Select label="Kategori" value={cat} onChange={e => setCat(e.target.value)}>
 *     <option value="">Pilih kategori</option>
 *     {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 *   </Select>
 *
 * === Textarea ===
 * Props sama, tambahan:
 *   rows  number  — default: 3
 */

// ── Shared label + error wrapper ────────────────────────────────────────────
function FieldWrapper({ label, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Base field classes ───────────────────────────────────────────────────────
const BASE = `
  w-full p-3 text-sm font-medium
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-700
  text-slate-800 dark:text-slate-100
  rounded-xl outline-none
  focus:border-orange-500 dark:focus:border-orange-500
  placeholder:text-slate-300 dark:placeholder:text-slate-600
  transition-colors duration-150
  disabled:opacity-50 disabled:cursor-not-allowed
`;

const ERROR_BORDER = 'border-red-400 dark:border-red-500 focus:border-red-400 dark:focus:border-red-500';

// ── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  icon,
  className = '',
  ...rest
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          className={`
            ${BASE}
            ${icon ? 'pl-9' : ''}
            ${error ? ERROR_BORDER : ''}
            ${className}
          `}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
}

// ── Select ───────────────────────────────────────────────────────────────────
export function Select({
  label,
  error,
  hint,
  className = '',
  children,
  ...rest
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <select
        className={`
          ${BASE}
          cursor-pointer appearance-none
          ${error ? ERROR_BORDER : ''}
          ${className}
        `}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label,
  error,
  hint,
  rows = 3,
  className = '',
  ...rest
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <textarea
        rows={rows}
        className={`
          ${BASE}
          resize-none
          ${error ? ERROR_BORDER : ''}
          ${className}
        `}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── Default export untuk kasus paling umum ───────────────────────────────────
export default Input;
