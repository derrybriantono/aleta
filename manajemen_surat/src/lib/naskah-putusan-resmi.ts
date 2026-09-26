import type { KunciBagian } from "@/lib/susunan-putusan";

/**
 * MEMECAH NASKAH PUTUSAN RESMI MENJADI BAGIAN-BAGIANNYA.
 *
 * ============================================================================
 * INI KEBALIKAN pecahNaskahPutusan, DAN KEDUANYA MEMANG HARUS ADA
 * ============================================================================
 *
 * pecahNaskahPutusan di susunan-putusan.ts memecah naskah yang DITULIS ALETA
 * sendiri. Ia tidak menebak apa pun, sebab judul bagiannya ditulis
 * naskahDariKerangka dengan bentuk yang pasti.
 *
 * Yang dipecah DI SINI adalah naskah yang ditulis templat satker - dan di
 * situ judulnya tunduk pada kebiasaan pengadilan, bukan pada ALETA:
 *
 *   DUDUK PERKARA          TENTANG DUDUK PERKARA      TENTANG DUDUKNYA PERKARA
 *   PERTIMBANGAN HUKUM     TENTANG PERTIMBANGAN HUKUM TENTANG HUKUMNYA
 *   MENGADILI              M E N G A D I L I          MENETAPKAN
 *
 * Bentuk berenggang itu bukan kekeliruan pengetikan - ia gaya tetap naskah
 * pengadilan sejak mesin tik, dan masih dipakai pada sebagian besar templat.
 * Karena itu judul dicocokkan dalam bentuk RAPAT: seluruh spasi dan titik
 * dibuang lebih dahulu, lalu dibandingkan sama-persis. Dibandingkan
 * sama-persis, bukan dengan "memuat", supaya kalimat panjang yang kebetulan
 * memuat kata MENGADILI tidak pernah disangka judul.
 *
 * ============================================================================
 * YANG TIDAK DITEMUKAN DINYATAKAN TIDAK DITEMUKAN
 * ============================================================================
 *
 * Bagian yang jangkarnya tidak ada TIDAK dikira-kira dari posisi. Ia
 * dikembalikan kosong beserta sebabnya, dan pemanggilnya menuliskan sebab itu
 * apa adanya kepada petugas.
 *
 * Naskah putusan yang salah potong jauh lebih berbahaya daripada naskah yang
 * gagal dipotong: yang pertama masuk ke borang SIPP dan ditandatangani,
 * yang kedua berhenti di layar dan dibaca orang.
 */

/** Judul bagian, dalam bentuk rapat (tanpa spasi dan titik, huruf besar). */
const JANGKAR: Array<{ rapat: string[]; kunci: "dudukPerkara" | "pertimbangan" | "amar" }> = [
  {
    kunci: "dudukPerkara",
    rapat: ["DUDUKPERKARA", "TENTANGDUDUKPERKARA", "TENTANGDUDUKNYAPERKARA", "TENTANGDUDUKPERKARANYA"],
  },
  {
    kunci: "pertimbangan",
    rapat: [
      "PERTIMBANGANHUKUM",
      "TENTANGPERTIMBANGANHUKUM",
      "TENTANGHUKUMNYA",
      "TENTANGHUKUM",
      "PERTIMBANGANHUKUMNYA",
    ],
  },
  { kunci: "amar", rapat: ["MENGADILI", "MENETAPKAN", "MENGADILIDALAMPOKOKPERKARA"] },
];

/** Judul yang mengawali naskah - "PUTUSAN" atau "PENETAPAN", sering berenggang. */
const RAPAT_KEPALA = new Set(["PUTUSAN", "PENETAPAN", "SALINANPUTUSAN", "SALINANPENETAPAN"]);

/** Irah-irah. Ia penanda akhir kepala yang paling dapat diandalkan. */
const RAPAT_IRAH = "DEMIKEADILANBERDASARKANKETUHANANYANGMAHAESA";

/**
 * Perabot halaman - bukan naskah, dan dibuang sebelum apa pun dipotong.
 *
 * Tanpa ini, "1 dari 13 Halaman" masuk ke kepala putusan, dan pada naskah
 * yang dipetik dari PDF ia masuk tiga belas kali di tengah-tengah kalimat.
 */
const PERABOT: RegExp[] = [
  /^\d+\s*dari\s*\d+\s*halaman$/i,
  /^halaman\s*\d+(\s*dari\s*\d+)?$/i,
  /^(putusan|penetapan)\s+nomor\s+\S+$/i,
  /^salinan$/i,
  /^disclaimer$/i,
  /^email\s*:/i,
  /^telp\s*:/i,
  /^kepaniteraan mahkamah agung/i,
  /^dalam hal anda menemukan/i,
];

export type BagianResmi = Partial<Record<KunciBagian, string>>;

export type HasilPecah = {
  bagian: BagianResmi;
  /** Bagian yang jangkarnya tidak ditemukan, beserta sebabnya. */
  halangan: Partial<Record<KunciBagian, string>>;
  /** Baris yang dibuang sebagai perabot halaman - dilaporkan, bukan didiamkan. */
  perabotDibuang: number;
};

/**
 * Bentuk rapat sebuah baris: spasi dan titik dibuang, huruf dibesarkan.
 *
 * ============================================================================
 * TITIK DUA DI UJUNG JUDUL IKUT DIBUANG
 * ============================================================================
 *
 * "MENGADILI:" dan "MENETAPKAN :" adalah gaya templat satker, bukan salah
 * ketik. Diukur atas 39 e-Doc PA Donggala yang sudah diterima SIPP: amar
 * KOSONG pada 18 di antaranya (12 "MENGADILI:", 6 "MENETAPKAN:") karena judul
 * bertitik dua tidak pernah sama-persis dengan "MENGADILI". Hanya titik dua di
 * UJUNG yang dibuang - kalimat "Menimbang, bahwa ... sebagai berikut:" tetap
 * bukan judul, sebab perbandingannya tetap sama-persis.
 */
function rapat(baris: string): string {
  return baris.replace(/[\s.]+/g, "").replace(/:+$/, "").toUpperCase();
}

/**
 * ============================================================================
 * KALIMAT PENUTUP DICARI SESUDAH AMAR
 * ============================================================================
 *
 * Pola lama hanya mengenal "Demikian diputuskan/ditetapkan/dibacakan". Pada 5
 * dari 39 e-Doc penutupnya berbunyi lain - "Demikianlah penetapan ini
 * dijatuhkan", "Demikian dalam rapat musyawarah" - sehingga amar menyeret
 * rincian biaya, meterai, dan tanda tangan sampai ujung naskah.
 *
 * Pola yang lebih luas HANYA dicari sesudah jangkar amar. Di duduk perkara
 * ada kalimat seperti "Demikian Duplik Tergugat..." (546/Pdt.G/2024) yang
 * akan tertangkap bila pencarian dimulai dari awal naskah. Bila pola luas
 * tidak ketemu, pola lama dipakai persis seperti sebelumnya.
 */
const POLA_PENUTUP_LAMA = /^demikian\s+(diputuskan|ditetapkan|dibacakan)/i;
const POLA_PENUTUP_SESUDAH_AMAR =
  /^demikian(lah)?\b.{0,60}\b(diputuskan|dijatuhkan|ditetapkan|dibacakan|musyawarah)/i;

function perabot(baris: string): boolean {
  const bersih = baris.trim();
  if (!bersih) return false;
  return PERABOT.some((pola) => pola.test(bersih));
}

/**
 * Memecah naskah putusan resmi.
 *
 * Masukannya teks biasa - hasil bacaRtf, atau naskah yang ditempel petugas.
 */
export function pecahNaskahResmi(naskah: string): HasilPecah {
  const semua = String(naskah ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((b) => b.trim());

  const baris: string[] = [];
  let perabotDibuang = 0;
  for (const satu of semua) {
    if (perabot(satu)) {
      perabotDibuang += 1;
      continue;
    }
    baris.push(satu);
  }

  const bagian: BagianResmi = {};
  const halangan: Partial<Record<KunciBagian, string>> = {};

  // ------------------------------------------------------------ jangkar
  const cari = (rapatCari: string[]): number =>
    baris.findIndex((satu) => satu && rapatCari.includes(rapat(satu)));

  const iKepala = baris.findIndex((satu) => satu && RAPAT_KEPALA.has(rapat(satu)));
  const iIrah = baris.findIndex((satu) => satu && rapat(satu) === RAPAT_IRAH);
  const letak: Partial<Record<"dudukPerkara" | "pertimbangan" | "amar", number>> = {};
  for (const { kunci, rapat: pola } of JANGKAR) {
    const di = cari(pola);
    if (di >= 0) letak[kunci] = di;
  }

  // Penutup dikenali dari "Demikian diputuskan/ditetapkan" - kalimat yang
  // dalam naskah putusan hanya pernah muncul sekali, tepat sesudah amar.
  // Bentuk yang lebih luas dicari lebih dulu, dan HANYA sesudah jangkar amar;
  // lihat catatan pada POLA_PENUTUP_SESUDAH_AMAR.
  const letakAmar = letak.amar;
  const iPenutupSesudahAmar =
    letakAmar !== undefined
      ? baris.findIndex((satu, i) => i > letakAmar && POLA_PENUTUP_SESUDAH_AMAR.test(satu))
      : -1;
  const iPenutup =
    iPenutupSesudahAmar >= 0 ? iPenutupSesudahAmar : baris.findIndex((satu) => POLA_PENUTUP_LAMA.test(satu));

  const potong = (dari: number, sampai: number): string =>
    baris
      .slice(dari, sampai)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // ------------------------------------------------------------- kepala
  // Dari judul PUTUSAN sampai nama pengadilan tepat sesudah irah-irah.
  if (iKepala >= 0 && iIrah > iKepala) {
    const sesudahIrah = baris[iIrah + 1] ?? "";
    const ikutPengadilan = /^(pengadilan|mahkamah)/i.test(sesudahIrah);
    bagian.kepala = potong(iKepala, iIrah + (ikutPengadilan ? 2 : 1));
  } else if (iKepala >= 0) {
    halangan.kepala = "Irah-irah tidak ditemukan, jadi batas akhir kepala putusan tidak dapat dipastikan.";
  } else {
    halangan.kepala = 'Judul "PUTUSAN" atau "PENETAPAN" tidak ditemukan pada barisnya sendiri.';
  }

  // ---------------------------------------------------------- identitas
  // Antara akhir kepala dan judul DUDUK PERKARA. Tidak dikenali dari kata
  // pembukanya: "Memeriksa dan mengadili" berbeda-beda antar templat, tetapi
  // letaknya di antara dua jangkar itu tidak pernah berbeda.
  const akhirKepala = bagian.kepala ? iKepala + bagian.kepala.split("\n").length : -1;
  if (akhirKepala >= 0 && letak.dudukPerkara !== undefined && letak.dudukPerkara > akhirKepala) {
    bagian.identitas = potong(akhirKepala, letak.dudukPerkara);
  } else {
    halangan.identitas =
      "Identitas para pihak terletak di antara kepala putusan dan DUDUK PERKARA; salah satu batasnya tidak ditemukan.";
  }

  // -------------------------------------------------------- duduk perkara
  if (letak.dudukPerkara !== undefined) {
    const sampai = letak.pertimbangan ?? letak.amar ?? iPenutup;
    if (sampai !== undefined && sampai > letak.dudukPerkara) {
      bagian.dudukPerkara = potong(letak.dudukPerkara + 1, sampai);
    } else {
      halangan.dudukPerkara = "Judul sesudah DUDUK PERKARA tidak ditemukan, jadi akhirnya tidak dapat dipastikan.";
    }
  } else {
    halangan.dudukPerkara = 'Judul "DUDUK PERKARA" tidak ditemukan pada barisnya sendiri.';
  }

  // --------------------------------------------------------- pertimbangan
  if (letak.pertimbangan !== undefined) {
    const sampai = letak.amar ?? iPenutup;
    if (sampai !== undefined && sampai > letak.pertimbangan) {
      bagian.pertimbangan = potong(letak.pertimbangan + 1, sampai);
    } else {
      halangan.pertimbangan = 'Judul "MENGADILI" sesudah pertimbangan tidak ditemukan.';
    }
  } else {
    halangan.pertimbangan = 'Judul "PERTIMBANGAN HUKUM" tidak ditemukan pada barisnya sendiri.';
  }

  // ----------------------------------------------------------------- amar
  if (letak.amar !== undefined) {
    const sampai = iPenutup >= 0 ? iPenutup : baris.length;
    if (sampai > letak.amar) {
      bagian.amar = potong(letak.amar + 1, sampai);
    } else {
      halangan.amar = 'Kalimat "Demikian diputuskan" sesudah amar tidak ditemukan.';
    }
  } else {
    halangan.amar = 'Judul "MENGADILI" atau "MENETAPKAN" tidak ditemukan pada barisnya sendiri.';
  }

  // -------------------------------------------------------------- penutup
  if (iPenutup >= 0) {
    bagian.penutup = potong(iPenutup, baris.length);
  } else {
    halangan.penutup = 'Kalimat "Demikian diputuskan" tidak ditemukan.';
  }

  return { bagian, halangan, perabotDibuang };
}

/**
 * ============================================================================
 * NOMOR PERKARA DIBACA DARI ISI NASKAH, BUKAN DARI NAMA BERKASNYA
 * ============================================================================
 *
 * Nama berkas ditulis siapa saja dan mudah tertukar; isi naskah menyebut
 * nomornya sendiri di kepala dan di perabot tiap halaman. Diukur atas 197
 * naskah sungguhan (39 e-Doc PA Donggala + 158 naskah ABT 2026): nomor di
 * isi sama dengan nomor pada nama berkas pada 197 dari 197.
 *
 * Polanya DIBATASI "Pdt.". Pola umum meleset pada 1 dari 197: ia memilih
 * nomor akta cerai "453/AC/2025/PA.Dgl" yang kebetulan paling sering disebut.
 *
 * ============================================================================
 * NOMOR KEPALA LEBIH DULU, NOMOR TERBANYAK SEBAGAI CADANGAN
 * ============================================================================
 *
 * Diukur atas 987 RTF putusan bernama-nomor di folder unduhan (PA Donggala,
 * PA Bungku, dan satker lain):
 *
 *   nomor terbanyak, pola ketat          963 sama, 17 beda, 7 kosong
 *   nomor KEPALA dulu, pola longgar      977 sama,  5 beda, 5 kosong
 *
 * Nomor terbanyak saja keliru pada putusan seperti 153/Pdt.G/2018/PA.Buk -
 * kepalanya "Nomor 153/...", tetapi nomor perkara lain disebut tiga kali di
 * duduk perkara. Pola ketat tidak mengenal "PA Buk" (spasi, bukan titik) yang
 * dipakai templat lama (0002/Pdt.G/2016, 274/Pdt.P/2018). Kelima "kosong"
 * sisanya bukan putusan (pembetulan akta cerai, berkas kunci Word "~$").
 */
const POLA_NOMOR_ISI =
  /\b(\d{1,5}\s*\/\s*Pdt\.\s*[A-Za-z]{1,3}(?:\.[A-Za-z]{1,3})?\s*\/\s*\d{4}\s*\/\s*[A-Za-z]{2,4}[.\s]\s*[A-Za-z]{2,6})\b/gi;

/**
 * Bentuk baku untuk MEMBANDINGKAN nomor: tanpa spasi dan titik, tanpa nol di
 * depan, huruf kecil - "0002/Pdt.G/2016/PA Buk" sama dengan
 * "2/Pdt.G/2016/PA.Buk".
 */
export function bakuNomorPerkara(nomor: string): string {
  return String(nomor ?? "")
    .replace(/[\s.]+/g, "")
    .replace(/^0+(?=\d)/, "")
    .toLowerCase();
}

/** Dua nomor perkara menunjuk perkara yang sama. Nomor kosong tidak pernah sama. */
export function samaNomorPerkara(a: string, b: string): boolean {
  const x = bakuNomorPerkara(a);
  return x !== "" && x === bakuNomorPerkara(b);
}

export type NomorDariIsi = {
  /** Nomor kepala bila ada, bila tidak nomor terbanyak; kosong bila tidak ada sama sekali. */
  nomor: string;
  /** Berapa kali `nomor` disebut di seluruh naskah. */
  kali: number;
  /** Nomor pada baris "Nomor ..." di kepala naskah (dua belas baris pertama). */
  kepala: string;
  /** Nomor yang paling sering disebut; pada jumlah sama, yang lebih dulu disebut. */
  terbanyak: string;
  /** Paling banyak lima calon, terbanyak lebih dulu - untuk pesan kepada petugas. */
  calon: Array<{ nomor: string; kali: number }>;
};

/** Ejaan nomor dirapikan seperlunya: spasi berlebih dibuang, "PA Buk" tetap terbaca. */
function rapikanNomor(nomor: string): string {
  return nomor.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

export function nomorPerkaraDariIsi(naskah: string): NomorDariIsi {
  const teks = String(naskah ?? "");
  const hitung = new Map<string, { nomor: string; kali: number }>();
  for (const cocok of teks.matchAll(POLA_NOMOR_ISI)) {
    const kunci = bakuNomorPerkara(cocok[1]);
    const ada = hitung.get(kunci);
    if (ada) ada.kali += 1;
    else hitung.set(kunci, { nomor: rapikanNomor(cocok[1]), kali: 1 });
  }
  // sort stabil: pada jumlah yang sama, yang lebih dulu disebut menang.
  const calon = [...hitung.values()].sort((a, b) => b.kali - a.kali);
  const terbanyak = calon[0]?.nomor ?? "";

  // Kepala: baris "Nomor ..." di antara dua belas baris pertama yang berisi.
  let kepala = "";
  const awal = teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 12);
  for (const baris of awal) {
    if (!/^nomor\b/i.test(baris)) continue;
    const cocok = new RegExp(POLA_NOMOR_ISI.source, "i").exec(baris);
    if (cocok) {
      kepala = rapikanNomor(cocok[1]);
      break;
    }
  }

  const nomor = kepala || terbanyak;
  const kali = nomor ? (hitung.get(bakuNomorPerkara(nomor))?.kali ?? 0) : 0;
  return { nomor, kali, kepala, terbanyak, calon: calon.slice(0, 5) };
}

/**
 * Isi naskah menunjuk perkara `nomorTujuan`: nomor kepalanya ATAU nomor
 * terbanyaknya sama dengan nomor itu. Keduanya sekaligus berbeda berarti
 * naskahnya milik perkara lain - pada 987 putusan terukur, yang tertolak
 * begini semuanya berkas yang kepala dan isinya sama-sama menyebut perkara
 * lain.
 */
export function isiMenunjukPerkara(dariIsi: NomorDariIsi, nomorTujuan: string): boolean {
  return samaNomorPerkara(dariIsi.kepala, nomorTujuan) || samaNomorPerkara(dariIsi.terbanyak, nomorTujuan);
}

/**
 * ============================================================================
 * NASKAH YANG JELAS BUKAN PUTUSAN: BERITA ACARA, PENETAPAN HARI SIDANG, RELAAS
 * ============================================================================
 *
 * Di folder unduhan petugas, berkas bernomor perkara yang BUKAN putusan jauh
 * lebih banyak daripada putusannya: 1.092 BAS, 291 PHS/PMH/PPP/PJS, 128 relaas.
 * Semuanya RTF dan semuanya memuat nomor perkara yang benar, jadi pemeriksaan
 * nomor tidak menahannya.
 *
 * Pemotong naskah pun tidak menahannya. Penetapan Hari Sidang memuat
 * "MENETAPKAN", jadi amarnya terpotong ("Menetapkan hari sidang pertama...")
 * dan tersimpan sebagai draf putusan yang kelak diisikan ke borang SIPP.
 *
 * Pengenalnya dari JUDUL dan susunan naskah, diukur atas RTF sungguhan:
 *
 *   BERITA ACARA   judul "BERITA ACARA ..." pada tiga baris pertama
 *                  (1.057 dari 1.062 berkas bernama BAS)
 *   RELAAS         judul "RELAAS ..." pada sepuluh baris pertama - relaas
 *                  sering didahului kop surat
 *   PENETAPAN      berjudul "PENETAPAN" tetapi TANPA irah-irah, tanpa judul
 *   PENGELOLAAN    DUDUK PERKARA, tanpa judul PERTIMBANGAN HUKUM, dan
 *                  BERDIKTUM "MENETAPKAN". PHS tidak pernah memuat irah-irah
 *                  (0 dari 238), sedangkan putusan dan penetapan akhir wajib
 *                  memuatnya (Pasal 2 UU 48/2009). Yang menyebut "hari
 *                  sidang" disebut Penetapan Hari Sidang; selebihnya
 *                  penetapan majelis/penunjukan.
 *
 * Yang tidak dikenali dipulangkan null - pengenal ini hanya MENAHAN yang
 * pasti bukan putusan, dan tidak pernah menebak jenis naskah yang lain.
 */
export type NaskahBukanPutusan = {
  jenis: "berita-acara" | "relaas" | "penetapan-hari-sidang" | "penetapan-pengelolaan";
  /** Nama jenisnya untuk kalimat kepada petugas. */
  nama: string;
  /** Baris judul sebagaimana tertulis di naskah. */
  judul: string;
};

const RAPAT_JUDUL_PENETAPAN = new Set(["PENETAPAN", "SALINANPENETAPAN"]);

export function kenaliNaskahBukanPutusan(naskah: string): NaskahBukanPutusan | null {
  const baris = String(naskah ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b && !perabot(b));
  const kepala = baris.slice(0, 10);

  const iBeritaAcara = kepala.slice(0, 3).findIndex((b) => rapat(b).startsWith("BERITAACARA"));
  if (iBeritaAcara >= 0) {
    return { jenis: "berita-acara", nama: "Berita Acara", judul: kepala[iBeritaAcara] };
  }

  const iRelaas = kepala.findIndex((b) => rapat(b).startsWith("RELAAS"));
  if (iRelaas >= 0) return { jenis: "relaas", nama: "Relaas", judul: kepala[iRelaas] };

  const judulPenetapan = kepala
    .slice(0, 3)
    .find((b) => RAPAT_JUDUL_PENETAPAN.has(rapat(b)) || rapat(b).startsWith("PENETAPANHARISIDANG"));
  if (!judulPenetapan) return null;

  const adaIrah = baris.some((b) => rapat(b).startsWith("DEMIKEADILAN"));
  const rapatJangkar = new Set(
    JANGKAR.filter((j) => j.kunci === "dudukPerkara" || j.kunci === "pertimbangan").flatMap((j) => j.rapat)
  );
  const adaJangkarPutusan = baris.some((b) => rapatJangkar.has(rapat(b)));
  if (adaIrah || adaJangkarPutusan) return null;

  // Penetapan pengelolaan perkara selalu berdiktum "MENETAPKAN" - menetapkan
  // hari sidang, atau menunjuk majelis, panitera, dan jurusita. Penetapan
  // tanpa diktum itu tidak dapat dipastikan jenisnya, jadi TIDAK ditahan.
  // Diukur: satu-satunya berkas bernama putusan yang dahulu tertahan sebagai
  // PHS (0149/Pdt.G/2018/PA.Kng) adalah catatan pencabutan "sebelum hari
  // sidang ditetapkan" - tanpa diktum, dan bukan PHS.
  const adaDiktum = baris.some((b) => rapat(b).startsWith("MENETAPKAN"));
  if (!adaDiktum) return null;

  const hariSidang = rapat(judulPenetapan).startsWith("PENETAPANHARISIDANG") || /hari\s+sidang/i.test(baris.join(" "));
  return hariSidang
    ? { jenis: "penetapan-hari-sidang", nama: "Penetapan Hari Sidang", judul: judulPenetapan }
    : {
        jenis: "penetapan-pengelolaan",
        nama: "penetapan pengelolaan perkara (penunjukan majelis, panitera, atau jurusita)",
        judul: judulPenetapan,
      };
}
