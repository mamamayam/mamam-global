// --- Realtime Sync Engine (Supabase) ---
//
// Tujuan:
//  - Owner & Kasir bisa pakai 2 device berbeda, datanya sinkron otomatis & realtime.
//  - TIDAK re-upload seluruh array tiap ada perubahan (boros free tier Supabase).
//    Transaksi (salesHistory, expenses, dll) di-push PER-RECORD (1 baris berubah
//    = 1 upsert kecil). Config (menus, storeSettings, dll) di-push sebagai 1 blob
//    per key tapi hanya saat key itu berubah, dan didebounce.
//  - Tidak pakai Supabase Auth — akses dikontrol PIN modal di app, RLS dibuka publik.
//
// Cara pakai (lihat App.jsx):
//   import { initRealtimeSync } from '../storage/realtimeSync';
//   useEffect(() => {
//     const unsub = initRealtimeSync({
//       onTransactionUpsert: (key, item, fullArray) => { ...merge ke state... },
//       onTransactionDelete: (key, id)   => { ...hapus dari state... },
//       onConfigUpdate:      (key, value)=> { ...replace state... },
//     });
//     return unsub;
//   }, []);

import { getSupabaseClient, getDeviceId, isSupabaseConfigured } from './syncClient';
import { saveData, loadData } from './db';
import { TRANSACTION_KEYS, CONFIG_KEYS } from './syncKeys';

const deviceId = getDeviceId();

// FIX BUG 1 & 2: isInitialPullComplete dipindah ke dalam factory function
// supaya tiap pemanggilan initRealtimeSync punya state sendiri (tidak shared
// antar instance), dan flag BENAR-BENAR diset true di akhir initial pull.

// ── PUSH: kirim 1 record transaksi (insert/update) ─────────────────────────

/**
 * Upsert satu record transaksi ke Supabase.
 * Dipanggil saat 1 item ditambah/diubah di array (BUKAN saat seluruh array berubah).
 *
 * FIX: Terima readyPromise dari luar supaya push tidak pernah kena block
 * akibat flag module-level yang salah.
 */
export async function pushTransactionUpsert(tableKey, item, readyPromise) {
  if (!isSupabaseConfigured() || !item?.id) return;

  // Tunggu initial pull selesai sebelum boleh push (supaya tidak overwrite
  // data Supabase dengan data lokal yang belum ter-merge)
  if (readyPromise) await readyPromise;

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from(tableKey).upsert({
      id: String(item.id),
      payload: item,
      updated_at: new Date().toISOString(),
      updated_by: deviceId,
    }, { onConflict: 'id' });
    if (error) console.warn(`[sync] gagal push ${tableKey}/${item.id}:`, error.message);
  } catch (err) {
    console.warn(`[sync] error push ${tableKey}:`, err.message);
  }
}

/**
 * Hapus satu record transaksi dari Supabase.
 */
export async function pushTransactionDelete(tableKey, id, readyPromise) {
  if (!isSupabaseConfigured() || !id) return;

  if (readyPromise) await readyPromise;

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from(tableKey).delete().eq('id', String(id));
    if (error) console.warn(`[sync] gagal hapus ${tableKey}/${id}:`, error.message);
  } catch (err) {
    console.warn(`[sync] error delete ${tableKey}:`, err.message);
  }
}

// ── PUSH: config (1 blob per key, debounced) ────────────────────────────────
const configPushTimers = {};

/**
 * Upsert config (1 baris per key di tabel app_config). Didebounce 1.5s per key
 * supaya kalau owner ngetik cepat (misal ubah storeSettings berkali-kali),
 * tidak spam request ke Supabase.
 */
export function pushConfig(key, value, readyPromise, delay = 1500) {
  if (!isSupabaseConfigured()) return;
  clearTimeout(configPushTimers[key]);
  configPushTimers[key] = setTimeout(async () => {
    // Tunggu initial pull selesai sebelum push config
    if (readyPromise) await readyPromise;
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) return;
      const { error } = await supabase.from('app_config').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: deviceId,
      }, { onConflict: 'key' });
      if (error) console.warn(`[sync] gagal push config ${key}:`, error.message);
    } catch (err) {
      console.warn(`[sync] error push config ${key}:`, err.message);
    }
  }, delay);
}

// ── DIFF HELPER ──────────────────────────────────────────────────────────
/**
 * Bandingkan array lama vs baru, return { upserts, deletes }.
 * Dipakai usePersistState untuk tahu record mana yang perlu di-push.
 */
export function diffArrays(prevArr, nextArr) {
  const prev = Array.isArray(prevArr) ? prevArr : [];
  const next = Array.isArray(nextArr) ? nextArr : [];

  const prevMap = new Map(prev.map(item => [String(item?.id), item]));
  const nextMap = new Map(next.map(item => [String(item?.id), item]));

  const upserts = [];
  for (const [id, item] of nextMap) {
    const old = prevMap.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
      upserts.push(item);
    }
  }

  const deletes = [];
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) deletes.push(id);
  }

  return { upserts, deletes };
}

// ── PULL & REALTIME SUBSCRIBE ───────────────────────────────────────────────

/**
 * Tarik semua data dari Supabase yang berbeda dari local, merge ke Dexie,
 * lalu subscribe ke perubahan realtime untuk semua tabel transaksi + app_config.
 *
 * FIX UTAMA:
 *  - isInitialPullComplete sekarang per-instance (bukan module-level) → tidak ada
 *    shared state antar pemanggilan (React StrictMode, HMR, dll).
 *  - Flag SELALU diset true setelah initial pull, termasuk saat error per-tabel.
 *  - Expose `syncReadyPromise` supaya push functions bisa await tanpa perlu akses
 *    ke module-level variable.
 *
 * @param {object} callbacks
 * @param {(key:string, item:object|null, fullArray?:array) => void} callbacks.onTransactionUpsert
 *        item === null  => fullArray adalah hasil merge initial pull (replace state)
 *        item !== null  => 1 record baru/berubah dari device lain (realtime)
 * @param {(key:string, id:string) => void}   callbacks.onTransactionDelete
 * @param {(key:string, value:any) => void}   callbacks.onConfigUpdate
 * @returns {{ unsubscribe: () => void, syncReadyPromise: Promise<void> }}
 */
export function initRealtimeSync({ onTransactionUpsert, onTransactionDelete, onConfigUpdate }) {
  // FIX BUG 1: Promise per-instance. Push functions await ini sebelum kirim data.
  let _resolveReady;
  const syncReadyPromise = new Promise(resolve => { _resolveReady = resolve; });

  if (!isSupabaseConfigured()) {
    // Kalau Supabase tidak dikonfigurasi, langsung resolve supaya push tidak nge-hang
    _resolveReady();
    return { unsubscribe: () => { }, syncReadyPromise };
  }

  let channel = null;
  let cancelled = false;

  (async () => {
    let supabase;
    try {
      supabase = await getSupabaseClient();
    } catch (_) {
      supabase = null;
    }

    if (!supabase || cancelled) {
      // Offline / gagal konek → langsung resolve supaya push tidak nge-hang selamanya
      _resolveReady();
      return;
    }

    // 1. Initial pull — ambil semua row dari tiap tabel transaksi, merge ke Dexie
    for (const tableKey of TRANSACTION_KEYS) {
      if (cancelled) break;
      try {
        const { data: rows, error } = await supabase
          .from(tableKey)
          .select('id, payload, updated_at, updated_by');
        if (error) { console.warn(`[sync] initial pull ${tableKey} gagal:`, error.message); continue; }

        const local = await loadData(tableKey, []);
        const localMap = new Map((Array.isArray(local) ? local : []).map(i => [String(i?.id), i]));
        let changed = false;

        for (const row of rows || []) {
          const existing = localMap.get(row.id);
          if (!existing || JSON.stringify(existing) !== JSON.stringify(row.payload)) {
            localMap.set(row.id, row.payload);
            changed = true;
          }
        }

        if (changed) {
          const merged = Array.from(localMap.values());
          await saveData(tableKey, merged);
          onTransactionUpsert?.(tableKey, null, merged);
        }
      } catch (err) {
        console.warn(`[sync] initial pull ${tableKey} error:`, err.message);
      }
    }

    // 2. Initial pull config
    if (!cancelled) {
      try {
        const { data: rows, error } = await supabase
          .from('app_config')
          .select('key, value, updated_at, updated_by')
          .in('key', CONFIG_KEYS);
        if (error) {
          console.warn('[sync] initial pull config gagal:', error.message);
        } else {
          for (const row of rows || []) {
            const local = await loadData(row.key, undefined);
            if (JSON.stringify(local) !== JSON.stringify(row.value)) {
              await saveData(row.key, row.value);
              onConfigUpdate?.(row.key, row.value);
            }
          }
        }
      } catch (err) {
        console.warn('[sync] initial pull config error:', err.message);
      }
    }

    // FIX BUG 2: Resolve SETELAH semua initial pull selesai (atau error)
    // Sebelumnya flag tidak pernah diset true di happy path → semua push ke-block
    _resolveReady();
    console.log('[sync] initial pull selesai ✅ — push diizinkan');

    if (cancelled) return;

    // 3. Realtime subscription
    channel = supabase.channel(`mamam-realtime-sync-${Math.random().toString(36).slice(2)}`);

    for (const tableKey of TRANSACTION_KEYS) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tableKey }, (payload) => {
        const updatedBy = payload.new?.updated_by ?? payload.old?.updated_by;
        if (updatedBy === deviceId) return;

        if (payload.eventType === 'DELETE') {
          const id = payload.old?.id;
          if (id) onTransactionDelete?.(tableKey, id);
        } else {
          const item = payload.new?.payload;
          if (item) onTransactionUpsert?.(tableKey, item);
        }
      });
    }

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload) => {
      const updatedBy = payload.new?.updated_by ?? payload.old?.updated_by;
      if (updatedBy === deviceId) return;
      if (payload.eventType === 'DELETE') return;
      const key = payload.new?.key;
      const value = payload.new?.value;
      if (key && CONFIG_KEYS.includes(key)) onConfigUpdate?.(key, value);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[sync] realtime aktif ✅');
    });
  })();

  return {
    unsubscribe: () => {
      cancelled = true;
      if (channel) {
        getSupabaseClient().then(supabase => supabase?.removeChannel(channel));
      }
    },
    syncReadyPromise,
  };
}