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

/** Keadaan antrian SIPP menurut manageAntrian.php - sama dengan sidangHasilService. */
const ANTRIAN_MENUNGGU = 0;
const ANTRIAN_SELESAI = 2;

/** Nilai "dipanggil" mesin antrian ruang tunggu - sama dengan panggilanAntrianService. */
const DISIDANG_DIPANGGIL = 10;

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

    return { ok: true, dari: awal, sampai: akhir, peta, sumber };
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
      return {
        ok: true,
        disetel: disidangSelesai,
        nilai: (Array.isArray(baris) ? baris : []).map((b) => ({
          disidang: b.disidang === null || b.disidang === undefined ? null : Number(b.disidang),
          jumlah: Number(b.jumlah) || 0,
        })),
      };
    } catch (galat) {
      return { ok: false, disetel: disidangSelesai, alasan: sebutGalat(galat), nilai: [] };
    }
  }

  return { petaSelesai, setelSelesai, diagnosaRuangTunggu, pastikanTabel };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL,
  ANTRIAN_MENUNGGU,
  ANTRIAN_SELESAI,
  DISIDANG_DIPANGGIL,
  buatLayanan,
  nilaiDisidangSelesai,
  kunciSelesai,
  petaSelesai: (isi) => layananBawaan().petaSelesai(isi),
  setelSelesai: (isi) => layananBawaan().setelSelesai(isi),
  diagnosaRuangTunggu: () => layananBawaan().diagnosaRuangTunggu(),
};
