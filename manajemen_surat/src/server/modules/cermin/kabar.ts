/**
 * ============================================================================
 * KABAR PERUBAHAN DATA SIPP DARI JEJAK CERMIN (A8 / U17, 25 Okt 2026)
 * ============================================================================
 *
 * Halaman perkara SIPP tidak menyegarkan dirinya: petugas yang membukanya pukul
 * 10.00 membaca keadaan pukul 10.00 walau pukul 10.12 petugas lain mengubah
 * data pihak, sidang, atau putusan perkara itu. Panel ekstensi menanyakan ke
 * sini tiap setengah menit (hanya saat tab terlihat) dan memberi kabar bila
 * cermin mencatat perubahan SESUDAH keadaan yang dibacanya.
 *
 * Dasar: `cermin_diperbarui` pada aleta_cermin_perkara / aleta_cermin_sidang
 * hanya berganti bila ISI baris itu berubah (penyimpan membandingkan sidik),
 * jadi waktunya = waktu perubahan terakhir yang SAMPAI di cermin. Satu baca
 * Postgres per tanya; SIPP tidak disentuh.
 *
 * Aturan:
 *   * SAKLAR `kabar` MATI bawaan. Mati / cermin tertinggal / perkara belum ada
 *     di cermin => `aktif:false` dan klien diam (tidak ada kabar palsu).
 *   * Tanpa `sejak` (tanya pertama) => hanya mengembalikan `token` dasar.
 *   * Tidak menyebut nama petugas: cermin tidak menyimpan siapa yang mengubah
 *     (riwayat per petugas ada di jejak audit SIPP, bukan di cermin). Yang dikabarkan
 *     hanya BAGIAN yang berubah (perkara / jadwal sidang) dan pukul berapa.
 *   * `kemungkinanDariAleta`: perubahan jatuh dalam 2 menit dari tulisan terakhir
 *     lewat ALETA - klien memakai kalimat yang lebih lunak (bisa jadi tindakan
 *     petugas itu sendiri), bukan menuduh orang lain.
 *   * Hanya keterangan non-pribadi; tidak pernah melempar.
 */
import type { PengaturanCermin } from "@/lib/cermin";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { kesegaranCermin } from "@/server/modules/cermin/kesegaran";
import { pengaturanCerminBerlaku } from "@/server/modules/cermin/pengaturan";
import { tulisCerminTerakhirMs } from "@/server/modules/cermin/setelah-tulisan";

export type KabarPerubahan = {
  /** false = saklar mati / cermin tertinggal / perkara belum tercermin: klien diam. */
  aktif: boolean;
  alasan: string;
  /** Waktu perubahan terakhir yang tercermin (ISO UTC); dipakai klien sebagai `sejak` berikutnya. */
  token: string;
  /** Ada perubahan SESUDAH `sejak`. */
  berubah: boolean;
  diubahPada: string | null;
  /** Bagian yang berubah: "perkara" (identitas, tahapan, majelis, putusan ...) dan/atau "sidang". */
  bagian: Array<"perkara" | "sidang">;
  kemungkinanDariAleta: boolean;
};

export type DepsKabar = {
  db: () => Promise<AletaDatabase>;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
  tulisAletaMs: () => number;
};
export const depsKabarAsli: DepsKabar = {
  db: getDatabase,
  pengaturan: () => pengaturanCerminBerlaku(),
  sekarang: () => new Date(),
  tulisAletaMs: tulisCerminTerakhirMs,
};

/** Jarak (ms) antara perubahan dan tulisan ALETA terakhir yang membuatnya "mungkin dari ALETA". */
export const JENDELA_DARI_ALETA_MS = 120_000;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function tidakAktif(alasan: string): KabarPerubahan {
  return { aktif: false, alasan, token: "", berubah: false, diubahPada: null, bagian: [], kemungkinanDariAleta: false };
}

export async function kabarPerubahanDariCermin(
  nomorMentah: string,
  sejakMentah: string,
  deps: DepsKabar = depsKabarAsli
): Promise<KabarPerubahan> {
  try {
    const nomor = String(nomorMentah || "").trim();
    if (!nomor) return tidakAktif("nomor-kosong");
    const p = await deps.pengaturan();
    if (p.layar.kabar !== true) return tidakAktif("saklar-mati");
    const db = await deps.db();
    const segar = await kesegaranCermin(db, p, deps.sekarang());
    if (!segar.segar) return tidakAktif("cermin-tertinggal");

    const baris = await db.queryAll<{ perkara_id: string; cermin_diperbarui: string }>(
      "SELECT perkara_id, cermin_diperbarui FROM aleta_cermin_perkara WHERE nomor_perkara = ? LIMIT 1",
      [nomor]
    );
    const r = baris[0];
    if (!r) return tidakAktif("belum-ada");
    const sidang = await db.queryAll<{ terbaru: string | null }>(
      "SELECT MAX(cermin_diperbarui) AS terbaru FROM aleta_cermin_sidang WHERE perkara_id = ?",
      [String(r.perkara_id)]
    );
    const tPerkara = String(r.cermin_diperbarui || "");
    const tSidang = String(sidang[0]?.terbaru || "");
    const token = tPerkara > tSidang ? tPerkara : tSidang;

    const sejak = String(sejakMentah || "").trim();
    // `sejak` yang bukan waktu ISO dianggap tanya pertama (tidak ada kabar palsu dari masukan rusak).
    const punyaDasar = ISO.test(sejak);
    const bagian: KabarPerubahan["bagian"] = [];
    if (punyaDasar) {
      if (tPerkara > sejak) bagian.push("perkara");
      if (tSidang > sejak) bagian.push("sidang");
    }
    const berubah = bagian.length > 0;
    const diubahMs = Date.parse(token);
    const dekatAleta = berubah && Number.isFinite(diubahMs) && Math.abs(diubahMs - deps.tulisAletaMs()) <= JENDELA_DARI_ALETA_MS && deps.tulisAletaMs() > 0;
    return {
      aktif: true,
      alasan: "",
      token,
      berubah,
      diubahPada: berubah ? token : null,
      bagian,
      kemungkinanDariAleta: dekatAleta,
    };
  } catch {
    return tidakAktif("galat");
  }
}
