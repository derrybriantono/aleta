import { spawn as spawnAsli, type ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * ============================================================================
 * MESIN OCR - JUJUR BILA TIDAK ADA
 * ============================================================================
 *
 * Perbaikan 2 Okt 2026 butir 16. Diperiksa 2 Okt 2026: TIDAK ADA pustaka OCR di
 * repo (package.json portal maupun bot; tidak ada tesseract.js, tidak ada
 * biner tesseract di citra Docker portal/bot). Menambah tesseract.js (WASM +
 * data bahasa puluhan MB) atau mengirim foto KTP ke penyedia AI di luar
 * kantor adalah keputusan pengguna - bukan keputusan agen - jadi keduanya
 * TIDAK dikerjakan di sini.
 *
 * Yang dikerjakan: bila server SUDAH punya biner tesseract (dipasang admin,
 * mis. `apt-get install tesseract-ocr tesseract-ocr-ind` di citra portal, atau
 * jalurnya disebut lewat ALETA_OCR_TESSERACT), gambar dibaca dengan biner itu
 * lewat stdin/stdout - TANPA berkas sementara. Bila tidak ada, jawabannya
 * terus terang "belum dapat membaca gambar", dan petugas tetap dapat
 * mengetik/menempel teks KTP-nya.
 *
 * FOTO KTP TIDAK PERNAH DISIMPAN: bufer diterima di memori, dialirkan ke stdin
 * tesseract, lalu ditimpa nol oleh pemanggil (lihat route.ts). Tidak ada
 * berkas, tidak ada arsip, tidak ada log isi.
 */

export type HasilOcr =
  | { ok: true; teks: string; mesin: string }
  | { ok: false; alasan: "ocr_belum_tersedia" | "ocr_gagal" | "ocr_habis_waktu"; pesan: string };

type Spawn = (perintah: string, argumen: string[]) => ChildProcessWithoutNullStreams;

export const PESAN_OCR_BELUM_ADA =
  "ALETA belum dapat membaca gambar: mesin OCR belum terpasang di server. " +
  "Ketik atau tempel teks KTP di kotak teks, atau isi blangko SIPP seperti biasa.";

const BATAS_WAKTU_MS = 25_000;
const UMUR_PERIKSA_MS = 10 * 60 * 1000;

let singgahMesin: { ada: boolean; bin: string; sampai: number } | null = null;

/** Untuk uji: lupakan hasil pemeriksaan mesin. */
export function lupakanMesinOcr() {
  singgahMesin = null;
}

function binTesseract(): string {
  return String(process.env.ALETA_OCR_TESSERACT || "tesseract").trim() || "tesseract";
}

function jalankan(
  spawn: Spawn,
  bin: string,
  argumen: string[],
  masukan: Buffer | null,
  batasMs: number
): Promise<{ kode: number | null; keluar: string; galatTeks: string; habisWaktu: boolean; tidakAda: boolean }> {
  return new Promise((selesai) => {
    let anak: ChildProcessWithoutNullStreams;
    try {
      anak = spawn(bin, argumen);
    } catch {
      selesai({ kode: null, keluar: "", galatTeks: "", habisWaktu: false, tidakAda: true });
      return;
    }
    const keluar: Buffer[] = [];
    const galat: Buffer[] = [];
    let habisWaktu = false;
    let tidakAda = false;
    const jam = setTimeout(() => {
      habisWaktu = true;
      try {
        anak.kill("SIGKILL");
      } catch {
        /* sudah mati */
      }
    }, batasMs);
    anak.stdout.on("data", (x: Buffer) => keluar.push(x));
    anak.stderr.on("data", (x: Buffer) => galat.push(x));
    anak.on("error", (e: NodeJS.ErrnoException) => {
      if (e && e.code === "ENOENT") tidakAda = true;
    });
    anak.on("close", (kode) => {
      clearTimeout(jam);
      selesai({
        kode,
        keluar: Buffer.concat(keluar).toString("utf8"),
        galatTeks: Buffer.concat(galat).toString("utf8").slice(0, 400),
        habisWaktu,
        tidakAda,
      });
    });
    try {
      anak.stdin.on("error", () => undefined);
      if (masukan) anak.stdin.end(masukan);
      else anak.stdin.end();
    } catch {
      /* proses gagal lahir - ditangani 'error' */
    }
  });
}

/** Apakah server punya mesin OCR? Diperiksa sekali tiap sepuluh menit. */
export async function mesinOcrAda(spawn: Spawn = spawnAsli as unknown as Spawn): Promise<boolean> {
  const bin = binTesseract();
  if (singgahMesin && singgahMesin.bin === bin && singgahMesin.sampai > Date.now()) return singgahMesin.ada;
  const r = await jalankan(spawn, bin, ["--version"], null, 5000);
  const ada = !r.tidakAda && !r.habisWaktu && r.kode === 0;
  singgahMesin = { ada, bin, sampai: Date.now() + UMUR_PERIKSA_MS };
  return ada;
}

/**
 * Gambar (bufer di memori) -> teks. Bahasa Indonesia lebih dulu; bila data
 * bahasa "ind" tidak terpasang, diulang sekali dengan "eng" (label KTP
 * berhuruf Latin, dan hasilnya tetap ditinjau petugas).
 */
export type OpsiOcr = {
  /** Mode tata halaman tesseract: "6" satu blok (bawaan), "4" kolom, "11" teks tersebar. */
  psm?: string;
  /** Batas waktu lintasan ini (ms) - pemanggil yang menjalankan beberapa lintasan membagi waktunya. */
  batasMs?: number;
};

/**
 * OCR-ECOURT 19 Okt: arah halaman lewat OSD tesseract (--psm 0, data "osd"). Mengembalikan derajat putar searah jarum
 * jam yang membuat teks tegak (0/90/180/270), atau null bila OSD tidak tersedia/tidak yakin (teks terlalu sedikit).
 */
export async function orientasiGambar(gambar: Buffer, spawn: Spawn = spawnAsli as unknown as Spawn, batasMs = 8000): Promise<0 | 90 | 180 | 270 | null> {
  if (!(await mesinOcrAda(spawn))) return null;
  const r = await jalankan(spawn, binTesseract(), ["stdin", "stdout", "--psm", "0"], gambar, Math.min(batasMs, BATAS_WAKTU_MS));
  if (r.habisWaktu || r.tidakAda || r.kode !== 0) return null;
  const putar = /Rotate:\s*(\d+)/i.exec(r.keluar);
  const yakin = /Orientation confidence:\s*([\d.]+)/i.exec(r.keluar);
  if (!putar || (yakin && Number(yakin[1]) < 1.5)) return null;
  const d = Number(putar[1]);
  return d === 90 || d === 180 || d === 270 ? d : 0;
}

export async function bacaGambar(
  gambar: Buffer,
  spawn: Spawn = spawnAsli as unknown as Spawn,
  opsi: OpsiOcr = {}
): Promise<HasilOcr> {
  if (!(await mesinOcrAda(spawn))) return { ok: false, alasan: "ocr_belum_tersedia", pesan: PESAN_OCR_BELUM_ADA };
  const bin = binTesseract();
  const psm = /^\d{1,2}$/.test(String(opsi.psm || "")) ? String(opsi.psm) : "6";
  const batas = Number.isFinite(opsi.batasMs) && Number(opsi.batasMs) > 0 ? Math.min(BATAS_WAKTU_MS, Number(opsi.batasMs)) : BATAS_WAKTU_MS;
  const bahasaUtama = String(process.env.ALETA_OCR_BAHASA || "ind").trim() || "ind";
  for (const bahasa of bahasaUtama === "eng" ? ["eng"] : [bahasaUtama, "eng"]) {
    const r = await jalankan(spawn, bin, ["stdin", "stdout", "-l", bahasa, "--psm", psm], gambar, batas);
    if (r.habisWaktu) {
      return { ok: false, alasan: "ocr_habis_waktu", pesan: "Membaca gambar terlalu lama. Coba foto yang lebih kecil atau lebih tajam." };
    }
    if (r.tidakAda) {
      lupakanMesinOcr();
      return { ok: false, alasan: "ocr_belum_tersedia", pesan: PESAN_OCR_BELUM_ADA };
    }
    if (r.kode === 0) return { ok: true, teks: r.keluar, mesin: `tesseract (${bahasa})` };
    // Data bahasa tidak ada -> coba bahasa berikutnya; sebab lain -> berhenti.
    if (!/load|language|traineddata/i.test(r.galatTeks)) break;
  }
  return { ok: false, alasan: "ocr_gagal", pesan: "Gambar tidak dapat dibaca mesin OCR server. Coba foto lain, atau ketik teks KTP-nya." };
}
