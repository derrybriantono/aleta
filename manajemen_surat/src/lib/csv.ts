/**
 * ============================================================================
 * SATU RUAS, SATU TABEL CSV - SATU DEFINISI
 * ============================================================================
 *
 * ruasCsv dulu hidup sebagai fungsi privat di aleta-ecourt-riwayat.tsx, dan
 * berkas itu "use client". Rute peladen tidak boleh mengimpor komponen client,
 * sehingga penyusun ZIP yang juga menulis CSV hanya punya dua pilihan:
 * menyalinnya - dua definisi yang menyimpang diam-diam pada suntingan
 * berikutnya - atau memindahkannya ke sini. Yang dipilih yang kedua.
 *
 * Nomor perkara memuat garis miring dan koma tidak pernah muncul di dalamnya -
 * tetapi keterangan hasil relaas, alamat saksi, dan amar putusan memuat
 * keduanya, dan satu koma yang tidak dikutip menggeser seluruh kolom di
 * kanannya tanpa ada yang menyadarinya sampai berkasnya dibaca orang lain.
 */
export function ruasCsv(nilai: unknown): string {
  const teks = nilai === null || nilai === undefined ? "" : String(nilai);
  return /[",\n;]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

/**
 * Satu tabel CSV utuh, siap ditulis sebagai berkas.
 *
 * BOM di depan: tanpa itu Excel di Windows membaca berkas UTF-8 sebagai ANSI,
 * dan tiap nama bergelar berubah menjadi aksara yang tidak terbaca. CRLF,
 * sebab yang membukanya Excel di Windows - bukan alat baris perintah.
 */
export function tabelCsv(kepala: string[], baris: Array<unknown[]>): string {
  const isi = [kepala.join(","), ...baris.map((b) => b.map(ruasCsv).join(","))].join("\r\n");
  return `﻿${isi}\r\n`;
}
