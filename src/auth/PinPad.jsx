import { useState, useCallback } from 'react';
import { Delete } from 'lucide-react';

/**
 * PinPad — keypad numerik buat input PIN 6 digit.
 *
 * Props:
 *   length      number    — jumlah digit (default: 6)
 *   onComplete  (pin: string) => void  — dipanggil sekali begitu digit ke-N kepencet
 *   error       string    — kalau diisi, dot-dot digemetarin merah + pesan di bawah
 *   disabled    boolean   — dikunci sementara (mis. lagi nunggu response server)
 *
 * PinPad SENGAJA gak nyimpen state "value" ke parent tiap keystroke — cuma
 * manggil onComplete() SEKALI pas udah lengkap. Parent yang mau reset (mis.
 * abis salah) tinggal ganti `key` di elemen ini biar PinPad remount bersih.
 *
 * Animasi "shake" pas error SENGAJA cuma className biasa (bukan state+effect
 * kayak versi awal) -- manfaatin remount dari parent (key={pinAttempt}):
 * tiap kali parent ganti key karena PIN salah, PinPad ini lahir baru dan
 * animasi CSS-nya otomatis muter ulang dari awal, gak perlu state terpisah.
 */
const PinPad = ({ length = 6, onComplete, error, disabled = false }) => {
    const [digits, setDigits] = useState('');

    const press = useCallback((d) => {
        if (disabled) return;
        setDigits(prev => {
            if (prev.length >= length) return prev;
            const next = prev + d;
            if (next.length === length) {
                // Kasih 1 tick biar dot terakhir sempet ke-render terisi
                // sebelum onComplete (yang biasanya langsung trigger request
                // async ke server) jalan.
                setTimeout(() => onComplete?.(next), 80);
            }
            return next;
        });
    }, [disabled, length, onComplete]);

    const backspace = useCallback(() => {
        if (disabled) return;
        setDigits(prev => prev.slice(0, -1));
    }, [disabled]);

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
            <div className={`flex gap-3 ${error ? 'animate-[shake_0.4s]' : ''}`}>
                {Array.from({ length }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150
                            ${i < digits.length
                                ? (error ? 'bg-accent-500 border-accent-500' : 'bg-slate-800 dark:bg-white border-slate-800 dark:border-white')
                                : 'border-slate-300 dark:border-slate-600'}`}
                    />
                ))}
            </div>

            {error && <p className="text-xs text-accent-500 dark:text-accent-400 font-semibold -mt-3">{error}</p>}

            <div className="grid grid-cols-3 gap-3 w-full">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                    <button
                        key={d}
                        type="button"
                        disabled={disabled}
                        onClick={() => press(d)}
                        className="aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xl font-bold active:scale-95 transition-all duration-150 disabled:opacity-40"
                    >
                        {d}
                    </button>
                ))}
                <div />
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => press('0')}
                    className="aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xl font-bold active:scale-95 transition-all duration-150 disabled:opacity-40"
                >
                    0
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={backspace}
                    className="aspect-square rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 active:scale-95 transition-all duration-150 disabled:opacity-40"
                    aria-label="Hapus"
                >
                    <Delete className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default PinPad;
