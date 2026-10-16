"use strict";

/**
 * ============================================================================
 * DETEKSI PENETAPAN AHLI WARIS (P3HP, 371) & KEWARISAN (364/365) - butir 16
 * ============================================================================
 *
 * Blangko Derry "9 Penetapan Ahli Waris" (menu 913, [01] Kabul) dan "4b
 * Kewarisan" (menu 921, [01] Kabul), serta BAS "44-a BAS Putus Penetapan Ahli
 * Waris", memuat isian tangan:
 *
 *   1025 nama pewaris               petitum "Menyatakan X telah meninggal dunia" /
 *                                   "ahli waris dari almarhum X", lalu posita
 *                                   "X bin Y telah meninggal dunia", "meninggal dunia
 *                                   ... yang bernama X", "X wafat di ..."
 *   1246 tanggal wafat pewaris      tanggal PERTAMA sesudah "meninggal/wafat" di
 *        (data_tanggal)             kalimat pewaris - bukan tanggal akta kematian
 *   1247 sebab wafat                "dikarenakan/karena/akibat <sebab>" di kalimat itu
 *   1509 tempat wafat               "meninggal dunia di X" / "wafat di X"
 *   5197 tanggal nikah pewaris      (P3HP) tanggal di kalimat pernikahan pewaris
 *   8610 nama suami/istri pewaris   (P3HP) "<pewaris> dan <X> melangsungkan pernikahan",
 *                                   "menikah dengan ... bernama X"; "Pemohon I" ->
 *                                   nama pihak SIPP berurutan sama
 *   8613 kematian suami/istri       (P3HP) "pada tanggal ... di ... karena ..." dari
 *        pewaris                    kalimat wafatnya suami/istri itu
 *   8614 harta peninggalan          (P3HP) "meninggalkan harta (warisan|peninggalan)
 *                                   berupa ..."
 *   8608 nama ahli waris (anak)     (P3HP) "dikaruniai N orang anak ... bernama: A; B"
 *   8717 ahli waris (kewarisan)     daftar "meninggalkan ahli waris sebagai berikut:"
 *   8718 tirkah (kewarisan)         daftar "harta peninggalan/warisan/obyek sengketa
 *                                   berupa/sebagai berikut:" (posita, lalu petitum)
 *
 * 8719 (bagian masing-masing ahli waris) TIDAK dideteksi: furudh/ashabah adalah
 * hitungan hukum hakim, bukan fakta yang tertulis di posita.
 *
 * Keyakinan "cukup" hanya untuk variabel yang terukur >= 95% (n >= 10) atas
 * isian petugas aps_badilag dan amar SIPP - angka di UKUR. Selebihnya "ragu".
 */

const P = require("./pembantuKebendaan");

const variabel = Object.freeze([
  { kode: "1025", nama: "Nama pewaris (almarhum/almarhumah)", sumber: "petitum+posita", blangko: ["putusan", "bas"] },
  { kode: "1246", nama: "Tanggal meninggalnya pewaris", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1247", nama: "Sebab meninggalnya pewaris", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1509", nama: "Tempat meninggal dunia", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "5197", nama: "Tanggal nikah pewaris", sumber: "posita", blangko: ["putusan"], jenis: [371] },
  { kode: "8610", nama: "Nama suami/istri pewaris", sumber: "posita+sipp", blangko: ["putusan"], jenis: [371] },
  { kode: "8613", nama: "Kematian suami/istri pewaris (pada tanggal ... di ... karena ...)", sumber: "posita", blangko: ["putusan"], jenis: [371] },
  { kode: "8614", nama: "Harta peninggalan pewaris", sumber: "posita", blangko: ["putusan"], jenis: [371] },
  { kode: "8608", nama: "Nama ahli waris (anak kandung)", sumber: "posita", blangko: ["putusan"], jenis: [371] },
  { kode: "8717", nama: "Ahli waris pewaris (kewarisan)", sumber: "posita+petitum", blangko: ["putusan"], jenis: [364, 365] },
  { kode: "8718", nama: "Harta peninggalan / tirkah (kewarisan)", sumber: "posita+petitum", blangko: ["putusan"], jenis: [364, 365] },
]);

/**
 * Ukur 13 Okt 2026 (sipp_donggala salinan 9 Okt, P3HP 105 perkara / 91 berposita; D:/aleta-dev/kerja/
 * deteksi-poligami-waris-hb/ukur-waris.js). Pembanding: amar SIPP dan isian petugas aps_badilag sebelum
 * 1 Sep 2026. Tidak satu pun >= 95% dengan n >= 10 - semua "ragu" (sampai ukur ulang 16 Okt, lihat SIAP).
 */
const UKUR = Object.freeze({
  1025: { amar: [65, 70], petugas: [13, 14], petugasServer16Okt: [14, 15] },
  1246: { amar: [65, 70], petugasServer16Okt: [14, 15] },
  1247: { amar: [19, 21], petugas: [11, 11], petugasServer16Okt: [12, 12] },
  1509: { petugas: [1, 2], petugasServer16Okt: [2, 2] },
  8610: { amar: [4, 7] },
  8608: { amar: [10, 15] },
});
/**
 * Variabel yang lulus gerbang >= 95%, n >= 10 -> "cukup".
 * F2.3 (16 Okt 2026): 1247 sebab wafat diukur ulang atas isian petugas SERVER (rute ditiru penuh, pembanding
 * makna): 12/12, 11/11 untuk isian sebelum 1 Sep 2026 (bukan hasil ALETA) - lulus. 1025 dan 1246 14/15 (93%)
 * tetap "ragu". Rincian: D:/aleta-dev/kerja/batch-14okt-sore/f23-deteksi/ukur-sesudah.txt.
 */
const SIAP = new Set(["1247"]);
/** Jenis tempat ukuran SIAP berlaku - kewarisan (364/365, Pdt.G) belum punya isian petugas untuk diukur. */
const SIAP_JENIS = new Set([371]);

/** Pemisah kalimat: titik koma, atau titik + huruf besar - KECUALI titik singkatan ("Bin.", "Moh.", "Hj.", "S.E."). */
const RE_PECAH_KALIMAT = /;s*|(?<!(?:[A-Za-z]{1,3}|Bin|Binti|Moh|Muh|Mohd|Drs|Dra|Hj|Hi|Ir|Dr|No|Kel|Kec|Kab|Jln?|Alm|Almh)).s+(?=[A-Z])/;
const RE_WAFAT = /\b(?:meninggal(?:\s+dunia)?|wafat|tutup\s+usia)\b/i;

/* ---------------------------------------------------------------------------
 * PEWARIS
 * ------------------------------------------------------------------------- */

const BUANG_DEPAN = /^(?:(?:bahwa|almarhum(?:ah)?|alm\.?|almh\.?|pewaris|bapak|ibu|saudara|sdr\.?|sdri\.?)\s+)+/i;

const BUKAN_NAMA =
  /^(?:Ist?e?ri|Suami|Anak|Ayah|Ibu|Bapak|Kakak|Adik|Saudara|Paman|Kakek|Nenek|Cucu|Orang|Pewaris|Almarhum|Almarhumah|Para|Pemohon|Termohon|Penggugat|Tergugat|Bahwa|Akta|Kutipan|Surat|Nomor|Pada|Tanggal|Kantor|Desa|Kelurahan|Kecamatan|Kabupaten|Kota|Dengan|Dan|Yang|Sesuai|Berdasarkan|Pernikahan|Perkawinan|Pegawai|Selanjutnya|Keduanya|Mereka|Beliau)\b/i;

function bersihNama(n) {
  const t = String(n || "")
    .replace(BUANG_DEPAN, "")
    .replace(/\s*\((?:alm|almh|almarhum|almarhumah)\.?\)\s*$/i, "")
    .trim();
  return BUKAN_NAMA.test(t) ? "" : t;
}

/** Pewaris dari petitum: "Menyatakan/Menetapkan (Almarhum) X telah meninggal", "ahli waris (dari) almarhum X". */
function pewarisPetitum(petitum) {
  const t = P.satuBaris(petitum);
  if (!t) return null;
  const pola = [
    /(?:Menyatakan|Menetapkan)\s+(?:bahwa\s+)?(?:(?:almarhum(?:ah)?|alm\.?|almh\.?|pewaris)\s+)?(?=[A-Z])/,
    /ahli\s+waris\s+(?:yang\s+sah\s+|sah\s+)?(?:dan\s+berhak\s+)?(?:dari\s+)?(?:(?:almarhum(?:ah)?|alm\.?|almh\.?|pewaris)\s+)(?=[A-Z])/i,
    /ahli\s+waris\s+(?:yang\s+sah\s+|sah\s+)?(?:dan\s+berhak\s+)?dari\s+(?=[A-Z])/,
  ];
  for (const p of pola) {
    const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`);
    let m;
    while ((m = re.exec(t)) !== null) {
      const sisa = t.slice(m.index + m[0].length);
      const nama = bersihNama(P.namaDiAwal(sisa));
      if (!nama || /^(?:Pemohon|Para|Penggugat|Tergugat)/.test(nama)) continue;
      // Pola pertama hanya sah bila diikuti "telah meninggal" (bukan "Menetapkan X sebagai ahli waris").
      if (p === pola[0] && !new RegExp(`^[^;]{0,${nama.length + 25}}?\\b(?:telah\\s+)?(?:meninggal|wafat)`, "i").test(sisa)) continue;
      return { nama, kalimat: P.kalimatDi(t, m.index, m[0].length + nama.length), asal: "petitum" };
    }
  }
  return null;
}

/** Pewaris dari posita - beberapa bentuk nyata, yang pertama cocok dipakai. */
function pewarisPosita(satu) {
  const kandidat = [];
  const tambah = (nama, index, kodePola) => {
    const n = bersihNama(nama);
    if (n && !/^(?:Pemohon|Termohon|Penggugat|Tergugat|Para)\b/.test(n) && n.split(" ").length <= 9) kandidat.push({ nama: n, index, kodePola });
  };
  // a. "X bin/binti Y (ALM), telah meninggal dunia"
  {
    const re = /(?:^|[;:,.]\s*|\bBahwa\s+|\bAlm(?:arhum(?:ah)?)?\.?\s+)((?:(?:[A-Z][A-Za-z.'’-]*|alias)\s+){0,6}?[A-Z][A-Za-z.'’-]*\s+bin(?:ti)?\.?\s+(?:[A-Z][A-Za-z.'’-]*\s*){1,5})\s*(?:\((?:alm|almh|almarhum|almarhumah)\.?\)\s*)?,?\s*(?:yang\s+)?(?:telah\s+)?(?:meninggal|wafat)/g;
    let m;
    while ((m = re.exec(satu)) !== null) tambah(P.namaDiAwal(m[1]), m.index, "waris-pewaris-bin-meninggal");
  }
  // b. "telah meninggal dunia suami/ayah kandung dari Pemohon yang bernama X"
  {
    const re = /(?:meninggal\s+dunia|wafat)\s+(?:seorang\s+)?(?:suami|isteri|istri|ayah|ibu|bapak|anak|saudara|adik|kakak|orang\s+tua)[^;]{0,80}?\b(?:yang\s+)?bernama\s+/gi;
    let m;
    while ((m = re.exec(satu)) !== null) tambah(P.namaDiAwal(satu.slice(m.index + m[0].length)), m.index, "waris-pewaris-bernama");
  }
  // c. "X wafat di ..." / "almarhum X yang meninggal"
  {
    const re = /(?:^|[;:.]\s*|\bBahwa\s+|\bsedangkan\s+)((?:[A-Z][A-Za-z.'’-]*\s+){0,5}[A-Z][A-Za-z.'’-]*)\s+(?:telah\s+)?(?:wafat|meninggal(?:\s+dunia)?)\s+(?:di\b|pada\b|\d)/g;
    let m;
    while ((m = re.exec(satu)) !== null) tambah(P.namaDiAwal(m[1]), m.index, "waris-pewaris-wafat-di");
  }
  if (!kandidat.length) return null;
  kandidat.sort((a, b) => a.index - b.index);
  const k = kandidat[0];
  return { nama: P.lengkapiBin(k.nama, satu), kalimat: P.kalimatDi(satu, k.index, 200), asal: "posita", kodePola: k.kodePola };
}

/** Kata pertama nama yang dipakai mencari kalimat pewaris (tanpa gelar). */
function intiNama(nama) {
  const kata = String(nama || "")
    .replace(/\b(?:Hj?|Drs?|Ir|Hi)\.\s*/g, "")
    .split(/\s+/)
    .filter((k) => k.length >= 3 && !/^(?:bin|binti|alias)$/i.test(k));
  return kata[0] || "";
}

/** Kalimat-kalimat (dipisah ";" / ". ") yang menyebut nama itu DAN meninggal/wafat. */
function kalimatWafat(satu, nama, opsi = {}) {
  const inti = intiNama(nama);
  if (!inti) return [];
  // Nama sebagai SUBJEK, bukan sebagai nama ayah ("Labido bin Rampafaya ... meninggal" bukan kalimat Rampafaya).
  const re = new RegExp(`(?<!\\bbin\\s)(?<!\\bbinti\\s)\\b${inti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  const semua = String(satu || "").split(RE_PECAH_KALIMAT);
  const hasil = [];
  for (let i = 0; i < semua.length; i++) {
    const k = semua[i];
    if (re.test(k) && RE_WAFAT.test(k)) hasil.push(k);
    // Kalimat lanjutan tentang orang yang sama: "Almarhumah wafat karena sakit ..." (hanya untuk pewaris).
    else if (opsi.lanjutan && i > 0 && re.test(semua[i - 1]) && /^(?:Almarhum(?:ah)?|Alm\.?|Almh\.?|Pewaris|Beliau)\b/i.test(k.trim()) && RE_WAFAT.test(k)) hasil.push(k);
  }
  return hasil;
}

/* ---------------------------------------------------------------------------
 * TANGGAL, SEBAB, TEMPAT WAFAT
 * ------------------------------------------------------------------------- */

/** Potongan kalimat SESUDAH kata meninggal/wafat, sebelum rujukan akta. */
function ekorWafat(kalimat) {
  const m = RE_WAFAT.exec(kalimat);
  if (!m) return "";
  const sisa = kalimat.slice(m.index + m[0].length);
  const henti = sisa.search(/\b(?:sesuai|berdasarkan|sebagaimana|dibuktikan|(?:Kutipan\s+)?Akta|Surat\s+Keterangan|Nomor|No\.\s|dikuatkan)\b/i);
  return henti < 0 ? sisa : sisa.slice(0, henti);
}

/** "pada tanggal X" di depan kata meninggal ("pada tanggal 27 Januari 2024 telah meninggal dunia ... X"). */
function tanggalDepan(kalimat) {
  const m = RE_WAFAT.exec(kalimat);
  if (!m) return "";
  const depan = kalimat.slice(0, m.index);
  const t = /(?:pada\s+)?(?:hari\s+\w+,?\s+)?tanggal\s+([^,;]{6,40})\s*,?\s*(?:telah\s+)?$/i.exec(depan);
  return t ? P.tanggalBaku(t[1]) : "";
}

/**
 * Bagian kalimat milik orang itu: dari sebutan namanya yang PALING DEKAT ke kata
 * meninggal/wafat berikutnya ("A menikah dengan B, dan B telah meninggal pada
 * tanggal X sedangkan A meninggal Y" -> "A meninggal Y"). Bila namanya baru
 * disebut sesudah kata meninggal ("pada tanggal X telah meninggal dunia suami
 * Pemohon yang bernama A"), kalimatnya utuh.
 */
function fokusKalimat(k, inti) {
  if (!inti) return k;
  const re = new RegExp(`(?<!\\bbin\\s)(?<!\\bbinti\\s)\\b${inti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
  let terbaik = null;
  let m;
  while ((m = re.exec(k)) !== null) {
    const sisa = k.slice(m.index);
    const w = RE_WAFAT.exec(sisa);
    if (w && (!terbaik || w.index < terbaik.jarak)) terbaik = { awal: m.index, jarak: w.index };
  }
  if (!terbaik || terbaik.jarak > 160) return k;
  return k.slice(terbaik.awal);
}

/**
 * Tanggal, sebab, dan tempat wafat dari kalimat-kalimat orang itu. Tiap bagian diambil dari
 * kalimat PERTAMA yang memuatnya ("X wafat di Palu pada tanggal ..."; "Almarhumah wafat karena
 * sakit ..."), kalimat sumbernya yang pertama dipakai.
 */
function faktaWafat(kalimatDaftar, inti) {
  const gabung = { tanggal: "", sebab: "", tempat: "", kalimat: "" };
  for (const kalimatAsli of kalimatDaftar) {
    const f = faktaWafatSatu(kalimatAsli, inti);
    if (!f) continue;
    if (!gabung.kalimat) gabung.kalimat = f.kalimat;
    for (const k of ["tanggal", "sebab", "tempat"]) if (!gabung[k] && f[k]) gabung[k] = f[k];
  }
  return gabung.kalimat ? gabung : null;
}

function faktaWafatSatu(kalimatAsli, inti) {
  {
    const k = fokusKalimat(kalimatAsli, inti);
    const ekor = ekorWafat(k);
    const tgl = P.letakTanggal(ekor);
    const tanggal = (tgl && tgl.nilai) || tanggalDepan(k);
    const sebabM =
      /\b(?:dikarenakan|dikarenakannya|karena|disebabkan(?:\s+(?:karena|oleh))?|akibat)\s+(?:penyakit\s+)?([a-z][^,;]{1,60}?)(?=\s*(?:,|;|\.|\bdan\s+(?:dalam|meninggal|tetap)|\bdalam\s+(?:keadaan|usia)|\bpada\b|\bdi\s+[A-Z]|\bsesuai|\bberdasarkan|\bsebagaimana|$))/i.exec(
        ekor || k
      );
    const AKHIR_TEMPAT =
      "(?=\\s*(?:pada\\s+(?:hari|tanggal)|karena|dikarenakan|akibat|disebabkan|dalam\\s+(?:keadaan|usia)|sesuai|berdasarkan|;|,\\s*(?:pada|karena|dalam|sesuai|dan)|\\.\\s|\\.$|$))";
    const tempatM =
      new RegExp(
        `\\b(?:meninggal(?:\\s+dunia)?|wafat)\\s+(?:(?:pada\\s+[^,;]{0,40}?\\s+)?)di\\s+((?:[A-Z]|Rumah|rumah|RS|Desa|desa|Kel|Kec|Kab|Kota|Dusun|Jalan|Jl)[^,;]{1,90}?)${AKHIR_TEMPAT}`,
        "i"
      ).exec(k) ||
      // "... meninggal dunia suami Pemohon yang bernama X di Kabupaten Sigi" - tempat sesudah nama, sebelum rujukan akta.
      new RegExp(`\\bdi\\s+((?:Desa|Kelurahan|Kabupaten|Kota|Kecamatan|Rumah\\s+Sakit|RSU?D?|Dusun)\\b[^,;]{1,90}?)${AKHIR_TEMPAT}`).exec(
        k.split(/\b(?:sesuai|berdasarkan|sebagaimana|tempat\s+tinggal|bertempat|Kutipan|Akta|Surat\s+Keterangan|dikeluarkan)\b/i)[0]
      );
    if (tanggal || sebabM || tempatM) {
      return {
        tanggal,
        sebab: sebabM ? sebabM[1].replace(/\s+/g, " ").trim().toLowerCase() : "",
        tempat: tempatM ? tempatM[1].replace(/\s+/g, " ").replace(/[\s,.]+$/, "").trim() : "",
        kalimat: kalimatAsli.trim().slice(0, 400),
      };
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * SUAMI/ISTRI PEWARIS, ANAK, HARTA (P3HP)
 * ------------------------------------------------------------------------- */

const ROMAWI = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/** "Pemohon I" -> nama pihak SIPP berurutan sama (null bila tak ada). */
function namaPemohon(sebut, pihak1) {
  const m = /Pemohon(?:\s+([IVX]{1,4}))?/.exec(String(sebut || ""));
  if (!m || !Array.isArray(pihak1) || !pihak1.length) return "";
  const ke = m[1] ? ROMAWI[m[1]] : 1;
  const p = pihak1.find((x) => Number(x.urutan) === ke) || (ke === 1 && pihak1.length === 1 ? pihak1[0] : null);
  return p && p.nama ? String(p.nama).trim() : "";
}

function pasanganPewaris(satu, pewaris, pihak1) {
  const inti = intiNama(pewaris);
  if (!inti) return null;
  const lolos = inti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const kalimat = satu.split(RE_PECAH_KALIMAT).filter((k) => new RegExp(`\\b${lolos}`, "i").test(k) && /(?:pernikahan|perkawinan|menikah|kawin)/i.test(k));
  for (const k of kalimat) {
    // "<pewaris> dan <X> (telah) melangsungkan pernikahan"
    let m = new RegExp(`\\b${lolos}[^;]{0,80}?\\s+dan\\s+(?:(?:ibu|bapak|alm\\.?|almh\\.?|almarhum(?:ah)?)\\s+)?`, "i").exec(k);
    if (m && /melangsungkan|menikah|perkawinan|pernikahan/i.test(k.slice(m.index + m[0].length, m.index + m[0].length + 140))) {
      const sisa = k.slice(m.index + m[0].length);
      if (/^Pemohon\b/.test(sisa)) {
        const n = namaPemohon(sisa.slice(0, 14), pihak1);
        if (n) return { nama: n, kalimat: k, asal: "sipp", kodePola: "waris-pasangan-pemohon-sipp" };
      }
      const n = bersihNama(P.namaDiAwal(sisa));
      if (n && n.split(" ").length <= 8) return { nama: P.lengkapiBin(n, satu), kalimat: k, asal: "posita", kodePola: "waris-pasangan-dan" };
    }
    // "<pewaris> ... menikah dengan (seorang perempuan/lelaki) (yang) bernama X" / "... yaitu dengan X"
    m = /(?:menikah|perkawinan|pernikahan|kawin)[^;]{0,40}?\bdengan\s+(?:seorang\s+|seseorang\s+)?(?:perempuan\s+|wanita\s+|laki-laki\s+|lelaki\s+|pria\s+)?(?:(?:yang\s+)?bernama\s+|yaitu\s+(?:dengan\s+)?)?(?:Alm\.?\s+|Almh\.?\s+)?/i.exec(k);
    if (m) {
      const sisa = k.slice(m.index + m[0].length);
      if (/^Pemohon\b/.test(sisa)) {
        const n = namaPemohon(sisa.slice(0, 14), pihak1);
        if (n) return { nama: n, kalimat: k, asal: "sipp", kodePola: "waris-pasangan-pemohon-sipp" };
      }
      const n = bersihNama(P.namaDiAwal(sisa));
      if (n && intiNama(n) !== inti) return { nama: P.lengkapiBin(n, satu), kalimat: k, asal: "posita", kodePola: "waris-pasangan-dengan" };
    }
    // "<X> dan <pewaris> melangsungkan pernikahan" (pewaris disebut kedua)
    m = new RegExp(`(?:^|Bahwa\\s+|tanggal\\s+[^;]{4,30}?\\s+)((?:[A-Z][A-Za-z.'’-]*\\s+){0,6}?[A-Z][A-Za-z.'’-]*)\\s+(?:\\([^)]*\\)\\s+)?dan\\s+(?:Alm\\.?\\s+|Almh\\.?\\s+)?${lolos}`, "i").exec(k);
    if (m) {
      const n = bersihNama(P.namaDiAwal(m[1]));
      if (n && intiNama(n) !== inti) return { nama: P.lengkapiBin(n, satu), kalimat: k, asal: "posita", kodePola: "waris-pasangan-depan" };
    }
  }
  return null;
}

function tanggalNikahPewaris(satu, pewaris) {
  const inti = intiNama(pewaris);
  if (!inti) return null;
  const re = new RegExp(`\\b${inti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  for (const k of satu.split(RE_PECAH_KALIMAT)) {
    if (!re.test(k) || !/melangsungkan\s+(?:pernikahan|perkawinan)|telah\s+menikah|menikah\s+pada/i.test(k)) continue;
    // Tanggal sebelum "melangsungkan"/"menikah" atau sesudah "pada tanggal" - bukan tanggal akta nikah.
    const potong = k.split(/\b(?:Kutipan\s+Akta|Akta\s+Nikah|Nomor|sesuai|sebagaimana|dicatat)\b/i)[0];
    const t = P.tanggalBaku(potong);
    if (t) return { nilai: t, kalimat: k.trim().slice(0, 400) };
  }
  return null;
}

/** "dikaruniai N orang anak (masing-masing) (yang) bernama: A; B; C" -> ["A","B","C"]. */
function anakPewaris(daftarBaris, intiPewaris) {
  const sebutPewaris = intiPewaris ? new RegExp(`\\b${intiPewaris.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") : null;
  for (let i = 0; i < daftarBaris.length; i++) {
    const b = daftarBaris[i];
    const m = /dikaruniai\s+(?:seorang\s+|\d+\s*(?:\([^)]*\)\s*)?)?(?:orang\s+)?anak[^:;]{0,60}?(?:bernama|yaitu|sebagai\s+berikut)\s*:?\s*/i.exec(b);
    if (!m) continue;
    const nama = [];
    const ambil = (t) => {
      const n = bersihNama(P.namaDiAwal(String(t).replace(/^\s*(?:\d{1,2}|[a-z])\s*[.)]\s*/i, "")));
      if (n && n.split(" ").length <= 8) nama.push(n);
    };
    const sisa = b.slice(m.index + m[0].length);
    if (sisa.trim()) {
      sisa.split(/;\s*|\s+(?=(?:\d{1,2}|[a-h])\s*[.)]\s)/).forEach(ambil);
    } else {
      for (let j = i + 1; j < daftarBaris.length && !P.RE_BUTIR_BARU.test(daftarBaris[j]); j++) ambil(daftarBaris[j]);
    }
    // Anak dari pernikahan ORANG TUA pewaris (pewaris sendiri ada di daftarnya) bukan anak pewaris.
    if (sebutPewaris && nama.some((n) => sebutPewaris.test(n.split(/\s+bin(?:ti)?\s+/i)[0]))) continue;
    if (sebutPewaris && !sebutPewaris.test(b) && !(i > 0 && sebutPewaris.test(daftarBaris[i - 1]))) continue;
    if (nama.length) return { nama, kalimat: b };
  }
  return null;
}

const PEMBUKA_HARTA_PAW = /meninggalkan\s+(?:sejumlah\s+)?harta\s+(?:warisan|peninggalan|benda)?\s*(?:berupa|yaitu|sebagai\s+berikut|antara\s+lain)?/i;

function hartaPaw(daftarBaris) {
  const d = P.daftarSesudah(daftarBaris, PEMBUKA_HARTA_PAW);
  if (!d.benda.length) return null;
  const benda = d.benda.map((x) => x.replace(/\s*;\s*Bahwa\b.*$/i, "").replace(/[\s,;.]+$/, ""));
  const nilai = benda.length === 1 ? benda[0] : `${benda.slice(0, -1).join("; ")} dan ${benda[benda.length - 1]}`;
  return { nilai, kalimat: d.kalimat };
}

/* ---------------------------------------------------------------------------
 * KEWARISAN: AHLI WARIS & TIRKAH
 * ------------------------------------------------------------------------- */

const PEMBUKA_AHLI_WARIS = /(?:meninggalkan|adalah|yaitu|yang\s+menjadi)\s+(?:para\s+)?ahli\s+waris[^:;]{0,80}?(?:sebagai\s+berikut|yaitu|masing-masing|:)/i;
const PEMBUKA_TIRKAH =
  /(?:harta\s+(?:peninggalan|warisan|budel|benda)|tirkah|obje?k\s+sengketa|harta\s+yang\s+ditinggalkan)[^:;]{0,100}?(?:berupa|sebagai\s+berikut|yaitu|antara\s+lain|:)/i;

/* ---------------------------------------------------------------------------
 * DETEKSI (murni)
 * ------------------------------------------------------------------------- */

function yakinUntuk(kode, jenis = 371) {
  return SIAP.has(kode) && SIAP_JENIS.has(Number(jenis)) ? "cukup" : "ragu";
}

/**
 * @param {string} posita
 * @param {{jenisPerkara?: string|number, petitum?: string, sipp?: {pihak1?: Array}}} opsi
 */
function deteksi(posita, opsi = {}) {
  const jenis = Number(opsi.jenisPerkara) || 371;
  const daftar = P.baris(posita);
  const satu = daftar.join("; ");
  const petitum = String(opsi.petitum || "");
  const pihak1 = (opsi.sipp && opsi.sipp.pihak1) || [];
  const hasil = {};
  if (!satu && !petitum) return hasil;

  const dariPetitum = pewarisPetitum(petitum);
  const dariPosita = pewarisPosita(satu);
  let pewaris = dariPetitum || dariPosita;
  if (pewaris && dariPetitum && dariPosita && P.normal(dariPosita.nama).startsWith(P.normal(dariPetitum.nama)) && dariPosita.nama.length > dariPetitum.nama.length) {
    pewaris = { ...dariPetitum, nama: dariPosita.nama };
  }
  if (pewaris) pewaris = { ...pewaris, nama: P.lengkapiBin(pewaris.nama, `${satu}; ${P.satuBaris(petitum)}`) };
  if (pewaris) {
    const sepakat = !(dariPetitum && dariPosita) || intiNama(dariPetitum.nama).toLowerCase() === intiNama(dariPosita.nama).toLowerCase();
    hasil["1025"] = {
      nilai: pewaris.nama,
      kalimat: pewaris.kalimat,
      asal: pewaris.asal,
      yakin: sepakat ? yakinUntuk("1025", jenis) : "ragu",
      catatan: sepakat ? "" : `Posita menyebut pewaris ${dariPosita.nama} - berbeda dengan petitum.`,
      kodePola: pewaris.kodePola || `waris-pewaris-${pewaris.asal}`,
    };
    const wafat = faktaWafat([...kalimatWafat(satu, pewaris.nama, { lanjutan: true }), ...kalimatWafat(P.satuBaris(petitum), pewaris.nama)], intiNama(pewaris.nama));
    if (wafat) {
      if (wafat.tanggal) hasil["1246"] = { nilai: wafat.tanggal, kalimat: wafat.kalimat, yakin: yakinUntuk("1246", jenis), kodePola: "waris-tanggal-wafat" };
      if (wafat.sebab) hasil["1247"] = { nilai: wafat.sebab, kalimat: wafat.kalimat, yakin: yakinUntuk("1247", jenis), kodePola: "waris-sebab-wafat" };
      if (wafat.tempat) hasil["1509"] = { nilai: wafat.tempat, kalimat: wafat.kalimat, yakin: yakinUntuk("1509", jenis), kodePola: "waris-tempat-wafat" };
    }
    if (jenis === 371) {
      const pasangan = pasanganPewaris(satu, pewaris.nama, pihak1);
      if (pasangan) {
        hasil["8610"] = { nilai: pasangan.nama, kalimat: pasangan.kalimat.slice(0, 400), asal: pasangan.asal, yakin: yakinUntuk("8610", jenis), kodePola: pasangan.kodePola };
        const wp = faktaWafat(kalimatWafat(satu, pasangan.nama), intiNama(pasangan.nama));
        if (wp && wp.tanggal) {
          const bagian = [`pada tanggal ${wp.tanggal}`];
          if (wp.tempat) bagian.push(`di ${wp.tempat}`);
          if (wp.sebab) bagian.push(`karena ${wp.sebab}`);
          hasil["8613"] = { nilai: bagian.join(" "), kalimat: wp.kalimat, yakin: "ragu", kodePola: "waris-wafat-pasangan" };
        }
      }
      const tn = tanggalNikahPewaris(satu, pewaris.nama);
      if (tn) hasil["5197"] = { nilai: tn.nilai, kalimat: tn.kalimat, yakin: "ragu", kodePola: "waris-tanggal-nikah" };
    }
  }
  if (jenis === 371) {
    const h = hartaPaw(daftar);
    if (h) hasil["8614"] = { nilai: h.nilai, kalimat: h.kalimat, yakin: "ragu", kodePola: "waris-harta-paw" };
    const anak = anakPewaris(daftar, hasil["1025"] ? intiNama(hasil["1025"].nilai) : "");
    if (anak) {
      const n = anak.nama;
      hasil["8608"] = { nilai: n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} dan ${n[n.length - 1]}`, kalimat: anak.kalimat, yakin: "ragu", kodePola: "waris-anak-pewaris" };
    }
  } else {
    const daftarPetitum = P.baris(petitum);
    let aw = P.daftarSesudah(daftar, PEMBUKA_AHLI_WARIS);
    if (!aw.benda.length) aw = P.daftarSesudah(daftarPetitum, PEMBUKA_AHLI_WARIS);
    if (aw.benda.length) hasil["8717"] = { nilai: P.isianBernomor(aw.benda), kalimat: aw.kalimat, yakin: "ragu", kodePola: "waris-ahli-waris-daftar" };
    let tk = P.daftarSesudah(daftar, PEMBUKA_TIRKAH);
    if (!tk.benda.length) tk = P.daftarSesudah(daftarPetitum, PEMBUKA_TIRKAH);
    if (!tk.benda.length) tk = P.bendaBerletak(daftar);
    if (tk.benda.length) hasil["8718"] = { nilai: P.isianBernomor(tk.benda), kalimat: tk.kalimat, yakin: "ragu", kodePola: "waris-tirkah-daftar" };
  }
  return hasil;
}

module.exports = {
  kunci: "waris",
  jenisPerkaraId: [371, 364, 365],
  variabel,
  UKUR,
  SIAP,
  SIAP_JENIS,
  deteksi,
  // diuji langsung
  pewarisPetitum,
  pewarisPosita,
  faktaWafat,
  kalimatWafat,
  pasanganPewaris,
  anakPewaris,
  hartaPaw,
  namaPemohon,
};
