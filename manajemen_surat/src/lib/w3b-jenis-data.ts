/* DIBANGKITKAN oleh abt-paket/w3b-blangko-baru-kuasa-wali/sumber/bangkitkan_ts.py - jangan disunting tangan. */
/**
 * JENIS BLANGKO DERRY BARU GELOMBANG 3 (agen W3b, 21 Okt 2026): pencabutan kekuasaan orang tua (353), pencabutan kekuasaan wali (355), penunjukan wali (356),
 * ganti rugi terhadap wali (357), nafkah anak oleh ibu (350), eksekusi dan verzet. Paket ABT: abt-paket/w3b-blangko-baru-kuasa-wali.
 */
export type JenisW3b = {
  kunci: string;
  idJenis: number | null;
  kunciPeta: string;
  namaSipp: string;
  label: string;
  folder: string;
  folderBas: string;
  menuPutusan: { id: number; nama: string; alias: string };
  menuBas: { id: number; nama: string; alias: string };
  alur: { id: string; nomor: number; namaPendek: string };
  gugatan: boolean;
  permohonan: boolean;
  perdamaian: boolean;
  berkas: Record<string, string>;
  kodeMenuEkstensi: string;
};

export const JENIS_W3B: JenisW3b[] = [
  {
    "kunci": "353",
    "idJenis": 353,
    "kunciPeta": "pencabutan kekuasaan orang tua",
    "namaSipp": "Pencabutan Kekuasaan Orang Tua",
    "label": "pencabutan kekuasaan orang tua",
    "folder": "6d Pencabutan Kekuasaan Orang Tua",
    "folderBas": "6d Pencabutan Kekuasaan Orang Tua - BAS",
    "menuPutusan": {
      "id": 240,
      "nama": "Putusan Pencabutan Kekuasaan Orang Tua",
      "alias": "Pencabutan Kuasa Orang Tua - Putusan"
    },
    "menuBas": {
      "id": 241,
      "nama": "Pencabutan Kekuasaan Orang Tua - BAS",
      "alias": "Pencabutan Kuasa Orang Tua - BAS"
    },
    "alur": {
      "id": "alur-60",
      "nomor": 60,
      "namaPendek": "Pencabutan Kuasa Asuh"
    },
    "gugatan": true,
    "permohonan": true,
    "perdamaian": false,
    "berkas": {
      "kabul": "[01] [Kabul] Pencabutan Kekuasaan Orang Tua - Kontradiktoir",
      "setelahMediasi": "[01a] [Kabul] Pencabutan Kekuasaan Orang Tua - T Tidak Hadir Setelah Mediasi",
      "verstek": "[01b] [Kabul Verstek] Pencabutan Kekuasaan Orang Tua",
      "tolak": "[03] [Tolak] Pencabutan Kekuasaan Orang Tua - Kontradiktoir - Dalil Tidak Terbukti",
      "tolakVerstek": "[03b] [Tolak Verstek] Pencabutan Kekuasaan Orang Tua - Dalil Tidak Terbukti",
      "gugur": "[98a] [Gugur] Pencabutan Kekuasaan Orang Tua - P Tidak Hadir Sidang Pertama",
      "cabutSesudahJawaban": "[98b] [Cabut] Pencabutan Kekuasaan Orang Tua - Sesudah Jawaban dengan Persetujuan T",
      "cabut": "[98] [Cabut] Pencabutan Kekuasaan Orang Tua - P & T Hadir Sebelum Jawaban",
      "coret": "[98c] [Coret] Pencabutan Kekuasaan Orang Tua - Dibatalkan dari Pendaftaran - Panjar Habis",
      "noFormil": "[99a] [NO] Pencabutan Kekuasaan Orang Tua - Kurang Pihak (Plurium Litis Consortium)",
      "noKabur": "[99b] [NO] Pencabutan Kekuasaan Orang Tua - Gugatan Kabur (Obscuur Libel)",
      "noSema": "[99] [NO] Pencabutan Kekuasaan Orang Tua - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
      "mohonKabul": "[01p] [Kabul] Pencabutan Kekuasaan Orang Tua - Permohonan (Pemohon Hadir)",
      "mohonTolak": "[03p] [Tolak] Pencabutan Kekuasaan Orang Tua - Dalil Permohonan Tidak Terbukti",
      "mohonNo": "[99p] [NO] Pencabutan Kekuasaan Orang Tua - Permohonan Tidak Dapat Diterima (Formil)"
    },
    "kodeMenuEkstensi": "kk"
  }
];

/** abt_menu.nama putusan -> folder (relatif derry_briantono), untuk FOLDER_MENU_PUTUSAN. */
export const FOLDER_MENU_W3B: Record<string, string> = {
  "Putusan Pencabutan Kekuasaan Orang Tua": "6d Pencabutan Kekuasaan Orang Tua"
};
