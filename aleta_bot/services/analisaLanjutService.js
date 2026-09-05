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
const DAFTAR_ANALISA = [
  { kunci: "tenggat", label: "Ketepatan input", keterangan: "Jeda peristiwa ke input tiap tahapan." },
  { kunci: "sejenis", label: "Banding sejenis", keterangan: "Dibandingkan perkara jenis yang sama." },
  { kunci: "majelis", label: "Kinerja majelis", keterangan: "Beban dan kecepatan hakimnya." },
  { kunci: "pihak", label: "Riwayat pihak", keterangan: "Perkara lain atas nama yang sama." },
  { kunci: "pasangan", label: "Pasangan pihak", keterangan: "Apakah kedua belah pihak pernah berhadapan." },
  { kunci: "panggilan", label: "Analisa panggilan", keterangan: "Tenggang, retur, dan cara panggil." },
  { kunci: "prakiraan", label: "Prakiraan selesai", keterangan: "Sebaran perkara sejenis yang sudah putus." },
  { kunci: "biaya", label: "Peta biaya", keterangan: "Panjar, pengeluaran, dan sisanya." },
  { kunci: "penundaan", label: "Pola penundaan", keterangan: "Jeda antar sidang dan alasannya." },
  { kunci: "ecourt", label: "Kelengkapan e-Court", keterangan: "Dokumen elektronik yang wajib ada." },
  { kunci: "kronologi", label: "Kronologi lengkap", keterangan: "Seluruh peristiwa dalam satu deret." },
];

const PENGERJA = {
  tenggat: (p) => ketepatanInput(p.perkaraId),
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
