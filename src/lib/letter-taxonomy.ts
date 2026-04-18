export type LetterClassificationOption = {
  value: string;
  label: string;
  category: string;
  keywords: string[];
};

export type LetterClassificationMatch = {
  code: string;
  label: string;
  title: string;
  category: string;
  keywordHits: string[];
  score: number;
};

export const letterOriginSuggestions = [
  "Mahkamah Agung RI",
  "Ditjen Badilag",
  "Pengadilan Tinggi Agama Makassar",
  "Pengadilan Agama Sewilayah",
  "Pengadilan Negeri / Instansi Peradilan Lain",
  "Badan Pengawasan Mahkamah Agung",
  "Badan Urusan Administrasi Mahkamah Agung",
  "Kementerian / Lembaga",
  "Pemerintah Provinsi",
  "Pemerintah Kabupaten / Kota",
  "KPPN / Kementerian Keuangan",
  "Vendor / Rekanan",
  "Internal Pengadilan",
];

// Baseline opsi dibuat mengikuti struktur klasifikasi arsip dan tata naskah dinas MA RI
// untuk membantu pengisian, pencarian, dan statistik yang konsisten.
export const letterClassificationCatalog: LetterClassificationOption[] = [
  { value: "HK.1.1", label: "HK.1.1 - Undang-Undang / PERPU", category: "Hukum", keywords: ["hukum", "undang-undang", "perpu", "regulasi"] },
  { value: "HK.1.2", label: "HK.1.2 - Peraturan Pemerintah", category: "Hukum", keywords: ["hukum", "peraturan pemerintah"] },
  { value: "HK.1.3", label: "HK.1.3 - Peraturan Presiden", category: "Hukum", keywords: ["hukum", "perpres", "presiden"] },
  { value: "HK.2.1", label: "HK.2.1 - Kebijakan / Pedoman Internal", category: "Hukum", keywords: ["pedoman", "kebijakan", "internal"] },
  { value: "HK.3.1", label: "HK.3.1 - Telaah / Pertimbangan Hukum", category: "Hukum", keywords: ["telaah", "pendapat hukum", "legal opinion"] },
  { value: "KP.1.1", label: "KP.1.1 - Formasi, Mutasi, dan Penempatan", category: "Kepegawaian", keywords: ["pegawai", "mutasi", "jabatan"] },
  { value: "KP.2.1", label: "KP.2.1 - Kenaikan Pangkat dan Karier", category: "Kepegawaian", keywords: ["kenaikan pangkat", "karier", "promosi"] },
  { value: "KP.3.1", label: "KP.3.1 - Cuti, Disiplin, dan Kehadiran", category: "Kepegawaian", keywords: ["cuti", "disiplin", "kehadiran"] },
  { value: "KU.1.1", label: "KU.1.1 - DIPA dan Perencanaan Anggaran", category: "Keuangan", keywords: ["dipa", "anggaran", "keuangan"] },
  { value: "KU.2.1", label: "KU.2.1 - Pembayaran dan Pencairan", category: "Keuangan", keywords: ["pembayaran", "pencairan", "spm"] },
  { value: "KU.3.1", label: "KU.3.1 - Laporan Keuangan", category: "Keuangan", keywords: ["laporan keuangan", "rekonsiliasi"] },
  { value: "PR.1.1", label: "PR.1.1 - Renstra, LKjIP, dan Monitoring", category: "Perencanaan", keywords: ["renstra", "lkjip", "monitoring", "triwulan"] },
  { value: "PR.2.1", label: "PR.2.1 - Statistik dan Evaluasi Kinerja", category: "Perencanaan", keywords: ["statistik", "kinerja", "evaluasi"] },
  { value: "TI.1.1", label: "TI.1.1 - Infrastruktur, Jaringan, dan Keamanan", category: "Teknologi Informasi", keywords: ["jaringan", "keamanan", "server", "audit"] },
  { value: "TI.2.1", label: "TI.2.1 - Aplikasi, Data, dan Integrasi", category: "Teknologi Informasi", keywords: ["aplikasi", "data", "integrasi", "database"] },
  { value: "UM.1.1", label: "UM.1.1 - Tata Naskah Dinas dan Persuratan", category: "Umum", keywords: ["persuratan", "tata naskah dinas", "surat"] },
  { value: "UM.2.1", label: "UM.2.1 - Rumah Tangga Kantor dan Sarpras", category: "Umum", keywords: ["rumah tangga", "sarpras", "inventaris"] },
  { value: "UM.3.1", label: "UM.3.1 - Kearsipan dan Dokumentasi", category: "Umum", keywords: ["arsip", "dokumen", "arsiparis"] },
  { value: "PTSP.1.1", label: "PTSP.1.1 - Layanan PTSP dan Informasi", category: "Layanan", keywords: ["ptsp", "layanan", "informasi"] },
  { value: "YD.1.1", label: "YD.1.1 - Pemeriksaan Berkas dan Administrasi Perkara", category: "Yudisial", keywords: ["perkara", "berkas", "pemeriksaan"] },
];

export const letterClassificationOptions = letterClassificationCatalog.map((item) => ({
  value: item.value,
  label: item.label,
}));

export const letterClassificationLabelOptions = letterClassificationCatalog.map((item) => ({
  value: getClassificationTitle(item),
  label: getClassificationTitle(item),
}));

export function getClassificationOptionByValue(value: string) {
  return letterClassificationCatalog.find((item) => item.value === value) ?? null;
}

export function getClassificationTitle(option: LetterClassificationOption) {
  return option.label.replace(/^[A-Z0-9.]+\s*-\s*/, "").trim();
}

export function getClassificationOptionByTitle(title: string) {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) {
    return null;
  }

  return (
    letterClassificationCatalog.find((item) => getClassificationTitle(item).toLowerCase() === normalizedTitle) ??
    null
  );
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferLetterClassificationFromText(text: string): LetterClassificationMatch | null {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) {
    return null;
  }

  const scoredMatches = letterClassificationCatalog
    .map((option) => {
      const title = getClassificationTitle(option);
      const normalizedCode = normalizeForMatch(option.value);
      const normalizedTitle = normalizeForMatch(title);
      const normalizedCategory = normalizeForMatch(option.category);
      const keywordHits = option.keywords.filter((keyword) =>
        normalizedText.includes(normalizeForMatch(keyword))
      );

      let score = 0;
      if (normalizedCode && normalizedText.includes(normalizedCode)) {
        score += 6;
      }
      if (normalizedTitle && normalizedText.includes(normalizedTitle)) {
        score += 5;
      }
      if (normalizedCategory && normalizedText.includes(normalizedCategory)) {
        score += 2;
      }
      score += keywordHits.length * 2;

      return {
        code: option.value,
        label: option.label,
        title,
        category: option.category,
        keywordHits,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code));

  const bestMatch = scoredMatches[0] ?? null;
  const secondMatch = scoredMatches[1] ?? null;

  if (!bestMatch) {
    return null;
  }

  if (bestMatch.score < 4) {
    return null;
  }

  if (secondMatch && bestMatch.score - secondMatch.score < 2) {
    return null;
  }

  return bestMatch;
}

export function normalizeLetterClassificationDraft(input: {
  kodeKlasifikasi?: string | null;
  klasifikasi?: string | null;
  klasifikasiTags?: string[] | null;
}) {
  const matchedByCode = input.kodeKlasifikasi ? getClassificationOptionByValue(input.kodeKlasifikasi) : null;
  const matchedByTitle = !matchedByCode && input.klasifikasi
    ? getClassificationOptionByTitle(input.klasifikasi)
    : null;
  const matched = matchedByCode ?? matchedByTitle;
  const baseTags = (input.klasifikasiTags ?? []).map((item) => item.trim()).filter(Boolean);

  if (!matched) {
    return {
      kodeKlasifikasi: "",
      klasifikasi: "",
      klasifikasiTags: baseTags.slice(0, 5),
    };
  }

  return {
    kodeKlasifikasi: matched.value,
    klasifikasi: getClassificationTitle(matched),
    klasifikasiTags: Array.from(new Set([matched.label, matched.category, ...baseTags])).slice(0, 5),
  };
}
