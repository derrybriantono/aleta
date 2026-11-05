/**
 * ============================================================================
 * PERKARA REKAAN UNTUK MENCOBA BLANGKO - ALETA ABT Tahap 3 (5 Nov 2026)
 * ============================================================================
 *
 * Sebelum diterbitkan, blangko dicoba pada perkara KARANGAN: semua nama, nomor, tanggal, dan alamat di bawah ini tidak
 * menunjuk siapa pun dan tidak diambil dari SIPP atau ABT. Isian yang namanya tidak dikenali tampil sebagai ‹nama isian›
 * supaya kelihatan mana yang belum punya contoh. Ini BUKAN mesin pengisi sungguhan (itu butuh perkara di SIPP/ABT):
 * hanya untuk melihat letak teks, jarak, dan kalimat di sekitar isian.
 */

export const NAMA_PERKARA_REKAAN = "Perkara rekaan 1/Pdt.G/2026/PA.Contoh";

const ATURAN: Array<[RegExp, string]> = [
  [/nomor\s*perkara|no\.?\s*perkara/i, "1/Pdt.G/2026/PA.Contoh"],
  [/tergugat|termohon/i, "Ahmad Contoh bin Hasan Contoh"],
  [/penggugat|pemohon/i, "Siti Contoh binti Budi Contoh"],
  [/ketua\s*majelis/i, "Drs. Hakim Ketua Contoh, M.H."],
  [/hakim\s*anggota/i, "Hakim Anggota Contoh, S.H.I."],
  [/panitera\s*pengganti/i, "Panitera Pengganti Contoh, S.H."],
  [/jurusita/i, "Jurusita Contoh, S.H."],
  [/hari/i, "Senin"],
  [/tanggal|tgl/i, "5 Januari 2026"],
  [/jam|pukul/i, "09.00 WITA"],
  [/umur|usia/i, "35"],
  [/agama/i, "Islam"],
  [/pendidikan/i, "S1"],
  [/pekerjaan/i, "Wiraswasta"],
  [/nik/i, "0000000000000000"],
  [/alamat|tempat\s*kediaman|tempat\s*tinggal|domisili/i, "Jalan Contoh No. 1, Kelurahan Contoh, Kota Contoh"],
  [/pengadilan|satker|satuan\s*kerja/i, "Pengadilan Agama Contoh"],
  [/biaya|panjar|rp/i, "Rp. 500.000,-"],
  [/nama/i, "Fulan bin Fulan"],
];

/** Contoh nilai untuk satu isian menurut namanya; null bila tidak ada contoh. */
export function nilaiRekaan(nama: string): string | null {
  const n = String(nama ?? "");
  for (const [pola, nilai] of ATURAN) if (pola.test(n)) return nilai;
  return null;
}
