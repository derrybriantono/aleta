"use strict";

/**
 * ============================================================================
 * JADWAL MEDIASI: "SEDANG BERJALAN" DAN "SELESAI" - BUTIR 35 (5 OKT 2026)
 * ============================================================================
 *
 * Diminta pengguna: status mediasi "sedang berjalan" dan "selesai" seperti di
 * Jadwal Sidang - tombol Tandai berjalan / Selesai, lencana, bingkai baris -
 * dan datanya DISIMPAN di basis data ALETA.
 *
 * Polanya sama dengan aleta_bot_sidang_berjalan (sidangSelesaiService): tabel
 * dibuat sendiri oleh layanan ini (CREATE TABLE IF NOT EXISTS), BUKAN migrasi
 * Drizzle portal. Satu baris per penandaan; membatalkan hanya mengisi
 * dibatalkan_pada - riwayatnya tidak pernah dihapus atau ditimpa (siapa,
 * kapan, alamat IP, lewat ALETA).
 *
 * ============================================================================
 * "SELESAI" DI SINI BUKAN "SELESAI" SIPP
 * ============================================================================
 *
 * SIPP sudah punya kata "selesai" untuk mediasi: laporan mediator sudah masuk
 * (perkara_mediasi.tgl_laporan_mediator) - PROSES mediasinya tuntas. Yang
 * ditandai di sini adalah PERTEMUAN mediasi pada satu tanggal: hari ini
 * mediatornya sudah selesai bertemu para pihak. Keduanya tidak boleh
 * tercampur: tanda di sini tidak pernah menulis ke SIPP, dan layar menyebutnya
 * "pertemuan selesai", bukan "mediasi selesai".
 *
 * ============================================================================
 * ATURANNYA
 * ============================================================================
 *
 *   tandai berjalan   ditolak bila pertemuannya sudah ditandai selesai
 *                     (batalkan selesai lebih dulu); berulang = tidak menambah
 *                     baris.
 *   tandai selesai    menutup tanda berjalan yang masih berlaku (alasan
 *                     "menjadi_selesai") lalu mencatat selesai.
 *   batalkan          hanya mengisi dibatalkan_pada pada tanda yang berlaku.
 *
 * Kering (tidak menulis apa pun) kecuali `kering: false` disebut tegas - sama
 * dengan Selesai/Skors/Berjalan Jadwal Sidang.
 */

const TABEL = "aleta_bot_mediasi_status";
const KEADAAN = ["berjalan", "selesai"];

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

/** Kunci peta - SAMA dengan kunci baris di layar Jadwal Mediasi (`mediasiId|tanggal`). */
function kunciMediasi(mediasiId, tanggal) {
  return `${bersih(mediasiId)}|${tanggalSah(tanggal)}`;
}

function buatLayanan(deps = {}) {
  const kueriBot = deps.kueriBot || ((sql, params = []) => require("./botDbService").query(sql, params));

  let tabelSiap = false;
  async function pastikanTabel() {
    if (tabelSiap) return;
    await kueriBot(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        mediasi_id VARCHAR(32) NOT NULL,
        perkara_id VARCHAR(32) NOT NULL DEFAULT '',
        tanggal_mediasi DATE NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        tempat VARCHAR(128) NOT NULL DEFAULT '',
        keadaan VARCHAR(16) NOT NULL,
        oleh VARCHAR(191) NOT NULL DEFAULT '',
        ip VARCHAR(45) NOT NULL DEFAULT '',
        lewat VARCHAR(32) NOT NULL DEFAULT 'ALETA',
        ditandai_pada DATETIME NOT NULL,
        dibatalkan_pada DATETIME NULL,
        dibatalkan_oleh VARCHAR(191) NOT NULL DEFAULT '',
        dibatalkan_ip VARCHAR(45) NOT NULL DEFAULT '',
        alasan_batal VARCHAR(64) NOT NULL DEFAULT '',
        PRIMARY KEY (id),
        INDEX idx_mediasi_status_kunci (mediasi_id, tanggal_mediasi),
        INDEX idx_mediasi_status_tanggal (tanggal_mediasi)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
  }

  /** Peta tanda yang BERLAKU untuk satu rentang tanggal: kunci -> { keadaan, sejak, oleh }. */
  async function petaStatus({ dari, sampai } = {}) {
    const awal = tanggalSah(dari);
    const akhir = tanggalSah(sampai) || awal;
    if (!awal) return { ok: false, alasan: "tanggal_tidak_sah", peta: {} };
    try {
      await pastikanTabel();
      const baris = await kueriBot(
        `SELECT mediasi_id AS mediasiId, perkara_id AS perkaraId,
                DATE_FORMAT(tanggal_mediasi, '%Y-%m-%d') AS tanggal, keadaan, oleh, tempat,
                DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS sejak
           FROM ${TABEL}
          WHERE tanggal_mediasi BETWEEN ? AND ? AND dibatalkan_pada IS NULL
          ORDER BY id ASC`,
        [awal, akhir]
      );
      const peta = {};
      for (const b of Array.isArray(baris) ? baris : []) {
        if (!KEADAAN.includes(bersih(b.keadaan))) continue;
        const kunci = kunciMediasi(b.mediasiId, b.tanggal);
        const lama = peta[kunci];
        // "selesai" menang atas "berjalan" - urutan id menjamin yang terakhir
        // ditulis yang berlaku, tetapi tanda selesai tidak boleh dikalahkan
        // tanda berjalan yang lupa ditutup.
        if (lama && lama.keadaan === "selesai" && b.keadaan !== "selesai") continue;
        peta[kunci] = {
          mediasiId: bersih(b.mediasiId),
          perkaraId: bersih(b.perkaraId),
          tanggal: bersih(b.tanggal),
          keadaan: bersih(b.keadaan),
          sejak: bersih(b.sejak),
          oleh: bersih(b.oleh),
          tempat: bersih(b.tempat),
        };
      }
      return { ok: true, dari: awal, sampai: akhir, peta };
    } catch (galat) {
      return { ok: false, alasan: `Catatan status mediasi ALETA tidak terbaca: ${sebutGalat(galat)}`, peta: {} };
    }
  }

  async function tandaBerlaku(mediasiId, tanggal) {
    const baris = await kueriBot(
      `SELECT id, keadaan FROM ${TABEL}
        WHERE mediasi_id = ? AND tanggal_mediasi = ? AND dibatalkan_pada IS NULL`,
      [mediasiId, tanggal]
    );
    return Array.isArray(baris) ? baris : [];
  }

  async function tutup(mediasiId, tanggal, keadaan, { oleh, ip, alasan }) {
    await kueriBot(
      `UPDATE ${TABEL}
          SET dibatalkan_pada = NOW(), dibatalkan_oleh = ?, dibatalkan_ip = ?, alasan_batal = ?
        WHERE mediasi_id = ? AND tanggal_mediasi = ? AND keadaan = ? AND dibatalkan_pada IS NULL`,
      [bersih(oleh).slice(0, 191), bersih(ip).slice(0, 45), bersih(alasan).slice(0, 64), mediasiId, tanggal, keadaan]
    );
  }

  /**
   * Menandai / membatalkan tanda.
   *   keadaan: "berjalan" | "selesai"
   *   batal:   true = batalkan tanda keadaan itu
   */
  async function setelStatus({
    mediasiId,
    perkaraId = "",
    tanggal,
    nomorPerkara = "",
    tempat = "",
    keadaan,
    batal = false,
    oleh = "",
    ip = "",
    kering = true,
  } = {}) {
    const id = bersih(mediasiId);
    const tgl = tanggalSah(tanggal);
    const jenis = bersih(keadaan);
    if (!/^\d{1,20}$/.test(id)) return { ok: false, alasan: "mediasi_tidak_sah" };
    if (!tgl) return { ok: false, alasan: "tanggal_tidak_sah" };
    if (!KEADAAN.includes(jenis)) return { ok: false, alasan: "keadaan_tidak_sah" };
    const perkara = bersih(perkaraId);
    if (perkara && !/^\d{1,20}$/.test(perkara)) return { ok: false, alasan: "perkara_tidak_sah" };

    let berlaku;
    try {
      await pastikanTabel();
      berlaku = await tandaBerlaku(id, tgl);
    } catch (galat) {
      return { ok: false, alasan: `Catatan status mediasi ALETA tidak terbaca: ${sebutGalat(galat)}` };
    }
    const sudahSelesai = berlaku.some((b) => b.keadaan === "selesai");
    const sudahBerjalan = berlaku.some((b) => b.keadaan === "berjalan");

    if (!batal && jenis === "berjalan" && sudahSelesai) {
      return {
        ok: false,
        alasan: "sudah_selesai",
        pesan: "Pertemuan mediasi ini sudah ditandai selesai. Batalkan tanda selesai lebih dulu bila memang masih berjalan.",
      };
    }

    const rencana = {
      mediasiId: id,
      tanggal: tgl,
      keadaan: jenis,
      batal: batal === true,
      aleta: batal
        ? `batalkan tanda ${jenis} (riwayat tidak dihapus)`
        : jenis === "selesai"
          ? "catat pertemuan selesai; tanda berjalan yang masih berlaku ditutup"
          : "catat sedang berjalan",
      sipp: "tidak disentuh (laporan mediator tetap diisi di SIPP)",
    };
    if (kering !== false) return { ok: true, kering: true, rencana };

    try {
      if (batal) {
        if (!berlaku.some((b) => b.keadaan === jenis)) {
          return { ok: true, berubah: false, rencana, pesan: "Tidak ada tanda yang berlaku untuk dibatalkan." };
        }
        await tutup(id, tgl, jenis, { oleh, ip, alasan: "dibatalkan" });
        return { ok: true, berubah: true, rencana };
      }
      if ((jenis === "berjalan" && sudahBerjalan) || (jenis === "selesai" && sudahSelesai)) {
        return { ok: true, berubah: false, rencana };
      }
      if (jenis === "selesai" && sudahBerjalan) {
        await tutup(id, tgl, "berjalan", { oleh, ip, alasan: "menjadi_selesai" });
      }
      await kueriBot(
        `INSERT INTO ${TABEL}
           (mediasi_id, perkara_id, tanggal_mediasi, nomor_perkara, tempat, keadaan, oleh, ip, lewat, ditandai_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ALETA', NOW())`,
        [
          id,
          perkara,
          tgl,
          bersih(nomorPerkara).slice(0, 191),
          bersih(tempat).slice(0, 128),
          jenis,
          bersih(oleh).slice(0, 191),
          bersih(ip).slice(0, 45),
        ]
      );
      return { ok: true, berubah: true, rencana };
    } catch (galat) {
      return { ok: false, alasan: `Catatan status mediasi ALETA tidak tersimpan: ${sebutGalat(galat)}`, rencana };
    }
  }

  return { petaStatus, setelStatus, pastikanTabel };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL,
  KEADAAN,
  buatLayanan,
  kunciMediasi,
  petaStatus: (opsi) => layananBawaan().petaStatus(opsi),
  setelStatus: (opsi) => layananBawaan().setelStatus(opsi),
};
