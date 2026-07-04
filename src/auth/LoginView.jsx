import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Input, Button, Alert } from '../components/ui';

export default function LoginView() {
  const { signIn, signingIn, authError, setAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await signIn(email, password);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-600 dark:bg-accent-500 flex items-center justify-center mb-4 shadow-lg shadow-accent-600/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading font-black text-2xl text-slate-800 dark:text-slate-50 tracking-tight">
            MAMAM AYAM
          </h1>
          <p className="font-body text-sm text-slate-400 dark:text-slate-500 mt-1">
            Masuk untuk melanjutkan ke panel kasir
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              icon={<Mail className="w-4 h-4" />}
              placeholder="nama@mamamayam.com"
              value={email}
              autoComplete="username"
              onChange={(e) => {
                setEmail(e.target.value);
                if (authError) setAuthError(null);
              }}
              required
            />

            <div className="relative">
              <Input
                label="Kata Sandi"
                type={showPassword ? 'text' : 'password'}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Masukkan kata sandi"
                value={password}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authError && <Alert>{authError}</Alert>}

            <Button
              type="submit"
              size="full"
              loading={signingIn}
              disabled={!email || !password}
            >
              {signingIn ? 'Memeriksa...' : 'Masuk'}
            </Button>
          </form>
        </div>

        <p className="text-center font-body text-xs text-slate-300 dark:text-slate-600 mt-6">
          Akses terbatas — 1 akun hanya aktif di 1 perangkat
        </p>

        {/* Dummy account hints — HAPUS blok ini saat Tahap 3 (Supabase asli) */}
        <div className="mt-6 bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Akun uji coba (Tahap 1 — data dummy)
          </p>
          <ul className="space-y-1 font-body text-xs text-slate-500 dark:text-slate-400">
            <li><span className="font-semibold">Owner</span> — owner@mamamayam.com / owner123</li>
            <li><span className="font-semibold">Admin</span> — admin.cikarang@mamamayam.com / admin123</li>
            <li><span className="font-semibold">Kasir</span> — kasir.cikarang@mamamayam.com / kasir123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
