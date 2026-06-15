import React from "react";
import { Printer } from "lucide-react"; 
import { useAppContext } from "../../../context/AppContext"; 

const PayslipModal = () => {
  const { payslipModal, setPayslipModal, formatRupiah } = useAppContext();
  if (!payslipModal.isOpen || !payslipModal.data) return null;
  const { data, month } = payslipModal;

  const aggAdditions = {};
  const aggDeductions = {};

  data.records.forEach(rec => {
    rec.additions.forEach(a => { aggAdditions[a.category] = (aggAdditions[a.category] || 0) + a.amount; });
    rec.deductions.forEach(d => { aggDeductions[d.category] = (aggDeductions[d.category] || 0) + d.amount; });
  });

  const basicPay = data.totalHours * data.employee.hourlyRate;
  const printPayslip = () => window.print();

  const monthLabel = new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black backdrop-blur-md transition-opacity duration-300 print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          #payslip-content, #payslip-content * { visibility: visible; }
          #payslip-content { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 0; box-shadow: none; font-family: monospace; }
          @page { margin: 0; }
        }
      `}} />

      <div className="bg-white dark:bg-slate-900 rounded-md w-full max-w-[350px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out print:shadow-none print:w-[80mm]" id="payslip-content">
        <div className="p-6 print:p-4">
          <div className="text-center border-b-2 border-dashed border-slate-300 dark:border-slate-600 pb-4 mb-4 print:pb-2 print:mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-1 print:text-lg">SLIP GAJI</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold print:text-black">MAMAM AYAM</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 print:mt-1 print:text-black">Periode: {monthLabel}</p>
          </div>

          <div className="mb-4 text-xs space-y-1.5 print:mb-3 print:text-black">
            <div className="flex justify-between"><span>Nama:</span> <span className="font-bold">{data.employee.name}</span></div>
            <div className="flex justify-between"><span>Posisi/Rate:</span> <span className="font-bold">{formatRupiah(data.employee.hourlyRate)}/Jam</span></div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 dark:border-slate-600 pt-3 pb-3 print:text-black text-xs">
            <h3 className="font-bold mb-2 uppercase text-[10px]">PENGHASILAN</h3>
            <div className="flex justify-between mb-1">
              <span>Gaji Pokok ({data.totalHours} Jam)</span>
              <span>{formatRupiah(basicPay)}</span>
            </div>
            {Object.entries(aggAdditions).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between mb-1">
                <span>+ {cat}</span> <span>{formatRupiah(amt)}</span>
              </div>
            ))}
          </div>

          {Object.keys(aggDeductions).length > 0 && (
            <div className="border-t-2 border-dashed border-slate-300 dark:border-slate-600 pt-3 pb-3 print:text-black text-xs">
              <h3 className="font-bold mb-2 uppercase text-[10px]">POTONGAN</h3>
              {Object.entries(aggDeductions).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between mb-1 text-red-500 dark:text-red-400 print:text-black">
                  <span>- {cat}</span> <span>{formatRupiah(amt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t-2 border-solid border-slate-800 dark:border-slate-100 pt-3 mt-1 print:border-black text-sm">
            <div className="flex justify-between font-black uppercase">
              <span>TOTAL DITERIMA</span> <span>{formatRupiah(data.netPay)}</span>
            </div>
          </div>

          <div className="text-center mt-10 text-[10px] text-slate-500 dark:text-slate-400 print:mt-8 print:text-black">
            <p>Penerima,</p>
            <br /><br /><br />
            <p className="font-bold underline">({data.employee.name})</p>
          </div>
        </div>

        <div className="absolute -bottom-16 left-0 right-0 flex gap-2 print:hidden">
          <button onClick={printPayslip} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" /> Cetak/Kirim
          </button>
          <button onClick={() => setPayslipModal({ isOpen: false, data: null })} className="flex-1 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayslipModal;