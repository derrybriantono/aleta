/**
 * ============================================================================
 * HITUNGAN TAG STATUS PERKARA DARI CERMIN (A5, 25 Okt 2026)
 * ============================================================================
 *
 * Layar Status Perkara menanyakan jumlah tiap tag pada satu LINGKUP (dasar
 * tanggal x periode). Jalur lama: sembilan belas kueri penyisir SIPP per muat
 * (1,2-6,6 detik, menahan sambungan SIPP). Dari cermin: SATU kueri Postgres atas
 * aleta_cermin_tag yang dihitung bot di latar (tag.ts).
 *
 *   * SAKLAR `status` MATI bawaan; mati / cermin belum segar / tag belum lengkap
 *     => null => jalur lama persis seperti sekarang.
 *   * Lingkup disaring dengan tanggal dasar yang sama dengan jalur lama (kolom
 *     aleta_cermin_perkara, himpunan tertutup KOLOM_DASAR_TANGGAL) dan periode yang
 *     dihitung dengan rumus yang sama (rentangLingkupTag).
 *   * "Seluruhnya" (total) tidak menyaring apa pun, seperti jalur lama.
 *   * Segar = siklus tag LENGKAP terakhir tidak lebih tua dari max(30 menit,
 *     3 x selang), tanpa tag terpotong/gagal, galat beruntun < 3, DAN tulisan
 *     lewat ALETA tidak tertinggal lebih dari 90 detik dari siklus itu (hitungan
 *     tag adalah angka ringkasan, jadi toleransi pendek diterima; lewat itu layar
 *     kembali membaca SIPP).
 *   * Katalog (nama tag, kelompok, dasar) disalin dari bot saat siklus; bot lama
 *     tanpa rute katalog => null.
 */
import { kolomDasarTanggal, rentangLingkupTag, type PengaturanCermin } from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { kesegaranCermin } from "@/server/modules/cermin/kesegaran";
import { pengaturanCerminBerlaku } from "@/server/modules/cermin/pengaturan";
import { muatKatalogTag, muatKeadaanTag } from "@/server/modules/cermin/tag";
import { tulisCerminTerakhirMs } from "@/server/modules/cermin/setelah-tulisan";

/** Toleransi tulisan yang belum tercermin pada hitungan tag (ms). */
export const TOLERANSI_TULISAN_TAG_MS = 90_000;

export type MasukanTag = { dasarTanggal?: string; periode?: string; acuan?: string; tagDari?: string; tagSampai?: string; katalogSaja?: string };

export type DepsStatusCermin = { db: () => Promise<AletaDatabase>; pengaturan: () => Promise<PengaturanCermin>; sekarang: () => Date };
export const depsStatusCerminAsli: DepsStatusCermin = { db: getDatabase, pengaturan: () => pengaturanCerminBerlaku(), sekarang: () => new Date() };

export type AlasanTidakDariCerminTag = "saklar-mati" | "katalog-saja" | "cermin-tertinggal" | "galat";

export async function tagSegar(db: AletaDatabase, p: PengaturanCermin, sekarang: Date): Promise<{ segar: boolean; alasan: string; diperbaruiPada: string | null }> {
  const dasar = await kesegaranCermin(db, p, sekarang);
  if (!dasar.segar) return { segar: false, alasan: dasar.alasan, diperbaruiPada: null };
  const k = await muatKeadaanTag(db);
  const selesaiMs = Date.parse(k.siklusSelesai);
  if (!Number.isFinite(selesaiMs)) return { segar: false, alasan: "siklus penanda belum pernah lengkap", diperbaruiPada: null };
  if (k.galat.beruntun >= 3) return { segar: false, alasan: `penanda gagal ${k.galat.beruntun}x beruntun`, diperbaruiPada: null };
  if (k.tidakLengkap.length > 0) return { segar: false, alasan: `daftar tag terpotong: ${k.tidakLengkap.slice(0, 3).join(", ")}`, diperbaruiPada: null };
  const batasMs = Math.max(30 * 60_000, 3 * p.selangTagMenit * 60_000);
  if (sekarang.getTime() - selesaiMs > batasMs) return { segar: false, alasan: `siklus penanda lengkap terakhir ${Math.round((sekarang.getTime() - selesaiMs) / 1000)} detik lalu`, diperbaruiPada: null };
  const mulaiMs = Date.parse(k.siklusSelesaiMulai);
  const tulis = tulisCerminTerakhirMs();
  if (tulis > (Number.isFinite(mulaiMs) ? mulaiMs : 0) && Date.now() - tulis > TOLERANSI_TULISAN_TAG_MS) {
    return { segar: false, alasan: "menunggu tulisan terakhir masuk penanda", diperbaruiPada: null };
  }
  return { segar: true, alasan: "", diperbaruiPada: new Date(selesaiMs).toISOString() };
}

export type HasilTagCermin = {
  ok: true;
  data: {
    ok: true;
    katalogSaja: false;
    jumlah: Record<string, number>;
    lingkup: { dari: string; sampai: string; perkara: number };
    tag: Array<Record<string, unknown>>;
    kelompok: Array<Record<string, unknown>>;
    dasar: Array<Record<string, unknown>>;
    batasId?: number;
    cermin: { diperbaruiPada: string | null };
  };
};

/** Hitungan tag dari cermin, atau null (pakai jalur lama). Tidak pernah melempar. */
export async function bacaTagDariCermin(
  m: MasukanTag,
  deps: DepsStatusCermin = depsStatusCerminAsli,
  catat?: (alasan: AlasanTidakDariCerminTag, rincian?: string) => void
): Promise<HasilTagCermin | null> {
  try {
    if (String(m.katalogSaja ?? "") === "1") {
      catat?.("katalog-saja");
      return null;
    }
    const p = await deps.pengaturan();
    if (p.layar.status !== true) {
      catat?.("saklar-mati");
      return null;
    }
    const sekarang = deps.sekarang();
    const db = await deps.db();
    const segar = await tagSegar(db, p, sekarang);
    if (!segar.segar) {
      catat?.("cermin-tertinggal", segar.alasan);
      return null;
    }
    const katalog = await muatKatalogTag(db);
    const daftarTag = Array.isArray(katalog?.tag) ? (katalog!.tag as Array<Record<string, unknown>>) : null;
    if (!daftarTag || daftarTag.length === 0) {
      catat?.("cermin-tertinggal", "katalog tag belum tersimpan");
      return null;
    }
    const hariIni = waktuPengadilan(sekarang).tanggal;
    const lingkup = rentangLingkupTag(String(m.periode || "total"), String(m.acuan || ""), String(m.tagDari || ""), String(m.tagSampai || ""), hariIni);
    const kolom = kolomDasarTanggal(String(m.dasarTanggal || "daftar")); // himpunan tertutup - aman disisipkan
    const syarat: string[] = [];
    const nilai: string[] = [];
    if (lingkup.dari || lingkup.sampai) {
      syarat.push(`p.${kolom} <> ''`);
      if (lingkup.dari) {
        syarat.push(`p.${kolom} >= ?`);
        nilai.push(lingkup.dari);
      }
      if (lingkup.sampai) {
        syarat.push(`p.${kolom} <= ?`);
        nilai.push(lingkup.sampai);
      }
    }
    const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
    const [hitungan, jumlahPerkara] = await Promise.all([
      db.queryAll<{ k: string; n: number | string }>(
        syarat.length
          ? `SELECT t.tag_kunci AS k, COUNT(*) AS n FROM aleta_cermin_tag t JOIN aleta_cermin_perkara p ON p.perkara_id = t.perkara_id ${where} GROUP BY t.tag_kunci`
          : "SELECT tag_kunci AS k, COUNT(*) AS n FROM aleta_cermin_tag GROUP BY tag_kunci",
        nilai
      ),
      db.queryAll<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_cermin_perkara p ${where}`, nilai),
    ]);
    const jumlah: Record<string, number> = {};
    for (const t of daftarTag) jumlah[String(t.kunci)] = 0;
    for (const r of hitungan) if (String(r.k) in jumlah) jumlah[String(r.k)] = Number(r.n) || 0;
    return {
      ok: true,
      data: {
        ok: true,
        katalogSaja: false,
        jumlah,
        lingkup: { dari: lingkup.dari, sampai: lingkup.sampai, perkara: Number(jumlahPerkara[0]?.n) || 0 },
        tag: daftarTag,
        kelompok: (katalog!.kelompok as Array<Record<string, unknown>>) ?? [],
        dasar: (katalog!.dasar as Array<Record<string, unknown>>) ?? [],
        ...(typeof katalog!.batasId === "number" ? { batasId: katalog!.batasId as number } : {}),
        cermin: { diperbaruiPada: segar.diperbaruiPada },
      },
    };
  } catch (galat) {
    catat?.("galat", galat instanceof Error ? galat.message : "galat");
    return null;
  }
}
