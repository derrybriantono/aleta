"use strict";

/**
 * Menelusuri sys_audittrail untuk mencari kapan sesuatu diinput.
 *
 * ============================================================================
 * JALAN TERAKHIR, BUKAN JALAN PERTAMA
 * ============================================================================
 *
 * Sebagian keterangan yang dinilai SK tidak punya kolom tanggal inputnya
 * sendiri. Untuk itulah jejak audit ada: SIPP mencatat tiap perubahan beserta
 * waktunya, siapa pelakunya, dan baris mana yang disentuh.
 *
 * Tetapi jejak audit BUKAN sumber utama. Ia dipakai hanya bila kolom yang
 * seharusnya memang tidak ada, karena:
 *
 *   - tabelnya besar sekali dan dibaca per perkara akan lambat
 *   - isinya dapat dipangkas pengelola tanpa mengubah data perkaranya
 *   - satu baris dapat disentuh berkali-kali, dan yang mana yang "input"
 *     harus ditafsirkan
 *
 * Karena itu tiap hasil dari sini membawa penanda bahwa ia berasal dari jejak
 * audit - dan layar menyebutkannya. Angka yang sumbernya berbeda tidak boleh
 * tampak sama dengan angka yang sumbernya kolom resmi.
 *
 * ============================================================================
 * BENTUK TABELNYA DIKENALI, BUKAN DITEBAK
 * ============================================================================
 *
 * Nama kolom sys_audittrail berbeda antar versi SIPP. Sama seperti tabel lain,
 * yang dipakai hanya nama yang benar-benar ada - dicari dari daftar calon di
 * dalam kode.
 *
 * SIPP HANYA DIBACA.
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");

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

/** Berapa baris jejak audit yang boleh dibaca sekali panggil. */
const BATAS_BARIS = 200;

let bentukTersimpan = null;

/**
 * Kolom mana pada sys_audittrail yang berperan apa.
 *
 * Dibaca sekali lalu disimpan - skema tidak berubah saat aplikasi berjalan.
 */
async function bentukAudit() {
  if (bentukTersimpan) return bentukTersimpan;

  const ada = await sippSkemaService.tabelAda("sys_audittrail");
  if (!ada) {
    bentukTersimpan = { terbaca: false, alasan: "Tabel sys_audittrail tidak ada pada SIPP versi ini." };
    return bentukTersimpan;
  }

  const pilih = (calon) => sippSkemaService.pilihKolom("sys_audittrail", calon);

  const [waktu, tabel, baris, aksi, pelaku, perkara] = await Promise.all([
    pilih(["waktu", "created_date", "tanggal", "diinput_tanggal", "log_date", "timestamp"]),
    pilih(["tabel", "table_name", "nama_tabel", "modul", "module"]),
    pilih(["record_id", "row_id", "id_record", "primary_key", "data_id"]),
    pilih(["aksi", "action", "jenis_aksi", "event"]),
    pilih(["user_id", "username", "user", "diinput_oleh", "pelaku"]),
    pilih(["perkara_id"]),
  ]);

  // Tanpa waktu, jejak audit tidak menjawab pertanyaan apa pun yang kita punya.
  if (!waktu) {
    bentukTersimpan = {
      terbaca: false,
      alasan: "Kolom waktu pada sys_audittrail tidak dikenali.",
      kolomTersedia: await sippSkemaService.kolomTabel("sys_audittrail"),
    };
    return bentukTersimpan;
  }

  bentukTersimpan = { terbaca: true, alasan: "", waktu, tabel, baris, aksi, pelaku, perkara };
  return bentukTersimpan;
}

/** Membuang ingatan bentuk - dipakai uji. */
function lupakan() {
  bentukTersimpan = null;
}

/**
 * Kapan suatu baris pertama kali dicatat pada jejak audit.
 *
 * @param {{ tabel?: string, recordId?: string|number, perkaraId?: string|number }} cari
 * @returns {Promise<{ terbaca: boolean, alasan: string, tanggal: string, oleh: string, dariAudit: boolean }>}
 */
async function pertamaDicatat({ tabel = "", recordId = null, perkaraId = null } = {}) {
  const bentuk = await bentukAudit();
  if (!bentuk.terbaca) {
    return { terbaca: false, alasan: bentuk.alasan, tanggal: "", oleh: "", dariAudit: true };
  }

  const syarat = [];
  const nilai = [];

  if (tabel && bentuk.tabel) {
    syarat.push(`a.${bentuk.tabel} = ?`);
    nilai.push(String(tabel));
  }
  if (recordId !== null && recordId !== undefined && bentuk.baris) {
    syarat.push(`a.${bentuk.baris} = ?`);
    nilai.push(String(recordId));
  }
  if (perkaraId !== null && perkaraId !== undefined && bentuk.perkara) {
    syarat.push(`a.${bentuk.perkara} = ?`);
    nilai.push(Number(perkaraId));
  }

  // Tanpa satu pun syarat, kuerinya akan menyapu seluruh jejak audit satker -
  // jutaan baris, dan jawabannya pun tidak berarti apa-apa.
  if (syarat.length === 0) {
    return {
      terbaca: false,
      alasan: "Tidak ada penyaring yang dapat dipakai pada sys_audittrail.",
      tanggal: "",
      oleh: "",
      dariAudit: true,
    };
  }

  const pilihan = [`a.${bentuk.waktu} AS waktu`];
  if (bentuk.pelaku) pilihan.push(`a.${bentuk.pelaku} AS pelaku`);
  if (bentuk.aksi) pilihan.push(`a.${bentuk.aksi} AS aksi`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM sys_audittrail a
      WHERE ${syarat.join(" AND ")}
      ORDER BY a.${bentuk.waktu} ASC
      LIMIT ${BATAS_BARIS}`,
    nilai
  ).catch(() => []);

  if (rows.length === 0) {
    return { terbaca: true, alasan: "tidak_ada_jejak", tanggal: "", oleh: "", dariAudit: true };
  }

  // Yang dicari catatan PERTAMA - itulah saat datanya masuk. Perubahan
  // sesudahnya adalah koreksi, dan koreksi bukan penginputan.
  const awal = rows[0];
  return {
    terbaca: true,
    alasan: "",
    tanggal: isoTanggal(awal.waktu),
    oleh: cleanText(awal.pelaku),
    aksi: cleanText(awal.aksi),
    jumlahJejak: rows.length,
    dariAudit: true,
  };
}

/** Seluruh jejak satu perkara, terbaru di atas - untuk ditampilkan bila diminta. */
async function jejakPerkara(perkaraId, { batas = 50 } = {}) {
  const bentuk = await bentukAudit();
  if (!bentuk.terbaca || !bentuk.perkara) {
    return { terbaca: false, alasan: bentuk.alasan || "Jejak audit tidak dapat disaring per perkara.", baris: [] };
  }

  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { terbaca: false, alasan: "perkara_id_tidak_sah", baris: [] };

  const pilihan = [`a.${bentuk.waktu} AS waktu`];
  if (bentuk.tabel) pilihan.push(`a.${bentuk.tabel} AS tabel`);
  if (bentuk.aksi) pilihan.push(`a.${bentuk.aksi} AS aksi`);
  if (bentuk.pelaku) pilihan.push(`a.${bentuk.pelaku} AS pelaku`);

  const maks = Math.min(Math.max(Math.floor(Number(batas) || 50), 1), BATAS_BARIS);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")} FROM sys_audittrail a
      WHERE a.${bentuk.perkara} = ?
      ORDER BY a.${bentuk.waktu} DESC
      LIMIT ${maks}`,
    [id]
  ).catch(() => []);

  return {
    terbaca: true,
    alasan: "",
    baris: rows.map((row) => ({
      tanggal: isoTanggal(row.waktu),
      tabel: cleanText(row.tabel),
      aksi: cleanText(row.aksi),
      pelaku: cleanText(row.pelaku),
    })),
  };
}

module.exports = {
  BATAS_BARIS,
  bentukAudit,
  jejakPerkara,
  lupakan,
  pertamaDicatat,
};
