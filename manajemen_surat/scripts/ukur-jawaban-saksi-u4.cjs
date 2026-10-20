#!/usr/bin/env node
/**
 * Ukur pengisi jawaban saksi katalog DISPENSASI KAWIN / WALI ADHAL / PERWALIAN atas perkara nyata (data baca-saja).
 *
 *   node scripts/ukur-jawaban-saksi-u4.cjs [folder-data] [--rinci=<nomor>] [--json=<berkas>]
 *
 * folder-data berisi dk.json / wa.json / pw.json (nomor, posita, petitum) dan dk_sipp.json (baris perkara_mempelai_dk) bila ada.
 * Jalur: katalog (AletaBdKatalog.susun) -> muatan 'isi-jawaban' -> bot isiBaris. Dihitung per jenis: jumlah jawaban dasar yang masih
 * memuat penanda kosong ("..." / #kode# / {slot}) SEBELUM dan SESUDAH pengisi, dan sebaran keyakinan (yakin|cukup|ragu).
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const EKS = path.join(REPO, "ekstensi-sipp");
globalThis.window = globalThis;
require(path.join(EKS, "saksi-katalog.js"));
require(process.env.U4_DATA_KATALOG || path.join(EKS, "saksi-katalog-data.js"));
const Kat = require(path.join(EKS, "blangko-derry-katalog.js"));
const Svc = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiService.js"));
const Posita = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPosita.js"));

const argumen = process.argv.slice(2);
const DIR = argumen.find((a) => !a.startsWith("--")) || "D:/Aplikasi/aleta/tmp/u4";
const RINCI = (argumen.find((a) => a.startsWith("--rinci=")) || "").slice(8);
const JSON_KELUAR = (argumen.find((a) => a.startsWith("--json=")) || "").slice(7);

const JENIS = {
  dk: { id: "362", nama: "Dispensasi Kawin", berkas: "dk.json", sebP: "Pemohon", sebT: "Termohon" },
  wa: { id: "363", nama: "Wali Adhal", berkas: "wa.json", sebP: "Pemohon", sebT: "Termohon" },
  pw: { id: "354", nama: "Perwalian", berkas: "pw.json", sebP: "Pemohon", sebT: "Termohon" },
};
const masihKosong = (t) => /\.{3,}|…|#\d{3,5}#|\{[a-zA-Z0-9_]+\}/.test(String(t || ""));
const KAT = globalThis.ALETA_SAKSI_KATALOG_DATA;

function bacaSipp(kunci) {
  const p = path.join(DIR, `${kunci}_sipp.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

function ukurJenis(kunci) {
  const J = JENIS[kunci];
  const perkara = JSON.parse(fs.readFileSync(path.join(DIR, J.berkas), "utf8"));
  const sippSemua = bacaSipp(kunci);
  const hasil = { jenis: J.nama, perkara: perkara.length, baris: 0, kosongSebelum: 0, kosongSesudah: 0, terisi: 0, yakin: { yakin: 0, cukup: 0, ragu: 0 }, sisa: {}, rinci: [] };
  for (const p of perkara) {
    const kenal = Kat.kenali({ jenisPerkaraId: J.id, jenisPerkara: J.nama });
    if (!kenal || !kenal.kat) continue;
    // keadaan perkara menurut data (bawaan katalog); saksi 1 dan 2 pihak P
    const susunan = Kat.susun({
      kat: kenal.kat,
      sebutan: { P: J.sebP, T: J.sebT },
      benih: p.no,
      keadaan: p.keadaan || {},
      saksi: [
        { kunci: "saksi 1 p", pihak: "P", jenis: "melihat" },
        { kunci: "saksi 2 p", pihak: "P", jenis: "melihat" },
      ],
      variabel: () => "",
    });
    const sipp = sippSemua[p.id] || null;
    const saksiIsi = susunan.saksi.map((s, i) => ({
      kunci: s.kunci,
      ke: i + 1,
      modus: "melihat",
      sumberNama: "",
      baris: s.baris.filter((b) => b.jawab).map((b) => ({ kunci: b.kunciJawaban, tanya: b.tanya, jawab: b.jawab })),
    }));
    const diisi = Svc.isiBaris({ posita: p.posita, jenisPerkara: J.id, alur: "16", pelaku: J.sebT, lawan: J.sebP, isian: {}, sipp, saksiIsi });
    for (const s of saksiIsi) {
      for (const b of s.baris) {
        hasil.baris += 1;
        const kosong = masihKosong(b.jawab);
        if (kosong) hasil.kosongSebelum += 1;
        const r = diisi[`${b.kunci}@${s.kunci}`] || diisi[b.kunci];
        if (r) {
          hasil.terisi += 1;
          hasil.yakin[r.yakin] = (hasil.yakin[r.yakin] || 0) + 1;
          if (masihKosong(r.teks)) {
            hasil.kosongSesudah += 1;
            const k = b.tanya.replace(/#\d+#/g, "").slice(0, 60);
            hasil.sisa[k] = (hasil.sisa[k] || 0) + 1;
          }
          if (RINCI && p.no === RINCI) hasil.rinci.push(`[${s.kunci}] ${b.tanya.slice(0, 60)} => ${r.teks}  <${r.yakin}|${r.sumber}>`);
        } else if (kosong) {
          hasil.kosongSesudah += 1;
          const k = b.tanya.replace(/#\d+#/g, "").slice(0, 60);
          hasil.sisa[k] = (hasil.sisa[k] || 0) + 1;
        }
      }
    }
  }
  return hasil;
}

const SEBELUM_ATAU_BARU_SQL = new Set(["4409", "4405", "4406", "4407", "9205", "9200", "9202", "7036"]);

// ---------------------------------------------------------------------------------------------------------------------
// MODE ISIAN (--isian [--sebelum]): berapa jawaban dasar katalog yang SEMUA penanda #kode#-nya terisi otomatis (pasti/cukup),
// berapa yang hanya berupa saran "ragu", berapa yang masih menunggu ketikan petugas. --sebelum = tanpa modul U4.
// ---------------------------------------------------------------------------------------------------------------------
if (argumen.includes("--isian")) {
  const S5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisJenisS5.js"));
  const DK5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "dk.js"));
  const PW5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "perwalian.js"));
  const WA5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "waliAdhal.js"));
  const Deteksi = require(path.join(REPO, "aleta_bot", "services", "deteksi", "index.js"));
  const kamus = JSON.parse(fs.readFileSync(process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json", "utf8"));
  const SEBELUM = argumen.includes("--sebelum");
  const tsvm = (f) => (fs.existsSync(path.join(DIR, f)) ? fs.readFileSync(path.join(DIR, f), "utf8").split("\n").slice(1).filter(Boolean).map((l) => l.split("\t")) : []);
  const BS = String.fromCharCode(92);
  const buka = (x) => { let o = ""; for (let i = 0; i < x.length; i++) { if (x[i] === BS && i + 1 < x.length) { const n = x[i + 1]; if (n === "n") { o += "\n"; i++; continue; } if (n === "t") { o += "\t"; i++; continue; } if (n === BS) { o += BS; i++; continue; } } o += x[i]; } return o; };
  const mem = tsvm("sipp_dk_mempelai.tsv").map((c) => ({ perkara_id: c[0], nama: c[1], lahir: c[2], tempat: c[3], pendidikan: c[4], jenis: c[5], pekerjaan: c[6], nominal: c[7], dimohonkan: c[8] === "" ? null : c[8], nik: c[9] }));
  const SIPP_P1 = {};
  for (const j of ["362", "363", "354"]) SIPP_P1[j] = tsvm(`sipp_p1_${j}.tsv`).map((c) => ({ perkara_id: c[0], urutan: c[1], nama: c[2], tempat: c[3], lahir: c[4], statusKawin: c[5], pekerjaan: c[6], pendidikan: c[7], jk: c[8] }));
  const ringkas = {};
  const MULAI = process.env.U4_DARI || "2025-01-01";
  for (const kunci of Object.keys(JENIS)) {
    const J = JENIS[kunci];
    const rows = tsvm(`all_${J.id}.tsv`).map((c) => ({ id: c[0], no: c[1], tgl: c[2], alur: c[3], posita: buka(c[4]), petitum: buka(c[5]) })).filter((p) => p.tgl >= MULAI);
    const kenal = Kat.kenali({ jenisPerkaraId: J.id, jenisPerkara: J.nama });
    const hasil = { perkara: rows.length, jawaban: 0, otomatis: 0, saran: 0, menunggu: 0, kodeMenunggu: {} };
    for (const p of rows) {
      const d = { perkaraId: Number(p.id), perkara: { nomor: p.no, jenisId: Number(J.id), alurId: Number(p.alur), posita: p.posita, petitum: p.petitum, tanggalDaftar: p.tgl }, pihak1: SIPP_P1[J.id].filter((x) => x.perkara_id === p.id), pihak2: [], mempelai: mem.filter((x) => x.perkara_id === p.id), anak: [], nikah: null, itsbat: null, alasanNikah: [] };
      let usulan = [];
      if (SEBELUM) {
        if (kunci === "dk") usulan = DK5.usulanDk(d, {});
        if (kunci === "pw") usulan = PW5.usulanPerwalian(d);
        if (kunci === "wa") usulan = WA5.usulanWaliAdhal(d);
      } else usulan = S5.usulanDariData(d);
      for (const x of Deteksi.usulanModul(J.id, `${p.posita}\n${p.petitum}`, { petitum: p.petitum, tanggalDaftar: p.tgl })) {
        if (SEBELUM && String(x.kode).startsWith("44")) continue;
        usulan.push(x);
      }
      const nilai = {};
      for (const x of usulan) {
        const k = String(x.kode).padStart(4, "0");
        const lama = nilai[k];
        const rank = { pasti: 3, cukup: 2, ragu: 1 }[x.keyakinan] || 0;
        if (!lama || rank > lama.rank) nilai[k] = { rank, yakin: x.keyakinan };
      }
      const keadaan = kunci === "pw" ? { pemohonWali: require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "perwalian.js")).pemohonOrangTua(p.posita) === false ? "keluarga-lain" : "orang-tua-kandung" } : kunci === "dk" ? { jenisKelaminAnak: "perempuan" } : {};
      const sus = Kat.susun({ kat: kenal.kat, sebutan: { P: J.sebP, T: J.sebT }, benih: p.no, keadaan, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis: "melihat" }], variabel: () => "" });
      for (const b of sus.saksi[0].baris) {
        if (!b.jawab) continue;
        hasil.jawaban += 1;
        const perlu = (b.variabelAbt || []).filter((k) => !["0046", "0047"].includes(k)).filter((k) => {
          const t = (kamus[k] || {}).data_type;
          return !["data_sql", "data_sipp", "data_tanggal_sql"].includes(t) && !SEBELUM_ATAU_BARU_SQL.has(k);
        });
        const tanpa = perlu.filter((k) => !nilai[k]);
        const ragu = perlu.filter((k) => nilai[k] && nilai[k].rank < 2);
        if (!tanpa.length && !ragu.length) hasil.otomatis += 1;
        else if (!tanpa.length) hasil.saran += 1;
        else { hasil.menunggu += 1; for (const k of tanpa) hasil.kodeMenunggu[k] = (hasil.kodeMenunggu[k] || 0) + 1; }
      }
    }
    ringkas[kunci] = hasil;
    const pct = (n) => ((100 * n) / (hasil.jawaban || 1)).toFixed(1) + "%";
    console.log(`\n== ${J.nama} (${SEBELUM ? "SEBELUM U4" : "SESUDAH U4"}; perkara sejak ${MULAI}: ${hasil.perkara}; jawaban dasar ${hasil.jawaban}): terisi otomatis ${hasil.otomatis} (${pct(hasil.otomatis)}) | hanya saran ragu ${hasil.saran} (${pct(hasil.saran)}) | menunggu petugas ${hasil.menunggu} (${pct(hasil.menunggu)})`);
    const top = Object.entries(hasil.kodeMenunggu).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}${(kamus[k] && kamus[k].nama) ? "(" + kamus[k].nama.slice(0, 28) + ")" : ""}:${n}`);
    console.log("   penanda paling sering menunggu:", top.join(", "));
  }
  if (JSON_KELUAR) fs.writeFileSync(JSON_KELUAR, JSON.stringify(ringkas, null, 1));
  process.exit(0);
}

const semua = {};
for (const k of Object.keys(JENIS)) {
  if (!fs.existsSync(path.join(DIR, JENIS[k].berkas))) continue;
  semua[k] = ukurJenis(k);
  const h = semua[k];
  console.log(`\n== ${h.jenis}: ${h.perkara} perkara, ${h.baris} jawaban dasar | masih kosong sebelum ${h.kosongSebelum} (${((100 * h.kosongSebelum) / (h.baris || 1)).toFixed(1)}%) -> sesudah ${h.kosongSesudah} (${((100 * h.kosongSesudah) / (h.baris || 1)).toFixed(1)}%) | terisi pengisi ${h.terisi} | yakin ${JSON.stringify(h.yakin)}`);
  const sisa = Object.entries(h.sisa).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [t, n] of sisa) console.log(`   sisa ${String(n).padStart(4)}  ${t}`);
  for (const r of h.rinci) console.log("   ", r);
}
if (JSON_KELUAR) fs.writeFileSync(JSON_KELUAR, JSON.stringify(semua, null, 1));
