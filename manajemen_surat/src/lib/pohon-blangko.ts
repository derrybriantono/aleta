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
  /**
   * I7 17 Okt: kata kunci jenis yang cocok HANYA bila nomor perkaranya gugatan (Pdt.G): gugatan hak asuh PA Donggala didaftarkan sebagai
   * "Lain-Lain" (jenis 369) bernomor Pdt.G, sedangkan "Lain-Lain" Pdt.P adalah pengangkatan anak (set 9a).
   */
  untukGugatan?: string[];
  /**
   * F22 17 Okt: syarat nomor perkara untuk jenis yang sama-sama bergugatan dua acara. Ekonomi syariah: "10 Ekonomi Syariah" = gugatan sederhana
   * (Pdt.G.S), "10a Ekonomi Syariah Biasa" = acara biasa (Pdt.G). abt_menu hanya punya SATU kolom acuan jenis (370), jadi ABT menampilkan
   * keduanya; ALETA memilih menurut nomor. Nomor belum diketahui: kedua set cocok.
   */
  syaratNomor?: "gugatan-sederhana" | "gugatan-biasa";
};

/** Pdt.G.S = gugatan sederhana; Pdt.G (bukan .G.S) = gugatan acara biasa; selain itu (Pdt.P ...) bukan gugatan; kosong/tak terbaca = "". */
export function acaraNomorPerkara(nomor: unknown): "gugatan-sederhana" | "gugatan-biasa" | "permohonan" | "" {
  const n = String(nomor ?? "");
  if (/\/Pdt\.G\.S\//i.test(n)) return "gugatan-sederhana";
  if (/\/Pdt\.G\//i.test(n)) return "gugatan-biasa";
  if (/\/Pdt\.P\//i.test(n)) return "permohonan";
  return "";
}

/** Set ini cocok untuk jenis perkara (dan nomornya bila diketahui)? Sama dengan penilaian setUntukPerkara. */
export function setCocokPerkara(set: Pick<SetBlangko, "untuk" | "untukGugatan" | "syaratNomor">, jenisPerkara: string, nomorPerkara?: unknown): boolean {
  const jenis = String(jenisPerkara || "").toLowerCase();
  if (!jenis) return false;
  const acara = acaraNomorPerkara(nomorPerkara);
  const gugatan = acara === "gugatan-sederhana" || acara === "gugatan-biasa";
  const cocokJenis = set.untuk.some((kata) => jenis.includes(kata)) || (gugatan && Boolean(set.untukGugatan?.some((kata) => jenis.includes(kata))));
  if (!cocokJenis) return false;
  if (set.syaratNomor && acara && acara !== set.syaratNomor) return false;
  return true;
}

const AKAR = "derry_briantono";
/**
 * 16 Okt 2026 malam (paket ABT abt-ganti-nama-relaas-ptsp): folder "Relaas" -> "98 Relaas" dan "PTSP" -> "99 PTSP".
 * ABT membaca hak folder lewat `direktori=<folder> OR direktori="derry_briantono" LIMIT 1` (urut indeks); nama tanpa
 * awalan angka memakai baris 900 (hak longgar), bukan baris 981/991 sendiri. Bot menerima kedua nama selama peralihan
 * (sippReadOnlyBridgeService jalurBlangkoAman), jadi portal yang terpasang lebih dulu/belakangan tetap membaca berkasnya.
 */
export const FOLDER_RELAAS_NAMA = "98 Relaas";
export const FOLDER_PTSP_NAMA = "99 PTSP";

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
    folder: `${AKAR}/${FOLDER_RELAAS_NAMA}`,
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
  // F3 14 Okt: set "Putusan Kebendaan" (folder "4 Kebendaan") dihapus - paket ABT abt-susunan-satu-folder memindahkan
  // satu-satunya isinya (HB Kabul) ke "4a Harta Bersama" dan menghapus folder lamanya. "4a Harta Bersama", "4b Kewarisan",
  // "9 Penetapan Ahli Waris" kini datang dari folder yang ditemukan di server (setBlangkoGabung), dengan jenis perkara masing-masing.
  {
    id: "putusan-perwalian",
    nama: "Penetapan Perwalian",
    folder: `${AKAR}/6 Perwalian`,
    jenis: "putusan",
    // I2 16 Okt: "wali" dilepas - wali adhal kini punya set sendiri (di bawah) dan tidak boleh mendapat blangko perwalian lebih dulu.
    untuk: ["perwalian"],
  },
  {
    // I2 16 Okt (paket ABT abt-wali-adhal): folder baru, menu 113 "Putusan Wali Adhal" / alias "Wali Adhal - Putusan".
    id: "putusan-wali-adhal",
    nama: "Penetapan Wali Adhal",
    folder: `${AKAR}/7 Wali Adhal`,
    jenis: "putusan",
    untuk: ["wali adhal", "wali adhol", "wali adlal"],
  },
  // F21 17 Okt 2026 (paket ABT abt-hak-asuh-derry, abt-pembatalan-perkawinan-derry, abt-ekonomi-syariah-derry): tiga jenis baru, masing-masing
  // sepasang folder "<jenis>" (menu putusan 133/135/137, hakim) dan "<jenis> - BAS" (menu 134/136/138, panitera).
  {
    // Hak asuh anak (gugatan penguasaan anak): jenis SIPP 349 "Penguasaan Anak"; PA Donggala mendaftarkannya di 369 "Lain-Lain" (Pdt.G).
    id: "putusan-hak-asuh",
    nama: "Putusan Hak Asuh Anak (Hadhanah)",
    folder: `${AKAR}/6a Hak Asuh Anak (Hadhanah)`,
    jenis: "putusan",
    untuk: ["penguasaan anak", "hak asuh", "hadhanah"],
    // I7 17 Okt: menu 133/134 kini jenis_perkara_id 369 ("Lain-Lain") saja; cocok hanya untuk Lain-Lain bernomor Pdt.G (bukan pengangkatan anak Pdt.P).
    untukGugatan: ["lain-lain"],
  },
  {
    id: "putusan-pembatalan-perkawinan",
    nama: "Putusan Pembatalan Perkawinan",
    folder: `${AKAR}/5a Pembatalan Perkawinan`,
    jenis: "putusan",
    untuk: ["pembatalan perkawinan"],
  },
  {
    // Gugatan sederhana (Pdt.G.S, PERMA 2/2015 jo. 4/2019); acara biasa (Pdt.G) = set "putusan-ekonomi-syariah-biasa" di bawah (F22 17 Okt).
    id: "putusan-ekonomi-syariah",
    nama: "Putusan Ekonomi Syariah (Gugatan Sederhana)",
    folder: `${AKAR}/10 Ekonomi Syariah`,
    jenis: "putusan",
    untuk: ["ekonomi syariah"],
    syaratNomor: "gugatan-sederhana", // F22 17 Okt: acara biasa (Pdt.G) = "10a Ekonomi Syariah Biasa"
  },
  // F22 17 Okt 2026 (paket ABT abt-pencegahan-nikah-derry, abt-wasiat-derry, abt-es-biasa-derry): pasangan folder putusan (menu 139/141/143, hakim) dan
  // "<jenis> - BAS" (menu 140/142/144, panitera). Pencegahan = permohonan (Pdt.P) jenis 342 - PENETAPAN; wasiat jenis 365; ES acara biasa jenis 370 nomor Pdt.G.
  {
    id: "putusan-pencegahan-perkawinan",
    nama: "Penetapan Pencegahan Perkawinan",
    folder: `${AKAR}/5b Pencegahan Perkawinan`,
    jenis: "putusan",
    untuk: ["pencegahan perkawinan", "pencegahan nikah"],
  },
  {
    id: "putusan-wasiat",
    nama: "Putusan Wasiat",
    folder: `${AKAR}/4c Wasiat`,
    jenis: "putusan",
    untuk: ["wasiat"],
  },
  {
    // abt_menu hanya punya satu kolom acuan jenis (370): perkara ES melihat "10" DAN "10a"; ALETA memilih menurut nomor (Pdt.G -> set ini, Pdt.G.S -> "10").
    id: "putusan-ekonomi-syariah-biasa",
    nama: "Putusan Ekonomi Syariah (Acara Biasa)",
    folder: `${AKAR}/10a Ekonomi Syariah Biasa`,
    jenis: "putusan",
    untuk: ["ekonomi syariah"],
    syaratNomor: "gugatan-biasa",
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
  return {
    id,
    nama: `${f.jenis === "putusan" ? "Putusan" : f.jenis === "bas" ? "BAS" : "Relaas"} ${f.nama}`.replace(/^(Putusan|BAS) \1 /i, "$1 "),
    folder: f.folder,
    jenis: f.jenis,
    untuk: f.untuk,
    ...syaratDariFolder(direktori),
  };
}

/** I7/F22 17 Okt: syarat nomor perkara yang terbaca dari NAMA folder (hak asuh = Lain-Lain Pdt.G; ekonomi syariah sederhana vs biasa). */
function syaratDariFolder(direktori: string): Pick<SetBlangko, "untukGugatan" | "syaratNomor"> {
  const d = String(direktori || "");
  if (/hak\s+asuh|hadh?anah/i.test(d)) return { untukGugatan: ["lain-lain"] };
  if (/ekonomi\s+syariah\s+biasa/i.test(d)) return { syaratNomor: "gugatan-biasa" };
  if (/ekonomi\s+syariah/i.test(d)) return { syaratNomor: "gugatan-sederhana" };
  return {};
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
  | "amplop"
  // Q3 16 Okt 2026: amplop pendamping per pihak ([JS] 8.1.x panggilan sidang, 8.2.x pemberitahuan putusan, 8.3.x panggilan ikrar).
  | "amplop-panggilan"
  | "amplop-putusan"
  | "amplop-ikrar"
  // I2 16 Okt 2026 (paket ABT abt-mediasi-derry): panggilan pertemuan mediasi per pihak ([JS] 10.1 / 10.2).
  | "mediasi"
  // 14 Okt 2026: pengumuman permohonan itsbat nikah VOLUNTAIR (jenis 360, alur
  // 16) - dicetak bersama panggilan sidang pertama. Bukan relaas kepada pihak:
  // blangkonya dipilih menurut JUMLAH PEMOHON (lib/pengumuman-itsbat.ts).
  | "pengumuman-itsbat";

/**
 * "tidak-perlu" BUKAN "tidak-diketahui": yang pertama jawaban SIPP (semua pihak
 * hadir, jadi tidak ada yang dipanggil), yang kedua ketiadaan jawaban (yang
 * harus ditanyakan). Menyatukan keduanya membuat juru sita ditanya tentang
  // I14 18 Okt 2026 (paket ABT abt-relaas-pencegahan-derry): panggilan sidang PENCEGAHAN PERKAWINAN (jenis 342, Pdt.P alur 16)
  // [JS] 11.1 (Pemohon), 11.2 (calon suami), 11.3 (calon istri). Dipilih menurut JENIS perkara, bukan menurut keadaan sidang.
  | "pencegahan-perkawinan"
 * 7.486 sidang yang jawabannya sudah tercatat.
 */
export type PihakDipanggil = "keduanya" | "pertama" | "kedua" | "tidak-perlu" | "tidak-diketahui";

export type BlangkoRelaas = {
  keadaan: KeadaanRelaas;
  /** Nama berkas APA ADANYA di folder ABT - termasuk spasi yang tak terlihat. */
  berkas: string;
  label: string;
  /** Pihak yang blangko ini tujukan; "keduanya" berarti satu berkas dua pihak. */
  pihak: PihakBlangkoRelaas;
  keterangan: string;
  /**
/**
 * I14 18 Okt: calon mempelai BUKAN pihak SIPP (hanya Pemohon yang tercatat sebagai pihak pada Pdt.P pencegahan perkawinan; calon suami
 * dan calon istri dipanggil untuk didengar menurut Pasal 17 ayat (2) UU 1/1974 jo. Pasal 65 ayat (2) KHI), jadi ia pihak blangko saja.
 */
export type PihakBlangkoRelaas = PihakDipanggil | "calon-mempelai";

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
  /** Pengumuman itsbat saja: jumlah Pemohon yang dimuat blangko (2 = suami & istri, 1 = pasangan telah meninggal). */
  pemohon?: 1 | 2;
  /**
   * Q3 16 Okt: blangko untuk perkara yang didaftarkan lewat e-Court (perkara_efiling_id) - tidak pernah dipilih untuk perkara non e-Court,
   * dan blangko bukan e-Court tidak pernah dipilih untuk dokumen yang `lewatEcourt` bila ada padanan e-Court-nya (blangkoRelaas).
   */
  ecourt?: true;
  /** Pemberitahuan putusan VERSTEK saja ([JS] 6.2): dipilih hanya bila putusannya verstek. */
  verstek?: true;
  /** Pencegahan perkawinan ([JS] 11.2/11.3) saja: calon mempelai yang dipanggil untuk didengar (bukan pihak SIPP; identitas dari isian ABT). */
  calon?: "suami" | "istri";
};

/** Q3 16 Okt: keadaan perkara yang menentukan pilihan blangko relaas selain pihak (dari bot: lewatEcourt dan verstekPutusan). */
export type OpsiBlangkoRelaas = {
  lewatEcourt?: boolean | null;
  verstek?: boolean | null;
  /** I14 18 Okt: jenis_perkara_id perkara (bot: jenisPerkaraId); 342 = Pencegahan Perkawinan -> relaas [JS] 11.x. Kosong/tak terbaca = perilaku lama. */
  jenisPerkaraId?: number | string | null;
};

/** jenis_perkara_id SIPP "Pencegahan Perkawinan" (Pdt.P, alur 16). */
export const JENIS_PENCEGAHAN_PERKAWINAN = 342;
export function jenisPencegahanPerkawinan(jenisPerkaraId: unknown): boolean {
  return Number(jenisPerkaraId) === JENIS_PENCEGAHAN_PERKAWINAN;
}

const FOLDER_RELAAS = `${AKAR}/${FOLDER_RELAAS_NAMA}`;
/** Menu ABT 25 "Relaas Ikrar Talak" - folder dibuat di laptop 26 Sep 2026. */
export const FOLDER_RELAAS_IKRAR = "_ikrar_talak/2 Relaas Ikrar Talak";
/**
 * SEJARAH (sampai 16 Okt 2026): hak akses folder "Relaas" dibaca ABT dari menu 900
 * (derry_briantono), BUKAN menu 981 "Relaas dan PBT": hak_akses_menu mengambil baris
 * pertama dari `direktori="Relaas" or direktori="derry_briantono"`, dan collation tanpa
 * beda huruf besar-kecil menaruh 900 lebih dulu. Sejak paket abt-ganti-nama-relaas-ptsp
 * foldernya "98 Relaas" dan baris 981 sendiri yang berlaku: HANYA juru sita (600) +
 * Super Admin, tanpa cek penunjukan, proses 20-1000, alur 15-17 (= rentang yang berlaku).
 *
 * 13 Okt 2026: paket ABT abt-blangko-derry-rapi membuka baris 900 untuk juru
 * sita (600|650) dan PTSP, proses 20-1000 - sesudah paket itu terpasang ABT
 * tidak lagi menolak juru sita di folder ini, dan relaas e-Court serta amplop
 * dari grup "Blangko Jurusita Donggala" ikut berada di folder Relaas ([JS] 5-8).
 */
const MENU_RELAAS = { nama: "Relaas dan PBT (Blangko Derry)", prosesMin: 80, prosesMax: 220 } as const;
const MENU_RELAAS_IKRAR = { nama: "Relaas Ikrar Talak", prosesMin: 290, prosesMax: 600 } as const;
/**
 * Q3 16 Okt: relaas ikrar e-Court ([JS] 7) dan amplop ikrar ([JS] 8.3.x) berada di folder Relaas (bukan _ikrar_talak) dan dicetak untuk perkara
 * yang SUDAH sampai tahap ikrar (proses 290 ke atas). Paket ABT abt-blangko-derry-rapi (13 Okt) membuka baris menu 900 untuk juru sita dan PTSP
 * proses 20-1000 (lihat komentar MENU_RELAAS di atas) - rentang itu dipakai di sini. Bila ABT setempat belum terpasang paket itu, ABT menolak
 * mencetak (sebabnya disebut nilaiCetakDokumen); diperiksa sesudah pemasangan.
 */
const MENU_RELAAS_LUAS = { nama: "Relaas dan PBT (Blangko Derry)", prosesMin: 20, prosesMax: 1000 } as const;

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
  // 14 Okt 2026 (paket ABT abt-pengumuman-itsbat, variabel 9100-9104): pengumuman
  // permohonan itsbat nikah voluntair, 14 hari di papan pengumuman, dicetak juru
  // sita bersama panggilan sidang pertama. Pihaknya "tidak-diketahui" seperti
  // delegasi/amplop - bukan relaas kepada satu pihak; yang membedakan kedua
  // blangko adalah jumlah Pemohon (perkara_pihak1).
  {
    keadaan: "pengumuman-itsbat",
    berkas: "[JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf",
    label: "Pengumuman itsbat nikah (2 Pemohon)",
    pihak: "tidak-diketahui",
    keterangan:
      "Itsbat nikah voluntair (Pdt.P) sidang pertama - suami Pemohon I dan istri Pemohon II; " +
      "ditempel 14 hari di papan pengumuman pengadilan.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
    pemohon: 2,
  },
  {
    keadaan: "pengumuman-itsbat",
    berkas: "[JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon).rtf",
    label: "Pengumuman itsbat nikah (1 Pemohon)",
    pihak: "tidak-diketahui",
    keterangan:
      "Itsbat nikah voluntair (Pdt.P) sidang pertama dengan satu Pemohon - pasangannya telah meninggal " +
      "(nama almarhum/almarhumah dari isian ABT 1025).",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
    pemohon: 1,
  },
  // ==========================================================================
  // Q3 16 OKT 2026 - SET e-COURT DAN AMPLOP (peta perkara L3 15 Okt, kesenjangan bagian 4)
  // ==========================================================================
  //
  // Folder derry_briantono/Relaas memuat [JS] 5.1/5.2 (panggilan sidang e-Court), 6.2 (pemberitahuan putusan verstek T e-Court), 7 (panggilan
  // ikrar e-Court), dan amplop 8.1.1-8.3.2, tetapi BLANGKO_RELAAS dulu hanya mengenal [JS] 0-4 dan 9: 10 berkas tak terpetakan, termasuk
  // 2.196 perkara e-Court (84% perkara 2024-2026). Entri di bawah diberi `ecourt`; dipilih blangkoRelaas HANYA bila dokumennya lewatEcourt.
  // Sidang lanjutan e-Court memakai 5.1/5.2 yang sama (tidak ada blangko lanjutan e-Court). Entri disimpan sesudah blangko lama supaya
  // pencarian lama (urutan pertama) tetap mendarat di blangko non e-Court.
  {
    keadaan: "sidang-pertama",
    berkas: "[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf",
    label: "Panggilan sidang e-Court (P)",
    pihak: "pertama",
    keterangan: "Perkara e-Court (domisili elektronik): panggilan sidang pertama dan lanjutan untuk Penggugat/Pemohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
    ecourt: true,
  },
  {
    keadaan: "sidang-pertama",
    berkas: "[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf",
    label: "Panggilan sidang e-Court (T)",
    pihak: "kedua",
    keterangan: "Perkara e-Court (surat tercatat): panggilan sidang pertama dan lanjutan untuk Tergugat/Termohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
    ecourt: true,
  },
  {
    keadaan: "pemberitahuan-putusan",
    berkas: "[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf",
    label: "Pemberitahuan putusan verstek e-Court (T)",
    pihak: "kedua",
    keterangan: "Perkara e-Court yang diputus VERSTEK: pemberitahuan isi putusan kepada Tergugat/Termohon (1.072 perkara). Non-verstek: [JS] 2.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
    ecourt: true,
    verstek: true,
  },
  {
    keadaan: "ikrar-talak",
    berkas: "[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf",
    label: "Panggilan ikrar talak e-Court (T)",
    pihak: "kedua",
    keterangan:
      "Perkara cerai talak e-Court: panggilan sidang ikrar talak kepada Termohon. Relaas ikrar untuk Pemohon e-Court belum ada di Derry.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS_LUAS,
    ecourt: true,
  },
  {
    keadaan: "amplop-panggilan",
    berkas: "[JS] 8.1.1. Amplop Relaas Panggilan Sidang P.rtf",
    label: "Amplop panggilan sidang (P)",
    pihak: "pertama",
    keterangan: "Amplop pendamping relaas panggilan sidang non e-Court untuk Penggugat/Pemohon (e-Court memakai amplop surat tercatat).",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "amplop-panggilan",
    berkas: "[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf",
    label: "Amplop panggilan sidang (T)",
    pihak: "kedua",
    keterangan: "Amplop pendamping relaas panggilan sidang non e-Court untuk Tergugat/Termohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "amplop-putusan",
    berkas: "[JS] 8.2.1. Amplop Relaas Pemberitahuan Putusan P.rtf",
    label: "Amplop pemberitahuan putusan (P)",
    pihak: "pertama",
    keterangan: "Amplop pendamping pemberitahuan isi putusan untuk Penggugat/Pemohon (2.070 perkara).",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "amplop-putusan",
    berkas: "[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf",
    label: "Amplop pemberitahuan putusan (T)",
    pihak: "kedua",
    keterangan: "Amplop pendamping pemberitahuan isi putusan untuk Tergugat/Termohon (1.605 perkara).",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "amplop-ikrar",
    berkas: "[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P.rtf",
    label: "Amplop panggilan ikrar talak (P)",
    pihak: "pertama",
    keterangan: "Amplop pendamping panggilan sidang ikrar talak untuk Pemohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS_LUAS,
  },
  {
    keadaan: "amplop-ikrar",
    berkas: "[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf",
    label: "Amplop panggilan ikrar talak (T)",
    pihak: "kedua",
    keterangan: "Amplop pendamping panggilan sidang ikrar talak untuk Termohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS_LUAS,
  },
  // ==========================================================================
  // I2 16 OKT 2026 - RELAAS PANGGILAN MEDIASI (paket ABT abt-mediasi-derry)
  // ==========================================================================
  // Hari/tanggal/jam/tempat pertemuan otomatis dari SIPP perkara_jadwal_mediasi (jadwal terakhir); pihak berkuasa dipanggil lewat kuasanya.
  {
    keadaan: "mediasi",
    berkas: "[JS] 10.1. Relaas Panggilan Mediasi P.rtf",
    label: "Panggilan mediasi (P)",
    pihak: "pertama",
    keterangan: "Panggilan pertemuan mediasi untuk Penggugat/Pemohon yang tidak hadir saat mediasi dijadwalkan.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "mediasi",
    berkas: "[JS] 10.2. Relaas Panggilan Mediasi T.rtf",
    label: "Panggilan mediasi (T)",
    pihak: "kedua",
    keterangan: "Panggilan pertemuan mediasi untuk Tergugat/Termohon yang tidak hadir saat mediasi dijadwalkan.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
];

/** Blangko non e-Court saja - pencarian bawaan lama tidak boleh mendarat di blangko e-Court (Q3 16 Okt). */
const BLANGKO_BIASA = () => BLANGKO_RELAAS.filter((x) => !x.ecourt);

/** Blangko pengumuman itsbat menurut jumlah Pemohon: satu Pemohon = 1P, selebihnya (termasuk tak terbaca) = 2P. */
export function blangkoPengumumanItsbat(jumlahPemohon: unknown): BlangkoRelaas {
  const satu = Number(jumlahPemohon) === 1;
  return BLANGKO_BIASA().find((x) => x.keadaan === "pengumuman-itsbat" && x.pemohon === (satu ? 1 : 2))!;
  // ==========================================================================
  // I14 18 OKT 2026 - RELAAS PANGGILAN SIDANG PENCEGAHAN PERKAWINAN (paket ABT abt-relaas-pencegahan-derry)
  // ==========================================================================
  // Menu ABT 981 (folder 98 Relaas, alur 15-17, grup 600 jurusita) sudah meliputi alur 16: tanpa menu/hak baru. Berlaku untuk sidang pertama
  // DAN sidang lanjutan. Pemohon = pihak SIPP pihak 1 (boleh berkuasa/e-Court); calon suami (isian #1029#) dan calon istri (isian #9460#) tidak
  // ada di daftar pihak SIPP - alamat dan "bertemu dengan" berupa titik-titik jurusita. Jenis lain memakai [JS] 0./1. P/T seperti biasa.
  {
    keadaan: "pencegahan-perkawinan",
    berkas: "[JS] 11.1. Relaas Panggilan Sidang Pencegahan Perkawinan - Pemohon.rtf",
    label: "Panggilan sidang pencegahan perkawinan (Pemohon)",
    pihak: "pertama",
    keterangan: "Pencegahan perkawinan (Pdt.P): panggilan sidang pertama dan lanjutan untuk Pemohon.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "pencegahan-perkawinan",
    berkas: "[JS] 11.2. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Suami.rtf",
    label: "Panggilan sidang pencegahan perkawinan (calon suami)",
    pihak: "calon-mempelai",
    calon: "suami",
    keterangan:
      "Pencegahan perkawinan: calon suami dipanggil untuk didengar (Pasal 17 ayat (2) UU 1/1974 jo. Pasal 65 ayat (2) KHI); identitas dari isian ABT 1029.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
  {
    keadaan: "pencegahan-perkawinan",
    berkas: "[JS] 11.3. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Istri.rtf",
    label: "Panggilan sidang pencegahan perkawinan (calon istri)",
    pihak: "calon-mempelai",
    calon: "istri",
    keterangan:
      "Pencegahan perkawinan: calon istri dipanggil untuk didengar (Pasal 17 ayat (2) UU 1/1974 jo. Pasal 65 ayat (2) KHI); identitas dari isian ABT 9460.",
    folder: FOLDER_RELAAS,
    menuAbt: MENU_RELAAS,
  },
}

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
  pihak: PihakDipanggil = "tidak-diketahui",
  /** Q3 16 Okt: perkara e-Court / putusan verstek memilih set e-Court ([JS] 5.1, 5.2, 6.2, 7); tanpa opsi = perilaku lama. */
  opsi?: OpsiBlangkoRelaas
): BlangkoRelaas | null {
  // Pengumuman itsbat (14 Okt): dokumennya membawa jumlah Pemohon lewat
  // pihakDipanggil - "pertama" = satu Pemohon (1P), selain itu 2P. Lihat
  // dokumenPengumumanItsbat di lib/pengumuman-itsbat.ts.
  if (keadaan === "pengumuman-itsbat") return blangkoPengumumanItsbat(pihak === "pertama" ? 1 : 2);
  // Semua pihak hadir: tidak ada yang dipanggil ulang dan tidak ada yang perlu
  // diberi tahu isi putusan yang dibacakan di hadapannya. Sidang pertama dan
  // ikrar talak TIDAK tunduk pada aturan ini - blangkonya selalu dua pihak,
  // dan kehadiran yang dibaca untuknya milik sidang yang belum terjadi.
  if (pihak === "tidak-perlu" && (keadaan === "sidang-ditunda" || keadaan === "pemberitahuan-putusan" || keadaan === "mediasi")) {
    return null;
  }
  // Q3 16 Okt: perkara e-Court memakai set e-Court bila ada padanannya; yang tidak ada jatuh ke blangko biasa di bawah.
  if (opsi?.lewatEcourt === true) {
    const ec = blangkoEcourt(keadaan, pihak, opsi);
    if (ec) return ec;
  }
  // Per pihak lebih dulu (6 Okt, butir 10): blangko yang pihaknya TEPAT.
  if (pihak === "pertama" || pihak === "kedua") {
    const tepat = BLANGKO_BIASA().find((x) => x.keadaan === keadaan && x.pihak === pihak);
    if (tepat) return tepat;
  // I14 18 Okt: pencegahan perkawinan (jenis 342) - Pemohon dipanggil dengan [JS] 11.1, sidang pertama maupun lanjutan, lewat e-Court sekalipun
  // (blangko 5.1 tidak memuat perkara pencegahan). "keduanya" ikut: Pdt.P hanya punya satu pihak SIPP, sandi 4 tetap berarti Pemohon.
  const pencegahan = blangkoPencegahanPemohon(keadaan, pihak, opsi);
  if (pencegahan) return pencegahan;
  }
  // Satu dokumen untuk dua pihak (sidang ditunda yang tidak dihadiri siapa pun,
  // atau sidang pertama yang belum dipecah): hanya blangko gabungan yang memuat
  // keduanya - 3.b berkeadaan sidang-pertama.
  if (pihak === "keduanya" && (keadaan === "sidang-ditunda" || keadaan === "sidang-pertama")) {
    return BLANGKO_BIASA().find((x) => x.keadaan === "sidang-pertama" && x.pihak === "keduanya") ?? null;
  }
  // Keadaan yang hanya punya satu blangko (ikrar - gabungan, delegasi, amplop)
  // atau pihak yang belum diketahui: blangko pertama keadaan itu.
  return BLANGKO_BIASA().find((x) => x.keadaan === keadaan) ?? null;
}

/**
 * Q3 16 Okt: blangko set e-Court untuk satu keadaan dan pihak, atau null bila tidak ada padanannya (lalu dipakai blangko biasa).
 *   - sidang pertama / ditunda: [JS] 5.1 (pihak pertama) / 5.2 (pihak kedua); dokumen "keduanya" dipecah per pihak lebih dulu oleh rute cetak;
 *   - pemberitahuan putusan: [JS] 6.2 hanya untuk Tergugat/Termohon bila putusannya VERSTEK; selainnya [JS] 2 biasa;
 *   - ikrar talak: [JS] 7 (Termohon). Relaas ikrar untuk Pemohon e-Court belum ada di Derry.
 */
function blangkoEcourt(keadaan: KeadaanRelaas, pihak: PihakDipanggil, opsi?: OpsiBlangkoRelaas): BlangkoRelaas | null {
  const ec = BLANGKO_RELAAS.filter((x) => x.ecourt);
  if (keadaan === "sidang-pertama" || keadaan === "sidang-ditunda") {
/**
 * I14 18 Okt: [JS] 11.1 untuk Pemohon perkara pencegahan perkawinan (jenis 342) pada sidang pertama / lanjutan; null bila bukan jenis itu
 * atau keadaannya lain (pemberitahuan putusan, ikrar, mediasi tetap blangko biasa).
 */
function blangkoPencegahanPemohon(keadaan: KeadaanRelaas, pihak: PihakDipanggil, opsi?: OpsiBlangkoRelaas): BlangkoRelaas | null {
  if (!jenisPencegahanPerkawinan(opsi?.jenisPerkaraId)) return null;
  if (keadaan !== "sidang-pertama" && keadaan !== "sidang-ditunda") return null;
  if (pihak !== "pertama" && pihak !== "keduanya") return null;
  return BLANGKO_RELAAS.find((x) => x.keadaan === "pencegahan-perkawinan" && x.pihak === "pertama") ?? null;
}

/**
 * I14 18 Okt: blangko panggilan untuk calon suami / calon istri perkara pencegahan perkawinan ([JS] 11.2 / 11.3). Calon mempelai bukan pihak
 * SIPP, jadi tidak lewat blangkoRelaas(): pemanggilnya menambahkan satu baris per calon bila isian ABT (1029 / 9460) sudah diisi.
 */
export function blangkoCalonMempelai(calon: "suami" | "istri"): BlangkoRelaas {
  return BLANGKO_RELAAS.find((x) => x.keadaan === "pencegahan-perkawinan" && x.calon === calon)!;
}

    if (pihak !== "pertama" && pihak !== "kedua") return null;
    return ec.find((x) => x.keadaan === "sidang-pertama" && x.pihak === pihak) ?? null;
  }
  if (keadaan === "pemberitahuan-putusan") {
    if (pihak !== "kedua" || opsi?.verstek !== true) return null;
    return ec.find((x) => x.keadaan === "pemberitahuan-putusan" && x.verstek) ?? null;
  }
  if (keadaan === "ikrar-talak") {
    if (pihak !== "kedua" && pihak !== "keduanya") return null;
    return ec.find((x) => x.keadaan === "ikrar-talak") ?? null;
  }
  return null;
}

/**
 * Q3 16 Okt: amplop pendamping relaas ([JS] 8.1.x panggilan sidang, 8.2.x pemberitahuan putusan, 8.3.x ikrar talak) untuk satu sisi pihak.
 * Perkara e-Court: Penggugat/Pemohon dipanggil elektronik (tanpa amplop), Tergugat/Termohon dengan surat tercatat -> amplop surat tercatat.
 */
export function blangkoAmplopPendamping(
  keadaan: KeadaanRelaas,
  sisi: "pertama" | "kedua",
  opsi?: OpsiBlangkoRelaas
): BlangkoRelaas | null {
  const cari = (k: KeadaanRelaas) => BLANGKO_RELAAS.find((x) => x.keadaan === k && x.pihak === sisi) ?? null;
  if (keadaan === "sidang-pertama" || keadaan === "sidang-ditunda") {
    if (opsi?.lewatEcourt === true) {
      return sisi === "kedua" ? (BLANGKO_RELAAS.find((x) => x.keadaan === "amplop") ?? null) : null;
    }
    return cari("amplop-panggilan");
  }
  if (keadaan === "pemberitahuan-putusan") return cari("amplop-putusan");
  if (keadaan === "ikrar-talak") return cari("amplop-ikrar");
  return null;
}

/** Blangko bawaan untuk satu keadaan dan satu sisi pihak (1 = P, 2 = T) - tanpa aturan kehadiran. */
export function blangkoRelaasPerPihak(keadaan: KeadaanRelaas, sisi: "pertama" | "kedua", opsi?: OpsiBlangkoRelaas): BlangkoRelaas | null {
  if (opsi?.lewatEcourt === true) {
    const ec = blangkoEcourt(keadaan, sisi, opsi);
    if (ec) return ec;
  }
  return BLANGKO_BIASA().find((x) => x.keadaan === keadaan && x.pihak === sisi) ?? null;
}

/**
 * Golongan yang dikirim bot -> keadaan blangko.
  const pencegahan = blangkoPencegahanPemohon(keadaan, sisi, opsi);
  if (pencegahan) return pencegahan;
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
    case "pengumuman-itsbat":
      return "pengumuman-itsbat";
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
export function setUntukPerkara(jenisPerkara: string, nomorPerkara?: unknown): Array<SetBerjenjang & { cocok: boolean }> {
  const dinilai = SET_BLANGKO.filter(
    (set): set is SetBerjenjang => set.jenis !== "relaas"
  ).map((set) => ({
    ...set,
    cocok: setCocokPerkara(set, jenisPerkara, nomorPerkara),
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
export function setPutusanUntukPerkara(jenisPerkara: string, nomorPerkara?: unknown): SetBlangko[] {
  return setUntukPerkara(jenisPerkara, nomorPerkara).filter((set) => set.cocok && set.jenis === "putusan");
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
