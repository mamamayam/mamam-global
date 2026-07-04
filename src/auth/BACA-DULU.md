# Tahap 1 — UI Login (Data Dummy)

## Cara pasang

Semua file baru masuk ke folder `src/auth/`. Dua file lain **menggantikan** file yang sudah ada.

```
src/
├── auth/
│   ├── mockAuth.js          ← BARU
│   ├── AuthContext.jsx      ← BARU
│   ├── LoginView.jsx        ← BARU
│   ├── BranchSwitcher.jsx   ← BARU
│   ├── AppGate.jsx          ← BARU
│   ├── AccountView.jsx      ← (biarkan, belum dipakai)
│   └── PinModal.jsx         ← (biarkan, belum diubah)
├── main.jsx                 ← GANTI dengan file ini
└── app/layout/Header.jsx    ← GANTI dengan file ini
```

Copy 5 file baru ke `src/auth/`, lalu timpa `src/main.jsx` dan `src/app/layout/Header.jsx` dengan versi di sini.

**Tidak ada file lain yang perlu diubah.** `App.jsx` yang sudah ada (1062 baris, logic sync Supabase & Dexie kamu) tetap 100% utuh — dia sekarang cuma dirender setelah login berhasil.

## Cara jalanin & coba

```bash
npm run dev
```

Kamu akan lihat layar login dengan 3 akun uji coba (ditampilkan langsung di layar login, di kotak putus-putus paling bawah — nanti dihapus di Tahap 3):

| Role | Email | Password |
|---|---|---|
| Owner | owner@mamamayam.com | owner123 |
| Admin | admin.cikarang@mamamayam.com | admin123 |
| Kasir | kasir.cikarang@mamamayam.com | kasir123 |

**Yang bisa kamu coba:**
- Login sebagai **Owner** → lihat dropdown "Pindah Cabang" muncul di header kanan atas
- Login sebagai **Admin** atau **Kasir** → dropdown cabang otomatis hilang (mereka terkunci ke 1 cabang)
- Klik avatar di kanan atas → lihat nama, email, tombol **Keluar**
- Logout lalu login lagi dengan akun **yang sama** → tetap bisa (device sama)
- Buka console browser, jalankan `localStorage.removeItem('mamam_device_id')`, refresh, lalu coba login dengan email yang **sudah pernah dipakai di "device" sebelumnya** → akan lihat pesan device lock (karena sekarang dianggap device baru)
- Refresh halaman setelah login → tetap login (sesi tersimpan)

## Apa yang BELUM jalan (sengaja, karena masih dummy)

- Data di `mockAuth.js` reset setiap kali app di-reload penuh dalam mode dev tertentu, tidak permanen antar restart
- Sidebar & filter menu (`visibleMenus`) **belum** disambungkan ke role — masih pakai `isAdminMode` + PIN modal yang lama, apa adanya
- PIN kasir di `PinModal.jsx` masih hardcoded `999999`/`000000`, belum ditarik dari akun kasir yang login
- Belum ada filter data per-cabang — Owner pindah cabang di UI, tapi data yang tampil di `kasir`, `laporan`, dll masih data yang sama (karena Supabase belum punya kolom `branch_id`)

## Kenapa aku sengaja bikin lapisan `AppGate` terpisah, bukan edit `App.jsx` langsung

`App.jsx` kamu sudah punya logic sync yang kompleks dan sudah teruji (echo-suppression, syncReadyPromise, dsb). Menyisipkan auth di tengah-tengah itu berisiko bikin bug halus di sync. Jadi `AppGate` berdiri **di luar** `App.jsx` — dia cuma memutuskan kapan `<App />` boleh dirender sama sekali. `App.jsx` tidak tahu-menahu soal auth di tahap ini.

## Lanjut ke Tahap 2

Tahap berikutnya (kalau kamu siap): desain schema Supabase — tabel `branches`, `users` dengan role & `branch_id`, kolom `branch_id` di semua tabel transaksi/config yang sudah ada, dan RLS yang benar-benar menegakkan pembatasan ini di level database (bukan cuma UI). Ini bagian paling penting secara keamanan, karena UI cuma "menyembunyikan" — RLS yang benar-benar "mengunci".
