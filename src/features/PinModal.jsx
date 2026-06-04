import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';

const PinModal = ({ isOpen, onClose, onSuccess, triggerAlert }) => {
  // 🔒 SILAKAN GANTI PIN DEFAULT DI SINI
  const MASTER_PIN = '123456'; 

  const [pinInput, setPinInput] = useState('');

  if (!isOpen) return null;

  const handleNumberClick = (num) => {
    if (pinInput.length < 6) {
      setPinInput(pinInput + num);
    }
  };

  const handleBackspace = () => {
    setPinInput(pinInput.slice(0, -1));
  };

  const handleClear = () => {
    setPinInput('');
  };

  const handleSubmit = () => {
    if (pinInput === MASTER_PIN) {
      onSuccess();
      setPinInput('');
      onClose();
    } else {
      triggerAlert('PIN Salah! Akses ditolak.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-250 flex flex-col items-center">
        
        {/* Header Modal */}
        <div className="w-full flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Lock className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Otorisasi Admin</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display PIN (Bulatan Rahasia) */}
        <div className="flex gap-3 my-4 justify-center">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full border-2 border-slate-300 transition-all ${
                i < pinInput.length ? 'bg-slate-800 scale-110 border-slate-800' : 'bg-slate-50'
              }`}
            />
          ))}
        </div>

        {/* Numpad / Tombol Angka (Sangat disukai di Android) */}
        <div className="grid grid-cols-3 gap-3 w-full mt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="py-3.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-black text-xl rounded-2xl border border-slate-100 transition-colors"
            >
              {num}
            </button>
          ))}
          <button onClick={handleClear} className="text-xs font-bold text-red-500 hover:bg-red-50 rounded-2xl border border-transparent">
            Clear
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="py-3.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-black text-xl rounded-2xl border border-slate-100 transition-colors"
          >
            0
          </button>
          <button onClick={handleBackspace} className="text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-2xl border border-transparent">
            Del
          </button>
        </div>

        {/* Tombol Konfirmasi */}
        <button
          onClick={handleSubmit}
          disabled={pinInput.length !== 6}
          className={`w-full mt-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
            pinInput.length === 6 
              ? 'bg-slate-800 text-white hover:bg-slate-900' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          Konfirmasi PIN
        </button>

      </div>
    </div>
  );
};

export default PinModal;