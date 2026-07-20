import React, { useState, useMemo } from 'react';
import { ChevronDown, ShoppingCart, Receipt, Users, Wallet } from 'lucide-react';
import { formatRupiah } from '../../../utils/formatters';
import { Card, EmptyState } from '../../../components/ui';
import { useAppContext } from '../../../context/AppContext';
import { getBalanceDetail } from '../balance';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/* ── Baris transaksi generik (dipakai untuk expenses) ────────────────── */
const ExpenseRow = ({ exp }) => (
  <div className="flex items-center justify-between py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
        {exp.note || 'Tanpa catatan'}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(exp.date)}</p>
    </div>
    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 shrink-0 pl-3">
      {formatRupiah(exp.amount)}
    </span>
  </div>
);

/* ── Grup kategori collapsible (dipakai untuk Belanja Bahan Baku &
   Biaya Operasional) ───────────────────────────────────────────────── */
const CategoryGroup = ({ category, total, transactions, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{category}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">({transactions.length} transaksi)</span>
        </div>
        <span className="font-black text-sm text-slate-800 dark:text-slate-100 shrink-0 pl-3">
          {formatRupiah(total)}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {transactions.map(exp => <ExpenseRow key={exp.id} exp={exp} />)}
        </div>
      )}
    </Card>
  );
};

/* ── Grup karyawan collapsible (dipakai untuk Biaya Gaji) ────────────── */
const EmployeeGroup = ({ data, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{data.employeeName}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">({data.hariKerja} hari kerja)</span>
        </div>
        <span className="font-black text-sm text-slate-800 dark:text-slate-100 shrink-0 pl-3">
          {formatRupiah(data.total)}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 dark:text-slate-500">Upah Jam Kerja</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(data.basicPay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 dark:text-slate-500">Bonus Full Time</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(data.fullTimeBonusTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 dark:text-slate-500">Uang Lembur</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(data.overtimePayTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 dark:text-slate-500">Tambahan Lain</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(data.totalAdditions)}</span>
            </div>
          </div>
          {data.totalKasbon > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5">
              <Wallet className="w-3 h-3 shrink-0" />
              Kasbon bulan ini {formatRupiah(data.totalKasbon)} — info saja, tidak mengurangi biaya gaji di atas
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const SectionHeader = ({ icon, title, total }) => (
  <div className="flex items-center justify-between mb-2 mt-6 first:mt-0">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">{title}</h3>
    </div>
    <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatRupiah(total)}</span>
  </div>
);

// `period` ("YYYY-MM") diteruskan dari BalanceTab.jsx (shell) supaya
// filter periode tetap sinkron antara tab Ringkasan dan tab Rincian.
const BalanceDetailTab = ({ period }) => {
  const { salesHistory, expenses, employeeDailyRecords, employees } = useAppContext();

  const detail = useMemo(
    () => getBalanceDetail(salesHistory, expenses, employeeDailyRecords, employees, period),
    [salesHistory, expenses, employeeDailyRecords, employees, period]
  );

  const totalBahanBaku = detail.belanjaBahanBakuGroups.reduce((s, g) => s + g.total, 0);
  const totalOperasional = detail.biayaOperasionalGroups.reduce((s, g) => s + g.total, 0);
  const totalGaji = detail.biayaGajiGroups.reduce((s, g) => s + g.total, 0);

  const isEmpty =
    detail.belanjaBahanBakuGroups.length === 0 &&
    detail.biayaOperasionalGroups.length === 0 &&
    detail.biayaGajiGroups.length === 0;

  if (isEmpty) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<Receipt className="w-8 h-8 text-slate-300" />}
          title="Belum ada transaksi belanja, biaya, atau gaji di periode ini"
        />
      </Card>
    );
  }

  return (
    <div>
      {/* ── BELANJA BAHAN BAKU ──────────────────────────────────────────── */}
      {detail.belanjaBahanBakuGroups.length > 0 && (
        <>
          <SectionHeader
            icon={<ShoppingCart className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
            title="Belanja Bahan Baku"
            total={totalBahanBaku}
          />
          <div className="space-y-2">
            {detail.belanjaBahanBakuGroups.map(g => (
              <CategoryGroup key={g.category} {...g} defaultOpen />
            ))}
          </div>
        </>
      )}

      {/* ── BIAYA OPERASIONAL ───────────────────────────────────────────── */}
      {detail.biayaOperasionalGroups.length > 0 && (
        <>
          <SectionHeader
            icon={<Receipt className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
            title="Biaya Operasional"
            total={totalOperasional}
          />
          <div className="space-y-2">
            {detail.biayaOperasionalGroups.map(g => (
              <CategoryGroup key={g.category} {...g} />
            ))}
          </div>
        </>
      )}

      {/* ── BIAYA GAJI ───────────────────────────────────────────────────── */}
      {detail.biayaGajiGroups.length > 0 && (
        <>
          <SectionHeader
            icon={<Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
            title="Biaya Gaji"
            total={totalGaji}
          />
          <div className="space-y-2 mb-2">
            {detail.biayaGajiGroups.map(g => (
              <EmployeeGroup key={g.employeeId} data={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BalanceDetailTab;