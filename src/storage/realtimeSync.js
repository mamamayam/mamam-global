import { getSupabaseClient, getDeviceId, isSupabaseConfigured } from './syncClient';
import { saveData, loadData } from './db';
import { TRANSACTION_KEYS, CONFIG_KEYS } from './syncKeys';

const deviceId = getDeviceId();

// ── PUSH: kirim 1 record transaksi (insert/update) ─────────────────────────
export async function pushTransactionUpsert(tableKey, item, readyPromise) {
  if (!isSupabaseConfigured() || !item?.id) return;

  if (readyPromise) await readyPromise;

  // FIX: Gunakan updated_at bawaan item jika ada. Jangan selalu buat new Date()
  // Ini mencegah Supabase mengira data lama dari Device 2 adalah data paling baru.
  const itemUpdatedAt = item.updated_at || new Date().toISOString();

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from(tableKey).upsert({
      id: String(item.id),
      payload: item,
      updated_at: itemUpdatedAt,
      updated_by: deviceId,
    }, { onConflict: 'id' });
    if (error) console.warn(`[sync] gagal push ${tableKey}/${item.id}:`, error.message);
  } catch (err) {
    console.warn(`[sync] error push ${tableKey}:`, err.message);
  }
}

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

export function pushConfig(key, value, readyPromise, delay = 1500) {
  if (!isSupabaseConfigured()) return;
  clearTimeout(configPushTimers[key]);
  
  configPushTimers[key] = setTimeout(async () => {
    if (readyPromise) await readyPromise;

    // FIX: Cek apakah value (jika object) punya updated_at sendiri
    const configUpdatedAt = (value && typeof value === 'object' && value.updated_at)
      ? value.updated_at 
      : new Date().toISOString();

    try {
      const supabase = await getSupabaseClient();
      if (!supabase) return;
      const { error } = await supabase.from('app_config').upsert({
        key,
        value,
        updated_at: configUpdatedAt,
        updated_by: deviceId,
      }, { onConflict: 'key' });
      if (error) console.warn(`[sync] gagal push config ${key}:`, error.message);
    } catch (err) {
      console.warn(`[sync] error push config ${key}:`, err.message);
    }
  }, delay);
}

// ── DIFF HELPER ──────────────────────────────────────────────────────────
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

// ── AUTO SYNC BERKALA (setiap 30 menit) ─────────────────────────────────────
// Jaring pengaman tambahan di atas push real-time per-record di atas: secara
// berkala bandingkan data lokal dengan snapshot hasil sync terakhir, lalu HANYA
// kirim yang benar-benar berubah (pakai diffArrays + fungsi push yang sama
// seperti di atas) — BUKAN re-upload seluruh data tiap kali. Tujuannya supaya
// sync tidak "sekaligus" membebani & menghabiskan kuota Supabase free tier
// walau data sudah menumpuk ribuan baris. Berguna juga utk menangkap
// perubahan yang gagal terkirim sebelumnya (misal device sempat offline saat
// ada transaksi baru).
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 menit
const AUTO_SYNC_ITEM_GAP_MS = 250;            // jeda antar item yang dikirim, biar tidak sekaligus
const AUTO_SYNC_SNAPSHOT_KEY = 'mamam_auto_sync_snapshot';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function loadAutoSyncSnapshot() {
  try {
    const raw = localStorage.getItem(AUTO_SYNC_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveAutoSyncSnapshot(snapshot) {
  try {
    localStorage.setItem(AUTO_SYNC_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[sync] gagal simpan snapshot auto-sync:', err.message);
  }
}

let autoSyncInFlight = false;

/**
 * Dipanggil otomatis tiap 30 menit oleh initRealtimeSync di bawah.
 * Bandingkan data lokal vs snapshot terakhir per key, kirim satu-satu HANYA
 * yang beda (dengan jeda kecil antar item — tidak sekaligus), baru update
 * snapshot setelah selesai.
 */
export async function runAutoSync() {
  if (!isSupabaseConfigured() || autoSyncInFlight) return;
  autoSyncInFlight = true;

  try {
    const snapshot = loadAutoSyncSnapshot();
    let sentCount = 0;

    for (const tableKey of TRANSACTION_KEYS) {
      const current = await loadData(tableKey, []);

      // Key belum pernah punya snapshot (pertama kali fitur ini aktif) →
      // jadikan baseline dulu, jangan kirim apa-apa supaya tidak dobel
      // dengan data yang sudah tersinkron lewat push real-time/manual sync.
      if (!(tableKey in snapshot)) {
        snapshot[tableKey] = current;
        continue;
      }

      const { upserts, deletes } = diffArrays(snapshot[tableKey], current);

      for (const item of upserts) {
        await pushTransactionUpsert(tableKey, item);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }
      for (const id of deletes) {
        await pushTransactionDelete(tableKey, id);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }

      snapshot[tableKey] = current;
    }

    for (const key of CONFIG_KEYS) {
      const current = await loadData(key, undefined);

      if (!(key in snapshot)) {
        snapshot[key] = current;
        continue;
      }

      if (JSON.stringify(current) !== JSON.stringify(snapshot[key])) {
        pushConfig(key, current);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }

      snapshot[key] = current;
    }

    saveAutoSyncSnapshot(snapshot);
    localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
    if (sentCount > 0) console.log(`[sync] auto-sync 30 menit: ${sentCount} perubahan terkirim ✅`);
  } catch (err) {
    console.warn('[sync] auto-sync 30 menit gagal:', err.message);
  } finally {
    autoSyncInFlight = false;
  }
}

// ── PULL & REALTIME SUBSCRIBE ───────────────────────────────────────────────
export function initRealtimeSync({ onTransactionUpsert, onTransactionDelete, onConfigUpdate }) {
  let _resolveReady;
  const syncReadyPromise = new Promise(resolve => { _resolveReady = resolve; });

  if (!isSupabaseConfigured()) {
    _resolveReady();
    return { unsubscribe: () => { }, syncReadyPromise };
  }

  let channel = null;
  let cancelled = false;

  // Auto-sync berkala tiap 30 menit (lihat runAutoSync di atas)
  const autoSyncTimer = setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS);

  (async () => {
    let supabase;
    try {
      supabase = await getSupabaseClient();
    } catch (_) {
      supabase = null;
    }

    if (!supabase || cancelled) {
      _resolveReady();
      return;
    }

    // 1. Initial pull — ambil semua row dari tiap tabel transaksi
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
          // Prioritaskan data Supabase jika beda
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
      clearInterval(autoSyncTimer);
      if (channel) {
        getSupabaseClient().then(supabase => supabase?.removeChannel(channel));
      }
    },
    syncReadyPromise,
  };
}