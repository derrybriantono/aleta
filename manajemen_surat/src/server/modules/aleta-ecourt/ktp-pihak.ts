import {
  ambilBerkasKtpGateway,
  getGatewayAntrianKtp,
  getGatewayKtpPerkara,
  kirimHasilKtpGateway,
  type BerkasKtpAntri,
  type HasilBacaKtpPihak,
  type KtpPihakPerkara,
  type KtpTerbaca,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import { bacaKtpBanyak, type HasilBacaKtp } from "./ktp-ocr";

/**
 * ============================================================================
 * TANGGAL KTP PIHAK DARI BERKAS KTP e-COURT - PEMBACA LATAR (12 Okt 2026, butir 14-15)
 * ============================================================================
 *
 * Bot menyimpan berkas KTP e-Court tetapi tidak dapat membacanya (pdfjs-dist dan
 * tesseract hanya ada di citra portal). Jadi portal yang membaca, lalu menyerahkan
 * hasilnya ke bot: bot mencocokkan ke pihak SIPP perkara itu (NIK, nama + tanggal
 * lahir) dan menyimpannya di aleta_bot_ktp_pihak, yang dibaca variabel ABT
 * 8870-8872 dan panel ABT. Lihat aleta_bot/services/ktpPihakService.js.
 *
 *   portal  GET  /sipp/ktp-pihak/antrian   berkas KTP yang belum dibaca (terbaru dulu)
 *   portal  GET  /sipp/ktp-pihak/berkas    isi satu berkas
 *   portal       bacaKtpBanyak: lapisan teks PDF, OCR halaman pindaian; SATU KTP PER HALAMAN
 *   portal  POST /sipp/ktp-pihak           hasilnya, per berkas
 *
 * KAPAN BERJALAN
 *   (a) tiap kali berkas KTP e-Court baru terunduh: berkas baru otomatis masuk
 *       antrian bot (belum ada barisnya di aleta_bot_ktp_pihak); penyapu berikutnya
 *       - paling lambat satu jeda (bawaan 120 detik) - membacanya;
 *   (b) penyapu latar yang sama menghabiskan SEMUA berkas KTP yang sudah ada di
 *       server tetapi belum dibaca: perkara terbaru dulu, paling banyak
 *       ALETA_KTP_PIHAK_BATAS (2) berkas per putaran, berjeda ALETA_KTP_PIHAK_JEDA_MS
 *       (120 dtk), satu putaran sekaligus per proses. Yang gagal dicoba lagi bot
 *       dengan jeda yang makin panjang (paling banyak 5 kali); "OCR belum
 *       terpasang" dicoba lagi sehari kemudian.
 *   (c) dipicu panel ABT untuk satu perkara (route ktp-pihak?nomor=&tunggu=1).
 *
 *   ALETA_KTP_PIHAK_LATAR=0 mematikan penyapu latar (panel tetap dapat memicu).
 *
 * TIDAK ADA YANG DITULIS KE SIPP/ABT/e-COURT. Berkas tidak disimpan di portal: bufer
 * ditimpa nol sesudah dibaca. NIK dan nama tidak dicatat ke log.
 */

/** Batas ukuran berkas KTP yang dibaca. */
export const BATAS_BITA_KTP = 15 * 1024 * 1024;

const SEBAB_ALASAN: Record<string, string> = {
  ocr_belum_tersedia: "ocr_belum_tersedia",
  ocr_gagal: "ocr_gagal",
  ocr_habis_waktu: "ocr_habis_waktu",
  tidak_terbaca: "tidak_ada_label_ktp",
  pdf_rusak: "pdf_rusak",
  pdf_tanpa_kanvas: "pdf_tanpa_kanvas",
};

/** Hasil pembaca KTP -> bentuk yang dikirim ke bot. Murni. */
export function hasilDariBacaan(fileId: string, daftar: HasilBacaKtp[], versi: number): HasilBacaKtpPihak {
  const ktp: KtpTerbaca[] = [];
  for (const h of daftar) {
    if (!h.ok) continue;
    const m = h.medan;
    if (!m.nik && !m.tanggalTerbit && !m.nama) continue;
    ktp.push({
      nik: m.nik || "",
      nikSah: Boolean(h.nik && h.nik.sah),
      nama: m.nama || "",
      tanggalLahir: m.tanggalLahir || "",
      tanggalTerbit: m.tanggalTerbit || "",
      kotaTerbit: m.kotaTerbit || "",
      sumber: h.sumber,
    });
  }
  if (ktp.length) {
    return { fileId, status: "terbaca", sebab: "", sumber: daftar.find((h) => h.ok)?.sumber ?? "", versi, ktp };
  }
  const pertama = daftar[0];
  const alasan = pertama?.alasan;
  return {
    fileId,
    status: alasan === "bukan_berkas_ktp" ? "bukan_ktp" : "tidak_terbaca",
    sebab: !alasan ? "tidak_terbaca" : alasan === "bukan_berkas_ktp" ? "bukan_berkas_ktp" : SEBAB_ALASAN[alasan] ?? "tidak_terbaca",
    sumber: pertama?.sumber ?? "",
    versi,
    ktp: [],
  };
}

export type DepsKtp = {
  antrian: (nomor: string[], batas: number) => Promise<{ berkas: BerkasKtpAntri[]; versi: number } | null>;
  ambil: (fileId: string) => Promise<Buffer | null>;
  kirim: (hasil: HasilBacaKtpPihak[]) => Promise<boolean>;
  baca: (data: Buffer, batasMs?: number) => Promise<HasilBacaKtp[]>;
  sekarang: () => number;
};

export const depsKtpAsli: DepsKtp = {
  antrian: async (nomor, batas) => {
    const r = await getGatewayAntrianKtp({ nomor, batas });
    return r.ok ? { berkas: r.data?.berkas ?? [], versi: Number(r.data?.versi) || 1 } : null;
  },
  ambil: async (fileId) => {
    const pembatal = new AbortController();
    const jam = setTimeout(() => pembatal.abort(), 30_000);
    try {
      const r = await ambilBerkasKtpGateway(fileId, pembatal.signal);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    } finally {
      clearTimeout(jam);
    }
  },
  kirim: async (hasil) => (await kirimHasilKtpGateway(hasil)).ok,
  baca: (data, batasMs) => bacaKtpBanyak(data, batasMs ? { batasMs } : {}),
  sekarang: () => Date.now(),
};

/**
 * Satu putaran: ambil antrian, baca per berkas, kirim hasil SATU PER SATU (kemajuan
 * tidak hilang bila proses mati di tengah). Berhenti bila waktunya habis.
 */
export async function pindaiKtpPihak(
  nomor: string[],
  deps: DepsKtp = depsKtpAsli,
  { batas = 2, batasMs = 240_000, batasBacaMs = 90_000 }: { batas?: number; batasMs?: number; batasBacaMs?: number } = {}
): Promise<{ dibaca: number; terbaca: number; terkirim: boolean; antrianTerjangkau: boolean }> {
  const mulai = deps.sekarang();
  const isi = await deps.antrian(nomor, batas);
  if (!isi) return { dibaca: 0, terbaca: 0, terkirim: false, antrianTerjangkau: false };
  let dibaca = 0;
  let terbaca = 0;
  let terkirim = true;
  for (const berkas of isi.berkas) {
    if (deps.sekarang() - mulai > batasMs) break;
    let hasil: HasilBacaKtpPihak;
    if (berkas.ukuran > BATAS_BITA_KTP) {
      hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "berkas_terlalu_besar", sumber: "", versi: isi.versi, ktp: [] };
    } else {
      const data = await deps.ambil(berkas.fileId);
      if (!data) {
        hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "berkas_tidak_terambil", sumber: "", versi: isi.versi, ktp: [] };
      } else {
        try {
          hasil = hasilDariBacaan(berkas.fileId, await deps.baca(data, batasBacaMs), isi.versi);
        } catch {
          hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "galat_baca", sumber: "", versi: isi.versi, ktp: [] };
        } finally {
          data.fill(0);
        }
      }
    }
    dibaca += 1;
    if (hasil.status === "terbaca") terbaca += 1;
    if (!(await deps.kirim([hasil]))) terkirim = false;
  }
  return { dibaca, terbaca, terkirim, antrianTerjangkau: true };
}

// ---------------------------------------------------------------------------
// PENYAPU LATAR + PEMICU
// ---------------------------------------------------------------------------

type Wadah = { jalan: boolean; detak: NodeJS.Timeout | null };
const SIMPAN = globalThis as unknown as { __aletaKtpPihak?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaKtpPihak ??= { jalan: false, detak: null };
  return SIMPAN.__aletaKtpPihak;
}

/** Hanya untuk uji. */
export function aturUlangKtpPihak() {
  const w = wadah();
  if (w.detak) clearInterval(w.detak);
  SIMPAN.__aletaKtpPihak = { jalan: false, detak: null };
}

export function ktpPihakSedangMembaca(): boolean {
  return wadah().jalan;
}

/** Satu putaran, hanya bila tidak ada putaran lain di proses ini. Mengembalikan null bila sibuk. */
export async function putaranKtpPihak(nomor: string[], deps: DepsKtp = depsKtpAsli, opsi?: { batas?: number; batasMs?: number; batasBacaMs?: number }) {
  const w = wadah();
  if (w.jalan) return null;
  w.jalan = true;
  try {
    return await pindaiKtpPihak(nomor, deps, opsi);
  } catch {
    return null;
  } finally {
    w.jalan = false;
  }
}

export function pengaturanLatar(env: NodeJS.ProcessEnv = process.env) {
  return {
    aktif: String(env.ALETA_KTP_PIHAK_LATAR ?? "").trim() !== "0",
    batas: Math.max(1, Math.min(10, Number(env.ALETA_KTP_PIHAK_BATAS) || 2)),
    jedaMs: Math.max(30_000, Number(env.ALETA_KTP_PIHAK_JEDA_MS) || 120_000),
  };
}

/**
 * Detak penyapu: pertama sesudah satu jeda, lalu tiap jeda. Dinyalakan
 * instrumentation.ts sekali saat portal berdiri. Mati dengan ALETA_KTP_PIHAK_LATAR=0.
 */
export function mulaiPindaiKtpBerkala(deps: DepsKtp = depsKtpAsli, env: NodeJS.ProcessEnv = process.env) {
  const w = wadah();
  const p = pengaturanLatar(env);
  if (!p.aktif || w.detak) return false;
  const jalan = () => {
    void putaranKtpPihak([], deps, { batas: p.batas }).catch(() => undefined);
  };
  // Putaran pertama sesudah satu jeda (portal baru berdiri), lalu tiap jeda.
  w.detak = setInterval(jalan, p.jedaMs);
  w.detak.unref?.();
  return true;
}

/** Jawaban panel: tanggal KTP tiap pihak perkara + keadaan pembacaan. */
export async function ktpPihakPerkara(
  nomor: string,
  { tunggu = false, deps = depsKtpAsli }: { tunggu?: boolean; deps?: DepsKtp } = {}
): Promise<{ ok: true; data: KtpPihakPerkara; sedangDibaca: boolean } | { ok: false; sebab: string }> {
  let r = await getGatewayKtpPerkara(nomor);
  if (!r.ok) return { ok: false, sebab: "Arsip KTP e-Court perkara ini tidak terbaca dari ALETA Bot." };
  let data = r.data;
  let sedangDibaca = false;
  if (data.belumDibaca > 0) {
    if (tunggu) {
      // Baca KTP perkara ini sekarang (paling banyak 40 detik); sisanya oleh penyapu.
      const hasil = await putaranKtpPihak([nomor], deps, { batas: Math.min(3, data.belumDibaca), batasMs: 40_000, batasBacaMs: 35_000 });
      sedangDibaca = hasil === null;
      if (hasil && hasil.dibaca > 0) {
        r = await getGatewayKtpPerkara(nomor);
        if (r.ok) data = r.data;
      }
    } else {
      sedangDibaca = true;
    }
  }
  return { ok: true, data, sedangDibaca };
}
