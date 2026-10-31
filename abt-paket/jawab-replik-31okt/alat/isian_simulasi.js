"use strict";
// Isian simulasi (REKAAN - dokumen e-Court sungguhan tidak ada di laptop): naskah dari fixture jawab-replik-31okt.cjs lewat pemformat
// bot yang sama (isiGugatanService -> naskahJawabMenjawabService), ditulis sebagai SQL untuk basis SALINAN laptop.
// pakai: node isian_simulasi.js <basis salinan> > isian.sql
const path = require("path");
const AKAR = path.resolve(__dirname, "..", "..", "..");
const S = require(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F = require(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-replik-31okt.cjs"));
const db = process.argv[2] || "aps_badilag_w148";

const dok = (judul, teks, jenis, pengunggah, diunggah, peran) => ({ judul, peran, teks, jenis, pengunggah, penuntutKode: pengunggah === "Penggugat" ? "0046" : "0047", diunggah });
const PERKARA = [
  {
    id: 9826, // 324/Pdt.G/2026 cerai talak dengan rekonvensi (berkas sungguhan: jawaban+rekonvensi, replik+jawaban rekonvensi, duplik+replik rekonvensi, duplik rekonvensi, kesimpulan P dan T)
    sebutan: { lawan: "Pemohon", pelaku: "Termohon" },
    dokumen: [
      dok("Jawaban Konvensi dan Gugatan Rekonvensi", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-07-27", "jawaban"),
      dok("Replik Pemohon dan Jawab Rekonvensi Tergugat Rekonvensi", F.REPLIK_REKON, "Replik", "Penggugat", "2026-08-02", "replik"),
      dok("Duplik Konvensi dan Replik Rekonvensi", F.DUPLIK_REKON, "Duplik", "Tergugat", "2026-08-05", "duplik"),
      dok("Duplik Rekonvensi", F.REREPLIK, "Rereplik", "Penggugat", "2026-08-06", "duplik"),
      dok("Kesimpulan Pemohon", F.KESIMPULAN_P, "Kesimpulan", "Penggugat", "2026-08-27", "kesimpulan"),
      dok("KESIMPULAN TERMOHON", F.KESIMPULAN_T, "Kesimpulan", "Tergugat", "2026-08-27", "kesimpulan"),
    ],
  },
  {
    id: 9929, // 419/Pdt.G/2026 cerai gugat (berkas sungguhan: jawaban, replik, kesimpulan T dan P) - surat lengkap oleh kuasa, eksepsi
    sebutan: { lawan: "Penggugat", pelaku: "Tergugat" },
    dokumen: [
      dok("Jawaban dari Tergugat", F.JAWABAN_LENGKAP, "Jawaban", "Tergugat", "2026-08-11", "jawaban"),
      dok("Jawaban dari penggugat", F.REPLIK_REKON.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat"), "Replik", "Penggugat", "2026-08-19", "replik"),
      dok("Kesimpulan gugatan cerai", F.KESIMPULAN_P.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat").replace(/permohonan/g, "gugatan"), "Kesimpulan", "Penggugat", "2026-09-01", "kesimpulan"),
    ],
  },
  {
    id: 9806, // 308/Pdt.G/2026 harta bersama (berkas sungguhan: "EKSEPSI, JAWABAN DAN GUGATAN REKONVENSI DARI TERGUGAT")
    sebutan: { lawan: "Penggugat", pelaku: "Tergugat" },
    dokumen: [dok("EKSEPSI, JAWABAN DAN GUGATAN REKONVENSI DARI TERGUGAT", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-07-22", "jawaban")],
  },
  {
    id: 10225, // 656/Pdt.G/2026 kewarisan (tanpa berkas e-Court jawab-menjawab di arsip): surat rekaan
    sebutan: { lawan: "Penggugat", pelaku: "Tergugat" },
    dokumen: [dok("Jawaban Tergugat", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-10-01", "jawaban")],
  },
  {
    id: 9812, // 314/Pdt.G/2026 cerai talak - dipakai untuk blangko izin poligami kontradiktoir (naskah tertulis susulan #12035#)
    sebutan: { lawan: "Pemohon", pelaku: "Termohon" },
    dokumen: [dok("Jawaban dari Termohon 314 G", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-06-24", "jawaban")],
  },
];
// Petik dinetralkan seperti penyimpanan ekstensi (abtKlienNetralkanPetik: ' dan " -> U+2019), tersimpan di kolom latin1 ABT sebagai 0x92 (diukur: 29 isian di dump 28 Okt).
const hex = (s) => "0x" + Buffer.concat(String(s).split(/['"]/).flatMap((b, i) => (i ? [Buffer.from([0x92]), Buffer.from(b, "latin1")] : [Buffer.from(b, "latin1")]))).toString("hex");
const keluar = [`-- ISIAN SIMULASI REKAAN (bukan berkas sungguhan) untuk ${db}`];
for (const p of PERKARA) {
  const h = S.susunIsiGugatan({ dokumen: p.dokumen, sebutan: p.sebutan });
  const ambil = new Map();
  for (const u of h.usulan) {
    if (!/^(120\d\d|8436|8437|9881)$/.test(u.kode)) continue;
    const lama = ambil.get(u.kode);
    const pangkat = (x) => ({ pasti: 3, cukup: 2, ragu: 1 }[x.keyakinan] || 0);
    if (!lama || pangkat(u) > pangkat(lama)) ambil.set(u.kode, u);
  }
  for (const [kode, u] of ambil) {
    keluar.push(`REPLACE INTO ${db}.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (${Number(kode)}, ${p.id}, ${hex(u.nilai)}, 'simulasi');`);
  }
  process.stderr.write(`${p.id}: ${[...ambil.keys()].sort().join(" ")}\n`);
}
process.stdout.write(keluar.join("\n") + "\n");
