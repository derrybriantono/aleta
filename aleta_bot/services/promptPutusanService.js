"use strict";

/**
 * ============================================================================
 * BAHAN PROMPT PENYUSUNAN PUTUSAN
 * ============================================================================
 *
 * Mengumpulkan seluruh keterangan perkara yang sudah ada di SIPP dan di arsip
 * e-Court ALETA, dalam bentuk yang siap dirangkai menjadi perintah untuk
 * Project Claude "ALETA AI PA CLAUDE".
 *
 * ============================================================================
 * YANG DIISI MESIN DAN YANG DIISI ORANG
 * ============================================================================
 *
 * Layar penyusun prompt berbentuk borang. Yang datanya SUDAH ADA di SIPP
 * terisi sendiri - riwayat sidang, mediasi, saksi, kehadiran, berkas. Yang
 * TIDAK ADA di SIPP diisi orang: arah putusan, ada tidaknya rekonvensi,
 * blangko yang dipakai, dan catatan khusus.
 *
 * Pembagian itu bukan kemalasan melainkan keharusan: arah putusan adalah
 * keputusan hakim dan tidak boleh ditebak dari data mana pun. Yang dikerjakan
 * di sini hanya menghapus pengetikan ulang atas keterangan yang sudah
 * tercatat.
 *
 * ============================================================================
 * KEADAAN DATA YANG PERLU DIKETAHUI
 * ============================================================================
 *
 * Diukur pada SIPP yang berjalan:
 *
 *   - 752 perkara punya catatan mediasi; 209 di antaranya punya ISI
 *     kesepakatan perdamaian, dan itulah yang langsung dapat dipakai sebagai
 *     rincian Pasal 1 sampai sekian pada prompt.
 *   - `mediasi_berhasil` NULL pada SELURUH 752 baris - tidak dapat dipakai.
 *   - `keputusan_mediasi` berisi TANGGAL, bukan keputusan - kolom yang salah
 *     nama, dan membacanya sebagai keputusan akan menghasilkan omong kosong.
 *   - Yang tersisa `hasil_mediasi` berupa kode: 'T' (454), 'S' (152),
 *     'Y2' (45), 'D' (22). Hanya dua yang cukup jelas artinya; sisanya
 *     disajikan apa adanya supaya orang yang memilih tahu ia sedang menebak.
 *
 * Seluruh kueri di berkas ini SELECT. Tidak ada satu pun tulisan ke SIPP.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const ecourtStoreService = require("./ecourtStoreService");

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

const NAMA_BULAN = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "25 Juni 2026" - bentuk yang dipakai di dalam putusan. */
function tanggalIndonesia(iso) {
  const [tahun, bulan, hari] = String(iso || "").split("-").map(Number);
  if (!tahun || !bulan || !hari) return "";
  return `${hari} ${NAMA_BULAN[bulan]} ${tahun}`;
}

/**
 * Arti kode kehadiran pada perkara_jadwal_sidang.dihadiri_oleh.
 *
 * Menentukan apakah prompt perlu menyebut ketidakhadiran - dan pada perkara
 * verstek, seluruh susunan putusannya berbeda.
 */
const ARTI_HADIR = {
  "1": "kedua pihak hadir",
  "2": "Tergugat/Termohon tidak hadir",
  "3": "Penggugat/Pemohon tidak hadir",
  "4": "kedua pihak tidak hadir",
  "10": "sebagian Penggugat/Pemohon tidak hadir",
};

/**
 * Kode hasil mediasi pada SIPP.
 *
 * Hanya dua yang cukup jelas artinya dari sebarannya. Sisanya sengaja TIDAK
 * ditebak - yang memilih di layar harus tahu bahwa ia sedang menentukan,
 * bukan sedang membaca.
 */
const ARTI_HASIL_MEDIASI = {
  T: "tidak berhasil",
  S: "berhasil sebagian",
};

/** Pilihan arah putusan - diisi orang, tidak pernah ditebak dari data. */
const PILIHAN_ARAH = [
  { kunci: "kabul", label: "Kabul seluruhnya" },
  { kunci: "kabul-sebagian", label: "Kabul sebagian" },
  { kunci: "tolak", label: "Tolak" },
  { kunci: "tidak-diterima", label: "Tidak dapat diterima (NO)" },
  { kunci: "cabut", label: "Dicabut" },
  { kunci: "gugur", label: "Gugur" },
];

const PILIHAN_MEDIASI = [
  { kunci: "tidak-ada", label: "Tidak ada mediasi" },
  { kunci: "tidak-berhasil", label: "Mediasi tidak berhasil" },
  { kunci: "berhasil-sebagian", label: "Mediasi berhasil sebagian" },
  { kunci: "berhasil", label: "Mediasi berhasil seluruhnya" },
];

/**
 * Mengumpulkan seluruh bahan untuk satu perkara.
 *
 * Tiap bagian dibungkus sendiri: satu tabel yang tidak ada pada versi SIPP
 * tertentu tidak boleh menghilangkan bagian lain yang sebenarnya sudah
 * terbaca.
 */
async function bahanPrompt(nomorPerkaraMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong" };

  const barisPerkara = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar
       FROM perkara p WHERE p.nomor_perkara = ? ORDER BY p.perkara_id DESC LIMIT 1`,
    [nomorPerkara]
  ).catch(() => []);

  const perkara = barisPerkara[0];
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  const id = perkara.perkaraId;
  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  const [pihak, kuasa, sidang, mediasi, saksi, biaya, arsip, putusan] = await Promise.all([
    // pihak_ke 5 pada tilikan ini adalah SAKSI - 16.466 baris - jadi
    // penyaringan ke 1 dan 2 di bawah bukan penghematan melainkan syarat.
    aman(
      () =>
        runQuery(
          `SELECT vp.nama AS nama, vp.pihak_ke AS pihakKe, vp.alamat AS alamat
             FROM v_pihak_perkara vp WHERE vp.perkara_id = ? LIMIT 40`,
          [id]
        ),
      []
    ),
    /**
     * Kuasa hukum.
     *
     * SIPP tidak menyimpannya sebagai pihak tersendiri; jalurnya lewat
     * pendaftaran e-Court: kuasa -> pihak e-Court -> pihak SIPP, dan nama
     * pengacaranya sendiri ada di tabel `pihak`.
     *
     * `aktif` berisi 'Y'/'T', BUKAN 1/0. Membandingkannya dengan 1 membuat
     * kueri ini pulang kosong tanpa galat - dan seluruh 508 baris kuasa
     * yang ada akan lenyap diam-diam.
     */
    aman(
      () =>
        runQuery(
          `SELECT vp.pihak_ke AS pihakKe, vp.nama AS klien, ph.nama AS kuasa
             FROM v_pihak_perkara vp
             JOIN ecourt_pihak ep ON ep.pihak_id = vp.pihak_id
             JOIN ecourt_kuasa_hukum kh ON kh.ecourt_pihak_id = ep.ecourt_pihak_id
                  AND kh.aktif = 'Y'
             JOIN ecourt_pengacara pg ON pg.ecourt_pengacara_id = kh.ecourt_pengacara_id
             JOIN pihak ph ON ph.id = pg.sipp_pihak_id
            WHERE vp.perkara_id = ?
            LIMIT 10`,
          [id]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT j.tanggal_sidang AS tanggalSidang,
                  j.agenda AS agenda,
                  j.alasan_ditunda AS alasanDitunda,
                  j.dihadiri_oleh AS dihadiri
             FROM perkara_jadwal_sidang j
            WHERE j.perkara_id = ?
            ORDER BY j.tanggal_sidang ASC
            LIMIT 60`,
          [id]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT md.mediator_text AS mediator,
                  md.dimulai_mediasi AS dimulai,
                  md.penetapan_tanggal_mediasi AS penetapan,
                  md.tgl_kesepakatan_perdamaian AS tanggalKesepakatan,
                  md.tgl_pengajuan_kesepakatan AS tanggalPengajuan,
                  md.tgl_laporan_mediator AS tanggalLaporan,
                  md.hasil_mediasi AS hasil,
                  md.isi_kesepakatan_perdamaian AS isiKesepakatan
             FROM perkara_mediasi md WHERE md.perkara_id = ? LIMIT 5`,
          [id]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT p5.nama AS nama, p5.saksi_pihak_ke AS pihakKe, p5.alamat AS alamat
             FROM perkara_pihak5 p5 WHERE p5.perkara_id = ? ORDER BY p5.urutan ASC LIMIT 20`,
          [id]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT b.uraian AS uraian, b.jumlah AS jumlah, b.tanggal_transaksi AS tanggal
             FROM perkara_biaya b
            WHERE b.perkara_id = ? AND b.uraian LIKE '%mediasi%'
            LIMIT 10`,
          [id]
        ),
      []
    ),
    aman(() => ecourtStoreService.rincianArsipPerkara(nomorPerkara), { dokumen: [] }),
    aman(
      () =>
        runQuery(
          `SELECT pu.tanggal_putusan AS tanggalPutusan,
                  pu.putusan_verstek AS verstek,
                  pu.amar_putusan AS amar
             FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
          [id]
        ),
      []
    ),
  ]);

  const md = mediasi[0] || {};
  const kodeHasil = cleanText(md.hasil).toUpperCase();

  return {
    ok: true,
    identitas: {
      perkaraId: String(id),
      nomorPerkara: cleanText(perkara.nomorPerkara),
      jenisPerkara: cleanText(perkara.jenisPerkara),
      tanggalDaftar: isoTanggal(perkara.tanggalDaftar),
      // Gugatan mempertemukan dua pihak berhadapan; permohonan tidak, dan
      // sebutan pihaknya pun berbeda di seluruh badan putusan.
      gugatan: /\/Pdt\.G/i.test(cleanText(perkara.nomorPerkara)),
    },
    pihak: {
      penggugat: pihak
        .filter((x) => Number(x.pihakKe) === 1)
        .map((x) => ({ nama: cleanText(x.nama), alamat: cleanText(x.alamat) })),
      tergugat: pihak
        .filter((x) => Number(x.pihakKe) === 2)
        .map((x) => ({ nama: cleanText(x.nama), alamat: cleanText(x.alamat) })),
    },
    kuasa: kuasa.map((row) => ({
      nama: cleanText(row.kuasa),
      klien: cleanText(row.klien),
      pihak: Number(row.pihakKe) === 1 ? "Penggugat/Pemohon" : "Tergugat/Termohon",
    })),
    sidang: sidang.map((row) => {
      const kode = cleanText(row.dihadiri);
      return {
        tanggal: isoTanggal(row.tanggalSidang),
        tanggalTerbaca: tanggalIndonesia(isoTanggal(row.tanggalSidang)),
        agenda: cleanText(row.agenda),
        alasanDitunda: cleanText(row.alasanDitunda),
        kehadiran: ARTI_HADIR[kode] || (kode ? `kode ${kode}` : ""),
      };
    }),
    mediasi: {
      ada: mediasi.length > 0,
      mediator: cleanText(md.mediator),
      tanggalMulai: isoTanggal(md.dimulai) || isoTanggal(md.penetapan),
      tanggalMulaiTerbaca: tanggalIndonesia(isoTanggal(md.dimulai) || isoTanggal(md.penetapan)),
      tanggalLaporan: isoTanggal(md.tanggalLaporan),
      tanggalLaporanTerbaca: tanggalIndonesia(isoTanggal(md.tanggalLaporan)),
      tanggalKesepakatan: isoTanggal(md.tanggalKesepakatan) || isoTanggal(md.tanggalPengajuan),
      tanggalKesepakatanTerbaca: tanggalIndonesia(
        isoTanggal(md.tanggalKesepakatan) || isoTanggal(md.tanggalPengajuan)
      ),
      kodeHasil,
      // Hanya kode yang jelas artinya yang diterjemahkan; sisanya dibiarkan
      // kosong supaya yang memilih di layar tahu ia sedang menentukan.
      hasilTerbaca: ARTI_HASIL_MEDIASI[kodeHasil] || "",
      isiKesepakatan: cleanText(md.isiKesepakatan),
      biaya: biaya.map((row) => ({
        uraian: cleanText(row.uraian),
        jumlah: Number(row.jumlah) || 0,
        tanggal: isoTanggal(row.tanggal),
      })),
    },
    saksi: saksi.map((row) => ({
      nama: cleanText(row.nama),
      // 1 saksi Penggugat/Pemohon, 2 saksi Tergugat/Termohon.
      pihak:
        Number(row.pihakKe) === 1
          ? "Penggugat/Pemohon"
          : Number(row.pihakKe) === 2
            ? "Tergugat/Termohon"
            : "",
    })),
    /**
     * Dokumen e-Court.
     *
     * Nama berkasnya ADA - tersimpan pada `jalur_berkas` di
     * `aleta_bot_ecourt_files`, bukan di tabel dokumen yang kolom cerminnya
     * hampir seluruhnya kosong. Layanan arsip memulangkannya sebagai
     * `namaBerkasPdf`/`namaBerkasWord`, dan hanya bila berkasnya benar-benar
     * terbaca di disk.
     *
     * Ruas `berkasPdf`/`berkasWord` yang sempat dibaca di sini TIDAK PERNAH
     * ADA - namanya dikarang - sehingga daftar lampiran keluar kosong pada
     * perkara yang dokumennya justru lengkap. Judul dokumen tetap dibawa
     * sebagai cadangan bila berkasnya belum terunduh.
     */
    berkas: (arsip.dokumen || []).map((row) => ({
      judul: cleanText(row.judulDokumen),
      jenis: cleanText(row.jenisDokumen),
      diunggahOleh: cleanText(row.peranPengunggah),
      tanggalSidang: isoTanggal(row.tanggalSidang),
      agenda: cleanText(row.agenda),
      adaPdf: Boolean(row.adaPdf),
      adaWord: Boolean(row.adaWord),
      namaBerkasPdf: cleanText(row.namaBerkasPdf),
      namaBerkasWord: cleanText(row.namaBerkasWord),
    })),
    putusan: {
      tanggalPutusan: isoTanggal((putusan[0] || {}).tanggalPutusan),
      verstek: cleanText((putusan[0] || {}).verstek).toUpperCase() === "Y",
      adaAmar: Boolean(cleanText((putusan[0] || {}).amar)),
    },
    pilihan: {
      arah: PILIHAN_ARAH,
      mediasi: PILIHAN_MEDIASI,
    },
  };
}

module.exports = {
  ARTI_HADIR,
  ARTI_HASIL_MEDIASI,
  PILIHAN_ARAH,
  PILIHAN_MEDIASI,
  bahanPrompt,
  tanggalIndonesia,
};
