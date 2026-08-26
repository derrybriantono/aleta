"use strict";

/**
 * Potret perkara: menyimpan sebentar jawaban per perkara agar SIPP tidak
 * ditanya berulang untuk hal yang sama.
 *
 * Sebelum ini setiap kali pihak menekan satu pilihan menu, satu query baru
 * berangkat ke SIPP. Memeriksa jadwal, biaya, lalu status untuk SATU perkara
 * yang sama dalam satu menit berarti tiga query terpisah — dan bila lima orang
 * melakukannya bersamaan, lima belas. Padahal SIPP adalah sistem produksi
 * pengadilan, bukan basis data laporan.
 *
 * MASA BERLAKU DIBEDAKAN MENURUT SIFAT DATANYA. Menyamaratakan berarti memilih
 * antara data biaya yang usang atau identitas perkara yang diambil ulang tanpa
 * perlu. Karena itu biaya ditahan singkat, identitas perkara jauh lebih lama.
 *
 * DATA LAMA SEBAGAI CADANGAN. Bila SIPP sedang bermasalah, lebih baik menjawab
 * dengan data beberapa menit lalu SAMBIL MENGATAKANNYA APA ADANYA daripada
 * gagal menjawab sama sekali. Karena itu potret disimpan lebih lama daripada
 * masa berlakunya, khusus untuk keadaan itu.
 *
 * YANG TIDAK BOLEH MASUK SINI: apa pun yang bersifat menulis (pendaftaran
 * antrian sidang), dan apa pun yang bergantung pada SIAPA yang bertanya.
 * Potret disimpan per NOMOR PERKARA, jadi isinya harus sama untuk siapa pun
 * yang berhak. Pemeriksaan hak akses tetap dijalankan ulang setiap permintaan
 * dan tidak pernah ikut disimpan.
 */

const logService = require("./logService");

/**
 * Masa berlaku per jenis data, dalam milidetik.
 * Dipilih dari seberapa cepat datanya benar-benar berubah di SIPP.
 */
const TTL_BY_KIND = {
  // Identitas perkara praktis tidak berubah setelah didaftarkan.
  identitas: 30 * 60 * 1000,
  // Daftar pihak dan kuasa berubah bila ada perubahan kuasa.
  penerima: 10 * 60 * 1000,
  // Jadwal sidang ditetapkan per tahapan, berubah paling cepat harian.
  jadwal: 5 * 60 * 1000,
  detail: 5 * 60 * 1000,
  status: 5 * 60 * 1000,
  // Perjalanan perkara menggabungkan jadwal dan putusan, jadi mengikuti
  // masa berlaku yang paling pendek di antara keduanya.
  perjalanan: 5 * 60 * 1000,
  // Status panggilan berubah saat Jurusita menyerahkan relaas; cukup sering
  // untuk tidak ditahan lama, tidak sesering data biaya.
  panggilan: 5 * 60 * 1000,
  // Ketersediaan berkas putusan berubah saat berkas diunggah; jarang, tetapi
  // pemeriksaannya menyentuh berkas jadi tidak perlu diulang terus.
  dokumen: 10 * 60 * 1000,
  // Menyangkut uang: paling pendek, supaya pembayaran cepat terlihat.
  biaya: 2 * 60 * 1000,
  akta: 10 * 60 * 1000,
  putusan: 10 * 60 * 1000,
};
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Berapa lama data kedaluwarsa masih disimpan sebagai cadangan darurat. */
const STALE_RETENTION_MS = 30 * 60 * 1000;
/** Batas jumlah potret agar pemakaian memori tetap terkendali. */
const MAX_ENTRIES = 500;

const store = new Map();
const stats = { hits: 0, misses: 0, staleServed: 0, stores: 0, invalidations: 0, evictions: 0 };
let startedAt = new Date().toISOString();

function ttlFor(kind) {
  return TTL_BY_KIND[String(kind || "").toLowerCase()] || DEFAULT_TTL_MS;
}

function keyOf(kind, caseNumber) {
  return `${String(kind || "lain").toLowerCase()}::${String(caseNumber || "").trim()}`;
}

/**
 * Potret paling lama tidak dipakai dibuang lebih dulu, supaya perkara yang
 * sedang ramai ditanya tidak tergeser oleh perkara yang lewat sekali.
 */
function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  let oldest = null;
  for (const [key, entry] of store) {
    if (!oldest || entry.lastUsedAt < oldest.entry.lastUsedAt) oldest = { key, entry };
  }
  if (oldest) {
    store.delete(oldest.key);
    stats.evictions += 1;
  }
}

/** Membuang potret yang sudah terlalu lama sekalipun sebagai cadangan. */
function sweepExpired(now = Date.now()) {
  for (const [key, entry] of store) {
    if (now - entry.storedAt > STALE_RETENTION_MS) store.delete(key);
  }
}

function readEntry(kind, caseNumber) {
  const entry = store.get(keyOf(kind, caseNumber));
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.storedAt > STALE_RETENTION_MS) {
    store.delete(keyOf(kind, caseNumber));
    return null;
  }
  entry.lastUsedAt = now;
  return { ...entry, ageMs: now - entry.storedAt, fresh: now - entry.storedAt <= entry.ttlMs };
}

function writeEntry(kind, caseNumber, value) {
  const now = Date.now();
  store.set(keyOf(kind, caseNumber), {
    value,
    kind,
    caseNumber,
    ttlMs: ttlFor(kind),
    storedAt: now,
    lastUsedAt: now,
  });
  stats.stores += 1;
  evictIfNeeded();
}

/**
 * Mengambil data perkara, memakai potret bila masih berlaku.
 *
 * @param {object} options
 * @param {string} options.kind jenis data (jadwal, biaya, ...) penentu masa berlaku
 * @param {string} options.caseNumber nomor perkara sebagai kunci potret
 * @param {Function} options.loader pengambil data sesungguhnya bila potret tidak ada
 * @param {boolean} options.bypass lewati potret sama sekali (untuk operasi tulis)
 * @param {boolean} options.allowStale boleh menjawab dengan data lama bila pengambilan gagal
 * @returns {Promise<{value:*, source:"fresh"|"cache"|"stale", ageMs:number}>}
 */
async function remember({ kind, caseNumber, loader, bypass = false, allowStale = true } = {}) {
  if (typeof loader !== "function") {
    throw new Error("caseSnapshotService.remember membutuhkan loader.");
  }

  // Operasi yang menulis, atau tanpa nomor perkara, tidak pernah disimpan.
  if (bypass || !String(caseNumber || "").trim()) {
    const value = await loader();
    return { value, source: "fresh", ageMs: 0 };
  }

  const cached = readEntry(kind, caseNumber);
  if (cached && cached.fresh) {
    stats.hits += 1;
    return { value: cached.value, source: "cache", ageMs: cached.ageMs };
  }

  stats.misses += 1;
  try {
    const value = await loader();
    writeEntry(kind, caseNumber, value);
    return { value, source: "fresh", ageMs: 0 };
  } catch (error) {
    // SIPP gagal dijawab. Bila masih ada potret lama, itu jauh lebih berguna
    // bagi penanya daripada pesan kesalahan — asal umurnya disebutkan.
    if (allowStale && cached) {
      stats.staleServed += 1;
      void logService
        .logSystemEvent({
          eventType: "case_snapshot_stale_served",
          severity: "warning",
          message: "Data perkara dijawab dari potret lama karena sumber datanya gagal diambil.",
          metadata: {
            kind,
            ageMs: cached.ageMs,
            errorMessage: String(error.message || error).slice(0, 200),
          },
        })
        .catch(() => {});
      return { value: cached.value, source: "stale", ageMs: cached.ageMs };
    }
    throw error;
  }
}

/**
 * Membuang seluruh potret satu perkara.
 * Dipanggil saat ada perubahan pada perkara itu, mis. notifikasi baru terkirim,
 * supaya data lama tidak terlanjur dijawab setelah keadaannya berubah.
 */
function invalidateCase(caseNumber) {
  const suffix = `::${String(caseNumber || "").trim()}`;
  let removed = 0;
  for (const key of store.keys()) {
    if (key.endsWith(suffix)) {
      store.delete(key);
      removed += 1;
    }
  }
  if (removed > 0) stats.invalidations += removed;
  return removed;
}

function invalidateAll() {
  const removed = store.size;
  store.clear();
  stats.invalidations += removed;
  return removed;
}

/** Keterangan umur data untuk ditempelkan pada jawaban yang berasal dari potret lama. */
function describeAge(ageMs) {
  const menit = Math.round(Number(ageMs || 0) / 60000);
  if (menit < 1) return "kurang dari semenit lalu";
  if (menit === 1) return "sekitar semenit lalu";
  return `sekitar ${menit} menit lalu`;
}

function getStats() {
  sweepExpired();
  const lookups = stats.hits + stats.misses;
  return {
    startedAt,
    entries: store.size,
    maxEntries: MAX_ENTRIES,
    lookups,
    hits: stats.hits,
    misses: stats.misses,
    staleServed: stats.staleServed,
    invalidations: stats.invalidations,
    evictions: stats.evictions,
    // Angka inilah yang menentukan berhasil atau tidaknya Tahap 3.
    hitRatio: lookups > 0 ? Number((stats.hits / lookups).toFixed(3)) : 0,
    ttlByKind: { ...TTL_BY_KIND, lain: DEFAULT_TTL_MS },
    staleRetentionMs: STALE_RETENTION_MS,
  };
}

function reset() {
  store.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.staleServed = 0;
  stats.stores = 0;
  stats.invalidations = 0;
  stats.evictions = 0;
  startedAt = new Date().toISOString();
}

module.exports = {
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  STALE_RETENTION_MS,
  TTL_BY_KIND,
  describeAge,
  getStats,
  invalidateAll,
  invalidateCase,
  remember,
  reset,
  ttlFor,
};
