"use strict";

/**
 * ============================================================================
 * PENJAGA KETAATAN TAHAPAN
 * ============================================================================
 *
 * Sebelas butir ketaatan tahapan ditulis sebagai DATA, dan kuerinya disusun
 * dari data itu. Bentuk seperti ini menghemat sebelas kali penulisan - tetapi
 * ia juga membuat kuerinya tidak dapat dibaca penjaga baca-saja SIPP, yang
 * bekerja dengan membaca teks sumber.
 *
 * Penjaga ini menutup lubang itu dengan cara yang justru lebih kuat: ia
 * MENYUSUN kueri setiap butir, lalu memeriksa hasil susunannya. Yang diperiksa
 * kueri yang benar-benar akan dikirim ke SIPP, bukan teks yang menyerupainya.
 *
 * ============================================================================
 * NAMA TABEL YANG KELIRU TIDAK MENGGAGALKAN APA PUN
 * ============================================================================
 *
 * Itulah bahayanya. Salah ketik nama tabel lolos kompilasi, lolos uji, lolos
 * tinjauan mata - lalu baru ketahuan di server, ketika seseorang menekan
 * Hitung dan mendapat galat SQL yang tidak dapat dipahaminya.
 *
 * Karena itu penjaga ini menyusun daftar nama yang PERNAH BENAR-BENAR DIPAKAI
 * oleh kueri lama di ALETA, lalu menolak butir yang menyebut nama di luar
 * daftar itu. Daftarnya tidak ditulis tangan - ia dipindai dari kueri yang
 * sudah berjalan, sehingga tumbuh sendiri seiring bertambahnya kueri.
 */

const fs = require("fs");
const path = require("path");

const FOLDER_LAYANAN = path.resolve(__dirname, "..", "services");
const BERKAS_INI = "penilaianTahapanService.js";

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

/* --------------------------------------------------------------------------
 * Daftar nama yang sudah terbukti, dipindai dari kueri lama
 * ------------------------------------------------------------------------ */

function namaTerbukti() {
  const tabel = new Set();
  const ruas = new Set();

  fs.readdirSync(FOLDER_LAYANAN)
    .filter((f) => f.endsWith(".js") && f !== BERKAS_INI)
    .forEach((f) => {
      const isi = fs.readFileSync(path.join(FOLDER_LAYANAN, f), "utf8");

      for (const m of isi.matchAll(/\b(?:FROM|JOIN)\s+`?([a-z_][a-z0-9_]*)`?/gi)) {
        const t = m[1].toLowerCase();
        if (t !== "dual" && t !== "select") tabel.add(t);
      }
      // Ruas dikenali dari dua bentuk: berawalan alias (p.nomor_perkara) dan
      // telanjang di dalam daftar SELECT.
      for (const m of isi.matchAll(/\b[a-z]{1,3}\.([a-z_][a-z0-9_]*)\b/g)) ruas.add(m[1].toLowerCase());
      for (const m of isi.matchAll(/\b(?:SELECT|,)\s*([a-z_][a-z0-9_]{3,})\s+AS\b/gi)) ruas.add(m[1].toLowerCase());
    });

  return { tabel, ruas };
}

console.log("Ketaatan tahapan - sebelas butir sebagai data\n");

const T = require("../services/penilaianTahapanService");
const terbukti = namaTerbukti();

console.log("== Nama yang dipakai sudah terbukti pada kueri lama ==");

cek(
  "daftar nama terbukti terbaca",
  terbukti.tabel.size > 40 && terbukti.ruas.size > 100,
  `${terbukti.tabel.size} tabel, ${terbukti.ruas.size} ruas`
);

const dipakai = T.namaSippDipakai();
const tabelAsing = dipakai.tabel.filter((t) => !terbukti.tabel.has(t));
const ruasAsing = dipakai.ruas.filter((r) => !terbukti.ruas.has(r));

cek(
  "tiap tabel yang dipakai pernah dipakai kueri lain",
  tabelAsing.length === 0,
  `tabel yang belum pernah terbukti: ${tabelAsing.join(", ")}`
);
cek(
  "tiap ruas yang dipakai pernah dipakai kueri lain",
  ruasAsing.length === 0,
  `ruas yang belum pernah terbukti: ${ruasAsing.join(", ")}`
);

/* --------------------------------------------------------------------------
 * Kueri yang benar-benar tersusun
 * ------------------------------------------------------------------------ */

console.log("== Kueri yang tersusun hanya membaca ==");

const KATA_TULIS = /\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|DROP|ALTER|CREATE|GRANT|SET|LOAD|RENAME|CALL|MERGE)\b/i;

T.TAHAPAN.forEach((t) => {
  const { sql } = T.susunKueri(t);
  const kata = String(sql).trim().split(/\s+/)[0].toUpperCase();

  cek(`${t.kode}: kueri diawali SELECT`, kata === "SELECT", `diawali ${kata}`);
  cek(`${t.kode}: tanpa kata kerja tulis`, !KATA_TULIS.test(sql), (sql.match(KATA_TULIS) || [])[0]);
  cek(
    `${t.kode}: dua penanda parameter, tidak lebih`,
    (sql.match(/\?/g) || []).length === 2,
    `${(sql.match(/\?/g) || []).length} penanda`
  );
  cek(`${t.kode}: berbatas LIMIT`, /\bLIMIT\s+\d+/i.test(sql));
  // Nilai tidak boleh ditempel langsung ke dalam kueri - hanya nama tabel dan
  // ruas yang boleh, dan keduanya berasal dari daftar tetap di berkas ini.
  cek(
    `${t.kode}: rentang tanggal lewat parameter, bukan ditempel`,
    !/'\d{4}-\d{2}-\d{2}'/.test(sql),
    "ada tanggal harfiah di dalam kueri"
  );
});

/* --------------------------------------------------------------------------
 * Bentuk butirnya
 * ------------------------------------------------------------------------ */

console.log("== Bentuk tiap butir ==");

const kodeTerlihat = new Set();
const kunciTerlihat = new Set();

T.TAHAPAN.forEach((t) => {
  const di = t.kode || "(tanpa kode)";
  cek(`${di}: kode berbentuk dua huruf dua angka`, /^[A-Z]{2}\d{2}$/.test(t.kode));
  cek(`${di}: kode tidak kembar`, !kodeTerlihat.has(t.kode));
  kodeTerlihat.add(t.kode);
  cek(`${di}: kunci tidak kembar`, !kunciTerlihat.has(t.kunci));
  kunciTerlihat.add(t.kunci);
  cek(`${di}: keterangan cukup panjang`, (t.keterangan || "").length >= 40);
  cek(`${di}: menyebut dasar hukum atau kebijakannya`, (t.dasar || "").length >= 10);
  cek(`${di}: batas hari berupa angka wajar`, Number.isInteger(t.batasHari) && t.batasHari >= 0 && t.batasHari <= 365);
});

/* --------------------------------------------------------------------------
 * Pemetaan baris - diuji tanpa menyentuh SIPP
 * ------------------------------------------------------------------------ */

console.log("== Pemetaan baris diuji dengan baris buatan ==");

// Kolam jawaban dipasang menggantikan db.query, sehingga logika pemetaannya
// dapat diuji tanpa basis data. Yang diuji BUKAN kuerinya, melainkan apa yang
// terjadi pada jawaban yang aneh - dan justru di situlah kekeliruan bersembunyi.
const db = require("../db_config");
const queryAsli = db.query;
let jawaban = [];
db.query = (sql, params, balik) => balik(null, jawaban);

const kerangka = require("../services/kerangkaPenilaianService");
T.daftarkanSemua();

(async () => {
  const def = kerangka.daftar().find((d) => d.kunci === "ketaatanPenetapanMajelis");
  cek("butir terdaftar pada kerangka", Boolean(def));

  const ambilBaris = require("../services/kerangkaPenilaianService");
  void ambilBaris;

  // Empat keadaan yang harus dibedakan.
  jawaban = [
    // memenuhi - tiga hari kerja
    { perkaraId: 1, nomorPerkara: "1/Pdt.G", jenisPerkara: "Cerai Gugat", acuan: "2026-03-02", peristiwa: "2026-03-04" },
    // terlambat
    { perkaraId: 2, nomorPerkara: "2/Pdt.G", jenisPerkara: "Cerai Gugat", acuan: "2026-03-02", peristiwa: "2026-04-30" },
    // belum tercatat sama sekali
    { perkaraId: 3, nomorPerkara: "3/Pdt.G", jenisPerkara: "Cerai Gugat", acuan: "2026-03-02", peristiwa: null },
    // acuannya sendiri belum ada - dikeluarkan dari penyebut
    { perkaraId: 4, nomorPerkara: "4/Pdt.G", jenisPerkara: "Cerai Gugat", acuan: null, peristiwa: "2026-03-04" },
    // peristiwa mendahului acuannya - temuan
    { perkaraId: 5, nomorPerkara: "5/Pdt.G", jenisPerkara: "Cerai Gugat", acuan: "2026-03-10", peristiwa: "2026-03-02" },
  ];

  const hasil = await kerangka.jalankan("ketaatanPenetapanMajelis", "bulanan", "2026-03-31", { banyak: 1 });
  cek("penilaian berjalan", hasil.ok === true, JSON.stringify(hasil).slice(0, 160));

  const satuan = hasil.satuan[0];
  const bukti = satuan.bukti;

  cek("acuan kosong dikeluarkan dari penyebut", bukti.length === 4, `${bukti.length} baris`);
  cek("tidak ada baris untuk perkara 4", !bukti.some((b) => b.nomorPerkara === "4/Pdt.G"));

  const b1 = bukti.find((b) => b.nomorPerkara === "1/Pdt.G");
  const b2 = bukti.find((b) => b.nomorPerkara === "2/Pdt.G");
  const b3 = bukti.find((b) => b.nomorPerkara === "3/Pdt.G");
  const b5 = bukti.find((b) => b.nomorPerkara === "5/Pdt.G");

  cek("yang tepat waktu memenuhi", b1 && b1.memenuhi === true, JSON.stringify(b1));
  cek("yang terlambat tidak memenuhi", b2 && b2.memenuhi === false);
  cek(
    "yang terlambat menyebut melewati batas, bukan belum tercatat",
    b2 && /melewati batas/.test(b2.sebabTidakMemenuhi),
    b2 && b2.sebabTidakMemenuhi
  );

  // Inilah perbedaan yang menentukan. "Belum tercatat" berarti tahapannya
  // memang belum dikerjakan; "terlambat" berarti dikerjakan tetapi lewat
  // waktu. Menyamakan keduanya menyembunyikan yang pertama di balik yang kedua.
  cek("yang belum tercatat dibedakan dari yang terlambat", b3 && b3.sebabTidakMemenuhi === "belum tercatat", b3 && b3.sebabTidakMemenuhi);
  cek("yang belum tercatat berjarak null, bukan nol", b3 && b3.jarakHari === null, b3 && String(b3.jarakHari));

  cek(
    "peristiwa yang mendahului acuannya ditandai temuan",
    b5 && /mendahului/.test(b5.sebabTidakMemenuhi),
    b5 && b5.sebabTidakMemenuhi
  );
  cek("dan tidak dihitung memenuhi", b5 && b5.memenuhi === false);

  // Penyebut di bawah dua puluh: nilainya harus ditahan.
  cek("penyebut kecil menahan nilainya", satuan.nilai === null && satuan.cukup === false, JSON.stringify({ n: satuan.nilai, c: satuan.cukup }));

  // Jawaban kosong tidak boleh meledak.
  jawaban = [];
  const kosong = await kerangka.jalankan("ketaatanPenetapanMajelis", "bulanan", "2026-03-31", { banyak: 1 });
  cek("jawaban kosong tidak meledak", kosong.ok === true && kosong.satuan[0].penyebut === 0);

  db.query = queryAsli;

  console.log(`\n${T.TAHAPAN.length} butir tahapan diperiksa.`);
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((e) => {
  db.query = queryAsli;
  console.log("  GAGAL  penjaga sendiri meledak - " + String(e && e.message ? e.message : e));
  console.log(`\nHasil: ${lulus} lulus, ${gagal + 1} gagal`);
  process.exit(1);
});
