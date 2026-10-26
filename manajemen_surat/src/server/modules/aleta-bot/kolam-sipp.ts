/**
 * Penyimpanan pengaturan kolam SIPP (K3, rantai F1). Tanpa migrasi: aleta_ekstensi_setelan,
 * pengguna_id *sistem*, pola yang sama dengan pengaturan penarikan KTP pihak.
 *
 * Portal hanya menyimpan; bot menerimanya lewat sinkron runtime (config/sync) dan
 * menerapkannya SAAT BERJALAN. Belum pernah disimpan = tidak mengirim apa pun, bot
 * memakai bawaannya (perilaku lama).
 */
import { KOLAM_SIPP_BAWAAN, KOLAM_SIPP_RENTANG, rapikanKolamSipp, type KolamSippSetelan } from "@/lib/kolam-sipp";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_KOLAM_SIPP = "sistem:kolam-sipp";
export const PENGGUNA_SISTEM_KOLAM = "*sistem*";

/** Setelan tersimpan, atau null bila Super Admin belum pernah menyimpannya. */
export async function bacaKolamSippTersimpan(db: AletaDatabase): Promise<KolamSippSetelan | null> {
  const baris = await db
    .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string }>(PENGGUNA_SISTEM_KOLAM, KUNCI_KOLAM_SIPP);
  if (!baris[0]) return null;
  try {
    return rapikanKolamSipp(JSON.parse(baris[0].nilai));
  } catch {
    return null;
  }
}

function periksaMasukan(masukan: unknown): KolamSippSetelan {
  if (!masukan || typeof masukan !== "object") throw new ApiError(400, "Pengaturan kolam SIPP tidak sah.");
  const x = masukan as Record<string, unknown>;
  for (const kunci of ["terpisah", "putusKueriLambat"] as const) {
    if (typeof x[kunci] !== "boolean") throw new ApiError(400, "Saklar kolam SIPP harus dipilih menyala atau mati.");
  }
  for (const kunci of ["batas", "batasInteraktif", "antreMaksMs", "antreanMaks"] as const) {
    const n = Number(x[kunci]);
    const r = KOLAM_SIPP_RENTANG[kunci];
    if (!Number.isFinite(n) || n < r.min || n > r.maks) {
      throw new ApiError(400, `Nilai ${kunci} harus ${r.min}-${r.maks}.`);
    }
  }
  return rapikanKolamSipp(x);
}

/** Simpan (masukan berisi) atau kembali ke bawaan (masukan null). Pemanggil sudah memastikan Super Admin. */
export async function simpanKolamSipp(db: AletaDatabase, actorUserId: string, masukan: unknown | null): Promise<KolamSippSetelan> {
  const isi = masukan === null ? KOLAM_SIPP_BAWAAN : periksaMasukan(masukan);
  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM_KOLAM, KUNCI_KOLAM_SIPP, JSON.stringify(isi), sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId,
      action: masukan === null ? "RESET_KOLAM_SIPP" : "UPDATE_KOLAM_SIPP",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM_KOLAM}:${KUNCI_KOLAM_SIPP}`,
      payload: { ...isi },
      createdAt: sekarang,
    });
  });
  return isi;
}
