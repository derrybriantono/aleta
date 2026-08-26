import { jlfBadRequest } from "@/server/modules/judicia/legal-form/jlf-service-errors";

export type SippProviderKey = "aleta_bot_bridge" | "disabled" | "direct_mysql";

export type SippProviderHealth = {
  ok: boolean;
  provider: SippProviderKey;
  status: "connected" | "disabled" | "unavailable" | "not_implemented";
  message: string;
  latencyMs?: number;
  bridgeUrlSource?: string;
};

export type SippCaseSearchFilters = {
  year?: string;
  caseType?: string;
  limit?: number;
};

export type SippCaseSummary = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  paraPihak?: string;
  tahapan?: string;
  tanggalDaftar?: string;
};

export type SippCaseDetail = SippCaseSummary & {
  statusPerkara?: string;
  majelisHakim?: string[];
  paniteraPengganti?: string;
  metadata?: Record<string, unknown>;
};

export type SippUserSummary = {
  id: string;
  username: string;
  fullname: string;
  nip?: string;
  email?: string;
  groupId?: string;
  groupName?: string;
  satkerCode?: string;
  satkerName?: string;
};

export type LegacySqlValueInput = {
  sql: string;
  perkaraId?: string;
  nomorPerkara?: string;
  placeholderValues?: Record<string, unknown>;
};

export type LegacySqlValueResult = {
  value: unknown;
  data?: unknown;
  rowCount?: number;
  queryHash?: string;
};

export type SippCaseContext = {
  nomorPerkara?: string;
  sidangId?: string;
  sidangUrutan?: string;
};

export interface SippReadOnlyProvider {
  key: SippProviderKey;
  checkConnection(): Promise<SippProviderHealth>;
  getSatkerConfig(): Promise<Record<string, unknown>>;
}

export interface SippCaseProvider extends SippReadOnlyProvider {
  searchCasesByNumber(nomorPerkara: string, filters?: SippCaseSearchFilters): Promise<SippCaseSummary[]>;
  searchCasesByPartyName(name: string, filters?: SippCaseSearchFilters): Promise<SippCaseSummary[]>;
  getCaseDetail(identifier: { nomorPerkara?: string; perkaraId?: string }): Promise<SippCaseDetail | null>;
  getCaseParties(perkaraId: string): Promise<unknown[]>;
  getCaseWitnesses(perkaraId: string): Promise<unknown[]>;
  getCaseSchedule(perkaraId: string, context?: SippCaseContext): Promise<unknown[]>;
  getLastHearing(perkaraId: string, context?: SippCaseContext): Promise<unknown | null>;
  getNextHearing(perkaraId: string, context?: SippCaseContext): Promise<unknown | null>;
  getJudges(perkaraId: string): Promise<unknown[]>;
  getPanitera(perkaraId: string): Promise<unknown[]>;
  getJurusita(perkaraId: string): Promise<unknown[]>;
  getMediator(perkaraId: string): Promise<unknown[]>;
  getDecisionData(perkaraId: string): Promise<Record<string, unknown> | null>;
  executeLegacySqlValue(input: LegacySqlValueInput): Promise<LegacySqlValueResult>;
}

export interface SippUserProvider extends SippReadOnlyProvider {
  findSippUserByUsername(username: string): Promise<SippUserSummary | null>;
  findSippUserByNip(nip: string): Promise<SippUserSummary | null>;
  findSippUserByEmail(email: string): Promise<SippUserSummary | null>;
  searchSippUsers(query: string, limit?: number): Promise<SippUserSummary[]>;
  getSippUserById(id: string): Promise<SippUserSummary | null>;
}

export type JlfSippProvider = SippCaseProvider & SippUserProvider;

function emptyHealth(key: SippProviderKey, message: string): SippProviderHealth {
  return { ok: false, provider: key, status: key === "disabled" ? "disabled" : "not_implemented", message };
}

export class DisabledSippProvider implements JlfSippProvider {
  key: SippProviderKey = "disabled";

  async checkConnection() {
    return emptyHealth("disabled", "SIPP adapter belum diaktifkan. Tidak ada koneksi SIPP dari portal Next.");
  }

  async getSatkerConfig() {
    return {};
  }

  async searchCasesByNumber() {
    return [];
  }

  async searchCasesByPartyName() {
    return [];
  }

  async getCaseDetail() {
    return null;
  }

  async getCaseParties() {
    return [];
  }

  async getCaseWitnesses() {
    return [];
  }

  async getCaseSchedule() {
    return [];
  }

  async getLastHearing() {
    return null;
  }

  async getNextHearing() {
    return null;
  }

  async getJudges() {
    return [];
  }

  async getPanitera() {
    return [];
  }

  async getJurusita() {
    return [];
  }

  async getMediator() {
    return [];
  }

  async getDecisionData() {
    return null;
  }

  async executeLegacySqlValue() {
    return { value: null, rowCount: 0, queryHash: "" };
  }

  async findSippUserByUsername() {
    return null;
  }

  async findSippUserByNip() {
    return null;
  }

  async findSippUserByEmail() {
    return null;
  }

  async searchSippUsers() {
    return [];
  }

  async getSippUserById() {
    return null;
  }
}

type BridgeOperation =
  | "health"
  | "case.searchByNumber"
  | "case.searchByPartyName"
  | "case.detail"
  | "case.parties"
  | "case.witnesses"
  | "case.schedule"
  | "case.lastHearing"
  | "case.nextHearing"
  | "case.judges"
  | "case.panitera"
  | "case.jurusita"
  | "case.mediator"
  | "case.decision"
  | "legacy.sqlValue"
  | "satker.config"
  | "user.byUsername"
  | "user.byNip"
  | "user.byEmail"
  | "user.search"
  | "user.byId";

type BridgeResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type BridgeConfig = {
  baseUrl: string;
  source: "JLF_SIPP_BRIDGE_BASE_URL" | "ALETA_BOT_BASE_URL" | "ALETA_BOT_RUNTIME_URL" | "fallback-localhost" | "unset";
  explicit: boolean;
};

function getBridgeConfig(): BridgeConfig {
  const candidates: Array<[BridgeConfig["source"], string | undefined]> = [
    ["JLF_SIPP_BRIDGE_BASE_URL", process.env.JLF_SIPP_BRIDGE_BASE_URL],
    ["ALETA_BOT_BASE_URL", process.env.ALETA_BOT_BASE_URL],
    ["ALETA_BOT_RUNTIME_URL", process.env.ALETA_BOT_RUNTIME_URL],
  ];

  const configured = candidates.find(([, value]) => Boolean(value?.trim()));
  if (configured) {
    return { baseUrl: configured[1]!.trim().replace(/\/$/, ""), source: configured[0], explicit: true };
  }

  return { baseUrl: "http://127.0.0.1:3003", source: "fallback-localhost", explicit: false };
}

function getBridgeBaseUrl() {
  return getBridgeConfig().baseUrl;
}

function getBridgeToken() {
  return (
    process.env.JLF_SIPP_BRIDGE_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function getTimeoutMs() {
  return Math.max(1000, Math.min(30000, Number(process.env.SIPP_QUERY_TIMEOUT_MS || 8000)));
}

async function fetchBridgeOperation<T>(operation: BridgeOperation, params: Record<string, unknown> = {}) {
  const bridge = getBridgeConfig();
  const baseUrl = bridge.baseUrl;
  if (!baseUrl) {
    return { ok: false, error: "SIPP bridge belum dikonfigurasi." } as BridgeResponse<T>;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getBridgeToken();
    if (token) headers["x-aleta-internal-token"] = token;

    const response = await fetch(`${baseUrl}/internal/aleta-bot/jlf/sipp/query`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({ operation, params }),
    });
    const payload = (await response.json().catch(() => null)) as BridgeResponse<T> | null;

    if (!response.ok || payload?.ok === false) {
      const responseMessage = payload?.error ?? payload?.message ?? `HTTP ${response.status}`;
      return {
        ok: false,
        error: formatBridgeError(bridge, responseMessage),
      } as BridgeResponse<T>;
    }

    return { ok: true, data: payload?.data as T } as BridgeResponse<T>;
  } catch (error) {
    return {
      ok: false,
      error: formatBridgeError(bridge, error instanceof Error ? error.message : "Bridge SIPP tidak merespons."),
    } as BridgeResponse<T>;
  } finally {
    clearTimeout(timeout);
  }
}

function formatBridgeError(bridge: BridgeConfig, rawMessage: string) {
  const message = rawMessage.trim() || "Bridge SIPP tidak merespons.";
  if (!bridge.explicit) {
    return "Bridge SIPP JLF masih memakai fallback localhost. Pada Docker/CentOS, set JLF_SIPP_BRIDGE_BASE_URL atau ALETA_BOT_BASE_URL ke URL service ALETA Bot di network Docker, misalnya http://aleta_bot:3003, lalu restart container portal.";
  }

  if (/missing_token|x-aleta-internal-token diperlukan/i.test(message)) {
    return "Bridge SIPP JLF belum mengirim token internal ke ALETA Bot. Set JLF_SIPP_BRIDGE_TOKEN atau ALETA_BOT_INTERNAL_API_TOKEN/ALETA_BOT_INTERNAL_TOKEN di container portal dengan nilai yang sama seperti token internal ALETA Bot, lalu restart portal.";
  }

  if (/invalid_token|token tidak valid/i.test(message)) {
    return "Bridge SIPP JLF mengirim token internal, tetapi nilainya tidak sama dengan token ALETA Bot. Samakan JLF_SIPP_BRIDGE_TOKEN/ALETA_BOT_INTERNAL_API_TOKEN pada service portal dan aleta_bot, lalu restart keduanya.";
  }

  if (/failed to fetch|fetch failed|connect|ECONNREFUSED|ENOTFOUND|getaddrinfo|timed out|abort/i.test(message)) {
    return `Bridge SIPP JLF belum dapat menghubungi ALETA Bot melalui ${bridge.source}. Pastikan service ALETA Bot berjalan, URL dapat dijangkau dari container portal, token internal sama, dan koneksi database SIPP di ALETA Bot berhasil.`;
  }

  return `Bridge SIPP JLF menolak operasi: ${message}`;
}

function requireBridgeData<T>(result: BridgeResponse<T>, fallbackMessage: string): T | undefined {
  if (!result.ok) {
    jlfBadRequest(result.error ?? fallbackMessage);
  }
  return result.data;
}

function sanitizeSippUser(value: SippUserSummary | null | undefined): SippUserSummary | null {
  if (!value) return null;
  return {
    id: String(value.id ?? ""),
    username: String(value.username ?? ""),
    fullname: String(value.fullname ?? ""),
    nip: value.nip ? String(value.nip) : undefined,
    email: value.email ? String(value.email) : undefined,
    groupId: value.groupId ? String(value.groupId) : undefined,
    groupName: value.groupName ? String(value.groupName) : undefined,
    satkerCode: value.satkerCode ? String(value.satkerCode) : undefined,
    satkerName: value.satkerName ? String(value.satkerName) : undefined,
  };
}

function sanitizeSippUsers(values: SippUserSummary[] | null | undefined) {
  return (values ?? []).map(sanitizeSippUser).filter((item): item is SippUserSummary => Boolean(item?.id));
}

export class AletaBotSippBridgeProvider implements JlfSippProvider {
  key: SippProviderKey = "aleta_bot_bridge";

  async checkConnection() {
    const startedAt = Date.now();
    const bridge = getBridgeConfig();
    const result = await fetchBridgeOperation<{ status?: string; message?: string }>("health");
    return {
      ok: Boolean(result.ok),
      provider: this.key,
      status: result.ok ? "connected" : "unavailable",
      message: result.ok
        ? result.data?.message ?? "Bridge SIPP ALETA Bot tersedia."
        : result.error ?? "Bridge SIPP ALETA Bot belum tersedia.",
      latencyMs: Date.now() - startedAt,
      bridgeUrlSource: bridge.source,
    } satisfies SippProviderHealth;
  }

  async getSatkerConfig() {
    return requireBridgeData(
      await fetchBridgeOperation<Record<string, unknown>>("satker.config"),
      "Bridge SIPP belum dapat membaca konfigurasi satker."
    ) ?? {};
  }

  async searchCasesByNumber(nomorPerkara: string, filters: SippCaseSearchFilters = {}) {
    return requireBridgeData(
      await fetchBridgeOperation<SippCaseSummary[]>("case.searchByNumber", { nomorPerkara, filters }),
      "Bridge SIPP belum dapat mencari perkara berdasarkan nomor."
    ) ?? [];
  }

  async searchCasesByPartyName(name: string, filters: SippCaseSearchFilters = {}) {
    return requireBridgeData(
      await fetchBridgeOperation<SippCaseSummary[]>("case.searchByPartyName", { name, filters }),
      "Bridge SIPP belum dapat mencari perkara berdasarkan nama pihak."
    ) ?? [];
  }

  async getCaseDetail(identifier: { nomorPerkara?: string; perkaraId?: string }) {
    return requireBridgeData(
      await fetchBridgeOperation<SippCaseDetail | null>("case.detail", identifier),
      "Bridge SIPP belum dapat membaca detail perkara."
    ) ?? null;
  }

  async getCaseParties(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.parties", { perkaraId }),
      "Bridge SIPP belum dapat membaca para pihak."
    ) ?? [];
  }

  async getCaseWitnesses(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.witnesses", { perkaraId }),
      "Bridge SIPP belum dapat membaca saksi."
    ) ?? [];
  }

  async getCaseSchedule(perkaraId: string, context: SippCaseContext = {}) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.schedule", { perkaraId, ...context }),
      "Bridge SIPP belum dapat membaca jadwal sidang."
    ) ?? [];
  }

  async getLastHearing(perkaraId: string, context: SippCaseContext = {}) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown | null>("case.lastHearing", { perkaraId, ...context }),
      "Bridge SIPP belum dapat membaca sidang sebelumnya."
    ) ?? null;
  }

  async getNextHearing(perkaraId: string, context: SippCaseContext = {}) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown | null>("case.nextHearing", { perkaraId, ...context }),
      "Bridge SIPP belum dapat membaca sidang berikutnya."
    ) ?? null;
  }

  async getJudges(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.judges", { perkaraId }),
      "Bridge SIPP belum dapat membaca majelis hakim."
    ) ?? [];
  }

  async getPanitera(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.panitera", { perkaraId }),
      "Bridge SIPP belum dapat membaca panitera pengganti."
    ) ?? [];
  }

  async getJurusita(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.jurusita", { perkaraId }),
      "Bridge SIPP belum dapat membaca jurusita."
    ) ?? [];
  }

  async getMediator(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<unknown[]>("case.mediator", { perkaraId }),
      "Bridge SIPP belum dapat membaca mediator."
    ) ?? [];
  }

  async getDecisionData(perkaraId: string) {
    return requireBridgeData(
      await fetchBridgeOperation<Record<string, unknown> | null>("case.decision", { perkaraId }),
      "Bridge SIPP belum dapat membaca data putusan."
    ) ?? null;
  }

  async executeLegacySqlValue(input: LegacySqlValueInput) {
    return requireBridgeData(
      await fetchBridgeOperation<LegacySqlValueResult>("legacy.sqlValue", input as unknown as Record<string, unknown>),
      "Bridge SIPP belum dapat menjalankan query ABT read-only."
    ) ?? { value: null, rowCount: 0, queryHash: "" };
  }

  async findSippUserByUsername(username: string) {
    return sanitizeSippUser(requireBridgeData(
      await fetchBridgeOperation<SippUserSummary | null>("user.byUsername", { username }),
      "Bridge SIPP belum dapat mencari user berdasarkan username."
    ));
  }

  async findSippUserByNip(nip: string) {
    return sanitizeSippUser(requireBridgeData(
      await fetchBridgeOperation<SippUserSummary | null>("user.byNip", { nip }),
      "Bridge SIPP belum dapat mencari user berdasarkan NIP."
    ));
  }

  async findSippUserByEmail(email: string) {
    return sanitizeSippUser(requireBridgeData(
      await fetchBridgeOperation<SippUserSummary | null>("user.byEmail", { email }),
      "Bridge SIPP belum dapat mencari user berdasarkan email."
    ));
  }

  async searchSippUsers(query: string, limit = 20) {
    return sanitizeSippUsers(requireBridgeData(
      await fetchBridgeOperation<SippUserSummary[]>("user.search", { query, limit }),
      "Bridge SIPP belum dapat mencari user."
    ));
  }

  async getSippUserById(id: string) {
    return sanitizeSippUser(requireBridgeData(
      await fetchBridgeOperation<SippUserSummary | null>("user.byId", { id }),
      "Bridge SIPP belum dapat membaca user."
    ));
  }
}

export class DirectMysqlPlaceholderSippProvider extends DisabledSippProvider {
  key: SippProviderKey = "direct_mysql";

  async checkConnection() {
    return emptyHealth(
      "direct_mysql",
      "direct_mysql belum diimplementasikan karena portal Next belum memiliki dependency MySQL/MariaDB."
    );
  }
}

export class JlfSippProviderRegistry {
  static getProvider(): JlfSippProvider {
    const configured = (process.env.JLF_SIPP_PROVIDER ?? "").trim().toLowerCase();

    if (configured === "direct_mysql") {
      return new DirectMysqlPlaceholderSippProvider();
    }

    if (configured === "disabled") {
      return new DisabledSippProvider();
    }

    if (configured === "aleta_bot_bridge" || getBridgeBaseUrl()) {
      return new AletaBotSippBridgeProvider();
    }

    return new DisabledSippProvider();
  }

  static assertNoRawSql(value: unknown) {
    if (typeof value === "string" && /\b(select|insert|update|delete|drop|alter|truncate)\b/i.test(value)) {
      jlfBadRequest("Input SIPP tidak boleh berisi SQL.");
    }
  }
}
