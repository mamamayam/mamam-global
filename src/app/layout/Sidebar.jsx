import React from "react";
import { X } from "lucide-react";


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
    return (
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 shadow-2xl md:shadow-none border-r border-slate-100 dark:border-slate-800 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 bg-orange-600 dark:bg-orange-500 text-white flex items-center justify-between shrink-0">
                <div>
                    <h2 className="font-heading font-black text-xl md:text-2xl tracking-normal md:tracking-wide whitespace-nowrap flex items-center gap-2">
                        MAMAM AYAM
                    </h2>
                    <p className="text-[10px] text-white uppercase tracking-widest mt-1 font-bold">Ecosystem</p>
                </div>
                <button className="md:hidden p-1.5 bg-slate-700 dark:bg-slate-300 rounded-md hover:bg-slate-600 dark:hover:bg-slate-400 transition-colors" onClick={() => setIsSidebarOpen(false)}><X className="w-4 h-4" /></button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {visibleMenus.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setCurrentView(item.id);
                            setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold text-sm ${currentView === item.id
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm translate-x-1'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-slate-800 dark:hover:text-slate-100 hover:translate-x-1'
                            }`}
                    >
                        <item.icon
                            className={`w-5 h-5 transition-colors duration-300 ${currentView === item.id
                                ? 'text-slate-900 dark:text-slate-50'
                                : 'text-slate-400 dark:text-slate-500'
                                }`}
                        />
                        {item.label}
                    </button>
                ))}

                <div className="p-3 border-t">
                    {!isAdminMode ? (
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="w-full bg-orange-600 dark:bg-orange-500 text-white py-3 rounded-xl font-bold"
                        >
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
                            className="w-full bg-red-500 dark:bg-red-600 text-white py-3 rounded-xl font-bold"
                        >
                            Keluar Admin
                        </button>
                    )}
                </div>
            </nav>
        </aside>
    );
}