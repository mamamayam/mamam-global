import React from "react";
import { Printer } from "lucide-react"; 
import { useAppContext } from "../../../context/AppContext"; 

const PayslipModal = () => {
  const { payslipModal, setPayslipModal, formatRupiah } = useAppContext();
  if (!payslipModal.isOpen || !payslipModal.data) return null;
  const { data, month } = payslipModal;

  const basicPay = data.totalHours * data.employee.hourlyRate;
  const printPayslip = () => window.print();

  const monthLabel = new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Urutkan records berdasarkan tanggal
  const sortedRecords = [...data.records].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300 print:bg-white print:p-0 overflow-y-auto">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          #payslip-content, #payslip-content * { visibility: visible; }
          #payslip-content { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 210mm; 
            margin: 0; 
            padding: 15mm; 
            box-shadow: none; 
            font-family: 'Inter', system-ui, sans-serif;
            color: black !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}} />

      <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-[800px] shadow-2xl relative font-sans text-sm animate-in zoom-in-95 duration-300 ease-out print:shadow-none print:w-[210mm] print:max-w-none my-8 flex flex-col max-h-[90vh] print:max-h-none print:my-0">
        <div id="payslip-content" className="p-8 print:p-0 overflow-y-auto custom-scrollbar flex-1">
          
          <div className="text-center border-b-2 border-slate-300 dark:border-slate-600 pb-6 mb-6 print:pb-4 print:mb-4">
            <h2 className="text-2xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-2 print:text-black">SLIP GAJI KARYAWAN</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold print:text-black">MAMAM AYAM</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:text-black">Periode: {monthLabel}</p>
          </div>

          <div className="flex justify-between mb-8 text-sm text-slate-700 dark:text-slate-200 print:text-black">
            <div>
              <div className="mb-2"><span className="inline-block w-24 text-slate-500 print:text-gray-600">Nama</span> <span className="font-bold">: {data.employee.name}</span></div>
              <div className="mb-2"><span className="inline-block w-24 text-slate-500 print:text-gray-600">Posisi</span> <span className="font-bold">: Karyawan</span></div>
            </div>
            <div className="text-right">
              <div className="mb-2"><span className="inline-block w-32 text-slate-500 print:text-gray-600">Total Jam Kerja</span> <span className="font-bold">: {data.totalHours} Jam</span></div>
              <div className="mb-2"><span className="inline-block w-32 text-slate-500 print:text-gray-600">Upah per Jam</span> <span className="font-bold">: {formatRupiah(data.employee.hourlyRate)}</span></div>
            </div>
          </div>

          {/* TABEL ARUS KAS HARIAN */}
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 print:text-black border-b border-slate-200 dark:border-slate-700 pb-2">Rincian Pemasukan & Pengeluaran Harian</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700 dark:text-slate-200 print:text-black border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 print:bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 font-bold border border-slate-200 dark:border-slate-700 print:border-gray-300">Tanggal & Jam</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 dark:border-slate-700 print:border-gray-300">Keterangan</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 dark:border-slate-700 print:border-gray-300 text-right">Pemasukan (+)</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 dark:border-slate-700 print:border-gray-300 text-right">Pengeluaran (-)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((rec, i) => {
                    const items = [];
                    // Tambahkan Upah Jam Kerja ke list item
                    if (rec.hoursWorked > 0) {
                      items.push({ desc: `Upah Jam Kerja (${rec.hoursWorked} Jam)`, in: rec.hoursWorked * data.employee.hourlyRate, out: 0 });
                    }
                    // Tambahkan Pemasukan Tambahan
                    rec.additions.forEach(a => items.push({ desc: a.category + (a.note ? ` (${a.note})` : ''), in: a.amount, out: 0 }));
                    // Tambahkan Pengeluaran / Potongan
                    rec.deductions.forEach(d => items.push({ desc: d.category + (d.note ? ` (${d.note})` : ''), in: 0, out: d.amount }));
                    
                    if (items.length === 0) return null;

                    return items.map((item, j) => (
                      <tr key={`${i}-${j}`} className="border-b border-slate-200 dark:border-slate-700 print:border-gray-300">
                        {j === 0 ? (
                          <td className="py-2 px-3 border border-slate-200 dark:border-slate-700 print:border-gray-300 align-top whitespace-nowrap" rowSpan={items.length}>
                            <div className="font-semibold">{rec.dateStr}</div>
                            <div className="text-xs text-slate-500 print:text-gray-600 mt-1">
                              {rec.clockIn || '--:--'} s/d {rec.clockOut || '--:--'}
                            </div>
                          </td>
                        ) : null}
                        <td className="py-2 px-3 border border-slate-200 dark:border-slate-700 print:border-gray-300 align-top">{item.desc}</td>
                        <td className="py-2 px-3 border border-slate-200 dark:border-slate-700 print:border-gray-300 align-top text-right text-green-600 dark:text-green-400 print:text-black">
                          {item.in > 0 ? formatRupiah(item.in) : '-'}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 dark:border-slate-700 print:border-gray-300 align-top text-right text-red-600 dark:text-red-400 print:text-black">
                          {item.out > 0 ? formatRupiah(item.out) : '-'}
                        </td>
                      </tr>
                    ));
                  })}
                  {sortedRecords.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-4 text-center text-slate-500 border border-slate-200 print:border-gray-300">Tidak ada data harian.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end mb-8 print:text-black text-sm text-slate-700 dark:text-slate-200">
            <div className="w-full md:w-1/2">
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700 print:border-gray-300">
                <span>Total Upah Dasar</span>
                <span className="font-bold">{formatRupiah(basicPay)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700 print:border-gray-300">
                <span>Total Tambahan</span>
                <span className="font-bold text-green-600 dark:text-green-400 print:text-black">(+) {formatRupiah(data.totalAdditions)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700 print:border-gray-300">
                <span>Total Potongan</span>
                <span className="font-bold text-red-600 dark:text-red-400 print:text-black">(-) {formatRupiah(data.totalDeductions)}</span>
              </div>
              <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-800 dark:border-slate-100 print:border-black text-base font-black uppercase">
                <span>TOTAL DITERIMA</span>
                <span>{formatRupiah(data.netPay)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-16 text-sm text-center text-slate-800 dark:text-slate-100 print:text-black">
             <div className="w-1/3">
               <p>Penerima,</p>
               <br /><br /><br /><br />
               <p className="font-bold underline">({data.employee.name})</p>
             </div>
             <div className="w-1/3">
               <p>Mengetahui,</p>
               <br /><br /><br /><br />
               <p className="font-bold underline">( HRD / Manajemen )</p>
             </div>
          </div>

        </div>

        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-b-lg border-t border-slate-200 dark:border-slate-700 flex gap-4 print:hidden mt-auto">
          <button onClick={printPayslip} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 flex justify-center items-center gap-2 transition-colors">
            <Printer className="w-5 h-5" /> Cetak PDF / Print
          </button>
          <button onClick={() => setPayslipModal({ isOpen: false, data: null })} className="flex-1 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayslipModal;