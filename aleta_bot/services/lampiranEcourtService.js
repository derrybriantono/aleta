"use strict";

/**
 * ============================================================================
 * OCR-ECOURT (19 Okt 2026) - ISIAN ABT DARI LAMPIRAN e-COURT HASIL PINDAI
 * ============================================================================
 *
 * Perintah pengguna: "Isi SIPP & Input ABT tahap 2: OCR lampiran e-Court untuk isian lain." Isian ABT yang datanya
 * TIDAK ada di SIPP tetapi ada di lampiran e-Court: kartu keluarga, kutipan akta kelahiran/kematian/nikah, akta cerai,
 * surat keterangan desa/kelurahan dan KUA, surat kuasa (khusus dan insidentil), slip gaji.
 *
 * Diukur di server 19 Okt (hanya baca, angka di docs/isi-sipp-abt/UKURAN-OCR-ECOURT.json): lampiran 2026 hampir
 * semuanya "Dokumen Bukti" (850 perkara, satu PDF gabungan berisi KTP, KK, buku nikah, surat keterangan; rata-rata 4,2
 * halaman) dan 96% berupa PINDAIAN tanpa lapisan teks. Jadi tiap halaman dibaca OCR (portal: tesseract, bahasa ind),
 * dikenali jenisnya dari ISI halaman (judul e-Court hanya "Dokumen Bukti"), lalu medannya diurai di sini.
 *
 * MURNI: tanpa basis data/jaringan. Penyimpanan, antrian, dan pencocokan ke SIPP ada di lampiranEcourtStoreService.js.
 *
 * KEJUJURAN
 *   - NIK yang terbaca HANYA dipakai untuk mencocokkan halaman ke pihak perkara (di memori). Tidak pernah masuk medan,
 *     usulan, kalimat, catatan, maupun basis data - lihat buangNik() dan uji "NIK tidak tampil".
 *   - Halaman yang tidak dapat dicocokkan ke pihak perkara (dokumen orang lain, saksi) tidak menghasilkan usulan.
 *   - Tingkat "ragu" (usulan bercentang, tidak menimpa isian petugas) sampai terukur >= 95% cocok dengan isian petugas
 *     pada >= 20 perkara di server (TINGKAT_TERUKUR). Isian petugas selalu menang (jagaIsianLama + isianLama).
 *   - Tanpa kata "Aleta" dan tanpa kode #nnnn# pada teks yang akan ditulis ke ABT.
 */

const K = require("./ktpPihakService");

/** Naikkan bila aturan baca/urai membaik: berkas versi lama dibaca ulang oleh penyapu portal. */
const VERSI_LAMPIRAN = 1;

/** Batas teks per halaman yang diterima dari portal, dan halaman per berkas. */
const BATAS_TEKS_HALAMAN = 12000;
const BATAS_HALAMAN = 12;

const JENIS = Object.freeze({
  kk: "Kartu Keluarga",
  akta_lahir: "Kutipan Akta Kelahiran",
  akta_kematian: "Kutipan Akta Kematian",
  akta_nikah: "Kutipan Akta Nikah",
  akta_cerai: "Akta Cerai",
  sk_desa: "Surat Keterangan Desa/Kelurahan",
  sk_kua: "Surat Keterangan KUA",
  surat_kuasa: "Surat Kuasa Khusus",
  kuasa_insidentil: "Surat Kuasa Insidentil",
  slip_gaji: "Slip Gaji",
  ktp: "Kartu Tanda Penduduk",
  kartu_advokat: "Kartu Tanda Anggota Advokat",
  ba_sumpah: "Berita Acara Sumpah Advokat",
  lain: "Lain-lain",
});

/**
 * Tingkat per medan. "ragu" sampai diukur (tools/ukur-lampiran-ecourt.js atas server; angka di UKURAN-OCR-ECOURT.json).
 * Hanya medan yang terukur >= 95% cocok pada >= 20 perkara yang boleh "cukup" (terisi otomatis, isian petugas tetap menang).
 * 19 Okt: tidak ada medan yang memenuhi ambang - lihat UKURAN-OCR-ECOURT.json "keputusan".
 */
const TINGKAT_TERUKUR = Object.freeze({});
function tingkatMedan(kunci) {
  return TINGKAT_TERUKUR[kunci] === "cukup" ? "cukup" : "ragu";
}

// ---------------------------------------------------------------------------
// Teks
// ---------------------------------------------------------------------------

function bersih(x, batas = 400) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, batas);
}

/** Teks OCR satu halaman -> baris rapi (spasi tunggal, tanpa karakter kendali). */
function rapikan(teks) {
  return String(teks || "")
    .slice(0, BATAS_TEKS_HALAMAN)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .replace(/[“”„"]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Satu baris (tanpa \n) untuk pola yang melintasi baris. */
function datar(teks) {
  return rapikan(teks).replace(/\n/g, " ");
}

/** Galat baca OCR yang lazim di dalam deret angka. */
const PETA_ANGKA = { O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", "|": "1", i: "1", L: "1", "!": "1", Z: "2", z: "2", S: "5", s: "5", B: "8", G: "6", b: "6", g: "9", q: "9", T: "7" };
function perbaikiAngka(s) {
  return String(s || "").replace(/[OoDQIl|iL!ZzSsBGbgqT]/g, (c) => PETA_ANGKA[c] || c);
}

/** NIK dan nomor 16 angka lain disamarkan dari teks apa pun yang keluar dari modul ini (kutipan, catatan). */
function buangNik(s) {
  return String(s || "").replace(/\d(?:[\s.]?\d){15,}/g, "[NIK disamarkan]");
}

// ---------------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------------

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_LAIN = { pebruari: 1, nopember: 10, agustur: 7, okt: 9, nov: 10, nop: 10, des: 11, jan: 0, feb: 1, peb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agt: 7, agu: 7, ags: 7, sep: 8, sept: 8 };

function jarak(a, b) {
  if (a === b) return 0;
  let s = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const k = [i];
    for (let j = 1; j <= b.length; j += 1) k[j] = Math.min(s[j] + 1, k[j - 1] + 1, s[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    s = k;
  }
  return s[b.length];
}

/** Nama bulan (juga ejaan lama dan galat OCR satu-dua huruf: "FEARUARI", "Nopember") -> 0..11; -1 bila bukan. */
function indeksBulan(kata) {
  const k = String(kata || "").toLowerCase().replace(/[^a-z]/g, "");
  if (k.length < 3) return -1;
  const i = BULAN.indexOf(k);
  if (i >= 0) return i;
  if (Object.prototype.hasOwnProperty.call(BULAN_LAIN, k)) return BULAN_LAIN[k];
  if (k.length < 5) return -1;
  let terbaik = -1;
  let nilai = 99;
  BULAN.forEach((b, j) => {
    const d = jarak(k, b);
    if (d < nilai) {
      nilai = d;
      terbaik = j;
    }
  });
  return nilai <= (k.length >= 7 ? 2 : 1) ? terbaik : -1;
}

const dua = (n) => String(n).padStart(2, "0");

function tanggalSah(d, b, y) {
  if (!(b >= 0 && b <= 11 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100)) return null;
  const kabisat = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (d > [31, kabisat ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b]) return null;
  return { iso: `${y}-${dua(b + 1)}-${dua(d)}`, tampil: `${dua(d)}/${dua(b + 1)}/${y}`, indo: `${d} ${BULAN_NAMA[b]} ${y}` };
}

/** "12 Mei 2026", "12-05-2026", "12/5/2026", "12.05.2026" -> {iso, tampil, indo}; null bila bukan tanggal sah. */
function uraiTanggal(teks) {
  const s = String(teks || "").trim();
  let m = /^(\d{1,2})[\s\-/.,]*([A-Za-z]{3,10})\.?[\s\-/.,]*(\d{4})$/.exec(s);
  if (m) return tanggalSah(Number(m[1]), indeksBulan(m[2]), Number(m[3]));
  m = /^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})$/.exec(s);
  if (m) return tanggalSah(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

const POLA_TGL = "(\\d{1,2}\\s*[-/.]\\s*\\d{1,2}\\s*[-/.]\\s*\\d{4}|\\d{1,2}[\\s\\-/.,]*[A-Za-z]{3,10}\\.?[\\s\\-/.,]*\\d{4})";

/** Semua tanggal di teks (urutan kemunculan). */
function semuaTanggal(teks) {
  const hasil = [];
  const re = new RegExp(POLA_TGL, "g");
  let m;
  while ((m = re.exec(teks))) {
    const t = uraiTanggal(m[1]);
    if (t) hasil.push({ ...t, indeks: m.index });
  }
  return hasil;
}

const ANGKA_SATU = { nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1000 };

/** "DUA RIBU DUA PULUH LIMA" -> 2025; "SEMBILAN BELAS" -> 19; "SERIBU SEMBILAN RATUS LIMA PULUH" -> 1950. NaN bila tak terbaca. */
function angkaKata(teks) {
  const kata = String(teks || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!kata.length) return NaN;
  // total = ribuan; kini = ratusan+puluhan yang sudah jadi; satuan = angka kecil terakhir (pengali puluh/ratus/belas).
  let total = 0;
  let kini = 0;
  let satuan = 0;
  let ada = false;
  for (const k of kata) {
    if (Object.prototype.hasOwnProperty.call(ANGKA_SATU, k)) {
      const v = ANGKA_SATU[k];
      if (v === 1000) total += 1000;
      else if (v === 100) kini += 100;
      else satuan += v;
      ada = true;
    } else if (k === "belas") satuan += 10;
    else if (k === "puluh") {
      kini += satuan * 10;
      satuan = 0;
    } else if (k === "ratus") {
      kini += satuan * 100;
      satuan = 0;
    } else if (k === "ribu") {
      total += (kini + satuan || 1) * 1000;
      kini = 0;
      satuan = 0;
    } else return NaN;
  }
  return ada ? total + kini + satuan : NaN;
}

const KATA_ANGKA = "(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|belas|puluh|ratus|ribu)";
const RE_TANGGAL_KATA = new RegExp(
  `tanggal\\s+((?:${KATA_ANGKA}\\s*){1,3})[\\s.,]*([A-Za-z]{3,10})[\\s\\S]{0,60}?tahun\\s+((?:${KATA_ANGKA}\\s*){1,7})`,
  "gi"
);

/** Tanggal berhuruf ala akta catatan sipil ("pada tanggal SEMBILAN BELAS NOVEMBER ... tahun DUA RIBU DUA PULUH LIMA"). */
function semuaTanggalKata(teks) {
  const hasil = [];
  let m;
  RE_TANGGAL_KATA.lastIndex = 0;
  while ((m = RE_TANGGAL_KATA.exec(teks))) {
    const t = tanggalSah(angkaKata(m[1]), indeksBulan(m[2]), angkaKata(m[3]));
    if (t) hasil.push({ ...t, indeks: m.index });
  }
  return hasil;
}

/** Tanggal surat di kaki surat: "Donggala, 12 Mei 2026" - kemunculan TERAKHIR. */
function tanggalKaki(teks) {
  const re = new RegExp(`([A-Z][A-Za-z.' ]{2,30}),\\s*${POLA_TGL}`, "g");
  let terakhir = null;
  let m;
  while ((m = re.exec(teks))) {
    const t = uraiTanggal(m[2]);
    if (t) terakhir = { ...t, kota: bersih(m[1], 40), indeks: m.index };
  }
  return terakhir;
}

// ---------------------------------------------------------------------------
// Pengenalan jenis halaman
// ---------------------------------------------------------------------------

/**
 * Tiap jenis: judul (ciri kuat, +3) dan ciri (+1). Dipilih skor tertinggi >= 3; seri = "lain". Judul e-Court ikut
 * menimbang (+2) bila menyebut jenisnya ("Surat Kuasa", "Buku Nikah", "Kartu Keluarga").
 */
const ATURAN_JENIS = [
  { jenis: "kk", judul: [/KARTU\s*KELUARGA/i, /Nama\s+Kepala\s+Keluarga/i], ciri: [/Hubungan\s+Dalam\s+Keluarga/i, /Dikeluarkan\s+Tanggal/i, /Dokumen\s+Imigrasi/i, /Status\s+Hubungan/i], dariJudul: /kartu\s+keluarga|\bkk\b/i },
  { jenis: "akta_lahir", judul: [/AKTA\s+KELAHIRAN/i, /BIRTH\s+CERTIFICATE/i], ciri: [/telah\s+lahir/i, /anak\s+ke\b/i, /has\s+been\s+born/i], dariJudul: /akta?e?\s+kelahiran|akta\s+lahir/i },
  { jenis: "akta_kematian", judul: [/AKTA\s+KEMATIAN/i, /DEATH\s+CERTIFICATE/i], ciri: [/meninggal\s+dunia/i, /has\s+deceased/i], dariJudul: /akta?e?\s+kematian/i },
  { jenis: "akta_nikah", judul: [/(?:KUTIPAN|DUPLIKAT)\s+AKTA\s+NIKAH/i, /MARRIAGE\s+CERTIFICATE/i, /BUKU\s+NIKAH/i], ciri: [/akad\s+nikah/i, /wali\s+nikah/i, /mas\s+kawin/i, /Sigat\s+Ta.?li/i, /STATUS\s+(?:SUAMI|ISTRI)/i], dariJudul: /buku\s+nikah|akta\s+nikah|kutipan\s+akta/i },
  { jenis: "akta_cerai", judul: [/^\s*(?:KUTIPAN\s+)?AKTA\s+CERAI\b/im, /\/\s*AC\s*\/\s*\d{4}/], ciri: [/telah\s+terjadi\s+perceraian/i, /putusan\s+Pengadilan\s+Agama/i], dariJudul: /akta\s+cerai/i },
  { jenis: "kuasa_insidentil", judul: [/KUASA\s+[IL]N?S?[IL]DEN[TS][IL]L/i, /kuasa\s+i[ns]+ident[ia]l/i], ciri: [/penerima\s+kuasa/i, /pemberi\s+kuasa/i, /hubungan\s+keluarga/i, /saudara\s+kandung|anak\s+kandung/i], dariJudul: /insidentil|isidentil|insidentiil/i },
  { jenis: "surat_kuasa", judul: [/SURAT\s+KUASA(?:\s+KHUSUS)?/i, /memberi(?:kan)?\s+kuasa\s+(?:penuh\s+)?kepada/i], ciri: [/penerima\s+kuasa/i, /pemberi\s+kuasa/i, /Advokat|Pengacara|Konsultan\s+Hukum/i, /KHUSUS/], dariJudul: /surat\s+kuasa|kuasa\s+khusus/i },
  { jenis: "sk_kua", judul: [/KANTOR\s+URUSAN\s+AGAMA/i, /\bKUA\s+KEC(?:AMATAN)?\b/i], ciri: [/SURAT\s+KETERANGAN/i, /PENOLAKAN/i, /tidak\s+tercatat|belum\s+tercatat|tidak\s+terdaftar/i, /Nomor\s*:/i], dariJudul: /\bkua\b|penolakan/i },
  { jenis: "sk_desa", judul: [/SURAT\s+KETERANGAN/i], ciri: [/KEPALA\s+DESA|\bLURAH\b|KELURAHAN|PEMERINTAH\s+(?:KABUPATEN|KOTA|DESA)|\bDESA\s+[A-Z]/i, /Menerangkan\s+(?:dengan\s+sebenarnya\s+)?bahwa/i, /Nomor\s*:/i, /Demikian\s+surat\s+keterangan/i], dariJudul: /surat\s+keterangan|domisili|ghaib|tidak\s+mampu/i },
  { jenis: "slip_gaji", judul: [/SLIP\s+GAJI|DAFTAR\s+GAJI|RINCIAN\s+GAJI|DAFTAR\s+PENGHASILAN/i], ciri: [/GAJI\s+(?:POKOK|BERSIH)|PENGHASILAN\s+BERSIH|JUMLAH\s+(?:BERSIH|DITERIMA)|TAKE\s+HOME|POTONGAN/i, /Rp\.?\s*\d/i], dariJudul: /gaji|penghasilan/i },
  { jenis: "ktp", judul: [/KARTU\s+TANDA\s+PENDUDUK/i, /Berlaku\s+Hingga/i], ciri: [/Gol\.?\s*Darah/i, /Kewarganegaraan/i, /Status\s+Perkawinan/i, /Tempat\s*\/?\s*Tgl\.?\s*Lahir/i], dariJudul: /^\s*(?:e-?)?ktp\b|kartu\s+tanda\s+penduduk/i },
  { jenis: "kartu_advokat", judul: [/KARTU\s+TANDA\s+ANGGOTA/i, /PERADI|KONGRES\s+ADVOKAT|PERSATUAN\s+ADVOKAT/i], ciri: [/Advokat/i, /Berlaku/i], dariJudul: /kartu\s+tanda\s+anggota/i },
  { jenis: "ba_sumpah", judul: [/BERITA\s+ACARA\s+(?:PENGAMBILAN\s+)?SUMPAH/i], ciri: [/Advokat/i, /Pengadilan\s+Tinggi/i], dariJudul: /penyumpahan|sumpah/i },
];

/** Jenis satu halaman dari isinya (+ judul e-Court sebagai petunjuk). Murni. */
function kenaliJenis(teks, judul = "") {
  const t = rapikan(teks);
  if (t.replace(/\s/g, "").length < 40) return { jenis: "lain", skor: 0, alasan: "teks_terlalu_sedikit" };
  const skor = ATURAN_JENIS.map((a) => {
    let n = 0;
    for (const p of a.judul) if (p.test(t)) n += 3;
    for (const p of a.ciri) if (p.test(t)) n += 1;
    if (judul && a.dariJudul.test(judul)) n += 2;
    return { jenis: a.jenis, n };
  });
  // Surat keterangan KUA mengalahkan surat keterangan desa; surat kuasa insidentil mengalahkan surat kuasa biasa.
  const ambil = (j) => skor.find((s) => s.jenis === j);
  if (ambil("sk_kua").n >= 4) ambil("sk_desa").n = Math.min(ambil("sk_desa").n, ambil("sk_kua").n - 1);
  if (ambil("kuasa_insidentil").n >= 3) ambil("surat_kuasa").n = Math.min(ambil("surat_kuasa").n, ambil("kuasa_insidentil").n - 1);
  // Surat kuasa sering menyebut "akta cerai"/"akta kelahiran" sebagai urusan yang dikuasakan: judul aktanya harus di awal.
  skor.sort((a, b) => b.n - a.n);
  const [satu, dua] = skor;
  if (satu.n < 3) return { jenis: "lain", skor: satu.n, alasan: "ciri_kurang" };
  if (dua && dua.n === satu.n) return { jenis: "lain", skor: satu.n, alasan: `seri_${satu.jenis}_${dua.jenis}` };
  return { jenis: satu.jenis, skor: satu.n, alasan: "" };
}

// ---------------------------------------------------------------------------
// Nama dan nomor
// ---------------------------------------------------------------------------

const LABEL_BERHENTI = "(?:Desa|Kelurahan|Alamat|Tempat|Tgl|Tanggal|Umur|Jenis|NIK|NIP|Agama|Pekerjaan|Kewarganegaraan|Status|Kecamatan|Kabupaten|RT|Nomor|Bulan|Periode|Jabatan|Golongan|Gaji|Kutipan|Pejabat|Sebagai|Selaku|Yang)";
const LABEL_BIN = "(?:Bin|Binti)";

/** Nama dari potongan teks: label berikutnya dipotong; "bin/binti ..." dibuang kecuali denganBin. */
function namaBersih(s, { denganBin = false } = {}) {
  let n = String(s || "")
    .replace(/[^A-Za-z.,' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  n = n.replace(new RegExp(`\\s+${LABEL_BERHENTI}\\b.*$`, "i"), "").trim();
  if (!denganBin) n = n.replace(new RegExp(`\\s+${LABEL_BIN}\\b.*$`, "i"), "").trim();
  n = n.replace(/^(?:Tn|Ny|Nn|Sdr|Sdri)\.?\s+/i, "").replace(/[.,]+$/, "").trim();
  // Huruf tunggal derau OCR di ujung ("BUDI SANTOSO K") dibuang.
  n = n.replace(/(?:\s+[A-Za-z])+$/, "").replace(/[.,]+$/, "").trim();
  if (n.replace(/[^A-Za-z]/g, "").length < 3 || n.length > 60) return "";
  return n;
}

/** Nama setelah label ("Nama Kepala Keluarga : X", "Nama : X"). */
function namaSesudah(teks, label) {
  const m = new RegExp(`${label}\\s*[:.]?\\s*([A-Za-z][A-Za-z.,' ]{2,60})`, "i").exec(teks);
  return m ? namaBersih(m[1]) : "";
}

/** Nomor KK 16 angka dekat label "No." (galat OCR diperbaiki); tanggal 6 angka di tengahnya harus mungkin. */
function nomorKk(teks) {
  const t = datar(teks);
  const re = /\bNo\b\.?\s*[:.]?\s*([0-9OoDQIl|iLZzSsBGbgqT][0-9OoDQIl|iLZzSsBGbgqT\s.]{14,26})/g;
  let m;
  while ((m = re.exec(t))) {
    const angka = perbaikiAngka(m[1]).replace(/[\s.]/g, "").replace(/\D.*$/, "");
    if (angka.length < 16) continue;
    const kk = angka.slice(0, 16);
    if (kkMasukAkal(kk)) return kk;
  }
  return "";
}

function kkMasukAkal(kk) {
  if (!/^\d{16}$/.test(kk)) return false;
  const prov = Number(kk.slice(0, 2));
  const hari = Number(kk.slice(6, 8));
  const bulan = Number(kk.slice(8, 10));
  return prov >= 11 && prov <= 96 && hari >= 1 && hari <= 31 && bulan >= 1 && bulan <= 12;
}

/** Semua deret 16 angka di halaman (calon NIK) - HANYA untuk pencocokan pihak, tidak pernah keluar dari modul. */
function deretNik(teks) {
  const hasil = new Set();
  const re = /(?:^|[^0-9])(\d(?:\s?\d){15})(?![0-9])/g;
  let m;
  const t = datar(teks);
  while ((m = re.exec(t))) hasil.add(m[1].replace(/\s/g, ""));
  return [...hasil];
}

/**
 * Bulan Romawi di nomor surat ("470/12/KD-D/TI/2026" -> ".../II/2026"): segmen 1-4 huruf tepat sebelum tahun yang
 * hanya terdiri dari I/V/X dan huruf yang lazim tertukar OCR (T, l, L, 1, |) dibaca ulang sebagai Romawi.
 */
function perbaikiRomawi(nomor) {
  return String(nomor || "").replace(/(^|\/)([IVXTlL1|]{1,4})(?=\/(?:19|20)\d{2}\b)/g, (x, a, seg) => {
    const r = seg.replace(/[TlL1|]/g, "I");
    return /^(?:I{1,3}|IV|VI{0,3}|IX|XI{0,2})$/.test(r) ? `${a}${r}` : x;
  });
}

/** Nomor setelah label "Nomor"/"No." sampai spasi ganda/akhir baris: harus memuat angka. */
function nomorBerlabel(teks, { setelah = "" } = {}) {
  const t = rapikan(teks);
  const awal = setelah ? Math.max(0, t.search(setelah)) : 0;
  const re = /\b(?:Nomor|No(?:mor)?\.?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9./\- ]{1,48})/gi;
  re.lastIndex = awal;
  let m;
  while ((m = re.exec(t))) {
    let n = m[1].split(/\n/)[0].replace(/\s{2,}.*$/, "").trim();
    n = n.replace(/\s+(?:Tanggal|Tgl|Tahun|Lampiran|Perihal|Hal|Sifat)\b.*$/i, "").replace(/[\s.,;:\-]+$/, "");
    n = n.replace(/\s*([/.\-])\s*/g, "$1");
    // Deret 16 angka (NIK/KK) bukan nomor surat.
    if (/\d/.test(n) && n.length >= 3 && !/^\d{16}$/.test(n.replace(/[\s.\-]/g, "")) && /[/.\-]/.test(n)) return perbaikiRomawi(n).slice(0, 60);
  }
  return "";
}

/** Nomor akta catatan sipil: 7203-LT-15032019-0012 (LT kelahiran, KM kematian). */
function nomorAktaSipil(teks, kode) {
  const t = datar(teks);
  const re = new RegExp(`([0-9OoIlSB]{4})\\s*[-.]?\\s*(${kode})\\s*[-.]?\\s*([0-9OoIlSB]{8})\\s*[-.]?\\s*([0-9OoIlSB]{3,5})`, "i");
  const m = re.exec(t);
  if (!m) return "";
  return `${perbaikiAngka(m[1])}-${m[2].toUpperCase()}-${perbaikiAngka(m[3])}-${perbaikiAngka(m[4])}`;
}

/** Penerbit: "Kepala Desa X", "Lurah X", "KELURAHAN X", "PEMERINTAH DESA X". */
function penerbitDesa(teks) {
  const t = datar(teks);
  let m = /\b(?:Kepala\s+Desa|Lurah)\s+([A-Z][A-Za-z' ]{2,30}?)(?=\s+(?:Kecamatan|Kec\.|Kabupaten|Kab\.|,|menerangkan|dengan|$))/i.exec(t);
  if (m) return `${/lurah/i.test(m[0]) ? "Lurah" : "Kepala Desa"} ${judulKata(m[1])}`;
  m = /\b(KELURAHAN|DESA)\s+([A-Z][A-Z' ]{2,30}?)(?=\s+(?:KECAMATAN|Jl|Jln|Jalan|Alamat|Kode|$))/.exec(t);
  if (m) return `${m[1] === "DESA" ? "Kepala Desa" : "Lurah"} ${judulKata(m[2])}`;
  return "";
}

function judulKata(s) {
  return bersih(s, 60)
    .toLowerCase()
    .replace(/\b([a-z])/g, (x) => x.toUpperCase());
}

// ---------------------------------------------------------------------------
// Urai medan per jenis
// ---------------------------------------------------------------------------

const JENIS_SK_DESA = [
  ["domisili", /DOMISILI|bertempat\s+tinggal|penduduk\s+(?:desa|kelurahan)/i],
  ["tidak_mampu", /TIDAK\s+MAMPU|\bSKTM\b|kurang\s+mampu/i],
  ["ghaib", /GHAIB|GAIB|tidak\s+diketahui\s+(?:lagi\s+)?(?:keberadaan|alamat|tempat\s+tinggal)|telah\s+pergi\s+meninggalkan/i],
  ["belum_menikah", /BELUM\s+(?:PERNAH\s+)?MENIKAH|BELUM\s+KAWIN|JANDA|DUDA|STATUS\s+PERKAWINAN/i],
  ["kematian", /KEMATIAN|telah\s+meninggal/i],
  ["beda_nama", /BEDA\s+NAMA|SATU\s+ORANG\s+YANG\s+SAMA|perbedaan\s+(?:nama|penulisan)/i],
  ["penghasilan", /PENGHASILAN|USAHA/i],
  ["nikah", /pernah\s+menikah|telah\s+menikah|nikah\s+(?:siri|di\s+bawah\s+tangan)|tidak\s+tercatat/i],
];

/**
 * Medan satu halaman menurut jenisnya. Tidak memuat NIK (lihat deretNik untuk pencocokan). Medan yang tidak terbaca
 * tidak ditulis (bukan string kosong yang menyesatkan). Murni.
 */
function uraiMedan(jenis, teksAsli) {
  const t = rapikan(teksAsli);
  const d = datar(teksAsli);
  const m = {};
  const isi = (k, v) => {
    if (v) m[k] = v;
  };
  if (jenis === "kk") {
    isi("nomor", nomorKk(t));
    isi("kepala", namaSesudah(d, "Nama\\s+Kepala\\s+Keluarga"));
    const tg = /Dikeluarkan\s+Tanggal\s*[:.]?\s*([0-9OoIlSB]{1,2}\s*[-/.]\s*[0-9OoIlSB]{1,2}\s*[-/.]\s*[0-9OoIlSB]{4})/i.exec(d);
    if (tg) isi("tanggal", uraiTanggal(perbaikiAngka(tg[1])));
    const kab = /Kabupaten\s*\/?\s*Kota\s*[:.]?\s*([A-Z][A-Z ]{2,30}?)(?=\s+(?:REPUBLIK|Kode|Provinsi|\||$))/.exec(d);
    isi("kabupaten", kab ? judulKata(kab[1]) : "");
  } else if (jenis === "akta_lahir" || jenis === "akta_kematian") {
    isi("nomor", nomorAktaSipil(t, jenis === "akta_lahir" ? "LT|LU|LH" : "KM") || nomorBerlabel(t, { setelah: /Akta\s+(?:Kelahiran|Kematian)/i }));
    const kata = semuaTanggalKata(d);
    const angka = semuaTanggal(d);
    // Tanggal peristiwa = tanggal pertama sesudah "bahwa di"; tanggal kutipan = sesudah "dikeluarkan".
    const iBahwa = d.search(/bahwa\s+di\b/i);
    const iKeluar = d.search(/dikeluarkan/i);
    const semua = [...kata, ...angka].sort((a, b) => a.indeks - b.indeks);
    const peristiwa = semua.find((x) => iBahwa >= 0 && x.indeks > iBahwa && (iKeluar < 0 || x.indeks < iKeluar));
    if (peristiwa) isi(jenis === "akta_lahir" ? "tanggalLahir" : "tanggalMeninggal", { iso: peristiwa.iso, tampil: peristiwa.tampil, indo: peristiwa.indo });
    const kutipan = iKeluar >= 0 ? semua.find((x) => x.indeks > iKeluar) : null;
    if (kutipan) isi("tanggal", { iso: kutipan.iso, tampil: kutipan.tampil, indo: kutipan.indo });
    const tempat = /bahwa\s+di\s+([A-Z][A-Za-z .']{2,40}?)\s+(?:in\s+|pada\s+tanggal|\|)/i.exec(d);
    isi("tempat", tempat ? judulKata(tempat[1]) : "");
    if (jenis === "akta_lahir") {
      const nama = /telah\s+lahir\s+(?:seorang\s+)?(?:anak\s+)?(?:laki-?\s?laki|perempuan)?\s*(?:bernama|yang\s+diberi\s+nama)?\s*([A-Z][A-Z.' ]{2,50}?)(?=\s+(?:has|anak\s+ke|\||$))/i.exec(d);
      isi("nama", nama ? namaBersih(nama[1]) : "");
      // Tanpa bendera i: nama orang tua ditulis huruf kapital; kata sambung boleh kecil/kapital.
      const ortu = /[Aa][Nn][Aa][Kk]\s+[Kk][Ee]\s*[-:]?\s*([A-Za-z0-9]+)\s+(?:[Dd][Aa][Rr][Ii]\s+)?(?:[Aa][Yy][Aa][Hh]\s+)?([A-Z][A-Z.' ]{2,40}?)\s+[Dd][Aa][Nn]\s+(?:[Ii][Bb][Uu]\s+)?([A-Z][A-Z.' ]{2,40})/.exec(d);
      if (ortu) {
        isi("anakKe", bersih(ortu[1], 20).toLowerCase());
        isi("ayah", namaBersih(ortu[2]));
        isi("ibu", namaBersih(ortu[3]));
      }
    } else {
      const nama = /seorang\s+bernama\s+(?:Tn\s*\/?\s*Ny\s*\/?\s*Nn\.?\s*)?([A-Z][A-Z.' ]{2,50}?)(?=\s+(?:a\s+person|\||lahir|$))/i.exec(d);
      isi("nama", nama ? namaBersih(nama[1]) : "");
    }
  } else if (jenis === "akta_nikah") {
    const nomor = /(?:Nomor|Number)\s*[:.]?\s*(\d{1,5}\s*\/\s*\d{1,4}\s*\/\s*[IVXLC0-9]{1,4}\s*\/\s*\d{4})/i.exec(d);
    isi("nomor", nomor ? nomor[1].replace(/\s/g, "") : "");
    const kua = /KUA\s+Kec(?:amatan)?\.?\s*(?:\/\s*KUA\s+District)?\s*[:.]?\s*([A-Z][A-Za-z ]{2,30}?)(?=\s+(?:Kabupaten|Kab|Kota|\||$))/i.exec(d);
    isi("kua", kua ? `KUA Kecamatan ${judulKata(kua[1])}` : "");
    const kaki = tanggalKaki(d);
    if (kaki) isi("tanggal", { iso: kaki.iso, tampil: kaki.tampil, indo: kaki.indo });
    if (/DUPLIKAT/i.test(d)) m.duplikat = true;
  } else if (jenis === "akta_cerai") {
    const nomor = /(\d{1,5})\s*\/\s*AC\s*\/\s*(\d{4})\s*\/\s*(PA\.?\s*[A-Za-z]{2,6})/i.exec(d);
    isi("nomor", nomor ? `${nomor[1]}/AC/${nomor[2]}/${nomor[3].replace(/\s/g, "").replace(/^PA\.?/i, "PA.")}` : "");
    const pa = /Pengadilan\s+Agama\s+([A-Z][A-Za-z]{2,30})/i.exec(d);
    isi("penerbit", pa ? `Pengadilan Agama ${judulKata(pa[1])}` : "");
    const kaki = tanggalKaki(d);
    if (kaki) isi("tanggal", { iso: kaki.iso, tampil: kaki.tampil, indo: kaki.indo });
  } else if (jenis === "sk_desa" || jenis === "sk_kua") {
    isi("nomor", nomorBerlabel(t, { setelah: /SURAT\s+KETERANGAN|KETERANGAN/i }));
    const kaki = tanggalKaki(d);
    if (kaki) isi("tanggal", { iso: kaki.iso, tampil: kaki.tampil, indo: kaki.indo });
    isi("nama", namaSesudah(d, "Nama"));
    if (jenis === "sk_desa") {
      const sub = JENIS_SK_DESA.find(([, p]) => p.test(d));
      isi("perihal", sub ? sub[0] : "");
      isi("penerbit", penerbitDesa(d));
    } else {
      const kua = /KANTOR\s+URUSAN\s+AGAMA\s+(?:KECAMATAN\s+)?([A-Z][A-Za-z ]{2,30}?)(?=\s+(?:KABUPATEN|KOTA|Jl|Jalan|Alamat|\||$))/i.exec(d);
      isi("penerbit", kua ? `Kepala KUA Kecamatan ${judulKata(kua[1])}` : "");
      isi("perihal", /PENOLAKAN/i.test(d) ? "penolakan" : /tidak\s+tercatat|belum\s+tercatat|tidak\s+terdaftar/i.test(d) ? "tidak_tercatat" : "lain");
    }
  } else if (jenis === "surat_kuasa" || jenis === "kuasa_insidentil") {
    const kaki = tanggalKaki(d);
    if (kaki) isi("tanggal", { iso: kaki.iso, tampil: kaki.tampil, indo: kaki.indo });
    const kantor = /(?:pada|dari|berkantor\s+(?:di|pada))\s+(Kantor\s+(?:Hukum|Advokat|Pengacara)[A-Za-z&.,' ]{2,60}?|Lembaga\s+Bantuan\s+Hukum[A-Za-z&.,' ]{2,60}?|LBH\s+[A-Za-z&.,' ]{2,60}?|Law\s+(?:Firm|Office)\s+[A-Za-z&.,' ]{2,60}?|Pos\s+Bantuan\s+Hukum[A-Za-z&.,' ]{2,60}?)(?=\s*(?:,|beralamat|yang\s+beralamat|berkedudukan|di\s+Jl|Jalan|Jl\.|alamat|\(|$))/i.exec(d);
    isi("kantor", kantor ? bersih(kantor[1].replace(/[,.]+$/, ""), 120) : "");
    // Pihak yang diwakili: "selaku Tergugat", "sebagai Penggugat/Pemohon".
    const selaku = /(?:selaku|sebagai|dalam\s+kedudukan(?:nya)?\s+sebagai)\s+(Penggugat|Tergugat|Pemohon|Termohon|Turut\s+Tergugat)/i.exec(d);
    isi("selaku", selaku ? judulKata(selaku[1]) : "");
    if (jenis === "kuasa_insidentil") {
      // "Yang bertanda tangan di bawah ini saya : Nama : X ... Sebagai penerima kuasa"
      const iPenerima = d.search(/sebagai\s+penerima\s+kuasa/i);
      const iPemberi = d.search(/sebagai\s+pemberi\s+kuasa|mewakili\s*:/i);
      if (iPenerima > 0 && (iPemberi < 0 || iPenerima < iPemberi)) {
        const n = /Nama\s*[:.]?\s*([A-Za-z][A-Za-z.,' ]{2,60})/i.exec(d.slice(0, iPenerima));
        isi("penerima", n ? namaBersih(n[1], { denganBin: true }) : "");
      } else {
        const pk = /memberi(?:kan)?\s+kuasa\s+(?:insidentil\s+)?kepada\s*[:.]?\s*(?:Nama\s*[:.]?\s*)?([A-Z][A-Za-z.' ]{2,50})/i.exec(d);
        isi("penerima", pk ? namaBersih(pk[1], { denganBin: true }) : "");
      }
      const hub = /(?:adalah|merupakan|selaku)\s+(saudara\s+kandung|kakak\s+kandung|adik\s+kandung|anak\s+kandung|orang\s+tua\s+kandung|ayah\s+kandung|ibu\s+kandung|paman|bibi|sepupu|keponakan|ipar|kakek|nenek|cucu|suami|istri|anak|saudara)\b/i.exec(d);
      isi("hubungan", hub ? hub[1].toLowerCase().replace(/\s+/g, " ") : "");
    } else {
      const pemberi = /bertanda\s+tangan\s+di\s+bawah\s+ini\s*[:.,]?\s*(?:saya\s*)?[:.,]?\s*(?:Nama\s*[:.]?\s*)?([A-Z][A-Za-z.' ]{2,50})/i.exec(d);
      isi("pemberi", pemberi ? namaBersih(pemberi[1]) : "");
    }
  } else if (jenis === "slip_gaji") {
    const bersihGaji = /(?:GAJI\s+BERSIH|PENGHASILAN\s+BERSIH|JUMLAH\s+(?:BERSIH|DITERIMA|YANG\s+DITERIMA)|TAKE\s+HOME\s+PAY|THP)\s*[:.]?\s*(?:Rp\.?\s*)?([0-9OoIlSB][0-9OoIlSB.,]{3,14})/i.exec(d);
    if (bersihGaji) {
      const angka = Number(perbaikiAngka(bersihGaji[1]).replace(/[.,](\d{2})$/, "").replace(/[.,]/g, ""));
      if (angka >= 100000 && angka <= 200000000) isi("penghasilan", angka);
    }
    isi("nama", namaSesudah(d, "Nama"));
    const bulan = new RegExp(`(?:Bulan|Periode)\\s*[:.]?\\s*([A-Za-z]{3,10})\\s+(\\d{4})`, "i").exec(d);
    if (bulan && indeksBulan(bulan[1]) >= 0) isi("periode", `${BULAN_NAMA[indeksBulan(bulan[1])]} ${bulan[2]}`);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Satu berkas: halaman -> bacaan per halaman
// ---------------------------------------------------------------------------

/**
 * halaman: [{ teks, sumber: "teks-pdf" | "ocr", conf? }]. Mengembalikan bacaan per halaman beserta calon NIK (deret)
 * dan nama yang dipakai mencocokkan pihak. Calon NIK HANYA dipakai cocokkanPihak lalu dibuang pemanggil.
 */
function bacaBerkas({ judul = "", halaman = [] } = {}) {
  const keluar = [];
  (Array.isArray(halaman) ? halaman : []).slice(0, BATAS_HALAMAN).forEach((h, i) => {
    const teks = rapikan(h && h.teks);
    const k = kenaliJenis(teks, judul);
    const medan = ["lain", "ktp", "kartu_advokat", "ba_sumpah"].includes(k.jenis) ? {} : uraiMedan(k.jenis, teks);
    keluar.push({
      halaman: i + 1,
      jenis: k.jenis,
      skor: k.skor,
      sumber: h && h.sumber === "teks-pdf" ? "teks-pdf" : "ocr",
      medan,
      _nik: k.jenis === "lain" ? [] : deretNik(teks),
      _nama: namaUntukCocok(k.jenis, medan, teks),
    });
  });
  return keluar;
}

/** Nama-nama di halaman yang menunjuk pihak perkara (bukan anak/penerima kuasa/advokat). */
function namaUntukCocok(jenis, medan, teks) {
  const d = datar(teks);
  if (jenis === "kk") {
    const nama = [medan.kepala].filter(Boolean);
    // Baris anggota: "1 NAMA LENGKAP 7203...." - nama sebelum deret 16 angka.
    const re = /([A-Z][A-Z.' ]{2,40}?)\s+\d(?:\s?\d){15}/g;
    let m;
    while ((m = re.exec(d))) {
      const n = namaBersih(m[1]);
      if (n) nama.push(n);
    }
    return nama;
  }
  if (jenis === "akta_lahir") return [medan.ayah, medan.ibu].filter(Boolean);
  if (jenis === "akta_nikah" || jenis === "akta_cerai") {
    const nama = [];
    const re = /Nama\s*(?:\/\s*Full\s*name)?\s*[:.]?\s*([A-Z][A-Z.' ]{2,40})/g;
    let m;
    while ((m = re.exec(d))) {
      const n = namaBersih(m[1]);
      if (n) nama.push(n);
    }
    return nama;
  }
  if (jenis === "surat_kuasa") return [medan.pemberi].filter(Boolean);
  if (jenis === "kuasa_insidentil") {
    // Pemberi kuasa = setiap "Nama :" yang bukan penerima kuasa.
    const penerima = K.namaBaku(medan.penerima || "");
    const nama = [];
    const re = /Nama\s*[:.]?\s*([A-Z][A-Za-z.' ]{2,50})/g;
    let m;
    while ((m = re.exec(d))) {
      const n = namaBersih(m[1]);
      if (n && (!penerima || K.namaBaku(n) !== penerima)) nama.push(n);
    }
    return nama;
  }
  return [medan.nama].filter(Boolean);
}

/**
 * Cocokkan satu halaman ke pihak perkara. pihak: [{cabang, urutan, nama, nik, tanggalLahirIso}].
 * NIK yang sama (atau beda <= 1 angka dengan nama serupa) atau nama serupa satu-satunya. Mengembalikan pihak-pihak
 * yang cocok TANPA NIK. Kartu keluarga dan akta nikah boleh cocok ke beberapa pihak (suami dan istri).
 */
function cocokkanPihak(bacaan, pihak) {
  const daftar = Array.isArray(pihak) ? pihak : [];
  const nik = new Set((bacaan && bacaan._nik) || []);
  const nama = (bacaan && bacaan._nama) || [];
  const cocok = [];
  for (const p of daftar) {
    const pn = String(p.nik || "").replace(/\D/g, "");
    let cara = "";
    if (pn.length === 16 && nik.has(pn)) cara = "nik";
    else if (pn.length === 16 && [...nik].some((n) => K.bedaNik(n, pn) <= 1) && nama.some((n) => K.namaSerupa(n, p.nama))) cara = "nik_nama";
    else if (nama.some((n) => K.namaSerupa(n, p.nama))) cara = "nama";
    if (cara) cocok.push({ cabang: Number(p.cabang), urutan: Number(p.urutan) || 1, cara });
  }
  // Nama saja yang menunjuk lebih dari satu pihak (nama kembar) = ambigu: dibuang.
  const lewatNama = cocok.filter((c) => c.cara === "nama");
  const kuat = cocok.filter((c) => c.cara !== "nama");
  if (kuat.length) return kuat;
  return lewatNama.length === 1 || (bacaan && ["kk", "akta_nikah", "akta_lahir"].includes(bacaan.jenis)) ? lewatNama : [];
}

/**
 * Bacaan yang aman disimpan/ditampilkan: tanpa calon NIK dan tanpa nama mentah pencocok. Bila pihak diberikan, nomor
 * "KK" yang ternyata sama dengan NIK salah satu pihak (OCR membaca baris anggota sebagai nomor KK) juga dibuang.
 */
function tanpaRahasia(b, pihak) {
  const { _nik, _nama, ...sisa } = b || {};
  if (sisa.medan && sisa.medan.nomor && Array.isArray(pihak)) {
    const nikPihak = new Set(pihak.map((p) => String(p.nik || "").replace(/\D/g, "")).filter((x) => x.length === 16));
    if (nikPihak.has(String(sisa.medan.nomor).replace(/\D/g, ""))) {
      const { nomor, ...lain } = sisa.medan;
      sisa.medan = lain;
    }
  }
  return sisa;
}

// ---------------------------------------------------------------------------
// Usulan ABT + kalimat salin
// ---------------------------------------------------------------------------

const KODE = Object.freeze({
  tglKuasaP: "0184",
  tglKuasaT: "0185",
  kantorP: "0156",
  kantorT: "0157",
  penerimaInsidentil: "8894",
  hubunganInsidentil: "8895",
  penghasilanP: "5171",
  penghasilanT: "5271",
  noPenolakanKua: "0652",
  tglPenolakanKua: "0653",
  noKua: "0654",
  tglKua: "0655",
  noDuplikatNikah: "1108",
  tglDuplikatNikah: "0889",
  ttlAnakAua: "9709",
});

/** Isian petugas yang sudah ada (bukan kosong dan bukan garis bawah/titik-titik) - selalu menang. */
function isianTerisi(nilai) {
  const s = bersih(nilai, 2000);
  return Boolean(s) && !/^[_.\s,…-]*$/.test(s);
}

function rupiah(n) {
  return `Rp${Number(n).toLocaleString("id-ID")},00`;
}

/** Cabang pihak yang diwakili surat kuasa: kata "selaku", lalu pemberi kuasa yang cocok, lalu pengunggah e-Court. */
function cabangKuasa(b) {
  const s = String((b.medan && b.medan.selaku) || "").toLowerCase();
  if (/turut/.test(s)) return 0;
  if (/tergugat|termohon/.test(s)) return 2;
  if (/penggugat|pemohon/.test(s)) return 1;
  const c = (b.pihak || []).map((x) => x.cabang).filter((x) => x === 1 || x === 2);
  if (c.length && c.every((x) => x === c[0])) return c[0];
  const u = String(b.pengunggah || "").toLowerCase();
  if (/turut/.test(u)) return 0;
  if (/tergugat|termohon/.test(u)) return 2;
  if (/penggugat|pemohon/.test(u)) return 1;
  return 0;
}

function labelSumber(b) {
  return `e-Court: ${bersih(b.judul || "lampiran", 120)} hal. ${b.halaman} (${JENIS[b.jenis] || "lampiran"}${b.sumber === "ocr" ? ", dibaca OCR" : ""})`;
}

/** Kalimat salin alat bukti (bentuk bawaan blangko; tanda P.n diisi petugas). Tanpa NIK. */
function kalimatBukti(b) {
  const m = b.medan || {};
  const tgl = m.tanggal ? ` tanggal ${m.tanggal.indo}` : "";
  // Nomor KK (16 angka) disisipkan SESUDAH penyamaran NIK (lihat susunUsulan); nomor lain apa adanya.
  const no = m.nomor ? (b.jenis === "kk" ? " Nomor \u0000NOMOR\u0000" : ` Nomor ${m.nomor}`) : "";
  const ekor = ", bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P. ... ;";
  if (b.jenis === "kk") return `Fotokopi Kartu Keluarga${no}${tgl}${m.kepala ? ` atas nama Kepala Keluarga ${m.kepala}` : ""}, yang dikeluarkan oleh Kepala Dinas Kependudukan dan Pencatatan Sipil${m.kabupaten ? ` ${/^kota\b/i.test(m.kabupaten) ? m.kabupaten : `Kabupaten ${m.kabupaten}`}` : ""}${ekor}`;
  if (b.jenis === "akta_lahir") return `Fotokopi Kutipan Akta Kelahiran${no}${tgl}${m.nama ? ` atas nama ${m.nama}` : ""}, yang dikeluarkan oleh Pejabat Pencatatan Sipil${ekor}`;
  if (b.jenis === "akta_kematian") return `Fotokopi Kutipan Akta Kematian${no}${tgl}${m.nama ? ` atas nama ${m.nama}` : ""}, yang dikeluarkan oleh Pejabat Pencatatan Sipil${ekor}`;
  if (b.jenis === "akta_cerai") return `Fotokopi Akta Cerai${no}${tgl}, yang dikeluarkan oleh ${m.penerbit || "Panitera Pengadilan Agama ..."}${ekor}`;
  if (b.jenis === "akta_nikah") return `Fotokopi ${m.duplikat ? "Duplikat " : ""}Kutipan Akta Nikah${no}${tgl}, yang dikeluarkan oleh ${m.kua || "Kantor Urusan Agama ..."}${ekor}`;
  if (b.jenis === "sk_desa" || b.jenis === "sk_kua") {
    const perihal = { domisili: " Domisili", tidak_mampu: " Tidak Mampu", ghaib: " Ghaib", belum_menikah: " Status Perkawinan", kematian: " Kematian", beda_nama: " Beda Nama", penghasilan: " Penghasilan", penolakan: " Penolakan", tidak_tercatat: " Nikah Tidak Tercatat" }[m.perihal] || "";
    return `Fotokopi Surat Keterangan${perihal}${no}${tgl}, yang dikeluarkan oleh ${m.penerbit || (b.jenis === "sk_kua" ? "Kepala KUA Kecamatan ..." : "Kepala Desa/Lurah ...")}${ekor}`;
  }
  return "";
}

/**
 * Usulan ABT + kalimat salin dari bacaan lampiran satu perkara.
 *   bacaan:    [{ fileId, judul, pengunggah, halaman, jenis, sumber, medan, pihak: [{cabang, urutan, cara}] }]
 *   sebutan:   { lawan: "Penggugat", pelaku: "Tergugat" }
 *   isianLama: { "0185": "2026-05-01", ... } isian petugas yang sudah ada (bila diketahui) - selalu menang
 *   jenisPerkara: teks jenis perkara SIPP (mis. "Asal Usul Anak") untuk isian khusus jenis
 * Semua usulan jagaIsianLama; tingkat dari tingkatMedan (ragu sampai terukur).
 */
function susunUsulan({ bacaan = [], sebutan = {}, isianLama = {}, jenisPerkara = "" } = {}) {
  const lawan = sebutan.lawan || "Penggugat";
  const pelaku = sebutan.pelaku || "Tergugat";
  const usulan = [];
  const kalimat = [];
  const catatan = [];
  const sudah = new Set();
  const tambah = (kode, nama, nilai, b, kunciMedan, catatanUsulan, tipe = "teks") => {
    if (!nilai || sudah.has(kode)) return;
    if (isianTerisi(isianLama[kode])) {
      sudah.add(kode);
      catatan.push(`${nama}: sudah diisi petugas - usulan dari lampiran tidak dipakai.`);
      return;
    }
    sudah.add(kode);
    usulan.push({
      kode,
      nama,
      nilai,
      tipe,
      keyakinan: tingkatMedan(kunciMedan),
      bentrok: "",
      jagaIsianLama: true,
      sumber: [{ asal: "lampiran-ecourt", kalimat: labelSumber(b) }],
      kodePola: `lampiran-${b.jenis}-${kunciMedan.split(".")[1] || "nilai"}`,
      catatan: buangNik(catatanUsulan),
    });
  };
  const urut = (Array.isArray(bacaan) ? bacaan : []).filter((b) => b && b.jenis && b.medan).slice().sort((a, b) => String(a.fileId).localeCompare(String(b.fileId)) || a.halaman - b.halaman);
  const milikPerkara = (b) => Array.isArray(b.pihak) && b.pihak.length > 0;

  for (const b of urut) {
    const m = b.medan;
    if (b.jenis === "surat_kuasa" && milikPerkara(b)) {
      const c = cabangKuasa(b);
      if (c === 2) {
        if (m.tanggal) tambah(KODE.tglKuasaT, `Tanggal surat kuasa ${pelaku}`, m.tanggal.iso, b, "surat_kuasa.tanggal", `Tanggal di kaki surat kuasa yang diunggah ke e-Court (${m.tanggal.indo}) - periksa dengan surat kuasa yang didaftarkan.`, "tanggal");
        if (m.kantor) tambah(KODE.kantorT, `Nama kantor advokat ${pelaku}`, m.kantor, b, "surat_kuasa.kantor", "Nama kantor dari surat kuasa e-Court - periksa ejaannya.");
      }
    } else if (b.jenis === "surat_kuasa" && !milikPerkara(b) && cabangKuasa(b) === 2) {
      // Surat kuasa yang menyebut "selaku Tergugat" tetapi pemberinya tidak terbaca: tetap boleh, ditandai.
      if (m.tanggal) tambah(KODE.tglKuasaT, `Tanggal surat kuasa ${pelaku}`, m.tanggal.iso, b, "surat_kuasa.tanggal", `Tanggal di kaki surat kuasa e-Court (${m.tanggal.indo}); nama pemberi kuasa tidak terbaca - periksa.`, "tanggal");
      if (m.kantor) tambah(KODE.kantorT, `Nama kantor advokat ${pelaku}`, m.kantor, b, "surat_kuasa.kantor", "Nama kantor dari surat kuasa e-Court; nama pemberi kuasa tidak terbaca - periksa.");
    }
    if (b.jenis === "kuasa_insidentil" && milikPerkara(b) && cabangKuasa(b) !== 2) {
      if (m.penerima) tambah(KODE.penerimaInsidentil, `Nama penerima kuasa insidentil ${lawan}`, m.penerima, b, "kuasa_insidentil.penerima", "Dari surat kuasa/permohonan kuasa insidentil e-Court - periksa dengan penetapan izin Ketua.");
      if (m.hubungan) tambah(KODE.hubunganInsidentil, `Hubungan penerima kuasa dengan ${lawan}`, m.hubungan, b, "kuasa_insidentil.hubungan", "Hubungan keluarga yang disebut dalam surat kuasa insidentil e-Court.");
    }
    if (b.jenis === "slip_gaji" && milikPerkara(b) && m.penghasilan) {
      const c = b.pihak[0].cabang;
      if (c === 1 || c === 2) {
        tambah(c === 1 ? KODE.penghasilanP : KODE.penghasilanT, `Penghasilan ${c === 1 ? lawan : pelaku} perbulan`, rupiah(m.penghasilan), b, "slip_gaji.penghasilan", `Penghasilan bersih pada slip gaji${m.periode ? ` ${m.periode}` : ""} di e-Court - bukan penghasilan yang dinilai majelis.`);
      }
    }
    if (b.jenis === "sk_kua" && m.perihal === "penolakan" && (milikPerkara(b) || /wali/i.test(jenisPerkara))) {
      if (m.nomor) tambah(KODE.noPenolakanKua, "Nomor surat penolakan KUA", m.nomor, b, "sk_kua.nomor", "Dari surat penolakan KUA di lampiran e-Court.");
      if (m.tanggal) tambah(KODE.tglPenolakanKua, "Tanggal surat penolakan KUA", m.tanggal.iso, b, "sk_kua.tanggal", `Tanggal surat penolakan KUA (${m.tanggal.indo}).`, "tanggal");
    }
    if (b.jenis === "sk_kua" && m.perihal === "tidak_tercatat" && (milikPerkara(b) || /[i]s[t]?bat/i.test(jenisPerkara))) {
      if (m.nomor) tambah(KODE.noKua, "Nomor surat keterangan KUA", m.nomor, b, "sk_kua.nomor", "Surat keterangan KUA (nikah tidak tercatat) dari lampiran e-Court.");
      if (m.tanggal) tambah(KODE.tglKua, "Tanggal surat keterangan KUA", m.tanggal.iso, b, "sk_kua.tanggal", `Tanggal surat keterangan KUA (${m.tanggal.indo}).`, "tanggal");
    }
    if (b.jenis === "akta_nikah" && m.duplikat && milikPerkara(b)) {
      if (m.nomor) tambah(KODE.noDuplikatNikah, "Nomor duplikat kutipan akta nikah", m.nomor, b, "akta_nikah.nomor", "Dari duplikat kutipan akta nikah di lampiran e-Court.");
      if (m.tanggal) tambah(KODE.tglDuplikatNikah, "Tanggal duplikat kutipan akta nikah", m.tanggal.iso, b, "akta_nikah.tanggal", `Tanggal duplikat (${m.tanggal.indo}).`, "tanggal");
    }
    if (b.jenis === "akta_lahir" && milikPerkara(b) && /asal\s*usul/i.test(jenisPerkara) && m.tanggalLahir) {
      tambah(KODE.ttlAnakAua, "Tempat dan tanggal lahir anak", `${m.tempat ? `di ${m.tempat} ` : ""}pada tanggal ${m.tanggalLahir.indo}`, b, "akta_lahir.tanggalLahir", `Dari kutipan akta kelahiran${m.nama ? ` ${m.nama}` : ""} di lampiran e-Court.`);
    }
    // Kalimat salin alat bukti: hanya dokumen milik pihak perkara ini dan yang nomor atau tanggalnya terbaca.
    // Akta kematian dan akta cerai menyebut orang yang bukan pihak (pewaris, suami terdahulu) - ikut bila perkara ini
    // satu-satunya pemilik berkasnya (berkas e-Court perkara ini sendiri), ditandai lewat sumbernya.
    const bolehTanpaPihak = ["sk_kua", "akta_kematian", "akta_cerai"].includes(b.jenis);
    if (["kk", "akta_lahir", "akta_kematian", "akta_cerai", "akta_nikah", "sk_desa", "sk_kua"].includes(b.jenis) && (milikPerkara(b) || bolehTanpaPihak) && (m.nomor || m.tanggal)) {
      const teks = buangNik(kalimatBukti(b)).replace("\u0000NOMOR\u0000", String(m.nomor || ""));
      if (teks && !kalimat.some((k) => k.teks === teks)) {
        kalimat.push({
          kode: `lampiran-bukti-${b.jenis}`,
          judul: `Alat bukti: ${JENIS[b.jenis]}${m.nomor ? "" : " (nomor tidak terbaca)"}`,
          teks,
          sumber: labelSumber(b),
          keyakinan: tingkatMedan(`${b.jenis}.nomor`),
        });
      }
    }
  }
  const ocr = urut.filter((b) => b.sumber === "ocr").length;
  if (usulan.length || kalimat.length) catatan.push(`Dari lampiran e-Court${ocr ? " hasil pindai (OCR)" : ""}: ejaan nama dan angka dapat meleset - periksa dengan aslinya.`);
  return { usulan, kalimat, catatan };
}

module.exports = {
  VERSI_LAMPIRAN,
  BATAS_TEKS_HALAMAN,
  BATAS_HALAMAN,
  JENIS,
  KODE,
  TINGKAT_TERUKUR,
  tingkatMedan,
  rapikan,
  perbaikiAngka,
  buangNik,
  indeksBulan,
  uraiTanggal,
  angkaKata,
  semuaTanggal,
  semuaTanggalKata,
  tanggalKaki,
  kenaliJenis,
  uraiMedan,
  nomorKk,
  kkMasukAkal,
  nomorBerlabel,
  perbaikiRomawi,
  nomorAktaSipil,
  bacaBerkas,
  cocokkanPihak,
  tanpaRahasia,
  isianTerisi,
  cabangKuasa,
  kalimatBukti,
  susunUsulan,
};
