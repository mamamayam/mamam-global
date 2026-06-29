import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalMonthString } from '../../../utils/formatters';
import { Card, Button, Input, EmptyState, SortModal } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly } from '../../../utils/softDelete';
import { PieChart, Printer, Calendar, ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react';
import { KASBON_CATEGORY_KEYWORD, LEMBUR_CATEGORY_KEYWORD, getOvertimeRate, calculateOvertimePay } from '../utils/payrollLogic';

const ReportsTab = () => {
  const { employees, employeeDailyRecords, expenses, setPayslipModal, formatRupiah } = useAppContext();

  const [reportMonth, setReportMonth] = useState(toLocalMonthString());
  const [perfSortKey, setPerfSortKey] = useState('name-asc');
  const [isPerfSortOpen, setIsPerfSortOpen] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState(null);

  const filteredRecordsForReport = useMemo(() => {
    return activeOnly(employeeDailyRecords).filter(r => toLocalMonthString(r.date) === reportMonth);
  }, [employeeDailyRecords, reportMonth]);

  const employeePerformance = useMemo(() => {
    const perf = {};
    filteredRecordsForReport.forEach(rec => {
      if (!perf[rec.employeeId]) {
        const emp = employees.find(e => e.id === rec.employeeId);
        perf[rec.employeeId] = { 
          employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 }, 
          totalHours: 0, 
          totalOvertimeMinutes: 0, 
          totalAdditions: 0, 
          totalDeductions: 0, 
          totalKasbon: 0, 
          netPay: 0, 
          records: [],
          overtimeByDay: [],
        };
      }
      const data = perf[rec.employeeId];
      data.records.push(rec);

      // Bulatkan ke atas per hari dulu (1 desimal), baru diakumulasi ke total bulanan
      // — sama persis seperti perhitungan lembur (akumulasi per hari, bukan per bulan).
      const hoursForDay = Math.ceil((rec.hoursWorked || 0) * 10 - 1e-9) / 10;
      data.totalHours += hoursForDay;
      data.totalOvertimeMinutes += (rec.overtimeMinutes || 0);

      if (rec.overtimeMinutes > 0) {
        data.overtimeByDay.push({ dateStr: rec.dateStr, overtimeMinutes: rec.overtimeMinutes });
      }

      // Mengambil tambahan & potongan manual dari record harian
      // "Bonus Lembur" dikecualikan di sini — nominalnya dihitung ulang di bawah pakai tarif
      // lembur personal karyawan (Manajemen Karyawan), supaya tidak dobel hitung dengan overtimePay.
      data.totalAdditions += (rec.additions || [])
        .filter(a => !(a.category || '').toLowerCase().includes(LEMBUR_CATEGORY_KEYWORD))
        .reduce((sum, a) => sum + a.amount, 0);
      data.totalDeductions += (rec.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    });

    // Hitung nominal lembur per hari dulu (floor per hari, bukan floor total bulanan),
    // baru ditotal — supaya rincian per hari SELALU sama dengan total bulanan (tidak ada selisih).
    Object.values(perf).forEach(data => {
      const overtimeRate = getOvertimeRate(data.employee);

      data.overtimeByDay = data.overtimeByDay
        .sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr))
        .map(d => ({ ...d, pay: calculateOvertimePay(d.overtimeMinutes, overtimeRate) }));

      const nominalLembur = data.overtimeByDay.reduce((sum, d) => sum + d.pay, 0);
      data.overtimeRate = overtimeRate; // Tarif/30 menit, dipakai juga di Payslip
      data.overtimePay = nominalLembur; // Simpan variabel ini untuk dipakai di Payslip

      // Otomatis tambahkan nominal lembur ke dalam Total Tambahan karyawan
      data.totalAdditions += nominalLembur;

      // Hitung total akhir gaji bersih
      const basicPay = data.totalHours * data.employee.hourlyRate;
      data.netPay = basicPay + data.totalAdditions - data.totalDeductions;
    });

    return Object.values(perf);
  }, [filteredRecordsForReport, employees]);

  const totalPayrollExpense = employeePerformance.reduce((sum, p) => sum + p.netPay, 0);

  const sortedEmployeePerformance = applySort(employeePerformance, perfSortKey, {
    name: p => p.employee?.name || '',
    netpay: p => p.netPay || 0,
    hours: p => p.totalHours || 0,
  });

  const perfSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'netpay-desc', label: 'Gaji Bersih Terbesar' },
    { key: 'hours-desc', label: 'Total Jam Terbanyak' },
  ];

  return (
    <div className="space-y-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="flex justify-between items-center">
        <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><PieChart className="w-5 h-5 text-orange-600 dark:text-orange-400" /> Rekap Penggajian</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bulan Laporan:</label>
          <div className="w-40"><Input type="month" variant="muted" value={reportMonth} onChange={e => setReportMonth(e.target.value)} /></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="dark" padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400">Total Expenses Payroll</p>
          <h3 className="font-heading text-2xl font-black text-white">{formatRupiah(totalPayrollExpense)}</h3>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Karyawan Aktif (Bulan Ini)</p>
          <h3 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100">{employeePerformance.length} Orang</h3>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-heading font-bold text-slate-800 text-sm">Performa & Rincian Gaji Karyawan</h3>
          <button type="button" onClick={() => setIsPerfSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-600 border border-slate-200 rounded-lg px-2 py-1.5"><ArrowUpDown className="w-3.5 h-3.5" /> Urutkan</button>
        </div>
        <div className="divide-y divide-slate-100 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Nama Karyawan</th>
                <th className="p-4 text-center">Total Jam</th>
                <th className="p-4 text-center">Lembur</th> {/* Tambahan kolom baru */}
                <th className="p-4 text-right">Tambahan</th>
                <th className="p-4 text-right">Potongan</th>
                <th className="p-4 text-right">Gaji Bersih (Net)</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployeePerformance.length === 0 ? (
                <tr><td colSpan="6"><EmptyState size="sm" icon={<PieChart className="w-8 h-8" />} title="Tidak ada data penggajian pada bulan ini." /></td></tr>
              ) : (
                sortedEmployeePerformance.map(p => (
                  <React.Fragment key={p.employee.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-4"><p className="font-bold text-sm text-slate-800">{p.employee.name}</p></td>
                      <td className="p-4 text-center font-semibold text-slate-700 text-sm">{p.totalHours.toFixed(1).replace('.', ',')}</td>
                      <td className="p-4 text-center font-semibold text-orange-500 text-sm">
                        {p.totalOvertimeMinutes > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedEmpId(expandedEmpId === p.employee.id ? null : p.employee.id)}
                            className="inline-flex items-center gap-1 hover:underline"
                            title="Lihat rincian lembur per hari"
                          >
                            {(p.totalOvertimeMinutes / 60).toFixed(1).replace('.', ',')} Jam
                            <ChevronDown className={`w-3 h-3 transition-transform ${expandedEmpId === p.employee.id ? 'rotate-180' : ''}`} />
                          </button>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600 text-sm">+{formatRupiah(p.totalAdditions)}</td>
                      <td className="p-4 text-right font-bold text-red-500 text-sm">-{formatRupiah(p.totalDeductions)}</td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm">{formatRupiah(p.netPay)}</td>
                      <td className="p-4 text-center">
                        <Button variant="ghost" size="sm" icon={<Printer className="w-3 h-3" />} onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })}>Cetak Slip</Button>
                      </td>
                    </tr>
                    {expandedEmpId === p.employee.id && (
                      <tr className="bg-orange-50/40">
                        <td colSpan="7" className="p-4">
                          <p className="text-xs font-bold text-slate-500 mb-2">Rincian Lembur Harian — {p.employee.name} (Rp{p.overtimeRate.toLocaleString('id-ID')}/30 menit)</p>
                          <div className="flex flex-wrap gap-2">
                            {p.overtimeByDay.map(d => (
                              <span key={d.dateStr} className="text-xs bg-white border border-orange-200 rounded-lg px-2.5 py-1.5">
                                <span className="font-semibold text-slate-700">{d.dateStr}</span>
                                <span className="text-orange-600 font-bold ml-1.5">{(d.overtimeMinutes / 60).toFixed(1).replace('.', ',')} jam</span>
                                <span className="text-slate-400 ml-1.5">({formatRupiah(d.pay)})</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SortModal isOpen={isPerfSortOpen} onClose={() => setIsPerfSortOpen(false)} value={perfSortKey} onChange={setPerfSortKey} options={perfSortOptions} />
    </div>
  );
};

export default ReportsTab;