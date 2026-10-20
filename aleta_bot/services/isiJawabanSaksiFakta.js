"use strict";

/**
 * ============================================================================
 * PENGISI JAWABAN SAKSI BERSUMBER (20 Okt 2026)
 * ============================================================================
 *
 * Jawaban saksi di Blangko Derry tinggal "..." walaupun datanya ada: tanggal
 * dan tempat nikah, KUA, wali, yang menikahkan, mahar, saksi nikah, anak,
 * awal perselisihan, pisah rumah, alamat. Sebabnya: set pertanyaan portal
 * ("Itsbat nikah - disarankan", set cerai, set jenis lain) menulis titik-titik
 * dengan bunyinya sendiri, sedangkan penyusun lama (susunKeteranganSaksiSdg,
 * isiTemplatSaksi) hanya mengenali bunyi templat ABT dan bunyi cerai tertentu.
 *
 * Berkas ini MURNI (tanpa jaringan, tanpa basis data, tanpa membaca berkas) dan
 * mengisi titik-titik dari fakta berurutan sumber:
 *
 *   1. isian blangko perkara itu (variabel ABT #kode# -> nilai; yang sudah
 *      ditemukan kartu isian atau diketik petugas);
 *   2. data SIPP (data pernikahan, itsbat, anak, pihak, tanggal lahir);
 *   3. posita/gugatan/permohonan (hasil mesin deteksi bot + pola tambahan di sini).
 *
 * Setiap jawaban yang disusun membawa KONTRAK BERSAMA:
 *   { teks, yakin: "yakin"|"cukup"|"ragu", sumber: "isian blangko + data SIPP", ket: "penjelasan singkat untuk ikon i" }
 * "ragu" bila berasal dari pola longgar di posita atau antar sumber bertentangan.
 *
 * Aturan:
 *   - hanya titik-titik yang DIISI; bagian yang datanya tidak ada tetap "..." (tidak ada yang dikarang);
 *   - pilihan pengetahuan saksi dihormati: "tidak tahu"/"tidak pernah menyaksikan"/"hanya tahu sudah pisah" tidak
 *     diberi rincian, "dari cerita" memakai bentuk "Menurut cerita ...";
 *   - saksi ke-2 memakai kalimat yang sedikit berbeda dari saksi ke-1 (ragam sederhana, tetap setia pada isi);
 *   - ejaan baku: tanggal "17 November 2025", uang "Rp1.100.000,00 (satu juta seratus ribu rupiah)";
 *   - tidak satu kata "Aleta" pun masuk ke jawaban (nilai yang memuatnya dibuang);
 *   - jawaban yang sudah diketik petugas tidak pernah ditimpa di sini (pemasangan ke baris ada di
 *     blangko-derry-saksi.js: pasangJawaban).
 */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const T = "(?:\\.{3,}|…)"; // satu titik-titik isian
const RE_TITIK = /\.{3,}|…/g;
const RE_ALETA = /aleta/i;
const RE_SEBUTAN = "(?:Pemohon(?:\\s+(?:I{1,3}|IV|\\d))?|Termohon|Penggugat|Tergugat)";
const URUT_YAKIN = { ragu: 0, cukup: 1, yakin: 2 };

const adaTitik = (t) => /\.{3,}|…/.test(String(t || ""));
const hitungTitik = (t) => (String(t || "").match(RE_TITIK) || []).length;
const minYakin = (a, b) => (URUT_YAKIN[a] <= URUT_YAKIN[b] ? a : b);
const maxYakin = (a, b) => (URUT_YAKIN[a] >= URUT_YAKIN[b] ? a : b);
const norm = (t) =>
  String(t == null ? "" : t)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const rapat = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
const kecilAwal = (t) => {
  const s = String(t || "");
  if (/^(?:Pemohon|Termohon|Penggugat|Tergugat|Ayah|Ibu)\b/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
};
const besarAwal = (t) => String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);

function dariKeyakinan(k) {
  const x = String(k || "").toLowerCase();
  if (x === "pasti" || x === "yakin") return "yakin";
  if (x === "cukup") return "cukup";
  return "ragu";
}

// ============================================================================
// Pembersih nilai
// ============================================================================

/** Membuang akhiran tanda baca dan spasi ganda dari satu nilai fakta. */
function bersihNilai(t) {
  return rapat(String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/[� ]/g, " "))
    .replace(/^[\s,;:.\-–]+/, "")
    .replace(/[\s,;:.]+$/, "")
    .trim();
}

/** "2025-11-17" | "17/11/2025" | "hari Senin tanggal 09 Desember 2008" -> "17 November 2025" / "9 Desember 2008"; "" bila bukan tanggal lengkap. */
function tanggalIndo(t) {
  const s = String(t == null ? "" : t);
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m && Number(m[1]) > 1800 && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31) return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
  m = /\b(\d{1,2})[/.](\d{1,2})[/.]((?:19|20)\d{2})\b/.exec(s);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${Number(m[1])} ${BULAN[Number(m[2]) - 1]} ${m[3]}`;
  m = new RegExp(`\\b(\\d{1,2})\\s+(${BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+((?:19|20)\\d{2})\\b`, "i").exec(s);
  if (m) {
    let b = m[2].toLowerCase();
    b = b === "pebruari" ? "februari" : b === "nopember" ? "november" : b;
    const nama = BULAN.find((x) => x.toLowerCase() === b);
    if (nama && Number(m[1]) >= 1 && Number(m[1]) <= 31) return `${Number(m[1])} ${nama} ${m[3]}`;
  }
  return "";
}

/** Tanggal lengkap bila ada; selain itu "bulan Mei 1997"/"tahun 1956" apa adanya; "" bila tak terbaca. */
function waktuNikah(t) {
  const lengkap = tanggalIndo(t);
  if (lengkap) return lengkap;
  const s = rapat(t);
  const bt = new RegExp(`^(?:bulan\\s+)?(${BULAN.join("|")})\\s+((?:19|20)\\d{2})$`, "i").exec(s);
  if (bt) return `bulan ${BULAN.find((b) => b.toLowerCase() === bt[1].toLowerCase())} ${bt[2]}`;
  const th = /^(?:tahun\s+)?((?:19|20)\d{2})$/i.exec(s);
  if (th) return `tahun ${th[1]}`;
  if (/^(?:bulan|tahun)\s+\S+/i.test(s)) return s;
  return "";
}

/** Membuang ", Provinsi ..." di ujung nama wilayah ("Desa X, Kecamatan Y, Kabupaten Z, Provinsi S" -> tanpa provinsi). */
function tanpaProvinsi(t) {
  return bersihNilai(t).replace(/[,\s]*\b(?:Provinsi|Propinsi)\b[^;]*$/i, "").replace(/[\s,]+$/, "");
}

/** "KUA Dolo Kabupaten  Sigi Provinsi Sulawesi Tengah" | "Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi ..." -> "Kantor Urusan Agama Kecamatan Dolo, Kabupaten Sigi". */
function kuaBaku(t) {
  let s = tanpaProvinsi(rapat(t));
  if (!s) return "";
  s = s.replace(/^(?:di\s+)?(?:wilayah\s+hukum\s+)?/i, "").replace(/^(?:Kantor\s+Urusan\s+Agama|KUA)\b[\s.:]*(?:\(KUA\)\s*)?/i, "").trim();
  if (!s) return "";
  s = s.replace(/\s+(Kabupaten|Kota)\s+/i, ", $1 ").replace(/,\s*,/g, ",");
  if (!/^(?:Kecamatan|Kec\.?)\s/i.test(s) && !/^(?:Kabupaten|Kota)\b/i.test(s)) s = `Kecamatan ${s}`;
  s = s.replace(/^Kec\.?\s+/i, "Kecamatan ");
  return `Kantor Urusan Agama ${s}`.replace(/\s+/g, " ").replace(/\s+,/g, ",");
}

/** Bilangan kata Indonesia -> angka (satu..sepuluh, sebelas, dua belas, dst. sampai 20). */
const ANGKA_KATA = { nol: 0, satu: 1, seorang: 1, sebuah: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
function keAngka(t) {
  const s = String(t == null ? "" : t).toLowerCase().trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (s in ANGKA_KATA) return ANGKA_KATA[s];
  const m = /^(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+belas$/.exec(s);
  if (m) return ANGKA_KATA[m[1]] + 10;
  return null;
}

const SEBUT = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
/** 1100000 -> "satu juta seratus ribu". */
function terbilang(n) {
  const x = Math.floor(Math.abs(Number(n) || 0));
  if (x === 0) return "nol";
  const sub = (v) => {
    if (v < 12) return SEBUT[v];
    if (v < 20) return `${SEBUT[v - 10]} belas`;
    if (v < 100) return `${SEBUT[Math.floor(v / 10)]} puluh${v % 10 ? ` ${SEBUT[v % 10]}` : ""}`;
    if (v < 200) return `seratus${v % 100 ? ` ${sub(v % 100)}` : ""}`;
    if (v < 1000) return `${SEBUT[Math.floor(v / 100)]} ratus${v % 100 ? ` ${sub(v % 100)}` : ""}`;
    if (v < 2000) return `seribu${v % 1000 ? ` ${sub(v % 1000)}` : ""}`;
    if (v < 1e6) return `${sub(Math.floor(v / 1000))} ribu${v % 1000 ? ` ${sub(v % 1000)}` : ""}`;
    if (v < 1e9) return `${sub(Math.floor(v / 1e6))} juta${v % 1e6 ? ` ${sub(v % 1e6)}` : ""}`;
    if (v < 1e12) return `${sub(Math.floor(v / 1e9))} miliar${v % 1e9 ? ` ${sub(v % 1e9)}` : ""}`;
    return `${sub(Math.floor(v / 1e12))} triliun${v % 1e12 ? ` ${sub(v % 1e12)}` : ""}`;
  };
  return sub(x);
}
const rupiah = (n) => `Rp${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00`;

/**
 * Mahar: semua "Rp.1.100.000 (Satu Juta ...)" ditulis ulang "Rp1.100.000,00 (satu juta seratus ribu rupiah)" dan
 * keterangan cara bayar dipisahkan. -> { barang: "seperangkat alat salat dan uang Rp110.000,00 (...)", bayar: "tunai"|"hutang"|"" }
 */
function uraiMahar(t) {
  let s = rapat(String(t || "").replace(/<[^>]*>/g, " "));
  if (!s) return { barang: "", bayar: "" };
  let bayar = "";
  if (/\b(?:belum\s+dibayar|dihutang|terhutang|hutang|utang|secara\s+kredit|ditangguhkan)\b/i.test(s)) bayar = "hutang";
  else if (/\b(?:tunai|kontan|lunas|dibayar\s+(?:langsung|saat))\b/i.test(s)) bayar = "tunai";
  s = s
    .replace(/[,;]?\s*(?:dan\s+)?(?:yang\s+)?(?:telah\s+|sudah\s+)?(?:dibayar(?:kan)?|dibayarkan)\s+(?:secara\s+)?(?:tunai|kontan|lunas)\b.*$/i, "")
    .replace(/[,;]?\s*(?:dan\s+)?(?:dengan\s+)?(?:pembayaran\s+)?(?:secara\s+)?(?:tunai|kontan)\b.*$/i, "")
    .replace(/[,;]?\s*(?:dan\s+)?(?:dibayar|belum\s+dibayar|dihutang|terhutang)\b.*$/i, "")
    .replace(/\bsholat\b/gi, "salat")
    .replace(/\bshalat\b/gi, "salat")
    .replace(/\bseperangkat\s+alat\s+sholat\b/gi, "seperangkat alat salat");
  s = s.replace(/Rp\.?\s*([\d.]+)(?:,\d{1,2})?\s*(?:\(([^)]*)\))?/gi, (_, angka, kata) => {
    const n = Number(String(angka).replace(/\./g, ""));
    if (!Number.isFinite(n) || n <= 0) return _;
    return `${rupiah(n)} (${terbilang(n)} rupiah)`;
  });
  s = s.replace(/\(\s*([^)]*?)\s*\)/g, (m, d) => (/rupiah/i.test(d) ? `(${d.toLowerCase()})` : m));
  return { barang: bersihNilai(s).replace(/\s+dan\s*$/i, ""), bayar };
}

/** "telah dikaruniai 2 (dua) orang anak" | "seorang anak" | "belum dikaruniai anak" -> 2 | 1 | 0 | null. */
function jumlahAnakDariTeks(t) {
  const s = String(t || "").toLowerCase();
  if (!s.trim()) return null;
  if (/\b(?:belum|tidak)\s+(?:di)?karuniai\b|\bbelum\s+(?:mempunyai|memiliki|punya)\s+anak\b|\btidak\s+(?:mempunyai|memiliki|punya)\s+anak\b|\btanpa\s+anak\b/.test(s)) return 0;
  let m = /(\d+)\s*(?:\(\s*[a-z]+\s*\)\s*)?(?:orang\s+)?anak\b/.exec(s);
  if (m) return Number(m[1]);
  m = /\b(seorang|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:\(\s*\d+\s*\)\s*)?(?:orang\s+)?anak\b/.exec(s);
  if (m) return keAngka(m[1]);
  m = /\banak\s*:?\s*(\d+)\b/.exec(s);
  if (m) return Number(m[1]);
  return null;
}

// ============================================================================
// Pemetaan variabel ABT -> kunci fakta
// ============================================================================

const KODE_FAKTA = Object.freeze({
  5197: "tglNikah",
  5105: "tempatNikah",
  5178: "kua",
  1217: "waliNama",
  1046: "waliHubungan",
  8087: "penikah",
  "0650": "saksiNikah1",
  "0651": "saksiNikah2",
  1001: "mahar",
  1002: "statusP1",
  1003: "statusP2",
  7211: "umurP1",
  7212: "umurP2",
  "0007": "anak",
  8171: "tujuan",
  1357: "sebabWaliBukanAyah",
  "0222": "awalKonflik",
  "0246": "pisahSejak",
  9944: "lamaPisah",
  1025: "pewarisNama",
  1246: "wafatTgl",
  1247: "wafatSebab",
  1509: "wafatTempat",
  8610: "pewarisPasangan",
  8614: "hartaPeninggalan",
  8608: "anakPewaris",
  // U5 20 Okt: susunan ahli waris dan isian paket u5-ahli-waris (daftar dipisah titik koma di isian, ditulis "A, B dan C" di jawaban)
  9702: "anakPewaris",
  9701: "pewarisPasangan",
  9718: "saudaraPewaris",
  9703: "ayahHidup",
  9704: "ibuHidup",
  9762: "pewarisPengganti",
  9763: "cucuPewaris",
  4540: "saudaraPengganti",
  4541: "keponakanPengganti",
  4500: "tujuan",
  4502: "anakAngkat",
  4507: "wasiatPewaris",
  4510: "kerabatTakIslam",
  5110: "anakNama",
  8603: "anakNama",
  1014: "hubunganErat",
  8723: "calonNama",
  8730: "bendaHarta",
});

const LABEL_FAKTA = Object.freeze({
  tglNikah: "Tgl Nikah",
  tempatNikah: "tempat menikah",
  kua: "KUA",
  waliNama: "nama wali",
  waliHubungan: "hubungan wali",
  penikah: "yang menikahkan",
  saksiNikah1: "saksi nikah 1",
  saksiNikah2: "saksi nikah 2",
  mahar: "mahar",
  statusP1: "status pihak pertama",
  statusP2: "status pihak kedua",
  umurP1: "umur pihak pertama",
  umurP2: "umur pihak kedua",
  jumlahAnak: "jumlah anak",
  awalKonflik: "awal perselisihan",
  pisahSejak: "pisah rumah sejak",
  lamaPisah: "lama pisah",
  siapaPergi: "yang meninggalkan rumah",
  puncak: "puncak perselisihan",
  puncakPeristiwa: "peristiwa puncak",
  kediaman: "tempat tinggal bersama",
  alamatP: "alamat pihak pertama",
  pekerjaanP: "pekerjaan pihak pertama",
  pekerjaanT: "pekerjaan pihak kedua",
  penyebab: "sebab perselisihan",
  alamatT: "alamat pihak kedua",
  tujuan: "tujuan perkara",
  pewarisNama: "nama pewaris",
  wafatTgl: "tanggal meninggal",
  wafatTempat: "tempat meninggal",
  wafatSebab: "sebab meninggal",
  anakPewaris: "anak kandung pewaris",
  jumlahAnakPewaris: "jumlah anak pewaris",
  pewarisPasangan: "suami/istri pewaris",
  saudaraPewaris: "saudara pewaris",
  jumlahSaudaraPewaris: "jumlah saudara pewaris",
  pewarisPengganti: "ahli waris yang meninggal lebih dahulu",
  cucuPewaris: "cucu pengganti",
  saudaraPengganti: "saudara pewaris yang meninggal lebih dahulu",
  keponakanPengganti: "keponakan pengganti",
  hubunganPemohon: "hubungan Pemohon dengan pewaris",
});

/** "A; B; C" atau "A, B, C" -> "A, B dan C" (daftar orang di isian dipisah titik koma). */
function daftarOrang(v) {
  const bagian = String(v == null ? "" : v)
    .split(/\s*;\s*|\s*,\s*(?=[A-Z])/)
    .map((x) => bersihNilai(x))
    .filter(Boolean);
  if (bagian.length <= 1) return bagian.join("");
  return `${bagian.slice(0, -1).join(", ")} dan ${bagian[bagian.length - 1]}`;
}
/** Banyaknya orang pada daftar (titik koma atau "dan"/koma sebelum huruf besar). */
function hitungOrang(v) {
  return String(v == null ? "" : v)
    .split(/\s*;\s*|\s*,\s*(?=[A-Z])|\s+dan\s+(?=[A-Z])/)
    .map((x) => bersihNilai(x))
    .filter(Boolean).length;
}

/** Normalisasi nilai menurut kuncinya (supaya dua sumber dapat dibandingkan dan dituliskan seragam). */
const NORMAL = {
  tglNikah: (v) => waktuNikah(v),
  tempatNikah: (v) => tanpaProvinsi(v),
  kua: (v) => kuaBaku(v),
  umurP1: (v) => (/\d+/.exec(String(v)) || [""])[0],
  umurP2: (v) => (/\d+/.exec(String(v)) || [""])[0],
  statusP1: (v) => bersihNilai(v).toLowerCase(),
  statusP2: (v) => bersihNilai(v).toLowerCase(),
  mahar: (v) => rapat(v),
  waliHubungan: (v) => bersihNilai(v),
  anakPewaris: (v) => daftarOrang(v),
  pewarisPasangan: (v) => daftarOrang(v),
  saudaraPewaris: (v) => daftarOrang(v),
  cucuPewaris: (v) => daftarOrang(v),
  keponakanPengganti: (v) => daftarOrang(v),
};

/** Dua nilai dianggap sama bila setelah normalisasi saling memuat. */
function samaNilai(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}

// ============================================================================
// Fakta berurutan sumber
// ============================================================================

const LABEL_SUMBER = { 1: "isian blangko", 2: "data SIPP", 3: "gugatan" };

/**
 * Menyimpan kandidat nilai per kunci; pembaca (ambil) memilih yang sumbernya paling awal dan menandai ragu bila ada
 * sumber lain yang bertentangan.
 */
function buatFakta() {
  const kandidat = new Map();
  const api = {
    tambah(kunci, nilai, yakin, prio, ket) {
      if (RE_ALETA.test(String(nilai || ""))) return api;
      const n = NORMAL[kunci] ? NORMAL[kunci](nilai) : bersihNilai(nilai);
      if (n === "" || n == null) return api;
      const daftar = kandidat.get(kunci) || [];
      daftar.push({ nilai: String(n), yakin: dariKeyakinan(yakin), prio, ket: ket || "", urut: daftar.length });
      kandidat.set(kunci, daftar);
      return api;
    },
    ada(kunci) {
      return (kandidat.get(kunci) || []).length > 0;
    },
    /** @returns {{nilai: string, yakin: string, sumber: string, ket: string, kunci: string}|null} */
    ambil(kunci) {
      const daftar = (kandidat.get(kunci) || []).slice().sort((a, b) => a.prio - b.prio || a.urut - b.urut);
      if (!daftar.length) return null;
      const atas = daftar[0];
      const setuju = daftar.filter((k) => samaNilai(k.nilai, atas.nilai));
      const lawan = daftar.filter((k) => !samaNilai(k.nilai, atas.nilai));
      let yakin = atas.yakin;
      for (const k of setuju) yakin = maxYakin(yakin, k.yakin);
      const prios = [...new Set(setuju.map((k) => k.prio))].sort();
      const sumber = prios.map((p) => LABEL_SUMBER[p]).join(" + ");
      let ket = atas.ket;
      if (lawan.length) {
        yakin = "ragu";
        const l = lawan[0];
        ket = `${LABEL_SUMBER[atas.prio]} menyebut "${potong(atas.nilai)}", sedangkan ${LABEL_SUMBER[l.prio]} menyebut "${potong(l.nilai)}". Periksa mana yang benar.`;
      } else if (!ket && yakin === "ragu") ket = "Terbaca dari gugatan dengan pola yang longgar; periksa kebenarannya.";
      return { nilai: atas.nilai, yakin, sumber, ket, kunci };
    },
    semua() {
      return [...kandidat.keys()];
    },
    /** Salinan kandidat mentah satu kunci ({nilai, yakin, prio, ket}); dipakai faktaPerkara (U6) untuk menimbang ulang antar sumber. */
    kandidat(kunci) {
      return (kandidat.get(kunci) || []).map((k) => ({ ...k }));
    },
  };
  return api;
}

const potong = (t, n = 60) => {
  const s = rapat(t);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

// ============================================================================
// Membangun fakta dari tiga sumber
// ============================================================================

const bersihAlamat = (a) =>
  rapat(String(a || "").replace(/,?\s*Domisili\s+Elektronik\s*:.*$/i, "").replace(/\s*,\s*,/g, ","))
    .replace(/[\s,;.]+$/, "")
    .trim();

/** Umur (tahun penuh) pada tanggal acuan dari tanggal lahir ISO; "" bila tak terbaca. */
function umurPada(lahir, acuan) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(lahir || ""));
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(acuan || ""));
  if (!a || !b || a[1] === "0000" || b[1] === "0000") return "";
  let u = Number(b[1]) - Number(a[1]);
  if (Number(b[2]) < Number(a[2]) || (Number(b[2]) === Number(a[2]) && Number(b[3]) < Number(a[3]))) u -= 1;
  return u >= 0 && u < 120 ? String(u) : "";
}
const isoDariIndo = (t) => {
  const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(tanggalIndo(t));
  if (!m) return "";
  const b = BULAN.findIndex((x) => x === m[2]) + 1;
  return b ? `${m[3]}-${String(b).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}` : "";
};

/**
 * @param {object} s
 *   isian   {kode: nilai | {nilai, keyakinan|yakin, asal}}   isian blangko perkara itu
 *   sipp    {nikah, itsbat, anak[], pihak1[], pihak2[]}       baris mentah SIPP (boleh kosong)
 *   usulan  [{kode, nilai, keyakinan}]                       hasil mesin deteksi posita di bot
 *   cerai   object faktaDariPosita(...)                       hasil mesin fakta cerai di bot
 *   tambahan [{kunci, nilai, yakin, ket}]                    pola tambahan dari posita (positaTambahan)
 *   sebutan {P, T}                                            sebutan pihak menurut jenis perkara
 */
function bangunFakta(s) {
  const o = s && typeof s === "object" ? s : {};
  const F = buatFakta();

  // 1. isian blangko
  const isian = o.isian && typeof o.isian === "object" ? o.isian : {};
  for (const [kode, v] of Object.entries(isian)) {
    const kunci = KODE_FAKTA[kode] || KODE_FAKTA[String(kode).replace(/^0+/, "")];
    if (!kunci) continue;
    const nilai = v && typeof v === "object" ? v.nilai : v;
    const yakin = v && typeof v === "object" ? v.keyakinan || v.yakin || "pasti" : "pasti";
    if (kunci === "anak") {
      const n = jumlahAnakDariTeks(nilai);
      if (n !== null) F.tambah("jumlahAnak", String(n), yakin, 1);
      continue;
    }
    F.tambah(kunci, nilai, yakin, 1);
    if (kunci === "anakPewaris") F.tambah("jumlahAnakPewaris", String(hitungOrang(nilai)), yakin, 1);
    if (kunci === "saudaraPewaris") F.tambah("jumlahSaudaraPewaris", String(hitungOrang(nilai)), yakin, 1);
  }

  // 2. data SIPP
  const sipp = o.sipp && typeof o.sipp === "object" ? o.sipp : {};
  const it = sipp.itsbat && typeof sipp.itsbat === "object" ? sipp.itsbat : null;
  if (it) {
    const t = tanggalIndo(it.tgl || it.tgl_menikah);
    if (t) F.tambah("tglNikah", t, "yakin", 2);
    const tempat = it.tempat || it.tempat_menikah;
    if (tempat) F.tambah("tempatNikah", tempat, "yakin", 2);
  }
  const nk = sipp.nikah && typeof sipp.nikah === "object" ? sipp.nikah : null;
  if (nk) {
    const t = tanggalIndo(nk.tgl_nikah);
    if (t) F.tambah("tglNikah", t, "yakin", 2);
    if (nk.kua) F.tambah("kua", nk.kua, "yakin", 2);
  }
  const anak = Array.isArray(sipp.anak) ? sipp.anak : [];
  if (anak.length) {
    const bernama = anak.filter((a) => rapat(a.nama_anak || a.nama).length > 1);
    const adaFlagNol = anak.every((a) => String(a.ada_anak) === "0");
    if (bernama.length) {
      F.tambah("jumlahAnak", String(bernama.length), "yakin", 2);
      F.tambah("anakNama", bernama.map((a) => rapat(a.nama_anak || a.nama)).join("; "), "yakin", 2);
    } else if (adaFlagNol) F.tambah("jumlahAnak", "0", "yakin", 2);
    const asuh = bernama.map((a) => String(a.diasuh_oleh)).filter((x) => x === "1" || x === "2");
    if (asuh.length && asuh.every((x) => x === asuh[0])) F.tambah("anakIkutPihak", asuh[0] === "1" ? "P" : "T", "yakin", 2);
  }
  const p1 = Array.isArray(sipp.pihak1) ? sipp.pihak1 : [];
  const p2 = Array.isArray(sipp.pihak2) ? sipp.pihak2 : [];
  if (p1[0] && p1[0].alamat) F.tambah("alamatP", bersihAlamat(p1[0].alamat), "yakin", 2);
  if (p2[0] && p2[0].alamat) F.tambah("alamatT", bersihAlamat(p2[0].alamat), "yakin", 2);
  if (p1[0] && rapat(p1[0].pekerjaan)) F.tambah("pekerjaanP", rapat(p1[0].pekerjaan).toLowerCase(), "yakin", 2);
  if (p2[0] && rapat(p2[0].pekerjaan)) F.tambah("pekerjaanT", rapat(p2[0].pekerjaan).toLowerCase(), "yakin", 2);
  // umur saat menikah dari tanggal lahir di SIPP (hanya bila tanggal nikah diketahui)
  const tglNikahIso = isoDariIndo((F.ambil("tglNikah") || {}).nilai);
  if (tglNikahIso) {
    const pasangan = p1.length >= 2 ? [p1[0], p1[1]] : p1.length === 1 && p2.length ? [p1[0], p2[0]] : [];
    pasangan.forEach((p, i) => {
      const u = p && umurPada(p.lahir, tglNikahIso);
      if (u) F.tambah(i === 0 ? "umurP1" : "umurP2", u, "cukup", 2, "Dihitung dari tanggal lahir di SIPP sampai tanggal menikah.");
    });
  }

  // 3. posita: hasil mesin deteksi bot (usulan kode/nilai), fakta cerai, dan pola tambahan
  for (const u of Array.isArray(o.usulan) ? o.usulan : []) {
    if (!u || !u.kode) continue;
    const kunci = KODE_FAKTA[u.kode] || KODE_FAKTA[String(u.kode).replace(/^0+/, "")];
    const nilai = u.nilai;
    if (!kunci || nilai == null || String(nilai).trim() === "") continue;
    if (kunci === "anak") {
      const n = jumlahAnakDariTeks(nilai);
      if (n !== null) F.tambah("jumlahAnak", String(n), u.keyakinan, 3);
      continue;
    }
    F.tambah(kunci, nilai, u.keyakinan, 3);
    if (kunci === "anakPewaris") F.tambah("jumlahAnakPewaris", String(hitungOrang(nilai)), u.keyakinan, 3);
    if (kunci === "saudaraPewaris") F.tambah("jumlahSaudaraPewaris", String(hitungOrang(nilai)), u.keyakinan, 3);
  }
  const c = o.cerai && typeof o.cerai === "object" ? o.cerai : null;
  if (c) {
    const pasang = (kunci, nilai, yakin, ket) => {
      if (nilai) F.tambah(kunci, nilai, yakin || "cukup", 3, ket);
    };
    pasang("awalKonflik", c.awalKonflik);
    pasang("puncak", c.puncak);
    pasang("penyebab", c.penyebab);
    pasang("pisahSejak", c.pisahSejak);
    pasang("lamaPisah", c.lamaPisah, c.lamaPisahDihitung ? "cukup" : "cukup", c.lamaPisahDihitung ? "Dihitung dari tanggal pisah rumah di gugatan sampai tanggal sidang." : "");
    pasang("siapaPergi", c.siapaPergi);
    pasang("tglNikah", c.tanggalNikah);
    pasang("tempatNikah", c.tempatNikah);
    pasang("kediaman", c.kediaman);
    if (c.jumlahAnak) {
      const n = jumlahAnakDariTeks(c.jumlahAnak.match(/belum|tidak/i) ? c.jumlahAnak : `${c.jumlahAnak}${/anak/i.test(c.jumlahAnak) ? "" : " anak"}`);
      if (n !== null) F.tambah("jumlahAnak", String(n), "cukup", 3);
    }
    if (c.anakIkut) F.tambah("anakIkutPihak", norm(c.anakIkut) === norm((o.sebutan || {}).P) ? "P" : "T", "cukup", 3);
    if (c.tempatKini && c.tempatKini.lawan && c.tempatKini.asalLawan === "posita") F.tambah("alamatP", c.tempatKini.lawan, "cukup", 3);
    if (c.tempatKini && c.tempatKini.pelaku && c.tempatKini.asalPelaku === "posita") F.tambah("alamatT", c.tempatKini.pelaku, "cukup", 3);
  }
  for (const t of Array.isArray(o.tambahan) ? o.tambahan : []) {
    if (t && t.kunci && t.nilai) F.tambah(t.kunci, t.nilai, t.yakin || "ragu", 3, t.ket);
  }
  hubunganPemohonWaris(F, p1);
  return F;
}

/**
 * Penetapan ahli waris: hubungan Pemohon dengan Pewaris diturunkan dari susunan ahli waris yang SUDAH terisi (anak, saudara, pasangan,
 * ayah, ibu) bila SEMUA Pemohon menempati satu golongan yang sama. Golongan campur dibiarkan (petugas yang menulis).
 */
function hubunganPemohonWaris(F, pihak1) {
  const pemohon = (Array.isArray(pihak1) ? pihak1 : []).map((p) => rapat(p && p.nama)).filter(Boolean);
  if (!pemohon.length) return;
  const golongan = [
    ["anakPewaris", "anak kandung"],
    ["saudaraPewaris", "saudara kandung"],
    ["pewarisPasangan", null],
    ["ayahHidup", "ayah kandung"],
    ["ibuHidup", "ibu kandung"],
  ];
  const sama = (a, b) => {
    const x = norm(a).replace(/ /g, "");
    const y = norm(b).replace(/ /g, "");
    if (!x || !y) return false;
    if (x === y) return true;
    const inti = (t) => norm(String(t).split(/\s+(?:bin|binti)\s+/i)[0]).replace(/ /g, "");
    return inti(a) === inti(b) && inti(a).length >= 4;
  };
  const daftarDi = (kunci) => {
    const f = F.ambil(kunci);
    return f ? String(f.nilai).split(/\s*,\s*|\s+dan\s+/).map((x) => x.trim()).filter(Boolean) : [];
  };
  const hasil = new Set();
  let yakin = "cukup";
  for (const nama of pemohon) {
    let ketemu = "";
    for (const [kunci, label] of golongan) {
      if (!daftarDi(kunci).some((x) => sama(x, nama))) continue;
      const pw = F.ambil("pewarisNama");
      ketemu = label || (pw && /\sbinti\s/i.test(` ${pw.nilai} `) ? "suami" : pw ? "istri" : "");
      const f = F.ambil(kunci);
      if (f && f.yakin === "ragu") yakin = "ragu";
      break;
    }
    if (!ketemu) return;
    hasil.add(ketemu);
  }
  if (hasil.size === 1) F.tambah("hubunganPemohon", [...hasil][0], yakin, 2, "Diturunkan dari susunan ahli waris yang terisi dan nama Pemohon di SIPP.");
}

module.exports = {
  // dasar
  bangunFakta,
  buatFakta,
  KODE_FAKTA,
  LABEL_FAKTA,
  // pembersih
  bersihNilai,
  tanggalIndo,
  waktuNikah,
  tanpaProvinsi,
  kuaBaku,
  uraiMahar,
  terbilang,
  rupiah,
  keAngka,
  jumlahAnakDariTeks,
  daftarOrang,
  hitungOrang,
  umurPada,
  adaTitik,
  hitungTitik,
  kecilAwal,
  besarAwal,
  dariKeyakinan,
  minYakin,
  maxYakin,
  norm,
  rapat,
  T,
  RE_TITIK,
  RE_SEBUTAN,
  bersihAlamat,
  potong,
};
