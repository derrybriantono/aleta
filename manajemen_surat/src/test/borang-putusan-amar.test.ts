// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import {
  saringKalimatRujukan,
  saringMedanPilihan,
  usulkanMedanPutusan,
  type EntriTipeMedan,
  type MedanPilihan,
  type UsulanMedan,
} from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * BORANG PUTUSAN AKHIR: STATUS DARI AMAR, DAN SALAH TANGKAP YANG SUDAH DIUKUR
 * ============================================================================
 *
 * Penjaga ini MENJALANKAN usulkanMedanPutusan atas petikan putusan sungguhan
 * PA Donggala 2025-2026 (sipp_donggala, hanya SELECT) yang pilihannya sudah
 * ditetapkan petugas. Tiap petikan DISAMARKAN: nama menjadi "xxx", isi kurung
 * sesudah sebutan menjadi "( xxx )", tanggal menjadi "xx xxxx", nomor perkara
 * menjadi "xxx/Pdt.G/..." - tanpa NIK dan alamat. Yang dipetik terutama kasus
 * SALAH TANGKAP kode lama (kolom `lama` = jawaban kode sebelum perbaikan).
 *
 * Kasus yang ditandai "buatan" disusun tangan untuk sisi sebaliknya aturan
 * (frasa yang memang harus tertangkap), karena datanya tidak memuat contoh.
 *
 * Angka ukur penuhnya (1.633 putusan) ada di catatan tiap aturan di
 * usulan-medan-putusan.ts; skripnya di D:/aleta-dev/kerja/enam-butir/
 * t1-borang-putusan-portal/ukur-borang2.ts.
 */

const STATUS: MedanPilihan = {
  kunci: 'select[name="status_putusan"]',
  label: "Status Putusan",
  pilihan: [
    { nilai: "-1", label: "Pilih Status Putusan" },
    { nilai: "62", label: "Dikabulkan" },
    { nilai: "92", label: "Dismissal" },
    { nilai: "63", label: "Ditolak" },
    { nilai: "93", label: "Gugur" },
    { nilai: "64", label: "Tidak Dapat Diterima" },
    { nilai: "65", label: "Digugurkan" },
    { nilai: "66", label: "Dicoret dari Register" },
    { nilai: "67", label: "Dicabut" },
    { nilai: "85", label: "Perdamaian" },
  ],
};

const VERSTEK: MedanPilihan = {
  kunci: 'select[name="verstek"]',
  label: "Putusan Verstek",
  pilihan: [
    { nilai: "T", label: "Tidak" },
    { nilai: "Y", label: "Ya" },
  ],
};

const QOBLA: MedanPilihan = {
  kunci: 'select[name="qobla"]',
  label: "Qobla/Ba'da Dukhul",
  pilihan: [
    { nilai: "-1", label: "Pilih Salah Satu" },
    { nilai: "0", label: "Qobla Dukhul" },
    { nilai: "1", label: "Ba'da Dukhul" },
  ],
};

const NUSYUZ: MedanPilihan = {
  kunci: 'input[name="status_nusyuz"]',
  label: "Status Nusyuz",
  pilihan: [
    { nilai: "1", label: "Nusyuz" },
    { nilai: "0", label: "Tidak Nusyuz" },
  ],
};

const KEADAAN: MedanPilihan = {
  kunci: 'select[name="keadaan_istri"]',
  label: "Keadaan Istri",
  pilihan: [
    { nilai: "", label: "Pilih Keadaan Istri" },
    { nilai: "1", label: "Suci" },
    { nilai: "2", label: "Haid" },
    { nilai: "3", label: "Hamil" },
    { nilai: "4", label: "Tidak diketahui" },
  ],
};

const PILIHAN_FAKTOR = [
  { nilai: "-1", label: "Pilih Faktor" },
  { nilai: "8", label: "Cacat Badan" },
  { nilai: "6", label: "Dihukum Penjara" },
  { nilai: "12", label: "Ekonomi" },
  { nilai: "4", label: "Judi" },
  { nilai: "10", label: "Kawin Paksa" },
  { nilai: "7", label: "Kekerasan Dalam Rumah Tangga" },
  { nilai: "2", label: "Mabuk" },
  { nilai: "3", label: "Madat" },
  { nilai: "5", label: "Meninggalkan Salah Satu Pihak" },
  { nilai: "11", label: "Murtad" },
  { nilai: "9", label: "Peselisihan dan Pertengkaran Terus Menerus" },
  { nilai: "13", label: "Poligami" },
  { nilai: "1", label: "Zina" },
];
const FAKTOR: MedanPilihan = { kunci: 'select[name="faktor_cerai"]', label: "Faktor Penyebab Perceraian", pilihan: PILIHAN_FAKTOR };
const FAKTOR2: MedanPilihan = {
  kunci: 'select[name="faktor_cerai_sekunder"]',
  label: "Faktor Penyebab Perceraian (Sekunder)",
  pilihan: PILIHAN_FAKTOR,
};

const DISPEN: MedanPilihan = {
  kunci: 'select[name="alasan_dispen"]',
  label: "Alasan Pengajuan Dispensasi Kawin",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Hamil" },
    { nilai: "2", label: "Pergaulan Bebas/Hubungan Intim" },
    { nilai: "3", label: "Ekonomi" },
    { nilai: "4", label: "Budaya/Adat/Perjodohan" },
    { nilai: "5", label: "Menghindari Zina/Hubungan Cinta" },
  ],
};

const SATU = (naskah: string, medan: MedanPilihan, opsi: Parameters<typeof usulkanMedanPutusan>[2] = {}): UsulanMedan =>
  usulkanMedanPutusan(naskah, [medan], opsi)[0];

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE ANONIM - petikan putusan sungguhan, disamarkan
// ─────────────────────────────────────────────────────────────────────────────

/** Amar tersimpan beserta status yang dipilih petugas; `lama` = jawaban dari pertimbangan. */
const STATUS_DARI_AMAR: Array<{ status: string; lama: string; amar: string }> = [
  { status: "Dicabut", lama: "Perdamaian", amar: "xxx: Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Pemohon; Memerintahkan Panitera Pengadilan Agama Donggala untuk mencatat pencabutan perkara tersebut dalam register perkara; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp174.500,00 (seratus tujuh puluh empat ribu lima ratus rupiah);" },
  { status: "Dicabut", lama: "Dikabulkan", amar: "Mengabulkan permohonan Penggugat untuk mencabut perkaranya; Menyatakan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dicabut; Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp 221500,00 ( dua ratus dua puluh satu ribu lima ratus )." },
  { status: "Tidak Dapat Diterima", lama: "Tidak Dapat Diterima", amar: "xxx: Menolak eksepsi Tergugat tentang kewenangan absolut; xxx eksepsi Tergugat tentang gugatan Penggugat kabur atau obscuur libel ; Menyatakan gugatan Penggugat kabur atau obscuur libel ; xxx: Dalam Konvensi: Menyatakan gugatan Penggugat tidak dapat diterima atau xxx ; Dalam Rekonvensi Menyatakan gugatan Penggugat Rekonvensi tidak dapat diterima atau xxx ; Dalam Konvensi dan Rekonvensi Membebankan kepada Penggugat Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara sebesar Rp169.000,- (seratus enam puluh sembilan rupiah)." },
  { status: "Dikabulkan", lama: "(kosong)", amar: "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)." },
  { status: "Gugur", lama: "Digugurkan", amar: "xxx: Menyatakan permohonan Pemohon tersebut gugur; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah);" },
  { status: "Digugurkan", lama: "Digugurkan", amar: "Menyatakan permohonan Pemohon I dan Pemohon II gugur; 2. Membebankan Para Pemohon membayar biaya perkara sejumlah Rp 145.000,- (seratus empat puluh lima ribu rupiah)." },
  { status: "Dikabulkan", lama: "(kosong)", amar: "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) kepada Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp 204.000,00 ( dua ratus empat ribu rupiah );" },
  { status: "Gugur", lama: "Digugurkan", amar: "xxx: Menyatakan permohonan para Pemohon tersebut gugur; Membebankan kepada para Pemohon untuk membayar biaya perkara ini sejumlah Rp145.000,00 (seratus empat puluh lima ribu rupiah);" },
  { status: "Tidak Dapat Diterima", lama: "Tidak Dapat Diterima", amar: "xxx: Menyatakan permohonan pemohon tidak dapat diterima ( niet ontvankelijke verklaard ). Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp189.000,00 (seratus delapan puluh sembilan ribu rupiah)." },
  { status: "Dicabut", lama: "Dikabulkan", amar: "xxx: Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Penggugat; Memerintahkan Panitera Pengadilan Agama Donggala untuk mencatat pencabutan perkara tersebut dalam register perkara; Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp159.500,00 (seratus lima puluh sembilan ribu lima ratus rupiah);" },
  { status: "Ditolak", lama: "Tidak Dapat Diterima", amar: "1. Menolak permohonan Pemohon; 2. Membebankan kepada Pemohon untuk membayar biaya perkara sejumlah sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)." },
  { status: "Dicabut", lama: "Dikabulkan", amar: "Mengabulkan permohonan pencabutan perkara Nomor: xxx/Pdt.G/2025/PA.Dgl dari Pemohon; Memerintahkan Panitera untuk mencatat pencabutan perkara tersebut dalam register perkara ; Membebankan kepada Penggugat untuk membayar biaya perkara sejumlah Rp 204.000,00 (dua ratus empat ribu rupiah)" },
  { status: "Tidak Dapat Diterima", lama: "Tidak Dapat Diterima", amar: "xxx: Dalam Konvensi Menolak Permohonan xxx nikah Penggugat dengan Tergugat; Menyatakan gugatan Penggugat tidak dapat diterima; Dalam Rekonvensi Menyatakan Gugatan Penggugat Rekonvensi tidak dapat diterima Dalam Konvensi dan Rekonvensi Membebankan kepada Penggugat Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara ini sejumlah Rp174.500,00 (seratus tujuh puluh empat ribu lima ratus rupiah)." },
  { status: "Dikabulkan", lama: "Tidak Dapat Diterima", amar: "xxx: Mengabulkan gugatan Penggugat sebagian; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Menetapkan Penggugat sebagai pemegang hak asuh atas anak Penggugat dan Tergugat yang bernama xxx, usia 6 tahun dengan tetap memberikan hak akses kepada Tergugat untuk mengunjungi anak tersebut; Menghukum Tergugat untuk memberikan nafkah anak bernama xxx, usia 6 tahun kepada Penggugat sebesar Rp500.000,00 (lima ratus ribu rupiah) perbulan, hingga anak tersebut mandiri atau 21 tahun di luar biaya kesehatan dan pendidikan dengan kenaikan 10% pertahun;" },
  { status: "Ditolak", lama: "Tidak Dapat Diterima", amar: "xxx: Menolak Permohonan Pemohon; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah);" },
  { status: "Dikabulkan", lama: "Tidak Dapat Diterima", amar: "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat untuk sebagian secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Menghukum Tergugat memberikan nafkah kepada anak Penggugat dan Tergugat bernama xxx , sejumlah Rp500.000,- (lima ratus ribu rupiah) setiap bulannya, di luar biaya pendidikan dan kesehatan dengan kenaikan 10% per tahun hingga anak tersebut dewasa (umur 21 tahun) atau mandiri. Menolak gugatan Penggugat untuk selain dan selebihnya;" },
  { status: "Dikabulkan", lama: "(kosong)", amar: "1. Mengabulkan permohonan Para Pemohon; 2. Menyatakan sah perkawinan antara Pemohon I, xxx, dengan Pemohon II, xxx, yang dilaksanakan pada tanggal xx xxxx di xxx, Kabupaten Donggala, Sulawesi Tengah; 3. Memerintahkan kepada para Pemohon untuk mendaftarkan perkawinannya pada Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Sulawesi Tengah; 4. Membebankan Pemohon I dan Pemohon II membayar biaya perkara sejumlah Rp 145.000,- (seratus empat puluh lima ribu rupiah)." },
  { status: "Perdamaian", lama: "Perdamaian", amar: "xxx: Menghukum kedua belah pihak Penggugat dan Tergugat untuk mentaati xxx Perdamaian yang telah disetujui tersebut; Menghukum Penggugat untuk membayar biaya perkara sebesar Rp. 174.000,00 (seratus tujuh puluh empat ribu rupiah);" },
  { status: "Perdamaian", lama: "Perdamaian", amar: "xxx: Menghukum kedua belah pihak baik Penggugat dan Para Tergugat untuk mentaati xxx Perdamaian yang telah disetujui tersebut; Membebankan kepada Tergugat untuk membayar biaya perkara ini sejumlah Rp332.000,00 (tiga ratus tiga puluh dua ribu rupiah);" },
  { status: "Ditolak", lama: "Dikabulkan", amar: "xxx Dalam Konvensi Menolak permohonan Pemohon; Dalam Rekonvensi Menolak gugatan Penggugat Rekonvensi; Dalam Konvensi dan Rekonvensi Membebankan kepada Pemohon Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara ini sejumlah Rp174.500,00 (seratus tujuh puluh empat ribu lima ratus rupiah)." },
  { status: "Ditolak", lama: "Dikabulkan", amar: "xxx: Menolak gugatan Penggugat secara verstek; Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp288.000,00 (dua ratus delapan puluh delapan ribu rupiah)." },
  { status: "Ditolak", lama: "Dikabulkan", amar: "Menolak permohonan Pemohon; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp199.500,00 (seratus sembilan puluh sembilan ribu lima ratus rupiah)." },
  { status: "Perdamaian", lama: "Perdamaian", amar: "Menyatakan antara Penggugat ( xxx ) dan Tergugat ( xxx ) telah terjadi perdamaian dengan akta perdamaian tanggal xx xxxx; Menghukum Penggugat ( xxx ) dan Tergugat ( xxx ) untuk mentaati dan melaksanakan isi kesepakatan perdamaian yang tertuang dalam akta perdamaian sebagaimana tersebut diatas. Membebankan kepada Penggugat untuk membayar biaya perkara sejumlah Rp613.500,00 (enam ratus tiga belas ribu lima ratus rupiah)." },
];

/** Pertimbangan perkara dicabut, tanpa amar yang terbaca. */
const CADANGAN_PENCABUTAN: string[] = [
  "Menimbang, bahwa dalam proses perdamaian dengan jalan penasehatan, Majelis Hakim berhasil mendamaikan kedua belah pihak berperkara lewat jalan penasehatan, Pemohon menyatakan mencabut permohonannya;",
  "Menimbang, bahwa pencabutan perkara merupakan hak dari Penggugat apalagi Tergugat belum memberikan jawaban, sehingga berdasarkan Pasal 271 dan Pasal 272 xxx pencabutan tersebut tidak diperlukan adanya persetujuan dari Tergugat;",
  "Menimbang, berdasarkan hal tersebut Penggugat menyatakan akan mencari alamat Tergugat dan memperbaiki gugatannya, kemudian Penggugat menyatakan secara lisan mencabut gugatannya dan mohon penetapan;",
  "Menimbang, berdasarkan hal tersebut Pemohon menyatakan akan mencari alamat Termohon dan memperbaiki permohonannya, kemudian Pemohon menyatakan secara lisan mencabut permohonannya dan mohon penetapan;",
];

/** Amar tersimpan beserta isian verstek petugas; kode lama salah pada semuanya. */
const VERSTEK_DARI_AMAR: Array<{ verstek: "Ya" | "Tidak"; amar: string }> = [
  { verstek: "Tidak", amar: "xxx: Menyatakan Permohonan Pemohon tidak dapat diterima ( niet ontvankelijke verklaard /xxx); Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah);" },
  { verstek: "Tidak", amar: "xxx: Mengabulkan gugatan Penggugat; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp203.000,00 (dua ratus tiga ribu rupiah)." },
  { verstek: "Ya", amar: "Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Menghukum Pemohon untuk membayar hak-hak Termohon sebagai akibat talak sebagai berikut: 4.1. xxx berupa uang tunai sebesar Rp1.000.000,00 (satu juta rupiah); 4.2. Nafkah Iddah selama 3 (tiga) bulan sejumlah Rp1.500.000,00 (satu juta lima ratus ribu rupiah);" },
  { verstek: "Ya", amar: "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp599.000,00 (lima ratus sembilan puluh sembilan ribu rupiah);" },
  { verstek: "Tidak", amar: "xxx Mengabulkan gugatan Penggugat; Menjatuhkan talak satu ba'in shughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp288.000,00 (dua ratus delapan puluh delapan ribu rupiah)." },
  { verstek: "Tidak", amar: "xxx Mengabulkan gugatan Penggugat; Menjatuhkan talak satu ba'in shughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Menetapkan Penggugat sebagai pemegang hak asuh atas anak Penggugat dan Tergugat yang bernama xxx, usia 18 tahun dengan tetap memberikan hak akses kepada Tergugat untuk mengunjungi anak tersebut; Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp229.000,00 (dua ratus dua puluh sembilan ribu rupiah)." },
  { verstek: "Tidak", amar: "xxx: Menyatakan permohonan Pemohon Tidak xxx ( xxx ); Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp229.000,00 (dua ratus dua puluh sembilan ribu rupiah);" },
  { verstek: "Ya", amar: "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp199.000,00 (seratus sembilan puluh sembilan ribu rupiah);" },
  { verstek: "Tidak", amar: "1. Menolak gugatan Penggugat seluruhnya; 2. Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp199.500,00. (seratus sembilan puluh sembilan ribu lima ratus rupiah);" },
  { verstek: "Ya", amar: "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) kepada Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp 229.000,00 (dua ratus dua puluh sembilan ribu rupiah)." },
];

/** Kalimat yang dulu diusulkan "pasti Qobla Dukhul" - keempatnya salah (petugas: Ba'da). */
const QOBLA_KUTIPAN: string[] = [
  "Menimbang, bahwa memberikan mut’ah merupakan kewajiban seorang suami yang akan menceraikan istrinya dengan talak raj’i maka sudah sepatutnya apabila Tergugat Rekonvensi dihukum untuk memberikan mut’ah kepada Penggugat Rekonvensi kecuali apabila bekas istri qabla dukhul , hal ini sesuai dengan pasal 149 hurup (a) Kompilasi Hukum Islam yang menyatakan bahwa bilamana perkawinan putus karena talak, maka bekas suami wajib memberikan nafkah mut’ah yang layak kepada bekas istrinya tersebut baik berupa uang atau benda, kecuali bekas istri tersebut qobla dhukhul;",
  "Menyatakan bahwa mantan suami wajib memberikan mut'ah kepada mantan istrinya, kecuali jika pernikahan belum pernah digauli (qabla al-dukhul).",
  "Selanjutnya diatur dalam Pasal 149 huruf a Kompilasi Hukum Islam bahwa “xxx perkawinan putus karena talak, maka bekas suami wajib memberikan mut’ah yang layak kepada bekas isterinya, baik berupa uang atau benda, kecuali bekas isteri tersebut qobla al-dukhul ;",
  "Menimbang, bahwa Pasal 149 huruf a KHI mengatur pemberian mut'ah yang layak kepada bekas istri ketika perkawinan putus karena talak, dengan pengecualian apabila perceraian terjadi dalam keadaan qabla al-dukhul .",
];

/**
 * Kalimat pertama QOBLA_KUTIPAN yang dipangkas SEBELUM klausa "sesuai dengan
 * pasal 149": tanpa kata "pasal", ia lolos saringan kalimat rujukan, sehingga
 * yang harus menahannya lapis kedua - kata kecuali/apabila/mut'ah.
 */
const QOBLA_TANPA_PASAL =
  "Menimbang, bahwa memberikan mut’ah merupakan kewajiban seorang suami yang akan menceraikan istrinya dengan talak raj’i maka sudah sepatutnya apabila Tergugat Rekonvensi dihukum untuk memberikan mut’ah kepada Penggugat Rekonvensi kecuali apabila bekas istri qabla dukhul;";

/** Kalimat yang dulu diusulkan "pasti Nusyuz" - kelimanya salah (petugas: Tidak Nusyuz). */
const NUSYUZ_BUKAN_TEMUAN: string[] = [
  "Menimbang, bahwa terhadap dalil-dalil Pemohon dalam surat permohonannya tidak satupun terbukti Termohon melakukan nusyuz, sedangkan Pemohon telah mencukupkan aat bukti yang ada, maka berdasarkan Pasal 84 dan pasal 80 ayat (4) Kompilasi Hukum Islam (KHI) serta memperhatikan xxx yang diriwatkan imam muslim.",
  "- Bahwa untuk menentukan apakah Termohon sebagai istri yang nusyuz atau tidak, Majelis Hakim mengetengahkan pendapat xxx dalam kitabnya yang berjudul xxx 8, xxx 236, yang selanjutnya Majelis Hakim sependapat dan diambil alih sebagai pendapat Majelis Hakim, memberikan definisi nusyuz sebagai berikut:",
  "Oleh karena itu, fakta penjualan barang hanya dapat dipertimbangkan sebagai salah satu pemicu perselisihan mengenai keuangan rumah tangga, tetapi tidak cukup untuk menyatakan Termohon telah melakukan perbuatan melawan hukum atau nusyuz;",
  "Menimbang, bahwa Tergugat Rekonvensi mendalilkan Termohon/Penggugat Rekonvensi telah nusyuz sehingga menurutnya tidak berhak memperoleh nafkah iddah dan mut'ah;",
  "Menimbang, bahwa oleh karena perkara ini adalah Cerai xxx dan perceraian terjadi bukan karena nusyuz dari pihak istri melainkan akibat kelalaian dan kesalahan Tergugat sendiri, maka sesuai dengan ketentuan Pasal 119 ayat (2) huruf c Kompilasi Hukum Islam, Majelis Hakim menjatuhkan talak satu ba'in sughra dari Tergugat terhadap Penggugat;",
];

/**
 * Kalimat yang dulu diusulkan "pasti Hamil" - salah seluruhnya. Petikan
 * dipangkas pada klausa yang memuat "hamil"; kata penentu aturannya tetap utuh.
 */
const HAMIL_BUKAN_SEKARANG: Array<{ jenis: string; kalimat: string }> = [
  { jenis: "Cerai Gugat", kalimat: "Menimbang, bahwa perselisihan dan cekcok mulai terjadi pada saat Penggugat melahirkan anak perempuan yang mana saat Penggugat hamil Tergugat berujar jika anaknya laki-laki berjanji berhenti mabuk;" },
  { jenis: "Cerai Gugat", kalimat: "Menimbang, bahwa Tergugat sering pergi meninggalkan rumah sampai berhari-hari tanpa alasan yang jelas, penggugat tidak pernah mendapatkan Nafkah dari Tergugat semenjak Penggugat hamil sampai dengan saat ini;" },
  { jenis: "Cerai Talak", kalimat: "Menimbang, bahwa berdasarkan Pasal 149 huruf (b) Kompilasi Hukum Islam menyatakan bahwa “ bila mana perkawinan putus karena talak, maka bekas suami wajib memberi nafkah, maskan, kiswah kepada bekas istri selama dalam masa iddah, kecuali bekas istri telah dijatuhi talak ba’in atau nusyuz dan dalam keadaan tidak hamil” dan Pasal 152 menyatakan “bekas istri berhak mendapat nafkah iddah dari bekas suaminya kecuali bila ia nusyuz”;" },
  { jenis: "Cerai Talak", kalimat: "Bahwa penyebab kemelut rumah tangga tersebut adalah karena saat menikah hanya sekedar untuk memenuhi keinginan Termohon menutupi aib karena telah hamil diluar nikah;" },
  { jenis: "Cerai Gugat", kalimat: "Menimbang, bahwa pada saat hamil anak ke 4 Penggugat dan Tergugat telah pisah selama 8 (delapan) bulan sampai sekarang;" },
  { jenis: "Cerai Gugat", kalimat: "Menimbang, bahwa alasan pokok Penggugat mengajukan gugatan cerai adalah antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak Penggugat sedang hamil anak pertama;" },
  { jenis: "Cerai Talak", kalimat: "Demikian pula menurut Pasal 149 huruf b Kompilasi Hukum Islam disebutkan bahwa “xxx perkawinan putus karena talak, maka bekas suami wajib memberi nafkah, maskan dan kiswah kepada bekas istri selama dalam iddah , kecuali bekas isteri telah dijatuhi talak bain atau nusyuz dan dalam keadaan tidak hamil”;" },
  { jenis: "Cerai Gugat", kalimat: "Menimbang, bahwa Tergugat sering meninggalkan kediaman bersama dan pulang hingga larut malam, bahkan saat Penggugat dan keadaan hamil." },
];

/** Pertimbangan berhuruf (f) saja; petugas memilih Perselisihan, kode lama memilih yang lain. */
const FAKTOR_BAWAAN: Array<{ lama: string; dasar: string[] }> = [
  { lama: "Kekerasan Dalam Rumah Tangga", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (f) Kompilasi Hukum Islam;", "Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal yang sudah berlangsung selama 5 (lima) tahun sampai sekarang;", "Bahwa Penggugat dengan Tergugat pernah hidup rukun, namun sejak tahun 2018 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran yang berulang-ulang, hingga terjadi pisah tempat tinggal;"] },
  { lama: "Meninggalkan Salah Satu Pihak", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.", "Pasal 116 huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena, terhitung sejak tahun 2020 Tergugat tidak lagi dan tidak memiliki kemauan untuk bekerja, puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada bulan Februari 2024, Penggugat meninggalkan rumah kediaman bersama dikarenakan antara Penggugat dan Tergugat terjadi peselishan, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 10 bulan."] },
  { lama: "Meninggalkan Salah Satu Pihak", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.", "Pasal 116 huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2014 Penggugat dan Tergugat sering cekcok/bertengkar terus menerus yang penyebabnya antara lain, Tergugat memiliki sifat tempramen/emosional, Tergugat sering berkata kasar, Tergugat tidak mau jika Penggugat memintanya untuk mencari pekerjaan, perselisihan dan pertengkaran itu berkelanjutan terus-menerus yang mengakibatkan pada bulan Juni 2024, Tergugat pergi meninggalkan rumah bersama."] },
  { lama: "Meninggalkan Salah Satu Pihak", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.", "Pasal 116 huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat memiliki kecemburuan berlebih kepada Penggugat, Tergugat memiliki sifat tempramen dan sering berkata kasar kepada Penggugat dan ketika marah Tergugat sering meninggalkan rumah kediaman bersama, puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada bulan Juli 2023, Tergugat pergi meninggalkan rumah kediaman bersama dikarenakan terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 5 bulan."] },
  { lama: "Meninggalkan Salah Satu Pihak", dasar: ["Selanjutnya diatur dalam Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan juncto Pasal 116 huruf f Kompilasi Hukum Islam bahwa di antara alasan perceraian adalah adanya perselisihan dan pertengkaran terus-menerus antara suami isteri dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga;", "Bahwa kemudian kehidupan rumah tangga Penggugat dengan Tergugat sering terjadi perselisihan dan pertengkaran;"] },
  { lama: "Kekerasan Dalam Rumah Tangga", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (f) Kompilasi Hukum Islam;", "Menimbang, bahwa yang menjadi alasan perceraian dalam permohonan Pemohon pada pokoknya bahwa keadaan rumah tangga Pemohon dan Termohon tidak harmonis dan terjadi perselisihan dan pertengkaran yang disebabkan karena Termohon memiliki hubungan khusus dengan laki-laki lain hingga saat ini Termohon telah menikah lagi dengan laki-laki tersebut;"] },
  { lama: "Kekerasan Dalam Rumah Tangga", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (f) Kompilasi Hukum Islam;", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena:"] },
  { lama: "Kekerasan Dalam Rumah Tangga", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (f) Kompilasi Hukum Islam;", "Bahwa dengan memperhatikan fakta hukum tersebut, Majelis Hakim berpendapat, antara Penggugat dan Tergugat telah terjadi keretakan ikatan batin sebagai suami istri, akibat perselisihan yang berulang kali atau ketidakharmonisan yang berkelanjutan hingga terjadi pisah tempat tinggal, dan sulit diharapkan untuk kembali rukun karena keduanya sudah tidak saling mempedulikan, bahkan Penggugat sudah berketetapan hati untuk bercerai dengan Tergugat;"] },
];

/** Pertimbangan yang MENYEBUT huruf lain; jawaban petugas = `benar`. */
const FAKTOR_HURUF: Array<{ benar: string; keyakinan: "pasti" | "cukup"; dasar: string[]; buatan?: true }> = [
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "pasti", dasar: ["Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (b) Kompilasi Hukum Islam;", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak bulan Juni 2019, Tergugat meninggalkan rumah kediaman bersama dan membawa keseluruhan barang pribadi milik Tergugat tanpa sepengetahuan Penggugat, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 5 tahun 6 bulan, sejak saat itu hak dan kewajiban suami isteri tidak terlaksana sebagaimansa mestinya;"] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "cukup", dasar: ["Menimbang, bahwa salah satu alasan terjadinya perceraian adalah antara suami istri terus menerus terjadi perselisihan dan pertengkaran yang sudah tidak dapat didamaikan lagi sehingga berujung dengan pisah tempat tinggal antara keduanya (vide Pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan jo.", "Pasal 116 huruf (b) dan huruf (f) Kompilasi Hukum Islam).", "Menimbang, bahwa yang menjadi alasan perceraian dalam permohonan Pemohon pada pokoknya bahwa sejak akhir tahun 2018 keadaan rumah tangga Pemohon dan Termohon mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran, puncak keretakan hubungan rumah tangga Pemohon dengan Termohon tersebut terjadi pada tahun 2019, Pemohon meninggalkan rumah kediaman bersama dikarenakan terjadi perselisihan dan pertengkaran antara pemohon dan Termohon, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 5 tahun."] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "pasti", dasar: ["Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (b) Kompilasi Hukum Islam;", "Menimbang, bahwa yang menjadi alasan perceraian dalam permohonan Pemohon pada pokoknya bahwa pada tahun 2021, Termohon izin kepada Pemohon untuk kembali ke rumah orang tua Termohon di Desa xxx untuk mengambil pakaian Termohon, namun hingga saat itu Termohon tidak lagi kembali ke kediaman bersama, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 3 tahun."] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "pasti", dasar: ["Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (b) Kompilasi Hukum Islam;", "Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal yang hingga kini telah berlangsung selama kurang lebih 5 (lima) tahun lamanya;"] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "cukup", dasar: ["Pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.", "Pasal 116 huruf (b) dan huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2017 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran, puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada bulan Mei 2018, Penggugat pergi meninggalkan rumah kediaman bersama dikarenakan terjadi perselisihan antara Penggugat dan Tergugat, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 6 tahun 7 bulan."] },
  { benar: "Murtad", keyakinan: "pasti", dasar: ["Pasal 116 huruf (h) Kompilasi Hukum Islam;"] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "pasti", dasar: ["Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (b) Kompilasi Hukum Islam;"] },
  { benar: "Meninggalkan Salah Satu Pihak", keyakinan: "cukup", dasar: ["Pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (b) dan huruf (f) Kompilasi Hukum Islam;", "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak awal pernikahan hubungan rumah tangga Penggugat dan Tergugat rukun dan harmonis, pada bulan Juli 2021, Tergugat pergi meninggalkan rumah kediaman bersama tanpa sepengetahuan Penggugat dan orang tua Penggugat, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 3 tahun 6 bulan."] },
  { buatan: true, benar: "Dihukum Penjara", keyakinan: "pasti", dasar: ["Pasal 19 huruf (c) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.", "Pasal 116 huruf (c) Kompilasi Hukum Islam;", "Bahwa Tergugat sedang menjalani pidana penjara selama 7 (tujuh) tahun di Lembaga Pemasyarakatan xxx;"] },
];

/**
 * Dasar LEBIH DARI SATU: nilai usulan tetap (keputusan 7), tetapi TIDAK
 * dicentang sendiri - petugas yang memilih. `benar` = pilihan petugas,
 * `lama` = jawaban kode lama. Dipetik 26 Sep 2026 dari putusan yang
 * dulu tercentang sendiri dengan nilai yang berbeda dari pilihan petugas
 * (petik-fixture-pembetul.ts).
 */
/** Huruf (b)+(f) dengan kepergian dua tahun, dan kalimat fakta berulang kali menyebut perbuatan lain. */
const FAKTOR_B_F_PERBUATAN_LAIN: Array<{ benar: string; lama: string; pokok: string; sekunder: string; dasar: string[] }> = [
  { benar: "Kekerasan Dalam Rumah Tangga", lama: "Kekerasan Dalam Rumah Tangga", pokok: "Meninggalkan Salah Satu Pihak", sekunder: "Peselisihan dan Pertengkaran Terus Menerus", dasar: ["Pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.","Pasal 116 huruf (b) dan huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2014 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat melakukan tindak xxx kepada Penggugat dan berperilaku kasar kepada Penggugat, Pada tahun 2022 Tergugat telah menikah lagi dengan wanita lain, puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada tahun 2016, Tergugat pergi meninggalkan rumah kediaman bersama dikarenakan terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat hingga Tergugat melakukan tindak xxx kepada xxx, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 8 tahun.","Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat telah menikah dengan wanita lain, Tergugat sering memukul Penggugat;","Menimbang, bahwa berdasarkan fakta-fakta yang telah terbukti di atas harus dimaknai bahwa dalam rumah tangga penggugat dan tergugat telah dilanda masalah, sehingga terjadi ketidakharmonisan dalam rumah tangga penggugat dan tergugat, ketidakharmonisan tersebut berimplikasi terhadap hubungan kedua belah pihak, tindakan Tergugat yang telah memukul Penggugat serta Tergugat telah menikah lagi dengan wanita lain merupakan rangkaian puncak pertengkaran dalam rumah tangganya karena jika pasangan suami isteri masih saling mencintai dan menyayangi maka tentu tindakan berupa kekerasan dalam rumah tangga tidak akan terjadi."] },
  { benar: "Kekerasan Dalam Rumah Tangga", lama: "Kekerasan Dalam Rumah Tangga", pokok: "Meninggalkan Salah Satu Pihak", sekunder: "Peselisihan dan Pertengkaran Terus Menerus", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Pasal 116 huruf (f) Kompilasi Hukum Islam;","Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2021 rumah tangga Penggugat dengan Tergugat sudah diwarnai perselisihan dan pertengkaran atau sudah mengalami ketidakharmonisan yang disebabkan karena Tergugat temperamental, melakukan xxx kepada Penggugat dan berselingkuh dengan wanita lain, dan sudah terjadi pisah tempat tinggal antara Penggugat dan Tergugat yang sampai sekarang sudah berlangsung sekitar 3 tahun 2 bulan;","Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat temperamental, melakukan Kekerasan Dalam Rumah Tangga kepada Penggugat dan berselingkuh dengan wanita lain;"] },
  { benar: "Mabuk", lama: "Meninggalkan Salah Satu Pihak", pokok: "Meninggalkan Salah Satu Pihak", sekunder: "Peselisihan dan Pertengkaran Terus Menerus", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Pasal 116 huruf (f) Kompilasi Hukum Islam;","Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak 2022 rumah tangga Penggugat dengan Tergugat sudah diwarnai perselisihan dan pertengkaran atau sudah mengalami ketidakharmonisan yang disebabkan karena Tergugat suka minum minuman keras dan memukul Penggugat, dan sudah terjadi pisah tempat tinggal antara Penggugat dan Tergugat yang sampai sekarang sudah berlangsung sekitar 2 tahun;","Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat suka minum minuman keras dan memukul Penggugat;"] },
  { benar: "Madat", lama: "Meninggalkan Salah Satu Pihak", pokok: "Meninggalkan Salah Satu Pihak", sekunder: "Peselisihan dan Pertengkaran Terus Menerus", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Pasal 116 huruf (f) Kompilasi Hukum Islam;","Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak 2015 rumah tangga Penggugat dengan Tergugat sudah diwarnai perselisihan dan pertengkaran atau sudah mengalami ketidakharmonisan yang disebabkan karena Tergugat suka minuman keras, mengkonsumsi narkoba dan suka bermain judi, dan sudah terjadi pisah tempat tinggal antara Penggugat dan Tergugat yang sampai sekarang sudah berlangsung sekitar 7 tahun 9 bulan;","Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat suka minum minuman keras, suka bermain judi dan mengkonsumsi narkoba;"] },
];

/** Huruf lain disebut bersama (f) tetapi tidak menentukan: (a) tanpa pilihan dari ciri, (b) tanpa kepergian dua tahun. */
const FAKTOR_HURUF_LAIN_TAK_MENENTUKAN: Array<{ benar: string; lama: string; pokok: string; sekunder: string; dasar: string[] }> = [
  { benar: "Judi", lama: "Judi", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Judi", dasar: ["Dengan demikian, Majelis Hakim menilai bahwa syarat-syarat perceraian telah terpenuhi sekaligus sebagaimana dimaksud dalam Pasal 19 huruf (a) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 jo.","Pasal 116 huruf (a) dan huruf (f) Kompilasi Hukum Islam, sehingga gugatan Penggugat beralasan hukum dan patut untuk dikabulkan;","xxx Tergugat sebagai seorang penjudi yang sukar disembuhkan telah secara nyata menjadi penyebab utama terjadinya perselisihan dan pertengkaran yang terus-menerus antara Penggugat dan Tergugat."] },
  { benar: "Kekerasan Dalam Rumah Tangga", lama: "Mabuk", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Madat", dasar: ["Dengan demikian, Majelis Hakim menilai bahwa syarat-syarat perceraian telah terpenuhi sekaligus sebagaimana dimaksud dalam Pasal 19 huruf (a) dan (f) Peraturan Pemerintah Nomor 9 Tahun 1975 jo.","Pasal 116 huruf (a) dan (f) Kompilasi Hukum Islam, sehingga gugatan Penggugat beralasan hukum dan patut untuk dikabulkan;","xxx Tergugat sebagai seorang pemabuk, pemadat, yang melakukan xxx yang sukar disembuhkan telah secara nyata menjadi penyebab utama terjadinya perselisihan dan pertengkaran yang terus-menerus antara Penggugat dan Tergugat."] },
  { benar: "Meninggalkan Salah Satu Pihak", lama: "Meninggalkan Salah Satu Pihak", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Zina", dasar: ["pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan jo.","pasal 116 huruf (b) dan huruf (f) xxx Republik Indonesia Nomor 1 Tahun 1991 tentang Kompilasi Hukum Islam.","Menimbang, bahwa yang menjadi alasan perceraian dalam permohonan Pemohon pada pokoknya bahwa sejak tahun 2011 keadaan rumah tangga Pemohon dan Termohon mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena xxx tua Termohon selalu ikut campur dalam permasalahan rumah tangga Pemohon dan Termohon, sehingga Termohon merasa tidak dihargai sebagai kepala xxx, Pada Oktober 2012 Termohon telah menikah lagi dengan laki-laki lain tanpa sepengetahuan Pemohon, puncak keretakan hubungan rumah tangga Pemohon dengan Termohon tersebut terjadi pada bulan Agustus 2012 bertepatan dengan bulan puasa pada tahun 2012, Pemohon meninggalkan rumah kediaman bersama dikarenakan Termohon dan orang tua Termohon mengusir Pemohon dan anak pertama Pemohon dan Termohon dari kediaman orang tua Termohon Kabupaten xxx, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 12 tahun 4 bulan."] },
  { benar: "Ekonomi", lama: "Ekonomi", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Ekonomi", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Pasal 116 huruf (f) Kompilasi Hukum Islam;","Pasal 19 huruf (b) Peraturan Pemerintah Nomor 9 Tahun 1975, jo.","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak 2010 rumah tangga Penggugat dengan Tergugat sudah diwarnai perselisihan dan pertengkaran atau sudah mengalami ketidakharmonisan yang disebabkan karena masalah ekonomi, Tergugat tidak memberi nafkah yang layak kepada Penggugat, dan sudah terjadi pisah tempat tinggal antara Penggugat dan Tergugat yang sampai sekarang sudah berlangsung sekitar 13 tahun;"] },
];

/** Sisi sebaliknya: huruf (f) saja, tanpa perbuatan yang disebut berulang - pokok dan sekunder tetap tercentang. */
const FAKTOR_TETAP_TERCENTANG: Array<{ benar: string; lama: string; pokok: string; sekunder: string; dasar: string[] }> = [
  { benar: "Peselisihan dan Pertengkaran Terus Menerus", lama: "Peselisihan dan Pertengkaran Terus Menerus", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Meninggalkan Salah Satu Pihak", dasar: ["Menimbang, bahwa berdasarkan Pasal 116 huruf (f) KHI jo.","Pasal 19 huruf (f) PP Nomor 9 Tahun 1975, perceraian dapat dikabulkan jika terjadi perselisihan dan pertengkaran yang terus-menerus dan tidak ada harapan akan hidup rukun kembali;","Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak bulan Maret 2022 rumah tangga Penggugat dengan Tergugat sudah diwarnai perselisihan dan pertengkaran atau sudah mengalami ketidakharmonisan yang disebabkan karena Tergugat tidak mau hidup mandiri dan keluarga Tergugat sering ikut campur urusan dan Tergugat sering mengucapkan kata pisah, dan sudah terjadi pisah tempat tinggal antara Penggugat dan Tergugat yang sampai sekarang sudah berlangsung sekitar 3 tahun 2 bulan;","Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana telah diuraikan di atas;","Menimbang, bahwa Penggugat untuk membuktikan dalil-dalilnya, telah mengajukan bukti surat P.1, dan P.2 serta saksi-saksi yaitu:"] },
  { benar: "Peselisihan dan Pertengkaran Terus Menerus", lama: "Meninggalkan Salah Satu Pihak", pokok: "Peselisihan dan Pertengkaran Terus Menerus", sekunder: "Meninggalkan Salah Satu Pihak", dasar: ["Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975 Tentang xxx Nomor 1 Tahun 1974 Tentang Perkawinan, jo.","Pasal 116 huruf (f) xxx Nomor 1 Tahun 1991 Tentang Kompilasi Hukum Islam.","xxx keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada April 2025, Tergugat pergi meninggalkan kediaman bersama ke rumah Tergugat dikarenakan antara Penggugat dan Tergugat terjadi perselisihan dan pertengkaran sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 11 bulan.","Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana telah diuraikan di atas;","Dan untuk memenuhi kebutuhan rumah tangga dibantu dari penghasilan Penggugat."] },
];

const LABEL_PERSELISIHAN = "Peselisihan dan Pertengkaran Terus Menerus";

// ─────────────────────────────────────────────────────────────────────────────

describe("Status Putusan dibaca dari kata kerja AMAR", () => {
  it.each(STATUS_DARI_AMAR.filter((x) => !/gugur/i.test(x.status)))(
    "$status dari amar (kode lama dari pertimbangan: $lama)",
    ({ status, amar }) => {
      const u = SATU("", STATUS, { amar });
      expect(u.nilaiLabel).toBe(status);
      expect(u.keyakinan).toBe("pasti");
      expect(u.sumberUsulan).toBe("amar");
      expect(u.kutipan.length).toBeGreaterThan(0);
    }
  );

  it.each(STATUS_DARI_AMAR.filter((x) => /gugur/i.test(x.status)))(
    "gugur ($status): dijawab BENTROK Gugur/Digugurkan supaya ditanyakan",
    ({ amar }) => {
      const u = SATU("", STATUS, { amar });
      expect(u.keyakinan).toBe("bentrok");
      expect(u.sumberUsulan).toBe("amar");
      const dua = [u.nilaiLabel, ...u.saingan.map((x) => x.label)].sort();
      expect(dua).toEqual(["Digugurkan", "Gugur"]);
    }
  );

  it("'pencabutan ... dapat dikabulkan' pada pertimbangan TIDAK menjadi Dikabulkan", () => {
    // Pertimbangan yang menyesatkan kode lama (bentuknya ditemui pada data), amar sungguhan.
    const pertimbangan =
      "Menimbang, bahwa Penggugat telah mengajukan permohonan pencabutan perkara secara lisan di depan sidang;\n" +
      "Menimbang, bahwa oleh karena itu permohonan pencabutan tersebut beralasan hukum dan dapat dikabulkan;";
    const amar = STATUS_DARI_AMAR[0].amar;
    expect(SATU(pertimbangan, STATUS, { amar }).nilaiLabel).toBe("Dicabut");
    // Tanpa amar pun (cadangan) tetap pencabutan, tetapi tidak "pasti".
    const cadangan = SATU(pertimbangan, STATUS, { amar: "" });
    expect(cadangan.nilaiLabel).toBe("Dicabut");
    expect(cadangan.keyakinan).toBe("cukup");
    expect(cadangan.sumberUsulan).toBe("pertimbangan");
  });

  it("'Majelis berhasil mendamaikan' pada pertimbangan kalah oleh amar yang mengabulkan", () => {
    const pertimbangan = "Menimbang, bahwa Majelis Hakim telah berusaha mendamaikan kedua belah pihak namun tidak berhasil;";
    const amar = STATUS_DARI_AMAR[3].amar;
    expect(SATU(pertimbangan, STATUS, { amar }).nilaiLabel).toBe("Dikabulkan");
  });

  it("bentuk lama (parameter ketiga berupa jenis perkara) tetap diterima dan tidak membaca amar", () => {
    const u = usulkanMedanPutusan("Menimbang, bahwa gugatan Penggugat patut dikabulkan;", [STATUS], "Cerai Gugat")[0];
    expect(u.nilaiLabel).toBe("Dikabulkan");
    expect(u.sumberUsulan).toBe("pertimbangan");
  });
});

describe("cadangan tanpa amar: pertimbangan pencabutan", () => {
  it.each(CADANGAN_PENCABUTAN)("Dicabut, keyakinan cukup - %s", (pertimbangan) => {
    const u = SATU(pertimbangan, STATUS, { amar: "" });
    expect(u.nilaiLabel).toBe("Dicabut");
    expect(u.keyakinan).toBe("cukup");
  });
});

describe("Putusan Verstek dibaca dari amar", () => {
  it.each(VERSTEK_DARI_AMAR)("$verstek", ({ verstek, amar }) => {
    const u = SATU("Menimbang, bahwa Tergugat tidak hadir di persidangan;", VERSTEK, { amar });
    expect(u.nilaiLabel).toBe(verstek);
    // Ya disebut amar - pasti. Tidak adalah kesimpulan dari yang TIDAK tertulis.
    expect(u.keyakinan).toBe(verstek === "Ya" ? "pasti" : "cukup");
    expect(u.sumberUsulan).toBe("amar");
  });
});

describe("Qobla: kutipan Pasal 149 KHI bukan fakta perkara", () => {
  it.each(QOBLA_KUTIPAN)("Ba'da Dukhul, tidak pernah pasti Qobla - %s", (kalimat) => {
    const u = SATU(kalimat, QOBLA, { jenisPerkara: "Cerai Talak" });
    expect(u.nilaiLabel).toBe("Ba'da Dukhul");
    expect(u.keyakinan).not.toBe("pasti");
  });

  it("lapis 1: kalimat yang mengutip Pasal/KHI/qabla al-dukhul dibuang sebelum medan fakta dinilai", () => {
    for (const kalimat of QOBLA_KUTIPAN) expect(saringKalimatRujukan(kalimat)).toBe("");
    expect(saringKalimatRujukan(NUSYUZ_BUKAN_TEMUAN[0])).toBe("");
    // Kalimat fakta tetap utuh.
    const fakta = "Menimbang, bahwa Penggugat dan Tergugat telah pisah rumah selama 2 tahun;";
    expect(saringKalimatRujukan(fakta)).toBe(fakta);
    expect(saringKalimatRujukan(QOBLA_TANPA_PASAL)).toBe(QOBLA_TANPA_PASAL);
  });

  it("lapis 2: kalimat tanpa pasal pun tidak dihitung bila memuat kecuali/apabila/mut'ah", () => {
    const u = SATU(QOBLA_TANPA_PASAL, QOBLA, { jenisPerkara: "Cerai Talak" });
    expect(u.nilaiLabel).toBe("Ba'da Dukhul");
    expect(u.keyakinan).not.toBe("pasti");
  });

  it("(buatan) fakta tegas belum pernah berkumpul tetap tertangkap", () => {
    const u = SATU("Menimbang, bahwa Penggugat dan Tergugat belum pernah berkumpul sebagai suami isteri;", QOBLA, {
      jenisPerkara: "Cerai Gugat",
    });
    expect(u.nilaiLabel).toBe("Qobla Dukhul");
    expect(u.keyakinan).toBe("pasti");
  });
});

describe("Nusyuz: yang dihitung hanya TEMUAN", () => {
  it.each(NUSYUZ_BUKAN_TEMUAN)("Tidak Nusyuz, tidak pasti - %s", (kalimat) => {
    const u = SATU(kalimat, NUSYUZ, { jenisPerkara: "Cerai Talak" });
    expect(u.nilaiLabel).toBe("Tidak Nusyuz");
    expect(u.keyakinan).not.toBe("pasti");
  });

  it("(buatan) temuan tegas tetap tertangkap", () => {
    const u = SATU("Menimbang, bahwa berdasarkan fakta tersebut Termohon terbukti telah nusyuz;", NUSYUZ, {
      jenisPerkara: "Cerai Talak",
    });
    expect(u.nilaiLabel).toBe("Nusyuz");
    expect(u.keyakinan).toBe("pasti");
  });
});

describe("Keadaan Istri: 'hamil' yang bukan kehamilan sekarang, dan bawaannya", () => {
  it.each(HAMIL_BUKAN_SEKARANG)("$jenis: bawaan jenis perkara, tidak pernah pasti", ({ jenis, kalimat }) => {
    const u = SATU(kalimat, KEADAAN, { jenisPerkara: jenis });
    expect(u.nilaiLabel).toBe(/gugat/i.test(jenis) ? "Suci" : "Tidak diketahui");
    expect(u.keyakinan).toBe("cukup");
    expect(u.sumberUsulan).toBe("pertimbangan");
  });

  it("(buatan) kehamilan yang sedang berlangsung tetap tertangkap", () => {
    const u = SATU("Menimbang, bahwa Penggugat saat ini sedang hamil 4 bulan;", KEADAAN, { jenisPerkara: "Cerai Gugat" });
    expect(u.nilaiLabel).toBe("Hamil");
    expect(u.keyakinan).toBe("pasti");
  });

  it("bawaanSatker (putusan.bawaan-medan) menggantikan bawaan kode, bersumber 'bawaan-satker'", () => {
    const bawaanSatker: EntriTipeMedan[] = [
      { kunci: "Keadaan Istri", nilai: "Tidak diketahui", data: { jenisPerkara: "gugat" }, asal: "tambahan" },
    ];
    const u = SATU("Menimbang, bahwa rumah tangga Penggugat dan Tergugat tidak harmonis;", KEADAAN, {
      jenisPerkara: "Cerai Gugat",
      bawaanSatker,
    });
    expect(u.nilaiLabel).toBe("Tidak diketahui");
    expect(u.sumberUsulan).toBe("bawaan-satker");
    expect(u.keyakinan).toBe("cukup");
  });

  it("entri berasal 'bawaan' atau 'cermin' BUKAN bawaan satker", () => {
    for (const asal of ["bawaan", "cermin"]) {
      const u = SATU("Menimbang, bahwa rumah tangga Penggugat dan Tergugat tidak harmonis;", KEADAAN, {
        jenisPerkara: "Cerai Gugat",
        bawaanSatker: [{ kunci: "Keadaan Istri", nilai: "Suci", data: { jenisPerkara: "gugat" }, asal }],
      });
      expect(u.nilaiLabel).toBe("Suci");
      expect(u.sumberUsulan).toBe("pertimbangan");
    }
  });
});

describe("Faktor pokok: bawaan Perselisihan, kecuali huruf pasal lain disebut tegas", () => {
  it.each(FAKTOR_BAWAAN)("huruf (f) saja -> Perselisihan (kode lama: $lama)", ({ dasar }) => {
    const [pokok, sekunder] = usulkanMedanPutusan(dasar.join("\n"), [FAKTOR, FAKTOR2], { jenisPerkara: "Cerai Gugat" });
    expect(pokok.nilaiLabel).toBe(LABEL_PERSELISIHAN);
    expect(pokok.keyakinan).not.toBe("pasti");
    // Sekunder tidak pernah mengulang pokoknya.
    expect(sekunder.nilai === "" || sekunder.nilai !== pokok.nilai).toBe(true);
  });

  it.each(FAKTOR_HURUF)("huruf lain -> $benar ($keyakinan)", ({ benar, keyakinan, dasar }) => {
    const [pokok, sekunder] = usulkanMedanPutusan(dasar.join("\n"), [FAKTOR, FAKTOR2], { jenisPerkara: "Cerai Talak" });
    expect(pokok.nilaiLabel).toBe(benar);
    expect(pokok.keyakinan).toBe(keyakinan);
    expect(sekunder.nilai === "" || sekunder.nilai !== pokok.nilai).toBe(true);
  });

  it("pokok bukan perselisihan: perselisihan yang disebut naskah menjadi sekunder", () => {
    const dasar = FAKTOR_HURUF[4].dasar.join("\n");
    const [pokok, sekunder] = usulkanMedanPutusan(dasar, [FAKTOR, FAKTOR2], { jenisPerkara: "Cerai Gugat" });
    expect(pokok.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
    expect(sekunder.nilaiLabel).toBe(LABEL_PERSELISIHAN);
  });
});

/**
 * Nilai faktor pokok tetap mengikuti keputusan 7 - bawaan perselisihan,
 * kecuali huruf pasal lain menentukan. Yang dijaga di sini KEYAKINANNYA:
 * atas 960 putusan cerai, usulan pokok yang tercentang sendiri dengan nilai
 * salah turun dari 174 menjadi 140 (kode lama 160) dan sekunder dari 123
 * menjadi 59 (kode lama 182). Yang benar dan tercentang sendiri 391 dan 69
 * (kode lama 149 dan 47). Pengukurnya pembetul-banding.js.
 */
describe("Faktor: dasar lebih dari satu TIDAK dicentang sendiri", () => {
  const USUL = (dasar: string[], pokok: MedanPilihan = FAKTOR) =>
    usulkanMedanPutusan(dasar.join("\n"), [pokok, FAKTOR2], { jenisPerkara: "Cerai Gugat" });

  it.each(FAKTOR_B_F_PERBUATAN_LAIN)(
    "huruf (b)+(f) dan perbuatan lain berulang -> $pokok, bentrok (petugas: $benar)",
    ({ pokok, sekunder, dasar }) => {
      const [p, s] = USUL(dasar);
      expect(p.nilaiLabel).toBe(pokok);
      expect(p.keyakinan).toBe("bentrok");
      expect(p.alasan).toMatch(/berulang kali menyebut .+ - pilih sendiri mana yang pokok/);
      // Sekunder disusun dari pokok yang belum tentu, jadi ikut tidak dicentang.
      expect(s.nilaiLabel).toBe(sekunder);
      expect(s.keyakinan).toBe("bentrok");
      expect(s.alasan).toMatch(/Pokoknya sendiri belum tentu/);
    }
  );

  it.each(FAKTOR_HURUF_LAIN_TAK_MENENTUKAN)(
    "huruf lain tidak menentukan -> bawaan perselisihan, bentrok (petugas: $benar)",
    ({ pokok, sekunder, dasar }) => {
      const [p, s] = USUL(dasar);
      expect(p.nilaiLabel).toBe(pokok);
      expect(p.nilaiLabel).toBe(LABEL_PERSELISIHAN);
      expect(p.keyakinan).toBe("bentrok");
      expect(p.alasan).toMatch(/Dasarnya lebih dari satu huruf - pilih sendiri/);
      expect(s.nilaiLabel).toBe(sekunder);
      expect(s.keyakinan).toBe("bentrok");
    }
  );

  it.each(FAKTOR_TETAP_TERCENTANG)("huruf (f) saja tanpa perbuatan berulang -> pokok $pokok dan sekunder tetap tercentang", ({ pokok, sekunder, dasar }) => {
    const [p, s] = USUL(dasar);
    expect(p.nilaiLabel).toBe(pokok);
    expect(p.keyakinan).toBe("cukup");
    expect(s.nilaiLabel).toBe(sekunder);
    expect(s.keyakinan).toBe("cukup");
  });

  it("pokok yang sudah dipilih petugas di halaman: sekunder dihitung dari pokok itu dan tercentang", () => {
    const { dasar } = FAKTOR_B_F_PERBUATAN_LAIN[0];
    const [p, s] = USUL(dasar, { ...FAKTOR, terpilih: "7" });
    expect(p.nilaiLabel).toBe("Kekerasan Dalam Rumah Tangga");
    expect(p.sumberUsulan).toBe("halaman");
    expect(s.nilai).not.toBe("7");
    expect(s.nilai).not.toBe("");
    expect(s.keyakinan).toBe("cukup");
  });
});

describe("nilai yang SUDAH terpilih di halaman (kontrak K9)", () => {
  const DASAR_DISPEN =
    "Menimbang, bahwa Majelis telah memberi nasihat tentang kemungkinan adanya dampak ekonomi, sosial, dan kesehatan dari perkawinan anak;";

  it("alasan dispensasi: yang terpilih menjadi usulan, bersumber 'halaman'", () => {
    const u = SATU(DASAR_DISPEN, { ...DISPEN, terpilih: "1" });
    expect(u.nilai).toBe("1");
    expect(u.nilaiLabel).toBe("Hamil");
    expect(u.sumberUsulan).toBe("halaman");
    // Yang disebut naskah tetap diperlihatkan sebagai saingan.
    expect(u.saingan.map((x) => x.label)).toContain("Ekonomi");
  });

  it("tanpa terpilih, perilaku lama tidak berubah (kalimat baku 'dampak ekonomi')", () => {
    expect(SATU(DASAR_DISPEN, DISPEN).nilaiLabel).toBe("Ekonomi");
  });

  it("'- Pilih -' dan nilai yang tidak ada di daftar bukan terpilih", () => {
    expect(SATU(DASAR_DISPEN, { ...DISPEN, terpilih: "0" }).nilaiLabel).toBe("Ekonomi");
    expect(SATU(DASAR_DISPEN, { ...DISPEN, terpilih: "99" }).nilaiLabel).toBe("Ekonomi");
  });

  it("naskah TEGAS (kata kerja amar) mengalahkan yang terpilih, dan petugas diberi tahu", () => {
    const u = SATU("", { ...STATUS, terpilih: "62" }, { amar: STATUS_DARI_AMAR[0].amar });
    expect(u.nilaiLabel).toBe("Dicabut");
    expect(u.alasan).toMatch(/Halaman sudah berisi "Dikabulkan"/);
  });
});

describe("saringMedanPilihan - bentuk medan yang diterima kedua rute", () => {
  it("meneruskan terpilih (satu nilai atau daftar), banyak, dan membuang sisanya", () => {
    const hasil = saringMedanPilihan([
      { kunci: "#a", label: "A", pilihan: [{ nilai: 1, label: "Satu" }], terpilih: 1, lain: "dibuang" },
      { kunci: "#b", label: "B", pilihan: [], banyak: true, terpilih: ["8", 10, { jahat: 1 }] },
      { kunci: "#c", label: "C", pilihan: "bukan larik", terpilih: { jahat: 1 }, banyak: "ya" },
      null,
    ]);
    expect(hasil).toEqual([
      { kunci: "#a", label: "A", pilihan: [{ nilai: "1", label: "Satu" }], terpilih: "1" },
      { kunci: "#b", label: "B", pilihan: [], banyak: true, terpilih: ["8", "10"] },
      { kunci: "#c", label: "C", pilihan: [] },
      { kunci: "", label: "", pilihan: [] },
    ]);
  });

  it("bukan larik menjadi daftar kosong; batas jumlah medan dihormati", () => {
    expect(saringMedanPilihan("x")).toEqual([]);
    expect(saringMedanPilihan(Array.from({ length: 30 }, () => ({})), { medan: 20 })).toHaveLength(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTE: POST isian-sipp mengirim AMAR draf sebagai masukan terpisah
// ─────────────────────────────────────────────────────────────────────────────

const NASKAH_DRAF = [
  "DUDUK PERKARA",
  "Bahwa Penggugat telah mengajukan gugatan cerai terhadap Tergugat;",
  "PERTIMBANGAN HUKUM",
  "Menimbang, bahwa Penggugat telah mengajukan permohonan pencabutan perkara secara lisan di depan sidang;",
  "Menimbang, bahwa oleh karena itu permohonan pencabutan tersebut beralasan hukum dan dapat dikabulkan;",
  "AMAR PUTUSAN",
  "Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Penggugat;",
  "Memerintahkan Panitera untuk mencatat pencabutan perkara tersebut dalam register perkara;",
  "PENUTUP",
  "Demikian diputuskan.",
].join("\n");

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => ({ naskah: NASKAH_DRAF, keadaan: "draf", versi: 3 }),
  }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  // Hak unggah putusan (9 Okt 2026) diuji di hak-unggah-putusan-9okt.test.ts.
  pastikanBolehUnggahPutusan: async () => ({ actor: { name: "Penguji" }, peran: "hakim" }),
  bolehUnggahPutusan: () => true,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippKonteks: async () => ({ ok: false, error: "tidak dipakai POST" }),
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));

describe("rute POST /api/aleta-ecourt/putusan/isian-sipp", () => {
  it("membaca status dari AMAR draf, bukan dari pertimbangannya; terpilih ikut diteruskan", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/putusan/isian-sipp/route");
    const jawab = await POST(
      new NextRequest("http://localhost/api/aleta-ecourt/putusan/isian-sipp", {
        method: "POST",
        body: JSON.stringify({
          nomorPerkara: "xxx/Pdt.G/2025/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          medan: [
            { ...STATUS, terpilih: "-1" },
            { ...DISPEN, terpilih: "1" },
          ],
        }),
      })
    );
    const isi = (await jawab.json()) as { data: { ada: boolean; usulan: UsulanMedan[] } };
    expect(isi.data.ada).toBe(true);
    const [status, dispen] = isi.data.usulan;
    expect(status.nilaiLabel).toBe("Dicabut");
    expect(status.sumberUsulan).toBe("amar");
    expect(status.keyakinan).toBe("pasti");
    expect(dispen.nilaiLabel).toBe("Hamil");
    expect(dispen.sumberUsulan).toBe("halaman");
  });
});
