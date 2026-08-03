import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { History, Save, Trash2, TrendingDown, Pencil, X, Settings2, ArrowUpDown } from 'lucide-react';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';
import { Button, Card, Input, Select, Badge, IconButton, EmptyState, SortModal, BulkSelectBar } from '../../components/ui';
import { applySort } from '../../utils/sortUtils';
import { useBulkSelect } from '../../hook/useBulkSelect';
import { useRecycleBin } from '../../hook/useRecycleBin';
import { getActiveCouriers } from '../../features/hrd/utils/payrollLogic';
import { CASH_HOLDER_KASIR, makeCourierCashHolder, getCashHolder, cashHolderLabel } from '../../utils/cashHolders';

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
  // 'kasir' = uang toko/laci kasir (default). employeeId kurir = uang yang
  // sedang dipegang kurir tsb (belum disetor) — lihat utils/cashHolders.js
  const [cashHolderId, setCashHolderId] = useState('kasir');
  const [filterMode, setFilterMode] = useState('hari-ini');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState('date-desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  const {
    isSelecting, setIsSelecting,
    activeItems: visibleExpenses,
    handleDelete: handleDeleteExpense,
    handleBulkSoftDelete: bulkSoftDeleteExpenses,
  } = useRecycleBin(expenses, setExpenses, {
    tableKey: 'expenses',
    itemLabel: 'catatan pengeluaran',
    triggerConfirm, triggerAlert,
  });

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

  const couriers = useMemo(() => getActiveCouriers(employees), [employees]);

  const activeTotal = useMemo(() => {
    return visibleExpenses
      .filter(inc => matchesDateFilter(inc.date))
      .reduce((s, e) => s + e.amount, 0);
  }, [visibleExpenses, filterMode, filterStartDate, filterEndDate]);

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

    // Resolve "siapa yang pegang uangnya" -> object cashHolder yang dibekukan
    // (snapshot nama kurir), mengikuti pola snapshot yang sudah ada di kasbon.
    // Guard: cashHolder kurir cuma valid untuk paymentMethod 'Tunai'. Kalau
    // Non-Tunai, paksa 'kasir' walau cashHolderId state kebetulan masih
    // nyangkut ke kurir (mis. dari sisa state sebelum ganti metode bayar).
    const courier = (paymentMethod === 'Tunai' && cashHolderId !== 'kasir')
      ? couriers.find(c => c.id === cashHolderId)
      : null;
    const cashHolder = courier ? makeCourierCashHolder(courier) : CASH_HOLDER_KASIR;

    if (editingId) {
      setExpenses(expenses.map(exp => exp.id === editingId ? {
        ...exp,
        amount: Number(amount),
        category,
        note,
        date: expenseDate,
        paymentMethod,
        employeeId: isKasbon ? selectedEmployeeId : null,
        employeeName,
        cashHolder
      } : exp));

      setEditingId(null);
      setAmount(''); setNote(''); setSelectedEmployeeId(''); setCashHolderId('kasir');
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
        employeeName,
        cashHolder
      };

      setExpenses([newExp, ...expenses]);
      setAmount(''); setNote(''); setSelectedEmployeeId(''); setCashHolderId('kasir');
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
    const holder = getCashHolder(exp);
    setCashHolderId(holder.type === 'kurir' ? holder.employeeId : 'kasir');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setSelectedEmployeeId('');
    setCashHolderId('kasir');
    setDateInput(toLocalDateString());
  };

  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter(e => matchesDateFilter(e.date));
  }, [visibleExpenses, filterMode, filterStartDate, filterEndDate]);

  const sortedExpenses = useMemo(() => applySort(filteredExpenses, sortKey, {
    date: e => new Date(e.date),
    category: e => e.category || '',
    amount: e => e.amount || 0,
  }), [filteredExpenses, sortKey]);

  const sortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'category-asc', label: 'Kategori (A-Z)' },
    { key: 'category-desc', label: 'Kategori (Z-A)' },
    { key: 'amount-desc', label: 'Nominal Terbesar' },
  ];

  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(sortedExpenses);

  const handleBulkSoftDelete = () => bulkSoftDeleteExpenses([...selectedIds], resetSelection);

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
            label="Tanggal Pengeluaran"
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
            <Select
              value={category}
              onChange={e => { setCategory(e.target.value); setSelectedEmployeeId(''); }}
            >
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
                onClick={() => { setPaymentMethod('Non-Tunai'); setCashHolderId('kasir'); }}
              >
                Non-Tunai
              </Button>
            </div>
          </div>

          {paymentMethod === 'Tunai' && couriers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Dibayar Pakai Uang Siapa?</label>
              <Select
                value={cashHolderId}
                onChange={e => setCashHolderId(e.target.value)}
              >
                <option value="kasir">Kasir / Toko</option>
                {couriers.map(c => <option key={c.id} value={c.id}>{c.name} (Kurir)</option>)}
              </Select>
              {cashHolderId !== 'kasir' && (
                <p className="text-[10px] text-accent-600 dark:text-accent-400 mt-1 italic">
                  *Dicatat pakai cash yang lagi dipegang kurir ini (belum disetor). Cek saldo kurir di tab Setoran Kurir.
                </p>
              )}
            </div>
          )}

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
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0"><History className="w-4 h-4" /> Riwayat Pengeluaran</h3>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button
                onClick={() => { if (isSelecting) resetSelection(); setIsSelecting(v => !v); }}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all duration-300 active:scale-95 shrink-0 ${isSelecting ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}
              >
                {isSelecting ? 'Batal' : 'Pilih'}
              </button>
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
                onDeleteSelected={handleBulkSoftDelete}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sortedExpenses.length === 0 ? (
              <EmptyState
                icon={<TrendingDown className="w-12 h-12" />}
                title="Belum ada pengeluaran pada periode ini."
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
                          {getCashHolder(exp).type === 'kurir' && <Badge variant="warning">💰 {cashHolderLabel(exp)}</Badge>}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {isKasbon && empName ? `[${empName}] ` : ''}{exp.note || 'Tanpa catatan'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-xl text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                      <div className="flex gap-1">
                        {isAdminMode && (
                          <IconButton variant="edit" onClick={() => handleEditClick(exp)} title="Edit Catatan">
                            <Pencil className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        <IconButton variant="delete" onClick={() => handleDeleteExpense(exp.id)} title="Hapus Catatan">
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
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