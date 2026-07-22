import { Clock, FileText, History, Printer, Edit, Trash2, Share2, RotateCcw, ArrowUpDown, AlertTriangle, Users } from 'lucide-react';
import { isNativePlatform, printShiftNativeBluetooth } from '../../../library/printer';
import { activeOnly, trashedOnly } from '../../../utils/softDelete';
import { applySort } from '../../../utils/sortUtils';
import { isOwnerTransfer } from '../../../utils/cashHolders';

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

import { useShiftLogic, sortOptions, getCourierTransferMeta } from './useShiftLogic';
import ShiftModals from './ShiftModals';

// ShiftView — orchestrator halaman Dompet. Isinya: X-Reading (laporan tutup
// dompet), halaman utama (buka dompet / kartu shift aktif), dan Riwayat
// (rekap + daftar + riwayat setoran kurir). Semua state/logic ada di
// useShiftLogic(), 5 modal (edit saldo aktif, edit shift, setor, write-off,
// reimburse) ada di ShiftModals.jsx.
const ShiftView = () => {
  const {
    currentShift, shiftHistory, formatRupiah, storeSettings, isAdminMode, employees, cashTransfers,

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
    handleOpenDeposit, handleConfirmPartialDeposit, isDepositSubmitting,
    handleOpenWriteoff, handleConfirmWriteoff, isWriteoffSubmitting,
    handleOpenReimburse, handleConfirmReimburse, isReimburseSubmitting,
    depositTarget, setDepositTarget, partialDepositInput, setPartialDepositInput,
    writeoffTarget, setWriteoffTarget, writeoffInput, setWriteoffInput,
    reimburseTarget, setReimburseTarget, reimburseInput, setReimburseInput,

    totalTransferredToOwner,
    isOwnerTransferOpen, setIsOwnerTransferOpen,
    ownerTransferInput, setOwnerTransferInput,
    ownerTransferNoteInput, setOwnerTransferNoteInput,
    handleOpenOwnerTransfer, handleConfirmOwnerTransfer, isOwnerTransferSubmitting,

    shiftStats,

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
    handleDeleteCourierTransfer,

    editingTransfer, setEditingTransfer,
    editTransferAmountInput, setEditTransferAmountInput,
    editTransferNoteInput, setEditTransferNoteInput,
    handleOpenEditCourierTransfer, handleSaveCourierTransferEdit,
  } = useShiftLogic();

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
          TAB NAVIGASI — Aktif / Riwayat / Log Kurir (khusus Admin)
          Log Kurir cuma dirender kalau isAdminMode true (sebelumnya section
          collapsible "Riwayat Setoran Kurir" + "Riwayat Setor ke Owner" di
          bawah Riwayat — sekarang jadi tab sendiri, lihat activeTab state
          di useShiftLogic).
          ========================================================================= */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 shrink-0 max-w-4xl overflow-x-auto custom-scrollbar">
        {[
          { key: 'aktif', label: 'Aktif' },
          { key: 'riwayat', label: 'Riwayat' },
          ...(isAdminMode ? [{ key: 'log-kurir', label: 'Log Kurir' }] : []),
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
          Cuma tampil di tab Aktif — di tab lain gak relevan/mubazir.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mb-8 shrink-0 w-full min-w-0">
          {/* Card Info Shift Aktif */}
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
                  Uang Kas
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
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Saldo Akhir</span>
                <span className="font-black text-2xl text-slate-800 dark:text-slate-100">{formatRupiah((shiftStats?.expectedCash || 0) + totalHeldByCouriers)}</span>
              </div>

              {/* Ringkasan lokasi cash — dompet kasir vs yang masih di tangan kurir.
                  "Saldo Akhir" di atas = Saldo Dompet + Saldo Kurir (dihitung
                  langsung di sini, bukan dari shiftStats.totalCashBisnis,
                  supaya jelas ini murni penjumlahan dua baris di bawahnya). */}
              <div className="mt-2 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Saldo di Dompet</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatRupiah(shiftStats?.expectedCash)}</span>
                    {/* Setor ke Owner — narik uang dari laci Dompet ke pemilik
                        bisnis. Beda sumbu dari Setor/Hapus/Ganti Uang kurir di
                        bawah (yang soal Kurir <-> Dompet), makanya tombolnya di
                        baris "Saldo di Dompet", bukan di baris kurir manapun.
                        Lihat handleOpenOwnerTransfer & totalTransferredToOwner. */}
                    {(shiftStats?.expectedCash || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleOpenOwnerTransfer}
                        className="text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 rounded-lg px-1.5 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-500/10 active:scale-95 transition-all duration-200 shrink-0"
                      >
                        Setor ke Owner
                      </button>
                    )}
                  </div>
                </div>
                {/* Total yang udah disetor ke Owner — cuma tampil kalau ada,
                    biar bisa direkonsiliasi ("harusnya ada segini di tangan
                    Owner") tanpa perlu buka Riwayat Setoran satu-satu. */}
                {totalTransferredToOwner > 0 && (
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">— Sudah disetor ke Owner</span>
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">{formatRupiah(totalTransferredToOwner)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saldo di Kurir</span>
                  <span className={`text-sm font-bold ${totalHeldByCouriers < 0 ? 'text-accent-600 dark:text-accent-400' : totalHeldByCouriers > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatRupiah(totalHeldByCouriers)}
                  </span>
                </div>
                {/* Gate pakai !== 0 (bukan > 0) — kurir dengan saldo NEGATIF
                    (nombokin belanja pakai duit pribadi) tetap harus muncul
                    di sini, karena itu artinya bisnis berutang ke kurir dan
                    owner perlu tahu supaya bisa ganti uangnya. */}
                {couriers.length > 0 && totalHeldByCouriers !== 0 && (
                  <div className="pl-2 space-y-1 pt-1">
                    {courierBalances.filter(b => b.balance !== 0).map(b => {
                      const isNegative = b.balance < 0;
                      return (
                        <div key={b.employeeId} className="flex justify-between items-center gap-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            — {b.employeeName}
                            {!b.isActive && (
                              <span className="ml-1 text-amber-500 dark:text-amber-400 font-semibold">(Resign)</span>
                            )}
                          </span>
                          <span className={`text-[11px] font-semibold shrink-0 ${isNegative ? 'text-accent-500 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {isNegative ? `Toko berutang ${formatRupiah(Math.abs(b.balance))}` : formatRupiah(b.balance)}
                          </span>
                          {/* Setor & Hapus cuma masuk akal buat saldo POSITIF
                              (ada cash beneran di tangan kurir). Saldo NEGATIF
                              dapat tombol "Ganti Uang" (reimburse) sebagai
                              gantinya — kasir bayar utang bisnis ke kurir. */}
                          {!isNegative ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDeposit(b)}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-1.5 py-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95 transition-all duration-200 shrink-0"
                              >
                                Setor
                              </button>
                              {/* Hapus Setoran (write-off) — khusus Admin. Beda dari
                                  Setor: nurunin saldo kurir TAPI gak nambah Saldo
                                  Dompet (lihat handleConfirmWriteoff & totalWrittenOff). */}
                              {isAdminMode && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWriteoff(b)}
                                  className="text-[10px] font-bold text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-500/30 rounded-lg px-1.5 py-0.5 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-95 transition-all duration-200 shrink-0"
                                >
                                  Hapus
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReimburse(b)}
                              className="text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 rounded-lg px-1.5 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-500/10 active:scale-95 transition-all duration-200 shrink-0"
                            >
                              Ganti Uang
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
      ))}

      {/* =========================================================================
          REKAPITULASI & RIWAYAT HARIAN SHIFT KASIR — tab "Riwayat"
          ========================================================================= */}
      {activeTab === 'riwayat' && (
      <div className="mt-8 pb-12">
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

      {activeTab === 'log-kurir' && isAdminMode && (
        <div className="pb-12 max-w-4xl">
          <div className="mb-6">
            <h3 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-600 dark:text-accent-400" /> Log Kurir
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Semua jenis transaksi kurir: setor, hapus (write-off), ganti uang (reimburse), dan setor ke Owner.</p>
          </div>

          <Card padding="none" className="overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">Riwayat Transaksi Kurir</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Termasuk setoran manual, hapus setoran, ganti uang, & penutupan saldo lama otomatis.</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto custom-scrollbar">
              {applySort(activeOnly(cashTransfers || []).filter(t => !isOwnerTransfer(t)), 'date-desc', { date: t => new Date(t.date) }).length === 0 ? (
                <EmptyState size="sm" icon={<History className="w-8 h-8 opacity-30" />} title="Belum ada riwayat transaksi kurir." />
              ) : (
                applySort(activeOnly(cashTransfers || []).filter(t => !isOwnerTransfer(t)), 'date-desc', { date: t => new Date(t.date) }).map(t => {
                  const meta = getCourierTransferMeta(t);
                  const isNegativeAmount = (t.amount || 0) < 0;
                  return (
                    <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{t.employeeName}</p>
                          <Badge variant={meta.badgeVariant}><span className="uppercase tracking-wider text-[10px]">{meta.label}</span></Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t.note}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(t.date).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-black ${isNegativeAmount ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatRupiah(Math.abs(t.amount || 0))}
                        </span>
                        <IconButton variant="edit" onClick={() => handleOpenEditCourierTransfer(t)} title="Edit baris transaksi ini">
                          <Edit className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton variant="delete" onClick={() => handleDeleteCourierTransfer(t.id)} title="Hapus baris transaksi ini">
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden flex flex-col mt-4">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">Riwayat Setor ke Owner</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Total: {formatRupiah(totalTransferredToOwner)}</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar">
              {applySort(activeOnly(cashTransfers || []).filter(isOwnerTransfer), 'date-desc', { date: t => new Date(t.date) }).length === 0 ? (
                <EmptyState size="sm" icon={<History className="w-8 h-8 opacity-30" />} title="Belum ada setoran ke Owner." />
              ) : (
                applySort(activeOnly(cashTransfers || []).filter(isOwnerTransfer), 'date-desc', { date: t => new Date(t.date) }).map(t => {
                  const meta = getCourierTransferMeta(t);
                  return (
                    <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{t.note || 'Setor ke Owner'}</p>
                          <Badge variant={meta.badgeVariant}><span className="uppercase tracking-wider text-[10px]">{meta.label}</span></Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(t.date).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-sky-600 dark:text-sky-400">{formatRupiah(t.amount)}</span>
                        <IconButton variant="edit" onClick={() => handleOpenEditCourierTransfer(t)} title="Edit baris setoran ini">
                          <Edit className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton variant="delete" onClick={() => handleDeleteCourierTransfer(t.id)} title="Hapus baris setoran ini">
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
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
        depositTarget={depositTarget}
        setDepositTarget={setDepositTarget}
        partialDepositInput={partialDepositInput}
        setPartialDepositInput={setPartialDepositInput}
        courierBalances={courierBalances}
        handleConfirmPartialDeposit={handleConfirmPartialDeposit}
        isDepositSubmitting={isDepositSubmitting}
        writeoffTarget={writeoffTarget}
        setWriteoffTarget={setWriteoffTarget}
        writeoffInput={writeoffInput}
        setWriteoffInput={setWriteoffInput}
        handleConfirmWriteoff={handleConfirmWriteoff}
        isWriteoffSubmitting={isWriteoffSubmitting}
        reimburseTarget={reimburseTarget}
        setReimburseTarget={setReimburseTarget}
        reimburseInput={reimburseInput}
        setReimburseInput={setReimburseInput}
        handleConfirmReimburse={handleConfirmReimburse}
        isReimburseSubmitting={isReimburseSubmitting}
        editingTransfer={editingTransfer}
        setEditingTransfer={setEditingTransfer}
        editTransferAmountInput={editTransferAmountInput}
        setEditTransferAmountInput={setEditTransferAmountInput}
        editTransferNoteInput={editTransferNoteInput}
        setEditTransferNoteInput={setEditTransferNoteInput}
        handleSaveCourierTransferEdit={handleSaveCourierTransferEdit}
        isOwnerTransferOpen={isOwnerTransferOpen}
        setIsOwnerTransferOpen={setIsOwnerTransferOpen}
        ownerTransferInput={ownerTransferInput}
        setOwnerTransferInput={setOwnerTransferInput}
        ownerTransferNoteInput={ownerTransferNoteInput}
        setOwnerTransferNoteInput={setOwnerTransferNoteInput}
        handleConfirmOwnerTransfer={handleConfirmOwnerTransfer}
        isOwnerTransferSubmitting={isOwnerTransferSubmitting}
      />
    </div>
  );
};

export default ShiftView;