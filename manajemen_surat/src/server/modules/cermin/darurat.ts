/**
 * ============================================================================
 * JADWAL DARI CERMIN SAAT SIPP TIDAK TERJANGKAU (5 Nov 2026)
 * ============================================================================
 *
 * Jalur normal tidak berubah sedikit pun: layar Jadwal Sidang / Jadwal Mediasi
 * membaca SIPP lewat bot (atau cermin bila saklarnya menyala dan cermin segar),
 * dan antrian tetap dibaca langsung. Modul ini hanya dipakai SESUDAH jalur itu
 * gagal karena bot/SIPP tidak terjangkau: daripada layar kosong dengan pesan
 * galat, petugas mendapat salinan terakhir yang SUDAH ada di aleta_cermin_*
 * disertai keterangan jelas kapan salinan itu diambil.
 *
 * Syarat (selain itu = null, pemanggil tetap menjawab galat aslinya):
 *   * galatnya karena bot/SIPP tidak terjangkau (jaringan, habis waktu, 5xx,
 *     atau bot menjawab gagal membaca) - bukan permintaan yang ditolak (4xx);
 *   * tanpa pencarian (nama pihak hanya ada di SIPP);
 *   * sidang: pemindaian awal cermin SELESAI (sebelum itu riwayatnya belum
 *     lengkap) dan ada waktu sinkron berhasil yang dapat disebutkan;
 *   * mediasi: seluruh rentang ada di jendela yang terakhir berhasil dihitung
 *     (cermin mediasi hanya memuat jendelanya, bukan seluruh riwayat).
 *
 * Tidak memerlukan saklar layar menyala (saklar mengatur sumber NORMAL; ini
 * hanya pengganti galat) dan tidak pernah menulis ke SIPP. Antrian tidak
 * dikarang: antrian.terbaca = false seperti jalur normal saat antrian gagal.
 * Tidak pernah melempar.
 */
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { muatSidangCermin } from "@/server/modules/cermin/jadwal-cermin";
import { muatMediasiCermin, muatKeadaanMediasi } from "@/server/modules/cermin/mediasi";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { muatKeadaanPembaruan } from "@/server/modules/cermin/pembaruan";

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DepsDarurat = { db: () => Promise<AletaDatabase>; sekarang: () => Date };
export const depsDaruratAsli: DepsDarurat = { db: getDatabase, sekarang: () => new Date() };

/**
 * Apakah kegagalan ini berarti SIPP/bot tidak terjangkau (boleh diganti cermin)?
 * Tanpa status = bot tidak terjangkau; 5xx, 408, 429 = bot/SIPP bermasalah; 2xx-3xx dengan ok:false =
 * bot menjawab tetapi gagal membaca SIPP. 4xx lain (termasuk 404 rute tak ada) = permintaan ditolak.
 */
export function sippTakTerjangkau(h: { ok: boolean; status?: number }): boolean {
  if (h.ok) return false;
  const s = h.status;
  if (s === undefined || s === null) return true;
  if (s >= 500 || s === 408 || s === 429) return true;
  return s >= 200 && s < 400;
}

/** "09.12" (WITA) untuk hari ini, "04/11 21.40" untuk hari lain. */
function jamTampil(iso: string, sekarang: Date): string {
  const w = waktuPengadilan(new Date(iso));
  const jam = w.jam.slice(0, 5).replace(":", ".");
  if (w.tanggal === waktuPengadilan(sekarang).tanggal) return jam;
  const [, b, h] = w.tanggal.split("-");
  return `${h}/${b} ${jam}`;
}

/** Kalimat untuk petugas, tanpa istilah teknis. */
export function keteranganTakTerjangkau(waktuIso: string, sekarang: Date = new Date()): string {
  return `Data terakhir ${jamTampil(waktuIso, sekarang)}, SIPP sedang tidak terjangkau.`;
}

const sah = (iso: string) => Number.isFinite(Date.parse(iso));

export type HasilSidangDarurat = {
  ok: true;
  data: {
    ok: true;
    dari: string;
    sampai: string;
    diperiksaPada: string;
    sidang: Array<Record<string, unknown>>;
    antrian: Record<string, unknown>;
    dariCermin: true;
    waktuSinkron: string;
    keterangan: string;
  };
};

export async function jadwalSidangDariCerminDarurat(
  p: { dari?: string; sampai?: string; cari?: string; batas?: number },
  deps: DepsDarurat = depsDaruratAsli
): Promise<HasilSidangDarurat | null> {
  try {
    if (String(p.cari ?? "").trim() !== "") return null;
    const dari = String(p.dari ?? "").trim();
    const sampai = String(p.sampai ?? "").trim() || dari;
    if (!TANGGAL_ISO.test(dari) || !TANGGAL_ISO.test(sampai) || sampai < dari) return null;
    const db = await deps.db();
    const pemindai = await muatKeadaanPemindai(db);
    if (pemindai.status !== "selesai") return null;
    const pembaruan = await muatKeadaanPembaruan(db);
    // Saat sinkron berhasil terakhir; tanpa itu tidak ada yang jujur untuk disebutkan.
    const waktu = [pembaruan.terakhir?.pada ?? "", pembaruan.panasTerakhir, pemindai.selesaiPada].find((x) => x && sah(x));
    if (!waktu) return null;
    const sidang = await muatSidangCermin(db, dari, sampai, p.batas);
    const sekarang = deps.sekarang();
    const keterangan = keteranganTakTerjangkau(waktu, sekarang);
    return {
      ok: true,
      data: {
        ok: true,
        dari,
        sampai,
        diperiksaPada: waktu,
        sidang,
        antrian: { terbaca: false, alasan: "SIPP tidak terjangkau", peta: {}, tanggal: [] },
        dariCermin: true,
        waktuSinkron: waktu,
        keterangan,
      },
    };
  } catch {
    return null;
  }
}

export type HasilMediasiDarurat = {
  ok: true;
  data: {
    ok: true;
    dari: string;
    sampai: string;
    terbaca: true;
    alasan: "";
    mediasi: Array<Record<string, unknown>>;
    dariCermin: true;
    waktuSinkron: string;
    keterangan: string;
  };
};

export async function mediasiDariCerminDarurat(
  p: { dari?: string; sampai?: string; cari?: string; batas?: number },
  deps: DepsDarurat = depsDaruratAsli
): Promise<HasilMediasiDarurat | null> {
  try {
    if (String(p.cari ?? "").trim() !== "") return null;
    const dari = String(p.dari ?? "").trim();
    const sampai = String(p.sampai ?? "").trim() || dari;
    if (!TANGGAL_ISO.test(dari) || !TANGGAL_ISO.test(sampai) || sampai < dari) return null;
    const db = await deps.db();
    if ((await muatKeadaanPemindai(db)).status !== "selesai") return null;
    const k = await muatKeadaanMediasi(db);
    // Hanya jendela yang terakhir BERHASIL dihitung (jejak `terakhir` tidak maju saat gagal).
    if (!k.terakhir || !sah(k.terakhir) || !TANGGAL_ISO.test(k.dari) || !TANGGAL_ISO.test(k.sampai)) return null;
    if (dari < k.dari || sampai > k.sampai) return null;
    const sekarang = deps.sekarang();
    const mediasi = await muatMediasiCermin(db, dari, sampai, sekarang, p.batas);
    const keterangan = keteranganTakTerjangkau(k.terakhir, sekarang);
    return {
      ok: true,
      data: {
        ok: true,
        dari,
        sampai,
        terbaca: true,
        alasan: "",
        mediasi,
        dariCermin: true,
        waktuSinkron: k.terakhir,
        keterangan,
      },
    };
  } catch {
    return null;
  }
}
