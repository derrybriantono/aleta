/**
 * ============================================================================
 * URAI TEKS KTP / BLANGKO IDENTITAS -> USULAN MEDAN BLANGKO PIHAK SIPP
 * ============================================================================
 *
 * Perbaikan 2 Okt 2026 butir 16 (kontrak K5). Masukannya TEKS - hasil OCR di
 * server, hasil TextDetector peramban, atau teks yang diketik/ditempel
 * petugas. Keluarannya USULAN, bukan keputusan: tiap medan ditinjau dan dapat
 * dikoreksi petugas di ekstensi sebelum apa pun diisikan ke blangko SIPP.
 *
 * Yang dijaga berkas ini:
 *
 *   - TIDAK MENEBAK. Medan yang labelnya tidak ditemukan dibiarkan kosong;
 *     tidak ada nilai yang "dikira-kira" dari letak baris. (Satu-satunya
 *     pengecualian: tanggal & kota penerbitan KTP-el, yang memang tidak
 *     berlabel - aturannya sempit, lihat cariTerbit.)
 *   - NIK DIPERIKSA BENTUKNYA: 16 angka, tanggal (01-31, perempuan +40) dan
 *     bulan (01-12) yang tersirat di dalamnya harus masuk akal. Tanggal lahir
 *     dan jenis kelamin yang tersirat di NIK dipakai MEMERIKSA hasil baca,
 *     dan hanya mengisi medan yang kosong - dengan catatan yang menyebutnya.
 *   - Enam angka pertama NIK = kode kecamatan penerbit KTP (PP.KK.CC). Ia
 *     dikembalikan sebagai usulan wilayah, bukan diisikan di sini: ekstensi
 *     memakainya sebagai CADANGAN bila tingkat wilayah tidak terbaca.
 *
 * ============================================================================
 * KOREKSI SALAH BACA OCR (perbaikan 5 Okt 2026 butir 6 & 8)
 * ============================================================================
 *
 * Tesseract atas foto KTP salah membaca dengan pola yang tetap:
 *
 *   label      "RTIRW", "RTRW", "RT1RW", "KeI/Desa", "Kel Desa", "Kel/Des",
 *              "Kecamalan", "| KABUPATEN", "K0TA", "PR0VINSI" - plus derau
 *              pendek di depan baris ("viw RTIRW").
 *   angka      "oo7/oog" (o->0, g->9), "001I002" (I = garis miring),
 *              "72O3O9..." pada NIK.
 *   huruf      "R0SMIATI", "SlTI", "SULAWES1" - angka/simbol di dalam kata.
 *
 * Koreksi dikerjakan MENURUT KONTEKS: angka hanya pada ruas yang memang angka
 * (NIK, RT/RW, tanggal, nomor rumah), huruf hanya pada kata yang sebagian
 * besarnya huruf (nama, wilayah, pekerjaan). Nama orang tidak pernah disentuh
 * huruf-hurufnya - hanya angka/simbol yang terselip di dalam kata hurufnya.
 *
 * Berkas ini murni (tanpa I/O) supaya dapat diuji dengan teks KTP tiruan.
 */

export type JenisKelamin = "L" | "P" | "";

export type MedanIdentitas = {
  nama: string;
  nik: string;
  tempatLahir: string;
  /** dd/mm/yyyy - bentuk isian tanggal SIPP. */
  tanggalLahir: string;
  jenisKelamin: JenisKelamin;
  golonganDarah: string;
  agama: string;
  /** "Kawin" | "Belum Kawin" | "Cerai Hidup" | "Cerai Mati" | "" */
  statusKawin: string;
  pekerjaan: string;
  kewarganegaraan: string;
  alamat: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  /** Apa adanya, termasuk awalan KABUPATEN/KOTA bila tertulis - pembeda Kab. X dan Kota X. */
  kabupaten: string;
  provinsi: string;
  telepon: string;
  /**
   * dd/mm/yyyy - tanggal penerbitan KTP-el (blok kanan bawah, di bawah nama
   * kota). Variabel ABT #2222# "Tanggal KTP". Kosong bila tidak yakin.
   */
  tanggalTerbit: string;
  /** Kota/kabupaten penerbit yang tertulis di atas tanggal penerbitan. */
  kotaTerbit: string;
};

export type PeriksaNik = {
  sah: boolean;
  /** "72.03.08" - kode kecamatan penerbit, bentuk kode wilayah SIPP. */
  kodeKecamatan: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelamin;
  sebab?: string;
};

export type HasilUrai = {
  medan: MedanIdentitas;
  nik: PeriksaNik | null;
  /** Kalimat untuk petugas: yang perlu diperiksa, yang diambil dari NIK, dst. */
  catatan: string[];
  /** Nama medan yang terisi dari teks (bukan dari NIK). */
  terbaca: Array<keyof MedanIdentitas>;
};

const MEDAN_KOSONG: MedanIdentitas = {
  nama: "",
  nik: "",
  tempatLahir: "",
  tanggalLahir: "",
  jenisKelamin: "",
  golonganDarah: "",
  agama: "",
  statusKawin: "",
  pekerjaan: "",
  kewarganegaraan: "",
  alamat: "",
  rt: "",
  rw: "",
  kelurahan: "",
  kecamatan: "",
  kabupaten: "",
  provinsi: "",
  telepon: "",
  tanggalTerbit: "",
  kotaTerbit: "",
};

type Label =
  | "nik"
  | "nama"
  | "ttl"
  | "tempatLahir"
  | "tanggalLahir"
  | "jenisKelamin"
  | "golonganDarah"
  | "alamat"
  | "rtrw"
  | "kelurahan"
  | "kecamatan"
  | "kabupatenLabel"
  | "kabupatenKepala"
  | "provinsi"
  | "agama"
  | "statusKawin"
  | "pekerjaan"
  | "kewarganegaraan"
  | "berlaku"
  | "telepon";

/** Pemisah label yang kerap dibaca OCR sebagai huruf/angka: / \ | I l 1 ! . , */
const PEMISAH = "[/\\\\|Il1!.,]";

/** "RT/RW" dengan derau OCR: RTIRW, RTRW, RT1RW, RT/ RW, RT v/w. */
const POLA_RTRW = new RegExp(`R\\s*[T7]\\s*${PEMISAH}?\\s*(?:R\\s*W|v\\s*[/\\\\|il1]?\\s*w)\\b`, "i");

/** RT/RW di tengah baris - tidak di dalam kata lain. */
function cariRtRwTengah(teks: string): { awal: number; akhir: number } | null {
  const pola = new RegExp(`(^|[^A-Za-z])(${POLA_RTRW.source})`, "i");
  const m = pola.exec(String(teks || ""));
  if (!m) return null;
  const awal = m.index + m[1].length;
  return { awal, akhir: awal + m[2].length };
}

/**
 * Label di AWAL baris. Urutan penting: yang lebih panjang/lebih khusus lebih
 * dulu (Tempat/Tgl Lahir sebelum Tempat Lahir, Kabupaten/Kota sebelum kepala
 * KABUPATEN X). Kesalahan baca OCR yang lazim ikut ditampung (N1K, Tgi).
 */
const LABEL: Array<[Label, RegExp]> = [
  ["nik", /^(?:N[I1l|i!]K|No\.?\s*(?:KTP|NIK|Identitas))\b/i],
  ["ttl", /^(?:Tempat\s*[/,|lI1]?\s*(?:Tg[l1iI|]|Tanggal)\.?\s*Lahir|Tmpt?\.?\s*\/\s*Tg[l1iI]\.?\s*Lahir|TTL)\b/i],
  ["tempatLahir", /^Tempat\s+Lahir\b/i],
  ["tanggalLahir", /^(?:Tanggal|Tg[l1iI]\.?)\s*Lahir\b/i],
  ["nama", /^N[ae](?:m|rn)a(?:\s+Lengkap)?\b/i],
  ["jenisKelamin", /^(?:Jenis\s*Ke[l1I|]amin|Ke[l1I|]amin)\b/i],
  ["golonganDarah", /^Go[l1I|](?:ongan)?\.?\s*Darah\b/i],
  ["rtrw", new RegExp(`^${POLA_RTRW.source}`, "i")],
  [
    "kelurahan",
    new RegExp(
      `^(?:Ke[lI1|i]\\.?\\s*(?:urahan)?\\s*${PEMISAH}?\\s*(?:D[eo]sa|Des|[0O]esa)\\b\\.?|Desa\\s*${PEMISAH}?\\s*Ke[lI1|](?:urahan)?\\b\\.?|Ke[lI1|]urahan\\b|Desa\\b)`,
      "i"
    ),
  ],
  ["kecamatan", /^K[eo]c(?:amatan|amat[ae]n|amatar|amalan|amaian|arnatan|amatn|amtan)?\.?(?=[\s:;.,=]|$)/i],
  ["kabupatenLabel", new RegExp(`^(?:Kab(?:upaten)?\\.?\\s*${PEMISAH}\\s*Kota|Kota\\s*${PEMISAH}\\s*Kab(?:upaten)?\\.?)\\b`, "i")],
  ["provinsi", /^(?:Prov(?:insi)?|Propinsi|PR[O0]V[I1l|]NS[I1l|]|PR[O0]P[I1l|]NS[I1l|])\b\.?/i],
  // "Alamat Email" pada blangko bukan alamat tempat tinggal.
  ["alamat", /^(?:A[l1I|]amat|Alarnat)\b(?!\s*E-?mail)/i],
  ["agama", /^(?:Ag[a@]ma|Agarna)\b/i],
  ["statusKawin", /^Status\s*(?:Perka\w*|Kawin)\b/i],
  ["pekerjaan", /^Peker[jl]aan\b/i],
  ["kewarganegaraan", /^(?:Kewarganegaraan|Kewarganegaran|Warga\s*Negara)\b/i],
  ["berlaku", /^Ber[l1iI|]aku\s*Hin[gq]{1,2}a\b/i],
  ["telepon", /^(?:No\.?\s*)?(?:Telepon|Telp|HP|Handphone)\b\.?/i],
];

/** Label satu kata yang dicocokkan dengan jarak sunting (salah eja OCR). */
const LABEL_KABUR: Array<[Label, string, number]> = [
  ["kecamatan", "KECAMATAN", 2],
  ["provinsi", "PROVINSI", 2],
  ["provinsi", "PROPINSI", 2],
  ["pekerjaan", "PEKERJAAN", 2],
  ["kewarganegaraan", "KEWARGANEGARAAN", 3],
  ["alamat", "ALAMAT", 1],
  ["agama", "AGAMA", 1],
];

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, peb: 2, pebruari: 2, mar: 3, maret: 3, apr: 4, april: 4,
  mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, ags: 8, sep: 9, sept: 9,
  september: 9, okt: 10, oktober: 10, nov: 11, nopember: 11, november: 11, des: 12, desember: 12,
};

const KATA_KECIL = new Set(["bin", "binti", "dan", "di", "ke", "dari", "al", "van", "de"]);

/** "SITI AMINAH BINTI LA ODE" -> "Siti Aminah binti La Ode". Teks campuran dibiarkan. */
export function hurufJudul(teks: string): string {
  const t = String(teks || "").trim();
  if (!t) return "";
  // Yang sudah ditulis campuran (bukan seluruhnya besar) dianggap disengaja.
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(/(\s+|\/|-)/)
    .map((kata, i) => {
      if (!kata || /^\s+$|^[/-]$/.test(kata)) return kata;
      if (i > 0 && KATA_KECIL.has(kata)) return kata;
      if (/^(rt|rw|kab|kec|kel|jl|gg|no)\.?$/.test(kata)) {
        const dasar = kata.replace(/\.$/, "");
        const besar = dasar === "rt" || dasar === "rw" ? dasar.toUpperCase() : dasar[0].toUpperCase() + dasar.slice(1);
        return besar + (kata.endsWith(".") ? "." : "");
      }
      // Angka Romawi (DUSUN II, LINGKUNGAN IV) tetap besar.
      if (/^(?:i{1,3}|iv|v|vi{1,3}|ix|x{1,3})$/.test(kata)) return kata.toUpperCase();
      return kata[0].toUpperCase() + kata.slice(1);
    })
    .join("");
}

/** Angka yang kerap tertukar huruf pada hasil OCR - HANYA untuk ruas yang memang angka. */
function angkaOcr(teks: string): string {
  return String(teks || "")
    .replace(/[OoDQ]/g, "0")
    .replace(/[Il|!i]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/B/g, "8")
    .replace(/[Zz]/g, "2")
    .replace(/[gq]/g, "9")
    .replace(/[bG]/g, "6")
    .replace(/[?]/g, "7");
}

const ANGKA_KE_HURUF: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "6": "G", "4": "A", "|": "I", "!": "I" };

/**
 * Angka/simbol yang terselip di dalam KATA HURUF -> hurufnya ("R0SMIATI" ->
 * "ROSMIATI", "SlTI" -> "SITI", "SULAWES1" -> "SULAWESI"). Kata yang
 * sebagian besarnya angka (nomor rumah "12", "A1", "NO.5") tidak disentuh.
 */
export function hurufOcr(teks: string): string {
  return String(teks || "")
    .split(/(\s+)/)
    .map((kata) => {
      if (!kata.trim()) return kata;
      const huruf = (kata.match(/[A-Za-z]/g) || []).length;
      const angka = (kata.match(/[0-9|!]/g) || []).length;
      let k = kata;
      if (huruf >= 2 && angka > 0 && angka < huruf) {
        k = k.replace(/[0-9|!]/g, (c) => ANGKA_KE_HURUF[c] ?? c);
      }
      // "SlTI": huruf kecil l di tengah kata HURUF BESAR adalah I.
      const besar = (k.match(/[A-Z]/g) || []).length;
      const kecil = (k.match(/[a-z]/g) || []).length;
      if (besar >= 2 && kecil > 0 && (k.match(/[a-z]/g) || []).every((c) => c === "l")) k = k.replace(/l/g, "I");
      return k;
    })
    .join("");
}

/** Nomor di dalam alamat ("NO. 1O", "12O") - huruf mirip angka pada kata yang sebagian besarnya angka. */
function angkaKataOcr(teks: string): string {
  return String(teks || "")
    .split(/(\s+)/)
    .map((kata) => {
      const angka = (kata.match(/\d/g) || []).length;
      const mirip = (kata.match(/[OoIl]/g) || []).length;
      const lain = (kata.match(/[A-Za-z]/g) || []).length - mirip;
      if (angka >= 1 && mirip > 0 && lain === 0 && angka >= mirip) return kata.replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
      return kata;
    })
    .join("");
}

function rapikan(nilai: string): string {
  return String(nilai || "")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;=\-–.,!'"`~]+/, "")
    .replace(/[\s:;=\-–,!'"`~]+$/, "")
    .trim();
}

/** Derau pemisah OCR di sekitar RT/RW: "viw", "vlw", "v/w", "vw", "ww". */
const DERAU_PEMISAH = /(?:^|\s)(?:v\s*[/\\|il1]?\s*w|ww)(?=\s|$|[:;,./])/gi;

/** Token derau pendek: tanda baca saja, atau huruf kecil 1-3 di tengah nilai BERHURUF BESAR. */
function tokenDerau(token: string, nilaiBesar: boolean): boolean {
  if (!token) return true;
  if (/^[^A-Za-z0-9]+$/.test(token)) return true;
  if (/^(?:v[/\\|il1]?w|vw|ww)$/i.test(token)) return true;
  if (nilaiBesar && token.length <= 3 && /[a-z]/.test(token) && !/^(?:bin|dan|al|de|di|ke)$/i.test(token)) return true;
  return false;
}

/** Buang token derau di depan dan di belakang (sisa tepi foto, bayangan pas foto). */
function buangTepiDerau(nilai: string): string {
  const token = rapikan(nilai).split(" ").filter(Boolean);
  const besar = token.filter((t) => /[A-Z]{2,}/.test(t)).length >= Math.max(1, Math.ceil(token.length / 2));
  while (token.length && tokenDerau(token[token.length - 1], besar)) token.pop();
  while (token.length && tokenDerau(token[0], besar)) token.shift();
  return token.join(" ");
}

/** Nama wilayah: tepi bersih, huruf dibetulkan. Huruf besar-kecilnya dibiarkan (KTP: besar; blangko: campuran). */
function bersihWilayah(nilai: string): string {
  return hurufOcr(buangTepiDerau(nilai)).replace(/\s+/g, " ").trim();
}

function dua(n: number): string {
  return String(n).padStart(2, "0");
}

function tanggalSah(h: number, b: number, t: number): boolean {
  if (!(t >= 1900 && t <= 2100 && b >= 1 && b <= 12 && h >= 1)) return false;
  const hariMaks = new Date(Date.UTC(t, b, 0)).getUTCDate();
  return h <= hariMaks;
}

const POLA_TANGGAL_ANGKA =
  /([\dOoIl|]{1,2})\s*[-/.\s]\s*([\dOoIl|]{1,2})\s*[-/.\s]\s*([\dOoIl|SB]{4})(?![\d])/;

/**
 * Tanggal pertama dalam teks -> { tanggal "dd/mm/yyyy", awal, akhir } atau null.
 * Menerima 05-05-1990, 5/5/1990, 05.05.1990, 05 05 1990, 0S-O5-199O, dan 5 Mei 1990.
 */
export function cariTanggal(teks: string): { tanggal: string; awal: number; akhir: number } | null {
  const s = String(teks || "");
  let dari = 0;
  while (dari < s.length) {
    const angka = POLA_TANGGAL_ANGKA.exec(s.slice(dari));
    if (!angka) break;
    const awal = dari + angka.index;
    const sungguh = (angka[0].match(/\d/g) || []).length;
    const h = Number(angkaOcr(angka[1]));
    const b = Number(angkaOcr(angka[2]));
    const t = Number(angkaOcr(angka[3]));
    if (sungguh >= 4 && tanggalSah(h, b, t)) {
      return { tanggal: `${dua(h)}/${dua(b)}/${t}`, awal, akhir: awal + angka[0].length };
    }
    dari = awal + 1;
  }
  const nama = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/.exec(s);
  if (nama) {
    const b = BULAN[nama[2].toLowerCase()];
    const h = Number(nama[1]);
    const t = Number(nama[3]);
    if (b && tanggalSah(h, b, t)) {
      return { tanggal: `${dua(h)}/${dua(b)}/${t}`, awal: nama.index, akhir: nama.index + nama[0].length };
    }
  }
  return null;
}

/** Seluruh tanggal dalam teks, berurutan. */
function semuaTanggal(teks: string): Array<{ tanggal: string; awal: number; akhir: number }> {
  const hasil: Array<{ tanggal: string; awal: number; akhir: number }> = [];
  let dari = 0;
  const s = String(teks || "");
  while (dari < s.length) {
    const t = cariTanggal(s.slice(dari));
    if (!t) break;
    hasil.push({ tanggal: t.tanggal, awal: dari + t.awal, akhir: dari + t.akhir });
    dari += t.akhir;
  }
  return hasil;
}

/** NIK -> bentuk, kode kecamatan, tanggal lahir dan jenis kelamin tersirat. */
export function periksaNik(nikMentah: string, tahunKini = new Date().getFullYear()): PeriksaNik {
  const nik = angkaOcr(String(nikMentah || "")).replace(/\D/g, "");
  const kosong: PeriksaNik = { sah: false, kodeKecamatan: "", tanggalLahir: "", jenisKelamin: "" };
  if (nik.length !== 16) return { ...kosong, sebab: `NIK harus 16 angka (terbaca ${nik.length}).` };
  const hariMentah = Number(nik.slice(6, 8));
  const bulan = Number(nik.slice(8, 10));
  const yy = Number(nik.slice(10, 12));
  const perempuan = hariMentah > 40;
  const hari = perempuan ? hariMentah - 40 : hariMentah;
  const tahun = 2000 + yy <= tahunKini ? 2000 + yy : 1900 + yy;
  if (!tanggalSah(hari, bulan, tahun)) {
    return { ...kosong, sebab: "Tanggal lahir yang tersirat di NIK tidak mungkin - kemungkinan salah baca." };
  }
  if (nik.slice(0, 6) === "000000" || nik.slice(12) === "0000") {
    return { ...kosong, sebab: "NIK berpola tidak wajar (ruas nol)." };
  }
  return {
    sah: true,
    kodeKecamatan: `${nik.slice(0, 2)}.${nik.slice(2, 4)}.${nik.slice(4, 6)}`,
    tanggalLahir: `${dua(hari)}/${dua(bulan)}/${tahun}`,
    jenisKelamin: perempuan ? "P" : "L",
  };
}

/**
 * Nilai RT/RW berderau -> { rt, rw } (tiga angka) atau null.
 *
 *   "001/002"  "oo7/oog"  "001I002"  "001 viw 002"  "0011002"  "007 008"
 *
 * "I l | i !" di antara dua kelompok angka adalah GARIS MIRING yang terbaca
 * huruf; di dalam satu kelompok ia angka 1. Tanpa pemisah sama sekali, enam
 * angka = 3/3, dan tujuh angka dengan "1" di tengah = 3/1/3.
 */
export function uraiRtRw(nilai: string): { rt: string; rw: string } | null {
  const s = String(nilai || "").replace(DERAU_PEMISAH, " / ");
  let d = "";
  for (const ch of s) {
    if (/\d/.test(ch)) d += ch;
    else if (/[OoQD]/.test(ch)) d += "0";
    else if (/[gq]/.test(ch)) d += "9";
    else if (/[Ss]/.test(ch)) d += "5";
    else if (ch === "B") d += "8";
    else if (/[Zz]/.test(ch)) d += "2";
    else if (ch === "b" || ch === "G") d += "6";
    else if (/[/\\]/.test(ch)) d += "/";
    else if (/[Il|i!]/.test(ch)) d += "?";
    else d += " ";
  }
  d = d.replace(/\s+/g, " ").trim();
  const angka = (x: string) => x.replace(/\?/g, "1").replace(/\D/g, "");
  const jadi = (a: string, b: string) => {
    if (!a || !b || a.length > 3 || b.length > 3) return null;
    if (/^0+$/.test(a) && /^0+$/.test(b)) return null;
    return { rt: a.padStart(3, "0"), rw: b.padStart(3, "0") };
  };
  if (d.includes("/")) {
    const i = d.indexOf("/");
    const kiri = angka(d.slice(0, i)).slice(-3);
    const kanan = angka(d.slice(i + 1)).slice(0, 3);
    return jadi(kiri, kanan);
  }
  const token = d.split(" ").filter(Boolean);
  for (const t of token) {
    const m = /^(\d{1,3})\?+(\d{1,3})$/.exec(t);
    if (m) return jadi(m[1], m[2]);
  }
  const bersih = token.map(angka).filter(Boolean);
  if (bersih.length === 2) return jadi(bersih[0], bersih[1]);
  if (bersih.length === 1) {
    const t = bersih[0];
    if (t.length === 6) return jadi(t.slice(0, 3), t.slice(3));
    if (t.length === 7 && t[3] === "1") return jadi(t.slice(0, 3), t.slice(4));
  }
  return null;
}

function bacaJenisKelamin(teks: string): JenisKelamin {
  const t = String(teks || "").toUpperCase();
  if (/PEREMPUAN|WANITA|^P\b/.test(t)) return "P";
  if (/LAKI|PRIA|^L\b/.test(t)) return "L";
  return "";
}

function bacaAgama(teks: string): string {
  const t = hurufOcr(String(teks || "")).toUpperCase().replace(/[^A-Z]/g, "");
  if (!t) return "";
  if (t.startsWith("ISL") || /^[I1L]SLAM/.test(t)) return "Islam";
  if (/KAT(H)?OL/.test(t)) return "Katolik";
  if (/KRIST|PROTES/.test(t)) return "Kristen";
  if (t.startsWith("HIND")) return "Hindu";
  if (/BUD+HA|BUDA/.test(t)) return "Budha";
  if (/KH?ONG?HU/.test(t)) return "Konghucu";
  if (/KEPERCAYAAN|LAIN/.test(t)) return "Lainnya";
  return hurufJudul(buangTepiDerau(teks));
}

function bacaStatusKawin(teks: string): string {
  const t = hurufOcr(String(teks || "")).toUpperCase();
  if (/BELUM/.test(t)) return "Belum Kawin";
  if (/CERAI\s*MATI/.test(t)) return "Cerai Mati";
  if (/CERAI/.test(t)) return "Cerai Hidup";
  if (/KAWIN|MENIKAH/.test(t)) return "Kawin";
  return "";
}

function bacaGolonganDarah(teks: string): string {
  const t = String(teks || "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/[^ABO+-]/g, "");
  const m = /^(AB|A|B|O)/.exec(t);
  return m ? m[1] : "";
}

function jarakSunting(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let sebelum = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= b.length; j += 1) {
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    sebelum = kini;
  }
  return sebelum[b.length];
}

/** Kata pertama baris, huruf besar, angka mirip huruf dibetulkan, tanda baca dibuang. */
function kataPertama(baris: string): { kata: string; sisa: string } {
  const m = /^(\S+)\s*(.*)$/.exec(baris);
  if (!m) return { kata: "", sisa: "" };
  const kata = hurufOcr(m[1].replace(/[:;=.,]+$/, ""))
    .toUpperCase()
    .replace(/[0]/g, "O")
    .replace(/[^A-Z]/g, "");
  return { kata, sisa: m[2] };
}

/**
 * Kepala KTP "KABUPATEN DONGGALA" / "KOTA PALU" (juga "| KABUPATEN",
 * "KAB DONGGALA", "K0TA PALU", "KABUPATEM DONGGALA") -> "KABUPATEN X" /
 * "KOTA X". Awalan DISIMPAN: Kab. X dan Kota X dapat sama-sama ada.
 */
function kepalaKabupaten(baris: string): string {
  const { kata, sisa } = kataPertama(baris);
  if (!kata) return "";
  const nama = bersihWilayah(sisa).toUpperCase();
  if (!/[A-Z]{3,}/.test(nama)) return "";
  if (kata === "KOTA" || kata === "KOTAADMINISTRASI") return `KOTA ${nama}`;
  if (kata === "KAB" || (kata.length >= 7 && jarakSunting(kata, "KABUPATEN") <= 2)) return `KABUPATEN ${nama}`;
  return "";
}

/** Label pertama di awal baris -> [label, nilai sesudahnya] atau null. */
function cocokLabel(baris: string): [Label, string] | null {
  for (const [label, pola] of LABEL) {
    const m = pola.exec(baris);
    if (!m) continue;
    return [label, baris.slice(m[0].length)];
  }
  const kepala = kepalaKabupaten(baris);
  if (kepala) return ["kabupatenKepala", kepala];
  const { kata, sisa } = kataPertama(baris);
  if (kata.length >= 4) {
    for (const [label, sasaran, batas] of LABEL_KABUR) {
      // Sama persis bukan urusan cabang ini: bila polanya tidak cocok, ada
      // sebabnya ("Alamat Email" bukan alamat).
      if (kata === sasaran) continue;
      if (Math.abs(kata.length - sasaran.length) <= batas && jarakSunting(kata, sasaran) <= batas) return [label, sisa];
    }
  }
  return null;
}

/**
 * Label di awal baris, juga bila didahului derau pendek OCR ("| ", "viw ",
 * "ee ") - satu atau dua token pendek dibuang lalu dicoba lagi.
 */
function cocokLabelBerderau(baris: string): [Label, string] | null {
  const polos = baris.replace(/^[^A-Za-z0-9]+/, "");
  const langsung = cocokLabel(polos);
  if (langsung) return langsung;
  const token = polos.split(" ");
  for (let buang = 1; buang <= 2 && buang < token.length; buang += 1) {
    const depan = token.slice(0, buang);
    // Hanya derau: tanda baca, atau token pendek berhuruf kecil ("viw", "ee").
    // "DI DESA X" tidak boleh menjadi label Desa.
    if (!depan.every((t) => t.length <= 3 && (/^[^A-Za-z0-9]+$/.test(t) || /[a-z]/.test(t)))) break;
    const coba = cocokLabel(token.slice(buang).join(" ").replace(/^[^A-Za-z0-9]+/, ""));
    if (coba) return coba;
  }
  return null;
}

/** Alamat tanpa derau RT/RW yang terbawa ("viw RTIRW", "RT/RW : 001/002"). */
function bersihAlamat(nilai: string): string {
  let s = String(nilai || "");
  const rt = cariRtRwTengah(s);
  if (rt) s = s.slice(0, rt.awal);
  s = s.replace(DERAU_PEMISAH, " ");
  return angkaKataOcr(hurufOcr(buangTepiDerau(s)));
}

/** Skor kelengkapan hasil urai - dipakai memilih hasil OCR terbaik di antara beberapa lintasan. */
export function skorUrai(h: HasilUrai): number {
  const m = h.medan;
  let skor = 0;
  if (h.nik && h.nik.sah) skor += 3;
  else if (m.nik) skor += 1;
  if (m.nama) skor += 2;
  for (const k of [
    "tempatLahir", "alamat", "kelurahan", "kecamatan", "kabupaten", "provinsi", "agama", "statusKawin", "pekerjaan",
  ] as const) {
    if (m[k]) skor += 1;
  }
  if (m.rt && m.rw) skor += 1;
  if (h.terbaca.includes("tanggalLahir")) skor += 1;
  if (h.terbaca.includes("jenisKelamin")) skor += 1;
  return skor;
}

/**
 * Tanggal & kota penerbitan KTP-el - blok kanan bawah: nama kota, lalu
 * tanggal. Tidak berlabel, jadi aturannya sempit:
 *
 *   - dicari di TIGA baris terakhir (plus baris "Berlaku Hingga", yang pada
 *     --psm 6 kerap memuat blok itu: "SEUMUR HIDUP 18-02-2012");
 *   - bukan tanggal lahir; tahun 2011 (KTP-el pertama) sampai tahun ini;
 *   - pada baris Berlaku Hingga TANPA "seumur hidup", tanggal pertamanya
 *     adalah masa berlaku, bukan penerbitan;
 *   - yang dipakai tanggal TERAKHIR yang lolos.
 */
function cariTerbit(baris: string[], indeksBerlaku: number, tanggalLahir: string, tahunKini: number) {
  const indeks = new Set<number>();
  for (let i = Math.max(0, baris.length - 3); i < baris.length; i += 1) indeks.add(i);
  if (indeksBerlaku >= 0) indeks.add(indeksBerlaku);
  let pilihan: { tanggal: string; baris: number; sebelum: string } | null = null;
  for (const i of [...indeks].sort((a, b) => a - b)) {
    const teks = baris[i];
    let lingkup = teks;
    let lewatiPertama = false;
    if (i === indeksBerlaku) {
      const seumur = /SEUMUR\s*HIDUP/i.exec(teks);
      if (seumur) lingkup = teks.slice(seumur.index + seumur[0].length);
      else {
        const label = /^.*?Hin[gq]{1,2}a\b\s*[:;=.]?/i.exec(teks);
        lingkup = label ? teks.slice(label[0].length) : teks;
        lewatiPertama = true;
      }
    }
    const temuan = semuaTanggal(lingkup);
    temuan.forEach((t, urut) => {
      if (lewatiPertama && urut === 0) return;
      const tahun = Number(t.tanggal.slice(6));
      if (t.tanggal === tanggalLahir) return;
      if (tahun < 2011 || tahun > tahunKini) return;
      pilihan = { tanggal: t.tanggal, baris: i, sebelum: lingkup.slice(0, t.awal) };
    });
  }
  if (!pilihan) return { tanggal: "", kota: "" };
  const p = pilihan as { tanggal: string; baris: number; sebelum: string };
  const jadiKota = (x: string) => {
    const v = bersihWilayah(x.replace(/^.*\bSEUMUR\s*HIDUP\b/i, "")).toUpperCase();
    if (!/^[A-Z][A-Z .'-]{2,40}$/.test(v) || v.split(" ").length > 4) return "";
    return hurufJudul(v);
  };
  let kota = jadiKota(p.sebelum);
  if (!kota && p.baris > 0) {
    const atas = baris[p.baris - 1];
    if (!cocokLabelBerderau(atas) && !/\d/.test(atas)) kota = jadiKota(atas);
    else if (/SEUMUR\s*HIDUP/i.test(atas)) kota = jadiKota(atas);
  }
  return { tanggal: p.tanggal, kota };
}

/* === 12OKT-M: BERLAKU HINGGA (penanda KTP Elektronik, variabel ABT 11114) === */
/**
 * "Berlaku Hingga" pada KTP, dibaca dari teks (lapisan teks PDF atau hasil OCR):
 *
 *   "seumur_hidup"  KTP-el tanpa kedaluwarsa ("SEUMUR HIDUP", salah baca OCR yang lazim ikut diterima)
 *   "dd/mm/yyyy"    tanggal kedaluwarsa yang tertulis (KTP bentuk lama)
 *   ""              tidak terbaca / meragukan - TIDAK ditebak
 *
 * Aturan (sengaja sempit, karena hasilnya menentukan "Elektronik (KTP-el)" di putusan):
 *   1. baris berlabel "Berlaku Hingga": "SEUMUR HIDUP" di barisnya (atau baris sesudahnya bila barisnya
 *      hanya label) = seumur hidup. Pada --psm 6 baris itu kerap memuat blok kanan-bawah
 *      ("SEUMUR HIDUP 18-02-2012") - tanggal sesudah "seumur hidup" adalah tanggal terbit, bukan kedaluwarsa;
 *   2. tanpa "seumur hidup" di baris itu, tanggal pertamanya adalah kedaluwarsa - TETAPI hanya bila tanggal itu
 *      muncul sekali di seluruh teks dan "SEUMUR HIDUP" tidak ada di mana pun. Tanggal yang sama muncul lagi di
 *      blok penerbitan = tanggal terbit yang terseret ke baris itu (KTP-el yang tulisan "seumur hidup"-nya
 *      rusak), bukan kedaluwarsa: dijawab "" (tidak terbaca);
 *   3. tanpa baris berlabel (OCR tak menangkapnya): "SEUMUR HIDUP" di mana pun dalam teks = seumur hidup
 *      (tulisan itu hanya ada pada KTP-el); selain itu "".
 */
const POLA_SEUMUR_HIDUP = /S\s*[EF3]\s*U\s*M\s*[UO]\s*R\s*H\s*[I1l|!]\s*D\s*[UO]\s*[PF]/i;
const POLA_LABEL_BERLAKU = /Ber[l1iI|]aku\s*Hin[gq]{1,2}a\b\s*[:;=.]?/i;

export type BerlakuHingga = "" | "seumur_hidup" | string;

export function uraiBerlakuHingga(teksMasuk: string, tahunKini = new Date().getFullYear()): BerlakuHingga {
  const baris = String(teksMasuk || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!baris.length) return "";
  const semua = baris.join("\n");
  const seumurDimana = POLA_SEUMUR_HIDUP.test(semua);
  const indeks = baris.findIndex((b) => POLA_LABEL_BERLAKU.test(b));
  if (indeks >= 0) {
    const label = POLA_LABEL_BERLAKU.exec(baris[indeks]);
    let lingkup = label ? baris[indeks].slice(label.index + label[0].length) : "";
    // Label berdiri sendiri: nilainya di baris sesudahnya (lapisan teks PDF kerap memisah label dan nilai).
    if (!/[A-Za-z0-9]/.test(lingkup) && indeks + 1 < baris.length) lingkup = baris[indeks + 1];
    if (POLA_SEUMUR_HIDUP.test(lingkup)) return "seumur_hidup";
    const tgl = cariTanggal(lingkup);
    if (tgl) {
      const tahun = Number(tgl.tanggal.slice(6));
      const kali = semuaTanggal(semua).filter((t) => t.tanggal === tgl.tanggal).length;
      if (!seumurDimana && kali === 1 && tahun >= 1990 && tahun <= tahunKini + 15) return tgl.tanggal;
      if (seumurDimana) return "seumur_hidup";
      return "";
    }
  }
  return seumurDimana ? "seumur_hidup" : "";
}
/* === AKHIR 12OKT-M === */

/**
 * Teks KTP atau blangko identitas -> usulan medan.
 *
 * Baris tanpa label hanya dipakai sebagai lanjutan Alamat (KTP memecah alamat
 * panjang ke baris berikutnya) - selebihnya diabaikan.
 */
export function uraiTeksIdentitas(teksMasuk: string, tahunKini = new Date().getFullYear()): HasilUrai {
  const medan: MedanIdentitas = { ...MEDAN_KOSONG };
  const terbaca = new Set<keyof MedanIdentitas>();
  const catatan: string[] = [];
  const setel = (k: keyof MedanIdentitas, nilai: string) => {
    const v = rapikan(nilai);
    if (!v || medan[k]) return;
    (medan as Record<string, string>)[k] = v;
    terbaca.add(k);
  };

  const baris = String(teksMasuk || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let terakhir: Label | null = null;
  let indeksBerlaku = -1;
  let sisaWarga = "";
  baris.forEach((b, indeks) => {
    let cocok = cocokLabelBerderau(b);
    let depan = "";
    if (!cocok) {
      // RT/RW di TENGAH baris: "DUSUN II viw RTIRW : 001/002" - bagian
      // depannya lanjutan alamat, bagian belakangnya RT/RW.
      const rt = cariRtRwTengah(b);
      if (rt) {
        depan = b.slice(0, rt.awal);
        cocok = ["rtrw", b.slice(rt.akhir)];
      }
    }
    if (!cocok) {
      // Lanjutan alamat: satu baris tanpa label tepat sesudah Alamat.
      if (terakhir === "alamat" && medan.alamat && !/\d{6,}/.test(b)) {
        const lanjut = bersihAlamat(b);
        if (lanjut) medan.alamat = rapikan(`${medan.alamat} ${hurufJudul(lanjut)}`);
      }
      terakhir = null;
      return;
    }
    if (depan && terakhir === "alamat" && medan.alamat) {
      const lanjut = bersihAlamat(depan);
      if (lanjut && /[A-Za-z]{2,}/.test(lanjut)) medan.alamat = rapikan(`${medan.alamat} ${hurufJudul(lanjut)}`);
    }
    const [label, sisa] = cocok;
    terakhir = label;
    let nilai = sisa;
    switch (label) {
      case "nik": {
        const angka = angkaOcr(nilai.replace(/[A-Za-z]{3,}/g, " ")).replace(/[^\d]/g, "");
        setel("nik", angka.slice(0, 16));
        break;
      }
      case "nama":
        setel("nama", hurufJudul(hurufOcr(buangTepiDerau(nilai))));
        break;
      case "ttl": {
        const tgl = cariTanggal(nilai);
        if (tgl) {
          setel("tanggalLahir", tgl.tanggal);
          setel("tempatLahir", hurufJudul(hurufOcr(buangTepiDerau(nilai.slice(0, tgl.awal)))));
        } else {
          setel("tempatLahir", hurufJudul(hurufOcr(buangTepiDerau(nilai.split(",")[0] || ""))));
        }
        break;
      }
      case "tempatLahir":
        setel("tempatLahir", hurufJudul(hurufOcr(buangTepiDerau(nilai))));
        break;
      case "tanggalLahir": {
        const tgl = cariTanggal(nilai);
        if (tgl) setel("tanggalLahir", tgl.tanggal);
        break;
      }
      case "jenisKelamin": {
        // "PEREMPUAN Gol. Darah : O" - dua label dalam satu baris KTP.
        const potong = /\bGo[l1I|](?:ongan)?\.?\s*Darah\b/i.exec(nilai);
        if (potong) {
          setel("golonganDarah", bacaGolonganDarah(nilai.slice(potong.index + potong[0].length)));
          nilai = nilai.slice(0, potong.index);
        }
        const jk = bacaJenisKelamin(hurufOcr(rapikan(nilai)));
        if (jk) {
          medan.jenisKelamin = jk;
          terbaca.add("jenisKelamin");
        }
        break;
      }
      case "golonganDarah":
        setel("golonganDarah", bacaGolonganDarah(nilai));
        break;
      case "alamat":
        setel("alamat", hurufJudul(bersihAlamat(nilai)));
        break;
      case "rtrw": {
        const r = uraiRtRw(nilai);
        if (r) {
          setel("rt", r.rt);
          setel("rw", r.rw);
        }
        // Baris berikutnya bukan lanjutan alamat lagi.
        break;
      }
      case "kelurahan":
        setel("kelurahan", bersihWilayah(nilai));
        break;
      case "kecamatan":
        setel("kecamatan", bersihWilayah(nilai));
        break;
      case "kabupatenLabel":
        setel("kabupaten", hurufOcr(buangTepiDerau(nilai)));
        break;
      case "kabupatenKepala":
        setel("kabupaten", nilai);
        break;
      case "provinsi": {
        // "PROVINSI SULAWESI TENGAH KABUPATEN DONGGALA" - dua baris kepala
        // tergabung dalam satu baris OCR.
        const v = bersihWilayah(nilai);
        const token = v.split(" ");
        const pisah = token.findIndex((t0, i) => {
          const t = t0.toUpperCase();
          return i > 0 && (t === "KOTA" || t === "KAB" || (t.length >= 7 && jarakSunting(t, "KABUPATEN") <= 2));
        });
        if (pisah > 0) {
          setel("provinsi", token.slice(0, pisah).join(" "));
          const kab = kepalaKabupaten(token.slice(pisah).join(" "));
          if (kab) setel("kabupaten", kab);
        } else {
          setel("provinsi", v);
        }
        break;
      }
      case "agama":
        setel("agama", bacaAgama(nilai));
        break;
      case "statusKawin":
        setel("statusKawin", bacaStatusKawin(nilai));
        break;
      case "pekerjaan":
        setel("pekerjaan", hurufJudul(hurufOcr(buangTepiDerau(nilai))));
        break;
      case "kewarganegaraan": {
        // "WNI   DONGGALA" - kota penerbit di blok kanan ikut terbaca sebaris.
        const v = rapikan(nilai);
        const wni = /\bW\s*N\s*[I1l|!]\b|\bWNA\b|INDONESIA/i.exec(v);
        if (wni) {
          setel("kewarganegaraan", /W\s*N\s*A/i.test(wni[0]) ? "WNA" : /INDONESIA/i.test(wni[0]) ? "INDONESIA" : "WNI");
          sisaWarga = v.slice(wni.index + wni[0].length);
        } else {
          setel("kewarganegaraan", v.toUpperCase());
        }
        break;
      }
      case "berlaku":
        indeksBerlaku = indeks;
        break;
      case "telepon": {
        const angka = rapikan(nilai).replace(/[^\d+]/g, "");
        if (angka.length >= 8) setel("telepon", angka);
        break;
      }
      default:
        break;
    }
  });

  // NIK tanpa label: deretan 16 angka di mana pun dalam teks (huruf mirip
  // angka dibetulkan bila sebagian besar ruasnya memang angka).
  if (!medan.nik || medan.nik.length < 16) {
    const semua = baris.join("\n");
    const polos = /(?:^|\D)(\d{16})(?:\D|$)/.exec(semua);
    let temu = polos ? polos[1] : "";
    if (!temu) {
      for (const token of semua.split(/[\s:]+/)) {
        if (token.length !== 16 || !/^[\dOoIlDQbgqSsBZ|]+$/.test(token)) continue;
        if ((token.match(/\d/g) || []).length < 12) continue;
        temu = angkaOcr(token);
        break;
      }
    }
    if (temu) {
      medan.nik = temu;
      terbaca.add("nik");
    }
  }

  let nik: PeriksaNik | null = null;
  if (medan.nik) {
    nik = periksaNik(medan.nik, tahunKini);
    if (!nik.sah) {
      catatan.push(`${nik.sebab} Periksa NIK dengan KTP aslinya.`);
    } else {
      if (medan.tanggalLahir && medan.tanggalLahir !== nik.tanggalLahir) {
        catatan.push(
          `Tanggal lahir terbaca ${medan.tanggalLahir}, tetapi NIK menyiratkan ${nik.tanggalLahir}. Periksa salah satunya.`
        );
      }
      if (!medan.tanggalLahir) {
        medan.tanggalLahir = nik.tanggalLahir;
        catatan.push(`Tanggal lahir tidak terbaca - diambil dari NIK (${nik.tanggalLahir}). Periksa.`);
      }
      if (medan.jenisKelamin && medan.jenisKelamin !== nik.jenisKelamin) {
        catatan.push("Jenis kelamin terbaca tidak sama dengan yang tersirat di NIK. Periksa salah satunya.");
      }
      if (!medan.jenisKelamin) {
        medan.jenisKelamin = nik.jenisKelamin;
        catatan.push("Jenis kelamin tidak terbaca - diambil dari NIK. Periksa.");
      }
    }
  }

  // Tanggal & kota penerbitan - hanya bila teksnya memang KTP/blangko
  // berlabel (tanpa satu label pun, tidak ada yang ditebak).
  if (terbaca.size) {
    const terbit = cariTerbit(baris, indeksBerlaku, medan.tanggalLahir, tahunKini);
    if (terbit.tanggal) {
      medan.tanggalTerbit = terbit.tanggal;
      terbaca.add("tanggalTerbit");
      const kota = terbit.kota || (() => {
        const v = bersihWilayah(sisaWarga).toUpperCase();
        return /^[A-Z][A-Z .'-]{2,40}$/.test(v) && v.split(" ").length <= 4 ? hurufJudul(v) : "";
      })();
      if (kota) {
        medan.kotaTerbit = kota;
        terbaca.add("kotaTerbit");
      }
    }
  }

  if (medan.kewarganegaraan && !/WNI|INDONESIA/.test(medan.kewarganegaraan)) {
    catatan.push(`Kewarganegaraan terbaca "${medan.kewarganegaraan}" - wilayah SIPP hanya untuk WNI.`);
  }

  return { medan, nik, catatan, terbaca: [...terbaca] };
}
