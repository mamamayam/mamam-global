import React, { useState } from 'react';
import { CircleMinus, History, Save, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatRupiah } from '../utils/formatters';

const ExpenseView = () => {
  const { expenseCategories, setExpenseCategories, expenses, setExpenses, triggerAlert, triggerConfirm, formatRupiah, currentShift } = useAppContext();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0]);
  const [note, setNote] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // Default YYYY-MM

  const handleAddExpense = () => {
    if (!currentShift) return triggerAlert('Shift Kasir belum dibuka! Harap buka shift terlebih dahulu.');
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal pengeluaran yang valid!');
    const newExp = { id: `EXP-${Date.now()}`, amount: Number(amount), category, note, date: new Date() };
    setExpenses([newExp, ...expenses]);
    setAmount(''); setNote('');
    triggerAlert('Pengeluaran berhasil dicatat!');
  };

  const handleDeleteCategory = (cat) => {
    const mandatoryCategories = ['Belanja', 'Biaya', 'Kasbon Karyawan'];
    
    if (mandatoryCategories.includes(cat)) {
       return triggerAlert(`Kategori "${cat}" adalah wajib dan tidak bisa dihapus!`);
    }
    if(expenseCategories.length <= 1) return triggerAlert('Harus ada minimal 1 kategori!');
    
    triggerConfirm(`Apakah Anda yakin ingin menghapus kategori "${cat}"?`, () => {
      setExpenseCategories(expenseCategories.filter(c => c !== cat));
      if(category === cat) setCategory(expenseCategories[0]);
      triggerAlert('Kategori pengeluaran berhasil dihapus.');
    });
  };

  const filteredExpenses = expenses.filter(e => filterMonth === '' || e.date.toISOString().slice(0, 7) === filterMonth);

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <CircleMinus className="w-6 h-6 text-red-500" /> Catat Pengeluaran
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 h-fit transition-shadow duration-300 hover:shadow-md">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nominal (Rp)</label>
            <input type="number" className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none focus:border-slate-800 transition-colors" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
              Kategori
              <span className="text-[10px] text-orange-600 font-bold cursor-pointer hover:underline transition-all" onClick={() => { const c = prompt('Masukkan Nama Kategori Baru:'); if(c && c.trim()) { setExpenseCategories([...expenseCategories, c.trim()]); setCategory(c.trim()); }}}>+ Kategori Baru</span>
            </label>
            <div className="flex gap-2 items-center">
              <select className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none font-semibold text-sm transition-colors focus:border-slate-800" value={category} onChange={e => setCategory(e.target.value)}>
                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => handleDeleteCategory(category)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors" title="Hapus Kategori Aktif"><Trash2 className="w-5 h-5" /></button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Catatan Tambahan</label>
            <input type="text" className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm transition-colors focus:border-slate-800" value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Beli beras 5kg" />
          </div>
          <button onClick={handleAddExpense} className="w-full py-3.5 mt-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
            <Save className="w-4 h-4"/> Simpan Data
          </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[500px]">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 flex items-center gap-2"><History className="w-4 h-4"/> Riwayat Pengeluaran</h3>
            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)} 
                className="p-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none text-slate-600"
              />
              {filterMonth && (
                <button onClick={() => setFilterMonth('')} className="text-[10px] text-slate-400 hover:text-slate-600 underline">Semua</button>
              )}
            </div>
          </div>
          <div className="p-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
             <span className="text-xs font-bold text-red-700">Total Periode Ini:</span>
             <span className="text-sm font-black text-red-700">{formatRupiah(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 animate-in fade-in duration-300">
                <CircleMinus className="w-12 h-12 mb-2 text-slate-400"/>
                <p className="text-center text-slate-500 font-medium">Belum ada pengeluaran pada periode ini.</p>
              </div>
            ) : (
              filteredExpenses.map(exp => (
                <div key={exp.id} className="flex justify-between items-center p-3.5 border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all duration-200 animate-in slide-in-from-left-2 duration-300">
                  <div>
                    <p className="font-bold text-sm text-slate-800 flex items-center gap-2">{exp.category} <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-normal text-[10px]">{exp.date.toLocaleDateString('id-ID')}</span></p>
                    <p className="text-[11px] text-slate-500 mt-1">{exp.note || 'Tanpa catatan'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg text-sm border border-red-100">-{formatRupiah(exp.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseView;