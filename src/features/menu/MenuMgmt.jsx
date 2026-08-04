import React, { useState } from 'react';
import { Button } from '../../components/ui';
import MenuListTab from './tabs/MenuListTab';
import VariantListTab from './tabs/VariantListTab';

// Shell tipis: cuma nampung subtab switcher Menu/Varian (pola sama kayak
// HppView.jsx & BalanceTab.jsx), supaya edit menu & varian gak perlu
// pindah halaman/sidebar terpisah kayak sebelumnya — sekali buka
// "Manajemen Menu", dua-duanya ada di sini tinggal ganti tab.
//
// Isi & logic CRUD sesungguhnya ada di tabs/MenuListTab.jsx dan
// tabs/VariantListTab.jsx — dipindah apa adanya dari MenuMgmt.jsx &
// VariantMgmt.jsx lama, TIDAK ada perubahan logic, cuma lokasi file.
export default function MenuMgmt() {
  const [activeTab, setActiveTab] = useState('menu');

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 pt-4 md:pt-6 pb-3 overflow-x-auto hide-scrollbar shrink-0">
        {[
          { key: 'menu', label: 'Menu' },
          { key: 'varian', label: 'Varian' },
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

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'menu' ? <MenuListTab /> : <VariantListTab />}
      </div>
    </div>
  );
}
