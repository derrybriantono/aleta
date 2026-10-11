import { spawn as spawnAsli } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { bacaGambar, mesinOcrAda, PESAN_OCR_BELUM_ADA } from "@/app/api/aleta-ecourt/saksi-scan/ocr";
import {
  periksaNik,
  skorUrai,
  uraiTeksIdentitas,
  type HasilUrai,
  type MedanIdentitas,
  type PeriksaNik,
} from "@/app/api/aleta-ecourt/saksi-scan/urai-ktp";

import { bacaPdfDariBita } from "./baca-pdf";

/**
 * ============================================================================
 * BACA KTP DARI BERKAS - GAMBAR ATAU PDF (perbaikan 5 Okt 2026 butir 9)
 * ============================================================================
 *
 * SATU pintu untuk membaca KTP dari berkas apa pun yang dipegang server:
 *
 *   - rute saksi-scan (foto/PDF KTP yang diunggah petugas di halaman SIPP),
 *   - modul lain yang membaca berkas KTP PDF dari arsip e-Court (mis. variabel
 *     ABT #2222# "Tanggal KTP" -> medan.tanggalTerbit).
 *
 *     bacaKtpDariBerkas(buffer, jenis?, opsi?) -> Promise<HasilBacaKtp>
 *       { ok, teks, medan (termasuk tanggalTerbit, kotaTerbit), nik,
 *         catatan, terbaca, sumber: "ocr" | "teks-pdf" | "ocr-pdf", mesin?,
 *         alasan?, pesan?, lintasan? }
 *
 * GAMBAR (JPEG/PNG/WEBP/BMP)
 *
 *   Dipraproses di PROSES ANAK (scripts/ktp-gambar.mjs, @napi-rs/canvas -
 *   pendamping pdfjs-dist, ada di laptop dan di citra portal): skala abu-abu,
 *   diperbesar bila kecil / dikecilkan bila raksasa, kontras direntang, dan
 *   satu varian hitam-putih berambang lokal. Proses anak, bukan di dalam
 *   portal: decoder asli kanvas MATI (access violation) atas JPEG rusak -
 *   diukur 5 Okt 2026 - dan portal tidak boleh ikut mati karena satu foto.
 *   Anak gagal = OCR atas gambar asli, tanpa praproses.
 *
 *   Tesseract lalu dijalankan beberapa LINTASAN (--psm 6 abu-abu, 6
 *   hitam-putih, 4, 11); tiap hasil diurai dan DINILAI (skorUrai), yang
 *   terbaik dipakai dan medan yang kosong dilengkapi dari lintasan lain.
 *   Berhenti lebih awal begitu hasilnya lengkap; seluruhnya dibatasi waktu.
 *
 * PDF
 *
 *   Lapisan teks dipakai lebih dulu (PDF hasil cetak/ekspor). Bila tidak ada
 *   label KTP di dalamnya (pindaian), halaman 1-2 digambar ulang di proses
 *   anak (pdfjs-dist + @napi-rs/canvas) lalu dibaca seperti gambar.
 *
 * Tanpa mesin OCR di server tidak ada yang diproses sama sekali (jawaban
 * jujur "belum dapat membaca gambar"). ALETA_OCR_PRAPROSES=0 mematikan
 * praproses gambar (OCR atas gambar asli) - saklar darurat bila proses anak
 * bermasalah di server.
 *
 * TIDAK ADA YANG DISIMPAN: gambar hasil praproses ditimpa nol sesudah
 * dipakai, tidak ada berkas sementara (stdin/stdout); bufer masukan tetap
 * milik pemanggil (rute menimpanya).
 */

export type JenisBerkasKtp = "jpeg" | "png" | "webp" | "bmp" | "pdf";

export type SumberKtp = "ocr" | "teks-pdf" | "ocr-pdf";

export type HasilBacaKtp = {
  ok: boolean;
  /** Teks yang diurai (hasil OCR terbaik atau lapisan teks PDF). */
  teks: string;
  medan: MedanIdentitas;
  nik: PeriksaNik | null;
  catatan: string[];
  terbaca: Array<keyof MedanIdentitas>;
  sumber: SumberKtp;
  mesin?: string;
  alasan?:
    | "ocr_belum_tersedia"
    | "ocr_gagal"
    | "ocr_habis_waktu"
    | "tidak_terbaca"
    | "bukan_berkas_ktp"
    | "pdf_rusak"
    | "pdf_tanpa_kanvas";
  pesan?: string;
  /** Ringkasan lintasan OCR (tanpa isi teks) - untuk diagnosis. */
  lintasan?: Array<{ varian: string; psm: string; skor: number; halaman?: number }>;
};

type Spawn = Parameters<typeof bacaGambar>[1];

export type OpsiBacaKtp = {
  /** Batas waktu seluruh pembacaan (ms). Bawaan 45 detik. */
  batasMs?: number;
  tahunKini?: number;
  /** Untuk uji: pengganti child_process.spawn bagi tesseract. */
  spawn?: Spawn;
  /** Untuk uji: pengganti proses anak praproses/gambar PDF. */
  pembantu?: PembantuGambar;
};

/** mode "gambar" -> {abu, biner}; mode "pdf" -> {hal1-abu, hal1-biner, ...}; null = gagal. */
export type PembantuGambar = (mode: "gambar" | "pdf", data: Buffer, batasMs: number) => Promise<Map<string, Buffer> | null>;

const BATAS_BAWAAN_MS = 45_000;
/** Skor urai yang dianggap lengkap - lintasan berikutnya tidak perlu dijalankan. */
const SKOR_CUKUP = 16;
/** Lapisan teks PDF dipakai bila skornya setidaknya ini (beberapa label KTP). */
const SKOR_TEKS_PDF = 5;
const BATAS_ANAK_MS = 20_000;
const LINTASAN_PRA: Array<{ varian: "abu" | "biner"; psm: string }> = [
  { varian: "abu", psm: "6" },
  { varian: "biner", psm: "6" },
  { varian: "abu", psm: "4" },
  { varian: "abu", psm: "11" },
];
const LINTASAN_ASLI: Array<{ varian: "asli"; psm: string }> = [
  { varian: "asli", psm: "6" },
  { varian: "asli", psm: "4" },
  { varian: "asli", psm: "11" },
];

/** JPEG, PNG, WEBP, BMP, PDF - dari bait awalnya, bukan dari nama atau tipe kiriman. */
export function jenisBerkasKtp(b: Buffer): JenisBerkasKtp | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  // %PDF boleh didahului sedikit sampah (pemindai lama).
  if (b.length >= 5 && b.subarray(0, 1024).toString("latin1").includes("%PDF-")) return "pdf";
  return null;
}

// ─── Proses anak: praproses gambar dan gambar halaman PDF ────────────────────

function skripAnak(): string {
  return path.join(process.cwd(), "scripts", "ktp-gambar.mjs");
}

/** Bingkai stdout anak: [4 panjang label][label][4 panjang data][data] ... */
export function uraiBingkai(b: Buffer): Map<string, Buffer> {
  const hasil = new Map<string, Buffer>();
  let i = 0;
  while (i + 8 <= b.length) {
    const pl = b.readUInt32BE(i);
    const label = b.subarray(i + 4, i + 4 + pl).toString("utf8");
    i += 4 + pl;
    if (i + 4 > b.length) break;
    const pd = b.readUInt32BE(i);
    i += 4;
    if (i + pd > b.length) break;
    hasil.set(label, Buffer.from(b.subarray(i, i + pd)));
    i += pd;
  }
  return hasil;
}

/** Pembantu sungguhan: node scripts/ktp-gambar.mjs <mode> lewat stdin/stdout. */
function buatPembantuAnak(maksHalaman: number): PembantuGambar {
  return (mode, data, batasMs) =>
  new Promise((selesai) => {
    const skrip = skripAnak();
    if (!existsSync(skrip)) return selesai(null);
    let anak: ReturnType<typeof spawnAsli>;
    try {
      anak = spawnAsli(process.execPath, [skrip, mode, String(maksHalaman)], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    } catch {
      return selesai(null);
    }
    const keluar: Buffer[] = [];
    let sudah = false;
    const akhiri = (hasil: Map<string, Buffer> | null) => {
      if (sudah) return;
      sudah = true;
      clearTimeout(jam);
      for (const x of keluar) x.fill(0);
      selesai(hasil);
    };
    const jam = setTimeout(() => {
      try {
        anak.kill("SIGKILL");
      } catch {
        /* sudah mati */
      }
      akhiri(null);
    }, Math.max(1000, Math.min(batasMs, 60_000)));
    anak.stdout?.on("data", (x: Buffer) => keluar.push(x));
    anak.on("error", () => akhiri(null));
    anak.on("close", (kode) => {
      if (kode !== 0) return akhiri(null);
      const semua = Buffer.concat(keluar);
      const hasil = uraiBingkai(semua);
      semua.fill(0);
      akhiri(hasil.size ? hasil : null);
    });
    try {
      anak.stdin?.on("error", () => undefined);
      anak.stdin?.end(data);
    } catch {
      akhiri(null);
    }
  });
}

export const pembantuAnak: PembantuGambar = buatPembantuAnak(2);

// ─── Gabungan lintasan ───────────────────────────────────────────────────────

type Lintasan = { varian: string; psm: string; halaman?: number; teks: string; urai: HasilUrai; skor: number; mesin: string };

function kosongKtp(sumber: SumberKtp, alasan: HasilBacaKtp["alasan"], pesan: string, teks = ""): HasilBacaKtp {
  const u = uraiTeksIdentitas("");
  return { ok: false, teks, medan: u.medan, nik: null, catatan: [], terbaca: [], sumber, alasan, pesan };
}

/**
 * Yang terbaik dipakai utuh; medan yang masih kosong dilengkapi dari
 * lintasan lain (berurut skor). NIK diperiksa ulang atas hasil gabungan.
 */
function gabungkan(daftar: Lintasan[], tahunKini: number): { urai: HasilUrai; teks: string; mesin: string } {
  const urut = daftar.slice().sort((a, b) => b.skor - a.skor);
  const terbaik = urut[0];
  const medan: MedanIdentitas = { ...terbaik.urai.medan };
  const terbaca = new Set(terbaik.urai.terbaca);
  const catatan = [...terbaik.urai.catatan];
  const dilengkapi: string[] = [];
  for (const lain of urut.slice(1)) {
    for (const k of lain.urai.terbaca) {
      if (!medan[k] && lain.urai.medan[k]) {
        (medan as Record<string, string>)[k] = lain.urai.medan[k] as string;
        terbaca.add(k);
        dilengkapi.push(k);
      }
    }
  }
  let nik = terbaik.urai.nik;
  if (dilengkapi.includes("nik") && medan.nik) nik = periksaNik(medan.nik, tahunKini);
  if (dilengkapi.length) {
    catatan.push(`Sebagian medan (${[...new Set(dilengkapi)].join(", ")}) diambil dari pembacaan kedua gambar yang sama - periksa.`);
  }
  return { urai: { medan, nik, catatan, terbaca: [...terbaca] }, teks: terbaik.teks, mesin: terbaik.mesin };
}

/**
 * Varian gambar -> beberapa lintasan OCR. `batasSampai` = Date.now()
 * terakhir yang boleh dipakai. Varian yang dipakai ditimpa nol sesudahnya
 * (kecuali "asli", milik pemanggil).
 */
async function ocrLintasan(
  varian: Map<string, Buffer>,
  rencana: Array<{ varian: string; psm: string }>,
  batasSampai: number,
  opsi: OpsiBacaKtp,
  halaman?: number
): Promise<{ lintasan: Lintasan[]; gagal?: { alasan: HasilBacaKtp["alasan"]; pesan: string } }> {
  const tahunKini = opsi.tahunKini ?? new Date().getFullYear();
  const lintasan: Lintasan[] = [];
  let gagal: { alasan: HasilBacaKtp["alasan"]; pesan: string } | undefined;
  for (const l of rencana) {
    const gambar = varian.get(l.varian);
    if (!gambar) continue;
    const sisa = batasSampai - Date.now();
    if (sisa < 2500) break;
    const r = await bacaGambar(gambar, opsi.spawn, { psm: l.psm, batasMs: sisa });
    if (!r.ok) {
      if (r.alasan === "ocr_belum_tersedia") return { lintasan, gagal: { alasan: r.alasan, pesan: r.pesan } };
      gagal = { alasan: r.alasan, pesan: r.pesan };
      if (r.alasan === "ocr_habis_waktu") break;
      continue;
    }
    const urai = uraiTeksIdentitas(r.teks, tahunKini);
    const skor = skorUrai(urai);
    lintasan.push({ varian: l.varian, psm: l.psm, halaman, teks: r.teks, urai, skor, mesin: r.mesin });
    if (skor >= SKOR_CUKUP) break;
  }
  return { lintasan, gagal };
}

function hapusVarian(varian: Map<string, Buffer> | null) {
  if (!varian) return;
  for (const [k, b] of varian) if (k !== "asli") b.fill(0);
}

function jadiHasil(lintasan: Lintasan[], sumber: SumberKtp, tahunKini: number): HasilBacaKtp {
  const g = gabungkan(lintasan, tahunKini);
  const ok = g.urai.terbaca.length > 0;
  return {
    ok,
    teks: g.teks,
    medan: g.urai.medan,
    nik: g.urai.nik,
    catatan: g.urai.catatan,
    terbaca: g.urai.terbaca,
    sumber,
    mesin: g.mesin,
    ...(ok
      ? {}
      : {
          alasan: "tidak_terbaca" as const,
          pesan: "Gambar terbaca, tetapi tidak satu pun label KTP/blangko (NIK, Nama, Alamat, ...) ditemukan. Coba foto yang lebih tajam dan lurus, atau ketik teksnya.",
        }),
    lintasan: lintasan.map((l) => ({ varian: l.varian, psm: l.psm, skor: l.skor, ...(l.halaman ? { halaman: l.halaman } : {}) })),
  };
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

async function bacaPdfKtp(data: Buffer, opsi: OpsiBacaKtp, batasSampai: number): Promise<HasilBacaKtp> {
  const tahunKini = opsi.tahunKini ?? new Date().getFullYear();
  const isi = await bacaPdfDariBita(new Uint8Array(data), "ktp.pdf", 5);
  if (!isi.ada || !isi.jumlahHalaman) return kosongKtp("teks-pdf", "pdf_rusak", "Berkas PDF tidak dapat dibuka.");
  const teks = isi.halaman.map((h) => h.teks).join("\n").trim();
  if (teks) {
    const urai = uraiTeksIdentitas(teks, tahunKini);
    if (skorUrai(urai) >= SKOR_TEKS_PDF) {
      return { ok: true, teks, medan: urai.medan, nik: urai.nik, catatan: urai.catatan, terbaca: urai.terbaca, sumber: "teks-pdf" };
    }
  }
  if (!(await mesinOcrAda(opsi.spawn))) return kosongKtp("ocr-pdf", "ocr_belum_tersedia", PESAN_OCR_BELUM_ADA);
  const pembantu = opsi.pembantu ?? pembantuAnak;
  const gambar = await pembantu("pdf", data, batasSampai - Date.now());
  if (!gambar) {
    return kosongKtp(
      "ocr-pdf",
      "pdf_tanpa_kanvas",
      "PDF ini berupa pindaian, tetapi halamannya tidak dapat digambar untuk dibaca. Unggah foto KTP-nya (JPG/PNG), atau ketik teksnya."
    );
  }
  const semua: Lintasan[] = [];
  let gagal: { alasan: HasilBacaKtp["alasan"]; pesan: string } | undefined;
  try {
    for (let hal = 1; gambar.has(`hal${hal}-abu`); hal += 1) {
      const varian = new Map<string, Buffer>();
      for (const v of ["abu", "biner"]) {
        const b = gambar.get(`hal${hal}-${v}`);
        if (b) varian.set(v, b);
      }
      const r = await ocrLintasan(varian, LINTASAN_PRA, batasSampai, opsi, hal);
      semua.push(...r.lintasan);
      if (r.gagal) gagal = r.gagal;
      if (r.gagal && r.gagal.alasan === "ocr_belum_tersedia") break;
      if (r.lintasan.some((l) => l.skor >= SKOR_CUKUP)) break;
    }
  } finally {
    hapusVarian(gambar);
  }
  if (!semua.length) return kosongKtp("ocr-pdf", gagal?.alasan ?? "ocr_gagal", gagal?.pesan ?? "PDF tidak dapat dibaca.");
  // Halaman berbeda tidak digabung medannya: halaman terbaik saja.
  const terbaikHalaman = semua.slice().sort((a, b) => b.skor - a.skor)[0].halaman;
  return jadiHasil(semua.filter((l) => l.halaman === terbaikHalaman), "ocr-pdf", tahunKini);
}

/**
 * Berkas KTP (foto atau PDF) -> teks + usulan medan, termasuk tanggalTerbit
 * dan kotaTerbit. `jenis` (mime atau "pdf"/"jpeg"/...) hanya petunjuk; jenis
 * sesungguhnya dibaca dari bait awal berkas.
 */
export async function bacaKtpDariBerkas(buffer: Buffer, jenis?: string, opsi: OpsiBacaKtp = {}): Promise<HasilBacaKtp> {
  const tahunKini = opsi.tahunKini ?? new Date().getFullYear();
  const batasSampai = Date.now() + (opsi.batasMs ?? BATAS_BAWAAN_MS);
  // `jenis` hanya petunjuk pemanggil - bait awal berkas yang memutuskan.
  void jenis;
  const bentuk = jenisBerkasKtp(buffer);
  if (!bentuk) return kosongKtp("ocr", "bukan_berkas_ktp", "Berkas bukan gambar JPEG/PNG/WEBP/BMP atau PDF.");
  if (bentuk === "pdf") return bacaPdfKtp(buffer, opsi, batasSampai);

  if (!(await mesinOcrAda(opsi.spawn))) return kosongKtp("ocr", "ocr_belum_tersedia", PESAN_OCR_BELUM_ADA);
  const pembantu = opsi.pembantu ?? pembantuAnak;
  const praprosesMati = !opsi.pembantu && String(process.env.ALETA_OCR_PRAPROSES || "").trim() === "0";
  const pra = praprosesMati ? null : await pembantu("gambar", buffer, Math.min(BATAS_ANAK_MS, batasSampai - Date.now()));
  const varian = pra && pra.has("abu") ? pra : new Map([["asli", buffer]]);
  let r: Awaited<ReturnType<typeof ocrLintasan>>;
  try {
    r = await ocrLintasan(varian, pra && pra.has("abu") ? LINTASAN_PRA : LINTASAN_ASLI, batasSampai, opsi);
  } finally {
    hapusVarian(pra);
  }
  if (!r.lintasan.length) {
    return kosongKtp("ocr", r.gagal?.alasan ?? "ocr_gagal", r.gagal?.pesan ?? "Gambar tidak dapat dibaca mesin OCR server.");
  }
  return jadiHasil(r.lintasan, "ocr", tahunKini);
}

/* === KTP-PIHAK 12 Okt === */
/**
 * Berkas KTP e-Court dapat memuat KTP lebih dari satu orang (Pemohon I dan II
 * dalam satu PDF): SATU KTP PER HALAMAN. Fungsi ini membaca tiap halaman
 * sendiri-sendiri - lapisan teks PDF lebih dulu, lalu OCR halaman pindaian
 * (paling banyak 4) - dan memulangkan satu hasil per orang (NIK berbeda).
 * Bukan PDF (foto) = satu hasil dari bacaKtpDariBerkas. Satu halaman berisi
 * dua kartu sekaligus TIDAK dipisah (terbaca sebagai satu hasil).
 */
const HALAMAN_MAKS_BANYAK = 4;
const pembantuAnakBanyak: PembantuGambar = buatPembantuAnak(HALAMAN_MAKS_BANYAK);

export async function bacaKtpBanyak(buffer: Buffer, opsi: OpsiBacaKtp = {}): Promise<HasilBacaKtp[]> {
  const tahunKini = opsi.tahunKini ?? new Date().getFullYear();
  const bentuk = jenisBerkasKtp(buffer);
  if (bentuk !== "pdf") return [await bacaKtpDariBerkas(buffer, undefined, opsi)];
  const batasSampai = Date.now() + (opsi.batasMs ?? 90_000);

  const isi = await bacaPdfDariBita(new Uint8Array(buffer), "ktp.pdf", HALAMAN_MAKS_BANYAK + 1);
  if (!isi.ada || !isi.jumlahHalaman) return [kosongKtp("teks-pdf", "pdf_rusak", "Berkas PDF tidak dapat dibuka.")];

  const unikNik = (daftar: Array<{ hasil: HasilBacaKtp; skor: number }>): HasilBacaKtp[] => {
    const peta = new Map<string, { hasil: HasilBacaKtp; skor: number }>();
    daftar.forEach((x, i) => {
      const kunci = x.hasil.medan.nik || `tanpa-nik-${i}`;
      const lama = peta.get(kunci);
      if (!lama || x.skor > lama.skor) peta.set(kunci, x);
    });
    return [...peta.values()].map((x) => x.hasil);
  };

  // 1. Lapisan teks per halaman.
  const dariTeks: Array<{ hasil: HasilBacaKtp; skor: number }> = [];
  for (const h of isi.halaman.slice(0, HALAMAN_MAKS_BANYAK + 1)) {
    if (!h.teks.trim()) continue;
    const urai = uraiTeksIdentitas(h.teks, tahunKini);
    const skor = skorUrai(urai);
    if (skor < SKOR_TEKS_PDF) continue;
    dariTeks.push({
      skor,
      hasil: { ok: true, teks: h.teks, medan: urai.medan, nik: urai.nik, catatan: urai.catatan, terbaca: urai.terbaca, sumber: "teks-pdf" },
    });
  }
  if (dariTeks.length) return unikNik(dariTeks);

  // 2. Pindaian: OCR tiap halaman.
  if (!(await mesinOcrAda(opsi.spawn))) return [kosongKtp("ocr-pdf", "ocr_belum_tersedia", PESAN_OCR_BELUM_ADA)];
  const pembantu = opsi.pembantu ?? pembantuAnakBanyak;
  const gambar = await pembantu("pdf", buffer, batasSampai - Date.now());
  if (!gambar) {
    return [kosongKtp("ocr-pdf", "pdf_tanpa_kanvas", "PDF ini berupa pindaian, tetapi halamannya tidak dapat digambar untuk dibaca.")];
  }
  const dariOcr: Array<{ hasil: HasilBacaKtp; skor: number }> = [];
  let gagal: { alasan: HasilBacaKtp["alasan"]; pesan: string } | undefined;
  try {
    for (let hal = 1; gambar.has(`hal${hal}-abu`); hal += 1) {
      if (batasSampai - Date.now() < 2500) break;
      const varian = new Map<string, Buffer>();
      for (const v of ["abu", "biner"]) {
        const b = gambar.get(`hal${hal}-${v}`);
        if (b) varian.set(v, b);
      }
      const r = await ocrLintasan(varian, LINTASAN_PRA, batasSampai, opsi, hal);
      if (r.gagal) gagal = r.gagal;
      if (r.gagal && r.gagal.alasan === "ocr_belum_tersedia") break;
      if (!r.lintasan.length) continue;
      const hasil = jadiHasil(r.lintasan, "ocr-pdf", tahunKini);
      if (hasil.ok && (hasil.medan.nik || hasil.medan.tanggalTerbit)) {
        dariOcr.push({ hasil, skor: Math.max(...r.lintasan.map((l) => l.skor)) });
      }
    }
  } finally {
    hapusVarian(gambar);
  }
  if (dariOcr.length) return unikNik(dariOcr);
  return [kosongKtp("ocr-pdf", gagal?.alasan ?? "tidak_terbaca", gagal?.pesan ?? "Tidak satu pun halaman terbaca sebagai KTP.")];
}
/* === AKHIR KTP-PIHAK === */
