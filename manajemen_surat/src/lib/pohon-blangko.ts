/**
 * POHON BLANGKO - memilih berjenjang seperti panitera berpikir.
 *
 * ============================================================================
 * URUTANNYA URUTAN RUANG SIDANG
 * ============================================================================
 *
 * ABT terasa wajar karena alurnya sama dengan alur berpikir panitera:
 *
 *   Cerai Gugat -> Verstek -> BAS 2 -> P Hadir & T Tidak Hadir -> Putusan Verstek
 *   jenis perkara  jalannya   sidang       siapa yang hadir         apa hasilnya
 *
 * Daftar datar berisi dua belas nama berkas menuntut panitera membaca semuanya
 * lalu menyaring sendiri. Jenjang menuntutnya menjawab satu pertanyaan pada
 * satu waktu - dan tiap pertanyaannya memang pertanyaan yang sudah ada
 * jawabannya di kepalanya sebelum ia membuka ALETA.
 *
 * Tugas tiap set (putusan -> hakim, BAS -> panitera, relaas -> juru sita) dibaca
 * dari nama foldernya - lihat lib/tugas-blangko.ts dan setBlangkoGabung().
 *
 * ============================================================================
 * JENJANGNYA DIBACA DARI NAMA BERKAS
 * ============================================================================
 *
 * Nomor sidang, keadaan kehadiran, dan tindakan diuraikan bot dari nama berkas
 * blangko - bukan dari daftar yang ditulis tangan di sini. Daftar tulisan
 * tangan harus dijaga tetap cocok dengan folder yang isinya berubah tanpa
 * sepengetahuan ALETA, dan begitu keduanya berselisih yang muncul di layar
 * adalah blangko yang tidak ada, atau blangko yang ada tetapi tidak terlihat.
 *
 * Yang memang ditulis di sini hanyalah SET mana untuk jenis perkara apa - itu
 * penilaian, bukan data, dan tidak dapat dibaca dari nama folder.
 */

import { folderTugas, tugasBlangko, type TugasBlangko } from "@/lib/tugas-blangko";

export type BlangkoItem = {
  berkas: string;
  kode: string;
  kategori: string;
  eCourt: boolean;
  judul: string;
  basKe: number;
  basVarian: string;
  keadaan: string;
  tindakan: string;
};

export type SetBlangko = {
  id: string;
  nama: string;
  folder: string;
  /**
   * BAS dijenjangkan menurut nomor sidang; putusan menurut skenario akhirnya.
   *
   * "relaas" TIDAK dijenjangkan sama sekali - hanya enam blangko, dan yang
   * memilihnya bukan jenjang pertanyaan melainkan KEADAAN perkaranya: sidang
   * pertama, sidang yang ditunda, atau putusan yang harus diberitahukan. Karena
   * itu ia tidak pernah melewati jenjangkan() maupun labelBlangko(), dan kedua
   * fungsi itu tetap menerima dua jenis saja.
   */
  jenis: "bas" | "putusan" | "relaas";
  /** Kata kunci jenis perkara SIPP yang cocok dengan set ini. */
  untuk: string[];
};

const AKAR = "derry_briantono";

/**
 * Set yang dipakai di pengadilan ini.
 *
 * Folder induk APS Badilag memuat 812 blangko dalam puluhan set warisan; yang
 * dipakai sehari-hari hanya sebagian. Menampilkan semuanya berarti panitera
 * menyaring sendiri tiap kali - dan daftar yang terlalu panjang berhenti
 * dibaca.
 */
export const SET_BLANGKO: SetBlangko[] = [
  {
    // Berlaku untuk SELURUH jenis perkara - `untuk: []` berarti tanpa
    // penyaringan jenis perkara, sebab setiap perkara dipanggil dan setiap
    // putusan yang pihaknya tidak hadir harus diberitahukan.
    id: "relaas-jurusita",
    nama: "Relaas Juru Sita",
    folder: `${AKAR}/Relaas`,
    jenis: "relaas",
    untuk: [],
  },
  {
    id: "bas-verstek",
    nama: "BAS Verstek Perceraian",
    folder: `${AKAR}/- BAS VERSTEK PERCERAIAN -`,
    jenis: "bas",
    untuk: ["cerai gugat", "cerai talak"],
  },
  {
    id: "bas-contra",
    nama: "BAS Contra Perceraian",
    folder: `${AKAR}/- BAS CONTRA PERCERAIAN -`,
    jenis: "bas",
    untuk: ["cerai gugat", "cerai talak"],
  },
  {
    id: "bas-itsbat",
    nama: "BAS Itsbat Nikah",
    folder: `${AKAR}/- BAS ITSTBAT NIKAH -`,
    jenis: "bas",
    untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
  },
  {
    id: "bas-anak",
    nama: "BAS Asal Usul Anak",
    folder: `${AKAR}/- BAS ASAL USUL ANAK -`,
    jenis: "bas",
    untuk: ["asal usul anak"],
  },
  {
    id: "putusan-cg",
    nama: "Putusan Cerai Gugat",
    folder: `${AKAR}/1 Perceraian CG`,
    jenis: "putusan",
    untuk: ["cerai gugat"],
  },
  {
    id: "putusan-ct",
    nama: "Putusan Cerai Talak",
    folder: `${AKAR}/1a Perceraian CT`,
    jenis: "putusan",
    untuk: ["cerai talak"],
  },
  {
    id: "putusan-kumulasi",
    nama: "Putusan Perceraian Kumulasi Itsbat",
    folder: `${AKAR}/1c Perceraian Kumulasi Itsbat Nikah`,
    jenis: "putusan",
    untuk: ["cerai gugat", "cerai talak", "istbat nikah", "itsbat nikah"],
  },
  {
    id: "putusan-itsbat",
    nama: "Penetapan Itsbat Nikah",
    folder: `${AKAR}/2 Itsbat Nikah`,
    jenis: "putusan",
    untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
  },
  {
    id: "putusan-dispensasi",
    nama: "Penetapan Dispensasi Kawin",
    folder: `${AKAR}/3 Dispensasi Kawin`,
    jenis: "putusan",
    untuk: ["dispensasi kawin"],
  },
  {
    id: "putusan-kebendaan",
    nama: "Putusan Kebendaan",
    folder: `${AKAR}/4 Kebendaan`,
    jenis: "putusan",
    untuk: ["harta bersama", "kewarisan", "waris", "p3hp", "ahli waris", "wasiat"],
  },
  {
    id: "putusan-perwalian",
    nama: "Penetapan Perwalian",
    folder: `${AKAR}/6 Perwalian`,
    jenis: "putusan",
    untuk: ["perwalian", "wali"],
  },
];

/* === S 13 Okt === */
/**
 * TUGAS tiap set dibaca dari folder-nya dengan aturan lib/tugas-blangko.ts (putusan -> hakim, BAS -> panitera,
 * relaas -> juru sita). Daftar tulisan tangan di atas TIDAK lagi satu-satunya: folder grup Derry yang ditemukan di
 * server (blangko.katalog atas derry_briantono) dan belum tertulis di sini menjadi set baru menurut aturan yang sama -
 * blangko yang ditambah kemudian (mis. putusan per jenis x status) ikut terpetakan tanpa menyunting berkas ini.
 */
export function tugasSet(set: Pick<SetBlangko, "folder">): TugasBlangko | "" {
  return tugasBlangko(set.folder);
}

/** Set dari satu folder grup Derry menurut aturan; null bila bukan putusan/BAS/relaas (mis. PTSP) atau tak terbaca. */
export function setDariFolder(direktori: string, akar: string = AKAR): SetBlangko | null {
  const f = folderTugas(direktori, akar);
  if (!f || f.jenis === "ptsp") return null;
  const id = `${f.jenis}-${direktori.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  return { id, nama: `${f.jenis === "putusan" ? "Putusan" : f.jenis === "bas" ? "BAS" : "Relaas"} ${f.nama}`.replace(/^(Putusan|BAS) \1 /i, "$1 "), folder: f.folder, jenis: f.jenis, untuk: f.untuk };
}

/**
 * SET_BLANGKO + set dari folder yang ditemukan dan belum tertulis (urutan: tertulis dulu, lalu temuan menurut
 * urutan alami). Folder yang sama tidak pernah dua kali; folder tersembunyi ("_...") dan PTSP dilewati.
 */
export function setBlangkoGabung(direktoriDitemukan: string[], akar: string = AKAR): SetBlangko[] {
  const ada = new Set(SET_BLANGKO.map((s) => s.folder));
  const baru: SetBlangko[] = [];
  for (const d of [...(direktoriDitemukan || [])].sort((a, b) => a.localeCompare(b, "id", { numeric: true }))) {
    const s = setDariFolder(d, akar);
    if (!s || ada.has(s.folder)) continue;
    ada.add(s.folder);
    baru.push(s);
  }
  return [...SET_BLANGKO, ...baru];
}
/* === AKHIR S === */

/**
 * Set yang sesuai jenis perkara, diurutkan yang paling cocok lebih dulu.
 *
 * Yang tidak cocok TIDAK dibuang, hanya turun. Perkara kadang menuntut blangko
 * yang tidak lazim, dan set yang disembunyikan berarti panitera harus keluar
 * dari ALETA untuk mengambilnya - lalu tidak kembali.
 */

// ===========================================================================
// RELAAS JURU SITA - ENAM BLANGKO, DAN YANG MEMILIHNYA KEADAAN PERKARA
// ===========================================================================
//
// Diminta pengguna 25 September 2026: mendeteksi di SIPP panggilan untuk
// SIDANG PERTAMA, SIDANG YANG DITUNDA, dan PEMBERITAHUAN PUTUSAN, lalu
// mengambil blangkonya dari ABT.
//
// ===========================================================================
// NAMA BERKASNYA DIAMBIL BYTE PER BYTE, BUKAN DITULIS DARI DAFTAR YANG TERLIHAT
// ===========================================================================
//
// `[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf` punya SATU SPASI
// sebelum `.rtf`. Ia tidak terlihat pada daftar folder mana pun, dan menyalin
// nama itu dari tampilan menghasilkan pencarian yang tidak pernah ketemu -
// tanpa satu pun galat, sebab "blangko tidak ada" adalah jawaban yang sah.
// Nama di bawah dibaca dengan os.listdir lalu dicetak sebagai repr.
//
// ===========================================================================
// PIHAK MANA YANG DIPANGGIL - DARI dihadiri_oleh, BUKAN DARI TEBAKAN
// ===========================================================================
//
// Sidang yang ditunda tidak memanggil semua orang lagi: yang dipanggil justru
// yang TIDAK hadir. Arti sandinya dibaca dari BORANG SIPP SENDIRI -
// application/views/perkara_tab/jadwal_sidang_p_edit.php, <select
// name="dihadiri_oleh"> - bukan dari tafsiran ALETA:
//
//   1  Semua Pihak             -> TIDAK dipanggil ("tidak-perlu")
//   2  <Pihak Pertama> Saja    -> panggil PIHAK KEDUA
//   3  <Pihak Kedua> Saja      -> panggil PIHAK PERTAMA
//   4  Para Pihak Tidak Hadir  -> panggil KEDUANYA
//   5, 7, 8, 9, 13, 14, 15     kombinasi dengan Intervensi / Turut Tergugat
//   10, 11                     Sebagian Penggugat / Sebagian Tergugat
//
// Yang hadir di persidangan diperintahkan datang lagi DI MUKA SIDANG, jadi
// tidak dipanggil dengan relaas. Sampai 25 September 2026 sandi 1 di sini
// dijawab "tidak diketahui" - dan itu 7.486 dari 20.109 baris jadwal sidang
// yang disodorkan kepada juru sita sebagai pertanyaan, padahal SIPP sudah
// menjawabnya.
//
// Terukur di sipp_donggala 25 September 2026 atas 20.109 baris jadwal sidang:
// nilai 2 sebanyak 10.041, nilai 1 sebanyak 7.486, KOSONG 1.354, nilai 4
// sebanyak 1.055, nilai 3 sebanyak 169, dan nilai 10 sebanyak 4.
//
// PERHATIAN pada yang KOSONG. notifikasi.js menjatuhkan 1, kosong, dan 10 ke
// satu golongan "semua". Untuk memberi tahu itu tidak merugikan; untuk
// MEMANGGIL ia merugikan - 1.354 baris yang kehadirannya tidak tercatat akan
// terbaca "semua hadir" lalu tidak dipanggil sama sekali. Karena itu di sini
// kosong dijawab "tidak diketahui", dan yang tidak diketahui DITANYAKAN kepada
// juru sitanya, tidak diputuskan sendiri. Begitu pula 5 sampai 15: pihak ketiga
// atau "sebagian" tidak dapat dipetakan ke satu blangko tanpa melihat
// perkaranya.
export type KeadaanRelaas =
  | "sidang-pertama"
  | "sidang-ditunda"
  | "pemberitahuan-putusan"
  | "ikrar-talak"
  | "delegasi"
  | "amplop";

/**
 * "tidak-perlu" BUKAN "tidak-diketahui": yang pertama jawaban SIPP (semua pihak
 * hadir, jadi tidak ada yang dipanggil), yang kedua ketiadaan jawaban (yang
 * harus ditanyakan). Menyatukan keduanya membuat juru sita ditanya tentang
 * 7.486 sidang yang jawabannya sudah tercatat.
 */
export type PihakDipanggil = "keduanya" | "pertama" | "kedua" | "tidak-perlu" | "tidak-diketahui";

export type BlangkoRelaas = {
  keadaan: KeadaanRelaas;
  /** Nama berkas APA ADANYA di folder ABT - termasuk spasi yang tak terlihat. */
  berkas: string;
  label: string;
  /** Pihak yang blangko ini tujukan; "keduanya" berarti satu berkas dua pihak. */
  pihak: PihakDipanggil;
  keterangan: string;
  /**
   * Folder ABT tempat berkasnya berada, relatif terhadap _blangko_abt.
   *
   * Tidak semua relaas satu folder. Sejak 26 September 2026 blangko ikrar
   * dipindah ke menu ABT 25 "Relaas Ikrar Talak" (_ikrar_talak/2 Relaas
   * Ikrar Talak): di menu Relaas (hak aksesnya dibaca dari menu 900, proses
   * 80-220) perkara yang sudah sampai tahap ikrar - proses 290 ke atas -
   * SELALU ditolak ABT.
   */
  folder: string;
  /**
   * Rentang proses_terakhir_id yang diterima menu ABT pemilik foldernya
   * (abt_menu.proses_id_min/max). Di luar rentang itu ABT menolak mencetak.
   */
  menuAbt: { nama: string; prosesMin: number; prosesMax: number };
};

const FOLDER_RELAAS = `${AKAR}/Relaas`;
/** Menu ABT 25 "Relaas Ikrar Talak" - folder dibuat di laptop 26 Sep 2026. */
export const FOLDER_RELAAS_IKRAR = "_ikrar_talak/2 Relaas Ikrar Talak";
/**
 * Hak akses folder Relaas dibaca ABT dari menu 900 (derry_briantono), BUKAN
 * menu 981 "Relaas dan PBT": hak_akses_menu mengambil baris pertama dari
 * `direktori="Relaas" or direktori="derry_briantono"`, dan collation tanpa
 * beda huruf besar-kecil menaruh 900 lebih dulu. Keduanya berentang 80-220.
 *
 * 13 Okt 2026: paket ABT abt-blangko-derry-rapi membuka baris 900 untuk juru
 * sita (600|650) dan PTSP, proses 20-1000 - sesudah paket itu terpasang ABT
 * tidak lagi menolak juru sita di folder ini, dan relaas e-Court serta amplop
 * dari grup "Blangko Jurusita Donggala" ikut berada di folder Relaas ([JS] 5-8).
 */
const MENU_RELAAS = { nama: "Relaas dan PBT (Blangko Derry)", prosesMin: 80, prosesMax: 220 } as const;
const MENU_RELAAS_IKRAR = { nama: "Relaas Ikrar Talak", prosesMin: 290, prosesMax: 600 } as const;

// ===========================================================================
// PERBAIKAN 6 OKT 2026 (BUTIR 10) - BLANGKO PER PIHAK, GABUNGAN HANYA CADANGAN
// ===========================================================================
//
// Pengguna: relaas sidang pertama, sidang lanjutan, dan pemberitahuan putusan
// HARUS sesuai pihaknya - Penggugat/Pemohon memakai blangko "P", Tergugat/
// Termohon blangko "T" - dan blangko gabungan dipakai HANYA bila memang hanya
// itu yang ada (ikrar talak, delegasi). Folder derry_briantono/Relaas di ABT
// satker (dibaca `ls -b` 6 Okt 2026, server) kini berisi blangko per pihak:
//
//   [JS] 0. Relaas Panggilan Sidang Pertama P.rtf / ... T.rtf
//   [JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf / ... T ...
//   [JS] 2. Relaas Pemberitahuan Putusan P.rtf / ... T.rtf
//   [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf
//   [JS] 3.b. Relaas Panggilan Sidang P dan T.rtf          (gabungan)
//   [JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf       (hanya gabungan)
//   [JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf
//
// Nama "T (Sidang Lanjutan)" di server TIDAK lagi berspasi sebelum ".rtf"
// (spasi itu milik salinan laptop 25 Sep), dan "2. Relaas Pemberitahuan
// Putusan.rtf" tanpa P/T sudah tidak ada. Satu blangko per (keadaan, pihak);
// blangko gabungan 3.b berkeadaan sidang-pertama berpihak "keduanya" dan hanya
// terpilih untuk SATU dokumen yang memanggil kedua pihak sekaligus - rute
// cetak memecah dokumen seperti itu menjadi dua dokumen per pihak lebih dulu
// (pecahDokumenPerPihak, relaas-massal/cetak/pemetaan-cetak.ts).
export const BLANGKO_RELAAS: BlangkoRelaas[] = [
  {
    keadaan: "sidang-pertama",
    berkas: "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf",
    label: "Panggilan sidang pertama (P)",
    pihak: "pertama",
    keterangan: "Sidang pertama, untuk Penggugat/Pemohon - satu relaas per pihak.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "sidang-pertama",
    berkas: "[JS] 0. Relaas Panggilan Sidang Pertama T.rtf",
    label: "Panggilan sidang pertama (T)",
    pihak: "kedua",
    keterangan: "Sidang pertama, untuk Tergugat/Termohon - satu relaas per pihak.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "sidang-pertama",
    berkas: "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf",
    label: "Panggilan sidang P dan T (gabungan)",
    pihak: "keduanya",
    keterangan:
      "Blangko gabungan dua pihak - CADANGAN: hanya untuk satu dokumen yang memanggil kedua pihak sekaligus, " +
      "bila blangko per pihak tidak tersedia.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "sidang-ditunda",
    berkas: "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
    label: "Panggilan sidang lanjutan (P)",
    pihak: "pertama",
    keterangan: "Sidang yang ditunda memanggil yang TIDAK hadir - blangko ini untuk Penggugat/Pemohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "sidang-ditunda",
    berkas: "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
    label: "Panggilan sidang lanjutan (T)",
    pihak: "kedua",
    keterangan: "Sidang yang ditunda memanggil yang TIDAK hadir - blangko ini untuk Tergugat/Termohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "pemberitahuan-putusan",
    berkas: "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
    label: "Pemberitahuan isi putusan (P)",
    pihak: "pertama",
    keterangan: "Pemberitahuan isi putusan kepada Penggugat/Pemohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "pemberitahuan-putusan",
    berkas: "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
    label: "Pemberitahuan isi putusan (T)",
    pihak: "kedua",
    keterangan: "Pemberitahuan isi putusan kepada Tergugat/Termohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "ikrar-talak",
    berkas: "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf",
    label: "Panggilan ikrar talak (P dan T)",
    pihak: "keduanya",
    keterangan:
      "Dipakai bila jadwal sidangnya berpenanda ikrar_talak = 'Y' - terukur 1.024 dari 20.109 baris jadwal.",
    folder: FOLDER_RELAAS_IKRAR,
    menuAbt: MENU_RELAAS_IKRAR,
  },
  {
    keadaan: "delegasi",
    berkas: "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf",
    label: "Permohonan bantuan panggilan (delegasi)",
    pihak: "tidak-diketahui",
    keterangan:
      "Bukan relaas, melainkan surat ke pengadilan lain - dipakai bila pihaknya di luar wilayah. Yang menilai orang, bukan aturan: alamat di luar wilayah tidak selalu berarti delegasi.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "amplop",
    berkas: "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf",
    label: "Amplop panggilan surat tercatat",
    pihak: "tidak-diketahui",
    keterangan:
      "Pendamping panggilan yang dikirim lewat pos tercatat - terukur 3.104 baris relaas bersandi S pada 1.431 perkara.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
];

/**
 * Sandi kehadiran SIPP -> pihak yang harus dipanggil pada sidang berikutnya.
 *
 * 1 (Semua Pihak) dijawab "tidak-perlu" - itu jawaban SIPP, lihat kepala
 * bagian ini. Kosong dan sandi yang tidak dikenal dijawab "tidak-diketahui"
 * DENGAN SENGAJA. Menjatuhkannya ke "keduanya" akan mencetak panggilan yang
 * tidak diperlukan; menjatuhkannya ke "tidak-perlu" akan MELEWATKAN panggilan
 * yang diperlukan. Keduanya salah, dan yang benar menanyakannya kepada juru
 * sita. Kosong tidak memerlukan cabang sendiri: Number(null) dan Number("")
 * sama-sama 0, dan 0 bukan sandi borang mana pun.
 */
export function pihakDipanggil(dihadiriOleh: unknown): PihakDipanggil {
  const n = Number(dihadiriOleh);
  if (n === 1) return "tidak-perlu";
  if (n === 4) return "keduanya";
  if (n === 3) return "pertama";
  if (n === 2) return "kedua";
  return "tidak-diketahui";
}

/**
 * Blangko untuk satu keadaan, beserta pihak yang dipanggilnya.
 *
 * Sidang yang ditunda dengan KEDUA pihak tidak hadir memakai blangko sidang
 * pertama - bukan karena ia sidang pertama, melainkan karena hanya blangko itu
 * yang memuat dua pihak sekaligus. Itu keputusan, dan karena itu ditulis di
 * sini alih-alih disembunyikan di dalam gelung pencetak.
 */
export function blangkoRelaas(
  keadaan: KeadaanRelaas,
  pihak: PihakDipanggil = "tidak-diketahui"
): BlangkoRelaas | null {
  // Semua pihak hadir: tidak ada yang dipanggil ulang dan tidak ada yang perlu
  // diberi tahu isi putusan yang dibacakan di hadapannya. Sidang pertama dan
  // ikrar talak TIDAK tunduk pada aturan ini - blangkonya selalu dua pihak,
  // dan kehadiran yang dibaca untuknya milik sidang yang belum terjadi.
  if (pihak === "tidak-perlu" && (keadaan === "sidang-ditunda" || keadaan === "pemberitahuan-putusan")) {
    return null;
  }
  // Per pihak lebih dulu (6 Okt, butir 10): blangko yang pihaknya TEPAT.
  if (pihak === "pertama" || pihak === "kedua") {
    const tepat = BLANGKO_RELAAS.find((x) => x.keadaan === keadaan && x.pihak === pihak);
    if (tepat) return tepat;
  }
  // Satu dokumen untuk dua pihak (sidang ditunda yang tidak dihadiri siapa pun,
  // atau sidang pertama yang belum dipecah): hanya blangko gabungan yang memuat
  // keduanya - 3.b berkeadaan sidang-pertama.
  if (pihak === "keduanya" && (keadaan === "sidang-ditunda" || keadaan === "sidang-pertama")) {
    return BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-pertama" && x.pihak === "keduanya") ?? null;
  }
  // Keadaan yang hanya punya satu blangko (ikrar - gabungan, delegasi, amplop)
  // atau pihak yang belum diketahui: blangko pertama keadaan itu.
  return BLANGKO_RELAAS.find((x) => x.keadaan === keadaan) ?? null;
}

/** Blangko bawaan untuk satu keadaan dan satu sisi pihak (1 = P, 2 = T) - tanpa aturan kehadiran. */
export function blangkoRelaasPerPihak(keadaan: KeadaanRelaas, sisi: "pertama" | "kedua"): BlangkoRelaas | null {
  return BLANGKO_RELAAS.find((x) => x.keadaan === keadaan && x.pihak === sisi) ?? null;
}

/**
 * Golongan yang dikirim bot -> keadaan blangko.
 *
 * Bot membedakan "sidang-ditunda" (sidang yang ditunda) dari "sidang-lanjutan"
 * (sidang bernomor lebih dari satu yang tidak berpenanda ditunda). Bagi juru
 * sita keduanya SATU pekerjaan - memanggil untuk sidang berikutnya yang bukan
 * sidang pertama - dan ABT hanya punya satu blangko untuknya, yang judulnya
 * pun "(Sidang Lanjutan)". Sebelum pemetaan ini 16 dari 156 baris hidup tidak
 * mendapat blangko sama sekali.
 *
 * Golongan yang tidak dikenal dijawab null, bukan ditebak.
 */
export function keadaanUntukGolongan(golongan: unknown): KeadaanRelaas | null {
  switch (String(golongan ?? "")) {
    case "sidang-pertama":
      return "sidang-pertama";
    case "sidang-ditunda":
    case "sidang-lanjutan":
      return "sidang-ditunda";
    case "ikrar-talak":
      return "ikrar-talak";
    case "pemberitahuan-putusan":
      return "pemberitahuan-putusan";
    default:
      return null;
  }
}

/** Jalur penuh blangko relaas di dalam folder ABT - menurut folder blangkonya sendiri. */
export function jalurBlangkoRelaas(berkas: string): string {
  const folder = BLANGKO_RELAAS.find((x) => x.berkas === berkas)?.folder ?? FOLDER_RELAAS;
  return `${folder}/${berkas}`;
}

/** Folder-folder ABT yang memuat blangko relaas, tanpa ganda, dalam urutan katalog. */
export function folderBlangkoRelaas(): string[] {
  return [...new Set(BLANGKO_RELAAS.map((x) => x.folder))];
}

/** Set yang memang dijenjangkan - relaas tidak termasuk. */
export type SetBerjenjang = Omit<SetBlangko, "jenis"> & { jenis: "bas" | "putusan" };

/**
 * Set untuk satu jenis perkara.
 *
 * SET RELAAS DIKECUALIKAN DENGAN SENGAJA. Ia bukan dipilih menurut JENIS
 * perkara melainkan menurut KEADAANNYA - sidang pertama, sidang yang ditunda,
 * atau putusan yang harus diberitahukan - dan ia punya panelnya sendiri. Kalau
 * ia ikut di sini, pemilih BAS akan menawarkan blangko yang pertanyaan
 * penjenjangnya tidak berlaku sama sekali.
 *
 * Tipe pulangnya ikut MENYEMPIT, sehingga jenjangkan() dan labelBlangko() tidak
 * dapat dipanggil atas set relaas walau seseorang lupa menyaringnya - tsc yang
 * menahannya, bukan kewaspadaan.
 */
export function setUntukPerkara(jenisPerkara: string): Array<SetBerjenjang & { cocok: boolean }> {
  const jenis = String(jenisPerkara || "").toLowerCase();

  const dinilai = SET_BLANGKO.filter(
    (set): set is SetBerjenjang => set.jenis !== "relaas"
  ).map((set) => ({
    ...set,
    cocok: Boolean(jenis) && set.untuk.some((kata) => jenis.includes(kata)),
  }));

  // BAS lebih dulu dalam kelompok yang cocok: halaman ini alat bantu tulis BAS,
  // dan yang paling sering dibuka memang BAS sidang hari ini.
  return dinilai.sort((a, b) => {
    if (a.cocok !== b.cocok) return a.cocok ? -1 : 1;
    if (a.jenis !== b.jenis) return a.jenis === "bas" ? -1 : 1;
    return 0;
  });
}

export type Jenjang = {
  kunci: string;
  label: string;
  /** Keterangan singkat di bawah label - kosong bila tidak menambah apa pun. */
  keterangan: string;
  blangko: BlangkoItem[];
};

function urutkanAlami(a: string, b: string): number {
  return a.localeCompare(b, "id", { numeric: true });
}

/**
 * Menyusun katalog satu set menjadi jenjang kedua.
 *
 * BAS dijenjangkan menurut NOMOR SIDANG - itulah yang pertama diketahui
 * panitera saat sidang dimulai. Putusan dijenjangkan menurut SKENARIO AKHIR,
 * karena putusan baru disusun setelah hasilnya diketahui.
 */
export function jenjangkan(jenis: "bas" | "putusan", blangko: BlangkoItem[]): Jenjang[] {
  const kelompok = new Map<string, Jenjang>();

  for (const item of blangko) {
    const kunci =
      jenis === "bas"
        ? item.basKe > 0
          ? `sidang-${item.basKe}`
          : "lainnya"
        : item.kategori
          ? item.kategori.toLowerCase()
          : "lainnya";

    const label =
      jenis === "bas"
        ? item.basKe > 0
          ? `Sidang ke-${item.basKe}`
          : "Lainnya"
        : item.kategori || "Lainnya";

    if (!kelompok.has(kunci)) kelompok.set(kunci, { kunci, label, keterangan: "", blangko: [] });
    kelompok.get(kunci)!.blangko.push(item);
  }

  const hasil = [...kelompok.values()];
  for (const tingkat of hasil) {
    tingkat.blangko.sort((a, b) => urutkanAlami(a.berkas, b.berkas));
    tingkat.keterangan = `${tingkat.blangko.length} blangko`;
  }

  // "Lainnya" selalu terakhir. Ia bukan tingkat sesungguhnya melainkan tempat
  // singgah bagi nama berkas yang tidak mengikuti pola - dan menaruhnya di awal
  // berarti hal yang paling jarang dipakai berdiri paling depan.
  return hasil.sort((a, b) => {
    if ((a.kunci === "lainnya") !== (b.kunci === "lainnya")) return a.kunci === "lainnya" ? 1 : -1;
    return urutkanAlami(a.label, b.label);
  });
}

/**
 * Nama yang terbaca untuk satu blangko di dalam jenjangnya.
 *
 * Nomor sidang tidak diulang - ia sudah menjadi nama tingkatnya. Yang tersisa
 * justru yang membedakan satu blangko dari tetangganya: siapa yang hadir, dan
 * apa yang terjadi.
 */
export function labelBlangko(jenis: "bas" | "putusan", item: BlangkoItem): string {
  const bagian = jenis === "bas" ? [item.keadaan, item.tindakan] : [item.keadaan, item.tindakan];
  const gabung = bagian.filter(Boolean).join(" — ");
  return gabung || item.judul || item.berkas;
}

/**
 * Set PUTUSAN yang cocok dengan jenis perkara - untuk pemetaan blangko
 * ekstensi, yang memilih satu berkas per jenis. BAS sengaja tidak ikut:
 * ia dijenjangkan per sidang, bukan per skenario akhir, dan bukan yang
 * dicetak sebagai putusan.
 */
export function setPutusanUntukPerkara(jenisPerkara: string): SetBlangko[] {
  return setUntukPerkara(jenisPerkara).filter((set) => set.cocok && set.jenis === "putusan");
}

export type UsulanBerkas = {
  berkas: string;
  kategori: string;
  kunciJenjang: string;
};

/**
 * Satu berkas yang layak menjadi BAWAAN pemetaan dari jenjang putusan.
 *
 * Pilihannya SKENARIO KABUL - "Kabul", "Kabul Verstek", "Kabul Contra" -
 * sebab itulah yang paling sering dicetak, dan yang salah pilih paling
 * murah diganti: pemetaan hanya bawaan, tiap perkara masih dapat memilih
 * blangkonya sendiri. Di dalam skenario itu diambil yang PERTAMA menurut
 * urutan alami nama berkas, sehingga "[01] ..." mendahului "[01ab] ...".
 * Bila tidak ada satu pun jenjang kabul, jatuh ke berkas pertama pada
 * jenjang pertama yang bukan "lainnya" - dan bila hanya "lainnya" yang ada,
 * dijawab null: menebak dari nama yang tidak berpola bukan bawaan, melainkan
 * tebakan.
 */
export function usulanPutusanDariJenjang(jenjang: Jenjang[]): UsulanBerkas | null {
  const bukanLainnya = jenjang.filter((j) => j.kunci !== "lainnya" && j.blangko.length > 0);
  const kabul = bukanLainnya.find((j) => /^kabul(?: |$)/.test(j.kunci));
  const dipilih = kabul ?? bukanLainnya[0];
  if (!dipilih) return null;
  // "[01]" mendahului "[01b]" dan "[01ab]": kode yang lebih pendek adalah
  // induknya, varian berhuruf adalah turunannya. Kolasi lokal tidak
  // dipercaya untuk membedakan "]" dari "b"; panjang kodenya yang dipercaya.
  const item = [...dipilih.blangko].sort((a, b) => {
    const ka = String(a.kode || "").length;
    const kb = String(b.kode || "").length;
    if (ka !== kb && ka > 0 && kb > 0) return ka - kb;
    return urutkanAlami(a.berkas, b.berkas);
  })[0];
  return { berkas: item.berkas, kategori: item.kategori, kunciJenjang: dipilih.kunci };
}
