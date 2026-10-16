"use strict";

/**
 * ============================================================================
 * MESIN VARIABEL ABT - SATU CARA MENGISI #NNNN# UNTUK SEMUA NASKAH ALETA
 * ============================================================================
 *
 * Naskah yang dibuat ALETA dari Blangko Derry (BAS massal "Unduh", Blangko
 * ALETA) dulu hanya mengisi penanda yang ALETA kenal sendiri - sisanya
 * tercetak mentah di Word: "#5404# #8562#", "#4047# tidak menghadap",
 * "agama #1199#". Diukur 14 Okt 2026 atas 222 RTF Blangko Derry: 538 penanda
 * unik, 318 di antaranya data_sql, 127 data_teks, 25 data_sipp, 23
 * tanya_jawab - dan semuanya punya cara pengisian yang tertulis di katalog ABT
 * (aps_badilag.abt_variabel).
 *
 * Mesin ini MENIRU ABT, bukan menebak: port setia Abt_model.php
 * (data_variabel_detil, get_data_variabel, variabel_var_data,
 * variabel_library, kolom_kode_A4/A4s, list_keterangan), abt_helper.php
 * (variabel) dan TemplateHelper.php server (cleanHtmlTagSpecial, getHari,
 * convertToHijriah, Terbilang), tanggal_helper.php server (tgl_indo2).
 *
 * KATALOG DIBACA SAAT BERJALAN. Rumus variabel tidak disalin ke sini - agen
 * dan petugas yang membetulkan variabel di ABT langsung terlihat di naskah
 * ALETA (umur ingatan katalog 30 detik).
 *
 * ============================================================================
 * HANYA MEMBACA, DENGAN BATAS WAKTU
 * ============================================================================
 *
 * Kueri katalog ditulis orang lain. Tiap kueri yang sudah tersusun diperiksa
 * pagarBaca(): satu SELECT, tanpa kata yang menulis/mengunci/menunda, lalu
 * dijalankan lewat sambungan tanpa multipleStatements dengan batas waktu per
 * kueri. ABT memanggil `call perkara_jadwal_sidang_reorder` (MENULIS urutan
 * sidang); di sini urutannya DIHITUNG (peringkat tanggal_sidang, id) - hasil
 * yang sama tanpa satu baris pun berubah.
 *
 * ============================================================================
 * TIDAK ADA PENANDA MENTAH
 * ============================================================================
 *
 * Yang ABT cetak "..." (DATA_TIDAK_ADA / TIDAK_BISA_LOAD - isian tangan yang
 * belum diisi, saksi yang belum ada) dicetak "..." juga, DISOROT kuning, dan
 * disebut satu per satu di `kosong` supaya petugas tahu sebelum membuka Word.
 * Penanda yang terpecah kode RTF ("#}{\rtlch ... 8010}{...#") disatukan dulu
 * - ABT sendiri tidak mampu mengisinya (4 blangko Derry).
 */

const POLA_PENANDA = /#(\d{3,5})#/g;
const UMUR_KATALOG_MS = 30 * 1000;
const BATAS_KUERI_MS = 10 * 1000;
const PARALEL = 6;
const KEDALAMAN_MAKS = 12;
const PANJANG_NILAI_MAKS = 60000;
const BATAS_TUNGGU_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Pagar kueri
// ---------------------------------------------------------------------------

function tanpaTeksBerkutip(sql) {
  return String(sql).replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"/g, "''");
}

function tanpaKomentar(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)(--\s|#)[^\n]*/g, " ");
}

/**
 * REPLACE() fungsi teks tetap boleh (dipakai 60+ kueri katalog); REPLACE INTO
 * tidak. "CHARACTER SET utf8" juga boleh - kata SET tidak dilarang sendiri.
 */
const KATA_TERLARANG =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|replace\s+into|replace\s+delayed|replace\s+low_priority|rename|call|handler|lock\s+tables|unlock|load_file|load\s+data|into\s+outfile|into\s+dumpfile|sleep|benchmark|get_lock|release_lock|exec|execute|prepare|deallocate|for\s+update|lock\s+in\s+share\s+mode)\b/i;

/** @returns {string} sebab penolakan, atau "" bila lolos. */
function pagarBaca(sql) {
  const teks = String(sql || "").trim();
  if (!teks) return "kueri kosong";
  const kerangka = tanpaKomentar(tanpaTeksBerkutip(teks)).trim().replace(/;\s*$/, "");
  if (!/^\(*\s*select\b/i.test(kerangka)) return "bukan satu SELECT";
  if (kerangka.includes(";")) return "lebih dari satu pernyataan";
  const t = kerangka.match(KATA_TERLARANG);
  if (t) return `memuat kata terlarang "${t[0]}"`;
  return "";
}

/** Nilai yang disisipkan ke kueri: kutip dan garis miring dilolos (ABT tidak - kuerinya patah). */
function lolosSql(nilai) {
  return String(nilai ?? "").replace(/[\\'"]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Fungsi PHP yang dipakai ABT
// ---------------------------------------------------------------------------

function phpBenar(x) {
  return !(x === null || x === undefined || x === "" || x === "0" || x === 0 || x === false);
}

function phpNumerik(x) {
  return typeof x === "number" || (typeof x === "string" && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(x));
}

/** DateTime::createFromFormat('Y-m-d', $x) !== FALSE - seluruh teks harus cocok. */
function tanggalYmd(x) {
  return typeof x === "string" && /^\d{1,4}-\d{1,2}-\d{1,2}$/.test(x);
}

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** tanggal_helper.php (server) tgl_indo2: "04 Oktober 2026" - nol di depan hari dipertahankan. */
function tglIndo2(tgl) {
  if (tgl === null || tgl === undefined || tgl === "0000-00-00") return "";
  const p = String(tgl).split("-");
  const n = Number(p[1]);
  const bulan = Number.isInteger(n) && n >= 1 && n <= 12 && /^\s*\d+\s*$/.test(String(p[1] ?? "")) ? BULAN[n] : "";
  return `${p[2] ?? ""} ${bulan} ${p[0] ?? ""}`;
}

/** strtotime() untuk bentuk yang dipakai ABT ("Y-m-d", "Y/m/d", berjam atau tidak). */
function strtotimeHari(tgl) {
  const m = /^\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?\s*$/.exec(String(tgl));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

/** TemplateHelper::getHari - teks yang tak terbaca strtotime jatuh ke 1 Jan 1970 (Kamis), sama seperti ABT. */
function getHari(tgl) {
  if (!phpBenar(tgl)) return "";
  const w = strtotimeHari(tgl);
  return HARI[w === null ? 4 : w];
}

function makeInt(a) {
  const x = Number(a) || 0;
  return x < -0.0000001 ? Math.ceil(x - 0.0000001) : Math.floor(x + 0.0000001);
}

/** TemplateHelper::convertToHijriah, apa adanya (termasuk spasi di ujung). */
function hijriah(tanggal) {
  if (!phpBenar(tanggal)) return null;
  const s = String(tanggal);
  const NAMA = ["Muharram", "Safar", "Rabiul Awwal", "Rabiul Akhir", "Jumadil Awwal", "Jumadil Akhir", "Rajab", "Sya'ban", "Ramadhan", "Syawwal", "Zulqaidah", "Zulhijjah"];
  const date = makeInt(s.substr(8, 2));
  const month = makeInt(s.substr(5, 2));
  const year = makeInt(s.substr(0, 4));
  let jd;
  if (year > 1582 || (year === 1582 && month > 10) || (year === 1582 && month === 10 && date > 14)) {
    jd =
      makeInt((1461 * (year + 4800 + makeInt((month - 14) / 12))) / 4) +
      makeInt((367 * (month - 2 - 12 * makeInt((month - 14) / 12))) / 12) -
      makeInt((3 * makeInt((year + 4900 + makeInt((month - 14) / 12)) / 100)) / 4) +
      date -
      32075;
  } else {
    jd = 367 * year - makeInt((7 * (year + 5001 + makeInt((month - 9) / 7))) / 4) + makeInt((275 * month) / 9) + date + 1729777;
  }
  let l = jd - 1948440 + 10632;
  const n = makeInt((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const z = makeInt((10985 - l) / 5316) * makeInt((50 * l) / 17719) + makeInt(l / 5670) * makeInt((43 * l) / 15238);
  l = l - makeInt((30 - z) / 15) * makeInt((17719 * z) / 50) - makeInt(z / 16) * makeInt((15238 * z) / 43) + 29;
  const m = makeInt((24 * l) / 709);
  const d = l - makeInt((709 * m) / 24);
  const y = 30 * n + z - 30;
  let g = (m % 12) - 1;
  if (g === -1) g = 11;
  return `${d} ${NAMA[g]} ${y} `;
}

/** TemplateHelper::Terbilang - spasi di depan dipertahankan seperti ABT. */
function terbilangAbt(x) {
  let v = x === "" || x === null || x === undefined ? 0 : Number(x);
  if (!Number.isFinite(v)) v = 0;
  if (v === 0) return "";
  const ab = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const mod = (a, b) => Math.trunc(a) % Math.trunc(b);
  if (v < 12) return ` ${ab[Math.trunc(v)] ?? ""}`;
  if (v < 20) return `${terbilangAbt(v - 10)} belas`;
  if (v < 100) return `${terbilangAbt(v / 10)} puluh${terbilangAbt(mod(v, 10))}`;
  if (v < 200) return ` seratus${terbilangAbt(v - 100)}`;
  if (v < 1000) return `${terbilangAbt(v / 100)} ratus${terbilangAbt(mod(v, 100))}`;
  if (v < 2000) return ` seribu${terbilangAbt(v - 1000)}`;
  if (v < 1000000) return `${terbilangAbt(v / 1000)} ribu${terbilangAbt(mod(v, 1000))}`;
  if (v < 1000000000) return `${terbilangAbt(v / 1000000)} juta${terbilangAbt(mod(v, 1000000))}`;
  return "";
}

/** number_format($x, 0, ',', '.') - pembulatan menjauhi nol seperti round() PHP. */
function formatAngka(x) {
  const v = Number(x);
  if (!Number.isFinite(v)) return String(x);
  const bulat = Math.sign(v) * Math.round(Math.abs(v));
  const s = String(Math.abs(bulat)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return bulat < 0 ? `-${s}` : s;
}

function ucwordsLower(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/(^|[ \t\r\n\f\v])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

function nl2br(s) {
  return String(s ?? "").replace(/(\r\n|\n\r|\n|\r)/g, "<br />$1");
}

function lcfirst(s) {
  const t = String(s ?? "");
  return t ? t[0].toLowerCase() + t.slice(1) : t;
}

function lolosRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** str_ireplace dengan larik - berurutan, peka-huruf dimatikan. */
function strIreplace(cari, ganti, teks) {
  let hasil = String(teks ?? "");
  cari.forEach((c, i) => {
    hasil = hasil.replace(new RegExp(lolosRegex(c), "gi"), () => ganti[i]);
  });
  return hasil;
}

// ---------------------------------------------------------------------------
// cleanHtmlTagSpecial (TemplateHelper.php SERVER - dengan <i>/<em>)
// ---------------------------------------------------------------------------
//
// Kode RTF yang disisipkan cleanHtml diwakili aksara Private Use dulu, supaya
// isi data (garis miring balik, kurung kurawal, huruf beraksen) dapat diloloskan
// tanpa merusak kode yang memang disisipkan ABT. Kode dipulihkan TANPA spasi
// pembatas; spasi aslinya tetap aksara biasa - hasilnya sama dengan ABT, kecuali
// "\par" yang langsung ditempeli huruf (ABT menelan katanya: "\parBahwa") -
// di sini diberi pembatas.

const KODE = {
  par: "\uE000",
  tab: "\uE001",
  b: "\uE002",
  b0: "\uE003",
  i: "\uE004",
  i0: "\uE005",
};
const KODE_BALIK = new Map(Object.entries(KODE).map(([k, v]) => [v, `\\${k}`]));
const POLA_KODE = /[\uE000-\uE005]/;

const ENTITAS = {
  nbsp: "\u00A0", amp: "&", lt: "<", gt: ">", quot: '"', copy: "\u00A9", reg: "\u00AE", deg: "\u00B0",
  plusmn: "\u00B1", middot: "\u00B7", laquo: "\u00AB", raquo: "\u00BB", ndash: "\u2013", mdash: "\u2014",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", hellip: "\u2026", bull: "\u2022",
  eacute: "\u00E9", egrave: "\u00E8", aacute: "\u00E1", agrave: "\u00E0", iacute: "\u00ED", oacute: "\u00F3",
  uacute: "\u00FA", ccedil: "\u00E7", ouml: "\u00F6", uuml: "\u00FC", auml: "\u00E4", szlig: "\u00DF",
  sup2: "\u00B2", sup3: "\u00B3", frac12: "\u00BD", frac14: "\u00BC", times: "\u00D7", divide: "\u00F7",
  para: "\u00B6", sect: "\u00A7", euro: "\u20AC", trade: "\u2122", iexcl: "\u00A1", iquest: "\u00BF",
};

function htmlEntityDecode(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (utuh, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : utuh;
    }
    return Object.prototype.hasOwnProperty.call(ENTITAS, e) ? ENTITAS[e] : utuh;
  });
}

/** strip_tags PHP: "<" yang diikuti spasi bukan tanda; tanda tak tertutup menelan sisa teks. */
function stripTagsPhp(s) {
  return String(s).replace(/<(?![\s])[^>]*(>|$)/g, "");
}

function bersihkanHtmlAbt(teks) {
  let t = String(teks ?? "");
  t = t.split("\u2019").join("'");
  t = t.split("DATA_TIDAK_ADA").join("...");
  t = t.split("TIDAK_BISA_LOAD").join("...");
  t = t.split("</p>").join(KODE.par);
  t = t.split(" <p").join("<p");
  t = t.split("-   ").join(`-${KODE.tab} `);
  t = t.split("-  ").join(`-${KODE.tab} `);
  t = t.split(".   ").join(`.${KODE.tab} `);
  t = t.split(".  ").join(`.${KODE.tab} `);
  t = t.split("    ").join(`${KODE.tab} `);
  t = t.split("   ").join(`${KODE.tab} `);
  t = t.replace(/<br(\s*)?\/?>/gi, `${KODE.par} `);
  t = htmlEntityDecode(t);
  t = t.split("  ").join(" ");
  t = t.split("<ol>").join("<ol type='1'> ");
  t = t.split("</li>").join(`</li> ${KODE.par} `);
  t = t.split("<li>").join(`<li> ${KODE.tab} `);
  t = t.split("<li >").join(`<li> ${KODE.tab} `);
  t = t.split("</ol>").join("</ol> ");
  t = t.split("<strong>").join(`${KODE.b} `);
  t = t.split("</strong>").join(`${KODE.b0} `);
  t = t.split("<i>").join(`${KODE.i} `);
  t = t.split("</i>").join(`${KODE.i0} `);
  t = t.split("<em>").join(`${KODE.i} `);
  t = t.split("</em>").join(`${KODE.i0} `);
  t = stripTagsPhp(t);
  t = t.split("&#160;").join(" ");
  t = t.split(";").join("; ");
  t = t.split("&nsbp").join(" ");
  t = t.split("&nbsp; ").join("");
  t = t.split("</p>").join("");
  t = t.split("\u201D").join(" ");
  t = t.split("\u201C").join(" ");
  return t.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, "");
}

/**
 * Teks bersih (beraksara kode) -> RTF. Data diloloskan; kode dipulihkan.
 * `rtfMentah` = Map aksara-wakil -> potongan RTF utuh (tabel tanya-jawab).
 */
function keRtf(teks, rtfMentah) {
  let hasil = "";
  const s = String(teks ?? "");
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    const kode = c.charCodeAt(0);
    if (KODE_BALIK.has(c)) {
      hasil += KODE_BALIK.get(c);
      // Pembatas kata kendali: spasi asli dipakai bila ada; bila ditempeli huruf/angka - atau
      // kode itu aksara terakhir nilai, sehingga yang menempel adalah naskah blangko - diberi satu.
      const berikut = s[i + 1];
      if (berikut === undefined || /[A-Za-z0-9-]/.test(berikut)) hasil += " ";
      continue;
    }
    if (rtfMentah && rtfMentah.has(c)) {
      hasil += rtfMentah.get(c);
      continue;
    }
    if (c === "\\" || c === "{" || c === "}") hasil += `\\${c}`;
    else if (c === "\t") hasil += "\\tab ";
    else if (kode < 128) hasil += c;
    else hasil += `\\u${kode > 32767 ? kode - 65536 : kode}?`;
  }
  return hasil;
}

/** Teks bersih -> teks polos (untuk naskah DOCX/PDF Blangko ALETA). */
function kePolos(teks, polosMentah) {
  let hasil = "";
  for (const c of String(teks ?? "")) {
    if (c === KODE.par) hasil += "\n";
    else if (c === KODE.tab) hasil += "\t";
    else if (KODE_BALIK.has(c)) hasil += "";
    else if (polosMentah && polosMentah.has(c)) hasil += polosMentah.get(c);
    else hasil += c;
  }
  return hasil.replace(/[ \t]+\n/g, "\n");
}

/** Nilai yang diberikan ALETA sendiri (bukan dari ABT) - aturan lama isiBlangko. */
function amankanUntukRtf(nilai) {
  let hasil = "";
  for (const huruf of String(nilai ?? "")) {
    const kode = huruf.codePointAt(0);
    if (huruf === "\\" || huruf === "{" || huruf === "}") hasil += `\\${huruf}`;
    else if (huruf === "\n") hasil += "\\par ";
    else if (huruf === "\r") continue;
    else if (kode < 128) hasil += huruf;
    else if (kode > 0xffff) {
      const s = String.fromCodePoint(kode);
      for (const u of [s.charCodeAt(0), s.charCodeAt(1)]) hasil += `\\u${u > 32767 ? u - 65536 : u}?`;
    } else hasil += `\\u${kode > 32767 ? kode - 65536 : kode}?`;
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Tanya-jawab: bentuk tabel ABT (kolom_kode_A4 / A4s) dan daftar "Bahwa"
// ---------------------------------------------------------------------------

function kodeBarisA4(lebar1, lebar2, irow, lastrow) {
  return (
    `\\trowd\\irow${irow}\\irowband${irow}${lastrow ? "\\lastrow" : ""}\\trgaph0\\trleft0\\trftsWidth1\n` +
    "\\trftsWidthB3\\trftsWidthA3\\trpaddfl3\\trpaddft3\\trpaddfr3\\trpaddfb3\n" +
    `\\clvertalt\\clftsWidth3\\clwWidth${lebar1}\\cellx${lebar1}\n` +
    `\\clvertalt\\clftsWidth3\\clwWidth${lebar1}\\cellx${lebar2}\\row\n\n`
  );
}

/**
 * Tabel tanya-jawab persis Abt_model::kolom_kode_A4 / kolom_kode_A4s:
 * pertanyaan di sel KIRI, baris di bawahnya jawaban di sel KANAN.
 * Hasil: teks dengan aksara-wakil untuk potongan RTF, + peta wakil->RTF.
 */
function tabelTanyaJawab(baris, kertas, wakil) {
  if (!Array.isArray(baris) || baris.length === 0) return null;
  const a4s = kertas === "A4s";
  const [l1, l2] = a4s ? [4400, 8800] : [4250, 8500];
  let teks = "";
  // Spasi di antara isi dan "\cell" adalah spasi asli kode ABT ("$data->pertanyaan \\cell").
  for (const b of baris) {
    teks += wakil("\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1 ") + `${String(b.pertanyaan ?? "")} ` + wakil("\\cell\\cell\n" + kodeBarisA4(l1, l2, 0, false));
    if (a4s) teks += wakil("\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1\\cell ") + `${String(b.jawaban ?? "")} `;
    else teks += wakil("\\pard\\intbl\\widctlpar\\qr\\ri100\\sl360\\slmult1 - \\cell\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1 ") + `${String(b.jawaban ?? "")} `;
    teks += wakil("\\cell\n" + kodeBarisA4(l1, l2, 1, true));
  }
  return teks + wakil("\\pard ");
}

/** Abt_model::list_keterangan + replace_ket_saksi. */
function daftarKeterangan(baris) {
  let data = "";
  for (const b of Array.isArray(baris) ? baris : []) {
    if (!phpBenar(b.jawaban)) continue;
    const j = strIreplace(["saya", "ya, ", "penggugat", "pemohon", "tergugat", "termohon"], ["saksi", "", "Penggugat", "Pemohon", "Tergugat", "Termohon"], lcfirst(b.jawaban));
    data += `-   Bahwa ${j}<br>\n`;
  }
  return data || null;
}

// ---------------------------------------------------------------------------
// Penanda yang terpecah kode RTF
// ---------------------------------------------------------------------------

const KODE_RTF_SELA = String.raw`(?:\\(?!par\b|cell\b|row\b|line\b|sect\b|page\b|tab\b)[a-zA-Z]+-?\d* ?|[{}]|\r|\n)`;
const POLA_TERPECAH = new RegExp(`#((?:${KODE_RTF_SELA})*)(\\d{1,5})((?:${KODE_RTF_SELA})*)(\\d{0,5})((?:${KODE_RTF_SELA})*)#`, "g");

/**
 * "#}{\rtlch\fcs1 ... 8010}{\b1 ... #" -> "#8010#}{\rtlch\fcs1 ...}{\b1 ...".
 * Kurung dan kode dipertahankan berurutan sesudah penanda, jadi susunan grup
 * tetap seimbang. Hanya yang benar-benar diselingi kode yang disentuh.
 */
function satukanPenandaTerpecah(rtf) {
  let jumlah = 0;
  const hasil = String(rtf).replace(POLA_TERPECAH, (utuh, k1, d1, k2, d2, k3) => {
    if (!k1 && !k2 && !k3) return utuh;
    const angka = `${d1}${d2}`;
    if (angka.length < 3 || angka.length > 5) return utuh;
    jumlah += 1;
    return `#${angka}#${k1}${k2}${k3}`;
  });
  return { rtf: hasil, jumlah };
}

/** Warna sorot "isian kosong": ditambahkan ke \colortbl; null bila tabel warna tidak ada. */
function siapkanSorot(rtf) {
  const awal = rtf.indexOf("{\\colortbl");
  if (awal < 0) return { rtf, indeks: null };
  let dalam = 0;
  let akhir = -1;
  for (let i = awal; i < rtf.length; i += 1) {
    const c = rtf[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") dalam += 1;
    else if (c === "}") {
      dalam -= 1;
      if (dalam === 0) {
        akhir = i;
        break;
      }
    }
  }
  if (akhir < 0) return { rtf, indeks: null };
  const isi = rtf.slice(awal + "{\\colortbl".length, akhir);
  const indeks = (isi.match(/;/g) || []).length;
  return { rtf: `${rtf.slice(0, akhir)}\\red255\\green255\\blue0;${rtf.slice(akhir)}`, indeks };
}

/**
 * Dari mana satu variabel katalog diisi - untuk penjaga dan laporan cakupan.
 * null = tidak ada jalur (ABT pun mencetak "..."): tidak berkatalog, tanpa
 * jenis, data_sql tanpa kueri, turunan yang jenisnya tidak dikenal.
 */
function jalurPengisian(def) {
  if (!def) return null;
  const t = def.data_type;
  if (t === "tanya_jawab") return phpBenar(def.referensi) ? "tanya-jawab ABT" : null;
  if (t === "multi_sidang") return phpBenar(def.multi_sidang) ? "jadwal sidang SIPP" : null;
  if (phpBenar(def.referensi)) return ["tanggal_hari", "tanggal_hijriah", "terbilang"].includes(t) ? `turunan #${def.referensi}#` : null;
  if (!phpBenar(def.nama)) return null;
  if (t === "data_sql") return phpBenar(def.sql_query) ? "kueri SIPP" : null;
  if (t === "data_sipp") return phpBenar(def.data_tabel) && phpBenar(def.data_kolom) ? "kolom SIPP" : null;
  if (t === "data_teks" || t === "data_tanggal") return `isian ABT (abt_${t})`;
  return null;
}

// ---------------------------------------------------------------------------
// Mesin
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {(sql: string, params?: any[], opsi?: {timeoutMs?: number}) => Promise<object[]>} p.kueri
 *   menjalankan SATU SELECT; nilai kolom dipulangkan sebagai TEKS (seperti mysqli PHP).
 * @param {string} [p.skemaAbt]
 */
function buatMesin(p) {
  const kueriMentah = p.kueri;
  const skema = String(p.skemaAbt || process.env.ALETA_ABT_SKEMA || "aps_badilag").trim();
  if (!/^[A-Za-z0-9_]+$/.test(skema)) throw new Error("nama skema ABT tidak sah");
  const batasMs = Number(p.batasKueriMs) || BATAS_KUERI_MS;
  const umurMs = p.umurKatalogMs === undefined ? UMUR_KATALOG_MS : Number(p.umurKatalogMs);
  /** {noVar: {sql_query?, default_data?}} - definisi pengganti untuk uji, tidak pernah ditulis. */
  const timpaKatalog = p.timpaKatalog && typeof p.timpaKatalog === "object" ? p.timpaKatalog : {};

  let katalogJanji = null;
  let katalogSaat = 0;
  let kertasJanji = null;

  async function kueri(sql, params = []) {
    const sebab = pagarBaca(sql);
    if (sebab) {
      const g = new Error(`kueri ditolak: ${sebab}`);
      g.ditolak = true;
      throw g;
    }
    const baris = await kueriMentah(String(sql).trim().replace(/;\s*$/, ""), params, { timeoutMs: batasMs });
    return Array.isArray(baris) ? baris : [];
  }

  function katalog() {
    if (katalogJanji && Date.now() - katalogSaat < umurMs) return katalogJanji;
    katalogSaat = Date.now();
    katalogJanji = kueri(
      `SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang FROM ${skema}.abt_variabel`
    )
      .then((rows) => {
        const peta = new Map(rows.map((b) => [String(b.no_var ?? "").trim(), b]));
        // Uji suntingan (Pengaturan SIPP & ABT, 16 Okt 2026): definisi yang
        // BELUM disimpan dihitung seolah sudah ada di katalog - tanpa menulis.
        for (const [no, ganti] of Object.entries(timpaKatalog)) {
          if (peta.has(no)) peta.set(no, { ...peta.get(no), ...ganti });
        }
        return peta;
      })
      .catch((g) => {
        katalogJanji = null;
        throw g;
      });
    return katalogJanji;
  }

  function jenisKertas() {
    if (kertasJanji) return kertasJanji;
    kertasJanji = kueri(`SELECT value FROM ${skema}.abt_config WHERE name = 'jenis_kertas' LIMIT 1`)
      .then((r) => String((r[0] && r[0].value) || ""))
      .catch(() => {
        kertasJanji = null;
        return "A4";
      });
    return kertasJanji;
  }

  /** Konteks satu naskah: perkara, sidang, ingatan, isian ALETA. */
  function konteks(opsi) {
    const perkaraId = String(opsi.perkaraId ?? "").trim();
    if (!/^\d+$/.test(perkaraId)) throw new Error("perkara_id harus bilangan");
    const sidangKe = Number(opsi.sidangKe) > 0 ? Number(opsi.sidangKe) : 0;
    return {
      perkaraId,
      sidangKe,
      memo: new Map(),
      sidangJanji: null,
      tanyaJawabSaksi: opsi.tanyaJawabSaksi && typeof opsi.tanyaJawabSaksi === "object" ? opsi.tanyaJawabSaksi : {},
      jumlahKueri: 0,
    };
  }

  /** data_sidang() ABT, tanpa CALL reorder: urutan = peringkat (tanggal_sidang, id). */
  function semuaSidang(ctx) {
    if (ctx.sidangJanji) return ctx.sidangJanji;
    ctx.jumlahKueri += 1;
    ctx.sidangJanji = kueri(
      `SELECT id, perkara_id, tanggal_sidang, ruangan, jam_sidang, sampai_jam, agenda, alasan_ditunda, dihadiri_oleh
         FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY tanggal_sidang, id`,
      [ctx.perkaraId]
    ).then((rows) =>
      rows.map((r, i) => {
        const prev = rows[i - 1] || {};
        const next = rows[i + 1] || {};
        return {
          ...r,
          urutan: String(i + 1),
          hari_sidang: r.tanggal_sidang,
          alasan_sblmnya: prev.alasan_ditunda ?? null,
          hari_sblmnya: prev.tanggal_sidang ?? null,
          tanggal_sblmnya: prev.tanggal_sidang ?? null,
          agenda_sblmnya: prev.agenda ?? null,
          hari_ditunda: next.tanggal_sidang ?? null,
          tanggal_ditunda: next.tanggal_sidang ?? null,
          agenda_ditunda: next.agenda ?? null,
        };
      })
    );
    return ctx.sidangJanji;
  }

  async function sidangTerpilih(ctx) {
    const rows = await semuaSidang(ctx);
    const pilih = ctx.sidangKe ? rows.filter((r) => Number(r.urutan) === ctx.sidangKe) : rows;
    return pilih[0] || null;
  }

  const KOSONG = (sebab, valueType = "-") => ({ value: "DATA_TIDAK_ADA", varData: null, valueType, status: "kosong", sebab });

  /** abt_helper variabel(): nilai tampil satu penanda, "..." bila tidak ada. */
  async function variabelTampil(ctx, noVar, tumpuk) {
    const d = await detil(ctx, noVar, tumpuk);
    return String(d.value ?? "").split("DATA_TIDAK_ADA").join("...").split("TIDAK_BISA_LOAD").join("...");
  }

  /** Abt_model::variabel_var_data - penanda di dalam KUERI diganti var_data (tanggal: nilai tampil). */
  async function gantiVarData(ctx, teks, tumpuk) {
    const nomor = [...new Set([...String(teks).matchAll(/#([0-9]+)#/g)].map((m) => m[1]))];
    let hasil = String(teks);
    for (const n of nomor) {
      const d = await detil(ctx, n, tumpuk);
      if (d.status === "galat") {
        const g = new Error(`bergantung pada #${n}# yang gagal diisi (${d.sebab})`);
        g.turunan = true;
        throw g;
      }
      const isi = d.valueType === "tanggal" ? d.value : d.varData;
      hasil = hasil.split(`#${n}#`).join(lolosSql(isi === null || isi === undefined ? "" : isi));
    }
    return hasil;
  }

  /** Abt_model::get_data_variabel - pulang baris {data} atau null. */
  async function ambilData(ctx, def, noVar, tumpuk) {
    const jenis = def.data_type;
    let rows = [];
    if (jenis === "data_sql") {
      if (!phpBenar(def.sql_query)) return null;
      const sql = (await gantiVarData(ctx, def.sql_query, tumpuk)).split("#perkara_id#").join(ctx.perkaraId);
      ctx.jumlahKueri += 1;
      rows = await kueri(sql);
    } else if (jenis === "data_sipp") {
      const tabel = String(def.data_tabel ?? "").trim();
      if (!/^[A-Za-z0-9_.]+$/.test(tabel)) throw new Error("nama tabel data_sipp tidak sah");
      const urutan = phpBenar(def.urutan_data) && /^\d+$/.test(String(def.urutan_data)) ? ` and urutan=${def.urutan_data}` : "";
      ctx.jumlahKueri += 1;
      rows = await kueri(`select ${def.data_kolom} as data from ${tabel} where perkara_id=${ctx.perkaraId}${urutan} limit 1`);
    } else if (phpBenar(jenis)) {
      if (!/^[a-z_]+$/.test(String(jenis))) throw new Error(`jenis "${jenis}" tidak sah`);
      ctx.jumlahKueri += 1;
      rows = await kueri(`SELECT data FROM ${skema}.abt_${jenis} WHERE perkara_id = ? AND no_var = ? LIMIT 1`, [ctx.perkaraId, noVar]);
    } else {
      return null;
    }
    const baris = rows[0];
    if (!baris || typeof baris !== "object") return null;
    // ABT memeriksa KOLOM PERTAMA saja: harus bernama "data".
    const kunci = Object.keys(baris);
    if (kunci[0] !== "data") return null;
    return baris;
  }

  /** Abt_model::GetIdPerkaraPihak + GetKeteranganPihak. */
  async function keteranganPihak(ctx, namaPihak, namaVar, sidangId) {
    const n = String(namaVar ?? "").toLowerCase();
    const cat = n.includes("replik") ? "11" : n.includes("duplik") ? "22" : "";
    const pid = ctx.perkaraId;
    ctx.jumlahKueri += 1;
    const ids = await kueri(
      `select * from (select
        (case when b.id is not null then concat(?, b.id) when c.id is not null then concat(?, c.id)
              when d.id is not null then concat(?, d.id) else a.id end) id,
        (case when b.id is not null then 'pihak_id' when c.id is not null then 'pihak_id'
              when d.id is not null then 'saksi_id' else null end) kolom,
        (case when b.id is not null then 'abt_keterangan_terdakwa' when c.id is not null then 'abt_keterangan_terdakwa'
              when d.id is not null then 'abt_keterangan_saksi' else null end) tabel
        from pihak a
        left join perkara_pihak1 b on a.id=b.pihak_id and b.perkara_id=${pid}
        left join perkara_pihak2 c on a.id=c.pihak_id and c.perkara_id=${pid}
        left join perkara_pihak5 d on a.id=d.pihak_id and d.perkara_id=${pid}
        where a.nama = ?) x where x.tabel is not null`,
      [cat, cat, cat, namaPihak]
    );
    const id = ids[0];
    if (!id || !id.tabel) {
      const g = new Error(`pihak/saksi "${namaPihak}" tidak ditemukan di SIPP (ABT: ERROR LOAD DATA)`);
      g.muatGagal = true;
      throw g;
    }
    if (!/^abt_keterangan_(saksi|terdakwa)$/.test(id.tabel) || !/^(saksi_id|pihak_id)$/.test(id.kolom)) throw new Error("tabel keterangan tidak sah");
    const sidang = sidangId ? ` AND sidang_id = ${Number(sidangId)}` : "";
    ctx.jumlahKueri += 1;
    return kueri(
      `SELECT urutan_pertanyaan, pertanyaan, jawaban FROM ${skema}.${id.tabel}
        WHERE perkara_id = ${pid}${sidang} AND ${id.kolom} = ? ORDER BY urutan_pertanyaan, id`,
      [String(id.id)]
    );
  }

  /** Abt_model::data_variabel_detil - pulang {value, varData, valueType, status, sebab, wakil?}. */
  function detil(ctx, noVar, tumpuk = []) {
    const kunci = String(noVar);
    const lingkar = { value: "DATA_TIDAK_ADA", varData: null, valueType: "-", status: "galat", sebab: "lingkaran/kedalaman penanda" };
    // Lingkaran diperiksa SEBELUM ingatan: kueri yang menyebut dirinya sendiri akan
    // menunggu janjinya sendiri selamanya.
    if (tumpuk.includes(kunci) || tumpuk.length > KEDALAMAN_MAKS) return Promise.resolve(lingkar);
    if (ctx.memo.has(kunci)) {
      // Lingkaran lintas pekerja paralel (A menunggu B yang menunggu A) diputus batas waktu.
      let jeda;
      const batas = new Promise((selesai) => {
        jeda = setTimeout(() => selesai(lingkar), BATAS_TUNGGU_MS);
      });
      return Promise.race([ctx.memo.get(kunci), batas]).finally(() => clearTimeout(jeda));
    }
    const janji = hitungDetil(ctx, kunci, [...tumpuk, kunci]).catch((g) => ({
      value: "DATA_TIDAK_ADA",
      varData: null,
      valueType: "-",
      status: g && g.muatGagal ? "kosong" : "galat",
      sebab: String((g && g.message) || g).slice(0, 240),
    }));
    ctx.memo.set(kunci, janji);
    return janji;
  }

  async function hitungDetil(ctx, noVar, tumpuk) {
    const kat = await katalog();
    const def = kat.get(noVar) || null;
    if (!def) return { ...KOSONG("tidak ada di katalog ABT (VARIABEL_TIDAK_TERSEDIA)"), status: "takada" };
    const nama = def.nama;
    const jenis = def.data_type;
    const multi = def.multi_sidang;
    const ref = def.referensi;

    // KETERANGAN SAKSI / TANYA-JAWAB
    if (jenis === "tanya_jawab") {
      const kertas = await jenisKertas();
      const lembar = phpBenar(ref) ? ctx.tanyaJawabSaksi[String(ref)] : null;
      let semua;
      let sidangan;
      if (Array.isArray(lembar) && lembar.length) {
        // Lembar ALETA untuk saksi ini: dibentuk PERSIS seperti ABT membentuk rekamannya.
        semua = lembar;
        sidangan = lembar;
      } else {
        const ident = await variabelTampil(ctx, ref, tumpuk);
        if (ident === "...") return { value: "TIDAK_BISA_LOAD", varData: null, valueType: "-", status: "kosong", sebab: `identitas #${ref}# belum ada` };
        const s = await sidangTerpilih(ctx);
        semua = await keteranganPihak(ctx, ident, nama, null);
        sidangan = s && phpBenar(s.id) ? await keteranganPihak(ctx, ident, nama, s.id) : semua;
      }
      if (!semua.length) return KOSONG("tanya-jawab belum diisi di ABT");
      if (multi === "tanyajawab") {
        if (kertas !== "A4" && kertas !== "A4s") return { value: null, varData: null, valueType: "data_sql", status: "terisi", sebab: "" };
        return { value: null, tabel: sidangan, kertas, varData: null, valueType: "data_sql", status: sidangan.length ? "terisi" : "kosong", sebab: sidangan.length ? "" : "tanya-jawab sidang ini belum diisi di ABT" };
      }
      const daftar = daftarKeterangan(semua);
      return { value: daftar, varData: daftar, valueType: "data_sql", status: daftar ? "terisi" : "kosong", sebab: daftar ? "" : "jawaban saksi kosong" };
    }

    // MULTI DATA SIDANG
    if (jenis === "multi_sidang") {
      const s = await sidangTerpilih(ctx);
      const varData = s && Object.prototype.hasOwnProperty.call(s, multi) ? s[multi] : null;
      let value;
      if (multi === "dihadiri_oleh") {
        const p = await variabelTampil(ctx, "0046", tumpuk);
        const t = await variabelTampil(ctx, "0047", tumpuk);
        const ganti = { 1: "semua pihak", 2: `${p} saja`, 3: `${t} saja`, 4: "pihak tidak hadir" };
        value = String(varData ?? "");
        for (const k of ["1", "2", "3", "4"]) value = value.split(k).join(ganti[k]);
      } else if (multi === "hari_sblmnya" || multi === "hari_sidang" || multi === "hari_ditunda") value = getHari(varData);
      else if (tanggalYmd(varData)) value = tglIndo2(varData);
      else value = varData;
      if (!s) return { value: "DATA_TIDAK_ADA", varData: null, valueType: multi, status: "kosong", sebab: ctx.sidangKe ? `sidang ke-${ctx.sidangKe} belum ada di SIPP` : "jadwal sidang belum ada di SIPP" };
      return { value, varData, valueType: multi, status: "terisi", sebab: "" };
    }

    // PANGGIL DATA KOSTUM (referensi)
    if (phpBenar(ref)) {
      const data = (await detil(ctx, ref, tumpuk)).varData;
      if (jenis === "tanggal_hari") return { value: getHari(data), varData: data, valueType: "hari", status: "terisi", sebab: "" };
      if (jenis === "tanggal_hijriah") return { value: hijriah(data), varData: data, valueType: "hijriah", status: "terisi", sebab: "" };
      if (jenis === "terbilang" && phpNumerik(data)) return { value: terbilangAbt(data), varData: data, valueType: "terbilang", status: "terisi", sebab: "" };
      if (jenis === "qrcode") return KOSONG("kode QR hanya dapat dibuat ABT");
      return KOSONG(`#${ref}# belum berisi ${jenis === "terbilang" ? "angka" : "data"}`);
    }

    // PANGGIL DATA REGULAR
    if (phpBenar(nama)) {
      const baris = await ambilData(ctx, def, noVar, tumpuk);
      if (!baris) {
        const tangan = jenis === "data_teks" || jenis === "data_tanggal";
        if (!phpBenar(jenis)) return KOSONG("tidak berjenis di katalog ABT (isian tangan)");
        return KOSONG(tangan ? "isian tangan belum diisi di ABT" : "kueri ABT tidak memulangkan baris untuk perkara ini");
      }
      const d = baris.data;
      if (noVar === "8008" || noVar === "8011") {
        const v = ucwordsLower(d);
        return { value: v, varData: v, valueType: "teks_biasa", status: "terisi", sebab: "" };
      }
      if (tanggalYmd(d)) return { value: tglIndo2(d), varData: d.split("-").join("/"), valueType: "tanggal", status: "terisi", sebab: "" };
      if (phpNumerik(d) && String(d).includes("0.00")) return { value: formatAngka(d), varData: d, valueType: "angka", status: "terisi", sebab: "" };
      if (jenis === "data_teks" || jenis === "data_sql") return { value: nl2br(d), varData: d, valueType: "teks_biasa", status: "terisi", sebab: "" };
      return { value: d, varData: d, valueType: "teks_sipp", status: "terisi", sebab: "" };
    }

    return { value: null, varData: null, valueType: "-", status: "terisi", sebab: "" };
  }

  /**
   * Nilai siap-sisip untuk satu penanda.
   * @returns {Promise<{status, sebab, nama, rtf: string, polos: string}>}
   */
  async function nilaiSiap(ctx, noVar) {
    const d = await detil(ctx, noVar);
    const kat = await katalog().catch(() => new Map());
    const nama = String((kat.get(noVar) || {}).nama || "");
    const peta = new Map();
    const polos = new Map();
    let nomor = 0;
    const wakil = (rtf) => {
      const c = String.fromCharCode(0xe100 + nomor++);
      peta.set(c, rtf);
      polos.set(c, /\\row/.test(rtf) ? "\n" : /\\cell/.test(rtf) ? "\t" : "");
      return c;
    };
    let mentah;
    if (d.tabel) mentah = tabelTanyaJawab(d.tabel, d.kertas, wakil) ?? "";
    else mentah = d.value === null || d.value === undefined ? "" : String(d.value);
    if (mentah.length > PANJANG_NILAI_MAKS) mentah = mentah.slice(0, PANJANG_NILAI_MAKS);
    const bersih = bersihkanHtmlAbt(mentah);
    return { status: d.status, sebab: d.sebab, nama, rtf: keRtf(bersih, peta), polos: kePolos(bersih, polos) };
  }

  /** Menjalankan fungsi atas daftar dengan paralel terbatas. */
  async function untukSemua(daftar, fn) {
    const hasil = new Array(daftar.length);
    let i = 0;
    const pekerja = Array.from({ length: Math.min(PARALEL, daftar.length) }, async () => {
      while (i < daftar.length) {
        const k = i++;
        hasil[k] = await fn(daftar[k]);
      }
    });
    await Promise.all(pekerja);
    return hasil;
  }

  /**
   * Nilai sejumlah penanda (teks polos & RTF) - untuk naskah yang bukan RTF blangko.
   * @returns {Promise<Map<string, {status, sebab, nama, rtf, polos}>>}
   */
  async function nilaiPenanda(opsi, daftar) {
    const ctx = konteks(opsi);
    const unik = [...new Set((daftar || []).map((x) => String(x).trim()).filter((x) => /^\d{1,6}$/.test(x)))];
    const hasil = await untukSemua(unik, (n) => nilaiSiap(ctx, n));
    return new Map(unik.map((n, i) => [n, hasil[i]]));
  }

  /**
   * Mengisi RTF blangko seperti ABT mengisinya.
   *
   * opsi.timpa    {noVar: teks}  isian ALETA yang MENANG atas ABT (lembar BAS, kehadiran, sidang)
   * opsi.cadangan {noVar: teks}  isian ALETA yang dipakai bila ABT kosong
   * opsi.tanyaJawabSaksi {noVarIdentitasSaksi: [{pertanyaan, jawaban}]} lembar ALETA
   */
  async function isiRtf(rtfAsli, opsi = {}) {
    const ctx = konteks(opsi);
    const timpa = opsi.timpa && typeof opsi.timpa === "object" ? opsi.timpa : {};
    const cadangan = opsi.cadangan && typeof opsi.cadangan === "object" ? opsi.cadangan : {};
    const ada = (o, k) => Object.prototype.hasOwnProperty.call(o, k) && String(o[k] ?? "").trim() !== "";

    const satu = satukanPenandaTerpecah(rtfAsli);
    let rtf = satu.rtf;
    const sorot = siapkanSorot(rtf);
    rtf = sorot.rtf;
    const tandaKosong = sorot.indeks === null ? "..." : `{\\highlight${sorot.indeks} ...}`;

    const terisi = new Set();
    const kosong = new Map();
    const sumber = { aleta: 0, abt: 0, cadangan: 0, kosong: 0 };
    let mesinGalat = "";

    // Nilai dari ABT dapat memuat penanda lagi (isian teks yang menyebut #1268#):
    // diulang sampai habis, paling banyak 4 putaran.
    for (let putaran = 0; putaran < 4; putaran += 1) {
      const nomor = [...new Set([...rtf.matchAll(POLA_PENANDA)].map((m) => m[1]))];
      if (nomor.length === 0) break;
      const nilai = new Map();
      await untukSemua(nomor, async (n) => {
        if (ada(timpa, n)) {
          nilai.set(n, { rtf: amankanUntukRtf(timpa[n]), asal: "aleta" });
          return;
        }
        let v = null;
        if (!mesinGalat) {
          try {
            v = await nilaiSiap(ctx, n);
          } catch (g) {
            mesinGalat = String((g && g.message) || g).slice(0, 200);
          }
        }
        if (v && v.status === "terisi") {
          nilai.set(n, { rtf: v.rtf, asal: "abt" });
          return;
        }
        if (ada(cadangan, n)) {
          nilai.set(n, { rtf: amankanUntukRtf(cadangan[n]), asal: "cadangan" });
          return;
        }
        nilai.set(n, { rtf: tandaKosong, asal: "kosong", nama: v ? v.nama : "", sebab: v ? v.sebab : `mesin ABT tidak terbaca: ${mesinGalat}` });
      });
      rtf = rtf.replace(POLA_PENANDA, (utuh, n) => {
        const v = nilai.get(n);
        if (!v) return utuh;
        sumber[v.asal] += 1;
        if (v.asal === "kosong") {
          if (!kosong.has(n)) kosong.set(n, { noVar: n, nama: v.nama || "", sebab: v.sebab || "" });
        } else terisi.add(n);
        return v.rtf;
      });
    }
    // Penjaga terakhir: tidak satu pun penanda mentah boleh keluar.
    rtf = rtf.replace(POLA_PENANDA, (utuh, n) => {
      if (!kosong.has(n)) kosong.set(n, { noVar: n, nama: "", sebab: "penanda bersarang terlalu dalam" });
      return tandaKosong;
    });

    return {
      rtf,
      terisi: [...terisi].sort(),
      kosong: [...kosong.values()].sort((a, b) => a.noVar.localeCompare(b.noVar)),
      sumber,
      terpecahDisatukan: satu.jumlah,
      jumlahKueri: ctx.jumlahKueri,
      mesinGalat,
    };
  }

  return { katalog, nilaiPenanda, isiRtf, detil: (opsi, n) => detil(konteks(opsi), n) };
}

module.exports = {
  buatMesin,
  jalurPengisian,
  pagarBaca,
  bersihkanHtmlAbt,
  keRtf,
  kePolos,
  amankanUntukRtf,
  tabelTanyaJawab,
  daftarKeterangan,
  satukanPenandaTerpecah,
  siapkanSorot,
  tglIndo2,
  getHari,
  hijriah,
  terbilangAbt,
  formatAngka,
  tanggalYmd,
  POLA_PENANDA,
};
