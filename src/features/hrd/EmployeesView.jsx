import React, { useState } from 'react';
import { PageHeader, Button } from '../../components/ui';
import { UserCog } from 'lucide-react';
import PayslipModal from '../hrd/modals/PayslipModal';
import PerformanceShareModal from './modals/PerformanceShareModal';
import InputDailyTab from './tabs/InputDailyTab';
import ReportsTab from './tabs/ReportsTab';
import ManageEmployeesTab from './tabs/ManageEmployeesTab';

const EmployeesView = () => {
  const [activeTab, setActiveTab] = useState('input');

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <div className="shrink-0 mb-6">
        <PageHeader title="Manajemen Pegawai (HR)" icon={<UserCog className="w-6 h-6 text-accent-500 dark:text-accent-400" />} className="mb-4" />

        <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-6 overflow-x-auto hide-scrollbar">
          {[
            { key: 'input', label: 'Input Harian' },
            { key: 'reports', label: 'Rekap Laporan' },
            { key: 'manage', label: 'Kelola Karyawan' },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'primary' : 'secondary'}
              onClick={() => setActiveTab(tab.key)}
              className="whitespace-nowrap"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'input' && <InputDailyTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'manage' && <ManageEmployeesTab />}
      </div>
      
      <PayslipModal />
      <PerformanceShareModal />
    </div>
  );
};

export default EmployeesView;