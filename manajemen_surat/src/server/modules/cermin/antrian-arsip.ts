/**
 * ============================================================================
 * ARSIP ANTRIAN PADA CERMIN SIDANG (5 Nov 2026)
 * ============================================================================
 *
 * Layar Jadwal Sidang TETAP membaca antrian LANGSUNG dari sipp_turunan_antrian (lewat bot, seperti sekarang) -
 * snapshot ini tidak menggantikan apa pun. Gunanya dua: (1) arsip - nomor antrian, disidang, jam ambil dan jam
 * hadir terakhir tiap perkara hari itu tidak hilang saat mesin antrian berganti hari; (2) bahan jawaban darurat
 * saat SIPP/antrian tidak terjangkau, selalu BERPENANDA BASI (darurat.ts) dan tidak pernah menggantikan keadaan
 * langsung (`antrian.terbaca` tetap false).
 *
 * Sumber: GET /internal/aleta-bot/cermin/antrian = dua SELECT yang SAMA dengan yang dijalankan layar Jadwal pada
 * tiap muat (antrianSidangService.petaAntrian) ke sipp_turunan_antrian saja. Tanpa tulisan ke mana pun di sana.
 *
 *   * hanya di jam sidang (07.00-17.30 WITA) dan hanya bila saklar `pemindaiAktif` menyala, pemindaian awal
 *     selesai, dan bot mendukung rutenya; selang 5 menit (jejak "antrian-arsip");
 *   * galat: selang berlipat dua tiap galat (paling lama 30 menit); antrian tak terbaca tidak menimpa apa pun;
 *   * kolom antrian_* di baris sidang yang tanggalnya muncul di antrian; antrian_dibaca_at = waktu BACA TERAKHIR
 *     yang mengonfirmasi nilainya.
 *
 * Beban: 2 SELECT ringan ke sipp_turunan_antrian tiap 5 menit pada jam sidang = 0,4 kueri/menit. Nol ke SIPP.
 */
import { dalamJendelaJam, type PengaturanCermin } from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, withTransaction, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCerminLengkap } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";

export const SELANG_ARSIP_ANTRIAN_MS = 5 * 60_000;
export const JAM_ARSIP_ANTRIAN = { mulai: "07:00", selesai: "17:30" } as const;
const SELANG_GALAT_MAKS_MS = 30 * 60_000;
const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type KeadaanArsipAntrian = {
  /** ISO UTC: bacaan BERHASIL terakhir. */
  terakhir: string;
  /** ISO UTC: percobaan terakhir (berhasil atau tidak) - dasar selang. */
  percobaanTerakhir: string;
  baris: number;
  galat: { terakhir: string; pada: string; beruntun: number };
};

export function keadaanArsipAntrianAwal(): KeadaanArsipAntrian {
  return { terakhir: "", percobaanTerakhir: "", baris: 0, galat: { terakhir: "", pada: "", beruntun: 0 } };
}

export async function muatKeadaanArsipAntrian(db: AletaDatabase): Promise<KeadaanArsipAntrian> {
  const x = (await bacaJejak(db, KUNCI_JEJAK.antrianArsip)) as Partial<KeadaanArsipAntrian> | null;
  const dasar = keadaanArsipAntrianAwal();
  if (!x || typeof x !== "object") return dasar;
  const g = x.galat && typeof x.galat === "object" ? x.galat : dasar.galat;
  return {
    terakhir: typeof x.terakhir === "string" ? x.terakhir : "",
    percobaanTerakhir: typeof x.percobaanTerakhir === "string" ? x.percobaanTerakhir : "",
    baris: Number(x.baris) || 0,
    galat: { terakhir: String(g.terakhir ?? ""), pada: String(g.pada ?? ""), beruntun: Number(g.beruntun) || 0 },
  };
}

export type DepsArsipAntrian = {
  db: () => Promise<AletaDatabase>;
  bot: Pick<BotCerminLengkap, "antrian">;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsArsipAntrianAsli: DepsArsipAntrian = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

export type HasilArsipAntrian = {
  alasan: "mati" | "menunggu-pemindaian" | "luar-jam" | "menunggu-selang" | "bot-lama" | "sibuk" | "ok" | "galat";
  baris?: number;
  pesan?: string;
};

type Wadah = { jalan: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminArsipAntrian?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminArsipAntrian ??= { jalan: false };
  return SIMPAN.__aletaCerminArsipAntrian;
}
/** Hanya untuk uji. */
export function aturUlangArsipAntrian() {
  SIMPAN.__aletaCerminArsipAntrian = { jalan: false };
}

export async function putaranArsipAntrian(deps: DepsArsipAntrian = depsArsipAntrianAsli, opsi: { paksa?: boolean } = {}): Promise<HasilArsipAntrian> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  w.jalan = true;
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    if (!deps.bot.antrian) return { alasan: "bot-lama" };
    const sekarang = deps.sekarang();
    if (!opsi.paksa && !dalamJendelaJam(waktuPengadilan(sekarang).jam.slice(0, 5), JAM_ARSIP_ANTRIAN.mulai, JAM_ARSIP_ANTRIAN.selesai)) {
      return { alasan: "luar-jam" };
    }
    const db = await deps.db();
    if ((await muatKeadaanPemindai(db)).status !== "selesai") return { alasan: "menunggu-pemindaian" };
    const k = await muatKeadaanArsipAntrian(db);
    const iso = sekarang.toISOString();
    if (!opsi.paksa && k.percobaanTerakhir) {
      const selang = k.galat.beruntun > 0 ? Math.min(SELANG_GALAT_MAKS_MS, SELANG_ARSIP_ANTRIAN_MS * 2 ** k.galat.beruntun) : SELANG_ARSIP_ANTRIAN_MS;
      if (sekarang.getTime() - (Date.parse(k.percobaanTerakhir) || 0) < selang) return { alasan: "menunggu-selang" };
    }
    k.percobaanTerakhir = iso;
    try {
      const r = await deps.bot.antrian();
      if (!r.ok) throw new Error(r.error);
      // Antrian tidak terbaca: tidak menimpa arsip dengan kosong.
      if (!r.data.terbaca) throw new Error(r.data.alasan || "antrian tidak terbaca");
      const baca = r.data.dibacaPada && Number.isFinite(Date.parse(r.data.dibacaPada)) ? r.data.dibacaPada : iso;
      const baris = r.data.baris.filter((b) => TANGGAL_ISO.test(String(b.tanggalSidang)) && String(b.perkaraId));
      await withTransaction(db, async (tx) => {
        for (const b of baris) {
          await tx.run(
            `UPDATE aleta_cermin_sidang
                SET antrian_nomor = ?, antrian_disidang = ?, antrian_keadaan = ?, antrian_jam_ambil = ?, antrian_jam_hadir = ?, antrian_dibaca_at = ?
              WHERE perkara_id = ? AND tanggal_sidang = ? AND terhapus_at = ''`,
            [b.nomor, b.disidang, String(b.keadaan ?? ""), String(b.jamAmbil ?? ""), String(b.jamHadirTerakhir ?? ""), baca, String(b.perkaraId), String(b.tanggalSidang)]
          );
        }
      });
      k.terakhir = baca;
      k.baris = baris.length;
      k.galat = { terakhir: "", pada: "", beruntun: 0 };
      await tulisJejak(db, KUNCI_JEJAK.antrianArsip, k, iso);
      return { alasan: "ok", baris: baris.length };
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "arsip antrian gagal";
      k.galat = { terakhir: pesan.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
      await tulisJejak(db, KUNCI_JEJAK.antrianArsip, k, iso);
      return { alasan: "galat", pesan };
    }
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "arsip antrian gagal" };
  } finally {
    w.jalan = false;
  }
}

export type ArsipAntrianBaris = {
  nomor: number | null;
  disidang: number | null;
  keadaan: string;
  jamAmbil: string;
  jamHadirTerakhir: string;
  dibacaPada: string;
};

/** Arsip antrian untuk jawaban darurat: kunci "perkaraId|tanggal"; hanya baris yang pernah dibaca. */
export async function muatArsipAntrian(db: AletaDatabase, dari: string, sampai: string): Promise<Record<string, ArsipAntrianBaris>> {
  const rows = await db.queryAll<{
    perkara_id: string;
    tanggal_sidang: string;
    antrian_nomor: number | null;
    antrian_disidang: number | null;
    antrian_keadaan: string;
    antrian_jam_ambil: string;
    antrian_jam_hadir: string;
    antrian_dibaca_at: string;
  }>(
    `SELECT perkara_id, tanggal_sidang, antrian_nomor, antrian_disidang, antrian_keadaan, antrian_jam_ambil, antrian_jam_hadir, antrian_dibaca_at
       FROM aleta_cermin_sidang
      WHERE terhapus_at = '' AND antrian_dibaca_at <> '' AND tanggal_sidang >= ? AND tanggal_sidang <= ?`,
    [dari, sampai]
  );
  const hasil: Record<string, ArsipAntrianBaris> = {};
  for (const r of rows) {
    hasil[`${r.perkara_id}|${r.tanggal_sidang}`] = {
      nomor: r.antrian_nomor === null || r.antrian_nomor === undefined ? null : Number(r.antrian_nomor),
      disidang: r.antrian_disidang === null || r.antrian_disidang === undefined ? null : Number(r.antrian_disidang),
      keadaan: String(r.antrian_keadaan ?? ""),
      jamAmbil: String(r.antrian_jam_ambil ?? ""),
      jamHadirTerakhir: String(r.antrian_jam_hadir ?? ""),
      dibacaPada: String(r.antrian_dibaca_at),
    };
  }
  return hasil;
}
