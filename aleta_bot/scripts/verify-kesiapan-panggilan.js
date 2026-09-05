"use strict";

/**
 * Kepatutan panggilan dan skor kesiapan sidang.
 *
 * ============================================================================
 * INI LOGIKA YANG BERSINGGUNGAN DENGAN KEABSAHAN PANGGILAN
 * ============================================================================
 *
 * Aturan yang dijaga di sini:
 *
 *   SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B angka 7 huruf d
 *     panggilan elektronik paling lambat 3 (tiga) Hari sebelum jadwal sidang
 *
 *   SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B angka 8 huruf c
 *     surat tercatat paling lambat 6 (enam) Hari sebelum hari sidang DAN
 *     diterima di alamat tergugat berdasarkan lacak kiriman
 *
 *   Pasal 122 HIR
 *     perkara biasa: tidak kurang dari tiga hari KERJA
 *
 * "Hari" pada SK KMA adalah hari KALENDER. Salah di sini berarti panggilan yang
 * sah ditandai cacat, atau - yang jauh lebih berbahaya - panggilan yang cacat
 * diloloskan. Karena itu pemeriksaannya menjalankan penilaian sungguhan dengan
 * tanggal sungguhan, bukan mencocokkan pola tulisan.
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

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query: (sql, params, callback) => callback(null, []) },
};

const panggilan = require("../services/ecourtPanggilanService");
const kesiapan = require("../services/kesiapanSidangService");
const scraper = require("../tools/ecourt-bridge/scraper");

console.log("\n== Ambang tiap jalur sesuai dasar hukumnya ==");
{
  const elektronik = panggilan.ambangJalur("elektronik");
  periksa("elektronik 3 hari", elektronik.hari === 3);
  // "Hari" pada SK KMA adalah hari KALENDER, bukan hari kerja.
  periksa("elektronik memakai hari kalender", elektronik.hariKerja === false);
  periksa("elektronik tidak menuntut bukti terima", elektronik.perluDiterima === false);
  periksa("dasar elektronik disebut", /angka 7 huruf d/.test(elektronik.dasar));

  const pos = panggilan.ambangJalur("surat_tercatat");
  periksa("surat tercatat 6 hari", pos.hari === 6);
  periksa("surat tercatat memakai hari kalender", pos.hariKerja === false);
  // Angka 8 huruf c menuntut suratnya DITERIMA, bukan sekadar dikirim.
  periksa("surat tercatat menuntut bukti terima", pos.perluDiterima === true);
  periksa("dasar surat tercatat disebut", /angka 8 huruf c/.test(pos.dasar));

  const biasa = panggilan.ambangJalur("biasa");
  periksa("perkara biasa 3 hari", biasa.hari === 3);
  // Pasal 122 HIR menghitung hari KERJA - berbeda dari SK KMA.
  periksa("perkara biasa memakai hari kerja", biasa.hariKerja === true);
  periksa("dasar perkara biasa disebut", /122 HIR/.test(biasa.dasar));
}

console.log("\n== Jalur seharusnya ==");
{
  // Penggugat/pemohon pada perkara e-Court SELALU elektronik - tidak ada
  // pilihan surat tercatat, apa pun isian persetujuannya.
  for (const persetujuan of ["setuju", "tidak_setuju", "belum"]) {
    periksa(
      `penggugat e-Court selalu elektronik (${persetujuan})`,
      panggilan.jalurSeharusnya({ peran: "Penggugat", persetujuan, lewatEcourt: true }) === "elektronik"
    );
  }
  periksa(
    "pemohon diperlakukan sama dengan penggugat",
    panggilan.jalurSeharusnya({ peran: "Pemohon", persetujuan: "belum", lewatEcourt: true }) === "elektronik"
  );

  periksa(
    "tergugat setuju -> elektronik",
    panggilan.jalurSeharusnya({ peran: "Tergugat", persetujuan: "setuju", lewatEcourt: true }) === "elektronik"
  );
  periksa(
    "tergugat menolak -> surat tercatat",
    panggilan.jalurSeharusnya({ peran: "Tergugat", persetujuan: "tidak_setuju", lewatEcourt: true }) ===
      "surat_tercatat"
  );
  // Belum menjawab BUKAN persetujuan.
  periksa(
    "tergugat belum menjawab -> surat tercatat",
    panggilan.jalurSeharusnya({ peran: "Tergugat", persetujuan: "belum", lewatEcourt: true }) ===
      "surat_tercatat"
  );

  // Perkara BIASA tidak mengenal jalur elektronik sama sekali.
  for (const peran of ["Penggugat", "Tergugat", "Turut Tergugat"]) {
    periksa(
      `perkara biasa: ${peran} lewat jurusita`,
      panggilan.jalurSeharusnya({ peran, persetujuan: "setuju", lewatEcourt: false }) === "biasa"
    );
  }
}

console.log("\n== Hitungan hari ==");
{
  // Kamis 27 Agustus 2026 ke Senin 31 Agustus 2026.
  periksa(
    "hari kerja melewati akhir pekan",
    panggilan.selisihHari("2026-08-27", "2026-08-31", { hariKerja: true }) === 2
  );
  periksa(
    "hari kalender menghitung akhir pekan",
    panggilan.selisihHari("2026-08-27", "2026-08-31", { hariKerja: false }) === 4
  );
  periksa(
    "jam tidak memengaruhi hitungan",
    panggilan.selisihHari(new Date("2026-08-27T23:59:00"), new Date("2026-08-31T00:01:00"), {
      hariKerja: true,
    }) === 2
  );
}

console.log("\n== Kepatutan: elektronik (ambang 3 hari kalender) ==");
{
  periksa(
    "tepat 3 hari kalender dinilai patut",
    panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-09-04",
      tanggalSidang: "2026-09-07",
      jalur: "elektronik",
    }).patut === true
  );
  // Sifat yang dijaga: 2 hari kalender TIDAK cukup, sekalipun kedua harinya
  // hari kerja. Jalur ini memakai hari kalender.
  periksa(
    "2 hari kalender tidak patut",
    panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-09-05",
      tanggalSidang: "2026-09-07",
      jalur: "elektronik",
    }).patut === false
  );
  const terlambat = panggilan.nilaiKepatutan({
    tanggalPanggilan: "2026-09-08",
    tanggalSidang: "2026-09-07",
    jalur: "elektronik",
  });
  periksa("dikirim setelah sidang dibedakan", terlambat.alasan === "dikirim_setelah_hari_sidang");
  periksa("dikirim setelah sidang tidak patut", terlambat.patut === false);

  const belum = panggilan.nilaiKepatutan({ tanggalPanggilan: null, tanggalSidang: "2026-09-07" });
  periksa("belum dikirim tidak dinilai", belum.patut === null);
  periksa("belum dikirim disebut apa adanya", belum.alasan === "belum_dikirim");
}

console.log("\n== Kepatutan: surat tercatat (ambang 6 hari + wajib diterima) ==");
{
  // Sifat yang dijaga: 5 hari kalender TIDAK cukup untuk surat tercatat,
  // walau cukup bagi jalur elektronik. Bawaan lama 3 hari akan meloloskan ini.
  periksa(
    "5 hari kalender tidak patut",
    panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-09-02",
      tanggalSidang: "2026-09-07",
      jalur: "surat_tercatat",
      diterima: true,
    }).patut === false
  );
  periksa(
    "6 hari kalender dan diterima: patut",
    panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-09-01",
      tanggalSidang: "2026-09-07",
      jalur: "surat_tercatat",
      diterima: true,
    }).patut === true
  );

  // Syarat KEDUA angka 8 huruf c: diterima di alamat tergugat. Tenggang yang
  // cukup saja belum memenuhi.
  const belumTerbukti = panggilan.nilaiKepatutan({
    tanggalPanggilan: "2026-08-01",
    tanggalSidang: "2026-09-07",
    jalur: "surat_tercatat",
    diterima: null,
  });
  periksa("tenggang jauh tetapi belum terbukti diterima: bukan patut", belumTerbukti.patut !== true);
  // BUKAN pula "tidak patut": tindak lanjutnya menelusuri kiriman, bukan
  // memanggil ulang.
  periksa("dan bukan pula tidak patut", belumTerbukti.patut === null);
  periksa("sebabnya disebutkan", belumTerbukti.alasan === "penerimaan_belum_terbukti");

  const gagalKirim = panggilan.nilaiKepatutan({
    tanggalPanggilan: "2026-08-01",
    tanggalSidang: "2026-09-07",
    jalur: "surat_tercatat",
    diterima: false,
  });
  periksa("lacak menunjukkan belum diterima dibedakan", gagalKirim.alasan === "belum_diterima");
}

console.log("\n== Membaca relaas SIPP ==");
{
  // Surat tercatat: yang dihitung tanggal KIRIM KE POS, bukan tanggal
  // pelaksanaan relaas - yang terakhir justru tanggal DITERIMANYA.
  const pos = panggilan.bacaRelaas({
    noResiPos: "P2607110003017",
    tanggalKirimPos: "2026-07-11",
    tanggalRelaas: "2026-07-14",
    statusPos: 1,
  });
  periksa("jalur pos dikenali", pos.jalur === "pos");
  periksa("tanggal kirim dari kolom pos", pos.tanggalKirim === "2026-07-11");
  periksa("lacak berhasil berarti diterima", pos.diterima === true);
  periksa("buktinya disebut lacak kiriman", pos.bukti === "lacak kiriman");

  const posTanpaLacak = panggilan.bacaRelaas({
    noResiPos: "P123",
    tanggalKirimPos: "2026-07-11",
    tanggalRelaas: null,
    statusPos: null,
  });
  periksa("pos tanpa lacak: penerimaan belum diketahui", posTanpaLacak.diterima === null);

  const posDilaksanakan = panggilan.bacaRelaas({
    noResiPos: "P123",
    tanggalKirimPos: "2026-07-11",
    tanggalRelaas: "2026-07-15",
    statusPos: null,
  });
  // Jurusita mencatat pelaksanaan relaas hanya setelah diserahkan - itu bukti
  // penerimaan yang sah, walau lacak posnya belum diketahui.
  periksa("relaas terlaksana juga bukti penerimaan", posDilaksanakan.diterima === true);
  periksa("buktinya disebut relaas jurusita", posDilaksanakan.bukti === "relaas jurusita");

  const langsung = panggilan.bacaRelaas({
    noResiPos: "",
    tanggalKirimPos: null,
    tanggalRelaas: "2026-07-09",
    statusPos: null,
  });
  periksa("relaas tanpa jejak pos bukan jalur pos", langsung.jalur === "langsung");
  periksa("tanggalnya dari pelaksanaan relaas", langsung.tanggalKirim === "2026-07-09");
}

console.log("\n== Perkara nyata 399/Pdt.G/2026/PA.Dgl, sidang 23 Juli 2026 ==");
{
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-07-23",
    lewatEcourt: true,
    persetujuan: [
      { nama: "Sakina alias Nur Sakina binti Moh. Iwan", peran: "Penggugat", persetujuan: "setuju" },
      { nama: "Kuswandi bin Said Hada", peran: "Tergugat", persetujuan: "tidak_setuju" },
    ],
    panggilan: [],
    relaas: [
      {
        namaPihak: "Sakina alias Nur Sakina binti Moh. Iwan",
        tanggalRelaas: "2026-07-09",
        tanggalKirimPos: null,
        statusPos: null,
        noResiPos: "",
      },
      {
        namaPihak: "Kuswandi bin Said Hada",
        tanggalRelaas: "2026-07-14",
        tanggalKirimPos: "2026-07-11",
        statusPos: 1,
        noResiPos: "P2607110003017",
      },
    ],
  });

  const penggugat = hasil.pihak[0];
  const tergugat = hasil.pihak[1];

  periksa("penggugat: jalur elektronik", penggugat.seharusnya === "elektronik");
  periksa("penggugat: 14 hari kalender", penggugat.kepatutan.selisih === 14);
  periksa("penggugat: patut", penggugat.kepatutan.patut === true);

  periksa("tergugat: jalur surat tercatat", tergugat.seharusnya === "surat_tercatat");
  periksa("tergugat: dihitung dari tanggal kirim pos", tergugat.tanggalPanggilan === "2026-07-11");
  periksa("tergugat: 12 hari kalender", tergugat.kepatutan.selisih === 12);
  periksa("tergugat: diterima terbukti", tergugat.diterima === true);
  periksa("tergugat: patut", tergugat.kepatutan.patut === true);

  periksa("tidak ada salah saluran", hasil.ringkasan.salahSaluran === 0);
  periksa("dua-duanya patut", hasil.ringkasan.patut === 2);
}

console.log("\n== Sidang lanjutan: yang hadir tidak dipanggil lagi ==");
{
  // Sidang lanjutan. Pada sidang sebelumnya penggugat hadir, tergugat tidak -
  // sehingga yang wajib dipanggil tinggal tergugat (sisi 2).
  const isian = {
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    persetujuan: [
      { nama: "Sakina", peran: "Penggugat", persetujuan: "setuju" },
      { nama: "Kuswandi", peran: "Tergugat", persetujuan: "tidak_setuju" },
    ],
    panggilan: [],
    // Hanya tergugat yang dipanggil. Penggugat tidak, karena sudah hadir.
    relaas: [
      {
        namaPihak: "Kuswandi",
        tanggalRelaas: "2026-08-25",
        tanggalKirimPos: "2026-08-20",
        statusPos: 1,
        noResiPos: "P1",
      },
    ],
  };

  const tanpaAturan = panggilan.susunKeadaanPanggilan(isian);
  // Inilah keadaan sebelum perbaikan: penggugat yang hadir tetap terhitung
  // belum dipanggil, dan itu penghambat BERAT pada skor kesiapan.
  periksa("tanpa daftar sisi wajib: penggugat terhitung belum dipanggil", tanpaAturan.ringkasan.belumDipanggil === 1);

  const denganAturan = panggilan.susunKeadaanPanggilan({ ...isian, sisiWajib: [2] });
  periksa("dengan daftar sisi wajib: tidak ada yang belum dipanggil", denganAturan.ringkasan.belumDipanggil === 0);
  periksa("penggugat ditandai tidak perlu dipanggil", denganAturan.ringkasan.tidakPerluDipanggil === 1);
  periksa("tergugat tetap dinilai kepatutannya", denganAturan.ringkasan.patut === 1);

  // Sifat yang dijaga: membebaskan pihak dari kewajiban dipanggil TIDAK cukup
  // bila ia lalu jatuh lewat pintu lain. Skor kesiapan menghitung tidakPatut
  // dan penerimaanBelumTerbukti sebagai penghambat tersendiri - pihak tanpa
  // panggilan yang memang tidak perlu dipanggil tidak boleh masuk keduanya.
  periksa("pihak yang dibebaskan tidak dihitung tidak patut", denganAturan.ringkasan.tidakPatut === 0);
  periksa(
    "pihak yang dibebaskan tidak dihitung penerimaan belum terbukti",
    denganAturan.ringkasan.penerimaanBelumTerbukti === 0
  );

  // Sifat yang dijaga: pelonggaran ini TIDAK boleh membungkam pihak yang
  // memang wajib dipanggil dan belum dipanggil.
  const wajibKeduanya = panggilan.susunKeadaanPanggilan({ ...isian, sisiWajib: [1, 2] });
  periksa("bila keduanya wajib, penggugat tetap terhitung belum dipanggil", wajibKeduanya.ringkasan.belumDipanggil === 1);

  // Sifat yang dijaga: kedudukan yang TIDAK terbaca tidak pernah dibebaskan.
  // Menebak kedudukan lalu membebaskannya dari panggilan adalah cara paling
  // sunyi membuat pihak benar-benar tidak terpanggil.
  const tanpaPeran = panggilan.susunKeadaanPanggilan({
    ...isian,
    persetujuan: [{ nama: "Entah", peran: "", persetujuan: "belum" }],
    relaas: [],
    sisiWajib: [2],
  });
  periksa("kedudukan tak terbaca tetap wajib dipanggil", tanpaPeran.ringkasan.belumDipanggil === 1);
  periksa("kedudukan tak terbaca tidak dibebaskan", tanpaPeran.ringkasan.tidakPerluDipanggil === 0);

  // Sifat yang dijaga: sisiWajib yang tidak diberikan (null) berperilaku
  // seperti sebelumnya - gagal-tertutup.
  const nol = panggilan.susunKeadaanPanggilan({ ...isian, sisiWajib: null });
  periksa("sisi wajib null berperilaku seperti semula", nol.ringkasan.belumDipanggil === 1);

  // Semua hadir pada sidang sebelumnya: tidak ada yang wajib dipanggil.
  const semuaHadir = panggilan.susunKeadaanPanggilan({ ...isian, relaas: [], sisiWajib: [] });
  periksa("semua hadir: tidak ada yang belum dipanggil", semuaHadir.ringkasan.belumDipanggil === 0);
  periksa("semua hadir: keduanya ditandai tidak perlu dipanggil", semuaHadir.ringkasan.tidakPerluDipanggil === 2);
}

console.log("\n== Kedudukan pihak dibaca dari katanya ==");
{
  periksa("Penggugat sisi 1", panggilan.sisiPihak("Penggugat") === 1);
  periksa("Pemohon sisi 1", panggilan.sisiPihak("Pemohon") === 1);
  periksa("Penggugat/Pemohon sisi 1", panggilan.sisiPihak("Penggugat/Pemohon") === 1);
  periksa("Tergugat sisi 2", panggilan.sisiPihak("Tergugat") === 2);
  periksa("Termohon sisi 2", panggilan.sisiPihak("Termohon") === 2);
  periksa("Tergugat II sisi 2", panggilan.sisiPihak("Tergugat II") === 2);
  periksa("kosong tidak dikenali", panggilan.sisiPihak("") === 0);
  periksa("Turut Termohon tetap sisi 2", panggilan.sisiPihak("Turut Termohon") === 2);
}
console.log("\n== Saluran yang tidak sesuai ==");
{
  // Penggugat e-Court dipanggil lewat pos - salah, apa pun tenggangnya.
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    persetujuan: [{ nama: "Bida", peran: "Penggugat", persetujuan: "setuju" }],
    panggilan: [],
    relaas: [
      { namaPihak: "Bida", tanggalRelaas: "2026-08-25", tanggalKirimPos: "2026-08-20", statusPos: 1, noResiPos: "P1" },
    ],
  });
  periksa("penggugat dipanggil pos ditandai salah saluran", hasil.ringkasan.salahSaluran === 1);
  // Sifat yang dijaga: dinilai menurut jalur SEHARUSNYA. Panggilan lewat jalur
  // keliru tidak menjadi patut hanya karena jalur kelirunya berambang berbeda.
  periksa("dinilai dengan ambang elektronik", hasil.pihak[0].kepatutan.ambang === 3);
}

console.log("\n== Perkara biasa (non-e-Court) ==");
{
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: false,
    persetujuan: [],
    panggilan: [],
    relaas: [
      { namaPihak: "Ahmad", tanggalRelaas: "2026-09-02", tanggalKirimPos: null, statusPos: null, noResiPos: "" },
    ],
  });
  // Tanpa daftar persetujuan e-Court, pihaknya diambil dari relaas SIPP -
  // tanpa itu perkara biasa akan tampak tidak punya pihak sama sekali.
  periksa("pihak dibaca dari relaas SIPP", hasil.pihak.length === 1);
  periksa("jalurnya biasa", hasil.pihak[0].seharusnya === "biasa");
  periksa("memakai hari kerja", hasil.pihak[0].kepatutan.hariKerja === true);
  // Rabu 2 Sep ke Senin 7 Sep = Kam, Jum, Sen = 3 hari kerja.
  periksa("3 hari kerja dinilai patut", hasil.pihak[0].kepatutan.patut === true);
}

console.log("\n== Skor kesiapan ==");
{
  const lengkap = kesiapan.nilaiKesiapan({
    tanggalSidang: "2026-09-07",
    agenda: "Sidang Pertama",
    lewatEcourt: true,
    majelis: [{ nama: "Ahmad" }],
    panitera: [{ nama: "Dewi" }],
    persetujuan: [{ nama: "Bida", peran: "Penggugat", persetujuan: "setuju" }],
    panggilan: [{ namaPihak: "Bida", tanggalSidang: "2026-09-07", dikirimPada: "2026-08-26" }],
    relaas: [],
    dokumen: [{ adaPdf: true, statusVerifikasi: "valid" }],
    nomorPihak: [{ adaNomor: true, statusVerifikasi: "terverifikasi" }],
  });
  periksa("sidang lengkap bernilai penuh", lengkap.skor === 100);
  periksa("dan keadaannya siap", lengkap.keadaan === "siap");
}
{
  // Sifat yang dijaga: sidang TANPA data harus bernilai rendah, bukan penuh.
  const kosong = kesiapan.nilaiKesiapan({ tanggalSidang: "2026-09-07" });
  periksa("tanpa data bernilai nol", kosong.skor === 0);
  periksa("dan keadaannya bermasalah", kosong.keadaan === "bermasalah");
}
{
  // Penerimaan yang belum terbukti: sedang, bukan berat - dan sidangnya tidak
  // otomatis disebut bermasalah karena itu saja.
  const belumTerbukti = kesiapan.nilaiKesiapan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    majelis: [{ nama: "Ahmad" }],
    panitera: [{ nama: "Dewi" }],
    persetujuan: [{ nama: "Salbi", peran: "Tergugat", persetujuan: "tidak_setuju" }],
    panggilan: [],
    relaas: [
      { namaPihak: "Salbi", tanggalRelaas: null, tanggalKirimPos: "2026-08-20", statusPos: null, noResiPos: "P1" },
    ],
    dokumen: [{ adaPdf: true, statusVerifikasi: "valid" }],
    nomorPihak: [{ adaNomor: true }],
  });
  const hambat = belumTerbukti.penghambat.find((x) => x.kunci === "penerimaan_belum_terbukti");
  periksa("penerimaan belum terbukti tercatat", Boolean(hambat));
  periksa("tingkatnya sedang, bukan berat", hambat && hambat.tingkat === "sedang");
  periksa("tidak langsung disebut bermasalah", belumTerbukti.keadaan !== "bermasalah");
}
{
  // Berkas pendaftaran tidak mengenal verifikasi.
  const pendaftaran = kesiapan.nilaiKesiapan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    majelis: [{ nama: "Ahmad" }],
    panitera: [{ nama: "Dewi" }],
    persetujuan: [{ nama: "Bida", peran: "Penggugat", persetujuan: "setuju" }],
    panggilan: [{ namaPihak: "Bida", tanggalSidang: "2026-09-07", dikirimPada: "2026-08-26" }],
    relaas: [],
    dokumen: [
      { adaPdf: true, statusVerifikasi: "tidak_perlu" },
      { adaPdf: true, statusVerifikasi: "tidak_perlu" },
    ],
    nomorPihak: [{ adaNomor: true }],
  });
  periksa(
    "berkas pendaftaran tidak dihitung menunggu majelis",
    !pendaftaran.penghambat.some((x) => x.kunci === "menunggu_verifikasi_majelis")
  );
}
{
  const pertama = kesiapan.nilaiKesiapan({ tanggalSidang: "2026-09-07", agenda: "Sidang Pertama" });
  periksa(
    "sidang pertama tidak menagih saksi",
    !pertama.penghambat.some((x) => x.kunci === "saksi_belum_tercatat")
  );
  const buktikan = kesiapan.nilaiKesiapan({ tanggalSidang: "2026-09-07", agenda: "Pembuktian Penggugat" });
  periksa(
    "agenda pembuktian menagih saksi",
    buktikan.penghambat.some((x) => x.kunci === "saksi_belum_tercatat")
  );
}

console.log("\n== Kedudukan pihak dibaca dari SIPP saat e-Court belum ditarik ==");
{
  // Perkara 191/Pdt.P/2026: dua PEMOHON, dipanggil elektronik. e-Court belum
  // pernah ditarik sehingga daftar persetujuannya kosong.
  //
  // Sifat yang dijaga: kedudukan pihak dibaca dari relaas SIPP. Tanpa itu,
  // pemohon terbaca tanpa kedudukan lalu dinilai harus dipanggil lewat surat
  // tercatat - dan panggilan elektroniknya yang sudah benar ditandai salah
  // saluran, bertingkat BERAT.
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-08-31",
    lewatEcourt: true,
    persetujuan: [],
    panggilan: [],
    relaas: [
      {
        namaPihak: "Renaldi bin Mohammad Nur",
        peran: "Penggugat/Pemohon",
        pihakKe: 1,
        tanggalRelaas: "2026-08-20",
        tanggalKirimPos: null,
        statusPos: null,
        noResiPos: "",
      },
    ],
  });

  periksa("pemohon dikenali dari relaas SIPP", hasil.pihak[0].peran === "Penggugat/Pemohon");
  periksa("jalurnya elektronik, bukan surat tercatat", hasil.pihak[0].seharusnya === "elektronik");
  periksa("tidak ditandai salah saluran", hasil.ringkasan.salahSaluran === 0);
  periksa("dan dinilai patut", hasil.pihak[0].kepatutan.patut === true);
}

console.log("\n== SIPP didahulukan, e-Court melengkapi ==");
{
  // Sifat yang dijaga: relaas SIPP adalah catatan resmi pengadilan. Catatan
  // e-Court TIDAK boleh menimpanya - sebelumnya urutannya terbalik.
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    persetujuan: [{ nama: "Bida", peran: "Penggugat", persetujuan: "setuju" }],
    panggilan: [{ namaPihak: "Bida", tanggalSidang: "2026-09-07", dikirimPada: "2026-09-05" }],
    relaas: [
      { namaPihak: "Bida", peran: "Penggugat/Pemohon", tanggalRelaas: "2026-08-20", tanggalKirimPos: null, statusPos: null, noResiPos: "" },
    ],
  });
  periksa("tanggal dari relaas SIPP yang dipakai", hasil.pihak[0].tanggalPanggilan === "2026-08-20");
}
{
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    persetujuan: [{ nama: "Bida", peran: "Penggugat", persetujuan: "setuju" }],
    panggilan: [{ namaPihak: "Bida", tanggalSidang: "2026-09-07", dikirimPada: "2026-08-26" }],
    relaas: [],
  });
  periksa("e-Court dipakai saat SIPP kosong", hasil.pihak[0].tanggalPanggilan === "2026-08-26");
  periksa("sumbernya disebutkan", hasil.pihak[0].buktiPenerimaan.includes("e-Court"));
}

console.log("\n== Pihak dari kedua sumber digabung ==");
{
  const hasil = panggilan.susunKeadaanPanggilan({
    tanggalSidang: "2026-09-07",
    lewatEcourt: true,
    persetujuan: [{ nama: "SALBI BIN SARUNA", peran: "", persetujuan: "tidak_setuju" }],
    relaas: [
      { namaPihak: "Salbi  bin   Saruna", peran: "Tergugat/Termohon", tanggalRelaas: "2026-08-25", tanggalKirimPos: "2026-08-20", statusPos: 1, noResiPos: "P1" },
    ],
    panggilan: [],
  });
  periksa("satu pihak, bukan dua", hasil.pihak.length === 1);
  periksa("kedudukan dari SIPP terbawa", hasil.pihak[0].peran === "Tergugat/Termohon");
  periksa("persetujuan dari e-Court terbawa", hasil.pihak[0].persetujuan === "tidak_setuju");
  periksa("jalurnya surat tercatat", hasil.pihak[0].seharusnya === "surat_tercatat");
}

console.log("\n== Pengurai halaman e-Court ==");
{
  const html = [
    "<h3>Persetujuan Pihak Menggunakan Saluran Elektronik</h3>",
    '<table class="table table-email">',
    "<thead><tr><th>No.</th><th>Nama</th><th>Alamat</th><th>Telp</th><th>Persetujuan</th><th>Aksi</th></tr></thead>",
    "<tbody>",
    "<tr><td>1</td><td>Bida binti Pakalibu <br>(Penggugat)</td><td>Desa Balane</td>",
    "<td>Telp : 082363402264<br>Email : a@b.com</td>",
    '<td class="text-center"><i class="fa fa-check-circle"></i></td><td><button>Edit</button></td></tr>',
    "<tr><td>2</td><td>Salbi bin Saruna <br>(Tergugat)</td><td>Desa Balane</td>",
    "<td>Telp : 085389014940<br>Email : c@d.com</td>",
    '<td class="text-center"><i class="fa fa-times-circle"></i></td><td><button>Edit</button></td></tr>',
    "<tr><td>3</td><td>Indah binti Saruna <br>(Tergugat)</td><td>Desa Balane</td>",
    "<td>Telp : 085389014940<br>Email : e@f.com</td>",
    '<td class="text-center"><i class="fa fa-square"></i></td><td><button>Edit</button></td></tr>',
    "</tbody></table>",
  ].join("\n");

  const pihak = scraper.extractPersetujuanPihak(html);
  periksa("tiga pihak terbaca", pihak.length === 3);
  periksa("centang hijau dibaca setuju", pihak[0].persetujuan === "setuju");
  periksa("silang merah dibaca tidak setuju", pihak[1].persetujuan === "tidak_setuju");
  periksa("tanpa ikon dibaca belum menjawab", pihak[2].persetujuan === "belum");
  periksa("nama dipisah dari kedudukannya", pihak[0].nama === "Bida binti Pakalibu");
  periksa("kedudukan terbaca", pihak[0].peran === "Penggugat");
}
{
  const html = [
    "<h3>Panggilan (e-Summons)</h3>",
    '<table class="table table-email">',
    "<thead><tr><th>No.</th><th>Jenis</th><th>Pihak</th><th>Dokumen</th></tr></thead>",
    "<tbody><tr><td>1</td>",
    "<td>Panggilan Sidang<br>Nomor : 542/Pdt.G/2026/PA.Dgl<br><b>Tgl. Sidang :</b> Senin, 07 September 2026<br>Jam Sidang : 09:00 WIB</td>",
    "<td><b>Nama :</b> Bida binti Pakalibu<br><b>Email :</b> a@b.com</td>",
    "<td><b>Judul Dokumen :</b> Relaas Sidang<br><b>Pengiriman :</b> Rabu, 26 Agustus 2026 Jam : 11:01 WIB</td>",
    "</tr></tbody></table>",
  ].join("\n");

  const kirim = scraper.extractPanggilanElektronik(html);
  periksa("satu panggilan terbaca", kirim.length === 1);
  periksa("nama pihak terbaca", kirim[0].nama === "Bida binti Pakalibu");
  // Tanpa tanggal pengiriman, kepatutan tidak dapat dinilai sama sekali.
  periksa("tanggal pengiriman terbaca", kirim[0].dikirimPada === "2026-08-26");
  periksa("tanggal sidang terbaca", kirim[0].tanggalSidang === "2026-09-07");
}
{
  periksa("halaman tanpa tabel menghasilkan kosong", scraper.extractPersetujuanPihak("<html></html>").length === 0);
  periksa("panggilan tanpa tabel menghasilkan kosong", scraper.extractPanggilanElektronik("<html></html>").length === 0);
}

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
