"use strict";

/**
 * ============================================================================
 * BAB 7 - GERBANG RAPOR APARATUR, DAN BAB 8 - KEUANGAN PERKARA
 * ============================================================================
 *
 * Gerbang ini adalah sifat pengaman paling penting pada seluruh aplikasi.
 * Syarat yang hanya tertulis pada dokumen rencana akan dilanggar pada hari
 * pertama seseorang membutuhkan angka untuk rapat - bukan karena niat buruk,
 * melainkan karena dokumen tidak menghalangi apa pun.
 *
 * Yang diuji di sini: gerbangnya benar-benar MENAHAN, dan menahannya dengan
 * cara yang tepat - nilai ditahan, data pekerjaannya tidak.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

/* penadah basis data bot - dipakai layanan catatan */
const jalurBot = require.resolve("../bot_db_config");
require("../bot_db_config");
require.cache[jalurBot].exports = { query: (s, p, cb) => cb(null, []) };

/* penadah SIPP - dipakai penilaian keuangan */
const kueri = [];
let barisPenadah = [];
const jalurDb = require.resolve("../db_config");
require("../db_config");
require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    kueri.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
    selesai(null, barisPenadah);
  },
};

const G = require("../services/gerbangRaporAparaturService");
const S = require("../services/sasaranKinerjaService");
const P = require("../services/penyandinganService");
const KU = require("../services/penilaianKeuanganService");
const K = require("../services/kerangkaPenilaianService");

const fs = require("fs");
const os = require("os");
const path = require("path");

function raporBuatan(ubah = {}) {
  return {
    kunci: "ketaatanTenggangPanggilan",
    judul: "Ketaatan Tenggang Pemanggilan",
    dimensi: "jurusita",
    ringkasPelaku: [
      { pelaku: "Anwar", terpenuhi: 384, penyebut: 384, nilai: 100, cukup: true },
      { pelaku: "Rusdin", terpenuhi: 300, penyebut: 396, nilai: 75.8, cukup: true },
      { pelaku: "Yusuf", terpenuhi: 384, penyebut: 384, nilai: 100, cukup: true },
    ],
    ...ubah,
  };
}

console.log("");
console.log("== Enam syarat ==");
periksa("enam syarat terdaftar", G.SYARAT.length === 6, String(G.SYARAT.length));
periksa("masing-masing menyebut alat, kalimat, dan sebabnya",
  G.SYARAT.every((s) => s.kunci && s.alat && s.kalimat && s.sebabnya && s.sebabnya.length > 40));
periksa("keenamnya berkunci berbeda", new Set(G.SYARAT.map((s) => s.kunci)).size === 6);

console.log("== Gerbang menahan ketika syaratnya belum lengkap ==");
{
  S.lupakanKetergantungan();
  const hasil = G.periksaSyarat(raporBuatan(), { penilaian: "ketaatanTenggangPanggilan" });
  periksa("belum boleh terbit", hasil.bolehTerbit === false);
  // Penyandingannya kosong - itulah yang menahan.
  periksa("sebabnya menyebut belum disandingkan",
    hasil.belum.some((b) => b.kunci === "sudahDisandingkan"), JSON.stringify(hasil.belum.map((b) => b.kunci)));
  periksa("hak jawab dan disposisi sudah terpenuhi",
    hasil.terpenuhi.some((s) => s.kunci === "hakJawab") && hasil.terpenuhi.some((s) => s.kunci === "disposisi"));
  periksa("rentang keyakinan terpenuhi", hasil.terpenuhi.some((s) => s.kunci === "rentangKeyakinan"));
}

console.log("== Penyebut kecil menahan gerbang ==");
{
  const hasil = G.periksaSyarat(
    raporBuatan({
      ringkasPelaku: [
        { pelaku: "Anwar", terpenuhi: 384, penyebut: 384, nilai: 100 },
        // Bernilai padahal penyebutnya tiga - inilah yang harus ditahan.
        { pelaku: "Halima", terpenuhi: 2, penyebut: 3, nilai: 66.7 },
      ],
    }),
    { penilaian: "ketaatanTenggangPanggilan" }
  );
  const s = hasil.belum.find((b) => b.kunci === "penyebutCukup");
  periksa("penyebut di bawah pembatas menahan", Boolean(s));
  periksa("dan menyebut siapa serta berapa", /Halima \(3\)/.test(s.keterangan), s.keterangan);
}

console.log("== Baris tanpa nilai tidak menahan gerbang ==");
{
  // Baris yang TIDAK bernilai tidak menuduh siapa pun; ia tidak boleh
  // menghalangi terbitnya rapor.
  const hasil = G.periksaSyarat(
    raporBuatan({
      ringkasPelaku: [
        { pelaku: "Anwar", terpenuhi: 384, penyebut: 384, nilai: 100 },
        { pelaku: "Halima", terpenuhi: 2, penyebut: 3, nilai: null },
      ],
    }),
    { penilaian: "ketaatanTenggangPanggilan" }
  );
  periksa("penyebut kecil tanpa nilai tidak menahan",
    !hasil.belum.some((b) => b.kunci === "penyebutCukup"), JSON.stringify(hasil.belum.map((b) => b.kunci)));
  periksa("jumlah baris bernilai dihitung benar", hasil.jumlahBarisBernilai === 1);
}

console.log("== Hulu yang keruh menahan, kecuali rapornya membawa lencana ==");
{
  S.lupakanKetergantungan();
  S.tetapkanHulu("waktuInput", "belumBersih", "tanggal penginputan yang belum ditelaah - 7.062 suntingan.");
  S.gantungkan("ketaatanTenggangPanggilan", ["waktuInput"]);

  const tanpaLencana = G.periksaSyarat(raporBuatan(), { penilaian: "ketaatanTenggangPanggilan" });
  periksa("hulu keruh menahan", tanpaLencana.belum.some((b) => b.kunci === "huluBersih"));
  periksa("dan menyebut keadaannya", /belumBersih/.test(tanpaLencana.belum.find((b) => b.kunci === "huluBersih").keterangan));

  const denganLencana = G.periksaSyarat(raporBuatan(), {
    penilaian: "ketaatanTenggangPanggilan",
    membawaLencanaHulu: true,
  });
  periksa("membawa lencana melepas syarat itu", !denganLencana.belum.some((b) => b.kunci === "huluBersih"));
  S.lupakanKetergantungan();
}

console.log("== Sesudah disandingkan, gerbang terbuka ==");
{
  const berkas = path.join(os.tmpdir(), `aleta-sanding-gerbang-${process.pid}.json`);
  fs.writeFileSync(
    berkas,
    JSON.stringify({
      baris: [
        {
          penilaian: "ketaatanTenggangPanggilan",
          jenis: "analisa",
          periode: "2026-08",
          angkaAleta: 97.8,
          angkaLuar: 97.8,
          sumberLuar: "hitungan tangan atas SIPP, kueri terlampir",
          disandingkanPada: "2026-09-01",
          olehSiapa: "Nama Petugas, Kepaniteraan Hukum",
        },
      ],
    }),
    "utf8"
  );
  const jalurAsal = process.env.ALETA_BOT_PENYANDINGAN_PATH;
  process.env.ALETA_BOT_PENYANDINGAN_PATH = berkas;
  delete require.cache[require.resolve("../services/penyandinganService")];
  delete require.cache[require.resolve("../services/gerbangRaporAparaturService")];
  const G2 = require("../services/gerbangRaporAparaturService");

  const hasil = G2.periksaSyarat(raporBuatan(), { penilaian: "ketaatanTenggangPanggilan" });
  periksa("seluruh syarat terpenuhi", hasil.bolehTerbit === true, JSON.stringify(hasil.belum.map((b) => b.kunci)));

  const terbit = G2.terbitkan(raporBuatan(), { penilaian: "ketaatanTenggangPanggilan" });
  periksa("rapornya terbit", terbit.terbit === true);
  periksa("nilainya utuh", terbit.rapor.ringkasPelaku.every((p) => p.nilai !== null));
  // Peringatan TETAP tampil walau seluruh syarat terpenuhi.
  periksa("peringatan tetap tampil walau syaratnya lengkap",
    /mengukur yang TERCATAT/.test(terbit.peringatan));
  periksa("dan menyebutnya bahan pembinaan, bukan dasar sanksi",
    /bukan dasar penjatuhan sanksi/.test(terbit.peringatan));

  fs.unlinkSync(berkas);
  if (jalurAsal === undefined) delete process.env.ALETA_BOT_PENYANDINGAN_PATH;
  else process.env.ALETA_BOT_PENYANDINGAN_PATH = jalurAsal;
  delete require.cache[require.resolve("../services/penyandinganService")];
  delete require.cache[require.resolve("../services/gerbangRaporAparaturService")];
}

console.log("== Ketika ditahan, yang ditahan hanya NILAINYA ==");
{
  const terbit = G.terbitkan(raporBuatan(), { penilaian: "ketaatanTenggangPanggilan" });
  periksa("tidak terbit", terbit.terbit === false);
  periksa("seluruh nilainya ditahan", terbit.rapor.ringkasPelaku.every((p) => p.nilai === null && p.nilaiDitahan === true));
  // Data pekerjaannya TIDAK disembunyikan - yang membaca tetap tahu apa yang
  // tercatat, hanya tidak diberi angka yang menuduh.
  periksa("tetapi penyebut dan terpenuhinya tetap terbaca",
    terbit.rapor.ringkasPelaku.every((p) => p.penyebut > 0 && p.terpenuhi >= 0));
  periksa("nama pelakunya tetap ada", terbit.rapor.ringkasPelaku.every((p) => p.pelaku));
  periksa("sebab ditahannya disebut satu per satu", Array.isArray(terbit.sebabDitahan) && terbit.sebabDitahan.length > 0);
  periksa("peringatan tetap tampil", /mengukur yang TERCATAT/.test(terbit.peringatan));
}

console.log("== Rapor yang tidak sah ditolak ==");
{
  [null, undefined, {}, { ok: false }, { ringkasPelaku: "bukan larik" }].forEach((r, i) => {
    const h = G.periksaSyarat(r, { penilaian: "x" });
    periksa(`rapor tidak sah ke-${i + 1} ditolak`, h.bolehTerbit === false);
  });
}

/* ==========================================================================
 * Bab 8 - keuangan perkara
 * ========================================================================== */
async function keuangan() {
  console.log("== Bab 8 - keuangan perkara ==");
  const RENTANG = { mulai: "2026-08-01", selesai: "2026-08-31" };

  kueri.length = 0;
  barisPenadah = [];
  await KU.barisPanjarTercatat(RENTANG);
  await KU.barisJurnalTidakMinus(RENTANG);
  periksa("dua kueri dijalankan", kueri.length === 2);
  periksa("keduanya diawali SELECT", kueri.every((k) => /^\s*SELECT/i.test(k.sql)));
  periksa("keduanya memakai rentangnya", kueri.every((k) => k.params[0] === RENTANG.mulai));
  periksa("tidak satu pun menyentuh ruas uraian yang berupa teks bebas",
    kueri.every((k) => !/\buraian\b/i.test(k.sql)),
    kueri.filter((k) => /\buraian\b/i.test(k.sql)).map((k) => k.sql.slice(0, 50)).join(" | "));

  barisPenadah = [
    { nomorPerkara: "1/Pdt.G/2026", tanggalDaftar: "2026-08-01", jumlahPenerimaan: 1, totalPenerimaan: 500000 },
    { nomorPerkara: "2/Pdt.G/2026", tanggalDaftar: "2026-08-02", jumlahPenerimaan: 0, totalPenerimaan: 0 },
  ];
  const panjar = await KU.barisPanjarTercatat(RENTANG);
  periksa("perkara berpanjar memenuhi", panjar[0].memenuhi === true);
  periksa("perkara tanpa panjar tidak memenuhi", panjar[1].memenuhi === false);

  barisPenadah = [
    { nomorPerkara: "1/Pdt.G/2026", masuk: 500000, keluar: 400000, transaksiTerakhir: "2026-08-20" },
    { nomorPerkara: "2/Pdt.G/2026", masuk: 300000, keluar: 350000, transaksiTerakhir: "2026-08-21" },
    { nomorPerkara: "3/Pdt.G/2026", masuk: 300000, keluar: 300000, transaksiTerakhir: "2026-08-22" },
  ];
  const jurnal = await KU.barisJurnalTidakMinus(RENTANG);
  periksa("pengeluaran di bawah penerimaan memenuhi", jurnal[0].memenuhi === true);
  periksa("pengeluaran melebihi penerimaan TIDAK memenuhi", jurnal[1].memenuhi === false);
  periksa("dan sisanya terbaca minus", jurnal[1].sisa === -50000);
  periksa("pengeluaran sama dengan penerimaan memenuhi", jurnal[2].memenuhi === true);

  K.lupakanSemua();
  KU.lupakan();
  const kunci = KU.daftarkanSemua();
  periksa("dua penilaian keuangan terdaftar", kunci.length === 2);
  periksa("keterangannya menyebut aturan jenis transaksi yang diwarisi",
    K.daftar().some((d) => /jenis transaksi 1/i.test(d.caraHitung.dikecualikan)));

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

keuangan().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
