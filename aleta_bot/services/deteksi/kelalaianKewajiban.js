"use strict";

/**
 * ============================================================================
 * DETEKSI KELALAIAN ATAS KEWAJIBAN SUAMI / ISTRI (jenis_perkara_id 345, Pdt.G)
 * ============================================================================
 *
 * Paket abt-w3a-blangko-baru-perkawinan (agen W3a-C, 21 Okt 2026). Blangko Derry
 * "1e Kelalaian Kewajiban Suami Istri" memakai variabel ABT 3690-3733.
 *
 * Gugatan suami atau istri terhadap pasangannya yang melalaikan kewajiban tanpa
 * meminta cerai (Pasal 34 ayat (3) UU 1/1974 jo. Pasal 77 ayat (5) KHI). Yang
 * dibaca dari posita/petitum:
 *
 *   3691  kedudukan Penggugat (istri / suami)  - hanya dari kalimat posita yang tegas;
 *         jenis kelamin Penggugat di SIPP dibaca langsung oleh variabel 3690 (data_sql)
 *   3694  kewajiban yang dilalaikan (frasa benda)
 *   3696  fakta hukum kelalaian (kalimat sesudah "Bahwa")
 *   3697  sejak kapan kewajiban dilalaikan
 *   3700  nafkah ke depan per bulan (tuntutan)        - USULAN "ragu": besaran ditetapkan majelis
 *   3701  nafkah lampau: jangka waktu (tuntutan)      - USULAN "ragu"
 *   3702  nafkah lampau: jumlah (tuntutan)            - USULAN "ragu"
 *   3703  kiswah (tuntutan)                            - USULAN "ragu"
 *   3704  tempat kediaman (tuntutan)                   - USULAN "ragu"
 *   3705  biaya rumah tangga, perawatan, pengobatan    - USULAN "ragu"
 *   3706  kewajiban lain bukan uang (kembali serumah, mengatur rumah tangga) - USULAN "ragu"
 *   3708  pemotongan langsung penghasilan              - USULAN "ragu"
 *   3709  sita jaminan                                 - USULAN "ragu"
 *   3710  uang paksa                                   - USULAN "ragu"
 *
 * ATURAN: nilai tuntutan (3700-3710) tidak pernah "pasti"/"cukup": yang dituntut bukan yang dikabulkan,
 * dan dikabulkan atau tidaknya selalu keputusan hakim. Fakta kelalaian (3694, 3697) hanya "cukup" bila
 * kalimat sumber memuat penyangkalan/kelalaian yang tegas oleh Tergugat. Teks yang tidak berkaitan
 * (mis. posita cerai) tidak menghasilkan nilai apa pun. MURNI: tidak membaca basis data.
 *
 * Tidak dideteksi: 3699 (dalil Tergugat/alasan sah - dari jawaban/sidang), 3711/3712 (pertimbangan majelis),
 * 3730/3731 (alat bukti surat dicatat dari sidang).
 */

const B = require("./bantuAnak");

const variabel = Object.freeze([
  { kode: "3691", nama: "Kedudukan Penggugat (istri atau suami)", sumber: "posita", blangko: ["putusan"] },
  { kode: "3694", nama: "Kewajiban yang dilalaikan", sumber: "posita", blangko: ["putusan"] },
  { kode: "3696", nama: "Fakta hukum kelalaian", sumber: "posita", blangko: ["putusan"] },
  { kode: "3697", nama: "Sejak kapan kewajiban dilalaikan", sumber: "posita", blangko: ["putusan"] },
  { kode: "3700", nama: "Nafkah ke depan per bulan (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3701", nama: "Nafkah lampau: jangka waktu (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3702", nama: "Nafkah lampau: jumlah (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3703", nama: "Kiswah (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3704", nama: "Tempat kediaman (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3705", nama: "Biaya rumah tangga, perawatan dan pengobatan (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3706", nama: "Kewajiban lain bukan uang (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3708", nama: "Pemotongan langsung penghasilan (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3709", nama: "Sita jaminan (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3710", nama: "Uang paksa (tuntutan)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "3699", nama: "Dalil Tergugat atau alasan sah", sumber: "sidang", blangko: ["putusan"], deteksi: false },
  { kode: "3711", nama: "Alasan petitum selebihnya ditolak", sumber: "majelis", blangko: ["putusan"], deteksi: false },
  { kode: "3712", nama: "Alasan gugatan ditolak", sumber: "majelis", blangko: ["putusan"], deteksi: false },
  { kode: "3730", nama: "Alat bukti surat Penggugat", sumber: "sidang", blangko: ["putusan", "bas"], deteksi: false },
  { kode: "3731", nama: "Alat bukti surat Tergugat", sumber: "sidang", blangko: ["putusan", "bas"], deteksi: false },
]);

const BULAN_RE = "Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|Augustus|September|Oktober|Nopember|November|Desember";

/** Kalimat posita yang menyatakan Tergugat tidak melaksanakan kewajiban / meninggalkan. */
const LALAI = new RegExp(
  "(?:tidak\\s+(?:pernah\\s+|lagi\\s+|mau\\s+|bersedia\\s+)?(?:memberi|memberikan|menafkahi|memenuhi|menyediakan|membiayai|mengurus|mengatur|melaksanakan|berbakti|pulang|menanggung|memelihara|menjalankan|bertanggung\\s*jawab|serumah|tinggal|menghiraukan|peduli|menjalankan)" +
    "|melalaikan|menelantarkan|meninggalkan|pergi\\s+(?:dari|meninggalkan)|pisah\\s+(?:rumah|tempat\\s+tinggal)|nusyuz|kabur\\s+dari)",
  "i"
);

/** Jenis kewajiban: [kunci, pola kalimat, frasa untuk isian 3694]. Nafkah anak dan tuntutan lampau/iddah/mutah bukan kewajiban yang dibaca di sini. */
const KATEGORI = [
  ["nafkah-lahir", /\bnafkah(?!\s+(?:untuk\s+)?anak)(?!\s+(?:lampau|madh?[il]yah|iddah|mut'?ah|batin))(?:\s+lahir)?|biaya\s+hidup|keperluan\s+hidup|kebutuhan\s+hidup|uang\s+belanja|memberi\s+nafkah/i, "memberi nafkah lahir"],
  ["nafkah-batin", /\bnafkah\s+batin|hubungan\s+(?:suami\s+istri|badan)|kebutuhan\s+biologis/i, "memberi nafkah batin"],
  ["kiswah", /\bkiswah|pakaian|sandang/i, "menyediakan kiswah (pakaian)"],
  ["tempat", /tempat\s+(?:tinggal|kediaman)(?!\s+bersama)|rumah\s+(?:tinggal|kediaman)(?!\s+bersama)|menyediakan\s+rumah/i, "menyediakan tempat kediaman"],
  ["biaya", /biaya\s+(?:rumah\s+tangga|perawatan|pengobatan|berobat)|berobat/i, "menanggung biaya rumah tangga, perawatan dan pengobatan"],
  ["rumah-tangga", /(?:mengurus|mengatur|menyelenggarakan)\s+(?:urusan\s+|keperluan\s+)?rumah\s+tangga|urusan\s+rumah\s+tangga|pekerjaan\s+rumah/i, "mengatur urusan rumah tangga"],
  ["berbakti", /berbakti|patuh|taat\b|mengabaikan\s+suami|nusyuz/i, "berbakti lahir dan batin kepada suami"],
  ["serumah", /serumah|meninggalkan\s+(?:tempat\s+kediaman|rumah)|pergi\s+dari\s+rumah|pisah\s+rumah|pulang\s+ke\s+rumah|kembali\s+ke\s+rumah|tidak\s+pulang/i, "tinggal serumah di tempat kediaman bersama"],
];

function gabungPhrase(daftar) {
  if (!daftar.length) return "";
  const isi = daftar.length === 1 ? daftar[0] : `${daftar.slice(0, -1).join(", ")} dan ${daftar[daftar.length - 1]}`;
  return `kewajiban ${isi}`;
}

function rupiah(angka) {
  const T = require("../tuntutanDeteksiService");
  const n = Number(angka);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${T.formatRupiah(n)} (${T.terbilang(n)} rupiah)`;
}

/** Nominal pertama dalam teks (angka Rupiah >= 1000), atau null. */
function nominalPertama(teks) {
  const T = require("../tuntutanDeteksiService");
  const daftar = T.nominalDari(teks);
  return daftar.length ? daftar[0] : null;
}

/** Kalimat petitum yang memuat pola; petitum dipecah per butir/titik koma. */
function butirPetitum(petitum, posita) {
  const sumber = [petitum, posita].filter((x) => String(x || "").trim());
  const hasil = [];
  for (const s of sumber) for (const k of B.kalimat(s)) hasil.push({ k, dari: s === petitum ? "petitum" : "posita" });
  return hasil;
}

const BUKAN_NAFKAH_ISTRI = /nafkah\s+(?:untuk\s+)?anak|anak\s+(?:yang\s+)?bernama|hadh?anah|hak\s+asuh|iddah|mut'?ah/i;

function deteksi(posita, opsi = {}) {
  const t = B.polos(posita);
  const pet = B.polos(opsi.petitum || "");
  const peta = {};
  if (!t && !pet) return peta;
  const kal = B.kalimat(posita);

  // ---- Perkawinan masih berlangsung dan kelalaian: gerbang. Tanpa kata kelalaian + pasangan, jangan menebak apa pun ----
  const adaSuamiIstri = /\b(?:suami|isteri|istri)\b/i.test(t) || /\bPenggugat\b/.test(t);
  const kalLalai = kal.filter((k) => LALAI.test(k));
  const petitumKelalaian = /(?:melalaikan|lalai)\b/i.test(pet) || /Menghukum\s+Tergugat\s+untuk\s+(?:membayar|memberi|menyediakan|kembali|memenuhi)/i.test(pet);
  if (!adaSuamiIstri || (!kalLalai.length && !petitumKelalaian)) return peta;
  // Perceraian: posita cerai (broken marriage) bukan gugatan kelalaian; hanya waspada bila petitum menuntut cerai
  if (/(?:menjatuhkan\s+talak|bercerai|perceraian|putusnya\s+perkawinan)/i.test(pet) && !petitumKelalaian) return peta;

  // ---- 3691 kedudukan Penggugat ----
  const k1 = /\bPenggugat\s+(?:adalah|merupakan|selaku|sebagai)\s+(?:seorang\s+)?(isteri|istri|suami)(?:\s+sah)?\s+(?:dari\s+)?Tergugat/i.exec(t);
  const k2 = /\bTergugat\s+(?:adalah|merupakan|selaku|sebagai)\s+(?:seorang\s+)?(isteri|istri|suami)(?:\s+sah)?\s+(?:dari\s+)?Penggugat/i.exec(t);
  let kedudukan = "";
  let kalimatKedudukan = "";
  if (k1) {
    kedudukan = /suami/i.test(k1[1]) ? "suami" : "istri";
    kalimatKedudukan = t.slice(Math.max(0, k1.index - 40), k1.index + k1[0].length + 60);
  }
  if (k2) {
    const dariK2 = /suami/i.test(k2[1]) ? "istri" : "suami"; // Tergugat suami -> Penggugat istri
    if (kedudukan && kedudukan !== dariK2) {
      kedudukan = "";
    } else if (!kedudukan) {
      kedudukan = dariK2;
      kalimatKedudukan = t.slice(Math.max(0, k2.index - 40), k2.index + k2[0].length + 60);
    }
  }
  if (kedudukan) {
    const sipp = String(opsi.jenisKelaminPenggugat || "").trim().toUpperCase();
    const bentrok = sipp && ((sipp === "L" && kedudukan === "istri") || (sipp === "P" && kedudukan === "suami"));
    B.taruh(peta, "3691", B.fakta(kedudukan, kalimatKedudukan, bentrok ? "ragu" : "pasti", "kelalaian-3691-kedudukan"));
    if (bentrok) peta["3691"].catatan = "Posita menyebut kedudukan yang berbeda dari jenis kelamin Penggugat di SIPP; periksa.";
  }

  // ---- 3694 kewajiban yang dilalaikan: kategori dari kalimat berpenyangkalan ----
  const ditemukan = [];
  let kalimatKew = "";
  // Kewajiban suami (nafkah, kiswah, tempat kediaman, biaya) dan kewajiban istri (rumah tangga, berbakti) dipisah menurut kedudukan Penggugat bila terbaca.
  const KHAS_SUAMI = ["nafkah-lahir", "nafkah-batin", "kiswah", "tempat", "biaya"];
  const KHAS_ISTRI = ["rumah-tangga", "berbakti"];
  for (const [kunci, pola, frasa] of KATEGORI) {
    if (kedudukan === "istri" && KHAS_ISTRI.includes(kunci)) continue;
    if (kedudukan === "suami" && KHAS_SUAMI.includes(kunci)) continue;
    const k = kalLalai.find((x) => !BUKAN_NAFKAH_ISTRI.test(x) && pola.test(x));
    if (k) {
      ditemukan.push([kunci, frasa]);
      if (!kalimatKew) kalimatKew = k;
    }
  }
  // "nafkah batin" memuat "nafkah" tetapi bukan nafkah lahir; "berbakti" dan "serumah" hanya bila Tergugat istri/pergi
  if (ditemukan.length) {
    B.taruh(peta, "3694", B.fakta(gabungPhrase(ditemukan.map((d) => d[1])), kalimatKew, "cukup", "kelalaian-3694-kewajiban"));
  }

  // ---- 3697 sejak kapan ----
  for (const k of kalLalai) {
    const bt = new RegExp(`sejak\\s+(?:bulan\\s+)?(?:tanggal\\s+\\d{1,2}\\s+)?(${BULAN_RE})\\s+(?:tahun\\s+)?(\\d{4})`, "i").exec(k);
    if (bt) {
      const bulan = B.BULAN[(B.angkaBulan(bt[1]) || 1) - 1];
      B.taruh(peta, "3697", B.fakta(`sejak bulan ${bulan} ${bt[2]}`, k, "cukup", "kelalaian-3697-sejak"));
      break;
    }
    const th = /sejak\s+(?:tahun\s+)?(20\d{2}|19\d{2})\b/i.exec(k);
    if (th) {
      B.taruh(peta, "3697", B.fakta(`sejak tahun ${th[1]}`, k, "cukup", "kelalaian-3697-sejak-tahun"));
      break;
    }
  }

  // ---- 3696 fakta hukum: kalimat kelalaian pertama, tanpa nomor dan kata "Bahwa" ----
  if (kalLalai.length) {
    const k = kalLalai.find((x) => /Tergugat/.test(x)) || kalLalai[0];
    const isi = k.replace(/^(?:\d+[.)]\s*)?Bahwa\s+/i, "").replace(/[;.\s]+$/, "");
    if (isi.length >= 25) B.taruh(peta, "3696", B.fakta(isi.length > 300 ? `${isi.slice(0, 297)}...` : isi, k, "ragu", "kelalaian-3696-fakta"));
  }

  // ---- Tuntutan (petitum, lalu posita): selalu USULAN "ragu" ----
  const butir = butirPetitum(opsi.petitum, posita);
  const cari = (pola, tolak) => butir.find(({ k }) => pola.test(k) && !(tolak && tolak.test(k)));
  const ragu = (kode, nilai, sumberKalimat, kodePola, catatan) => {
    if (!nilai) return;
    const f = B.fakta(nilai, sumberKalimat, "ragu", kodePola, "petitum");
    if (f) {
      if (catatan) f.catatan = catatan;
      peta[kode] = peta[kode] || f;
    }
  };

  // 3702 / 3701 nafkah lampau
  const lampau = cari(/nafkah\s+(?:lampau|terdahulu|yang\s+(?:telah\s+)?(?:lalu|terhutang))|nafkah\s+madh?[il]yah|madh?[il]yah/i, /anak/i);
  if (lampau) {
    const k = lampau.k;
    const nom = nominalPertama(k);
    const rentang = new RegExp(`(?:sejak|dari)\\s+(?:bulan\\s+)?(${BULAN_RE})\\s+(?:tahun\\s+)?(\\d{4})\\s+(?:sampai(?:\\s+dengan)?|hingga|s\\/d)\\s+(?:bulan\\s+)?(${BULAN_RE})\\s+(?:tahun\\s+)?(\\d{4})(?:\\s*\\(?\\s*(\\d{1,3})\\s*bulan\\s*\\)?)?`, "i").exec(k);
    let periode = "";
    if (rentang) {
      const b1 = B.BULAN[(B.angkaBulan(rentang[1]) || 1) - 1];
      const b2 = B.BULAN[(B.angkaBulan(rentang[3]) || 1) - 1];
      const hitung = (Number(rentang[4]) - Number(rentang[2])) * 12 + (B.angkaBulan(rentang[3]) - B.angkaBulan(rentang[1])) + 1;
      const n = rentang[5] ? Number(rentang[5]) : hitung;
      periode = `sejak bulan ${b1} ${rentang[2]} sampai dengan bulan ${b2} ${rentang[4]} (${n} bulan)`;
      ragu("3701", periode, k, "kelalaian-3701-periode", "Jangka waktu menurut gugatan; majelis menetapkan jangka waktu yang terbukti.");
    }
    if (nom) {
      let total = nom.nilai;
      const kali = /(\d{1,3})\s*(?:\(\s*[a-z ]+\s*\)\s*)?bulan\s*(?:x|×|kali)\s*Rp/i.exec(k);
      if (kali && nom.nilai < 100000000 && /(?:x|×|kali)\s*Rp/i.test(k) && !/sejumlah|total|seluruhnya/i.test(k)) total = nom.nilai * Number(kali[1]);
      ragu("3702", rupiah(total), k, "kelalaian-3702-lampau", "Jumlah menurut gugatan; majelis menetapkan jumlah yang terbukti.");
    }
  }

  // 3700 nafkah ke depan: nafkah istri per bulan, bukan lampau/anak/iddah
  const depan = butir.find(({ k }) => /nafkah|biaya\s+hidup|uang\s+belanja/i.test(k) && !/lampau|madh?[il]yah|terdahulu|iddah|mut'?ah|anak/i.test(k) && /(?:setiap|tiap|per|\/)\s*bulan|perbulan/i.test(k));
  if (depan) {
    const nom = nominalPertama(depan.k);
    if (nom) ragu("3700", rupiah(nom.nilai), depan.k, "kelalaian-3700-ke-depan", "Jumlah menurut gugatan; majelis menetapkan besarnya menurut kemampuan Tergugat dan kebutuhan dasar Penggugat.");
  }

  // 3703 kiswah
  const kis = cari(/kiswah|pakaian/i, BUKAN_NAFKAH_ISTRI);
  if (kis) {
    const nom = nominalPertama(kis.k);
    ragu("3703", nom ? rupiah(nom.nilai) : "pakaian yang layak sesuai kebutuhan", kis.k, "kelalaian-3703-kiswah", "Bentuk atau jumlah menurut gugatan.");
  }

  // 3704 tempat kediaman
  const tmp = cari(/menyediakan\s+(?:sebuah\s+|sebuah\s+|satu\s+)?(?:tempat\s+(?:tinggal|kediaman)|rumah)|tempat\s+kediaman\s+(?:yang\s+)?layak|tempat\s+tinggal\s+(?:yang\s+)?layak/i, BUKAN_NAFKAH_ISTRI);
  if (tmp) {
    const m = /(?:menyediakan\s+)?((?:sebuah\s+|satu\s+)?(?:tempat\s+(?:tinggal|kediaman)|rumah)[^;]{0,140})/i.exec(tmp.k);
    if (m) ragu("3704", m[1].replace(/[;.\s,]+$/, "").trim(), tmp.k, "kelalaian-3704-tempat", "Bentuk pemenuhan menurut gugatan.");
  }

  // 3705 biaya rumah tangga / perawatan / pengobatan
  const biaya = cari(/biaya\s+(?:rumah\s+tangga|perawatan|pengobatan|berobat)|kebutuhan\s+rumah\s+tangga/i, BUKAN_NAFKAH_ISTRI);
  if (biaya) {
    const bag = [];
    if (/rumah\s+tangga/i.test(biaya.k)) bag.push("kebutuhan rumah tangga sehari-hari");
    if (/pengobatan|berobat|perawatan/i.test(biaya.k)) bag.push("biaya perawatan dan pengobatan");
    ragu("3705", bag.length === 1 ? bag[0] : bag.join(" dan "), biaya.k, "kelalaian-3705-biaya", "Rincian menurut gugatan.");
  }

  // 3706 kewajiban lain bukan uang
  const kemb = cari(/(?:kembali|pulang)\s+(?:ke\s+(?:rumah|tempat\s+kediaman)|tinggal\s+serumah|hidup\s+serumah|berkumpul)|tinggal\s+serumah|hidup\s+serumah/i, BUKAN_NAFKAH_ISTRI);
  const urus = cari(/(?:mengurus|mengatur|menyelenggarakan)\s+(?:urusan\s+|keperluan\s+)?rumah\s+tangga/i, BUKAN_NAFKAH_ISTRI);
  const lain = [];
  if (kemb && /Menghukum|agar|untuk|memerintahkan/i.test(kemb.k)) lain.push("kembali tinggal serumah dengan Penggugat di tempat kediaman bersama");
  if (urus && /Menghukum|agar|untuk|memerintahkan/i.test(urus.k)) lain.push("mengatur urusan rumah tangga sebaik-baiknya");
  if (lain.length) ragu("3706", lain.join(" dan "), (kemb || urus).k, "kelalaian-3706-lain", "Menurut gugatan; sesuaikan sebutan pihak.");

  // 3708 pemotongan langsung penghasilan
  const pot = cari(/pemotongan\s+(?:langsung\s+)?(?:atas\s+)?(?:gaji|penghasilan)/i);
  if (pot) {
    const m = /(?:pada|oleh|di)\s+([A-Z][^;,]{3,100})/.exec(pot.k.slice(pot.k.search(/pemotongan/i)));
    if (m) ragu("3708", m[1].trim(), pot.k, "kelalaian-3708-potong", "Instansi menurut gugatan.");
  }

  // 3709 sita jaminan
  const sita = cari(/sita\s+jaminan|conservatoir\s+beslag/i);
  if (sita) {
    const m = /(?:atas|berupa)\s+([^;]{8,200})/i.exec(sita.k.slice(sita.k.search(/sita\s+jaminan|conservatoir/i)));
    if (m) ragu("3709", m[1].replace(/[.\s]+$/, "").trim(), sita.k, "kelalaian-3709-sita", "Objek menurut gugatan; lengkapi nomor dan tanggal berita acara sita.");
  }

  // 3710 uang paksa
  const dwang = cari(/uang\s+paksa|dwangsom/i);
  if (dwang) {
    const nom = nominalPertama(dwang.k);
    if (nom) ragu("3710", rupiah(nom.nilai), dwang.k, "kelalaian-3710-dwangsom", "Menurut gugatan; uang paksa hanya atas kewajiban bukan pembayaran uang.");
  }
  return peta;
}

module.exports = { kunci: "kelalaian-kewajiban", jenisPerkaraId: [345], variabel, deteksi, KATEGORI };
