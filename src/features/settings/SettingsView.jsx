import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  Settings, Store, Save, ReceiptText, MapPin, Phone, Calculator,
  Bluetooth, BluetoothSearching, Unplug, CheckCircle, Sun, Moon, Palette,
  ShieldAlert, ShieldCheck
} from 'lucide-react';
import { Alert, Button } from '../../components/ui';
import { usePrinterStorage }     from '../../hook/usePrinterStorage';
import { useBluetoothPermission } from '../../hook/useBluetoothPermission';

// ====== Daftar pilihan tema warna ======
const COLOR_THEMES = [
  { id: 'orange', label: 'Orange', hex: '#ea580c' },
  { id: 'blue',   label: 'Biru',   hex: '#4f46e5' },
  { id: 'green',  label: 'Hijau',  hex: '#059669' },
  { id: 'violet', label: 'Ungu',   hex: '#7c3aed' },
  { id: 'rose',   label: 'Merah',  hex: '#e11d48' },
  { id: 'teal',   label: 'Teal',   hex: '#0d9488' },
];

// =========================================================================
// KOMPONEN TEXT INPUT
// =========================================================================
const TextInput = ({ label, icon: Icon, placeholder, value, onChange, type = "text", helperText }) => (
  <div>
    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">{label}</label>
    <div className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 focus-within:border-slate-800 dark:focus-within:border-slate-100 focus-within:bg-white dark:focus-within:bg-slate-900 transition-colors">
      {Icon && <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
      {type === "textarea" ? (
        <textarea
          className="w-full py-3 bg-transparent outline-none text-slate-800 dark:text-slate-100 text-sm resize-none"
          placeholder={placeholder}
          value={value || ''}
          rows="2"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="w-full py-3 bg-transparent outline-none text-slate-800 dark:text-slate-100 text-sm"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
    {helperText && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>}
  </div>
);

// =========================================================================
// KOMPONEN UTAMA SETTINGS VIEW
// =========================================================================
const SettingsView = () => {
  const { storeSettings, setStoreSettings, theme, setTheme, colorTheme, setColorTheme } = useAppContext();

  const [localSettings, setLocalSettings] = useState({
    storeName:    '',
    storeAddress: '',
    storePhone:   '',
    receiptFooter: '',
    roundingMode:  'none',
    appName:    'MAMAM AYAM',
    appTagline: 'Ecosystem',
    ...storeSettings
  });
  const [isSaved,        setIsSaved]        = useState(false);
  const [isScanning,     setIsScanning]     = useState(false);
  const [scannedDevices, setScannedDevices] = useState([]);

  // =========================================================================
  // ✅ BLUETOOTH: pakai hooks baru (persistent + permission-aware)
  // =========================================================================
  const { savedPrinter, savePrinter, clearPrinter }   = usePrinterStorage();
  const { btStatus, requestBtPermission, checkBtPermission } = useBluetoothPermission();

  const handleScanBluetooth = () => {
    if (!window.bluetoothSerial) {
      alert("Fitur Bluetooth hanya tersedia jika aplikasi dijalankan di HP (APK).");
      return;
    }
    setIsScanning(true);
    setScannedDevices([]);

    const doScan = () => {
      window.bluetoothSerial.isEnabled(
        () => {
          window.bluetoothSerial.list(
            (devices) => {
              if (devices.length === 0) {
                alert("Tidak ada perangkat Bluetooth yang terdeteksi. Pastikan Printer sudah di-pairing di Pengaturan Android!");
              } else {
                setScannedDevices(devices);
              }
              setIsScanning(false);
            },
            (err) => {
              // Kalau error BLUETOOTH_CONNECT muncul di sini, berarti izin kena revoke
              // saat runtime (misal user cabut manual dari Settings)
              if (err && typeof err === 'string' && err.includes('BLUETOOTH_CONNECT')) {
                checkBtPermission(); // refresh status → banner permission akan muncul
              } else {
                alert(`Gagal scan: ${err}`);
              }
              setIsScanning(false);
            }
          );
        },
        () => {
          alert("Bluetooth HP lu mati. Nyalain dulu bos!");
          setIsScanning(false);
        }
      );
    };

    // requestBtPermission sudah handle Android version check secara internal.
    // Kalau 'granted'/'not_required'/'unknown' → langsung doScan tanpa dialog.
    // Kalau 'denied' → minta izin dulu, baru doScan.
    requestBtPermission(doScan, () => setIsScanning(false));
  };

  const handleConnectPrinter = async (device) => {
    await savePrinter(device);
    setScannedDevices([]);
    alert(`Printer "${device.name}" berhasil diatur sebagai printer utama!`);
  };

  const handleDisconnectPrinter = async () => {
    await clearPrinter();
  };
  // =========================================================================

  const handleNumberChange = (field, value) => {
    if (value === '') {
      setLocalSettings(prev => ({ ...prev, [field]: '' }));
    } else {
      const numValue = Math.min(100, Math.max(0, Number(value)));
      setLocalSettings(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleTextChange = (field, value) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const finalizedSettings = {
      ...localSettings,
      taxRate:       localSettings.taxRate       === '' ? 0 : localSettings.taxRate,
      serviceCharge: localSettings.serviceCharge === '' ? 0 : localSettings.serviceCharge,
    };
    setStoreSettings(finalizedSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // =========================================================================
  // UI HELPER: permission banner
  // =========================================================================
  const BtPermissionBanner = () => {
    if (btStatus !== 'denied') return null;
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Izin Bluetooth Diperlukan</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            Setelah update APK, izin Bluetooth perlu diberikan ulang.
          </p>
        </div>
        <button
          type="button"
          onClick={() => requestBtPermission(() => {}, () => {})}
          className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
        >
          Izinkan
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 max-w-5xl">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent-500 dark:text-accent-400" /> Pengaturan
        </h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-5xl pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ============ KOLOM KIRI ============ */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">

              {/* Profil Aplikasi */}
              <div className="flex items-center gap-2 border-b pb-2">
                <Store className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Profil Aplikasi</h3>
              </div>
              <TextInput
                label="Nama Aplikasi (Sidebar)"
                placeholder="Misal: MAMAM AYAM"
                value={localSettings.appName}
                onChange={(val) => handleTextChange('appName', val)}
                helperText="Nama besar yang tampil di header sidebar kiri."
              />
              <TextInput
                label="Sub-judul Sidebar"
                placeholder="Misal: Ecosystem"
                value={localSettings.appTagline}
                onChange={(val) => handleTextChange('appTagline', val)}
                helperText='Teks kecil di bawah nama, contoh: "POS System", "Manajemen Kasir".'
              />

              {/* Profil Struk */}
              <div className="flex items-center gap-2 border-b pb-2">
                <ReceiptText className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Profil Struk</h3>
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
              <TextInput
                label="Pesan Penutup Struk (Footer)"
                icon={ReceiptText}
                type="textarea"
                placeholder="Misal: Terima kasih atas kunjungannya!"
                value={localSettings.receiptFooter}
                onChange={(val) => handleTextChange('receiptFooter', val)}
              />

              {/* Pajak */}
              <div className="flex items-center gap-2 border-b pb-2">
                <Calculator className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Pajak & Biaya Tambahan</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Pajak PB1 / PPN</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 focus-within:border-slate-800 dark:focus-within:border-slate-100 transition-colors">
                    <input type="number" min="0" max="100" className="w-full py-3 bg-transparent outline-none font-bold text-slate-800 dark:text-slate-100" placeholder="0" value={localSettings.taxRate === 0 ? '' : (localSettings.taxRate ?? '')} onChange={e => handleNumberChange('taxRate', e.target.value)} />
                    <span className="text-slate-400 dark:text-slate-500 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Service Charge</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 focus-within:border-slate-800 dark:focus-within:border-slate-100 transition-colors">
                    <input type="number" min="0" max="100" className="w-full py-3 bg-transparent outline-none font-bold text-slate-800 dark:text-slate-100" placeholder="0" value={localSettings.serviceCharge === 0 ? '' : (localSettings.serviceCharge ?? '')} onChange={e => handleNumberChange('serviceCharge', e.target.value)} />
                    <span className="text-slate-400 dark:text-slate-500 font-bold">%</span>
                  </div>
                </div>
              </div>

              <Button type='submit' variant='primary' size="full">
                <Save className="w-4 h-4" /> Simpan Pengaturan
              </Button>
              <div className={`transition-all duration-300 ${isSaved ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                <Alert type="callout" variant="success" animate={false} className="shadow-sm items-center">
                  Perubahan berhasil disimpan
                </Alert>
              </div>

            </div>
          </div>

          {/* ============ KOLOM KANAN ============ */}
          <div className="space-y-6">

            {/* TAMPILAN (DARK / LIGHT MODE) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                {theme === 'dark'
                  ? <Moon className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                  : <Sun  className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                }
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Tampilan</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                    ${theme === 'light'
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                  <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-accent-500 dark:text-accent-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className={`text-sm font-bold ${theme === 'light' ? 'text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'}`}>Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                    ${theme === 'dark'
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                  <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-accent-500 dark:text-accent-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className={`text-sm font-bold ${theme === 'dark' ? 'text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'}`}>Gelap</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Pengaturan tampilan ini tersimpan di device ini.</p>
            </div>

            {/* TEMA WARNA */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Palette className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Tema Warna</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map(({ id, label, hex }) => {
                  const isActive = colorTheme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setColorTheme(id)}
                      style={{ borderColor: isActive ? hex : undefined }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200
                        ${isActive
                          ? 'bg-slate-50 dark:bg-slate-800 shadow-sm scale-105'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full shadow-md ring-2 ring-white dark:ring-slate-900"
                        style={{ backgroundColor: hex }}
                      />
                      <span className={`text-xs font-bold ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {label}
                      </span>
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tema warna berlaku instan dan tersimpan di device ini.
              </p>
            </div>

            {/* ====================================================
                KONEKSI PRINTER BLUETOOTH
                - Pakai usePrinterStorage  → data survive APK update
                - Pakai useBluetoothPermission → proactive permission check
                ==================================================== */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100">Koneksi Printer Bluetooth</h3>
                </div>
                {/* Status badge permission */}
                {btStatus === 'granted' && (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-bold">Izin OK</span>
                  </div>
                )}
              </div>

              {/* ⚠️ Banner permission — muncul otomatis setelah update APK */}
              <BtPermissionBanner />

              {savedPrinter ? (
                <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{savedPrinter.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{savedPrinter.address}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectPrinter}
                    className="p-2 text-accent-500 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors"
                    title="Putuskan Printer"
                  >
                    <Unplug className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={handleScanBluetooth}
                    disabled={isScanning || btStatus === 'denied'}
                    className="w-full py-3 rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isScanning ? (
                      <><BluetoothSearching className="w-4 h-4 animate-pulse" /> Mencari Perangkat...</>
                    ) : (
                      <><Bluetooth className="w-4 h-4" /> Scan Printer Thermal</>
                    )}
                  </button>

                  {scannedDevices.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Pilih Printer Anda:</p>
                      {scannedDevices.map((device, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleConnectPrinter(device)}
                          className="w-full text-left p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">{device.name || 'Unknown Device'}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{device.address}</p>
                          </div>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Pilih</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pastikan printer sudah menyala dan di-pairing di pengaturan Android HP sebelum melakukan scan.
              </p>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;