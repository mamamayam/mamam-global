import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * UpdatePrompt — notifikasi kecil "ada versi baru" pas service worker
 * (registerType: 'prompt' di vite.config.js) berhasil download build baru.
 * SENGAJA gak reload otomatis (beda dari registerType lama 'autoUpdate')
 * -- reload cuma kejadian kalau user sendiri yang pencet tombolnya, biar
 * gak motong interaksi yang lagi jalan (lihat komentar panjang di
 * vite.config.js soal kasus "pilih tanggal malah reload").
 */
const UpdatePrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            // Jaring pengaman tambahan: cek update tiap 60 menit selama app
            // kebuka -- 'prompt' gak lagi auto-check se-agresif 'autoUpdate',
            // ini biar device yang dipake lama (kasir sepi, gak pernah
            // switch app) tetap ketawarin update dalam waktu wajar, bukan
            // nunggu sampai app ditutup-buka lagi.
            if (!registration) return;
            setInterval(() => registration.update(), 60 * 60 * 1000);
        },
    });

    if (!needRefresh) return null;

    return (
        <div
            className="fixed left-1/2 -translate-x-1/2 z-[250] animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
            <div className="flex items-center gap-3 text-white text-sm font-semibold pl-5 pr-2 py-2 rounded-full shadow-2xl backdrop-blur-sm border border-white/20 bg-slate-900/95 dark:bg-slate-800/95 whitespace-nowrap">
                <span>Versi baru tersedia</span>
                <button
                    type="button"
                    onClick={() => updateServiceWorker(true)}
                    className="flex items-center gap-1.5 bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-slate-100 active:scale-95 transition-all duration-200"
                >
                    <RefreshCw className="w-3 h-3" />
                    Muat Ulang
                </button>
                <button
                    type="button"
                    onClick={() => setNeedRefresh(false)}
                    className="text-white/60 hover:text-white text-xs px-1"
                    aria-label="Tutup, nanti aja"
                >
                    Nanti
                </button>
            </div>
        </div>
    );
};

export default UpdatePrompt;
