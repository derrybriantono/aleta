"use strict";

/**
 * ============================================================================
 * PENCARIAN PERKARA - SARINGAN MENDALAM DAN KETERANGAN KECOCOKAN
 * ============================================================================
 *
 * Yang diperiksa di sini bukan "apakah kueri jalan" - itu urusan basis data -
 * melainkan dua hal yang diam-diam salah tanpa ada yang menyadarinya:
 *
 *   1. SARINGAN YANG TIDAK PERNAH SAMPAI. Isian yang dilupakan di salah satu
 *      lapis akan menghasilkan pencarian yang mengembalikan seluruh register
 *      seolah saringannya tidak berpengaruh. Tidak ada galat, tidak ada
 *      peringatan - hanya hasil yang keliru dan tampak wajar.
 *
 *   2. NILAI DARI PERAMBAN YANG MASUK KE TEKS KUERI. Kunci relaas dan verstek
 *      harus dicocokkan dengan daftar tertutup, bukan disambung apa adanya.
 *
 * Seluruh nama kolom yang dipakai dibaca dari SIPP yang berjalan, bukan
 * ditebak. Angka pada tanggal 5 September 2026: verstek 'Y' 4.109 baris,
 * relaas memuat "retur" 83 baris, pertimbangan memuat "dukh" 188 dari 2.224
 * baris, dan 5.678 perkara punya kua_tempat_nikah.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

const pathx = require("path");

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
let barisUtama = [];
const barisTambahan = new Map();

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    kueri.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });

    // Kueri utama dikenali dari FROM perkara p.
    if (/FROM perkara p\b/.test(sql)) {
      selesai(null, barisUtama);
      return;
    }

    for (const [pola, baris] of barisTambahan) {
      if (pola.test(sql)) {
        selesai(null, baris);
        return;
      }
    }

    selesai(null, []);
  },
};

const layanan = require("../services/sippStatusPerkaraService");

function bersihkan() {
  kueri.length = 0;
  barisTambahan.clear();
  barisUtama = [
    {
      perkaraId: 9971,
      nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      alurPerkaraId: 15,
      tanggalDaftar: "2026-09-02",
      tanggalPutusan: null,
      tanggalMinutasi: null,
      tanggalBht: null,
      statusPutusan: null,
    },
  ];
}

/** Teks seluruh kueri utama digabung - untuk memeriksa syaratnya terpasang. */
function sqlUtama() {
  const satu = kueri.find((q) => /FROM perkara p\b/.test(q.sql));
  return satu ? satu.sql : "";
}

function paramUtama() {
  const satu = kueri.find((q) => /FROM perkara p\b/.test(q.sql));
  return satu ? satu.params : [];
}

async function utama() {
  console.log("");

  // ==========================================================================
  console.log("== Tiap saringan benar-benar sampai ke kueri ==");
  {
    const acuan = [
      ["hakim", { hakim: "Sudarmin" }, /perkara_hakim_pn/, "%Sudarmin%"],
      ["panitera pengganti", { panitera: "Rahmat" }, /perkara_panitera_pn/, "%Rahmat%"],
      ["juru sita", { jurusita: "Yusuf" }, /perkara_jurusita/, "%Yusuf%"],
      ["jenis putusan", { statusPutusan: "Dikabulkan" }, /status_putusan_nama/, "%Dikabulkan%"],
      ["isi pertimbangan", { pertimbangan: "dukhul" }, /perkara_pertimbangan_hukum/, "%dukhul%"],
      ["isi amar", { amar: "menghukum" }, /amar_putusan/, "%menghukum%"],
      ["alamat pihak", { alamatPihak: "Loli" }, /vp\.alamat LIKE/, "%Loli%"],
      ["KUA tempat nikah", { kua: "Banawa" }, /kua_tempat_nikah/, "%Banawa%"],
    ];

    for (const [nama, pilihan, pola, nilaiDiharap] of acuan) {
      bersihkan();
      await layanan.cariPerkara("", pilihan);
      const sql = sqlUtama();
      periksa(`${nama} masuk ke kueri`, pola.test(sql));
      periksa(`${nama} lewat parameter`, paramUtama().includes(nilaiDiharap));
    }
  }

  // ==========================================================================
  console.log("\n== Verstek dicocokkan dengan daftar tertutup ==");
  {
    bersihkan();
    await layanan.cariPerkara("", { verstek: "ya" });
    periksa("verstek ya -> 'Y'", paramUtama().includes("Y"));

    bersihkan();
    await layanan.cariPerkara("", { verstek: "tidak" });
    periksa("verstek tidak -> 'T'", paramUtama().includes("T"));

    // Nilai yang tidak dikenali TIDAK boleh menghasilkan syarat apa pun, dan
    // tidak boleh muncul di teks kueri. Kalau ia lolos, isian dari peramban
    // menjadi bagian perintah SQL.
    bersihkan();
    await layanan.cariPerkara("", { verstek: "' OR 1=1 --", jenisPerkara: "Cerai" });
    const sql = sqlUtama();
    periksa("verstek asing tidak menjadi syarat", !/putusan_verstek/.test(sql));
    periksa("verstek asing tidak masuk teks kueri", !sql.includes("OR 1=1"));
  }

  // ==========================================================================
  console.log("\n== Keadaan relaas dicocokkan dengan daftar tertutup ==");
  {
    const acuan = [
      ["retur", /ket_hasil_relaas LIKE '%retur%'/],
      ["gagal", /ket_temu = 'S'/],
      ["ghaib", /ket_temu IN \('R', 'M', 'W', 'P'\)/],
      ["bertemu", /ket_temu = 'Y'/],
      ["tanpa_relaas", /NOT EXISTS[\s\S]*perkara_pelaksanaan_relaas/],
    ];

    for (const [kunci, pola] of acuan) {
      bersihkan();
      await layanan.cariPerkara("", { relaas: kunci });
      periksa(`relaas ${kunci} terpasang`, pola.test(sqlUtama()));
    }

    bersihkan();
    await layanan.cariPerkara("", { relaas: "DROP TABLE perkara", jenisPerkara: "Cerai" });
    periksa(
      "kunci relaas asing diabaikan, tidak disambung",
      !sqlUtama().includes("DROP TABLE")
    );
  }

  // ==========================================================================
  console.log("\n== Rentang tanggal putusan terpisah dari pendaftaran ==");
  {
    bersihkan();
    await layanan.cariPerkara("", { putusSejak: "2026-09-01", putusSampai: "2026-09-30" });
    const sql = sqlUtama();
    periksa("menyaring tanggal_putusan", /pu\.tanggal_putusan >= \?/.test(sql));
    periksa("bukan tanggal_pendaftaran", !/tanggal_pendaftaran >= \?/.test(sql));
    periksa("kedua batas terpasang", /pu\.tanggal_putusan <= \?/.test(sql));

    // Tanggal yang bukan tanggal tidak boleh lolos.
    bersihkan();
    await layanan.cariPerkara("", { putusSejak: "kemarin", jenisPerkara: "Cerai" });
    // Diperiksa SYARAT-nya, bukan sekadar ada tidaknya kata
    // "tanggal_putusan" - kata itu selalu muncul di bagian SELECT lewat
    // MAX(x.tanggal_putusan), jadi mencarinya di seluruh teks kueri akan
    // selalu ketemu dan ujinya tidak menguji apa pun.
    periksa(
      "tanggal tidak sah diabaikan",
      !/pu\.tanggal_putusan >= \?/.test(sqlUtama()) && !paramUtama().includes("kemarin")
    );
  }

  // ==========================================================================
  console.log("\n== Umur perkara dan cara pendaftaran ==");
  {
    bersihkan();
    await layanan.cariPerkara("", { umur: "lewat5bulan" });
    const sql = sqlUtama();
    periksa("ambang SEMA terpasang", /INTERVAL 5 MONTH/.test(sql));
    periksa("hanya yang belum putus", /NOT EXISTS[\s\S]*tanggal_putusan IS NOT NULL/.test(sql));

    bersihkan();
    await layanan.cariPerkara("", { umur: "lewat3bulan" });
    periksa("ambang tiga bulan terpasang", /INTERVAL 3 MONTH/.test(sqlUtama()));

    // INTERVAL tidak dapat diparameterkan di MySQL. Kalau angkanya boleh
    // datang dari peramban, ia menjadi bagian teks perintah - jadi kunci yang
    // tidak dikenali harus diabaikan sepenuhnya.
    bersihkan();
    await layanan.cariPerkara("", { umur: "99 MONTH); DROP TABLE perkara; --", jenisPerkara: "Cerai" });
    const sqlAsing = sqlUtama();
    periksa("umur asing tidak menjadi syarat", !/INTERVAL/.test(sqlAsing));
    periksa("umur asing tidak masuk teks kueri", !sqlAsing.includes("DROP TABLE"));

    bersihkan();
    await layanan.cariPerkara("", { ecourt: "ya" });
    periksa("e-Court terpasang", /perkara_efiling_id/.test(sqlUtama()));

    bersihkan();
    await layanan.cariPerkara("", { ecourt: "tidak" });
    periksa("bukan e-Court memakai NOT EXISTS", /NOT EXISTS[\s\S]*perkara_efiling_id/.test(sqlUtama()));

    bersihkan();
    await layanan.cariPerkara("", { ecourt: "mungkin", jenisPerkara: "Cerai" });
    periksa("kunci e-Court asing diabaikan", !/perkara_efiling_id/.test(sqlUtama()));
  }

  // ==========================================================================
  console.log("\n== Tanpa satu pun saringan, tidak ada yang dicari ==");
  {
    bersihkan();
    const hasil = await layanan.cariPerkara("", {});
    periksa("dijawab kosong", Array.isArray(hasil) && hasil.length === 0);
    periksa("dan tidak menyentuh basis data", kueri.length === 0);
  }

  // ==========================================================================
  console.log("\n== Hasil menjelaskan APA yang cocok ==");
  {
    bersihkan();
    barisTambahan.set(/FROM perkara_jurusita/, [{ perkaraId: 9971, nama: "YUSUF, S.H." }]);
    const hasil = await layanan.cariPerkara("", { jurusita: "Yusuf" });

    periksa("satu perkara ditemukan", hasil.length === 1);
    const cocok = (hasil[0] && hasil[0].cocok) || [];
    periksa("keterangan kecocokan ada", cocok.length === 1);
    periksa("menyebut jabatannya", cocok[0] && cocok[0].medan === "Juru Sita");
    periksa("menyebut namanya", cocok[0] && cocok[0].nilai === "YUSUF, S.H.");
  }

  {
    bersihkan();
    // Pertimbangan hukum panjangnya ribuan huruf. Yang ditampilkan harus
    // sepenggal DI SEKITAR kata yang dicari - kalau awalnya saja, bagian yang
    // dicari justru tidak kelihatan.
    const panjang =
      "Menimbang bahwa " + "x".repeat(400) + " keduanya telah ba'da dukhul sehingga " + "y".repeat(400);
    barisTambahan.set(/FROM perkara_pertimbangan_hukum/, [
      { perkaraId: 9971, teks: panjang },
    ]);
    const hasil = await layanan.cariPerkara("", { pertimbangan: "dukhul" });
    const cocok = (hasil[0] && hasil[0].cocok) || [];

    periksa("pertimbangan dijelaskan", cocok.length === 1 && cocok[0].medan === "Pertimbangan");
    periksa("penggalannya memuat kata yang dicari", /dukhul/.test(cocok[0] ? cocok[0].nilai : ""));
    periksa(
      "penggalannya dipotong, bukan seluruh teks",
      cocok[0] ? cocok[0].nilai.length < panjang.length : false
    );
  }

  {
    bersihkan();
    // Perkara dengan banyak pihak yang semuanya cocok tidak perlu belasan
    // baris keterangan yang sama.
    barisTambahan.set(/FROM v_pihak_perkara/, [
      { perkaraId: 9971, nama: "SITI AMINAH" },
      { perkaraId: 9971, nama: "SITI MARYAM" },
      { perkaraId: 9971, nama: "SITI FATIMAH" },
    ]);
    const hasil = await layanan.cariPerkara("Siti", {});
    const cocok = (hasil[0] && hasil[0].cocok) || [];
    periksa("satu keterangan per medan", cocok.length === 1);
  }

  {
    bersihkan();
    // Tabel yang tidak ada pada SIPP versi lain tidak boleh menghilangkan
    // hasil pencariannya - keterangannya saja yang hilang.
    require.cache[dbPath].exports.query = (sql, params, selesai) => {
      kueri.push({ sql: String(sql), params });
      if (/FROM perkara p\b/.test(sql)) {
        selesai(null, barisUtama);
        return;
      }
      selesai(new Error("Table 'SIPP.perkara_data_pernikahan' doesn't exist"));
    };

    const hasil = await layanan.cariPerkara("", { kua: "Banawa" });
    periksa("perkaranya tetap kembali", hasil.length === 1);
    periksa("keterangannya saja yang kosong", (hasil[0].cocok || []).length === 0);
  }

  // ==========================================================================
  console.log("\n== Daftar pilihan tersedia untuk layar ==");
  {
    const relaas = layanan.RELAAS_PENCARIAN || [];
    const putusan = layanan.PUTUSAN_PENCARIAN || [];
    periksa("daftar keadaan relaas diekspor", relaas.length === 5);
    periksa("seluruhnya punya kunci dan label", relaas.every((x) => x.kunci && x.label));
    periksa("daftar jenis putusan diekspor", putusan.includes("Dikabulkan"));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exitCode = 1;
  } else {
    console.log("SEMUA PERIKSAAN LULUS.");
  }
}

void pathx;
utama().catch((galat) => {
  console.error(galat);
  process.exitCode = 1;
});
