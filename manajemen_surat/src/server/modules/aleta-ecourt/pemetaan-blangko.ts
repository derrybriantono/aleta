import {
  GalatPemetaan,
  KUNCI_BAKU,
  LABEL_JENIS_PEMETAAN,
  bawaanPemetaan,
  bersihkanButir,
  jenisPemetaanSah,
  saranPemetaan,
  sebutanBawaan,
  type JenisPemetaan,
} from "@/lib/pemetaan-blangko";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PEMETAAN BLANGKO - PENYIMPANAN (kontrak K3, migrasi 0054)
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_pemetaan_blangko. Aturannya di
 * src/lib/pemetaan-blangko.ts.
 *
 * Kewenangan: MEMBACA semua pegawai yang masuk (ekstensi memakainya saat
 * mencetak); MENGUBAH Super Admin dan Admin - tercatat di audit_logs beserta
 * isi sebelumnya.
 */

type Baris = {
  kunci: string;
  sebutan: string | null;
  nama_berkas: string;
  catatan: string | null;
  diubah_oleh: string;
  diubah_pada: string;
};

export type ButirPemetaan = {
  kunci: string;
  sebutan: string;
  namaBerkas: string;
  catatan: string;
  diubahPada: string | null;
  diubahOleh: string;
  /** "admin" = disimpan di server; "bawaan" = benih BLANGKO_RELAAS yang belum diubah. */
  sumber: "admin" | "bawaan";
};

async function bacaButir(db: AletaDatabase, jenis: JenisPemetaan): Promise<ButirPemetaan[]> {
  const baris = await db
    .prepare(
      "SELECT kunci, sebutan, nama_berkas, catatan, diubah_oleh, diubah_pada FROM aleta_pemetaan_blangko " +
        "WHERE jenis = ? ORDER BY kunci ASC"
    )
    .all<Baris>(jenis);
  return baris.map((b) => ({
    kunci: String(b.kunci),
    sebutan: String(b.sebutan || "") || sebutanBawaan(jenis, String(b.kunci)),
    namaBerkas: String(b.nama_berkas),
    catatan: String(b.catatan ?? ""),
    diubahPada: String(b.diubah_pada),
    diubahOleh: String(b.diubah_oleh),
    sumber: "admin" as const,
  }));
}

/**
 * Butir yang berlaku: yang diatur admin, ditambah bawaan (relaas & PBT) untuk
 * kunci yang belum diatur. Putusan tanpa bawaan - lihat src/lib/pemetaan-blangko.ts.
 */
function gabungBawaan(jenis: JenisPemetaan, admin: ButirPemetaan[]): ButirPemetaan[] {
  const ada = new Set(admin.map((b) => b.kunci.toLowerCase()));
  const bawaan: ButirPemetaan[] = bawaanPemetaan(jenis)
    .filter((b) => !ada.has(b.kunci.toLowerCase()))
    .map((b) => ({ ...b, diubahPada: null, diubahOleh: "", sumber: "bawaan" as const }));
  return [...admin, ...bawaan].sort((a, b) => a.kunci.localeCompare(b.kunci));
}

function periksaJenis(jenis: unknown): JenisPemetaan {
  if (!jenisPemetaanSah(jenis)) throw new ApiError(400, 'jenis harus "putusan", "relaas", atau "pbt".');
  return jenis;
}

/** Jawaban GET - bentuk kontrak K3 ditambah keterangan layar (label, kunciBaku, saran). */
export async function bacaPemetaanBlangko(db: AletaDatabase, jenisMentah: unknown, aktor?: { roleId?: string | null }) {
  const jenis = periksaJenis(jenisMentah);
  const admin = await bacaButir(db, jenis);
  const butir = gabungBawaan(jenis, admin);
  const diubahPada = admin.reduce<string | null>(
    (a, b) => (b.diubahPada && (!a || b.diubahPada > a) ? b.diubahPada : a),
    null
  );
  return {
    jenis,
    butir,
    diubahPada,
    label: LABEL_JENIS_PEMETAAN[jenis],
    kunciBaku: KUNCI_BAKU[jenis],
    saran: saranPemetaan(jenis),
    bolehMengubah: aktor ? isPrivilegedAdmin(aktor as never) : false,
  };
}

/**
 * PUT - menyimpan daftar butir satu jenis. Butir yang tidak disebut TIDAK
 * dihapus (PUT sebagian); butir bernama berkas kosong menghapus kuncinya.
 */
export async function simpanPemetaanBlangko(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { jenis: unknown; butir: unknown }
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah pemetaan blangko.");
  }
  const jenis = periksaJenis(masukan.jenis);
  let bersih: ReturnType<typeof bersihkanButir>;
  try {
    bersih = bersihkanButir(jenis, masukan.butir);
  } catch (galat) {
    if (galat instanceof GalatPemetaan) throw new ApiError(400, galat.message);
    throw galat;
  }

  await withTransaction(db, async (tx) => {
    const sebelum = await bacaButir(tx, jenis);
    const sekarang = new Date().toISOString();
    for (const b of bersih.simpan) {
      await tx
        .prepare(
          "INSERT INTO aleta_pemetaan_blangko (jenis, kunci, sebutan, nama_berkas, catatan, diubah_oleh, diubah_pada) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (jenis, kunci) DO UPDATE SET " +
            "sebutan = excluded.sebutan, nama_berkas = excluded.nama_berkas, catatan = excluded.catatan, " +
            "diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
        )
        .run(jenis, b.kunci, b.sebutan, b.namaBerkas, b.catatan, actor.id, sekarang);
    }
    for (const kunci of bersih.hapus) {
      await tx.prepare("DELETE FROM aleta_pemetaan_blangko WHERE jenis = ? AND kunci = ?").run(jenis, kunci);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ECOURT_BLANGKO_MAPPING",
      entityType: "aleta_pemetaan_blangko",
      entityId: jenis,
      payload: {
        jenis,
        disimpan: bersih.simpan.map((b) => ({ kunci: b.kunci, namaBerkas: b.namaBerkas })),
        dihapus: bersih.hapus,
        sebelum: sebelum.map((b) => ({ kunci: b.kunci, namaBerkas: b.namaBerkas })),
      },
    });
  });

  return bacaPemetaanBlangko(db, jenis, actor);
}
