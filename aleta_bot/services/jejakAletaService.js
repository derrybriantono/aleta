"use strict";

/**
 * ============================================================================
 * RIWAYAT PERBUATAN ALETA - DI BASIS DATA ALETA, BUKAN DI SIPP
 * ============================================================================
 *
 * Sampai versi 1.105.0, tiap baris sys_audittrail yang ditulis ALETA membawa
 * penanda "[ALETA] diisikan operator <nama>" pada kolom description. Niatnya
 * baik - supaya tulisan ALETA selalu dapat dibedakan dan ditelusuri - tetapi
 * tempatnya keliru: sys_audittrail adalah catatan milik SIPP, dibaca petugas
 * SIPP di layar Audit Trail SIPP, dan tidak ada satu pun baris SIPP yang
 * menyebut alat yang dipakai mengetiknya.
 *
 * Yang dituntut sekarang: basis data SIPP tidak memuat satu kata pun tentang
 * ALETA, dan riwayatnya disimpan ALETA sendiri.
 *
 * Itu bukan kemunduran dalam penelusuran - justru sebaliknya. Kolom
 * description hanya sanggup memuat satu kalimat di ujung tabel HTML; di sini
 * tiap perbuatan tercatat utuh: jenisnya, perkaranya, akun SIPP yang dipakai,
 * operator ALETA yang menekan tombolnya, tabel apa saja yang disentuh,
 * berhasil atau tidak, dan sebabnya bila gagal. Yang gagal pun tercatat -
 * sedangkan di sys_audittrail yang gagal tidak pernah meninggalkan jejak sama
 * sekali.
 *
 * ============================================================================
 * MENULIS JEJAK TIDAK BOLEH MENGGAGALKAN PENETAPANNYA
 * ============================================================================
 *
 * Penetapan sudah tertulis di SIPP ketika fungsi ini dipanggil. Melemparkan
 * galat dari sini berarti melaporkan gagal atas pekerjaan yang sesungguhnya
 * berhasil - dan petugas akan menekannya sekali lagi. Karena itu SELURUH
 * kegagalan di berkas ini ditelan, dan yang tersisa hanya satu baris di log.
 */

const db = require("../bot_db_config");

const TABEL = "aleta_bot_jejak_penetapan";

let siapPromise = null;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

/**
 * Tabelnya dibuat saat pertama dipakai, bukan lewat migrasi terpisah.
 *
 * Sepola dengan botDbService: basis data internal bot memang dibangun dengan
 * CREATE TABLE IF NOT EXISTS pada saat jalan, sehingga pemasangan baru tidak
 * menuntut satu pun langkah tambahan.
 */
function pastikanTabel() {
  if (siapPromise) return siapPromise;
  siapPromise = kueri(`
    CREATE TABLE IF NOT EXISTS ${TABEL} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      waktu DATETIME NOT NULL,
      aksi VARCHAR(12) NOT NULL DEFAULT 'tulis',
      jenis VARCHAR(20) NOT NULL DEFAULT '',
      perkara_id INT NOT NULL DEFAULT 0,
      nomor_perkara VARCHAR(120) NOT NULL DEFAULT '',
      tanggal_penetapan DATE NULL,
      akun_sipp VARCHAR(60) NOT NULL DEFAULT '',
      nama_pejabat VARCHAR(150) NOT NULL DEFAULT '',
      operator VARCHAR(120) NOT NULL DEFAULT '',
      ip VARCHAR(45) NOT NULL DEFAULT '',
      berhasil TINYINT NOT NULL DEFAULT 0,
      kering TINYINT NOT NULL DEFAULT 0,
      alasan VARCHAR(160) NOT NULL DEFAULT '',
      jumlah_langkah INT NOT NULL DEFAULT 0,
      tabel_disentuh VARCHAR(500) NOT NULL DEFAULT '',
      rincian MEDIUMTEXT NULL,
      PRIMARY KEY (id),
      KEY idx_jejak_perkara (perkara_id, waktu),
      KEY idx_jejak_waktu (waktu),
      KEY idx_jejak_nomor (nomor_perkara)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
    // CREATE TABLE IF NOT EXISTS diam saja pada tabel yang SUDAH ada, termasuk
    // ketika bentuknya berubah. Kolom yang ditambahkan belakangan karena itu
    // harus disusulkan sendiri - sepola dengan addColumnIfMissing di
    // botDbService.
    .then(() => lengkapiKolom())
    .catch((galat) => {
      // Gagal sekali tidak berarti gagal selamanya - percobaan berikutnya
      // membangunnya lagi. Tanpa ini, satu kegagalan sesaat membuat seluruh
      // riwayat kosong sampai bot dinyalakan ulang.
      siapPromise = null;
      throw galat;
    });
  return siapPromise;
}

/** Kolom yang disusulkan sesudah tabelnya pernah dibuat dengan bentuk lama. */
async function lengkapiKolom() {
  const susulan = [["nama_pejabat", "VARCHAR(150) NOT NULL DEFAULT '' AFTER akun_sipp"]];
  for (const [nama, bentuk] of susulan) {
    const ada = await kueri(`SHOW COLUMNS FROM ${TABEL} LIKE ?`, [nama]);
    if (Array.isArray(ada) && ada.length > 0) continue;
    await kueri(`ALTER TABLE ${TABEL} ADD COLUMN ${nama} ${bentuk}`);
  }
}

function potong(nilai, panjang) {
  return String(nilai === null || nilai === undefined ? "" : nilai).slice(0, panjang);
}

function waktuMysqlSekarang() {
  const d = new Date();
  const dua = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())} ` +
    `${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`
  );
}

/** Tanggal "YYYY-MM-DD" saja yang diterima; selain itu NULL. */
function tanggalSaja(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : null;
}

/**
 * Mencatat satu perbuatan ALETA.
 *
 * @returns {Promise<boolean>} berhasil tercatat atau tidak - TIDAK pernah
 *                             melempar galat.
 */
async function catat(jejak) {
  const j = jejak || {};
  try {
    await pastikanTabel();

    // Tabel yang disentuh dihitung dari rencananya, bukan ditulis pemanggil:
    // rencana itu yang benar-benar dijalankan, dan daftar yang ditulis tangan
    // akan tertinggal begitu satu langkah ditambahkan.
    const langkah = Array.isArray(j.langkah) ? j.langkah : [];
    const tabel = [];
    for (const x of langkah) {
      const nama = String((x && x.tabel) || "");
      if (nama && !tabel.includes(nama)) tabel.push(nama);
    }

    const rincian = langkah.map((x) => ({
      tabel: String((x && x.tabel) || ""),
      aksi: String((x && x.aksi) || ""),
      keterangan: potong((x && x.keterangan) || "", 300),
    }));

    await kueri(
      `INSERT INTO ${TABEL}
         (waktu, aksi, jenis, perkara_id, nomor_perkara, tanggal_penetapan, akun_sipp,
          nama_pejabat, operator, ip, berhasil, kering, alasan, jumlah_langkah,
          tabel_disentuh, rincian)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        waktuMysqlSekarang(),
        potong(j.aksi || "tulis", 12),
        potong(j.jenis, 20),
        Number(j.perkaraId) || 0,
        potong(j.nomorPerkara, 120),
        tanggalSaja(j.tanggalPenetapan),
        potong(j.akunSipp, 60),
        potong(j.namaPejabat, 150),
        potong(j.operator, 120),
        potong(j.ip, 45),
        j.berhasil ? 1 : 0,
        j.kering ? 1 : 0,
        potong(j.alasan, 160),
        langkah.length,
        potong(tabel.join(", "), 500),
        JSON.stringify(rincian).slice(0, 60000),
      ]
    );
    return true;
  } catch (galat) {
    // Sengaja hanya satu baris, dan sengaja tidak dilempar ulang.
    console.warn(
      `[jejak ALETA] gagal mencatat ${j.aksi || "tulis"} ${j.jenis || ""} perkara ${j.perkaraId || "?"}: ` +
        String((galat && galat.message) || galat).slice(0, 200)
    );
    return false;
  }
}

/**
 * Riwayat perbuatan ALETA.
 *
 * Tanpa saringan ia memulangkan yang terbaru lintas perkara - itulah yang
 * dibaca tab Riwayat ketika dibuka di halaman yang bukan halaman perkara.
 */
async function riwayat(saringan) {
  const s = saringan || {};
  try {
    await pastikanTabel();

    const syarat = [];
    const nilai = [];

    const perkaraId = Number(s.perkaraId);
    if (Number.isFinite(perkaraId) && perkaraId > 0) {
      syarat.push("perkara_id = ?");
      nilai.push(perkaraId);
    }
    const nomor = String(s.nomorPerkara || "").trim();
    if (nomor) {
      syarat.push("nomor_perkara = ?");
      nilai.push(nomor.slice(0, 120));
    }
    // Uji kering tidak mengubah apa pun di SIPP, jadi ia tidak termasuk
    // "yang dilakukan ALETA" kecuali diminta tegas.
    if (s.termasukKering !== true) syarat.push("kering = 0");

    const batas = Math.max(1, Math.min(200, Number(s.batas) || 40));
    const baris = await kueri(
      `SELECT id, waktu, aksi, jenis, perkara_id, nomor_perkara, tanggal_penetapan,
              akun_sipp, nama_pejabat, operator, ip, berhasil, kering, alasan,
              jumlah_langkah, tabel_disentuh
         FROM ${TABEL}
        ${syarat.length ? `WHERE ${syarat.join(" AND ")}` : ""}
        ORDER BY waktu DESC, id DESC
        LIMIT ${batas}`,
      nilai
    );

    return {
      ok: true,
      jumlah: Array.isArray(baris) ? baris.length : 0,
      baris: (Array.isArray(baris) ? baris : []).map((b) => ({
        id: Number(b.id),
        waktu: b.waktu instanceof Date ? b.waktu.toISOString() : String(b.waktu || ""),
        aksi: String(b.aksi || ""),
        jenis: String(b.jenis || ""),
        perkaraId: Number(b.perkara_id) || 0,
        nomorPerkara: String(b.nomor_perkara || ""),
        tanggalPenetapan: b.tanggal_penetapan
          ? String(b.tanggal_penetapan instanceof Date
              ? b.tanggal_penetapan.toISOString().slice(0, 10)
              : b.tanggal_penetapan).slice(0, 10)
          : "",
        akunSipp: String(b.akun_sipp || ""),
        namaPejabat: String(b.nama_pejabat || ""),
        operator: String(b.operator || ""),
        berhasil: Number(b.berhasil) === 1,
        kering: Number(b.kering) === 1,
        alasan: String(b.alasan || ""),
        jumlahLangkah: Number(b.jumlah_langkah) || 0,
        tabel: String(b.tabel_disentuh || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      })),
    };
  } catch (galat) {
    return { ok: false, alasan: "riwayat_tidak_terbaca", pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
}

/** Satu baris rincian untuk satu jejak - dipakai ketika [detil] dibuka. */
async function rincian(id) {
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return { ok: false, alasan: "id_tidak_sah" };
  try {
    await pastikanTabel();
    const baris = await kueri(`SELECT rincian FROM ${TABEL} WHERE id = ? LIMIT 1`, [nomor]);
    if (!Array.isArray(baris) || !baris[0]) return { ok: false, alasan: "jejak_tidak_ketemu" };
    let langkah = [];
    try {
      langkah = JSON.parse(String(baris[0].rincian || "[]"));
    } catch {
      langkah = [];
    }
    return { ok: true, langkah: Array.isArray(langkah) ? langkah : [] };
  } catch (galat) {
    return { ok: false, alasan: "rincian_tidak_terbaca", pesan: String((galat && galat.message) || galat).slice(0, 200) };
  }
}

module.exports = { TABEL, catat, riwayat, rincian, pastikanTabel };
