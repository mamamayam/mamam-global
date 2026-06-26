import React, { useState, useEffect } from 'react'; // 💡 Ditambahkan useEffect
import { X, Lock, Key, ShieldAlert } from 'lucide-react';
import Alert from '../components/ui/Alert';

const PinModal = ({ isOpen, onClose, onSuccess, triggerAlert }) => {

  
  // 💡 Konstanta Super Master PIN
  const SUPER_MASTER_PIN = '999999';

  // 💡 State
  const [activePin, setActivePin] = useState('000000');
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState('verify'); // 'verify', 'super', 'reset'

  const resetModalState = () => {
    setPinInput('');
    setErrorMessage('');
    setSuccessMessage('');
    setMode('verify');
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
          <button onClick={handleClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 bg-slate-50 dark:bg-slate-950 rounded-full">
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

        {/* Display PIN (Bulatan) */}
        <div className={`flex gap-3 my-4 justify-center ${(errorMessage || successMessage) ? 'mt-2' : 'mt-4'}`}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${errorMessage
                  ? 'border-red-300 dark:border-red-500/40 bg-accent-50 dark:bg-accent-500/10'
                  : mode === 'reset' && i < pinInput.length
                    ? 'bg-blue-500 dark:bg-blue-600 scale-110 border-blue-500 dark:border-blue-500'
                    : i < pinInput.length ? 'bg-slate-800 scale-110 border-slate-800 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-600'
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
              className="py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors"
            >
              {num}
            </button>
          ))}
          <button onClick={handleClear} className="text-xs font-bold text-accent-500 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-2xl border border-transparent transition-colors">
            Clear
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xl rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors"
          >
            0
          </button>
          <button onClick={handleBackspace} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-2xl border border-transparent transition-colors">
            Del
          </button>
        </div>

        {/* Tombol Konfirmasi */}
        <button
          onClick={handleSubmit}
          disabled={pinInput.length !== 6}
          className={`w-full mt-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${pinInput.length === 6
              ? mode === 'reset'
                ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                : 'bg-slate-800 text-white hover:bg-slate-900'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            }`}
        >
          {mode === 'verify' ? 'Konfirmasi PIN' : mode === 'super' ? 'Verifikasi Super PIN' : 'Simpan PIN Baru'}
        </button>

        {/* Tombol Lupa PIN / Batal */}
        <div className="mt-4 text-center w-full">
          {mode === 'verify' ? (
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