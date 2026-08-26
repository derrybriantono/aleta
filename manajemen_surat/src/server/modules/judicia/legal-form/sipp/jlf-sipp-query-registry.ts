export const JLF_SIPP_QUERY_KEYS = [
  "sipp.perkara.by_nomor",
  "sipp.perkara.search",
  "sipp.pihak.list",
  "sipp.pihak.penggugat",
  "sipp.pihak.tergugat",
  "sipp.saksi.list",
  "sipp.sidang.list",
  "sipp.sidang.by_id",
  "sipp.sidang.last",
  "sipp.sidang.next",
  "sipp.hakim.majelis",
  "sipp.panitera.pengganti",
  "sipp.jurusita",
  "sipp.mediator",
  "sipp.putusan",
  "sipp.biaya",
  "sipp.satker.config",
] as const;

export type JlfSippQueryKey = (typeof JLF_SIPP_QUERY_KEYS)[number];

export type JlfSippQueryDefinition = {
  key: JlfSippQueryKey;
  bridgeOperation:
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
    | "satker.config";
  description: string;
  allowedParams: string[];
  readOnly: true;
};

const SQL_PATTERN = /\b(select|insert|update|delete|drop|alter|truncate|create|replace|grant|revoke)\b/i;

const QUERY_DEFINITIONS: Record<JlfSippQueryKey, JlfSippQueryDefinition> = {
  "sipp.perkara.by_nomor": {
    key: "sipp.perkara.by_nomor",
    bridgeOperation: "case.searchByNumber",
    description: "Cari perkara berdasarkan nomor perkara.",
    allowedParams: ["nomorPerkara", "filters", "limit"],
    readOnly: true,
  },
  "sipp.perkara.search": {
    key: "sipp.perkara.search",
    bridgeOperation: "case.searchByPartyName",
    description: "Cari perkara berdasarkan nama pihak atau kata kunci aman.",
    allowedParams: ["query", "name", "filters", "limit"],
    readOnly: true,
  },
  "sipp.pihak.list": {
    key: "sipp.pihak.list",
    bridgeOperation: "case.parties",
    description: "Ambil daftar pihak perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.pihak.penggugat": {
    key: "sipp.pihak.penggugat",
    bridgeOperation: "case.parties",
    description: "Ambil pihak penggugat/pemohon dari daftar pihak.",
    allowedParams: ["perkaraId", "role"],
    readOnly: true,
  },
  "sipp.pihak.tergugat": {
    key: "sipp.pihak.tergugat",
    bridgeOperation: "case.parties",
    description: "Ambil pihak tergugat/termohon dari daftar pihak.",
    allowedParams: ["perkaraId", "role"],
    readOnly: true,
  },
  "sipp.saksi.list": {
    key: "sipp.saksi.list",
    bridgeOperation: "case.witnesses",
    description: "Ambil daftar saksi perkara dari sumber SIPP read-only.",
    allowedParams: ["perkaraId", "saksiPihakKe", "urutan"],
    readOnly: true,
  },
  "sipp.sidang.list": {
    key: "sipp.sidang.list",
    bridgeOperation: "case.schedule",
    description: "Ambil jadwal sidang perkara.",
    allowedParams: ["perkaraId", "nomorPerkara", "sidangId", "sidangUrutan", "sidang_urutan", "urutan"],
    readOnly: true,
  },
  "sipp.sidang.by_id": {
    key: "sipp.sidang.by_id",
    bridgeOperation: "case.schedule",
    description: "Ambil data sidang tertentu dari jadwal perkara.",
    allowedParams: ["perkaraId", "nomorPerkara", "sidangId", "sidang_id", "sidangUrutan", "sidang_urutan", "urutan"],
    readOnly: true,
  },
  "sipp.sidang.last": {
    key: "sipp.sidang.last",
    bridgeOperation: "case.lastHearing",
    description: "Ambil sidang terakhir.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.sidang.next": {
    key: "sipp.sidang.next",
    bridgeOperation: "case.nextHearing",
    description: "Ambil sidang berikutnya.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.hakim.majelis": {
    key: "sipp.hakim.majelis",
    bridgeOperation: "case.judges",
    description: "Ambil majelis hakim perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.panitera.pengganti": {
    key: "sipp.panitera.pengganti",
    bridgeOperation: "case.panitera",
    description: "Ambil panitera pengganti perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.jurusita": {
    key: "sipp.jurusita",
    bridgeOperation: "case.jurusita",
    description: "Ambil jurusita/jurusita pengganti perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.mediator": {
    key: "sipp.mediator",
    bridgeOperation: "case.mediator",
    description: "Ambil mediator perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.putusan": {
    key: "sipp.putusan",
    bridgeOperation: "case.decision",
    description: "Ambil data putusan perkara.",
    allowedParams: ["perkaraId"],
    readOnly: true,
  },
  "sipp.biaya": {
    key: "sipp.biaya",
    bridgeOperation: "case.decision",
    description: "Ambil ringkasan data biaya melalui endpoint bridge terdaftar.",
    allowedParams: ["perkaraId", "scope"],
    readOnly: true,
  },
  "sipp.satker.config": {
    key: "sipp.satker.config",
    bridgeOperation: "satker.config",
    description: "Ambil konfigurasi satker SIPP yang aman untuk dokumen.",
    allowedParams: ["names"],
    readOnly: true,
  },
};

export function listJlfSippQueryDefinitions() {
  return JLF_SIPP_QUERY_KEYS.map((key) => QUERY_DEFINITIONS[key]);
}

export function isJlfSippQueryKey(value: string): value is JlfSippQueryKey {
  return (JLF_SIPP_QUERY_KEYS as readonly string[]).includes(value);
}

export function getJlfSippQueryDefinition(key: string) {
  if (!isJlfSippQueryKey(key)) {
    throw new Error("Query SIPP JLF tidak terdaftar.");
  }
  return QUERY_DEFINITIONS[key];
}

export function assertNoSqlInSippQueryParams(value: unknown): void {
  if (typeof value === "string") {
    if (SQL_PATTERN.test(value)) throw new Error("Parameter SIPP tidak boleh berisi SQL.");
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) assertNoSqlInSippQueryParams(item);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) assertNoSqlInSippQueryParams(item);
  }
}

export function validateJlfSippQueryRequest(key: string, params: Record<string, unknown> = {}) {
  const definition = getJlfSippQueryDefinition(key);
  const allowed = new Set(definition.allowedParams);
  const rejectedParams = Object.keys(params).filter((param) => !allowed.has(param));
  if (rejectedParams.length > 0) {
    throw new Error(`Parameter SIPP tidak dikenal: ${rejectedParams.join(", ")}.`);
  }
  assertNoSqlInSippQueryParams(params);
  return definition;
}

export function suggestJlfSippQueryKeyFromLegacySource(dataTable: string, dataColumn = ""): JlfSippQueryKey | null {
  const table = dataTable.trim().toLowerCase();
  const column = dataColumn.trim().toLowerCase();
  const joined = `${table}.${column}`;

  if (!table) return null;
  if (table.includes("sys_config") || table.includes("satker")) return "sipp.satker.config";
  if (table.includes("perkara_pihak5") || table.includes("saksi")) return "sipp.saksi.list";
  if (table.includes("jadwal_sidang") || joined.includes("sidang")) return "sipp.sidang.list";
  if (table.includes("hakim")) return "sipp.hakim.majelis";
  if (table.includes("panitera")) return "sipp.panitera.pengganti";
  if (table.includes("jurusita")) return "sipp.jurusita";
  if (table.includes("mediator") || table.includes("mediasi")) return "sipp.mediator";
  if (table.includes("putusan") || table.includes("penetapan")) return "sipp.putusan";
  if (table.includes("biaya") || table.includes("keuangan")) return "sipp.biaya";
  if (table.includes("pihak")) return "sipp.pihak.list";
  if (table.includes("perkara")) return "sipp.perkara.by_nomor";
  return null;
}
