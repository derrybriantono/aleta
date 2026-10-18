/**
 * ============================================================================
 * PENYIMPANAN PROFIL PROJECT ALETA AI (18 Okt 2026)
 * ============================================================================
 *
 * Pola yang sama dengan pengaturan penyapu KTP: satu baris di
 * aleta_ekstensi_setelan atas nama sistem, tanpa migrasi. Dibaca semua yang
 * berhak membuka penyusun perintah di Status Perkara; DIUBAH hanya Super
 * Admin, dan tiap perubahan masuk jejak audit.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */
import {
  bersihkanProfilProject,
  bolehMengubahProfilProject,
  profilEfektif,
  type ProfilProjectAi,
} from "@/lib/profil-project-ai";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_PROFIL_PROJECT_AI = "sistem:profil-project-ai";
/** Bukan id pengguna sungguhan - pola yang sama dengan pengaturan KTP pihak. */
export const PENGGUNA_SISTEM_PROFIL = "*sistem*";

export async function bacaProfilProjectTersimpan(db: AletaDatabase): Promise<ProfilProjectAi | null> {
  const baris = await db
    .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string }>(PENGGUNA_SISTEM_PROFIL, KUNCI_PROFIL_PROJECT_AI);
  if (!baris[0]) return null;
  try {
    return bersihkanProfilProject(JSON.parse(baris[0].nilai));
  } catch {
    return null;
  }
}

export type HalamanProfilProject = {
  /** Profil yang berlaku: ruas kosong sudah ditambal bawaan V.4.5. */
  profil: ProfilProjectAi;
  /** Benar bila Super Admin pernah menyimpan profil sendiri. */
  tersimpan: boolean;
  /** Benar bila pembaca boleh mengubahnya. */
  bolehMengubah: boolean;
  /** Isi apa adanya yang tersimpan (untuk borang suntingan); null bila memakai bawaan. */
  isiTersimpan: ProfilProjectAi | null;
};

export async function bacaHalamanProfilProject(
  db: AletaDatabase,
  actorUserId: string | null | undefined
): Promise<HalamanProfilProject> {
  const actor = await requireActorUser(db, actorUserId);
  const tersimpan = await bacaProfilProjectTersimpan(db);
  return {
    profil: profilEfektif(tersimpan),
    tersimpan: tersimpan !== null,
    bolehMengubah: bolehMengubahProfilProject(actor),
    isiTersimpan: tersimpan,
  };
}

/**
 * Simpan profil (masukan berisi) atau kembali ke bawaan V.4.5 (masukan null).
 * Hanya Super Admin.
 */
export async function simpanProfilProject(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: unknown | null
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMengubahProfilProject(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah profil Project ALETA AI.");
  }
  const sekarang = new Date().toISOString();
  let isi: ProfilProjectAi | null = null;
  if (masukan !== null) {
    isi = bersihkanProfilProject(masukan);
    if (!isi) throw new ApiError(400, "Profil Project tidak sah.");
    if (!isi.versi) throw new ApiError(400, "Versi Project wajib diisi, supaya terlihat di layar penyusun perintah.");
    isi.diubahOleh = actor.name ?? actor.id;
    isi.diubahPada = sekarang;
  }

  await withTransaction(db, async (tx) => {
    if (!isi) {
      await tx
        .prepare("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
        .run(PENGGUNA_SISTEM_PROFIL, KUNCI_PROFIL_PROJECT_AI);
    } else {
      await tx
        .prepare(
          "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
        )
        .run(PENGGUNA_SISTEM_PROFIL, KUNCI_PROFIL_PROJECT_AI, JSON.stringify(isi), sekarang);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: isi ? "UPDATE_PROFIL_PROJECT_AI" : "RESET_PROFIL_PROJECT_AI",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM_PROFIL}:${KUNCI_PROFIL_PROJECT_AI}`,
      payload: isi ? { versi: isi.versi, tanggal: isi.tanggal } : { kembaliKeBawaan: true },
      createdAt: sekarang,
    });
  });
}
