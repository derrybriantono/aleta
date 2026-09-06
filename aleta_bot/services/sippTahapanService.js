"use strict";

/**
 * Tahapan satu perkara, dari pendaftaran sampai berkekuatan hukum tetap.
 *
 * ============================================================================
 * KOLOMNYA DIKENALI, BUKAN DITEBAK
 * ============================================================================
 *
 * Tanggal penetapan majelis, penunjukan panitera pengganti, penunjukan juru
 * sita, penetapan hari sidang, dan tanggal-tanggal PENGINPUTANNYA tersimpan
 * dengan nama kolom yang berbeda antar versi SIPP. Nama itu dicari lebih dulu
 * lewat sippSkemaService, dan hanya nama yang benar-benar ada yang dipakai.
 *
 * Tahapan yang kolomnya tidak ketemu dikembalikan dengan `terbaca: false` dan
 * sebabnya - tidak dikosongkan diam-diam, dan tidak pula dinilai nol.
 *
 * ============================================================================
 * NAMA KOLOM YANG DISAMBUNG KE KUERI DATANG DARI DAFTAR TERTUTUP
 * ============================================================================
 *
 * SELECT tidak dapat menerima nama kolom sebagai parameter, jadi namanya memang
 * harus disambung ke teks kueri. Yang membuatnya aman: namanya hanya boleh
 * berasal dari sippSkemaService, yang hanya mengembalikan nama yang cocok
 * dengan daftar calon di dalam kode DAN ada di information_schema. Tidak ada
 * jalan dari peramban ke sini.
 *
 * Nilai - nomor perkara, tanggal - tetap selalu masuk sebagai parameter.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");
const sippAuditService = require("./sippAuditService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "";
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

/**
 * Ciri mafqud menurut SK 048/2024 Tabel 2 nomor 1 angka 3: tundaan sidang
 * 3 x 90 hari. Kedua angkanya disebut di sini, bukan ditanam di dalam kode,
 * supaya dapat ditelusuri kembali ke SK-nya.
 */
const AMBANG_TUNDAAN_MAFQUD = 90;
const JUMLAH_TUNDAAN_MAFQUD = 3;
/** Selisih hari kalender antara dua tanggal ISO. */
function selisihHari(dari, ke) {
  if (!dari || !ke) return null;
  const a = new Date(`${dari}T00:00:00`);
  const b = new Date(`${ke}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Tahapan penetapan satu perkara.
 *
 * ============================================================================
 * DUA TABEL, DUA PERTANYAAN BERBEDA
 * ============================================================================
 *
 *   perkara_penetapan          - KAPAN penetapannya dibuat
 *   perkara_dokumen_penetapan  - KAPAN penetapan itu diinput dan dicetak,
 *                                beserta berkas pindaiannya
 *
 * Keduanya diperlukan, dan SK menilai keduanya: tanggal penetapannya
 * dibandingkan acuannya (Tabel 2 I.2, I.4, I.6, I.8), dan tanggal
 * penginputannya dibandingkan tanggal penetapan itu (I.3, I.5, I.7, I.9).
 *
 * ============================================================================
 * YANG DINILAI PENETAPAN PERTAMA, BUKAN PENETAPAN KEMBALI
 * ============================================================================
 *
 * Satu perkara dapat punya beberapa baris penetapan: majelis berganti karena
 * hakim mutasi, jurusita berhalangan, panitera pengganti diganti. Baris
 * berikutnya itu PENETAPAN KEMBALI, dan tanggalnya jauh sesudah pendaftaran.
 *
 * Memakai baris terakhir menghasilkan angka yang menyesatkan: perkara yang
 * majelisnya berganti pada bulan ketiga akan terbaca seolah PMH-nya terlambat
 * sembilan puluh hari - padahal PMH aslinya terbit pada hari pendaftaran.
 * Jeda inputnya pun jadi negatif, sebab dokumennya diunggah untuk penetapan
 * yang asli.
 *
 * Karena itu yang dinilai baris PERTAMA. Penetapan kembali tetap dilaporkan,
 * tetapi sebagai keterangan tersendiri - bukan sebagai pengganti yang asli.
 *
 * Begitu pula dokumennya: yang dipakai unggahan PERTAMA tiap jenis. Unggahan
 * susulan bertahun kemudian tidak boleh menghapus fakta bahwa aslinya sudah
 * diinput tepat waktu.
 */
async function tahapanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", tahap: [] };

  const kolom = await sippSkemaService.kolomTerpilih();
  const adaPenetapan = await sippSkemaService.tabelAda("perkara_penetapan");

  /**
   * Tahapan yang dicari.
   *
   * `acuan` menyebut tahap mana yang menjadi titik nol perhitungan hari,
   * mengikuti SK: PMH dihitung dari pendaftaran; PP, juru sita, dan PHS
   * dihitung dari PMH.
   *
   * `namaDokumen` adalah nilai kolom nama_dokumen pada tabel dokumen
   * penetapan - itulah yang membedakan keempat penetapan di sana.
   */
  const RENCANA = [
    {
      kunci: "pendaftaran",
      label: "Pendaftaran perkara",
      kolomTanggal: "tanggal_pendaftaran",
      dariPerkara: true,
      kolomInput: kolom.inputPendaftaran,
      namaDokumen: "",
      acuan: "",
      dasar: "SK 048/2024 Tabel 2 I.1",
    },
    {
      kunci: "pmh",
      label: "Penetapan Majelis Hakim (PMH)",
      kolomTanggal: kolom.tanggalPmh,
      namaDokumen: "PMH",
      acuan: "pendaftaran",
      dasar: "SK 048/2024 Tabel 2 I.2 dan I.3",
    },
    {
      kunci: "ppp",
      label: "Penunjukan Panitera Pengganti",
      kolomTanggal: kolom.tanggalPpp,
      namaDokumen: "PPP",
      acuan: "pmh",
      dasar: "SK 048/2024 Tabel 2 I.4 dan I.5",
    },
    {
      kunci: "pjs",
      label: "Penunjukan Juru Sita",
      kolomTanggal: kolom.tanggalPjs,
      namaDokumen: "PJS",
      acuan: "pmh",
      dasar: "SK 048/2024 Tabel 2 I.6 dan I.7",
    },
    {
      kunci: "phs",
      label: "Penetapan Hari Sidang (PHS)",
      kolomTanggal: kolom.tanggalPhs,
      namaDokumen: "PHS",
      acuan: "pmh",
      dasar: "SK 048/2024 Tabel 2 I.8 dan I.9",
    },
  ];

  // --- baris penetapan terakhir --------------------------------------------
  let penetapan = {};
  let penetapanId = null;
  if (adaPenetapan) {
    const pilihan = ["p.perkara_id AS perkaraId"];
    for (const rencana of RENCANA) {
      if (rencana.dariPerkara || !rencana.kolomTanggal) continue;
      pilihan.push(`p.${rencana.kolomTanggal} AS ${rencana.kunci}_tanggal`);
    }
    if (kolom.sidangPertama) pilihan.push(`p.${kolom.sidangPertama} AS sidangPertama`);
    if (kolom.catatanPenetapan) pilihan.push(`p.${kolom.catatanPenetapan} AS catatan`);

    const kolomId = await sippSkemaService.pilihKolom("perkara_penetapan", ["id", "perkara_penetapan_id"]);
    if (kolomId) pilihan.push(`p.${kolomId} AS penetapanId`);

    const rows = await runQuery(
      `SELECT ${pilihan.join(", ")} FROM perkara_penetapan p
        WHERE p.perkara_id = ?
        ORDER BY ${kolomId ? `p.${kolomId}` : "p.perkara_id"} ASC
        LIMIT 1`,
      [id]
    );
    penetapan = rows[0] || {};
    penetapanId = penetapan.penetapanId ? String(penetapan.penetapanId) : null;
  }

  // --- tanggal pendaftaran, dari tabel perkara ------------------------------
  const pilihanPerkara = ["p.tanggal_pendaftaran AS pendaftaran_tanggal"];
  if (kolom.inputPendaftaran) pilihanPerkara.push(`p.${kolom.inputPendaftaran} AS pendaftaran_input`);
  const barisPerkara =
    (await runQuery(`SELECT ${pilihanPerkara.join(", ")} FROM perkara p WHERE p.perkara_id = ? LIMIT 1`, [id]))[0] ||
    {};

  // --- dokumen penetapan: kapan diinput, dan berkasnya ----------------------
  const dokumen = await dokumenPenetapanPerkara(id);

  const tanggalTahap = {};
  const tahap = RENCANA.map((rencana) => {
    const tanggal = rencana.dariPerkara
      ? isoTanggal(barisPerkara.pendaftaran_tanggal)
      : rencana.kolomTanggal
        ? isoTanggal(penetapan[`${rencana.kunci}_tanggal`])
        : "";
    tanggalTahap[rencana.kunci] = tanggal;

    const berkas = rencana.namaDokumen ? dokumen.perNama[rencana.namaDokumen] || null : null;
    const diinput = rencana.dariPerkara
      ? isoTanggal(barisPerkara.pendaftaran_input)
      : berkas
        ? berkas.diinput
        : "";

    const terbaca = rencana.dariPerkara ? true : Boolean(rencana.kolomTanggal && adaPenetapan);
    const inputTerbaca = rencana.dariPerkara
      ? Boolean(rencana.kolomInput)
      : dokumen.terbaca;

    return {
      kunci: rencana.kunci,
      label: rencana.label,
      dasar: rencana.dasar,
      tanggal,
      diinput,
      terbaca,
      inputTerbaca,
      alasan: terbaca ? "" : "Kolom tanggalnya tidak ada pada SIPP versi ini.",
      alasanInput: inputTerbaca ? "" : dokumen.alasan || "Tanggal penginputannya tidak terbaca.",
      acuan: rencana.acuan,
      // Berkas pindaian penetapannya - diberi tombol unduh di layar.
      dokumenId: berkas ? berkas.id : "",
      adaBerkas: Boolean(berkas && berkas.adaBerkas),
      diinputOleh: berkas ? berkas.oleh : "",
    };
  });

  for (const satu of tahap) {
    const acuan = satu.acuan ? tanggalTahap[satu.acuan] : "";
    satu.hariSejakAcuan = satu.acuan ? selisihHari(acuan, satu.tanggal) : null;
    satu.hariSampaiInput = selisihHari(satu.tanggal, satu.diinput);
  }

  return {
    terbaca: adaPenetapan || tahap.some((x) => x.terbaca),
    alasan: adaPenetapan ? "" : "Tabel perkara_penetapan tidak ada pada SIPP versi ini.",
    tahap,
    penetapanId,
    sidangPertama: isoTanggal(penetapan.sidangPertama),
    catatanPenetapan: cleanText(penetapan.catatan),
  };
}

/**
 * Apakah majelis, panitera pengganti, atau juru sita pernah diganti?
 *
 * SIPP menyimpan riwayatnya pada tabel petugas: baris yang tidak lagi berlaku
 * ditandai aktif = T beserta tanggal_tidak_aktif, dan barisnya membawa
 * diperbaharui_oleh serta diperbaharui_tanggal.
 *
 * Yang dikembalikan hanya KETERANGAN. Penggantian tidak mengurangi nilai
 * apa pun - hakim mutasi bukan kesalahan siapa-siapa - tetapi ia menjelaskan
 * mengapa ada lebih dari satu penetapan, dan mengapa yang dinilai yang
 * pertama.
 */
async function penetapanKembaliPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const RENCANA = [
    { tabel: "perkara_hakim_pn", label: "Majelis hakim", kolomNama: "hakim_nama" },
    { tabel: "perkara_panitera_pn", label: "Panitera pengganti", kolomNama: "panitera_nama" },
    { tabel: "perkara_jurusita", label: "Juru sita", kolomNama: "jurusita_nama" },
  ];

  const baris = [];
  let adaTabel = false;

  for (const rencana of RENCANA) {
    if (!(await sippSkemaService.tabelAda(rencana.tabel))) continue;

    const kolomAktif = await sippSkemaService.pilihKolom(rencana.tabel, ["aktif"]);
    const kolomDiperbarui = await sippSkemaService.pilihKolom(rencana.tabel, ["diperbaharui_tanggal"]);
    const kolomOleh = await sippSkemaService.pilihKolom(rencana.tabel, ["diperbaharui_oleh"]);
    const kolomTidakAktif = await sippSkemaService.pilihKolom(rencana.tabel, ["tanggal_tidak_aktif"]);
    const kolomNama = await sippSkemaService.pilihKolom(rencana.tabel, [rencana.kolomNama, "nama"]);
    const kolomDiinput = await sippSkemaService.pilihKolom(rencana.tabel, ["diinput_tanggal"]);

    if (!kolomAktif && !kolomDiperbarui) continue;
    adaTabel = true;

    const pilihan = [];
    if (kolomNama) pilihan.push(`t.${kolomNama} AS nama`);
    if (kolomAktif) pilihan.push(`t.${kolomAktif} AS aktif`);
    if (kolomDiperbarui) pilihan.push(`t.${kolomDiperbarui} AS diperbaharui`);
    if (kolomOleh) pilihan.push(`t.${kolomOleh} AS oleh`);
    if (kolomTidakAktif) pilihan.push(`t.${kolomTidakAktif} AS tidakAktif`);
    if (kolomDiinput) pilihan.push(`t.${kolomDiinput} AS diinput`);

    const rows = await runQuery(
      `SELECT ${pilihan.join(", ")} FROM ${rencana.tabel} t
        WHERE t.perkara_id = ?
        ORDER BY ${kolomDiinput ? `t.${kolomDiinput}` : "t.perkara_id"} ASC
        LIMIT 50`,
      [id]
    ).catch(() => []);

    // Yang menandakan pernah diganti: ada baris yang sudah tidak aktif, atau
    // ada baris yang pernah diperbarui.
    const diganti = rows.filter(
      (row) => cleanText(row.aktif).toUpperCase() === "T" || Boolean(row.diperbaharui)
    );
    if (diganti.length === 0) continue;

    baris.push({
      jenis: rencana.label,
      jumlahBaris: rows.length,
      penggantian: diganti.map((row) => ({
        nama: cleanText(row.nama),
        masihAktif: cleanText(row.aktif).toUpperCase() !== "T",
        tanggalTidakAktif: isoTanggal(row.tidakAktif),
        diperbaharuiPada: isoTanggal(row.diperbaharui),
        diperbaharuiOleh: cleanText(row.oleh),
      })),
    });
  }

  return {
    terbaca: adaTabel,
    alasan: adaTabel ? "" : "Kolom riwayat petugas tidak ada pada SIPP versi ini.",
    adaPenggantian: baris.length > 0,
    baris,
  };
}

/**
 * Lama mediasi, yang DIPOTONG dari waktu penyelesaian perkara.
 *
 * ============================================================================
 * KENAPA DIPOTONG
 * ============================================================================
 *
 * Mediasi wajib menurut PERMA 1/2016, dan selama berjalan perkaranya memang
 * berhenti - bukan karena majelis lambat, melainkan karena hukum acaranya
 * memerintahkan begitu. Menghitungnya sebagai keterlambatan berarti menghukum
 * majelis atas kepatuhan.
 *
 * SIPP setempat sudah menyediakan hitungannya pada view v_durasi_mediasi, dan
 * itulah yang dipakai notifikasi SIPP pengadilan ini sejak lama. Memakai
 * hitungan yang sama membuat angka ALETA dapat disandingkan dengan angka yang
 * sudah biasa dibaca - dan selisih di antara keduanya, bila ada, berarti salah
 * satunya keliru dan perlu diperiksa.
 */
async function durasiMediasiPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, hari: 0, alasan: "perkara_id_tidak_sah" };

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.durasiMediasi || !(await sippSkemaService.tabelAda("v_durasi_mediasi"))) {
    return { terbaca: false, hari: 0, alasan: "View v_durasi_mediasi tidak ada pada SIPP versi ini." };
  }

  const rows = await runQuery(
    `SELECT v.${kolom.durasiMediasi} AS hari FROM v_durasi_mediasi v WHERE v.perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);

  const hari = Number(rows[0] && rows[0].hari);
  return { terbaca: true, alasan: "", hari: Number.isFinite(hari) && hari > 0 ? hari : 0 };
}
/**
 * Menyeragamkan sebutan jenis penetapan pada perkara_dokumen_penetapan.
 *
 * SIPP menyimpan namanya sebagai teks bebas: sebagian baris memakai singkatan
 * (PMH), sebagian menuliskannya panjang (Penetapan Majelis Hakim). Keduanya
 * menunjuk berkas yang sama, dan mencocokkan hanya singkatannya membuat
 * separuh berkas tidak pernah ketemu.
 */
const SEBUTAN_PENETAPAN = [
  { kunci: "PMH", pola: /(^|\b)pmh(\b|$)|penetapan\s+majelis/i },
  { kunci: "PPP", pola: /(^|\b)ppp(\b|$)|pen(etapan|unjukan)\s+panitera/i },
  { kunci: "PJS", pola: /(^|\b)pjs(\b|$)|pen(etapan|unjukan)\s+juru\s*sita/i },
  { kunci: "PHS", pola: /(^|\b)phs(\b|$)|penetapan\s+hari\s+sidang/i },
];

function kenaliJenisPenetapan(nama) {
  const teks = cleanText(nama);
  if (!teks) return "";
  for (const acuan of SEBUTAN_PENETAPAN) {
    if (acuan.pola.test(teks)) return acuan.kunci;
  }
  return "";
}
/**
 * Dokumen penetapan satu perkara, dikelompokkan menurut jenisnya.
 *
 * Yang dipakai unggahan PERTAMA tiap jenis - lihat catatan pada
 * tahapanPerkara tentang unggahan susulan.
 */
async function dokumenPenetapanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", perNama: {} };

  if (!(await sippSkemaService.tabelAda("perkara_dokumen_penetapan"))) {
    return {
      terbaca: false,
      alasan: "Tabel perkara_dokumen_penetapan tidak ada pada SIPP versi ini.",
      perNama: {},
    };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.dokumenPenetapanNama || !kolom.dokumenPenetapanTanggal) {
    return { terbaca: false, alasan: "Kolom dokumen penetapan tidak dikenali.", perNama: {} };
  }

  const pilihan = [
    "d.id AS id",
    `d.${kolom.dokumenPenetapanNama} AS nama`,
    `d.${kolom.dokumenPenetapanTanggal} AS diinput`,
  ];
  if (kolom.dokumenPenetapanBerkas) pilihan.push(`d.${kolom.dokumenPenetapanBerkas} AS berkas`);
  if (kolom.dokumenPenetapanKembali)
    pilihan.push(`d.${kolom.dokumenPenetapanKembali} AS penetapanKembali`);
  if (kolom.dokumenPenetapanOleh) pilihan.push(`d.${kolom.dokumenPenetapanOleh} AS oleh`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_dokumen_penetapan d
      WHERE d.perkara_id = ?
      ORDER BY d.${kolom.dokumenPenetapanTanggal} ASC, d.id ASC
      LIMIT 100`,
    [id]
  );

  const perNama = {};
  // Dokumen penetapan KEMBALI, dipisahkan - hanya dipakai bila penetapan
  // awalnya tidak punya dokumen sama sekali.
  const penggantiPerNama = {};
  for (const row of rows) {
    // Nama dokumen dicocokkan lewat daftar sebutan - sebagian baris memakai
    // singkatannya (PMH), sebagian menuliskannya panjang (Penetapan Majelis
    // Hakim). Keduanya menunjuk berkas yang sama.
    const nama = kenaliJenisPenetapan(row.nama);
    if (!nama || perNama[nama]) continue;

    // Penetapan KEMBALI dilewati - SK menilai penetapan yang pertama.
    // Penggantian panitera pengganti atau juru sita di tengah jalan adalah
    // peristiwa baru, bukan keterlambatan atas peristiwa lama, dan
    // menilainya sebagai penetapan awal menghukum perkara yang justru
    // dikerjakan sebagaimana mestinya.
    //
    // Dibaca dari SIPP yang berjalan: '1' penetapan awal, '2' penggantinya.
    if (String(row.penetapanKembali || '').trim() === '2') {
      // Dicatat terpisah supaya dapat dipakai bila TIDAK ADA penetapan
      // awalnya sama sekali - menolak seluruhnya akan membuat perkara itu
      // tampak belum punya penetapan, dan itu lebih menyesatkan.
      if (!penggantiPerNama[nama]) {
        penggantiPerNama[nama] = {
          id: String(row.id || ''),
          diinput: isoTanggal(row.diinput),
          adaBerkas: Boolean(cleanText(row.berkas)),
          oleh: cleanText(row.oleh),
          penetapanKembali: true,
        };
      }
      continue;
    }
    perNama[nama] = {
      id: String(row.id || ""),
      nama,
      diinput: isoTanggal(row.diinput),
      adaBerkas: Boolean(cleanText(row.berkas)),
      oleh: cleanText(row.oleh),
    };
  }

  // Penetapan awal yang TIDAK berdokumen sama sekali dilengkapi dokumen
  // penggantinya, dengan penanda. Menolak seluruhnya akan membuat perkara itu
  // tampak belum punya penetapan - dan itu lebih menyesatkan daripada memakai
  // dokumen yang memang ada, asalkan disebutkan apa adanya.
  for (const nama of Object.keys(penggantiPerNama)) {
    if (perNama[nama]) continue;
    perNama[nama] = { ...penggantiPerNama[nama], nama };
  }

  return {
    terbaca: true,
    alasan: "",
    perNama,
    jumlah: rows.length,
    // Berapa banyak dokumen penetapan kembali yang dilewati - dipakai layar
    // untuk menjelaskan mengapa angkanya berbeda dari yang terlihat di SIPP.
    jumlahPenetapanKembali: Object.keys(penggantiPerNama).length,
  };
}

/**
 * Tahapan tiap tingkat upaya hukum, MENURUT URUTAN TERJADINYA.
 *
 * ============================================================================
 * NAMA KOLOMNYA DIAMBIL DARI SKEMA SIPP, BUKAN DITEBAK DARI POLA
 * ============================================================================
 *
 * Susunan sebelumnya menebak nama kolom dari pola yang rapi - memori_{s},
 * kontra_memori_{s}, tanggal_kirim_berkas. SIPP tidak menamainya begitu:
 * yang ada penerimaan_memori_banding, penerimaan_kontra_kasasi,
 * pengiriman_berkas_pk. Hampir seluruh tahap karena itu tertulis "tidak
 * tersedia" pada perkara yang datanya justru lengkap.
 *
 * Sekarang tiap tingkat membawa daftar kolomnya sendiri, disalin dari skema
 * SIPP yang sebenarnya. Yang masih dicoba beberapa nama hanyalah kolom yang
 * memang berbeda antar versi.
 *
 * URUTANNYA DITETAPKAN DI SINI, bukan diurut dari tanggalnya: tanggal kosong
 * akan melompat ke ujung, dan dua peristiwa bertanggal sama - lazim, karena
 * banyak yang dicatat sekaligus - akan bertukar tempat tiap kali dibaca.
 *
 * Tahap yang tanggalnya kosong TETAP disebut. Itulah gunanya daftar ini:
 * memperlihatkan mana yang belum dikerjakan.
 */
const TAHAP_UPAYA = [
  { kunci: "permohonan", label: "Permohonan diajukan" },
  { kunci: "pemberitahuanPermohonan", label: "Pemberitahuan permohonan kepada lawan" },
  { kunci: "memoriDiterima", label: "Memori diterima" },
  { kunci: "memoriDiserahkan", label: "Memori diserahkan kepada lawan" },
  { kunci: "kontraDiterima", label: "Kontra memori diterima" },
  { kunci: "kontraDiserahkan", label: "Kontra memori diserahkan" },
  { kunci: "pemberitahuanInzage", label: "Pemberitahuan inzage" },
  { kunci: "pelaksanaanInzage", label: "Inzage dilaksanakan" },
  { kunci: "kirimBerkas", label: "Berkas dikirim ke pengadilan tingkat atas" },
  { kunci: "terimaBerkas", label: "Berkas diterima kembali" },
  { kunci: "daftarTingkatAtas", label: "Terdaftar di pengadilan tingkat atas" },
  { kunci: "sidangPertama", label: "Sidang pertama" },
  { kunci: "putusan", label: "Putusan tingkat atas" },
  { kunci: "minutasi", label: "Minutasi" },
  { kunci: "kirimSalinan", label: "Salinan putusan dikirim" },
  { kunci: "pemberitahuanPutusan", label: "Pemberitahuan putusan kepada para pihak" },
  { kunci: "bht", label: "Berkekuatan hukum tetap" },
  { kunci: "cabut", label: "Permohonan dicabut" },
  { kunci: "gugur", label: "Permohonan gugur" },
];

/** Keterangan yang bukan tanggal. */
const KETERANGAN_UPAYA = [
  { kunci: "nomorPerkara", label: "Nomor perkara tingkat atas" },
  { kunci: "pemohon", label: "Diajukan oleh" },
  { kunci: "statusPutusan", label: "Status putusan" },
  { kunci: "keadaan", label: "Keadaan berkas" },
  { kunci: "majelis", label: "Majelis hakim" },
  { kunci: "paniteraPengganti", label: "Panitera pengganti" },
  { kunci: "amar", label: "Amar putusan" },
  { kunci: "catatan", label: "Catatan" },
];

/**
 * Rencana pembacaan tiap tingkat.
 *
 * Tiap medan berisi nama kolom SIPP, atau daftar nama bila versinya berbeda-
 * beda. Medan yang memang TIDAK ADA pada tingkat itu ditulis null - dan itu
 * bukan kegagalan: verzet tidak mengenal memori maupun inzage, dan menyebut
 * ketiadaannya "tidak terbaca" akan menyesatkan.
 */
const RENCANA_UPAYA = [
  {
    jenis: "Verzet (perlawanan)",
    sebutan: "verzet",
    tabel: "perkara_verzet",
    urutan: 1,
    tahap: {
      permohonan: "tanggal_pendaftaran_verzet",
      pemberitahuanPermohonan: null,
      memoriDiterima: null,
      memoriDiserahkan: null,
      kontraDiterima: null,
      kontraDiserahkan: null,
      pemberitahuanInzage: null,
      pelaksanaanInzage: null,
      kirimBerkas: null,
      terimaBerkas: null,
      daftarTingkatAtas: null,
      sidangPertama: "tanggal_sidang_pertama_verzet",
      putusan: "putusan_verzet",
      minutasi: "tanggal_minutasi_verzet",
      kirimSalinan: null,
      pemberitahuanPutusan: "pemberitahuan_putusan_verzet",
      bht: "tanggal_bht",
      cabut: null,
      gugur: null,
    },
    keterangan: {
      nomorPerkara: null,
      pemohon: null,
      statusPutusan: "status_putusan_verzet_text",
      keadaan: null,
      majelis: "majelis_hakim_text",
      paniteraPengganti: "panitera_pengganti_text",
      amar: "amar_putusan_verzet",
      catatan: "catatan_putusan_verzet",
    },
  },
  {
    jenis: "Banding",
    sebutan: "banding",
    tabel: "perkara_banding",
    urutan: 2,
    tahap: {
      permohonan: "permohonan_banding",
      pemberitahuanPermohonan: "pemberitahuan_permohonan_banding",
      memoriDiterima: "penerimaan_memori_banding",
      memoriDiserahkan: "penyerahan_memori_banding",
      kontraDiterima: "penerimaan_kontra_banding",
      kontraDiserahkan: "penyerahan_kontra_banding",
      pemberitahuanInzage: "pemberitahuan_inzage",
      pelaksanaanInzage: "pelaksanaan_inzage",
      kirimBerkas: "pengiriman_berkas_banding",
      terimaBerkas: "penerimaan_kembali_berkas_banding",
      daftarTingkatAtas: "tanggal_pendaftaran_banding",
      sidangPertama: "tanggal_sidang_pertama",
      putusan: "putusan_banding",
      minutasi: ["minutasi_banding", "tgl_minutasi"],
      kirimSalinan: "tgl_kirim_salinan_putusan",
      pemberitahuanPutusan: "pemberitahuan_putusan_banding",
      bht: null,
      cabut: "tanggal_cabut",
      gugur: "tanggal_gugur",
    },
    keterangan: {
      nomorPerkara: "nomor_perkara_banding",
      pemohon: "pemohon_banding",
      statusPutusan: "status_putusan_banding_text",
      keadaan: "status_banding_text",
      majelis: "majelis_hakim_banding",
      paniteraPengganti: "panitera_pengganti_banding",
      amar: "amar_putusan_banding",
      catatan: "catatan_banding",
    },
  },
  {
    jenis: "Kasasi",
    sebutan: "kasasi",
    tabel: "perkara_kasasi",
    urutan: 3,
    tahap: {
      permohonan: "permohonan_kasasi",
      pemberitahuanPermohonan: "pemberitahuan_kasasi",
      memoriDiterima: "penerimaan_memori_kasasi",
      memoriDiserahkan: "penyerahan_memori_kasasi",
      kontraDiterima: "penerimaan_kontra_kasasi",
      kontraDiserahkan: "penyerahan_kontra_kasasi",
      pemberitahuanInzage: "pemberitahuan_inzage_kasasi",
      pelaksanaanInzage: "pelaksanaan_inzage_kasasi",
      kirimBerkas: "pengiriman_berkas_kasasi",
      terimaBerkas: "penerimaan_berkas_kasasi",
      daftarTingkatAtas: "tanggal_pendaftaran_kasasi",
      sidangPertama: null,
      putusan: "putusan_kasasi",
      minutasi: "minutasi_kasasi",
      kirimSalinan: null,
      pemberitahuanPutusan: "pemberitahuan_putusan_kasasi",
      bht: null,
      cabut: "tanggal_cabut",
      gugur: null,
    },
    keterangan: {
      nomorPerkara: ["nomor_putusan_kasasi", "nomor_perkara_kasasi"],
      pemohon: "pemohon_kasasi",
      statusPutusan: "status_putusan_kasasi_text",
      keadaan: "status_kasasi_text",
      majelis: "majelis_hakim_kasasi",
      paniteraPengganti: "panitera_pengganti_kasasi",
      amar: "amar_putusan_kasasi",
      catatan: "catatan_putusan_kasasi",
    },
  },
  {
    jenis: "Peninjauan Kembali",
    sebutan: "pk",
    tabel: "perkara_pk",
    urutan: 4,
    tahap: {
      permohonan: "permohonan_pk",
      pemberitahuanPermohonan: "pemberitahuan_pk",
      memoriDiterima: "penerimaan_memori_pk",
      memoriDiserahkan: "penyerahan_memori_pk",
      kontraDiterima: "penerimaan_kontra_pk",
      kontraDiserahkan: "penyerahan_kontra_pk",
      pemberitahuanInzage: "pemberitahuan_inzage_pk",
      pelaksanaanInzage: "pelaksanaan_inzage_pk",
      kirimBerkas: "pengiriman_berkas_pk",
      terimaBerkas: "penerimaan_berkas_pk",
      daftarTingkatAtas: "tanggal_pendaftaran_pk",
      sidangPertama: null,
      putusan: "putusan_pk",
      minutasi: "minutasi_pk",
      kirimSalinan: null,
      pemberitahuanPutusan: "pemberitahuan_putusan_pk",
      bht: null,
      cabut: "tanggal_cabut",
      gugur: null,
    },
    keterangan: {
      nomorPerkara: ["nomor_putusan_pk", "nomor_perkara_pk"],
      pemohon: "pemohon_pk",
      statusPutusan: "status_putusan_pk_text",
      keadaan: "status_pk_text",
      majelis: "majelis_hakim_pk",
      paniteraPengganti: "panitera_pengganti_pk",
      amar: "amar_putusan_pk",
      catatan: "catatan_putusan_pk",
    },
  },
];

/**
 * Membersihkan teks bertanda HTML yang tersimpan di kolom SIPP.
 *
 * Kolom pemohon menyimpan kalimat berisi <br> - "Kuasa dari Tergugat: <br>SRI
 * ASTUTI NINGSIH<br>". Ditampilkan apa adanya, tanda itu terbaca sebagai teks
 * dan bukan sebagai baris baru, sehingga namanya tampak diapit sampah.
 */
function tanpaTandaHtml(teks) {
  return cleanText(
    String(teks || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
  );
}

/**
 * Upaya hukum: verzet, banding, kasasi, dan peninjauan kembali beserta
 * seluruh tahapannya.
 *
 * Keempatnya tabel terpisah dengan bentuk yang mirip, dibaca dengan satu
 * rencana yang sama - bukan empat potong kode yang lambat laun berbeda
 * perilaku. Yang berbeda hanya nama tabel dan nama kolomnya, dan keduanya
 * ditulis pada RENCANA_UPAYA di atas.
 */
async function upayaHukumPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const hasil = [];
  for (const rencana of RENCANA_UPAYA) {
    if (!(await sippSkemaService.tabelAda(rencana.tabel))) continue;

    // Satu nama, atau beberapa bila versinya berbeda. Yang null berarti
    // tahap itu memang tidak ada pada tingkat ini.
    const pilih = async (nilai) => {
      if (!nilai) return "";
      const calon = Array.isArray(nilai) ? nilai : [nilai];
      return sippSkemaService.pilihKolom(rencana.tabel, calon);
    };

    const tahapKolom = [];
    for (const tahap of TAHAP_UPAYA) {
      const rencanaKolom = rencana.tahap[tahap.kunci];
      tahapKolom.push({
        ...tahap,
        kolom: await pilih(rencanaKolom),
        // Dibedakan dari kolom yang tidak ketemu: tahap yang memang tidak
        // dikenal pada tingkat ini tidak perlu dilaporkan sebagai kekurangan.
        berlaku: Boolean(rencanaKolom),
      });
    }

    const ketKolom = [];
    for (const ket of KETERANGAN_UPAYA) {
      const rencanaKolom = rencana.keterangan[ket.kunci];
      ketKolom.push({ ...ket, kolom: await pilih(rencanaKolom), berlaku: Boolean(rencanaKolom) });
    }

    const terpakai = [...tahapKolom, ...ketKolom].filter((x) => x.kolom);
    if (terpakai.length === 0) continue;

    // Nama kolom - dan HANYA nama kolom - yang masuk ke teks kueri, dan
    // seluruhnya berasal dari RENCANA_UPAYA di atas yang tertutup. Nilainya
    // selalu lewat parameter.
    const pilihan = terpakai.map((x) => `t.${x.kolom} AS ${x.kunci}`);
    const kolomUrut = tahapKolom.find((x) => x.kunci === "permohonan" && x.kolom);

    const rows = await runQuery(
      `SELECT ${pilihan.join(", ")} FROM ${rencana.tabel} t
        WHERE t.perkara_id = ?
        ORDER BY ${kolomUrut ? `t.${kolomUrut.kolom}` : "t.perkara_id"} ASC
        LIMIT 5`,
      [id]
    ).catch(() => []);

    const kolomTersedia = await sippSkemaService.kolomTabel(rencana.tabel);

    for (const row of rows) {
      // Baris tanpa satu pun tanggal bukan upaya hukum - itu baris kosong
      // yang tertinggal. Menampilkannya membuat perkara yang tidak pernah
      // dibanding terbaca seolah pernah.
      const adaIsi = tahapKolom.some((x) => x.kolom && row[x.kunci]);
      if (!adaIsi) continue;

      const tahapan = tahapKolom
        // Tahap yang tidak berlaku pada tingkat ini tidak ditampilkan sama
        // sekali: verzet tidak mengenal memori maupun inzage, dan deretan
        // "tidak tersedia" hanya menutupi tahap yang benar-benar kurang.
        .filter((x) => x.berlaku)
        .map((x) => ({
          kunci: x.kunci,
          label: x.label,
          tanggal: x.kolom ? isoTanggal(row[x.kunci]) : "",
          // Dibedakan dari tanggal kosong: yang satu belum dikerjakan, yang
          // lain tidak dapat dibaca. Menyamakan keduanya membuat orang
          // menagih pekerjaan yang sebenarnya sudah selesai.
          adaKolom: Boolean(x.kolom),
        }));

      const keterangan = {};
      for (const x of ketKolom) {
        if (!x.kolom) continue;
        // Kolom pemohon, majelis, dan panitera menyimpan tanda <br>.
        keterangan[x.kunci] = tanpaTandaHtml(row[x.kunci]);
      }

      const ambil = (kunci) => (tahapan.find((x) => x.kunci === kunci) || {}).tanggal || "";

      hasil.push({
        jenis: rencana.jenis,
        sebutan: rencana.sebutan,
        // Tiga medan lama dipertahankan supaya pembaca yang sudah ada tidak
        // ikut berubah saat bagian ini diperkaya.
        tanggalPermohonan: ambil("permohonan"),
        tanggalPutusan: ambil("putusan"),
        nomorPerkara: keterangan.nomorPerkara || "",
        tahapan,
        keterangan,
        dicabut: Boolean(ambil("cabut")),
        gugur: Boolean(ambil("gugur")),
        // Dilaporkan supaya nama kolom yang belum dikenali dapat dilengkapi
        // tanpa harus membuka basis datanya.
        kolomTersedia,
        tahapTakDikenali: tahapKolom.filter((x) => x.berlaku && !x.kolom).map((x) => x.label),
      });
    }
  }

  // Diurut menurut TINGKATNYA, bukan menurut tanggal: verzet mendahului
  // banding, banding mendahului kasasi, kasasi mendahului peninjauan kembali.
  // Tanggal permohonan yang kosong akan mengacak urutan itu tanpa sebab.
  const urutanJenis = Object.fromEntries(RENCANA_UPAYA.map((x) => [x.sebutan, x.urutan]));
  return hasil.sort(
    (a, b) =>
      (urutanJenis[a.sebutan] || 9) - (urutanJenis[b.sebutan] || 9) ||
      String(a.tanggalPermohonan).localeCompare(String(b.tanggalPermohonan))
  );
}
/**
 * Membaca satu tabel pendukung yang bentuknya sederhana: ada barisnya atau
 * tidak, dan kapan tanggalnya.
 *
 * Dipakai untuk pemberitahuan putusan, mediasi, arsip, dan delegasi - empat
 * hal yang dinilai SK tetapi tidak selalu ada tabelnya di tiap versi SIPP.
 */
async function bacaPendukung(perkaraId, { tabel, kolomTanggal, kolomInput, kolomIsi, batas = 10 }) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda(tabel))) {
    return { terbaca: false, alasan: `Tabel ${tabel} tidak ada pada SIPP versi ini.`, baris: [] };
  }

  const pilihan = [];
  if (kolomTanggal) pilihan.push(`t.${kolomTanggal} AS tanggal`);
  if (kolomInput) pilihan.push(`t.${kolomInput} AS diinput`);
  if (kolomIsi) pilihan.push(`t.${kolomIsi} AS isi`);

  if (pilihan.length === 0) {
    return { terbaca: false, alasan: `Kolom yang diperlukan tidak ada pada ${tabel}.`, baris: [] };
  }

  const urutan = kolomTanggal ? `ORDER BY t.${kolomTanggal} DESC` : "";
  const maks = Math.min(Math.max(Math.floor(Number(batas) || 10), 1), 100);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM ${tabel} t WHERE t.perkara_id = ? ${urutan} LIMIT ${maks}`,
    [id]
  );

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => ({
      tanggal: isoTanggal(row.tanggal),
      diinput: isoTanggal(row.diinput),
      isi: cleanText(row.isi),
      hariSampaiInput: selisihHari(isoTanggal(row.tanggal), isoTanggal(row.diinput)),
    })),
  };
}

/** Pemberitahuan putusan atau penetapan - SK Tabel 2 I.13. */
async function pemberitahuanPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  return bacaPendukung(perkaraId, {
    tabel: "perkara_pemberitahuan",
    kolomTanggal: kolom.tanggalPbt,
    kolomInput: kolom.inputPbt,
    kolomIsi: "",
  });
}

/**
 * Arti kode kehadiran pada perkara_jadwal_sidang.dihadiri_oleh.
 *
 * Dibaca dari SIPP yang berjalan. Yang menentukan wajib tidaknya
 * pemberitahuan putusan hanya SIAPA YANG TIDAK HADIR - pihak yang hadir
 * sudah mendengar putusannya dibacakan.
 */
const ARTI_KEHADIRAN = {
  "1": { sebutan: "kedua pihak hadir", tidakHadir: [] },
  "2": { sebutan: "tergugat/termohon tidak hadir", tidakHadir: [2] },
  "3": { sebutan: "penggugat/pemohon tidak hadir", tidakHadir: [1] },
  "4": { sebutan: "kedua pihak tidak hadir", tidakHadir: [1, 2] },
  "10": { sebutan: "sebagian penggugat/pemohon tidak hadir", tidakHadir: [1] },
};

/**
 * Pemberitahuan putusan bagi pihak yang tidak hadir - SK Tabel 2 I.13.
 *
 * Dua hal dijawab sekaligus: APAKAH pemberitahuan wajib (ada pihak yang
 * tidak hadir saat putusan dibacakan), dan bila wajib, BERAPA HARI setelah
 * putusan tiap pihak itu diberitahu.
 */
async function pemberitahuanPutusanPerkara(perkaraId, tanggalPutusan) {
  const id = Number(perkaraId);
  const putus = isoTanggal(tanggalPutusan);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah" };
  if (!putus) return { terbaca: false, alasan: "Perkara belum diputus." };

  if (!(await sippSkemaService.tabelAda("perkara_putusan_pemberitahuan_putusan"))) {
    return {
      terbaca: false,
      alasan: "Tabel perkara_putusan_pemberitahuan_putusan tidak ada pada SIPP versi ini.",
    };
  }

  // --- sidang saat putusan dibacakan ---
  //
  // Sidang TERAKHIR sampai dengan tanggal putus. Kerap tanggalnya persis
  // sama; kadang berselisih sehari karena putusan diinput keesokan harinya.
  const sidang = await runQuery(
    `SELECT j.tanggal_sidang AS tanggalSidang,
            j.dihadiri_oleh AS dihadiri,
            j.agenda AS agenda
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ? AND j.tanggal_sidang <= ?
      ORDER BY j.tanggal_sidang DESC
      LIMIT 1`,
    [id, putus]
  ).catch(() => []);

  const barisSidang = sidang[0] || null;
  const kode = barisSidang ? String(barisSidang.dihadiri || "").trim() : "";
  const arti = ARTI_KEHADIRAN[kode] || null;

  if (!barisSidang) {
    return {
      terbaca: true,
      wajib: false,
      alasan: "Sidang pembacaan putusannya tidak tercatat, sehingga kehadirannya tidak dapat dibaca.",
      baris: [],
    };
  }

  if (!arti) {
    return {
      terbaca: true,
      wajib: false,
      alasan: `Kehadiran pada sidang putusan tidak terbaca (kode ${kode || "kosong"}).`,
      baris: [],
    };
  }

  if (arti.tidakHadir.length === 0) {
    return {
      terbaca: true,
      wajib: false,
      alasan: "Kedua pihak hadir saat putusan dibacakan - tidak ada yang perlu diberitahu.",
      kehadiran: arti.sebutan,
      baris: [],
    };
  }

  // --- pemberitahuan yang tercatat ---
  const rows = await runQuery(
    `SELECT p.pihak AS pihak,
            p.tanggal_pemberitahuan_putusan AS tanggalPbt
       FROM perkara_putusan_pemberitahuan_putusan p
      WHERE p.perkara_id = ?
      LIMIT 50`,
    [id]
  ).catch(() => []);

  const SEBUTAN_PIHAK = {
    1: "Penggugat/Pemohon",
    2: "Tergugat/Termohon",
  };

  const baris = arti.tidakHadir.map((sisi) => {
    // Pemberitahuan untuk sisi ini - yang PALING AWAL bertanggal, sebab
    // satu sisi dapat punya beberapa baris bila pihaknya lebih dari satu.
    const untukSisi = rows
      .filter((x) => Number(x.pihak) === sisi && isoTanggal(x.tanggalPbt))
      .map((x) => isoTanggal(x.tanggalPbt))
      .sort();

    const tanggal = untukSisi[0] || "";
    return {
      sisi,
      sebutan: SEBUTAN_PIHAK[sisi] || `Pihak ${sisi}`,
      tanggal,
      hari: tanggal ? selisihHari(putus, tanggal) : null,
    };
  });

  return {
    terbaca: true,
    wajib: true,
    alasan: "",
    kehadiran: arti.sebutan,
    tanggalSidangPutusan: isoTanggal(barisSidang.tanggalSidang),
    baris,
  };
}

/** Rapor hasil mediasi - SK Tabel 2 I.11. */
async function mediasiPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  return bacaPendukung(perkaraId, {
    tabel: "perkara_mediasi",
    kolomTanggal: await sippSkemaService.pilihKolom("perkara_mediasi", [
      "tanggal_mediasi",
      "tanggal",
      "tgl_mediasi",
    ]),
    kolomInput: "",
    kolomIsi: kolom.rapotMediasi,
    batas: 5,
  });
}

/** Penginputan data arsip - SK Tabel 2 I.16. */
async function arsipPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  return bacaPendukung(perkaraId, {
    tabel: "arsip",
    kolomTanggal: kolom.inputArsip,
    kolomInput: "",
    kolomIsi: "",
    batas: 5,
  });
}

/** Delegasi masuk dan keluar - SK Tabel 2 I.17 dan III.3. */
async function delegasiPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  return bacaPendukung(perkaraId, {
    tabel: "perkara_delegasi",
    kolomTanggal: kolom.delegasiDiunggah,
    kolomInput: kolom.delegasiDiterima,
    kolomIsi: "",
  });
}

/**
 * Pengembalian sisa panjar - SK Tabel 2 I.15.
 *
 * Yang dicari transaksi pengembaliannya, bukan seluruh transaksi biaya.
 */
async function sisaPanjarPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.tanggalSisaPanjar || !kolom.inputSisaPanjar) {
    return {
      terbaca: false,
      alasan: "Kolom tanggal pengembalian atau tanggal input sisa panjar tidak ada pada SIPP versi ini.",
      baris: [],
    };
  }
  return bacaPendukung(perkaraId, {
    tabel: "perkara_biaya",
    kolomTanggal: kolom.tanggalSisaPanjar,
    kolomInput: kolom.inputSisaPanjar,
    kolomIsi: "jenis_transaksi",
    batas: 50,
  });
}

/**
 * Tanggal putusan tayang di Direktori Putusan - SK Tabel 2 huruf c.
 *
 * Sumbernya dirput_dokumen, bukan perkara_putusan: link_dirput menandai bahwa
 * putusannya sudah tayang, updated_date menandai kapan. Itulah yang dipakai
 * notifikasi SIPP pengadilan ini.
 */
async function unggahPutusanPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", tanggal: "" };

  if (!(await sippSkemaService.tabelAda("dirput_dokumen")) || !kolom.unggahPutusan) {
    return {
      terbaca: false,
      alasan: "Tabel dirput_dokumen tidak ada pada SIPP versi ini.",
      tanggal: "",
    };
  }

  const pilihan = [`r.${kolom.unggahPutusan} AS tanggal`];
  if (kolom.linkDirput) pilihan.push(`r.${kolom.linkDirput} AS tautan`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM dirput_dokumen r
      WHERE r.perkara_id = ?
      ORDER BY r.${kolom.unggahPutusan} ASC
      LIMIT 1`,
    [id]
  ).catch(() => []);

  const baris = rows[0] || {};
  const tautan = cleanText(baris.tautan);

  return {
    terbaca: true,
    alasan: "",
    // Tanpa link_dirput, putusannya belum tayang - tanggal apa pun pada baris
    // itu belum berarti terpublikasi.
    tanggal: kolom.linkDirput && !tautan ? "" : isoTanggal(baris.tanggal),
    tautan,
    sudahTayang: kolom.linkDirput ? Boolean(tautan) : Boolean(baris.tanggal),
  };
}

/**
 * BAS tiap sidang: ada berkasnya atau tidak, dan kapan diunggah.
 *
 * ============================================================================
 * ADA TIDAKNYA SELALU TERBACA. KAPANNYA BELUM TENTU.
 * ============================================================================
 *
 * edoc_bas pada perkara_jadwal_sidang menyimpan berkasnya. Ada tidaknya
 * karena itu SELALU dapat dinilai - dan itu sudah menjawab pertanyaan yang
 * paling sering: sidang mana yang BAS-nya belum diunggah.
 *
 * Kapan diunggahnya lain soal. Bila SIPP versi ini punya kolom waktunya,
 * itulah yang dipakai. Bila tidak, jejak audit ditelusuri. Bila keduanya
 * gagal, yang dilaporkan tetap ada tidaknya - dengan tanggal unggah kosong,
 * dan SK menilai yang tanpa berkas sebagai nol.
 */
async function unggahBasPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const pilihan = [
    "j.id AS sidangId",
    "j.tanggal_sidang AS tanggalSidang",
    "j.edoc_bas AS berkas",
    "j.agenda AS agenda",
  ];
  if (kolom.unggahBas) pilihan.push(`j.${kolom.unggahBas} AS diunggah`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ?
      ORDER BY j.tanggal_sidang ASC, j.id ASC
      LIMIT 100`,
    [id]
  ).catch(() => []);

  const baris = rows.map((row) => ({
    sidangId: String(row.sidangId || ""),
    tanggalSidang: isoTanggal(row.tanggalSidang),
    agenda: cleanText(row.agenda),
    adaBerkas: Boolean(cleanText(row.berkas)),
    diunggah: kolom.unggahBas ? isoTanggal(row.diunggah) : "",
  }));

  // Kolom waktunya tidak ada - jejak audit ditelusuri untuk sidang yang
  // BAS-nya memang sudah ada. Sidang tanpa berkas tidak perlu ditelusuri:
  // jawabannya sudah pasti belum diunggah.
  let sumberWaktu = kolom.unggahBas ? `kolom ${kolom.unggahBas}` : "";
  if (!kolom.unggahBas) {
    const bentuk = await sippAuditService.bentukAudit();
    if (bentuk.terbaca && bentuk.baris && bentuk.tabel) {
      let ketemu = 0;
      for (const satu of baris) {
        if (!satu.adaBerkas || !satu.sidangId) continue;
        const jejak = await sippAuditService.pertamaDicatat({
          tabel: "perkara_jadwal_sidang",
          recordId: satu.sidangId,
        });
        if (jejak.tanggal) {
          satu.diunggah = jejak.tanggal;
          satu.dariAudit = true;
          ketemu += 1;
        }
      }
      if (ketemu > 0) sumberWaktu = "jejak audit sys_audittrail";
    }
  }

  const adaBerkas = baris.filter((x) => x.adaBerkas).length;

  return {
    terbaca: true,
    alasan: "",
    baris,
    jumlahSidang: baris.length,
    jumlahBerBerkas: adaBerkas,
    // Lengkap berarti tiap sidang yang sudah berlalu punya BAS.
    lengkap: baris.length > 0 && adaBerkas === baris.length,
    sumberWaktu,
    waktuTerbaca: Boolean(sumberWaktu),
  };
}

/**
 * E-Dokumen petitum - SK Tabel 2 II.1.
 *
 * Tersimpan pada tabel perkara itu sendiri, kolom petitum_dok. Isi berupa
 * spasi tunggal diperlakukan KOSONG: notifikasi SIPP pengadilan ini mencari
 * petitum yang belum diunggah dengan petitum_dok = " ", jadi begitulah SIPP
 * setempat menandai yang belum ada.
 */
async function petitumPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", ada: false };

  if (!kolom.petitumDok) {
    return { terbaca: false, alasan: "Kolom petitum_dok tidak ada pada SIPP versi ini.", ada: false };
  }

  const rows = await runQuery(
    `SELECT p.${kolom.petitumDok} AS berkas FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);

  const berkas = cleanText(rows[0] && rows[0].berkas);
  return { terbaca: true, alasan: "", ada: Boolean(berkas), berkas };
}

/**
 * Kelengkapan dokumen relaas - SK Tabel 2 II.2.
 *
 * Yang dihitung berapa relaas yang sudah punya doc_relaas. Resi pos dihitung
 * tersendiri: surat tercatat memerlukan keduanya - relaasnya dan bukti
 * kirimnya - dan menggabungkan keduanya menyembunyikan yang mana yang kurang.
 */
async function dokumenRelaasPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah" };

  const rows = await runQuery(
    `SELECT COUNT(*) AS jumlah,
            SUM(CASE WHEN r.doc_relaas IS NOT NULL AND r.doc_relaas <> '' THEN 1 ELSE 0 END) AS adaRelaas,
            SUM(CASE WHEN r.doc_resi IS NOT NULL AND r.doc_resi <> '' THEN 1 ELSE 0 END) AS adaResi
       FROM perkara_pelaksanaan_relaas r
      WHERE r.perkara_id = ?`,
    [id]
  ).catch(() => []);

  const baris = rows[0] || {};
  return {
    terbaca: true,
    alasan: "",
    jumlah: Number(baris.jumlah) || 0,
    berdokumen: Number(baris.adaRelaas) || 0,
    berresi: Number(baris.adaResi) || 0,
  };
}
/** Kelengkapan identitas tiap saksi - SK Tabel 2 I.12 menghitung isian terisi. */
async function saksiLengkapPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  const isian = [kolom.saksiJenisIdentitas, kolom.saksiNomorIdentitas, kolom.saksiAlamat].filter(Boolean);

  if (isian.length === 0) {
    return {
      terbaca: false,
      alasan: "Kolom identitas saksi tidak ada pada SIPP versi ini.",
      baris: [],
    };
  }

  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const namaKolom = await sippSkemaService.pilihKolom("perkara_keterangan_saksi", [
    "nama",
    "nama_saksi",
    "nama_lengkap",
  ]);
  const pilihan = isian.map((k, i) => `s.${k} AS isian${i}`);
  if (namaKolom) pilihan.push(`s.${namaKolom} AS nama`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_keterangan_saksi s
      WHERE s.perkara_id = ? LIMIT 50`,
    [id]
  );

  return {
    terbaca: true,
    alasan: "",
    // SK menghitung berapa dari tiga isian identitas yang terisi.
    jumlahIsianDiperiksa: isian.length,
    baris: rows.map((row) => {
      let terisi = 0;
      for (let i = 0; i < isian.length; i += 1) {
        if (cleanText(row[`isian${i}`])) terisi += 1;
      }
      return { nama: cleanText(row.nama), isianTerisi: terisi };
    }),
  };
}

/**
 * Relaas beserta TANGGAL INPUTNYA dan tanggal sidang yang dipanggilkan.
 *
 * Dibaca tersendiri, tidak menumpang pada relaasSidang: yang itu melayani
 * layar panggilan dan bentuknya sudah mapan. Menambahkan kolom yang hanya
 * ada di sebagian versi SIPP ke sana berarti membuat seluruh layar panggilan
 * ikut gagal di pengadilan yang kolomnya tidak ada.
 */
async function relaasBerinputPerkara(perkaraId) {
  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.inputRelaas) {
    return {
      terbaca: false,
      alasan: "Kolom tanggal input relaas tidak ada pada SIPP versi ini.",
      baris: [],
    };
  }

  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const rows = await runQuery(
    `SELECT r.id AS id,
            r.tanggal_relaas AS tanggalRelaas,
            r.${kolom.inputRelaas} AS diinput,
            j.tanggal_sidang AS tanggalSidang
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
      WHERE r.perkara_id = ?
      ORDER BY j.tanggal_sidang ASC, r.id ASC
      LIMIT 200`,
    [id]
  );

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => ({
      id: String(row.id || ""),
      tanggalRelaas: isoTanggal(row.tanggalRelaas),
      tanggalInput: isoTanggal(row.diinput),
      tanggalSidang: isoTanggal(row.tanggalSidang),
      // Berapa hari SEBELUM sidang relaas itu diinput - itulah yang dinilai
      // SK Tabel 2 I.10.
      hariSebelumSidang: selisihHari(isoTanggal(row.diinput), isoTanggal(row.tanggalSidang)),
    })),
  };
}
/**
 * Apakah perkara ini mafqud, dinilai dari tundaan sidangnya.
 *
 * ============================================================================
 * TIDAK ADA KOLOM MAFQUD DI SIPP
 * ============================================================================
 *
 * SIPP tidak menandai mafqud. SK 048/2024 Tabel 2 nomor 1 angka 3 pun tidak
 * menyebut kolom - ia menyebut PENCIRINYA: "terindikasi dengan tundaan sidang
 * 3 x 90 hari".
 *
 * Jadi yang dihitung di sini persis itu: berapa kali sidang perkara ini
 * ditunda dengan jarak 90 hari atau lebih. Tiga kali atau lebih berarti
 * terindikasi mafqud, dan SK memotong 270 hari dari waktu putusnya.
 *
 * ============================================================================
 * TERINDIKASI, BUKAN DIPASTIKAN
 * ============================================================================
 *
 * Kata "terindikasi" pada SK dipakai apa adanya di sini. Tundaan panjang
 * berulang memang ciri mafqud - pengumuman lewat media massa menuntut tenggang
 * yang panjang - tetapi bisa juga sebab lain: menunggu putusan perkara lain,
 * pihak sakit berkepanjangan, berkas dari luar negeri.
 *
 * Karena itu hasilnya membawa jarak tiap tundaannya, dan layar menampilkannya.
 * Yang memutuskan tetap panitera yang membaca berkasnya - bukan program yang
 * menghitung jarak tanggal.
 */
async function mafqudPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) {
    return { terindikasi: null, alasan: "perkara_id_tidak_sah", tundaanPanjang: [] };
  }

  const rows = await runQuery(
    `SELECT j.tanggal_sidang AS tanggalSidang, j.agenda AS agenda
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ?
      ORDER BY j.tanggal_sidang ASC, j.id ASC
      LIMIT 200`,
    [id]
  ).catch(() => null);

  if (!Array.isArray(rows)) {
    return { terindikasi: null, alasan: "Jadwal sidang tidak terbaca.", tundaanPanjang: [] };
  }
  if (rows.length < 2) {
    return { terindikasi: false, alasan: "", tundaanPanjang: [], jumlahSidang: rows.length };
  }

  const tundaanPanjang = [];
  for (let i = 1; i < rows.length; i += 1) {
    const dari = isoTanggal(rows[i - 1].tanggalSidang);
    const ke = isoTanggal(rows[i].tanggalSidang);
    const jarak = selisihHari(dari, ke);
    if (jarak === null || jarak < AMBANG_TUNDAAN_MAFQUD) continue;
    tundaanPanjang.push({
      dari,
      ke,
      hari: jarak,
      agenda: cleanText(rows[i].agenda),
    });
  }

  return {
    terindikasi: tundaanPanjang.length >= JUMLAH_TUNDAAN_MAFQUD,
    alasan: "",
    tundaanPanjang,
    jumlahSidang: rows.length,
  };
}
/**
 * Penanda perkara: ghaib, dan pihak berstatus PNS/TNI/POLRI/BUMN.
 *
 * ============================================================================
 * KENAPA DUA PENANDA INI YANG DICARI
 * ============================================================================
 *
 * Keduanya MENGUBAH cara perkara dinilai dan cara ia harus ditangani:
 *
 *   ghaib               - SK memotong 120 hari dari waktu putusnya, dan
 *                         panggilannya lewat pengumuman, bukan relaas biasa
 *   PNS/TNI/POLRI/BUMN  - menuntut izin atasan, dan SK memotong waktu
 *                         menunggu izin itu paling banyak enam bulan
 *
 * Tanpa penanda ini, perkara yang memang berhak atas kelonggaran dinilai
 * seolah lambat - dan majelis yang sudah bekerja benar tampak buruk pada
 * laporan.
 *
 * ============================================================================
 * GHAIB DIKENALI DARI TIGA ARAH
 * ============================================================================
 *
 *   1. kolom penanda pada v_perkara, bila ada
 *   2. jarak PHS ke sidang pertama >= 120 hari - inilah yang dipakai SK
 *      sendiri sebagai penciri ("terindikasi dengan jarak waktu penetapan hari
 *      sidang ke sidang pertama >=120 hari")
 *   3. kata ghaib pada alamat atau keterangan pihak
 *
 * Yang ditemukan disebutkan sumbernya, supaya panitera dapat menilai sendiri
 * apakah penandanya masuk akal - bukan menerimanya begitu saja.
 */
async function penandaPerkara(perkaraId, { tanggalPhs = "", sidangPertama = "" } = {}) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { ghaib: null, instansi: [], sumber: [] };

  const kolom = await sippSkemaService.kolomTerpilih();
  const sumber = [];
  let ghaib = false;

  // 1. Penanda pada pihaknya - inilah sumber yang paling tegas. Yang ghaib
  //    adalah PIHAKNYA, dan SIPP menandainya di perkara_pihak2.ghaib.
  if (kolom.pihakGhaib && (await sippSkemaService.tabelAda("perkara_pihak2"))) {
    const rows = await runQuery(
      `SELECT COUNT(*) AS jumlah FROM perkara_pihak2 p
        WHERE p.perkara_id = ? AND p.${kolom.pihakGhaib} = 1`,
      [id]
    ).catch(() => []);
    if (Number(rows[0] && rows[0].jumlah) > 0) {
      ghaib = true;
      sumber.push("penanda ghaib pada pihak tergugat/termohon");
    }
  }

  // 2. Penanda pada v_perkara, bila SIPP versi ini menyediakannya.
  if (!ghaib && kolom.vGhaib && (await sippSkemaService.tabelAda("v_perkara"))) {
    const rows = await runQuery(
      `SELECT v.${kolom.vGhaib} AS ghaib FROM v_perkara v WHERE v.perkara_id = ? LIMIT 1`,
      [id]
    ).catch(() => []);
    const nilai = rows[0] ? cleanText(rows[0].ghaib).toLowerCase() : "";
    if (nilai && nilai !== "0" && nilai !== "n" && nilai !== "tidak") {
      ghaib = true;
      sumber.push(`penanda ${kolom.vGhaib} pada v_perkara`);
    }
  }

  // 3. Jarak PHS ke sidang pertama - penciri yang dipakai SK sendiri.
  const jarak = selisihHari(tanggalPhs, sidangPertama);
  if (jarak !== null && jarak >= 120) {
    ghaib = true;
    sumber.push(`jarak PHS ke sidang pertama ${jarak} hari`);
  }

  // 4. Kata ghaib pada keterangan pihak.
  const pihak = await pihakPerkara(id);
  const adaKataGhaib = pihak.baris.some((x) => /ghaib|gaib/i.test(`${x.alamat} ${x.keterangan}`));
  if (adaKataGhaib) {
    ghaib = true;
    sumber.push("kata ghaib pada keterangan pihak");
  }

  // --- pihak berstatus instansi -------------------------------------------
  //
  // Yang dicari kata pada pekerjaan pihak. Sengaja TIDAK memakai daftar
  // pekerjaan berkode: kodenya berbeda antar satker, sedangkan tulisannya
  // seragam karena diketik dari berkas yang sama.
  const POLA = [
    { kunci: "pns", label: "PNS/ASN", pola: /\b(pns|asn|pegawai negeri|aparatur sipil)\b/i },
    { kunci: "tni", label: "TNI", pola: /\b(tni|prajurit|angkatan (darat|laut|udara))\b/i },
    { kunci: "polri", label: "POLRI", pola: /\b(polri|polisi|kepolisian|bhayangkara)\b/i },
    { kunci: "bumn", label: "BUMN/BUMD", pola: /\b(bumn|bumd|persero|perum)\b/i },
    { kunci: "hakim", label: "Hakim/Aparat peradilan", pola: /\b(hakim|panitera|juru ?sita)\b/i },
  ];

  const instansi = [];
  for (const acuan of POLA) {
    const cocok = pihak.baris.filter((x) => acuan.pola.test(x.pekerjaan));
    if (cocok.length === 0) continue;
    instansi.push({
      kunci: acuan.kunci,
      label: acuan.label,
      pihak: cocok.map((x) => ({ nama: x.nama, peran: x.peran, pekerjaan: x.pekerjaan })),
    });
  }

  const mafqud = await mafqudPerkara(id);

  return {
    // null berarti belum dapat dinilai - tidak satu pun sumber terbaca.
    ghaib: pihak.terbaca || kolom.pihakGhaib || kolom.vGhaib || jarak !== null ? ghaib : null,
    sumberGhaib: sumber,
    instansi,
    perluIzinAtasan: instansi.some((x) => ["pns", "tni", "polri"].includes(x.kunci)),
    pihakTerbaca: pihak.terbaca,
    alasanPihak: pihak.alasan,
    // Mafqud tidak punya kolomnya sendiri di SIPP - yang ada pencirinya.
    mafqud: mafqud.terindikasi,
    tundaanPanjang: mafqud.tundaanPanjang,
    ambangMafqud: { hari: AMBANG_TUNDAAN_MAFQUD, kali: JUMLAH_TUNDAAN_MAFQUD },
  };
}

/**
 * Para pihak beserta pekerjaan, alamat, dan keterangannya.
 *
 * SIPP menyimpan pihak pada lima tabel bernomor - perkara_pihak1 sampai
 * perkara_pihak5 - masing-masing untuk kedudukan yang berbeda. Kelimanya
 * dibaca dengan satu rencana yang sama; yang tabelnya tidak ada dilewati.
 */
async function pihakPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const kolom = await sippSkemaService.kolomTerpilih();
  const adaPihak = await sippSkemaService.tabelAda("pihak");
  if (!adaPihak) return { terbaca: false, alasan: "Tabel pihak tidak ada pada SIPP versi ini.", baris: [] };

  const kolomAlamat = await sippSkemaService.pilihKolom("pihak", ["alamat", "alamat_lengkap", "tempat_tinggal"]);
  const kolomKeterangan = await sippSkemaService.pilihKolom("pihak", ["keterangan", "catatan"]);

  const baris = [];
  let adaTabel = false;

  for (let nomor = 1; nomor <= 5; nomor += 1) {
    const tabel = `perkara_pihak${nomor}`;
    if (!(await sippSkemaService.tabelAda(tabel))) continue;
    adaTabel = true;

    const kolomPeran = await sippSkemaService.pilihKolom(tabel, [
      "jenis_pihak_nama",
      "jenis_pihak",
      "kedudukan",
      "peran",
    ]);

    const pilihan = [`k.pihak_id AS pihakId`];
    if (kolom.pihakNama) pilihan.push(`p.${kolom.pihakNama} AS nama`);
    if (kolom.pihakPekerjaan) pilihan.push(`p.${kolom.pihakPekerjaan} AS pekerjaan`);
    if (kolomAlamat) pilihan.push(`p.${kolomAlamat} AS alamat`);
    if (kolomKeterangan) pilihan.push(`p.${kolomKeterangan} AS keterangan`);
    if (kolomPeran) pilihan.push(`k.${kolomPeran} AS peran`);

    const rows = await runQuery(
      `SELECT ${pilihan.join(", ")}
         FROM ${tabel} k
         LEFT JOIN pihak p ON p.id = k.pihak_id
        WHERE k.perkara_id = ?
        LIMIT 50`,
      [id]
    ).catch(() => []);

    for (const row of rows) {
      baris.push({
        pihakId: String(row.pihakId || ""),
        nama: cleanText(row.nama),
        pekerjaan: cleanText(row.pekerjaan),
        alamat: cleanText(row.alamat),
        keterangan: cleanText(row.keterangan),
        peran: cleanText(row.peran) || `Pihak ${nomor}`,
        kelompok: nomor,
      });
    }
  }

  return {
    terbaca: adaTabel,
    alasan: adaTabel ? "" : "Tabel perkara_pihak1..5 tidak ada pada SIPP versi ini.",
    baris,
  };
}

/**
 * Saksi beserta kelengkapan identitasnya - SK Tabel 2 I.12.
 *
 * ============================================================================
 * SAKSI ADALAH PIHAK KELIMA
 * ============================================================================
 *
 * SIPP menyimpannya di perkara_pihak5, bukan perkara_keterangan_saksi. Yang
 * kedua memuat keterangan yang DIBERIKAN saksi di persidangan; yang dinilai
 * SK adalah kelengkapan IDENTITASNYA, dan itu ada di tabel pihak.
 *
 * Tiga isian yang dihitung - mengikuti cara pengadilan ini menilainya sendiri:
 * jenis identitas, nomor identitas, dan nomor telepon.
 *
 *   3 dari 3 terisi -> 5      1 dari 3 -> 2
 *   2 dari 3        -> 3      0 dari 3 -> 1
 *   tidak ada saksi -> 0
 *
 * ============================================================================
 * PERKARA CABUT DAN GUGUR DIKECUALIKAN
 * ============================================================================
 *
 * Perkara yang berakhir tanpa pembuktian memang tidak punya saksi.
 * Menghitungnya nol berarti menghukum pengadilan atas perkara yang dicabut
 * pihaknya sendiri.
 */
const STATUS_PUTUSAN_DIKECUALIKAN = [65, 67, 93];

async function saksiLengkapPerkaraBaru(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("perkara_pihak5")) || !(await sippSkemaService.tabelAda("pihak"))) {
    return {
      terbaca: false,
      alasan: "Tabel perkara_pihak5 atau pihak tidak ada pada SIPP versi ini.",
      baris: [],
    };
  }

  const kolom = await sippSkemaService.kolomTerpilih();

  // --- perkara cabut, gugur, atau digugurkan dikecualikan -------------------
  let dikecualikan = false;
  if (kolom.statusPutusanId) {
    const status = await runQuery(
      `SELECT pu.${kolom.statusPutusanId} AS status FROM perkara_putusan pu
        WHERE pu.perkara_id = ? LIMIT 5`,
      [id]
    ).catch(() => []);
    dikecualikan = status.some((row) =>
      STATUS_PUTUSAN_DIKECUALIKAN.includes(Number(row.status))
    );
  }
  if (dikecualikan) {
    return {
      terbaca: false,
      alasan: "Perkara cabut, gugur, atau digugurkan - dikecualikan dari penilaian saksi.",
      dikecualikan: true,
      baris: [],
    };
  }

  // Tiga isian yang dihitung SK. Yang tidak ada kolomnya tidak ikut, dan
  // jumlah yang diperiksa dilaporkan supaya nilainya dapat ditelusuri.
  const ISIAN = [
    { kunci: kolom.saksiJenisIdentitas, label: "Jenis identitas" },
    { kunci: kolom.saksiNomorIdentitas, label: "Nomor identitas" },
    { kunci: kolom.saksiTelepon, label: "Nomor telepon" },
  ].filter((x) => x.kunci);

  if (ISIAN.length === 0) {
    const adaKolom = await sippSkemaService.kolomTabel("pihak");
    return {
      terbaca: false,
      alasan: `Kolom identitas belum dikenali. Kolom pada tabel pihak: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const pilihan = ISIAN.map((x, i) => `p.${x.kunci} AS isian${i}`);
  if (kolom.pihakNama) pilihan.push(`p.${kolom.pihakNama} AS nama`);
  if (kolom.saksiKeterangan) pilihan.push(`p.${kolom.saksiKeterangan} AS keterangan`);
  if (kolom.saksiAlamat) pilihan.push(`p.${kolom.saksiAlamat} AS alamat`);
  // Pihak yang menghadirkan saksi - penggugat/pemohon atau tergugat/termohon.
  // SIPP menampilkannya pada kolom "Pihak Yang Menghadirkan", dan tanpa itu
  // daftar saksi tidak memberi tahu siapa yang mengajukan siapa.
  if (kolom.saksiDiajukan) pilihan.push(`k.${kolom.saksiDiajukan} AS diajukan`);
  if (kolom.saksiJenisPihakId) pilihan.push(`k.${kolom.saksiJenisPihakId} AS jenisPihakId`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")}
       FROM perkara_pihak5 k
       LEFT JOIN pihak p ON p.id = k.pihak_id
      WHERE k.perkara_id = ?
      LIMIT 50`,
    [id]
  ).catch(() => []);

  return {
    terbaca: true,
    alasan: "",
    jumlahIsianDiperiksa: ISIAN.length,
    baris: rows.map((row) => {
      const kurang = [];
      let terisi = 0;
      ISIAN.forEach((acuan, i) => {
        if (cleanText(row[`isian${i}`])) terisi += 1;
        else kurang.push(acuan.label);
      });
      // jenis_pihak_id SIPP: 1 penggugat/pemohon, 2 tergugat/termohon.
      // Dipakai hanya bila tulisannya tidak ada - tulisan lebih jelas
      // daripada angka yang harus ditafsirkan.
      const dariAngka =
        Number(row.jenisPihakId) === 1
          ? "Penggugat/Pemohon"
          : Number(row.jenisPihakId) === 2
            ? "Tergugat/Termohon"
            : "";

      return {
        nama: cleanText(row.nama),
        keterangan: cleanText(row.keterangan),
        alamat: cleanText(row.alamat),
        diajukanOleh: cleanText(row.diajukan) || dariAngka,
        isianTerisi: terisi,
        // Apa saja yang belum diisi - supaya panitera tahu apa yang harus
        // dilengkapi, bukan sekadar tahu nilainya kurang.
        isianKurang: kurang,
      };
    }),
  };
}

/**
 * Nilai relaas - SK Tabel 2 I.10.
 *
 * ============================================================================
 * EMPAT JALAN, DICOBA BERURUTAN
 * ============================================================================
 *
 * SIPP setempat punya tabel perkara_penilaian_relaas. Bentuknya tidak sama di
 * tiap versi, dan tidak dapat dipastikan dari sini. Karena itu pembaca ini
 * MENGENALI sendiri apa yang tersedia, lalu memakai jalan terbaik yang ada:
 *
 *   1. tabel penilaian memuat kolom nilai      -> dipakai apa adanya
 *   2. tabel penilaian memuat tanggal input    -> dihitung menurut SK
 *   3. relaas punya tanggal input sendiri      -> dihitung menurut SK
 *   4. jejak audit mencatat kapan diinput      -> dihitung menurut SK
 *
 * Bila keempatnya gagal, yang dikembalikan bukan nol melainkan keterangan
 * bahwa ketepatan waktunya belum terbaca - kecuali memang TIDAK ADA relaas
 * sama sekali, dan itu SK menilainya -5.
 *
 * ============================================================================
 * SUMBERNYA SELALU DISEBUTKAN
 * ============================================================================
 *
 * Tiap hasil membawa `sumber`. Nilai yang datang dari kolom resmi dan nilai
 * yang dihitung dari jejak audit tidak boleh tampak sama di layar - yang satu
 * catatan pengadilan, yang satu hasil penelusuran.
 */
async function penilaianRelaasPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) {
    return { terbaca: false, alasan: "perkara_id_tidak_sah", sumber: "", relaas: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();

  // --- jalan 1 dan 2: tabel penilaian relaas -------------------------------
  if (await sippSkemaService.tabelAda("perkara_penilaian_relaas")) {
    const kolomNilai = kolom.penilaianRelaasNilai;
    const kolomTanggal = kolom.penilaianRelaasTanggal;
    const kolomSidang = await sippSkemaService.pilihKolom("perkara_penilaian_relaas", [
      "tanggal_sidang",
      "sidang_id",
    ]);

    if (kolomNilai || kolomTanggal) {
      const pilihan = [];
      if (kolomNilai) pilihan.push(`t.${kolomNilai} AS nilai`);
      if (kolomTanggal) pilihan.push(`t.${kolomTanggal} AS diinput`);
      if (kolomSidang) pilihan.push(`t.${kolomSidang} AS acuanSidang`);

      const rows = await runQuery(
        `SELECT ${pilihan.join(", ")} FROM perkara_penilaian_relaas t
          WHERE t.perkara_id = ? LIMIT 200`,
        [id]
      ).catch(() => []);

      if (rows.length > 0 && kolomNilai) {
        // SIPP sudah menghitungnya sendiri. Nilai itu yang dipakai - ia
        // catatan pengadilan, bukan tafsiran kita.
        const angka = rows
          .map((row) => Number(row.nilai))
          .filter((x) => Number.isFinite(x));
        if (angka.length > 0) {
          const rata = angka.reduce((a, b) => a + b, 0) / angka.length;
          return {
            terbaca: true,
            alasan: "",
            sumber: `kolom ${kolomNilai} pada perkara_penilaian_relaas`,
            nilaiLangsung: Math.round(rata * 10) / 10,
            jumlah: angka.length,
            relaas: [],
          };
        }
      }

      if (rows.length > 0 && kolomTanggal) {
        const relaas = await pasangkanSidang(id, rows, "diinput");
        if (relaas.length > 0) {
          return {
            terbaca: true,
            alasan: "",
            sumber: `kolom ${kolomTanggal} pada perkara_penilaian_relaas`,
            relaas,
          };
        }
      }
    }
  }

  // --- jalan 3: tanggal input pada relaas itu sendiri ----------------------
  const dariRelaas = await relaasBerinputPerkara(id);
  if (dariRelaas.terbaca) {
    const berinput = dariRelaas.baris.filter((x) => x.tanggalInput && x.tanggalSidang);
    if (berinput.length > 0) {
      return {
        terbaca: true,
        alasan: "",
        sumber: "tanggal input pada perkara_pelaksanaan_relaas",
        relaas: berinput.map((x) => ({ tanggalSidang: x.tanggalSidang, tanggalInput: x.tanggalInput })),
      };
    }
  }

  // --- jalan 4: jejak audit ------------------------------------------

  const semuaRelaas = await runQuery(
    `SELECT r.id AS id, j.tanggal_sidang AS tanggalSidang
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
      WHERE r.perkara_id = ?
      ORDER BY r.id ASC
      LIMIT 50`,
    [id]
  ).catch(() => []);

  // Tidak ada relaas sama sekali - ini TERBACA, dan SK menilainya -5.
  if (semuaRelaas.length === 0) {
    return { terbaca: true, alasan: "", sumber: "tidak ada relaas", relaas: [] };
  }

  const bentuk = await sippAuditService.bentukAudit();
  if (bentuk.terbaca && bentuk.baris && bentuk.tabel) {
    const dariAudit = [];
    for (const baris of semuaRelaas) {
      const jejak = await sippAuditService.pertamaDicatat({
        tabel: "perkara_pelaksanaan_relaas",
        recordId: baris.id,
      });
      if (!jejak.tanggal) continue;
      const tanggalSidang = isoTanggal(baris.tanggalSidang);
      if (!tanggalSidang) continue;
      dariAudit.push({ tanggalSidang, tanggalInput: jejak.tanggal });
    }
    if (dariAudit.length > 0) {
      return {
        terbaca: true,
        alasan: "",
        sumber: "jejak audit sys_audittrail",
        dariAudit: true,
        relaas: dariAudit,
      };
    }
  }

  return {
    terbaca: false,
    alasan:
      "Ada relaas, tetapi kapan diinput belum terbaca dari mana pun - " +
      "tabel penilaian, kolom tanggal input, maupun jejak audit.",
    sumber: "",
    relaas: [],
  };
}

/**
 * Menyandingkan baris penilaian dengan tanggal sidangnya.
 *
 * Bila barisnya menyebut sidang_id, tanggalnya dicari dari jadwal. Bila tidak,
 * yang dipakai jadwal sidang perkara itu berurutan - relaas ke-n dipasangkan
 * dengan sidang ke-n. Itu perkiraan, dan disebutkan begitu.
 */
async function pasangkanSidang(perkaraId, rows, medanTanggal) {
  const jadwal = await runQuery(
    `SELECT j.id AS id, j.tanggal_sidang AS tanggal
       FROM perkara_jadwal_sidang j WHERE j.perkara_id = ?
      ORDER BY j.tanggal_sidang ASC, j.id ASC LIMIT 100`,
    [perkaraId]
  ).catch(() => []);

  const perId = {};
  for (const baris of jadwal) perId[String(baris.id)] = isoTanggal(baris.tanggal);

  const hasil = [];
  rows.forEach((row, urutan) => {
    const diinput = isoTanggal(row[medanTanggal]);
    if (!diinput) return;

    const acuan = row.acuanSidang;
    const tanggalSidang =
      acuan && perId[String(acuan)]
        ? perId[String(acuan)]
        : isoTanggal(acuan) ||
          (jadwal[urutan] ? isoTanggal(jadwal[urutan].tanggal) : "");

    if (tanggalSidang) hasil.push({ tanggalSidang, tanggalInput: diinput });
  });
  return hasil;
}
/**
 * Arti kode hasil_mediasi pada SIPP.
 *
 * Disalin dari kueri notifikasi SIPP pengadilan ini. Kode yang tidak dikenali
 * dibaca "Tidak berhasil" - itulah pilihan yang paling aman: menyebutnya
 * berhasil padahal tidak akan membuat laporan mediasi tampak lebih baik
 * daripada kenyataannya.
 */
const ARTI_HASIL_MEDIASI = {
  Y1: "Berhasil Kesepakatan Damai",
  Y2: "Berhasil Dengan Pencabutan",
  S: "Berhasil Sebagian",
  D: "Tidak Dapat Dilaksanakan",
};

function artiHasilMediasi(kode) {
  const kunci = cleanText(kode).toUpperCase();
  if (!kunci) return "";
  return ARTI_HASIL_MEDIASI[kunci] || "Tidak Berhasil";
}

/** Apakah hasil mediasi ini termasuk berhasil? Dipakai penanda di layar. */
function mediasiBerhasil(kode) {
  const kunci = cleanText(kode).toUpperCase();
  return kunci === "Y1" || kunci === "Y2" || kunci === "S";
}
/**
 * Mediasi selengkap yang tercatat di SIPP.
 *
 * ============================================================================
 * TIGA TABEL, DIHUBUNGKAN DUA KUNCI
 * ============================================================================
 *
 *   perkara_mediasi        - dicari dengan perkara_id, memberi mediasi_id
 *   perkara_mediator       - dicari dengan perkara_id; siapa mediatornya,
 *                            kapan ditetapkan, nomor SK-nya
 *   perkara_jadwal_mediasi - dicari dengan MEDIASI_ID, bukan perkara_id
 *
 * Kunci terakhir itulah yang membuat bagian mediasi kosong sebelumnya: jadwal
 * pertemuan dicari dengan perkara_id, padahal tabelnya tidak punya kolom itu.
 *
 * ============================================================================
 * MEDIATOR DIBACA DARI DUA ARAH
 * ============================================================================
 *
 * perkara_mediasi menyimpan mediator_text; perkara_mediator menyimpan
 * riwayatnya lengkap dengan nomor SK dan penandaan aktif. Keduanya dibaca,
 * dan yang dari perkara_mediator didahulukan - ia yang paling lengkap.
 */
async function mediasiLengkapPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("perkara_mediasi"))) {
    return { terbaca: false, alasan: "Tabel perkara_mediasi tidak ada pada SIPP versi ini.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();

  const MEDAN = [
    { kunci: kolom.mediasiId, alias: "mediasiId" },
    { kunci: kolom.mediasiMediator, alias: "mediator" },
    { kunci: kolom.mediasiStatusMediator, alias: "statusMediator" },
    { kunci: kolom.mediasiJenis, alias: "jenisMediasi" },
    { kunci: kolom.mediasiAda, alias: "adaMediasi" },
    // MULAI = penetapan penunjukan mediator; SELESAI = laporan mediator.
    { kunci: kolom.mediasiPenetapan, alias: "penetapan" },
    { kunci: kolom.mediasiLaporan, alias: "laporan" },
    { kunci: kolom.mediasiNomorSk, alias: "nomorSk" },
    { kunci: kolom.mediasiHasil, alias: "hasil" },
    { kunci: kolom.mediasiBerhasil, alias: "berhasil" },
    { kunci: kolom.mediasiDimulai, alias: "dimulai" },
    { kunci: kolom.mediasiKeputusan, alias: "keputusan" },
    { kunci: kolom.mediasiKesepakatan, alias: "kesepakatan" },
    { kunci: kolom.mediasiTanggalKesepakatan, alias: "tanggalKesepakatan" },
    { kunci: kolom.mediasiCatatan, alias: "catatan" },
    { kunci: kolom.mediasiHasilKesepakatan, alias: "hasilKesepakatan" },
    { kunci: kolom.mediasiPertemuan, alias: "pertemuan" },
  ].filter((x) => x.kunci);

  if (MEDAN.length === 0) {
    const adaKolom = await sippSkemaService.kolomTabel("perkara_mediasi");
    return {
      terbaca: false,
      alasan:
        adaKolom.length > 0
          ? `Kolom mediasi belum dikenali. Kolom yang ada pada perkara_mediasi: ${adaKolom.join(", ")}.`
          : "Tabel perkara_mediasi kosong tanpa kolom.",
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const rows = await runQuery(
    `SELECT ${MEDAN.map((x) => `m.${x.kunci} AS ${x.alias}`).join(", ")}
       FROM perkara_mediasi m WHERE m.perkara_id = ? LIMIT 20`,
    [id]
  ).catch(() => []);

  const [mediator, durasi] = await Promise.all([
    mediatorPerkara(id),
    durasiMediasiPerkara(id),
  ]);

  // Jadwal pertemuan dicari dengan mediasi_id dari baris di atas.
  const idMediasi = rows.map((x) => x.mediasiId).filter((x) => x !== null && x !== undefined);
  const jadwal = await jadwalMediasiPerkara(idMediasi);

  return {
    terbaca: true,
    alasan: "",
    mediator: mediator.baris,
    mediatorTerbaca: mediator.terbaca,
    jadwal: jadwal.baris,
    jadwalTerbaca: jadwal.terbaca,
    alasanJadwal: jadwal.alasan,
    // Lama mediasi dari v_durasi_mediasi - itulah hitungan yang dipakai
    // pengadilan ini, dan yang dipotong dari waktu penyelesaian perkara.
    lamaHariView: durasi.terbaca ? durasi.hari : null,
    baris: rows.map((row) => {
      // Penetapan mediator: dari perkara_mediator bila ada, sebab di sanalah
      // riwayat lengkapnya; perkara_mediasi hanya menyimpan satu tanggal.
      const dariMediator = mediator.baris[0] || null;

      // MULAI adalah tanggal penetapan penunjukan mediator - sebelum mediator
      // ditetapkan belum ada mediasi. SELESAI adalah tanggal laporan mediator
      // - sesudah laporannya masuk, mediasi itu sudah berakhir.
      const penetapan =
        isoTanggal(row.penetapan) || (dariMediator ? dariMediator.tanggalPenetapan : "");
      const laporan = isoTanggal(row.laporan);

      // Lama diambil dari view bila ada; selisih tanggal dipakai bila tidak.
      const selisih = selisihHari(penetapan, laporan);
      const lama = durasi.terbaca && durasi.hari > 0 ? durasi.hari : selisih;

      const kodeHasil = cleanText(row.hasil);
      return {
        mediator: cleanText(row.mediator) || (dariMediator ? dariMediator.nama : ""),
        statusMediator: cleanText(row.statusMediator),
        jenisPenetapan: cleanText(row.jenisMediasi),
        nomorSk: cleanText(row.nomorSk) || (dariMediator ? dariMediator.nomorSk : ""),
        kodeHasil,
        hasil: artiHasilMediasi(kodeHasil),
        berhasil: mediasiBerhasil(kodeHasil),
        tanggalPenetapan: penetapan,
        tanggalMulai: penetapan,
        tanggalSelesai: laporan,
        tanggalLaporan: laporan,
        tanggalDimulaiTercatat: isoTanggal(row.dimulai),
        tanggalKeputusan: isoTanggal(row.keputusan),
        tanggalKesepakatan: isoTanggal(row.tanggalKesepakatan),
        isiKesepakatan: String(row.kesepakatan || ""),
        catatan: String(row.catatan || ""),
        jumlahPertemuan:
          row.pertemuan === null || row.pertemuan === undefined
            ? jadwal.baris.length || null
            : Number(row.pertemuan),
        lamaHari: lama,
        lamaDariView: durasi.terbaca && durasi.hari > 0,
        // PERMA 1/2016 Pasal 24: paling lama 30 hari sejak mediator ditetapkan.
        lewatTenggang: lama === null ? null : lama > 30,
      };
    }),
  };
}

/** Mediator yang ditetapkan pada perkara ini, beserta nomor SK-nya. */
async function mediatorPerkara(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_mediator"))) {
    return { terbaca: false, alasan: "Tabel perkara_mediator tidak ada.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  const pilihan = [];
  if (kolom.mediatorNama) pilihan.push(`m.${kolom.mediatorNama} AS nama`);
  if (kolom.mediatorPenetapan) pilihan.push(`m.${kolom.mediatorPenetapan} AS penetapan`);
  if (kolom.mediatorNomorSk) pilihan.push(`m.${kolom.mediatorNomorSk} AS nomorSk`);
  if (kolom.mediatorStatus) pilihan.push(`m.${kolom.mediatorStatus} AS status`);
  if (kolom.mediatorAktif) pilihan.push(`m.${kolom.mediatorAktif} AS aktif`);
  if (kolom.mediatorKeterangan) pilihan.push(`m.${kolom.mediatorKeterangan} AS keterangan`);

  if (pilihan.length === 0) {
    return { terbaca: false, alasan: "Kolom mediator belum dikenali.", baris: [] };
  }

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_mediator m
      WHERE m.perkara_id = ?
      ORDER BY ${kolom.mediatorPenetapan ? `m.${kolom.mediatorPenetapan}` : "m.perkara_id"} ASC
      LIMIT 20`,
    [Number(perkaraId)]
  ).catch(() => []);

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => ({
      nama: cleanText(row.nama),
      tanggalPenetapan: isoTanggal(row.penetapan),
      nomorSk: cleanText(row.nomorSk),
      status: cleanText(row.status),
      // aktif = T berarti mediator ini sudah diganti.
      masihAktif: cleanText(row.aktif).toUpperCase() !== "T",
      keterangan: cleanText(row.keterangan),
    })),
  };
}

/**
 * Jadwal pertemuan mediasi.
 *
 * Dicari dengan MEDIASI_ID - tabel ini tidak punya kolom perkara_id. Itulah
 * sebabnya jadwalnya selalu kosong sebelumnya.
 */
async function jadwalMediasiPerkara(idMediasi = []) {
  const daftar = (Array.isArray(idMediasi) ? idMediasi : [idMediasi])
    .map(Number)
    .filter((x) => Number.isFinite(x) && x > 0);

  if (daftar.length === 0) {
    return { terbaca: false, alasan: "Tidak ada mediasi_id untuk dicari.", baris: [] };
  }

  if (!(await sippSkemaService.tabelAda("perkara_jadwal_mediasi"))) {
    return { terbaca: false, alasan: "Tabel perkara_jadwal_mediasi tidak ada.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.jadwalMediasiKunci || !kolom.jadwalMediasiTanggal) {
    const adaKolom = await sippSkemaService.kolomTabel("perkara_jadwal_mediasi");
    return {
      terbaca: false,
      alasan: `Kolom jadwal mediasi belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      baris: [],
    };
  }

  const pilihan = [`j.${kolom.jadwalMediasiTanggal} AS tanggal`];
  if (kolom.jadwalMediasiJam) pilihan.push(`j.${kolom.jadwalMediasiJam} AS jam`);
  if (kolom.jadwalMediasiSampai) pilihan.push(`j.${kolom.jadwalMediasiSampai} AS sampai`);
  if (kolom.jadwalMediasiTempat) pilihan.push(`j.${kolom.jadwalMediasiTempat} AS tempat`);
  if (kolom.jadwalMediasiHadir) pilihan.push(`j.${kolom.jadwalMediasiHadir} AS hadir`);
  if (kolom.jadwalMediasiDitunda) pilihan.push(`j.${kolom.jadwalMediasiDitunda} AS ditunda`);

  const isian = daftar.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_jadwal_mediasi j
      WHERE j.${kolom.jadwalMediasiKunci} IN (${isian})
      ORDER BY j.${kolom.jadwalMediasiTanggal} ASC
      LIMIT 50`,
    daftar
  ).catch(() => []);

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => ({
      tanggal: isoTanggal(row.tanggal),
      jam: cleanText(row.jam),
      sampaiJam: cleanText(row.sampai),
      tempat: cleanText(row.tempat),
      dihadiri: cleanText(row.hadir),
      // ============================================================
      // Y BERARTI YA, T BERARTI TIDAK
      // ============================================================
      //
      // Sebelumnya baris ini membaca "T" sebagai ditunda - terbalik. Di
      // seluruh SIPP, dan di seluruh berkas ini, T singkatan dari TIDAK:
      // aktif = T, ditunda = T, ket_temu = T. Akibatnya SETIAP pertemuan
      // mediasi yang berjalan normal tertandai ditunda, dan yang benar-benar
      // ditunda justru terbaca biasa saja - dua kekeliruan sekaligus, dan
      // keduanya persis terbalik dari kenyataan.
      ditunda: cleanText(row.ditunda).toUpperCase() === "Y",
    })),
  };
}
/**
 * Delegasi MASUK - permintaan pengadilan lain yang kita laksanakan.
 *
 * SK Tabel 2 I.17 menilai seberapa cepat kita menerimanya sejak satker
 * pengaju mengunggah dokumennya: 1 hari atau kurang bernilai 5, sampai 5 hari
 * bernilai 0.
 *
 * Pendelegasian yang jatuh pada hari Jumat dihitung mulai hari Senin - itu
 * ketentuan SK, dan diterapkan di sini sebelum selisihnya dihitung.
 */
async function delegasiMasukPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("delegasi_masuk"))) {
    return { terbaca: false, alasan: "Tabel delegasi_masuk tidak ada pada SIPP versi ini.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  const pilihan = [];
  if (kolom.delegasiMasukUnggah) pilihan.push(`d.${kolom.delegasiMasukUnggah} AS diunggah`);
  if (kolom.delegasiMasukTerima) pilihan.push(`d.${kolom.delegasiMasukTerima} AS diterima`);
  if (kolom.delegasiMasukAsal) pilihan.push(`d.${kolom.delegasiMasukAsal} AS asal`);

  if (pilihan.length === 0) {
    const adaKolom = await sippSkemaService.kolomTabel("delegasi_masuk");
    return {
      terbaca: false,
      alasan: `Kolom delegasi masuk belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM delegasi_masuk d WHERE d.perkara_id = ? LIMIT 50`,
    [id]
  ).catch(() => []);

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => {
      const diunggah = isoTanggal(row.diunggah);
      const diterima = isoTanggal(row.diterima);
      return {
        asal: cleanText(row.asal),
        tanggalDiunggah: diunggah,
        tanggalDiterima: diterima,
        hariSampaiTerima: selisihHariKerjaJumat(diunggah, diterima),
      };
    }),
  };
}

/**
 * Delegasi KELUAR (tabayun) - permintaan kita ke pengadilan lain.
 *
 * ============================================================================
 * TANGGAL SIDANGNYA ADA DI TABEL DELEGASI ITU SENDIRI
 * ============================================================================
 *
 * delegasi_keluar menyimpan tgl_delegasi DAN tgl_sidang pada baris yang sama.
 * Jadi tidak perlu menebak sidang mana yang dimaksud dengan mencocokkan
 * jadwal - pasangannya sudah tercatat. Ini mengikuti kueri notifikasi SIPP
 * pengadilan ini.
 *
 * ============================================================================
 * HANYA DELEGASI PANGGILAN YANG DINILAI
 * ============================================================================
 *
 * id_jenis_delegasi = 1 berarti panggilan. Delegasi pemberitahuan tidak ikut,
 * sebab yang dinilai SK III.3 adalah kepatutan waktu PEMANGGILAN.
 *
 * Nilainya persis SK III.3:
 *
 *   6 hari atau lebih sebelum sidang ->  0
 *   5 hari                           -> -1
 *   4 hari                           -> -2
 *   3 hari                           -> -3
 *   2 hari atau kurang               -> -5
 */
const JENIS_DELEGASI_PANGGILAN = 1;

async function delegasiKeluarPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("delegasi_keluar"))) {
    return { terbaca: false, alasan: "Tabel delegasi_keluar tidak ada pada SIPP versi ini.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  const pilihan = ["d.id AS delegasiId"];
  if (kolom.delegasiKeluarPermohonan) pilihan.push(`d.${kolom.delegasiKeluarPermohonan} AS permohonan`);
  if (kolom.delegasiKeluarSidang) pilihan.push(`d.${kolom.delegasiKeluarSidang} AS sidang`);
  if (kolom.delegasiKeluarResi) pilihan.push(`d.${kolom.delegasiKeluarResi} AS resi`);
  if (kolom.delegasiKeluarTujuan) pilihan.push(`d.${kolom.delegasiKeluarTujuan} AS tujuan`);
  if (kolom.delegasiKeluarJenis) pilihan.push(`d.${kolom.delegasiKeluarJenis} AS jenis`);
  if (kolom.delegasiKeluarSelesai) pilihan.push(`d.${kolom.delegasiKeluarSelesai} AS selesai`);

  if (pilihan.length <= 1) {
    const adaKolom = await sippSkemaService.kolomTabel("delegasi_keluar");
    return {
      terbaca: false,
      alasan: `Kolom delegasi keluar belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM delegasi_keluar d
      WHERE d.perkara_id = ?
      ORDER BY ${kolom.delegasiKeluarPermohonan ? `d.${kolom.delegasiKeluarPermohonan}` : "d.id"} ASC
      LIMIT 50`,
    [id]
  ).catch(() => []);

  // Pelaksanaannya - kapan relaasnya, oleh jurusita mana - dari tabel proses.
  const proses = await prosesDelegasiKeluar(rows.map((x) => x.delegasiId));

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => {
      const permohonan = isoTanggal(row.permohonan);
      const sidang = isoTanggal(row.sidang);
      const jarak = selisihHari(permohonan, sidang);
      const panggilan =
        !kolom.delegasiKeluarJenis || Number(row.jenis) === JENIS_DELEGASI_PANGGILAN;

      return {
        tujuan: cleanText(row.tujuan),
        tanggalPermohonan: permohonan,
        tanggalSidang: sidang,
        tanggalResi: isoTanggal(row.resi),
        tanggalSelesai: isoTanggal(row.selesai),
        hariSebelumSidang: jarak,
        // Hanya delegasi panggilan yang masuk penilaian SK III.3.
        panggilan,
        nilai: panggilan ? nilaiTabayun(jarak) : null,
        pelaksanaan: proses[String(row.delegasiId)] || null,
      };
    }),
  };
}

/** Nilai pengurang SK Tabel 2 III.3 dari jarak permohonan ke hari sidang. */
function nilaiTabayun(hari) {
  if (hari === null || hari === undefined) return null;
  if (hari >= 6) return 0;
  if (hari === 5) return -1;
  if (hari === 4) return -2;
  if (hari === 3) return -3;
  return -5;
}

/** Pelaksanaan delegasi keluar - kapan relaasnya dan oleh jurusita mana. */
async function prosesDelegasiKeluar(idDelegasi = []) {
  const daftar = [...new Set(idDelegasi.map(Number).filter(Boolean))];
  if (daftar.length === 0) return {};
  if (!(await sippSkemaService.tabelAda("delegasi_proses_keluar"))) return {};

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.delegasiProsesKunci) return {};

  const pilihan = [`p.${kolom.delegasiProsesKunci} AS delegasiId`];
  if (kolom.delegasiProsesRelaas) pilihan.push(`p.${kolom.delegasiProsesRelaas} AS relaas`);
  if (kolom.delegasiProsesJurusita) pilihan.push(`p.${kolom.delegasiProsesJurusita} AS jurusita`);

  const isian = daftar.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM delegasi_proses_keluar p
      WHERE p.${kolom.delegasiProsesKunci} IN (${isian}) LIMIT 200`,
    daftar
  ).catch(() => []);

  const peta = {};
  for (const row of rows) {
    const kunci = String(row.delegasiId);
    if (peta[kunci]) continue;
    peta[kunci] = {
      tanggalRelaas: isoTanggal(row.relaas),
      jurusita: cleanText(row.jurusita),
    };
  }
  return peta;
}

/**
 * Selisih hari, dengan ketentuan Jumat pada SK Tabel 2 I.17.
 *
 * "Untuk pendelegasian yang jatuh pada hari Jumat perhitungan penilaian
 * terhitung dimulai pada hari Senin." Jadi delegasi yang diunggah Jumat
 * dihitung seolah diunggah Senin - tiga hari sesudahnya.
 */
function selisihHariKerjaJumat(dari, ke) {
  if (!dari || !ke) return null;
  const awal = new Date(`${dari}T00:00:00`);
  if (Number.isNaN(awal.getTime())) return null;

  // getDay: 0 Minggu, 5 Jumat, 6 Sabtu.
  const hariNya = awal.getDay();
  let mulai = dari;
  if (hariNya === 5) {
    const senin = new Date(awal.getTime() + 3 * 24 * 60 * 60 * 1000);
    mulai = isoTanggal(senin);
  } else if (hariNya === 6) {
    mulai = isoTanggal(new Date(awal.getTime() + 2 * 24 * 60 * 60 * 1000));
  } else if (hariNya === 0) {
    mulai = isoTanggal(new Date(awal.getTime() + 24 * 60 * 60 * 1000));
  }

  const selisih = selisihHari(mulai, ke);
  // Diterima sebelum hari mulainya dihitung nol, bukan negatif - menerima
  // lebih cepat dari yang dituntut bukan pelanggaran.
  return selisih === null ? null : Math.max(0, selisih);
}

/**
 * Keterangan arsip: kapan diinput, oleh siapa, di mana disimpan, dan berkasnya.
 */
async function arsipKeteranganPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("arsip"))) {
    return { terbaca: false, alasan: "Tabel arsip tidak ada pada SIPP versi ini.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  const kolomId = await sippSkemaService.pilihKolom("arsip", ["id"]);

  const pilihan = [];
  if (kolomId) pilihan.push(`a.${kolomId} AS arsipId`);
  if (kolom.inputArsip) pilihan.push(`a.${kolom.inputArsip} AS diinput`);
  if (kolom.arsipNomor) pilihan.push(`a.${kolom.arsipNomor} AS nomor`);
  if (kolom.arsipKeterangan) pilihan.push(`a.${kolom.arsipKeterangan} AS keterangan`);
  if (kolom.arsipOleh) pilihan.push(`a.${kolom.arsipOleh} AS oleh`);
  if (kolom.arsipBerkas) pilihan.push(`a.${kolom.arsipBerkas} AS berkas`);
  // Letak berkas FISIK - inilah isi sebenarnya tabel arsip SIPP, dan
  // sebelumnya tidak satu pun dibaca.
  if (kolom.arsipRuang) pilihan.push(`a.${kolom.arsipRuang} AS ruang`);
  if (kolom.arsipLemari) pilihan.push(`a.${kolom.arsipLemari} AS lemari`);
  if (kolom.arsipRak) pilihan.push(`a.${kolom.arsipRak} AS rak`);
  if (kolom.arsipBox) pilihan.push(`a.${kolom.arsipBox} AS box`);
  if (kolom.arsipMasuk) pilihan.push(`a.${kolom.arsipMasuk} AS masuk`);
  if (kolom.arsipLengkap) pilihan.push(`a.${kolom.arsipLengkap} AS lengkap`);
  if (kolom.arsipPenerima) pilihan.push(`a.${kolom.arsipPenerima} AS penerima`);

  if (pilihan.length === 0) {
    const adaKolom = await sippSkemaService.kolomTabel("arsip");
    return {
      terbaca: false,
      alasan: `Kolom arsip belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM arsip a WHERE a.perkara_id = ? LIMIT 20`,
    [id]
  ).catch(() => []);

  // Peminjaman berkas fisik. Tabelnya belum tentu ada pada tiap SIPP, dan
  // di pengadilan ini masih kosong - jadi kegagalannya ditelan dan
  // daftarnya dibiarkan kosong, bukan menggagalkan seluruh bagian arsip.
  let pinjam = [];
  if (await sippSkemaService.tabelAda("arsip_pinjam")) {
    const idArsip = rows
      .map((x) => Number(x.arsipId))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (idArsip.length > 0) {
      const isian = idArsip.map(() => "?").join(", ");
      pinjam = await runQuery(
        `SELECT ap.arsip_id AS arsipId,
                ap.tanggal_pinjam AS tanggalPinjam,
                ap.tanggal_kembali AS tanggalKembali,
                ap.petugas_peminjam AS peminjam,
                ap.keterangan AS keterangan
           FROM arsip_pinjam ap
          WHERE ap.arsip_id IN (${isian})
          ORDER BY ap.tanggal_pinjam DESC
          LIMIT 50`,
        idArsip
      ).catch(() => []);
    }
  }

  const petaPinjam = new Map();
  for (const baris of pinjam) {
    const kunci = String(baris.arsipId || "");
    // Yang disimpan peminjaman TERBARU saja - itu yang menjawab
    // "berkasnya sekarang di siapa".
    if (!petaPinjam.has(kunci)) petaPinjam.set(kunci, baris);
  }

  return {
    terbaca: true,
    alasan: "",
    sudahDiarsipkan: rows.length > 0,
    // Bila kolom berkasnya tidak ada sama sekali, itu disebutkan - supaya
    // jelas bahwa tidak adanya tombol unduh bukan karena berkasnya hilang.
    berkasTerbaca: Boolean(kolom.arsipBerkas),
    baris: rows.map((row) => ({
      arsipId: String(row.arsipId || ""),
      tanggalInput: isoTanggal(row.diinput),
      nomor: cleanText(row.nomor),
      keterangan: cleanText(row.keterangan),
      oleh: cleanText(row.oleh),
      adaBerkas: Boolean(cleanText(row.berkas)),
      // --- letak berkas fisiknya ---
      ruang: cleanText(row.ruang),
      lemari: cleanText(row.lemari),
      rak: cleanText(row.rak),
      box: cleanText(row.box),
      tanggalMasuk: isoTanggal(row.masuk),
      penerima: cleanText(row.penerima),
      // SIPP menyimpannya 'Y'/'T'.
      lengkap: cleanText(row.lengkap).toUpperCase() === "Y",
      pinjam: (() => {
        const p = petaPinjam.get(String(row.arsipId || ""));
        if (!p) return null;
        return {
          tanggalPinjam: isoTanggal(p.tanggalPinjam),
          tanggalKembali: isoTanggal(p.tanggalKembali),
          // Belum kembali berarti berkasnya sedang tidak di raknya - itulah
          // yang perlu diketahui sebelum orang berjalan ke ruang arsip.
          sedangDipinjam: !isoTanggal(p.tanggalKembali),
          peminjam: cleanText(p.peminjam),
          keterangan: cleanText(p.keterangan),
        };
      })(),
    })),
  };
}

/**
 * Konseptor putusan - siapa yang mengerjakan konsepnya.
 *
 * ============================================================================
 * TIDAK ADA KOLOMNYA; YANG ADA JEJAK PROSESNYA
 * ============================================================================
 *
 * perkara_proses dengan tahapan_id 210 adalah tahapan putusan, dan
 * diinput_oleh pada baris itu orang yang mengerjakannya.
 *
 * Yang tersimpan USERNAME, bukan nama orangnya. Nama aslinya dicari di
 * sys_users - tanpa itu yang tampil di layar hanya "panmud4", dan nama
 * pengguna tidak berarti apa-apa bagi yang membaca laporan.
 *
 * ============================================================================
 * BILA TAHAPAN 210 TIDAK PERNAH DICATAT, JEJAK AUDIT YANG MENJAWAB
 * ============================================================================
 *
 * Tidak semua satker mencatat tahapan putusan pada perkara_proses - sebagian
 * langsung mengisi perkara_putusan tanpa melewati tahapannya. Pada perkara
 * seperti itu konseptornya tidak terbaca sama sekali, dan bagiannya hilang
 * dari layar tanpa sebab yang terlihat.
 *
 * Cadangannya jejak audit: siapa yang PERTAMA mencatat baris putusan perkara
 * ini. Itu bukan hal yang sama dengan konseptor - yang menginput belum tentu
 * yang mengonsep - sehingga asalnya SELALU ditandai, dan tidak pernah
 * disamarkan seolah terbaca dari tahapan putusan.
 */
const TAHAPAN_PUTUSAN = 210;

async function konseptorPutusanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  if (!(await sippSkemaService.tabelAda("perkara_proses"))) {
    return { terbaca: false, alasan: "Tabel perkara_proses tidak ada pada SIPP versi ini.", baris: [] };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.prosesTahapanId || !kolom.prosesDiinputOleh) {
    const adaKolom = await sippSkemaService.kolomTabel("perkara_proses");
    return {
      terbaca: false,
      alasan: `Kolom perkara_proses belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      baris: [],
    };
  }

  const pilihan = [`p.${kolom.prosesDiinputOleh} AS pengguna`];
  if (kolom.prosesTanggal) pilihan.push(`p.${kolom.prosesTanggal} AS tanggal`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_proses p
      WHERE p.perkara_id = ? AND p.${kolom.prosesTahapanId} = ?
      ORDER BY ${kolom.prosesTanggal ? `p.${kolom.prosesTanggal}` : "p.perkara_id"} ASC
      LIMIT 10`,
    [id, TAHAPAN_PUTUSAN]
  ).catch(() => []);

  if (rows.length === 0) return konseptorDariAudit(id);

  const namaAsli = await namaPengguna(rows.map((x) => x.pengguna));

  const terlihat = new Set();
  const baris = [];
  for (const row of rows) {
    const pengguna = cleanText(row.pengguna);
    if (!pengguna || terlihat.has(pengguna)) continue;
    terlihat.add(pengguna);
    baris.push({
      pengguna,
      // Nama lengkap bila terbaca; nama penggunanya bila tidak - bukan kosong.
      nama: namaAsli[pengguna] || pengguna,
      namaTerbaca: Boolean(namaAsli[pengguna]),
      tanggal: isoTanggal(row.tanggal),
    });
  }

  return { terbaca: true, alasan: "", baris };
}

/**
 * Cadangan konseptor: pencatat PERTAMA baris putusan pada jejak audit.
 *
 * Dipakai hanya bila tahapan putusan tidak pernah dicatat. Hasilnya ditandai
 * dariAudit supaya yang membaca tahu ini pencatat, bukan konseptor - dua
 * peran yang kerap sama orangnya, tetapi tidak boleh diandaikan sama.
 */
async function konseptorDariAudit(perkaraId) {
  const jejak = await sippAuditService
    .pertamaDicatat({ tabel: "perkara_putusan", perkaraId })
    .catch(() => null);

  if (!jejak || !jejak.terbaca || !jejak.oleh) {
    return {
      terbaca: true,
      alasan: "",
      baris: [],
      // Disebutkan supaya layarnya dapat menerangkan mengapa kosong, alih-alih
      // menghilangkan bagiannya dan membuat orang mengira fiturnya tidak ada.
      catatan: "Tahapan putusan tidak tercatat pada perkara_proses, dan jejak auditnya tidak menyebut pencatatnya.",
    };
  }

  const namaAsli = await namaPengguna([jejak.oleh]);
  return {
    terbaca: true,
    alasan: "",
    dariAudit: true,
    catatan: "Tahapan putusan tidak tercatat pada perkara_proses. Yang disebut di sini pencatat pertama baris putusan menurut jejak audit.",
    baris: [
      {
        pengguna: jejak.oleh,
        nama: namaAsli[jejak.oleh] || jejak.oleh,
        namaTerbaca: Boolean(namaAsli[jejak.oleh]),
        tanggal: jejak.tanggal || "",
        dariAudit: true,
      },
    ],
  };
}
/** Nama lengkap beberapa pengguna sekaligus, dari sys_users. */
async function namaPengguna(daftarUsername = []) {
  const bersih = [...new Set(daftarUsername.map((x) => cleanText(x)).filter(Boolean))];
  if (bersih.length === 0) return {};
  if (!(await sippSkemaService.tabelAda("sys_users"))) return {};

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.penggunaUsername || !kolom.penggunaNamaLengkap) return {};

  const isian = bersih.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT u.${kolom.penggunaUsername} AS pengguna, u.${kolom.penggunaNamaLengkap} AS nama
       FROM sys_users u WHERE u.${kolom.penggunaUsername} IN (${isian}) LIMIT 50`,
    bersih
  ).catch(() => []);

  const peta = {};
  for (const row of rows) {
    const pengguna = cleanText(row.pengguna);
    const nama = cleanText(row.nama);
    if (pengguna && nama) peta[pengguna] = nama;
  }
  return peta;
}

/**
 * Menerjemahkan nomor rujukan menjadi namanya.
 *
 * SIPP menyimpan status putusan dan sumber hukum sebagai ANGKA; namanya ada
 * di tabel rujukannya sendiri. Tanpa penerjemahan ini yang tampil di layar
 * hanyalah angka, dan angka tidak memberi tahu siapa pun apakah perkaranya
 * dikabulkan atau ditolak.
 *
 * Satu kolom dapat memuat beberapa nomor sekaligus - sumber hukum pada SIPP
 * berupa daftar centang, dan yang tersimpan dapat berbentuk "1,3,5". Karena
 * itu masukannya dipecah lebih dulu.
 */
async function namaRujukan(tabel, kolomId, kolomNama, nilai) {
  const teks = cleanText(nilai);
  if (!teks || !kolomId || !kolomNama) return "";
  if (!(await sippSkemaService.tabelAda(tabel))) return "";

  const nomor = teks
    .split(/[,;|]/)
    .map((x) => Number(String(x).trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (nomor.length === 0) return "";

  const isian = nomor.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT r.${kolomNama} AS nama FROM ${tabel} r WHERE r.${kolomId} IN (${isian}) LIMIT 20`,
    nomor
  ).catch(() => []);

  return rows
    .map((row) => cleanText(row.nama))
    .filter(Boolean)
    .join(", ");
}

/**
 * Keterangan putusan yang lengkap - amar, sumber hukum, dan sebab perceraian.
 *
 * Yang ditampilkan halaman detail perkara SIPP juga: status putusan, verstek
 * atau contradictoir, sumber hukum yang dipakai, faktor penyebab perceraian,
 * qobla atau bada dukhul, dan status nusyuz. Semuanya diperlukan saat berkas
 * diperiksa, dan selama ini harus dibuka satu per satu di SIPP.
 */
async function putusanLengkapPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah" };

  const kolom = await sippSkemaService.kolomTerpilih();
  const pilihan = ["pu.tanggal_putusan AS tanggalPutusan"];

  const tambah = (nama, alias) => {
    if (nama) pilihan.push(`pu.${nama} AS ${alias}`);
  };
  // status_putusan_nama kadang ada, kadang tidak - yang pasti ada nomornya.
  const kolomStatusNama = await sippSkemaService.pilihKolom("perkara_putusan", [
    "status_putusan_nama",
  ]);
  tambah(kolomStatusNama, "statusNama");
  tambah(kolom.statusPutusanId, "statusId");
  tambah(kolom.sumberHukumId, "sumberHukumId");
  tambah(kolom.amarPutusan, "amar");
  tambah(kolom.amarAnonimisasi, "amarAnonim");
  tambah(kolom.sumberHukum, "sumberHukumTeks");
  tambah(kolom.faktorPerceraianPrimer, "faktorPrimer");
  tambah(kolom.faktorPerceraianSekunder, "faktorSekunder");
  tambah(kolom.qoblaBada, "qoblaBada");
  tambah(kolom.statusNusyuz, "nusyuz");

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_putusan pu
      WHERE pu.perkara_id = ?
      ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
    [id]
  ).catch(() => []);

  const baris = rows[0];
  if (!baris) return { terbaca: true, alasan: "", ada: false };

  // Nama dari tabel rujukan didahulukan; teks pada perkara_putusan dipakai
  // bila rujukannya tidak terbaca.
  const [statusDariRujukan, sumberDariRujukan] = await Promise.all([
    namaRujukan(
      "status_putusan",
      kolom.rujukanStatusPutusanId,
      kolom.rujukanStatusPutusanNama,
      baris.statusId
    ),
    namaRujukan(
      "sumber_hukum",
      kolom.rujukanSumberHukumId,
      kolom.rujukanSumberHukumNama,
      baris.sumberHukumId
    ),
  ]);

  // Amar putusan panjang - dibawa utuh, dan layar yang memutuskan seberapa
  // banyak yang ditampilkan. Memotongnya di sini menghilangkan bagian yang
  // mungkin justru sedang dicari.
  return {
    terbaca: true,
    alasan: "",
    ada: true,
    tanggalPutusan: isoTanggal(baris.tanggalPutusan),
    statusPutusan: statusDariRujukan || cleanText(baris.statusNama),
    statusPutusanId: Number(baris.statusId) || null,
    amar: String(baris.amar || ""),
    amarAnonim: String(baris.amarAnonim || ""),
    sumberHukum: sumberDariRujukan || cleanText(baris.sumberHukumTeks),
    faktorPrimer: cleanText(baris.faktorPrimer),
    faktorSekunder: cleanText(baris.faktorSekunder),
    qoblaBada: cleanText(baris.qoblaBada),
    statusNusyuz: cleanText(baris.nusyuz),
  };
}

/**
 * Ikrar talak - hanya ada pada perkara cerai talak.
 *
 * ============================================================================
 * PERKARA BELUM SELESAI PADA TANGGAL PUTUSAN
 * ============================================================================
 *
 * Pada cerai talak, putusan hanya MEMBERI IZIN pemohon mengucapkan ikrar.
 * Perceraiannya baru terjadi saat ikrar itu diucapkan di depan sidang - dan
 * bila tidak diucapkan dalam enam bulan, putusannya kehilangan kekuatan.
 *
 * Karena itu bagian ini punya penetapan majelis, panitera pengganti, dan juru
 * sitanya sendiri: sidang ikrar talak adalah sidang tersendiri.
 */
const ARTI_STATUS_IKRAR = {
  1: "Terlaksana",
  2: "Tidak Mempunyai Kekuatan Hukum",
  3: "Rujuk/Damai",
};

function artiStatusIkrar(nomor) {
  const angka = Number(nomor);
  if (!Number.isFinite(angka)) return "";
  return ARTI_STATUS_IKRAR[angka] || "";
}

async function ikrarTalakPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", ada: false };

  if (!(await sippSkemaService.tabelAda("perkara_ikrar_talak"))) {
    return {
      terbaca: false,
      alasan: "Tabel perkara_ikrar_talak tidak ada pada SIPP versi ini.",
      ada: false,
    };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  const MEDAN = [
    { kunci: kolom.ikrarPenetapanMajelis, alias: "penetapanMajelis" },
    { kunci: kolom.ikrarMajelisText, alias: "majelis" },
    { kunci: kolom.ikrarPenetapanPp, alias: "penetapanPp" },
    { kunci: kolom.ikrarPpText, alias: "pp" },
    { kunci: kolom.ikrarPenetapanJs, alias: "penetapanJs" },
    { kunci: kolom.ikrarJsText, alias: "js" },
    { kunci: kolom.ikrarPenetapanSidang, alias: "penetapanSidang" },
    { kunci: kolom.ikrarSidangPertama, alias: "sidangPertama" },
    { kunci: kolom.ikrarTanggal, alias: "tanggalIkrar" },
    { kunci: kolom.ikrarAmar, alias: "amar" },
    { kunci: kolom.ikrarDokumen, alias: "dokumen" },
    { kunci: kolom.ikrarStatusId, alias: "statusId" },
    { kunci: kolom.ikrarNomorSk, alias: "nomorSk" },
  ].filter((x) => x.kunci);

  if (MEDAN.length === 0) {
    const adaKolom = await sippSkemaService.kolomTabel("perkara_ikrar_talak");
    return {
      terbaca: false,
      alasan: `Kolom ikrar talak belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
      kolomTersedia: adaKolom,
      ada: false,
    };
  }

  const kolomId = await sippSkemaService.pilihKolom("perkara_ikrar_talak", ["id"]);
  const pilihan = MEDAN.map((x) => `t.${x.kunci} AS ${x.alias}`);
  if (kolomId) pilihan.push(`t.${kolomId} AS ikrarId`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM perkara_ikrar_talak t
      WHERE t.perkara_id = ?
      ORDER BY ${kolomId ? `t.${kolomId}` : "t.perkara_id"} DESC
      LIMIT 5`,
    [id]
  ).catch(() => []);

  const baris = rows[0];
  if (!baris) return { terbaca: true, alasan: "", ada: false };

  const statusId = Number(baris.statusId);
  return {
    terbaca: true,
    alasan: "",
    ada: true,
    ikrarId: String(baris.ikrarId || ""),
    penetapanMajelis: isoTanggal(baris.penetapanMajelis),
    majelis: cleanText(baris.majelis),
    penetapanPp: isoTanggal(baris.penetapanPp),
    panitera: cleanText(baris.pp),
    penetapanJs: isoTanggal(baris.penetapanJs),
    jurusita: cleanText(baris.js),
    penetapanSidang: isoTanggal(baris.penetapanSidang),
    sidangPertama: isoTanggal(baris.sidangPertama),
    tanggalIkrar: isoTanggal(baris.tanggalIkrar),
    amar: String(baris.amar || ""),
    nomorSk: cleanText(baris.nomorSk),
    adaBerkas: Boolean(cleanText(baris.dokumen)),
    statusId: Number.isFinite(statusId) ? statusId : null,
    status: artiStatusIkrar(statusId),
    // Ikrar yang belum diucapkan belum menceraikan siapa pun - itu yang
    // paling perlu terlihat.
    sudahDiucapkan: Boolean(isoTanggal(baris.tanggalIkrar)),
  };
}
module.exports = {
  AMBANG_TUNDAAN_MAFQUD,
  dokumenRelaasPerkara,
  durasiMediasiPerkara,
  penilaianRelaasPerkara,
  petitumPerkara,
  penetapanKembaliPerkara,
  JUMLAH_TUNDAAN_MAFQUD,
  SEBUTAN_PENETAPAN,
  TAHAPAN_PUTUSAN,
  arsipKeteranganPerkara,
  kenaliJenisPenetapan,
  konseptorPutusanPerkara,
  namaPengguna,
  arsipPerkara,
  JENIS_DELEGASI_PANGGILAN,
  delegasiKeluarPerkara,
  nilaiTabayun,
  delegasiMasukPerkara,
  ARTI_STATUS_IKRAR,
  artiStatusIkrar,
  ikrarTalakPerkara,
  namaRujukan,
  putusanLengkapPerkara,
  selisihHariKerjaJumat,
  mafqudPerkara,
  ARTI_KEHADIRAN,
  pemberitahuanPutusanPerkara,
  dokumenPenetapanPerkara,
  delegasiPerkara,
  isoTanggal,
  mediasiPerkara,
  ARTI_HASIL_MEDIASI,
  artiHasilMediasi,
  jadwalMediasiPerkara,
  mediasiBerhasil,
  mediatorPerkara,
  mediasiLengkapPerkara,
  pemberitahuanPerkara,
  penandaPerkara,
  pihakPerkara,
  saksiLengkapPerkaraBaru,
  relaasBerinputPerkara,
  saksiLengkapPerkara,
  selisihHari,
  sisaPanjarPerkara,
  tahapanPerkara,
  unggahBasPerkara,
  unggahPutusanPerkara,
  upayaHukumPerkara,
};
