#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR KONTAK-EC (11 Okt 2026, agen 5) - EMAIL & HP/WA DARI e-COURT - BACA SAJA
 * ============================================================================
 *
 *   node tools/ukur-kontak-ecourt.js [--sipp SIPP] [--bot aleta_bot] [--teks <folder>] [--contoh <berkas.json>]
 *
 * Di laptop (salinan 9 Okt):  node aleta_bot/tools/ukur-kontak-ecourt.js --sipp sipp_donggala
 *                              --teks D:/aleta-dev/kerja/penanda-jawaban/teks
 * Di server (container bot):  docker compose exec aleta_bot node tools/ukur-kontak-ecourt.js
 *   (memakai ALETA_BOT_DB_HOST/USER/PASSWORD dan ALETA_BOT_DB_SIPP_NAME dari .env.production)
 *
 * HANYA SELECT. Tidak menulis ke SIPP/ABT, tidak juga ke aleta_bot. Keluaran =
 * angka saja (tanpa alamat email/nomor); --contoh menulis contoh bersamaran
 * untuk diperiksa tangan.
 *
 * Yang diukur:
 *   A. perkara e-Court (perkara_efiling_id) dan isian email/telepon SIPP para
 *      pihak dan kuasanya (yang sudah diisi petugas / tersalin dari e-Court);
 *   B. persetujuan pihak e-Court (aleta_bot_ecourt_pihak) vs SIPP;
 *   C. surel akun pengunggah dokumen e-Court vs SIPP - menguji aturan
 *      "sisi berkuasa = surel kuasa, tanpa kuasa = surel pihak";
 *   D. kontak dari TEKS berkas (--teks: <aleta_bot_ecourt_files.id>.txt) vs
 *      SIPP: sama / beda / SIPP kosong / tanpa pemilik - ketepatan kepemilikan;
 *   E. berapa perkara e-Court punya email/HP terbaca dari e-Court, dan berapa
 *      kolom SIPP yang KOSONG dapat diusulkan.
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const K = require("../services/kontakEcourtService");

const argv = process.argv.slice(2);
const opsi = (nama, bawaan) => {
  const i = argv.indexOf(nama);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const SIPP = opsi("--sipp", process.env.ALETA_BOT_DB_SIPP_NAME || "SIPP");
const BOT = opsi("--bot", process.env.ALETA_BOT_INTERNAL_DB_NAME || process.env.ALETA_BOT_DB_NAME || "aleta_bot");
const TEKS = opsi("--teks", "");
const CONTOH = opsi("--contoh", "");
const HARI = Number(opsi("--hari", "0")) || 0;

if (!/^[A-Za-z0-9_]+$/.test(SIPP) || !/^[A-Za-z0-9_]+$/.test(BOT)) {
  console.error("Nama database tidak sah.");
  process.exit(2);
}

const koneksi = mysql.createConnection({
  host: process.env.ALETA_BOT_DB_SIPP_HOST || process.env.ALETA_BOT_DB_HOST || "127.0.0.1",
  port: Number(process.env.ALETA_BOT_DB_SIPP_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
  user: process.env.ALETA_BOT_DB_SIPP_USER || process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_SIPP_PASSWORD || process.env.ALETA_BOT_DB_PASSWORD || "",
  charset: "utf8mb4",
});
const q = (sql, p) => new Promise((ok, no) => koneksi.query(sql, p || [], (e, r) => (e ? no(e) : ok(r))));

function samarkan(nilai) {
  const s = String(nilai || "");
  if (s.includes("@")) return s.replace(/^(.).*?(.)@/, "$1***$2@");
  return s.length > 6 ? `${s.slice(0, 4)}****${s.slice(-2)}` : "****";
}

async function tabelAda(db, tabel) {
  const r = await q("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?", [db, tabel]);
  return Number(r[0].n) > 0;
}

async function bahan(perkaraId, nomor, adaPihakEc, adaDok) {
  const [pihak, kuasa] = await Promise.all([
    q(
      `SELECT 1 AS pihak_ke, pp.urutan, pp.pihak_id, pp.nama, p.email, p.telepon FROM ${SIPP}.perkara_pihak1 pp LEFT JOIN ${SIPP}.pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ?
       UNION ALL SELECT 2, pp.urutan, pp.pihak_id, pp.nama, p.email, p.telepon FROM ${SIPP}.perkara_pihak2 pp LEFT JOIN ${SIPP}.pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ?`,
      [perkaraId, perkaraId]
    ),
    q(
      `SELECT pa.pihak_ke, pa.urutan, pa.pengacara_id, pa.nama, p.email, p.telepon FROM ${SIPP}.perkara_pengacara pa LEFT JOIN ${SIPP}.pihak p ON p.id = pa.pengacara_id
        WHERE pa.perkara_id = ? AND (pa.aktif IS NULL OR pa.aktif = 'Y') AND pa.pihak_ke IN (1, 2)`,
      [perkaraId]
    ),
  ]);
  const ecourtPihak = adaPihakEc ? await q(`SELECT nama, peran, email, telp FROM ${BOT}.aleta_bot_ecourt_pihak WHERE nomor_perkara = ?`, [nomor]) : [];
  const pengunggah = adaDok
    ? await q(`SELECT DISTINCT peran_pengunggah AS peran, email_pengunggah AS email FROM ${BOT}.aleta_bot_ecourt_documents WHERE (perkara_id = ? OR nomor_perkara = ?) AND email_pengunggah <> ''`, [perkaraId, nomor])
    : [];
  return {
    pihak: pihak.map((b) => ({ pihakKe: Number(b.pihak_ke), urutan: Number(b.urutan) || 1, pihakId: b.pihak_id, nama: b.nama, email: b.email, telepon: b.telepon })),
    kuasa: kuasa.map((b) => ({ pihakKe: Number(b.pihak_ke), urutan: Number(b.urutan) || 1, pengacaraId: b.pengacara_id, nama: b.nama, email: b.email, telepon: b.telepon })),
    ecourtPihak,
    pengunggah,
  };
}

/** Bandingkan usulan satu sumber dengan isian SIPP. */
function hitung(hasil, wadah, contoh, nomor, labelSumber) {
  for (const o of hasil.orang) {
    for (const kolom of ["email", "hp"]) {
      const u = o.usulan[kolom];
      if (!u) continue;
      const k = `${o.jenis}-${kolom}`;
      wadah[k] = wadah[k] || { usulan: 0, sama: 0, beda: 0, sippKosong: 0, cukup: 0, ragu: 0 };
      wadah[k].usulan += 1;
      wadah[k][u.terhadapSipp === "kosong" ? "sippKosong" : u.terhadapSipp] += 1;
      wadah[k][u.keyakinan === "ragu" ? "ragu" : "cukup"] += 1;
      if (contoh && contoh.length < 200)
        contoh.push({ nomor, sumber: labelSumber, orang: `${o.jenis} ${o.pihakKe}.${o.urutan}`, kolom, usulan: samarkan(u.nilai), sipp: samarkan(kolom === "email" ? o.sipp.email : o.sipp.telepon), hasil: u.terhadapSipp, keyakinan: u.keyakinan, kutipan: (u.sumber[0] && u.sumber[0].kutipan ? u.sumber[0].kutipan : "").replace(/[A-Za-z0-9._%+-]+\s?@/g, "***@").replace(/(?:\+?62|0)8[\d\s.-]{7,}/g, "08****") });
    }
  }
  wadah.tanpaPemilik = (wadah.tanpaPemilik || 0) + hasil.tanpaPemilik.length;
}

async function main() {
  const adaPihakEc = await tabelAda(BOT, "aleta_bot_ecourt_pihak");
  const adaDok = await tabelAda(BOT, "aleta_bot_ecourt_documents");
  const adaFiles = await tabelAda(BOT, "aleta_bot_ecourt_files");
  const perkara = await q(
    `SELECT p.perkara_id, p.nomor_perkara FROM ${SIPP}.perkara_efiling_id e JOIN ${SIPP}.perkara p ON p.perkara_id = e.perkara_id
      WHERE e.efiling_id <> ''${HARI ? " AND p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL ? DAY)" : ""} ORDER BY p.perkara_id DESC`,
    HARI ? [HARI] : []
  );
  const A = { perkaraEcourt: perkara.length, pihak: { p1: 0, p1Email: 0, p1Hp: 0, p2: 0, p2Email: 0, p2Hp: 0 }, kuasa: { n: 0, email: 0, hp: 0 } };
  const B = {};
  const C = {};
  const E = { perkaraAdaKontakEcourt: 0, kolomSippKosongTerusulkan: 0, perkaraDenganKolomTerisi: 0 };
  const contoh = CONTOH ? [] : null;
  const bahanPer = new Map();
  for (const p of perkara) {
    const b = await bahan(p.perkara_id, p.nomor_perkara, adaPihakEc, adaDok);
    bahanPer.set(Number(p.perkara_id), { b, nomor: p.nomor_perkara });
    for (const x of b.pihak) {
      if (Number(x.urutan) !== 1) continue;
      const k = `p${x.pihakKe}`;
      A.pihak[k] += 1;
      if (K.bakuEmail(x.email)) A.pihak[`${k}Email`] += 1;
      if (K.nomorSipp(x.telepon).length) A.pihak[`${k}Hp`] += 1;
    }
    for (const x of b.kuasa) {
      A.kuasa.n += 1;
      if (K.bakuEmail(x.email)) A.kuasa.email += 1;
      if (K.nomorSipp(x.telepon).length) A.kuasa.hp += 1;
    }
    const hB = K.susunKontak({ pihak: b.pihak, kuasa: b.kuasa, ecourtPihak: b.ecourtPihak, ukur: true });
    hitung(hB, B, contoh, p.nomor_perkara, "persetujuan-pihak");
    const hC = K.susunKontak({ pihak: b.pihak, kuasa: b.kuasa, pengunggah: b.pengunggah, ukur: true });
    hitung(hC, C, contoh, p.nomor_perkara, "akun-pengunggah");
    const semua = K.susunKontak(b);
    const ada = semua.orang.some((o) => o.usulan.email || o.usulan.hp);
    if (ada) E.perkaraAdaKontakEcourt += 1;
    let terisi = false;
    for (const o of semua.orang)
      for (const kolom of ["email", "hp"]) {
        const u = o.usulan[kolom];
        if (u && u.terhadapSipp === "kosong" && u.keyakinan !== "ragu") {
          E.kolomSippKosongTerusulkan += 1;
          terisi = true;
        }
      }
    if (terisi) E.perkaraDenganKolomTerisi += 1;
  }

  // D. teks berkas
  const D = { berkas: 0, berkasTerpetakan: 0, perkara: 0, kontakTerbaca: 0 };
  if (TEKS && fs.existsSync(TEKS) && adaFiles) {
    const perkaraTeks = new Set();
    const perPerkara = new Map();
    for (const nama of fs.readdirSync(TEKS)) {
      if (!nama.endsWith(".txt") || nama.endsWith(".ocr.txt")) continue;
      D.berkas += 1;
      const id = nama.replace(/\.txt$/, "");
      const r = await q(
        `SELECT f.nomor_perkara, d.judul_dokumen, d.jenis_dokumen, d.peran_pengunggah FROM ${BOT}.aleta_bot_ecourt_files f
           LEFT JOIN ${BOT}.aleta_bot_ecourt_documents d ON d.document_key = f.document_key WHERE f.id = ? LIMIT 1`,
        [id]
      );
      if (!r.length) continue;
      const pk = await q(`SELECT perkara_id FROM ${SIPP}.perkara WHERE nomor_perkara = ? LIMIT 1`, [r[0].nomor_perkara]);
      if (!pk.length) continue;
      D.berkasTerpetakan += 1;
      const pid = Number(pk[0].perkara_id);
      perkaraTeks.add(pid);
      const teks = fs.readFileSync(path.join(TEKS, nama), "utf8");
      const peran = `${r[0].jenis_dokumen || ""} ${r[0].judul_dokumen || ""}`;
      const penuntutKode = /tergugat|termohon/i.test(r[0].peran_pengunggah || "") ? "0047" : /penggugat|pemohon/i.test(r[0].peran_pengunggah || "") ? "0046" : "";
      const daftar = perPerkara.get(pid) || [];
      daftar.push({ judul: r[0].judul_dokumen, peran, penuntutKode, teks });
      perPerkara.set(pid, daftar);
      D.kontakTerbaca += K.kontakDariTeks(teks, {}).length;
    }
    D.perkara = perkaraTeks.size;
    for (const [pid, dokumen] of perPerkara) {
      let ada = bahanPer.get(pid);
      if (!ada) {
        const pk = await q(`SELECT nomor_perkara FROM ${SIPP}.perkara WHERE perkara_id = ?`, [pid]);
        ada = { b: await bahan(pid, pk[0].nomor_perkara, false, false), nomor: pk[0].nomor_perkara };
      }
      const h = K.susunKontak({ pihak: ada.b.pihak, kuasa: ada.b.kuasa, dokumen, ukur: true });
      hitung(h, D, contoh, ada.nomor, "teks-berkas");
    }
  } else if (TEKS) {
    D.catatan = adaFiles ? `folder ${TEKS} tidak ada` : "tabel aleta_bot_ecourt_files tidak ada";
  } else {
    D.catatan = "tanpa --teks: berkas e-Court dibaca portal (PDF), tidak oleh alat ini. Siapkan teks <files.id>.txt lalu ulangi dengan --teks.";
  }

  const ringkas = {
    waktu: new Date().toISOString(),
    database: { sipp: SIPP, bot: BOT, tabelPersetujuanPihak: adaPihakEc, tabelDokumen: adaDok },
    A_isianSipp: A,
    B_persetujuanPihakEcourt: B,
    C_akunPengunggah: C,
    D_teksBerkas: D,
    E_manfaat: E,
    cara_baca:
      "sama/beda = usulan e-Court dibanding isian SIPP orang yang sama (ketepatan = sama/(sama+beda)); sippKosong = kolom SIPP kosong yang dapat diusulkan; tanpaPemilik = kontak yang pemiliknya tidak dapat dipastikan (tidak diusulkan).",
  };
  console.log(JSON.stringify(ringkas, null, 2));
  if (contoh) fs.writeFileSync(CONTOH, JSON.stringify(contoh, null, 2));
}

main()
  .catch((e) => {
    console.error(`Gagal: ${e.code || ""} ${e.message || e}`);
    process.exitCode = 1;
  })
  .finally(() => koneksi.end());
