/**
 * ============================================================================
 * TUTORIAL YANG MENUNGGU EKSTENSI 1.205.6
 * ============================================================================
 *
 * Dua fitur ekstensi ditulis tutorialnya LEBIH DULU daripada kodenya sampai
 * ke branch ini:
 *   1. Susun saksi menurut keadaan perkara (panel ABT, tanya jawab saksi).
 *   2. Tampilan panel ekstensi V2 (layar laptop kecil sampai TV dan 4K).
 *
 * Ekstensi 1.205.6 sudah dirilis dan langkah-langkahnya sudah dicocokkan dengan tampilan sungguhan (18 Okt 2026, integrasi 1.205.7),
 * jadi tutorial ini AKTIF. Sebelum itu ia disimpan saja supaya pegawai tidak dijanjikan fitur yang belum ada di peramban mereka.
 * Bentuk datanya sama dengan tutorial-isi.ts, dan tidak memakai kunci matriks
 * (hanya `untuk`), sehingga tidak bergantung pada menu atau hak yang belum ada.
 *
 * CARA MENGAKTIFKAN (setelah 1.205.6 digabung dan catatannya ada di
 * catatan-ekstensi.ts):
 *   1. Ubah TUTORIAL_1206_AKTIF menjadi true.
 *   2. Periksa tiap langkah terhadap tampilan sungguhan (nama tombol, urutan).
 *   3. Jalankan src/test/tutorial-menunggu-1206.test.ts. Uji itu MERAH bila
 *      catatan 1.205.6 sudah ada tetapi tutorial ini belum diaktifkan, atau
 *      sebaliknya, jadi tidak mungkin terlupa.
 */

import type { Tutorial } from "@/lib/tutorial-hidup";

/** Versi ekstensi yang membawa kedua fitur ini. */
export const VERSI_TUTORIAL_MENUNGGU = "1.205.6";

/** false = disimpan saja, belum tampil. Lihat "CARA MENGAKTIFKAN" di atas. */
export const TUTORIAL_1206_AKTIF = true;

export const TUTORIAL_MENUNGGU_1206: readonly Tutorial[] = [
  {
    id: "ekstensi-susun-saksi-keadaan-perkara",
    judul: "Ekstensi di ABT: Susun saksi menurut keadaan perkara",
    ringkas: "Tanya jawab saksi disusun dari pertanyaan yang sesuai jenis dan keadaan perkara, dengan kalimat yang berbeda untuk tiap saksi.",
    kelompok: "ekstensi",
    mencakup: {},
    untuk: ["hakim", "pimpinan", "panitera", "panmud", "pp", "analis-perkara"],
    halaman: ["/aleta-ecourt"],
    tautan: { teks: "Buka ALETA e-Court", href: "/aleta-ecourt" },
    langkah: [
      "Buka perkara di ABT dengan ekstensi terpasang. Di panel ALETA tekan tombol Susun saksi menurut keadaan perkara. Tombol ini ada di blangko BAS pembuktian dan di halaman tanya jawab saksi.",
      "ALETA mengenali jenis perkara dari SIPP, lalu memakai kumpulan pertanyaan untuk jenis itu. Ada 22 kumpulan, satu untuk tiap jenis perkara yang umum. Bila jenisnya tidak terbaca, pilih sendiri jenis perkaranya di form.",
      "Kumpulannya: cerai gugat dan cerai talak (termasuk kumulasi), itsbat nikah, dispensasi kawin, penetapan ahli waris, perwalian, harta bersama, kewarisan, wali adhal, wasiat, izin poligami, pembatalan dan pencegahan perkawinan, asal usul anak, hak asuh, Penguasaan Anak, nafkah anak, ekonomi syariah, pengangkatan anak, dan permohonan umum.",
      "Periksa bagian Keadaan perkara. Sebagian terisi sendiri dari SIPP: verstek atau kontradiktoir, kumulasi, dan ada tidaknya anak. Keadaan khusus jenis perkara, misalnya huruf alasan cerai, Anda pilih sendiri. Pertanyaan yang tampil hanya yang sesuai keadaan itu.",
      "Di bagian Saksi dan jenis keterangannya, pilih Jumlah saksi (2 sampai 5). Untuk tiap saksi pilih jenis keterangan: Melihat sendiri, Mendengar sendiri, Tahu dari cerita orang lain (de auditu), Hanya sebagian yang diketahui, Tidak tahu, atau Ragu atau tidak yakin. Pilih sesuai yang saksi benar-benar katakan di sidang.",
      "Untuk Tahu dari cerita orang lain, tulis sumber ceritanya, misalnya ibu kandung. Bila keterangan seorang saksi berbeda dari saksi lain pada butir tertentu, buka Keterangannya berbeda dari saksi lain pada butir tertentu, lalu centang butirnya.",
      "Pada perkara yang punya lawan, tiap saksi punya pilihan Diajukan oleh Penggugat atau Diajukan oleh Tergugat. Pada harta bersama dan kewarisan, tandai dulu Bantahan Tergugat di Keadaan perkara. Saksi yang diajukan Tergugat lalu menerangkan versi Tergugat, sedangkan saksi Penggugat tidak berubah. Bila bantahan belum ditandai, ALETA memberi peringatan.",
      "Tekan Susun pertanyaan dan jawaban. ALETA menuliskan jawaban dengan kalimat yang berbeda untuk tiap saksi, sehingga dua saksi tidak berbunyi sama persis. Susunannya tetap sama bila halaman dimuat ulang.",
      "Baris yang berjenis ragu, sebagian, atau berbeda diberi tanda kuning. Keterangan yang ragu bukan alat bukti atas hal itu, jadi tidak dicentang sendiri dan tidak mengisi isian ABT seperti lama pisah atau tanggal. Isi isian itu sendiri bila memang terbukti dari sumber lain.",
      "Periksa dan sunting hasilnya, lalu tekan Simpan ke ABT. Bila ABT sudah berisi keterangan untuk saksi itu, ALETA meminta Anda mencentang persetujuan menimpa lebih dulu. Rujukan hukum yang belum terverifikasi tidak dicetak di teks.",
      "Pada dispensasi kawin ada dua tab: Saksi, dan Keterangan anak, calon, dan orang tua. Di tab kedua, atur siapa yang hadir (anak, calon, orang tua anak, orang tua calon; ayah dan ibu terpisah), tekan Susun tanya-jawab keterangan, lalu Salin tanya-jawab ini atau Salin semua tanya-jawab ke BAS.",
      "Butir kehamilan dan hubungan badan di tab keterangan hanya ikut disusun bila kotak konfirmasi tercentang. Kotak itu tercentang sendiri, dengan tulisan menurut posita, bila posita menyebut calon istri hamil atau sudah berhubungan badan. Bila posita tidak menyebutnya, kotak tetap mati. Centang Anda selalu menang.",
    ],
    peringatan: [
      "Susun saksi adalah bahan bantu. Isi keterangan harus sama dengan yang diucapkan saksi, dan kebenarannya diperiksa majelis.",
      "Butir kehamilan dan hubungan badan bersifat sensitif. Walau kotak tercentang sendiri, pastikan hal itu memang ditanyakan di persidangan sebelum dicetak.",
      "Bila jenis perkara tidak terbaca dari SIPP, pastikan kumpulan pertanyaan yang dipakai memang sesuai sebelum menyusun.",
      "Pada Penguasaan Anak, pertanyaan penyerahan anak hanya aktif bila gugatan memintanya.",
      "Pada perkara tanpa lawan (misalnya pencegahan perkawinan dan asal usul anak), semua saksi dihitung sebagai saksi pemohon.",
    ],
    kataKunci: [
      "susun saksi",
      "saksi",
      "tanya jawab saksi",
      "de auditu",
      "ragu",
      "tahu sebagian",
      "keadaan perkara",
      "kuning",
      "jenis keterangan",
      "bas pembuktian",
      "katalog saksi",
      "keterangan anak",
      "dispensasi kawin",
      "saksi tergugat",
      "hamil",
    ],
    baruDi: { sumber: "ekstensi", versi: VERSI_TUTORIAL_MENUNGGU },
  },
  {
    id: "ekstensi-tampilan-panel-v2",
    judul: "Ekstensi: panel yang menyesuaikan layar laptop kecil sampai TV",
    ringkas: "Panel, widget, dan jendela ikon ekstensi mengikuti ukuran layar dan zoom, tanpa tombol yang hilang.",
    kelompok: "ekstensi",
    mencakup: {},
    untuk: "semua",
    halaman: ["/aleta-ecourt"],
    tautan: { teks: "Cara memasang ekstensi", href: "/aleta-ecourt" },
    langkah: [
      "Di SIPP dengan tampilan UI Baru, panel ALETA menempel di sisi kanan halaman mulai lebar layar 900 piksel, sehingga tabel SIPP tidak tertutup. Pada layar yang lebih sempit, atau bila panel dilepas dengan klik dua kali di sudutnya, panel mengambang seperti sebelumnya.",
      "Lebar panel dan ukuran huruf mengikuti layar, dari laptop kecil sampai layar lebar, TV, dan 4K. Ukuran huruf yang Anda pilih sendiri tetap dihormati, begitu pula lebar yang Anda tarik.",
      "Pada layar di bawah 1500 piksel, tab di panel SIPP berjajar dalam satu baris yang dapat digulir ke samping. Tab yang dipilih bergulir ke tengah. Lampu SIPP, ALETA, dan e-Court turun ke baris kedua bila kepala panel sempit.",
      "Pada tampilan UI Baru di ABT, lebar minimum panel tidak lagi 560 piksel tetap. Di layar sempit ia dibatasi 36 persen lebar layar (paling sempit 380 piksel), sehingga blangko tidak tertutup. Panel tetap mengambang dan masih bisa Anda tarik.",
      "Di layar HP, deret tombol di kepala panel turun ke baris kedua dan tidak lagi menimpa tulisan ALETA. Tidak ada tombol yang disembunyikan.",
      "Widget di kiri bawah dan jendela yang terbuka dari ikon ekstensi ikut menyesuaikan. Jendela ikon ekstensi tetap nyaman pada zoom 125 sampai 150 persen, tanpa menggeser ke samping.",
    ],
    peringatan: [
      "Tidak ada tombol, tab, atau aksi yang disembunyikan atau dihapus oleh penyesuaian ini.",
      "Bila widget Anda bentangkan sampai lebar penuh di layar kecil, ia dapat menutupi kolom kiri halaman. Bawaannya terlipat.",
      "Setelah ekstensi diperbarui, muat ulang halaman SIPP atau ABT agar tampilan baru dipakai.",
    ],
    kataKunci: ["panel", "layar", "laptop", "tv", "4k", "zoom", "lebar panel", "huruf", "widget", "popup", "tab sipp", "tampilan v2"],
    baruDi: { sumber: "ekstensi", versi: VERSI_TUTORIAL_MENUNGGU },
  },
];
