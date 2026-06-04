import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Clock, FileText, History, Printer, Edit, X } from 'lucide-react'; // Tambah Edit & X
import { useState, useMemo } from 'react';

const ShiftView = () => {
  const { currentShift, setCurrentShift, shiftHistory, setShiftHistory, salesHistory, expenses, incomes, formatRupiah, triggerAlert, triggerConfirm, storeSettings } = useAppContext();
  
  // =========================================================================
  // SLOT AUTENTIKASI (Siap disambungkan)
  // =========================================================================
  // TODO: Hubungkan ini dengan state user dari sistem Auth Anda nantinya.
  // Contoh jika pakai context: const { user } = useAuth(); const currentUserRole = user?.role;
  const currentUserRole = 'admin'; // Ubah sementara ke 'kasir' untuk melihat tombol edit hilang
  // =========================================================================

  const [initialCashInput, setInitialCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [showXReading, setShowXReading] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState(null);

  // State untuk Fitur Edit (Khusus Admin)
  const [editingShift, setEditingShift] = useState(null);
  const [editActualCashInput, setEditActualCashInput] = useState('');

  // Filter Bulan untuk Rekapitulasi Riwayat Shift di Bagian Bawah
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // Default YYYY-MM

  // Calculate stats for current shift
  const shiftStats = useMemo(() => {
    if (!currentShift) return null;
    const start = currentShift.startTime;
    
    // Penjualan Tunai
    const shiftSales = salesHistory.filter(s => new Date(s.date) >= start);
    let cashSalesTotal = 0;
    shiftSales.forEach(sale => {
      if (sale.paymentMethod === 'Tunai') cashSalesTotal += sale.total;
      else if (sale.paymentMethod === 'Split Payment') {
        sale.splitDetails.forEach(p => { if(p.method === 'Tunai') cashSalesTotal += p.amount; });
      }
    });

    // Pemasukan & Pengeluaran
    const shiftIncomes = incomes.filter(i => new Date(i.date) >= start);
    const shiftExpenses = expenses.filter(e => new Date(e.date) >= start);
    
    const cashIncomeTotal = shiftIncomes.reduce((s, i) => s + i.amount, 0);
    const cashExpenseTotal = shiftExpenses.reduce((s, e) => s + e.amount, 0);

    const expectedCash = currentShift.initialCash + cashSalesTotal + cashIncomeTotal - cashExpenseTotal;

    return {
      initialCash: currentShift.initialCash,
      cashSales: cashSalesTotal,
      cashIncomes: cashIncomeTotal,
      cashExpenses: cashExpenseTotal,
      expectedCash
    };
  }, [currentShift, salesHistory, expenses, incomes]);

  const handleOpenShift = () => {
    if (!initialCashInput || Number(initialCashInput) < 0) return triggerAlert('Masukkan nominal saldo awal yang valid.');
    setCurrentShift({
      id: `SHIFT-${Date.now().toString().slice(-6)}`,
      startTime: new Date(),
      initialCash: Number(initialCashInput)
    });
    setInitialCashInput('');
    triggerAlert('Shift Kasir berhasil dibuka!');
  };

  const handleCloseShift = () => {
    if (!actualCashInput || Number(actualCashInput) < 0) return triggerAlert('Masukkan uang fisik (aktual) yang ada di laci kasir.');
    
    const actualCash = Number(actualCashInput);
    const difference = actualCash - shiftStats.expectedCash;
    
    const shiftData = {
      ...currentShift,
      endTime: new Date(),
      stats: shiftStats,
      actualCash,
      difference
    };

    triggerConfirm(`Apakah Anda yakin ingin menutup shift ini? Semua transaksi selanjutnya tidak akan terekap di shift ini.`, () => {
      setShiftHistory([shiftData, ...shiftHistory]);
      setClosedShiftData(shiftData);
      setCurrentShift(null);
      setActualCashInput('');
      setShowXReading(true);
    });
  };

  // --- Fungsi Handle Edit Shift (Admin Only) ---
  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setEditActualCashInput(shift.actualCash.toString());
  };

  const handleSaveEdit = () => {
    if (!editActualCashInput || Number(editActualCashInput) < 0) {
      return triggerAlert('Masukkan nominal uang aktual yang valid.');
    }

    const newActualCash = Number(editActualCashInput);
    const newDifference = newActualCash - editingShift.stats.expectedCash;

    const updatedShift = {
      ...editingShift,
      actualCash: newActualCash,
      difference: newDifference
    };

    const updatedHistory = shiftHistory.map(s => s.id === updatedShift.id ? updatedShift : s);
    
    setShiftHistory(updatedHistory);
    triggerAlert(`Data laporan ${updatedShift.id} berhasil diperbarui.`);
    setEditingShift(null);
  };
  // ---------------------------------------------

  // Filter riwayat shift berdasarkan bulan yang dipilih
  const filteredShiftHistory = useMemo(() => {
    return shiftHistory.filter(shift => {
      if (!filterMonth) return true;
      const shiftDateStr = new Date(shift.startTime).toISOString().slice(0, 7);
      return shiftDateStr === filterMonth;
    });
  }, [shiftHistory, filterMonth]);

  // Statistik rekapitulasi shift pada periode terpilih
  const rekapShiftStats = useMemo(() => {
    let totalInitial = 0;
    let totalSales = 0;
    let totalIncomes = 0;
    let totalExpenses = 0;
    let totalExpected = 0;
    let totalActual = 0;
    let totalDifference = 0;

    filteredShiftHistory.forEach(shift => {
      totalInitial += shift.stats.initialCash || 0;
      totalSales += shift.stats.cashSales || 0;
      totalIncomes += shift.stats.cashIncomes || 0;
      totalExpenses += shift.stats.cashExpenses || 0;
      totalExpected += shift.stats.expectedCash || 0;
      totalActual += shift.actualCash || 0;
      totalDifference += shift.difference || 0;
    });

    return {
      totalInitial,
      totalSales,
      totalIncomes,
      totalExpenses,
      totalExpected,
      totalActual,
      totalDifference
    };
  }, [filteredShiftHistory]);

  if (showXReading && closedShiftData) {
    return (
      <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto items-center animate-in fade-in duration-300">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #xreading-content, #xreading-content * { visibility: visible; }
            #xreading-content { position: absolute; left: 0; top: 0; width: ${storeSettings.paperSize === '80mm' ? '80mm' : '58mm'}; margin: 0; padding: 0; box-shadow: none; font-family: monospace; font-size: 11px; }
            @page { margin: 0; }
          }
        `}} />

        <div id="xreading-content" className="bg-white p-6 w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 print:shadow-none print:border-none">
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800 mb-1 print:text-lg">X-READING</h2>
            <p className="text-[10px] text-slate-500 print:text-black">LAPORAN TUTUP SHIFT</p>
            <p className="text-[10px] text-slate-500 mt-2 print:mt-1 print:text-black">ID: {closedShiftData.id}</p>
          </div>
          
          <div className="space-y-1 text-xs mb-4 print:mb-2 print:text-black">
            <div className="flex justify-between"><span>Buka:</span> <span>{closedShiftData.startTime.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Tutup:</span> <span>{closedShiftData.endTime.toLocaleString('id-ID')}</span></div>
          </div>

          <div className="border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2 text-xs space-y-1.5 print:text-black">
            <div className="flex justify-between"><span>Saldo Awal (Modal)</span> <span>{formatRupiah(closedShiftData.stats.initialCash)}</span></div>
            <div className="flex justify-between"><span>Penjualan Tunai</span> <span>{formatRupiah(closedShiftData.stats.cashSales)}</span></div>
            <div className="flex justify-between"><span>Pemasukan Lain</span> <span>{formatRupiah(closedShiftData.stats.cashIncomes)}</span></div>
            <div className="flex justify-between text-red-500 print:text-black"><span>Pengeluaran Kasir</span> <span>-{formatRupiah(closedShiftData.stats.cashExpenses)}</span></div>
          </div>

          <div className="space-y-1.5 text-xs print:text-black">
            <div className="flex justify-between font-bold"><span>Total Seharusnya di Laci</span> <span>{formatRupiah(closedShiftData.stats.expectedCash)}</span></div>
            <div className="flex justify-between font-bold"><span>Uang Fisik Aktual</span> <span>{formatRupiah(closedShiftData.actualCash)}</span></div>
            <div className={`flex justify-between font-bold pt-2 mt-2 border-t border-slate-200 print:border-black ${closedShiftData.difference < 0 ? 'text-red-500' : closedShiftData.difference > 0 ? 'text-green-500' : 'text-slate-800'}`}>
              <span>{closedShiftData.difference < 0 ? 'SELISIH KURANG (SHORT)' : closedShiftData.difference > 0 ? 'SELISIH LEBIH (OVER)' : 'BALANCE (PAS)'}</span>
              <span>{formatRupiah(closedShiftData.difference)}</span>
            </div>
          </div>

          <div className="text-center mt-8 text-[10px] text-slate-500 print:mt-4 print:text-black">
             <p>-- Akhir Laporan X-Reading --</p>
          </div>
        </div>

        <div className="flex gap-2 mt-6 print:hidden w-full max-w-sm">
          <button onClick={() => window.print()} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Cetak</button>
          <button onClick={() => setShowXReading(false)} className="flex-1 py-3 bg-white text-slate-800 border border-slate-200 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors">Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar relative">
      <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Clock className="w-6 h-6 text-slate-800" /> Manajemen Shift Kasir
      </h2>

      {!currentShift ? (
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-lg border border-slate-100 text-center animate-in zoom-in-95 duration-500 mt-10 mb-8 shrink-0">
           <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="w-8 h-8" /></div>
           <h3 className="font-heading text-2xl font-black text-slate-800 mb-2">Buka Shift Kasir</h3>
           <p className="text-slate-500 text-sm mb-6">Masukkan jumlah uang tunai fisik yang ada di dalam laci kasir saat ini sebagai modal kembalian.</p>
           
           <div className="text-left mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-2">Saldo Awal (Modal Tunai)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                <input type="number" className="w-full pl-12 pr-4 py-3 text-lg font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 bg-slate-50 transition-colors" value={initialCashInput} onChange={e => setInitialCashInput(e.target.value)} placeholder="0" />
              </div>
           </div>
           
           <button onClick={handleOpenShift} className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl text-lg shadow-lg hover:bg-slate-900 hover:-translate-y-0.5 transition-all">Mulai Shift</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mb-8 shrink-0">
           <div className="bg-slate-800 rounded-3xl shadow-lg p-6 text-white flex flex-col justify-between relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
              <div className="absolute top-0 right-0 p-8 opacity-10"><FileText className="w-32 h-32"/></div>
              <div>
                <span className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Shift Aktif</span>
                <h3 className="font-heading text-2xl font-black mt-4 mb-1">{currentShift.id}</h3>
                <p className="text-sm text-slate-300">Waktu Buka: {currentShift.startTime.toLocaleString('id-ID')}</p>
              </div>

              <div className="mt-8 space-y-4 relative z-10">
                 <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <span className="text-sm text-slate-300">Saldo Awal (Modal)</span><span className="font-bold">{formatRupiah(shiftStats?.initialCash)}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <span className="text-sm text-slate-300">Penjualan (Khusus Tunai)</span><span className="font-bold text-green-400">+{formatRupiah(shiftStats?.cashSales)}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <span className="text-sm text-slate-300">Pemasukan Lain (Tunai)</span><span className="font-bold text-green-400">+{formatRupiah(shiftStats?.cashIncomes)}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                   <span className="text-sm text-slate-300">Pengeluaran Kasir</span><span className="font-bold text-red-400">-{formatRupiah(shiftStats?.cashExpenses)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-2">
                   <span className="text-sm font-bold text-slate-300">Target Uang Fisik</span><span className="font-black text-2xl">{formatRupiah(shiftStats?.expectedCash)}</span>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center animate-in slide-in-from-right-4 duration-500">
              <h3 className="font-heading text-xl font-bold text-slate-800 mb-2 text-center">Tutup Shift Kasir (X-Reading)</h3>
              <p className="text-slate-500 text-sm mb-8 text-center">Hitung dan masukkan total uang tunai yang ada di dalam laci kasir sekarang untuk dicocokkan dengan sistem.</p>
              
              <div className="mb-6">
                 <label className="block text-xs font-bold text-slate-500 mb-2">Uang Fisik Aktual (Di Laci)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                   <input type="number" className="w-full pl-12 pr-4 py-4 text-xl font-black rounded-xl border-2 border-slate-200 focus:outline-none focus:border-orange-600 bg-slate-50 transition-colors" value={actualCashInput} onChange={e => setActualCashInput(e.target.value)} placeholder="0" />
                 </div>
              </div>

              <button onClick={handleCloseShift} className="w-full py-4 bg-orange-600 text-white font-bold rounded-xl text-lg shadow-lg hover:bg-orange-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                Tutup Shift & Cetak Laporan <Printer className="w-5 h-5"/>
              </button>
           </div>
        </div>
      )}

      {/* =========================================================================
          REKAPITULASI & RIWAYAT HARIAN SHIFT KASIR
          ========================================================================= */}
      <div className="mt-8 border-t border-slate-200 pt-8 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-orange-600" /> Riwayat Harian & Rekap Shift
            </h3>
            <p className="text-xs text-slate-400">Laporan performa kasir dan akurasi kas di laci kasir.</p>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="month" 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)} 
              className="p-2 text-xs font-bold border border-slate-200 rounded-xl outline-none text-slate-600 bg-white focus:border-orange-500 transition-colors"
            />
            {filterMonth && (
              <button onClick={() => setFilterMonth('')} className="text-xs text-slate-400 hover:text-slate-600 underline">Semua</button>
            )}
          </div>
        </div>

        {/* --- METRIC SUMMARY REKAPITULASI SHIFT --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Shift Terlaksana</p>
            <h4 className="font-heading text-base md:text-lg font-black text-slate-800">{filteredShiftHistory.length} Kali</h4>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Pendapatan Tunai</p>
            <h4 className="font-heading text-base md:text-lg font-black text-green-600">{formatRupiah(rekapShiftStats.totalSales)}</h4>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Kas Seharusnya</p>
            <h4 className="font-heading text-base md:text-lg font-black text-slate-800">{formatRupiah(rekapShiftStats.totalExpected)}</h4>
          </div>
          <div className={`p-4 rounded-2xl shadow-sm border flex flex-col justify-center ${rekapShiftStats.totalDifference < 0 ? 'bg-red-50 border-red-100' : rekapShiftStats.totalDifference > 0 ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Selisih (Short/Over)</p>
            <h4 className={`font-heading text-base md:text-lg font-black ${rekapShiftStats.totalDifference < 0 ? 'text-red-600' : rekapShiftStats.totalDifference > 0 ? 'text-green-600' : 'text-slate-800'}`}>{formatRupiah(rekapShiftStats.totalDifference)}</h4>
          </div>
        </div>

        {/* --- DAFTAR RIWAYAT HARIAN SHIFT --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h4 className="font-heading font-bold text-slate-800 text-xs uppercase tracking-wider">Daftar Penutupan Shift</h4>
            <span className="text-slate-400 text-xs font-semibold">{filteredShiftHistory.length} data ditemukan</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
            {filteredShiftHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic text-sm">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Tidak ada riwayat penutupan shift pada periode ini
              </div>
            ) : (
              filteredShiftHistory.map((shift, idx) => {
                const statusColor = shift.difference < 0 
                  ? 'bg-red-50 text-red-600 border border-red-100' 
                  : shift.difference > 0 
                  ? 'bg-green-50 text-green-600 border border-green-100' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200';
                
                const statusLabel = shift.difference < 0 
                  ? 'Minus (Short)' 
                  : shift.difference > 0 
                  ? 'Lebih (Over)' 
                  : 'Pas (Balance)';

                return (
                  <div key={shift.id} className="p-4 hover:bg-slate-50/50 transition-colors animate-in fade-in slide-in-from-left-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-800">{shift.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Buka: {new Date(shift.startTime).toLocaleString('id-ID')} | Tutup: {new Date(shift.endTime).toLocaleString('id-ID')}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Saldo Awal: {formatRupiah(shift.stats.initialCash)} | Penjualan Tunai: {formatRupiah(shift.stats.cashSales)} | Target Uang: {formatRupiah(shift.stats.expectedCash)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Uang Aktual</p>
                        <p className="font-bold text-slate-800 text-sm">{formatRupiah(shift.actualCash)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Selisih</p>
                        <p className={`font-black text-sm ${shift.difference < 0 ? 'text-red-500' : shift.difference > 0 ? 'text-green-500' : 'text-slate-800'}`}>
                          {shift.difference > 0 ? '+' : ''}{formatRupiah(shift.difference)}
                        </p>
                      </div>
                      
                      <div className="flex gap-1 border-l border-slate-200 pl-4">
                        {/* Tombol Edit (Hanya tampil jika user adalah admin) */}
                        {currentUserRole === 'admin' && (
                          <button 
                            onClick={() => handleOpenEditModal(shift)} 
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100" 
                            title="Edit Laporan Shift (Admin)"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        <button 
                          onClick={() => {
                            setClosedShiftData(shift);
                            setShowXReading(true);
                          }} 
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 text-slate-600 hover:text-slate-800 bg-white" 
                          title="Cetak/Lihat Detail X-Reading"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL EDIT SHIFT (Tampil jika ada shift yang diedit)
          ========================================================================= */}
      {editingShift && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-heading font-bold text-slate-800 text-lg">Edit Laporan Shift</h3>
                <p className="text-xs text-slate-500">ID: {editingShift.id}</p>
              </div>
              <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm border border-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs flex items-start gap-2 border border-blue-100">
                <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Sebagai Admin, Anda dapat mengoreksi <b>Uang Fisik Aktual</b> jika terjadi kesalahan input kasir. Selisih kas akan dihitung ulang secara otomatis.</p>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-sm text-slate-500">Target Uang Fisik (Sistem):</span>
                <span className="font-bold text-slate-800">{formatRupiah(editingShift.stats.expectedCash)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Koreksi Uang Fisik Aktual (Di Laci)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                  <input 
                    type="number" 
                    className="w-full pl-12 pr-4 py-3 text-lg font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 bg-white transition-colors" 
                    value={editActualCashInput} 
                    onChange={e => setEditActualCashInput(e.target.value)} 
                    placeholder="0" 
                  />
                </div>
              </div>
              
              {/* Preview Perubahan Selisih */}
              {editActualCashInput && (
                <div className="pt-2">
                  <p className="text-xs text-slate-500 mb-1">Preview Selisih Baru:</p>
                  <p className={`font-black text-lg ${
                    (Number(editActualCashInput) - editingShift.stats.expectedCash) < 0 ? 'text-red-500' : 
                    (Number(editActualCashInput) - editingShift.stats.expectedCash) > 0 ? 'text-green-500' : 'text-slate-800'
                  }`}>
                    {formatRupiah(Number(editActualCashInput) - editingShift.stats.expectedCash)}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setEditingShift(null)} 
                className="flex-1 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveEdit} 
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
              >
                Simpan Koreksi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ShiftView;