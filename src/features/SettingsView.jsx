import { useAppContext } from '../context/AppContext';
import { Settings, Printer, Store } from 'lucide-react';

const SettingsView = () => {
  const { storeSettings, setStoreSettings } = useAppContext();
  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-slate-800" /> Pengaturan
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* PRINTER SETTINGS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
             <div className="flex items-center gap-2 border-b pb-2"><Printer className="w-5 h-5 text-slate-700"/> <h3 className="font-heading font-bold text-slate-800">Printer Struk</h3></div>
             <div>
               <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                 <input type="checkbox" className="w-5 h-5 accent-slate-800 cursor-pointer" checked={storeSettings.autoPrint} onChange={e => setStoreSettings({...storeSettings, autoPrint: e.target.checked})} />
                 <div>
                    <p className="font-bold text-sm text-slate-800">Cetak otomatis setelah pembayaran</p>
                 </div>
               </label>
             </div>
             <div>
               <p className="font-bold text-sm text-slate-800 mb-2">Ukuran Kertas Thermal</p>
               <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setStoreSettings({...storeSettings, paperSize: '58mm'})} className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-300 ${storeSettings.paperSize === '58mm' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>58mm</button>
                 <button onClick={() => setStoreSettings({...storeSettings, paperSize: '80mm'})} className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-300 ${storeSettings.paperSize === '80mm' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>80mm</button>
               </div>
             </div>
          </div>

          {/* STORE / TAX SETTINGS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
             <div className="flex items-center gap-2 border-b pb-2"><Store className="w-5 h-5 text-slate-700"/> <h3 className="font-heading font-bold text-slate-800">Pajak & Biaya Tambahan</h3></div>
             <div>
               <label className="block text-sm font-bold text-slate-600 mb-2">Pajak (PB1) / PPN (%)</label>
               <div className="flex items-center border border-slate-200 rounded-xl px-3 bg-slate-50 focus-within:border-slate-800 transition-colors">
                  <input type="number" min="0" max="100" className="w-full py-3 bg-transparent outline-none font-bold text-slate-800" value={storeSettings.taxRate} onChange={e => setStoreSettings({...storeSettings, taxRate: Number(e.target.value) || 0})} />
                  <span className="text-slate-400 font-bold">%</span>
               </div>
               <p className="text-xs text-slate-400 mt-1">Umumnya PB1 di restoran adalah 10%</p>
             </div>

             <div>
               <label className="block text-sm font-bold text-slate-600 mb-2">Service Charge (%)</label>
               <div className="flex items-center border border-slate-200 rounded-xl px-3 bg-slate-50 focus-within:border-slate-800 transition-colors">
                  <input type="number" min="0" max="100" className="w-full py-3 bg-transparent outline-none font-bold text-slate-800" value={storeSettings.serviceCharge} onChange={e => setStoreSettings({...storeSettings, serviceCharge: Number(e.target.value) || 0})} />
                  <span className="text-slate-400 font-bold">%</span>
               </div>
               <p className="text-xs text-slate-400 mt-1">Biaya pelayanan, umumnya 0% sampai 5%</p>
             </div>
          </div>
      </div>
    </div>
  );
};

export default SettingsView;