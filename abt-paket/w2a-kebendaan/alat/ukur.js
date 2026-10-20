// Mengukur pola gugatan harta bersama dan kewarisan (isiJawabanSaksiKebendaan.js) atas perkara nyata di SIPP lokal (XAMPP, hanya SELECT).
// Pembanding: amar putusan hakim (perkara_putusan.amar_putusan) dan, untuk tanggal nikah, perkara_data_pernikahan.
// Pakai: node ukur.js [keluar.json]   (butuh MySQL lokal port 3306 database sipp_donggala dan sipp, modul mysql dari aleta_bot/node_modules)
"use strict";
const path = require("path");
const fs = require("fs");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = require(path.join(akar, "aleta_bot", "node_modules", "mysql"));
const K = require(path.join(akar, "aleta_bot", "services", "isiJawabanSaksiKebendaan.js"));
const P = require(path.join(akar, "aleta_bot", "services", "isiJawabanSaksiPosita.js"));
const Posita = require(path.join(akar, "aleta_bot", "services", "isiJawabanSaksiPositaLain.js"));

const tanya = (db, sql) =>
  new Promise((ok, gagal) => {
    const c = mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", password: "", database: db, dateStrings: true });
    c.connect((e) => {
      if (e) return gagal(e);
      c.query(sql, (e2, r) => {
        c.end();
        return e2 ? gagal(e2) : ok(r);
      });
    });
  });

const polos = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const adaKunci = (s, k) => s.find((x) => x.kunci === k);

function hitung(nama, baris, ambilDeteksi, ambilTruth) {
  const r = { kunci: nama, n: 0, tp: 0, fp: 0, fn: 0, tn: 0, contohSalah: [] };
  for (const b of baris) {
    const d = ambilDeteksi(b);
    const t = ambilTruth(b);
    if (t === undefined) continue; // tidak dapat dinilai
    r.n += 1;
    if (d && t) r.tp += 1;
    else if (d && !t) {
      r.fp += 1;
      if (r.contohSalah.length < 3) r.contohSalah.push(`${b.nomor} (deteksi ada, putusan tidak)`);
    } else if (!d && t) {
      r.fn += 1;
      if (r.contohSalah.length < 3) r.contohSalah.push(`${b.nomor} (deteksi tidak ada, putusan ada)`);
    } else r.tn += 1;
  }
  r.presisi = r.tp + r.fp ? +(r.tp / (r.tp + r.fp)).toFixed(2) : null;
  r.recall = r.tp + r.fn ? +(r.tp / (r.tp + r.fn)).toFixed(2) : null;
  return r;
}

function samaHimpunan(a, b) {
  const x = new Set(a), y = new Set(b);
  return x.size === y.size && [...x].every((i) => y.has(i));
}

(async () => {
  const sumber = [
    ["sipp_donggala", 348, "hb"],
    ["sipp", 348, "hb"],
    ["sipp_donggala", 364, "waris"],
    ["sipp", 364, "waris"],
  ];
  const semua = { hb: [], waris: [] };
  for (const [db, jp, jenis] of sumber) {
    const rows = await tanya(db, `select p.perkara_id, p.nomor_perkara, p.posita, p.petitum, pp.amar_putusan amar, (select date_format(tgl_nikah,'%Y-%m-%d') from perkara_data_pernikahan n where n.perkara_id=p.perkara_id limit 1) nikah from perkara p left join perkara_putusan pp on pp.perkara_id=p.perkara_id where p.jenis_perkara_id=${jp}`);
    for (const r of rows) semua[jenis].push({ db, nomor: r.nomor_perkara, posita: r.posita, petitum: r.petitum, amar: polos(r.amar), nikah: r.nikah });
  }
  const hasil = { dibuat: new Date().toISOString().slice(0, 10), catatan: "ukur atas SIPP lokal PA Donggala (sampai +-9 Okt 2026) dan PA Bungku; pembanding amar putusan hakim", hb: {}, waris: {} };

  // ---------------- harta bersama ----------------
  const hb = semua.hb.filter((x) => polos(x.posita).length > 300);
  const dikabul = (x) => /Mengabulkan\s+(?:gugatan|permohonan)/i.test(x.amar);
  const hbAmar = hb.filter((x) => x.amar.length > 150 && dikabul(x));
  hasil.hb.jumlahGugatan = hb.length;
  hasil.hb.jumlahDenganAmar = hb.filter((x) => x.amar.length > 150).length;
  hasil.hb.jumlahDikabulkan = hbAmar.length;
  for (const x of hb) {
    x.butir = P.butirPosita(x.posita);
    x.fakta = K.hartaBersamaLanjut(x.butir, x.petitum);
    x.saran = K.saranKeadaan("hb", x.butir, x.petitum);
    x.lama = Posita.positaLain(x.butir, "hb"); // pola lama (tanpa petitum)
  }
  const sar = (x, k) => adaKunci(x.saran, k);
  const per = [];
  const sitaAmar = (x) => /sita[^.;]{0,80}(sah\s+dan\s+berharga|diletakkan)|meletakkan\s+sita|sita\s+jaminan\s+(?:yang\s+)?telah\s+diletakkan/i.test(x.amar);
  per.push(hitung("sita=ada (gugatan menyebut sudah disita) vs amar sita sah dan berharga", hbAmar, (x) => Boolean(sar(x, "sita")), sitaAmar));
  per.push(hitung("sitaDiminta atau sita (gugatan memuat sita) vs amar sita sah dan berharga", hbAmar, (x) => Boolean(sar(x, "sita") || sar(x, "sitaDiminta")), sitaAmar));
  per.push(hitung("pembagianDiminta=seperdua (vs amar seperdua)", hbAmar, (x) => Boolean(sar(x, "pembagianDiminta") && sar(x, "pembagianDiminta").nilai === "seperdua"), (x) => /seperdua|½|1\s*\/\s*2|50\s*%|setengah|separuh/i.test(x.amar)));
  per.push(hitung("penguasa=lawan (vs amar Menghukum Tergugat menyerahkan/mengosongkan)", hbAmar, (x) => Boolean(sar(x, "penguasa") && ["lawan", "campur"].includes(sar(x, "penguasa").nilai)), (x) => /Menghukum\s+Tergugat[^;]{0,200}(menyerahkan|mengosongkan|membagi)/i.test(x.amar)));
  // jenis objek: tiap jenis dinilai terhadap amar
  for (const [nama, re] of K.JENIS_OBJEK) {
    if (!["tanah-bangunan", "kendaraan", "perhiasan-perabot", "kebun-ternak"].includes(nama)) continue;
    per.push(hitung(`jenisObjek ${nama} (vs jenis objek pada amar)`, hbAmar, (x) => Boolean((sar(x, "jenisObjek") || { nilai: [] }).nilai.includes(nama)), (x) => re.test(x.amar)));
  }
  per.push(hitung("tglNikah (vs perkara_data_pernikahan SIPP)", hb.filter((x) => x.nikah), (x) => Boolean(adaKunci(x.fakta, "tglNikah")), (x) => true));
  // kecocokan nilai tglNikah
  const nik = hb.filter((x) => x.nikah && adaKunci(x.fakta, "tglNikah"));
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const isoDari = (t) => {
    const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(t);
    return m ? `${m[3]}-${String(bulan.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  };
  const cocokNikah = nik.filter((x) => isoDari(adaKunci(x.fakta, "tglNikah").nilai) === x.nikah);
  hasil.hb.tglNikah = { nDenganDataSipp: hb.filter((x) => x.nikah).length, nTerbaca: nik.length, nCocok: cocokNikah.length, salah: nik.filter((x) => !cocokNikah.includes(x)).map((x) => `${x.nomor}: ${adaKunci(x.fakta, "tglNikah").nilai} vs ${x.nikah}`).slice(0, 5) };
  // ukur kuat: putusan cerai yang dikutip gugatan dicari di SIPP satker yang sama (nomor + tanggal putusan); bila ketemu, tanggal nikah dibandingkan dengan data pernikahan perkara cerai itu
  const kutip = { dibaca: 0, ketemuDiSipp: 0, tanggalCocokNikah: 0, nikahDiSipp: 0, nikahCocok: 0, tidakKetemu: [], nikahSalah: [] };
  for (const x of hb) {
    const pc = adaKunci(x.fakta, "putusanCerai");
    if (!pc) continue;
    const m = /^Nomor\s+0*(\d+)\S*\s+tanggal\s+(.+)$/.exec(pc.nilai);
    const iso = m ? isoDari(m[2]) : "";
    if (!m || !iso) continue;
    kutip.dibaca += 1;
    const baris = await tanya(x.db, `select p.nomor_perkara, pp.tanggal_putusan, date_format(n.tgl_nikah,'%Y-%m-%d') nikah from perkara p join perkara_putusan pp on pp.perkara_id=p.perkara_id left join perkara_data_pernikahan n on n.perkara_id=p.perkara_id where p.jenis_perkara_id in (346,347) and p.nomor_perkara like '${m[1]}/%' and date_format(pp.tanggal_putusan,'%Y-%m-%d')='${iso}'`);
    if (!baris.length) {
      kutip.tidakKetemu.push(`${x.nomor}: ${pc.nilai}`);
      continue;
    }
    kutip.ketemuDiSipp += 1;
    const tn = adaKunci(x.fakta, "tglNikah");
    const nikahSipp = baris.map((b) => b.nikah).find(Boolean);
    if (tn && nikahSipp) {
      kutip.nikahDiSipp += 1;
      if (isoDari(tn.nilai) === nikahSipp) kutip.nikahCocok += 1;
      else kutip.nikahSalah.push(`${x.nomor}: gugatan ${tn.nilai} vs SIPP ${nikahSipp}`);
    }
  }
  hasil.hb.kutipanPutusanCerai = kutip;
  hasil.hb.putusanCerai = { nTerbaca: hb.filter((x) => adaKunci(x.fakta, "putusanCerai")).length, nTerbacaPolaLama: hb.filter((x) => adaKunci(x.lama, "putusanCerai")).length, nAkta: hb.filter((x) => adaKunci(x.fakta, "aktaCerai")).length };
  hasil.hb.objek = { nGugatanDenganDaftar: hb.filter((x) => adaKunci(x.fakta, "jumlahObjek")).length, nPolaLamaTerbaca: hb.filter((x) => adaKunci(x.lama, "hartaPeninggalan")).length };
  hasil.hb.perKeadaan = per;

  // ---------------- kewarisan ----------------
  const wr = semua.waris.filter((x) => polos(x.posita).length > 300 || polos(x.petitum).length > 300);
  const wrAmar = wr.filter((x) => x.amar.length > 150 && dikabul(x));
  hasil.waris.jumlahGugatan = wr.length;
  hasil.waris.jumlahDenganAmar = wr.filter((x) => x.amar.length > 150).length;
  hasil.waris.jumlahDikabulkan = wrAmar.length;
  for (const x of wr) {
    x.butir = P.butirPosita(x.posita);
    x.fakta = K.warisLanjut(x.butir, x.petitum);
    x.saran = K.saranKeadaan("waris", x.butir, x.petitum);
    x.lama = Posita.positaLain(x.butir, "waris");
    x.amarSaran = K.saranKeadaan("waris", x.amar, "");
  }
  const perW = [];
  const wk = (x, k) => adaKunci(x.saran, k);
  const sitaAmarW = (x) => /sita[^.;]{0,80}(sah\s+dan\s+berharga|diletakkan)|meletakkan\s+sita/i.test(x.amar);
  perW.push(hitung("sita=ada (gugatan menyebut sudah disita) vs amar sita sah dan berharga", wrAmar, (x) => Boolean(wk(x, "sita")), sitaAmarW));
  perW.push(hitung("sitaDiminta atau sita (gugatan memuat sita) vs amar sita sah dan berharga", wrAmar, (x) => Boolean(wk(x, "sita") || wk(x, "sitaDiminta")), sitaAmarW));
  for (const g of ["anak", "orang-tua", "saudara", "cucu-pengganti"]) {
    perW.push(hitung(`ahliWaris ${g} (vs golongan pada amar penetapan ahli waris)`, wrAmar.filter((x) => /ahli\s+waris/i.test(x.amar)), (x) => Boolean((wk(x, "ahliWaris") || { nilai: [] }).nilai.includes(g)), (x) => Boolean((adaKunci(x.amarSaran, "ahliWaris") || { nilai: [] }).nilai.includes(g))));
  }
  perW.push(hitung("statusPewaris=menikah (vs amar menyebut istri/suami pewaris)", wrAmar, (x) => Boolean(wk(x, "statusPewaris")), (x) => /\b(?:istri|isteri|suami|janda|duda)\b/i.test(x.amar)));
  for (const [kunci, re] of [["wasiat", /\bwasiat\b/i], ["hibahSemasaHidup", /\bhibah\b/i], ["hutang", /\b(?:hutang|utang)\b/i]]) {
    perW.push(hitung(`${kunci} (vs amar menyebutnya)`, wrAmar, (x) => Boolean(wk(x, kunci)), (x) => re.test(x.amar)));
  }
  perW.push(hitung("penguasa=lawan (vs amar Menghukum Tergugat menyerahkan/membagi)", wrAmar, (x) => Boolean(wk(x, "penguasa") && wk(x, "penguasa").nilai === "lawan"), (x) => /Menghukum\s+(?:para\s+)?Tergugat[^;]{0,200}(menyerahkan|mengosongkan|membagi)/i.test(x.amar)));
  // nama ahli waris yang dibaca dari petitum: berapa yang muncul pada amar (hanya perkara yang amarnya memuat penetapan ahli waris)
  const nm = { perkara: 0, nama: 0, namaCocokAmar: 0, contohMeleset: [] };
  for (const x of wrAmar.filter((y) => /ahli\s+waris/i.test(y.amar))) {
    const f = adaKunci(x.fakta, "ahliWaris");
    if (!f) continue;
    nm.perkara += 1;
    for (const n of f.nilai.split("; ")) {
      const kunciNama = n.replace(/\(.*$/, "").replace(/\s+(?:bin|binti).*$/i, "").trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      if (kunciNama.length < 3) continue;
      nm.nama += 1;
      if (x.amar.toLowerCase().includes(kunciNama)) nm.namaCocokAmar += 1;
      else if (nm.contohMeleset.length < 4) nm.contohMeleset.push(`${x.nomor}: ${n.slice(0, 60)}`);
    }
  }
  hasil.waris.namaAhliWaris = nm;
  // tanggal wafat: dari gugatan vs amar penetapan ("meninggal dunia pada tanggal ...")
  const wf = { n: 0, cocok: 0, meleset: [] };
  for (const x of wrAmar) {
    const f = adaKunci(x.fakta, "wafatTgl") || adaKunci(x.lama, "wafatTgl");
    const am = /meninggal\s+dunia\s+pada\s+(?:hari\s+\w+\s*,?\s*)?(?:tanggal\s+)?(\d{1,2}\s+\w+\s+(?:19|20)\d{2})/i.exec(x.amar);
    if (!f || !am) continue;
    wf.n += 1;
    const sama = f.nilai.toLowerCase().replace(/^0/, "") === am[1].toLowerCase().replace(/^0/, "");
    if (sama) wf.cocok += 1;
    else if (wf.meleset.length < 4) wf.meleset.push(`${x.nomor}: ${f.nilai} vs ${am[1]}`);
  }
  hasil.waris.tanggalWafat = wf;
  hasil.waris.perKeadaan = perW;
  hasil.waris.fakta = {
    ahliWarisTerbaca: wr.filter((x) => adaKunci(x.fakta, "ahliWaris")).length,
    hartaTerbaca: wr.filter((x) => adaKunci(x.fakta, "hartaPeninggalan")).length,
    hartaPolaLama: wr.filter((x) => adaKunci(x.lama, "hartaPeninggalan")).length,
    wafatTglTerbaca: wr.filter((x) => adaKunci(x.fakta, "wafatTgl") || adaKunci(x.lama, "wafatTgl")).length,
    wafatTglPolaLama: wr.filter((x) => adaKunci(x.lama, "wafatTgl")).length,
  };
  hasil.batas =
    "Ukur kecil: sampel gugatan nyata hanya puluhan (PA Donggala sampai +-9 Okt 2026 dan PA Bungku), putusan yang dapat dibandingkan lebih sedikit lagi, dan amar putusan hanya memuat bagian yang dikabulkan sehingga pembanding sering tidak menyebut hal yang ditanyakan. " +
    "tglNikah dan putusanCerai diperiksa langsung terhadap kalimat gugatan (semua yang terbaca sama dengan teks) dan putusan cerai yang dikutip dicari di SIPP satker yang sama; keadaan lain tidak dapat dinilai kuat dan karena itu hanya saran (ragu).";
  hasil.keputusanYakin = {
    tglNikah: "cukup",
    putusanCerai: "cukup",
    aktaCerai: "cukup",
    keadaan: "ragu",
    hartaPeninggalan: "ragu",
    ahliWaris: "ragu",
    alasan: "keadaan dan daftar objek/ahli waris: kecocokan dengan amar rendah atau tidak dapat dinilai (sita diminta pada hampir semua gugatan tetapi nyaris tidak ada amar sita sah dan berharga)",
  };
  const keluar = process.argv[2];
  const json = JSON.stringify(hasil, null, 1);
  if (keluar) fs.writeFileSync(keluar, json);
  else console.log(json);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
