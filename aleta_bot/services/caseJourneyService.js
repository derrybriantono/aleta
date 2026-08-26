"use strict";

/**
 * Perjalanan perkara: menjawab pertanyaan yang sebenarnya ada di kepala pihak.
 *
 * Enam pilihan menu yang ada sekarang menjawab pertanyaan DATA — kapan sidang,
 * berapa biaya, sudah terbit atau belum aktanya. Yang paling sering ditanyakan
 * pihak justru pertanyaan KEADAAN: "sudah sampai mana perkara saya?" dan "apa
 * yang harus saya lakukan?". Untuk menjawabnya dengan menu lama, pihak harus
 * membuka beberapa pilihan lalu menyimpulkan sendiri — dan kebanyakan orang
 * tidak melakukan itu; mereka menelepon PTSP.
 *
 * Modul ini menyusun satu tampilan runtut: tahapan yang sudah lewat, yang
 * sedang berjalan, dan yang akan datang — ditutup satu baris tindakan yang
 * diturunkan dari keadaan perkaranya sendiri.
 *
 * SUMBER DATANYA sama persis dengan yang dipakai pilihan "Rincian perkara":
 * tabel perkara, perkara_putusan, dan perkara_jadwal_sidang. Jadi tampilan ini
 * tidak menambah beban pada pilihan yang sudah ada, dan karena hasilnya ikut
 * disimpan dalam potret perkara, pembukaan berikutnya tidak menyentuh SIPP
 * sama sekali.
 */

const db = require("../db_config");
const caseSnapshotService = require("./caseSnapshotService");
const { guardCaseCommandAccess, normalizeCaseNumberInput } = require("./publicQaVerificationService");
const { formatDateValue } = require("./humanTextService");
const appealDeadlineService = require("./appealDeadlineService");

/** Penanda tahapan. Sengaja karakter sederhana agar tampil sama di semua ponsel. */
const MARK_DONE = "✓";
const MARK_CURRENT = "▶";
const MARK_UPCOMING = "·";

/**
 * Persiapan yang perlu dibawa pihak, menurut agenda sidangnya.
 *
 * Pihak yang datang tanpa berkas membuat sidang tertunda, dan penundaan adalah
 * biaya nyata bagi pengadilan maupun pihak itu sendiri.
 */
const AGENDA_PREPARATION = [
  { match: /mediasi/i, advice: "Hadir sendiri bila memungkinkan. Mediasi adalah upaya damai dan tidak dapat diwakilkan tanpa surat kuasa." },
  { match: /pembuktian|bukti surat/i, advice: "Bawa bukti surat asli beserta fotokopinya. Fotokopi akan dicocokkan dengan aslinya di persidangan." },
  { match: /saksi/i, advice: "Bawa saksi yang akan didengar keterangannya. Saksi harus hadir sendiri dan membawa identitas." },
  { match: /jawaban|replik|duplik/i, advice: "Siapkan jawaban tertulis bila ada. Boleh juga disampaikan lisan di persidangan." },
  { match: /putusan|pembacaan/i, advice: "Kehadiran tidak diwajibkan. Salinan putusan dapat diminta di PTSP setelah dibacakan." },
  { match: /ikrar/i, advice: "Kehadiran suami mutlak diperlukan. Perceraian baru sah terhitung sejak ikrar talak diucapkan." },
  { match: /gugatan|sidang pertama/i, advice: "Bawa identitas diri (KTP) dan surat panggilan yang Anda terima." },
];

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
 * Mengambil fakta perkara yang dibutuhkan garis waktu.
 * Dua query, tabel yang sama dengan pilihan "Rincian perkara".
 */
async function fetchCaseFacts(nomorPerkara) {
  const [pokok] = await runQuery(
    `SELECT a.perkara_id, a.tanggal_pendaftaran, a.nomor_perkara,
            b.tanggal_putusan, b.tanggal_bht, b.amar_putusan, b.dihadiri_oleh
       FROM perkara AS a
       LEFT JOIN perkara_putusan AS b ON a.perkara_id = b.perkara_id
      WHERE a.nomor_perkara = ?
      LIMIT 1`,
    [nomorPerkara]
  );

  // Tanggal pemberitahuan putusan per pihak. Hanya diambil bila perkaranya
  // memang sudah diputus, supaya perkara berjalan tidak menanggung query ini.
  const pemberitahuan = pokok && pokok.tanggal_putusan
    ? await runQuery(
        `SELECT pihak, MAX(tanggal_pemberitahuan_putusan) AS tanggal
           FROM perkara_putusan_pemberitahuan_putusan
          WHERE perkara_id = ?
          GROUP BY pihak`,
        [pokok.perkara_id]
      )
    : [];

  const sidang = await runQuery(
    `SELECT s.tanggal_sidang, s.agenda
       FROM perkara AS p
       JOIN perkara_jadwal_sidang AS s ON s.perkara_id = p.perkara_id
      WHERE p.nomor_perkara = ?
      ORDER BY s.tanggal_sidang ASC`,
    [nomorPerkara]
  );

  return {
    ditemukan: Boolean(pokok),
    nomorPerkara: (pokok && pokok.nomor_perkara) || nomorPerkara,
    tanggalPendaftaran: toIsoDate(pokok && pokok.tanggal_pendaftaran),
    tanggalPutusan: toIsoDate(pokok && pokok.tanggal_putusan),
    tanggalBht: toIsoDate(pokok && pokok.tanggal_bht),
    amarPutusan: String((pokok && pokok.amar_putusan) || "").trim(),
    dihadiriOleh: pokok ? pokok.dihadiri_oleh : null,
    pemberitahuan: (Array.isArray(pemberitahuan) ? pemberitahuan : []).map((row) => ({
      pihak: String(row.pihak || "").trim(),
      tanggal: toIsoDate(row.tanggal),
    })),
    sidang: sidang
      .map((row) => ({ tanggal: toIsoDate(row.tanggal_sidang), agenda: String(row.agenda || "").trim() }))
      .filter((row) => row.tanggal),
  };
}

/** Apakah perkara ini menghasilkan akta cerai? */
function menghasilkanAktaCerai(nomorPerkara) {
  return /Pdt\.G|Pdt\.P/i.test(String(nomorPerkara || ""));
}

/**
 * Menyusun tahapan perkara beserta keadaannya.
 *
 * Tahap "berjalan" adalah tahap pertama yang belum selesai. Menandainya penting
 * karena itulah yang dicari pihak saat membuka tampilan ini.
 */
function buildStages(facts, today = new Date()) {
  const hariIni = toIsoDate(today);
  const stages = [];

  stages.push({
    key: "pendaftaran",
    label: "Perkara didaftarkan",
    date: facts.tanggalPendaftaran,
    status: facts.tanggalPendaftaran ? "selesai" : "belum",
  });

  const sidangLalu = facts.sidang.filter((item) => item.tanggal <= hariIni);
  const sidangDepan = facts.sidang.filter((item) => item.tanggal > hariIni);

  for (const item of sidangLalu) {
    stages.push({
      key: "sidang",
      label: item.agenda ? `Sidang: ${item.agenda}` : "Sidang",
      date: item.tanggal,
      status: "selesai",
    });
  }

  if (sidangDepan.length > 0) {
    const berikutnya = sidangDepan[0];
    stages.push({
      key: "sidang_berikutnya",
      label: berikutnya.agenda ? `Sidang: ${berikutnya.agenda}` : "Sidang berikutnya",
      date: berikutnya.tanggal,
      status: "berjalan",
      agenda: berikutnya.agenda,
    });
    for (const item of sidangDepan.slice(1)) {
      stages.push({
        key: "sidang",
        label: item.agenda ? `Sidang: ${item.agenda}` : "Sidang",
        date: item.tanggal,
        status: "akan_datang",
      });
    }
  } else if (facts.sidang.length === 0) {
    stages.push({ key: "sidang", label: "Sidang", date: "", status: "belum" });
  }

  stages.push({
    key: "putusan",
    label: "Putusan",
    date: facts.tanggalPutusan,
    status: facts.tanggalPutusan ? "selesai" : "belum",
  });

  stages.push({
    key: "bht",
    label: "Berkekuatan hukum tetap",
    date: facts.tanggalBht,
    status: facts.tanggalBht ? "selesai" : "belum",
  });

  if (menghasilkanAktaCerai(facts.nomorPerkara)) {
    stages.push({
      key: "akta",
      label: "Akta cerai dapat diambil",
      date: "",
      status: facts.tanggalBht ? "berjalan" : "belum",
    });
  }

  // Tahap berjalan adalah yang pertama belum selesai, bila belum ditandai.
  if (!stages.some((stage) => stage.status === "berjalan")) {
    const pertamaBelum = stages.find((stage) => stage.status === "belum");
    if (pertamaBelum) pertamaBelum.status = "berjalan";
  }
  return stages;
}

/** Saran persiapan menurut agenda sidang. */
function preparationFor(agenda) {
  const found = AGENDA_PREPARATION.find((item) => item.match.test(String(agenda || "")));
  return found ? found.advice : "";
}

/**
 * Satu baris tindakan, diturunkan dari keadaan perkara.
 *
 * Bila memang tidak ada yang perlu dilakukan, itu dikatakan dengan jelas.
 * Data tanpa konsekuensi membuat orang bertanya lagi ke petugas, dan "tidak
 * ada yang perlu Anda lakukan" adalah jawaban yang menenangkan, bukan kosong.
 */
/**
 * Keterangan tenggang banding, bila memang sudah dapat dipastikan.
 *
 * Mengembalikan null ketika tanggal acuannya belum jelas — lebih baik tidak
 * menyebut angka sama sekali daripada menyebut angka yang bisa keliru pada
 * hal yang haknya bisa hilang.
 *
 * Pihak yang bertanya bisa berada di posisi mana pun pada perkara, dan tenggang
 * tiap pihak bisa berbeda bila hanya salah satu yang hadir. Yang ditampilkan
 * adalah tenggang yang PALING CEPAT berakhir di antara pihak yang tercatat,
 * supaya keterangannya tidak pernah lebih longgar daripada keadaan sebenarnya.
 */
function describeAppealDeadline(facts, { today = new Date() } = {}) {
  const kandidat = ["1", "2"]
    .map((pihakKe) => {
      const catatan = (facts.pemberitahuan || []).find((item) => item.pihak === pihakKe);
      return appealDeadlineService.computeAppealDeadline({
        tanggalPutusan: facts.tanggalPutusan,
        tanggalBht: facts.tanggalBht,
        dihadiriOleh: facts.dihadiriOleh,
        tanggalPemberitahuan: catatan ? catatan.tanggal : "",
        pihakKe,
        today,
      });
    })
    .filter((item) => item.status === "berjalan" || item.status === "habis");

  if (kandidat.length === 0) {
    const menunggu = (facts.pemberitahuan || []).length === 0 && facts.dihadiriOleh !== null;
    if (menunggu) {
      return {
        key: "menunggu_pemberitahuan_putusan",
        text:
          "Perkara sudah diputus. Pemberitahuan putusan belum tercatat disampaikan, jadi tenggang mengajukan banding belum mulai dihitung. " +
          "Belum ada yang perlu Anda lakukan sekarang.",
      };
    }
    return null;
  }

  const paling = kandidat.reduce((a, b) => (a.tanggalBatas <= b.tanggalBatas ? a : b));
  const dasar = paling.dasar === "pemberitahuan" ? "sejak putusan diberitahukan" : "sejak putusan dibacakan";
  const penutup =
    "\n_Perhitungan ini perkiraan untuk membantu mengingat. Tanggal yang berlaku tetap catatan resmi pengadilan; pastikan ke PTSP sebelum tenggangnya berakhir._";

  if (paling.status === "habis") {
    return {
      key: "tenggang_banding_habis",
      text:
        `Tenggang mengajukan banding diperkirakan sudah berakhir pada ${formatDate(paling.tanggalBatas)} ` +
        `(14 hari ${dasar}). Bila tidak ada banding, perkara menuju berkekuatan hukum tetap.` +
        penutup,
    };
  }

  const sisa = paling.sisaHari;
  const desakan =
    sisa <= 3
      ? "Bila hendak mengajukan banding, segera datang ke PTSP pengadilan hari ini juga."
      : "Bila hendak mengajukan banding, ajukan melalui PTSP pengadilan sebelum tanggal tersebut.";

  return {
    key: "tenggang_banding",
    text:
      `Tenggang mengajukan banding berakhir ${formatDate(paling.tanggalBatas)} — ` +
      `tersisa ${sisa} hari (14 hari ${dasar}).\n${desakan}` +
      penutup,
  };
}

function buildNextAction(facts, stages, { today = new Date() } = {}) {
  const sidangBerikutnya = stages.find((stage) => stage.key === "sidang_berikutnya");

  if (sidangBerikutnya) {
    const persiapan = preparationFor(sidangBerikutnya.agenda);
    return {
      key: "hadir_sidang",
      text:
        `Hadir pada sidang ${formatDate(sidangBerikutnya.date)}` +
        (sidangBerikutnya.agenda ? ` dengan agenda ${sidangBerikutnya.agenda.toLowerCase()}` : "") +
        "." + (persiapan ? `\n${persiapan}` : ""),
    };
  }

  if (facts.tanggalBht) {
    if (menghasilkanAktaCerai(facts.nomorPerkara)) {
      return {
        key: "ambil_akta",
        text: "Putusan sudah berkekuatan hukum tetap. Akta cerai sudah dapat diurus melalui PTSP pengadilan atau secara daring di https://eac.mahkamahagung.go.id/",
      };
    }
    return { key: "selesai", text: "Perkara Anda sudah selesai dan berkekuatan hukum tetap." };
  }

  if (facts.tanggalPutusan) {
    // Tenggang banding adalah satu-satunya keterangan yang HANGUS bila
    // terlambat, jadi bila tanggalnya sudah jelas ia dinyatakan sebagai angka,
    // bukan sekadar disebut "14 hari".
    const tenggang = describeAppealDeadline(facts, { today });
    if (tenggang) return tenggang;

    return {
      key: "menunggu_bht",
      text: "Perkara sudah diputus. Sekarang menunggu masa berkekuatan hukum tetap, yaitu 14 hari sejak putusan diberitahukan bila tidak ada banding. Belum ada yang perlu Anda lakukan.",
    };
  }

  if (facts.sidang.length === 0) {
    return {
      key: "menunggu_jadwal",
      text: "Hari sidang belum ditetapkan. Panggilan resmi akan disampaikan Jurusita ke alamat Anda. Belum ada yang perlu Anda lakukan.",
    };
  }

  return {
    key: "menunggu_lanjutan",
    text: "Menunggu jadwal sidang berikutnya ditetapkan. Panggilan resmi akan disampaikan Jurusita ke alamat Anda.",
  };
}

function markOf(status) {
  if (status === "selesai") return MARK_DONE;
  if (status === "berjalan") return MARK_CURRENT;
  return MARK_UPCOMING;
}

/** Menyusun tampilan perjalanan perkara untuk dikirim ke pihak. */
function renderJourney(facts, stages, action) {
  if (!facts.ditemukan) {
    return `Data perkara ${facts.nomorPerkara} belum dapat ditemukan. Silakan hubungi PTSP pengadilan untuk pengecekan.`;
  }

  const baris = [`*Perjalanan Perkara ${facts.nomorPerkara}*`, ""];
  for (const stage of stages) {
    const tanggal = stage.date ? ` — ${formatDate(stage.date)}` : "";
    const keterangan =
      !stage.date && stage.status !== "selesai"
        ? stage.status === "berjalan"
          ? " — sedang berjalan"
          : " — belum"
        : "";
    baris.push(`${markOf(stage.status)} ${stage.label}${tanggal}${keterangan}`);
  }

  if (facts.amarPutusan) {
    baris.push("", `*Amar putusan:* ${facts.amarPutusan}`);
  }

  baris.push("", "*Yang perlu Anda lakukan:*", action.text);
  return baris.join("\n");
}

/**
 * Perjalanan perkara siap kirim.
 * Hasilnya disimpan dalam potret perkara, sehingga pembukaan berikutnya dalam
 * masa berlaku tidak menyentuh SIPP.
 */
async function getCaseJourney(nomorPerkara, { senderNumber = "", today = new Date() } = {}) {
  const normalized = normalizeCaseNumberInput(nomorPerkara);
  if (!normalized) {
    return "Nomor perkara belum terbaca. Silakan ketik *MENU* untuk memilih perkara Anda.";
  }

  // Hak akses diperiksa ulang di sini, sama seperti seluruh perintah perkara
  // lain yang lewat getData(). Tampilan ini memang hanya dapat dibuka dari
  // menu, tetapi keamanan tidak boleh bersandar pada dari mana sebuah
  // permintaan datang.
  const akses = await guardCaseCommandAccess({
    senderNumber,
    command: "perjalanan",
    nomorPerkara: normalized,
  });
  if (!akses.allowed) {
    return akses.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.";
  }

  const potret = await caseSnapshotService.remember({
    kind: "perjalanan",
    caseNumber: normalized,
    loader: async () => {
      const facts = await fetchCaseFacts(normalized);
      const stages = buildStages(facts, today);
      const action = buildNextAction(facts, stages, { today });
      return renderJourney(facts, stages, action);
    },
  });
  return potret.value;
}

module.exports = {
  AGENDA_PREPARATION,
  MARK_CURRENT,
  MARK_DONE,
  MARK_UPCOMING,
  buildNextAction,
  buildStages,
  describeAppealDeadline,
  fetchCaseFacts,
  getCaseJourney,
  menghasilkanAktaCerai,
  preparationFor,
  renderJourney,
};
