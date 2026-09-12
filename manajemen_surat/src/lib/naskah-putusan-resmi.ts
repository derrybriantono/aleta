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

function rapat(baris: string): string {
  return baris.replace(/[\s.]+/g, "").toUpperCase();
}

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
  const iPenutup = baris.findIndex((satu) => /^demikian\s+(diputuskan|ditetapkan|dibacakan)/i.test(satu));

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
