/**
 * ============================================================================
 * ANTREAN KERJA PERAMBAN DI BASIS DATA - ATURAN MURNI (K15, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Tabel aleta_antrean_peramban (0098) menyimpan SALINAN keadaan antrean yang tadinya hanya hidup di
 * chrome.storage. Berkas ini hanya memuat aturan murni (jenis sah, batas, pembersih) supaya dapat dipakai
 * modul server dan diuji tanpa basis data. Salinannya di ekstensi: ekstensi-sipp/antrean-server.js.
 */

export const JENIS_ANTREAN = ["cetak-massal", "relaas-massal", "putusan-terjadwal-catatan"] as const;
export type JenisAntrean = (typeof JENIS_ANTREAN)[number];

export const STATUS_ANTREAN = ["jalan", "selesai", "dibuang"] as const;
export type StatusAntrean = (typeof STATUS_ANTREAN)[number];

/** Muatan JSON paling besar (bita UTF-8). Antrean 40 perkara muat dengan lega; isi dokumen tidak pernah ikut. */
export const BATAS_MUATAN_BITA = 256 * 1024;
export const BATAS_KUNCI = 160;
export const BATAS_RINGKAS = 240;
export const BATAS_TOTAL_BUTIR = 1000;
/** Antrean yang tidak berubah selama ini dianggap ditinggalkan dan dibuang. */
export const UMUR_JALAN_MAKS_HARI = 14;
/** Antrean yang sudah selesai atau dibuang disimpan sebentar untuk pemeriksaan, lalu disapu. */
export const UMUR_SELESAI_MAKS_HARI = 2;
/** Catatan putusan terjadwal dari PC lain baru boleh diambil alih bila tidak berubah selama ini. */
export const BASI_PUTUSAN_TERJADWAL_MS = 10 * 60 * 1000;

export function jenisAntreanSah(x: unknown): x is JenisAntrean {
  return typeof x === "string" && (JENIS_ANTREAN as readonly string[]).includes(x);
}

export function statusAntreanSah(x: unknown): x is StatusAntrean {
  return typeof x === "string" && (STATUS_ANTREAN as readonly string[]).includes(x);
}

function teksPendek(x: unknown, maks: number): string {
  const s = typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  return s.length > maks ? s.slice(0, maks) : s;
}

export type MasukanAntrean = {
  jenis: JenisAntrean;
  kunci: string;
  perangkat: string;
  ringkas: string;
  selesai: number;
  total: number;
  muatan: unknown;
  status: StatusAntrean;
};

export class GalatAntrean extends Error {}

/** Memeriksa masukan dari ekstensi; melempar GalatAntrean (400) untuk yang tidak sah. */
export function bersihkanMasukanAntrean(x: unknown): MasukanAntrean {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new GalatAntrean("Masukan antrean harus berupa obyek.");
  const m = x as Record<string, unknown>;
  if (!jenisAntreanSah(m.jenis)) throw new GalatAntrean(`Jenis antrean tidak dikenal. Yang sah: ${JENIS_ANTREAN.join(", ")}.`);
  const kunci = teksPendek(m.kunci, BATAS_KUNCI);
  if (!kunci) throw new GalatAntrean("Kunci antrean kosong.");
  const status = m.status === undefined ? "jalan" : m.status;
  if (!statusAntreanSah(status)) throw new GalatAntrean(`Status antrean tidak sah. Yang sah: ${STATUS_ANTREAN.join(", ")}.`);
  const angka = (v: unknown) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, BATAS_TOTAL_BUTIR) : 0;
  };
  const total = angka(m.total);
  const selesai = Math.min(angka(m.selesai), total || BATAS_TOTAL_BUTIR);
  const muatan = m.muatan === undefined ? {} : m.muatan;
  if (muatan === null || typeof muatan !== "object") throw new GalatAntrean("Muatan antrean harus berupa obyek atau larik.");
  const teks = JSON.stringify(muatan);
  if (Buffer.byteLength(teks, "utf8") > BATAS_MUATAN_BITA) {
    throw new GalatAntrean(`Muatan antrean terlalu besar (batas ${BATAS_MUATAN_BITA} bita).`);
  }
  return { jenis: m.jenis, kunci, perangkat: teksPendek(m.perangkat, 80), ringkas: teksPendek(m.ringkas, BATAS_RINGKAS), selesai, total, muatan, status };
}
