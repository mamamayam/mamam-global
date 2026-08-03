import { useState, useMemo } from 'react';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../utils/softDelete';
import { pushTransactionDelete } from '../storage/realtimeSync';

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/**
 * State + handler recycle-bin (soft-delete) yang polanya keulang sama
 * persis di semua view transaksi (IncomeView, ExpenseView, CustomerView,
 * AttendanceView, InputDailyTab, ShiftView, HistoryView). Ngurusin: toggle
 * tampilan sampah, single/bulk soft-delete, restore, single/bulk hapus
 * permanen (langsung push ke Supabase saat itu juga, gak nunggu auto-sync).
 *
 * SENGAJA GAK ngurusin: filter tambahan (rentang tanggal dll) & sorting —
 * itu tetap di view masing-masing, nempel DI ATAS activeItems/trashedItems
 * yang dikembalikan di sini. Juga gak ngurusin useBulkSelect (itu hook
 * terpisah) — handler bulk di sini nerima `ids` dari luar.
 *
 * @param {Array} items - array state (misal `incomes`)
 * @param {Function} setItems - setter-nya (misal `setIncomes`)
 * @param {Object} opts
 * @param {string} opts.tableKey - nama tabel Supabase, buat pushTransactionDelete (misal 'incomes')
 * @param {string} opts.itemLabel - noun buat teks confirm/alert, huruf kecil (misal 'catatan pemasukan')
 * @param {Function} opts.triggerConfirm
 * @param {Function} opts.triggerAlert
 */
export function useRecycleBin(items, setItems, { tableKey, itemLabel, triggerConfirm, triggerAlert, permanentDeleteWarning = '' }) {
  const warningSuffix = permanentDeleteWarning ? ` ${permanentDeleteWarning}` : '';
  const [showTrash, setShowTrash] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const activeItems = useMemo(() => activeOnly(items), [items]);
  const trashedItems = useMemo(() => trashedOnly(items), [items]);
  const trashedCount = trashedItems.length;
  const visibleItems = showTrash ? trashedItems : activeItems;

  // ── Single item — `onDone` opsional, dipanggil SETELAH aksi berhasil
  // (setelah confirm buat delete/permanentDelete), buat efek samping
  // spesifik-view kayak nutup popup edit kalau item yang dihapus lagi
  // dibuka editnya ─────────────────────────────────────────────────────
  const handleDelete = (id, onDone) => {
    triggerConfirm(`Pindahkan ${itemLabel} ini ke Recycle Bin?`, () => {
      setItems(items.map(it => it.id === id ? markDeleted(it) : it));
      onDone?.();
      triggerAlert?.(`${capitalize(itemLabel)} dipindahkan ke Recycle Bin.`);
    });
  };

  const handleRestore = (id, onDone) => {
    setItems(items.map(it => it.id === id ? restoreItem(it) : it));
    onDone?.();
    triggerAlert?.(`${capitalize(itemLabel)} berhasil dikembalikan.`);
  };

  const handlePermanentDelete = (id, onDone) => {
    triggerConfirm(`Hapus PERMANEN ${itemLabel} ini?${warningSuffix} Tindakan ini tidak bisa dibatalkan.`, () => {
      setItems(items.filter(it => it.id !== id));
      // Langsung kirim delete ke Supabase saat ini juga, gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
      pushTransactionDelete(tableKey, id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      onDone?.();
      triggerAlert?.(`${capitalize(itemLabel)} dihapus permanen.`);
    });
  };

  // ── Bulk — `ids` dari useBulkSelect (view yang manggil), `onDone`
  // opsional buat resetSelection() SETELAH user konfirmasi (bukan pas
  // klik), biar seleksi gak ke-reset kalau user Batal di modal confirm ──
  const handleBulkSoftDelete = (ids, onDone) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    triggerConfirm(`Pindahkan ${idSet.size} ${itemLabel} terpilih ke Recycle Bin?`, () => {
      setItems(items.map(it => idSet.has(it.id) ? markDeleted(it) : it));
      onDone?.();
      triggerAlert?.(`${capitalize(itemLabel)} terpilih dipindahkan ke Recycle Bin.`);
    });
  };

  const handleBulkPermanentDelete = (ids, onDone) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    triggerConfirm(`Hapus PERMANEN ${idSet.size} ${itemLabel} terpilih?${warningSuffix} Tindakan ini tidak bisa dibatalkan.`, () => {
      setItems(items.filter(it => !idSet.has(it.id)));
      ids.forEach(id => pushTransactionDelete(tableKey, id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      ));
      onDone?.();
      triggerAlert?.(`${capitalize(itemLabel)} terpilih dihapus permanen.`);
    });
  };

  return {
    showTrash, setShowTrash,
    isSelecting, setIsSelecting,
    activeItems, trashedItems, trashedCount, visibleItems,
    handleDelete, handleRestore,
    handlePermanentDelete, handleBulkSoftDelete, handleBulkPermanentDelete,
  };
}
