import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalMonthString } from '../../../utils/formatters';
import { Card, Button, Input, EmptyState, SortModal } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { activeOnly } from '../../../utils/softDelete';
import { PieChart, Printer, Calendar, ChevronRight, ArrowUpDown } from 'lucide-react';
import { KASBON_CATEGORY_KEYWORD } from '../utils/payrollLogic';

const ReportsTab = () => {
  const { employees, employeeDailyRecords, expenses, setPayslipModal, formatRupiah } = useAppContext();

  const [reportMonth, setReportMonth] = useState(toLocalMonthString());
  const [perfSortKey, setPerfSortKey] = useState('name-asc');
  const [isPerfSortOpen, setIsPerfSortOpen] = useState(false);

  const filteredRecordsForReport = useMemo(() => {
    return activeOnly(employeeDailyRecords).filter(r => toLocalMonthString(r.date) === reportMonth);
  }, [employeeDailyRecords, reportMonth]);

  const employeePerformance = useMemo(() => {
    const perf = {};
    filteredRecordsForReport.forEach(rec => {
      if (!perf[rec.employeeId]) {
        const emp = employees.find(e => e.id === rec.employeeId);
        perf[rec.employeeId] = { employee: emp || { name: 'Karyawan Dihapus', hourlyRate: 0 }, totalHours: 0, totalAdditions: 0, totalDeductions: 0, totalKasbon: 0, netPay: 0, records: [] };
      }
      const data = perf[rec.employeeId];
      data.records.push(rec);
      data.totalHours += rec.hoursWorked;

      const addSum = rec.additions.reduce((sum, a) => sum + a.amount, 0);
      const dedSum = rec.deductions.filter(d => !d.category?.toLowerCase().includes(KASBON_CATEGORY_KEYWORD)).reduce((sum, d) => sum + d.amount, 0);

      data.totalAdditions += addSum;
      data.totalDeductions += dedSum;
    });

    activeOnly(expenses ?? [])
      .filter(exp => exp.category === 'Kasbon Karyawan' && exp.employeeId && toLocalMonthString(exp.date) === reportMonth)
      .forEach(exp => {
        if (!perf[exp.employeeId]) {
          const emp = employees.find(e => e.id === exp.employeeId);
          if (!emp) return;
          perf[exp.employeeId] = { employee: emp, totalHours: 0, totalAdditions: 0, totalDeductions: 0, totalKasbon: 0, netPay: 0, records: [] };
        }
        perf[exp.employeeId].totalKasbon += exp.amount;
        perf[exp.employeeId].totalDeductions += exp.amount;
      });

    Object.values(perf).forEach(p => {
      p.netPay = (p.totalHours * p.employee.hourlyRate) + p.totalAdditions - p.totalDeductions;
    });

    return Object.values(perf);
  }, [filteredRecordsForReport, employees, expenses, reportMonth]);

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
                <th className="p-4">Nama Karyawan</th><th className="p-4 text-center">Total Jam</th><th className="p-4 text-right">Tambahan</th><th className="p-4 text-right">Potongan</th><th className="p-4 text-right">Gaji Bersih (Net)</th><th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployeePerformance.length === 0 ? (
                <tr><td colSpan="6"><EmptyState size="sm" icon={<PieChart className="w-8 h-8" />} title="Tidak ada data penggajian pada bulan ini." /></td></tr>
              ) : (
                sortedEmployeePerformance.map(p => (
                  <tr key={p.employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4"><p className="font-bold text-sm text-slate-800">{p.employee.name}</p></td>
                    <td className="p-4 text-center font-semibold text-slate-700 text-sm">{p.totalHours}</td>
                    <td className="p-4 text-right font-bold text-green-600 text-sm">+{formatRupiah(p.totalAdditions)}</td>
                    <td className="p-4 text-right font-bold text-red-500 text-sm">-{formatRupiah(p.totalDeductions)}</td>
                    <td className="p-4 text-right font-black text-slate-900 text-sm">{formatRupiah(p.netPay)}</td>
                    <td className="p-4 text-center">
                      <Button variant="ghost" size="sm" icon={<Printer className="w-3 h-3" />} onClick={() => setPayslipModal({ isOpen: true, data: p, month: reportMonth })}>Cetak Slip</Button>
                    </td>
                  </tr>
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