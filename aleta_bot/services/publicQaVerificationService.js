const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

function getVerificationLevel(intent = {}) {
  const policy = String(intent.verificationPolicy || intent.verification_policy || "").trim();
  if (policy) return policy;
  if (intent.requiresVerification && intent.requiresCaseNumber) return "case_number_only";
  if (intent.requiresVerification) return "case_number_only";
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
  if (level === "case_number_only") return { allowed: true, level, reason: "case_number_provided" };
  if (level === "manual_ptsp") return { allowed: false, level, reason: "manual_ptsp_required" };

  const normalizedSender = normalizeIndonesianPhoneNumber(senderNumber);
  if (!normalizedSender) return { allowed: false, level, reason: "sender_phone_invalid" };

  return {
    allowed: false,
    level,
    reason: "phone_match_not_available",
    fallbackMessage:
      "Untuk keamanan data, nomor WhatsApp ini belum dapat diverifikasi sebagai nomor pihak pada perkara tersebut. Silakan hubungi PTSP/petugas untuk pengecekan lebih lanjut.",
  };
}

module.exports = {
  getVerificationLevel,
  filterResponseByVerificationLevel,
  verifyCaseAccess,
};
