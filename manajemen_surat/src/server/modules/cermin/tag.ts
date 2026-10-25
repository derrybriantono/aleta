/**
 * ============================================================================
 * PENANDA STATUS PERKARA DI CERMIN (A5, 25 Okt 2026) - menggantikan K8
 * ============================================================================
 *
 * Anggota tiap tag (perkara x tag) atas SELURUH register dihitung bot (definisi
 * TETAP satu-satunya di tagPerkaraService.js) dan disimpan di aleta_cermin_tag.
 * Hitungan tag per lingkup tanggal kemudian cukup SATU kueri Postgres (lihat
 * status-cermin.ts), bukan sembilan belas kueri penyisir SIPP per muat.
 *
 * SIKLUS: tiap `selangTagMenit` (10 menit bawaan) -- atau lebih cepat (>= 1 menit)
 * bila ada tulisan lewat ALETA -- seluruh tag dihitung ulang, beberapa tag per
 * detak (enam per 5 detik) supaya satu permintaan ke SIPP selalu pendek dan siklus
 * lengkap selesai dalam kira-kira dua menit. Daftar anggota tiap tag diganti
 * dengan selisih (yang sama tidak ditulis ulang). Siklus dianggap LENGKAP hanya
 * bila semua tag terhitung dan tidak ada yang terpotong pagu bot; selain itu
 * hitungan cermin tidak dipakai layar.
 *
 * Hanya MEMBACA SIPP (rute GET bot); menulis hanya aleta_cermin_tag.
 */
import { bersihkanKeadaanTag, type KeadaanTag, type PengaturanCermin } from "@/lib/cermin";
import { getDatabase, withTransaction, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCerminLengkap } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { tulisCerminTerakhirMs } from "@/server/modules/cermin/setelah-tulisan";

export type DepsTag = {
  db: () => Promise<AletaDatabase>;
  bot: Pick<BotCerminLengkap, "tagKatalog" | "tagPerkara">;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsTagAsli: DepsTag = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

/** Tag yang dihitung per detak. */
export const TAG_PER_DETAK = 6;
/** Siklus dipercepat tulisan: paling cepat sekali semenit. */
export const SIKLUS_TERCEPAT_MS = 60_000;

export async function muatKeadaanTag(db: AletaDatabase): Promise<KeadaanTag> {
  return bersihkanKeadaanTag(await bacaJejak(db, KUNCI_JEJAK.tag));
}

export async function muatKatalogTag(db: AletaDatabase): Promise<Record<string, unknown> | null> {
  const k = await bacaJejak(db, KUNCI_JEJAK.tagKatalog);
  return k && typeof k === "object" ? (k as Record<string, unknown>) : null;
}

/** Mengganti anggota satu tag dengan selisih: yang hilang dihapus, yang baru ditambah. */
export async function gantiAnggotaTag(db: AletaDatabase, kunci: string, perkaraId: string[], sekarang: string): Promise<{ ditambah: number; dihapus: number; tetap: number }> {
  const baru = new Set(perkaraId.map(String));
  const lama = new Set((await db.queryAll<{ perkara_id: string }>("SELECT perkara_id FROM aleta_cermin_tag WHERE tag_kunci = ?", [kunci])).map((r) => String(r.perkara_id)));
  const tambah = [...baru].filter((id) => !lama.has(id));
  const hapus = [...lama].filter((id) => !baru.has(id));
  if (tambah.length > 0 || hapus.length > 0) {
    await withTransaction(db, async (tx) => {
      for (let mulai = 0; mulai < hapus.length; mulai += 500) {
        const bagian = hapus.slice(mulai, mulai + 500);
        await tx.run(`DELETE FROM aleta_cermin_tag WHERE tag_kunci = ? AND perkara_id IN (${bagian.map(() => "?").join(", ")})`, [kunci, ...bagian]);
      }
      for (let mulai = 0; mulai < tambah.length; mulai += 200) {
        const bagian = tambah.slice(mulai, mulai + 200);
        await tx.run(
          `INSERT INTO aleta_cermin_tag (perkara_id, tag_kunci, cermin_diperbarui) VALUES ${bagian.map(() => "(?, ?, ?)").join(", ")}
           ON CONFLICT (perkara_id, tag_kunci) DO NOTHING`,
          bagian.flatMap((id) => [id, kunci, sekarang])
        );
      }
    });
  }
  return { ditambah: tambah.length, dihapus: hapus.length, tetap: baru.size - tambah.length };
}

type Wadah = { jalan: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminTag?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminTag ??= { jalan: false };
  return SIMPAN.__aletaCerminTag;
}
/** Hanya untuk uji. */
export function aturUlangTagCermin() {
  SIMPAN.__aletaCerminTag = { jalan: false };
}

export type HasilTag = {
  alasan: "mati" | "menunggu-pemindaian" | "menunggu-siklus" | "sibuk" | "ok" | "galat";
  diproses?: number;
  sisa?: number;
  siklusSelesai?: boolean;
  pesan?: string;
};

/**
 * Satu detak penanda: memulai siklus bila waktunya, lalu menghitung paling banyak
 * TAG_PER_DETAK tag. `paksa` memulai siklus baru sekarang juga (tombol, uji).
 */
export async function putaranTag(deps: DepsTag = depsTagAsli, opsi: { paksa?: boolean } = {}): Promise<HasilTag> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  w.jalan = true;
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    const db = await deps.db();
    if ((await muatKeadaanPemindai(db)).status !== "selesai") return { alasan: "menunggu-pemindaian" };
    const sekarang = deps.sekarang();
    const iso = sekarang.toISOString();
    const k = await muatKeadaanTag(db);

    if (k.antrian.length === 0) {
      const mulaiMs = Date.parse(k.siklusMulai);
      const umurMs = Number.isFinite(mulaiMs) ? sekarang.getTime() - mulaiMs : Number.POSITIVE_INFINITY;
      const jedaGalat = k.galat.beruntun > 0 ? Math.min(600_000, p.selangTagMenit * 60_000 * 2 ** k.galat.beruntun) : 0;
      const kotor = tulisCerminTerakhirMs() > (Number.isFinite(mulaiMs) ? mulaiMs : 0);
      const jatuhTempo = umurMs >= Math.max(p.selangTagMenit * 60_000, jedaGalat) || (kotor && umurMs >= SIKLUS_TERCEPAT_MS);
      if (!opsi.paksa && !jatuhTempo) return { alasan: "menunggu-siklus" };
      const katalog = await deps.bot.tagKatalog();
      if (!katalog.ok) {
        k.galat = { terakhir: katalog.error.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
        k.siklusMulai = iso; // jeda sampai siklus berikutnya
        await tulisJejak(db, KUNCI_JEJAK.tag, k, iso);
        return { alasan: "galat", pesan: katalog.error };
      }
      await tulisJejak(db, KUNCI_JEJAK.tagKatalog, katalog.data, iso);
      k.antrian = katalog.data.tag.map((t) => t.kunci);
      k.total = k.antrian.length;
      k.siklusMulai = iso;
      k.tidakLengkap = [];
      k.gagal = [];
    }

    const ambil = k.antrian.slice(0, TAG_PER_DETAK);
    let berhasil = 0;
    let gagalDetak = 0;
    let pesanGalat = "";
    for (const kunci of ambil) {
      const r = await deps.bot.tagPerkara(kunci);
      if (!r.ok) {
        gagalDetak += 1;
        pesanGalat = r.error;
        k.gagal = [...new Set([...k.gagal, kunci])];
        continue;
      }
      await gantiAnggotaTag(db, kunci, r.data.perkaraId, iso);
      if (r.data.terpotong) k.tidakLengkap = [...new Set([...k.tidakLengkap, kunci])];
      berhasil += 1;
    }
    k.antrian = k.antrian.slice(ambil.length);
    let siklusSelesai = false;
    if (k.antrian.length === 0) {
      if (k.gagal.length === 0 && k.tidakLengkap.length === 0) {
        k.siklusSelesai = iso;
        k.siklusSelesaiMulai = k.siklusMulai;
        siklusSelesai = true;
      }
    }
    if (berhasil === 0 && gagalDetak > 0) k.galat = { terakhir: pesanGalat.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
    else if (berhasil > 0) k.galat = { terakhir: "", pada: "", beruntun: 0 };
    await tulisJejak(db, KUNCI_JEJAK.tag, k, iso);
    if (berhasil === 0 && gagalDetak > 0) return { alasan: "galat", pesan: pesanGalat, diproses: 0, sisa: k.antrian.length };
    return { alasan: "ok", diproses: berhasil, sisa: k.antrian.length, siklusSelesai };
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "penanda gagal" };
  } finally {
    w.jalan = false;
  }
}
