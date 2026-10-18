"use strict";

/**
 * ============================================================================
 * JJ2 (18 Okt 2026) - JAWABAN / REPLIK / DUPLIK TERTULIS -> TANYA-JAWAB ABT PER SIDANG
 * ============================================================================
 *
 * Keputusan pengguna no. 74: pokok jawaban, replik, dan duplik dari e-Court ditulis OTOMATIS ke penyunting tanya-jawab
 * ABT (6112 Jawaban Lisan, 6113 Replik Lisan, 6114 Duplik Lisan; 2018-2020 membaca baris yang sama) BILA hasil
 * pembersihan "rapi". Tidak rapi -> tetap tombol Salin, dengan keterangan "format berkas tidak rapi, silakan salin dan
 * periksa".
 *
 * Berkas ini MURNI: tidak menyentuh basis data, jaringan, ABT, atau SIPP. Yang menulis adalah ekstensi (panel Blangko ABT),
 * lewat jalur simpan tanya-jawab yang sudah ada (abt-klien.js simpanTanyaJawab), hanya bila baris ABT untuk sidang itu
 * KOSONG dan hanya atas sidang yang agendanya sesuai (lihat blangko-derry-isian.js, isiJawabMenjawabOtomatis).
 *
 * UKURAN "RAPI" (semua harus terpenuhi - diuji tanya-jawab-ecourt-18okt.test.ts, angka ambangnya di AMBANG):
 *   1. jenis berkas pasti: jenis e-Court, judul, dan isi sepakat; pengunggah dikenali dan cocok dengan kolomnya
 *      (Jawaban/Duplik = Tergugat atau Termohon, Replik = Penggugat atau Pemohon; Turut Tergugat tidak);
 *   2. satu berkas saja untuk peran itu; bukan hasil OCR; bukan rereplik;
 *   3. kop surat dan isi terpisah jelas (ada "Bahwa ..." atau judul bagian);
 *   4. jumlah butir dalil 2 sampai 30, tiap butir paling panjang 1500 huruf, seluruhnya 150 sampai 12000 huruf;
 *   5. SEMUA butir berstruktur dalil (diawali "Bahwa" / nomor / huruf, atau memuat sikap: mengakui, membantah, menolak, ...);
 *   6. tidak tersisa kop, salam, identitas, tanggal-tempat, tanda tangan, nomor halaman, surel, telepon, garis isian ____;
 *   7. tanpa karakter rusak (U+FFFD, mojibake, karakter kendali, huruf di luar latin1 ABT), huruf >= 80% dari isi,
 *      huruf tunggal berserak <= 6%, kata bercampur angka <= 1%;
 *   8. paling sedikit 80% butir berakhir tanda baca;
 *   9. surat tidak diketik huruf besar semua dan kata ganti orang pertama (saya/kami) tidak perlu diganti.
 *
 * Baris yang ditulis: judul bagian ("Dalam Konvensi:") dengan jawaban kosong, lalu satu baris per butir dalil -
 * jawaban = isi dalil tanpa kata "Bahwa" di depan (daftar keterangan putusan menambahkannya sendiri), berakhir ";".
 */

const J = require("./jawabMenjawabEcourtService");

const TUJUAN = Object.freeze({
  jawaban: Object.freeze({ kode: "6112", rujukan: "2018", kunci: "jawaban lisan 0047", pihak: "0047", nama: "Jawaban" }),
  replik: Object.freeze({ kode: "6113", rujukan: "2019", kunci: "replik lisan 0046", pihak: "0046", nama: "Replik" }),
  duplik: Object.freeze({ kode: "6114", rujukan: "2020", kunci: "duplik lisan 0047", pihak: "0047", nama: "Duplik" }),
});

const AMBANG = Object.freeze({
  butirMin: 2,
  butirMaks: 30,
  butirPanjangMaks: 1500,
  totalMin: 150,
  totalMaks: 12000,
  akhirTandaMin: 0.8,
  hurufMin: 0.8,
  hurufTunggalMaks: 0.06,
  kataCampurMaks: 0.01,
});

const RE_DALIL = /^(?:bahwa\b|\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s)/i;
const RE_SIKAP = /\b(?:mengakui|membenarkan|membantah|menolak|menyangkal|keberatan|berkeberatan|tidak\s+benar|menerima|bersedia|memohon|mohon|menyatakan|berpendapat|mengajukan|tetap\s+pada)\b/i;
const RE_SISA_KOP =
  /hormat\s+(?:kami|saya)|wassalam|assalamu|bismillah|\bttd\b|tanda\s+tangan|konsultan\s+hukum|kantor\s+hukum|law\s+firm|perkara\s+nomor|nomor\s+perkara|\bno\.?\s*perkara\b|\bnip\b\s*[:.]?\s*\d|\bnik\b\s*[:.]?\s*\d|_{3,}|\.{6,}/i;
const RE_SISA_PENUTUP_PENDEK = /\bkuasa\s+hukum\b|\badvokat\b|\bS\.?\s?H\.?\s*(?:,|\.|\s*M\.?\s?H)|\bpenggugat\s*,?\s*$|\btergugat\s*,?\s*$/i;

/** Teks aman untuk kolom latin1 ABT (tanda kutip/garis miring lengkung -> biasa). */
function amankan(s) {
  return String(s == null ? "" : s)
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[­​‌‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const RE_DI_LUAR_LATIN1 = /[^\u0009\u000A\u000D -~ -ÿ]/;

/** Cacat karakter / OCR dalam satu teks: daftar alasan (kosong = bersih). */
function cacatKarakter(teks) {
  const t = String(teks || "");
  const alasan = [];
  if (/�/.test(t)) alasan.push("ada karakter rusak");
  if (/Ã[\u0080-¿]|â€|Â[\u0080-¿]/.test(t)) alasan.push("ada huruf berantakan (salah sandi)");
  if (/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/.test(t)) alasan.push("ada karakter kendali");
  if (RE_DI_LUAR_LATIN1.test(amankan(t))) alasan.push("ada huruf di luar yang dapat disimpan ABT");
  const tanpaSpasi = t.replace(/\s+/g, "");
  if (tanpaSpasi.length) {
    const huruf = (tanpaSpasi.match(/[A-Za-z]/g) || []).length / tanpaSpasi.length;
    if (huruf < AMBANG.hurufMin) alasan.push("terlalu banyak angka atau tanda baca");
  }
  const kata = t.split(/\s+/).filter(Boolean);
  if (kata.length >= 8) {
    // Huruf tunggal berserak = tanda OCR memecah kata; penomoran "a." / "b)" membawa tanda baca sehingga bukan token tunggal.
    const tunggal = kata.filter((w) => /^[A-Za-z]$/.test(w)).length;
    if (tunggal / kata.length > AMBANG.hurufTunggalMaks) alasan.push("huruf berserak (kata terpecah)");
    const campur = kata.filter((w) => w.length >= 4 && /[A-Za-z]\d[A-Za-z]|\d[A-Za-z]{2,}\d/.test(w) && !/\d+\/[A-Za-z0-9.\/-]+/.test(w)).length;
    if (campur / kata.length > AMBANG.kataCampurMaks) alasan.push("kata bercampur angka (tanda OCR keliru)");
  }
  return alasan;
}

function terstruktur(par) {
  return RE_DALIL.test(par) || RE_SIKAP.test(par);
}

function judulBagianRapi(teks) {
  const t = amankan(teks).replace(/[:;.]+$/, "").toLowerCase();
  return `${t.replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase())}:`;
}

function ucfirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Sisa kop/penutup di baris yang akan ditulis: daftar alasan. */
function sisaKop(teksBaris, adalahTerakhir) {
  const alasan = [];
  for (const t of teksBaris) {
    const bersih = J.tanpaNomor(t);
    if (J.RE_NOMOR_HALAMAN.test(bersih) || /^(?:hal(?:aman)?\.?\s*\d|page\s*\d)/i.test(bersih)) alasan.push("nomor halaman tersisa");
    if (J.RE_TANGGAL_TEMPAT.test(bersih)) alasan.push("tempat dan tanggal surat tersisa");
    if (J.RE_IDENTITAS.test(bersih)) alasan.push("identitas pihak tersisa");
    if (J.RE_SALAM.test(bersih)) alasan.push("salam atau kop tersisa");
    if (J.RE_KONTAK.test(t)) alasan.push("surel, telepon, atau alamat web tersisa");
    if (RE_SISA_KOP.test(t)) alasan.push("kop, penutup, atau tanda tangan tersisa");
    if ((t.length < 100 || adalahTerakhir) && RE_SISA_PENUTUP_PENDEK.test(t) && t.length < 140) alasan.push("nama kuasa atau tanda tangan tersisa");
  }
  return [...new Set(alasan)];
}

/**
 * Satu surat -> baris tanya-jawab + putusan rapi/tidak.
 * @param {{teks:string, k:object, baca?:string, sebutan?:{lawan:string, pelaku:string}, banyakSePeran?:number, diunggah?:string}} m
 *   k = hasil J.kenaliJenis (peran, pihak, turut, ragu, rekonvensiDuplik, catatan)
 * @returns {{rapi:boolean, alasan:string[], peran:string, kode:string, rujukan:string, kunci:string, pihak:string,
 *            baris:Array<{tanya:string, jawab:string}>, ukuran:object, diunggah:string}}
 */
function tanyaJawabDariSurat(m) {
  const x = m || {};
  const k = x.k || {};
  const sebutan = x.sebutan || { lawan: "Penggugat", pelaku: "Tergugat" };
  const tujuan = TUJUAN[k.peran] || null;
  const hasil = { rapi: false, alasan: [], peran: k.peran || "", kode: tujuan ? tujuan.kode : "", rujukan: tujuan ? tujuan.rujukan : "", kunci: tujuan ? tujuan.kunci : "", pihak: k.pihak || "", baris: [], ukuran: {}, diunggah: String(x.diunggah || "").slice(0, 10) };
  if (!tujuan) {
    hasil.alasan.push("bukan jawaban, replik, atau duplik");
    return hasil;
  }
  const alasan = hasil.alasan;
  if (k.ragu) alasan.push(`jenis berkas diragukan${k.catatan && k.catatan.length ? ` (${k.catatan[0]})` : ""}`);
  if (k.turut) alasan.push("diajukan oleh Turut Tergugat/Termohon");
  if (k.rekonvensiDuplik) alasan.push("rereplik (duplik rekonvensi) tidak punya kolom tanya-jawab sendiri");
  if (!k.pihak) alasan.push("pengunggah tidak dikenali");
  else if (k.pihak !== tujuan.pihak) alasan.push("pengunggah tidak cocok dengan kolom tanya-jawabnya");
  if (x.baca === "ocr") alasan.push("dibaca OCR");
  if ((x.banyakSePeran || 1) > 1) alasan.push(`ada ${x.banyakSePeran} berkas ${tujuan.nama.toLowerCase()} - tidak jelas yang dipakai`);

  const bersih = J.bersihkanSurat(x.teks);
  if (!bersih.yakin) alasan.push("kop dan isi surat tidak terpisah jelas");
  const penulis = J.sebutanPeran(k.peran, k.pihak, sebutan, k.turut) || tujuan.nama;
  const judulPada = new Map();
  for (const j of bersih.judulBagian) judulPada.set(j.indeks, [...(judulPada.get(j.indeks) || []), j.teks]);

  const baris = [];
  const butirAsli = [];
  let dilewati = 0;
  let nomor = 0;
  let diganti = false;
  let tersisaOrangPertama = false;
  let hurufBesar = false;
  const tambahJudul = (i) => {
    for (const j of judulPada.get(i) || []) baris.push({ tanya: judulBagianRapi(j), jawab: "" });
  };
  bersih.dalil.forEach((par, i) => {
    tambahJudul(i);
    const sikap = /\b(?:tidak\s+benar|membantah|menolak|mengakui|membenarkan|tetap)\b/i.test(par);
    if ((J.RE_KUTIPAN_HUKUM.test(par) || J.RE_DEFINISI.test(par)) && !sikap) {
      dilewati += 1;
      return;
    }
    let isi = amankan(J.tanpaNomor(par));
    if (J.bagianHuruf(isi) >= 0.8 && isi.replace(/[^A-Za-z]/g, "").length >= 12) hurufBesar = true;
    isi = isi.replace(/^bahwa[,]?\s+/i, "");
    const sama = J.samakanSebutan(isi, sebutan, k.turut ? "" : penulis);
    if (sama.diganti) diganti = true;
    if (sama.orangPertamaTersisa) tersisaOrangPertama = true;
    isi = sama.teks;
    if (isi.replace(/[^A-Za-z]/g, "").length < 20) {
      dilewati += 1;
      return;
    }
    isi = ucfirst(isi.replace(/[\s.;:,]+$/, "")) + (/[?!]$/.test(isi.trim()) ? "" : ";");
    if (/[?!];$/.test(isi)) isi = isi.slice(0, -1);
    nomor += 1;
    butirAsli.push({ asal: par, isi });
    baris.push({ tanya: `${tujuan.nama} ${penulis} (tertulis), butir ${nomor}:`, jawab: isi });
  });
  tambahJudul(bersih.dalil.length);

  const jawabRows = baris.filter((r) => r.jawab);
  const total = jawabRows.reduce((n, r) => n + r.jawab.length, 0);
  const akhirTanda = jawabRows.length ? jawabRows.filter((r) => /[.;:?!)"']$/.test(r.jawab)).length / jawabRows.length : 0;
  const terstrukturSemua = butirAsli.every((b) => terstruktur(b.asal));
  const terpanjang = jawabRows.reduce((n, r) => Math.max(n, r.jawab.length), 0);
  hasil.ukuran = { butir: jawabRows.length, judul: baris.length - jawabRows.length, total, terpanjang, dilewati, akhirTanda: Math.round(akhirTanda * 100) / 100, terstrukturSemua, dibuang: bersih.dibuang };

  if (hurufBesar) alasan.push("surat diketik huruf besar semua");
  if (diganti) alasan.push("kata ganti orang pertama (saya/kami) perlu diganti sebutan pihak");
  if (tersisaOrangPertama) alasan.push("kata ganti orang pertama dari kuasa tersisa");
  if (jawabRows.length < AMBANG.butirMin) alasan.push(`butir dalil terlalu sedikit (${jawabRows.length})`);
  if (jawabRows.length > AMBANG.butirMaks) alasan.push(`butir dalil terlalu banyak (${jawabRows.length})`);
  if (total < AMBANG.totalMin) alasan.push("isi terlalu pendek");
  if (total > AMBANG.totalMaks) alasan.push("isi terlalu panjang");
  if (terpanjang > AMBANG.butirPanjangMaks) alasan.push("ada butir yang terlalu panjang (kemungkinan beberapa paragraf menyatu)");
  if (!terstrukturSemua) alasan.push("ada butir yang tidak berbentuk dalil");
  if (jawabRows.length && akhirTanda < AMBANG.akhirTandaMin) alasan.push("banyak butir terpotong tanpa tanda baca akhir");
  alasan.push(...sisaKop(jawabRows.map((r) => r.jawab), false));
  if (jawabRows.length) alasan.push(...sisaKop([jawabRows[jawabRows.length - 1].jawab], true).filter((a) => !alasan.includes(a)));
  alasan.push(...cacatKarakter(jawabRows.map((r) => r.jawab).join(" ")).filter((a) => !alasan.includes(a)));

  hasil.alasan = [...new Set(alasan)];
  hasil.rapi = hasil.alasan.length === 0;
  hasil.baris = hasil.rapi ? baris : [];
  return hasil;
}

/** Keterangan untuk petugas (bahasa biasa, tanpa kode). */
function keteranganFormat(h) {
  if (!h) return "";
  return h.rapi
    ? "Berkas ini rapi: ditulis otomatis ke tanya-jawab sidang yang agendanya sesuai bila barisnya masih kosong."
    : "Format berkas tidak rapi, silakan salin dan periksa.";
}

module.exports = { TUJUAN, AMBANG, tanyaJawabDariSurat, keteranganFormat, cacatKarakter, amankan, terstruktur, sisaKop };
