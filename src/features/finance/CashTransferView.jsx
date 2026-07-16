import React, { useState, useMemo } from 'react';
import { Bike, Save, History, Trash2, Wallet, RotateCcw, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString } from '../../utils/formatters';
import { PageHeader, Card, Input, Select, Badge, IconButton, EmptyState, Button } from '../../components/ui';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { pushTransactionDelete } from '../../storage/realtimeSync';
import { getActiveCouriers } from '../../features/hrd/utils/payrollLogic';
import { computeAllCourierBalances } from '../../utils/cashHolders';

// Parse "YYYY-MM-DD" sebagai local midnight (pola sama dgn Income/ExpenseView)
// supaya konsisten dan gak kena pergeseran UTC.
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * SETORAN KURIR
 * ═══════════════════════════════════════════════════════════════════
 * Halaman ini BUKAN pengeluaran/pemasukan bisnis — ini cuma perpindahan
 * kas internal: uang yang tadinya dipegang kurir (dari hasil order
 * Delivery yang dibayar COD ke kurir, dikurangi belanja yang dia bayar
 * pakai cash itu) dipindahkan balik ke kasir/toko. Makanya disimpan di
 * ledger terpisah (`cashTransfers`), bukan ditambahkan ke expenses
 * ataupun bikin income baru — supaya gak dobel-hitung di Laporan
 * Laba/Rugi (uangnya kan sudah tercatat lewat penjualan itu sendiri;
 * lihat penjelasan lengkap di utils/cashHolders.js).
 *
 * Saldo per kurir dihitung REAL-TIME dari:
 *   salesHistory (order Delivery COD ke kurir) - expenses (cash keluar dari kurir) - cashTransfers (sudah disetor)
 */
const CashTransferView = () => {
  const {
    cashTransfers, setCashTransfers,
    expenses, salesHistory, employees,
    triggerAlert, triggerConfirm, formatRupiah, isAdminMode
  } = useAppContext();

  const couriers = useMemo(() => getActiveCouriers(employees), [employees]);

  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [showTrash, setShowTrash] = useState(false);

  // Saldo semua kurir, dihitung dari data aktif (recycle bin di-exclude).
  // Cash masuk kurir MURNI dari salesHistory (order Delivery yang dibayar
  // COD langsung ke kurir) — bukan dari incomes, karena kurir gak pernah
  // menerima "pemasukan lain"/modal. Lihat utils/cashHolders.js.
  const balances = useMemo(() => computeAllCourierBalances(couriers, {
    expenses: activeOnly(expenses),
    salesHistory: activeOnly(salesHistory),
    cashTransfers: activeOnly(cashTransfers),
  }), [couriers, expenses, salesHistory, cashTransfers]);

  const selectedBalance = useMemo(
    () => balances.find(b => b.employeeId === employeeId)?.balance ?? 0,
    [balances, employeeId]
  );

  const totalHeldByCouriers = useMemo(
    () => balances.reduce((sum, b) => sum + Math.max(b.balance, 0), 0),
    [balances]
  );

  const handleSubmit = () => {
    if (!employeeId) return triggerAlert('Pilih kurir yang menyetor!');
    if (!amount || amount <= 0) return triggerAlert('Masukkan nominal setoran yang valid!');
    if (!dateInput) return triggerAlert('Pilih tanggal setoran!');

    const courier = couriers.find(c => c.id === employeeId);
    const setorAmount = Number(amount);

    if (setorAmount > selectedBalance) {
      triggerConfirm(
        `Saldo kas ${courier?.name || 'kurir ini'} yang tercatat cuma ${formatRupiah(selectedBalance)}, tapi kamu mau catat setoran ${formatRupiah(setorAmount)}. Lanjut simpan? (Bisa jadi ada transaksi yang belum tercatat.)`,
        () => saveTransfer(courier, setorAmount)
      );
      return;
    }
    saveTransfer(courier, setorAmount);
  };

  const saveTransfer = (courier, setorAmount) => {
    const newTransfer = {
      id: `CTF-${Date.now()}`,
      employeeId,
      employeeName: courier?.name || 'Kurir', // snapshot, pola sama dgn kasbon
      amount: setorAmount,
      note,
      date: parseLocalDate(dateInput),
    };
    setCashTransfers([newTransfer, ...cashTransfers]);
    setAmount(''); setNote('');
    triggerAlert('Setoran berhasil dicatat!');
  };

  const handleDelete = (id) => {
    triggerConfirm('Hapus catatan setoran ini? Saldo kurir akan naik kembali sejumlah ini.', () => {
      setCashTransfers(cashTransfers.map(t => t.id === id ? markDeleted(t) : t));
      triggerAlert('Catatan dipindahkan ke Recycle Bin.');
    });
  };

  const handleRestore = (id) => {
    setCashTransfers(cashTransfers.map(t => t.id === id ? restoreItem(t) : t));
    triggerAlert('Catatan berhasil dikembalikan.');
  };

  const handlePermanentDelete = (id) => {
    triggerConfirm('Hapus PERMANEN catatan setoran ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setCashTransfers(cashTransfers.filter(t => t.id !== id));
      pushTransactionDelete('cashTransfers', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Catatan dihapus permanen.');
    });
  };

  const visibleTransfers = useMemo(
    () => (showTrash ? trashedOnly(cashTransfers) : activeOnly(cashTransfers))
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [cashTransfers, showTrash]
  );

  if (couriers.length === 0) {
    return (
      <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
        <PageHeader title="Setoran Kurir" icon={<Bike className="w-6 h-6 text-accent-500 dark:text-accent-400" />} />
        <EmptyState
          icon={<Bike className="w-12 h-12" />}
          title="Belum ada karyawan dengan role Kurir."
          description="Set role karyawan jadi 'Kurir' di Manajemen Pegawai dulu, baru fitur ini bisa dipakai."
          className="h-full animate-in fade-in duration-300"
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <PageHeader title="Setoran Kurir" icon={<Bike className="w-6 h-6 text-accent-500 dark:text-accent-400" />} />

      {/* Panel saldo per kurir — ini yang jawab "duit kurir sekarang berapa?" */}
      <Card className="mb-6">
        <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4" /> Saldo Kas Kurir (belum disetor)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map(b => (
            <div key={b.employeeId} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{b.employeeName}</span>
              <span className={`font-black text-sm ${b.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {formatRupiah(b.balance)}
              </span>
            </div>
          ))}
        </div>
        {totalHeldByCouriers > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 italic">
            Total {formatRupiah(totalHeldByCouriers)} cash lagi ada di tangan kurir, di luar laci kasir.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full min-w-0">
        <Card padding="none" className="lg:col-span-1 p-5 space-y-4 h-fit w-full min-w-0 transition-shadow duration-300 hover:shadow-md">
          <Input type="date" label="Tanggal Setoran" value={dateInput} onChange={e => setDateInput(e.target.value)} />

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kurir</label>
            <Select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Pilih Kurir...</option>
              {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {employeeId && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Saldo kas tercatat saat ini: <span className="font-bold text-amber-600 dark:text-amber-400">{formatRupiah(selectedBalance)}</span>
              </p>
            )}
          </div>

          <Input
            type="number"
            label="Nominal Setoran"
            icon={<span className="font-bold">Rp</span>}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="text-lg font-bold"
          />

          <Input label="Catatan Tambahan" value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Setoran akhir shift" />

          <Button onClick={handleSubmit} size="full" variant="success" icon={<Save className="w-4 h-4" />} className="mt-2">
            Simpan Setoran
          </Button>
        </Card>

        <Card padding="none" className="lg:col-span-2 flex flex-col h-[500px] w-full min-w-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0">
              <History className="w-4 h-4" /> {showTrash ? 'Recycle Bin' : 'Riwayat Setoran'}
            </h3>
            {isAdminMode && (
              <button
                type="button"
                onClick={() => setShowTrash(v => !v)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 active:scale-95 transition-all duration-300 shrink-0"
              >
                {showTrash ? <X className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                {showTrash ? 'Tutup Recycle Bin' : 'Recycle Bin'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {visibleTransfers.length === 0 ? (
              <EmptyState
                icon={showTrash ? <Trash2 className="w-12 h-12" /> : <Bike className="w-12 h-12" />}
                title={showTrash ? 'Recycle bin kosong.' : 'Belum ada setoran tercatat.'}
                className="h-full animate-in fade-in duration-300"
              />
            ) : (
              visibleTransfers.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-300 animate-in slide-in-from-left-2 duration-300">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                      {t.employeeName}
                      <Badge variant="neutral">{new Date(t.date).toLocaleDateString('id-ID')}</Badge>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t.note || 'Tanpa catatan'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl text-sm border border-emerald-100 dark:border-emerald-500/20">
                      +{formatRupiah(t.amount)}
                    </p>
                    <div className="flex gap-1">
                      {showTrash ? (
                        isAdminMode && (
                          <>
                            <IconButton variant="edit" ghost onClick={() => handleRestore(t.id)} title="Kembalikan"><RotateCcw className="w-4 h-4" /></IconButton>
                            <IconButton variant="delete" ghost onClick={() => handlePermanentDelete(t.id)}><Trash2 className="w-4 h-4" /></IconButton>
                          </>
                        )
                      ) : (
                        <IconButton variant="delete" ghost onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></IconButton>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CashTransferView;
