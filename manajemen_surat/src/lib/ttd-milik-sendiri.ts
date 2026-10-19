/**
 * ============================================================================
 * TANDA TANGAN MILIK SENDIRI UNTUK CETAK BLANGKO DERRY (19 Okt 2026)
 * ============================================================================
 *
 * Panel "Blangko ABT by Derry Briantono" membubuhkan gambar tanda tangan di PDF. Rute /api/aleta-ecourt/tanda-tangan
 * menuntut kapabilitas "blangko-abt" (menamai/mengesahkan gambar), sehingga hakim atau panitera pengganti biasa
 * ditolak 403 dan menu "Tambah tanda tangan ke PDF" selalu berkata "belum ada tanda tangan".
 *
 * Aturan di sini: akun tanpa kapabilitas itu tetap boleh membaca baris yang SAH dan MILIKNYA saja:
 *   1. baris yang pengguna_id-nya sama dengan akunnya (tautan akun), atau
 *   2. baris yang BELUM ditautkan ke akun mana pun dan namanya sama dengan nama akunnya
 *      (penuh, atau tanpa gelar - aturan sama dengan penetapanEdocService.cocokkanTandaTangan).
 * Baris yang ditautkan ke akun LAIN tidak pernah ikut, walau namanya sama.
 */

export type BarisTtd = {
  id: number;
  namaPejabat: string;
  disahkan?: boolean;
  penggunaId?: string;
  disahkanPada?: string;
  [lain: string]: unknown;
};

/** Huruf kecil, hanya a-z0-9 (sama dengan tandaTanganService.bakuNama). */
export const bakuNamaTtd = (nilai: unknown): string => String(nilai ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Nama tanpa gelar depan dan tanpa gelar di belakang koma (sama dengan penetapanEdocService.intiNama). */
export function intiNamaTtd(nama: unknown): string {
  const depan = String(nama ?? "").split(",")[0];
  const tanpaGelar = depan.replace(/^\s*(?:(?:prof|dr|drs|dra|ir|h|hj|kh|kgs|tgk)\.?\s+)+/i, "");
  return bakuNamaTtd(tanpaGelar);
}

/** Apakah nama baris tanda tangan menunjuk orang yang sama dengan nama akun (penuh atau inti, inti minimal 5 huruf). */
export function namaTtdSama(namaBaris: unknown, namaAkun: unknown): boolean {
  const penuh = bakuNamaTtd(namaBaris);
  if (penuh && penuh === bakuNamaTtd(namaAkun)) return true;
  const inti = intiNamaTtd(namaAkun);
  return inti.length >= 5 && intiNamaTtd(namaBaris) === inti;
}

/** Baris SAH milik akun ini. Tanpa id/nama akun -> kosong. */
export function barisTtdMilik(baris: readonly BarisTtd[], akun: { id?: string | null; name?: string | null }): BarisTtd[] {
  const id = String(akun.id ?? "").trim();
  return (Array.isArray(baris) ? baris : []).filter((b) => {
    if (!b || b.disahkan === false || !String(b.namaPejabat ?? "").trim()) return false;
    const taut = String(b.penggunaId ?? "").trim();
    if (taut) return Boolean(id) && taut === id;
    return namaTtdSama(b.namaPejabat, akun.name);
  });
}
