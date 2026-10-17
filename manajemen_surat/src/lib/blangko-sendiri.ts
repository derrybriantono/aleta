import { POLA_NIK } from "@/lib/samarkan-sisa-rtf";
import { dekatArab, diapitKutip } from "@/lib/deteksi-sisa-blangko";

/**
 * ============================================================================
 * BUAT BLANGKO SENDIRI (18 Okt 2026) - bagian murni, tanpa basis data
 * ============================================================================
 *
 * Hakim, panitera, dan konseptor menyunting atau mengunggah blangko miliknya
 * (RTF/DOCX/PDF). Berkas dibaca menjadi paragraf, bagian yang tampak isian
 * dikenali, tiap bagian diusulkan ke isian ABT yang sudah ada, orangnya
 * mengonfirmasi, lalu blangko diekspor ke dua tujuan:
 *
 *   (a) RTF ber-penanda #nnnn# untuk folder blangko ABT (lewat paket yang
 *       disetujui Super Admin - ALETA tidak menulis ke folder ABT);
 *   (b) blangko Putusan Mandiri (putusan tanpa ABT).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - Usulan tidak pernah dianggap pasti: hanya penanda #nnnn# yang SUDAH ADA
 *     di naskah (dan dikenal katalog) yang otomatis terkonfirmasi.
 *   - Isian yang belum punya padanan di katalog ABT TIDAK dibuatkan - hanya
 *     diusulkan (tipe "baru") dan dicetak "..." pada hasil ekspor.
 *   - Contoh data perkara dari berkas asal tidak ikut ke daftar paket.
 *   - RTF hasil tanpa properti berkas (tanpa pengarang/perusahaan), dan tidak
 *     satu pun kata nama aplikasi ini boleh ada di isi maupun nama berkasnya.
 */

// ============================================================================
// Tipe
// ============================================================================

export type RataBagian = "kiri" | "tengah" | "kanan" | "justify";

export type BagianSendiri = {
  urutan: number;
  teks: string;
  rata: RataBagian;
  tebal: boolean;
};

export type JenisIsian =
  | "variabel"
  | "titik"
  | "kurung"
  | "nomor-perkara"
  | "tanggal"
  | "tanggal-hijriah"
  | "nama"
  | "nik"
  | "uang"
  | "umur"
  | "alamat";

export const LABEL_JENIS_ISIAN: Record<JenisIsian, string> = {
  variabel: "Isian ABT yang sudah ada",
  titik: "Titik-titik",
  kurung: "Kurung siku",
  "nomor-perkara": "Nomor perkara",
  tanggal: "Tanggal",
  "tanggal-hijriah": "Tanggal Hijriah",
  nama: "Nama",
  nik: "NIK",
  uang: "Jumlah uang",
  umur: "Umur",
  alamat: "Alamat",
};

export type IsianTerdeteksi = {
  id: string;
  /** Nomor urut bagian (BagianSendiri.urutan) tempat isian ini berada. */
  bagian: number;
  awal: number;
  akhir: number;
  asli: string;
  jenis: JenisIsian;
};

export type TipeSasaran = "variabel" | "baru" | "tetap";

export type Sasaran = {
  tipe: TipeSasaran;
  /** Nomor isian ABT (3-5 angka) bila tipe "variabel". */
  noVar: string;
  /** Nama isian yang diusulkan bila tipe "baru" (belum ada di ABT). */
  usulanNama: string;
  /** Kunci data SIPP yang menjadi asalnya (petunjuk, bukan perintah). */
  kunciData: string;
};

export type StatusButir = "usulan" | "dikonfirmasi" | "diabaikan";

export type KatalogVariabel = { noVar: string; judul: string };

export type UsulanSasaran = {
  noVar: string;
  judul: string;
  yakin: number;
  sebab: string;
};

export type ButirPemetaan = IsianTerdeteksi & {
  status: StatusButir;
  sasaran: Sasaran;
  yakin: number;
  sebab: string;
  usulan: UsulanSasaran[];
  /** Potongan teks di sekitar isian - untuk dibaca orangnya, bukan diproses. */
  konteks: string;
};

export const SASARAN_TETAP: Sasaran = { tipe: "tetap", noVar: "", usulanNama: "", kunciData: "" };

// ============================================================================
// Pembersih teks dan penjaga kata terlarang
// ============================================================================

const teks = (nilai: unknown): string => String(nilai ?? "");

/** Kata nama aplikasi ini tidak boleh masuk ke SIPP/ABT (isi, properti, nama berkas). */
export const POLA_TERLARANG = /aleta/i;

export function adaKataTerlarang(nilai: string): boolean {
  return POLA_TERLARANG.test(teks(nilai));
}

/** Nomor paragraf (urutan) yang memuat kata terlarang. */
export function bagianTerlarang(bagian: BagianSendiri[]): number[] {
  return bagian.filter((b) => adaKataTerlarang(b.teks)).map((b) => b.urutan);
}

/** Nama berkas aman untuk ABT: huruf kecil, tanpa kata terlarang, tanpa karakter aneh. */
export function namaBerkasAman(nama: string, ekstensi = "rtf"): string {
  const dasar = teks(nama)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/aleta/gi, "")
    .replace(/\.(rtf|docx?|pdf|txt)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${dasar || "blangko"}.${ekstensi}`;
}

export function bersihkanParagraf(nilai: string): string {
  return teks(nilai)
    .replace(/ /g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ============================================================================
// Paragraf -> bagian
// ============================================================================

const BATAS_BAGIAN = 4000;
export const BATAS_PANJANG_BAGIAN = 20000;

/** Judul dokumen dikenali dari bentuknya: seluruh huruf besar dan pendek. */
function judulKah(isi: string): boolean {
  return isi.length >= 3 && isi.length < 70 && isi === isi.toUpperCase() && /\p{Lu}{3}/u.test(isi);
}

/** Daftar teks paragraf menjadi bagian; paragraf kosong dibuang. */
export function bagianDariParagraf(daftar: string[]): { bagian: BagianSendiri[]; terpotong: boolean } {
  const bagian: BagianSendiri[] = [];
  let terpotong = false;
  for (const mentah of daftar) {
    const isi = bersihkanParagraf(mentah).slice(0, BATAS_PANJANG_BAGIAN);
    if (!isi) continue;
    if (bagian.length >= BATAS_BAGIAN) {
      terpotong = true;
      break;
    }
    const judul = judulKah(isi);
    bagian.push({ urutan: bagian.length + 1, teks: isi, rata: judul ? "tengah" : "justify", tebal: judul });
  }
  return { bagian, terpotong };
}

/** Teks bebas dari penyunting (satu baris = satu paragraf). */
export function bagianDariTeksBebas(nilai: string): { bagian: BagianSendiri[]; terpotong: boolean } {
  return bagianDariParagraf(teks(nilai).split(/\r\n|\r|\n/));
}

/**
 * Baris cetak PDF disambung menjadi paragraf. PDF hanya memuat baris cetak:
 * satu paragraf terpecah menjadi beberapa baris, dan batas aslinya hilang.
 * Baris yang tidak ditutup tanda akhir kalimat lalu disusul huruf kecil
 * disambung; perabot halaman ("1 dari 13 Halaman", nomor halaman) dibuang.
 */
export function gabungBarisPdf(baris: string[]): string[] {
  const hasil: string[] = [];
  for (const mentah of baris) {
    const b = bersihkanParagraf(mentah);
    if (!b) continue;
    if (/^\d+\s+dari\s+\d+\s+halaman$/i.test(b) || /^halaman\s+\d+(\s+dari\s+\d+)?$/i.test(b) || /^\d{1,3}$/.test(b)) continue;
    const terakhir = hasil[hasil.length - 1];
    if (terakhir && !/[.:;!?)”"]$/.test(terakhir) && /^[\p{Ll}(]/u.test(b)) hasil[hasil.length - 1] = `${terakhir} ${b}`;
    else hasil.push(b);
  }
  return hasil;
}

// ============================================================================
// Pendeteksi isian
// ============================================================================

const BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Nopember|Pebruari";
const HARI = "Senin|Selasa|Rabu|Kamis|Jumat|Jum'at|Sabtu|Minggu|Ahad";
const BULAN_HIJRIAH =
  "Muharram|Muharam|Safar|Rabiul\\s+Awal|Rabiul\\s+Akhir|Rabi'ul\\s+Awal|Rabi'ul\\s+Akhir|Jumadil\\s+Awal|Jumadil\\s+Akhir|Jumadil\\s+Ula|Jumadil\\s+Tsani|Rajab|Sya'?ban|Ramadhan|Ramadan|Syawal|Dzulqa'?dah|Zulkaidah|Dzulhijjah|Zulhijjah";

const KATA_PENGADILAN = new Set([
  "PENGADILAN", "AGAMA", "PUTUSAN", "PENETAPAN", "DEMI", "KEADILAN", "BERDASARKAN", "KETUHANAN", "YANG", "MAHA", "ESA",
  "MENGADILI", "MEMUTUSKAN", "DUDUK", "PERKARA", "TENTANG", "HUKUMNYA", "BERITA", "ACARA", "SIDANG", "MENGINGAT",
  "SALINAN", "PEMOHON", "TERMOHON", "PENGGUGAT", "TERGUGAT", "NOMOR", "ANTARA", "DAN", "MELAWAN", "KUASA", "HUKUM",
  "CERAI", "TALAK", "GUGAT", "DALAM", "DI", "DENGAN", "DAN", "ATAS", "RAHMAT", "REPUBLIK", "INDONESIA", "MAHKAMAH",
  "AGUNG", "SURAT", "RELAAS", "PANGGILAN", "PEMBERITAHUAN", "TENTANG", "PERTIMBANGAN", "HAKIM", "KETUA", "ANGGOTA",
  "PANITERA", "PENGGANTI", "JURUSITA", "SELURUHNYA", "SEBAGIAN", "BIAYA", "AMAR", "TERHADAP", "UNTUK",
]);

type Pola = {
  jenis: JenisIsian;
  re: RegExp;
  /** Bobot menang saat dua temuan bertumpuk. */
  bobot: number;
  /** Mengubah rentang temuan (mis. hanya angkanya); null = lewati. */
  rentang?: (m: RegExpExecArray, p: string) => [number, number] | null;
  lewati?: (m: RegExpExecArray, p: string, awal: number, akhir: number) => boolean;
};

const NAMA_KATA = "\\p{Lu}[\\p{L}'’.-]*";

const POLA: Pola[] = [
  { jenis: "variabel", re: /#(\d{3,5})#/g, bobot: 9 },
  { jenis: "nik", re: new RegExp(POLA_NIK.source, "g"), bobot: 8 },
  {
    jenis: "nomor-perkara",
    re: /\b\d{1,5}\/Pdt\.[A-Za-z]{1,4}(?:\.[A-Za-z]{1,4})?\/\d{4}\/PA\.?\s?[A-Za-z]+/g,
    bobot: 8,
  },
  {
    jenis: "tanggal-hijriah",
    re: new RegExp(`\\b\\d{1,2}\\s+(?:${BULAN_HIJRIAH})\\s+\\d{4}\\s*H\\b`, "gi"),
    bobot: 7,
  },
  {
    jenis: "tanggal",
    re: new RegExp(`(?:(?:${HARI}),?\\s+)?\\b\\d{1,2}\\s+(?:${BULAN})\\s+\\d{4}\\b`, "gi"),
    bobot: 7,
  },
  { jenis: "tanggal", re: /\b\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}\b/g, bobot: 6 },
  { jenis: "uang", re: /Rp\.?\s?\d[\d.,]*(?:,-)?/g, bobot: 6 },
  {
    jenis: "umur",
    re: /\b(?:umur|berumur|usia)\s+(\d{1,3})\s+tahun/gi,
    bobot: 6,
    rentang: (m) => {
      const angka = m[1];
      const dalam = m[0].lastIndexOf(angka);
      const awal = (m.index ?? 0) + dalam;
      return [awal, awal + angka.length];
    },
  },
  { jenis: "kurung", re: /\[([^[\]\n]{1,80})\]/g, bobot: 7, lewati: (m) => /^\s*\d{1,3}\s*$/.test(m[1]) || /^\s*sic\s*$/i.test(m[1]) },
  {
    jenis: "titik",
    re: /(?:\.{3,}|…+|_{3,}|(?:\.\s){3,}\.)/g,
    bobot: 2,
    lewati: (m, p, awal, akhir) => {
      // Tiga titik di tengah kalimat (disusul huruf kecil) bukan isian; kutipan ayat juga bukan.
      if (m[0].length === 3 && /^\s?\p{Ll}/u.test(p.slice(akhir, akhir + 2))) return true;
      if (/\b(?:dst|dll|dsb|dkk)\.?$/i.test(p.slice(Math.max(0, awal - 5), awal))) return true;
      return diapitKutip(p, awal) || dekatArab(p, awal, akhir);
    },
  },
  {
    jenis: "alamat",
    re: /(?:bertempat\s+tinggal|beralamat|bertempat\s+kediaman|tempat\s+kediaman|alamat)\s*(?:di|:)\s*([^,;\n]{3,80})/gi,
    bobot: 3,
    rentang: (m) => {
      const grup = m[1];
      const dalam = m[0].lastIndexOf(grup);
      const awal = (m.index ?? 0) + dalam;
      return [awal, awal + grup.trimEnd().length];
    },
    lewati: (m) => /^[.\s_…]+$/.test(m[1]) || /#\d{3,5}#/.test(m[1]),
  },
  {
    jenis: "nama",
    re: new RegExp(`${NAMA_KATA}(?:\\s+${NAMA_KATA}){0,4}\\s+(?:bin|binti|bint|BIN|BINTI|BINT)\\s+${NAMA_KATA}(?:\\s+${NAMA_KATA}){0,3}`, "gu"),
    bobot: 5,
  },
  {
    jenis: "nama",
    re: new RegExp(`\\b(?:Hj|H|Drs|Dra|Dr|Ir|Hj\\.|Prof)\\.\\s*${NAMA_KATA}(?:\\s+${NAMA_KATA}){0,3}`, "gu"),
    bobot: 4,
  },
  {
    jenis: "nama",
    re: /\b\p{Lu}{3,}(?:\s+\p{Lu}{2,}){1,4}\b/gu,
    bobot: 3,
    lewati: (m) => {
      const kata = m[0].split(/\s+/);
      const umum = kata.filter((k) => KATA_PENGADILAN.has(k)).length;
      return umum * 2 >= kata.length;
    },
  },
];

function kutipanSekitar(p: string, awal: number, akhir: number): string {
  const kiri = p.slice(Math.max(0, awal - 70), awal).replace(/\s+/g, " ");
  const kanan = p.slice(akhir, akhir + 30).replace(/\s+/g, " ");
  return `${awal > 70 ? "…" : ""}${kiri}⟦${p.slice(awal, akhir)}⟧${kanan}${akhir + 30 < p.length ? "…" : ""}`;
}

/** Mengenali bagian yang tampak isian pada tiap paragraf. */
export function deteksiIsian(bagian: BagianSendiri[]): IsianTerdeteksi[] {
  const hasil: IsianTerdeteksi[] = [];
  for (const b of bagian) {
    const p = b.teks;
    const calon: Array<{ jenis: JenisIsian; awal: number; akhir: number; bobot: number }> = [];
    for (const pola of POLA) {
      const re = new RegExp(pola.re.source, pola.re.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(p))) {
        if (m[0].length === 0) {
          re.lastIndex += 1;
          continue;
        }
        const awalPenuh = m.index;
        const akhirPenuh = m.index + m[0].length;
        if (pola.lewati?.(m, p, awalPenuh, akhirPenuh)) continue;
        const r = pola.rentang ? pola.rentang(m, p) : [awalPenuh, akhirPenuh];
        if (!r) continue;
        calon.push({ jenis: pola.jenis, awal: r[0], akhir: r[1], bobot: pola.bobot });
      }
    }
    // Yang bobotnya lebih tinggi (lalu lebih panjang) menang atas yang bertumpuk.
    calon.sort((x, y) => y.bobot - x.bobot || y.akhir - y.awal - (x.akhir - x.awal) || x.awal - y.awal);
    const diterima: typeof calon = [];
    for (const c of calon) {
      if (diterima.some((d) => c.awal < d.akhir && c.akhir > d.awal)) continue;
      diterima.push(c);
    }
    diterima.sort((x, y) => x.awal - y.awal);
    diterima.forEach((c, n) => {
      hasil.push({
        id: `b${b.urutan}-${n + 1}`,
        bagian: b.urutan,
        awal: c.awal,
        akhir: c.akhir,
        asli: p.slice(c.awal, c.akhir),
        jenis: c.jenis,
      });
    });
  }
  return hasil;
}

// ============================================================================
// Data SIPP yang lazim muncul di blangko, dan pencocokannya ke katalog ABT
// ============================================================================

type DataSipp = { kunci: string; label: string; kata: string[] };

export const DATA_SIPP: DataSipp[] = [
  { kunci: "nomor_perkara", label: "Nomor perkara", kata: ["nomor", "perkara"] },
  { kunci: "penggugat_nama", label: "Nama Penggugat/Pemohon", kata: ["penggugat", "pemohon", "nama"] },
  { kunci: "tergugat_nama", label: "Nama Tergugat/Termohon", kata: ["tergugat", "termohon", "nama"] },
  { kunci: "penggugat_alamat", label: "Alamat Penggugat/Pemohon", kata: ["penggugat", "pemohon", "alamat"] },
  { kunci: "tergugat_alamat", label: "Alamat Tergugat/Termohon", kata: ["tergugat", "termohon", "alamat"] },
  { kunci: "penggugat_umur", label: "Umur Penggugat/Pemohon", kata: ["penggugat", "pemohon", "umur"] },
  { kunci: "tergugat_umur", label: "Umur Tergugat/Termohon", kata: ["tergugat", "termohon", "umur"] },
  { kunci: "penggugat_nik", label: "NIK Penggugat/Pemohon", kata: ["penggugat", "pemohon", "nik"] },
  { kunci: "tergugat_nik", label: "NIK Tergugat/Termohon", kata: ["tergugat", "termohon", "nik"] },
  { kunci: "tanggal_sidang", label: "Tanggal sidang", kata: ["tanggal", "sidang"] },
  { kunci: "tanggal_putusan", label: "Tanggal putusan", kata: ["tanggal", "putusan"] },
  { kunci: "tanggal_pendaftaran", label: "Tanggal pendaftaran", kata: ["tanggal", "pendaftaran"] },
  { kunci: "tanggal_ikrar", label: "Tanggal ikrar talak", kata: ["tanggal", "ikrar"] },
  { kunci: "tanggal_nikah", label: "Tanggal pernikahan", kata: ["tanggal", "nikah"] },
  { kunci: "tanggal_lahir", label: "Tanggal lahir", kata: ["tanggal", "lahir"] },
  { kunci: "tanggal_umum", label: "Tanggal", kata: ["tanggal"] },
  { kunci: "ketua_majelis", label: "Ketua Majelis", kata: ["ketua", "majelis"] },
  { kunci: "hakim_anggota", label: "Hakim Anggota", kata: ["hakim", "anggota"] },
  { kunci: "panitera_pengganti", label: "Panitera Pengganti", kata: ["panitera", "pengganti"] },
  { kunci: "jurusita", label: "Jurusita", kata: ["jurusita"] },
  { kunci: "saksi_nama", label: "Nama saksi", kata: ["saksi", "nama"] },
  { kunci: "biaya_perkara", label: "Biaya perkara", kata: ["biaya", "perkara"] },
  { kunci: "nominal_uang", label: "Jumlah uang", kata: ["jumlah", "rp"] },
  { kunci: "nama_pihak", label: "Nama pihak", kata: ["nama", "pihak"] },
  { kunci: "alamat_pihak", label: "Alamat pihak", kata: ["alamat", "pihak"] },
];

const PIHAK_SATU = ["penggugat", "pemohon"];
const PIHAK_DUA = ["tergugat", "termohon"];

function potongKata(nilai: string): string[] {
  return teks(nilai)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

/** Peran/pembatas yang paling dekat di sebelah kiri isian (jendela teks huruf kecil). */
function peranTerdekat(jendela: string, daftar: Array<[string, RegExp]>): string {
  let terbaik = "";
  let posisi = -1;
  for (const [nama, re] of daftar) {
    const g = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = g.exec(jendela))) {
      if (m.index >= posisi) {
        posisi = m.index;
        terbaik = nama;
      }
    }
  }
  return terbaik;
}

const PERAN_PIHAK: Array<[string, RegExp]> = [
  ["satu", /penggugat|pemohon|istri|suami(?=\s+pemohon)/],
  ["dua", /tergugat|termohon/],
  ["saksi", /saksi/],
  ["ketua", /ketua\s+majelis|ketua/],
  ["anggota", /hakim\s+anggota|anggota/],
  ["pp", /panitera\s+pengganti/],
  ["jurusita", /juru\s*sita/],
];

const PERISTIWA_TANGGAL: Array<[string, RegExp]> = [
  ["sidang", /sidang|persidangan/],
  ["putusan", /putusan|diputus|putus/],
  ["pendaftaran", /didaftar|pendaftaran|terdaftar/],
  ["ikrar", /ikrar/],
  ["nikah", /menikah|nikah|perkawinan|akad/],
  ["lahir", /lahir/],
];

/**
 * Jenis yang sebenarnya untuk titik-titik/kurung: dibaca dari tulisan di
 * kirinya ("Nama : ........") atau dari isi kurungnya ("[tanggal sidang]").
 */
function jenisEfektif(isian: IsianTerdeteksi, label: string): JenisIsian {
  if (isian.jenis !== "titik" && isian.jenis !== "kurung") return isian.jenis;
  const l = label.toLowerCase();
  if (/hijriah|hijriyah/.test(l)) return "tanggal-hijriah";
  if (/\btanggal\b|\btgl\b/.test(l)) return "tanggal";
  if (/nomor\s+perkara|no\.?\s*perkara|perkara\s+nomor/.test(l)) return "nomor-perkara";
  if (/\bnik\b|nomor\s+induk/.test(l)) return "nik";
  if (/\bumur\b|\busia\b/.test(l)) return "umur";
  if (/alamat|bertempat\s+tinggal|kediaman/.test(l)) return "alamat";
  if (/\brp\b|biaya|jumlah\s+uang|nafkah|mut'?ah|panjar|mas\s+kawin/.test(l)) return "uang";
  if (/\bnama\b|\bbin\b|\bbinti\b|ketua|anggota|pengganti|jurusita|saksi|penggugat|pemohon|tergugat|termohon/.test(l)) return "nama";
  return isian.jenis;
}

function tentukanKunci(jenis: JenisIsian, label: string): { kunci: string; kuat: boolean } {
  const l = label.toLowerCase();
  const pihak = peranTerdekat(l, PERAN_PIHAK);
  const pihakKiri = pihak === "satu" ? "penggugat" : pihak === "dua" ? "tergugat" : "";
  switch (jenis) {
    case "nomor-perkara":
      return { kunci: "nomor_perkara", kuat: true };
    case "tanggal":
    case "tanggal-hijriah": {
      const p = peranTerdekat(l, PERISTIWA_TANGGAL);
      return p ? { kunci: `tanggal_${p}`, kuat: true } : { kunci: "tanggal_umum", kuat: false };
    }
    case "nama":
      if (pihakKiri) return { kunci: `${pihakKiri}_nama`, kuat: true };
      if (pihak === "saksi") return { kunci: "saksi_nama", kuat: true };
      if (pihak === "ketua") return { kunci: "ketua_majelis", kuat: true };
      if (pihak === "anggota") return { kunci: "hakim_anggota", kuat: true };
      if (pihak === "pp") return { kunci: "panitera_pengganti", kuat: true };
      if (pihak === "jurusita") return { kunci: "jurusita", kuat: true };
      return { kunci: "nama_pihak", kuat: false };
    case "alamat":
      return pihakKiri ? { kunci: `${pihakKiri}_alamat`, kuat: true } : { kunci: "alamat_pihak", kuat: false };
    case "umur":
      return pihakKiri ? { kunci: `${pihakKiri}_umur`, kuat: true } : { kunci: "", kuat: false };
    case "nik":
      return pihakKiri ? { kunci: `${pihakKiri}_nik`, kuat: true } : { kunci: "", kuat: false };
    case "uang":
      return /biaya/.test(l) ? { kunci: "biaya_perkara", kuat: true } : { kunci: "nominal_uang", kuat: false };
    default:
      return { kunci: "", kuat: false };
  }
}

function skorKatalog(def: DataSipp, entri: KatalogVariabel): number {
  const kata = new Set(potongKata(entri.judul));
  const pakaiSatu = def.kata.some((k) => PIHAK_SATU.includes(k));
  const pakaiDua = def.kata.some((k) => PIHAK_DUA.includes(k));
  const entriSatu = PIHAK_SATU.some((k) => kata.has(k));
  const entriDua = PIHAK_DUA.some((k) => kata.has(k));
  // Isian milik pihak lain tidak boleh dicocokkan (Penggugat vs Tergugat).
  if (pakaiSatu && entriDua && !entriSatu) return 0;
  if (pakaiDua && entriSatu && !entriDua) return 0;
  // Isian khusus peristiwa lain tidak dicocokkan ke kunci umum.
  if (def.kunci === "tanggal_umum" && ["sidang", "putusan", "pendaftaran", "ikrar", "nikah", "lahir"].some((k) => kata.has(k))) return 0;
  // Pihak pertama/kedua dihitung satu kata (Penggugat/Pemohon sepadan).
  const kuncinya = def.kata.filter((k) => !PIHAK_SATU.includes(k) && !PIHAK_DUA.includes(k));
  const syaratPihak = pakaiSatu || pakaiDua ? 1 : 0;
  const cocokPihak = syaratPihak && (entriSatu || entriDua) ? 1 : 0;
  const cocokKata = kuncinya.filter((k) => kata.has(k)).length;
  const total = kuncinya.length + syaratPihak;
  return total ? (cocokKata + cocokPihak) / total : 0;
}

function bulatkan(n: number): number {
  return Math.round(n * 100) / 100;
}

function usulkanDariKatalog(kunci: string, kuat: boolean, katalog: KatalogVariabel[]): UsulanSasaran[] {
  const def = DATA_SIPP.find((d) => d.kunci === kunci);
  if (!def) return [];
  return katalog
    .map((e) => ({ e, skor: skorKatalog(def, e) }))
    .filter((x) => x.skor >= 0.66)
    .sort((a, b) => b.skor - a.skor || a.e.judul.length - b.e.judul.length || a.e.noVar.localeCompare(b.e.noVar))
    .slice(0, 3)
    .map((x) => ({
      noVar: x.e.noVar,
      judul: x.e.judul,
      yakin: bulatkan(Math.min(0.9, 0.3 + 0.6 * x.skor * (kuat ? 1 : 0.6))),
      sebab: `Judul isian cocok dengan "${def.label}"`,
    }));
}

/** Nomor isian ABT yang sah (3-5 angka). */
export function noVarSah(nilai: unknown): boolean {
  return /^\d{3,5}$/.test(teks(nilai).trim());
}

/**
 * Mengusulkan sasaran tiap isian. Tidak ada yang dikonfirmasi di sini kecuali
 * penanda #nnnn# yang sudah ada di naskah dan dikenal katalog.
 */
export function usulkanPemetaan(bagian: BagianSendiri[], isian: IsianTerdeteksi[], katalog: KatalogVariabel[]): ButirPemetaan[] {
  const peta = new Map(bagian.map((b) => [b.urutan, b]));
  const kenal = new Map(katalog.map((k) => [k.noVar, k]));
  const hasil: ButirPemetaan[] = [];

  for (const i of isian) {
    const b = peta.get(i.bagian);
    const p = b?.teks ?? "";
    const dasar: ButirPemetaan = {
      ...i,
      status: "usulan",
      sasaran: { ...SASARAN_TETAP },
      yakin: 0.1,
      sebab: "Tidak ada petunjuk di sekitarnya - tinjau sendiri.",
      usulan: [],
      konteks: kutipanSekitar(p, i.awal, i.akhir),
    };

    if (i.jenis === "variabel") {
      const noVar = i.asli.replace(/#/g, "");
      const ada = kenal.get(noVar);
      if (ada || katalog.length === 0) {
        hasil.push({
          ...dasar,
          status: "dikonfirmasi",
          sasaran: { tipe: "variabel", noVar, usulanNama: "", kunciData: "" },
          yakin: ada ? 1 : 0.8,
          sebab: ada ? `Isian "${ada.judul}" sudah ada di blangko ini.` : "Penanda sudah ada di blangko; katalog belum termuat untuk diperiksa.",
          usulan: ada ? [{ noVar, judul: ada.judul, yakin: 1, sebab: "Sudah ada di blangko" }] : [],
        });
      } else {
        hasil.push({
          ...dasar,
          sasaran: { tipe: "variabel", noVar, usulanNama: "", kunciData: "" },
          yakin: 0.3,
          sebab: `Nomor ${noVar} tidak ditemukan di katalog isian ABT - periksa nomornya.`,
        });
      }
      continue;
    }

    // Tulisan di kiri isian (satu kalimat/baris terakhir) dan, untuk kurung, isi kurungnya.
    const kiri = p.slice(Math.max(0, i.awal - 80), i.awal);
    const potongKiri = kiri.split(/[.;\n]/).pop() ?? kiri;
    const dalamKurung = i.jenis === "kurung" ? i.asli.slice(1, -1) : "";
    const label = `${dalamKurung} ${potongKiri}`;
    const jenis = jenisEfektif(i, label);
    const { kunci, kuat } = tentukanKunci(jenis, label);

    if (!kunci) {
      hasil.push(dasar);
      continue;
    }

    const def = DATA_SIPP.find((d) => d.kunci === kunci);
    const usulan = usulkanDariKatalog(kunci, kuat, katalog);
    if (usulan.length > 0) {
      const atas = usulan[0];
      hasil.push({
        ...dasar,
        sasaran: { tipe: "variabel", noVar: atas.noVar, usulanNama: "", kunciData: kunci },
        yakin: atas.yakin,
        sebab: `${atas.sebab}${kuat ? "" : " (dugaan dari bentuk tulisannya)"}`,
        usulan,
      });
    } else {
      hasil.push({
        ...dasar,
        sasaran: { tipe: "baru", noVar: "", usulanNama: def?.label ?? "", kunciData: kunci },
        yakin: kuat ? 0.35 : 0.2,
        sebab: `Tampak seperti "${def?.label ?? kunci}", tetapi belum ada isian ABT yang cocok - hanya dapat diusulkan.`,
      });
    }
  }
  return hasil;
}

/** Kunci stabil sebuah isian untuk membawa keputusan lama saat blangko disunting. */
function sidikIsian(i: { bagian: number; jenis: string; asli: string }): string {
  return `${i.bagian}|${i.jenis}|${i.asli}`;
}

/**
 * Pemetaan baru atas isi yang disunting; keputusan lama dibawa untuk isian yang
 * sama (bagian, jenis, dan tulisan asli sama - urutan kemunculan dihitung).
 */
export function bawaKeputusan(baru: ButirPemetaan[], lama: ButirPemetaan[]): ButirPemetaan[] {
  const simpanan = new Map<string, ButirPemetaan[]>();
  for (const l of lama) {
    if (l.status === "usulan") continue;
    const k = sidikIsian(l);
    simpanan.set(k, [...(simpanan.get(k) ?? []), l]);
  }
  return baru.map((b) => {
    const antre = simpanan.get(sidikIsian(b));
    const l = antre?.shift();
    if (!l) return b;
    return { ...b, status: l.status, sasaran: l.sasaran, yakin: l.yakin, sebab: l.sebab };
  });
}

// ============================================================================
// Keputusan orang
// ============================================================================

export type KeputusanButir = { id: string; status: StatusButir; sasaran?: Partial<Sasaran> };

export function bersihkanSasaran(masukan: Partial<Sasaran> | undefined): Sasaran {
  const tipe: TipeSasaran = masukan?.tipe === "variabel" || masukan?.tipe === "baru" ? masukan.tipe : "tetap";
  if (tipe === "variabel") {
    const noVar = teks(masukan?.noVar).trim();
    if (!noVarSah(noVar)) throw new Error("Nomor isian ABT harus 3 sampai 5 angka.");
    return { tipe, noVar, usulanNama: "", kunciData: teks(masukan?.kunciData).slice(0, 60) };
  }
  if (tipe === "baru") {
    const usulanNama = teks(masukan?.usulanNama).replace(/\s+/g, " ").trim().slice(0, 80);
    if (!usulanNama) throw new Error("Isian baru perlu diberi nama usulan.");
    if (adaKataTerlarang(usulanNama)) throw new Error("Nama usulan memuat kata yang tidak boleh masuk ke blangko ABT.");
    return { tipe, noVar: "", usulanNama, kunciData: teks(masukan?.kunciData).slice(0, 60) };
  }
  return { ...SASARAN_TETAP };
}

/** Menerapkan keputusan; keputusan untuk isian yang tak dikenal diabaikan. */
export function terapkanKeputusan(pemetaan: ButirPemetaan[], keputusan: KeputusanButir[]): ButirPemetaan[] {
  const per = new Map(keputusan.map((k) => [k.id, k]));
  return pemetaan.map((b) => {
    const k = per.get(b.id);
    if (!k) return b;
    if (k.status !== "usulan" && k.status !== "dikonfirmasi" && k.status !== "diabaikan") return b;
    if (k.status === "diabaikan") return { ...b, status: "diabaikan", sasaran: { ...SASARAN_TETAP } };
    if (k.status === "usulan") return { ...b, status: "usulan" };
    const sasaran = bersihkanSasaran(k.sasaran ?? b.sasaran);
    return { ...b, status: "dikonfirmasi", sasaran, yakin: 1, sebab: "Dikonfirmasi pemilik blangko." };
  });
}

/** Mengonfirmasi usulan yang yakinnya setinggi batas (bukan yang masih "tetap"). */
export function terimaUsulanYakin(pemetaan: ButirPemetaan[], batas = 0.8): { pemetaan: ButirPemetaan[]; diterima: number } {
  let diterima = 0;
  const hasil = pemetaan.map((b) => {
    if (b.status !== "usulan" || b.sasaran.tipe !== "variabel" || b.yakin < batas) return b;
    diterima += 1;
    return { ...b, status: "dikonfirmasi" as const };
  });
  return { pemetaan: hasil, diterima };
}

export type RingkasPemetaan = {
  jumlah: number;
  dikonfirmasi: number;
  diabaikan: number;
  belumDiputus: number;
  keIsianAda: number;
  keIsianBaru: number;
  tetap: number;
};

export function ringkasPemetaan(pemetaan: ButirPemetaan[]): RingkasPemetaan {
  const r: RingkasPemetaan = { jumlah: pemetaan.length, dikonfirmasi: 0, diabaikan: 0, belumDiputus: 0, keIsianAda: 0, keIsianBaru: 0, tetap: 0 };
  for (const b of pemetaan) {
    if (b.status === "usulan") r.belumDiputus += 1;
    else if (b.status === "diabaikan") r.diabaikan += 1;
    else {
      r.dikonfirmasi += 1;
      if (b.sasaran.tipe === "variabel") r.keIsianAda += 1;
      else if (b.sasaran.tipe === "baru") r.keIsianBaru += 1;
      else r.tetap += 1;
    }
  }
  return r;
}

// ============================================================================
// Menyusun naskah dari bagian + pemetaan
// ============================================================================

export const TANDA_KOSONG_BLANGKO = "...";

/**
 * Naskah per bagian setelah pemetaan: isian terkonfirmasi ke isian ABT menjadi
 * #nnnn#; ke isian baru menjadi "..." (tidak pernah dibuat otomatis); sisanya
 * (belum diputus, diabaikan, tetap) tetap sebagaimana tertulis.
 */
export function terapkanPemetaan(bagian: BagianSendiri[], pemetaan: ButirPemetaan[]): BagianSendiri[] {
  const per = new Map<number, ButirPemetaan[]>();
  for (const b of pemetaan) per.set(b.bagian, [...(per.get(b.bagian) ?? []), b]);
  return bagian.map((b) => {
    const daftar = [...(per.get(b.urutan) ?? [])].sort((x, y) => y.awal - x.awal);
    let isi = b.teks;
    for (const d of daftar) {
      if (d.status !== "dikonfirmasi") continue;
      // Isian yang hanya angkanya/lanjutannya (umur, alamat) diganti pada rentangnya saja;
      // kurung siku dan titik-titik diganti seluruhnya karena rentangnya sudah seluruhnya.
      if (d.sasaran.tipe === "variabel") isi = isi.slice(0, d.awal) + `#${d.sasaran.noVar}#` + isi.slice(d.akhir);
      else if (d.sasaran.tipe === "baru") isi = isi.slice(0, d.awal) + TANDA_KOSONG_BLANGKO + isi.slice(d.akhir);
    }
    return { ...b, teks: isi };
  });
}

/** Isian "tetap" yang tampak seperti data perkara - diperingatkan sebelum ekspor. */
export function sisaDataTampak(pemetaan: ButirPemetaan[]): ButirPemetaan[] {
  const data: JenisIsian[] = ["nomor-perkara", "nama", "nik", "tanggal", "tanggal-hijriah", "alamat", "umur", "uang"];
  return pemetaan.filter((b) => {
    if (!data.includes(b.jenis)) return false;
    // Yang belum diputus atau dibiarkan tetap akan tercetak apa adanya.
    return b.status === "usulan" || b.status === "diabaikan" || (b.status === "dikonfirmasi" && b.sasaran.tipe === "tetap");
  });
}

// ============================================================================
// RTF dan daftar isian untuk paket ABT
// ============================================================================

function hurufRtf(kode: number, huruf: string): string {
  if (huruf === "\\" || huruf === "{" || huruf === "}") return "\\" + huruf;
  if (huruf === "\t") return "\\tab ";
  if (kode < 0x20) return "";
  if (kode < 0x80) return huruf;
  const n = kode > 0x7fff ? kode - 0x10000 : kode;
  return `\\u${n}?`;
}

export function teksKeRtfAman(isi: string): string {
  let hasil = "";
  for (const unit of String(isi ?? "").split("")) hasil += hurufRtf(unit.charCodeAt(0), unit);
  return hasil;
}

const KODE_RATA: Record<RataBagian, string> = { kiri: "\\ql", tengah: "\\qc", kanan: "\\qr", justify: "\\qj" };

/**
 * RTF polos: Times New Roman 12, kertas F4, tanpa kelompok \info (tanpa
 * pengarang/perusahaan/judul) sehingga tidak ada properti berkas yang bocor.
 */
export function bangunRtf(bagian: BagianSendiri[]): string {
  const isi = bagian
    .map((b) => {
      const t = teksKeRtfAman(b.teks);
      const isiTebal = b.tebal ? `\\b ${t}\\b0` : t;
      return `\\pard${KODE_RATA[b.rata] ?? "\\qj"}\\sa120 ${isiTebal}\\par`;
    })
    .join("\n");
  return (
    "{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}\n" +
    "\\viewkind4\\uc1\\paperw11906\\paperh18709\\margl1701\\margr1134\\margt1134\\margb1134\n" +
    "\\f0\\fs24\n" +
    isi +
    "\n}"
  );
}

export type ButirDaftarPaket = {
  dipakai: Array<{ noVar: string; judul: string; jumlah: number; kunciData: string }>;
  tidakDikenal: Array<{ noVar: string; jumlah: number }>;
  usulanBaru: Array<{ usulanNama: string; kunciData: string; jumlah: number; bagian: number[] }>;
  tetapBerdata: number;
};

/** Daftar isian untuk paket; tanpa contoh data dari berkas asal. */
export function daftarIsianPaket(pemetaan: ButirPemetaan[], katalog: KatalogVariabel[]): ButirDaftarPaket {
  const kenal = new Map(katalog.map((k) => [k.noVar, k.judul]));
  const dipakai = new Map<string, { noVar: string; judul: string; jumlah: number; kunciData: string }>();
  const tidak = new Map<string, number>();
  const baru = new Map<string, { usulanNama: string; kunciData: string; jumlah: number; bagian: Set<number> }>();

  for (const b of pemetaan) {
    if (b.status !== "dikonfirmasi") continue;
    if (b.sasaran.tipe === "variabel") {
      const judul = kenal.get(b.sasaran.noVar);
      if (judul === undefined && katalog.length > 0) {
        tidak.set(b.sasaran.noVar, (tidak.get(b.sasaran.noVar) ?? 0) + 1);
        continue;
      }
      const ada = dipakai.get(b.sasaran.noVar) ?? { noVar: b.sasaran.noVar, judul: judul ?? "", jumlah: 0, kunciData: b.sasaran.kunciData };
      ada.jumlah += 1;
      dipakai.set(b.sasaran.noVar, ada);
    } else if (b.sasaran.tipe === "baru") {
      const k = `${b.sasaran.usulanNama}|${b.sasaran.kunciData}`;
      const ada = baru.get(k) ?? { usulanNama: b.sasaran.usulanNama, kunciData: b.sasaran.kunciData, jumlah: 0, bagian: new Set<number>() };
      ada.jumlah += 1;
      ada.bagian.add(b.bagian);
      baru.set(k, ada);
    }
  }
  return {
    dipakai: [...dipakai.values()].sort((a, b) => a.noVar.localeCompare(b.noVar)),
    tidakDikenal: [...tidak].map(([noVar, jumlah]) => ({ noVar, jumlah })).sort((a, b) => a.noVar.localeCompare(b.noVar)),
    usulanBaru: [...baru.values()].map((x) => ({ ...x, bagian: [...x.bagian].sort((a, b) => a - b) })),
    tetapBerdata: sisaDataTampak(pemetaan).length,
  };
}

/** Berkas daftar isian (teks biasa) yang menyertai RTF dalam paket. */
export function susunDaftarIsianTxt(daftar: ButirDaftarPaket, opsi: { nama: string; jenis: string }): string {
  const baris: string[] = [];
  baris.push(`DAFTAR ISIAN BLANGKO: ${opsi.nama}`);
  baris.push(`Jenis: ${opsi.jenis || "-"}`);
  baris.push("");
  baris.push("A. Isian ABT yang dipakai blangko ini");
  if (daftar.dipakai.length === 0) baris.push("   (tidak ada)");
  for (const d of daftar.dipakai) baris.push(`   #${d.noVar}#  ${d.judul || "-"}  (${d.jumlah}x)`);
  if (daftar.tidakDikenal.length > 0) {
    baris.push("");
    baris.push("B. Nomor yang TIDAK ditemukan di katalog ABT (periksa sebelum dipasang)");
    for (const d of daftar.tidakDikenal) baris.push(`   #${d.noVar}#  (${d.jumlah}x)`);
  }
  baris.push("");
  baris.push("C. Isian baru yang DIUSULKAN (belum ada di ABT, tidak dibuat otomatis; tercetak ... pada blangko)");
  if (daftar.usulanBaru.length === 0) baris.push("   (tidak ada)");
  for (const u of daftar.usulanBaru) {
    baris.push(`   ${u.usulanNama}  [asal data: ${u.kunciData || "-"}]  (${u.jumlah}x, paragraf ${u.bagian.join(", ")})`);
  }
  baris.push("");
  baris.push("Catatan: berkas ini tidak ditulis ke ABT oleh sistem. Pemasangan dilakukan manual oleh Super Admin setelah paket disetujui.");
  return baris.join("\n");
}

// ============================================================================
// Hak
// ============================================================================

/** Peran yang boleh membuat blangko sendiri (peran utama berlaku). */
export const PERAN_BUAT_BLANGKO_SENDIRI: ReadonlySet<string> = new Set([
  "super-admin",
  "hakim",
  "ketua",
  "wakil-ketua",
  "panitera",
  "panitera-muda",
  "panitera-pengganti",
]);

export function bolehBuatBlangkoSendiri(roleId: string | null | undefined): boolean {
  return PERAN_BUAT_BLANGKO_SENDIRI.has(teks(roleId));
}

export function superAdminKah(roleId: string | null | undefined): boolean {
  return teks(roleId) === "super-admin";
}

export const JENIS_BLANGKO_SENDIRI = ["putusan", "penetapan", "bas", "relaas", "lain"] as const;
export type JenisBlangkoSendiri = (typeof JENIS_BLANGKO_SENDIRI)[number];

export const LABEL_JENIS_BLANGKO: Record<JenisBlangkoSendiri, string> = {
  putusan: "Putusan",
  penetapan: "Penetapan",
  bas: "Berita acara sidang",
  relaas: "Relaas",
  lain: "Lainnya",
};

export function jenisBlangkoSah(nilai: unknown): nilai is JenisBlangkoSendiri {
  return (JENIS_BLANGKO_SENDIRI as readonly string[]).includes(teks(nilai));
}
