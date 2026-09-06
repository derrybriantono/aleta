"use strict";

/**
 * ============================================================================
 * ANALISIS LANJUTAN SATU PERKARA
 * ============================================================================
 *
 * Yang dijaga di sini tiga hal yang diam-diam salah tanpa ada yang menyadarinya:
 *
 *   1. JENIS ANALISIS DARI DAFTAR TERTUTUP. Nama fungsi tidak pernah datang
 *      dari peramban; kunci yang tidak dikenali ditolak, bukan menjalankan
 *      sesuatu yang lain.
 *
 *   2. BENTUK KELUARAN YANG SAMA untuk sepuluhnya. Layar merendernya dengan
 *      SATU komponen - satu analisis yang mengembalikan bentuk berbeda akan
 *      tergambar kosong, bukan melempar galat.
 *
 *   3. TIDAK ADA TULISAN KE SIPP. Seluruh analisis membaca; satu UPDATE yang
 *      lolos ke sini menyentuh basis data pengadilan yang sedang dipakai.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// ---------------------------------------------------------------- penadah
const kueri = [];

/** Bahan putusan yang disuguhkan penadah - diganti per pemeriksaan. */
const BAHAN_BAWAAN = {
  petitum:
    '<ol><li>Mengabulkan permohonan Pemohon;</li><li>Menjatuhkan talak satu terhadap Termohon;</li></ol>',
  pertimbangan: '<p>Menimbang bahwa permohonan Pemohon dikabulkan;</p>',
  amar: '<p>1. Mengabulkan permohonan Pemohon;</p>',
  kodeMediasi: 'T',
};
let bahanPutusan = { ...BAHAN_BAWAAN };

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    kueri.push({ sql: teks, params: Array.isArray(params) ? params : [] });

    // Identitas perkara - dijawab satu baris supaya analisisnya berjalan.
    // Bahan putusan - dipakai pemeriksa pertimbangan dan ringkasan. Diisi
    // dari luar supaya satu pemeriksaan dapat mengubahnya tanpa menyalin
    // seluruh penadah.
    if (/SELECT p\.petitum AS petitum/.test(teks)) {
      selesai(null, [{ petitum: bahanPutusan.petitum }]);
      return;
    }
    if (/perkara_pertimbangan_hukum ph WHERE ph\.perkara_id = \?/.test(teks)) {
      selesai(null, bahanPutusan.pertimbangan ? [{ teks: bahanPutusan.pertimbangan }] : []);
      return;
    }
    if (/pu\.amar_putusan AS amar/.test(teks)) {
      selesai(null, [{ amar: bahanPutusan.amar, status: 'Dikabulkan', tanggalPutusan: '2026-08-11' }]);
      return;
    }
    if (/FROM perkara_mediasi md WHERE md\.perkara_id = \? LIMIT 1/.test(teks)) {
      selesai(null, [{ hasil: bahanPutusan.kodeMediasi, mediator: 'Himawan T.W.' }]);
      return;
    }
    if (/FROM perkara p WHERE p\.nomor_perkara = \?/.test(teks)) {
      selesai(null, [
        {
          perkaraId: 9971,
          nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          alurPerkaraId: 15,
          tanggalDaftar: "2026-03-02",
        },
      ]);
      return;
    }

    selesai(null, []);
  },
};

const layanan = require("../services/analisaLanjutService");

function bersihkan() {
  kueri.length = 0;
  bahanPutusan = { ...BAHAN_BAWAAN };
}

async function utama() {
  console.log("");

  // ==========================================================================
  console.log("== Daftar analisis ==");
  {
    const daftar = layanan.DAFTAR_ANALISA;
    // Jumlahnya sengaja TIDAK dipatok pada satu angka - menambah analisis
    // adalah hal yang lazim, dan uji yang gagal setiap kali daftar bertambah
    // mengajarkan orang mengubah angkanya tanpa membaca apa pun.
    periksa("daftar analisis tidak kosong", daftar.length >= 10);
    periksa(
      "analisis pengenalan pihak tersedia",
      daftar.some((x) => x.kunci === "pihak") && daftar.some((x) => x.kunci === "pasangan")
    );
    periksa(
      "seluruhnya punya kunci, label, dan keterangan",
      daftar.every((x) => x.kunci && x.label && x.keterangan)
    );
    periksa(
      "kuncinya tidak ada yang kembar",
      new Set(daftar.map((x) => x.kunci)).size === daftar.length
    );
  }

  // ==========================================================================
  console.log("\n== Jenis analisis dari daftar tertutup ==");
  {
    bersihkan();
    const hasil = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "bukan-analisa");
    periksa("jenis asing ditolak", hasil.ok === false);
    periksa("sebabnya disebutkan", hasil.alasan === "jenis_analisa_tidak_dikenali");
    // Ditolak SEBELUM menyentuh basis data - kalau tidak, jenis asing tetap
    // membebani SIPP dengan pembacaan yang tidak akan dipakai.
    periksa("dan tidak menyentuh basis data", kueri.length === 0);

    bersihkan();
    const jahat = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "'; DROP TABLE perkara; --");
    periksa("teks jahat ditolak sebagai jenis", jahat.ok === false);
    periksa(
      "teks jahat tidak pernah masuk kueri",
      kueri.every((k) => !k.sql.includes("DROP TABLE"))
    );
  }

  // ==========================================================================
  console.log("\n== Perkara yang tidak ada ==");
  {
    bersihkan();
    // Penadah menjawab kosong untuk nomor apa pun selain pola identitas, dan
    // identitas selalu dijawab - jadi diuji lewat nomor yang tidak sah.
    const hasil = await layanan.jalankanAnalisa("", "tenggat");
    periksa("nomor kosong ditolak", hasil.ok === false);
    periksa("sebabnya disebutkan", hasil.alasan === "perkara_tidak_ditemukan");
  }

  // ==========================================================================
  console.log("\n== Sepuluh analisis mengembalikan bentuk yang sama ==");
  {
    for (const satu of layanan.DAFTAR_ANALISA) {
      bersihkan();
      const hasil = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", satu.kunci);

      periksa(`${satu.kunci}: dijawab berhasil`, hasil.ok === true);
      periksa(
        `${satu.kunci}: berbentuk lengkap`,
        typeof hasil.judul === "string" &&
          hasil.judul.length > 0 &&
          typeof hasil.ringkas === "string" &&
          Array.isArray(hasil.metrik) &&
          Array.isArray(hasil.kolom) &&
          Array.isArray(hasil.baris)
      );
      periksa(
        `${satu.kunci}: tiap kolom punya kunci dan label`,
        hasil.kolom.every((k) => k.kunci && k.label)
      );
    }
  }

  // ==========================================================================
  console.log("\n== Tidak ada satu pun tulisan ke SIPP ==");
  {
    bersihkan();
    for (const satu of layanan.DAFTAR_ANALISA) {
      await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", satu.kunci);
    }
    periksa("tidak ada UPDATE", kueri.every((k) => !/^\s*UPDATE/i.test(k.sql)));
    periksa("tidak ada INSERT", kueri.every((k) => !/^\s*INSERT/i.test(k.sql)));
    periksa("tidak ada DELETE", kueri.every((k) => !/\bDELETE\b/i.test(k.sql)));
    periksa(
      "tidak ada TRUNCATE, DROP, maupun ALTER",
      kueri.every((k) => !/\b(TRUNCATE|DROP|ALTER)\b/i.test(k.sql))
    );
    periksa("seluruhnya SELECT", kueri.every((k) => /^\s*SELECT/i.test(k.sql.trim())));
    periksa("nilainya lewat parameter", kueri.some((k) => k.params.length > 0));
  }

  // ==========================================================================
  console.log("\n== Pemeriksa pertimbangan: temuan, bukan nilai ==");
  {
    bersihkan();
    const hasil = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "periksaPertimbangan");
    // Yang dikeluarkan harus TEMUAN. Sekali ia mengeluarkan persentase,
    // angkanya akan dipercaya melebihi yang pantas dan masuk ke rapor
    // orang - padahal pencocokannya hanya kesamaan kata.
    periksa(
      "tidak mengeluarkan persentase apa pun",
      hasil.metrik.every((m) => !String(m.nilai).includes("%"))
    );
    periksa("menyatakan dirinya bukan penilaian", /BUKAN penilaian/.test(String(hasil.catatan)));
    periksa(
      "butir petitum yang terjawab tidak ditandai",
      hasil.baris.some((b) => b.perluDibaca === "")
    );

    // Amar "Mengabulkan" berpasangan dengan pertimbangan "dikabulkan".
    // Mencocokkan bentuk persisnya membuat peringatan menyala pada hampir
    // setiap perkara, dan peringatan yang selalu menyala berhenti dibaca.
    const arah = hasil.metrik.find((m) => m.label === "Arah amar");
    periksa("arah amar terbaca", Boolean(arah) && arah.nilai === "mengabulkan");
    periksa(
      "kata dasar dikabulkan diakui sepadan dengan mengabulkan",
      Boolean(arah) && arah.keterangan === "juga disebut di pertimbangan"
    );

    bersihkan();
    bahanPutusan.pertimbangan = "<p>Menimbang bahwa perkara ini diperiksa;</p>";
    const sunyi = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "periksaPertimbangan");
    const arahSunyi = sunyi.metrik.find((m) => m.label === "Arah amar");
    periksa(
      "pertimbangan yang benar-benar tidak menyebutnya tetap ditandai",
      Boolean(arahSunyi) && arahSunyi.keterangan === "tidak disebut di pertimbangan"
    );
  }

  console.log("\n== Ringkasan perkara: tidak mengarang ==");
  {
    bersihkan();
    const hasil = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "ringkasan");
    periksa("mediasi kode T disebut tidak berhasil", /tidak berhasil/.test(hasil.ringkas));

    // 'Y2' dan 'D' ada di SIPP tanpa arti yang pasti. Menerjemahkannya
    // berarti mengarang di kalimat yang dibacakan kepada pihak.
    bersihkan();
    bahanPutusan.kodeMediasi = "Y2";
    const kabur = await layanan.jalankanAnalisa("551/Pdt.G/2026/PA.Dgl", "ringkasan");
    periksa(
      "kode mediasi tidak baku tidak diterjemahkan",
      !/berhasil/.test(kabur.ringkas.replace(/belum tercatat baku/g, ""))
    );
    periksa("melainkan dinyatakan belum tercatat baku", /belum tercatat baku/.test(kabur.ringkas));
    periksa(
      "menyatakan kalimatnya bukan susunan model bahasa",
      /tidak satu pun disusun oleh model bahasa/.test(String(kabur.catatan))
    );
  }

  console.log("\n== Nilai tengah ==");
  {
    // Nilai tengah dipakai membandingkan lama perkara. Rata-rata akan
    // tertarik oleh satu perkara yang tertunda bertahun-tahun; nilai tengah
    // tidak - dan itulah sebabnya ia yang dipakai.
    periksa("ganjil", layanan.median([1, 5, 9]) === 5);
    periksa("genap dibulatkan", layanan.median([2, 4]) === 3);
    periksa("kosong dijawab null", layanan.median([]) === null);
    periksa("bukan angka diabaikan", layanan.median([1, NaN, 3]) === 2);
    periksa("tidak peduli urutan masukan", layanan.median([9, 1, 5]) === 5);
  }

  console.log("\n== Selisih hari ==");
  {
    periksa("selisih biasa", layanan.selisihHari("2026-09-01", "2026-09-11") === 10);
    periksa("tanggal kosong dijawab null", layanan.selisihHari("", "2026-09-11") === null);
    periksa("tanggal cacat dijawab null", layanan.selisihHari("kemarin", "2026-09-11") === null);
    periksa("mundur bernilai negatif", layanan.selisihHari("2026-09-11", "2026-09-01") === -10);
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exitCode = 1;
  } else {
    console.log("SEMUA PERIKSAAN LULUS.");
  }
}

utama().catch((galat) => {
  console.error(galat);
  process.exitCode = 1;
});
