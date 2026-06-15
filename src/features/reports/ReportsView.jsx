import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Award, BarChart3, CircleMinus, History, Package } from 'lucide-react';
import { useMemo } from 'react';
import { formatRupiah, toLocalDateString } from '../../utils/formatters';

const ReportsView = () => {
  const { salesHistory, incomes, reportDateRange, setReportDateRange, activePreset, applyDatePreset } = useAppContext();

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div><h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard Laporan</h2></div>
      </div>

      {/* --- KONTROL RENTANG TANGGAL & PRESET --- */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {[
            { id: 'hari_ini', label: 'Hari Ini' },
            { id: 'minggu_ini', label: 'Minggu Ini (7H)' },
            { id: 'bulan_ini', label: 'Bulan Ini (30H)' },
            { id: 'bulan_berjalan', label: 'Bulan Berjalan' }
          ].map(preset => (
            <button
              key={preset.id}
              onClick={() => applyDatePreset(preset.id)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${activePreset === preset.id ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Dari:</span>
            <input
              type="date"
              value={reportDateRange.start}
              onChange={(e) => {
                setReportDateRange(prev => ({ ...prev, start: e.target.value }));
                applyDatePreset('custom');
              }}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl outline-none bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-semibold focus:border-orange-500 dark:focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Hingga:</span>
            <input
              type="date"
              value={reportDateRange.end}
              onChange={(e) => {
                setReportDateRange(prev => ({ ...prev, end: e.target.value }));
                applyDatePreset('custom');
              }}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl outline-none bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-semibold focus:border-orange-500 dark:focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>
        </div>
      </div>
      
      {/* --- METRIC CARDS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-all hover:shadow-md">
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Total Penjualan</p>
          <h3 className="font-heading text-lg md:text-2xl font-black text-slate-900 dark:text-slate-50">{formatRupiah(totalRevenue)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-all hover:shadow-md">
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Pemasukan Lain</p>
          <h3 className="font-heading text-lg md:text-2xl font-black text-green-600 dark:text-green-400">{formatRupiah(totalOtherIncome)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-all hover:shadow-md bg-gradient-to-br from-orange-50 dark:from-orange-500/40 to-transparent">
          <p className="text-[10px] md:text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider mb-2">Total Pendapatan</p>
          <h3 className="font-heading text-lg md:text-2xl font-black text-orange-600 dark:text-orange-400">{formatRupiah(totalCombinedIncome)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-all hover:shadow-md">
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Laba Kotor</p>
          <h3 className="font-heading text-lg md:text-2xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(grossProfit)}</h3>
        </div>
      </div>

      {/* --- RIWAYAT TRANSAKSI --- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col mb-6">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950"><h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm"><History className="w-4 h-4 text-slate-500 dark:text-slate-400"/> Riwayat Transaksi</h3></div>
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
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">Tidak ada transaksi pada periode ini</div>
          )}
        </div>
      </div>

      {/* --- VISUALISASI GRAFIK & ANALISA (Best Seller & Trend) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2 pb-10">
        
        {/* Grafik 1: Tren Penjualan Harian */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col">
          <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
            <CircleMinus className="w-4 h-4 text-orange-600 dark:text-orange-400" /> Tren Penjualan Harian
          </h3>
          <div className="flex-1 flex items-center justify-center min-h-[180px]">
            {lineChartData ? (
              <svg className="w-full h-full" viewBox={`0 0 ${lineChartData.width} ${lineChartData.height}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.00"/>
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
              <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                <BarChart3 className="w-10 h-10 opacity-30 mb-2" />
                <p>Belum ada data grafik untuk ditampilkan</p>
              </div>
            )}
          </div>
        </div>

        {/* Grafik 2: Menu Paling Laris (Best Seller) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col">
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
              <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                <Package className="w-10 h-10 opacity-30 mb-2" />
                <p>Belum ada data menu terlaris pada periode ini</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default ReportsView;