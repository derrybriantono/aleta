/**
 * ============================================================================
 * AGEN PENJAGA TENGGAT - MESIN ATURANNYA (TAHAP 3)
 * ============================================================================
 *
 * Berkas ini tidak menyentuh basis data, tidak menyentuh jaringan, dan tidak
 * mengirim apa pun. Ia hanya menerima FAKTA yang sudah dibaca dari SIPP, lalu
 * memutuskan mana yang sudah lewat tenggat, mana yang menjelang, dan
 * menyusunnya menjadi satu laporan yang dapat dibaca di layar telepon.
 *
 * Pemisahan itu disengaja: aturan tenggat adalah bagian yang paling mahal bila
 * keliru - ia menuduh orang lalai - dan bagian yang paling mudah diuji bila
 * dipisahkan dari pembacaan basis datanya.
 *
 * ============================================================================
 * SETIAP AMBANG DI SINI DIUKUR, BUKAN DITEBAK
 * ============================================================================
 *
 * Diukur 15 September 2026 atas sipp_donggala (salinan peladen). Yang paling
 * penting dari seluruh pengukuran itu bukan angka ambangnya, melainkan ini:
 *
 *   ATURAN YANG TAMPAK BENAR MENGHASILKAN 99 TUDUHAN PALSU DARI 101
 *
 * "Akta cerai belum terbit padahal sudah 14 hari sejak BHT" terdengar benar
 * dan menangkap 66 perkara. Diperiksa satu per satu: SELURUH 66 berstatus
 * Dicabut, Digugurkan, Ditolak, Tidak Dapat Diterima, atau Gugur - perceraian
 * yang tidak dikabulkan, yang akta cerainya memang tidak akan pernah terbit.
 * Nol yang sungguhan.
 *
 * "Ikrar talak lewat enam bulan sejak BHT" menangkap 35 (kini acuannya penetapan
 * hari sidang ikrar, bukan BHT - Pasal 70 ayat (6); saringan statusnya tetap). Yang berstatus
 * Dikabulkan hanya 2; sisanya 33 sama sekali tidak menunggu ikrar.
 *
 * Dan 16 Cerai Talak yang tampak terlambat menerbitkan akta cerai ternyata
 * SELURUHNYA sedang menunggu ikrar - pada cerai talak, akta cerai memang
 * dihitung dari tanggal ikrar, bukan dari BHT.
 *
 * Sembilan puluh sembilan pesan yang menuduh orang lalai atas pekerjaan yang
 * memang tidak ada. Sesudah pesan semacam itu terkirim sekali, laporan
 * harian berikutnya tidak akan dibaca lagi - dan itulah cara sebuah penjaga
 * tenggat mati: bukan karena dimatikan, melainkan karena tidak dipercaya.
 *
 * ============================================================================
 * TIGA TINGKAT, DAN YANG PALING BAWAH TIDAK MENUDUH
 * ============================================================================
 *
 *   lewat      tenggatnya sudah terlampaui - perlu dikerjakan
 *   menjelang  masih ada waktu, tetapi tinggal sedikit
 *   catatan    keterangan yang perlu diketahui, bukan kelalaian
 *
 * ============================================================================
 * CAKRAWALA - TUMPUKAN LAMA DIHITUNG, TIDAK DITERIAKKAN
 * ============================================================================
 *
 * Akta cerai yang telat: 81 dari 2015, 24 dari 2016, 3 dari 2018, dan NOL
 * sejak 2019. Tujuh tahun tanpa satu pun keterlambatan - tumpukan itu sisa
 * masa sebelum SIPP dipakai penuh, bukan kelalaian yang dapat dikerjakan
 * siapa pun hari ini.
 *
 * Menyebutkannya tiap pagi selama bertahun-tahun adalah cara tercepat membuat
 * laporan ini diabaikan. Karena itu ia tetap DIHITUNG dan disebut satu baris
 * sebagai tumpukan lama, tetapi tidak pernah dirinci dan tidak pernah
 * dihitung sebagai tenggat yang lewat.
 */

import { sebutanSatuPihak } from "@/lib/sebutan-pihak";

/** Batas cakrawala: yang lebih tua dari ini dihitung sebagai tumpukan lama. */
export const CAKRAWALA_BULAN = 24;

/** Status putusan SIPP yang berarti perceraiannya DIKABULKAN. */
export const STATUS_DIKABULKAN = 62;

/**
 * Catatan pemeriksaan dasar hukum aturan baru (G1). Tadinya setiap aturan bertanda "[PERLU VERIFIKASI Derry]"
 * (25 Okt 2026); Derry memeriksa dan menyetujui dasarnya pada 26 Okt 2026, jadi tandanya diganti catatan ini
 * dan lencana "dasar belum diperiksa" di layar Tenggat tidak muncul lagi. Aturan baru TETAP tidak ikut
 * pengingat WhatsApp sebelum Super Admin memasukkannya ke daftar aturan pengingat (tutup ganda yang disengaja,
 * saklar jadwal dan pengingat tetap mati bawaan).
 */
export const CATATAN_DIPERIKSA = "(diperiksa Derry 26 Okt 2026)";

/**
 * Tingkat butir. "berjalan" HANYA muncul bila pemanggil meminta hitung mundur (layar Tenggat): masa hak
 * (banding/kasasi) yang masih panjang atau mediasi yang masih dalam 30 hari. Laporan WhatsApp tidak pernah
 * memuatnya - ia bukan kelalaian, hanya jam yang sedang berjalan.
 */
export type Tingkat = "lewat" | "menjelang" | "berjalan" | "catatan";

export type FaktaTenggat = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  /** Tanggal yang menjadi acuan hitungan tenggat aturan ini, ISO yyyy-mm-dd. */
  tanggalAcuan: string | null;
  /** Status putusan SIPP - dipakai menyaring aturan yang hanya berlaku bila dikabulkan. */
  statusPutusanId: number | null;
  /** Keterangan tambahan yang ikut ditampilkan, mis. majelis atau agenda. */
  keterangan?: string;
  /** Petugas perkara (teks, nama dipisah koma) - dasar pengingat per orang. Kosong = tidak ada penerima pribadi. */
  majelis?: string;
  panitera?: string;
  jurusita?: string;
  mediator?: string;
  /** Pihak yang dihitung (1 = pihak pertama, 2 = pihak kedua) pada aturan per pihak (banding). */
  pihakKe?: number;
  alurPerkaraId?: number;
  jenisPerkaraId?: number;
  /** Batas TEGAS dari pembaca fakta (mis. 6 bulan kalender ikrar). Menang atas tanggalAcuan + batasHari. */
  tanggalBatas?: string;
  /** Dari mana hitungan dimulai: putusan diucapkan, atau pemberitahuan putusan. */
  dasarMulai?: "putusan" | "pemberitahuan";
  /** Salah bila kehadiran/dasar mulai tidak pasti: masa hak tidak boleh dinyatakan "sudah berakhir". */
  pasti?: boolean;
  /** Benar bila hitungan BELUM dimulai karena pemberitahuan putusan belum tercatat. */
  menunggu?: boolean;
};

export type Butir = {
  aturan: string;
  judul: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalAcuan: string;
  /** Positif = sudah lewat sekian hari. Negatif = sisa sekian hari. */
  selisihHari: number;
  /**
   * Jarak hari ke PERISTIWA pada tanggal acuan - positif berarti akan datang.
   * Hanya berarti pada aturan yang acuannya di depan; di situlah kalimatnya
   * disusun dari angka ini, bukan dari selisihHari.
   */
  hariKePeristiwa: number;
  tingkat: Tingkat;
  tindakan: string;
  keterangan: string;
  /** Hari terakhir menurut aturan (yyyy-mm-dd), atau "" bila aturan tidak punya batas ke depan. */
  tanggalBatas: string;
  /** Sebutan pihak yang dihitung ("Penggugat"), atau "" pada aturan yang tidak per pihak. */
  pihak: string;
  /** Petugas perkara - dasar penyaringan "perkara saya" dan pengingat pribadi. */
  majelis: string;
  panitera: string;
  jurusita: string;
  mediator: string;
  /** Dasar hukumnya belum diperiksa Derry (aturan G1 sudah diperiksa 26 Okt 2026, jadi salah). */
  perluVerifikasi: boolean;
  /** Hitungan belum dimulai (pemberitahuan putusan belum tercatat). */
  menunggu: boolean;
};

export type Aturan = {
  kode: string;
  judul: string;
  /** Dasar hukum atau dasar praktiknya - ikut disebut di laporan. */
  dasar: string;
  /** Sesudah sekian hari dari tanggalAcuan, tenggatnya terlampaui. */
  batasHari: number;
  /**
   * Sisa hari ketika aturan mulai memperingatkan. 0 berarti tidak pernah
   * memperingatkan lebih dahulu - hanya berbunyi sesudah lewat.
   */
  peringatanHari: number;
  /** Yang harus dikerjakan bila butir ini muncul. Kalimat perintah. */
  tindakan: string;
  /** Bila benar, aturan hanya berlaku pada perkara yang perceraiannya dikabulkan. */
  hanyaDikabulkan: boolean;
  /** Bila benar, butir tidak pernah bertingkat "lewat" - ia keterangan. */
  selaluCatatan?: boolean;
  /**
   * Bila benar, tanggal acuannya adalah PERISTIWA YANG AKAN DATANG (tanggal
   * sidang), bukan peristiwa yang sudah lewat (tanggal BHT).
   *
   * Ini menentukan cara menyebutnya, dan salah menyebut di sini menghasilkan
   * kalimat yang benar secara hitungan tetapi menyesatkan dibaca:
   * "544/Pdt.G/2026 - sudah 3 hari - sidang 15-09-2026" pada hari 15 September.
   * Sidangnya hari ini; yang "sudah 3 hari" adalah jarak ke ambang, angka
   * dalam kepala mesin yang tidak berarti apa-apa bagi yang membacanya.
   */
  acuanDiDepan?: boolean;
  /**
   * Masa HAK para pihak (banding, kasasi), bukan kewajiban petugas. Akibatnya: lewat batas BUKAN "lewat
   * tenggat" (tidak menuduh siapa pun) melainkan catatan "masa berakhir, periksa langkah berikutnya", dan
   * hanya selama `jendelaCatatanHari` hari sesudahnya supaya tidak menjadi tumpukan.
   */
  masaHak?: boolean;
  jendelaCatatanHari?: number;
  /** Dasar hukum belum diperiksa Derry. Aturan G1 sudah diperiksa 26 Okt 2026 (lihat CATATAN_DIPERIKSA). */
  perluVerifikasi?: boolean;
  /** Sebut hari terakhirnya pada tiap baris laporan ("batas 29-10-2026"). */
  tampilBatas?: boolean;
};

/**
 * ============================================================================
 * DAFTAR ATURAN
 * ============================================================================
 *
 * Tiap baris membawa angka hasil pengukurannya sendiri pada komentar, supaya
 * yang menggantinya tahu apa yang wajar dan apa yang berarti ada perubahan.
 */
export const ATURAN_TENGGAT: Aturan[] = [
  {
    kode: "umur-perkara",
    judul: "Perkara belum putus melewati 5 bulan",
    dasar: "SEMA 2 Tahun 2014",
    batasHari: 150,
    // Diukur: dari 107 perkara yang belum putus, 1 melewati 5 bulan, 1 pada
    // bulan kelima, 3 pada bulan keempat. Peringatan pada sisa 30 hari
    // karena itu menyentuh satu perkara, bukan seluruh daftar.
    peringatanHari: 30,
    tindakan: "Periksa hambatannya dan jadwalkan penyelesaian.",
    hanyaDikabulkan: false,
  },
  {
    kode: "ikrar-talak",
    judul: "Ikrar talak belum diucapkan - penetapan gugur bila lewat 6 bulan",
    dasar: "Pasal 70 ayat (6) UU 7 Tahun 1989 - 6 bulan sejak ditetapkan hari sidang ikrar (bukan BHT)",
    // tanggalAcuan = penetapan hari sidang ikrar (keputusan pengguna no. 91, 18 Okt 2026).
    // Mesin ini hanya mengenal hari: 180 hari lebih awal 1-4 hari daripada 6 bulan kalender
    // (181-184 hari) - sedikit lebih hati-hati, tidak pernah terlambat.
    batasHari: 180,
    peringatanHari: 30,
    // Diukur (dasar BHT lama): tanpa saringan dikabulkan, 35 tertangkap dan hanya 2 sungguhan.
    // Sesudah disaring dan dibatasi cakrawala: 2 dari 2025, nol dari 2026.
    tindakan: "Panggil Pemohon untuk ikrar sebelum penetapannya gugur.",
    hanyaDikabulkan: true,
  },
  {
    kode: "akta-cerai-gugat",
    judul: "Akta cerai belum terbit - Cerai Gugat",
    dasar: "Dihitung sejak putusan berkekuatan hukum tetap",
    batasHari: 14,
    peringatanHari: 7,
    // Diukur atas 386 akta cerai terbit 2026: rata-rata 3,4 hari sejak BHT,
    // 336 di antaranya kurang dari 7 hari. Ambang 14 hari karena itu longgar
    // dua kali lipat dari kebiasaan satker ini sendiri.
    tindakan: "Terbitkan akta cerai.",
    hanyaDikabulkan: true,
  },
  {
    kode: "akta-cerai-talak",
    judul: "Akta cerai belum terbit - Cerai Talak (sejak ikrar)",
    dasar: "Dihitung sejak ikrar talak diucapkan, BUKAN sejak BHT",
    batasHari: 14,
    peringatanHari: 7,
    // Inilah aturan yang paling mudah ditulis keliru. Menghitungnya dari BHT
    // menuduh 16 perkara terlambat, padahal seluruh 16 sedang menunggu
    // ikrarnya - pekerjaan yang belum boleh dikerjakan, bukan yang terlambat.
    tindakan: "Terbitkan akta cerai.",
    hanyaDikabulkan: true,
  },
  {
    kode: "relaas-sidang-pertama",
    judul: "Sidang pertama sudah dekat, relaas belum kembali",
    dasar: "Panggilan patut - Pasal 26 PP 9 Tahun 1975",
    // Tanggal acuannya tanggal sidang, dan tenggatnya SEBELUM tanggal itu.
    // Karena itu batasnya negatif: lewat berarti tinggal kurang dari 3 hari.
    batasHari: -3,
    peringatanHari: 4,
    // Diukur atas 2.039 sidang pertama sepanjang setahun: jeda relaas ke
    // sidang rata-rata 16,6 hari, dan hanya 53 (2,6%) kurang dari 3 hari.
    // Setahun penuh: 1.021 sidang pertama, 10 tanpa relaas sama sekali -
    // kurang dari satu persen. Yang tertangkap aturan ini memang kejanggalan.
    tindakan: "Pastikan relaas sudah dilaksanakan dan dikembalikan.",
    hanyaDikabulkan: false,
    acuanDiDepan: true,
  },
  {
    kode: "dirput-gagal",
    judul: "Pengiriman ke Direktori Putusan gagal",
    dasar: "Antrean dirput_antrian berstatus gagal",
    batasHari: 0,
    peringatanHari: 0,
    // Diukur: 4 gagal, percobaan terakhir 9 April 2026 - lima bulan tidak
    // ada yang menyadarinya, sebab tidak ada satu pun layar yang menyebutnya.
    tindakan: "Periksa keterangan gagalnya lalu kirim ulang.",
    hanyaDikabulkan: false,
  },
  {
    kode: "anonimisasi-hilang",
    judul: "Putusan tanpa berkas anonimisasi",
    dasar: "Bentuk yang diminta Direktori Putusan",
    batasHari: 14,
    peringatanHari: 0,
    // Diukur atas 693 putusan 2026: 0 tanpa dokumen putusan, 1 tanpa
    // anonimisasi. Aturan ini karena itu hampir selalu diam - dan ketika
    // berbunyi, ia menunjuk satu berkas yang memang hilang.
    tindakan: "Jalankan anonimisasi lalu unggah ke SIPP.",
    hanyaDikabulkan: false,
    selaluCatatan: true,
  },
];

/**
 * ============================================================================
 * ATURAN BARU (G1, 25 Okt 2026) - banding, kasasi, mediasi
 * ============================================================================
 *
 * Dipisah dari ATURAN_TENGGAT dengan sengaja: nilaiTenggat() tanpa opsi memakai ATURAN_TENGGAT saja, jadi
 * rute dan laporan lama berbunyi persis seperti sebelum G1. Aturan di bawah dinyalakan oleh jadwal harian /
 * layar Tenggat (opsi.aturan = SEMUA_ATURAN).
 *
 * HUKUM ACARA: Pengadilan Agama di luar Jawa-Madura memakai RBg, BUKAN HIR. Semua dasar di bawah ditulis
 * apa adanya dan sudah diperiksa Derry 26 Okt 2026 (lihat CATATAN_DIPERIKSA);
 * aturannya tetap hanya masuk pengingat WhatsApp bila Super Admin memilihnya. Angka hari TIDAK diukur atas SIPP (SIPP mati sampai 26 Okt) - skrip ukur
 * dijalankan di laptop (lihat laporan-rantai-G).
 */
export const ATURAN_BARU: Aturan[] = [
  {
    kode: "banding-14-hari",
    judul: "Masa banding 14 hari",
    // Pasal 199 RBg: permohonan banding dalam 14 hari sejak putusan diucapkan, atau
    // sejak diberitahukan bagi pihak yang tidak hadir (Pasal 7 UU 20/1947 untuk Jawa-Madura). Cara hitung
    // per pihak mengikuti appealDeadlineService (aturan lama, tidak digandakan).
    dasar: "Pasal 199 RBg - 14 hari sejak putusan diucapkan, atau sejak diberitahukan bagi pihak yang tidak hadir " + CATATAN_DIPERIKSA,
    batasHari: 14,
    // Hanya 3 hari terakhir yang masuk pengingat; sisanya tampil sebagai "berjalan" di layar Tenggat.
    peringatanHari: 3,
    tindakan:
      "Pastikan pemberitahuan putusan sudah disampaikan ke pihak yang tidak hadir; bila masa berakhir tanpa banding, periksa pernyataan BHT.",
    hanyaDikabulkan: false,
    masaHak: true,
    // Putusan lebih dari 30 hari sesudah masa berakhir dan belum BHT adalah urusan lain (BHT/akta), bukan catatan masa banding.
    jendelaCatatanHari: 30,
    perluVerifikasi: false,
    tampilBatas: true,
  },
  {
    kode: "kasasi-14-hari",
    judul: "Masa kasasi 14 hari",
    // Pasal 46 ayat (1) UU 14/1985 jo UU 5/2004 jo UU 3/2009: 14 hari sejak putusan
    // (banding) diberitahukan kepada pemohon kasasi. Hitungan memakai tanggal pemberitahuan putusan banding
    // di SIPP; tanpa tanggal itu hanya catatan "belum berjalan".
    dasar: "Pasal 46 ayat (1) UU 14/1985 jo UU 3/2009 - 14 hari sejak putusan banding diberitahukan " + CATATAN_DIPERIKSA,
    batasHari: 14,
    peringatanHari: 3,
    tindakan:
      "Pastikan putusan banding sudah diberitahukan ke para pihak; bila masa berakhir tanpa kasasi, periksa pernyataan BHT.",
    hanyaDikabulkan: false,
    masaHak: true,
    jendelaCatatanHari: 30,
    perluVerifikasi: false,
    tampilBatas: true,
  },
  {
    kode: "mediasi-30-hari",
    judul: "Mediasi melewati 30 hari tanpa laporan mediator",
    // Pasal 24 ayat (2) PERMA 1/2016: 30 hari sejak penetapan perintah melakukan
    // mediasi (di sini: penetapan penunjukan mediator di SIPP). Ayat (3) memungkinkan perpanjangan atas
    // kesepakatan para pihak - perpanjangan TIDAK terbaca dari SIPP, jadi butir ini hanya mengingatkan.
    dasar: "Pasal 24 ayat (2) PERMA 1/2016 - 30 hari sejak penetapan mediator (perpanjangan tidak terbaca dari SIPP) " + CATATAN_DIPERIKSA,
    // Harus sama dengan sippJadwalSidangService.BATAS_MEDIASI_HARI (dijaga uji).
    batasHari: 30,
    peringatanHari: 7,
    tindakan: "Minta laporan mediator, atau pastikan ada penetapan perpanjangan mediasi.",
    hanyaDikabulkan: false,
    perluVerifikasi: false,
    tampilBatas: true,
  },
];

/** Aturan lama + baru: dipakai jadwal harian dan layar Tenggat. */
export const SEMUA_ATURAN: Aturan[] = [...ATURAN_TENGGAT, ...ATURAN_BARU];

/** Peta ketujuh aturan LAMA (bentuk dan isinya tidak berubah; dijaga penjaga-tenggat.test.ts). */
export const PETA_ATURAN: ReadonlyMap<string, Aturan> = new Map(
  ATURAN_TENGGAT.map((a) => [a.kode, a])
);

/** Peta SEMUA aturan (lama + baru G1): dipakai laporan, layar Tenggat, dan jadwal harian. */
export const PETA_SEMUA_ATURAN: ReadonlyMap<string, Aturan> = new Map(
  SEMUA_ATURAN.map((a) => [a.kode, a])
);

/** Tanggal ISO yyyy-mm-dd dari Date atau teks, atau "" bila tidak terbaca. */
export function tanggalIso(nilai: unknown): string {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const y = nilai.getFullYear();
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${y}-${b}-${h}`;
  }
  const teks = String(nilai).trim();
  const cocok = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return cocok ? `${cocok[1]}-${cocok[2]}-${cocok[3]}` : "";
}

/**
 * Selisih hari penuh antara dua tanggal ISO. Positif bila `sesudah` lebih
 * kemudian. Dihitung atas tengah hari UTC supaya pergantian waktu musim panas
 * di mesin mana pun tidak pernah menggeser hasilnya satu hari.
 */
export function selisihHari(sebelum: string, sesudah: string): number {
  const a = Date.parse(`${sebelum}T12:00:00Z`);
  const b = Date.parse(`${sesudah}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Benar bila tanggal acuannya lebih tua daripada cakrawala. */
export function tumpukanLama(tanggalAcuan: string, acuanHariIni: string): boolean {
  if (!tanggalAcuan) return false;
  return selisihHari(tanggalAcuan, acuanHariIni) > CAKRAWALA_BULAN * 30;
}

/** "2026-10-29" -> "29-10-2026"; selain itu apa adanya. */
export function tanggalPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso || "");
}

export type OpsiNilai = {
  /** Aturan yang dinilai. Bawaan: ATURAN_TENGGAT (perilaku lama persis). */
  aturan?: readonly Aturan[];
  /** Ikut menghasilkan butir "berjalan" (hitung mundur) untuk layar Tenggat. Bawaan: tidak. */
  hitungMundur?: boolean;
};

/** Sebutan pihak butir ("Penggugat") dari nomor sebutan di fakta; "" bila fakta tidak per pihak. */
function sebutPihakFakta(fakta: FaktaTenggat): string {
  if (!fakta.pihakKe) return "";
  return sebutanSatuPihak(fakta.pihakKe, {
    alurPerkaraId: fakta.alurPerkaraId ?? null,
    jenisPerkaraId: fakta.jenisPerkaraId ?? null,
    jenisPerkaraNama: fakta.jenisPerkara,
    nomorPerkara: fakta.nomorPerkara,
  });
}

/** Kalimat dasar hitungan satu pihak: "Penggugat, dihitung dari putusan 12-10-2026". */
function keteranganPihak(fakta: FaktaTenggat, pihak: string, acuan: string): string {
  if (!pihak) return "";
  const dasar = fakta.dasarMulai === "pemberitahuan" ? "pemberitahuan" : "putusan";
  const ragu = fakta.pasti === false ? " (kehadiran saat putusan tidak tercatat)" : "";
  return `${pihak}, dihitung dari ${dasar} ${tanggalPendek(acuan)}${ragu}`;
}

function tambahHariIso(iso: string, hari: number): string {
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCDate(t.getUTCDate() + hari);
  return tanggalIso(t.toISOString());
}

type BahanButir = {
  acuan: string;
  batas: string;
  pihak: string;
  selisih: number;
  acuanHariIni: string;
  tingkat: Tingkat;
  menunggu: boolean;
  keterangan: string;
};

function susunButir(aturan: Aturan, fakta: FaktaTenggat, s: BahanButir): Butir {
  return {
    aturan: aturan.kode,
    judul: aturan.judul,
    perkaraId: String(fakta.perkaraId || ""),
    nomorPerkara: String(fakta.nomorPerkara || ""),
    jenisPerkara: String(fakta.jenisPerkara || ""),
    tanggalAcuan: s.acuan,
    selisihHari: s.selisih,
    hariKePeristiwa: selisihHari(s.acuanHariIni, s.acuan),
    tingkat: s.tingkat,
    tindakan: aturan.tindakan,
    keterangan: s.keterangan,
    tanggalBatas: s.batas,
    pihak: s.pihak,
    majelis: String(fakta.majelis || ""),
    panitera: String(fakta.panitera || ""),
    jurusita: String(fakta.jurusita || ""),
    mediator: String(fakta.mediator || ""),
    perluVerifikasi: Boolean(aturan.perluVerifikasi),
    menunggu: s.menunggu,
  };
}

/**
 * Menilai satu fakta terhadap satu aturan.
 *
 * Pulang null bila tidak ada yang perlu disebut - dan itulah keadaan yang
 * paling sering, sebagaimana seharusnya.
 */
export function nilaiSatu(
  aturan: Aturan,
  fakta: FaktaTenggat,
  acuanHariIni: string,
  opsi: Pick<OpsiNilai, "hitungMundur"> = {}
): Butir | null {
  const acuan = tanggalIso(fakta.tanggalAcuan);
  if (!acuan) return null;

  // Saringan yang mencegah 99 dari 101 tuduhan palsu. Ditulis sebagai
  // penolakan lebih dahulu, bukan sebagai syarat tambahan di belakang -
  // supaya yang membacanya melihatnya sebelum melihat hitungannya.
  if (aturan.hanyaDikabulkan && fakta.statusPutusanId !== STATUS_DIKABULKAN) return null;

  const pihak = sebutPihakFakta(fakta);
  const batasTegas = tanggalIso(fakta.tanggalBatas);
  const batas = batasTegas || (aturan.batasHari >= 0 && !aturan.acuanDiDepan ? tambahHariIso(acuan, aturan.batasHari) : "");

  // Hitungan yang BELUM dimulai (pihak tidak hadir, pemberitahuan putusan belum tercatat): hanya catatan, tanpa tanggal.
  if (fakta.menunggu) {
    if (!aturan.masaHak) return null;
    const umur = selisihHari(acuan, acuanHariIni);
    // Lama sesudah itu urusannya bukan lagi catatan masa hak, melainkan pemberitahuan yang tidak pernah dibuat.
    if (umur < 0 || umur > (aturan.jendelaCatatanHari ?? 30) + aturan.batasHari) return null;
    return susunButir(aturan, fakta, {
      acuan,
      batas: "",
      pihak,
      selisih: -aturan.batasHari,
      acuanHariIni,
      tingkat: "catatan",
      menunggu: true,
      keterangan: [
        pihak ? `${pihak}: pemberitahuan putusan belum tercatat - masa belum berjalan` : "pemberitahuan belum tercatat - masa belum berjalan",
        `dasar ${tanggalPendek(acuan)}, ${umur} hari lalu`,
      ].join(" · "),
    });
  }

  const lewatHari = batas ? selisihHari(batas, acuanHariIni) : selisihHari(acuan, acuanHariIni) - aturan.batasHari;

  let tingkat: Tingkat;
  if (aturan.selaluCatatan) {
    if (lewatHari < 0) return null;
    tingkat = "catatan";
  } else if (aturan.masaHak) {
    if (lewatHari > 0) {
      // Masa hak berakhir BUKAN kelalaian. Hanya catatan, dan hanya bila yakin pihaknya hadir/diberitahu.
      if (fakta.pasti === false) return null;
      if (lewatHari > (aturan.jendelaCatatanHari ?? 30)) return null;
      tingkat = "catatan";
    } else if (aturan.peringatanHari > 0 && lewatHari >= -aturan.peringatanHari) {
      tingkat = "menjelang";
    } else if (opsi.hitungMundur) {
      tingkat = "berjalan";
    } else {
      return null;
    }
  } else if (lewatHari > 0) {
    tingkat = "lewat";
  } else if (aturan.peringatanHari > 0 && lewatHari >= -aturan.peringatanHari) {
    tingkat = "menjelang";
  } else if (opsi.hitungMundur && aturan.tampilBatas && aturan.batasHari > 0 && !aturan.acuanDiDepan && Boolean(batas)) {
    tingkat = "berjalan";
  } else {
    return null;
  }

  // Tumpukan lama tidak pernah dirinci sebagai tenggat yang lewat. Ia dihitung
  // di tempat lain dan disebut satu baris.
  if (tingkat === "lewat" && tumpukanLama(acuan, acuanHariIni)) return null;

  return susunButir(aturan, fakta, {
    acuan,
    batas,
    pihak,
    selisih: lewatHari,
    acuanHariIni,
    tingkat,
    menunggu: false,
    keterangan: [keteranganPihak(fakta, pihak, acuan), String(fakta.keterangan || "")].filter(Boolean).join(" · "),
  });
}

export type Rapor = {
  acuan: string;
  butir: Butir[];
  /** Jumlah per tingkat - dipakai kepala laporan. */
  hitung: { lewat: number; menjelang: number; catatan: number };
  /** Yang lebih tua daripada cakrawala, per aturan. Disebut, tidak dirinci. */
  tumpukanLama: Record<string, number>;
  /** Jumlah butir "berjalan" (hitung mundur) - terpisah supaya `hitung` lama tidak berubah bentuk. */
  berjalan: number;
};

/** Menilai seluruh fakta, dikelompokkan menurut kode aturan. */
export function nilaiTenggat(
  fakta: Record<string, FaktaTenggat[]>,
  acuanHariIni: string,
  opsi: OpsiNilai = {}
): Rapor {
  const butir: Butir[] = [];
  const lama: Record<string, number> = {};
  const daftarAturan = opsi.aturan ?? ATURAN_TENGGAT;

  for (const aturan of daftarAturan) {
    for (const satu of fakta[aturan.kode] || []) {
      const acuan = tanggalIso(satu.tanggalAcuan);
      const layak = !aturan.hanyaDikabulkan || satu.statusPutusanId === STATUS_DIKABULKAN;
      if (layak && acuan && !aturan.masaHak && tumpukanLama(acuan, acuanHariIni)) {
        const lewat = selisihHari(acuan, acuanHariIni) - aturan.batasHari;
        if (lewat > 0) lama[aturan.kode] = (lama[aturan.kode] || 0) + 1;
      }
      const hasil = nilaiSatu(aturan, satu, acuanHariIni, { hitungMundur: opsi.hitungMundur });
      if (hasil) butir.push(hasil);
    }
  }

  // Yang paling lama terlampaui berdiri di atas. Dalam satu aturan, yang
  // paling mendesak dikerjakan lebih dahulu - bukan menurut nomor perkara.
  const bobot: Record<Tingkat, number> = { lewat: 0, menjelang: 1, berjalan: 2, catatan: 3 };
  butir.sort(
    (a, b) =>
      bobot[a.tingkat] - bobot[b.tingkat] ||
      b.selisihHari - a.selisihHari ||
      a.nomorPerkara.localeCompare(b.nomorPerkara)
  );

  return {
    acuan: acuanHariIni,
    butir,
    hitung: {
      lewat: butir.filter((x) => x.tingkat === "lewat").length,
      menjelang: butir.filter((x) => x.tingkat === "menjelang").length,
      catatan: butir.filter((x) => x.tingkat === "catatan").length,
    },
    tumpukanLama: lama,
    berjalan: butir.filter((x) => x.tingkat === "berjalan").length,
  };
}

/* ========================================================================== */
/* LAPORAN HARIAN - DISUSUN UNTUK LAYAR TELEPON                               */
/* ========================================================================== */

/**
 * Berapa perkara dirinci per aturan sebelum sisanya diringkas.
 *
 * Laporan WhatsApp yang menuntut digulung dua puluh layar tidak dibaca sampai
 * habis, dan yang di bawah tidak pernah terbaca sama sekali. Lima cukup untuk
 * memberi gambaran; sisanya disebut jumlahnya dan dibuka di portal.
 */
export const BATAS_RINCI = 5;

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "Selasa, 15 September 2026" dari ISO. */
export function tanggalPanjang(iso: string): string {
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return iso;
  return `${NAMA_HARI[t.getUTCDay()]}, ${t.getUTCDate()} ${NAMA_BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/** "sudah 12 hari" / "tinggal 3 hari" / "jatuh tempo hari ini". */
export function sebutSelisih(hari: number): string {
  if (hari > 0) return `sudah ${hari} hari`;
  if (hari === 0) return "jatuh tempo hari ini";
  return `tinggal ${Math.abs(hari)} hari`;
}

/** "hari ini" / "besok" / "3 hari lagi" / "3 hari yang lalu". */
export function sebutPeristiwa(hari: number): string {
  if (hari === 0) return "hari ini";
  if (hari === 1) return "besok";
  if (hari > 1) return `${hari} hari lagi`;
  if (hari === -1) return "kemarin";
  return `${Math.abs(hari)} hari yang lalu`;
}

export type OpsiLaporan = {
  /** Nama satuan kerja, disebut pada kepala. */
  satker?: string;
  /** Alamat portal untuk membuka rinciannya. */
  tautan?: string;
  batasRinci?: number;
  /** Judul kepala. Bawaan "PENJAGA TENGGAT"; pengingat pribadi memakai "PENGINGAT TENGGAT". */
  judul?: string;
  /** Baris tambahan tepat di bawah tanggal (mis. nama penerima). */
  sapaan?: string;
};

/**
 * Menyusun laporan harian sebagai teks WhatsApp.
 *
 * ============================================================================
 * HARI YANG BERSIH TETAP DILAPORKAN
 * ============================================================================
 *
 * Laporan yang hanya terkirim ketika ada masalah tidak dapat dibedakan dari
 * laporan yang gagal terkirim. Yang menerimanya tidak pernah tahu apakah
 * pagi ini memang bersih atau botnya mati semalam.
 *
 * Karena itu hari tanpa temuan tetap mengirim satu baris - pendek, dan justru
 * itulah kabar baiknya.
 */
export function susunLaporanHarian(rapor: Rapor, opsi: OpsiLaporan = {}): string {
  const batas = opsi.batasRinci ?? BATAS_RINCI;
  const baris: string[] = [];
  const satker = opsi.satker ? ` ${opsi.satker}` : "";

  baris.push(`*${opsi.judul || "PENJAGA TENGGAT"}${satker}*`);
  baris.push(tanggalPanjang(rapor.acuan));
  if (opsi.sapaan) baris.push(opsi.sapaan);
  baris.push("");

  if (rapor.butir.length === 0) {
    baris.push("Tidak ada tenggat yang terlampaui atau menjelang hari ini.");
    const jumlahLama = Object.values(rapor.tumpukanLama).reduce((a, b) => a + b, 0);
    if (jumlahLama > 0) {
      baris.push("");
      baris.push(`_Tumpukan lama (sebelum ${CAKRAWALA_BULAN} bulan terakhir): ${jumlahLama} perkara - tidak dirinci._`);
    }
    if (opsi.tautan) baris.push("", opsi.tautan);
    return baris.join("\n");
  }

  const { lewat, menjelang, catatan } = rapor.hitung;
  const ringkas: string[] = [];
  if (lewat > 0) ringkas.push(`${lewat} lewat tenggat`);
  if (menjelang > 0) ringkas.push(`${menjelang} menjelang`);
  if (catatan > 0) ringkas.push(`${catatan} catatan`);
  baris.push(ringkas.join(" · "));

  const urutTingkat: Tingkat[] = ["lewat", "menjelang", "catatan"];
  const kepala: Record<Tingkat, string> = {
    lewat: "⚠ SUDAH LEWAT TENGGAT",
    menjelang: "◷ MENJELANG",
    // "berjalan" tidak pernah masuk laporan WhatsApp (urutTingkat di atas tidak memuatnya); ada di sini hanya agar Record lengkap.
    berjalan: "◔ BERJALAN",
    catatan: "· CATATAN",
  };

  for (const tingkat of urutTingkat) {
    const sebagian = rapor.butir.filter((x) => x.tingkat === tingkat);
    if (sebagian.length === 0) continue;
    baris.push("", `*${kepala[tingkat]}*`);

    // Dikelompokkan menurut aturannya, bukan dituang sebagai satu daftar
    // panjang: yang menerimanya mengerjakan satu jenis pekerjaan sekaligus.
    const perAturan = new Map<string, Butir[]>();
    for (const b of sebagian) {
      const ada = perAturan.get(b.aturan);
      if (ada) ada.push(b);
      else perAturan.set(b.aturan, [b]);
    }

    for (const [kode, daftar] of perAturan) {
      const aturan = PETA_SEMUA_ATURAN.get(kode);
      baris.push("", `${daftar[0].judul} (${daftar.length})`);
      if (aturan) baris.push(`_${aturan.dasar}_`);
      for (const b of daftar.slice(0, batas)) {
        // Aturan yang acuannya di depan disebut menurut PERISTIWANYA.
        // "sidang hari ini" dapat dikerjakan; "sudah 3 hari" tidak.
        const sisa = aturan?.acuanDiDepan
          ? `sidang ${sebutPeristiwa(b.hariKePeristiwa)}`
          : sebutSelisih(b.selisihHari);
        const batasTeks = aturan?.tampilBatas && b.tanggalBatas ? ` · batas ${tanggalPendek(b.tanggalBatas)}` : "";
        const tambahan = (b.keterangan ? ` · ${b.keterangan}` : "") + batasTeks;
        baris.push(`• ${b.nomorPerkara} — ${sisa}${tambahan}`);
      }
      if (daftar.length > batas) baris.push(`  _…${daftar.length - batas} perkara lagi_`);
      if (aturan && tingkat !== "catatan") baris.push(`→ ${aturan.tindakan}`);
    }
  }

  const jumlahLama = Object.values(rapor.tumpukanLama).reduce((a, b) => a + b, 0);
  if (jumlahLama > 0) {
    baris.push("");
    baris.push(`_Tumpukan lama (sebelum ${CAKRAWALA_BULAN} bulan terakhir): ${jumlahLama} perkara - tidak dirinci di sini._`);
  }

  baris.push("");
  baris.push("_Usulan ALETA dari data SIPP. Yang memutus tetap pejabat yang berwenang._");
  if (opsi.tautan) baris.push(opsi.tautan);

  return baris.join("\n");
}
