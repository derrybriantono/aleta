import { KUNCI_KINERJA, SAKLAR_KINERJA_BAWAAN, bersihkanKinerja, type SaklarKinerja } from "@/lib/kinerja-ekstensi";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Saklar kinerja ekstensi/portal (lihat src/lib/kinerja-ekstensi.ts).
 * Dibaca siapa saja yang masuk (ekstensi memerlukannya); diubah HANYA Super Admin.
 * Tanpa baris tersimpan = semua mati.
 */
export const PENGGUNA_SISTEM_KINERJA = "*sistem*";

export async function bacaKinerja(db: AletaDatabase): Promise<SaklarKinerja> {
  try {
    const baris = await db
      .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
      .all<{ nilai: string }>(PENGGUNA_SISTEM_KINERJA, KUNCI_KINERJA);
    if (!baris[0]) return { ...SAKLAR_KINERJA_BAWAAN };
    return bersihkanKinerja(JSON.parse(baris[0].nilai));
  } catch {
    return { ...SAKLAR_KINERJA_BAWAAN };
  }
}

export async function simpanKinerja(db: AletaDatabase, actorUserId: string | null | undefined, masukan: unknown): Promise<SaklarKinerja> {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Hanya Super Admin yang dapat mengubah saklar kinerja.");
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) throw new ApiError(400, "Masukan harus berupa obyek saklar.");
  const lama = await bacaKinerja(db);
  const m = masukan as Record<string, unknown>;
  const baru = { ...lama } as Record<string, boolean>;
  for (const k of Object.keys(SAKLAR_KINERJA_BAWAAN)) {
    if (k in m) {
      if (typeof m[k] !== "boolean") throw new ApiError(400, `Saklar ${k} harus benar atau salah.`);
      baru[k] = m[k] as boolean;
    }
  }
  const sekarang = new Date();
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM_KINERJA, KUNCI_KINERJA, JSON.stringify(baru), sekarang.toISOString());
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_KINERJA_EKSTENSI",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM_KINERJA}:${KUNCI_KINERJA}`,
      payload: { sebelum: lama, sesudah: baru },
      createdAt: sekarang.toISOString(),
    });
  });
  return bersihkanKinerja(baru);
}
