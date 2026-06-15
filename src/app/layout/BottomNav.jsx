import React from "react";
import { Home, ShoppingCart, Settings } from "lucide-react";

export default function BottomNav({
    currentView,
    setCurrentView,
}) {
    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-around items-center h-16 shrink-0 z-30 print:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <button
                onClick={() => setCurrentView('beranda')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === 'beranda' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-bold">Beranda</span>
            </button>

            <button
                onClick={() => setCurrentView('kasir')}
                className="relative flex flex-col items-center justify-end pb-1 h-12 flex-1 group"
            >
                {/* Lingkaran Besar yang Menonjol ke Atas */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-14 h-14 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center shadow-md border-4 border-white dark:border-slate-900 transition-all duration-200 group-hover:scale-105 active:scale-95 z-10">
                    {/* Ganti dengan Icon Kasir/Keranjang yang kamu gunakan (misal: ShoppingCart atau Store) */}
                    <ShoppingCart className="w-6 h-6 text-white" />
                </div>

                {/* Label Teks tetap di bawah, sejajar dengan menu lainnya */}
                <span className={`text-xs font-semibold ${currentView === 'kasir' ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    Kasir
                </span>
            </button>

            <button
                onClick={() => setCurrentView('pengaturan')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === 'pengaturan' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-bold">Pengaturan</span>
            </button>
        </div>
    );
}