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
/** Jawaban berurut untuk kueri utama, dipakai menguji dua lapis. */
const antreanUtama = [];
const barisTambahan = new Map();

const dbPath = require.resolve("../db_config");
require("../db_config");
// Penadahnya disimpan sebagai fungsi bernama supaya uji yang sengaja
// menggantinya (tabel yang tidak ada) dapat dipulihkan oleh bersihkan().
let penadah;
require.cache[dbPath].exports = {
  query: (penadah = (sql, params, selesai) => {
    kueri.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });

    // Kueri utama dikenali dari FROM perkara p.
    if (/FROM perkara p\b/.test(sql)) {
      // Pencarian teks berjalan dua lapis: cepat dulu, diperdalam bila kosong.
      // Antrean ini membiarkan uji menentukan jawaban tiap lapis secara
      // terpisah - tanpa itu, lapis kedua tidak dapat diuji sama sekali.
      if (antreanUtama.length > 0) {
        selesai(null, antreanUtama.shift());
        return;
      }
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
  }),
};

const layanan = require("../services/sippStatusPerkaraService");

function bersihkan() {
  require.cache[dbPath].exports.query = penadah;
  kueri.length = 0;
  antreanUtama.length = 0;
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
      // Langsung ke tabel pihak, bukan lewat v_pihak_perkara - pola ini
      // menuntut tabel PERTAMA dan TERAKHIR daftar itu sekaligus; keenamnya
      // diperiksa satu per satu di bagian "tabel pihak" di bawah.
      [
        "alamat pihak",
        { alamatPihak: "Loli" },
        /FROM perkara_pihak1 ph0[\s\S]*ph0\.alamat LIKE \?[\s\S]*FROM perkara_pihak_korban ph5[\s\S]*ph5\.alamat LIKE \?/,
        "%Loli%",
      ],
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
      // Kuncinya berganti nama 25 September 2026 - lihat sebabnya pada
            // RELAAS_SYARAT. Pemeriksaan ini dahulu MENGABADIKAN cacatnya:
            // ia menuntut agar 'S' tetap diartikan gagal.
      ["surat_tercatat", /ket_temu = 'S'/],
      ["ghaib", /ket_temu IN \('R', 'M', 'W', 'P'\)/],
      ["bertemu", /ket_temu = 'Y'/],
      ["tanpa_relaas", /NOT EXISTS[\s\S]*perkara_pelaksanaan_relaas/],
      // Kunci LAMA tetap dikenali supaya layar atau pranala yang belum
      // diperbarui tidak kehilangan saringannya dalam diam - tetapi ia kini
      // menunjuk kegagalan yang SUNGGUHAN, bukan sandi surat tercatat.
      ["gagal", /status_pos = 2/],
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
  console.log("\n== Kotak cari biasa menjangkau yang dijangkau pencarian lanjutan ==");
  {
    // Kata yang berarti KEADAAN, bukan teks. "verstek" tidak pernah tertulis
    // di nomor perkara maupun nama pihak; mencarinya sebagai teks selalu
    // nihil, dan nihilnya tidak dapat dibedakan dari perkaranya-memang-tidak-
    // ada.
    const kosakata = [
      ["verstek", /putusan_verstek = 'Y'/, "Putusan verstek"],
      ["banding", /FROM perkara_banding/, "Ada banding"],
      ["kasasi", /FROM perkara_kasasi/, "Ada kasasi"],
      ["pk", /FROM perkara_pk/, "Ada peninjauan kembali"],
      ["retur", /ket_hasil_relaas LIKE '%retur%'/, "Relaas retur"],
      ["ghaib", /ket_temu IN \('R', 'M', 'W', 'P'\)/, "Dipanggil sebagai ghaib"],
      ["e-court", /perkara_efiling_id/, "Perkara e-Court"],
    ];

    for (const [kata, pola, label] of kosakata) {
      bersihkan();
      const hasil = await layanan.cariPerkara(kata, {});
      periksa(`"${kata}" menjadi saringan keadaan`, pola.test(sqlUtama()));
      periksa(
        `"${kata}" tidak dicari sebagai teks`,
        !paramUtama().includes(`%${kata}%`)
      );
      periksa(
        `"${kata}" dijelaskan di hasilnya`,
        (hasil[0]?.cocok || []).some((x) => x.medan === "Keadaan" && x.nilai === label)
      );
    }

    // Huruf besar-kecil tidak boleh menentukan.
    bersihkan();
    await layanan.cariPerkara("VERSTEK", {});
    periksa("kosakata tidak peduli huruf besar", /putusan_verstek = 'Y'/.test(sqlUtama()));
  }

  {
    // Kata biasa: lapis cepat dulu. Selama ia berisi, lapis dalam yang mahal
    // tidak boleh dijalankan sama sekali.
    bersihkan();
    await layanan.cariPerkara("Dirman", {});
    const utamaSql = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));
    periksa("kata biasa dicari lewat satu kueri saja", utamaSql.length === 1);
    // Keenam tabel yang dihimpun v_pihak_perkara, masing-masing dengan
    // nama LIKE. Satu yang hilang = perkara yang dulu ketemu hilang diam-diam.
    periksa(
      "lapis cepat memakai nama pihak di keenam tabel pihak",
      layanan.TABEL_PIHAK.length === 6 &&
        layanan.TABEL_PIHAK.every((tabel, i) =>
          new RegExp(`FROM ${tabel} ph${i}\\b[\\s\\S]*?ph${i}\\.nama LIKE \\?`).test(utamaSql[0].sql)
        )
    );
    periksa("lapis cepat tidak lewat v_pihak_perkara", !/v_pihak_perkara/.test(utamaSql[0].sql));
    periksa(
      "lapis cepat mencari nama kuasa hukum",
      /FROM perkara_pengacara kh[\s\S]*?kh\.nama LIKE \?/.test(utamaSql[0].sql)
    );
    periksa(
      "kata masuk sebanyak isiannya (nomor, jenis, 6 tabel pihak, kuasa)",
      utamaSql[0].params.filter((x) => x === "%Dirman%").length === 9 &&
        (utamaSql[0].sql.match(/\?/g) || []).length === utamaSql[0].params.length
    );
    periksa("lapis cepat TIDAK menyentuh agenda sidang", !/perkara_jadwal_sidang/.test(utamaSql[0].sql));
    periksa(
      "lapis cepat TIDAK menyentuh pertimbangan",
      !/perkara_pertimbangan_hukum/.test(utamaSql[0].sql)
    );
  }

  {
    // Lapis cepat kosong -> diperdalam sampai ke isi pertimbangan.
    bersihkan();
    antreanUtama.push([]);
    antreanUtama.push([
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
    ]);

    const hasil = await layanan.cariPerkara("bada dukhul", {});
    const utamaSql = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));

    periksa("dijalankan dua lapis", utamaSql.length === 2);
    periksa(
      "lapis kedua mencari isi pertimbangan",
      /perkara_pertimbangan_hukum/.test(utamaSql[1].sql)
    );
    periksa("lapis kedua mencari isi amar", /amar_putusan/.test(utamaSql[1].sql));
    periksa(
      "lapis kedua mencari alamat pihak di keenam tabel pihak",
      layanan.TABEL_PIHAK.every((tabel, i) =>
        new RegExp(`FROM ${tabel} ph${i}\\b[\\s\\S]*?ph${i}\\.alamat LIKE \\?`).test(utamaSql[1].sql)
      )
    );
    periksa("lapis kedua mencari agenda sidang", /jd\.agenda LIKE \?/.test(utamaSql[1].sql));
    periksa("lapis kedua mencari kuasa hukum", /kh\.nama LIKE \?/.test(utamaSql[1].sql));
    periksa(
      "lapis kedua: isian dan nilainya sama banyak",
      (utamaSql[1].sql.match(/\?/g) || []).length === utamaSql[1].params.length
    );
    periksa("lapis kedua mencari KUA", /kua_tempat_nikah/.test(utamaSql[1].sql));
    periksa("lapis kedua mencari petugas", /perkara_jurusita/.test(utamaSql[1].sql));
    periksa("perkaranya ditemukan", hasil.length === 1);

    // Apostrof dibuang dari KOLOM. Yang tertulis di SIPP "ba’da dukhul"
    // dengan apostrof miring U+2019 - tanpa ini, "bada dukhul" maupun
    // "ba'da dukhul" sama-sama nihil dan tidak ada cara menebak bentuk yang
    // benar.
    periksa(
      "apostrof dibuang dari kolom teks panjang",
      /REPLACE\(REPLACE\(REPLACE\([\s\S]*0xE28099/.test(utamaSql[1].sql)
    );
  }

  {
    // Apostrof dibuang dari KATA CARINYA juga - kedua sisi harus diperlakukan
    // sama, kalau tidak yang satu tetap tidak cocok dengan yang lain.
    bersihkan();
    antreanUtama.push([]);
    antreanUtama.push([]);
    await layanan.cariPerkara("ba'da dukhul", {});
    const utamaSql = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));
    periksa(
      "apostrof dibuang dari kata carinya",
      utamaSql[1].params.includes("%bada dukhul%")
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
    // Keterangan pihak kini dibaca dari keenam tabel pihak (alias t), bukan
    // dari v_pihak_perkara.
    barisTambahan.set(/FROM perkara_pihak1 t\b/, [
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

    // ...tetapi hilangnya TIDAK diam: tiap bagian yang gagal disebut namanya.
    kueri.length = 0;
    const halaman = await layanan.cariPerkaraHalaman("", { kua: "Banawa" });
    const tak = halaman.ruasTakTerbaca || [];
    periksa("bagian yang gagal disebut di ruasTakTerbaca", tak.includes("cocok:KUA") && tak.includes("kuasa"));
    periksa("e-Court yang tak terbaca bernilai null, bukan false", halaman.perkara[0].ecourt === null);
  }

  // ==========================================================================
  console.log("\n== Kata bebas diperluas (butir 8) ==");
  {
    // Bergaris miring: nomor perkara DULU; nomor akta cerai, banding, kasasi,
    // PK, akta nikah HANYA bila tidak satu pun nomor perkara cocok (telaah 26
    // September 2026: digabung, "/2019" dibanjiri perkara berakta nikah 2019).
    bersihkan();
    // Penjemput nomor lain: dikenali dari UNION atas lima tabelnya.
    const polaJemput = /FROM perkara_akta_cerai ac\b[\s\S]*UNION[\s\S]*perkara_data_pernikahan an\b/;
    barisTambahan.set(polaJemput, [{ perkaraId: 9971 }, { perkaraId: 9980 }]);
    // Keterangan kecocokan: dikenali dari saringan id hasilnya.
    barisTambahan.set(/ac\.perkara_id IN \([\s\S]*ac\.nomor_akta_cerai LIKE/, [
      { perkaraId: 9971, nomor: "376/AC/2026/PA.Dgl" },
    ]);
    // Penjemput nomor PERKARA: indeks nomor_perkara saja (alias pn, bukan p).
    const polaNomor = /FROM perkara pn\s+WHERE pn\.nomor_perkara LIKE \?/;
    const hasil = await layanan.cariPerkara("376/AC/2026", {});
    const utama = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));
    const iNomor = kueri.findIndex((q) => polaNomor.test(q.sql));
    const iJemput = kueri.findIndex((q) => polaJemput.test(q.sql));
    const jemput = kueri[iJemput];
    periksa(
      "garis miring: nomor perkara dijemput lebih dahulu, lewat indeksnya, kata lewat parameter",
      iNomor === 0 &&
        JSON.stringify(kueri[0].params) === JSON.stringify(["%376/AC/2026%"]) &&
        !kueri[0].sql.includes("376/AC")
    );
    periksa(
      "nomor perkara kosong -> kueri utama tahap pertama tidak jalan; nomor lain dijemput sesudahnya",
      Boolean(jemput) && utama.length === 1 && iNomor < iJemput && iJemput < kueri.indexOf(utama[0])
    );
    for (const [nama, pola] of [
      ["nomor akta cerai", /ac\.nomor_akta_cerai LIKE \?/],
      ["nomor banding", /bd\.nomor_perkara_banding LIKE \?/],
      ["nomor putusan banding", /bd\.nomor_putusan_banding LIKE \?/],
      ["nomor kasasi", /ks\.nomor_perkara_kasasi LIKE \?/],
      ["nomor PK", /pq\.nomor_perkara_pk LIKE \?/],
      ["nomor akta nikah", /an\.no_kutipan_akta_nikah LIKE \?/],
    ]) {
      periksa(`garis miring mencari ${nama}`, Boolean(jemput) && pola.test(jemput.sql));
    }
    periksa(
      "penjemput: kata masuk delapan kali lewat parameter",
      Boolean(jemput) && jemput.params.filter((x) => x === "%376/AC/2026%").length === 8 && !jemput.sql.includes("376/AC")
    );
    periksa(
      "tahap kedua: HANYA id nomor lain yang dijemput - nomor perkara tidak ikut",
      utama.length === 1 &&
        /WHERE p\.perkara_id IN \(\?, \?\)\s+ORDER BY/.test(utama[0].sql) &&
        !/nomor_perkara LIKE/.test(utama[0].sql) &&
        utama[0].params.includes(9971) && utama[0].params.includes(9980)
    );
    periksa("kueri utama tidak memikul EXISTS nomor lain", !utama.some((q) => /perkara_akta_cerai/.test(q.sql)));
    periksa(
      "akta cerai yang cocok dijelaskan",
      (hasil[0]?.cocok || []).some((x) => x.medan === "Akta cerai" && x.nilai === "376/AC/2026/PA.Dgl")
    );

    // Nomor perkara cocok: kueri utama memakai daftar id nomor perkara yang
    // dijemput; nomor lain TIDAK dijemput dan keterangannya tidak dicari.
    bersihkan();
    barisTambahan.set(polaNomor, [{ perkaraId: 9971 }, { perkaraId: 9975 }]);
    barisTambahan.set(polaJemput, [{ perkaraId: 9980 }]);
    barisTambahan.set(/ac\.perkara_id IN \([\s\S]*ac\.nomor_akta_cerai LIKE/, [{ perkaraId: 9971, nomor: "5/AC/2025/PA.Dgl" }]);
    const nomorCocok = await layanan.cariPerkara("/Pdt.G/2025", {});
    periksa(
      "nomor perkara cocok: kueri utama = daftar id nomor perkara, nomor lain tidak dijemput",
      /WHERE p\.perkara_id IN \(\?, \?\)\s+ORDER BY/.test(sqlUtama()) &&
        paramUtama().includes(9971) && paramUtama().includes(9975) && !paramUtama().includes(9980) &&
        !kueri.some((q) => polaJemput.test(q.sql))
    );
    periksa(
      "nomor perkara cocok: keterangan nomor lain tidak dicari, tidak dilampirkan",
      !kueri.some((q) => /ac\.perkara_id IN \([\s\S]*ac\.nomor_akta_cerai LIKE/.test(q.sql)) &&
        !(nomorCocok[0]?.cocok || []).some((x) => /Akta|Nomor (banding|kasasi|PK)/.test(x.medan))
    );

    // Seribu nomor perkara atau lebih: bukan daftar IN (MariaDB mengubahnya
    // menjadi tabel turunan - lambat), melainkan syarat LIKE yang sama.
    bersihkan();
    barisTambahan.set(polaNomor, Array.from({ length: 1000 }, (_, i) => ({ perkaraId: 20000 + i })));
    await layanan.cariPerkara("7/", {});
    periksa(
      "seribu nomor perkara cocok: kueri utama memakai LIKE, bukan daftar seribu id",
      /WHERE p\.nomor_perkara LIKE \?\s+ORDER BY/.test(sqlUtama()) &&
        JSON.stringify(paramUtama().filter((x) => typeof x === "string")) === JSON.stringify(["%7/%"]) &&
        !/perkara_id IN/.test(sqlUtama())
    );

    // Halaman sesudah hasil terakhir nomor perkara TIDAK berpindah ke nomor lain.
    bersihkan();
    barisTambahan.set(polaNomor, [{ perkaraId: 9971 }]);
    barisTambahan.set(polaJemput, [{ perkaraId: 9980 }]);
    antreanUtama.push([]); // halaman ke-2: kosong
    antreanUtama.push([barisUtama[0]]); // pemeriksa halaman awal: berisi
    const h2 = await layanan.cariPerkaraHalaman("12/", { lewati: 25 });
    periksa(
      "halaman kosong sesudah nomor perkara tetap kosong - nomor lain tidak dijemput",
      h2.perkara.length === 0 && !kueri.some((q) => polaJemput.test(q.sql)) &&
        /LIMIT 1 OFFSET 0\) halaman\b/.test(kueri.filter((q) => /FROM perkara p\b/.test(q.sql))[1]?.sql || "")
    );
  }

  {
    // Angka pendek tetap nomor urut, TEPAT - tidak menyisir tabel pihak.
    bersihkan();
    await layanan.cariPerkara("419", {});
    periksa("angka pendek tetap nomor urut tepat", /SUBSTRING_INDEX\(p\.nomor_perkara, '\/', 1\) = \?/.test(sqlUtama()));
    // Rentang berindeks DI DEPAN penyaring tepat - keduanya, bukan salah satu:
    // rentang saja memuat "419 x/...", penyaring saja menyisir seluruh
    // register. Rentangnya tiga ("419/%", "419 %", = "419"), bukan awalan
    // "419%" - awalan pendek seperti "7%" membuat MariaDB kembali menyisir
    // indeks tanggal (lihat layanan).
    periksa(
      "angka pendek: tiga rentang berindeks + penyaring tepat, seluruhnya lewat parameter",
      /\(\(p\.nomor_perkara LIKE \? OR p\.nomor_perkara LIKE \? OR p\.nomor_perkara = \?\)\s+AND SUBSTRING_INDEX\(p\.nomor_perkara, '\/', 1\) = \?\)/.test(
        sqlUtama()
      ) &&
        JSON.stringify(paramUtama().slice(0, 4)) === JSON.stringify(["419/%", "419 %", "419", "419"]) &&
        !/419/.test(sqlUtama())
    );
    periksa("angka pendek tidak menjemput pihak", !kueri.some((q) => /FROM pihak ip\b/.test(q.sql)));
    periksa(
      "angka pendek tidak ditanyakan ke nama pihak",
      !kueri.some((q) => q.params.includes("%419%"))
    );
  }

  {
    // Angka panjang: NIK/telepon lewat pihak yang dijemput lebih dahulu.
    bersihkan();
    barisTambahan.set(/FROM pihak ip\b[\s\S]*nomor_indentitas LIKE/, [{ id: 11 }, { id: 12 }]);
    barisTambahan.set(/FROM perkara_pihak1 t WHERE t\.pihak_id IN/, [{ perkaraId: 9971 }, { perkaraId: 9975 }]);
    barisTambahan.set(/FROM perkara_data_pernikahan an\b[\s\S]*no_kutipan_akta_nikah LIKE/, [{ perkaraId: 9975 }, { perkaraId: 9990 }]);
    await layanan.cariPerkara("7203081032023022", {});
    const sql = sqlUtama();
    const jemput = kueri.find((q) => /FROM pihak ip\b/.test(q.sql));
    const jemputPerkara = kueri.find((q) => /FROM perkara_pihak1 t WHERE t\.pihak_id IN/.test(q.sql));
    periksa(
      "angka panjang menjemput pihak ber-NIK/telepon",
      Boolean(jemput) && jemput.params.filter((x) => x === "%7203081032023022%").length === 2
    );
    periksa("angka panjang BUKAN nomor urut", !/SUBSTRING_INDEX/.test(sql));
    periksa(
      "perkaranya dijemput dari keenam tabel pihak lewat pihak_id",
      Boolean(jemputPerkara) &&
        layanan.TABEL_PIHAK.every((tabel) => new RegExp(`FROM ${tabel} t WHERE t\\.pihak_id IN \\(\\?, \\?\\)`).test(jemputPerkara.sql)) &&
        jemputPerkara.params.filter((x) => x === 11).length === 6
    );
    periksa(
      "akta nikah 16 digit ikut ditanyakan",
      kueri.some((q) => /FROM perkara_data_pernikahan an\b[\s\S]*no_kutipan_akta_nikah LIKE/.test(q.sql) && q.params.includes("%7203081032023022%"))
    );
    periksa(
      "kueri utama memakai gabungan id unik (pihak + akta nikah)",
      /p\.perkara_id IN \(\?, \?, \?\)/.test(sql) &&
        [9971, 9975, 9990].every((x) => paramUtama().filter((y) => y === x).length === 1)
    );

    // Tidak ada yang cocok sama sekali: nol baris, kueri utama tidak jalan.
    bersihkan();
    const kosong = await layanan.cariPerkara("7203081032023022", {});
    periksa(
      "tanpa pihak & akta cocok: kosong tanpa kueri utama",
      kosong.length === 0 && !kueri.some((q) => /FROM perkara p\b/.test(q.sql))
    );

    // Pihak yang cocok mentok di pagu: bentuk sambungan lengkap, tidak dipotong.
    bersihkan();
    barisTambahan.set(
      /FROM pihak ip\b[\s\S]*nomor_indentitas LIKE/,
      Array.from({ length: 2000 }, (_, i) => ({ id: i + 1 }))
    );
    await layanan.cariPerkara("720308", {});
    periksa(
      "pagu pihak tercapai -> sambungan pihak lengkap di kueri utama",
      /JOIN pihak id0 ON id0\.id = pi0\.pihak_id/.test(sqlUtama()) &&
        /id5\.nomor_indentitas LIKE \?/.test(sqlUtama()) &&
        (sqlUtama().match(/\?/g) || []).length === paramUtama().length
    );
  }

  {
    // NIK dan telepon di keterangan cocok: hanya angka yang diketik yang tampak
    // (telaah 26 September 2026: "720325" membuka 95 NIK utuh milik 88 orang).
    bersihkan();
    barisTambahan.set(/FROM pihak ip\b[\s\S]*nomor_indentitas LIKE/, [{ id: 11 }]);
    barisTambahan.set(/FROM perkara_pihak1 t WHERE t\.pihak_id IN/, [{ perkaraId: 9971 }]);
    barisTambahan.set(/ip\.nomor_indentitas AS nik/, [
      { perkaraId: 9971, nama: "SITI AMINAH", nik: "7203081032023022", telepon: "085210320230" },
    ]);
    const nik = await layanan.cariPerkara("10320230", {});
    const cocokNik = (nik[0]?.cocok || []).find((x) => x.medan === "Nomor identitas");
    const cocokTelepon = (nik[0]?.cocok || []).find((x) => x.medan === "Telepon");
    periksa(
      "NIK di keterangan cocok disamarkan kecuali yang diketik",
      Boolean(cocokNik) && cocokNik.nilai === "******10320230** - SITI AMINAH"
    );
    periksa(
      "telepon di keterangan cocok disamarkan kecuali yang diketik",
      Boolean(cocokTelepon) && cocokTelepon.nilai === "****10320230 - SITI AMINAH"
    );
    periksa("NIK utuh tidak keluar di keterangan mana pun", !JSON.stringify(nik).includes("7203081032023022"));
  }

  {
    // Keterangan kuasa dan agenda.
    bersihkan();
    barisTambahan.set(/FROM perkara_pengacara k\b[\s\S]*k\.nama LIKE/, [{ perkaraId: 9971, nama: "Andi Baso, S.H." }]);
    const hasil = await layanan.cariPerkara("Baso", {});
    periksa(
      "nama kuasa yang cocok dijelaskan",
      (hasil[0]?.cocok || []).some((x) => x.medan === "Kuasa" && x.nilai === "Andi Baso, S.H.")
    );

    bersihkan();
    antreanUtama.push([]);
    antreanUtama.push(barisUtama);
    barisTambahan.set(/FROM perkara_jadwal_sidang j\b[\s\S]*j\.agenda LIKE/, [{ perkaraId: 9971, agenda: "Pembuktian lanjutan" }]);
    const dalam = await layanan.cariPerkaraHalaman("pembuktian", {});
    periksa("agenda yang cocok dijelaskan (lapis dalam)", dalam.lapis === "dalam" &&
      (dalam.perkara[0]?.cocok || []).some((x) => x.medan === "Agenda sidang" && x.nilai === "Pembuktian lanjutan"));
  }

  // ==========================================================================
  console.log("\n== Halaman: batas, lewati, adaLagi ==");
  {
    const baris = (id) => ({ ...barisUtama[0], perkaraId: id });

    bersihkan();
    barisUtama = [baris(1), baris(2), baris(3)];
    const h1 = await layanan.cariPerkaraHalaman("", { jenisPerkara: "Cerai", batas: 2, lewati: 4 });
    // LIMIT/OFFSET berada di tabel turunan `halaman` - halaman ditentukan
    // dulu, baru disambung ke putusan (lihat layanan). Angkanya tetap dipatok.
    periksa("meminta satu baris lebih, mulai dari lewati", /LIMIT 3 OFFSET 4\) halaman\b/.test(sqlUtama()));
    periksa(
      "halaman ditentukan dulu: syarat, urutan, LIMIT di dalam `halaman`; putusan disambung sesudahnya; urutan diulang di akhir",
      new RegExp(
        [
          String.raw`FROM \(SELECT p\.perkara_id, p\.tanggal_pendaftaran\s+FROM perkara p\s+WHERE [\s\S]+?`,
          String.raw`ORDER BY p\.tanggal_pendaftaran DESC, p\.perkara_id DESC\s+LIMIT 3 OFFSET 4\) halaman\s+`,
          String.raw`JOIN perkara pr ON pr\.perkara_id = halaman\.perkara_id\s+LEFT JOIN \([\s\S]+\) pu ON pu\.perkara_id = pr\.perkara_id\s+`,
          String.raw`ORDER BY halaman\.tanggal_pendaftaran DESC, halaman\.perkara_id DESC\s*$`,
        ].join("")
      ).test(sqlUtama())
    );
    periksa("baris kelebihan dibuang", h1.perkara.length === 2);
    periksa("adaLagi benar bila kelebihan ada", h1.adaLagi === true);

    bersihkan();
    barisUtama = [baris(1), baris(2)];
    const h2 = await layanan.cariPerkaraHalaman("", { jenisPerkara: "Cerai", batas: 2 });
    periksa("adaLagi salah bila tepat habis", h2.adaLagi === false && h2.perkara.length === 2);

    for (const [batas, harap] of [[9999, 501], [500, 501], [0, 26], ["abc", 26], [-5, 2]]) {
      bersihkan();
      await layanan.cariPerkaraHalaman("", { jenisPerkara: "Cerai", batas });
      periksa(`batas ${JSON.stringify(batas)} dipagari (LIMIT ${harap})`, new RegExp(`LIMIT ${harap} OFFSET 0\\) halaman\\b`).test(sqlUtama()));
    }
    bersihkan();
    await layanan.cariPerkaraHalaman("", { jenisPerkara: "Cerai", lewati: "1; DROP TABLE perkara" });
    periksa("lewati asing menjadi 0, tidak disambung", /OFFSET 0\) halaman\b/.test(sqlUtama()) && !sqlUtama().includes("DROP"));
  }

  {
    // Halaman sesudah hasil terakhir lapis cepat TIDAK boleh diam-diam
    // berpindah ke lapis dalam.
    bersihkan();
    antreanUtama.push([]); // halaman ke-2 lapis cepat: kosong
    antreanUtama.push([barisUtama[0]]); // pemeriksa halaman awal: berisi
    const h = await layanan.cariPerkaraHalaman("Dirman", { lewati: 25 });
    const utama = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));
    periksa("halaman kosong lapis cepat tetap lapis cepat", h.lapis === "cepat" && h.perkara.length === 0);
    periksa("pemeriksa halaman awal memakai LIMIT 1 OFFSET 0", utama.length === 2 && /LIMIT 1 OFFSET 0\) halaman\b/.test(utama[1].sql));
    periksa("lapis dalam tidak dijalankan", !utama.some((q) => /perkara_pertimbangan_hukum/.test(q.sql)));

    bersihkan();
    antreanUtama.push([]); // halaman ke-2 lapis cepat: kosong
    antreanUtama.push([]); // halaman awal pun kosong
    antreanUtama.push([barisUtama[0]]); // lapis dalam
    const d = await layanan.cariPerkaraHalaman("dukhul", { lewati: 25 });
    const utamaD = kueri.filter((q) => /FROM perkara p\b/.test(q.sql));
    periksa("lapis cepat kosong sama sekali -> diperdalam dengan lewati yang sama",
      d.lapis === "dalam" && utamaD.length === 3 && /LIMIT 26 OFFSET 25\) halaman\b/.test(utamaD[2].sql));
  }

  // ==========================================================================
  console.log("\n== Ruas rinci per baris ==");
  {
    bersihkan();
    barisUtama = [
      { ...barisUtama[0], perkaraId: 9971, alurPerkaraId: 15, tanggalDaftar: "2026-09-02", tanggalPutusan: null },
      { ...barisUtama[0], perkaraId: 9972, nomorPerkara: "12/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak",
        alurPerkaraId: 15, tanggalDaftar: "2026-01-05", tanggalPutusan: "2026-03-01" },
      { ...barisUtama[0], perkaraId: 9973, nomorPerkara: "7/Pdt.P/2026/PA.Dgl", jenisPerkara: "Istbat Nikah",
        alurPerkaraId: 16, tanggalDaftar: "2026-09-25", tanggalPutusan: null },
    ];
    barisTambahan.set(/FROM perkara pr\b/, [
      { perkaraId: 9971, jenisPerkaraId: 347, tahapan: "Persidangan", proses: "Sidang pertama" },
      { perkaraId: 9972, jenisPerkaraId: 346, tahapan: "Akta Cerai", proses: "Pembuatan Akta Cerai" },
      { perkaraId: 9973, jenisPerkaraId: 360, tahapan: "Pendaftaran", proses: "Pendaftaran Perkara" },
    ]);
    barisTambahan.set(/FROM perkara_pihak1 a\b/, [
      { ke: 1, perkaraId: 9971, nama: "SITI PENGGUGAT" },
      { ke: 2, perkaraId: 9971, nama: "ANDI TERGUGAT" },
      { ke: 2, perkaraId: 9971, nama: "BUDI TERGUGAT II" },
      { ke: 1, perkaraId: 9972, nama: "PEMOHON TALAK" },
      { ke: 2, perkaraId: 9972, nama: "TERMOHON TALAK" },
    ]);
    // Kuasa bersisi (pihak_ke) dan berid orang (pengacara_id): satu orang
    // disebut sekali per sisi, dan sisinya disebut.
    barisTambahan.set(/FROM perkara_pengacara k\b[\s\S]*aktif = 'Y'/, [
      { perkaraId: 9971, pihakKe: 1, orang: 5, nama: "Andi Baso, S.H." },
      { perkaraId: 9971, pihakKe: 1, orang: 5, nama: "Andi Baso, S.H." },
      { perkaraId: 9972, pihakKe: 1, orang: 6, nama: "Rahmat, S.H." },
      { perkaraId: 9972, pihakKe: 2, orang: 7, nama: "Nurul, S.H." },
      { perkaraId: 9973, pihakKe: 2, orang: 8, nama: "Hasan, S.H." },
    ]);
    barisTambahan.set(/FROM perkara_hakim_pn hk\b[\s\S]*aktif = 'Y'/, [
      { perkaraId: 9971, nama: "Hakim Ketua Satu" },
      { perkaraId: 9971, nama: "Hakim Anggota" },
    ]);
    // Juru sita yang sama (jurusita_id 22) ditunjuk lagi dengan ejaan lain:
    // disebut SEKALI, berejaan baris pertamanya (tahapan terakhir).
    barisTambahan.set(/FROM perkara_jurusita js\b[\s\S]*aktif = 'Y'/, [
      { perkaraId: 9971, orang: 22, nama: "Mohammad Syukri, S.H." },
      { perkaraId: 9971, orang: 22, nama: "Mohammad Syukri" },
      { perkaraId: 9971, orang: 23, nama: "Budi" },
    ]);
    barisTambahan.set(/FROM perkara_panitera_pn pn\b[\s\S]*aktif = 'Y'/, [
      { perkaraId: 9971, orang: 3, nama: "Panitera Satu, S.H." },
      { perkaraId: 9971, orang: 3, nama: "Panitera Satu" },
    ]);
    barisTambahan.set(/FROM perkara_jadwal_sidang j\b[\s\S]*GROUP BY/, [
      { perkaraId: 9971, jumlahLewat: "2", terakhir: "2026-09-16", berikut: "2026-09-25" },
    ]);
    barisTambahan.set(/FROM perkara_efiling_id k\b/, [{ perkaraId: 9972 }]);
    barisTambahan.set(/tgl_akta_cerai[\s\S]*FROM perkara_akta_cerai ac\b/, [
      { perkaraId: 9972, nomor: "88/AC/2026/PA.Dgl", tanggal: "2026-03-20" },
    ]);

    const h = await layanan.cariPerkaraHalaman("", { jenisPerkara: "Cerai", hariIni: "2026-09-25" });
    const [a, b, c] = h.perkara;
    const sidangSql = kueri.find((q) => /FROM perkara_jadwal_sidang j\b[\s\S]*GROUP BY/.test(q.sql));

    // Dua arah: pihak kedua tidak boleh tertukar dengan pihak pertama.
    periksa("pihak1 = sisi pertama", a.pihak1 === "SITI PENGGUGAT");
    periksa("pihak2 = sisi kedua, berurutan, dipisah '; '", a.pihak2 === "ANDI TERGUGAT; BUDI TERGUGAT II");
    periksa("kuasa: satu orang sekali, dengan sisinya", a.kuasa === "Kuasa Penggugat: Andi Baso, S.H.");
    periksa(
      "kuasa kedua sisi disebut sisinya masing-masing (cerai talak: Pemohon/Termohon)",
      b.kuasa === "Kuasa Pemohon: Rahmat, S.H.; Kuasa Termohon: Nurul, S.H."
    );
    periksa(
      "kuasa pihak kedua saja tidak terbaca kuasa pihak pertama",
      c.kuasa === "Kuasa Termohon: Hasan, S.H."
    );
    periksa("juru sita yang sama berejaan dua disebut sekali", a.jurusita === "Mohammad Syukri, S.H.; Budi");
    periksa("panitera yang sama berejaan dua disebut sekali", a.paniteraPengganti === "Panitera Satu, S.H.");
    periksa(
      "kueri kuasa/juru sita/panitera membaca id orangnya",
      ["perkara_pengacara k", "perkara_jurusita js", "perkara_panitera_pn pn"].every((t) =>
        kueri.some((q) => q.sql.includes(`FROM ${t}`) && /AS orang\b/.test(q.sql))
      ) && kueri.some((q) => /FROM perkara_pengacara k\b/.test(q.sql) && /k\.pihak_ke AS pihakKe/.test(q.sql))
    );
    periksa("hakim ketua = baris pertama menurut urutan kuerinya", a.hakimKetua === "Hakim Ketua Satu");
    periksa("tahapan & proses dari perkara", a.tahapan === "Persidangan" && b.proses === "Pembuatan Akta Cerai");
    periksa("jumlah sidang dan tanggalnya", a.jumlahSidang === 2 && a.sidangTerakhir === "2026-09-16" && a.sidangBerikut === "2026-09-25");
    periksa("tanggal acuan sidang lewat parameter", Boolean(sidangSql) && sidangSql.params.slice(0, 3).every((x) => x === "2026-09-25"));
    periksa("perkara tanpa jadwal: 0 sidang, tanggal kosong", c.jumlahSidang === 0 && c.sidangTerakhir === "" && c.sidangBerikut === "");
    periksa("umur belum putus = sampai hari ini", a.umurHari === 23);
    periksa("umur sudah putus = sampai tanggal putus", b.umurHari === 55);
    periksa("umur didaftar hari ini = 0", c.umurHari === 0);
    periksa("e-Court benar/salah bila terbaca", a.ecourt === false && b.ecourt === true);
    periksa("akta cerai", b.nomorAktaCerai === "88/AC/2026/PA.Dgl" && b.tanggalAktaCerai === "2026-03-20" && a.nomorAktaCerai === "");
    periksa("jenis_perkara_id terbawa", a.jenisPerkaraId === 347 && b.jenisPerkaraId === 346);
    // Sebutan menurut NOMOR alur/jenis, bukan kata: cerai talak bernomor
    // Pdt.G tetapi Pemohon/Termohon.
    periksa("sebutan gugatan", a.sebutanPihak1 === "Penggugat" && a.sebutanPihak2 === "Tergugat");
    periksa("sebutan cerai talak (346) Pemohon/Termohon", b.sebutanPihak1 === "Pemohon" && b.sebutanPihak2 === "Termohon");
    periksa("sebutan alur permohonan", c.sebutanPihak1 === "Pemohon" && c.sebutanPihak2 === "Termohon");
    periksa("tidak ada ruas tak terbaca", h.ruasTakTerbaca.length === 0);
  }

  // ==========================================================================
  console.log("\n== Galat habis waktu pencarian ==");
  {
    // Bentuk PERSIS galat driver mysql yang terukur pada bot hidup 26
    // September 2026 - dulu diteruskan mentah sampai ke kotak galat layar.
    bersihkan();
    const galatDriver = Object.assign(new Error("Query inactivity timeout"), { code: "PROTOCOL_SEQUENCE_TIMEOUT", fatal: true });
    require.cache[dbPath].exports.query = (sql, params, selesai) => {
      kueri.push({ sql: String(sql), params });
      if (/FROM perkara p\b/.test(sql)) {
        selesai(galatDriver);
        return;
      }
      selesai(null, []);
    };
    const asliWarn = console.warn;
    const dicatat = [];
    console.warn = (...isi) => dicatat.push(isi.join(" "));
    let galat = null;
    try {
      await layanan.cariPerkaraHalaman("Sudarmin", {});
    } catch (e) {
      galat = e;
    } finally {
      console.warn = asliWarn;
    }
    periksa(
      "habis waktu: dilempar berkode PENCARIAN_HABIS_WAKTU, berbahasa Indonesia",
      Boolean(galat) &&
        galat.code === layanan.KODE_PENCARIAN_HABIS_WAKTU &&
        /^Pencarian dihentikan karena melewati batas \d+ detik untuk membaca SIPP\. /.test(galat.message) &&
        !/timeout|inactivity/i.test(galat.message)
    );
    periksa("habis waktu: sebab aslinya dibawa, pesan mentahnya dicatat", Boolean(galat) && galat.cause === galatDriver &&
      dicatat.some((x) => x.includes("Query inactivity timeout")));
    periksa("rute: galat mentah (mis. saat menjemput tag) juga diterjemahkan", layanan.pesanGalatPencarian(galatDriver) === (galat && galat.message));

    bersihkan();
    const galatLain = Object.assign(new Error("Table 'sipp.perkara' doesn't exist"), { code: "ER_NO_SUCH_TABLE" });
    require.cache[dbPath].exports.query = (sql, params, selesai) => {
      if (/FROM perkara p\b/.test(sql)) {
        selesai(galatLain);
        return;
      }
      selesai(null, []);
    };
    let galat2 = null;
    try {
      await layanan.cariPerkaraHalaman("419", {});
    } catch (e) {
      galat2 = e;
    }
    periksa("galat lain diteruskan APA ADANYA - tidak ditelan, tidak diganti", galat2 === galatLain &&
      layanan.pesanGalatPencarian(galatLain) === "Table 'sipp.perkara' doesn't exist");
    bersihkan();
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
