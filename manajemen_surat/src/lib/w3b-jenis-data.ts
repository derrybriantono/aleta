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
      "id": "alur-70",
      "nomor": 70,
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
  },
  {
    "kunci": "355",
    "idJenis": 355,
    "kunciPeta": "pencabutan kekuasaan wali",
    "namaSipp": "Pencabutan Kekuasaan Wali",
    "label": "pencabutan kekuasaan wali",
    "folder": "6e Pencabutan Kekuasaan Wali",
    "folderBas": "6e Pencabutan Kekuasaan Wali - BAS",
    "menuPutusan": {
      "id": 242,
      "nama": "Putusan Pencabutan Kekuasaan Wali",
      "alias": "Pencabutan Kuasa Wali - Putusan"
    },
    "menuBas": {
      "id": 243,
      "nama": "Pencabutan Kekuasaan Wali - BAS",
      "alias": "Pencabutan Kuasa Wali - BAS"
    },
    "alur": {
      "id": "alur-71",
      "nomor": 71,
      "namaPendek": "Pencabutan Perwalian"
    },
    "gugatan": true,
    "permohonan": true,
    "perdamaian": false,
    "berkas": {
      "kabul": "[01] [Kabul] Pencabutan Kekuasaan Wali - Kontradiktoir",
      "setelahMediasi": "[01a] [Kabul] Pencabutan Kekuasaan Wali - T Tidak Hadir Setelah Mediasi",
      "verstek": "[01b] [Kabul Verstek] Pencabutan Kekuasaan Wali",
      "tolak": "[03] [Tolak] Pencabutan Kekuasaan Wali - Kontradiktoir - Dalil Tidak Terbukti",
      "tolakVerstek": "[03b] [Tolak Verstek] Pencabutan Kekuasaan Wali - Dalil Tidak Terbukti",
      "gugur": "[98a] [Gugur] Pencabutan Kekuasaan Wali - P Tidak Hadir Sidang Pertama",
      "cabutSesudahJawaban": "[98b] [Cabut] Pencabutan Kekuasaan Wali - Sesudah Jawaban dengan Persetujuan T",
      "cabut": "[98] [Cabut] Pencabutan Kekuasaan Wali - P & T Hadir Sebelum Jawaban",
      "coret": "[98c] [Coret] Pencabutan Kekuasaan Wali - Dibatalkan dari Pendaftaran - Panjar Habis",
      "noFormil": "[99a] [NO] Pencabutan Kekuasaan Wali - Kurang Pihak (Plurium Litis Consortium)",
      "noKabur": "[99b] [NO] Pencabutan Kekuasaan Wali - Gugatan Kabur (Obscuur Libel)",
      "noSema": "[99] [NO] Pencabutan Kekuasaan Wali - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
      "mohonKabul": "[01p] [Kabul] Pencabutan Kekuasaan Wali - Permohonan (Pemohon Hadir)",
      "mohonTolak": "[03p] [Tolak] Pencabutan Kekuasaan Wali - Dalil Permohonan Tidak Terbukti",
      "mohonNo": "[99p] [NO] Pencabutan Kekuasaan Wali - Permohonan Tidak Dapat Diterima (Formil)"
    },
    "kodeMenuEkstensi": "kw"
  },
  {
    "kunci": "356",
    "idJenis": 356,
    "kunciPeta": "penunjukan orang lain sebagai wali oleh pengadilan",
    "namaSipp": "Penunjukan orang lain sebagai Wali oleh Pengadilan",
    "label": "penunjukan wali oleh pengadilan",
    "folder": "6f Penunjukan Wali oleh Pengadilan",
    "folderBas": "6f Penunjukan Wali oleh Pengadilan - BAS",
    "menuPutusan": {
      "id": 244,
      "nama": "Putusan Penunjukan Wali oleh Pengadilan",
      "alias": "Penunjukan Wali - Putusan"
    },
    "menuBas": {
      "id": 245,
      "nama": "Penunjukan Wali oleh Pengadilan - BAS",
      "alias": "Penunjukan Wali - BAS"
    },
    "alur": {
      "id": "alur-72",
      "nomor": 72,
      "namaPendek": "Penunjukan Wali"
    },
    "gugatan": false,
    "permohonan": true,
    "perdamaian": false,
    "berkas": {
      "mohonKabul": "[01p] [Kabul] Penunjukan Wali oleh Pengadilan - Permohonan (Pemohon Hadir)",
      "mohonTolak": "[03p] [Tolak] Penunjukan Wali oleh Pengadilan - Dalil Permohonan Tidak Terbukti",
      "mohonNo": "[99p] [NO] Penunjukan Wali oleh Pengadilan - Permohonan Tidak Dapat Diterima (Formil)"
    },
    "kodeMenuEkstensi": "pw"
  },
  {
    "kunci": "357",
    "idJenis": 357,
    "kunciPeta": "ganti rugi terhadap wali",
    "namaSipp": "Ganti Rugi terhadap Wali",
    "label": "ganti rugi terhadap wali",
    "folder": "6g Ganti Rugi terhadap Wali",
    "folderBas": "6g Ganti Rugi terhadap Wali - BAS",
    "menuPutusan": {
      "id": 246,
      "nama": "Putusan Ganti Rugi terhadap Wali",
      "alias": "Ganti Rugi Wali - Putusan"
    },
    "menuBas": {
      "id": 247,
      "nama": "Ganti Rugi terhadap Wali - BAS",
      "alias": "Ganti Rugi Wali - BAS"
    },
    "alur": {
      "id": "alur-73",
      "nomor": 73,
      "namaPendek": "Ganti Rugi Wali"
    },
    "gugatan": true,
    "permohonan": false,
    "perdamaian": true,
    "berkas": {
      "kabul": "[01] [Kabul] Ganti Rugi terhadap Wali - Kontradiktoir",
      "setelahMediasi": "[01a] [Kabul] Ganti Rugi terhadap Wali - T Tidak Hadir Setelah Mediasi",
      "verstek": "[01b] [Kabul Verstek] Ganti Rugi terhadap Wali",
      "tolak": "[03] [Tolak] Ganti Rugi terhadap Wali - Kontradiktoir - Dalil Tidak Terbukti",
      "tolakVerstek": "[03b] [Tolak Verstek] Ganti Rugi terhadap Wali - Dalil Tidak Terbukti",
      "damai": "[97] [Perdamaian] Ganti Rugi terhadap Wali - Akta Perdamaian",
      "gugur": "[98a] [Gugur] Ganti Rugi terhadap Wali - P Tidak Hadir Sidang Pertama",
      "cabutSesudahJawaban": "[98b] [Cabut] Ganti Rugi terhadap Wali - Sesudah Jawaban dengan Persetujuan T",
      "cabut": "[98] [Cabut] Ganti Rugi terhadap Wali - P & T Hadir Sebelum Jawaban",
      "coret": "[98c] [Coret] Ganti Rugi terhadap Wali - Dibatalkan dari Pendaftaran - Panjar Habis",
      "noFormil": "[99a] [NO] Ganti Rugi terhadap Wali - Kurang Pihak (Plurium Litis Consortium)",
      "noKabur": "[99b] [NO] Ganti Rugi terhadap Wali - Gugatan Kabur (Obscuur Libel)",
      "noSema": "[99] [NO] Ganti Rugi terhadap Wali - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)"
    },
    "kodeMenuEkstensi": "gr"
  },
  {
    "kunci": "350",
    "idJenis": 350,
    "kunciPeta": "nafkah anak oleh ibu karena ayah tidak mampu",
    "namaSipp": "Nafkah Anak Oleh Ibu karena Ayah tidak mampu",
    "label": "nafkah anak oleh ibu karena ayah tidak mampu",
    "folder": "6h Nafkah Anak oleh Ibu",
    "folderBas": "6h Nafkah Anak oleh Ibu - BAS",
    "menuPutusan": {
      "id": 248,
      "nama": "Putusan Nafkah Anak oleh Ibu karena Ayah Tidak Mampu",
      "alias": "Nafkah Anak Ibu - Putusan"
    },
    "menuBas": {
      "id": 249,
      "nama": "Nafkah Anak oleh Ibu karena Ayah Tidak Mampu - BAS",
      "alias": "Nafkah Anak Ibu - BAS"
    },
    "alur": {
      "id": "alur-74",
      "nomor": 74,
      "namaPendek": "Nafkah Anak Ibu"
    },
    "gugatan": true,
    "permohonan": false,
    "perdamaian": true,
    "berkas": {
      "kabul": "[01] [Kabul] Nafkah Anak oleh Ibu - Kontradiktoir",
      "setelahMediasi": "[01a] [Kabul] Nafkah Anak oleh Ibu - T Tidak Hadir Setelah Mediasi",
      "verstek": "[01b] [Kabul Verstek] Nafkah Anak oleh Ibu",
      "tolak": "[03] [Tolak] Nafkah Anak oleh Ibu - Kontradiktoir - Dalil Tidak Terbukti",
      "tolakVerstek": "[03b] [Tolak Verstek] Nafkah Anak oleh Ibu - Dalil Tidak Terbukti",
      "damai": "[97] [Perdamaian] Nafkah Anak oleh Ibu - Akta Perdamaian",
      "gugur": "[98a] [Gugur] Nafkah Anak oleh Ibu - P Tidak Hadir Sidang Pertama",
      "cabutSesudahJawaban": "[98b] [Cabut] Nafkah Anak oleh Ibu - Sesudah Jawaban dengan Persetujuan T",
      "cabut": "[98] [Cabut] Nafkah Anak oleh Ibu - P & T Hadir Sebelum Jawaban",
      "coret": "[98c] [Coret] Nafkah Anak oleh Ibu - Dibatalkan dari Pendaftaran - Panjar Habis",
      "noFormil": "[99a] [NO] Nafkah Anak oleh Ibu - Kurang Pihak (Plurium Litis Consortium)",
      "noKabur": "[99b] [NO] Nafkah Anak oleh Ibu - Gugatan Kabur (Obscuur Libel)",
      "noSema": "[99] [NO] Nafkah Anak oleh Ibu - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)"
    },
    "kodeMenuEkstensi": "ni"
  },
  {
    "kunci": "eksekusi",
    "idJenis": null,
    "kunciPeta": "eksekusi",
    "namaSipp": "Eksekusi",
    "label": "eksekusi",
    "folder": "96 Eksekusi",
    "folderBas": "96 Eksekusi - BAS",
    "menuPutusan": {
      "id": 250,
      "nama": "Putusan Eksekusi",
      "alias": "Eksekusi - Putusan"
    },
    "menuBas": {
      "id": 251,
      "nama": "Eksekusi - BAS",
      "alias": "Eksekusi - BAS"
    },
    "alur": {
      "id": "alur-75",
      "nomor": 75,
      "namaPendek": "Eksekusi"
    },
    "gugatan": false,
    "permohonan": false,
    "perdamaian": false,
    "berkas": {},
    "kodeMenuEkstensi": "ek"
  },
  {
    "kunci": "verzet",
    "idJenis": null,
    "kunciPeta": "verzet",
    "namaSipp": "Verzet",
    "label": "perlawanan (verzet) atas putusan verstek",
    "folder": "96a Verzet",
    "folderBas": "96a Verzet - BAS",
    "menuPutusan": {
      "id": 252,
      "nama": "Putusan Verzet (Perlawanan atas Putusan Verstek)",
      "alias": "Verzet - Putusan"
    },
    "menuBas": {
      "id": 253,
      "nama": "Verzet (Perlawanan atas Putusan Verstek) - BAS",
      "alias": "Verzet - BAS"
    },
    "alur": {
      "id": "alur-76",
      "nomor": 76,
      "namaPendek": "Verzet"
    },
    "gugatan": false,
    "permohonan": false,
    "perdamaian": false,
    "berkas": {},
    "kodeMenuEkstensi": "vz"
  }
];

/** abt_menu.nama putusan -> folder (relatif derry_briantono), untuk FOLDER_MENU_PUTUSAN. */
export const FOLDER_MENU_W3B: Record<string, string> = {
  "Putusan Pencabutan Kekuasaan Orang Tua": "6d Pencabutan Kekuasaan Orang Tua",
  "Putusan Pencabutan Kekuasaan Wali": "6e Pencabutan Kekuasaan Wali",
  "Putusan Penunjukan Wali oleh Pengadilan": "6f Penunjukan Wali oleh Pengadilan",
  "Putusan Ganti Rugi terhadap Wali": "6g Ganti Rugi terhadap Wali",
  "Putusan Nafkah Anak oleh Ibu karena Ayah Tidak Mampu": "6h Nafkah Anak oleh Ibu",
  "Putusan Eksekusi": "96 Eksekusi",
  "Putusan Verzet (Perlawanan atas Putusan Verstek)": "96a Verzet"
};
