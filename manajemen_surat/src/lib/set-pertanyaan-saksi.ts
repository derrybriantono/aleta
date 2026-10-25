import { paraSebutan, sebutanBerurut } from "@/lib/sebutan-pihak";

/**
 * ============================================================================
 * SET PERTANYAAN SAKSI DASAR PER JENIS PERKARA (F3.3, 16 Okt 2026)
 * ============================================================================
 *
 * Panduan tanya jawab saksi untuk Blangko ABT by Derry Briantono: tiap set
 * menyusun pertanyaan menurut UNSUR yang harus dibuktikan (dasar hukum
 * disebut per set; yang belum pasti ditandai "perlu dicek") dan menurut pola
 * pertanyaan yang SUNGGUH dipakai hakim PA Donggala di ABT.
 *
 * Ukuran data nyata (SELECT baca-saja abt_keterangan_saksi x SIPP.perkara di
 * server, 16 Okt 2026; 69.164 baris tanya jawab, 2.334 perkara, tanpa nama):
 *   - Cerai gugat 1.660 perkara / 3.370 saksi; cerai talak 356 / 784; itsbat 177;
 *     dispensasi kawin 43; ahli waris 34; perwalian 30; asal usul anak 4;
 *     wali adhal 3; harta bersama, kewarisan, izin poligami masing-masing 1.
 *   - Cerai: pertanyaan terbanyak = set ABT "A1a" (kenal 98%, tempat tinggal
 *     bersama 81%, anak 81%, siapa yang meninggalkan rumah 77%, melihat/
 *     mendengar sendiri pertengkaran 75%, komunikasi selama pisah 69%, masih
 *     serumah 68%, upaya merukunkan 66%, nafkah 65%).
 *   - Pertanyaan per huruf alasan HAMPIR TIDAK PERNAH ditanyakan: dari 2.034
 *     perkara cerai, kekerasan 25 (1%; pada 194 perkara berfaktor KDRT hanya
 *     6 = 3%), judi/mabuk/zina/narkoba 44 (2%), penjara 2, cacat/penyakit 3,
 *     "dua tahun berturut-turut/tanpa izin" 0, taklik 0, murtad 0. Upaya damai
 *     99% dan pisah rumah 89%. Karena itu set per huruf di bawah MENAMBAH
 *     unsur huruf itu di atas pola harian (pembuka + F + penutup), bukan
 *     menggantinya.
 *   - Dispensasi kawin mengikuti set ABT "DK Pr" (70-100% tiap butir), ahli
 *     waris "PAW" (50-97%), perwalian "PA1" (60-100%), itsbat 72-90% per
 *     butir (wali, mahar, status, keberatan, anak, tujuan itsbat).
 *
 * Tanda di teks: {P} {T} sebutan pihak (Penggugat/Pemohon, Tergugat/Termohon),
 * {suami} {isteri} sebutan pihak menurut kedudukan (CG: isteri = {P}; CT:
 * suami = {P}), {Pp} "para Pemohon"/"Pemohon", {P1} {P2} pihak pertama/kedua
 * perkawinan (itsbat, asal usul anak), {ajuan} isi permohonan cerai.
 * Jawaban adalah KERANGKA: "..." diisi petugas menurut keterangan saksi.
 * Pelaku perbuatan pada alasan A-E dan H = {T} (Tergugat/Termohon).
 *
 * Jawaban hukum pengguna 17 Okt 2026 (butir 23-30) sudah diterapkan: pisah
 * rumah 6 bulan kecuali KDRT (SEMA 1/2022 jo. SEMA 3/2023); perwalian 18
 * tahun; pengangkatan anak menurut Permensos 110/HUK/2009 (belum ditemukan
 * penggantinya); itsbat menanyakan poligami tanpa izin (SEMA 3/2018); izin
 * poligami menanyakan harta bersama isteri pertama; sighat taklik menurut
 * tahun nikah (PMA 2/1990; sebelum 1990 bunyi buku nikah); zina hanya cerai
 * talak. "perluDicek" yang tersisa = yang belum dijawab atau masih ragu.
 *
 * Murni: dipakai rute /api/aleta-ecourt/blangko-derry/set-saksi (ekstensi
 * Blangko Derry, "Set pertanyaan saksi") dan halaman Pengaturan SIPP & ABT.
 * Tidak ada yang ditulis ke ABT dari sini; petugas memuat, menyunting, lalu
 * menyimpan lewat tanyajawab_perkara_edit seperti biasa.
 */

export type ButirSaksi = { tanya: string; jawab: string; unsur: string };

export type KodeJenisSaksi =
  | "cg"
  | "ct"
  | "itsbat"
  | "dk"
  | "hb"
  | "waris"
  | "paw"
  | "ip"
  | "perwalian"
  | "wa"
  | "aua"
  | "angkat"
  | "hadhanah"
  | "nafkah"
  | "umum";

export type SetSaksi = {
  id: string;
  judul: string;
  /** Kalimat awam: dipakai untuk perkara apa. */
  untuk: string;
  jenis: KodeJenisSaksi[];
  /** Huruf alasan cerai (PP 9/1975 Pasal 19 / KHI Pasal 116) bila set ini khusus huruf itu. */
  huruf?: string;
  /** Set tambahan: ditambahkan di bawah pertanyaan yang sudah ada (kumulasi), bukan mengganti. */
  tambahan?: boolean;
  dasar: string[];
  perluDicek: string[];
  /** Ringkas hasil ukur data nyata PA Donggala. */
  ukur: string;
  pembuka: ButirSaksi[];
  inti: ButirSaksi[];
  penutup: ButirSaksi[];
};

// ----------------------------------------------------------------------------
// Butir bersama
// ----------------------------------------------------------------------------
const B = (tanya: string, jawab: string, unsur: string): ButirSaksi => ({ tanya, jawab, unsur });

const PENUTUP_UMUM: ButirSaksi[] = [B("Apakah masih ada yang ingin Saudara sampaikan?", "Sudah cukup;", "penutup")];

const DASAR_SAKSI = "RBg Pasal 308 ayat (1): keterangan saksi tentang yang dilihat, didengar, atau dialami sendiri (HIR Pasal 171)";
const DASAR_KELUARGA = "UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 Pasal 76 ayat (1) dan PP 9/1975 Pasal 22 ayat (2): keluarga atau orang dekat suami isteri didengar";

const PEMBUKA_CERAI: ButirSaksi[] = [
  B("Apakah Saudara kenal dengan {P} dan {T}?", "Ya, saya kenal dengan {P} dan {T} karena saya adalah ... {P};", "hubungan saksi dengan para pihak"),
  B("Apakah Saudara mengetahui maksud {P} menghadap di persidangan ini?", "{P} menghadap di persidangan ini untuk {ajuan};", "maksud perkara"),
  B("Apa hubungan antara {P} dan {T}?", "{P} dan {T} adalah suami isteri yang sah, menikah pada ... di ...;", "perkawinan yang sah (UU 1/1974 Pasal 2)"),
  B("Di mana {P} dan {T} tinggal bersama setelah menikah?", "Setelah menikah {P} dan {T} tinggal bersama di ...;", "tempat kediaman bersama"),
  B("Apakah {P} dan {T} sudah dikaruniai anak?", "{P} dan {T} sudah dikaruniai ... orang anak, sekarang anak tersebut tinggal bersama ...;", "anak dari perkawinan"),
  B("Bagaimana keadaan rumah tangga {P} dan {T} selama ini?", "Awalnya rumah tangga {P} dan {T} rukun dan harmonis, namun sejak ... tidak rukun lagi;", "tidak dapat hidup rukun (UU 1/1974 Pasal 39 ayat (2))"),
];

const INTI_F: ButirSaksi[] = [
  B("Apakah antara {P} dan {T} sering terjadi perselisihan dan pertengkaran, dan sejak kapan?", "Ya, antara {P} dan {T} sering terjadi perselisihan dan pertengkaran sejak ...;", "perselisihan dan pertengkaran terus-menerus"),
  B("Apa yang menjadi penyebab perselisihan dan pertengkaran tersebut?", "Penyebabnya karena ...;", "sebab perselisihan"),
  B(
    "Bagaimana bentuk perselisihan dan pertengkaran tersebut, dan apakah terjadi berulang kali?",
    "Perselisihan dan pertengkaran itu berbentuk adu mulut dan saling mengucapkan kata-kata kasar, dan terjadi berulang kali;",
    "bentuk dan keberulangan perselisihan (terus-menerus)"
  ),
  B("Apakah Saudara pernah melihat atau mendengar sendiri {P} dan {T} bertengkar? Berapa kali dan di mana?", "Saya pernah melihat dan mendengar sendiri {P} dan {T} bertengkar sebanyak ... kali, di ...;", "pengetahuan langsung saksi"),
  B("Apakah ada kejadian yang menjadi puncak perselisihan dan pertengkaran tersebut? Kapan?", "Puncaknya terjadi pada ... ketika ...;", "puncak perselisihan"),
  B(
    "Apakah sekarang {P} dan {T} masih tinggal serumah? Sejak kapan berpisah?",
    "Tidak, {P} dan {T} sudah berpisah tempat tinggal sejak ..., sudah sekitar ... bulan/tahun;",
    "pisah tempat tinggal paling singkat 6 bulan, kecuali terbukti ada KDRT (SEMA 1/2022 jo. SEMA 3/2023)"
  ),
  B("Siapa yang meninggalkan tempat tinggal bersama, dan sekarang masing-masing tinggal di mana?", "Yang meninggalkan tempat tinggal bersama adalah ...; sekarang {P} tinggal di ... dan {T} tinggal di ...;", "pisah tempat tinggal"),
  B("Selama berpisah, apakah {P} dan {T} masih berkomunikasi atau saling mengunjungi?", "Selama berpisah {P} dan {T} tidak lagi berkomunikasi dan tidak saling mengunjungi;", "tidak ada harapan rukun"),
  B("Selama berpisah, apakah {suami} masih memberi nafkah kepada {isteri}?", "Selama berpisah {suami} tidak pernah lagi memberi nafkah kepada {isteri};", "keadaan nafkah selama pisah"),
];

const PENUTUP_CERAI: ButirSaksi[] = [
  B("Apakah sudah ada upaya dari keluarga untuk merukunkan {P} dan {T}? Oleh siapa dan bagaimana hasilnya?", "Sudah, {P} dan {T} pernah dirukunkan oleh ..., namun tidak berhasil;", "upaya damai tidak berhasil"),
  B("Apakah Saudara masih sanggup merukunkan {P} dan {T}?", "Saya sudah tidak sanggup lagi merukunkan {P} dan {T};", "tidak ada harapan rukun"),
  ...PENUTUP_UMUM,
];

/**
 * Butir pertama huruf A. Keputusan pengguna 17 Okt (butir 29): pertanyaan ZINA
 * hanya untuk cerai talak (suami menuduh isteri - jalurnya li'an, KHI Pasal
 * 126-128); cerai gugat menanyakan mabuk, madat, judi, narkoba saja.
 */
const A_PERBUATAN: Record<"cg" | "ct", ButirSaksi> = {
  cg: B("Menurut Saudara, kebiasaan buruk apa yang dilakukan {T}?", "{T} mempunyai kebiasaan ... (berjudi/mabuk-mabukan/memakai narkoba);", "perbuatan huruf a (pemabuk, pemadat, penjudi)"),
  ct: B("Menurut Saudara, kebiasaan buruk apa yang dilakukan {T}?", "{T} mempunyai kebiasaan ... (berbuat zina/berjudi/mabuk-mabukan/memakai narkoba);", "perbuatan huruf a (zina, pemabuk, pemadat, penjudi)"),
};

/** Unsur khusus tiap huruf alasan (PP 9/1975 Pasal 19 = KHI Pasal 116). Butir pertama A dipasang setCerai menurut jenis. */
const INTI_HURUF: Record<string, ButirSaksi[]> = {
  A: [
    B("Sejak kapan dan seberapa sering {T} melakukan kebiasaan tersebut?", "Sejak ..., hampir setiap ...;", "kebiasaan, bukan sekali"),
    B("Bagaimana Saudara mengetahui kebiasaan {T} tersebut? Apakah Saudara melihat sendiri?", "Saya melihat sendiri ketika ...;", "pengetahuan langsung saksi"),
    B("Apakah {T} pernah dinasihati agar berhenti, dan bagaimana hasilnya?", "Sudah dinasihati oleh ..., tetapi {T} tetap mengulanginya;", "sukar disembuhkan"),
    B("Apakah sampai sekarang {T} masih melakukan kebiasaan tersebut?", "Ya, sampai sekarang {T} masih ...;", "sukar disembuhkan"),
    B("Apa akibat kebiasaan {T} tersebut terhadap rumah tangga {P} dan {T}?", "Akibatnya ...;", "akibat terhadap rumah tangga"),
  ],
  B: [
    B("Sejak kapan {T} meninggalkan {P}?", "{T} pergi meninggalkan {P} sejak ..., sampai sekarang sudah ... tahun;", "dua tahun berturut-turut"),
    B("Apakah {T} pergi dengan izin atau sepengetahuan {P}?", "{T} pergi tanpa izin {P};", "tanpa izin pihak lain"),
    B("Apa sebab {T} pergi? Apakah karena tugas, bekerja, sakit, atau hal lain di luar kemampuannya?", "Setahu saya {T} pergi tanpa alasan yang sah, yaitu ...;", "tanpa alasan yang sah atau hal lain di luar kemampuannya"),
    B("Selama pergi, apakah {T} pernah pulang, berkirim kabar, atau mengirim nafkah?", "Selama pergi {T} tidak pernah pulang, tidak ada kabar, dan tidak mengirim nafkah;", "berturut-turut, tidak kembali"),
    B("Di mana {T} sekarang berada?", "Sekarang {T} berada di ... / tidak diketahui alamatnya;", "keberadaan Tergugat/Termohon"),
    B("Apakah keluarga pernah berusaha mencari {T} atau memintanya kembali?", "Sudah dicari/diminta kembali oleh ..., namun {T} tidak mau kembali;", "sikap tidak mau kembali (KHI Pasal 133 ayat (2))"),
  ],
  C: [
    B("Apakah {T} pernah dihukum penjara? Karena perkara apa?", "Ya, {T} dihukum penjara karena perkara ...;", "hukuman penjara"),
    B("Berapa lama hukuman penjara yang dijatuhkan kepada {T}?", "{T} dihukum penjara selama ... tahun;", "lima tahun atau lebih"),
    B("Kapan {T} dihukum? Apakah sesudah {P} dan {T} menikah?", "{T} dihukum pada tahun ..., sesudah {P} dan {T} menikah;", "setelah perkawinan berlangsung"),
    B("Di mana {T} menjalani hukuman dan sejak kapan?", "{T} menjalani hukuman di ... sejak ...;", "keadaan sekarang"),
    B("Apakah perkara pidana {T} sudah diputus pengadilan dan putusannya sudah berkekuatan hukum tetap?", "Perkara pidana {T} sudah diputus pengadilan dan putusannya sudah berkekuatan hukum tetap;", "putusan pidana berkekuatan hukum tetap (KHI Pasal 135)"),
    B("Bagaimana keadaan rumah tangga {P} dan {T} selama {T} menjalani hukuman?", "Selama {T} menjalani hukuman ...;", "akibat terhadap rumah tangga"),
  ],
  D: [
    B("Apakah {T} pernah melakukan kekerasan terhadap {P}? Dalam bentuk apa?", "Ya, {T} pernah ... (memukul/menendang/mengancam) {P};", "kekejaman atau penganiayaan"),
    B("Kapan dan berapa kali kekerasan itu terjadi?", "Kekerasan itu terjadi ... kali, terakhir pada ...;", "berulang/berat"),
    B("Apakah Saudara melihat sendiri kejadian itu, atau melihat bekas lukanya?", "Saya melihat sendiri ... / saya melihat bekas luka di ... {P};", "pengetahuan langsung saksi"),
    B("Apa akibat kekerasan itu terhadap {P}? Apakah sampai luka, berobat, atau dirawat?", "Akibatnya {P} ... (luka/berobat/dirawat di ...);", "berat dan membahayakan"),
    B("Apakah kejadian itu pernah dilaporkan kepada pemerintah desa atau polisi, atau dibuatkan visum?", "Kejadian itu ... (pernah/tidak pernah) dilaporkan kepada ...;", "bukti pendukung"),
    B("Apakah {P} merasa tidak aman bila tetap tinggal bersama {T}?", "Ya, {P} merasa terancam keselamatannya bila tetap tinggal bersama {T};", "membahayakan pihak lain"),
  ],
  E: [
    B("Penyakit atau cacat apa yang diderita {T}?", "{T} menderita ...;", "cacat badan atau penyakit"),
    B("Sejak kapan {T} menderita penyakit atau cacat tersebut? Sebelum atau sesudah menikah?", "Sejak ..., yaitu ... menikah;", "waktu timbulnya"),
    B("Apakah penyakit atau cacat itu sudah diobati, dan bagaimana hasilnya?", "Sudah diobati di ..., tetapi tidak sembuh;", "sukar disembuhkan"),
    B("Akibat penyakit atau cacat itu, kewajiban apa sebagai suami/isteri yang tidak dapat dijalankan {T}?", "Akibatnya {T} tidak dapat ...;", "tidak dapat menjalankan kewajiban suami/isteri"),
  ],
  // Sighat taklik menurut PMA 2/1990 (bunyi buku nikah sekarang). Perkawinan sebelum 1990: lihat INTI_G_LAMA.
  G: [
    B(
      "Kapan {suami} dan {isteri} menikah, dan apakah setelah akad nikah {suami} mengucapkan serta menandatangani sighat taklik talak?",
      "{suami} dan {isteri} menikah pada tahun ...; setelah akad nikah {suami} mengucapkan dan menandatangani sighat taklik talak sebagaimana tercantum di buku nikah;",
      "ada taklik talak (KHI Pasal 45-46); tahun perkawinan menentukan bunyi sighat"
    ),
    B("Apakah {suami} pernah meninggalkan {isteri} dua tahun berturut-turut? Sejak kapan?", "{suami} meninggalkan {isteri} sejak ... / tidak pernah;", "isi taklik (PMA 2/1990): meninggalkan dua tahun berturut-turut"),
    B("Apakah {suami} tidak memberi nafkah wajib kepada {isteri} tiga bulan lamanya? Sejak kapan?", "Sejak ... {suami} tidak memberi nafkah wajib kepada {isteri}, sudah ... bulan;", "isi taklik (PMA 2/1990): tidak memberi nafkah wajib tiga bulan"),
    B("Apakah {suami} pernah menyakiti badan atau jasmani {isteri}?", "{suami} pernah/tidak pernah menyakiti badan {isteri} ...;", "isi taklik (PMA 2/1990): menyakiti badan/jasmani"),
    B("Apakah {suami} membiarkan atau tidak memedulikan {isteri} enam bulan lamanya?", "{suami} tidak memedulikan {isteri} sejak ..., sudah ... bulan;", "isi taklik (PMA 2/1990): membiarkan enam bulan"),
    B("Apakah {isteri} rela atas perlakuan {suami} tersebut?", "{isteri} tidak rela atas perlakuan {suami} tersebut;", "isteri tidak rela"),
  ],
  H: [
    B("Apakah {T} berpindah agama? Ke agama apa?", "Ya, {T} berpindah ke agama ...;", "peralihan agama (murtad)"),
    B("Sejak kapan {T} berpindah agama, dan bagaimana Saudara mengetahuinya?", "Sejak ..., saya mengetahuinya karena ...;", "pengetahuan langsung saksi"),
    B("Apakah {T} masih menjalankan ibadah agama Islam?", "{T} tidak lagi menjalankan ibadah agama Islam, melainkan ...;", "peralihan agama"),
    B("Apa akibat perpindahan agama {T} terhadap kerukunan rumah tangga {P} dan {T}?", "Akibatnya rumah tangga {P} dan {T} tidak rukun karena ...;", "menyebabkan ketidakrukunan"),
  ],
};

/**
 * Perkawinan SEBELUM 1990 (sebelum PMA 2/1990): bunyi sighat di buku nikah
 * lama dapat berbeda (rumusan 1950/1956/1969/1975 - mis. 1950 "menyakiti
 * dengan memukul"; besar iwadh berbeda). Butir mengikuti bunyi yang tertulis
 * di buku nikah pihak, bukan bunyi sekarang.
 */
const INTI_G_LAMA: ButirSaksi[] = [
  B(
    "Kapan {suami} dan {isteri} menikah, dan apakah setelah akad nikah {suami} mengucapkan serta menandatangani sighat taklik talak?",
    "{suami} dan {isteri} menikah pada tahun ...; setelah akad nikah {suami} mengucapkan dan menandatangani sighat taklik talak sebagaimana tercantum di buku nikah;",
    "ada taklik talak (KHI Pasal 45-46); tahun perkawinan menentukan bunyi sighat"
  ),
  B("Bagaimana bunyi janji taklik talak yang tertulis di buku nikah {suami} dan {isteri}?", "Menurut buku nikah, {suami} berjanji bahwa ...;", "bunyi sighat menurut buku nikah tahun perkawinan itu (sebelum PMA 2/1990)"),
  B("Janji taklik mana yang dilanggar {suami}? Sejak kapan dan sudah berapa lama?", "{suami} melanggar janji ..., sejak ..., sudah ...;", "pelanggaran butir taklik yang diucapkan"),
  B("Bagaimana Saudara mengetahui pelanggaran tersebut? Apakah melihat sendiri?", "Saya mengetahuinya karena ...;", "pengetahuan langsung saksi"),
  B("Apakah {isteri} rela atas perlakuan {suami} tersebut?", "{isteri} tidak rela atas perlakuan {suami} tersebut;", "isteri tidak rela"),
];

/** Tahun PMA 2/1990 - perkawinan sebelum tahun ini memakai INTI_G_LAMA. */
export const TAHUN_SIGHAT_SEKARANG = 1990;

const NAMA_HURUF: Record<string, string> = {
  A: "zina, mabuk, madat, judi (huruf A)",
  B: "meninggalkan dua tahun berturut-turut (huruf B)",
  C: "hukuman penjara lima tahun atau lebih (huruf C)",
  D: "kekejaman atau penganiayaan berat (huruf D)",
  E: "cacat badan atau penyakit (huruf E)",
  F: "perselisihan dan pertengkaran terus-menerus (huruf F)",
  G: "pelanggaran taklik talak (huruf G)",
  H: "peralihan agama/murtad (huruf H)",
};

/** SEMA 1/2022 jo. SEMA 3/2023 (Rumusan Kamar Agama): syarat pisah 6 bulan dan pengecualian KDRT (keputusan pengguna 17 Okt, butir 23). */
const DASAR_PISAH_6_BULAN =
  "SEMA 1/2022 jo. SEMA 3/2023 (Rumusan Kamar Agama): perceraian karena perselisihan dan pertengkaran terus-menerus dapat dikabulkan bila diikuti pisah tempat tinggal paling singkat 6 bulan, kecuali ditemukan fakta hukum Tergugat/Penggugat melakukan KDRT";

const DASAR_HURUF: Record<string, string[]> = {
  A: ["PP 9/1975 Pasal 19 huruf a; KHI Pasal 116 huruf a"],
  B: ["PP 9/1975 Pasal 19 huruf b; KHI Pasal 116 huruf b", "KHI Pasal 133: gugatan diajukan setelah lampau 2 tahun; dapat diterima bila Tergugat menyatakan/menunjukkan sikap tidak mau kembali"],
  C: ["PP 9/1975 Pasal 19 huruf c; KHI Pasal 116 huruf c", "KHI Pasal 135: bukti salinan putusan pidana yang berkekuatan hukum tetap"],
  D: [
    "PP 9/1975 Pasal 19 huruf d; KHI Pasal 116 huruf d",
    "UU 23/2004 tentang Penghapusan KDRT Pasal 5-9 (kekerasan fisik, psikis, seksual, penelantaran rumah tangga)",
    `${DASAR_PISAH_6_BULAN} - bila KDRT terbukti, syarat pisah 6 bulan tidak diberlakukan`,
  ],
  E: ["PP 9/1975 Pasal 19 huruf e; KHI Pasal 116 huruf e"],
  F: ["PP 9/1975 Pasal 19 huruf f; KHI Pasal 116 huruf f", DASAR_PISAH_6_BULAN],
  G: ["KHI Pasal 116 huruf g; KHI Pasal 45-46 (taklik talak)", "PMA 2/1990: bunyi sighat taklik talak di buku nikah sejak 1990 (meninggalkan 2 tahun, tidak memberi nafkah wajib 3 bulan, menyakiti badan/jasmani, membiarkan 6 bulan)"],
  H: ["KHI Pasal 116 huruf h"],
};

/** Dasar tambahan huruf A pada cerai talak: tuduhan zina oleh suami (keputusan 17 Okt butir 29: zina hanya cerai talak). */
const DASAR_A_CT = "KHI Pasal 125-128: tuduhan zina oleh suami terhadap isteri dapat ditempuh dengan li'an";

const CEK_HURUF: Record<string, string[]> = {
  A: [],
  B: [],
  C: ["Saksi hanya menguatkan; bukti utama salinan putusan pidana (KHI Pasal 135)."],
  D: [],
  E: ["Keterangan dokter lebih kuat daripada saksi awam untuk menilai penyakit/cacat."],
  F: [],
  G: [],
  H: [],
};

/** Ragu yang belum dapat dipastikan dari naskah resmi: bunyi sighat sebelum PMA 2/1990 per tahun. */
const CEK_G_LAMA =
  "Bunyi sighat taklik sebelum PMA 2/1990 (rumusan 1950, 1956, 1969, 1975) belum terverifikasi per tahun dari naskah resmi - bacakan bunyi yang tertulis di buku nikah pihak.";

export type OpsiCerai = {
  /** Cerai gugat/cerai talak; tanpa jenis = bentuk cerai gugat (tanpa pertanyaan zina). */
  jenis?: "cg" | "ct";
  /** Tahun akad nikah (huruf G): sebelum 1990 memakai butir sighat lama. */
  tahunNikah?: number;
};

export function setCerai(huruf: string, opsi: OpsiCerai = {}): SetSaksi {
  const daftar = [...new Set(huruf.split(""))].filter((h) => INTI_HURUF[h] || h === "F");
  const ct = opsi.jenis === "ct";
  const sighatLama = Boolean(opsi.tahunNikah && opsi.tahunNikah < TAHUN_SIGHAT_SEKARANG);
  const inti: ButirSaksi[] = [];
  for (const h of daftar) {
    if (h === "F") continue;
    if (h === "A") inti.push(A_PERBUATAN[ct ? "ct" : "cg"]);
    inti.push(...(h === "G" && sighatLama ? INTI_G_LAMA : INTI_HURUF[h]));
  }
  // Pola harian satker selalu memuat unsur F (perselisihan, pisah rumah): tetap disertakan.
  inti.push(...INTI_F);
  const satu = daftar.length === 1;
  const dasarHuruf = daftar.flatMap((h) => {
    const d = h === "G" && sighatLama ? DASAR_HURUF.G.slice(0, 1) : DASAR_HURUF[h];
    return h === "A" && ct ? [...d, DASAR_A_CT] : d;
  });
  return {
    // Cerai talak huruf A berbeda butir (zina) - id sendiri supaya Pengaturan menampilkan keduanya.
    id: `cerai-${daftar.join("")}${ct && daftar.includes("A") ? "-ct" : ""}${daftar.includes("G") && sighatLama ? "-sighat-lama" : ""}`,
    judul: `${satu ? `Cerai - ${NAMA_HURUF[daftar[0]]}` : `Cerai - alasan ${daftar.join(", ")}`}${daftar.includes("A") ? (ct ? " - cerai talak" : " - cerai gugat") : ""}${
      daftar.includes("G") && sighatLama ? " - nikah sebelum 1990" : ""
    }`,
    untuk: satu
      ? daftar[0] === "F"
        ? "Cerai gugat/cerai talak dengan alasan perselisihan terus-menerus (paling sering di PA Donggala)."
        : daftar[0] === "A"
          ? ct
            ? "Cerai talak dengan alasan zina, mabuk, madat, atau judi (pertanyaan zina hanya pada cerai talak), ditambah pertanyaan perselisihan dan pisah rumah."
            : "Cerai gugat dengan alasan mabuk, madat, atau judi (tanpa pertanyaan zina), ditambah pertanyaan perselisihan dan pisah rumah."
          : `Cerai gugat/cerai talak dengan alasan ${NAMA_HURUF[daftar[0]]}, ditambah pertanyaan perselisihan dan pisah rumah.`
      : `Cerai dengan beberapa alasan: ${daftar.map((h) => NAMA_HURUF[h]).join("; ")}.`,
    jenis: daftar.includes("G") ? ["cg"] : daftar.includes("A") ? [ct ? "ct" : "cg"] : ["cg", "ct"],
    huruf: daftar.join(""),
    dasar: ["UU 1/1974 jo. UU 16/2019 Pasal 39 ayat (2): harus ada cukup alasan bahwa suami isteri tidak dapat hidup rukun", ...dasarHuruf, DASAR_KELUARGA, DASAR_SAKSI],
    perluDicek: [...daftar.flatMap((h) => CEK_HURUF[h]), ...(daftar.includes("G") && sighatLama ? [CEK_G_LAMA] : [])],
    ukur:
      "ABT server: 2.034 perkara cerai; pertanyaan pisah rumah 89%, upaya damai 99%, nafkah 56%; unsur huruf lain hampir tidak ditanyakan (kekerasan 1%, judi/mabuk/zina 2%).",
    pembuka: PEMBUKA_CERAI,
    inti,
    penutup: PENUTUP_CERAI,
  };
}

// ----------------------------------------------------------------------------
// Set tambahan kumulasi cerai: hak asuh, nafkah
// ----------------------------------------------------------------------------
const SET_HADHANAH: SetSaksi = {
  id: "tambah-hak-asuh",
  judul: "Tambahan - hak asuh anak",
  untuk: "Gugatan/permohonan hak asuh anak, berdiri sendiri atau digabung dengan cerai.",
  jenis: ["cg", "ct", "hadhanah"],
  tambahan: true,
  dasar: [
    "UU 1/1974 Pasal 41 huruf a; KHI Pasal 105 huruf a (anak belum mumayyiz/12 tahun hak ibu) dan Pasal 156",
    "UU 23/2002 jo. UU 35/2014 tentang Perlindungan Anak: kepentingan terbaik anak",
    DASAR_SAKSI,
  ],
  perluDicek: ["SEMA 1/2017: amar hak asuh memuat kewajiban memberi akses kepada orang tua yang tidak memegang hak asuh - rumusan perlu dicek."],
  ukur: "ABT server: tidak ada set khusus; pertanyaan anak (98%) hanya menanyakan jumlah anak dan tinggal dengan siapa.",
  pembuka: [
    B("Apakah Saudara kenal dengan {P} dan {T}?", "Ya, saya kenal dengan {P} dan {T} karena saya adalah ... {P};", "hubungan saksi dengan para pihak"),
  ],
  inti: [
    B("Siapa nama dan berapa umur anak {P} dan {T}?", "Anak {P} dan {T} bernama ..., umur ... tahun;", "anak dan umurnya (mumayyiz atau belum)"),
    B("Sejak {P} dan {T} berpisah, anak tersebut tinggal bersama siapa?", "Sejak berpisah anak tersebut tinggal bersama ...;", "penguasaan anak sekarang"),
    B("Siapa yang selama ini merawat, mengasuh, dan membiayai anak tersebut?", "Selama ini yang merawat dan mengasuh adalah ..., sedangkan biayanya dari ...;", "pengasuhan nyata"),
    B("Bagaimana keadaan anak tersebut sekarang, misalnya kesehatan dan sekolahnya?", "Anak tersebut dalam keadaan ... dan ...;", "kepentingan terbaik anak"),
    B("Bagaimana perilaku {P} sehari-hari? Apakah ada kebiasaan buruk yang dapat membahayakan anak?", "{P} berperilaku baik, ... dan tidak mempunyai kebiasaan buruk;", "kelayakan pemegang hak asuh"),
    B("Bagaimana hubungan anak tersebut dengan {T}? Apakah {T} masih menjenguk anak?", "{T} ... menjenguk anak tersebut;", "hubungan anak dengan orang tua lain"),
    B("Apakah {P} sanggup mengasuh anak tersebut dan tetap memberi kesempatan {T} bertemu anak?", "Ya, {P} sanggup mengasuh dan tidak akan menghalangi {T} bertemu anak;", "akses orang tua lain"),
    B("Apakah {P} beragama Islam dan menanamkan nilai agama kepada anak tersebut?", "{P} beragama Islam dan membimbing anak tersebut menjalankan ibadah;", "kelayakan pengasuh: agama"),
    B("Apa pekerjaan {P}, dan apakah masih ada waktu untuk mengasuh anak tersebut?", "{P} bekerja sebagai ... dan masih mempunyai waktu untuk mengasuh anak;", "kelayakan pengasuh: waktu dan penghasilan"),
    B("Apakah anak tersebut bersekolah, di mana, dan siapa yang membiayai sekolahnya?", "Anak tersebut bersekolah di ... dengan biaya dari ...;", "pendidikan anak"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_NAFKAH: SetSaksi = {
  id: "tambah-nafkah",
  judul: "Tambahan - nafkah iddah, mut'ah, madliyah, dan nafkah anak",
  untuk: "Tuntutan nafkah (gugatan/rekonvensi/kumulasi), termasuk akibat cerai talak.",
  jenis: ["cg", "ct", "nafkah"],
  tambahan: true,
  dasar: [
    "UU 1/1974 Pasal 41 huruf b dan c; KHI Pasal 80 ayat (4), 149, 152 (nusyuz), 156 huruf d, 158-160 (mut'ah sesuai kepatutan dan kemampuan suami)",
    "PERMA 3/2017 tentang Pedoman Mengadili Perkara Perempuan Berhadapan dengan Hukum",
    "Keputusan ALETA 10 Okt 2026: nafkah iddah dihitung 3 bulan dengan nafkah per bulan disebut",
    DASAR_SAKSI,
  ],
  perluDicek: ["SEMA 2/2019 tentang pembayaran kewajiban akibat cerai sebelum pengambilan akta cerai - rumusan perlu dicek."],
  ukur: "ABT server: pertanyaan nafkah ada di 56% perkara cerai, hanya 'masih memberi nafkah'; penghasilan dan kebutuhan anak hampir tidak ditanyakan.",
  pembuka: [
    B("Apakah Saudara kenal dengan {P} dan {T}?", "Ya, saya kenal dengan {P} dan {T} karena saya adalah ... {P};", "hubungan saksi dengan para pihak"),
  ],
  inti: [
    B("Apa pekerjaan {suami}?", "{suami} bekerja sebagai ...;", "kemampuan suami"),
    B("Berapa kira-kira penghasilan {suami} setiap bulan, dan bagaimana Saudara mengetahuinya?", "Penghasilan {suami} kira-kira Rp... setiap bulan, saya tahu karena ...;", "kemampuan suami"),
    B("Selama hidup bersama, berapa nafkah yang biasa diberikan {suami} kepada {isteri} setiap bulan?", "Biasanya {suami} memberi nafkah kira-kira Rp... setiap bulan;", "ukuran nafkah per bulan"),
    B("Sejak kapan {suami} tidak lagi memberi nafkah kepada {isteri}?", "Sejak ..., sudah sekitar ... bulan;", "nafkah lampau (madliyah)"),
    B("Apakah {isteri} pernah meninggalkan rumah atau menolak hidup bersama tanpa alasan yang sah?", "{isteri} tidak pernah ... / {isteri} pergi karena ...;", "nusyuz atau tidak (KHI Pasal 152)"),
    B("Berapa lama {P} dan {T} hidup bersama sebagai suami isteri?", "{P} dan {T} hidup bersama sekitar ... tahun;", "kepatutan mut'ah"),
    B("Berapa kira-kira kebutuhan hidup anak setiap bulan?", "Kebutuhan anak kira-kira Rp... setiap bulan untuk ...;", "nafkah anak"),
    B("Apakah {suami} mempunyai usaha, harta, atau penghasilan lain di luar pekerjaannya?", "{suami} juga mempunyai ... sebagai tambahan penghasilan;", "kemampuan suami"),
    B("Sejak berpisah, apakah {suami} masih memberikan nafkah untuk anak, dan berapa?", "Sejak berpisah {suami} ... memberikan nafkah untuk anak sebesar Rp...;", "nafkah anak sejak berpisah"),
    B("Berapa kira-kira biaya sekolah anak setiap bulan?", "Biaya sekolah anak kira-kira Rp... setiap bulan;", "biaya pendidikan anak"),
  ],
  penutup: PENUTUP_UMUM,
};


/**
 * Set tambahan perceraian (20 Okt 2026, agen U1): sebab perselisihan menurut pilihan petugas, keadaan Tergugat/Termohon yang
 * tidak hadir (verstek) atau yang hadir (kontradiktoir), dan para pihak yang masih serumah. Ditambahkan di bawah pertanyaan yang
 * sudah ada seperti set tambahan hak asuh dan nafkah; yang tidak relevan tidak dipilih petugas.
 */
const DASAR_VERSTEK = "Pasal 125 ayat (1) HIR / Pasal 149 ayat (1) RBg: putusan di luar hadir tergugat (verstek) bila gugatan beralasan hukum";

const SET_SEBAB: SetSaksi = {
  id: "tambah-sebab",
  judul: "Tambahan - sebab perselisihan (ekonomi, cemburu, keluarga, tanggung jawab, perbedaan prinsip)",
  untuk: "Perselisihan terus-menerus yang sebabnya perlu diperinci: nafkah dan ekonomi, kecemburuan, campur tangan keluarga, tanggung jawab, atau perbedaan prinsip.",
  jenis: ["cg", "ct"],
  tambahan: true,
  dasar: ["PP 9/1975 Pasal 19 huruf f; KHI Pasal 116 huruf f", DASAR_PISAH_6_BULAN, DASAR_KELUARGA, DASAR_SAKSI],
  perluDicek: [],
  ukur: "ABT server: pertanyaan penyebab hampir selalu satu butir ('Penyebabnya karena ...'); sebab yang diperinci (nafkah, cemburu, keluarga) jarang ditanyakan sehingga keterangan saksi mudah dipatahkan.",
  pembuka: [],
  inti: [
    B("Apakah nafkah yang diberikan {suami} kepada {isteri} mencukupi kebutuhan rumah tangga, dan apa kaitannya dengan pertengkaran mereka?", "Nafkah yang diberikan {suami} tidak mencukupi kebutuhan rumah tangga sehingga sering menjadi pangkal pertengkaran;", "sebab ekonomi dan nafkah"),
    B("Apa pekerjaan {suami} dan berapa kira-kira penghasilannya setiap bulan?", "{suami} bekerja sebagai ..., penghasilannya kira-kira Rp... setiap bulan;", "pekerjaan dan penghasilan suami"),
    B("Apakah ada kecemburuan atau hubungan salah satu pihak dengan orang lain yang menjadi sebab pertengkaran?", "Ya, pertengkaran dipicu kecemburuan karena ... dekat dengan orang lain;", "sebab cemburu dan pihak lain"),
    B("Apakah ada campur tangan keluarga atau pihak lain dalam rumah tangga {P} dan {T} yang memperbesar pertengkaran?", "Ya, ... ikut campur dalam urusan rumah tangga mereka sehingga pertengkaran bertambah;", "campur tangan keluarga"),
    B("Apakah {P} dan {T} menjalankan tanggung jawab masing-masing dalam rumah tangga, dan apa kaitannya dengan pertengkaran mereka?", "... kurang bertanggung jawab terhadap urusan rumah tangga dan anak sehingga sering terjadi pertengkaran;", "tanggung jawab dalam rumah tangga"),
    B("Apakah antara {P} dan {T} terdapat perbedaan pendapat yang terus-menerus dan sulit diselesaikan?", "Ya, antara {P} dan {T} sering terjadi perbedaan pendapat yang tidak pernah menemukan titik temu;", "perbedaan prinsip yang tidak selesai"),
    B("Bila ada anak, apakah anak pernah menyaksikan pertengkaran {P} dan {T}, dan bagaimana dampaknya?", "Anak mereka beberapa kali menyaksikan pertengkaran tersebut dan terdampak olehnya;", "dampak pertengkaran bagi anak"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_VERSTEK: SetSaksi = {
  id: "tambah-verstek",
  judul: "Tambahan - Tergugat/Termohon tidak hadir (verstek)",
  untuk: "Perkara cerai yang diputus verstek: keberadaan dan kabar pihak yang tidak hadir, sebagai pelengkap pembuktian karena tidak ada jawaban.",
  jenis: ["cg", "ct"],
  tambahan: true,
  dasar: [DASAR_VERSTEK, DASAR_SAKSI, DASAR_KELUARGA],
  perluDicek: ["Pemanggilan yang patut dibuktikan lewat relaas, bukan lewat saksi; pertanyaan di sini hanya melengkapi keadaan pihak yang tidak hadir."],
  ukur: "ABT server: pada perkara verstek pertanyaan saksi sama dengan perkara kontradiktoir; keberadaan pihak yang tidak hadir hampir tidak ditanyakan.",
  pembuka: [],
  inti: [
    B("Apakah Saudara mengetahui di mana {T} tinggal sekarang?", "Sekarang {T} tinggal di ... / tidak diketahui keberadaannya;", "keberadaan pihak yang tidak hadir"),
    B("Sejak berpisah, apakah {T} pernah memberi kabar atau menemui {P} dan keluarganya?", "Sejak berpisah {T} tidak pernah memberi kabar maupun menemui {P} dan keluarganya;", "tidak ada itikad kembali"),
    B("Apakah Saudara atau keluarga pernah menyampaikan kepada {T} bahwa {P} akan mengajukan perkara ini? Bagaimana tanggapannya?", "Pernah disampaikan oleh ..., tanggapan {T} ...;", "pengetahuan pihak yang tidak hadir"),
    B("Apakah ada hal yang menghalangi {T} hadir di persidangan menurut yang Saudara ketahui?", "Setahu saya tidak ada halangan yang sah bagi {T} untuk hadir;", "tidak hadir tanpa alasan yang sah"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_KONTRA: SetSaksi = {
  id: "tambah-kontra",
  judul: "Tambahan - Tergugat/Termohon hadir (kontradiktoir)",
  untuk: "Perkara cerai yang dijawab: sikap pihak lawan, tanggapannya atas nasihat, dan mediasi, supaya dalil yang dibantah terbukti dengan keterangan saksi.",
  jenis: ["cg", "ct"],
  tambahan: true,
  dasar: ["UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 Pasal 82: hakim berusaha mendamaikan para pihak pada setiap persidangan", DASAR_SAKSI, DASAR_KELUARGA],
  perluDicek: [],
  ukur: "ABT server: sikap pihak lawan terhadap perceraian tidak ditanyakan kepada saksi pada perkara yang dijawab; saksi hanya ditanya kenal, rumah tangga, dan pisah rumah.",
  pembuka: [],
  inti: [
    B("Bagaimana sikap {T} terhadap rumah tangganya dengan {P} menurut yang Saudara ketahui, apakah masih ingin mempertahankannya?", "{T} ... (membantah adanya pertengkaran / tidak keberatan bercerai / masih ingin mempertahankan rumah tangga);", "sikap pihak lawan"),
    B("Bagaimana tanggapan {P} dan {T} ketika dinasihati untuk rukun kembali?", "Ketika dinasihati, {P} ... dan {T} ...;", "tanggapan atas nasihat"),
    B("Apakah Saudara mengetahui {P} dan {T} sudah mengikuti mediasi di pengadilan, dan bagaimana hasilnya?", "Mediasi di pengadilan sudah ditempuh dan tidak berhasil mendamaikan mereka;", "mediasi tidak berhasil"),
    B("Apakah Saudara pernah mendengar {T} membantah atau membenarkan adanya pertengkaran tersebut?", "Saya pernah mendengar {T} ... (membantah/membenarkan) adanya pertengkaran itu;", "pengakuan atau bantahan pihak lawan"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_SERUMAH: SetSaksi = {
  id: "tambah-serumah",
  judul: "Tambahan - para pihak masih serumah",
  untuk: "Perselisihan terus-menerus bila para pihak belum berpisah tempat tinggal: keadaan di dalam rumah dan alasan masih serumah.",
  jenis: ["cg", "ct"],
  tambahan: true,
  dasar: ["PP 9/1975 Pasal 19 huruf f; KHI Pasal 116 huruf f", DASAR_PISAH_6_BULAN, DASAR_SAKSI],
  perluDicek: ["Syarat pisah tempat tinggal enam bulan (SEMA 1/2022 jo. SEMA 3/2023) tidak terpenuhi bila masih serumah, kecuali ada fakta KDRT; periksa pertimbangannya."],
  ukur: "ABT server: pertanyaan pisah rumah 89% mengasumsikan sudah berpisah; keadaan masih serumah tidak punya pertanyaan khusus.",
  pembuka: [],
  inti: [
    B("Apakah {P} dan {T} masih tinggal serumah sampai sekarang, dan bagaimana hubungan mereka sehari-hari?", "Ya, mereka masih serumah tetapi hubungan keduanya sudah tidak seperti suami istri pada umumnya;", "keadaan serumah"),
    B("Apakah mereka masih saling berbicara dan tidur sekamar?", "Mereka jarang bertegur sapa dan sudah tidak tidur sekamar;", "pisah ranjang dan komunikasi"),
    B("Mengapa {P} dan {T} masih tinggal serumah padahal rumah tangga mereka tidak harmonis?", "Mereka masih serumah karena ...;", "alasan masih serumah"),
    B("Apakah ada rencana atau upaya salah satu pihak untuk tinggal terpisah?", "Salah satu pihak berencana tinggal terpisah / belum ada rencana ...;", "kemungkinan pisah tempat tinggal"),
  ],
  penutup: PENUTUP_UMUM,
};

// ----------------------------------------------------------------------------
// Set per jenis perkara lain
// ----------------------------------------------------------------------------
const PEMBUKA_PERMOHONAN = (maksud: string): ButirSaksi[] => [
  B("Apakah Saudara kenal dengan {Pp}? Apa hubungan Saudara dengan {Pp}?", "Ya, saya kenal dengan {Pp} karena saya adalah ...;", "hubungan saksi dengan pemohon"),
  B("Apakah Saudara mengetahui maksud {Pp} menghadap di persidangan ini?", `{Pp} menghadap di persidangan ini untuk ${maksud};`, "maksud permohonan"),
];

const SET_ITSBAT: SetSaksi = {
  id: "itsbat",
  judul: "Itsbat nikah",
  untuk: "Itsbat (pengesahan) nikah, sendiri atau digabung dengan cerai; juga dipakai untuk asal usul anak.",
  jenis: ["itsbat"],
  dasar: [
    "UU 1/1974 jo. UU 16/2019 Pasal 2, 6-10; KHI Pasal 7 ayat (2)-(4) (itsbat nikah)",
    "KHI Pasal 14 (rukun nikah), 19-23 (wali), 24-26 (saksi nikah), 30 (mahar), 39-44 (larangan kawin)",
    "SEMA 3/2018 (Rumusan Kamar Agama): permohonan itsbat nikah poligami atas dasar nikah siri, meskipun untuk kepentingan anak, dinyatakan tidak dapat diterima; kepentingan anak ditempuh lewat permohonan asal usul anak",
    "UU 1/1974 Pasal 3 ayat (2), 4, 9: suami yang masih terikat perkawinan hanya boleh menikah lagi dengan izin Pengadilan",
    DASAR_SAKSI,
  ],
  perluDicek: [],
  ukur: "ABT server: 177 perkara; pertanyaan terbanyak: penutup 90%, yang menikahkan 88%, status saat menikah 86%, tempat menikah/mahar/keberatan 83%, anak 79%, tujuan itsbat 72%, wali 71%.",
  pembuka: PEMBUKA_PERMOHONAN("memohon pengesahan nikah {P1} dengan {P2}"),
  inti: [
    B("Kapan dan di mana {P1} dan {P2} menikah?", "{P1} dan {P2} menikah pada ... di ...;", "waktu dan tempat perkawinan"),
    B("Apakah Saudara hadir dan menyaksikan sendiri pernikahan tersebut?", "Ya, saya hadir dan menyaksikan sendiri;", "pengetahuan langsung saksi"),
    B("Siapa yang menjadi wali nikah {P2}, dan apa hubungannya dengan {P2}?", "Yang menjadi wali nikah adalah ... bernama ..., yaitu ... {P2};", "wali nikah (KHI Pasal 19-23)"),
    B("Siapa yang menikahkan (mengucapkan ijab) dan siapa yang mengucapkan kabul?", "Yang menikahkan adalah ..., dan kabul diucapkan oleh {P1};", "ijab dan kabul"),
    B("Siapa saja yang menjadi saksi nikah pada saat itu?", "Saksi nikahnya dua orang, yaitu ... dan ...;", "dua orang saksi nikah (KHI Pasal 24-25)"),
    B("Apa mahar yang diberikan {P1} kepada {P2}?", "Maharnya berupa ... dibayar tunai;", "mahar (KHI Pasal 30)"),
    B("Apa status {P1} dan {P2} saat menikah?", "Saat menikah {P1} berstatus ... dan {P2} berstatus ...;", "tidak terikat perkawinan lain"),
    // Keputusan 17 Okt butir 26: unsur yang membedakan poligami liar (itsbat-nya dilarang SEMA 3/2018).
    B(
      "Saat menikah dengan {P2}, apakah {P1} masih mempunyai isteri lain? Bila pernah beristeri, apakah perkawinan itu sudah putus karena cerai atau meninggal dunia, dan kapan?",
      "Saat menikah {P1} ... (tidak mempunyai isteri lain / perkawinan dengan isteri sebelumnya sudah putus karena ... pada ...);",
      "bukan poligami tanpa izin pengadilan (SEMA 3/2018)"
    ),
    B(
      "Bila saat itu {P1} masih beristeri, apakah ada izin beristeri lebih dari seorang dari Pengadilan Agama, dan apakah isteri sebelumnya mengetahui pernikahan ini?",
      "... (tidak ada isteri lain / ada izin Pengadilan Agama ... tanggal ...; isteri sebelumnya ... mengetahui);",
      "izin poligami pengadilan (UU 1/1974 Pasal 3 ayat (2) dan 4)"
    ),
    B("Berapa umur {P1} dan {P2} saat menikah?", "Saat menikah {P1} berumur sekitar ... tahun dan {P2} sekitar ... tahun;", "batas umur perkawinan"),
    B("Apakah antara {P1} dan {P2} ada hubungan darah, semenda, atau sesusuan yang menghalangi pernikahan?", "Tidak ada hubungan darah, semenda, maupun sesusuan;", "tidak ada larangan kawin (KHI Pasal 39)"),
    B("Apakah {P1} dan {P2} beragama Islam pada saat menikah?", "Ya, keduanya beragama Islam;", "beragama Islam (KHI Pasal 40, 44)"),
    B("Apakah ada pihak lain yang keberatan atas pernikahan tersebut?", "Sejak menikah sampai sekarang tidak ada pihak yang keberatan;", "tidak ada keberatan"),
    B("Sejak menikah, apakah {P1} dan {P2} pernah bercerai?", "{P1} dan {P2} tidak pernah bercerai;", "perkawinan masih berlangsung"),
    B("Apakah dari pernikahan tersebut {P1} dan {P2} dikaruniai anak?", "{P1} dan {P2} dikaruniai ... orang anak;", "anak dari perkawinan"),
    B("Mengapa pernikahan tersebut tidak tercatat, dan untuk keperluan apa {Pp} mengajukan itsbat nikah?", "Pernikahan tidak tercatat karena ...; itsbat nikah diperlukan untuk ...;", "kepentingan itsbat (KHI Pasal 7 ayat (3))"),
  ],
  penutup: PENUTUP_UMUM,
};

function setDispensasi(perempuan: boolean): SetSaksi {
  const calon = perempuan ? "calon suami" : "calon isteri";
  return {
    id: perempuan ? "dk-anak-perempuan" : "dk-anak-laki",
    judul: `Dispensasi kawin - anak ${perempuan ? "perempuan" : "laki-laki"}`,
    untuk: `Dispensasi kawin untuk anak ${perempuan ? "perempuan" : "laki-laki"} yang belum berumur 19 tahun.`,
    jenis: ["dk"],
    dasar: [
      "UU 1/1974 jo. UU 16/2019 Pasal 7: umur 19 tahun; dispensasi dengan alasan sangat mendesak disertai bukti cukup; pendapat kedua calon mempelai didengar",
      "PERMA 5/2019 Pasal 14-17: kepentingan terbaik anak; pemahaman dan persetujuan anak; kondisi psikologis, kesehatan, dan kesiapan; ada atau tidaknya paksaan",
      "UU 23/2002 jo. UU 35/2014 tentang Perlindungan Anak; KHI Pasal 15 dan 39-44",
      DASAR_SAKSI,
    ],
    perluDicek: ["Pertanyaan tentang kedekatan/kehamilan anak bersifat pribadi - sidang dispensasi tertutup; sesuaikan bahasa dengan PERMA 5/2019."],
    ukur: `ABT server: 43 perkara; set ABT "DK Pr"/"DK Lk" dipakai 70-100% per butir; sekolah anak, paksaan, dan kesehatan anak (PERMA 5/2019) belum ditanyakan.`,
    pembuka: PEMBUKA_PERMOHONAN("memohon dispensasi kawin bagi anaknya"),
    inti: [
      B("Mengapa {Pp} memohon dispensasi kawin?", "{Pp} hendak menikahkan anaknya, tetapi ditolak KUA Kecamatan ... karena belum cukup umur;", "penolakan KUA dan alasan permohonan"),
      B("Siapa nama dan berapa umur anak {Pp} tersebut sekarang?", "Anak {Pp} bernama ..., sekarang berumur ... tahun;", "umur anak di bawah 19 tahun"),
      B(`Siapa nama, berapa umur, dan apa pekerjaan ${calon} anak {Pp}?`, `${calon[0].toUpperCase()}${calon.slice(1)} anak {Pp} bernama ..., umur ... tahun, bekerja sebagai ...;`, "identitas dan kesiapan calon"),
      B(`Sejak kapan anak {Pp} dan ${calon}nya saling mengenal, dan sejauh mana hubungan mereka?`, `Mereka saling mengenal sejak ...; hubungan mereka sudah ...;`, "alasan sangat mendesak"),
      B("Apa yang dikhawatirkan bila anak tersebut tidak segera dinikahkan?", "Yang dikhawatirkan ...;", "alasan sangat mendesak"),
      B("Apakah anak {Pp} sendiri mau menikah, dan apakah ada paksaan dari siapa pun?", "Anak {Pp} mau menikah atas kemauannya sendiri, tanpa paksaan dari siapa pun;", "persetujuan anak, tanpa paksaan (PERMA 5/2019 Pasal 14)"),
      B("Apakah anak {Pp} masih bersekolah? Kelas berapa atau putus sekolah sejak kapan?", "Anak {Pp} ... (masih sekolah di .../putus sekolah sejak ...);", "hak pendidikan anak"),
      B("Bagaimana kesehatan dan kesiapan anak {Pp} untuk berumah tangga?", `Anak {Pp} sehat dan sudah ${perempuan ? "terbiasa mengurus pekerjaan rumah tangga" : "bekerja dan mampu menafkahi keluarga"};`, "kondisi kesehatan, psikologis, dan kesiapan"),
      B(`Apakah antara anak {Pp} dan ${calon}nya ada hubungan darah, semenda, atau sesusuan?`, "Tidak ada hubungan darah, semenda, maupun sesusuan;", "tidak ada larangan kawin"),
      B(`Apa status anak {Pp} dan ${calon}nya saat ini?`, `Anak {Pp} berstatus ${perempuan ? "perawan" : "jejaka"} dan ${calon}nya berstatus ...;`, "tidak terikat perkawinan lain"),
      B("Apakah keluarga kedua belah pihak sudah merestui, dan apakah sudah ada lamaran?", "Ya, keluarga kedua belah pihak sudah merestui dan lamaran sudah diterima;", "persetujuan keluarga"),
      B("Apakah ada pihak lain yang keberatan atas rencana pernikahan tersebut?", "Tidak ada pihak lain yang keberatan;", "tidak ada keberatan"),
    ],
    penutup: PENUTUP_UMUM,
  };
}

const SET_HB: SetSaksi = {
  id: "harta-bersama",
  judul: "Harta bersama",
  untuk: "Gugatan pembagian harta bersama (sendiri atau sesudah cerai).",
  jenis: ["hb"],
  dasar: [
    "UU 1/1974 Pasal 35-37: harta yang diperoleh selama perkawinan menjadi harta bersama; harta bawaan/hadiah/warisan di bawah penguasaan masing-masing",
    "KHI Pasal 1 huruf f, 85-97 (Pasal 93 utang, Pasal 97 masing-masing seperdua)",
    DASAR_SAKSI,
  ],
  perluDicek: ["Letak dan batas tanah/bangunan lebih tepat dipastikan lewat pemeriksaan setempat (SEMA 7/2001) - perlu dicek."],
  ukur: "ABT server: 1 perkara harta bersama (30 pertanyaan per objek: perolehan, sumber uang, penguasaan, sertifikat, jaminan, nilai); tidak ada set ABT.",
  pembuka: [
    B("Apakah Saudara kenal dengan {P} dan {T}? Apakah Saudara ada hubungan keluarga atau hubungan kerja dengan mereka?", "Ya, saya kenal dengan {P} dan {T} karena saya adalah ...;", "hubungan saksi dengan para pihak"),
    B("Kapan {P} dan {T} menikah, dan apakah sekarang sudah bercerai?", "{P} dan {T} menikah pada ... dan bercerai pada ...;", "masa perkawinan"),
  ],
  inti: [
    B("Harta apa saja yang diperoleh {P} dan {T} selama perkawinan?", "Setahu saya hartanya berupa ...;", "objek harta bersama"),
    B("Kapan dan bagaimana harta tersebut diperoleh (dibeli, dibangun, atau lainnya), dan dari uang siapa?", "Harta itu diperoleh pada ... dengan cara ..., uangnya dari ...;", "diperoleh selama perkawinan"),
    B("Apakah ada harta yang berasal dari warisan, hibah, atau milik salah satu pihak sebelum menikah?", "... (tidak ada / harta ... berasal dari ...);", "bukan harta bawaan (UU 1/1974 Pasal 35 ayat (2))"),
    B("Di mana letak, berapa luas, dan apa batas-batas harta tidak bergerak tersebut?", "Letaknya di ..., luas sekitar ..., berbatasan utara ..., timur ..., selatan ..., barat ...;", "identitas objek"),
    B("Atas nama siapa surat atau sertifikat harta tersebut, dan siapa yang menyimpannya?", "Atas nama ..., disimpan oleh ...;", "bukti kepemilikan"),
    B("Siapa yang menguasai atau menempati harta tersebut sekarang?", "Sekarang dikuasai oleh ...;", "penguasaan objek"),
    B("Apakah harta tersebut pernah dijaminkan atau masih ada utang yang berkaitan dengannya?", "... (tidak pernah / dijaminkan di ...);", "utang bersama (KHI Pasal 93)"),
    B("Berapa kira-kira nilai harta tersebut sekarang?", "Kira-kira Rp...;", "nilai objek"),
    B("Apakah harta tersebut pernah dibagi atau diupayakan dibagi secara kekeluargaan?", "Belum pernah dibagi; pernah diupayakan oleh ..., tetapi tidak berhasil;", "belum dibagi"),
    B("Bagaimana Saudara mengetahui hal-hal tersebut? Apakah melihat sendiri?", "Saya mengetahuinya karena ...;", "pengetahuan langsung saksi"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_WARIS: SetSaksi = {
  id: "kewarisan",
  judul: "Kewarisan (gugatan waris)",
  untuk: "Gugatan pembagian warisan.",
  jenis: ["waris"],
  dasar: [
    "KHI Pasal 171-175 (pewaris, ahli waris, harta peninggalan, halangan, kewajiban ahli waris), 176-193 (bagian ahli waris)",
    DASAR_SAKSI,
  ],
  perluDicek: ["Letak dan batas objek sengketa lebih tepat lewat pemeriksaan setempat (SEMA 7/2001) - perlu dicek."],
  ukur: "ABT server: 1 perkara kewarisan; pertanyaan: pewaris, perkawinan, anak, harta, penguasaan, upaya damai; tidak ada set ABT.",
  pembuka: [
    B("Apakah Saudara kenal dengan para pihak, dan apakah ada hubungan keluarga dengan mereka?", "Ya, saya kenal dengan para pihak karena saya adalah ...;", "hubungan saksi dengan para pihak"),
    B("Apakah Saudara kenal dengan pewaris? Kapan dan karena apa pewaris meninggal dunia?", "Ya, pewaris bernama ... meninggal dunia pada ... karena ...;", "kematian pewaris (KHI Pasal 171 huruf b)"),
  ],
  inti: [
    B("Apa agama pewaris saat meninggal dunia, dan apa agama para ahli warisnya?", "Pewaris dan para ahli waris beragama Islam;", "beragama Islam (KHI Pasal 171-172)"),
    B("Semasa hidupnya, dengan siapa saja pewaris menikah, dan apakah pernah bercerai?", "Pewaris menikah dengan ... dan ... (tidak pernah bercerai);", "ahli waris karena perkawinan"),
    B("Berapa orang anak pewaris, siapa saja, dan apakah masih hidup?", "Pewaris mempunyai ... orang anak, yaitu ...;", "ahli waris karena darah"),
    B("Pada saat pewaris meninggal, apakah orang tua pewaris masih hidup?", "Ayah dan ibu pewaris sudah meninggal lebih dahulu / ...;", "ahli waris orang tua"),
    B("Apakah ada ahli waris yang meninggal lebih dahulu dari pewaris dan meninggalkan anak?", "... (tidak ada / ... meninggal lebih dahulu dan meninggalkan anak bernama ...);", "ahli waris pengganti (KHI Pasal 185)"),
    B("Apakah ada ahli waris yang pernah membunuh, mencoba membunuh, atau menganiaya berat pewaris, atau memfitnahnya?", "Tidak ada;", "halangan mewarisi (KHI Pasal 173)"),
    B("Harta apa saja yang ditinggalkan pewaris, di mana letaknya, dan apa batas-batasnya?", "Harta peninggalan berupa ... terletak di ..., berbatasan ...;", "harta peninggalan (KHI Pasal 171 huruf d-e)"),
    B("Apakah harta tersebut milik pewaris sendiri atau harta bersama dengan isteri/suaminya?", "Harta tersebut diperoleh ...;", "pemisahan harta bersama"),
    B("Siapa yang menguasai harta tersebut sekarang, dan sejak kapan?", "Sekarang dikuasai oleh ... sejak ...;", "penguasaan objek"),
    B("Apakah pewaris meninggalkan utang atau wasiat?", "... (tidak ada / ada utang kepada ...);", "kewajiban ahli waris (KHI Pasal 175)"),
    B("Apakah harta tersebut pernah dibagi atau diupayakan damai secara kekeluargaan?", "Belum pernah dibagi; pernah diupayakan oleh ..., tetapi tidak berhasil;", "belum dibagi"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_PAW: SetSaksi = {
  id: "ahli-waris",
  judul: "Penetapan ahli waris",
  untuk: "Permohonan penetapan ahli waris (P3HP).",
  jenis: ["paw"],
  dasar: ["KHI Pasal 171-174 (pewaris, ahli waris, beragama Islam, halangan, kelompok ahli waris), 185 (ahli waris pengganti), 209 (wasiat wajibah anak/orang tua angkat)", DASAR_SAKSI],
  perluDicek: [],
  ukur: `ABT server: 34 perkara; set ABT "PAW" dipakai 50-97% per butir (yang meninggal 85%, orang tua pewaris 68%, agama 68%, perkawinan 62%, anak 56%).`,
  pembuka: PEMBUKA_PERMOHONAN("memohon penetapan ahli waris"),
  inti: [
    B("Siapa yang telah meninggal dunia, kapan, di mana, dan karena apa?", "Yang meninggal dunia adalah ... pada ... di ... karena ...;", "kematian pewaris"),
    B("Apakah ada unsur penganiayaan atau pembunuhan oleh salah seorang ahli waris sehingga pewaris meninggal?", "Tidak ada, pewaris meninggal murni karena ...;", "halangan mewarisi (KHI Pasal 173)"),
    B("Apakah pewaris meninggal dalam keadaan beragama Islam, dan apakah para ahli waris juga beragama Islam?", "Ya, pewaris dan semua ahli waris beragama Islam;", "beragama Islam (KHI Pasal 171-172)"),
    B("Semasa hidupnya, berapa kali dan dengan siapa pewaris menikah? Apakah pernah bercerai sebelum meninggal?", "Pewaris menikah ... kali dengan ... dan tidak pernah bercerai;", "ahli waris karena perkawinan"),
    B("Berapa orang anak kandung pewaris, siapa saja, dan apakah semuanya masih hidup?", "Pewaris mempunyai ... orang anak kandung, yaitu ...;", "ahli waris karena darah"),
    B("Pada saat pewaris meninggal, apakah ayah dan ibu kandung pewaris masih hidup?", "Ayah dan ibu kandung pewaris sudah meninggal lebih dahulu / ...;", "ahli waris orang tua"),
    B("Karena pewaris tidak meninggalkan anak, apakah pewaris mempunyai saudara kandung?", "Pewaris mempunyai ... orang saudara kandung, yaitu ...;", "ahli waris saudara (bila tidak ada anak)"),
    B("Apakah ada ahli waris yang meninggal lebih dahulu dari pewaris dan meninggalkan anak?", "... (tidak ada / ... meninggal lebih dahulu dan meninggalkan anak bernama ...);", "ahli waris pengganti (KHI Pasal 185)"),
    B("Apakah pewaris mempunyai anak angkat?", "... (tidak ada / ada, bernama ...);", "wasiat wajibah (KHI Pasal 209)"),
    B("Untuk keperluan apa {Pp} memohon penetapan ahli waris?", "Untuk keperluan ...;", "kepentingan permohonan"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_IP: SetSaksi = {
  id: "izin-poligami",
  judul: "Izin poligami",
  untuk: "Permohonan izin beristeri lebih dari seorang.",
  jenis: ["ip"],
  dasar: [
    "UU 1/1974 Pasal 3 ayat (2), 4 ayat (2) (isteri tidak dapat menjalankan kewajiban / cacat atau penyakit tidak dapat disembuhkan / tidak dapat melahirkan keturunan - alternatif), 5 ayat (1) (persetujuan isteri, kemampuan menjamin keperluan hidup, jaminan berlaku adil - kumulatif)",
    "PP 9/1975 Pasal 40-43; KHI Pasal 55-59; KHI Pasal 41 (larangan memadu dengan saudara isteri)",
    "KHI Pasal 94 (harta bersama perkawinan poligami berdiri sendiri-sendiri) dan Buku II Pedoman Pelaksanaan Tugas dan Administrasi Peradilan Agama (KMA/032/SK/IV/2006, revisi 2013): penetapan harta bersama dengan isteri terdahulu diajukan bersama izin poligami - bila tidak diajukan suami maupun isteri (rekonvensi), permohonan dinyatakan tidak dapat diterima",
    DASAR_SAKSI,
  ],
  perluDicek: [],
  ukur: `ABT server: 1 perkara izin poligami; set ABT "IP" 13 butir (alasan, calon isteri, penghasilan, persetujuan, harta bersama).`,
  pembuka: [
    B("Apakah Saudara kenal dengan {P} dan {T}? Apa hubungan Saudara dengan mereka?", "Ya, saya kenal dengan {P} dan {T} karena saya adalah ...;", "hubungan saksi dengan para pihak"),
    B("Apakah Saudara mengetahui maksud {P} menghadap di persidangan ini?", "{P} memohon izin untuk menikah lagi dengan perempuan bernama ...;", "maksud permohonan"),
  ],
  inti: [
    B("Apa hubungan {P} dengan {T}, dan sudah dikaruniai berapa orang anak?", "{P} dan {T} suami isteri yang sah, dikaruniai ... orang anak;", "perkawinan pertama"),
    B("Apa alasan {P} hendak beristeri lagi?", "Alasannya karena {T} ... (tidak dapat menjalankan kewajiban sebagai isteri / sakit ... yang sukar disembuhkan / tidak dapat melahirkan keturunan);", "alasan alternatif (UU 1/1974 Pasal 4 ayat (2))"),
    B("Apakah {T} setuju {P} menikah lagi?", "Ya, {T} setuju dan tidak keberatan;", "persetujuan isteri (Pasal 5 ayat (1) huruf a)"),
    B("Apa pekerjaan {P} dan berapa kira-kira penghasilannya setiap bulan?", "{P} bekerja sebagai ..., penghasilan sekitar Rp... setiap bulan;", "kemampuan menjamin keperluan hidup (Pasal 5 ayat (1) huruf b)"),
    B("Menurut Saudara, apakah {P} sanggup berlaku adil terhadap isteri-isteri dan anak-anaknya?", "Ya, menurut saya {P} sanggup berlaku adil karena ...;", "jaminan berlaku adil (Pasal 5 ayat (1) huruf c)"),
    B("Siapa calon isteri {P}, berapa umurnya, dan apa statusnya?", "Calon isteri {P} bernama ..., umur ... tahun, berstatus ...;", "identitas calon isteri"),
    B("Apakah calon isteri ada hubungan darah, semenda, atau sesusuan dengan {P} atau dengan {T}?", "Tidak ada hubungan darah, semenda, maupun sesusuan;", "tidak ada larangan kawin (KHI Pasal 41)"),
    B("Berapa isteri {P} sekarang?", "{P} sekarang beristeri satu orang, yaitu {T};", "batas empat isteri (KHI Pasal 55 ayat (1))"),
    B("Apakah keluarga calon isteri dan keluarga {T} keberatan atas rencana tersebut?", "Tidak ada yang keberatan;", "tidak ada keberatan"),
    // Keputusan 17 Okt butir 27: harta bersama dengan isteri pertama WAJIB ditanyakan.
    B("Harta apa saja yang diperoleh {P} dan {T} selama perkawinan, dan di mana letaknya?", "Harta bersama {P} dan {T} berupa ..., terletak di ...;", "harta bersama perkawinan pertama (KHI Pasal 94; wajib)"),
    B("Kapan dan dari penghasilan siapa harta tersebut diperoleh, dan atas nama siapa suratnya?", "Harta tersebut diperoleh pada ... dari penghasilan ..., atas nama ...;", "diperoleh selama perkawinan pertama"),
    B("Apakah harta tersebut pernah dijaminkan, atau masih ada utang bersama {P} dan {T}?", "... (tidak pernah dijaminkan dan tidak ada utang / dijaminkan di ...);", "utang bersama perkawinan pertama (KHI Pasal 93)"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_PERWALIAN: SetSaksi = {
  id: "perwalian",
  judul: "Perwalian anak",
  untuk: "Permohonan penetapan wali bagi anak (oleh orang tua kandung atau keluarga lain).",
  jenis: ["perwalian"],
  dasar: [
    "UU 1/1974 Pasal 50-54: anak belum 18 tahun atau belum pernah kawin yang tidak di bawah kekuasaan orang tua berada di bawah kekuasaan wali; wali sedapat-dapatnya keluarga (batas 18 tahun dipakai - keputusan 17 Okt; UU 23/2002 jo. UU 35/2014 Pasal 1 angka 1)",
    "KHI Pasal 107-112 (Pasal 107 ayat (4): wali dewasa, berpikiran sehat, adil, jujur, berkelakuan baik)",
    "UU 23/2002 jo. UU 35/2014 Pasal 33 (perwalian dalam perlindungan anak)",
    DASAR_SAKSI,
  ],
  // Keputusan 17 Okt butir 24: batas umur 18 tahun (UU 1/1974 Pasal 50), bukan 21 tahun KHI Pasal 107 ayat (1).
  perluDicek: [],
  ukur: `ABT server: 30 perkara; set ABT "PA1"/"PA2" dipakai 60-100% per butir (kenal 100%, perilaku pemohon 73%, tujuan perwalian 67%, umur anak 63%).`,
  pembuka: PEMBUKA_PERMOHONAN("memohon ditetapkan sebagai wali bagi anak bernama ..."),
  inti: [
    B("Siapa nama dan berapa umur anak yang dimohonkan perwalian?", "Anak tersebut bernama ..., berumur ... tahun (belum 18 tahun);", "anak belum berumur 18 tahun (UU 1/1974 Pasal 50 ayat (1))"),
    B("Apakah anak tersebut belum pernah menikah?", "Anak tersebut belum pernah menikah;", "belum pernah melangsungkan perkawinan (UU 1/1974 Pasal 50 ayat (1))"),
    B("Siapa ayah dan ibu kandung anak tersebut, dan apakah masih hidup?", "Ayah kandungnya ... dan ibu kandungnya ...; ... telah meninggal dunia pada ... karena ...;", "anak tidak di bawah kekuasaan orang tua"),
    B("Apa hubungan {Pp} dengan anak tersebut?", "{Pp} adalah ... anak tersebut;", "wali dari keluarga (UU 1/1974 Pasal 51 ayat (2))"),
    B("Siapa yang memelihara anak tersebut selama ini, dan bagaimana perlakuannya?", "Selama ini anak tersebut dipelihara oleh {Pp} dengan baik;", "pemeliharaan nyata"),
    B("Bagaimana perilaku {Pp} di masyarakat? Apakah sehat, jujur, dan tidak pernah dihukum?", "{Pp} berperilaku baik, sehat jasmani dan rohani, jujur, dan tidak pernah dihukum;", "syarat wali (KHI Pasal 107 ayat (4))"),
    B("Apakah {Pp} dan anak tersebut beragama Islam?", "Ya, {Pp} dan anak tersebut beragama Islam;", "agama wali dan anak"),
    B("Untuk keperluan apa {Pp} memohon penetapan perwalian?", "Untuk keperluan ... (mengurus harta/rekening/sekolah anak);", "kepentingan anak"),
    B("Apakah ada keluarga lain yang keberatan bila {Pp} menjadi wali?", "Tidak ada keluarga yang keberatan;", "tidak ada keberatan"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_WA: SetSaksi = {
  id: "wali-adhal",
  judul: "Wali adhal",
  untuk: "Permohonan penetapan wali adhal (wali nasab enggan menikahkan).",
  jenis: ["wa"],
  dasar: [
    "KHI Pasal 21-23 (urutan wali nasab; Pasal 23 ayat (2): wali hakim bila wali adhal setelah ada putusan Pengadilan Agama)",
    "UU 1/1974 jo. UU 16/2019 Pasal 6-8 (syarat dan larangan perkawinan)",
    "PMA 30/2005 tentang Wali Hakim (keputusan pengguna 17 Okt butir 19: tetap dipakai)",
    DASAR_SAKSI,
  ],
  perluDicek: [],
  ukur: `ABT server: 3 perkara; set ABT "WA" dipakai 100% (12 butir); sekufu ditanyakan di 1 perkara.`,
  pembuka: PEMBUKA_PERMOHONAN("memohon penetapan wali adhal karena walinya tidak mau menikahkan"),
  inti: [
    B("Siapa nama, umur, agama, dan pekerjaan calon suami {Pp}?", "Calon suami {Pp} bernama ..., umur ... tahun, beragama Islam, bekerja sebagai ...;", "identitas calon suami"),
    B("Siapa wali nasab {Pp}, apa hubungannya, dan apakah masih hidup serta beragama Islam?", "Wali nasab {Pp} adalah ... bernama ..., masih hidup dan beragama Islam;", "wali nasab yang berhak (KHI Pasal 21)"),
    B("Apakah calon suami sudah melamar dan wali sudah diminta menikahkan?", "Sudah, lamaran disampaikan pada ... dan wali sudah diminta, tetapi menolak;", "wali diminta dan menolak"),
    B("Apa alasan wali tidak mau menikahkan {Pp}?", "Alasannya karena ...;", "keengganan wali"),
    B("Menurut Saudara, apakah alasan wali tersebut dibenarkan menurut agama?", "Menurut saya alasan tersebut tidak dibenarkan karena ...;", "adhal tanpa alasan yang sah"),
    B("Apakah wali sudah dinasihati atau dibujuk oleh keluarga atau tokoh masyarakat?", "Sudah dinasihati oleh ..., tetapi tetap menolak;", "upaya kekeluargaan"),
    B("Apakah antara {Pp} dan calon suaminya ada hubungan darah, semenda, atau sesusuan?", "Tidak ada hubungan darah, semenda, maupun sesusuan;", "tidak ada larangan kawin"),
    B("Apa status {Pp} dan calon suaminya saat ini, dan berapa umur {Pp}?", "{Pp} berstatus ..., umur ... tahun; calon suaminya berstatus ...;", "syarat umur dan status"),
    B("Apakah {Pp} dan calon suaminya sepadan (sekufu), misalnya dalam agama dan akhlak?", "Ya, keduanya seagama dan calon suami berakhlak baik;", "sekufu"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_AUA: SetSaksi = {
  id: "asal-usul-anak",
  judul: "Asal usul anak",
  untuk: "Permohonan penetapan asal usul anak.",
  jenis: ["aua"],
  dasar: [
    "UU 1/1974 Pasal 42, 43, 55; KHI Pasal 99-100, 103 (anak sah, pembuktian asal usul anak)",
    "Putusan MK 46/PUU-VIII/2010 (hubungan perdata anak dengan ayah biologis)",
    "KHI Pasal 14, 19-30 (rukun nikah: wali, saksi, ijab kabul, mahar)",
    DASAR_SAKSI,
  ],
  perluDicek: ["Bila anak lahir sebelum akad nikah tercatat (nikah siri lalu nikah ulang), kedudukan anak dan amar asal usul perlu dicek terhadap KHI Pasal 99-100 dan Putusan MK 46/2010."],
  ukur: `ABT server: 4 perkara; set ABT "08a" 13 butir (pernikahan, wali, saksi, mahar, status, anak lahir sebelum buku nikah).`,
  pembuka: PEMBUKA_PERMOHONAN("memohon penetapan asal usul anak"),
  inti: [
    B("Kapan dan di mana {P1} dan {P2} menikah? Apakah Saudara hadir?", "{P1} dan {P2} menikah pada ... di ..., dan saya hadir;", "perkawinan orang tua"),
    B("Siapa wali nikah, siapa yang menikahkan, dan siapa saksi nikahnya?", "Wali nikahnya ... bernama ..., yang menikahkan ..., saksinya ... dan ...;", "rukun nikah"),
    B("Apa mahar yang diberikan, dan apakah ada ijab kabul?", "Maharnya berupa ...; ada ijab kabul;", "rukun nikah"),
    B("Apa status {P1} dan {P2} saat menikah, dan apakah ada hubungan darah, semenda, atau sesusuan di antara mereka?", "{P1} berstatus ..., {P2} berstatus ...; tidak ada hubungan darah, semenda, maupun sesusuan;", "tidak ada larangan kawin"),
    B("Apakah pernikahan itu tercatat di KUA? Bila tidak, apakah kemudian menikah ulang secara tercatat dan kapan?", "Pernikahan itu ... (tidak tercatat; menikah ulang dan tercatat pada ...);", "pencatatan perkawinan"),
    B("Siapa nama anak yang dimohonkan, dan kapan serta di mana ia lahir?", "Anak tersebut bernama ..., lahir pada ... di ...;", "identitas anak"),
    B("Apakah anak tersebut lahir dari pernikahan {P1} dan {P2}, sesudah mereka menikah?", "Ya, anak tersebut lahir dari pernikahan {P1} dan {P2}, sesudah akad nikah;", "anak sah (UU 1/1974 Pasal 42; KHI Pasal 99)"),
    B("Apakah ada pihak lain yang mengaku sebagai ayah anak tersebut, atau keberatan atas permohonan ini?", "Tidak ada;", "tidak ada sengketa nasab"),
    B("Untuk keperluan apa {Pp} memohon penetapan asal usul anak?", "Untuk keperluan ... (pengurusan akta kelahiran);", "kepentingan permohonan"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_ANGKAT: SetSaksi = {
  id: "pengangkatan-anak",
  judul: "Pengangkatan anak",
  untuk: "Permohonan pengangkatan anak (perkara lain-lain).",
  jenis: ["angkat"],
  dasar: [
    "UU 23/2002 jo. UU 35/2014 Pasal 39-41: demi kepentingan terbaik anak, tidak memutus hubungan darah, seagama",
    "PP 54/2007 tentang Pelaksanaan Pengangkatan Anak Pasal 2-4 dan 12-13 (syarat anak dan calon orang tua angkat)",
    "Permensos 110/HUK/2009 tentang Persyaratan Pengangkatan Anak: Pasal 4 (anak belum 18 tahun), Pasal 20 untuk pengangkatan langsung (calon orang tua angkat 30-55 tahun, menikah sah paling singkat 5 tahun, belum punya anak atau hanya satu, mampu ekonomi dan sosial, persetujuan anak dan izin tertulis orang tua kandung/wali, laporan sosial, rekomendasi Dinas Sosial kabupaten/kota, izin Instansi Sosial provinsi); Pasal 7 ayat (1) huruf l (lewat lembaga: diasuh paling singkat 6 bulan)",
    "KHI Pasal 171 huruf h dan 209 (anak angkat, wasiat wajibah)",
    DASAR_SAKSI,
  ],
  // Keputusan 17 Okt butir 25 "Permensos terbaru": tidak ditemukan pengganti; status dicek di JDIH BPK 17 Okt 2026.
  perluDicek: ["Permensos 110/HUK/2009 tercatat masih berlaku di JDIH BPK (peraturan.bpk.go.id, dicek 17 Okt 2026) dan belum ditemukan Permensos penggantinya - periksa lagi bila Kementerian Sosial menerbitkan aturan baru."],
  ukur: "ABT server: 1 perkara pengangkatan anak (di jenis Lain-Lain); tidak ada set ABT.",
  pembuka: PEMBUKA_PERMOHONAN("memohon penetapan pengangkatan anak"),
  inti: [
    B("Siapa nama, umur, dan asal anak yang akan diangkat, dan siapa orang tua kandungnya?", "Anak tersebut bernama ..., umur ... (belum 18 tahun), anak kandung dari ... dan ...;", "identitas anak, belum 18 tahun (Permensos 110/HUK/2009 Pasal 4)"),
    B("Sejak kapan anak tersebut diasuh {Pp}, dan bagaimana tumbuh kembangnya selama diasuh?", "Sejak ..., anak tersebut tumbuh sehat dan ...;", "pengasuhan sebelumnya (lewat lembaga: paling singkat 6 bulan, Permensos 110/HUK/2009 Pasal 7)"),
    B("Apakah orang tua kandung anak tersebut setuju anaknya diangkat {Pp}, dan apakah ada surat persetujuannya?", "Ya, orang tua kandungnya setuju, menyerahkan anak tersebut secara sukarela, dan membuat surat persetujuan;", "izin tertulis orang tua kandung/wali (Permensos 110/HUK/2009 Pasal 20 huruf i)"),
    B("Bila anak tersebut sudah dapat menyampaikan pendapat, apakah ia mau diangkat {Pp}?", "Anak tersebut ... (belum dapat menyampaikan pendapat / mau tinggal bersama {Pp});", "persetujuan anak (Permensos 110/HUK/2009 Pasal 20 huruf i)"),
    B("Apa agama anak tersebut dan apa agama {Pp}?", "Anak tersebut dan {Pp} sama-sama beragama Islam;", "seagama (UU 35/2014 Pasal 39 ayat (3))"),
    B("Berapa umur {Pp}, sudah berapa lama menikah, dan apakah sudah mempunyai anak kandung?", "{Pp} berumur ... tahun, menikah sejak ... (sudah ... tahun), dan ... anak kandung;", "umur 30-55 tahun, menikah paling singkat 5 tahun, belum punya anak atau hanya satu (Permensos 110/HUK/2009 Pasal 20 huruf b, e, g)"),
    B("Apakah petugas Dinas Sosial pernah datang memeriksa keadaan {Pp} dan anak tersebut?", "Ya, petugas Dinas Sosial ... datang pada ... / belum pernah;", "laporan sosial dan rekomendasi Dinas Sosial (Permensos 110/HUK/2009 Pasal 20 huruf k-m)"),
    B("Bagaimana kesehatan dan perilaku {Pp} di masyarakat? Apakah pernah dihukum?", "{Pp} sehat, berkelakuan baik, dan tidak pernah dihukum;", "syarat calon orang tua angkat"),
    B("Apa pekerjaan {Pp} dan apakah mampu membiayai anak tersebut?", "{Pp} bekerja sebagai ..., mampu membiayai hidup dan sekolah anak tersebut;", "kemampuan ekonomi"),
    B("Apakah {Pp} memahami bahwa pengangkatan anak tidak memutus hubungan darah anak dengan orang tua kandungnya?", "Ya, {Pp} memahami hal itu;", "tidak memutus nasab (PP 54/2007 Pasal 4)"),
    B("Apa tujuan {Pp} mengangkat anak tersebut?", "Tujuannya untuk kepentingan anak, yaitu ...;", "kepentingan terbaik anak"),
    B("Apakah ada pihak lain yang keberatan atas pengangkatan anak tersebut?", "Tidak ada;", "tidak ada keberatan"),
  ],
  penutup: PENUTUP_UMUM,
};

const SET_UMUM: SetSaksi = {
  id: "umum",
  judul: "Permohonan umum",
  untuk: "Perkara yang belum punya set khusus: pertanyaan dasar tentang fakta yang dimohonkan.",
  jenis: ["umum"],
  dasar: [DASAR_SAKSI, "RBg Pasal 172 ayat (1) dan (2) / HIR Pasal 145: saksi yang tidak dapat didengar dan pengecualian keluarga dalam perkara kedudukan perdata"],
  perluDicek: [],
  ukur: "ABT server: perkara lain-lain 2 perkara; pola dasar: kenal, maksud, fakta, sumber pengetahuan, keberatan, penutup.",
  pembuka: PEMBUKA_PERMOHONAN("..."),
  inti: [
    B("Apa yang Saudara ketahui tentang hal yang dimohonkan {Pp}?", "Yang saya ketahui ...;", "fakta pokok"),
    B("Kapan dan di mana kejadian tersebut?", "Kejadiannya pada ... di ...;", "waktu dan tempat"),
    B("Bagaimana Saudara mengetahuinya? Apakah melihat atau mengalami sendiri?", "Saya mengetahuinya karena ...;", "pengetahuan langsung saksi"),
    B("Untuk keperluan apa {Pp} mengajukan permohonan ini?", "Untuk keperluan ...;", "kepentingan permohonan"),
    B("Apakah ada pihak yang keberatan atas permohonan ini?", "Tidak ada;", "tidak ada keberatan"),
  ],
  penutup: PENUTUP_UMUM,
};

/** Semua set (untuk halaman Pengaturan dan uji). Cerai per huruf disusun dari modul. */
export function semuaSetSaksi(): SetSaksi[] {
  return [
    setCerai("F"),
    ...["A", "B", "C", "D", "E", "G", "H"].map((h) => setCerai(h)),
    setCerai("A", { jenis: "ct" }),
    setCerai("G", { tahunNikah: TAHUN_SIGHAT_SEKARANG - 1 }),
    SET_HADHANAH,
    SET_NAFKAH,
    SET_SEBAB,
    SET_VERSTEK,
    SET_KONTRA,
    SET_SERUMAH,
    SET_ITSBAT,
    setDispensasi(true),
    setDispensasi(false),
    SET_HB,
    SET_WARIS,
    SET_PAW,
    SET_IP,
    SET_PERWALIAN,
    SET_WA,
    SET_AUA,
    SET_ANGKAT,
    SET_UMUM,
  ];
}

// ----------------------------------------------------------------------------
// Pemilihan dan pengisian
// ----------------------------------------------------------------------------
/** Jenis perkara dari nama jenis SIPP (didahulukan), lalu folder blangko Derry; nomor & sebutan untuk cerai tanpa nama jenis. */
export function kodeJenisSaksi(namaJenis: string, nomor = "", folder = "", sebutanP = ""): KodeJenisSaksi {
  const dariNama = jenisDariTeks(namaJenis.toLowerCase(), nomor, sebutanP);
  return dariNama !== "umum" ? dariNama : jenisDariTeks(folder.toLowerCase(), nomor, sebutanP);
}
function jenisDariTeks(j: string, nomor: string, sebutanP: string): KodeJenisSaksi {
  if (/cerai\s*talak|perceraian ct|\bct\b/.test(j)) return "ct";
  if (/cerai\s*gugat|perceraian cg|\bcg\b/.test(j)) return "cg";
  // Cerai talak juga bernomor Pdt.G: bedakan lewat sebutan (Pemohon = cerai talak). Kumulasi (itsbat, hak asuh) tetap cerai.
  if (/cerai|perceraian/.test(j)) return sebutanP === "Pemohon" && !/pdt\.p/i.test(nomor) ? "ct" : "cg";
  if (/dispensasi/.test(j)) return "dk";
  if (/poligami/.test(j)) return "ip";
  if (/wali\s*adh/.test(j)) return "wa";
  if (/asal\s*usul/.test(j)) return "aua";
  if (/pengangkatan anak|anak angkat/.test(j)) return "angkat";
  if (/ahli\s*waris|p3hp/.test(j)) return "paw";
  if (/kewarisan|waris/.test(j)) return "waris";
  if (/harta\s*bersama/.test(j)) return "hb";
  if (/perwalian/.test(j)) return "perwalian";
  if (/itsbat|istbat|isbat|pengesahan perkawinan/.test(j)) return "itsbat";
  if (/hak asuh|hadh?anah|penguasaan anak|pemeliharaan anak/.test(j)) return "hadhanah";
  if (/nafkah/.test(j)) return "nafkah";
  return "umum";
}

/**
 * Huruf alasan A-H dari isian #8503#, dibaca seperti kueri ABT (hapus "DAN", "&", ",", spasi, "+", "/", ".", "-" lalu per
 * huruf; FASAKH/MURTAD = H): "BF", "fb", "F dan B" = BF, "Murtad" = H. Bentuk pilihan ALETA "F · uraian" dibaca hurufnya
 * saja. Teks bebas ("huruf F") TIDAK dikenal -> "" (huruf tidak ditebak dari kata-katanya). Sama dengan hurufAlasanDari
 * di ekstensi-sipp/blangko-derry-isian.js.
 */
export function hurufAlasan(teks: string): string {
  const v = String(teks ?? "").trim();
  const depan = v.match(/^([A-Ha-h]+)\s*·/);
  const u = v.toUpperCase();
  const n = depan ? depan[1].toUpperCase() : /^(FASAKH|MURTAD)$/.test(u) ? "H" : u.replace(/DAN/g, "").replace(/[&,;+/.\s-]/g, "");
  if (!/^[A-H]+$/.test(n)) return "";
  return [...new Set(n.split(""))].sort().join("");
}

export type KonteksSaksi = {
  sebutanP?: string;
  sebutanT?: string;
  /** Jumlah pihak pertama (Penggugat/Pemohon) - para Pemohon / Pemohon I-II. */
  jumlahP?: number;
};

export type BarisSaksi = { no: string; tanya: string; jawab: string };

/** Ganti tanda {..} menurut jenis dan sebutan; huruf pertama kalimat dibesarkan. */
export function isiTanda(teks: string, jenis: KodeJenisSaksi, k: KonteksSaksi): string {
  const P = k.sebutanP || (jenis === "cg" || jenis === "hb" || jenis === "waris" ? "Penggugat" : "Pemohon");
  const T = k.sebutanT || (P === "Penggugat" ? "Tergugat" : "Termohon");
  const talak = jenis === "ct" || (P === "Pemohon" && (jenis === "nafkah" || jenis === "hadhanah"));
  const jamak = (k.jumlahP || 1) > 1;
  // Bentuk jamak dan urutan ("para Pemohon", "Pemohon I", "Pemohon II") ditulis di SATU tempat: sebutan-pihak.ts.
  const peta: Record<string, string> = {
    P,
    T,
    suami: talak ? P : T,
    isteri: talak ? T : P,
    Pp: paraSebutan(P, k.jumlahP),
    P1: sebutanBerurut(P, 1, k.jumlahP),
    P2: jamak ? sebutanBerurut(P, 2, k.jumlahP) : T,
    ajuan: talak ? `memohon izin menjatuhkan talak terhadap ${T}` : `mengajukan gugatan cerai terhadap ${T}`,
  };
  const h = teks.replace(/\{(\w+)\}/g, (m, kunci: string) => (kunci in peta ? peta[kunci] : m));
  return h.charAt(0).toUpperCase() + h.slice(1);
}

/** Baris tanya jawab siap dimuat: tambahan hanya bagian inti (dipasang di bawah pertanyaan yang ada). */
export function barisSet(set: SetSaksi, jenis: KodeJenisSaksi, k: KonteksSaksi): BarisSaksi[] {
  const butir = set.tambahan ? set.inti : [...set.pembuka, ...set.inti, ...set.penutup];
  return butir.map((b, i) => ({ no: String(i + 1), tanya: isiTanda(b.tanya, jenis, k), jawab: isiTanda(b.jawab, jenis, k) }));
}

export type TawaranSet = {
  id: string;
  judul: string;
  untuk: string;
  utama: boolean;
  tambahan: boolean;
  sebab: string;
  dasar: string[];
  perluDicek: string[];
  baris: BarisSaksi[];
};

/**
 * Set yang ditawarkan untuk satu perkara, urut: yang disarankan (utama) dulu.
 * Cerai: huruf dari #8503# bila ada -> satu set gabungan huruf itu; tanpa
 * huruf -> F (paling sering). Huruf lain tetap ditawarkan; G hanya cerai gugat.
 * Tambahan hak asuh / nafkah / itsbat ditawarkan pada cerai, disarankan bila
 * folder blangko menyebut kumulasinya.
 */
export function tawarkanSetSaksi(
  p: { namaJenis?: string; nomor?: string; folder?: string; huruf?: string; /** Tahun akad nikah - huruf G sebelum 1990 memakai sighat lama. */ tahunNikah?: number } & KonteksSaksi
): { jenis: KodeJenisSaksi; huruf: string; set: TawaranSet[] } {
  const jenis = kodeJenisSaksi(p.namaJenis || "", p.nomor || "", p.folder || "", p.sebutanP || "");
  const huruf = hurufAlasan(p.huruf || "");
  const folder = String(p.folder || "").toLowerCase();
  const k: KonteksSaksi = { sebutanP: p.sebutanP, sebutanT: p.sebutanT, jumlahP: p.jumlahP };
  const out: TawaranSet[] = [];
  const tawar = (s: SetSaksi, utama: boolean, sebab: string, jenisIsi: KodeJenisSaksi = jenis) => {
    if (out.some((x) => x.id === s.id)) return;
    out.push({ id: s.id, judul: s.judul, untuk: s.untuk, utama, tambahan: Boolean(s.tambahan), sebab, dasar: s.dasar, perluDicek: s.perluDicek, baris: barisSet(s, jenisIsi, k) });
  };
  if (jenis === "cg" || jenis === "ct") {
    const sah = huruf.split("").filter((h) => h !== "G" || jenis === "cg").join("");
    const tahun = Number(p.tahunNikah) || undefined;
    const opsi: OpsiCerai = { jenis, tahunNikah: tahun };
    if (sah) tawar(setCerai(sah, opsi), true, `alasan perkara ini huruf ${sah.split("").join(", ")}${sah.includes("G") && tahun && tahun < TAHUN_SIGHAT_SEKARANG ? `; nikah tahun ${tahun} (sighat sebelum PMA 2/1990)` : ""}`);
    else tawar(setCerai("F", opsi), true, "alasan perkara belum diisi; huruf F paling sering di PA Donggala");
    if (/hak asuh|hadh?anah/.test(folder)) tawar(SET_HADHANAH, true, "blangko kumulasi hak asuh anak");
    if (/itsbat|istbat/.test(folder)) tawar({ ...SET_ITSBAT, id: "tambah-itsbat", judul: "Tambahan - itsbat nikah", tambahan: true }, true, "blangko kumulasi itsbat nikah", "itsbat");
    tawar(setCerai("F", opsi), false, "alasan perselisihan terus-menerus");
    for (const h of ["A", "B", "C", "D", "E", "G", "H"]) if (h !== "G" || jenis === "cg") tawar(setCerai(h, opsi), false, `alasan huruf ${h}`);
    // Huruf G untuk nikah sebelum 1990 (bunyi sighat lama) - ditawarkan bila tahun nikah belum diketahui.
    if (jenis === "cg" && !tahun) tawar(setCerai("G", { jenis, tahunNikah: TAHUN_SIGHAT_SEKARANG - 1 }), false, "alasan huruf G, perkawinan sebelum 1990 (bunyi sighat lama)");
    // kehadiran Tergugat/Termohon dibaca dari nama folder blangko BAS ("Verstek", "T Tidak Hadir" / "P & T Hadir", "Kontra")
    const verstek = /verstek|\bt\s+tidak\s+hadir/.test(folder);
    const kontra = !verstek && /kontra|\bp\s*&\s*t\s+hadir|tertulis/.test(folder);
    tawar(SET_VERSTEK, verstek, verstek ? "blangko BAS perkara verstek (Tergugat/Termohon tidak hadir)" : "bila Tergugat/Termohon tidak hadir");
    tawar(SET_KONTRA, kontra, kontra ? "blangko BAS perkara dijawab (Tergugat/Termohon hadir)" : "bila Tergugat/Termohon hadir dan menjawab");
    tawar(SET_SEBAB, false, "bila sebab perselisihan perlu diperinci");
    tawar(SET_SERUMAH, false, "bila para pihak masih serumah");
    tawar(SET_HADHANAH, false, "bila ada tuntutan hak asuh anak");
    tawar(SET_NAFKAH, false, "bila ada tuntutan nafkah");
    tawar({ ...SET_ITSBAT, id: "tambah-itsbat", judul: "Tambahan - itsbat nikah", tambahan: true }, false, "bila digabung dengan itsbat nikah", "itsbat");
    return { jenis, huruf, set: out };
  }
  const utama: Partial<Record<KodeJenisSaksi, SetSaksi[]>> = {
    itsbat: [SET_ITSBAT],
    dk: [setDispensasi(true), setDispensasi(false)],
    hb: [SET_HB],
    waris: [SET_WARIS],
    paw: [SET_PAW],
    ip: [SET_IP],
    perwalian: [SET_PERWALIAN],
    wa: [SET_WA],
    aua: [SET_AUA],
    angkat: [SET_ANGKAT],
    hadhanah: [{ ...SET_HADHANAH, id: "hak-asuh", judul: "Hak asuh anak", tambahan: false }],
    nafkah: [{ ...SET_NAFKAH, id: "nafkah", judul: "Nafkah", tambahan: false }],
  };
  const daftar = utama[jenis] || [];
  daftar.forEach((s, i) => tawar(s, i === 0, i === 0 ? "sesuai jenis perkara" : "pilihan lain untuk jenis ini"));
  if (jenis === "umum" && /lain/.test(`${p.namaJenis || ""} ${folder}`.toLowerCase())) tawar(SET_ANGKAT, false, "perkara lain-lain: pengangkatan anak");
  tawar(SET_UMUM, !daftar.length, daftar.length ? "pertanyaan dasar" : "jenis perkara ini belum punya set khusus");
  // Yang disarankan selalu di depan (pilihan pertama di layar).
  return { jenis, huruf, set: out.sort((a, b) => Number(b.utama) - Number(a.utama)) };
}
