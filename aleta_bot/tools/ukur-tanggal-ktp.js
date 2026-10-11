#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR TANGGAL KTP DARI e-COURT (12 Okt 2026, KTP-PIHAK) - BACA SAJA
 * ============================================================================
 *
 *   node tools/ukur-tanggal-ktp.js [--sipp SIPP] [--bot aleta_bot] [--abt aps_badilag] [--json]
 *
 * Di laptop (salinan 9 Okt):  node aleta_bot/tools/ukur-tanggal-ktp.js --sipp sipp_donggala
 * Di server (container bot):  docker compose exec aleta_bot node tools/ukur-tanggal-ktp.js
 *   (memakai ALETA_BOT_DB_HOST/USER/PASSWORD dan ALETA_BOT_DB_SIPP_NAME dari .env.production)
 *
 * HANYA SELECT - tidak menulis ke SIPP, ABT, maupun aleta_bot. Yang MEMBACA berkas KTP adalah
 * portal (penyapu latar, modules/aleta-ecourt/ktp-pihak.ts); alat ini mengukur HASILNYA yang
 * tersimpan di aleta_bot_ktp_pihak, jadi dijalankan SESUDAH penyapu sempat bekerja:
 *
 *   A. Cakupan  - dokumen KTP e-Court, berkas yang terunduh, yang sudah dibaca, yang tidak
 *                 terbaca (per sebab), yang terbaca tetapi tak bertuan.
 *   B. Ketepatan TANGGAL - bacaan berkeyakinan cukup/pasti dibanding ISIAN PETUGAS di ABT
 *                 (abt_data_tanggal 0364 = Pemohon/Penggugat I, 2222 = idem, 0366 = Pemohon II,
 *                 0365 = Termohon/Tergugat): sama / beda / isian kosong. Ketepatan = sama / (sama + beda).
 *   C. Salah cocok pihak - NIK KTP sama dengan NIK pihak LAIN daripada yang dipilih (pasti salah);
 *                 pilihan yang berselisih dengan isian petugas pada slot sebelahnya.
 *   D. Keputusan - "pasti" HANYA bila ketepatan tanggal >= 95% dengan n >= 30 pembanding. Bila ya,
 *                 nyalakan ALETA_KTP_PIHAK_YAKIN=pasti di .env.production bot LALU re-baca (naikkan
 *                 VERSI_KTP_PIHAK) agar baris lama ikut berkeyakinan "pasti".
 *
 * Keluaran angka saja (tanpa NIK/nama); --json menulis ringkasan mesin-terbaca.
 */

const mysql = require("mysql");
const K = require("../services/ktpPihakService");

const argv = process.argv.slice(2);
const opsi = (nama, bawaan) => {
  const i = argv.indexOf(nama);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const SIPP = opsi("--sipp", process.env.ALETA_BOT_DB_SIPP_NAME || "SIPP");
const BOT = opsi("--bot", process.env.ALETA_BOT_INTERNAL_DB_NAME || process.env.ALETA_BOT_DB_NAME || "aleta_bot");
const ABT = opsi("--abt", "aps_badilag");
const JSON_SAJA = argv.includes("--json");

for (const nama of [SIPP, BOT, ABT]) {
  if (!/^[A-Za-z0-9_]+$/.test(nama)) {
    console.error("Nama database tidak sah.");
    process.exit(2);
  }
}

const koneksi = mysql.createConnection({
  host: process.env.ALETA_BOT_DB_SIPP_HOST || process.env.ALETA_BOT_DB_HOST || "127.0.0.1",
  port: Number(process.env.ALETA_BOT_DB_SIPP_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
  user: process.env.ALETA_BOT_DB_SIPP_USER || process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_SIPP_PASSWORD || process.env.ALETA_BOT_DB_PASSWORD || "",
  charset: "utf8mb4",
  dateStrings: true,
});
const q = (sql, p) => new Promise((ok, no) => koneksi.query(sql, p || [], (e, r) => (e ? no(e) : ok(r))));
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

/** Slot ABT isian petugas untuk (cabang, urutan). */
const SLOT_ISIAN = { "1.1": [364, 2222], "2.1": [365], "1.2": [366] };

async function tabelAda(db, tabel) {
  const r = await q("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?", [db, tabel]);
  return Number(r[0].n) > 0;
}

async function main() {
  const keluar = { dibuat: new Date().toISOString(), basisData: { SIPP, BOT, ABT } };
  const catat = (...baris) => {
    if (!JSON_SAJA) console.log(...baris);
  };

  // ---- A. cakupan ------------------------------------------------------------------------------------------
  const dok = await q(
    `SELECT COUNT(DISTINCT d.document_key) AS dokumen, COUNT(DISTINCT d.nomor_perkara) AS perkara
       FROM ${BOT}.aleta_bot_ecourt_documents d WHERE ${K.SQL_KANDIDAT}`
  );
  const ber = await q(
    `SELECT COUNT(DISTINCT f.id) AS berkas, COUNT(DISTINCT f.sidik_jari) AS isiUnik
       FROM ${BOT}.aleta_bot_ecourt_documents d JOIN ${BOT}.aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
      WHERE ${K.SQL_KANDIDAT}`
  );
  keluar.cakupan = { dokumenKtp: Number(dok[0].dokumen), perkaraBerKtp: Number(dok[0].perkara), berkasTerunduh: Number(ber[0].berkas), isiUnik: Number(ber[0].isiUnik) };
  catat("== A. CAKUPAN ==");
  catat(`dokumen KTP e-Court ${keluar.cakupan.dokumenKtp} di ${keluar.cakupan.perkaraBerKtp} perkara; berkas terunduh ${keluar.cakupan.berkasTerunduh} (isi unik ${keluar.cakupan.isiUnik})`);

  if (!(await tabelAda(BOT, "aleta_bot_ktp_pihak"))) {
    keluar.catatan = "Tabel aleta_bot_ktp_pihak belum ada - penyapu latar portal/bot belum pernah berjalan.";
    catat(keluar.catatan);
    if (JSON_SAJA) console.log(JSON.stringify(keluar, null, 2));
    koneksi.end();
    return;
  }
  const status = await q(`SELECT status, sebab, yakin, COUNT(*) AS n FROM ${BOT}.aleta_bot_ktp_pihak GROUP BY status, sebab, yakin`);
  const total = status.reduce((a, r) => a + Number(r.n), 0);
  const terbaca = status.filter((r) => r.status === "terbaca").reduce((a, r) => a + Number(r.n), 0);
  const tidak = status.filter((r) => r.status !== "terbaca");
  keluar.dibaca = { barisTabel: total, terbaca, tidakTerbaca: tidak.reduce((a, r) => a + Number(r.n), 0), perSebab: {}, perYakin: {} };
  for (const r of tidak) keluar.dibaca.perSebab[r.sebab || "-"] = (keluar.dibaca.perSebab[r.sebab || "-"] || 0) + Number(r.n);
  for (const r of status.filter((x) => x.status === "terbaca")) keluar.dibaca.perYakin[r.yakin || "-"] = (keluar.dibaca.perYakin[r.yakin || "-"] || 0) + Number(r.n);
  const belum = await q(
    `SELECT COUNT(*) AS n FROM ${BOT}.aleta_bot_ecourt_documents d JOIN ${BOT}.aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN ${BOT}.aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1 WHERE ${K.SQL_KANDIDAT} AND k.file_id IS NULL`
  );
  keluar.dibaca.belumDibaca = Number(belum[0].n);
  const tanpaTanggal = await q(`SELECT COUNT(*) AS n FROM ${BOT}.aleta_bot_ktp_pihak WHERE status = 'terbaca' AND tanggal_ktp IS NULL`);
  const takBertuan = await q(`SELECT COUNT(*) AS n FROM ${BOT}.aleta_bot_ktp_pihak WHERE status = 'terbaca' AND cabang IS NULL`);
  keluar.dibaca.terbacaTanpaTanggalKtp = Number(tanpaTanggal[0].n);
  keluar.dibaca.terbacaTakBertuan = Number(takBertuan[0].n);
  catat(`baris tabel ${total}: terbaca ${terbaca} (${pct(terbaca, total)}), tidak terbaca ${keluar.dibaca.tidakTerbaca}, berkas belum dibaca ${keluar.dibaca.belumDibaca}`);
  catat(`  terbaca tanpa tanggal KTP ${keluar.dibaca.terbacaTanpaTanggalKtp}; terbaca tapi tak cocok pihak mana pun ${keluar.dibaca.terbacaTakBertuan}`);
  catat("  tidak terbaca per sebab:", JSON.stringify(keluar.dibaca.perSebab), "| terbaca per keyakinan:", JSON.stringify(keluar.dibaca.perYakin));

  // ---- B. ketepatan tanggal vs isian petugas ------------------------------------------------------------------
  const adaIsian = await tabelAda(ABT, "abt_data_tanggal");
  keluar.tanggal = { pembanding: 0, sama: 0, beda: 0, isianKosong: 0, perCocok: {}, selisihHari: [] };
  if (!adaIsian) {
    catat(`Basis data ABT (${ABT}) tidak terbaca - ketepatan tanggal tidak dapat diukur.`);
  } else {
    const baris = await q(
      `SELECT k.perkara_id, k.cabang, k.urutan, k.cocok, k.yakin, k.tanggal_ktp FROM ${BOT}.aleta_bot_ktp_pihak k
        WHERE k.status = 'terbaca' AND k.cabang IS NOT NULL AND k.tanggal_ktp IS NOT NULL AND k.yakin IN ('cukup','pasti')`
    );
    for (const b of baris) {
      const slot = SLOT_ISIAN[`${b.cabang}.${b.urutan}`];
      if (!slot) continue;
      const isian = await q(
        `SELECT no_var, data FROM ${ABT}.abt_data_tanggal WHERE perkara_id = ? AND no_var IN (${slot.map(() => "?").join(",")}) AND data > '1900-01-01' ORDER BY FIELD(no_var, ${slot.join(",")}) LIMIT 1`,
        [b.perkara_id, ...slot]
      );
      if (!isian.length) {
        keluar.tanggal.isianKosong += 1;
        continue;
      }
      keluar.tanggal.pembanding += 1;
      const per = (keluar.tanggal.perCocok[b.cocok] = keluar.tanggal.perCocok[b.cocok] || { sama: 0, beda: 0 });
      if (String(isian[0].data).slice(0, 10) === String(b.tanggal_ktp).slice(0, 10)) {
        keluar.tanggal.sama += 1;
        per.sama += 1;
      } else {
        keluar.tanggal.beda += 1;
        per.beda += 1;
        const hari = Math.round((Date.parse(String(b.tanggal_ktp).slice(0, 10)) - Date.parse(String(isian[0].data).slice(0, 10))) / 86400000);
        if (keluar.tanggal.selisihHari.length < 30) keluar.tanggal.selisihHari.push(hari);
      }
    }
    catat("== B. KETEPATAN TANGGAL vs ISIAN PETUGAS (ABT) ==");
    catat(
      `bacaan cukup/pasti: ${baris.length}; punya isian petugas pembanding ${keluar.tanggal.pembanding} -> SAMA ${keluar.tanggal.sama}, BEDA ${keluar.tanggal.beda}` +
        ` => ketepatan ${pct(keluar.tanggal.sama, keluar.tanggal.pembanding)}; isian petugas kosong (ALETA mengisi) ${keluar.tanggal.isianKosong}`
    );
    for (const [c, v] of Object.entries(keluar.tanggal.perCocok)) catat(`  cocok ${c}: sama ${v.sama}, beda ${v.beda} (${pct(v.sama, v.sama + v.beda)})`);
    if (keluar.tanggal.selisihHari.length) catat("  selisih hari (bacaan - isian) pada yang beda:", keluar.tanggal.selisihHari.join(", "));
  }

  // ---- C. salah cocok pihak ----------------------------------------------------------------------------------
  const kandidat = await q(
    `SELECT k.file_id, k.urut, k.perkara_id, k.nik, k.nama, k.tanggal_lahir, k.cabang, k.urutan, k.cocok
       FROM ${BOT}.aleta_bot_ktp_pihak k WHERE k.status = 'terbaca' AND k.perkara_id IS NOT NULL`
  );
  keluar.pihak = { diperiksa: 0, salahPasti: 0, ambiguBaru: 0, sesuaiNikUlang: 0, tidakAdaNikSipp: 0 };
  const cachePihak = new Map();
  const ambilPihak = async (perkaraId) => {
    if (cachePihak.has(perkaraId)) return cachePihak.get(perkaraId);
    const semua = [];
    for (const cabang of [1, 2, 3, 4]) {
      const rows = await q(
        `SELECT pp.urutan, pp.pihak_id, pp.nama, p.nomor_indentitas AS nik, p.tanggal_lahir FROM ${SIPP}.perkara_pihak${cabang} pp
           LEFT JOIN ${SIPP}.pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan`,
        [perkaraId]
      ).catch(() => []);
      for (const r of rows) {
        semua.push({ cabang, urutan: Number(r.urutan) || 1, pihakId: r.pihak_id, nama: r.nama || "", nik: String(r.nik || "").replace(/\D/g, ""), tanggalLahirIso: String(r.tanggal_lahir || "").slice(0, 10) });
      }
    }
    cachePihak.set(perkaraId, semua);
    return semua;
  };
  for (const r of kandidat.slice(0, 5000)) {
    const pihak = await ambilPihak(r.perkara_id);
    if (!pihak.length) continue;
    keluar.pihak.diperiksa += 1;
    const ulang = K.cocokkanKtp({ nik: r.nik, nama: r.nama, tanggalLahirIso: String(r.tanggal_lahir || "").slice(0, 10) }, pihak);
    if (r.cabang != null && ulang.pihak && (ulang.pihak.cabang !== Number(r.cabang) || ulang.pihak.urutan !== Number(r.urutan))) keluar.pihak.salahPasti += 1;
    else if (ulang.ambigu) keluar.pihak.ambiguBaru += 1;
    else if (ulang.pihak) keluar.pihak.sesuaiNikUlang += 1;
    if (!pihak.some((p) => p.nik)) keluar.pihak.tidakAdaNikSipp += 1;
  }
  catat("== C. PENCOCOKAN PIHAK ==");
  catat(
    `diperiksa ulang ${keluar.pihak.diperiksa}: pilihan tersimpan SAMA dengan pencocokan ulang ${keluar.pihak.sesuaiNikUlang}, BERBEDA (salah cocok) ${keluar.pihak.salahPasti},` +
      ` ambigu ${keluar.pihak.ambiguBaru}; perkara tanpa satu pun NIK di SIPP ${keluar.pihak.tidakAdaNikSipp}`
  );

  // ---- D. keputusan ------------------------------------------------------------------------------------------
  const n = keluar.tanggal.pembanding;
  const tepat = n ? keluar.tanggal.sama / n : 0;
  keluar.keputusan = {
    layakPasti: n >= 30 && tepat >= 0.95 && keluar.pihak.salahPasti === 0,
    alasan: n < 30 ? `pembanding baru ${n} (< 30) - belum cukup` : tepat < 0.95 ? `ketepatan ${(tepat * 100).toFixed(1)}% (< 95%)` : keluar.pihak.salahPasti ? "ada salah cocok pihak" : "memenuhi syarat",
  };
  catat("== D. KEPUTUSAN ==");
  catat(keluar.keputusan.layakPasti ? "LAYAK 'pasti': nyalakan ALETA_KTP_PIHAK_YAKIN=pasti lalu naikkan VERSI_KTP_PIHAK." : `TETAP 'cukup' - ${keluar.keputusan.alasan}.`);
  if (JSON_SAJA) console.log(JSON.stringify(keluar, null, 2));
  koneksi.end();
}

main().catch((galat) => {
  console.error("GAGAL:", galat && galat.message ? galat.message : galat);
  try {
    koneksi.end();
  } catch {
    /* sudah tertutup */
  }
  process.exit(1);
});
