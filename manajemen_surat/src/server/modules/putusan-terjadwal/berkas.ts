import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { kenaliNaskahBukanPutusan, nomorPerkaraDariIsi, pecahNaskahResmi, samaNomorPerkara } from "@/lib/naskah-putusan-resmi";
import { BATAS, type BentukTerima } from "@/lib/putusan-terjadwal";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { kenaliBentukNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";

/**
 * ============================================================================
 * BERKAS PUTUSAN TERJADWAL - PEMERIKSAAN ISI DAN PENYIMPANAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Berkas yang diseret petugas dibaca di sini SEBELUM dipasangkan ke perkara:
 *
 *   bentuk   dikenali dari KEPALA berkas, bukan dari nama (RTF/DOCX/DOC/PDF);
 *   nomor    nomor perkara dari ISI naskah - RTF, DOCX (document.xml), dan PDF
 *            (teks halaman awal); DOC lama tidak dibaca isinya;
 *   bukan    berita acara, penetapan hari sidang, dan relaas ditolak dengan
 *            namanya (sama dengan unggah naskah);
 *   bagian   pertimbangan hukum dan amar dapat dipotong dari naskah (RTF dan
 *            DOCX); bentuk lain diperiksa saat dijalankan.
 *
 * PENYIMPANAN. Berkas ditulis di <ALETA_UPLOAD_DIR>/putusan-terjadwal/<YYYYMM>/
 * <id>.<ekstensi> - folder yang di-mount ke luar container (volume uploads),
 * bukan lapisan container yang musnah tiap build. Nama asli petugas TIDAK
 * dipakai sebagai nama di cakram (hanya disimpan di basis data), jadi tidak ada
 * jalan keluar folder dan tidak ada nama yang bentrok. Pembacaan hanya lewat
 * jalur relatif yang sah bentuknya.
 *
 * Tidak ada yang ditulis ke SIPP dari sini.
 */

export const FOLDER_PENYIMPANAN = "putusan-terjadwal";
const POLA_JALUR = /^\d{6}\/[a-z0-9-]{8,80}\.(?:rtf|docx|doc|pdf)$/;
const BATAS_ISI_DOCX = 30 * 1024 * 1024;

export function akarPenyimpanan(env: Record<string, string | undefined> = process.env): string {
  const akar = String(env.ALETA_UPLOAD_DIR ?? "").trim();
  return akar ? path.join(akar, FOLDER_PENYIMPANAN) : path.join(process.cwd(), "uploads", FOLDER_PENYIMPANAN);
}

export const sha256 = (bita: Uint8Array) => createHash("sha256").update(bita).digest("hex");

export function ekstensiBentuk(bentuk: string): string {
  return bentuk === "docx" || bentuk === "doc" || bentuk === "pdf" ? bentuk : "rtf";
}

/** Jalur relatif sah (YYYYMM/id.ext) - tidak pernah berisi nama dari petugas. */
export function jalurSah(jalur: string): boolean {
  return POLA_JALUR.test(String(jalur ?? ""));
}

function mutlak(jalur: string, akar: string): string {
  if (!jalurSah(jalur)) throw new Error("Jalur berkas tidak sah.");
  const hasil = path.resolve(akar, jalur);
  const rel = path.relative(akar, hasil);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Jalur berkas keluar dari folder penyimpanan.");
  return hasil;
}

export async function simpanBerkas(
  id: string,
  bentuk: string,
  bita: Uint8Array,
  opsi: { akar?: string; kini?: Date } = {}
): Promise<string> {
  const akar = opsi.akar ?? akarPenyimpanan();
  const kini = opsi.kini ?? new Date();
  const jalur = `${kini.getUTCFullYear()}${String(kini.getUTCMonth() + 1).padStart(2, "0")}/${id.toLowerCase().replace(/[^a-z0-9-]/g, "")}.${ekstensiBentuk(bentuk)}`;
  const tujuan = mutlak(jalur, akar);
  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, bita);
  return jalur;
}

export async function bacaBerkas(jalur: string, akar: string = akarPenyimpanan()): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(mutlak(jalur, akar)));
  } catch {
    return null;
  }
}

export async function hapusBerkas(jalur: string, akar: string = akarPenyimpanan()): Promise<boolean> {
  try {
    await rm(mutlak(jalur, akar), { force: true });
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// DOCX tanpa pustaka: zip -> word/document.xml -> teks
// ──────────────────────────────────────────────────────────────────────────

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

/** Isi satu entri zip (dekompresi deflate/stored); null bila tidak ada atau rusak. */
export function bacaEntriZip(bita: Uint8Array, nama: string): Uint8Array | null {
  try {
    // End of central directory: tanda tangan 0x06054b50, dicari dari belakang.
    let eocd = -1;
    for (let i = bita.length - 22; i >= Math.max(0, bita.length - 22 - 65535); i -= 1) {
      if (u32(bita, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;
    const jumlah = u16(bita, eocd + 10);
    let o = u32(bita, eocd + 16);
    for (let n = 0; n < jumlah && o + 46 <= bita.length; n += 1) {
      if (u32(bita, o) !== 0x02014b50) return null;
      const metode = u16(bita, o + 10);
      const ukuranTerkompres = u32(bita, o + 20);
      const ukuranAsli = u32(bita, o + 24);
      const panjangNama = u16(bita, o + 28);
      const panjangExtra = u16(bita, o + 30);
      const panjangKomentar = u16(bita, o + 32);
      const lokal = u32(bita, o + 42);
      const namaEntri = Buffer.from(bita.subarray(o + 46, o + 46 + panjangNama)).toString("utf8");
      if (namaEntri === nama) {
        if (ukuranAsli > BATAS_ISI_DOCX) return null;
        if (u32(bita, lokal) !== 0x04034b50) return null;
        const mulai = lokal + 30 + u16(bita, lokal + 26) + u16(bita, lokal + 28);
        const data = bita.subarray(mulai, mulai + ukuranTerkompres);
        if (metode === 0) return new Uint8Array(data);
        if (metode === 8) return new Uint8Array(inflateRawSync(data, { maxOutputLength: BATAS_ISI_DOCX }));
        return null;
      }
      o += 46 + panjangNama + panjangExtra + panjangKomentar;
    }
  } catch {
    return null;
  }
  return null;
}

const ENTITAS: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Teks biasa dari docx: tiap paragraf satu baris; tab dan baris-paksa dipertahankan. */
export function teksDariDocx(bita: Uint8Array): string {
  const xml = bacaEntriZip(bita, "word/document.xml");
  if (!xml) return "";
  return Buffer.from(xml)
    .toString("utf8")
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
      if (e[0] === "#") {
        const kode = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(kode) && kode > 0 && kode < 0x110000 ? String.fromCodePoint(kode) : "";
      }
      return ENTITAS[e] ?? "";
    })
    .replace(/\u0000/g, "")
    .replace(/ /g, " ");
}

// ──────────────────────────────────────────────────────────────────────────
// Pemeriksaan berkas
// ──────────────────────────────────────────────────────────────────────────

export type PeriksaanBerkas = {
  ok: boolean;
  /** Kalimat untuk petugas bila ok = false. */
  tolak: string;
  bentuk: BentukTerima | "";
  ukuran: number;
  sha256: string;
  /** Nomor perkara dari ISI naskah ("" bila tidak terbaca / bentuk .doc). */
  nomorIsi: string;
  /** Apakah isinya dapat dibaca untuk pemeriksaan nomor/bagian. */
  isiDibaca: boolean;
  /** Pertimbangan hukum dan amar dapat dipotong (hanya bila isi dibaca penuh: RTF/DOCX). */
  bagianLengkap: boolean | null;
  peringatan: string[];
};

const PERINGATAN_BENTUK: Record<string, string> = {
  docx: "DOCX diubah menjadi RTF di server saat dijalankan; periksa tiap bagian bila tata letaknya khusus.",
  doc: "DOC lama diubah menjadi RTF di server saat dijalankan; isinya belum dapat diperiksa sekarang.",
  pdf: "PDF diubah lewat ekstraksi teks saat dijalankan; tata letak (tabel, kolom, kop) dapat berubah - lebih aman memakai RTF atau DOCX.",
};

/** Teks naskah dari bita berkas (RTF, DOCX, PDF halaman awal); DOC lama tidak terbaca. TIDAK PERNAH melempar. */
export async function teksBerkas(bita: Uint8Array, bentuk: string, nama = "putusan"): Promise<{ teks: string; pindaian: boolean }> {
  let teks = "";
  let pindaian = false;
  try {
    if (bentuk === "rtf") teks = bacaRtfDariBita(bita);
    else if (bentuk === "docx") teks = teksDariDocx(bita);
    else if (bentuk === "pdf") {
      const isi = await bacaPdfDariBita(bita, String(nama || "putusan.pdf"), 6);
      if (isi.ada) teks = isi.halaman.map((h) => h.teks).join("\n");
      if (isi.ada && isi.halaman.every((h) => !h.teks.trim())) pindaian = true;
    }
  } catch {
    teks = "";
  }
  return { teks: teks.replace(/\u0000/g, ""), pindaian };
}

/**
 * Memeriksa satu berkas yang diseret. TIDAK PERNAH melempar. Tidak menyentuh
 * SIPP, basis data, maupun cakram.
 */
export async function periksaBerkas(bita: Uint8Array, nama: string): Promise<PeriksaanBerkas> {
  const dasar: PeriksaanBerkas = {
    ok: false,
    tolak: "",
    bentuk: "",
    ukuran: bita?.length ?? 0,
    sha256: "",
    nomorIsi: "",
    isiDibaca: false,
    bagianLengkap: null,
    peringatan: [],
  };
  const tolak = (sebab: string): PeriksaanBerkas => ({ ...dasar, tolak: sebab });
  if (!bita || bita.length === 0) return tolak("Berkasnya kosong.");
  if (bita.length > BATAS.ukuranBerkas) {
    return tolak(`Ukuran berkas melampaui ${Math.round(BATAS.ukuranBerkas / 1024 / 1024)} MB. Putusan sebesar itu hampir pasti hasil pindaian, bukan naskah.`);
  }
  const bentuk = kenaliBentukNaskah(bita);
  if (!bentuk) return tolak("Isinya bukan RTF, DOCX, DOC, maupun PDF - dikenali dari kepala berkasnya, bukan dari namanya.");
  dasar.bentuk = bentuk;
  dasar.sha256 = sha256(bita);
  const peringatan: string[] = [];
  if (PERINGATAN_BENTUK[bentuk]) peringatan.push(PERINGATAN_BENTUK[bentuk]);
  if (/^~\$/.test(String(nama ?? ""))) return { ...dasar, tolak: "Berkas kunci sementara Word (~$), bukan naskah." };

  const baca = await teksBerkas(bita, bentuk, nama);
  if (baca.pindaian) return { ...dasar, tolak: "PDF ini tidak memuat teks (kemungkinan hasil pindaian) - tidak ada yang dapat dibaca sebagai naskah." };
  const teks = baca.teks;

  if (!teks.trim()) {
    if (bentuk !== "doc") peringatan.push("Isi berkas tidak terbaca sekarang; nomor perkara dan bagian putusan diperiksa saat dijalankan.");
    return { ...dasar, ok: true, peringatan };
  }
  const bukan = kenaliNaskahBukanPutusan(teks);
  if (bukan) {
    return { ...dasar, isiDibaca: true, tolak: `Berkas ini ${bukan.nama} ("${bukan.judul.slice(0, 80)}"), bukan naskah putusan.` };
  }
  const dariIsi = nomorPerkaraDariIsi(teks);
  let bagianLengkap: boolean | null = null;
  if (bentuk === "rtf" || bentuk === "docx") {
    const { bagian } = pecahNaskahResmi(teks);
    bagianLengkap = Boolean(bagian.pertimbangan && bagian.amar);
    if (!bagianLengkap) {
      peringatan.push("Pertimbangan hukum dan/atau amar tidak dapat dipotong dari naskah ini; pengisian formulir Putusan Akhir akan ditahan, e-Doc tetap dapat diunggah.");
    }
  }
  return { ...dasar, ok: true, nomorIsi: dariIsi.nomor, isiDibaca: true, bagianLengkap, peringatan };
}

/**
 * Isi berkas menunjuk perkara `nomorPerkara`? true bila nomor isi kosong
 * (tidak terbaca) atau sama; false hanya bila isi menyebut perkara LAIN -
 * berkas itu hampir pasti naskah perkara lain dan tidak pernah dipasang.
 */
export function isiCocokPerkara(nomorIsi: string, nomorPerkara: string): boolean {
  if (!String(nomorIsi ?? "").trim()) return true;
  return samaNomorPerkara(nomorIsi, nomorPerkara);
}
