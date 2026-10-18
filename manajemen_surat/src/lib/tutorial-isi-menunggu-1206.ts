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
 * Selama ekstensi 1.205.6 belum digabung, tutorial ini TIDAK ditampilkan,
 * supaya pegawai tidak dijanjikan fitur yang belum ada di peramban mereka.
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
export const TUTORIAL_1206_AKTIF = false;

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
      "Buka perkara di ABT dengan ekstensi terpasang, lalu buka tanya jawab saksi di blangko BAS pembuktian. Bagian Susun saksi ada di panel ALETA.",
      "ALETA mengenali jenis perkara dari SIPP, lalu memakai kumpulan pertanyaan untuk jenis itu. Ada 22 kumpulan, satu untuk tiap jenis perkara yang umum.",
      "Kumpulannya: cerai gugat dan cerai talak (termasuk kumulasi), itsbat nikah, dispensasi kawin, penetapan ahli waris, perwalian, harta bersama, kewarisan, wali adhal, wasiat, izin poligami, pembatalan dan pencegahan perkawinan, asal usul anak, hak asuh, Penguasaan Anak, nafkah anak, ekonomi syariah, pengangkatan anak, dan permohonan umum.",
      "Periksa keadaan perkara yang dipakai. Sebagian terisi sendiri dari SIPP: verstek atau kontradiktoir, saksi dari pihak mana, jumlah saksi (dua sampai lima), kumulasi, dan ada tidaknya anak.",
      "Keadaan khusus jenis perkara, misalnya huruf alasan cerai, Anda pilih sendiri. Pertanyaan yang tampil hanya yang sesuai keadaan itu.",
      "Untuk tiap saksi dan tiap pertanyaan, pilih jenis keterangannya: melihat langsung, mendengar langsung, mendengar dari orang lain (de auditu), tahu sebagian, tidak tahu, ragu, atau berbeda dengan saksi lain. Pilih sesuai yang saksi benar-benar katakan di sidang.",
      "ALETA menuliskan jawaban dengan kalimat yang berbeda untuk tiap saksi, sehingga dua saksi tidak berbunyi sama persis. Susunannya tetap sama bila halaman dimuat ulang.",
      "Baris yang berjenis ragu, tahu sebagian, atau berbeda diberi tanda kuning. Keterangan yang ragu bukan alat bukti atas hal itu, jadi tidak dicentang sendiri dan tidak mengisi isian ABT seperti lama pisah atau tanggal. Isi isian itu sendiri bila memang terbukti dari sumber lain.",
      "Periksa dan sunting hasilnya sebelum dicetak. Rujukan hukum yang belum terverifikasi tidak dicetak di teks. Yang tercetak hanya dasar yang sudah dibaca dari naskahnya.",
    ],
    peringatan: [
      "Susun saksi adalah bahan bantu. Isi keterangan harus sama dengan yang diucapkan saksi, dan kebenarannya diperiksa majelis.",
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
      "Di SIPP, panel ALETA menempel di sisi kanan halaman mulai lebar layar 900 piksel. Halaman SIPP ikut menyempit sehingga tidak tertutup panel. Pada layar yang lebih sempit, panel mengambang seperti sebelumnya.",
      "Lebar panel dan ukuran huruf mengikuti layar, dari laptop kecil sampai layar lebar, TV, dan 4K. Ukuran huruf yang Anda pilih sendiri tetap dihormati.",
      "Pada layar yang tidak terlalu lebar, tab di panel SIPP berjajar dalam satu baris yang dapat digulir. Tab yang sedang dipilih bergulir ke tengah. Lampu sambungan turun ke baris kedua bila kepala panel sempit.",
      "Panel ABT paling lebar 36 persen layar di laptop, jadi tidak menutupi blangko. Panel ini tetap mengambang, dan lebar serta posisinya masih bisa Anda tarik. Ukuran yang sudah Anda atur tidak diubah.",
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
