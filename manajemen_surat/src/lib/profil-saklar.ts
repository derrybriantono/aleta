import { getEffectivePositionId, getEffectiveRoleId } from "@/lib/permissions";

/**
 * ============================================================================
 * PROFIL SAKLAR PER PERAN (kontrak K4, butir 25 perbaikan 30 Sep 2026)
 * ============================================================================
 *
 * "Profil saklar mengikuti peran login: panel/widget hanya menampilkan fitur
 * peran itu; menu profil saklar hanya untuk Super Admin & Admin; menu admin
 * Profil saklar per peran."
 *
 * Aturan murni di sini; penyimpanan di
 * src/server/modules/aleta-ecourt/profil-saklar.ts (aleta_profil_saklar,
 * migrasi 0054).
 *
 * ============================================================================
 * PERAN PROFIL - JABATAN PERSIDANGAN, BUKAN HANYA roleId
 * ============================================================================
 *
 * Di data berbenih (dan di satker) panitera pengganti dan juru sita banyak
 * yang berperan "staf" dengan POSISI pos-panitera-pengganti / pos-jurusita.
 * Karena itu peran profil dibaca dari peran DAN posisi yang berlaku (plt
 * ikut), dengan urutan yang sama dengan tentukanPeran di checklist:
 *
 *   super-admin / admin            -> "super-admin" / "admin" (tidak dibatasi)
 *   hakim, ketua, wakil ketua      -> "hakim"
 *   panitera pengganti             -> "panitera-pengganti"
 *   juru sita (dan pengganti)      -> "juru-sita"
 *   selainnya                      -> id peran yang berlaku (mis. "panitera")
 *
 * ============================================================================
 * BAWAAN - USULAN POPUP YANG SUDAH ADA (popup.js PROFIL_SAKLAR)
 * ============================================================================
 *
 *   Hakim              tandai ✓  sisip jadwal ✓  cetak 3 berkas ✗  checklist ✓
 *   Panitera Pengganti tandai ✓  sisip jadwal ✓  cetak 3 berkas ✓  checklist ✓
 *   Juru Sita          tandai ✓  sisip jadwal ✗  cetak 3 berkas ✗  checklist ✓
 *   "Sunting sekali klik di ABT" MATI di ketiganya.
 *
 * Saklar induk (aktif) tidak disentuh bawaan. Peran lain tanpa baris admin:
 * saklar null (tidak diatur - ekstensi memakai saklar peramban). fitur null =
 * semua fitur ide boleh.
 */

export const KUNCI_SAKLAR_PROFIL = [
  "aktif",
  "tandaiHalaman",
  "sisipJadwal",
  "cetakTigaBerkas",
  "checklistMilestone",
  "suntingLangsungAbt",
] as const;
export type KunciSaklarProfil = (typeof KUNCI_SAKLAR_PROFIL)[number];

export const LABEL_SAKLAR_PROFIL: Record<KunciSaklarProfil, string> = {
  aktif: "ALETA menyala (saklar induk)",
  tandaiHalaman: "Tandai halaman SIPP",
  sisipJadwal: "Sisipkan jadwal sidang",
  cetakTigaBerkas: "Cetak tiga berkas",
  checklistMilestone: "Checklist milestone",
  suntingLangsungAbt: "Sunting sekali klik di ABT",
};

export type SaklarProfil = Partial<Record<KunciSaklarProfil, boolean>>;

export const PERAN_PROFIL_UTAMA = ["hakim", "panitera-pengganti", "juru-sita"] as const;

export const LABEL_PERAN_PROFIL: Record<string, string> = {
  hakim: "Hakim",
  "panitera-pengganti": "Panitera Pengganti",
  "juru-sita": "Juru Sita",
  admin: "Admin",
  "super-admin": "Super Admin",
};

export const PROFIL_BAWAAN: Record<string, SaklarProfil> = {
  hakim: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
  "panitera-pengganti": {
    tandaiHalaman: true,
    sisipJadwal: true,
    cetakTigaBerkas: true,
    suntingLangsungAbt: false,
    checklistMilestone: true,
  },
  "juru-sita": {
    tandaiHalaman: true,
    sisipJadwal: false,
    cetakTigaBerkas: false,
    suntingLangsungAbt: false,
    checklistMilestone: true,
  },
};

type Persona = {
  roleId?: string | null;
  positionId?: string | null;
  additionalRoleIds?: string[] | null;
  [kunci: string]: unknown;
};

/** Kunci profil untuk seorang pegawai - lihat catatan di kepala berkas. */
export function peranProfil(aktor: Persona): string {
  const utama = String(getEffectiveRoleId(aktor as never) ?? aktor.roleId ?? "");
  const posisi = String(getEffectivePositionId(aktor as never) ?? aktor.positionId ?? "");
  const peran = new Set([utama, String(aktor.roleId ?? ""), ...(aktor.additionalRoleIds ?? []).map(String)].filter(Boolean));
  if (peran.has("super-admin")) return "super-admin";
  if (peran.has("admin")) return "admin";
  if (["hakim", "ketua", "wakil-ketua"].some((p) => peran.has(p)) || ["pos-hakim", "pos-ketua", "pos-wakil"].includes(posisi)) {
    return "hakim";
  }
  if (peran.has("panitera-pengganti") || posisi === "pos-panitera-pengganti") return "panitera-pengganti";
  if (peran.has("jurusita") || posisi === "pos-jurusita" || posisi === "pos-jurusita-pengganti") return "juru-sita";
  return utama || "staf";
}

/** "jurusita" (id peran portal) dan "juru-sita" (kunci kontrak) adalah peran yang sama. */
export function normalkanPeranProfil(peran: unknown): string {
  const k = String(peran ?? "")
    .trim()
    .toLowerCase();
  if (k === "jurusita" || k === "juru sita") return "juru-sita";
  if (k === "pp" || k === "panitera pengganti") return "panitera-pengganti";
  return k.replace(/[^a-z0-9-]/g, "");
}

export class GalatProfil extends Error {}

/** Hanya kunci yang dikenal, hanya boolean. Selain itu ditolak - bukan dibuang diam-diam. */
export function bersihkanSaklar(masukan: unknown): SaklarProfil {
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) {
    throw new GalatProfil("saklar harus berupa objek { tandaiHalaman: true, ... }.");
  }
  const hasil: SaklarProfil = {};
  for (const [kunci, nilai] of Object.entries(masukan as Record<string, unknown>)) {
    if (!(KUNCI_SAKLAR_PROFIL as readonly string[]).includes(kunci)) {
      throw new GalatProfil(`Saklar "${kunci}" tidak dikenal. Yang dikenal: ${KUNCI_SAKLAR_PROFIL.join(", ")}.`);
    }
    if (typeof nilai !== "boolean") throw new GalatProfil(`Saklar "${kunci}" harus true atau false.`);
    hasil[kunci as KunciSaklarProfil] = nilai;
  }
  return hasil;
}

/** Saklar tersimpan dibaca ulang dengan aturan yang sama, tetapi tanpa melempar. */
export function saklarDariJson(teks: string | null | undefined): SaklarProfil {
  try {
    return bersihkanSaklar(JSON.parse(String(teks ?? "{}")));
  } catch {
    return {};
  }
}

export function profilAdalahAdmin(peran: string) {
  return peran === "admin" || peran === "super-admin";
}
