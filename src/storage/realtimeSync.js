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
let isInitialPullComplete = false;

// ── PUSH: kirim 1 record transaksi (insert/update) ─────────────────────────
/**
 * Upsert satu record transaksi ke Supabase.
 * Dipanggil saat 1 item ditambah/diubah di array (BUKAN saat seluruh array berubah).
 */
export async function pushTransactionUpsert(tableKey, item) {
  if (!isSupabaseConfigured() || !item?.id) return;

  if (!isInitialPullComplete) {
    console.log(`[sync] Menahan push ${tableKey} karena initial pull belum selesai`);
    return;
  }

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
export async function pushTransactionDelete(tableKey, id) {
  if (!isSupabaseConfigured() || !id) return;
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
export function pushConfig(key, value, delay = 1500) {
  if (!isSupabaseConfigured()) return;
  if (!isInitialPullComplete) {
    console.log(`[sync] Menahan push config ${key} karena initial pull belum selesai`);
    return;
  }
  clearTimeout(configPushTimers[key]);
  configPushTimers[key] = setTimeout(async () => {
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
 * @param {object} callbacks
 * @param {(key:string, item:object|null, fullArray?:array) => void} callbacks.onTransactionUpsert
 *        item === null  => fullArray adalah hasil merge initial pull (replace state)
 *        item !== null  => 1 record baru/berubah dari device lain (realtime)
 * @param {(key:string, id:string) => void}   callbacks.onTransactionDelete
 * @param {(key:string, value:any) => void}   callbacks.onConfigUpdate
 * @returns {() => void} unsubscribe function
 */
export function initRealtimeSync({ onTransactionUpsert, onTransactionDelete, onConfigUpdate }) {
  if (!isSupabaseConfigured()) return () => { };

  let channel = null;
  let cancelled = false;

  (async () => {
    const supabase = await getSupabaseClient();
    if (!supabase || cancelled) {
      isInitialPullComplete = true; // <--- TAMBAHKAN INI: Fallback buka kunci jika offline/gagal konek
      return;
    }

    // 1. Initial pull — ambil semua row dari tiap tabel transaksi, merge ke Dexie
    //    (gabung berdasarkan id, data Supabase mengisi yang belum ada di local).
    for (const tableKey of TRANSACTION_KEYS) {
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
          onTransactionUpsert?.(tableKey, null, merged); // null item = "replace seluruh array" (initial sync)
        }
      } catch (err) {
        console.warn(`[sync] initial pull ${tableKey} error:`, err.message);
      }
    }

    // 2. Initial pull config
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

    if (cancelled) return;

    // 3. Realtime subscription — semua tabel transaksi + app_config dalam 1 channel
    //    Nama channel unik per pemanggilan supaya tidak konflik kalau ada
    //    lebih dari satu komponen yang subscribe (misal App.jsx & HppView.jsx).
    channel = supabase.channel(`mamam-realtime-sync-${Math.random().toString(36).slice(2)}`);

    for (const tableKey of TRANSACTION_KEYS) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tableKey }, (payload) => {
        // Abaikan event dari device sendiri (sudah diterapkan secara optimis di local)
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

  return () => {
    cancelled = true;
    if (channel) {
      getSupabaseClient().then(supabase => supabase?.removeChannel(channel));
    }
  };
}
