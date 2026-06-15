import React from "react";
import { MenuIcon, Clock } from "lucide-react";

export default function Header({
    currentShift,
    currentView,
    today,
    setIsSidebarOpen,
}) {
    return (
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-16 flex items-center justify-between px-4 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0">
            <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg md:hidden text-slate-600 dark:text-slate-300 transition-colors" onClick={() => setIsSidebarOpen(true)}><MenuIcon className="w-6 h-6" /></button>
                <div><h2 className="font-heading font-black text-slate-900 dark:text-slate-50 text-xl tracking-tight capitalize">{currentView.replace('-', ' ')}</h2></div>
            </div>
            <div className="flex items-center gap-3">
                {currentShift && <span className="hidden md:inline-block bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-500/20"><Clock className="w-3 h-3 inline-block mr-1 mb-0.5" /> Dompet Aktif</span>}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-full text-[10px] md:text-xs font-bold border border-slate-200 dark:border-slate-700 whitespace-nowrap">{today}</div>
            </div>
        </header>
    );
}