import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveJlfVariableQueryPreview, type JlfVariableQueryPreview } from "@/lib/judicia-legal-form-query-preview";
import {
  JLF_SIPP_QUERY_KEYS,
  type JlfSippQueryKey,
} from "@/server/modules/judicia/legal-form/sipp/jlf-sipp-query-registry";
import { detectAllPlaceholders } from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";

import { readAbtTabularFile, type TabularFile } from "./jlf-legacy-abt-xls-dry-run";

export type JlfKabulVerstekVariableStatus = "ready" | "needs_review" | "conflict";

export type JlfKabulVerstekTemplateDryRunInput = {
  templatePath: string;
  generatedPath?: string;
  variableXlsPath: string;
};

export type JlfKabulVerstekPlaceholderFinding = {
  placeholder: string;
  legacyCode: string;
  count: number;
  firstPosition: number;
  contextPreview: string;
};

export type JlfKabulVerstekVariableMapping = {
  placeholder: string;
  legacyCode: string;
  key: string;
  label: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey: string;
  isRequired: boolean;
  status: JlfKabulVerstekVariableStatus;
  metadata: {
    legacySource: string;
    legacyLabel: string;
    legacyDataType: string;
    legacyDataTable: string;
    legacyDataColumn: string;
    legacyDefaultData: string;
    legacySqlPreview: string;
    legacySqlExecutable: false;
    legalKnowledgeBaseRequired: boolean;
  };
  queryPreview: JlfVariableQueryPreview;
  manualOverrideAllowed: boolean;
  maskSensitiveByDefault: boolean;
  warnings: string[];
};

export type JlfKabulVerstekSeedDraft = {
  templates: Array<Record<string, unknown>>;
  templateVersions: Array<Record<string, unknown>>;
  variables: Array<Record<string, unknown>>;
  templateVariables: Array<Record<string, unknown>>;
};

export type JlfKabulVerstekTemplateDryRunReport = {
  mode: "dry-run";
  template: {
    path: string;
    fileName: string;
    checksumSha256: string;
    sizeBytes: number;
    uniqueLegacyPlaceholders: number;
    totalLegacyOccurrences: number;
  };
  generated: {
    path: string | null;
    unresolvedLegacyPlaceholders: number | null;
    unresolvedPlaceholders: string[];
  };
  variablesWorkbook: {
    path: string;
    fileName: string;
    readMethod: TabularFile["readMethod"];
    sheets: string[];
    rows: number;
  };
  totals: {
    placeholdersRead: number;
    placeholderOccurrences: number;
    variablesReady: number;
    variablesNeedsReview: number;
    variablesConflict: number;
    legacySqlFound: number;
    legalReviewRequired: number;
    manualValuesRecommended: number;
  };
  placeholderFindings: JlfKabulVerstekPlaceholderFinding[];
  variableMappings: JlfKabulVerstekVariableMapping[];
  seedDraft: JlfKabulVerstekSeedDraft;
  modernTemplateDraft: string;
  sippQueryRegistry: Array<{ key: JlfSippQueryKey; readOnly: true; rawSqlFromClient: false }>;
  importExecution: {
    executed: false;
    reason: string;
  };
};

const LEGAL_REVIEW_CODES = new Set(["8521", "8522", "8523", "8524", "8526", "8527", "8528", "8529", "8530"]);
const REQUIRED_CODES = new Set(["0001", "0046", "0047", "0053", "0194", "5125", "7047", "7048", "7060", "8008", "8010"]);
const SENSITIVE_CODES = new Set(["5125", "7047", "7048", "1197", "1198", "1199", "1200", "1201", "1202", "1203", "1204", "1205", "1206", "1207", "1208", "1214", "2021", "2022"]);
const MANUAL_RECOMMENDED_TYPES = new Set(["jlf_manual", "jlf_bas_qa", "computed", "function"]);

type Override = {
  key: string;
  label: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey?: string;
  sensitive?: boolean;
};

const CODE_OVERRIDES: Record<string, Override> = {
  "0001": { key: "nomor_perkara", label: "Nomor Perkara", dataType: "text", sourceType: "sipp_perkara", sourceKey: "nomor_perkara" },
  "0017": { key: "tanggal_surat_gugatan", label: "Tanggal Surat Gugatan", dataType: "date", sourceType: "sipp_perkara", sourceKey: "tanggal_surat", transformKey: "tanggal_indonesia_panjang" },
  "0032": { key: "hari_sidang_terpilih", label: "Hari Sidang Terpilih", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "hari_indonesia" },
  "0033": { key: "tanggal_sidang_terpilih", label: "Tanggal Sidang Terpilih", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" },
  "0046": { key: "sebutan_penggugat_pemohon", label: "Sebutan Penggugat/Pemohon", dataType: "text", sourceType: "computed", sourceKey: "penyebutan_pihak1" },
  "0047": { key: "sebutan_tergugat_termohon", label: "Sebutan Tergugat/Termohon", dataType: "text", sourceType: "computed", sourceKey: "penyebutan_pihak2" },
  "0053": { key: "sebutan_gugatan_permohonan", label: "Sebutan Gugatan/Permohonan", dataType: "text", sourceType: "computed", sourceKey: "jenis_gugatan_permohonan" },
  "0132": { key: "tanggal_kuasa_penggugat", label: "Tanggal Kuasa Penggugat/Pemohon", dataType: "date", sourceType: "sipp_perkara", sourceKey: "kuasa.penggugat.1.tanggal_kuasa", transformKey: "tanggal_indonesia_panjang" },
  "0139": { key: "amar_biaya_primer", label: "Amar Biaya Primer", dataType: "long_text", sourceType: "computed", sourceKey: "amar_biaya_primer" },
  "0143": { key: "total_biaya_perkara", label: "Total Biaya Perkara", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "jumlah_biaya", transformKey: "rupiah" },
  "0155": { key: "terbilang_biaya_perkara", label: "Terbilang Biaya Perkara", dataType: "text", sourceType: "function", sourceKey: "total_biaya_perkara", transformKey: "terbilang" },
  "0156": { key: "kantor_kuasa_penggugat", label: "Kantor Kuasa Penggugat/Pemohon", dataType: "text", sourceType: "sipp_perkara", sourceKey: "kuasa.penggugat.1.keterangan" },
  "0194": { key: "jenis_produk_hukum", label: "Jenis Produk Hukum", dataType: "text", sourceType: "computed", sourceKey: "putusan_atau_penetapan" },
  "0222": { key: "awal_konflik_rumah_tangga", label: "Awal Konflik Rumah Tangga", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "awal_konflik_rumah_tangga" },
  "0227": { key: "tanggal_fasakh_murtad", label: "Tanggal Fasakh/Murtad/Meninggalkan Agama", dataType: "manual_date", sourceType: "jlf_manual", sourceKey: "tanggal_fasakh_murtad" },
  "0246": { key: "tanggal_pisah_rumah", label: "Tanggal Pisah Rumah", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "tanggal_pisah_rumah" },
  "0279": { key: "biaya_pendaftaran", label: "Biaya Pendaftaran", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_pendaftaran", transformKey: "rupiah" },
  "0281": { key: "biaya_redaksi", label: "Biaya Redaksi", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_redaksi", transformKey: "rupiah" },
  "0312": { key: "biaya_panggilan_para_pihak", label: "Biaya Panggilan Para Pihak", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_panggilan", transformKey: "rupiah" },
  "0690": { key: "sebutan_majelis_hakim", label: "Sebutan Majelis Hakim/Hakim", dataType: "text", sourceType: "sipp_hakim", sourceKey: "hakim.jabatan" },
  "1197": { key: "nama_saksi_penggugat_1", label: "Nama Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.nama", sensitive: true },
  "1198": { key: "umur_saksi_penggugat_1", label: "Umur Saksi Penggugat 1", dataType: "number", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.umur", sensitive: true },
  "1199": { key: "agama_saksi_penggugat_1", label: "Agama Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.agama", sensitive: true },
  "1200": { key: "pendidikan_saksi_penggugat_1", label: "Pendidikan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.pendidikan", sensitive: true },
  "1201": { key: "pekerjaan_saksi_penggugat_1", label: "Pekerjaan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.pekerjaan", sensitive: true },
  "1202": { key: "alamat_saksi_penggugat_1", label: "Alamat Saksi Penggugat 1", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.alamat", sensitive: true },
  "1203": { key: "nama_saksi_penggugat_2", label: "Nama Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.nama", sensitive: true },
  "1204": { key: "umur_saksi_penggugat_2", label: "Umur Saksi Penggugat 2", dataType: "number", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.umur", sensitive: true },
  "1205": { key: "agama_saksi_penggugat_2", label: "Agama Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.agama", sensitive: true },
  "1206": { key: "pendidikan_saksi_penggugat_2", label: "Pendidikan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.pendidikan", sensitive: true },
  "1207": { key: "pekerjaan_saksi_penggugat_2", label: "Pekerjaan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.pekerjaan", sensitive: true },
  "1208": { key: "alamat_saksi_penggugat_2", label: "Alamat Saksi Penggugat 2", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.alamat", sensitive: true },
  "1214": { key: "daftar_bukti_surat", label: "Daftar Bukti Surat", dataType: "long_text", sourceType: "jlf_manual", sourceKey: "daftar_bukti_surat", sensitive: true },
  "1241": { key: "hubungan_saksi_penggugat_1", label: "Hubungan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.keterangan", sensitive: true },
  "1242": { key: "hubungan_saksi_penggugat_2", label: "Hubungan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.keterangan", sensitive: true },
  "2021": { key: "keterangan_saksi_penggugat_1", label: "Keterangan Saksi Penggugat 1", dataType: "long_text", sourceType: "jlf_bas_qa", sourceKey: "saksi.penggugat.1.keterangan", sensitive: true },
  "2022": { key: "keterangan_saksi_penggugat_2", label: "Keterangan Saksi Penggugat 2", dataType: "long_text", sourceType: "jlf_bas_qa", sourceKey: "saksi.penggugat.2.keterangan", sensitive: true },
  "4001": { key: "amar_putusan_perceraian", label: "Amar Putusan Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "amar_putusan_perceraian", transformKey: "sanitize_document_text" },
  "5125": { key: "posita_lengkap", label: "Posita Lengkap", dataType: "long_text", sourceType: "sipp_perkara", sourceKey: "posita", transformKey: "sanitize_document_text", sensitive: true },
  "5223": { key: "biaya_meterai", label: "Biaya Meterai", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_meterai", transformKey: "rupiah" },
  "6060": { key: "biaya_proses", label: "Biaya Proses", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_proses", transformKey: "rupiah" },
  "7047": { key: "identitas_penggugat_lengkap", label: "Identitas Penggugat Lengkap", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "penggugat.1.identitas_lengkap", transformKey: "alamat_lengkap", sensitive: true },
  "7048": { key: "identitas_tergugat_lengkap", label: "Identitas Tergugat Lengkap", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "tergugat.1.identitas_lengkap", transformKey: "alamat_lengkap", sensitive: true },
  "7060": { key: "jenis_perkara_terurai", label: "Jenis Perkara Terurai", dataType: "text", sourceType: "sipp_perkara", sourceKey: "jenis_perkara_nama" },
  "7095": { key: "penanda_rupiah_atau_nihil", label: "Penanda Rupiah/Nihil", dataType: "text", sourceType: "computed", sourceKey: "penanda_rupiah_nihil" },
  "8004": { key: "nama_panitera_satker", label: "Nama Panitera Satker", dataType: "text", sourceType: "sipp_perkara", sourceKey: "satker.panitera" },
  "8008": { key: "nama_satker", label: "Nama Satker", dataType: "text", sourceType: "sipp_perkara", sourceKey: "satker.nama_satker" },
  "8010": { key: "nama_satker_huruf_besar", label: "Nama Satker Huruf Besar", dataType: "text", sourceType: "sipp_perkara", sourceKey: "satker.nama_satker_huruf_besar", transformKey: "uppercase" },
  "8184": { key: "tanggal_sidang_hijriah", label: "Tanggal Sidang Hijriah", dataType: "date", sourceType: "computed", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "tanggal_hijriah" },
  "8500": { key: "blok_tanda_tangan_majelis", label: "Blok Tanda Tangan Majelis", dataType: "long_text", sourceType: "computed", sourceKey: "blok_tanda_tangan_majelis" },
  "8505": { key: "amar_biaya_perkara", label: "Amar Biaya Perkara", dataType: "long_text", sourceType: "computed", sourceKey: "amar_biaya_perkara" },
  "8521": { key: "pertimbangan_fakta_hukum_perceraian", label: "Pertimbangan Fakta Hukum Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_fakta_hukum_perceraian" },
  "8522": { key: "pertimbangan_petitum_berdasarkan_fakta", label: "Pertimbangan Petitum Berdasarkan Fakta", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_petitum_berdasarkan_fakta" },
  "8523": { key: "pertimbangan_hukum_kuasa", label: "Pertimbangan Hukum Kuasa", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_hukum_kuasa" },
  "8524": { key: "pertimbangan_hukum_pns_bumn_bumd_tni_polri", label: "Pertimbangan Hukum PNS/BUMN/BUMD/TNI/POLRI", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_hukum_pekerjaan_khusus" },
  "8526": { key: "pertimbangan_verstek_ghaib", label: "Pertimbangan Verstek/Ghaib", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_verstek_ghaib" },
  "8527": { key: "pertimbangan_biaya_prodeo", label: "Pertimbangan Biaya Prodeo", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_biaya_prodeo" },
  "8528": { key: "pertimbangan_saksi_perceraian_verstek", label: "Pertimbangan Saksi Perceraian Verstek", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_saksi_perceraian_verstek" },
  "8529": { key: "pertimbangan_bukti_surat_verstek", label: "Pertimbangan Bukti Surat Verstek", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_bukti_surat_verstek" },
  "8530": { key: "pertimbangan_pokok_perceraian", label: "Pertimbangan Pokok Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_pokok_perceraian" },
  "9944": { key: "lama_pisah_rumah", label: "Lama Pisah Rumah", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "lama_pisah_rumah" },
};

export const KABUL_VERSTEK_MODERN_TEMPLATE_DRAFT = `PUTUSAN
Nomor {{nomor_perkara}}

{{nama_satker_huruf_besar}}

Dalam perkara {{jenis_perkara_terurai}} antara:

{{identitas_penggugat_lengkap}}

melawan

{{identitas_tergugat_lengkap}}

DUDUK PERKARA
Bahwa {{sebutan_penggugat_pemohon}} dalam surat {{sebutan_gugatan_permohonan}} tanggal {{tanggal_surat_gugatan}} telah mendaftarkan perkara di {{nama_satker}} dengan register Nomor {{nomor_perkara}}.

{{posita_lengkap}}

PEMBUKTIAN
{{daftar_bukti_surat}}

Saksi:
1. {{nama_saksi_penggugat_1}}, umur {{umur_saksi_penggugat_1}} tahun, agama {{agama_saksi_penggugat_1}}, pekerjaan {{pekerjaan_saksi_penggugat_1}}, bertempat tinggal di {{alamat_saksi_penggugat_1}}.
{{keterangan_saksi_penggugat_1}}

2. {{nama_saksi_penggugat_2}}, umur {{umur_saksi_penggugat_2}} tahun, agama {{agama_saksi_penggugat_2}}, pekerjaan {{pekerjaan_saksi_penggugat_2}}, bertempat tinggal di {{alamat_saksi_penggugat_2}}.
{{keterangan_saksi_penggugat_2}}

PERTIMBANGAN HUKUM
{{pertimbangan_verstek_ghaib}}
{{pertimbangan_bukti_surat_verstek}}
{{pertimbangan_saksi_perceraian_verstek}}
{{pertimbangan_pokok_perceraian}}

MENGADILI
{{amar_putusan_perceraian}}
{{amar_biaya_perkara}}

Biaya perkara sejumlah {{total_biaya_perkara}} ({{terbilang_biaya_perkara}}).

Diputus pada hari {{hari_sidang_terpilih}}, tanggal {{tanggal_sidang_terpilih}} oleh {{sebutan_majelis_hakim}} dengan dibantu Panitera Pengganti.
`;

function normalizeLegacyCode(value: unknown) {
  const digits = String(value ?? "").replace(/^#|#$/g, "").match(/\d{1,5}/)?.[0] ?? "";
  return digits.length <= 4 ? digits.padStart(4, "0") : digits;
}

function normalizeSemanticKey(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/#(\d{4})#/g, " legacy_$1 ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 110);
  return normalized || fallback;
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function redactPreview(value: string, limit = 500) {
  return value
    .replace(/\b\d{16}\b/g, "[NIK]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function decodeRtfForContext(value: string) {
  return value
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\[a-zA-Z]+-?\d* ?|\\./g, "")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function findLegacyPlaceholders(content: string): JlfKabulVerstekPlaceholderFinding[] {
  const occurrences = Array.from(content.matchAll(/#\d{4}#/g));
  const grouped = new Map<string, JlfKabulVerstekPlaceholderFinding>();

  for (const match of occurrences) {
    const placeholder = match[0];
    const position = match.index ?? 0;
    const existing = grouped.get(placeholder);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const context = content.slice(Math.max(0, position - 140), Math.min(content.length, position + 140));
    grouped.set(placeholder, {
      placeholder,
      legacyCode: placeholder.replace(/#/g, ""),
      count: 1,
      firstPosition: position,
      contextPreview: decodeRtfForContext(context),
    });
  }

  return Array.from(grouped.values()).sort((left, right) => left.firstPosition - right.firstPosition);
}

function inferByLegacyRow(row: Record<string, string>, legacyCode: string): Override {
  const dataType = cleanCell(row.data_type).toLowerCase();
  const table = cleanCell(row.data_tabel);
  const column = cleanCell(row.data_kolom);
  const label = cleanCell(row.nama) || `Variabel ${legacyCode}`;
  const fallbackKey = `legacy_${legacyCode}`;

  if (dataType === "data_teks") {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "manual_text", sourceType: "jlf_manual", sourceKey: normalizeSemanticKey(label, fallbackKey) };
  }
  if (dataType === "data_tanggal") {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "manual_date", sourceType: "jlf_manual", sourceKey: normalizeSemanticKey(label, fallbackKey), transformKey: "tanggal_indonesia_panjang" };
  }
  if (dataType === "multi_sidang") {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" };
  }
  if (dataType === "tanya_jawab") {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "long_text", sourceType: "jlf_bas_qa", sourceKey: normalizeSemanticKey(label, fallbackKey), transformKey: "bas_qa_section" };
  }
  if (dataType === "qrcode") {
    return { key: "qr_perkara", label, dataType: "qrcode", sourceType: "qrcode", sourceKey: "case_verification_payload", transformKey: "format_qr_payload" };
  }
  if (dataType === "terbilang") {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "function", sourceKey: cleanCell(row.referensi), transformKey: "terbilang" };
  }
  if (table.includes("pihak")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_pihak", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("jadwal_sidang")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("hakim")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_hakim", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("panitera")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_panitera", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("jurusita")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_jurusita", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("putusan")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_putusan", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("biaya")) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "currency", sourceType: "sipp_keuangan", sourceKey: [table, column].filter(Boolean).join(".") };
  }
  if (table.includes("perkara") && column) {
    return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: "sipp_perkara", sourceKey: column };
  }

  return { key: normalizeSemanticKey(label, fallbackKey), label, dataType: "text", sourceType: dataType === "data_sql" ? "function" : "jlf_manual", sourceKey: normalizeSemanticKey(label, fallbackKey), transformKey: dataType === "data_sql" ? "legacy_sql_needs_review" : "" };
}

function rowSignature(row: Record<string, string>) {
  return [
    cleanCell(row.nama),
    cleanCell(row.data_type),
    cleanCell(row.data_tabel),
    cleanCell(row.data_kolom),
    cleanCell(row.default_data),
    cleanCell(row.sql_query),
  ].join("|");
}

function isSensitive(legacyCode: string, inferred: Override) {
  return Boolean(inferred.sensitive) || SENSITIVE_CODES.has(legacyCode) || /identitas|alamat|nik|saksi|posita|bukti|keterangan/i.test(inferred.key);
}

function isManualRecommended(mapping: Pick<JlfKabulVerstekVariableMapping, "sourceType" | "status">) {
  return mapping.status !== "ready" || MANUAL_RECOMMENDED_TYPES.has(mapping.sourceType);
}

async function readVariableRows(variableXlsPath: string) {
  const workbook = await readAbtTabularFile(variableXlsPath);
  const rows = workbook.sheets.flatMap((sheet) => sheet.rows);
  return { workbook, rows };
}

function groupRowsByLegacyCode(rows: Record<string, string>[]) {
  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const legacyCode = normalizeLegacyCode(row.no_var);
    if (!legacyCode) continue;
    const current = grouped.get(legacyCode) ?? [];
    current.push(row);
    grouped.set(legacyCode, current);
  }
  return grouped;
}

function buildMapping(finding: JlfKabulVerstekPlaceholderFinding, rows: Record<string, string>[]): JlfKabulVerstekVariableMapping {
  const legacyCode = finding.legacyCode;
  const row = rows[0] ?? {};
  const override = CODE_OVERRIDES[legacyCode];
  const inferred = override ?? inferByLegacyRow(row, legacyCode);
  const distinct = new Set(rows.map(rowSignature));
  const sqlPreview = redactPreview(rows.map((item) => cleanCell(item.sql_query)).find(Boolean) ?? "");
  const legacyDataType = cleanCell(row.data_type);
  const warnings: string[] = [];
  let status: JlfKabulVerstekVariableStatus = "ready";

  if (rows.length === 0) {
    status = "needs_review";
    warnings.push("Mapping legacy tidak ditemukan di abt_variabel.xls.");
  }
  if (distinct.size > 1) {
    status = "conflict";
    warnings.push("legacy_code memiliki lebih dari satu definisi di abt_variabel.xls; gunakan legacy_source + legacy_code.");
  }
  if (sqlPreview || legacyDataType === "data_sql") {
    status = status === "conflict" ? "conflict" : "needs_review";
    warnings.push("Raw SQL ABT hanya disimpan sebagai preview needs_review dan tidak boleh dijalankan otomatis.");
  }
  if (LEGAL_REVIEW_CODES.has(legacyCode)) {
    status = status === "conflict" ? "conflict" : "needs_review";
    warnings.push("Narasi pertimbangan hukum wajib ditautkan ke Legal Knowledge Base dan divalidasi manusia.");
  }

  const queryPreview = resolveJlfVariableQueryPreview({
    sourceType: inferred.sourceType,
    sourceKey: inferred.sourceKey,
    key: inferred.key,
    adminNote: warnings.join(" "),
  });

  const mapping: JlfKabulVerstekVariableMapping = {
    placeholder: finding.placeholder,
    legacyCode,
    key: inferred.key,
    label: inferred.label,
    dataType: inferred.dataType,
    sourceType: inferred.sourceType,
    sourceKey: inferred.sourceKey,
    transformKey: inferred.transformKey ?? "",
    isRequired: REQUIRED_CODES.has(legacyCode),
    status,
    metadata: {
      legacySource: "abt_variabel.xls",
      legacyLabel: cleanCell(row.nama),
      legacyDataType,
      legacyDataTable: cleanCell(row.data_tabel),
      legacyDataColumn: cleanCell(row.data_kolom),
      legacyDefaultData: cleanCell(row.default_data),
      legacySqlPreview: sqlPreview,
      legacySqlExecutable: false,
      legalKnowledgeBaseRequired: LEGAL_REVIEW_CODES.has(legacyCode),
    },
    queryPreview,
    manualOverrideAllowed: true,
    maskSensitiveByDefault: isSensitive(legacyCode, inferred),
    warnings,
  };

  mapping.manualOverrideAllowed = isManualRecommended(mapping);
  return mapping;
}

function buildSeedDraft(input: JlfKabulVerstekTemplateDryRunInput, mappings: JlfKabulVerstekVariableMapping[], templateChecksum: string): JlfKabulVerstekSeedDraft {
  const templateId = "jlf-template-kabul-verstek-cerai-format-lengkap";
  const versionId = "jlf-template-version-kabul-verstek-modern-draft-1";
  const now = "2026-05-25T00:00:00.000Z";

  return {
    templates: [
      {
        id: templateId,
        category_slug: "putusan-penetapan",
        name: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
        slug: "kabul-verstek-cerai-format-lengkap",
        description: "Draft template modern JLF dari blangko ABT legacy. Raw SQL ABT tidak diaktifkan.",
        document_type: "putusan",
        file_type: "rtf",
        status: "draft",
        requires_validation: true,
        supports_ai: true,
        supports_whatsapp_notification: false,
        created_at: now,
      },
    ],
    templateVersions: [
      {
        id: versionId,
        template_id: templateId,
        version_number: 1,
        storage_path: null,
        legacy_template_path: input.templatePath,
        checksum: templateChecksum,
        detected_placeholders: mappings.map((mapping) => mapping.placeholder),
        change_note: "Dry-run import dari ABT Kabul Verstek Cerai; perlu review admin sebelum import final.",
        created_at: now,
      },
    ],
    variables: mappings.map((mapping) => ({
      id: `jlf-var-kabul-verstek-${mapping.key}`,
      legacy_code: mapping.legacyCode,
      key: mapping.key,
      label: mapping.label,
      data_type: mapping.dataType,
      source_type: mapping.sourceType,
      source_key: mapping.sourceKey,
      transform_key: mapping.transformKey,
      fallback_value: mapping.metadata.legacyDefaultData && mapping.status === "ready" ? mapping.metadata.legacyDefaultData : "",
      is_required: mapping.isRequired,
      is_active: true,
      admin_note: mapping.warnings.join(" "),
      metadata: mapping.metadata,
    })),
    templateVariables: mappings.flatMap((mapping, index) => [
      {
        template_id: templateId,
        variable_id: `jlf-var-kabul-verstek-${mapping.key}`,
        placeholder: mapping.placeholder,
        is_required: mapping.isRequired,
        sort_order: index + 1,
      },
      {
        template_id: templateId,
        variable_id: `jlf-var-kabul-verstek-${mapping.key}`,
        placeholder: `{{${mapping.key}}}`,
        is_required: mapping.isRequired,
        sort_order: index + 1,
      },
    ]),
  };
}

export async function buildJlfKabulVerstekTemplateDryRunReport(
  input: JlfKabulVerstekTemplateDryRunInput
): Promise<JlfKabulVerstekTemplateDryRunReport> {
  const templateBuffer = await readFile(input.templatePath);
  const templateContent = templateBuffer.toString("latin1");
  const findings = findLegacyPlaceholders(templateContent);
  const allPlaceholders = detectAllPlaceholders(templateContent);
  const generatedContent = input.generatedPath ? (await readFile(input.generatedPath)).toString("latin1") : "";
  const unresolved = input.generatedPath ? findLegacyPlaceholders(generatedContent).map((item) => item.placeholder) : [];
  const variableData = await readVariableRows(input.variableXlsPath);
  const rowsByCode = groupRowsByLegacyCode(variableData.rows);
  const mappings = findings.map((finding) => buildMapping(finding, rowsByCode.get(finding.legacyCode) ?? []));
  const templateChecksum = checksum(templateBuffer);

  return {
    mode: "dry-run",
    template: {
      path: input.templatePath,
      fileName: path.basename(input.templatePath),
      checksumSha256: templateChecksum,
      sizeBytes: templateBuffer.byteLength,
      uniqueLegacyPlaceholders: findings.length,
      totalLegacyOccurrences: findings.reduce((sum, item) => sum + item.count, 0),
    },
    generated: {
      path: input.generatedPath ?? null,
      unresolvedLegacyPlaceholders: input.generatedPath ? unresolved.length : null,
      unresolvedPlaceholders: Array.from(new Set(unresolved)).sort(),
    },
    variablesWorkbook: {
      path: input.variableXlsPath,
      fileName: path.basename(input.variableXlsPath),
      readMethod: variableData.workbook.readMethod,
      sheets: variableData.workbook.sheets.map((sheet) => sheet.name),
      rows: variableData.rows.length,
    },
    totals: {
      placeholdersRead: findings.length,
      placeholderOccurrences: allPlaceholders.reduce((sum, item) => sum + item.count, 0),
      variablesReady: mappings.filter((item) => item.status === "ready").length,
      variablesNeedsReview: mappings.filter((item) => item.status === "needs_review").length,
      variablesConflict: mappings.filter((item) => item.status === "conflict").length,
      legacySqlFound: mappings.filter((item) => item.metadata.legacySqlPreview).length,
      legalReviewRequired: mappings.filter((item) => item.metadata.legalKnowledgeBaseRequired).length,
      manualValuesRecommended: mappings.filter(isManualRecommended).length,
    },
    placeholderFindings: findings,
    variableMappings: mappings,
    seedDraft: buildSeedDraft(input, mappings, templateChecksum),
    modernTemplateDraft: KABUL_VERSTEK_MODERN_TEMPLATE_DRAFT,
    sippQueryRegistry: JLF_SIPP_QUERY_KEYS.map((key) => ({ key, readOnly: true, rawSqlFromClient: false })),
    importExecution: {
      executed: false,
      reason: "Dry-run only. Template RTF dan XLS ABT hanya dibaca; tidak ada write DB, tidak ada SQL legacy yang dijalankan, dan SIPP tetap melalui adapter/query registry.",
    },
  };
}

export function formatJlfKabulVerstekTemplateDryRunMarkdown(report: JlfKabulVerstekTemplateDryRunReport) {
  const lines = [
    "# JLF Kabul Verstek Cerai Template Dry-run",
    "",
    `- Template: ${report.template.fileName}`,
    `- Placeholder unik: ${report.template.uniqueLegacyPlaceholders}`,
    `- Kemunculan placeholder: ${report.template.totalLegacyOccurrences}`,
    `- Unresolved pada hasil generate: ${report.generated.unresolvedLegacyPlaceholders ?? "n/a"}`,
    `- Variabel ready: ${report.totals.variablesReady}`,
    `- Variabel needs_review: ${report.totals.variablesNeedsReview}`,
    `- Variabel conflict: ${report.totals.variablesConflict}`,
    `- Raw SQL legacy ditemukan: ${report.totals.legacySqlFound}`,
    `- Legal review required: ${report.totals.legalReviewRequired}`,
    "",
    "## Import Execution",
    "",
    report.importExecution.reason,
    "",
    "## Review Notes",
    "",
    "- Semua legacy_sql_preview hanya bahan audit admin, bukan query aktif.",
    "- Placeholder pertimbangan hukum #8521# sampai #8530# wajib direview dan ditautkan ke Legal Knowledge Base.",
    "- Data sensitif dimasking di preview kecuali user punya permission.",
  ];

  return `${lines.join("\n")}\n`;
}
