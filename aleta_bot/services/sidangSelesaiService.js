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
 * MESIN ANTRIAN RUANG TUNGGU - ARTINYA SUDAH TERBACA DARI KODENYA (5 OKT 2026)
 * ============================================================================
 *
 * Aplikasi antrian ruang tunggu satker (sipp_turunan_antrian.antrian_sidang):
 * disidang NULL = menunggu, nomor ruang 1..9 = SEDANG disidang di ruang itu,
 * 10 = SELESAI (tunda/putus/ikrar/Selesai Sidang) - dibaca dari
 * /var/www/html/antrian/php/_fungsi.php di server dan dicocokkan dengan data
 * hidupnya; lihat antrianDisidang.js.
 *
 * Sampai 1.183.0 berkas ini menganggap 10 = "dipanggil" dan karena itu
 * mematikan jalur selesai sampai ALETA_ANTRIAN_DISIDANG_SELESAI disetel. Kini
 * 10 adalah nilai selesai BAWAAN; lingkungan tetap dapat menimpanya, atau
 * mematikannya dengan "mati". GET /diagnosa tetap menyebut nilai yang hidup.
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
 * Mesin antrian ruang tunggu: skors = BATAL / SKORS SIDANG aplikasi antrian -
 * baris yang sedang disidang (disidang = ruang) kembali NULL (menunggu). Lihat
 * setelSkors.
 */
const TABEL_SKORS = "aleta_bot_sidang_skors";

/** Keadaan antrian SIPP menurut manageAntrian.php - sama dengan sidangHasilService. */
const ANTRIAN_MENUNGGU = 0;
const ANTRIAN_SKORS = 1;
const ANTRIAN_SELESAI = 2;

const { DISIDANG_SELESAI, segarkanLayar } = require("./antrianDisidang");

/** Kata yang mematikan jalur mesin ruang tunggu lewat lingkungan. */
const KATA_MATI = new Set(["mati", "off", "0", "tidak", "false", "no"]);

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
 *   2. "PROSES SIDANG" DI MESIN ANTRIAN RUANG TUNGGU - disidang = nomor ruang
 *      (ruangan_id). Sejak 5 Okt 2026 ini BAWAAN: kodenya sudah dibaca dari
 *      aplikasi antrian satker sendiri (_fungsi.php:934 tombol PROSES menulis
 *      disidang = ruang + jam_sidang = now(); BATAL / SKORS SIDANG menulis
 *      NULL; SELESAI SIDANG menulis 10) dan dicocokkan dengan data hidupnya.
 *      Lingkungan masih dapat menimpanya:
 *
 *        ALETA_ANTRIAN_DISIDANG_PROSES kosong / ruang   disidang = nomor ruang (bawaan)
 *        ALETA_ANTRIAN_DISIDANG_PROSES=<angka>          kode tetap (bukan 10, bukan nilai selesai)
 *        ALETA_ANTRIAN_DISIDANG_PROSES=mati             mesin tidak dibaca, tidak ditulis
 *
 *      Yang ditulis ke mesin hanya nilai asli aplikasi itu (nomor ruang atau
 *      NULL) - tanpa penanda ALETA di kolom mana pun (butir 14, 2 Okt).
 */
const TABEL_BERJALAN = "aleta_bot_sidang_berjalan";

/**
 * Nilai "proses sidang" mesin ruang tunggu.
 * Hasil: null (mati) | { mode: "ruang" } | { mode: "nilai", nilai }.
 * Bawaan (kosong / tak dikenal) = "ruang" - arti aplikasi antrian satker.
 * 10 tidak pernah boleh menjadi "proses": itu nilai SELESAI - jatuh ke bawaan.
 */
function nilaiDisidangProses(mentah = process.env.ALETA_ANTRIAN_DISIDANG_PROSES) {
  const teks = bersih(mentah).toLowerCase();
  if (KATA_MATI.has(teks)) return null;
  if (/^\d{1,4}$/.test(teks) && Number(teks) !== DISIDANG_SELESAI) return { mode: "nilai", nilai: Number(teks) };
  return { mode: "ruang" };
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
 * Nilai disidang "selesai" mesin antrian ruang tunggu.
 * Bawaan (kosong / tak dikenal) = 10, arti aplikasi antrian satker. Angka lain
 * dari lingkungan menimpanya, KECUALI nomor ruang 1..9 (itu "sedang disidang",
 * tidak mungkin "selesai") yang jatuh ke bawaan. "mati" = jalur mati.
 */
function nilaiDisidangSelesai(mentah = process.env.ALETA_ANTRIAN_DISIDANG_SELESAI) {
  const teks = bersih(mentah).toLowerCase();
  if (KATA_MATI.has(teks)) return null;
  if (/^\d{1,4}$/.test(teks)) {
    const angka = Number(teks);
    return angka >= 1 && angka <= 9 ? DISIDANG_SELESAI : angka;
  }
  return DISIDANG_SELESAI;
}

function kunciSelesai(perkaraId, tanggalSidang) {
  return `${bersih(perkaraId)}|${tanggalSah(tanggalSidang)}`;
}

/* === F3.1 (17 Okt 2026): status skors utuh === */
/**
 * Kode alasan skors baku - sama dengan ALASAN_SKORS di portal
 * (src/lib/skors-sidang.ts). Kode lain dibuang (jadi kosong), bukan disimpan.
 */
const KODE_ALASAN_SKORS = new Set(["pihak", "saksi", "kuasa", "istirahat", "musyawarah", "berkas", "lainnya"]);

function kodeAlasanSkors(nilai) {
  const kode = bersih(nilai).toLowerCase();
  return KODE_ALASAN_SKORS.has(kode) ? kode : "";
}

/**
 * Perkiraan sidang dilanjutkan -> "YYYY-MM-DD HH:MM:00" atau null.
 * Menerima "HH:MM"/"HH.MM" (dianggap pada tanggal sidang) atau waktu penuh.
 */
function perkiraanLanjutSah(nilai, tanggalSidang) {
  const teks = bersih(nilai);
  if (!teks) return null;
  const penuh = /^(\d{4}-\d{2}-\d{2})[ T](\d{2})[:.](\d{2})/.exec(teks);
  const saja = /^(\d{1,2})[:.](\d{2})$/.exec(teks);
  const tanggal = penuh ? penuh[1] : tanggalSah(tanggalSidang);
  const jam = penuh ? Number(penuh[2]) : saja ? Number(saja[1]) : NaN;
  const menit = penuh ? Number(penuh[3]) : saja ? Number(saja[2]) : NaN;
  if (!tanggal || !(jam >= 0 && jam <= 23) || !(menit >= 0 && menit <= 59)) return null;
  return `${tanggal} ${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}:00`;
}

/** "YYYY-MM-DD HH:MM:SS" sah? - penanda mulai sidang yang dapat dibandingkan. */
function waktuPenuhSah(nilai) {
  const teks = bersih(nilai);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(teks) ? (teks.length === 16 ? `${teks}:00` : teks) : "";
}
/* === AKHIR F3.1 === */

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
                DATE_FORMAT(diskors_pada, '%Y-%m-%d %H:%i:%s') AS diskorsPada,
                alasan_kode AS alasanKode, DATE_FORMAT(perkiraan_lanjut, '%Y-%m-%d %H:%i:%s') AS perkiraanLanjut
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
          alasanKode: kodeAlasanSkors(b.alasanKode),
          perkiraanLanjut: bersih(b.perkiraanLanjut),
        };
      }
      sumber.skors.terbaca = true;
    } catch (galat) {
      sumber.skors.alasan = sebutGalat(galat);
    }

    /* === 12OKT-L: riwayat skors (penanda "pernah diskors") === */
    // Tabel skors tidak pernah menghapus: tiap skors tetap sebagai satu baris
    // (diberi dilanjutkan_pada saat dilanjutkan), jadi riwayatnya bertahan lintas
    // hari. Dibaca per perkara untuk jendela 400 hari sampai akhir rentang.
    let riwayatSkors = {};
    sumber.riwayatSkors = { terbaca: false, alasan: "" };
    try {
      riwayatSkors = await bacaRiwayatSkors(awal, akhir);
      sumber.riwayatSkors.terbaca = true;
    } catch (galat) {
      sumber.riwayatSkors.alasan = sebutGalat(galat);
    }
    /* === AKHIR 12OKT-L === */

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

    return { ok: true, dari: awal, sampai: akhir, peta, skors, riwayatSkors, berjalan, sumber };
  }

  /* === 12OKT-L: riwayat skors === */
  const JENDELA_RIWAYAT_SKORS_HARI = 400;
  const BATAS_RIWAYAT_SKORS_PER_PERKARA = 5;
  /**
   * Semua skors (yang masih berlaku DAN yang sudah dilanjutkan) per perkara,
   * dari tanggal sidang paling awal ke paling akhir, sampai `akhir`.
   * { [perkaraId]: [{ tanggalSidang, diskorsPada, dilanjutkanPada, alasan, oleh }] }
   * Hanya membaca tabel ALETA sendiri.
   */
  async function bacaRiwayatSkors(awal, akhir) {
    await pastikanTabelSkors();
    const baris = await kueriBot(
      `SELECT perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
              alasan, oleh, DATE_FORMAT(diskors_pada, '%Y-%m-%d %H:%i:%s') AS diskorsPada,
              DATE_FORMAT(dilanjutkan_pada, '%Y-%m-%d %H:%i:%s') AS dilanjutkanPada,
              alasan_kode AS alasanKode, DATE_FORMAT(perkiraan_lanjut, '%Y-%m-%d %H:%i:%s') AS perkiraanLanjut,
              lama_detik AS lamaDetik
         FROM ${TABEL_SKORS}
        WHERE tanggal_sidang BETWEEN DATE_SUB(?, INTERVAL ${JENDELA_RIWAYAT_SKORS_HARI} DAY) AND ?
        ORDER BY id DESC LIMIT 3000`,
      [awal, akhir]
    );
    const hasil = {};
    for (const b of Array.isArray(baris) ? baris : []) {
      const id = bersih(b.perkaraId);
      const tanggal = tanggalSah(b.tanggalSidang);
      if (!id || !tanggal) continue;
      const daftar = hasil[id] || (hasil[id] = []);
      if (daftar.length >= BATAS_RIWAYAT_SKORS_PER_PERKARA) continue;
      daftar.push({
        tanggalSidang: tanggal,
        diskorsPada: bersih(b.diskorsPada),
        dilanjutkanPada: bersih(b.dilanjutkanPada),
        alasan: bersih(b.alasan),
        oleh: bersih(b.oleh),
        alasanKode: kodeAlasanSkors(b.alasanKode),
        perkiraanLanjut: bersih(b.perkiraanLanjut),
        lamaDetik: angkaAtauNull(b.lamaDetik),
      });
    }
    // Urut dari yang terlama ke yang terbaru (pembacaan tadi terbaru dulu).
    for (const id of Object.keys(hasil)) hasil[id].reverse();
    return hasil;
  }
  /* === AKHIR 12OKT-L === */

  /* === F3.1: daftar skors per tanggal (dan perkara) - hanya membaca tabel ALETA === */
  function angkaAtauNull(nilai) {
    if (nilai === null || nilai === undefined || nilai === "") return null;
    const n = Number(nilai);
    return Number.isFinite(n) ? n : null;
  }
  /**
   * Semua skors pada rentang tanggal sidang (paling banyak 31 hari), boleh
   * dipersempit ke satu perkara - yang masih berlaku DAN yang sudah dilanjutkan,
   * terlama dulu. Bahan layar antrian, widget ekstensi, dan usulan kalimat BAS.
   * Tidak menyentuh SIPP maupun mesin antrian.
   */
  async function daftarSkors({ dari, sampai, perkaraId = "" } = {}) {
    const awal = tanggalSah(dari);
    const akhir = tanggalSah(sampai) || awal;
    if (!awal || !akhir || akhir < awal) return { ok: false, alasan: "rentang_tidak_sah", skors: [] };
    const selisihHari = (Date.parse(`${akhir}T00:00:00Z`) - Date.parse(`${awal}T00:00:00Z`)) / 86400000;
    if (selisihHari > 31) return { ok: false, alasan: "rentang_terlalu_panjang", skors: [] };
    const id = bersih(perkaraId);
    if (id && !/^\d{1,20}$/.test(id)) return { ok: false, alasan: "perkara_tidak_sah", skors: [] };
    await pastikanTabelSkors();
    const baris = await kueriBot(
      `SELECT id, perkara_id AS perkaraId, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
              nomor_perkara AS nomorPerkara, alasan, alasan_kode AS alasanKode, oleh,
              panggil_saat_skors AS panggilSaatSkors,
              DATE_FORMAT(diskors_pada, '%Y-%m-%d %H:%i:%s') AS diskorsPada,
              DATE_FORMAT(perkiraan_lanjut, '%Y-%m-%d %H:%i:%s') AS perkiraanLanjut,
              DATE_FORMAT(dilanjutkan_pada, '%Y-%m-%d %H:%i:%s') AS dilanjutkanPada,
              dilanjutkan_oleh AS dilanjutkanOleh, lama_detik AS lamaDetik
         FROM ${TABEL_SKORS}
        WHERE tanggal_sidang BETWEEN ? AND ?${id ? " AND perkara_id = ?" : ""}
        ORDER BY diskors_pada ASC, id ASC LIMIT 2000`,
      id ? [awal, akhir, id] : [awal, akhir]
    );
    const skors = [];
    for (const b of Array.isArray(baris) ? baris : []) {
      if (!bersih(b.perkaraId) || !tanggalSah(b.tanggalSidang)) continue;
      skors.push({
        perkaraId: bersih(b.perkaraId),
        tanggalSidang: tanggalSah(b.tanggalSidang),
        nomorPerkara: bersih(b.nomorPerkara),
        alasan: bersih(b.alasan),
        alasanKode: kodeAlasanSkors(b.alasanKode),
        oleh: bersih(b.oleh),
        panggilSaatSkors: bersih(b.panggilSaatSkors),
        diskorsPada: bersih(b.diskorsPada),
        perkiraanLanjut: bersih(b.perkiraanLanjut),
        dilanjutkanPada: bersih(b.dilanjutkanPada),
        dilanjutkanOleh: bersih(b.dilanjutkanOleh),
        lamaDetik: angkaAtauNull(b.lamaDetik),
      });
    }
    return { ok: true, dari: awal, sampai: akhir, skors };
  }
  /* === AKHIR F3.1 === */

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
            if (mesinDitulis) await segarkanLayar(kueriRuangTunggu);
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
          if (antrianRuangTunggu.baris > 0) await segarkanLayar(kueriRuangTunggu);
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
        alasan_kode VARCHAR(32) NOT NULL DEFAULT '',
        perkiraan_lanjut DATETIME NULL,
        lama_detik INT NULL,
        PRIMARY KEY (id),
        INDEX idx_sidang_skors_perkara (perkara_id, tanggal_sidang),
        INDEX idx_sidang_skors_tanggal (tanggal_sidang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // F3.1: tabel yang SUDAH ada di server tidak disentuh CREATE TABLE IF NOT
    // EXISTS - kolom barunya ditambahkan di sini (MariaDB 5.5: tanpa
    // "ADD COLUMN IF NOT EXISTS", jadi diperiksa dulu lewat information_schema).
    const kolomBaru = [
      ["alasan_kode", "VARCHAR(32) NOT NULL DEFAULT ''"],
      ["perkiraan_lanjut", "DATETIME NULL"],
      ["lama_detik", "INT NULL"],
    ];
    let ada = null;
    try {
      const baris = await kueriBot(
        `SELECT COLUMN_NAME AS nama FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [TABEL_SKORS]
      );
      if (Array.isArray(baris) && baris.length > 0) ada = new Set(baris.map((b) => bersih(b.nama).toLowerCase()));
    } catch {
      ada = null; // information_schema tak terbaca: jangan menebak, jangan ALTER.
    }
    if (ada) {
      const kurang = kolomBaru.filter(([nama]) => !ada.has(nama));
      if (kurang.length > 0) {
        await kueriBot(`ALTER TABLE ${TABEL_SKORS} ${kurang.map(([nama, bentuk]) => `ADD COLUMN ${nama} ${bentuk}`).join(", ")}`);
      }
    }
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
    alasanKode = "",
    perkiraanLanjut = "",
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
    // F3.1: alasan baku + perkiraan lanjut. Hanya di tabel ALETA - tidak ke SIPP.
    const kodeAlasan = kodeAlasanSkors(alasanKode);
    const perkiraan = perkiraanLanjutSah(perkiraanLanjut, tanggal);

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
        // F3.1: skors lama yang sidangnya SUDAH dimulai lagi lewat aplikasi
        // antrian (tanpa Lanjutkan) ditutup pada saat sidang itu mulai lagi -
        // penanda mulai sidang yang sekarang diskors (panggilSaatSkors) lebih
        // baru daripada saat skors lama. Tanpa ini skors kedua pada hari yang
        // sama tidak pernah tercatat, dan riwayat BAS kehilangan satu skors.
        const mulaiLagi = waktuPenuhSah(panggilSaatSkors);
        if (mulaiLagi) {
          await kueriBot(
            `UPDATE ${TABEL_SKORS} SET dilanjutkan_pada = ?, dilanjutkan_oleh = '(dipanggil lagi lewat antrian)',
                    lama_detik = TIMESTAMPDIFF(SECOND, diskors_pada, ?)
              WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL AND diskors_pada < ?`,
            [mulaiLagi, mulaiLagi, id, tanggal, mulaiLagi]
          );
        }
        const aktif = await kueriBot(
          `SELECT id FROM ${TABEL_SKORS} WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL LIMIT 1`,
          [id, tanggal]
        );
        if (!(Array.isArray(aktif) && aktif.length > 0)) {
          await kueriBot(
            `INSERT INTO ${TABEL_SKORS}
               (perkara_id, tanggal_sidang, nomor_perkara, alasan, panggil_saat_skors, oleh, ip, lewat, diskors_pada, alasan_kode, perkiraan_lanjut)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ALETA', NOW(), ?, ?)`,
            [
              id,
              tanggal,
              bersih(nomorPerkara).slice(0, 191),
              bersih(alasan).slice(0, 191),
              bersih(panggilSaatSkors).slice(0, 32),
              bersih(oleh).slice(0, 191),
              bersih(ip).slice(0, 45),
              kodeAlasan,
              perkiraan,
            ]
          );
        } else if (kodeAlasan || bersih(alasan) || perkiraan) {
          // Sudah diskors: alasan / perkiraan boleh diperbarui (mis. perkiraan
          // diundur). Yang tidak disebut tidak dikosongkan.
          const ubah = [];
          const nilai = [];
          if (kodeAlasan || bersih(alasan)) {
            ubah.push("alasan_kode = ?", "alasan = ?");
            nilai.push(kodeAlasan, bersih(alasan).slice(0, 191));
          }
          if (perkiraan) {
            ubah.push("perkiraan_lanjut = ?");
            nilai.push(perkiraan);
          }
          await kueriBot(
            `UPDATE ${TABEL_SKORS} SET ${ubah.join(", ")}
              WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NULL`,
            [...nilai, id, tanggal]
          );
        }
      } else {
        await kueriBot(
          `UPDATE ${TABEL_SKORS} SET dilanjutkan_pada = NOW(), dilanjutkan_oleh = ?, dilanjutkan_ip = ?,
                  lama_detik = TIMESTAMPDIFF(SECOND, diskors_pada, NOW())
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
        if (antrianRuangTunggu.baris > 0) await segarkanLayar(kueriRuangTunggu);
      } catch (galat) {
        antrianRuangTunggu = { ok: false, alasan: sebutGalat(galat) };
      }
    }

    // F3.1: lama skors yang baru dilanjutkan - untuk pesan "lama skors 17 menit".
    let lamaDetik = null;
    if (!menskors) {
      try {
        const baris = await kueriBot(
          `SELECT lama_detik AS lamaDetik FROM ${TABEL_SKORS}
            WHERE perkara_id = ? AND tanggal_sidang = ? AND dilanjutkan_pada IS NOT NULL
            ORDER BY dilanjutkan_pada DESC, id DESC LIMIT 1`,
          [id, tanggal]
        );
        const n = Array.isArray(baris) && baris[0] ? Number(baris[0].lamaDetik) : NaN;
        lamaDetik = Number.isFinite(n) && n >= 0 ? n : null;
      } catch {
        lamaDetik = null;
      }
    }

    return { ok: true, kering: false, rencana, skors: menskors, lamaDetik, antrianSipp, antrianRuangTunggu };
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
            : `disidang = NULL / menunggu lagi (hanya baris yang sedang ${disidangSelesai})`,
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
          : // Membatalkan Selesai = kembali MENUNGGU (NULL), seperti BATAL di
            // aplikasi antrian. Sampai 1.183.0 ditulis 10 ("dipanggil") - yang
            // justru nilai selesai itu sendiri.
            await kueriRuangTunggu(
              `UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = NULL
                WHERE perkara_id = ? AND tanggal_sidang = ? AND disidang = ?`,
              [id, tanggal, disidangSelesai]
            );
        antrianRuangTunggu = { ok: true, baris: Number((hasil && hasil.affectedRows) || 0) };
        if (antrianRuangTunggu.baris > 0) await segarkanLayar(kueriRuangTunggu);
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
            "Aplikasi antrian satker (php/menu.sidang.php dan _fungsi.php): disidang NULL = menunggu, nomor ruang (1-9, = ruangan_id) = sedang disidang di ruang itu, 10 = selesai (tunda/putus/ikrar/Selesai Sidang). Arti ini BAWAAN ALETA sejak 5 Okt 2026; ALETA_ANTRIAN_DISIDANG_PROSES / ALETA_ANTRIAN_DISIDANG_SELESAI hanya untuk menimpanya ('mati' mematikan).",
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
    daftarSkors,
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
  DISIDANG_SELESAI,
  buatLayanan,
  nilaiDisidangSelesai,
  nilaiDisidangProses,
  waktuDariJamSidang,
  kunciSelesai,
  petaSelesai: (isi) => layananBawaan().petaSelesai(isi),
  setelSelesai: (isi) => layananBawaan().setelSelesai(isi),
  setelSkors: (isi) => layananBawaan().setelSkors(isi),
  daftarSkors: (isi) => layananBawaan().daftarSkors(isi),
  kodeAlasanSkors,
  perkiraanLanjutSah,
  setelBerjalan: (isi) => layananBawaan().setelBerjalan(isi),
  diagnosaRuangTunggu: () => layananBawaan().diagnosaRuangTunggu(),
};
