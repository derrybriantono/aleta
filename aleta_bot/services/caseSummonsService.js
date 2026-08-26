"use strict";

/**
 * Status panggilan sidang (relaas) untuk pihak berperkara.
 *
 * Ini pertanyaan yang paling sering masuk ke PTSP dan sampai sekarang belum
 * pernah bisa dijawab bot: "apakah saya sudah dipanggil?" dan yang lebih sering
 * lagi, "apakah pihak lawan sudah dipanggil?".
 *
 * Pertanyaannya penting bukan karena penasaran. Sidang hanya dapat berlanjut
 * bila panggilan sudah disampaikan secara patut kepada semua pihak. Pihak yang
 * tidak tahu lawannya belum dipanggil tetap berangkat ke pengadilan, menunggu,
 * lalu pulang tanpa sidang — dan bagi yang datang dari luar kota, biayanya
 * nyata. Menjawabnya lebih awal memotong perjalanan sia-sia itu.
 *
 * SUMBER DATANYA tabel perkara_pelaksanaan_relaas, dipasangkan dengan daftar
 * pihak dan jadwal sidang perkara. Semuanya tabel yang sudah dipakai jalur lama;
 * yang baru hanyalah pembacaan per satu perkara.
 *
 * YANG SENGAJA TIDAK DIBACA SAMA SEKALI: nomor telepon, alamat, dan keterangan
 * bebas hasil penyampaian relaas. Yang berhak diketahui pihak adalah APAKAH
 * panggilan sudah disampaikan dan KAPAN, bukan data pribadi lawannya. Kolom
 * yang tidak ditampilkan sekalian tidak diambil dari database, supaya tidak
 * pernah ada kesempatan bocor lewat log atau potret perkara.
 */

const db = require("../db_config");
const caseSnapshotService = require("./caseSnapshotService");
const { guardCaseCommandAccess, normalizeCaseNumberInput } = require("./publicQaVerificationService");
const { formatDateValue, toTitleCaseName } = require("./humanTextService");

const MARK_DONE = "✓";
const MARK_PENDING = "·";

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function toIsoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  const iso = toIsoDate(value);
  return iso ? formatDateValue(iso) : "";
}

/**
 * Mengambil status panggilan seluruh pihak pada satu perkara.
 *
 * Diambil relaas TERBARU per pihak: satu pihak bisa dipanggil berkali-kali
 * untuk sidang yang berbeda, dan yang relevan bagi penanya adalah panggilan
 * untuk sidang yang akan datang.
 */
async function fetchSummonsStatus(nomorPerkara) {
  const pihak = await runQuery(
    `SELECT
        vp.pihak_id,
        vp.nama,
        vp.pihak_ke,
        MAX(rel.tanggal_relaas) AS tanggal_relaas,
        MAX(rel.tanggal_jursit_pos) AS tanggal_kirim
       FROM v_pihak_perkara AS vp
       JOIN perkara AS p ON p.perkara_id = vp.perkara_id
       LEFT JOIN perkara_pelaksanaan_relaas AS rel
              ON rel.pihak_id = vp.pihak_id AND rel.perkara_id = vp.perkara_id
      WHERE p.nomor_perkara = ?
      GROUP BY vp.pihak_id, vp.nama, vp.pihak_ke
      ORDER BY vp.pihak_ke ASC`,
    [nomorPerkara]
  );

  const sidang = await runQuery(
    `SELECT s.tanggal_sidang, s.agenda
       FROM perkara AS p
       JOIN perkara_jadwal_sidang AS s ON s.perkara_id = p.perkara_id
      WHERE p.nomor_perkara = ?
        AND s.tanggal_sidang >= CURDATE()
      ORDER BY s.tanggal_sidang ASC
      LIMIT 1`,
    [nomorPerkara]
  );

  return {
    ditemukan: pihak.length > 0,
    nomorPerkara,
    pihak: pihak.map((row) => ({
      nama: toTitleCaseName(row.nama) || String(row.nama || "").trim(),
      pihakKe: String(row.pihak_ke || "").trim(),
      tanggalRelaas: toIsoDate(row.tanggal_relaas),
      tanggalKirim: toIsoDate(row.tanggal_kirim),
    })),
    sidangBerikutnya: sidang[0]
      ? { tanggal: toIsoDate(sidang[0].tanggal_sidang), agenda: String(sidang[0].agenda || "").trim() }
      : null,
  };
}

/** Sebutan peran menurut posisi pihak pada perkara. */
function describePartyRole(pihakKe, jenisPermohonan) {
  const ke = String(pihakKe || "").trim().toLowerCase();
  if (jenisPermohonan) return ke === "2" || ke === "t" ? "Termohon" : "Pemohon";
  if (ke === "2" || ke === "t") return "Tergugat";
  if (ke === "1" || ke === "p") return "Penggugat";
  return "Pihak";
}

/**
 * Kesimpulan keadaan panggilan untuk seluruh perkara.
 *
 * Inilah yang sebenarnya dicari penanya: apakah sidang berikutnya kemungkinan
 * berlanjut atau tertunda karena masih ada yang belum dipanggil.
 */
function summarize(status) {
  const total = status.pihak.length;
  const sudah = status.pihak.filter((item) => item.tanggalRelaas).length;

  if (total === 0) {
    return { key: "tidak_ada_pihak", text: "Data pihak pada perkara ini belum dapat dibaca." };
  }
  if (sudah === 0) {
    return {
      key: "belum_ada",
      text: "Belum ada panggilan yang tercatat disampaikan. Jurusita masih dalam proses menyampaikannya.",
    };
  }
  if (sudah < total) {
    return {
      key: "sebagian",
      text:
        `Masih ada ${total - sudah} pihak yang panggilannya belum tercatat disampaikan. ` +
        "Bila sampai hari sidang belum juga tersampaikan, sidang biasanya ditunda dan panggilan diulang.",
    };
  }
  return {
    key: "lengkap",
    text: "Seluruh pihak sudah tercatat menerima panggilan. Sidang dapat berlanjut sesuai jadwal.",
  };
}

/** Menyusun tampilan status panggilan untuk dikirim ke pihak. */
function renderSummons(status) {
  if (!status.ditemukan) {
    return `Data panggilan untuk perkara ${status.nomorPerkara} belum dapat ditemukan. Silakan hubungi PTSP pengadilan.`;
  }

  const permohonan = /Pdt\.P/i.test(status.nomorPerkara);
  const baris = [`*Status Panggilan Sidang*`, `Perkara ${status.nomorPerkara}`, ""];

  if (status.sidangBerikutnya) {
    baris.push(
      `Untuk sidang ${formatDate(status.sidangBerikutnya.tanggal)}` +
        (status.sidangBerikutnya.agenda ? ` — ${status.sidangBerikutnya.agenda}` : ""),
      ""
    );
  }

  for (const item of status.pihak) {
    const peran = describePartyRole(item.pihakKe, permohonan);
    if (item.tanggalRelaas) {
      baris.push(`${MARK_DONE} ${peran}: ${item.nama}`);
      baris.push(`     Sudah dipanggil — ${formatDate(item.tanggalRelaas)}`);
    } else {
      baris.push(`${MARK_PENDING} ${peran}: ${item.nama}`);
      baris.push(
        item.tanggalKirim
          ? `     Panggilan dikirim ${formatDate(item.tanggalKirim)}, menunggu bukti penyampaian`
          : "     Belum tercatat dipanggil"
      );
    }
  }

  baris.push("", "*Keterangan:*", summarize(status).text);
  baris.push(
    "",
    "_Panggilan resmi disampaikan Jurusita atau Petugas Pos ke alamat Anda. Keterangan di atas mengikuti catatan pengadilan._"
  );
  return baris.join("\n");
}

/**
 * Status panggilan siap kirim.
 *
 * Hak akses diperiksa ulang di sini, sama seperti seluruh perintah perkara
 * lain — tampilan ini memang hanya dapat dibuka dari menu, tetapi keamanan
 * tidak boleh bersandar pada dari mana sebuah permintaan datang.
 */
async function getSummonsStatus(nomorPerkara, { senderNumber = "" } = {}) {
  const normalized = normalizeCaseNumberInput(nomorPerkara);
  if (!normalized) {
    return "Nomor perkara belum terbaca. Silakan ketik *MENU* untuk memilih perkara Anda.";
  }

  const akses = await guardCaseCommandAccess({
    senderNumber,
    command: "panggilan",
    nomorPerkara: normalized,
  });
  if (!akses.allowed) {
    return akses.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.";
  }

  const potret = await caseSnapshotService.remember({
    kind: "panggilan",
    caseNumber: normalized,
    loader: async () => renderSummons(await fetchSummonsStatus(normalized)),
  });
  return potret.value;
}

module.exports = {
  MARK_DONE,
  MARK_PENDING,
  describePartyRole,
  fetchSummonsStatus,
  getSummonsStatus,
  renderSummons,
  summarize,
};
