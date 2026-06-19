import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { History, Save, Trash2, TrendingDown, Pencil, X, Settings2 } from 'lucide-react';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';
import { Button, PageHeader, Card, Input, Select, Badge, IconButton, EmptyState } from '../../components/ui';

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
      setExpenses(expenses.filter(e => e.id !== id));
      triggerAlert('Catatan pengeluaran berhasil dihapus.');
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setSelectedEmployeeId('');
    setDateInput(toLocalDateString());
  };

  const filteredExpenses = expenses.filter(e => filterMonth === '' || toLocalMonthString(e.date) === filterMonth);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <PageHeader
        title="Pengeluaran"
        icon={<TrendingDown className="w-6 h-6 text-red-500 dark:text-red-400" />}
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
            label="Nominal (Rp)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
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
                className="border-orange-200 dark:border-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees && employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </Select>
              <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 italic">*Kasbon ini akan otomatis memotong gaji karyawan terpilih.</p>
            </div>
          )}

<Input
            label="Catatan Tambahan"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Contoh: Modal kembalian pagi"
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

          <Input
            label="Catatan Tambahan"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Contoh: Beli beras 5kg / Kasbon Budi"
          />

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
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="w-4 h-4" /> Riwayat Pengeluaran</h3>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-red-700 dark:text-red-300">Total Periode Ini:</span>
            <span className="text-sm font-black text-red-700 dark:text-red-300">{formatRupiah(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredExpenses.length === 0 ? (
              <EmptyState
                icon={<TrendingDown className="w-12 h-12" />}
                title="Belum ada pengeluaran pada periode ini."
                className="h-full animate-in fade-in duration-300"
              />
            ) : (
              filteredExpenses.map(exp => {
                const isKasbon = exp.category === 'Kasbon Karyawan';
                const empName = isKasbon && exp.employeeId && employees ? employees.find(e => e.id === exp.employeeId)?.name : null;

                return (
                  <div key={exp.id} className="flex justify-between items-center p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 animate-in slide-in-from-left-2 duration-300">
                    <div className="flex-1 pr-4">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                        {exp.category}
                        <Badge variant="neutral">{new Date(exp.date).toLocaleDateString('id-ID')}</Badge>
                        {exp.paymentMethod === 'Non-Tunai' && <Badge variant="info">Bank</Badge>}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {isKasbon && empName ? `[${empName}] ` : ''}{exp.note || 'Tanpa catatan'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                      {isAdminMode && (
                        <div className="flex gap-1">
                          <IconButton variant="edit" onClick={() => handleEditClick(exp)} title="Edit Catatan">
                            <Pencil className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton variant="delete" onClick={() => handleDeleteExpense(exp.id)} title="Hapus Catatan">
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
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