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

/** Batas cakrawala: yang lebih tua dari ini dihitung sebagai tumpukan lama. */
export const CAKRAWALA_BULAN = 24;

/** Status putusan SIPP yang berarti perceraiannya DIKABULKAN. */
export const STATUS_DIKABULKAN = 62;

export type Tingkat = "lewat" | "menjelang" | "catatan";

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

export const PETA_ATURAN: ReadonlyMap<string, Aturan> = new Map(
  ATURAN_TENGGAT.map((a) => [a.kode, a])
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

/**
 * Menilai satu fakta terhadap satu aturan.
 *
 * Pulang null bila tidak ada yang perlu disebut - dan itulah keadaan yang
 * paling sering, sebagaimana seharusnya.
 */
export function nilaiSatu(aturan: Aturan, fakta: FaktaTenggat, acuanHariIni: string): Butir | null {
  const acuan = tanggalIso(fakta.tanggalAcuan);
  if (!acuan) return null;

  // Saringan yang mencegah 99 dari 101 tuduhan palsu. Ditulis sebagai
  // penolakan lebih dahulu, bukan sebagai syarat tambahan di belakang -
  // supaya yang membacanya melihatnya sebelum melihat hitungannya.
  if (aturan.hanyaDikabulkan && fakta.statusPutusanId !== STATUS_DIKABULKAN) return null;

  const lewatHari = selisihHari(acuan, acuanHariIni) - aturan.batasHari;

  let tingkat: Tingkat;
  if (aturan.selaluCatatan) {
    if (lewatHari < 0) return null;
    tingkat = "catatan";
  } else if (lewatHari > 0) {
    tingkat = "lewat";
  } else if (aturan.peringatanHari > 0 && lewatHari >= -aturan.peringatanHari) {
    tingkat = "menjelang";
  } else {
    return null;
  }

  // Tumpukan lama tidak pernah dirinci sebagai tenggat yang lewat. Ia dihitung
  // di tempat lain dan disebut satu baris.
  if (tingkat === "lewat" && tumpukanLama(acuan, acuanHariIni)) return null;

  return {
    aturan: aturan.kode,
    judul: aturan.judul,
    perkaraId: String(fakta.perkaraId || ""),
    nomorPerkara: String(fakta.nomorPerkara || ""),
    jenisPerkara: String(fakta.jenisPerkara || ""),
    tanggalAcuan: acuan,
    selisihHari: lewatHari,
    hariKePeristiwa: selisihHari(acuanHariIni, acuan),
    tingkat,
    tindakan: aturan.tindakan,
    keterangan: String(fakta.keterangan || ""),
  };
}

export type Rapor = {
  acuan: string;
  butir: Butir[];
  /** Jumlah per tingkat - dipakai kepala laporan. */
  hitung: { lewat: number; menjelang: number; catatan: number };
  /** Yang lebih tua daripada cakrawala, per aturan. Disebut, tidak dirinci. */
  tumpukanLama: Record<string, number>;
};

/** Menilai seluruh fakta, dikelompokkan menurut kode aturan. */
export function nilaiTenggat(
  fakta: Record<string, FaktaTenggat[]>,
  acuanHariIni: string
): Rapor {
  const butir: Butir[] = [];
  const lama: Record<string, number> = {};

  for (const aturan of ATURAN_TENGGAT) {
    for (const satu of fakta[aturan.kode] || []) {
      const acuan = tanggalIso(satu.tanggalAcuan);
      const layak = !aturan.hanyaDikabulkan || satu.statusPutusanId === STATUS_DIKABULKAN;
      if (layak && acuan && tumpukanLama(acuan, acuanHariIni)) {
        const lewat = selisihHari(acuan, acuanHariIni) - aturan.batasHari;
        if (lewat > 0) lama[aturan.kode] = (lama[aturan.kode] || 0) + 1;
      }
      const hasil = nilaiSatu(aturan, satu, acuanHariIni);
      if (hasil) butir.push(hasil);
    }
  }

  // Yang paling lama terlampaui berdiri di atas. Dalam satu aturan, yang
  // paling mendesak dikerjakan lebih dahulu - bukan menurut nomor perkara.
  const bobot: Record<Tingkat, number> = { lewat: 0, menjelang: 1, catatan: 2 };
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

  baris.push(`*PENJAGA TENGGAT${satker}*`);
  baris.push(tanggalPanjang(rapor.acuan));
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
      const aturan = PETA_ATURAN.get(kode);
      baris.push("", `${daftar[0].judul} (${daftar.length})`);
      if (aturan) baris.push(`_${aturan.dasar}_`);
      for (const b of daftar.slice(0, batas)) {
        // Aturan yang acuannya di depan disebut menurut PERISTIWANYA.
        // "sidang hari ini" dapat dikerjakan; "sudah 3 hari" tidak.
        const sisa = aturan?.acuanDiDepan
          ? `sidang ${sebutPeristiwa(b.hariKePeristiwa)}`
          : sebutSelisih(b.selisihHari);
        const tambahan = b.keterangan ? ` · ${b.keterangan}` : "";
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
