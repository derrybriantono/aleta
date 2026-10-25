import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { schema, type DrizzleSchema } from "@/server/db/drizzle-schema";
import { ensureAletaSchema, tandaiSkemaAletaSudahAda } from "@/server/db/schema";
import { seedDatabaseFromFrontendSource } from "@/server/db/seed";

export type SqlInputValue =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | string[]
  | number[]
  | Record<string, unknown>;

type CreateDatabaseOptions = {
  connectionString?: string;
  seed?: boolean;
  useInMemory?: boolean;
  runMigrations?: boolean;
};

type InMemorySnapshot = {
  version: 1;
  updatedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
};

type Queryable = Pool | PoolClient;
type DatabaseCapabilities = {
  supportsFullTextSearch: boolean;
};

type RuntimeDatabaseMode = "postgres" | "fallback";

type DatabaseConnectionTarget = {
  host: string;
  port: number;
  database: string;
  redactedUrl: string;
};

type DatabaseRuntimeTracker = {
  activeMode: RuntimeDatabaseMode | null;
  lastBootError: string | null;
};

type PgMemQueryConfig = {
  rowMode?: string;
  types?: {
    getTypeParser?: unknown;
  };
};

type PgMemQueryResult = {
  rows: Array<Record<string, unknown>> | unknown[][];
  [key: string]: unknown;
};

type PgMemCompatCtor = {
  new (...args: unknown[]): unknown;
  prototype: PgMemCompatPrototype;
};

type PgMemCompatPrototype = {
  __aletaPgMemCompatPatched?: boolean;
  adaptQuery?: (query: string | PgMemQueryConfig, values?: unknown[]) => unknown;
  adaptResults?: (query: PgMemQueryConfig, result: PgMemQueryResult) => PgMemQueryResult;
};

function patchPgMemPgCompatibility(adapter: {
  Pool: PgMemCompatCtor;
  Client: PgMemCompatCtor;
}) {
  for (const ctor of [adapter.Pool, adapter.Client]) {
    const prototype = ctor.prototype;
    if (
      prototype.__aletaPgMemCompatPatched ||
      typeof prototype.adaptQuery !== "function" ||
      typeof prototype.adaptResults !== "function"
    ) {
      continue;
    }

    const originalAdaptQuery = prototype.adaptQuery;
    const originalAdaptResults = prototype.adaptResults;

    prototype.adaptQuery = function (query: string | PgMemQueryConfig, values?: unknown[]) {
      if (typeof query !== "string" && query?.types && typeof query.types.getTypeParser === "function") {
        const nextQuery = { ...query };
        delete nextQuery.types;
        return originalAdaptQuery.call(this, nextQuery, values);
      }

      return originalAdaptQuery.call(this, query, values);
    };

    prototype.adaptResults = function (query: PgMemQueryConfig, result: PgMemQueryResult) {
      if (query?.rowMode === "array") {
        const baseResult = originalAdaptResults.call(this, { ...query, rowMode: undefined }, result);
        const objectRows = baseResult.rows as Array<Record<string, unknown>>;

        return {
          ...baseResult,
          rows: objectRows.map((row) => Object.keys(row).map((key) => row[key])),
        };
      }

      return originalAdaptResults.call(this, query, result);
    };

    prototype.__aletaPgMemCompatPatched = true;
  }

  return adapter;
}

function toPostgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

class PreparedStatement {
  constructor(
    private readonly db: AletaDatabase,
    private readonly sql: string
  ) {}

  async get<T extends QueryResultRow = QueryResultRow>(...params: SqlInputValue[]) {
    return this.db.queryOne<T>(this.sql, params);
  }

  async all<T extends QueryResultRow = QueryResultRow>(...params: SqlInputValue[]) {
    return this.db.queryAll<T>(this.sql, params);
  }

  async run(...params: SqlInputValue[]) {
    return this.db.run(this.sql, params);
  }
}

export class AletaDatabase {
  constructor(
    private readonly queryable: Queryable,
    private readonly orm: NodePgDatabase<DrizzleSchema>,
    private readonly closeHook?: () => Promise<void>,
    private readonly transactional = false,
    private readonly capabilities: DatabaseCapabilities = {
      supportsFullTextSearch: true,
    }
  ) {}

  prepare(sql: string) {
    return new PreparedStatement(this, sql);
  }

  async exec(sql: string) {
    await this.query(sql);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: SqlInputValue[] = []
  ) {
    const text = params.length > 0 ? toPostgresPlaceholders(sql) : sql;
    return this.queryable.query<T>(text, params);
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: SqlInputValue[] = []
  ) {
    const result = await this.query<T>(sql, params);
    return result.rows[0];
  }

  async queryAll<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: SqlInputValue[] = []
  ) {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  async run(sql: string, params: SqlInputValue[] = []) {
    const result = await this.query(sql, params);
    return {
      changes: result.rowCount ?? 0,
      rows: result.rows,
    };
  }

  async close() {
    await this.closeHook?.();
  }

  isTransactionClient() {
    return this.transactional;
  }

  getQueryable() {
    return this.queryable;
  }

  getOrm() {
    return this.orm;
  }

  supportsFullTextSearch() {
    return this.capabilities.supportsFullTextSearch;
  }

  getCapabilities() {
    return this.capabilities;
  }
}

const globalForAleta = globalThis as unknown as {
  singletonDatabasePromise: Promise<AletaDatabase> | null;
  sharedPool: Pool | null;
  sharedDrizzle: NodePgDatabase<DrizzleSchema> | null;
  runtimeDatabaseTracker: DatabaseRuntimeTracker | null;
};

const IN_MEMORY_SNAPSHOT_PATH = path.join(process.cwd(), "data", "dev-fallback-db.json");
/**
 * Tabel yang ditulis ke cetakan JSON saat Postgres mati dan dipulihkan saat
 * mulai ulang - DALAM URUTAN INI. Urutan menghormati kunci asing: tabel yang
 * dirujuk berdiri lebih dulu (users sebelum aleta_antrian_publik), sebab
 * pemulihan menyisipkan baris satu per satu dan pg-mem menegakkan kunci asing.
 *
 * Tabel yang TIDAK tercantum di sini kehilangan seluruh barisnya pada setiap
 * mulai ulang mode cadangan - tanpa satu pun pesan. Terukur 25 September 2026:
 * aleta_keterangan_perkara tersisa 0 baris, aleta_isian_perkara (terdaftar)
 * tersisa 1. Penjaga tabel-cadangan-terdaftar.test.ts menuntut setiap tabel
 * yang dibuat ensureAletaSchema tercantum di sini ATAU di
 * TABEL_TANPA_CADANGAN_INGATAN beserta alasannya.
 */
export const IN_MEMORY_TABLE_PERSISTENCE_ORDER = [
  "roles",
  "positions",
  "users",
  "external_app_credentials",
  "acting_assignments",
  "ai_global_settings",
  "ai_providers",
  "ai_module_settings",
  "ai_suggestion_logs",
  "whatsapp_web_settings",
  "aleta_bot_settings",
  "aleta_bot_templates",
  "aleta_bot_jobs",
  "aleta_bot_queries",
  "aleta_bot_db_connections",
  "aleta_bot_public_qa_intents",
  "aleta_bot_public_qa_examples",
  "aleta_bot_public_qa_logs",
  "aleta_bot_public_qa_sessions",
  "aleta_bot_notifications",
  "aleta_bot_notification_logs",
  "aleta_bot_logs",
  "aleta_bot_policy_skip_logs",
  "aleta_bot_disposition_reminder_runs",
  "institution_identity",
  "panel_settings",
  "institution_identity_enrichments",
  "module_visibility_settings",
  "ecourt_extension_access",
  "ecourt_extension_access_user",
  "tata_letak_dasbor",
  "sesi_portal",
  "tata_letak_bawaan",
  "aleta_sipp_hari_sidang",
  "aleta_sipp_aturan_penunjukan",
  "aleta_sipp_penunjukan_antrean",
  "aleta_bas_lembar",
  "aleta_bas_jawaban",
  "aleta_bas_kehadiran",
  "aleta_berkas_riwayat",
  "aleta_pertimbangan_butir",
  "aleta_pertimbangan_rujukan",
  "aleta_pertimbangan_asal",
  "aleta_ai_pemakaian",
  "aleta_ai_pagu",
  "aleta_ai_tarif",
  "aleta_kamus_variabel",
  "aleta_kamus_salin",
  "aleta_blok_kalimat",
  "aleta_blangko_sumber",
  "aleta_blok_geser",
  "aleta_korpus_jalan",
  "aleta_blangko",
  "aleta_blangko_bagian",
  "aleta_blangko_terbit",
  "aleta_saklar_periksa",
  "aleta_saklar_riwayat",
  "aleta_uji_mandiri",
  "aleta_kehadiran_mediasi",
  "aleta_isian_perkara",
  "aleta_isian_riwayat",
  "aleta_sumber_aplikasi",
  "aleta_keajekan_jalan",
  "aleta_ai_saklar",
  "aleta_ai_percakapan",
  "aleta_ai_pesan",
  "aleta_ai_fakta",
  "aleta_aturan_periksa",
  "aleta_perkara_sidik",
  "aleta_batas_data",
  "aleta_putusan_draf_dasar",
  "aleta_putusan_draf",
  "aleta_putusan_draf_butir",
  "aleta_putusan_draf_nilai",
  "aleta_sipp_borang_medan",
  "aleta_sipp_penunjukan_log",
  // 25 September 2026: lima tabel ALETA yang terukur tidak ikut cadangan, dan
  // dua tabel tipe keluaran (0050). aleta_antrian_publik merujuk users(id) -
  // users sudah berdiri di atas.
  "aleta_abt_riwayat",
  "aleta_konseptor_sementara",
  "aleta_keterangan_perkara",
  "aleta_rekam_antrian",
  "aleta_antrian_publik",
  "aleta_tipe_keluaran",
  "aleta_tipe_keluaran_riwayat",
  // 29 September 2026 (0052): tampilan ekstensi yang diterapkan admin dan
  // setelan pribadi ekstensi. Tanpa kunci asing - urutannya bebas.
  "aleta_ekstensi_tampilan",
  "aleta_ekstensi_setelan",
  // 29 September 2026 (0053): komentar hakim atas BAS, templat pertimbangan &
  // dasar hukum, variabel wajib ABT. Tanpa kunci asing - urutannya bebas.
  "aleta_bas_komentar",
  "aleta_templat_hukum",
  "aleta_abt_variabel_wajib",
  // 30 September 2026 (0054): pemetaan blangko putusan/relaas/PBT dan profil
  // saklar per peran. Tanpa kunci asing - urutannya bebas.
  "aleta_pemetaan_blangko",
  "aleta_profil_saklar",
  // 1 Oktober 2026 (0055): jejak aksi e-Court lewat sesi pribadi. Tanpa
  // kunci asing - urutannya bebas.
  "aleta_ecourt_aksi_jejak",
  // 2 Oktober 2026 (0056): cap pengadilan untuk edoc penetapan. Tanpa kunci
  // asing - urutannya bebas.
  "aleta_ecourt_cap",
  // 7 Oktober 2026 (0058): jejak masuk ALETA dengan akun SIPP. Tanpa kunci
  // asing - urutannya bebas.
  "aleta_masuk_jejak",
  // 10 Oktober 2026 (0060): kamus deteksi & kalimat (lapis database), jejak
  // koreksi petugas atas usulan ALETA, calon pola/templat dari koreksi. Tanpa
  // kunci asing - urutannya bebas. 11 Oktober 2026 (0063): kolom `tambahan`
  // (ruas tambahan pola/templat) ikut tersalin karena cadangan menyalin
  // seluruh kolom; potret lama tanpa kolom itu dipulihkan dengan bawaan '{}'.
  "aleta_kamus_deteksi_pola",
  "aleta_kamus_deteksi_templat",
  "aleta_jejak_koreksi",
  "aleta_kamus_deteksi_calon",
  // 16 Oktober 2026 (0066): cadangan & riwayat suntingan ABT dari halaman
  // Pengaturan SIPP & ABT. Tanpa kunci asing - urutannya bebas.
  "aleta_abt_suntingan",
  // 17 Oktober 2026 (0067): checklist Konseptor Sementara - tanda langkah dan
  // laporan isian Blangko Derry. Tanpa kunci asing - urutannya bebas.
  "aleta_konseptor_langkah",
  "aleta_konseptor_blangko",
  // 17 Oktober 2026 (0068): agen H-7 draf putusan - draf per Hari Putusan dan
  // catatan jalan agen. Tanpa kunci asing - urutannya bebas.
  "aleta_agen_h7_draf",
  "aleta_agen_h7_jalan",
  // 17 Oktober 2026 (0069): identitas satker & logo kop untuk blangko ABT
  // (satu baris). Tanpa kunci asing - urutannya bebas.
  "aleta_identitas_satker",
  // 17 Oktober 2026 (0070): SKP jabatan perkara - pemetaan akun SIPP ke pegawai,
  // target, isian manual, dan penetapan. Tanpa kunci asing - urutannya bebas.
  "aleta_skp_akun_pegawai",
  "aleta_skp_target",
  "aleta_skp_isian",
  "aleta_skp_penetapan",
  // 18 Oktober 2026 (0073): blangko pribadi (buat blangko sendiri) dan riwayatnya.
  // Tanpa kunci asing - urutannya bebas.
  "aleta_blangko_pribadi",
  "aleta_blangko_pribadi_riwayat",
  // 20 Oktober 2026 (0077): tautan Jadwal Sidang tanpa akun, jejaknya, dan saklarnya.
  // Tanpa kunci asing - urutannya bebas.
  "aleta_tautan_jadwal",
  "aleta_tautan_jadwal_jejak",
  "aleta_tautan_jadwal_saklar",
  // 20 Oktober 2026 (0078): ALETA Ai tahap 1. Tanpa kunci asing - urutannya bebas.
  "aleta_ai_proyek",
  "aleta_ai_obrolan",
  "aleta_ai_obrolan_pesan",
  "aleta_ai_penggunaan",
  "aleta_ai_saldo",
  "aleta_ai_mutasi",
  "aleta_ai_harga",
  "aleta_ai_kurs",
  "aleta_ai_pengaturan",
  "aleta_ai_rute",
  "aleta_ai_jejak",
  // 25 Oktober 2026 (0088): ALETA Ai tahap 4 - kuota hibah per peran, rekonsiliasi harian.
  "aleta_ai_kuota_peran",
  "aleta_ai_rekonsiliasi",
  // 21 Oktober 2026 (0080): Unggah Putusan Terjadwal. Tanpa kunci asing - urutannya bebas.
  "aleta_putusan_jadwal",
  "aleta_putusan_jadwal_butir",
  "aleta_putusan_jadwal_berkas",
  "aleta_putusan_jadwal_jejak",
  // 21 Oktober 2026 (0081): arsip hasil mediasi per perkara.
  "aleta_mediasi_berkas",
  "aleta_mediasi_berkas_jejak",
  // 22 Oktober 2026 (0083): saklar sidang keliling per hari + hakim yang menyidangkan per perkara.
  "aleta_sidang_keliling_hari",
  "aleta_hakim_sidang_perkara",
  // 23 Oktober 2026 (0084): ALETA Ai tahap 2a - kode samaran per percakapan.
  "aleta_ai_samaran",
  // 23 Oktober 2026 (0085): jejak masuk & perangkat, batas perangkat. Tanpa kunci asing.
  "aleta_jejak_masuk",
  "aleta_perangkat",
  "aleta_sesi_perangkat",
  "aleta_batas_perangkat",
  "aleta_tiket_perangkat",
  "aleta_setelan_jejak_masuk",
  // 25 Oktober 2026 (0086-0087): ALETA Ai tahap 3 - tugas, berkas keluaran, templat proyek, kiriman.
  "aleta_ai_tugas",
  "aleta_ai_tugas_langkah",
  "aleta_ai_berkas",
  "aleta_ai_proyek_berkas",
  "aleta_ai_kiriman",
  // 25 Oktober 2026 (0107): setelan keamanan, riwayat sandi (sidik), status sandi per akun. Tanpa kunci asing.
  "aleta_setelan_keamanan",
  "aleta_riwayat_sandi",
  "aleta_status_sandi",
  // 25 Oktober 2026 (0108): jaringan kantor + aturan jaringan per peran. Tanpa kunci asing.
  "aleta_subnet_kantor",
  "aleta_aturan_jaringan_peran",
  "feedback_requests",
  "user_notification_reads",
  "knowledge_base_regulations",
  "letter_origin_references",
  "classification_catalog",
  "letter_number_sequences",
  "letter_templates",
  "letters",
  "letter_tags",
  "letter_classification_tags",
  "letter_attachments",
  "letter_whatsapp_deliveries",
  "dispositions",
  "disposition_whatsapp_deliveries",
  "employee_profiles",
  "hr_leave_types",
  "hr_settings",
  "hr_leave_balances",
  "hr_leave_balance_transactions",
  "hr_leave_requests",
  "hr_leave_approval_logs",
  "hr_leave_attachments",
  "hr_submissions",
  "hr_submission_attachments",
  "hr_attendance_permissions",
  "hr_attendance_permission_attachments",
  "hr_meeting_results",
  "hr_employee_documents",
  "hr_holidays",
  "hr_employee_signatures",
  "hr_annual_document_requirements",
  "hr_notification_templates",
  "hr_generated_documents",
  "aleta_sipp_tables",
  "aleta_sipp_columns",
  "aleta_sipp_relations",
  "aleta_sipp_query_registry",
  "aleta_sipp_query_parameters",
  "aleta_sipp_query_outputs",
  "aleta_sipp_variables",
  "aleta_sipp_variable_mappings",
  "aleta_sipp_query_table_links",
  "aleta_sipp_query_variable_links",
  "aleta_sipp_variable_template_links",
  "aleta_sipp_unresolved_placeholders",
  "aleta_sipp_variable_conflicts",
  "aleta_sipp_import_jobs",
  "aleta_sipp_import_job_items",
  "aleta_sipp_assessment_indicators",
  "aleta_sipp_assessment_queries",
  "aleta_sipp_assessment_runs",
  "aleta_sipp_assessment_results",
  "aleta_sipp_assessment_result_items",
  "aleta_sipp_pdf_templates",
  "aleta_sipp_audit_logs",
  "aleta_sipp_ai_logs",
  "aleta_sipp_user_saved_queries",
  "aleta_sipp_query_favorites",
  "estatus_sipp_connections",
  "estatus_sipp_mappings",
  "estatus_sipp_schema_snapshots",
  "estatus_sync_logs",
  "estatus_agencies",
  "estatus_records",
  "estatus_parties",
  "estatus_validation_rules",
  "estatus_validation_results",
  "estatus_batches",
  "estatus_batch_items",
  "estatus_record_snapshots",
  "estatus_agency_templates",
  "estatus_transmission_logs",
  "estatus_agency_feedbacks",
  "estatus_documents",
  "estatus_file_exchange_logs",
  "estatus_api_integrations",
  "estatus_api_requests",
  "estatus_ai_assist_logs",
  "estatus_incident_logs",
  "estatus_data_minimization_findings",
  "estatus_audit_logs",
  "audit_logs",
  "accounts",
  "sessions",
  "verifications",
] as const;

/**
 * Tabel yang SENGAJA atau (belum) tidak ikut cetakan JSON - masing-masing
 * dengan alasannya. Daftar ini ada supaya lubangnya TERLIHAT: tabel baru yang
 * lupa didaftarkan membuat tabel-cadangan-terdaftar.test.ts merah, dan satu-
 * satunya jalan menghijaukannya tanpa mendaftarkan adalah menulis alasannya di
 * sini, di depan mata peninjau.
 *
 * "Utang lama" berarti tabel itu sudah tidak ikut cadangan sebelum penjaga ini
 * ada (terukur 25 September 2026) dan BELUM ditimbang - bukan dinyatakan aman.
 * Barisnya hilang pada mulai ulang mode cadangan.
 */
const UTANG_LAMA =
  "Utang lama: tidak ikut cadangan sejak sebelum penjaga ini ada; barisnya hilang saat mulai ulang mode cadangan. Belum ditimbang, bukan dinyatakan aman.";
const KATALOG_JLF =
  "Katalog JLF disemai ulang dari kode pada setiap boot (jlfSeedStatements / seedJlfVariableCatalog); isi tangan di tabel ini belum ikut cadangan.";
export const TABEL_TANPA_CADANGAN_INGATAN: Readonly<Record<string, string>> = {
  aleta_sipp_legacy_feature_catalog: UTANG_LAMA,
  aleta_sipp_monitoring_categories: UTANG_LAMA,
  aleta_sipp_monitoring_exports: UTANG_LAMA,
  aleta_sipp_monitoring_indicator_mappings: UTANG_LAMA,
  aleta_sipp_monitoring_indicators: UTANG_LAMA,
  aleta_sipp_monitoring_jobs: UTANG_LAMA,
  aleta_sipp_monitoring_manual_inputs: UTANG_LAMA,
  aleta_sipp_monitoring_result_items: UTANG_LAMA,
  aleta_sipp_monitoring_results: UTANG_LAMA,
  aleta_sipp_monitoring_runs: UTANG_LAMA,
  aleta_sipp_monitoring_sources: UTANG_LAMA,
  assistant_judge_settings: UTANG_LAMA,
  hr_public_submissions: UTANG_LAMA,
  password_reset_requests: UTANG_LAMA,
  jlf_categories: KATALOG_JLF,
  jlf_settings: KATALOG_JLF,
  jlf_regulation_types: KATALOG_JLF,
  jlf_regulation_topics: KATALOG_JLF,
  jlf_variables: KATALOG_JLF,
  jlf_ai_logs: UTANG_LAMA,
  jlf_ai_prompts: UTANG_LAMA,
  jlf_audit_logs: UTANG_LAMA,
  jlf_document_validation_logs: UTANG_LAMA,
  jlf_document_variables_snapshot: UTANG_LAMA,
  jlf_generated_documents: UTANG_LAMA,
  jlf_legal_analysis_sessions: UTANG_LAMA,
  jlf_legal_analysis_sources: UTANG_LAMA,
  jlf_manual_values: UTANG_LAMA,
  jlf_regulation_sections: UTANG_LAMA,
  jlf_regulation_topic_links: UTANG_LAMA,
  jlf_regulation_versions: UTANG_LAMA,
  jlf_regulations: UTANG_LAMA,
  jlf_sipp_account_links: UTANG_LAMA,
  jlf_sipp_role_mappings: UTANG_LAMA,
  jlf_sipp_user_snapshots: UTANG_LAMA,
  jlf_template_regulations: UTANG_LAMA,
  jlf_template_variables: UTANG_LAMA,
  jlf_template_versions: UTANG_LAMA,
  jlf_templates: UTANG_LAMA,
  jlf_variable_regulations: UTANG_LAMA,
  jlf_whatsapp_notification_logs: UTANG_LAMA,
  jlf_whatsapp_notification_templates: UTANG_LAMA,
};

let singletonDatabasePromise = globalForAleta.singletonDatabasePromise;
let sharedPool = globalForAleta.sharedPool;
let sharedDrizzle = globalForAleta.sharedDrizzle;
let runtimeDatabaseTracker =
  globalForAleta.runtimeDatabaseTracker ??
  ({
    activeMode: null,
    lastBootError: null,
  } satisfies DatabaseRuntimeTracker);

function persistRuntimeTracker() {
  globalForAleta.runtimeDatabaseTracker = runtimeDatabaseTracker;
}

function updateRuntimeDatabaseTracker(
  next: Partial<DatabaseRuntimeTracker>
) {
  runtimeDatabaseTracker = {
    ...runtimeDatabaseTracker,
    ...next,
  };
  persistRuntimeTracker();
}

function parseDatabaseConnectionTarget(connectionString: string): DatabaseConnectionTarget | null {
  try {
    const parsed = new URL(connectionString);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      redactedUrl: `${parsed.protocol}//${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "") || "postgres"}`,
    };
  } catch {
    return null;
  }
}

async function checkTcpReachable(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1200);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function getDatabaseRuntimeStatus() {
  const configuredUrl = getDatabaseUrl();
  const target = parseDatabaseConnectionTarget(configuredUrl);
  const postgresReachable = target ? await checkTcpReachable(target.host, target.port) : false;

  return {
    activeMode: runtimeDatabaseTracker.activeMode ?? (postgresReachable ? "postgres" : "fallback"),
    postgres: {
      configured: Boolean(target),
      reachable: postgresReachable,
      host: target?.host ?? null,
      port: target?.port ?? null,
      database: target?.database ?? null,
      redactedUrl: target?.redactedUrl ?? null,
      lastBootError: runtimeDatabaseTracker.lastBootError,
    },
    fallback: {
      enabled: !isInMemoryFallbackDisabled(),
      snapshotPath: IN_MEMORY_SNAPSHOT_PATH,
    },
    persistence: {
      userAndLetterDataPersisted: true,
    },
  };
}

function normalizeEnvFlag(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isExplicitlyEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(normalizeEnvFlag(value));
}

function isPublicRuntimeTarget() {
  const markers = [
    process.env.NODE_ENV,
    process.env.ALETA_DEPLOYMENT_TARGET,
    process.env.ALETA_ENV,
    process.env.NEXT_PUBLIC_ALETA_ENV,
  ]
    .map((value) => normalizeEnvFlag(value))
    .filter(Boolean);

  return markers.some((value) =>
    value === "production" ||
    value === "prod" ||
    value === "staging" ||
    value === "staging-public" ||
    value === "public" ||
    value.includes("staging-public")
  );
}

function isInMemoryFallbackDisabled() {
  if (isExplicitlyEnabled(process.env.ALETA_DISABLE_IN_MEMORY_FALLBACK)) return true;
  if (isPublicRuntimeTarget() && !isExplicitlyEnabled(process.env.ALETA_ALLOW_IN_MEMORY_FALLBACK)) return true;
  return false;
}

function isRecoverablePostgresBootError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    cause?: { code?: string } | null;
    message?: string;
  };
  const code = candidate.code ?? candidate.cause?.code ?? "";
  const message = candidate.message ?? "";

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect")
  );
}

async function resetSharedConnections() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }

  sharedDrizzle = null;
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function getSqlText(query: unknown) {
  if (typeof query === "string") return query;
  if (query && typeof query === "object" && "text" in query && typeof (query as { text?: unknown }).text === "string") {
    return (query as { text: string }).text;
  }
  return "";
}

function classifySqlStatement(query: unknown) {
  const sql = getSqlText(query).trim().replace(/^[;(]+/, "").toUpperCase();

  if (!sql) return "read" as const;
  if (sql.startsWith("BEGIN")) return "begin" as const;
  if (sql.startsWith("COMMIT")) return "commit" as const;
  if (sql.startsWith("ROLLBACK TO SAVEPOINT")) return "rollback-savepoint" as const;
  if (sql.startsWith("ROLLBACK")) return "rollback" as const;
  if (sql.startsWith("SAVEPOINT") || sql.startsWith("RELEASE SAVEPOINT")) return "savepoint" as const;
  if (/^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REINDEX)/.test(sql)) return "mutation" as const;
  return "read" as const;
}

function normalizeSnapshotValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: "date", value: value.toISOString() };
  }

  if (Buffer.isBuffer(value)) {
    return { __type: "buffer", value: value.toString("base64") };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshotValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeSnapshotValue(item)])
    );
  }

  return value;
}

function reviveSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => reviveSnapshotValue(item));
  }

  if (value && typeof value === "object") {
    const candidate = value as { __type?: string; value?: unknown };
    if (candidate.__type === "date" && typeof candidate.value === "string") {
      return new Date(candidate.value);
    }
    if (candidate.__type === "buffer" && typeof candidate.value === "string") {
      return Buffer.from(candidate.value, "base64");
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, reviveSnapshotValue(item)])
    );
  }

  return value;
}

async function persistInMemorySnapshot(memoryDb: {
  public: {
    getTable: (name: string, nullIfNotFound?: boolean) => { find: () => Array<Record<string, unknown>> } | null;
  };
}) {
  const tables: Record<string, Array<Record<string, unknown>>> = {};

  for (const tableName of IN_MEMORY_TABLE_PERSISTENCE_ORDER) {
    const table = memoryDb.public.getTable(tableName, true);
    if (!table) {
      tables[tableName] = [];
      continue;
    }

    tables[tableName] = table.find().map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeSnapshotValue(value)]))
    );
  }

  const snapshot: InMemorySnapshot = {
    version: 1,
    updatedAt: new Date().toISOString(),
    tables,
  };

  await mkdir(path.dirname(IN_MEMORY_SNAPSHOT_PATH), { recursive: true });
  const tempPath = `${IN_MEMORY_SNAPSHOT_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
  await rm(IN_MEMORY_SNAPSHOT_PATH, { force: true });
  await writeFile(IN_MEMORY_SNAPSHOT_PATH, await readFile(tempPath, "utf8"), "utf8");
  await rm(tempPath, { force: true });
}

async function restoreInMemorySnapshot(
  db: AletaDatabase,
  memoryDb: {
    public: {
      getTable: (name: string, nullIfNotFound?: boolean) => { find: () => Array<Record<string, unknown>> } | null;
    };
  }
) {
  try {
    const raw = await readFile(IN_MEMORY_SNAPSHOT_PATH, "utf8");
    const snapshot = JSON.parse(raw) as InMemorySnapshot;

    if (snapshot.version !== 1 || !snapshot.tables) {
      return false;
    }

    const hasEssentialSeedBaseline =
      (snapshot.tables.roles?.length ?? 0) > 0 &&
      (snapshot.tables.positions?.length ?? 0) > 0 &&
      (snapshot.tables.users?.length ?? 0) > 0 &&
      (snapshot.tables.accounts?.length ?? 0) > 0;

    if (!hasEssentialSeedBaseline) {
      console.warn("[ALETA DB] Snapshot fallback terdeteksi parsial dan akan diabaikan agar baseline disusun ulang.");
      return false;
    }

    const restoreRows = async (tableName: string, rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
        await db.prepare(sql).run(...columns.map((column) => reviveSnapshotValue(row[column]) as SqlInputValue));
      }
    };

    for (const tableName of IN_MEMORY_TABLE_PERSISTENCE_ORDER) {
      const existingTable = memoryDb.public.getTable(tableName, true);
      if (!existingTable) continue;

      if (tableName === "positions") {
        const positionRows = snapshot.tables[tableName] ?? [];
        const baseRows = positionRows.map((row) =>
          row.reports_to_position_id
            ? {
                ...row,
                reports_to_position_id: null,
              }
            : row
        );

        await restoreRows(tableName, baseRows);

        for (const row of positionRows.filter((item) => item.reports_to_position_id)) {
          await db
            .prepare(
              `UPDATE ${quoteIdentifier(tableName)}
               SET reports_to_position_id = ?
               WHERE id = ?`
            )
            .run(
              reviveSnapshotValue(row.reports_to_position_id) as SqlInputValue,
              reviveSnapshotValue(row.id) as SqlInputValue
            );
        }

        continue;
      }

      // ======================================================================
      // BARIS YANG SUDAH DITANAM SKEMA DIGANTI ISI CETAKAN, TIDAK DIGANDAKAN
      // ======================================================================
      //
      // Pemulihan berjalan SESUDAH ensureAletaSchema, dan skema menanam baris
      // bawaan untuk sebagian tabel - baris tunggal aleta_antrian_publik (id 1).
      // Menyisipkan baris cetakan di atasnya menabrak kunci utama, dan tabrakan
      // itu menggagalkan SELURUH pemulihan: cetakan dianggap rusak, baseline
      // disusun ulang, lalu cetakan lama ditimpa - semua isian saat Postgres
      // mati lenyap karena satu tabel. Cetakan adalah keadaan terakhir yang
      // sesungguhnya, maka isinya yang menang.
      //
      // Yang diganti HANYA baris yang id-nya juga ada di cetakan. Baris tanaman
      // skema yang lebih baru dari cetakan (id-nya belum ada di sana) tetap
      // tinggal - kalau ikut dibuang, ia tidak akan pernah muncul selama
      // portal berjalan di mode cadangan. Terukur 26 September 2026: dari 168
      // tabel terdaftar, hanya aleta_antrian_publik yang berisi sesudah skema.
      const barisCetakan = snapshot.tables[tableName] ?? [];
      const barisSkema = barisCetakan.length > 0 ? existingTable.find() : [];
      if (barisSkema.length > 0) {
        const berId = barisSkema.every((b) => b.id !== undefined) && barisCetakan.every((b) => b.id !== undefined);
        if (berId) {
          const idCetakan = new Set(barisCetakan.map((b) => String(reviveSnapshotValue(b.id))));
          for (const b of barisSkema) {
            if (!idCetakan.has(String(b.id))) continue;
            await db.prepare(`DELETE FROM ${quoteIdentifier(tableName)} WHERE id = ?`).run(b.id as SqlInputValue);
          }
        } else {
          // Tabel tanpa kolom id: kunci utamanya tidak dapat dibaca dari sini,
          // maka seluruh isinya diganti cetakan.
          await db.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
        }
      }

      await restoreRows(tableName, barisCetakan);
    }

    return true;
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    if (candidate?.code === "ENOENT") {
      return false;
    }

    console.warn("[ALETA DB] Snapshot fallback tidak dapat dimuat, sistem akan membuat baseline baru.", error);
    return false;
  }
}

function installInMemoryPersistenceHooks(
  pool: Pool & { connect: Pool["connect"] },
  persistSnapshot: () => Promise<void>
) {
  const trackedTargets = new WeakSet<object>();
  let persistQueue = Promise.resolve();

  const schedulePersist = async () => {
    persistQueue = persistQueue
      .then(() => persistSnapshot())
      .catch((error) => {
        console.error("[ALETA DB] Gagal menyimpan snapshot fallback.", error);
      });
    await persistQueue;
  };

  const wrapQueryable = (target: object & { query: (...args: unknown[]) => Promise<unknown> }) => {
    if (trackedTargets.has(target)) {
      return target;
    }

    trackedTargets.add(target);
    let transactionDepth = 0;
    const originalQuery = target.query.bind(target);

    target.query = async (...args: unknown[]) => {
      const statementType = classifySqlStatement(args[0]);
      const result = await originalQuery(...args);

      if (statementType === "begin") {
        transactionDepth += 1;
        return result;
      }

      if (statementType === "savepoint" || statementType === "rollback-savepoint") {
        return result;
      }

      if (statementType === "commit") {
        const wasRootTransaction = transactionDepth <= 1;
        transactionDepth = Math.max(0, transactionDepth - 1);
        if (wasRootTransaction) {
          await schedulePersist();
        }
        return result;
      }

      if (statementType === "rollback") {
        transactionDepth = Math.max(0, transactionDepth - 1);
        return result;
      }

      if (statementType === "mutation" && transactionDepth === 0) {
        await schedulePersist();
      }

      return result;
    };

    return target;
  };

  wrapQueryable(pool as unknown as object & { query: (...args: unknown[]) => Promise<unknown> });

  const originalConnect = pool.connect.bind(pool);
  pool.connect = ((callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void) => {
    if (typeof callback === "function") {
      return originalConnect((err, client, done) => {
        callback(
          err,
          client
            ? (wrapQueryable(
                client as unknown as object & { query: (...args: unknown[]) => Promise<unknown> }
              ) as PoolClient)
            : client,
          done
        );
      });
    }

    return originalConnect().then((client) =>
      wrapQueryable(client as unknown as object & { query: (...args: unknown[]) => Promise<unknown> }) as PoolClient
    );
  }) as Pool["connect"];
}

export function getSharedPool() {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
    globalForAleta.sharedPool = sharedPool;
  }

  return sharedPool;
}

export function getSharedDrizzle() {
  if (!sharedDrizzle) {
    sharedDrizzle = drizzle(getSharedPool(), { schema });
    globalForAleta.sharedDrizzle = sharedDrizzle;
  }

  return sharedDrizzle;
}

export async function runDatabaseMigrations(db: NodePgDatabase<DrizzleSchema>) {
  await drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

/**
 * ============================================================================
 * CETAKAN pg-mem - HANYA SAAT PENGUJIAN
 * ============================================================================
 *
 * Membangun basis data dalam ingatan memakan sekitar sepuluh detik: empat detik
 * menyusun 185 tabel dan 240 indeks, sisanya menyisipkan 6.901 baris kamus
 * variabel JLF. Tiga puluh tujuh berkas uji memakainya, sebagian membangun satu
 * basis data untuk SETIAP pemeriksaan - satu berkas tercatat 9,3 menit untuk
 * delapan pemeriksaan.
 *
 * Gerbang yang memakan waktu setengah jam tidak akan dijalankan orang, dan
 * gerbang yang tidak dijalankan sama saja dengan tidak ada.
 *
 * pg-mem dapat mengambil cetakan (`backup()`) lalu memulihkannya dalam hitungan
 * milidetik. Cetakan diambil SESUDAH skema dan penyemaian selesai, lalu
 * dipulihkan untuk permintaan berikutnya di proses yang sama.
 *
 * ============================================================================
 * TIGA PAGAR AGAR INI TIDAK PERNAH MENYENTUH PRODUKSI
 * ============================================================================
 *
 *   1. Hanya hidup ketika NODE_ENV === "test". Di luar itu jalurnya sama persis
 *      seperti sebelumnya, baris demi baris.
 *   2. Cetakan dikunci menurut pilihan penyemaian. Basis data bersemai dan tidak
 *      bersemai tidak pernah saling memakai cetakan.
 *   3. Cetakan hanya dipakai ulang bila TIDAK ADA basis data lain darinya yang
 *      masih terbuka. Dua basis data hidup berbagi satu pg-mem akan saling
 *      melihat barisnya - maka bila masih ada yang terbuka, yang baru dibangun
 *      dari nol seperti biasa. Benar lebih dahulu, baru cepat.
 */
type CetakanIngatan = {
  memoryDb: { adapters: { createPg: () => unknown }; backup: () => { restore: () => void } };
  cetakan: { restore: () => void };
  terbuka: number;
};
const cetakanIngatan = new Map<string, CetakanIngatan>();

export function __setelUlangCetakanIngatanUntukUji() {
  cetakanIngatan.clear();
}

export async function createAletaDatabase(options: CreateDatabaseOptions = {}) {
  if (options.useInMemory) {
    const { newDb } = await import(/* webpackIgnore: true */ "pg-mem");
    const sedangDiuji = process.env.NODE_ENV === "test";
    const kunciCetakan = `semai=${options.seed ?? true}`;

    // ---- jalur cepat: memulihkan cetakan yang sudah ada ----
    if (sedangDiuji) {
      const simpanan = cetakanIngatan.get(kunciCetakan);
      if (simpanan && simpanan.terbuka === 0) {
        try {
          simpanan.cetakan.restore();
          const { Pool: PoolPulih } = patchPgMemPgCompatibility(
            simpanan.memoryDb.adapters.createPg() as Parameters<typeof patchPgMemPgCompatibility>[0]
          );
          const poolPulih = new PoolPulih() as unknown as Pool;
          const ormPulih = drizzle(poolPulih, { schema });
          simpanan.terbuka += 1;
          let sudahDitutup = false;
          const dbPulih = new AletaDatabase(
            poolPulih,
            ormPulih,
            async () => {
              if (!sudahDitutup) {
                sudahDitutup = true;
                simpanan.terbuka -= 1;
              }
              await poolPulih.end();
            },
            false,
            {
              supportsFullTextSearch: false,
            }
          );
          tandaiSkemaAletaSudahAda(dbPulih);
          updateRuntimeDatabaseTracker({ activeMode: "fallback" });
          return dbPulih;
        } catch {
          // Cetakan tidak dapat dipulihkan - buang, lalu bangun dari nol.
          // Diam-diam memakai cetakan yang rusak jauh lebih buruk daripada
          // membayar sepuluh detik.
          cetakanIngatan.delete(kunciCetakan);
        }
      }
    }

    const memoryDb = newDb({
      autoCreateForeignKeyIndices: true,
    });
    const { Pool: MemoryPool } = patchPgMemPgCompatibility(memoryDb.adapters.createPg());
    const pool = new MemoryPool() as unknown as Pool;
    const orm = drizzle(pool, { schema });
    let hitungTerbuka: CetakanIngatan | null = null;
    let sudahDitutup = false;
    const db = new AletaDatabase(
      pool,
      orm,
      async () => {
        if (hitungTerbuka && !sudahDitutup) {
          sudahDitutup = true;
          hitungTerbuka.terbuka -= 1;
        }
        await pool.end();
      },
      false,
      {
        supportsFullTextSearch: false,
      }
    );

    await ensureAletaSchema(db);
    /**
     * ========================================================================
     * CETAKAN LAMA DAPAT DITOLAK - DIPERLUKAN UJI DARI UJUNG KE UJUNG
     * ========================================================================
     *
     * Cadangan dalam memori memulihkan cetakan terakhir dari data/, supaya
     * yang diketik saat Postgres mati tidak lenyap. Itu benar untuk
     * pengembangan sehari-hari.
     *
     * Untuk uji dari ujung ke ujung ia justru merusak: cetakan yang tertinggal
     * berbulan-bulan membawa sidik sandi lama, sehingga akun semaian
     * ketua/ketua123 ADA tetapi tidak dapat dipakai masuk - dan seluruh berkas
     * uji gagal pada langkah pertama tanpa sebab yang terbaca. Itulah yang
     * benar-benar terjadi: cetakan 17 Juni membuat uji e2e berhenti hijau, dan
     * karena tidak ada yang menjalankannya lagi, tidak ada yang tahu.
     *
     * Uji menyalakan penolakan ini dari berkas ujinya sendiri, tidak pernah
     * dari .env - supaya tidak ada pemasangan sungguhan yang kehilangan
     * cetakannya karena satu baris yang tertinggal.
     */
    const tolakCetakan = isExplicitlyEnabled(process.env.ALETA_TANPA_CETAKAN_INGATAN);
    const shouldUsePersistentFallback = process.env.NODE_ENV !== "test" && !tolakCetakan;
    const restoredFromSnapshot = shouldUsePersistentFallback
      ? await restoreInMemorySnapshot(db, memoryDb)
      : false;
    if (options.seed ?? true) {
      await seedDatabaseFromFrontendSource(db);
    }
    if (shouldUsePersistentFallback && !restoredFromSnapshot) {
      await persistInMemorySnapshot(memoryDb);
    }
    if (shouldUsePersistentFallback) {
      installInMemoryPersistenceHooks(pool, () => persistInMemorySnapshot(memoryDb));
    }

    // Cetakan diambil di sini - sesudah skema dan penyemaian, sebelum satu pun
    // pemeriksaan menyentuhnya. Inilah keadaan yang ingin dipulihkan.
    if (sedangDiuji && !cetakanIngatan.has(kunciCetakan)) {
      try {
        const simpananBaru: CetakanIngatan = {
          memoryDb: memoryDb as unknown as CetakanIngatan["memoryDb"],
          cetakan: memoryDb.backup(),
          terbuka: 1,
        };
        cetakanIngatan.set(kunciCetakan, simpananBaru);
        hitungTerbuka = simpananBaru;
      } catch {
        // pg-mem tidak dapat mengambil cetakan - tidak apa-apa, hanya lambat.
      }
    }

    updateRuntimeDatabaseTracker({
      activeMode: "fallback",
    });

    return db;
  }

  const isSharedConnection =
    !options.connectionString || options.connectionString === getDatabaseUrl();
  const pool = isSharedConnection
    ? getSharedPool()
    : new Pool({
        connectionString: options.connectionString,
      });
  const orm = isSharedConnection ? getSharedDrizzle() : drizzle(pool, { schema });
  const db = new AletaDatabase(
    pool,
    orm,
    async () => {
      if (!isSharedConnection) {
        await pool.end();
      }
    },
    false,
    {
      supportsFullTextSearch: true,
    }
  );

  if (options.runMigrations ?? true) {
    try {
      await runDatabaseMigrations(orm);
    } catch (galat) {
      // 20 Okt 2026 (pasang 1.205.16): skrip pasang dan portal yang baru menyala menjalankan migrasi yang
      // sama serentak, sehingga CREATE TABLE bertabrakan (pg_type_typname_nsp_index). Tunggu sebentar lalu
      // coba sekali lagi - migrasi yang sudah dicatat proses lain dilewati.
      if (isRecoverablePostgresBootError(galat)) throw galat;
      await new Promise((selesai) => setTimeout(selesai, 3000));
      await runDatabaseMigrations(orm);
    }
  }
  await ensureAletaSchema(db);
  if (options.seed ?? true) {
    await seedDatabaseFromFrontendSource(db);
  }

  updateRuntimeDatabaseTracker({
    activeMode: "postgres",
    lastBootError: null,
  });

  return db;
}

export async function getDatabase() {
  if (!singletonDatabasePromise) {
    singletonDatabasePromise = createAletaDatabase({ seed: true }).catch(async (error) => {
      if (isInMemoryFallbackDisabled() || !isRecoverablePostgresBootError(error)) {
        throw error;
      }

      const target = parseDatabaseConnectionTarget(getDatabaseUrl());
      updateRuntimeDatabaseTracker({
        activeMode: "fallback",
        lastBootError: target
          ? `PostgreSQL utama belum terjangkau di ${target.host}:${target.port}/${target.database}. Runtime memakai fallback snapshot persisten.`
          : error instanceof Error
            ? error.message
            : "PostgreSQL tidak dapat dijangkau saat boot runtime.",
      });

      await resetSharedConnections();
      console.warn(
        "[ALETA DB] PostgreSQL belum tersedia, memakai fallback database in-memory persisten."
      );

      return createAletaDatabase({
        seed: true,
        useInMemory: true,
        runMigrations: false,
      });
    });
    globalForAleta.singletonDatabasePromise = singletonDatabasePromise;
    // Janji yang GAGAL tidak boleh disimpan: dulu tiap permintaan sesudahnya ikut gagal sampai kontainer
    // dimulai ulang (pasang 1.205.16, 20 Okt). Permintaan berikutnya menyusun ulang.
    const janji = singletonDatabasePromise;
    janji.catch(() => {
      if (singletonDatabasePromise === janji) {
        singletonDatabasePromise = null;
        globalForAleta.singletonDatabasePromise = null;
      }
    });
  }

  return singletonDatabasePromise;
}

export async function closeDatabase() {
  const database = singletonDatabasePromise ? await singletonDatabasePromise : null;
  await database?.close();
  singletonDatabasePromise = null;
  await resetSharedConnections();
  updateRuntimeDatabaseTracker({
    activeMode: null,
  });
}

export async function withTransaction<T>(
  db: AletaDatabase,
  callback: (tx: AletaDatabase) => Promise<T>
) {
  if (db.isTransactionClient()) {
    const savepointId = `aleta_sp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await db.exec(`SAVEPOINT ${savepointId}`);

    try {
      const result = await callback(db);
      await db.exec(`RELEASE SAVEPOINT ${savepointId}`);
      return result;
    } catch (error) {
      await db.exec(`ROLLBACK TO SAVEPOINT ${savepointId}`);
      throw error;
    }
  }

  const client = await (db.getQueryable() as Pool).connect();
  const txDb = new AletaDatabase(
    client,
    drizzle(client, { schema }),
    undefined,
    true,
    db.getCapabilities()
  );
  await client.query("BEGIN");

  try {
    const result = await callback(txDb);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  db: AletaDatabase,
  sql: string,
  ...params: SqlInputValue[]
) {
  return db.queryOne<T>(sql, params);
}

export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  db: AletaDatabase,
  sql: string,
  ...params: SqlInputValue[]
) {
  return db.queryAll<T>(sql, params);
}
