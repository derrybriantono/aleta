/**
 * ============================================================================
 * KONTEKS DAN SETELAN PENGGUNA DI SERVER (U16/K15, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Dua setelan pribadi baru (aleta_ekstensi_setelan, tanpa migrasi, milik pemanggil saja):
 *
 *   konteks.perkara   perkara yang terakhir dibuka di SIPP oleh akun ini (nomor, pintu masuk SIPP, jenis, waktu) - sampai
 *                     12. Mengikuti petugas ke PC lain. TIDAK memuat isi perkara, nama pihak, atau NIK: "konteks" yang
 *                     berisi hasil bacaan SIPP tetap hanya cadangan peramban (bisa dihitung ulang dari SIPP).
 *   perangkat.versi   versi ekstensi yang terpasang di tiap PC akun ini (id PC acak, versi, waktu), sampai 8 PC. Untuk
 *                     peringatan "PC lain memakai versi ekstensi yang berbeda".
 *
 * Hanya bekerja bila Super Admin menyalakan saklar kinerja.konteksDiServer (mati bawaan).
 * Salinan JS ekstensi: ekstensi-sipp/konteks-server.js (uji menyamakan keduanya).
 */

export const BATAS_KONTEKS_PERKARA = 12;
export const BATAS_PERANGKAT = 8;
/** PC yang tidak melapor selama ini tidak dihitung lagi dalam peringatan versi. */
export const UMUR_PERANGKAT_MAKS_HARI = 30;

export type EntriKonteksPerkara = { nomor: string; url: string; jenis: string; waktu: string };
export type EntriPerangkat = { versi: string; waktu: string; nama: string };

const POLA_NOMOR = /^\d{1,6}\/[A-Za-z.]{2,12}\/\d{4}\/[A-Za-z.]{2,20}$/;
const POLA_PC = /^[A-Za-z0-9_-]{4,40}$/;
const POLA_VERSI = /^\d{1,4}(\.\d{1,5}){1,3}$/;

function teks(x: unknown, maks: number): string {
  const s = typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  return s.length > maks ? s.slice(0, maks) : s;
}
function waktuSah(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = new Date(x);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export class GalatKonteks extends Error {}

/** Memeriksa daftar perkara terakhir. Entri tak sah dibuang (dilaporkan), bukan menolak seluruhnya. */
export function normalkanKonteksPerkara(nilai: unknown): { nilai: EntriKonteksPerkara[]; dibuang: string[] } {
  if (!Array.isArray(nilai)) throw new GalatKonteks("konteks.perkara harus berupa larik {nomor, url, jenis, waktu}.");
  const dibuang: string[] = [];
  const peta = new Map<string, EntriKonteksPerkara>();
  for (const x of nilai) {
    const o = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
    const nomor = teks(o?.nomor, 60);
    const waktu = waktuSah(o?.waktu);
    const url = teks(o?.url, 300);
    if (!o || !POLA_NOMOR.test(nomor) || !waktu || !/^https?:\/\//i.test(url)) {
      dibuang.push(nomor || "(tanpa nomor)");
      continue;
    }
    const ada = peta.get(nomor);
    if (!ada || ada.waktu < waktu) peta.set(nomor, { nomor, url, jenis: teks(o.jenis, 60), waktu });
  }
  const hasil = [...peta.values()].sort((a, b) => (a.waktu < b.waktu ? 1 : -1)).slice(0, BATAS_KONTEKS_PERKARA);
  return { nilai: hasil, dibuang };
}

/** Menggabung dua daftar (lokal dan server): satu entri per nomor (yang terbaru), terbaru dulu, paling banyak `maks`. */
export function gabungKonteksPerkara(a: unknown, b: unknown, maks = BATAS_KONTEKS_PERKARA): EntriKonteksPerkara[] {
  const peta = new Map<string, EntriKonteksPerkara>();
  for (const daftar of [a, b]) {
    for (const x of Array.isArray(daftar) ? daftar : []) {
      const o = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
      const nomor = teks(o?.nomor, 60);
      const waktu = waktuSah(o?.waktu);
      const url = teks(o?.url, 300);
      if (!o || !nomor || !waktu || !url) continue;
      const ada = peta.get(nomor);
      if (!ada || ada.waktu < waktu) peta.set(nomor, { nomor, url, jenis: teks(o.jenis, 60), waktu });
    }
  }
  return [...peta.values()].sort((p, q) => (p.waktu < q.waktu ? 1 : -1)).slice(0, maks);
}

export function normalkanVersiPerangkat(nilai: unknown): { nilai: Record<string, EntriPerangkat>; dibuang: string[] } {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) throw new GalatKonteks("perangkat.versi harus berupa obyek {idPerangkat: {versi, waktu}}.");
  const dibuang: string[] = [];
  const daftar: Array<[string, EntriPerangkat]> = [];
  for (const [id, v] of Object.entries(nilai as Record<string, unknown>)) {
    const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    const versi = teks(o?.versi, 20);
    const waktu = waktuSah(o?.waktu);
    if (!POLA_PC.test(id) || !o || !POLA_VERSI.test(versi) || !waktu) {
      dibuang.push(id);
      continue;
    }
    daftar.push([id, { versi, waktu, nama: teks(o.nama, 40) }]);
  }
  daftar.sort((a, b) => (a[1].waktu < b[1].waktu ? 1 : -1));
  return { nilai: Object.fromEntries(daftar.slice(0, BATAS_PERANGKAT)), dibuang };
}

/** Versi lain yang masih dipakai di PC LAIN (bukan PC ini) dalam UMUR_PERANGKAT_MAKS_HARI, tanpa pengulangan. */
export function versiBedaDiPcLain(
  peta: unknown,
  idPcIni: string,
  versiIni: string,
  sekarang: Date = new Date()
): Array<{ versi: string; waktu: string; jumlahPc: number }> {
  const hasil = new Map<string, { versi: string; waktu: string; jumlahPc: number }>();
  if (!peta || typeof peta !== "object" || Array.isArray(peta)) return [];
  const batas = sekarang.getTime() - UMUR_PERANGKAT_MAKS_HARI * 86400000;
  for (const [id, v] of Object.entries(peta as Record<string, unknown>)) {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const versi = teks(o?.versi, 20);
    const waktu = waktuSah(o?.waktu);
    if (!o || id === idPcIni || !versi || !waktu || versi === versiIni) continue;
    if (new Date(waktu).getTime() < batas) continue;
    const ada = hasil.get(versi);
    if (ada) {
      ada.jumlahPc += 1;
      if (ada.waktu < waktu) ada.waktu = waktu;
    } else hasil.set(versi, { versi, waktu, jumlahPc: 1 });
  }
  return [...hasil.values()].sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
}
