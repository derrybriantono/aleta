import {
  ambilBerkasGateway,
  ambilBerkasSippGateway,
  getGatewayArsipRincian,
  getGatewayRincianSidang,
  getGatewayStatusPerkara,
  type JenisBerkasSipp,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { type BerkasZip } from "@/server/shared/zip";
import { tabelCsv } from "@/lib/csv";
/* === STATUS-ZIP 12 Okt === */
// Daftar kategori hidup di lib/ supaya dialog pilihan di peramban memakai yang
// sama dengan penyusun ini; diekspor ulang agar pemanggil lama tidak berubah.
import {
  FOLDER_KATEGORI_ARSIP,
  KATEGORI_ARSIP,
  LABEL_KATEGORI_ARSIP,
  kategoriDariNama,
  uraiKategoriArsip,
  type KategoriArsip,
} from "@/lib/kategori-zip";
export {
  FOLDER_KATEGORI_ARSIP,
  KATEGORI_ARSIP,
  LABEL_KATEGORI_ARSIP,
  kategoriDariNama,
  uraiKategoriArsip,
  type KategoriArsip,
};
/* === AKHIR STATUS-ZIP === */
// Kalimat ringkasan yang SAMA dengan tombol "Salin ringkasan" di layar Status
// Perkara. ringkasStatus fungsi murni tanpa DOM, jadi ia dapat dipanggil di
// peladen - dan menulis kalimat kedua di sini berarti dua sumber kebenaran yang
// menyimpang diam-diam tanpa ada yang berbunyi.
import { ringkasStatus, type BahanRingkas } from "@/lib/ringkas-status";
// Tanggal yang DIBACA orang bergaya Indonesia - "Rabu, 07-10-2026" - sama
// dengan layarnya. Yang di NAMA berkas tetap ISO: itulah yang membuat
// penjelajah berkas mengurutkan isinya dengan benar.
import { tanggalDMY, tanggalHariPanjang } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * Penyusun ISI arsip "unduh seluruh perkara" - SATU sumber bagi dua pemakai.
 *
 * ============================================================================
 * KENAPA DIPISAH DARI RUTENYA - 30 SEPTEMBER 2026
 * ============================================================================
 *
 * Sampai 30 September 2026 seluruh penyusunan ini hidup di dalam GET rute
 * /api/aleta-ecourt/berkas-zip. Sinkron berkas perkara ke Google Drive (butir
 * 30) diminta berstruktur SAMA PERSIS dengan ZIP tombol "Unduh seluruh
 * perkara" di Status Perkara - folder, subfolder, dan nama berkasnya. Menyalin
 * penyusunnya berarti dua penyusun yang menyimpang diam-diam pada suntingan
 * berikutnya: yang di ZIP diperbaiki, yang di Drive tidak, dan tidak ada yang
 * berbunyi. Memanggil rutenya dari dalam tidak mungkin: rutenya menuntut sesi
 * peramban.
 *
 * Karena itu baris-barisnya DIPINDAH apa adanya ke sini, dan keduanya - rute
 * ZIP dan sinkron Drive - memanggil fungsi yang sama. Yang berubah hanya:
 *   - batas jumlah, ukuran, dan waktu kini pilihan pemanggil dengan bawaan
 *     yang sama persis (sinkron Drive tidak melewati nginx 120 detik);
 *   - "tidak ada berkas" pulang sebagai isiZip kosong, dan 404-nya dijawab
 *     rute seperti sebelumnya.
 * Kewenangan, jejak audit, dan penyusunan berkas ZIP-nya tetap di rute.
 */
/**
 * Batas jumlah berkas dalam satu ZIP.
 *
 * Dinaikkan dari 60 ke 150 pada 23 September 2026, sesudah dua sumber digabung.
 * Terukur di sipp_donggala: hanya SATU perkara yang relaas + resi + BAS-nya
 * melewati 60 - 273/Pdt.G/2026/PA.Dgl, dengan 41 relaas dan 8 sidang. Batas
 * lama akan memotongnya justru pada perkara yang paling membutuhkan arsip utuh.
 *
 * ============================================================================
 * URUTAN MENULIS MENENTUKAN SIAPA YANG DIBUANG - 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Batas ini ditegakkan oleh taruh() menurut URUTAN pemanggilan: yang datang
 * sesudah slot ke-150 habis tidak masuk. Folder "00 Data SIPP" dulu ditulis
 * PALING AKHIR, sesudah seluruh blok berkas 01-08 - sehingga pada perkara yang
 * berkasnya paling banyak, justru yang paling perlu diarsipkan utuh, folder
 * yang diminta pengguna dengan kalimatnya sendiri adalah satu-satunya yang
 * dibuang.
 *
 * Diukur ulang di sipp_donggala 25 September 2026 atas 273/Pdt.G/2026/PA.Dgl:
 * 41 relaas + 31 resi + 7 BAS + 6 penetapan = 85, ditambah gugatan dan dua
 * bentuk putusan = 88, ditambah ikrar talak dan arsip = 90. Data SIPP menambah
 * 27 entri (perkara.json + 26 CSV) dan RINGKASAN.txt satu lagi, jadi 118 dari
 * 150 - sisa 32 slot bagi e-Court, sementara SATU dokumen e-Court dapat
 * memakan DUA slot (pdf dan word).
 *
 * Yang dipilih: DATA SIPP DITULIS LEBIH DAHULU, bukan dikecualikan dari batas.
 * Sebabnya batas ini menjaga MEMORI portal, dan mengecualikan satu blok
 * darinya berarti melubangi penjagaan itu untuk seterusnya. Urutan menulis
 * tidak melubangi apa pun - ia hanya menyatakan mana yang lebih penting bila
 * memang harus memilih: 27 entri data seluruhnya beberapa ratus kilobyte,
 * sementara satu berkas pindaian arsip sendirian 2 sampai 28 MB.
 */
export const BATAS_BERKAS = 150;

/** Batas jumlah byte seluruh isi ZIP sebelum dipadatkan. */
export const BATAS_TOTAL_BYTE = 200 * 1024 * 1024;

/**
 * Batas waktu menunggu SATU berkas.
 *
 * ambilBerkasSippGateway memakai fetch polos tanpa batas waktu. Satu berkas
 * yang menggantung - dan di peladen ini ada satu inode XFS rusak yang membuat
 * pembacaan menggantung dengan EUCLEAN - akan menggantungkan seluruh
 * permintaan, bukan hanya berkas itu.
 */
export const BATAS_SATU_BERKAS_MS = Number(process.env.ALETA_ZIP_TIMEOUT_BERKAS_MS || 30_000);

/**
 * Batas waktu SELURUH penyusunan.
 *
 * Nginx di depan portal memutus permintaan yang diam lebih dari 120 detik -
 * deploy/nginx/aleta.conf baris 15 dan 32, deploy/nginx/aleta-container.conf
 * baris 20 dan 37. ZIP disusun penuh di memori lalu dikirim SEKALIGUS, jadi
 * seluruh penyusunan adalah keheningan bagi nginx: tidak satu byte pun
 * mengalir sampai berkas terakhir selesai ditarik.
 *
 * Batas per berkas 30 detik kali 150 berkas berarti 75 menit pada keadaan
 * terburuk, dan yang dilihat petugas bukan pesan galat melainkan unduhan yang
 * gagal tanpa sebab. Karena itu ada batas menyeluruh, dan yang tidak sempat
 * ditarik DISEBUTKAN di KETERANGAN.txt - perlakuannya sama dengan yang gagal.
 *
 * Jangan dinaikkan melewati 110 detik tanpa juga menaikkan proxy_read_timeout
 * di kedua berkas nginx itu.
 */
export const BATAS_SELURUH_MS = Number(process.env.ALETA_ZIP_TIMEOUT_TOTAL_MS || 90_000);

/**
 * Batas waktu seluruh penyusunan bila ZIP-nya DIALIRKAN (rute unduh sejak
 * 6 Oktober 2026, butir 25).
 *
 * Keheningan yang ditakuti BATAS_SELURUH_MS tidak ada lagi pada jalur alir:
 * tiap berkas dikirim begitu ditarik, jadi jeda terpanjang antara dua potongan
 * adalah satu berkas - dipagari BATAS_SATU_BERKAS_MS 30 detik, jauh di bawah
 * timeout=120 ProxyPass Apache di peladen (/etc/httpd/conf.d/aleta.conf) yang
 * berlaku per jeda baca, bukan untuk seluruh jawaban. Batas menyeluruh ini
 * hanya pagar terakhir supaya satu unduhan tidak menahan bot tanpa akhir.
 */
export const BATAS_SELURUH_ALIR_MS = Number(process.env.ALETA_ZIP_TIMEOUT_ALIR_MS || 600_000);

/* === STATUS-ZIP 12 Okt === */

/**
 * ============================================================================
 * BATAS UNTUK ZIP YANG DIALIRKAN - DAN KENAPA 200 MB MENGHILANGKAN BERKAS
 * (12 Oktober 2026, butir 10 "download semua perkara tidak terdownload semua")
 * ============================================================================
 *
 * Jejak audit ECOURT_PERKARA_ZIP_LENGKAP atas 273/Pdt.G/2026/PA.Dgl, tiga kali
 * (7 Oktober 2026): jumlahBerkas 66, totalByte 209.690.308, jumlahDilewati 74.
 * Batas ukuran lama 200 MB = 209.715.200 byte - ZIP-nya berhenti 24 KB di
 * bawah batas itu. Pemindaian resi pos dan relaas (2-4 MB sebuah, 98 berkas)
 * menghabiskan jatah lebih dahulu; berita acara sidang, penetapan, dan seluruh
 * dokumen e-Court datang SESUDAHNYA dan ditolak "melewati batas ukuran ZIP".
 * Yang lolos hanya yang cukup kecil untuk muat di sisa 24 KB: dua BAS (16 KB
 * dan 28 KB) - persis isi ZIP pada tangkapan layar pengguna.
 *
 * Batas 200 MB itu dibuat ketika ZIP disusun PENUH di memori. Sejak 6 Oktober
 * 2026 ZIP dialirkan (buatPenulisZip): memori portal hanya memegang SATU berkas
 * dan antrian paling banyak 8 MB, jadi batas itu tidak lagi menjaga apa pun -
 * ia hanya membuang berkas. Untuk jalur alir batasnya kini ditentukan oleh
 * bentuk ZIP sendiri: penulis ZIP ini ZIP32 (tanpa ZIP64), sehingga isinya
 * harus di bawah 4 GiB dan di bawah 65.535 entri. Batas bawaan sengaja di
 * bawahnya (3,5 GiB, 5.000 entri) dan dapat diubah lewat ALETA_ZIP_MAKS_BYTE /
 * ALETA_ZIP_MAKS_BERKAS - tidak pernah melewati batas ZIP32.
 *
 * Jalur yang MENAMPUNG isi di memori (sinkron Google Drive, tanpa `alir`)
 * tetap memakai BATAS_BERKAS / BATAS_TOTAL_BYTE di atas.
 */
const BATAS_ZIP32_BYTE = 0xf0000000; // di bawah 4 GiB: sisa untuk daftar isi + kepala
export const BATAS_TOTAL_BYTE_ALIR = Math.min(
  Number(process.env.ALETA_ZIP_MAKS_BYTE || 3.5 * 1024 * 1024 * 1024),
  BATAS_ZIP32_BYTE
);
export const BATAS_BERKAS_ALIR = Math.min(Number(process.env.ALETA_ZIP_MAKS_BERKAS || 5000), 60_000);

/**
 * Subfolder e-Court menurut JENIS dokumen (butir 10: "e-Court/<jenis>").
 *
 * Jenis resmi dari e-Court dipakai apa adanya (Jawaban, Replik, Duplik,
 * Kesimpulan, Rereplik, Perbaikan Gugatan, ...). Dokumen yang jenisnya kosong -
 * terukur 2.070 dari 2.151 dokumen di aleta_bot_ecourt_documents: gugatan,
 * KTP, surat kuasa, alat bukti - dikelompokkan dari judulnya; yang tetap tidak
 * terbaca masuk "Lainnya". Tidak pernah dibuang.
 */
export function folderJenisEcourt(item: { jenisDokumen?: string; judulDokumen?: string }): string {
  const jenis = String(item.jenisDokumen ?? "").trim();
  if (jenis) return namaAman(jenis, "Lainnya");
  const judul = String(item.judulDokumen ?? "").toLowerCase();
  if (/rereplik/.test(judul)) return "Rereplik";
  if (/reduplik|rerduplik/.test(judul)) return "Reduplik";
  if (/duplik/.test(judul)) return "Duplik";
  if (/replik/.test(judul)) return "Replik";
  if (/jawaban/.test(judul)) return "Jawaban";
  if (/kesimpulan/.test(judul)) return "Kesimpulan";
  if (/gugatan|permohonan/.test(judul)) return "Gugatan dan permohonan";
  if (/kuasa/.test(judul)) return "Surat kuasa";
  if (/bukti|ktp|kartu|sumpah|penyumpahan|saksi|akta|surat\s+(nikah|keterangan)|foto/.test(judul)) return "Alat bukti";
  return "Lainnya";
}

/** Satu berkas yang tercatat tetapi tidak ikut - dan SEBABNYA (butir 10). */
export type BarisGagal = {
  kategori: KategoriArsip | "umum";
  nama: string;
  sebab: string;
  /** "gagal" = diminta tetapi tidak terambil; "tidak diminta" = sengaja tidak ikut. */
  status: "gagal" | "tidak diminta";
};

/** Kategori sebuah jenis berkas SIPP - untuk catatan gagal yang tidak punya nama entri ZIP. */
function kategoriJenisSipp(jenis: JenisBerkasSipp): KategoriArsip {
  switch (jenis) {
    case "relaas":
    case "resi":
      return "relaas";
    case "bas":
      return "bas";
    case "putusan":
    case "putusan-anonim":
      return "putusan";
    case "penetapan":
    case "ikrar-talak":
      return "penetapan";
    case "arsip":
      return "arsip";
    case "petitum":
      return "gugatan";
    default:
      return "lainnya";
  }
}

/**
 * Kalimat awam untuk alasan penolakan bot - "HTTP 404 - berkas_tidak_ditemukan_di_server"
 * tidak menjawab apa yang harus diperiksa petugas. Alasan yang tidak dikenal
 * dibiarkan apa adanya (tanpa tambahan).
 */
function keteranganAlasanBot(alasan: string): string {
  const peta: Record<string, string> = {
    berkas_tidak_ditemukan_di_server:
      " (tercatat di SIPP, tetapi berkasnya tidak ada di folder SIPP yang terpasang pada bot - periksa mount SIPP)",
    berkas_tidak_tercatat: " (tidak tercatat pada database SIPP)",
    jenis_tidak_dikenali: " (jenis berkas ditolak bot - bot lebih lama dari portal?)",
  };
  return peta[alasan] ?? "";
}

/* === AKHIR STATUS-ZIP === */

/**
 * Jalur ALIR: tiap entri diserahkan ke pemanggil begitu lolos batas, bukan
 * ditampung di isiZip. Dipakai rute unduh supaya ZIP mengalir ke peramban
 * sepotong demi sepotong.
 */
export type AlirArsip = {
  /** Satu entri ZIP, berurutan, segera sesudah lolos batas. */
  kirim: (berkas: BerkasZip) => void;
  /**
   * Ditunggu sebelum tiap berkas ditarik dari bot - penahan bila peramban
   * lebih lambat daripada bot, supaya antrian di memori tidak membengkak.
   * Melempar = unduhan dibatalkan peramban; berkas sisanya dilewati.
   */
  tunggu?: () => Promise<void>;
};

/** Membersihkan judul dokumen menjadi nama berkas yang aman di semua sistem. */
export function namaAman(teks: string, cadangan: string) {
  const bersih = String(teks || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return bersih || cadangan;
}

/** "01", "02", ... - supaya urutannya bertahan di penjelajah berkas mana pun. */
function duaAngka(n: number) {
  return String(n).padStart(2, "0");
}

/** Ekstensi dari nama berkas yang tersimpan SIPP; pdf bila tidak terbaca. */
function ekstensiDari(nama: string, cadangan = "pdf") {
  const cocok = /\.([a-z0-9]{2,5})$/i.exec(String(nama || "").trim());
  return cocok ? cocok[1].toLowerCase() : cadangan;
}

/**
 * Nama berkas asli menurut bot - dipakai HANYA untuk mengambil ekstensinya.
 *
 * Bot sudah menuliskannya pada Content-Disposition tiap jawaban berkas; yang
 * kurang selama ini hanya membacanya di sini.
 */
function namaDariDisposisi(nilai: string | null): string {
  const cocok = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(String(nilai || ""));
  if (!cocok) return "";
  try {
    return decodeURIComponent(cocok[1]);
  } catch {
    return cocok[1];
  }
}

/** Satu baris pada DAFTAR ISI.txt. */
export type BarisDaftar = {
  nama: string;
  jenis: string;
  tanggal: string;
  asal: string;
  byte: number;
};


/** Pilihan penyusunan - batasnya bawaan rute ZIP bila tidak disebut. */
export type OpsiArsipPerkara = {
  nomor: string;
  sumber: "semua" | "ecourt" | "sipp";
  /** true = data SIPP + berkas (tombol Status Perkara). */
  lengkap: boolean;
  /** Berkas pindaian arsip fisik (2-28 MB sebuah) - hanya bila diminta. */
  sertakanArsip: boolean;
  batasBerkas?: number;
  batasTotalByte?: number;
  batasSatuBerkasMs?: number;
  batasSeluruhMs?: number;
  /** Bila ada: entri dialirkan lewat alir.kirim dan isiZip pulang kosong. */
  alir?: AlirArsip;
  /* === STATUS-ZIP 12 Okt === */
  /**
   * Kategori yang dipilih (butir 11). Tidak disebut = perilaku lama: seluruh
   * kategori, dan arsip fisik hanya bila sertakanArsip.
   */
  kategori?: KategoriArsip[] | null;
  /* === AKHIR STATUS-ZIP === */
};

export type HasilArsipPerkara = {
  /**
   * Isi arsip berurutan, termasuk DAFTAR ISI.txt dan KETERANGAN.txt. Kosong =
   * tidak ada berkas tersimpan - KECUALI pada jalur alir, yang isinya sudah
   * diserahkan lewat alir.kirim (lihat jumlahIsi).
   */
  isiZip: BerkasZip[];
  /** Jumlah entri ZIP yang ditaruh/dialirkan, termasuk DAFTAR ISI dan KETERANGAN. */
  jumlahIsi: number;
  daftar: BarisDaftar[];
  dilewati: string[];
  takTerbaca: string[];
  totalByte: number;
  jumlahSippTercatat: number;
  jumlahEcourtTercatat: number;
  mulai: number;
  /* === STATUS-ZIP 12 Okt === */
  /** Berkas yang tercatat tetapi tidak ikut, beserta sebabnya (juga ada di DAFTAR ISI.csv). */
  gagal?: BarisGagal[];
  /* === AKHIR STATUS-ZIP === */
};

/**
 * Nama berkas ZIP - dan, tanpa ".zip", nama folder perkara di Drive.
 *
 * "perkara-" bila datanya ikut - yang menerimanya harus dapat membedakan
 * arsip berkas dari arsip perkara utuh tanpa membukanya lebih dulu.
 */
export function namaBerkasArsipPerkara(
  nomor: string,
  pilihan: {
    lengkap: boolean;
    sumber: "semua" | "ecourt" | "sipp";
    /** Bila hanya sebagian kategori: namanya ikut disebut ("perkara-273-...-bas-relaas.zip"). */
    kategori?: KategoriArsip[] | null;
  }
) {
  const awalan = pilihan.lengkap ? "perkara" : pilihan.sumber === "ecourt" ? "ecourt" : "berkas";
  const dasar = `${awalan}-${namaAman(nomor, "perkara").replace(/[^\w.-]+/g, "-")}`;
  const sebagian =
    pilihan.kategori && pilihan.kategori.length > 0
      ? pilihan.kategori.length === KATEGORI_ARSIP.length - 1 && !pilihan.kategori.includes("arsip")
        ? ""
        : `-${pilihan.kategori.join("-")}`
      : "";
  return `${dasar}${sebagian}.zip`;
}

export async function susunArsipPerkara(opsi: OpsiArsipPerkara): Promise<HasilArsipPerkara> {
  const { nomor, sumber, lengkap, sertakanArsip } = opsi;
  const ambilEcourt = sumber !== "sipp";
  const ambilSipp = sumber !== "ecourt";
  /* === STATUS-ZIP 12 Okt === */
  // Jalur alir tidak menampung isinya di memori - batasnya BATAS_*_ALIR (lihat
  // catatan di atas). Jalur yang menampung (sinkron Drive) tetap BATAS_*.
  const batasBerkas = opsi.batasBerkas ?? (opsi.alir ? BATAS_BERKAS_ALIR : BATAS_BERKAS);
  const batasTotalByte = opsi.batasTotalByte ?? (opsi.alir ? BATAS_TOTAL_BYTE_ALIR : BATAS_TOTAL_BYTE);
  const pilih = opsi.kategori && opsi.kategori.length > 0 ? new Set<KategoriArsip>(opsi.kategori) : null;
  /** Apakah kategori ini diminta. Tanpa pilihan = perilaku lama; arsip fisik hanya bila sertakanArsip. */
  const dapat = (k: KategoriArsip) => (pilih ? pilih.has(k) : k === "arsip" ? sertakanArsip : true);
  const arsipDiminta = lengkap && dapat("arsip");
  /* === AKHIR STATUS-ZIP === */
  const batasSatuBerkasMs = opsi.batasSatuBerkasMs ?? BATAS_SATU_BERKAS_MS;
  const batasSeluruhMs = opsi.batasSeluruhMs ?? BATAS_SELURUH_MS;
  {
    const mulai = Date.now();
    const waktuHabis = () => Date.now() - mulai > batasSeluruhMs;

    // Hari ini menurut zona PENGADILAN (Asia/Makassar), bukan zona peladen.
    // Peladen berjalan dengan jam UTC, dan tanggal UTC pada pukul 00.00-08.00
    // WITA masih hari kemarin - ringkasannya akan menyebut sidang yang sudah
    // lewat sebagai sidang berikutnya.
    const hariIni = waktuPengadilan().tanggal;

    const isiZip: BerkasZip[] = [];
    const daftar: BarisDaftar[] = [];
    const dilewati: string[] = [];
    /* === STATUS-ZIP 12 Okt === */
    const gagal: BarisGagal[] = [];
    /**
     * Mencatat satu berkas yang tidak ikut - SEKALI, dua tempat: kalimat pada
     * KETERANGAN.txt (dilewati) dan baris terstruktur pada DAFTAR ISI.csv
     * (gagal). Tidak ada berkas yang tercatat tetapi tidak ikut tanpa sebab.
     */
    const catat = (
      kategori: KategoriArsip | "umum",
      nama: string,
      sebab: string,
      status: BarisGagal["status"] = "gagal"
    ) => {
      dilewati.push(`${nama}: ${sebab}`);
      gagal.push({ kategori, nama, sebab, status });
    };
    /* === AKHIR STATUS-ZIP === */
    let totalByte = 0;
    // Jumlah dan nama entri dihitung sendiri, bukan dibaca dari isiZip: pada
    // jalur alir isiZip tetap kosong karena tiap entri langsung dikirim.
    let jumlahIsi = 0;
    const namaTerpakai = new Set<string>();
    const alir = opsi.alir;
    const simpan = (berkas: BerkasZip) => {
      jumlahIsi += 1;
      namaTerpakai.add(berkas.nama);
      if (alir) alir.kirim(berkas);
      else isiZip.push(berkas);
    };

    /**
     * Menaruh satu berkas ke dalam ZIP, atau menyebutkan sebab ia tidak masuk.
     *
     * Seluruh pemeriksaan batas terkumpul di sini supaya tidak ada satu jalur
     * pun yang melewatkannya - dan supaya tiap yang dilewati tercatat SEKALI,
     * bukan sekali per bentuk berkas seperti dulu.
     */
    const taruh = (
      nama: string,
      isi: Buffer,
      keterangan: { jenis: string; tanggal: string; asal: string }
    ): boolean => {
      if (isi.byteLength === 0) {
        catat(kategoriDariNama(nama), nama, "berkasnya kosong");
        return false;
      }
      if (jumlahIsi >= batasBerkas) {
        catat(kategoriDariNama(nama), nama, `melewati batas ${batasBerkas} berkas`);
        return false;
      }
      if (totalByte + isi.byteLength > batasTotalByte) {
        catat(
          kategoriDariNama(nama),
          nama,
          `melewati batas ukuran ZIP (${Math.round(batasTotalByte / 1048576)} MB; sudah ${Math.round(totalByte / 1048576)} MB)`
        );
        return false;
      }
      simpan({ nama, isi });
      daftar.push({ nama, byte: isi.byteLength, ...keterangan });
      totalByte += isi.byteLength;
      return true;
    };

    /**
     * Menarik satu berkas SIPP - beserta NAMA ASLINYA, dengan batas waktu
     * sendiri maupun batas waktu menyeluruh.
     *
     * ======================================================================
     * EKSTENSI DIBACA, TIDAK DITEBAK
     * ======================================================================
     *
     * Nama di dalam ZIP dulu disusun dengan ekstensi tetap per jenis: relaas
     * .pdf, berita acara .rtf, putusan .rtf. Diukur pada sipp_donggala 25
     * September 2026, tebakan itu MELESET pada:
     *
     *   berita acara   8.896 dari 15.248 (58,3%) - pdf 3.721, docx 4.304, doc 870
     *   putusan anonim 1.952 dari  9.871 (19,8%)
     *   relaas         2.199 dari 14.204 (15,5%) - jpg, jpeg, png, rtf
     *   putusan        1.217 dari  9.903 (12,3%)
     *
     * Berkas PDF yang bernama .rtf tidak dibuka Word, dan yang menerimanya
     * menyimpulkan BERKASNYA rusak - padahal hanya namanya. Bot sudah
     * menuliskan nama aslinya pada Content-Disposition; yang kurang selama ini
     * hanya membacanya di sini.
     */
    const tarikSipp = async (
      jenis: JenisBerkasSipp,
      id: string,
      /* === STATUS-ZIP 12 Okt === */
      // Uraian yang DIBACA orang untuk catatan gagal ("Relaas 2026-05-01 - Penggugat
      // - Fulan"), bukan hanya "relaas #13329". Nomor barisnya tetap ikut di
      // belakang supaya dapat dilacak ke SIPP.
      uraian = ""
      /* === AKHIR STATUS-ZIP === */
    ): Promise<{ isi: Buffer; nama: string } | null> => {
      const katGagal = kategoriJenisSipp(jenis);
      const sebutGagal = uraian ? `${uraian} [${jenis} #${id}]` : `${jenis} #${id}`;
      if (waktuHabis()) {
        catat(katGagal, sebutGagal, `batas waktu ${Math.round(batasSeluruhMs / 1000)} detik terlampaui`);
        return null;
      }
      try {
        // Jalur alir: tunggu peramban menghabiskan antrian dulu.
        await alir?.tunggu?.();
      } catch (galat) {
        catat(katGagal, sebutGagal, String((galat as Error)?.message || galat).slice(0, 120));
        return null;
      }
      const pembatal = new AbortController();
      const jam = setTimeout(() => pembatal.abort(), batasSatuBerkasMs);
      try {
        const respons = await ambilBerkasSippGateway(jenis, id, pembatal.signal);
        if (!respons.ok) {
          // Sebabnya ikut dicatat, bukan hanya nomornya. "HTTP 400" tidak
          // membedakan berkas yang belum diunggah dari berkas yang ADA tetapi
          // ekstensinya ditolak bot - dan hanya yang kedua dapat diperbaiki.
          const alasan = await respons
            .json()
            .then((x) => String(x?.alasan || x?.error || "").slice(0, 120))
            .catch(() => "");
          catat(
            katGagal,
            sebutGagal,
            `HTTP ${respons.status}${alasan ? ` - ${alasan}` : ""}${keteranganAlasanBot(alasan)}`
          );
          return null;
        }
        return {
          isi: Buffer.from(await respons.arrayBuffer()),
          nama: namaDariDisposisi(respons.headers.get("content-disposition")),
        };
      } catch (galat) {
        // Satu berkas yang tidak terbaca tidak menggagalkan seluruh ZIP - dan
        // di peladen ini ada satu inode XFS rusak yang memang begitu.
        catat(katGagal, sebutGagal, String((galat as Error)?.message || galat).slice(0, 120));
        return null;
      } finally {
        clearTimeout(jam);
      }
    };

    /**
     * Menarik satu berkas e-Court - dengan batas waktu yang SAMA seperti sisi
     * SIPP, dan nama aslinya ikut dibaca.
     *
     * ======================================================================
     * DUA CACAT YANG SATU SEBABNYA
     * ======================================================================
     *
     * Sampai 25 September 2026 lingkaran e-Court memanggil ambilBerkasGateway
     * langsung: tanpa waktuHabis(), tanpa AbortController, dan tanpa membaca
     * Content-Disposition sama sekali.
     *
     *   Batas waktu - tidak dapat dipasang, sebab ambilBerkasGateway memang
     *   belum punya parameter signal. Satu berkas e-Court yang menggantung
     *   karena itu menggantungkan SELURUH permintaan melewati batas 120 detik
     *   nginx: unduhan gagal tanpa sebab, persis keadaan yang BATAS_SELURUH_MS
     *   ditulis untuk menghapus. Sumber bawaan tombol Status Perkara "semua",
     *   jadi jalur ini dilewati TIAP tekanan - bukan jalur yang jarang.
     *
     *   Ekstensi - ditebak `bentuk === "word" ? "docx" : "pdf"`, padahal bot
     *   sudah mengirim nama aslinya (internalGatewayRoutes.js:2309 dari
     *   hasil.namaBerkas) dan menerima lima bentuk berkas
     *   (ecourtDocumentService.js:40: .pdf .doc .docx .rtf .odt). Dokumen RTF,
     *   DOC, atau ODT karena itu masuk ZIP bernama .docx; Word menolak
     *   membukanya dan yang menerimanya menyimpulkan BERKASNYA rusak - sama
     *   dengan cacat sisi SIPP yang sudah dibetulkan lebih dahulu.
     */
    const tarikEcourt = async (
      documentKey: string,
      bentuk: "pdf" | "word",
      sebutan: string
    ): Promise<{ isi: Buffer; nama: string } | null> => {
      if (waktuHabis()) {
        catat(
          "ecourt",
          `${sebutan} (${bentuk})`,
          `batas waktu ${Math.round(batasSeluruhMs / 1000)} detik terlampaui`
        );
        return null;
      }
      try {
        await alir?.tunggu?.();
      } catch (galat) {
        catat("ecourt", `${sebutan} (${bentuk})`, String((galat as Error)?.message || galat).slice(0, 120));
        return null;
      }
      const pembatal = new AbortController();
      const jam = setTimeout(() => pembatal.abort(), batasSatuBerkasMs);
      try {
        const respons = await ambilBerkasGateway(documentKey, bentuk, pembatal.signal);
        if (!respons.ok) {
          // Satu berkas gagal tidak menggagalkan seluruh ZIP: yang lain tetap
          // berguna, dan yang gagal disebutkan namanya.
          catat("ecourt", `${sebutan} (${bentuk})`, `HTTP ${respons.status}`);
          return null;
        }
        return {
          isi: Buffer.from(await respons.arrayBuffer()),
          nama: namaDariDisposisi(respons.headers.get("content-disposition")),
        };
      } catch (galat) {
        catat("ecourt", `${sebutan} (${bentuk})`, String((galat as Error)?.message || galat).slice(0, 120));
        return null;
      } finally {
        clearTimeout(jam);
      }
    };

    // ========================================================================
    // SUMBER 0 - SELURUH DATA SIPP PERKARA INI
    // ========================================================================
    //
    // Bukan hanya berkasnya. Yang membawa berkas perkara ke luar - banding,
    // pemeriksaan pengawas, serah terima pemegang perkara - membawa
    // KETERANGANNYA juga: siapa majelisnya, kapan tiap tahapan diinput, berapa
    // panjarnya, mediasi berapa hari, bagaimana tiap pihak dipanggil. Selama
    // ini keterangan itu hanya ada di layar, dan menyalinnya berarti membuka
    // dua puluh enam bagian satu per satu.
    //
    // SATU PANGGILAN, DAN JUSTRU YANG PALING LENGKAP
    //
    // statusPerkara di bot sudah MEMANGGIL rincianSidang di dalamnya
    // (aleta_bot/services/sippStatusPerkaraService.js), lalu menambahkan
    // tahapan, ikrar talak, keterangan arsip, court calendar, mediasi, biaya,
    // delegasi, dan penilaian. Karena itu ia juga menyebut TIGA kelas berkas
    // yang tidak pernah terlihat rincianSidang: penetapan PMH/PPP/PJS/PHS,
    // penetapan ikrar talak, dan berkas pindaian arsip - ketiganya sudah punya
    // tombol satuan di layar Status Perkara, tetapi tidak pernah ikut ZIP.
    let statusPerkara: Record<string, any> | null = null;
    // Tanpa kategori yang membutuhkannya (data, penetapan, arsip fisik) status
    // perkara tidak perlu ditarik sama sekali.
    if (lengkap && (dapat("data") || dapat("penetapan") || dapat("arsip"))) {
      const jawab = await getGatewayStatusPerkara(nomor);
      if (!jawab.ok) catat("data", "Data SIPP", String(jawab.error || "tidak terbaca"));
      else if (!jawab.data?.ok) catat("data", "Data SIPP", String(jawab.data?.alasan || "tidak terbaca"));
      else statusPerkara = jawab.data as Record<string, any>;
    }

    /**
     * Larik yang benar-benar larik. Bot memulangkan { terbaca, alasan, baris }
     * untuk bagian yang gagal dibaca, dan bila suatu hari "baris" datang
     * sebagai null, memanggil .map atasnya akan melempar - lalu menggagalkan
     * SELURUH ZIP yang berkasnya sudah terlanjur ditarik satu per satu.
     */
    const larik = (nilai: unknown): any[] => (Array.isArray(nilai) ? nilai : []);

    /**
     * ======================================================================
     * "KOSONG" DAN "TIDAK TERBACA" ADALAH DUA FAKTA, BUKAN SATU
     * ======================================================================
     *
     * Bot memulangkan { terbaca, alasan, baris } untuk tiap bagian, dan ia
     * benar-benar menyusun kalimat sebabnya - sippTahapanService.js:2828
     * "Tabel arsip tidak ada pada SIPP versi ini.", :2926 "Folder arsip SIPP
     * tidak terbaca dari container ALETA", sippStatusPerkaraService.js:1701
     * "Tahapan tidak terbaca.". Sampai 25 September 2026 rute ini hanya
     * membaca `baris`-nya dan membuang `terbaca` beserta `alasan`.
     *
     * Akibatnya "10 saksi.csv" yang berisi satu baris kepala dibaca sebagai
     * "perkara ini tidak punya saksi", padahal kebenarannya "keterangan saksi
     * TIDAK DAPAT DIBACA". Yang pertama boleh dikirim ke banding apa adanya;
     * yang kedua menuntut seseorang memeriksa SIPP lebih dahulu.
     *
     * Daftar ini karena itu berdiri SENDIRI, bukan digabung ke `dilewati`:
     * berkasnya IKUT dikemas - hanya isinya yang tidak dapat dipercaya sebagai
     * "memang tidak ada". Menggabungkannya ke "TIDAK IKUT DIKEMAS" akan
     * menukar satu kekeliruan dengan kekeliruan yang lain.
     */
    const takTerbaca: string[] = [];
    const periksaTerbaca = (namaTabel: string, bagian: unknown) => {
      if (!bagian || typeof bagian !== "object") return;
      const b = bagian as { terbaca?: unknown; alasan?: unknown; catatan?: unknown };
      if (b.terbaca === false) {
        const alasan = String(b.alasan ?? "").trim();
        takTerbaca.push(`${namaTabel}: ${alasan || "bot tidak menyebutkan sebabnya"}`);
        return;
      }
      // Terbaca, tetapi bot MENERANGKAN kenapa hasilnya kosong - konseptor
      // yang tahapan putusannya tidak tercatat, misalnya. Keterangan itu
      // sama pentingnya dengan alasan gagal baca, dan dulu juga hilang.
      const catatan = String(b.catatan ?? "").trim();
      if (catatan) takTerbaca.push(`${namaTabel}: ${catatan}`);
    };

    // Baris arsip dipakai dua kali - oleh "15 arsip.csv" di bawah dan oleh
    // folder "08 Arsip fisik" yang ditarik jauh sesudahnya - jadi dibaca
    // sekali di sini.
    const barisArsip = larik(statusPerkara?.arsipKeterangan?.baris);

    // ========================================================================
    // 00 DATA SIPP - DITULIS PALING DAHULU, BUKAN PALING AKHIR
    // ========================================================================
    //
    // JSON-nya jawaban bot APA ADANYA, tidak disaring lewat tipe layar. Tipe
    // Status di aleta-ecourt-status-perkara.tsx pernah memotong ruas yang
    // sudah melintasi jaringan - delapan ruas relaas berhenti di sana tanpa
    // satu galat pun. Ekspor yang jujur tidak boleh mengulanginya: yang
    // dikirim bot, itu yang tersimpan.
    //
    // CSV-nya untuk yang dibuka orang. Tidak ada panitera yang membaca JSON.
    //
    // Letaknya di SINI, sebelum satu berkas pun ditarik, karena taruh()
    // menegakkan BATAS_BERKAS menurut urutan pemanggilan - lihat catatan pada
    // BATAS_BERKAS di atas.
    if (statusPerkara && dapat("data")) {
      const s = statusPerkara;

      const json = Buffer.from(JSON.stringify(statusPerkara, null, 2), "utf8");
      taruh("00 Data SIPP/perkara.json", json, {
        jenis: "Data SIPP (utuh)",
        tanggal: "",
        asal: "sipp/status-perkara",
      });

      const tulisCsv = (
        nama: string,
        kepala: string[],
        baris: Array<unknown[]>,
        /**
         * Bagian bot yang mengisi tabel ini. Diberikan supaya keterbacaannya
         * diperiksa pada SATU jalur - tabel yang ditulis tanpa menyebut
         * bagiannya adalah tabel yang kekosongannya tidak dapat diterangkan.
         */
        bagian?: unknown
      ) => {
        if (bagian !== undefined) periksaTerbaca(nama, bagian);
        taruh(`00 Data SIPP/${nama}`, Buffer.from(tabelCsv(kepala, baris), "utf8"), {
          jenis: "Data SIPP",
          tanggal: "",
          asal: "sipp/status-perkara",
        });
      };
      const ya = (nilai: unknown) => (nilai ? "ya" : "tidak");

      // Sebagian keterangan SIPP gagal dibaca seluruhnya - dan bila itu
      // terjadi, relaas, majelis, panitera, juru sita, dan saksi SEMUANYA
      // dipulangkan sebagai larik kosong sekaligus. Tanpa kalimat ini, lima
      // tabel kosong tampak seperti lima fakta.
      const pesanSipp = String(s.pesanSipp ?? "").trim();
      if (pesanSipp) takTerbaca.push(`Keterangan SIPP (majelis, relaas, saksi): ${pesanSipp}`);

      tulisCsv(
        "01 identitas.csv",
        ["ruas", "nilai"],
        [
          ["nomor_perkara", s.identitas?.nomorPerkara],
          ["perkara_id", s.identitas?.perkaraId],
          ["jenis_perkara", s.identitas?.jenisPerkaraLengkap || s.identitas?.jenisPerkara],
          ["tanggal_daftar", s.identitas?.tanggalDaftar],
          ["lewat_ecourt", ya(s.lewatEcourt)],
          // Tiga keadaan, bukan dua: ghaib null berarti SIPP-nya tidak terbaca,
          // dan itu bukan hal yang sama dengan "tidak ghaib".
          [
            "ghaib",
            s.penanda?.ghaib === true ? "ya" : s.penanda?.ghaib === false ? "tidak" : "tidak terbaca",
          ],
          ["hari_berjalan", s.umur?.hariBerjalan],
          ["hari_mediasi", s.umur?.hariMediasi],
          ["hari_bersih", s.umur?.hariBersih],
          ["sudah_putus", ya(s.umur?.sudahPutus)],
          ["sebab_selesai", s.umur?.sebabSelesai],
          ["hari_minutasi", s.umur?.hariMinutasi],
        ]
      );
      tulisCsv(
        "02 pihak.csv",
        ["nama", "pihak_ke", "jenis", "ada_nomor", "nomor_samar"],
        larik(s.pihak).map((x) => [x.nama, x.pihakKe, x.jenis, ya(x.adaNomor), x.nomorSamar])
      );
      // Majelis, panitera, dan juru sita PEMERIKSA (bot sejak perbaikan
      // majelis ikrar), lalu majelis ikrar talak sebagai peran tersendiri -
      // bukan pengganti majelis perkara. Bot lama tidak mengirim `ikrar`.
      tulisCsv("03 majelis-dan-petugas.csv", ["peran", "kode", "nama", "jabatan"], [
        ...larik(s.majelis).map((x) => ["majelis", x.kode, x.nama, x.jabatan]),
        ...larik(s.panitera).map((x) => ["panitera pengganti", x.kode, x.nama, ""]),
        ...larik(s.jurusita).map((x) => ["juru sita", x.kode, x.nama, ""]),
        ...larik(s.ikrar?.majelis).map((x) => ["majelis ikrar talak", x.kode, x.nama, x.jabatan]),
        ...larik(s.ikrar?.panitera).map((x) => ["panitera sidang ikrar talak", x.kode, x.nama, ""]),
        ...larik(s.ikrar?.jurusita).map((x) => ["juru sita ikrar talak", x.kode, x.nama, ""]),
      ]);
      tulisCsv(
        "04 tahapan.csv",
        [
          "kunci",
          "label",
          "dasar",
          "tanggal",
          "diinput",
          "hari_sejak_acuan",
          "hari_sampai_input",
          "acuan",
          "diinput_oleh",
          "ada_berkas",
        ],
        larik(s.tahapan?.tahap).map((x) => [
          x.kunci,
          x.label,
          x.dasar,
          x.tanggal,
          x.diinput,
          x.hariSejakAcuan,
          x.hariSampaiInput,
          x.acuan,
          x.diinputOleh,
          ya(x.adaBerkas),
        ]),
        s.tahapan
      );
      tulisCsv(
        "05 jadwal-sidang.csv",
        ["urutan", "sidang_id", "tanggal", "jam", "agenda", "ruangan", "ditunda", "alasan_ditunda", "ada_bas"],
        larik(s.jadwal).map((x) => [
          x.urutanSidang,
          x.sidangId,
          x.tanggalSidang,
          x.jamSidang,
          x.agenda,
          x.ruangan,
          ya(x.ditunda),
          x.alasanDitunda,
          ya(x.adaBas),
        ])
      );
      tulisCsv(
        "06 relaas.csv",
        [
          "id",
          "sidang_id",
          "tanggal_sidang",
          "nama_pihak",
          "peran",
          "tanggal_relaas",
          "tanggal_kirim_pos",
          "no_resi",
          "status_pos",
          "retur",
          "cara",
          "bertemu",
          "jurusita",
          "ket_hasil",
          "ada_dokumen",
          "ada_resi",
        ],
        larik(s.relaas).map((x) => [
          x.id,
          x.sidangId,
          x.tanggalSidang,
          x.namaPihak,
          x.peran,
          x.tanggalRelaas,
          x.tanggalKirimPos,
          x.noResiPos,
          x.statusPos,
          ya(x.retur),
          x.caraRelaas,
          ya(x.bertemu),
          x.jurusitaNama,
          x.ketHasilRelaas,
          ya(x.adaDokumen),
          ya(x.adaResi),
        ])
      );
      tulisCsv(
        "07 panggilan-per-pihak.csv",
        [
          "nama",
          "peran",
          "seharusnya",
          "terlaksana",
          "tanggal_panggilan",
          "diterima",
          "ambang_hari",
          "jalur",
          "dasar_hukum",
          "patut",
          "selisih",
          "alasan",
        ],
        larik(s.panggilan?.pihak).map((x) => [
          x.nama,
          x.peran,
          x.seharusnya,
          x.terlaksana,
          x.tanggalPanggilan,
          x.diterima,
          x.kepatutan?.ambang,
          x.kepatutan?.jalur,
          x.kepatutan?.dasarHukum,
          x.kepatutan?.patut,
          x.kepatutan?.selisih,
          x.kepatutan?.alasan,
        ])
      );
      tulisCsv(
        "08 court-calendar.csv",
        ["tanggal", "jam", "agenda", "keterangan", "keadaan", "ada_sidang", "diinput_oleh", "diinput_tanggal"],
        larik(s.courtCalendar?.baris).map((x) => [
          x.tanggal,
          x.jam,
          x.agenda,
          x.keterangan,
          x.keadaan,
          ya(x.adaSidang),
          x.diinputOleh,
          x.diinputTanggal,
        ]),
        s.courtCalendar
      );
      tulisCsv(
        "09 mediasi.csv",
        [
          "mediator",
          "hasil",
          "tanggal_mulai",
          "tanggal_selesai",
          "lama_hari",
          "lewat_tenggang",
          "jumlah_pertemuan",
          "tanggal_penetapan",
          "tanggal_laporan",
          "tanggal_kesepakatan",
          "nomor_sk",
          "catatan",
        ],
        larik(s.mediasi?.baris).map((x) => [
          x.mediator,
          x.hasil,
          x.tanggalMulai,
          x.tanggalSelesai,
          x.lamaHari,
          x.lewatTenggang,
          x.jumlahPertemuan,
          x.tanggalPenetapan,
          x.tanggalLaporan,
          x.tanggalKesepakatan,
          x.nomorSk,
          x.catatan,
        ]),
        s.mediasi
      );
      tulisCsv(
        "10 saksi.csv",
        ["nama", "diajukan_oleh", "alamat", "keterangan", "isian_terisi", "isian_kurang"],
        larik(s.saksiRinci?.baris).map((x) => [
          x.nama,
          x.diajukanOleh,
          x.alamat,
          x.keterangan,
          x.isianTerisi,
          ((x.isianKurang ?? []) as string[]).join(" | "),
        ]),
        s.saksiRinci
      );
      tulisCsv(
        "11 biaya.csv",
        ["jenis", "uraian", "jumlah", "tanggal"],
        larik(s.biaya?.rincian).map((x) => [x.jenis, x.uraian, x.jumlah, x.tanggal])
      );
      tulisCsv(
        "12 putusan.csv",
        ["ruas", "nilai"],
        [
          ["tanggal_putusan", s.putusan?.tanggalPutusan],
          ["status_putusan", s.putusan?.statusPutusan],
          ["verstek", ya(s.putusan?.verstek)],
          ["tanggal_minutasi", s.putusan?.tanggalMinutasi],
          ["tanggal_bht", s.putusan?.tanggalBht],
          ["akta_cerai_nomor", s.putusan?.aktaCerai?.nomor],
          ["akta_cerai_tanggal", s.putusan?.aktaCerai?.tanggal],
          ["amar", s.putusanLengkap?.amar],
          ["sumber_hukum", s.putusanLengkap?.sumberHukum],
          ["faktor_primer", s.putusanLengkap?.faktorPrimer],
          ["faktor_sekunder", s.putusanLengkap?.faktorSekunder],
          ["qobla_bada", s.putusanLengkap?.qoblaBada],
          ["status_nusyuz", s.putusanLengkap?.statusNusyuz],
        ],
        s.putusanLengkap
      );
      tulisCsv(
        "13 upaya-hukum.csv",
        ["jenis", "sebutan", "tanggal_permohonan", "tanggal_putusan", "nomor_perkara", "dicabut", "gugur"],
        larik(s.upayaHukum).map((x) => [
          x.jenis,
          x.sebutan,
          x.tanggalPermohonan,
          x.tanggalPutusan,
          x.nomorPerkara,
          ya(x.dicabut),
          ya(x.gugur),
        ])
      );
      // Dua arah, dua bagian bot, dua sebab gagal yang berbeda - jadi
      // keduanya diperiksa, bukan salah satu.
      periksaTerbaca("14 delegasi.csv (masuk)", s.delegasiMasuk);
      periksaTerbaca("14 delegasi.csv (keluar)", s.delegasiKeluar);
      tulisCsv("14 delegasi.csv", ["arah", "pihak_lain", "tanggal_1", "tanggal_2", "keterangan"], [
        ...larik(s.delegasiMasuk?.baris).map((x) => [
          "masuk",
          x.asal,
          x.tanggalDiunggah,
          x.tanggalDiterima,
          x.hariSampaiTerima,
        ]),
        ...larik(s.delegasiKeluar?.baris).map((x) => [
          "keluar",
          x.tujuan,
          x.tanggalPermohonan,
          x.tanggalSelesai,
          x.hariSebelumSidang,
        ]),
      ]);
      tulisCsv(
        "15 arsip.csv",
        [
          "arsip_id",
          "nomor",
          "ruang",
          "lemari",
          "rak",
          "box",
          "tanggal_masuk",
          "penerima",
          "lengkap",
          "ada_berkas",
          "besar_byte",
        ],
        barisArsip.map((x) => [
          x.arsipId,
          x.nomor,
          x.ruang,
          x.lemari,
          x.rak,
          x.box,
          x.tanggalMasuk,
          x.penerima,
          x.lengkap,
          ya(x.adaBerkas),
          x.berkasBesar,
        ]),
        s.arsipKeterangan
      );
      tulisCsv(
        "16 dokumen-ecourt.csv",
        ["document_key", "judul", "status_verifikasi"],
        larik(s.dokumenEcourt).map((x) => [x.documentKey, x.judulDokumen, x.statusVerifikasi])
      );
      tulisCsv(
        "17 penilaian-kelengkapan.csv",
        ["kunci", "label", "dasar", "bobot", "bagian", "nilai", "catatan", "belum_dinilai", "belum_berlaku"],
        larik(s.penilaian?.rinci).map((x) => [
          x.kunci,
          x.label,
          x.dasar,
          x.bobot,
          x.bagian,
          x.nilai,
          x.catatan,
          ya(x.belumDinilai),
          ya(x.belumBerlaku),
        ])
      );
      tulisCsv(
        "18 penilaian-sk-048-2024.csv",
        ["kunci", "label", "aspek", "pengurang", "bobot", "dasar", "poin", "terbaca", "catatan"],
        larik(s.penilaianSk?.rinci).map((x) => [
          x.kunci,
          x.label,
          x.aspek,
          ya(x.pengurang),
          x.bobot,
          x.dasar,
          x.poin,
          ya(x.terbaca),
          x.catatan,
        ])
      );

      // ====================================================================
      // DELAPAN BAGIAN YANG DULU HANYA ADA DI DALAM perkara.json
      // ====================================================================
      //
      // Yang paling terasa riwayat penundaan sidang: berkas yang dikirim ke
      // banding ditanya kenapa sidangnya berulang kali ditunda, dan sampai 25
      // September 2026 jawabannya hanya ada di dalam JSON yang tidak dibaca
      // panitera mana pun.
      tulisCsv(
        "19 penundaan.csv",
        ["tanggal_sidang", "agenda", "alasan_ditunda"],
        larik(s.penundaan).map((x) => [x.tanggalSidang, x.agenda, x.alasanDitunda])
      );
      tulisCsv(
        "20 konseptor.csv",
        ["pengguna", "nama", "nama_terbaca", "tanggal", "dari_audit"],
        larik(s.konseptor?.baris).map((x) => [
          x.pengguna,
          x.nama,
          ya(x.namaTerbaca),
          x.tanggal,
          ya(x.dariAudit),
        ]),
        s.konseptor
      );
      tulisCsv(
        "21 penetapan-kembali.csv",
        [
          "jenis",
          "jumlah_baris",
          "nama",
          "masih_aktif",
          "tanggal_tidak_aktif",
          "diperbaharui_pada",
          "diperbaharui_oleh",
        ],
        larik(s.penetapanKembali?.baris).flatMap((x) => {
          const ganti = larik(x?.penggantian);
          // Jenis penetapan yang barisnya ada tetapi tanpa penggantian tetap
          // disebut - menghilangkannya membuat "tidak ada penggantian" dan
          // "jenis ini tidak pernah ditetapkan" tampak sama.
          if (ganti.length === 0) return [[x?.jenis, x?.jumlahBaris, "", "", "", "", ""]];
          return ganti.map((g) => [
            x?.jenis,
            x?.jumlahBaris,
            g?.nama,
            ya(g?.masihAktif),
            g?.tanggalTidakAktif,
            g?.diperbaharuiPada,
            g?.diperbaharuiOleh,
          ]);
        }),
        s.penetapanKembali
      );
      tulisCsv(
        "22 nilai-relaas.csv",
        ["tanggal_sidang", "tanggal_input"],
        larik(s.nilaiRelaas?.relaas).map((x) => [x.tanggalSidang, x.tanggalInput]),
        s.nilaiRelaas
      );
      tulisCsv(
        "23 garis-waktu.csv",
        ["kunci", "label", "tanggal", "hari_ke", "jenis", "agenda", "ditunda"],
        larik(s.analisa?.garisWaktu?.titik).map((x) => [
          x.kunci,
          x.label,
          x.tanggal,
          x.hariKe,
          x.jenis,
          x.agenda,
          x.ditunda === undefined ? "" : ya(x.ditunda),
        ]),
        s.analisa?.garisWaktu
      );
      tulisCsv(
        "24 jeda-sidang.csv",
        ["dari", "ke", "hari", "alasan", "jenis"],
        larik(s.analisa?.jedaSidang?.baris).map((x) => [x.dari, x.ke, x.hari, x.alasan, x.jenis]),
        s.analisa?.jedaSidang
      );
      tulisCsv(
        "25 ketepatan-input.csv",
        ["kunci", "label", "tanggal", "diinput", "selisih_hari", "poin", "poin_maksimal", "sebutan"],
        larik(s.analisa?.ketepatanInput?.baris).map((x) => [
          x.kunci,
          x.label,
          x.tanggal,
          x.diinput,
          x.selisih,
          x.poin,
          x.poinMaksimal,
          x.sebutan,
        ]),
        s.analisa?.ketepatanInput
      );
      // Tiga bagian yang isinya satu-dua angka saja - putusan e-Court, durasi
      // mediasi, dan hitungan dokumen relaas. Masing-masing sebagai berkas
      // sendiri berarti tiga berkas berisi satu baris; disatukan, ia terbaca
      // sebagai satu halaman keadaan.
      periksaTerbaca("26 keadaan-lain.csv (durasi mediasi)", s.durasiMediasi);
      periksaTerbaca("26 keadaan-lain.csv (dokumen relaas)", s.dokumenRelaas);
      tulisCsv("26 keadaan-lain.csv", ["ruas", "nilai"], [
        ["putusan_ecourt_keadaan", s.putusanEcourt?.keadaan],
        ["putusan_ecourt_sebutan", s.putusanEcourt?.sebutan],
        ["putusan_ecourt_perlu_tindakan", ya(s.putusanEcourt?.perluTindakan)],
        ["putusan_ecourt_keterangan", s.putusanEcourt?.keterangan],
        ["durasi_mediasi_hari", s.durasiMediasi?.hari],
        ["dokumen_relaas_jumlah", s.dokumenRelaas?.jumlah],
        ["dokumen_relaas_berdokumen", s.dokumenRelaas?.berdokumen],
        ["dokumen_relaas_berresi", s.dokumenRelaas?.berresi],
        ["nilai_relaas_sumber", s.nilaiRelaas?.sumber],
        ["nilai_relaas_langsung", s.nilaiRelaas?.nilaiLangsung],
        ["nilai_relaas_jumlah", s.nilaiRelaas?.jumlah],
        ["sudah_diarsipkan", ya(s.arsipKeterangan?.sudahDiarsipkan)],
        ["analisa_ringkasan_terbaca", ya(s.analisa?.ringkasan !== undefined)],
      ]);

      // RINGKASAN.txt memakai ringkasStatus() yang SAMA dengan tombol "Salin
      // ringkasan" di layar. Menulis kalimat kedua di sini berarti dua sumber
      // kebenaran yang menyimpang diam-diam - yang di layar diperbaiki, yang di
      // ZIP tidak, dan tidak ada yang berbunyi ketika itu terjadi.
      //
      // Ia menuntut bentuk BahanRingkas, dan bentuk itu datang dari bot - bukan
      // dari kode ini. Bila suatu hari salah satu ruasnya berubah, yang boleh
      // hilang hanya RINGKASAN.txt: seluruh berkas perkara yang sudah ditarik
      // tidak boleh ikut runtuh karena satu kalimat pengantar.
      try {
        const r = ringkasStatus(statusPerkara as unknown as BahanRingkas, hariIni);
        const ringkasan = [
          `RINGKASAN PERKARA ${nomor}`,
          `Disusun ${tanggalHariPanjang(hariIni, hariIni)}`,
          "",
          r.keadaan,
          r.umurKalimat,
          r.berikutnya,
          r.majelisKalimat,
          "",
          r.peringatan.length > 0
            ? "YANG PERLU DITINDAKLANJUTI:"
            : "Tidak ada yang perlu ditindaklanjuti menurut data SIPP.",
          ...r.peringatan.map((p) => `- ${p.pesan}${p.sebab ? ` (${p.sebab})` : ""}`),
        ].join("\r\n");
        taruh("RINGKASAN.txt", Buffer.from(ringkasan, "utf8"), {
          jenis: "Ringkasan",
          tanggal: "",
          asal: "lib/ringkas-status",
        });
      } catch (galat) {
        catat("data", "RINGKASAN.txt", String((galat as Error)?.message || galat).slice(0, 120));
      }
    }

    // ========================================================================
    // SUMBER 1 - BERKAS YANG TERSIMPAN DI SIPP
    // ========================================================================
    let jumlahSippTercatat = 0;
    if (ambilSipp && (dapat("gugatan") || dapat("relaas") || dapat("bas") || dapat("putusan") || dapat("lainnya"))) {
      const sidang = await getGatewayRincianSidang(nomor, "");
      if (!sidang.ok) {
        catat("umum", "Berkas SIPP", String(sidang.error || "tidak terbaca"));
      } else if (!sidang.data.ok) {
        catat("umum", "Berkas SIPP", String(sidang.data.alasan || "tidak terbaca"));
      } else {
        const r = sidang.data;
        const perkaraId = String(r.perkaraId || "");

        // 01 Gugatan - berkas yang paling sering dicari, dan tempatnya bukan
        // perkara_dokumen melainkan kolom petitum_dok pada tabel perkara.
        if (dapat("gugatan") && r.petitum?.ada && perkaraId) {
          jumlahSippTercatat += 1;
          const berkas = await tarikSipp("petitum", perkaraId, "Surat gugatan atau permohonan");
          if (berkas) {
            // Nama dari bot lebih dipercaya daripada kolomnya: yang dikirim
            // itulah yang dibaca. Cadangannya kolom petitum, lalu "docx" -
            // terukur 8.388 dari 10.119 petitum tersimpan sebagai docx.
            const ekstensi = ekstensiDari(berkas.nama, ekstensiDari(r.petitum.berkas ?? "", "docx"));
            taruh(`01 Gugatan/01 - Surat Gugatan atau Permohonan.${ekstensi}`, berkas.isi, {
              jenis: "Gugatan/Permohonan",
              tanggal: "",
              asal: "perkara.petitum_dok",
            });
          }
        }

        // 02 Relaas - urut tanggal panggilan, sebab urutan itulah yang
        // dibaca ketika kepatutan panggilan dipersoalkan.
        const relaas = [...(dapat("relaas") ? (r.relaas ?? []) : [])].sort((a, b) =>
          String(a.tanggalRelaas || "").localeCompare(String(b.tanggalRelaas || "")) ||
          String(a.id).localeCompare(String(b.id))
        );
        let nomorRelaas = 0;
        let nomorResi = 0;
        for (const baris of relaas) {
          if (baris.adaDokumen) {
            jumlahSippTercatat += 1;
            nomorRelaas += 1;
            const berkas = await tarikSipp(
              "relaas",
              String(baris.id),
              `Relaas ${baris.tanggalRelaas || "tanpa tanggal"} - ${baris.peran || "pihak"} - ${baris.namaPihak || ""}`.trim()
            );
            if (berkas) {
              const judul = namaAman(
                `${baris.tanggalRelaas || "tanpa tanggal"} - ${baris.peran || "pihak"} - ${baris.namaPihak || ""}`,
                `relaas-${baris.id}`
              );
              taruh(`02 Relaas/${duaAngka(nomorRelaas)} - ${judul}.${ekstensiDari(berkas.nama, "pdf")}`, berkas.isi, {
                jenis: "Relaas panggilan",
                tanggal: baris.tanggalRelaas || "",
                asal: "perkara_pelaksanaan_relaas.doc_relaas",
              });
            }
          }
          if (baris.adaResi) {
            jumlahSippTercatat += 1;
            nomorResi += 1;
            const berkas = await tarikSipp(
              "resi",
              String(baris.id),
              `Resi pos ${baris.tanggalKirimPos || baris.tanggalRelaas || "tanpa tanggal"} - ${baris.namaPihak || ""}`.trim()
            );
            if (berkas) {
              const judul = namaAman(
                `${baris.tanggalKirimPos || baris.tanggalRelaas || "tanpa tanggal"} - ${baris.namaPihak || ""}`,
                `resi-${baris.id}`
              );
              taruh(
                `02 Relaas/Resi pos/${duaAngka(nomorResi)} - ${judul}.${ekstensiDari(berkas.nama, "pdf")}`,
                berkas.isi,
                {
                  jenis: "Resi pos",
                  tanggal: baris.tanggalKirimPos || "",
                  asal: "perkara_pelaksanaan_relaas.doc_resi",
                }
              );
            }
          }
        }

        // 03 BAS - urut sidang keberapa, bukan urutan baris yang kebetulan
        // terbaca lebih dulu. Perkara yang sidangnya pernah dijadwalkan ulang
        // menyimpan barisnya tidak berurutan di SIPP.
        const jadwal = [...(dapat("bas") ? (r.jadwalPerkara ?? []) : [])].sort(
          (a, b) =>
            (Number(a.urutanSidang) || 0) - (Number(b.urutanSidang) || 0) ||
            String(a.tanggalSidang || "").localeCompare(String(b.tanggalSidang || ""))
        );
        let nomorBas = 0;
        for (const s of jadwal) {
          if (!s.adaBas) continue;
          jumlahSippTercatat += 1;
          nomorBas += 1;
          const berkas = await tarikSipp(
            "bas",
            String(s.sidangId),
            `BAS sidang ke-${s.urutanSidang || nomorBas} (${s.tanggalSidang || "tanpa tanggal"}) - ${s.agenda || ""}`.trim()
          );
          if (berkas) {
            const judul = namaAman(
              `Sidang ke-${s.urutanSidang || nomorBas} - ${s.tanggalSidang || ""} - ${s.agenda || ""}`,
              `bas-${s.sidangId}`
            );
            taruh(`03 BAS/${duaAngka(nomorBas)} - ${judul}.${ekstensiDari(berkas.nama, "rtf")}`, berkas.isi, {
              jenis: "Berita acara sidang",
              tanggal: s.tanggalSidang || "",
              asal: "perkara_jadwal_sidang.edoc_bas",
            });
          }
        }

        // 04 Putusan dan salinan anonimnya.
        if (dapat("putusan") && r.putusan?.adaBerkasPutusan && perkaraId) {
          jumlahSippTercatat += 1;
          const berkas = await tarikSipp("putusan", perkaraId, "Putusan");
          if (berkas) {
            taruh(`04 Putusan/01 - Putusan.${ekstensiDari(berkas.nama, "rtf")}`, berkas.isi, {
              jenis: "Putusan",
              tanggal: r.putusan.tanggalPutusan || "",
              asal: "perkara_putusan.amar_putusan_dok",
            });
          }
        }
        if (dapat("putusan") && r.putusan?.adaBerkasAnonim && perkaraId) {
          jumlahSippTercatat += 1;
          const berkas = await tarikSipp("putusan-anonim", perkaraId, "Putusan anonimisasi");
          if (berkas) {
            taruh(`04 Putusan/02 - Putusan anonimisasi.${ekstensiDari(berkas.nama, "rtf")}`, berkas.isi, {
              jenis: "Putusan anonimisasi",
              tanggal: r.putusan.tanggalPutusan || "",
              asal: "perkara_putusan.amar_putusan_anonimisasi_dok",
            });
          }
        }

        // 05 Lampiran lain. Kosong di satker ini - perkara_dokumen nol baris
        // dari 10.120 perkara - dan kekosongan itu bukan tanda kodenya rusak.
        let nomorLampiran = 0;
        for (const d of dapat("lainnya") ? (r.dokumenSipp ?? []) : []) {
          jumlahSippTercatat += 1;
          nomorLampiran += 1;
          const berkas = await tarikSipp("dokumen", String(d.id), `Lampiran ${d.namaDokumen || d.namaFile || ""}`.trim());
          if (!berkas) continue;
          const judul = namaAman(d.namaDokumen || d.namaFile, `lampiran-${d.id}`);
          // Nama dari bot lebih dipercaya daripada kolom nama_file: yang
          // dikirim itulah yang dibaca. Kolomnya tinggal cadangan.
          const ekstensi = ekstensiDari(berkas.nama, ekstensiDari(d.namaFile));
          taruh(`05 Lampiran/${duaAngka(nomorLampiran)} - ${judul}.${ekstensi}`, berkas.isi, {
            jenis: "Lampiran",
            tanggal: "",
            asal: "perkara_dokumen.lokasi_file",
          });
        }
      }
    }

    // ========================================================================
    // SUMBER 2 - ARSIP e-COURT
    // ========================================================================
    let jumlahEcourtTercatat = 0;
    if (ambilEcourt && dapat("ecourt")) {
      const rincian = await getGatewayArsipRincian(nomor);
      if (!rincian.ok) {
        catat("ecourt", "Arsip e-Court", String(rincian.error || "tidak terbaca"));
      } else {
        const dokumen = rincian.data?.dokumen ?? [];
        jumlahEcourtTercatat = dokumen.length;
        let urutan = 0;
        for (const item of dokumen) {
          const format: Array<"pdf" | "word"> = [];
          if (item.adaPdf) format.push("pdf");
          if (item.adaWord) format.push("word");
          if (format.length === 0) {
            catat(
              "ecourt",
              String(item.judulDokumen || item.documentKey),
              "berkasnya belum tersimpan di server - tarik dari menu Kendali Berkas"
            );
            continue;
          }

          urutan += 1;
          const sebutan = item.judulDokumen || item.documentKey;
          for (const bentuk of format) {
            const berkas = await tarikEcourt(item.documentKey, bentuk, sebutan);
            if (!berkas) continue;
            // Cadangannya tebakan lama - tetapi hanya sebagai cadangan, dipakai
            // ketika Content-Disposition benar-benar tidak ada.
            const ekstensi = ekstensiDari(berkas.nama, bentuk === "word" ? "docx" : "pdf");
            const judul = namaAman(item.judulDokumen, item.documentKey);
            // Subfolder menurut JENIS dokumen (butir 10, 12 Okt 2026).
            const sub = folderJenisEcourt(item);
            let nama = `06 e-Court/${sub}/${duaAngka(urutan)} - ${judul}.${ekstensi}`;
            // Dulu pdf selalu .pdf dan word selalu .docx, jadi dua bentuk satu
            // dokumen tidak mungkin bernama sama. Sesudah ekstensinya dibaca,
            // mungkin: ALLOWED_EXTENSIONS bot menerima .pdf untuk KEDUA bentuk
            // (ecourtDocumentService.js:40). Dua entri bernama sama di dalam
            // satu ZIP membuat Windows mengeluarkan hanya salah satunya, tanpa
            // peringatan, jadi bentuknya disebutkan ketika namanya bentrok.
            if (namaTerpakai.has(nama)) {
              nama = `06 e-Court/${sub}/${duaAngka(urutan)} - ${judul} (${bentuk}).${ekstensi}`;
            }
            taruh(nama, berkas.isi, {
              jenis: "Dokumen e-Court",
              tanggal: String(item.tanggalSidang || item.diunggahPada || "").slice(0, 10),
              asal: "aleta_bot_ecourt_files",
            });
          }
        }
      }
    }

    // ========================================================================
    // TIGA KELAS BERKAS YANG HANYA TERLIHAT LEWAT STATUS PERKARA
    // ========================================================================
    //
    // Penetapan PMH/PPP/PJS/PHS, penetapan ikrar talak, dan berkas pindaian
    // arsip. Ketiganya sudah punya tombol satuan di layar Status Perkara sejak
    // lama, tetapi getGatewayRincianSidang tidak memulangkannya sehingga
    // penyusun ZIP tidak pernah melihatnya sama sekali.
    if (statusPerkara && (dapat("penetapan") || arsipDiminta)) {
      const s = statusPerkara;

      // 07 Penetapan - terukur pada sipp_donggala: 3.336 berkas penetapan pada
      // 784 perkara (rata 4,26 sebuah, maksimum 7), ikrar talak 871.
      let nomorPenetapan = 0;
      for (const tahap of dapat("penetapan") ? larik(s.tahapan?.tahap) : []) {
        if (!tahap?.adaBerkas || !tahap?.dokumenId) continue;
        nomorPenetapan += 1;
        const berkas = await tarikSipp(
          "penetapan",
          String(tahap.dokumenId),
          `Penetapan ${tahap.tanggal || ""} - ${tahap.label || tahap.kunci || ""}`.trim()
        );
        if (!berkas) continue;
        // Tanggal pada NAMA berkas tetap ISO - itulah yang membuat penjelajah
        // berkas mengurutkannya dengan benar; yang dibaca orang ada di DAFTAR
        // ISI, dan di sana tanggalnya bergaya Indonesia.
        const judul = namaAman(
          `${tahap.tanggal || ""} - ${tahap.label || tahap.kunci || ""}`,
          `penetapan-${tahap.dokumenId}`
        );
        taruh(
          `07 Penetapan/${duaAngka(nomorPenetapan)} - ${judul}.${ekstensiDari(berkas.nama, "pdf")}`,
          berkas.isi,
          {
            jenis: "Penetapan",
            tanggal: String(tahap.tanggal || ""),
            asal: "perkara_dokumen_penetapan.dokumen",
          }
        );
      }
      if (dapat("penetapan") && s.ikrarTalak?.adaBerkas && s.ikrarTalak?.ikrarId) {
        const berkas = await tarikSipp("ikrar-talak", String(s.ikrarTalak.ikrarId), "Penetapan ikrar talak");
        if (berkas) {
          taruh(
            `07 Penetapan/99 - Penetapan ikrar talak.${ekstensiDari(berkas.nama, "rtf")}`,
            berkas.isi,
            {
              jenis: "Penetapan ikrar talak",
              tanggal: String(s.ikrarTalak.tanggalIkrar || ""),
              asal: "perkara_ikrar_talak.ikrar_talak_dok",
            }
          );
        }
      }

      // ======================================================================
      // 08 ARSIP FISIK - DAN SEBABNYA KETIKA FOLDERNYA TIDAK ADA
      // ======================================================================
      //
      // Berkas pindaian arsip perkara, terukur 2 MB sampai 28 MB sebuah. Hanya
      // bila DIMINTA: satu berkas ini sendirian dapat melipatkan besar ZIP, dan
      // yang tahu kondisi jaringannya bukan kodenya.
      //
      // Sampai 25 September 2026 cabang penjelasnya hanya tercapai ketika
      // sertakanArsip BERNILAI FALSE. Ketika petugas justru MENCENTANGNYA dan
      // adaBerkas palsu untuk seluruh baris - keadaan bawaan di peladen ini,
      // sebab arsipBerkasService menjawab palsu untuk semuanya bila folder
      // arsip SIPP tidak ter-mount - lingkaran for berjalan nol kali dan tidak
      // satu pun dilewati.push dijalankan. Hasilnya: tidak ada folder 08 DAN
      // tidak ada satu kalimat pun sebabnya, padahal itu justru satu-satunya
      // keadaan di mana petugas SUDAH memintanya.
      if (arsipDiminta) {
        let nomorArsip = 0;
        for (const a of barisArsip) {
          if (!a?.adaBerkas || !a?.arsipId) continue;
          nomorArsip += 1;
          const berkas = await tarikSipp("arsip", String(a.arsipId), `Arsip fisik ${a.nomor || nomor}`);
          if (!berkas) continue;
          taruh(
            `08 Arsip fisik/${duaAngka(nomorArsip)} - ${namaAman(
              String(a.nomor || nomor),
              `arsip-${a.arsipId}`
            )}.${ekstensiDari(berkas.nama, "pdf")}`,
            berkas.isi,
            {
              jenis: "Berkas arsip",
              tanggal: String(a.tanggalMasuk || ""),
              asal: "arsip (letak fisik)",
            }
          );
        }
        if (nomorArsip === 0) {
          // Empat sebab yang berbeda, dan yang membacanya perlu tahu YANG MANA:
          // hanya sebab ketiga yang berarti "perkaranya memang belum
          // diarsipkan", tiga lainnya menuntut seseorang memeriksa peladen.
          const alasanBerkas = String(s.arsipKeterangan?.alasanBerkas ?? "").trim();
          catat(
            "arsip",
            "08 Arsip fisik",
            `diminta, tetapi tidak ada berkas yang dapat ditarik - ${
              s.arsipKeterangan?.terbaca === false
                ? `keterangan arsip tidak terbaca (${String(s.arsipKeterangan?.alasan ?? "sebab tidak disebutkan")})`
                : s.arsipKeterangan?.berkasTerbaca === false
                  ? alasanBerkas || "folder arsip SIPP tidak terbaca dari container ALETA"
                  : barisArsip.length === 0
                    ? "perkara ini belum tercatat diarsipkan"
                    : `${barisArsip.length} baris arsip tercatat, tetapi tidak satu pun menyebut berkas pindaian`
            }`
          );
        }
      } else if (barisArsip.some((a) => a?.adaBerkas)) {
        catat("arsip", "Berkas pindaian arsip", "tidak diminta (2 MB sampai 28 MB sebuah)", "tidak diminta");
      }
    }

    if (jumlahIsi === 0) {
      // Rute menjawabnya 404 "tidak_ada_berkas_tersimpan"; sinkron Drive
      // mencatatnya sebagai perkara tanpa berkas. Keduanya membaca `dilewati`.
      return {
        isiZip,
        jumlahIsi,
        daftar,
        dilewati,
        takTerbaca,
        totalByte,
        jumlahSippTercatat,
        jumlahEcourtTercatat,
        mulai,
        gagal,
      };
    }

    // ========================================================================
    // DAFTAR ISI - yang dibaca lebih dulu saat minutasi dan banding
    // ========================================================================
    const lebarNama = Math.min(78, Math.max(...daftar.map((b) => b.nama.length), 20));
    const daftarIsi = [
      `DAFTAR ISI - perkara ${nomor}`,
      `Disusun ${tanggalHariPanjang(hariIni, hariIni)}`,
      "",
      `${"BERKAS".padEnd(lebarNama)}  ${"JENIS".padEnd(22)}  ${"TANGGAL".padEnd(10)}  ASAL`,
      `${"-".repeat(lebarNama)}  ${"-".repeat(22)}  ${"-".repeat(10)}  ----`,
      ...daftar.map(
        (b) =>
          // Tanggal bergaya Indonesia, selebar yang ISO - "07-10-2026" sama
          // sepuluh aksaranya dengan "2026-10-07", jadi kolomnya tidak
          // bergeser sedikit pun.
          `${b.nama.padEnd(lebarNama)}  ${b.jenis.padEnd(22)}  ${tanggalDMY(b.tanggal, "-").padEnd(10)}  ${b.asal}`
      ),
      "",
      `Jumlah berkas: ${daftar.length}`,
      `Jumlah byte  : ${totalByte.toLocaleString("id-ID")}`,
      /* === STATUS-ZIP 12 Okt === */
      // Yang tercatat tetapi TIDAK ikut disebut di sini juga (bukan hanya di
      // KETERANGAN.txt) - daftar isi yang hanya memuat yang berhasil membuat
      // yang gagal tampak seperti yang memang tidak pernah ada.
      ...(gagal.length > 0
        ? [
            "",
            `TERCATAT TETAPI TIDAK IKUT (${gagal.length}) - sebab lengkapnya di DAFTAR ISI.csv:`,
            ...gagal.map((g) => `- [${g.status}] ${g.nama}: ${g.sebab}`),
          ]
        : ["", "Tidak ada berkas tercatat yang gagal diambil."]),
      /* === AKHIR STATUS-ZIP === */
    ].join("\r\n");
    simpan({ nama: "DAFTAR ISI.txt", isi: Buffer.from(daftarIsi, "utf8") });

    /* === STATUS-ZIP 12 Okt === */
    // Daftar isi yang dapat DISARING di Excel: satu baris per berkas yang masuk
    // DAN per berkas yang gagal/tidak ikut, dengan statusnya dan sebabnya.
    simpan({
      nama: "DAFTAR ISI.csv",
      isi: Buffer.from(
        tabelCsv(
          ["kategori", "berkas", "jenis", "tanggal", "asal", "ukuran_byte", "status", "sebab"],
          [
            ...daftar.map((b) => [kategoriDariNama(b.nama), b.nama, b.jenis, b.tanggal, b.asal, b.byte, "masuk", ""]),
            ...gagal.map((g) => [g.kategori, g.nama, "", "", "", "", g.status, g.sebab]),
          ]
        ),
        "utf8"
      ),
    });
    /* === AKHIR STATUS-ZIP === */

    // Keterangan SELALU ikut, juga ketika tidak ada yang dilewati - penerima
    // ZIP perlu tahu berapa yang seharusnya ada, bukan hanya berapa yang ada.
    const keterangan = [
      lengkap ? `Arsip perkara ${nomor} - data SIPP dan berkas` : `Arsip berkas perkara ${nomor}`,
      `Disusun ${tanggalHariPanjang(hariIni, hariIni)}`,
      `Sumber yang diminta: ${sumber}`,
      `Isi yang diminta: ${lengkap ? "data SIPP + berkas" : "berkas saja"}`,
      /* === STATUS-ZIP 12 Okt === */
      `Kategori yang diminta: ${
        pilih
          ? KATEGORI_ARSIP.filter((k) => pilih.has(k))
              .map((k) => LABEL_KATEGORI_ARSIP[k])
              .join("; ")
          : "seluruhnya"
      }`,
      /* === AKHIR STATUS-ZIP === */
      `Berkas dalam arsip ini: ${daftar.length}`,
      `Berkas SIPP yang tercatat: ${jumlahSippTercatat}`,
      `Dokumen e-Court yang tercatat: ${jumlahEcourtTercatat}`,
      "",
      dilewati.length > 0 ? "TIDAK IKUT DIKEMAS:" : "Seluruh berkas yang tersimpan ikut dikemas.",
      ...dilewati.map((baris) => `- ${baris}`),
      "",
      // Bagian yang TABELNYA IKUT tetapi isinya tidak dapat dipercaya sebagai
      // "memang tidak ada". Kepalanya berdiri sendiri, bukan di bawah "TIDAK
      // IKUT DIKEMAS", sebab berkasnya memang ikut - dan yang membacanya perlu
      // membedakan tabel yang kosong karena datanya nol dari tabel yang kosong
      // karena SIPP-nya tidak terbaca. Dua fakta berbeda, satu wujud.
      ...(takTerbaca.length > 0
        ? [
            "BAGIAN YANG TIDAK TERBACA - tabelnya ikut, tetapi kosongnya BUKAN berarti",
            "datanya tidak ada. Yang berikut ini harus diperiksa langsung di SIPP:",
            ...takTerbaca.map((baris) => `- ${baris}`),
            "",
          ]
        : lengkap
          ? ["Seluruh bagian data SIPP terbaca; tabel yang kosong memang tidak berisi data.", ""]
          : []),
      "Berkas e-Court yang belum tersimpan dapat ditarik dari menu Kendali Berkas di ALETA.",
      "Berkas SIPP yang tidak terbaca berarti berkasnya tidak ada di cakram server,",
      "walaupun barisnya tercatat di basis data.",
      "",
      "PERHATIAN: arsip ini memuat identitas para pihak, alamat pada resi pos, dan",
      "putusan yang belum dianonimkan. Perlakukan sebagaimana berkas perkara asli.",
      lengkap
        ? [
            "",
            "Folder 00 Data SIPP memuat SELURUH keterangan perkara - termasuk alamat saksi,",
            "keterangan saksi, dan amar yang belum dianonimkan. Pengunduhannya tercatat di",
            "jejak audit ALETA atas nama yang menekannya.",
          ].join("\r\n")
        : "",
    ].join("\r\n");
    simpan({ nama: "KETERANGAN.txt", isi: Buffer.from(keterangan, "utf8") });

    return {
      isiZip,
      jumlahIsi,
      daftar,
      dilewati,
      takTerbaca,
      totalByte,
      jumlahSippTercatat,
      jumlahEcourtTercatat,
      mulai,
      gagal,
    };
  }
}
