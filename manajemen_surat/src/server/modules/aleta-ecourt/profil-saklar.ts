import { BAGIAN_FITUR_EKSTENSI, DAFTAR_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import { roles as defaultRoles } from "@/lib/mock-data";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  GalatProfil,
  KUNCI_SAKLAR_PROFIL,
  LABEL_PERAN_PROFIL,
  LABEL_SAKLAR_PROFIL,
  PERAN_PROFIL_UTAMA,
  PROFIL_BAWAAN,
  bersihkanSaklar,
  normalkanPeranProfil,
  peranProfil,
  saklarDariJson,
  type SaklarProfil,
} from "@/lib/profil-saklar";
import { bersihkanFitur, fiturTakDikenal } from "@/lib/tampilan-ekstensi";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PROFIL SAKLAR PER PERAN - PENYIMPANAN (kontrak K4, migrasi 0054)
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_profil_saklar. Aturannya di
 * src/lib/profil-saklar.ts.
 *
 * Kewenangan: profil milik pemanggilnya dibaca semua pegawai yang masuk
 * (lewat GET /ekstensi/tampilan); daftar dan penyuntingan per peran hanya
 * Super Admin dan Admin, tercatat di audit_logs beserta isi sebelumnya.
 */

type Baris = {
  peran: string;
  saklar: string;
  fitur: string | null;
  catatan: string | null;
  diubah_oleh: string;
  diubah_pada: string;
};

type ProfilTersimpan = {
  saklar: SaklarProfil;
  fitur: Record<string, true> | null;
  catatan: string;
  diubahOleh: string;
  diubahPada: string;
};

function uraiFitur(teks: string | null): Record<string, true> | null {
  if (teks === null || teks === undefined) return null;
  try {
    return bersihkanFitur(JSON.parse(String(teks)));
  } catch {
    return null;
  }
}

async function bacaSemuaProfil(db: AletaDatabase): Promise<Map<string, ProfilTersimpan>> {
  const baris = await db
    .prepare("SELECT peran, saklar, fitur, catatan, diubah_oleh, diubah_pada FROM aleta_profil_saklar ORDER BY peran ASC")
    .all<Baris>();
  const peta = new Map<string, ProfilTersimpan>();
  for (const b of baris) {
    peta.set(String(b.peran), {
      saklar: saklarDariJson(b.saklar),
      fitur: uraiFitur(b.fitur),
      catatan: String(b.catatan ?? ""),
      diubahOleh: String(b.diubah_oleh ?? ""),
      diubahPada: String(b.diubah_pada ?? ""),
    });
  }
  return peta;
}

export type ProfilPengguna = {
  peran: string;
  saklar: SaklarProfil | null;
  fitur: Record<string, true> | null;
  sumber: "admin" | "bawaan";
  bolehUbahProfil: boolean;
};

/** data.profil pada GET /api/aleta-ecourt/ekstensi/tampilan - selalu tentang pemanggilnya. */
export async function profilUntukPengguna(
  db: AletaDatabase,
  aktor: { roleId?: string | null; positionId?: string | null; additionalRoleIds?: string[] | null }
): Promise<ProfilPengguna> {
  const peran = peranProfil(aktor);
  const tersimpan = (await bacaSemuaProfil(db)).get(peran);
  const bolehUbahProfil = isPrivilegedAdmin(aktor as never);
  if (tersimpan) {
    return { peran, saklar: tersimpan.saklar, fitur: tersimpan.fitur, sumber: "admin", bolehUbahProfil };
  }
  const bawaan = PROFIL_BAWAAN[peran];
  return { peran, saklar: bawaan ? { ...bawaan } : null, fitur: null, sumber: "bawaan", bolehUbahProfil };
}

const namaPeran = () => new Map<string, string>(defaultRoles.map((p) => [p.id, p.name]));

/** Halaman admin: seluruh peran beserta profil berlakunya dan jumlah pegawainya. */
export async function bacaHalamanProfil(db: AletaDatabase, aktor: { roleId?: string | null }) {
  const tersimpan = await bacaSemuaProfil(db);
  const nama = namaPeran();
  const barisPeran = await db.prepare("SELECT id FROM roles ORDER BY id ASC").all<{ id: string }>();
  const urutan: string[] = [...PERAN_PROFIL_UTAMA];
  for (const b of barisPeran) {
    const k = normalkanPeranProfil(b.id);
    if (!urutan.includes(k)) urutan.push(k);
  }
  for (const k of tersimpan.keys()) if (!urutan.includes(k)) urutan.push(k);

  const hitung = new Map<string, number>();
  for (const u of (await getUsersFromDb(db)).filter((x) => x.isActive)) {
    const k = peranProfil(u as never);
    hitung.set(k, (hitung.get(k) ?? 0) + 1);
  }

  return {
    available: true,
    bolehMenyunting: isPrivilegedAdmin(aktor as never),
    kunciSaklar: KUNCI_SAKLAR_PROFIL.map((k) => ({ kunci: k, label: LABEL_SAKLAR_PROFIL[k] })),
    bagian: BAGIAN_FITUR_EKSTENSI,
    daftarFitur: DAFTAR_FITUR_EKSTENSI,
    peran: urutan.map((k) => {
      const t = tersimpan.get(k);
      const bawaan = PROFIL_BAWAAN[k] ?? null;
      return {
        peran: k,
        label: LABEL_PERAN_PROFIL[k] ?? nama.get(k) ?? nama.get(k.replace("juru-sita", "jurusita")) ?? k,
        jumlahPegawai: hitung.get(k) ?? 0,
        sumber: t ? ("admin" as const) : ("bawaan" as const),
        saklar: t ? t.saklar : bawaan,
        fitur: t ? t.fitur : null,
        catatan: t?.catatan ?? "",
        diubahOleh: t?.diubahOleh ?? "",
        diubahPada: t?.diubahPada ?? null,
        bawaan,
        tidakDibatasi: k === "admin" || k === "super-admin",
      };
    }),
  };
}

async function pastikanAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengatur profil saklar.");
  }
  return actor;
}

/** PUT { peran, saklar, fitur, catatan? } - fitur null = semua fitur boleh. */
export async function simpanProfilSaklar(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { peran: unknown; saklar: unknown; fitur?: unknown; catatan?: unknown }
) {
  const actor = await pastikanAdmin(db, actorUserId);
  const peran = normalkanPeranProfil(masukan.peran);
  if (!peran) throw new ApiError(400, "Pilih peran yang diatur.");
  let saklar: SaklarProfil;
  try {
    saklar = bersihkanSaklar(masukan.saklar);
  } catch (galat) {
    if (galat instanceof GalatProfil) throw new ApiError(400, galat.message);
    throw galat;
  }
  const fitur = masukan.fitur === null || masukan.fitur === undefined ? null : bersihkanFitur(masukan.fitur);
  const fiturDibuang = masukan.fitur ? fiturTakDikenal(masukan.fitur) : [];
  const catatan = String(masukan.catatan ?? "").trim().slice(0, 400);

  await withTransaction(db, async (tx) => {
    const sebelum = (await bacaSemuaProfil(tx)).get(peran) ?? null;
    const sekarang = new Date().toISOString();
    await tx
      .prepare(
        "INSERT INTO aleta_profil_saklar (peran, saklar, fitur, catatan, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT (peran) DO UPDATE SET saklar = excluded.saklar, fitur = excluded.fitur, catatan = excluded.catatan, " +
          "diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
      )
      .run(peran, JSON.stringify(saklar), fitur === null ? null : JSON.stringify(fitur), catatan, actor.id, sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ECOURT_EXTENSION_SWITCH_PROFILE",
      entityType: "aleta_profil_saklar",
      entityId: peran,
      payload: {
        peran,
        saklar,
        fitur: fitur === null ? null : Object.keys(fitur),
        catatan,
        sebelum: sebelum ? { saklar: sebelum.saklar, fitur: sebelum.fitur ? Object.keys(sebelum.fitur) : null } : null,
      },
    });
  });

  return { ...(await bacaHalamanProfil(db, actor)), fiturDibuang };
}

/** DELETE ?peran= - perannya kembali ke profil bawaan (atau tidak diatur). */
export async function hapusProfilSaklar(db: AletaDatabase, actorUserId: string | null | undefined, peranMentah: unknown) {
  const actor = await pastikanAdmin(db, actorUserId);
  const peran = normalkanPeranProfil(peranMentah);
  await withTransaction(db, async (tx) => {
    const lama = (await bacaSemuaProfil(tx)).get(peran);
    if (!lama) throw new ApiError(404, "Profil peran itu belum diatur - sudah memakai bawaan.");
    await tx.prepare("DELETE FROM aleta_profil_saklar WHERE peran = ?").run(peran);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "DELETE_ECOURT_EXTENSION_SWITCH_PROFILE",
      entityType: "aleta_profil_saklar",
      entityId: peran,
      payload: { peran, dihapus: { saklar: lama.saklar, fitur: lama.fitur ? Object.keys(lama.fitur) : null } },
    });
  });
  return bacaHalamanProfil(db, actor);
}
