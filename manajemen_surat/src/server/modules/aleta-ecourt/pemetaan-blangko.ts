import {
  AWALAN_KUNCI_BAS_DB,
  GalatPemetaan,
  KUNCI_BAKU,
  STATUS_BERVERSTEK,
  STATUS_PUTUSAN_SIPP,
  kapanDipakai,
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

/**
 * Perbaikan 2 Okt sore (butir 6): BAS TANPA MIGRASI. CHECK 0054 hanya
 * menerima putusan/relaas/pbt, jadi baris BAS berjenis 'relaas' dengan kunci
 * berawalan "bas|" - dan dibuang dari bacaan relaas. Kunci relaas biasa tidak
 * pernah memuat "|" (normalkanKunci), jadi tidak ada yang tertukar.
 */
function jenisDb(jenis: JenisPemetaan): "putusan" | "relaas" | "pbt" {
  return jenis === "bas" ? "relaas" : jenis;
}

function kunciDb(jenis: JenisPemetaan, kunci: string): string {
  return jenis === "bas" ? `${AWALAN_KUNCI_BAS_DB}${kunci}` : kunci;
}

async function bacaButir(db: AletaDatabase, jenis: JenisPemetaan): Promise<ButirPemetaan[]> {
  const semua = await db
    .prepare(
      "SELECT kunci, sebutan, nama_berkas, catatan, diubah_oleh, diubah_pada FROM aleta_pemetaan_blangko " +
        "WHERE jenis = ? ORDER BY kunci ASC"
    )
    .all<Baris>(jenisDb(jenis));
  const bas = (b: Baris) => String(b.kunci).startsWith(AWALAN_KUNCI_BAS_DB);
  const baris = semua
    .filter((b) => (jenis === "bas" ? bas(b) : !bas(b)))
    .map((b) => ({ ...b, kunci: jenis === "bas" ? String(b.kunci).slice(AWALAN_KUNCI_BAS_DB.length) : String(b.kunci) }));
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
  if (!jenisPemetaanSah(jenis)) throw new ApiError(400, 'jenis harus "putusan", "relaas", "pbt", atau "bas".');
  return jenis;
}

/** Saran tambahan dari luar modul (tab BAS: katalog bot) - dikirim rute. */
export type PemuatSaran = (jenis: JenisPemetaan) => Promise<{ kunci: string; namaBerkas: string; catatan: string }[]>;

/**
 * Jawaban GET - bentuk kontrak K3 ditambah keterangan layar (label, kunciBaku,
 * saran). Perbaikan 2 Okt sore: `kapan` = { kunci: { dikenal, dipakai } }
 * (kapan ekstensi memakai baris itu - kunci buatan admin yang tidak dikenali
 * ditandai, tidak dibuang), dan untuk putusan `statusPutusan` (daftar
 * status_putusan SIPP) + `statusBerverstek`. Bentuk tiap butir TIDAK berubah.
 */
export async function bacaPemetaanBlangko(
  db: AletaDatabase,
  jenisMentah: unknown,
  aktor?: { roleId?: string | null },
  pemuatSaran?: PemuatSaran
) {
  const jenis = periksaJenis(jenisMentah);
  const admin = await bacaButir(db, jenis);
  const butir = gabungBawaan(jenis, admin);
  let saranLuar: { kunci: string; namaBerkas: string; catatan: string }[] = [];
  if (pemuatSaran) {
    try {
      saranLuar = await pemuatSaran(jenis);
    } catch {
      saranLuar = [];
    }
  }
  const kapan: Record<string, { dikenal: boolean; dipakai: string }> = {};
  for (const b of butir) kapan[b.kunci] = kapanDipakai(jenis, b.kunci);
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
    saran: [...saranPemetaan(jenis), ...saranLuar],
    bolehMengubah: aktor ? isPrivilegedAdmin(aktor as never) : false,
    kapan,
    ...(jenis === "putusan"
      ? { statusPutusan: STATUS_PUTUSAN_SIPP.map((s) => s.nama), statusBerverstek: [...STATUS_BERVERSTEK] }
      : {}),
  };
}

/**
 * PUT - menyimpan daftar butir satu jenis. Butir yang tidak disebut TIDAK
 * dihapus (PUT sebagian); butir bernama berkas kosong menghapus kuncinya.
 */
export async function simpanPemetaanBlangko(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { jenis: unknown; butir: unknown },
  pemuatSaran?: PemuatSaran
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
        .run(jenisDb(jenis), kunciDb(jenis, b.kunci), b.sebutan, b.namaBerkas, b.catatan, actor.id, sekarang);
    }
    for (const kunci of bersih.hapus) {
      await tx.prepare("DELETE FROM aleta_pemetaan_blangko WHERE jenis = ? AND kunci = ?").run(jenisDb(jenis), kunciDb(jenis, kunci));
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

  return bacaPemetaanBlangko(db, jenis, actor, pemuatSaran);
}

/**
 * Peta { kunci: nama berkas } yang BERLAKU untuk satu jenis (admin + bawaan) -
 * dipakai rute lain di server (BAS massal, perbaikan 2 Okt sore butir 8).
 * Tabel belum ada / tak terbaca = peta kosong (perilaku lama), bukan galat.
 */
export async function petaPemetaanBerlaku(db: AletaDatabase, jenis: JenisPemetaan): Promise<Record<string, string>> {
  try {
    const butir = gabungBawaan(jenis, await bacaButir(db, jenis));
    return Object.fromEntries(butir.filter((b) => b.namaBerkas.trim()).map((b) => [b.kunci, b.namaBerkas]));
  } catch {
    return {};
  }
}
