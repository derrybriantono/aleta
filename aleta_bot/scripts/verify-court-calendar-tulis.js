"use strict";

/**
 * ============================================================================
 * COURT CALENDAR DARI JADWAL SIDANG (6 Okt 2026, butir 3) - DIBUKTIKAN TANPA SIPP
 * ============================================================================
 *
 * Dijalankan atas basis data tiruan (db_config & bot_db_config diganti
 * penadah), tanpa jaringan:
 *
 *   1. rute GET/POST /court-calendar dan GET /court-calendar/jumlah terpasang;
 *   2. pernyataan berbentuk validateInput / validateEdit SIPP, jam dua belas
 *      DATE_FORMAT(NOW(), '%h'), akun dari sys_users, tanpa sys_audittrail,
 *      tanpa kata ALETA;
 *   3. kering bawaan - nol tulisan; tanpa akun - ditolak;
 *   4. sungguhan: jeda sebelum tiap tulisan, dibaca ulang, POST rute mencatat
 *      jejak ALETA (jenis court-calendar, operator, IP).
 *
 *   node scripts/verify-court-calendar-tulis.js
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

const rekaman = [];
const jejak = [];
const kalender = [
  { id: 8717, tanggal: "2026-09-08", jam: "09:00", agenda: "Sidang Pertama", keterangan: "", diinputOleh: "andini", diperbaharuiOleh: null },
];
let idBerikut = 9000;

function jawabKueri(sql, params) {
  const s = String(sql).replace(/\s+/g, " ").trim();
  rekaman.push({ sql: s, params });
  if (/FROM sys_users/.test(s)) return String(params[0]).toLowerCase() === "munifa,sh." ? [{ username: "munifa,SH.", fullname: "Munifa", block: "0" }] : [];
  if (/FROM perkara WHERE/.test(s)) {
    return Number(params[0]) === 10049
      ? [{ perkaraId: 10049, nomorPerkara: "123/Pdt.G/2026/PA.Dgl", tanggalDaftar: "2026-09-01", jenisPerkara: "Cerai Gugat" }]
      : [];
  }
  if (/^SELECT perkara_id AS perkaraId, COUNT/.test(s)) return [{ perkaraId: 10049, n: kalender.length }];
  if (/^SELECT id, DATE_FORMAT\(rencana_tanggal/.test(s)) return kalender.map((b) => ({ ...b }));
  if (/^INSERT INTO perkara_court_calendar/.test(s)) {
    idBerikut += 1;
    kalender.push({ id: idBerikut, tanggal: params[1], jam: params[2], agenda: params[3], keterangan: params[4], diinputOleh: params[5] });
    return { insertId: idBerikut, affectedRows: 1 };
  }
  if (/^UPDATE perkara_court_calendar/.test(s)) {
    const b = kalender.find((x) => x.id === params[5]);
    if (!b) return { affectedRows: 0 };
    Object.assign(b, { tanggal: params[0], jam: params[1], agenda: params[2], keterangan: params[3], diperbaharuiOleh: params[4] });
    return { affectedRows: 1 };
  }
  if (/information_schema|SHOW TABLES/i.test(s)) return [{ TABLE_NAME: "perkara_court_calendar", ada: 1, jumlah: 1 }];
  return [];
}

function penadah() {
  return {
    query: (sql, params, selesai) => {
      const cb = typeof params === "function" ? params : selesai;
      const p = typeof params === "function" ? [] : params || [];
      try {
        cb(null, jawabKueri(sql, p));
      } catch (galat) {
        cb(galat);
      }
    },
    getConnection: (cb) => cb(new Error("tanpa koneksi")),
    on: () => {},
  };
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
// tabelAda membaca skema SIPP; dijawab "ada" supaya penadah tidak perlu meniru information_schema.
const jalurSkema = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[jalurSkema].exports = { ...skemaAsli, tabelAda: async () => true };

const layanan = require("../services/courtCalendarTulisService");
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
  for (const r of ["GET /court-calendar", "POST /court-calendar", "GET /court-calendar/jumlah"]) periksa(r, jalur.includes(r));

  console.log("2. Bentuk blangko SIPP");
  const rencana = await layanan.susunRencana({
    perkaraId: 10049,
    akunSipp: "MUNIFA,SH.",
    operator: "Penguji",
    tambah: [{ tanggal: "2026-10-13", jam: "15:00", agenda: " Replik Penggugat ", keterangan: "Elitigasi" }],
    ubah: [{ id: 8717, tanggal: "2026-09-09", jam: "09:00", agenda: "Sidang Pertama", keterangan: "Panggil Tergugat" }],
  });
  periksa("rencana tersusun", rencana.ok === true, JSON.stringify(rencana).slice(0, 200));
  const ins = rencana.langkah.find((x) => x.aksi === "INSERT");
  const upd = rencana.langkah.find((x) => x.aksi === "UPDATE");
  periksa(
    "INSERT = kolom & urutan validateInput, jam dua belas",
    ins &&
      ins.sql ===
        "INSERT INTO perkara_court_calendar (perkara_id, rencana_tanggal, rencana_jam, rencana_agenda, keterangan, diinput_oleh, diinput_tanggal) VALUES (?,?,?,?,?,?,DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i:%s'))"
  );
  periksa("INSERT nilai (agenda di-trim, akun ejaan sys_users)", ins && JSON.stringify(ins.params) === JSON.stringify([10049, "2026-10-13", "15:00", "Replik Penggugat", "Elitigasi", "munifa,SH."]));
  periksa("UPDATE = validateEdit (diperbaharui_*, WHERE id AND perkara_id)", upd && /diperbaharui_oleh = \?, diperbaharui_tanggal = DATE_FORMAT\(NOW\(\), '%Y-%m-%d %h:%i:%s'\) WHERE id = \? AND perkara_id = \?$/.test(upd.sql));
  periksa("tanpa sys_audittrail dan tanpa kata ALETA", !/sys_audittrail|aleta/i.test(JSON.stringify(rencana.langkah)));

  console.log("3. Kering bawaan & tanpa akun");
  rekaman.length = 0;
  const kering = await layanan.jalankanRencana(rencana);
  periksa("kering tanpa opsi", kering.kering === true && kering.rencana.length === 2);
  periksa("nol tulisan saat kering", !rekaman.some((k) => /^(INSERT|UPDATE|DELETE|REPLACE)/.test(k.sql)));
  const tanpaAkun = await layanan.susunRencana({ perkaraId: 10049, operator: "Penguji", tambah: [{ tanggal: "2026-10-13", jam: "09:00", agenda: "x" }] });
  periksa("tanpa akun ditolak", tanpaAkun.ok === false && tanpaAkun.alasan === "akun_sipp_tidak_disebut");
  const akunAsing = await layanan.susunRencana({ perkaraId: 10049, akunSipp: "fahri", operator: "Penguji", tambah: [{ tanggal: "2026-10-13", jam: "09:00", agenda: "x" }] });
  periksa("akun tak dikenal SIPP ditolak", akunAsing.ok === false && akunAsing.alasan === "akun_sipp_tidak_ketemu");

  console.log("4. Lewat rute: kering bawaan, lalu sungguhan + jejak");
  rekaman.length = 0;
  const viaRuteKering = await panggil("POST", "/court-calendar", {
    perkaraId: 10049,
    akunSipp: "munifa,SH.",
    operator: "Derry",
    ip: "192.168.9.121",
    tambah: [{ tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian Penggugat" }],
  });
  periksa("rute tanpa kering:false = kering", viaRuteKering.isi && viaRuteKering.isi.kering === true);
  periksa("rute kering tidak menulis", !rekaman.some((k) => /^(INSERT|UPDATE)/.test(k.sql)));
  const viaRute = await panggil("POST", "/court-calendar", {
    perkaraId: 10049,
    akunSipp: "munifa,SH.",
    operator: "Derry",
    ip: "192.168.9.121",
    kering: false,
    tambah: [{ tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian Penggugat" }],
  });
  periksa("rute sungguhan: tersimpan & terbaca ulang", viaRute.isi && viaRute.isi.ok === true && viaRute.isi.hasil[0].keadaan === "tersimpan", JSON.stringify(viaRute.isi).slice(0, 300));
  const terakhir = jejak[jejak.length - 1] || {};
  periksa(
    "jejak ALETA: court-calendar, akun, operator, IP, berhasil",
    terakhir.jenis === "court-calendar" && terakhir.akunSipp === "munifa,SH." && terakhir.operator === "Derry" && terakhir.ip === "192.168.9.121" && terakhir.berhasil === true && terakhir.kering === false
  );
  const jumlah = await panggil("GET", "/court-calendar/jumlah?perkaraId=10049,abc,10050");
  periksa("jumlah per perkara", jumlah.isi && jumlah.isi.jumlah && jumlah.isi.jumlah["10049"] === kalender.length && jumlah.isi.jumlah["10050"] === 0);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
