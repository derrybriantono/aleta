"use strict";

/**
 * Verifikasi pembaca riwayat login e-Court lewat WhatsApp (ecourtRiwayatLoginWaService,
 * 18 Okt 2026). Tanpa basis data sungguhan: botDb dipalsukan.
 */

const svc = require("../services/ecourtRiwayatLoginWaService");

let lulus = 0;
let gagal = 0;
function periksa(nama, kondisi, rinci = "") {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${rinci ? ` - ${rinci}` : ""}`);
  }
}

const BARIS = [
  { id: "sec_1", event_type: "ecourt_login_berhasil", severity: "warning", message: "Sesi e-Court dibuka lewat WhatsApp (jawaban captcha).", created_at: "2026-10-18 01:05:00", metadata_json: JSON.stringify({ jalur: "whatsapp", berhasil: true, jalurMendarat: "/dashboard", lewatGerbang: false, sandi: "RAHASIA", email: "a@b.id" }) },
  { id: "sec_2", event_type: "ecourt_login_berhasil", severity: "warning", message: "Sesi e-Court dibuka lewat portal.", created_at: "2026-10-18 00:30:00", metadata_json: JSON.stringify({ jalur: "portal", berhasil: true }) },
  { id: "sec_3", event_type: "ecourt_wa_captcha_dikirim", severity: "info", message: "Captcha login e-Court dikirim ke super admin lewat WhatsApp.", created_at: new Date("2026-10-18T01:00:00Z"), metadata_json: JSON.stringify({ sumber: "menyala", manual: false, slot: "hakim", kedaluwarsaMenit: 10 }) },
  { id: "sec_4", event_type: "ecourt_wa_captcha_kedaluwarsa", severity: "warning", message: "kedaluwarsa", created_at: "2026-10-17 23:00:00", metadata_json: "{bukan json" },
  { id: "sec_5", event_type: "ecourt_wa_susulan_dimulai", severity: "info", message: "bukan yang dicari", created_at: "2026-10-18 02:00:00", metadata_json: "{}" },
  { id: "sec_6", event_type: "ecourt_wa_captcha_dibatalkan", severity: "info", message: "dibatalkan", created_at: "tidak-sah", metadata_json: "{}" },
];

(async () => {
  console.log("== Bentuk peristiwa ==");
  const p1 = svc.bentukPeristiwa(BARIS[0]);
  periksa("login WhatsApp diterima, waktu UTC -> ISO", p1 && p1.createdAt === "2026-10-18T01:05:00.000Z");
  periksa("metadata disaring: rahasia (sandi/surel) tidak ikut", p1 && !("sandi" in p1.metadata) && !("email" in p1.metadata) && !/RAHASIA|a@b/.test(JSON.stringify(p1)));
  periksa("metadata aman tetap ada", p1 && p1.metadata.jalur === "whatsapp" && p1.metadata.jalurMendarat === "/dashboard");
  periksa("login lewat portal ditolak (punya jejak per pengguna)", svc.bentukPeristiwa(BARIS[1]) === null);
  const p3 = svc.bentukPeristiwa(BARIS[2]);
  periksa("captcha dikirim: waktu Date -> ISO", p3 && p3.createdAt === "2026-10-18T01:00:00.000Z");
  periksa("metadata bukan JSON -> kosong, peristiwa tetap diterima", svc.bentukPeristiwa(BARIS[3]) && Object.keys(svc.bentukPeristiwa(BARIS[3]).metadata).length === 0);
  periksa("jenis lain ditolak", svc.bentukPeristiwa(BARIS[4]) === null);
  periksa("waktu tak sah ditolak", svc.bentukPeristiwa(BARIS[5]) === null);

  console.log("== Pembacaan (hanya SELECT) ==");
  const catatan = [];
  const botDb = {
    query: async (sql, params) => {
      catatan.push({ sql, params });
      return BARIS;
    },
  };
  const h = await svc.bacaPeristiwa({ botDb, batas: 50 });
  periksa("ok, tiga peristiwa lolos saring", h.ok === true && h.peristiwa.length === 3, JSON.stringify(h.peristiwa.map((x) => x.id)));
  periksa("hanya SELECT, pola event dikunci", catatan.length === 1 && /^SELECT /.test(catatan[0].sql) && !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(catatan[0].sql));
  periksa("pola ecourt_login_ dan ecourt_wa_captcha_ (garis bawah di-escape)", catatan[0].params[0] === "ecourt\\_login\\_%" && catatan[0].params[1] === "ecourt\\_wa\\_captcha\\_%");
  periksa("batas dipakai", catatan[0].params[catatan[0].params.length - 1] === 50);
  await svc.bacaPeristiwa({ botDb, sejak: "2026-10-18T00:00:00.000Z", batas: 99999 });
  periksa("sejak -> kolom UTC, batas dibatasi 500", /created_at >= \?/.test(catatan[1].sql) && catatan[1].params[2] === "2026-10-18 00:00:00" && catatan[1].params[3] === 500);
  await svc.bacaPeristiwa({ botDb, sejak: "bukan-waktu" });
  periksa("sejak tak sah diabaikan (tanpa saringan waktu)", !/created_at >= \?/.test(catatan[2].sql));

  console.log("== Kegagalan ==");
  const gagalDb = { query: async () => { throw new Error("koneksi putus"); } };
  const g = await svc.bacaPeristiwa({ botDb: gagalDb });
  periksa("galat basis data -> ok:false, tanpa melempar", g.ok === false && /basis_data_bot_galat/.test(g.alasan) && g.peristiwa.length === 0);
  periksa("tanpa botDb -> ok:false", (await svc.bacaPeristiwa({})).ok === false);

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => {
  console.error("GALAT", e);
  process.exit(1);
});
