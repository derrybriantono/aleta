import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AktorSkp, JabatanSkp, JenisSkp, LembarSkp, PegawaiSkp } from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase } from "@/server/db/client";
import { peranAktorSkp, type PegawaiHakSkp } from "@/server/modules/skp/hak";
import { bacaPemetaan, pemetaanDalamRentang, sarankanJabatanSkp } from "@/server/modules/skp/pemetaan";
import { bacaJsonAman, teksAtauNull } from "@/server/modules/skp/umum";
import { getEffectiveRoleId } from "@/lib/permissions";
import { requireActorUser } from "@/server/modules/organization/service";
import type { PemetaanAkunPegawaiSkp } from "@/lib/skp-jabatan-tipe";

/**
 * Pegawai untuk SKP: identitas, jabatan menurut pemetaan (atau saran dari
 * peran/jabatan ALETA), dan atasan langsungnya
 * (employee_profiles.supervisor_employee_id).
 */

export type KeadaanPegawaiSkp = PegawaiSkp & {
  roleId: string;
  positionId: string;
  /** Peran tambahan (mediator, kasir, meja, operator) - ikut menentukan saran jabatan. */
  peranTambahan: string[];
  aktif: boolean;
  atasanLangsungUserId: string | null;
  atasanNama: string | null;
  /** Jabatan ALETA atasan (nama posisi), untuk Pejabat Penilai. */
  atasanJabatan: string | null;
  atasanNip: string | null;
  /** Jenis SKP yang dapat disusun untuk pegawai ini. */
  jenisTersedia: JenisSkp[];
};

type BarisPegawai = {
  id: string;
  name: string;
  nip: string | null;
  role_id: string;
  position_id: string;
  additional_role_ids_json: string | null;
  is_active: number | boolean;
  profile_nip: string | null;
  rank_grade: string | null;
  atasan_user_id: string | null;
  atasan_nama: string | null;
  atasan_nip: string | null;
  atasan_profile_nip: string | null;
  atasan_jabatan: string | null;
};

const KUERI_PEGAWAI = `
  SELECT u.id, u.name, u.nip, u.role_id, u.position_id, u.additional_role_ids_json, u.is_active,
         p.nip AS profile_nip, p.rank_grade,
         s.user_id AS atasan_user_id, su.name AS atasan_nama, su.nip AS atasan_nip,
         s.nip AS atasan_profile_nip, sp.name AS atasan_jabatan
    FROM users u
    LEFT JOIN employee_profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
    LEFT JOIN employee_profiles s ON s.id = p.supervisor_employee_id AND s.deleted_at IS NULL
    LEFT JOIN users su ON su.id = s.user_id
    LEFT JOIN positions sp ON sp.id = su.position_id
   WHERE u.deleted_at IS NULL`;

function hariIniWita(): string {
  return waktuPengadilan().tanggal;
}

function susunKeadaan(
  b: BarisPegawai,
  pemetaanUser: readonly PemetaanAkunPegawaiSkp[],
  rentang: { mulai: string; selesai: string } | null
): KeadaanPegawaiSkp {
  const hariIni = hariIniWita();
  const mulai = rentang?.mulai ?? hariIni;
  const selesai = rentang?.selesai ?? hariIni;
  const urut = (l: PemetaanAkunPegawaiSkp[]) => l.sort((a, c) => c.berlakuDari.localeCompare(a.berlakuDari));
  // Jabatan melekat pada orangnya, bukan pada akun: bila tak ada tautan yang
  // berlaku pada periode itu, tautan terakhir sebelumnya tetap menunjukkan
  // jabatannya (akun yang dipegang dihitung terpisah, menurut tanggal).
  const berlaku = urut(pemetaanDalamRentang(pemetaanUser, mulai, selesai));
  const acuan = berlaku.length > 0 ? berlaku : urut(pemetaanUser.filter((p) => p.berlakuDari <= selesai));
  const peranTambahan = (() => {
    const daftar = bacaJsonAman<unknown>(b.additional_role_ids_json, []);
    return Array.isArray(daftar) ? daftar.map(String) : [];
  })();
  const saran = sarankanJabatanSkp({ roleId: b.role_id, positionId: b.position_id, additionalRoleIds: peranTambahan });

  let utama: JabatanSkp | null = acuan.find((p) => p.jabatanUtama)?.jabatanUtama ?? saran.utama;
  let tambahan: JabatanSkp[] = acuan.length > 0 ? [...new Set(acuan.flatMap((p) => p.jabatanTambahan))] : saran.tambahan;
  // Ketua vs Wakil selalu mengikuti peran ALETA.
  if (b.role_id === "ketua") utama = "ketua";
  else if (b.role_id === "wakil-ketua") utama = "wakil-ketua";
  tambahan = tambahan.filter((j) => j !== utama);

  const jenisTersedia: JenisSkp[] = [];
  if (b.role_id === "hakim" || b.role_id === "ketua" || b.role_id === "wakil-ketua") jenisTersedia.push("hakim");
  if (b.role_id === "ketua" || b.role_id === "wakil-ketua") jenisTersedia.push("pimpinan");
  if (utama && utama !== "ketua" && utama !== "wakil-ketua") jenisTersedia.push(utama);
  for (const j of tambahan) if (!jenisTersedia.includes(j)) jenisTersedia.push(j);

  return {
    userId: b.id,
    nama: b.name,
    nip: teksAtauNull(b.nip) ?? teksAtauNull(b.profile_nip),
    pangkatGolongan: teksAtauNull(b.rank_grade),
    jabatanUtama: utama,
    jabatanTambahan: tambahan,
    roleId: b.role_id,
    positionId: b.position_id,
    peranTambahan,
    aktif: Boolean(b.is_active),
    atasanLangsungUserId: teksAtauNull(b.atasan_user_id),
    atasanNama: teksAtauNull(b.atasan_nama),
    atasanJabatan: teksAtauNull(b.atasan_jabatan),
    atasanNip: teksAtauNull(b.atasan_nip) ?? teksAtauNull(b.atasan_profile_nip),
    jenisTersedia,
  };
}

/** Satu pegawai; null bila tidak ada. `rentang` = periode yang dinilai (jabatan bertanggal). */
export async function bacaKeadaanPegawai(
  db: AletaDatabase,
  userId: string,
  rentang: { mulai: string; selesai: string } | null = null
): Promise<KeadaanPegawaiSkp | null> {
  const baris = await db.queryOne<BarisPegawai>(`${KUERI_PEGAWAI} AND u.id = ?`, [userId]);
  if (!baris) return null;
  return susunKeadaan(baris, await bacaPemetaan(db, { userId }), rentang);
}

/** Semua pegawai (pengguna ALETA aktif maupun tidak), urut nama. */
export async function daftarKeadaanPegawai(
  db: AletaDatabase,
  rentang: { mulai: string; selesai: string } | null = null
): Promise<KeadaanPegawaiSkp[]> {
  const baris = await db.queryAll<BarisPegawai>(`${KUERI_PEGAWAI} ORDER BY u.name ASC`);
  const pemetaan = await bacaPemetaan(db);
  const perPegawai = new Map<string, PemetaanAkunPegawaiSkp[]>();
  for (const p of pemetaan) perPegawai.set(p.userId, [...(perPegawai.get(p.userId) ?? []), p]);
  return baris.map((b) => susunKeadaan(b, perPegawai.get(b.id) ?? [], rentang));
}

export function hakPegawai(k: Pick<KeadaanPegawaiSkp, "userId" | "atasanLangsungUserId">): PegawaiHakSkp {
  return { userId: k.userId, atasanLangsungUserId: k.atasanLangsungUserId };
}

/** Aktor dari sesi: peran EFEKTIF (PLH/PLT memakai kewenangan jabatan yang dijalankannya). */
export async function bacaAktorSkp(db: AletaDatabase, actorUserId: string | null | undefined) {
  const pengguna = await requireActorUser(db, actorUserId);
  const aktor: AktorSkp = { userId: pengguna.id, peran: peranAktorSkp(getEffectiveRoleId(pengguna)) };
  return { aktor, pengguna };
}

export type PenilaiSkp = { penilai: LembarSkp["pejabatPenilai"]; userId: string };

/**
 * Pejabat penilai: atasan langsung bila tercatat; bila tidak, Ketua yang aktif
 * (kecuali pegawainya Ketua sendiri - penilainya di luar ALETA, kosong).
 */
export async function pejabatPenilaiSkp(db: AletaDatabase, pegawai: KeadaanPegawaiSkp): Promise<PenilaiSkp> {
  if (pegawai.atasanLangsungUserId && pegawai.atasanNama) {
    return {
      userId: pegawai.atasanLangsungUserId,
      penilai: {
        nama: pegawai.atasanNama,
        nip: pegawai.atasanNip,
        jabatan: pegawai.atasanJabatan ?? "Atasan Langsung",
      },
    };
  }
  if (pegawai.roleId === "ketua") return { penilai: null, userId: "" };
  const ketua = await db.queryOne<{ id: string; name: string; nip: string | null; jabatan: string | null }>(
    `SELECT u.id, u.name, u.nip, p.name AS jabatan
       FROM users u LEFT JOIN positions p ON p.id = u.position_id
      WHERE u.role_id = 'ketua' AND u.is_active = 1 AND u.deleted_at IS NULL AND u.id <> ?
      ORDER BY u.name ASC LIMIT 1`,
    [pegawai.userId]
  );
  if (!ketua) return { penilai: null, userId: "" };
  return { userId: ketua.id, penilai: { nama: ketua.name, nip: teksAtauNull(ketua.nip), jabatan: ketua.jabatan ?? "Ketua" } };
}
