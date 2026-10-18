"use strict";

/**
 * ============================================================================
 * JJ2 (18 Okt 2026) - DUA ISIAN KHUSUS DARI JAWABAN e-COURT
 * ============================================================================
 *
 *   9164  SITA: tanggapan Tergugat/Termohon atas permohonan sita di sidang insidentil
 *         (bawaan ABT "keberatan atas permohonan sita tersebut dengan alasan ...")
 *         <- dalil JAWABAN yang menyebut sita dengan Tergugat/Termohon sebagai pelakunya.
 *   9283  HARTA BERSAMA REKONVENSI: objek yang digugat dalam rekonvensi (satu objek per baris)
 *         <- daftar objek di bagian rekonvensi (dalil atau petitum) sesudah kalimat pengantar "harta bersama ... berupa:".
 *
 * MURNI (tanpa basis data/jaringan). Keluaran hanya kata-kata surat; tidak ada kalimat karangan. Pemanggil
 * (isiGugatanService) menandainya ragu dan jagaIsianLama - belum diukur atas berkas sungguhan.
 */

const J = require("./jawabMenjawabEcourtService");
const TJ = require("./tanyaJawabEcourtService");

const KODE = Object.freeze({ tanggapanSita: "9164", hbRekonvensi: "9283" });

const RE_SITA = /\bsita\b|penyitaan|conservatoir|conservatoir\s+beslag|\bbeslag\b/i;
const RE_SIKAP_SITA = /\b(?:keberatan|berkeberatan|menolak|tidak\s+setuju|tidak\s+sependapat|membantah|tidak\s+keberatan|menyetujui|bersedia|mengakui|tidak\s+benar|tidak\s+beralasan|tidak\s+berdasar)\b/i;
const RE_SUBJEK_PELAKU = /^(?:bahwa\s+)?(?:(?:Tergugat|Termohon)(?:\s+(?:Konvensi|Rekonvensi|I|II))?|saya|kami)\s+/i;

function potongDiKlausa(s, maks) {
  if (s.length <= maks) return s;
  const kepala = s.slice(0, maks);
  const batas = kepala.lastIndexOf(", ");
  return (batas >= maks * 0.5 ? kepala.slice(0, batas) : kepala.slice(0, Math.max(kepala.lastIndexOf(" "), 1))).replace(/[\s.;:,]+$/, "");
}

/**
 * Tanggapan atas sita dari dalil jawaban. Hanya dalil yang SUBJEKNYA Tergugat/Termohon (atau "saya/kami" penulis)
 * dan memuat sikap tegas; dalil yang hanya menyebut sita tanpa sikap Tergugat tidak dipakai (diketik petugas).
 * @returns {null | {nilai:string, kutipan:string, kandidat:number}}
 */
function tanggapanSita(bersih, opsi) {
  const o = opsi || {};
  const penulis = o.penulis || "Tergugat";
  const calon = (bersih && Array.isArray(bersih.dalil) ? bersih.dalil : []).filter((p) => RE_SITA.test(p));
  if (!calon.length) return null;
  for (const par of calon) {
    if (J.RE_KUTIPAN_HUKUM.test(par) && !RE_SIKAP_SITA.test(par)) continue;
    const isi = TJ.amankan(J.tanpaNomor(par));
    if (!RE_SUBJEK_PELAKU.test(isi) || !RE_SIKAP_SITA.test(isi)) continue;
    const sisa = isi.replace(RE_SUBJEK_PELAKU, "");
    const sama = J.samakanSebutan(sisa, o.sebutan, penulis);
    const nilai = potongDiKlausa(sama.teks.replace(/[\s.;:,]+$/, ""), 400);
    if (nilai.replace(/[^A-Za-z]/g, "").length < 20) continue;
    return { nilai: J.lcfirst(nilai), kutipan: isi.slice(0, 260), kandidat: calon.length, orangPertamaDiganti: sama.diganti };
  }
  return null;
}

const RE_BENDA = /\b(?:sebidang|tanah|rumah|bangunan|mobil|motor|sepeda\s+motor|kendaraan|sertifikat|shm|toko|ruko|kios|kebun|sawah|ladang|tabungan|deposito|rekening|emas|perhiasan|perabot|perabotan|ternak|hewan|usaha|saham|uang|rp\.?\s*\d|seluas|luas|m2|m²|meter|unit|buah|ekor|hektar|bpkb|stnk)\b/i;
const RE_PENGANTAR_HB = /harta\s+bersama|harta\s+gono[- ]gini|harta\s+gono\s+gini/i;
const RE_PENGANTAR_DAFTAR = /\b(?:berupa|yaitu|sebagai\s+berikut|terdiri\s+dari|meliputi|antara\s+lain|adalah)\b|:\s*$/i;
const RE_PENANDA_BUTIR = /^(?:\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s|[-•*]\s)/;

function bersihkanObjek(t) {
  return TJ.amankan(t.replace(RE_PENANDA_BUTIR, "")).replace(/[\s;,]+(?:dan|serta)?\s*$/i, "").replace(/[\s.;:,]+$/, "").trim();
}

/**
 * Objek harta bersama yang digugat dalam rekonvensi. Hanya bila bagian rekonvensi jelas ada dan kalimat pengantar
 * menyebut harta bersama; objek = butir bernomor/berhuruf yang memuat kata benda harta, berurutan sesudah pengantar.
 * @returns {null | {nilai:string, objek:string[], kutipan:string}}
 */
function objekHartaBersamaRekonvensi(bersih) {
  if (!bersih || !Array.isArray(bersih.paragraf)) return null;
  const par = bersih.paragraf;
  const awal = par.findIndex((p) => p.judul && /rekon[pv]ensi/i.test(p.teks));
  if (awal < 0) return null;
  for (let i = awal; i < par.length; i += 1) {
    const p = par[i];
    if (p.judul || !RE_PENGANTAR_HB.test(p.teks) || !RE_PENGANTAR_DAFTAR.test(p.teks)) continue;
    const objek = [];
    // Daftar menyatu dalam pengantar: "... berupa: 1. sebidang tanah ...; 2. sebuah mobil ...".
    const sesudahTitik = p.teks.split(/[:]\s+/).slice(1).join(": ");
    if (sesudahTitik && /(?:^|\s)(?:\(?1[.)]|\(?a[.)])\s/.test(sesudahTitik)) {
      for (const bagian of sesudahTitik.split(/(?:^|\s)\(?(?:\d{1,2}|[a-z])[.)]\s+/).map((x) => x.trim()).filter(Boolean)) {
        if (RE_BENDA.test(bagian)) objek.push(bersihkanObjek(bagian));
      }
    }
    // Butir terpisah sesudah pengantar.
    if (!objek.length) {
      for (let j = i + 1; j < par.length; j += 1) {
        const q = par[j];
        if (q.judul || !RE_PENANDA_BUTIR.test(q.teks) || !RE_BENDA.test(q.teks)) break;
        objek.push(bersihkanObjek(q.teks));
      }
    }
    const rapi = [...new Set(objek.map((x) => x.replace(/\s+/g, " ")).filter((x) => x.length >= 8 && x.length <= 300))].slice(0, 15);
    if (rapi.length) return { nilai: rapi.join("\n"), objek: rapi, kutipan: p.teks.slice(0, 240) };
  }
  return null;
}

module.exports = { KODE, tanggapanSita, objekHartaBersamaRekonvensi };
