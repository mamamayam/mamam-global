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

const ExpenseView = () => {
  const {
    expenseCategories, setExpenseCategories,
    expenses, setExpenses,
    triggerAlert, triggerConfirm, formatRupiah, currentShift,
    employees, employeeDailyRecords, setEmployeeDailyRecords,
    isAdminMode
  } = useAppContext();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0] || 'Belanja');
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [filterMonth, setFilterMonth] = useState(toLocalMonthString());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false); // toggle: riwayat normal vs recycle bin
  const [sortKey, setSortKey] = useState('date-desc'); // dipasangin ke applySort
  const [isSortOpen, setIsSortOpen] = useState(false); // toggle buka SortModal

  const activeTotal = useMemo(() => {
    return activeOnly(expenses)
      .filter(inc => filterMonth === '' || toLocalMonthString(inc.date) === filterMonth)
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, filterMonth]);

  // State untuk melacak data yang sedang diedit
  const [editingId, setEditingId] = useState(null);

  const handleAddExpense = () => {
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal pengeluaran yang valid!');
    if (!dateInput) return triggerAlert('Pilih tanggal pengeluaran!');
    if (category === 'Kasbon Karyawan' && !selectedEmployeeId) return triggerAlert('Pilih karyawan yang melakukan kasbon!');

    const expenseDate = new Date(dateInput);

    if (editingId) {
      // === MODE EDIT (ADMIN) ===
      const updatedExpenses = expenses.map(exp => {
        if (exp.id === editingId) {
          return {
            ...exp,
            amount: Number(amount),
            category,
            note,
            date: expenseDate,
            paymentMethod,
            employeeId: category === 'Kasbon Karyawan' ? selectedEmployeeId : null
          };
        }
        return exp;
      });

      setExpenses(updatedExpenses);
      setEditingId(null);
      setAmount(''); setNote(''); setSelectedEmployeeId('');
      triggerAlert('Pengeluaran berhasil diperbarui!');
    } else {
      // === MODE BUAT BARU ===
      const newExp = {
        id: `EXP-${Date.now()}`,
        amount: Number(amount),
        category,
        note,
        date: expenseDate,
        paymentMethod,
        employeeId: category === 'Kasbon Karyawan' ? selectedEmployeeId : null
      };

      if (category === 'Kasbon Karyawan' && selectedEmployeeId) {
        const dateStr = dateInput;
        const existingRecordIndex = employeeDailyRecords.findIndex(r => r.employeeId === selectedEmployeeId && r.dateStr === dateStr);
        const newDeduction = { id: Date.now().toString(), category: 'Kasbon', amount: Number(amount) };

        if (existingRecordIndex >= 0) {
          const updatedRecords = [...employeeDailyRecords];
          updatedRecords[existingRecordIndex].deductions.push(newDeduction);
          setEmployeeDailyRecords(updatedRecords);
        } else {
          const newRecord = {
            id: `REC-${Date.now()}`,
            employeeId: selectedEmployeeId,
            date: expenseDate,
            dateStr: dateStr,
            hoursWorked: 0,
            additions: [],
            deductions: [newDeduction]
          };
          setEmployeeDailyRecords([...employeeDailyRecords, newRecord]);
        }
      }

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
      // Langsung kirim delete ke Supabase saat ini juga, gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
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

  const filteredExpenses = (showTrash ? trashedOnly(expenses) : activeOnly(expenses)).filter(e => filterMonth === '' || toLocalMonthString(e.date) === filterMonth);

  // Urutkan hasil filter pakai sortKey terpilih
  const sortedExpenses = applySort(filteredExpenses, sortKey, {
    date: e => new Date(e.date),
    category: e => e.category || '',
    amount: e => e.amount || 0,
  });

  const sortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'category-asc', label: 'Kategori (A-Z)' },
    { key: 'category-desc', label: 'Kategori (Z-A)' },
    { key: 'amount-desc', label: 'Nominal Terbesar' },
  ];

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(sortedExpenses);

  // Hapus Banyak SEKALIGUS (Pindah ke Recycle Bin)
  const handleBulkSoftDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} catatan pengeluaran terpilih ke Recycle Bin?`, () => {
      setExpenses(expenses.map(e => selectedIds.has(e.id) ? markDeleted(e) : e));
      resetSelection();
      triggerAlert('Catatan terpilih dipindahkan ke Recycle Bin.');
    });
  };

  // Hapus Banyak SEKALIGUS (Permanen di Recycle Bin)
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="none" className="lg:col-span-1 p-5 space-y-4 h-fit transition-shadow duration-300 hover:shadow-md">
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

          {category === 'Kasbon Karyawan' && (
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

        <Card padding="none" className="lg:col-span-2 flex flex-col h-[600px]">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Pengeluaran'}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowTrash(v => !v); resetSelection(); }}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
              >
                {showTrash ? 'Kembali ke Riwayat' : `Recycle Bin (${trashedOnly(expenses).length})`}
              </button>
              {!showTrash && (
                <>
                  <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-600 dark:text-slate-300" />
                  {filterMonth &&
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setFilterMonth('')}
                    >
                      Semua
                    </Button>
                  }
                </>
              )}
              <button
                type="button"
                onClick={() => setIsSortOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
            </div>
          </div>
          <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border-b border-red-100 dark:border-red-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-accent-700 dark:text-accent-300">Total Periode Ini:</span>
            <span className="text-sm font-black text-red-700 dark:text-red-300">
              {formatRupiah(activeTotal)}
            </span>
          </div>
          {isAdminMode && sortedExpenses.length > 0 && (
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
                const isKasbon = exp.category === 'Kasbon Karyawan';
                const empName = isKasbon && exp.employeeId && employees ? employees.find(e => e.id === exp.employeeId)?.name : null;

                return (
                  <div key={exp.id} className={`flex justify-between items-center p-3.5 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 animate-in slide-in-from-left-2 duration-300 ${isAdminMode && selectedIds.has(exp.id) ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-start gap-2 flex-1 pr-4">
                      {isAdminMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(exp.id)}
                          onChange={() => toggleSelectOne(exp.id)}
                          className="w-4 h-4 mt-0.5 rounded accent-orange-500 cursor-pointer shrink-0"
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
                      <p className="font-bold text-accent-500 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10 px-3 py-1.5 rounded-lg text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                      {isAdminMode && (
                        <div className="flex gap-1">
                          {showTrash ? (
                            <>
                              <IconButton variant="edit" onClick={() => handleRestoreExpense(exp.id)} title="Kembalikan">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton variant="delete" onClick={() => handlePermanentDeleteExpense(exp.id)} title="Hapus Permanen">
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton variant="edit" onClick={() => handleEditClick(exp)} title="Edit Catatan">
                                <Pencil className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton variant="delete" onClick={() => handleDeleteExpense(exp.id)} title="Hapus Catatan">
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div >

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
    </div >
  );
};
export default ExpenseView;