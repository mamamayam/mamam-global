import { Clock, FileText, History, Printer, Edit, Trash2, Share2, RotateCcw, ArrowUpDown, AlertTriangle, Users, ArrowRight, ChevronDown } from 'lucide-react';
import { isNativePlatform, printShiftNativeBluetooth } from '../../../library/printer';
import { trashedOnly } from '../../../utils/softDelete';
import { isCourierLocation } from '../../../utils/cashHolders';

// Import komponen UI Design System
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  EmptyState,
  Badge,
  IconButton,
  SortModal,
  BulkSelectBar
} from '../../../components/ui';

import { useShiftLogic, sortOptions, getLocationMeta } from './useShiftLogic';
import ShiftModals from './ShiftModals';

// ShiftView — orchestrator halaman Dompet. 3 tab: 'aktif' (kartu buka/tutup
// dompet + rincian posisi uang + form Catat Perpindahan Uang), 'riwayat'
// (rekap + daftar penutupan dompet), 'log' (Log Transaksi — satu list
// gabungan semua perpindahan uang, manual & otomatis). Semua state/logic
// ada di useShiftLogic(), modal buka/tutup/edit shift ada di ShiftModals.jsx
// (modal transaksi kurir yang dulu terpisah SUDAH DIHAPUS, gantiin dengan
// form generik langsung di tab Aktif — lihat card "Catat Perpindahan Uang").
const ShiftView = () => {
  const {
    currentShift, shiftHistory, formatRupiah, storeSettings, isAdminMode, employees,

    activeTab, setActiveTab,

    initialCashInput, setInitialCashInput,
    openedByEmployeeId, setOpenedByEmployeeId,
    actualCashInput, setActualCashInput,
    isShiftCarriedOver,
    handleOpenShift, handleCloseShift,
    handleOpenEditActiveInitial,

    showXReading, setShowXReading,
    closedShiftData, setClosedShiftData,
    handleShareImage,

    couriers, courierBalances, totalHeldByCouriers,
    dompetBalance, ownerBalance,

    shiftStats,

    transferLocations, transferFromBalance,
    showTransferForm, handleOpenTransferForm, handleCloseTransferForm,
    transferFrom, setTransferFrom, transferTo, setTransferTo,
    transferAmountInput, setTransferAmountInput,
    transferNoteInput, setTransferNoteInput,
    confirmOverdraft, setConfirmOverdraft,
    handleSubmitTransfer, isTransferSubmitting,

    editingShift, setEditingShift,
    editActualCashInput, setEditActualCashInput,
    editInitialCashInput, setEditInitialCashInput,
    handleOpenEditModal, handleSaveEdit,
    isEditingActiveInitial, setIsEditingActiveInitial,
    editActiveInitialInput, setEditActiveInitialInput,
    handleSaveActiveInitial,

    filterMode, setFilterMode,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    showTrash, setShowTrash,
    sortKey, setSortKey,
    isSortOpen, setIsSortOpen,
    isSelecting, setIsSelecting,
    filteredShiftHistory, sortedShiftHistory, rekapShiftStats,
    selectedIds, allSelected, toggleSelectOne, toggleSelectAll, resetSelection, count,
    handleDeleteShift, handleRestoreShift, handlePermanentDeleteShift,
    handleBulkSoftDeleteShift, handleBulkPermanentDeleteShift,

    allTransactions,
    handleDeleteCourierTransfer,
    editingTransfer, setEditingTransfer,
    editTransferAmountInput, setEditTransferAmountInput,
    editTransferNoteInput, setEditTransferNoteInput,
    handleOpenEditCourierTransfer, handleSaveCourierTransferEdit,
  } = useShiftLogic();

  // Map employeeId -> nama, dipakai locationLabel-style rendering di JSX
  // (chip Log Transaksi, dropdown form) tanpa perlu import locationLabel
  // terpisah — cukup cari dari `couriers` yang udah ada di scope ini.
  const courierNameById = new Map(couriers.map(c => [c.id, c.name]));
  const labelForLocation = (key) => {
    if (isCourierLocation(key)) {
      const id = key.split(':')[1];
      return courierNameById.get(id) || 'Kurir';
    }
    return getLocationMeta(key).label;
  };

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
            {closedShiftData.openedByEmployeeName && (
              <div className="flex justify-between"><span>Kasir:</span> <span className="font-bold">{closedShiftData.openedByEmployeeName}</span></div>
            )}
          </div>

          <div className="border-b-2 border-dashed border-slate-300 dark:border-slate-600 pb-4 mb-4 print:pb-2 print:mb-2 text-xs space-y-1.5 print:text-black">
            <div className="flex justify-between"><span>Saldo Awal (Modal)</span> <span>{formatRupiah(closedShiftData.stats.initialCash)}</span></div>
            <div className="flex justify-between"><span>Penjualan Tunai</span> <span>{formatRupiah(closedShiftData.stats.cashSales)}</span></div>
            <div className="flex justify-between"><span>Pemasukan Lain</span> <span>{formatRupiah(closedShiftData.stats.cashIncomes)}</span></div>
            {/* Fallback utk shift lama yang stats-nya belum punya field
                cashExpensesKasir/cashExpensesKurir (sebelum kedua field ini
                ditambahkan) — cashExpensesKasir di-default ke cashExpenses
                gabungan (behavior lama), cashExpensesKurir default 0 & baris
                itu disembunyikan biar gak nampilin Rp 0 yang menyesatkan. */}
            <div className="flex justify-between text-accent-500 dark:text-accent-400 print:text-black"><span>Pengeluaran Kasir</span> <span>-{formatRupiah(closedShiftData.stats.cashExpensesKasir ?? closedShiftData.stats.cashExpenses)}</span></div>
            {closedShiftData.stats.cashExpensesKurir > 0 && (
              <div className="flex justify-between text-accent-500 dark:text-accent-400 print:text-black"><span>Pengeluaran Kurir</span> <span>-{formatRupiah(closedShiftData.stats.cashExpensesKurir)}</span></div>
            )}
            {/* Uang Hilang (Write-off) — field baru, gak ada di shift
                lama yang ditutup sebelum fix ini (stats.cashWriteOff
                undefined) — pakai fallback 0 lewat `> 0` check, biar
                shift lama gak nampilin baris Rp 0 yang menyesatkan. */}
            {closedShiftData.stats.cashWriteOff > 0 && (
              <div className="flex justify-between text-red-500 dark:text-red-400 print:text-black"><span>Uang Hilang (Write-off)</span> <span>-{formatRupiah(closedShiftData.stats.cashWriteOff)}</span></div>
            )}
          </div>

          <div className="space-y-1.5 text-xs print:text-black">
            <div className="flex justify-between font-bold"><span>Total Seharusnya di Dompet</span> <span>{formatRupiah(closedShiftData.stats.expectedCash)}</span></div>
            <div className="flex justify-between font-bold"><span>Saldo Aktual</span> <span>{formatRupiah(closedShiftData.actualCash)}</span></div>
            <div className={`flex justify-between font-bold pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 print:border-black ${closedShiftData.difference < 0 ? 'text-accent-500 dark:text-accent-400' : closedShiftData.difference > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
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
              variant="success"
              className="flex-1"
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
        icon={<Clock className="w-6 h-6 text-accent-500 dark:text-accent-400" />} 
      />

      {/* =========================================================================
          TAB NAVIGASI — Aktif / Riwayat / Log Transaksi
          ========================================================================= */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 shrink-0 max-w-4xl overflow-x-auto custom-scrollbar">
        {[
          { key: 'aktif', label: 'Aktif' },
          { key: 'riwayat', label: 'Riwayat' },
          { key: 'log', label: 'Log Transaksi' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors duration-200 -mb-px ${
              activeTab === tab.key
                ? 'border-accent-600 dark:border-accent-400 text-accent-600 dark:text-accent-400'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          BANNER PERINGATAN — DOMPET KEBAWA NGINAP DARI HARI SEBELUMNYA
          Cuma tampil di tab Aktif — di tab lain gak relevan.
          ========================================================================= */}
      {activeTab === 'aktif' && currentShift && isShiftCarriedOver && (
        <div className="max-w-4xl mb-6 shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-sm text-red-700 dark:text-red-300">Dompet Belum Ditutup dari Hari Sebelumnya!</p>
              <p className="text-xs text-red-600/90 dark:text-red-400/80 mt-0.5">
                Dibuka sejak {new Date(currentShift.startTime).toLocaleString('id-ID')}. Transaksi hari ini bisa kecampur sama shift lama — segera hitung & tutup dompet sebelum lanjut jualan.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'aktif' && (!currentShift ? (
        <Card variant="elevated" className="max-w-md mx-auto text-center mt-10 mb-8 shrink-0">
          <div className="w-16 h-16 bg-gradient-to-br from-accent-50 to-accent-100 dark:from-accent-500/10 dark:to-accent-500/15 text-accent-500 dark:text-accent-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="font-heading text-2xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-2">Dompet Belom Dibuka</h3>
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

          <div className="text-left mb-6">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Dibuka Oleh (Opsional)</label>
            <select
              value={openedByEmployeeId}
              onChange={e => setOpenedByEmployeeId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 dark:focus:border-accent-500 transition-all duration-200"
            >
              <option value="">-- Pilih Karyawan --</option>
              {(employees || []).filter(e => e.status !== 'resign').map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <Button size="full" onClick={handleOpenShift}>
            Buka Dompet
          </Button>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mb-8 shrink-0 w-full min-w-0">
          {/* Card Info Shift Aktif — PURE DISPLAY. Semua tombol aksi
              transaksi kurir (Setor/Hapus/Ganti Uang/Setor Owner) yang
              dulu nempel di sini SUDAH DIPINDAH ke card "Catat
              Perpindahan Uang" di bawah (form generik dari/ke). */}
          <Card variant="elevated" className="flex flex-col justify-between relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10">
              <FileText className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <Badge variant="info" className="uppercase tracking-wider">Dompet Terbuka</Badge>
              <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100 mt-4 mb-1">{currentShift.id}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Waktu Buka: {currentShift.startTime.toLocaleString('id-ID')}</p>
              {currentShift.openedByEmployeeName && (
                <p className="text-sm font-semibold text-accent-600 dark:text-accent-400 mt-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> {currentShift.openedByEmployeeName}
                </p>
              )}
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-2">Khusus Transaksi Tunai</p>
            </div>

            <div className="mt-8 space-y-4 relative z-10">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  Uang Kas Awal
                  {isAdminMode && (
                    <button
                      onClick={handleOpenEditActiveInitial}
                      title="Koreksi Saldo Awal (Admin)"
                      className="text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(shiftStats?.initialCash)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Penjualan</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(shiftStats?.cashSales)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Pemasukan Non-Penjualan</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(shiftStats?.cashIncomes)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran Kasir</span>
                <span className="font-bold text-accent-600 dark:text-accent-400">-{formatRupiah(shiftStats?.cashExpensesKasir)}</span>
              </div>
              {shiftStats?.cashExpensesKurir > 0 && (
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran Kurir</span>
                  <span className="font-bold text-accent-600 dark:text-accent-400">-{formatRupiah(shiftStats?.cashExpensesKurir)}</span>
                </div>
              )}
              {/* Uang Hilang (Write-off) — TERPISAH dari Pengeluaran
                  Kasir/Kurir. Ini transaksi manual "Kurir/Dompet -> Hilang"
                  yang dicatat lewat card "Catat Perpindahan Uang" (bukan
                  expense operasional beneran) — uang kecolongan/hilang/
                  tidak balik. Sebelumnya nyampur ke Pengeluaran Kasir/Kurir,
                  bikin angka gak match kalau dicocokkan ke rekap ExpenseView. */}
              {shiftStats?.cashWriteOff > 0 && (
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Uang Hilang (Write-off)</span>
                  <span className="font-bold text-red-500 dark:text-red-400">-{formatRupiah(shiftStats?.cashWriteOff)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Saldo Akhir</span>
                {/* SATU-SATUNYA angka Saldo Akhir — jumlah dari breakdown
                    Rincian Posisi Uang di bawah (dompetBalance +
                    ownerBalance + total saldo semua kurir), BUKAN formula
                    terpisah. Ini yang memastikan angka di sini SELALU
                    match sama breakdown-nya — gak ada lagi 2 sumber angka
                    yang bisa nyimpang (bug yang sempat kejadian pas
                    desain mockup). */}
                <span className="font-black text-2xl text-slate-800 dark:text-slate-100">
                  {formatRupiah(dompetBalance + ownerBalance + totalHeldByCouriers)}
                </span>
              </div>

              {/* Rincian Posisi Uang — di mana aja posisi cash saat ini,
                  SEMUA dihitung dgn rumus yang sama (computeLocationBalance
                  di useShiftLogic.js), termasuk Owner (bukan kartu
                  terpisah lagi) karena itu tetap bagian dari Saldo Akhir
                  yang harus dipertanggungjawabkan, cuma udah pindah lokasi
                  ke tangan pemilik. TIDAK ADA tombol aksi apapun di sini —
                  semua aksi (Setor/Hapus/Ganti Uang/Setor Owner) sekarang
                  lewat card "Catat Perpindahan Uang" di bawah. */}
              <div className="mt-2 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Rincian Posisi Uang</p>
                <div className="space-y-1.5">
                  <BreakdownRow label="Kasir (Dompet)" value={dompetBalance} colorClass="bg-slate-400" formatRupiah={formatRupiah} />
                  {courierBalances.filter(b => b.balance !== 0 || b.isActive).map(b => (
                    <BreakdownRow
                      key={b.employeeId}
                      label={`${b.employeeName}${!b.isActive ? ' (Resign)' : ''}`}
                      value={b.balance}
                      colorClass="bg-sky-400"
                      isDebt={b.balance < 0}
                      formatRupiah={formatRupiah}
                    />
                  ))}
                  <BreakdownRow
                    label="Owner (hasil transfer, bukan saldo milik Owner)"
                    value={ownerBalance}
                    colorClass="bg-orange-400"
                    formatRupiah={formatRupiah}
                  />
                </div>
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
                className="text-xl font-black py-4 border-2 focus:border-accent-600"
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

        {/* =========================================================================
            CARD "CATAT PERPINDAHAN UANG" — SATU form generik gantiin 4
            modal terpisah (Setor/Hapus/Ganti Uang/Setor Owner). User
            pilih lokasi Dari & Ke dari dropdown yang sama (kurir manapun,
            Dompet, Owner, Hilang), isi nominal, submit. Collapsed by
            default biar gak mengganggu tampilan pas cuma mau lihat saldo.
            ========================================================================= */}
        <Card padding="none" className="max-w-4xl overflow-hidden mb-8 shrink-0">
          <button
            type="button"
            onClick={() => showTransferForm ? handleCloseTransferForm() : handleOpenTransferForm()}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-accent-500 dark:text-accent-400" />
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Catat Perpindahan Uang</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showTransferForm ? 'rotate-180' : ''}`} />
          </button>

          {showTransferForm && (
            <div className="p-4 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-3">
                Pilih asal & tujuan uang berpindah, lalu nominal. Berlaku buat semua jenis: setor kurir, ganti uang, hapus saldo, setor ke owner, dsb.
              </p>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Dari</label>
                  <Select value={transferFrom} onChange={e => setTransferFrom(e.target.value)} className="text-sm font-semibold">
                    {transferLocations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </Select>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mb-3 shrink-0" />
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Ke</label>
                  <Select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="text-sm font-semibold">
                    {transferLocations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Saldo {labelForLocation(transferFrom)} saat ini</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{formatRupiah(transferFromBalance)}</span>
              </div>

              <Input
                type="number"
                label="Nominal"
                icon={<span className="font-bold">Rp</span>}
                value={transferAmountInput}
                onChange={e => { setTransferAmountInput(e.target.value); setConfirmOverdraft(false); }}
                placeholder="0"
                className="text-lg font-bold py-2.5"
              />

              <Input
                type="text"
                label="Catatan (opsional)"
                value={transferNoteInput}
                onChange={e => setTransferNoteInput(e.target.value)}
                placeholder="mis. Transfer BCA, ganti uang belanja..."
              />

              {/* Peringatan talangan — saldo `from` gak cukup. User HARUS
                  centang dulu baru submit bisa jalan (lihat
                  handleSubmitTransfer: kalau insufficientFunds &&
                  !confirmOverdraft, submit di-cancel diam-diam supaya
                  checkbox ini yang jadi satu-satunya jalan lanjut). */}
              {Number(transferAmountInput) > transferFromBalance && transferAmountInput !== '' && (
                <div className="flex gap-2 items-start bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
                      Saldo {labelForLocation(transferFrom)} cuma {formatRupiah(transferFromBalance)}, kurang dari {formatRupiah(Number(transferAmountInput))}. Lanjutkan sebagai talangan?
                    </p>
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer">
                      <input type="checkbox" checked={confirmOverdraft} onChange={e => setConfirmOverdraft(e.target.checked)} className="w-3.5 h-3.5 accent-amber-600" />
                      Ya, lanjutkan (saldo akan minus)
                    </label>
                  </div>
                </div>
              )}

              <Button
                size="full"
                onClick={handleSubmitTransfer}
                disabled={isTransferSubmitting || !transferAmountInput || Number(transferAmountInput) <= 0 || transferFrom === transferTo || (Number(transferAmountInput) > transferFromBalance && !confirmOverdraft)}
              >
                {isTransferSubmitting ? 'Memproses...' : 'Catat Perpindahan'}
              </Button>
            </div>
          )}
        </Card>
        </>
      ))}

      {/* =========================================================================
          REKAPITULASI & RIWAYAT HARIAN SHIFT KASIR — tab "Riwayat"
          ========================================================================= */}
      {activeTab === 'riwayat' && (
      <div className="pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-accent-600 dark:text-accent-400" /> Riwayat
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Laporan performa dan akurasi kas di dompet.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}
              className="py-1.5 px-3 text-xs font-bold"
            >
              <option value="hari-ini">Hari Ini</option>
              <option value="kemarin">Kemarin</option>
              <option value="bulan-ini">Bulan Ini</option>
              <option value="semua">Semua</option>
              <option value="tanggal-terpilih">Tanggal Terpilih</option>
            </Select>

            {filterMode === 'tanggal-terpilih' && (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  max={filterEndDate || undefined}
                  className="py-1.5 px-2 text-xs font-bold"
                />
                <span className="text-xs text-slate-400">-</span>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  min={filterStartDate || undefined}
                  className="py-1.5 px-2 text-xs font-bold"
                />
              </div>
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
            <h4 className="font-heading text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(rekapShiftStats.totalSales)}</h4>
          </Card>
          <Card padding="sm" className="flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Kas Seharusnya</p>
            <h4 className="font-heading text-base md:text-lg font-black text-slate-800 dark:text-slate-100">{formatRupiah(rekapShiftStats.totalExpected)}</h4>
          </Card>
          <Card padding="sm" className={`flex flex-col justify-center ${rekapShiftStats.totalDifference < 0 ? 'bg-accent-50 dark:bg-accent-500/10 border-red-100 dark:border-red-500/20' : rekapShiftStats.totalDifference > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : ''}`}>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total Selisih (Short/Over)</p>
            <h4 className={`font-heading text-base md:text-lg font-black ${rekapShiftStats.totalDifference < 0 ? 'text-accent-600 dark:text-accent-400' : rekapShiftStats.totalDifference > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>{formatRupiah(rekapShiftStats.totalDifference)}</h4>
          </Card>
        </div>

        {/* --- DAFTAR RIWAYAT HARIAN SHIFT --- */}
        <Card padding="none" className="overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">{showTrash ? 'Recycle Bin' : 'Daftar Penutupan Dompet'}</h4>
            <div className="flex items-center gap-3">
              {isAdminMode && (
                <button
                  onClick={() => { setShowTrash(v => !v); resetSelection(); setIsSelecting(false); }}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                >
                  {showTrash ? 'Kembali ke Riwayat' : `Recycle Bin (${trashedOnly(shiftHistory).length})`}
                </button>
              )}
              <button
                onClick={() => { if (isSelecting) resetSelection(); setIsSelecting(v => !v); }}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all duration-300 active:scale-95 ${isSelecting ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}
              >
                {isSelecting ? 'Batal' : 'Pilih'}
              </button>
              <button
                type="button"
                onClick={() => setIsSortOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 transition-all duration-300 active:scale-95"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
              <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{filteredShiftHistory.length} data ditemukan</span>
            </div>
          </div>
          
          {isSelecting && sortedShiftHistory.length > 0 && (
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <BulkSelectBar
                count={count}
                total={sortedShiftHistory.length}
                allSelected={allSelected}
                onToggleAll={toggleSelectAll}
                onDeleteSelected={showTrash ? handleBulkPermanentDeleteShift : handleBulkSoftDeleteShift}
                label="Pilih Semua"
              />
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto custom-scrollbar">
            {sortedShiftHistory.length === 0 ? (
              <EmptyState 
                size="sm"
                icon={showTrash ? <Trash2 className="w-10 h-10 opacity-30" /> : <Clock className="w-10 h-10 opacity-30" />} 
                title={showTrash ? 'Recycle bin kosong.' : 'Tidak ada riwayat penutupan dompet pada periode ini'} 
              />
            ) : (
              sortedShiftHistory.map((shift) => {
                const badgeVariant = shift.difference < 0 ? 'danger' : shift.difference > 0 ? 'success' : 'neutral';
                const statusLabel = shift.difference < 0 ? 'Minus' : shift.difference > 0 ? 'Lebih' : 'Pas (Balance)';

                return (
                  <div key={shift.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors animate-in fade-in slide-in-from-left-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${selectedIds.has(shift.id) ? 'bg-accent-50/60 dark:bg-accent-500/5' : ''}`}>
                    <div className="flex items-start gap-3 flex-1">
                      {isSelecting && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(shift.id)}
                          onChange={() => toggleSelectOne(shift.id)}
                          className="w-4 h-4 mt-1 rounded accent-[#ea580c] dark:accent-[#f97316] cursor-pointer shrink-0"
                        />
                      )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-slate-800 dark:text-slate-100">{shift.id}</span>
                          <Badge variant={badgeVariant}><span className="uppercase tracking-wider text-[10px]">{statusLabel}</span></Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          Buka: {new Date(shift.startTime).toLocaleString('id-ID')} | Tutup: {new Date(shift.endTime).toLocaleString('id-ID')}
                        </p>
                        {shift.openedByEmployeeName && (
                          <p className="text-[11px] text-accent-600 dark:text-accent-400 font-semibold">
                            Kasir: {shift.openedByEmployeeName}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          Saldo Awal: {formatRupiah(shift.stats.initialCash)} | Penjualan Tunai: {formatRupiah(shift.stats.cashSales)} | Target Uang: {formatRupiah(shift.stats.expectedCash)}
                      </p>
                    </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Uang Aktual</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatRupiah(shift.actualCash)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Selisih</p>
                        <p className={`font-black text-sm ${shift.difference < 0 ? 'text-accent-500 dark:text-accent-400' : shift.difference > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {shift.difference > 0 ? '+' : ''}{formatRupiah(shift.difference)}
                        </p>
                      </div>

                      <div className="flex gap-1 border-l border-slate-200 dark:border-slate-700 pl-4 ml-2">
                        {showTrash ? (
                          isAdminMode && (
                            <>
                              <IconButton variant="edit" onClick={() => handleRestoreShift(shift.id)} title="Kembalikan">
                                <RotateCcw className="w-4 h-4" />
                              </IconButton>
                              <IconButton variant="delete" onClick={() => handlePermanentDeleteShift(shift.id)} title="Hapus Permanen">
                                <Trash2 className="w-4 h-4" />
                              </IconButton>
                            </>
                          )
                        ) : (
                          <>
                            {isAdminMode && (
                              <IconButton variant="edit" onClick={() => handleOpenEditModal(shift)}>
                                <Edit className="w-4 h-4" />
                              </IconButton>
                            )}
                            <IconButton variant="delete" onClick={() => handleDeleteShift(shift.id)}>
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
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
      )}

      {/* =========================================================================
          TAB "LOG TRANSAKSI" — satu list gabungan SEMUA perpindahan uang
          (manual dari Card Catat Perpindahan Uang, DAN virtual hasil
          terjemahan penjualan/pengeluaran). Setiap baris nampilin format
          "Dari -> Ke" yang seragam, gak ada lagi badge 5 warna beda-beda
          yang harus dihafal. Transaksi virtual ditandai "· otomatis" &
          gak bisa diedit/dihapus (sumbernya di PosView/ExpenseView, bukan
          di sini).
          ========================================================================= */}
      {activeTab === 'log' && (
        <div className="pb-12 max-w-4xl">
          <Card padding="none" className="overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Log Transaksi
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Semua perpindahan uang — manual & otomatis dari penjualan/pengeluaran.</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {allTransactions.length === 0 ? (
                <EmptyState size="sm" icon={<History className="w-8 h-8 opacity-30" />} title="Belum ada transaksi." />
              ) : (
                [...allTransactions].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => {
                  const fromMeta = getLocationMeta(t.from);
                  const toMeta = getLocationMeta(t.to);
                  return (
                    <div key={t.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold ${fromMeta.chipClass}`}>{labelForLocation(t.from)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold ${toMeta.chipClass}`}>{labelForLocation(t.to)}</span>
                          {t.isVirtual && <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">· otomatis</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.note}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(t.date).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-sm text-slate-800 dark:text-slate-100">{formatRupiah(t.amount)}</span>
                        {!t.isVirtual && (
                          <>
                            <IconButton variant="edit" onClick={() => handleOpenEditCourierTransfer(t)} title="Edit baris transaksi ini">
                              <Edit className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton variant="delete" onClick={() => handleDeleteCourierTransfer(t.id)} title="Hapus baris transaksi ini">
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      <SortModal
        isOpen={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        value={sortKey}
        onChange={setSortKey}
        options={sortOptions}
      />

      <ShiftModals
        currentShift={currentShift}
        shiftStats={shiftStats}
        formatRupiah={formatRupiah}
        isEditingActiveInitial={isEditingActiveInitial}
        setIsEditingActiveInitial={setIsEditingActiveInitial}
        editActiveInitialInput={editActiveInitialInput}
        setEditActiveInitialInput={setEditActiveInitialInput}
        handleSaveActiveInitial={handleSaveActiveInitial}
        editingShift={editingShift}
        setEditingShift={setEditingShift}
        editInitialCashInput={editInitialCashInput}
        setEditInitialCashInput={setEditInitialCashInput}
        editActualCashInput={editActualCashInput}
        setEditActualCashInput={setEditActualCashInput}
        handleSaveEdit={handleSaveEdit}
        editingTransfer={editingTransfer}
        setEditingTransfer={setEditingTransfer}
        editTransferAmountInput={editTransferAmountInput}
        setEditTransferAmountInput={setEditTransferAmountInput}
        editTransferNoteInput={editTransferNoteInput}
        setEditTransferNoteInput={setEditTransferNoteInput}
        handleSaveCourierTransferEdit={handleSaveCourierTransferEdit}
      />
    </div>
  );
};

// Baris breakdown "Rincian Posisi Uang" — dipakai buat SEMUA lokasi
// (Kasir/Dompet, tiap kurir, Owner) dengan tampilan yang seragam. `isDebt`
// khusus dipakai kalau saldo kurir NEGATIF (nombokin belanja pakai duit
// pribadi, belum diganti) — warnanya beda biar kelihatan itu bukan
// "saldo positif kecil" tapi utang bisnis ke kurir tsb.
function BreakdownRow({ label, value, colorClass, isDebt, formatRupiah }) {
  // Fallback aman kalau formatRupiah kelewat gak di-pass dari pemanggil —
  // daripada crash total (kejadian sebelumnya: 2 dari 3 pemanggilan lupa
  // ngasih prop ini), tampilkan angka mentah dgn pemisah ribuan sederhana.
  const format = formatRupiah || ((n) => `Rp ${Math.abs(Math.round(n || 0)).toLocaleString('id-ID')}`);
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorClass}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</span>
      </div>
      <span className={`text-sm font-bold shrink-0 ml-2 ${isDebt ? 'text-accent-600 dark:text-accent-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {isDebt ? `Toko berutang ${format(Math.abs(value))}` : format(value)}
      </span>
    </div>
  );
}

export default ShiftView;