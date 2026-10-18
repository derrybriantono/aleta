"use strict";

/**
 * ============================================================================
 * KASIR JURNAL DARI JADWAL SIDANG (6 Okt 2026) - DIBUKTIKAN TANPA SIPP
 * ============================================================================
 *
 * Dijalankan atas basis data tiruan (db_config & bot_db_config diganti
 * penadah), tanpa jaringan:
 *
 *   1. rute GET /kasir, GET /kasir/cari, POST /kasir terpasang;
 *   2. GET /kasir atas perkara 580/Pdt.G/2026 (dianonimkan): usulan = baris
 *      yang ditulis kasir sungguhan, sisa Rp145.500;
 *   3. POST tanpa kering:false = kering - nol tulisan; tanpa akun - ditolak;
 *   4. sungguhan: perkara_biaya + sys_audittrail ('Add Mediasi') + juru sita,
 *      tanpa kata ALETA di SIPP, jejak ALETA (jenis kasir-jurnal, operator,
 *      IP, akun SIPP).
 *
 *   node scripts/verify-kasir-jurnal.js
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

process.env.ALETA_BOT_JEDA_MANUSIA_SKALA = "0";
process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji";

const P = 36495;
const T = 36496;
const rekaman = [];
const jejak = [];
let maxId = 101199;
const jurnal = [
  { id: 100884, pembiayaan: 1, kategoriId: 1, jenisBiayaId: 1, pihakId: null, pihakKe: null, urutan: 1, jenisTransaksi: 1, tanggal: "2026-09-15", uraian: "Panjar Biaya Perkara", jumlah: "355000.00", keterangan: "19845401260900092", diinputOleh: "kasir" },
  { id: 100885, pembiayaan: 1, kategoriId: 11, jenisBiayaId: 61, pihakId: null, pihakKe: null, urutan: 2, jenisTransaksi: -1, tanggal: "2026-09-15", uraian: "Biaya Pendaftaran/PNBP", jumlah: "30000.00", keterangan: null, diinputOleh: "kasir" },
  { id: 100886, pembiayaan: 1, kategoriId: 12, jenisBiayaId: 155, pihakId: null, pihakKe: null, urutan: 3, jenisTransaksi: -1, tanggal: "2026-09-15", uraian: "Biaya Pemberkasan/ATK", jumlah: "100000.00", keterangan: null, diinputOleh: "kasir" },
];
const JENIS = [
  [1, "Panjar Biaya Perkara", 1, 1, 0],
  [14, "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman", 4, -1, 0],
  [29, "Biaya Pemberitahuan/Penyampaian Putusan/Iklan", 6, -1, 0],
  [151, "Pengembalian Sisa Panjar", 2, -1, 0],
  [152, "Meterai", 8, -1, 10000],
  [157, "Redaksi", 13, -1, 10000],
  [236, "PNBP Relaas Panggilan Pertama Kepada Penggugat/Pelawan/Pembantah", 11, -1, 10000],
  [237, "PNBP Relaas Panggilan Pertama Kepada Tergugat/Terlawan/Pelawan", 11, -1, 10000],
  [389, "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat/Terlawan/Terbantah", 11, -1, 10000],
  [404, "PNBP Surat Permohonan Pencabutan Perkara", 11, -1, 10000],
].map(([id, nama, kategoriId, jenisTransaksi, jumlahBawaan]) => ({ id, nama, kategoriId, kategori: "", jenisTransaksi, jumlahBawaan }));

function jawabKueri(sql, params) {
  const s = String(sql).replace(/\s+/g, " ").trim();
  rekaman.push({ sql: s, params });
  // Jam SIPP: dahulu NOW(), kini UTC_TIMESTAMP() digeser ke zona SIPP (jam-sipp-semua-penulis) - tiruan mengenal keduanya.
  if (/^(START TRANSACTION|COMMIT|ROLLBACK)/.test(s)) return [];
  if (/DATE_FORMAT\((NOW\(\)|DATE_ADD\(UTC_TIMESTAMP\(\))/.test(s)) return [{ saat: "2026-10-01 14:52:53" }];
  if (/FROM sys_users WHERE username = \?/.test(s)) return String(params[0]) === "kasir" ? [{ username: "kasir", fullname: "Petugas Kasir", block: "0" }] : [];
  if (/FROM sys_users WHERE TRIM\(fullname\)/.test(s)) return [];
  if (/FROM perkara WHERE nomor_perkara LIKE/.test(s)) return String(params[0]) === "580/%" ? [{ perkaraId: 10132, nomorPerkara: "580/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-09-15" }] : [];
  if (/FROM perkara p LEFT JOIN perkara_penetapan/.test(s)) {
    return Number(params[0]) === 10132
      ? [{ perkaraId: 10132, nomorPerkara: "580/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkaraNama: "Cerai Gugat", tanggalDaftar: "2026-09-15", tahapanId: 15, proses: "Persidangan", penetapanHariSidang: "2026-09-16" }]
      : [];
  }
  if (/^SELECT pb\.id, pb\.id_pembiayaan/.test(s)) return jurnal.map((b) => ({ ...b }));
  if (/FROM perkara_pihak1 a/.test(s)) {
    return [
      { id: 6301, ke: 1, urutan: 1, pihakId: P, nama: "Penggugat Anonim", kecamatan: "72.71.01", kabupaten: "72.71" },
      { id: 6302, ke: 2, urutan: 1, pihakId: T, nama: "Tergugat Anonim", kecamatan: "72.71.01", kabupaten: "72.71" },
    ];
  }
  if (/FROM perkara_jurusita/.test(s)) return [{ jurusitaId: 22, nama: "Juru Sita Anonim" }];
  if (/FROM perkara_jadwal_sidang/.test(s)) return [{ id: 20147, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ikrar: "T", agenda: "Sidang Pertama", ditunda: "T", hasil: "putus DICABUT" }];
  if (/FROM perkara_pelaksanaan_relaas/.test(s)) {
    return [
      { id: 14568, sidangId: 20147, pihakId: P, ket: "E", resi: "", tanggalRelaas: "2026-09-18", tanggalJursitPos: null },
      { id: 14629, sidangId: 20147, pihakId: T, ket: "S", resi: "P2609190002831", tanggalRelaas: "2026-09-23", tanggalJursitPos: "2026-09-19" },
    ];
  }
  if (/FROM perkara_putusan pu/.test(s)) return [{ tanggal: "2026-10-01", statusId: 67, statusNama: "Dicabut", verstek: "T" }];
  if (/FROM perkara_putusan_pemberitahuan_putusan|FROM perkara_ikrar_talak/.test(s)) return [];
  if (/FROM jenis_biaya jb/.test(s)) return JENIS.map((x) => ({ ...x }));
  if (/JOIN pihak ph ON ph\.id = pb\.pihak_id/.test(s)) return [{ kecamatan: "72.71.01", kabupaten: "72.71", jumlah: "29500.00", rri: 0, khusus: 0, n: 40 }];
  if (/p\.alur_perkara_id AS alur/.test(s)) return [];
  if (/REGEXP 'Pemohon/.test(s)) return [{ bernomor: null, polos: null }];
  if (/^SELECT id FROM perkara_biaya WHERE perkara_id = \?/.test(s)) return [];
  if (/COALESCE\(MAX\(id\), 0\) \+ 1 AS maxid/.test(s)) return [{ maxid: maxId + 1 }];
  if (/^INSERT INTO perkara_biaya /.test(s)) {
    maxId = Number(params[0]);
    jurnal.push({
      id: maxId,
      pembiayaan: 1,
      kategoriId: params[5],
      jenisBiayaId: params[6],
      pihakId: params[7],
      pihakKe: params[8],
      urutan: 0,
      jenisTransaksi: params[9],
      tanggal: params[12],
      uraian: params[13],
      jumlah: String(params[14]),
      keterangan: params[15],
      diinputOleh: params[16],
      diinputTanggal: params[17],
    });
    return { insertId: 0, affectedRows: 1 };
  }
  if (/^INSERT INTO sys_audittrail/.test(s)) return { insertId: 1, affectedRows: 1 };
  if (/perkara_biaya_jurusita/.test(s)) return { affectedRows: 1 };
  if (/information_schema|SHOW TABLES/i.test(s)) return [];
  throw new Error(`kueri tak terduga: ${s.slice(0, 90)}`);
}

function penadah() {
  const ini = {
    query: (sql, params, selesai) => {
      const cb = typeof params === "function" ? params : selesai;
      const p = typeof params === "function" ? [] : params || [];
      try {
        cb(null, jawabKueri(sql, p));
      } catch (galat) {
        cb(galat);
      }
    },
    // Penulis kasir kini satu transaksi (transaksiSipp.denganTransaksi): sambungan tiruan memakai penjawab yang sama.
    getConnection: (cb) => {
      const sambungan = { query: (sql, params, selesai) => ini.query(sql, params, selesai), release: () => {} };
      cb(null, sambungan);
    },
    on: () => {},
  };
  return ini;
}

for (const nama of ["../db_config", "../bot_db_config"]) {
  const jalur = require.resolve(nama);
  require.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports: penadah() };
}
const jalurJejak = require.resolve("../services/jejakAletaService");
require.cache[jalurJejak] = {
  id: jalurJejak,
  filename: jalurJejak,
  loaded: true,
  exports: { catat: async (x) => jejak.push(x), riwayat: async () => ({ ok: true, baris: [] }), rincian: async () => ({ ok: false }) },
};
const jalurSkema = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[jalurSkema].exports = { ...skemaAsli, tabelAda: async () => true };

const router = require("../routes/jadwalSidangRoutes");

async function panggil(cara, alamat, badan) {
  return new Promise((selesai) => {
    const [jalur, kueri = ""] = alamat.split("?");
    const req = {
      method: cara,
      url: alamat,
      path: jalur,
      originalUrl: alamat,
      query: Object.fromEntries(new URLSearchParams(kueri)),
      body: badan || {},
      headers: { "x-aleta-internal-token": "token-uji" },
      ip: "172.18.0.3",
      socket: {},
    };
    const res = {
      statusCode: 200,
      status(n) {
        this.statusCode = n;
        return this;
      },
      json(isi) {
        selesai({ status: this.statusCode, isi });
      },
    };
    router.handle(req, res, () => selesai({ status: 404, isi: null }));
  });
}

(async () => {
  console.log("1. Rute terpasang");
  const jalur = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  for (const r of ["GET /kasir", "GET /kasir/cari", "POST /kasir"]) periksa(r, jalur.includes(r));

  console.log("2. Usulan atas 580/Pdt.G/2026 (dianonimkan)");
  const cari = await panggil("GET", "/kasir/cari?nomor=580");
  periksa("cari nomor 580 -> perkara 10132", cari.isi && cari.isi.perkara && cari.isi.perkara[0] && cari.isi.perkara[0].perkaraId === 10132);
  const usul = await panggil("GET", "/kasir?perkaraId=10132");
  const dipilih = ((usul.isi && usul.isi.usulan) || []).filter((u) => u.pilih);
  periksa(
    "usulan = baris kasir sungguhan",
    JSON.stringify(dipilih.map((u) => [u.jenisBiayaId, u.uraian, u.jumlah])) ===
      JSON.stringify([
        [236, "PNBP Relaas Panggilan Pertama Kepada Penggugat", 10000],
        [14, "Biaya Panggilan Tergugat/P2609190002831", 29500],
        [237, "PNBP Relaas Panggilan Pertama Kepada Tergugat", 10000],
        [157, "Redaksi", 10000],
        [152, "Meterai", 10000],
        [404, "PNBP Surat Permohonan Pencabutan Perkara", 10000],
        [151, "Pengembalian Sisa Panjar", 145500],
      ]),
    JSON.stringify(dipilih.map((u) => [u.jenisBiayaId, u.uraian, u.jumlah]))
  );

  console.log("3. Kering bawaan & tanpa akun");
  rekaman.length = 0;
  const baris = dipilih.slice(0, 3).map((u) => ({ ...u }));
  const kering = await panggil("POST", "/kasir", { perkaraId: 10132, akunSipp: "kasir", operator: "Derry", ip: "192.168.9.121", baris });
  periksa("tanpa kering:false = kering", kering.isi && kering.isi.kering === true && kering.isi.rencana.length === 3);
  periksa("kering tidak menulis", !rekaman.some((k) => /^(INSERT|UPDATE|DELETE|REPLACE)/.test(k.sql)));
  const tanpaAkun = await panggil("POST", "/kasir", { perkaraId: 10132, operator: "Derry", baris });
  periksa("tanpa akun ditolak", tanpaAkun.status === 400 && tanpaAkun.isi.alasan === "akun_sipp_tidak_disebut");

  console.log("4. Sungguhan + jejak");
  rekaman.length = 0;
  const sungguh = await panggil("POST", "/kasir", { perkaraId: 10132, akunSipp: "kasir", operator: "Derry", ip: "192.168.9.121", kering: false, baris });
  periksa("tersimpan & terbaca ulang", sungguh.isi && sungguh.isi.ok === true && sungguh.isi.ringkas.tersimpan === 3, JSON.stringify(sungguh.isi).slice(0, 300));
  const tulis = rekaman.filter((k) => /^(INSERT|UPDATE|DELETE|REPLACE)/.test(k.sql));
  periksa("3 baris jurnal, 3 audit, juru sita hanya sekali (biaya panggilan)",
    tulis.filter((k) => /INTO perkara_biaya /.test(k.sql)).length === 3 &&
      tulis.filter((k) => /sys_audittrail/.test(k.sql)).length === 3 &&
      tulis.filter((k) => /^REPLACE INTO perkara_biaya_jurusita/.test(k.sql)).length === 1);
  const audit = tulis.find((k) => /sys_audittrail/.test(k.sql));
  periksa("audit: formname 'Add Mediasi', judul Tambah Data Biaya [ID=101200], IP peramban", audit && audit.params[4] === "Add Mediasi" && /\[ID=101200\]$/.test(audit.params[6]) && audit.params[1] === "192.168.9.121");
  periksa("tanpa kata ALETA di SIPP", !/aleta/i.test(JSON.stringify(tulis)));
  const j = jejak[jejak.length - 1] || {};
  periksa("jejak ALETA: kasir-jurnal, akun, operator, IP, berhasil", j.jenis === "kasir-jurnal" && j.akunSipp === "kasir" && j.operator === "Derry" && j.ip === "192.168.9.121" && j.berhasil === true && j.kering === false);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
