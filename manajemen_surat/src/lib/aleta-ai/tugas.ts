/**
 * ============================================================================
 * ALETA Ai TAHAP 3 - TUGAS (COWORK): jenis, langkah, rute, penjaga keluaran
 * ============================================================================
 *
 * Murni (tanpa basis data) supaya mudah diuji; pelarinya ada di
 * src/server/modules/aleta-ai/tugas.ts.
 *
 * Satu tugas = rangkaian langkah TERLIHAT:
 *   rencana -> ambil-data -> susun -> periksa -> berkas
 * "rencana", "susun", "periksa" memanggil model; "ambil-data" memakai alat data
 * baca-saja tahap 2 (tanpa model); "berkas" menyusun berkas di server (tanpa
 * model).
 *
 * RUTE (rencana v2 bagian 2): draf putusan = Opus high (mendalam-putusan),
 * perkara rumit = Opus max (mendalam-rumit), komparasi = mendalam-analisa,
 * panduan sidang = teliti-sidang. Tidak pernah turun di tengah tugas.
 *
 * HAK (bagian 10.3): draf putusan HANYA Ketua/Wakil/Hakim - termasuk Super
 * Admin/Admin yang jabatannya bukan hakim/pimpinan TIDAK boleh (ditegakkan di
 * server, lihat bolehJenisTugas).
 */

import type { KemampuanAi } from "@/lib/matriks-peran";

export type JenisTugas = "draf-putusan" | "panduan-sidang" | "komparasi-arah";
export type FormatBerkas = "docx" | "rtf" | "pdf" | "html" | "xlsx";
export const FORMAT_BERKAS: readonly FormatBerkas[] = ["docx", "rtf", "pdf", "html", "xlsx"];

export type KodeLangkah = "rencana" | "ambil-data" | "susun" | "periksa" | "berkas";
export const URUTAN_LANGKAH: readonly KodeLangkah[] = ["rencana", "ambil-data", "susun", "periksa", "berkas"];
export const JUDUL_LANGKAH: Record<KodeLangkah, string> = {
  rencana: "Rencana kerja",
  "ambil-data": "Ambil data perkara",
  susun: "Susun naskah",
  periksa: "Periksa naskah",
  berkas: "Buat berkas",
};

/**
 * Status tugas:
 *   antre       dibuat, belum berjalan
 *   berjalan    pelari sedang bekerja (detak_at diperbarui tiap langkah)
 *   dijeda      dihentikan pengguna; dapat dilanjutkan
 *   dihentikan  dihentikan SAKLAR DARURAT; dapat dilanjutkan bila saklar hidup lagi
 *   saldo-habis "Berhenti: saldo habis" - tahanan tidak cukup untuk langkah berikutnya;
 *               hasil sementara tersimpan; dilanjutkan sesudah saldo diisi (jalan baru)
 *   gagal       galat / penolakan model; hasil sementara tersimpan; dapat dilanjutkan
 *   selesai     semua langkah selesai, berkas siap
 */
export type StatusTugas = "antre" | "berjalan" | "dijeda" | "dihentikan" | "saldo-habis" | "gagal" | "selesai";
export type StatusLangkah = "menunggu" | "berjalan" | "selesai" | "dilewati" | "gagal";

export type DefinisiTugas = {
  jenis: JenisTugas;
  label: string;
  kemampuan: KemampuanAi;
  /** Kelompok rute bawaan (tabel rute bagian 2). */
  kelompok: string;
  /** Bagian data_perkara yang diambil (alat tahap 2). */
  bagianData: Array<"ringkas" | "pihak" | "jadwal" | "relaas" | "putusan">;
  /** Petunjuk tugas untuk model (ikut di pesan langkah "susun"). */
  petunjuk: string;
  /** Pemicu V4.5 yang modulnya dimuat (dicocokkan dengan label/alias menu). */
  pemicu: string;
  /**
   * Templat HTML V4.5 yang membaca SATU objek data global (window.<nama>):
   * nama berkasnya di proyek aktif dan kunci objek yang diminta dari model.
   */
  objekData?: { nama: string; templat: RegExp; kunci: readonly string[] };
  /** Alat sandbox pencetak DOCX/RTF/PDF (skrip V4.5) dan berkas masukannya. */
  cetak?: { alat: string; masukan: "naskah" | "data" };
  /** Tujuan kiriman yang boleh. */
  tujuanKirim: TujuanKiriman[];
};

export type TujuanKiriman = "blangko-derry" | "draf-h7" | "bas";
export const LABEL_TUJUAN: Record<TujuanKiriman, string> = {
  "blangko-derry": "Blangko ABT by Derry (isian)",
  "draf-h7": "Draf H-7",
  bas: "BAS",
};

export const DEFINISI_TUGAS: Record<JenisTugas, DefinisiTugas> = {
  "draf-putusan": {
    jenis: "draf-putusan",
    label: "Draf putusan (format Donggala)",
    kemampuan: "draf-putusan",
    kelompok: "mendalam-putusan",
    bagianData: ["ringkas", "pihak", "jadwal", "relaas", "putusan"],
    petunjuk:
      "Susun DRAF PUTUSAN lengkap format putusan PA Donggala (ALETA_08) dari data perkara di bawah, sebagai NASKAH BERPENANDA BARIS: tiap baris diawali penanda #BISMILLAH #JUDUL #NOMOR #PIHAK #P #PK #N #KS #H #C #CB #AR #AMAR #BIAYA #JUMLAH #TJ #TTD #KAKI #SALINAN #BR (atau #SISIP/#VERBATIM bila perlu), persis seperti modul format putusan. Tanpa Markdown.",
    pemicu: "putusan lengkap",
    cetak: { alat: "putusan-docx", masukan: "naskah" },
    tujuanKirim: ["draf-h7", "blangko-derry"],
  },
  "panduan-sidang": {
    jenis: "panduan-sidang",
    label: "Panduan sidang",
    kemampuan: "draf-bas",
    kelompok: "teliti-sidang",
    bagianData: ["ringkas", "pihak", "jadwal", "relaas"],
    petunjuk:
      "Susun PANDUAN SIDANG berikutnya: agenda, urutan pemeriksaan, pertanyaan untuk para pihak dan saksi, dan hal yang perlu dicatat di BAS. Tulis naskahnya dalam Markdown sederhana.",
    pemicu: "panduan sidang",
    objekData: {
      nama: "SIDANG",
      templat: /(^|\/)ALETA_13_[^/]*\.html?$/i,
      kunci: ["meta", "unsur", "pertanyaan", "alat_bukti", "analisa_awal", "langkah", "cek_acara", "agenda_berikut", "penutup"],
    },
    cetak: { alat: "sidang-docx", masukan: "data" },
    tujuanKirim: ["bas", "blangko-derry"],
  },
  "komparasi-arah": {
    jenis: "komparasi-arah",
    label: "Komparasi arah putusan",
    kemampuan: "draf-putusan",
    kelompok: "mendalam-analisa",
    bagianData: ["ringkas", "pihak", "jadwal", "putusan"],
    petunjuk:
      "Bandingkan kemungkinan ARAH PUTUSAN (dikabulkan, dikabulkan sebagian, ditolak, tidak dapat diterima): dasar hukum, fakta pendukung, risiko tiap arah. Tulis naskahnya dalam Markdown; sajikan tabel perbandingan dengan baris '| arah | dasar | fakta | risiko |'.",
    pemicu: "komparasi",
    objekData: { nama: "KOMPARASI", templat: /(^|\/)ALETA_18_[^/]*\.html?$/i, kunci: ["meta", "arah", "kesimpulan", "angka"] },
    cetak: { alat: "komparasi-docx", masukan: "data" },
    tujuanKirim: ["draf-h7"],
  },
};

export const DAFTAR_JENIS_TUGAS = Object.keys(DEFINISI_TUGAS) as JenisTugas[];

/** Perkara rumit (rencana bagian 2) -> Opus max. */
const POLA_RUMIT = /\b(waris|kewarisan|harta\s+bersama|gono[- ]?gini|ekonomi\s+syari'?ah|kumulasi|rekonvensi|sita\s+(jaminan|marital|eksekusi))\b/i;

export function perkaraRumit(teksPerkara: string, jumlahSaksi = 0): boolean {
  return POLA_RUMIT.test(String(teksPerkara ?? "")) || jumlahSaksi > 5;
}

/**
 * Kelompok rute tugas: bawaan jenisnya; naik ke "mendalam-rumit" untuk perkara
 * rumit pada draf putusan/komparasi. Tidak pernah turun.
 */
export function kelompokTugas(jenis: JenisTugas, rumit: boolean): string {
  const d = DEFINISI_TUGAS[jenis];
  if (rumit && (jenis === "draf-putusan" || jenis === "komparasi-arah")) return "mendalam-rumit";
  return d.kelompok;
}

/** Jabatan yang boleh draf putusan (bagian 10.3): Ketua, Wakil, Hakim - dinilai dari golongan ATAU jabatan. */
const JABATAN_PUTUSAN = new Set(["pos-ketua", "pos-wakil", "pos-hakim"]);
const GOLONGAN_PUTUSAN = new Set(["pimpinan", "hakim"]);

export function jabatanPutusan(golongan: readonly string[], positionId: string): boolean {
  return golongan.some((g) => GOLONGAN_PUTUSAN.has(g)) || JABATAN_PUTUSAN.has(String(positionId ?? ""));
}

// ----------------------------------------------------------------------------
// Penjaga keluaran
// ----------------------------------------------------------------------------

export const TANDA_DRAF = "Draf AI - wajib diperiksa";
/** Kosakata penanda V4.5 (templat menyorot teks yang cocok POLA_PENANDA_V45). */
export const TANDA_RUJUKAN = "[PERLU VERIFIKASI]";
export const POLA_PENANDA_V45 = /\[(?:placeholder|MASUKKAN|PERLU VERIFIKASI|verifikasi|juz\/hlm)[^\]]*\]/gi;
const POLA_TANDA_VERIFIKASI = /\[\s*(?:PERLU\s+VERIFIKASI|verifikasi)\s*([^\]]*)\]/gi;

/**
 * Rujukan pasal/peraturan: "Pasal 116 huruf f Kompilasi Hukum Islam",
 * "Pasal 39 ayat (2) UU Nomor 1 Tahun 1974", "SEMA Nomor 1 Tahun 2022",
 * "PERMA No. 1 Tahun 2016", "PP Nomor 9 Tahun 1975".
 */
const POLA_RUJUKAN =
  /\b(?:Pasal\s+\d+[A-Z]?(?:\s+(?:ayat\s*\(\d+\)|huruf\s+[a-z]|angka\s+\d+))*(?:\s+(?:Kompilasi\s+Hukum\s+Islam|KHI|KUH\s*Perdata|BW|HIR|RBg|R\.Bg\.?|(?:Undang-Undang|UU|PP|Peraturan\s+Pemerintah|PERMA|Perma|SEMA|Inpres)\s+(?:Nomor|No\.?)\s*\d+\s+Tahun\s+\d{4}))?|(?:Undang-Undang|UU|PP|Peraturan\s+Pemerintah|PERMA|Perma|SEMA|Inpres)\s+(?:Nomor|No\.?)\s*\d+\s+Tahun\s+\d{4})/g;

const normalRujukan = (s: string) =>
  s
    .toLowerCase()
    .replace(/kompilasi hukum islam/g, "khi")
    .replace(/undang-undang/g, "uu")
    .replace(/peraturan pemerintah/g, "pp")
    .replace(/no\.?\s*/g, "nomor ")
    .replace(/\s+/g, " ")
    .trim();

export type RujukanTerbaca = { teks: string; terverifikasi: boolean };

/**
 * Rujukan TERVERIFIKASI = tertulis di pengetahuan proyek V4.5 (Core Prompt +
 * modul) yang dikurasi pengguna. Yang lain belum terverifikasi.
 */
export function bacaRujukan(teks: string, pengetahuan: string): RujukanTerbaca[] {
  const acuan = normalRujukan(pengetahuan);
  const hasil = new Map<string, RujukanTerbaca>();
  for (const m of String(teks ?? "").matchAll(POLA_RUJUKAN)) {
    const r = m[0].trim();
    if (!hasil.has(r)) hasil.set(r, { teks: r, terverifikasi: acuan.includes(normalRujukan(r)) });
  }
  return [...hasil.values()];
}

/** Draf untuk pengguna: rujukan belum terverifikasi DITANDAI. */
export function tandaiRujukan(teks: string, pengetahuan: string): string {
  const belum = new Set(bacaRujukan(teks, pengetahuan).filter((r) => !r.terverifikasi).map((r) => r.teks));
  if (!belum.size) return teks;
  // Rujukan yang sudah diberi penanda oleh model tidak ditandai dua kali.
  return String(teks).replace(POLA_RUJUKAN, (r, letak: number, utuh: string) =>
    belum.has(r.trim()) && !/^\s*\[\s*(?:PERLU\s+VERIFIKASI|verifikasi)/i.test(utuh.slice(letak + r.length)) ? `${r} ${TANDA_RUJUKAN}` : r
  );
}

/**
 * Berkas RESMI (nilai yang dikirim ke alur ALETA): rujukan belum terverifikasi
 * TIDAK dicetak. Kalimat tetap terbaca; rujukannya diganti tanda kosong yang
 * harus diisi petugas.
 */
export function buangRujukanBelumTerverifikasi(teks: string, pengetahuan: string): string {
  const KOSONG = "(dasar hukum diisi petugas)";
  // 1. Rujukan yang diberi penanda verifikasi (oleh sistem atau model) dibuang bersama penandanya.
  let hasil = String(teks).replace(new RegExp(`(?:${POLA_RUJUKAN.source})\\s*\\[\\s*(?:PERLU\\s+VERIFIKASI|verifikasi)[^\\]]*\\]`, "gi"), KOSONG);
  // 2. Penanda berisi ("[PERLU VERIFIKASI: SEMA 3/2023]") diganti; penanda kosong dibuang.
  hasil = hasil.replace(POLA_TANDA_VERIFIKASI, (_m, isi: string) => (isi.replace(/^[\s:,-]+/, "").trim() ? KOSONG : "")).replace(/[ \t]{2,}/g, " ");
  // 3. Rujukan lain yang tidak ada di pengetahuan proyek.
  const belum = new Set(bacaRujukan(hasil, pengetahuan).filter((r) => !r.terverifikasi).map((r) => r.teks));
  if (!belum.size) return hasil;
  return hasil.replace(POLA_RUJUKAN, (r) => (belum.has(r.trim()) ? KOSONG : r));
}

/**
 * ATURAN KERAS proyek: TIDAK SATU KATA "Aleta"/"ALETA" boleh masuk ke nilai
 * SIPP/ABT/e-Court. Dipakai pada SETIAP nilai kiriman.
 */
export function tanpaKataAleta(nilai: string): string {
  return String(nilai ?? "")
    .replace(/aleta(?:\s+ai\b)?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:])/g, "$1")
    .trim();
}

export function adaKataAleta(nilai: string): boolean {
  return /aleta/i.test(String(nilai ?? ""));
}
