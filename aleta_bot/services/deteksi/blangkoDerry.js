"use strict";

/**
 * ============================================================================
 * F2.3 (16 Okt 2026): PELENGKAP VARIABEL "BLANGKO ABT BY DERRY BRIANTONO"
 * UNTUK JENIS PERKARA SELAIN CERAI
 * ============================================================================
 *
 * Modul per jenis (itsbat.js, waris.js, waliAdhol.js, hartaBersama.js, ...)
 * sudah membaca sebagian besar isian tangan blangko Derry. Berkas ini menutup
 * celah yang tersisa sesudah blangko Derry 1.202.0 (variabel baru 9161-9208)
 * dan membetulkan satu jalur yang terukur salah. Dipanggil rute /abt/usulan
 * di UJUNG jalur "itsbat" dan "posita-lain" (lengkapiJenis); murni kecuali
 * pembacaan SIPP (HANYA SELECT, dibatasi 2,5 detik, dapat disuntik).
 *
 * Isian tangan blangko Derry yang dipetakan di sini (semua "ragu" = tampil
 * TIDAK tercentang, kalimat sumbernya ikut - n isian manusia masih 0):
 *
 *   Itsbat [99aa]   1321/1322/1324  nomor, tanggal, penerbit akta cerai SUAMI dengan
 *                                   istri sebelumnya ("istri sebelumnya #0046# I telah
 *                                   bercerai")
 *                   1325/1329/1331  idem ISTRI dengan suami sebelumnya - dari "(Kutipan)
 *                                   Akta Cerai Nomor 00635/AC/2021/PA.Pal" di kalimat status
 *                                   (Duda -> 1321, Janda -> 1325). Makna dibaca dari kalimat
 *                                   blangko [99aa], bukan dari label "P I/P II": blangko 2a
 *                                   kontensius tidak memakai 1321/1325, dan pada kontensius
 *                                   Pemohon tunggal yang janda adalah ISTRI -> 1325.
 *   Wali Adhal      9203 hubungan wali, 9201 nama wali nasab (hanya bila wali
 *                   BUKAN ayah kandung - petunjuk variabelnya), 9206 wilayah KUA
 *                   wali hakim ("Kecamatan ..., Kabupaten ..."), 9204 status
 *                   calon suami - diturunkan dari bacaan waliAdhol.js
 *   Kewarisan/HB    9161 jenis sita yang dimohonkan (+ dasar hukum menurut keadaan:
 *                   sita jaminan Pasal 261 RBg; sita marital Pasal 95 KHI bila TANPA
 *                   perceraian, Pasal 78 huruf c UU 7/1989 bila BERSAMA gugatan
 *                   perceraian - cerai 346/347 berkumulasi harta bersama, dibaca dari
 *                   SIPP/petitum; sita revindikasi Pasal 260 RBg). Sita marital atas harta
 *                   WARISAN tidak berlaku: tidak pernah diusulkan, panel diberi catatan.
 *                   9163 alasan permohonan sita
 *                   (kalimat posita), 9162 objek sita = objek sengketa yang dibaca
 *                   modul jenisnya (ragu: pemohon sita bisa memilih sebagian)
 *   Kewarisan       8719 bagian ahli waris HANYA bila petitum/posita menuliskan
 *                   pecahannya sendiri - TIDAK pernah dihitung ALETA (hukum waris
 *                   = penilaian hakim; selalu "ragu" + catatan perlu dicek).
 *
 * Perbaikan jalur itsbat untuk Penetapan Ahli Waris/Kewarisan: blangko PAW memuat
 * #5197#, jadi panel juga memanggil jalur itsbat, dan blangko BAS mendahulukan
 * jawaban itsbat. Bacaan "pasangan yang meninggal" jalur itsbat terukur 7/15 untuk
 * 1025 (pewaris) pada PAW (mis. "Ibunya", "Bahwa", nama ahli waris), sedangkan
 * waris.js 14/15 atas isian petugas yang sama (server 16 Okt). Untuk jenis
 * 371/364/365 kode pewaris (1025/1246/1247/1509) jalur itsbat DIGANTI bacaan
 * waris.js, atau dibuang bila waris.js tidak membacanya. Untuk semua jenis selain
 * itsbat nikah, 8171 jalur itsbat (kamus tujuan itsbat; perwalian 0/4) dibuang -
 * 8171 jenis itu datang dari jalur posita-lain (perwalian 4/6).
 *
 * Ukuran lengkap per jenis: D:/aleta-dev/kerja/batch-14okt-sore/f23-deteksi/
 * (ukur.js meniru rute atas posita SIPP server + isian ABT server, pembanding
 * makna per variabel di banding.js).
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");
const pemuat = require("./index");

/** Jenis yang kode pewarisnya milik waris.js, bukan jalur itsbat. */
const JENIS_WARIS = new Set([371, 364, 365]);
const KODE_PEWARIS = ["1025", "1246", "1247", "1509"];
const JENIS_SITA = new Set([348, 364, 365]);
/** Cerai yang ikut membaca sita bila berkumulasi harta bersama (Pasal 78 huruf c UU 7/1989). */
const JENIS_CERAI = new Set([346, 347]);

const NAMA = Object.freeze({
  1321: "No. akta cerai suami dengan istri sebelumnya (bukti)",
  1322: "Tgl. akta cerai suami dengan istri sebelumnya (bukti)",
  1324: "Penerbit akta cerai suami dengan istri sebelumnya (bukti)",
  1325: "No. akta cerai istri dengan suami sebelumnya (bukti)",
  1329: "Tgl. akta cerai istri dengan suami sebelumnya (bukti)",
  1331: "Penerbit akta cerai istri dengan suami sebelumnya (bukti)",
  9201: "Wali Adhal: nama wali nasab",
  9203: "Wali Adhal: hubungan wali dengan Pemohon",
  9204: "Wali Adhal: status calon suami sebelum menikah",
  9206: "Wali Adhal: wilayah KUA wali hakim",
  9161: "Sita: jenis sita yang dimohonkan",
  9162: "Sita: objek yang dimohonkan untuk disita",
  9163: "Sita: alasan permohonan sita",
  8719: "Kewarisan: bagian masing-masing ahli waris",
});

/** Kode satker pada nomor akta cerai -> nama pengadilan. Kode lain tidak ditebak. */
const KODE_PA = Object.freeze({
  dgl: "Donggala",
  pal: "Palu",
  prg: "Parigi",
  prgi: "Parigi",
  pso: "Poso",
  tli: "Tolitoli",
  buol: "Buol",
  lwk: "Luwuk",
  bgk: "Bungku",
});

/* ---------------------------------------------------------------------------
 * ITSBAT: AKTA CERAI PASANGAN SEBELUMNYA
 * ------------------------------------------------------------------------- */

const RE_AKTA = /(\d{1,6})\s*\/\s*AC\s*\/\s*(\d{4})(?:\s*\/\s*PA\s*[./]?\s*([A-Za-z]{2,5}))?/gi;

/**
 * Akta cerai yang disebut posita itsbat, dengan pemiliknya.
 * Pemilik dibaca dari kata status TERDEKAT sebelum nomornya di kalimat yang sama
 * (Duda -> Pemohon I, Janda -> Pemohon II); tanpa kata status, dari sebutan
 * "Pemohon I"/"Pemohon II" terdekat. Nomor yang sama untuk keduanya = tidak dipakai.
 * @returns {Array<{pihak: 1|2, nomor: string, tanggal: string, penerbit: string, kalimat: string}>}
 */
function aktaCeraiItsbat(posita) {
  const t = B.polos(posita);
  const hasil = [];
  RE_AKTA.lastIndex = 0;
  let m;
  while ((m = RE_AKTA.exec(t))) {
    const awalKalimat = Math.max(t.lastIndexOf("Bahwa", m.index), t.lastIndexOf(";", m.index), 0);
    const depan = t.slice(Math.max(awalKalimat, m.index - 220), m.index);
    let pihak = 0;
    const status = [...depan.matchAll(/\b(duda|janda)\b/gi)].pop();
    if (status) pihak = /duda/i.test(status[1]) ? 1 : 2;
    else {
      const sebut = [...depan.matchAll(/\bPemohon\s+(II|I|2|1)\b/g)].pop();
      if (sebut) pihak = /^(II|2)$/.test(sebut[1]) ? 2 : 1;
    }
    if (!pihak) continue;
    const kode = (m[3] || "").toLowerCase();
    const ekor = t.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const tgl = /^\s*\)?\s*,?\s*(?:pada\s+)?tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(ekor);
    hasil.push({
      pihak,
      nomor: `${m[1]}/AC/${m[2]}${m[3] ? `/PA.${m[3].charAt(0).toUpperCase()}${m[3].slice(1).toLowerCase()}` : ""}`,
      tanggal: tgl ? B.tanggalPertama(tgl[1]) || "" : "",
      penerbit: KODE_PA[kode] ? `Pengadilan Agama ${KODE_PA[kode]}` : "",
      kalimat: t.slice(Math.max(awalKalimat, m.index - 200), m.index + m[0].length + 40).replace(/^[;\s]+/, ""),
    });
  }
  const nomor = hasil.map((h) => h.nomor);
  return hasil.filter((h, i) => nomor.indexOf(h.nomor) === i && nomor.lastIndexOf(h.nomor) === i);
}

function deteksiItsbat(posita) {
  const peta = {};
  const akta = aktaCeraiItsbat(posita);
  for (const pihak of [1, 2]) {
    const a = akta.filter((x) => x.pihak === pihak);
    if (a.length !== 1) continue; // dua akta untuk satu pihak = tidak menebak
    const [no, tgl, terbit] = pihak === 1 ? ["1321", "1322", "1324"] : ["1325", "1329", "1331"];
    const catatan = `akta cerai ${pihak === 1 ? "suami (berstatus duda)" : "istri (berstatus janda)"} menurut posita - cocokkan dengan bukti suratnya`;
    B.taruh(peta, no, { ...B.fakta(a[0].nomor, a[0].kalimat, "ragu", `derry-itsbat-akta-${pihak}-nomor`), catatan });
    if (a[0].tanggal) B.taruh(peta, tgl, { ...B.fakta(a[0].tanggal, a[0].kalimat, "ragu", `derry-itsbat-akta-${pihak}-tanggal`), catatan });
    if (a[0].penerbit) B.taruh(peta, terbit, { ...B.fakta(a[0].penerbit, a[0].kalimat, "ragu", `derry-itsbat-akta-${pihak}-penerbit`), catatan });
  }
  return peta;
}

/* ---------------------------------------------------------------------------
 * WALI ADHAL (363) - diturunkan dari waliAdhol.js
 * ------------------------------------------------------------------------- */

function deteksiWaliAdhal(posita) {
  const peta = {};
  const wa = pemuat.modulUntuk(363);
  if (!wa) return peta;
  const f = wa.deteksi(posita) || {};
  const t = B.polos(posita);
  if (f["1046"]) {
    const hub = String(f["1046"].nilai).toLowerCase();
    B.taruh(peta, "9203", B.fakta(hub, f["1046"].kalimat, "ragu", "derry-wali-adhal-9203"));
    // Petunjuk 9201: kosongkan bila wali = ayah kandung (blangko memakai nama sesudah "binti").
    if (!/\bayah\b/.test(hub) && f["1217"]) {
      B.taruh(peta, "9201", { ...B.fakta(f["1217"].nilai, f["1217"].kalimat, "ragu", "derry-wali-adhal-9201"), catatan: "lengkapi dengan bin bila posita belum menyebutnya" });
    }
  }
  if (f["3333"]) {
    const [kec, kab] = String(f["3333"].nilai).split(/\s*,\s*/);
    const kabupaten = kab ? (/^(kabupaten|kota)\b/i.test(kab) ? kab : `Kabupaten ${kab}`) : "";
    B.taruh(peta, "9206", B.fakta([`Kecamatan ${kec}`, kabupaten].filter(Boolean).join(", "), f["3333"].kalimat, "ragu", "derry-wali-adhal-9206"));
  }
  const st = /calon\s+suami(?:\s+Pemohon)?\s+(?:tersebut\s+)?(?:adalah\s+)?(?:seorang\s+|berstatus\s+)(jejaka|perjaka|bujang|duda)\b([^;]{0,120})/i.exec(t);
  if (st) {
    const duda = /duda/i.test(st[1]);
    const nilai = !duda ? "Jejaka" : /mati|meninggal/i.test(st[2]) ? "Duda Cerai Mati" : /akta\s+cerai|cerai\s+hidup|\/AC\//i.test(st[2]) ? "Duda Cerai Hidup" : "";
    if (nilai) B.taruh(peta, "9204", B.fakta(nilai, st[0], "ragu", "derry-wali-adhal-9204"));
  }
  return peta;
}

/* ---------------------------------------------------------------------------
 * SITA (harta bersama, kewarisan)
 * ------------------------------------------------------------------------- */

/** Jenis sita yang dimohonkan, dari petitum lalu posita; bentuk kalimat bawaan variabel 9161. */
function jenisSita(teks) {
  const t = String(teks || "");
  const jenis = [];
  // "Sita Jaminan Marital (Maritale Beslag)" (506/Pdt.G/2026) = sita marital, bukan sita jaminan.
  if (/sita\s+jaminan(?!\s+marit)|sita\s+conservatoi?r|conservatoi?r\s+beslag|\(\s*CB\s*\)/i.test(t)) jenis.push("sita jaminan (conservatoir beslag)");
  if (/sita\s+(?:jaminan\s+)?marit(?:a)?ale?\b|marit(?:a)?ale?\s+beslag/i.test(t)) jenis.push("sita marital (maritaal beslag)");
  if (/sita\s+r[ei]vind[ie]?[ck]ato[ia]?r|r[ei]vind[ie]?[ck]ato[ia]?r\s+be?s?lag|\(\s*RB\s*\)/i.test(t)) jenis.push("sita revindikasi (revindicatoir beslag)");
  return jenis;
}

/** Kalimat alasan sita di posita ("khawatir ... memindahtangankan", "untuk menjamin ..."). */
function alasanSita(posita) {
  const kal = B.kalimat(B.polos(posita));
  // Kalimat yang MEMOHON sita dan menyebut alasannya; daftar harta yang kebetulan memuat "sita"/"dijual" bukan alasan.
  const ALASAN = /khawatir|kh?awatir|prasangka|perasangka|menjamin|menghindari|illusoir|dialihkan|mengalihkan|memindah\s*tangan|dipindah\s*tangan|menggelapkan/i;
  const MOHON = /mohon|memohon|meletak|menjatuhkan|perlu\s+dilakukan/i;
  const k = kal.find((x) => /\bsita\b/i.test(x) && ALASAN.test(x) && MOHON.test(x)) || kal.find((x) => /\bsita\b/i.test(x) && ALASAN.test(x));
  if (!k) return null;
  const nilai = k.replace(/^\s*(?:\d{1,2}\s*\.\s*)?bahwa\s*,?\s*/i, "").replace(/[;.\s]+$/, "");
  return nilai.length >= 20 ? { nilai: nilai.slice(0, 600), kalimat: k } : null;
}

/** Bagian ahli waris HANYA bila pecahannya tertulis sendiri ("dengan bagian: suami 1/4, ibu 1/6, ..."). */
function bagianTertulis(teks) {
  const kal = B.kalimat(B.polos(teks));
  const k = kal.find((x) => /\bbagian\b/i.test(x) && (x.match(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g) || []).length >= 2);
  return k ? { nilai: k.replace(/^\s*(?:\d{1,2}\s*\.\s*)?(?:bahwa|menetapkan)\s*,?\s*/i, "").replace(/[;.\s]+$/, "").slice(0, 600), kalimat: k } : null;
}

/**
 * Dasar hukum tiap jenis sita menurut KEADAAN perkara (keputusan pengguna 16 Okt 2026):
 * sita marital Pasal 95 KHI bila diajukan TANPA perceraian (gugatan harta bersama sendiri),
 * Pasal 78 huruf c UU 7/1989 bila BERSAMAAN dengan gugatan perceraian (kumulasi).
 * Sita revindikasi dan sita marital atas harta warisan belum diputuskan pengguna -> perlu dicek.
 */
function dasarSita(jenis, bersamaCerai, jenisId) {
  return jenis
    .map((j) => {
      if (/jaminan/.test(j)) return "sita jaminan: Pasal 261 RBg";
      if (/marital/.test(j)) {
        if (bersamaCerai) return "sita marital bersamaan dengan gugatan perceraian: Pasal 78 huruf c UU 7/1989";
        return "sita marital tanpa gugatan perceraian: Pasal 95 KHI";
      }
      return "sita revindikasi: Pasal 260 RBg";
    })
    .join("; ");
}

/** Perkara harta WARISAN: sita marital tidak berlaku (keputusan pengguna 16 Okt) - tidak pernah diusulkan. */
const JENIS_WARISAN = new Set([364, 365]);
const CATATAN_MARITAL_WARISAN =
  "Petitum/posita memohon sita marital atas harta warisan - sita marital hanya untuk harta bersama dan TIDAK berlaku untuk harta warisan; tidak diusulkan.";

/** Catatan untuk panel bila sita marital dimohonkan atas harta warisan ("" bila tidak). */
function peringatanSita(posita, petitum, jenisId) {
  if (!JENIS_WARISAN.has(Number(jenisId))) return "";
  const jenis = jenisSita(petitum).length ? jenisSita(petitum) : jenisSita(posita);
  return jenis.some((j) => /marital/.test(j)) ? CATATAN_MARITAL_WARISAN : "";
}

/**
 * Cerai berkumulasi harta bersama? `kumulasi` = daftar dari SIPP (perkara_kumulasi: {jenisPerkaraId}/{kode})
 * bila ada; selain itu petitum primer dibaca kumulasiPerkaraService (aturan kumulasi 12 Okt).
 */
function kumulasiHartaBersama(petitum, kumulasi) {
  const dariSipp = (Array.isArray(kumulasi) ? kumulasi : []).some(
    (k) => k && (k.kode === "harta-bersama" || Number(k.jenisPerkaraId) === 348 || k === "harta-bersama" || Number(k) === 348)
  );
  if (dariSipp) return true;
  try {
    return require("../kumulasiPerkaraService").kumulasiDariPetitum(String(petitum || "")).some((k) => k.kode === "harta-bersama");
  } catch (_) {
    return false;
  }
}

function deteksiSita(posita, petitum, jenisId, bersamaCerai = false) {
  const peta = {};
  let jenis = jenisSita(petitum).length ? jenisSita(petitum) : jenisSita(posita);
  // Harta warisan: sita marital dibuang (lihat peringatanSita); bila hanya itu yang dimohonkan, tidak ada usulan sita.
  if (JENIS_WARISAN.has(Number(jenisId))) jenis = jenis.filter((j) => !/marital/.test(j));
  if (!jenis.length) return peta;
  const kalJenis = (B.kalimat(B.polos(`${petitum} ${posita}`)).find((x) => /\bsita\b/i.test(x)) || "").slice(0, 400);
  B.taruh(peta, "9161", { ...B.fakta(jenis.join(" dan "), kalJenis, "ragu", "derry-sita-jenis"), catatan: `dasar: ${dasarSita(jenis, bersamaCerai, jenisId)}` });
  const alasan = alasanSita(posita);
  if (alasan) B.taruh(peta, "9163", B.fakta(alasan.nilai, alasan.kalimat, "ragu", "derry-sita-alasan"));
  // Cerai berkumulasi harta bersama: objek dibaca modul harta bersama.
  const idObjek = JENIS_CERAI.has(Number(jenisId)) ? 348 : jenisId;
  const modul = pemuat.modulUntuk(idObjek);
  if (modul) {
    const f = modul.deteksi(posita, { petitum, jenisPerkara: idObjek }) || {};
    const objek = f["8730"] || f["8718"];
    if (objek && objek.nilai) {
      const nilai = String(objek.nilai).replace(/(^|<br>)2\.(\d+)\s/g, "$1$2. ");
      B.taruh(peta, "9162", { ...B.fakta(nilai, objek.kalimat, "ragu", "derry-sita-objek"), catatan: "objek sengketa yang didalilkan - hapus yang tidak dimohonkan sita" });
    }
  }
  return peta;
}

/* ---------------------------------------------------------------------------
 * GABUNG KE JAWABAN RUTE
 * ------------------------------------------------------------------------- */

/** Fakta per jenis (murni). */
function deteksi(posita, opsi = {}) {
  const jenis = Number(opsi.jenisPerkara) || 0;
  const petitum = String(opsi.petitum || "");
  const peta = {};
  const tambah = (p) => Object.entries(p).forEach(([k, v]) => B.taruh(peta, k, v));
  if (jenis === 360) tambah(deteksiItsbat(posita));
  if (jenis === 363) tambah(deteksiWaliAdhal(posita));
  if (JENIS_SITA.has(jenis)) tambah(deteksiSita(posita, petitum, jenis, false));
  if (JENIS_CERAI.has(jenis) && kumulasiHartaBersama(petitum, opsi.kumulasi)) tambah(deteksiSita(posita, petitum, jenis, true));
  if (jenis === 364 || jenis === 365) {
    const b = bagianTertulis(petitum) || bagianTertulis(posita);
    if (b) {
      B.taruh(peta, "8719", {
        ...B.fakta(b.nilai, b.kalimat, "ragu", "derry-waris-bagian-tertulis", bagianTertulis(petitum) ? "petitum" : "posita"),
        catatan: "Bagian yang DIMOHONKAN, bukan hitungan ALETA. Furudh/ashabah ditetapkan hakim (QS An-Nisa 11, 12, 176; KHI Pasal 176-193) - perlu dicek pengguna.",
      });
    }
  }
  return peta;
}

function usulanDari(kode, f) {
  return {
    kode,
    nama: NAMA[kode] || kode,
    nilai: f.nilai,
    keyakinan: f.yakin === "cukup" ? "cukup" : "ragu",
    bentrok: "",
    catatan: f.catatan || "",
    dihitung: false,
    sumber: f.kalimat ? [{ saksi: 0, asal: f.asal || "posita", kalimat: String(f.kalimat).slice(0, 400) }] : [],
    kodePola: f.kodePola || `derry-${kode}`,
  };
}

/** Pembaca SIPP bawaan: jenis, petitum, nama pihak (HANYA SELECT, 2,5 detik). */
function bacaSippBawaan(nomor) {
  return require("./sambungPositaLain").bacaSipp(nomor);
}

/**
 * Melengkapi jawaban jalur "itsbat"/"posita-lain" dengan variabel blangko Derry.
 * Usulan yang sudah ada TIDAK ditimpa, kecuali kode pewaris jalur itsbat pada
 * jenis waris (lihat kepala berkas). Masukan tidak diubah.
 *
 * @param {object|null} hasil  jawaban.itsbat / jawaban.positaLain
 * @param {{jalur: "itsbat"|"posita-lain", posita?: string, petitum?: string, jenisPerkara?: string|number,
 *          nomorPerkara?: string, bacaSipp?: Function}} masukan
 * @returns {Promise<object|null>}
 */
async function lengkapiJenis(hasil, masukan = {}) {
  let jenis = /^\d+$/.test(String(masukan.jenisPerkara || "").trim()) ? Number(masukan.jenisPerkara) : 0;
  let petitum = masukan.petitum;
  let posita = String(masukan.posita || "");
  const perluSipp = !jenis || petitum === undefined || posita.replace(/<[^>]*>/g, " ").trim().length < 50;
  if (perluSipp && masukan.nomorPerkara) {
    const baca = typeof masukan.bacaSipp === "function" ? masukan.bacaSipp : bacaSippBawaan;
    const sipp = await Promise.resolve(baca(masukan.nomorPerkara)).catch(() => null);
    if (sipp) {
      if (!jenis && /^\d+$/.test(String(sipp.jenisPerkara || ""))) jenis = Number(sipp.jenisPerkara);
      if (petitum === undefined) petitum = sipp.petitum || "";
      if (posita.replace(/<[^>]*>/g, " ").trim().length < 50 && sipp.posita) posita = sipp.posita;
    }
  }
  if (!jenis) return hasil;
  // Cerai: kumulasi harta bersama dari SIPP (perkara_kumulasi) + petitum - penentu dasar sita marital.
  let kumulasi = masukan.kumulasi;
  if (JENIS_CERAI.has(jenis) && kumulasi === undefined && masukan.nomorPerkara) {
    const bacaK =
      typeof masukan.bacaKumulasi === "function" ? masukan.bacaKumulasi : (n) => require("../kumulasiPerkaraService").kumulasiNomorPerkara(n);
    const batas = new Promise((selesai) => {
      const t = setTimeout(() => selesai(null), 2500);
      if (t && typeof t.unref === "function") t.unref();
    });
    const k = await Promise.race([Promise.resolve(bacaK(masukan.nomorPerkara)).catch(() => null), batas]);
    kumulasi = k && Array.isArray(k.daftar) ? k.daftar : undefined;
  }
  const dasar = hasil && typeof hasil === "object" && hasil.ok !== false && Array.isArray(hasil.usulan) ? hasil : null;
  let usulan = dasar ? dasar.usulan.slice() : [];
  const catatan = [];

  // Jalur itsbat pada perkara waris: kode pewaris dari waris.js.
  if (masukan.jalur === "itsbat" && JENIS_WARIS.has(jenis) && usulan.some((u) => u && KODE_PEWARIS.includes(String(u.kode)))) {
    const waris = pemuat.modulUntuk(jenis);
    const f = waris ? waris.deteksi(posita, { petitum: petitum || "", jenisPerkara: jenis }) || {} : {};
    const baru = [];
    for (const u of usulan) {
      const k = u && String(u.kode);
      if (!KODE_PEWARIS.includes(k)) baru.push(u);
      else if (f[k] && f[k].nilai) baru.push({ ...usulanDari(k, f[k]), nama: u.nama || k });
    }
    usulan = baru;
    catatan.push("Data pewaris dibaca dengan aturan penetapan ahli waris.");
  }

  // 8171 jalur itsbat = kamus TUJUAN ITSBAT (rute memakai jenis 360 bila ekstensi tidak mengirim jenis). Pada
  // perwalian terukur 0/4, sedangkan jalur posita-lain (kamus jenisnya sendiri) 4/6 - dan blangko BAS
  // mendahulukan jawaban itsbat. Di luar itsbat nikah, 8171 diserahkan ke jalur posita-lain.
  if (masukan.jalur === "itsbat" && jenis !== 360 && !JENIS_CERAI.has(jenis) && usulan.some((u) => u && String(u.kode) === "8171")) {
    usulan = usulan.filter((u) => !(u && String(u.kode) === "8171"));
    catatan.push("Alasan permohonan (8171) dibaca dengan aturan jenis perkaranya, bukan aturan itsbat.");
  }

  const f = deteksi(posita, { jenisPerkara: jenis, petitum: petitum || "", kumulasi });
  const kodeBaru = [];
  for (const [kode, isi] of Object.entries(f)) {
    if (usulan.some((u) => u && String(u.kode) === kode)) continue;
    usulan.push(usulanDari(kode, isi));
    kodeBaru.push(kode);
  }
  const peringatan = peringatanSita(posita, petitum || "", jenis);
  if (peringatan) catatan.push(peringatan);
  if (!kodeBaru.length && !catatan.length) return hasil;
  if (kodeBaru.length) catatan.push(`${kodeBaru.length} variabel blangko Derry terbaca (ragu - periksa kalimat sumbernya).`);
  return {
    ...(dasar || { ok: true, jenis: String(jenis), belumSiap: [], bawaanAbt: [] }),
    ok: true,
    usulan,
    belumSiap: ((dasar && dasar.belumSiap) || []).filter((b) => !kodeBaru.includes(String(b && b.kode))),
    catatan: [dasar && dasar.catatan ? dasar.catatan : "", ...catatan].filter(Boolean).join(" "),
  };
}

module.exports = {
  NAMA,
  KODE_PA,
  JENIS_WARIS,
  KODE_PEWARIS,
  aktaCeraiItsbat,
  deteksiItsbat,
  deteksiWaliAdhal,
  jenisSita,
  dasarSita,
  peringatanSita,
  kumulasiHartaBersama,
  alasanSita,
  bagianTertulis,
  deteksiSita,
  deteksi,
  lengkapiJenis,
};
