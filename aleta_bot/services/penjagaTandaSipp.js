"use strict";

/**
 * ============================================================================
 * PENJAGA BATAS: TIDAK ADA KATA "ALETA" DI SERVER / DATABASE SIPP
 * ============================================================================
 *
 * Keputusan pengguna 17 Okt 2026: "Jangan ada satupun kalimat atau kata Aleta
 * di server SIPP atau database SIPP. Kalau disimpan proses dan riwayat di
 * aplikasi ALETA boleh ada identifikasi ALETA."
 *
 * Satu modul untuk SEMUA jalur tulis ke SIPP (baris basis data, berkas di
 * folder SIPP, isian ABT). Aturan pengenal katanya tetap satu di
 * tandaAletaService.menyebutAleta (huruf besar/kecil, direnggangkan, beraksen,
 * aksara tak tampak); modul ini menambah TIGA perilaku yang berbeda menurut
 * asal teksnya:
 *
 *   1. TEKS BUATAN SISTEM (keterangan audit, Author/Producer, nama berkas,
 *      user-agent tercatat)
 *        -> DIBERSIHKAN otomatis: bersihkanTeksSistem, namaBerkasBersih,
 *           bersihkanMetadataBerkas (RTF/PDF/DOCX; tanpa menyentuh isi naskah).
 *
 *   2. TEKS KETIKAN MANUSIA (alasan tunda, agenda, catatan mediasi, sebab
 *      majelis, uraian kasir, amar/pertimbangan, isian Data Umum, templat tanya
 *      jawab, identitas satker) atau ISI naskah hukum yang diunggah
 *        -> DITAHAN, TIDAK ditulis, dengan kalimat awam yang menunjuk kolomnya:
 *           "Isian "X" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP."
 *           Isi dokumen hukum TIDAK PERNAH diubah diam-diam.
 *
 *   3. TEKS YANG MEMANG BERASAL DARI DATA SIPP (nama pihak yang kebetulan
 *      "Aleta", nama petugas, nomor perkara) tidak dihitung. Dibedakan begini:
 *      pemanggil menyerahkan `dariSipp` - daftar teks yang IA BACA dari SIPP
 *      (mis. dataSippMemuatAleta: nama pihak perkara itu yang memuat kata itu,
 *      dibaca dari perkara_pihak1..5). Kemunculan yang SELURUHNYA tertutup oleh
 *      salah satu teks itu dibuang sebelum diperiksa; kemunculan di luarnya
 *      tetap menahan. Untuk teks yang diolah dari SIPP (posita dirapikan) dipakai
 *      `teksAsal`: tidak ditahan selama jumlah kemunculannya TIDAK bertambah.
 *
 * Penyimpanan di tabel aleta_* dan riwayat/jejak ALETA TIDAK dibatasi - modul
 * ini hanya dipasang di jalur yang tulisannya sampai ke SIPP.
 *
 * Padanan portal (peringatan saat admin menyimpan): manajemen_surat/src/lib/tanda-aleta.ts.
 */

const zlib = require("node:zlib");
const { menyebutAleta, bakukan } = require("./tandaAletaService");
const { tanpaTandaAletaMetadata } = require("./metadataTanpaAletaService");

const KODE = "teks_menyebut_aleta";
const KODE_BERKAS = "isi_berkas_menyebut_aleta";

const TAK_TAMPAK = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;
const PEMISAH = "[\\s._\\-*·•/\\\\|,:;'\"`~+]*";
const POLA_RENGGANG = `a${PEMISAH}l${PEMISAH}e${PEMISAH}t${PEMISAH}a`;

// ============================================================================
// Kalimat awam
// ============================================================================

function pesanIsian(kolom) {
  const k = String(kolom || "").trim() || "ini";
  return `Isian "${k}" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`;
}

function pesanBerkas(nama, bagian) {
  const n = String(nama || "").trim() || "yang dipilih";
  const b = bagian ? ` (${bagian})` : "";
  return `Berkas "${n}" memuat kata 'ALETA' di dalam isinya${b}; hapus dulu sebelum diunggah ke SIPP.`;
}

/** Nama kolom SIPP -> sebutan yang dibaca petugas. Yang tidak terdaftar dipakai apa adanya. */
const SEBUTAN_KOLOM = Object.freeze({
  keterangan: "Keterangan",
  catatan: "Catatan",
  catatan_mediasi: "Catatan mediasi",
  catatan_putusan: "Catatan putusan",
  alasan_ditunda: "Alasan ditunda",
  alasan: "Alasan",
  agenda: "Agenda sidang",
  rencana_agenda: "Agenda sidang",
  uraian: "Uraian",
  amar_putusan: "Amar putusan",
  pertimbangan_hukum: "Pertimbangan hukum",
  posita: "Posita",
  nomor_surat: "Nomor surat",
  no_kutipan_akta_nikah: "Nomor kutipan akta nikah",
  kua_tempat_nikah: "KUA tempat menikah",
  penetapan_majelis_hakim: "Penetapan majelis hakim",
  nama_dokumen: "Nama dokumen",
  nomor_sk_penetapan_mediator: "No. Penetapan Mediator",
  nomor_sk_penetapan: "No. Penetapan Mediator",
  tempat: "Tempat",
  pertanyaan: "Pertanyaan",
  jawaban: "Jawaban",
  sql_query: "Isian blangko",
  default_data: "Isian bawaan",
});

function sebutanKolom(kolom, tabel) {
  const k = String(kolom || "").trim();
  if (!k) return tabel ? `isian pada ${tabel}` : "";
  return SEBUTAN_KOLOM[k.toLowerCase()] || k;
}

// ============================================================================
// Hitung, kecualikan data SIPP, periksa
// ============================================================================

function rapat(teks) {
  return bakukan(teks).replace(/\s+/g, " ").trim();
}

/** Jumlah kemunculan kata (polos maupun direnggangkan) setelah dibakukan. */
function hitungAleta(teks) {
  const t = bakukan(teks);
  if (!t) return 0;
  let n = (t.match(/aleta/g) || []).length;
  const renggang = new RegExp(`(?<![a-z0-9])${POLA_RENGGANG}(?![a-z0-9])`, "gi");
  for (const m of t.matchAll(renggang)) {
    if (m[0] !== "aleta") n += 1;
  }
  return n;
}

/**
 * Buang dari `teks` setiap kemunculan teks-teks yang dibaca dari SIPP. Hanya
 * teks SIPP yang sendirinya memuat kata itu yang berarti (yang lain tak
 * mengubah apa pun) dan yang cukup panjang untuk bukan kebetulan.
 */
function tanpaDataSipp(teks, dariSipp) {
  let sisa = rapat(teks);
  const daftar = (Array.isArray(dariSipp) ? dariSipp : [dariSipp])
    .map((x) => rapat(x))
    .filter((x) => x.length >= 5 && menyebutAleta(x))
    .sort((a, b) => b.length - a.length);
  for (const x of new Set(daftar)) sisa = sisa.split(x).join(" ");
  return sisa;
}

/**
 * true bila `teks` menyebut ALETA di luar teks yang berasal dari SIPP.
 * opsi.dariSipp: teks-teks yang dibaca dari SIPP; opsi.teksAsal: teks SIPP
 * yang DIOLAH menjadi `teks` (tidak ditahan selama kemunculannya tak bertambah).
 */
function menyebutAletaBaru(teks, opsi = {}) {
  if (!menyebutAleta(teks)) return false;
  if (opsi.teksAsal !== undefined && opsi.teksAsal !== null) {
    return hitungAleta(teks) > hitungAleta(opsi.teksAsal);
  }
  const sisa = opsi.dariSipp && opsi.dariSipp.length ? tanpaDataSipp(teks, opsi.dariSipp) : teks;
  return menyebutAleta(sisa);
}

function* semuaTeks(nilai, jalur, kedalaman = 0) {
  if (nilai === null || nilai === undefined || kedalaman > 6) return;
  if (typeof nilai === "string") {
    yield [jalur, nilai];
    return;
  }
  if (Buffer.isBuffer(nilai)) return;
  if (Array.isArray(nilai)) {
    for (let i = 0; i < nilai.length; i += 1) yield* semuaTeks(nilai[i], jalur, kedalaman + 1);
    return;
  }
  if (typeof nilai === "object") {
    for (const [k, v] of Object.entries(nilai)) yield* semuaTeks(v, jalur ? `${jalur} / ${k}` : k, kedalaman + 1);
  }
}

function tahan(kolom, ekstra = {}) {
  return { ok: false, alasan: KODE, kolom, pesan: pesanIsian(kolom), ...ekstra };
}

/**
 * Periksa isian ketikan manusia yang akan ditulis ke SIPP.
 *
 * `isian`: objek { "Nama isian": nilai } atau larik [{ kolom, nilai }].
 * Pulang { ok:true } atau { ok:false, alasan:"teks_menyebut_aleta", kolom, pesan }.
 */
function periksaIsian(isian, opsi = {}) {
  const pasangan = [];
  if (Array.isArray(isian)) {
    for (const x of isian) {
      if (x && typeof x === "object" && "nilai" in x) pasangan.push([String(x.kolom || x.label || ""), x.nilai]);
    }
  } else if (isian && typeof isian === "object") {
    for (const [k, v] of Object.entries(isian)) pasangan.push([k, v]);
  }
  for (const [kolom, nilai] of pasangan) {
    for (const [jalur, teks] of semuaTeks(nilai, kolom)) {
      const asal = opsi.teksAsal && typeof opsi.teksAsal === "object" && !Array.isArray(opsi.teksAsal) ? opsi.teksAsal[kolom] : opsi.teksAsal;
      if (menyebutAletaBaru(teks, { dariSipp: opsi.dariSipp, teksAsal: asal })) return tahan(kolom || jalur);
    }
  }
  return { ok: true };
}

// ============================================================================
// Rencana tulis SQL (penetapan, tunda/putus, putusan, mediator, kasir, kalender)
// ============================================================================

function bagiTingkatAtas(teks) {
  const hasil = [];
  let dalam = 0;
  let kutip = "";
  let awal = 0;
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i];
    if (kutip) {
      if (c === "\\") i += 1;
      else if (c === kutip) kutip = "";
      continue;
    }
    if (c === "'" || c === '"' || c === "`") kutip = c;
    else if (c === "(") dalam += 1;
    else if (c === ")") dalam -= 1;
    else if (c === "," && dalam === 0) {
      hasil.push(teks.slice(awal, i));
      awal = i + 1;
    }
  }
  hasil.push(teks.slice(awal));
  return hasil.map((x) => x.trim());
}

/** Nama kolom yang diisi tanda tanya ke-`indeks` pada INSERT/UPDATE sederhana; "" bila tak terbaca. */
function kolomUntukParam(sql, indeks) {
  const s = String(sql || "").replace(/\s+/g, " ");
  try {
    const sisip = /^\s*(?:INSERT|REPLACE)\s+(?:IGNORE\s+)?INTO\s+[`\w.]+\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)\s*(?:ON DUPLICATE.*)?$/i.exec(s);
    if (sisip) {
      const kolom = bagiTingkatAtas(sisip[1]).map((k) => k.replace(/`/g, ""));
      const nilai = bagiTingkatAtas(sisip[2]);
      let ke = -1;
      for (let i = 0; i < nilai.length; i += 1) {
        const tanda = (nilai[i].match(/\?/g) || []).length;
        if (tanda > 0 && ke + tanda >= indeks) return ke + 1 === indeks ? kolom[i] || "" : "";
        ke += tanda;
      }
      return "";
    }
    const ubah = /^\s*UPDATE\s+[`\w.]+\s+SET\s+(.*?)(?:\s+WHERE\s.*)?$/i.exec(s);
    if (ubah) {
      let ke = -1;
      for (const set of bagiTingkatAtas(ubah[1])) {
        const tanda = (set.match(/\?/g) || []).length;
        if (tanda > 0 && ke + tanda >= indeks) {
          const k = /^`?([\w]+)`?\s*=/.exec(set);
          return ke + 1 === indeks && k ? k[1] : "";
        }
        ke += tanda;
      }
    }
  } catch {
    /* label hanya kerapian pesan */
  }
  return "";
}

/** Dari deskripsi audit (tabel HTML) kolom pertama yang nilainya memuat kata itu. */
function kolomDariDeskripsi(html, opsi) {
  for (const m of String(html || "").matchAll(/<tr><td>([^<]*)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)) {
    if (menyebutAletaBaru(m[2], opsi)) return m[1];
  }
  return "";
}

function tabelDariSql(sql) {
  const m = /^\s*(?:INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([`\w.]+)/i.exec(String(sql || ""));
  return m ? m[1].replace(/`/g, "") : "";
}

/** Larik datar {sql, params, tabel} dari rencana bentuk apa pun yang dipakai penulis SIPP. */
function langkahDatar(rencana) {
  const hasil = [];
  const ambil = (x) => {
    if (!x || typeof x !== "object") return;
    if (typeof x.sql === "string") hasil.push({ sql: x.sql, params: Array.isArray(x.params) ? x.params : [], tabel: x.tabel || tabelDariSql(x.sql) });
    if (Array.isArray(x.kelompok)) x.kelompok.forEach(ambil);
  };
  if (rencana && Array.isArray(rencana.langkah)) rencana.langkah.forEach(ambil);
  return hasil;
}

/** Teks dari SIPP yang sudah ada di rencana sendiri (akun, perkara) - tidak dihitung. */
function dataSippRencana(rencana) {
  const hasil = [];
  const kumpul = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of ["username", "namaLengkap", "nomorPerkara", "fullname", "nama"]) if (typeof o[k] === "string") hasil.push(o[k]);
  };
  if (rencana) {
    for (const kunci of ["atasNama", "akunMasuk", "akunSipp", "perkara", "mediator"]) kumpul(rencana[kunci]);
    if (Array.isArray(rencana.dataSipp)) hasil.push(...rencana.dataSipp.filter((x) => typeof x === "string"));
  }
  return hasil;
}

/**
 * Pagar terakhir sebelum rencana ditulis ke SIPP: SELURUH nilai (params) dan
 * teks perintah tiap langkah diperiksa. Dipasang di setiap penjalan rencana,
 * sesudah pemeriksaan isian per jalur - jadi yang lolos ke sini hanya
 * kecolongan, dan pesannya tetap menunjuk kolomnya.
 */
function periksaRencana(rencana, opsi = {}) {
  const dariSipp = [...dataSippRencana(rencana), ...(Array.isArray(opsi.dariSipp) ? opsi.dariSipp : [])];
  const pakai = { dariSipp };
  let nomor = 0;
  for (const langkah of langkahDatar(rencana)) {
    nomor += 1;
    if (menyebutAletaBaru(langkah.sql, pakai)) {
      return tahan(`perintah ke ${langkah.tabel || "SIPP"}`, { tabel: langkah.tabel, langkahKe: nomor });
    }
    for (let i = 0; i < langkah.params.length; i += 1) {
      const nilai = langkah.params[i];
      for (const [, teks] of semuaTeks(nilai, "")) {
        if (!menyebutAletaBaru(teks, pakai)) continue;
        const dalamAudit = /sys_audittrail/i.test(langkah.tabel) || /^\s*<br>?\s*<table/i.test(teks);
        const kolomAudit = dalamAudit ? kolomDariDeskripsi(teks, pakai) : "";
        const kolom = dalamAudit
          ? kolomAudit
            ? sebutanKolom(kolomAudit, langkah.tabel)
            : "catatan audit"
          : sebutanKolom(kolomUntukParam(langkah.sql, i), langkah.tabel);
        return tahan(kolom || `isian pada ${langkah.tabel || "SIPP"}`, { tabel: langkah.tabel, langkahKe: nomor });
      }
    }
  }
  return { ok: true };
}

/** Nama pihak perkara yang memuat kata itu, dibaca dari SIPP - dipakai sebagai `dariSipp`. */
async function dataSippMemuatAleta(perkaraId, kueri) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0 || typeof kueri !== "function") return [];
  const sql = [1, 2, 3, 4, 5]
    .map((n) => `SELECT nama FROM perkara_pihak${n} WHERE perkara_id = ? AND nama LIKE '%aleta%'`)
    .join(" UNION ALL ");
  try {
    const baris = await kueri(sql, [id, id, id, id, id]);
    return (Array.isArray(baris) ? baris : []).map((b) => String(b.nama || "")).filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// Pengaturan SIPP & ABT (identitas satker, blangko tanya jawab, variabel, menu)
// ============================================================================

function* nilaiTeks(x, kedalaman = 0) {
  for (const [, t] of semuaTeks(x, "", kedalaman)) yield t;
}

/**
 * Isian ketikan admin pada Pengaturan SIPP & ABT yang akan tertulis di basis data
 * ABT (server SIPP). Pulang { isian, dariSipp }: `isian` = { "Nama isian": nilai }
 * dari bagian BARU permintaan; `dariSipp` = nilai LAMA yang sudah ada di server
 * (isian yang tidak berubah tidak ditahan, supaya sisa lama tidak mengunci
 * penyimpanan perubahan lain).
 */
function isianPengaturanAbt(jalur, badan) {
  const b = badan && typeof badan === "object" ? badan : {};
  const isian = {};
  const dariSipp = [];
  const lama = (x) => {
    for (const t of nilaiTeks(x)) dariSipp.push(t);
  };
  const kolom = (k) => SEBUTAN_KOLOM[String(k).toLowerCase()] || k;
  if (jalur === "/menu/simpan") {
    (Array.isArray(b.ubah) ? b.ubah : []).forEach((u, i) => {
      const baru = u && typeof u.baru === "object" ? u.baru : {};
      for (const [k, v] of Object.entries(baru)) isian[`Folder ${u.id || i + 1} - ${kolom(k)}`] = v;
      lama(u && u.lama);
    });
    (Array.isArray(b.config) ? b.config : []).forEach((c) => {
      isian[`Pengaturan ABT - ${(c && c.name) || ""}`] = c && c.baru;
      lama(c && c.lama);
    });
  } else if (jalur === "/variabel/simpan") {
    for (const [k, v] of Object.entries(b.baru && typeof b.baru === "object" ? b.baru : {})) isian[`Variabel #${b.noVar}# - ${kolom(k)}`] = v;
    lama(b.lama);
  } else if (jalur === "/satker/simpan") {
    for (const [k, v] of Object.entries(b.baru && typeof b.baru === "object" ? b.baru : {})) isian[`Identitas satker (variabel #${b.noVar}#) - ${kolom(k)}`] = v;
    lama(b.lama);
  } else if (jalur === "/templat/simpan") {
    (Array.isArray(b.baru) ? b.baru : []).forEach((r, i) => {
      isian[`Tanya jawab ${b.kode || ""} - pertanyaan ${i + 1}`] = r && (r.tanya ?? r.pertanyaan);
      isian[`Tanya jawab ${b.kode || ""} - jawaban ${i + 1}`] = r && (r.jawab ?? r.jawaban);
    });
    lama(b.lama);
  }
  return { isian, dariSipp };
}

/** Periksa satu permintaan simpan Pengaturan SIPP & ABT. Pulang { ok:true } atau { ok:false, alasan, kolom, pesan }. */
function periksaPengaturanAbt(jalur, badan) {
  const { isian, dariSipp } = isianPengaturanAbt(jalur, badan);
  return periksaIsian(isian, { dariSipp });
}

// ============================================================================
// Teks buatan sistem: dibersihkan
// ============================================================================

/**
 * Teks yang DIBUAT sistem (bukan ketikan manusia): kata itu dibuang, sisanya
 * dirapikan. Bentuk beraksen/lebar diseragamkan dulu. Tanpa kata itu, teks
 * dikembalikan apa adanya.
 */
function bersihkanTeksSistem(teks, pengganti = "") {
  const asli = String(teks === null || teks === undefined ? "" : teks);
  if (!menyebutAleta(asli)) return asli;
  const dasar = asli
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(TAK_TAMPAK, "");
  let hasil = dasar.replace(/aleta/gi, pengganti);
  hasil = hasil.replace(new RegExp(`(?<![a-z0-9])${POLA_RENGGANG}(?![a-z0-9])`, "gi"), pengganti);
  hasil = hasil
    .replace(/\(\s*\)|\[\s*\]|<\s*>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:)\]])/g, "$1")
    .trim();
  return hasil;
}

/** Nama berkas tanpa kata itu (ekstensi dijaga). Kosong sesudah dibersihkan -> `cadangan`. */
function namaBerkasBersih(nama, cadangan = "berkas") {
  const asli = String(nama === null || nama === undefined ? "" : nama);
  if (!menyebutAleta(asli)) return asli;
  const titik = asli.lastIndexOf(".");
  const dasar = titik > 0 ? asli.slice(0, titik) : asli;
  const ekstensi = titik > 0 ? asli.slice(titik) : "";
  const bersih = bersihkanTeksSistem(dasar).replace(/^[\s._-]+|[\s._-]+$/g, "").replace(/[_-]{2,}/g, "_");
  return `${bersih || cadangan}${menyebutAleta(ekstensi) ? "" : ekstensi}`;
}

/** user-agent / nama klien yang tercatat di SIPP: token ALETA dibuang. */
function agenKlienBersih(agen) {
  return bersihkanTeksSistem(agen);
}

// ============================================================================
// Berkas: bentuk, ZIP (DOCX), teks isi, metadata
// ============================================================================

function kenaliBentuk(isi) {
  if (!Buffer.isBuffer(isi) || isi.length < 4) return "";
  const kepala = isi.subarray(0, 8);
  if (kepala.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (kepala.subarray(0, 5).toString("latin1").startsWith("{\\rtf")) return "rtf";
  if (kepala[0] === 0x50 && kepala[1] === 0x4b && kepala[2] === 0x03 && kepala[3] === 0x04) return "zip";
  if (kepala[0] === 0xd0 && kepala[1] === 0xcf && kepala[2] === 0x11 && kepala[3] === 0xe0) return "doc";
  return "";
}

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bita) {
  let c = 0xffffffff;
  for (let i = 0; i < bita.length; i += 1) c = TABEL_CRC[(c ^ bita[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Entri ZIP dari direktori pusat; null bila bukan ZIP biasa (zip64/rusak). */
function bacaZip(isi) {
  let akhir = -1;
  for (let i = isi.length - 22; i >= Math.max(0, isi.length - 22 - 65535); i -= 1) {
    if (isi.readUInt32LE(i) === 0x06054b50) {
      akhir = i;
      break;
    }
  }
  if (akhir < 0) return null;
  const jumlah = isi.readUInt16LE(akhir + 10);
  let p = isi.readUInt32LE(akhir + 16);
  const hasil = [];
  for (let n = 0; n < jumlah; n += 1) {
    if (p + 46 > isi.length || isi.readUInt32LE(p) !== 0x02014b50) return null;
    const e = {
      versiBuat: isi.readUInt16LE(p + 4),
      versiButuh: isi.readUInt16LE(p + 6),
      flag: isi.readUInt16LE(p + 8),
      metode: isi.readUInt16LE(p + 10),
      waktu: isi.readUInt16LE(p + 12),
      tanggal: isi.readUInt16LE(p + 14),
      crc: isi.readUInt32LE(p + 16),
      ukuranTermampat: isi.readUInt32LE(p + 20),
      ukuranAsli: isi.readUInt32LE(p + 24),
      atributDalam: isi.readUInt16LE(p + 36),
      atributLuar: isi.readUInt32LE(p + 38),
      offsetLokal: isi.readUInt32LE(p + 42),
    };
    const panjangNama = isi.readUInt16LE(p + 28);
    const panjangEkstra = isi.readUInt16LE(p + 30);
    const panjangKomentar = isi.readUInt16LE(p + 32);
    if (e.ukuranTermampat === 0xffffffff || e.ukuranAsli === 0xffffffff || e.offsetLokal === 0xffffffff) return null;
    e.nama = isi.subarray(p + 46, p + 46 + panjangNama).toString("utf8");
    e.namaBita = Buffer.from(isi.subarray(p + 46, p + 46 + panjangNama));
    if (e.offsetLokal + 30 > isi.length || isi.readUInt32LE(e.offsetLokal) !== 0x04034b50) return null;
    const mulai = e.offsetLokal + 30 + isi.readUInt16LE(e.offsetLokal + 26) + isi.readUInt16LE(e.offsetLokal + 28);
    if (mulai + e.ukuranTermampat > isi.length) return null;
    e.data = isi.subarray(mulai, mulai + e.ukuranTermampat);
    hasil.push(e);
    p += 46 + panjangNama + panjangEkstra + panjangKomentar;
  }
  return hasil;
}

function isiEntri(e) {
  if (e.metode === 0) return Buffer.from(e.data);
  if (e.metode === 8) return zlib.inflateRawSync(e.data);
  return null;
}

/** ZIP baru: tiap entri ditulis ulang tanpa data-descriptor; yang ada di `ganti` diganti isinya. */
function tulisZip(entri, ganti) {
  const bagian = [];
  const pusat = [];
  let posisi = 0;
  for (const e of entri) {
    let metode = e.metode;
    let data = e.data;
    let crc = e.crc;
    let asli = e.ukuranAsli;
    if (ganti.has(e.nama)) {
      const baru = ganti.get(e.nama);
      data = zlib.deflateRawSync(baru);
      metode = 8;
      crc = crc32(baru);
      asli = baru.length;
    }
    const flag = e.flag & ~0x0008;
    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);
    kepala.writeUInt16LE(e.versiButuh, 4);
    kepala.writeUInt16LE(flag, 6);
    kepala.writeUInt16LE(metode, 8);
    kepala.writeUInt16LE(e.waktu, 10);
    kepala.writeUInt16LE(e.tanggal, 12);
    kepala.writeUInt32LE(crc >>> 0, 14);
    kepala.writeUInt32LE(data.length, 18);
    kepala.writeUInt32LE(asli, 22);
    kepala.writeUInt16LE(e.namaBita.length, 26);
    kepala.writeUInt16LE(0, 28);
    bagian.push(kepala, e.namaBita, data);
    const rekam = Buffer.alloc(46);
    rekam.writeUInt32LE(0x02014b50, 0);
    rekam.writeUInt16LE(e.versiBuat, 4);
    rekam.writeUInt16LE(e.versiButuh, 6);
    rekam.writeUInt16LE(flag, 8);
    rekam.writeUInt16LE(metode, 10);
    rekam.writeUInt16LE(e.waktu, 12);
    rekam.writeUInt16LE(e.tanggal, 14);
    rekam.writeUInt32LE(crc >>> 0, 16);
    rekam.writeUInt32LE(data.length, 20);
    rekam.writeUInt32LE(asli, 24);
    rekam.writeUInt16LE(e.namaBita.length, 28);
    rekam.writeUInt16LE(0, 30);
    rekam.writeUInt16LE(0, 32);
    rekam.writeUInt16LE(0, 34);
    rekam.writeUInt16LE(e.atributDalam, 36);
    rekam.writeUInt32LE(e.atributLuar, 38);
    rekam.writeUInt32LE(posisi, 42);
    pusat.push(rekam, e.namaBita);
    posisi += 30 + e.namaBita.length + data.length;
  }
  const pusatBita = Buffer.concat(pusat);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(entri.length, 8);
  akhir.writeUInt16LE(entri.length, 10);
  akhir.writeUInt32LE(pusatBita.length, 12);
  akhir.writeUInt32LE(posisi, 16);
  return Buffer.concat([...bagian, pusatBita, akhir]);
}

const METADATA_DOCX = /^docProps\/(core|app|custom)\.xml$/i;
const BAGIAN_TEKS_DOCX = /^word\/(document|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$/i;

function ganti5(teks) {
  return teks.replace(/aleta/gi, "     ");
}

function bersihkanXmlMetadata(xml) {
  const tanpaPolos = ganti5(xml);
  return tanpaPolos.replace(/>([^<]*)</g, (m, t) => (menyebutAleta(t) ? `>${bersihkanTeksSistem(t)}<` : m));
}

/** Metadata DOCX (docProps) tanpa kata itu; isi dokumen tidak disentuh. null bila tak dapat diolah. */
function bersihkanMetadataDocx(isi) {
  const entri = bacaZip(isi);
  if (!entri) return null;
  const ganti = new Map();
  for (const e of entri) {
    if (!METADATA_DOCX.test(e.nama)) continue;
    const bita = isiEntri(e);
    if (!bita) return null;
    const xml = bita.toString("utf8");
    if (!menyebutAleta(xml)) continue;
    ganti.set(e.nama, Buffer.from(bersihkanXmlMetadata(xml), "utf8"));
  }
  return ganti.size === 0 ? isi : tulisZip(entri, ganti);
}

function dekodeEntitas(teks) {
  return teks
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** { bagian: teks } dari isi DOCX; null bila tak terbaca. */
function teksDocx(isi) {
  const entri = bacaZip(isi);
  if (!entri) return null;
  const hasil = {};
  for (const e of entri) {
    if (!BAGIAN_TEKS_DOCX.test(e.nama)) continue;
    const bita = isiEntri(e);
    if (!bita) return null;
    hasil[e.nama] = dekodeEntitas(
      bita
        .toString("utf8")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:(?:tab|br)\b[^>]*\/>/g, " ")
        .replace(/<[^>]+>/g, "")
    );
  }
  return hasil;
}

const TUJUAN_RTF_DILEWATI = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "themedata", "colorschememapping", "datastore", "latentstyles", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "fldinst", "bkmkstart", "bkmkend", "datafield", "objdata"]);

/** Teks yang tampak dari RTF (tujuan teknis, gambar, dan metadata dilewati). */
function teksRtf(rtf) {
  const s = String(rtf);
  let hasil = "";
  const tumpuk = [];
  let lewati = 0;
  let lewatiUnicode = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "{") {
      tumpuk.push(lewati);
      let j = i + 1;
      let bintang = false;
      if (s[j] === "\\" && s[j + 1] === "*") {
        bintang = true;
        j += 2;
        while (s[j] === " ") j += 1;
      }
      if (s[j] === "\\") {
        const k = /^\\([a-z]+)/i.exec(s.slice(j, j + 40));
        if (k && (TUJUAN_RTF_DILEWATI.has(k[1].toLowerCase()) || (bintang && k[1].toLowerCase() !== "shpinst"))) lewati += 1;
      }
    } else if (c === "}") {
      lewati = tumpuk.length ? tumpuk.pop() : 0;
    } else if (c === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") {
        if (!lewati) hasil += n;
        i += 1;
      } else if (n === "'") {
        const h = s.slice(i + 2, i + 4);
        if (!lewati && /^[0-9a-f]{2}$/i.test(h)) {
          if (lewatiUnicode > 0) lewatiUnicode -= 1;
          else hasil += String.fromCharCode(parseInt(h, 16));
        }
        i += 3;
      } else if (n === "~") {
        if (!lewati) hasil += " ";
        i += 1;
      } else if (n === "-" || n === "_" || n === "*") {
        i += 1;
      } else {
        const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(s.slice(i, i + 40));
        if (!m) {
          i += 1;
          continue;
        }
        const kata = m[1].toLowerCase();
        if (!lewati) {
          if (kata === "par" || kata === "line" || kata === "sect" || kata === "page") hasil += "\n";
          else if (kata === "tab" || kata === "cell") hasil += " ";
          else if (kata === "u" && m[2] !== undefined) {
            const kode = Number(m[2]);
            hasil += String.fromCharCode(kode < 0 ? kode + 65536 : kode);
            lewatiUnicode = 1;
          }
        }
        i += m[0].length - 1;
      }
    } else if (c !== "\r" && c !== "\n") {
      if (lewati) continue;
      if (lewatiUnicode > 0) {
        lewatiUnicode -= 1;
        continue;
      }
      hasil += c;
    }
  }
  return hasil;
}

function ambilCmap(teks) {
  const peta = new Map();
  for (const blok of teks.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of blok[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      peta.set(parseInt(m[1], 16), Buffer.from(m[2], "hex").swap16().toString("utf16le"));
    }
  }
  for (const blok of teks.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of blok[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const dari = parseInt(m[1], 16);
      const sampai = parseInt(m[2], 16);
      const mulai = parseInt(m[3], 16);
      if (sampai - dari > 70000) continue;
      for (let k = dari; k <= sampai; k += 1) peta.set(k, String.fromCharCode(mulai + (k - dari)));
    }
  }
  return peta;
}

function lepasLiteralPdf(lit) {
  let h = "";
  for (let i = 0; i < lit.length; i += 1) {
    const c = lit[i];
    if (c !== "\\") {
      h += c;
      continue;
    }
    const n = lit[i + 1];
    const peta = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
    if (n in peta) {
      h += peta[n];
      i += 1;
    } else if (/[0-7]/.test(n)) {
      const m = /^[0-7]{1,3}/.exec(lit.slice(i + 1));
      h += String.fromCharCode(parseInt(m[0], 8));
      i += m[0].length;
    } else {
      i += 1;
    }
  }
  return h;
}

/** Teks tampak PDF (terbaik-upaya): aliran Flate dibuka, string Tj/TJ didekode lewat ToUnicode bila ada. */
function teksPdf(isi) {
  const s = isi.toString("latin1");
  const aliran = [];
  for (const m of s.matchAll(/stream\r?\n/g)) {
    const mulai = m.index + m[0].length;
    const akhir = s.indexOf("endstream", mulai);
    if (akhir < 0) continue;
    const mentah = isi.subarray(mulai, akhir);
    let teks = null;
    try {
      teks = zlib.inflateSync(mentah).toString("latin1");
    } catch {
      try {
        teks = zlib.inflateSync(mentah.subarray(0, Math.max(0, mentah.length - 1))).toString("latin1");
      } catch {
        teks = mentah.toString("latin1");
      }
    }
    aliran.push(teks);
  }
  const peta = aliran.filter((x) => /beginbf(?:char|range)/.test(x)).map(ambilCmap);
  const calon = new Set();
  for (const a of aliran) {
    if (!/\bBT\b/.test(a) || !/T[jJ]/.test(a)) continue;
    const mentahDua = [];
    const polos = [];
    const hexSemua = [];
    for (const m of a.matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)|<([0-9a-fA-F\s]+)>/g)) {
      if (m[1] !== undefined) polos.push(lepasLiteralPdf(m[1]));
      else {
        const hex = m[2].replace(/\s+/g, "");
        if (hex.length >= 2) hexSemua.push(Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex"));
      }
    }
    mentahDua.push(polos.join(""));
    mentahDua.push(hexSemua.map((b) => b.toString("latin1")).join(""));
    for (const t of mentahDua) calon.add(t);
    for (const cm of peta) {
      let dua = "";
      for (const b of hexSemua) {
        for (let k = 0; k + 1 < b.length; k += 2) {
          const t = cm.get((b[k] << 8) | b[k + 1]);
          if (t) dua += t;
        }
      }
      if (dua) calon.add(dua);
      let satu = "";
      for (const b of hexSemua) for (const bt of b) satu += cm.get(bt) || "";
      if (satu) calon.add(satu);
    }
  }
  return [...calon];
}

function berTandaTangan(isi) {
  return /\/ByteRange\s*\[/.test(isi.toString("latin1"));
}

/**
 * Metadata berkas (RTF/PDF/DOCX) tanpa kata itu - SISTEM, tanpa menyentuh isi
 * naskah. Pulang { ok:true, isi, dibersihkan } atau { ok:false, alasan, pesan }
 * bila metadata PDF yang BERTANDA TANGAN elektronik memuat kata itu (mengubahnya
 * membatalkan tanda tangan) atau DOCX/DOC tak dapat diolah.
 */
function bersihkanMetadataBerkas(isi, nama = "") {
  if (!Buffer.isBuffer(isi)) return { ok: true, isi, dibersihkan: false };
  const bentuk = kenaliBentuk(isi);
  if (bentuk === "pdf") {
    const baru = tanpaTandaAletaMetadata(isi);
    if (baru !== isi) {
      if (berTandaTangan(isi)) {
        return {
          ok: false,
          alasan: KODE_BERKAS,
          pesan: `Berkas "${nama || "PDF"}" sudah bertanda tangan elektronik dan metadatanya memuat kata 'ALETA'; buat ulang PDF-nya tanpa kata itu sebelum diunggah ke SIPP.`,
        };
      }
      return { ok: true, isi: baru, dibersihkan: true };
    }
    return { ok: true, isi, dibersihkan: false };
  }
  if (bentuk === "rtf") {
    const baru = tanpaTandaAletaMetadata(isi);
    return { ok: true, isi: baru, dibersihkan: baru !== isi };
  }
  if (bentuk === "zip") {
    let baru;
    try {
      baru = bersihkanMetadataDocx(isi);
    } catch {
      baru = null;
    }
    if (baru === null) {
      return { ok: false, alasan: KODE_BERKAS, pesan: `Berkas "${nama || "DOCX"}" tidak dapat diperiksa metadatanya; simpan ulang dari aplikasi pengolah kata lalu unggah kembali.` };
    }
    return { ok: true, isi: baru, dibersihkan: baru !== isi };
  }
  return { ok: true, isi, dibersihkan: false };
}

/**
 * Periksa ISI berkas (teks naskah) sesudah metadatanya dibersihkan. Naskah
 * hukum TIDAK diubah: bila memuat kata itu di luar teks dari SIPP, ditahan.
 * Pulang { ok:true } atau { ok:false, alasan:"isi_berkas_menyebut_aleta", pesan, bagian }.
 */
function periksaIsiBerkas(isi, { nama = "", dariSipp = [] } = {}) {
  if (!Buffer.isBuffer(isi) || isi.length === 0) return { ok: true };
  const bentuk = kenaliBentuk(isi);
  const tahanBerkas = (bagian) => ({ ok: false, alasan: KODE_BERKAS, bagian, pesan: pesanBerkas(nama, bagian) });
  const kena = (teks) => menyebutAletaBaru(teks, { dariSipp });
  if (bentuk === "rtf") {
    return kena(teksRtf(isi.toString("latin1"))) ? tahanBerkas("isi dokumen") : { ok: true };
  }
  if (bentuk === "zip") {
    const bagian = teksDocx(isi);
    if (bagian === null) return { ok: false, alasan: KODE_BERKAS, bagian: "", pesan: `Berkas "${nama || "DOCX"}" tidak dapat dibaca isinya untuk diperiksa; simpan ulang dari aplikasi pengolah kata lalu unggah kembali.` };
    for (const [b, teks] of Object.entries(bagian)) {
      if (kena(teks)) return tahanBerkas(/document\.xml$/i.test(b) ? "isi dokumen" : /header|footer/i.test(b) ? "kepala/kaki halaman" : "catatan dokumen");
    }
    return { ok: true };
  }
  if (bentuk === "pdf") {
    try {
      for (const t of teksPdf(isi)) {
        if (kena(t)) return tahanBerkas("isi dokumen");
      }
    } catch {
      /* pembacaan terbaik-upaya; lanjut ke pemindaian bita */
    }
    // Sisa tulisan polos (anotasi, bookmark, teks tak termampat) sesudah metadata dibersihkan.
    const kasar = isi.toString("latin1");
    if (kena(kasar.replace(/stream\r?\n[\s\S]*?endstream/g, " "))) return tahanBerkas("isi dokumen");
    return { ok: true };
  }
  if (bentuk === "doc") {
    // Biner lama: teks dan metadata bercampur, tak dapat dibersihkan - ditahan bila ada.
    return menyebutAletaBaruDiBita(isi, dariSipp) ? tahanBerkas("isi atau properti dokumen") : { ok: true };
  }
  return { ok: true };
}

function menyebutAletaBaruDiBita(isi, dariSipp) {
  const teks = `${isi.toString("latin1")}\n${isi.toString("utf16le")}\n${isi.subarray(1).toString("utf16le")}`;
  return menyebutAletaBaru(teks, { dariSipp });
}

/**
 * Pintu tunggal berkas yang akan masuk ke folder SIPP: metadata dibersihkan
 * (sistem), lalu isinya diperiksa (manusia). Pulang { ok:true, isi, dibersihkan }
 * atau { ok:false, alasan, pesan }.
 */
function siapkanBerkasSipp(isi, opsi = {}) {
  const meta = bersihkanMetadataBerkas(isi, opsi.nama);
  if (!meta.ok) return meta;
  const periksa = periksaIsiBerkas(meta.isi, opsi);
  if (!periksa.ok) return periksa;
  return { ok: true, isi: meta.isi, dibersihkan: meta.dibersihkan };
}

// ============================================================================
// Pembantu pencatat bocoran (hanya log) - lihat db_config.js
// ============================================================================

const PERINTAH_TULIS = /^\s*(?:\/\*[\s\S]*?\*\/\s*)?(INSERT|UPDATE|REPLACE|DELETE)\b/i;

/**
 * true bila perintah SQL menulis dan teksnya atau parameternya memuat kata itu.
 * Hanya untuk LOG peringatan di db_config (kolam SIPP) - jaring terakhir untuk
 * jalur yang lolos dari penjaga per-jalur; tidak menolak apa pun, sebab teks dari
 * data SIPP sendiri (nama pihak) tidak dapat dibedakan di titik ini.
 */
function tulisanBocor(sql, params) {
  const teks = typeof sql === "string" ? sql : sql && typeof sql === "object" ? String(sql.sql || "") : "";
  if (!PERINTAH_TULIS.test(teks)) return false;
  const nilai = Array.isArray(params) ? params : sql && typeof sql === "object" && Array.isArray(sql.values) ? sql.values : [];
  for (const [, t] of semuaTeks(nilai, "")) if (menyebutAleta(t)) return true;
  return menyebutAleta(teks);
}

// ============================================================================
// DAFTAR JALUR TULIS KE SIPP (dijaga uji penjaga-tanda-sipp-17okt)
// ============================================================================
//
// SETIAP berkas bot yang menulis ke basis data SIPP (INSERT/UPDATE/REPLACE/DELETE
// pada tabel yang bukan aleta_*) atau ke folder berkas SIPP WAJIB tercantum di
// salah satu dari dua daftar ini. Berkas baru yang menulis ke SIPP tanpa
// tercantum MEMERAHKAN uji - yang menambah jalur baru harus memutuskan: dipasangi
// penjaga (JALUR_TULIS_SIPP, beserta kata panggilan yang wajib ada di sumbernya)
// atau dikecualikan beserta sebabnya (JALUR_DIKECUALIKAN).
//
//   berkas   = jalur relatif terhadap aleta_bot/
//   penjaga  = potongan kode yang WAJIB ada di sumber (`penjagaDi` bila penjaganya
//              di berkas lain, mis. rute)
//   sasaran  = apa yang ditulis / dari rute mana

const JALUR_TULIS_SIPP = Object.freeze([
  {
    berkas: "services/penetapanTulisService.js",
    penjaga: ["penjagaTandaSipp.periksaRencana(", "penjagaTandaSipp.periksaIsian("],
    sasaran: "penjalan rencana bersama (penetapan PMH/PPP/PJS/PHS, bongkar, tunda/putus sidang, putusan, penetapan kembali) + sebab majelis & Data Umum",
  },
  {
    berkas: "services/sidangHasilService.js",
    penjaga: ['require("./tandaAletaService")', "penetapan.jalankanRencana("],
    sasaran: "tunda/putus sidang: alasan & agenda ditahan di susunRencanaTunda; rencananya lewat penjalan bersama",
  },
  {
    berkas: "services/putusanTulisService.js",
    penjaga: ["penjagaTandaSipp.periksaIsian(", "jalankanRencana: penetapan.jalankanRencana"],
    sasaran: "amar, pertimbangan hukum, catatan putusan (ketikan hakim); nama pihak dari SIPP dikecualikan",
  },
  {
    berkas: "services/penetapanKembaliService.js",
    penjaga: ["menyebutAleta(teks)"],
    penjagaDi: [{ berkas: "routes/penetapanKembaliRoutes.js", kode: "jalankanRencanaUtuh" }],
    sasaran: "alasan penetapan kembali ('Lainnya'); rencana dijalankan lewat penjalan bersama",
  },
  {
    berkas: "services/mediatorTulisService.js",
    penjaga: ["penjagaTandaSipp.periksaIsian(", "penjagaTandaSipp.periksaRencana("],
    sasaran: "penetapan mediator (No. Penetapan Mediator) + penjalan rencana mediasi",
  },
  {
    berkas: "services/kasirJurnalService.js",
    penjaga: ["penjagaTandaSipp.periksaIsian(", "penjagaTandaSipp.periksaRencana("],
    sasaran: "jurnal kasir (uraian, keterangan) + penjalan rencana kasir",
  },
  {
    berkas: "services/courtCalendarTulisService.js",
    penjaga: ["menyebutAleta(", "penjagaTandaSipp.periksaRencana("],
    sasaran: "Court Calendar (agenda, keterangan) + penjalan rencana",
  },
  {
    berkas: "services/sippPositaService.js",
    penjaga: ["penjagaTandaSipp.periksaIsian("],
    sasaran: "posita yang dirapikan/disambung (teks SIPP sendiri; kemunculan tidak boleh bertambah)",
  },
  {
    berkas: "services/putusanUnggahService.js",
    penjaga: ["penjagaTandaSipp.siapkanBerkasSipp(", "penjagaTandaSipp.periksaRencana(", "penjagaTandaSipp.dataSippMemuatAleta("],
    sasaran: "e-Doc putusan/anonimisasi: metadata dibersihkan, isi naskah diperiksa, nama berkas & baris audit diperiksa",
  },
  {
    berkas: "services/basUnggahService.js",
    penjaga: ["penjagaTandaSipp.siapkanBerkasSipp(", "penjagaTandaSipp.namaBerkasBersih("],
    sasaran: "e-Doc BAS satu sidang: metadata dibersihkan, isi naskah diperiksa, nama berkas bersih",
  },
  {
    berkas: "services/dokumenPenetapanService.js",
    penjaga: ["penjagaTandaSipp.siapkanBerkasSipp(", "penjagaTandaSipp.periksaRencana("],
    sasaran: "e-Doc penetapan PMH/PPP/PJS/PHS (PDF): metadata dibersihkan, isi diperiksa",
  },
  {
    berkas: "services/penetapanEdocService.js",
    penjaga: ["penjagaTandaSipp.periksaIsiBerkas("],
    sasaran: "naskah RTF penetapan diperiksa sebelum dibuat PDF; penulisan ke SIPP lewat dokumenPenetapanService.simpanKeSipp",
  },
  {
    berkas: "services/antrianSinkronService.js",
    penjaga: ["penjagaTandaSipp.periksaRencana("],
    sasaran: "pendaftaran jadwal sidang ke aplikasi antrian (isian dari data SIPP)",
  },
  {
    berkas: "services/abtPengaturanService.js",
    penjaga: [],
    penjagaDi: [{ berkas: "routes/abtPengaturanRoutes.js", kode: "penjagaTandaSipp.periksaPengaturanAbt(" }],
    sasaran: "Pengaturan SIPP & ABT (menu, variabel, templat tanya jawab, identitas satker): dijaga di rute sebelum layanan menyentuh basis data ABT",
  },
]);

const JALUR_DIKECUALIKAN = Object.freeze({
  "services/antrianDisidang.js": "hanya menyegarkan penanda waktu layar antrian (NOW()), tanpa teks",
  "services/antrianOnlineService.js": "hanya menyetel kolom online (0/1) dan waktu NOW() di antrian_sidang, tanpa teks",
  "services/kehadiranAntrianService.js": "hanya mengisi/mengosongkan kolom waktu (NOW()/NULL) di antrian_sidang, tanpa teks",
  "services/panggilanAntrianService.js": "hanya menyetel disidang (angka ruang) dan jam NOW() di antrian_sidang, tanpa teks",
  "services/sidangSelesaiService.js": "tulisan ke SIPP hanya angka: kolom disidang di antrian_sidang dan status antrian; selebihnya tabel aleta_* milik ALETA",
  "services/sinkronDumpService.js": "membuat berkas dump SQL dari SIPP untuk salinan uji; tidak menulis ke SIPP",
});

module.exports = {
  KODE,
  KODE_BERKAS,
  pesanIsian,
  pesanBerkas,
  menyebutAleta,
  menyebutAletaBaru,
  hitungAleta,
  periksaIsian,
  periksaRencana,
  isianPengaturanAbt,
  periksaPengaturanAbt,
  langkahDatar,
  kolomUntukParam,
  dataSippMemuatAleta,
  bersihkanTeksSistem,
  namaBerkasBersih,
  agenKlienBersih,
  kenaliBentuk,
  bersihkanMetadataBerkas,
  periksaIsiBerkas,
  siapkanBerkasSipp,
  teksRtf,
  teksPdf,
  teksDocx,
  tulisanBocor,
  JALUR_TULIS_SIPP,
  JALUR_DIKECUALIKAN,
};
