import React, { useState } from 'react';
import { Scale, Calendar } from 'lucide-react';
import { toLocalMonthString } from '../../utils/formatters';
import { Card, PageHeader, Button } from '../../components/ui';
import BalanceSummaryTab from './tabs/BalanceSummaryTab';
import BalanceDetailTab from './tabs/BalanceDetailTab';

// Shell tipis: cuma nampung PageHeader, filter periode, dan tab switcher
// Ringkasan/Rincian. Perhitungan & tampilan sesungguhnya ada di
// tabs/BalanceSummaryTab.jsx (dashboard ringkas apa adanya, tidak berubah
// dari sebelumnya) dan tabs/BalanceDetailTab.jsx (rincian per kategori/
// karyawan yang bisa di-expand ke transaksi).
//
// `period` dikelola di sini (bukan di masing-masing tab) supaya filter
// bulan tetap sinkron kalau user pindah dari Ringkasan ke Rincian.
const BalanceTab = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [period, setPeriod] = useState(toLocalMonthString());

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">

      <PageHeader
        title="Laba Rugi"
        subtitle="Laporan bulanan berbasis stok opname aktual"
        icon={<Scale className="w-6 h-6 text-accent-500 dark:text-accent-400" />}
      />

      {/* ── FILTER PERIODE ──────────────────────────────────────────────── */}
      <Card className="flex items-center gap-3 mb-4 overflow-x-auto scrollbar-hide">
        <Calendar className="text-slate-400 dark:text-slate-500 w-5 h-5 shrink-0" />
        <div className="relative shrink-0">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="appearance-none pl-3 pr-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          Menampilkan laporan untuk periode terpilih
        </span>
      </Card>

      {/* ── SUB-TAB SWITCHER (pola sama seperti HppView.jsx) ────────────── */}
      <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-6 overflow-x-auto hide-scrollbar shrink-0">
        {[
          { key: 'summary', label: 'Ringkasan' },
          { key: 'detail', label: 'Rincian' },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tab.key)}
            className="whitespace-nowrap"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'summary' && <BalanceSummaryTab period={period} />}
      {activeTab === 'detail' && <BalanceDetailTab period={period} />}
    </div>
  );
};

export default BalanceTab;