// Ukur (baca saja) ketepatan PETITUM BERBUTIR (aleta_bot/services/petitumBerbutir.js) atas perkara nyata di salinan lokal SIPP.
//
//   node scripts/isi-sipp-abt/ukur-petitum-u6.cjs [--keluar <berkas.json>] [--maks <perkara>] [--sampel-lain <n>]
//
// Yang diukur (tanpa menulis apa pun):
//   1. cakupan  : persentase butir utama yang dikenali jenisnya (bukan "lain"), per jenis perkara;
//   2. kesesuaian jumlah : jumlah butir hasil = jumlah baris bernomor "1." "2)" pada petitum (dihitung terpisah, cara lain);
//   3. pembanding amar  : untuk perkara yang sudah diputus - jenis tuntutan accessoir yang dikenali di petitum
//      (nafkah iddah/mut'ah/madliyah/nafkah anak/hadhanah/harta bersama) dibandingkan dengan teks amar putusan
//      (perkara_putusan.amar_putusan / amar_putusan_text bila ada): "terkabul" = jenis yang sama tampil di amar.
//      Ini bukan mengukur keputusan hakim, hanya memastikan butir petitum yang dikenali memang berkaitan dengan amar lama.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(__dirname, "..", "..");
const keluar = arg("--keluar", "");
const maks = Number(arg("--maks", "4000"));
const sampelLain = Number(arg("--sampel-lain", "25"));
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { petitumBerbutir, JENIS_TUNTUTAN } = require(path.join(akar, "aleta_bot", "services", "petitumBerbutir.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: process.env.SIPP_DB || "sipp_donggala", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
const polos = (h) =>
  String(h || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:div|p|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ");

(async () => {
  const perkara = await q(
    `SELECT p.perkara_id id, p.jenis_perkara_id jenis, p.petitum, p.posita
       FROM perkara p WHERE p.tanggal_pendaftaran >= '2023-01-01' AND p.petitum IS NOT NULL AND LENGTH(p.petitum) > 20 ORDER BY p.perkara_id DESC LIMIT ${maks}`
  );
  const per = {};
  const jenisHitung = {};
  const lain = [];
  let totalButir = 0;
  let totalLain = 0;
  let cocokJumlah = 0;
  let perkaraAda = 0;
  let tanpaButir = 0;
  const accessoir = ["nafkah-iddah", "mutah", "nafkah-madliyah", "nafkah-anak", "hadhanah", "harta-bersama"];
  const amarPola = {
    "nafkah-iddah": /iddah|idah/i,
    mutah: /mut'?ah/i,
    "nafkah-madliyah": /madliyah|lampau|madhiyah/i,
    "nafkah-anak": /nafkah\s+(?:anak|untuk\s+anak)|biaya\s+(?:hidup|pemeliharaan)/i,
    hadhanah: /hadhanah|hak\s+asuh|asuhan|pemeliharaan\s+anak/i,
    "harta-bersama": /harta\s+bersama/i,
  };
  const banding = Object.fromEntries(accessoir.map((j) => [j, { petitum: 0, amar: 0 }]));
  for (const r of perkara) {
    perkaraAda++;
    const h = petitumBerbutir(r.petitum, { posita: r.posita, jenis: Number(r.jenis) });
    const j = (per[r.jenis] = per[r.jenis] || { perkara: 0, butirUtama: 0, lain: 0, tanpaButir: 0 });
    j.perkara++;
    if (!h.butir.length) {
      j.tanpaButir++;
      tanpaButir++;
      continue;
    }
    const bernomor = polos(r.petitum)
      .split("\n")
      .filter((b) => /^\s*(?:\d{1,2}\s*[.)]|\(\d{1,2}\))\s*\S/.test(b)).length;
    const utamaBernomor = h.butir.filter((b) => /^\d+$/.test(b.nomor)).length;
    if (bernomor === utamaBernomor) cocokJumlah++;
    for (const b of h.butir) {
      if (!b.utama || b.jenis === "subsider") continue;
      totalButir++;
      j.butirUtama++;
      jenisHitung[b.jenis] = (jenisHitung[b.jenis] || 0) + 1;
      if (b.jenis === "lain") {
        totalLain++;
        j.lain++;
        if (lain.length < 4000) lain.push(b.teks.slice(0, 200));
      }
    }
  }
  // pembanding amar atas perkara terputus
  try {
    const kol = await q("SHOW COLUMNS FROM perkara_putusan");
    const nama = kol.map((c) => c.Field);
    const kolAmar = ["amar_putusan", "amar_putusan_text", "amar", "isi_putusan"].find((k) => nama.includes(k));
    if (kolAmar) {
      const baris = await q(
        `SELECT p.perkara_id id, p.petitum, pp.${kolAmar} amar FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
          WHERE p.tanggal_pendaftaran >= '2023-01-01' AND LENGTH(p.petitum) > 20 AND pp.${kolAmar} IS NOT NULL AND LENGTH(pp.${kolAmar}) > 50 LIMIT 3000`
      );
      for (const r of baris) {
        const h = petitumBerbutir(r.petitum);
        const amar = polos(r.amar);
        for (const jn of accessoir) {
          if (h.utama.some((b) => b.jenis === jn)) {
            banding[jn].petitum++;
            if (amarPola[jn].test(amar)) banding[jn].amar++;
          }
        }
      }
    } else banding._catatan = "kolom amar putusan tidak ada di salinan lokal";
  } catch (e) {
    banding._catatan = `pembanding amar tidak terbaca: ${e.code || e.message}`;
  }
  // kelompokkan butir "lain" menurut bentuk (angka/nama diganti) untuk melihat pola tersisa
  const bentuk = {};
  for (const t of lain) {
    const k = t.toLowerCase().replace(/\d+/g, "#").replace(/\b[a-z]+ (?:bin|binti) [a-z ]+/g, "NAMA").slice(0, 60);
    bentuk[k] = (bentuk[k] || 0) + 1;
  }
  const lainTeratas = Object.entries(bentuk).sort((a, b) => b[1] - a[1]).slice(0, sampelLain);
  const hasil = {
    diukur: new Date().toISOString().slice(0, 10),
    perkara: perkaraAda,
    butirUtama: totalButir,
    dikenali: totalButir - totalLain,
    cakupanPersen: totalButir ? Math.round(((totalButir - totalLain) / totalButir) * 1000) / 10 : 0,
    perkaraTanpaButir: tanpaButir,
    jumlahButirSamaDenganBarisBernomor: { cocok: cocokJumlah, dari: perkaraAda - tanpaButir },
    perJenisButir: jenisHitung,
    perJenisPerkara: per,
    pembandingAmar: banding,
    butirLainTeratas: lainTeratas,
    labelJenis: JENIS_TUNTUTAN,
  };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
  console.log(JSON.stringify({ ...hasil, perJenisPerkara: undefined, labelJenis: undefined }, null, 1));
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
