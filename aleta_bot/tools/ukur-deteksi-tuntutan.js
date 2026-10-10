#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR P4 - DETEKSI TUNTUTAN ACCESSOIR (10 Okt 2026, agen 3) - BACA SAJA
 * ============================================================================
 *
 *   node tools/ukur-deteksi-tuntutan.js [--keluar <folder>] [--teks <folder teks e-Court>]
 *
 * Hanya SELECT ke salinan lokal (MySQL XAMPP 127.0.0.1:3306, root tanpa sandi):
 *   sipp_donggala  perkara (posita, petitum), perkara_putusan (amar_putusan, status)
 *   aps_badilag    abt_data_teks (6054 iddah, 6055 mut'ah, 6071 nafkah anak, 7120 madliyah, 0007 anak)
 *
 * Yang diukur:
 *   A. Gugatan (posita + petitum SIPP = isi surat gugatan yang didaftarkan) vs
 *      amar putusan perkara yang SUDAH diputus: per jenis tuntutan
 *      n (terdeteksi di gugatan), dikuatkan amar, tidak disebut amar (diperiksa
 *      tangan: salah tangkap atau tuntutan yang memang tidak dikabulkan),
 *      amar menyebut tetapi gugatan tidak (terlewat / ex officio).
 *   B. Nominal: angka vs terbilang di teks yang sama (amar seluruh perkara dan
 *      gugatan) - ketepatan pengurai nominal; nominal amar vs isian ABT
 *      (6054/6055/6071/7120) - ketepatan pemilihan nominal per jenis.
 *   C. Berkas jawaban/rekonvensi e-Court yang ada di laptop (--teks), dibanding amar.
 *   D. 0007 "telah dikaruniai N orang anak" dari posita vs isian ABT.
 *
 * Tidak menulis apa pun ke SIPP/ABT. Contoh untuk diperiksa tangan ditulis ke
 * <keluar>/ukur-tuntutan-contoh.json.
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const T = require("../services/tuntutanDeteksiService");
const U = require("../services/abtUsulanService");

const argv = process.argv.slice(2);
const opsi = (nama, bawaan) => {
  const i = argv.indexOf(nama);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const KELUAR = opsi("--keluar", path.join(process.env.TEMP || ".", "ukur-tuntutan"));
const TEKS = opsi("--teks", "D:/aleta-dev/kerja/penanda-jawaban/teks");

const koneksi = mysql.createConnection({ host: "127.0.0.1", user: "root", charset: "utf8mb4" });
const q = (sql, p) => new Promise((ok, no) => koneksi.query(sql, p || [], (e, r) => (e ? no(e) : ok(r))));

// Penanda sederhana di amar (sengaja longgar dan TERPISAH dari kamus) - kebenaran pembanding.
const DI_AMAR = {
  mutah: /\bmu'?\s?t'?h?ah\b/i,
  iddah: /(?:^|[^a-z])'?(?:iddah|iddha|idah)\b/i,
  madliyah: /\bmad[hl]?iy?ah\b|\bmadiah\b|nafkah\s+(?:yang\s+)?(?:lampau|terh?utang|telah\s+lalu)/i,
  "nafkah-anak": /nafkah[^.;]{0,80}\banak|biaya\s+(?:hidup|pemeliharaan|pendidikan|hadh?anah)[^.;]{0,60}\banak/i,
  hadhanah: /hak\s+(?:asuh|hadh?[ao]nah|hadlon?ah|pemeliharaan|pengasuhan)|hadh?[ao]nah|hadlon?ah|(?:asuhan|pengasuhan|pemeliharaan)(?:\s+dan\s+(?:pengasuhan|pemeliharaan))?\s+(?:penggugat|tergugat|pemohon|termohon|ibu|ayah|bapak)/i,
  "harta-bersama": /harta\s+bersama|gono[\s-]*gini/i,
  mahar: /\bmahar\b/i,
};
const JENIS = T.URUT_JENIS;

function polos(t) {
  return T.rapikanTeks(String(t || "")).replace(/\s+/g, " ").trim();
}

function ukurNominalSendiri(teks, wadah) {
  for (const n of T.nominalDari(polos(teks))) {
    if (n.nilaiTerbilang === null || n.tanpaRp) continue;
    wadah.n += 1;
    if (n.cocok) wadah.cocok += 1;
    else if (wadah.contoh.length < 25) wadah.contoh.push(n.teks);
  }
}

async function main() {
  fs.mkdirSync(KELUAR, { recursive: true });
  const perkara = await q(
    `SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.alur_perkara_id, p.posita, p.petitum, pp.amar_putusan, s.nama AS status
       FROM sipp_donggala.perkara p
       JOIN sipp_donggala.perkara_putusan pp ON pp.perkara_id = p.perkara_id
       LEFT JOIN sipp_donggala.status_putusan s ON s.id = pp.status_putusan_id
      WHERE pp.amar_putusan IS NOT NULL AND LENGTH(pp.amar_putusan) > 20`
  );

  const hasil = {};
  for (const j of JENIS) hasil[j] = { n: 0, dikuatkanAmar: 0, tidakDiAmar: 0, amarTanpaGugatan: 0, nominalAda: 0, nominalSamaAmar: 0, nominalBedaAmar: 0, tidakDiAmarContoh: [], terlewatContoh: [] };
  const nominalAmar = { n: 0, cocok: 0, contoh: [] };
  const nominalGugatan = { n: 0, cocok: 0, contoh: [] };
  const amarPerJenis = {};
  for (const j of JENIS) amarPerJenis[j] = { amarMenyebut: 0, detektorAmar: 0, detektorAmarBernominal: 0 };

  for (const p of perkara) {
    const gugatan = `${polos(p.posita)}\n${polos(p.petitum)}`;
    const amar = polos(p.amar_putusan);
    ukurNominalSendiri(amar, nominalAmar);
    ukurNominalSendiri(gugatan, nominalGugatan);
    const dariGugatan = T.deteksiTuntutan(`${p.posita || ""}\n\n${p.petitum ? `PRIMAIR:\n${p.petitum}` : ""}`, { peran: "gugatan" }).tuntutan;
    const dariAmar = T.deteksiTuntutan(p.amar_putusan, { peran: "amar" }).tuntutan;
    const jenisG = new Set(dariGugatan.map((x) => x.jenis));
    const jenisA = new Set(dariAmar.map((x) => x.jenis));
    for (const j of JENIS) {
      const amarSebut = DI_AMAR[j].test(amar);
      if (amarSebut) amarPerJenis[j].amarMenyebut += 1;
      if (amarSebut && jenisA.has(j)) amarPerJenis[j].detektorAmar += 1;
      if (amarSebut && dariAmar.some((x) => x.jenis === j && x.nominal)) amarPerJenis[j].detektorAmarBernominal += 1;
      const h = hasil[j];
      if (jenisG.has(j)) {
        h.n += 1;
        const g = dariGugatan.find((x) => x.jenis === j);
        if (amarSebut) {
          h.dikuatkanAmar += 1;
          if (g.nominal) {
            h.nominalAda += 1;
            const a = dariAmar.find((x) => x.jenis === j && x.nominal);
            if (a) {
              if (a.nominal.nilai === g.nominal.nilai || a.nominal.total === g.nominal.nilai || a.nominal.nilai === g.nominal.total) h.nominalSamaAmar += 1;
              else h.nominalBedaAmar += 1;
            }
          }
        } else {
          h.tidakDiAmar += 1;
          h.tidakDiAmarContoh.push({ nomor: p.nomor_perkara, status: p.status, jenis: p.jenis_perkara_nama, kutipan: g.kutipan, nominal: g.nominal ? g.nominal.nilai : null });
        }
      } else if (amarSebut) {
        h.amarTanpaGugatan += 1;
        if (h.terlewatContoh.length < 40 && /tuntut|mohon|meminta|menghukum/i.test(gugatan)) {
          const k = gugatan.search(DI_AMAR[j]);
          h.terlewatContoh.push({ nomor: p.nomor_perkara, status: p.status, gugatan: k >= 0 ? gugatan.slice(Math.max(0, k - 120), k + 160) : "(gugatan tidak menyebut)" });
        }
      }
    }
  }

  // B2: nominal amar vs isian ABT
  const abt = await q(
    `SELECT t.no_var, t.perkara_id, t.data FROM aps_badilag.abt_data_teks t WHERE t.no_var IN (6054, 6055, 6071, 7120) AND LENGTH(t.data) > 3`
  );
  const VAR_JENIS = { 6054: "iddah", 6055: "mutah", 6071: "nafkah-anak", 7120: "madliyah" };
  const amarPer = new Map(perkara.map((p) => [Number(p.perkara_id), p]));
  const abtUkur = { n: 0, sama: 0, beda: [], tanpaAmar: 0, nonUang: 0 };
  for (const r of abt) {
    const jenis = VAR_JENIS[Number(r.no_var)];
    const nilaiAbt = T.nominalDari(polos(r.data));
    if (!nilaiAbt.length) {
      abtUkur.nonUang += 1;
      continue;
    }
    const p = amarPer.get(Number(r.perkara_id));
    if (!p) {
      abtUkur.tanpaAmar += 1;
      continue;
    }
    const a = T.deteksiTuntutan(p.amar_putusan, { peran: "amar" }).tuntutan.find((x) => x.jenis === jenis);
    abtUkur.n += 1;
    const harap = nilaiAbt.map((x) => x.nilai);
    const dapat = a && a.nominal ? [a.nominal.nilai, a.nominal.total, a.nominal.perBulan].filter(Boolean) : [];
    if (dapat.some((x) => harap.includes(x))) abtUkur.sama += 1;
    else abtUkur.beda.push({ nomor: p.nomor_perkara, var: r.no_var, abt: polos(r.data).slice(0, 160), amar: a ? a.kutipan : "(jenis tidak terdeteksi di amar)" });
  }

  // D: 0007 dari posita (jumlahAnakPosita) vs isian ABT
  const isi0007 = await q(`SELECT perkara_id, data FROM aps_badilag.abt_data_teks WHERE no_var = 7 AND LENGTH(data) > 3`);
  const positaPer = new Map();
  if (isi0007.length) {
    const ids = isi0007.map((r) => Number(r.perkara_id));
    for (const r of await q(`SELECT perkara_id, posita FROM sipp_donggala.perkara WHERE perkara_id IN (?)`, [ids])) positaPer.set(Number(r.perkara_id), r.posita);
  }
  const anakUkur = { n: 0, tepat: 0, kosong: 0, salah: [] };
  const angkaAbt = (s) => {
    const t = polos(s).toLowerCase();
    if (/belum|tidak/.test(t)) return 0;
    const m = /(\d{1,2})|\b(seorang|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/.exec(t);
    if (!m) return /dikaruni/.test(t) ? null : null;
    return m[1] ? Number(m[1]) : T.angkaDariTerbilang(m[2] === "seorang" ? "satu" : m[2]);
  };
  for (const r of isi0007) {
    const posita = positaPer.get(Number(r.perkara_id));
    if (!posita) continue;
    const harap = angkaAbt(r.data);
    if (harap === null) continue;
    const j = U.jumlahAnakPosita(U.kalimatPosita(posita));
    anakUkur.n += 1;
    if (!j.nilai) {
      anakUkur.kosong += 1;
      continue;
    }
    const dapat = /belum/.test(j.nilai) ? 0 : Number((/(\d+)/.exec(j.nilai) || [])[1]);
    if (dapat === harap) anakUkur.tepat += 1;
    else if (anakUkur.salah.length < 30) anakUkur.salah.push({ perkara_id: r.perkara_id, abt: r.data, posita: j.kalimat.slice(0, 200) });
  }

  // C: berkas e-Court lokal
  const ecourt = [];
  if (fs.existsSync(TEKS)) {
    const berkas = await q(
      `SELECT f.id, f.nomor_perkara, d.judul_dokumen, d.peran_pengunggah FROM aleta_bot.aleta_bot_ecourt_files f JOIN aleta_bot.aleta_bot_ecourt_documents d ON d.document_key = f.document_key`
    );
    const amarNomor = new Map(perkara.map((p) => [p.nomor_perkara, p]));
    const perPerkara = new Map();
    for (const b of berkas) {
      const nama = [path.join(TEKS, `${b.id}.txt`), path.join(TEKS, `${b.id}.ocr.txt`)].find((x) => fs.existsSync(x) && fs.statSync(x).size > 200);
      if (!nama) continue;
      const teks = fs.readFileSync(nama, "utf8");
      const peran = /gugat|permohonan/i.test(b.judul_dokumen) && !/jawab|replik|duplik|rekon/i.test(b.judul_dokumen) ? "gugatan" : /replik/i.test(b.judul_dokumen) && !/duplik/i.test(b.judul_dokumen) ? "replik" : /duplik/i.test(b.judul_dokumen) ? "duplik" : "jawaban";
      const h = T.deteksiTuntutan(teks, { peran, sebutan: { lawan: "Pemohon", pelaku: "Termohon" } });
      const k = b.nomor_perkara;
      if (!perPerkara.has(k)) perPerkara.set(k, { nomor: k, dokumen: [], jenis: new Set() });
      const e = perPerkara.get(k);
      e.dokumen.push({ judul: b.judul_dokumen, peran, tuntutan: h.tuntutan.map((x) => `${x.jenis}${x.nominal ? `=${x.nominal.total || x.nominal.nilai}` : ""}`) });
      for (const x of h.tuntutan) e.jenis.add(x.jenis);
    }
    for (const e of perPerkara.values()) {
      const p = amarNomor.get(e.nomor);
      const amar = p ? polos(p.amar_putusan) : "";
      const diAmar = JENIS.filter((j) => amar && DI_AMAR[j].test(amar));
      const dariAmar = p ? T.deteksiTuntutan(p.amar_putusan, { peran: "amar" }).tuntutan.map((x) => `${x.jenis}${x.nominal ? `=${x.nominal.total || x.nominal.nilai}` : ""}`) : [];
      ecourt.push({ nomor: e.nomor, diputus: Boolean(p), jenisBerkas: [...e.jenis], jenisAmar: diAmar, amar: dariAmar, dokumen: e.dokumen });
    }
  }

  const ringkas = {
    tanggal: new Date().toISOString(),
    sumber: "sipp_donggala + aps_badilag salinan lokal 9 Okt 2026 10.37 (baca saja)",
    perkaraDiputus: perkara.length,
    perJenis: Object.fromEntries(
      JENIS.map((j) => {
        const h = hasil[j];
        return [j, { n: h.n, dikuatkanAmar: h.dikuatkanAmar, tidakDiAmar: h.tidakDiAmar, amarTanpaGugatan: h.amarTanpaGugatan, nominalAda: h.nominalAda, nominalSamaAmar: h.nominalSamaAmar, nominalBedaAmar: h.nominalBedaAmar, ...amarPerJenis[j] }];
      })
    ),
    nominalAngkaVsTerbilang: { amar: { n: nominalAmar.n, cocok: nominalAmar.cocok }, gugatan: { n: nominalGugatan.n, cocok: nominalGugatan.cocok } },
    nominalAmarVsAbt: { n: abtUkur.n, sama: abtUkur.sama, beda: abtUkur.beda.length, tanpaAmar: abtUkur.tanpaAmar, bukanUang: abtUkur.nonUang },
    anak0007: { n: anakUkur.n, tepat: anakUkur.tepat, kosong: anakUkur.kosong, salah: anakUkur.n - anakUkur.tepat - anakUkur.kosong },
    ecourtLokal: ecourt.map((e) => ({ nomor: e.nomor, diputus: e.diputus, berkas: e.jenisBerkas, amar: e.jenisAmar })),
  };
  fs.writeFileSync(
    path.join(KELUAR, "ukur-tuntutan-contoh.json"),
    JSON.stringify(
      {
        tidakDiAmar: Object.fromEntries(JENIS.map((j) => [j, hasil[j].tidakDiAmarContoh])),
        terlewat: Object.fromEntries(JENIS.map((j) => [j, hasil[j].terlewatContoh])),
        nominalAmarTakCocok: nominalAmar.contoh,
        nominalGugatanTakCocok: nominalGugatan.contoh,
        abtBeda: abtUkur.beda,
        anakSalah: anakUkur.salah,
        ecourt,
      },
      null,
      1
    )
  );
  console.log(JSON.stringify(ringkas, null, 1));
  koneksi.end();
}

main().catch((e) => {
  console.error(e);
  koneksi.end();
  process.exit(1);
});
