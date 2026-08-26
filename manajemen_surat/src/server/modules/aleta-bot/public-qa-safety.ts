const BLOCK_RULES = [
  {
    key: "case_prediction",
    label: "Prediksi menang/kalah perkara",
    patterns: [/menang|kalah|pasti\s+dikabul|peluang\s+menang|putusan\s+nanti/i],
  },
  {
    key: "case_strategy",
    label: "Strategi atau nasihat hukum substantif",
    patterns: [/strategi|cara\s+menang|gugatan\s+harus|jawaban\s+tergugat|eksepsi|pembuktian/i],
  },
  {
    key: "bribery_or_judge_contact",
    label: "Suap atau kontak hakim",
    patterns: [/suap|uang\s+pelicin|hubungi\s+hakim|nomor\s+hakim|atur\s+putusan/i],
  },
  {
    key: "third_party_data",
    label: "Permintaan data pihak lain",
    patterns: [/nik|alamat\s+lengkap|nomor\s+hp|data\s+istri|data\s+suami|data\s+lawan/i],
  },
  {
    key: "internal_data",
    label: "Permintaan data internal pengadilan",
    patterns: [/password|token|database|sql|session|internal|rahasia/i],
  },
  {
    key: "threat_or_abuse",
    label: "Ancaman atau penghinaan",
    patterns: [/bunuh|ancam|hancurkan|bodoh|tolol|bangsat/i],
  },
];

const INTENT_HINTS = [
  { intentKey: "cek_jadwal_sidang", patterns: [/jadwal|sidang|kapan/i] },
  { intentKey: "antrian_online", patterns: [/antrian|ambil\s+nomor|sudah\s+hadir|sudah\s+datang/i] },
  { intentKey: "cek_akta_cerai", patterns: [/akta|cerai|ambil\s+akta/i] },
  { intentKey: "sisa_panjar", patterns: [/sisa\s+panjar|biaya|panjar|uang/i] },
  { intentKey: "alamat_pengadilan", patterns: [/alamat|lokasi|kantor/i] },
  { intentKey: "ecourt", patterns: [/ecourt|e-court|e court/i] },
  { intentKey: "pengaduan", patterns: [/adu|pengaduan|lapor/i] },
  { intentKey: "syarat_daftar", patterns: [/daftar|syarat|mengajukan/i] },
  { intentKey: "salinan_putusan", patterns: [/salinan|putusan/i] },
];

export type PublicQaSafetyResult = {
  blocked: boolean;
  riskLevel: "low" | "medium" | "high";
  reasonKey: string;
  reasonLabel: string;
  handoffRequired: boolean;
};

export function classifySafetyRisk(message: string): PublicQaSafetyResult {
  const text = String(message || "");
  for (const rule of BLOCK_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        blocked: true,
        riskLevel: "high",
        reasonKey: rule.key,
        reasonLabel: rule.label,
        handoffRequired: true,
      };
    }
  }

  return {
    blocked: false,
    riskLevel: text.length > 180 ? "medium" : "low",
    reasonKey: "safe",
    reasonLabel: "Tidak terdeteksi pola berbahaya.",
    handoffRequired: false,
  };
}

export function shouldBlockAiAnswer(message: string) {
  return classifySafetyRisk(message).blocked;
}

export function buildSafeFallback(reason?: string) {
  return [
    "Pertanyaan Bapak/Ibu perlu bantuan petugas.",
    "Silakan hubungi PTSP/petugas melalui nomor atau kanal resmi pengadilan.",
    reason ? `Alasan pengalihan: ${reason}.` : "",
  ].filter(Boolean).join("\n");
}

export function suggestIntentForQuestion(message: string) {
  const text = String(message || "");
  const matched = INTENT_HINTS.find((hint) => hint.patterns.some((pattern) => pattern.test(text)));
  const safety = classifySafetyRisk(text);
  const suggestedAction: "add_as_example" | "create_intent_draft" | "human_handoff" =
    safety.blocked ? "human_handoff" : matched ? "add_as_example" : "create_intent_draft";
  return {
    suggestedIntentKey: matched?.intentKey ?? "fallback_unknown",
    confidence: matched ? 0.68 : 0.25,
    safety,
    suggestedAction,
  };
}
