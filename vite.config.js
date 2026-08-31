import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // FIX "PILIH TANGGAL MALAH RELOAD": 'autoUpdate' bikin SW langsung
      // aktifin versi baru + reload halaman TANPA nanya, begitu terdeteksi
      // ada deploy baru. Deteksinya sering ke-trigger justru pas ada
      // perubahan visibility/focus -- termasuk saat native date-picker
      // (<input type="month">, dll) dibuka lalu ditutup di HP, yang bikin
      // WebView sempat kehilangan & balik fokus. Jadinya reload otomatis
      // itu keliatan seperti "gara-gara milih tanggal", padahal sebenernya
      // "kebetulan ada versi baru nunggu pas visibility berubah".
      // 'prompt' bikin SW nunggu -- UpdatePrompt.jsx (lihat App.jsx) yang
      // nampilin notifikasi kecil, reload cuma jalan kalau user pencet
      // sendiri, gak pernah motong interaksi yang lagi jalan.
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // PENTING: JANGAN tambahin runtimeCaching buat *.supabase.co lagi.
        //
        // Sebelumnya ada entry NetworkFirst (networkTimeoutSeconds: 5) buat
        // semua request ke *.supabase.co. Itu keliatannya aman ("network
        // dulu, cache cuma fallback"), tapi service worker ini AKTIF di
        // build production (vercel.app / APK Capacitor yang load dari
        // vercel.app) dan TIDAK aktif di `vite dev` (localhost) — makanya
        // localhost selalu instant sementara vercel.app & HP (yang cuma
        // bisa load dari vercel.app, lihat capacitor.config) selalu kena
        // delay konsisten beberapa detik: initial pull (REST) & koneksi
        // realtime (WebSocket) ke Supabase ikut kena intersep strategi
        // caching ini, padahal keduanya harus selalu fresh — POS butuh data
        // transaksi real-time, bukan snapshot yang sempat di-cache SW.
        //
        // Kalau suatu saat mau nambah runtime caching lagi buat asset lain
        // (gambar, font, dll), pastikan urlPattern-nya TIDAK match domain
        // *.supabase.co sama sekali.
        runtimeCaching: []
      },
      manifest: {
        name: 'Mamam Global',
        short_name: 'Mamam Global',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: []
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})