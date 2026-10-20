"use strict";

/**
 * ============================================================================
 * PENETAPAN AHLI WARIS / P3HP (jenis_perkara_id 371) - susunan ahli waris dan pencairan dana
 * ============================================================================
 *
 * Petitum P3HP PA Donggala hampir seragam: "Menetapkan ahli waris {pewaris} adalah: a. X (Pemohon I); b. Y (Pemohon II)"
 * dan "untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan dengan nomor ... nama ...". Posita menyebut
 * golongan yang ditinggalkan ("meninggalkan Isteri, tujuh orang anak" / "Ibu, Saudara-Saudara") dan nama pasangan
 * ("menikah dengan ... X"). Hubungan tiap ahli waris dengan pewaris dibaca dari POLA NAMA: anak memakai nama diri pewaris
 * sesudah bin/binti ("Fatimah binti Maulid Agusta" untuk pewaris "Maulid Agusta bin Djorihi"); saudara memakai nama ayah pewaris.
 *
 *   9701 pasangan pewaris yang masih hidup     ahli waris yang namanya = pasangan di posita
 *   9702 anak kandung pewaris                  ahli waris ber-bin/binti nama diri pewaris
 *   9703 / 9704 ayah / ibu yang masih hidup    sisa ahli waris bila posita menyebut "Ayah" / "Ibu" dan hanya satu yang tersisa
 *   9718 saudara kandung atau seayah           ahli waris ber-bin/binti nama ayah pewaris
 *   8608 nama ahli waris (anak)                sama dengan 9702
 *   8610 nama suami/istri pewaris              pasangan di posita ("menikah dengan ...")
 *   9700 pencairan dana                        kalimat petitum "pencairan Dana ..."
 *
 * Hukum waris adalah penilaian hakim: semua bacaan "cukup" hanya bila SELURUH ahli waris tergolong dan jumlah anak/golongan
 * sama dengan yang tertulis di posita; selainnya "ragu" dengan keterangan golongan mana yang tidak terbaca.
 */

const B = require("./bantu");

const NAMA = Object.freeze({
  "9701": "Ahli waris: pasangan pewaris yang masih hidup",
  "9702": "Ahli waris: anak kandung pewaris",
  "9703": "Ahli waris: ayah kandung pewaris yang masih hidup",
  "9704": "Ahli waris: ibu kandung pewaris yang masih hidup",
  "9718": "Ahli waris: saudara kandung atau seayah pewaris",
  "8608": "Nama ahli waris (anak kandung)",
  "8610": "Nama suami/istri pewaris",
  "9700": "Pencairan dana",
});

const ANGKA_KATA = { satu: 1, seorang: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };

/** "adalah: a. X (Pemohon I); b. Y" -> potongan teks daftar ahli waris dari petitum, atau "". */
function potongDaftarPetitum(petitum) {
  const t = B.polos(petitum);
  const m = /\bahli\s+waris\b[^:;]{0,260}?\badalah\s*:?\s*/i.exec(t);
  if (!m) return { pewaris: "", daftar: "" };
  let sisa = t.slice(m.index + m[0].length);
  // Butir berikutnya: "4. Menetapkan", "Menetapkan Para Pemohon ...", "SUBSIDER".
  const akhir = sisa.search(/\s(?:\d{1,2}\s*\.\s*)?Menetapkan\b|\sMembebankan\b|\sSUBSID/i);
  if (akhir >= 0) sisa = sisa.slice(0, akhir);
  const depan = t.slice(Math.max(0, m.index - 10), m.index + m[0].length);
  const pw = /\bahli\s+waris\s+(?:dari\s+)?(?:almarhum(?:ah)?\s+|alm\.?\s+|almh\.?\s+)?(.+?)\s+adalah/i.exec(depan.length < 400 ? t.slice(m.index, m.index + m[0].length) : depan);
  return { pewaris: pw ? pw[1].replace(/\s*\((?:alm|almh|almarhum|almarhumah)\.?\)\s*/gi, " ").trim() : "", daftar: sisa.trim() };
}

/** Memecah daftar bernomor/berhuruf menjadi nama utuh: "a. X bin Y, (Pemohon I); b. Z binti W (Pemohon II)". */
function pecahDaftar(daftar) {
  const t = String(daftar || "").replace(/\s+/g, " ").trim();
  if (!t) return { nama: [], berpenanda: false };
  const berpenanda = /(?:^|[\s;,])(?:[a-h]|\d{1,2})\s*[.)]\s+[A-Z]/.test(t) || /;/.test(t);
  let potongan;
  if (berpenanda) potongan = t.split(/(?:^|\s*;\s*|\s+)(?:[a-h]|\d{1,2})\s*[.)]\s+(?=[A-Z])|\s*;\s*/).filter((x) => x && x.trim());
  else potongan = [t];
  const nama = [];
  for (const p of potongan) {
    const bersih = p
      .replace(/\s*\((?:\s*(?:pemohon|termohon|ahli waris pengganti|almarhum(?:ah)?|alm\.?|almh\.?)[^)]*)\)\s*/gi, " ")
      .replace(/[,\s]*(?:umur|usia)\s+\d{1,3}\s*(?:\([^)]*\)\s*)?tahun.*$/i, "")
      .replace(/[\s,;.]+$/, "")
      .replace(/^[\s,;.]+/, "")
      .replace(/\)+$/, "")
      .trim();
    if (bersih.length >= 3 && /\b(?:bin|binti)\b/i.test(bersih)) nama.push(bersih);
    else if (bersih.length >= 3 && /^[A-Z]/.test(bersih)) nama.push(bersih);
  }
  return { nama, berpenanda };
}

/** Pisah "X bin Y alias Z" -> { diri: "X", ayah: "Y alias Z", jk }. */
function uraiNama(nama) {
  const m = /^(.*?)\s+\b(bin|binti)\b\.?\s+(.+)$/i.exec(String(nama || "").trim());
  if (!m) return { diri: String(nama || "").trim(), ayah: "", jk: "" };
  return { diri: m[1].trim(), ayah: m[3].trim(), jk: m[2].toLowerCase() === "binti" ? "P" : "L" };
}

/** Kunci banding nama diri: kata pertama yang bermakna (>= 3 huruf), huruf kecil tanpa tanda baca. */
const kunciDiri = (s) => B.rapat(String(s || "").replace(/\s+alias\b.*$/i, "").replace(/\bhi\.?\s/gi, ""));
const awalNama = (s) => {
  const kata = B.normal(String(s || "").replace(/\s+alias\b.*$/i, "")).split(" ").filter((k) => k.length >= 3);
  return kata[0] || "";
};

/** Nama dan alias-nya sebagai daftar kunci rapat: "Ahmad alias Ahmad Yambo" -> ["ahmad", "ahmadyambo"]. */
const kunciNama = (s) =>
  String(s || "")
    .split(/\s+alias\s+/i)
    .map((x) => B.rapat(x.replace(/\)+$/, "")))
    .filter(Boolean);

/** Apakah ayah-heir (teks sesudah bin/binti) menunjuk orang bernama `acuan` (nama diri atau salah satu alias)? */
function menunjuk(ayahHeir, acuanLengkap) {
  const a = kunciNama(ayahHeir);
  const b = kunciNama(acuanLengkap);
  if (!a.length || !b.length) return false;
  return a.some((x) => b.some((y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))));
}

/** Nama pasangan di posita: "menikah dengan (seorang) Perempuan bernama X (Pemohon)" / "Suami/Isteri Pemohon X". */
function pasanganPosita(posita) {
  const t = B.polos(posita);
  const m = /\b(?:telah\s+)?menikah\s+dengan\s+(?:seorang\s+)?(?:lelaki|laki-laki|pria|perempuan|wanita)?\s*(?:ber\s*nama\w*|yang\s+bernama)?\s*:?\s*([A-Z][^()]{2,100}?(?:\b(?:bin|binti)\b[^()]{2,60}?)?)\s*(?:\(|pada\s+tanggal|,|;)/i.exec(t);
  if (!m) return null;
  const nama = m[1].replace(/\s+/g, " ").trim();
  // Nama pasangan harus bernama lengkap "X bin/binti Y"; kata tunggal ("Dinar") bukan nama yang dapat dipercaya.
  if (!/\b(?:bin|binti)\b/i.test(nama) || nama.split(" ").length > 8) return null;
  return { nama, kalimat: m[0] };
}

/** Golongan yang ditinggalkan menurut posita: "meninggalkan Isteri, tujuh orang anak, ibu dan juga meninggalkan Dana ..." */
function golonganPosita(posita) {
  const t = B.polos(posita);
  const m = /\bmeninggalkan\s+(.{3,160}?)(?=\s+dan\s+juga\s+meninggalkan\b|\s+dan\s+meninggalkan\b|;|\.\s+[A-Z]|$)/i.exec(t);
  if (!m) return null;
  const s = m[1];
  const anak = /\b(?:(\d{1,2})|(satu|seorang|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas))\s*(?:\([^)]*\)\s*)?(?:orang\s+)?anak\b/i.exec(s);
  return {
    kalimat: m[0],
    pasangan: /\b(?:isteri|istri|suami)\b/i.test(s),
    anak: anak ? (anak[1] ? Number(anak[1]) : ANGKA_KATA[anak[2].toLowerCase()] || 0) : /\banak\b/i.test(s) ? -1 : 0,
    ayah: /\b(?:ayah|bapak)\b/i.test(s),
    ibu: /\bibu\b/i.test(s),
    saudara: /\bsaudara\b/i.test(s),
  };
}

/** Pencairan dana di petitum: "untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan dengan nomor ... nama ...". */
function pencairanDana(petitum) {
  const t = B.polos(petitum);
  const m = /\bpencairan\s+((?:Dana|Tabungan|Deposito|Asuransi|Santunan|Polis|Taspen|Pensiun|BPJS|Gaji|Hak)\b.{3,260}?)(?=\s+(?:\d{1,2}\s*\.\s*)?Menetapkan\b|\s+Membebankan\b|\s+SUBSID|;|$)/i.exec(t);
  if (!m) return null;
  // "Dana Dana BPJS" (salah ketik di petitum) -> "Dana BPJS": kata yang sama berturut-turut diringkas.
  const nilai = m[1].replace(/\s+/g, " ").replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1").replace(/[\s,;.]+$/, "").trim();
  return { nilai, kalimat: m[0] };
}

/**
 * Menggolongkan ahli waris petitum terhadap pewaris. Mengembalikan golongan dan apakah SEMUA ahli waris tergolong.
 * @returns {{anak: string[], pasangan: string[], saudara: string[], sisa: string[], pewaris: string, berpenanda: boolean}}
 */
function golongkan({ petitum, posita, pewaris }) {
  const { pewaris: pwPetitum, daftar } = potongDaftarPetitum(petitum);
  const pw = pewaris || pwPetitum;
  const { nama, berpenanda } = pecahDaftar(daftar);
  const hasil = { anak: [], pasangan: [], saudara: [], sisa: [], pewaris: pw, berpenanda, semua: nama };
  if (!pw || !nama.length) return hasil;
  const u = uraiNama(pw);
  const pasanganP = pasanganPosita(posita);
  // Pewaris perempuan: anaknya memakai nama SUAMI (pasangan) sesudah bin/binti, bukan nama pewaris.
  const ayahAnak = u.jk === "P" && pasanganP ? uraiNama(pasanganP.nama).diri : "";
  for (const n of nama) {
    const x = uraiNama(n);
    if (pasanganP && B.samaNama(n, pasanganP.nama)) hasil.pasangan.push(n);
    else if (x.ayah && ((menunjuk(x.ayah, u.diri) && kunciDiri(x.diri) !== kunciDiri(u.diri)) || (ayahAnak && menunjuk(x.ayah, ayahAnak)))) hasil.anak.push(n);
    else if (x.ayah && u.ayah && menunjuk(x.ayah, u.ayah)) hasil.saudara.push(n);
    else hasil.sisa.push(n);
  }
  return hasil;
}

const daftarTitikKoma = (d) => d.join("; ");

/**
 * @param {{perkara: {posita: string, petitum: string}}} d
 * @param {{pewaris?: string}} [opsi] pewaris (nilai 1025 hasil waris.js) bila sudah dibaca
 */
function usulanAhliWaris(d, opsi = {}) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const hasil = [];
  const g = golongkan({ petitum, posita, pewaris: opsi.pewaris });
  const gol = golonganPosita(posita);
  if (g.pewaris && g.semua.length) {
    const kalimatDaftar = `Petitum: ahli waris ${g.pewaris} adalah ${g.semua.join("; ")}`;
    // Rujukan silang: setiap golongan yang ditinggalkan menurut posita harus ada wakilnya, dan jumlah anak harus sama.
    const kocokAnak = gol && gol.anak > 0 ? gol.anak === g.anak.length : null;
    // Satu ahli waris tersisa dan posita menyebut TEPAT satu dari ayah/ibu: itulah orang tuanya.
    const orangTuaSisa = g.sisa.length === 1 && gol && gol.ibu !== gol.ayah ? (gol.ibu ? "9704" : "9703") : "";
    const semuaTergolong = g.sisa.length === 0 || Boolean(orangTuaSisa);
    const buat = (kode, nilai, yakinPasti, catatanOk, catatanRagu, kodePola) =>
      B.butir({
        kode,
        nama: NAMA[kode],
        nilai,
        keyakinan: yakinPasti ? "cukup" : "ragu",
        kalimat: kalimatDaftar,
        asal: "posita-gugatan",
        catatan: yakinPasti ? catatanOk : catatanRagu,
        kodePola,
      });
    const ragu =
      "Hubungan dibaca dari pola nama di petitum (anak memakai nama pewaris sesudah bin/binti, saudara memakai nama ayah pewaris), bukan dari keterangan tertulis; penetapan ahli waris adalah penilaian hakim - periksa dengan kartu keluarga dan akta.";
    const ok = "Semua ahli waris di petitum tergolong menurut pola nama dan sesuai golongan yang disebut posita; periksa dengan kartu keluarga.";
    const pasti = semuaTergolong && (kocokAnak === null || kocokAnak === true);
    if (g.anak.length) {
      hasil.push(buat("9702", daftarTitikKoma(g.anak), pasti, ok, ragu, "s5-paw-9702-anak"));
      hasil.push(buat("8608", g.anak.join(", "), pasti, ok, ragu, "s5-paw-8608-anak"));
    }
    if (g.pasangan.length) hasil.push(buat("9701", daftarTitikKoma(g.pasangan), pasti, ok, ragu, "s5-paw-9701-pasangan"));
    if (g.saudara.length) hasil.push(buat("9718", daftarTitikKoma(g.saudara), pasti, ok, ragu, "s5-paw-9718-saudara"));
    if (orangTuaSisa) hasil.push(buat(orangTuaSisa, g.sisa[0], pasti, ok, ragu, `s5-paw-${orangTuaSisa}-sisa`));
  }
  const pas = pasanganPosita(posita);
  if (pas) {
    hasil.push(
      B.butir({
        kode: "8610",
        nama: NAMA["8610"],
        nilai: pas.nama,
        keyakinan: "ragu",
        kalimat: pas.kalimat,
        asal: "posita-gugatan",
        catatan: "Nama pasangan pewaris dari kalimat pernikahan di posita; periksa ejaannya dengan akta nikah.",
        kodePola: "s5-paw-8610-pasangan",
      })
    );
  }
  const dana = pencairanDana(petitum);
  if (dana) {
    hasil.push(
      B.butir({
        kode: "9700",
        nama: NAMA["9700"],
        nilai: dana.nilai,
        keyakinan: "cukup",
        kalimat: dana.kalimat,
        asal: "posita-gugatan",
        catatan: "Salinan kalimat petitum tentang pencairan dana (jenis dana, lembaga dan atas nama); ringkas menjadi satu frasa tanpa titik akhir bila perlu.",
        kodePola: "s5-paw-9700-dana",
      })
    );
  }
  return hasil;
}

module.exports = { usulanAhliWaris, golongkan, potongDaftarPetitum, pecahDaftar, uraiNama, pasanganPosita, golonganPosita, pencairanDana, menunjuk };
