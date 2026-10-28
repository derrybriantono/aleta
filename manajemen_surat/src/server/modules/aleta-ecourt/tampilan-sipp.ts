import { GOLONGAN_PERAN, LABEL_GOLONGAN, golonganPengguna, type GolonganPeran } from "@/lib/matriks-peran";
import {
  HALAMAN_SIPP,
  KATALOG_TAMPILAN_SIPP,
  LABEL_MODE_ATURAN,
  MODE_ATURAN,
  bersihkanAturan,
  bersihkanPilihan,
  golonganSah,
  pecahkanTampilanSipp,
  saringPilihanBaru,
  sembunyiUntukEkstensi,
  usulanAturanPeran,
  versiSembunyi,
  type AturanTampilanSipp,
  type BarisAturanTampilanSipp,
  type ElemenBerlaku,
  type LingkupAturan,
} from "@/lib/tampilan-sipp";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaSetelanPengguna, simpanSetelanPengguna } from "@/server/modules/aleta-ecourt/tampilan-ekstensi";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * TAMPILAN ALETA DI HALAMAN SIPP - PENYIMPANAN (migrasi 0116, 28 Okt 2026)
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_tampilan_sipp_aturan. Aturan murni di
 * src/lib/tampilan-sipp.ts. Pilihan pengguna sendiri disimpan sebagai setelan
 * pribadi "tampilan.sipp" (aleta_ekstensi_setelan) supaya ikut ke PC mana pun.
 *
 * Kewenangan: aturan per peran/pengguna dibaca dan diubah Super Admin dan
 * Admin (aksi "tampilan-sipp.atur"); Admin tidak dapat mengubah aturan untuk
 * golongan Super Admin atau akun Super Admin. Tampilan & pilihan milik
 * pemanggil sendiri dibaca/diubah siapa saja yang masuk.
 */

const SETELAN = "tampilan.sipp" as const;

type Baris = { lingkup: string; sasaran: string; aturan: string; catatan: string | null; diubah_oleh: string; diubah_pada: string };

function uraiJson(teks: string | null | undefined): unknown {
  try {
    return JSON.parse(String(teks ?? ""));
  } catch {
    return null;
  }
}

export async function bacaAturanTampilanSipp(db: AletaDatabase): Promise<BarisAturanTampilanSipp[]> {
  const baris = await db
    .prepare("SELECT lingkup, sasaran, aturan, catatan, diubah_oleh, diubah_pada FROM aleta_tampilan_sipp_aturan ORDER BY lingkup ASC, sasaran ASC")
    .all<Baris>();
  const hasil: BarisAturanTampilanSipp[] = [];
  for (const b of baris) {
    if (b.lingkup !== "peran" && b.lingkup !== "pengguna") continue;
    hasil.push({
      lingkup: b.lingkup,
      sasaran: String(b.sasaran ?? ""),
      aturan: bersihkanAturan(uraiJson(b.aturan)),
      catatan: String(b.catatan ?? ""),
      diubahOleh: String(b.diubah_oleh ?? ""),
      diubahPada: String(b.diubah_pada ?? ""),
    });
  }
  return hasil;
}

function pilihanTersimpan(setelan: Awaited<ReturnType<typeof bacaSetelanPengguna>>): { pilihan: Record<string, boolean>; diubahPada: string | null } {
  const s = setelan[SETELAN];
  const nilai = s && s.nilai && typeof s.nilai === "object" ? (s.nilai as { pilihan?: unknown }) : null;
  return { pilihan: bersihkanPilihan(nilai ? nilai.pilihan : null), diubahPada: s ? s.diubahPada : null };
}

/** Tampilan yang berlaku bagi satu akun (untuk pemanggilnya sendiri, atau pratinjau admin). */
export async function tampilanSippUntuk(db: AletaDatabase, pengguna: UserPersona) {
  const [aturan, setelan] = await Promise.all([bacaAturanTampilanSipp(db), bacaSetelanPengguna(db, pengguna.id)]);
  const { pilihan, diubahPada } = pilihanTersimpan(setelan);
  const golongan = golonganPengguna(pengguna);
  const berlaku = pecahkanTampilanSipp({ aturan, penggunaId: pengguna.id, golongan, pilihan });
  const sembunyi = sembunyiUntukEkstensi(berlaku);
  return { golongan, berlaku, pilihan, pilihanDiubahPada: diubahPada, sembunyi, versi: versiSembunyi(sembunyi) };
}

/** GET untuk ekstensi: hanya yang disembunyikan beserta penyaringnya. */
export async function tampilanSippEkstensi(db: AletaDatabase, pengguna: UserPersona) {
  const t = await tampilanSippUntuk(db, pengguna);
  return { versi: t.versi, sembunyi: t.sembunyi, dibuatPada: new Date().toISOString() };
}

/** GET halaman pengguna: katalog + keadaan tiap elemen + keterangan sumber. */
export async function halamanTampilanSippSaya(db: AletaDatabase, pengguna: UserPersona) {
  const t = await tampilanSippUntuk(db, pengguna);
  return {
    halaman: HALAMAN_SIPP,
    katalog: KATALOG_TAMPILAN_SIPP.map((el) => ({ kunci: el.kunci, halaman: el.halaman, nama: el.nama, jelas: el.jelas, contoh: el.contoh, jenis: el.jenis })),
    berlaku: t.berlaku,
    golongan: t.golongan.map((g) => ({ id: g, label: LABEL_GOLONGAN[g] })),
    pilihanDiubahPada: t.pilihanDiubahPada,
    versi: t.versi,
  };
}

/** PUT pilihan pengguna sendiri. Kunci terkunci dibuang dan disebut di `ditolak`. */
export async function simpanPilihanTampilanSipp(db: AletaDatabase, pengguna: UserPersona, pilihanBaru: unknown) {
  if (!pilihanBaru || typeof pilihanBaru !== "object" || Array.isArray(pilihanBaru)) {
    throw new ApiError(400, "Pilihan harus berupa daftar {elemen: nyala/mati}.");
  }
  const t = await tampilanSippUntuk(db, pengguna);
  // Pilihan lama yang tidak disebut tetap; yang disebut menimpa.
  const gabung = { ...t.pilihan, ...bersihkanPilihan(pilihanBaru) };
  const { pilihan, ditolak } = saringPilihanBaru(t.berlaku, gabung);
  await simpanSetelanPengguna(db, pengguna.id, { kunci: SETELAN, nilai: Object.keys(pilihan).length ? { pilihan } : null });
  return { ...(await halamanTampilanSippSaya(db, pengguna)), ditolak };
}

/** Kembali ke bawaan peran: seluruh pilihan sendiri dihapus. */
export async function hapusPilihanTampilanSipp(db: AletaDatabase, pengguna: UserPersona) {
  await simpanSetelanPengguna(db, pengguna.id, { kunci: SETELAN, nilai: null });
  return halamanTampilanSippSaya(db, pengguna);
}

// ============================================================================
// LAYAR ADMIN
// ============================================================================

function adalahSuperAdmin(p: UserPersona) {
  return golonganPengguna(p).includes("super-admin");
}

async function pastikanPengatur(db: AletaDatabase, actorUserId: string | null | undefined) {
  return pastikanAksi(db, actorUserId, "tampilan-sipp.atur");
}

export async function halamanAdminTampilanSipp(db: AletaDatabase, actorUserId: string | null | undefined, opsi: { pratinjau?: string } = {}) {
  const actor = await pastikanPengatur(db, actorUserId);
  const [aturan, pengguna] = await Promise.all([bacaAturanTampilanSipp(db), getUsersFromDb(db)]);
  const aktif = pengguna.filter((p) => p.isActive !== false);
  const namaPengguna = new Map(aktif.map((p) => [p.id, p.name || p.username]));
  let pratinjau: { penggunaId: string; nama: string; golongan: string[]; berlaku: ElemenBerlaku[] } | null = null;
  if (opsi.pratinjau) {
    const p = aktif.find((x) => x.id === opsi.pratinjau);
    if (!p) throw new ApiError(404, "Pegawai itu tidak ditemukan atau tidak aktif.");
    const t = await tampilanSippUntuk(db, p);
    pratinjau = { penggunaId: p.id, nama: p.name || p.username, golongan: t.golongan.map((g) => LABEL_GOLONGAN[g]), berlaku: t.berlaku };
  }
  return {
    halaman: HALAMAN_SIPP,
    katalog: KATALOG_TAMPILAN_SIPP.map((el) => ({ kunci: el.kunci, halaman: el.halaman, nama: el.nama, jelas: el.jelas, contoh: el.contoh, jenis: el.jenis, lazim: [...el.lazim] })),
    golongan: GOLONGAN_PERAN.map((g) => ({ id: g, label: LABEL_GOLONGAN[g] })),
    mode: MODE_ATURAN.map((m) => ({ id: m, label: LABEL_MODE_ATURAN[m] })),
    aturan: aturan.map((b) => ({ ...b, labelSasaran: b.lingkup === "peran" ? LABEL_GOLONGAN[b.sasaran as GolonganPeran] ?? b.sasaran : namaPengguna.get(b.sasaran) ?? "(akun tidak aktif)" })),
    pegawai: aktif.map((p) => ({ id: p.id, nama: p.name || p.username, golongan: golonganPengguna(p).map((g) => LABEL_GOLONGAN[g]) })),
    usulan: Object.fromEntries(GOLONGAN_PERAN.map((g) => [g, usulanAturanPeran(g)])),
    bolehUbahSuperAdmin: adalahSuperAdmin(actor),
    pratinjau,
  };
}

function lingkupSah(x: unknown): x is LingkupAturan {
  return x === "peran" || x === "pengguna";
}

async function periksaSasaran(db: AletaDatabase, actor: UserPersona, lingkup: LingkupAturan, sasaran: string) {
  if (lingkup === "peran") {
    if (!golonganSah(sasaran)) throw new ApiError(400, "Peran itu tidak dikenal.");
    if (sasaran === "super-admin" && !adalahSuperAdmin(actor)) throw new ApiError(403, "Aturan untuk Super Admin hanya diubah Super Admin.");
    return LABEL_GOLONGAN[sasaran];
  }
  const p = (await getUsersFromDb(db)).find((x) => x.id === sasaran);
  if (!p) throw new ApiError(404, "Pegawai itu tidak ditemukan.");
  if (adalahSuperAdmin(p) && !adalahSuperAdmin(actor)) throw new ApiError(403, "Aturan untuk akun Super Admin hanya diubah Super Admin.");
  return p.name || p.username;
}

/** PUT {lingkup, sasaran, aturan, catatan?} - menimpa seluruh aturan sasaran itu. Aturan kosong = hapus. */
export async function simpanAturanTampilanSipp(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { lingkup?: unknown; sasaran?: unknown; aturan?: unknown; catatan?: unknown }
) {
  const actor = await pastikanPengatur(db, actorUserId);
  if (!lingkupSah(masukan.lingkup)) throw new ApiError(400, "Pilih peran atau pegawai yang diatur.");
  const lingkup = masukan.lingkup;
  const sasaran = String(masukan.sasaran ?? "").trim();
  if (!sasaran) throw new ApiError(400, "Pilih peran atau pegawai yang diatur.");
  await periksaSasaran(db, actor, lingkup, sasaran);
  const aturan: AturanTampilanSipp = bersihkanAturan(masukan.aturan);
  const catatan = String(masukan.catatan ?? "").trim().slice(0, 400);

  await withTransaction(db, async (tx) => {
    const lama = (await bacaAturanTampilanSipp(tx)).find((b) => b.lingkup === lingkup && b.sasaran === sasaran) ?? null;
    if (!Object.keys(aturan).length) {
      await tx.prepare("DELETE FROM aleta_tampilan_sipp_aturan WHERE lingkup = ? AND sasaran = ?").run(lingkup, sasaran);
    } else {
      await tx
        .prepare(
          "INSERT INTO aleta_tampilan_sipp_aturan (lingkup, sasaran, aturan, catatan, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT (lingkup, sasaran) DO UPDATE SET aturan = excluded.aturan, catatan = excluded.catatan, " +
            "diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
        )
        .run(lingkup, sasaran, JSON.stringify(aturan), catatan, actor.id, new Date().toISOString());
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: Object.keys(aturan).length ? "UPDATE_SIPP_DISPLAY_RULE" : "DELETE_SIPP_DISPLAY_RULE",
      entityType: "aleta_tampilan_sipp_aturan",
      entityId: `${lingkup}:${sasaran}`,
      payload: { lingkup, sasaran, aturan, catatan, sebelum: lama ? lama.aturan : null },
    });
  });
  return halamanAdminTampilanSipp(db, actorUserId);
}
