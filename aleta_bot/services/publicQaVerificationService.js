const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");
const db = require("../db_config");
const { readRuntimeConfig } = require("../config/runtime-config");
const caseSnapshotService = require("./caseSnapshotService");

const CASE_ACCESS_FALLBACK_MESSAGE = [
  "Untuk keamanan data perkara, informasi perkara hanya dapat diberikan ke nomor pegawai terdaftar atau nomor pihak/kuasa yang tercatat pada perkara tersebut.",
  "Nomor WhatsApp ini belum cocok dengan data perkara. Silakan hubungi PTSP atau CS resmi pengadilan untuk pengecekan lebih lanjut.",
].join("\n");

const CASE_COMMANDS_REQUIRING_ACCESS = new Set([
  "jadwal",
  "status",
  "biaya",
  "akta",
  "pesan akta",
  "putusan",
  "saksi",
  "detail",
  "perjalanan",
  "panggilan",
  "berkas putusan",
  // Pendaftaran antrian online MENULIS ke sipp_turunan_antrian atas nama sebuah
  // perkara, jadi nomor perkara yang disebut eksplisit wajib diverifikasi dulu
  // terhadap nomor WhatsApp pengirim.
  "antrian online",
  "daftar antrian",
  "ambil antrian",
]);

const CASE_TYPE_MAP = {
  G: "Pdt.G",
  P: "Pdt.P",
  GS: "Pdt.G.S",
  B: "Pid.B",
  S: "Pid.S",
  C: "Pid.C",
  PRA: "Pid.Pra",
  "SUS-ANAK": "Pid.Sus-Anak",
  JN: "JN",
  PRAJN: "JN.Pra",
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function maybeDecodeBase64Case(value) {
  const raw = String(value || "").trim();
  if (!raw || /[/.]/.test(raw)) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (/^\d+[\w./-]*\d{4}/.test(decoded)) return decoded;
  } catch {
    return raw;
  }
  return raw;
}

function normalizeCaseNumberInput(value) {
  const raw = maybeDecodeBase64Case(value)
    .replace(/\s+/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!raw) return "";

  if (/^\d+\/[^/]+\/\d{4}\/[A-Za-z.]+$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d+)[./-]([A-Za-z][A-Za-z.-]*)[./-](\d{4})$/);
  if (!match) return raw;

  const [, number, typeCodeRaw, year] = match;
  const typeCode = typeCodeRaw.toUpperCase();
  const mappedType = CASE_TYPE_MAP[typeCode] || `Pdt.${typeCodeRaw}`;
  return `${number}/${mappedType}/${year}/PA.Dgl`;
}

function phoneVariants(input) {
  const normalized = normalizeIndonesianPhoneNumber(String(input || "").replace(/@c\.us$/i, ""));
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.startsWith("62")) variants.add(`0${normalized.slice(2)}`);
  return Array.from(variants);
}

function phonesMatch(left, right) {
  const leftVariants = phoneVariants(left);
  const rightVariants = phoneVariants(right);
  if (leftVariants.length === 0 || rightVariants.length === 0) return false;
  const rightSet = new Set(rightVariants);
  return leftVariants.some((value) => rightSet.has(value));
}

function senderIsRegisteredEmployee(senderNumber) {
  const runtime = readRuntimeConfig();
  const normalizedSender = normalizeIndonesianPhoneNumber(senderNumber || "");
  if (!normalizedSender) return false;
  return (Array.isArray(runtime.employeeRecipients) ? runtime.employeeRecipients : []).some((recipient) => {
    const values = [
      recipient.whatsappNumber,
      recipient.whatsappChatId,
      recipient.phoneNumber,
      recipient.phone_number,
      recipient.mobilePhone,
      recipient.mobile_phone,
    ];
    return values.some((value) => phonesMatch(normalizedSender, value));
  });
}

/**
 * Daftar pihak dan kuasa sebuah perkara.
 *
 * Disimpan sebentar dalam potret perkara karena dipanggil pada SETIAP
 * permintaan yang menyangkut perkara — verifikasi hak akses menanyakannya
 * berulang untuk perkara yang sama dalam hitungan detik.
 *
 * Yang disimpan hanyalah DAFTAR penerimanya, bukan keputusan siapa yang boleh
 * mengakses. Pencocokan nomor pengirim tetap dihitung ulang setiap kali di
 * verifyCaseAccess, sehingga potret tidak pernah bisa meloloskan orang yang
 * tidak berhak.
 */
async function getCaseRecipients(nomorPerkara) {
  const normalizedNomorPerkara = normalizeCaseNumberInput(nomorPerkara);
  if (!normalizedNomorPerkara) return { nomorPerkara: "", rows: [] };

  const potret = await caseSnapshotService.remember({
    kind: "penerima",
    caseNumber: normalizedNomorPerkara,
    loader: () => fetchCaseRecipients(normalizedNomorPerkara),
  });
  return potret.value;
}

async function fetchCaseRecipients(normalizedNomorPerkara) {

  const sql = `
    SELECT
      c.perkara_id,
      c.nomor_perkara,
      a.nama,
      a.pihak_id,
      a.pihak_ke,
      'pihak' AS recipient_type,
      b.telepon
    FROM v_pihak_perkara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pihak_id
    WHERE c.nomor_perkara = ?
    UNION ALL
    SELECT
      c.perkara_id,
      c.nomor_perkara,
      a.nama,
      a.pengacara_id AS pihak_id,
      a.pihak_ke,
      'kuasa' AS recipient_type,
      b.telepon
    FROM perkara_pengacara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pengacara_id
    WHERE c.nomor_perkara = ?
  `;

  const rows = await runQuery(sql, [normalizedNomorPerkara, normalizedNomorPerkara]);
  return { nomorPerkara: normalizedNomorPerkara, rows };
}

function getVerificationLevel(intent = {}) {
  const policy = String(intent.verificationPolicy || intent.verification_policy || "").trim();
  if (policy) return policy;
  if (intent.requiresVerification) return "case_number_and_phone";
  return "none";
}

function filterResponseByVerificationLevel(data, level) {
  if (!data || typeof data !== "object") return data;
  if (level === "none" || level === "case_number_only") {
    const allowed = ["nomor_perkara", "tanggal_sidang", "agenda", "ruangan", "status_umum", "jenis_perkara", "keterangan"];
    return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  }
  return data;
}

async function verifyCaseAccess({ senderNumber = "", nomorPerkara = "", intent = {} }) {
  const level = getVerificationLevel(intent);
  if (level === "none") return { allowed: true, level, reason: "public_information" };
  if (!nomorPerkara) return { allowed: false, level, reason: "missing_case_number" };
  if (level === "manual_ptsp") return { allowed: false, level, reason: "manual_ptsp_required" };

  const normalizedSender = normalizeIndonesianPhoneNumber(senderNumber);
  if (!normalizedSender) {
    return {
      allowed: false,
      level,
      reason: "sender_phone_invalid",
      fallbackMessage: CASE_ACCESS_FALLBACK_MESSAGE,
    };
  }

  if (senderIsRegisteredEmployee(normalizedSender)) {
    return {
      allowed: true,
      level,
      reason: "employee_number_verified",
      normalizedNomorPerkara: normalizeCaseNumberInput(nomorPerkara),
    };
  }

  try {
    const caseRecipients = await getCaseRecipients(nomorPerkara);
    if (caseRecipients.rows.length === 0) {
      return {
        allowed: false,
        level,
        reason: "case_not_found_or_no_recipient_phone",
        normalizedNomorPerkara: caseRecipients.nomorPerkara,
        fallbackMessage:
          "Nomor perkara belum ditemukan atau belum memiliki nomor pihak yang dapat diverifikasi. Silakan hubungi PTSP atau CS resmi pengadilan.",
      };
    }

    const matchedRecipient = caseRecipients.rows.find((row) => phonesMatch(normalizedSender, row.telepon));
    if (matchedRecipient) {
      return {
        allowed: true,
        level,
        reason: "case_party_phone_verified",
        normalizedNomorPerkara: caseRecipients.nomorPerkara,
        recipientType: matchedRecipient.recipient_type,
      };
    }
  } catch (error) {
    return {
      allowed: false,
      level,
      reason: "case_verification_failed",
      fallbackMessage:
        "Maaf, data perkara sedang tidak dapat diverifikasi dengan aman. Silakan coba lagi nanti atau hubungi PTSP/CS resmi pengadilan.",
      errorMessage: error.message,
    };
  }

  return {
    allowed: false,
    level,
    reason: "sender_not_related_to_case",
    fallbackMessage: CASE_ACCESS_FALLBACK_MESSAGE,
  };
}

async function guardCaseCommandAccess({ senderNumber = "", command = "", nomorPerkara = "" }) {
  const normalizedCommand = String(command || "").trim().toLowerCase();
  if (!CASE_COMMANDS_REQUIRING_ACCESS.has(normalizedCommand)) {
    return { allowed: true, reason: "command_not_sensitive" };
  }
  return verifyCaseAccess({
    senderNumber,
    nomorPerkara,
    intent: {
      requiresVerification: true,
      requiresCaseNumber: true,
      verificationPolicy: "case_number_and_phone",
    },
  });
}

module.exports = {
  getVerificationLevel,
  filterResponseByVerificationLevel,
  verifyCaseAccess,
  guardCaseCommandAccess,
  normalizeCaseNumberInput,
  senderIsRegisteredEmployee,
};
