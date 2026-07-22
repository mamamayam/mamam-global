import { FileText, AlertTriangle, Wallet } from 'lucide-react';
import { Button, Input, Modal } from '../../../components/ui';

// 7 modal seputar Shift/Dompet, dipisah dari ShiftView.jsx biar file
// orchestrator-nya gak kebanjiran JSX modal:
//   1. Koreksi Saldo Awal Dompet Aktif (khusus Admin)
//   2. Edit Laporan Shift yang sudah ditutup (khusus Admin)
//   3. Setor ke Dompet (kurir -> dompet, penuh/sebagian)
//   4. Hapus Setoran / Write-off saldo kurir (khusus Admin)
//   5. Ganti Uang / Reimburse kurir yang nombokin (saldo negatif)
//   6. Edit Baris Setoran Kurir — koreksi nominal/catatan 1 baris riwayat
//      cashTransfers tanpa perlu hapus+catat ulang dari nol (khusus Admin)
//   7. Setor ke Owner (dompet -> pemilik bisnis) — beda sumbu dari 3/4/5
//      di atas (yang semuanya soal Kurir <-> Dompet), gak butuh target
//      kurir, cuma nominal + catatan tujuan (opsional).
//
// Semua props di bawah datang langsung dari useShiftLogic() di ShiftView.jsx
// (di-spread apa adanya) — nama & perilaku PERSIS sama dengan versi lama,
// cuma dipindah lokasi.
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

  // Modal 3: Setor ke Dompet
  depositTarget,
  setDepositTarget,
  partialDepositInput,
  setPartialDepositInput,
  courierBalances,
  handleConfirmPartialDeposit,
  isDepositSubmitting,

  // Modal 4: Hapus Setoran (Write-off)
  writeoffTarget,
  setWriteoffTarget,
  writeoffInput,
  setWriteoffInput,
  handleConfirmWriteoff,
  isWriteoffSubmitting,

  // Modal 5: Ganti Uang (Reimburse)
  reimburseTarget,
  setReimburseTarget,
  reimburseInput,
  setReimburseInput,
  handleConfirmReimburse,
  isReimburseSubmitting,

  // Modal 6: Edit Baris Setoran Kurir
  editingTransfer,
  setEditingTransfer,
  editTransferAmountInput,
  setEditTransferAmountInput,
  editTransferNoteInput,
  setEditTransferNoteInput,
  handleSaveCourierTransferEdit,

  // Modal 7: Setor ke Owner
  shiftStats: shiftStatsForOwnerTransfer, // shiftStats sudah ada di props Modal 1, alias biar jelas dipakai lagi di sini
  isOwnerTransferOpen,
  setIsOwnerTransferOpen,
  ownerTransferInput,
  setOwnerTransferInput,
  ownerTransferNoteInput,
  setOwnerTransferNoteInput,
  handleConfirmOwnerTransfer,
  isOwnerTransferSubmitting,
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
          MODAL SETOR — Pindahkan saldo Kurir ke Dompet (penuh atau sebagian)
          ========================================================================= */}
      <Modal
        isOpen={!!depositTarget}
        onClose={() => { setDepositTarget(null); setPartialDepositInput(''); }}
        title="Setor ke Dompet"
      >
        {depositTarget && (() => {
          // Live balance — dihitung ulang tiap render dari courierBalances,
          // supaya kalau ada transaksi baru masuk selagi modal ini terbuka,
          // angka yang ditampilkan & dipakai validasi selalu yang terkini.
          const liveEntry = courierBalances.find(b => b.employeeId === depositTarget.employeeId);
          const liveBalance = Math.max(liveEntry?.balance || 0, 0);
          const amount = Number(partialDepositInput);
          const isValidAmount = partialDepositInput !== '' && Number.isFinite(amount) && amount > 0 && amount <= liveBalance;
          const sisaPreview = partialDepositInput !== '' && Number.isFinite(amount) ? liveBalance - amount : liveBalance;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Saldo {depositTarget.employeeName} saat ini</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(liveBalance)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nominal yang Disetor</span>
                    <button
                      type="button"
                      onClick={() => setPartialDepositInput(String(liveBalance))}
                      disabled={liveBalance <= 0}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-2 py-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Setor Semua
                    </button>
                  </div>
                  <Input
                    type="number"
                    icon={<span className="font-bold">Rp</span>}
                    value={partialDepositInput}
                    onChange={e => setPartialDepositInput(e.target.value)}
                    placeholder="0"
                    className="text-lg font-bold py-3"
                  />
                  {partialDepositInput !== '' && amount > liveBalance && (
                    <p className="text-xs text-accent-500 dark:text-accent-400 mt-1">
                      Nominal melebihi saldo yang tersedia ({formatRupiah(liveBalance)}).
                    </p>
                  )}
                </div>

                {partialDepositInput !== '' && isValidAmount && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sisa saldo setelah setoran ini:</p>
                    <p className="font-black text-lg text-slate-800 dark:text-slate-100">{formatRupiah(sisaPreview)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setDepositTarget(null); setPartialDepositInput(''); }}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleConfirmPartialDeposit}
                  disabled={!isValidAmount || isDepositSubmitting}
                >
                  {isDepositSubmitting ? 'Memproses...' : 'Setor'}
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* =========================================================================
          MODAL HAPUS SETORAN — Write-off saldo Kurir (khusus Admin)
          Beda dari Setor: nurunin saldo kurir TAPI TIDAK menaikkan Saldo
          Dompet — dipakai kalau uang kurir hilang/gak balik (bukan
          perpindahan kas yang sah). Lihat handleConfirmWriteoff & catatan
          totalWrittenOff di shiftStats.
          ========================================================================= */}
      <Modal
        isOpen={!!writeoffTarget}
        onClose={() => { setWriteoffTarget(null); setWriteoffInput(''); }}
        title="Hapus Setoran (Write-off)"
      >
        {writeoffTarget && (() => {
          const liveEntry = courierBalances.find(b => b.employeeId === writeoffTarget.employeeId);
          const liveBalance = Math.max(liveEntry?.balance || 0, 0);
          const amount = Number(writeoffInput);
          const isValidAmount = writeoffInput !== '' && Number.isFinite(amount) && amount > 0 && amount <= liveBalance;
          const sisaPreview = writeoffInput !== '' && Number.isFinite(amount) ? liveBalance - amount : liveBalance;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex gap-2 items-start bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-accent-500 dark:text-accent-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-accent-700 dark:text-accent-300">
                    Nominal ini dicatat sebagai kerugian (uang hilang/tidak balik) — <b>TIDAK</b> menambah Saldo Akhir Dompet, beda dari Setor.
                  </p>
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Saldo {writeoffTarget.employeeName} saat ini</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(liveBalance)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nominal yang Dihapus</span>
                    <button
                      type="button"
                      onClick={() => setWriteoffInput(String(liveBalance))}
                      disabled={liveBalance <= 0}
                      className="text-[11px] font-bold text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-500/30 rounded-lg px-2 py-0.5 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Hapus Semua
                    </button>
                  </div>
                  <Input
                    type="number"
                    icon={<span className="font-bold">Rp</span>}
                    value={writeoffInput}
                    onChange={e => setWriteoffInput(e.target.value)}
                    placeholder="0"
                    className="text-lg font-bold py-3"
                  />
                  {writeoffInput !== '' && amount > liveBalance && (
                    <p className="text-xs text-accent-500 dark:text-accent-400 mt-1">
                      Nominal melebihi saldo yang tersedia ({formatRupiah(liveBalance)}).
                    </p>
                  )}
                </div>

                {writeoffInput !== '' && isValidAmount && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sisa saldo setelah dihapus:</p>
                    <p className="font-black text-lg text-slate-800 dark:text-slate-100">{formatRupiah(sisaPreview)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setWriteoffTarget(null); setWriteoffInput(''); }}
                >
                  Batal
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handleConfirmWriteoff}
                  disabled={!isValidAmount || isWriteoffSubmitting}
                >
                  {isWriteoffSubmitting ? 'Memproses...' : 'Hapus'}
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* =========================================================================
          MODAL GANTI UANG (Reimburse) — Kasir bayar utang bisnis ke kurir
          yang saldonya NEGATIF (nombokin belanja pakai duit pribadi).
          Kebalikan dari Setor: uang keluar dari Dompet -> tangan kurir.
          Lihat handleConfirmReimburse & catatan tanda amount di
          utils/cashHolders.js.
          ========================================================================= */}
      <Modal
        isOpen={!!reimburseTarget}
        onClose={() => { setReimburseTarget(null); setReimburseInput(''); }}
        title="Ganti Uang Kurir"
      >
        {reimburseTarget && (() => {
          const liveEntry = courierBalances.find(b => b.employeeId === reimburseTarget.employeeId);
          const liveDebt = liveEntry && liveEntry.balance < 0 ? Math.abs(liveEntry.balance) : 0;
          const amount = Number(reimburseInput);
          const isValidAmount = reimburseInput !== '' && Number.isFinite(amount) && amount > 0 && amount <= liveDebt;
          const sisaPreview = reimburseInput !== '' && Number.isFinite(amount) ? liveDebt - amount : liveDebt;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex gap-2 items-start bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-xl p-3">
                  <Wallet className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-700 dark:text-sky-300">
                    {reimburseTarget.employeeName} nombokin belanja bisnis pakai duit pribadi. Nominal ini keluar dari Dompet — <b>menurunkan</b> Saldo Akhir Dompet, kebalikan dari Setor.
                  </p>
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Utang ke {reimburseTarget.employeeName} saat ini</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(liveDebt)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nominal yang Diganti</span>
                    <button
                      type="button"
                      onClick={() => setReimburseInput(String(liveDebt))}
                      disabled={liveDebt <= 0}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 rounded-lg px-2 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-500/10 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Ganti Semua
                    </button>
                  </div>
                  <Input
                    type="number"
                    icon={<span className="font-bold">Rp</span>}
                    value={reimburseInput}
                    onChange={e => setReimburseInput(e.target.value)}
                    placeholder="0"
                    className="text-lg font-bold py-3"
                  />
                  {reimburseInput !== '' && amount > liveDebt && (
                    <p className="text-xs text-accent-500 dark:text-accent-400 mt-1">
                      Nominal melebihi utang yang tercatat ({formatRupiah(liveDebt)}).
                    </p>
                  )}
                </div>

                {reimburseInput !== '' && isValidAmount && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sisa utang setelah diganti:</p>
                    <p className="font-black text-lg text-slate-800 dark:text-slate-100">{formatRupiah(sisaPreview)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setReimburseTarget(null); setReimburseInput(''); }}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleConfirmReimburse}
                  disabled={!isValidAmount || isReimburseSubmitting}
                >
                  {isReimburseSubmitting ? 'Memproses...' : 'Ganti Uang'}
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* =========================================================================
          MODAL EDIT BARIS SETORAN KURIR (khusus Admin)
          Koreksi cepat kalau nominal/catatan di 1 baris cashTransfers salah
          input — TIDAK mengubah tipe transaksinya (deposit/writeoff/
          reimburse tetap sama), cuma nominal & catatan. Utk baris
          'reimburse' yang di data disimpan negatif, form tetap minta angka
          POSITIF (biar gak membingungkan), tandanya dipasang ulang otomatis
          saat disimpan — lihat handleSaveCourierTransferEdit.
          ========================================================================= */}
      <Modal
        isOpen={!!editingTransfer}
        onClose={() => { setEditingTransfer(null); setEditTransferAmountInput(''); setEditTransferNoteInput(''); }}
        title="Edit Baris Setoran"
      >
        {editingTransfer && (() => {
          const amount = Number(editTransferAmountInput);
          const isValidAmount = editTransferAmountInput !== '' && Number.isFinite(amount) && amount > 0;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Kurir</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{editingTransfer.employeeName}</span>
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

      {/* =========================================================================
          MODAL SETOR KE OWNER — Dompet -> pemilik bisnis. Beda sumbu dari
          Modal 3/4/5 (yang semuanya soal Kurir <-> Dompet): gak ada target
          kurir, cuma nominal + catatan tujuan opsional (mis. "Transfer BCA").
          Nominal divalidasi terhadap Saldo Akhir Dompet TERKINI — lihat
          handleConfirmOwnerTransfer di useShiftLogic.js.
          ========================================================================= */}
      <Modal
        isOpen={isOwnerTransferOpen}
        onClose={() => { setIsOwnerTransferOpen(false); setOwnerTransferInput(''); setOwnerTransferNoteInput(''); }}
        title="Setor ke Owner"
      >
        {isOwnerTransferOpen && (() => {
          const liveExpectedCash = Math.max(shiftStatsForOwnerTransfer?.expectedCash || 0, 0);
          const amount = Number(ownerTransferInput);
          const isValidAmount = ownerTransferInput !== '' && Number.isFinite(amount) && amount > 0 && amount <= liveExpectedCash;
          const sisaPreview = ownerTransferInput !== '' && Number.isFinite(amount) ? liveExpectedCash - amount : liveExpectedCash;

          return (
            <>
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex gap-2 items-start bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-xl p-3">
                  <Wallet className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-700 dark:text-sky-300">
                    Uang ditarik dari laci Dompet buat disetor ke Owner — <b>menurunkan</b> Saldo Akhir Dompet. Ini bukan pengeluaran/biaya, murni perpindahan lokasi uang yang sudah tercatat sah.
                  </p>
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Saldo Akhir Dompet saat ini</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(liveExpectedCash)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nominal Setoran</span>
                    <button
                      type="button"
                      onClick={() => setOwnerTransferInput(String(liveExpectedCash))}
                      disabled={liveExpectedCash <= 0}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 rounded-lg px-2 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-500/10 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Setor Semua
                    </button>
                  </div>
                  <Input
                    type="number"
                    icon={<span className="font-bold">Rp</span>}
                    value={ownerTransferInput}
                    onChange={e => setOwnerTransferInput(e.target.value)}
                    placeholder="0"
                    className="text-lg font-bold py-3"
                  />
                  {ownerTransferInput !== '' && amount > liveExpectedCash && (
                    <p className="text-xs text-accent-500 dark:text-accent-400 mt-1">
                      Nominal melebihi Saldo Akhir Dompet saat ini ({formatRupiah(liveExpectedCash)}).
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    type="text"
                    label="Catatan (opsional)"
                    value={ownerTransferNoteInput}
                    onChange={e => setOwnerTransferNoteInput(e.target.value)}
                    placeholder="mis. Transfer BCA, Tunai langsung"
                  />
                </div>

                {ownerTransferInput !== '' && isValidAmount && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sisa Saldo Dompet setelah setoran:</p>
                    <p className="font-black text-lg text-slate-800 dark:text-slate-100">{formatRupiah(sisaPreview)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setIsOwnerTransferOpen(false); setOwnerTransferInput(''); setOwnerTransferNoteInput(''); }}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleConfirmOwnerTransfer}
                  disabled={!isValidAmount || isOwnerTransferSubmitting}
                >
                  {isOwnerTransferSubmitting ? 'Memproses...' : 'Setor ke Owner'}
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>
    </>
  );
}