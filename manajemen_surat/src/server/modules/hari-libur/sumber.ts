import {
  GalatHariLibur,
  bersihkanTambahan,
  pasangTambahanLibur,
  petaLiburBerlaku,
  susunDataHariLibur,
  tolakTanggalLibur,
  type TambahanLibur,
} from "@/lib/hari-libur";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { gatewayHariLiburTambahan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * SUMBER TUNGGAL libur tambahan (18 Okt 2026) - aleta_ekstensi_setelan tanpa
 * migrasi, pola yang sama dengan nomor SK (nomor-sk-sumber.ts): pengguna_id
 * PENGGUNA_SISTEM, kunci KUNCI_HARI_LIBUR. Daftar SKB-nya di @/lib/hari-libur.
 */
export const KUNCI_HARI_LIBUR = "sistem:hari-libur";
const PENGGUNA_SISTEM = "*sistem*";

type Simpanan = { tambahan: TambahanLibur[]; diubahOleh: string; diubahPada: string };

export async function bacaSimpananHariLibur(db: AletaDatabase): Promise<Simpanan> {
  try {
    const b = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      KUNCI_HARI_LIBUR,
    ]);
    if (!b) return { tambahan: [], diubahOleh: "", diubahPada: "" };
    const mentah = JSON.parse(String(b.nilai)) as { tambahan?: unknown; diubahOleh?: unknown; diubahPada?: unknown };
    return {
      tambahan: bersihkanTambahan(mentah.tambahan ?? []),
      diubahOleh: String(mentah.diubahOleh ?? ""),
      diubahPada: String(mentah.diubahPada ?? ""),
    };
  } catch {
    // Simpanan rusak/tak terbaca: daftar SKB tetap berlaku.
    return { tambahan: [], diubahOleh: "", diubahPada: "" };
  }
}

/** Data lengkap untuk layar dan ekstensi - sekaligus memasang peta yang berlaku di proses server. */
export async function bacaHariLibur(db: AletaDatabase) {
  const s = await bacaSimpananHariLibur(db);
  pasangTambahanLibur(s.tambahan);
  return susunDataHariLibur(s.tambahan, s.diubahOleh, s.diubahPada);
}

/**
 * Pemeriksaan server untuk rute yang menulis tanggal sidang: SKB + tambahan.
 * Melempar 400 dengan kalimat awam bila tanggalnya hari libur.
 */
export async function tolakBilaHariLibur(db: AletaDatabase, tanggal: unknown, sebutan = "Tanggal sidang") {
  const iso = String(tanggal ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  await bacaHariLibur(db);
  const pesan = tolakTanggalLibur(iso, petaLiburBerlaku(), sebutan);
  if (pesan) throw new ApiError(400, pesan);
}

export async function simpanHariLibur(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  badan: Record<string, unknown>
) {
  let tambahan: TambahanLibur[];
  try {
    tambahan = bersihkanTambahan(badan.tambahan);
  } catch (e) {
    throw e instanceof GalatHariLibur ? new ApiError(400, e.message) : e;
  }
  const sekarang = new Date().toISOString();
  const isi = { tambahan, diubahOleh: aktor.name || aktor.id, diubahPada: sekarang };
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM, KUNCI_HARI_LIBUR, JSON.stringify(isi), sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_HARI_LIBUR",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM}:${KUNCI_HARI_LIBUR}`,
      payload: { tambahan },
      createdAt: sekarang,
    });
  });
  // Salinan ke bot (penilaian hari kerja, tunda sidang). Bot mati tidak
  // menggagalkan penyimpanan; layar menyebutnya.
  let bot = false;
  try {
    const r = await gatewayHariLiburTambahan(tambahan);
    bot = r.ok;
  } catch {
    bot = false;
  }
  return { ...(await bacaHariLibur(db)), terkirimKeBot: bot };
}
