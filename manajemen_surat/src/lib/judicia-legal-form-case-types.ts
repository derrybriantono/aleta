export type JlfCaseNumberCode = "Pdt.G" | "Pdt.GS" | "Pdt.P" | "Pdt.Eks" | "Jn";

export type JlfCaseTypeOption = {
  value: string;
  label: string;
  code: JlfCaseNumberCode;
  aliases?: string[];
};

export type JlfCaseTypeGroup = {
  label: string;
  options: JlfCaseTypeOption[];
};

export const JLF_CASE_NUMBER_CODE_OPTIONS: Array<{ value: JlfCaseNumberCode; label: string }> = [
  { value: "Pdt.G", label: "Pdt.G" },
  { value: "Pdt.GS", label: "Pdt.GS (Gugatan Sederhana)" },
  { value: "Pdt.P", label: "Pdt.P" },
  { value: "Pdt.Eks", label: "Pdt.Eks" },
  { value: "Jn", label: "Jn" },
];

export const JLF_CASE_TYPE_GROUPS: JlfCaseTypeGroup[] = [
  {
    label: "Perkawinan - Gugatan",
    options: [
      { value: "Cerai Gugat", label: "Cerai Gugat", code: "Pdt.G", aliases: ["Gugat Cerai"] },
      { value: "Cerai Talak", label: "Cerai Talak", code: "Pdt.G" },
      { value: "Izin Poligami", label: "Izin Poligami", code: "Pdt.G" },
      { value: "Pembatalan Perkawinan", label: "Pembatalan Perkawinan", code: "Pdt.G", aliases: ["Pembatalan Nikah"] },
      { value: "Pencegahan Perkawinan", label: "Pencegahan Perkawinan", code: "Pdt.G" },
      { value: "Penolakan Perkawinan oleh PPN", label: "Penolakan Perkawinan oleh PPN", code: "Pdt.G" },
      { value: "Kelalaian Kewajiban Suami/Istri", label: "Kelalaian Kewajiban Suami/Istri", code: "Pdt.G" },
    ],
  },
  {
    label: "Perkawinan - Permohonan",
    options: [
      { value: "Itsbat Nikah", label: "Itsbat Nikah", code: "Pdt.P", aliases: ["Isbat Nikah", "Pengesahan Nikah"] },
      { value: "Pengesahan Perkawinan", label: "Pengesahan Perkawinan", code: "Pdt.P", aliases: ["Pengesahan Nikah"] },
      { value: "Dispensasi Kawin", label: "Dispensasi Kawin", code: "Pdt.P", aliases: ["Dispensasi Nikah"] },
      { value: "Wali Adhal", label: "Wali Adhal", code: "Pdt.P" },
      { value: "Izin Kawin", label: "Izin Kawin", code: "Pdt.P" },
      { value: "Asal Usul Anak", label: "Asal Usul Anak", code: "Pdt.P" },
      { value: "Pengesahan Anak", label: "Pengesahan Anak", code: "Pdt.P" },
      { value: "Pengangkatan Anak", label: "Pengangkatan Anak", code: "Pdt.P" },
    ],
  },
  {
    label: "Anak, Nafkah, dan Perwalian",
    options: [
      { value: "Hadhanah", label: "Hadhanah / Hak Asuh Anak", code: "Pdt.G", aliases: ["Hak Asuh Anak", "Pemeliharaan Anak", "Penguasaan Anak"] },
      { value: "Nafkah Anak", label: "Nafkah Anak", code: "Pdt.G" },
      { value: "Nafkah Iddah/Mutah/Madhiyah", label: "Nafkah Iddah, Mutah, dan Madhiyah", code: "Pdt.G", aliases: ["Nafkah Iddah", "Mutah", "Nafkah Madhiyah"] },
      { value: "Pencabutan Kekuasaan Orang Tua", label: "Pencabutan Kekuasaan Orang Tua", code: "Pdt.G" },
      { value: "Perwalian", label: "Perwalian", code: "Pdt.P" },
      { value: "Pencabutan Kekuasaan Wali", label: "Pencabutan Kekuasaan Wali", code: "Pdt.G" },
      { value: "Penunjukan Wali", label: "Penunjukan Wali", code: "Pdt.P" },
      { value: "Pengampuan", label: "Pengampuan", code: "Pdt.P" },
    ],
  },
  {
    label: "Kewarisan dan Harta",
    options: [
      { value: "Waris", label: "Waris", code: "Pdt.G", aliases: ["Gugatan Waris", "Faraidh"] },
      { value: "Penetapan Ahli Waris", label: "Penetapan Ahli Waris", code: "Pdt.P" },
      { value: "Harta Bersama", label: "Harta Bersama", code: "Pdt.G" },
      { value: "Wasiat", label: "Wasiat", code: "Pdt.G" },
      { value: "Hibah", label: "Hibah", code: "Pdt.G" },
      { value: "Wakaf", label: "Wakaf", code: "Pdt.G" },
      { value: "Zakat", label: "Zakat", code: "Pdt.G" },
      { value: "Infak/Sedekah", label: "Infak/Sedekah", code: "Pdt.G", aliases: ["Infaq", "Shadaqah", "Sedekah"] },
    ],
  },
  {
    label: "Ekonomi Syariah",
    options: [
      { value: "Ekonomi Syariah", label: "Ekonomi Syariah", code: "Pdt.G" },
      { value: "Gugatan Sederhana", label: "Gugatan Sederhana", code: "Pdt.GS", aliases: ["Gugatan Sederhana Ekonomi Syariah"] },
      { value: "Perbankan Syariah", label: "Perbankan Syariah", code: "Pdt.G" },
      { value: "Pembiayaan Syariah", label: "Pembiayaan Syariah", code: "Pdt.G" },
      { value: "Asuransi Syariah", label: "Asuransi Syariah", code: "Pdt.G" },
      { value: "Lembaga Keuangan Syariah", label: "Lembaga Keuangan Syariah", code: "Pdt.G" },
    ],
  },
  {
    label: "Permohonan dan Administrasi Lain",
    options: [
      { value: "Mafqud/Orang Hilang", label: "Mafqud / Orang Hilang", code: "Pdt.P", aliases: ["Mafqud", "Orang Hilang"] },
      { value: "Isbat Kesaksian Rukyatul Hilal", label: "Isbat Kesaksian Rukyatul Hilal", code: "Pdt.P", aliases: ["Rukyatul Hilal", "Rukyat Hilal"] },
      { value: "Perubahan Biodata Akta Nikah", label: "Perubahan Biodata Akta Nikah", code: "Pdt.P" },
      { value: "Duplikat Akta Nikah", label: "Duplikat Akta Nikah", code: "Pdt.P" },
      { value: "Permohonan Lain-lain", label: "Permohonan Lain-lain", code: "Pdt.P" },
    ],
  },
  {
    label: "Eksekusi",
    options: [
      { value: "Permohonan Eksekusi", label: "Permohonan Eksekusi", code: "Pdt.Eks", aliases: ["Eksekusi"] },
      { value: "Eksekusi Putusan", label: "Eksekusi Putusan", code: "Pdt.Eks" },
      { value: "Aanmaning", label: "Aanmaning", code: "Pdt.Eks" },
    ],
  },
  {
    label: "Jinayat / Mahkamah Syariyah",
    options: [
      { value: "Jinayat", label: "Jinayat", code: "Jn" },
      { value: "Khamar", label: "Khamar", code: "Jn" },
      { value: "Maisir", label: "Maisir", code: "Jn" },
      { value: "Khalwat", label: "Khalwat", code: "Jn" },
      { value: "Ikhtilath", label: "Ikhtilath", code: "Jn" },
      { value: "Zina", label: "Zina", code: "Jn" },
      { value: "Qadzaf", label: "Qadzaf", code: "Jn" },
      { value: "Pelecehan Seksual", label: "Pelecehan Seksual", code: "Jn" },
      { value: "Pemerkosaan", label: "Pemerkosaan", code: "Jn" },
      { value: "Liwath/Musahaqah", label: "Liwath / Musahaqah", code: "Jn", aliases: ["Liwath", "Musahaqah"] },
    ],
  },
];

export const JLF_CASE_TYPE_OPTIONS = JLF_CASE_TYPE_GROUPS.flatMap((group) => group.options);

function normalizeCaseType(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function optionTerms(option: JlfCaseTypeOption) {
  return [option.value, option.label, ...(option.aliases ?? [])].map(normalizeCaseType).filter(Boolean);
}

export function findJlfCaseTypeOption(value: unknown) {
  const normalized = normalizeCaseType(value);
  if (!normalized) return undefined;
  const candidates = JLF_CASE_TYPE_OPTIONS.flatMap((option) => optionTerms(option).map((term) => ({ option, term })));
  const exact = candidates.find(({ term }) => term === normalized);
  if (exact) return exact.option;
  return candidates
    .filter(({ term }) => term.includes(normalized) || normalized.includes(term))
    .sort((left, right) => right.term.length - left.term.length)[0]?.option;
}

export function inferJlfCaseNumberCode(caseType: unknown): JlfCaseNumberCode {
  const matched = findJlfCaseTypeOption(caseType);
  if (matched) return matched.code;

  const normalized = normalizeCaseType(caseType);
  if (/(gugatan sederhana)/.test(normalized)) return "Pdt.GS";
  if (/(jinayat|khamar|maisir|khalwat|ikhtilath|zina|qadzaf|pemerkosaan|liwath|musahaqah)/.test(normalized)) return "Jn";
  if (/(eksekusi|aanmaning)/.test(normalized)) return "Pdt.Eks";
  if (/(permohonan|itsbat|isbat|pengesahan|dispensasi|wali adhal|izin kawin|asal usul|pengangkatan|penetapan|perwalian|pengampuan|mafqud|hilal)/.test(normalized)) {
    return "Pdt.P";
  }
  return "Pdt.G";
}

export function jlfCaseTypeMatches(actualCaseType: unknown, selectedCaseType: unknown) {
  const selected = normalizeCaseType(selectedCaseType);
  if (!selected) return true;

  const actual = normalizeCaseType(actualCaseType);
  if (!actual) return false;
  if (actual.includes(selected) || selected.includes(actual)) return true;

  const option = findJlfCaseTypeOption(selectedCaseType);
  return Boolean(option && optionTerms(option).some((term) => actual.includes(term) || term.includes(actual)));
}
