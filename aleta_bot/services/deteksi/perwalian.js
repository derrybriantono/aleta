"use strict";

/**
 * ============================================================================
 * DETEKSI PERWALIAN (jenis_perkara_id 354; juga "Lain-Lain" 369 yang isinya
 * perwalian/wali pengampu - lewat lainLain.js)
 * ============================================================================
 *
 * Blangko: derry_briantono/6 Perwalian (Kabul; Tolak Primer Kabul Subsider),
 * putusan_penetapan/(C3) 7, Perwalian, BAS 43-a Putus Perwalian Anak.
 *
 * Sumber: petitum SIPP (dibaca rute dari SIPP, HANYA SELECT) lalu posita.
 * Petitum lebih dulu untuk nama anak dan keperluan, sebab di sanalah pemohon
 * menyebut SIAPA yang dimohonkan perwaliannya; posita memuat SEMUA anak
 * (termasuk yang sudah dewasa - 7 anak, 1 dimohonkan, 9421/2026).
 *
 * Ukuran (13 Okt 2026, D:/aleta-dev/kerja/deteksi-y/ukur-y.js, sipp_donggala
 * + isian ABT server; angka dicatat apa adanya di UKUR_PERWALIAN di bawah).
 * Yang tidak dideteksi (tidak ada di posita/petitum): 6331 penghasilan,
 * 8131 alat bukti (berkas e-Court), 1282 (dihitung ABT dari 1230),
 * 5114/5115/5116/8513-8515/2025/2026 (data_sql ABT).
 */

const B = require("./bantuAnak");
const wilayah = require("./wilayah");

const UKUR_PERWALIAN = Object.freeze({
  // diisi dari keluaran ukur-y.js - lihat laporan commit
});

const variabel = Object.freeze([
  { kode: "5110", nama: "Nama anak yang dimohonkan perwalian", sumber: "petitum", blangko: ["putusan"] },
  { kode: "1025", nama: "Nama almarhum/almarhumah (orang tua anak)", sumber: "posita", blangko: ["putusan"] },
  { kode: "1230", nama: "Tanggal meninggal orang tua anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "0709", nama: "Pemohon dari sisi anak (ibu/bapak kandung)", sumber: "posita", blangko: ["putusan"] },
  { kode: "0712", nama: "Orang tua yang meninggal dari sisi anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "5197", nama: "Tanggal nikah orang tua anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "5105", nama: "Tempat nikah orang tua anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "5178", nama: "KUA tempat nikah orang tua anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "0007", nama: "Jumlah anak dari perkawinan", sumber: "posita", blangko: ["putusan"] },
  { kode: "8171", nama: "Keperluan perwalian", sumber: "petitum", blangko: ["putusan"] },
  { kode: "6331", nama: "Pekerjaan & penghasilan Pemohon", sumber: "sipp", blangko: ["putusan"] },
  { kode: "8131", nama: "Alat bukti perwalian anak", sumber: "berkas-ecourt", blangko: ["putusan", "bas"] },
]);

/** Potongan "wali dari/atas ... <nama-nama>" di petitum/posita. */
const POLA_WALI =
  /\b(?:(?:sebagai\s+)?wali\s+(?:(?:yang\s+sah\s+)?(?:atas|dari|bagi|terhadap|untuk)|pengampu\s+(?:atas|dari|bagi))|perwalian\s+terhadap)\s*:?\s+/gi;
// Titik koma TIDAK membatasi: daftar anak dipisah titik koma ("A, Umur 14 Tahun; B, Umur 12 Tahun;").
// Batasnya butir petitum berikutnya (kata kerja amar) atau keperluan ("untuk ...").
const BATAS_WALI =
  /\s(?:untuk|guna|khusus|dalam\s+rangka|agar|sehingga)\b|(?:;|\s)\s*(?:\d{1,2}\s*\.\s*)?(?:Menetapkan|Membebankan|Menyatakan|Memberi(?:kan)?|Memerintahkan|Mengabulkan|SUBSID\w*|PRIMAIR|PRIMER|Atau|Apabila|Biaya|Bahwa)\b/;

function namaAnakDariWali(teks) {
  const t = String(teks || "");
  POLA_WALI.lastIndex = 0;
  let m;
  while ((m = POLA_WALI.exec(t)) !== null) {
    let isi = t.slice(m.index + m[0].length);
    const b = isi.search(BATAS_WALI);
    if (b >= 0) isi = isi.slice(0, b);
    // Petitum yang menyebut "wali dari X" TANPA kata "anak" terukur keliru templat: X ternyata
    // orang tua anak (743/2018, 372/2020, 44/2021, 133/2021, 136/2021, 456/2020 - amar menyebut anaknya).
    const adaKataAnak = /^[^A-Z]{0,80}\banak\b/.test(isi) || /^\s*anak\b/i.test(isi);
    // "... anak pasangan suami isteri A dengan B bernama : X" - nama sesudah "bernama" yang TERAKHIR.
    const i = isi.search(/\b(?:be?r?nama|yakni|yaitu)\b\s*:?/i);
    if (i >= 0) isi = isi.slice(i).replace(/^\S+\s*:?\s*/, "");
    else isi = isi.replace(/^(?:(?:seorang|kedua|ketiga|keempat|\d+\s*(?:\([a-z ]+\))?)\s+)?(?:orang\s+)?(?:anak(?:-anak)?\s+)?(?:(?:kandung(?:nya)?|laki-laki|perempuan|Pemohon|yang|belum|dewasa|masih|di|bawah|umur)\s+)*/i, "");
    // "(Pemohon-nama) yang bernama" sudah terlewati; kurung nama pemohon di depan dibuang.
    const daftar = B.daftarNama(isi);
    if (daftar.length) return { daftar, adaKataAnak, kalimat: t.slice(m.index, m.index + m[0].length + isi.length + 20) };
  }
  return null;
}

/** "Menetapkan anak (yang) bernama X ... berada di bawah perwalian" (bentuk amar/petitum lain). */
function namaAnakBeradaDiBawah(teks) {
  const t = String(teks || "");
  const m = /anak(?:-anak)?\s+(?:yang\s+)?(?:masing-masing\s+)?be?r?nama\s*:?\s*/i.exec(t);
  if (!m) return null;
  let isi = t.slice(m.index + m[0].length);
  // Sampai butir berikutnya; "X, umur 17 Tahun, dibawah perwalian Pemohon (..); Y, ..." - tiap anak boleh berekor sendiri.
  const b = isi.search(/(?:;|\s)\s*(?:\d{1,2}\s*\.\s*)?(?:Membebankan|Memberi(?:kan)?|Menyatakan|Menetapkan|Memerintahkan|SUBSID\w*|Biaya)\b/);
  if (b >= 0) isi = isi.slice(0, b);
  if (!/(?:berada\s+)?di\s*bawah\s+perwalian/i.test(isi)) return null;
  // Tiap "di bawah perwalian <wali>" dibuang beserta sebutan walinya: "Pemohon ( X )" atau "X (Pemohon)".
  isi = isi
    .split(/,?\s*(?:berada\s+)?di\s*bawah\s+perwalian\s*/i)
    .map((bag, i) => (i === 0 ? bag : bag.replace(/^\s*(?:Pemohon\s*(?:\([^)]*\))?|[^;()]*\(\s*Pemohon\s*\)|\([^)]*\))\s*/i, "")))
    .join(" ; ");
  const daftar = B.daftarNama(isi);
  return daftar.length ? { daftar, adaKataAnak: true, kalimat: t.slice(m.index, m.index + m[0].length + isi.length).slice(0, 400) } : null;
}

/**
 * Anak yang dimohonkan menurut POSITA - hanya bentuk yang menyebutnya tegas:
 *   kepala permohonan "mengajukan Perwalian terhadap anak : X, Umur 18 Tahun ,Agama Islam, ... Y, Umur 14 Tahun ..."
 *   "mengajukan hak perwalian terhadap anak bernama: X dengan alasan"
 *   "ditetapkan sebagai wali atas anak Pemohon (..) yang bernama X, Usia 9 tahun"
 * Daftar anak dari kalimat "dikaruniai N orang anak" TIDAK dipakai: memuat anak yang sudah dewasa.
 */
function namaAnakPosita(positaPolos) {
  const t = String(positaPolos || "");
  const kepala = /perwalian\s+terhadap\s+anak\s*(?:be?r?nama)?\s*:?\s*/i.exec(t);
  if (kepala) {
    let isi = t.slice(kepala.index + kepala[0].length);
    const b = isi.search(/\b(?:Adapun|dengan\s+alasan|Bahwa)\b/);
    if (b >= 0) isi = isi.slice(0, b);
    const daftar = [];
    // Tanpa bendera i: [A-Z] harus huruf besar sungguhan, kalau tidak "tahun dan X" ikut terbaca nama.
    const re = /((?:[A-Z][A-Za-z.'’-]*\s+){0,6}?(?:bin|binti|Bin|Binti|BIN|BINTI|alias)\s+(?:[A-Z][A-Za-z.'’-]*\s*){1,5}?)\s*,?\s*(?:[Uu]mur|UMUR|[Uu]sia|USIA|[Ll]ahir|NIK)\b/g;
    let m;
    while ((m = re.exec(isi)) !== null) {
      // "... Kabupaten Donggala Suci Rahmawati binti Nasir" - sisa alamat anak sebelumnya dibuang.
      const bersih = m[1].replace(/^[\s\S]*\b(?:Kabupaten|Kota|Kecamatan|Desa|Kelurahan|Provinsi)\s+[A-Z][a-z]+\s+(?=[A-Z])/, "");
      const nama = require("../abtUsulanService").namaDiAwal(bersih.trim());
      if (nama && !daftar.some((d) => B.sama(d.nama, nama))) daftar.push({ nama, umur: null });
    }
    if (!daftar.length) daftar.push(...B.daftarNama(isi.split(/,\s*(?:Umur|Usia)\b/i)[0]));
    if (daftar.length) return { daftar, adaKataAnak: true, kalimat: t.slice(kepala.index, kepala.index + kepala[0].length + isi.length).slice(0, 400) };
  }
  const wali = /\bwali\s+(?:atas|dari|bagi|terhadap)\s+(?:seorang\s+|kedua\s+|ketiga\s+)?anak\b[^;]{0,120}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (wali) {
    let isi = t.slice(wali.index + wali[0].length);
    const b = isi.search(/;|\s(?:untuk|guna|sehingga|maka|karena)\b|\bBahwa\b/);
    if (b >= 0) isi = isi.slice(0, b);
    const daftar = B.daftarNama(isi);
    if (daftar.length) return { daftar, adaKataAnak: true, kalimat: t.slice(wali.index, wali.index + wali[0].length + isi.length).slice(0, 400) };
  }
  return null;
}

/** Daftar nama tanpa nama pihak sendiri (41/2025: posita menyebut nama Pemohon sebagai anak). */
function tanpaPihak(hasil, namaPihak) {
  if (!hasil) return null;
  const pihak = (namaPihak || []).filter(Boolean);
  const daftar = hasil.daftar.filter((d) => !pihak.some((p) => B.sama(p, d.nama)));
  return daftar.length ? { ...hasil, daftar } : null;
}

function samaDaftar(a, b) {
  return a.length === b.length && a.every((x) => b.some((y) => B.sama(x.nama, y.nama)));
}

/**
 * 5110 - anak yang dimohonkan perwalian.
 *   petitum "wali dari (seorang) anak ... X" / "anak bernama X berada di bawah perwalian"  -> cukup
 *   petitum "wali dari X" tanpa kata anak (templat keliru) -> posita bila ada, ragu
 *   petitum dan posita sama-sama menyebut anak tetapi berbeda -> petitum, ragu
 */
function pilihAnak(petitum, positaPolos, namaPihak) {
  const pet = tanpaPihak(namaAnakDariWali(petitum) || namaAnakBeradaDiBawah(petitum), namaPihak);
  const pos = tanpaPihak(namaAnakPosita(positaPolos), namaPihak);
  const posAnak = pos && pos.adaKataAnak ? pos : null;
  if (pet && pet.adaKataAnak) {
    if (posAnak && !samaDaftar(pet.daftar, posAnak.daftar)) return { ...pet, yakin: "ragu", asal: "petitum" };
    return { ...pet, yakin: "cukup", asal: "petitum" };
  }
  if (posAnak) return { ...posAnak, yakin: pet ? "ragu" : "cukup", asal: "posita" };
  if (pet) return { ...pet, yakin: "ragu", asal: "petitum" };
  return null;
}

/** "meninggal" sebagai peristiwa - bukan "meninggalkan gaji/ahli waris" (11/2022). */
const WAFAT = /meninggal(?!kan)(?:\s+dunia)?/i;

/**
 * Tanggal wafat seseorang yang namanya mulai di `letak` dalam kalimat `k`:
 * sesudah kata "meninggal" pada klausa yang sama ("... telah meninggal dunia pada tanggal D"),
 * atau sebelum namanya ("pada tanggal D Suami pemohon X telah meninggal" - 21/2022).
 * Klausa berhenti pada "dan Alm"/"dan almarhumah" berikutnya (57/2021: dua orang wafat, dua tanggal).
 */
function tanggalWafat(k, letak) {
  const sesudah = k.slice(letak);
  const ujung = sesudah.slice(1).search(/\bdan\s+(?:Alm|Almh|almarhum)/i);
  const klausa = ujung >= 0 ? sesudah.slice(0, ujung + 1) : sesudah;
  const w = klausa.search(WAFAT);
  if (w >= 0) {
    const t = B.tanggalPertama(klausa.slice(w).slice(0, 80));
    if (t) return t;
  }
  const sebelum = k.slice(Math.max(0, letak - 60), letak);
  return /pada\s+tanggal\s+\d{1,2}\s+\w+\s+\d{4}\s*,?\s*$/i.test(sebelum) ? B.tanggalPertama(sebelum) : "";
}

/**
 * Orang tua anak yang meninggal: { nama, kalimat, peran ("suami"/"istri" Pemohon, "" bila bukan
 * pasangan Pemohon), tanggal, jumlah (banyaknya orang berbeda yang disebut wafat di posita) }.
 * Bentuk (posita perwalian PA Donggala 2018-2026):
 *   a. "Alm. X (Suami Pemohon) telah meninggal dunia pada tanggal D"
 *   b. "suami/istri Pemohon (yang bernama|atas nama) X telah meninggal dunia"
 *   c. "Pemohon adalah istri sah dari Alm. X"
 */
function almarhum(daftarKalimat) {
  const lu = require("../abtUsulanService");
  const temuan = [];
  const catat = (nama, k, peran, letak) => {
    if (!nama || nama.length < 3) return;
    const ada = temuan.find((x) => B.sama(x.nama, nama));
    if (ada) {
      if (!ada.peran && peran) ada.peran = peran;
      // 197/2025: "istri sah dari Alm. X" (tanpa tanggal) lalu "suami Pemohon X telah meninggal pada tanggal D".
      if (!ada.tanggal) {
        const t = tanggalWafat(k, letak);
        if (t) {
          ada.tanggal = t;
          ada.kalimat = k;
        }
      }
      return;
    }
    temuan.push({ nama, kalimat: k, peran, tanggal: tanggalWafat(k, letak) });
  };
  for (const k of daftarKalimat) {
    // a. sebutan almarhum di depan nama; nama harus disusul (kurung peran) / keterangan pendek lalu "meninggal".
    const reA = /\b(?:Alm(?:arhum(?:ah)?)?|Almh)\.?\s+(?=[A-Z])/gi;
    let m;
    while ((m = reA.exec(k)) !== null) {
      const sisa = k.slice(m.index + m[0].length);
      const nama = lu.namaDiAwal(sisa);
      if (!nama) continue;
      const ekor = sisa.slice(nama.length);
      const r = /^\s*(?:\(\s*([^)]{0,40})\)\s*)?[^.;()]{0,45}?\btelah\s+meninggal(?!kan)|^\s*(?:\(\s*([^)]{0,40})\)\s*)?\s*meninggal(?!kan)/i.exec(ekor);
      if (!r) continue;
      const kurung = r[1] || r[2] || "";
      const peran = /(?:mantan\s+)?suami\s+Pemohon/i.test(kurung) ? "suami" : /(?:isteri|istri)\s+Pemohon/i.test(kurung) ? "istri" : "";
      catat(nama, k, peran, m.index);
    }
    // b. "suami/istri Pemohon (yang bernama|atas nama) X telah meninggal"
    const reB = /\b((?:mantan\s+)?(?:suami|isteri|istri))\s+Pemohon\s+(?:yang\s+bernama\s+|bernama\s+|atas\s+nama\s+)?(?:Alm(?:arhum(?:ah)?)?\.?\s+|Almh\.?\s+)?(?=[A-Z])/gi;
    while ((m = reB.exec(k)) !== null) {
      const sisa = k.slice(m.index + m[0].length);
      const nama = lu.namaDiAwal(sisa);
      if (!nama) continue;
      if (!/^\s*(?:\([^)]{0,40}\)\s*)?(?:telah\s+)?meninggal(?!kan)/i.test(sisa.slice(nama.length))) continue;
      catat(nama, k, /suami/i.test(m[1]) ? "suami" : "istri", m.index);
    }
    // c. "Pemohon adalah istri sah dari Alm. X"
    const c = /Pemohon\s+adalah\s+(suami|isteri|istri)\s+(?:sah\s+)?dari\s+(?:Alm(?:arhum(?:ah)?)?|Almh)\.?\s+(?=[A-Z])/i.exec(k);
    if (c) catat(lu.namaDiAwal(k.slice(c.index + c[0].length)), k, /suami/i.test(c[1]) ? "istri" : "suami", c.index);
  }
  if (!temuan.length) return null;
  // Yang dipakai: pasangan Pemohon bila ada, selain itu yang pertama disebut.
  const pilih = temuan.find((x) => x.peran) || temuan[0];
  return { ...pilih, jumlah: temuan.length };
}

/** Nama pasangan Pemohon dari kalimat perkawinan: "Pemohon dan Suami Pemohon yang bernama X telah melangsungkan perkawinan". */
function pasanganDariNikah(daftarKalimat) {
  for (const k of daftarKalimat) {
    const m = /Pemohon\s+dan\s+(suami|isteri|istri)\s+Pemohon\s+(?:yang\s+)?bernama\s+([A-Z][\s\S]{2,80}?)\s+(?:telah\s+)?(?:melangsungkan|menikah)/i.exec(k);
    if (m) return { nama: require("../abtUsulanService").namaDiAwal(m[2]), peran: /suami/i.test(m[1]) ? "suami" : "istri", kalimat: k };
  }
  return null;
}

/** Kalimat perkawinan orang tua anak + tanggal & tempatnya. */
function nikahOrangTua(daftarKalimat) {
  const k =
    daftarKalimat.find((x) => /(?:melangsungkan|telah\s+melaksanakan)\s+(?:perkawinan|pernikahan)|\btelah\s+menikah\b/i.test(x) && /\d{4}/.test(x)) ||
    daftarKalimat.find((x) => /Akta\s+Nikah/i.test(x) && /Kantor\s+Urusan\s+Agama|KUA/i.test(x));
  if (!k) return null;
  const tanggal = B.tanggalPertama(k);
  const kuaPotong = /(?:Kantor\s+Urusan\s+Agama|KUA)\b[\s\S]*$/i.exec(k);
  const komp = wilayah.komponenWilayah(kuaPotong ? kuaPotong[0] : k);
  return { kalimat: k, tanggal, komp };
}

/** Keperluan perwalian: "untuk (pemberian izin (untuk)?)? X" di petitum / "ingin mengurus X maka" di posita. */
function keperluan(petitum, positaKalimat) {
  const sumberPetitum = String(petitum || "");
  const p = /\bwali\b[^;]{0,250}?\s(?:untuk|guna|khusus\s+(?:untuk|dalam)?)\s+(?:keperluan\s+|kepentingan\s+)?(?:pemberian\s+izin\s+(?:untuk\s+)?)?([a-z][^;]{5,220}?)(?=\s*;|\s+Membebankan|\s+SUBSID|\s+\d\.\s|$)/i.exec(sumberPetitum);
  if (p) return { nilai: rapikanKeperluan(p[1]), kalimat: p[0], asal: "petitum" };
  for (const k of positaKalimat) {
    const m = /\b(?:ingin|hendak|bermaksud)\s+(mengurus|melakukan|mencairkan|menjual|membalik\s+nama|mengajukan)\s+([^;]{5,200}?)\s+(?:maka|sehingga|namun)\b/i.exec(k);
    if (m) return { nilai: rapikanKeperluan(`${m[1]} ${m[2]}`), kalimat: k, asal: "posita" };
  }
  return null;
}

/** "mengurus X" -> "pengurusan X" (blangko: "bertindak hukum dalam #8171# atas nama anak"). */
function rapikanKeperluan(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s,.;:]+$/, "")
    .replace(/^mengurus\b/i, "pengurusan")
    .replace(/^mencairkan\b/i, "pencairan")
    .replace(/^menjual\b/i, "penjualan")
    .replace(/^membalik\s+nama\b/i, "balik nama")
    .replace(/^mengajukan\b/i, "pengajuan")
    .replace(/^melakukan\s+/i, "");
}

/**
 * @param {string} posita
 * @param {{petitum?: string}} opsi
 */
function deteksi(posita, opsi = {}) {
  const kal = B.kalimat(posita);
  const petitum = B.polos(opsi.petitum || "");
  const peta = {};

  // 5110 - nama anak yang dimohonkan: petitum dan posita dibandingkan (lihat pilihAnak).
  const anak = pilihAnak(petitum, B.polos(posita), opsi.namaPihak);
  if (anak) {
    B.taruh(peta, "5110", B.fakta(B.gabungDan(anak.daftar.map((d) => d.nama)), anak.kalimat, anak.yakin, `perwalian-5110-${anak.asal}`, anak.asal));
  }

  // 1025 / 0709 / 0712 / 1230 - orang tua yang meninggal.
  const alm = almarhum(kal);
  const pasangan = pasanganDariNikah(kal);
  if (alm) {
    // Nama terlengkap: bila kalimat nikah menyebut nama yang sama ditambah "bin ...", itu yang dipakai.
    const nama = pasangan && pasangan.nama && B.sama(pasangan.nama, alm.nama) && pasangan.nama.length > alm.nama.length ? pasangan.nama : alm.nama;
    const peran = alm.peran || (pasangan && B.sama(pasangan.nama, alm.nama) ? pasangan.peran : "");
    // "cukup" hanya bila yang wafat PASANGAN Pemohon dan hanya satu orang yang disebut wafat: Pemohon
    // orang tua yang masih hidup, blangko "Perwalian Anak oleh ortu kandung" berlaku. Selebihnya (kedua
    // orang tua wafat, Pemohon paman/bibi/kakek) "ragu" - blangkonya pun tidak cocok.
    const yakin = peran && alm.jumlah === 1 ? "cukup" : "ragu";
    B.taruh(peta, "1025", B.fakta(nama, alm.kalimat, yakin, "perwalian-1025-almarhum"));
    B.taruh(peta, "1230", B.fakta(alm.tanggal, alm.kalimat, yakin, "perwalian-1230-wafat"));
    // Peran hanya bila anak itu anak Pemohon sendiri (bukan keponakan/cucu).
    const anakSendiri = /\banak\s+(?:kandung\s+)?Pemohon\b|dari\s+perkawinan\s+tersebut|dikaruni/i.test(B.polos(posita)) && !/\b(?:keponakan|cucu|adik)\b/i.test(B.polos(posita).slice(0, 600));
    if (peran && anakSendiri) {
      B.taruh(peta, "0709", B.fakta(peran === "suami" ? "ibu kandung" : "bapak kandung", alm.kalimat, yakin, "perwalian-0709-peran"));
      B.taruh(peta, "0712", B.fakta(peran === "suami" ? "bapak kandung" : "ibu kandung", alm.kalimat, yakin, "perwalian-0712-peran"));
    }
  }

  // 5197 / 5105 / 5178 - perkawinan orang tua anak.
  const nikah = nikahOrangTua(kal);
  if (nikah) {
    B.taruh(peta, "5197", B.fakta(nikah.tanggal, nikah.kalimat, "ragu", "perwalian-5197-nikah"));
    const k = nikah.komp;
    if (k.kecamatan) {
      const tempat = [k.desa, `Kecamatan ${k.kecamatan}`, k.kabupaten, k.provinsi].filter(Boolean).join(", ");
      B.taruh(peta, "5105", B.fakta(tempat, nikah.kalimat, "ragu", "perwalian-5105-nikah"));
      if (/Kantor\s+Urusan\s+Agama|\bKUA\b/i.test(nikah.kalimat)) {
        const kua = [`Kantor Urusan Agama Kecamatan ${k.kecamatan}`, k.kabupaten, k.provinsi].filter(Boolean).join(", ");
        B.taruh(peta, "5178", B.fakta(kua, nikah.kalimat, "ragu", "perwalian-5178-nikah"));
      }
    }
  }

  // 0007 - "4 (empat) orang anak".
  const kAnak = kal.find((k) => /dikaruni/i.test(k)) || "";
  B.taruh(peta, "0007", B.fakta(B.jumlahAnak(kAnak), kAnak, "ragu", "perwalian-0007-jumlah"));

  // 8171 - keperluan.
  const perlu = keperluan(petitum, kal);
  if (perlu) B.taruh(peta, "8171", B.fakta(perlu.nilai, perlu.kalimat, "ragu", `perwalian-8171-${perlu.asal}`, perlu.asal));

  return peta;
}

module.exports = {
  kunci: "perwalian",
  jenisPerkaraId: [354],
  variabel,
  deteksi,
  UKUR_PERWALIAN,
  // untuk uji & modul lain
  namaAnakDariWali,
  namaAnakBeradaDiBawah,
  namaAnakPosita,
  almarhum,
};
