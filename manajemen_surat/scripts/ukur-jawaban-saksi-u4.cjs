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
require(path.join(EKS, "saksi-katalog-data.js"));
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
