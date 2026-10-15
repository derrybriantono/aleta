/* === G3 15 Okt === */
/**
 * BAS BARU di folder jenis (paket ABT abt-bas-paw + abt-bas-permohonan agen D3, abt-bas-gugatan agen E3; 14 Okt 2026).
 * DIBANGKITKAN oleh D:/aleta-dev/kerja/batch-14okt-sore/g3/bangkitkan_bas_baru.py dari daftar-rtf.tsv ketiga paket itu; jangan disunting tangan.
 * Aturan pemilihan: lib/alur-bas-baru.ts; dijaga src/test/alur-bas-baru.test.ts.
 */
export type MenuBasBaru = { id: number; nama: string; alias: string };
export type LangkahBasBaru = { kode: string; berkas: string; keterangan: string };
export type AlurBasBaru = {
  id: string;
  nomor: number;
  nama: string;
  /** Folder jenis di ABT, relatif _blangko_abt. */
  folder: string;
  menu: MenuBasBaru;
  jenisMin: number;
  jenisMaks: number;
  langkah: LangkahBasBaru[];
};

export const ALUR_BAS_BARU: AlurBasBaru[] = [
  {
    "id": "alur-14",
    "nomor": 14,
    "nama": "Penetapan Ahli Waris (P3HP)",
    "folder": "derry_briantono/9 Penetapan Ahli Waris",
    "menu": {
      "id": 913,
      "nama": "Putusan Penetapan Ahli Waris (P3HP)",
      "alias": "Putusan PAW/P3HP"
    },
    "jenisMin": 371,
    "jenisMaks": 371,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 14 PAW - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 14 PAW - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 14 PAW - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf",
        "keterangan": "Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 14 PAW - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2a",
        "berkas": "BAS ALUR 14 PAW - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 14 PAW - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 14 PAW - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperbaiki - Tidak Dapat Diterima.rtf",
        "keterangan": "Permohonan Kabur, Tetap Tidak Diperbaiki - Tidak Dapat Diterima"
      }
    ]
  },
  {
    "id": "alur-15",
    "nomor": 15,
    "nama": "Permohonan Umum (Tidak Hadir, Gugur, NO, Cabut)",
    "folder": "derry_briantono/9b Permohonan Umum",
    "menu": {
      "id": 915,
      "nama": "Putusan Permohonan Umum (Cabut/Gugur/NO)",
      "alias": "Putusan Permohonan Umum"
    },
    "jenisMin": 16,
    "jenisMaks": 16,
    "langkah": [
      {
        "kode": "T",
        "berkas": "BAS ALUR 15 Permohonan - [T] Pemohon Tidak Hadir - Tunda Panggil Pemohon.rtf",
        "keterangan": "Pemohon Tidak Hadir - Tunda Panggil Pemohon"
      },
      {
        "kode": "G",
        "berkas": "BAS ALUR 15 Permohonan - [G] Pemohon Tidak Pernah Hadir - Permohonan Gugur.rtf",
        "keterangan": "Pemohon Tidak Pernah Hadir - Permohonan Gugur"
      },
      {
        "kode": "N",
        "berkas": "BAS ALUR 15 Permohonan - [N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022).rtf",
        "keterangan": "Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022)"
      },
      {
        "kode": "C",
        "berkas": "BAS ALUR 15 Permohonan - [C] Pemohon Hadir Mencabut Permohonan.rtf",
        "keterangan": "Pemohon Hadir Mencabut Permohonan"
      }
    ]
  },
  {
    "id": "alur-16",
    "nomor": 16,
    "nama": "Perwalian",
    "folder": "derry_briantono/6 Perwalian",
    "menu": {
      "id": 910,
      "nama": "Putusan Perwalian",
      "alias": "Putusan Perwalian"
    },
    "jenisMin": 354,
    "jenisMaks": 354,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 16 Perwalian - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 16 Perwalian - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 16 Perwalian - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf",
        "keterangan": "Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 16 Perwalian - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2a",
        "berkas": "BAS ALUR 16 Perwalian - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 16 Perwalian - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 16 Perwalian - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      }
    ]
  },
  {
    "id": "alur-17",
    "nomor": 17,
    "nama": "Itsbat Nikah 2+ Sidang",
    "folder": "derry_briantono/2 Itsbat Nikah",
    "menu": {
      "id": 904,
      "nama": "Putusan Itsbat Nikah",
      "alias": "Putusan Itsbat"
    },
    "jenisMin": 360,
    "jenisMaks": 360,
    "langkah": [
      {
        "kode": "1a",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf",
        "keterangan": "Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2a",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 17 IN 2+ Sidang - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      }
    ]
  },
  {
    "id": "alur-18",
    "nomor": 18,
    "nama": "Pengangkatan Anak",
    "folder": "derry_briantono/9a Lain-Lain (Pengangkatan Anak)",
    "menu": {
      "id": 914,
      "nama": "Putusan Lain-Lain (Pengangkatan Anak)",
      "alias": "Putusan Pengangkatan Anak"
    },
    "jenisMin": 369,
    "jenisMaks": 369,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 18 Angkat Anak - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 18 Angkat Anak - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 18 Angkat Anak - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf",
        "keterangan": "Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 18 Angkat Anak - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 18 Angkat Anak - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 18 Angkat Anak - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      },
      {
        "kode": "1d",
        "berkas": "BAS ALUR 18 Angkat Anak - [1d] Sidang 1 - Bukti Surat, Tunda Orang Tua Kandung dan Saksi.rtf",
        "keterangan": "Sidang 1 - Bukti Surat, Tunda Orang Tua Kandung dan Saksi"
      }
    ]
  },
  {
    "id": "alur-19",
    "nomor": 19,
    "nama": "Wali Adhal",
    "folder": "derry_briantono/7 Wali Adhal",
    "menu": {
      "id": 924,
      "nama": "Putusan dan BAS Wali Adhal",
      "alias": "Putusan & BAS Wali Adhal"
    },
    "jenisMin": 363,
    "jenisMaks": 363,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 19 Wali Adhal - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 19 Wali Adhal - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 19 Wali Adhal - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 19 Wali Adhal - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 19 Wali Adhal - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      }
    ]
  },
  {
    "id": "alur-13l",
    "nomor": 13,
    "nama": "Asal Usul Anak (Lanjutan)",
    "folder": "derry_briantono/8 Asal Usul Anak",
    "menu": {
      "id": 911,
      "nama": "Putusan Asal Usul Anak",
      "alias": "Putusan Asal Usul Anak"
    },
    "jenisMin": 358,
    "jenisMaks": 358,
    "langkah": [
      {
        "kode": "1a",
        "berkas": "BAS ALUR 13 AUA - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 13 AUA - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf",
        "keterangan": "Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 13 AUA - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf",
        "keterangan": "Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 13 AUA - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2a",
        "berkas": "BAS ALUR 13 AUA - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 13 AUA - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 13 AUA - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      }
    ]
  },
  {
    "id": "alur-12l",
    "nomor": 12,
    "nama": "Dispensasi Kawin (Lanjutan)",
    "folder": "derry_briantono/3 Dispensasi Kawin",
    "menu": {
      "id": 905,
      "nama": "Putusan Dispensasi Kawin",
      "alias": "Putusan Diska/DK"
    },
    "jenisMin": 362,
    "jenisMaks": 362,
    "langkah": [
      {
        "kode": "3",
        "berkas": "BAS ALUR 12 DK - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      },
      {
        "kode": "C",
        "berkas": "BAS ALUR 12 DK - [C] Sidang 1 - Nasihat, Para Pemohon Mencabut Permohonan.rtf",
        "keterangan": "Sidang 1 - Nasihat, Para Pemohon Mencabut Permohonan"
      },
      {
        "kode": "1t",
        "berkas": "BAS ALUR 12 DK - [1t] Sidang 1 - Anak Perempuan Hamil, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Anak Perempuan Hamil, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "1at",
        "berkas": "BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak Laki-laki), Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Calon Istri Hamil (Anak Laki-laki), Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2t",
        "berkas": "BAS ALUR 12 DK - [2t] Sidang 1 - Anak Perempuan Sudah Berhubungan Badan, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Anak Perempuan Sudah Berhubungan Badan, Tunda Pembacaan Penetapan"
      },
      {
        "kode": "2at",
        "berkas": "BAS ALUR 12 DK - [2at] Sidang 1 - Anak Laki-laki Sudah Berhubungan Badan, Tunda Pembacaan Penetapan.rtf",
        "keterangan": "Sidang 1 - Anak Laki-laki Sudah Berhubungan Badan, Tunda Pembacaan Penetapan"
      }
    ]
  },
  {
    "id": "alur-30",
    "nomor": 30,
    "nama": "Harta Bersama (Insidentil dan Pemeriksaan Setempat)",
    "folder": "derry_briantono/4a Harta Bersama",
    "menu": {
      "id": 920,
      "nama": "Putusan Harta Bersama",
      "alias": "Putusan HB"
    },
    "jenisMin": 348,
    "jenisMaks": 348,
    "langkah": [
      {
        "kode": "I1",
        "berkas": "BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohonan Sita (sesudah ALUR 04 [5]).rtf",
        "keterangan": "Sidang Insidentil 1 - Pemeriksaan Permohonan Sita (sesudah ALUR 04 [5])"
      },
      {
        "kode": "I2",
        "berkas": "BAS ALUR 30 HB - Sidang Insidentil 2 - Pembacaan Putusan Sela (Sita atau Pemeriksaan Setempat).rtf",
        "keterangan": "Sidang Insidentil 2 - Pembacaan Putusan Sela (Sita atau Pemeriksaan Setempat)"
      },
      {
        "kode": "PS",
        "berkas": "BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf",
        "keterangan": "Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8])"
      }
    ]
  },
  {
    "id": "alur-31",
    "nomor": 31,
    "nama": "Harta Bersama (Perdamaian, Cabut, P Tidak Hadir, NO)",
    "folder": "derry_briantono/4a Harta Bersama",
    "menu": {
      "id": 920,
      "nama": "Putusan Harta Bersama",
      "alias": "Putusan HB"
    },
    "jenisMin": 348,
    "jenisMaks": 348,
    "langkah": [
      {
        "kode": "AP",
        "berkas": "BAS ALUR 31 HB - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 31 HB - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 31 HB - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 31 HB - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-32",
    "nomor": 32,
    "nama": "Kewarisan (Insidentil dan Pemeriksaan Setempat)",
    "folder": "derry_briantono/4b Kewarisan",
    "menu": {
      "id": 921,
      "nama": "Putusan Kewarisan",
      "alias": "Putusan Waris"
    },
    "jenisMin": 364,
    "jenisMaks": 364,
    "langkah": [
      {
        "kode": "I1",
        "berkas": "BAS ALUR 32 Waris - Sidang Insidentil 1 - Pemeriksaan Permohonan Sita (sesudah ALUR 04 [5]).rtf",
        "keterangan": "Sidang Insidentil 1 - Pemeriksaan Permohonan Sita (sesudah ALUR 04 [5])"
      },
      {
        "kode": "I2",
        "berkas": "BAS ALUR 32 Waris - Sidang Insidentil 2 - Pembacaan Putusan Sela (Sita atau Pemeriksaan Setempat).rtf",
        "keterangan": "Sidang Insidentil 2 - Pembacaan Putusan Sela (Sita atau Pemeriksaan Setempat)"
      },
      {
        "kode": "PS",
        "berkas": "BAS ALUR 32 Waris - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf",
        "keterangan": "Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8])"
      }
    ]
  },
  {
    "id": "alur-33",
    "nomor": 33,
    "nama": "Kewarisan (Perdamaian, Cabut, P Tidak Hadir, NO)",
    "folder": "derry_briantono/4b Kewarisan",
    "menu": {
      "id": 921,
      "nama": "Putusan Kewarisan",
      "alias": "Putusan Waris"
    },
    "jenisMin": 364,
    "jenisMaks": 364,
    "langkah": [
      {
        "kode": "AP",
        "berkas": "BAS ALUR 33 Waris - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 33 Waris - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 33 Waris - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 33 Waris - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-34",
    "nomor": 34,
    "nama": "Izin Poligami",
    "folder": "derry_briantono/5 Izin Poligami",
    "menu": {
      "id": 923,
      "nama": "Putusan Izin Poligami",
      "alias": "Putusan Poligami"
    },
    "jenisMin": 341,
    "jenisMaks": 341,
    "langkah": [
      {
        "kode": "S1",
        "berkas": "BAS ALUR 34 Poligami - Sidang 1 - P & T Hadir - Mediasi.rtf",
        "keterangan": "Sidang 1 - P & T Hadir - Mediasi"
      },
      {
        "kode": "S2",
        "berkas": "BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohonan, Jawaban Termohon dan Calon Istri.rtf",
        "keterangan": "Sidang 2 - Laporan Mediasi, Permohonan, Jawaban Termohon dan Calon Istri"
      },
      {
        "kode": "S3",
        "berkas": "BAS ALUR 34 Poligami - Sidang 3 - Pembuktian dan Pengucapan Putusan.rtf",
        "keterangan": "Sidang 3 - Pembuktian dan Pengucapan Putusan"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 34 Poligami - Sidang 2 - Mediasi Berhasil - Permohonan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Permohonan Dicabut"
      }
    ]
  },
  {
    "id": "alur-35",
    "nomor": 35,
    "nama": "Itsbat Nikah Kontensius",
    "folder": "derry_briantono/2a Itsbat Nikah Kontensius",
    "menu": {
      "id": 922,
      "nama": "Putusan Itsbat Nikah Kontensius",
      "alias": "Putusan IN Kontensius"
    },
    "jenisMin": 360,
    "jenisMaks": 360,
    "langkah": [
      {
        "kode": "S1P",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, Pembuktian dan Putusan.rtf",
        "keterangan": "Sidang 1 - Jawaban T Mengakui, Pembuktian dan Putusan"
      },
      {
        "kode": "S1T",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, Tunda Pembuktian.rtf",
        "keterangan": "Sidang 1 - Jawaban T Mengakui, Tunda Pembuktian"
      },
      {
        "kode": "S2",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang 2 - Pembuktian dan Putusan.rtf",
        "keterangan": "Sidang 2 - Pembuktian dan Putusan"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang 1 - P & T Hadir - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 1 - P & T Hadir - Gugatan Dicabut"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 35 IN Kontensius - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-36",
    "nomor": 36,
    "nama": "Cerai Kumulasi Itsbat Nikah (Verstek)",
    "folder": "derry_briantono/1c Perceraian Kumulasi Itsbat Nikah",
    "menu": {
      "id": 903,
      "nama": "Putusan Cerai Kumulasi Itsbat Nikah",
      "alias": "Putusan Cerai Kumulasi Itsbat"
    },
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "S1",
        "berkas": "BAS ALUR 36 Cerai Kumulasi IN - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "L",
        "berkas": "BAS ALUR 36 Cerai Kumulasi IN - Sidang Lanjutan - T Tidak Hadir - Tunda Panggil T Lagi.rtf",
        "keterangan": "Sidang Lanjutan - T Tidak Hadir - Tunda Panggil T Lagi"
      },
      {
        "kode": "P2",
        "berkas": "BAS ALUR 36 Cerai Kumulasi IN - Sidang Terakhir - Saksi dan Putusan Verstek (2 Saksi).rtf",
        "keterangan": "Sidang Terakhir - Saksi dan Putusan Verstek (2 Saksi)"
      },
      {
        "kode": "P3",
        "berkas": "BAS ALUR 36 Cerai Kumulasi IN - Sidang Terakhir - Saksi dan Putusan Verstek (3 Saksi).rtf",
        "keterangan": "Sidang Terakhir - Saksi dan Putusan Verstek (3 Saksi)"
      }
    ]
  },
  {
    "id": "alur-37",
    "nomor": 37,
    "nama": "Cerai Gugat Kumulasi Hak Asuh Anak (Kontradiktoir)",
    "folder": "derry_briantono/1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
    "menu": {
      "id": 940,
      "nama": "Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
      "alias": "Putusan CG Kumulasi Hak Asuh"
    },
    "jenisMin": 347,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 1 - P & T Hadir - Mediasi.rtf",
        "keterangan": "Sidang 1 - P & T Hadir - Mediasi"
      },
      {
        "kode": "2m",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 2 - Mediasi Berhasil Sebagian (Hak Asuh) dan Court Calendar.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil Sebagian (Hak Asuh) dan Court Calendar"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 2 - Laporan Mediasi Tidak Berhasil dan Court Calendar.rtf",
        "keterangan": "Sidang 2 - Laporan Mediasi Tidak Berhasil dan Court Calendar"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 3 - Jawaban (dan Gugatan Rekonvensi).rtf",
        "keterangan": "Sidang 3 - Jawaban (dan Gugatan Rekonvensi)"
      },
      {
        "kode": "4",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 4 - Replik (dan Jawaban Rekonvensi).rtf",
        "keterangan": "Sidang 4 - Replik (dan Jawaban Rekonvensi)"
      },
      {
        "kode": "5",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 5 - Duplik (dan Replik Rekonvensi).rtf",
        "keterangan": "Sidang 5 - Duplik (dan Replik Rekonvensi)"
      },
      {
        "kode": "6",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 6 - Pembuktian P.rtf",
        "keterangan": "Sidang 6 - Pembuktian P"
      },
      {
        "kode": "7",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 7 - Pembuktian T.rtf",
        "keterangan": "Sidang 7 - Pembuktian T"
      },
      {
        "kode": "8",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 8 - Kesimpulan.rtf",
        "keterangan": "Sidang 8 - Kesimpulan"
      },
      {
        "kode": "9",
        "berkas": "BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 9 - Pengucapan Putusan.rtf",
        "keterangan": "Sidang 9 - Pengucapan Putusan"
      }
    ]
  }
];
/* === AKHIR G3 === */
