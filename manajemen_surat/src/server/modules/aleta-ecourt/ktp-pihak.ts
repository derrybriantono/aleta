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

import { pengaturanKtpDariEnv, pengaturanKtpEfektif, type PengaturanKtpEfektif, type PengaturanKtpTersimpan } from "@/lib/ktp-pihak-pengaturan";

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
 *   12 Okt (butir 11): Admin/Super Admin mengatur nyala/mati, berkas per putaran,
 *   dan jeda dari Pengaturan > Integrasi e-Court. Pengaturan layar MENANG atas env
 *   dan berlaku tanpa restart (penyapu membacanya ulang tiap detak, 30 detik).
 *   Lihat lib/ktp-pihak-pengaturan.ts dan ktp-pihak-pengaturan.ts.
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
      berlakuHingga: h.berlakuHingga || "",
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
  /** ketat: berkas bukan berjudul KTP ("Dokumen Bukti") - hanya halaman berciri KTP (ktp-ocr halamanBercirKtp). */
  baca: (data: Buffer, batasMs?: number, ketat?: boolean) => Promise<HasilBacaKtp[]>;
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
  baca: (data, batasMs, ketat) => bacaKtpBanyak(data, { ...(batasMs ? { batasMs } : {}), ...(ketat ? { ketat: true } : {}) }),
  sekarang: () => Date.now(),
};

/**
 * Satu putaran: ambil antrian, baca per berkas, kirim hasil SATU PER SATU (kemajuan
 * tidak hilang bila proses mati di tengah). Berhenti bila waktunya habis.
 */
export async function pindaiKtpPihak(
  nomor: string[],
  deps: DepsKtp = depsKtpAsli,
  { batas = 2, batasMs = 240_000, batasBacaMs = 90_000, pemicu }: { batas?: number; batasMs?: number; batasBacaMs?: number; pemicu?: PemicuKtp } = {}
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
          hasil = hasilDariBacaan(berkas.fileId, await deps.baca(data, batasBacaMs, Boolean(berkas.ketat)), isi.versi);
        } catch {
          hasil = { fileId: berkas.fileId, status: "tidak_terbaca", sebab: "galat_baca", sumber: "", versi: isi.versi, ktp: [] };
        } finally {
          data.fill(0);
        }
      }
    }
    if (pemicu) hasil.pemicu = pemicu;
    dibaca += 1;
    if (hasil.status === "terbaca") terbaca += 1;
    if (!(await deps.kirim([hasil]))) terkirim = false;
  }
  return { dibaca, terbaca, terkirim, antrianTerjangkau: true };
}

// ---------------------------------------------------------------------------
// PENYAPU LATAR + PEMICU
// ---------------------------------------------------------------------------

export type PemicuKtp = "latar" | "panel" | "manual";

/** Putaran terakhir di proses ini (hilang saat portal hidup ulang - hanya untuk layar Admin). */
export type PutaranTerakhirKtp = {
  pemicu: PemicuKtp;
  mulaiPada: string;
  selesaiPada: string;
  dibaca: number;
  terbaca: number;
  terkirim: boolean;
  antrianTerjangkau: boolean;
};

type Wadah = {
  jalan: boolean;
  detak: NodeJS.Timeout | null;
  terakhir: PutaranTerakhirKtp | null;
  /** Kapan penyapu terakhir memulai putaran terjadwal (ms); dasar menghitung jeda. */
  terakhirJalan: number;
  efektif: PengaturanKtpEfektif | null;
};
const SIMPAN = globalThis as unknown as { __aletaKtpPihak?: Wadah };
function wadahBaru(): Wadah {
  return { jalan: false, detak: null, terakhir: null, terakhirJalan: 0, efektif: null };
}
function wadah(): Wadah {
  SIMPAN.__aletaKtpPihak ??= wadahBaru();
  return SIMPAN.__aletaKtpPihak;
}

/** Hanya untuk uji. */
export function aturUlangKtpPihak() {
  const w = wadah();
  if (w.detak) clearInterval(w.detak);
  SIMPAN.__aletaKtpPihak = wadahBaru();
}

/** Keadaan penyapu di proses ini untuk layar Admin. */
export function keadaanPenyapuKtp() {
  const w = wadah();
  return {
    menyala: w.detak !== null,
    sedangMembaca: w.jalan,
    terakhir: w.terakhir,
    efektif: w.efektif,
    putaranBerikutnyaPada:
      w.detak && w.efektif?.aktif && w.terakhirJalan ? new Date(w.terakhirJalan + w.efektif.jedaMs).toISOString() : null,
  };
}

export function ktpPihakSedangMembaca(): boolean {
  return wadah().jalan;
}

/** Satu putaran, hanya bila tidak ada putaran lain di proses ini. Mengembalikan null bila sibuk. */
export async function putaranKtpPihak(
  nomor: string[],
  deps: DepsKtp = depsKtpAsli,
  opsi?: { batas?: number; batasMs?: number; batasBacaMs?: number; pemicu?: PemicuKtp }
) {
  const w = wadah();
  if (w.jalan) return null;
  w.jalan = true;
  const pemicu: PemicuKtp = opsi?.pemicu ?? (nomor.length ? "panel" : "latar");
  const mulaiPada = new Date().toISOString();
  try {
    const hasil = await pindaiKtpPihak(nomor, deps, { ...opsi, pemicu });
    w.terakhir = { pemicu, mulaiPada, selesaiPada: new Date().toISOString(), ...hasil };
    return hasil;
  } catch {
    return null;
  } finally {
    w.jalan = false;
  }
}

/** Pengaturan dari env saja (perilaku 1.195.0). */
export function pengaturanLatar(env: NodeJS.ProcessEnv = process.env) {
  const { aktif, batas, jedaMs } = pengaturanKtpDariEnv(env);
  return { aktif, batas, jedaMs };
}

/** Pengaturan tersimpan dari layar Admin; null = ikuti env. Disuntikkan (modul ini tidak menyentuh basis data). */
export type SumberPengaturanKtp = () => Promise<PengaturanKtpTersimpan | null>;

/** Selang antar pemeriksaan penyapu; jeda sungguhan diambil dari pengaturan. */
export const DETAK_PENYAPU_MS = 30_000;

/**
 * Detak penyapu: pertama sesudah satu jeda, lalu tiap jeda. Dinyalakan
 * instrumentation.ts sekali saat portal berdiri.
 *
 * Tanpa `sumber` (uji, atau pemanggil lama): hanya env - ALETA_KTP_PIHAK_LATAR=0 tidak
 * menyalakan apa pun. DENGAN `sumber`: detak SELALU berdiri dan tiap 30 detik
 * membaca pengaturan yang berlaku (layar menang atas env), jadi Admin dapat
 * menyalakan, mematikan, atau mengubah jeda tanpa restart.
 */
export function mulaiPindaiKtpBerkala(deps: DepsKtp = depsKtpAsli, env: NodeJS.ProcessEnv = process.env, sumber?: SumberPengaturanKtp) {
  const w = wadah();
  if (w.detak) return false;
  if (!sumber && !pengaturanLatar(env).aktif) return false;
  w.terakhirJalan = Date.now();
  const periksa = async () => {
    let tersimpan: PengaturanKtpTersimpan | null = null;
    if (sumber) {
      try {
        tersimpan = await sumber();
      } catch {
        tersimpan = null; // pengaturan tak terbaca: jatuh ke env, bukan berhenti
      }
    }
    const p = pengaturanKtpEfektif(env, tersimpan);
    w.efektif = p;
    if (!p.aktif) return;
    // Toleransi 1 detik: detak 30 detik tidak boleh melompati jeda 30 detik karena jitter.
    if (Date.now() - w.terakhirJalan < p.jedaMs - 1000) return;
    w.terakhirJalan = Date.now();
    await putaranKtpPihak([], deps, { batas: p.batas, pemicu: "latar" });
  };
  // Putaran pertama sesudah satu jeda (portal baru berdiri), lalu tiap jeda.
  w.detak = setInterval(() => {
    void periksa().catch(() => undefined);
  }, DETAK_PENYAPU_MS);
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
