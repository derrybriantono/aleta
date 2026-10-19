import { bacaGambar, mesinOcrAda, orientasiGambar } from "@/app/api/aleta-ecourt/saksi-scan/ocr";
import {
  ambilBerkasLampiranGateway,
  getGatewayAntrianLampiran,
  kirimHasilLampiranGateway,
  type BerkasLampiranAntri,
  type HasilBacaLampiran,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import { bacaPdfDariBita } from "./baca-pdf";
import { buatPembantuAnak, jenisBerkasKtp, type PembantuGambar } from "./ktp-ocr";
import { ktpPihakSedangMembaca } from "./ktp-pihak";

/**
 * ============================================================================
 * OCR-ECOURT (19 Okt 2026) - PEMBACA LATAR LAMPIRAN e-COURT
 * ============================================================================
 *
 * Isi SIPP & Input ABT tahap 2: isian ABT yang datanya tidak ada di SIPP tetapi ada di lampiran e-Court hasil pindai
 * (kartu keluarga, akta kelahiran/kematian/nikah/cerai, surat keterangan desa/KUA, surat kuasa, slip gaji).
 * Pola KTP-PIHAK (ktp-pihak.ts): bot menyimpan berkas, portal yang membaca (pdfjs + tesseract hanya ada di citra
 * portal), bot yang mengenali jenis, mengurai medan, mencocokkan pihak, dan menyimpan medan tanpa NIK
 * (aleta_bot/services/lampiranEcourtStoreService.js). Usulannya keluar di kanal "Isi dari SIPP & input ke ABT".
 *
 *   portal  GET  /sipp/lampiran-ecourt/antrian   satu berkas yang belum dibaca (perkara terbaru dulu)
 *   portal  GET  /sipp/lampiran-ecourt/berkas    isi berkasnya
 *   portal       bacaLampiran: lapisan teks PDF; halaman tanpa teks di-OCR (tesseract ind, psm 3), halaman yang
 *                hasilnya kacau dicek arahnya (OSD) dan dibaca ulang setelah diputar
 *   portal  POST /sipp/lampiran-ecourt           teks per halaman (bot membuang teksnya sesudah diurai)
 *
 * BEBAN SERVER (OCR berjalan di server, bot tidak boleh terhambat):
 *   - SATU berkas sekali (wadah.jalan), bawaan 1 berkas per putaran, jeda bawaan 180 detik;
 *   - tidak berjalan selama penyapu KTP sedang membaca (dua OCR tidak bertumpuk);
 *   - berkas > 15 MB tidak dibaca; paling banyak 12 halaman (surat kuasa 4); paling lama 150 detik per berkas dan
 *     25 detik per lintasan OCR; proses tesseract dimatikan bila lewat batas;
 *   - hasil di-cache per berkas di bot (versi aturan): berkas yang sudah dibaca tidak di-OCR lagi; isi sama di
 *     perkara lain memakai bacaan yang sama;
 *   - semua OCR di proses anak (tesseract, ktp-gambar.mjs) - proses portal tidak ikut mati bila berkasnya rusak.
 *   ALETA_LAMPIRAN_LATAR=0 mematikan penyapu; ALETA_LAMPIRAN_BATAS (1-3), ALETA_LAMPIRAN_JEDA_MS (>= 60000).
 *
 * TIDAK ADA YANG DITULIS KE SIPP/ABT/e-COURT. Bufer berkas dan gambar ditimpa nol sesudah dibaca; teks tidak dicatat.
 */

export const BATAS_BITA_LAMPIRAN = 15 * 1024 * 1024;
export const BATAS_HALAMAN_LAMPIRAN = 12;
export const BATAS_HALAMAN_KUASA = 4;
export const BATAS_BACA_MS = 150_000;
export const BATAS_OCR_HALAMAN_MS = 25_000;
export const BATAS_TEKS_HALAMAN = 12_000;
/** Halaman berteks bila lapisan teksnya >= 100 huruf/angka. */
const TEKS_PDF_CUKUP = 100;
/** Kata wajar di bawah ini = hasil OCR kacau (miring/terbalik) -> cek arah. */
const SKOR_TEGAK = 25;

const POLA_KUASA = /kuasa/i;

/** Jumlah kata yang wajar (>= 3 huruf, bervokal, tanpa deret konsonan panjang) - penilai hasil OCR. Murni. */
export function skorTeks(teks: string): number {
  let n = 0;
  for (const k of String(teks || "").split(/[^A-Za-z]+/)) {
    if (k.length < 3 || k.length > 20) continue;
    if (!/[aiueoAIUEO]/.test(k)) continue;
    if (/[^aiueoAIUEO]{4,}/.test(k)) continue;
    n += 1;
  }
  return n;
}

export type DepsBacaLampiran = {
  spawn?: Parameters<typeof bacaGambar>[1];
  pembantu?: PembantuGambar;
  sekarang?: () => number;
};

export type HasilBacaBerkas = {
  status: "terbaca" | "tidak_terbaca";
  sebab: string;
  halaman: Array<{ teks: string; sumber: "teks-pdf" | "ocr" }>;
  halamanOcr: number;
};

const pembantuLampiran: PembantuGambar = buatPembantuAnak(BATAS_HALAMAN_LAMPIRAN);

async function ocrHalaman(png: Buffer, batasSampai: number, deps: DepsBacaLampiran): Promise<{ teks: string; gagal?: string }> {
  const sekarang = deps.sekarang ?? Date.now;
  const sisa = () => batasSampai - sekarang();
  if (sisa() < 3000) return { teks: "", gagal: "ocr_habis_waktu" };
  const r = await bacaGambar(png, deps.spawn, { psm: "3", batasMs: Math.min(BATAS_OCR_HALAMAN_MS, sisa()) });
  if (!r.ok) return { teks: "", gagal: r.alasan };
  let terbaik = { teks: r.teks, skor: skorTeks(r.teks) };
  if (terbaik.skor >= SKOR_TEGAK || sisa() < 12_000) return { teks: terbaik.teks };
  const arah = await orientasiGambar(png, deps.spawn, Math.min(8000, sisa()));
  if (!arah) return { teks: terbaik.teks };
  const pembantu = deps.pembantu ?? pembantuLampiran;
  // OSD menyebut arah putar; bila hasilnya tidak lebih baik, arah sebaliknya dicoba sekali (kartu keluarga melintang).
  const coba = arah === 180 ? [180] : [arah, arah === 90 ? 270 : 90];
  for (const d of coba) {
    if (sisa() < 8000) break;
    const g = await pembantu(`putar${d}` as "putar90" | "putar180" | "putar270", png, Math.min(15_000, sisa()));
    const diputar = g?.get("putar");
    if (!diputar) break;
    const r2 = await bacaGambar(diputar, deps.spawn, { psm: "3", batasMs: Math.min(BATAS_OCR_HALAMAN_MS, sisa()) });
    diputar.fill(0);
    if (!r2.ok) break;
    const s2 = skorTeks(r2.teks);
    if (s2 > terbaik.skor) terbaik = { teks: r2.teks, skor: s2 };
    if (s2 >= SKOR_TEGAK) break;
  }
  return { teks: terbaik.teks };
}

/**
 * Satu berkas lampiran -> teks per halaman. PDF berteks dibaca langsung; halaman pindaian di-OCR. Tidak melempar.
 */
export async function bacaLampiran(
  data: Buffer,
  { judul = "", batasMs = BATAS_BACA_MS, ...deps }: { judul?: string; batasMs?: number } & DepsBacaLampiran = {}
): Promise<HasilBacaBerkas> {
  const sekarang = deps.sekarang ?? Date.now;
  const batasSampai = sekarang() + batasMs;
  const maksHalaman = POLA_KUASA.test(judul) ? BATAS_HALAMAN_KUASA : BATAS_HALAMAN_LAMPIRAN;
  const kosong = (sebab: string): HasilBacaBerkas => ({ status: "tidak_terbaca", sebab, halaman: [], halamanOcr: 0 });
  const jenis = jenisBerkasKtp(data);
  if (!jenis) return kosong("format_tidak_dikenal");
  const pembantu = deps.pembantu ?? pembantuLampiran;
  const halaman: HasilBacaBerkas["halaman"] = [];
  let halamanOcr = 0;
  let gagal = "";
  if (jenis === "pdf") {
    const isi = await bacaPdfDariBita(new Uint8Array(data), "lampiran.pdf", maksHalaman).catch(() => null);
    if (!isi || !isi.ada || !isi.jumlahHalaman) return kosong("pdf_rusak");
    const teksHal = isi.halaman.slice(0, maksHalaman).map((h) => String(h.teks || "").slice(0, BATAS_TEKS_HALAMAN));
    const perluOcr = teksHal.map((t) => t.replace(/\s/g, "").length < TEKS_PDF_CUKUP);
    teksHal.forEach((t, i) => {
      if (!perluOcr[i]) halaman[i] = { teks: t, sumber: "teks-pdf" };
    });
    if (perluOcr.some(Boolean)) {
      if (!(await mesinOcrAda(deps.spawn))) gagal = "ocr_belum_tersedia";
      else {
        const gambar = await pembantu("pdf", data, Math.min(60_000, batasSampai - sekarang()));
        if (!gambar) gagal = "pdf_tanpa_kanvas";
        else {
          try {
            for (let i = 0; i < teksHal.length; i += 1) {
              if (!perluOcr[i]) continue;
              const png = gambar.get(`hal${i + 1}-abu`);
              if (!png) continue;
              const r = await ocrHalaman(png, batasSampai, deps);
              if (r.gagal) gagal = r.gagal;
              halaman[i] = { teks: r.teks.slice(0, BATAS_TEKS_HALAMAN), sumber: "ocr" };
              halamanOcr += 1;
              if (r.gagal === "ocr_habis_waktu" || r.gagal === "ocr_belum_tersedia") break;
            }
          } finally {
            for (const b of gambar.values()) b.fill(0);
          }
        }
      }
    }
  } else {
    if (!(await mesinOcrAda(deps.spawn))) return kosong("ocr_belum_tersedia");
    const g = await pembantu("gambar", data, Math.min(20_000, batasSampai - sekarang()));
    const png = g?.get("abu") ?? data;
    try {
      const r = await ocrHalaman(png, batasSampai, deps);
      if (r.gagal) gagal = r.gagal;
      halaman[0] = { teks: r.teks.slice(0, BATAS_TEKS_HALAMAN), sumber: "ocr" };
      halamanOcr = 1;
    } finally {
      if (g) for (const b of g.values()) b.fill(0);
    }
  }
  // Halaman yang tak sempat dibaca diisi kosong agar nomor halaman tetap sesuai berkas.
  const rapat = Array.from({ length: halaman.length }, (_, i) => halaman[i] ?? { teks: "", sumber: "ocr" as const });
  const ada = rapat.some((h) => h.teks.replace(/\s/g, "").length >= 40);
  if (!ada) return { ...kosong(gagal || "tidak_terbaca"), halamanOcr };
  return { status: "terbaca", sebab: gagal, halaman: rapat, halamanOcr };
}

// ---------------------------------------------------------------------------
// Putaran + penyapu latar
// ---------------------------------------------------------------------------

export type DepsLampiran = {
  antrian: (nomor: string[], batas: number) => Promise<{ berkas: BerkasLampiranAntri[]; versi: number } | null>;
  ambil: (fileId: string) => Promise<Buffer | null>;
  kirim: (hasil: HasilBacaLampiran[]) => Promise<boolean>;
  baca: (data: Buffer, judul: string, batasMs: number) => Promise<HasilBacaBerkas>;
  sekarang: () => number;
  /** Penyapu KTP sedang membaca: lampiran menunggu (dua OCR tidak bertumpuk). */
  ocrLainSibuk: () => boolean;
};

export const depsLampiranAsli: DepsLampiran = {
  antrian: async (nomor, batas) => {
    const r = await getGatewayAntrianLampiran({ nomor, batas });
    return r.ok ? { berkas: r.data?.berkas ?? [], versi: Number(r.data?.versi) || 1 } : null;
  },
  ambil: async (fileId) => {
    const pembatal = new AbortController();
    const jam = setTimeout(() => pembatal.abort(), 30_000);
    try {
      const r = await ambilBerkasLampiranGateway(fileId, pembatal.signal);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    } finally {
      clearTimeout(jam);
    }
  },
  kirim: async (hasil) => (await kirimHasilLampiranGateway(hasil)).ok,
  baca: (data, judul, batasMs) => bacaLampiran(data, { judul, batasMs }),
  sekarang: () => Date.now(),
  ocrLainSibuk: () => ktpPihakSedangMembaca(),
};

/** Satu putaran: antrian -> baca per berkas -> kirim SATU PER SATU. Berhenti bila waktunya habis. */
export async function pindaiLampiran(
  nomor: string[],
  deps: DepsLampiran = depsLampiranAsli,
  { batas = 1, batasMs = 200_000, batasBacaMs = BATAS_BACA_MS }: { batas?: number; batasMs?: number; batasBacaMs?: number } = {}
): Promise<{ dibaca: number; terbaca: number; terkirim: boolean; antrianTerjangkau: boolean }> {
  const mulai = deps.sekarang();
  const isi = await deps.antrian(nomor, Math.min(Math.max(1, batas), 3));
  if (!isi) return { dibaca: 0, terbaca: 0, terkirim: false, antrianTerjangkau: false };
  let dibaca = 0;
  let terbaca = 0;
  let terkirim = true;
  for (const berkas of isi.berkas.slice(0, Math.min(Math.max(1, batas), 3))) {
    if (deps.sekarang() - mulai > batasMs) break;
    if (deps.ocrLainSibuk()) break;
    const t0 = deps.sekarang();
    let hasil: HasilBacaLampiran;
    if (berkas.ukuran > BATAS_BITA_LAMPIRAN) {
      hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "berkas_terlalu_besar", versi: isi.versi, halaman: [], lamaMs: 0 };
    } else {
      const data = await deps.ambil(berkas.fileId);
      if (!data) hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "berkas_tidak_terambil", versi: isi.versi, halaman: [], lamaMs: 0 };
      else {
        try {
          const b = await deps.baca(data, berkas.judul, batasBacaMs);
          hasil = { fileId: berkas.fileId, status: b.status, sebab: b.sebab, versi: isi.versi, halaman: b.halaman, lamaMs: deps.sekarang() - t0 };
        } catch {
          hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "galat_baca", versi: isi.versi, halaman: [], lamaMs: deps.sekarang() - t0 };
        } finally {
          data.fill(0);
        }
      }
    }
    dibaca += 1;
    if (hasil.status === "terbaca") terbaca += 1;
    if (!(await deps.kirim([hasil]))) terkirim = false;
    for (const h of hasil.halaman) h.teks = "";
  }
  return { dibaca, terbaca, terkirim, antrianTerjangkau: true };
}

type Wadah = { jalan: boolean; detak: NodeJS.Timeout | null; terakhirJalan: number; terakhir: { mulaiPada: string; dibaca: number; terbaca: number } | null };
const SIMPAN = globalThis as unknown as { __aletaLampiranEcourt?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaLampiranEcourt ??= { jalan: false, detak: null, terakhirJalan: 0, terakhir: null };
  return SIMPAN.__aletaLampiranEcourt;
}

/** Hanya untuk uji. */
export function aturUlangLampiran() {
  const w = wadah();
  if (w.detak) clearInterval(w.detak);
  SIMPAN.__aletaLampiranEcourt = { jalan: false, detak: null, terakhirJalan: 0, terakhir: null };
}

export function lampiranSedangMembaca(): boolean {
  return wadah().jalan;
}

/** Satu putaran bila tidak ada putaran lain di proses ini (SATU berkas sekali). null = sibuk. */
export async function putaranLampiran(nomor: string[], deps: DepsLampiran = depsLampiranAsli, opsi?: { batas?: number; batasMs?: number; batasBacaMs?: number }) {
  const w = wadah();
  if (w.jalan || deps.ocrLainSibuk()) return null;
  w.jalan = true;
  const mulaiPada = new Date().toISOString();
  try {
    const hasil = await pindaiLampiran(nomor, deps, opsi);
    w.terakhir = { mulaiPada, dibaca: hasil.dibaca, terbaca: hasil.terbaca };
    return hasil;
  } catch {
    return null;
  } finally {
    w.jalan = false;
  }
}

/** Pengaturan penyapu dari env (murni). */
export function pengaturanLampiran(env: NodeJS.ProcessEnv = process.env) {
  const aktif = String(env.ALETA_LAMPIRAN_LATAR ?? "1").trim() !== "0";
  const batas = Math.min(3, Math.max(1, Math.floor(Number(env.ALETA_LAMPIRAN_BATAS) || 1)));
  const jedaMs = Math.max(60_000, Math.floor(Number(env.ALETA_LAMPIRAN_JEDA_MS) || 180_000));
  return { aktif, batas, jedaMs };
}

export const DETAK_LAMPIRAN_MS = 30_000;

/** Detak penyapu latar: dinyalakan instrumentation.ts sekali saat portal berdiri. */
export function mulaiPindaiLampiranBerkala(deps: DepsLampiran = depsLampiranAsli, env: NodeJS.ProcessEnv = process.env) {
  const w = wadah();
  if (w.detak) return false;
  const p = pengaturanLampiran(env);
  if (!p.aktif) return false;
  w.terakhirJalan = Date.now();
  w.detak = setInterval(() => {
    if (Date.now() - w.terakhirJalan < p.jedaMs - 1000) return;
    if (w.jalan || deps.ocrLainSibuk()) return;
    w.terakhirJalan = Date.now();
    void putaranLampiran([], deps, { batas: p.batas }).catch(() => undefined);
  }, DETAK_LAMPIRAN_MS);
  w.detak.unref?.();
  return true;
}
