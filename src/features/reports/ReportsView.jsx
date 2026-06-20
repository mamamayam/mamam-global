import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Award, BarChart3, Calendar, CircleMinus, ChevronRight, History, Package } from 'lucide-react';
import { formatRupiah, toLocalDateString } from '../../utils/formatters';
import { PageHeader, Card, EmptyState, Button, Input } from '../../components/ui';

const ReportsView = () => {
  const { salesHistory, incomes, reportDateRange, setReportDateRange, activePreset } = useAppContext();

  // State Filter
  const [dateFilter, setDateFilter] = useState('semua');

  // State khusus untuk rentang tanggal kustom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filter Tanggal
  const filterTabs = [
    { id: 'semua', label: 'Semua Waktu' },
    { id: 'hari-ini', label: 'Hari Ini' },
    { id: '7-hari', label: '7 Hari' },
    { id: '30-hari', label: '30 Hari' },
    { id: 'bulan-berjalan', label: 'Bulan Ini' },
    { id: 'kustom', label: 'Pilih Tanggal' }
  ];

  // Fungsi mengecek apakah tanggal pesanan masuk dalam rentang filter
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
        return orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear();
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


  // Filter Penjualan
  const filteredSales = useMemo(() => {
    return salesHistory.filter(order => {
      const orderDate = toLocalDateString(order.date);
      return orderDate >= reportDateRange.start && orderDate <= reportDateRange.end;
    });
  }, [salesHistory, reportDateRange]);

  // Filter Pemasukan Lain
  const filteredIncomes = useMemo(() => {
    return incomes.filter(inc => {
      const incDate = toLocalDateString(inc.date);
      return incDate >= reportDateRange.start && incDate <= reportDateRange.end;
    });
  }, [incomes, reportDateRange]);

  const totalRevenue = filteredSales.reduce((sum, order) => sum + order.total, 0);
  const totalHPP = filteredSales.reduce((sum, order) => sum + order.hppTotal, 0);
  const totalOtherIncome = filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0);

  // Total Income digabungkan dengan pemasukan lain
  const totalCombinedIncome = totalRevenue + totalOtherIncome;
  const grossProfit = totalRevenue - totalHPP;

  // --- OLAH DATA GRAFIK 1: Tren Penjualan Harian ---
  const salesByDate = useMemo(() => {
    const salesMap = {};
    filteredSales.forEach(order => {
      const dStr = toLocalDateString(order.date);
      salesMap[dStr] = (salesMap[dStr] || 0) + order.total;
    });
    // Urutkan berdasarkan tanggal kalender secara kronologis
    const sortedEntries = Object.entries(salesMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedEntries.map(([rawDate, total]) => {
      const [y, m, day] = rawDate.split('-').map(Number);
      const d = new Date(y, m - 1, day);
      const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return { date: label, total };
    });
  }, [filteredSales]);

  // --- OLAH DATA GRAFIK 2: Menu Paling Laris (Best Seller) ---
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
      .slice(0, 5); // Ambil top 5 terlaris
  }, [filteredSales]);

  // Hitung poin koordinat tren harian untuk SVG Line Chart
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

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <PageHeader
          title="Dashboard Laporan"
          icon={<BarChart3 className="w-6 h-6 text-green-500 dark:text-green-400" />}
        />
      </div>

      {/* CONTAINER UTAMA FILTER*/}
      <div className="flex-shrink-0 w-full flex flex-col gap-4 mb-6">

        {/* --- KONTROL RENTANG TANGGAL & PRESET --- */}

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

        {/* 2. Input Khusus Tanggal Kustom */}
        {dateFilter === 'kustom' && (
          <Card padding="sm" className="flex items-center gap-3 max-w-fit">
            <Input
              type="date"
              label="Dari Tanggal"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-5 flex-shrink-0" />
            <Input
              type="date"
              label="Sampai Tanggal"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </Card>
        )}

        {/* --- METRIC CARDS --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card padding="lg" className="flex flex-col justify-center transition-all hover:shadow-md">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Total Penjualan</p>
            <h3 className="font-heading text-lg md:text-2xl font-black text-slate-900 dark:text-slate-50">{formatRupiah(totalRevenue)}</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center transition-all hover:shadow-md">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Pemasukan Lain</p>
            <h3 className="font-heading text-lg md:text-2xl font-black text-green-600 dark:text-green-400">{formatRupiah(totalOtherIncome)}</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center transition-all hover:shadow-md bg-gradient-to-br from-orange-50 dark:from-orange-500/40 to-transparent">
            <p className="text-[10px] md:text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider mb-2">Total Pendapatan</p>
            <h3 className="font-heading text-lg md:text-2xl font-black text-orange-600 dark:text-orange-400">{formatRupiah(totalCombinedIncome)}</h3>
          </Card>
          <Card padding="lg" className="flex flex-col justify-center transition-all hover:shadow-md">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Laba Kotor</p>
            <h3 className="font-heading text-lg md:text-2xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(grossProfit)}</h3>
          </Card>
        </div>

        {/* --- RIWAYAT TRANSAKSI --- */}
        <Card padding="none" className="overflow-hidden flex flex-col mb-6">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Riwayat Transaksi
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto custom-scrollbar">
            {filteredSales.map((order, idx) => (
              <div key={order.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors animate-in fade-in slide-in-from-left-2">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{order.id} <span className="font-normal text-slate-500 dark:text-slate-400">- {order.customerName}</span></p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{new Date(order.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 dark:text-slate-50">{formatRupiah(order.total)}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredSales.length === 0 && (
              <EmptyState size="sm" title="Tidak ada transaksi pada periode ini" />
            )}
          </div>
        </Card>

        {/* --- VISUALISASI GRAFIK & ANALISA (Best Seller & Trend) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2 pb-10">

          {/* Grafik 1: Tren Penjualan Harian */}
          <Card padding="lg" className="flex flex-col">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
              <CircleMinus className="w-4 h-4 text-orange-600 dark:text-orange-400" /> Tren Penjualan Harian
            </h3>
            <div className="flex-1 flex items-center justify-center min-h-[180px]">
              {lineChartData ? (
                <svg className="w-full h-full" viewBox={`0 0 ${lineChartData.width} ${lineChartData.height}`} preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ea580c" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
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
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={lineChartData.paddingLeft - 8}
                          y={y + 4}
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {formatRupiah(value).replace(/Rp\s?/, '')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area Gradient */}
                  {lineChartData.areaPath && (
                    <path d={lineChartData.areaPath} fill="url(#areaGrad)" />
                  )}

                  {/* Line Path */}
                  {lineChartData.linePath && (
                    <path d={lineChartData.linePath} fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}

                  {/* Dots and Axis Labels */}
                  {lineChartData.points.map((p, i) => {
                    // Tampilkan label sumbu X secukupnya agar tidak tumpang tindih
                    const shouldShowLabel = lineChartData.points.length <= 7 || i % Math.ceil(lineChartData.points.length / 7) === 0 || i === lineChartData.points.length - 1;
                    return (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="3.5" fill="#ffffff" stroke="#ea580c" strokeWidth="2" />
                        {shouldShowLabel && (
                          <g>
                            <line x1={p.x} y1={lineChartData.height - lineChartData.paddingBottom} x2={p.x} y2={lineChartData.height - lineChartData.paddingBottom + 4} stroke="#94a3b8" strokeWidth="1" />
                            <text
                              x={p.x}
                              y={lineChartData.height - lineChartData.paddingBottom + 16}
                              fontSize="8"
                              fill="#64748b"
                              textAnchor="middle"
                              fontWeight="medium"
                            >
                              {p.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="Belum ada data grafik untuk ditampilkan" />
              )}
            </div>
          </Card>

          {/* Grafik 2: Menu Paling Laris (Best Seller) */}
          <Card padding="lg" className="flex flex-col">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-600 dark:text-orange-400" /> 5 Menu Terlaris (Best Seller)
            </h3>
            <div className="flex-1 flex flex-col justify-center min-h-[180px]">
              {bestSellers.length > 0 ? (
                <div className="space-y-3.5 pr-2">
                  {bestSellers.map((item, idx) => {
                    const maxQty = Math.max(...bestSellers.map(b => b.qty), 1);
                    const pct = (item.qty / maxQty) * 100;
                    return (
                      <div key={idx} className="space-y-1 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span className="flex items-center gap-2 truncate pr-4">
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                              {idx + 1}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="text-orange-600 dark:text-orange-400 shrink-0">{item.qty} Porsi</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 dark:from-orange-600 to-orange-600 dark:to-orange-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={<Package className="w-10 h-10" />} title="Belum ada data menu terlaris pada periode ini" />
              )}
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
};

export default ReportsView;