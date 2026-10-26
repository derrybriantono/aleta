/**
 * ============================================================================
 * "KEADAAN PERKARA" DARI CERMIN - SATU PANGGILAN UNTUK PANEL EKSTENSI (A6, 25 Okt 2026)
 * ============================================================================
 *
 * Panel ekstensi di halaman SIPP menampilkan ringkasan keadaan satu perkara
 * (tahapan, majelis, sidang berikut, putusan, penanda). Dari cermin cukup SATU
 * baca Postgres - tanpa menyentuh SIPP. Dipakai dua cara:
 *
 *   1. rute /api/aleta-ecourt/keadaan-perkara (ekstensi dan layar lain);
 *   2. disisipkan ke jawaban /api/aleta-bot/sipp-konteks sebagai `keadaanCermin`,
 *      supaya panel TETAP TAMPIL walau bot atau SIPP sedang tidak menjawab
 *      (ekstensi menggambar panel ringan dari sini, bertanda "Cermin").
 *
 * Aturan (sama dengan layar lain):
 *   * SAKLAR `ekstensi` MATI bawaan; mati / cermin tertinggal / perkara belum
 *     ada di cermin / baru ada tulisan yang belum tercermin => null (jalur lama).
 *   * Hanya keterangan non-pribadi: tanpa nama pihak, alamat, atau isi dokumen.
 *     Nama majelis/panitera/jurusita adalah pejabat, bukan data pribadi pihak.
 *   * Penanda (tag) hanya disertakan bila siklus penanda lengkap dan segar.
 *   * Penjaga sebelum MENULIS ke SIPP/ABT tetap membaca SIPP langsung; cermin
 *     tidak pernah menjadi dasar tulisan.
 */
import type { PengaturanCermin } from "@/lib/cermin";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { kesegaranCermin } from "@/server/modules/cermin/kesegaran";
import { cerminMenyusulTulisan } from "@/server/modules/cermin/pembaruan";
import { pengaturanCerminBerlaku } from "@/server/modules/cermin/pengaturan";
import { tagSegar } from "@/server/modules/cermin/status-cermin";
import { muatKatalogTag } from "@/server/modules/cermin/tag";

export type KeadaanPerkaraCermin = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number | null;
  jenisPerkaraId: number | null;
  tanggalPendaftaran: string;
  prodeo: boolean;
  tahapan: string;
  proses: string;
  majelis: string;
  panitera: string;
  jurusita: string;
  sidangPertama: string;
  sidangTerakhir: string;
  sidangBerikut: string;
  jumlahSidang: number;
  sidangMendatang: Array<{ tanggal: string; jam: string; ruangan: string; agenda: string; ditunda: boolean }>;
  putusan: { tanggal: string; status: string; verstek: boolean; minutasi: string; bht: string };
  /** null = penanda tidak dapat dipercaya sekarang (siklus belum lengkap/tertinggal). */
  tag: Array<{ kunci: string; label: string; nada: string }> | null;
  /** Waktu terakhir cermin dihitung ulang (ISO UTC), untuk tanda "Cermin - diperbarui hh.mm". */
  diperbaruiPada: string | null;
  sippDiperbarui: string;
};

export type DepsKeadaanPerkara = {
  db: () => Promise<AletaDatabase>;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};
export const depsKeadaanPerkaraAsli: DepsKeadaanPerkara = { db: getDatabase, pengaturan: () => pengaturanCerminBerlaku(), sekarang: () => new Date() };

export type AlasanTidakAda = "saklar-mati" | "nomor-kosong" | "cermin-tertinggal" | "belum-ada" | "galat";

type BarisPerkara = Record<string, string | number | null>;

export async function keadaanPerkaraDariCermin(
  nomorMentah: string,
  deps: DepsKeadaanPerkara = depsKeadaanPerkaraAsli,
  catat?: (alasan: AlasanTidakAda, rincian?: string) => void
): Promise<KeadaanPerkaraCermin | null> {
  try {
    const nomor = String(nomorMentah || "").trim();
    if (!nomor) {
      catat?.("nomor-kosong");
      return null;
    }
    const p = await deps.pengaturan();
    if (p.layar.ekstensi !== true) {
      catat?.("saklar-mati");
      return null;
    }
    const sekarang = deps.sekarang();
    const db = await deps.db();
    const segar = await kesegaranCermin(db, p, sekarang);
    if (!segar.segar) {
      catat?.("cermin-tertinggal", segar.alasan);
      return null;
    }
    if (!cerminMenyusulTulisan()) {
      catat?.("cermin-tertinggal", "menunggu tulisan terakhir masuk cermin");
      return null;
    }
    const baris = await db.queryAll<BarisPerkara>("SELECT * FROM aleta_cermin_perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
    const r = baris[0];
    if (!r) {
      catat?.("belum-ada");
      return null;
    }
    const id = String(r.perkara_id);
    const hariIni = sekarang.toISOString().slice(0, 10);
    const sidang = await db.queryAll<{ tanggal_sidang: string; jam_sidang: string; ruangan: string; agenda: string; ditunda: number }>(
      "SELECT tanggal_sidang, jam_sidang, ruangan, agenda, ditunda FROM aleta_cermin_sidang WHERE perkara_id = ? AND tanggal_sidang >= ? ORDER BY tanggal_sidang ASC, jam_sidang ASC LIMIT 3",
      [id, hariIni]
    );

    let tag: KeadaanPerkaraCermin["tag"] = null;
    try {
      const tagOk = await tagSegar(db, p, sekarang);
      if (tagOk.segar) {
        const katalog = await muatKatalogTag(db);
        const daftar = Array.isArray(katalog?.tag) ? (katalog!.tag as Array<{ kunci: string; label: string; nada: string }>) : [];
        const peta = new Map(daftar.map((t) => [String(t.kunci), t]));
        const anggota = await db.queryAll<{ tag_kunci: string }>("SELECT tag_kunci FROM aleta_cermin_tag WHERE perkara_id = ? ORDER BY tag_kunci", [id]);
        tag = anggota
          .map((a) => peta.get(String(a.tag_kunci)))
          .filter((t): t is { kunci: string; label: string; nada: string } => Boolean(t))
          .map((t) => ({ kunci: t.kunci, label: t.label, nada: t.nada }));
      }
    } catch {
      tag = null;
    }

    const angka = (n: unknown) => (n === null || n === undefined || n === "" || !Number.isFinite(Number(n)) ? null : Number(n));
    return {
      perkaraId: id,
      nomorPerkara: String(r.nomor_perkara ?? ""),
      jenisPerkara: String(r.jenis_perkara_nama ?? ""),
      alurPerkaraId: angka(r.alur_perkara_id),
      jenisPerkaraId: angka(r.jenis_perkara_id),
      tanggalPendaftaran: String(r.tanggal_pendaftaran ?? ""),
      prodeo: Number(r.prodeo) === 1,
      tahapan: String(r.tahapan_terakhir_text ?? ""),
      proses: String(r.proses_terakhir_text ?? ""),
      majelis: String(r.majelis_hakim ?? ""),
      panitera: String(r.panitera_pengganti ?? ""),
      jurusita: String(r.jurusita ?? ""),
      sidangPertama: String(r.sidang_pertama ?? ""),
      sidangTerakhir: String(r.sidang_terakhir ?? ""),
      sidangBerikut: String(r.sidang_berikut ?? ""),
      jumlahSidang: Number(r.jumlah_sidang) || 0,
      sidangMendatang: sidang.map((s) => ({
        tanggal: String(s.tanggal_sidang),
        jam: String(s.jam_sidang).slice(0, 5),
        ruangan: String(s.ruangan),
        agenda: String(s.agenda),
        ditunda: Number(s.ditunda) === 1,
      })),
      putusan: {
        tanggal: String(r.tanggal_putusan ?? ""),
        status: String(r.status_putusan ?? ""),
        verstek: Number(r.putusan_verstek) === 1,
        minutasi: String(r.tanggal_minutasi ?? ""),
        bht: String(r.tanggal_bht ?? ""),
      },
      tag,
      diperbaruiPada: segar.diperbaruiPada,
      sippDiperbarui: String(r.sipp_diperbarui ?? ""),
    };
  } catch (galat) {
    catat?.("galat", galat instanceof Error ? galat.message : "galat");
    return null;
  }
}
