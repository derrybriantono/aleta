"use strict";

/**
 * ============================================================================
 * PENILAIAN KETAATAN - PINDAHAN DARI ANALISIS LAMA
 * ============================================================================
 *
 * Berjalan tanpa basis data: db_config diganti penadah yang memulangkan baris
 * buatan. Yang diuji BUKAN kebenaran angkanya terhadap SIPP - itu tugas uji
 * banding, dan uji banding menuntut SIPP yang tidak terjangkau dari mesin
 * pengembang. Yang diuji di sini:
 *
 *   - kuerinya membaca, dan hanya membaca;
 *   - rentang tanggalnya benar-benar dipakai, bukan diabaikan;
 *   - baris yang tanggalnya kosong DIBUANG, bukan dihitung sebagai nol hari;
 *   - kunci barisnya tetap sama antar penghitungan, sebab catatan tindak
 *     lanjut dan hak jawab melekat padanya;
 *   - hari kerja, bukan hari kalender - dan selisih keduanya ditandai.
 *
 * ============================================================================
 * PEMILAHAN 31 ANALISIS
 * ============================================================================
 *
 * Rencana menyebut "tiga puluh satu analisis dipindahkan ke bentuk baku
 * penilaian". Sesudah diperiksa satu per satu, hanya sembilan yang berupa
 * KETAATAN - yang punya jawaban benar. Sisanya deskriptif: sebaran umur pihak,
 * musim perkara, corong perkara, profil upaya hukum, kronologi. Memaksanya
 * masuk kerangka bernilai berarti mengarang skor atas hal yang tidak dapat
 * benar atau salah, lalu menuduh orang berdasarkan skor itu.
 *
 * Pemilahannya diperiksa di bawah supaya tidak berubah diam-diam.
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

/* --------------------------------------------------------------- penadah -- */
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

const P = require("../services/penilaianKetaatanService");
const K = require("../services/kerangkaPenilaianService");
const A = require("../services/analisaLanjutService");

const RENTANG = { mulai: "2026-08-01", selesai: "2026-08-31" };

/* ============================ pemilahan ============================ */
console.log("");
console.log("== Pemilahan 31 analisis ==");
{
  const KETAATAN = new Set([
    "tenggat",
    "kesehatan",
    "suntingan",
    "tenggang",
    "aturan",
    "mutuPertimbangan",
    "ecourt",
    "periksaPertimbangan",
    "berisiko",
  ]);
  const semua = A.DAFTAR_ANALISA.map((x) => x.kunci);
  periksa("tiga puluh satu analisis terbaca", semua.length === 31, `dapat ${semua.length}`);
  periksa("sembilan di antaranya berupa ketaatan", KETAATAN.size === 9);
  periksa(
    "kesembilannya memang ada pada daftar analisis",
    [...KETAATAN].every((k) => semua.includes(k)),
    [...KETAATAN].filter((k) => !semua.includes(k)).join(",")
  );
  const deskriptif = semua.filter((k) => !KETAATAN.has(k));
  periksa("dua puluh dua sisanya deskriptif", deskriptif.length === 22, `dapat ${deskriptif.length}`);
  console.log(`        deskriptif, TIDAK dipaksa menjadi nilai: ${deskriptif.join(", ")}`);
}

/* ============================ kueri membaca ============================ */
console.log("== Kuerinya membaca, dan memakai rentangnya ==");
async function utama() {
  kueri.length = 0;
  barisPenadah = [];
  await P.barisTenggangPanggilan(RENTANG);
  await P.barisAsasPenyelesaian(RENTANG);
  await P.barisPerubahanSesudahMinutasi(RENTANG);

  periksa("tiga kueri dijalankan", kueri.length === 3, `dapat ${kueri.length}`);
  periksa(
    "seluruhnya diawali SELECT",
    kueri.every((k) => /^\s*SELECT/i.test(k.sql)),
    kueri.filter((k) => !/^\s*SELECT/i.test(k.sql)).map((k) => k.sql.slice(0, 40)).join(" | ")
  );
  periksa(
    "tidak satu pun memuat kata kerja tulis",
    kueri.every((k) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE)\b/i.test(k.sql))
  );
  periksa(
    "rentang tanggalnya benar-benar diserahkan sebagai nilai, bukan disambung ke teks",
    kueri.every((k) => k.params.includes(RENTANG.mulai) && k.params.includes(RENTANG.selesai)),
    JSON.stringify(kueri.map((k) => k.params))
  );
  periksa(
    "tanggalnya tidak pernah muncul di dalam teks kueri",
    kueri.every((k) => !k.sql.includes(RENTANG.mulai) && !k.sql.includes(RENTANG.selesai))
  );
  periksa("seluruhnya berbatas jumlah baris", kueri.every((k) => /LIMIT \d+/.test(k.sql)));

  /* ================== KT01 tenggang panggilan ================== */
  console.log("== Tenggang panggilan: hari kerja, bukan hari kalender ==");
  {
    barisPenadah = [
      // Jumat ke Senin: tiga hari kalender, hanya satu hari kerja.
      { nomorPerkara: "1/Pdt.G/2026", sidangId: 11, pihakId: 21, tanggalRelaas: "2026-09-04", tanggalSidang: "2026-09-07", jurusita: "Rusdin" },
      // Senin ke Kamis: tiga hari kalender dan tiga hari kerja.
      { nomorPerkara: "2/Pdt.G/2026", sidangId: 12, pihakId: 22, tanggalRelaas: "2026-08-31", tanggalSidang: "2026-09-03", jurusita: "Yusuf" },
      // Sehari sebelumnya: jelas kurang.
      { nomorPerkara: "3/Pdt.G/2026", sidangId: 13, pihakId: 23, tanggalRelaas: "2026-09-02", tanggalSidang: "2026-09-03", jurusita: "Rusdin" },
      // Tanggal relaas kosong - harus DIBUANG, bukan dihitung nol hari.
      { nomorPerkara: "4/Pdt.G/2026", sidangId: 14, pihakId: 24, tanggalRelaas: null, tanggalSidang: "2026-09-03", jurusita: "Anwar" },
    ];
    const baris = await P.barisTenggangPanggilan(RENTANG);

    periksa("baris tanpa tanggal dibuang", baris.length === 3, `dapat ${baris.length}`);
    periksa("baris tanpa tanggal tidak muncul sebagai nol hari",
      !baris.some((b) => b.nomorPerkara === "4/Pdt.G/2026"));

    const jumatSenin = baris.find((b) => b.nomorPerkara === "1/Pdt.G/2026");
    periksa("Jumat ke Senin: tiga hari kalender", jumatSenin.tenggangHariKalender === 3);
    periksa("Jumat ke Senin: satu hari kerja", jumatSenin.tenggangHariKerja === 1);
    periksa("dan karena itu TIDAK memenuhi", jumatSenin.memenuhi === false);
    periksa("dan ditandai berbeda dengan hitungan lama", jumatSenin.bedaDenganHitunganLama === true);

    const seninKamis = baris.find((b) => b.nomorPerkara === "2/Pdt.G/2026");
    periksa("Senin ke Kamis memenuhi", seninKamis.memenuhi === true);
    periksa("dan tidak ditandai berbeda", seninKamis.bedaDenganHitunganLama === false);

    const sehari = baris.find((b) => b.nomorPerkara === "3/Pdt.G/2026");
    periksa("sehari sebelumnya tidak memenuhi", sehari.memenuhi === false);
    periksa("dan tidak ditandai berbeda, sebab hitungan lama pun menolaknya",
      sehari.bedaDenganHitunganLama === false);

    periksa("setiap baris punya penanda memenuhi berupa boolean",
      baris.every((b) => typeof b.memenuhi === "boolean"));
    periksa("kuncinya memuat nomor perkara, sidang, dan pihak",
      baris.every((b) => /#\d+#\d+$/.test(b.kunci)), baris[0].kunci);
    periksa("kuncinya tidak berulang", new Set(baris.map((b) => b.kunci)).size === baris.length);
    periksa("jurusitanya ikut, supaya rapor berjenjang dapat memecahnya",
      baris.every((b) => typeof b.jurusita === "string"));

    // Kunci harus TETAP SAMA pada penghitungan kedua - catatan tindak lanjut
    // dan hak jawab melekat padanya.
    const kedua = await P.barisTenggangPanggilan(RENTANG);
    periksa("kunci barisnya sama persis pada penghitungan kedua",
      JSON.stringify(baris.map((b) => b.kunci)) === JSON.stringify(kedua.map((b) => b.kunci)));
  }

  /* ================== KT02 asas lima bulan ================== */
  console.log("== Asas penyelesaian lima bulan ==");
  {
    barisPenadah = [
      { nomorPerkara: "10/Pdt.G/2026", tanggalDaftar: "2026-01-05", tanggalPutusan: "2026-03-05" },
      { nomorPerkara: "11/Pdt.G/2026", tanggalDaftar: "2026-01-05", tanggalPutusan: "2026-06-30" },
      { nomorPerkara: "12/Pdt.G/2026", tanggalDaftar: null, tanggalPutusan: "2026-06-30" },
    ];
    const baris = await P.barisAsasPenyelesaian(RENTANG);
    periksa("baris tanpa tanggal daftar dibuang", baris.length === 2);
    periksa("dua bulan memenuhi", baris.find((b) => b.nomorPerkara === "10/Pdt.G/2026").memenuhi === true);
    periksa("hampir enam bulan tidak memenuhi", baris.find((b) => b.nomorPerkara === "11/Pdt.G/2026").memenuhi === false);
    periksa("ambangnya ikut disimpan pada barisnya", baris.every((b) => b.ambangHari === 150));
    periksa("umurnya dihitung dalam hari", baris.find((b) => b.nomorPerkara === "10/Pdt.G/2026").umurHari === 59);
  }

  /* ================== KT03 suntingan sesudah minutasi ================== */
  console.log("== Putusan tidak diubah sesudah minutasi ==");
  {
    barisPenadah = [
      { nomorPerkara: "20/Pdt.G/2026", tanggalMinutasi: "2026-08-01", diubahPada: null },
      { nomorPerkara: "21/Pdt.G/2026", tanggalMinutasi: "2026-08-01", diubahPada: "2026-08-01" },
      { nomorPerkara: "22/Pdt.G/2026", tanggalMinutasi: "2026-08-01", diubahPada: "2026-09-26" },
      { nomorPerkara: "23/Pdt.G/2026", tanggalMinutasi: null, diubahPada: "2026-09-26" },
    ];
    const baris = await P.barisPerubahanSesudahMinutasi(RENTANG);
    periksa("baris tanpa tanggal minutasi dibuang", baris.length === 3);
    periksa("yang tidak pernah disunting memenuhi",
      baris.find((b) => b.nomorPerkara === "20/Pdt.G/2026").memenuhi === true);
    periksa("yang disunting pada hari yang sama memenuhi",
      baris.find((b) => b.nomorPerkara === "21/Pdt.G/2026").memenuhi === true);
    const jauh = baris.find((b) => b.nomorPerkara === "22/Pdt.G/2026");
    periksa("yang disunting lima puluh enam hari sesudahnya TIDAK memenuhi", jauh.memenuhi === false);
    periksa("dan jaraknya tercatat", jauh.hariSesudahMinutasi === 56, String(jauh.hariSesudahMinutasi));
  }

  /* ================== pendaftaran ke kerangka ================== */
  console.log("== Pendaftaran ke kerangka ==");
  {
    K.lupakanSemua();
    P.lupakan();
    const kunci = P.daftarkanSemua();
    periksa("tiga penilaian terdaftar", kunci.length === 3, kunci.join(","));
    periksa("seluruhnya lolos kontrak kerangka", K.daftar().length === 3);
    periksa("masing-masing menyebut cara hitungnya lengkap",
      K.daftar().every((d) =>
        ["pembilang", "penyebut", "dikecualikan", "tabelSumber", "ruasSumber"].every((k) => d.caraHitung[k])));
    periksa("masing-masing menyebut tabel SIPP yang dibaca",
      K.daftar().every((d) => /perkara/.test(d.caraHitung.tabelSumber)));
    periksa("mendaftarkan dua kali tidak melempar", (() => {
      try { P.daftarkanSemua(); return true; } catch (_) { return false; }
    })());

    barisPenadah = [
      { nomorPerkara: "1/Pdt.G/2026", sidangId: 11, pihakId: 21, tanggalRelaas: "2026-08-31", tanggalSidang: "2026-09-03", jurusita: "Rusdin" },
    ];
    const hasil = await K.jalankan("ketaatanTenggangPanggilan", "bulanan", "2026-09-06");
    periksa("dapat dijalankan lewat kerangka", hasil.ok === true);
    periksa("dua belas satuan bulanan", hasil.satuan.length === 12);
    periksa("cara hitungnya ikut dipulangkan", Boolean(hasil.caraHitung.pembilang));
    periksa("ambang tenggang panggilan ikut dipulangkan",
      hasil.ambangDipakai.some((a) => a.kunci === "tenggangPanggilan" && a.nilai === 3));
    periksa("penyebut satu di bawah pembatas, jadi nilainya null",
      hasil.satuan.every((s) => s.nilai === null));
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
