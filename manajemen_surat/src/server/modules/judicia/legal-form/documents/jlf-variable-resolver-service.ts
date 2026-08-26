import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { resolveJlfFieldMode, resolveLegacyAbtType } from "@/lib/judicia-legal-form-abt";
import {
  buildJlfHearingContext,
  formatJlfHearingTimeline,
  readJlfHearingField,
} from "@/lib/judicia-legal-form-hearings";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import { renderBasQaTemplateSection } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import {
  detectAllPlaceholders,
  normalizePlaceholder,
  type JlfDetectedPlaceholder,
} from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";
import { readStoredJlfTemplateFile } from "@/server/shared/jlf-template-storage";
import { applyJlfTransform, stringifyValueForDocument } from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";
import { getManualValueForVariable, saveManualValue } from "@/server/modules/judicia/legal-form/documents/jlf-manual-values-service";
import { maskNomorPerkara } from "@/server/modules/judicia/legal-form/verification/jlf-qr-code-service";

type TemplateVariableResolverRow = QueryResultRow & {
  template_variable_id: string;
  template_id: string;
  variable_id: string;
  placeholder: string;
  mapping_required: boolean | number;
  sort_order: number;
  legacy_code: string | null;
  key: string;
  label: string;
  description: string;
  data_type: string;
  source_type: string;
  source_key: string;
  transform_key: string;
  fallback_value: string;
  sipp_query_preview: string;
  legacy_abt_type: string;
  field_mode: string;
  ai_enabled: boolean | number;
  manual_override_allowed: boolean | number;
  variable_required: boolean | number;
  example_value: string;
};

type TemplateVersionRow = QueryResultRow & {
  id: string;
  storage_path: string;
  version_number: number;
};

type VariableRegistryRow = QueryResultRow & {
  variable_id: string;
  legacy_code: string | null;
  key: string;
  label: string;
  description: string;
  data_type: string;
  source_type: string;
  source_key: string;
  transform_key: string;
  fallback_value: string;
  sipp_query_preview: string;
  legacy_abt_type: string;
  field_mode: string;
  ai_enabled: boolean | number;
  manual_override_allowed: boolean | number;
  variable_required: boolean | number;
  example_value: string;
};

type LegacyAutoDefinition = {
  key: string;
  label: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey?: string;
  fallbackValue?: string;
};

export const LEGACY_AUTO_DEFINITIONS: Record<string, LegacyAutoDefinition> = {
  "0017": { key: "tanggal_surat_gugatan_permohonan", label: "Tanggal Surat Gugatan/Permohonan", dataType: "date", sourceType: "sipp_perkara", sourceKey: "tanggal_surat", transformKey: "tanggal_indonesia_panjang" },
  "0032": { key: "hari_sidang_terpilih", label: "Hari Sidang Terpilih", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "hari_indonesia" },
  "0033": { key: "tanggal_sidang_terpilih", label: "Tanggal Sidang Terpilih", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" },
  "0041": { key: "agenda_sidang_sebelumnya", label: "Agenda Sidang Sebelumnya", dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.sebelumnya.agenda" },
  "0046": { key: "sebutan_penggugat_pemohon", label: "Sebutan Penggugat/Pemohon", dataType: "text", sourceType: "computed", sourceKey: "penyebutan_pihak1" },
  "0047": { key: "sebutan_tergugat_termohon", label: "Sebutan Tergugat/Termohon", dataType: "text", sourceType: "computed", sourceKey: "penyebutan_pihak2" },
  "0050": { key: "persidangan_ke", label: "Persidangan ke-", dataType: "number", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.urutan" },
  "0053": { key: "permohonan_gugatan", label: "Permohonan/Gugatan", dataType: "text", sourceType: "computed", sourceKey: "jenis_gugatan_permohonan" },
  "0076": { key: "alasan_tunda_sidang_sebelumnya", label: "Alasan Tunda Sidang Sebelumnya", dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.sebelumnya.alasan_ditunda" },
  "0079": { key: "alasan_tunda_sidang", label: "Alasan Tunda", dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.alasan_ditunda" },
  "0090": { key: "dihadiri_oleh", label: "Dihadiri oleh", dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.dihadiri_oleh" },
  "0132": { key: "tanggal_kuasa_penggugat", label: "Tanggal Kuasa Penggugat/Pemohon", dataType: "manual_date", sourceType: "jlf_manual", sourceKey: "tanggal_kuasa_penggugat" },
  "0133": { key: "hari_tunda_sidang", label: "Hari Tunda Sidang", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_ditunda", transformKey: "hari_indonesia" },
  "0134": { key: "tanggal_sidang_tunda", label: "Tgl Sidang Tunda", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.tanggal_ditunda", transformKey: "tanggal_indonesia_panjang" },
  "0139": { key: "amar_biaya_primer", label: "Amar Biaya Primer", dataType: "long_text", sourceType: "computed", sourceKey: "amar_biaya_primer" },
  "0143": { key: "total_biaya_perkara", label: "Total Biaya Perkara", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "jumlah_biaya", transformKey: "rupiah" },
  "0155": { key: "terbilang_biaya_perkara", label: "Terbilang Biaya Perkara", dataType: "text", sourceType: "function", sourceKey: "total_biaya_perkara", transformKey: "terbilang" },
  "0156": { key: "kantor_kuasa_penggugat", label: "Kantor Kuasa Penggugat/Pemohon", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "kantor_kuasa_penggugat" },
  "0163": { key: "ruang_sidang", label: "Ruang Sidang", dataType: "text", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.terpilih.ruangan" },
  "0193": { key: "tanggal_sidang_ii", label: "Tgl. Sidang II", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.urutan.2.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" },
  "0194": { key: "jenis_produk_hukum", label: "Jenis Produk Hukum", dataType: "text", sourceType: "computed", sourceKey: "putusan_atau_penetapan" },
  "0196": { key: "tanggal_sidang_iii", label: "Tgl. Sidang III", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.urutan.3.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" },
  "0199": { key: "tanggal_sidang_iv", label: "Tgl. Sidang IV", dataType: "date", sourceType: "sipp_jadwal_sidang", sourceKey: "sidang.urutan.4.tanggal_sidang", transformKey: "tanggal_indonesia_panjang" },
  "0222": { key: "awal_konflik_rumah_tangga", label: "Awal Konflik Rumah Tangga", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "awal_konflik_rumah_tangga" },
  "0227": { key: "tanggal_fasakh_murtad", label: "Tanggal Fasakh/Murtad/Meninggalkan Agama", dataType: "manual_date", sourceType: "jlf_manual", sourceKey: "tanggal_fasakh_murtad", transformKey: "tanggal_indonesia_panjang" },
  "0246": { key: "tanggal_pisah_rumah", label: "Tanggal Pisah Rumah", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "tanggal_pisah_rumah" },
  "0279": { key: "biaya_pendaftaran", label: "Biaya Pendaftaran", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_pendaftaran", transformKey: "rupiah" },
  "0281": { key: "biaya_redaksi", label: "Biaya Redaksi", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_redaksi", transformKey: "rupiah" },
  "0312": { key: "biaya_panggilan_para_pihak", label: "Biaya Panggilan Para Pihak", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_panggilan", transformKey: "rupiah" },
  "0690": { key: "sebutan_majelis_hakim", label: "Sebutan Majelis Hakim/Hakim", dataType: "text", sourceType: "sipp_hakim", sourceKey: "hakim.jabatan" },
  "1197": { key: "nama_saksi_penggugat_1", label: "Nama Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.nama" },
  "1198": { key: "umur_saksi_penggugat_1", label: "Umur Saksi Penggugat 1", dataType: "number", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.umur" },
  "1199": { key: "agama_saksi_penggugat_1", label: "Agama Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.agama" },
  "1200": { key: "pendidikan_saksi_penggugat_1", label: "Pendidikan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.pendidikan" },
  "1201": { key: "pekerjaan_saksi_penggugat_1", label: "Pekerjaan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.pekerjaan" },
  "1202": { key: "alamat_saksi_penggugat_1", label: "Alamat Saksi Penggugat 1", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.alamat" },
  "1203": { key: "nama_saksi_penggugat_2", label: "Nama Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.nama" },
  "1204": { key: "umur_saksi_penggugat_2", label: "Umur Saksi Penggugat 2", dataType: "number", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.umur" },
  "1205": { key: "agama_saksi_penggugat_2", label: "Agama Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.agama" },
  "1206": { key: "pendidikan_saksi_penggugat_2", label: "Pendidikan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.pendidikan" },
  "1207": { key: "pekerjaan_saksi_penggugat_2", label: "Pekerjaan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.pekerjaan" },
  "1208": { key: "alamat_saksi_penggugat_2", label: "Alamat Saksi Penggugat 2", dataType: "long_text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.alamat" },
  "1214": { key: "daftar_bukti_surat", label: "Daftar Bukti Surat", dataType: "long_text", sourceType: "jlf_manual", sourceKey: "daftar_bukti_surat" },
  "1241": { key: "hubungan_saksi_penggugat_1", label: "Hubungan Saksi Penggugat 1", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.1.keterangan" },
  "1242": { key: "hubungan_saksi_penggugat_2", label: "Hubungan Saksi Penggugat 2", dataType: "text", sourceType: "sipp_pihak", sourceKey: "saksi.penggugat.2.keterangan" },
  "2021": { key: "keterangan_saksi_penggugat_1", label: "Keterangan Saksi Penggugat 1", dataType: "long_text", sourceType: "jlf_bas_qa", sourceKey: "saksi.penggugat.1.keterangan" },
  "2022": { key: "keterangan_saksi_penggugat_2", label: "Keterangan Saksi Penggugat 2", dataType: "long_text", sourceType: "jlf_bas_qa", sourceKey: "saksi.penggugat.2.keterangan" },
  "4001": { key: "amar_putusan_perceraian", label: "Amar Putusan Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "amar_putusan_perceraian", transformKey: "sanitize_document_text" },
  "5125": { key: "posita_lengkap", label: "Posita Lengkap", dataType: "long_text", sourceType: "sipp_perkara", sourceKey: "posita" },
  "5223": { key: "biaya_meterai", label: "Biaya Meterai", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_meterai", transformKey: "rupiah" },
  "6060": { key: "biaya_proses", label: "Biaya Proses", dataType: "currency", sourceType: "sipp_keuangan", sourceKey: "biaya_proses", transformKey: "rupiah" },
  "7095": { key: "penanda_rupiah_atau_nihil", label: "Penanda Rupiah/Nihil", dataType: "text", sourceType: "computed", sourceKey: "penanda_rupiah_nihil" },
  "8004": { key: "nama_panitera_satker", label: "Nama Panitera Satker", dataType: "text", sourceType: "sipp_perkara", sourceKey: "satker.panitera" },
  "8008": { key: "nama_satker", label: "Nama Satker", dataType: "text", sourceType: "computed", sourceKey: "nama_satker" },
  "8010": { key: "nama_satker_huruf_besar", label: "Nama Satker Huruf Besar", dataType: "text", sourceType: "computed", sourceKey: "nama_satker_uppercase" },
  "8184": { key: "tanggal_sidang_hijriah", label: "Tanggal Sidang Hijriah", dataType: "date", sourceType: "computed", sourceKey: "sidang.terpilih.tanggal_sidang", transformKey: "tanggal_hijriah" },
  "8500": { key: "blok_tanda_tangan_majelis", label: "Blok Tanda Tangan Majelis", dataType: "long_text", sourceType: "computed", sourceKey: "blok_tanda_tangan_majelis" },
  "8505": { key: "amar_biaya_perkara", label: "Amar Biaya Perkara", dataType: "long_text", sourceType: "computed", sourceKey: "amar_biaya_perkara" },
  "8521": { key: "pertimbangan_fakta_hukum_perceraian", label: "Pertimbangan Fakta Hukum Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_fakta_hukum_perceraian" },
  "8522": { key: "pertimbangan_petitum_berdasarkan_fakta", label: "Pertimbangan Petitum Berdasarkan Fakta", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_petitum_berdasarkan_fakta" },
  "8523": { key: "pertimbangan_hukum_kuasa", label: "Pertimbangan Hukum Kuasa", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_hukum_kuasa" },
  "8524": { key: "pertimbangan_hukum_pekerjaan_khusus", label: "Pertimbangan Hukum PNS/BUMN/BUMD/TNI/POLRI", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_hukum_pekerjaan_khusus" },
  "8526": { key: "pertimbangan_verstek_ghaib", label: "Pertimbangan Verstek/Ghaib", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_verstek_ghaib" },
  "8527": { key: "pertimbangan_biaya_prodeo", label: "Pertimbangan Biaya Prodeo", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_biaya_prodeo" },
  "8528": { key: "pertimbangan_saksi_perceraian_verstek", label: "Pertimbangan Saksi Perceraian Verstek", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_saksi_perceraian_verstek" },
  "8529": { key: "pertimbangan_bukti_surat_verstek", label: "Pertimbangan Bukti Surat Verstek", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_bukti_surat_verstek" },
  "8530": { key: "pertimbangan_pokok_perceraian", label: "Pertimbangan Pokok Perceraian", dataType: "long_text", sourceType: "computed", sourceKey: "legal_kb.pertimbangan_pokok_perceraian" },
  "9944": { key: "lama_pisah_rumah", label: "Lama Pisah Rumah", dataType: "manual_text", sourceType: "jlf_manual", sourceKey: "lama_pisah_rumah" },
};

export type JlfResolverContext = {
  db: AletaDatabase;
  actor: UserPersona;
  nomorPerkara: string;
  sippPerkaraId?: string;
  templateId?: string;
  options?: {
    manualOverride?: boolean;
    tempValues?: Record<string, unknown>;
    caseBundle?: JlfResolverCaseBundle | null;
    selectedHearing?: unknown;
    legacyDependencyDepth?: number;
    legacyDependencyCodes?: string[];
  };
};

export type JlfResolverCaseBundle = {
  detail: Record<string, unknown> | null;
  parties: unknown[];
  schedule: unknown[];
  lastHearing: unknown | null;
  nextHearing: unknown | null;
  judges: unknown[];
  panitera: unknown[];
  jurusita: unknown[];
  mediator: unknown[];
  decision: Record<string, unknown> | null;
};

export type JlfVariableResolution = {
  key: string;
  placeholder: string;
  value: string | number | boolean | Date | object | null;
  source: string;
  confidence?: number;
  warnings?: string[];
  error?: string;
  variableId?: string;
  legacyCode?: string | null;
  label?: string;
  dataType?: string;
  sourceType?: string;
  isRequired?: boolean;
  legacyAbtType?: string;
  fieldMode?: string;
  manualOverride?: boolean;
  aiEnabled?: boolean;
  manualOverrideAllowed?: boolean;
};

function isEmptyResolvedValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function normalizeNomorPerkara(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const LEGACY_URUTAN_DATA_BY_CODE: Record<string, number> = {
  "0073": 1,
  "0098": 1,
  "0101": 1,
  "0102": 1,
  "0105": 1,
  "0193": 2,
  "0196": 3,
  "0199": 4,
  "0229": 1,
  "0230": 1,
  "1036": 2,
  "3119": 3,
  "5026": 2,
  "5029": 2,
  "5082": 3,
  "5089": 3,
  "5090": 4,
  "5097": 4,
  "5098": 5,
  "5117": 5,
  "7128": 1,
};

function normalizePositiveInteger(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return 0;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function legacyCodeForLookup(mapping: Pick<TemplateVariableResolverRow, "legacy_code" | "key">) {
  return normalizeLegacyCodeForLookup(mapping.legacy_code ?? mapping.key ?? "");
}

function readObjectPath(value: unknown, path: string): unknown {
  if (!value || typeof value !== "object" || !path) return undefined;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    current = record[segment] ?? record[toCamelKey(segment)] ?? record[toSnakeKey(segment)];
  }
  return current;
}

function toCamelKey(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function toSnakeKey(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function pickFirstObjectValue(value: unknown, keys: string[]) {
  for (const key of keys) {
    const found = readObjectPath(value, key);
    if (!isEmptyResolvedValue(found)) return found;
  }
  return undefined;
}

function getNameFromRecord(value: unknown) {
  if (!value || typeof value !== "object") return stringifyValueForDocument(value);
  return stringifyValueForDocument(
    pickFirstObjectValue(value, [
      "identitas_lengkap",
      "identitasLengkap",
      "identitas_ringkas",
      "identitasRingkas",
      "nama",
      "name",
      "fullname",
      "nama_lengkap",
      "pihak_nama",
      "hakim_nama",
      "pp_nama",
      "jurusita_nama",
    ])
  );
}

function resolvePartySource(bundle: JlfResolverCaseBundle | null, sourceKey: string) {
  const parties = bundle?.parties ?? [];
  const key = sourceKey.toLowerCase();

  if (key.includes("pihak_1") || key.includes("penggugat") || key.includes("pemohon")) {
    const party = parties[0];
    if (!party) return null;
    return pickFirstObjectValue(party, [sourceKey, sourceKey.replace(/^penggugat\.\d+\./, ""), sourceKey.replace(/^pemohon\.\d+\./, "")])
      ?? getNameFromRecord(party);
  }
  if (key.includes("pihak_2") || key.includes("tergugat") || key.includes("termohon")) {
    const party = parties[1];
    if (!party) return null;
    return pickFirstObjectValue(party, [sourceKey, sourceKey.replace(/^tergugat\.\d+\./, ""), sourceKey.replace(/^termohon\.\d+\./, "")])
      ?? getNameFromRecord(party);
  }
  if (key.includes("para_pihak") || key.includes("semua")) {
    return parties.map(getNameFromRecord).filter(Boolean).join(" dan ");
  }

  const pathValue = parties.map((item) => readObjectPath(item, sourceKey)).find((item) => !isEmptyResolvedValue(item));
  return pathValue ?? parties.map(getNameFromRecord).filter(Boolean).join(", ");
}

function resolveListSource(items: unknown[], sourceKey: string) {
  if (!sourceKey) return items;
  const found = items.map((item) => readObjectPath(item, sourceKey)).filter((item) => !isEmptyResolvedValue(item));
  return found.length ? found : items;
}

function resolveComputedValue(context: JlfResolverContext, sourceKey: string, variableKey: string) {
  const key = (sourceKey || variableKey).toLowerCase();
  const caseType = stringifyValueForDocument(
    pickFirstObjectValue(context.options?.caseBundle?.detail, ["jenisPerkara", "jenis_perkara", "jenis_perkara_nama", "klasifikasiPerkara", "klasifikasi_perkara"])
  ).toLowerCase();
  const legacyReference = key.match(/^legacy[._:-]?(\d{1,6})$/)?.[1];
  if (legacyReference) {
    const code = normalizeLegacyCodeForLookup(legacyReference);
    return context.options?.tempValues?.[code] ?? context.options?.tempValues?.[`#${code}#`] ?? context.options?.tempValues?.[`legacy_${code}`] ?? null;
  }
  if (key.includes("tanggal_hari_ini") || key === "today" || key === "hari_ini") return new Date();
  if (key.includes("nomor_perkara")) return context.nomorPerkara;
  if (key.includes("tahun_perkara")) {
    const year = context.nomorPerkara.match(/\b(20\d{2}|19\d{2})\b/);
    return year?.[1] ?? "";
  }
  if (key.includes("qr")) {
    return buildCaseQrPayloadText(context);
  }
  if (key.includes("nama_satker") && key.includes("uppercase")) return "PENGADILAN AGAMA DONGGALA";
  if (key.includes("nama_satker") || key.includes("satker")) return "Pengadilan Agama Donggala";
  if (key.includes("jenis_gugatan_permohonan") || key.includes("jenis_permohonan_gugatan")) {
    return caseType.includes("permohonan") || context.nomorPerkara.includes("/Pdt.P/") ? "permohonan" : "gugatan";
  }
  if (key.includes("kumulasi_gugatan_permohonan") || key.includes("jenis_perkara_terurai")) {
    return caseType || (context.nomorPerkara.includes("/Pdt.P/") ? "permohonan" : "gugatan");
  }
  if (key.includes("penyebutan_pihak1")) return context.nomorPerkara.includes("/Pdt.P/") ? "Pemohon" : "Penggugat";
  if (key.includes("penyebutan_pihak2")) return context.nomorPerkara.includes("/Pdt.P/") ? "Termohon" : "Tergugat";
  if (key.includes("putusan_atau_penetapan")) return context.nomorPerkara.includes("/Pdt.P/") ? "penetapan" : "putusan";
  if (key.includes("sidang.terpilih") || key.includes("sidang_terpilih")) {
    const hearing = context.options?.selectedHearing;
    return pickFirstObjectValue(hearing, [sourceKey, sourceKey.replace(/^sidang\.terpilih\./, ""), "tanggalSidang", "tanggal_sidang", "tanggal"]);
  }
  if (key.includes("penanda_rupiah_nihil")) return "nihil";
  if (key.includes("amar_putusan_perceraian")) return "";
  if (key.includes("amar_biaya")) return "";
  if (key.includes("blok_tanda_tangan_majelis")) return "";
  if (key.includes("legal_kb")) return "";
  return context.options?.tempValues?.[variableKey] ?? null;
}

function buildCaseQrPayloadText(context: JlfResolverContext) {
  return JSON.stringify({
    type: "jlf_case_link",
    nomor_perkara_masked: maskNomorPerkara(context.nomorPerkara),
    url: `/judicia/legal-form/cases/${encodeURIComponent(context.nomorPerkara)}`,
    requires_login: true,
    public_data: "minimal",
  });
}

function isQrMapping(mapping: TemplateVariableResolverRow) {
  const terms = [mapping.legacy_code ?? "", mapping.placeholder, mapping.key, mapping.source_key, mapping.source_type]
    .join(" ")
    .toLowerCase();
  return mapping.legacy_code === "0002" || terms.includes("qr_perkara") || terms.includes("qr_code") || terms.includes("qrcode");
}

function isLegacyAbtSqlMapping(mapping: TemplateVariableResolverRow) {
  return Boolean(mapping.sipp_query_preview?.trim()) && (
    mapping.source_type === "abt_sql" ||
    mapping.legacy_abt_type === "data_sql" ||
    mapping.transform_key === "legacy_sql_needs_review"
  );
}

function normalizeLegacyCodeForLookup(code: string) {
  return code.replace(/\D/g, "").padStart(4, "0");
}

function registerLegacyPlaceholder(values: Record<string, unknown>, code: string, value: unknown) {
  const normalized = normalizeLegacyCodeForLookup(code);
  if (!normalized || normalized === "0000") return;
  const numeric = String(Number(normalized));
  values[normalized] = value;
  values[`#${normalized}#`] = value;
  values[`legacy_${normalized}`] = value;
  values[`legacy:${normalized}`] = value;
  if (numeric && numeric !== "NaN") {
    values[numeric] = value;
    values[`#${numeric}#`] = value;
    values[`legacy_${numeric}`] = value;
    values[`legacy:${numeric}`] = value;
  }
}

function hasLegacyPlaceholderValue(values: Record<string, unknown>, code: string) {
  const normalized = normalizeLegacyCodeForLookup(code);
  const numeric = String(Number(normalized));
  return [
    normalized,
    `#${normalized}#`,
    `legacy_${normalized}`,
    `legacy:${normalized}`,
    numeric,
    `#${numeric}#`,
    `legacy_${numeric}`,
    `legacy:${numeric}`,
  ].some((key) => Object.prototype.hasOwnProperty.call(values, key));
}

function detectLegacySqlDependencyCodes(sql: string) {
  return Array.from(
    new Set(
      Array.from(String(sql || "").matchAll(/#(\d{1,6})#/g))
        .map((match) => normalizeLegacyCodeForLookup(match[1] ?? ""))
        .filter((code) => code && code !== "0000")
    )
  );
}

function addResolvedTempValue(values: Record<string, unknown>, result: JlfVariableResolution, fallbackLegacyCode?: string) {
  if (isEmptyResolvedValue(result.value)) return;
  values[result.key] = result.value;
  values[result.placeholder] = result.value;
  if (result.legacyCode) registerLegacyPlaceholder(values, result.legacyCode, result.value);
  if (fallbackLegacyCode) registerLegacyPlaceholder(values, fallbackLegacyCode, result.value);
}

function buildVirtualLegacyDependencyMapping(code: string): TemplateVariableResolverRow | null {
  const normalized = normalizeLegacyCodeForLookup(code);
  const definition = LEGACY_AUTO_DEFINITIONS[normalized];
  if (!definition) return null;
  return {
    template_variable_id: `auto-dependency:${normalized}`,
    template_id: "",
    variable_id: `virtual:${normalized}`,
    placeholder: `#${normalized}#`,
    mapping_required: 0,
    sort_order: 0,
    legacy_code: normalized,
    key: definition.key,
    label: definition.label,
    description: `Auto dependency untuk placeholder legacy #${normalized}# dari query SQL ABT.`,
    data_type: definition.dataType,
    source_type: definition.sourceType,
    source_key: definition.sourceKey,
    transform_key: definition.transformKey ?? "",
    fallback_value: definition.fallbackValue ?? "",
    sipp_query_preview: "",
    legacy_abt_type: "",
    field_mode: "",
    ai_enabled: 0,
    manual_override_allowed: 1,
    variable_required: 0,
    example_value: "",
  } as TemplateVariableResolverRow;
}

async function loadLegacyDependencyMapping(db: AletaDatabase, code: string) {
  const normalized = normalizeLegacyCodeForLookup(code);
  const row = await db.prepare(
    `SELECT id AS variable_id, legacy_code, "key", label, description, data_type, source_type, source_key,
            transform_key, fallback_value, sipp_query_preview, legacy_abt_type, field_mode, ai_enabled,
            manual_override_allowed, is_required AS variable_required, example_value
     FROM jlf_variables
     WHERE is_active = 1
       AND (
         legacy_code = ?
         OR "key" = ?
         OR "key" LIKE ?
         OR "key" LIKE ?
         OR source_key = ?
         OR source_key = ?
       )
     ORDER BY
       CASE
         WHEN legacy_code = ? THEN 0
         WHEN "key" = ? THEN 1
         WHEN "key" LIKE ? THEN 2
         WHEN source_key = ? THEN 3
         ELSE 4
       END,
       updated_at DESC
     LIMIT 1`
  ).get<VariableRegistryRow>(
    normalized,
    `legacy_${normalized}`,
    `legacy_${normalized}_%`,
    `abt_sql_${normalized}_%`,
    `legacy_sql.${normalized}`,
    `abt.${normalized}`,
    normalized,
    `legacy_${normalized}`,
    `abt_sql_${normalized}_%`,
    `legacy_sql.${normalized}`
  );

  if (!row) return buildVirtualLegacyDependencyMapping(normalized);
  return {
    template_variable_id: `dependency:${normalized}:${row.variable_id}`,
    template_id: "",
    variable_id: row.variable_id,
    placeholder: `#${normalized}#`,
    mapping_required: 0,
    sort_order: 0,
    legacy_code: row.legacy_code ?? normalized,
    key: row.key,
    label: row.label,
    description: row.description,
    data_type: row.data_type,
    source_type: row.source_type,
    source_key: row.source_key,
    transform_key: row.transform_key,
    fallback_value: row.fallback_value,
    sipp_query_preview: row.sipp_query_preview,
    legacy_abt_type: row.legacy_abt_type,
    field_mode: row.field_mode,
    ai_enabled: row.ai_enabled,
    manual_override_allowed: row.manual_override_allowed,
    variable_required: row.variable_required,
    example_value: row.example_value,
  } as TemplateVariableResolverRow;
}

async function buildLegacySqlPlaceholderValues(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
) {
  const values: Record<string, unknown> = { ...(context.options?.tempValues ?? {}) };
  registerLegacyPlaceholder(values, "0001", context.nomorPerkara);

  for (const [key, value] of Object.entries(context.options?.tempValues ?? {})) {
    const directLegacyCode = key.match(/^#?(\d{1,6})#?$/)?.[1] ?? key.match(/^legacy[_:](\d{1,6})$/)?.[1];
    if (directLegacyCode) registerLegacyPlaceholder(values, directLegacyCode, value);
  }

  const dependencyDepth = context.options?.legacyDependencyDepth ?? 0;
  if (dependencyDepth >= 6) return values;

  const currentCode = mapping.legacy_code ? normalizeLegacyCodeForLookup(mapping.legacy_code) : "";
  const stack = new Set((context.options?.legacyDependencyCodes ?? []).map(normalizeLegacyCodeForLookup));
  if (currentCode) stack.add(currentCode);

  for (const code of detectLegacySqlDependencyCodes(mapping.sipp_query_preview)) {
    if (code === "0001" || stack.has(code)) continue;
    const dependencyMapping = await loadLegacyDependencyMapping(context.db, code);
    if (!dependencyMapping) {
      if (hasLegacyPlaceholderValue(values, code)) continue;
      continue;
    }

    const result = await resolveLegacyDependencyRecord(
      dependencyMapping,
      {
        ...context,
        options: {
          ...context.options,
          tempValues: values,
          legacyDependencyDepth: dependencyDepth + 1,
          legacyDependencyCodes: [...stack, code],
        },
      },
      bundle
    );
    addResolvedTempValue(values, result, code);
  }

  return values;
}

async function resolveLegacyAbtSqlValue(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
) {
  const provider = JlfSippProviderRegistry.getProvider();
  const perkaraId = context.sippPerkaraId || stringifyValueForDocument(pickFirstObjectValue(bundle?.detail, ["perkaraId", "perkara_id"]));
  const warnings: string[] = [];

  if (!perkaraId) {
    warnings.push("Query ABT belum dijalankan karena perkara_id SIPP belum ditemukan.");
    return { value: null, source: "abt_sql", confidence: 0.15, warnings };
  }

  try {
    const result = await provider.executeLegacySqlValue({
      sql: mapping.sipp_query_preview,
      perkaraId,
      nomorPerkara: context.nomorPerkara,
      placeholderValues: await buildLegacySqlPlaceholderValues(mapping, context, bundle),
    });
    const value = result.value ?? result.data ?? null;
    if (isEmptyResolvedValue(value) && result.rowCount === 0) warnings.push(`Query ABT ${mapping.legacy_code ? `#${mapping.legacy_code}# ` : ""}tidak mengembalikan baris.`);
    return { value, source: "abt_sql", confidence: isEmptyResolvedValue(value) ? 0.3 : 0.86, warnings };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Query ABT read-only belum berhasil.");
    return { value: null, source: "abt_sql", confidence: 0.15, warnings };
  }
}

async function fetchSippBundle(context: JlfResolverContext): Promise<JlfResolverCaseBundle | null> {
  if (context.options?.caseBundle) return context.options.caseBundle;

  const provider = JlfSippProviderRegistry.getProvider();
  const detail = await provider.getCaseDetail({
    nomorPerkara: context.nomorPerkara,
    perkaraId: context.sippPerkaraId,
  });
  if (!detail) return null;

  const perkaraId = String(detail.perkaraId || context.sippPerkaraId || "");
  if (!perkaraId) {
    return {
      detail: detail as unknown as Record<string, unknown>,
      parties: [],
      schedule: [],
      lastHearing: null,
      nextHearing: null,
      judges: [],
      panitera: [],
      jurusita: [],
      mediator: [],
      decision: null,
    };
  }

  const [parties, schedule, lastHearing, nextHearing, judges, panitera, jurusita, mediator, decision] = await Promise.all([
    provider.getCaseParties(perkaraId),
    provider.getCaseSchedule(perkaraId, { nomorPerkara: context.nomorPerkara }),
    provider.getLastHearing(perkaraId, { nomorPerkara: context.nomorPerkara }),
    provider.getNextHearing(perkaraId, { nomorPerkara: context.nomorPerkara }),
    provider.getJudges(perkaraId),
    provider.getPanitera(perkaraId),
    provider.getJurusita(perkaraId),
    provider.getMediator(perkaraId),
    provider.getDecisionData(perkaraId),
  ]);

  return {
    detail: detail as unknown as Record<string, unknown>,
    parties,
    schedule,
    lastHearing,
    nextHearing,
    judges,
    panitera,
    jurusita,
    mediator,
    decision,
  };
}

async function listExplicitResolverMappings(db: AletaDatabase, templateId: string) {
  return db.prepare(
    `SELECT tv.id AS template_variable_id, tv.template_id, tv.variable_id, tv.placeholder,
       tv.is_required AS mapping_required, tv.sort_order,
       v.legacy_code, v."key", v.label, v.description, v.data_type, v.source_type, v.source_key,
       v.transform_key, v.fallback_value, v.sipp_query_preview, v.legacy_abt_type, v.field_mode, v.ai_enabled,
       v.manual_override_allowed, v.is_required AS variable_required, v.example_value
     FROM jlf_template_variables tv
     JOIN jlf_variables v ON v.id = tv.variable_id
     WHERE tv.template_id = ? AND v.is_active = 1
     ORDER BY tv.sort_order ASC, tv.placeholder ASC`
  ).all<TemplateVariableResolverRow>(templateId);
}

async function readLatestTemplatePlaceholders(db: AletaDatabase, templateId: string) {
  const latest = await db.prepare(
    `SELECT id, storage_path, version_number
     FROM jlf_template_versions
     WHERE template_id = ?
     ORDER BY version_number DESC
     LIMIT 1`
  ).get<TemplateVersionRow>(templateId);

  if (!latest) return { latest: null, placeholders: [] as JlfDetectedPlaceholder[], parserWarnings: [] as string[] };

  const stored = await readStoredJlfTemplateFile(latest.storage_path);
  const fileType = latest.storage_path.toLowerCase().endsWith(".rtf") ? "rtf" : "docx";
  const content = fileType === "rtf" ? stored.buffer.toString("latin1") : stored.buffer.toString("utf8");

  return {
    latest,
    placeholders: detectAllPlaceholders(content),
    parserWarnings: fileType === "docx"
      ? ["DOCX parser penuh belum tersedia. Preview placeholder DOCX memakai scan aman yang dapat melewatkan XML terkompresi."]
      : [],
  };
}

async function listAutoResolverMappings(
  db: AletaDatabase,
  templateId: string,
  explicitMappings: TemplateVariableResolverRow[]
) {
  const { placeholders } = await readLatestTemplatePlaceholders(db, templateId);
  if (!placeholders.length) return [] as TemplateVariableResolverRow[];

  const explicitPlaceholders = new Set(explicitMappings.map((item) => normalizePlaceholder(item.placeholder)));
  const autoCandidates = placeholders.filter((placeholder) => !explicitPlaceholders.has(placeholder.normalizedKey));
  if (!autoCandidates.length) return [] as TemplateVariableResolverRow[];

  const legacyCodes = Array.from(new Set(autoCandidates.filter((item) => item.kind === "legacy").map((item) => item.normalizedKey)));
  const semanticKeys = Array.from(new Set(autoCandidates.filter((item) => item.kind === "modern").map((item) => item.normalizedKey)));
  const clauses: string[] = [];
  const params: string[] = [];

  if (legacyCodes.length) {
    clauses.push(`legacy_code IN (${legacyCodes.map(() => "?").join(", ")})`);
    params.push(...legacyCodes);
  }
  if (semanticKeys.length) {
    clauses.push(`"key" IN (${semanticKeys.map(() => "?").join(", ")})`);
    params.push(...semanticKeys);
  }
  if (!clauses.length) return [] as TemplateVariableResolverRow[];

  const registryRows = await db.prepare(
    `SELECT id AS variable_id, legacy_code, "key", label, description, data_type, source_type, source_key,
       transform_key, fallback_value, sipp_query_preview, legacy_abt_type, field_mode, ai_enabled, manual_override_allowed,
       is_required AS variable_required, example_value
     FROM jlf_variables
     WHERE is_active = 1 AND (${clauses.join(" OR ")})`
  ).all<VariableRegistryRow>(...params);

  const registry = new Map<string, VariableRegistryRow>();
  for (const row of registryRows) {
    if (row.legacy_code) registry.set(`legacy:${row.legacy_code}`, row);
    registry.set(`modern:${row.key.toLowerCase().replace(/[.-]+/g, "_")}`, row);
  }

  return autoCandidates.flatMap((placeholder, index) => {
    const lookupKey = placeholder.kind === "legacy" ? `legacy:${placeholder.normalizedKey}` : `modern:${placeholder.normalizedKey}`;
    const variable = registry.get(lookupKey) ?? getVirtualLegacyVariable(placeholder);
    if (!variable) return [];
    return [{
      template_variable_id: `auto:${templateId}:${placeholder.placeholder}`,
      template_id: templateId,
      variable_id: variable.variable_id,
      placeholder: placeholder.placeholder,
      mapping_required: 0,
      sort_order: 10000 + index,
      legacy_code: variable.legacy_code,
      key: variable.key,
      label: variable.label,
      description: variable.description,
      data_type: variable.data_type,
      source_type: variable.source_type,
      source_key: variable.source_key,
      transform_key: variable.transform_key,
      fallback_value: variable.fallback_value,
      sipp_query_preview: variable.sipp_query_preview,
      legacy_abt_type: variable.legacy_abt_type,
      field_mode: variable.field_mode,
      ai_enabled: variable.ai_enabled,
      manual_override_allowed: variable.manual_override_allowed,
      variable_required: variable.variable_required,
      example_value: variable.example_value,
    } satisfies TemplateVariableResolverRow];
  });
}

function getVirtualLegacyVariable(placeholder: JlfDetectedPlaceholder): VariableRegistryRow | null {
  if (placeholder.kind !== "legacy") return null;
  const definition = LEGACY_AUTO_DEFINITIONS[placeholder.normalizedKey] ?? {
    key: `legacy_${placeholder.normalizedKey}`,
    label: `Legacy #${placeholder.normalizedKey}#`,
    dataType: "text",
    sourceType: "jlf_manual",
    sourceKey: `legacy_${placeholder.normalizedKey}`,
  };

  return {
    variable_id: `virtual:${placeholder.normalizedKey}`,
    legacy_code: placeholder.normalizedKey,
    key: definition.key,
    label: definition.label,
    description: `Auto fallback untuk placeholder legacy #${placeholder.normalizedKey}# dari file template.`,
    data_type: definition.dataType,
    source_type: definition.sourceType,
    source_key: definition.sourceKey,
    transform_key: definition.transformKey ?? "",
    fallback_value: definition.fallbackValue ?? "",
    sipp_query_preview: "",
    legacy_abt_type: "",
    field_mode: "",
    ai_enabled: 0,
    manual_override_allowed: 1,
    variable_required: 0,
    example_value: "",
  } as VariableRegistryRow;
}

async function listResolverMappings(db: AletaDatabase, templateId: string) {
  const explicitMappings = await listExplicitResolverMappings(db, templateId);
  const autoMappings = await listAutoResolverMappings(db, templateId, explicitMappings);
  return [...explicitMappings, ...autoMappings].sort((left, right) => {
    const sortDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
    return sortDiff || left.placeholder.localeCompare(right.placeholder);
  });
}

function parseLegacySippTableColumnSource(sourceKey: string) {
  const raw = String(sourceKey || "").trim();
  const [pathPart, queryPart = ""] = raw.split("?", 2);
  const parts = pathPart.split(".");
  if (parts.length !== 2) return null;
  const [table, column] = parts.map((part) => part.trim());
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(column)) return null;
  const urutanMatch = queryPart.match(/(?:^|&)(?:urutan|urutan_data|sidang_urutan)=(\d+)/i);
  const urutanData = normalizePositiveInteger(urutanMatch?.[1]);
  return { table, column, urutanData };
}

function quoteLegacySippIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) throw new Error("Identifier SIPP legacy tidak aman.");
  return `\`${identifier}\``;
}

function legacySippWhereColumn(table: string) {
  const normalized = table.toLowerCase();
  if (normalized === "jadwalsidangweb" || normalized === "dataumumweb") return "IDPerkara";
  return "perkara_id";
}

function inferLegacyUrutanData(mapping: Pick<TemplateVariableResolverRow, "legacy_code" | "key" | "source_key">) {
  const parsed = parseLegacySippTableColumnSource(mapping.source_key);
  if (parsed?.urutanData) return parsed.urutanData;
  const code = legacyCodeForLookup(mapping);
  return code ? LEGACY_URUTAN_DATA_BY_CODE[code] ?? 0 : 0;
}

async function resolveLegacySippColumnValue(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
) {
  const parsed = parseLegacySippTableColumnSource(mapping.source_key);
  if (!parsed) return { attempted: false, value: null as unknown, warnings: [] as string[] };

  const perkaraId = context.sippPerkaraId || stringifyValueForDocument(pickFirstObjectValue(bundle?.detail, ["perkaraId", "perkara_id"]));
  if (!perkaraId) return { attempted: true, value: null, warnings: ["Data SIPP legacy belum dibaca karena perkara_id tidak ditemukan."] };

  const provider = JlfSippProviderRegistry.getProvider();
  const table = quoteLegacySippIdentifier(parsed.table);
  const column = quoteLegacySippIdentifier(parsed.column);
  const whereColumn = quoteLegacySippIdentifier(legacySippWhereColumn(parsed.table));
  const urutanData = inferLegacyUrutanData(mapping);
  const urutanWhere = urutanData ? ` AND ${quoteLegacySippIdentifier("urutan")}=${urutanData}` : "";

  try {
    const result = await provider.executeLegacySqlValue({
      sql: `SELECT ${column} AS data FROM ${table} WHERE CAST(${whereColumn} AS CHAR)=#perkara_id#${urutanWhere} LIMIT 1`,
      perkaraId,
      nomorPerkara: context.nomorPerkara,
      placeholderValues: await buildLegacySqlPlaceholderValues(mapping, context, bundle),
    });
    return { attempted: true, value: result.value ?? result.data ?? null, warnings: [] as string[] };
  } catch (error) {
    return {
      attempted: true,
      value: null,
      warnings: [error instanceof Error ? error.message : "Data SIPP legacy belum berhasil dibaca."],
    };
  }
}

async function resolveBySource(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
) {
  const sourceKey = mapping.source_key || mapping.key;
  const sourceType = mapping.source_type;
  const warnings: string[] = [];
  let value: unknown = null;
  let source = sourceType;
  let confidence = 0.75;

  if (isLegacyAbtSqlMapping(mapping)) {
    return resolveLegacyAbtSqlValue(mapping, context, bundle);
  }

  switch (sourceType) {
    case "sipp_perkara":
      value = pickFirstObjectValue(bundle?.detail, [
        sourceKey,
        mapping.key,
        ...(sourceKey.includes("nomor_perkara") || mapping.key.includes("nomor_perkara") ? ["nomorPerkara", "nomor_perkara"] : []),
      ]);
      if (isEmptyResolvedValue(value) && (sourceKey.includes("nomor_perkara") || mapping.key.includes("nomor_perkara"))) {
        value = context.nomorPerkara;
      }
      if (isEmptyResolvedValue(value) && sourceKey.includes("satker")) {
        value = resolveComputedValue({ ...context, options: { ...context.options, caseBundle: context.options?.caseBundle ?? bundle } }, sourceKey, mapping.key);
      }
      confidence = bundle?.detail ? 0.9 : 0.2;
      break;
    case "sipp_pihak":
      value = resolvePartySource(bundle, sourceKey);
      confidence = bundle?.parties?.length ? 0.85 : 0.2;
      break;
    case "sipp_jadwal_sidang": {
      if (parseLegacySippTableColumnSource(sourceKey)) {
        value = null;
        confidence = 0.2;
        break;
      }
      const hearingContext = buildJlfHearingContext(
        bundle?.schedule ?? [],
        context.options?.selectedHearing,
        bundle?.lastHearing,
        bundle?.nextHearing,
        { autoSelect: false }
      );
      const selectedHearing = hearingContext.selected;
      const orderMatch = sourceKey.match(/^sidang\.urutan\.(\d+)\.(.+)$/i);
      if (sourceKey.includes("sebelumnya") || sourceKey.includes("previous")) {
        value = readJlfHearingField(hearingContext.previous, sourceKey);
      } else if (sourceKey.includes("berikut") || sourceKey.includes("next")) {
        value = readJlfHearingField(hearingContext.next, sourceKey);
      } else if (orderMatch) {
        const targetOrder = orderMatch[1] ?? "";
        const targetField = orderMatch[2] ?? "";
        const hearingByOrder = hearingContext.items.find((item) => item.order === targetOrder) ?? null;
        value = readJlfHearingField(hearingByOrder, targetField);
      } else if (sourceKey.includes("ringkasan") || sourceKey.includes("timeline")) {
        value = formatJlfHearingTimeline(hearingContext);
      } else if (sourceKey.includes("jumlah")) {
        value = hearingContext.items.length;
      } else if (sourceKey.includes("terakhir")) {
        value = bundle?.lastHearing ?? null;
      } else if (sourceKey.includes("daftar") || sourceKey.includes("semua")) {
        value = resolveListSource(bundle?.schedule ?? [], sourceKey);
      } else if (selectedHearing) {
        value = readJlfHearingField(selectedHearing, sourceKey);
      } else {
        value = null;
        if (bundle?.schedule?.length) warnings.push("Pilih sidang terlebih dahulu agar variabel ABT multi-sidang terisi.");
      }
      confidence = !isEmptyResolvedValue(value) ? 0.82 : bundle?.schedule?.length ? 0.3 : 0.2;
      break;
    }
    case "sipp_hakim":
      value = resolveListSource(bundle?.judges ?? [], sourceKey);
      confidence = bundle?.judges?.length ? 0.85 : 0.2;
      break;
    case "sipp_panitera":
      value = resolveListSource(bundle?.panitera ?? [], sourceKey);
      confidence = bundle?.panitera?.length ? 0.85 : 0.2;
      break;
    case "sipp_jurusita":
      value = resolveListSource(bundle?.jurusita ?? [], sourceKey);
      confidence = bundle?.jurusita?.length ? 0.85 : 0.2;
      break;
    case "sipp_putusan":
    case "sipp_keuangan":
      value = readObjectPath(bundle?.decision, sourceKey);
      confidence = bundle?.decision ? 0.8 : 0.2;
      break;
    case "jlf_temp":
      value = context.options?.tempValues?.[mapping.key] ?? context.options?.tempValues?.[sourceKey] ?? null;
      source = "jlf_temp";
      confidence = isEmptyResolvedValue(value) ? 0.2 : 0.75;
      break;
    case "jlf_bas_qa":
      value = await renderBasQaTemplateSection(context.db, context.actor, {
        sourceKey,
        caseType: stringifyValueForDocument(pickFirstObjectValue(bundle?.detail, ["jenisPerkara", "jenis_perkara", "klasifikasiPerkara", "klasifikasi_perkara"])),
        values: {
          nomor_perkara: context.nomorPerkara,
          ...(context.options?.tempValues ?? {}),
        },
      });
      source = "jlf_bas_qa";
      confidence = isEmptyResolvedValue(value) ? 0.2 : 0.75;
      if (isEmptyResolvedValue(value)) warnings.push("Template Tanya Jawab/BAS belum tersedia atau tidak aktif untuk sumber ini.");
      break;
    case "function":
    case "computed":
      value = resolveComputedValue({ ...context, options: { ...context.options, caseBundle: context.options?.caseBundle ?? bundle } }, sourceKey, mapping.key);
      source = sourceType;
      confidence = isEmptyResolvedValue(value) ? 0.4 : 0.8;
      break;
    case "qrcode":
      value = buildCaseQrPayloadText(context);
      source = "qrcode";
      confidence = 0.7;
      break;
    case "static":
      value = sourceKey && sourceKey !== mapping.key ? sourceKey : mapping.fallback_value;
      confidence = isEmptyResolvedValue(value) ? 0.2 : 1;
      break;
    case "ai":
      value = null;
      source = "ai";
      confidence = 0;
      warnings.push("AI resolver masih placeholder dan harus diminta eksplisit pada tahap AI berikutnya.");
      break;
    case "jlf_manual":
      value = null;
      source = "jlf_manual";
      confidence = 0;
      warnings.push("Nilai manual belum diisi.");
      break;
    default:
      value = null;
      confidence = 0;
      warnings.push(`Source type ${sourceType} belum memiliki resolver khusus.`);
  }

  if (isEmptyResolvedValue(value) && sourceType.startsWith("sipp_")) {
    const directLegacyValue = await resolveLegacySippColumnValue(mapping, context, bundle);
    if (directLegacyValue.attempted) {
      if (!isEmptyResolvedValue(directLegacyValue.value)) {
        value = directLegacyValue.value;
        source = `${sourceType}:legacy_column`;
        confidence = Math.max(confidence, 0.82);
      } else {
        warnings.push(...directLegacyValue.warnings);
      }
    }
  }

  return { value, source, confidence, warnings };
}

function resolveModeMetadata(mapping: TemplateVariableResolverRow) {
  const legacyAbtType = resolveLegacyAbtType({
    legacyAbtType: mapping.legacy_abt_type,
    dataType: mapping.data_type,
    sourceType: mapping.source_type,
    sourceKey: mapping.source_key,
    transformKey: mapping.transform_key,
    legacyCode: mapping.legacy_code,
    aiEnabled: mapping.ai_enabled,
  });
  const fieldMode = resolveJlfFieldMode({
    fieldMode: mapping.field_mode,
    legacyAbtType,
    dataType: mapping.data_type,
    sourceType: mapping.source_type,
    sourceKey: mapping.source_key,
    transformKey: mapping.transform_key,
    legacyCode: mapping.legacy_code,
    aiEnabled: mapping.ai_enabled,
  });

  return { legacyAbtType, fieldMode };
}

async function resolveLegacyDependencyRecord(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
): Promise<JlfVariableResolution> {
  const warnings: string[] = [];
  let value: unknown = null;
  let source = mapping.source_type;
  let confidence = 0;

  const manualValue = context.options?.manualOverride === false
    ? null
    : await getManualValueForVariable(context.db, {
        nomorPerkara: context.nomorPerkara,
        templateId: context.templateId,
        variableKey: mapping.key,
      });

  if (manualValue && !isEmptyResolvedValue(manualValue.valueText || manualValue.valueJson)) {
    value = manualValue.valueJson ?? manualValue.valueText;
    source = "jlf_manual_override";
    confidence = 1;
  } else if (isQrMapping(mapping)) {
    value = buildCaseQrPayloadText(context);
    source = "qrcode";
    confidence = 0.85;
  } else {
    const resolved = await resolveBySource(mapping, context, bundle);
    value = resolved.value;
    source = resolved.source;
    confidence = resolved.confidence;
    warnings.push(...resolved.warnings);
  }

  if (isEmptyResolvedValue(value) && mapping.fallback_value) {
    value = mapping.fallback_value;
    source = "fallback";
    confidence = Math.max(confidence, 0.6);
  }

  const modeMetadata = resolveModeMetadata(mapping);
  return {
    key: mapping.key,
    placeholder: mapping.placeholder,
    value: isEmptyResolvedValue(value) ? null : (value as JlfVariableResolution["value"]),
    source,
    confidence,
    warnings: Array.from(new Set(warnings)),
    variableId: mapping.variable_id,
    legacyCode: mapping.legacy_code,
    label: mapping.label,
    dataType: mapping.data_type,
    sourceType: mapping.source_type,
    isRequired: Boolean(mapping.mapping_required) || Boolean(mapping.variable_required),
    legacyAbtType: modeMetadata.legacyAbtType,
    fieldMode: modeMetadata.fieldMode,
    manualOverride: source === "jlf_manual_override",
    aiEnabled: Boolean(mapping.ai_enabled),
    manualOverrideAllowed: Boolean(mapping.manual_override_allowed),
  };
}

export async function resolveVariableRecord(
  mapping: TemplateVariableResolverRow,
  context: JlfResolverContext,
  bundle: JlfResolverCaseBundle | null
): Promise<JlfVariableResolution> {
  const warnings: string[] = [];
  const required = Boolean(mapping.mapping_required) || Boolean(mapping.variable_required);
  const modeMetadata = resolveModeMetadata(mapping);
  let value: unknown = null;
  let source = mapping.source_type;
  let confidence = 0;

  const manualValue = context.options?.manualOverride === false
    ? null
    : await getManualValueForVariable(context.db, {
        nomorPerkara: context.nomorPerkara,
        templateId: context.templateId,
        variableKey: mapping.key,
      });

  if (manualValue && !isEmptyResolvedValue(manualValue.valueText || manualValue.valueJson)) {
    value = manualValue.valueJson ?? manualValue.valueText;
    source = "jlf_manual_override";
    confidence = 1;
  } else if (isQrMapping(mapping)) {
    value = buildCaseQrPayloadText(context);
    source = "qrcode";
    confidence = 0.85;
  } else {
    const resolved = await resolveBySource(mapping, context, bundle);
    value = resolved.value;
    source = resolved.source;
    confidence = resolved.confidence;
    warnings.push(...resolved.warnings);
  }

  if (isEmptyResolvedValue(value) && mapping.fallback_value) {
    value = mapping.fallback_value;
    source = "fallback";
    confidence = Math.max(confidence, 0.6);
  }

  if (!isEmptyResolvedValue(value) && mapping.transform_key && source !== "jlf_manual_override") {
    value = applyJlfTransform(value, mapping.transform_key);
  }

  let error: string | undefined;
  if (required && isEmptyResolvedValue(value)) {
    error = `Variabel wajib ${mapping.key} belum memiliki nilai.`;
  } else if (!required && isEmptyResolvedValue(value)) {
    warnings.push(`Variabel opsional ${mapping.key} belum memiliki nilai.`);
  }

  return {
    key: mapping.key,
    placeholder: mapping.placeholder,
    value: isEmptyResolvedValue(value) ? null : (value as JlfVariableResolution["value"]),
    source,
    confidence,
    warnings: Array.from(new Set(warnings)),
    error,
    variableId: mapping.variable_id,
    legacyCode: mapping.legacy_code,
    label: mapping.label,
    dataType: mapping.data_type,
    sourceType: mapping.source_type,
    isRequired: required,
    legacyAbtType: modeMetadata.legacyAbtType,
    fieldMode: modeMetadata.fieldMode,
    manualOverride: source === "jlf_manual_override",
    aiEnabled: Boolean(mapping.ai_enabled),
    manualOverrideAllowed: Boolean(mapping.manual_override_allowed),
  };
}

export async function resolveVariablesForTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    templateId: string;
    nomorPerkara: string;
    sippPerkaraId?: string;
    options?: JlfResolverContext["options"];
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_PREVIEW);

  const mappings = await listResolverMappings(db, input.templateId);
  const needsSipp = mappings.some((mapping) => mapping.source_type.startsWith("sipp_") || isLegacyAbtSqlMapping(mapping));
  const context: JlfResolverContext = {
    db,
    actor,
    nomorPerkara: normalizeNomorPerkara(input.nomorPerkara),
    sippPerkaraId: input.sippPerkaraId,
    templateId: input.templateId,
    options: input.options,
  };
  const bundle = needsSipp ? await fetchSippBundle(context) : input.options?.caseBundle ?? null;
  const bundleWarning = needsSipp && !bundle ? ["Adapter SIPP belum mengembalikan detail perkara. Nilai SIPP akan kosong atau memakai fallback."] : [];
  const results = [];
  const tempValues: Record<string, unknown> = {
    ...(input.options?.tempValues ?? {}),
    nomor_perkara: context.nomorPerkara,
    perkara_id: context.sippPerkaraId,
  };
  registerLegacyPlaceholder(tempValues, "0001", context.nomorPerkara);

  for (const mapping of mappings) {
    const result = await resolveVariableRecord(
      mapping,
      { ...context, options: { ...context.options, tempValues } },
      bundle
    );
    results.push(result);
    if (!isEmptyResolvedValue(result.value)) {
      tempValues[result.key] = result.value;
      tempValues[result.placeholder] = result.value;
      if (result.legacyCode) registerLegacyPlaceholder(tempValues, result.legacyCode, result.value);
    }
  }

  return {
    templateId: input.templateId,
    nomorPerkara: context.nomorPerkara,
    variables: results,
    missingRequiredVariables: getMissingRequiredVariables(results),
    warnings: [...bundleWarning, ...getWarnings(results)],
  };
}

export function getMissingRequiredVariables(results: JlfVariableResolution[]) {
  return results.filter((item) => Boolean(item.error));
}

export function getWarnings(results: JlfVariableResolution[]) {
  return Array.from(new Set(results.flatMap((item) => item.warnings ?? [])));
}

export async function getUnknownPlaceholders(db: AletaDatabase, templateId: string) {
  const latest = await db.prepare(
    `SELECT id, storage_path, version_number
     FROM jlf_template_versions
     WHERE template_id = ?
     ORDER BY version_number DESC
     LIMIT 1`
  ).get<TemplateVersionRow>(templateId);

  if (!latest) {
    return {
      placeholders: [] as JlfDetectedPlaceholder[],
      unknownPlaceholders: [] as JlfDetectedPlaceholder[],
      parserWarnings: ["Template belum memiliki versi file."],
    };
  }

  const stored = await readStoredJlfTemplateFile(latest.storage_path);
  const fileType = latest.storage_path.toLowerCase().endsWith(".rtf") ? "rtf" : "docx";
  const content = fileType === "rtf" ? stored.buffer.toString("latin1") : stored.buffer.toString("utf8");
  const placeholders = detectAllPlaceholders(content);
  const mappings = await listResolverMappings(db, templateId);
  const mapped = new Set(mappings.map((item) => normalizePlaceholder(item.placeholder)));

  return {
    templateVersionId: latest.id,
    placeholders,
    unknownPlaceholders: placeholders.filter((item) => !mapped.has(item.normalizedKey)),
    parserWarnings: fileType === "docx"
      ? ["DOCX parser penuh belum tersedia. Preview placeholder DOCX memakai scan aman yang dapat melewatkan XML terkompresi."]
      : [],
  };
}

export async function getVariablePreview(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    templateId: string;
    nomorPerkara: string;
    sippPerkaraId?: string;
    options?: JlfResolverContext["options"];
  }
) {
  const [resolved, placeholderReport] = await Promise.all([
    resolveVariablesForTemplate(db, actor, input),
    getUnknownPlaceholders(db, input.templateId),
  ]);

  return {
    ...resolved,
    placeholders: placeholderReport.placeholders,
    unknownPlaceholders: placeholderReport.unknownPlaceholders,
    parserWarnings: placeholderReport.parserWarnings,
  };
}

export const SippPerkaraResolver = { resolveBySource };
export const SippPihakResolver = { resolveBySource };
export const SippJadwalSidangResolver = { resolveBySource };
export const SippHakimResolver = { resolveBySource };
export const SippPaniteraResolver = { resolveBySource };
export const SippJurusitaResolver = { resolveBySource };
export const SippPutusanResolver = { resolveBySource };
export const ManualDataResolver = { getManualValueForVariable };
export const FunctionResolver = { resolveComputedValue };
export const StaticResolver = { resolveBySource };
export const ComputedResolver = { resolveComputedValue };
export const QrCodeResolver = { resolveComputedValue };
export const AiResolver = {
  resolve: () => ({
    key: "ai",
    value: null,
    source: "ai",
    confidence: 0,
    warnings: ["AI resolver JLF masih placeholder sampai tahap AI penuh."],
  }),
};

export const JlfResolverRegistry = {
  getResolver(sourceType: string) {
    if (sourceType === "sipp_perkara") return SippPerkaraResolver;
    if (sourceType === "sipp_pihak") return SippPihakResolver;
    if (sourceType === "sipp_jadwal_sidang") return SippJadwalSidangResolver;
    if (sourceType === "sipp_hakim") return SippHakimResolver;
    if (sourceType === "sipp_panitera") return SippPaniteraResolver;
    if (sourceType === "sipp_jurusita") return SippJurusitaResolver;
    if (sourceType === "sipp_putusan" || sourceType === "sipp_keuangan") return SippPutusanResolver;
    if (sourceType === "jlf_manual") return ManualDataResolver;
    if (sourceType === "jlf_bas_qa") return FunctionResolver;
    if (sourceType === "function") return FunctionResolver;
    if (sourceType === "static") return StaticResolver;
    if (sourceType === "computed") return ComputedResolver;
    if (sourceType === "qrcode") return QrCodeResolver;
    if (sourceType === "ai") return AiResolver;
    return StaticResolver;
  },
};

export const JlfVariableResolverService = {
  resolveVariablesForTemplate,
  resolveVariableRecord,
  getVariablePreview,
  getMissingRequiredVariables,
  getUnknownPlaceholders,
  getWarnings,
  saveManualValue,
};

export const JlfVariablePreviewService = {
  resolveVariablesForTemplate,
  getVariablePreview,
  getMissingRequiredVariables,
  getUnknownPlaceholders,
  getWarnings,
  saveManualValue,
};
