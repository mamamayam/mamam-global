import { X } from 'lucide-react';
import Modal from './Modal';
import Badge from './Badge';
import Button from './Button';
import { formatRupiah } from '../../utils/formatters';

/**
 * DetailModal — modal generic buat nampilin detail 1 record riwayat/laporan
 * (riwayat order, pemasukan, pengeluaran, shift, dll) secara KONSISTEN & rapi.
 *
 * Kenapa ada ini:
 * Card/row riwayat di grid/list sering kepaksa jejelin banyak info jadi satu
 * baris kecil biar nggak makan tempat (mis. "Saldo Awal: ... | Penjualan: ...
 * | Target: ..."), hasilnya berantakan & kepotong di mobile. Solusinya: card
 * cukup nampilin info PENTING aja (ringkas), sisanya taruh di sini — tinggal
 * tap "Detail" buat liat versi lengkapnya yang rapi & seragam di semua view.
 *
 * Props:
 *   isOpen, onClose      wajib
 *   icon                 ReactNode — icon di kiri title (opsional)
 *   title                string   — judul utama, mis. `#${order.id}`
 *   subtitle             string   — info sekunder di bawah title, mis. tanggal & jam
 *   badges               [{ label, variant }] — badge kecil di bawah title (status, tipe order, dst)
 *   sections             [{ title?, rows: Row[] }] — grup field label:value (info umum)
 *   items                [{ name, note?, qty, price }] — daftar item ala struk (opsional)
 *   itemsTitle           string — judul section items (default: 'Item')
 *   summaryRows          Row[] — baris angka ringkasan di bawah items (Subtotal, Diskon, Pajak, dst)
 *   highlight            Row | Row[] — baris TOTAL yang ditonjolkan gede (Total Tagihan, Selisih, dst)
 *   actions              [{ label, icon?, variant?, onClick, hide? }] — tombol aksi di footer
 *   closeLabel           string — label tombol tutup (default: 'Tutup'); null buat sembunyiin
 *   size                 dilempar ke Modal, default 'md'
 *
 * Row: { label, value, type?, variant?, alwaysShow?, fullWidth? }
 *   type: 'text' (default) | 'currency' | 'date' | 'datetime' | 'badge' | 'multiline'
 *   Row otomatis di-skip kalau value null/undefined/'' (atau currency = 0),
 *   kecuali alwaysShow: true.
 *
 * Contoh pakai:
 *   <DetailModal
 *     isOpen={!!detailOrder}
 *     onClose={() => setDetailOrder(null)}
 *     title={detailOrder && `#${detailOrder.id}`}
 *     subtitle={detailOrder && new Date(detailOrder.date).toLocaleString('id-ID')}
 *     badges={detailOrder && [{ label: detailOrder.paymentMethod, variant: 'success' }]}
 *     sections={[{
 *       rows: [
 *         { label: 'Pelanggan', value: detailOrder?.customerName },
 *         { label: 'Tipe Order', value: detailOrder?.orderType },
 *       ]
 *     }]}
 *     items={detailOrder?.items}
 *     summaryRows={[
 *       { label: 'Subtotal', value: detailOrder?.subtotal },
 *       { label: 'Diskon', value: -(detailOrder?.discount || 0) },
 *     ]}
 *     highlight={{ label: 'Total Tagihan', value: detailOrder?.total }}
 *     actions={[{ label: 'Cetak Struk', onClick: handlePrint }]}
 *   />
 */

const HIGHLIGHT_TONES = {
  default: 'bg-slate-800 dark:bg-slate-700 text-white',
  success: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20',
  danger:  'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20',
  orange:  'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20',
};

// Row dianggap "kosong" dan otomatis disembunyikan, kecuali alwaysShow.
const isRowVisible = (row) => {
  if (!row) return false;
  if (row.alwaysShow) return true;
  if (row.value === null || row.value === undefined || row.value === '') return false;
  if (row.type === 'currency' && Number(row.value) === 0) return false;
  return true;
};

const formatRowValue = (row) => {
  switch (row.type) {
    case 'currency': return formatRupiah(row.value);
    case 'date':     return row.value ? new Date(row.value).toLocaleDateString('id-ID') : '-';
    case 'datetime': return row.value ? new Date(row.value).toLocaleString('id-ID') : '-';
    default:         return row.value;
  }
};

function DetailRow({ row }) {
  if (!isRowVisible(row)) return null;

  if (row.type === 'badge') {
    return (
      <div className="flex justify-between items-center py-2.5 gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{row.label}</span>
        <Badge variant={row.variant || 'neutral'}>{row.value}</Badge>
      </div>
    );
  }

  if (row.type === 'multiline' || row.fullWidth) {
    return (
      <div className="py-2.5">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{row.label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
          {formatRowValue(row)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start py-2.5 gap-3">
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{row.label}</span>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 text-right break-words">
        {formatRowValue(row)}
      </span>
    </div>
  );
}

export default function DetailModal({
  isOpen,
  onClose,
  icon,
  title,
  subtitle,
  badges = [],
  sections = [],
  items,
  itemsTitle = 'Item',
  summaryRows = [],
  highlight,
  actions = [],
  closeLabel = 'Tutup',
  size = 'md',
}) {
  if (!isOpen) return null;

  const visibleSections = sections
    .filter(Boolean)
    .map(section => ({ ...section, rows: (section.rows || []).filter(isRowVisible) }))
    .filter(section => section.rows.length > 0);

  const visibleSummaryRows = (summaryRows || []).filter(isRowVisible);
  const highlights = Array.isArray(highlight) ? highlight.filter(Boolean) : (highlight ? [highlight] : []);
  const visibleActions = (actions || []).filter(a => a && !a.hide);
  const hasItems = items && items.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size} maxHeight>
      {/* Header */}
      <div className="flex justify-between items-start gap-3 border-b border-slate-100 dark:border-slate-800 px-6 pt-6 pb-4 shrink-0">
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2 truncate">
            {icon}{title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
          {badges.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {badges.map((b, i) => <Badge key={i} variant={b.variant}>{b.label}</Badge>)}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-4 overflow-y-auto flex-1 custom-scrollbar">
        {visibleSections.map((section, i) => (
          <div key={i} className={i > 0 ? 'mt-4' : ''}>
            {section.title && (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                {section.title}
              </p>
            )}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 px-4 divide-y divide-slate-100 dark:divide-slate-800">
              {section.rows.map((row, j) => <DetailRow key={j} row={row} />)}
            </div>
          </div>
        ))}

        {hasItems && (
          <div className={visibleSections.length > 0 ? 'mt-4' : ''}>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
              {itemsTitle} ({items.length})
            </p>
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{it.name}</p>
                    {it.note && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{it.note}</p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {it.qty} x {formatRupiah(it.price)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    {formatRupiah(it.qty * it.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleSummaryRows.length > 0 && (
          <div className={`px-1 space-y-1.5 ${(visibleSections.length > 0 || hasItems) ? 'mt-4' : ''}`}>
            {visibleSummaryRows.map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  {row.type ? formatRowValue(row) : formatRupiah(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {highlights.length > 0 && (
          <div className={`grid gap-2 ${highlights.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} mt-4`}>
            {highlights.map((h, i) => (
              <div key={i} className={`rounded-xl p-3.5 ${HIGHLIGHT_TONES[h.tone] || HIGHLIGHT_TONES.default}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">{h.label}</p>
                <p className="text-lg font-black">{h.type === 'text' ? h.value : formatRupiah(h.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {(visibleActions.length > 0 || closeLabel) && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-2 shrink-0 rounded-b-3xl">
          {visibleActions.map((a, i) => (
            <Button key={i} variant={a.variant || 'secondary'} className="flex-1" icon={a.icon} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
          {closeLabel && (
            <Button variant="secondary" className="flex-1" onClick={onClose}>{closeLabel}</Button>
          )}
        </div>
      )}
    </Modal>
  );
}