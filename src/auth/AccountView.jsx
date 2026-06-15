import React from 'react'
import { UserCog } from 'lucide-react'

const AccountView = () => {
    return (
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col items-center justify-center h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 text-center max-w-md w-full">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserCog className="w-10 h-10" />
                </div>
                <h2 className="font-heading text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">Manajemen Akun</h2>
                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-4 mb-6">
                    <p className="text-orange-800 dark:text-orange-300 text-sm font-medium leading-relaxed">
                        Fitur Manajemen Akun (Admin & Kasir) belum tersedia pada versi ini.
                    </p>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                    Fitur ini sedang dalam tahap persiapan dan akan segera hadir secara penuh ketika aplikasi terhubung dengan sistem Database (Supabase).
                </p>
            </div>
        </div>
    );
};

export default AccountView;