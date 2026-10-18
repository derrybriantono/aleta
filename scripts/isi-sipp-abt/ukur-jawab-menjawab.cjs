// Ukuran pengisi jawab-menjawab e-Court (JJ, 18 Okt 2026) atas salinan lokal. Hanya SELECT.
//
//   node scripts/isi-sipp-abt/ukur-jawab-menjawab.cjs docs/isi-sipp-abt/UKURAN-JAWAB-MENJAWAB.json
//
// Sumber: aleta_bot (salinan metadata arsip e-Court: jenis/judul/pengunggah SAJA - berkas PDF-nya tidak ada di laptop),
// aps_badilag (isian petugas ABT: abt_data_teks), sipp_donggala (perkara_id -> nomor). Yang diukur:
//   A. pengenalan jenis dari metadata (tanpa isi) atas semua dokumen arsip: berapa yang dikenali, berapa ragu;
//   B. 9881 "tertulis" - ramalan pengisi (ada berkas jawab-menjawab di e-Court?) lawan isian petugas, per perkara yang
//      punya metadata arsip DAN isian petugas;
//   C. 8436/8437/7084 - kebiasaan bunyi isian petugas (bahan perbandingan setelah berkas sungguhan terbaca di server).
// ISI berkas tidak dapat diukur di laptop; rencana ukur server ada di laporan JJ.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const J = require(path.join(akar, "aleta_bot", "services", "jawabMenjawabEcourtService.js"));

function kueri(db, sql) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, typeCast: (f) => f.string() });
  return new Promise((ok, gagal) => kon.query(sql, (e, r) => (kon.end(), e ? gagal(e) : ok(r))));
}

const PERAN = new Set(J.PERAN_JAWAB_MENJAWAB);

(async () => {
  const dok = await kueri("aleta_bot", "select nomor_perkara, jenis_dokumen, judul_dokumen, peran_pengunggah from aleta_bot_ecourt_documents");
  const hasil = { dibuat: new Date().toISOString().slice(0, 10), sumber: "salinan lokal aleta_bot / aps_badilag / sipp_donggala (hanya SELECT)" };

  // A. pengenalan dari metadata
  const jenisMasuk = dok.filter((d) => d.jenis_dokumen);
  const hitungPeran = {};
  let ragu = 0;
  let tanpaPihak = 0;
  const bertentangan = [];
  for (const d of jenisMasuk) {
    const k = J.kenaliJenis({ jenis: d.jenis_dokumen, judul: d.judul_dokumen, pengunggah: d.peran_pengunggah, penuntutKode: /tergugat|termohon/i.test(d.peran_pengunggah) && !/turut/i.test(d.peran_pengunggah) ? "0047" : /penggugat|pemohon/i.test(d.peran_pengunggah) ? "0046" : "" });
    hitungPeran[k.peran || "(tak dikenal)"] = (hitungPeran[k.peran || "(tak dikenal)"] || 0) + 1;
    if (k.ragu) {
      ragu += 1;
      bertentangan.push(`${d.jenis_dokumen} / "${d.judul_dokumen}" -> ${k.peran}`);
    }
    if (PERAN.has(k.peran) && !k.pihak && !k.turut) tanpaPihak += 1;
  }
  hasil.A_metadata = {
    dokumenArsip: dok.length,
    berjenisJawabMenjawab: jenisMasuk.length,
    perPeran: hitungPeran,
    raguKarenaJenisLawanJudul: ragu,
    pihakTakDikenal: tanpaPihak,
    contohBertentangan: bertentangan.slice(0, 12),
    catatan: "Dokumen berjenis kosong (mayoritas: gugatan, kuasa, bukti, KTP) tidak ikut; jenis kosong dibaca dari judul hanya bila judulnya memuat kata jawaban/replik/duplik/kesimpulan.",
  };
  const perPerkara = new Map();
  for (const d of dok) {
    const k = J.kenaliJenis({ jenis: d.jenis_dokumen, judul: d.judul_dokumen, pengunggah: d.peran_pengunggah });
    // Pengisi mengusulkan 9881 bila ada satu saja berkas yang dikenali (yang ragu pun - tingkatnya saja yang turun).
    if (PERAN.has(k.peran)) perPerkara.set(d.nomor_perkara, (perPerkara.get(d.nomor_perkara) || 0) + 1);
  }
  const adaDokumen = new Set(dok.map((d) => d.nomor_perkara));
  hasil.A_metadata.perkaraDenganArsip = adaDokumen.size;
  hasil.A_metadata.perkaraDenganJawabMenjawab = perPerkara.size;

  // B. 9881 lawan isian petugas
  const abt = await kueri("aps_badilag", "select no_var, perkara_id, data from abt_data_teks where no_var in (9881,8436,8437,7084)");
  const ids = [...new Set(abt.map((r) => r.perkara_id))];
  const per = await kueri("sipp_donggala", `select perkara_id, nomor_perkara from perkara where perkara_id in (${ids.join(",") || 0})`);
  const nomor = Object.fromEntries(per.map((r) => [r.perkara_id, r.nomor_perkara]));
  const b = { petugas9881: 0, terukur: 0, cocok: 0, tidakCocok: [], tanpaMetadataArsip: 0 };
  for (const r of abt.filter((x) => x.no_var === "9881")) {
    b.petugas9881 += 1;
    const n = nomor[r.perkara_id];
    if (!adaDokumen.has(n)) {
      b.tanpaMetadataArsip += 1;
      continue;
    }
    b.terukur += 1;
    const ramalan = perPerkara.has(n) ? "tertulis" : "";
    const petugas = String(r.data).trim();
    if ((ramalan === "tertulis") === (petugas === "tertulis")) b.cocok += 1;
    else b.tidakCocok.push({ perkara: n, petugas, ramalan: ramalan || "(tidak diisi)" });
  }
  hasil.B_9881 = { ...b, catatan: "terukur = perkara yang punya isian petugas 9881 DAN metadata arsip e-Court di laptop; sisanya tidak dapat dinilai." };

  // C. kebiasaan bunyi petugas
  const POLA_TETAP = /^tetap pada (?:gugatan|permohonan) semula untuk bercerai dengan (?:Tergugat|Termohon|Penggugat|Pemohon)$/i;
  const c = {};
  for (const kode of ["8436", "8437", "7084"]) {
    const baris = abt.filter((x) => x.no_var === kode);
    const isi = baris.filter((x) => String(x.data).trim());
    c[kode] = {
      baris: baris.length,
      berisi: isi.length,
      persisBunyiBawaan: kode === "7084" ? isi.filter((x) => String(x.data).trim() === "1").length : isi.filter((x) => POLA_TETAP.test(String(x.data).trim())).length,
      lain: isi.filter((x) => (kode === "7084" ? String(x.data).trim() !== "1" : !POLA_TETAP.test(String(x.data).trim()))).map((x) => String(x.data).trim().slice(0, 80)),
    };
  }
  const arsip8436 = abt.filter((x) => x.no_var === "8436").map((x) => ({ nomor: nomor[x.perkara_id], arsip: adaDokumen.has(nomor[x.perkara_id]), jawabMenjawabDiArsip: perPerkara.has(nomor[x.perkara_id]) }));
  hasil.C_kebiasaanPetugas = { ...c, perkara8436: arsip8436, catatan: "Bunyi bawaan ABT 8436: 'tetap pada gugatan semula untuk bercerai dengan <pihak>'. Isi surat kesimpulan belum dapat dibandingkan karena PDF-nya tidak ada di laptop." };

  const keluar = process.argv[2];
  if (keluar) fs.writeFileSync(keluar, `${JSON.stringify(hasil, null, 2)}\n`);
  console.log(JSON.stringify(hasil, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
