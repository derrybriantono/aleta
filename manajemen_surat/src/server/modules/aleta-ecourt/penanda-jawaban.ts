import { spawn as spawnAsli } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { bacaGambar, mesinOcrAda } from "@/app/api/aleta-ecourt/saksi-scan/ocr";
import {
  deteksiEksepsiRekonvensi,
  teksTerbaca,
  VERSI_DETEKSI_JAWABAN,
} from "@/lib/deteksi-eksepsi-rekonvensi";
import {
  ambilBerkasJawabanGateway,
  getGatewayAntrianJawaban,
  kirimHasilJawabanGateway,
  type BerkasJawabanAntri,
  type HasilBacaJawaban,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import { bacaPdfDariBita } from "./baca-pdf";
import { bacaBerkas } from "./berkas-gugatan";
import { uraiBingkai } from "./ktp-ocr";

/**
 * ============================================================================
 * PEMBACA JAWABAN / DUPLIK TERGUGAT UNTUK PENANDA EKSEPSI & REKONVENSI
 * (butir 4, 6 Okt 2026)
 * ============================================================================
 *
 * Bot menyimpan berkas e-Court tetapi tidak dapat membacanya (pdfjs-dist dan
 * tesseract hanya ada di citra portal). Jadi portal yang membaca, lalu
 * menyerahkan hasilnya kembali ke bot untuk disinggahkan PER BERKAS - jadwal
 * sidang berikutnya membaca singgahan itu dengan satu kueri, tanpa membuka
 * satu berkas pun.
 *
 * DIUKUR atas arsip satker 6 Okt 2026: 23 dokumen jawaban/duplik Tergugat,
 * 46 berkas. "Word" dari e-Court ternyata DOCX (PK..) walau namanya .pdf -
 * jenisnya dikenali dari bait awal, bukan dari nama.
 *
 *   lapisan teks (PDF/DOCX)   14 dari 23 dokumen terbaca
 *   + OCR (tesseract ind)     23 dari 23 - 8 lewat halaman PDF, 1 lewat gambar
 *                             di dalam DOCX (PDF-nya tergambar putih polos)
 *
 * OCR dijalankan HANYA bila lapisan teksnya kosong, paling banyak 5 halaman
 * PDF (batas skrip ktp-gambar.mjs) atau 6 gambar DOCX, 2-19 detik per dokumen
 * di server. Tanpa mesin OCR, pindaian dicatat "tidak terbaca" - BUKAN "tidak
 * ada eksepsi" - dan dicoba lagi bot sehari kemudian.
 *
 * Pemindaian berjalan di LATAR: dipicu rute jadwal sidang (picuPindaiJawaban)
 * tanpa ditunggu, satu putaran sekaligus per proses, berjeda. Layar yang
 * dimuat berikutnya membaca hasilnya.
 */

export type JenisIsi = "pdf" | "docx" | "rtf" | "doc";

/** Jenis berkas dari bait awalnya. */
export function jenisIsi(b: Uint8Array): JenisIsi | null {
  const awal = Buffer.from(b.subarray(0, 8));
  if (awal.length >= 4 && awal[0] === 0x50 && awal[1] === 0x4b) return "docx";
  if (Buffer.from(b.subarray(0, 1024)).toString("latin1").includes("%PDF-")) return "pdf";
  if (awal.toString("latin1").startsWith("{\\rtf")) return "rtf";
  if (awal.length >= 4 && awal.readUInt32BE(0) === 0xd0cf11e0) return "doc";
  return null;
}

/** Gambar JPEG/PNG di dalam DOCX (word/media/...) - jawaban yang dipindai lalu ditempel ke Word. */
export function gambarDariDocx(data: Buffer, batas = 6): Buffer[] {
  let akhir = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 66_000); i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      akhir = i;
      break;
    }
  }
  if (akhir < 0) return [];
  const jumlah = data.readUInt16LE(akhir + 10);
  let pos = data.readUInt32LE(akhir + 16);
  const temuan: Array<{ nama: string; isi: Buffer }> = [];
  for (let n = 0; n < jumlah && pos + 46 <= data.length; n += 1) {
    if (data.readUInt32LE(pos) !== 0x02014b50) break;
    const metode = data.readUInt16LE(pos + 10);
    const padat = data.readUInt32LE(pos + 20);
    const pNama = data.readUInt16LE(pos + 28);
    const pTambah = data.readUInt16LE(pos + 30);
    const pKomentar = data.readUInt16LE(pos + 32);
    const kepala = data.readUInt32LE(pos + 42);
    const nama = data.toString("utf8", pos + 46, pos + 46 + pNama);
    pos += 46 + pNama + pTambah + pKomentar;
    if (!/^word\/media\/.+\.(jpe?g|png)$/i.test(nama) || kepala + 30 > data.length) continue;
    const awal = kepala + 30 + data.readUInt16LE(kepala + 26) + data.readUInt16LE(kepala + 28);
    const mentah = data.subarray(awal, awal + padat);
    try {
      const isi = metode === 0 ? Buffer.from(mentah) : metode === 8 ? inflateRawSync(mentah) : null;
      if (isi && isi.length > 20_000) temuan.push({ nama, isi });
    } catch {
      /* gambar rusak dilewati */
    }
  }
  // image1, image2, ..., image10 - urutan halaman, bukan urutan abjad.
  const nomor = (x: string) => Number(/(\d+)\.\w+$/.exec(x)?.[1] ?? 0);
  return temuan.sort((a, b) => nomor(a.nama) - nomor(b.nama)).slice(0, batas).map((x) => x.isi);
}

/** Halaman PDF -> PNG abu-abu terpraproses, lewat proses anak ktp-gambar.mjs (paling banyak 5). */
function gambarHalamanPdf(data: Buffer, batasMs: number): Promise<Buffer[]> {
  return new Promise((selesai) => {
    const skrip = path.join(process.cwd(), "scripts", "ktp-gambar.mjs");
    if (!existsSync(skrip)) return selesai([]);
    let anak: ReturnType<typeof spawnAsli>;
    try {
      anak = spawnAsli(process.execPath, [skrip, "pdf", "5"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    } catch {
      return selesai([]);
    }
    const keluar: Buffer[] = [];
    let sudah = false;
    const akhiri = (x: Buffer[]) => {
      if (sudah) return;
      sudah = true;
      clearTimeout(jam);
      selesai(x);
    };
    const jam = setTimeout(() => {
      try {
        anak.kill("SIGKILL");
      } catch {
        /* sudah mati */
      }
      akhiri([]);
    }, batasMs);
    anak.stdout?.on("data", (x: Buffer) => keluar.push(x));
    anak.on("error", () => akhiri([]));
    anak.on("close", (kode) => {
      if (kode !== 0) return akhiri([]);
      const peta = uraiBingkai(Buffer.concat(keluar));
      akhiri([...peta.entries()].filter(([label]) => label.endsWith("-abu")).map(([, png]) => png));
    });
    anak.stdin?.on("error", () => undefined);
    anak.stdin?.end(data);
  });
}

export type DepsBaca = {
  ocrAda: () => Promise<boolean>;
  /** Satu gambar -> teks (tesseract). */
  ocrGambar: (gambar: Buffer) => Promise<string>;
  /** PDF -> gambar halaman. */
  halamanPdf: (data: Buffer) => Promise<Buffer[]>;
};

const depsBacaAsli: DepsBaca = {
  ocrAda: () => mesinOcrAda(),
  ocrGambar: async (g) => {
    // psm 4: satu kolom teks bersambung - bentuk surat jawaban.
    const h = await bacaGambar(g, undefined, { psm: "4", batasMs: 25_000 });
    return h.ok ? h.teks : "";
  },
  halamanPdf: (d) => gambarHalamanPdf(d, 60_000),
};

export type TeksJawaban = { teks: string; sumber: "teks" | "ocr" | ""; sebab: string };

/** Satu berkas -> teks: lapisan teks lebih dulu, OCR bila kosong. */
export async function bacaTeksJawaban(data: Buffer, deps: DepsBaca = depsBacaAsli): Promise<TeksJawaban> {
  const jenis = jenisIsi(data);
  if (!jenis) return { teks: "", sumber: "", sebab: "jenis_berkas_tidak_dikenal" };

  let teks = "";
  if (jenis === "pdf") {
    const isi = await bacaPdfDariBita(new Uint8Array(data), "berkas.pdf", 60);
    teks = isi.halaman.map((h) => h.teks).join("\n\n");
  } else {
    const h = await bacaBerkas(`berkas.${jenis}`, data);
    teks = h.teks;
  }
  if (teksTerbaca(teks)) return { teks, sumber: "teks", sebab: "" };

  // Pindaian. Hanya PDF dan DOCX bergambar yang dapat di-OCR.
  if (jenis !== "pdf" && jenis !== "docx") return { teks: "", sumber: "", sebab: "teks_kosong" };
  if (!(await deps.ocrAda())) return { teks: "", sumber: "", sebab: "pindaian_ocr_belum_tersedia" };
  const gambar = jenis === "pdf" ? await deps.halamanPdf(data) : gambarDariDocx(data);
  if (gambar.length === 0) return { teks: "", sumber: "", sebab: jenis === "pdf" ? "halaman_pdf_tidak_tergambar" : "teks_kosong" };
  const bagian: string[] = [];
  for (const g of gambar) bagian.push(await deps.ocrGambar(g));
  const hasil = bagian.join("\n\n");
  if (teksTerbaca(hasil)) return { teks: hasil, sumber: "ocr", sebab: "" };
  return { teks: "", sumber: "", sebab: "ocr_tidak_menghasilkan_teks" };
}

/** Teks (sudah dibaca) -> hasil yang disimpan bot. */
export function hasilDariTeks(fileId: string, judul: string, t: TeksJawaban): HasilBacaJawaban {
  const terbaca = Boolean(t.sumber) && teksTerbaca(t.teks);
  const d = terbaca ? deteksiEksepsiRekonvensi(t.teks, judul) : null;
  return {
    fileId,
    terbaca,
    sumber: terbaca ? t.sumber : "",
    panjang: terbaca ? t.teks.length : 0,
    eksepsi: d?.eksepsi.keadaan ?? "",
    kalimatEksepsi: d?.eksepsi.kalimat ?? "",
    rekonvensi: d?.rekonvensi.keadaan ?? "",
    kalimatRekonvensi: d?.rekonvensi.kalimat ?? "",
    sebab: terbaca ? "" : t.sebab || "tidak_terbaca",
    versi: VERSI_DETEKSI_JAWABAN,
  };
}

export type DepsPindai = DepsBaca & {
  antrian: (nomor: string[]) => Promise<BerkasJawabanAntri[] | null>;
  ambil: (fileId: string) => Promise<Buffer | null>;
  kirim: (hasil: HasilBacaJawaban[]) => Promise<boolean>;
  sekarang: () => number;
};

const depsPindaiAsli: DepsPindai = {
  ...depsBacaAsli,
  antrian: async (nomor) => {
    const r = await getGatewayAntrianJawaban({ nomor, batas: 12, versi: VERSI_DETEKSI_JAWABAN });
    return r.ok ? (r.data?.berkas ?? []) : null;
  },
  ambil: async (fileId) => {
    const pembatal = new AbortController();
    const jam = setTimeout(() => pembatal.abort(), 30_000);
    try {
      const r = await ambilBerkasJawabanGateway(fileId, pembatal.signal);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    } finally {
      clearTimeout(jam);
    }
  },
  kirim: async (hasil) => (await kirimHasilJawabanGateway(hasil)).ok,
  sekarang: () => Date.now(),
};

/** Batas ukuran berkas yang dibaca (sama dengan pembaca berkas gugatan). */
const BATAS_BITA = 20 * 1024 * 1024;

/**
 * Satu putaran: ambil antrian, baca per DOKUMEN (OCR paling banyak sekali per
 * dokumen - berkas PDF lebih dulu, gambar DOCX bila PDF-nya tidak tergambar),
 * kirim hasil per berkas. Berhenti bila waktunya habis; sisanya putaran
 * berikutnya.
 */
export async function pindaiPenandaJawaban(
  nomor: string[],
  deps: DepsPindai = depsPindaiAsli,
  batasMs = 120_000
): Promise<{ dibaca: number; terbaca: number; terkirim: boolean }> {
  const mulai = deps.sekarang();
  const daftar = await deps.antrian(nomor);
  if (!daftar || daftar.length === 0) return { dibaca: 0, terbaca: 0, terkirim: true };

  const perDokumen = new Map<string, BerkasJawabanAntri[]>();
  for (const b of daftar) perDokumen.set(b.documentKey, [...(perDokumen.get(b.documentKey) ?? []), b]);

  const hasil: HasilBacaJawaban[] = [];
  for (const berkas of perDokumen.values()) {
    if (deps.sekarang() - mulai > batasMs) break;
    // PDF lebih dulu: halaman PDF yang di-OCR lebih utuh daripada gambar tempelan di DOCX.
    const urut = berkas.slice().sort((a, b) => (a.format === "pdf" ? 0 : 1) - (b.format === "pdf" ? 0 : 1));
    const isi = new Map<string, Buffer | null>();
    const teks = new Map<string, TeksJawaban>();
    // 1. Lapisan teks seluruh berkas dokumen ini (murah) - tanpa OCR.
    const tanpaOcr: DepsBaca = { ...deps, ocrAda: async () => false };
    for (const b of urut) {
      const terlaluBesar = b.ukuran > BATAS_BITA;
      const data = terlaluBesar ? null : await deps.ambil(b.fileId);
      isi.set(b.fileId, data);
      teks.set(
        b.fileId,
        data
          ? await bacaTeksJawaban(data, tanpaOcr)
          : { teks: "", sumber: "", sebab: terlaluBesar ? "berkas_terlalu_besar" : "berkas_tidak_terambil" }
      );
    }
    // 2. Tidak satu pun terbaca: OCR, satu berkas saja (yang pertama berhasil).
    if (![...teks.values()].some((t) => t.sumber)) {
      for (const b of urut) {
        const data = isi.get(b.fileId);
        if (!data) continue;
        const t = await bacaTeksJawaban(data, deps);
        if (t.sumber) {
          // Teks yang sama berlaku bagi berkas lain dokumen ini (PDF dan DOCX-nya isi yang sama).
          for (const lain of urut) teks.set(lain.fileId, t);
          break;
        }
        teks.set(b.fileId, t);
        if (t.sebab === "pindaian_ocr_belum_tersedia") break;
      }
    }
    for (const b of urut) hasil.push(hasilDariTeks(b.fileId, b.judul, teks.get(b.fileId)!));
    for (const data of isi.values()) data?.fill(0);
  }
  const terkirim = hasil.length ? await deps.kirim(hasil) : true;
  return { dibaca: hasil.length, terbaca: hasil.filter((h) => h.terbaca).length, terkirim };
}

// ---------------------------------------------------------------------------
// PEMICU DARI RUTE JADWAL SIDANG
// ---------------------------------------------------------------------------

/** Jeda antarputaran: layar jadwal memuat ulang berkala, pemindaian tidak perlu ikut. */
export const JEDA_PINDAI_MS = 60_000;

let sedangBerjalan = false;
let terakhirMulai = 0;

/**
 * Tanpa ditunggu: jadwal tidak pernah menunggu pembacaan berkas. Paling
 * banyak satu putaran per proses, dan paling cepat sekali semenit. Galat
 * ditelan - penanda hanya tidak muncul, jadwalnya tetap.
 */
export function picuPindaiJawaban(nomor: string[], deps: DepsPindai = depsPindaiAsli): boolean {
  const kini = deps.sekarang();
  if (sedangBerjalan || kini - terakhirMulai < JEDA_PINDAI_MS) return false;
  sedangBerjalan = true;
  terakhirMulai = kini;
  void pindaiPenandaJawaban(nomor, deps)
    .catch(() => undefined)
    .finally(() => {
      sedangBerjalan = false;
    });
  return true;
}

/** Hanya untuk uji. */
export function aturUlangPemicu() {
  sedangBerjalan = false;
  terakhirMulai = 0;
}
