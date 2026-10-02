"use strict";

/**
 * ============================================================================
 * TOMBOL "SELESAI" JADWAL SIDANG - SINKRON DUA ARAH DENGAN ANTRIAN SIDANG
 * ============================================================================
 *
 * Perbaikan 1 Oktober 2026 (butir J2). Diminta pengguna: tombol Selesai yang
 * menghijaukan perkara di Jadwal Sidang ALETA, SINKRON dua arah dengan
 * aplikasi Antrian Sidang bawaan - antrian hijau -> jadwal ALETA hijau, dan
 * sebaliknya.
 *
 * ============================================================================
 * PENANDA SELESAI YANG SUDAH ADA - DIBACA DARI KODE SIPP, BUKAN DITEBAK
 * ============================================================================
 *
 * Antrian sidang bawaan SIPP (controllers/manageAntrian.php) menyimpan
 * keadaannya di tabel `antrian`, kolom `status`:
 *
 *     0  menunggu        (f_validate_input_antrian: 'status'=>0)
 *     1  ditunda/skors   (tunda_antrian:   $data['status']=1)
 *     2  SELESAI         (selesai_antrian: array('status'=>2))
 *
 * Penanda yang sama SUDAH ditulis ALETA saat sidang ditunda atau diputus -
 * sidangHasilService.setelAntrian(keadaan: ANTRIAN_SELESAI). Berkas ini tidak
 * membuat jalur tulis SIPP yang baru: tombol Selesai memakai setelAntrian
 * yang sama, dan membaca kolom yang sama.
 *
 * ============================================================================
 * MESIN ANTRIAN RUANG TUNGGU - HANYA BILA NILAINYA DISEBUT
 * ============================================================================
 *
 * Aplikasi antrian ruang tunggu satker (sipp_turunan_antrian.antrian_sidang)
 * memakai `disidang = 10` untuk "dipanggil" - lihat panggilanAntrianService,
 * yang sengaja TIDAK menulis nilai lain karena artinya tidak diketahui.
 * Nilai "selesai"-nya belum pernah terbaca dari kodenya. Menebaknya berarti
 * menulis kode yang mungkin berarti lain di aplikasi orang lain.
 *
 * Karena itu jalurnya ADA tetapi MATI sampai nilainya disebut tegas lewat
 * lingkungan ALETA_ANTRIAN_DISIDANG_SELESAI (mis. "20"). Sebelum itu, GET
 * /diagnosa menyebut nilai disidang apa saja yang hidup hari ini, supaya yang
 * memasangnya dapat mencocokkannya dengan layar aplikasi antrian - bukan
 * menebak.
 *
 * ============================================================================
 * CATATAN ALETA SENDIRI - SUPAYA HIJAUNYA TIDAK BERGANTUNG PADA ADA TIDAKNYA
 * BARIS ANTRIAN
 * ============================================================================
 *
 * Tidak semua perkara punya baris antrian (yang tidak mengambil nomor). Tanpa
 * catatan sendiri, tombol Selesai pada perkara itu tidak menghijaukan apa pun
 * - tekanannya hilang tanpa bekas. Catatannya di basis data ALETA
 * (aleta_bot_sidang_selesai), satu baris per perkara x tanggal sidang; ada =
 * selesai, dihapus saat dibatalkan.
 */

const TABEL = "aleta_bot_sidang_selesai";

/**
 * ============================================================================
 * SKORS - SIDANG BELUM SELESAI, DAPAT DILANJUTKAN (PERBAIKAN 2 OKT 2026, B10)
 * ============================================================================
 *
 * Diminta pengguna: dari perkara yang SEDANG disidangkan, lompat ke perkara
 * lain dan nyatakan sidang yang ditinggalkan BELUM SELESAI - dapat dilanjutkan
 * nanti. Tanda Selesai yang sah tidak boleh terhapus olehnya.
 *
 * Catatannya di tabel ALETA sendiri (riwayat jujur: siapa, kapan, alamat IP,
 * lewat ALETA) - satu baris per skors, tidak pernah ditimpa; melanjutkan
 * hanya mengisi dilanjutkan_pada. Dibuat sendiri oleh layanan ini (CREATE
 * TABLE IF NOT EXISTS) seperti aleta_bot_sidang_selesai - bukan migrasi
 * Drizzle portal.
 *
 * Ke SIPP hanya nilai ASLI manageAntrian.php: antrian.status 1 (tunda_antrian
 * = skors). Tanpa penanda ALETA apa pun (butir 14). Penulisannya BERSYARAT
 * status: 0 -> 1 saat diskors, 1 -> 0 saat dilanjutkan - status 2 (selesai)
 * tidak pernah tersentuh. Itu sebabnya tidak memakai setelAntrian, yang
 * menimpa status apa pun: skors yang menimpa "selesai" justru menghapus tanda
 * Selesai yang sah.
 *
 * Mesin antrian ruang tunggu TIDAK disentuh: nilai disidang untuk "skors"
 * tidak pernah terbaca dari kodenya (lihat catatan nilai selesai di atas).
 */
const TABEL_SKORS = "aleta_bot_sidang_skors";

/** Keadaan antrian SIPP menurut manageAntrian.php - sama dengan sidangHasilService. */
const ANTRIAN_MENUNGGU = 0;
const ANTRIAN_SKORS = 1;
const ANTRIAN_SELESAI = 2;

/** Nilai "dipanggil" mesin antrian ruang tunggu - sama dengan panggilanAntrianService. */
const DISIDANG_DIPANGGIL = 10;

/**
 * ============================================================================
 * SEDANG BERJALAN - TANDA MANUAL + "PROSES SIDANG" MESIN ANTRIAN (2 OKT 2026 MALAM)
 * ============================================================================
 *
 * Tampilan "sedang disidangkan" di Jadwal Sidang sampai sekarang diturunkan
 * dari panggilan terakhir per ruang (rekaman buku waktu antrian). Dua tambahan:
 *
 *   1. TANDA MANUAL - petugas menekan "Tandai sedang berjalan" bila perkara
 *      lagi disidangkan tetapi tidak terdeteksi dari antrian (dan "Batalkan
 *      tanda"). Catatannya di tabel ALETA aleta_bot_sidang_berjalan (CREATE
 *      TABLE IF NOT EXISTS, pola aleta_bot_sidang_skors - bukan migrasi
 *      Drizzle): siapa, kapan, IP, lewat ALETA. Satu baris per penandaan;
 *      dibatalkan = dibatalkan_pada terisi, tidak dihapus.
 *
 *   2. "PROSES SIDANG" DI MESIN ANTRIAN RUANG TUNGGU - dibaca dan ditulis
 *      HANYA bila nilainya disebut tegas lewat ALETA_ANTRIAN_DISIDANG_PROSES.
 *      Nilainya TIDAK ditebak (sama dengan ALETA_ANTRIAN_DISIDANG_SELESAI):
 *      GET /selesai/diagnosa menyebut nilai disidang apa yang hidup hari ini
 *      beserta ruangan_id-nya, supaya yang memasangnya mencocokkan dengan
 *      layar aplikasi antrian.
 *
 *        ALETA_ANTRIAN_DISIDANG_PROSES=ruang   disidang = nomor ruang (ruangan_id)
 *            -> pola salinan aplikasi antrian (php/menu.sidang.php: tombol PROSES
 *               menulis disidang = ruang + jam_sidang = now(); BATAL / SKORS
 *               SIDANG menulis NULL; SELESAI SIDANG menulis 10). Salinan itu dari
 *               satker lain - cocokkan dengan diagnosa sebelum menyalakannya.
 *        ALETA_ANTRIAN_DISIDANG_PROSES=<angka> kode tetap (bukan 10, bukan nilai selesai)
 *        kosong / lainnya                       mati: mesin tidak dibaca, tidak ditulis
 *
 *      Yang ditulis ke mesin hanya nilai asli aplikasi itu (nomor ruang atau
 *      NULL) - tanpa penanda ALETA di kolom mana pun (butir 14, 2 Okt).
 */
const TABEL_BERJALAN = "aleta_bot_sidang_berjalan";

/**
 * Nilai "proses sidang" mesin ruang tunggu - HANYA dari lingkungan.
 * Hasil: null (mati) | { mode: "ruang" } | { mode: "nilai", nilai }.
 * 10 ditolak: ALETA memakainya sebagai "dipanggil", dan salinan aplikasi antrian
 * memakainya untuk "selesai" - tidak pernah boleh menjadi "proses".
 */
function nilaiDisidangProses(mentah = process.env.ALETA_ANTRIAN_DISIDANG_PROSES) {
  const teks = bersih(mentah).toLowerCase();
  if (teks === "ruang") return { mode: "ruang" };
  if (!/^\d{1,4}$/.test(teks)) return null;
  const angka = Number(teks);
  if (angka === DISIDANG_DIPANGGIL) return null;
  return { mode: "nilai", nilai: angka };
}

/** "YYYY-MM-DD HH:MM:SS" dari jam_sidang (TIME atau DATETIME, dibaca CAST AS CHAR) dan tanggal sidangnya. */
function waktuDariJamSidang(jam, tanggal) {
  const teks = bersih(jam);
  const penuh = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/.exec(teks);
  if (penuh) return `${penuh[1]} ${penuh[2]}:${penuh[3] || "00"}`;
  const saja = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(teks);
  if (saja && tanggalSah(tanggal)) return `${tanggalSah(tanggal)} ${saja[1].padStart(2, "0")}:${saja[2]}:${saja[3] || "00"}`;
  return "";
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

function sebutGalat(galat) {
  return String((galat && galat.message) || galat || "galat").slice(0, 200);
}

/**
 * Nilai disidang "selesai" mesin antrian ruang tunggu - HANYA dari lingkungan.
 * Kosong / bukan angka bulat / sama dengan nilai dipanggil = jalur mati.
 */
function nilaiDisidangSelesai(mentah = process.env.ALETA_ANTRIAN_DISIDANG_SELESAI) {
  const teks = bersih(mentah);
  if (!/^\d{1,4}$/.test(teks)) return null;
  const angka = Number(teks);
  if (angka === DISIDANG_DIPANGGIL) return null;
  return angka;
}

function kunciSelesai(perkaraId, tanggalSidang) {
  return `${bersih(perkaraId)}|${tanggalSah(tanggalSidang)}`;
}

/**
 * Layanan dengan ketergantungan yang dapat ditukar - uji memakai basis data
 * tiruan; produksi memakai sambungan yang sama dengan layanan lain. Semua
 * require dikerjakan LAMBAT supaya memuat berkas ini tidak membuka sambungan.
 */
function buatLayanan(deps = {}) {
  const kueriSipp =
    deps.kueriSipp ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriBot = deps.kueriBot || ((sql, params = []) => require("./botDbService").query(sql, params));
  const kueriRuangTunggu =
    deps.kueriRuangTunggu ||
    ((sql, params = []) => require("./externalDbService").query("antrian_sidang", sql, params));
  const setelAntrian =
    deps.setelAntrian || ((isi) => require("./sidangHasilService").setelAntrian(isi));
  const disidangSelesai =
    deps.disidangSelesai !== undefined ? deps.disidangSelesai : nilaiDisidangSelesai();
  // "Proses sidang" mesin ruang tunggu - mati bila tidak disebut, dan mati
  // pula bila kode tetapnya sama dengan nilai selesai (keduanya tak mungkin satu).
  let disidangProses = deps.disidangProses !== undefined ? deps.disidangProses : nilaiDisidangProses();
  if (
    disidangProses &&
    disidangProses.mode === "nilai" &&
    disidangSelesai !== null &&
    disidangProses.nilai === disidangSelesai
  ) {
    disidangProses = null;
  }

  /** Kondisi SQL "sedang proses sidang" pada antrian_sidang (tanpa alias). */
  const kondisiProses = () =>
    disidangProses && disidangProses.mode === "ruang"
      ? { sql: "disidang = ruangan_id AND disidang BETWEEN 1 AND 9", params: [] }
      : { sql: "disidang = ?", params: [disidangProses ? disidangProses.nilai : -1] };

  let tabelSiap = false;
  async function pastikanTabel() {
    if (tabelSiap) return;
    await kueriBot(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        perkara_id VARCHAR(32) NOT NULL,
        tanggal_sidang DATE NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        oleh VARCHAR(191) NOT NULL DEFAULT '',
        ditandai_pada DATETIME NOT NULL,
        PRIMARY KEY (perkara_id, tanggal_sidang),
        INDEX idx_sidang_selesai_tanggal (tanggal_sidang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
  }

  /**
   * Peta selesai untuk satu rentang tanggal - dari ketiga sumber.
   *
   * Tiap sumber yang gagal dibaca TIDAK menjatuhkan yang lain: hijau dari
   * catatan ALETA tetap tampil walau SIPP sedang tidak terjangkau. Yang gagal
   * disebut di `sumber`, bukan didiamkan sebagai "tidak ada yang selesai".
   */
  async function petaSelesai({ dari, sampai } = {}) {
    const awal = tanggalSah(dari);
    const akhir = tanggalSah(sampai) || awal;
    if (!awal) return { ok: false, alasan: "tanggal_tidak_sah", peta: {}, sumber: {} };

    const peta = {};
    const tambah = (perkaraId, tanggal, sumber, ekstra = {}) => {
      const kunci = kunciSelesai(perkaraId, tanggal);
      if (!bersih(perkaraId) || !tanggalSah(tanggal)) return;
      if (!peta[kunci]) peta[kunci] = { perkaraId: bersih(perkaraId), tanggalSidang: tanggalSah(tanggal), sumber: [] };
      if (!peta[kunci].sumber.includes(sumber)) peta[kunci].sumber.push(sumber);
      Object.assign(peta[kunci], ekstra);
    };

    const sumber = {
      aleta: { terbaca: false, alasan: "" },
      antrianSipp: { terbaca: false, alasan: "" },
      antrianRuangTunggu: { terbaca: false, alasan: "", disetel: disidangSelesai !== null },
    };

    try {
      await pastikanTabel();
      const baris = await kueriBot(
        `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
                oleh, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS ditandaiPada
           FROM ${TABEL}
          WHERE tanggal_sidang BETWEEN ? AND ?`,
        [awal, akhir]
      );
      for (const b of Array.isArray(baris) ? baris : []) {
        tambah(b.perkaraId, b.tanggalSidang, "aleta", { oleh: bersih(b.oleh), ditandaiPada: bersih(b.ditandaiPada) });
      }
      sumber.aleta.terbaca = true;
    } catch (galat) {
      sumber.aleta.alasan = sebutGalat(galat);
    }

    try {
      const baris = await kueriSipp(
        `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang
           FROM antrian
          WHERE tanggal_sidang BETWEEN ? AND ? AND status = ?`,
        [awal, akhir, ANTRIAN_SELESAI]
      );
      for (const b of Array.isArray(baris) ? baris : []) tambah(b.perkaraId, b.tanggalSidang, "antrian-sipp");
      sumber.antrianSipp.terbaca = true;
    } catch (galat) {
      sumber.antrianSipp.alasan = sebutGalat(galat);
    }

    if (disidangSelesai !== null) {
      try {
        const baris = await kueriRuangTunggu(
          `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang
             FROM sipp_turunan_antrian.antrian_sidang
            WHERE tanggal_sidang BETWEEN ? AND ? AND disidang = ?`,
          [awal, akhir, disidangSelesai]
        );
        for (const b of Array.isArray(baris) ? baris : []) tambah(b.perkaraId, b.tanggalSidang, "antrian-ruang-tunggu");
        sumber.antrianRuangTunggu.terbaca = true;
      } catch (galat) {
        sumber.antrianRuangTunggu.alasan = sebutGalat(galat);
      }
    } else {
      sumber.antrianRuangTunggu.alasan = "nilai_selesai_belum_disetel";
    }

    // Skors yang masih berlaku (belum dilanjutkan) - peta tersendiri, tidak
    // dicampur ke peta selesai: skors BUKAN selesai.
    const skors = {};
    sumber.skors = { terbaca: false, alasan: "" };
    try {
      await pastikanTabelSkors();
      const baris = await kueriBot(
        `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
                nomor_perkara AS nomorPerkara, oleh, alasan, panggil_saat_skors AS panggilSaatSkors,
                DATE_FORMAT(diskors_pada, '%Y-%m-%d %H:%i:%s') AS diskorsPada
           FROM ${TABEL_SKORS}
          WHERE tanggal_sidang BETWEEN ? AND ? AND dilanjutkan_pada IS NULL
          ORDER BY id ASC`,
        [awal, akhir]
      );
      for (const b of Array.isArray(baris) ? baris : []) {
        if (!bersih(b.perkaraId) || !tanggalSah(b.tanggalSidang)) continue;
        // Yang terakhir menang bila (karena balapan) ada dua yang berlaku.
        skors[kunciSelesai(b.perkaraId, b.tanggalSidang)] = {
          perkaraId: bersih(b.perkaraId),
          tanggalSidang: tanggalSah(b.tanggalSidang),
          nomorPerkara: bersih(b.nomorPerkara),
          oleh: bersih(b.oleh),
          alasan: bersih(b.alasan),
          panggilSaatSkors: bersih(b.panggilSaatSkors),
          diskorsPada: bersih(b.diskorsPada),
        };
      }
      sumber.skors.terbaca = true;
    } catch (galat) {
      sumber.skors.alasan = sebutGalat(galat);
    }

    // Sedang berjalan: tanda manual ALETA + "proses sidang" mesin (bila disetel).
    // Peta tersendiri - berjalan BUKAN selesai dan bukan skors.
    const berjalan = { manual: {}, proses: [] };
    sumber.berjalan = { terbaca: false, alasan: "" };
    try {
      await pastikanTabelBerjalan();
      const baris = await kueriBot(
        `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
                nomor_perkara AS nomorPerkara, ruang, oleh, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS ditandaiPada
           FROM ${TABEL_BERJALAN}
          WHERE tanggal_sidang BETWEEN ? AND ? AND dibatalkan_pada IS NULL
          ORDER BY id ASC`,
        [awal, akhir]
      );
      for (const b of Array.isArray(baris) ? baris : []) {
        if (!bersih(b.perkaraId) || !tanggalSah(b.tanggalSidang)) continue;
        berjalan.manual[kunciSelesai(b.perkaraId, b.tanggalSidang)] = {
          perkaraId: bersih(b.perkaraId),
          tanggalSidang: tanggalSah(b.tanggalSidang),
          nomorPerkara: bersih(b.nomorPerkara),
          ruang: bersih(b.ruang),
          oleh: bersih(b.oleh),
          ditandaiPada: bersih(b.ditandaiPada),
        };
      }
      sumber.berjalan.terbaca = true;
    } catch (galat) {
      sumber.berjalan.alasan = sebutGalat(galat);
    }

    sumber.antrianProses = { terbaca: false, alasan: "", disetel: disidangProses !== null };
    if (disidangProses) {
      try {
        const k = kondisiProses();
        const baris = await kueriRuangTunggu(
          `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
                  ruangan_id AS ruanganId, no_ruang AS noRuang, CAST(jam_sidang AS CHAR) AS jamSidang
             FROM sipp_turunan_antrian.antrian_sidang
            WHERE tanggal_sidang BETWEEN ? AND ? AND ${k.sql}`,
          [awal, akhir, ...k.params]
        );
        for (const b of Array.isArray(baris) ? baris : []) {
          if (!bersih(b.perkaraId) || !tanggalSah(b.tanggalSidang)) continue;
          const ruang = Number(b.ruanganId) > 0 ? Number(b.ruanganId) : Number(b.noRuang) > 0 ? Number(b.noRuang) : null;
          berjalan.proses.push({
            perkaraId: bersih(b.perkaraId),
            tanggalSidang: tanggalSah(b.tanggalSidang),
            noRuang: ruang,
            sejak: waktuDariJamSidang(b.jamSidang, b.tanggalSidang),
          });
        }
        sumber.antrianProses.terbaca = true;
      } catch (galat) {
        sumber.antrianProses.alasan = sebutGalat(galat);
      }
    } else {
      sumber.antrianProses.alasan = "nilai_proses_belum_disetel";
    }

    return { ok: true, dari: awal, sampai: akhir, peta, skors, berjalan, sumber };
  }

  let tabelBerjalanSiap = false;
  async function pastikanTabelBerjalan() {
    if (tabelBerjalanSiap) return;
    await kueriBot(`
      CREATE TABLE IF NOT EXISTS ${TABEL_BERJALAN} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        perkara_id VARCHAR(32) NOT NULL,
        tanggal_sidang DATE NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        ruang VARCHAR(64) NOT NULL DEFAULT '',
        oleh VARCHAR(191) NOT NULL DEFAULT '',
        ip VARCHAR(45) NOT NULL DEFAULT '',
        lewat VARCHAR(32) NOT NULL DEFAULT 'ALETA',
        ditandai_pada DATETIME NOT NULL,
        mesin_ditulis TINYINT(1) NOT NULL DEFAULT 0,
        dibatalkan_pada DATETIME NULL,
        dibatalkan_oleh VARCHAR(191) NOT NULL DEFAULT '',
        dibatalkan_ip VARCHAR(45) NOT NULL DEFAULT '',
        alasan_batal VARCHAR(64) NOT NULL DEFAULT '',
        PRIMARY KEY (id),
        INDEX idx_sidang_berjalan_perkara (perkara_id, tanggal_sidang),
        INDEX idx_sidang_berjalan_tanggal (tanggal_sidang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelBerjalanSiap = true;
  }

  /** Membatalkan tanda manual yang berlaku - dikembalikan: apakah ALETA yang menulis mesin untuk tanda itu. */
  async function batalkanTandaManual({ id, tanggal, oleh = "", ip = "", alasan = "dibatalkan" }) {
    await pastikanTabelBerjalan();
    const aktif = await kueriBot(
      `SELECT id, mesin_ditulis AS mesinDitulis FROM ${TABEL_BERJALAN}
        WHERE perkara_id = ? AND tanggal_sidang = ? AND dibatalkan_pada IS NULL`,
      [id, tanggal]
    );
    const daftar = Array.isArray(aktif) ? aktif : [];
    if (daftar.length === 0) return { ada: false, mesinDitulis: false };
    await kueriBot(
      `UPDATE ${TABEL_BERJALAN}
          SET dibatalkan_pada = NOW(), dibatalkan_oleh = ?, dibatalkan_ip = ?, alasan_batal = ?
        WHERE perkara_id = ? AND tanggal_sidang = ? AND dibatalkan_pada IS NULL`,
      [bersih(oleh).slice(0, 191), bersih(ip).slice(0, 45), bersih(alasan).slice(0, 64), id, tanggal]
    );
    return { ada: true, mesinDitulis: daftar.some((d) => Number(d.mesinDitulis) === 1) };
  }

  /**
   * Menandai (atau membatalkan tanda) "sedang berjalan" secara MANUAL.
   *
   * MENANDAI ditolak bila sidangnya sudah selesai secara sah (hasil sidang
   * tercatat, ditandai Selesai, antrian SIPP 2) atau sedang DISKORS - yang
   * diskors dilanjutkan lewat Lanjutkan, bukan ditandai ulang.
   *
   * Ke mesin ruang tunggu hanya bila "proses sidang" disetel (lihat atas),
   * dan hanya pada baris yang masih MENUNGGU (disidang NULL) - tidak pernah
   * menimpa selesai atau sidang lain. Antrian SIPP tidak disentuh: SIPP hanya
   * mengenal status 0/1/2 dan tidak punya nilai "proses".
   *
   * Kering kecuali disebut tegas sebaliknya - sama dengan Selesai dan Skors.
   */
  async function setelBerjalan({
    perkaraId,
    tanggalSidang,
    nomorPerkara = "",
    ruang = "",
    berjalan = true,
    hasilSidangSelesai = false,
    oleh = "",
    ip = "",
    kering = true,
  } = {}) {
    const id = bersih(perkaraId);
    const tanggal = tanggalSah(tanggalSidang);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah" };
    if (!tanggal) return { ok: false, alasan: "tanggal_tidak_sah" };
    const menandai = berjalan !== false;

    if (menandai) {
      if (hasilSidangSelesai === true) {
        return { ok: false, alasan: "sudah_selesai_hasil_sidang", pesan: "Hasil sidangnya sudah tercatat di SIPP - sidang ini selesai, tidak dapat ditandai sedang berjalan." };
      }
      try {
        await pastikanTabel();
        const tanda = await kueriBot(
          `SELECT perkara_id FROM ${TABEL} WHERE perkara_id = ? AND tanggal_sidang = ? LIMIT 1`,
          [id, tanggal]
        );
        if (Array.isArray(tanda) && tanda.length > 0) {
          return { ok: false, alasan: "sudah_ditandai_selesai", pesan: "Sidang ini sudah ditandai Selesai. Batalkan tanda Selesai lebih dulu bila memang masih berjalan." };
        }
        await pastikanTabelSkors();
        const diskors = await kueriBot(
          `SELECT id FROM ${TABEL_SKORS} WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL LIMIT 1`,
          [id, tanggal]
        );
        if (Array.isArray(diskors) && diskors.length > 0) {
          return { ok: false, alasan: "sedang_diskors", pesan: "Sidang ini sedang diskors - gunakan Lanjutkan, bukan Tandai sedang berjalan." };
        }
      } catch (galat) {
        return { ok: false, alasan: `Catatan ALETA tidak terbaca: ${sebutGalat(galat)}` };
      }
      try {
        const baris = await kueriSipp(`SELECT status FROM antrian WHERE perkara_id = ? AND tanggal_sidang = ?`, [id, tanggal]);
        if ((Array.isArray(baris) ? baris : []).some((b) => Number(b.status) === ANTRIAN_SELESAI)) {
          return { ok: false, alasan: "antrian_sipp_selesai", pesan: "Antrian sidang SIPP perkara ini sudah berstatus selesai - tidak dapat ditandai sedang berjalan." };
        }
      } catch {
        // SIPP tak terbaca: pemeriksaan ini dilewati, catatan ALETA tetap dapat dibuat.
      }
    }

    const rencana = {
      perkaraId: id,
      tanggalSidang: tanggal,
      berjalan: menandai,
      aleta: menandai ? "catat sedang berjalan (tanda manual)" : "batalkan tanda sedang berjalan (riwayat tidak dihapus)",
      antrianSipp: "tidak disentuh (SIPP hanya mengenal status 0/1/2 dan tidak punya nilai proses sidang)",
      antrianRuangTunggu: !disidangProses
        ? "tidak disentuh (nilai proses sidang belum disetel - lihat GET /selesai/diagnosa)"
        : menandai
          ? "disidang = nilai proses, hanya pada baris yang masih menunggu (disidang NULL) dan belum ada sidang lain berproses di ruangnya"
          : "disidang = NULL, hanya bila ALETA yang menuliskannya dan barisnya masih berproses",
    };
    if (kering !== false) return { ok: true, kering: true, rencana };

    let mesinDitulis = false;
    let antrianRuangTunggu = { ok: true, dilewati: true, alasan: disidangProses ? "" : "nilai_proses_belum_disetel" };

    try {
      await pastikanTabelBerjalan();
      if (menandai) {
        const aktif = await kueriBot(
          `SELECT id FROM ${TABEL_BERJALAN} WHERE perkara_id = ? AND tanggal_sidang = ? AND dibatalkan_pada IS NULL LIMIT 1`,
          [id, tanggal]
        );
        if (!(Array.isArray(aktif) && aktif.length > 0)) {
          await kueriBot(
            `INSERT INTO ${TABEL_BERJALAN}
               (perkara_id, tanggal_sidang, nomor_perkara, ruang, oleh, ip, lewat, ditandai_pada)
             VALUES (?, ?, ?, ?, ?, ?, 'ALETA', NOW())`,
            [id, tanggal, bersih(nomorPerkara).slice(0, 191), bersih(ruang).slice(0, 64), bersih(oleh).slice(0, 191), bersih(ip).slice(0, 45)]
          );
        }
      }
    } catch (galat) {
      return { ok: false, alasan: `Catatan sedang berjalan ALETA tidak tersimpan: ${sebutGalat(galat)}`, rencana };
    }

    if (menandai) {
      if (disidangProses) {
        try {
          // Sidang lain yang sudah berproses di ruang yang sama - jangan menumpuk dua di mesin.
          let lain = [];
          if (disidangProses.mode === "ruang") {
            lain = await kueriRuangTunggu(
              `SELECT b.perkara_id AS perkaraId
                 FROM sipp_turunan_antrian.antrian_sidang b
                 JOIN sipp_turunan_antrian.antrian_sidang a ON a.ruangan_id = b.ruangan_id
                WHERE a.perkara_id = ? AND a.tanggal_sidang = ? AND b.tanggal_sidang = a.tanggal_sidang
                  AND b.disidang = b.ruangan_id AND b.disidang BETWEEN 1 AND 9 AND b.perkara_id <> a.perkara_id
                LIMIT 1`,
              [id, tanggal]
            );
          }
          if (Array.isArray(lain) && lain.length > 0) {
            antrianRuangTunggu = { ok: true, dilewati: true, alasan: "ruang_masih_ada_sidang_berproses", perkaraId: bersih(lain[0].perkaraId) };
          } else {
            const hasil = await kueriRuangTunggu(
              `UPDATE sipp_turunan_antrian.antrian_sidang
                  SET disidang = ${disidangProses.mode === "ruang" ? "ruangan_id" : "?"}, jam_sidang = NOW()
                WHERE perkara_id = ? AND tanggal_sidang = ? AND tanggal_sidang = CURDATE() AND disidang IS NULL${
                  disidangProses.mode === "ruang" ? " AND ruangan_id BETWEEN 1 AND 9" : ""
                }`,
              disidangProses.mode === "ruang" ? [id, tanggal] : [disidangProses.nilai, id, tanggal]
            );
            const baris = Number((hasil && hasil.affectedRows) || 0);
            mesinDitulis = baris > 0;
            antrianRuangTunggu = { ok: true, baris };
          }
        } catch (galat) {
          antrianRuangTunggu = { ok: false, alasan: sebutGalat(galat) };
        }
        if (mesinDitulis) {
          try {
            await kueriBot(
              `UPDATE ${TABEL_BERJALAN} SET mesin_ditulis = 1 WHERE perkara_id = ? AND tanggal_sidang = ? AND dibatalkan_pada IS NULL`,
              [id, tanggal]
            );
          } catch {
            // Penanda ini hanya menentukan apakah pembatalan boleh mengembalikan mesin.
          }
        }
      }
    } else {
      let batal = { ada: false, mesinDitulis: false };
      try {
        batal = await batalkanTandaManual({ id, tanggal, oleh, ip, alasan: "dibatalkan_petugas" });
      } catch (galat) {
        return { ok: false, alasan: `Tanda sedang berjalan ALETA tidak terbatalkan: ${sebutGalat(galat)}`, rencana };
      }
      if (disidangProses && batal.mesinDitulis) {
        try {
          const k = kondisiProses();
          const hasil = await kueriRuangTunggu(
            `UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = NULL
              WHERE perkara_id = ? AND tanggal_sidang = ? AND ${k.sql}`,
            [id, tanggal, ...k.params]
          );
          antrianRuangTunggu = { ok: true, baris: Number((hasil && hasil.affectedRows) || 0) };
        } catch (galat) {
          antrianRuangTunggu = { ok: false, alasan: sebutGalat(galat) };
        }
      } else if (disidangProses) {
        antrianRuangTunggu = { ok: true, dilewati: true, alasan: "mesin_tidak_ditulis_aleta" };
      }
    }

    return { ok: true, kering: false, rencana, berjalan: menandai, antrianRuangTunggu };
  }

  let tabelSkorsSiap = false;
  async function pastikanTabelSkors() {
    if (tabelSkorsSiap) return;
    await kueriBot(`
      CREATE TABLE IF NOT EXISTS ${TABEL_SKORS} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        perkara_id VARCHAR(32) NOT NULL,
        tanggal_sidang DATE NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        alasan VARCHAR(191) NOT NULL DEFAULT '',
        panggil_saat_skors VARCHAR(32) NOT NULL DEFAULT '',
        oleh VARCHAR(191) NOT NULL DEFAULT '',
        ip VARCHAR(45) NOT NULL DEFAULT '',
        lewat VARCHAR(32) NOT NULL DEFAULT 'ALETA',
        diskors_pada DATETIME NOT NULL,
        dilanjutkan_pada DATETIME NULL,
        dilanjutkan_oleh VARCHAR(191) NOT NULL DEFAULT '',
        dilanjutkan_ip VARCHAR(45) NOT NULL DEFAULT '',
        PRIMARY KEY (id),
        INDEX idx_sidang_skors_perkara (perkara_id, tanggal_sidang),
        INDEX idx_sidang_skors_tanggal (tanggal_sidang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSkorsSiap = true;
  }

  /**
   * Menskors (atau melanjutkan) sidang satu perkara.
   *
   * MENSKORS ditolak bila sidangnya sudah selesai secara sah - hasil sidang
   * tercatat (dikirim portal), ditandai Selesai di ALETA, atau antrian SIPP
   * berstatus 2. Yang sah tidak dihapus; yang menekan Skors diberi tahu.
   *
   * Kering kecuali disebut tegas sebaliknya - sama dengan Selesai.
   */
  async function setelSkors({
    perkaraId,
    tanggalSidang,
    nomorPerkara = "",
    ruangId = null,
    skors = true,
    alasan = "",
    panggilSaatSkors = "",
    hasilSidangSelesai = false,
    oleh = "",
    ip = "",
    kering = true,
  } = {}) {
    const id = bersih(perkaraId);
    const tanggal = tanggalSah(tanggalSidang);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah" };
    if (!tanggal) return { ok: false, alasan: "tanggal_tidak_sah" };
    const menskors = skors !== false;
    const ruang = /^\d{1,4}$/.test(bersih(ruangId)) ? Number(bersih(ruangId)) : null;

    if (menskors) {
      if (hasilSidangSelesai === true) {
        return { ok: false, alasan: "sudah_selesai_hasil_sidang", pesan: "Hasil sidangnya sudah tercatat di SIPP - sidang ini selesai, tidak dapat diskors." };
      }
      try {
        await pastikanTabel();
        const tanda = await kueriBot(
          `SELECT perkara_id FROM ${TABEL} WHERE perkara_id = ? AND tanggal_sidang = ? LIMIT 1`,
          [id, tanggal]
        );
        if (Array.isArray(tanda) && tanda.length > 0) {
          return { ok: false, alasan: "sudah_ditandai_selesai", pesan: "Sidang ini sudah ditandai Selesai. Batalkan tanda Selesai lebih dulu bila memang belum selesai." };
        }
      } catch (galat) {
        return { ok: false, alasan: `Catatan selesai ALETA tidak terbaca: ${sebutGalat(galat)}` };
      }
    }

    // Keadaan antrian SIPP - dibaca, bukan ditebak. Gagal membaca tidak
    // menahan catatan ALETA, tetapi SIPP lalu tidak disentuh sama sekali.
    let statusSipp = [];
    let sippTerbaca = true;
    try {
      const baris = await kueriSipp(
        `SELECT status FROM antrian WHERE perkara_id = ? AND tanggal_sidang = ?${ruang ? " AND ruang_id = ?" : ""}`,
        ruang ? [id, tanggal, ruang] : [id, tanggal]
      );
      statusSipp = (Array.isArray(baris) ? baris : []).map((b) => Number(b.status));
    } catch {
      sippTerbaca = false;
    }
    if (menskors && statusSipp.includes(ANTRIAN_SELESAI)) {
      return { ok: false, alasan: "antrian_sipp_selesai", pesan: "Antrian sidang SIPP perkara ini sudah berstatus selesai - tidak diskors." };
    }

    const rencana = {
      perkaraId: id,
      tanggalSidang: tanggal,
      skors: menskors,
      aleta: menskors ? "catat skors (belum selesai)" : "tandai skors dilanjutkan",
      antrianSipp: !sippTerbaca
        ? "tidak disentuh (antrian SIPP tidak terbaca)"
        : menskors
          ? `antrian.status ${ANTRIAN_MENUNGGU} -> ${ANTRIAN_SKORS} (hanya baris berstatus ${ANTRIAN_MENUNGGU})`
          : `antrian.status ${ANTRIAN_SKORS} -> ${ANTRIAN_MENUNGGU} (hanya baris berstatus ${ANTRIAN_SKORS})`,
      antrianRuangTunggu:
        menskors && disidangProses
          ? "disidang = NULL (menunggu lagi), hanya pada baris yang sedang proses sidang - sama dengan BATAL / SKORS SIDANG di aplikasi antrian"
          : "tidak disentuh (nilai proses sidang belum disetel, atau melanjutkan - panggil lagi lewat antrian)",
    };
    if (kering !== false) return { ok: true, kering: true, rencana };

    try {
      await pastikanTabelSkors();
      if (menskors) {
        const aktif = await kueriBot(
          `SELECT id FROM ${TABEL_SKORS} WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL LIMIT 1`,
          [id, tanggal]
        );
        if (!(Array.isArray(aktif) && aktif.length > 0)) {
          await kueriBot(
            `INSERT INTO ${TABEL_SKORS}
               (perkara_id, tanggal_sidang, nomor_perkara, alasan, panggil_saat_skors, oleh, ip, lewat, diskors_pada)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ALETA', NOW())`,
            [
              id,
              tanggal,
              bersih(nomorPerkara).slice(0, 191),
              bersih(alasan).slice(0, 191),
              bersih(panggilSaatSkors).slice(0, 32),
              bersih(oleh).slice(0, 191),
              bersih(ip).slice(0, 45),
            ]
          );
        }
      } else {
        await kueriBot(
          `UPDATE ${TABEL_SKORS} SET dilanjutkan_pada = NOW(), dilanjutkan_oleh = ?, dilanjutkan_ip = ?
            WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL`,
          [bersih(oleh).slice(0, 191), bersih(ip).slice(0, 45), id, tanggal]
        );
      }
    } catch (galat) {
      return { ok: false, alasan: `Catatan skors ALETA tidak tersimpan: ${sebutGalat(galat)}`, rencana };
    }

    let antrianSipp = { ok: true, dilewati: true, alasan: "antrian_sipp_tidak_terbaca" };
    if (sippTerbaca) {
      const dari = menskors ? ANTRIAN_MENUNGGU : ANTRIAN_SKORS;
      const ke = menskors ? ANTRIAN_SKORS : ANTRIAN_MENUNGGU;
      try {
        const hasil = await kueriSipp(
          `UPDATE antrian SET status = ?
            WHERE perkara_id = ? AND tanggal_sidang = ? AND status = ?${ruang ? " AND ruang_id = ?" : ""}`,
          ruang ? [ke, id, tanggal, dari, ruang] : [ke, id, tanggal, dari]
        );
        // Nol baris BUKAN error: tidak semua perkara punya baris antrian SIPP.
        antrianSipp = { ok: true, baris: Number((hasil && hasil.affectedRows) || 0) };
      } catch (galat) {
        antrianSipp = { ok: false, alasan: sebutGalat(galat) };
      }
    }

    // Mesin ruang tunggu: skors = BATAL / SKORS SIDANG aplikasi antrian (disidang
    // kembali NULL) - hanya bila proses sidang disetel dan barisnya memang sedang
    // berproses. Tanda manual TIDAK dibatalkan: skorsnya yang membuat perkara ini
    // tidak berjalan (jam mulainya dicatat), dan Lanjutkan menghidupkannya lagi.
    let antrianRuangTunggu = { ok: true, dilewati: true, alasan: disidangProses ? "melanjutkan" : "nilai_proses_belum_disetel" };
    if (menskors && disidangProses) {
      try {
        const k = kondisiProses();
        const hasil = await kueriRuangTunggu(
          `UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = NULL
            WHERE perkara_id = ? AND tanggal_sidang = ? AND ${k.sql}`,
          [id, tanggal, ...k.params]
        );
        antrianRuangTunggu = { ok: true, baris: Number((hasil && hasil.affectedRows) || 0) };
      } catch (galat) {
        antrianRuangTunggu = { ok: false, alasan: sebutGalat(galat) };
      }
    }

    return { ok: true, kering: false, rencana, skors: menskors, antrianSipp, antrianRuangTunggu };
  }

  /**
   * Menandai (atau membatalkan) selesai - ke ketiga tempat sekaligus.
   *
   * Catatan ALETA ditulis LEBIH DULU dan menentukan berhasil tidaknya: itulah
   * yang menghijaukan baris di layar ini. Antrian SIPP dan mesin ruang tunggu
   * menyusul; gagalnya disebut, tidak membatalkan catatan ALETA - sama
   * seperti penundaan yang tetap sah walau antriannya tidak tergerakkan.
   */
  async function setelSelesai({
    perkaraId,
    tanggalSidang,
    nomorPerkara = "",
    ruangId = null,
    selesai = true,
    oleh = "",
    kering = true,
  } = {}) {
    const id = bersih(perkaraId);
    const tanggal = tanggalSah(tanggalSidang);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah" };
    if (!tanggal) return { ok: false, alasan: "tanggal_tidak_sah" };
    const tandai = selesai !== false;

    const rencana = {
      perkaraId: id,
      tanggalSidang: tanggal,
      selesai: tandai,
      aleta: tandai ? "catat selesai" : "hapus catatan selesai",
      antrianSipp: `antrian.status = ${tandai ? ANTRIAN_SELESAI : ANTRIAN_MENUNGGU}`,
      antrianRuangTunggu:
        disidangSelesai === null
          ? "tidak disentuh (nilai selesai belum disetel)"
          : tandai
            ? `disidang = ${disidangSelesai}`
            : `disidang = ${DISIDANG_DIPANGGIL} (hanya baris yang sedang ${disidangSelesai})`,
    };
    if (kering !== false) return { ok: true, kering: true, rencana };

    try {
      await pastikanTabel();
      if (tandai) {
        await kueriBot(
          `REPLACE INTO ${TABEL} (perkara_id, tanggal_sidang, nomor_perkara, oleh, ditandai_pada)
           VALUES (?, ?, ?, ?, NOW())`,
          [id, tanggal, bersih(nomorPerkara).slice(0, 191), bersih(oleh).slice(0, 191)]
        );
      } else {
        await kueriBot(`DELETE FROM ${TABEL} WHERE perkara_id = ? AND tanggal_sidang = ?`, [id, tanggal]);
      }
    } catch (galat) {
      return { ok: false, alasan: `Catatan selesai ALETA tidak tersimpan: ${sebutGalat(galat)}`, rencana };
    }

    // Sidang yang ditandai SELESAI tidak lagi "berjalan": tanda manual dibatalkan
    // (riwayatnya tetap) supaya tidak hidup lagi bila Selesai kelak dibatalkan.
    if (tandai) {
      try {
        await batalkanTandaManual({ id, tanggal, oleh, alasan: "selesai" });
      } catch {
        // Tabelnya belum ada / tak terjangkau: tidak ada tanda yang perlu dibatalkan.
      }
    }

    let antrianSipp;
    try {
      antrianSipp = await setelAntrian({
        perkaraId: id,
        tanggalSidang: tanggal,
        ruangId: ruangId || null,
        keadaan: tandai ? ANTRIAN_SELESAI : ANTRIAN_MENUNGGU,
        kering: false,
      });
    } catch (galat) {
      antrianSipp = { ok: false, alasan: sebutGalat(galat) };
    }

    let antrianRuangTunggu = { ok: true, dilewati: true, alasan: "nilai_selesai_belum_disetel" };
    if (disidangSelesai !== null) {
      try {
        const hasil = tandai
          ? await kueriRuangTunggu(
              `UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = ?
                WHERE perkara_id = ? AND tanggal_sidang = ?`,
              [disidangSelesai, id, tanggal]
            )
          : await kueriRuangTunggu(
              `UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = ?
                WHERE perkara_id = ? AND tanggal_sidang = ? AND disidang = ?`,
              [DISIDANG_DIPANGGIL, id, tanggal, disidangSelesai]
            );
        antrianRuangTunggu = { ok: true, baris: Number((hasil && hasil.affectedRows) || 0) };
      } catch (galat) {
        antrianRuangTunggu = { ok: false, alasan: sebutGalat(galat) };
      }
    }

    return { ok: true, kering: false, rencana, selesai: tandai, antrianSipp, antrianRuangTunggu };
  }

  /**
   * Nilai disidang yang hidup di mesin antrian ruang tunggu HARI INI - untuk
   * mencocokkan nilai "selesai" dengan layar aplikasinya. Hanya SELECT.
   */
  async function diagnosaRuangTunggu() {
    try {
      const baris = await kueriRuangTunggu(
        `SELECT disidang, COUNT(*) AS jumlah
           FROM sipp_turunan_antrian.antrian_sidang
          WHERE tanggal_sidang = CURDATE()
          GROUP BY disidang`,
        []
      );
      // Sebaran menurut ruangan_id - untuk mencocokkan "proses sidang" = nomor
      // ruang (salinan aplikasi antrian) dengan datanya, BUKAN untuk menyalakannya.
      let sebaranRuang = [];
      try {
        const rinci = await kueriRuangTunggu(
          `SELECT disidang, ruangan_id AS ruanganId, COUNT(*) AS jumlah
             FROM sipp_turunan_antrian.antrian_sidang
            WHERE tanggal_sidang = CURDATE()
            GROUP BY disidang, ruangan_id`,
          []
        );
        sebaranRuang = (Array.isArray(rinci) ? rinci : []).map((b) => ({
          disidang: b.disidang === null || b.disidang === undefined ? null : Number(b.disidang),
          ruanganId: b.ruanganId === null || b.ruanganId === undefined ? null : Number(b.ruanganId),
          jumlah: Number(b.jumlah) || 0,
        }));
      } catch {
        sebaranRuang = [];
      }
      const samaDenganRuang = sebaranRuang.filter(
        (b) => b.disidang !== null && b.disidang === b.ruanganId && b.disidang >= 1 && b.disidang <= 9
      );
      return {
        ok: true,
        disetel: disidangSelesai,
        prosesDisetel: disidangProses,
        nilai: (Array.isArray(baris) ? baris : []).map((b) => ({
          disidang: b.disidang === null || b.disidang === undefined ? null : Number(b.disidang),
          jumlah: Number(b.jumlah) || 0,
        })),
        sebaranRuang,
        // Petunjuk, bukan keputusan: tidak ada yang dinyalakan dari sini.
        petunjuk: {
          salinanAplikasiAntrian:
            "Salinan aplikasi antrian (php/menu.sidang.php dan _fungsi.php): disidang NULL = menunggu, nomor ruang (1-5) = sedang proses sidang di ruang itu, 10 = selesai (tunda/putus/ikrar/Selesai Sidang). ALETA memakai 10 untuk 'dipanggil' - cocokkan dengan layar aplikasi antrian satker sebelum menyetel ALETA_ANTRIAN_DISIDANG_PROSES / ALETA_ANTRIAN_DISIDANG_SELESAI.",
          prosesSamaDenganRuangTerlihat: samaDenganRuang.length > 0,
          usulanProses: samaDenganRuang.length > 0 ? "ruang" : null,
        },
      };
    } catch (galat) {
      return { ok: false, disetel: disidangSelesai, prosesDisetel: disidangProses, alasan: sebutGalat(galat), nilai: [] };
    }
  }

  return {
    petaSelesai,
    setelSelesai,
    setelSkors,
    setelBerjalan,
    diagnosaRuangTunggu,
    pastikanTabel,
    pastikanTabelSkors,
    pastikanTabelBerjalan,
  };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL,
  TABEL_SKORS,
  TABEL_BERJALAN,
  ANTRIAN_MENUNGGU,
  ANTRIAN_SKORS,
  ANTRIAN_SELESAI,
  DISIDANG_DIPANGGIL,
  buatLayanan,
  nilaiDisidangSelesai,
  nilaiDisidangProses,
  waktuDariJamSidang,
  kunciSelesai,
  petaSelesai: (isi) => layananBawaan().petaSelesai(isi),
  setelSelesai: (isi) => layananBawaan().setelSelesai(isi),
  setelSkors: (isi) => layananBawaan().setelSkors(isi),
  setelBerjalan: (isi) => layananBawaan().setelBerjalan(isi),
  diagnosaRuangTunggu: () => layananBawaan().diagnosaRuangTunggu(),
};
