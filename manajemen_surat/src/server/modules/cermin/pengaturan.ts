/**
 * Pengaturan Cermin Perkara - saklar Super Admin (SEMUA MATI bawaan).
 *
 * Disimpan di aleta_ekstensi_setelan (pengguna_id = *sistem*, tanpa migrasi
 * tambahan), pola yang sama dengan pengaturan penyapu KTP. Tiap perubahan
 * masuk jejak audit (siapa, kapan, nilai). Hanya Super Admin dan Admin.
 *
 * Membaca pengaturan TIDAK pernah melempar: saat pengaturan tak terbaca,
 * semua saklar dianggap mati (jalur lama).
 */
import {
  PENGATURAN_CERMIN_BAWAAN,
  bersihkanPengaturanCermin,
  pengaturanCerminEfektif,
  type LayarCermin,
  type PengaturanCermin,
} from "@/lib/cermin";
import { getDatabase, withTransaction, type AletaDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_CERMIN_PENGATURAN = "sistem:cermin-perkara";
/** Bukan id pengguna sungguhan; pola yang sama dengan penyapu KTP. */
export const PENGGUNA_SISTEM_CERMIN = "*sistem*";

export async function bacaPengaturanCerminTersimpan(db: AletaDatabase): Promise<PengaturanCermin | null> {
  const baris = await db
    .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string }>(PENGGUNA_SISTEM_CERMIN, KUNCI_CERMIN_PENGATURAN);
  if (!baris[0]) return null;
  try {
    return bersihkanPengaturanCermin(JSON.parse(baris[0].nilai));
  } catch {
    return null;
  }
}

/** Singgahan pengaturan untuk pemanggil tanpa `db` (detak pemindai, gerbang layar): 10 detik, dibuang saat disimpan. */
const UMUR_SINGGAH_MS = 10_000;
let singgah: { nilai: PengaturanCermin; sampai: number } | null = null;

/** Hanya untuk uji dan penyimpanan: buang singgahan pengaturan. */
export function buangSinggahPengaturanCermin() {
  singgah = null;
}

/** Pengaturan yang berlaku; kegagalan membaca = bawaan (semua mati). Dengan `db` selalu membaca langsung. */
export async function pengaturanCerminBerlaku(db?: AletaDatabase): Promise<PengaturanCermin> {
  if (!db && singgah && singgah.sampai > Date.now()) return singgah.nilai;
  try {
    const basis = db ?? (await getDatabase());
    const nilai = pengaturanCerminEfektif(await bacaPengaturanCerminTersimpan(basis));
    if (!db) singgah = { nilai, sampai: Date.now() + UMUR_SINGGAH_MS };
    return nilai;
  } catch {
    return pengaturanCerminEfektif(null);
  }
}

/** Sumber bagi pemindai latar: dibaca tiap detak, jadi saklar layar berlaku tanpa restart. */
export async function sumberPengaturanCermin(): Promise<PengaturanCermin> {
  return pengaturanCerminBerlaku();
}

/** Apakah layar ini boleh membaca cermin? Saklar mati / gagal baca = tidak. */
export async function layarMembacaCermin(layar: LayarCermin, db?: AletaDatabase): Promise<boolean> {
  const p = await pengaturanCerminBerlaku(db);
  return p.layar[layar] === true;
}

/** Simpan pengaturan (masukan berisi) atau kembali ke bawaan (null: semua mati). */
export async function simpanPengaturanCermin(db: AletaDatabase, actorUserId: string | null | undefined, masukan: unknown | null) {
  const actor = await pastikanAdminIstimewa(db, actorUserId, "mengatur Cermin Perkara");
  const sekarang = new Date().toISOString();
  let isi: PengaturanCermin | null = null;
  if (masukan !== null) {
    const bersih = bersihkanPengaturanCermin(masukan);
    if (!bersih) throw new Error("Pengaturan Cermin Perkara tidak sah.");
    isi = { ...bersih, diubahOleh: actor.name ?? actor.id, diubahPada: sekarang };
  }
  await withTransaction(db, async (tx) => {
    if (!isi) {
      await tx
        .prepare("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
        .run(PENGGUNA_SISTEM_CERMIN, KUNCI_CERMIN_PENGATURAN);
    } else {
      await tx
        .prepare(
          "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
        )
        .run(PENGGUNA_SISTEM_CERMIN, KUNCI_CERMIN_PENGATURAN, JSON.stringify(isi), sekarang);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: isi ? "UPDATE_CERMIN_PERKARA" : "RESET_CERMIN_PERKARA",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM_CERMIN}:${KUNCI_CERMIN_PENGATURAN}`,
      payload: isi
        ? { pemindaiAktif: isi.pemindaiAktif, layar: isi.layar, ukuranKelompok: isi.ukuranKelompok, jedaDetik: isi.jedaDetik }
        : { kembaliKeBawaan: true, semuaMati: PENGATURAN_CERMIN_BAWAAN.pemindaiAktif === false },
      createdAt: sekarang,
    });
  });
  buangSinggahPengaturanCermin();
  return actor;
}
