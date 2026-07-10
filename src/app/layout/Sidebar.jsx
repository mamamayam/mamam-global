import React from "react";
import { X, ShieldUser, ChevronRight, Sparkles } from "lucide-react";
import Button from '../../components/ui/Button';
import { useAppContext } from '../../context/AppContext';
import appVersion from '../../version.json';

export default function Sidebar({
    currentView,
    setCurrentView,
    isSidebarOpen,
    setIsSidebarOpen,
    visibleMenus,
    isAdminMode,
    setShowPinModal,
    triggerConfirm,
    setIsAdminMode,
}) {
    const { storeSettings } = useAppContext();
    const appName = storeSettings?.appName || 'MAMAM AYAM';
    const appTagline = storeSettings?.appTagline || 'Ecosystem';
    const initial = appName.trim().charAt(0).toUpperCase() || 'M';

    return (
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-[268px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl md:bg-white md:dark:bg-slate-950 border-r border-slate-100/60 dark:border-slate-900 transition-transform duration-400 ease-out flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

            {/* Header: Logo mark + Gradient Text */}
            <div className="pt-7 pb-6 px-6 flex items-start justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 dark:from-accent-400 dark:to-accent-600 flex items-center justify-center shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)]">
                        <span className="font-heading font-black text-lg text-white">{initial}</span>
                        {isAdminMode && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 flex items-center justify-center">
                                <Sparkles className="w-2 h-2 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h2 className="font-heading font-black text-lg leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-accent-600 to-accent-400 dark:from-accent-400 dark:to-accent-500 truncate">
                            {appName}
                        </h2>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-0.5 font-bold">
                            {appTagline}
                        </p>
                    </div>
                </div>
                <button
                    className="md:hidden p-2 -mr-2 -mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors shrink-0"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Admin status strip */}
            {isAdminMode && (
                <div className="mx-4 mb-3 px-3.5 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-2 shrink-0">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tracking-wide">Mode Admin Aktif</span>
                </div>
            )}

            {/* Navigasi Menu: Spasi lega & Indikator Aktif yang Halus */}
            <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto custom-scrollbar">
                {visibleMenus.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id);
                                setIsSidebarOpen(false);
                            }}
                            className={`relative w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-[13px] transition-all duration-300 group overflow-hidden
                                ${isActive
                                    ? 'text-white bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 shadow-[0_4px_16px_rgba(var(--color-accent-500),0.35)]'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50/80 dark:hover:bg-slate-900/50'
                                }`}
                        >
                            <item.icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-110'}`} />
                            <span className="tracking-wide truncate">{item.label}</span>

                            {isActive && (
                                <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 opacity-80" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer: Modern Button & Subtle Versioning */}
            <div className="p-4 pb-6 shrink-0">
                {!isAdminMode ? (
                    <button
                        onClick={() => setShowPinModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-2xl font-semibold text-sm shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300"
                    >
                        <ShieldUser className="w-4 h-4" />
                        Login Admin
                    </button>
                ) : (
                    <button
                        onClick={() =>
                            triggerConfirm(
                                'Yakin ingin keluar dari mode admin?',
                                () => setIsAdminMode(false)
                            )
                        }
                        className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-3 rounded-2xl font-semibold text-sm hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-[0.98] transition-all duration-300"
                    >
                        Keluar Admin
                    </button>
                )}

                <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
                    <p className="text-[9px] text-slate-300 dark:text-slate-700 font-semibold tracking-widest whitespace-nowrap">
                        V{appVersion.version} — {appVersion.updatedAt}
                    </p>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
                </div>
            </div>
        </aside>
    );
}