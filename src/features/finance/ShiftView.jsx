import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Clock, FileText, History, Printer, Edit, Trash2, Share2, RotateCcw } from 'lucide-react';
import { isNativePlatform, printShiftNativeBluetooth } from '../../library/printer';
import { toPng, toBlob } from 'html-to-image';
import { generateUUID, toLocalMonthString } from '../../utils/formatters';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { pushTransactionDelete, pushLiveState } from '../../storage/realtimeSync';

// Import komponen UI Design System
import { 
  Button, 
  Card, 
  Input, 
  Modal, 
  PageHeader, 
  EmptyState, 
  Badge, 
  IconButton 
} from '../../components/ui';

const ShiftView = () => {
  const { 
    currentShift, setCurrentShift, shiftHistory, setShiftHistory,
    salesHistory, expenses, incomes, formatRupiah, triggerAlert, triggerConfirm,
    storeSettings, isAdminMode
  } = useAppContext();

  const [initialCashInput, setInitialCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [showXReading, setShowXReading] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState(null);

  // State untuk Fitur Edit (Khusus Admin)
  const [editingShift, setEditingShift] = useState(null);
  const [editActualCashInput, setEditActualCashInput] = useState('');

  // Filter Bulan untuk Rekapitulasi Riwayat Shift di Bagian Bawah
  const [filterMonth, setFilterMonth] = useState(toLocalMonthString()); // Default YYYY-MM
  const [showTrash, setShowTrash] = useState(false); // toggle: riwayat normal vs recycle bin

  const handleShareImage = async () => {
    const reportElement = document.getElementById('xreading-content');
    if (!reportElement) {
      alert('Error: Elemen laporan tidak ditemukan.');
      return;
    }

    try {
      if (isNativePlatform()) {
        const dataUrl = await toPng(reportElement, {
          backgroundColor: '#ffffff',
          pixelRatio: 3,
          skipAutoScale: true,
          style: { width: '300px' }
        });

        const base64Data = dataUrl.split(',')[1];
        const fileName = `laporan-shift-${closedShiftData.id}-${Date.now()}.png`;

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Laporan Tutup Dompet',
          text: `Berikut adalah Laporan Tutup Dompet (ID: ${closedShiftData.id})`,
          url: savedFile.uri,
          dialogTitle: 'Bagikan Laporan via'
        });
      } else {
        const blob = await toBlob(reportElement, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          skipAutoScale: true,
          style: { width: '300px' }
        });

        if (!blob) return;
        const file = new File([blob], `laporan-shift-${closedShiftData.id}.png`, { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `laporan-shift-${closedShiftData.id}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Log Error Asli:', error);
      if (error.name !== 'AbortError') alert(`GAGAL SHARE!\n\nPesan Error: ${error.message || JSON.stringify(error)}`);
    }
  };

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
        sale.splitDetails.forEach(p => { if (p.method === 'Tunai') cashSalesTotal += p.amount; });
      }
    });

    // Pemasukan & Pengeluaran (hanya yang Tunai yang mempengaruhi saldo laci)
    const shiftIncomes = incomes.filter(i => new Date(i.date) >= start);
    const shiftExpenses = expenses.filter(e => new Date(e.date) >= start && (e.paymentMethod || 'Tunai') === 'Tunai');

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
    const newShift = {
      id: `DOMPET-${generateUUID().split('-')[0].toUpperCase()}`,
      startTime: new Date(),
      initialCash: Number(initialCashInput)
    };
    pushLiveState('currentShift', newShift).catch(err => 
      console.warn('Gagal push manual :', err)
    );
    setInitialCashInput('');
    triggerAlert('Dompet berhasil dibuka!');
  };

  const handleCloseShift = () => {
    if (!actualCashInput || Number(actualCashInput) < 0) return triggerAlert('Masukkan uang aktual yang ada di dompet');

    const actualCash = Number(actualCashInput);
    const difference = actualCash - shiftStats.expectedCash;

    const shiftData = {
      ...currentShift,
      endTime: new Date(),
      stats: shiftStats,
      actualCash,
      difference
    };

    triggerConfirm(`Apakah Anda yakin ingin menutup dompet ini? Semua transaksi selanjutnya tidak akan terekap di dompet ini.`, () => {
      const filteredHistory = shiftHistory.filter(s => s.id !== shiftData.id);
      setShiftHistory([shiftData, ...filteredHistory]);
      setCurrentShift(null);
      pushLiveState('currentShift', null).catch(err => 
        console.warn('Gagal push manual close shift:', err)
      );
      setClosedShiftData(shiftData);
      setActualCashInput('');
      setShowXReading(true);
    });
  };

  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setEditActualCashInput(shift.actualCash.toString());
  };

  const handleSaveEdit = () => {
    if (!editActualCashInput || Number(editActualCashInput) < 0) {
      return triggerAlert('Masukkan nominal uang aktual yang valid.');
    }

    triggerConfirm(`Apakah Anda yakin ingin menyimpan perubahan pada laporan ${editingShift.id}?`, () => {
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
    });
  };

  const handleDeleteShift = (id) => {
    triggerConfirm('Pindahkan data dompet ini ke Recycle Bin?', () => {
      setShiftHistory(shiftHistory.map(shift => shift.id === id ? markDeleted(shift) : shift));
      triggerAlert('Data dipindahkan ke Recycle Bin.');
    });
  };

  const handleRestoreShift = (id) => {
    setShiftHistory(shiftHistory.map(shift => shift.id === id ? restoreItem(shift) : shift));
    triggerAlert('Data berhasil dikembalikan.');
  };

  const handlePermanentDeleteShift = (id) => {
    triggerConfirm('Hapus PERMANEN data dompet ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setShiftHistory(shiftHistory.filter(shift => shift.id !== id));
      // Langsung kirim delete ke Supabase saat ini juga, gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
      pushTransactionDelete('shiftHistory', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Data dihapus permanen.');
    });
  };

  const filteredShiftHistory = useMemo(() => {
    const source = showTrash ? trashedOnly(shiftHistory) : activeOnly(shiftHistory);
    return source.filter(shift => {
      if (!filterMonth) return true;
      const shiftDateStr = toLocalMonthString(shift.startTime);
      return shiftDateStr === filterMonth;
    });
  }, [shiftHistory, filterMonth, showTrash]);

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
      totalInitial, totalSales, totalIncomes, totalExpenses, totalExpected, totalActual, totalDifference
    };
  }, [filteredShiftHistory]);

  if (showXReading && closedShiftData) {
    return (
      <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto items-center animate-in fade-in duration-300">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * { visibility: hidden; }
            #xreading-content, #xreading-content * { visibility: visible; }
            #xreading-content { position: absolute; left: 0; top: 0; width: ${storeSettings.paperSize === '80mm' ? '80mm' : '58mm'}; margin: 0; padding: 0; box-shadow: none; font-family: monospace; font-size: 11px; }
            @page { margin: 0; }
          }
        `}} />

        <div id="xreading-content" className="bg-white dark:bg-slate-900 p-6 w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 print:shadow-none print:border-none">
          <div className="text-center border-b-2 border-dashed border-slate-300 dark:border-slate-600 pb-4 mb-4 print:pb-2 print:mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-1 print:text-lg">DOMPET</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 print:text-black">LAPORAN TUTUP DOMPET</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 print:mt-1 print:text-black">ID: {closedShiftData.id}</p>
          </div>

          <div className="space-y-1 text-xs mb-4 print:mb-2 print:text-black">
            <div className="flex justify-between"><span>Buka:</span> <span>{closedShiftData.startTime.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Tutup:</span> <span>{closedShiftData.endTime.toLocaleString('id-ID')}</span></div>
          </div>

          <div className="border-b-2 border-dashed border-slate-300 dark:border-slate-600 pb-4 mb-4 print:pb-2 print:mb-2 text-xs space-y-1.5 print:text-black">
            <div className="flex justify-between"><span>Saldo Awal (Modal)</span> <span>{formatRupiah(closedShiftData.stats.initialCash)}</span></div>
            <div className="flex justify-between"><span>Penjualan Tunai</span> <span>{formatRupiah(closedShiftData.stats.cashSales)}</span></div>
            <div className="flex justify-between"><span>Pemasukan Lain</span> <span>{formatRupiah(closedShiftData.stats.cashIncomes)}</span></div>
            <div className="flex justify-between text-red-500 dark:text-red-400 print:text-black"><span>Pengeluaran Kasir</span> <span>-{formatRupiah(closedShiftData.stats.cashExpenses)}</span></div>
          </div>

          <div className="space-y-1.5 text-xs print:text-black">
            <div className="flex justify-between font-bold"><span>Total Seharusnya di Dompet</span> <span>{formatRupiah(closedShiftData.stats.expectedCash)}</span></div>
            <div className="flex justify-between font-bold"><span>Saldo Aktual</span> <span>{formatRupiah(closedShiftData.actualCash)}</span></div>
            <div className={`flex justify-between font-bold pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 print:border-black ${closedShiftData.difference < 0 ? 'text-red-500 dark:text-red-400' : closedShiftData.difference > 0 ? 'text-green-500 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}`}>
              <span>{closedShiftData.difference < 0 ? 'SELISIH MINUS' : closedShiftData.difference > 0 ? 'SELISIH LEBIH' : 'BALANCE (PAS)'}</span>
              <span>{formatRupiah(closedShiftData.difference)}</span>
            </div>
          </div>

          <div className="text-center mt-8 text-[10px] text-slate-500 dark:text-slate-400 print:mt-4 print:text-black">
            <p>-- Akhir Laporan --</p>
          </div>
        </div>

        {/* AREA TOMBOL CETAK & BAGIKAN */}
        <div className="flex flex-col gap-2 mt-6 print:hidden w-full max-w-sm">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              icon={<Printer className="w-4 h-4" />}
              onClick={async () => {
                if (isNativePlatform()) {
                  await printShiftNativeBluetooth(closedShiftData, storeSettings);
                } else {
                  window.print();
                }
              }}
            >
              Cetak
            </Button>
            
            <Button
              className="flex-1 !bg-green-600 hover:!bg-green-700 !text-white !border-green-600"
              icon={<Share2 className="w-4 h-4" />}
              onClick={handleShareImage}
            >
              Bagikan
            </Button>
          </div>
          <Button
            variant="ghost"
            size="full"
            onClick={() => setShowXReading(false)}
          >
            Tutup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar relative">
      
      {/* Menggunakan komponen PageHeader */}
      <PageHeader 
        title="Manajemen Dompet" 
        icon={<Clock className="w-6 h-6" />} 
      />

      {!currentShift ? (
        <Card variant="elevated" className="max-w-md mx-auto text-center mt-10 mb-8 shrink-0">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Dompet Belom Dibuka</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Masukkan jumlah uang tunai yang ada di dalam dompet saat ini sebagai modal harian.</p>

          <div className="text-left mb-6">
            <Input 
              type="number"
              label="Saldo Awal"
              icon={<span className="font-bold">Rp</span>}
              value={initialCashInput}
              onChange={e => setInitialCashInput(e.target.value)}
              placeholder="0"
              className="text-lg font-bold"
            />
          </div>

          <Button size="full" onClick={handleOpenShift}>
            Buka Dompet
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mb-8 shrink-0">
          {/* Card Info Shift Aktif */}
          <Card variant="elevated" className="flex flex-col justify-between relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10">
              <FileText className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <Badge variant="info" className="uppercase tracking-wider">Dompet Terbuka</Badge>
              <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100 mt-4 mb-1">{currentShift.id}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Waktu Buka: {currentShift.startTime.toLocaleString('id-ID')}</p>
            </div>

            <div className="mt-8 space-y-4 relative z-10">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Saldo Awal</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(shiftStats?.initialCash)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Penjualan (Khusus Tunai)</span>
                <span className="font-bold text-green-600 dark:text-green-400">+{formatRupiah(shiftStats?.cashSales)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Pemasukan Lain (Tunai)</span>
                <span className="font-bold text-green-600 dark:text-green-400">+{formatRupiah(shiftStats?.cashIncomes)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran Kasir</span>
                <span className="font-bold text-red-600 dark:text-red-400">-{formatRupiah(shiftStats?.cashExpenses)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Saldo Akhir</span>
                <span className="font-black text-2xl text-slate-800 dark:text-slate-100">{formatRupiah(shiftStats?.expectedCash)}</span>
              </div>
            </div>
          </Card>

          {/* Card Penutupan Shift */}
          <Card variant="elevated" className="flex flex-col justify-center animate-in slide-in-from-right-4 duration-500">
            <h3 className="font-heading text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">Saldo Aktual</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 text-center">Hitung dan masukkan total uang tunai yang ada di dalam dompet sekarang untuk dicocokkan dengan sistem.</p>

            <div className="mb-6">
              <Input 
                type="number"
                label="Saldo aktual yang ada di dompet"
                icon={<span className="font-bold">Rp</span>}
                value={actualCashInput}
                onChange={e => setActualCashInput(e.target.value)}
                placeholder="0"
                className="text-xl font-black py-4 border-2 focus:border-orange-600"
              />
            </div>

            <Button 
              size="full" 
              iconRight={<Printer className="w-5 h-5" />} 
              onClick={handleCloseShift}
            >
              Tutup Dompet & Cetak Laporan
            </Button>
          </Card>
        </div>
      )}

      {/* =========================================================================
          REKAPITULASI & RIWAYAT HARIAN SHIFT KASIR
          ========================================================================= */}
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-8 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-orange-600 dark:text-orange-400" /> Riwayat
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Laporan performa dan akurasi kas di dompet.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="py-1.5 px-3 text-xs font-bold"
            />
            {filterMonth && (
              <button onClick={() => setFilterMonth('')} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline">Semua</button>
            )}
          </div>
        </div>

        {/* --- METRIC SUMMARY REKAPITULASI SHIFT --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card padding="sm" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Dompet Dibuka</p>
            <h4 className="font-heading text-base md:text-lg font-black text-slate-800 dark:text-slate-100">{filteredShiftHistory.length} Kali</h4>
          </Card>
          <Card padding="sm" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Pendapatan Tunai</p>
            <h4 className="font-heading text-base md:text-lg font-black text-green-600 dark:text-green-400">{formatRupiah(rekapShiftStats.totalSales)}</h4>
          </Card>
          <Card padding="sm" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Kas Seharusnya</p>
            <h4 className="font-heading text-base md:text-lg font-black text-slate-800 dark:text-slate-100">{formatRupiah(rekapShiftStats.totalExpected)}</h4>
          </Card>
          <Card padding="sm" className={`flex flex-col justify-center ${rekapShiftStats.totalDifference < 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' : rekapShiftStats.totalDifference > 0 ? 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20' : ''}`}>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Selisih (Short/Over)</p>
            <h4 className={`font-heading text-base md:text-lg font-black ${rekapShiftStats.totalDifference < 0 ? 'text-red-600 dark:text-red-400' : rekapShiftStats.totalDifference > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}`}>{formatRupiah(rekapShiftStats.totalDifference)}</h4>
          </Card>
        </div>

        {/* --- DAFTAR RIWAYAT HARIAN SHIFT --- */}
        <Card padding="none" className="overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">{showTrash ? 'Recycle Bin' : 'Daftar Penutupan Dompet'}</h4>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTrash(v => !v)}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                {showTrash ? 'Kembali ke Riwayat' : `Recycle Bin (${trashedOnly(shiftHistory).length})`}
              </button>
              <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{filteredShiftHistory.length} data ditemukan</span>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto custom-scrollbar">
            {filteredShiftHistory.length === 0 ? (
              <EmptyState 
                size="sm"
                icon={showTrash ? <Trash2 className="w-10 h-10 opacity-30" /> : <Clock className="w-10 h-10 opacity-30" />} 
                title={showTrash ? 'Recycle bin kosong.' : 'Tidak ada riwayat penutupan dompet pada periode ini'} 
              />
            ) : (
              filteredShiftHistory.map((shift) => {
                const badgeVariant = shift.difference < 0 ? 'danger' : shift.difference > 0 ? 'success' : 'neutral';
                const statusLabel = shift.difference < 0 ? 'Minus' : shift.difference > 0 ? 'Lebih' : 'Pas (Balance)';

                return (
                  <div key={shift.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors animate-in fade-in slide-in-from-left-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-sm text-slate-800 dark:text-slate-100">{shift.id}</span>
                        <Badge variant={badgeVariant}><span className="uppercase tracking-wider text-[10px]">{statusLabel}</span></Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Buka: {new Date(shift.startTime).toLocaleString('id-ID')} | Tutup: {new Date(shift.endTime).toLocaleString('id-ID')}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Saldo Awal: {formatRupiah(shift.stats.initialCash)} | Penjualan Tunai: {formatRupiah(shift.stats.cashSales)} | Target Uang: {formatRupiah(shift.stats.expectedCash)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Uang Aktual</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatRupiah(shift.actualCash)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Selisih</p>
                        <p className={`font-black text-sm ${shift.difference < 0 ? 'text-red-500 dark:text-red-400' : shift.difference > 0 ? 'text-green-500 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {shift.difference > 0 ? '+' : ''}{formatRupiah(shift.difference)}
                        </p>
                      </div>

                      <div className="flex gap-1 border-l border-slate-200 dark:border-slate-700 pl-4 ml-2">
                        {isAdminMode && (
                          <>
                            {showTrash ? (
                              <>
                                <IconButton variant="edit" onClick={() => handleRestoreShift(shift.id)} title="Kembalikan">
                                  <RotateCcw className="w-4 h-4" />
                                </IconButton>
                                <IconButton variant="delete" onClick={() => handlePermanentDeleteShift(shift.id)} title="Hapus Permanen">
                                  <Trash2 className="w-4 h-4" />
                                </IconButton>
                              </>
                            ) : (
                              <>
                                <IconButton variant="edit" onClick={() => handleOpenEditModal(shift)}>
                                  <Edit className="w-4 h-4" />
                                </IconButton>
                                <IconButton variant="delete" onClick={() => handleDeleteShift(shift.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </IconButton>
                              </>
                            )}
                          </>
                        )}
                        <IconButton 
                          variant="neutral" 
                          onClick={() => {
                            setClosedShiftData(shift);
                            setShowXReading(true);
                          }}
                        >
                          <Printer className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* =========================================================================
          MODAL EDIT SHIFT (Tampil jika ada shift yang diedit)
          ========================================================================= */}
      <Modal 
        isOpen={!!editingShift} 
        onClose={() => setEditingShift(null)} 
        title="Edit Laporan Shift"
      >
        {editingShift && (
          <>
            <div className="p-4 md:p-6 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">ID: {editingShift.id}</p>

              <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-xs flex items-start gap-2 border border-blue-100 dark:border-blue-500/20">
                <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Sebagai Admin, Anda dapat mengoreksi <b>Saldo Aktual</b> jika terjadi kesalahan input kasir. Selisih kas akan dihitung ulang secara otomatis.</p>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-500 dark:text-slate-400">Target Saldo Aktual:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(editingShift.stats.expectedCash)}</span>
              </div>

              <div>
                <Input
                  type="number"
                  label="Koreksi Saldo Aktual di Dompet"
                  icon={<span className="font-bold">Rp</span>}
                  value={editActualCashInput}
                  onChange={e => setEditActualCashInput(e.target.value)}
                  placeholder="0"
                  className="text-lg font-bold py-3"
                />
              </div>

              {/* Preview Perubahan Selisih */}
              {editActualCashInput && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Preview Selisih Baru:</p>
                  <p className={`font-black text-lg ${(Number(editActualCashInput) - editingShift.stats.expectedCash) < 0 ? 'text-red-500 dark:text-red-400' :
                    (Number(editActualCashInput) - editingShift.stats.expectedCash) > 0 ? 'text-green-500 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'
                    }`}>
                    {formatRupiah(Number(editActualCashInput) - editingShift.stats.expectedCash)}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setEditingShift(null)}
              >
                Batal
              </Button>
              <Button 
                variant="primary" 
                className="flex-1" 
                onClick={handleSaveEdit}
              >
                Simpan Koreksi
              </Button>
            </div>
          </>
        )}
      </Modal>

    </div>
  );
};

export default ShiftView;
