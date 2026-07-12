import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { History, Save, Trash2, TrendingDown, Pencil, X, Settings2, RotateCcw, ArrowUpDown } from 'lucide-react';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';
import { Button, PageHeader, Card, Input, Select, Badge, IconButton, EmptyState, SortModal, BulkSelectBar } from '../../components/ui';
import { applySort } from '../../utils/sortUtils';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { pushTransactionDelete } from '../../storage/realtimeSync';
import { useBulkSelect } from '../../hook/useBulkSelect';

const KASBON_CATEGORY = 'Kasbon Karyawan';

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const ExpenseView = () => {
  const {
    expenseCategories, setExpenseCategories,
    expenses, setExpenses,
    triggerAlert, triggerConfirm, formatRupiah,
    employees, isAdminMode
  } = useAppContext();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0] || 'Belanja');
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [filterMode, setFilterMode] = useState('month');
  const [filterMonth, setFilterMonth] = useState(toLocalMonthString());
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [sortKey, setSortKey] = useState('date-desc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const matchesDateFilter = (date) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'range') {
      if (!filterStartDate && !filterEndDate) return true;
      const d = toLocalDateString(date);
      if (filterStartDate && d < filterStartDate) return false;
      if (filterEndDate && d > filterEndDate) return false;
      return true;
    }
    return filterMonth === '' || toLocalMonthString(date) === filterMonth;
  };

  const activeTotal = useMemo(() => {
    return activeOnly(expenses)
      .filter(inc => matchesDateFilter(inc.date))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, filterMode, filterMonth, filterStartDate, filterEndDate]);

  const [editingId, setEditingId] = useState(null);

  const handleAddExpense = () => {
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal pengeluaran yang valid!');
    if (!dateInput) return triggerAlert('Pilih tanggal pengeluaran!');
    if (category === KASBON_CATEGORY && !selectedEmployeeId) return triggerAlert('Pilih karyawan yang melakukan kasbon!');

    const expenseDate = parseLocalDate(dateInput);
    const isKasbon = category === KASBON_CATEGORY;
    // Snapshot nama karyawan SAAT kasbon dicatat — supaya kalau nama
    // karyawan diedit atau datanya dihapus belakangan, catatan kasbon lama
    // tetap nunjukkin nama yang benar (gak jadi kosong/berubah).
    // employeeId tetap disimpan seperti biasa buat relasi/filter.
    const employeeName = isKasbon
      ? (employees.find(e => e.id === selectedEmployeeId)?.name || null)
      : null;

    if (editingId) {
      setExpenses(expenses.map(exp => exp.id === editingId ? {
        ...exp,
        amount: Number(amount),
        category,
        note,
        date: expenseDate,
        paymentMethod,
        employeeId: isKasbon ? selectedEmployeeId : null,
        employeeName
      } : exp));

      setEditingId(null);
      setAmount(''); setNote(''); setSelectedEmployeeId('');
      triggerAlert('Pengeluaran berhasil diperbarui!');
    } else {
      const newExp = {
        id: `EXP-${Date.now()}`,
        amount: Number(amount),
        category,
        note,
        date: expenseDate,
        paymentMethod,
        employeeId: isKasbon ? selectedEmployeeId : null,
        employeeName
      };

      setExpenses([newExp, ...expenses]);
      setAmount(''); setNote(''); setSelectedEmployeeId('');
      triggerAlert('Pengeluaran berhasil dicatat!');
    }
  };

  const handleEditClick = (exp) => {
    setEditingId(exp.id);
    setAmount(exp.amount);
    setCategory(exp.category);
    setNote(exp.note);
    setDateInput(toLocalDateString(exp.date));
    setPaymentMethod(exp.paymentMethod || 'Tunai');
    setSelectedEmployeeId(exp.employeeId || '');
  };

  const handleDeleteExpense = (id) => {
    triggerConfirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?', () => {
      setExpenses(expenses.map(e => e.id === id ? markDeleted(e) : e));
      triggerAlert('Catatan dipindahkan ke Recycle Bin.');
    });
  };

  const handleRestoreExpense = (id) => {
    setExpenses(expenses.map(e => e.id === id ? restoreItem(e) : e));
    triggerAlert('Catatan berhasil dikembalikan.');
  };

  const handlePermanentDeleteExpense = (id) => {
    triggerConfirm('Hapus PERMANEN catatan ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setExpenses(expenses.filter(e => e.id !== id));
      pushTransactionDelete('expenses', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Catatan dihapus permanen.');
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setSelectedEmployeeId('');
    setDateInput(toLocalDateString());
  };

  const filteredExpenses = useMemo(() => {
    return (showTrash ? trashedOnly(expenses) : activeOnly(expenses))
      .filter(e => matchesDateFilter(e.date));
  }, [expenses, showTrash, filterMode, filterMonth, filterStartDate, filterEndDate]);

  const sortedExpenses = useMemo(() => applySort(filteredExpenses, sortKey, {
    date: e => new Date(e.date),
    category: e => e.category || '',
    amount: e => e.amount || 0,
  }), [filteredExpenses, sortKey]);

  const trashedCount = useMemo(() => trashedOnly(expenses).length, [expenses]);

  const sortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'category-asc', label: 'Kategori (A-Z)' },
    { key: 'category-desc', label: 'Kategori (Z-A)' },
    { key: 'amount-desc', label: 'Nominal Terbesar' },
  ];

  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(sortedExpenses);

  const handleBulkSoftDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} catatan pengeluaran terpilih ke Recycle Bin?`, () => {
      setExpenses(expenses.map(e => selectedIds.has(e.id) ? markDeleted(e) : e));
      resetSelection();
      triggerAlert('Catatan terpilih dipindahkan ke Recycle Bin.');
    });
  };

  const handleBulkPermanentDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} catatan pengeluaran terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setExpenses(expenses.filter(e => !selectedIds.has(e.id)));
      ids.forEach(id => pushTransactionDelete('expenses', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      ));
      resetSelection();
      triggerAlert('Catatan terpilih dihapus permanen.');
    });
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <PageHeader
        title="Pengeluaran"
        icon={<TrendingDown className="w-6 h-6 text-accent-500 dark:text-accent-400" />}
      />
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
            label="Tanggal Pengeluaran"
            value={dateInput}
            onChange={e => setDateInput(e.target.value)}
          />

          <Input
            type="number"
            label="Nominal"
            icon={<span className="font-bold">Rp</span>}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="text-lg font-bold"
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
            <Select
              value={category}
              onChange={e => { setCategory(e.target.value); setSelectedEmployeeId(''); }}
            >
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          {category === KASBON_CATEGORY && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <Select
                label="Pilih Karyawan (Kasbon)"
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="border-accent-200 dark:border-accent-500/30 focus:border-accent-500 dark:focus:border-accent-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees && employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </Select>
              <p className="text-[10px] text-accent-600 dark:text-accent-400 mt-1 italic">*Kasbon ini akan otomatis memotong gaji karyawan terpilih.</p>
            </div>
          )}

          <Input
            label="Catatan Tambahan"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Contoh: Saos BBQ Delmonte"
          />

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Sumber Dana (Metode Bayar)</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={paymentMethod === 'Tunai' ? 'primary' : 'secondary'}
                onClick={() => setPaymentMethod('Tunai')}
              >
                Tunai
              </Button>

              <Button
                size="sm"
                variant={paymentMethod === 'Non-Tunai' ? 'primary' : 'secondary'}
                onClick={() => setPaymentMethod('Non-Tunai')}
              >
                Non-Tunai
              </Button>
            </div>
          </div>

          <Button
            onClick={handleAddExpense}
            size="full"
            variant={editingId ? 'primary' : 'danger'}
            icon={<Save className="w-4 h-4" />}
            className="mt-2"
          >
            {editingId ? 'Perbarui Data' : 'Simpan Data'}
          </Button>
        </Card>

        <Card padding="none" className="lg:col-span-2 flex flex-col h-[600px] w-full min-w-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0"><History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Pengeluaran'}</h3>
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
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all duration-300 active:scale-95 shrink-0 ${isSelecting ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}
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
                    <option value="month">Per Bulan</option>
                    <option value="range">Rentang Tanggal</option>
                    <option value="all">Semua</option>
                  </select>

                  {filterMode === 'month' && (
                    <input
                      type="month"
                      value={filterMonth}
                      onChange={e => setFilterMonth(e.target.value)}
                      className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200 shrink-0 min-w-0 max-w-[140px]"
                    />
                  )}

                  {filterMode === 'range' && (
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
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-red-700 dark:text-red-300">Total Periode Ini:</span>
            <span className="text-sm font-black text-red-700 dark:text-red-300">
              {formatRupiah(activeTotal)}
            </span>
          </div>
          {isSelecting && sortedExpenses.length > 0 && (
            <div className="px-4 pt-3">
              <BulkSelectBar
                count={count}
                total={sortedExpenses.length}
                allSelected={allSelected}
                onToggleAll={toggleSelectAll}
                onDeleteSelected={showTrash ? handleBulkPermanentDelete : handleBulkSoftDelete}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sortedExpenses.length === 0 ? (
              <EmptyState
                icon={showTrash ? <Trash2 className="w-12 h-12" /> : <TrendingDown className="w-12 h-12" />}
                title={showTrash ? 'Recycle bin kosong.' : 'Belum ada pengeluaran pada periode ini.'}
                className="h-full animate-in fade-in duration-300"
              />
            ) : (
              sortedExpenses.map(exp => {
                const isKasbon = exp.category === KASBON_CATEGORY;
                // Prioritaskan snapshot exp.employeeName (dibekukan saat kasbon
                // dicatat). Fallback ke live lookup by employeeId cuma buat
                // catatan kasbon LAMA yang dibuat sebelum field ini ada.
                const empName = isKasbon
                  ? (exp.employeeName || (exp.employeeId && employees ? employees.find(e => e.id === exp.employeeId)?.name : null))
                  : null;

                return (
                  <div key={exp.id} className={`flex justify-between items-center p-3.5 border rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-300 animate-in slide-in-from-left-2 duration-300 ${selectedIds.has(exp.id) ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-start gap-2 flex-1 pr-4">
                      {isSelecting && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(exp.id)}
                          onChange={() => toggleSelectOne(exp.id)}
                          className="w-4 h-4 mt-0.5 rounded accent-[#dc2626] cursor-pointer shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                          {exp.category}
                          <Badge variant="neutral">{new Date(exp.date).toLocaleDateString('id-ID')}</Badge>
                          {exp.paymentMethod === 'Non-Tunai' && <Badge variant="info">Bank</Badge>}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {isKasbon && empName ? `[${empName}] ` : ''}{exp.note || 'Tanpa catatan'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-xl text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                      <div className="flex gap-1">
                        {showTrash ? (
                          isAdminMode && (
                            <>
                              <IconButton variant="edit" onClick={() => handleRestoreExpense(exp.id)} title="Kembalikan">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton variant="delete" onClick={() => handlePermanentDeleteExpense(exp.id)} title="Hapus Permanen">
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </>
                          )
                        ) : (
                          <>
                            {isAdminMode && (
                              <IconButton variant="edit" onClick={() => handleEditClick(exp)} title="Edit Catatan">
                                <Pencil className="w-3.5 h-3.5" />
                              </IconButton>
                            )}
                            <IconButton variant="delete" onClick={() => handleDeleteExpense(exp.id)} title="Hapus Catatan">
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
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
        title="Kelola Kategori Pengeluaran"
        categories={expenseCategories}
        setCategories={setExpenseCategories}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        onDeleteFallback={expenseCategories[0] || 'Belanja'}
        onDelete={(deletedCat) => {
          if (category === deletedCat) setCategory(expenseCategories.find(c => c !== deletedCat) || '');
        }}
      />
    </div>
  );
};
export default ExpenseView;