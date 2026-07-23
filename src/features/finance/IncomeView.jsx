import React, { useState, useMemo } from 'react';
import { TrendingUp, History, Save, Trash2, Pencil, X, Settings2, RotateCcw, ArrowUpDown } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';
import { Card, Input, Select, Badge, IconButton, EmptyState, Button, SortModal, BulkSelectBar } from '../../components/ui';
import { applySort } from '../../utils/sortUtils';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { pushTransactionDelete } from '../../storage/realtimeSync';
import { useBulkSelect } from '../../hook/useBulkSelect';

// Parse string "YYYY-MM-DD" dari <input type="date"> sebagai LOCAL midnight.
// PENTING: jangan pakai `new Date("YYYY-MM-DD")` langsung — JS selalu
// menganggap format date-only itu sebagai UTC midnight, bukan local midnight.
// Di WIB (UTC+7) itu geser jadi jam 07:00 pagi local, sehingga transaksi yang
// dicatat "hari ini" bisa keitung terjadi SEBELUM shift dibuka (kalau shift
// baru buka setelah jam 07:00) dan otomatis ke-exclude dari filter dompet
// di ShiftView (`new Date(item.date) >= currentShift.startTime`).
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const IncomeView = () => {
  const { incomes, setIncomes, incomeCategories, setIncomeCategories, triggerAlert, triggerConfirm, formatRupiah, currentShift, isAdminMode } = useAppContext();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(incomeCategories[0] || 'Lainnya');
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [filterMode, setFilterMode] = useState('hari-ini'); // 'hari-ini' | 'kemarin' | 'bulan-ini' | 'semua' | 'tanggal-terpilih'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false); // toggle: riwayat normal vs recycle bin
  const [sortKey, setSortKey] = useState('date-desc'); // dipasangin ke applySort
  const [isSortOpen, setIsSortOpen] = useState(false); // toggle buka SortModal
  const [isSelecting, setIsSelecting] = useState(false); // toggle mode "Pilih" utk bulk delete

  // Cek apakah sebuah tanggal transaksi lolos filter aktif.
  // Perbandingan rentang tanggal pakai string "YYYY-MM-DD" langsung (toLocalDateString),
  // aman dibandingkan leksikografis tanpa perlu konversi ke Date/timestamp.
  const matchesDateFilter = (date) => {
    const d = toLocalDateString(date);
    if (filterMode === 'semua') return true;
    if (filterMode === 'hari-ini') return d === toLocalDateString();
    if (filterMode === 'kemarin') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return d === toLocalDateString(yesterday);
    }
    if (filterMode === 'bulan-ini') return toLocalMonthString(date) === toLocalMonthString();
    if (filterMode === 'tanggal-terpilih') {
      if (!filterStartDate) return true;
      // Hybrid: kalau filterEndDate kosong, otomatis single-day (= filterStartDate)
      const end = filterEndDate || filterStartDate;
      return d >= filterStartDate && d <= end;
    }
    return true;
  };

  const activeTotal = useMemo(() => {
    return activeOnly(incomes)
      .filter(inc => matchesDateFilter(inc.date))
      .reduce((s, e) => s + e.amount, 0);
  }, [incomes, filterMode, filterStartDate, filterEndDate]);


  // State pelacak data edit
  const [editingId, setEditingId] = useState(null);

  const handleAddIncome = () => {
    if (!currentShift && !editingId) return triggerAlert('Shift Kasir belum dibuka! Harap buka shift terlebih dahulu.');
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal pemasukan yang valid!');
    if (!dateInput) return triggerAlert('Pilih tanggal pemasukan!');

    const incomeDate = parseLocalDate(dateInput);

    if (editingId) {
      // === MODE EDIT (ADMIN) ===
      const updatedIncomes = incomes.map(inc => {
        if (inc.id === editingId) {
          return {
            ...inc,
            amount: Number(amount),
            category,
            note,
            date: incomeDate
          };
        }
        return inc;
      });
      setIncomes(updatedIncomes);
      setEditingId(null);
      setAmount(''); setNote('');
      triggerAlert('Pemasukan berhasil diperbarui!');
    } else {
      // === MODE BUAT BARU ===
      const newInc = { id: `INC-${Date.now()}`, amount: Number(amount), category, note, date: incomeDate };
      setIncomes([newInc, ...incomes]);
      setAmount(''); setNote('');
      triggerAlert('Pemasukan berhasil dicatat!');
    }
  };

  const handleEditClick = (inc) => {
    setEditingId(inc.id);
    setAmount(inc.amount);
    setCategory(inc.category);
    setNote(inc.note);
    setDateInput(toLocalDateString(inc.date));
  };

  const handleDeleteIncome = (id) => {
    triggerConfirm('Apakah Anda yakin ingin menghapus catatan pemasukan ini?', () => {
      setIncomes(incomes.map(i => i.id === id ? markDeleted(i) : i));
      triggerAlert('Catatan dipindahkan ke Recycle Bin.');
    });
  };

  const handleRestoreIncome = (id) => {
    setIncomes(incomes.map(i => i.id === id ? restoreItem(i) : i));
    triggerAlert('Catatan berhasil dikembalikan.');
  };

  const handlePermanentDeleteIncome = (id) => {
    triggerConfirm('Hapus PERMANEN catatan ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setIncomes(incomes.filter(i => i.id !== id));
      // Langsung kirim delete ke Supabase saat ini juga, gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
      pushTransactionDelete('incomes', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Catatan dihapus permanen.');
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setDateInput(toLocalDateString());
  };

  const filteredIncomes = useMemo(() => {
    return (showTrash ? trashedOnly(incomes) : activeOnly(incomes))
      .filter(inc => matchesDateFilter(inc.date));
  }, [incomes, showTrash, filterMode, filterStartDate, filterEndDate]);

  // Urutkan hasil filter pakai sortKey terpilih
  const sortedIncomes = useMemo(() => applySort(filteredIncomes, sortKey, {
    date: inc => new Date(inc.date),
    category: inc => inc.category || '',
    amount: inc => inc.amount || 0,
  }), [filteredIncomes, sortKey]);

  const trashedCount = useMemo(() => trashedOnly(incomes).length, [incomes]);

  const sortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'category-asc', label: 'Kategori (A-Z)' },
    { key: 'category-desc', label: 'Kategori (Z-A)' },
    { key: 'amount-desc', label: 'Nominal Terbesar' },
  ];

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(sortedIncomes);

  // Hapus Banyak SEKALIGUS (Pindah ke Recycle Bin)
  const handleBulkSoftDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} catatan pemasukan terpilih ke Recycle Bin?`, () => {
      setIncomes(incomes.map(i => selectedIds.has(i.id) ? markDeleted(i) : i));
      resetSelection();
      triggerAlert('Catatan terpilih dipindahkan ke Recycle Bin.');
    });
  };

  // Hapus Banyak SEKALIGUS (Permanen di Recycle Bin)
  const handleBulkPermanentDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} catatan pemasukan terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setIncomes(incomes.filter(i => !selectedIds.has(i.id)));
      ids.forEach(id => pushTransactionDelete('incomes', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      ));
      resetSelection();
      triggerAlert('Catatan terpilih dihapus permanen.');
    });
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full min-w-0">
        <Card padding="none" className="lg:col-span-1 p-5 space-y-4 h-fit w-full min-w-0 transition-shadow duration-300 hover:shadow-md">
          {editingId && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs font-bold flex justify-between items-center">
              <span>Mode Edit Admin Aktif</span>
              <button onClick={cancelEdit} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-500/15 rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <Input
            type="date"
            label="Tanggal Pemasukan"
            value={dateInput}
            onChange={e => setDateInput(e.target.value)}
          />

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</label>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => setIsCategoryModalOpen(true)}
                icon={<Settings2 className="w-3 h-3" />}
              >
                Kelola Kategori
              </Button>
            </div>
            <Select value={category} onChange={e => setCategory(e.target.value)}>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <Input
            type="number"
            label="Nominal"
            icon={<span className="font-bold">Rp</span>}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="text-lg font-bold"
          />

          <Input
            label="Catatan Tambahan"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Contoh: Tambahan Kas"
          />

          <Button
            onClick={handleAddIncome}
            size="full"
            variant={editingId ? 'primary' : 'success'}
            icon={<Save className="w-4 h-4" />}
            className="mt-2"
          >
            {editingId ? 'Perbarui Data' : 'Simpan Data'}
          </Button>
        </Card>

        <Card padding="none" className="lg:col-span-2 flex flex-col h-[500px] w-full min-w-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0"><History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Pemasukan'}</h3>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {isAdminMode && (
                <button
                  onClick={() => { setShowTrash(v => !v); resetSelection(); setIsSelecting(false); }}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors shrink-0"
                >
                  {showTrash ? 'Kembali ke Riwayat' : `Recycle Bin (${trashedCount})`}
                </button>
              )}
              <button
                onClick={() => { if (isSelecting) resetSelection(); setIsSelecting(v => !v); }}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all duration-300 active:scale-95 shrink-0 ${isSelecting ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}
              >
                {isSelecting ? 'Batal' : 'Pilih'}
              </button>
              {!showTrash && (
                <>
                  <select
                    value={filterMode}
                    onChange={e => setFilterMode(e.target.value)}
                    className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200 shrink-0"
                  >
                    <option value="hari-ini">Hari Ini</option>
                    <option value="kemarin">Kemarin</option>
                    <option value="bulan-ini">Bulan Ini</option>
                    <option value="semua">Semua</option>
                    <option value="tanggal-terpilih">Tanggal Terpilih</option>
                  </select>

                  {filterMode === 'tanggal-terpilih' && (
                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                        max={filterEndDate || undefined}
                        className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200 shrink-0 min-w-0 max-w-[130px]"
                      />
                      <span className="text-xs text-slate-400 shrink-0">-</span>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                        min={filterStartDate || undefined}
                        className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200 shrink-0 min-w-0 max-w-[130px]"
                      />
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setIsSortOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 transition-all duration-300 active:scale-95 shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Total Periode Ini:</span>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
              {formatRupiah(activeTotal)}
            </span>
          </div>
          {isSelecting && sortedIncomes.length > 0 && (
            <div className="px-4 pt-3">
              <BulkSelectBar
                count={count}
                total={sortedIncomes.length}
                allSelected={allSelected}
                onToggleAll={toggleSelectAll}
                onDeleteSelected={showTrash ? handleBulkPermanentDelete : handleBulkSoftDelete}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sortedIncomes.length === 0 ? (
              <EmptyState
                icon={showTrash ? <Trash2 className="w-12 h-12" /> : <TrendingUp className="w-12 h-12" />}
                title={showTrash ? 'Recycle bin kosong.' : 'Belum ada pemasukan pada periode ini.'}
                className="h-full animate-in fade-in duration-300"
              />
            ) : (
              sortedIncomes.map(inc => (
                <div key={inc.id} className={`flex justify-between items-center p-3.5 border rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-300 animate-in slide-in-from-left-2 duration-300 ${selectedIds.has(inc.id) ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex items-start gap-2 flex-1 pr-4">
                    {isSelecting && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inc.id)}
                        onChange={() => toggleSelectOne(inc.id)}
                        className="w-4 h-4 mt-0.5 rounded accent-[#059669] cursor-pointer shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">{inc.category} <Badge variant="neutral">{new Date(inc.date).toLocaleDateString('id-ID')}</Badge></p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{inc.note || 'Tanpa catatan'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl text-sm border border-emerald-100 dark:border-emerald-500/20">+{formatRupiah(inc.amount)}</p>
                    <div className="flex gap-1">
                      {showTrash ? (
                        isAdminMode && (
                          <>
                            <IconButton variant="edit" onClick={() => handleRestoreIncome(inc.id)} title="Kembalikan">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton variant="delete" onClick={() => handlePermanentDeleteIncome(inc.id)} title="Hapus Permanen">
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </>
                        )
                      ) : (
                        <>
                          {isAdminMode && (
                            <IconButton variant="edit" onClick={() => handleEditClick(inc)} title="Edit Catatan">
                              <Pencil className="w-3.5 h-3.5" />
                            </IconButton>
                          )}
                          <IconButton variant="delete" onClick={() => handleDeleteIncome(inc.id)} title="Hapus Catatan">
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <SortModal
        isOpen={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        value={sortKey}
        onChange={setSortKey}
        options={sortOptions}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Kelola Kategori Pemasukan"
        categories={incomeCategories}
        setCategories={setIncomeCategories}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        onDeleteFallback={incomeCategories[0] || 'Lainnya'}
        onDelete={(deletedCat) => {
          if (category === deletedCat) setCategory(incomeCategories.find(c => c !== deletedCat) || '');
        }}
      />
    </div>
  );
};

export default IncomeView;