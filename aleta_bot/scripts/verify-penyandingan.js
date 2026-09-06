"use strict";

/**
 * ============================================================================
 * CATATAN PENYANDINGAN HARUS DAPAT DIPERCAYA
 * ============================================================================
 *
 * Catatan penyandingan adalah satu-satunya bukti bahwa sebuah angka pernah
 * diperiksa dari luar ALETA. Bila catatan itu sendiri boleh berisi apa saja,
 * seluruh gunanya hilang - dan hilangnya diam-diam, sebab catatan yang salah
 * tampak persis sama dengan catatan yang benar.
 *
 * Yang dipaksakan di sini:
 *
 *   - setiap baris menyebut penilaian, jenis, periode, kedua angkanya, sumber
 *     angka luarnya, tanggal, dan siapa yang menyandingkan;
 *   - tanggalnya sah dan tidak berada di masa depan;
 *   - kedua angkanya bilangan yang terhingga;
 *   - bila kedua angkanya BERBEDA, sebab selisihnya wajib tertulis. Selisih
 *     tanpa penjelasan adalah cara paling halus menyimpan kesalahan: ia
 *     tercatat, tampak seperti pekerjaan yang sudah dilakukan, dan tidak
 *     seorang pun kembali kepadanya;
 *   - sumber angka luarnya bukan kalimat kosong seperti "sudah dicek" -
 *     harus menyebut cara yang dapat diperiksa ulang orang lain;
 *   - tidak ada penilaian dan periode yang sama dicatat dua kali dengan angka
 *     yang berbeda.
 *
 * Penjaga ini juga menguji DIRINYA SENDIRI atas catatan buatan, sebab pada 7
 * September 2026 catatan sungguhannya masih kosong - server pengadilan tidak
 * terjangkau, jadi belum ada satu pun angka SIPP yang dapat disandingkan.
 * Penjaga yang belum pernah menolak apa pun belum terbukti dapat menolak.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const WAJIB = [
  "penilaian",
  "jenis",
  "periode",
  "angkaAleta",
  "angkaLuar",
  "sumberLuar",
  "disandingkanPada",
  "olehSiapa",
];

const JENIS_SAH = new Set(["analisa", "penilaian-sk", "rubrik", "lipa"]);

/** Kalimat yang menyatakan sesuatu sudah diperiksa tanpa menyebut caranya. */
const SUMBER_KOSONG = /^(sudah( di)?(cek|periksa|sanding)|ok|oke|benar|sesuai|cocok|-{1,3}|\.*)$/i;

function hari(t) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(t || ""));
}

function angka(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Memeriksa satu catatan. Memulangkan daftar cela; kosong berarti sah.
 * Dipakai untuk catatan sungguhan maupun catatan buatan pada uji diri.
 */
function celaCatatan(catatan, hariIni) {
  const cela = [];
  if (!catatan || typeof catatan !== "object") return ["catatan bukan objek"];
  if (!Array.isArray(catatan.baris)) return ["catatan tidak punya larik baris"];

  const terlihat = new Map();

  catatan.baris.forEach((b, i) => {
    const tunjuk = `baris ${i + 1}`;
    if (!b || typeof b !== "object") {
      cela.push(`${tunjuk}: bukan objek`);
      return;
    }

    WAJIB.forEach((k) => {
      const nilai = b[k];
      const kosong =
        nilai === undefined ||
        nilai === null ||
        (typeof nilai === "string" && nilai.trim() === "");
      if (kosong) cela.push(`${tunjuk}: ruas wajib "${k}" kosong`);
    });

    if (b.jenis && !JENIS_SAH.has(String(b.jenis))) {
      cela.push(`${tunjuk}: jenis "${b.jenis}" tidak dikenali`);
    }

    if (b.disandingkanPada !== undefined) {
      if (!hari(b.disandingkanPada)) {
        cela.push(`${tunjuk}: tanggal "${b.disandingkanPada}" bukan YYYY-MM-DD`);
      } else if (String(b.disandingkanPada) > hariIni) {
        cela.push(`${tunjuk}: tanggal ${b.disandingkanPada} berada di masa depan`);
      }
    }

    const a = angka(b.angkaAleta);
    const l = angka(b.angkaLuar);
    if (b.angkaAleta !== undefined && a === null) cela.push(`${tunjuk}: angkaAleta bukan bilangan`);
    if (b.angkaLuar !== undefined && l === null) cela.push(`${tunjuk}: angkaLuar bukan bilangan`);

    if (a !== null && l !== null && a !== l) {
      const sebab = String(b.sebabSelisih || "").trim();
      if (!sebab) {
        cela.push(
          `${tunjuk}: angkanya berbeda (${a} lawan ${l}) tetapi sebabSelisih kosong`
        );
      } else if (sebab.length < 15) {
        cela.push(`${tunjuk}: sebabSelisih terlalu pendek untuk menjelaskan apa pun`);
      }
    }

    const sumber = String(b.sumberLuar || "").trim();
    if (sumber && (SUMBER_KOSONG.test(sumber) || sumber.length < 12)) {
      cela.push(
        `${tunjuk}: sumberLuar "${sumber}" tidak menyebut cara yang dapat diperiksa ulang`
      );
    }

    const kunci = `${b.penilaian}|${b.periode}`;
    if (terlihat.has(kunci)) {
      const sebelumnya = terlihat.get(kunci);
      if (angka(sebelumnya.angkaAleta) !== a || angka(sebelumnya.angkaLuar) !== l) {
        cela.push(`${tunjuk}: ${kunci} sudah dicatat dengan angka yang berbeda`);
      }
    } else {
      terlihat.set(kunci, b);
    }
  });

  return cela;
}

const HARI_INI = new Date().toISOString().slice(0, 10);

async function utama() {
  console.log("");
  console.log("== Catatan sungguhan ==");

  const layanan = require("../services/penyandinganService");
  periksa("berkas catatan ada", fs.existsSync(layanan.JALUR), layanan.JALUR);

  let catatan = null;
  try {
    catatan = JSON.parse(fs.readFileSync(layanan.JALUR, "utf8"));
    periksa("catatan dapat diurai sebagai JSON", true);
  } catch (galat) {
    periksa("catatan dapat diurai sebagai JSON", false, galat.message);
  }

  if (catatan) {
    const cela = celaCatatan(catatan, HARI_INI);
    periksa(
      `${(catatan.baris || []).length} baris catatan seluruhnya sah`,
      cela.length === 0,
      cela.slice(0, 5).join(" | ")
    );
    periksa("catatan memuat keterangan bentuk barisnya", Boolean(catatan.bentukBaris));
  }

  console.log("");
  console.log("== Uji diri - penjaga ini harus menolak yang cacat ==");

  const HARUS_DITOLAK = [
    ["ruas wajib kosong", { baris: [{ penilaian: "tenggang", jenis: "analisa", periode: "2026-08", angkaAleta: 1, angkaLuar: 1, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "" }] }],
    ["jenis tidak dikenali", { baris: [{ penilaian: "x", jenis: "karangan", periode: "2026-08", angkaAleta: 1, angkaLuar: 1, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "A" }] }],
    ["tanggal bukan YYYY-MM-DD", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 1, angkaLuar: 1, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "1 Sep 2026", olehSiapa: "A" }] }],
    ["tanggal di masa depan", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 1, angkaLuar: 1, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2099-01-01", olehSiapa: "A" }] }],
    ["angka bukan bilangan", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: "sekitar 90", angkaLuar: 90, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "A" }] }],
    ["selisih tanpa penjelasan", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 90, angkaLuar: 88, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "A" }] }],
    ["penjelasan selisih terlalu pendek", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 90, angkaLuar: 88, sebabSelisih: "beda", sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "A" }] }],
    ["sumber luar berupa kalimat kosong", { baris: [{ penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 90, angkaLuar: 90, sumberLuar: "sudah dicek", disandingkanPada: "2026-09-01", olehSiapa: "A" }] }],
    ["periode sama dicatat dua kali dengan angka berbeda", { baris: [
      { penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 90, angkaLuar: 90, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-01", olehSiapa: "A" },
      { penilaian: "x", jenis: "analisa", periode: "2026-08", angkaAleta: 91, angkaLuar: 91, sumberLuar: "hitungan tangan atas SIPP", disandingkanPada: "2026-09-02", olehSiapa: "A" },
    ] }],
  ];

  HARUS_DITOLAK.forEach(([nama, contoh]) => {
    const cela = celaCatatan(contoh, HARI_INI);
    periksa(`ditolak: ${nama}`, cela.length > 0, "seharusnya ada cela, tetapi tidak ada");
  });

  const SAH = {
    baris: [
      {
        penilaian: "tenggang",
        jenis: "analisa",
        periode: "2026-08",
        angkaAleta: 97.8,
        angkaLuar: 97.8,
        sumberLuar: "hitungan tangan atas SIPP, kueri terlampir pada kueriLuar",
        kueriLuar: "SELECT COUNT(*) FROM perkara_pihak_panggilan WHERE ...",
        disandingkanPada: "2026-09-01",
        olehSiapa: "Nama Petugas, Kepaniteraan Hukum",
      },
      {
        penilaian: "LP01",
        jenis: "lipa",
        periode: "2026-07",
        angkaAleta: 548,
        angkaLuar: 547,
        sebabSelisih:
          "Satu perkara dicabut pada tanggal 31 Juli sesudah laporan dikirim, sehingga laporan yang terkirim memuat angka sebelum pencabutan.",
        sumberLuar: "Laporan LIPA 1 yang dikirim pengadilan bulan Juli 2026",
        disandingkanPada: "2026-08-05",
        olehSiapa: "Nama Petugas, Kepaniteraan Hukum",
      },
    ],
  };
  periksa("diterima: catatan yang sah, termasuk selisih yang dijelaskan", celaCatatan(SAH, HARI_INI).length === 0, celaCatatan(SAH, HARI_INI).join(" | "));

  console.log("");
  console.log("== Layanan pembaca ==");
  {
    const berkasSementara = path.join(os.tmpdir(), `aleta-penyandingan-uji-${process.pid}.json`);
    fs.writeFileSync(berkasSementara, JSON.stringify(SAH), "utf8");
    const jalurAsal = process.env.ALETA_BOT_PENYANDINGAN_PATH;
    process.env.ALETA_BOT_PENYANDINGAN_PATH = berkasSementara;
    delete require.cache[require.resolve("../services/penyandinganService")];
    const uji = require("../services/penyandinganService");

    const terbukti = uji.keadaanPenilaian("tenggang", "2026-08");
    periksa("angka yang cocok berstatus terbukti", terbukti.keadaan === "terbukti", terbukti.keadaan);

    const berselisih = uji.keadaanPenilaian("LP01", "2026-07");
    periksa("angka yang berbeda berstatus berselisih, bukan terbukti", berselisih.keadaan === "berselisih", berselisih.keadaan);

    const belum = uji.keadaanPenilaian("belumAdaSamaSekali");
    periksa("penilaian tanpa baris berstatus belum", belum.keadaan === "belum", belum.keadaan);

    periksa(
      "penanda terbaca menyebut belum boleh dipakai membina",
      /belum boleh dipakai/i.test(uji.penandaTerbaca("belumAdaSamaSekali"))
    );
    periksa(
      "penanda terbaca menyebut sumbernya bila sudah terbukti",
      /disandingkan dengan/i.test(uji.penandaTerbaca("tenggang", "2026-08"))
    );

    const ringkas = uji.ringkasan(["tenggang", "LP01", "belumAdaSamaSekali"]);
    periksa(
      "ringkasan menghitung ketiga keadaan terpisah",
      ringkas.terbukti === 1 && ringkas.berselisih === 1 && ringkas.belum === 1,
      JSON.stringify(ringkas)
    );

    // Catatan yang rusak harus dianggap kosong, bukan dianggap terbukti.
    fs.writeFileSync(berkasSementara, "{ ini bukan json", "utf8");
    uji.lupakanSinggahan();
    // Singgahan berumur 30 detik; dilupakan dahulu supaya yang dibaca berkas
    // yang baru, bukan salinan lama.
    const sesudahRusak = uji.keadaanPenilaian("tenggang", "2026-08");
    periksa(
      "catatan yang rusak membuat statusnya belum, bukan terbukti",
      sesudahRusak.keadaan === "belum",
      sesudahRusak.keadaan
    );

    fs.unlinkSync(berkasSementara);
    if (jalurAsal === undefined) delete process.env.ALETA_BOT_PENYANDINGAN_PATH;
    else process.env.ALETA_BOT_PENYANDINGAN_PATH = jalurAsal;
    delete require.cache[require.resolve("../services/penyandinganService")];
  }

  console.log("");
  console.log("== Cakupan penyandingan ==");
  {
    const dbPath = require.resolve("../db_config");
    require("../db_config");
    require.cache[dbPath].exports = { query: (s, p, cb) => cb(null, []) };
    const analisa = require("../services/analisaLanjutService");
    const kunci = analisa.DAFTAR_ANALISA.map((x) => x.kunci);
    const layananNyata = require("../services/penyandinganService");
    const ringkas = layananNyata.ringkasan(kunci);
    console.log(`  ${ringkas.terbukti} terbukti, ${ringkas.berselisih} berselisih, ${ringkas.belum} belum, dari ${ringkas.seluruhnya} analisis`);
    if (ringkas.belum === ringkas.seluruhnya) {
      console.log("  Belum ada satu pun yang disandingkan. Itu keadaan yang jujur pada");
      console.log("  7 September 2026: server pengadilan tidak terjangkau dari mesin ini.");
      console.log("  Cakupan ini BUKAN kegagalan, tetapi ia juga bukan izin untuk memakai");
      console.log("  angkanya sebagai bahan pembinaan.");
    }
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
