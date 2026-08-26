function normalizeSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractCaseNumber(text) {
  const raw = String(text || "");
  const full = raw.match(/\b(\d{1,5})\s*\/\s*(?:pdt\.)?\s*([a-z.]+)\s*\/\s*(\d{4})\s*\/\s*pa\.?([a-z0-9]+)\b/i);
  if (full) {
    const code = full[2].replace(/^pdt\./i, "").replace(/\./g, "").toUpperCase();
    const court = full[4].toUpperCase();
    return `${full[1]}.${code}.${full[3]}.PA.${court}`;
  }

  const legacyFull = raw.match(/\b(\d{1,5})\s*\/\s*(?:pdt\.)?\s*([a-z.]+)\s*\/\s*(\d{4})\s*\/\s*pa\.?dgl\b/i);
  if (legacyFull) {
    const code = legacyFull[2].replace(/^pdt\./i, "").replace(/\./g, "").toUpperCase();
    return `${legacyFull[1]}.${code}.${legacyFull[3]}`;
  }

  const compact = raw.match(/\b(\d{1,5})\s*[./-]\s*([a-z]{1,4}(?:\.[a-z]{1,4})?)\s*[./-]\s*(\d{4})\b/i);
  if (compact) {
    return `${compact[1]}.${compact[2].replace(/\.$/, "").toUpperCase()}.${compact[3]}`;
  }

  return "";
}

function normalizeCaseNumber(text) {
  const extracted = extractCaseNumber(text);
  if (extracted) return extracted;
  const normalized = normalizeSpaces(text)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*[.-]\s*/g, ".")
    .toUpperCase();
  return extractCaseNumber(normalized) || "";
}

function extractDate(text) {
  const raw = String(text || "").toLowerCase();
  const today = new Date();
  if (/\bhari ini\b/.test(raw)) return today.toISOString().slice(0, 10);
  if (/\bbesok\b/.test(raw)) {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }

  const numeric = raw.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?\b/);
  if (numeric) {
    const year = numeric[3] || String(today.getFullYear());
    return `${year}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  }

  const months = {
    januari: "01",
    februari: "02",
    maret: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    agustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    desember: "12",
  };
  const natural = raw.match(/\b(?:tanggal\s*)?(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\b/);
  if (natural) {
    const year = natural[3] || String(today.getFullYear());
    return `${year}-${months[natural[2]]}-${natural[1].padStart(2, "0")}`;
  }

  return "";
}

function extractServiceType(text) {
  const normalized = String(text || "").toLowerCase();
  if (/\bantrian\b|\bdaftar\s+antrian\b|\bambil\s+nomor\b|\bnomor\s+antrian\b/.test(normalized)) return "antrian_online";
  if (/\bakta\b|\bcerai\b/.test(normalized)) return "akta_cerai";
  if (/\bsidang\b|\bjadwal\b/.test(normalized)) return "jadwal_sidang";
  if (/\bpanjar\b|\bbiaya\b/.test(normalized)) return "biaya_panjar";
  if (/\becourt\b|\be-court\b|\belektronik\b/.test(normalized)) return "ecourt";
  if (/\bpengaduan\b|\bmengadu\b|\blapor\b/.test(normalized)) return "pengaduan";
  if (/\bsalinan\b|\bputusan\b|\bpenetapan\b/.test(normalized)) return "salinan_putusan";
  if (/\balamat\b|\blokasi\b|\bkantor\b/.test(normalized)) return "alamat_pengadilan";
  return "";
}

function extractQueuePartySlot(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.startsWith("antrian online")) return "pihak_2";
  if (normalized.startsWith("daftar antrian")) return "pihak_1";
  if (/\b(tergugat|termohon|pihak\s*2|pihak\s*kedua|lawan)\b/.test(normalized)) return "pihak_2";
  if (/\b(penggugat|pemohon|pihak\s*1|pihak\s*pertama)\b/.test(normalized)) return "pihak_1";
  return "";
}

function extractPublicQaParameters(text, intent = {}) {
  const params = {};
  const nomorPerkara = normalizeCaseNumber(text);
  const tanggal = extractDate(text);
  const jenisLayanan = extractServiceType(text);
  const pihakAntrian = extractQueuePartySlot(text);

  if (nomorPerkara) params.nomor_perkara = nomorPerkara;
  if (tanggal) params.tanggal = tanggal;
  if (jenisLayanan) params.jenis_layanan = jenisLayanan;
  if (pihakAntrian) params.pihak_antrian = pihakAntrian;

  const required = Array.isArray(intent.requiredParameters) ? intent.requiredParameters : [];
  const missing = required.filter((param) => !params[param]);
  return { ...params, _missing: missing };
}

module.exports = {
  extractCaseNumber,
  normalizeCaseNumber,
  extractDate,
  extractServiceType,
  extractQueuePartySlot,
  extractPublicQaParameters,
};
