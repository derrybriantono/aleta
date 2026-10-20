/* === F3 14 Okt === */
/**
 * SALINAN BAS DI FOLDER JENIS (paket ABT abt-susunan-satu-folder, agen A3, 14 Okt 2026).
 *
 * Keputusan 14 Okt "satu folder per jenis" DIGANTI 15 Okt sore: BAS berpasangan di folder "<folder putusan> - BAS" (SUSUNAN-BERPASANGAN.md). Paket A3 menyalin 233 BAS dari folder ALUR 01-13,
 * "BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)" (menu 945) dan "BAS Itsbat Nikah Gugur dan Cabut" (946) ke folder jenis
 * ("1 Perceraian CG", "1a Perceraian CT", ...) dengan nama "BAS ALUR nn <nama lama>", "BAS KUMULASI <nama lama>",
 * "BAS IN GUGUR CABUT <nama lama>", lalu menyembunyikan menu ALUR/945/946 (folder & berkasnya tetap di disk).
 * Berkas ini DIBANGKITKAN dari paket-satker/daftar-salin.tsv + server-db/abt_menu-derry.tsv paket itu
 * (D:/aleta-dev/kerja/batch-14okt-sore/f3/bangkitkan_salinan.py); dijaga src/test/salinan-bas-jenis.test.ts; logikanya di lib/salinan-bas-jenis.ts.
 */
export const AKAR_SALINAN_BAS = "derry_briantono";

/** Folder jenis tujuan -> nama & alias menu ABT-nya (abt_menu.nama / nama_alias; h3 kartu & bilah kiri ABT). */
export const MENU_FOLDER_JENIS: Record<string, { id: number; nama: string; alias: string }> = {
  "1 Perceraian CG - BAS": {"id": 102, "nama": "Cerai Gugat - BAS", "alias": "CG - BAS"},
  "1a Perceraian CT - BAS": {"id": 104, "nama": "Cerai Talak - BAS", "alias": "CT - BAS"},
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS": {"id": 132, "nama": "Cerai Gugat Kumulasi Hak Asuh Anak - BAS", "alias": "CG Kumulasi Hak Asuh - BAS"},
  "2 Itsbat Nikah - BAS": {"id": 108, "nama": "Itsbat Nikah - BAS", "alias": "Itsbat - BAS"},
  "2a Itsbat Nikah Kontensius - BAS": {"id": 128, "nama": "Itsbat Nikah Kontensius - BAS", "alias": "IN Kontensius - BAS"},
  "3 Dispensasi Kawin - BAS": {"id": 110, "nama": "Dispensasi Kawin - BAS", "alias": "Diska/DK - BAS"},
  "4a Harta Bersama - BAS": {"id": 124, "nama": "Harta Bersama - BAS", "alias": "HB - BAS"},
  "4b Kewarisan - BAS": {"id": 126, "nama": "Kewarisan - BAS", "alias": "Waris - BAS"},
  "5 Izin Poligami - BAS": {"id": 130, "nama": "Izin Poligami - BAS", "alias": "Poligami - BAS"},
  // F21 17 Okt: paket abt-pembatalan-perkawinan-derry (menu 136) dan abt-hak-asuh-derry (menu 134) menerima salinan 29 BAS ALUR 04-09 seperti HB/Waris.
  // I7 17 Okt: pembatalan perkawinan (344) dikecualikan dari mediasi (PERMA 1/2016 Pasal 4 ayat (2) huruf d) - 5 salinan BAS mediasi ([1] ALUR 04/05/06,
  // [C1]/[C2] ALUR 08) dipindah paket abt-varian-17okt-derry ke derry_briantono/terhapus/5a Pembatalan Perkawinan - BAS; "5a ... - BAS" kini 24 salinan
  // (+ ALUR 39 tanpa langkah mediasi berhasil). "6a Hak Asuh Anak (Hadhanah) - BAS" tetap 29; I15 18 Okt: "6b Penguasaan Anak - BAS" 29.
  "5a Pembatalan Perkawinan - BAS": {"id": 136, "nama": "Pembatalan Perkawinan - BAS", "alias": "Pembatalan Nikah - BAS"},
  "6a Hak Asuh Anak (Hadhanah) - BAS": {"id": 134, "nama": "Hak Asuh Anak (Hadhanah) - BAS", "alias": "Hak Asuh - BAS"},
  // I15 18 Okt: paket abt-penguasaan-anak-derry (menu 154) - penguasaan anak (jenis 349) terpisah dari hak asuh; menerima 29 BAS ALUR 04-09 yang sama dengan 6a.
  "6b Penguasaan Anak - BAS": {"id": 154, "nama": "Penguasaan Anak - BAS", "alias": "Penguasaan Anak - BAS"},
  // I23 18 Okt: paket abt-nafkah-anak-derry (menu 166) - nafkah anak pasca perceraian (jenis 743); menerima 29 BAS ALUR 04-09 yang sama dengan 6b.
  "6c Nafkah Anak - BAS": {"id": 166, "nama": "Nafkah Anak - BAS", "alias": "Nafkah Anak - BAS"},
  // F22 17 Okt: paket abt-pencegahan-nikah-derry (140), abt-wasiat-derry (142), abt-es-biasa-derry (144). Wasiat dan ES acara biasa menerima 29 BAS ALUR 04-09
  // dengan nama sama tetapi isi BERBEDA (penanda bukti surat diganti isian universal) - jangan dideduplikasi menurut md5.
  "5b Pencegahan Perkawinan - BAS": {"id": 140, "nama": "Pencegahan Perkawinan - BAS", "alias": "Pencegahan Nikah - BAS"},
  "4c Wasiat - BAS": {"id": 142, "nama": "Wasiat - BAS", "alias": "Wasiat - BAS"},
  // I28 18 Okt: paket abt-hibah-derry (181), abt-wakaf-derry (183), abt-mafqud-derry (185). Hibah dan wakaf menerima 29 BAS ALUR 04-09 (isi berbeda per jenis, jangan dideduplikasi);
  // mafqud hanya BAS langsung (ALUR 49).
  "4d Hibah - BAS": {"id": 181, "nama": "Hibah - BAS", "alias": "Hibah - BAS"},
  "4e Wakaf - BAS": {"id": 183, "nama": "Wakaf - BAS", "alias": "Wakaf - BAS"},
  "9c Penetapan Mafqud - BAS": {"id": 185, "nama": "Penetapan Mafqud - BAS", "alias": "Mafqud - BAS"},
  // W3a 21 Okt: paket abt-w3a-blangko-baru-perkawinan (menu 169, 171, 173, 175, 177, 179). Kelalaian kewajiban (1e) dan hak bekas istri (1f) menerima 29 BAS ALUR 04-09
  // (isi berbeda per jenis: kepala "dalam perkara <jenis>" dan bukti surat jenis itu); empat jenis permohonan hanya BAS langsung (ALUR 60-63).
  "5c Penolakan Perkawinan - BAS": {"id": 169, "nama": "Penolakan Perkawinan - BAS", "alias": "Penolakan Perkawinan - BAS"},
  "5d Perkawinan Campuran - BAS": {"id": 171, "nama": "Perkawinan Campuran - BAS", "alias": "Perkawinan Campuran - BAS"},
  "3a Izin Kawin - BAS": {"id": 173, "nama": "Izin Kawin - BAS", "alias": "Izin Kawin - BAS"},
  "8a Pengesahan Anak - BAS": {"id": 175, "nama": "Pengesahan Anak - BAS", "alias": "Pengesahan Anak - BAS"},
  "1e Kelalaian Kewajiban Suami Istri - BAS": {"id": 177, "nama": "Kelalaian Kewajiban Suami Istri - BAS", "alias": "Kelalaian Kewajiban Suami Istri - BAS"},
  "1f Hak Bekas Istri - BAS": {"id": 179, "nama": "Hak Bekas Istri - BAS", "alias": "Hak Bekas Istri - BAS"},
  "10a Ekonomi Syariah Biasa - BAS": {"id": 144, "nama": "Ekonomi Syariah (Acara Biasa) - BAS", "alias": "ES Acara Biasa - BAS"},
  "8 Asal Usul Anak - BAS": {"id": 116, "nama": "Asal Usul Anak - BAS", "alias": "Asal Usul Anak - BAS"},
  "9b Permohonan Umum - BAS": {"id": 122, "nama": "Permohonan Umum (Cabut/Gugur/NO) - BAS", "alias": "Permohonan Umum - BAS"},
};

/** Folder sumber (tanpa akar) -> berkas sumber -> folder jenis tujuan (tanpa akar) yang menerima salinannya. */
export const SALINAN_BAS_JENIS: Record<string, Record<string, string[]>> = {
  "ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)": {
    "[1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Gugat.rtf": ["1 Perceraian CG - BAS"],
    "[1b] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Talak.rtf": ["1a Perceraian CT - BAS"],
  },
  "ALUR 02 Cerai Verstek 2 Sidang": {
    "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
  },
  "ALUR 03 Cerai Verstek 3 Sidang atau Lebih": {
    "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[2] BAS Lanjutan P Hadir & T Tidak Hadir - Tunda Panggil T Lagi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
  },
  "ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)": {
    "[1] BAS 1 P & T Hadir - Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[5a] BAS 5a P & T Hadir - Duplik Rekonvensi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[6] BAS 6 P & T Hadir - Pembuktian P.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[7] BAS 7 P & T Hadir - Pembuktian T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[8] BAS 8 P & T Hadir - Kesimpulan.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[9] BAS 9 P & T Hadir - Penyampaian Putusan.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
  },
  "ALUR 05 Cerai Kontra Lisan (Mediasi s.d. Putusan)": {
    "[1] BAS 1 P & T Hadir - Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[3] BAS 3 P & T Hadir - Pembuktian P, Tunda Pembuktian T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3a] BAS 3 P & T Hadir - Pembuktian P dan T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[4] BAS 4 P & T Hadir - Musyawarah Majelis dan Pembacaan Putusan.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
  },
  "ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir": {
    "[1] BAS 1 P & T Hadir - Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[2] BAS 2 P Hadir & T Tidak Hadir - Laporan Mediasi, Tunda Panggil T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[3] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (2 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3a] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (3 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3b] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (4 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[3c] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (5 Saksi).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
  },
  "ALUR 07 Cerai Gugur": {
    "[1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[3] BAS Putus P & T Tidak Hadir - Gugur.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
  },
  "ALUR 08 Cerai Dicabut": {
    "[A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sidang Pertama sebelum Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[B] BAS Lanjutan P Hadir & T Tidak Hadir - Cabut karena Gugatan Salah.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"],
    "[C1] BAS 1 P & T Hadir - Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[C2] BAS Putus P & T Hadir - Cabut Perkara Damai dari Mediasi.rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
  },
  "ALUR 09 Cerai Tidak Dapat Diterima (NO)": {
    "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
    "[2] BAS Putus P Hadir & T Tidak Hadir - NO (Alamat T Salah).rtf": ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS", "2a Itsbat Nikah Kontensius - BAS", "4a Harta Bersama - BAS", "4b Kewarisan - BAS", "5 Izin Poligami - BAS", "5a Pembatalan Perkawinan - BAS", "6a Hak Asuh Anak (Hadhanah) - BAS", "6b Penguasaan Anak - BAS", "6c Nafkah Anak - BAS", "1e Kelalaian Kewajiban Suami Istri - BAS", "1f Hak Bekas Istri - BAS", "4c Wasiat - BAS", "4d Hibah - BAS", "4e Wakaf - BAS", "10a Ekonomi Syariah Biasa - BAS"],
  },
  "ALUR 10 Cerai Talak Sidang Ikrar Talak": {
    "[1] BAS Ikrar Talak - P Hadir & T Tidak Hadir.rtf": ["1a Perceraian CT - BAS"],
    "[2] BAS Ikrar Talak - P & T Hadir.rtf": ["1a Perceraian CT - BAS"],
    "[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban.rtf": ["1a Perceraian CT - BAS"],
    "[3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggang Waktu 6 Bulan.rtf": ["1a Perceraian CT - BAS"],
  },
  "ALUR 11 Itsbat Nikah 1 Sidang": {
    "[1] BAS 1 IN - Kabul (1x Sidang).rtf": ["2 Itsbat Nikah - BAS"],
    "[1a] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang).rtf": ["2 Itsbat Nikah - BAS"],
  },
  "ALUR 12 Dispensasi Kawin": {
    "[1] BAS DK - Anak Perempuan Hamil.rtf": ["3 Dispensasi Kawin - BAS"],
    "[1a] BAS DK - Calon Istri Hamil (Anak Laki-laki).rtf": ["3 Dispensasi Kawin - BAS"],
    "[2] BAS DK - Anak Perempuan Sudah Berhubungan Badan.rtf": ["3 Dispensasi Kawin - BAS"],
    "[2a] BAS DK - Anak Laki-laki Sudah Berhubungan Badan.rtf": ["3 Dispensasi Kawin - BAS"],
  },
  "ALUR 13 Asal Usul Anak": {
    "[1] BAS 1 Asal Usul Anak - Kabul.rtf": ["8 Asal Usul Anak - BAS"],
  },
  "BAS Itsbat Nikah Gugur dan Cabut": {
    "[C] BAS Putus Itsbat Nikah Dicabut - Para Pemohon Hadir Mencabut.rtf": ["2 Itsbat Nikah - BAS", "9b Permohonan Umum - BAS"],
    "[G] BAS Putus Itsbat Nikah Gugur - Para Pemohon Tidak Hadir.rtf": ["2 Itsbat Nikah - BAS", "9b Permohonan Umum - BAS"],
  },
  "BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)": {
    "[2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf": ["1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS"],
    "[2b] BAS Putus Verstek CG Kumulasi Hak Asuh Anak dan Nafkah Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf": ["1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS"],
  },
};
/* === AKHIR F3 === */

/* === I2 16 Okt === */
/**
 * BAS yang dibuat paket ABT LANGSUNG di folder jenis (tanpa berkas sumber di folder ALUR yang tersembunyi) - bentuk kunci sama dengan
 * SALINAN_BAS_JENIS supaya nama salinannya ("BAS ALUR 10 [4] ...") dan menunya ikut aturan yang sama. Dipisah dari SALINAN_BAS_JENIS
 * karena tabel itu dijaga persis sama dengan 233 salinan paket A3 di server 15 Okt (salinan-bas-jenis.test.ts).
 *   abt-ikrar-derry (16 Okt): BAS ALUR 10 [4] ikrar talak P & T tidak hadir, tunda tenggang waktu 6 bulan.
 */
export const SALINAN_BAS_LANGSUNG: Record<string, Record<string, string[]>> = {
  "ALUR 10 Cerai Talak Sidang Ikrar Talak": {
    "[4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf": ["1a Perceraian CT - BAS"],
  },
};
/* === AKHIR I2 === */
