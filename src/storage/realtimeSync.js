import { getSupabaseClient, getDeviceId, isSupabaseConfigured, withTimeout } from './syncClient';
import { saveData, loadData } from './db';
import { TRANSACTION_KEYS, CONFIG_KEYS, LIVE_STATE_KEYS, APP_CONFIG_KEYS } from './syncKeys';
import { splitExpired } from '../utils/softDelete';

const deviceId = getDeviceId();

// Timeout per network call ke Supabase (upsert/delete/select). 15 detik —
// cukup toleran buat koneksi lambat, tapi gak bikin satu request macet
// nge-block seluruh antrian sync selama-lamanya.
const PUSH_TIMEOUT_MS = 15000;

// Nunggu syncReadyPromise TAPI dengan batas waktu. Kalau initial pull di
// App.jsx entah kenapa gak pernah resolve/reject, mendingan lanjut push
// agak telat drpd stuck permanen nunggu promise yang gak bakal pernah selesai.
async function waitReadyOrTimeout(readyPromise, ms = 20000) {
  if (!readyPromise) return;
  try {
    await withTimeout(readyPromise, ms, 'syncReadyPromise');
  } catch (_) {
    // Lanjut aja — mendingan sync agak telat drpd nge-hang selamanya.
  }
}

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
// Return value: true = beneran kekirim & kesimpen di Supabase, false = gagal
// (error ATAU timeout). Dipakai runAutoSync buat mutusin key ini boleh
// dianggap "sudah sinkron" (snapshot maju) atau harus di-retry run berikutnya.
export async function pushTransactionUpsert(tableKey, item, readyPromise, onFailure) {
  if (!isSupabaseConfigured() || !item?.id) return false;

  await waitReadyOrTimeout(readyPromise);

  const itemUpdatedAt = item.updated_at || new Date().toISOString();

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { error } = await withTimeout(
      supabase.from(tableKey).upsert({
        id: String(item.id),
        payload: item,
        updated_at: itemUpdatedAt,
        updated_by: deviceId,
      }, { onConflict: 'id' }),
      PUSH_TIMEOUT_MS, `upsert ${tableKey}/${item.id}`
    );
    if (error) {
      console.warn(`[sync] gagal push ${tableKey}/${item.id}:`, error.message);
      onFailure?.({ tableKey, id: item.id, message: error.message });
      return false;
    }
    localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
    window.dispatchEvent(new CustomEvent('mamam_sync_updated'));
    // Cegah runAutoSync berikutnya (startup/reconnect/interval) nge-diff-in
    // record ini lagi sebagai "belum sync" dan upsert ulang -> lihat komen
    // panjang di syncSnapshotAfterInstantUpsert soal kasus notif dobel/triple.
    syncSnapshotAfterInstantUpsert(tableKey, item);
    return true;
  } catch (err) {
    console.warn(`[sync] error/timeout push ${tableKey}/${item.id}:`, err.message);
    onFailure?.({ tableKey, id: item.id, message: err.message });
    return false;
  }
}

// CATATAN PENTING soal hapus: fungsi ini cuma boleh dipanggil untuk record
// yang BENERAN hilang dari array lokal — dan record cuma boleh hilang dari
// array kalau sudah lewat masa retensi recycle bin (lihat splitExpired di
// utils/softDelete.js + purge di runAutoSync & usePersistState).
// Tombol "Hapus" di UI TIDAK PERNAH manggil ini secara langsung — dia harus
// pakai markDeleted() (set `deletedAt`), bukan filter dari array.
export async function pushTransactionDelete(tableKey, id, readyPromise) {
  if (!isSupabaseConfigured() || !id) return false;
  await waitReadyOrTimeout(readyPromise);

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { error } = await withTimeout(
      supabase.from(tableKey).delete().eq('id', String(id)),
      PUSH_TIMEOUT_MS, `delete ${tableKey}/${id}`
    );
    if (error) {
      console.warn(`[sync] gagal hapus ${tableKey}/${id}:`, error.message);
      return false;
    }
    syncSnapshotAfterInstantDelete(tableKey, id);
    return true;
  } catch (err) {
    console.warn(`[sync] error/timeout delete ${tableKey}:`, err.message);
    return false;
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
  if (!isSupabaseConfigured()) return false;
  await waitReadyOrTimeout(readyPromise);

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { error } = await withTimeout(
      supabase.from('app_config').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: deviceId,
      }, { onConflict: 'key' }),
      PUSH_TIMEOUT_MS, `config ${key}`
    );
    if (error) {
      console.warn(`[sync] gagal push config ${key}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sync] error/timeout push config ${key}:`, err.message);
    return false;
  }
}

// ── PUSH: live state tunggal (currentShift, dkk) — INSTAN, tanpa debounce ──
// Tabel & bentuk row SAMA dengan pushConfig (app_config: key/value, value
// boleh null — lihat catatan di supabase_schema.sql). Bedanya cuma satu:
// dipanggil LANGSUNG tiap currentShift berubah, gak nunggu manual sync,
// karena transaksi di bawahnya butuh status ini selalu up-to-date di semua
// device begitu berubah.
export async function pushLiveState(key, value, readyPromise) {
  if (!isSupabaseConfigured()) return false;
  await waitReadyOrTimeout(readyPromise);

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { error } = await withTimeout(
      supabase.from('app_config').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: deviceId,
      }, { onConflict: 'key' }),
      PUSH_TIMEOUT_MS, `live-state ${key}`
    );
    if (error) {
      console.warn(`[sync] gagal push live-state ${key}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sync] error/timeout push live-state ${key}:`, err.message);
    return false;
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
// AUTO SYNC (manual, catch-up startup, reconnect, berkala, & flush bg/fg)
// Semua trigger-nya hidup di App.jsx sekarang — lihat catatan di sana.
// Skema push: (1) runAutoSync() [dipanggil manual/startup/reconnect/berkala/
//                 flush] → transaksi (jaring pengaman) + SEMUA config,
//             (2) instant per-transaksi (di luar fungsi ini, lewat usePersistState),
//             (3) instant live-state (di luar fungsi ini).
// =============================================================================
// Dulu: kirim 1-per-1 dengan jeda 250ms SETELAH tiap item (serial murni).
// Untuk 1000+ item beda snapshot, ini gampang jadi berjam-jam (250ms x N,
// belum termasuk waktu network call itu sendiri). Sekarang: kirim per BATCH
// beberapa item sekaligus secara paralel (Promise.all), baru lanjut batch
// berikutnya. Ini motong waktu total kira-kira sebanding BATCH_SIZE kali
// lebih cepat, tanpa mem-bombardir Supabase dengan ratusan request bersamaan.
const AUTO_SYNC_BATCH_SIZE = 8;
const AUTO_SYNC_SNAPSHOT_KEY = 'mamam_auto_sync_snapshot';
const AUTO_SYNC_ENABLED_KEY = 'mamam_auto_sync_enabled';
const RECYCLE_BIN_RETENTION_DAYS = 30;

// Jalankan `items` lewat `worker(item)` per batch paralel, panggil
// `onItemDone(item, ok)` tiap satu item kelar (dipakai buat update progress
// bar per-record real-time, bukan cuma per-batch).
async function runInBatches(items, worker, onItemDone) {
  const results = [];
  for (let i = 0; i < items.length; i += AUTO_SYNC_BATCH_SIZE) {
    const chunk = items.slice(i, i + AUTO_SYNC_BATCH_SIZE);
    const chunkResults = await Promise.all(chunk.map(async (item) => {
      const ok = await worker(item);
      onItemDone?.(item, ok);
      return { item, ok };
    }));
    results.push(...chunkResults);
  }
  return results;
}

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

// FIX DOBEL PUSH/NOTIF: push instan (pushTransactionUpsert/Delete, dipanggil
// dari usePersistState tiap state berubah) sebelumnya TIDAK PERNAH nyentuh
// snapshot auto-sync -- snapshot itu cuma di-update oleh runAutoSync() sendiri.
//
// Akibatnya: kalau runAutoSync (startup catch-up / reconnect / interval 10
// menit) kebetulan jalan gak lama setelah push instan sukses, dia diffArrays()
// pakai snapshot LAMA yang belum tau soal record barusan -> record itu masih
// keliatan "belum sync" -> di-upsert LAGI walau isinya sama persis.
//
// Tiap upsert yang nyampe Supabase = 1 row event baru buat webhook
// notify_new_transaction, jadi 1 transaksi bisa nge-trigger 2-3x kirim FCM
// beruntun (persis kasus notif dobel/triple di HP walau device_tokens cuma 1).
//
// Fix-nya: begitu push instan sukses, langsung sinkronkan entry itu ke
// snapshot juga -- biar runAutoSync berikutnya lihat record ini SUDAH sama
// dengan versi ter-push, dan gak nge-diff-in dia lagi sebagai "baru".
function syncSnapshotAfterInstantUpsert(tableKey, item) {
  try {
    const snapshot = loadAutoSyncSnapshot();
    const current = Array.isArray(snapshot[tableKey]) ? snapshot[tableKey] : [];
    const idx = current.findIndex((it) => String(it.id) === String(item.id));
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.push(item);
    }
    snapshot[tableKey] = current;
    saveAutoSyncSnapshot(snapshot);
  } catch (err) {
    // Non-fatal -- worst case runAutoSync berikutnya re-diff record ini
    // (balik ke behaviour lama), jadi aman untuk fail-silent di sini.
    console.warn('[sync] gagal update snapshot setelah push instan:', err.message);
  }
}

function syncSnapshotAfterInstantDelete(tableKey, id) {
  try {
    const snapshot = loadAutoSyncSnapshot();
    const current = Array.isArray(snapshot[tableKey]) ? snapshot[tableKey] : [];
    const filtered = current.filter((it) => String(it.id) !== String(id));
    if (filtered.length !== current.length) {
      snapshot[tableKey] = filtered;
      saveAutoSyncSnapshot(snapshot);
    }
  } catch (err) {
    console.warn('[sync] gagal update snapshot setelah delete instan:', err.message);
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
 * BULLETPROOFING (lihat juga withTimeout di syncClient.js):
 *  - Tiap key diproses dalam try/catch sendiri — satu key yang error/timeout
 *    gak bikin key-key sesudahnya ikut gagal diproses.
 *  - Snapshot disimpan SETELAH TIAP KEY selesai (bukan cuma sekali di akhir),
 *    jadi kalau internet mati di tengah jalan, progress yang udah kekirim
 *    gak ilang/keulang pas run berikutnya.
 *  - Snapshot HANYA maju kalau push-nya beneran sukses. Kalau gagal, key itu
 *    dibiarin di state lama → run berikutnya bakal ketauan lagi bedanya &
 *    di-retry otomatis, gak diem-diem "dianggap kekirim" padahal enggak.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false]
 *   false → skip kalau isAutoSyncEnabled() = false, dan skip key tanpa
 *           snapshot (cuma bikin baseline, gak push, biar gak dobel sama push instan).
 *   true  → bypass toggle, dan key tanpa snapshot langsung di-push penuh
 *           sebagai initial upload (dipakai sync manual, catch-up startup,
 *           reconnect, dan flush background/foreground — lihat App.jsx).
 * @param {(info: object) => void} [options.onProgress]
 *   Dipanggil berkali-kali selama proses jalan, buat progress bar di UI.
 *   Shape: { keyIndex, totalKeys, key, phase: 'transaction'|'config'|'live',
 *            doneInKey, totalInKey, sentCount, failedCount, failedItems }
 *   failedItems: array { tableKey, id, message } — detail tiap record yang
 *   gagal push, diakumulasi sepanjang proses (dipakai BackupView buat
 *   nampilin daftar record bermasalah, bukan cuma angka doang).
 *
 * @returns {Promise<{sent: number, failed: number, failedItems: Array}>}
 */
export async function runAutoSync({ force = false, onProgress } = {}) {
  if ((!isAutoSyncEnabled() && !force) || !isSupabaseConfigured() || autoSyncInFlight) {
    return { sent: 0, failed: 0 };
  }
  autoSyncInFlight = true;

  let sentCount = 0;
  let failedCount = 0;
  const failedItems = []; // { tableKey, id, message } — buat ditampilin di UI (BackupView)

  // Total semua key (transaksi + config + live-state) — dipakai buat hitung
  // keyIndex/totalKeys yang konsisten di seluruh progress report.
  const totalKeys = TRANSACTION_KEYS.length + CONFIG_KEYS.length + LIVE_STATE_KEYS.length;
  let keyIndex = 0;

  function report(key, phase, doneInKey, totalInKey) {
    onProgress?.({
      keyIndex, totalKeys, key, phase,
      doneInKey, totalInKey,
      sentCount, failedCount, failedItems,
    });
  }

  try {
    const snapshot = loadAutoSyncSnapshot();

    // ── TRANSACTION KEYS — push per-record, hapus permanen HANYA dari purge ─
    for (const tableKey of TRANSACTION_KEYS) {
      keyIndex++;
      try {
        let current = await purgeExpired(tableKey, await loadData(tableKey, []));

        if (!(tableKey in snapshot)) {
          if (force && current.length > 0) {
            const pushedMap = new Map();
            let doneInKey = 0;
            report(tableKey, 'transaction', 0, current.length);
            await runInBatches(current, async (item) => {
              const ok = await pushTransactionUpsert(tableKey, item, undefined, (info) => failedItems.push(info));
              if (ok) { sentCount++; pushedMap.set(String(item.id), item); } else { failedCount++; }
              return ok;
            }, () => { doneInKey++; report(tableKey, 'transaction', doneInKey, current.length); });
            // Cuma yang beneran kekirim yang jadi baseline — sisanya bakal
            // ketauan lagi sebagai upsert baru di run berikutnya, gak
            // ke-skip diam-diam.
            snapshot[tableKey] = Array.from(pushedMap.values());
          } else {
            snapshot[tableKey] = current;
          }
          saveAutoSyncSnapshot(snapshot);
          continue;
        }

        const { upserts, deletes } = diffArrays(snapshot[tableKey], current);
        const workingMap = new Map((snapshot[tableKey] || []).map(it => [String(it.id), it]));
        const totalInKey = upserts.length + deletes.length;
        let doneInKey = 0;
        report(tableKey, 'transaction', 0, totalInKey);

        if (upserts.length > 0) {
          await runInBatches(upserts, async (item) => {
            const ok = await pushTransactionUpsert(tableKey, item, undefined, (info) => failedItems.push(info));
            if (ok) { sentCount++; workingMap.set(String(item.id), item); } else { failedCount++; }
            return ok;
          }, () => { doneInKey++; report(tableKey, 'transaction', doneInKey, totalInKey); });
          // Simpan snapshot begitu upserts kelar (bukan nunggu deletes juga)
          // biar progress yang udah kekirim gak ilang kalau macet di deletes.
          snapshot[tableKey] = Array.from(workingMap.values());
          saveAutoSyncSnapshot(snapshot);
        }

        // `deletes` di sini cuma muncul dari item yang barusan kena purge di
        // atas (UI gak pernah filter langsung dari array) — jadi delete di
        // Supabase juga otomatis ngikut aturan "hapus cuma dari recycle bin".
        if (deletes.length > 0) {
          await runInBatches(deletes, async (id) => {
            const ok = await pushTransactionDelete(tableKey, id);
            if (ok) { sentCount++; workingMap.delete(String(id)); } else { failedCount++; }
            return ok;
          }, () => { doneInKey++; report(tableKey, 'transaction', doneInKey, totalInKey); });
        }

        snapshot[tableKey] = Array.from(workingMap.values());
        saveAutoSyncSnapshot(snapshot);
      } catch (err) {
        failedCount++;
        console.warn(`[sync] error proses transaksi "${tableKey}", lanjut ke key berikutnya:`, err.message);
      }
    }

    // ── CONFIG KEYS — push manual-only, per-key, cuma yang berubah ─────────
    // Config itu 1 blob per key (bukan array of record), jadi gak ada
    // "batch dalam key" — progress cukup done=0/1 lalu done=1/1.
    for (const key of CONFIG_KEYS) {
      keyIndex++;
      report(key, 'config', 0, 1);
      try {
        let current = await purgeExpired(key, await loadData(key, undefined));

        if (!(key in snapshot)) {
          if (force && current !== undefined) {
            const ok = await pushConfig(key, current);
            if (ok) { sentCount++; snapshot[key] = current; } else { failedCount++; }
          } else {
            snapshot[key] = current;
          }
          saveAutoSyncSnapshot(snapshot);
          report(key, 'config', 1, 1);
          continue;
        }

        if (JSON.stringify(current) !== JSON.stringify(snapshot[key])) {
          const ok = await pushConfig(key, current);
          if (ok) { sentCount++; snapshot[key] = current; } else { failedCount++; }
        }

        saveAutoSyncSnapshot(snapshot);
        report(key, 'config', 1, 1);
      } catch (err) {
        failedCount++;
        console.warn(`[sync] error proses config "${key}", lanjut ke key berikutnya:`, err.message);
      }
    }

    // ── LIVE STATE KEYS (currentShift, dkk) — safety net manual & berkala ──
    // Push instan (di luar fungsi ini) sudah cover real-time-nya; loop ini
    // cuma jaring pengaman kalau push instan gagal terkirim (device offline dll).
    for (const key of LIVE_STATE_KEYS) {
      keyIndex++;
      report(key, 'live', 0, 1);
      try {
        const current = await loadData(key, null);

        if (!(key in snapshot)) {
          if (force) {
            const ok = await pushLiveState(key, current);
            if (ok) { sentCount++; snapshot[key] = current; } else { failedCount++; }
          } else {
            snapshot[key] = current;
          }
          saveAutoSyncSnapshot(snapshot);
          report(key, 'live', 1, 1);
          continue;
        }

        if (JSON.stringify(current) !== JSON.stringify(snapshot[key])) {
          const ok = await pushLiveState(key, current);
          if (ok) { sentCount++; snapshot[key] = current; } else { failedCount++; }
        }

        saveAutoSyncSnapshot(snapshot);
        report(key, 'live', 1, 1);
      } catch (err) {
        failedCount++;
        console.warn(`[sync] error proses live-state "${key}", lanjut ke key berikutnya:`, err.message);
      }
    }

    localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
    window.dispatchEvent(new CustomEvent('mamam_sync_updated'));

    if (sentCount > 0 || failedCount > 0) {
      console.log(`[sync] ${force ? 'manual' : 'auto'}-sync: ${sentCount} terkirim, ${failedCount} gagal`);
    } else {
      console.log(`[sync] ${force ? 'manual' : 'auto'}-sync: tidak ada perubahan`);
    }

    return { sent: sentCount, failed: failedCount, failedItems };
  } catch (err) {
    console.warn(`[sync] ${force ? 'manual' : 'auto'}-sync gagal total:`, err.message);
    return { sent: sentCount, failed: failedCount, failedItems };
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
        const { data: rows, error } = await withTimeout(
          supabase.from(tableKey).select('id, payload, updated_at, updated_by'),
          PUSH_TIMEOUT_MS, `initial pull ${tableKey}`
        );
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
        const { data: rows, error } = await withTimeout(
          supabase.from('app_config').select('key, value, updated_at, updated_by').in('key', APP_CONFIG_KEYS),
          PUSH_TIMEOUT_MS, 'initial pull config'
        );
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