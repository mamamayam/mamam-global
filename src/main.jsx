import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { reloadOnceForFreshChunk } from './utils/chunkReload'

// Jaring pengaman paling awal: Vite sendiri munculin event ini kalau ada
// dynamic import/prefetch chunk yang gagal (biasanya karena ada deploy baru
// sementara tab ini masih pegang bundle lama). Lihat utils/chunkReload.js
// buat penjelasan lengkap & kenapa ini gak bisa dibenerin cuma dengan
// render ulang React.
window.addEventListener('vite:preloadError', reloadOnceForFreshChunk)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)