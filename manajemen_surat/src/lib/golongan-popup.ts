import { getEffectivePositionId, getEffectiveRoleId } from "@/lib/permissions";
import { bolehKasir } from "@/lib/kasir-jurnal";

/**
 * ============================================================================
 * GOLONGAN PEGAWAI UNTUK POPUP EKSTENSI (12 Okt 2026)
 * ============================================================================
 *
 * Popup ekstensi (widget di bilah Chrome) menampilkan saklar yang relevan
 * dengan golongan pegawai yang masuk, dan menyimpan pengaturannya terpisah
 * per akun + golongan. Aturan golongannya satu-satunya di sini; popup hanya
 * membaca `golongan` dari GET /ekstensi?info=siapa (dan jatuh ke tebakan dari
 * nama peran bila portalnya lebih lama).
 *
 * `kode` = golongan UTAMA (untuk kunci penyimpanan dan profil saklar);
 * `semua` = seluruh golongan yang berlaku (seorang hakim yang juga operator).
 * Urutan prioritas utama mengikuti jabatan: admin > ketua > hakim > panitera
 * pengganti > juru sita > panitera > kasir > ptsp > mediator > operator > umum.
 */
export const KODE_GOLONGAN_POPUP = [
  "super-admin",
  "admin",
  "ketua",
  "hakim",
  "panitera-pengganti",
  "juru-sita",
  "panitera",
  "kasir",
  "ptsp",
  "mediator",
  "operator",
  "umum",
] as const;
export type KodeGolonganPopup = (typeof KODE_GOLONGAN_POPUP)[number];

type Pegawai = {
  roleId?: string | null;
  positionId?: string | null;
  additionalRoleIds?: string[] | null;
  [kunci: string]: unknown;
};

const POSISI_PANITERA = /^pos-panitera($|-muda)/;

export function golonganPopup(aktor: Pegawai): { kode: KodeGolonganPopup; semua: KodeGolonganPopup[] } {
  const utama = String(getEffectiveRoleId(aktor as never) ?? aktor.roleId ?? "");
  const posisi = String(getEffectivePositionId(aktor as never) ?? aktor.positionId ?? "");
  const peran = new Set(
    [utama, String(aktor.roleId ?? ""), ...(aktor.additionalRoleIds ?? []).map((x) => String(x).toLowerCase())].filter(Boolean)
  );
  const punya = (...p: string[]) => p.some((x) => peran.has(x));

  const hasil: KodeGolonganPopup[] = [];
  if (punya("super-admin")) hasil.push("super-admin");
  if (punya("admin")) hasil.push("admin");
  if (punya("ketua", "wakil-ketua") || ["pos-ketua", "pos-wakil"].includes(posisi)) hasil.push("ketua");
  if (punya("hakim") || posisi === "pos-hakim") hasil.push("hakim");
  if (punya("panitera-pengganti") || posisi === "pos-panitera-pengganti") hasil.push("panitera-pengganti");
  if (punya("jurusita", "juru-sita") || posisi === "pos-jurusita" || posisi === "pos-jurusita-pengganti") hasil.push("juru-sita");
  if (punya("panitera", "panitera-muda") || (POSISI_PANITERA.test(posisi) && posisi !== "pos-panitera-pengganti")) {
    hasil.push("panitera");
  }
  // Kasir: peran/jabatan keuangan perkara. Panitera dan admin juga lolos
  // bolehKasir, tetapi golongan mereka sudah dihitung di atas.
  if (
    bolehKasir(aktor as never) &&
    !hasil.some((h) => h === "super-admin" || h === "admin" || h === "panitera") &&
    (punya("analis-keuangan", "kasir", "petugas_keuangan_perkara", "bendahara_penerimaan", "bendahara_pengeluaran") ||
      /^pos-(bendahara|analis-keuangan)/.test(posisi))
  ) {
    hasil.push("kasir");
  }
  if (punya("ptsp") || posisi === "pos-ptsp") hasil.push("ptsp");
  if (punya("mediator")) hasil.push("mediator");
  if (punya("operator") || posisi === "pos-pranata-komputer") hasil.push("operator");

  const semua = hasil.length ? hasil : (["umum"] as KodeGolonganPopup[]);
  return { kode: semua[0], semua };
}
