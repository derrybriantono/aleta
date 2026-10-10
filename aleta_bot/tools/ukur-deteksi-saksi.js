"use strict";

/**
 * ============================================================================
 * UKUR DETEKSI IDENTITAS & HUBUNGAN SAKSI (P5) ATAS DATA NYATA - 10 Okt 2026
 * ============================================================================
 *
 * HANYA MEMBACA salinan lokal SIPP (sipp_donggala) dan ABT (aps_badilag).
 * Tidak ada satu pun tulisan ke basis data.
 *
 *   A. HUBUNGAN DARI JAWABAN KENAL. Jawaban saksi di abt_keterangan_saksi
 *      (pertanyaan "kenal") dikenali lewat pola jangkar + istilah, lalu
 *      dibandingkan dengan kolom Keterangan saksi SIPP (perkara_pihak5.
 *      keterangan) yang diisi petugas TERPISAH di blangko saksi SIPP. Dua
 *      tulisan bebas oleh orang/waktu berbeda - kesepakatan keduanya adalah
 *      ukuran ketepatan. Setara = sama persis atau salah satunya payung
 *      ("Saudara Kandung" vs "Kakak Kandung"). Per pola:
 *        n            pasangan di mana pola menyala dan pembandingnya terbaca
 *        tepat        setara dengan pembanding
 *        salahTangkap tidak setara
 *      Peran dua arah: istilah yang menyala pada JAWABAN dibandingkan dengan
 *      label SIPP, istilah yang menyala pada LABEL dibandingkan dengan jawaban.
 *   B. GOLONGAN (keluarga / dekat / lain) - dasar peringatan Pasal 76.
 *   C. BARIS IDENTITAS. Tiap saksi SIPP (nama, umur get_umur, agama,
 *      pendidikan kode, pekerjaan, alamat, keterangan) dicetak dengan ragam
 *      pembuka NYATA dari blangko ABT satker (RAGAM_PEMBUKA, dikumpulkan dari
 *      754 tempat di _blangko_abt), lalu diurai kembali. Nilainya data nyata,
 *      bentuk kalimatnya bentuk nyata. Ditambah baris identitas dari putusan
 *      contoh (--putusan <folder .txt>) bila ada.
 *   D. SALAH TANGKAP DI KALIMAT BUKAN IDENTITAS: pola sumpah / di bawah umur
 *      dijalankan atas seluruh JAWABAN saksi (yang bukan baris identitas) -
 *      tiap kecocokan dihitung salah tangkap.
 *   E. UMUR saksi saat dicatat (get_umur): di bawah 15, 15-17, kosong.
 *
 *   node tools/ukur-deteksi-saksi.js [--sipp sipp_donggala] [--abt aps_badilag]
 *        [--putusan D:/aleta-dev/kerja/abt-alasan-cdeh/contoh] [--json hasil.json]
 *        [--contoh ../manajemen_surat/src/test/fixtures/deteksi-saksi-p5p6.json]
 *
 * MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD bila bukan root lokal.
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const d = require("../services/deteksiSaksiService");
const kamus = require("../services/kamusDeteksi");

function argumen(nama, bawaan) {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}
const DB_SIPP = argumen("sipp", "sipp_donggala");
const DB_ABT = argumen("abt", "aps_badilag");
const PUTUSAN = argumen("putusan", "");
const KELUAR_JSON = argumen("json", "");
const CONTOH = argumen("contoh", "");
if (!/^\w+$/.test(DB_SIPP) || !/^\w+$/.test(DB_ABT)) throw new Error("Nama basis data tidak sah.");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  connectionLimit: 2,
});
const kueri = (sql, nilai = []) =>
  new Promise((ok, gagal) => pool.query(sql, nilai, (e, r) => (e ? gagal(e) : ok(r))));

/**
 * Ragam pembuka keterangan saksi di blangko ABT satker (tanda # = variabel),
 * urut menurut banyaknya tempat. N nama, U umur, A agama, D pendidikan,
 * K pekerjaan, L alamat, H hubungan (#1241#).
 */
const RAGAM_PEMBUKA = [
  "1. Saksi I, {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, saksi mengaku sebagai {H}, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:",
  "1. {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, saksi mengaku sebagai {H}, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:",
  "1. {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, di bawah sumpah memberikan keterangan yang pada pokoknya sebagai berikut;",
  "Saksi 1, {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, di bawah sumpah, memberikan keterangan yang pada pokoknya sebagai berikut :",
  "{N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, di bawah sumpahnya memberikan keterangan pada pokoknya sebagai berikut:",
  "Saksi 1, {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, Kabupaten Morowali, Provinsi Sulawesi Tengah, di bawah sumpah memberikan keterangan yang pada pokoknya sebagai berikut:",
  "Saksi 1 {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, di bawah sumpah, memberikan keterangan sebagai berikut :",
  "Saksi 1, {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, memberikan keterangan di bawah sumpah, pada pokoknya sebagai berikut :",
  "1. Saksi pertama: {N} ({H}) , umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, di bawah sumpahnya telah memberikan keterangan yang pada pokoknya sebagai berikut:",
  "Saksi II, {N}, umur {U} tahun, agama {A}, pendidikan {D}, pekerjaan {K}, bertempat tinggal di {L}, saksi mengaku sebagai {H}, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:",
];

const baku = (s) =>
  String(s === null || s === undefined ? "" : s)
    .replace(/\s+/g, " ")
    .replace(/[\s;,.]+$/, "")
    .trim()
    .toLowerCase();

function tambahStat(peta, kode, tepat) {
  const s = peta.get(kode) || { n: 0, tepat: 0, salahTangkap: 0 };
  s.n += 1;
  if (tepat) s.tepat += 1;
  else s.salahTangkap += 1;
  peta.set(kode, s);
}
const persen = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

/**
 * Contoh untuk berkas uji: nama orang tidak ikut. Sesudah "bernama" disamarkan,
 * dan kata berhuruf besar yang bukan kosakata sebutan/hubungan juga.
 */
const KOSAKATA = new Set(
  ("penggugat tergugat pemohon termohon para saya ya kandung sepupu adik ibu tetangga kakak keponakan ipar saudara paman " +
    "teman tante keluarga ayah anak kali satu dua tiga bapak menantu tiri mertua kemenakan ponakan satukali ix orang tua " +
    "kemanakan kerabat rekan cucu seayah seibu orangtua kantor kerja nenek kakek bibi om sahabat kenal karena adalah i ii iii")
    .split(" ")
);
function samarkan(teks) {
  return String(teks || "")
    .replace(/\bbernama\s+[A-Za-z'’.\- ]+/gi, "bernama NAMA")
    .replace(/\b[A-Z][a-z]+\b/g, (w) => (KOSAKATA.has(w.toLowerCase()) ? w : "NAMA"));
}

async function ukurHubungan() {
  const baris = await kueri(
    `SELECT k.saksi_id, k.urutan_pertanyaan AS urut, k.jawaban, p.keterangan
       FROM ${DB_ABT}.abt_keterangan_saksi k
       JOIN ${DB_SIPP}.perkara_pihak5 p ON p.id = k.saksi_id AND p.perkara_id = k.perkara_id
      WHERE k.pertanyaan REGEXP 'kenal'
      ORDER BY k.saksi_id, k.urutan_pertanyaan`
  );
  // Per saksi: jawaban kenal pertama yang berhubungan.
  const perSaksi = new Map();
  for (const b of baris) {
    const s = perSaksi.get(b.saksi_id) || { keterangan: b.keterangan || "", jawab: [] };
    s.jawab.push(String(b.jawaban || ""));
    perSaksi.set(b.saksi_id, s);
  }
  const perPola = new Map();
  const perJangkar = new Map();
  const perGolongan = new Map();
  const perPolaGolongan = new Map();
  const salahContoh = [];
  const contohPasangan = [];
  let saksi = 0;
  let labelTerisi = 0;
  let labelTerbaca = 0;
  let jawabTerbaca = 0;
  let keduanya = 0;
  let setara = 0;
  let persis = 0;
  let golonganSama = 0;
  for (const [, s] of perSaksi) {
    saksi += 1;
    const lab = String(s.keterangan || "").trim();
    const dLab = lab ? d.deteksiHubungan(lab, { bentuk: "label" }) : null;
    if (lab) labelTerisi += 1;
    if (dLab) labelTerbaca += 1;
    let dJaw = null;
    let jawabDipakai = "";
    for (const j of s.jawab) {
      dJaw = d.deteksiHubungan(j, { bentuk: "kalimat" });
      if (dJaw) {
        jawabDipakai = j;
        break;
      }
    }
    if (dJaw) jawabTerbaca += 1;
    if (!dJaw || !dLab) continue;
    keduanya += 1;
    const ok = d.hubunganSetara(dJaw.kunci, dLab.kunci);
    if (ok) setara += 1;
    if (dJaw.kunci === dLab.kunci) persis += 1;
    // Peran kalimat: istilah jawaban vs label. Peran label: istilah label vs jawaban.
    tambahStat(perPola, `${dJaw.kode}|kalimat`, ok);
    tambahStat(perPola, `${dLab.kode}|label`, ok);
    tambahStat(perJangkar, dJaw.jangkar, ok);
    const gSama = dJaw.golongan === dLab.golongan;
    if (gSama) golonganSama += 1;
    tambahStat(perGolongan, dJaw.golongan, gSama);
    // Golongan per istilah (dua arah) - dasar `ukur.golongan` di benih.
    tambahStat(perPolaGolongan, dJaw.kode, gSama);
    tambahStat(perPolaGolongan, dLab.kode, gSama);
    if (!ok && salahContoh.length < 40) salahContoh.push({ jawaban: jawabDipakai.slice(0, 160), label: lab, dariJawaban: dJaw.kunci, dariLabel: dLab.kunci });
    // Sampel TIDAK berat sebelah: tiap pasangan kelima (urut saksi_id), apa pun hasilnya.
    if (contohPasangan.length < 400 && keduanya % 5 === 1) {
      contohPasangan.push({
        jawaban: samarkan(jawabDipakai).slice(0, 200),
        label: lab,
      });
    }
  }
  return {
    saksi,
    labelTerisi,
    labelTerbaca,
    jawabTerbaca,
    keduanya,
    setara,
    persis,
    golonganSama,
    perPola: Object.fromEntries(perPola),
    perJangkar: Object.fromEntries(perJangkar),
    perGolongan: Object.fromEntries(perGolongan),
    perPolaGolongan: Object.fromEntries(perPolaGolongan),
    salahContoh,
    contohPasangan,
  };
}

async function ukurIdentitas() {
  const baris = await kueri(
    `SELECT p5.id, p5.nama, p5.alamat, p5.keterangan, p5.diinput_tanggal,
            p.tanggal_lahir, a.nama AS agama, tp.kode AS pendidikan, p.pekerjaan
       FROM ${DB_SIPP}.perkara_pihak5 p5
       LEFT JOIN ${DB_SIPP}.pihak p ON p.id = p5.pihak_id
       LEFT JOIN ${DB_SIPP}.agama a ON a.id = p.agama_id
       LEFT JOIN ${DB_SIPP}.tingkat_pendidikan tp ON tp.id = p.pendidikan_id
      WHERE p5.nama IS NOT NULL AND p5.nama <> ''`
  );
  const perPola = new Map();
  const salahContoh = [];
  const umur = { bawah15: 0, r15_17: 0, kosong: 0, dewasa: 0 };
  let n = 0;
  for (const b of baris) {
    const u = d.umurPada(b.tanggal_lahir, b.diinput_tanggal);
    if (u === null) umur.kosong += 1;
    else if (u < 15) umur.bawah15 += 1;
    else if (u < 18) umur.r15_17 += 1;
    else umur.dewasa += 1;
    const harap = {
      nama: String(b.nama || "").trim(),
      umur: u === null ? "" : String(u),
      agama: b.agama || "",
      pendidikan: b.pendidikan || "",
      pekerjaan: String(b.pekerjaan || "").replace(/\s+/g, " ").trim(),
      alamat: String(b.alamat || "").replace(/\s+/g, " ").trim(),
      hubungan: String(b.keterangan || "").replace(/\s+/g, " ").trim(),
    };
    const ragam = RAGAM_PEMBUKA[Number(b.id) % RAGAM_PEMBUKA.length];
    const baris1 = ragam
      .replace("{N}", harap.nama)
      .replace("{U}", harap.umur)
      .replace("{A}", harap.agama)
      .replace("{D}", harap.pendidikan)
      .replace("{K}", harap.pekerjaan)
      .replace("{L}", harap.alamat)
      .replace("{H}", harap.hubungan);
    const hasil = d.deteksiIdentitas(baris1);
    n += 1;
    for (const medan of ["nama", "umur", "agama", "pendidikan", "pekerjaan", "alamat"]) {
      const kode = hasil.kode[medan];
      if (!kode) continue;
      const dapat = medan === "umur" ? String(hasil.umur) : hasil[medan];
      // Alamat ragam "Kabupaten Morowali, Provinsi ..." menempel di blangko - bagian dari alamat cetakan.
      const harapCetak = medan === "alamat" && /Kabupaten Morowali/.test(ragam) ? `${harap.alamat}, Kabupaten Morowali, Provinsi Sulawesi Tengah` : harap[medan];
      // Alamat SIPP yang berakhir ";" tercetak "...Sigi;, Kabupaten Morowali" - pengurai berhenti di ";"
      // dan memulangkan alamat SIPP itu sendiri: itu benar, bukan salah tangkap.
      const ok = baku(dapat) === baku(harapCetak) || (medan === "alamat" && baku(dapat) === baku(harap.alamat));
      tambahStat(perPola, kode, ok);
      if (!ok && salahContoh.length < 30) salahContoh.push({ medan, dapat, harap: harapCetak, ragam: RAGAM_PEMBUKA.indexOf(ragam) });
    }
    if (hasil.kode.hubungan) {
      tambahStat(perPola, hasil.kode.hubungan, baku(hasil.hubungan.teks) === baku(harap.hubungan));
    }
    if (hasil.kode.disumpah) tambahStat(perPola, hasil.kode.disumpah, hasil.disumpah === true);
  }
  return { n, perPola: Object.fromEntries(perPola), salahContoh, umur };
}

/** Baris identitas dari putusan contoh (teks .txt) - n kecil, dilaporkan terpisah. */
function ukurPutusanContoh(folder) {
  if (!folder || !fs.existsSync(folder)) return null;
  const lihat = new Set();
  const baris = [];
  for (const n of fs.readdirSync(folder).filter((x) => x.endsWith(".txt"))) {
    for (const l of fs.readFileSync(path.join(folder, n), "utf8").split(/\r?\n/)) {
      if (/umur\s+\d+\s+tahun,\s*agama/i.test(l) && /sumpah/i.test(l) && !lihat.has(l.trim())) {
        lihat.add(l.trim());
        baris.push(l);
      }
    }
  }
  const terbaca = { nama: 0, umur: 0, agama: 0, pendidikan: 0, pekerjaan: 0, alamat: 0, hubungan: 0, disumpah: 0 };
  const contoh = [];
  for (const l of baris) {
    const h = d.deteksiIdentitas(l);
    for (const k of Object.keys(terbaca)) if (h.kode[k]) terbaca[k] += 1;
    if (contoh.length < 6) contoh.push({ nama: h.nama, umur: h.umur, alamat: h.alamat, hubungan: h.hubungan && h.hubungan.teks, kunci: h.hubungan && h.hubungan.kunci });
  }
  return { baris: baris.length, terbaca, contoh };
}

/** Pola identitas yang tidak boleh menyala di jawaban saksi biasa. */
async function ukurSalahTangkapJawaban() {
  const baris = await kueri(`SELECT jawaban FROM ${DB_ABT}.abt_keterangan_saksi WHERE jawaban IS NOT NULL AND jawaban <> ''`);
  const pola = kamus.polaKelompok("saksi-identitas").filter((p) => ["idn-sumpah-ya", "idn-sumpah-tidak", "idn-bawah-umur-kata", "idn-nama", "idn-pekerjaan", "idn-agama", "idn-pendidikan"].includes(p.kode));
  const hitung = {};
  const contoh = {};
  for (const p of pola) {
    hitung[p.kode] = 0;
    contoh[p.kode] = [];
  }
  for (const b of baris) {
    const t = String(b.jawaban);
    for (const p of pola) {
      if (p.re.test(t)) {
        hitung[p.kode] += 1;
        if (contoh[p.kode].length < 4) contoh[p.kode].push(t.replace(/\s+/g, " ").slice(0, 160));
      }
    }
  }
  return { jawaban: baris.length, kecocokan: hitung, contoh };
}

async function utama() {
  const mulai = Date.now();
  const hubungan = await ukurHubungan();
  const identitas = await ukurIdentitas();
  const jawaban = await ukurSalahTangkapJawaban();
  const putusan = ukurPutusanContoh(PUTUSAN);
  pool.end();

  const h = hubungan;
  console.log("=== A. HUBUNGAN dari jawaban kenal vs Keterangan saksi SIPP ===");
  console.log(`saksi berjawaban kenal ${h.saksi}; label SIPP terisi ${h.labelTerisi}, terbaca ${h.labelTerbaca} (${persen(h.labelTerbaca, h.labelTerisi)})`);
  console.log(`jawaban menyebut hubungan ${h.jawabTerbaca} (${persen(h.jawabTerbaca, h.saksi)}); keduanya terbaca ${h.keduanya}`);
  console.log(`SETARA ${h.setara}/${h.keduanya} = ${persen(h.setara, h.keduanya)}; persis ${persen(h.persis, h.keduanya)}; golongan sama ${persen(h.golonganSama, h.keduanya)}`);
  const urut = Object.entries(h.perPola).sort((a, b) => b[1].n - a[1].n);
  for (const [k, s] of urut) console.log(`  ${k.padEnd(34)} n=${String(s.n).padStart(5)} tepat=${String(s.tepat).padStart(5)} salah=${String(s.salahTangkap).padStart(4)} ${persen(s.tepat, s.n)}`);
  console.log("  jangkar:", JSON.stringify(h.perJangkar));
  console.log("  golongan (dari jawaban):", JSON.stringify(h.perGolongan));
  console.log("\n=== C. BARIS IDENTITAS (ragam pembuka nyata x data saksi SIPP) ===");
  console.log(`saksi ${identitas.n}; umur ${JSON.stringify(identitas.umur)}`);
  for (const [k, s] of Object.entries(identitas.perPola)) console.log(`  ${k.padEnd(24)} n=${s.n} tepat=${s.tepat} salah=${s.salahTangkap} ${persen(s.tepat, s.n)}`);
  if (putusan) console.log("\nputusan contoh:", JSON.stringify(putusan));
  console.log("\n=== D. SALAH TANGKAP di jawaban biasa ===");
  console.log(JSON.stringify(jawaban.kecocokan), `dari ${jawaban.jawaban} jawaban`);
  console.log(`\nselesai ${((Date.now() - mulai) / 1000).toFixed(1)} dtk`);

  if (KELUAR_JSON) fs.writeFileSync(KELUAR_JSON, JSON.stringify({ tanggal: new Date().toISOString(), DB_SIPP, DB_ABT, hubungan, identitas, jawaban, putusan }, null, 2));
  if (CONTOH) {
    fs.writeFileSync(
      CONTOH,
      JSON.stringify(
        {
          sumber: `${DB_SIPP}+${DB_ABT} (salinan 9 Okt 2026), tools/ukur-deteksi-saksi.js`,
          catatan: "Pasangan jawaban kenal (ABT) - Keterangan saksi (SIPP) nyata; nama sesudah 'bernama' disamarkan.",
          ringkasan: { keduanya: h.keduanya, setara: h.setara, persis: h.persis, golonganSama: h.golonganSama },
          pasangan: h.contohPasangan,
        },
        null,
        1
      )
    );
  }
}

utama().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
