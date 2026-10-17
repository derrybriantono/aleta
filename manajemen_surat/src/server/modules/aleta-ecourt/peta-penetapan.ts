import {
  BAWAAN_PETA_PENETAPAN,
  BATAS_UKURAN_MM,
  GalatPetaPenetapan,
  JENIS_PETA_PENETAPAN,
  PENANDATANGAN_PENETAPAN,
  SEBUTAN_JENIS_PENETAPAN,
  TEMPAT_UNGGAH_SIPP,
  VARIAN_SITA_PHS,
  bersihkanAturPenetapan,
  jenisPetaSah,
  type AturPenetapan,
  type JenisPetaPenetapan,
} from "@/lib/peta-penetapan";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PETA PENETAPAN - PENYIMPANAN (perbaikan 6 Okt 2026, butir 19-20)
 * ============================================================================
 *
 * TANPA MIGRASI, dengan pola yang sama dengan BAS (pemetaan-blangko.ts,
 * perbaikan 2 Okt sore): baris disimpan di aleta_pemetaan_blangko (0054)
 * berjenis 'relaas' dengan kunci berawalan "penetapan|" - "penetapan|pmh",
 * "penetapan|phs", ... - dan DIBUANG dari bacaan relaas (pemetaan-blangko.ts
 * bacaButir). Kunci relaas biasa tidak pernah memuat "|" (normalkanKunci),
 * jadi tidak ada yang tertukar.
 *
 *   nama_berkas  nama blangko ABT ("@ 1 - PMH.rtf"; boleh kosong untuk
 *                jenis yang dimatikan)
 *   sebutan      sebutan jenis untuk layar
 *   catatan      JSON pengaturan lainnya (bersihkanAturPenetapan)
 *
 * Kenapa tidak migrasi 0058: jurnal Drizzle dijaga "tanpa lubang" oleh uji,
 * dan 0057 sudah diklaim sesi lain tetapi belum di-commit - idx 58 tanpa 57
 * mematahkan penjaga itu, dan `when` 0058 yang lebih tua/muda dari 0057
 * dapat membuat salah satunya dilewati diam-diam di server.
 *
 * Kewenangan: MEMBACA semua pegawai yang masuk (ekstensi memakainya sesudah
 * penetapan tertulis); MENGUBAH hanya Super Admin dan Admin - tercatat di
 * audit_logs beserta isi sebelumnya.
 */

export const AWALAN_KUNCI_PENETAPAN_DB = "penetapan|";

type Baris = { kunci: string; nama_berkas: string; catatan: string | null; diubah_oleh: string; diubah_pada: string };

export type ButirPetaPenetapan = AturPenetapan & {
  jenis: JenisPetaPenetapan;
  sebutan: string;
  sumber: "admin" | "bawaan";
  diubahPada: string | null;
  diubahOleh: string;
  tempatUnggah: (typeof TEMPAT_UNGGAH_SIPP)[JenisPetaPenetapan];
  /** I9 17 Okt: varian pilihan tangan PHS perkara bersita ("dikabulkan" -> "@ 2a ...", "ditolak" -> "@ 2b ..."); jenis lain kosong. */
  varianSita: Partial<Record<"dikabulkan" | "ditolak", string>>;
};

function dariBaris(jenis: JenisPetaPenetapan, b: Baris | undefined): ButirPetaPenetapan {
  let atur: AturPenetapan = BAWAAN_PETA_PENETAPAN[jenis];
  if (b) {
    let tersimpan: Record<string, unknown> = {};
    try {
      const j = JSON.parse(String(b.catatan || "{}")) as unknown;
      tersimpan = j && typeof j === "object" ? (j as Record<string, unknown>) : {};
    } catch {
      tersimpan = {};
    }
    try {
      atur = bersihkanAturPenetapan(jenis, { ...tersimpan, namaBerkas: b.nama_berkas }, BAWAAN_PETA_PENETAPAN[jenis]);
    } catch {
      // Baris rusak (diubah di luar layar) tidak menyalakan apa pun: jenisnya
      // dibaca mati, bukan ditebak.
      atur = { ...BAWAAN_PETA_PENETAPAN[jenis], aktif: false, otomatisUnggah: false };
    }
  }
  return {
    ...atur,
    jenis,
    sebutan: SEBUTAN_JENIS_PENETAPAN[jenis],
    sumber: b ? "admin" : "bawaan",
    diubahPada: b ? String(b.diubah_pada) : null,
    diubahOleh: b ? String(b.diubah_oleh) : "",
    tempatUnggah: TEMPAT_UNGGAH_SIPP[jenis],
    // Cadangan selalu dari bawaan (bukan dari baris admin): satu sumber dengan bot.
    namaBerkasCadangan: BAWAAN_PETA_PENETAPAN[jenis].namaBerkasCadangan ?? "",
    varianSita: jenis === "phs" ? { ...VARIAN_SITA_PHS } : {},
  };
}

async function bacaBaris(db: AletaDatabase): Promise<Map<string, Baris>> {
  const semua = await db
    .prepare(
      "SELECT kunci, nama_berkas, catatan, diubah_oleh, diubah_pada FROM aleta_pemetaan_blangko WHERE jenis = 'relaas' AND kunci LIKE ?"
    )
    .all<Baris>(`${AWALAN_KUNCI_PENETAPAN_DB}%`);
  return new Map(semua.map((b) => [String(b.kunci).slice(AWALAN_KUNCI_PENETAPAN_DB.length), b]));
}

/** Butir yang berlaku untuk keempat jenis (admin + bawaan). */
export async function petaPenetapanBerlaku(db: AletaDatabase): Promise<ButirPetaPenetapan[]> {
  let baris = new Map<string, Baris>();
  try {
    baris = await bacaBaris(db);
  } catch {
    // Tabel belum ada (pemasangan sangat lama) = bawaan, bukan galat.
  }
  return JENIS_PETA_PENETAPAN.map((j) => dariBaris(j, baris.get(j)));
}

/** Satu jenis - dipakai rute unggah edoc penetapan. */
export async function aturPenetapanUntuk(db: AletaDatabase, jenis: JenisPetaPenetapan): Promise<ButirPetaPenetapan> {
  const semua = await petaPenetapanBerlaku(db);
  return semua.find((b) => b.jenis === jenis) ?? dariBaris(jenis, undefined);
}

/** Jawaban GET - butir + pilihan untuk layar. */
export async function bacaPetaPenetapan(db: AletaDatabase, aktor?: { roleId?: string | null }) {
  const butir = await petaPenetapanBerlaku(db);
  return {
    butir,
    bolehMengubah: aktor ? isPrivilegedAdmin(aktor as never) : false,
    penandatangan: PENANDATANGAN_PENETAPAN.map((p) => ({ ...p })),
    batasUkuran: BATAS_UKURAN_MM,
    bawaan: BAWAAN_PETA_PENETAPAN,
  };
}

/**
 * PUT - { butir: [{ jenis, ...pengaturan }] }. Butir yang tidak disebut tidak
 * diubah. { jenis, kembalikanBawaan: true } menghapus baris admin jenis itu.
 */
export async function simpanPetaPenetapan(db: AletaDatabase, actorUserId: string | null | undefined, masukan: { butir: unknown }) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah peta penetapan.");
  }
  if (!Array.isArray(masukan.butir) || masukan.butir.length === 0) {
    throw new ApiError(400, "butir harus berupa daftar pengaturan per jenis penetapan.");
  }
  const sekarang = await petaPenetapanBerlaku(db);
  const simpan: Array<{ jenis: JenisPetaPenetapan; atur: AturPenetapan }> = [];
  const kembalikan: JenisPetaPenetapan[] = [];
  for (const mentah of masukan.butir as unknown[]) {
    const b = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
    const jenis = String(b.jenis ?? "").toLowerCase();
    if (!jenisPetaSah(jenis)) throw new ApiError(400, `Jenis penetapan "${String(b.jenis ?? "")}" tidak dikenal.`);
    if (b.kembalikanBawaan === true) {
      kembalikan.push(jenis);
      continue;
    }
    const dasar = sekarang.find((x) => x.jenis === jenis) ?? dariBaris(jenis, undefined);
    try {
      simpan.push({ jenis, atur: bersihkanAturPenetapan(jenis, b, dasar) });
    } catch (galat) {
      if (galat instanceof GalatPetaPenetapan) throw new ApiError(400, galat.message);
      throw galat;
    }
  }

  await withTransaction(db, async (tx) => {
    const waktu = new Date().toISOString();
    for (const { jenis, atur } of simpan) {
      // I9 17 Okt: cadangan dan varian sita adalah turunan bawaan - tidak ikut disimpan di baris admin.
      const { namaBerkas, namaBerkasCadangan: _cadangan, ...lain } = atur;
      delete (lain as Record<string, unknown>).varianSita;
      await tx
        .prepare(
          "INSERT INTO aleta_pemetaan_blangko (jenis, kunci, sebutan, nama_berkas, catatan, diubah_oleh, diubah_pada) " +
            "VALUES ('relaas', ?, ?, ?, ?, ?, ?) ON CONFLICT (jenis, kunci) DO UPDATE SET " +
            "sebutan = excluded.sebutan, nama_berkas = excluded.nama_berkas, catatan = excluded.catatan, " +
            "diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
        )
        .run(`${AWALAN_KUNCI_PENETAPAN_DB}${jenis}`, SEBUTAN_JENIS_PENETAPAN[jenis], namaBerkas, JSON.stringify(lain), actor.id, waktu);
    }
    for (const jenis of kembalikan) {
      await tx
        .prepare("DELETE FROM aleta_pemetaan_blangko WHERE jenis = 'relaas' AND kunci = ?")
        .run(`${AWALAN_KUNCI_PENETAPAN_DB}${jenis}`);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PETA_PENETAPAN",
      entityType: "aleta_pemetaan_blangko",
      entityId: "penetapan",
      payload: {
        disimpan: simpan.map((s) => ({ jenis: s.jenis, ...s.atur })),
        dikembalikanKeBawaan: kembalikan,
        sebelum: sekarang
          .filter((s) => simpan.some((x) => x.jenis === s.jenis) || kembalikan.includes(s.jenis))
          .map(({ tempatUnggah: _t, sebutan: _s, ...x }) => x),
      },
    });
  });

  return bacaPetaPenetapan(db, actor);
}
