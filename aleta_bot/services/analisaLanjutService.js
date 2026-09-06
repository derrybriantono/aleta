"use strict";

/**
 * ============================================================================
 * ANALISIS LANJUTAN SATU PERKARA - DIMUAT SAAT DIMINTA, BUKAN SAAT DIBUKA
 * ============================================================================
 *
 * Sepuluh analisis yang masing-masing menjawab satu pertanyaan yang selama ini
 * dijawab dengan membuka SIPP, menyalin ke Excel, lalu menghitung sendiri.
 *
 * ============================================================================
 * MENGAPA TERPISAH DARI statusLengkap()
 * ============================================================================
 *
 * Layar Status Perkara sudah menjalankan tiga puluh satu kueri untuk satu
 * perkara. Menambahkan sepuluh analisis ke dalamnya - beberapa di antaranya
 * mengagregasi seluruh register - akan membuat MEMBUKA perkara menunggu
 * perhitungan yang mungkin tidak akan dilihat siapa pun.
 *
 * Karena itu tiap analisis berdiri sendiri, dipanggil dengan namanya, dan
 * hanya berjalan ketika tombolnya ditekan. Yang tidak ditekan tidak
 * membebani apa pun.
 *
 * ============================================================================
 * SATU BENTUK KELUARAN UNTUK SEPULUHNYA
 * ============================================================================
 *
 *     { ok, jenis, judul, ringkas, metrik[], kolom[], baris[], catatan }
 *
 * Bentuk yang sama membuat layarnya cukup satu perender kecil, bukan sepuluh
 * komponen - dan menambah analisis kesebelas nanti tidak menuntut satu baris
 * pun kode tampilan.
 *
 * Seluruh kueri di berkas ini SELECT. Tidak ada satu pun tulisan ke SIPP.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

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

/** Selisih hari antara dua tanggal, atau null bila salah satunya kosong. */
function selisihHari(dari, ke) {
  if (!dari || !ke) return null;
  const a = new Date(dari);
  const b = new Date(ke);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function angka(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

function rupiah(nilai) {
  return `Rp ${angka(nilai).toLocaleString("id-ID")}`;
}

/** Nilai tengah - lebih jujur daripada rata-rata saat ada perkara pencilan. */
function median(daftar) {
  const bersih = daftar.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (bersih.length === 0) return null;
  const tengah = Math.floor(bersih.length / 2);
  return bersih.length % 2 ? bersih[tengah] : Math.round((bersih[tengah - 1] + bersih[tengah]) / 2);
}

async function identitas(nomorPerkaraMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return null;

  const rows = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.alur_perkara_id AS alurPerkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar
       FROM perkara p WHERE p.nomor_perkara = ? ORDER BY p.perkara_id DESC LIMIT 1`,
    [nomorPerkara]
  );
  return rows[0] || null;
}

/* ==========================================================================
 * 1. KETEPATAN INPUT TIAP TAHAPAN
 * ==========================================================================
 *
 * perkara_proses menyimpan DUA tanggal: kapan peristiwanya terjadi, dan kapan
 * ia diketik ke SIPP. Selisih keduanya itulah yang dinilai SK Dirjen Badilag
 * 048/2024 - dan selama ini hanya terbaca satu per satu, tidak pernah sebagai
 * satu gambar utuh untuk satu perkara.
 */
async function ketepatanInput(id) {
  const rows = await runQuery(
    `SELECT pr.tahapan_nama AS tahapan,
            pr.proses_nama AS proses,
            pr.tanggal AS tanggalPeristiwa,
            pr.diinput_tanggal AS tanggalInput,
            pr.diinput_oleh AS oleh
       FROM perkara_proses pr
      WHERE pr.perkara_id = ?
      ORDER BY pr.tanggal ASC, pr.urutan ASC
      LIMIT 300`,
    [id]
  );

  const baris = rows.map((row) => {
    const peristiwa = isoTanggal(row.tanggalPeristiwa);
    const input = isoTanggal(row.tanggalInput);
    const jeda = selisihHari(peristiwa, input);
    return {
      tahapan: cleanText(row.tahapan) || cleanText(row.proses),
      tanggalPeristiwa: peristiwa,
      tanggalInput: input,
      // Negatif berarti diinput SEBELUM peristiwanya - biasanya penjadwalan
      // ke depan, bukan kelalaian. Ditandai nol supaya tidak menghukum.
      jedaHari: jeda === null ? null : Math.max(jeda, 0),
      oleh: cleanText(row.oleh),
    };
  });

  const jeda = baris.map((x) => x.jedaHari).filter((x) => x !== null);
  const samaHari = jeda.filter((x) => x === 0).length;
  const lewatTiga = jeda.filter((x) => x > 3).length;

  return {
    judul: "Ketepatan input tiap tahapan",
    ringkas:
      jeda.length === 0
        ? "Belum ada tahapan yang tercatat waktunya."
        : `${samaHari} dari ${jeda.length} tahapan diinput pada hari yang sama; ${lewatTiga} lewat tiga hari.`,
    metrik: [
      { label: "Tahapan tercatat", nilai: String(baris.length) },
      { label: "Diinput hari sama", nilai: String(samaHari) },
      { label: "Jeda terlama", nilai: jeda.length ? `${Math.max(...jeda)} hari` : "—" },
      { label: "Jeda tengah", nilai: median(jeda) === null ? "—" : `${median(jeda)} hari` },
    ],
    kolom: [
      { kunci: "tahapan", label: "Tahapan" },
      { kunci: "tanggalPeristiwa", label: "Terjadi" },
      { kunci: "tanggalInput", label: "Diinput" },
      { kunci: "jedaHari", label: "Jeda (hari)", angka: true },
      { kunci: "oleh", label: "Oleh" },
    ],
    baris,
    catatan:
      "Jeda dihitung dari tanggal peristiwa ke tanggal input. Input yang mendahului peristiwanya - lazim pada penjadwalan - dihitung nol, bukan negatif.",
  };
}

/* ==========================================================================
 * 2. BANDING DENGAN PERKARA SEJENIS
 * ==========================================================================
 *
 * "Perkara ini lama" tidak berarti apa-apa tanpa pembanding. Yang dibandingkan
 * perkara dengan JENIS yang sama di pengadilan yang sama - satu-satunya
 * pembanding yang adil.
 */
async function bandingSejenis(perkara) {
  const rows = await runQuery(
    `SELECT DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) AS hari
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_nama = ?
        AND pu.tanggal_putusan IS NOT NULL
        AND p.tanggal_pendaftaran IS NOT NULL
        AND DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) BETWEEN 0 AND 1000
      LIMIT 5000`,
    [perkara.jenisPerkara]
  );

  const hari = rows.map((x) => angka(x.hari)).filter((x) => x > 0);
  const nilaiTengah = median(hari);

  const sendiri = await runQuery(
    `SELECT pu.tanggal_putusan AS putus FROM perkara_putusan pu
      WHERE pu.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
    [perkara.perkaraId]
  );

  const tanggalPutus = isoTanggal(sendiri[0] && sendiri[0].putus);
  const hariSendiri = tanggalPutus
    ? selisihHari(isoTanggal(perkara.tanggalDaftar), tanggalPutus)
    : selisihHari(isoTanggal(perkara.tanggalDaftar), isoTanggal(new Date()));

  // Peringkat persentil: berapa persen perkara sejenis yang selesai LEBIH
  // CEPAT daripada perkara ini.
  const lebihCepat = hari.filter((x) => x < angka(hariSendiri)).length;
  const persentil = hari.length > 0 ? Math.round((lebihCepat / hari.length) * 100) : null;

  return {
    judul: `Banding dengan perkara ${perkara.jenisPerkara || "sejenis"}`,
    ringkas:
      nilaiTengah === null
        ? "Belum ada perkara sejenis yang sudah putus untuk dibandingkan."
        : tanggalPutus
          ? `Selesai dalam ${hariSendiri} hari; nilai tengah perkara sejenis ${nilaiTengah} hari.`
          : `Sudah berjalan ${hariSendiri} hari; nilai tengah perkara sejenis selesai ${nilaiTengah} hari.`,
    metrik: [
      { label: "Perkara ini", nilai: hariSendiri === null ? "—" : `${hariSendiri} hari` },
      { label: "Nilai tengah sejenis", nilai: nilaiTengah === null ? "—" : `${nilaiTengah} hari` },
      { label: "Tercepat", nilai: hari.length ? `${Math.min(...hari)} hari` : "—" },
      { label: "Terlama", nilai: hari.length ? `${Math.max(...hari)} hari` : "—" },
      {
        label: "Pembanding",
        nilai: `${hari.length} perkara`,
        keterangan: "perkara sejenis yang sudah putus",
      },
    ],
    kolom: [],
    baris: [],
    catatan:
      persentil === null
        ? "Tidak ada pembanding."
        : tanggalPutus
          ? `${persentil}% perkara sejenis selesai lebih cepat daripada perkara ini.`
          : `Bila diputus hari ini, ${persentil}% perkara sejenis akan selesai lebih cepat.`,
  };
}

/* ==========================================================================
 * 3. KINERJA MAJELIS YANG MENANGANI
 * ========================================================================== */
async function kinerjaMajelis(id) {
  const hakim = await runQuery(
    `SELECT hk.hakim_id AS hakimId, hk.hakim_nama AS nama, hk.jabatan_hakim_id AS jabatan
       FROM perkara_hakim_pn hk WHERE hk.perkara_id = ? ORDER BY hk.jabatan_hakim_id ASC LIMIT 10`,
    [id]
  );

  const baris = [];
  for (const satu of hakim) {
    const idHakim = Number(satu.hakimId);
    if (!Number.isFinite(idHakim) || idHakim <= 0) continue;

    const ringkas = await runQuery(
      `SELECT COUNT(*) AS jumlah,
              SUM(CASE WHEN pu.tanggal_putusan IS NULL THEN 1 ELSE 0 END) AS berjalan,
              AVG(CASE WHEN pu.tanggal_putusan IS NOT NULL
                       THEN DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) END) AS rerata,
              SUM(CASE WHEN pu.tanggal_putusan IS NULL
                        AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
                       THEN 1 ELSE 0 END) AS lewatLima
         FROM perkara_hakim_pn hk
         JOIN perkara p ON p.perkara_id = hk.perkara_id
         LEFT JOIN (SELECT perkara_id, MAX(tanggal_putusan) AS tanggal_putusan
                      FROM perkara_putusan GROUP BY perkara_id) pu
                ON pu.perkara_id = p.perkara_id
        WHERE hk.hakim_id = ?`,
      [idHakim]
    ).catch(() => []);

    const r = ringkas[0] || {};
    baris.push({
      nama: cleanText(satu.nama),
      kedudukan: Number(satu.jabatan) === 1 ? "Ketua Majelis" : "Anggota",
      jumlah: angka(r.jumlah),
      berjalan: angka(r.berjalan),
      rerata: r.rerata === null || r.rerata === undefined ? null : Math.round(angka(r.rerata)),
      lewatLima: angka(r.lewatLima),
    });
  }

  const totalLewat = baris.reduce((jumlah, x) => jumlah + x.lewatLima, 0);

  return {
    judul: "Beban dan kecepatan majelis",
    ringkas:
      baris.length === 0
        ? "Majelis belum tercatat pada perkara ini."
        : `${baris.length} hakim; ${totalLewat} perkara mereka belum putus melewati lima bulan.`,
    metrik: [
      { label: "Hakim", nilai: String(baris.length) },
      {
        label: "Perkara berjalan",
        nilai: String(baris.reduce((j, x) => j + x.berjalan, 0)),
      },
      { label: "Lewat 5 bulan", nilai: String(totalLewat), keterangan: "ambang SEMA 2/2014" },
    ],
    kolom: [
      { kunci: "nama", label: "Hakim" },
      { kunci: "kedudukan", label: "Kedudukan" },
      { kunci: "jumlah", label: "Total perkara", angka: true },
      { kunci: "berjalan", label: "Berjalan", angka: true },
      { kunci: "rerata", label: "Rerata selesai (hari)", angka: true },
      { kunci: "lewatLima", label: "Lewat 5 bulan", angka: true },
    ],
    baris,
    catatan:
      "Dihitung dari seluruh perkara yang pernah ditangani hakim bersangkutan di pengadilan ini, bukan hanya tahun berjalan.",
  };
}

/* ==========================================================================
 * 4. RIWAYAT PARA PIHAK
 * ==========================================================================
 *
 * Apakah orang ini pernah berperkara di sini sebelumnya? Pertanyaan yang
 * menentukan saat memeriksa gugatan berulang, dan yang selama ini hanya dapat
 * dijawab dengan mencari satu per satu.
 */
/**
 * Hasil akhir sebuah perkara, ditentukan dari TANGGALNYA lebih dulu.
 *
 * status_putusan_nama kosong pada sebagian besar baris - 9.470 dari 9.989 di
 * pengadilan ini. Menyimpulkan "belum putus" darinya akan menyebut perkara
 * yang sudah lama diputus sebagai masih berjalan.
 */
function hasilPerkara(row) {
  if (isoTanggal(row.tanggalCabut)) return { hasil: "Dicabut", selesai: true };
  if (isoTanggal(row.tanggalGugur)) return { hasil: "Gugur", selesai: true };

  const nama = cleanText(row.statusPutusan);
  const putus = isoTanggal(row.tanggalPutusan);
  if (nama) return { hasil: nama, selesai: true };
  if (putus) return { hasil: "Putus", selesai: true };
  return { hasil: "Masih berjalan", selesai: false };
}

/** Kedudukan pihak pada sebuah perkara. */
function sebutKedudukan(pihakKe) {
  if (Number(pihakKe) === 1) return "Penggugat/Pemohon";
  if (Number(pihakKe) === 2) return "Tergugat/Termohon";
  return "Pihak lain";
}

/**
 * ============================================================================
 * MENGENALI PIHAK LINTAS PERKARA - TIGA TINGKAT KEPASTIAN
 * ============================================================================
 *
 * Nama yang sama BUKAN orang yang sama. Di register ini ada banyak nama
 * berulang, dan menyimpulkan orang dari namanya saja akan menuduh orang
 * pernah berperkara padahal tidak.
 *
 * Karena itu dicocokkan bertingkat, dan tingkatnya DISEBUTKAN pada tiap
 * temuan supaya pembacanya tahu seberapa jauh boleh percaya:
 *
 *   1. NIK        nomor induk kependudukan 16 angka - hampir pasti
 *   2. Nama+lahir nama persis dan tanggal lahir sama - sangat mungkin
 *   3. Nama saja  hanya namanya - perlu diperiksa sendiri
 *
 * Diukur pada data pengadilan ini: 11.912 dari 36.380 pihak punya NIK 16
 * angka, 34.962 punya tanggal lahir, dan 737 NIK muncul di lebih dari satu
 * perkara. Tingkat 1 dan 2 karena itu menjangkau sebagian besar; tingkat 3
 * disediakan untuk sisanya, dengan peringatannya sendiri.
 *
 * nama_ibu TIDAK dipakai walaupun kolomnya ada: seluruh 36.380 barisnya
 * kosong di pengadilan ini.
 */
async function riwayatPihak(perkara) {
  const pihak = await runQuery(
    `SELECT ph.id AS pihakId,
            ph.nama AS nama,
            ph.nomor_indentitas AS nik,
            ph.tanggal_lahir AS tanggalLahir,
            ph.alamat AS alamat,
            vp.pihak_ke AS pihakKe
       FROM v_pihak_perkara vp
       JOIN pihak ph ON ph.id = vp.pihak_id
      WHERE vp.perkara_id = ?
      LIMIT 20`,
    [perkara.perkaraId]
  ).catch(() => []);

  const baris = [];
  const sudah = new Set();

  const catat = (asal, temuan, tingkat) => {
    const kunci = `${asal.pihakId}|${temuan.perkaraId}`;
    // Satu perkara satu baris per pihak. Tingkat yang lebih pasti dicatat
    // lebih dulu, jadi yang datang belakangan memang boleh dilewati.
    if (sudah.has(kunci)) return;
    sudah.add(kunci);

    const { hasil } = hasilPerkara(temuan);
    baris.push({
      nama: cleanText(asal.nama),
      diPerkaraIni: sebutKedudukan(asal.pihakKe),
      nomorPerkara: cleanText(temuan.nomorPerkara),
      jenisPerkara: cleanText(temuan.jenisPerkara),
      tanggalDaftar: isoTanggal(temuan.tanggalDaftar),
      kedudukan: sebutKedudukan(temuan.pihakKe),
      hasil,
      verstek: cleanText(temuan.verstek).toUpperCase() === "Y" ? "ya" : "",
      dicocokkan: tingkat,
    });
  };

  /**
   * Satu kueri harfiah untuk ketiga tingkat pencocokan.
   *
   * Yang berbeda antar tingkat hanya SYARAT-nya, jadi hanya itu yang
   * diserahkan sebagai argumen. Kuerinya sendiri ditulis harfiah dimulai
   * SELECT - verify-pemisahan-database.js memeriksanya secara statis, dan
   * kueri yang disusun dari peubah tidak dapat lagi ia baca.
   */
  const cariPihak = (syarat, params) =>
    runQuery(
      `SELECT vp.perkara_id AS perkaraId,
            vp.pihak_ke AS pihakKe,
            pk.nomor_perkara AS nomorPerkara,
            pk.jenis_perkara_nama AS jenisPerkara,
            pk.tanggal_pendaftaran AS tanggalDaftar,
            pu.tanggal_putusan AS tanggalPutusan,
            pu.tanggal_cabut AS tanggalCabut,
            pu.tanggal_gugur AS tanggalGugur,
            pu.status_putusan_nama AS statusPutusan,
            pu.putusan_verstek AS verstek
       FROM pihak ph
       JOIN v_pihak_perkara vp ON vp.pihak_id = ph.id
       JOIN perkara pk ON pk.perkara_id = vp.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = pk.perkara_id
      WHERE ${syarat}
      ORDER BY pk.tanggal_pendaftaran DESC
      LIMIT 30`,
      params
    ).catch(() => []);

  for (const satu of pihak) {
    const nama = cleanText(satu.nama);
    const nik = cleanText(satu.nik);
    const lahir = isoTanggal(satu.tanggalLahir);

    // --- tingkat 1: NIK ---
    if (/^[0-9]{16}$/.test(nik)) {
      const temuan = await cariPihak(
        "ph.nomor_indentitas = ? AND vp.perkara_id <> ?",
        [nik, perkara.perkaraId]
      );
      for (const t of temuan) catat(satu, t, "NIK");
    }

    // --- tingkat 2: nama dan tanggal lahir ---
    if (nama.length >= 4 && lahir) {
      const temuan = await cariPihak(
        "ph.nama = ? AND ph.tanggal_lahir = ? AND vp.perkara_id <> ?",
        [nama, lahir, perkara.perkaraId]
      );
      for (const t of temuan) catat(satu, t, "nama + tanggal lahir");
    }

    // --- tingkat 3: nama saja ---
    if (nama.length >= 5) {
      const temuan = await cariPihak(
        "ph.nama = ? AND vp.perkara_id <> ?",
        [nama, perkara.perkaraId]
      );
      for (const t of temuan) catat(satu, t, "nama saja");
    }
  }

  // --- pernah menjadi saksi ---
  //
  // Dibaca dari perkara_pihak5 - DAFTAR saksinya - bukan dari
  // perkara_keterangan_saksi yang menyimpan tanya-jawab pemeriksaan dan di
  // pengadilan ini baru berisi empat baris untuk seluruh register.
  //
  // Dicocokkan bertingkat sama seperti pencocokan pihak di atas: satu orang
  // dapat punya beberapa baris `pihak` yang berbeda pada perkara yang
  // berbeda, sehingga mencocokkan pihak_id saja melewatkan sebagian besar.
  const cariSaksi = (syarat, params) =>
    runQuery(
      `SELECT DISTINCT p5.perkara_id AS perkaraId,
              pk.nomor_perkara AS nomorPerkara,
              pk.jenis_perkara_nama AS jenisPerkara,
              pk.tanggal_pendaftaran AS tanggalDaftar,
              p5.nama AS namaSaksi
         FROM perkara_pihak5 p5
         JOIN pihak ph ON ph.id = p5.pihak_id
         JOIN perkara pk ON pk.perkara_id = p5.perkara_id
        WHERE ${syarat}
        ORDER BY pk.tanggal_pendaftaran DESC
        LIMIT 30`,
      params
    ).catch(() => []);

  const saksi = [];
  const saksiTerlihat = new Set();

  const catatSaksi = (rows, asal, tingkat) => {
    for (const row of rows) {
      const kunci = String(row.perkaraId || "");
      if (!kunci || kunci === String(perkara.perkaraId)) continue;
      if (saksiTerlihat.has(kunci)) continue;
      saksiTerlihat.add(kunci);
      saksi.push({ ...row, namaAsal: cleanText(asal.nama), tingkat });
    }
  };

  for (const satu of pihak) {
    const nama = cleanText(satu.nama);
    const nik = cleanText(satu.nik);
    const lahir = isoTanggal(satu.tanggalLahir);
    const idOrang = Number(satu.pihakId);

    if (Number.isFinite(idOrang) && idOrang > 0) {
      catatSaksi(await cariSaksi("p5.pihak_id = ?", [idOrang]), satu, "id pihak");
    }
    if (/^[0-9]{16}$/.test(nik)) {
      catatSaksi(await cariSaksi("ph.nomor_indentitas = ?", [nik]), satu, "NIK");
    }
    if (nama.length >= 4 && lahir) {
      catatSaksi(
        await cariSaksi("ph.nama = ? AND ph.tanggal_lahir = ?", [nama, lahir]),
        satu,
        "nama + tanggal lahir"
      );
    }
  }

  for (const satu of saksi) {
    baris.push({
      nama: satu.namaAsal || cleanText(satu.namaSaksi),
      diPerkaraIni: "-",
      nomorPerkara: cleanText(satu.nomorPerkara),
      jenisPerkara: cleanText(satu.jenisPerkara),
      tanggalDaftar: isoTanggal(satu.tanggalDaftar),
      kedudukan: "Saksi",
      hasil: "-",
      verstek: "",
      dicocokkan: satu.tingkat,
    });
  }

  // --- ringkasan hasil perkara sebelumnya ---
  const hitung = (kata) => baris.filter((x) => new RegExp(kata, "i").test(x.hasil)).length;
  const pasti = baris.filter((x) => x.dicocokkan === "NIK").length;
  const perluDiperiksa = baris.filter((x) => x.dicocokkan === "nama saja").length;

  return {
    judul: "Riwayat para pihak di pengadilan ini",
    ringkas:
      baris.length === 0
        ? "Tidak ada perkara lain atas nama atau identitas para pihak ini."
        : `${baris.length} perkara lain melibatkan pihak yang sama; ${pasti} di antaranya cocok lewat NIK.`,
    metrik: [
      { label: "Pihak diperiksa", nilai: String(pihak.length) },
      { label: "Perkara lain", nilai: String(baris.length) },
      { label: "Dikabulkan", nilai: String(hitung("dikabulkan")) },
      { label: "Ditolak", nilai: String(hitung("ditolak")) },
      { label: "Dicabut", nilai: String(hitung("dicabut")) },
      { label: "Gugur", nilai: String(hitung("gugur")) },
      { label: "Masih berjalan", nilai: String(hitung("berjalan")) },
      {
        label: "Pernah jadi saksi",
        nilai: String(saksi.length),
        keterangan: "dari daftar saksi perkara",
      },
    ],
    kolom: [
      { kunci: "nama", label: "Nama" },
      { kunci: "diPerkaraIni", label: "Di perkara ini" },
      { kunci: "nomorPerkara", label: "Perkara lain" },
      { kunci: "kedudukan", label: "Di sana sebagai" },
      { kunci: "hasil", label: "Hasilnya" },
      { kunci: "verstek", label: "Verstek" },
      { kunci: "tanggalDaftar", label: "Didaftarkan" },
      { kunci: "dicocokkan", label: "Dicocokkan dari" },
    ],
    baris,
    catatan:
      perluDiperiksa > 0
        ? `${perluDiperiksa} temuan hanya cocok dari NAMA. Nama yang sama belum tentu orang yang sama - periksa alamat, tanggal lahir, dan identitasnya sebelum menyimpulkan apa pun.`
        : "Seluruh temuan cocok lewat NIK atau nama beserta tanggal lahirnya.",
  };
}

/**
 * ============================================================================
 * PASANGAN PIHAK YANG SAMA - PENANDA NEBIS IN IDEM
 * ============================================================================
 *
 * Bukan sekadar apakah salah satu pihak pernah berperkara, melainkan apakah
 * KEDUA BELAH PIHAK YANG SAMA pernah berhadapan sebelumnya. Itu pertanyaan
 * yang berbeda dan jauh lebih menentukan: perkara yang sama antara pihak yang
 * sama dengan pokok yang sama tidak dapat diadili dua kali.
 *
 * Yang dijawab di sini PENANDA, bukan kesimpulan. Menyimpulkan nebis in idem
 * menuntut pemeriksaan pokok perkaranya, dan itu pekerjaan hakim - bukan
 * pekerjaan kueri.
 */
async function pasanganPihak(perkara) {
  const pihak = await runQuery(
    `SELECT ph.id AS pihakId, ph.nama AS nama, ph.nomor_indentitas AS nik,
            ph.tanggal_lahir AS tanggalLahir, vp.pihak_ke AS pihakKe
       FROM v_pihak_perkara vp
       JOIN pihak ph ON ph.id = vp.pihak_id
      WHERE vp.perkara_id = ?
      LIMIT 20`,
    [perkara.perkaraId]
  ).catch(() => []);

  const penggugat = pihak.filter((x) => Number(x.pihakKe) === 1);
  const tergugat = pihak.filter((x) => Number(x.pihakKe) === 2);

  if (penggugat.length === 0 || tergugat.length === 0) {
    return {
      judul: "Pasangan pihak yang sama",
      ringkas: "Perkara ini tidak berbentuk dua pihak berhadapan.",
      metrik: [],
      kolom: [],
      baris: [],
      catatan: "Permohonan tanpa lawan tidak dapat diperiksa nebis in idem-nya dengan cara ini.",
    };
  }

  /** Perkara mana saja yang pernah memuat orang ini. */
  const perkaraDari = async (orang) => {
    const nik = cleanText(orang.nik);
    const nama = cleanText(orang.nama);
    const lahir = isoTanggal(orang.tanggalLahir);

    const kumpul = new Set();
    const tambah = (rows) => {
      for (const r of rows) kumpul.add(String(r.perkaraId || ""));
    };

    if (/^[0-9]{16}$/.test(nik)) {
      tambah(
        await runQuery(
          `SELECT vp.perkara_id AS perkaraId FROM pihak ph
             JOIN v_pihak_perkara vp ON vp.pihak_id = ph.id
            WHERE ph.nomor_indentitas = ? LIMIT 100`,
          [nik]
        ).catch(() => [])
      );
    }
    if (nama.length >= 4 && lahir) {
      tambah(
        await runQuery(
          `SELECT vp.perkara_id AS perkaraId FROM pihak ph
             JOIN v_pihak_perkara vp ON vp.pihak_id = ph.id
            WHERE ph.nama = ? AND ph.tanggal_lahir = ? LIMIT 100`,
          [nama, lahir]
        ).catch(() => [])
      );
    }
    return kumpul;
  };

  const kumpulanPenggugat = new Set();
  for (const orang of penggugat) {
    for (const id of await perkaraDari(orang)) kumpulanPenggugat.add(id);
  }

  const bersama = new Set();
  for (const orang of tergugat) {
    for (const id of await perkaraDari(orang)) {
      if (kumpulanPenggugat.has(id) && id !== String(perkara.perkaraId)) bersama.add(id);
    }
  }

  const daftar = [...bersama];
  let baris = [];
  if (daftar.length > 0) {
    const isian = daftar.map(() => "?").join(", ");
    const rows = await runQuery(
      `SELECT pk.nomor_perkara AS nomorPerkara,
              pk.jenis_perkara_nama AS jenisPerkara,
              pk.tanggal_pendaftaran AS tanggalDaftar,
              pu.tanggal_putusan AS tanggalPutusan,
              pu.tanggal_cabut AS tanggalCabut,
              pu.tanggal_gugur AS tanggalGugur,
              pu.status_putusan_nama AS statusPutusan
         FROM perkara pk
         LEFT JOIN perkara_putusan pu ON pu.perkara_id = pk.perkara_id
        WHERE pk.perkara_id IN (${isian})
        ORDER BY pk.tanggal_pendaftaran DESC
        LIMIT 50`,
      daftar
    ).catch(() => []);

    baris = rows.map((row) => ({
      nomorPerkara: cleanText(row.nomorPerkara),
      jenisPerkara: cleanText(row.jenisPerkara),
      tanggalDaftar: isoTanggal(row.tanggalDaftar),
      hasil: hasilPerkara(row).hasil,
    }));
  }

  return {
    judul: "Pasangan pihak yang sama",
    ringkas:
      baris.length === 0
        ? "Kedua belah pihak ini belum pernah berhadapan di pengadilan ini."
        : `Kedua belah pihak pernah berhadapan pada ${baris.length} perkara lain.`,
    metrik: [
      { label: "Penggugat/Pemohon", nilai: String(penggugat.length) },
      { label: "Tergugat/Termohon", nilai: String(tergugat.length) },
      { label: "Perkara bersama", nilai: String(baris.length) },
    ],
    kolom: [
      { kunci: "nomorPerkara", label: "Perkara" },
      { kunci: "jenisPerkara", label: "Jenis" },
      { kunci: "tanggalDaftar", label: "Didaftarkan" },
      { kunci: "hasil", label: "Hasilnya" },
    ],
    baris,
    catatan:
      baris.length === 0
        ? "Dicocokkan lewat NIK dan nama beserta tanggal lahir. Pihak tanpa kedua keterangan itu tidak terjangkau."
        : "Ini PENANDA, bukan kesimpulan. Nebis in idem menuntut pokok perkara dan petitumnya juga sama - itu pemeriksaan hakim, bukan pekerjaan kueri.",
  };
}

/* ==========================================================================
 * 5. ANALISA PEMANGGILAN
 * ========================================================================== */
async function analisaPanggilan(id) {
  const rows = await runQuery(
    `SELECT r.ket_temu AS ketTemu,
            r.status_pos AS statusPos,
            r.tanggal_relaas AS tanggalRelaas,
            r.ket_hasil_relaas AS hasil,
            sd.tanggal_sidang AS tanggalSidang,
            COALESCE(pk.nama, vp.nama) AS namaPihak,
            jm.nama AS jurusita
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN perkara_jadwal_sidang sd ON sd.id = r.sidang_id
       LEFT JOIN pihak pk ON pk.id = r.pihak_id
       LEFT JOIN v_pihak_perkara vp ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
       LEFT JOIN jurusita jm ON jm.id = r.jurusita_id
      WHERE r.perkara_id = ?
      ORDER BY sd.tanggal_sidang ASC, r.tanggal_relaas ASC
      LIMIT 200`,
    [id]
  );

  const CARA = {
    Y: "bertemu langsung",
    S: "gagal",
    T: "lewat kantor desa",
    E: "elektronik ke kuasa",
    R: "panggilan RRI",
    M: "radiogram RRI",
    W: "website dan pengumuman",
    P: "papan pengumuman",
  };

  const baris = rows.map((row) => {
    const relaas = isoTanggal(row.tanggalRelaas);
    const sidang = isoTanggal(row.tanggalSidang);
    return {
      namaPihak: cleanText(row.namaPihak),
      tanggalRelaas: relaas,
      tanggalSidang: sidang,
      // Tenggang panggilan: Pasal 122 HIR menuntut sekurang-kurangnya tiga
      // hari kerja antara panggilan dan sidang.
      tenggangHari: selisihHari(relaas, sidang),
      cara: CARA[cleanText(row.ketTemu).toUpperCase()] || cleanText(row.ketTemu),
      retur: angka(row.statusPos) === 2 || /retur/i.test(cleanText(row.hasil)),
      jurusita: cleanText(row.jurusita),
    };
  });

  const retur = baris.filter((x) => x.retur).length;
  const kurangTiga = baris.filter((x) => x.tenggangHari !== null && x.tenggangHari < 3).length;
  const tenggang = baris.map((x) => x.tenggangHari).filter((x) => x !== null && x >= 0);

  return {
    judul: "Analisa pemanggilan",
    ringkas:
      baris.length === 0
        ? "Belum ada relaas tercatat."
        : `${baris.length} relaas; ${retur} retur; ${kurangTiga} berselang kurang dari tiga hari sebelum sidang.`,
    metrik: [
      { label: "Relaas", nilai: String(baris.length) },
      { label: "Retur", nilai: String(retur) },
      {
        label: "Tenggang kurang 3 hari",
        nilai: String(kurangTiga),
        keterangan: "Pasal 122 HIR",
      },
      { label: "Tenggang tengah", nilai: median(tenggang) === null ? "—" : `${median(tenggang)} hari` },
    ],
    kolom: [
      { kunci: "namaPihak", label: "Pihak" },
      { kunci: "tanggalRelaas", label: "Relaas" },
      { kunci: "tanggalSidang", label: "Untuk sidang" },
      { kunci: "tenggangHari", label: "Tenggang (hari)", angka: true },
      { kunci: "cara", label: "Cara" },
      { kunci: "jurusita", label: "Juru sita" },
    ],
    baris,
    catatan:
      "Tenggang dihitung hari kalender, bukan hari kerja - angka di bawah tiga perlu diperiksa terhadap hari liburnya.",
  };
}

/* ==========================================================================
 * 6. PRAKIRAAN WAKTU SELESAI
 * ==========================================================================
 *
 * Bukan ramalan: sebaran perkara sejenis yang SUDAH selesai, diterapkan pada
 * perkara yang sedang berjalan. Yang disebut rentangnya, bukan satu tanggal -
 * satu tanggal akan dipercaya lebih daripada yang pantas.
 */
async function prakiraanSelesai(perkara) {
  const sudahPutus = await runQuery(
    `SELECT MAX(pu.tanggal_putusan) AS putus FROM perkara_putusan pu WHERE pu.perkara_id = ?`,
    [perkara.perkaraId]
  );
  const tanggalPutus = isoTanggal(sudahPutus[0] && sudahPutus[0].putus);

  if (tanggalPutus) {
    return {
      judul: "Prakiraan waktu selesai",
      ringkas: `Perkara ini sudah diputus pada ${tanggalPutus}.`,
      metrik: [{ label: "Tanggal putusan", nilai: tanggalPutus }],
      kolom: [],
      baris: [],
      catatan: "Prakiraan hanya berlaku untuk perkara yang masih berjalan.",
    };
  }

  const rows = await runQuery(
    `SELECT DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) AS hari
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_nama = ?
        AND pu.tanggal_putusan IS NOT NULL
        AND DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) BETWEEN 1 AND 1000
      LIMIT 5000`,
    [perkara.jenisPerkara]
  );

  const hari = rows.map((x) => angka(x.hari)).sort((a, b) => a - b);
  if (hari.length < 10) {
    return {
      judul: "Prakiraan waktu selesai",
      ringkas: "Pembandingnya terlalu sedikit untuk memperkirakan apa pun.",
      metrik: [{ label: "Pembanding", nilai: `${hari.length} perkara` }],
      kolom: [],
      baris: [],
      catatan: "Diperlukan sekurang-kurangnya sepuluh perkara sejenis yang sudah putus.",
    };
  }

  const persentil = (p) => hari[Math.min(hari.length - 1, Math.floor((p / 100) * hari.length))];
  const daftar = isoTanggal(perkara.tanggalDaftar);
  const tambahHari = (mulai, n) => {
    const t = new Date(mulai);
    if (Number.isNaN(t.getTime())) return "";
    t.setDate(t.getDate() + n);
    return isoTanggal(t);
  };

  const sudahBerjalan = selisihHari(daftar, isoTanggal(new Date()));

  return {
    judul: "Prakiraan waktu selesai",
    ringkas: `Sudah berjalan ${sudahBerjalan} hari. Setengah perkara sejenis selesai dalam ${persentil(50)} hari.`,
    metrik: [
      { label: "Sudah berjalan", nilai: `${sudahBerjalan} hari` },
      { label: "Cepat (25%)", nilai: tambahHari(daftar, persentil(25)) },
      { label: "Tengah (50%)", nilai: tambahHari(daftar, persentil(50)) },
      { label: "Lambat (75%)", nilai: tambahHari(daftar, persentil(75)) },
      { label: "Ambang SEMA", nilai: tambahHari(daftar, 150), keterangan: "5 bulan" },
    ],
    kolom: [],
    baris: [],
    catatan: `Dihitung dari sebaran ${hari.length} perkara ${perkara.jenisPerkara} yang sudah putus di pengadilan ini. Ini gambaran kebiasaan, bukan janji - perkara dengan pihak ghaib atau saksi banyak lazimnya lebih lama.`,
  };
}

/* ==========================================================================
 * 7. PETA BIAYA PERKARA
 * ========================================================================== */
async function petaBiaya(id) {
  const rows = await runQuery(
    `SELECT b.jenis_transaksi AS jenisTransaksi,
            b.tanggal_transaksi AS tanggal,
            b.uraian AS uraian,
            b.jumlah AS jumlah,
            b.sisa AS sisa
       FROM perkara_biaya b
      WHERE b.perkara_id = ?
      ORDER BY b.tanggal_transaksi ASC, b.id ASC
      LIMIT 200`,
    [id]
  );

  let masuk = 0;
  let keluar = 0;
  const baris = rows.map((row) => {
    const jumlah = angka(row.jumlah);
    // jenis_transaksi 1 penerimaan (panjar), selain itu pengeluaran.
    const penerimaan = angka(row.jenisTransaksi) === 1;
    if (penerimaan) masuk += jumlah;
    else keluar += jumlah;
    return {
      tanggal: isoTanggal(row.tanggal),
      uraian: cleanText(row.uraian),
      arah: penerimaan ? "masuk" : "keluar",
      jumlah: rupiah(jumlah),
      sisa: rupiah(row.sisa),
    };
  });

  const sisa = masuk - keluar;

  return {
    judul: "Peta biaya perkara",
    ringkas:
      rows.length === 0
        ? "Belum ada transaksi biaya tercatat."
        : `Panjar ${rupiah(masuk)}, terpakai ${rupiah(keluar)}, sisa ${rupiah(sisa)}.`,
    metrik: [
      { label: "Panjar diterima", nilai: rupiah(masuk) },
      { label: "Terpakai", nilai: rupiah(keluar) },
      { label: "Sisa", nilai: rupiah(sisa) },
      { label: "Transaksi", nilai: String(rows.length) },
    ],
    kolom: [
      { kunci: "tanggal", label: "Tanggal" },
      { kunci: "uraian", label: "Uraian" },
      { kunci: "arah", label: "Arah" },
      { kunci: "jumlah", label: "Jumlah" },
    ],
    baris,
    catatan:
      sisa < 0
        ? "Pengeluaran melampaui panjar - perlu penambahan panjar sebelum panggilan berikutnya."
        : "Sisa panjar dikembalikan kepada pihak setelah perkara berkekuatan hukum tetap.",
  };
}

/* ==========================================================================
 * 8. POLA PENUNDAAN
 * ========================================================================== */
async function polaPenundaan(id) {
  const rows = await runQuery(
    `SELECT j.tanggal_sidang AS tanggalSidang,
            j.agenda AS agenda,
            j.alasan_ditunda AS alasan
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ?
      ORDER BY j.tanggal_sidang ASC
      LIMIT 100`,
    [id]
  ).catch(() => []);

  const baris = [];
  let sebelumnya = "";
  let totalJeda = 0;

  for (const row of rows) {
    const tanggal = isoTanggal(row.tanggalSidang);
    const jeda = sebelumnya ? selisihHari(sebelumnya, tanggal) : null;
    if (jeda !== null) totalJeda += jeda;
    baris.push({
      tanggalSidang: tanggal,
      agenda: cleanText(row.agenda),
      alasan: cleanText(row.alasan),
      jedaHari: jeda,
    });
    sebelumnya = tanggal;
  }

  const ditunda = baris.filter((x) => x.alasan).length;
  const jedaAda = baris.map((x) => x.jedaHari).filter((x) => x !== null);

  return {
    judul: "Pola penundaan dan jeda sidang",
    ringkas:
      baris.length === 0
        ? "Belum ada sidang terjadwal."
        : `${baris.length} sidang, ${ditunda} bertuliskan alasan penundaan, rentang seluruhnya ${totalJeda} hari.`,
    metrik: [
      { label: "Sidang", nilai: String(baris.length) },
      { label: "Dengan alasan tunda", nilai: String(ditunda) },
      { label: "Jeda tengah", nilai: median(jedaAda) === null ? "—" : `${median(jedaAda)} hari` },
      { label: "Jeda terpanjang", nilai: jedaAda.length ? `${Math.max(...jedaAda)} hari` : "—" },
    ],
    kolom: [
      { kunci: "tanggalSidang", label: "Sidang" },
      { kunci: "agenda", label: "Agenda" },
      { kunci: "jedaHari", label: "Jeda dari sidang sebelumnya", angka: true },
      { kunci: "alasan", label: "Alasan penundaan" },
    ],
    baris,
    catatan:
      "Jeda dua minggu adalah kebiasaan; jeda yang jauh lebih panjang biasanya menandakan pemanggilan ulang atau menunggu pihak ghaib.",
  };
}

/* ==========================================================================
 * 9. KELENGKAPAN E-COURT
 * ========================================================================== */
async function kelengkapanEcourt(perkara) {
  const efiling = await runQuery(
    `SELECT 1 AS ada FROM perkara_efiling_id k WHERE k.perkara_id = ? LIMIT 1`,
    [perkara.perkaraId]
  ).catch(() => []);

  const dokumen = await runQuery(
    `SELECT pu.amar_putusan_dok AS amarDok,
            pu.amar_putusan_anonimisasi_dok AS anonimDok,
            pu.tanggal_putusan AS tanggalPutusan
       FROM perkara_putusan pu WHERE pu.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
    [perkara.perkaraId]
  ).catch(() => []);

  const relaas = await runQuery(
    `SELECT COUNT(*) AS jumlah,
            SUM(CASE WHEN r.doc_relaas IS NOT NULL AND r.doc_relaas <> '' THEN 1 ELSE 0 END) AS berdokumen
       FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = ?`,
    [perkara.perkaraId]
  ).catch(() => []);

  const d = dokumen[0] || {};
  const r = relaas[0] || {};

  const baris = [
    {
      butir: "Terdaftar lewat e-Court",
      keadaan: efiling.length > 0 ? "ya" : "tidak",
      catatan: efiling.length > 0 ? "" : "Perkara didaftarkan di meja, bukan e-Court.",
    },
    {
      butir: "Salinan putusan diunggah",
      keadaan: cleanText(d.amarDok) ? "ada" : isoTanggal(d.tanggalPutusan) ? "belum" : "belum putus",
      catatan: "",
    },
    {
      butir: "Putusan anonimisasi",
      keadaan: cleanText(d.anonimDok) ? "ada" : isoTanggal(d.tanggalPutusan) ? "belum" : "belum putus",
      catatan: "Syarat unggah ke Direktori Putusan.",
    },
    {
      butir: "Relaas berdokumen",
      keadaan: `${angka(r.berdokumen)} dari ${angka(r.jumlah)}`,
      catatan: angka(r.jumlah) > angka(r.berdokumen) ? "Ada relaas tanpa pindaian." : "",
    },
  ];

  const kurang = baris.filter((x) => /belum|tidak/.test(x.keadaan)).length;

  return {
    judul: "Kelengkapan dokumen elektronik",
    ringkas: kurang === 0 ? "Seluruh butir lengkap." : `${kurang} butir belum lengkap.`,
    metrik: [
      { label: "Butir diperiksa", nilai: String(baris.length) },
      { label: "Belum lengkap", nilai: String(kurang) },
    ],
    kolom: [
      { kunci: "butir", label: "Butir" },
      { kunci: "keadaan", label: "Keadaan" },
      { kunci: "catatan", label: "Catatan" },
    ],
    baris,
    catatan:
      "Perkara yang tidak lewat e-Court tetap wajib mengunggah salinan putusan dan anonimisasinya.",
  };
}

/* ==========================================================================
 * 10. KRONOLOGI LENGKAP
 * ==========================================================================
 *
 * Menggabungkan tahapan, sidang, relaas, dan putusan menjadi SATU deret
 * berurutan. Selama ini keempatnya dibaca di empat tempat, dan jeda di
 * antaranya - yang justru paling menjelaskan - tidak pernah terlihat.
 */
async function kronologi(perkara) {
  const id = perkara.perkaraId;

  const [proses, sidang, relaas] = await Promise.all([
    runQuery(
      `SELECT pr.tanggal AS tanggal, pr.tahapan_nama AS nama, pr.diinput_oleh AS oleh
         FROM perkara_proses pr WHERE pr.perkara_id = ? ORDER BY pr.tanggal ASC LIMIT 200`,
      [id]
    ).catch(() => []),
    runQuery(
      `SELECT j.tanggal_sidang AS tanggal, j.agenda AS nama
         FROM perkara_jadwal_sidang j WHERE j.perkara_id = ? ORDER BY j.tanggal_sidang ASC LIMIT 100`,
      [id]
    ).catch(() => []),
    runQuery(
      `SELECT r.tanggal_relaas AS tanggal, COALESCE(pk.nama, 'pihak') AS nama
         FROM perkara_pelaksanaan_relaas r
         LEFT JOIN pihak pk ON pk.id = r.pihak_id
        WHERE r.perkara_id = ? ORDER BY r.tanggal_relaas ASC LIMIT 200`,
      [id]
    ).catch(() => []),
  ]);

  const gabung = [
    ...proses.map((x) => ({
      tanggal: isoTanggal(x.tanggal),
      jenis: "tahapan",
      keterangan: cleanText(x.nama),
      oleh: cleanText(x.oleh),
    })),
    ...sidang.map((x) => ({
      tanggal: isoTanggal(x.tanggal),
      jenis: "sidang",
      keterangan: cleanText(x.nama) || "sidang",
      oleh: "",
    })),
    ...relaas.map((x) => ({
      tanggal: isoTanggal(x.tanggal),
      jenis: "relaas",
      keterangan: `panggilan ${cleanText(x.nama)}`,
      oleh: "",
    })),
  ]
    .filter((x) => x.tanggal)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  let sebelumnya = "";
  const baris = gabung.map((x) => {
    const jeda = sebelumnya ? selisihHari(sebelumnya, x.tanggal) : null;
    sebelumnya = x.tanggal;
    return { ...x, jedaHari: jeda };
  });

  const jedaBesar = baris.filter((x) => x.jedaHari !== null && x.jedaHari > 30);

  return {
    judul: "Kronologi lengkap",
    ringkas:
      baris.length === 0
        ? "Belum ada peristiwa tercatat."
        : `${baris.length} peristiwa; ${jedaBesar.length} jeda lebih dari 30 hari.`,
    metrik: [
      { label: "Peristiwa", nilai: String(baris.length) },
      { label: "Jeda > 30 hari", nilai: String(jedaBesar.length) },
      {
        label: "Jeda terpanjang",
        nilai: baris.length
          ? `${Math.max(0, ...baris.map((x) => x.jedaHari || 0))} hari`
          : "—",
      },
    ],
    kolom: [
      { kunci: "tanggal", label: "Tanggal" },
      { kunci: "jenis", label: "Jenis" },
      { kunci: "keterangan", label: "Peristiwa" },
      { kunci: "jedaHari", label: "Jeda (hari)", angka: true },
      { kunci: "oleh", label: "Oleh" },
    ],
    baris,
    catatan:
      "Jeda panjang di antara dua peristiwa adalah tempat waktu perkara benar-benar habis - lebih menjelaskan daripada jumlah sidangnya.",
  };
}

/* ========================================================================== */

/**
 * Daftar analisis yang tersedia.
 *
 * Dikirim ke layar supaya tombolnya tidak perlu disalin ulang di sana - dan
 * tidak dapat menyimpang dari yang benar-benar ada di sini.
 */
/* ==========================================================================
 * TAHAP 1 - LINGKUP PERKARA
 * ========================================================================== */

/**
 * 3. SKOR KESEHATAN BERKAS
 *
 * Satu angka untuk pertanyaan yang selama ini dijawab dengan membuka tujuh
 * bagian satu per satu: berkas perkara ini lengkap atau tidak.
 *
 * Yang dinilai hanya butir yang KEBERADAANNYA dapat dibuktikan dari SIPP -
 * bukan mutu isinya. Butir yang belum waktunya - anonimisasi pada perkara
 * yang belum putus - tidak ikut dihitung, bukan dinilai nol.
 */
async function kesehatanBerkas(perkara) {
  const id = perkara.perkaraId;

  const [relaas, putusan, arsip, pertimbangan, penetapan] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) AS jumlah,
              SUM(CASE WHEN r.doc_relaas IS NOT NULL AND r.doc_relaas <> '' THEN 1 ELSE 0 END) AS berdokumen
         FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = ?`,
      [id]
    ).catch(() => []),
    runQuery(
      `SELECT pu.tanggal_putusan AS tanggalPutusan,
              pu.amar_putusan AS amar,
              pu.amar_putusan_dok AS amarDok,
              pu.amar_putusan_anonimisasi_dok AS anonimDok,
              pu.tanggal_minutasi AS minutasi,
              pu.tanggal_bht AS bht
         FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
      [id]
    ).catch(() => []),
    runQuery(`SELECT COUNT(*) AS jumlah FROM arsip a WHERE a.perkara_id = ?`, [id]).catch(() => []),
    runQuery(
      `SELECT COUNT(*) AS jumlah FROM perkara_pertimbangan_hukum ph WHERE ph.perkara_id = ?`,
      [id]
    ).catch(() => []),
    runQuery(
      `SELECT d.jenis_dokumen_id AS jenis FROM perkara_dokumen_penetapan d
        WHERE d.perkara_id = ? LIMIT 50`,
      [id]
    ).catch(() => []),
  ]);

  const r = relaas[0] || {};
  const p = putusan[0] || {};
  const sudahPutus = Boolean(isoTanggal(p.tanggalPutusan));
  const jenisPenetapan = new Set((penetapan || []).map((x) => Number(x.jenis)));

  // berlaku:false berarti butirnya BELUM waktunya - tidak dihitung sama
  // sekali, bukan dinilai nol. Menilai anonimisasi pada perkara yang belum
  // putus akan menurunkan angka atas pekerjaan yang belum jatuh tempo.
  const butir = [
    { nama: 'Penetapan PMH berdokumen', ada: jenisPenetapan.has(1), berlaku: true },
    { nama: 'Penetapan PP berdokumen', ada: jenisPenetapan.has(2), berlaku: true },
    { nama: 'Penetapan juru sita berdokumen', ada: jenisPenetapan.has(3), berlaku: true },
    { nama: 'Penetapan hari sidang berdokumen', ada: jenisPenetapan.has(4), berlaku: true },
    {
      nama: 'Seluruh relaas berdokumen',
      ada: angka(r.jumlah) > 0 && angka(r.berdokumen) >= angka(r.jumlah),
      berlaku: angka(r.jumlah) > 0,
      catatan: `${angka(r.berdokumen)} dari ${angka(r.jumlah)}`,
    },
    { nama: 'Pertimbangan hukum terisi', ada: angka((pertimbangan[0] || {}).jumlah) > 0, berlaku: sudahPutus },
    { nama: 'Amar putusan terisi', ada: Boolean(cleanText(p.amar)), berlaku: sudahPutus },
    { nama: 'Salinan putusan diunggah', ada: Boolean(cleanText(p.amarDok)), berlaku: sudahPutus },
    { nama: 'Anonimisasi putusan diunggah', ada: Boolean(cleanText(p.anonimDok)), berlaku: sudahPutus },
    { nama: 'Sudah diminutasi', ada: Boolean(isoTanggal(p.minutasi)), berlaku: sudahPutus },
    { nama: 'BHT tercatat', ada: Boolean(isoTanggal(p.bht)), berlaku: sudahPutus },
    { nama: 'Berkas diarsipkan', ada: angka((arsip[0] || {}).jumlah) > 0, berlaku: Boolean(isoTanggal(p.bht)) },
  ];

  const berlaku = butir.filter((x) => x.berlaku);
  const lengkap = berlaku.filter((x) => x.ada).length;
  const persen = berlaku.length === 0 ? null : Math.round((lengkap / berlaku.length) * 100);

  return {
    judul: 'Skor kesehatan berkas',
    ringkas:
      persen === null
        ? 'Belum ada butir yang dapat dinilai.'
        : `${lengkap} dari ${berlaku.length} butir lengkap (${persen}%).`,
    metrik: [
      { label: 'Kelengkapan', nilai: persen === null ? '—' : `${persen}%` },
      { label: 'Sudah lengkap', nilai: String(lengkap) },
      {
        label: 'Belum lengkap',
        nilai: String(berlaku.length - lengkap),
      },
      {
        label: 'Belum waktunya',
        nilai: String(butir.length - berlaku.length),
        keterangan: 'tidak ikut dihitung',
      },
    ],
    kolom: [
      { kunci: 'nama', label: 'Butir' },
      { kunci: 'keadaan', label: 'Keadaan' },
      { kunci: 'catatan', label: 'Catatan' },
    ],
    baris: butir.map((x) => ({
      nama: x.nama,
      keadaan: !x.berlaku ? 'belum waktunya' : x.ada ? 'lengkap' : 'BELUM',
      catatan: x.catatan || '',
    })),
    catatan:
      'Yang dinilai KEBERADAAN berkasnya, bukan mutu isinya. Butir yang belum jatuh tempo tidak ikut dihitung.',
  };
}

/**
 * 14. JEJAK SUNTINGAN DATA
 *
 * Siapa mengubah tanggal apa, dan berapa lama sesudah diinput pertama kali.
 *
 * Menyunting tanggal penetapan sebulan kemudian MENGUBAH NILAI SK perkara
 * itu, dan sampai sekarang tidak ada satu pun layar yang memperlihatkannya.
 * Di seluruh register ada 3.948 baris yang pernah disunting sesudah diinput.
 *
 * Yang ditampilkan jejaknya, bukan tuduhannya: menyunting data adalah hal
 * yang sah dan sering diperlukan. Yang perlu terlihat hanya bahwa ia terjadi.
 */
async function jejakSuntingan(id) {
  const rows = await runQuery(
    `SELECT pr.tahapan_nama AS tahapan,
            pr.proses_nama AS proses,
            pr.tanggal AS tanggalPeristiwa,
            pr.diinput_oleh AS diinputOleh,
            pr.diinput_tanggal AS diinputTanggal,
            pr.diperbaharui_oleh AS diubahOleh,
            pr.diperbaharui_tanggal AS diubahTanggal
       FROM perkara_proses pr
      WHERE pr.perkara_id = ?
        AND pr.diperbaharui_tanggal IS NOT NULL
        AND pr.diperbaharui_tanggal > pr.diinput_tanggal
      ORDER BY pr.diperbaharui_tanggal DESC
      LIMIT 100`,
    [id]
  ).catch(() => []);

  const baris = rows.map((row) => {
    const diinput = isoTanggal(row.diinputTanggal);
    const diubah = isoTanggal(row.diubahTanggal);
    return {
      tahapan: cleanText(row.tahapan) || cleanText(row.proses),
      tanggalPeristiwa: isoTanggal(row.tanggalPeristiwa),
      diinput: `${diinput}${cleanText(row.diinputOleh) ? ` oleh ${cleanText(row.diinputOleh)}` : ''}`,
      diubah: `${diubah}${cleanText(row.diubahOleh) ? ` oleh ${cleanText(row.diubahOleh)}` : ''}`,
      jedaHari: selisihHari(diinput, diubah),
      olehOrangLain:
        cleanText(row.diinputOleh) && cleanText(row.diubahOleh)
          ? cleanText(row.diinputOleh) !== cleanText(row.diubahOleh)
            ? 'ya'
            : ''
          : '',
    };
  });

  const jeda = baris.map((x) => x.jedaHari).filter((x) => x !== null);
  const orangLain = baris.filter((x) => x.olehOrangLain === 'ya').length;

  return {
    judul: 'Jejak suntingan data',
    ringkas:
      baris.length === 0
        ? 'Tidak ada data yang disunting sesudah diinput.'
        : `${baris.length} baris disunting sesudah diinput; ${orangLain} di antaranya oleh orang lain.`,
    metrik: [
      { label: 'Baris disunting', nilai: String(baris.length) },
      { label: 'Oleh orang lain', nilai: String(orangLain) },
      {
        label: 'Jeda terlama',
        nilai: jeda.length ? `${Math.max(...jeda)} hari` : '—',
        keterangan: 'input pertama ke suntingan',
      },
    ],
    kolom: [
      { kunci: 'tahapan', label: 'Tahapan' },
      { kunci: 'tanggalPeristiwa', label: 'Tanggal peristiwa' },
      { kunci: 'diinput', label: 'Diinput' },
      { kunci: 'diubah', label: 'Disunting' },
      { kunci: 'jedaHari', label: 'Jeda (hari)', angka: true },
      { kunci: 'olehOrangLain', label: 'Orang lain' },
    ],
    baris,
    catatan:
      'Menyunting data adalah hal yang sah dan sering diperlukan - yang ditampilkan jejaknya, bukan tuduhannya. Suntingan atas tanggal penetapan patut diperiksa, sebab ia mengubah nilai SK perkara ini.',
  };
}

/**
 * 1. RAPOR PEGAWAI YANG MENGERJAKAN PERKARA INI
 *
 * Ketepatan input dinilai PER ORANG, bukan per perkara. Petugas yang sama
 * mengerjakan ratusan perkara, dan keterlambatan yang berulang adalah
 * keadaan yang berbeda dari satu perkara yang kebetulan tertinggal.
 *
 * Diukur pada SIPP yang berjalan: 96 penginput berbeda, dan rentangnya jauh -
 * ada yang rerata 0,8 hari, ada yang 41 hari.
 */
async function raporPegawai(id) {
  const disini = await runQuery(
    `SELECT pr.diinput_oleh AS oleh, COUNT(*) AS jumlah
       FROM perkara_proses pr
      WHERE pr.perkara_id = ? AND pr.diinput_oleh <> ''
      GROUP BY pr.diinput_oleh`,
    [id]
  ).catch(() => []);

  const baris = [];
  for (const satu of disini) {
    const nama = cleanText(satu.oleh);
    if (!nama) continue;

    const rekam = await runQuery(
      `SELECT COUNT(*) AS jumlah,
              ROUND(AVG(GREATEST(DATEDIFF(pr.diinput_tanggal, pr.tanggal), 0)), 1) AS rerata,
              SUM(CASE WHEN DATEDIFF(pr.diinput_tanggal, pr.tanggal) <= 0 THEN 1 ELSE 0 END) AS samaHari,
              SUM(CASE WHEN DATEDIFF(pr.diinput_tanggal, pr.tanggal) > 3 THEN 1 ELSE 0 END) AS lewatTiga
         FROM perkara_proses pr
        WHERE pr.diinput_oleh = ?
          AND pr.tanggal IS NOT NULL
          AND pr.diinput_tanggal IS NOT NULL`,
      [nama]
    ).catch(() => []);

    const x = rekam[0] || {};
    const total = angka(x.jumlah);
    baris.push({
      nama,
      diPerkaraIni: angka(satu.jumlah),
      totalInput: total,
      rerataHari: x.rerata === null || x.rerata === undefined ? null : Number(x.rerata),
      samaHari: total > 0 ? `${Math.round((angka(x.samaHari) / total) * 100)}%` : '—',
      lewatTiga: total > 0 ? `${Math.round((angka(x.lewatTiga) / total) * 100)}%` : '—',
    });
  }

  baris.sort((a, b) => (b.rerataHari || 0) - (a.rerataHari || 0));

  return {
    judul: 'Rapor pegawai yang mengerjakan perkara ini',
    ringkas:
      baris.length === 0
        ? 'Belum ada tahapan yang tercatat penginputnya.'
        : `${baris.length} pegawai menginput perkara ini; angka di sebelah kanan rekam jejaknya di SELURUH perkara.`,
    metrik: [
      { label: 'Pegawai terlibat', nilai: String(baris.length) },
      {
        label: 'Rerata terlambat tertinggi',
        nilai: baris.length && baris[0].rerataHari !== null ? `${baris[0].rerataHari} hari` : '—',
        keterangan: baris.length ? baris[0].nama : '',
      },
    ],
    kolom: [
      { kunci: 'nama', label: 'Pegawai' },
      { kunci: 'diPerkaraIni', label: 'Input di perkara ini', angka: true },
      { kunci: 'totalInput', label: 'Total input', angka: true },
      { kunci: 'rerataHari', label: 'Rerata jeda (hari)', angka: true },
      { kunci: 'samaHari', label: 'Hari sama' },
      { kunci: 'lewatTiga', label: 'Lewat 3 hari' },
    ],
    baris,
    catatan:
      'Rerata dan persentasenya dihitung dari SELURUH perkara yang pernah diinput orang itu, bukan dari perkara ini saja - satu perkara terlambat berbeda dari kebiasaan terlambat.',
  };
}

/**
 * 15. KEPATUHAN TENGGANG PANGGILAN - PASAL 122 HIR
 *
 * Sekurang-kurangnya tiga hari antara relaas dan hari sidang. Yang dinilai di
 * sini relaas perkara ini, BESERTA rekam jejak juru sitanya di seluruh
 * perkara - satu panggilan yang mepet berbeda dari kebiasaan memepetkan.
 *
 * Diukur pada SIPP yang berjalan: nama juru sita TIDAK seragam antar tabel
 * ('MOH.SYUKRI, S.H' dan 'Mohammad Syukri, SH' orang yang sama), dan 7.347
 * relaas tidak punya nama juru sita sama sekali. Karena itu rekam jejaknya
 * dicocokkan dengan nama yang tertulis apa adanya, dan ketidakseragamannya
 * disebutkan - bukan digabung diam-diam menurut tebakan.
 */
async function tenggangPanggilan(id) {
  const rows = await runQuery(
    `SELECT r.tanggal_relaas AS tanggalRelaas,
            sd.tanggal_sidang AS tanggalSidang,
            r.ket_temu AS ketTemu,
            COALESCE(js.jurusita_nama, jm.nama_gelar, jm.nama) AS jurusita,
            COALESCE(pk.nama, vp.nama) AS namaPihak
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN perkara_jadwal_sidang sd ON sd.id = r.sidang_id
       LEFT JOIN perkara_jurusita js ON js.jurusita_id = r.jurusita_id AND js.perkara_id = r.perkara_id
       LEFT JOIN jurusita jm ON jm.id = r.jurusita_id
       LEFT JOIN pihak pk ON pk.id = r.pihak_id
       LEFT JOIN v_pihak_perkara vp ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
      WHERE r.perkara_id = ?
      ORDER BY sd.tanggal_sidang ASC, r.tanggal_relaas ASC
      LIMIT 100`,
    [id]
  ).catch(() => []);

  const baris = rows.map((row) => {
    const relaas = isoTanggal(row.tanggalRelaas);
    const sidang = isoTanggal(row.tanggalSidang);
    const tenggang = selisihHari(relaas, sidang);
    return {
      namaPihak: cleanText(row.namaPihak),
      jurusita: cleanText(row.jurusita),
      tanggalRelaas: relaas,
      tanggalSidang: sidang,
      tenggangHari: tenggang,
      keadaan:
        tenggang === null ? '' : tenggang < 3 ? 'KURANG DARI 3 HARI' : 'memenuhi',
    };
  });

  const berhari = baris.filter((x) => x.tenggangHari !== null);
  const kurang = berhari.filter((x) => x.tenggangHari < 3).length;

  // Rekam jejak juru sitanya di seluruh perkara.
  const namaJurusita = [...new Set(baris.map((x) => x.jurusita).filter(Boolean))];
  const rekam = [];
  for (const nama of namaJurusita.slice(0, 5)) {
    const hasil = await runQuery(
      `SELECT COUNT(*) AS jumlah,
              SUM(CASE WHEN DATEDIFF(sd.tanggal_sidang, r.tanggal_relaas) < 3 THEN 1 ELSE 0 END) AS kurang
         FROM perkara_pelaksanaan_relaas r
         JOIN perkara_jadwal_sidang sd ON sd.id = r.sidang_id
         LEFT JOIN perkara_jurusita js ON js.jurusita_id = r.jurusita_id AND js.perkara_id = r.perkara_id
         LEFT JOIN jurusita jm ON jm.id = r.jurusita_id
        WHERE COALESCE(js.jurusita_nama, jm.nama_gelar, jm.nama) = ?
          AND r.tanggal_relaas IS NOT NULL`,
      [nama]
    ).catch(() => []);
    const x = hasil[0] || {};
    const total = angka(x.jumlah);
    rekam.push({
      jurusita: nama,
      totalRelaas: total,
      kurangTiga: angka(x.kurang),
      persen: total > 0 ? `${Math.round((angka(x.kurang) / total) * 100)}%` : '—',
    });
  }

  return {
    judul: 'Kepatuhan tenggang panggilan (Pasal 122 HIR)',
    ringkas:
      berhari.length === 0
        ? 'Belum ada relaas yang tenggangnya dapat dihitung.'
        : `${kurang} dari ${berhari.length} relaas berselang kurang dari tiga hari sebelum sidang.`,
    metrik: [
      { label: 'Relaas dinilai', nilai: String(berhari.length) },
      { label: 'Kurang 3 hari', nilai: String(kurang) },
      ...rekam.map((x) => ({
        label: `Rekam ${x.jurusita}`.slice(0, 40),
        nilai: x.persen,
        keterangan: `${x.kurangTiga} dari ${x.totalRelaas} relaas`,
      })),
    ],
    kolom: [
      { kunci: 'namaPihak', label: 'Pihak' },
      { kunci: 'tanggalRelaas', label: 'Relaas' },
      { kunci: 'tanggalSidang', label: 'Sidang' },
      { kunci: 'tenggangHari', label: 'Tenggang (hari)', angka: true },
      { kunci: 'keadaan', label: 'Keadaan' },
      { kunci: 'jurusita', label: 'Juru sita' },
    ],
    baris,
    catatan:
      'Dihitung hari kalender, bukan hari kerja - angka di bawah tiga perlu diperiksa terhadap hari liburnya. Nama juru sita tidak seragam antar tabel SIPP, sehingga rekam jejaknya dicocokkan menurut nama yang tertulis apa adanya.',
  };
}

/* ==========================================================================
 * TAHAP 1 - LINGKUP PENGADILAN
 *
 * Angkanya SAMA siapa pun perkara yang sedang dibuka. Itu disebutkan pada
 * tiap keluarannya supaya tidak dikira keterangan perkara ini.
 * ========================================================================== */

/**
 * 6. PAPAN KENDALI BULANAN
 *
 * Masuk, putus, dan sisanya per bulan - pertanyaan pimpinan tiap awal bulan
 * yang selama ini dijawab dengan menyalin ke Excel.
 */
async function papanBulanan() {
  const [masuk, putus] = await Promise.all([
    runQuery(
      `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS jumlah
         FROM perkara p
        WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY bulan ORDER BY bulan DESC LIMIT 12`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT DATE_FORMAT(pu.tanggal_putusan, '%Y-%m') AS bulan,
              COUNT(*) AS jumlah,
              ROUND(AVG(DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran))) AS rerata
         FROM perkara_putusan pu
         JOIN perkara p ON p.perkara_id = pu.perkara_id
        WHERE pu.tanggal_putusan >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY bulan ORDER BY bulan DESC LIMIT 12`,
      []
    ).catch(() => []),
  ]);

  const petaPutus = new Map(putus.map((x) => [String(x.bulan), x]));
  const baris = masuk.map((x) => {
    const bulan = String(x.bulan);
    const p = petaPutus.get(bulan) || {};
    const jumlahMasuk = angka(x.jumlah);
    const jumlahPutus = angka(p.jumlah);
    return {
      bulan,
      masuk: jumlahMasuk,
      putus: jumlahPutus,
      selisih: jumlahPutus - jumlahMasuk,
      // Berapa persen dari yang masuk berhasil diselesaikan pada bulan yang
      // sama - ukuran baku pengelolaan perkara.
      clearance: jumlahMasuk > 0 ? `${Math.round((jumlahPutus / jumlahMasuk) * 100)}%` : '—',
      rerataHari: p.rerata === null || p.rerata === undefined ? null : Number(p.rerata),
    };
  });

  const belumPutus = await runQuery(
    `SELECT COUNT(*) AS jumlah,
            SUM(CASE WHEN p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 5 MONTH) THEN 1 ELSE 0 END) AS lewatLima
       FROM perkara p
       LEFT JOIN (SELECT perkara_id, MAX(tanggal_putusan) AS tanggal_putusan
                    FROM perkara_putusan GROUP BY perkara_id) pu
              ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan IS NULL`,
    []
  ).catch(() => []);

  const sisa = belumPutus[0] || {};

  return {
    judul: 'Papan kendali bulanan (seluruh pengadilan)',
    ringkas: baris.length
      ? `${baris[0].bulan}: ${baris[0].masuk} masuk, ${baris[0].putus} putus.`
      : 'Belum ada perkara pada dua belas bulan terakhir.',
    metrik: [
      { label: 'Belum putus', nilai: String(angka(sisa.jumlah)) },
      {
        label: 'Lewat 5 bulan',
        nilai: String(angka(sisa.lewatLima)),
        keterangan: 'ambang SEMA 2/2014',
      },
    ],
    kolom: [
      { kunci: 'bulan', label: 'Bulan' },
      { kunci: 'masuk', label: 'Masuk', angka: true },
      { kunci: 'putus', label: 'Putus', angka: true },
      { kunci: 'selisih', label: 'Selisih', angka: true },
      { kunci: 'clearance', label: 'Clearance' },
      { kunci: 'rerataHari', label: 'Rerata selesai (hari)', angka: true },
    ],
    baris,
    catatan:
      'Angka ini berlaku untuk SELURUH pengadilan, bukan perkara yang sedang dibuka. Clearance membandingkan yang diputus pada bulan itu dengan yang masuk pada bulan yang sama - keduanya perkara yang berbeda.',
  };
}

/**
 * 4. INDEKS BEBAN BERIMBANG
 *
 * Sebaran, bukan rata-rata. Rata-rata menyembunyikan satu orang yang memikul
 * dua kali lipat beban rekannya - dan justru itu yang perlu terlihat.
 */
async function bebanBerimbang() {
  const kelompok = [
    ['Hakim', 'perkara_hakim_pn', 'hakim_nama'],
    ['Panitera Pengganti', 'perkara_panitera_pn', 'panitera_nama'],
    ['Juru Sita', 'perkara_jurusita', 'jurusita_nama'],
  ];

  const baris = [];
  const metrik = [];

  for (const [label, tabel, kolom] of kelompok) {
    // Nama tabel dan kolom dari daftar tertutup di atas, tidak pernah dari
    // peramban.
    const rows = await runQuery(
      `SELECT t.${kolom} AS nama, COUNT(DISTINCT t.perkara_id) AS jumlah
         FROM ${tabel} t
        WHERE t.${kolom} IS NOT NULL AND t.${kolom} <> ''
        GROUP BY t.${kolom}
        ORDER BY jumlah DESC
        LIMIT 40`,
      []
    ).catch(() => []);

    const jumlah = rows.map((x) => angka(x.jumlah));
    const tengah = median(jumlah);

    for (const row of rows.slice(0, 12)) {
      const n = angka(row.jumlah);
      baris.push({
        kelompok: label,
        nama: cleanText(row.nama),
        perkara: n,
        // Berapa kali nilai tengah - satu angka yang langsung terbaca.
        terhadapTengah: tengah ? `${(n / tengah).toFixed(1)}x` : '—',
      });
    }

    if (jumlah.length > 0) {
      metrik.push({
        label,
        nilai: `${Math.min(...jumlah)} - ${Math.max(...jumlah)}`,
        keterangan: `${jumlah.length} orang, tengah ${tengah}`,
      });
    }
  }

  return {
    judul: 'Sebaran beban perkara (seluruh pengadilan)',
    ringkas:
      metrik.length === 0
        ? 'Belum ada penugasan yang terbaca.'
        : 'Rentang beban tiap kelompok petugas; makin lebar rentangnya makin timpang pembagiannya.',
    metrik,
    kolom: [
      { kunci: 'kelompok', label: 'Kelompok' },
      { kunci: 'nama', label: 'Nama' },
      { kunci: 'perkara', label: 'Perkara', angka: true },
      { kunci: 'terhadapTengah', label: 'Terhadap nilai tengah' },
    ],
    baris,
    catatan:
      'Dihitung dari SELURUH perkara yang pernah ditangani, bukan tahun berjalan - petugas lama wajar berangka lebih besar. Nama yang tidak seragam antar tabel SIPP terhitung sebagai orang yang berbeda.',
  };
}

/**
 * 17. BANDING ANTAR PERIODE
 *
 * Angka tanpa pembanding tidak berarti apa-apa. Yang dibandingkan tiga: bulan
 * berjalan, bulan sebelumnya, dan bulan yang sama tahun lalu - yang terakhir
 * menjawab pertanyaan yang berbeda, sebab beban perkara bermusim.
 */
async function bandingPeriode() {
  const ukur = async (mulai, akhir) => {
    const [masuk, putus] = await Promise.all([
      runQuery(
        `SELECT COUNT(*) AS jumlah FROM perkara p
          WHERE p.tanggal_pendaftaran BETWEEN ? AND ?`,
        [mulai, akhir]
      ).catch(() => []),
      runQuery(
        `SELECT COUNT(*) AS jumlah,
                ROUND(AVG(DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran))) AS rerata
           FROM perkara_putusan pu
           JOIN perkara p ON p.perkara_id = pu.perkara_id
          WHERE pu.tanggal_putusan BETWEEN ? AND ?`,
        [mulai, akhir]
      ).catch(() => []),
    ]);
    const a = masuk[0] || {};
    const b = putus[0] || {};
    return {
      masuk: angka(a.jumlah),
      putus: angka(b.jumlah),
      rerata: b.rerata === null || b.rerata === undefined ? null : Number(b.rerata),
    };
  };

  const sekarang = new Date();
  const awalBulan = (geser) => {
    const t = new Date(sekarang.getFullYear(), sekarang.getMonth() + geser, 1);
    return isoTanggal(t);
  };
  const akhirBulan = (geser) => {
    const t = new Date(sekarang.getFullYear(), sekarang.getMonth() + geser + 1, 0);
    return isoTanggal(t);
  };
  const setahunLalu = (teks) => {
    const [y, m, d] = String(teks).split('-').map(Number);
    return isoTanggal(new Date(y - 1, m - 1, d));
  };

  const periode = [
    { nama: 'Bulan ini', mulai: awalBulan(0), akhir: akhirBulan(0) },
    { nama: 'Bulan lalu', mulai: awalBulan(-1), akhir: akhirBulan(-1) },
    {
      nama: 'Bulan sama tahun lalu',
      mulai: setahunLalu(awalBulan(0)),
      akhir: setahunLalu(akhirBulan(0)),
    },
  ];

  const baris = [];
  for (const satu of periode) {
    const hasil = await ukur(satu.mulai, satu.akhir);
    baris.push({
      periode: satu.nama,
      rentang: `${satu.mulai} s.d. ${satu.akhir}`,
      masuk: hasil.masuk,
      putus: hasil.putus,
      rerataHari: hasil.rerata,
    });
  }

  const ini = baris[0] || { masuk: 0, putus: 0 };
  const lalu = baris[1] || { masuk: 0, putus: 0 };
  const beda = (sekarangNilai, sebelumnya) => {
    if (!sebelumnya) return '—';
    const persen = Math.round(((sekarangNilai - sebelumnya) / sebelumnya) * 100);
    return `${persen > 0 ? '+' : ''}${persen}%`;
  };

  return {
    judul: 'Banding antar periode (seluruh pengadilan)',
    ringkas: `Bulan ini ${ini.masuk} masuk dan ${ini.putus} putus.`,
    metrik: [
      { label: 'Masuk vs bulan lalu', nilai: beda(ini.masuk, lalu.masuk) },
      { label: 'Putus vs bulan lalu', nilai: beda(ini.putus, lalu.putus) },
    ],
    kolom: [
      { kunci: 'periode', label: 'Periode' },
      { kunci: 'rentang', label: 'Rentang' },
      { kunci: 'masuk', label: 'Masuk', angka: true },
      { kunci: 'putus', label: 'Putus', angka: true },
      { kunci: 'rerataHari', label: 'Rerata selesai (hari)', angka: true },
    ],
    baris,
    catatan:
      'Berlaku untuk SELURUH pengadilan. Bulan berjalan belum penuh, jadi membandingkannya dengan bulan lalu yang utuh selalu tampak menurun - bandingkan dengan bulan yang sama tahun lalu untuk gambaran yang setara.',
  };
}

/**
 * Daftar analisis yang tersedia.
 *
 * `lingkup` menentukan pengelompokan tombolnya di layar:
 *
 *   perkara     angkanya milik perkara yang sedang dibuka
 *   pengadilan  angkanya SAMA siapa pun perkara yang dibuka
 *
 * Tanpa pembedaan itu, papan kendali bulanan akan dikira keterangan perkara
 * ini - dan angka pengadilan yang dibaca sebagai angka perkara adalah
 * kekeliruan yang tidak menampakkan dirinya sendiri.
 */
/* ==========================================================================
 * TAHAP 2
 * ========================================================================== */

/**
 * 7. SEBARAN PERKARA MENURUT WILAYAH
 *
 * Dasar penentuan lokasi sidang keliling: dari mana perkara paling banyak
 * datang.
 *
 * Dua hal yang menentukan cara membacanya, dan keduanya disebutkan di layar:
 *
 *   1. SIPP menyimpan kecamatan sebagai KODE wilayah ('72.10.01'), bukan
 *      nama. Tanpa penggabungan ke ref_kecamatan_new, yang tampil deretan
 *      angka yang tidak berarti apa-apa bagi siapa pun.
 *
 *   2. Hanya 11.725 dari 36.380 pihak punya kecamatan. Sebarannya karena itu
 *      menggambarkan SEPERTIGA pihak, bukan seluruhnya - dan peta yang
 *      tampak pasti di atas data sepertiga lebih berbahaya daripada tidak
 *      ada peta.
 *
 * Dibatasi tiga tahun terakhir: tanpa batas itu kueri memakan hampir lima
 * detik, dan sebaran sepuluh tahun lalu tidak menjawab pertanyaan tentang
 * lokasi sidang keliling tahun ini.
 */
async function sebaranWilayah() {
  const rows = await runQuery(
    `SELECT rk.kecamatan_nama AS kecamatan,
            COUNT(DISTINCT vp.perkara_id) AS jumlah
       FROM pihak ph
       JOIN v_pihak_perkara vp ON vp.pihak_id = ph.id
       JOIN perkara p ON p.perkara_id = vp.perkara_id
       JOIN ref_kecamatan_new rk ON rk.kecamatan_kode = ph.kecamatan
      WHERE ph.kecamatan <> ''
        AND p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR)
      GROUP BY rk.kecamatan_nama
      ORDER BY jumlah DESC
      LIMIT 40`,
    []
  ).catch(() => []);

  const cakupan = await runQuery(
    `SELECT COUNT(*) AS semua,
            SUM(CASE WHEN ph.kecamatan <> '' THEN 1 ELSE 0 END) AS berkecamatan
       FROM pihak ph`,
    []
  ).catch(() => []);

  const c = cakupan[0] || {};
  const total = rows.reduce((jumlah, x) => jumlah + angka(x.jumlah), 0);

  const baris = rows.map((row) => ({
    kecamatan: cleanText(row.kecamatan),
    jumlah: angka(row.jumlah),
    bagian: total > 0 ? `${Math.round((angka(row.jumlah) / total) * 100)}%` : '—',
  }));

  return {
    judul: 'Sebaran perkara menurut kecamatan (tiga tahun terakhir)',
    ringkas: baris.length
      ? `Terbanyak dari ${baris[0].kecamatan} (${baris[0].jumlah} perkara).`
      : 'Belum ada pihak yang kecamatannya terbaca.',
    metrik: [
      { label: 'Kecamatan terdata', nilai: String(baris.length) },
      {
        label: 'Cakupan data',
        nilai:
          angka(c.semua) > 0
            ? `${Math.round((angka(c.berkecamatan) / angka(c.semua)) * 100)}%`
            : '—',
        keterangan: `${angka(c.berkecamatan)} dari ${angka(c.semua)} pihak`,
      },
    ],
    kolom: [
      { kunci: 'kecamatan', label: 'Kecamatan' },
      { kunci: 'jumlah', label: 'Perkara', angka: true },
      { kunci: 'bagian', label: 'Bagian' },
    ],
    baris,
    catatan:
      'Hanya pihak yang kecamatannya terisi yang terhitung - sebagian besar pihak tidak punya keterangan itu, sehingga sebaran ini menggambarkan sebagian, bukan seluruh perkara. Kode wilayah SIPP diterjemahkan lewat ref_kecamatan_new.',
  };
}

/**
 * 8. MUSIM PERKARA
 *
 * Beban perkara tidak rata sepanjang tahun. Diukur pada SIPP yang berjalan,
 * Februari paling padat (1.326) dan Juli menyusul (1.194) - dan mengetahui
 * itu lebih dulu adalah dasar mengatur cuti, jadwal, dan penempatan petugas.
 */
async function musimPerkara() {
  const [perBulan, perHari] = await Promise.all([
    runQuery(
      `SELECT MONTH(p.tanggal_pendaftaran) AS bulan, COUNT(*) AS jumlah
         FROM perkara p WHERE p.tanggal_pendaftaran IS NOT NULL
        GROUP BY bulan ORDER BY bulan ASC`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT DAYOFWEEK(p.tanggal_pendaftaran) AS hari, COUNT(*) AS jumlah
         FROM perkara p WHERE p.tanggal_pendaftaran IS NOT NULL
        GROUP BY hari ORDER BY hari ASC`,
      []
    ).catch(() => []),
  ]);

  const NAMA_BULAN = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  // DAYOFWEEK MySQL: 1 Minggu sampai 7 Sabtu.
  const NAMA_HARI = ['', 'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const jumlahBulan = perBulan.map((x) => angka(x.jumlah));
  const tengah = median(jumlahBulan);

  const baris = perBulan.map((row) => {
    const n = angka(row.jumlah);
    return {
      bulan: NAMA_BULAN[angka(row.bulan)] || String(row.bulan),
      jumlah: n,
      terhadapTengah: tengah ? `${(n / tengah).toFixed(2)}x` : '—',
    };
  });

  const puncak = [...baris].sort((a, b) => b.jumlah - a.jumlah)[0];
  const sepi = [...baris].sort((a, b) => a.jumlah - b.jumlah)[0];

  return {
    judul: 'Musim perkara (seluruh pengadilan)',
    ringkas: puncak
      ? `Paling padat ${puncak.bulan} (${puncak.jumlah}), paling sepi ${sepi.bulan} (${sepi.jumlah}).`
      : 'Belum ada perkara yang tanggal pendaftarannya terbaca.',
    metrik: [
      ...perHari.map((row) => ({
        label: NAMA_HARI[angka(row.hari)] || String(row.hari),
        nilai: String(angka(row.jumlah)),
      })),
    ],
    kolom: [
      { kunci: 'bulan', label: 'Bulan' },
      { kunci: 'jumlah', label: 'Perkara', angka: true },
      { kunci: 'terhadapTengah', label: 'Terhadap bulan tengah' },
    ],
    baris,
    catatan:
      'Dihitung dari SELURUH tahun yang ada di register, digabung per bulan - bukan per tahun. Angka harian memperlihatkan hari kerja mana yang paling banyak menerima pendaftaran.',
  };
}

/**
 * 9. CORONG PERKARA
 *
 * Bukan berapa banyak yang selesai, melainkan DI MANA perkara tersendat.
 *
 * Diukur pada SIPP yang berjalan: dari 10.096 terdaftar, hanya 748 pernah
 * bermediasi, 9.989 putus, 9.743 berkekuatan hukum tetap, 4.604 terbit akta
 * cerainya, dan 11 dimohonkan banding. Susut terbesar ada di antara BHT dan
 * akta cerai - dan itu tidak terlihat pada laporan mana pun yang menghitung
 * tahap satu per satu.
 */
async function corongPerkara() {
  const hitung = async (nama, sql) => {
    const rows = await runQuery(sql, []).catch(() => []);
    return { nama, jumlah: angka((rows[0] || {}).jumlah) };
  };

  const tahap = await Promise.all([
    hitung('Terdaftar', 'SELECT COUNT(*) AS jumlah FROM perkara'),
    hitung(
      'Pernah bermediasi',
      'SELECT COUNT(DISTINCT md.perkara_id) AS jumlah FROM perkara_mediasi md'
    ),
    hitung(
      'Sudah putus',
      'SELECT COUNT(DISTINCT pu.perkara_id) AS jumlah FROM perkara_putusan pu WHERE pu.tanggal_putusan IS NOT NULL'
    ),
    hitung(
      'Sudah diminutasi',
      'SELECT COUNT(DISTINCT pu.perkara_id) AS jumlah FROM perkara_putusan pu WHERE pu.tanggal_minutasi IS NOT NULL'
    ),
    hitung(
      'Berkekuatan hukum tetap',
      'SELECT COUNT(DISTINCT pu.perkara_id) AS jumlah FROM perkara_putusan pu WHERE pu.tanggal_bht IS NOT NULL'
    ),
    hitung(
      'Akta cerai terbit',
      'SELECT COUNT(DISTINCT ac.perkara_id) AS jumlah FROM perkara_akta_cerai ac'
    ),
    hitung('Diarsipkan', 'SELECT COUNT(DISTINCT a.perkara_id) AS jumlah FROM arsip a'),
  ]);

  const awal = tahap[0] ? tahap[0].jumlah : 0;
  let sebelumnya = awal;

  const baris = tahap.map((satu, urutan) => {
    // Mediasi TIDAK dibandingkan dengan tahap sebelumnya - ia bukan tahap
    // yang dilalui semua perkara, melainkan kewajiban bagi sebagian saja.
    // Menghitung susutnya seolah seluruh perkara wajib bermediasi akan
    // menampilkan kegagalan yang tidak pernah ada.
    const bandingkan = urutan > 1;
    const susut = bandingkan && sebelumnya > 0 ? sebelumnya - satu.jumlah : null;
    const hasil = {
      tahap: satu.nama,
      jumlah: satu.jumlah,
      dariTerdaftar: awal > 0 ? `${Math.round((satu.jumlah / awal) * 100)}%` : '—',
      susutDariTahapSebelumnya: susut === null ? '' : String(susut),
    };
    if (urutan >= 2) sebelumnya = satu.jumlah;
    return hasil;
  });

  return {
    judul: 'Corong perkara (seluruh pengadilan)',
    ringkas: `Dari ${awal} perkara terdaftar, ${tahap[2] ? tahap[2].jumlah : 0} sudah putus.`,
    metrik: tahap.map((x) => ({
      label: x.nama,
      nilai: String(x.jumlah),
    })),
    kolom: [
      { kunci: 'tahap', label: 'Tahap' },
      { kunci: 'jumlah', label: 'Perkara', angka: true },
      { kunci: 'dariTerdaftar', label: 'Dari yang terdaftar' },
      { kunci: 'susutDariTahapSebelumnya', label: 'Susut', angka: true },
    ],
    baris,
    catatan:
      'Mediasi tidak dibandingkan dengan tahap sebelumnya - ia kewajiban bagi sebagian perkara saja, bukan tahap yang dilalui semuanya. Akta cerai hanya terbit pada perkara perceraian, sehingga susut di bawah BHT sebagian besar bukan kelalaian.',
  };
}

/**
 * 10. PROFIL PIHAK BERPERKARA
 *
 * Bahan laporan tahunan yang selama ini dihitung dengan menyalin ke Excel.
 *
 * Diukur pada SIPP yang berjalan: rerata umur penggugat 38 tahun (dari
 * 13.665 pihak), dan rerata usia pernikahan sebelum perkara didaftarkan 11
 * tahun (dari 5.683 perkara).
 */
async function profilPihak() {
  const [umur, pekerjaan, pendidikan, nikah] = await Promise.all([
    runQuery(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(YEAR, ph.tanggal_lahir, p.tanggal_pendaftaran))) AS rerata,
              MIN(TIMESTAMPDIFF(YEAR, ph.tanggal_lahir, p.tanggal_pendaftaran)) AS termuda,
              MAX(TIMESTAMPDIFF(YEAR, ph.tanggal_lahir, p.tanggal_pendaftaran)) AS tertua,
              COUNT(*) AS jumlah
         FROM pihak ph
         JOIN v_pihak_perkara vp ON vp.pihak_id = ph.id
         JOIN perkara p ON p.perkara_id = vp.perkara_id
        WHERE ph.tanggal_lahir IS NOT NULL
          AND TIMESTAMPDIFF(YEAR, ph.tanggal_lahir, p.tanggal_pendaftaran) BETWEEN 15 AND 100`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT ph.pekerjaan AS nilai, COUNT(*) AS jumlah
         FROM pihak ph WHERE ph.pekerjaan <> ''
        GROUP BY ph.pekerjaan ORDER BY jumlah DESC LIMIT 10`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT ph.pendidikan AS nilai, COUNT(*) AS jumlah
         FROM pihak ph WHERE ph.pendidikan <> ''
        GROUP BY ph.pendidikan ORDER BY jumlah DESC LIMIT 10`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(YEAR, dn.tgl_nikah, p.tanggal_pendaftaran))) AS rerata,
              COUNT(*) AS jumlah
         FROM perkara_data_pernikahan dn
         JOIN perkara p ON p.perkara_id = dn.perkara_id
        WHERE dn.tgl_nikah IS NOT NULL
          AND TIMESTAMPDIFF(YEAR, dn.tgl_nikah, p.tanggal_pendaftaran) BETWEEN 0 AND 70`,
      []
    ).catch(() => []),
  ]);

  const u = umur[0] || {};
  const nk = nikah[0] || {};

  const baris = [
    ...pekerjaan.map((x) => ({
      kelompok: 'Pekerjaan',
      nilai: cleanText(x.nilai),
      jumlah: angka(x.jumlah),
    })),
    ...pendidikan.map((x) => ({
      kelompok: 'Pendidikan',
      nilai: cleanText(x.nilai),
      jumlah: angka(x.jumlah),
    })),
  ];

  return {
    judul: 'Profil pihak berperkara (seluruh pengadilan)',
    ringkas:
      u.rerata === null || u.rerata === undefined
        ? 'Data umur pihak belum dapat dibaca.'
        : `Rerata umur pihak ${angka(u.rerata)} tahun; rerata usia pernikahan sebelum perkara didaftarkan ${angka(nk.rerata)} tahun.`,
    metrik: [
      { label: 'Rerata umur', nilai: `${angka(u.rerata)} tahun`, keterangan: `${angka(u.jumlah)} pihak` },
      { label: 'Termuda', nilai: `${angka(u.termuda)} tahun` },
      { label: 'Tertua', nilai: `${angka(u.tertua)} tahun` },
      {
        label: 'Usia pernikahan',
        nilai: `${angka(nk.rerata)} tahun`,
        keterangan: `${angka(nk.jumlah)} perkara`,
      },
    ],
    kolom: [
      { kunci: 'kelompok', label: 'Kelompok' },
      { kunci: 'nilai', label: 'Keterangan' },
      { kunci: 'jumlah', label: 'Pihak', angka: true },
    ],
    baris,
    catatan:
      'Umur di luar 15-100 tahun dan usia pernikahan di luar 0-70 tahun dibuang - keduanya hampir selalu salah ketik tanggal lahir, dan satu tanggal keliru dapat menggeser rerata seluruh pengadilan.',
  };
}

/**
 * 11. PERKARA BERISIKO MELEWATI TENGGAT
 *
 * Peringatan SEBELUM terlambat, bukan laporan sesudahnya. Dikelompokkan
 * menurut umurnya, dan yang paling tua disebut satu per satu supaya dapat
 * langsung ditindaklanjuti.
 */
async function perkaraBerisiko() {
  const rows = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            DATEDIFF(CURDATE(), p.tanggal_pendaftaran) AS umurHari
       FROM perkara p
       LEFT JOIN (SELECT perkara_id, MAX(tanggal_putusan) AS tanggalPutusan
                    FROM perkara_putusan GROUP BY perkara_id) pu
              ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggalPutusan IS NULL
        AND p.tanggal_pendaftaran IS NOT NULL
      ORDER BY p.tanggal_pendaftaran ASC
      LIMIT 200`,
    []
  ).catch(() => []);

  const golongan = (hari) => {
    if (hari > 150) return 'LEWAT 5 BULAN';
    if (hari > 120) return 'mendekati 5 bulan';
    if (hari > 90) return 'lewat 3 bulan';
    if (hari > 60) return 'lewat 2 bulan';
    return 'masih dalam waktu';
  };

  const baris = rows.map((row) => {
    const umur = angka(row.umurHari);
    return {
      nomorPerkara: cleanText(row.nomorPerkara),
      jenisPerkara: cleanText(row.jenisPerkara),
      tanggalDaftar: isoTanggal(row.tanggalDaftar),
      umurHari: umur,
      sisaKeAmbang: 150 - umur,
      keadaan: golongan(umur),
    };
  });

  const hitungGolongan = {};
  for (const satu of baris) {
    hitungGolongan[satu.keadaan] = (hitungGolongan[satu.keadaan] || 0) + 1;
  }

  return {
    judul: 'Perkara berisiko melewati tenggat (seluruh pengadilan)',
    ringkas:
      baris.length === 0
        ? 'Tidak ada perkara yang masih berjalan.'
        : `${baris.length} perkara masih berjalan; ${hitungGolongan['LEWAT 5 BULAN'] || 0} sudah melewati ambang SEMA.`,
    metrik: [
      { label: 'Masih berjalan', nilai: String(baris.length) },
      {
        label: 'Lewat 5 bulan',
        nilai: String(hitungGolongan['LEWAT 5 BULAN'] || 0),
        keterangan: 'ambang SEMA 2/2014',
      },
      {
        label: 'Mendekati 5 bulan',
        nilai: String(hitungGolongan['mendekati 5 bulan'] || 0),
        keterangan: 'tersisa kurang dari sebulan',
      },
      { label: 'Lewat 3 bulan', nilai: String(hitungGolongan['lewat 3 bulan'] || 0) },
    ],
    kolom: [
      { kunci: 'nomorPerkara', label: 'Perkara' },
      { kunci: 'jenisPerkara', label: 'Jenis' },
      { kunci: 'tanggalDaftar', label: 'Didaftarkan' },
      { kunci: 'umurHari', label: 'Umur (hari)', angka: true },
      { kunci: 'sisaKeAmbang', label: 'Sisa ke 5 bulan', angka: true },
      { kunci: 'keadaan', label: 'Keadaan' },
    ],
    baris,
    catatan:
      'Diurut dari yang PALING TUA, bukan yang terbaru - yang paling mendesak berada di baris pertama. Sisa negatif berarti ambangnya sudah terlewati.',
  };
}

/**
 * 13. DETEKSI ANOMALI
 *
 * Perkara yang lamanya menyimpang jauh dari kebiasaan JENISNYA SENDIRI.
 *
 * Ambang tetap tidak dapat dipakai di sini: istbat nikah yang selesai dalam
 * sepuluh hari itu wajar, sedangkan cerai gugat yang selesai sepuluh hari
 * patut diperiksa. Diukur pada SIPP yang berjalan, 600 perkara selesai dalam
 * 14 hari atau kurang - dan sebagian besar di antaranya memang jenis yang
 * lazim cepat.
 *
 * Karena itu tiap perkara dibandingkan dengan nilai tengah JENISNYA, dan yang
 * ditandai hanya yang menyimpang lebih dari dua kali lipat ke salah satu
 * arah.
 */
async function deteksiAnomali() {
  const rows = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) AS hari
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan IS NOT NULL
        AND p.tanggal_pendaftaran IS NOT NULL
        AND DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) BETWEEN 0 AND 1000
        AND pu.tanggal_putusan >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
      LIMIT 5000`,
    []
  ).catch(() => []);

  // Nilai tengah per JENIS perkara - bukan satu ambang untuk semuanya.
  const perJenis = new Map();
  for (const row of rows) {
    const jenis = cleanText(row.jenisPerkara) || '(tanpa jenis)';
    if (!perJenis.has(jenis)) perJenis.set(jenis, []);
    perJenis.get(jenis).push(angka(row.hari));
  }

  const tengahJenis = new Map();
  for (const [jenis, daftar] of perJenis) {
    // Jenis dengan pembanding terlalu sedikit tidak dinilai - nilai tengah
    // dari tiga perkara bukan kebiasaan, melainkan kebetulan.
    if (daftar.length >= 20) tengahJenis.set(jenis, median(daftar));
  }

  const baris = [];
  for (const row of rows) {
    const jenis = cleanText(row.jenisPerkara) || '(tanpa jenis)';
    const tengah = tengahJenis.get(jenis);
    if (!tengah) continue;

    const hari = angka(row.hari);
    const rasio = hari / tengah;
    if (rasio >= 0.5 && rasio <= 2) continue;

    baris.push({
      nomorPerkara: cleanText(row.nomorPerkara),
      jenisPerkara: jenis,
      hari,
      tengahJenis: tengah,
      rasio: `${rasio.toFixed(1)}x`,
      keadaan: rasio > 2 ? 'jauh lebih lama' : 'jauh lebih cepat',
    });
  }

  baris.sort((a, b) => Number(b.rasio.replace('x', '')) - Number(a.rasio.replace('x', '')));

  const lebihLama = baris.filter((x) => x.keadaan === 'jauh lebih lama').length;

  return {
    judul: 'Perkara yang menyimpang dari kebiasaan jenisnya (dua tahun terakhir)',
    ringkas:
      baris.length === 0
        ? 'Tidak ada perkara yang menyimpang jauh.'
        : `${baris.length} perkara menyimpang lebih dari dua kali lipat; ${lebihLama} di antaranya jauh lebih lama.`,
    metrik: [
      { label: 'Perkara diperiksa', nilai: String(rows.length) },
      { label: 'Jenis yang dinilai', nilai: String(tengahJenis.size) },
      { label: 'Jauh lebih lama', nilai: String(lebihLama) },
      { label: 'Jauh lebih cepat', nilai: String(baris.length - lebihLama) },
    ],
    kolom: [
      { kunci: 'nomorPerkara', label: 'Perkara' },
      { kunci: 'jenisPerkara', label: 'Jenis' },
      { kunci: 'hari', label: 'Lama (hari)', angka: true },
      { kunci: 'tengahJenis', label: 'Tengah jenisnya', angka: true },
      { kunci: 'rasio', label: 'Rasio' },
      { kunci: 'keadaan', label: 'Keadaan' },
    ],
    baris: baris.slice(0, 200),
    catatan:
      'Menyimpang BUKAN berarti keliru - perkara yang dicabut sehari sesudah didaftarkan wajar sangat cepat, dan perkara dengan pihak ghaib wajar sangat lama. Ini penanda untuk diperiksa, bukan temuan.',
  };
}

/**
 * 16. PEMANTAU SEMA DAN PERMA
 *
 * Satu baris per aturan: lulus atau tidak, beserta dasarnya. Menggantikan
 * kebiasaan memeriksanya dari ingatan.
 *
 * Diukur pada SIPP yang berjalan: ada 194 perkara gugatan yang kedua
 * pihaknya pernah hadir tetapi tidak punya catatan mediasi sama sekali.
 */
async function pemantauAturan(perkara) {
  const id = perkara.perkaraId;

  const [putusan, mediasi, hadir, ikrar] = await Promise.all([
    runQuery(
      `SELECT pu.tanggal_putusan AS putus,
              pu.tanggal_minutasi AS minutasi,
              pu.tanggal_bht AS bht
         FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
      [id]
    ).catch(() => []),
    runQuery(
      'SELECT COUNT(*) AS jumlah FROM perkara_mediasi md WHERE md.perkara_id = ?',
      [id]
    ).catch(() => []),
    runQuery(
      `SELECT COUNT(*) AS jumlah FROM perkara_jadwal_sidang j
        WHERE j.perkara_id = ? AND j.dihadiri_oleh = '1'`,
      [id]
    ).catch(() => []),
    runQuery(
      // Nama kolomnya tgl_ikrar_talak, bukan tanggal_ikrar - dibaca langsung
      // dari SIPP yang berjalan. Nama yang keliru gagal DIAM-DIAM lewat catch
      // dan melaporkan 'belum waktunya' padahal ikrarnya sudah tercatat.
      `SELECT ik.tgl_ikrar_talak AS tanggalIkrar FROM perkara_ikrar_talak ik
        WHERE ik.perkara_id = ? LIMIT 1`,
      [id]
    ).catch(() => []),
  ]);

  const p = putusan[0] || {};
  const tanggalPutus = isoTanggal(p.putus);
  const adaMediasi = angka((mediasi[0] || {}).jumlah) > 0;
  const keduaHadir = angka((hadir[0] || {}).jumlah) > 0;
  const gugatan = /\/Pdt\.G/i.test(cleanText(perkara.nomorPerkara));
  const umur = selisihHari(isoTanggal(perkara.tanggalDaftar), tanggalPutus || isoTanggal(new Date()));
  const jedaMinutasi = selisihHari(tanggalPutus, isoTanggal(p.minutasi));

  const baris = [
    {
      aturan: 'PERMA 1/2016 - kewajiban mediasi',
      keadaan: !gugatan
        ? 'tidak berlaku'
        : !keduaHadir
          ? 'tidak berlaku'
          : adaMediasi
            ? 'terpenuhi'
            : 'PERIKSA',
      dasar: !gugatan
        ? 'Bukan perkara gugatan.'
        : !keduaHadir
          ? 'Tidak ada sidang yang kedua pihaknya hadir.'
          : adaMediasi
            ? 'Data mediasi tercatat.'
            : 'Kedua pihak pernah hadir tetapi tidak ada catatan mediasi.',
    },
    {
      aturan: 'SEMA 2/2014 - selesai dalam 5 bulan',
      keadaan:
        umur === null ? 'belum terbaca' : umur > 150 ? 'PERIKSA' : 'terpenuhi',
      dasar:
        umur === null
          ? 'Tanggal pendaftaran atau putusannya belum terbaca.'
          : tanggalPutus
            ? `Selesai dalam ${umur} hari.`
            : `Sudah berjalan ${umur} hari dan belum putus.`,
    },
    {
      aturan: 'Minutasi paling lama 14 hari sesudah putus',
      keadaan: !tanggalPutus
        ? 'belum waktunya'
        : jedaMinutasi === null
          ? 'PERIKSA'
          : jedaMinutasi > 14
            ? 'PERIKSA'
            : 'terpenuhi',
      dasar: !tanggalPutus
        ? 'Perkara belum diputus.'
        : jedaMinutasi === null
          ? 'Belum diminutasi.'
          : `Diminutasi ${jedaMinutasi} hari sesudah putus.`,
    },
    {
      aturan: 'Ikrar talak dalam 6 bulan sesudah BHT',
      keadaan: (() => {
        const bht = isoTanggal(p.bht);
        const tanggalIkrar = isoTanggal((ikrar[0] || {}).tanggalIkrar);
        if (!/\/Pdt\.G/i.test(cleanText(perkara.nomorPerkara))) return 'tidak berlaku';
        if (!bht) return 'belum waktunya';
        if (tanggalIkrar) return 'terpenuhi';
        const lewat = selisihHari(bht, isoTanggal(new Date()));
        return lewat !== null && lewat > 180 ? 'PERIKSA' : 'belum waktunya';
      })(),
      dasar: 'Berlaku pada cerai talak; perkara lain tidak menerbitkan ikrar.',
    },
  ];

  const periksa = baris.filter((x) => x.keadaan === 'PERIKSA').length;

  return {
    judul: 'Pemantau SEMA dan PERMA',
    ringkas:
      periksa === 0
        ? 'Tidak ada aturan yang menuntut pemeriksaan pada perkara ini.'
        : `${periksa} aturan perlu diperiksa.`,
    metrik: [
      { label: 'Aturan diperiksa', nilai: String(baris.length) },
      { label: 'Perlu diperiksa', nilai: String(periksa) },
      {
        label: 'Tidak berlaku',
        nilai: String(baris.filter((x) => x.keadaan === 'tidak berlaku').length),
      },
    ],
    kolom: [
      { kunci: 'aturan', label: 'Aturan' },
      { kunci: 'keadaan', label: 'Keadaan' },
      { kunci: 'dasar', label: 'Dasar' },
    ],
    baris,
    catatan:
      'PERIKSA berarti ada yang patut ditelusuri, BUKAN pelanggaran - sebagian perkara punya alasan sah yang tidak terekam di SIPP. Ikrar talak hanya berlaku pada cerai talak, dan tabelnya tidak ada pada sebagian versi SIPP.',
  };
}

/**
 * 18. MAJELIS PERKARA INI DIBANDING NILAI TENGAH PENGADILAN
 *
 * Kinerja majelis sudah dapat dibaca sendiri, tetapi angka tanpa pembanding
 * tidak berarti apa-apa: rerata 40 hari itu cepat atau lambat hanya dapat
 * dijawab bila nilai tengah pengadilannya diketahui.
 */
async function majelisTerhadapRerata(perkara) {
  const hakim = await runQuery(
    `SELECT hk.hakim_id AS hakimId, hk.hakim_nama AS nama, hk.jabatan_hakim_id AS jabatan
       FROM perkara_hakim_pn hk WHERE hk.perkara_id = ?
      ORDER BY hk.jabatan_hakim_id ASC LIMIT 10`,
    [perkara.perkaraId]
  ).catch(() => []);

  // Nilai tengah pengadilan - satu kali, dipakai seluruh baris.
  const semua = await runQuery(
    `SELECT DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) AS hari
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan IS NOT NULL
        AND DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) BETWEEN 0 AND 1000
      LIMIT 10000`,
    []
  ).catch(() => []);

  const tengahPengadilan = median(semua.map((x) => angka(x.hari)));

  const baris = [];
  for (const satu of hakim) {
    const idHakim = Number(satu.hakimId);
    if (!Number.isFinite(idHakim) || idHakim <= 0) continue;

    const rows = await runQuery(
      `SELECT DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) AS hari,
              pu.putusan_verstek AS verstek
         FROM perkara_hakim_pn hk
         JOIN perkara p ON p.perkara_id = hk.perkara_id
         JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
        WHERE hk.hakim_id = ?
          AND pu.tanggal_putusan IS NOT NULL
          AND DATEDIFF(pu.tanggal_putusan, p.tanggal_pendaftaran) BETWEEN 0 AND 1000
        LIMIT 5000`,
      [idHakim]
    ).catch(() => []);

    const hari = rows.map((x) => angka(x.hari));
    const tengah = median(hari);
    const verstek = rows.filter((x) => cleanText(x.verstek).toUpperCase() === 'Y').length;

    baris.push({
      nama: cleanText(satu.nama),
      kedudukan: Number(satu.jabatan) === 1 ? 'Ketua Majelis' : 'Anggota',
      putusDinilai: rows.length,
      tengahHari: tengah,
      terhadapPengadilan:
        tengah !== null && tengahPengadilan
          ? `${(tengah / tengahPengadilan).toFixed(2)}x`
          : '—',
      verstek: rows.length > 0 ? `${Math.round((verstek / rows.length) * 100)}%` : '—',
    });
  }

  return {
    judul: 'Majelis perkara ini dibanding nilai tengah pengadilan',
    ringkas:
      baris.length === 0
        ? 'Majelis belum tercatat pada perkara ini.'
        : `Nilai tengah pengadilan ${tengahPengadilan} hari; angka di bawah 1,00x berarti lebih cepat daripada itu.`,
    metrik: [
      {
        label: 'Nilai tengah pengadilan',
        nilai: tengahPengadilan === null ? '—' : `${tengahPengadilan} hari`,
        keterangan: `${semua.length} perkara`,
      },
      { label: 'Hakim dinilai', nilai: String(baris.length) },
    ],
    kolom: [
      { kunci: 'nama', label: 'Hakim' },
      { kunci: 'kedudukan', label: 'Kedudukan' },
      { kunci: 'putusDinilai', label: 'Putusan dinilai', angka: true },
      { kunci: 'tengahHari', label: 'Tengah (hari)', angka: true },
      { kunci: 'terhadapPengadilan', label: 'Terhadap pengadilan' },
      { kunci: 'verstek', label: 'Verstek' },
    ],
    baris,
    catatan:
      'Nilai TENGAH, bukan rata-rata - satu perkara yang tertunda bertahun-tahun tidak menarik seluruh angka. Cepat belum tentu baik: jenis perkara yang ditangani tiap majelis berbeda, dan itu tidak diperhitungkan di sini.',
  };
}

/* ==========================================================================
 * TAHAP 4
 * ========================================================================== */

/**
 * 2. MUTU PERTIMBANGAN HUKUM
 *
 * Seluruh penilaian yang ada sampai sekarang menilai KETEPATAN WAKTU. Tidak
 * satu pun menyentuh isinya - dan isi pertimbangan hukum justru yang dibaca
 * pihak, pengadilan tingkat banding, dan masyarakat.
 *
 * Yang dinilai di sini hal yang dapat dihitung tanpa menafsirkan hukum:
 * panjangnya, kepadatan rujukan, dan penyebutan sumber hukumnya. Diukur pada
 * SIPP yang berjalan: 2.224 pertimbangan, rerata 8.109 huruf, 2.193 di
 * antaranya mengutip Pasal, 1.920 menyebut KHI, dan 2.178 menyebut
 * Undang-Undang.
 *
 * Yang TIDAK dinilai: apakah pertimbangannya benar, apakah penalarannya
 * runtut, apakah dalilnya tepat. Itu penilaian hukum, dan bukan pekerjaan
 * kueri - panjang bukan mutu, dan banyak kutipan bukan berarti tepat.
 */
async function mutuPertimbangan(perkara) {
  const rows = await runQuery(
    `SELECT ph.pertimbangan_hukum AS teks,
            ph.tanggal_pertimbangan_hukum AS tanggal
       FROM perkara_pertimbangan_hukum ph
      WHERE ph.perkara_id = ?
      LIMIT 10`,
    [perkara.perkaraId]
  ).catch(() => []);

  const teks = rows.map((x) => String(x.teks || '')).join('\n');

  if (!teks.trim()) {
    return {
      judul: 'Mutu pertimbangan hukum',
      ringkas: 'Pertimbangan hukum perkara ini belum terisi di SIPP.',
      metrik: [],
      kolom: [],
      baris: [],
      catatan:
        'Pertimbangan hukum diinput terpisah dari putusannya; kosong di sini tidak berarti putusannya tanpa pertimbangan.',
    };
  }

  // Pembanding: sebaran seluruh pertimbangan di pengadilan ini.
  const banding = await runQuery(
    `SELECT CHAR_LENGTH(ph.pertimbangan_hukum) AS panjang
       FROM perkara_pertimbangan_hukum ph
      WHERE ph.pertimbangan_hukum IS NOT NULL AND ph.pertimbangan_hukum <> ''
      LIMIT 5000`,
    []
  ).catch(() => []);

  const tengahPanjang = median(banding.map((x) => angka(x.panjang)));
  const panjang = teks.length;

  const hitung = (pola) => (teks.match(pola) || []).length;

  const butir = [
    {
      butir: 'Rujukan pasal',
      jumlah: hitung(/\bPasal\s+\d+/gi),
      keterangan: 'Penyebutan pasal beserta nomornya.',
    },
    {
      butir: 'Kompilasi Hukum Islam',
      jumlah: hitung(/\bKHI\b|Kompilasi Hukum Islam/gi),
      keterangan: 'Rujukan KHI.',
    },
    {
      butir: 'Undang-Undang',
      jumlah: hitung(/Undang-Undang|UU\s+No/gi),
      keterangan: 'Rujukan undang-undang.',
    },
    {
      butir: 'Yurisprudensi atau SEMA',
      jumlah: hitung(/yurisprudensi|SEMA|PERMA/gi),
      keterangan: 'Rujukan di luar peraturan pokok.',
    },
    {
      butir: 'Dalil syar\'i',
      jumlah: hitung(/firman Allah|hadis|hadits|Al-?Qur|sabda/gi),
      keterangan: 'Penyebutan dalil naqli.',
    },
    {
      butir: 'Paragraf Menimbang',
      jumlah: hitung(/Menimbang/gi),
      keterangan: 'Banyaknya paragraf pertimbangan.',
    },
  ];

  const adaRujukan = butir.slice(0, 5).filter((x) => x.jumlah > 0).length;

  return {
    judul: 'Mutu pertimbangan hukum',
    ringkas: `${panjang.toLocaleString('id-ID')} huruf, ${adaRujukan} dari 5 jenis rujukan disebut.`,
    metrik: [
      { label: 'Panjang', nilai: `${panjang.toLocaleString('id-ID')} huruf` },
      {
        label: 'Terhadap tengah pengadilan',
        nilai: tengahPanjang ? `${(panjang / tengahPanjang).toFixed(2)}x` : '—',
        keterangan: tengahPanjang ? `tengah ${tengahPanjang.toLocaleString('id-ID')} huruf` : '',
      },
      { label: 'Jenis rujukan disebut', nilai: `${adaRujukan} dari 5` },
      {
        label: 'Paragraf Menimbang',
        nilai: String(butir[5].jumlah),
      },
    ],
    kolom: [
      { kunci: 'butir', label: 'Butir' },
      { kunci: 'jumlah', label: 'Jumlah', angka: true },
      { kunci: 'keterangan', label: 'Keterangan' },
    ],
    baris: butir,
    catatan:
      'Yang dihitung KEBERADAAN rujukan, bukan ketepatannya - panjang bukan mutu, dan banyak kutipan bukan berarti tepat. Menilai penalarannya adalah pekerjaan hakim, bukan pekerjaan kueri.',
  };
}

/**
 * 5. KEAJEKAN PUTUSAN ANTAR MAJELIS
 *
 * Untuk jenis perkara yang sama, apakah hasilnya berbeda jauh antar majelis?
 *
 * status_putusan_nama TIDAK dapat dipakai: kolomnya kosong pada 9.470 dari
 * 9.989 baris. Hasilnya karena itu disimpulkan dari TEKS AMAR - yang terisi
 * pada 9.989 baris, dengan sebaran kabul 9.423, tolak 130, dan tidak dapat
 * diterima 112.
 *
 * Menyimpulkan dari teks selalu kasar: amar yang berbunyi 'mengabulkan
 * sebagian dan menolak selebihnya' terhitung dua-duanya. Itu disebutkan di
 * catatannya, dan angkanya dibaca sebagai kecenderungan - bukan sebagai
 * hitungan resmi.
 */
async function keajekanPutusan(perkara) {
  const jenis = cleanText(perkara.jenisPerkara);
  if (!jenis) {
    return {
      judul: 'Keajekan putusan antar majelis',
      ringkas: 'Jenis perkara belum terbaca.',
      metrik: [],
      kolom: [],
      baris: [],
      catatan: '',
    };
  }

  const rows = await runQuery(
    `SELECT hk.hakim_nama AS hakim,
            SUM(CASE WHEN pu.amar_putusan LIKE '%mengabulkan%' THEN 1 ELSE 0 END) AS kabul,
            SUM(CASE WHEN pu.amar_putusan LIKE '%menolak%' THEN 1 ELSE 0 END) AS tolak,
            SUM(CASE WHEN pu.amar_putusan LIKE '%tidak dapat diterima%' THEN 1 ELSE 0 END) AS tidakDiterima,
            COUNT(*) AS jumlah
       FROM perkara_hakim_pn hk
       JOIN perkara p ON p.perkara_id = hk.perkara_id
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_nama = ?
        AND hk.jabatan_hakim_id = 1
        AND pu.amar_putusan IS NOT NULL
        AND pu.amar_putusan <> ''
      GROUP BY hk.hakim_nama
      HAVING jumlah >= 20
      ORDER BY jumlah DESC
      LIMIT 30`,
    [jenis]
  ).catch(() => []);

  const baris = rows.map((row) => {
    const total = angka(row.jumlah);
    const persen = (n) => (total > 0 ? Math.round((angka(n) / total) * 100) : 0);
    return {
      hakim: cleanText(row.hakim),
      putusan: total,
      kabul: `${persen(row.kabul)}%`,
      tolak: `${persen(row.tolak)}%`,
      tidakDiterima: `${persen(row.tidakDiterima)}%`,
      _kabul: persen(row.kabul),
    };
  });

  const angkaKabul = baris.map((x) => x._kabul);
  const rentang =
    angkaKabul.length > 0 ? Math.max(...angkaKabul) - Math.min(...angkaKabul) : null;

  return {
    judul: `Keajekan putusan - ${jenis}`,
    ringkas:
      baris.length === 0
        ? `Belum ada ketua majelis dengan sekurang-kurangnya 20 putusan ${jenis}.`
        : `${baris.length} ketua majelis dibandingkan; rentang tingkat kabul ${rentang} poin persen.`,
    metrik: [
      { label: 'Ketua majelis dibandingkan', nilai: String(baris.length) },
      {
        label: 'Rentang tingkat kabul',
        nilai: rentang === null ? '—' : `${rentang} poin`,
        keterangan: 'makin lebar makin tidak ajek',
      },
    ],
    kolom: [
      { kunci: 'hakim', label: 'Ketua majelis' },
      { kunci: 'putusan', label: 'Putusan', angka: true },
      { kunci: 'kabul', label: 'Kabul' },
      { kunci: 'tolak', label: 'Tolak' },
      { kunci: 'tidakDiterima', label: 'Tidak diterima' },
    ],
    baris: baris.map(({ _kabul, ...sisa }) => sisa),
    catatan:
      'Hasil disimpulkan dari TEKS amar, sebab kolom jenis putusan kosong pada hampir seluruh baris. Amar yang berbunyi \'mengabulkan sebagian dan menolak selebihnya\' terhitung pada keduanya, sehingga persentasenya dapat melebihi 100 - angka ini kecenderungan, bukan hitungan resmi. Perbedaan antar majelis belum tentu ketidakajekan: perkaranya sendiri berbeda-beda.',
  };
}

/**
 * 12. PROFIL UPAYA HUKUM
 *
 * ==========================================================================
 * MENGAPA INI BUKAN PRAKIRAAN
 * ==========================================================================
 *
 * Rencana semula memperkirakan kemungkinan banding dari ciri perkaranya.
 * Setelah datanya diukur, rencana itu dibatalkan: di SELURUH register hanya
 * ada 11 banding, 2 kasasi, dan 1 peninjauan kembali dari 10.096 perkara.
 *
 * Model yang dilatih pada 14 contoh bukan prakiraan melainkan tebakan yang
 * berpakaian angka - dan tebakan yang disajikan sebagai persentase akan
 * dipercaya jauh melebihi yang pantas.
 *
 * Yang disajikan sebagai gantinya kenyataannya: berapa angka dasarnya, dan
 * perkara mana saja yang pernah dimohonkan upaya hukum. Empat belas perkara
 * dapat dibaca satu per satu - dan membacanya sendiri lebih berguna daripada
 * persentase yang tidak berdasar.
 */
async function profilUpayaHukum() {
  const [jumlahPerkara, banding, kasasi, pk] = await Promise.all([
    runQuery('SELECT COUNT(*) AS jumlah FROM perkara', []).catch(() => []),
    runQuery(
      `SELECT p.nomor_perkara AS nomorPerkara,
              p.jenis_perkara_nama AS jenisPerkara,
              pu.putusan_verstek AS verstek,
              pu.tanggal_putusan AS tanggalPutusan
         FROM perkara_banding b
         JOIN perkara p ON p.perkara_id = b.perkara_id
         LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
        ORDER BY pu.tanggal_putusan DESC LIMIT 50`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT p.nomor_perkara AS nomorPerkara, p.jenis_perkara_nama AS jenisPerkara
         FROM perkara_kasasi k JOIN perkara p ON p.perkara_id = k.perkara_id LIMIT 50`,
      []
    ).catch(() => []),
    runQuery(
      `SELECT p.nomor_perkara AS nomorPerkara, p.jenis_perkara_nama AS jenisPerkara
         FROM perkara_pk q JOIN perkara p ON p.perkara_id = q.perkara_id LIMIT 50`,
      []
    ).catch(() => []),
  ]);

  const total = angka((jumlahPerkara[0] || {}).jumlah);
  const baris = [
    ...banding.map((x) => ({
      tingkat: 'Banding',
      nomorPerkara: cleanText(x.nomorPerkara),
      jenisPerkara: cleanText(x.jenisPerkara),
      verstek: cleanText(x.verstek).toUpperCase() === 'Y' ? 'ya' : '',
      tanggalPutusan: isoTanggal(x.tanggalPutusan),
    })),
    ...kasasi.map((x) => ({
      tingkat: 'Kasasi',
      nomorPerkara: cleanText(x.nomorPerkara),
      jenisPerkara: cleanText(x.jenisPerkara),
      verstek: '',
      tanggalPutusan: '',
    })),
    ...pk.map((x) => ({
      tingkat: 'Peninjauan kembali',
      nomorPerkara: cleanText(x.nomorPerkara),
      jenisPerkara: cleanText(x.jenisPerkara),
      verstek: '',
      tanggalPutusan: '',
    })),
  ];

  const angkaDasar = total > 0 ? ((banding.length / total) * 100).toFixed(2) : '0';

  return {
    judul: 'Profil upaya hukum (seluruh pengadilan)',
    ringkas: `${banding.length} banding dari ${total} perkara - ${angkaDasar}% dari seluruh perkara.`,
    metrik: [
      { label: 'Banding', nilai: String(banding.length) },
      { label: 'Kasasi', nilai: String(kasasi.length) },
      { label: 'Peninjauan kembali', nilai: String(pk.length) },
      {
        label: 'Angka dasar banding',
        nilai: `${angkaDasar}%`,
        keterangan: `dari ${total} perkara`,
      },
    ],
    kolom: [
      { kunci: 'tingkat', label: 'Tingkat' },
      { kunci: 'nomorPerkara', label: 'Perkara' },
      { kunci: 'jenisPerkara', label: 'Jenis' },
      { kunci: 'verstek', label: 'Verstek' },
      { kunci: 'tanggalPutusan', label: 'Diputus' },
    ],
    baris,
    catatan:
      'Ini BUKAN prakiraan. Rencana semula memperkirakan kemungkinan banding dari ciri perkara, tetapi contohnya terlalu sedikit - belasan dari sepuluh ribu. Model yang dilatih pada belasan contoh adalah tebakan berpakaian angka, dan angka membuatnya dipercaya melebihi yang pantas. Yang disajikan kenyataannya, dan daftarnya cukup pendek untuk dibaca satu per satu.',
  };
}

/* ==========================================================================
 * PEMERIKSA PERTIMBANGAN HUKUM
 * ==========================================================================
 *
 * Memeriksa tiga hal pada satu putusan:
 *
 *   1. Tiap butir petitum dijawab atau tidak - baik di amar maupun di
 *      pertimbangan.
 *   2. Dasar hukumnya disebut atau tidak.
 *   3. Amar sejalan dengan pertimbangannya atau tidak.
 *
 * ==========================================================================
 * MENGAPA INI TIDAK MEMBERI NILAI
 * ==========================================================================
 *
 * Keluarannya TEMUAN, bukan angka. Pencocokan kata tidak dapat membedakan
 * petitum yang benar-benar tidak dijawab dari petitum yang dijawab dengan
 * kalimat lain - dan sebuah angka "kelengkapan 71%" akan dipercaya melebihi
 * yang pantas, lalu masuk ke rapor orang.
 *
 * Yang disajikan: butir mana yang tidak ditemukan padanannya, supaya
 * seseorang membacanya sendiri. Itulah batas yang jujur untuk alat sekasar
 * ini.
 *
 * Diukur pada SIPP yang berjalan: petitum terisi pada 10.064 dari 10.096
 * perkara, tetapi pertimbangan hukum hanya pada 2.224 - jadi pada sebagian
 * besar perkara pemeriksaan ini memang belum ada bahannya, dan itu dikatakan
 * apa adanya alih-alih dihitung sebagai nol.
 */

const NAMA_BULAN_PANJANG = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "25 Juni 2026" - bentuk yang dibaca orang, bukan 2026-06-25. */
function tanggalPanjang(nilai) {
  const iso = isoTanggal(nilai);
  const [tahun, bulan, hari] = String(iso).split('-').map(Number);
  if (!tahun || !bulan || !hari) return 'tanggal yang tidak tercatat';
  return `${hari} ${NAMA_BULAN_PANJANG[bulan]} ${tahun}`;
}

/** Membuang tanda HTML - petitum, amar, dan pertimbangan seluruhnya HTML. */
function tanpaTag(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .split('\n')
    .map((baris) => baris.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Kata isi - yang membedakan satu butir petitum dari butir lainnya. */
const KATA_UMUM = new Set([
  'yang', 'dan', 'atau', 'untuk', 'kepada', 'dari', 'pada', 'dengan', 'dalam',
  'oleh', 'ini', 'itu', 'agar', 'serta', 'atas', 'akan', 'telah', 'sebagai',
  'adalah', 'bahwa', 'tersebut', 'para', 'satu', 'dua', 'tiga', 'huruf',
  'berupa', 'sejumlah', 'sebesar', 'terhadap', 'depan', 'sidang', 'di', 'ke',
]);

function kataIsi(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/[^a-zà-ɏ\s]/g, ' ')
    .split(/\s+/)
    .filter((kata) => kata.length >= 4 && !KATA_UMUM.has(kata));
}

/**
 * Memecah petitum atau amar menjadi butir.
 *
 * Penomorannya beragam - "1.", "1)", "Primer", butir <li> tanpa nomor - jadi
 * pemecahnya baris, bukan pola nomor. Baris yang terlalu pendek dibuang
 * karena "Primer" dan "Subsider" bukan butir tuntutan.
 */
function pecahButir(teks) {
  return tanpaTag(teks)
    .split('\n')
    .map((baris) => baris.replace(/^\s*(\d+[.)]|\d+\.\d+|-|•)\s*/, '').trim())
    .filter((baris) => baris.length >= 15);
}

async function periksaPertimbangan(perkara) {
  const [barisPetitum, barisPertimbangan, barisPutusan] = await Promise.all([
    runQuery(
      `SELECT p.petitum AS petitum
         FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ).catch(() => []),
    runQuery(
      `SELECT ph.pertimbangan_hukum AS teks
         FROM perkara_pertimbangan_hukum ph WHERE ph.perkara_id = ? LIMIT 5`,
      [perkara.perkaraId]
    ).catch(() => []),
    runQuery(
      `SELECT pu.amar_putusan AS amar,
              pu.status_putusan_nama AS status,
              pu.tanggal_putusan AS tanggalPutusan
         FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ).catch(() => []),
  ]);

  const petitum = pecahButir((barisPetitum[0] || {}).petitum);
  const pertimbangan = tanpaTag(barisPertimbangan.map((x) => x.teks).join('\n'));
  const amarMentah = (barisPutusan[0] || {}).amar;
  const amar = pecahButir(amarMentah);
  const amarTeks = tanpaTag(amarMentah).toLowerCase();
  const pertimbanganKecil = pertimbangan.toLowerCase();

  if (!petitum.length) {
    return {
      judul: 'Pemeriksa pertimbangan hukum',
      ringkas: 'Petitum perkara ini belum terisi di SIPP, sehingga tidak ada yang dapat dicocokkan.',
      catatan:
        'Petitum terisi pada 10.064 dari 10.096 perkara di pengadilan ini - perkara ini termasuk yang belum.',
    };
  }

  /* ---------------------------------------------------- 1. petitum dijawab */
  const temuan = [];
  let terjawab = 0;

  for (const butir of petitum) {
    const kata = kataIsi(butir);
    if (!kata.length) continue;

    const adaDi = (sasaran) => {
      const cocok = kata.filter((k) => sasaran.includes(k)).length;
      return { cocok, bagian: cocok / kata.length };
    };

    const diAmar = adaDi(amarTeks);
    const diPertimbangan = adaDi(pertimbanganKecil);
    // Setengah kata isinya harus muncul. Ambang ini KASAR dan memang tidak
    // dipakai untuk menyimpulkan, hanya untuk memilih butir mana yang layak
    // dibaca orang.
    const dijawab = diAmar.bagian >= 0.5 || diPertimbangan.bagian >= 0.5;
    if (dijawab) terjawab += 1;

    temuan.push({
      butir: butir.length > 160 ? `${butir.slice(0, 157)}...` : butir,
      diAmar: diAmar.bagian >= 0.5 ? 'ya' : '-',
      diPertimbangan: diPertimbangan.bagian >= 0.5 ? 'ya' : '-',
      perluDibaca: dijawab ? '' : 'PERIKSA',
    });
  }

  /* --------------------------------------------------- 2. dasar hukumnya */
  const hitung = (pola) => (pertimbangan.match(pola) || []).length;
  const rujukan = [
    { nama: 'Pasal bernomor', jumlah: hitung(/\bPasal\s+\d+/gi) },
    { nama: 'Undang-Undang', jumlah: hitung(/Undang-Undang|\bUU\s*(No|Nomor)/gi) },
    { nama: 'Kompilasi Hukum Islam', jumlah: hitung(/\bKHI\b|Kompilasi Hukum Islam/gi) },
    { nama: 'HIR atau R.Bg', jumlah: hitung(/\bHIR\b|R\.?\s?Bg/gi) },
    { nama: 'PERMA, SEMA, atau yurisprudensi', jumlah: hitung(/PERMA|SEMA|[Yy]urisprudensi/g) },
  ];
  const totalRujukan = rujukan.reduce((jumlah, x) => jumlah + x.jumlah, 0);
  const rincianRujukan = rujukan
    .filter((x) => x.jumlah > 0)
    .map((x) => `${x.nama} ${x.jumlah}`)
    .join(', ');

  /* ------------------------------------------- 3. amar sejalan pertimbangan */
  /**
   * Kata kerja amar yang saling bertentangan.
   *
   * Kalau pertimbangan menyimpulkan "menolak" sementara amarnya
   * "mengabulkan" - atau sebaliknya - salah satunya keliru. Ini pemeriksaan
   * paling kasar dari ketiganya dan paling sering keliru menuduh, karena
   * pertimbangan lazim menyebut kedua kata saat menguraikan dalil pihak. Itu
   * sebabnya yang dilaporkan hanya ketiadaan padanan, bukan tuduhan.
   */
  /**
   * Dicocokkan pada KATA DASARNYA, bukan bentuk berimbuhannya.
   *
   * Amar menulis "Mengabulkan" sementara pertimbangan lazim menutup dengan
   * "dikabulkan". Mencocokkan bentuk persisnya membuat peringatan ini
   * menyala pada hampir setiap perkara - diuji pada 359/Pdt.G/2026 dan
   * 215/Pdt.P/2026, keduanya menyala palsu - dan peringatan yang selalu
   * menyala berhenti dibaca orang.
   */
  const ARAH = [
    { nama: 'mengabulkan', amar: /mengabulkan/i, dasar: /kabul/i },
    { nama: 'menolak', amar: /menolak/i, dasar: /tolak/i },
    { nama: 'tidak dapat diterima', amar: /tidak dapat diterima/i, dasar: /tidak dapat diterima|niet ontvankelijke/i },
    { nama: 'cabut', amar: /mencabut|dicabut/i, dasar: /cabut/i },
    { nama: 'gugur', amar: /gugur/i, dasar: /gugur/i },
  ];
  const cocokArah = ARAH.find((x) => x.amar.test(amarTeks));
  const arahAmar = cocokArah ? cocokArah.nama : '';
  const arahDisebutPertimbangan = cocokArah ? cocokArah.dasar.test(pertimbanganKecil) : false;

  const belumTerjawab = temuan.filter((x) => x.perluDibaca).length;
  const adaPertimbangan = Boolean(pertimbangan.trim());

  const catatan = [
    'Ini alat baca, BUKAN penilaian. Pencocokannya berdasarkan kesamaan kata, sehingga petitum yang dijawab dengan kalimat berbeda akan ikut ditandai PERIKSA. Yang ditandai perlu dibaca sendiri, bukan diperbaiki begitu saja.',
  ];
  if (!adaPertimbangan) {
    catatan.push(
      'Pertimbangan hukum perkara ini belum terisi di SIPP - terisi pada 2.224 dari 10.096 perkara - sehingga pencocokan hanya menempuh amar putusan.'
    );
  }
  if (arahAmar && !arahDisebutPertimbangan && adaPertimbangan) {
    catatan.push(
      `Amar berbunyi "${arahAmar}" tetapi kata itu tidak muncul di pertimbangan. Sering kali ini hanya perbedaan susunan kalimat - periksa sendiri sebelum menyimpulkan.`
    );
  }

  return {
    judul: 'Pemeriksa pertimbangan hukum',
    ringkas: adaPertimbangan
      ? `${petitum.length} butir petitum, ${terjawab} menemukan padanannya, ${belumTerjawab} perlu dibaca sendiri.`
      : `${petitum.length} butir petitum dicocokkan ke amar saja - pertimbangan hukum belum diinput.`,
    metrik: [
      { label: 'Butir petitum', nilai: String(petitum.length) },
      { label: 'Menemukan padanan', nilai: String(terjawab) },
      { label: 'Perlu dibaca', nilai: String(belumTerjawab), keterangan: 'bukan berarti keliru' },
      { label: 'Butir amar', nilai: String(amar.length) },
      {
        label: 'Rujukan hukum',
        nilai: String(totalRujukan),
        keterangan: adaPertimbangan
          ? rincianRujukan || 'tidak satu pun rujukan terbaca'
          : 'pertimbangan kosong',
      },
      {
        label: 'Arah amar',
        nilai: arahAmar || 'tidak terbaca',
        keterangan: arahAmar && adaPertimbangan
          ? arahDisebutPertimbangan
            ? 'juga disebut di pertimbangan'
            : 'tidak disebut di pertimbangan'
          : '',
      },
    ],
    kolom: [
      { kunci: 'butir', label: 'Butir petitum' },
      { kunci: 'diAmar', label: 'Di amar' },
      { kunci: 'diPertimbangan', label: 'Di pertimbangan' },
      { kunci: 'perluDibaca', label: 'Tanda' },
    ],
    baris: temuan,
    catatan: catatan.join(' '),
  };
}

/* ==========================================================================
 * RINGKASAN PERKARA
 * ==========================================================================
 *
 * Satu paragraf bahasa sederhana - untuk dibacakan kepada pihak di meja
 * informasi, dan untuk papan hakim.
 *
 * ==========================================================================
 * DISUSUN DARI FAKTA, BUKAN DARI TEKS BEBAS
 * ==========================================================================
 *
 * Kalimatnya dirangkai dari nilai terstruktur: tanggal daftar, jumlah
 * sidang, agenda terakhir, hasil mediasi, tanggal putus. Tidak satu pun
 * kalimat di sini menyimpulkan hukum, dan tidak satu pun diambil dari model
 * bahasa - sehingga tidak ada yang dapat dikarang.
 *
 * Ringkasan yang salah lebih berbahaya daripada tidak ada ringkasan: yang
 * membacanya di meja informasi adalah orang yang tidak punya cara memeriksa.
 * Karena itu ruas yang kosong DIHILANGKAN kalimatnya, bukan diisi dugaan.
 */
async function ringkasPerkara(perkara) {
  const [sidang, mediasi, putusan, pihak] = await Promise.all([
    runQuery(
      `SELECT j.tanggal_sidang AS tanggalSidang,
              j.agenda AS agenda,
              j.alasan_ditunda AS alasanDitunda
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id = ?
        ORDER BY j.tanggal_sidang ASC
        LIMIT 60`,
      [perkara.perkaraId]
    ).catch(() => []),
    runQuery(
      `SELECT md.hasil_mediasi AS hasil, md.mediator_text AS mediator
         FROM perkara_mediasi md WHERE md.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ).catch(() => []),
    runQuery(
      `SELECT pu.tanggal_putusan AS tanggalPutusan,
              pu.status_putusan_nama AS status,
              pu.tanggal_bht AS tanggalBht,
              pu.tanggal_minutasi AS tanggalMinutasi
         FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ).catch(() => []),
    runQuery(
      `SELECT vp.nama AS nama, vp.pihak_ke AS pihakKe
         FROM v_pihak_perkara vp WHERE vp.perkara_id = ? LIMIT 40`,
      [perkara.perkaraId]
    ).catch(() => []),
  ]);

  const hariIni = new Date();
  const sudah = sidang.filter((x) => new Date(x.tanggalSidang) <= hariIni);
  const akan = sidang.filter((x) => new Date(x.tanggalSidang) > hariIni);
  const terakhir = sudah[sudah.length - 1];
  const berikut = akan[0];
  const pt = putusan[0] || {};
  const md = mediasi[0] || {};

  // pihak_ke 5 adalah saksi - 16.466 baris pada tilikan ini - dan menghitung
  // saksi sebagai pihak membuat ringkasan menyebut "3 penggugat".
  const penggugat = pihak.filter((x) => Number(x.pihakKe) === 1).length;
  const tergugat = pihak.filter((x) => Number(x.pihakKe) === 2).length;

  const usia = selisihHari(perkara.tanggalDaftar, isoTanggal(hariIni));
  const usiaSampaiPutus = pt.tanggalPutusan
    ? selisihHari(perkara.tanggalDaftar, isoTanggal(pt.tanggalPutusan))
    : null;

  const kalimat = [];

  kalimat.push(
    `Perkara ${cleanText(perkara.nomorPerkara)} berjenis ${cleanText(perkara.jenisPerkara) || 'tidak tercatat'}, didaftarkan pada ${tanggalPanjang(perkara.tanggalDaftar)}.`
  );

  if (penggugat || tergugat) {
    kalimat.push(
      `Tercatat ${penggugat} pihak penggugat/pemohon dan ${tergugat} pihak tergugat/termohon.`
    );
  }

  if (sudah.length) {
    kalimat.push(
      `Sudah ${sudah.length} kali bersidang, terakhir pada ${tanggalPanjang((terakhir.tanggalSidang))} dengan agenda ${cleanText(terakhir.agenda) || 'yang tidak tercatat'}.`
    );
  } else {
    kalimat.push('Belum ada sidang yang tercatat berlangsung.');
  }

  // Mediasi hanya disebut bila kodenya memang dikenali. 'Y2' dan 'D' ada di
  // SIPP tanpa arti yang pasti, dan menerjemahkannya akan mengarang.
  const kodeMediasi = cleanText(md.hasil).toUpperCase();
  if (kodeMediasi === 'T') {
    kalimat.push('Mediasi sudah ditempuh dan dinyatakan tidak berhasil.');
  } else if (kodeMediasi === 'S') {
    kalimat.push('Mediasi sudah ditempuh dan berhasil sebagian.');
  } else if (cleanText(md.mediator)) {
    kalimat.push(`Mediasi ditangani ${cleanText(md.mediator)}; hasilnya belum tercatat baku di SIPP.`);
  }

  if (pt.tanggalPutusan) {
    kalimat.push(
      `Perkara sudah diputus pada ${tanggalPanjang((pt.tanggalPutusan))}${
        cleanText(pt.status) ? ` dengan amar ${cleanText(pt.status).toLowerCase()}` : ''
      }${usiaSampaiPutus !== null ? `, ${usiaSampaiPutus} hari sejak didaftar` : ''}.`
    );
    if (pt.tanggalMinutasi) {
      kalimat.push(`Berkasnya diminutasi pada ${tanggalPanjang((pt.tanggalMinutasi))}.`);
    }
    if (pt.tanggalBht) {
      kalimat.push(`Putusan berkekuatan hukum tetap sejak ${tanggalPanjang((pt.tanggalBht))}.`);
    }
  } else if (berikut) {
    kalimat.push(
      `Perkara masih berjalan; sidang berikutnya ${tanggalPanjang((berikut.tanggalSidang))} dengan agenda ${cleanText(berikut.agenda) || 'yang belum tercatat'}.`
    );
    if (usia !== null) kalimat.push(`Sudah ${usia} hari sejak didaftar.`);
  } else {
    kalimat.push('Perkara belum diputus dan belum ada jadwal sidang berikutnya di SIPP.');
    if (usia !== null) kalimat.push(`Sudah ${usia} hari sejak didaftar.`);
  }

  const ringkasan = kalimat.join(' ');

  return {
    judul: 'Ringkasan perkara',
    ringkas: ringkasan,
    metrik: [
      { label: 'Sidang berlangsung', nilai: String(sudah.length) },
      { label: 'Sidang terjadwal', nilai: String(akan.length) },
      {
        label: 'Umur perkara',
        nilai: usia === null ? '-' : `${usia} hari`,
        keterangan: usiaSampaiPutus !== null ? `${usiaSampaiPutus} hari sampai putus` : 'masih berjalan',
      },
      { label: 'Keadaan', nilai: pt.tanggalPutusan ? 'sudah putus' : 'berjalan' },
    ],
    kolom: [
      { kunci: 'bagian', label: 'Bagian' },
      { kunci: 'isi', label: 'Isi' },
    ],
    baris: kalimat.map((isi, urutan) => ({ bagian: `Kalimat ${urutan + 1}`, isi })),
    catatan:
      'Seluruh kalimat dirangkai dari nilai yang tercatat - tanggal, jumlah sidang, agenda, hasil mediasi - dan tidak satu pun disusun oleh model bahasa. Ruas yang kosong dihilangkan kalimatnya, bukan diisi dugaan, karena yang membaca ringkasan ini di meja informasi tidak punya cara memeriksanya.',
  };
}

const DAFTAR_ANALISA = [
  // ---- lingkup perkara ----
  { kunci: "tenggat", lingkup: "perkara", label: "Ketepatan input", keterangan: "Jeda peristiwa ke input tiap tahapan." },
  { kunci: "kesehatan", lingkup: "perkara", label: "Kesehatan berkas", keterangan: "Satu angka kelengkapan berkas perkara ini." },
  { kunci: "suntingan", lingkup: "perkara", label: "Jejak suntingan", keterangan: "Data yang diubah sesudah diinput, oleh siapa." },
  { kunci: "pegawai", lingkup: "perkara", label: "Rapor pegawai", keterangan: "Rekam jejak penginput perkara ini di seluruh perkara." },
  { kunci: "tenggang", lingkup: "perkara", label: "Tenggang panggilan", keterangan: "Kepatuhan Pasal 122 HIR dan rekam juru sitanya." },
  { kunci: "aturan", lingkup: "perkara", label: "Pemantau SEMA/PERMA", keterangan: "Kepatuhan aturan yang berlaku pada perkara ini." },
  { kunci: "majelisBanding", lingkup: "perkara", label: "Majelis vs pengadilan", keterangan: "Majelis perkara ini dibanding nilai tengah pengadilan." },
  { kunci: "mutuPertimbangan", lingkup: "perkara", label: "Mutu pertimbangan", keterangan: "Panjang dan kepadatan rujukan pertimbangan hukumnya." },
  { kunci: "keajekan", lingkup: "perkara", label: "Keajekan putusan", keterangan: "Sebaran hasil antar majelis untuk jenis perkara ini." },
  { kunci: "sejenis", lingkup: "perkara", label: "Banding sejenis", keterangan: "Dibandingkan perkara jenis yang sama." },
  { kunci: "majelis", lingkup: "perkara", label: "Kinerja majelis", keterangan: "Beban dan kecepatan hakimnya." },
  { kunci: "pihak", lingkup: "perkara", label: "Riwayat pihak", keterangan: "Perkara lain lewat NIK, nama, dan tanggal lahir." },
  { kunci: "pasangan", lingkup: "perkara", label: "Pasangan pihak", keterangan: "Apakah kedua belah pihak pernah berhadapan." },
  { kunci: "panggilan", lingkup: "perkara", label: "Analisa panggilan", keterangan: "Tenggang, retur, dan cara panggil." },
  { kunci: "prakiraan", lingkup: "perkara", label: "Prakiraan selesai", keterangan: "Sebaran perkara sejenis yang sudah putus." },
  { kunci: "biaya", lingkup: "perkara", label: "Peta biaya", keterangan: "Panjar, pengeluaran, dan sisanya." },
  { kunci: "penundaan", lingkup: "perkara", label: "Pola penundaan", keterangan: "Jeda antar sidang dan alasannya." },
  { kunci: "ecourt", lingkup: "perkara", label: "Kelengkapan e-Court", keterangan: "Dokumen elektronik yang wajib ada." },
  { kunci: "kronologi", lingkup: "perkara", label: "Kronologi lengkap", keterangan: "Seluruh peristiwa dalam satu deret." },
  { kunci: "periksaPertimbangan", lingkup: "perkara", label: "Pemeriksa pertimbangan", keterangan: "Petitum yang belum menemukan padanan di amar atau pertimbangan." },
  { kunci: "ringkasan", lingkup: "perkara", label: "Ringkasan perkara", keterangan: "Satu paragraf bahasa sederhana dari fakta yang tercatat." },

  // ---- lingkup pengadilan ----
  { kunci: "bulanan", lingkup: "pengadilan", label: "Papan kendali bulanan", keterangan: "Masuk, putus, dan sisanya per bulan." },
  { kunci: "beban", lingkup: "pengadilan", label: "Sebaran beban", keterangan: "Pembagian perkara antar hakim, PP, dan juru sita." },
  { kunci: "periode", lingkup: "pengadilan", label: "Banding antar periode", keterangan: "Bulan ini lawan bulan lalu dan tahun lalu." },
  { kunci: "wilayah", lingkup: "pengadilan", label: "Sebaran wilayah", keterangan: "Dari kecamatan mana perkara paling banyak datang." },
  { kunci: "musim", lingkup: "pengadilan", label: "Musim perkara", keterangan: "Bulan dan hari mana yang paling padat." },
  { kunci: "corong", lingkup: "pengadilan", label: "Corong perkara", keterangan: "Di mana perkara tersendat, dari daftar sampai arsip." },
  { kunci: "profil", lingkup: "pengadilan", label: "Profil pihak", keterangan: "Umur, pekerjaan, pendidikan, dan usia pernikahan." },
  { kunci: "berisiko", lingkup: "pengadilan", label: "Perkara berisiko", keterangan: "Yang mendekati atau melewati ambang lima bulan." },
  { kunci: "anomali", lingkup: "pengadilan", label: "Deteksi anomali", keterangan: "Perkara yang menyimpang dari kebiasaan jenisnya." },
  { kunci: "upayaHukum", lingkup: "pengadilan", label: "Profil upaya hukum", keterangan: "Angka dasar banding, kasasi, dan PK - bukan prakiraan." },
];

const PENGERJA = {
  tenggat: (p) => ketepatanInput(p.perkaraId),
  kesehatan: (p) => kesehatanBerkas(p),
  suntingan: (p) => jejakSuntingan(p.perkaraId),
  pegawai: (p) => raporPegawai(p.perkaraId),
  tenggang: (p) => tenggangPanggilan(p.perkaraId),
  aturan: (p) => pemantauAturan(p),
  majelisBanding: (p) => majelisTerhadapRerata(p),
  mutuPertimbangan: (p) => mutuPertimbangan(p),
  keajekan: (p) => keajekanPutusan(p),
  sejenis: (p) => bandingSejenis(p),
  majelis: (p) => kinerjaMajelis(p.perkaraId),
  pihak: (p) => riwayatPihak(p),
  pasangan: (p) => pasanganPihak(p),
  panggilan: (p) => analisaPanggilan(p.perkaraId),
  prakiraan: (p) => prakiraanSelesai(p),
  biaya: (p) => petaBiaya(p.perkaraId),
  penundaan: (p) => polaPenundaan(p.perkaraId),
  ecourt: (p) => kelengkapanEcourt(p),
  kronologi: (p) => kronologi(p),
  periksaPertimbangan: (p) => periksaPertimbangan(p),
  ringkasan: (p) => ringkasPerkara(p),

  // Lingkup pengadilan - perkaranya tidak dipakai, dan itu disengaja.
  bulanan: () => papanBulanan(),
  beban: () => bebanBerimbang(),
  periode: () => bandingPeriode(),
  wilayah: () => sebaranWilayah(),
  musim: () => musimPerkara(),
  corong: () => corongPerkara(),
  profil: () => profilPihak(),
  berisiko: () => perkaraBerisiko(),
  anomali: () => deteksiAnomali(),
  upayaHukum: () => profilUpayaHukum(),
};

/**
 * Menjalankan SATU analisis.
 *
 * Kunci dicocokkan dengan daftar tertutup - nama fungsi tidak pernah datang
 * dari peramban.
 */
async function jalankanAnalisa(nomorPerkara, jenis) {
  const kunci = cleanText(jenis);
  const pengerja = PENGERJA[kunci];
  if (!pengerja) return { ok: false, alasan: "jenis_analisa_tidak_dikenali" };

  const perkara = await identitas(nomorPerkara);
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  try {
    const hasil = await pengerja(perkara);
    return {
      ok: true,
      jenis: kunci,
      nomorPerkara: cleanText(perkara.nomorPerkara),
      metrik: [],
      kolom: [],
      baris: [],
      catatan: "",
      ...hasil,
    };
  } catch (galat) {
    // Satu analisis yang gagal - tabel yang tidak ada pada SIPP versi lain -
    // tidak boleh terbaca seperti perkaranya yang bermasalah.
    return {
      ok: false,
      jenis: kunci,
      alasan: `Analisis ini tidak dapat dijalankan pada SIPP di sini: ${String(
        (galat && galat.message) || galat
      ).slice(0, 200)}`,
    };
  }
}

module.exports = {
  DAFTAR_ANALISA,
  jalankanAnalisa,
  // Diekspor untuk diuji satuan.
  median,
  selisihHari,
};
