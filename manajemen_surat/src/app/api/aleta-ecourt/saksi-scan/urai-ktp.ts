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
 *     tidak ada nilai yang "dikira-kira" dari letak baris.
 *   - NIK DIPERIKSA BENTUKNYA: 16 angka, tanggal (01-31, perempuan +40) dan
 *     bulan (01-12) yang tersirat di dalamnya harus masuk akal. Tanggal lahir
 *     dan jenis kelamin yang tersirat di NIK dipakai MEMERIKSA hasil baca,
 *     dan hanya mengisi medan yang kosong - dengan catatan yang menyebutnya.
 *   - Enam angka pertama NIK = kode kecamatan penerbit KTP (PP.KK.CC). Ia
 *     dikembalikan sebagai usulan wilayah, bukan diisikan: alamat sekarang
 *     boleh berbeda dari tempat KTP diterbitkan.
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

/**
 * Label di AWAL baris. Urutan penting: yang lebih panjang/lebih khusus lebih
 * dulu (Tempat/Tgl Lahir sebelum Tempat Lahir, Kabupaten/Kota sebelum kepala
 * KABUPATEN X). Kesalahan baca OCR yang lazim ikut ditampung (N1K, Tgi).
 */
const LABEL: Array<[Label, RegExp]> = [
  ["nik", /^(?:N[I1l|]K|No\.?\s*(?:KTP|NIK|Identitas))\b/i],
  ["ttl", /^(?:Tempat\s*[/,]?\s*(?:Tg[l1i]|Tanggal)\.?\s*Lahir|Tmpt?\.?\s*\/\s*Tg[l1i]\.?\s*Lahir|TTL)\b/i],
  ["tempatLahir", /^Tempat\s+Lahir\b/i],
  ["tanggalLahir", /^(?:Tanggal|Tg[l1i]\.?)\s*Lahir\b/i],
  ["nama", /^Nama(?:\s+Lengkap)?\b/i],
  ["jenisKelamin", /^(?:Jenis\s*Kelamin|Kelamin)\b/i],
  ["golonganDarah", /^Gol(?:ongan)?\.?\s*Darah\b/i],
  ["rtrw", /^RT\s*\/\s*RW\b/i],
  ["kelurahan", /^(?:Ke[l1]\.?\s*\/\s*Desa|Ke[l1]urahan\s*\/\s*Desa|Desa\s*\/\s*Ke[l1](?:urahan)?\.?|Ke[l1]urahan|Desa)\b/i],
  ["kecamatan", /^Kec(?:amatan)?\.?(?=[\s:;.]|$)/i],
  ["kabupatenLabel", /^(?:Kab(?:upaten)?\.?\s*\/\s*Kota|Kota\s*\/\s*Kab(?:upaten)?\.?)\b/i],
  ["kabupatenKepala", /^(?=(?:KABUPATEN|KAB\.|KOTA)\s+\S)/i],
  ["provinsi", /^(?:Prov(?:insi)?|Propinsi)\b\.?/i],
  // "Alamat Email" pada blangko bukan alamat tempat tinggal.
  ["alamat", /^Alamat\b(?!\s*E-?mail)/i],
  ["agama", /^Agama\b/i],
  ["statusKawin", /^Status\s*(?:Perkawinan|Kawin)\b/i],
  ["pekerjaan", /^Pekerjaan\b/i],
  ["kewarganegaraan", /^(?:Kewarganegaraan|Warga\s*Negara)\b/i],
  ["berlaku", /^Berlaku\s*Hingga\b/i],
  ["telepon", /^(?:No\.?\s*)?(?:Telepon|Telp|HP|Handphone)\b\.?/i],
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
    .replace(/[Oo]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2")
    .replace(/[?]/g, "7");
}

function rapikan(nilai: string): string {
  return String(nilai || "")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;=\-–.,]+/, "")
    .replace(/[\s:;=\-–,]+$/, "")
    .trim();
}

function dua(n: number): string {
  return String(n).padStart(2, "0");
}

function tanggalSah(h: number, b: number, t: number): boolean {
  if (!(t >= 1900 && t <= 2100 && b >= 1 && b <= 12 && h >= 1)) return false;
  const hariMaks = new Date(Date.UTC(t, b, 0)).getUTCDate();
  return h <= hariMaks;
}

/**
 * Tanggal pertama dalam teks -> { tanggal "dd/mm/yyyy", awal, akhir } atau null.
 * Menerima 05-05-1990, 5/5/1990, 05.05.1990, 05 05 1990, dan 5 Mei 1990.
 */
export function cariTanggal(teks: string): { tanggal: string; awal: number; akhir: number } | null {
  const s = String(teks || "");
  const angka = /(\d{1,2}|[OoIl]\d|\d[OoIl])\s*[-/.\s]\s*(\d{1,2}|[OoIl]\d|\d[OoIl])\s*[-/.\s]\s*(\d{4}|\d{2}[OoIl]\d|\d[OoIl]\d\d)/.exec(s);
  if (angka) {
    const h = Number(angkaOcr(angka[1]));
    const b = Number(angkaOcr(angka[2]));
    const t = Number(angkaOcr(angka[3]));
    if (tanggalSah(h, b, t)) {
      return { tanggal: `${dua(h)}/${dua(b)}/${t}`, awal: angka.index, akhir: angka.index + angka[0].length };
    }
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

function bacaJenisKelamin(teks: string): JenisKelamin {
  const t = String(teks || "").toUpperCase();
  if (/PEREMPUAN|WANITA|^P\b/.test(t)) return "P";
  if (/LAKI|PRIA|^L\b/.test(t)) return "L";
  return "";
}

function bacaAgama(teks: string): string {
  const t = String(teks || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!t) return "";
  if (t.startsWith("ISL")) return "Islam";
  if (/KAT(H)?OL/.test(t)) return "Katolik";
  if (/KRIST|PROTES/.test(t)) return "Kristen";
  if (t.startsWith("HIND")) return "Hindu";
  if (/BUD+HA|BUDA/.test(t)) return "Budha";
  if (/KH?ONG?HU/.test(t)) return "Konghucu";
  if (/KEPERCAYAAN|LAIN/.test(t)) return "Lainnya";
  return hurufJudul(rapikan(teks));
}

function bacaStatusKawin(teks: string): string {
  const t = String(teks || "").toUpperCase();
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

/** Label pertama di awal baris -> [label, nilai sesudahnya] atau null. */
function cocokLabel(baris: string): [Label, string] | null {
  for (const [label, pola] of LABEL) {
    const m = pola.exec(baris);
    if (!m) continue;
    return [label, baris.slice(m[0].length)];
  }
  return null;
}

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
  for (const b of baris) {
    const cocok = cocokLabel(b);
    if (!cocok) {
      // Lanjutan alamat: satu baris tanpa label tepat sesudah Alamat.
      if (terakhir === "alamat" && medan.alamat && !/\d{6,}/.test(b)) {
        medan.alamat = rapikan(`${medan.alamat} ${hurufJudul(b)}`);
      }
      terakhir = null;
      continue;
    }
    const [label, sisa] = cocok;
    terakhir = label;
    let nilai = sisa;
    switch (label) {
      case "nik": {
        const angka = angkaOcr(nilai).replace(/[^\d]/g, "");
        setel("nik", angka.slice(0, 16));
        break;
      }
      case "nama":
        setel("nama", hurufJudul(rapikan(nilai)));
        break;
      case "ttl": {
        const tgl = cariTanggal(nilai);
        if (tgl) {
          setel("tanggalLahir", tgl.tanggal);
          setel("tempatLahir", hurufJudul(rapikan(nilai.slice(0, tgl.awal))));
        } else {
          setel("tempatLahir", hurufJudul(rapikan(nilai.split(",")[0] || "")));
        }
        break;
      }
      case "tempatLahir":
        setel("tempatLahir", hurufJudul(rapikan(nilai)));
        break;
      case "tanggalLahir": {
        const tgl = cariTanggal(nilai);
        if (tgl) setel("tanggalLahir", tgl.tanggal);
        break;
      }
      case "jenisKelamin": {
        // "PEREMPUAN Gol. Darah : O" - dua label dalam satu baris KTP.
        const potong = /\bGol(?:ongan)?\.?\s*Darah\b/i.exec(nilai);
        if (potong) {
          setel("golonganDarah", bacaGolonganDarah(nilai.slice(potong.index + potong[0].length)));
          nilai = nilai.slice(0, potong.index);
        }
        const jk = bacaJenisKelamin(rapikan(nilai));
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
        setel("alamat", hurufJudul(rapikan(nilai)));
        break;
      case "rtrw": {
        const m = /(\d{1,3})\s*[/\\]\s*(\d{1,3})/.exec(angkaOcr(nilai));
        if (m) {
          setel("rt", m[1].padStart(3, "0"));
          setel("rw", m[2].padStart(3, "0"));
        }
        break;
      }
      case "kelurahan":
        setel("kelurahan", rapikan(nilai));
        break;
      case "kecamatan":
        setel("kecamatan", rapikan(nilai));
        break;
      case "kabupatenLabel":
        setel("kabupaten", rapikan(nilai));
        break;
      case "kabupatenKepala":
        // Kepala KTP "KABUPATEN DONGGALA" / "KOTA PALU": awalannya DISIMPAN -
        // Kab. X dan Kota X dapat sama-sama ada.
        setel("kabupaten", rapikan(b));
        break;
      case "provinsi":
        setel("provinsi", rapikan(nilai));
        break;
      case "agama":
        setel("agama", bacaAgama(nilai));
        break;
      case "statusKawin":
        setel("statusKawin", bacaStatusKawin(nilai));
        break;
      case "pekerjaan":
        setel("pekerjaan", hurufJudul(rapikan(nilai)));
        break;
      case "kewarganegaraan":
        setel("kewarganegaraan", rapikan(nilai).toUpperCase());
        break;
      case "telepon": {
        const angka = rapikan(nilai).replace(/[^\d+]/g, "");
        if (angka.length >= 8) setel("telepon", angka);
        break;
      }
      default:
        break;
    }
  }

  // NIK tanpa label: deretan 16 angka di mana pun dalam teks.
  if (!medan.nik) {
    const m = /(?:^|\D)(\d{16})(?:\D|$)/.exec(baris.join("\n"));
    if (m) {
      medan.nik = m[1];
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

  if (medan.kewarganegaraan && !/WNI|INDONESIA/.test(medan.kewarganegaraan)) {
    catatan.push(`Kewarganegaraan terbaca "${medan.kewarganegaraan}" - wilayah SIPP hanya untuk WNI.`);
  }

  return { medan, nik, catatan, terbaca: [...terbaca] };
}
