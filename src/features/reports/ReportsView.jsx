import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { activeOnly } from '../../utils/softDelete';
import {
  Award, BarChart3, Calendar, CircleMinus, ChevronRight, History, Package,
  ShoppingBag, Wallet, CircleDollarSign, TrendingUp, TrendingDown, Receipt
} from 'lucide-react';
import { formatRupiah, toLocalDateString } from '../../utils/formatters';
import { PageHeader, Card, EmptyState, Button } from '../../components/ui';

const ReportsView = () => {
  const { salesHistory, incomes, expenses = [], reportDateRange, setReportDateRange, activePreset } = useAppContext();

  const [dateFilter, setDateFilter] = useState('semua');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const filterTabs = [
    { id: 'semua', label: 'Semua Waktu' },
    { id: 'hari-ini', label: 'Hari Ini' },
    { id: '7-hari', label: '7 Hari' },
    { id: '30-hari', label: '30 Hari' },
    { id: 'bulan-berjalan', label: 'Bulan Ini' },
    { id: 'kustom', label: 'Pilih Tanggal' }
  ];

  const isWithinDateRange = (dateString, filterType) => {
    if (filterType === 'semua') return true;
    const orderDate = new Date(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (filterType) {
      case 'hari-ini':
        return orderDate >= startOfToday;
      case '7-hari':
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return orderDate >= sevenDaysAgo;
      case '30-hari':
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      case 'bulan-berjalan':
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      case 'kustom':
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      default:
        return true;
    }
  };

  const filteredSales = useMemo(() => {
    return activeOnly(salesHistory).filter(order => isWithinDateRange(order.date, dateFilter));
  }, [salesHistory, dateFilter, customStartDate, customEndDate]);

  const filteredIncomes = useMemo(() => {
    return activeOnly(incomes).filter(inc => isWithinDateRange(inc.date, dateFilter));
  }, [incomes, dateFilter, customStartDate, customEndDate]);

  const filteredExpenses = useMemo(() => {
    return activeOnly(expenses).filter(exp => isWithinDateRange(exp.date, dateFilter));
  }, [expenses, dateFilter, customStartDate, customEndDate]);

  const totalRevenue = filteredSales.reduce((sum, order) => sum + order.total, 0);
  const totalHPP = filteredSales.reduce((sum, order) => sum + order.hppTotal, 0);
  const totalOtherIncome = filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0);
  const totalExpense = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalCombinedIncome = totalRevenue + totalOtherIncome;
  const grossProfit = totalRevenue - totalHPP;
  const netProfit = grossProfit + totalOtherIncome - totalExpense;

  const salesByDate = useMemo(() => {
    const salesMap = {};
    filteredSales.forEach(order => {
      const dStr = toLocalDateString(order.date);
      salesMap[dStr] = (salesMap[dStr] || 0) + order.total;
    });
    const sortedEntries = Object.entries(salesMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedEntries.map(([rawDate, total]) => {
      const [y, m, day] = rawDate.split('-').map(Number);
      const d = new Date(y, m - 1, day);
      const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return { date: label, total };
    });
  }, [filteredSales]);

  const bestSellers = useMemo(() => {
    const itemCounts = {};
    filteredSales.forEach(order => {
      order.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.qty;
      });
    });
    return Object.entries(itemCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredSales]);

  const lineChartData = useMemo(() => {
    if (salesByDate.length === 0) return null;
    const maxVal = Math.max(...salesByDate.map(s => s.total), 10000);
    const width = 500;
    const height = 180;
    const paddingLeft = 55;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 30;
    const points = salesByDate.map((item, index) => {
      const x = paddingLeft + (index / Math.max(salesByDate.length - 1, 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - (item.total / maxVal) * (height - paddingTop - paddingBottom);
      return { x, y, label: item.date, val: item.total };
    });
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
      : '';
    return { points, linePath, areaPath, maxVal, width, height, paddingLeft, paddingRight, paddingTop, paddingBottom };
  }, [salesByDate]);

  /* ─────────────────────────────────────────────────────────────────────────
     Warna aksen — accent-600 (#ea580c) sesuai design system
  ───────────────────────────────────────────────────────────────────────── */
  const ACCENT = '#ea580c'; // accent-600
  const ACCENT_SOFT = '#ea580c'; // dipakai di area gradient juga
  const GRID_LINE = '#f1f5f9'; // slate-100

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <PageHeader
          title="Dashboard Laporan"
          icon={<BarChart3 className="w-6 h-6" />}
        />
      </div>

      <div className="flex-shrink-0 w-full flex flex-col gap-4 mb-8">

        {/* ── FILTER TANGGAL ──────────────────────────────────────────────── */}

        {/* Card 1: Tab Filter Periode Tanggal */}
        <Card className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Calendar className="text-slate-400 dark:text-slate-500 w-5 h-5 flex-shrink-0 mr-1" />
          {filterTabs.map(tab => (
            <Button
              key={tab.id}
              variant={dateFilter === tab.id ? 'dark' : 'secondary'}
              size="sm"
              onClick={() => setDateFilter(tab.id)}
              className="flex-shrink-0 whitespace-nowrap rounded-full"
            >
              {tab.label}
            </Button>
          ))}
        </Card>

        {/* Card 2: Input Khusus Tanggal Kustom */}
        {dateFilter === 'kustom' && (
          <Card className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-fit shadow-sm">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">Dari Tanggal</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-500 text-slate-700 dark:text-slate-200"
              />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-4" />
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-1">Sampai Tanggal</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-500 text-slate-700 dark:text-slate-200"
              />
            </div>
          </Card>
        )}

        {/* ── METRIC CARDS ─────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 mb-2">

          {/* Hero: Laba Bersih — variant="dark" (bg-slate-800) */}
          <Card
            variant="dark"
            padding="lg"
            className="lg:w-1/3 flex flex-col justify-center min-h-[180px] shadow-md group relative overflow-hidden"
          >
            {/* background decoration icon */}
            <div className="absolute top-0 right-0 p-6 opacity-[0.07] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">
              <CircleDollarSign className="w-32 h-32 text-white" />
            </div>

            <div className="relative z-10">
              {/* Status dot + label */}
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
                  Laba Bersih
                </p>
              </div>

              {/* Nilai */}
              <h3 className="font-heading text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight">
                {formatRupiah(netProfit)}
              </h3>

              {/* Keterangan */}
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Sisa bersih setelah HPP dan pengeluaran operasional.
              </p>
            </div>
          </Card>

          {/* Grid 2×2 rincian */}
          <div className="lg:w-2/3 grid grid-cols-2 gap-4">

            {/* Penjualan */}
            <Card padding="lg" className="flex flex-col justify-center hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Penjualan
                </p>
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatRupiah(totalRevenue)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">{filteredSales.length} transaksi</p>
            </Card>

            {/* Pemasukan lain */}
            <Card padding="lg" className="flex flex-col justify-center hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pemasukan Lain
                </p>
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatRupiah(totalOtherIncome)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Luar pendapatan penjualan</p>
            </Card>

            {/* HPP */}
            <Card padding="lg" className="flex flex-col justify-center hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  HPP (Modal Bahan)
                </p>
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatRupiah(totalHPP)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Harga pokok penjualan</p>
            </Card>

            {/* Pengeluaran — orange accent untuk "biaya" */}
            <Card padding="lg" className="flex flex-col justify-center hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-accent-500 dark:text-accent-400" />
                <p className="text-[11px] font-bold text-accent-500 dark:text-accent-400 uppercase tracking-wider">
                  Pengeluaran
                </p>
              </div>
              <h3 className="font-heading text-xl font-bold text-accent-600 dark:text-accent-400">
                {formatRupiah(totalExpense)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">{filteredExpenses.length} catatan biaya operasional</p>
            </Card>

          </div>
        </div>

        {/* ── VISUALISASI GRAFIK ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">

          {/* Grafik 1: Tren Penjualan Harian */}
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-4 h-4 text-accent-500" />
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">
                Tren Penjualan Harian
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[180px]">
              {lineChartData ? (
                <svg
                  className="w-full h-full"
                  viewBox={`0 0 ${lineChartData.width} ${lineChartData.height}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id="areaGradOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT_SOFT} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={ACCENT_SOFT} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 0.5, 1].map((ratio, idx) => {
                    const y = lineChartData.paddingTop + ratio * (lineChartData.height - lineChartData.paddingTop - lineChartData.paddingBottom);
                    const value = lineChartData.maxVal - ratio * lineChartData.maxVal;
                    return (
                      <g key={idx}>
                        <line
                          x1={lineChartData.paddingLeft}
                          y1={y}
                          x2={lineChartData.width - lineChartData.paddingRight}
                          y2={y}
                          stroke={GRID_LINE}
                          strokeWidth="1"
                        />
                        <text
                          x={lineChartData.paddingLeft - 8}
                          y={y + 4}
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                          fontWeight="600"
                        >
                          {formatRupiah(value).replace(/Rp\s?/, '')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill — orange accent */}
                  {lineChartData.areaPath && (
                    <path d={lineChartData.areaPath} fill="url(#areaGradOrange)" />
                  )}

                  {/* Line — accent-600 */}
                  {lineChartData.linePath && (
                    <path
                      d={lineChartData.linePath}
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Dots + axis labels */}
                  {lineChartData.points.map((p, i) => {
                    const showLabel = lineChartData.points.length <= 7
                      || i % Math.ceil(lineChartData.points.length / 7) === 0
                      || i === lineChartData.points.length - 1;
                    return (
                      <g key={i}>
                        {/* Outer ring */}
                        <circle cx={p.x} cy={p.y} r="5" fill={ACCENT} fillOpacity="0.15" />
                        {/* Inner dot */}
                        <circle cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke={ACCENT} strokeWidth="2" />
                        {showLabel && (
                          <text
                            x={p.x}
                            y={lineChartData.height - lineChartData.paddingBottom + 16}
                            fontSize="8"
                            fill="#64748b"
                            textAnchor="middle"
                            fontWeight="600"
                          >
                            {p.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <EmptyState
                  icon={<BarChart3 className="w-8 h-8 text-slate-300" />}
                  title="Belum ada data grafik"
                />
              )}
            </div>
          </Card>

          {/* Grafik 2: Menu Paling Laris */}
          <Card padding="lg" className="flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-4 h-4 text-accent-500" />
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">
                5 Menu Terlaris
              </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center min-h-[180px]">
              {bestSellers.length > 0 ? (
                <div className="space-y-4 pr-1">
                  {bestSellers.map((item, idx) => {
                    const maxQty = Math.max(...bestSellers.map(b => b.qty), 1);
                    const pct = (item.qty / maxQty) * 100;

                    /* Rank badge color — #1 pakai orange, lainnya netral */
                    const rankColor = idx === 0
                      ? 'text-accent-500 dark:text-accent-400'
                      : 'text-slate-400';

                    return (
                      <div key={idx} className="space-y-1.5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-200">
                          <span className="flex items-center gap-2.5 truncate pr-4 font-medium">
                            <span className={`w-4 font-black shrink-0 ${rankColor}`}>
                              {idx + 1}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white shrink-0">
                            {item.qty} Porsi
                          </span>
                        </div>

                        {/* Bar — accent-500 mengikuti aksen design system */}
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out bg-accent-500 dark:bg-accent-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Package className="w-8 h-8 text-slate-300" />}
                  title="Belum ada data menu terlaris"
                />
              )}
            </div>
          </Card>

        </div>

        {/* ── RIWAYAT TRANSAKSI ────────────────────────────────────────────── */}
        <Card padding="none" className="overflow-hidden flex flex-col mb-6">
          {/* Section header */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">
              Riwayat Transaksi Penjualan
            </h3>
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800/50 max-h-[220px] overflow-y-auto custom-scrollbar">
            {filteredSales.length > 0 ? filteredSales.map((order) => (
              <div
                key={order.id}
                className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-in fade-in slide-in-from-left-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {order.id}
                      <span className="font-normal text-slate-400"> — {order.customerName}</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(order.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    {formatRupiah(order.total)}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-8">
                <EmptyState size="sm" title="Tidak ada transaksi pada periode ini" />
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default ReportsView;