import React, { useState, useEffect } from 'react'; // 💡 Ditambahkan useEffect
import { X, Lock, Key, ShieldAlert, Fingerprint, ShieldCheck } from 'lucide-react';
import Alert from '../components/ui/Alert';
import {
  isBiometricSupported,
  hasBiometricCredential,
  registerBiometric,
  verifyBiometric,
  clearBiometricCredential,
} from './useBiometric';

const PinModal = ({ isOpen, onClose, onSuccess, triggerAlert }) => {

  
  // 💡 Konstanta Super Master PIN
  const SUPER_MASTER_PIN = '999999';

  // 💡 State
  const [activePin, setActivePin] = useState('000000');
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState('verify'); // 'verify', 'super', 'reset'

  // 💡 Fingerprint state
  const MAX_BIO_ATTEMPTS = 3; // setelah gagal sebanyak ini, fallback otomatis ke PIN
  const [bioSupported, setBioSupported] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(hasBiometricCredential());
  const [bioBusy, setBioBusy] = useState(false);
  const [bioOfferAfterPin, setBioOfferAfterPin] = useState(false); // tawarin aktifkan setelah PIN benar
  const [bioFailCount, setBioFailCount] = useState(0);
  const [bioGaveUp, setBioGaveUp] = useState(false); // true kalau sudah fallback ke PIN (manual/otomatis)

  useEffect(() => {
    if (!isOpen) return;
    setBioFailCount(0);
    setBioGaveUp(false);

    isBiometricSupported().then((supported) => {
      setBioSupported(supported);
      const registered = hasBiometricCredential();
      setBioRegistered(registered);

      // 💡 Auto-trigger fingerprint begitu modal dibuka, tanpa perlu diklik
      if (supported && registered) {
        handleBiometricVerify();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const resetModalState = () => {
    setPinInput('');
    setErrorMessage('');
    setSuccessMessage('');
    setMode('verify');
    setBioOfferAfterPin(false);
    setBioFailCount(0);
    setBioGaveUp(false);
  };

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleNumberClick = (num) => {
    if (errorMessage) setErrorMessage('');
    if (successMessage && mode !== 'reset') setSuccessMessage('');

    if (pinInput.length < 6) {
      setPinInput(prev => prev.length < 6 ? prev + num : prev);
    }
  };

  const handleBackspace = () => {
    if (errorMessage) setErrorMessage('');
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMessage('');
    setPinInput('');
  };

  const handleSubmit = () => {
    if (mode === 'verify') {
      if (pinInput === activePin) {
        // Kalau fingerprint didukung tapi belum diaktifkan, tawarin dulu
        // alih-alih langsung nutup modal.
        if (bioSupported && !bioRegistered) {
          setPinInput('');
          setErrorMessage('');
          setSuccessMessage('PIN Benar!');
          setBioOfferAfterPin(true);
          return;
        }
        onSuccess();
        resetModalState();
        onClose();
      } else {
        setErrorMessage('PIN Salah! Silakan coba lagi.');
        setPinInput('');
      }
    } else if (mode === 'super') {
      if (pinInput === SUPER_MASTER_PIN) {
        setMode('reset');
        setPinInput('');
        setErrorMessage('');
        setSuccessMessage('Super PIN Benar! Silakan masukkan PIN baru.');
      } else {
        setErrorMessage('Super Master PIN Salah!');
        setPinInput('');
      }
    } else if (mode === 'reset') {
      setActivePin(pinInput);
      setMode('verify');
      setPinInput('');
      setErrorMessage('');
      setSuccessMessage('PIN berhasil direset! Silakan gunakan PIN baru Anda.');
    }
  };

  // 💡 Verifikasi via fingerprint — dicoba otomatis saat modal dibuka,
  // dan bisa juga dipanggil manual lewat tombol "Coba Lagi".
  const handleBiometricVerify = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    setErrorMessage('');
    const { success, error } = await verifyBiometric();

    // 💡 Modal sudah ditutup sementara sensor masih diproses — jangan sentuh state lagi
    if (!isOpen) return;

    setBioBusy(false);

    if (success) {
      setBioFailCount(0);
      onSuccess();
      resetModalState();
      onClose();
      return;
    }

    setBioFailCount((prev) => {
      const next = prev + 1;
      if (next >= MAX_BIO_ATTEMPTS) {
        // 💡 Sudah gagal berkali-kali → fallback ke PIN, jangan auto-retry lagi
        setBioGaveUp(true);
        setErrorMessage('Fingerprint gagal beberapa kali. Silakan gunakan PIN.');
      } else {
        setErrorMessage(error || 'Verifikasi fingerprint gagal. Coba lagi.');
      }
      return next;
    });
  };

  // 💡 Daftarkan fingerprint (dipanggil setelah PIN benar, atau lewat tombol manual)
  const handleBiometricRegister = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    setErrorMessage('');
    const { success, error } = await registerBiometric();
    setBioBusy(false);

    if (success) {
      setBioRegistered(true);
      setSuccessMessage('Fingerprint berhasil diaktifkan!');
      if (typeof triggerAlert === 'function') {
        triggerAlert('success', 'Fingerprint diaktifkan untuk PIN kasir.');
      }
      // Kalau ini dipicu dari alur "PIN benar dulu", langsung lanjut masuk
      if (bioOfferAfterPin) {
        setTimeout(() => {
          onSuccess();
          resetModalState();
          onClose();
        }, 600);
      }
    } else {
      setErrorMessage(error || 'Gagal mengaktifkan fingerprint.');
      // Kalau lagi di alur setelah-PIN-benar, tetap kasih jalan masuk manual
      if (bioOfferAfterPin) {
        setBioOfferAfterPin(false);
      }
    }
  };

  const handleSkipBiometricOffer = () => {
    setBioOfferAfterPin(false);
    onSuccess();
    resetModalState();
    onClose();
  };

  const handleDisableBiometric = () => {
    clearBiometricCredential();
    setBioRegistered(false);
    setSuccessMessage('Fingerprint dimatikan di device ini.');
  };

  // 💡 Fitur Akses Keyboard Laptop
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      // Abaikan jika fokus sedang berada di elemen input text/textarea lain (jika ada)
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

      if (event.key >= '0' && event.key <= '9') {
        handleNumberClick(event.key);
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (event.key === 'Enter') {
        event.preventDefault(); // 💡 INI KUNCINYA: Cegah browser men-trigger klik pada tombol yang sedang fokus

        if (pinInput.length === 6) {
          handleSubmit();
        }
      } else if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, pinInput, mode, errorMessage, successMessage]);

  // Kondisi render dipindah ke sini agar tidak melanggar aturan Hooks
  if (!isOpen) return null;

  // 💡 Layar auto-verifikasi fingerprint — tampil begitu modal dibuka,
  // sebelum kasir sempat klik apa pun. Numpad PIN baru muncul kalau
  // fingerprint tidak didukung/terdaftar, atau sudah gagal berkali-kali.
  const showBiometricScreen =
    mode === 'verify' && bioSupported && bioRegistered && !bioGaveUp;

  if (showBiometricScreen) {
    return (
      <div className="fixed inset-0 bg-slate-500/30 dark:bg-slate-800/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 animate-in zoom-in-95 duration-250 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Fingerprint className="w-4 h-4 text-accent-500 dark:text-accent-400" />
              <span className="font-bold text-sm">Verifikasi Fingerprint</span>
            </div>
            <button onClick={handleClose} className="text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-90 p-1 bg-slate-50 dark:bg-slate-950 rounded-full transition-all duration-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMessage && (
            <Alert className="w-full mb-2">{errorMessage}</Alert>
          )}

          <div className={`w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center mb-4 ${bioBusy ? 'animate-pulse' : ''}`}>
            <Fingerprint className="w-8 h-8 text-accent-500 dark:text-accent-400" />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6">
            {bioBusy ? 'Tempelkan sidik jari pada sensor...' : 'Menunggu verifikasi sidik jari.'}
          </p>

          {bioFailCount > 0 && (
            <button
              onClick={handleBiometricVerify}
              disabled={bioBusy}
              className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {bioBusy ? 'Menunggu Sensor...' : 'Coba Lagi'}
            </button>
          )}
          <button
            onClick={() => {
              setBioGaveUp(true);
              setErrorMessage('');
            }}
            className="w-full mt-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors"
          >
            Pakai PIN Saja
          </button>
        </div>
      </div>
    );
  }

  // 💡 Layar tawaran aktifkan fingerprint setelah PIN benar
  if (bioOfferAfterPin) {
    return (
      <div className="fixed inset-0 bg-slate-500/30 dark:bg-slate-800/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 animate-in zoom-in-95 duration-250 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Fingerprint className="w-4 h-4 text-accent-500 dark:text-accent-400" />
              <span className="font-bold text-sm">Aktifkan Fingerprint?</span>
            </div>
            <button onClick={handleSkipBiometricOffer} className="text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-90 p-1 bg-slate-50 dark:bg-slate-950 rounded-full transition-all duration-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {successMessage && (
            <Alert variant="success" className="w-full mb-2">{successMessage}</Alert>
          )}
          {errorMessage && (
            <Alert className="w-full mb-2">{errorMessage}</Alert>
          )}

          <div className="w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center mb-4">
            <Fingerprint className="w-8 h-8 text-accent-500 dark:text-accent-400" />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6">
            Lain kali buka kasir, kamu bisa pakai sidik jari langsung tanpa ketik PIN.
          </p>

          <button
            onClick={handleBiometricRegister}
            disabled={bioBusy}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {bioBusy ? 'Menunggu Sensor...' : 'Ya, Aktifkan'}
          </button>
          <button
            onClick={handleSkipBiometricOffer}
            className="w-full mt-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium transition-colors"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    );
  }

  return (
<div className="fixed inset-0 bg-slate-500/30 dark:bg-slate-800/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">      <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 animate-in zoom-in-95 duration-250 flex flex-col items-center">

        {/* Header Modal */}
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            {mode === 'verify' && <Lock className="w-4 h-4 text-accent-500 dark:text-accent-400" />}
            {mode === 'super' && <ShieldAlert className="w-4 h-4 text-accent-500 dark:text-accent-400" />}
            {mode === 'reset' && <Key className="w-4 h-4 text-blue-500 dark:text-blue-400" />}

            <span className="font-bold text-sm">
              {mode === 'verify' ? 'Masukkan PIN' : mode === 'super' ? 'Super Master PIN' : 'Buat PIN Baru'}
            </span>
          </div>
          <button onClick={handleClose} className="text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-90 p-1 bg-slate-50 dark:bg-slate-950 rounded-full transition-all duration-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pesan Error */}
        {errorMessage && (
          <Alert className="mt-2">{errorMessage}</Alert>
        )}

        {/* Pesan Sukses */}
        {successMessage && !errorMessage && (
          <Alert variant="success" className="mt-2">{successMessage}</Alert>
        )}

        {/* 💡 Sudah fallback dari fingerprint ke PIN — kasih jalan balik kalau kasir mau coba lagi */}
        {mode === 'verify' && bioSupported && bioRegistered && bioGaveUp && (
          <button
            onClick={() => {
              setBioGaveUp(false);
              setBioFailCount(0);
              setErrorMessage('');
              handleBiometricVerify();
            }}
            className="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-accent-300 dark:border-accent-500/40 text-accent-600 dark:text-accent-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-[0.98] transition-all duration-200"
          >
            <Fingerprint className="w-4 h-4" />
            Coba Fingerprint Lagi
          </button>
        )}

        {/* Display PIN (Bulatan) */}
        <div className={`flex gap-3 my-4 justify-center ${(errorMessage || successMessage) ? 'mt-2' : 'mt-4'}`}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${errorMessage
                  ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10'
                  : mode === 'reset' && i < pinInput.length
                    ? 'bg-blue-500 dark:bg-blue-600 scale-110 border-blue-500 dark:border-blue-500'
                    : i < pinInput.length ? 'bg-gradient-to-br from-accent-600 to-accent-500 scale-110 border-transparent shadow-[0_2px_8px_rgba(var(--color-accent-500),0.4)]' : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-600'
                }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full mt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 active:bg-slate-200 dark:active:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-all duration-200"
            >
              {num}
            </button>
          ))}
          <button onClick={handleClear} className="text-xs font-bold text-accent-500 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 active:scale-95 rounded-2xl border border-transparent transition-all duration-200">
            Clear
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 active:bg-slate-200 dark:active:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-all duration-200"
          >
            0
          </button>
          <button onClick={handleBackspace} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 active:scale-95 rounded-2xl border border-transparent transition-all duration-200">
            Del
          </button>
        </div>

        {/* Tombol Konfirmasi */}
        <button
          onClick={handleSubmit}
          disabled={pinInput.length !== 6}
          className={`w-full mt-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-[0.98] ${pinInput.length === 6
              ? mode === 'reset'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:-translate-y-0.5'
                : 'bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)] hover:-translate-y-0.5'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            }`}
        >
          {mode === 'verify' ? 'Konfirmasi PIN' : mode === 'super' ? 'Verifikasi Super PIN' : 'Simpan PIN Baru'}
        </button>

        {/* Tombol Lupa PIN / Batal / Kelola Fingerprint */}
        <div className="mt-4 text-center w-full flex flex-col gap-2">
          {mode === 'verify' ? (
            <>
              <button
                onClick={() => {
                  setMode('super');
                  setPinInput('');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium underline underline-offset-2 transition-colors"
              >
                Lupa PIN?
              </button>

              {/* 💡 Tombol manual aktifkan/matikan fingerprint */}
              {bioSupported && !bioRegistered && (
                <button
                  onClick={() => {
                    setSuccessMessage('');
                    setBioOfferAfterPin(false);
                    setErrorMessage('Masukkan PIN yang benar dulu untuk mengaktifkan fingerprint.');
                  }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  <Fingerprint className="w-3 h-3" /> Aktifkan Fingerprint
                </button>
              )}
              {bioSupported && bioRegistered && (
                <button
                  onClick={handleDisableBiometric}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" /> Matikan Fingerprint
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setMode('verify');
                setPinInput('');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium underline underline-offset-2 transition-colors"
            >
              Batal Reset
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default PinModal;