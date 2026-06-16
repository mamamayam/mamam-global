import React, { useState } from 'react';
import { TrendingUp, History, Save, Trash2, Pencil, X, Settings2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import CategoryModal from '../../components/CategoryModal';

const IncomeView = () => {
  const { incomes, setIncomes, incomeCategories, setIncomeCategories, triggerAlert, triggerConfirm, formatRupiah, currentShift, isAdminMode } = useAppContext();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(incomeCategories[0]);
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [filterMonth, setFilterMonth] = useState(toLocalMonthString()); 
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  // State pelacak data edit
  const [editingId, setEditingId] = useState(null);

  const handleAddIncome = () => {
    if (!currentShift && !editingId) return triggerAlert('Shift Kasir belum dibuka! Harap buka shift terlebih dahulu.');
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal pemasukan yang valid!');
    if (!dateInput) return triggerAlert('Pilih tanggal pemasukan!');

    const incomeDate = new Date(dateInput);

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
      triggerAlert('Pemasukan non-penjualan berhasil diperbarui!');
    } else {
      // === MODE BUAT BARU ===
      const newInc = { id: `INC-${Date.now()}`, amount: Number(amount), category, note, date: incomeDate };
      setIncomes([newInc, ...incomes]);
      setAmount(''); setNote('');
      triggerAlert('Pemasukan non-penjualan berhasil dicatat!');
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
      setIncomes(incomes.filter(i => i.id !== id));
      triggerAlert('Catatan pemasukan berhasil dihapus.');
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setDateInput(toLocalDateString());
  };

  // Konversi ink.date ke bentuk Date Object untuk menghindari crash string saat pembacaan localStorage
  const filteredIncomes = incomes.filter(inc => filterMonth === '' || toLocalMonthString(inc.date) === filterMonth);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-green-500 dark:text-green-400" /> Pemasukan Non-Penjualan
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
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal Pemasukan</label>
            <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold outline-none focus:border-slate-800 dark:focus:border-slate-100 transition-colors" value={dateInput} onChange={e => setDateInput(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nominal (Rp)</label>
            <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl font-bold outline-none focus:border-slate-800 dark:focus:border-slate-100 transition-colors" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex justify-between items-center">
              Kategori
              <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-[10px] text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                <Settings2 className="w-3 h-3" /> Kelola Kategori
              </button>
            </label>
            <select className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none font-semibold text-sm transition-colors focus:border-slate-800 dark:focus:border-slate-100" value={category} onChange={e => setCategory(e.target.value)}>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Catatan Tambahan</label>
            <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none text-sm transition-colors focus:border-slate-800 dark:focus:border-slate-100" value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Modal kembalian pagi" />
          </div>
          <button onClick={handleAddIncome} className={`w-full py-3.5 mt-2 text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500' : 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500'}`}>
            <Save className="w-4 h-4" /> {editingId ? 'Perbarui Data' : 'Simpan Data'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[500px]">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="w-4 h-4" /> Riwayat Pemasukan Lain</h3>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-600 dark:text-slate-300"
              />
              {filterMonth && (
                <button onClick={() => setFilterMonth('')} className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline">Semua</button>
              )}
            </div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-500/10 border-b border-green-100 dark:border-green-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-green-700 dark:text-green-300">Total Periode Ini:</span>
            <span className="text-sm font-black text-green-700 dark:text-green-300">{formatRupiah(filteredIncomes.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredIncomes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 animate-in fade-in duration-300">
                <TrendingUp className="w-12 h-12 mb-2 text-slate-400 dark:text-slate-500" />
                <p className="text-center text-slate-500 dark:text-slate-400 font-medium">Belum ada pemasukan pada periode ini.</p>
              </div>
            ) : (
              filteredIncomes.map(inc => (
                <div key={inc.id} className="flex justify-between items-center p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200 animate-in slide-in-from-left-2 duration-300">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">{inc.category} <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-normal text-[10px]">{new Date(inc.date).toLocaleDateString('id-ID')}</span></p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{inc.note || 'Tanpa catatan'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-lg text-sm border border-green-100 dark:border-green-500/20">+{formatRupiah(inc.amount)}</p>
                    {isAdminMode && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEditClick(inc)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold shadow-sm" title="Edit Catatan">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDeleteIncome(inc.id)} className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 rounded-lg transition-colors shadow-sm" title="Hapus Catatan">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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