import React from "react";
import { MenuIcon, Clock } from "lucide-react";
import NotificationBell from "./NotificationBell";

export default function Header({
    currentShift,
    currentView,
    today,
    setIsSidebarOpen,
    salesHistory,
}) {
    return (
        <header className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-100/60 dark:border-slate-900 h-16 flex items-center justify-between px-4 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none shrink-0">
            <div className="flex items-center gap-3">
                <button
                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-95 rounded-xl md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-300"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <MenuIcon className="w-5 h-5" />
                </button>
                <h2 className="font-heading font-black text-xl tracking-tight capitalize bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    {currentView.replace('-', ' ')}
                </h2>
            </div>
            <div className="flex items-center gap-2.5">
                {currentShift && (
                    <span className="hidden md:inline-flex items-center gap-1.5 bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)]">
                        <Clock className="w-3.5 h-3.5" /> Dompet Aktif
                    </span>
                )}
                <div className="hidden lg:flex items-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-4 py-2 rounded-full text-xs font-bold border border-slate-100 dark:border-slate-800 whitespace-nowrap">
                    {today}
                </div>
                <NotificationBell salesHistory={salesHistory} />
            </div>
        </header>
    );
}