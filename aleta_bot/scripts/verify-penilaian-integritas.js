"use strict";

/**
 * ============================================================================
 * PENJAGA INTEGRITAS DATA
 * ============================================================================
 *
 * Empat butir yang menilai data SIPP itu sendiri: apakah ruas wajibnya terisi,
 * apakah dokumen elektroniknya ada, apakah keterangan saksinya tercatat, dan
 * apakah tanggal-tanggalnya berurutan sebagaimana peristiwanya.
 *
 * Keempatnya sederhana, dan justru karena itu paling mudah dibuat menyesatkan.
 * Dua kekeliruan yang dijaga di sini:
 *
 *   1. Menghitung ruas berisi "0" atau "-" sebagai TERISI. Pengukuran ruas
 *      bebas pada SIPP menemukan 6.210 entri alasan penundaan yang isinya
 *      hanya "0". Bila itu terhitung terisi, angka kelengkapan tampak baik
 *      padahal tidak ada isinya sama sekali.
 *
 *   2. Menilai urutan tanggal dari satu tanggal saja. Perkara yang baru punya
 *      tanggal putusan belum dapat dinilai urutannya - ia belum sampai ke
 *      sana. Menghitungnya "urutannya benar" membuat penyebut membengkak oleh
 *      perkara yang tidak menjawab apa pun.
 */

const fs = require("fs");
const path = require("path");

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

console.log("Integritas data - empat butir\n");

const I = require("../services/penilaianIntegritasService");

/* --------------------------------------------------------- terisi() */

console.log('== "terisi" menolak isian pengisi ==');

const TOLAK = ["", "   ", "-", "--", ".", "0", "00", "0000", "_", "/", null, undefined];
TOLAK.forEach((v) => {
  cek(`"${String(v)}" dihitung kosong`, I.terisi(v) === false);
});

const TERIMA = ["Amar", "0 (nol) rupiah", "Rp0", "A", "2026-01-01"];
TERIMA.forEach((v) => {
  cek(`"${v}" dihitung terisi`, I.terisi(v) === true);
});

/* ------------------------------------------------- nama yang terbukti */

console.log("== Nama yang dipakai sudah terbukti pada kueri lain ==");

const FOLDER = path.resolve(__dirname, "..", "services");
const BERKAS_INI = "penilaianIntegritasService.js";
const tabelTerbukti = new Set();
const ruasTerbukti = new Set();

fs.readdirSync(FOLDER)
  .filter((f) => f.endsWith(".js") && f !== BERKAS_INI)
  .forEach((f) => {
    const isi = fs.readFileSync(path.join(FOLDER, f), "utf8");
    for (const m of isi.matchAll(/\b(?:FROM|JOIN)\s+`?([a-z_][a-z0-9_]*)`?/gi)) {
      const t = m[1].toLowerCase();
      if (t !== "dual" && t !== "select") tabelTerbukti.add(t);
    }
    for (const m of isi.matchAll(/\b[a-z]{1,3}\.([a-z_][a-z0-9_]*)\b/g)) ruasTerbukti.add(m[1].toLowerCase());
    for (const m of isi.matchAll(/\b(?:SELECT|,)\s*([a-z_][a-z0-9_]{3,})\s+AS\b/gi)) ruasTerbukti.add(m[1].toLowerCase());
  });

const dipakai = I.namaSippDipakai();
const tabelAsing = dipakai.tabel.filter((t) => !tabelTerbukti.has(t));
const ruasAsing = dipakai.ruas.filter((r) => !ruasTerbukti.has(r));

cek("tiap tabel pernah dipakai kueri lain", tabelAsing.length === 0, tabelAsing.join(", "));
cek("tiap ruas pernah dipakai kueri lain", ruasAsing.length === 0, ruasAsing.join(", "));

/* ------------------------------------------------------- kuerinya */

console.log("== Kueri yang tersusun hanya membaca ==");

const KATA_TULIS = /\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|DROP|ALTER|CREATE|GRANT|LOAD|RENAME|CALL)\b/i;

I.seluruhKueri().forEach((q) => {
  const kata = q.sql.trim().split(/\s+/)[0].toUpperCase();
  cek(`${q.kode}: diawali SELECT`, kata === "SELECT", `diawali ${kata}`);
  cek(`${q.kode}: tanpa kata kerja tulis`, !KATA_TULIS.test(q.sql));
  cek(`${q.kode}: dua penanda parameter`, (q.sql.match(/\?/g) || []).length === 2);
  cek(`${q.kode}: berbatas LIMIT`, /\bLIMIT\s+\d+/i.test(q.sql));
});

/* ------------------------------------------- pemetaan baris tanpa SIPP */

console.log("== Pemetaan baris diuji dengan baris buatan ==");

const db = require("../db_config");
const queryAsli = db.query;
let jawaban = [];
db.query = (sql, params, balik) => balik(null, jawaban);

const kerangka = require("../services/kerangkaPenilaianService");
I.daftarkanSemua();

(async () => {
  // ---- kelengkapan ruas ----
  jawaban = [
    { nomorPerkara: "1/Pdt.G", jenisPerkara: "Cerai Gugat", amar: "Mengabulkan", petitum: "Menceraikan" },
    { nomorPerkara: "2/Pdt.G", jenisPerkara: "Cerai Gugat", amar: "", petitum: "Menceraikan" },
    { nomorPerkara: "3/Pdt.G", jenisPerkara: "Cerai Gugat", amar: "0", petitum: "-" },
    { nomorPerkara: "4/Pdt.G", jenisPerkara: "Cerai Gugat", amar: null, petitum: null },
  ];
  const h = await kerangka.jalankan("kelengkapanRuasWajibPerkara", "bulanan", "2026-03-31", { banyak: 1 });
  cek("kelengkapan berjalan", h.ok === true);

  const b = h.satuan[0].bukti;
  cek("seluruh baris masuk penyebut", b.length === 4, `${b.length}`);
  cek("yang lengkap memenuhi", b[0].memenuhi === true);
  cek("ruas kosong tidak memenuhi", b[1].memenuhi === false);
  cek("ruas kosong menyebut nama ruasnya", /amar/.test(b[1].sebabTidakMemenuhi), b[1].sebabTidakMemenuhi);

  // Inilah pemeriksaan yang paling menentukan: "0" dan "-" BUKAN terisi.
  cek('isian "0" dan "-" dihitung kosong', b[2].memenuhi === false && b[2].jumlahRuasKosong === 2, JSON.stringify(b[2]));
  cek("null dihitung kosong", b[3].memenuhi === false && b[3].jumlahRuasKosong === 2);

  // ---- urutan tanggal ----
  jawaban = [
    // berurutan benar
    { nomorPerkara: "10/Pdt.G", jenisPerkara: "Cerai Gugat", tanggal_putusan: "2026-01-10", tanggal_minutasi: "2026-01-20", tanggal_bht: "2026-02-10" },
    // minutasi mendahului putusan - tidak mungkin
    { nomorPerkara: "11/Pdt.G", jenisPerkara: "Cerai Gugat", tanggal_putusan: "2026-01-20", tanggal_minutasi: "2026-01-10", tanggal_bht: "2026-02-10" },
    // baru satu tanggal - belum dapat dinilai
    { nomorPerkara: "12/Pdt.G", jenisPerkara: "Cerai Gugat", tanggal_putusan: "2026-01-20", tanggal_minutasi: null, tanggal_bht: null },
    // tidak satu pun - belum dapat dinilai
    { nomorPerkara: "13/Pdt.G", jenisPerkara: "Cerai Gugat", tanggal_putusan: null, tanggal_minutasi: null, tanggal_bht: null },
  ];
  const u = await kerangka.jalankan("kewajaranUrutanTanggalPutusan", "bulanan", "2026-03-31", { banyak: 1 });
  cek("urutan berjalan", u.ok === true);

  const bu = u.satuan[0].bukti;
  cek("yang belum punya dua tanggal dikeluarkan", bu.length === 2, `${bu.length} baris`);
  cek("yang berurutan benar memenuhi", bu[0].memenuhi === true);
  cek("yang terbalik tidak memenuhi", bu[1].memenuhi === false);
  cek(
    "yang terbalik menyebut kedua tanggalnya",
    /minutasi.*mendahului.*putusan/.test(bu[1].sebabTidakMemenuhi),
    bu[1].sebabTidakMemenuhi
  );

  // ---- keberadaan baris pada tabel lain ----
  jawaban = [
    { nomorPerkara: "20/Pdt.G", jenisPerkara: "Cerai Gugat", jumlahAda: 2 },
    { nomorPerkara: "21/Pdt.G", jenisPerkara: "Cerai Gugat", jumlahAda: 0 },
  ];
  const s = await kerangka.jalankan("perkaraTanpaDataSaksi", "bulanan", "2026-03-31", { banyak: 1 });
  cek("keberadaan baris berjalan", s.ok === true);
  cek("yang punya saksi memenuhi", s.satuan[0].bukti[0].memenuhi === true);
  cek("yang tanpa saksi tidak memenuhi", s.satuan[0].bukti[1].memenuhi === false);

  // ---- jawaban kosong ----
  jawaban = [];
  const kosong = await kerangka.jalankan("kelengkapanRuasWajibPerkara", "bulanan", "2026-03-31", { banyak: 1 });
  cek("jawaban kosong tidak meledak", kosong.ok === true && kosong.satuan[0].penyebut === 0);

  db.query = queryAsli;
  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((e) => {
  db.query = queryAsli;
  console.log("  GAGAL  penjaga sendiri meledak - " + String(e && e.message ? e.message : e));
  console.log(`\nHasil: ${lulus} lulus, ${gagal + 1} gagal`);
  process.exit(1);
});
