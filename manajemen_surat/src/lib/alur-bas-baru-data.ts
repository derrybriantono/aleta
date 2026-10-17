/* === G3 15 Okt === */
/**
 * BAS BARU di folder jenis (paket ABT abt-bas-paw + abt-bas-permohonan agen D3, abt-bas-gugatan agen E3; 14 Okt 2026).
 * DIBANGKITKAN oleh D:/aleta-dev/kerja/batch-14okt-sore/g3/bangkitkan_bas_baru.py dari daftar-rtf.tsv ketiga paket itu; jangan disunting tangan.
 * Aturan pemilihan: lib/alur-bas-baru.ts; dijaga src/test/alur-bas-baru.test.ts.
 * F21 17 Okt: ALUR 38 (hak asuh), 39 (pembatalan perkawinan), 40 (ekonomi syariah gugatan sederhana) ditambah dari pohon server
 * (paket abt-hak-asuh-derry, abt-pembatalan-perkawinan-derry, abt-ekonomi-syariah-derry); langkahnya diperiksa terhadap nama berkas di server.
 * F22 17 Okt (abt-pencegahan-nikah-derry, abt-wasiat-derry, abt-es-biasa-derry): ALUR 41 (pencegahan perkawinan, 10 langkah), 42 (wasiat) dan 43 (ES acara biasa)
 * dari daftar-rtf.tsv ketiga paket; kode langkah 42/43 sama dengan ALUR 38 (V1, AP, CB, V2, TP, NO).
 * I15 18 Okt (abt-penguasaan-anak-derry): ALUR 44 (penguasaan anak, jenis 349, folder 6b - BAS, menu 154) menggantikan ALUR 38 untuk jenis 349; 6 langkah sama dengan ALUR 38.
 * I7 17 Okt (abt-varian-17okt-derry): ALUR 39 kehilangan langkah CB ("Mediasi Berhasil - Gugatan Dicabut", dipindah ke derry_briantono/terhapus karena
 * pembatalan perkawinan dikecualikan dari mediasi); menu hak asuh 133/134 kini jenis_perkara_id 369-369 (dulu alur_perkara_id 15), jadi ALUR 38 jenis 369.
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
    "folder": "derry_briantono/9 Penetapan Ahli Waris - BAS",
    "menu": {
      "id": 118,
      "nama": "Penetapan Ahli Waris (P3HP) - BAS",
      "alias": "PAW/P3HP - BAS"
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
    "folder": "derry_briantono/9b Permohonan Umum - BAS",
    "menu": {
      "id": 122,
      "nama": "Permohonan Umum (Cabut/Gugur/NO) - BAS",
      "alias": "Permohonan Umum - BAS"
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
    "folder": "derry_briantono/6 Perwalian - BAS",
    "menu": {
      "id": 112,
      "nama": "Perwalian - BAS",
      "alias": "Perwalian - BAS"
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
    "folder": "derry_briantono/2 Itsbat Nikah - BAS",
    "menu": {
      "id": 108,
      "nama": "Itsbat Nikah - BAS",
      "alias": "Itsbat - BAS"
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
    "folder": "derry_briantono/9a Lain-Lain (Pengangkatan Anak) - BAS",
    "menu": {
      "id": 120,
      "nama": "Lain-Lain (Pengangkatan Anak) - BAS",
      "alias": "Pengangkatan Anak - BAS"
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
    "folder": "derry_briantono/7 Wali Adhal - BAS",
    "menu": {
      "id": 114,
      "nama": "Wali Adhal - BAS",
      "alias": "Wali Adhal - BAS"
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
    "folder": "derry_briantono/8 Asal Usul Anak - BAS",
    "menu": {
      "id": 116,
      "nama": "Asal Usul Anak - BAS",
      "alias": "Asal Usul Anak - BAS"
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
    "folder": "derry_briantono/3 Dispensasi Kawin - BAS",
    "menu": {
      "id": 110,
      "nama": "Dispensasi Kawin - BAS",
      "alias": "Diska/DK - BAS"
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
    "folder": "derry_briantono/4a Harta Bersama - BAS",
    "menu": {
      "id": 124,
      "nama": "Harta Bersama - BAS",
      "alias": "HB - BAS"
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
    "folder": "derry_briantono/4a Harta Bersama - BAS",
    "menu": {
      "id": 124,
      "nama": "Harta Bersama - BAS",
      "alias": "HB - BAS"
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
    "folder": "derry_briantono/4b Kewarisan - BAS",
    "menu": {
      "id": 126,
      "nama": "Kewarisan - BAS",
      "alias": "Waris - BAS"
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
    "folder": "derry_briantono/4b Kewarisan - BAS",
    "menu": {
      "id": 126,
      "nama": "Kewarisan - BAS",
      "alias": "Waris - BAS"
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
    "folder": "derry_briantono/5 Izin Poligami - BAS",
    "menu": {
      "id": 130,
      "nama": "Izin Poligami - BAS",
      "alias": "Poligami - BAS"
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
    "folder": "derry_briantono/2a Itsbat Nikah Kontensius - BAS",
    "menu": {
      "id": 128,
      "nama": "Itsbat Nikah Kontensius - BAS",
      "alias": "IN Kontensius - BAS"
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
    "folder": "derry_briantono/1c Perceraian Kumulasi Itsbat Nikah - BAS",
    "menu": {
      "id": 106,
      "nama": "Cerai Kumulasi Itsbat Nikah - BAS",
      "alias": "Cerai Kumulasi Itsbat - BAS"
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
    "folder": "derry_briantono/1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS",
    "menu": {
      "id": 132,
      "nama": "Cerai Gugat Kumulasi Hak Asuh Anak - BAS",
      "alias": "CG Kumulasi Hak Asuh - BAS"
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
  },
  /* === F21 17 Okt === */
  {
    "id": "alur-38",
    "nomor": 38,
    "nama": "Hak Asuh Anak (Hadhanah) - Verstek, Perdamaian, Cabut, P Tidak Hadir, NO",
    "folder": "derry_briantono/6a Hak Asuh Anak (Hadhanah) - BAS",
    "menu": {
      "id": 134,
      "nama": "Hak Asuh Anak (Hadhanah) - BAS",
      "alias": "Hak Asuh - BAS"
    },
    "jenisMin": 369,
    "jenisMaks": 369,
    "langkah": [
      {
        "kode": "V1",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "AP",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "V2",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 38 Hak Asuh - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-39",
    "nomor": 39,
    "nama": "Pembatalan Perkawinan - Verstek, P Tidak Hadir, NO",
    "folder": "derry_briantono/5a Pembatalan Perkawinan - BAS",
    "menu": {
      "id": 136,
      "nama": "Pembatalan Perkawinan - BAS",
      "alias": "Pembatalan Nikah - BAS"
    },
    "jenisMin": 344,
    "jenisMaks": 344,
    "langkah": [
      {
        "kode": "V1",
        "berkas": "BAS ALUR 39 Pembatalan Nikah - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "V2",
        "berkas": "BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 39 Pembatalan Nikah - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 39 Pembatalan Nikah - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-40",
    "nomor": 40,
    "nama": "Ekonomi Syariah - Gugatan Sederhana (Hakim Tunggal)",
    "folder": "derry_briantono/10 Ekonomi Syariah - BAS",
    "menu": {
      "id": 138,
      "nama": "Ekonomi Syariah - BAS",
      "alias": "Ekonomi Syariah - BAS"
    },
    "jenisMin": 370,
    "jenisMaks": 370,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 40 ES GS - [1] Sidang 1 - P & T Hadir - Damai Gagal, Gugatan dan Jawaban.rtf",
        "keterangan": "Sidang 1 - P & T Hadir - Damai Gagal, Gugatan dan Jawaban"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 1 - P & T Hadir - Damai Berhasil - Akta Perdamaian"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 40 ES GS - [1b] Sidang 1 - P Hadir & T Tidak Hadir - Panggil T Kedua Kali.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Panggil T Kedua Kali"
      },
      {
        "kode": "1c",
        "berkas": "BAS ALUR 40 ES GS - [1c] Sidang 1 - P Tidak Hadir - Gugatan Gugur.rtf",
        "keterangan": "Sidang 1 - P Tidak Hadir - Gugatan Gugur"
      },
      {
        "kode": "1d",
        "berkas": "BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat Tinggalnya - NO.rtf",
        "keterangan": "Sidang 1 - T Tidak Diketahui Tempat Tinggalnya - NO"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 40 ES GS - [2] Sidang 2 - P & T Hadir - Pembuktian, Tunda Putusan.rtf",
        "keterangan": "Sidang 2 - P & T Hadir - Pembuktian, Tunda Putusan"
      },
      {
        "kode": "2a",
        "berkas": "BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bukti dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Bukti dan Putusan Verstek"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 40 ES GS - [3] Sidang Terakhir - Pengucapan Putusan dan Hak Keberatan.rtf",
        "keterangan": "Sidang Terakhir - Pengucapan Putusan dan Hak Keberatan"
      },
      {
        "kode": "C",
        "berkas": "BAS ALUR 40 ES GS - [C] Sidang - P Mencabut Gugatan.rtf",
        "keterangan": "Sidang - P Mencabut Gugatan"
      }
    ]
  },
  /* === F22 17 Okt === */
  {
    "id": "alur-41",
    "nomor": 41,
    "nama": "Pencegahan Perkawinan - Permohonan (Calon Mempelai Didengar)",
    "folder": "derry_briantono/5b Pencegahan Perkawinan - BAS",
    "menu": {
      "id": 140,
      "nama": "Pencegahan Perkawinan - BAS",
      "alias": "Pencegahan Nikah - BAS"
    },
    "jenisMin": 342,
    "jenisMaks": 342,
    "langkah": [
      {
        "kode": "1",
        "berkas": "BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "1a",
        "berkas": "BAS ALUR 41 Pencegahan - [1a] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Tunda Penetapan.rtf",
        "keterangan": "Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Tunda Penetapan"
      },
      {
        "kode": "1b",
        "berkas": "BAS ALUR 41 Pencegahan - [1b] Sidang 1 - Calon Tidak Hadir - Bukti Surat, Tunda Panggil.rtf",
        "keterangan": "Sidang 1 - Calon Tidak Hadir - Bukti Surat, Tunda Panggil"
      },
      {
        "kode": "2",
        "berkas": "BAS ALUR 41 Pencegahan - [2] Sidang Lanjutan - Calon Mempelai & 2 Saksi, Tunda Penetapan.rtf",
        "keterangan": "Sidang Lanjutan - Calon Mempelai & 2 Saksi, Tunda Penetapan"
      },
      {
        "kode": "2b",
        "berkas": "BAS ALUR 41 Pencegahan - [2b] Sidang Lanjutan - Calon Mempelai & 2 Saksi, Penetapan Dibacakan.rtf",
        "keterangan": "Sidang Lanjutan - Calon Mempelai & 2 Saksi, Penetapan Dibacakan"
      },
      {
        "kode": "3",
        "berkas": "BAS ALUR 41 Pencegahan - [3] Sidang Terakhir - Pembacaan Penetapan.rtf",
        "keterangan": "Sidang Terakhir - Pembacaan Penetapan"
      },
      {
        "kode": "C",
        "berkas": "BAS ALUR 41 Pencegahan - [C] Pemohon Hadir Mencabut Permohonan.rtf",
        "keterangan": "Pemohon Hadir Mencabut Permohonan"
      },
      {
        "kode": "G",
        "berkas": "BAS ALUR 41 Pencegahan - [G] Pemohon Tidak Pernah Hadir - Permohonan Gugur.rtf",
        "keterangan": "Pemohon Tidak Pernah Hadir - Permohonan Gugur"
      },
      {
        "kode": "N",
        "berkas": "BAS ALUR 41 Pencegahan - [N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022).rtf",
        "keterangan": "Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022)"
      },
      {
        "kode": "T",
        "berkas": "BAS ALUR 41 Pencegahan - [T] Pemohon Tidak Hadir - Tunda Panggil Pemohon.rtf",
        "keterangan": "Pemohon Tidak Hadir - Tunda Panggil Pemohon"
      }
    ]
  },
  {
    "id": "alur-42",
    "nomor": 42,
    "nama": "Wasiat - Verstek, Cabut, P Tidak Hadir, NO",
    "folder": "derry_briantono/4c Wasiat - BAS",
    "menu": {
      "id": 142,
      "nama": "Wasiat - BAS",
      "alias": "Wasiat - BAS"
    },
    "jenisMin": 365,
    "jenisMaks": 365,
    "langkah": [
      {
        "kode": "V1",
        "berkas": "BAS ALUR 42 Wasiat - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "AP",
        "berkas": "BAS ALUR 42 Wasiat - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 42 Wasiat - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "V2",
        "berkas": "BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 42 Wasiat - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 42 Wasiat - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  {
    "id": "alur-43",
    "nomor": 43,
    "nama": "Ekonomi Syariah Acara Biasa - Verstek, Cabut, P Tidak Hadir, NO",
    "folder": "derry_briantono/10a Ekonomi Syariah Biasa - BAS",
    "menu": {
      "id": 144,
      "nama": "Ekonomi Syariah (Acara Biasa) - BAS",
      "alias": "ES Acara Biasa - BAS"
    },
    "jenisMin": 370,
    "jenisMaks": 370,
    "langkah": [
      {
        "kode": "V1",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "AP",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "V2",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 43 ES Acara Biasa - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  },
  /* === I15 18 Okt === */
  {
    "id": "alur-44",
    "nomor": 44,
    "nama": "Penguasaan Anak - Verstek, Perdamaian, Cabut, P Tidak Hadir, NO",
    "folder": "derry_briantono/6b Penguasaan Anak - BAS",
    "menu": {
      "id": 154,
      "nama": "Penguasaan Anak - BAS",
      "alias": "Penguasaan Anak - BAS"
    },
    "jenisMin": 349,
    "jenisMaks": 349,
    "langkah": [
      {
        "kode": "V1",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "keterangan": "Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T"
      },
      {
        "kode": "AP",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Akta Perdamaian"
      },
      {
        "kode": "CB",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf",
        "keterangan": "Sidang 2 - Mediasi Berhasil - Gugatan Dicabut"
      },
      {
        "kode": "V2",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf",
        "keterangan": "Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"
      },
      {
        "kode": "TP",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf",
        "keterangan": "Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P"
      },
      {
        "kode": "NO",
        "berkas": "BAS ALUR 44 Penguasaan Anak - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf",
        "keterangan": "Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)"
      }
    ]
  }
];
/* === AKHIR G3 === */
