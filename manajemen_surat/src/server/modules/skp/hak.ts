import type {
  AktorSkp,
  HasilBolehLihatSkp,
  PeranAktorSkp,
} from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * HAK LIHAT, UBAH, TINJAU SKP JABATAN (rancangan 17 Okt 2026, disetujui)
 * ============================================================================
 *
 * Murni (tanpa basis data) supaya matriksnya dapat diuji seluruhnya. Urutan
 * pemeriksaan bolehLihatSkp:
 *
 *   1. sendiri                      -> boleh, boleh mengisi isian manual
 *   2. atasan langsung              -> boleh (employee_profiles.supervisor_employee_id)
 *   3. Ketua / Wakil Ketua / Panitera -> semua pegawai, LIHAT SAJA
 *   4. Super Admin / Admin          -> semua pegawai
 *   5. selain itu                   -> ditolak
 *
 * Mengisi/mengajukan isian manual HANYA pemilik (bolehUbahIsian). Target dan
 * pemetaan akun diubah Panitera, Ketua, Super Admin, dan Admin - Wakil Ketua
 * lihat saja. Menyetujui isian dan mengunci penetapan: atasan langsung,
 * Ketua, Panitera, Super Admin, dan Admin - tidak pernah pemiliknya sendiri.
 */

/** Pegawai yang dinilai haknya: cukup siapa dia dan siapa atasan langsungnya. */
export type PegawaiHakSkp = {
  userId: string;
  /** ID pengguna ALETA atasan langsung; null = tidak tercatat. */
  atasanLangsungUserId: string | null;
};

const PERAN_UBAH_TARGET: ReadonlySet<PeranAktorSkp> = new Set(["super-admin", "admin", "ketua", "panitera"]);
const PERAN_TINJAU: ReadonlySet<PeranAktorSkp> = new Set(["super-admin", "admin", "ketua", "panitera"]);

/** Peran ALETA (efektif, termasuk PLH/PLT) -> peran yang menentukan hak SKP. */
export function peranAktorSkp(roleId: string | null | undefined): PeranAktorSkp {
  switch (String(roleId ?? "")) {
    case "super-admin":
      return "super-admin";
    case "admin":
      return "admin";
    case "ketua":
      return "ketua";
    case "wakil-ketua":
      return "wakil-ketua";
    case "panitera":
      return "panitera";
    default:
      return "lainnya";
  }
}

export function bolehUbahTargetSkp(peran: PeranAktorSkp): boolean {
  return PERAN_UBAH_TARGET.has(peran);
}

export function bolehLihatSkp(aktor: AktorSkp, pegawai: PegawaiHakSkp): HasilBolehLihatSkp {
  const bolehUbahTarget = bolehUbahTargetSkp(aktor.peran);
  const ditolak: HasilBolehLihatSkp = { boleh: false, alasan: "ditolak", bolehUbahIsian: false, bolehUbahTarget: false };
  if (!aktor.userId || !pegawai.userId) return ditolak;

  if (aktor.userId === pegawai.userId) {
    return { boleh: true, alasan: "sendiri", bolehUbahIsian: true, bolehUbahTarget };
  }
  if (pegawai.atasanLangsungUserId && pegawai.atasanLangsungUserId === aktor.userId) {
    return { boleh: true, alasan: "atasan-langsung", bolehUbahIsian: false, bolehUbahTarget };
  }
  if (aktor.peran === "ketua" || aktor.peran === "wakil-ketua" || aktor.peran === "panitera") {
    return { boleh: true, alasan: aktor.peran, bolehUbahIsian: false, bolehUbahTarget };
  }
  if (aktor.peran === "super-admin" || aktor.peran === "admin") {
    return { boleh: true, alasan: aktor.peran, bolehUbahIsian: false, bolehUbahTarget };
  }
  return ditolak;
}

/**
 * Menyetujui/mengembalikan isian manual dan mengunci penetapan: atasan
 * langsung, Ketua, Panitera, Super Admin, Admin. Wakil Ketua lihat saja
 * (kecuali ia atasan langsungnya), dan pemilik tidak menyetujui dirinya.
 */
export function bolehTinjauSkp(aktor: AktorSkp, pegawai: PegawaiHakSkp): boolean {
  if (!aktor.userId || aktor.userId === pegawai.userId) return false;
  if (pegawai.atasanLangsungUserId && pegawai.atasanLangsungUserId === aktor.userId) return true;
  return PERAN_TINJAU.has(aktor.peran);
}
