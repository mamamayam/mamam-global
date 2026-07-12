import React, { useState } from 'react';
import { PageHeader } from '../../components/ui';
import { UserCog } from 'lucide-react';
import PayslipModal from '../hrd/modals/PayslipModal';
import InputDailyTab from './tabs/InputDailyTab';
import ReportsTab from './tabs/ReportsTab';
import PerformanceTab from './tabs/PerformanceTab';
import ManageEmployeesTab from './tabs/ManageEmployeesTab';

const EmployeesView = () => {
  const [activeTab, setActiveTab] = useState('input');

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <div className="shrink-0 mb-6">
        <PageHeader title="Manajemen Pegawai (HR)" icon={<UserCog className="w-6 h-6 text-accent-500 dark:text-accent-400" />} className="mb-4" />

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pt-2 pb-5 mb-2 overflow-x-auto hide-scrollbar">
          {[
            { key: 'input', label: 'Input Harian' },
            { key: 'reports', label: 'Penggajian' },
            { key: 'performance', label: 'Kinerja' },
            { key: 'manage', label: 'Kelola Karyawan' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all duration-300 active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white shadow-[0_4px_16px_rgba(var(--color-accent-500),0.35)]'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'input' && <InputDailyTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'performance' && <PerformanceTab />}
        {activeTab === 'manage' && <ManageEmployeesTab />}
      </div>
      
      <PayslipModal />
    </div>
  );
};

export default EmployeesView;