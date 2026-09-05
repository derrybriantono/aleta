"use strict";

/**
 * Menguji pengenalan kolom SIPP dan penyusunan fakta penilaian, tanpa SIPP.
 *
 * Basis datanya digantikan tiruan yang menjawab information_schema dan kueri
 * tahapan, sehingga seluruh perilaku yang menentukan - kolom ada, kolom tidak
 * ada, isi kosong - dapat diuji di mesin mana pun.
 */

const path = require("path");
const Module = require("module");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  if (JSON.stringify(dapat) !== JSON.stringify(harap)) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

/**
 * Basis data tiruan.
 *
 * `kolom` menyebut kolom apa saja yang seolah-olah ada pada tiap tabel;
 * `baris` menjawab kueri tahapan. Kuerinya sendiri direkam supaya dapat
 * diperiksa - itulah cara memastikan kolom yang TIDAK ada memang tidak ikut
 * masuk SELECT.
 */
function buatDbTiruan({ kolom = {}, baris = {} } = {}) {
  const direkam = [];
  return {
    direkam,
    query(sql, params, callback) {
      direkam.push({ sql, params });

      if (/information_schema/i.test(sql)) {
        const hasil = [];
        for (const [tabel, daftar] of Object.entries(kolom)) {
          for (const nama of daftar) hasil.push({ tabel, kolom: nama });
        }
        return callback(null, hasil);
      }

      for (const [pola, isi] of Object.entries(baris)) {
        if (sql.includes(pola)) return callback(null, isi);
      }
      return callback(null, []);
    },
  };
}

/** Memuat ulang modul dengan db_config yang digantikan tiruan. */
function muatDengan(dbTiruan) {
  const jalurDb = require.resolve("../db_config");
  const jalurSkema = require.resolve("../services/sippSkemaService");
  const jalurTahapan = require.resolve("../services/sippTahapanService");
  // Layanan jejak audit ikut dimuat ulang: ia memegang rujukan basis datanya
  // sendiri dan menyimpan bentuk tabelnya, sehingga instance lama akan
  // menjawab dari basis data uji sebelumnya.
  const jalurAudit = require.resolve("../services/sippAuditService");

  for (const jalur of [jalurDb, jalurSkema, jalurTahapan, jalurAudit]) delete require.cache[jalur];
  require.cache[jalurDb] = new Module(jalurDb, null);
  require.cache[jalurDb].filename = jalurDb;
  require.cache[jalurDb].loaded = true;
  require.cache[jalurDb].exports = dbTiruan;

  return {
    skema: require("../services/sippSkemaService"),
    tahapan: require("../services/sippTahapanService"),
    audit: require("../services/sippAuditService"),
  };
}

async function utama() {
  console.log("");
  console.log("Uji pengenalan kolom SIPP dan tahapan perkara");
  console.log("");

  // -------------------------------------------------------------------------
  console.log("Kolom ketemu - tahapan dinilai");
  // -------------------------------------------------------------------------

  const dbLengkap = buatDbTiruan({
    kolom: {
      perkara: ["perkara_id", "nomor_perkara", "tanggal_pendaftaran", "tanggal_input"],
      perkara_penetapan: [
        "id",
        "perkara_id",
        "penetapan_majelis_hakim",
        "penetapan_panitera_pengganti",
        "penetapan_jurusita",
        "penetapan_hari_sidang",
        "sidang_pertama",
      ],
      perkara_dokumen_penetapan: ["id", "perkara_id", "nama_dokumen", "diinput_tanggal", "dokumen", "diinput_oleh"],
      perkara_pelaksanaan_relaas: ["id", "perkara_id", "sidang_id", "tanggal_relaas", "tanggal_input"],
      perkara_jadwal_sidang: ["id", "perkara_id", "tanggal_sidang", "edoc_bas", "edoc_bas_last_update"],
      // Nama kolom SIPP yang SEBENARNYA - disalin dari skema, bukan ditebak
      // dari pola. Tebakan sebelumnya membuat hampir seluruh tahap tertulis
      // "tidak tersedia" pada perkara yang datanya justru lengkap.
      perkara_banding: [
        "perkara_id",
        "permohonan_banding",
        "pemberitahuan_permohonan_banding",
        "penerimaan_memori_banding",
        "penyerahan_memori_banding",
        "penerimaan_kontra_banding",
        "pemberitahuan_inzage",
        "pelaksanaan_inzage",
        "pengiriman_berkas_banding",
        "penerimaan_kembali_berkas_banding",
        "tanggal_pendaftaran_banding",
        "putusan_banding",
        "pemberitahuan_putusan_banding",
        "nomor_perkara_banding",
        "pemohon_banding",
        "amar_putusan_banding",
        "status_putusan_banding_text",
      ],    },
    baris: {
      "FROM perkara_penetapan p": [
        {
          penetapanId: 27361,
          pmh_tanggal: "2025-02-05",
          ppp_tanggal: "2025-02-05",
          pjs_tanggal: "2025-02-09",
          phs_tanggal: "2025-02-06",
          sidangPertama: "2025-02-20",
        },
      ],
      "FROM perkara p WHERE p.perkara_id": [
        { pendaftaran_tanggal: "2025-02-03", pendaftaran_input: "2025-02-03" },
      ],
      "FROM perkara_dokumen_penetapan d": [
        { id: 3, nama: "PMH", diinput: "2025-02-06", berkas: "resources/file/pmh.pdf", oleh: "fahri" },
        { id: 4, nama: "PHS", diinput: "2025-02-06", berkas: "resources/file/phs.pdf", oleh: "fahri" },
      ],
      "FROM perkara_banding t": [
        {
          permohonan: "2025-07-01",
          pemberitahuanPermohonan: "2025-07-03",
          memoriDiterima: "2025-07-14",
          memoriDiserahkan: "2025-07-16",
          kontraDiterima: "2025-07-28",
          pemberitahuanInzage: "2025-08-01",
          pelaksanaanInzage: "2025-08-04",
          kirimBerkas: "2025-08-11",
          terimaBerkas: "2025-10-02",
          daftarTingkatAtas: "2025-08-18",
          putusan: "2025-09-10",
          pemberitahuanPutusan: "2025-09-25",
          nomorPerkara: "12/Pdt.G/2025/PTA.Pal",
          // SIPP menyimpan kalimat ini BERISI tanda <br>.
          pemohon: "Rusman Rusli, S.H. Kuasa dari Tergugat: <br>SRI ASTUTI<br>",
          statusPutusan: "Dikuatkan",
          amar: "<p>Menguatkan putusan Pengadilan Agama Donggala</p>",
        },
      ],
    },
  });

  const lengkap = muatDengan(dbLengkap);
  lengkap.skema.lupakan();

  const kolomTerpilih = await lengkap.skema.kolomTerpilih();
  cek("tanggal input pendaftaran ketemu", kolomTerpilih.inputPendaftaran, "tanggal_input");
  cek("tanggal PMH ketemu", kolomTerpilih.tanggalPmh, "penetapan_majelis_hakim");
  cek("nama dokumen penetapan ketemu", kolomTerpilih.dokumenPenetapanNama, "nama_dokumen");
  cek("tanggal input dokumen penetapan ketemu", kolomTerpilih.dokumenPenetapanTanggal, "diinput_tanggal");
  cek("tanggal unggah BAS ketemu", kolomTerpilih.unggahBas, "edoc_bas_last_update");
  cek("tanggal input relaas ketemu", kolomTerpilih.inputRelaas, "tanggal_input");
  cek("tabel arsip tidak ada, kolomnya kosong", kolomTerpilih.inputArsip, "");

  const hasil = await lengkap.tahapan.tahapanPerkara(4211);
  cek("tahapan terbaca", hasil.terbaca, true);
  cek("lima tahapan dilaporkan", hasil.tahap.length, 5);

  const perKunci = Object.fromEntries(hasil.tahap.map((x) => [x.kunci, x]));
  cek("PMH bertanggal", perKunci.pmh.tanggal, "2025-02-05");
  cek("PMH 2 hari sejak pendaftaran", perKunci.pmh.hariSejakAcuan, 2);
  cek("PMH diinput 1 hari setelahnya", perKunci.pmh.hariSampaiInput, 1);
  cek("PP terbaca tanggalnya", perKunci.ppp.terbaca, true);
  // PPP tidak punya baris dokumen, jadi tanggal inputnya kosong - tetapi
  // kolomnya TERBACA, sebab tabel dokumennya ada.
  cek("PP tanggal inputnya kosong", perKunci.ppp.diinput, "");
  cek("PMH punya berkas penetapannya", perKunci.pmh.adaBerkas, true);
  cek("PMH membawa nomor dokumennya", perKunci.pmh.dokumenId, "3");
  cek("PPP tanpa berkas penetapan", perKunci.ppp.adaBerkas, false);
  cek("sidang pertama terbaca", hasil.sidangPertama, "2025-02-20");
  cek("PMH diinput 1 hari setelah penetapannya", perKunci.pmh.hariSampaiInput, 1);
  cek("juru sita 4 hari sejak PMH", perKunci.pjs.hariSejakAcuan, 4);
  cek("PHS 1 hari sejak PMH", perKunci.phs.hariSejakAcuan, 1);

  // Kolom yang tidak ada tidak boleh ikut masuk SELECT - kuerinya akan gagal
  // seluruhnya, dan tahapan yang sebenarnya terbaca ikut hilang.
  const kueriTahapan = dbLengkap.direkam.find((x) => x.sql.includes("FROM perkara_penetapan p"));
  cek("kueri tahapan terbentuk", Boolean(kueriTahapan), true);
  cek(
    "kolom input PP yang tidak ada tidak masuk SELECT",
    /ppp_input/.test(kueriTahapan.sql),
    false
  );
  cek("kolom PMH yang ada masuk SELECT", /pmh_tanggal/.test(kueriTahapan.sql), true);

  const upaya = await lengkap.tahapan.upayaHukumPerkara(4211);
  cek("banding terbaca", upaya.length, 1);
  cek("jenis upaya hukumnya banding", upaya[0].jenis, "Banding");
  cek("nomor perkara banding terbaca", upaya[0].nomorPerkara, "12/Pdt.G/2025/PTA.Pal");
  cek("kasasi tidak ada tabelnya, tidak dilaporkan", upaya.filter((x) => x.jenis === "Kasasi").length, 0);

  // Tahapan disusun menurut URUTAN ACARA, bukan menurut tanggalnya. Tanggal
  // yang kosong akan melompat ke ujung, dan dua peristiwa bertanggal sama
  // akan bertukar tempat tiap kali dibaca.
  const urutTahap = upaya[0].tahapan.map((x) => x.kunci);
  cek("tahap pertama permohonan", urutTahap[0], "permohonan");
  cek(
    "urutan acara dipertahankan",
    urutTahap.indexOf("memoriDiterima") < urutTahap.indexOf("kontraDiterima") &&
      urutTahap.indexOf("kontraDiterima") < urutTahap.indexOf("pelaksanaanInzage") &&
      urutTahap.indexOf("pelaksanaanInzage") < urutTahap.indexOf("kirimBerkas") &&
      urutTahap.indexOf("kirimBerkas") < urutTahap.indexOf("putusan") &&
      urutTahap.indexOf("putusan") < urutTahap.indexOf("pemberitahuanPutusan"),
    true
  );

  const tahapUpaya = Object.fromEntries(upaya[0].tahapan.map((x) => [x.kunci, x]));
  // Sifat yang dijaga: nama kolom SIPP yang SEBENARNYA terbaca. Nama tebakan
  // - memori_banding, tanggal_kirim_berkas - membuat tahap-tahap ini kosong.
  cek("penerimaan memori terbaca", tahapUpaya.memoriDiterima.tanggal, "2025-07-14");
  cek("penyerahan memori terbaca", tahapUpaya.memoriDiserahkan.tanggal, "2025-07-16");
  cek("penerimaan kontra terbaca", tahapUpaya.kontraDiterima.tanggal, "2025-07-28");
  cek("pelaksanaan inzage terbaca", tahapUpaya.pelaksanaanInzage.tanggal, "2025-08-04");
  cek("pengiriman berkas terbaca", tahapUpaya.kirimBerkas.tanggal, "2025-08-11");
  cek("penerimaan kembali berkas terbaca", tahapUpaya.terimaBerkas.tanggal, "2025-10-02");
  cek("pendaftaran tingkat atas terbaca", tahapUpaya.daftarTingkatAtas.tanggal, "2025-08-18");
  cek("pemberitahuan putusan terbaca", tahapUpaya.pemberitahuanPutusan.tanggal, "2025-09-25");

  // Sifat yang dijaga: tahap yang KOLOMNYA tidak ada dibedakan dari tahap
  // yang kolomnya ada tetapi belum terisi. Yang satu tidak dapat dibaca,
  // yang lain memang belum dikerjakan - dan hanya yang kedua boleh ditagih.
  cek("tahap yang kolomnya ada ditandai", tahapUpaya.memoriDiterima.adaKolom, true);
  cek("tahap yang kolomnya tidak ada ditandai", tahapUpaya.kontraDiserahkan.adaKolom, false);
  cek("tahap tanpa kolom tidak berpura-pura bertanggal", tahapUpaya.kontraDiserahkan.tanggal, "");
  cek(
    "tahap yang tidak dikenali dilaporkan",
    upaya[0].tahapTakDikenali.includes("Kontra memori diserahkan"),
    true
  );
  cek("kolom yang benar-benar ada ikut dilaporkan", upaya[0].kolomTersedia.includes("pelaksanaan_inzage"), true);

  // Sifat yang dijaga: tanda <br> dari SIPP TIDAK ikut tampil sebagai teks.
  cek("tanda br dibersihkan dari nama pemohon", /<br>/.test(upaya[0].keterangan.pemohon), false);
  cek(
    "nama pemohon tetap terbaca utuh",
    upaya[0].keterangan.pemohon.includes("SRI ASTUTI"),
    true
  );
  cek("status putusan terbaca", upaya[0].keterangan.statusPutusan, "Dikuatkan");
  cek("amar putusan banding terbaca", upaya[0].keterangan.amar.length > 0, true);
  cek("banding tidak dicabut", upaya[0].dicabut, false);
  cek("sebutan tingkatnya dibawa", upaya[0].sebutan, "banding");

  // Kolom yang tidak ada TIDAK boleh masuk SELECT: kuerinya akan gagal
  // seluruhnya, dan tahapan yang sebenarnya terbaca ikut hilang.
  const kueriUpaya = dbLengkap.direkam.find((x) => x.sql.includes("FROM perkara_banding t"));
  cek("kueri banding terbentuk", Boolean(kueriUpaya), true);
  cek(
    "kolom yang tidak ada tidak masuk SELECT",
    /penyerahan_kontra_banding/.test(kueriUpaya ? kueriUpaya.sql : ""),
    false
  );
  cek(
    "perkara_id masuk sebagai parameter, bukan disambung",
    (kueriUpaya ? kueriUpaya.params : []).includes(4211),
    true
  );

  // Baris tanpa satu pun tanggal bukan upaya hukum - itu baris kosong yang
  // tertinggal, dan menampilkannya membuat perkara yang tidak pernah dibanding
  // terbaca seolah pernah.
  const dbUpayaKosong = buatDbTiruan({
    kolom: { perkara_banding: ["perkara_id", "permohonan_banding", "nomor_perkara_banding"] },
    baris: { "FROM perkara_banding t": [{ permohonan: null, nomorPerkara: "" }] },
  });
  const kosong = muatDengan(dbUpayaKosong);
  kosong.skema.lupakan();
  const upayaKosong = await kosong.tahapan.upayaHukumPerkara(4211);
  cek("baris tanpa tanggal tidak dilaporkan sebagai upaya hukum", upayaKosong.length, 0);

  // Verzet mendahului banding, dan tidak mengenal memori maupun inzage -
  // menyebut ketiadaannya "tidak tersedia" akan menyesatkan.
  const dbEmpat = buatDbTiruan({
    kolom: {
      // Seluruh kolom verzet yang dikenal rencana - supaya "tahap tak
      // dikenali" benar-benar menguji perilakunya, bukan kekurangan tiruannya.
      perkara_verzet: [
        "perkara_id",
        "tanggal_pendaftaran_verzet",
        "tanggal_sidang_pertama_verzet",
        "putusan_verzet",
        "tanggal_minutasi_verzet",
        "pemberitahuan_putusan_verzet",
        "tanggal_bht",
        "status_putusan_verzet_text",
        "majelis_hakim_text",
        "panitera_pengganti_text",
        "amar_putusan_verzet",
        "catatan_putusan_verzet",
      ],
      perkara_banding: ["perkara_id", "permohonan_banding"],
      perkara_kasasi: ["perkara_id", "permohonan_kasasi"],
      perkara_pk: ["perkara_id", "permohonan_pk"],
    },
    baris: {
      "FROM perkara_verzet t": [{ permohonan: "2026-01-13", putusan: "2026-02-10" }],
      "FROM perkara_banding t": [{ permohonan: "2026-03-10" }],
      "FROM perkara_kasasi t": [{ permohonan: "2026-05-20" }],
      "FROM perkara_pk t": [{ permohonan: "2026-09-01" }],
    },
  });
  const empat = muatDengan(dbEmpat);
  empat.skema.lupakan();
  const upayaEmpat = await empat.tahapan.upayaHukumPerkara(4211);
  cek(
    "empat tingkat berurut verzet, banding, kasasi, PK",
    upayaEmpat.map((x) => x.sebutan).join(","),
    "verzet,banding,kasasi,pk"
  );
  const tahapVerzet = upayaEmpat[0].tahapan.map((x) => x.kunci);
  cek("verzet tidak menyebut tahap memori", tahapVerzet.includes("memoriDiterima"), false);
  cek("verzet tidak menyebut tahap inzage", tahapVerzet.includes("pelaksanaanInzage"), false);
  cek("verzet tetap menyebut putusannya", tahapVerzet.includes("putusan"), true);
  cek("verzet tidak melaporkan tahap tak dikenali", upayaEmpat[0].tahapTakDikenali.length, 0);
  // -------------------------------------------------------------------------
  console.log("Kolom tidak ketemu - dilaporkan, bukan dinilai nol");
  // -------------------------------------------------------------------------

  const dbGersang = buatDbTiruan({
    kolom: { perkara: ["perkara_id", "nomor_perkara", "tanggal_pendaftaran"] },
  });
  const gersang = muatDengan(dbGersang);
  gersang.skema.lupakan();

  const hasilGersang = await gersang.tahapan.tahapanPerkara(4211);
  const gersangPerKunci = Object.fromEntries(hasilGersang.tahap.map((x) => [x.kunci, x]));
  cek("pendaftaran tetap terbaca", gersangPerKunci.pendaftaran.terbaca, true);
  cek("PMH tidak terbaca tanpa tabel penetapan", gersangPerKunci.pmh.terbaca, false);
  cek("PMH menyebutkan sebabnya", gersangPerKunci.pmh.alasan.length > 0, true);
  cek("PMH tidak berpura-pura bertanggal", gersangPerKunci.pmh.tanggal, "");
  cek("tanggal input pendaftaran tidak terbaca", gersangPerKunci.pendaftaran.inputTerbaca, false);

  const laporan = await gersang.skema.laporan();
  cek("laporan menyebut yang belum ketemu", laporan.belumKetemu > 0, true);
  cek(
    "laporan menyertakan calon namanya untuk ditelusuri",
    laporan.keterangan.every((x) => Array.isArray(x.calon) && x.calon.length > 0),
    true
  );

  const pendukungGersang = await gersang.tahapan.pemberitahuanPerkara(4211);
  cek("tabel pemberitahuan tidak ada: terbaca false", pendukungGersang.terbaca, false);
  cek("tabel pemberitahuan tidak ada: barisnya kosong", pendukungGersang.baris.length, 0);
  cek("tabel pemberitahuan tidak ada: sebabnya disebut", pendukungGersang.alasan.length > 0, true);

  // -------------------------------------------------------------------------
  console.log("Fakta penilaian menerima tahapan");
  // -------------------------------------------------------------------------

  delete require.cache[require.resolve("../services/sippStatusPerkaraService")];
  const status = require("../services/sippStatusPerkaraService");

  const fakta = status.faktaPenilaianSk({
    identitas: { tanggalDaftar: "2025-02-03" },
    putusan: null,
    jadwal: [],
    relaas: [],
    saksi: { jumlahSaksi: 0 },
    sidangLewat: 0,
    basAda: 0,
    tahapan: hasil,
    pendukung: {},
  });

  cek("tanggal PMH masuk fakta", fakta.tanggalPmh, "2025-02-05");
  cek("tanggal input PMH masuk fakta", fakta.tanggalInputPmh, "2025-02-06");
  cek("tanggal input pendaftaran masuk fakta", fakta.tanggalInputPendaftaran, "2025-02-03");
  // Kolomnya tidak ada -> medannya TIDAK diisi, sehingga penilai melaporkannya
  // belum tersambung alih-alih menilainya nol.
  cek("input PP tanpa dokumen bernilai null, bukan hilang", fakta.tanggalInputPpp, null);
  cek("tanggal PP yang kolomnya ada tetap masuk", fakta.tanggalPpp, "2025-02-05");
  cek("relaas kosong tetap dinilai", fakta.relaas, []);

  // Penilai SK memakainya - inilah buktinya unsur input data jadi dapat dinilai.
  const penilaian = require("../services/penilaianSippService");
  const poin = penilaian.poinPerkara(fakta);
  const perUnsur = Object.fromEntries(poin.rinci.map((x) => [x.kunci, x]));
  cek("pendaftaran dinilai (hari sama = 5)", perUnsur.pendaftaranPerkara.poin, 5);
  cek("PMH dinilai (hari ke-2 = 3)", perUnsur.penetapanMajelis.poin, 3);
  cek("input PMH dinilai (hari ke-1 = 3)", perUnsur.inputPenetapanMajelis.poin, 3);
  cek("input PP tanpa dokumen dinilai nol", perUnsur.inputPenunjukanPp.poin, 0);
  cek("PHS dinilai (hari ke-1 = 3)", perUnsur.penetapanHariSidang.poin, 3);
  cek("relaas kosong bernilai -5", perUnsur.dataRelaas.poin, -5);

  // Sebelum ada lapisan ini, seluruh unsur input data tidak dapat dinilai.
  const dinilai = poin.rinci.filter((x) => x.aspek === "input" && x.terbaca).length;
  cek("beberapa unsur input data kini dapat dinilai", dinilai >= 5, true);


  // -------------------------------------------------------------------------
  console.log("Mafqud - dihitung dari tundaan sidang, bukan dari kolom");
  // -------------------------------------------------------------------------

  const dbMafqud = (jadwal) =>
    buatDbTiruan({
      kolom: { perkara_jadwal_sidang: ["id", "perkara_id", "tanggal_sidang", "agenda"] },
      baris: { "FROM perkara_jadwal_sidang j": jadwal },
    });

  const sidangPada = (...tanggal) => tanggal.map((t) => ({ tanggalSidang: t, agenda: "Tundaan" }));

  cek("ambang tundaan mafqud 90 hari", lengkap.tahapan.AMBANG_TUNDAAN_MAFQUD, 90);
  cek("jumlah tundaan mafqud 3 kali", lengkap.tahapan.JUMLAH_TUNDAAN_MAFQUD, 3);

  // Tiga tundaan 90 hari atau lebih - inilah penciri SK.
  const tigaTundaan = muatDengan(
    dbMafqud(sidangPada("2025-01-06", "2025-04-10", "2025-07-15", "2025-10-20"))
  );
  tigaTundaan.skema.lupakan();
  const hasilMafqud = await tigaTundaan.tahapan.mafqudPerkara(4211);
  cek("tiga tundaan panjang = terindikasi mafqud", hasilMafqud.terindikasi, true);
  cek("ketiga tundaannya dirinci", hasilMafqud.tundaanPanjang.length, 3);
  cek("jarak tundaan pertama terbaca", hasilMafqud.tundaanPanjang[0].hari, 94);

  // Dua tundaan saja belum cukup - SK menyebut tiga.
  const duaTundaan = muatDengan(dbMafqud(sidangPada("2025-01-06", "2025-04-10", "2025-07-15")));
  duaTundaan.skema.lupakan();
  cek("dua tundaan panjang belum mafqud", (await duaTundaan.tahapan.mafqudPerkara(4211)).terindikasi, false);

  // Sidang rapat sebulan sekali bukan mafqud, walau banyak.
  const rapat = muatDengan(
    dbMafqud(sidangPada("2025-01-06", "2025-02-06", "2025-03-06", "2025-04-06", "2025-05-06"))
  );
  rapat.skema.lupakan();
  const hasilRapat = await rapat.tahapan.mafqudPerkara(4211);
  cek("sidang berkala sebulan bukan mafqud", hasilRapat.terindikasi, false);
  cek("tidak ada tundaan panjang yang dicatat", hasilRapat.tundaanPanjang.length, 0);

  // Satu sidang saja - tidak ada jarak untuk dihitung.
  const satuSidang = muatDengan(dbMafqud(sidangPada("2025-01-06")));
  satuSidang.skema.lupakan();
  cek("satu sidang bukan mafqud", (await satuSidang.tahapan.mafqudPerkara(4211)).terindikasi, false);

  // Tepat 90 hari termasuk - SK menulis "3 x 90 hari", bukan "lebih dari 90".
  const tepat90 = muatDengan(
    dbMafqud(sidangPada("2025-01-01", "2025-04-01", "2025-06-30", "2025-09-28"))
  );
  tepat90.skema.lupakan();
  const hasil90 = await tepat90.tahapan.mafqudPerkara(4211);
  cek("tundaan tepat 90 hari ikut terhitung", hasil90.tundaanPanjang.length >= 3, true);

  // Kelonggaran mafqud (270 hari) mengalahkan ghaib (120 hari).
  const penilaianMafqud = require("../services/penilaianSippService");
  cek(
    "mafqud mendapat kelonggaran 270 hari",
    penilaianMafqud.kelonggaranWaktuPutus({ perkaraMafqud: true, perkaraGhaib: true }).hari,
    270
  );
  cek(
    "tanpa penanda tidak ada kelonggaran",
    penilaianMafqud.kelonggaranWaktuPutus({}).hari,
    0
  );

  // -------------------------------------------------------------------------
  console.log("Mediasi - kegagalan menyebutkan kolom yang ada");
  // -------------------------------------------------------------------------

  const dbMediasiAsing = muatDengan(
    buatDbTiruan({
      kolom: { perkara_mediasi: ["id", "perkara_id", "kolom_yang_belum_dikenal", "kolom_lain"] },
    })
  );
  dbMediasiAsing.skema.lupakan();
  const mediasiAsing = await dbMediasiAsing.tahapan.mediasiLengkapPerkara(4211);
  cek("mediasi dengan kolom asing tidak terbaca", mediasiAsing.terbaca, false);
  cek(
    "sebabnya menyebutkan kolom yang sebenarnya ada",
    mediasiAsing.alasan.includes("kolom_yang_belum_dikenal"),
    true
  );
  cek("daftar kolomnya ikut dikembalikan", mediasiAsing.kolomTersedia.length, 4);

  const dbMediasiKenal = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_mediasi: [
          "mediasi_id",
          "perkara_id",
          "mediator_text",
          "hasil_mediasi",
          "penetapan_penunjukan_mediator",
          "tgl_laporan_mediator",
        ],
      },
      baris: {
        "FROM perkara_mediasi m": [
          {
            mediasiId: 1,
            mediator: "Dra. Hj. Sitti Nurjannah",
            hasil: "T",
            penetapan: "2025-03-03",
            laporan: "2025-04-10",
          },
        ],
      },
    })
  );
  dbMediasiKenal.skema.lupakan();
  const mediasiKenal = await dbMediasiKenal.tahapan.mediasiLengkapPerkara(4211);
  cek("kolom bergaya SIPP dikenali", mediasiKenal.terbaca, true);
  cek("mediator terbaca", mediasiKenal.baris[0].mediator, "Dra. Hj. Sitti Nurjannah");
  // Kode T diterjemahkan, bukan ditampilkan apa adanya.
  cek("hasil mediasi diterjemahkan", mediasiKenal.baris[0].hasil, "Tidak Berhasil");
  cek("lama mediasi dihitung dari penetapan ke laporan", mediasiKenal.baris[0].lamaHari, 38);
  // PERMA 1/2016 Pasal 24: paling lama 30 hari.
  cek("mediasi 38 hari ditandai lewat tenggang", mediasiKenal.baris[0].lewatTenggang, true);

  // -------------------------------------------------------------------------
  console.log("Penetapan PERTAMA yang dinilai, bukan penetapan kembali");
  // -------------------------------------------------------------------------

  // Perkara yang majelisnya berganti pada bulan ketiga: baris penetapan
  // pertama 2026-05-20, penetapan kembali 2026-08-26. Yang dinilai yang
  // pertama - kalau yang terakhir, PMH-nya terbaca terlambat 98 hari dan jeda
  // inputnya negatif.
  const dbGanti = buatDbTiruan({
    kolom: {
      perkara: ["perkara_id", "tanggal_pendaftaran"],
      perkara_penetapan: ["id", "perkara_id", "penetapan_majelis_hakim", "penetapan_hari_sidang"],
      perkara_dokumen_penetapan: ["id", "perkara_id", "nama_dokumen", "diinput_tanggal", "dokumen"],
      perkara_hakim_pn: ["perkara_id", "hakim_nama", "aktif", "diinput_tanggal", "diperbaharui_tanggal", "diperbaharui_oleh", "tanggal_tidak_aktif"],
    },
    baris: {
      "FROM perkara_penetapan p": [
        { penetapanId: 100, pmh_tanggal: "2026-05-20", phs_tanggal: "2026-05-20" },
      ],
      "FROM perkara p WHERE p.perkara_id": [{ pendaftaran_tanggal: "2026-05-20" }],
      "FROM perkara_dokumen_penetapan d": [
        { id: 9, nama: "PMH", diinput: "2026-06-22", berkas: "resources/pmh.pdf" },
      ],
      "FROM perkara_hakim_pn t": [
        { nama: "Himawan Tatura Wijaya", aktif: "T", diinput: "2026-05-20", tidakAktif: "2026-08-26", oleh: "sudarmin", diperbaharui: "2026-08-26" },
        { nama: "Derry Briantono", aktif: "Y", diinput: "2026-08-26" },
      ],
    },
  });
  const ganti = muatDengan(dbGanti);
  ganti.skema.lupakan();

  const hasilGanti = await ganti.tahapan.tahapanPerkara(4211);

  // Diperiksa SESUDAH kuerinya dijalankan - sebelum itu belum ada yang direkam.
  const kueriPenetapan = dbGanti.direkam.find((x) => x.sql.includes("FROM perkara_penetapan p"));
  cek("kueri penetapan terbentuk", Boolean(kueriPenetapan), true);
  cek("penetapan diurut menaik, bukan menurun", /ASC/.test(kueriPenetapan ? kueriPenetapan.sql : ""), true);
  const gantiPerKunci = Object.fromEntries(hasilGanti.tahap.map((x) => [x.kunci, x]));
  cek("PMH memakai penetapan pertama", gantiPerKunci.pmh.tanggal, "2026-05-20");
  cek("selisih PMH 0 hari, bukan 98", gantiPerKunci.pmh.hariSejakAcuan, 0);
  // Jeda input tidak boleh negatif - itulah gejala salah baris penetapan.
  cek("jeda input PMH tidak negatif", gantiPerKunci.pmh.hariSampaiInput >= 0, true);
  cek("jeda input PMH 33 hari", gantiPerKunci.pmh.hariSampaiInput, 33);
  cek("PHS 0 hari sejak PMH", gantiPerKunci.phs.hariSejakAcuan, 0);

  const kembali = await ganti.tahapan.penetapanKembaliPerkara(4211);
  cek("penggantian majelis terbaca", kembali.adaPenggantian, true);
  cek("jenis yang diganti disebut", kembali.baris[0].jenis, "Majelis hakim");
  cek("hakim lama ditandai tidak aktif", kembali.baris[0].penggantian[0].masihAktif, false);
  cek("tanggal tidak aktifnya terbaca", kembali.baris[0].penggantian[0].tanggalTidakAktif, "2026-08-26");

  // Perkara tanpa penggantian tidak melaporkan apa-apa.
  const dbTetap = buatDbTiruan({
    kolom: { perkara_hakim_pn: ["perkara_id", "hakim_nama", "aktif", "diinput_tanggal"] },
    baris: { "FROM perkara_hakim_pn t": [{ nama: "Idris", aktif: "Y", diinput: "2026-05-20" }] },
  });
  const tetap = muatDengan(dbTetap);
  tetap.skema.lupakan();
  cek(
    "tanpa penggantian tidak dilaporkan",
    (await tetap.tahapan.penetapanKembaliPerkara(4211)).adaPenggantian,
    false
  );

  // -------------------------------------------------------------------------
  console.log("Waktu putus - hari pendaftaran ikut, mediasi dipotong");
  // -------------------------------------------------------------------------

  const nilaiSk = require("../services/penilaianSippService");
  const poinPutus = (fakta) => {
    const hasilPoin = nilaiSk.poinPerkara(fakta);
    const baris = hasilPoin.rinci.find((x) => x.kunci === "waktuPutus");
    return baris.terbaca ? baris.poin : "tidak-terbaca";
  };
  const tglDaftar = new Date("2026-01-01T00:00:00");
  const tglPutus = (n) => new Date(tglDaftar.getTime() + n * 24 * 60 * 60 * 1000);

  // 89 hari selisih + 1 = 90 hari berjalan - masih bernilai 5.
  cek("selisih 89 hari = 90 hari berjalan = 5", poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(89) }), 5);
  // 90 hari selisih + 1 = 91 hari - sudah lewat 3 bulan.
  cek("selisih 90 hari = 91 hari berjalan = 3", poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(90) }), 3);
  cek("didaftar dan diputus hari yang sama = 1 hari = 5", poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglDaftar }), 5);

  // Mediasi 40 hari memindahkan perkara 120 hari kembali ke nilai 5.
  cek(
    "tanpa potongan mediasi, 120 hari bernilai 3",
    poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(119) }),
    3
  );
  cek(
    "dengan mediasi 40 hari, perkara yang sama bernilai 5",
    poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(119), hariMediasi: 40 }),
    5
  );
  cek(
    "mediasi dan ghaib dipotong keduanya",
    poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(240), hariMediasi: 40, perkaraGhaib: true }),
    5
  );
  cek(
    "hariMediasi negatif diabaikan",
    poinPutus({ tanggalDaftar: tglDaftar, tanggalPutus: tglPutus(89), hariMediasi: -100 }),
    5
  );

  // SK diikuti, bukan notifikasi lama: minutasi hari ke-2 bernilai 5.
  const poinMinutasi = (n) => {
    const p = new Date("2026-03-10T00:00:00");
    const hasilPoin = nilaiSk.poinPerkara({
      tanggalPutus: p,
      tanggalMinutasi: new Date(p.getTime() + n * 24 * 60 * 60 * 1000),
    });
    return hasilPoin.rinci.find((x) => x.kunci === "waktuMinutasi").poin;
  };
  cek("minutasi hari ke-2 bernilai 5 sesuai SK", poinMinutasi(2), 5);
  cek("minutasi hari ke-3 bernilai 3", poinMinutasi(3), 3);

  // -------------------------------------------------------------------------
  console.log("Nilai relaas - empat jalan, dicoba berurutan");
  // -------------------------------------------------------------------------

  // Jalan 1: SIPP sudah menghitung sendiri.
  const dbNilai = muatDengan(
    buatDbTiruan({
      kolom: { perkara_penilaian_relaas: ["id", "perkara_id", "nilai", "sidang_id"] },
      baris: { "FROM perkara_penilaian_relaas t": [{ nilai: 5 }, { nilai: 3 }] },
    })
  );
  dbNilai.skema.lupakan();
  const jalan1 = await dbNilai.tahapan.penilaianRelaasPerkara(4211);
  cek("nilai dari SIPP dipakai apa adanya", jalan1.nilaiLangsung, 4);
  cek("sumbernya disebutkan", jalan1.sumber.includes("perkara_penilaian_relaas"), true);

  // Jalan 2: tabel penilaian hanya punya tanggal input.
  const dbTanggal = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_penilaian_relaas: ["id", "perkara_id", "diinput_tanggal", "sidang_id"],
        perkara_jadwal_sidang: ["id", "perkara_id", "tanggal_sidang"],
      },
      baris: {
        "FROM perkara_penilaian_relaas t": [{ diinput: "2026-04-05", acuanSidang: 77 }],
        "FROM perkara_jadwal_sidang j WHERE j.perkara_id": [{ id: 77, tanggal: "2026-04-10" }],
      },
    })
  );
  dbTanggal.skema.lupakan();
  const jalan2 = await dbTanggal.tahapan.penilaianRelaasPerkara(4211);
  cek("tanggal input dipasangkan dengan sidangnya", jalan2.relaas.length, 1);
  cek("tanggal sidang ikut terbaca", jalan2.relaas[0].tanggalSidang, "2026-04-10");
  cek("tanpa kolom nilai, tidak ada nilai langsung", jalan2.nilaiLangsung, undefined);

  // Jalan 4: hanya jejak audit yang punya jawabannya.
  const dbAudit = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_pelaksanaan_relaas: ["id", "perkara_id", "sidang_id"],
        sys_audittrail: ["id", "waktu", "tabel", "record_id", "aksi", "username"],
      },
      baris: {
        "FROM perkara_pelaksanaan_relaas r": [{ id: 501, tanggalSidang: "2026-04-10" }],
        "FROM sys_audittrail a": [{ waktu: "2026-04-05", pelaku: "fahri", aksi: "INSERT" }],
      },
    })
  );
  dbAudit.skema.lupakan();
  const jalan4 = await dbAudit.tahapan.penilaianRelaasPerkara(4211);
  cek("jejak audit dipakai sebagai jalan terakhir", jalan4.dariAudit, true);
  cek("tanggal dari jejak audit terbaca", jalan4.relaas[0].tanggalInput, "2026-04-05");
  cek("sumbernya disebut jejak audit", jalan4.sumber.includes("audit"), true);

  // Tidak ada relaas sama sekali - TERBACA, dan SK menilainya -5.
  const dbKosong = muatDengan(
    buatDbTiruan({ kolom: { perkara_pelaksanaan_relaas: ["id", "perkara_id"] } })
  );
  dbKosong.skema.lupakan();
  const kosongRelaas = await dbKosong.tahapan.penilaianRelaasPerkara(4211);
  cek("tanpa relaas: terbaca", kosongRelaas.terbaca, true);
  cek("tanpa relaas: sumbernya disebut", kosongRelaas.sumber, "tidak ada relaas");
  cek("tanpa relaas: daftarnya kosong", kosongRelaas.relaas.length, 0);

  // Nilai dari SIPP dijepit ke rentang yang sah.
  const nilaiRelaasSk = require("../services/penilaianSippService");
  const poinRelaas = (fakta) =>
    nilaiRelaasSk.poinPerkara(fakta).rinci.find((x) => x.kunci === "dataRelaas").poin;
  cek("nilai 5 dari SIPP dipakai", poinRelaas({ nilaiRelaasLangsung: 5 }), 5);
  cek("nilai -5 dari SIPP dipakai", poinRelaas({ nilaiRelaasLangsung: -5 }), -5);
  cek("nilai menyimpang di atas dijepit ke 5", poinRelaas({ nilaiRelaasLangsung: 99 }), 5);
  cek("nilai menyimpang di bawah dijepit ke -5", poinRelaas({ nilaiRelaasLangsung: -99 }), -5);

  // -------------------------------------------------------------------------
  console.log("Jejak audit - penjaga dan bentuknya");
  // -------------------------------------------------------------------------

  const bentuk = await dbAudit.audit.bentukAudit();
  cek("bentuk jejak audit dikenali", bentuk.terbaca, true);
  cek("kolom waktu ditemukan", bentuk.waktu, "waktu");
  cek("kolom tabel ditemukan", bentuk.tabel, "tabel");

  // Tanpa penyaring apa pun, kuerinya akan menyapu jutaan baris - ditolak.
  const tanpaSaringan = await dbAudit.audit.pertamaDicatat({});
  cek("tanpa penyaring ditolak", tanpaSaringan.terbaca, false);
  cek("hasil jejak audit selalu bertanda dariAudit", tanpaSaringan.dariAudit, true);

  // SIPP tanpa sys_audittrail tidak menggagalkan apa pun.
  const dbTanpaAudit = muatDengan(buatDbTiruan({ kolom: { perkara: ["perkara_id"] } }));
  dbTanpaAudit.skema.lupakan();
  const tanpaTabel = await dbTanpaAudit.audit.bentukAudit();
  cek("tanpa sys_audittrail: terbaca false", tanpaTabel.terbaca, false);
  cek("tanpa sys_audittrail: sebabnya disebut", tanpaTabel.alasan.length > 0, true);

  // -------------------------------------------------------------------------
  console.log("Saksi dari perkara_pihak5 - ejaan SIPP diikuti apa adanya");
  // -------------------------------------------------------------------------

  const dbSaksi = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_pihak5: ["perkara_id", "pihak_id"],
        pihak: ["id", "nama", "jenis_indentitas", "nomor_indentitas", "telepon", "alamat"],
        perkara_putusan: ["perkara_id", "status_putusan_id"],
      },
      baris: {
        "FROM perkara_pihak5 k": [
          { nama: "Ahmad", isian0: "KTP", isian1: "7201", isian2: "0812" },
          { nama: "Budi", isian0: "KTP", isian1: "7201", isian2: null },
          { nama: "Cici", isian0: "KTP", isian1: null, isian2: null },
          { nama: "Dedi", isian0: null, isian1: null, isian2: null },
        ],
        "FROM perkara_putusan pu": [{ status: 58 }],
      },
    })
  );
  dbSaksi.skema.lupakan();

  const kolomSaksi = await dbSaksi.skema.kolomTerpilih();
  // SIPP mengeja "indentitas", bukan "identitas" - ejaan itu diikuti apa adanya.
  cek("jenis indentitas dikenali dengan ejaan SIPP", kolomSaksi.saksiJenisIdentitas, "jenis_indentitas");
  cek("nomor indentitas dikenali", kolomSaksi.saksiNomorIdentitas, "nomor_indentitas");
  cek("telepon dikenali sebagai isian ketiga", kolomSaksi.saksiTelepon, "telepon");

  const hasilSaksi = await dbSaksi.tahapan.saksiLengkapPerkaraBaru(4211);
  cek("saksi terbaca", hasilSaksi.terbaca, true);
  cek("tiga isian diperiksa", hasilSaksi.jumlahIsianDiperiksa, 3);
  cek("empat saksi terbaca", hasilSaksi.baris.length, 4);
  cek("saksi lengkap: 3 dari 3", hasilSaksi.baris[0].isianTerisi, 3);
  cek("saksi lengkap tidak punya isian kurang", hasilSaksi.baris[0].isianKurang.length, 0);
  cek("saksi 2 dari 3", hasilSaksi.baris[1].isianTerisi, 2);
  cek("yang kurang disebutkan namanya", hasilSaksi.baris[1].isianKurang, ["Nomor telepon"]);
  cek("saksi 1 dari 3", hasilSaksi.baris[2].isianTerisi, 1);
  cek("saksi 0 dari 3", hasilSaksi.baris[3].isianTerisi, 0);

  // Nilai SK dari isian yang terisi: 3->5, 2->3, 1->2, 0->1.
  const nilaiSaksiSk = require("../services/penilaianSippService");
  const poinSaksi = (terisi) =>
    nilaiSaksiSk
      .poinPerkara({ saksi: [{ isianTerisi: terisi }] })
      .rinci.find((x) => x.kunci === "dataSaksi").poin;
  cek("3 dari 3 bernilai 5", poinSaksi(3), 5);
  cek("2 dari 3 bernilai 3", poinSaksi(2), 3);
  cek("1 dari 3 bernilai 2", poinSaksi(1), 2);
  cek("0 dari 3 bernilai 1", poinSaksi(0), 1);

  // Perkara cabut, gugur, digugurkan dikecualikan.
  for (const status of [65, 67, 93]) {
    const dbCabut = muatDengan(
      buatDbTiruan({
        kolom: {
          perkara_pihak5: ["perkara_id", "pihak_id"],
          pihak: ["id", "nama", "jenis_indentitas", "nomor_indentitas", "telepon"],
          perkara_putusan: ["perkara_id", "status_putusan_id"],
        },
        baris: { "FROM perkara_putusan pu": [{ status }] },
      })
    );
    dbCabut.skema.lupakan();
    const hasilCabut = await dbCabut.tahapan.saksiLengkapPerkaraBaru(4211);
    cek(`status putusan ${status} dikecualikan dari penilaian saksi`, hasilCabut.dikecualikan, true);
  }

  // -------------------------------------------------------------------------
  console.log("BAS - ada tidaknya selalu terbaca, kapannya belum tentu");
  // -------------------------------------------------------------------------

  const dbBas = muatDengan(
    buatDbTiruan({
      kolom: { perkara_jadwal_sidang: ["id", "perkara_id", "tanggal_sidang", "edoc_bas", "agenda"] },
      baris: {
        "FROM perkara_jadwal_sidang j": [
          { sidangId: 1, tanggalSidang: "2026-04-01", berkas: "bas1.pdf" },
          { sidangId: 2, tanggalSidang: "2026-04-15", berkas: null },
        ],
      },
    })
  );
  dbBas.skema.lupakan();
  const hasilBas = await dbBas.tahapan.unggahBasPerkara(4211);
  cek("BAS terbaca walau tanpa kolom waktu", hasilBas.terbaca, true);
  cek("dua sidang terbaca", hasilBas.jumlahSidang, 2);
  cek("satu sidang berBAS", hasilBas.jumlahBerBerkas, 1);
  cek("belum lengkap", hasilBas.lengkap, false);
  cek("waktu unggahnya tidak terbaca", hasilBas.waktuTerbaca, false);

  const dbBasWaktu = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_jadwal_sidang: [
          "id",
          "perkara_id",
          "tanggal_sidang",
          "edoc_bas",
          "agenda",
          "edoc_bas_last_update",
        ],
      },
      baris: {
        "FROM perkara_jadwal_sidang j": [
          { sidangId: 1, tanggalSidang: "2026-04-01", berkas: "bas1.pdf", diunggah: "2026-04-02" },
        ],
      },
    })
  );
  dbBasWaktu.skema.lupakan();
  const hasilBasWaktu = await dbBasWaktu.tahapan.unggahBasPerkara(4211);
  cek("dengan kolom waktu: terbaca", hasilBasWaktu.waktuTerbaca, true);
  cek("sumber waktunya disebut", hasilBasWaktu.sumberWaktu.includes("edoc_bas_last_update"), true);
  cek("seluruh sidang berBAS = lengkap", hasilBasWaktu.lengkap, true);

  // -------------------------------------------------------------------------
  console.log("Delegasi - ketentuan Jumat pada SK I.17");
  // -------------------------------------------------------------------------

  const jumat = dbBas.tahapan.selisihHariKerjaJumat;
  // 2026-04-03 adalah hari Jumat. Dihitung mulai Senin 2026-04-06.
  cek("Jumat dihitung mulai Senin", jumat("2026-04-03", "2026-04-07"), 1);
  cek("Jumat diterima Senin = 0 hari", jumat("2026-04-03", "2026-04-06"), 0);
  cek("Senin dihitung apa adanya", jumat("2026-04-06", "2026-04-08"), 2);
  cek("diterima lebih cepat tidak negatif", jumat("2026-04-03", "2026-04-01"), 0);
  cek("tanpa tanggal menghasilkan null", jumat("", "2026-04-07"), null);

  // -------------------------------------------------------------------------
  console.log("Mediasi - jadwal dicari lewat mediasi_id, bukan perkara_id");
  // -------------------------------------------------------------------------

  const tiruanMediasi = buatDbTiruan({
      kolom: {
        perkara_mediasi: [
          "mediasi_id",
          "perkara_id",
          "mediator_text",
          "mediator_id",
          "status_mediator",
          "jenis_mediasi",
          "is_mediasi",
          "penetapan_penunjukan_mediator",
          "nomor_sk_penetapan_mediator",
        ],
        perkara_mediator: [
          "id",
          "perkara_id",
          "tanggal_penetapan",
          "nomor_sk_penetapan",
          "nama_mediator",
          "status_mediator",
          "aktif",
          "keterangan",
        ],
        perkara_jadwal_mediasi: [
          "id",
          "mediasi_id",
          "tanggal_mediasi",
          "jam_mediasi",
          "sampai_jam",
          "tempat",
          "dihadiri_oleh",
          "ditunda",
        ],
      },
      baris: {
        "FROM perkara_mediasi m": [
          {
            mediasiId: 772,
            mediator: "Idris, S.H.I., M.H.",
            statusMediator: "H",
            jenisMediasi: 1,
            penetapan: "2026-08-18",
            nomorSk: "459/Pdt.G/2026/PA.Dgl",
          },
        ],
        "FROM perkara_mediator m": [
          {
            nama: "Idris, S.H.I., M.H.",
            penetapan: "2026-08-18",
            nomorSk: "459/Pdt.G/2026/PA.Dgl",
            status: "H",
            aktif: "Y",
          },
        ],
        "FROM perkara_jadwal_mediasi j": [
          { tanggal: "2026-08-25", jam: "09:00:00", sampai: "15:00:00", tempat: "Ruang Mediasi", ditunda: "T" },
          { tanggal: "2026-09-01", jam: "09:00:00", tempat: "Ruang Mediasi", ditunda: "Y" },
        ],
      },
  });
  const dbMediasi = muatDengan(tiruanMediasi);
  dbMediasi.skema.lupakan();

  const kolomMediasi = await dbMediasi.skema.kolomTerpilih();
  cek("mediasi_id dikenali", kolomMediasi.mediasiId, "mediasi_id");
  cek("kunci jadwal mediasi adalah mediasi_id", kolomMediasi.jadwalMediasiKunci, "mediasi_id");
  cek("penetapan penunjukan mediator dikenali", kolomMediasi.mediasiPenetapan, "penetapan_penunjukan_mediator");

  const hasilMediasi = await dbMediasi.tahapan.mediasiLengkapPerkara(4211);
  cek("mediasi terbaca", hasilMediasi.terbaca, true);
  cek("nama mediator terbaca", hasilMediasi.baris[0].mediator, "Idris, S.H.I., M.H.");
  cek("tanggal penetapan terbaca", hasilMediasi.baris[0].tanggalPenetapan, "2026-08-18");
  cek("nomor SK terbaca", hasilMediasi.baris[0].nomorSk, "459/Pdt.G/2026/PA.Dgl");
  cek("jadwal pertemuan terbaca", hasilMediasi.jadwal.length, 2);
  cek("jam pertemuan terbaca", hasilMediasi.jadwal[0].jam, "09:00:00");
  cek("tempat pertemuan terbaca", hasilMediasi.jadwal[0].tempat, "Ruang Mediasi");
  // Sifat yang dijaga: Y berarti YA, T berarti TIDAK - di seluruh SIPP dan di
  // seluruh berkas ini. Uji ini dulu mengunci kebalikannya, sehingga SETIAP
  // pertemuan mediasi yang berjalan normal tertandai ditunda di layar.
  cek("pertemuan bertanda T TIDAK ditunda", hasilMediasi.jadwal[0].ditunda, false);
  cek("pertemuan bertanda Y ditandai ditunda", hasilMediasi.jadwal[1].ditunda, true);
  cek("mediator dari tabel tersendiri ikut terbaca", hasilMediasi.mediator.length, 1);
  cek("mediator masih aktif", hasilMediasi.mediator[0].masihAktif, true);

  // Jadwal dicari dengan mediasi_id - itulah pokok perbaikannya. Kuerinya
  // diperiksa langsung supaya salah kunci ketahuan, bukan hanya hasilnya.
  const kueriJadwal = tiruanMediasi.direkam.find((x) =>
    x.sql.includes("FROM perkara_jadwal_mediasi j")
  );
  cek("kueri jadwal mediasi terbentuk", Boolean(kueriJadwal), true);
  cek(
    "jadwal dicari dengan mediasi_id, bukan perkara_id",
    /j\.mediasi_id IN/.test(kueriJadwal ? kueriJadwal.sql : ""),
    true
  );
  cek(
    "kueri jadwal tidak menyebut perkara_id",
    /perkara_id/.test(kueriJadwal ? kueriJadwal.sql : ""),
    false
  );
  cek("jumlah pertemuan diisi dari jadwalnya", hasilMediasi.baris[0].jumlahPertemuan, 2);

  // Tanpa mediasi_id, jadwal tidak dicari sama sekali.
  const jadwalKosong = await dbMediasi.tahapan.jadwalMediasiPerkara([]);
  cek("tanpa mediasi_id: tidak terbaca", jadwalKosong.terbaca, false);
  cek("tanpa mediasi_id: barisnya kosong", jadwalKosong.baris.length, 0);

  // -------------------------------------------------------------------------
  console.log("Tabayun - nilai SK III.3 dari delegasi_keluar");
  // -------------------------------------------------------------------------

  const nilaiTab = dbMediasi.tahapan.nilaiTabayun;
  cek("6 hari sebelum sidang = 0", nilaiTab(6), 0);
  cek("10 hari sebelum sidang = 0", nilaiTab(10), 0);
  cek("5 hari = -1", nilaiTab(5), -1);
  cek("4 hari = -2", nilaiTab(4), -2);
  cek("3 hari = -3", nilaiTab(3), -3);
  cek("2 hari = -5", nilaiTab(2), -5);
  cek("1 hari = -5", nilaiTab(1), -5);
  cek("hari yang sama = -5", nilaiTab(0), -5);
  cek("tanpa jarak menghasilkan null", nilaiTab(null), null);

  const dbTabayun = muatDengan(
    buatDbTiruan({
      kolom: {
        delegasi_keluar: [
          "id",
          "perkara_id",
          "nomor_perkara",
          "tgl_delegasi",
          "tgl_sidang",
          "tgl_resi",
          "id_jenis_delegasi",
          "pengadilan_tujuan",
        ],
        delegasi_proses_keluar: ["id", "delegasi_id", "tgl_relaas", "jurusita_nama"],
      },
      baris: {
        "FROM delegasi_keluar d": [
          { delegasiId: 11, permohonan: "2026-04-01", sidang: "2026-04-10", jenis: 1, tujuan: "PA Palu" },
          { delegasiId: 12, permohonan: "2026-05-01", sidang: "2026-05-04", jenis: 1, tujuan: "PA Sigi" },
          { delegasiId: 13, permohonan: "2026-06-01", sidang: "2026-06-02", jenis: 2, tujuan: "PA Parigi" },
        ],
        "FROM delegasi_proses_keluar p": [
          { delegasiId: 11, relaas: "2026-04-05", jurusita: "Mustini" },
        ],
      },
    })
  );
  dbTabayun.skema.lupakan();

  const kolomTab = await dbTabayun.skema.kolomTerpilih();
  // Nama kolomnya berawalan tgl_, bukan tanggal_.
  cek("tgl_delegasi dikenali", kolomTab.delegasiKeluarPermohonan, "tgl_delegasi");
  cek("tgl_sidang dikenali", kolomTab.delegasiKeluarSidang, "tgl_sidang");

  const hasilTab = await dbTabayun.tahapan.delegasiKeluarPerkara(4211);
  cek("tabayun terbaca", hasilTab.terbaca, true);
  cek("tiga delegasi terbaca", hasilTab.baris.length, 3);
  cek("9 hari sebelum sidang bernilai 0", hasilTab.baris[0].nilai, 0);
  cek("3 hari sebelum sidang bernilai -3", hasilTab.baris[1].nilai, -3);
  // id_jenis_delegasi 2 bukan panggilan - tidak dinilai.
  cek("delegasi pemberitahuan tidak dinilai", hasilTab.baris[2].nilai, null);
  cek("delegasi pemberitahuan ditandai bukan panggilan", hasilTab.baris[2].panggilan, false);
  cek("pelaksanaannya terbaca", hasilTab.baris[0].pelaksanaan.jurusita, "Mustini");
  cek("tanggal relaas terbaca", hasilTab.baris[0].pelaksanaan.tanggalRelaas, "2026-04-05");
  cek("tanggal sidang dari tabel delegasi", hasilTab.baris[0].tanggalSidang, "2026-04-10");

  // -------------------------------------------------------------------------
  console.log("Hasil mediasi - arti kode SIPP");
  // -------------------------------------------------------------------------

  const arti = dbMediasi.tahapan.artiHasilMediasi;
  const berhasilKah = dbMediasi.tahapan.mediasiBerhasil;

  cek("Y1 = Berhasil Kesepakatan Damai", arti("Y1"), "Berhasil Kesepakatan Damai");
  cek("Y2 = Berhasil Dengan Pencabutan", arti("Y2"), "Berhasil Dengan Pencabutan");
  cek("S = Berhasil Sebagian", arti("S"), "Berhasil Sebagian");
  cek("D = Tidak Dapat Dilaksanakan", arti("D"), "Tidak Dapat Dilaksanakan");
  cek("T = Tidak Berhasil", arti("T"), "Tidak Berhasil");
  // Kode yang tidak dikenali dibaca tidak berhasil - itu pilihan yang aman.
  cek("kode asing dibaca Tidak Berhasil", arti("ZZ"), "Tidak Berhasil");
  cek("kode huruf kecil tetap dikenali", arti("y1"), "Berhasil Kesepakatan Damai");
  cek("kosong tetap kosong", arti(""), "");

  cek("Y1 termasuk berhasil", berhasilKah("Y1"), true);
  cek("Y2 termasuk berhasil", berhasilKah("Y2"), true);
  cek("S termasuk berhasil", berhasilKah("S"), true);
  cek("D bukan berhasil", berhasilKah("D"), false);
  cek("T bukan berhasil", berhasilKah("T"), false);

  // -------------------------------------------------------------------------
  console.log("Mediasi - mulai dari penetapan mediator, selesai dari laporan");
  // -------------------------------------------------------------------------

  const tiruanMed2 = buatDbTiruan({
    kolom: {
      perkara_mediasi: [
        "mediasi_id",
        "perkara_id",
        "mediator_text",
        "status_mediator",
        "penetapan_penunjukan_mediator",
        "tgl_laporan_mediator",
        "hasil_mediasi",
        "isi_kesepakatan_perdamaian",
        "tgl_kesepakatan_perdamaian",
        "dimulai_mediasi",
        "keputusan_mediasi",
      ],
      v_durasi_mediasi: ["perkara_id", "durasi_mediasi"],
    },
    baris: {
      "FROM perkara_mediasi m": [
        {
          mediasiId: 772,
          mediator: "Idris, S.H.I., M.H.",
          penetapan: "2026-06-25",
          laporan: "2026-07-15",
          hasil: "S",
          kesepakatan: "<p>Para pihak sepakat</p>",
          tanggalKesepakatan: "2026-07-15",
        },
      ],
      "FROM v_durasi_mediasi v": [{ hari: 20 }],
    },
  });
  const med2 = muatDengan(tiruanMed2);
  med2.skema.lupakan();

  const kolomMed2 = await med2.skema.kolomTerpilih();
  cek("mulai dibaca dari penetapan penunjukan mediator", kolomMed2.mediasiPenetapan, "penetapan_penunjukan_mediator");
  cek("selesai dibaca dari tgl_laporan_mediator", kolomMed2.mediasiLaporan, "tgl_laporan_mediator");
  cek("isi kesepakatan dari isi_kesepakatan_perdamaian", kolomMed2.mediasiKesepakatan, "isi_kesepakatan_perdamaian");

  const hasilMed2 = await med2.tahapan.mediasiLengkapPerkara(4211);
  const satu = hasilMed2.baris[0];
  cek("mulai = tanggal penetapan mediator", satu.tanggalMulai, "2026-06-25");
  cek("selesai = tanggal laporan mediator", satu.tanggalSelesai, "2026-07-15");
  cek("hasil diterjemahkan", satu.hasil, "Berhasil Sebagian");
  cek("berhasil ditandai", satu.berhasil, true);
  // Lama diambil dari view, bukan dari selisih tanggal.
  cek("lama dari v_durasi_mediasi", satu.lamaHari, 20);
  cek("sumber lamanya disebutkan", satu.lamaDariView, true);
  cek("isi kesepakatan terbawa utuh", satu.isiKesepakatan.includes("sepakat"), true);

  // Tanpa view, lama dihitung dari selisih tanggal.
  const tiruanMed3 = buatDbTiruan({
    kolom: {
      perkara_mediasi: [
        "mediasi_id",
        "perkara_id",
        "mediator_text",
        "penetapan_penunjukan_mediator",
        "tgl_laporan_mediator",
        "hasil_mediasi",
      ],
    },
    baris: {
      "FROM perkara_mediasi m": [
        { mediasiId: 1, mediator: "Idris", penetapan: "2026-06-25", laporan: "2026-07-15", hasil: "T" },
      ],
    },
  });
  const med3 = muatDengan(tiruanMed3);
  med3.skema.lupakan();
  const hasilMed3 = await med3.tahapan.mediasiLengkapPerkara(4211);
  cek("tanpa view: lama dari selisih tanggal", hasilMed3.baris[0].lamaHari, 20);
  cek("tanpa view: sumbernya bukan view", hasilMed3.baris[0].lamaDariView, false);
  cek("hasil T tidak berhasil", hasilMed3.baris[0].berhasil, false);

  // -------------------------------------------------------------------------
  console.log("Potongan mediasi dijepit - view kadang menghasilkan ribuan hari");
  // -------------------------------------------------------------------------

  const nilaiMed = require("../services/penilaianSippService");
  const poinLama = (fakta) =>
    nilaiMed.poinPerkara(fakta).rinci.find((x) => x.kunci === "waktuPutus").poin;
  const daftarAwal2 = new Date("2026-01-01T00:00:00");
  const putusPada = (n) => new Date(daftarAwal2.getTime() + n * 24 * 60 * 60 * 1000);

  // Perkara 200 hari dengan mediasi 30 hari: 201 - 30 = 171 hari, nilai 0.
  cek(
    "mediasi wajar dipotong apa adanya",
    poinLama({ tanggalDaftar: daftarAwal2, tanggalPutus: putusPada(200), hariMediasi: 30 }),
    0
  );

  // View menghasilkan 4228 hari untuk perkara yang berjalan 201 hari. Tanpa
  // penjepit, sisanya negatif dan perkaranya bernilai 5 tanpa berhak.
  const catatanJepit = nilaiMed
    .poinPerkara({ tanggalDaftar: daftarAwal2, tanggalPutus: putusPada(200), hariMediasi: 4228 })
    .rinci.find((x) => x.kunci === "waktuPutus").catatan;
  cek("potongan menyimpang disebutkan dijepit", catatanJepit.includes("dijepit"), true);
  cek(
    "perkara 201 hari dengan mediasi 4228 tetap dinilai wajar",
    poinLama({ tanggalDaftar: daftarAwal2, tanggalPutus: putusPada(200), hariMediasi: 4228 }),
    5
  );
  // Sisanya tidak boleh nol atau negatif - paling sedikit satu hari.
  cek(
    "sisa setelah dijepit paling sedikit satu hari",
    catatanJepit.includes("= 1 hari"),
    true
  );

  // -------------------------------------------------------------------------
  console.log("Putusan - nomor rujukan diterjemahkan jadi namanya");
  // -------------------------------------------------------------------------

  const tiruanPut = buatDbTiruan({
    kolom: {
      perkara_putusan: [
        "perkara_id",
        "tanggal_putusan",
        "status_putusan_id",
        "sumber_hukum_id",
        "amar_putusan",
      ],
      status_putusan: ["id", "nama"],
      sumber_hukum: ["id", "nama"],
    },
    baris: {
      "FROM perkara_putusan pu": [
        {
          tanggalPutusan: "2026-08-11",
          statusId: 58,
          sumberHukumId: "1,3,5",
          amar: "<p>Mengabulkan permohonan Pemohon;</p>",
        },
      ],
      "FROM status_putusan r": [{ nama: "Dikabulkan" }],
      "FROM sumber_hukum r": [
        { nama: "Fiqh Islam" },
        { nama: "Kompilasi Hukum Islam" },
        { nama: "UU/PP" },
      ],
    },
  });
  const dbPut = muatDengan(tiruanPut);
  dbPut.skema.lupakan();

  const hasilPut = await dbPut.tahapan.putusanLengkapPerkara(4211);
  cek("putusan terbaca", hasilPut.ada, true);
  // Angka 58 diterjemahkan jadi namanya - angka tidak memberi tahu apa-apa.
  cek("status putusan diterjemahkan dari nomornya", hasilPut.statusPutusan, "Dikabulkan");
  cek("nomor statusnya tetap dibawa", hasilPut.statusPutusanId, 58);
  // sumber_hukum_id dapat memuat beberapa nomor sekaligus.
  cek(
    "sumber hukum bernomor jamak diterjemahkan seluruhnya",
    hasilPut.sumberHukum,
    "Fiqh Islam, Kompilasi Hukum Islam, UU/PP"
  );

  const rujuk = dbPut.tahapan.namaRujukan;
  cek("nomor kosong menghasilkan kosong", await rujuk("status_putusan", "id", "nama", ""), "");
  cek("nomor bukan angka diabaikan", await rujuk("status_putusan", "id", "nama", "abc"), "");
  cek(
    "tabel yang tidak ada menghasilkan kosong",
    await rujuk("tabel_tidak_ada", "id", "nama", "1"),
    ""
  );

  // Tanpa tabel rujukan, teks pada perkara_putusan yang dipakai.
  const dbPutTeks = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_putusan: ["perkara_id", "tanggal_putusan", "status_putusan_nama", "status_putusan_id"],
      },
      baris: {
        "FROM perkara_putusan pu": [
          { tanggalPutusan: "2026-08-11", statusNama: "Dikabulkan", statusId: 58 },
        ],
      },
    })
  );
  dbPutTeks.skema.lupakan();
  const hasilPutTeks = await dbPutTeks.tahapan.putusanLengkapPerkara(4211);
  cek("tanpa tabel rujukan, teksnya yang dipakai", hasilPutTeks.statusPutusan, "Dikabulkan");

  // -------------------------------------------------------------------------
  console.log("Ikrar talak - status dan kelengkapannya");
  // -------------------------------------------------------------------------

  const artiIkrar = dbPut.tahapan.artiStatusIkrar;
  cek("status 1 = Terlaksana", artiIkrar(1), "Terlaksana");
  cek("status 2 = Tidak Mempunyai Kekuatan Hukum", artiIkrar(2), "Tidak Mempunyai Kekuatan Hukum");
  cek("status 3 = Rujuk/Damai", artiIkrar(3), "Rujuk/Damai");
  // Nomor yang tidak dikenali TIDAK ditebak - dikembalikan kosong.
  cek("status tidak dikenali menghasilkan kosong", artiIkrar(9), "");
  cek("bukan angka menghasilkan kosong", artiIkrar("x"), "");

  const dbIkrar = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_ikrar_talak: [
          "id",
          "perkara_id",
          "penetapan_majelis_hakim",
          "majelis_hakim_text",
          "penetapan_panitera_pengganti",
          "panitera_pengganti_text",
          "penetapan_jurusita",
          "jurusita_text",
          "penetapan_sidang_ikrar_talak",
          "tanggal_ikrar_talak",
          "amar_ikrar_talak",
          "ikrar_talak_dok",
          "status_penetapan_ikrar_talak_id",
        ],
      },
      baris: {
        "FROM perkara_ikrar_talak t": [
          {
            ikrarId: 44,
            penetapanMajelis: "2026-08-12",
            majelis: "Hakim Ketua: Sudarmin H.I.M. Tang",
            penetapanPp: "2026-08-12",
            pp: "Panitera Pengganti: Munifa",
            penetapanJs: "2026-08-12",
            js: "Juru Sita Pengganti: Mustini",
            penetapanSidang: "2026-08-20",
            tanggalIkrar: "2026-08-26",
            amar: "<p>Memberi izin kepada Pemohon</p>",
            dokumen: "resources/file/ikrar.pdf",
            statusId: 1,
          },
        ],
      },
    })
  );
  dbIkrar.skema.lupakan();

  const hasilIkrar = await dbIkrar.tahapan.ikrarTalakPerkara(4211);
  cek("ikrar talak terbaca", hasilIkrar.ada, true);
  cek("penetapan majelis terbaca", hasilIkrar.penetapanMajelis, "2026-08-12");
  cek("nama majelis terbaca", hasilIkrar.majelis.includes("Sudarmin"), true);
  cek("penetapan panitera pengganti terbaca", hasilIkrar.penetapanPp, "2026-08-12");
  cek("penetapan juru sita terbaca", hasilIkrar.penetapanJs, "2026-08-12");
  cek("penetapan sidang ikrar terbaca", hasilIkrar.penetapanSidang, "2026-08-20");
  cek("tanggal ikrar terbaca", hasilIkrar.tanggalIkrar, "2026-08-26");
  cek("status diterjemahkan", hasilIkrar.status, "Terlaksana");
  cek("berkasnya ada", hasilIkrar.adaBerkas, true);
  cek("nomor barisnya dibawa untuk unduhan", hasilIkrar.ikrarId, "44");
  cek("ikrar sudah diucapkan", hasilIkrar.sudahDiucapkan, true);

  // Ikrar yang belum diucapkan - itu yang paling perlu terlihat.
  const dbIkrarBelum = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_ikrar_talak: [
          "id",
          "perkara_id",
          "penetapan_sidang_ikrar_talak",
          "tanggal_ikrar_talak",
          "status_penetapan_ikrar_talak_id",
        ],
      },
      baris: {
        "FROM perkara_ikrar_talak t": [
          { ikrarId: 45, penetapanSidang: "2026-08-20", tanggalIkrar: null, statusId: 2 },
        ],
      },
    })
  );
  dbIkrarBelum.skema.lupakan();
  const ikrarBelum = await dbIkrarBelum.tahapan.ikrarTalakPerkara(4211);
  cek("ikrar belum diucapkan ditandai", ikrarBelum.sudahDiucapkan, false);
  cek("statusnya kehilangan kekuatan hukum", ikrarBelum.status, "Tidak Mempunyai Kekuatan Hukum");
  cek("tanpa berkas: tidak ada tombol unduh", ikrarBelum.adaBerkas, false);

  // Perkara bukan cerai talak - tabelnya ada tetapi barisnya tidak.
  const dbTanpaIkrar = muatDengan(
    buatDbTiruan({ kolom: { perkara_ikrar_talak: ["id", "perkara_id", "tanggal_ikrar_talak"] } })
  );
  dbTanpaIkrar.skema.lupakan();
  const tanpaIkrar = await dbTanpaIkrar.tahapan.ikrarTalakPerkara(4211);
  cek("perkara tanpa ikrar: terbaca tetapi tidak ada", tanpaIkrar.terbaca, true);
  cek("perkara tanpa ikrar: ada = false", tanpaIkrar.ada, false);

  // -------------------------------------------------------------------------
  console.log("Nama dokumen penetapan - singkatan maupun tulisan panjang");
  // -------------------------------------------------------------------------

  const kenali = dbPut.tahapan.kenaliJenisPenetapan;
  cek("PMH dikenali", kenali("PMH"), "PMH");
  cek("tulisan panjang PMH dikenali", kenali("Penetapan Majelis Hakim"), "PMH");
  cek("PPP dikenali", kenali("PPP"), "PPP");
  cek("penunjukan panitera dikenali", kenali("Penunjukan Panitera Pengganti"), "PPP");
  cek("penetapan panitera dikenali", kenali("Penetapan Panitera Pengganti"), "PPP");
  cek("PJS dikenali", kenali("PJS"), "PJS");
  cek("penunjukan juru sita dikenali", kenali("Penunjukan Juru Sita"), "PJS");
  cek("jurusita tanpa spasi dikenali", kenali("Penetapan Jurusita"), "PJS");
  cek("PHS dikenali", kenali("PHS"), "PHS");
  cek("penetapan hari sidang dikenali", kenali("Penetapan Hari Sidang"), "PHS");
  cek("huruf kecil tetap dikenali", kenali("pmh"), "PMH");
  // Yang tidak dikenali dikembalikan kosong, bukan ditebak masuk salah satu.
  cek("nama asing tidak dipaksakan", kenali("Surat Kuasa"), "");
  cek("kosong tetap kosong", kenali(""), "");

  // Berkas penetapan bertulisan panjang tetap ketemu.
  const dbDokPanjang = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_dokumen_penetapan: ["id", "perkara_id", "nama_dokumen", "diinput_tanggal", "dokumen"],
      },
      baris: {
        "FROM perkara_dokumen_penetapan d": [
          { id: 71, nama: "Penetapan Majelis Hakim", diinput: "2026-06-22", berkas: "a.pdf" },
          { id: 72, nama: "Penetapan Hari Sidang", diinput: "2026-06-22", berkas: "b.pdf" },
        ],
      },
    })
  );
  dbDokPanjang.skema.lupakan();
  const dokPanjang = await dbDokPanjang.tahapan.dokumenPenetapanPerkara(4211);
  cek("dokumen bertulisan panjang dikelompokkan sebagai PMH", Boolean(dokPanjang.perNama.PMH), true);
  cek("nomor barisnya dibawa untuk unduhan", dokPanjang.perNama.PMH.id, "71");
  cek("PHS bertulisan panjang juga ketemu", dokPanjang.perNama.PHS.id, "72");

  // -------------------------------------------------------------------------
  console.log("Arsip - berkas dan tombol unduhnya");
  // -------------------------------------------------------------------------

  const dbArsip = muatDengan(
    buatDbTiruan({
      kolom: { arsip: ["id", "perkara_id", "diinput_tanggal", "nomor_box", "keterangan", "diinput_oleh", "dokumen"] },
      baris: {
        "FROM arsip a": [
          { arsipId: 900, diinput: "2025-03-21", nomor: "100", oleh: "panmud4", berkas: "arsip/100.pdf" },
        ],
      },
    })
  );
  dbArsip.skema.lupakan();
  const hasilArsip = await dbArsip.tahapan.arsipKeteranganPerkara(4211);
  cek("arsip terbaca", hasilArsip.terbaca, true);
  cek("sudah diarsipkan", hasilArsip.sudahDiarsipkan, true);
  cek("nomor box terbaca", hasilArsip.baris[0].nomor, "100");
  cek("berkasnya ada", hasilArsip.baris[0].adaBerkas, true);
  cek("nomor barisnya dibawa untuk unduhan", hasilArsip.baris[0].arsipId, "900");
  cek("kolom berkas dikenali", hasilArsip.berkasTerbaca, true);

  // Tanpa kolom berkas, tombol unduh memang tidak boleh muncul.
  const dbArsipTanpa = muatDengan(
    buatDbTiruan({
      kolom: { arsip: ["id", "perkara_id", "diinput_tanggal", "nomor_box"] },
      baris: { "FROM arsip a": [{ arsipId: 901, diinput: "2025-03-21", nomor: "101" }] },
    })
  );
  dbArsipTanpa.skema.lupakan();
  const arsipTanpa = await dbArsipTanpa.tahapan.arsipKeteranganPerkara(4211);
  cek("tanpa kolom berkas: tetap terbaca", arsipTanpa.terbaca, true);
  cek("tanpa kolom berkas: ditandai", arsipTanpa.berkasTerbaca, false);
  cek("tanpa kolom berkas: adaBerkas false", arsipTanpa.baris[0].adaBerkas, false);

  // -------------------------------------------------------------------------
  console.log("Konseptor putusan - username diterjemahkan jadi nama");
  // -------------------------------------------------------------------------

  const tiruanKons = buatDbTiruan({
    kolom: {
      // Nama kolom SIPP yang SEBENARNYA: proses_id, bukan tahapan_id.
      // Tebakan lama membuat penyaringnya tidak pernah cocok, konseptor selalu
      // kosong, dan layarnya menerangkan bahwa tahapan putusan tidak tercatat -
      // padahal tercatat, hanya dicari di kolom yang keliru.
      perkara_proses: ["perkara_id", "proses_id", "diinput_oleh", "diinput_tanggal"],
      sys_users: ["id", "username", "fullname"],
    },
    baris: {
      "FROM perkara_proses p": [
        { pengguna: "panmud4", tanggal: "2025-02-25" },
        { pengguna: "panmud4", tanggal: "2025-02-26" },
      ],
      "FROM sys_users u": [{ pengguna: "panmud4", nama: "Munifa, S.H." }],
    },
  });
  const dbKons = muatDengan(tiruanKons);
  dbKons.skema.lupakan();

  cek("tahapan putusan bernomor 210", dbKons.tahapan.TAHAPAN_PUTUSAN, 210);

  const hasilKons = await dbKons.tahapan.konseptorPutusanPerkara(4211);
  cek("konseptor terbaca", hasilKons.terbaca, true);
  // Dua baris dengan pengguna sama hanya disebut sekali.
  cek("pengguna yang sama tidak disebut dua kali", hasilKons.baris.length, 1);
  cek("nama lengkap dipakai, bukan username", hasilKons.baris[0].nama, "Munifa, S.H.");
  cek("usernamenya tetap dibawa", hasilKons.baris[0].pengguna, "panmud4");
  cek("namanya terbaca ditandai", hasilKons.baris[0].namaTerbaca, true);

  // Kuerinya harus menyaring tahapan_id 210 - bukan seluruh proses perkara.
  const kueriKons = tiruanKons.direkam.find((x) => x.sql.includes("FROM perkara_proses p"));
  cek("kueri konseptor terbentuk", Boolean(kueriKons), true);
  cek("disaring dengan proses_id", /proses_id = \?/.test(kueriKons ? kueriKons.sql : ""), true);
  cek("nomor tahapannya 210", (kueriKons ? kueriKons.params : []).includes(210), true);

  // Tanpa sys_users, yang tampil nama penggunanya - bukan kosong.
  const dbKonsTanpa = muatDengan(
    buatDbTiruan({
      kolom: { perkara_proses: ["perkara_id", "proses_id", "diinput_oleh", "diinput_tanggal"] },
      baris: { "FROM perkara_proses p": [{ pengguna: "panmud4", tanggal: "2025-02-25" }] },
    })
  );
  dbKonsTanpa.skema.lupakan();
  const konsTanpa = await dbKonsTanpa.tahapan.konseptorPutusanPerkara(4211);
  cek("tanpa sys_users: usernamenya yang tampil", konsTanpa.baris[0].nama, "panmud4");
  cek("tanpa sys_users: ditandai belum terbaca", konsTanpa.baris[0].namaTerbaca, false);

  // Tidak semua satker mencatat tahapan putusan pada perkara_proses. Pada
  // perkara seperti itu jejak audit yang menjawab - TETAPI asalnya ditandai,
  // karena yang menginput belum tentu yang mengonsep.
  const dbKonsAudit = muatDengan(
    buatDbTiruan({
      kolom: {
        perkara_proses: ["perkara_id", "proses_id", "diinput_oleh", "diinput_tanggal"],
        sys_audittrail: ["id", "table_name", "record_id", "perkara_id", "waktu", "pelaku", "aksi"],
        sys_users: ["id", "username", "fullname"],
      },
      baris: {
        // Tahapan 210 tidak pernah dicatat.
        "FROM perkara_proses p": [],
        "FROM sys_audittrail a": [{ waktu: "2026-02-24 10:15:00", pelaku: "nuniek", aksi: "insert" }],
        "FROM sys_users u": [{ pengguna: "nuniek", nama: "Nuniek Hastuti, S.H." }],
      },
    })
  );
  dbKonsAudit.skema.lupakan();
  dbKonsAudit.audit.lupakan();
  const konsAudit = await dbKonsAudit.tahapan.konseptorPutusanPerkara(4211);

  cek("tanpa tahapan 210: jejak audit dipakai", konsAudit.baris.length, 1);
  cek("nama dari jejak audit diterjemahkan", konsAudit.baris[0].nama, "Nuniek Hastuti, S.H.");
  cek("asal jejak audit ditandai pada barisnya", konsAudit.baris[0].dariAudit, true);
  cek("asal jejak audit ditandai pada hasilnya", konsAudit.dariAudit, true);
  cek("sebabnya diterangkan", konsAudit.catatan.length > 0, true);

  // Bila keduanya tidak menjawab, yang dikembalikan kosong TETAPI dengan
  // keterangan - supaya layarnya dapat menerangkan mengapa, alih-alih
  // menghilangkan bagiannya dan membuat orang mengira fiturnya tidak ada.
  const dbKonsSepi = muatDengan(
    buatDbTiruan({
      kolom: { perkara_proses: ["perkara_id", "proses_id", "diinput_oleh"] },
      baris: { "FROM perkara_proses p": [] },
    })
  );
  dbKonsSepi.skema.lupakan();
  dbKonsSepi.audit.lupakan();
  const konsSepi = await dbKonsSepi.tahapan.konseptorPutusanPerkara(4211);
  cek("tanpa jejak apa pun: tetap terbaca, tidak galat", konsSepi.terbaca, true);
  cek("tanpa jejak apa pun: barisnya kosong", konsSepi.baris.length, 0);
  cek("tanpa jejak apa pun: sebabnya tetap diterangkan", konsSepi.catatan.length > 0, true);
  // -------------------------------------------------------------------------
  console.log("Kueri SIPP hanya membaca");
  // -------------------------------------------------------------------------

  const fs = require("fs");
  const menulis = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|TRUNCATE|ALTER\s+TABLE|REPLACE\s+INTO)\b/i;
  for (const nama of ["sippTahapanService.js", "sippSkemaService.js"]) {
    const sumber = fs.readFileSync(path.join(__dirname, "..", "services", nama), "utf8");
    cek(`${nama} tidak menulis ke SIPP`, menulis.test(sumber), false);
  }

  // Nama kolom yang disambung ke kueri harus berasal dari daftar calon di
  // dalam kode - tidak boleh ada jalan dari luar.
  const sumberSkema = fs.readFileSync(
    path.join(__dirname, "..", "services", "sippSkemaService.js"),
    "utf8"
  );
  cek(
    "pilihKolom hanya mengembalikan nama yang ada di information_schema",
    /if \(punya\.has\(nama\)\) return nama;/.test(sumberSkema),
    true
  );

  if (jumlah < 275) {
    gagal += 1;
    console.log(`  GAGAL: skrip hanya menjalankan ${jumlah} pemeriksaan - ada yang tidak berjalan.`);
  }

  console.log("");
  if (gagal === 0) {
    console.log(`  OK - ${jumlah} pemeriksaan lulus.`);
    console.log("");
    return 0;
  }
  console.log(`  ${gagal} dari ${jumlah} pemeriksaan GAGAL.`);
  console.log("");
  return 1;
}

utama()
  .then((kode) => process.exit(kode))
  .catch((error) => {
    console.log(`  GAGAL: ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
