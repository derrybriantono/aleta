"use strict";

/**
 * ============================================================================
 * BAHAN SAMPUL DAN DAFTAR ISI BERKAS (26 Okt 2026) - BACA SAJA
 * ============================================================================
 *
 * Rancangan: docs/rancangan/sampul-daftar-isi-26okt/RANCANGAN.md (bagian 9-14).
 *
 *   berkas.fakta   { perkaraId } -> jenis perkara, ciri otomatis, isian khas jenis, riwayat sidang, dan DOKUMEN yang ADA pada perkara itu
 *                  (pendaftaran, penetapan, relaas/e-Summons, bukti surat tercatat, BAS, mediasi, putusan, pasca putusan, arsip e-Court),
 *                  masing-masing dengan jumlah halaman yang dibaca dari berkasnya (e-Doc SIPP dan arsip e-Court) bila bisa.
 *   berkas.pelajari {} -> median halaman per jenis dokumen dari sampel perkara minutasi (bahan nilai bawaan).
 *
 * SIPP dan arsip hanya DIBACA. Tidak ada yang ditulis, tidak ada berkas yang disalin, isi dokumen tidak pernah dikirim: hanya jumlah halaman.
 *
 * Jumlah halaman PDF: dibaca dari struktur berkas (/Count pada akar /Type /Pages dan jumlah objek /Type /Page); kedua cara sepakat = pasti.
 * Bila tidak sepakat, pdf-lib (bila terpasang di bot) menjadi juri; tanpa pdf-lib hasilnya "ragu" (layar menandainya perkiraan).
 * Uji silang atas 216 berkas e-Doc server 26 Okt 2026: 98,6% sepakat. DOCX: dari docProps/app.xml. RTF/DOC: jumlah halaman tidak terbaca.
 *
 * doc_resi bernilai 0 = e-Summons tanpa resi (bukan berkas yang belum diunggah): tidak membuat baris "Bukti Surat Tercatat".
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const AKAR_SIPP = String(process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS || process.env.ALETA_BOT_SIPP_DOCUMENT_ROOT || "/var/www/html/SIPP,/usr/src/app/SIPP")
  .split(/[;,]/)
  .map((x) => x.trim())
  .filter(Boolean);
const AKAR_ECOURT = process.env.ALETA_BOT_ECOURT_DIR || "/usr/src/app/data/ecourt";
const BATAS_BERKAS_BYTE = 60 * 1024 * 1024;
const BATAS_CACHE = 4000;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** id jenis perkara SIPP -> kunci jenis sampul (sama dengan JENIS di ekstensi-sipp/blangko-derry-berkas.js). */
const KUNCI_JENIS = Object.freeze({ 347: "cg", 346: "ct", 360: "in", 362: "dk", 358: "aua", 354: "wali", 363: "adhol", 341: "poligami", 364: "waris", 371: "paw", 348: "hb", 370: "es" });

const cache = new Map();
let pdfLibCoba = null;

function pdfLib() {
  if (pdfLibCoba === null) {
    try {
      pdfLibCoba = require("pdf-lib");
    } catch {
      pdfLibCoba = false;
    }
  }
  return pdfLibCoba || null;
}

// ---------------------------------------------------------------------------
// Jumlah halaman
// ---------------------------------------------------------------------------

/** Dua penghitung struktur PDF (tanpa pustaka). Murni. */
function strukturPdf(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString("latin1") : String(buf || "");
  if (s.slice(0, 5) !== "%PDF-") return { tidakSah: true, count: 0, objek: 0 };
  let count = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/gs)) count = Math.max(count, Number(m[1]));
  for (const m of s.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/gs)) count = Math.max(count, Number(m[1]));
  let objek = (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  if (!count && !objek) {
    // objek terkompresi: buka aliran dan hitung di dalamnya
    for (const m of s.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      let d = null;
      const blok = Buffer.from(m[1], "latin1");
      try {
        d = zlib.inflateSync(blok).toString("latin1");
      } catch {
        try {
          d = zlib.inflateRawSync(blok.subarray(2)).toString("latin1");
        } catch {
          d = null;
        }
      }
      if (!d) continue;
      for (const k of d.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/gs)) count = Math.max(count, Number(k[1]));
      objek = Math.max(objek, (d.match(/\/Type\s*\/Page\b(?!s)/g) || []).length);
    }
  }
  return { tidakSah: false, count, objek };
}

/** { halaman, metode, ragu } atau null bila tidak terbaca. Asinkron karena pdf-lib. */
async function halamanPdf(buf, opsi = {}) {
  const st = strukturPdf(buf);
  if (st.tidakSah) return null;
  const lib = opsi.pdfLib === undefined ? pdfLib() : opsi.pdfLib;
  if (st.count > 0 && st.objek > 0 && st.count === st.objek) return { halaman: st.count, metode: "struktur", ragu: false };
  let dariLib = 0;
  if (lib && lib.PDFDocument) {
    try {
      const d = await lib.PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
      dariLib = d.getPageCount();
    } catch {
      dariLib = 0;
    }
  }
  if (dariLib > 0) return { halaman: dariLib, metode: "pdf-lib", ragu: false };
  const tunggal = st.count || st.objek;
  if (!tunggal) return null;
  // dua cara tidak sepakat dan tak ada juri: pakai yang terbesar? Tidak - yang aman adalah akar /Count bila ada, ditandai ragu.
  const pilih = st.count || st.objek;
  const adaDua = st.count > 0 && st.objek > 0;
  return { halaman: pilih, metode: adaDua ? "struktur-beda" : "struktur-tunggal", ragu: adaDua };
}

/** Membaca satu entri berkas ZIP (DOCX) tanpa pustaka: direktori pusat -> inflate. null bila tidak ada. */
function entriZip(buf, nama) {
  try {
    const akhir = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (akhir < 0) return null;
    const jumlah = buf.readUInt16LE(akhir + 10);
    let p = buf.readUInt32LE(akhir + 16);
    for (let i = 0; i < jumlah; i += 1) {
      if (buf.readUInt32LE(p) !== 0x02014b50) return null;
      const metode = buf.readUInt16LE(p + 10);
      const ukuranTerkompres = buf.readUInt32LE(p + 20);
      const panjangNama = buf.readUInt16LE(p + 28);
      const panjangEkstra = buf.readUInt16LE(p + 30);
      const panjangKomentar = buf.readUInt16LE(p + 32);
      const lokal = buf.readUInt32LE(p + 42);
      const n = buf.toString("latin1", p + 46, p + 46 + panjangNama);
      if (n === nama) {
        const pn = buf.readUInt16LE(lokal + 26);
        const pe = buf.readUInt16LE(lokal + 28);
        const data = buf.subarray(lokal + 30 + pn + pe, lokal + 30 + pn + pe + ukuranTerkompres);
        return metode === 0 ? data : zlib.inflateRawSync(data);
      }
      p += 46 + panjangNama + panjangEkstra + panjangKomentar;
    }
  } catch {
    return null;
  }
  return null;
}

function halamanDocx(buf) {
  const x = entriZip(buf, "docProps/app.xml");
  if (!x) return null;
  const m = x.toString("utf8").match(/<Pages>(\d+)<\/Pages>/);
  return m && Number(m[1]) >= 1 ? { halaman: Number(m[1]), metode: "app.xml", ragu: false } : null;
}

/** Halaman satu berkas di cakram (cache menurut jalur+ukuran+waktu ubah). */
async function halamanBerkas(jalurMutlak, deps = {}) {
  const fsp = (deps.fs || fs).promises;
  let st;
  try {
    st = await fsp.stat(jalurMutlak);
  } catch {
    return { ada: false, halaman: null, metode: "tidak-ada", ragu: false };
  }
  if (!st.isFile() || st.size > BATAS_BERKAS_BYTE) return { ada: st.isFile(), halaman: null, metode: "terlalu-besar", ragu: false };
  const ext = path.extname(jalurMutlak).toLowerCase();
  const kunci = `${jalurMutlak}|${st.size}|${Math.floor(st.mtimeMs)}`;
  if (cache.has(kunci)) return cache.get(kunci);
  let hasil = { ada: true, halaman: null, metode: ext === ".rtf" || ext === ".doc" ? "tanpa-halaman" : "tak-terbaca", ragu: false, ukuran: st.size };
  if (ext === ".pdf" || ext === ".docx") {
    const buf = await fsp.readFile(jalurMutlak);
    const h = ext === ".pdf" ? await halamanPdf(buf, deps) : halamanDocx(buf);
    if (h) hasil = { ada: true, ukuran: st.size, ...h };
  }
  if (cache.size >= BATAS_CACHE) cache.clear();
  cache.set(kunci, hasil);
  return hasil;
}

/** Jalur relatif SIPP ("resources/file/doc/...") -> jalur mutlak di salah satu akar; "" bila tidak sah. */
function jalurSipp(relatif, akar = AKAR_SIPP, deps = {}) {
  const r = String(relatif || "").trim();
  if (!/^resources\/file\/doc\//.test(r) || r.includes("..")) return "";
  const ada = deps.ada || ((p) => fs.existsSync(p));
  for (const a of akar) {
    const p = path.join(a, r);
    if (ada(p)) return p;
  }
  return path.join(akar[0] || "", r);
}

// ---------------------------------------------------------------------------
// Kueri SIPP (baca saja)
// ---------------------------------------------------------------------------
let dbCadangan = null;
function kueriBawaan(sql, params = []) {
  if (!dbCadangan) dbCadangan = require("../db_config");
  return new Promise((resolve, reject) => {
    dbCadangan.query(sql, params, (galat, baris) => (galat ? reject(galat) : resolve(Array.isArray(baris) ? baris : [])));
  });
}

function iso(t) {
  if (!t) return "";
  if (t instanceof Date) {
    if (Number.isNaN(t.getTime())) return "";
    const z = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
  }
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function tglIndonesia(t) {
  const m = iso(t).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : "";
}
const nomorBaris = (x) => Number(x) || 0;

const URUT = ["", "Pertama", "Kedua", "Ketiga", "Keempat", "Kelima", "Keenam", "Ketujuh", "Kedelapan", "Kesembilan"];
const HADIR = { 1: "P T", 2: "P", 3: "T", 4: "-", 5: "I" };

/** Median jumlah halaman dari daftar angka; null bila kosong. Murni. */
function median(daftar) {
  const a = (daftar || []).filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.floor((a.length - 1) / 2)];
}

/** Nama berkas e-Court -> jenis dokumen. Murni. */
function jenisEcourt(nama) {
  const n = String(nama || "").toLowerCase();
  if (/\.(jpg|jpeg|png|gif)$/.test(n)) return "";
  if (/surat gugatan|dokumen gugatan|^gugatan/.test(n)) return "gugatan";
  if (/surat permohonan|dokumen permohonan|^permohonan/.test(n)) return "permohonan";
  if (/dokumen bukti|^bukti|alat bukti/.test(n)) return "bukti";
  if (/jawaban/.test(n)) return "jawaban";
  if (/replik|replika/.test(n)) return "replik";
  if (/duplik/.test(n)) return "duplik";
  if (/kesimpulan|simpulan/.test(n)) return "kesimpulan";
  if (/surat kuasa|^kuasa/.test(n)) return "kuasa";
  return "";
}

const NAMA_JENIS_ECOURT = {
  gugatan: "Surat Gugatan",
  permohonan: "Surat Permohonan",
  bukti: "Daftar Bukti Surat",
  jawaban: "Jawaban",
  replik: "Replik",
  duplik: "Duplik",
  kesimpulan: "Kesimpulan",
  kuasa: "Surat Kuasa Khusus",
};

async function berkasEcourt(nomorPerkara, deps = {}) {
  const fsp = (deps.fs || fs).promises;
  const folder = String(nomorPerkara || "").replace(/\//g, "-");
  if (!folder || folder.includes("..")) return [];
  const akar = deps.akarEcourt || AKAR_ECOURT;
  let daftar = [];
  try {
    daftar = await fsp.readdir(path.join(akar, folder));
  } catch {
    return [];
  }
  const hasil = [];
  hasil.semuaNama = daftar.slice(0, 200).map((x) => String(x));
  for (const nama of daftar.slice(0, 200)) {
    const jenis = jenisEcourt(nama);
    if (!jenis) continue;
    const h = await halamanBerkas(path.join(akar, folder, nama), deps);
    hasil.push({ jenis, nama: nama.replace(/__[0-9a-f]{6,}(\.[A-Za-z0-9]+)?$/, ""), jalurMutlak: path.join(akar, folder, nama), ...h });
  }
  return hasil;
}

/** Jumlah halaman satu baris dokumen dari satu atau beberapa jalur; { halaman, sumber, dasar }. */
async function halamanBaris(jalurRelatif, jenisBawaan, deps) {
  const daftar = (Array.isArray(jalurRelatif) ? jalurRelatif : [jalurRelatif]).filter(Boolean);
  let jumlah = 0;
  let semuaTerbaca = daftar.length > 0;
  let ragu = false;
  let ada = 0;
  const jalurAda = [];
  for (const j of daftar) {
    const mutlak = jalurSipp(j, deps.akarSipp || AKAR_SIPP, deps);
    const h = mutlak ? await halamanBerkas(mutlak, deps) : { ada: false };
    if (h.ada) {
      ada += 1;
      jalurAda.push(mutlak);
    }
    if (h.halaman) {
      jumlah += h.halaman;
      if (h.ragu) ragu = true;
    } else semuaTerbaca = false;
  }
  // Jalur berkas yang ADA dicatat di sisi (bukan di hasil): dipakai bundel satu PDF, tidak pernah keluar dari bot sebagai jalur.
  if (deps.jejak) deps.jejak.jalur = jalurAda;
  if (semuaTerbaca && jumlah > 0) return { halaman: jumlah, sumber: ragu ? "perkiraan" : "pasti", dasar: ragu ? "halaman berkas: dua cara hitung berbeda" : "halaman dibaca dari berkas" };
  return { halaman: null, sumber: "perkiraan", dasar: ada ? "berkas RTF/DOC: halaman belum terbaca" : "tidak ada berkas", jenisBawaan };
}

// ---------------------------------------------------------------------------
// Objek sengketa dan anak untuk sampul cetak awal (versi 7): lampiran hanya bila perlu (objek lebih dari 2, anak lebih dari 3)
// ---------------------------------------------------------------------------
/**
 * Murni. perkara_obyek_sengketa.obyek_gugatan adalah SATU teks bebas. Objek = butir bernomor ("1." "2)" "a." di awal baris) atau, bila tidak
 * bernomor, tiap baris tidak kosong; isian "-" / kosong = tidak ada objek. Hasil [{nama, letak}]: nama = kalimat pertama (maks 90 huruf),
 * letak = sisanya. Teks yang hanya satu paragraf tanpa nomor = SATU objek. Tidak menebak jumlah dari isi kalimat.
 */
function uraiObjek(teks) {
  const t = String(teks == null ? "" : teks).replace(/<[^>]*>/g, " ").replace(/\r/g, "").trim();
  if (!t || /^[-.\s]*$/.test(t) || /^(tidak ada|nihil)$/i.test(t)) return [];
  const baris = t.split("\n").map((x) => x.trim()).filter(Boolean);
  const bernomor = baris.filter((x) => /^(\d{1,3}|[a-z])[.)]\s+\S/i.test(x));
  let butir;
  if (bernomor.length >= 2) {
    butir = [];
    for (const x of baris) {
      if (/^(\d{1,3}|[a-z])[.)]\s+\S/i.test(x)) butir.push(x.replace(/^(\d{1,3}|[a-z])[.)]\s+/i, ""));
      else if (butir.length) butir[butir.length - 1] += ` ${x}`;
      else butir.push(x);
    }
  } else if (baris.length >= 2 && baris.every((x) => x.length <= 300)) {
    butir = baris;
  } else {
    butir = [baris.join(" ")];
  }
  return butir.map((x) => {
    const bersih = x.replace(/\s+/g, " ").trim();
    const m = bersih.match(/^(.{20,90}?[.;:])\s+(.*)$/);
    if (m) return { nama: m[1].replace(/[.;:]$/, ""), letak: m[2].slice(0, 400) };
    if (bersih.length <= 90) return { nama: bersih, letak: "" };
    const potong = bersih.lastIndexOf(" ", 90);
    const batas = potong > 40 ? potong : 90;
    return { nama: bersih.slice(0, batas), letak: bersih.slice(batas).trim().slice(0, 400) };
  });
}

/** Umur penuh (tahun) pada tanggal acuan; "" bila tanggal lahir tidak sah. Murni. */
function umurPenuh(lahir, acuan = new Date()) {
  const m = String(lahir || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  let u = acuan.getFullYear() - Number(m[1]);
  if (acuan.getMonth() + 1 < Number(m[2]) || (acuan.getMonth() + 1 === Number(m[2]) && acuan.getDate() < Number(m[3]))) u -= 1;
  return u >= 0 && u < 130 ? String(u) : "";
}

// ---------------------------------------------------------------------------
// CATATAN sampul cetak awal (versi 8): baris ALASAN berkotak centang, tercentang otomatis dari posita/petitum (satu sumber dengan deteksi ALETA)
// ---------------------------------------------------------------------------
const RE_ITSBAT = {
  a: /untuk\s+(?:keperluan\s+|kepentingan\s+)?(?:penyelesaian\s+)?perceraian|gugatan\s+(?:cerai|perceraian)/i,
  b: /(?:buku|akta|kutipan)\s+nikah[^.;]{0,60}hilang|hilang[^.;]{0,60}(?:buku|akta|kutipan)\s+nikah/i,
  c: /(?:ragu|diragukan|keraguan)[^.;]{0,60}(?:sah|syarat|nikah)|(?:sah|syarat)[^.;]{0,60}(?:ragu|diragukan)/i,
  d: /sebelum\s+(?:berlakunya\s+)?(?:undang[- ]undang|uu)\s*(?:nomor\s*|no\.?\s*)?(?:1\s*(?:tahun|\/)\s*1974)?/i,
};
const RE_DK = {
  2: /(?:khawatir|kekhawatiran|takut)[^.;]{0,80}(?:zina|perbuatan\s+(?:yang\s+)?dilarang|melanggar)|hubungan\s+(?:yang\s+)?(?:sangat\s+)?(?:erat|dekat)|berpacaran|menjalin\s+hubungan/i,
};
const RE_HARTA = {
  hb1: /menetapkan[^.;]{0,120}harta\s+bersama|(?:sebagai|merupakan)\s+harta\s+bersama/i,
  hb2: /(?:1\s*\/\s*2|setengah|separuh|masing-masing\s+(?:mendapat|memperoleh|berhak))/i,
  w1: /menetapkan[^.;]{0,120}ahli\s+waris|(?:sebagai|adalah)\s+ahli\s+waris/i,
  w2: /(?:membagi|pembagian|membagikan)[^.;]{0,80}(?:harta|tirkah|warisan|waris)/i,
  p2: /tabungan|deposito|asuransi|taspen|bank|aset|uang\s+pensiun/i,
  p3: /balik\s+nama|peralihan\s+hak|sertifikat/i,
};

function kamusCocok(kelompok, kunci, teks, kamusDeteksi) {
  const k = kamusDeteksi || require("./kamusDeteksi");
  const butir = k.polaKelompok(kelompok).filter((x) => x.kunci === kunci);
  return butir.some((x) => new RegExp(x.regex, x.flags || "i").test(teks));
}

/** Teks SIPP (bisa memuat tag HTML) menjadi butir per baris/paragraf. */
function butirDariTeks(teks) {
  const t = String(teks || "").replace(/<\/(p|div|li)>|<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ");
  return t.split(/\r?\n|;\s*(?=-|Bahwa\b)/i).map((x) => x.replace(/^[\s\-\u2022]+/, "").replace(/\s+/g, " ").trim()).filter((x) => x.length > 3);
}
/** Nomor butir bagi petugas: awalan nomor di teks ("4. ...") bila ada, kalau tidak urutan butir. */
function nomorButir(butir, kalimat) {
  const i = butir.indexOf(kalimat);
  if (i < 0) return 0;
  const m = String(kalimat).match(/^(\d{1,3})[.)]\s/);
  return m ? Number(m[1]) : i + 1;
}
function kutipanDari(butir, cocok) {
  const k = butir.find((x) => (typeof cocok === "function" ? cocok(x) : cocok.test(x)));
  return k ? { kutipan: k.length > 240 ? `${k.slice(0, 237)}...` : k, butir: nomorButir(butir, k) } : null;
}

/**
 * Murni (kecuali memuat kamus). bahan: { jenis (kunci jenis sampul), posita, petitum, alasanSipp[] (nama alasan nikah SIPP), tanggalNikah (iso), sita }.
 * Hasil { kunci: {sumber, kutipan, butir, bagian} } hanya yang terdeteksi; kutipan = butir posita/petitum yang menunjuknya. Cerai (cg, ct): sebab dari posita lewat
 * mesin deteksi alasan yang SAMA dengan panel (huruf langsung A, C, D, E, F, G, H; huruf B butuh lama pisah dan tidak ditebak). Selebihnya aturan kata yang
 * tertulis di atas; yang tidak terbaca tidak dicentang.
 */
function deteksiAlasan(bahan = {}, deps = {}) {
  const hasil = {};
  const butirPosita = butirDariTeks(bahan.posita);
  const butirPetitum = butirDariTeks(bahan.petitum);
  const posita = butirPosita.join(" ");
  const petitum = butirPetitum.join(" ");
  const taruh = (k, sumber, kut, bagian) => {
    if (!hasil[k]) hasil[k] = { sumber, kutipan: kut ? kut.kutipan : "", butir: kut ? kut.butir : 0, bagian: kut ? bagian : "" };
  };
  const jenis = bahan.jenis;
  if (jenis === "cg" || jenis === "ct") {
    const da = deps.deteksiAlasan || require("./deteksiAlasanService");
    const sebab = da.sebabDariButir(butirPosita, {}) || [];
    for (const huruf of "ACDEFGH") {
      const pemicu = da.sebabHuruf(sebab, huruf);
      if (!pemicu.length) continue;
      const kal = pemicu[0].kalimat;
      taruh(huruf.toLowerCase(), `posita: ${pemicu.map((x) => x.sebab).filter((x, i, a) => a.indexOf(x) === i).join(", ")}`, { kutipan: kal.length > 240 ? `${kal.slice(0, 237)}...` : kal, butir: nomorButir(butirPosita, kal) }, "posita");
    }
  } else if (jenis === "dk") {
    const alasan = (bahan.alasanSipp || []).join("; ");
    const hamil = (x) => /hamil/i.test(x) || kamusCocok("dispensasi", "fakta-hamil", x, deps.kamusDeteksi);
    if (/hamil/i.test(alasan) || butirPosita.some(hamil)) taruh("1", /hamil/i.test(alasan) ? "alasan SIPP" : "posita", kutipanDari(butirPosita, hamil), "posita");
    if (RE_DK[2].test(`${posita} ${alasan}`)) taruh("2", "posita", kutipanDari(butirPosita, RE_DK[2]), "posita");
    const lamar = (x) => kamusCocok("dispensasi", "fakta-lamaran", x, deps.kamusDeteksi) || /tunangan|bertunangan/i.test(x);
    if (butirPosita.some(lamar)) taruh("3", "posita", kutipanDari(butirPosita, lamar), "posita");
  } else if (jenis === "in") {
    for (const h of ["a", "b", "c"]) if (RE_ITSBAT[h].test(posita)) taruh(h, "posita", kutipanDari(butirPosita, RE_ITSBAT[h]), "posita");
    const tgl = String(bahan.tanggalNikah || "");
    const sebelum = /^\d{4}/.test(tgl) && tgl < "1974-01-02";
    if (sebelum || RE_ITSBAT.d.test(posita)) taruh("d", sebelum ? "tanggal menikah sebelum UU 1/1974" : "posita", sebelum ? { kutipan: `Tanggal menikah ${tgl}`, butir: 0 } : kutipanDari(butirPosita, RE_ITSBAT.d), sebelum ? "SIPP" : "posita");
    const e = (x) => kamusCocok("itsbat", "fakta-tanpa-halangan", x, deps.kamusDeteksi);
    const t = (x) => kamusCocok("itsbat", "fakta-tidak-tercatat", x, deps.kamusDeteksi);
    if (butirPosita.some(e) && butirPosita.some(t)) taruh("e", "posita", kutipanDari(butirPosita, e), "posita");
  } else if (jenis === "hb") {
    if (RE_HARTA.hb1.test(petitum)) taruh("1", "petitum", kutipanDari(butirPetitum, RE_HARTA.hb1), "petitum");
    if (RE_HARTA.hb2.test(petitum)) taruh("2", "petitum", kutipanDari(butirPetitum, RE_HARTA.hb2), "petitum");
    if (RE_SITA.test(petitum)) taruh("3", "petitum", kutipanDari(butirPetitum, RE_SITA), "petitum");
    else if (bahan.sita) taruh("3", "proses SIPP", null, "");
  } else if (jenis === "waris") {
    if (RE_HARTA.w1.test(petitum)) taruh("1", "petitum", kutipanDari(butirPetitum, RE_HARTA.w1), "petitum");
    if (RE_HARTA.w2.test(petitum)) taruh("2", "petitum", kutipanDari(butirPetitum, RE_HARTA.w2), "petitum");
    if (RE_SITA.test(petitum)) taruh("3", "petitum", kutipanDari(butirPetitum, RE_SITA), "petitum");
    else if (bahan.sita) taruh("3", "proses SIPP", null, "");
  } else if (jenis === "paw") {
    const w2 = (x) => RE_HARTA.w2.test(x);
    if (butirPetitum.some(w2)) taruh("1", "petitum", kutipanDari(butirPetitum, w2), "petitum");
    else if (butirPosita.some(w2)) taruh("1", "posita", kutipanDari(butirPosita, w2), "posita");
    if (RE_HARTA.p2.test(posita)) taruh("2", "posita", kutipanDari(butirPosita, RE_HARTA.p2), "posita");
    if (RE_HARTA.p3.test(posita)) taruh("3", "posita", kutipanDari(butirPosita, RE_HARTA.p3), "posita");
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Deteksi ciri susulan sampul cetak awal (keputusan Derry 26 Okt: "deteksi otomatis apabila ada permintaan sita, eksepsi dan lainnya")
// ---------------------------------------------------------------------------
/** Kunci ciri susulan (nama tampil dipegang portal: lib/berkas-perkara.ts SUSULAN_*). */
const KUNCI_SUSULAN = Object.freeze(["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut", "perbaikan", "anak", "umum"]);
const STATUS_CABUT = new Set([67, 7, 37]);
const kata = (re, teks) => re.test(String(teks || ""));
const RE_SITA = /(^|[^a-z])sita([^a-z]|$)|conservatoir|revindicatoir|sita jaminan|sita marital/i;
const RE_SETEMPAT = /pemeriksaan\s+setempat|descente/i;
const RE_UBAH = /perubahan\s+(gugatan|surat gugatan)|perbaikan\s+(surat\s+)?gugatan/i;
const RE_PERBAIKAN = /perbaikan\s+(surat\s+)?permohonan|perubahan\s+(surat\s+)?permohonan/i;
const RE_CABUT = /cabut|pencabutan/i;
const RE_ANAK = /(mendengar|didengar|dengar).{0,40}anak|anak.{0,40}(didengar|keterangan)|anak\s+(dan|&)\s+calon/i;
const RE_UMUM = /pengumuman/i;

/**
 * Murni. bahan: { petitum (huruf kecil, tanpa tag), agenda[], proses[], statusPutusanId, mediasi, eksepsi, rekonvensi, sela, setempatBiaya, tambahanPanjar, namaEcourt[], gagal[] }
 * Hasil { kunci: "sumber" } hanya yang TERDETEKSI; yang bagiannya tidak terbaca (ada di bahan.gagal) tidak dicentang (bukan "tidak").
 */
function deteksiSusulan(bahan = {}) {
  const hasil = {};
  const agenda = (bahan.agenda || []).map((x) => String(x || ""));
  const proses = (bahan.proses || []).map((x) => String(x || ""));
  const ec = (bahan.namaEcourt || []).map((x) => String(x || ""));
  const dari = (re, daftar) => daftar.some((x) => re.test(x));
  const taruh = (k, sumber) => {
    if (!hasil[k]) hasil[k] = sumber;
  };
  if (bahan.mediasi) taruh("mediasi", "perkara_mediasi");
  if (bahan.eksepsi) taruh("eksepsi", "jawaban e-Court");
  if (dari(/eksepsi/i, agenda)) taruh("eksepsi", "agenda sidang");
  if (bahan.rekonvensi) taruh("rekonvensi", "perkara_rekonvensi / jawaban e-Court");
  if (dari(/rekonvensi/i, agenda)) taruh("rekonvensi", "agenda sidang");
  if (kata(RE_SITA, bahan.petitum)) taruh("sita", "petitum/posita");
  if (dari(RE_SITA, proses)) taruh("sita", "proses SIPP");
  if (bahan.setempatBiaya) taruh("setempat", "biaya pemeriksaan setempat");
  if (dari(RE_SETEMPAT, agenda)) taruh("setempat", "agenda sidang");
  if (bahan.sela) taruh("sela", "putusan sela SIPP");
  if (dari(/putusan\s+sela/i, agenda.concat(proses))) taruh("sela", "agenda/proses");
  if (dari(RE_UBAH, agenda.concat(ec))) taruh("ubah", "agenda/e-Court");
  if (dari(RE_PERBAIKAN, agenda.concat(ec))) taruh("perbaikan", "agenda/e-Court");
  if (bahan.tambahanPanjar) taruh("panjar", "biaya perkara");
  if (STATUS_CABUT.has(Number(bahan.statusPutusanId))) taruh("cabut", "status putusan");
  if (dari(RE_CABUT, agenda)) taruh("cabut", "agenda sidang");
  if (dari(RE_ANAK, agenda)) taruh("anak", "agenda sidang");
  if (dari(RE_UMUM, agenda.concat(proses))) taruh("umum", "agenda/proses");
  // bagian yang tidak terbaca tidak boleh dibaca sebagai "tidak ada": yang bergantung padanya dibuang dari hasil hanya bila tidak terdeteksi (tidak ada yang dihapus)
  return hasil;
}

// ---------------------------------------------------------------------------
// fakta
// ---------------------------------------------------------------------------
async function fakta(params = {}, deps0 = {}) {
  // Sisi jejak berkas per baris (bundel satu PDF): jalur mutlak tiap baris dicatat di sini dan hanya dikembalikan bila diminta (denganJalur).
  const jejak = { jalur: null };
  const jalurPerKunci = {};
  const deps = { ...deps0, jejak };
  const perkaraId = Number(params.perkaraId);
  if (!Number.isFinite(perkaraId) || perkaraId <= 0) return { ok: false, sebab: "Perkara tidak disebut." };
  const q = deps.kueri || kueriBawaan;
  const aman = async (sql, p = []) => {
    try {
      return await q(sql, p);
    } catch {
      return [];
    }
  };
  const [p] = await aman(
    "SELECT perkara_id, nomor_perkara, jenis_perkara_id, jenis_perkara_nama, alur_perkara_id, prodeo, tanggal_pendaftaran, tanggal_surat, petitum, posita FROM perkara WHERE perkara_id = ?",
    [perkaraId]
  );
  if (!p) return { ok: false, sebab: "Perkara tidak ditemukan di SIPP." };
  const jenisId = nomorBaris(p.jenis_perkara_id);
  const alur = nomorBaris(p.alur_perkara_id);
  const petitumTeks = `${String(p.petitum || "")} ${String(p.posita || "")}`.replace(/<[^>]*>/g, " ").toLowerCase();
  let kunciJenis = KUNCI_JENIS[jenisId] || "";
  if (!kunciJenis && /hak asuh|hadhanah|hadlanah|pemeliharaan anak/.test(petitumTeks) && jenisId === 369) kunciJenis = "asuh";
  if (!kunciJenis) kunciJenis = "lain";
  const permohonan = alur === 16 || jenisId === 346;

  const [pen] = await aman("SELECT * FROM perkara_penetapan WHERE perkara_id = ?", [perkaraId]);
  const jadwal = await aman(
    "SELECT id, urutan, tanggal_sidang, agenda, alasan_ditunda, sidang_keliling, dihadiri_oleh, ikrar_talak, verzet, edoc_bas FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY tanggal_sidang, id",
    [perkaraId]
  );
  const sidang = jadwal.filter((j) => String(j.ikrar_talak || "T") !== "Y");
  const hariIni = iso(new Date());
  const relaas = await aman(
    "SELECT r.id, r.sidang_id, r.pihak_id, r.tanggal_relaas, r.ket_temu, r.doc_relaas, r.doc_resi, r.no_resi_pos, " +
      "(SELECT 1 FROM perkara_pihak1 a WHERE a.perkara_id = r.perkara_id AND a.pihak_id = r.pihak_id LIMIT 1) AS sisi1, " +
      "(SELECT 1 FROM perkara_pihak2 b WHERE b.perkara_id = r.perkara_id AND b.pihak_id = r.pihak_id LIMIT 1) AS sisi2 " +
      "FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = ? AND r.tanggal_relaas IS NOT NULL",
    [perkaraId]
  );
  const [med] = await aman("SELECT * FROM perkara_mediasi WHERE perkara_id = ? ORDER BY mediasi_id DESC LIMIT 1", [perkaraId]);
  const [put] = await aman("SELECT * FROM perkara_putusan WHERE perkara_id = ?", [perkaraId]);
  const pbt = await aman(
    "SELECT tanggal_pemberitahuan_putusan, tanggal_menerima_putusan, no_resi_pos, edoc_pbt, edoc_resi, pihak FROM perkara_putusan_pemberitahuan_putusan WHERE perkara_id = ? AND tanggal_pemberitahuan_putusan IS NOT NULL ORDER BY tanggal_pemberitahuan_putusan",
    [perkaraId]
  );
  const [akta] = await aman("SELECT * FROM perkara_akta_cerai WHERE perkara_id = ?", [perkaraId]);
  const [ikrar] = await aman("SELECT * FROM perkara_ikrar_talak WHERE perkara_id = ?", [perkaraId]);
  const pengacara = await aman("SELECT pihak_ke, tanggal_kuasa, urutan, aktif, nama FROM perkara_pengacara WHERE perkara_id = ? AND aktif = 'Y' ORDER BY pihak_ke, urutan", [perkaraId]);
  const dokPenetapan = await aman("SELECT dokumen FROM perkara_dokumen_penetapan WHERE perkara_id = ? AND dokumen IS NOT NULL AND dokumen <> ''", [perkaraId]);
  const berkasPenetapan = { PMH: [], PPP: [], PJS: [], PHS: [] };
  for (const d of dokPenetapan) {
    const m = String(d.dokumen).match(/_Dokumen_([A-Za-z]+)_/);
    if (m && berkasPenetapan[m[1].toUpperCase()]) berkasPenetapan[m[1].toUpperCase()].push(d.dokumen);
  }

  const ec = await berkasEcourt(p.nomor_perkara, deps);
  const ecourtAda = ec.length > 0 || (await aman("SELECT 1 AS x FROM perkara_efiling_id WHERE perkara_id = ? AND efiling_id <> '' LIMIT 1", [perkaraId])).length > 0;

  // ---- sebutan pihak untuk nama dokumen
  const sebP = permohonan ? "Pemohon" : "Penggugat";
  const sebT = permohonan ? "Termohon" : "Tergugat";
  const baris = [];
  const tambah = (bundel, grup, kunci, nama, tanggal, hal, ket = "") => {
    if (jejak.jalur && jejak.jalur.length) jalurPerKunci[kunci] = jejak.jalur;
    jejak.jalur = null;
    baris.push({ bundel, grup, kunci, nama, ket, tanggal: iso(tanggal), ...hal });
  };
  const bawaan = (jenis, dasar = "belum ada berkas: nilai bawaan jenis dokumen") => ({ halaman: null, sumber: "perkiraan", dasar, jenisBawaan: jenis });

  const G1 = "I. PENDAFTARAN";
  const G2 = "II. PENETAPAN AWAL";
  const G3 = "III. PEMERIKSAAN DI PERSIDANGAN";
  const G4 = "IV. PUTUSAN / PENETAPAN";
  const GP = "V. PASCA PUTUSAN";
  const ecJenis = (j) => ec.filter((x) => x.jenis === j);
  const dariEc = (j, bawaanJenis) => {
    const daftar = ecJenis(j);
    jejak.jalur = daftar.filter((x) => x.jalurMutlak && x.ada !== false).map((x) => x.jalurMutlak);
    const terbaca = daftar.filter((x) => x.halaman);
    if (daftar.length && terbaca.length === daftar.length) {
      const ragu = terbaca.some((x) => x.ragu);
      return { halaman: terbaca.reduce((a, x) => a + x.halaman, 0), sumber: ragu ? "perkiraan" : "pasti", dasar: `arsip e-Court: ${daftar.length} berkas` };
    }
    return bawaan(bawaanJenis, daftar.length ? "arsip e-Court ada, halaman belum terbaca" : "tidak ada di arsip e-Court");
  };

  // I. Pendaftaran
  const gugatan = ecJenis("gugatan").length ? "gugatan" : ecJenis("permohonan").length ? "permohonan" : permohonan ? "permohonan" : "gugatan";
  tambah("A", G1, "gugatan", `Surat ${permohonan ? "Permohonan" : "Gugatan"} ${sebP}`, p.tanggal_surat, dariEc(gugatan, permohonan ? "permohonan" : "gugatan"));
  if (Number(p.prodeo) === 1) {
    tambah("A", G1, "sktm", "Surat Keterangan Tidak Mampu (SKTM)", p.tanggal_surat, bawaan("sktm"));
    tambah("A", G1, "prodeo", "Surat Permohonan Prodeo", p.tanggal_surat, bawaan("sktm"));
  }
  const kuasaP = pengacara.find((x) => nomorBaris(x.pihak_ke) === 1);
  const kuasaT = pengacara.find((x) => nomorBaris(x.pihak_ke) === 2);
  if (kuasaP) tambah("A", G1, "kuasa_p", `Surat Kuasa Khusus ${sebP}`, kuasaP.tanggal_kuasa, ecJenis("kuasa").length ? dariEc("kuasa", "kuasa") : bawaan("kuasa"));
  if (kuasaT) tambah("A", G1, "kuasa_t", `Surat Kuasa Khusus ${sebT}`, kuasaT.tanggal_kuasa, bawaan("kuasa"));
  tambah("A", G1, "skum", "Surat Kuasa Untuk Membayar", p.tanggal_pendaftaran, bawaan("skum"));
  if (Number(p.prodeo) !== 1) tambah("A", G1, "slip", "Slip Setoran Panjar Biaya Perkara", p.tanggal_pendaftaran, bawaan("slip"));

  // II. Penetapan awal
  const penetapan = [
    ["pmh", "Penetapan Majelis Hakim / Hakim Tunggal", pen && pen.penetapan_majelis_hakim, "PMH", "penetapan"],
    ["pp", "Penunjukan Panitera Pengganti", pen && pen.penetapan_panitera_pengganti, "PPP", "penetapan"],
    ["js", "Penunjukan Jurusita / Jurusita Pengganti", pen && pen.penetapan_jurusita, "PJS", "penetapan"],
    ["phs", "Penetapan Hari Sidang (PHS)", pen && pen.penetapan_hari_sidang, "PHS", "phs"],
  ];
  for (const [kunci, nama, tgl, token, jenis] of penetapan) {
    if (!tgl) continue;
    const h = await halamanBaris(berkasPenetapan[token], jenis, { ...deps, jenisBawaan: jenis });
    tambah("A", G2, kunci, nama, tgl, h.halaman ? h : { ...h, halaman: null, jenisBawaan: jenis });
  }

  // III. Persidangan (nomor sidang = urutan tanggal tanpa sidang ikrar)
  const nomorSidang = new Map();
  sidang.forEach((s, i) => nomorSidang.set(Number(s.id), i + 1));
  const tersaji = [];
  for (const r of relaas) {
    const n = nomorSidang.get(Number(r.sidang_id));
    if (!n) continue;
    const sisi = r.sisi1 ? 1 : r.sisi2 ? 2 : 0;
    if (!sisi) continue;
    tersaji.push({ n, sisi, r });
  }
  tersaji.sort((a, b) => a.n - b.n || a.sisi - b.sisi);
  const kunciPakai = new Set();
  const kunciUnik = (dasar) => {
    let k = dasar;
    for (let i = 2; kunciPakai.has(k); i += 1) k = `${dasar}-${i}`;
    kunciPakai.add(k);
    return k;
  };
  for (const { n, sisi, r } of tersaji) {
    const e = String(r.ket_temu || "") === "E";
    const sebut = sisi === 1 ? sebP : sebT;
    const hal = await halamanBaris(r.doc_relaas, "relaas", deps);
    tambah("A", G3, kunciUnik(`${e ? "esummons" : "relaas"}:${n}:${sisi === 1 ? "p" : "t"}`), `${e ? "Panggilan e-Summons" : "Relaas Panggilan"} ${sebut} ke ${n}`, r.tanggal_relaas, hal.halaman ? hal : bawaan("relaas", hal.dasar), e ? "lewat e-Court" : "");
    const berkasResi = String(r.doc_resi || "").startsWith("resources/");
    if (berkasResi || String(r.no_resi_pos || "").trim()) {
      const hr = berkasResi ? await halamanBaris(r.doc_resi, "resi", deps) : bawaan("resi", "nomor resi tercatat, berkas resi belum ada");
      tambah("A", G3, kunciUnik(`resi:${n}:${sisi === 1 ? "p" : "t"}`), `Bukti Surat Tercatat ${sebut} ke ${n}`, r.tanggal_relaas, hr.halaman ? hr : bawaan("resi", hr.dasar), "nomor resi tercantum");
    }
  }
  if (med && med.penetapan_penunjukan_mediator) tambah("A", G3, "mediator", "Penetapan Penunjukan Mediator", med.penetapan_penunjukan_mediator, bawaan("mediator"));
  if (med && med.tgl_laporan_mediator) tambah("A", G3, "laporan_mediasi", "Laporan Hasil Mediasi", med.tgl_laporan_mediator, bawaan("laporan-mediasi"));
  for (const s of sidang) {
    const n = nomorSidang.get(Number(s.id));
    if (iso(s.tanggal_sidang) > hariIni && !s.edoc_bas) continue;
    const hal = await halamanBaris(s.edoc_bas, "bas", deps);
    tambah("A", G3, `bas:${n}`, `Berita Acara Sidang ${URUT[Math.min(n, 9)]}`, s.tanggal_sidang, hal.halaman ? hal : bawaan("bas", hal.dasar), String(s.sidang_keliling) === "Y" ? "sidang keliling" : "");
  }
  for (const j of ["jawaban", "replik", "duplik", "kesimpulan"]) {
    if (!ecJenis(j).length) continue;
    tambah("A", G3, `ec_${j}`, `${NAMA_JENIS_ECOURT[j]} ${j === "kesimpulan" ? sebP : sebT}`, "", dariEc(j, j));
  }
  if (ecJenis("bukti").length) tambah("A", G3, "ec_bukti", "Daftar Bukti Surat", "", dariEc("bukti", "bukti"));
  const keTanggalPutus = put && put.tanggal_putusan;
  // Ikrar talak
  if (ikrar) {
    const GI = "IV. IKRAR TALAK";
    if (ikrar.penetapan_majelis_hakim) tambah("A", GI, "ikrar_pmh", "Penetapan Majelis Hakim Sidang Ikrar Talak", ikrar.penetapan_majelis_hakim, bawaan("penetapan"));
    if (ikrar.tanggal_penetapan_sidang_ikrar) tambah("A", GI, "ikrar_phs", "Penetapan Hari Sidang Ikrar Talak", ikrar.tanggal_penetapan_sidang_ikrar, bawaan("phs"));
    if (ikrar.tgl_ikrar_talak) {
      const hi = await halamanBaris(ikrar.ikrar_talak_dok, "ikrar", deps);
      tambah("A", GI, "ikrar_bas", "Berita Acara / Penetapan Sidang Ikrar Talak", ikrar.tgl_ikrar_talak, hi.halaman ? hi : bawaan("ikrar", hi.dasar));
    }
  }
  // IV. Putusan
  if (keTanggalPutus) {
    const batal = alur === 16 || [7, 37, 67].includes(nomorBaris(put.status_putusan_id));
    const hp = await halamanBaris(put.amar_putusan_dok, "putusan", deps);
    const jalurPutusan = jejak.jalur;
    tambah("A", ikrar ? "V. PUTUSAN / PENETAPAN" : G4, "putusan", batal ? "Penetapan" : "Putusan", put.tanggal_putusan, hp.halaman ? hp : bawaan("putusan", hp.dasar === "tidak ada berkas" ? "berkas putusan belum ada" : "putusan RTF: halaman dihitung dari PDF buatan panel saat cetak"));
    jejak.jalur = jalurPutusan;
    tambah("A", GP, "salinan", `Salinan ${batal ? "Penetapan" : "Putusan"}`, put.tanggal_putusan, hp.halaman ? hp : bawaan("putusan", "mengikuti halaman putusan"));
  }
  // Bundel B: pasca putusan
  let nb = 0;
  for (const w of pbt) {
    nb += 1;
    const h = await halamanBaris(w.edoc_pbt, "pemberitahuan", deps);
    tambah("A", GP, `pbt:${nb}`, `Relaas Pemberitahuan Isi ${permohonan && !put ? "Penetapan" : "Putusan"}${pbt.length > 1 ? ` ${nb}` : ""}`, w.tanggal_pemberitahuan_putusan, h.halaman ? h : bawaan("pemberitahuan", h.dasar));
    if (String(w.edoc_resi || "").startsWith("resources/") || String(w.no_resi_pos || "").trim()) {
      const hr = String(w.edoc_resi || "").startsWith("resources/") ? await halamanBaris(w.edoc_resi, "resi", deps) : bawaan("resi", "nomor resi tercatat, berkas resi belum ada");
      tambah("A", GP, `pbt_resi:${nb}`, `Bukti Surat Tercatat Pemberitahuan Putusan${pbt.length > 1 ? ` ${nb}` : ""}`, w.tanggal_pemberitahuan_putusan, hr.halaman ? hr : bawaan("resi", hr.dasar));
    }
  }
  if (put && put.tanggal_minutasi) tambah("A", GP, "minutasi", "Penetapan Minutasi", put.tanggal_minutasi, bawaan("minutasi"));
  if (put && put.tanggal_bht) tambah("A", GP, "bht", "Akta Pernyataan Berkekuatan Hukum Tetap (BHT)", put.tanggal_bht, bawaan("bht"));
  if (akta && akta.tgl_akta_cerai) {
    const ha = await halamanBaris(akta.akta_cerai_dok, "akta-cerai", deps);
    tambah("A", GP, "akta_cerai", `Akta Cerai Nomor ${akta.nomor_akta_cerai || "-"}`, akta.tgl_akta_cerai, ha.halaman ? ha : bawaan("akta-cerai", ha.dasar));
    if (akta.tgl_penyerahan_akta_cerai) tambah("A", GP, "tt_p", `Tanda Terima Akta Cerai ${sebP}`, akta.tgl_penyerahan_akta_cerai, bawaan("lain"));
    if (akta.tgl_penyerahan_akta_cerai_pihak2) tambah("A", GP, "tt_t", `Tanda Terima Akta Cerai ${sebT}`, akta.tgl_penyerahan_akta_cerai_pihak2, bawaan("lain"));
  }

  // ---- ciri otomatis
  const nyala = (k, sisi = "") => ({ nyala: true, sisi });
  const ciri = {};
  const set = (k, ya, sisi = "") => {
    if (ya) ciri[k] = nyala(k, sisi);
  };
  set("prodeo", Number(p.prodeo) === 1);
  set("ecourt", ecourtAda);
  set("kuasa", pengacara.length > 0, kuasaP && kuasaT ? "P+T" : kuasaP ? "P" : "T");
  set("verstek", put && String(put.putusan_verstek) === "Y");
  set("keliling", jadwal.some((j) => String(j.sidang_keliling) === "Y"));
  set("verzet", jadwal.some((j) => String(j.verzet) === "Y"));
  set("mediasi", Boolean(med && med.penetapan_penunjukan_mediator));
  set("dispensasi", jenisId === 362);
  set("sederhana", alur === 17);
  set("ikrar", Boolean(ikrar));
  set("mafqud", /mafqud|orang yang hilang|hilang tanpa kabar/.test(petitumTeks));
  const hakim = await aman("SELECT hakim_nama, urutan FROM perkara_hakim_pn WHERE perkara_id = ? AND aktif = 'Y' ORDER BY urutan", [perkaraId]);
  set("tunggal", hakim.length === 1);
  const sisiPihak = await aman(
    "SELECT 1 AS sisi, h.difabel, h.warga_negara_id, h.pekerjaan FROM perkara_pihak1 k JOIN pihak h ON h.id = k.pihak_id WHERE k.perkara_id = ? UNION ALL SELECT 2, h.difabel, h.warga_negara_id, h.pekerjaan FROM perkara_pihak2 k JOIN pihak h ON h.id = k.pihak_id WHERE k.perkara_id = ?",
    [perkaraId, perkaraId]
  );
  const sisiTeks = (daftar) => (daftar.includes(1) && daftar.includes(2) ? "P+T" : daftar.includes(1) ? "P" : daftar.includes(2) ? "T" : "");
  const dif = sisiPihak.filter((x) => String(x.difabel) === "Y").map((x) => Number(x.sisi));
  set("disabilitas", dif.length > 0, sisiTeks(dif));
  const asing = sisiPihak.filter((x) => x.warga_negara_id != null && Number(x.warga_negara_id) !== 98).map((x) => Number(x.sisi));
  set("wna", asing.length > 0, sisiTeks(asing));
  // penanda ALETA (ghaib, pekerjaan) dan kumulasi: layanan yang sama dengan lencana Jadwal Sidang dan Status Perkara
  let pekerjaanTerbaca = false;
  let izinCeraiKeadaan = "";
  try {
    const penanda = deps.penanda || require("./penandaPerkaraPihakService");
    const bahan = await penanda.bahanPenanda([perkaraId], deps.penandaDeps || {});
    const ruas = penanda.ruasBaris(bahan, perkaraId);
    set("ghaib", ruas.penandaPerkara.ghaib, ruas.penandaPerkara.ghaib ? "T" : "");
    set("prodeo", ruas.penandaPerkara.prodeo);
    const sisiKunci = {};
    for (const pp of ruas.penandaPihak || []) {
      const k = { PNS: "pns", PPPK: "pppk", POLRI: "polri", TNI: "tni", BUMN: "bumn", BUMD: "bumn" }[String(pp.kunci)];
      if (!k) continue;
      (sisiKunci[k] = sisiKunci[k] || []).push(Number(pp.sisi) === 1 ? 1 : 2);
    }
    for (const [k, daftar] of Object.entries(sisiKunci)) ciri[k] = { nyala: true, sisi: sisiTeks(daftar) };
    pekerjaanTerbaca = Boolean(bahan.terbaca && bahan.terbaca.pekerjaan);
    izinCeraiKeadaan = ruas.izinCerai && ruas.izinCerai.keadaan ? String(ruas.izinCerai.keadaan) : "";
  } catch {
    pekerjaanTerbaca = false;
  }
  try {
    const kum = deps.kumulasi || require("./kumulasiPerkaraService");
    const peta = await kum.kumulasiBanyakPerkara([perkaraId], deps.kumulasiDeps || {});
    const ent = peta && (peta[perkaraId] || peta[String(perkaraId)] || (peta instanceof Map ? peta.get(perkaraId) || peta.get(String(perkaraId)) : null));
    const daftar = ent && Array.isArray(ent.daftar) ? ent.daftar : [];
    if (daftar.length) ciri.kumulasi = { nyala: true, sisi: String(daftar.length), nama: daftar.map((x) => x.nama) };
  } catch {
    /* kumulasi tak terbaca: tidak menyala */
  }

  // ---- pihak, majelis, tanggal, riwayat sidang
  const pihak = {};
  for (const sisi of [1, 2]) {
    const [r] = await aman(
      `SELECT k.nama, h.pekerjaan, k.alamat FROM perkara_pihak${sisi} k JOIN pihak h ON h.id = k.pihak_id WHERE k.perkara_id = ? ORDER BY k.urutan LIMIT 1`,
      [perkaraId]
    );
    if (r) pihak[sisi === 1 ? "p" : "t"] = { nama: String(r.nama || ""), pekerjaan: String(r.pekerjaan || ""), alamat: String(r.alamat || "") };
  }
  // pihak ke-2 = PERINGKAT kedua (urut urutan, id), bukan nilai urutan 2: pendaftaran e-Court menomori urutan bersambung lintas tabel
  const [pihakDua] = await aman("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan, id LIMIT 1 OFFSET 1", [perkaraId]);
  if (pihakDua) pihak.p2 = { nama: String(pihakDua.nama || "") };
  const [pp] = await aman("SELECT panitera_nama FROM perkara_panitera_pn WHERE perkara_id = ? AND aktif = 'Y' ORDER BY tanggal_penetapan DESC LIMIT 1", [perkaraId]);
  const [js] = await aman("SELECT j.nama_gelar AS nama FROM perkara_jurusita a JOIN jurusita j ON j.id = a.jurusita_id WHERE a.perkara_id = ? AND a.aktif = 'Y' ORDER BY a.id LIMIT 1", [perkaraId]);
  const majelis = {
    ketua: hakim[0] ? String(hakim[0].hakim_nama || "") : "",
    anggota1: hakim[1] ? String(hakim[1].hakim_nama || "") : "",
    anggota2: hakim[2] ? String(hakim[2].hakim_nama || "") : "",
    pp: pp ? String(pp.panitera_nama || "") : "",
    js: js ? String(js.nama || "") : "",
  };
  const riwayat = sidang.slice(0, 20).map((s, i) => ({
    ke: i + 1,
    tanggal: iso(s.tanggal_sidang),
    hadir: HADIR[Number(s.dihadiri_oleh)] || "",
    agenda: String(s.agenda || ""),
    alasan: String(s.alasan_ditunda || ""),
    keliling: String(s.sidang_keliling) === "Y",
  }));
  // ---- Bundel B hanya untuk upaya hukum (banding, kasasi, peninjauan kembali): satu baris per tahapan yang TERCATAT tanggalnya di SIPP
  const UPAYA = [
    ["perkara_banding", "UPAYA HUKUM - BANDING", [["permohonan_banding", "Akta Permohonan Banding"], ["pemberitahuan_permohonan_banding", "Relaas Pemberitahuan Permohonan Banding"], ["penerimaan_memori_banding", "Memori Banding"], ["penerimaan_kontra_banding", "Kontra Memori Banding"], ["pemberitahuan_inzage", "Relaas Pemberitahuan Inzage"], ["pengiriman_berkas_banding", "Pengiriman Berkas Banding"], ["putusan_banding", "Putusan Banding"], ["pemberitahuan_putusan_banding", "Relaas Pemberitahuan Putusan Banding"], ["tgl_minutasi", "Minutasi Banding"]]],
    ["perkara_kasasi", "UPAYA HUKUM - KASASI", [["permohonan_kasasi", "Akta Permohonan Kasasi"], ["pemberitahuan_kasasi", "Relaas Pemberitahuan Permohonan Kasasi"], ["penerimaan_memori_kasasi", "Memori Kasasi"], ["penerimaan_kontra_kasasi", "Kontra Memori Kasasi"], ["pemberitahuan_inzage_kasasi", "Relaas Pemberitahuan Inzage"], ["pengiriman_berkas_kasasi", "Pengiriman Berkas Kasasi"], ["putusan_kasasi", "Putusan Kasasi"], ["pemberitahuan_putusan_kasasi", "Relaas Pemberitahuan Putusan Kasasi"], ["minutasi_kasasi", "Minutasi Kasasi"]]],
    ["perkara_pk", "UPAYA HUKUM - PENINJAUAN KEMBALI", [["permohonan_pk", "Akta Permohonan Peninjauan Kembali"], ["pemberitahuan_pk", "Relaas Pemberitahuan Permohonan PK"], ["penerimaan_memori_pk", "Memori PK"], ["penerimaan_kontra_pk", "Kontra Memori PK"], ["pengiriman_berkas_pk", "Pengiriman Berkas PK"], ["putusan_pk", "Putusan PK"]]],
  ];
  let upayaHukum = false;
  for (const [tabel, judulGrup, kolom] of UPAYA) {
    const [r] = await aman(`SELECT * FROM ${tabel} WHERE perkara_id = ? LIMIT 1`, [perkaraId]);
    if (!r) continue;
    upayaHukum = true;
    for (const [k, nama] of kolom) if (iso(r[k])) tambah("B", judulGrup, `${tabel}:${k}`, nama, r[k], bawaan("lain", "tahapan tercatat di SIPP; berkas belum dibaca"));
    if (!kolom.some(([k]) => iso(r[k]))) tambah("B", judulGrup, `${tabel}:daftar`, `Pendaftaran ${judulGrup.replace("UPAYA HUKUM - ", "").toLowerCase()}`, "", bawaan("lain"));
  }

  // ---- ciri susulan otomatis (baca saja; satu sumber dengan penanda lain: konseptorKeadaanService, penandaJawabanService lewat e-Court)
  const gagalSusulan = [];
  const cobaS = async (nama, kerja, cadangan) => {
    try {
      return await kerja();
    } catch (e) {
      gagalSusulan.push(nama);
      return cadangan;
    }
  };
  const kk = await cobaS(
    "konseptorKeadaan",
    async () => {
      const layanan = deps.keadaan || require("./konseptorKeadaanService");
      const h = await layanan.keadaanBanyak([perkaraId]);
      for (const g of (h && h.gagal) || []) gagalSusulan.push(String(g.bagian));
      return (h && h.perkara && h.perkara[String(perkaraId)]) || {};
    },
    {}
  );
  const prosesNama = (await cobaS("proses", () => q("SELECT proses_nama FROM perkara_proses WHERE perkara_id = ?", [perkaraId]), [])).map((x) => String(x.proses_nama || ""));
  const biaya = await cobaS("biaya", () => q("SELECT kategori_id, uraian, keterangan FROM perkara_biaya WHERE perkara_id = ? AND jenis_transaksi = 1 AND tahapan_id = 10", [perkaraId]), []);
  const setempatBiaya = (await cobaS("setempat", () => q("SELECT 1 AS x FROM perkara_biaya WHERE perkara_id = ? AND kategori_id = 7 LIMIT 1", [perkaraId]), [])).length > 0;
  const tambahanPanjar = biaya.some((x) => Number(x.kategori_id) === 1 && /tambah/i.test(`${x.uraian || ""} ${x.keterangan || ""}`));
  const susulanOto = deteksiSusulan({
    petitum: petitumTeks,
    agenda: jadwal.map((j) => j.agenda),
    proses: prosesNama,
    statusPutusanId: put && put.status_putusan_id,
    mediasi: Boolean(med && med.penetapan_penunjukan_mediator),
    eksepsi: Boolean(kk.eksepsi),
    rekonvensi: Boolean(kk.rekonvensi),
    sela: Boolean(kk.sela),
    setempatBiaya,
    tambahanPanjar,
    namaEcourt: ec.semuaNama || [],
  });

  // ---- alasan/tuntutan pokok (catatan sampul)
  const alasanSipp = (await aman("SELECT nama FROM perkara_alasan_nikah WHERE perkara_id = ?", [perkaraId])).map((x) => String(x.nama || ""));
  const [itsbatRow] = kunciJenis === "in" ? await aman("SELECT tgl_menikah FROM perkara_data_itsbat WHERE perkara_id = ?", [perkaraId]) : [];
  let alasanOto = {};
  let alasanGagal = false;
  try {
    alasanOto = deteksiAlasan(
      { jenis: kunciJenis, posita: p.posita, petitum: p.petitum, alasanSipp, tanggalNikah: iso(itsbatRow && itsbatRow.tgl_menikah), sita: Boolean(susulanOto.sita) },
      deps
    );
  } catch {
    alasanGagal = true;
  }

  // ---- seluruh pihak (sampul memakai pihak I + sampai muat per sisi; sisanya lampiran daftar para pihak, disusun portal)
  const pihakSemua = (
    await aman(
      "SELECT 1 AS sisi, urutan, nama, alamat FROM perkara_pihak1 WHERE perkara_id = ? UNION ALL SELECT 2, urutan, nama, alamat FROM perkara_pihak2 WHERE perkara_id = ? " +
        "UNION ALL SELECT 3, urutan, nama, alamat FROM perkara_pihak3 WHERE perkara_id = ? UNION ALL SELECT 4, urutan, nama, alamat FROM perkara_pihak4 WHERE perkara_id = ? ORDER BY sisi, urutan",
      [perkaraId, perkaraId, perkaraId, perkaraId]
    )
  )
    .slice(0, 500)
    .map((x) => ({ sisi: Number(x.sisi), urutan: Number(x.urutan) || 0, nama: String(x.nama || "").trim(), alamat: String(x.alamat || "").trim() }))
    .filter((x) => x.nama);
  const jumlahPihak = { p1: 0, p2: 0, p3: 0, p4: 0 };
  for (const x of pihakSemua) jumlahPihak[`p${x.sisi}`] += 1;
  const berlawananNomor = /\/Pdt\.G/i.test(String(p.nomor_perkara || ""));
  const sebutanP = berlawananNomor && jenisId !== 346 ? "Penggugat" : "Pemohon";
  const sebutanT = berlawananNomor && jenisId !== 346 ? "Tergugat" : "Termohon";

  // ---- anak (tab Anak SIPP; diasuh_oleh 1 = pihak I, 2 = pihak II, selebihnya tidak ditebak), objek sengketa (teks bebas SIPP), seluruh sidang
  const anak = (await aman("SELECT nama_anak, tanggal_lahir, diasuh_oleh FROM perkara_anak_pihak WHERE perkara_id = ? AND nama_anak IS NOT NULL AND TRIM(nama_anak) <> '' ORDER BY anak_ke, id", [perkaraId]))
    .slice(0, 60)
    .map((x) => ({ nama: String(x.nama_anak).trim(), umur: umurPenuh(iso(x.tanggal_lahir)), diasuh: Number(x.diasuh_oleh) === 1 ? "P" : Number(x.diasuh_oleh) === 2 ? "T" : "" }));
  const [objekBaris] = await aman("SELECT obyek_gugatan FROM perkara_obyek_sengketa WHERE perkara_id = ?", [perkaraId]);
  // objek sengketa hanya bermakna untuk perkara harta (kewarisan, harta bersama, ekonomi syariah) atau bila ada kumulasi harta/permintaan sita; untuk selebihnya isiannya
  // kategori perkara ("Pernikahan/Perceraian"), bukan benda.
  const objekBermakna = ["waris", "hb", "es", "paw"].includes(kunciJenis) || Boolean(ciri.kumulasi) || Boolean(susulanOto.sita);
  const objek = objekBermakna ? uraiObjek(objekBaris && objekBaris.obyek_gugatan).slice(0, 80) : [];
  const riwayatSemua = sidang.slice(0, 200).map((x, i) => ({
    ke: i + 1,
    tanggal: iso(x.tanggal_sidang),
    hadir: HADIR[Number(x.dihadiri_oleh)] || "",
    agenda: String(x.agenda || ""),
    alasan: String(x.alasan_ditunda || ""),
  }));

  // ---- ceklist berkas Meja I (pasangan sampul cetak awal): fakta mentah; PORTAL yang menyusun daftar dan menentukan ada / belum ada / diperiksa petugas
  const judulEcourtBot = await cobaS(
    "judul e-Court",
    async () => {
      const botDb = deps.botDb || require("./botDbService");
      const baris = await botDb.query("SELECT judul_dokumen FROM aleta_bot_ecourt_documents WHERE perkara_id = ? OR nomor_perkara = ? LIMIT 300", [String(perkaraId), String(p.nomor_perkara || "")]);
      return (Array.isArray(baris) ? baris : []).map((x) => String(x.judul_dokumen || "")).filter(Boolean);
    },
    []
  );
  const panjarMasuk = biaya.filter((x) => Number(x.kategori_id) === 1);
  const [jumlahPanjar] = await aman("SELECT SUM(jumlah) AS total, MIN(tanggal_transaksi) AS tgl FROM perkara_biaya WHERE perkara_id = ? AND kategori_id = 1 AND jenis_transaksi = 1", [perkaraId]);
  const ceklist = {
    keadaan: {
      phs: Boolean(pen && pen.penetapan_hari_sidang),
      kuasa: pengacara.length > 0,
      prodeo: Boolean(ciri.prodeo),
      ghaib: Boolean(ciri.ghaib),
      ecourt: Boolean(ciri.ecourt),
      anak: anak.length > 0 || /hak\s+asuh|hadhanah|hadlanah|nafkah\s+anak/i.test(petitumTeks),
      tanggalDaftar: iso(p.tanggal_pendaftaran),
    },
    penetapan: { pmh: iso(pen && pen.penetapan_majelis_hakim), ppp: iso(pen && pen.penetapan_panitera_pengganti), pjs: iso(pen && pen.penetapan_jurusita), phs: iso(pen && pen.penetapan_hari_sidang) },
    ppNama: pen ? String(pen.panitera_pengganti_text || "").trim() : "",
    kasir: { jumlah: jumlahPanjar && jumlahPanjar.total ? Number(jumlahPanjar.total) : 0, tanggal: jumlahPanjar ? iso(jumlahPanjar.tgl) : "", baris: panjarMasuk.length },
    izinCerai: izinCeraiKeadaan,
    judulDokumen: [...new Set([...(ec.semuaNama || []).map((x) => x.replace(/__[0-9a-f]{6,}(\.[A-Za-z0-9]+)?$/, "")), ...judulEcourtBot])].slice(0, 300),
    tertulisDokumen: [...(ec.semuaNama || []), ...judulEcourtBot].length > 0,
  };

  const isian = {
    mediator: med ? String(med.mediator_text || "") : "",
    hasilmed: med ? (med.mediasi_berhasil ? "Berhasil" : med.mediasi_gagal ? "Tidak berhasil" : "") : "",
    tglmed: med ? iso(med.penetapan_penunjukan_mediator) : "",
    tgllap: med ? iso(med.tgl_laporan_mediator) : "",
    tglputus: put ? iso(put.tanggal_putusan) : "",
    tglminutasi: put ? iso(put.tanggal_minutasi) : "",
    tglpbt: pbt.length ? iso(pbt[pbt.length - 1].tanggal_pemberitahuan_putusan) : "",
    tglbht: put ? iso(put.tanggal_bht) : "",
    pekerjaanT: pihak.t ? pihak.t.pekerjaan : "",
    kuasaT: kuasaT ? String(kuasaT.nama || "") : "",
    konseptor: await konseptorSipp(aman, perkaraId),
    ...(await isianKhas(kunciJenis, perkaraId, { q: aman, pihak, p })),
  };

  return {
    ok: true,
    perkara: {
      perkaraId,
      nomor: String(p.nomor_perkara || ""),
      jenisId,
      jenisNama: String(p.jenis_perkara_nama || ""),
      jenis: kunciJenis,
      permohonan,
      berlawanan: berlawananNomor,
      sebutanP,
      sebutanT,
      tanggalDaftar: iso(p.tanggal_pendaftaran),
    },
    upayaHukum,
    pihakSemua,
    jumlahPihak,
    anak,
    objek,
    riwayatSemua,
    jumlahSidang: sidang.length,
    ciri,
    ceklist,
    susulan: { oto: susulanOto, gagal: [...new Set(gagalSusulan)] },
    alasan: { oto: alasanOto, gagal: alasanGagal },
    pekerjaanTerbaca,
    pihak,
    majelis,
    riwayat,
    isian,
    dokumen: baris,
    ...(params.denganJalur === true ? { jalurPerKunci } : {}),
    ecourtBerkas: ec.length,
    pdfLib: Boolean(pdfLib()),
  };
}

// ---------------------------------------------------------------------------
// Bundel satu PDF per perkara (5.1, 30 Okt 2026): bahan berkas tiap baris daftar isi - BACA SAJA
// ---------------------------------------------------------------------------
const cacheJalur = new Map(); // perkaraId -> { saat, peta: kunci -> [jalur mutlak] }
const MASA_JALUR_MS = 3 * 60 * 1000;
const BATAS_BUNDEL_BYTE = 24 * 1024 * 1024;

async function petaJalur(perkaraId, deps = {}) {
  const kini = Date.now();
  const ada = cacheJalur.get(perkaraId);
  if (ada && kini - ada.saat < MASA_JALUR_MS && !deps.tanpaCache) return ada.peta;
  const f = await fakta({ perkaraId, denganJalur: true }, deps);
  if (!f || !f.ok) return null;
  if (cacheJalur.size >= 40) cacheJalur.clear();
  cacheJalur.set(perkaraId, { saat: kini, peta: f.jalurPerKunci || {} });
  return f.jalurPerKunci || {};
}

/**
 * berkas.bundel { perkaraId, kunci:[...], mode } -> bahan berkas baris daftar isi untuk bundel satu PDF.
 *   mode "periksa": per kunci { berkas, pdf, bukanPdf, halaman (jumlah PDF bila SEMUA terbaca, selain itu null), ragu }
 *   mode "isi":     per kunci PDF-nya (base64, urut jalur); berkas bukan PDF (RTF, DOC, DOCX) tidak ikut dan dihitung di bukanPdf
 * Jalur berkas tidak pernah dikembalikan; kunci tak dikenal dijawab kosong. SIPP dan arsip hanya dibaca.
 */
async function bundelBahan(params = {}, deps = {}) {
  const perkaraId = Number(params.perkaraId);
  if (!Number.isFinite(perkaraId) || perkaraId <= 0) return { ok: false, sebab: "Perkara tidak disebut." };
  const kunci = (Array.isArray(params.kunci) ? params.kunci : []).map((k) => String(k)).filter((k) => /^[A-Za-z0-9_:.\-]{1,60}$/.test(k)).slice(0, 300);
  const peta = await petaJalur(perkaraId, deps);
  if (!peta) return { ok: false, sebab: "Berkas perkara tidak terbaca dari SIPP." };
  const fsp = (deps.fs || fs).promises;
  if (params.mode === "isi") {
    let total = 0;
    const berkas = [];
    const bukanPdf = {};
    for (const k of kunci) {
      for (const jalur of peta[k] || []) {
        if (path.extname(jalur).toLowerCase() !== ".pdf") {
          bukanPdf[k] = (bukanPdf[k] || 0) + 1;
          continue;
        }
        const st = await fsp.stat(jalur).catch(() => null);
        if (!st || !st.isFile()) continue;
        total += st.size;
        if (total > BATAS_BUNDEL_BYTE) return { ok: false, sebab: "Berkas satu kali ambil terlalu besar; ambil lebih sedikit baris sekaligus." };
        berkas.push({ kunci: k, base64: (await fsp.readFile(jalur)).toString("base64") });
      }
    }
    return { ok: true, berkas, bukanPdf };
  }
  const dokumen = [];
  for (const k of kunci) {
    let pdf = 0;
    let bukanPdf = 0;
    let halaman = 0;
    let semuaTerbaca = true;
    let ragu = false;
    for (const jalur of peta[k] || []) {
      if (path.extname(jalur).toLowerCase() !== ".pdf") {
        bukanPdf += 1;
        continue;
      }
      pdf += 1;
      const h = await halamanBerkas(jalur, deps);
      if (h.halaman) {
        halaman += h.halaman;
        if (h.ragu) ragu = true;
      } else semuaTerbaca = false;
    }
    dokumen.push({ kunci: k, berkas: pdf + bukanPdf, pdf, bukanPdf, halaman: pdf > 0 && semuaTerbaca && halaman > 0 ? halaman : null, ragu });
  }
  return { ok: true, dokumen };
}

/** Konseptor putusan yang sudah tercatat di SIPP: pengguna tahapan putusan (perkara_proses proses_id 210) terbaru, nama dari sys_users. "" bila belum ada. */
async function konseptorSipp(aman, perkaraId) {
  const [r] = await aman(
    "SELECT pr.diinput_oleh AS oleh, (SELECT u.fullname FROM sys_users u WHERE BINARY u.username = BINARY pr.diinput_oleh LIMIT 1) AS nama " +
      "FROM perkara_proses pr WHERE pr.perkara_id = ? AND pr.proses_id = 210 ORDER BY pr.diinput_tanggal DESC LIMIT 1",
    [perkaraId]
  );
  return r ? String(r.nama || r.oleh || "").trim() : "";
}

/** Isian khas jenis perkara dari SIPP (kunci b1.. sesuai JENIS di ekstensi). Yang tidak terbaca dibiarkan kosong (diisi tangan). */
async function isianKhas(jenis, perkaraId, { q, pihak, p }) {
  const hasil = {};
  const alasan = async () => (await q("SELECT nama FROM perkara_alasan_nikah WHERE perkara_id = ?", [perkaraId])).map((x) => String(x.nama || "")).filter(Boolean).join("; ");
  if (jenis === "in") {
    const [i] = await q("SELECT tgl_menikah, tempat_menikah FROM perkara_data_itsbat WHERE perkara_id = ?", [perkaraId]);
    if (i) {
      hasil.b1 = tglIndonesia(i.tgl_menikah);
      hasil.b2 = String(i.tempat_menikah || "");
    }
    hasil.b3 = await alasan();
    const nama = (await q("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan, id LIMIT 2", [perkaraId])).map((x) => String(x.nama || ""));
    hasil.fokus = nama.join(" dan ");
  } else if (jenis === "dk") {
    hasil.b3 = await alasan();
    const abt = String(process.env.ALETA_BOT_ABT_DB_NAME || "aps_badilag");
    try {
      const baris = await q(`SELECT no_var, data FROM ${abt.replace(/[^A-Za-z0-9_]/g, "")}.abt_data_teks WHERE perkara_id = ? AND no_var IN (600, 601, 606, 607)`, [perkaraId]);
      const v = Object.fromEntries(baris.map((x) => [Number(x.no_var), String(x.data || "")]));
      const umurP = Number(v[601]);
      const anakPria = (Number.isFinite(umurP) && umurP > 0 && umurP < 19) || !v[606];
      hasil.fokus = anakPria ? v[600] || "" : v[606] || "";
      hasil.b1 = anakPria ? v[606] || "" : v[600] || "";
    } catch {
      /* isian ABT tak terbaca: diisi tangan */
    }
  } else if (jenis === "aua") {
    const [a] = await q("SELECT nama_anak, tanggal_lahir, tempat_lahir FROM perkara_anak_pihak WHERE perkara_id = ? ORDER BY id LIMIT 1", [perkaraId]);
    if (a) {
      hasil.fokus = String(a.nama_anak || "");
      hasil.b1 = tglIndonesia(a.tanggal_lahir);
      hasil.b2 = String(a.tempat_lahir || "");
    }
  } else if (jenis === "es") {
    hasil.b3 = p && p.nilai_sengketa ? `Rp ${Number(p.nilai_sengketa).toLocaleString("id-ID")}` : "";
  } else if (jenis === "poligami" || jenis === "batal") {
    hasil.b2 = await alasan();
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// pelajari: median halaman per jenis dokumen
// ---------------------------------------------------------------------------
async function pelajari(params = {}, deps = {}) {
  const q = deps.kueri || kueriBawaan;
  const n = Math.max(5, Math.min(120, Number(params.sampel) || 60));
  const peta = {
    relaas: "SELECT doc_relaas AS j FROM perkara_pelaksanaan_relaas WHERE doc_relaas LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    resi: "SELECT doc_resi AS j FROM perkara_pelaksanaan_relaas WHERE doc_resi LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    bas: "SELECT edoc_bas AS j FROM perkara_jadwal_sidang WHERE edoc_bas LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    putusan: "SELECT amar_putusan_dok AS j FROM perkara_putusan WHERE amar_putusan_dok LIKE 'resources/%.pdf' ORDER BY RAND() LIMIT ?",
    pemberitahuan: "SELECT edoc_pbt AS j FROM perkara_putusan_pemberitahuan_putusan WHERE edoc_pbt LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    "akta-cerai": "SELECT akta_cerai_dok AS j FROM perkara_akta_cerai WHERE akta_cerai_dok LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    ikrar: "SELECT ikrar_talak_dok AS j FROM perkara_ikrar_talak WHERE ikrar_talak_dok LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
    penetapan: "SELECT dokumen AS j FROM perkara_dokumen_penetapan WHERE dokumen LIKE 'resources/%' ORDER BY RAND() LIMIT ?",
  };
  const hasil = {};
  for (const [jenis, sql] of Object.entries(peta)) {
    let baris = [];
    try {
      baris = await q(sql, [n]);
    } catch {
      baris = [];
    }
    const halaman = [];
    for (const b of baris) {
      const mutlak = jalurSipp(b.j, deps.akarSipp || AKAR_SIPP, deps);
      if (!mutlak) continue;
      const h = await halamanBerkas(mutlak, deps);
      if (h.halaman && !h.ragu) halaman.push(h.halaman);
    }
    const m = median(halaman);
    if (m && halaman.length >= 5) hasil[jenis] = { halaman: m, contoh: halaman.length };
  }
  return { ok: true, bawaan: hasil };
}

module.exports = {
  KUNCI_JENIS,
  strukturPdf,
  halamanPdf,
  halamanDocx,
  entriZip,
  halamanBerkas,
  jalurSipp,
  jenisEcourt,
  deteksiSusulan,
  deteksiAlasan,
  uraiObjek,
  umurPenuh,
  KUNCI_SUSULAN,
  median,
  fakta,
  bundelBahan,
  pelajari,
  _cache: cache,
};
