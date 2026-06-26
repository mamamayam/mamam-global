import { getSupabaseClient, getDeviceId, isSupabaseConfigured } from './syncClient';
import { saveData, loadData } from './db';
import { TRANSACTION_KEYS, CONFIG_KEYS, LIVE_STATE_KEYS, APP_CONFIG_KEYS } from './syncKeys';
import { splitExpired } from '../utils/softDelete';

const deviceId = getDeviceId();

// =============================================================================
// MERGE — satu fungsi dipakai di SEMUA tempat yang nerima data dari luar
// (initial pull & realtime), baik buat transaksi maupun config/live-state.
//
// Prinsip: TIDAK PERNAH overwrite mentah-mentah. Yang masuk (remote) selalu
// digabung sama yang sudah ada (local), bukan gantiin total. Tujuannya supaya
// perubahan lokal yang belum sempat ke-push gak ketiban/ke-hapus diam-diam
// sama data lama/lain dari device sebelah.
//
// Aturan gabung tergantung bentuk datanya:
//  - Array berisi object yang punya `id`  → gabung PER ITEM by id (union, gak
//    ada yang ke-drop). Kalau id-nya sama ada di dua sisi, menang yang ada
//    timestamp (`updatedAt`/`updated_at`/`deletedAt`) lebih baru; kalau gak
//    ada timestamp sama sekali, remote dianggap versi paling baru.
//  - Array isinya string/primitif (misal daftar kategori)  → union + dedupe.
//    CATATAN: ini artinya hapus 1 kategori baru bener-bener "nempel" kalau
//    SEMUA device sudah sync. Wajar & cukup buat list kategori — kalau butuh
//    recycle-bin yang ketat juga di sini, list-nya perlu diubah ke bentuk
//    {id, name, deletedAt} kayak data transaksi.
//  - Object biasa (misal storeSettings) → gabung per-field, remote menang
//    kalau field-nya bentrok, TAPI field lokal yang gak ada di remote tetap
//    dipertahankan (gak hilang).
//  - null / primitif / shape beda (misal currentShift pas shift ditutup jadi
//    null) → remote dianggap paling baru, langsung dipakai. Ini BUKAN
//    "overwrite" dalam arti buruk — currentShift itu status tunggal, gak ada
//    konsep "gabung dua shift", jadi yang paling baru yang valid.
// =============================================================================

function isRecordArray(arr) {
  return arr.length === 0 || (arr[0] && typeof arr[0] === 'object' && 'id' in arr[0]);
}

function recordTimestamp(item) {
  const raw = item?.updatedAt || item?.updated_at || item?.deletedAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

function mergeRecordArrays(local, remote) {
  const map = new Map(local.map(item => [String(item.id), item]));
  for (const item of remote) {
    const id = String(item.id);
    const existing = map.get(id);
    if (!existing) { map.set(id, item); continue; }
    const lt = recordTimestamp(existing);
    const rt = recordTimestamp(item);
    map.set(id, (lt !== null && rt !== null) ? (rt >= lt ? item : existing) : item);
  }
  return Array.from(map.values());
}

export function mergeValue(local, remote) {
  if (remote === undefined) return local;
  if (local === undefined) return remote;

  if (Array.isArray(local) && Array.isArray(remote)) {
    if (isRecordArray(local) && isRecordArray(remote)) {
      return mergeRecordArrays(local, remote);
    }
    return Array.from(new Set([...local, ...remote]));
  }

  if (
    local && remote && typeof local === 'object' && typeof remote === 'object' &&
    !Array.isArray(local) && !Array.isArray(remote)
  ) {
    return { ...local, ...remote };
  }

  // primitif, null, atau bentuk lokal/remote beda jenis → remote menang
  return remote;
}

// ── PUSH: kirim 1 record transaksi (insert/update) — INSTAN ────────────────
export async function pushTransactionUpsert(tableKey, item, readyPromise) {
  if (!isSupabaseConfigured() || !item?.id) return;

  if (readyPromise) await readyPromise;

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
    if (error) {
      console.warn(`[sync] gagal push ${tableKey}/${item.id}:`, error.message);
    } else {
      localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('mamam_sync_updated'));
    }
  } catch (err) {
    console.warn(`[sync] error push ${tableKey}:`, err.message);
  }
}

// CATATAN PENTING soal hapus: fungsi ini cuma boleh dipanggil untuk record
// yang BENERAN hilang dari array lokal — dan record cuma boleh hilang dari
// array kalau sudah lewat masa retensi recycle bin (lihat splitExpired di
// utils/softDelete.js + purge di runAutoSync & usePersistState).
// Tombol "Hapus" di UI TIDAK PERNAH manggil ini secara langsung — dia harus
// pakai markDeleted() (set `deletedAt`), bukan filter dari array.
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

// ── PUSH: config (1 blob per key) — MANUAL ONLY ─────────────────────────────
// SENGAJA tidak ada debounce/auto-trigger di sini. Config (menus, customers,
// rawMaterials, dll) HANYA pernah di-push lewat runAutoSync() — yaitu pas user
// pencet "Sync Manual Sekarang" atau pas safety-net jam 21:00. Gak ada jalur
// otomatis tiap state berubah (beda dari versi lama yang debounce 1.5 detik).
//
// Konsekuensi yang perlu lo tau: perubahan config di 1 device BARU kelihatan
// di device lain setelah salah satu dari dua momen itu — bukan realtime kayak
// transaksi/currentShift. Ini sesuai yang lo mau: config gak butuh instan,
// dan ngirit kuota + ngilangin kompleksitas timer/debounce.
export async function pushConfig(key, value, readyPromise) {
  if (!isSupabaseConfigured()) return;
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
}

// ── PUSH: live state tunggal (currentShift, dkk) — INSTAN, tanpa debounce ──
// Tabel & bentuk row SAMA dengan pushConfig (app_config: key/value, value
// boleh null — lihat catatan di supabase_schema.sql). Bedanya cuma satu:
// dipanggil LANGSUNG tiap currentShift berubah, gak nunggu manual sync,
// karena transaksi di bawahnya butuh status ini selalu up-to-date di semua
// device begitu berubah.
export async function pushLiveState(key, value, readyPromise) {
  if (!isSupabaseConfigured()) return;
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
    if (error) console.warn(`[sync] gagal push live-state ${key}:`, error.message);
  } catch (err) {
    console.warn(`[sync] error push live-state ${key}:`, err.message);
  }
}

// ── DIFF HELPER — bandingin 2 array record, hasilnya yang berubah aja ──────
// Dipakai supaya yang dikirim ke Supabase cuma record yang BENERAN berubah,
// bukan re-upload semua isi array.
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

// =============================================================================
// AUTO SYNC (manual & safety-net 21:00)
// Skema push: (1) manual / 21:00 → transaksi (jaring pengaman) + SEMUA config,
//             (2) instant per-transaksi (di luar fungsi ini, lewat usePersistState),
//             (3) instant live-state (di luar fungsi ini).
// =============================================================================
const AUTO_SYNC_ITEM_GAP_MS = 250;
const AUTO_SYNC_SNAPSHOT_KEY = 'mamam_auto_sync_snapshot';
const AUTO_SYNC_ENABLED_KEY = 'mamam_auto_sync_enabled';
const RECYCLE_BIN_RETENTION_DAYS = 30;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function isAutoSyncEnabled() {
  const raw = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
  return raw === null ? true : raw === 'true';
}

export function setAutoSyncEnabled(enabled) {
  localStorage.setItem(AUTO_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}

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

// Purge generik — buang item yang sudah lewat retensi recycle bin dari SATU
// array (asal arraynya berisi object dengan `deletedAt`). Aman dipanggil ke
// array apapun: kalau gak ada item dengan `deletedAt`, hasilnya no-op.
// Dipakai buat TRANSACTION_KEYS sekarang, dan otomatis ready dipakai juga
// buat config-array (menus/customers/dkk) kalau suatu saat itu dikasih
// pola recycle bin yang sama.
async function purgeExpired(key, current) {
  if (!Array.isArray(current)) return current;
  const { keep, expired } = splitExpired(current, RECYCLE_BIN_RETENTION_DAYS);
  if (expired.length === 0) return current;
  await saveData(key, keep);
  return keep;
}

let autoSyncInFlight = false;

export function isSyncInFlight() {
  return autoSyncInFlight;
}

/**
 * Sync diff-based: hanya kirim yang berubah sejak snapshot terakhir.
 * Transaksi: per-record upsert/delete. Config: per-key (push manual only).
 * Live state: safety net (push instan utamanya terjadi di luar fungsi ini).
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false]
 *   false → skip kalau isAutoSyncEnabled() = false, dan skip key tanpa
 *           snapshot (cuma bikin baseline, gak push, biar gak dobel sama push instan).
 *   true  → bypass toggle, dan key tanpa snapshot langsung di-push penuh
 *           sebagai initial upload (dipakai sync manual & safety-net 21:00).
 *
 * @returns {Promise<number>} Jumlah record/config yang berhasil dikirim.
 */
export async function runAutoSync({ force = false } = {}) {
  if ((!isAutoSyncEnabled() && !force) || !isSupabaseConfigured() || autoSyncInFlight) return 0;
  autoSyncInFlight = true;

  try {
    const snapshot = loadAutoSyncSnapshot();
    let sentCount = 0;

    // ── TRANSACTION KEYS — push per-record, hapus permanen HANYA dari purge ─
    for (const tableKey of TRANSACTION_KEYS) {
      let current = await purgeExpired(tableKey, await loadData(tableKey, []));

      if (!(tableKey in snapshot)) {
        if (force && current.length > 0) {
          for (const item of current) {
            await pushTransactionUpsert(tableKey, item);
            sentCount++;
            await sleep(AUTO_SYNC_ITEM_GAP_MS);
          }
        }
        snapshot[tableKey] = current;
        continue;
      }

      const { upserts, deletes } = diffArrays(snapshot[tableKey], current);

      for (const item of upserts) {
        await pushTransactionUpsert(tableKey, item);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }
      // `deletes` di sini cuma muncul dari item yang barusan kena purge di
      // atas (UI gak pernah filter langsung dari array) — jadi delete di
      // Supabase juga otomatis ngikut aturan "hapus cuma dari recycle bin".
      for (const id of deletes) {
        await pushTransactionDelete(tableKey, id);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }

      snapshot[tableKey] = current;
    }

    // ── CONFIG KEYS — push manual-only, per-key, cuma yang berubah ─────────
    for (const key of CONFIG_KEYS) {
      let current = await purgeExpired(key, await loadData(key, undefined));

      if (!(key in snapshot)) {
        if (force && current !== undefined) {
          await pushConfig(key, current);
          sentCount++;
          await sleep(AUTO_SYNC_ITEM_GAP_MS);
        }
        snapshot[key] = current;
        continue;
      }

      if (JSON.stringify(current) !== JSON.stringify(snapshot[key])) {
        await pushConfig(key, current);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }

      snapshot[key] = current;
    }

    // ── LIVE STATE KEYS (currentShift, dkk) — safety net manual & 21:00 ────
    // Push instan (di luar fungsi ini) sudah cover real-time-nya; loop ini
    // cuma jaring pengaman kalau push instan gagal terkirim (device offline dll).
    for (const key of LIVE_STATE_KEYS) {
      const current = await loadData(key, null);

      if (!(key in snapshot)) {
        if (force) {
          await pushLiveState(key, current);
          sentCount++;
          await sleep(AUTO_SYNC_ITEM_GAP_MS);
        }
        snapshot[key] = current;
        continue;
      }

      if (JSON.stringify(current) !== JSON.stringify(snapshot[key])) {
        await pushLiveState(key, current);
        sentCount++;
        await sleep(AUTO_SYNC_ITEM_GAP_MS);
      }

      snapshot[key] = current;
    }

    saveAutoSyncSnapshot(snapshot);
    localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
    window.dispatchEvent(new CustomEvent('mamam_sync_updated'));

    if (sentCount > 0) {
      console.log(`[sync] ${force ? 'manual' : 'auto'}-sync: ${sentCount} perubahan terkirim ✅`);
    } else {
      console.log(`[sync] ${force ? 'manual' : 'auto'}-sync: tidak ada perubahan`);
    }

    return sentCount;
  } catch (err) {
    console.warn(`[sync] ${force ? 'manual' : 'auto'}-sync gagal:`, err.message);
    return 0;
  } finally {
    autoSyncInFlight = false;
  }
}

// =============================================================================
// PULL & REALTIME SUBSCRIBE
// Semua data yang masuk dari luar (initial pull maupun realtime event) WAJIB
// lewat mergeValue() sebelum disimpan — gak ada lagi jalur yang overwrite
// langsung. App.jsx cukup terima hasil yang udah di-merge dan langsung pakai.
// =============================================================================
export function initRealtimeSync({ onTransactionUpsert, onTransactionDelete, onConfigUpdate }) {
  let _resolveReady;
  const syncReadyPromise = new Promise(resolve => { _resolveReady = resolve; });

  if (!isSupabaseConfigured()) {
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
      _resolveReady();
      return;
    }

    // 1. Initial pull — transaksi (merge by id, gak ada yang ke-drop)
    for (const tableKey of TRANSACTION_KEYS) {
      if (cancelled) break;
      try {
        const { data: rows, error } = await supabase
          .from(tableKey)
          .select('id, payload, updated_at, updated_by');
        if (error) { console.warn(`[sync] initial pull ${tableKey} gagal:`, error.message); continue; }

        const local = await loadData(tableKey, []);
        const remoteItems = (rows || []).map(r => r.payload);
        const merged = mergeValue(Array.isArray(local) ? local : [], remoteItems);

        if (JSON.stringify(local) !== JSON.stringify(merged)) {
          await saveData(tableKey, merged);
          onTransactionUpsert?.(tableKey, null, merged);
        }
      } catch (err) {
        console.warn(`[sync] initial pull ${tableKey} error:`, err.message);
      }
    }

    // 2. Initial pull — config & live-state (merge, bukan overwrite)
    if (!cancelled) {
      try {
        const { data: rows, error } = await supabase
          .from('app_config')
          .select('key, value, updated_at, updated_by')
          .in('key', APP_CONFIG_KEYS);
        if (error) {
          console.warn('[sync] initial pull config gagal:', error.message);
        } else {
          for (const row of rows || []) {
            const local = await loadData(row.key, undefined);
            const merged = mergeValue(local, row.value);
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              await saveData(row.key, merged);
              onConfigUpdate?.(row.key, merged);
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
          // Realtime DELETE di Supabase cuma kejadian lewat purge (lihat
          // pushTransactionDelete) — jadi ini aman dianggap "purge dari
          // device lain", bukan hapus instan dari aksi user.
          const id = payload.old?.id;
          if (id) onTransactionDelete?.(tableKey, id);
        } else {
          const item = payload.new?.payload;
          if (item) onTransactionUpsert?.(tableKey, item);
        }
      });
    }

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, async (payload) => {
      const updatedBy = payload.new?.updated_by ?? payload.old?.updated_by;
      if (updatedBy === deviceId) return;
      if (payload.eventType === 'DELETE') return;

      const key = payload.new?.key;
      const remoteValue = payload.new?.value;
      if (!key || !APP_CONFIG_KEYS.includes(key)) return;

      // Merge di sini (bukan di App.jsx) supaya satu-satunya tempat yang
      // nentuin "gimana cara gabung data" ya cuma mergeValue() ini.
      const local = await loadData(key, undefined);
      const merged = mergeValue(local, remoteValue);
      await saveData(key, merged);
      onConfigUpdate?.(key, merged);
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