/**
 * ============================================================================
 * ANONIMISASI PUTUSAN MANDIRI ALETA (16 Okt 2026, F4.3)
 * ============================================================================
 *
 * Menyamarkan RTF putusan TANPA rute main/anonim ABT. ABT hanya mengganti
 * nama/alamat/pekerjaan SIPP yang utuh persis hurufnya; nasab anak, saksi, dan
 * bukti lolos (lihat samarkan-sisa-rtf.ts: 54% dari 251 pasangan ditolak
 * penjaga unggah). Penyamar ini memakai data SIPP perkara (pihak, saksi, anak,
 * alamat, NIK, telepon, tanggal lahir - entitasAnonimService di bot) DITAMBAH
 * pola teks naskah pengadilan agama.
 *
 * ACUAN: SK KMA 2-144/KMA/SK/VIII/2022 (Standar Pelayanan Informasi Publik di
 * Pengadilan, pengganti SK KMA 1-144/KMA/SK/I/2011). Yang terbaca dari
 * ringkasan resmi/sekunder (teks utuh lampiran BELUM dibaca langsung):
 *   - perkara perkawinan & akibatnya, pengangkatan anak, wasiat, perdata agama
 *     tertutup: identitas PARA PIHAK, SAKSI, dan PIHAK TERKAIT dikaburkan;
 *   - unsur: nama & alias, NIK/paspor, pekerjaan, tempat bekerja, identitas
 *     kepegawaian, sekolah/lembaga pendidikan; alamat cukup kabupaten/kota;
 *   - naskah elektronik: diganti "istilah lain" (contoh resmi "ANAK KORBAN I").
 * PERLU DICEK pada teks resmi: tempat & tanggal lahir, nomor telepon/rekening
 * (diikutkan atas permintaan pengguna - data pribadi yang dapat menunjuk
 * orang), dan nomor perkara (TIDAK disamarkan, sesuai praktik direktori).
 * Hakim, panitera, juru sita, mediator, dan kuasa/advokat TIDAK disamarkan.
 *
 * BENTUK SAMARAN (konsisten satu naskah):
 *   pihak     PENGGUGAT / TERGUGAT / PEMOHON / TERMOHON (+ I, II bila lebih
 *             dari satu di sisi yang sama), INTERVENSI, TURUT TERGUGAT
 *   saksi     SAKSI I, SAKSI II, ... menurut urutan pertama muncul
 *   anak      ANAK I, ANAK II, ...
 *   lainnya   "xxx" (nama orang tua/orang lain, alamat, NIK 16 "x", nomor,
 *             tempat & tanggal lahir, pekerjaan, sekolah) - bentuk satker/ABT
 *
 * Yang disamarkan hanya SALINAN; putusan asli tidak disentuh. Penyamaran
 * dikerjakan di atas teks datar petaRtf lalu dipetakan balik ke sumber RTF,
 * sehingga format (tebal, tab, paragraf) tetap.
 */
import { bentukNamaPihak, lenturkanApostrof, polaNama } from "@/lib/anonim-nama-pihak";
import { KATA_DEPAN_UMUM, POLA_NIK, depanMilikPihak, petaRtf, polaSasaran, sasaranNamaPihak, type Sasaran } from "@/lib/samarkan-sisa-rtf";

export type OrangSipp = {
  nama: string;
  alamat?: string;
  rtrw?: string;
  nik?: string;
  telepon?: string;
  email?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  pekerjaan?: string;
  namaAyah?: string;
  namaIbu?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
  urutan?: number;
};

export type EntitasAnonim = {
  sebutan?: { satu: string; dua: string };
  pihak: Array<OrangSipp & { pihakKe: number }>;
  saksi?: OrangSipp[];
  anak?: OrangSipp[];
  /** Nama yang TIDAK PERNAH disamarkan: majelis, PP, juru sita, mediator, kuasa. */
  lindungi?: Array<{ peran?: string; nama: string } | string>;
  tidakTerbaca?: string[];
};

export type OpsiAnonim = {
  /** Tempat & tanggal lahir (bawaan ya; dasar pedomannya perlu dicek). */
  ttl?: boolean;
  pekerjaan?: boolean;
  alamat?: boolean;
  /** Pola teks di luar data SIPP: "X bin Y", "bernama X", "X, umur N tahun". */
  polaUmum?: boolean;
};

export type JenisSamaran =
  | "nama pihak"
  | "nama saksi"
  | "nama anak"
  | "nama orang lain"
  | "NIK"
  | "nomor telepon"
  | "nomor rekening"
  | "email"
  | "NIP"
  | "tempat & tanggal lahir"
  | "alamat"
  | "pekerjaan"
  | "sekolah";

export type GantiAnonim = { mulai: number; akhir: number; menjadi: string; jenis: JenisSamaran; asal: string };
export type SisaAnonim = { jenis: string; kata: string; konteks: string };
export type HasilAnonimTeks = {
  teks: string;
  ganti: GantiAnonim[];
  sisa: SisaAnonim[];
  /** Pola "X bin Y" yang sengaja dilewati (kutipan kitab/hadis) - untuk diperiksa. */
  dilewati: SisaAnonim[];
};

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
export const romawi = (n: number) => ROMAWI[n - 1] ?? String(n);

const HURUF = "\\p{L}\\p{N}";
/** Satu kata nama: berawal huruf besar ("Muh.", "La", "MELKI", "A."). */
const KATA_NAMA = "\\p{Lu}[\\p{L}'’`-]*\\.?";
const DERET_NAMA = `${KATA_NAMA}(?:[ \\t]+${KATA_NAMA}){0,5}`;

/** Kata yang membuka/menutup deret huruf besar tetapi bukan bagian nama. */
const BUKAN_KATA_NAMA = new Set(
  (
    "bahwa bin binti alias yang dan atau dengan oleh dari kepada untuk pada di ke dalam sebagai selaku antara " +
    "penggugat tergugat pemohon termohon pembanding terbanding intervensi turut saksi anak kuasa " +
    "hukum hakim majelis ketua anggota panitera pengganti juru sita jurusita mediator pengadilan agama " +
    "negeri tinggi mahkamah kantor urusan kua dinas kepala desa kelurahan dusun kecamatan kabupaten kota " +
    "provinsi jalan jl lorong rt rw btn bernama nama atas almarhum almarhumah alm almh bapak ibu ayah tuan " +
    "nyonya sdr sdri nip nik saudara saudari kakak adik paman bibi tante om nenek kakek ipar mertua menantu sepupu " +
    "suami istri isteri tetangga teman kandung tiri angkat ia dia mereka kami kita saya beliau tersebut " +
    "allah swt saw islam republik indonesia nomor no tanggal tahun bulan hari umur usia lahir pekerjaan " +
    "agama alamat menimbang mengingat mengadili menetapkan putusan penetapan pertimbangan duduk perkara " +
    "fotokopi foto kopi kutipan akta nikah cerai kartu keluarga tanda penduduk surat keterangan bukti " +
    "pt cv ud bank koperasi masjid sekolah universitas rumah sakit puskesmas polres polsek kodim koramil " +
    "senin selasa rabu kamis jumat jum'at sabtu minggu januari februari maret april mei juni juli agustus " +
    "september oktober november desember menyatakan menghukum membebankan mengabulkan menolak memerintahkan"
  ).split(/\s+/)
);
/** Sebutan dan jabatan - tidak pernah menjadi sasaran walau tercatat sebagai "nama" di SIPP. */
const PERAN = /^(?:penggugat|tergugat|pemohon|termohon|pengadilan|majelis|hakim|panitera|juru\s*sita|jurusita|mediator|ketua|anggota|saksi|kuasa|anak|nama|tidak ada)\b/i;
const kataBukanNama = (k: string) => BUKAN_KATA_NAMA.has(k.toLowerCase().replace(/[.'’`]/g, ""));

/** Kalimat kutipan kitab/hadis/ulama: "Abdullah bin Umar" di sana bukan orang perkara. */
// Diukur atas 251 putusan PA Donggala 2025-2026: kata umum (imam, ibnu, firman, syar'i,
// fikih) menahan nama orang perkara ("binti Imam Saroni", "bin Firman") dan TIDAK SATU PUN
// menandai kutipan sungguhan - jadi yang dipakai hanya penanda kutipan yang khas.
const KUTIPAN =
  /\bhadi[st]s?\b|\bhadits\b|diriwayatkan|\bH\.?R\.\s|\bkitab\b|\bsy[ae]i?kh\b|rasulullah|\bnabi\b|radhiy|\br\.a\.|shallallah|\bSAW\b|al-?qur'?an|karangan|pengarang|\bjuz\b|\bhal(?:aman|\.)\s*\d/i;

/** Awal bagian kabupaten/kota sebuah alamat - yang tetap tertulis menurut pedoman. */
const POLA_KAB = /(?<![\p{L}])(?:Kabupaten|KABUPATEN|Kab\.|KAB\.|Kota(?!\s*madya)|KOTA(?!\s*MADYA)|Kotamadya|KOTAMADYA)\s+\p{Lu}/gu;

const GELAR_DEPAN = /^(?:prof|dr|drs|dra|ir|h|hj|kh|hajjah|haji|st|nyonya|ny|tuan|tn|sdr|sdri)\.?$/i;

/**
 * Kata PERTAMA nama diri yang bermakna untuk periksa sisa: berhuruf kapital,
 * minimal 3 huruf, bukan gelar/awalan umum ("Muh.", "Siti", "Andi"), bukan
 * sebutan/jabatan atau kata umum. Nama satu kata sudah diperiksa utuh - null.
 */
export function kataDepanBermakna(diri: string): string | null {
  const kata = String(diri ?? "").replace(/\s+/g, " ").trim().split(" ");
  if (kata.length < 2) return null;
  for (const k of kata) {
    if (KATA_DEPAN_UMUM.test(k) || GELAR_DEPAN.test(k)) continue;
    const huruf = k.replace(/[^\p{L}]/gu, "");
    if (huruf.length < 3 || !/^\p{Lu}/u.test(k) || PERAN.test(k) || kataBukanNama(k)) return null;
    return k.replace(/[.,]+$/, "");
  }
  return null;
}

/** Nama inti tanpa gelar: "Drs. H. Ahmad Yani, M.H." -> "Ahmad Yani". */
export function namaTanpaGelar(nama: string): string {
  const depan = String(nama ?? "").split(",")[0];
  const kata = depan.replace(/\s+/g, " ").trim().split(" ");
  while (kata.length > 1 && GELAR_DEPAN.test(kata[0])) kata.shift();
  return kata.join(" ").trim();
}

function amanRegex(teks: string): string {
  return lenturkanApostrof(
    String(teks)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\.\s+/g, "\\.?\\s*")
      .replace(/\s+/g, "\\s*")
      .replace(/\\\.(?!\?)/g, "\\.?")
  );
}
function polaLentur(teks: string): RegExp {
  return new RegExp(`(?<![${HURUF}])${amanRegex(teks)}(?![${HURUF}])`, "giu");
}

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];

/** Bentuk tulisan sebuah tanggal ISO di naskah: "12 Januari 1990", "12-01-1990", "12/01/1990". */
export function bentukTanggal(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return [];
  const [, y, mo, d] = m;
  const dd = String(Number(d));
  const bulan = BULAN[Number(mo) - 1];
  if (!bulan) return [];
  const Bulan = bulan[0].toUpperCase() + bulan.slice(1);
  return [`${d} ${Bulan} ${y}`, `${dd} ${Bulan} ${y}`, `${d}-${mo}-${y}`, `${d}/${mo}/${y}`, `${dd}-${mo}-${y}`, `${d}.${mo}.${y}`, `${y}-${mo}-${d}`];
}

type Calon = Sasaran & { label: string; jenisSamar: JenisSamaran; kunci: string };

/** Sasaran nama satu orang: bentuk SIPP (utuh, ruas alias, nama diri, potongan depan) + tanpa gelar haji. */
function sasaranOrang(nama: string): Sasaran[] {
  // Ruas dan nama diri ikut diumpankan: sasaranNamaPihak melewati nama di atas 80 huruf
  // (nama ber-alias berlapis: "Eka binti Ahmad alias Ahmad Yambo alias ...").
  const bentuk = bentukNamaPihak(nama);
  const hasil = sasaranNamaPihak([nama, ...bentuk.ruas, ...bentuk.diri]);
  const ada = new Set(hasil.map((x) => `${x.depan ? "d:" : ""}${x.teks.toLowerCase()}`));
  for (const diri of bentuk.diri) {
    const polos = namaTanpaGelar(diri);
    if (polos !== diri && polos.replace(/[^\p{L}]/gu, "").length >= 4 && !ada.has(polos.toLowerCase())) {
      hasil.push({ jenis: "nama pihak", teks: polos, depan: false, lanjut: "" });
      ada.add(polos.toLowerCase());
    }
  }
  return hasil;
}

/**
 * Rencana penyamaran atas TEKS DATAR. Murni - tidak menyentuh RTF.
 * @returns daftar ganti (tidak bertumpuk, urut posisi) dan teks hasilnya
 */
export function anonimkanTeks(teksAsal: string, entitas: EntitasAnonim, opsi: OpsiAnonim = {}): HasilAnonimTeks {
  const t = String(teksAsal ?? "");
  const pakaiTtl = opsi.ttl !== false;
  const pakaiKerja = opsi.pekerjaan !== false;
  const pakaiAlamat = opsi.alamat !== false;
  const pakaiPola = opsi.polaUmum !== false;
  /** 0 bebas, 1 disamarkan, 2 dilindungi (nama majelis/PP/kuasa). */
  const pakai = new Uint8Array(t.length);
  const ganti: GantiAnonim[] = [];
  const dilewati: SisaAnonim[] = [];
  const bebas = (a: number, b: number) => {
    if (a < 0 || b > t.length || a >= b) return false;
    for (let k = a; k < b; k += 1) if (pakai[k]) return false;
    return true;
  };
  const tandai = (a: number, b: number, menjadi: string, jenis: JenisSamaran): boolean => {
    // Rapikan tepi: spasi di ujung tidak ikut disamarkan.
    while (a < b && /\s/.test(t[a])) a += 1;
    while (b > a && /\s/.test(t[b - 1])) b -= 1;
    if (a >= b || !bebas(a, b) || t.slice(a, b).includes("\n")) return false;
    for (let k = a; k < b; k += 1) pakai[k] = 1;
    ganti.push({ mulai: a, akhir: b, menjadi, jenis, asal: t.slice(a, b) });
    return true;
  };
  const awalParagraf = (i: number) => t.lastIndexOf("\n", i - 1) + 1;
  const akhirParagraf = (i: number) => {
    const j = t.indexOf("\n", i);
    return j < 0 ? t.length : j;
  };
  const konteks = (a: number, b: number) =>
    t.slice(Math.max(awalParagraf(a), a - 60), Math.min(akhirParagraf(b), b + 60)).replace(/\s+/g, " ").trim();
  const kalimatKutipan = (a: number, b: number) => {
    const kiri = Math.max(awalParagraf(a), a - 160);
    const kanan = Math.min(akhirParagraf(b), b + 160);
    // Nama itu sendiri tidak ikut dinilai ("Abd. Hadis" bukan kutipan hadis).
    return KUTIPAN.test(t.slice(kiri, a)) || KUTIPAN.test(t.slice(b, kanan));
  };

  // ── 1. Pelindung: nama majelis, PP, juru sita, mediator, kuasa ─────────────
  const lindung = (entitas.lindungi ?? [])
    .map((x) => (typeof x === "string" ? x : x.nama))
    .flatMap((n) => [String(n || "").trim(), namaTanpaGelar(n)])
    .filter((n, i, s) => n.replace(/[^\p{L}]/gu, "").length >= 4 && s.indexOf(n) === i)
    .sort((a, b) => b.length - a.length);
  // Nama pelindung SATU kata ("Idris") tidak dikunci di seluruh naskah - pihak bernama
  // "Idris bin Lamale" akan ikut terkunci. Bentuk bergelarnya ("Idris, S.H.I., M.H.") tetap dikunci.
  const lindungTunggal = new Set(lindung.filter((n) => !/\s/.test(n.trim())).map((n) => n.toLowerCase()));
  for (const n of lindung) {
    if (lindungTunggal.has(n.toLowerCase())) continue;
    for (const m of t.matchAll(polaLentur(n))) {
      const a = m.index ?? 0;
      for (let k = a; k < a + m[0].length; k += 1) if (!pakai[k]) pakai[k] = 2;
    }
  }
  const dilindungi = (kata: string) => {
    const k = kata.replace(/\s+/g, " ").trim().toLowerCase();
    return k.length >= 4 && lindung.some((n) => n.toLowerCase() === k || n.toLowerCase().includes(k));
  };

  // Email lebih dulu: alamat e-Court sering memuat nama pihak ("trisna...@gmail.com").
  // Email lembaga (.go.id, mahkamahagung, pengadilan) tetap.
  for (const m of t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
    if (/\.go\.id$|mahkamahagung|pengadilan|^pa[.-]?\w*@|badilag/i.test(m[0])) continue;
    tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "email");
  }

  // ── 2. Pihak, saksi, anak dari SIPP ────────────────────────────────────────
  const sebutan = entitas.sebutan ?? { satu: "Penggugat", dua: "Tergugat" };
  const SEBUT: Record<number, string> = { 1: sebutan.satu, 2: sebutan.dua, 3: "Intervensi", 4: `Turut ${sebutan.dua}` };
  const calon: Calon[] = [];
  const namaDikenal = new Set<string>();
  const pihak = (entitas.pihak ?? []).filter((p) => p && p.nama);
  const perSisi = new Map<number, Array<OrangSipp & { pihakKe: number }>>();
  for (const p of pihak) perSisi.set(p.pihakKe, [...(perSisi.get(p.pihakKe) ?? []), p]);
  for (const [ke, daftar] of perSisi) {
    daftar.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
    daftar.forEach((p, i) => {
      const label = `${(SEBUT[ke] ?? "Pihak").toUpperCase()}${daftar.length > 1 ? ` ${romawi(i + 1)}` : ""}`;
      for (const s of sasaranOrang(p.nama)) calon.push({ ...s, label, jenisSamar: "nama pihak", kunci: `p${ke}.${i}` });
      namaDikenal.add(p.nama.toLowerCase());
    });
  }
  /** Kemunculan sah sebuah sasaran nama SIPP di naskah: [awal, akhir) atau null. */
  const kemunculanSah = (c: Sasaran, m: RegExpMatchArray): [number, number] | null => {
    const a = (m.index ?? 0) + m[1].length;
    const b = a + m[2].length;
    if (c.depan && !depanMilikPihak(t, b, c.lanjut)) return null;
    if (lindungTunggal.has(m[2].replace(/\s+/g, " ").trim().toLowerCase())) return null;
    // Nama satu kata yang tertulis huruf kecil seluruhnya adalah kata biasa ("bukti yang kuat").
    if (!/\s/.test(m[2].trim()) && m[2] === m[2].toLowerCase()) return null;
    // Nama SIPP yang juga kata biasa ("Minggu") hanya bila ditulis seperti nama, bukan "hari Minggu".
    if (kataBukanNama(c.teks) && (!/^\p{Lu}/u.test(t[a]) || /(?:hari|tanggal|bulan)\s+$/i.test(t.slice(Math.max(0, a - 9), a)))) return null;
    return [a, b];
  };
  // Saksi & anak: label menurut urutan PERTAMA MUNCUL di naskah.
  const urutMuncul = (orang: OrangSipp[], awalan: string, jenisSamar: JenisSamaran) => {
    const unik = orang.filter((o) => o && o.nama && !namaDikenal.has(o.nama.toLowerCase()));
    const posisi = unik.map((o, i) => {
      let pertama = Number.POSITIVE_INFINITY;
      for (const s of sasaranOrang(o.nama)) {
        for (const m of t.matchAll(new RegExp(polaSasaran(s).source, "giu"))) {
          const r = kemunculanSah(s, m);
          if (r) {
            pertama = Math.min(pertama, r[0]);
            break;
          }
        }
      }
      return { o, i, pertama };
    });
    posisi.sort((a, b) => a.pertama - b.pertama || (a.o.urutan ?? 0) - (b.o.urutan ?? 0) || a.i - b.i);
    posisi.forEach(({ o }, n) => {
      namaDikenal.add(o.nama.toLowerCase());
      for (const s of sasaranOrang(o.nama)) calon.push({ ...s, label: `${awalan} ${romawi(n + 1)}`, jenisSamar, kunci: `${awalan}${n}` });
    });
    return posisi.length;
  };
  let nomorSaksi = urutMuncul(entitas.saksi ?? [], "SAKSI", "nama saksi");
  let nomorAnak = urutMuncul(entitas.anak ?? [], "ANAK", "nama anak");
  // Nama orang tua yang tercatat di SIPP (kolom nama_ayah/nama_ibu - jarang terisi).
  for (const o of [...pihak, ...(entitas.saksi ?? [])]) {
    for (const ortu of [o.namaAyah, o.namaIbu]) {
      if (ortu && ortu.replace(/[^\p{L}]/gu, "").length >= 4) calon.push({ jenis: "", teks: ortu, depan: false, lanjut: "", label: "xxx", jenisSamar: "nama orang lain", kunci: "ortu" });
    }
  }
  calon.sort((a, b) => b.teks.length - a.teks.length);
  for (const c of calon) {
    if (c.teks.replace(/[^\p{L}]/gu, "").length < 4 || PERAN.test(c.teks.trim())) continue;
    for (const m of t.matchAll(new RegExp(polaSasaran(c).source, "giu"))) {
      const r = kemunculanSah(c, m);
      if (r) tandai(r[0], r[1], c.label, c.jenisSamar);
    }
  }

  // ── 3. Pola teks: orang yang tidak tercatat di SIPP ────────────────────────
  /** Nama tak dikenal -> label yang sama di seluruh naskah. */
  const labelTakDikenal = new Map<string, { label: string; jenis: JenisSamaran }>();
  const jenisDariKonteks = (a: number): "saksi" | "anak" | "orang" => {
    // (1) Kata peran TEPAT di depan nama: "saksi I Penggugat, X", "anak yang bernama X".
    //     Kata hubungan di antaranya ("saksi menikah dengan X", "anak dari ...") berarti orang lain.
    const dekat = t.slice(Math.max(awalParagraf(a), a - 60), a);
    const peran = /(saksi|anak)((?:[ \t]+[^\s.;,:]+){0,4}?)[ \t]*[,:]?[ \t]*$/i.exec(dekat);
    if (peran) {
      if (/(?<![\p{L}])(?:dengan|kepada|oleh|dari|istri|isteri|suami|ayah|ibu|kakak|adik|paman|bibi|nenek|kakek|menantu|mertua|ipar)(?![\p{L}])/iu.test(peran[2])) return "orang";
      return peran[1].toLowerCase() === "saksi" ? "saksi" : "anak";
    }
    // (2) Butir daftar ("1. X", "a. X") di bawah judul "saksi-saksi sebagai berikut:" /
    //     "anak yang masing-masing bernama:" - judulnya bisa di paragraf sebelumnya.
    if (/(?:^|[\s:])(?:\d{1,2}|[a-z])[.)][ \t]*$/i.test(t.slice(Math.max(0, a - 6), a))) {
      const kiri = ` ${t.slice(Math.max(0, a - 400), a).toLowerCase()}`;
      const s = kiri.lastIndexOf("saksi");
      let n = -1;
      for (const m of kiri.matchAll(/(?<![\p{L}])anak(?![\p{L}])/gu)) n = m.index ?? n;
      if (s < 0 && n < 0) return "orang";
      return s > n ? "saksi" : "anak";
    }
    return "orang";
  };
  const labelUntuk = (nama: string, a: number): { label: string; jenis: JenisSamaran } => {
    const kunci = nama.replace(/\s+/g, " ").trim().toLowerCase();
    const lama = labelTakDikenal.get(kunci);
    if (lama) return lama;
    const j = jenisDariKonteks(a);
    const baru =
      j === "saksi"
        ? { label: `SAKSI ${romawi(++nomorSaksi)}`, jenis: "nama saksi" as const }
        : j === "anak"
          ? { label: `ANAK ${romawi(++nomorAnak)}`, jenis: "nama anak" as const }
          : { label: "xxx", jenis: "nama orang lain" as const };
    labelTakDikenal.set(kunci, baru);
    return baru;
  };
  /** Rentang deret nama [a,b) dirapikan dari kata pembuka/penutup yang bukan nama. */
  const rapikanDeret = (a: number, b: number): [number, number] | null => {
    const potong = t.slice(a, b);
    const kata = [...potong.matchAll(/\S+/g)].map((m) => ({ a: a + (m.index ?? 0), b: a + (m.index ?? 0) + m[0].length, k: m[0] }));
    while (kata.length && (kataBukanNama(kata[0].k) || pakai[kata[0].a])) kata.shift();
    while (kata.length && (kataBukanNama(kata[kata.length - 1].k) || pakai[kata[kata.length - 1].b - 1])) kata.pop();
    if (!kata.length) return null;
    // Kata di tengah yang bukan nama memutus deret - ambil bagian SESUDAHNYA.
    let mulai = 0;
    for (let i = 0; i < kata.length; i += 1) if (kataBukanNama(kata[i].k) || pakai[kata[i].a]) mulai = i + 1;
    const sisa = kata.slice(mulai);
    if (!sisa.length) return null;
    const ra = sisa[0].a;
    let rb = sisa[sisa.length - 1].b;
    // Titik penutup kalimat bukan bagian nama, kecuali singkatan satu huruf.
    if (t[rb - 1] === "." && !/(?:^|\s)\p{L}\.$/u.test(t.slice(ra, rb))) rb -= 1;
    const huruf = t.slice(ra, rb).replace(/[^\p{L}]/gu, "");
    return huruf.length >= 3 ? [ra, rb] : null;
  };
  const samarkanOrang = (a: number, b: number, sumberPola: string) => {
    const r = rapikanDeret(a, b);
    if (!r) return;
    const [ra, rb] = r;
    const nama = t.slice(ra, rb);
    if (dilindungi(nama) || !bebas(ra, rb)) return;
    if (kalimatKutipan(ra, rb)) {
      dilewati.push({ jenis: sumberPola, kata: nama, konteks: konteks(ra, rb) });
      return;
    }
    const l = labelUntuk(nama, ra);
    tandai(ra, rb, l.label, l.jenis);
  };
  if (pakaiPola) {
    // (a) "X bin/binti Y" - nasab: X orang, Y orang tuanya.
    const polaBin = new RegExp(`(${DERET_NAMA})[ \\t]+(bin|binti)[ \\t]+(${DERET_NAMA})`, "gu");
    for (const m of t.matchAll(polaBin)) {
      const a = m.index ?? 0;
      const kiriB = a + m[1].length;
      const kananA = a + m[0].length - m[3].length;
      const kananB = a + m[0].length;
      if (kalimatKutipan(a, kananB)) {
        const r = rapikanDeret(a, kiriB);
        if (r && bebas(r[0], r[1])) dilewati.push({ jenis: "pola bin/binti", kata: t.slice(r[0], kananB), konteks: konteks(a, kananB) });
        continue;
      }
      samarkanOrang(a, kiriB, "pola bin/binti");
      const r = rapikanDeret(kananA, kananB);
      if (r && bebas(r[0], r[1]) && !dilindungi(t.slice(r[0], r[1]))) tandai(r[0], r[1], "xxx", "nama orang lain");
    }
    // (b) "bernama X", "atas nama X", "a.n. X", "nama: X"
    // TANPA bendera i: dengan /iu, \p{Lu} ikut mencocokkan huruf kecil ("bernama serta ...").
    const polaBernama = new RegExp(
      `(?:^|[^${HURUF}])(?:[Bb]ernama|BERNAMA|[Aa]tas\\s+[Nn]ama|ATAS\\s+NAMA|[aA]\\.\\s?[nN]\\.|[Nn]ama(?:nya)?\\s*:|NAMA\\s*:)[ \\t]*(${DERET_NAMA})`,
      "gu"
    );
    for (const m of t.matchAll(polaBernama)) {
      const b = (m.index ?? 0) + m[0].length;
      samarkanOrang(b - m[1].length, b, "pola bernama");
    }
    // (c) identitas: "X, umur 30 tahun" / "X, NIK ..." / "X, tempat dan tanggal lahir"
    const polaIdentitas = new RegExp(`(${DERET_NAMA})\\s*,\\s*(?:umur|usia|NIK\\b|tempat\\s*(?:,|dan|\\/)?\\s*tanggal\\s+lahir|tempat\\s+lahir|lahir\\s+di)`, "gu");
    for (const m of t.matchAll(polaIdentitas)) {
      const a = m.index ?? 0;
      samarkanOrang(a, a + m[1].length, "pola identitas");
    }
    // (e) Rantai alias: "xxx alias Ahmad Yambo alias Ahmad Hi.Ambo" - alias milik orang yang
    // tepat di depannya, yang sudah disamarkan: ikut disamarkan dengan samaran yang sama.
    const polaAlias = new RegExp(`[ \\t]+(?:alias|als\\.)[ \\t]+(${DERET_NAMA})`, "gu");
    for (let putaran = 0, berubah = true; berubah && putaran < 6; putaran += 1) {
      berubah = false;
      for (const m of t.matchAll(polaAlias)) {
        const a = m.index ?? 0;
        const depan = ganti.find((g) => g.akhir === a);
        if (!depan) continue;
        const b = a + m[0].length;
        const r = rapikanDeret(b - m[1].length, b);
        if (r && !dilindungi(t.slice(r[0], r[1])) && tandai(r[0], r[1], depan.menjadi, depan.jenis)) berubah = true;
      }
    }
    // (d) Nama tak dikenal yang sudah berlabel: kemunculan lain ikut disamarkan.
    for (const [kunci, l] of labelTakDikenal) {
      if (kunci.replace(/[^\p{L}]/gu, "").length < 4) continue;
      if (l.label === "xxx" && !/\s/.test(kunci)) continue;
      for (const m of t.matchAll(polaLentur(kunci))) {
        const a = m.index ?? 0;
        if (!kalimatKutipan(a, a + m[0].length)) tandai(a, a + m[0].length, l.label, l.jenis);
      }
    }
  }

  // ── 4. Nomor: NIK, telepon, rekening, email, NIP ───────────────────────────
  const semua = [...pihak, ...(entitas.saksi ?? []), ...(entitas.anak ?? [])];
  // NIK/KK 16 angka, juga yang berpemisah ("72.03.01.410190.0001", "7203 0141 0190 0001").
  for (const m of t.matchAll(POLA_NIK)) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "x".repeat(16), "NIK");
  for (const o of semua) {
    const nik = String(o.nik ?? "").replace(/\s+/g, "");
    if (nik.length >= 8 && /^\d+$/.test(nik)) {
      // NIK SIPP bukan 16 angka (salah ketik) tetap dicari, juga bila berpemisah.
      const polaAngka = new RegExp(`(?<!\\d)${nik.split("").join("[ .-]?")}(?!\\d)`, "g");
      for (const m of t.matchAll(polaAngka)) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "NIK");
    } else if (nik.length >= 8 && /\d/.test(nik)) for (const m of t.matchAll(polaLentur(nik))) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "NIK");
    const telp = String(o.telepon ?? "").replace(/\D/g, "");
    if (telp.length >= 8) {
      const inti = telp.replace(/^(?:62|0)/, "");
      const pola = new RegExp(`(?<!\\d)(?:\\+?62|0)?[ .-]?${inti.split("").join("[ .-]?")}(?!\\d)`, "g");
      for (const m of t.matchAll(pola)) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "nomor telepon");
    }
    if (o.email && /@/.test(o.email)) for (const m of t.matchAll(polaLentur(o.email))) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "email");
  }
  for (const m of t.matchAll(/(?<![\d+])(?:\+62|62|0)8\d(?:[ .-]?\d){6,11}(?!\d)/g)) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "nomor telepon");
  for (const m of t.matchAll(/(?:rekening|rek\.)[ \t]*(?:[\p{L}.]+[ \t]+){0,3}?(?:nomor|no\.?)?[ \t]*:?[ \t]*(\d[\d .-]{5,25}\d)/giu)) {
    const b = (m.index ?? 0) + m[0].length;
    tandai(b - m[1].length, b, "xxx", "nomor rekening");
  }
  for (const m of t.matchAll(/NIP\.?\s*:?\s*(\d{8}\s?\d{6}\s?\d\s?\d{3})(?!\d)/g)) {
    const b = (m.index ?? 0) + m[0].length;
    // NIP pejabat (tanda tangan majelis/PP) tetap: nama pelindung ada tepat sebelumnya.
    const kiri = Math.max(0, (m.index ?? 0) - 120);
    let dekatPelindung = false;
    for (let k = kiri; k < (m.index ?? 0); k += 1) if (pakai[k] === 2) dekatPelindung = true;
    if (!dekatPelindung) tandai(b - m[1].length, b, "xxx", "NIP");
  }

  // ── 5. Tempat & tanggal lahir ──────────────────────────────────────────────
  if (pakaiTtl) {
    const TGL = "\\d{1,2}[\\s./-]+(?:\\p{L}+|\\d{1,2})[\\s./-]+\\d{4}";
    const polaTtl = new RegExp(
      `(?:tempat\\s*(?:,|dan|&|\\/)?\\s*(?:tanggal|tgl\\.?)\\s*lahir|tempat\\s+lahir|lahir\\s+(?:di|pada|tanggal|tgl\\.?)|tanggal\\s+lahir)\\s*:?\\s*` +
        `(?:([\\p{L}][\\p{L} .'-]{1,40}?)(?:[ \\t]*[,/][ \\t]*|[ \\t]+))?(?:pada\\s+)?(?:tanggal\\s+|tgl\\.?\\s*)?(${TGL})`,
      "giu"
    );
    for (const m of t.matchAll(polaTtl)) {
      const akhir = (m.index ?? 0) + m[0].length;
      const tglA = akhir - m[2].length;
      const tempat = String(m[1] ?? "").replace(/(?:\s+(?:pada|tanggal|tgl\.?))+\s*$/i, "");
      if (tempat && !/^(?:pada|tanggal|di)$/i.test(tempat.trim())) {
        const tempatA = t.lastIndexOf(tempat, tglA);
        if (tempatA >= 0) tandai(tempatA, tempatA + tempat.length, "xxx", "tempat & tanggal lahir");
      }
      tandai(tglA, akhir, "xxx", "tempat & tanggal lahir");
    }
    for (const o of semua) {
      for (const bentuk of bentukTanggal(String(o.tanggalLahir ?? ""))) {
        for (const m of t.matchAll(polaLentur(bentuk))) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "tempat & tanggal lahir");
      }
    }
  }

  // ── 6. Pekerjaan, tempat bekerja, sekolah ──────────────────────────────────
  if (pakaiKerja) {
    // Di daftar identitas ("umur 30 tahun, agama Islam, pekerjaan Petani, ...").
    for (const m of t.matchAll(/pekerjaan\s*:?\s*([^,;\n]{2,60}?)(?=\s*[,;\n]|\s+(?:bertempat|tempat|beralamat|pendidikan|agama|alamat|NIK)\b)/giu)) {
      const b = (m.index ?? 0) + m[0].length;
      const kiri = t.slice(Math.max(awalParagraf(m.index ?? 0), (m.index ?? 0) - 160), m.index ?? 0);
      if (!/umur|usia|agama|NIK|lahir|pendidikan/i.test(kiri)) continue;
      if (/^(?:xxx+|-+|tidak ada)$/i.test(m[1].trim())) continue;
      tandai(b - m[1].length, b, "xxx", "pekerjaan");
    }
    // "bekerja sebagai X" / "bekerja di X" / "bertugas di X".
    for (const m of t.matchAll(/(?:bekerja|bertugas|berdinas)\s+(?:sebagai|di|pada)\s+([^,;.\n]{2,50}?)(?=\s*[,;.\n]|\s+(?:dan|yang|sejak|selama|namun|sehingga|tetapi|dengan|dari|sedangkan)\b)/giu)) {
      const b = (m.index ?? 0) + m[0].length;
      tandai(b - m[1].length, b, "xxx", "pekerjaan");
    }
    for (const o of semua) {
      const kerja = String(o.pekerjaan ?? "").trim();
      if (kerja.length < 4 || /^(?:lain|lainnya|tidak bekerja|belum bekerja|mengurus rumah tangga|ibu rumah tangga)$/i.test(kerja)) continue;
      // Hanya di dalam daftar identitas, bukan tiap kata "petani" di naskah.
      for (const m of t.matchAll(polaLentur(kerja))) {
        const a = m.index ?? 0;
        if (/pekerjaan\s*:?\s*$/i.test(t.slice(Math.max(0, a - 14), a))) tandai(a, a + m[0].length, "xxx", "pekerjaan");
      }
    }
    // Sekolah / lembaga pendidikan.
    // Jenjang (SD, SLTP, SLTA) di daftar identitas BUKAN nama sekolah - hanya yang bernama.
    for (const m of t.matchAll(/(?<![\p{L}])(?:SDN?|SMPN?|SMAN?|SMKN?|MTsN?|MAN|Sekolah[ \t]+(?:Dasar|Menengah)(?:[ \t]+(?:Pertama|Atas|Kejuruan))?|Madrasah[ \t]+(?:Ibtidaiyah|Tsanawiyah|Aliyah)|Pondok[ \t]+Pesantren|Ponpes|PAUD)[ \t]+(?:Negeri[ \t]+|Swasta[ \t]+|Inpres[ \t]+|Islam[ \t]+|Terpadu[ \t]+|IT[ \t]+)?(?:(?:No\.?[ \t]*)?\d{1,3}[ \t]*)?(?:\p{Lu}[\p{L}'-]*[ \t]*){1,3}/gu)) {
      const a = m.index ?? 0;
      const kata = [...m[0].matchAll(/\S+/g)].map((k) => ({ k: k[0], b: a + (k.index ?? 0) + k[0].length }));
      if (/^nomor$/i.test(kata[1]?.k ?? "")) continue;
      while (kata.length > 1 && kataBukanNama(kata[kata.length - 1].k)) kata.pop();
      if (kata.length < 2) continue;
      tandai(a, kata[kata.length - 1].b, "xxx", "sekolah");
    }
  }

  // ── 7. Alamat: cukup kabupaten/kota ────────────────────────────────────────
  if (pakaiAlamat) {
    // "di" atau titik dua WAJIB: tanpa itu yang tertangkap kalimat biasa ("kediaman bersama
    // adalah Tergugat", "berpisah tempat tinggal, hal ini ...") - 130+ salah samar pada ukuran pertama.
    const polaKlausa =
      /(?:(?:bertempat\s+(?:tinggal|kediaman)|tempat\s+(?:tinggal|kediaman)(?:\s+(?:terakhir|bersama))?|beralamat|berdomisili|kediaman\s+bersama)\s+di|(?:alamat(?:\s+terakhir)?|tempat\s+tinggal|tempat\s+kediaman)\s*:)\s*/giu;
    const AKHIR = /;|\n|,\s*(?:sebagai|selanjutnya|dalam\s+hal|sekarang|dahulu|yang|untuk|telah|dan\s+(?:sekarang|selanjutnya))\b|\s+sebagai\s+/iu;
    for (const m of t.matchAll(polaKlausa)) {
      const a = (m.index ?? 0) + m[0].length;
      const sisaKal = t.slice(a, a + 260);
      const ujung = AKHIR.exec(sisaKal);
      let b = a + (ujung ? ujung.index : Math.min(sisaKal.length, 200));
      if (b <= a + 2) continue;
      if (/^(?:yang|tidak|luar|sebagaimana|tersebut|wilayah|dalam\s+wilayah|daerah|alamat|rumah\s+(?:orang\s+tua|kediaman))\b/i.test(t.slice(a, b))) continue;
      const klausa = t.slice(a, b);
      const kab = [...klausa.matchAll(POLA_KAB)].pop();
      if (kab && kab.index !== undefined) {
        if (kab.index === 0) continue;
        b = a + kab.index;
        while (b > a && /[\s,]/.test(t[b - 1])) b -= 1;
      }
      if (b - a < 3) continue;
      // Bagian yang sudah disamarkan (nama) membelah klausa: samarkan potongan bebasnya saja.
      let mulai = a;
      for (let k = a; k <= b; k += 1) {
        if (k === b || pakai[k]) {
          const pot = t.slice(mulai, k);
          if (pot.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) tandai(mulai, k, "xxx", "alamat");
          mulai = k + 1;
        }
      }
    }
    // Alamat SIPP utuh di tempat lain - bagian kabupaten/kota ke belakang tetap (pedoman).
    for (const o of semua) {
      let al = String(o.alamat ?? "").trim();
      const kab = [...al.matchAll(POLA_KAB)].pop();
      if (kab && kab.index !== undefined) al = al.slice(0, kab.index).replace(/[\s,]+$/, "");
      if (al.length >= 8) for (const m of t.matchAll(polaLentur(al))) tandai(m.index ?? 0, (m.index ?? 0) + m[0].length, "xxx", "alamat");
    }
    // Ruas alamat bernama: Desa/Kelurahan/Dusun/Jalan/Lorong/Gang/BTN/Perumahan + nama; RT/RW.
    for (const m of t.matchAll(/(?<![\p{L}])(?:Desa|DESA|Kelurahan|KELURAHAN|Kel\.|Dusun|DUSUN|Dsn\.|Jalan|JALAN|Jl\.|JL\.|Jln\.|Lorong|Lr\.|Gang|Gg\.|BTN|Perumahan|Perum\.?|Kompleks|Komp\.)[ \t]*((?:(?:\p{Lu}[\p{L}'-]*|\d{1,4}[A-Za-z]?|[IVX]{1,4})\.?[ \t]*){1,4})/gu)) {
      const b = (m.index ?? 0) + m[0].length;
      const nama = m[1].replace(/\s+$/, "");
      const a = b - m[1].length;
      if (nama.length < 1) continue;
      tandai(a, a + nama.length, "xxx", "alamat");
    }
    for (const m of t.matchAll(/(?<![\p{L}])(?:RT|RW)\.?[ \t]*(?:\/[ \t]*RW\.?)?[ \t]*:?[ \t]*(\d{1,3}(?:[ \t]*\/[ \t]*\d{1,3})?)(?!\d)/gu)) {
      const b = (m.index ?? 0) + m[0].length;
      tandai(b - m[1].length, b, "xxx", "alamat");
    }
  }

  ganti.sort((a, b) => a.mulai - b.mulai);
  let teks = "";
  let pos = 0;
  for (const g of ganti) {
    teks += t.slice(pos, g.mulai) + g.menjadi;
    pos = g.akhir;
  }
  teks += t.slice(pos);
  return { teks, ganti, sisa: periksaSisa(teks, entitas), dilewati: dilewati.slice(0, 40) };
}

/** Data pribadi SIPP yang MASIH tertulis sesudah penyamaran - untuk pratinjau. */
export function periksaSisa(teks: string, entitas: EntitasAnonim): SisaAnonim[] {
  const t = String(teks ?? "");
  const sisa: SisaAnonim[] = [];
  const catat = (jenis: string, kata: string, i: number) => {
    if (sisa.length >= 30) return;
    const a = Math.max(0, i - 50);
    const b = Math.min(t.length, i + kata.length + 50);
    sisa.push({ jenis, kata, konteks: t.slice(a, b).replace(/\s+/g, " ").trim() });
  };
  const lindung = (entitas.lindungi ?? []).map((x) => (typeof x === "string" ? x : x.nama).toLowerCase());
  const orang: Array<[string, OrangSipp]> = [
    ...(entitas.pihak ?? []).map((o) => ["nama pihak", o] as [string, OrangSipp]),
    ...(entitas.saksi ?? []).map((o) => ["nama saksi", o] as [string, OrangSipp]),
    ...(entitas.anak ?? []).map((o) => ["nama anak", o] as [string, OrangSipp]),
  ];
  const lihat = new Set<string>();
  for (const [jenis, o] of orang) {
    for (const diri of bentukNamaPihak(o.nama).diri) {
      const k = diri.toLowerCase();
      if (lihat.has(k) || lindung.some((l) => l.includes(k))) continue;
      lihat.add(k);
      // Sama dengan penyamar: nama satu kata yang tertulis huruf kecil adalah kata biasa.
      const penuh: Array<[number, number]> = [];
      let dilapor = false;
      for (const m of t.matchAll(polaNama(diri, "giu"))) {
        penuh.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
        if (dilapor || (!/\s/.test(m[0]) && m[0] === m[0].toLowerCase())) continue;
        catat(jenis, m[0], m.index ?? 0);
        dilapor = true;
      }
      // Nama depan saja ("Melki" dari "Melki Saputra") yang masih tampil di luar nama utuh.
      const depan = kataDepanBermakna(diri);
      if (!depan || lihat.has(`depan:${depan.toLowerCase()}`) || lindung.some((l) => l.split(/[\s,]+/).includes(depan.toLowerCase()))) continue;
      for (const m of t.matchAll(polaNama(depan, "gu"))) {
        const a = m.index ?? 0;
        if (!/^\p{Lu}/u.test(m[0]) || penuh.some(([x, y]) => a >= x && a < y)) continue;
        lihat.add(`depan:${depan.toLowerCase()}`);
        catat(`${jenis} (nama depan)`, m[0], a);
        break;
      }
    }
  }
  for (const m of t.matchAll(POLA_NIK)) catat("NIK", m[0], m.index ?? 0);
  for (const m of t.matchAll(/(?<![\d+])(?:\+62|62|0)8\d(?:[ .-]?\d){6,11}(?!\d)/g)) catat("nomor telepon", m[0], m.index ?? 0);
  return sisa;
}

/** Buang grup {\info ...} (judul/pengarang dokumen bisa memuat nama pihak). */
export function buangInfoRtf(rtf: string): string {
  const s = String(rtf ?? "");
  const awal = s.indexOf("{\\info");
  if (awal < 0) return s;
  let aras = 0;
  for (let i = awal; i < s.length; i += 1) {
    const c = s[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") aras += 1;
    else if (c === "}") {
      aras -= 1;
      if (aras === 0) return s.slice(0, awal) + s.slice(i + 1);
    }
  }
  return s;
}

export type PotonganPratinjau = { t: string; j?: JenisSamaran };
export type HasilAnonimRtf = HasilAnonimTeks & {
  rtf: string;
  /** Teks hasil dipotong per samaran - untuk pratinjau bersorot. */
  potongan: PotonganPratinjau[];
  ringkas: Partial<Record<JenisSamaran, number>>;
};

/**
 * Menyamarkan RTF putusan (teks satu-aksara-per-bita/latin1).
 */
export function anonimkanRtf(rtf: string, entitas: EntitasAnonim, opsi: OpsiAnonim = {}): HasilAnonimRtf {
  const asal = buangInfoRtf(String(rtf ?? ""));
  const peta = petaRtf(asal);
  const hasil = anonimkanTeks(peta.teks, entitas, opsi);
  const sunting: Array<{ dari: number; sampai: number; isi: string }> = [];
  for (const g of hasil.ganti) {
    let pertama = true;
    for (let k = g.mulai; k < g.akhir; k += 1) {
      if (peta.kendali[k]) continue;
      sunting.push({ dari: peta.awal[k], sampai: peta.akhir[k], isi: pertama ? g.menjadi : "" });
      pertama = false;
    }
  }
  sunting.sort((a, b) => a.dari - b.dari);
  let keluar = "";
  let pos = 0;
  for (const s of sunting) {
    if (s.dari < pos) continue;
    keluar += asal.slice(pos, s.dari) + s.isi;
    pos = s.sampai;
  }
  keluar += asal.slice(pos);
  const potongan: PotonganPratinjau[] = [];
  let p = 0;
  for (const g of hasil.ganti) {
    if (g.mulai > p) potongan.push({ t: peta.teks.slice(p, g.mulai) });
    potongan.push({ t: g.menjadi, j: g.jenis });
    p = g.akhir;
  }
  if (p < peta.teks.length) potongan.push({ t: peta.teks.slice(p) });
  const ringkas: Partial<Record<JenisSamaran, number>> = {};
  for (const g of hasil.ganti) ringkas[g.jenis] = (ringkas[g.jenis] ?? 0) + 1;
  return { ...hasil, rtf: keluar, potongan, ringkas };
}

/** RTF (byte) -> disamarkan -> byte. */
export function anonimkanRtfBita(bita: Uint8Array, entitas: EntitasAnonim, opsi: OpsiAnonim = {}): HasilAnonimRtf & { bita: Uint8Array } {
  let teks = "";
  for (let i = 0; i < bita.length; i += 0x8000) teks += String.fromCharCode(...bita.subarray(i, i + 0x8000));
  const hasil = anonimkanRtf(teks, entitas, opsi);
  const baru = new Uint8Array(hasil.rtf.length);
  for (let i = 0; i < hasil.rtf.length; i += 1) {
    const k = hasil.rtf.charCodeAt(i);
    baru[i] = k > 255 ? 63 : k;
  }
  return { ...hasil, bita: baru };
}
