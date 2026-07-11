import React, { useState, useRef, useEffect } from 'react';
import { Store, ChevronDown, Check } from 'lucide-react';
import { useAuth } from './AuthContext';

/**
 * Dropdown pindah cabang, HANYA muncul untuk role 'owner'.
 * Admin & kasir tidak akan pernah melihat ini — mereka terkunci
 * ke branchId akun masing-masing (ditegakkan lagi nanti oleh RLS Supabase,
 * bukan cuma disembunyikan di UI).
 */
export default function BranchSwitcher() {
  const { role, branches, activeBranchId, switchBranch } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (role !== 'owner') return null;

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all duration-300"
      >
        <Store className="w-4 h-4 text-accent-500 dark:text-accent-400 shrink-0" />
        <span className="truncate max-w-[160px]">{activeBranch?.name ?? 'Pilih Cabang'}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
          <p className="px-3 py-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Pindah Cabang
          </p>
          {branches.map((branch) => {
            const isActive = branch.id === activeBranchId;
            return (
              <button
                key={branch.id}
                onClick={() => {
                  switchBranch(branch.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl text-sm font-medium text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {branch.name}
                {isActive && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}