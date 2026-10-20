import { JENIS_PETA_PENETAPAN } from "@/lib/peta-penetapan";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  BATAS_UKURAN_TTD_CAP,
  GalatUkuranTtdCap,
  UKURAN_TTD_CAP_BAWAAN,
  bersihkanUkuranTtdCap,
  samaDenganBawaan,
  ukuranLebihKecilDariBawaan,
  ukuranUntukBot,
  type UkuranTtdCap,
} from "@/lib/ukuran-ttd-cap";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { petaPenetapanBerlaku } from "@/server/modules/aleta-ecourt/peta-penetapan";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * UKURAN TANDA TANGAN DAN CAP - PENYIMPANAN (20 Okt 2026)
 * ============================================================================
 *
 * TANPA MIGRASI, di tempat Peta penetapan: baris kunci "penetapan|_ukuran"
 * di aleta_pemetaan_blangko (jenis 'relaas'; awalan "penetapan|" sudah dibuang
 * dari bacaan relaas dan BAS). Catatan = JSON ukuran.
 *
 * SATU sumber untuk tiga jalur:
 *   - e-Doc penetapan  : menimpa ukuran per jenis Peta penetapan bila ada baris ini;
 *   - ekstensi         : "Tambah tanda tangan ke PDF" (GET rute ukuran-ttd-cap);
 *   - salinan putusan  : rute /api/aleta-bot/abt/pdf mengirim ukuran ke bot.
 * Tanpa baris ini: e-Doc memakai ukuran per jenis Peta penetapan (pengaturan lama
 * yang tersimpan admin tetap berlaku sampai "dikembalikan ke bawaan"); ekstensi
 * dan salinan memakai bawaan.
 */

export const KUNCI_UKURAN_TTD_CAP_DB = "penetapan|_ukuran";
const KUNCI_UKURAN_PETA = ["lebarTtdMm", "tinggiTtdMaksMm", "ttdTurunMm", "lebarCapMm", "capGeserKiriMm", "capGeserAtasMm"] as const;

type BarisUkuran = { catatan: string | null; diubah_oleh: string; diubah_pada: string };

export type UkuranTersimpan = { ukuran: UkuranTtdCap; diubahPada: string; diubahOleh: string };

/** Ukuran khusus yang disimpan admin lewat kartu, atau null (= belum pernah). */
export async function ukuranTtdCapTersimpan(db: AletaDatabase): Promise<UkuranTersimpan | null> {
  let baris: BarisUkuran | undefined;
  try {
    baris = await db
      .prepare("SELECT catatan, diubah_oleh, diubah_pada FROM aleta_pemetaan_blangko WHERE jenis = 'relaas' AND kunci = ?")
      .get<BarisUkuran>(KUNCI_UKURAN_TTD_CAP_DB);
  } catch {
    return null; // tabel belum ada (pemasangan sangat lama) = bawaan
  }
  if (!baris) return null;
  try {
    const j = JSON.parse(String(baris.catatan || "{}")) as unknown;
    return { ukuran: bersihkanUkuranTtdCap(j), diubahPada: String(baris.diubah_pada), diubahOleh: String(baris.diubah_oleh) };
  } catch {
    return null; // baris rusak = bawaan, bukan galat
  }
}

/** Ukuran yang berlaku untuk ekstensi dan salinan putusan: tersimpan, atau bawaan. */
export async function ukuranTtdCapBerlaku(db: AletaDatabase): Promise<UkuranTtdCap> {
  return (await ukuranTtdCapTersimpan(db))?.ukuran ?? { ...UKURAN_TTD_CAP_BAWAAN };
}

/** Pengaturan lama per jenis (Peta penetapan) yang lebih kecil dari bawaan baru. */
export async function ukuranLamaPetaPenetapan(db: AletaDatabase) {
  const butir = await petaPenetapanBerlaku(db);
  return butir
    .filter((b) => b.sumber === "admin" && ukuranLebihKecilDariBawaan(b.lebarTtdMm, b.lebarCapMm))
    .map((b) => ({ jenis: b.jenis, sebutan: b.sebutan, lebarTtdMm: b.lebarTtdMm, lebarCapMm: b.lebarCapMm }));
}

/** Jawaban GET - ukuran berlaku + bawaan + batas + pemberitahuan ukuran lama. */
export async function bacaUkuranTtdCap(db: AletaDatabase, aktor?: { roleId?: string | null }) {
  const tersimpan = await ukuranTtdCapTersimpan(db);
  const lama = tersimpan ? [] : await ukuranLamaPetaPenetapan(db).catch(() => []);
  const ukuran = tersimpan?.ukuran ?? { ...UKURAN_TTD_CAP_BAWAAN };
  return {
    ukuran,
    ukuranBot: ukuranUntukBot(ukuran),
    bawaan: { ...UKURAN_TTD_CAP_BAWAAN },
    batas: BATAS_UKURAN_TTD_CAP,
    tersimpan: Boolean(tersimpan) && !samaDenganBawaan(ukuran),
    diubahPada: tersimpan?.diubahPada ?? null,
    diubahOleh: tersimpan?.diubahOleh ?? "",
    lama,
    pemberitahuanLama: lama.length
      ? `Ukuran lama tersimpan di Peta penetapan (${lama
          .map((l) => `${l.jenis.toUpperCase()}: tanda tangan ${l.lebarTtdMm} mm, cap ${l.lebarCapMm} mm`)
          .join("; ")}), lebih kecil dari bawaan baru (tanda tangan ${UKURAN_TTD_CAP_BAWAAN.lebarTtdMm} mm, cap ${UKURAN_TTD_CAP_BAWAAN.diameterCapMm} mm). Kembalikan bawaan?`
      : "",
    bolehMengubah: aktor ? isPrivilegedAdmin(aktor as never) : false,
  };
}

/**
 * PUT - { ...ukuran } menyimpan; { kembalikanBawaan: true } menghapus baris
 * ukuran khusus DAN membuang ukuran lama di baris per jenis Peta penetapan
 * (pengaturan lain di baris itu tidak disentuh). Super Admin dan Admin saja.
 */
export async function simpanUkuranTtdCap(db: AletaDatabase, actorUserId: string | null | undefined, masukan: Record<string, unknown>) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah ukuran tanda tangan dan cap.");
  }
  const sebelum = await ukuranTtdCapTersimpan(db);
  const lamaSebelum = await ukuranLamaPetaPenetapan(db).catch(() => []);
  const kembalikan = masukan.kembalikanBawaan === true;
  let baru: UkuranTtdCap | null = null;
  if (!kembalikan) {
    try {
      baru = bersihkanUkuranTtdCap(masukan, sebelum?.ukuran ?? { ...UKURAN_TTD_CAP_BAWAAN });
    } catch (galat) {
      if (galat instanceof GalatUkuranTtdCap) throw new ApiError(400, galat.message);
      throw galat;
    }
  }

  await withTransaction(db, async (tx) => {
    const waktu = new Date().toISOString();
    if (kembalikan) {
      await tx.prepare("DELETE FROM aleta_pemetaan_blangko WHERE jenis = 'relaas' AND kunci = ?").run(KUNCI_UKURAN_TTD_CAP_DB);
      for (const jenis of JENIS_PETA_PENETAPAN) {
        const kunci = `penetapan|${jenis}`;
        const baris = await tx
          .prepare("SELECT catatan FROM aleta_pemetaan_blangko WHERE jenis = 'relaas' AND kunci = ?")
          .get<{ catatan: string | null }>(kunci);
        if (!baris) continue;
        let isi: Record<string, unknown> = {};
        try {
          const j = JSON.parse(String(baris.catatan || "{}")) as unknown;
          isi = j && typeof j === "object" ? (j as Record<string, unknown>) : {};
        } catch {
          continue;
        }
        if (!KUNCI_UKURAN_PETA.some((k) => k in isi)) continue;
        for (const k of KUNCI_UKURAN_PETA) delete isi[k];
        await tx
          .prepare("UPDATE aleta_pemetaan_blangko SET catatan = ?, diubah_oleh = ?, diubah_pada = ? WHERE jenis = 'relaas' AND kunci = ?")
          .run(JSON.stringify(isi), actor.id, waktu, kunci);
      }
    } else if (baru) {
      await tx
        .prepare(
          "INSERT INTO aleta_pemetaan_blangko (jenis, kunci, sebutan, nama_berkas, catatan, diubah_oleh, diubah_pada) " +
            "VALUES ('relaas', ?, ?, '', ?, ?, ?) ON CONFLICT (jenis, kunci) DO UPDATE SET " +
            "sebutan = excluded.sebutan, catatan = excluded.catatan, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
        )
        .run(KUNCI_UKURAN_TTD_CAP_DB, "Ukuran tanda tangan dan cap", JSON.stringify(baru), actor.id, waktu);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_UKURAN_TTD_CAP",
      entityType: "aleta_pemetaan_blangko",
      entityId: "penetapan|_ukuran",
      payload: {
        sebelum: sebelum?.ukuran ?? null,
        sesudah: kembalikan ? null : baru,
        dikembalikanKeBawaan: kembalikan,
        ukuranLamaPetaDibuang: kembalikan ? lamaSebelum : [],
      },
    });
  });

  return bacaUkuranTtdCap(db, actor);
}

/** Bagian ukuran untuk dititipkan ke bot menimpa pengaturan per jenis (null = tidak menimpa). */
export async function ukuranTimpaUntukBot(db: AletaDatabase) {
  const t = await ukuranTtdCapTersimpan(db);
  return t ? ukuranUntukBot(t.ukuran) : null;
}
