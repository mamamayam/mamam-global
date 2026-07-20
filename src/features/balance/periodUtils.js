// features/balance/periodUtils.js
//
// Helper kecil untuk format label periode "YYYY-MM" ke Bahasa Indonesia.
// Dipakai bersama oleh BalanceSummaryTab.jsx dan BalanceDetailTab.jsx
// supaya format label bulan konsisten di kedua sub-tab.

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// "2026-07" -> "Juli 2026"
export const formatPeriodLabel = (period) => {
  const [y, m] = period.split('-').map(Number);
  return `${BULAN_ID[m - 1]} ${y}`;
};