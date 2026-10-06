/**
 * ============================================================================
 * BAWAAN TAMPILAN JADWAL SIDANG DARI SUPER ADMIN (6 Okt 2026, butir 22)
 * ============================================================================
 *
 * Saklar Tampilan Jadwal Sidang tersimpan di peramban tiap orang. Diminta
 * pengguna: Super Admin dapat mengatur BAWAANNYA - untuk semua pengguna, atau
 * untuk satu pengguna tertentu - dari pengaturan Integrasi e-Court.
 *
 *   - Bawaan berlaku bagi yang BELUM pernah mengatur tampilannya sendiri.
 *   - "Terapkan ulang" (paksa) menimpa pilihan yang sudah tersimpan di peramban
 *     SEKALI, pada pembukaan berikutnya; sesudahnya orangnya tetap bebas
 *     mengubah centangnya sendiri. Dikenali lewat versi: tiap simpanan ber-
 *     paksa membawa versi baru, dan peramban mengingat versi terakhir yang
 *     sudah diterapkannya.
 *   - Bawaan per pengguna mengalahkan bawaan semua pengguna.
 *
 * TANPA TABEL BARU: disimpan di aleta_ekstensi_setelan (migrasi 0052, kunci
 * per pengguna) dengan kunci KUNCI_BAWAAN - di luar daftar putih setelan
 * ekstensi, sehingga tidak pernah terkirim ke ekstensi (bacaSetelanPengguna
 * menyaring kunci yang tidak diizinkan). "Semua pengguna" = pengguna_id
 * PENGGUNA_SEMUA, yang tidak mungkin menjadi id pengguna sungguhan.
 */
import { SAKLAR_TAMPILAN, SAKLAR_WAJIB, type PilihanTampilan } from "@/lib/tampilan-antrian-sidang";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_BAWAAN = "portal:jadwal-sidang-tampilan";
export const PENGGUNA_SEMUA = "*semua-pengguna*";

export type BawaanTampilan = {
  pilihan: PilihanTampilan;
  /** Terapkan ulang - timpa pilihan yang sudah tersimpan di peramban, sekali. */
  paksa: boolean;
  /** Berubah tiap simpan; peramban membandingkannya untuk "paksa". */
  versi: string;
  diubahOleh: string;
  diubahPada: string;
};

/** Hanya saklar yang dikenal; yang wajib selalu true. */
export function bersihkanPilihan(masukan: unknown): PilihanTampilan {
  const isi = masukan && typeof masukan === "object" && !Array.isArray(masukan) ? (masukan as Record<string, unknown>) : {};
  const hasil: PilihanTampilan = {};
  for (const s of SAKLAR_TAMPILAN) {
    if (SAKLAR_WAJIB.includes(s.kunci)) hasil[s.kunci] = true;
    else if (typeof isi[s.kunci] === "boolean") hasil[s.kunci] = isi[s.kunci] as boolean;
    else hasil[s.kunci] = !s.bawaanMati;
  }
  return hasil;
}

function urai(nilai: string): BawaanTampilan | null {
  try {
    const x = JSON.parse(nilai) as Partial<BawaanTampilan>;
    if (!x || typeof x !== "object") return null;
    return {
      pilihan: bersihkanPilihan(x.pilihan),
      paksa: x.paksa === true,
      versi: String(x.versi ?? ""),
      diubahOleh: String(x.diubahOleh ?? ""),
      diubahPada: String(x.diubahPada ?? ""),
    };
  } catch {
    return null;
  }
}

async function baca(db: AletaDatabase, penggunaId: string): Promise<BawaanTampilan | null> {
  const baris = await db
    .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string }>(penggunaId, KUNCI_BAWAAN);
  return baris[0] ? urai(baris[0].nilai) : null;
}

/** Bawaan yang berlaku bagi satu pengguna: miliknya sendiri, lalu semua pengguna. */
export async function bawaanUntukPengguna(db: AletaDatabase, penggunaId: string) {
  const [sendiri, semua] = await Promise.all([baca(db, penggunaId), baca(db, PENGGUNA_SEMUA)]);
  const berlaku = sendiri ?? semua;
  return { berlaku, sumber: sendiri ? "pengguna" : semua ? "semua" : "tidak-ada" } as const;
}

async function pastikanSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengatur bawaan tampilan Jadwal Sidang.");
  }
  return actor;
}

/** Halaman admin: bawaan semua pengguna + daftar bawaan per pengguna. */
export async function bacaHalamanBawaan(db: AletaDatabase, actorUserId: string | null | undefined) {
  await pastikanSuperAdmin(db, actorUserId);
  const baris = await db
    .prepare("SELECT pengguna_id, nilai FROM aleta_ekstensi_setelan WHERE kunci = ?")
    .all<{ pengguna_id: string; nilai: string }>(KUNCI_BAWAAN);
  const pengguna = await getUsersFromDb(db);
  const nama = new Map(pengguna.map((u) => [u.id, u.name]));
  let semua: BawaanTampilan | null = null;
  const perPengguna: Array<{ penggunaId: string; nama: string; bawaan: BawaanTampilan }> = [];
  for (const b of baris) {
    const isi = urai(b.nilai);
    if (!isi) continue;
    if (b.pengguna_id === PENGGUNA_SEMUA) semua = isi;
    else perPengguna.push({ penggunaId: b.pengguna_id, nama: nama.get(b.pengguna_id) ?? b.pengguna_id, bawaan: isi });
  }
  perPengguna.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return {
    semua,
    perPengguna,
    pengguna: pengguna.filter((u) => u.isActive).map((u) => ({ id: u.id, nama: u.name, username: u.username })),
  };
}

/** Simpan (pilihan berisi) atau hapus (pilihan null) bawaan satu lingkup. */
export async function simpanBawaan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { lingkup: unknown; penggunaId?: unknown; pilihan: unknown; paksa?: unknown }
) {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  const lingkup = String(masukan.lingkup ?? "");
  if (lingkup !== "semua" && lingkup !== "pengguna") throw new ApiError(400, 'Lingkup harus "semua" atau "pengguna".');
  let sasaran = PENGGUNA_SEMUA;
  if (lingkup === "pengguna") {
    sasaran = String(masukan.penggunaId ?? "").trim();
    if (!sasaran || sasaran === PENGGUNA_SEMUA) throw new ApiError(400, "Pengguna belum dipilih.");
    const ada = (await getUsersFromDb(db)).some((u) => u.id === sasaran);
    if (!ada) throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  const sekarang = new Date().toISOString();
  const hapus = masukan.pilihan === null;
  const isi: BawaanTampilan | null = hapus
    ? null
    : {
        pilihan: bersihkanPilihan(masukan.pilihan),
        paksa: masukan.paksa === true,
        versi: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        diubahOleh: actor.name ?? actor.id,
        diubahPada: sekarang,
      };

  await withTransaction(db, async (tx) => {
    if (!isi) {
      await tx.prepare("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?").run(sasaran, KUNCI_BAWAAN);
    } else {
      await tx
        .prepare(
          "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
        )
        .run(sasaran, KUNCI_BAWAAN, JSON.stringify(isi), sekarang);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: hapus ? "DELETE_SCHEDULE_DISPLAY_DEFAULT" : "UPDATE_SCHEDULE_DISPLAY_DEFAULT",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${sasaran}:${KUNCI_BAWAAN}`,
      payload: { lingkup, sasaran, paksa: isi?.paksa ?? false, dimatikan: isi ? Object.keys(isi.pilihan).filter((k) => !isi.pilihan[k]) : [] },
      createdAt: sekarang,
    });
  });
  return bacaHalamanBawaan(db, actorUserId);
}
