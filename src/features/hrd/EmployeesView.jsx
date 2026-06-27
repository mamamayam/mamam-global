import React, { useState } from 'react';
import { PageHeader, Button } from '../../components/ui';
import { UserCog } from 'lucide-react';
import PayslipModal from '../hrd/modals/PayslipModal';
import InputDailyTab from './tabs/InputDailyTab';
import ReportsTab from './tabs/ReportsTab';
import ManageEmployeesTab from './tabs/ManageEmployeesTab';

const EmployeesView = () => {
  const [activeTab, setActiveTab] = useState('input');

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <div className="shrink-0 mb-6">
        <PageHeader title="Manajemen Pegawai (HR)" icon={<UserCog className="w-6 h-6" />} className="mb-4" />

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 p-4 overflow-x-auto hide-scrollbar">
          <Button size="md" variant={activeTab === 'input' ? 'primary' : 'secondary'} onClick={() => setActiveTab('input')}>Input Harian</Button>
          <Button size="md" variant={activeTab === 'reports' ? 'primary' : 'secondary'} onClick={() => setActiveTab('reports')}>Rekap Laporan</Button>
          <Button size="md" variant={activeTab === 'manage' ? 'primary' : 'secondary'} onClick={() => setActiveTab('manage')}>Kelola Karyawan</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'input' && <InputDailyTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'manage' && <ManageEmployeesTab />}
      </div>
      
      <PayslipModal />
    </div>
  );
};

export default EmployeesView;