import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, Printer, Store, Save, ReceiptText, MapPin, Phone, Calculator } from 'lucide-react';

// =========================================================================
// SOLUSI: TextInput DIPINDAH KE SINI (DI LUAR SettingsView)
// =========================================================================
const TextInput = ({ label, icon: Icon, placeholder, value, onChange, type = "text", helperText }) => (
  <div>
    <label className="block text-sm font-bold text-slate-600 mb-2">{label}</label>
    <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 bg-slate-50 focus-within:border-slate-800 focus-within:bg-white transition-colors">
      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      {type === "textarea" ? (
        <textarea
          className="w-full py-3 bg-transparent outline-none text-slate-800 text-sm resize-none"
          placeholder={placeholder}
          value={value || ''}
          rows="2"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="w-full py-3 bg-transparent outline-none text-slate-800 text-sm"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
    {helperText && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
  </div>
);

// =========================================================================
// KOMPONEN UTAMA
// =========================================================================
const SettingsView = () => {
  const { storeSettings, setStoreSettings } = useAppContext();

  // Hold settings in local state so changes don't leak instantly to checkout
  const [localSettings, setLocalSettings] = useState({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    receiptFooter: '',
    roundingMode: 'none', // none, 100, 500
    ...storeSettings
  });
  const [isSaved, setIsSaved] = useState(false);

  // Handle number input changes safely
  const handleNumberChange = (field, value) => {
    if (value === '') {
      setLocalSettings(prev => ({ ...prev, [field]: '' }));
    } else {
      const numValue = Math.min(100, Math.max(0, Number(value)));
      setLocalSettings(prev => ({ ...prev, [field]: numValue }));
    }
  };

  // Handle text input changes
  const handleTextChange = (field, value) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  // Explicit Save Function
  const handleSave = (e) => {
    e.preventDefault();

    // Normalize any accidental blank values to 0 before saving globally
    const finalizedSettings = {
      ...localSettings,
      taxRate: localSettings.taxRate === '' ? 0 : localSettings.taxRate,
      serviceCharge: localSettings.serviceCharge === '' ? 0 : localSettings.serviceCharge,
    };

    setStoreSettings(finalizedSettings);

    // Show quick feedback success state
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 max-w-5xl">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-800" /> Pengaturan
        </h2>

        {/* SUCCESS INDICATOR */}
        <div className={`transition-all duration-300 ${isSaved ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
          <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 flex items-center gap-2 shadow-sm">
            ✓ Perubahan berhasil disimpan
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-5xl pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* KOLOM KIRI */}
          <div className="space-y-6">
            {/* STORE PROFILE SETTINGS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <Store className="w-5 h-5 text-slate-700" />
                <h3 className="font-heading font-bold text-slate-800">Profil Usaha</h3>
              </div>
              
              <TextInput 
                label="Nama Toko" 
                placeholder="Misal: Kedai Kopi Senja" 
                value={localSettings.storeName}
                onChange={(val) => handleTextChange('storeName', val)}
              />
              <TextInput 
                label="Nomor Telepon / WhatsApp" 
                icon={Phone}
                type="tel"
                placeholder="Misal: 081234567890" 
                value={localSettings.storePhone}
                onChange={(val) => handleTextChange('storePhone', val)}
              />
              <TextInput 
                label="Alamat Lengkap" 
                icon={MapPin}
                type="textarea"
                placeholder="Masukkan alamat lengkap toko..." 
                value={localSettings.storeAddress}
                onChange={(val) => handleTextChange('storeAddress', val)}
                helperText="Alamat ini akan dicetak pada bagian atas struk kasir."
              />
            </div>

            {/* TAX & FEES SETTINGS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <Calculator className="w-5 h-5 text-slate-700" />
                <h3 className="font-heading font-bold text-slate-800">Pajak & Biaya Tambahan</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Pajak PB1 / PPN</label>
                  <div className="flex items-center border border-slate-200 rounded-xl px-3 bg-slate-50 focus-within:border-slate-800 transition-colors">
                    <input
                      type="number"
                      min="0" max="100"
                      className="w-full py-3 bg-transparent outline-none font-bold text-slate-800" placeholder="0"
                      value={localSettings.taxRate === 0 ? '' : (localSettings.taxRate ?? '')}
                      onChange={e => handleNumberChange('taxRate', e.target.value)}
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Umumnya 10-11%</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Service Charge</label>
                  <div className="flex items-center border border-slate-200 rounded-xl px-3 bg-slate-50 focus-within:border-slate-800 transition-colors">
                    <input
                      type="number"
                      min="0" max="100"
                      className="w-full py-3 bg-transparent outline-none font-bold text-slate-800" placeholder="0"
                      value={localSettings.serviceCharge === 0 ? '' : (localSettings.serviceCharge ?? '')}
                      onChange={e => handleNumberChange('serviceCharge', e.target.value)}
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Opsional (0-5%)</p>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="space-y-6">
            {/* PRINTER & RECEIPT SETTINGS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-2 border-b pb-2">
                <Printer className="w-5 h-5 text-slate-700" />
                <h3 className="font-heading font-bold text-slate-800">Pengaturan Struk</h3>
              </div>

              <div>
                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-slate-800 cursor-pointer"
                    checked={!!localSettings.autoPrint}
                    onChange={e => setLocalSettings(prev => ({ ...prev, autoPrint: e.target.checked }))}
                  />
                  <div>
                    <p className="font-bold text-sm text-slate-800">Cetak Otomatis</p>
                    <p className="text-xs text-slate-500 mt-0.5">Langsung cetak struk setelah pembayaran berhasil</p>
                  </div>
                </label>
              </div>

              <div>
                <p className="font-bold text-sm text-slate-600 mb-2">Ukuran Kertas Thermal</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, paperSize: '58mm' }))}
                    className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-300 ${localSettings.paperSize === '58mm' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    58mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, paperSize: '80mm' }))}
                    className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-300 ${localSettings.paperSize === '80mm' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    80mm
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <TextInput 
                  label="Pesan Penutup Struk (Footer)" 
                  icon={ReceiptText}
                  type="textarea"
                  placeholder="Misal: Terima kasih atas kunjungannya! Follow IG kami @toko.hebat" 
                  value={localSettings.receiptFooter}
                  onChange={(val) => handleTextChange('receiptFooter', val)}
                  helperText="Tinggalkan pesan hangat untuk pelanggan Anda di bagian bawah struk."
                />
              </div>
            </div>
          </div>
        </div>

        {/* FLOATING ACTION BAR FOR SAVING */}
        <div className="sticky bottom-0 mt-8 py-4 bg-slate-50/80 backdrop-blur-md border-t border-slate-200/60 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-700 hover:-translate-y-0.5 transition-all active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;