/**
 * ============================================================================
 * PUTUSAN ADVANCE (F4.4, 17 Okt 2026) - pemeriksa draf putusan tingkat lanjut
 * ============================================================================
 *
 * Makna (permintaan pengguna, butir 4 "ALETA Putusan Advance (Generator
 * Putusan Mandiri)"): pembuatan putusan internal ALETA yang lebih lanjut untuk
 * mengurangi ketergantungan pada ABT, berlandaskan kumpulan pertimbangan hukum
 * dan susunan duduk perkara yang sudah ada di sistem. Versi pertama ini
 * MEMBANTU HAKIM MENYUSUN, tidak menyusun sendiri:
 *
 *   1. alasan & unsur   huruf alasan cerai (PP 9/1975 Pasal 19 = KHI Pasal 116)
 *                       yang didalilkan (#8503# Blangko Derry) diadu dengan
 *                       yang dipertimbangkan; tiap UNSUR huruf itu diperiksa
 *                       ada/tidaknya di pertimbangan dan di keterangan saksi;
 *   2. dasar hukum      kutipan dibaca (pemecah-pertimbangan), huruf Pasal 19
 *                       PP 9/1975 harus sama dengan huruf Pasal 116 KHI, tahun
 *                       peraturan yang dikenal harus cocok dengan nomornya;
 *   3. konsistensi      kesimpulan pertimbangan vs amar, jenis talak vs jenis
 *                       perkara, verstek, pembebanan biaya, tuntutan tambahan
 *                       (nafkah iddah, mut'ah, hadhanah) yang diamarkan tetapi
 *                       tidak dipertimbangkan;
 *   4. putusan serupa   putusan hakim yang sama yang SUDAH BERKEKUATAN HUKUM
 *                       TETAP (jenis sama, huruf mirip): kutipan yang lazim
 *                       dipakai hakim itu tetapi tidak ada di draf, dan contoh
 *                       alinea per unsur yang belum dibahas (nama disamarkan).
 *
 * Tiap temuan diberi langkah checklist Konseptor (F1.6) tempat ia diperbaiki.
 *
 * TIDAK ADA TINGKAT "hentikan". Ini alat bantu hukum - kelas C menurut
 * keputusan Agen ALETA 4 Okt: tidak menahan cetak, tidak menulis ke ABT/SIPP,
 * tidak memanggil AI. Yang memutus tetap majelis.
 *
 * ============================================================================
 * UKURAN (baca saja, sipp_donggala setempat, 2.305 putusan berpertimbangan,
 * 2.257 BHT; skrip ukur di laporan F4.4)
 * ============================================================================
 *
 *   - Cerai 1.637: huruf dikutip F 1.048, BF 132, B 108, AF 41, C 8;
 *     270 tanpa kutipan huruf. Huruf Pasal 19 ≠ Pasal 116 pada 10 putusan.
 *   - Tiap putusan BHT diperlakukan sebagai draf (pembanding = putusan BHT
 *     hakim ketua yang sama, diputus sebelumnya): 89 dari 1.333 putusan yang
 *     pertimbangannya lengkap di SIPP mendapat >= 1 perhatian; temuan nyata
 *     antara lain amar cerai talak "Menjatuhkan talak ba'in ... Termohon
 *     terhadap Pemohon" (117/Pdt.G/2025), cerai gugat "memberi izin kepada
 *     Penggugat ... talak raj'i" (390/Pdt.G/2025), "UU Nomor 50 Tahun 2019"
 *     (208/Pdt.G/2025), biaya "dibebankan kepada Pemohon" pada cerai gugat.
 *     Pertimbangan SIPP sering tersalin sebagian (924 putusan "pendek") -
 *     angka itu batas atas salah tangkap, bukan mutu draf Blangko Derry.
 *   - Tingkat unsur DIUKUR per hakim saat dipakai: unsur yang dibahas di
 *     >= 80% dari >= 5 putusan serupa hakim itu tetapi tidak di draf =
 *     perhatian; tanpa pembanding cukup, perhatian hanya untuk unsur yang
 *     dibahas di >= 95% putusan BHT (`lazimBawaan`); < 50% tidak ditandai.
 *   - 544 contoh alinea ditawarkan, 0 memuat nama pihak/saksi perkara asal.
 *
 * ============================================================================
 * 17 OKT - JENIS LAIN & HAK (keputusan pengguna butir 55-57)
 * ============================================================================
 *
 * Tetap PEMERIKSA. Jenis selain cerai diperiksa per unsur set saksi F3.3
 * (KATALOG_JENIS) bila amar MENGABULKAN. Salah tangkap (perhatian atas
 * putusan BHT dikabulkan berpertimbangan utuh, sipp_donggala): itsbat 0/291,
 * dispensasi 0/16, PAW 0/14 (4 catatan), perwalian 0/15 (1 catatan); jenis
 * dengan < 5 putusan (HB, kewarisan, izin poligami, wali adhal, asal usul
 * anak, pengangkatan anak, hak asuh, pembatalan, ekonomi syariah) hanya
 * catatan "unsur yang diminta peraturan". Pertimbangan SIPP yang tersalin
 * sebagian (itsbat 179) memang memicu perhatian (110) - batas atas, bukan
 * mutu draf Blangko Derry yang utuh. Hak: hakPutusanAdvance (hakim DAN
 * konseptor perkara itu + Super Admin/Admin).
 *
 * Murni: tidak membaca basis data. Data dari rute
 * /api/aleta-ecourt/putusan/advance (naskah Blangko Derry + SIPP lewat bot).
 */
import { bacaKeadaan } from "@/lib/amar-petitum";
import { teksDariHtml } from "@/lib/alasan-perkara-sipp";
import type { KodeLangkah } from "@/lib/konseptor-langkah";
import { bandingkanKonseptor } from "@/lib/konseptor-sementara";
import { hurufAlasan, kodeJenisSaksi, type KodeJenisSaksi } from "@/lib/set-pertanyaan-saksi";
import { kenaliRujukan, slugDariSebutan } from "@/server/modules/aleta-ecourt/pemecah-pertimbangan";

// ----------------------------------------------------------------------------
// Jenis
// ----------------------------------------------------------------------------
export type TingkatAdvance = "perhatian" | "catatan";

export type TemuanAdvance = {
  kode: string;
  tingkat: TingkatAdvance;
  /** Langkah checklist Konseptor (F1.6) tempat temuan ini diperbaiki. */
  langkah: KodeLangkah;
  judul: string;
  rinci: string;
  /** Potongan naskah pendukung (sudah dari naskah draf sendiri). */
  bukti?: string[];
};

export type UnsurAlasan = {
  kode: string;
  nama: string;
  /** Pola longgar: unsur dianggap DIBAHAS bila salah satu cocok. */
  pola: RegExp[];
  dasar?: string;
  /** Persen putusan BHT PA Donggala yang membahasnya (huruf ini), diukur 17 Okt. */
  lazimBawaan: number;
};

export type AlasanCerai = {
  huruf: string;
  judul: string;
  dasar: string[];
  unsur: UnsurAlasan[];
};

export type PutusanSerupaMasuk = {
  nomor: string;
  tanggalPutusan?: string;
  tanggalBht?: string;
  /** HTML/teks pertimbangan hukum SIPP. */
  pertimbangan: string;
  /** HTML/teks amar SIPP. */
  amar: string;
  /** Nama pihak/saksi perkara itu - hanya untuk disamarkan, tidak pernah dikeluarkan. */
  nama?: string[];
};

export type ContohAlinea = { sumber: "pustaka" | "putusan"; label: string; teks: string };

export type ButirPustakaMasuk = { id: string; teks: string; labelAlasan?: string[]; jumlahPemakaian?: number };

export type HasilUnsur = {
  kode: string;
  nama: string;
  dasar: string;
  dipertimbangkan: boolean;
  /** null = keterangan saksi tidak terkirim/terbaca. */
  saksi: boolean | null;
  /** Berapa putusan serupa hakim ini yang membahasnya. */
  lazim: { ada: number; dari: number } | null;
  contoh: ContohAlinea[];
};

export type HasilAlasan = { huruf: string; judul: string; dasar: string[]; didalilkan: boolean; dipertimbangkan: boolean; unsur: HasilUnsur[] };

export type KutipanDraf = { kunci: string; sebutan: string; jumlah: number };

export type SerupaRingkas = {
  nomor: string;
  tanggalPutusan: string;
  tanggalBht: string;
  huruf: string;
  verstek: boolean;
  keadaan: string;
  skor: number;
  sama: string[];
  beda: string[];
};

export type MasukanAdvance = {
  nomorPerkara: string;
  jenisPerkara: string;
  sebutanP?: string;
  /** Isian #8503# Blangko Derry ("BF", "F·..."). */
  hurufIsian?: string;
  dudukPerkara: string;
  pertimbangan: string;
  amar: string;
  /** Jawaban saksi dari tanya jawab Blangko Derry; undefined = tidak terkirim. */
  keteranganSaksi?: string[];
  serupa?: PutusanSerupaMasuk[];
  pustaka?: ButirPustakaMasuk[];
  /** Bagian naskah yang tidak ditemukan pemecah (judul bagian tidak ada). */
  bagianHilang?: string[];
};

export type RaporAdvance = {
  nomorPerkara: string;
  jenis: KodeJenisSaksi;
  /** Kode pemeriksaan unsur (17 Okt: termasuk pembatalan perkawinan & ekonomi syariah). */
  jenisPeriksa: KodeJenisAdvance;
  huruf: { didalilkan: string; dikutip: string; pp19: string; khi116: string };
  alasan: HasilAlasan[];
  kutipan: KutipanDraf[];
  temuan: TemuanAdvance[];
  perLangkah: Partial<Record<KodeLangkah, { perhatian: number; catatan: number }>>;
  serupa: SerupaRingkas[];
  jumlahSerupa: number;
  tidakDiperiksa: string[];
  ringkas: string;
};

// ----------------------------------------------------------------------------
// Hak (keputusan pengguna 17 Okt butir 57): hakim DAN konseptor + Super Admin/Admin
// ----------------------------------------------------------------------------
/** Peran yang menjadi hakim: hakim, dan Ketua/Wakil Ketua yang juga mengadili. */
export const PERAN_HAKIM_ADVANCE = ["hakim", "ketua", "wakil-ketua"] as const;

export type OrangKonseptor = { nama?: string; pengguna?: string };

export type MasukanHakAdvance = {
  /** Super Admin / Admin (peran berlaku). */
  admin: boolean;
  /** Peran berlaku + peran tertulis + peran tambahan akun. */
  peran: string[];
  /** Nama akun ALETA (dan nama akun SIPP yang tertaut). */
  nama: string[];
  /** Username SIPP milik akun ini. */
  usernames: string[];
  /** Konseptor sementara ALETA (F1.6) perkara ini, bila ada. */
  konseptorSementara?: OrangKonseptor | null;
  /** Konseptor tercatat SIPP (jejak tahapan putusan) perkara ini. */
  konseptorSipp?: OrangKonseptor[];
};

export type HakAdvance = { boleh: boolean; sebagai: "admin" | "hakim" | "konseptor" | ""; sebab: string };

function konseptorIni(k: OrangKonseptor | null | undefined, m: MasukanHakAdvance): boolean {
  if (!k) return false;
  const pengguna = String(k.pengguna ?? "").trim().toLowerCase();
  if (pengguna && m.usernames.some((u) => u.trim().toLowerCase() === pengguna)) return true;
  if (!String(k.nama ?? "").trim()) return false;
  return m.nama.some((n) => {
    if (!String(n ?? "").trim()) return false;
    const b = bandingkanKonseptor({ nama: k.nama }, [{ nama: n }]);
    return b.adaTunjukan && b.adaSipp && !b.berbeda;
  });
}

/**
 * Putusan Advance boleh dibuka: Super Admin/Admin, hakim (peran), atau
 * konseptor perkara INI - konseptor sementara yang ditunjuk di ALETA (F1.6)
 * atau konseptor yang tercatat SIPP. Pencocokan konseptor sama dengan
 * checklist (username SIPP dulu, lalu nama yang dibakukan).
 */
export function hakPutusanAdvance(m: MasukanHakAdvance): HakAdvance {
  if (m.admin) return { boleh: true, sebagai: "admin", sebab: "" };
  if (m.peran.some((p) => (PERAN_HAKIM_ADVANCE as readonly string[]).includes(String(p)))) return { boleh: true, sebagai: "hakim", sebab: "" };
  if (konseptorIni(m.konseptorSementara, m) || (m.konseptorSipp ?? []).some((k) => konseptorIni(k, m))) return { boleh: true, sebagai: "konseptor", sebab: "" };
  return {
    boleh: false,
    sebagai: "",
    sebab: "Putusan Advance hanya untuk hakim, konseptor perkara ini (ditunjuk di ALETA atau tercatat di SIPP), dan Admin.",
  };
}

// ----------------------------------------------------------------------------
// Teks
// ----------------------------------------------------------------------------
/** Teks polos satu baris per alinea; HTML SIPP dan teks RTF sama-sama diterima. */
export function teksPolos(isi: string): string {
  const s = String(isi ?? "");
  const t = /<\s*[a-z][^>]*>/i.test(s) ? teksDariHtml(s) : s;
  return t
    .replace(/[\u2018\u2019\u02bc\u02bb`´]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export function alineaDari(isi: string): string[] {
  return teksPolos(isi)
    .split(/\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

const datar = (isi: string) => teksPolos(isi).replace(/\s+/g, " ");

function potong(teks: string, pola: RegExp, lebar = 110): string {
  const t = teks.replace(/\s+/g, " ");
  const m = new RegExp(pola.source, pola.flags.replace("g", "")).exec(t);
  if (!m) return "";
  const awal = Math.max(0, m.index - lebar);
  const akhir = Math.min(t.length, m.index + m[0].length + lebar);
  return `${awal > 0 ? "…" : ""}${t.slice(awal, akhir).trim()}${akhir < t.length ? "…" : ""}`;
}

// ----------------------------------------------------------------------------
// Katalog alasan cerai dan unsurnya
// ----------------------------------------------------------------------------
const PP19 = (h: string) => `PP 9/1975 Pasal 19 huruf ${h.toLowerCase()} jo. KHI Pasal 116 huruf ${h.toLowerCase()}`;
const U = (kode: string, nama: string, pola: RegExp[], lazimBawaan: number, dasar = ""): UnsurAlasan => ({ kode, nama, pola, dasar, lazimBawaan });

/** Unsur bersama semua perkara cerai. */
export const UNSUR_UPAYA_DAMAI = U(
  "damai",
  "upaya damai tidak berhasil (dinasihati di setiap sidang / mediasi)",
  [/mendamaikan|merukunkan|dirukunkan|menasi?h?e?h?ati|menasihati|menasehati|mediasi|upaya\s+damai|perdamaian/i],
  97,
  "UU 7/1989 Pasal 82 ayat (1) dan (4) jo. UU 1/1974 Pasal 39 ayat (1); PERMA 1/2016 bila kedua pihak hadir"
);

export const KATALOG_ALASAN: Record<string, AlasanCerai> = {
  A: {
    huruf: "A",
    judul: "zina, pemabuk, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan",
    dasar: [PP19("A")],
    unsur: [
      U("a-perbuatan", "perbuatan huruf a (zina/mabuk/madat/judi/narkoba)", [/pemabuk|mabuk|minuman\s+keras|penjudi|judi|pemadat|madat|narkoba|narkotika|zina|selingkuh|perempuan\s+lain|wanita\s+lain|laki-laki\s+lain|pria\s+lain/i], 97),
      U("a-sukar", "kebiasaan, sukar disembuhkan", [/sukar\s+disembuhkan|sulit\s+disembuhkan|tetap\s+(?:saja\s+)?mengulangi|terus\s+(?:saja\s+)?mengulangi|tidak\s+(?:juga\s+)?berubah|kebiasaan/i], 97),
    ],
  },
  B: {
    huruf: "B",
    judul: "meninggalkan pihak lain dua tahun berturut-turut tanpa izin dan tanpa alasan yang sah",
    dasar: [PP19("B"), "KHI Pasal 133 ayat (1) dan (2)"],
    unsur: [
      U("b-dua-tahun", "dua tahun berturut-turut", [/(?:2|dua)\s*(?:\(\s*dua\s*\)\s*)?tahun(?:\s+lebih)?(?:\s+berturut)?|lebih\s+dari\s+(?:2|dua)\s*(?:\(\s*dua\s*\)\s*)?tahun|berturut-turut/i], 89),
      U("b-tanpa-izin", "tanpa izin pihak lain", [/tanpa\s+(?:seizin|izin|ijin|sepengetahuan|pamit)/i], 88),
      U("b-tanpa-alasan", "tanpa alasan yang sah / bukan di luar kemampuannya", [/tanpa\s+alasan\s+(?:yang\s+)?(?:sah|jelas)|di\s+luar\s+kemampuan|tidak\s+ada\s+alasan/i], 48),
      U("b-tidak-kembali", "tidak kembali / tidak diketahui keberadaannya", [/tidak\s+(?:pernah\s+)?(?:lagi\s+)?(?:kembali|pulang)|tidak\s+diketahui\s+(?:lagi\s+)?(?:alamat|keberadaan|tempat|rimba)|tidak\s+mau\s+(?:lagi\s+)?kembali|tanpa\s+kabar|tidak\s+ada\s+kabar/i], 10),
    ],
  },
  C: {
    huruf: "C",
    judul: "hukuman penjara lima tahun atau lebih setelah perkawinan",
    dasar: [PP19("C"), "KHI Pasal 135"],
    unsur: [
      U("c-penjara", "hukuman penjara (putusan pidana)", [/penjara|pidana|lembaga\s+pemasyarakatan|narapidana/i], 90),
      U("c-lima-tahun", "lima tahun atau lebih", [/(?:5|lima)\s*(?:\(\s*lima\s*\)\s*)?tahun|lebih\s+berat/i], 80),
      U("c-sesudah-nikah", "setelah perkawinan berlangsung", [/setelah\s+(?:perkawinan|menikah|pernikahan)|sesudah\s+(?:perkawinan|menikah)|selama\s+(?:perkawinan|pernikahan)/i], 60),
    ],
  },
  D: {
    huruf: "D",
    judul: "kekejaman atau penganiayaan berat yang membahayakan",
    dasar: [PP19("D"), "UU 23/2004 (KDRT) bila relevan"],
    unsur: [
      U("d-kekerasan", "kekejaman / penganiayaan / kekerasan fisik", [/kekejaman|penganiayaan|menganiaya|kekerasan|memukul|dipukul|menampar|ditampar|KDRT/i], 90),
      U("d-bahaya", "membahayakan pihak lain", [/membahayakan|luka|bahaya|visum|keselamatan/i], 80),
    ],
  },
  E: {
    huruf: "E",
    judul: "cacat badan atau penyakit sehingga tidak dapat menjalankan kewajiban",
    dasar: [PP19("E")],
    unsur: [
      U("e-cacat", "cacat badan atau penyakit", [/cacat|penyakit|sakit|impoten|gangguan\s+jiwa/i], 90),
      U("e-kewajiban", "akibatnya tidak dapat menjalankan kewajiban suami/isteri", [/tidak\s+dapat\s+(?:lagi\s+)?(?:menjalankan|melaksanakan|memenuhi)\s+(?:kewajiban|nafkah)/i], 50),
    ],
  },
  F: {
    huruf: "F",
    judul: "perselisihan dan pertengkaran terus-menerus, tidak ada harapan rukun lagi",
    dasar: [PP19("F"), "UU 1/1974 Pasal 39 ayat (2)", "SEMA 1/2022 jo. SEMA 3/2023 (pisah tempat tinggal)"],
    unsur: [
      U("f-selisih", "perselisihan dan pertengkaran terus-menerus", [/perselisihan|pertengkaran|percekcokan|bertengkar|cekcok/i], 99),
      U("f-rukun", "tidak ada harapan hidup rukun lagi", [/tidak\s+(?:ada\s+)?(?:lagi\s+)?harapan|tidak\s+(?:dapat\s+|bisa\s+|akan\s+)?(?:lagi\s+)?(?:hidup\s+)?rukun|tidak\s+rukun|tidak\s+harmonis|ketidakharmonisan|ketidak\s+harmonisan|sulit\s+(?:untuk\s+)?(?:dirukunkan|disatukan|rukun)|tidak\s+mungkin\s+(?:lagi\s+)?(?:dirukunkan|disatukan|rukun)|pecah|broken\s+marriage|tujuan\s+perkawinan/i], 100),
      U("f-pisah", "telah berpisah tempat tinggal (SEMA 1/2022 jo. 3/2023)", [/pisah\s+(?:tempat\s+tinggal|rumah|ranjang)|berpisah|tidak\s+(?:lagi\s+)?(?:tinggal|hidup)\s+(?:bersama|serumah|satu\s+rumah)|meninggalkan\s+(?:tempat\s+(?:tinggal|kediaman)|rumah)/i], 99),
      U("f-keluarga", "keterangan keluarga / orang dekat didengar", [/keluarga|orang[\s-]+(?:orang\s+)?(?:yang\s+)?dekat|Pasal\s+76|Pasal\s+22\s+ayat/i], 91, "UU 7/1989 Pasal 76 ayat (1); PP 9/1975 Pasal 22 ayat (2)"),
    ],
  },
  G: {
    huruf: "G",
    judul: "suami melanggar taklik talak",
    dasar: ["KHI Pasal 116 huruf g"],
    unsur: [
      U("g-taklik", "taklik talak diucapkan saat akad", [/taklik|ta'lik|shighat|sighat/i], 80),
      U("g-langgar", "pelanggaran butir taklik (tidak memberi nafkah 3 bulan / meninggalkan 2 tahun / menyakiti / membiarkan 6 bulan)", [/melanggar|pelanggaran|(?:3|tiga)\s*(?:\(\s*tiga\s*\)\s*)?bulan|(?:6|enam)\s*(?:\(\s*enam\s*\)\s*)?bulan/i], 80),
      U("g-iwadh", "uang iwadh dibayar", [/iwadh|iwad|'iwadl/i], 60),
    ],
  },
  H: {
    huruf: "H",
    judul: "peralihan agama atau murtad yang menyebabkan ketidakrukunan",
    dasar: ["KHI Pasal 116 huruf h"],
    unsur: [
      U("h-murtad", "peralihan agama / murtad", [/murtad|peralihan\s+agama|pindah\s+agama|beralih\s+agama|keluar\s+dari\s+(?:agama\s+)?Islam/i], 90),
      U("h-tidak-rukun", "menyebabkan ketidakrukunan", [/tidak\s+rukun|ketidakrukunan|ketidak\s+rukunan|perselisihan|pertengkaran/i], 80),
    ],
  },
};

// ----------------------------------------------------------------------------
// Unsur jenis selain cerai (17 Okt, keputusan butir 56) - dari set saksi F3.3
// ----------------------------------------------------------------------------
/**
 * Kode pemeriksaan: kode set saksi (lib/set-pertanyaan-saksi.ts), ditambah
 * pembatalan perkawinan dan ekonomi syariah yang di set saksi masih "umum".
 */
export type KodeJenisAdvance = KodeJenisSaksi | "pembatalan" | "es";

export function kodeJenisAdvance(namaJenis: string, nomor = "", sebutanP = ""): KodeJenisAdvance {
  const k = kodeJenisSaksi(namaJenis, nomor, "", sebutanP);
  if (k !== "umum") return k;
  const j = String(namaJenis || "").toLowerCase();
  if (/pembatalan\s+(?:perkawinan|nikah)/.test(j)) return "pembatalan";
  if (/ekonomi\s+syar/.test(j)) return "es";
  return k;
}

export type KatalogJenis = {
  judul: string;
  dasar: string[];
  unsur: UnsurAlasan[];
  /**
   * Jumlah putusan BHT dikabulkan berpertimbangan lengkap yang dipakai
   * mengukur lazimBawaan (sipp_donggala setempat, 17 Okt). Di bawah
   * SAMPEL_PERHATIAN, unsur yang belum tampak paling jauh "catatan".
   */
  sampel: number;
};

/** Pola bersama: larangan kawin (UU 1/1974 Pasal 8; KHI Pasal 39-44). */
const POLA_LARANGAN = /larangan\s+(?:perkawinan|kawin|nikah|menikah)|halangan|menghalangi|hubungan\s+(?:darah|nasab|semenda|sesusuan|mahram|keluarga)|sesusuan|sepersusuan|Pasal\s+8\s+Undang|Pasal\s+(?:39|40|44)\b/i;
/** Pertimbangan yang menyimpulkan rukun nikah (KHI Pasal 14: calon, wali, dua saksi, ijab kabul) tanpa merinci. */
const POLA_RUKUN = /Pasal\s+14\b|rukun\s+(?:dan\s+syarat\s+)?(?:nikah|perkawinan)|syarat\s+dan\s+rukun|rukun-rukun/i;

export const SAMPEL_PERHATIAN = 20;
/** Di bawah ini lazimBawaan tidak dipakai; unsur dianggap lazim LAZIM_BELUM_TERUKUR persen (catatan). */
export const SAMPEL_TERUKUR = 5;
export const LAZIM_BELUM_TERUKUR = 80;

/**
 * Unsur per jenis = unsur set pertanyaan saksi (F3.3) yang diuji di
 * pertimbangan. lazimBawaan = persen putusan BHT DIKABULKAN berpertimbangan
 * lengkap (>= 1.500 huruf) yang membahasnya, diukur 17 Okt atas sipp_donggala.
 */
export const KATALOG_JENIS: Partial<Record<KodeJenisAdvance, KatalogJenis>> = {
  itsbat: {
    judul: "itsbat nikah - rukun dan syarat perkawinan",
    dasar: ["KHI Pasal 7 ayat (2)-(4), 14, 19-30, 39-44", "SEMA 3/2018 (itsbat poligami atas dasar nikah siri tidak dapat diterima)"],
    sampel: 291,
    unsur: [
      U("i-wali", "wali nikah (KHI Pasal 19-23)", [/\bwali\b/i, POLA_RUKUN], 99),
      U("i-saksi", "dua orang saksi nikah (KHI Pasal 24-26)", [/saksi\s+nikah|dua\s+orang\s+saksi|(?:2|dua)\s*(?:\(\s*dua\s*\)\s*)?orang\s+saksi|disaksikan\s+oleh|saksi-saksi\s+(?:nikah|perkawinan)/i, POLA_RUKUN], 99),
      U("i-ijab", "ijab dan kabul (KHI Pasal 27-29)", [/ijab|qabul|kabul|kobul/i, POLA_RUKUN], 99),
      U("i-mahar", "mahar (KHI Pasal 30)", [/mahar|mas\s*kawin|maskawin|Pasal\s+30\b/i, POLA_RUKUN], 99),
      U("i-larangan", "tidak ada larangan kawin (KHI Pasal 39-44)", [POLA_LARANGAN, /tidak\s+(?:ada|terdapat)\s+(?:hal\s+yang\s+)?(?:menghalangi|halangan)/i], 99),
      U("i-status", "tidak terikat perkawinan lain - bukan poligami tanpa izin (SEMA 3/2018)", [/terikat\s+(?:dalam\s+)?perkawinan|jejaka|perjaka|perawan|gadis|duda|janda|poligami|beristeri\s+lain|isteri\s+lain|istri\s+lain/i, POLA_LARANGAN], 99),
      U("i-kepentingan", "kepentingan itsbat (KHI Pasal 7 ayat (3))", [/Pasal\s+7\s+ayat\s*\(?\s*3|keperluan|kepentingan|pengurusan|mengurus|akta\s+(?:nikah|kelahiran)|buku\s+nikah|kartu\s+keluarga/i], 99),
    ],
  },
  dk: {
    judul: "dispensasi kawin - alasan sangat mendesak dan kepentingan terbaik anak",
    dasar: ["UU 1/1974 jo. UU 16/2019 Pasal 7", "PERMA 5/2019 Pasal 14-17"],
    sampel: 16,
    unsur: [
      U("dk-umur", "anak belum berumur 19 tahun", [/19\s*\(?\s*(?:sembilan\s+belas)?\s*\)?\s*tahun|belum\s+(?:mencapai|cukup)\s+(?:umur|usia)|di\s+bawah\s+umur|batas\s+(?:minimal\s+)?usia/i], 99),
      U("dk-mendesak", "alasan sangat mendesak", [/mendesak|dikhawatirkan|kekhawatiran|khawatir|hamil|kehamilan/i], 99),
      U("dk-anak", "pendapat/persetujuan anak, tanpa paksaan (PERMA 5/2019 Pasal 14)", [/paksaan|dipaksa|kemauan\s+sendiri|keinginan\s+sendiri|kehendak\s+sendiri|sukarela|bersedia\s+(?:untuk\s+)?(?:menikah|dinikahkan)|siap\s+(?:untuk\s+)?(?:menikah|berumah\s+tangga)|mau\s+menikah|PERMA\s+(?:Nomor\s+)?5|Peraturan\s+Mahkamah\s+Agung\s+(?:RI\s+)?Nomor\s+5/i], 99),
      U("dk-terbaik", "kepentingan terbaik anak", [/kepentingan\s+terbaik|perlindungan\s+anak|hak[-\s]hak\s+anak|hak\s+anak/i], 37),
      U("dk-larangan", "tidak ada larangan kawin", [POLA_LARANGAN, /tidak\s+(?:ada|terdapat)\s+(?:hal\s+yang\s+)?(?:menghalangi|halangan)/i], 99),
    ],
  },
  hb: {
    judul: "harta bersama",
    dasar: ["UU 1/1974 Pasal 35-37", "KHI Pasal 85-97"],
    sampel: 1,
    unsur: [
      U("hb-perolehan", "diperoleh selama perkawinan (UU 1/1974 Pasal 35 ayat (1))", [/selama\s+(?:dalam\s+)?(?:masa\s+)?(?:perkawinan|pernikahan|ikatan\s+perkawinan)|dalam\s+(?:masa\s+)?perkawinan|Pasal\s+35/i], 0),
      U("hb-bagian", "bagian masing-masing seperdua (KHI Pasal 97)", [/seperdua|setengah|½|1\/2|Pasal\s+97/i], 0),
      U("hb-objek", "identitas objek (letak/batas/luas)", [/batas|berbatasan|terletak|luas/i], 0),
    ],
  },
  waris: {
    judul: "kewarisan",
    dasar: ["KHI Pasal 171-193"],
    sampel: 1,
    unsur: [
      U("w-pewaris", "kematian pewaris", [/meninggal\s+dunia|wafat|pewaris/i], 0),
      U("w-islam", "pewaris dan ahli waris beragama Islam (KHI Pasal 171-172)", [/beragama\s+Islam|agama\s+Islam/i], 0),
      U("w-ahli", "ahli waris dan bagiannya", [/ahli\s+waris/i], 0),
      U("w-harta", "harta peninggalan", [/harta\s+(?:peninggalan|warisan)|tirkah|tirkah|boedel|objek\s+(?:sengketa|warisan)/i], 0),
    ],
  },
  paw: {
    judul: "penetapan ahli waris",
    dasar: ["KHI Pasal 171-174, 185, 209"],
    sampel: 14,
    unsur: [
      U("paw-pewaris", "kematian pewaris", [/meninggal\s+dunia|wafat/i], 99),
      U("paw-islam", "pewaris dan ahli waris beragama Islam (KHI Pasal 171-172)", [/beragama\s+Islam|agama\s+Islam/i], 71),
      U("paw-hubungan", "hubungan darah/perkawinan (KHI Pasal 174)", [/hubungan\s+(?:darah|perkawinan|nasab|kekerabatan)|Pasal\s+174|anak\s+kandung|isteri|istri|suami/i], 99),
      U("paw-halangan", "tidak terhalang mewarisi (KHI Pasal 173)", [/Pasal\s+173|terhalang|halangan|membunuh|menganiaya/i], 99),
    ],
  },
  ip: {
    judul: "izin poligami",
    dasar: ["UU 1/1974 Pasal 3 ayat (2), 4 ayat (2), 5 ayat (1)", "KHI Pasal 55-59, 94", "Buku II (harta bersama isteri terdahulu)"],
    sampel: 0,
    unsur: [
      U("ip-alasan", "alasan alternatif (UU 1/1974 Pasal 4 ayat (2))", [/Pasal\s+4\s+ayat\s*\(?\s*2|tidak\s+dapat\s+(?:menjalankan|melahirkan|melayani)|cacat|penyakit|keturunan/i], 0),
      U("ip-setuju", "persetujuan isteri (Pasal 5 ayat (1) huruf a)", [/persetujuan|menyetujui|setuju|tidak\s+keberatan|bersedia\s+dimadu|rela\s+dimadu/i], 0),
      U("ip-mampu", "kemampuan menjamin keperluan hidup (huruf b)", [/mampu|kemampuan|penghasilan/i], 0),
      U("ip-adil", "jaminan berlaku adil (huruf c)", [/\badil\b/i], 0),
      U("ip-hb", "harta bersama dengan isteri terdahulu (KHI Pasal 94; Buku II)", [/harta\s+bersama/i], 0),
    ],
  },
  perwalian: {
    judul: "perwalian anak",
    dasar: ["UU 1/1974 Pasal 50-54", "KHI Pasal 107-112"],
    sampel: 15,
    unsur: [
      U("pw-umur", "anak belum 18 tahun / belum pernah kawin (UU 1/1974 Pasal 50)", [/18\s*\(?\s*(?:delapan\s+belas)?\s*\)?\s*tahun|belum\s+dewasa|di\s+bawah\s+umur|belum\s+(?:pernah\s+)?(?:menikah|kawin|melangsungkan\s+perkawinan)|belum\s+cakap/i], 99),
      U("pw-ortu", "anak tidak di bawah kekuasaan orang tua", [/meninggal\s+dunia|wafat|kekuasaan\s+orang\s+tua|dicabut/i], 93),
      U("pw-syarat", "syarat wali (KHI Pasal 107 ayat (4))", [/berkelakuan\s+baik|jujur|\badil\b|sehat|Pasal\s+107|cakap|dewasa/i], 99),
      U("pw-kepentingan", "kepentingan anak", [/kepentingan\s+(?:terbaik\s+)?(?:bagi\s+)?(?:anak|si\s+anak)|untuk\s+(?:keperluan|kepentingan)|keperluan/i], 99),
    ],
  },
  wa: {
    judul: "wali adhal",
    dasar: ["KHI Pasal 21-23", "PMA 30/2005"],
    sampel: 1,
    unsur: [
      U("wa-wali", "wali nasab yang berhak (KHI Pasal 21)", [/wali\s+nasab|ayah\s+kandung|wali\s+(?:yang\s+)?berhak|Pasal\s+21/i], 0),
      U("wa-menolak", "wali enggan menikahkan", [/enggan|menolak|tidak\s+(?:mau|bersedia)|adhal|adhol|'adhal/i], 0),
      U("wa-alasan", "keengganan tanpa alasan yang sah", [/tidak\s+(?:beralasan|berdasar|dibenarkan|sah)|alasan|syar'?i/i], 0),
      U("wa-larangan", "tidak ada larangan kawin", [POLA_LARANGAN, /tidak\s+(?:ada|terdapat)\s+(?:hal\s+yang\s+)?(?:menghalangi|halangan)/i], 0),
    ],
  },
  aua: {
    judul: "asal usul anak",
    dasar: ["UU 1/1974 Pasal 42, 55", "KHI Pasal 99-103"],
    sampel: 3,
    unsur: [
      U("aua-nikah", "perkawinan orang tua (rukun nikah)", [/akad\s+nikah|wali|saksi\s+nikah|ijab/i], 0),
      U("aua-sah", "anak lahir dalam/akibat perkawinan sah (UU 1/1974 Pasal 42; KHI Pasal 99)", [/Pasal\s+42|Pasal\s+99|anak\s+(?:yang\s+)?sah|lahir\s+(?:dalam|dari|akibat|sebagai\s+akibat)/i], 0),
    ],
  },
  angkat: {
    judul: "pengangkatan anak",
    dasar: ["UU 23/2002 jo. UU 35/2014 Pasal 39-41", "PP 54/2007", "Permensos 110/HUK/2009"],
    sampel: 0,
    unsur: [
      U("an-terbaik", "kepentingan terbaik anak", [/kepentingan\s+terbaik|kesejahteraan|perlindungan\s+anak/i], 0),
      U("an-agama", "seagama (UU 35/2014 Pasal 39 ayat (3))", [/seagama|agama\s+yang\s+sama|sama-sama\s+beragama|beragama\s+Islam/i], 0),
      U("an-nasab", "tidak memutus hubungan darah (PP 54/2007 Pasal 4)", [/hubungan\s+darah|nasab/i], 0),
      U("an-ortu", "persetujuan orang tua kandung", [/persetujuan|menyetujui|setuju|menyerahkan|izin/i], 0),
    ],
  },
  hadhanah: {
    judul: "hak asuh anak",
    dasar: ["KHI Pasal 105, 156", "UU 23/2002 jo. UU 35/2014", "SEMA 1/2017 (akses orang tua lain)"],
    sampel: 0,
    unsur: [
      U("hd-umur", "anak belum mumayyiz / 12 tahun (KHI Pasal 105)", [/mumayyiz|mumayiz|12\s*\(?\s*(?:dua\s+belas)?\s*\)?\s*tahun|Pasal\s+105/i], 0),
      U("hd-terbaik", "kepentingan terbaik anak", [/kepentingan\s+terbaik|kepentingan\s+(?:si\s+)?anak/i], 0),
      U("hd-layak", "kelayakan pemegang hak asuh", [/berkelakuan|perilaku|akhlak|layak|mampu\s+(?:mengasuh|merawat|memelihara)|kasih\s+sayang/i], 0),
      U("hd-akses", "akses orang tua lain (SEMA 1/2017)", [/akses|bertemu|menjenguk|mengunjungi|SEMA\s+(?:Nomor\s+)?1\s+Tahun\s+2017/i], 0),
    ],
  },
  pembatalan: {
    judul: "pembatalan perkawinan",
    dasar: ["UU 1/1974 Pasal 22-28", "KHI Pasal 70-76"],
    sampel: 0,
    unsur: [
      U("pb-alasan", "alasan pembatalan (UU 1/1974 Pasal 22-27; KHI Pasal 70-71)", [/Pasal\s+2[2-7]|Pasal\s+7[01]|dapat\s+dibatalkan|batal\s+demi\s+hukum|tidak\s+memenuhi\s+syarat/i], 0),
      U("pb-pihak", "pihak yang berhak mengajukan (UU 1/1974 Pasal 23; KHI Pasal 73)", [/Pasal\s+23|Pasal\s+73|berhak\s+mengajukan|legal\s+standing|kedudukan\s+hukum|persona\s+standi/i], 0),
    ],
  },
  es: {
    judul: "ekonomi syariah",
    dasar: ["UU 7/1989 jo. UU 3/2006 Pasal 49 huruf i", "PERMA 14/2016"],
    sampel: 0,
    unsur: [
      U("es-akad", "akad dan isinya", [/akad|perjanjian|pembiayaan|murabahah|musyarakah|mudharabah|ijarah/i], 0),
      U("es-ingkar", "wanprestasi (ingkar janji)", [/wanprestasi|ingkar\s+janji|cidera\s+janji|tidak\s+memenuhi\s+kewajiban/i], 0),
    ],
  },
};

// ----------------------------------------------------------------------------
// Huruf alasan
// ----------------------------------------------------------------------------
function hurufPasal(teks: string, pasal: string): string {
  // "huruf b", "huruf (b) dan (f)", "huruf a, b dan f" - huruf berangkai ikut terbaca.
  const sambung = "\\s*\\)?\\s*(?:,|dan|serta|jo\\.?)\\s*(?:huruf\\s*)?\\(?\\s*[a-hA-H]\\b";
  const pola = new RegExp(`Pasal\\s+${pasal}\\s+(?:huruf|Huruf|hurup)\\s*\\(?\\s*([a-hA-H])\\b((?:${sambung})*)`, "g");
  const set = new Set<string>();
  for (const m of teks.matchAll(pola)) {
    set.add(m[1].toUpperCase());
    for (const n of String(m[2] || "").matchAll(/(?:,|dan|serta|jo\.?)\s*(?:huruf\s*)?\(?\s*([a-hA-H])\b/g)) set.add(n[1].toUpperCase());
  }
  return [...set].sort().join("");
}

/** Huruf alasan yang DIKUTIP pertimbangan: Pasal 19 (PP 9/1975) dan Pasal 116 (KHI). */
export function hurufDikutip(pertimbangan: string): { pp19: string; khi116: string; gabung: string } {
  const t = datar(pertimbangan);
  const pp19 = hurufPasal(t, "19");
  const khi116 = hurufPasal(t, "116");
  return { pp19, khi116, gabung: [...new Set((pp19 + khi116).split(""))].filter(Boolean).sort().join("") };
}

// ----------------------------------------------------------------------------
// Unsur
// ----------------------------------------------------------------------------
export function unsurDibahas(unsur: UnsurAlasan, teks: string): boolean {
  return unsur.pola.some((p) => p.test(teks));
}

export function unsurUntuk(huruf: string, jenis: KodeJenisSaksi): UnsurAlasan[] {
  const out: UnsurAlasan[] = [];
  for (const h of huruf.split("")) for (const u of KATALOG_ALASAN[h]?.unsur ?? []) if (!out.some((x) => x.kode === u.kode)) out.push(u);
  if ((jenis === "cg" || jenis === "ct") && huruf) out.push(UNSUR_UPAYA_DAMAI);
  return out;
}

// ----------------------------------------------------------------------------
// Dasar hukum
// ----------------------------------------------------------------------------
/**
 * Tahun yang SAH untuk nomor peraturan yang sering dikutip. Hanya pasangan
 * yang tidak bermakna ganda di perkara agama; nomor lain tidak diperiksa.
 */
const TAHUN_DIKENAL: Record<string, Record<string, number[]>> = {
  uu: { "7": [1989], "3": [2006], "50": [2009], "1": [1974, 1946, 2023], "16": [2019], "48": [2009] },
  pp: { "9": [1975] },
  inpres: { "1": [1991] },
  perma: { "7": [2022], "3": [2017], "5": [2019] },
};

const POLA_PERATURAN_BERNOMOR =
  /(Undang-Undang|Undang-undang|Undang\s+Undang|UU|Peraturan\s+Pemerintah|PP|Instruksi\s+Presiden|Inpres|Peraturan\s+Mahkamah\s+Agung|PERMA|Perma)(?:\s+(?:Republik\s+Indonesia|RI))?\s+(?:Nomor|Nom0r|No\.?|Nomer)\s*(\d{1,3})\s+(?:Tahun|tahun|Th\.?)\s+(\d{4})/g;

function jenisPeraturan(sebut: string): string {
  const s = sebut.toLowerCase().replace(/\s+/g, " ");
  if (/^(undang|uu)/.test(s)) return "uu";
  if (/^(peraturan pemerintah|pp)$/.test(s)) return "pp";
  if (/^(instruksi presiden|inpres)$/.test(s)) return "inpres";
  if (/^(peraturan mahkamah agung|perma)$/.test(s)) return "perma";
  return "";
}

export type PeraturanBernomor = { jenis: string; nomor: string; tahun: string; tertulis: string };

export function peraturanBernomor(teks: string): PeraturanBernomor[] {
  const t = datar(teks);
  const out: PeraturanBernomor[] = [];
  for (const m of t.matchAll(POLA_PERATURAN_BERNOMOR)) {
    const jenis = jenisPeraturan(m[1]);
    if (jenis) out.push({ jenis, nomor: String(Number(m[2])), tahun: m[3], tertulis: m[0] });
  }
  return out;
}

const NAMA_JENIS: Record<string, string> = { uu: "UU", pp: "PP", inpres: "Inpres", perma: "PERMA" };

/** Kutipan pasal per peraturan (kunci "uu-1-1974 Pasal 39"), untuk daftar dan perbandingan. */
export function kutipanPasal(teks: string): KutipanDraf[] {
  const peta = new Map<string, KutipanDraf>();
  for (const a of alineaDari(teks)) {
    for (const r of kenaliRujukan(a)) {
      const slug = slugDariSebutan(r.peraturan);
      if (!slug || !r.pasal) continue;
      const kunci = `${slug} Pasal ${r.pasal}`;
      const ada = peta.get(kunci);
      if (ada) ada.jumlah += 1;
      else peta.set(kunci, { kunci, sebutan: `Pasal ${r.pasal}${r.huruf ? ` huruf ${r.huruf}` : ""} ${r.peraturan}`.trim(), jumlah: 1 });
    }
  }
  return [...peta.values()];
}

export function periksaDasarHukum(pertimbangan: string, seluruh: string): TemuanAdvance[] {
  const temuan: TemuanAdvance[] = [];
  const t = datar(pertimbangan);
  const h = hurufDikutip(t);
  // PP 9/1975 Pasal 19 hanya huruf a-f; KHI Pasal 116 a-h (g taklik talak, h murtad
  // tidak ada padanannya). Yang dibandingkan huruf a-f saja; g/h hanya sah di Pasal 116.
  const pp19AF = h.pp19.replace(/[^A-F]/g, "");
  const khi116AF = h.khi116.replace(/[^A-F]/g, "");
  if (pp19AF && khi116AF && pp19AF !== khi116AF) {
    temuan.push({
      kode: "huruf-19-116",
      tingkat: "perhatian",
      langkah: "pertimbangan",
      judul: "Huruf Pasal 19 PP 9/1975 berbeda dengan huruf Pasal 116 KHI",
      rinci: `Pasal 19 menyebut huruf ${pp19AF.toLowerCase().split("").join(", ")}, Pasal 116 huruf ${khi116AF.toLowerCase().split("").join(", ")}. Isi kedua pasal untuk huruf a-f sama; biasanya hurufnya sama. (Ukur: 10 dari 2.257 putusan BHT PA Donggala.)`,
      bukti: [potong(t, /Pasal\s+19\s+huruf/), potong(t, /Pasal\s+116\s+huruf/)].filter(Boolean),
    });
  }

  // Hanya nomor yang tahunnya dikenal yang diperiksa. Aturan "nomor sama, tahun
  // berbeda" sempat dicoba dan dibuang: UU 23/2002 dan 23/2004, PERMA 1/2008,
  // 1/2016, 1/2019 sah bersamaan (ukur awal 128 catatan palsu).
  const daftar = peraturanBernomor(seluruh);
  const sudah = new Set<string>();
  for (const p of daftar) {
    const k = `${p.jenis}-${p.nomor}`;
    const sah = TAHUN_DIKENAL[p.jenis]?.[p.nomor];
    if (sah && !sah.includes(Number(p.tahun)) && !sudah.has(`${k}-${p.tahun}`)) {
      sudah.add(`${k}-${p.tahun}`);
      temuan.push({
        kode: "tahun-peraturan",
        tingkat: "perhatian",
        langkah: "pertimbangan",
        judul: `Tahun ${NAMA_JENIS[p.jenis]} Nomor ${p.nomor} tidak lazim`,
        rinci: `Tertulis "${p.tertulis}". ${NAMA_JENIS[p.jenis]} Nomor ${p.nomor} yang dikutip di perkara agama bertahun ${sah.join(" / ")}. Mohon dicek ketikannya.`,
      });
    }
  }
  const s = datar(seluruh);
  if (/(?:Undang-Undang|UU)\s+(?:Nomor|No\.?)\s*7\s+Tahun\s+1989/i.test(s) && !/50\s+Tahun\s+2009/i.test(s)) {
    temuan.push({
      kode: "uu7-tanpa-perubahan",
      tingkat: "catatan",
      langkah: "pertimbangan",
      judul: "UU 7/1989 dikutip tanpa perubahan keduanya (UU 50/2009)",
      rinci: "Lazimnya ditulis \"... sebagaimana telah diubah dengan UU Nomor 3 Tahun 2006 dan perubahan kedua dengan UU Nomor 50 Tahun 2009\".",
    });
  }
  return temuan;
}

// ----------------------------------------------------------------------------
// Konsistensi pertimbangan - amar
// ----------------------------------------------------------------------------
export type KeadaanNaskah = "dikabulkan" | "ditolak" | "tidakDiterima" | "dicabut" | "gugur" | "takDikenali";

/**
 * Keadaan amar POKOK = kata kerja amar yang muncul PERTAMA. bacaKeadaan
 * (amar-petitum) mendahulukan "menolak", sehingga "Mengabulkan permohonan
 * Pemohon; ... Dalam Rekonvensi ... menolak selebihnya" terbaca ditolak -
 * pada ukur awal 12 salah tangkap, semuanya perkara berekonvensi.
 */
/**
 * "Gugur" sebagai nasib POKOK perkara: gugatan/permohonan/perkara (dengan pihak atau
 * nomornya) yang gugur. Kata "gugur" pada hak menjawab, eksepsi, dsb. bukan kesimpulan
 * pokok - pertimbangan lazim memuat "hak Tergugat untuk mengajukan jawaban gugur".
 */
const POLA_GUGUR =
  /(?:gugatan|permohonan|perkara)(?:(?!eksepsi|jawaban|menjawab|replik|duplik|\bhak\b|\bsaksi\b|\bbukti\b)(?:[^.;]|\.(?=\S))){0,100}?\s(?:dinyatakan\s+)?gugur\b|menyatakan\s+gugur\s+(?:gugatan|permohonan|perkara)/;

export function keadaanAmar(amar: string): KeadaanNaskah {
  const t = datar(amar).toLowerCase();
  const calon: Array<[KeadaanNaskah, RegExp]> = [
    ["dicabut", /pencabutan|mencabut|dicabut/],
    ["gugur", POLA_GUGUR],
    ["tidakDiterima", /tidak\s+dapat\s+diterima|niet\s*ontvankelijk/],
    ["ditolak", /menolak\s+(?:gugatan|permohonan)/],
    ["dikabulkan", /mengabulkan\s+(?:gugatan|permohonan|pemohonan)(?!\s+(?:pencabutan|untuk\s+mencabut))|memberi\s+izin|menjatuhkan\s+talak|menetapkan\s+sah/],
  ];
  let pilih: KeadaanNaskah = "takDikenali";
  let posisi = Number.POSITIVE_INFINITY;
  for (const [k, p] of calon) {
    const m = p.exec(t);
    if (m && m.index < posisi) {
      posisi = m.index;
      pilih = k;
    }
  }
  if (pilih !== "takDikenali") return pilih;
  const k = bacaKeadaan(t);
  return k === "takDikenali" ? "takDikenali" : k;
}

/** Kesimpulan pertimbangan atas gugatan/permohonan pokok (dibaca dari alinea yang menyimpulkan). */
export function kesimpulanPertimbangan(pertimbangan: string): Set<KeadaanNaskah> {
  const t = datar(pertimbangan).toLowerCase();
  const set = new Set<KeadaanNaskah>();
  const pokok = "(?:gugatan|permohonan|petitum)[^.;]{0,160}?";
  if (new RegExp(`${pokok}(?:patut|harus|dapat|layak|beralasan|cukup\\s+alasan)[^.;]{0,40}?dikabulkan`).test(t) || /dikabulkan\s+dengan\s+verstek/.test(t)) set.add("dikabulkan");
  if (new RegExp(`${pokok}(?:harus|patut|dapat|haruslah|patutlah)\\s+(?:dinyatakan\\s+)?ditolak`).test(t)) set.add("ditolak");
  if (new RegExp(`${pokok}(?:harus|patut|haruslah|patutlah)?\\s*dinyatakan\\s+tidak\\s+dapat\\s+diterima`).test(t)) set.add("tidakDiterima");
  if (/mencabut\s+(?:gugatan|permohonan|perkara)|pencabutan\s+(?:gugatan|permohonan|perkara)/.test(t)) set.add("dicabut");
  if (POLA_GUGUR.test(t)) set.add("gugur");
  return set;
}

const BAIN = /ba'?\s*-?\s*in\s*(?:s|sh)u?g?h?r[ao]|bain\s+sughr|ba'in\s+kubr/i;
const RAJI = /r[ao]j'?\s*-?\s*'?i\b|raj'i|roj'i|raj\s*'\s*i/i;

function talakDi(teks: string): "bain" | "raji" | "" {
  const t = datar(teks);
  if (BAIN.test(t)) return "bain";
  if (RAJI.test(t)) return "raji";
  return "";
}

const TAMBAHAN: Array<{ kode: string; nama: string; pola: RegExp }> = [
  { kode: "iddah", nama: "nafkah iddah", pola: /nafkah\s+(?:selama\s+(?:masa\s+)?)?idd?ah/i },
  { kode: "mutah", nama: "mut'ah", pola: /mut'?\s*ah|mutah/i },
  { kode: "madliyah", nama: "nafkah lampau (madliyah)", pola: /madl?h?iy?y?ah|nafkah\s+(?:yang\s+)?(?:lampau|terhutang|terutang)/i },
  { kode: "hadhanah", nama: "hak asuh anak (hadhanah)", pola: /hadh?anah|hak\s+asuh|pemeliharaan\s+anak|pengasuhan\s+anak/i },
  { kode: "nafkah-anak", nama: "nafkah anak", pola: /nafkah\s+(?:untuk\s+|kepada\s+|bagi\s+)?(?:\d+\s+orang\s+)?anak|biaya\s+(?:hidup|pemeliharaan|pendidikan)\s+anak/i },
  { kode: "harta-bersama", nama: "harta bersama", pola: /harta\s+bersama|gono[\s-]+gini/i },
];

const PIHAK = /(para\s+)?(penggugat|pemohon|tergugat|termohon)/i;

function pihakBiaya(teks: string, amar: boolean): string {
  const t = datar(teks);
  const pola = amar
    ? /membebankan\s+(?:kepada\s+)?(?:seluruh\s+)?(?:biaya\s+perkara\s+)?(?:yang\s+timbul\s+)?(?:kepada\s+)?((?:para\s+)?(?:penggugat|pemohon|tergugat|termohon))/i
    : /biaya\s+perkara[^.;]{0,140}?dibebankan\s+kepada\s+((?:para\s+)?(?:penggugat|pemohon|tergugat|termohon))/i;
  const m = pola.exec(t);
  return m ? m[1].toLowerCase().replace(/\s+/g, " ") : "";
}

function adaVerstek(amar: string): boolean {
  return /verstek|tanpa\s+hadirnya/i.test(datar(amar));
}

export function periksaKonsistensi(m: {
  jenis: KodeJenisSaksi;
  dudukPerkara: string;
  pertimbangan: string;
  amar: string;
}): TemuanAdvance[] {
  const temuan: TemuanAdvance[] = [];
  const pert = datar(m.pertimbangan);
  const amar = datar(m.amar);
  if (!pert || !amar) return temuan;

  // K1 kesimpulan vs amar
  const kAmar = keadaanAmar(amar);
  const kPert = kesimpulanPertimbangan(pert);
  if (kAmar !== "takDikenali" && kPert.size && !kPert.has(kAmar)) {
    const sebut: Record<string, string> = { dikabulkan: "dikabulkan", ditolak: "ditolak", tidakDiterima: "tidak dapat diterima", dicabut: "dicabut", gugur: "gugur", takDikenali: "-" };
    temuan.push({
      kode: "kesimpulan-amar",
      tingkat: "perhatian",
      langkah: "amar",
      judul: "Kesimpulan pertimbangan tidak sejalan dengan amar",
      rinci: `Pertimbangan menyimpulkan ${[...kPert].map((x) => sebut[x]).join(" / ")}, amar berbunyi ${sebut[kAmar]}.`,
    });
  }

  // K2/K3 jenis talak
  const tAmar = talakDi(amar);
  const tPert = talakDi(pert);
  const qabla = /qabl?a\s*(?:al\s*|ad\s*)?-?\s*dukh?ul|belum\s+pernah\s+(?:berhubungan|bercampur|melakukan\s+hubungan)|khul'?u?|khulu'?|iwadh?/i.test(`${pert} ${amar}`);
  if (m.jenis === "cg" && tAmar === "raji") {
    temuan.push({ kode: "talak-cg", tingkat: "perhatian", langkah: "amar", judul: "Cerai gugat dengan talak raj'i", rinci: "Pada cerai gugat yang dijatuhkan pengadilan lazimnya talak satu ba'in sughra (KHI Pasal 119 ayat (2) huruf c). (Ukur: 3 dari 1.332 cerai gugat BHT.)", bukti: [potong(amar, RAJI)] });
  }
  if (m.jenis === "ct" && tAmar === "bain" && !qabla) {
    temuan.push({ kode: "talak-ct", tingkat: "perhatian", langkah: "amar", judul: "Cerai talak dengan talak ba'in tanpa alasan qabla dukhul/khul'", rinci: "Izin ikrar talak lazimnya talak satu raj'i (KHI Pasal 118); ba'in sughra bila qabla dukhul atau dengan iwadh (KHI Pasal 119). Pertimbangan tidak menyebut keduanya. (Ukur: 5 dari 305 cerai talak BHT.)", bukti: [potong(amar, BAIN)] });
  }
  if (tAmar && tPert && tAmar !== tPert) {
    temuan.push({ kode: "talak-beda", tingkat: "perhatian", langkah: "amar", judul: "Jenis talak di pertimbangan berbeda dengan amar", rinci: `Pertimbangan menyebut talak ${tPert === "bain" ? "ba'in" : "raj'i"}, amar talak ${tAmar === "bain" ? "ba'in" : "raj'i"}.` });
  }

  // K4 verstek
  const vAmar = adaVerstek(amar);
  const tidakHadir = /(?:tergugat|termohon)[^.;]{0,120}?tidak\s+(?:pernah\s+)?(?:datang|hadir|menghadap)|tidak\s+(?:pernah\s+)?(?:datang|hadir|menghadap)[^.;]{0,60}?(?:tergugat|termohon)/i.test(pert);
  const verstekPert = /verstek|tanpa\s+hadirnya|Pasal\s+149\s+(?:ayat\s*\(?1\)?\s*)?(?:R\.?\s*Bg|RBg)|Pasal\s+125\s+(?:ayat\s*\(?1\)?\s*)?HIR/i.test(pert);
  if (vAmar && !tidakHadir && !verstekPert) {
    temuan.push({ kode: "verstek-tanpa-dasar", tingkat: "perhatian", langkah: "pertimbangan", judul: "Amar verstek, pertimbangan tidak membahas ketidakhadiran", rinci: "Amar menyatakan verstek, tetapi pertimbangan tidak menyebut Tergugat/Termohon tidak hadir walau dipanggil patut (RBg Pasal 149 ayat (1))." });
  }
  if (!vAmar && verstekPert && /dengan\s+verstek|secara\s+verstek|putusan\s+verstek/i.test(pert) && keadaanAmar(amar) === "dikabulkan") {
    temuan.push({ kode: "verstek-tanpa-amar", tingkat: "perhatian", langkah: "amar", judul: "Pertimbangan memutus verstek, amar tidak menyebut verstek", rinci: "Pertimbangan menyatakan perkara diputus verstek; amar lazimnya \"Mengabulkan gugatan ... dengan verstek\"." });
  }

  // K5 biaya
  const bPert = pihakBiaya(pert, false);
  const bAmar = pihakBiaya(amar, true);
  const dasarPihak = (x: string) => x.replace(/^para\s+/, "");
  if (bPert && bAmar && dasarPihak(bPert) !== dasarPihak(bAmar)) {
    temuan.push({ kode: "biaya-pihak", tingkat: "perhatian", langkah: "biaya", judul: "Pihak yang dibebani biaya berbeda", rinci: `Pertimbangan membebankan biaya kepada ${bPert}, amar kepada ${bAmar}.` });
  }

  // K7 tuntutan tambahan diamarkan tanpa pertimbangan
  for (const x of TAMBAHAN) {
    if (x.pola.test(amar) && !x.pola.test(pert)) {
      temuan.push({ kode: `tambahan-${x.kode}`, tingkat: "perhatian", langkah: "pertimbangan", judul: `Amar memuat ${x.nama}, pertimbangan tidak membahasnya`, rinci: `Tiap butir amar perlu dasar pertimbangannya. Tambahkan pertimbangan ${x.nama} (dasar dan besarannya).`, bukti: [potong(amar, x.pola)] });
    }
  }
  return temuan;
}

// ----------------------------------------------------------------------------
// Putusan serupa
// ----------------------------------------------------------------------------
function jaccard(a: string, b: string): number {
  const A = new Set(a.split("").filter(Boolean));
  const B = new Set(b.split("").filter(Boolean));
  if (!A.size && !B.size) return 1;
  const sama = [...A].filter((x) => B.has(x)).length;
  return sama / new Set([...A, ...B]).size;
}

type Kandidat = {
  asli: PutusanSerupaMasuk;
  pert: string;
  amar: string;
  huruf: string;
  verstek: boolean;
  keadaan: KeadaanNaskah;
  kutipan: Set<string>;
  sebutan: Map<string, string>;
};

function siapkanKandidat(k: PutusanSerupaMasuk): Kandidat {
  const pert = teksPolos(k.pertimbangan);
  const kut = kutipanPasal(pert);
  return {
    asli: k,
    pert,
    amar: teksPolos(k.amar),
    huruf: hurufDikutip(pert).gabung,
    verstek: adaVerstek(k.amar),
    keadaan: keadaanAmar(k.amar),
    kutipan: new Set(kut.map((x) => x.kunci)),
    sebutan: new Map(kut.map((x) => [x.kunci, x.sebutan])),
  };
}

const PERAN_BUKAN_NAMA = /^(?:Penggugat|Tergugat|Pemohon|Termohon|Saksi|Menimbang|Bahwa|Majelis|Hakim|Ketua|Anak|Para|Kuasa|I{1,3}|IV|Rekonvensi|Konvensi|Bapak|Ibu|Sdr\.?|Saudara|Saudari),?$/i;

/** Samarkan nama orang di alinea contoh; null bila masih tampak memuat nama. */
export function samarkanAlinea(teks: string, nama: string[] = []): string | null {
  let t = String(teks || "");
  const daftar = [...new Set(nama.map((x) => String(x || "").replace(/\s+/g, " ").trim()).filter((x) => x.length >= 3))].sort((a, b) => b.length - a.length);
  for (const n of daftar) {
    const lolos = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    t = t.replace(new RegExp(lolos, "gi"), "[nama]");
  }
  // "Rahmawati binti Lahiya" -> "[nama]": nama SEBELUM nasab juga nama orang. Kata peran
  // (Penggugat, Saksi, ...) di depannya dibiarkan.
  t = t
    .replace(/((?:[A-Z][A-Za-z'.-]*\s+){0,4})\b(?:bin|binti|Bin|Binti|BIN|BINTI)\s+(?:\[nama\]|[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,3})/g, (_m, depan: string) => {
      const kata = String(depan || "").trim().split(/\s+/).filter(Boolean);
      // Kata sampai kata peran TERAKHIR dipertahankan ("Saksi Penggugat [nama]"); sisanya nama.
      let j = kata.length;
      while (j > 0 && !PERAN_BUKAN_NAMA.test(kata[j - 1])) j--;
      const peran = kata.slice(0, j).join(" ");
      return `${peran ? `${peran} ` : ""}[nama]`;
    })
    .replace(/\b\d{1,5}\/Pdt\.[GP]\/\d{4}\/PA\.[A-Za-z]+\b/g, "[nomor perkara]")
    .replace(/\b\d{16}\b/g, "[NIK]");
  // Sisa nama bernasab atau kata bergelar sesudah "saksi" = belum aman ditawarkan.
  if (/\b(?:bin|binti)\s+(?!\[nama\])[A-Z]/.test(t)) return null;
  if (/\bsaksi\s+(?:I{1,3}|pertama|kedua|ketiga)?\s*(?:Penggugat|Pemohon|Tergugat|Termohon)?\s*(?:bernama\s+|yaitu\s+|,\s*)[A-Z][a-z]+\s+[A-Z][a-z]+/.test(t)) return null;
  for (const n of daftar) {
    for (const kata of n.split(" ").filter((k) => k.length >= 5 && /^[A-Z]/.test(k))) {
      if (new RegExp(`\\b${kata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) return null;
    }
  }
  return t;
}

function contohDariKandidat(kandidat: Kandidat[], unsur: UnsurAlasan, batas = 2): ContohAlinea[] {
  const out: ContohAlinea[] = [];
  for (const k of kandidat) {
    if (out.length >= batas) break;
    const cocok = alineaDari(k.pert).filter((a) => /^menimbang/i.test(a) && a.length >= 80 && a.length <= 1600 && unsurDibahas(unsur, a));
    // Alinea terpendek yang membahas unsur = paling terarah.
    const pilih = cocok.sort((a, b) => a.length - b.length)[0];
    if (!pilih) continue;
    const aman = samarkanAlinea(pilih, k.asli.nama);
    if (!aman) continue;
    out.push({ sumber: "putusan", label: `Putusan ${k.asli.nomor}${k.asli.tanggalBht ? ` (BHT ${k.asli.tanggalBht})` : ""}`, teks: aman });
  }
  return out;
}

function contohDariPustaka(pustaka: ButirPustakaMasuk[], huruf: string, unsur: UnsurAlasan, batas = 1): ContohAlinea[] {
  return pustaka
    .filter((b) => (!b.labelAlasan || !b.labelAlasan.length || b.labelAlasan.some((h) => huruf.includes(h))) && unsurDibahas(unsur, b.teks))
    .sort((a, b) => Number(b.jumlahPemakaian || 0) - Number(a.jumlahPemakaian || 0))
    .slice(0, batas)
    .map((b) => ({ sumber: "pustaka" as const, label: `Pustaka ALETA (disahkan)${b.jumlahPemakaian ? `, dipakai ${b.jumlahPemakaian}x` : ""}`, teks: b.teks }));
}

// ----------------------------------------------------------------------------
// Rapor
// ----------------------------------------------------------------------------
/** Unsur dibahas di >= 80% putusan serupa hakim itu (min. 5 pembanding) -> perhatian. */
const AMBANG_LAZIM = 0.8;
/**
 * Tanpa pembanding hakim: hanya unsur yang dibahas di >= 95% putusan BHT PA
 * Donggala yang menjadi perhatian. Ukur awal dengan ambang 80%: 305 dari 2.257
 * putusan BHT mendapat perhatian, sebagian besar unsur keluarga/upaya damai
 * yang di SIPP memang kerap tidak ikut tersalin.
 */
const AMBANG_BAWAAN = 0.95;
const MIN_PEMBANDING = 5;

export function susunRaporAdvance(m: MasukanAdvance): RaporAdvance {
  const jenis = kodeJenisSaksi(m.jenisPerkara || "", m.nomorPerkara || "", "", m.sebutanP || "");
  const kodeAdv = kodeJenisAdvance(m.jenisPerkara || "", m.nomorPerkara || "", m.sebutanP || "");
  const cerai = jenis === "cg" || jenis === "ct";
  const pert = teksPolos(m.pertimbangan);
  const amar = teksPolos(m.amar);
  const duduk = teksPolos(m.dudukPerkara);
  const pertDatar = pert.replace(/\s+/g, " ");
  const saksiAda = Array.isArray(m.keteranganSaksi);
  const saksi = saksiAda ? (m.keteranganSaksi as string[]).join("\n").replace(/\s+/g, " ") : "";
  const tidakDiperiksa: string[] = [];
  const temuan: TemuanAdvance[] = [];

  for (const b of m.bagianHilang ?? []) tidakDiperiksa.push(`Bagian ${b} tidak ditemukan di naskah (judul bagiannya tidak terbaca).`);
  if (!saksiAda) tidakDiperiksa.push("Keterangan saksi tidak terkirim - unsur hanya diperiksa di pertimbangan.");

  const h = hurufDikutip(pert);
  const didalilkan = hurufAlasan(m.hurufIsian || "");
  const hurufPeriksa = cerai ? [...new Set((didalilkan + h.gabung).split(""))].filter(Boolean).sort().join("") : "";

  // Putusan serupa: jenis sama dari bot; di sini diurut menurut huruf/verstek/keadaan.
  const vDraf = adaVerstek(amar);
  const kDraf = keadaanAmar(amar);
  const kutDraf = kutipanPasal(pert);
  const kunciDraf = new Set(kutDraf.map((x) => x.kunci));
  const kandidat = (m.serupa ?? []).map(siapkanKandidat).map((k) => {
    const skor = (cerai ? 3 * jaccard(k.huruf, hurufPeriksa) : 0) + (k.verstek === vDraf ? 1 : 0) + (k.keadaan === kDraf ? 1 : 0);
    return { k, skor: Math.round(skor * 100) / 100 };
  });
  kandidat.sort((a, b) => b.skor - a.skor || String(b.k.asli.tanggalPutusan || "").localeCompare(String(a.k.asli.tanggalPutusan || "")));
  // Pembanding = yang hurufnya sama persis (cerai) / keadaannya sama (lainnya), paling banyak 10.
  const pembanding = kandidat
    .filter(({ k }) => (cerai ? hurufPeriksa && k.huruf === hurufPeriksa : k.keadaan === kDraf))
    .slice(0, 10)
    .map((x) => x.k);
  if (!m.serupa) tidakDiperiksa.push("Putusan serupa dari SIPP tidak terbaca - pembanding hakim tidak dipakai.");
  else if (!m.serupa.length) tidakDiperiksa.push("Belum ada putusan BHT hakim ini untuk jenis perkara yang sama.");

  // 1. Alasan dan unsur
  const alasan: HasilAlasan[] = [];
  if (cerai) {
    if (!didalilkan) tidakDiperiksa.push("Huruf alasan (#8503#) belum diisi di Blangko Derry - alasan yang didalilkan tidak diadu.");
    for (const hr of didalilkan.split("").filter(Boolean)) {
      if (!h.gabung.includes(hr) && pert) {
        temuan.push({
          kode: "alasan-tidak-dipertimbangkan",
          tingkat: "perhatian",
          langkah: "pertimbangan",
          judul: `Alasan huruf ${hr.toLowerCase()} didalilkan, tetapi tidak dikutip di pertimbangan`,
          rinci: `Isian alasan Blangko Derry: ${didalilkan}. Pertimbangan mengutip ${h.gabung ? `huruf ${h.gabung.toLowerCase()}` : "tidak satu pun huruf Pasal 19/116"}. Pertimbangkan atau nyatakan alasan itu tidak terbukti.`,
        });
      }
    }
    if (didalilkan) {
      for (const hr of h.gabung.split("").filter(Boolean)) {
        if (!didalilkan.includes(hr)) {
          temuan.push({ kode: "alasan-tidak-didalilkan", tingkat: "catatan", langkah: "pertimbangan", judul: `Pertimbangan mengutip huruf ${hr.toLowerCase()} yang tidak ada di isian alasan`, rinci: `Isian alasan: ${didalilkan}. Bila memang terbukti, perbarui isian #8503# agar set saksi dan checklist ikut menyesuaikan.` });
        }
      }
    }
    for (const hr of hurufPeriksa.split("").filter(Boolean)) {
      const kat = KATALOG_ALASAN[hr];
      if (!kat) continue;
      const unsur = [...kat.unsur, ...(alasan.length ? [] : [UNSUR_UPAYA_DAMAI])];
      const hasil: HasilUnsur[] = unsur.map((u) => {
        const dibahas = unsurDibahas(u, pertDatar);
        const ada = pembanding.filter((k) => unsurDibahas(u, k.pert.replace(/\s+/g, " "))).length;
        const lazim = pembanding.length >= 3 ? { ada, dari: pembanding.length } : null;
        const contoh = dibahas ? [] : [...contohDariPustaka(m.pustaka ?? [], hurufPeriksa, u), ...contohDariKandidat(pembanding.length ? pembanding : kandidat.map((x) => x.k), u)];
        return { kode: u.kode, nama: u.nama, dasar: u.dasar || "", dipertimbangkan: dibahas, saksi: saksiAda ? unsurDibahas(u, saksi) : null, lazim, contoh };
      });
      alasan.push({ huruf: hr, judul: kat.judul, dasar: kat.dasar, didalilkan: didalilkan.includes(hr), dipertimbangkan: h.gabung.includes(hr), unsur: hasil });
      for (const [i, u] of hasil.entries()) {
        if (u.dipertimbangkan || !pert) continue;
        const pakaiHakim = Boolean(u.lazim && u.lazim.dari >= MIN_PEMBANDING);
        const rate = pakaiHakim && u.lazim ? u.lazim.ada / u.lazim.dari : unsur[i].lazimBawaan / 100;
        // Unsur yang jarang dibahas (< 50%) tetap tampil di tabel unsur, tetapi tidak dijadikan temuan.
        if (rate < 0.5) continue;
        const sumber = pakaiHakim && u.lazim ? `dibahas di ${u.lazim.ada} dari ${u.lazim.dari} putusan serupa Bapak/Ibu` : `dibahas di ±${unsur[i].lazimBawaan}% putusan BHT PA Donggala`;
        temuan.push({
          kode: `unsur-${u.kode}`,
          tingkat: rate >= (pakaiHakim ? AMBANG_LAZIM : AMBANG_BAWAAN) ? "perhatian" : "catatan",
          langkah: "pertimbangan",
          judul: `Unsur "${u.nama}" (huruf ${hr.toLowerCase()}) belum tampak di pertimbangan`,
          rinci: `${sumber}.${u.saksi === true ? " Keterangan saksi sudah memuatnya - tinggal dipertimbangkan." : u.saksi === false ? " Keterangan saksi juga belum memuatnya." : ""}${u.contoh.length ? " Contoh alinea tersedia." : ""}`,
        });
      }
      for (const u of hasil) {
        if (u.saksi === false && u.dipertimbangkan && saksi) {
          temuan.push({ kode: `saksi-${u.kode}`, tingkat: "catatan", langkah: "saksi", judul: `Unsur "${u.nama}" dipertimbangkan, tetapi tidak tampak di keterangan saksi`, rinci: "Pastikan fakta unsur ini didukung bukti (saksi/surat) yang tercatat di BAS." });
        }
      }
    }
  } else {
    // 17 Okt (butir 56): jenis lain diperiksa per unsur set saksi F3.3 - hanya bila amar MENGABULKAN
    // (amar menolak/tidak diterima memang tidak membahas semua unsur).
    const kat = KATALOG_JENIS[kodeAdv];
    if (!kat) {
      tidakDiperiksa.push("Unsur per jenis belum tersedia untuk jenis perkara ini; diperiksa dasar hukum, konsistensi, dan pembandingnya saja.");
    } else if (kDraf !== "dikabulkan") {
      tidakDiperiksa.push(`Unsur ${kat.judul} diperiksa bila amar mengabulkan; amar draf ini ${kDraf === "takDikenali" ? "belum terbaca" : kDraf}.`);
    } else {
      const sumberContoh = pembanding.length ? pembanding : kandidat.map((x) => x.k);
      const hasil: HasilUnsur[] = kat.unsur.map((u) => {
        const dibahas = unsurDibahas(u, pertDatar);
        const ada = pembanding.filter((k) => unsurDibahas(u, k.pert.replace(/\s+/g, " "))).length;
        const lazim = pembanding.length >= 3 ? { ada, dari: pembanding.length } : null;
        return { kode: u.kode, nama: u.nama, dasar: u.dasar || "", dipertimbangkan: dibahas, saksi: saksiAda ? unsurDibahas(u, saksi) : null, lazim, contoh: dibahas ? [] : contohDariKandidat(sumberContoh, u) };
      });
      alasan.push({ huruf: "", judul: kat.judul, dasar: kat.dasar, didalilkan: true, dipertimbangkan: true, unsur: hasil });
      for (const [i, u] of hasil.entries()) {
        if (u.dipertimbangkan || !pert) continue;
        const pakaiHakim = Boolean(u.lazim && u.lazim.dari >= MIN_PEMBANDING);
        // Belum cukup putusan BHT setempat (< SAMPEL_TERUKUR): unsur peraturan dianggap lazim 80% -> catatan.
        const terukur = kat.sampel >= SAMPEL_TERUKUR;
        const bawaan = terukur ? kat.unsur[i].lazimBawaan : LAZIM_BELUM_TERUKUR;
        const rate = pakaiHakim && u.lazim ? u.lazim.ada / u.lazim.dari : bawaan / 100;
        if (rate < 0.5) continue;
        // Sampel satker kecil: tanpa pembanding hakim, paling jauh catatan.
        const bolehPerhatian = pakaiHakim || kat.sampel >= SAMPEL_PERHATIAN;
        const sumber =
          pakaiHakim && u.lazim
            ? `dibahas di ${u.lazim.ada} dari ${u.lazim.dari} putusan serupa Bapak/Ibu`
            : terukur
              ? `dibahas di ±${bawaan}% dari ${kat.sampel} putusan BHT PA Donggala`
              : `unsur yang diminta peraturan (${kat.dasar.join("; ")}); putusan BHT PA Donggala jenis ini belum cukup untuk diukur (${kat.sampel})`;
        temuan.push({
          kode: `unsur-${u.kode}`,
          tingkat: bolehPerhatian && rate >= (pakaiHakim ? AMBANG_LAZIM : AMBANG_BAWAAN) ? "perhatian" : "catatan",
          langkah: "pertimbangan",
          judul: `Unsur "${u.nama}" belum tampak di pertimbangan`,
          rinci: `${sumber}.${u.saksi === true ? " Keterangan saksi sudah memuatnya - tinggal dipertimbangkan." : u.saksi === false ? " Keterangan saksi juga belum memuatnya." : ""}${u.contoh.length ? " Contoh alinea tersedia." : ""}`,
        });
      }
    }
  }

  // 2. Dasar hukum
  temuan.push(...periksaDasarHukum(pert, `${duduk}\n${pert}\n${amar}`));
  if (pembanding.length >= MIN_PEMBANDING && pert) {
    const hitung = new Map<string, number>();
    const sebut = new Map<string, string>();
    for (const k of pembanding) for (const kunci of k.kutipan) {
      hitung.set(kunci, (hitung.get(kunci) || 0) + 1);
      if (!sebut.has(kunci)) sebut.set(kunci, k.sebutan.get(kunci) || kunci);
    }
    const lazimTiada = [...hitung.entries()].filter(([kunci, n]) => n / pembanding.length >= 0.8 && !kunciDraf.has(kunci)).sort((a, b) => b[1] - a[1]);
    for (const [kunci, n] of lazimTiada.slice(0, 4)) {
      temuan.push({ kode: "kutipan-lazim", tingkat: "catatan", langkah: "pertimbangan", judul: `Belum mengutip ${sebut.get(kunci)}`, rinci: `Dikutip di ${n} dari ${pembanding.length} putusan serupa Bapak/Ibu yang sudah BHT. Abaikan bila memang tidak relevan.` });
    }
  }

  // 3. Konsistensi
  temuan.push(...periksaKonsistensi({ jenis, dudukPerkara: duduk, pertimbangan: pert, amar }));
  if (!pert) tidakDiperiksa.push("Pertimbangan hukum kosong - belum ada yang dapat diperiksa.");
  if (!amar) tidakDiperiksa.push("Amar kosong - konsistensi pertimbangan dan amar belum diperiksa.");

  // 4. Ringkas pembanding untuk layar
  const serupa: SerupaRingkas[] = kandidat.slice(0, 5).map(({ k, skor }) => {
    const sama: string[] = [];
    const beda: string[] = [];
    if (cerai) (k.huruf === hurufPeriksa ? sama : beda).push(`huruf ${k.huruf.toLowerCase() || "-"}`);
    (k.verstek === vDraf ? sama : beda).push(k.verstek ? "verstek" : "hadir");
    (k.keadaan === kDraf ? sama : beda).push(k.keadaan);
    return { nomor: k.asli.nomor, tanggalPutusan: k.asli.tanggalPutusan || "", tanggalBht: k.asli.tanggalBht || "", huruf: k.huruf, verstek: k.verstek, keadaan: k.keadaan, skor, sama, beda };
  });

  temuan.sort((a, b) => (a.tingkat === b.tingkat ? 0 : a.tingkat === "perhatian" ? -1 : 1));
  const perLangkah: RaporAdvance["perLangkah"] = {};
  for (const t of temuan) {
    const p = (perLangkah[t.langkah] = perLangkah[t.langkah] || { perhatian: 0, catatan: 0 });
    p[t.tingkat] += 1;
  }
  const nP = temuan.filter((t) => t.tingkat === "perhatian").length;
  const ringkas = `${nP} perhatian, ${temuan.length - nP} catatan${pembanding.length ? `; dibandingkan dengan ${pembanding.length} putusan serupa yang sudah BHT` : ""}.`;

  return {
    nomorPerkara: m.nomorPerkara,
    jenis,
    jenisPeriksa: kodeAdv,
    huruf: { didalilkan, dikutip: h.gabung, pp19: h.pp19, khi116: h.khi116 },
    alasan,
    kutipan: kutDraf.sort((a, b) => b.jumlah - a.jumlah),
    temuan,
    perLangkah,
    serupa,
    jumlahSerupa: (m.serupa ?? []).length,
    tidakDiperiksa,
    ringkas,
  };
}
