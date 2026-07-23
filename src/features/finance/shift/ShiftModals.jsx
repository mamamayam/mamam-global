import { FileText, ArrowRight } from 'lucide-react';
import { Button, Input, Modal } from '../../../components/ui';
import { locationLabel, isCourierLocation, courierIdFromLocation } from '../../../utils/cashHolders';

// Resolve label lokasi buat 1 baris transaksi TANPA butuh daftar kurir
// dari luar — pakai employeeNameSnapshot yang udah dibekukan di record
// itu sendiri saat pertama dicatat (lihat handleSubmitTransfer di
// useShiftLogic.js). Konsisten dgn pola snapshot yang sudah ada di
// kasbon/payroll: nama tetap benar walau karyawan diedit/dihapus belakangan.
function describeTransferLocation(key, employeeNameSnapshot) {
  if (isCourierLocation(key)) {
    const id = courierIdFromLocation(key);
    return employeeNameSnapshot?.[id] || 'Kurir';
  }
  return locationLabel(key);
}

// 3 modal seputar Shift/Dompet, dipisah dari ShiftView.jsx biar file
// orchestrator-nya gak kebanjiran JSX modal:
//   1. Koreksi Saldo Awal Dompet Aktif (khusus Admin)
//   2. Edit Laporan Shift yang sudah ditutup (khusus Admin)
//   3. Edit Baris Log Transaksi — koreksi nominal/catatan 1 baris
//      cashTransfers tanpa perlu hapus+catat ulang dari nol (khusus Admin)
//
// Modal Setor/Hapus/Ganti Uang/Setor Owner yang dulu ada di sini SUDAH
// DIHAPUS — digantikan SATU form generik "Catat Perpindahan Uang"
// langsung di tab Aktif ShiftView.jsx (lihat handleSubmitTransfer di
// useShiftLogic.js), bukan modal terpisah lagi.
//
// Semua props di bawah datang langsung dari useShiftLogic() di ShiftView.jsx
// (di-spread apa adanya).
export default function ShiftModals({
  // Modal 1: Koreksi Saldo Awal Aktif
  currentShift,
  shiftStats,
  formatRupiah,
  isEditingActiveInitial,
  setIsEditingActiveInitial,
  editActiveInitialInput,
  setEditActiveInitialInput,
  handleSaveActiveInitial,

  // Modal 2: Edit Laporan Shift
  editingShift,
  setEditingShift,
  editInitialCashInput,
  setEditInitialCashInput,
  editActualCashInput,
  setEditActualCashInput,
  handleSaveEdit,

  // Modal 3: Edit Baris Log Transaksi
  editingTransfer,
  setEditingTransfer,
  editTransferAmountInput,
  setEditTransferAmountInput,
  editTransferNoteInput,
  setEditTransferNoteInput,
  handleSaveCourierTransferEdit,
}) {
  return (
    <>
      {/* =========================================================================
          MODAL EDIT SALDO AWAL — SHIFT YANG SEDANG AKTIF (Khusus Admin)
          ========================================================================= */}
      <Modal
        isOpen={isEditingActiveInitial}
        onClose={() => setIsEditingActiveInitial(false)}
        title="Koreksi Saldo Awal Dompet Aktif"
      >
        {currentShift && (
          <>
            <div className="p-4 md:p-6 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">ID: {currentShift.id}</p>

              <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 p-3 rounded-xl text-xs flex items-start gap-2 border border-blue-100 dark:border-blue-500/20">
                <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Sebagai Admin, Anda dapat mengoreksi <b>Saldo Awal</b> dompet yang sedang berjalan ini. Saldo Akhir (target) akan dihitung ulang secara otomatis.</p>
              </div>

              <div>
                <Input
                  type="number"
                  label="Koreksi Saldo Awal (Modal)"
                  icon={<span className="font-bold">Rp</span>}
                  value={editActiveInitialInput}
                  onChange={e => setEditActiveInitialInput(e.target.value)}
                  placeholder="0"
                  className="text-lg font-bold py-3"
                />
              </div>

              {/* Preview Saldo Akhir Baru */}
              {editActiveInitialInput !== '' && shiftStats && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Preview Saldo Akhir Baru:</p>
                  <p className="font-black text-lg text-slate-800 dark:text-slate-100">
                    {formatRupiah(shiftStats.expectedCash + (Number(editActiveInitialInput) - shiftStats.initialCash))}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setIsEditingActiveInitial(false)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSaveActiveInitial}
              >
                Simpan Koreksi
              </Button>
            </div>
          </>
        )}
      </Modal>

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
                  label="Koreksi Saldo Awal (Modal)"
                  icon={<span className="font-bold">Rp</span>}
                  value={editInitialCashInput}
                  onChange={e => setEditInitialCashInput(e.target.value)}
                  placeholder="0"
                  className="text-lg font-bold py-3"
                />
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
              {editActualCashInput && editInitialCashInput !== '' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Preview Selisih Baru:</p>
                  {(() => {
                    const previewExpected = editingShift.stats.expectedCash + (Number(editInitialCashInput) - editingShift.stats.initialCash);
                    const previewDifference = Number(editActualCashInput) - previewExpected;
                    return (
                      <p className={`font-black text-lg ${previewDifference < 0 ? 'text-accent-500 dark:text-accent-400' :
                        previewDifference > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'
                        }`}>
                        {formatRupiah(previewDifference)}
                      </p>
                    );
                  })()}
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

      {/* =========================================================================
          MODAL EDIT BARIS LOG TRANSAKSI (khusus Admin)
          Koreksi cepat kalau nominal/catatan di 1 baris cashTransfers salah
          input — TIDAK mengubah lokasi Dari/Ke-nya (kalau salah pilih
          lokasi, lebih aman hapus baris ini lewat handleDeleteCourierTransfer
          & catat ulang dari Card "Catat Perpindahan Uang"), cuma nominal &
          catatan. Amount SELALU positif di model baru ini (gak ada lagi
          trik tanda negatif dari model lama) — lihat handleSaveCourierTransferEdit.
          ========================================================================= */}
      <Modal
        isOpen={!!editingTransfer}
        onClose={() => { setEditingTransfer(null); setEditTransferAmountInput(''); setEditTransferNoteInput(''); }}
        title="Edit Baris Transaksi"
      >
        {editingTransfer && (() => {
          const amount = Number(editTransferAmountInput);
          const isValidAmount = editTransferAmountInput !== '' && Number.isFinite(amount) && amount > 0;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{describeTransferLocation(editingTransfer.from, editingTransfer.employeeNameSnapshot)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{describeTransferLocation(editingTransfer.to, editingTransfer.employeeNameSnapshot)}</span>
                </div>

                <div>
                  <Input
                    type="number"
                    label="Nominal"
                    icon={<span className="font-bold">Rp</span>}
                    value={editTransferAmountInput}
                    onChange={e => setEditTransferAmountInput(e.target.value)}
                    placeholder="0"
                    className="text-lg font-bold py-3"
                  />
                </div>

                <div>
                  <Input
                    type="text"
                    label="Catatan"
                    value={editTransferNoteInput}
                    onChange={e => setEditTransferNoteInput(e.target.value)}
                    placeholder="Catatan setoran (opsional)"
                  />
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setEditingTransfer(null); setEditTransferAmountInput(''); setEditTransferNoteInput(''); }}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveCourierTransferEdit}
                  disabled={!isValidAmount}
                >
                  Simpan Koreksi
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>

    </>
  );
}