import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import LoginView from './LoginView';
import App from '../app/App';

// ============================================================================
// AppGate — pintu masuk sebelum App.jsx
// ============================================================================
// Dipasang di main.jsx menggantikan <App /> langsung. Alurnya:
//
//   main.jsx → <AppGate /> → <AuthProvider> → <AuthGate> → <App />
//
// AuthGate menahan render <App /> (yang isinya seluruh logic sync Supabase,
// Dexie, dsb) SAMPAI user terbukti sudah login. Ini penting supaya:
//   1. Orang yang belum login tidak sempat memicu initial data load sama sekali
//   2. App.jsx yang sudah ada TIDAK PERLU diubah isinya untuk Tahap 1 ini —
//      dia tetap menerima kontrol penuh begitu lolos gate ini.
//
// Filtering menu berdasar role (Owner/Admin/Kasir) & branchId akan disambungkan
// di tahap berikutnya, setelah schema Supabase (branches/users) siap — supaya
// App.jsx bisa menerima `role` dan `activeBranchId` dari useAuth() dan
// menyaring `visibleMenus` serta query data sesuai cabang yang aktif.
// ============================================================================

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <App />;
}

export default function AppGate() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
