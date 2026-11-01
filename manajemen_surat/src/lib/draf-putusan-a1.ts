/**
 * ============================================================================
 * A1 (1 Nov 2026) - DRAF PERTIMBANGAN & AMAR OTOMATIS: LAPIS ATURAN (TANPA AI)
 * ============================================================================
 *
 * Keputusan Derry 90-A1: begitu BAS kesimpulan selesai (atau agenda berikutnya musyawarah/putusan), draf pertimbangan hukum
 * dan amar tersusun sendiri untuk DIBACA hakim. Ini perluasan draf H-7 (lib/agen-h7-putusan.ts), bukan jalur kedua: draf
 * disusun di dalam susunDrafSatu untuk tiap varian H-7 (mengabulkan / menolak) dan disimpan bersama draf H-7 (draf_json 0068).
 *
 * Bahan (semuanya sudah ada di ALETA, tidak ada pembaca baru):
 *   - matriks dalil P2 (lib/matriks-dalil.ts): dalil per butir + huruf alasan + tanggapan + status pembuktian A2
 *     (kolom `pembuktian`; kosong = "belum dinilai", tidak pernah dianggap terbukti diam-diam);
 *   - keterangan saksi tersimpan (pemeriksaan saksi ABT), bukti surat (#1214#/#9911#), kesimpulan, kehadiran;
 *   - unsur huruf alasan dari katalog Putusan Advance (KATALOG_ALASAN / unsurUntuk - pustaka yang sudah diukur);
 *   - petitum + arah varian -> amar lewat susunAmar (lib/amar-dari-petitum.ts) - penyusun amar yang sama dengan borang SIPP;
 *   - butir pustaka pertimbangan yang SUDAH DISAHKAN (opsional, dari pemanggil) sebagai kalimat contoh.
 *
 * Aturan yang melekat:
 *   - DASAR HUKUM HANYA DARI RAK TERVERIFIKASI (lib/rak-peraturan bolehDisarankan). Rujukan yang belum terverifikasi TIDAK
 *     ditulis di kalimat; paragrafnya diberi tanda "[perlu dilengkapi: ...]" (bentuk yang dikenali deteksi sisa blangko).
 *     Rak berubah = draf berikutnya ikut berubah, tanpa sunting kode.
 *   - Teks para pihak dikutip APA ADANYA (keputusan 55): dalil tampil persis seperti di matriks; kalimat pertimbangan
 *     merujuk "dalil angka N", tidak merangkum ulang ucapan pihak.
 *   - Tidak menentukan arah: arah datang dari varian H-7 (majelis memilih). Bila penilaian pembuktian A2 bertentangan dengan
 *     arah varian, paragrafnya diberi tanda - tidak dibetulkan diam-diam.
 *   - Hasil = DRAF bertanda; tidak pernah ditulis ke SIPP/ABT. Isian yang diusulkan (#8503#, #8729#) masuk draf H-7 sebagai
 *     USULAN (isian hukum, satu ketukan manusia).
 *   - Tanpa kata "Aleta" di kalimat draf (keluarannya bisa disalin ke naskah).
 *
 * Murni: tanpa jaringan dan basis data; pemeriksa rak dapat disuntik untuk uji.
 */

import { susunAmar, type HasilAmar, type StatusAmar } from "@/lib/amar-dari-petitum";
import type { Dalil, MatriksDalil, PembuktianDalil } from "@/lib/matriks-dalil";
import { KATALOG_ALASAN, UNSUR_UPAYA_DAMAI, unsurDibahas, type UnsurAlasan } from "@/lib/putusan-advance";
import { tandaPerlu } from "@/lib/putusan-advance-draf";
import { hurufAlasan } from "@/lib/set-pertanyaan-saksi";

export const VERSI_DRAF_A1 = 1;

/** Arah varian: dari varian H-7 (dikabulkan/ditolak); NO hanya bila pemanggil menyatakannya. */
export type ArahDrafA1 = "dikabulkan" | "ditolak" | "tidak-dapat-diterima";

export type SaksiA1 = {
  pihak: "P" | "T";
  /** Urutan saksi pada pihaknya (1, 2, ...). */
  ke: number;
  tanyaJawab: Array<{ tanya: string; jawab: string }>;
};

export type ButirPustakaA1 = { id: string; teks: string; labelAlasan: string[] };

export type PemeriksaRak = (teksRujukan: string) => { boleh: boolean; sebab: string };

export type MasukanDrafA1 = {
  jenisPerkara: string;
  nomorPerkara: string;
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  arah: ArahDrafA1;
  verstek: boolean;
  sebutan: { P: string; T: string };
  namaPihak1: string[];
  namaPihak2: string[];
  /** Nama satker tanpa "Pengadilan Agama". */
  satker: string;
  prodeo?: boolean;
  biaya?: number | null;
  biayaTerbilang?: string;
  tahunDaftar?: number | null;
  /** Petitum SIPP (HTML). */
  petitum: string;
  matriks: MatriksDalil | null;
  saksi: SaksiA1[];
  /** Baris bukti surat yang dicatat petugas (#1214# P, #9911# T). */
  bukti: { P: string[]; T: string[] };
  /** #8503# bila sudah diisi petugas (huruf pilihan majelis menang atas huruf dari dalil). */
  hurufAbt?: string;
  /** #9944# / #0246# lama pisah bila ada (dipakai apa adanya). */
  lamaPisah?: string;
  /** Kesimpulan tercatat (#8436#/#8437#): hanya ada/tidaknya yang dipakai - isinya tidak dirangkum. */
  kesimpulan?: { P?: boolean; T?: boolean };
  /** Perkara e-Court (putusan diucapkan elektronik). null = tidak diketahui. */
  lewatEcourt?: boolean | null;
  /** Mediasi: "gagal" (dilaksanakan, tidak berhasil), "sebagian", "berhasil", "" = tidak ada / tidak wajib. */
  mediasi?: "gagal" | "sebagian" | "berhasil" | "";
  /** Butir pustaka pertimbangan yang SUDAH DISAHKAN (opsional). */
  pustaka?: ButirPustakaA1[];
  /** Pemeriksa rak (bawaan: rak terverifikasi P1). */
  periksaRak?: PemeriksaRak;
};

export type KunciBagianA1 =
  | "pokok"
  | "kehadiran"
  | "damai"
  | "alasan"
  | "jawaban"
  | "beban"
  | "bukti"
  | "saksi"
  | "dalil"
  | "fakta"
  | "penilaian"
  | "biaya"
  | "elektronik"
  | "penutup";

export type AsalParagrafA1 = "kerangka" | "dalil" | "saksi" | "bukti" | "pembuktian" | "pustaka";

export type ParagrafA1 = {
  teks: string;
  asal: AsalParagrafA1;
  /** Kalimat "[perlu dilengkapi: ...]" yang menyertai paragraf ini (merah di naskah). */
  tanda: string[];
  /** Id dalil yang dirujuk paragraf ini. */
  dalil?: string[];
};

export type BagianA1 = { kunci: KunciBagianA1; judul: string; paragraf: ParagrafA1[] };

export type StatusPembuktianA1 = PembuktianDalil["status"] | "belum-dinilai";

export type DalilA1 = {
  id: string;
  nomor: string;
  sumber: Dalil["sumber"];
  sebutan: string;
  /** Teks dalil APA ADANYA (keputusan 55). */
  teks: string;
  huruf: string[];
  tanggapan: string;
  pembuktian: StatusPembuktianA1;
  catatanPembuktian: string;
  /** Saksi yang keterangannya bertumpang kata dengan dalil ini (bahan, bukan penilaian). */
  saksi: Array<{ pihak: "P" | "T"; ke: number; skor: number }>;
};

export type DasarA1 = { teks: string; terverifikasi: boolean; sebab: string; untuk: KunciBagianA1 };

export type UnsurA1 = {
  huruf: string;
  kode: string;
  /** Label unsur dari katalog Putusan Advance (tampilan). */
  nama: string;
  /** Frasa benda untuk kalimat ("perselisihan dan pertengkaran yang terus-menerus"). */
  frasa: string;
  /** Kalimat fakta hukum ("" = bukan fakta, mis. keluarga didengar). {P}/{T} = sebutan pihak. */
  fakta: string;
  saksi: Array<{ pihak: "P" | "T"; ke: number }>;
};

/**
 * Kalimat per unsur alasan (kode = katalog KATALOG_ALASAN/UNSUR_UPAYA_DAMAI). Label katalog adalah nama pemeriksa
 * ("telah berpisah tempat tinggal (SEMA 1/2022 ...)") - bukan kalimat naskah dan memuat rujukan yang belum tentu
 * terverifikasi, jadi tidak pernah ditulis ke kalimat draf. Tanpa subjek pelaku bila huruf dapat dilakukan suami atau istri.
 */
export const KALIMAT_UNSUR: Record<string, { frasa: string; fakta: string }> = {
  "a-perbuatan": { frasa: "perbuatan zina, mabuk, madat, judi, atau sejenisnya", fakta: "terdapat perbuatan zina, mabuk, madat, judi, atau sejenisnya dalam rumah tangga {P} dan {T}" },
  "a-sukar": { frasa: "kebiasaan yang sukar disembuhkan", fakta: "perbuatan tersebut menjadi kebiasaan yang sukar disembuhkan" },
  "b-dua-tahun": { frasa: "kepergian selama dua tahun berturut-turut", fakta: "salah satu pihak telah meninggalkan pihak lain selama dua tahun berturut-turut" },
  "b-tanpa-izin": { frasa: "kepergian tanpa izin", fakta: "kepergian tersebut tanpa izin pihak lain" },
  "b-tanpa-alasan": { frasa: "kepergian tanpa alasan yang sah", fakta: "kepergian tersebut tanpa alasan yang sah" },
  "b-tidak-kembali": { frasa: "pihak yang pergi tidak kembali", fakta: "pihak yang pergi tidak kembali dan tidak diketahui kabarnya" },
  "c-penjara": { frasa: "hukuman penjara", fakta: "salah satu pihak menjalani hukuman penjara" },
  "c-lima-tahun": { frasa: "hukuman lima tahun atau lebih", fakta: "hukuman tersebut lima tahun atau lebih" },
  "c-sesudah-nikah": { frasa: "hukuman setelah perkawinan", fakta: "hukuman tersebut dijatuhkan setelah perkawinan berlangsung" },
  "d-kekerasan": { frasa: "kekejaman atau penganiayaan", fakta: "terjadi kekejaman atau penganiayaan dalam rumah tangga {P} dan {T}" },
  "d-bahaya": { frasa: "perbuatan yang membahayakan", fakta: "perbuatan tersebut membahayakan pihak lain" },
  "e-cacat": { frasa: "cacat badan atau penyakit", fakta: "salah satu pihak mengalami cacat badan atau penyakit" },
  "e-kewajiban": { frasa: "tidak dapat menjalankan kewajiban", fakta: "akibatnya tidak dapat menjalankan kewajiban sebagai suami atau istri" },
  "f-selisih": { frasa: "perselisihan dan pertengkaran yang terus-menerus", fakta: "antara {P} dan {T} terjadi perselisihan dan pertengkaran secara terus-menerus" },
  "f-rukun": { frasa: "tidak adanya harapan hidup rukun lagi", fakta: "{P} dan {T} sudah tidak ada harapan untuk hidup rukun lagi" },
  "f-pisah": { frasa: "pisah tempat tinggal", fakta: "{P} dan {T} telah berpisah tempat tinggal" },
  "f-keluarga": { frasa: "", fakta: "" },
  "g-taklik": { frasa: "sighat taklik talak", fakta: "suami mengucapkan sighat taklik talak sesudah akad nikah" },
  "g-langgar": { frasa: "pelanggaran sighat taklik talak", fakta: "suami melanggar sighat taklik talak" },
  "g-iwadh": { frasa: "pembayaran uang iwadh", fakta: "uang iwadh telah dibayar" },
  "h-murtad": { frasa: "peralihan agama", fakta: "terjadi peralihan agama (murtad)" },
  "h-tidak-rukun": { frasa: "ketidakrukunan karena peralihan agama", fakta: "peralihan agama tersebut menyebabkan ketidakrukunan dalam rumah tangga" },
  damai: { frasa: "upaya merukunkan yang tidak berhasil", fakta: "pihak keluarga telah berupaya merukunkan {P} dan {T} namun tidak berhasil" },
};

const kalimatUnsur = (u: UnsurAlasan) => KALIMAT_UNSUR[u.kode] ?? { frasa: u.nama.replace(/\s*\([^)]*\)/g, "").trim(), fakta: u.nama.replace(/\s*\([^)]*\)/g, "").trim() };

export type IsianA1 = { kode: string; nama: string; nilai: string; alasan: string };

export type DrafPutusanA1 = {
  versi: number;
  arah: ArahDrafA1;
  verstek: boolean;
  /** Huruf alasan yang dipakai draf dan asalnya. */
  huruf: string;
  hurufAsal: "abt" | "pembuktian" | "dalil" | "";
  bagian: BagianA1[];
  dalil: DalilA1[];
  unsur: UnsurA1[];
  amar: Pick<HasilAmar, "ok" | "status" | "butir" | "html" | "pertanyaan" | "catatan">;
  dasar: DasarA1[];
  isian: IsianA1[];
  /** Semua tanda (per paragraf + umum), urut, tanpa kembar. */
  tanda: string[];
  pembuktian: { dalil: number; dinilai: number; terbukti: number; belum: number; bertentangan: number };
  /** Naskah polos pertimbangan (paragraf + tanda) - bahan baca, pemeriksa kutipan, ALETA Ai. */
  teksPertimbangan: string;
  /** Nama para pihak (dari SIPP) - disamarkan mesin sebelum bahan dikirim ke ALETA Ai. */
  namaSamaran: string[];
  ms: number;
};

const teks = (x: unknown) => String(x ?? "").trim();

// ============================================================================
// DASAR HUKUM - hanya yang terverifikasi di rak
// ============================================================================

/** Calon dasar hukum per bagian; masing-masing diperiksa rak saat draf disusun (urutan = urutan tulis). */
/*
 * Susunannya mengikuti blangko putusan cerai Derry (verstek / kontradiktoir) - diukur atas 10 putusan cerai PA Donggala yang
 * sudah putus (uji draf-putusan-a1-1nov): rujukan yang dipakai 6/6 putusan verstek dan 4/4 kontradiktoir ada di sini;
 * rujukan khusus kontradiktoir (perdamaian Pasal 154 RBg, PERMA 1/2016 Pasal 17, KHI Pasal 7 dan 115, Pasal 1870 KUHPerdata,
 * Pasal 1 UU 1/1974) hanya dipakai bila tidak verstek.
 */
export const CALON_DASAR = {
  nasihat: [
    "Pasal 39 ayat (1) Undang-Undang Nomor 1 Tahun 1974",
    "Pasal 65 Undang-Undang Nomor 7 Tahun 1989",
    "Pasal 82 ayat (1) dan ayat (4) Undang-Undang Nomor 7 Tahun 1989",
    "Pasal 31 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975",
  ],
  nasihatKontra: ["Pasal 39 ayat (1) Undang-Undang Nomor 1 Tahun 1974", "Pasal 65 Undang-Undang Nomor 7 Tahun 1989", "Pasal 82 ayat (1) dan ayat (4) Undang-Undang Nomor 7 Tahun 1989", "Pasal 115 Kompilasi Hukum Islam"],
  mediasiTidakWajib: ["Pasal 4 ayat (2) huruf b Peraturan Mahkamah Agung Nomor 1 Tahun 2016"],
  mediasi: ["Pasal 154 RBg", "Pasal 4 ayat (1) Peraturan Mahkamah Agung Nomor 1 Tahun 2016", "Pasal 17 Peraturan Mahkamah Agung Nomor 1 Tahun 2016"],
  verstek: ["Pasal 149 ayat (1) RBg"],
  beban: ["Pasal 283 RBg", "Pasal 1865 KUHPerdata"],
  buktiSurat: ["Pasal 285 RBg"],
  buktiSuratKontra: ["Pasal 285 RBg", "Pasal 1870 KUHPerdata"],
  aktaNikah: ["Pasal 7 ayat (1) Kompilasi Hukum Islam"],
  saksiFormil: ["Pasal 172 ayat (1) RBg"],
  saksiMateril: ["Pasal 308 RBg", "Pasal 309 RBg"],
  pecah: ["Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974"],
  pecahKontra: ["Pasal 1 Undang-Undang Nomor 1 Tahun 1974", "Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974"],
  talakBain: ["Pasal 119 ayat (2) huruf c Kompilasi Hukum Islam"],
  biaya: ["Pasal 89 ayat (1) Undang-Undang Nomor 7 Tahun 1989"],
  biayaKalah: ["Pasal 192 ayat (1) RBg"],
  elektronik: ["Pasal 26 Peraturan Mahkamah Agung Nomor 1 Tahun 2019"],
  pns: ["Pasal 3 ayat (1) Peraturan Pemerintah Nomor 10 Tahun 1983"],
  pisahSema: ["SEMA Nomor 1 Tahun 2022 jo. SEMA Nomor 3 Tahun 2023"],
} as const;

/** Huruf alasan -> rujukan PP 9/1975 dan KHI (diperiksa rak seperti yang lain). */
export function calonDasarHuruf(huruf: string): string[] {
  const h = huruf.toLowerCase();
  if (h === "g" || h === "h") return [`Pasal 116 huruf ${h} Kompilasi Hukum Islam`];
  return [`Pasal 19 huruf ${h} Peraturan Pemerintah Nomor 9 Tahun 1975`, `Pasal 116 huruf ${h} Kompilasi Hukum Islam`];
}

type HasilDasar = { tertulis: string; belum: string[] };

function pemeriksaDasar(periksa: PemeriksaRak, dasar: DasarA1[]) {
  const singgah = new Map<string, { boleh: boolean; sebab: string }>();
  return (calon: readonly string[], untuk: KunciBagianA1): HasilDasar => {
    const lolos: string[] = [];
    const belum: string[] = [];
    for (const c of calon) {
      let v = singgah.get(c);
      if (!v) {
        try {
          v = periksa(c);
        } catch {
          v = { boleh: false, sebab: "rak peraturan tidak terbaca" };
        }
        singgah.set(c, v);
      }
      if (!dasar.some((d) => d.teks === c && d.untuk === untuk)) dasar.push({ teks: c, terverifikasi: v.boleh, sebab: v.sebab, untuk });
      (v.boleh ? lolos : belum).push(c);
    }
    return { tertulis: lolos.join(" jo. "), belum };
  };
}

const tandaDasar = (belum: string[]) => (belum.length ? [tandaPerlu(`dasar hukum belum terverifikasi di rak peraturan, periksa dulu: ${belum.join("; ")}`)] : []);

// ============================================================================
// SAKSI x DALIL (bahan, bukan penilaian)
// ============================================================================

const KATA_ABAI = new Set(
  "yang dengan dan atau dari pada untuk dalam tidak telah sudah akan juga karena sejak sehingga tersebut bahwa adalah sebagai oleh lagi masih hanya saja ketika saat bila jika kalau maka namun tetapi antara selama setelah sebelum kepada terhadap bersama mereka kami saya beliau dirinya pernah sering selalu sangat lebih kurang hingga sampai baik juga itu ini ada para penggugat tergugat pemohon termohon saksi majelis hakim kedua pertama tahun bulan hari tanggal".split(
    " "
  )
);

/** Kata isi (huruf kecil, >= 4 huruf, tanpa kata sambung/sebutan). */
export function kataIsiA1(t: string): Set<string> {
  const out = new Set<string>();
  for (const k of String(t ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/)) {
    if (k.length >= 4 && !KATA_ABAI.has(k) && !/^\d+$/.test(k)) out.add(k);
  }
  return out;
}

/** Ambang tumpang kata dalil-jawaban saksi (diukur atas 10 perkara cerai PA Donggala, lihat uji draf-putusan-a1-1nov). */
export const AMBANG_SAKSI = { kata: 3, skor: 0.3 };

/** Skor tumpang: bagian kata isi dalil yang muncul pada satu jawaban saksi (yang terbaik). */
export function skorDalilSaksi(dalil: Set<string>, jawaban: Array<Set<string>>): { sama: number; skor: number } {
  let best = { sama: 0, skor: 0 };
  if (!dalil.size) return best;
  for (const j of jawaban) {
    let sama = 0;
    for (const k of dalil) if (j.has(k)) sama += 1;
    const skor = sama / dalil.size;
    if (skor > best.skor || (skor === best.skor && sama > best.sama)) best = { sama, skor };
  }
  return best;
}

// ============================================================================
// PENYUSUN
// ============================================================================

const JUDUL_BAGIAN: Record<KunciBagianA1, string> = {
  pokok: "Pokok gugatan",
  kehadiran: "Kehadiran para pihak",
  damai: "Upaya damai dan mediasi",
  alasan: "Alasan perceraian yang didalilkan",
  jawaban: "Jawaban",
  beban: "Beban pembuktian",
  bukti: "Bukti surat",
  saksi: "Keterangan saksi",
  dalil: "Pembuktian per dalil",
  fakta: "Fakta hukum",
  penilaian: "Penilaian majelis",
  biaya: "Biaya perkara",
  elektronik: "Persidangan elektronik",
  penutup: "Penutup",
};

const POLA_PNS = /pegawai\s+negeri\s+sipil|\bPNS\b|aparatur\s+sipil\s+negara|\bASN\b/i;
const POLA_IDENTITAS = /melangsungkan\s+(?:perkawinan|pernikahan)|kutipan\s+akta\s+nikah|(?:biaya|ongkos)\s+(?:yang\s+timbul|perkara)|mengajukan\s+gugatan\s+ini|cukup\s+alasan|sanggup\s+membayar/i;

/** Kode bukti surat dari baris #1214# ("P.1 Fotokopi ...", "P-2", "1. Fotokopi ..." -> P.1). */
export function kodeBukti(baris: string[], awalan: "P" | "T"): string[] {
  const out: string[] = [];
  baris.forEach((b, i) => {
    const m = /^\s*(?:bukti\s+)?([PT])\s*[.\-]?\s*(\d{1,3})\b/i.exec(b);
    out.push(m ? `${m[1].toUpperCase()}.${m[2]}` : `${awalan}.${i + 1}`);
  });
  return [...new Set(out)];
}

function daftarKata(x: string[]): string {
  if (x.length <= 1) return x.join("");
  if (x.length === 2) return `${x[0]} dan ${x[1]}`;
  return `${x.slice(0, -1).join(", ")}, dan ${x[x.length - 1]}`;
}

const rentangBukti = (kode: string[]) => (kode.length > 2 ? `${kode[0]} sampai dengan ${kode[kode.length - 1]}` : daftarKata(kode));

const angka: Record<number, string> = { 1: "satu", 2: "dua", 3: "tiga", 4: "empat", 5: "lima", 6: "enam", 7: "tujuh", 8: "delapan", 9: "sembilan", 10: "sepuluh" };
const sebutJumlah = (n: number) => (angka[n] ? `${n} (${angka[n]})` : String(n));

/** Huruf alasan draf: pilihan petugas (#8503#) > huruf dalil yang dinilai terbukti (A2) > huruf dalil gugatan. */
export function hurufDraf(m: Pick<MasukanDrafA1, "hurufAbt" | "matriks">): { huruf: string; asal: DrafPutusanA1["hurufAsal"] } {
  const abt = hurufAlasan(teks(m.hurufAbt));
  if (abt) return { huruf: abt, asal: "abt" };
  const dalil = (m.matriks?.dalil ?? []).filter((d) => d.jenis === "posita-fakta" && (d.sumber === "gugatan" || d.sumber === "rekonvensi"));
  const terbukti = [...new Set(dalil.filter((d) => d.pembuktian?.status === "terbukti").flatMap((d) => d.huruf ?? []))].filter((h) => /^[A-H]$/.test(h)).sort().join("");
  if (terbukti) return { huruf: terbukti, asal: "pembuktian" };
  const semua = [...new Set(dalil.flatMap((d) => d.huruf ?? []))].filter((h) => /^[A-H]$/.test(h)).sort().join("");
  return semua ? { huruf: semua, asal: "dalil" } : { huruf: "", asal: "" };
}

const STATUS_AMAR: Record<ArahDrafA1, StatusAmar> = { dikabulkan: "dikabulkan", ditolak: "ditolak", "tidak-dapat-diterima": "tidak-dapat-diterima" };

const TEKS_TANGGAPAN: Record<string, string> = {
  diakui: "diakui",
  dibantah: "dibantah",
  "diakui-sebagian": "diakui sebagian",
  "tidak-jelas": "tanggapan tidak jelas",
  "tidak-ditanggapi": "tidak ditanggapi",
  "belum-dijawab": "belum dijawab",
};

const TEKS_BUKTI: Record<StatusPembuktianA1, string> = {
  terbukti: "terbukti",
  "belum-terbukti": "belum terbukti",
  bertentangan: "bukti bertentangan",
  "tidak-perlu-dibuktikan": "tidak perlu dibuktikan",
  "": "belum dinilai",
  "belum-dinilai": "belum dinilai",
};

/**
 * Menyusun draf pertimbangan & amar satu varian. Tidak pernah melempar galat untuk bahan yang kurang: bagian yang tidak
 * berbahan diberi tanda.
 */
export function susunDrafPutusanA1(m: MasukanDrafA1, periksaBawaan?: PemeriksaRak): DrafPutusanA1 {
  const mulai = Date.now();
  const periksa: PemeriksaRak = m.periksaRak ?? periksaBawaan ?? (() => ({ boleh: false, sebab: "rak peraturan tidak tersedia" }));
  const dasar: DasarA1[] = [];
  const pakai = pemeriksaDasar(periksa, dasar);
  const P = m.sebutan.P || "Penggugat";
  const T = m.sebutan.T || "Tergugat";
  const gugatan = P === "Pemohon" ? "permohonan" : "gugatan";
  const bagian: BagianA1[] = [];
  const tambah = (kunci: KunciBagianA1, p: ParagrafA1) => {
    let b = bagian.find((x) => x.kunci === kunci);
    if (!b) bagian.push((b = { kunci, judul: JUDUL_BAGIAN[kunci], paragraf: [] }));
    b.paragraf.push(p);
  };
  const par = (t: string, asal: AsalParagrafA1 = "kerangka", tanda: string[] = [], dalilId?: string[]): ParagrafA1 => ({ teks: t, asal, tanda, ...(dalilId?.length ? { dalil: dalilId } : {}) });
  const umum: string[] = [];

  const hurufAwal = hurufDraf(m);
  const semuaDalil = m.matriks?.dalil ?? [];
  const dalilPokok = semuaDalil.filter((d) => d.jenis === "posita-fakta" && (d.sumber === "gugatan" || d.sumber === "rekonvensi") && !d.pembuka);
  const saksiP = m.saksi.filter((s) => s.pihak === "P" && s.tanyaJawab.length).sort((a, b) => a.ke - b.ke);
  const saksiT = m.saksi.filter((s) => s.pihak === "T" && s.tanyaJawab.length).sort((a, b) => a.ke - b.ke);
  const kataJawab = new Map<SaksiA1, Array<Set<string>>>(m.saksi.map((s) => [s, s.tanyaJawab.map((q) => kataIsiA1(q.jawab))]));
  const namaSaksi = (s: { pihak: "P" | "T"; ke: number }) => `saksi ${s.ke} ${s.pihak === "P" ? P : T}`;
  const saksiUnsur = (u: UnsurAlasan) => [...saksiP, ...saksiT].filter((s) => s.tanyaJawab.some((q) => unsurDibahas(u, q.jawab)));

  // Huruf dari dalil saja (belum dipilih petugas, belum dinilai A2) disaring keterangan saksi: huruf diusulkan bila sedikitnya
  // separuh unsurnya diterangkan dua saksi. Diukur atas 10 putusan cerai: kecocokan huruf dengan putusan akhir naik dari 1/9
  // (semua huruf dalil) ke 5/9; huruf yang tersaring disebut sebagai tanda, tidak dibuang diam-diam.
  let huruf = hurufAwal.huruf;
  const hurufAsal = hurufAwal.asal;
  if (hurufAsal === "dalil" && saksiP.length + saksiT.length > 0) {
    const kuat = huruf.split("").filter((h) => {
      const daftar = KATALOG_ALASAN[h]?.unsur ?? [];
      if (!daftar.length) return true;
      const tercakup = daftar.filter((u) => saksiUnsur(u).length >= 2).length;
      return tercakup >= Math.ceil(daftar.length / 2);
    });
    const tersaring = huruf.split("").filter((h) => !kuat.includes(h));
    if (kuat.length && tersaring.length) {
      huruf = kuat.join("");
      umum.push(tandaPerlu(`huruf ${daftarKata(tersaring.map((h) => h.toLowerCase()))} juga didalilkan tetapi unsurnya belum diterangkan dua saksi - tidak diusulkan`));
    }
  }

  // ── Dalil x saksi x pembuktian ────────────────────────────────────────────
  const dalil: DalilA1[] = dalilPokok.map((d) => {
    const k = kataIsiA1(d.teks);
    const saksi: DalilA1["saksi"] = [];
    for (const s of [...saksiP, ...saksiT]) {
      const sk = skorDalilSaksi(k, kataJawab.get(s) ?? []);
      if (sk.sama >= AMBANG_SAKSI.kata && sk.skor >= AMBANG_SAKSI.skor) saksi.push({ pihak: s.pihak, ke: s.ke, skor: Math.round(sk.skor * 100) / 100 });
    }
    const st = d.pembuktian?.status;
    return {
      id: d.id,
      nomor: d.nomor,
      sumber: d.sumber,
      sebutan: d.sebutan,
      teks: d.teks,
      huruf: (d.huruf ?? []).filter((h) => /^[A-H]$/.test(h)),
      tanggapan: d.tanggapan ? TEKS_TANGGAPAN[d.tanggapan.status] ?? d.tanggapan.status : "",
      pembuktian: st ? st : "belum-dinilai",
      catatanPembuktian: teks(d.pembuktian?.catatan),
      saksi,
    };
  });
  const hitungBukti = {
    dalil: dalil.length,
    dinilai: dalil.filter((d) => d.pembuktian !== "belum-dinilai").length,
    terbukti: dalil.filter((d) => d.pembuktian === "terbukti" || d.pembuktian === "tidak-perlu-dibuktikan").length,
    belum: dalil.filter((d) => d.pembuktian === "belum-terbukti").length,
    bertentangan: dalil.filter((d) => d.pembuktian === "bertentangan").length,
  };

  // ── Unsur huruf alasan x saksi ────────────────────────────────────────────
  const cerai = /cerai/i.test(m.jenisPerkara);
  const daftarUnsur: Array<{ huruf: string; u: UnsurAlasan }> = [];
  for (const h of huruf.split("").filter(Boolean)) for (const u of KATALOG_ALASAN[h]?.unsur ?? []) if (!daftarUnsur.some((x) => x.u.kode === u.kode)) daftarUnsur.push({ huruf: h, u });
  if (cerai && huruf) daftarUnsur.push({ huruf: "", u: UNSUR_UPAYA_DAMAI });
  const unsur: UnsurA1[] = daftarUnsur.map(({ huruf: h, u }) => ({
    huruf: h,
    kode: u.kode,
    nama: u.nama,
    frasa: kalimatUnsur(u).frasa,
    fakta: kalimatUnsur(u).fakta.replace(/\{P\}/g, P).replace(/\{T\}/g, T),
    saksi: saksiUnsur(u).map((s) => ({ pihak: s.pihak, ke: s.ke })),
  }));

  // ── 1. Pokok ──────────────────────────────────────────────────────────────
  tambah("pokok", par(`Menimbang, bahwa maksud dan tujuan ${gugatan} ${P} adalah sebagaimana diuraikan di atas;`));

  // ── 2. Kehadiran ──────────────────────────────────────────────────────────
  if (m.verstek) {
    tambah(
      "kehadiran",
      par(
        `Menimbang, bahwa pada hari sidang yang telah ditetapkan ${P} hadir di persidangan, sedangkan ${T} tidak hadir dan tidak pula menyuruh orang lain sebagai wakil atau kuasanya, meskipun telah dipanggil secara resmi dan patut, dan ketidakhadirannya tidak disebabkan oleh suatu alasan yang sah;`
      )
    );
    const v = pakai(CALON_DASAR.verstek, "kehadiran");
    tambah(
      "kehadiran",
      par(
        `Menimbang, bahwa ${v.tertulis ? `berdasarkan ${v.tertulis}, ` : ""}${gugatan} yang diperiksa tanpa hadirnya ${T} (verstek) dapat dikabulkan sepanjang berdasarkan hukum dan beralasan, oleh karena itu ${P} tetap dibebani membuktikan dalil-dalil ${gugatan}nya;`,
        "kerangka",
        tandaDasar(v.belum)
      )
    );
  } else {
    tambah("kehadiran", par(`Menimbang, bahwa pada hari sidang yang telah ditetapkan ${P} dan ${T} hadir di persidangan;`));
  }

  // ── 3. Damai & mediasi ────────────────────────────────────────────────────
  if (cerai || m.arah !== "tidak-dapat-diterima") {
    const n = pakai(m.verstek ? CALON_DASAR.nasihat : CALON_DASAR.nasihatKontra, "damai");
    tambah(
      "damai",
      par(
        `Menimbang, bahwa Majelis Hakim telah berusaha menasihati ${m.verstek ? P : `${P} dan ${T}`} agar ${cerai ? "tidak bercerai" : "menyelesaikan perkaranya secara damai"}${n.tertulis ? `, sebagaimana maksud ${n.tertulis}` : ""}, akan tetapi tidak berhasil;`,
        "kerangka",
        tandaDasar(n.belum)
      )
    );
  }
  if (m.verstek) {
    const d = pakai(CALON_DASAR.mediasiTidakWajib, "damai");
    tambah("damai", par(`Menimbang, bahwa oleh karena ${T} tidak pernah hadir di persidangan, mediasi tidak dapat dilaksanakan${d.tertulis ? `, sesuai ${d.tertulis}` : ""};`, "kerangka", tandaDasar(d.belum)));
  } else if (m.mediasi === "gagal" || m.mediasi === "sebagian") {
    const d = pakai(CALON_DASAR.mediasi, "damai");
    tambah(
      "damai",
      par(
        `Menimbang, bahwa para pihak telah menempuh mediasi${d.tertulis ? ` sesuai ${d.tertulis}` : ""}, namun ${m.mediasi === "sebagian" ? "hanya berhasil sebagian" : "tidak berhasil"} sebagaimana laporan mediator;`,
        "kerangka",
        [...tandaDasar(d.belum), ...(m.mediasi === "sebagian" ? [tandaPerlu("kesepakatan sebagian hasil mediasi dimuat dalam pertimbangan dan amar - isi dari laporan mediator")] : [])]
      )
    );
  } else if (!m.verstek) {
    tambah("damai", par(`Menimbang, bahwa para pihak telah menempuh mediasi, namun tidak berhasil;`, "kerangka", [tandaPerlu("hasil mediasi belum terbaca dari SIPP - sesuaikan dengan laporan mediator")]));
  }

  // ── PNS (dalil gugatan menyebut pegawai negeri) ───────────────────────────
  const dalilPns = dalilPokok.filter((d) => POLA_PNS.test(d.teks));
  if (cerai && dalilPns.length) {
    const d = pakai(CALON_DASAR.pns, "pokok");
    tambah(
      "pokok",
      par(
        `Menimbang, bahwa ${gugatan} ${P} menyebut pihak berstatus pegawai negeri sipil (dalil angka ${daftarKata(dalilPns.map((x) => x.nomor).filter(Boolean))}), maka izin atau surat keterangan atasan diperiksa${d.tertulis ? ` sesuai ${d.tertulis}` : ""};`,
        "dalil",
        [...tandaDasar(d.belum), tandaPerlu("pastikan izin atau surat keterangan atasan bagi pegawai negeri sipil sudah ada di berkas")],
        dalilPns.map((x) => x.id)
      )
    );
  }

  // ── 4. Alasan yang didalilkan ─────────────────────────────────────────────
  if (cerai) {
    const perHuruf = huruf.split("").filter(Boolean);
    if (!perHuruf.length) {
      tambah("alasan", par(`Menimbang, bahwa alasan perceraian yang didalilkan ${P} adalah sebagaimana posita ${gugatan};`, "kerangka", [tandaPerlu("huruf alasan perceraian belum terbaca dari dalil maupun isian - pilih huruf alasan")]));
    }
    for (const h of perHuruf) {
      const kat = KATALOG_ALASAN[h];
      const dalilH = dalil.filter((d) => d.huruf.includes(h));
      const nomor = dalilH.map((d) => d.nomor).filter(Boolean);
      const ds = pakai(calonDasarHuruf(h), "alasan");
      tambah(
        "alasan",
        par(
          `Menimbang, bahwa ${P} mendalilkan ${kat ? kat.judul : `alasan huruf ${h.toLowerCase()}`}${nomor.length ? ` (dalil angka ${daftarKata(nomor)} ${gugatan})` : ""}, sehingga ${gugatan} ${P} secara normatif didasarkan pada ${ds.tertulis || `alasan huruf ${h.toLowerCase()}`};`,
          "dalil",
          [...tandaDasar(ds.belum), ...(dalilH.length ? [] : [tandaPerlu(`huruf ${h} dipilih petugas tetapi tidak ditemukan pada dalil ${gugatan} - periksa posita`)])],
          dalilH.map((d) => d.id)
        )
      );
      for (const b of (m.pustaka ?? []).filter((x) => x.labelAlasan.map((y) => y.toUpperCase()).includes(h)).slice(0, 2)) {
        tambah("alasan", par(b.teks, "pustaka", [tandaPerlu("kalimat contoh dari pustaka pertimbangan yang disahkan - sesuaikan dengan perkara ini")]));
      }
    }
  } else {
    tambah("alasan", par(`Menimbang, bahwa pokok ${gugatan} ${P} adalah sebagaimana dalil-dalil ${gugatan} tersebut;`, "kerangka", [tandaPerlu("pertimbangan pokok perkara jenis ini disusun majelis")]));
  }

  // ── 5. Jawaban (kontradiktoir) ────────────────────────────────────────────
  if (!m.verstek) {
    const berstatus = dalil.filter((d) => d.tanggapan && d.tanggapan !== "belum dijawab");
    const per = (s: string) => berstatus.filter((d) => d.tanggapan === s).map((d) => d.nomor).filter(Boolean);
    const diakui = per("diakui");
    const dibantah = per("dibantah");
    const sebagian = per("diakui sebagian");
    if (berstatus.length) {
      const bagianT = [
        diakui.length ? `mengakui dalil angka ${daftarKata(diakui)}` : "",
        sebagian.length ? `mengakui sebagian dalil angka ${daftarKata(sebagian)}` : "",
        dibantah.length ? `membantah dalil angka ${daftarKata(dibantah)}` : "",
      ].filter(Boolean);
      tambah(
        "jawaban",
        par(
          `Menimbang, bahwa atas ${gugatan} tersebut ${T} telah memberikan jawaban${bagianT.length ? ` yang pada pokoknya ${daftarKata(bagianT)}` : ""}; dalil yang diakui secara tegas tidak perlu dibuktikan lagi, sedangkan dalil yang dibantah tetap harus dibuktikan;`,
          "dalil",
          dalil.some((d) => d.tanggapan && semuaDalil.find((x) => x.id === d.id)?.tanggapan?.ragu) ? [tandaPerlu("sebagian tanggapan dibaca ragu dari jawaban - cocokkan dengan berkas jawaban")] : [],
          berstatus.map((d) => d.id)
        )
      );
    } else {
      tambah("jawaban", par(`Menimbang, bahwa atas ${gugatan} tersebut ${T} telah memberikan jawaban sebagaimana tercatat dalam berita acara sidang;`, "kerangka", [tandaPerlu("jawaban belum terbaca per dalil - lengkapi dari berkas jawaban")]));
    }
  }

  // ── 6. Beban pembuktian ───────────────────────────────────────────────────
  {
    const b = pakai(CALON_DASAR.beban, "beban");
    tambah(
      "beban",
      par(
        m.verstek && cerai
          ? `Menimbang, bahwa meskipun ${T} tidak hadir, oleh karena perkara ini perkara perceraian, ${P} tetap wajib membuktikan alasan-alasan perceraiannya${b.tertulis ? ` sesuai ${b.tertulis}` : ""};`
          : `Menimbang, bahwa ${b.tertulis ? `berdasarkan ${b.tertulis}, ` : ""}${P} wajib membuktikan dalil-dalil yang dibantah, sedangkan ${T} wajib membuktikan dalil bantahannya;`,
        "kerangka",
        tandaDasar(b.belum)
      )
    );
  }

  // ── 7. Bukti surat ────────────────────────────────────────────────────────
  const kodeP = kodeBukti(m.bukti.P, "P");
  const iNikah = m.bukti.P.findIndex((x) => /akta\s+nikah|buku\s+nikah|duplikat\s+(?:kutipan\s+)?akta/i.test(x));
  const kodeT = kodeBukti(m.bukti.T, "T");
  const jumlahSaksi = (n: number) => (n ? `${sebutJumlah(n)} orang saksi` : "");
  const ajuP = [kodeP.length ? `bukti surat ${rentangBukti(kodeP)}` : "", jumlahSaksi(saksiP.length)].filter(Boolean);
  tambah(
    "bukti",
    par(
      ajuP.length ? `Menimbang, bahwa untuk membuktikan dalil-dalilnya, ${P} telah mengajukan ${ajuP.join(" serta ")};` : `Menimbang, bahwa ${P} belum tercatat mengajukan alat bukti;`,
      "bukti",
      ajuP.length ? [] : [tandaPerlu("alat bukti belum dicatat - isi daftar bukti dan pemeriksaan saksi")]
    )
  );
  if (kodeP.length || kodeT.length) {
    const s = pakai(m.verstek ? CALON_DASAR.buktiSurat : CALON_DASAR.buktiSuratKontra, "bukti");
    tambah(
      "bukti",
      par(
        `Menimbang, bahwa bukti ${rentangBukti([...kodeP, ...kodeT])} berupa fotokopi yang telah bermeterai cukup dan dicocokkan dengan aslinya, isinya relevan dengan pokok perkara, sehingga memenuhi syarat formil dan materiil sebagai alat bukti${s.tertulis ? ` sesuai ${s.tertulis}` : ""};`,
        "bukti",
        [...tandaDasar(s.belum), tandaPerlu("periksa bukti yang tidak dapat dicocokkan dengan aslinya")]
      )
    );
    // Kutipan akta nikah: perkawinan sah dan wewenang absolut (blangko kontradiktoir menyebut KHI Pasal 7).
    if (cerai && iNikah >= 0) {
      const an = m.verstek ? { tertulis: "", belum: [] as string[] } : pakai(CALON_DASAR.aktaNikah, "bukti");
      tambah(
        "bukti",
        par(
          `Menimbang, bahwa bukti ${kodeP[iNikah] ?? `${P.charAt(0)}.${iNikah + 1}`} membuktikan ${P} dan ${T} terikat perkawinan yang sah dan belum pernah bercerai${an.tertulis ? ` sesuai ${an.tertulis}` : ""}, sehingga perkara ini menjadi wewenang Pengadilan Agama;`,
          "bukti",
          tandaDasar(an.belum)
        )
      );
    }
  }
  if (!m.verstek && (kodeT.length || saksiT.length)) {
    const ajuT = [kodeT.length ? `bukti surat ${rentangBukti(kodeT)}` : "", jumlahSaksi(saksiT.length)].filter(Boolean);
    tambah("bukti", par(`Menimbang, bahwa untuk membuktikan dalil bantahannya, ${T} telah mengajukan ${ajuT.join(" serta ")};`, "bukti"));
  }

  // ── 8. Saksi ──────────────────────────────────────────────────────────────
  const saksiPihak = (daftar: SaksiA1[], sebut: string) => {
    if (!daftar.length) return;
    const f = pakai(CALON_DASAR.saksiFormil, "saksi");
    tambah(
      "saksi",
      par(
        `Menimbang, bahwa ${sebutJumlah(daftar.length)} orang saksi ${sebut} telah memberikan keterangan di bawah sumpah di persidangan, sehingga secara formil keterangannya dapat diterima${f.tertulis ? ` sesuai ${f.tertulis}` : ""};`,
        "saksi",
        [...tandaDasar(f.belum), tandaPerlu("periksa syarat formil saksi: dewasa, disumpah, bukan orang yang terlarang menjadi saksi")]
      )
    );
    const keluargaDidengar = unsur.some((u) => u.kode === "f-keluarga" && u.saksi.some((s) => daftar.some((d) => d.pihak === s.pihak && d.ke === s.ke)));
    const relevan = unsur.filter((u) => u.frasa && u.saksi.some((s) => daftar.some((d) => d.pihak === s.pihak && d.ke === s.ke)));
    if (relevan.length) {
      const bersesuaian = relevan.filter((u) => u.saksi.filter((s) => daftar.some((d) => d.pihak === s.pihak)).length >= 2);
      const tunggal = relevan.filter((u) => !bersesuaian.includes(u));
      const mt = pakai(CALON_DASAR.saksiMateril, "saksi");
      tambah(
        "saksi",
        par(
          `Menimbang, bahwa keterangan saksi-saksi ${sebut} ${bersesuaian.length ? `saling bersesuaian mengenai ${daftarKata(bersesuaian.map((u) => u.frasa))}` : "tidak saling bersesuaian untuk unsur alasan yang didalilkan"}${
            tunggal.length ? `, sedangkan ${daftarKata(tunggal.map((u) => u.frasa))} hanya diterangkan oleh satu orang saksi` : ""
          }, berdasarkan apa yang dilihat dan didengar sendiri${keluargaDidengar ? `, dan saksi-saksi tersebut adalah keluarga atau orang dekat ${sebut}` : ""}${mt.tertulis ? `, sehingga secara materiil memenuhi ${mt.tertulis}` : ""};`,
          "saksi",
          [...tandaDasar(mt.belum), ...(tunggal.length ? [tandaPerlu("unsur yang hanya diterangkan satu saksi perlu didukung alat bukti lain")] : [])]
        )
      );
    } else if (huruf) {
      tambah("saksi", par(`Menimbang, bahwa keterangan saksi-saksi ${sebut} belum memuat unsur alasan yang didalilkan;`, "saksi", [tandaPerlu("keterangan saksi tidak memuat unsur huruf alasan - periksa keterangan saksi")]));
    }
  };
  saksiPihak(saksiP, P);
  if (!m.verstek) saksiPihak(saksiT, T);
  if (!saksiP.length && cerai) tambah("saksi", par(`Menimbang, bahwa ${P} belum mengajukan saksi;`, "saksi", [tandaPerlu("pemeriksaan saksi belum tercatat - perkara perceraian wajib mendengar keluarga atau orang dekat")]));
  if (m.kesimpulan?.P || m.kesimpulan?.T) {
    const siapa = [m.kesimpulan?.P ? P : "", m.kesimpulan?.T && !m.verstek ? T : ""].filter(Boolean);
    tambah("saksi", par(`Menimbang, bahwa ${daftarKata(siapa)} telah menyampaikan kesimpulan sebagaimana tercatat dalam berita acara sidang;`));
  }

  // ── 9. Pembuktian per dalil (status A2) ───────────────────────────────────
  const perluBukti = dalil.filter((d) => !POLA_IDENTITAS.test(d.teks) || d.huruf.length);
  if (perluBukti.length) {
    if (!hitungBukti.dinilai) umum.push(tandaPerlu("penilaian pembuktian per dalil belum dinilai - kalimat pembuktian mengikuti varian yang dipilih"));
    for (const d of perluBukti.filter((x) => x.huruf.length || x.pembuktian !== "belum-dinilai")) {
      const saksiD = d.saksi.length ? `; bahan: keterangan ${daftarKata(d.saksi.map((s) => namaSaksi(s)))}` : "";
      const tanda: string[] = [];
      if (d.pembuktian === "belum-dinilai") tanda.push(tandaPerlu(`pembuktian dalil angka ${d.nomor || "?"} belum dinilai`));
      if (m.arah === "dikabulkan" && (d.pembuktian === "belum-terbukti" || d.pembuktian === "bertentangan"))
        tanda.push(tandaPerlu(`dalil angka ${d.nomor || "?"} dinilai ${TEKS_BUKTI[d.pembuktian]} tetapi varian ini mengabulkan - periksa`));
      if (m.arah === "ditolak" && d.pembuktian === "terbukti") tanda.push(tandaPerlu(`dalil angka ${d.nomor || "?"} dinilai terbukti tetapi varian ini menolak - periksa`));
      tambah(
        "dalil",
        par(
          `Dalil angka ${d.nomor || "?"} ${d.sumber === "rekonvensi" ? "rekonvensi" : gugatan} (${d.huruf.length ? `huruf ${d.huruf.join(", ").toLowerCase()}` : "pendukung"}${d.tanggapan ? `, ${d.tanggapan}` : ""}): ${TEKS_BUKTI[d.pembuktian]}${d.catatanPembuktian ? ` - ${d.catatanPembuktian}` : ""}${saksiD}.`,
          "pembuktian",
          tanda,
          [d.id]
        )
      );
    }
  }

  // ── 10. Fakta hukum (dari unsur yang dikuatkan) ───────────────────────────
  const unsurKuat = unsur.filter((u) => u.saksi.filter((s) => s.pihak === "P").length >= 2 || (!m.verstek && u.saksi.length >= 2));
  if (cerai && m.arah === "dikabulkan") {
    const fakta = [
      iNikah >= 0 ? `Bahwa ${P} dan ${T} adalah suami istri yang sah dan belum pernah bercerai (bukti ${kodeP[iNikah] ?? `${P.charAt(0)}.${iNikah + 1}`});` : "",
      ...unsurKuat
        .filter((u) => u.fakta)
        .map((u) => `Bahwa ${u.fakta}${u.kode === "f-pisah" && teks(m.lamaPisah) ? ` selama ${teks(m.lamaPisah)}` : ""} (keterangan ${daftarKata(u.saksi.map((s) => namaSaksi(s)))});`),
      ...(teks(m.lamaPisah) && !unsurKuat.some((u) => u.kode === "f-pisah") ? [`Bahwa ${P} dan ${T} telah berpisah tempat tinggal selama ${teks(m.lamaPisah)};`] : []),
    ].filter(Boolean);
    tambah("fakta", par(`Menimbang, bahwa berdasarkan bukti-bukti tersebut ditemukan fakta hukum sebagai berikut:`, "pembuktian", fakta.length ? [] : [tandaPerlu("fakta hukum belum dapat disusun - bahan pembuktian kurang")]));
    fakta.forEach((f, i) => tambah("fakta", par(`${i + 1}. ${f}`, "pembuktian")));
    const lemah = unsur.filter((u) => u.huruf && !unsurKuat.includes(u));
    if (lemah.length) umum.push(tandaPerlu(`unsur belum dikuatkan dua saksi: ${daftarKata(lemah.map((u) => u.frasa || u.nama))}`));
  }

  // ── 11. Penilaian ─────────────────────────────────────────────────────────
  const isian: IsianA1[] = [];
  if (cerai && m.arah === "dikabulkan") {
    const ds = huruf.split("").filter(Boolean).flatMap((h) => calonDasarHuruf(h));
    const f = huruf.includes("F");
    const pecah = f ? pakai([...(m.verstek ? CALON_DASAR.pecah : CALON_DASAR.pecahKontra), ...ds], "penilaian") : pakai(ds, "penilaian");
    if (f && (unsur.some((u) => u.kode === "f-pisah" && u.saksi.length) || teks(m.lamaPisah))) {
      const sema = pakai(CALON_DASAR.pisahSema, "penilaian");
      tambah(
        "penilaian",
        par(
          `Menimbang, bahwa perkara perceraian dengan alasan perselisihan dan pertengkaran terus-menerus dapat dikabulkan apabila terbukti suami istri berselisih dan bertengkar terus-menerus atau telah berpisah tempat tinggal paling singkat 6 (enam) bulan${teks(m.lamaPisah) ? `, sedangkan ${P} dan ${T} telah berpisah selama ${teks(m.lamaPisah)}` : ""};`,
          "kerangka",
          tandaDasar(sema.belum)
        )
      );
    }
    tambah(
      "penilaian",
      par(
        `Menimbang, bahwa atas dasar pertimbangan tersebut, Majelis Hakim berpendapat alasan perceraian ${huruf ? `huruf ${daftarKata(huruf.split("").map((h) => h.toLowerCase()))} ` : ""}telah terbukti${f ? " dan rumah tangga " + P + " dan " + T + " telah pecah sehingga tidak ada harapan untuk hidup rukun kembali" : ""}${
          pecah.tertulis ? `, sehingga telah terpenuhi ketentuan ${pecah.tertulis}` : ""
        }, maka ${gugatan} ${P} patut dikabulkan${m.verstek ? " dengan verstek" : ""};`,
        "kerangka",
        [...tandaDasar(pecah.belum), ...(hitungBukti.belum + hitungBukti.bertentangan ? [tandaPerlu("ada dalil yang dinilai belum terbukti atau bertentangan - periksa sebelum mengabulkan")] : [])]
      )
    );
    if (/cerai\s+gugat/i.test(m.jenisPerkara)) {
      const tb = pakai(CALON_DASAR.talakBain, "penilaian");
      tambah("penilaian", par(`Menimbang, bahwa oleh karena perceraian ini terjadi atas gugatan istri, talak yang dijatuhkan Pengadilan adalah talak satu ba'in shughra${tb.tertulis ? ` sesuai ${tb.tertulis}` : ""};`, "kerangka", tandaDasar(tb.belum)));
    }
    if (huruf && hurufAsal !== "abt") isian.push({ kode: "8503", nama: "Alasan perceraian (huruf)", nilai: huruf, alasan: hurufAsal === "pembuktian" ? "huruf dalil yang dinilai terbukti" : "huruf yang ditemukan pada dalil gugatan" });
  } else if (cerai && m.arah === "ditolak") {
    const lemah = unsur.filter((u) => u.huruf && u.frasa && !unsurKuat.includes(u));
    const belumBukti = dalil.filter((d) => d.huruf.length && (d.pembuktian === "belum-terbukti" || d.pembuktian === "bertentangan"));
    const kalimat: string[] = [];
    if (lemah.length) kalimat.push(`Menimbang, bahwa ${daftarKata(lemah.map((u) => u.frasa))} tidak diterangkan oleh sekurang-kurangnya dua orang saksi yang saling bersesuaian, sehingga dalil tersebut tidak terbukti;`);
    for (const d of belumBukti) kalimat.push(`Menimbang, bahwa dalil angka ${d.nomor || "?"} ${gugatan} ${P} ${TEKS_BUKTI[d.pembuktian]}${d.catatanPembuktian ? ` karena ${d.catatanPembuktian.replace(/[.;]+$/, "")}` : ""};`);
    if (!kalimat.length) kalimat.push(`Menimbang, bahwa dalil-dalil ${gugatan} ${P} tentang alasan perceraian tidak terbukti;`);
    for (const k of kalimat) tambah("penilaian", par(k, "pembuktian", lemah.length || belumBukti.length ? [] : [tandaPerlu("sebab tidak terbuktinya dalil belum dinilai - tulis alasan penolakan")]));
    tambah("penilaian", par(`Menimbang, bahwa oleh karena alasan perceraian tidak terbukti, maka ${gugatan} ${P} harus ditolak;`));
    isian.push({ kode: "8729", nama: "Penilaian saksi dan fakta yang tidak terbukti", nilai: kalimat.join("\n"), alasan: "disusun dari unsur yang tidak dikuatkan dua saksi dan penilaian pembuktian" });
  } else if (m.arah === "tidak-dapat-diterima") {
    tambah("penilaian", par(`Menimbang, bahwa oleh karena ${gugatan} ${P} tidak memenuhi syarat formil, maka ${gugatan} ${P} dinyatakan tidak dapat diterima;`, "kerangka", [tandaPerlu("sebab tidak dapat diterima ditentukan majelis - kabur, kurang pihak, kewenangan, atau tidak hadir")]));
  } else {
    tambah("penilaian", par(`Menimbang, bahwa atas dasar pertimbangan tersebut, ${gugatan} ${P} ${m.arah === "dikabulkan" ? "patut dikabulkan" : "harus ditolak"};`, "kerangka", [tandaPerlu("pertimbangan pokok perkara jenis ini disusun majelis")]));
  }

  // ── 12. Biaya ─────────────────────────────────────────────────────────────
  if (m.prodeo) {
    tambah("biaya", par(`Menimbang, bahwa oleh karena ${P} diizinkan berperkara secara cuma-cuma, biaya perkara dibebankan kepada DIPA Pengadilan Agama ${m.satker || "..."};`));
  } else if (cerai) {
    const b = pakai(CALON_DASAR.biaya, "biaya");
    tambah("biaya", par(`Menimbang, bahwa oleh karena perkara ini termasuk bidang perkawinan, ${b.tertulis ? `berdasarkan ${b.tertulis} ` : ""}biaya perkara dibebankan kepada ${P};`, "kerangka", tandaDasar(b.belum)));
  } else {
    const b = pakai(CALON_DASAR.biayaKalah, "biaya");
    tambah("biaya", par(`Menimbang, bahwa ${b.tertulis ? `berdasarkan ${b.tertulis}, ` : ""}biaya perkara dibebankan kepada pihak yang kalah;`, "kerangka", tandaDasar(b.belum)));
  }

  // ── 13. Elektronik ────────────────────────────────────────────────────────
  if (m.lewatEcourt) {
    const e = pakai(CALON_DASAR.elektronik, "elektronik");
    tambah("elektronik", par(`Menimbang, bahwa perkara ini diperiksa dan diadili secara elektronik, maka putusan diucapkan dan dikirim secara elektronik melalui sistem informasi pengadilan${e.tertulis ? ` sesuai ${e.tertulis}` : ""};`, "kerangka", tandaDasar(e.belum)));
  }

  // ── 14. Penutup ───────────────────────────────────────────────────────────
  tambah("penutup", par(`Mengingat segala peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;`));

  // ── Amar (penyusun amar borang SIPP) ──────────────────────────────────────
  const amar = susunAmar({
    jenisPerkara: m.jenisPerkara,
    nomorPerkara: m.nomorPerkara,
    alurPerkaraId: m.alurPerkaraId,
    jenisPerkaraId: m.jenisPerkaraId,
    status: STATUS_AMAR[m.arah],
    verstek: m.verstek,
    petitum: m.petitum,
    namaPihak1: m.namaPihak1,
    namaPihak2: m.namaPihak2,
    prodeo: m.prodeo,
    satker: m.satker,
    tahunDaftar: m.tahunDaftar,
    biaya: m.biaya,
    biayaTerbilang: m.biayaTerbilang,
  });
  if (!amar.ok) umum.push(tandaPerlu("amar belum dapat disusun dari petitum - susun amar"));
  if (!teks(m.petitum)) umum.push(tandaPerlu("petitum belum terbaca dari SIPP - amar hanya bentuk baku, periksa tiap butir petitum"));
  if (!m.namaPihak1.length || !m.namaPihak2.length) umum.push(tandaPerlu("nama para pihak belum terbaca dari SIPP - lengkapi nama di amar"));
  for (const q of amar.pertanyaan) umum.push(tandaPerlu(`amar: ${q.teks}`));

  // ── Rekonvensi ────────────────────────────────────────────────────────────
  if (semuaDalil.some((d) => d.sumber === "rekonvensi")) umum.push(tandaPerlu("ada gugatan rekonvensi - pertimbangan dan amar rekonvensi disusun majelis"));

  // Tanpa kata "Aleta" di kalimat draf.
  for (const b of bagian) for (const p of b.paragraf) p.teks = p.teks.replace(/\baleta\b/gi, "").replace(/\s{2,}/g, " ");

  const tanda = [...new Set([...bagian.flatMap((b) => b.paragraf.flatMap((p) => p.tanda)), ...umum])];
  const teksPertimbangan = bagian
    .filter((b) => b.kunci !== "dalil")
    .flatMap((b) => b.paragraf.flatMap((p) => [p.teks, ...p.tanda]))
    .concat(umum)
    .join("\n");
  return {
    versi: VERSI_DRAF_A1,
    arah: m.arah,
    verstek: m.verstek,
    huruf,
    hurufAsal,
    bagian,
    dalil,
    unsur,
    amar: { ok: amar.ok, status: amar.status, butir: amar.butir, html: amar.html, pertanyaan: amar.pertanyaan, catatan: amar.catatan },
    dasar,
    isian,
    tanda,
    pembuktian: hitungBukti,
    teksPertimbangan,
    namaSamaran: [...new Set([...m.namaPihak1, ...m.namaPihak2].map((x) => teks(x)).filter(Boolean))],
    ms: Date.now() - mulai,
  };
}

// ============================================================================
// RINGKAS UNTUK LAYAR (tanpa istilah teknis)
// ============================================================================

export type RingkasDrafA1 = { arah: ArahDrafA1; huruf: string; amar: number; tanda: number; dasarTerverifikasi: number; dasarBelum: number; belumDinilai: number };

export function ringkasDrafA1(d: DrafPutusanA1): RingkasDrafA1 {
  const unik = (ok: boolean) => new Set(d.dasar.filter((x) => x.terverifikasi === ok).map((x) => x.teks)).size;
  return { arah: d.arah, huruf: d.huruf, amar: d.amar.butir.length, tanda: d.tanda.length, dasarTerverifikasi: unik(true), dasarBelum: unik(false), belumDinilai: d.pembuktian.dalil - d.pembuktian.dinilai };
}

// ============================================================================
// PEMICU PERISTIWA - "begitu BAS kesimpulan selesai, atau agenda berikutnya musyawarah/putusan"
// ============================================================================

/** Jangkauan pemicu peristiwa: Hari Putusan sampai 14 hari ke depan (H-7 harian hanya 7). */
export const HARI_PERISTIWA_A1 = 14;
/** Paling banyak perkara per detak peristiwa (sisanya pada detak berikutnya). */
export const BATAS_PERISTIWA_A1 = 10;

export type BarisSidangPemicu = { perkaraId?: unknown; tanggalSidang?: unknown; agenda?: unknown; [k: string]: unknown };

export type SasaranPeristiwaA1<T extends BarisSidangPemicu> = {
  baris: T;
  sebab: "kesimpulan-selesai" | "agenda-putusan";
  /** Tanggal sidang sebelumnya (yang sudah berlangsung) - draf yang lebih tua darinya dibuat ulang. */
  sidangSebelum: string;
};

/**
 * Sidang Hari Putusan (agenda musyawarah/pembacaan putusan menurut `adalahHariPutusan`) dalam 0..14 hari ke depan yang sidang
 * sebelumnya SUDAH berlangsung (tanggalnya <= hari ini): artinya tundaan ke musyawarah sudah dicatat - biasanya sesudah BAS
 * kesimpulan. Disusun bila belum ada draf A1 untuk sidang itu atau drafnya lebih tua dari sidang sebelumnya.
 */
export function sasaranPeristiwaA1<T extends BarisSidangPemicu>(
  sidang: T[],
  hariIni: string,
  simpanan: Map<string, { dibuatPada: string; adaPutusan: boolean }>,
  adalahHariPutusan: (b: T) => boolean,
  batas = BATAS_PERISTIWA_A1
): SasaranPeristiwaA1<T>[] {
  const tgl = (b: T) => teks(b.tanggalSidang).slice(0, 10);
  const akhir = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hariIni);
    if (!m) return hariIni;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + HARI_PERISTIWA_A1));
    return d.toISOString().slice(0, 10);
  })();
  const perPerkara = new Map<string, T[]>();
  for (const b of sidang) {
    const pid = teks(b.perkaraId);
    if (!pid || !tgl(b)) continue;
    (perPerkara.get(pid) ?? perPerkara.set(pid, []).get(pid)!).push(b);
  }
  const hasil: SasaranPeristiwaA1<T>[] = [];
  for (const [pid, daftar] of perPerkara) {
    daftar.sort((a, b) => tgl(a).localeCompare(tgl(b)));
    for (const b of daftar) {
      const t = tgl(b);
      if (t < hariIni || t > akhir || !adalahHariPutusan(b)) continue;
      const sebelum = daftar.filter((x) => tgl(x) < t && tgl(x) <= hariIni).pop();
      if (!sebelum) continue;
      const ada = simpanan.get(`${pid}|${t}`);
      if (ada && ada.adaPutusan && ada.dibuatPada.slice(0, 10) >= tgl(sebelum)) continue;
      hasil.push({ baris: b, sebab: /kesimpulan/i.test(teks(sebelum.agenda)) ? "kesimpulan-selesai" : "agenda-putusan", sidangSebelum: tgl(sebelum) });
      break;
    }
  }
  // Kesimpulan yang baru selesai dulu, lalu Hari Putusan terdekat.
  return hasil.sort((a, b) => (a.sebab === b.sebab ? 0 : a.sebab === "kesimpulan-selesai" ? -1 : 1) || tgl(a.baris).localeCompare(tgl(b.baris))).slice(0, batas);
}
