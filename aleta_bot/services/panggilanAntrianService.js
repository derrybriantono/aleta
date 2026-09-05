"use strict";

/**
 * Memanggil nomor antrian, dan mengingat berapa kali sudah dipanggil.
 *
 * ============================================================================
 * KENAPA ALETA IKUT MEMANGGIL
 * ============================================================================
 *
 * Sebelum ini ALETA hanya membaca: layar dan suaranya menampilkan apa yang
 * sudah diputuskan aplikasi antrian. Artinya petugas tetap harus berpindah
 * aplikasi untuk mengerjakan satu-satunya hal yang benar-benar mengubah
 * keadaan - memanggil.
 *
 * Yang ditulis PERSIS yang ditulis mesin antrian: disidang = 10 dan jam
 * panggil. Dengan begitu layar aplikasi antrian tetap benar, mesinnya tetap
 * benar, dan tidak ada dua sumber kebenaran yang berselisih. ALETA menjadi
 * pintu kedua ke pekerjaan yang sama, bukan sistem tandingan.
 *
 * ============================================================================
 * YANG TIDAK DIMILIKI APLIKASI ANTRIAN: RIWAYAT PANGGILAN
 * ============================================================================
 *
 * Tabel antrian hanya menyimpan SATU jam panggil. Ia tidak dapat menjawab
 * "sudah dipanggil berapa kali" - padahal itulah yang menentukan tindakan
 * berikutnya: pesan yang dikirim ALETA kepada para pihak sendiri berbunyi
 * "jika nomor perkara Anda sudah dipanggil tiga kali dan tidak hadir, perkara
 * Anda akan ditunda".
 *
 * Aturan itu selama ini dijaga ingatan petugas. Di sini ia dicatat: tiap
 * panggilan disimpan tersendiri beserta waktunya dan siapa yang memanggil,
 * sehingga hitungan ketiga terlihat oleh siapa pun yang membuka layar - bukan
 * hanya oleh yang kebetulan sedang berjaga sejak pagi.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const externalDbService = require("./externalDbService");
const logService = require("./logService");
const { cleanText } = require("./ecourtTextService");

const KUNCI_KONEKSI = "antrian_sidang";

/**
 * Nilai yang dipakai mesin antrian untuk menandai "sudah dipanggil".
 *
 * Dibaca apa adanya oleh antrianSidangService, dan ditulis apa adanya di sini.
 * Nilai lain TIDAK pernah ditulis - artinya tidak diketahui, dan menebak arti
 * sebuah kode di aplikasi orang lain adalah cara tercepat merusaknya.
 */
const DISIDANG_DIPANGGIL = 10;

/** Batas panggilan sebelum perkara patut ditunda - sesuai pesan ke para pihak. */
const BATAS_PANGGILAN = 3;

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return true;

  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_antrian_panggilan (
      id VARCHAR(64) PRIMARY KEY,
      perkara_id VARCHAR(32) NOT NULL,
      nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
      tanggal DATE NOT NULL,
      nomor_antrian INT NULL,
      urutan INT NOT NULL DEFAULT 1,
      no_ruang INT NULL,
      dipanggil_pada DATETIME NOT NULL,
      oleh VARCHAR(191) NOT NULL DEFAULT '',
      INDEX idx_panggilan_perkara (perkara_id, tanggal),
      INDEX idx_panggilan_tanggal (tanggal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  skemaSiap = true;
  return true;
}

function lupakan() {
  skemaSiap = false;
}

function hariIni() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function tanggalSah(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

/** Berapa kali tiap perkara sudah dipanggil hari ini. */
async function riwayatPanggilan(daftarPerkaraId = [], tanggal = "") {
  await ensureSchema();
  const hari = tanggalSah(tanggal) || hariIni();
  const id = [...new Set(daftarPerkaraId.map((x) => String(x || "")).filter(Boolean))];
  if (id.length === 0) return {};

  const peta = {};
  for (let mulai = 0; mulai < id.length; mulai += 500) {
    const bagian = id.slice(mulai, mulai + 500);
    const isian = bagian.map(() => "?").join(", ");
    const rows = await botDb.query(
      `SELECT perkara_id AS perkaraId, urutan, dipanggil_pada AS dipanggilPada, oleh
         FROM aleta_bot_antrian_panggilan
        WHERE tanggal = ? AND perkara_id IN (${isian})
        ORDER BY urutan ASC`,
      [hari, ...bagian]
    );

    for (const row of Array.isArray(rows) ? rows : []) {
      const kunci = String(row.perkaraId || "");
      if (!peta[kunci]) peta[kunci] = { jumlah: 0, batas: BATAS_PANGGILAN, panggilan: [] };
      const waktu = botDb.fromMysqlDate(row.dipanggilPada);
      peta[kunci].panggilan.push({
        urutan: Number(row.urutan) || 0,
        jam: waktu
          ? `${String(waktu.getHours()).padStart(2, "0")}:${String(waktu.getMinutes()).padStart(2, "0")}`
          : "",
        oleh: String(row.oleh || ""),
      });
      peta[kunci].jumlah = peta[kunci].panggilan.length;
    }
  }

  // Penanda "sudah tiga kali" disusun di sini, bukan di layar - supaya layar
  // petugas, layar ruang tunggu, dan jawaban WhatsApp memakai aturan yang sama.
  for (const nilai of Object.values(peta)) {
    nilai.sudahBatas = nilai.jumlah >= BATAS_PANGGILAN;
  }

  return peta;
}

/**
 * Memanggil satu perkara.
 *
 * Dua hal terjadi: riwayatnya bertambah di ALETA, dan penanda dipanggil
 * ditulis ke aplikasi antrian supaya layar dan mesinnya ikut berubah.
 *
 * Urutan pengerjaannya disengaja - aplikasi antrian ditulis LEBIH DULU, dan
 * riwayatnya baru dicatat kalau tulisan itu benar-benar mengenai baris. Bila
 * tidak, panggilannya memang tidak terjadi: layar ruang tunggu tidak berubah
 * dan tidak ada yang mendengar apa pun. Mencatat riwayat lebih dulu akan
 * menghasilkan hitungan "sudah dipanggil dua kali" atas panggilan yang tidak
 * pernah terdengar siapa pun - dan hitungan itu yang dipakai memutuskan
 * penundaan perkara.
 *
 * Tulisannya disaring tanggal_sidang = CURDATE(). Tabel antrian menyimpan
 * satu baris untuk tiap tanggal sidang dan tidak dibersihkan saat berganti
 * hari, sehingga "WHERE perkara_id = ?" saja akan menandai sidang-sidang
 * perkara ini yang sudah lewat sebagai sedang dipanggil - lengkap dengan
 * jam_sidang hari ini menimpa jam aslinya, dan pemicu notif_3 di tabel itu
 * ikut menyala untuk sidang yang sudah selesai.
 */
async function panggil({ perkaraId, nomorPerkara = "", nomorAntrian = null, noRuang = null, oleh = "" } = {}) {
  const id = String(perkaraId || "").trim();
  if (!id) return { ok: false, alasan: "perkara_id_kosong" };

  let hasilTulis;
  try {
    hasilTulis = await externalDbService.query(
      KUNCI_KONEKSI,
      `UPDATE sipp_turunan_antrian.antrian_sidang
          SET disidang = ?, jam_sidang = NOW()
        WHERE perkara_id = ? AND tanggal_sidang = CURDATE()`,
      [DISIDANG_DIPANGGIL, id]
    );
  } catch (galat) {
    return {
      ok: false,
      alasan: `Aplikasi antrian tidak dapat diperbarui: ${
        externalDbService.sanitizeError
          ? String(externalDbService.sanitizeError(galat)).slice(0, 200)
          : String(galat.message || galat).slice(0, 200)
      }`,
    };
  }

  // UPDATE yang tidak mengenai baris apa pun BUKAN kegagalan menurut MySQL -
  // ia berhasil, hanya saja atas nol baris. Tanpa pemeriksaan ini, memanggil
  // perkara yang belum terdaftar di antrian hari ini akan tetap tercatat
  // "sudah dipanggil ke-1" di ALETA, padahal layar ruang tunggu tidak berubah
  // dan tidak ada yang mendengar apa pun. Hitungan itulah yang dipakai
  // memutuskan penundaan perkara, jadi ia tidak boleh menghitung panggilan
  // yang tidak pernah terjadi.
  if (Number(hasilTulis && hasilTulis.affectedRows) === 0) {
    return {
      ok: false,
      alasan:
        "Perkara ini tidak punya baris antrian bertanggal hari ini, sehingga tidak ada yang dipanggil. Daftarkan jadwalnya ke antrian lebih dulu.",
    };
  }

  await ensureSchema();
  const hari = hariIni();
  const sekarang = new Date();

  const sebelumnya = await riwayatPanggilan([id], hari);
  const urutan = (sebelumnya[id]?.jumlah || 0) + 1;

  await botDb.query(
    `INSERT INTO aleta_bot_antrian_panggilan
       (id, perkara_id, nomor_perkara, tanggal, nomor_antrian, urutan, no_ruang, dipanggil_pada, oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `pg-${id}-${sekarang.getTime()}-${crypto.randomBytes(4).toString("hex")}`,
      id,
      cleanText(nomorPerkara).slice(0, 191),
      hari,
      Number.isFinite(Number(nomorAntrian)) ? Number(nomorAntrian) : null,
      urutan,
      Number.isFinite(Number(noRuang)) ? Number(noRuang) : null,
      botDb.toMysqlDate(sekarang),
      cleanText(oleh).slice(0, 191),
    ]
  );

  void logService.logSystemEvent({
    eventType: "antrian_dipanggil",
    severity: "info",
    message: `Antrian dipanggil dari ALETA (panggilan ke-${urutan}).`,
    metadata: { perkaraId: id, nomorPerkara, nomorAntrian, urutan, oleh },
  });

  return {
    ok: true,
    urutan,
    batas: BATAS_PANGGILAN,
    sudahBatas: urutan >= BATAS_PANGGILAN,
    // Kalimat untuk petugas disusun di sini supaya sama di mana pun ia muncul.
    keterangan:
      urutan >= BATAS_PANGGILAN
        ? `Panggilan ke-${urutan}. Sudah mencapai batas ${BATAS_PANGGILAN} kali - bila tetap tidak hadir, perkara patut ditunda.`
        : `Panggilan ke-${urutan} dari ${BATAS_PANGGILAN}.`,
  };
}

module.exports = {
  BATAS_PANGGILAN,
  DISIDANG_DIPANGGIL,
  KUNCI_KONEKSI,
  ensureSchema,
  lupakan,
  panggil,
  riwayatPanggilan,
};
