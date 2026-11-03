"use strict";

/**
 * ============================================================================
 * NOMOR HALAMAN AWAL BAGIAN DI PDF LibreOffice = SAMA DENGAN WORD (3 Nov 2026)
 * ============================================================================
 *
 * Diukur dengan LibreOffice 7.4.7.2 container aleta-bot (mesin PDF produksi) dan Word laptop:
 *   - RTF "\pgnrestart\pgnstartsN" (bagian mana pun) dan "\pgnstartN" (dokumen) DIABAIKAN LibreOffice: bagian pertama selalu
 *     mulai 1, bagian yang mulai ulang selalu mulai 1. Word memakai N.
 *   - Akibatnya nomor halaman BAS runut (keputusan 71: halaman awal = halaman terakhir BAS sidang sebelumnya + 1, dipasang portal
 *     lewat pasangNomorAwalRtf), lompatan lampiran, dan nomor sesudah Z (keputusan 59) tercetak salah di PDF - biasa maupun
 *     salinan - walau RTF/Word-nya benar.
 *   - Yang DIHORMATI LibreOffice: penomoran bersambung (\pgncont) dan mulai ulang di 1.
 *
 * Cara (hanya untuk PDF; keluaran RTF/Word tidak disentuh): sebelum bagian yang harus mulai di N > 1 disisipkan bagian BANTU
 * berisi N-1 halaman (mulai ulang di 1, satu titik 1 pt berwarna penanda; kepala/kaki halaman diwarisi seperti biasa) dan
 * bagian aslinya dibuat bersambung - LibreOffice lalu menomori halaman pertamanya N. Sesudah konversi, halaman bantu
 * (dikenali dari warna penandanya) dibuang dari PDF lewat pembaruan bertambah (incremental update) pada pohon halaman.
 * Tata letak halaman asli tidak berubah (diukur atas 9 BAS: geseran 0,000 pt, hanya angka nomor halaman yang berbeda): tiap
 * bagian tetap mulai di halaman baru dan mewarisi kepala/kaki halaman yang sama. Tambahan waktu +-30-60 ms (satu konversi).
 *
 * Aturan Word (diukur): bagian pertama mulai \pgnstartsN bila ber-\pgnrestart, selainnya \pgnstartN dokumen, selainnya 1;
 * bagian berikut yang ber-\pgnrestart mulai \pgnstartsN (bawaan 1), selainnya melanjutkan; \pgnstarts tanpa \pgnrestart
 * diabaikan. Bagian bersambung (\sbknone/\sbkcol) tidak membuka halaman.
 *
 * Tidak dipakai (naskah dibiarkan seperti dulu) bila ada yang membuat halaman bantu mengubah halaman lain: halaman ganjil/genap
 * (\facingp, \margmirror, \sbkodd, \sbkeven), field jumlah halaman (NUMPAGES, SECTIONPAGES), atau bagian tanpa \sectd sendiri.
 * Fungsi MURNI (Buffer/teks masuk, keluar); yang tidak pasti -> null, pemanggil memakai konversi langsung seperti dulu.
 */

const zlib = require("node:zlib");

/** Kelompok tujuan yang bukan isi badan naskah (kepala/kaki halaman, bentuk, gambar, tabel huruf, dst.). */
const TUJUAN_LEWAT = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "shp", "shpinst", "shprslt", "shptxt", "shpgrp", "nonshppict", "object", "objdata", "fldinst", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf", "listtable", "listoverridetable", "rsidtbl", "xmlnstbl", "themedata", "colorschememapping", "latentstyles", "datastore", "generator", "footnote", "annotation", "pgdsctbl"]);

/** Warna penanda halaman bantu (RGB 17,34,51) dan bentuknya di aliran isi PDF LibreOffice ("0.0666666666 0.1333333333 0.2 rg"). */
const PENANDA_RGB = [17, 34, 51];
const RE_PENANDA_PDF = /(?:^|[\s\]>)])0?\.06666\d* 0?\.13333\d* 0?\.2\d* rg/;

/** Posisi kata kendali \sectd dan \sect di tingkat badan naskah (bukan di dalam kepala/kaki halaman, bentuk, catatan kaki). */
function kendaliBagian(s) {
  const hasil = [];
  const tumpukan = [];
  let lewat = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "{") {
      tumpukan.push(lewat);
      const m = /^\{\s*(\\\*)?\s*\\([a-zA-Z]+)/.exec(s.slice(i, i + 40));
      if (m && (m[1] || TUJUAN_LEWAT.has(m[2]))) lewat = true;
      continue;
    }
    if (c === "}") {
      if (tumpukan.length) lewat = tumpukan.pop();
      continue;
    }
    if (c !== "\\") continue;
    const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40));
    if (!m) {
      i += 1;
      continue;
    }
    if (!lewat && (m[1] === "sectd" || m[1] === "sect")) hasil.push({ kata: m[1], pos: i, akhir: i + m[0].length });
    if (m[1] === "bin" && m[2]) i += Number(m[2]);
    i += m[0].length - 1;
  }
  return hasil;
}

/** Deret kata kendali bagian sesudah \sectd (berhenti di kelompok, \pard, \sect, atau teks): kata + ujung deretnya. */
function deretKendali(s, dari) {
  const kata = [];
  const re = /\\([a-zA-Z]+)(-?\d+)? ?|[\r\n ]+/y;
  re.lastIndex = dari;
  let ujung = dari;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) {
      if (m[1] === "pard" || m[1] === "sect" || m[1] === "sectd") break;
      kata.push({ k: m[1], n: m[2] === undefined ? null : Number(m[2]) });
    }
    ujung = re.lastIndex;
  }
  return { kata, ujung };
}

function sifatBagian(kata) {
  const sbk = kata.find((x) => /^sbk(none|col|page|even|odd)$/.test(x.k));
  const mulai = kata.find((x) => x.k === "pgnstarts" && x.n !== null);
  return {
    mulaiUlang: kata.some((x) => x.k === "pgnrestart"),
    awal: mulai ? mulai.n : null,
    halamanBaru: !sbk || !["sbknone", "sbkcol"].includes(sbk.k),
    ganjilGenap: Boolean(sbk && ["sbkodd", "sbkeven"].includes(sbk.k)),
  };
}

/**
 * Rencana nomor halaman menurut aturan Word. bagian: satu per bagian yang membuka halaman, { mulai (null = lanjut), sectd
 * ({pos, akhir} \sectd-nya atau null), kontrolAkhir }. perlu = ada bagian yang di LibreOffice akan bernomor lain dari Word.
 */
function rencanaNomor(rtf) {
  const s = String(rtf || "");
  if (!/\\pgnstarts?-?\d/.test(s)) return { bagian: [], perlu: false };
  const kendali = kendaliBagian(s);
  const pertamaSectd = kendali.find((k) => k.kata === "sectd");
  // \pgnstartN (tanpa "s") = sifat DOKUMEN, di daerah sebelum bagian pertama
  const dok = /\\pgnstart(-?\d+)/.exec(s.slice(0, pertamaSectd ? pertamaSectd.pos : Math.min(s.length, 20000)));
  const awalDokumen = dok ? Number(dok[1]) : null;
  const bagian = [];
  let sifat = { mulaiUlang: false, awal: null, halamanBaru: true, ganjilGenap: false };
  let ganjilGenap = false;
  const sects = kendali.filter((k) => k.kata === "sect");
  // \sect penutup tanpa isi sesudahnya tidak membuka halaman (tidak ada bagian sesudahnya)
  const terakhir = sects[sects.length - 1];
  if (terakhir && !/\\par(?![a-z])|\\cell(?![a-z])/.test(s.slice(terakhir.akhir))) sects.pop();
  const batas = [...sects.map((k) => k.pos), s.length];
  let dari = 0;
  batas.forEach((ujung, indeks) => {
    const sectd = kendali.find((k) => k.kata === "sectd" && k.pos >= dari && k.pos < ujung) || null;
    let kontrolAkhir = -1;
    if (sectd) {
      const d = deretKendali(s, sectd.akhir);
      sifat = sifatBagian(d.kata);
      kontrolAkhir = d.ujung;
    }
    if (sifat.ganjilGenap) ganjilGenap = true;
    if (indeks === 0) bagian.push({ mulai: sifat.mulaiUlang ? (sifat.awal ?? 1) : (awalDokumen ?? 1), sectd, kontrolAkhir });
    else if (sifat.halamanBaru) bagian.push({ mulai: sifat.mulaiUlang ? (sifat.awal ?? 1) : null, sectd, kontrolAkhir });
    dari = ujung;
  });
  // LibreOffice: bagian pertama dan bagian mulai-ulang selalu bernomor 1. Berbeda dengan Word bila ada yang bukan 1.
  const perlu = bagian.some((b) => b.mulai !== null && b.mulai !== 1);
  return { bagian, perlu, ganjilGenap };
}

/** Tambah warna penanda di \colortbl; { rtf, indeks } atau null bila warna yang sama sudah dipakai naskah. */
function tambahWarnaPenanda(s) {
  const [r, g, b] = PENANDA_RGB;
  const entri = `\\red${r}\\green${g}\\blue${b};`;
  const i = s.indexOf("{\\colortbl");
  if (i < 0) {
    const f = s.indexOf("{\\fonttbl");
    let pos = -1;
    if (f >= 0) {
      let d = 0;
      for (let k = f; k < s.length; k += 1) {
        if (s[k] === "\\") {
          k += 1;
          continue;
        }
        if (s[k] === "{") d += 1;
        else if (s[k] === "}" && --d === 0) {
          pos = k + 1;
          break;
        }
      }
    } else pos = s.indexOf("{\\rtf1") === 0 ? 6 : -1;
    if (pos < 0) return null;
    return { rtf: `${s.slice(0, pos)}{\\colortbl;${entri}}${s.slice(pos)}`, indeks: 1 };
  }
  const tutup = s.indexOf("}", i);
  if (tutup < 0) return null;
  const isi = s.slice(i + "{\\colortbl".length, tutup);
  if (isi.replace(/\s+/g, "").includes(entri)) return null;
  const indeks = (isi.match(/;/g) || []).length;
  return { rtf: `${s.slice(0, tutup)}${entri}${s.slice(tutup)}`, indeks };
}

/**
 * RTF untuk LibreOffice dengan halaman bantu. null bila tidak perlu atau tidak dapat dengan pasti. Hasil: { rtf, blok: [jumlah
 * halaman bantu per bagian, urut] }.
 */
function sisipkanHalamanBantu(rtf, rencana) {
  let s = String(rtf || "");
  if (!rencana || !rencana.perlu || rencana.ganjilGenap) return null;
  if (/\\facingp(?![a-z])|\\margmirror(?![a-z])/.test(s) || /\b(NUMPAGES|SECTIONPAGES)\b/.test(s)) return null;
  const ubah = [];
  const blok = [];
  for (const b of rencana.bagian) {
    if (b.mulai === null || b.mulai === 1) continue;
    if (!b.sectd || b.kontrolAkhir < 0 || b.mulai < 2 || b.mulai > 9999) return null;
    const jumlah = b.mulai - 1;
    blok.push(jumlah);
    const kontrol = s.slice(b.sectd.akhir, b.kontrolAkhir);
    // bagian bantu: ukuran halaman & margin sama dengan bagian aslinya; nomor mulai ulang 1; tanpa kepala/kaki halaman
    const sifatBantu = kontrol.replace(/\\(?:pgn[a-z]*-?\d*|sbk[a-z]+|titlepg|endnhere|linex-?\d*|linestarts-?\d*|linerestart|lineppage|linecont)(?![a-z]) ?/g, "");
    // Kepala/kaki halaman TIDAK ditulis: bagian bantu mewarisi milik bagian sebelumnya, dan bagian asli sesudahnya tetap mewarisi
    // yang sama seperti tanpa halaman bantu (bagian tanpa kepala/kaki sendiri mewarisi dari bagian sebelumnya).
    ubah.push({ pos: b.sectd.pos, buang: 0, sisip: `\\sectd ${sifatBantu.trim()} \\sbkpage\\pgnrestart\\pgnstarts1 @@HALAMAN_BANTU_${jumlah}@@\\sect ` });
    // bagian asli dilanjutkan dari halaman bantu. Tanpa spasi di depan: spasi sesudah pembatas "\sectd " adalah HURUF (masuk ke
    // paragraf pertama bagian itu dan menggeser baris pertamanya).
    const baru = kontrol.replace(/\\pgn(?:restart|cont)(?![a-z]) ?|\\pgnstarts-?\d+ ?/g, "");
    ubah.push({ pos: b.sectd.akhir, buang: kontrol.length, sisip: `\\pgncont ${baru.trim()} ` });
  }
  if (!blok.length) return null;
  for (const u of ubah.sort((a, b) => b.pos - a.pos)) s = `${s.slice(0, u.pos)}${u.sisip}${s.slice(u.pos + u.buang)}`;
  const w = tambahWarnaPenanda(s);
  if (!w) return null;
  s = w.rtf.replace(/@@HALAMAN_BANTU_(\d+)@@/g, (_m, n) => {
    const halaman = `\\pard\\plain{\\cf${w.indeks}\\fs2 .}`;
    return Array.from({ length: Number(n) }, () => halaman).join("\\page ");
  });
  return { rtf: s, blok };
}

// ----------------------------------------------------------------------------
// PDF: buang halaman bantu (pohon halaman datar LibreOffice), pembaruan bertambah
// ----------------------------------------------------------------------------

function cariObjek(pdf, nomor) {
  const re = new RegExp(`(?:^|[\\r\\n])${nomor} 0 obj\\b`, "g");
  let m;
  let akhir = -1;
  while ((m = re.exec(pdf))) akhir = m.index + (m[0][0] === "\r" || m[0][0] === "\n" ? 1 : 0);
  return akhir;
}
function kamusObjek(pdf, nomor) {
  const i = cariObjek(pdf, nomor);
  if (i < 0) return null;
  const a = pdf.indexOf("<<", i);
  if (a < 0) return null;
  // kamus seimbang << ... >>
  let d = 0;
  for (let k = a; k < pdf.length - 1; k += 1) {
    if (pdf[k] === "<" && pdf[k + 1] === "<") {
      d += 1;
      k += 1;
    } else if (pdf[k] === ">" && pdf[k + 1] === ">") {
      d -= 1;
      k += 1;
      if (d === 0) return { awal: a, akhir: k + 1, teks: pdf.slice(a, k + 1), mulaiObj: i };
    }
  }
  return null;
}
function isiAliran(buf, pdf, nomor) {
  const k = kamusObjek(pdf, nomor);
  if (!k) return null;
  const s = pdf.indexOf("stream", k.akhir);
  if (s < 0 || s - k.akhir > 20) return null;
  let a = s + 6;
  if (pdf[a] === "\r") a += 1;
  if (pdf[a] === "\n") a += 1;
  let panjang = null;
  const langsung = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(k.teks);
  const tidakLangsung = /\/Length\s+(\d+)\s+0\s+R/.exec(k.teks);
  if (langsung) panjang = Number(langsung[1]);
  else if (tidakLangsung) {
    const j = cariObjek(pdf, Number(tidakLangsung[1]));
    const m = j >= 0 ? /obj\s*(\d+)/.exec(pdf.slice(j, j + 60)) : null;
    panjang = m ? Number(m[1]) : null;
  }
  if (panjang === null) {
    const e = pdf.indexOf("endstream", a);
    if (e < 0) return null;
    panjang = e - a;
  }
  const mentah = buf.subarray(a, a + panjang);
  return /\/FlateDecode/.test(k.teks) ? zlib.inflateSync(mentah) : mentah;
}

/**
 * PDF LibreOffice -> PDF tanpa halaman bantu. blok = jumlah halaman bantu per bagian (urut). null bila struktur PDF tidak
 * dikenali atau halaman bantu yang ditemukan tidak persis sama dengan rencana (pemanggil mengubah ulang tanpa halaman bantu).
 */
function buangHalamanBantu(pdfBuf, blok) {
  const buf = Buffer.from(pdfBuf);
  const pdf = buf.toString("latin1");
  const sx = pdf.lastIndexOf("startxref");
  if (sx < 0) return null;
  const xrefLama = Number((/startxref\s+(\d+)/.exec(pdf.slice(sx)) || [])[1]);
  const t = pdf.lastIndexOf("trailer", sx);
  if (t < 0 || !Number.isFinite(xrefLama)) return null;
  const trailer = pdf.slice(t, sx);
  const root = /\/Root\s+(\d+)\s+0\s+R/.exec(trailer);
  const size = /\/Size\s+(\d+)/.exec(trailer);
  if (!root || !size) return null;
  const katalog = kamusObjek(pdf, Number(root[1]));
  const halamanRef = katalog && /\/Pages\s+(\d+)\s+0\s+R/.exec(katalog.teks);
  if (!halamanRef) return null;
  const nomorPohon = Number(halamanRef[1]);
  const pohon = kamusObjek(pdf, nomorPohon);
  if (!pohon) return null;
  const kids = /\/Kids\s*\[([^\]]*)\]/.exec(pohon.teks);
  if (!kids) return null;
  const anak = [...kids[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));
  // hanya pohon datar: tiap anak harus /Type/Page
  const bantu = [];
  for (const n of anak) {
    const k = kamusObjek(pdf, n);
    if (!k || !/\/Type\s*\/Page(?![s\w])/.test(k.teks)) return null;
    const isi = /\/Contents\s*(?:(\d+)\s+0\s+R|\[([^\]]*)\])/.exec(k.teks);
    let ditandai = false;
    if (isi) {
      const daftar = isi[1] ? [Number(isi[1])] : [...isi[2].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));
      for (const c of daftar) {
        const aliran = isiAliran(buf, pdf, c);
        if (aliran && RE_PENANDA_PDF.test(aliran.toString("latin1"))) ditandai = true;
      }
    }
    bantu.push(ditandai);
  }
  // halaman bantu harus berupa blok-blok bersambung sebesar rencana, urut
  const runtun = [];
  bantu.forEach((b, i) => {
    if (!b) return;
    if (i > 0 && bantu[i - 1]) runtun[runtun.length - 1] += 1;
    else runtun.push(1);
  });
  if (runtun.join(",") !== blok.join(",")) return null;
  const sisa = anak.filter((_n, i) => !bantu[i]);
  if (!sisa.length) return null;
  const pohonBaru = pohon.teks.replace(/\/Kids\s*\[[^\]]*\]/, `/Kids[ ${sisa.map((n) => `${n} 0 R`).join(" ")} ]`).replace(/\/Count\s+\d+/, `/Count ${sisa.length}`);
  const ekor = pdf.endsWith("\n") ? "" : "\n";
  const posObj = buf.length + Buffer.byteLength(ekor, "latin1");
  const objek = `${nomorPohon} 0 obj\n${pohonBaru}\nendobj\n`;
  const posXref = posObj + Buffer.byteLength(objek, "latin1");
  const info = /\/Info\s+\d+\s+0\s+R/.exec(trailer);
  const id = /\/ID\s*\[[^\]]*\]/.exec(trailer);
  const trailerBaru = `<</Size ${size[1]}/Root ${root[1]} 0 R${info ? `/${info[0].slice(1)}` : ""}${id ? `/${id[0].slice(1)}` : ""}/Prev ${xrefLama}>>`;
  const xref = `xref\n${nomorPohon} 1\n${String(posObj).padStart(10, "0")} 00000 n \ntrailer\n${trailerBaru}\nstartxref\n${posXref}\n%%EOF\n`;
  return Buffer.concat([buf, Buffer.from(`${ekor}${objek}${xref}`, "latin1")]);
}

module.exports = { rencanaNomor, sisipkanHalamanBantu, buangHalamanBantu, kendaliBagian, PENANDA_RGB };
