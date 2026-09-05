import { type RoleId } from "@/lib/types";

/**
 * Aturan kewenangan penetapan - murni logika, tanpa basis data.
 *
 * ============================================================================
 * MENGAPA BERDIRI SENDIRI
 * ============================================================================
 *
 * Aturan ini dipakai dua jalur yang sangat berbeda: menutup antrean penetapan,
 * dan masuk SIPP atas nama pejabat lain. Yang pertama menyimpan barisnya di
 * tabel aleta_sipp_penunjukan_antrean; yang kedua tidak menyentuh tabel itu
 * sama sekali.
 *
 * Ketika aturannya masih menumpang di modul antrean, jalur kedua ikut menarik
 * seluruh modul itu - dan pemasangan yang belum memiliki tabel antreannya
 * GAGAL DIBANGUN, walaupun yang dipakai hanya dua fungsi yang tidak pernah
 * menyentuh basis data.
 *
 * ============================================================================
 * JABATAN MANA MENETAPKAN APA
 * ============================================================================
 *
 * Wakil Ketua ikut pada PMH karena Ketua berhalangan adalah keadaan yang
 * benar-benar terjadi, dan menuntut penetapan berhenti sampai Ketua kembali
 * berarti perkara berhenti.
 *
 * PHS milik ketua majelis perkara itu sendiri - karena itu "hakim" ada di
 * daftarnya, dan siapa ketua majelisnya dibaca dari perkara_hakim_pn, bukan
 * dari daftar SK.
 */
export const JABATAN_PENETAP: Record<string, RoleId[]> = {
  pmh: ["ketua", "wakil-ketua"],
  ppp: ["panitera"],
  pjs: ["panitera"],
  phs: ["ketua", "wakil-ketua", "hakim"],
};

export const SEBUTAN_PENETAPAN: Record<string, string> = {
  pmh: "Penetapan Majelis Hakim",
  ppp: "Penetapan Panitera Pengganti",
  pjs: "Penetapan Juru Sita",
  phs: "Penetapan Hari Sidang",
};

/** Jabatan yang seharusnya mengerjakan satu penetapan, untuk ditampilkan. */
export function sebutanJabatan(jenis: string): string {
  const peran = JABATAN_PENETAP[jenis] ?? [];
  if (peran.includes("panitera")) return "Panitera";
  if (jenis === "phs") return "ketua majelis";
  return "Ketua Pengadilan";
}

/**
 * Apakah peran ini berwenang mengerjakan satu penetapan.
 *
 * Super Admin dan Admin selalu berwenang - keduanya memang berkemampuan penuh,
 * dan menahannya di sini akan membuat administrasi tidak dapat membetulkan
 * apa pun ketika ada yang macet.
 */
export function bolehMenetapkan(
  roleId: string,
  jenis: string,
  mode: "longgar" | "ketat" = "longgar"
): boolean {
  if (roleId === "super-admin" || roleId === "admin") return true;

  // Bawaannya longgar, mengikuti cara kerja yang berjalan: penetapan disiapkan
  // operator atas arahan Ketua Pengadilan demi kelancaran proses. Yang ketat
  // disediakan bagi pengadilan yang menghendakinya.
  //
  // Berapa pun modenya, catatan pengisian tetap menyebutkan siapa yang
  // benar-benar mengerjakannya - yang dilonggarkan penjagaannya, bukan
  // kejujuran catatannya.
  if (mode !== "ketat") return true;
  return (JABATAN_PENETAP[jenis] ?? []).includes(roleId as RoleId);
}
