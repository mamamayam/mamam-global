import React from "react";
import { Home, ShoppingCart, Settings } from "lucide-react";

export default function BottomNav({
    currentView,
    navigate,
}) {
    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-around items-center h-16 shrink-0 z-30 print:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            
            {/* Tombol Beranda */}
            <button
                onClick={() => navigate('beranda')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    currentView === 'beranda' 
                        ? 'text-accent-600 dark:text-accent-400' 
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-bold">Beranda</span>
            </button>

            {/* Tombol Kasir (Menonjol di Tengah) */}
            <button
                onClick={() => navigate('kasir')}
                className="relative flex flex-col items-center justify-end pb-1 h-12 flex-1 group"
            >
                {/* Lingkaran Besar - Dibuat SELALU menggunakan bg-accent tanpa syarat */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center shadow-md border-4 border-white dark:border-slate-900 transition-all duration-200 group-hover:scale-105 active:scale-95 z-10 bg-accent-600 dark:bg-accent-500">
                    <ShoppingCart className="w-6 h-6 text-white" />
                </div>

                {/* Teks Label Kasir - Ini tetap kondisional agar teksnya meredup saat tidak aktif */}
                <span className={`text-xs font-semibold ${
                    currentView === 'kasir' 
                        ? 'text-accent-600 dark:text-accent-400' 
                        : 'text-slate-600 dark:text-slate-300'
                }`}>
                    Kasir
                </span>
            </button>

            {/* Tombol Pengaturan */}
            <button
                onClick={() => navigate('pengaturan')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    currentView === 'pengaturan' 
                        ? 'text-accent-600 dark:text-accent-400' 
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-bold">Pengaturan</span>
            </button>

        </div>
    );
}