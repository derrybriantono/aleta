// Ukur (BACA SAJA) pengisi keluarga anak (aleta_bot/services/isiOtomatisW2b/anak.js) atas perkara nyata di SIPP lokal sipp_donggala.
//   node abt-paket/w2b-keluarga-lain/alat/ukur_anak_isian.cjs [--tulis]
// Batas data (jujur): jenis anak mandiri 349/350/351/743 = 0 perkara; yang ada hanya petitum hak asuh dan nafkah anak di perkara cerai
// (346/347) dan Lain-Lain (369). Pembanding isian petugas (aps_badilag.abt_data_teks) hanya 5 perkara untuk 6071 dan 7 untuk 7778,
// jadi tidak ada kode yang memenuhi ambang gerbang (pembanding >= 20): semua tetap saran "ragu".
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..", "..");
const tulis = process.argv.includes("--tulis");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const A = require(path.join(akar, "aleta_bot", "services", "isiOtomatisW2b", "anak.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const angka = (t) => (String(t).match(/\d[\d.]{2,}/g) || []).map((x) => x.replace(/\./g, ""));

(async () => {
  const perkara = await q(
    `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.jenis_perkara_id AS jenis, p.posita, p.petitum
       FROM sipp_donggala.perkara p
      WHERE p.petitum LIKE '%nafkah%anak%' OR p.petitum LIKE '%anak%nafkah%' OR p.petitum LIKE '%hak asuh%' OR p.petitum LIKE '%hadhanah%'
         OR p.petitum LIKE '%hadanah%' OR p.petitum LIKE '%asuh%' OR p.petitum LIKE '%menyerahkan%anak%'`
  );
  const pembanding = {};
  for (const r of await q("SELECT no_var AS kode, perkara_id AS id, data FROM aps_badilag.abt_data_teks WHERE no_var IN (6071, 6072, 7778, 2004, 0709)")) {
    (pembanding[Number(r.kode)] = pembanding[Number(r.kode)] || {})[r.id] = r.data;
  }
  const ringkas = { perkaraDiperiksa: perkara.length, jenisAnakMandiri: {}, kode: {} };
  for (const j of [349, 350, 351, 743]) ringkas.jenisAnakMandiri[j] = (await q("SELECT COUNT(*) n FROM sipp_donggala.perkara WHERE jenis_perkara_id = ?", [j]))[0].n;
  const contoh = {};
  const hitung = (kode) => (ringkas.kode[kode] = ringkas.kode[kode] || { muncul: 0, banding: 0, cocok: 0 });
  for (const p of perkara) {
    // jenis cerai dipakai sebagai wadah posita/petitum: pembaca dipanggil langsung (usulanAnak hanya untuk jenis anak)
    const posita = p.posita || "";
    const petitum = p.petitum || "";
    const butir = (() => {
      try {
        return require(path.join(akar, "aleta_bot", "services", "petitumBerbutir.js")).petitumBerbutir(petitum, { posita, jenis: Number(p.jenis) }).butir || [];
      } catch {
        return [];
      }
    })();
    const hasil = {
      4890: A.bacaPenyerahan(butir),
      4899: A.bacaNominalNafkah(butir),
      4888: A.bacaAkses(butir, posita),
      4884: A.bacaKelayakan(posita),
      4901: A.bacaTakMampu(posita),
      4905: A.bacaMumayyizPerAnak(posita),
    };
    for (const [kode, u] of Object.entries(hasil)) {
      if (!u) continue;
      const h = hitung(kode);
      h.muncul += 1;
      (contoh[kode] = contoh[kode] || []).push({ perkara: p.nomor, nilai: u.nilai.slice(0, 160), kalimat: (u.sumber[0] && u.sumber[0].kalimat.slice(0, 160)) || "" });
      if (kode === "4899" && pembanding[6071] && pembanding[6071][p.id] !== undefined) {
        h.banding += 1;
        const angkaPetugas = angka(pembanding[6071][p.id]);
        if (angka(u.nilai).some((x) => angkaPetugas.includes(x))) h.cocok += 1;
      }
    }
  }
  ringkas.contoh = Object.fromEntries(Object.entries(contoh).map(([k, v]) => [k, v.slice(0, 6)]));
  ringkas.catatan = "Semua kode tetap 'ragu' (saran): pembanding isian petugas < 20 per kode. Angka muncul = jumlah perkara tempat pembaca menemukan bahan.";
  console.log(JSON.stringify(ringkas, null, 2));
  if (tulis) {
    const tujuan = path.join(akar, "docs", "gelombang2", "UKURAN-W2b-anak.json");
    fs.mkdirSync(path.dirname(tujuan), { recursive: true });
    fs.writeFileSync(tujuan, JSON.stringify(ringkas, null, 2) + "\n");
    console.log("ditulis", tujuan);
  }
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
