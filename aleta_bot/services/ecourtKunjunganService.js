"use strict";

/**
 * Kapan satu perkara e-Court TERAKHIR DIBUKA - termasuk ketika halamannya
 * ternyata tidak memuat satu dokumen pun.
 *
 * ============================================================================
 * SEBABNYA: LAPIS 0 TIDAK DAPAT PENSIUN
 * ============================================================================
 *
 * Giliran penarikan diurutkan dari perkara yang paling lama tidak dibuka, dan
 * sampai 25 Sep 2026 "kapan terakhir dibuka" dijawab
 * ecourtStoreService.terakhirDiperiksaPerkara() - MAX(terakhir_terlihat) dari
 * aleta_bot_ecourt_documents. Satu-satunya penulis baris di tabel itu adalah
 * recordDocument, dan recordDocument hanya dipanggil DI DALAM gelung dokumen.
 * Perkara yang halamannya TERBUKA tetapi tidak menghasilkan satu dokumen pun
 * karena itu tidak meninggalkan jejak apa pun: ia tetap "belum pernah ditarik"
 * (lapis 0) dengan kapan() = 0 selamanya.
 *
 * Terukur pada laptop, 25 Sep 2026: aleta_bot_ecourt_documents 0 baris dan
 * aleta_bot_ecourt_files 0 baris, sementara sipp_donggala memuat 2.527 perkara
 * e-Court (COUNT(DISTINCT perkara_id) FROM perkara_efiling_id). Jatah satu
 * penekanan tombol 120 perkara, jadi menghabiskan 2.527 perkara menuntut 22
 * penekanan - dan tanpa catatan kunjungan, penekanan ke-2 sampai ke-22 membuka
 * persis 120 perkara yang SAMA, sebab urutan di dalam lapis 0 jatuh kembali ke
 * urutan sapuan yang sama tiap kali (sort JavaScript stabil).
 *
 * ============================================================================
 * MENGAPA TABEL SENDIRI, BUKAN KOLOM DI aleta_bot_ecourt_documents
 * ============================================================================
 *
 * Yang dicatat di sini adalah KUNJUNGAN ke perkaranya, bukan keadaan sebuah
 * dokumen - dan justru perkara yang tidak punya dokumen yang paling perlu
 * dicatat. Menaruhnya pada tabel dokumen berarti membuat baris dokumen palsu
 * untuk perkara yang tidak punya dokumen, dan baris palsu itu akan terhitung
 * sebagai "satu dokumen tanpa berkas" oleh ringkasKekuranganBerkas - yakni
 * perkara yang berkasnya kurang selamanya. Persis cacat yang sedang ditutup.
 *
 * Tabelnya dibuat sendiri saat pertama kali dipakai; tidak ada migrasi yang
 * perlu dijalankan tangan.
 */

const botDb = require("./botDbService");
const { normalizeCaseNumber } = require("./ecourtTextService");

const TABEL = "aleta_bot_ecourt_kunjungan";

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return;

  // VARCHAR(191) pada utf8mb4: batas 767 bita berlaku per kolom pada innodb
  // COMPACT, dan 191 x 4 = 764 - tepat di bawahnya.
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS ${TABEL} (
      nomor_perkara VARCHAR(191) PRIMARY KEY,
      dikunjungi_pada DATETIME NOT NULL,
      dokumen_terlihat INT NOT NULL DEFAULT 0,
      jumlah_kunjungan INT NOT NULL DEFAULT 1,
      sumber_url TEXT,
      INDEX idx_kunjungan_waktu (dikunjungi_pada),
      INDEX idx_kunjungan_kosong (dokumen_terlihat, dikunjungi_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  skemaSiap = true;
}

/** Dipakai pengujian supaya skema tidak dianggap sudah terpasang. */
function lupakan() {
  skemaSiap = false;
}

/**
 * Satu kunjungan ke halaman detail perkara.
 *
 * Dicatat untuk SETIAP kunjungan yang halamannya benar-benar terbaca, bukan
 * hanya yang kosong. Yang kosong dikenali dari dokumenTerlihat = 0, dan
 * perkara yang tadinya kosong lalu akhirnya berisi terbarui sendiri lewat
 * ON DUPLICATE KEY - tidak ada baris basi yang perlu dihapus tangan.
 */
async function catatKunjungan(nomorPerkaraMentah, { dokumenTerlihat = 0, sumberUrl = "" } = {}) {
  const nomor = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong" };

  await ensureSchema();
  await botDb.query(
    `INSERT INTO ${TABEL} (nomor_perkara, dikunjungi_pada, dokumen_terlihat, jumlah_kunjungan, sumber_url)
     VALUES (?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       dikunjungi_pada = VALUES(dikunjungi_pada),
       dokumen_terlihat = VALUES(dokumen_terlihat),
       jumlah_kunjungan = jumlah_kunjungan + 1,
       sumber_url = VALUES(sumber_url)`,
    [
      nomor.slice(0, 191),
      botDb.toMysqlDate(new Date()),
      Math.max(0, Number(dokumenTerlihat) || 0),
      String(sumberUrl || "").slice(0, 2000),
    ]
  );

  return { ok: true, nomorPerkara: nomor };
}

/**
 * Kapan tiap perkara terakhir dikunjungi, dalam milidetik epoch.
 *
 * Nol tidak dipulangkan untuk perkara yang tidak punya baris - perkara itu
 * sengaja tidak masuk peta, sama seperti ringkasKekuranganBerkas, supaya
 * pemanggilnya dapat membedakan "belum pernah dikunjungi" dari "dikunjungi
 * pada waktu yang tidak terbaca".
 *
 * WAKTUNYA HANYA UNTUK DIBANDINGKAN, BUKAN UNTUK DIHITUNG UMURNYA. Diukur
 * 25 Sep 2026: menulis lalu membaca kembali satu baris memulangkan waktu yang
 * 28.800 detik (8 jam, tepat beda zona WITA) lebih awal daripada saat
 * penulisannya - driver mysql memulangkan DATETIME sebagai Date yang sudah
 * ditafsirkan zona lokal, sementara toMysqlDate menuliskannya dalam UTC.
 * Pergeserannya SAMA untuk semua baris dan sama pula dengan yang dialami
 * terakhirDiperiksaPerkara, jadi urutan giliran tetap benar; "sudah berapa
 * lama sejak" yang dihitung dari angka ini yang akan meleset 8 jam.
 */
async function kunjunganTerakhir() {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT nomor_perkara AS nomorPerkara, dikunjungi_pada AS waktu,
            dokumen_terlihat AS dokumenTerlihat, jumlah_kunjungan AS jumlahKunjungan
       FROM ${TABEL}`
  );

  const peta = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const waktu = botDb.fromMysqlDate(row.waktu);
    peta.set(normalizeCaseNumber(row.nomorPerkara), {
      waktu: waktu ? waktu.getTime() : 0,
      dokumenTerlihat: Number(row.dokumenTerlihat) || 0,
      jumlahKunjungan: Number(row.jumlahKunjungan) || 0,
    });
  }
  return peta;
}

/** Dipakai pengujian dan pembersihan: membuang catatan satu perkara. */
async function hapusKunjungan(nomorPerkaraMentah) {
  const nomor = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomor) return 0;
  await ensureSchema();
  const hasil = await botDb.query(`DELETE FROM ${TABEL} WHERE nomor_perkara = ?`, [nomor]);
  return Number(hasil && hasil.affectedRows) || 0;
}

module.exports = {
  TABEL,
  ensureSchema,
  lupakan,
  catatKunjungan,
  kunjunganTerakhir,
  hapusKunjungan,
};
