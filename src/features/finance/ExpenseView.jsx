import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { History, Save, Trash2, TrendingDown, Pencil, X, Settings2 } from 'lucide-react';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';

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
      <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <TrendingDown className="w-6 h-6 text-red-500 dark:text-red-400" /> Catat Pengeluaran
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 h-fit transition-shadow duration-300 hover:shadow-md">
          {editingId && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs font-bold flex justify-between items-center">
              <span>Mode Edit Admin Aktif</span>
              <button onClick={cancelEdit} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-500/15 rounded"><X className="w-3.5 h-3.5"/></button>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal Pengeluaran</label>
            <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold outline-none focus:border-slate-800 dark:focus:border-slate-100 transition-colors" value={dateInput} onChange={e => setDateInput(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex justify-between items-center">
              Kategori
              <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                <Settings2 className="w-3 h-3" /> Kelola Kategori
              </button>
            </label>
            <select className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none font-semibold text-sm transition-colors focus:border-slate-800 dark:focus:border-slate-100" value={category} onChange={e => {setCategory(e.target.value); setSelectedEmployeeId('');}}>
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          {category === 'Kasbon Karyawan' && (
             <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pilih Karyawan (Kasbon)</label>
                <select className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none font-semibold text-sm transition-colors focus:border-orange-500 dark:focus:border-orange-500 border-orange-200 dark:border-orange-500/30" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}>
                  <option value="">-- Pilih Karyawan --</option>
                  {employees && employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 italic">*Kasbon ini akan otomatis memotong gaji karyawan terpilih.</p>
             </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nominal (Rp)</label>
            <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold outline-none focus:border-slate-800 dark:focus:border-slate-100 transition-colors" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Sumber Dana (Metode Bayar)</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPaymentMethod('Tunai')} className={`py-2 rounded-xl text-xs font-bold transition-all border ${paymentMethod === 'Tunai' ? 'bg-slate-800 text-white border-slate-800 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Tunai (Laci)</button>
              <button onClick={() => setPaymentMethod('Non-Tunai')} className={`py-2 rounded-xl text-xs font-bold transition-all border ${paymentMethod === 'Non-Tunai' ? 'bg-slate-800 text-white border-slate-800 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Non-Tunai (Bank)</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Catatan Tambahan</label>
            <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none text-sm transition-colors focus:border-slate-800 dark:focus:border-slate-100" value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Beli beras 5kg / Kasbon Budi" />
          </div>
          <button onClick={handleAddExpense} className={`w-full py-3.5 mt-2 text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500' : 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500'}`}>
            <Save className="w-4 h-4"/> {editingId ? 'Perbarui Data' : 'Simpan Data'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[600px]">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="w-4 h-4"/> Riwayat Pengeluaran</h3>
            <div className="flex items-center gap-2">
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-600 dark:text-slate-300" />
              {filterMonth && <button onClick={() => setFilterMonth('')} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline">Semua</button>}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex justify-between items-center">
             <span className="text-xs font-bold text-red-700 dark:text-red-300">Total Periode Ini:</span>
             <span className="text-sm font-black text-red-700 dark:text-red-300">{formatRupiah(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 animate-in fade-in duration-300">
                <TrendingDown className="w-12 h-12 mb-2 text-slate-400 dark:text-slate-500"/>
                <p className="text-center text-slate-500 dark:text-slate-400 font-medium">Belum ada pengeluaran pada periode ini.</p>
              </div>
            ) : (
              filteredExpenses.map(exp => {
                const isKasbon = exp.category === 'Kasbon Karyawan';
                const empName = isKasbon && exp.employeeId && employees ? employees.find(e => e.id === exp.employeeId)?.name : null;

                return (
                <div key={exp.id} className="flex justify-between items-center p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 animate-in slide-in-from-left-2 duration-300">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                      {exp.category} 
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-normal text-[10px]">{new Date(exp.date).toLocaleDateString('id-ID')}</span>
                      {exp.paymentMethod === 'Non-Tunai' && <span className="bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">Bank</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {isKasbon && empName ? `[${empName}] ` : ''}{exp.note || 'Tanpa catatan'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                    {isAdminMode && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEditClick(exp)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold shadow-sm" title="Edit Catatan">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 rounded-lg transition-colors shadow-sm" title="Hapus Catatan">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      </div>

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