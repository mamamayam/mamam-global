import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useRecycleBin } from '../../hook/useRecycleBin';
import { resolveEmployeeForRecord } from '../hrd/utils/payrollLogic';
import { IconButton } from '../../components/ui';
import {
  Trash2, RotateCcw, ChevronDown, ChevronRight, Inbox,
  TrendingUp, TrendingDown, History, Users, Ticket, Fingerprint, Wallet, Clock,
} from 'lucide-react';

// employeeDailyRecords & savedBills & cashTransfers TIDAK muncul di sini:
// employeeDailyRecords ada di kategori "Input Harian" di bawah, tapi
// savedBills & cashTransfers sengaja gak dikasih Recycle Bin sama sekali
// (soft-delete diam-diam, tier "koreksi cepat" — lihat CartDrawer.jsx &
// useShiftLogic.js buat konteksnya).

const ATTENDANCE_TYPE_LABEL = {
  masuk: 'Absen Masuk',
  keluar: 'Absen Keluar',
  masuk_lagi: 'Masuk Lagi',
  bolong: 'Bolong',
  libur: 'Libur',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const RecycleBinView = () => {
  const {
    incomes, setIncomes,
    expenses, setExpenses,
    salesHistory, setSalesHistory,
    customers, setCustomers,
    vouchers, setVouchers,
    attendanceLog, setAttendanceLog,
    employeeDailyRecords, setEmployeeDailyRecords,
    shiftHistory, setShiftHistory,
    employees,
    triggerConfirm, triggerAlert, formatRupiah, isAdminMode,
  } = useAppContext();

  const [expandedKey, setExpandedKey] = useState(null);

  const incomeBin = useRecycleBin(incomes, setIncomes, {
    tableKey: 'incomes', itemLabel: 'catatan pemasukan', triggerConfirm, triggerAlert,
  });
  const expenseBin = useRecycleBin(expenses, setExpenses, {
    tableKey: 'expenses', itemLabel: 'catatan pengeluaran', triggerConfirm, triggerAlert,
  });
  const historyBin = useRecycleBin(salesHistory, setSalesHistory, {
    tableKey: 'salesHistory', itemLabel: 'riwayat pesanan', triggerConfirm, triggerAlert,
  });
  const customerBin = useRecycleBin(customers, setCustomers, {
    tableKey: 'customers', itemLabel: 'pelanggan',
    permanentDeleteWarning: 'Data riwayat poin mungkin kehilangan referensi nama.',
    triggerConfirm, triggerAlert,
  });
  const voucherBin = useRecycleBin(vouchers, setVouchers, {
    tableKey: 'vouchers', itemLabel: 'voucher', triggerConfirm, triggerAlert,
  });
  const attendanceBin = useRecycleBin(attendanceLog, setAttendanceLog, {
    tableKey: 'attendanceLog', itemLabel: 'record absen', triggerConfirm, triggerAlert,
  });
  const dailyBin = useRecycleBin(employeeDailyRecords, setEmployeeDailyRecords, {
    tableKey: 'employeeDailyRecords', itemLabel: 'data input', triggerConfirm, triggerAlert,
  });
  const shiftBin = useRecycleBin(shiftHistory, setShiftHistory, {
    tableKey: 'shiftHistory', itemLabel: 'data dompet', triggerConfirm, triggerAlert,
  });

  const categories = [
    {
      key: 'incomes', label: 'Pemasukan', icon: TrendingUp, bin: incomeBin,
      getTitle: (i) => i.category || 'Pemasukan',
      getSubtitle: (i) => `${fmtDate(i.date)} • ${formatRupiah(i.amount)}`,
    },
    {
      key: 'expenses', label: 'Pengeluaran', icon: TrendingDown, bin: expenseBin,
      getTitle: (e) => e.category || 'Pengeluaran',
      getSubtitle: (e) => `${fmtDate(e.date)} • ${formatRupiah(e.amount)}`,
    },
    {
      key: 'salesHistory', label: 'Riwayat Pesanan', icon: History, bin: historyBin,
      getTitle: (o) => o.customerName || o.orderNumber || 'Pesanan',
      getSubtitle: (o) => `${fmtDateTime(o.date)} • ${formatRupiah(o.total)}`,
    },
    {
      key: 'customers', label: 'Pelanggan', icon: Users, bin: customerBin,
      getTitle: (c) => c.name || 'Pelanggan',
      getSubtitle: (c) => c.phone || '-',
    },
    {
      key: 'vouchers', label: 'Voucher', icon: Ticket, bin: voucherBin,
      getTitle: (v) => v.code || 'Voucher',
      getSubtitle: (v) => v.discountType === 'percent' ? `Diskon ${v.discountValue}%` : `Diskon ${formatRupiah(v.discountValue || 0)}`,
    },
    {
      key: 'attendanceLog', label: 'Absensi', icon: Fingerprint, bin: attendanceBin,
      getTitle: (r) => r.employeeName || 'Karyawan',
      getSubtitle: (r) => `${ATTENDANCE_TYPE_LABEL[r.type] || r.type} • ${fmtDateTime(r.date)}`,
    },
    {
      key: 'employeeDailyRecords', label: 'Input Harian', icon: Wallet, bin: dailyBin,
      getTitle: (r) => resolveEmployeeForRecord(r, employees)?.name || 'Karyawan',
      getSubtitle: (r) => fmtDate(r.date),
    },
    {
      key: 'shiftHistory', label: 'Dompet / Shift', icon: Clock, bin: shiftBin,
      getTitle: (s) => `Shift ${fmtDate(s.startTime)}`,
      getSubtitle: (s) => `${fmtTime(s.startTime)} - ${fmtTime(s.endTime)}`,
    },
  ];

  const totalCount = categories.reduce((sum, c) => sum + c.bin.trashedCount, 0);

  if (!isAdminMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-50 dark:bg-slate-950">
        <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
        <p className="font-bold text-slate-600 dark:text-slate-300">Khusus Admin</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Recycle Bin cuma bisa diakses dalam mode Admin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-4 flex items-center gap-3 shrink-0">
        <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-1">
          <Trash2 className="w-6 h-6 text-accent-500" /> Recycle Bin
        </h2>
        {totalCount > 0 && (
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
            {totalCount} item
          </span>
        )}
      </div>

      <div className="p-4">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-in fade-in duration-300">
            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="font-bold text-slate-600 dark:text-slate-300">Recycle Bin kosong</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Data yang lu hapus dari Pemasukan, Pengeluaran, Pelanggan, dan lainnya bakal muncul di sini selama 30 hari sebelum kehapus otomatis.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const isOpen = expandedKey === cat.key;
              const count = cat.bin.trashedCount;
              const Icon = cat.icon;
              return (
                <div key={cat.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <button
                    onClick={() => count > 0 && setExpandedKey(isOpen ? null : cat.key)}
                    disabled={count === 0}
                    className={`w-full flex items-center justify-between p-4 transition-colors ${count > 0 ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'opacity-40 cursor-default'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-0.5 min-w-[1.75rem] text-center">
                        {count}
                      </span>
                      {count > 0 && (isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/60 animate-in fade-in duration-200">
                      {cat.bin.trashedItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 p-3.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">{cat.getTitle(item)}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{cat.getSubtitle(item)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <IconButton variant="edit" onClick={() => cat.bin.handleRestore(item.id)} title="Kembalikan">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton variant="delete" onClick={() => cat.bin.handlePermanentDelete(item.id)} title="Hapus Permanen">
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecycleBinView;
