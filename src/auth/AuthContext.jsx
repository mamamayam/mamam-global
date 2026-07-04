import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { mockSignIn, mockSignOut, mockGetSession, getBranchList } from './mockAuth';
import { getDeviceId } from '../storage/syncClient';

// ============================================================================
// AuthContext — TAHAP 1 (pakai mockAuth.js)
// ============================================================================
// Saat Tahap 3 (wiring Supabase) nanti, HANYA import di bagian atas file ini
// yang perlu diganti dari `./mockAuth` ke pemanggilan `supabase.auth.*` +
// query tabel `users`/`branches` yang sebenarnya. Struktur context value
// (user, role, activeBranchId, dst) sengaja dibuat stabil supaya semua
// komponen yang sudah consume useAuth() tidak perlu diubah.
// ============================================================================

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);           // { id, email, name, role, branchId, branchName, pin }
  const [loading, setLoading] = useState(true);      // cek sesi awal saat app dibuka
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  // Owner bisa pindah cabang tanpa re-login — ini "cabang yang sedang dilihat/dikelola"
  const [activeBranchId, setActiveBranchId] = useState(null);

  // Cek sesi yang tersimpan saat pertama kali app dibuka (biar refresh gak logout)
  useEffect(() => {
    (async () => {
      const { user: savedUser } = await mockGetSession();
      if (savedUser) {
        setUser(savedUser);
        // Owner default melihat cabang pertama; admin/kasir terkunci ke branchId sendiri
        setActiveBranchId(
          savedUser.role === 'owner' ? getBranchList()[0]?.id ?? null : savedUser.branchId
        );
      }
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (email, password) => {
    setSigningIn(true);
    setAuthError(null);

    const deviceId = getDeviceId();
    const { user: signedInUser, error } = await mockSignIn(email, password, deviceId);

    if (error) {
      setAuthError(error);
      setSigningIn(false);
      return { success: false, error };
    }

    setUser(signedInUser);
    setActiveBranchId(
      signedInUser.role === 'owner' ? getBranchList()[0]?.id ?? null : signedInUser.branchId
    );
    setSigningIn(false);
    return { success: true, error: null };
  }, []);

  const signOut = useCallback(async () => {
    await mockSignOut();
    setUser(null);
    setActiveBranchId(null);
  }, []);

  // Hanya owner yang boleh pindah cabang aktif
  const switchBranch = useCallback((branchId) => {
    if (user?.role !== 'owner') return;
    setActiveBranchId(branchId);
  }, [user]);

  const value = {
    user,
    role: user?.role ?? null,           // 'owner' | 'admin' | 'kasir' | null
    loading,
    signingIn,
    authError,
    setAuthError,
    isAuthenticated: Boolean(user),
    activeBranchId,
    switchBranch,
    branches: getBranchList(),
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return context;
}
