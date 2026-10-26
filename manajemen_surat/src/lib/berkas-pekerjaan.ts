/**
 * ============================================================================
 * PEKERJAAN BERKAS DI SERVER - ATURAN MURNI (K14, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Cetak massal Blangko Derry (ZIP RTF atau PDF gabungan) dan pemeriksaan sisa blangko dikerjakan server supaya PC
 * tua tidak tersendat dan peramban boleh ditutup selagi server bekerja. Berkas ini hanya memuat batas dan pembersih
 * nama yang murni; pelaksananya ada di src/server/modules/aleta-ecourt/berkas-pekerjaan.ts.
 *
 * KEBIJAKAN DATA: isi naskah memuat nama, alamat, dan NIK para pihak. Pekerjaan hidup HANYA di memori proses server,
 * paling lama MASA_HASIL_MS sesudah selesai; tidak pernah ditulis ke disk atau basis data (sama dengan
 * rute abt/pdf dan pdf-gabung yang menerima, mengolah, memulangkan, dan melupakan).
 */

export const FORMAT_PEKERJAAN = ["rtf", "pdf"] as const;
export type FormatPekerjaan = (typeof FORMAT_PEKERJAAN)[number];

export const BATAS_BUTIR = 60;
/** Satu naskah RTF paling besar (bita). */
export const BATAS_BITA_BUTIR = 6 * 1024 * 1024;
/** Seluruh naskah satu pekerjaan paling besar (bita). */
export const BATAS_BITA_PEKERJAAN = 48 * 1024 * 1024;
/** Pekerjaan aktif per pengguna. */
export const BATAS_PEKERJAAN_AKTIF = 3;
/** Hasil (dan pekerjaan yang ditinggalkan) disimpan paling lama ini sejak terakhir berubah, lalu dilupakan. */
export const MASA_HASIL_MS = 2 * 60 * 60 * 1000;
/** Pekerjaan yang tidak pernah dimulai dibuang lebih cepat. */
export const MASA_KUMPUL_MS = 30 * 60 * 1000;
/** Jumlah temuan sisa blangko per naskah yang dikirim ke peramban. */
export const BATAS_TEMUAN_DIKIRIM = 25;
/** Pemeriksaan sisa tunggal (di luar pekerjaan) menolak naskah lebih besar dari ini. */
export const BATAS_BITA_PERIKSA = 12 * 1024 * 1024;

export function formatPekerjaanSah(x: unknown): x is FormatPekerjaan {
  return typeof x === "string" && (FORMAT_PEKERJAAN as readonly string[]).includes(x);
}

/** Nama berkas aman untuk dalam ZIP dan unduhan: tanpa jalur, tanpa karakter terlarang Windows, paling panjang 140. */
export function namaBerkasAman(x: unknown, cadangan = "naskah"): string {
  const s = String(x == null ? "" : x)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  const potong = s.length > 140 ? s.slice(0, 140).trim() : s;
  return potong || cadangan;
}

/** Nama unik di dalam satu arsip: bentrokan diberi " (2)", " (3)" sebelum akhiran. Tidak peka huruf besar-kecil. */
export function namaUnik(nama: string, dipakai: Set<string>): string {
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  const akhir = titik > 0 ? nama.slice(titik) : "";
  let calon = nama;
  for (let i = 2; dipakai.has(calon.toLowerCase()); i += 1) calon = `${dasar} (${i})${akhir}`;
  dipakai.add(calon.toLowerCase());
  return calon;
}

export function rtfBermula(bita: Uint8Array): boolean {
  const kepala = Buffer.from(bita.subarray(0, 16)).toString("latin1");
  return /^\s*\{\\rtf/.test(kepala);
}
