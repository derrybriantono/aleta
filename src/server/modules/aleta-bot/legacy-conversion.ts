import type {
  AletaBotLegacyMigration,
  AletaBotNotificationCategory,
  AletaBotPublicQaIntent,
  AletaBotQueryCategory,
  AletaBotTemplate,
} from "@/lib/aleta-bot-types";

export type ConvertedNotificationDraft = {
  kind: "notification";
  status: "registry_draft" | "needs_manual_mapping";
  query: {
    id: string;
    name: string;
    category: AletaBotQueryCategory;
    description: string;
    sqlText: string;
    outputColumns: string[];
    recipientColumn: string;
    connectionKey: string;
    isActive: boolean;
  };
  template: {
    id: string;
    category: AletaBotTemplate["category"];
    title: string;
    body: string;
    placeholders: string[];
  };
  notification: {
    id: string;
    name: string;
    category: AletaBotNotificationCategory;
    description: string;
    queryId: string;
    templateId: string;
    scheduleConfig: {
      type: "cron" | "manual" | "event";
      cron: string;
      trigger: string;
    };
    isActive: boolean;
    delayMs: number;
    retryLimit: number;
  };
  checklist: string[];
  warnings: string[];
};

export type ConvertedCommandDraft = {
  kind: "public_qa_intent";
  status: "registry_draft" | "needs_manual_mapping";
  intent: Omit<Partial<AletaBotPublicQaIntent>, "exactTriggers" | "exampleQuestions" | "requiredParameters"> &
    Pick<AletaBotPublicQaIntent, "key" | "name" | "category" | "audience" | "responseMode" | "riskLevel"> & {
      exactTriggers: string[];
      exampleQuestions: string[];
      requiredParameters: string[];
    };
  checklist: string[];
  warnings: string[];
};

export type ConvertedLegacyDraft = ConvertedNotificationDraft | ConvertedCommandDraft;

const PUBLIC_COMMAND_MAP: Record<
  string,
  {
    key: string;
    name: string;
    category: AletaBotPublicQaIntent["category"];
    triggers: string[];
    examples: string[];
    requiredParameters?: string[];
    responseMode?: AletaBotPublicQaIntent["responseMode"];
    riskLevel?: AletaBotPublicQaIntent["riskLevel"];
    verificationPolicy?: AletaBotPublicQaIntent["verificationPolicy"];
    aiAnswerMode?: AletaBotPublicQaIntent["aiAnswerMode"];
  }
> = {
  greeting: {
    key: "greeting",
    name: "Sapaan Awal",
    category: "informasi_umum",
    triggers: ["halo", "hallo", "hai", "hei", "assalamualaikum"],
    examples: ["Halo Aleta", "Assalamualaikum, saya mau bertanya"],
    responseMode: "static_template",
    riskLevel: "low",
    aiAnswerMode: "template_only",
  },
  info_lengkap: {
    key: "info_lengkap",
    name: "Info Lengkap Layanan",
    category: "layanan",
    triggers: ["info lengkap", "menu", "help"],
    examples: ["Saya mau lihat daftar layanan", "Ada menu apa saja di Aleta?"],
    responseMode: "static_template",
    riskLevel: "low",
    aiAnswerMode: "template_rewrite",
  },
  alamat: {
    key: "alamat_pengadilan",
    name: "Alamat Pengadilan",
    category: "informasi_umum",
    triggers: ["alamat"],
    examples: ["Alamat pengadilan di mana?", "Lokasi kantor pengadilan"],
    responseMode: "static_template",
    riskLevel: "low",
    aiAnswerMode: "template_rewrite",
  },
  perkara: {
    key: "cek_perkara",
    name: "Cek Perkara",
    category: "status_perkara",
    triggers: ["perkara", "status", "cek"],
    examples: ["Saya mau cek perkara", "Bagaimana status perkara saya?"],
    requiredParameters: ["nomor_perkara"],
    responseMode: "legacy_handler",
    riskLevel: "medium",
    verificationPolicy: "case_number_only",
    aiAnswerMode: "guided_answer",
  },
  sidang: {
    key: "cek_jadwal_sidang",
    name: "Cek Jadwal Sidang",
    category: "jadwal_sidang",
    triggers: ["sidang", "jadwal"],
    examples: ["Kapan sidang perkara saya?", "Saya mau tahu jadwal sidang"],
    requiredParameters: ["nomor_perkara"],
    responseMode: "legacy_handler",
    riskLevel: "medium",
    verificationPolicy: "case_number_only",
    aiAnswerMode: "guided_answer",
  },
  antrian: {
    key: "antrian_sidang",
    name: "Informasi Antrian Sidang",
    category: "jadwal_sidang",
    triggers: ["antrian", "antrian sidang", "daftar antrian"],
    examples: ["Saya mau cek antrian sidang", "Nomor antrian sidang saya berapa?"],
    requiredParameters: ["nomor_perkara"],
    responseMode: "legacy_handler",
    riskLevel: "medium",
    verificationPolicy: "case_number_only",
    aiAnswerMode: "guided_answer",
  },
  akta: {
    key: "cek_akta_cerai",
    name: "Cek Akta Cerai",
    category: "akta_cerai",
    triggers: ["akta", "validasi"],
    examples: ["Akta cerai saya sudah jadi belum?", "Bagaimana cara ambil akta cerai?"],
    requiredParameters: ["nomor_perkara"],
    responseMode: "legacy_handler",
    riskLevel: "high",
    verificationPolicy: "case_number_and_phone",
    aiAnswerMode: "guided_answer",
  },
  pengaduan: {
    key: "pengaduan",
    name: "Pengaduan",
    category: "pengaduan",
    triggers: ["pengaduan"],
    examples: ["Saya mau mengadu", "Bagaimana menyampaikan pengaduan?"],
    responseMode: "static_template",
    riskLevel: "low",
    aiAnswerMode: "template_rewrite",
  },
  ecourt: {
    key: "ecourt",
    name: "Informasi E-Court",
    category: "ecourt",
    triggers: ["ecourt", "e-court"],
    examples: ["Saya mau informasi e-court", "Bagaimana daftar e-court?"],
    responseMode: "static_template",
    riskLevel: "low",
    aiAnswerMode: "template_rewrite",
  },
};

function slug(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "legacy";
}

function inferCommandSeed(migration: AletaBotLegacyMigration) {
  const haystack = `${migration.id} ${migration.legacyKey} ${migration.feature} ${migration.sourceFunction}`.toLowerCase();
  if (haystack.includes("info")) return PUBLIC_COMMAND_MAP.info_lengkap;
  if (haystack.includes("alamat")) return PUBLIC_COMMAND_MAP.alamat;
  if (haystack.includes("perkara") || haystack.includes("status") || haystack.includes("cek")) return PUBLIC_COMMAND_MAP.perkara;
  if (haystack.includes("antrian")) return PUBLIC_COMMAND_MAP.antrian;
  if (haystack.includes("sidang") || haystack.includes("jadwal")) return PUBLIC_COMMAND_MAP.sidang;
  if (haystack.includes("akta") || haystack.includes("validasi")) return PUBLIC_COMMAND_MAP.akta;
  if (haystack.includes("pengaduan")) return PUBLIC_COMMAND_MAP.pengaduan;
  if (haystack.includes("ecourt") || haystack.includes("e-court")) return PUBLIC_COMMAND_MAP.ecourt;
  if (haystack.includes("greeting") || haystack.includes("halo")) return PUBLIC_COMMAND_MAP.greeting;
  return null;
}

export function estimateMigrationRisk(legacyItem: AletaBotLegacyMigration) {
  const reasons: string[] = [];
  if (legacyItem.riskLevel === "high") reasons.push("Risiko legacy ditandai high.");
  if (legacyItem.legacyType === "party_notification") reasons.push("Mengirim ke pihak eksternal, wajib dry-run dan approval.");
  if (legacyItem.legacyType === "public_command" && legacyItem.riskLevel !== "low") reasons.push("Command publik berpotensi membuka data perkara.");
  if (!legacyItem.registryTargetKey) reasons.push("Target registry belum lengkap.");
  return {
    level: legacyItem.riskLevel,
    reasons,
  };
}

export function generateMigrationChecklist(legacyItem: AletaBotLegacyMigration) {
  const checklist = [
    "Preview data legacy tanpa pengiriman WhatsApp.",
    "Buat registry draft, bukan active.",
    "Validasi query/template dan mapping penerima.",
    "Jalankan dry-run melalui queue/log.",
    "Ajukan approval Super Admin sebelum aktif.",
  ];
  if (legacyItem.legacyType === "party_notification") {
    checklist.push("Pastikan notifikasi pihak tetap dry-run/requires approval sampai hasil uji aman.");
    checklist.push("Pastikan nomor pihak tervalidasi dan idempotency aktif.");
  }
  if (legacyItem.legacyType === "public_command") {
    checklist.push("Pastikan intent tidak memanggil handler internal pegawai/admin.");
    checklist.push("Tambahkan fallback resmi dan human handoff untuk topik sensitif.");
  }
  return checklist;
}

export function buildNotificationDraftFromLegacySnapshot(migration: AletaBotLegacyMigration): ConvertedNotificationDraft {
  const isParty = migration.legacyType === "party_notification";
  const key = slug(migration.registryTargetKey || migration.legacyKey || migration.id);
  const queryId = `draft-query-${key}`;
  const templateId = `draft-template-${key}`;
  const notificationId = `draft-notification-${key}`;
  const category: AletaBotNotificationCategory = isParty ? "party" : "employee";
  const outputColumns = isParty
    ? ["nama_pihak", "nomor_perkara", "nomor_whatsapp", "ringkasan"]
    : ["nama_pegawai", "judul_notifikasi", "ringkasan", "waktu"];
  const sqlText = isParty
    ? "SELECT '' AS nama_pihak, '' AS nomor_perkara, '' AS nomor_whatsapp, '' AS ringkasan WHERE 1 = 0"
    : "SELECT '' AS nama_pegawai, '' AS judul_notifikasi, '' AS ringkasan, '' AS waktu WHERE 1 = 0";
  const templateBody = isParty
    ? [
        "Assalamualaikum Warahmatullahi Wabarakatuh.",
        "",
        "Yth. Bapak/Ibu {{nama_pihak}}, berikut informasi terkait perkara {{nomor_perkara}}:",
        "{{ringkasan}}",
        "",
        "Pesan ini merupakan notifikasi bantuan. Informasi resmi tetap mengikuti ketentuan pengadilan.",
      ].join("\n")
    : [
        "[ALETA Bot - Notifikasi Pegawai]",
        "Yth. Bapak/Ibu {{nama_pegawai}},",
        "",
        "{{judul_notifikasi}}",
        "{{ringkasan}}",
        "",
        "Waktu data: {{waktu}}",
      ].join("\n");
  return {
    kind: "notification",
    status: "needs_manual_mapping",
    query: {
      id: queryId,
      name: `[Draft] ${migration.feature}`,
      category,
      description: `Draft query hasil konversi legacy ${migration.legacyKey}. SQL masih placeholder aman dan harus dimapping manual sebelum aktif.`,
      sqlText,
      outputColumns,
      recipientColumn: isParty ? "nomor_whatsapp" : "",
      connectionKey: "sipp_primary",
      isActive: false,
    },
    template: {
      id: templateId,
      category: isParty ? "party" : "employee",
      title: `[Draft] ${migration.feature}`,
      body: templateBody,
      placeholders: outputColumns.filter((column) => column !== "nomor_whatsapp"),
    },
    notification: {
      id: notificationId,
      name: `[Draft] ${migration.feature}`,
      category,
      description: `Draft notifikasi hasil konversi ${migration.legacySource}. Default nonaktif/dry-run sampai approval.`,
      queryId,
      templateId,
      scheduleConfig: {
        type: migration.cronSchedule ? "cron" : "manual",
        cron: migration.cronSchedule.split(";")[0]?.trim() || "",
        trigger: migration.legacyKey,
      },
      isActive: false,
      delayMs: isParty ? 2000 : 1000,
      retryLimit: 2,
    },
    checklist: generateMigrationChecklist(migration),
    warnings: [
      "Query draft masih placeholder aman (WHERE 1 = 0); mapping SQL legacy perlu diverifikasi manual.",
      ...(isParty ? ["Notifikasi pihak tidak diaktifkan otomatis."] : []),
      ...estimateMigrationRisk(migration).reasons,
    ],
  };
}

export function buildIntentDraftFromCommandCatalog(migration: AletaBotLegacyMigration): ConvertedCommandDraft {
  const seed = inferCommandSeed(migration);
  const key = seed?.key || slug(migration.registryTargetKey || migration.legacyKey || migration.id).replace(/-/g, "_");
  const isInternal = migration.legacyType === "admin_command";
  return {
    kind: "public_qa_intent",
    status: seed ? "registry_draft" : "needs_manual_mapping",
    intent: {
      id: `draft-intent-${slug(key)}`,
      key,
      name: seed?.name || `[Draft] ${migration.feature}`,
      description: `Draft intent hasil konversi command legacy ${migration.legacyKey || migration.sourceFunction}.`,
      category: seed?.category || "layanan",
      audience: isInternal ? "admin" : "party",
      isActive: false,
      aiEnabled: Boolean(seed),
      exactTriggers: seed?.triggers || [migration.legacyKey || migration.sourceFunction].filter(Boolean),
      exampleQuestions: seed?.examples || [`Saya ingin menggunakan ${migration.feature}`],
      requiredParameters: seed?.requiredParameters || [],
      legacyHandler: migration.sourceFunction || migration.legacyKey,
      legacyCommand: seed?.triggers?.[0] || migration.legacyKey || "",
      parameterizedLegacyCommand: seed?.requiredParameters?.length ? seed.triggers[0] : "",
      responseMode: seed?.responseMode || "legacy_handler",
      confidenceThreshold: 0.72,
      requiresVerification: ["case_number_only", "phone_match", "case_number_and_phone"].includes(seed?.verificationPolicy || ""),
      requiresCaseNumber: Boolean(seed?.requiredParameters?.includes("nomor_perkara")),
      maxAttempts: 3,
      fallbackMessage: "Maaf, pertanyaan Bapak/Ibu belum dapat diproses otomatis. Silakan hubungi PTSP/petugas melalui kanal resmi pengadilan.",
      riskLevel: seed?.riskLevel || migration.riskLevel,
      notes: "Draft hasil Smart Legacy Conversion. Aktifkan hanya setelah test intent dan approval.",
      aiAnswerEnabled: false,
      aiAnswerMode: seed?.aiAnswerMode || "off",
      answerPolicy: seed?.riskLevel === "high" || migration.riskLevel === "high" ? "requires_verified_party" : "public_info_only",
      verificationPolicy: seed?.verificationPolicy || "none",
      allowedDataFields: seed?.requiredParameters || [],
      blockedDataFields: ["nik", "alamat", "nomor_hp", "amar_lengkap", "catatan_internal"],
      requiresApprovalBeforeActive: true,
      status: "draft",
    },
    checklist: generateMigrationChecklist(migration),
    warnings: [
      ...(seed ? [] : ["Command belum dikenali penuh; mapping handler/template perlu dicek manual."]),
      ...(isInternal ? ["Command admin tidak boleh dibuka sebagai Public Q&A pihak."] : []),
      ...estimateMigrationRisk(migration).reasons,
    ],
  };
}

export function convertLegacyNotificationToDraft(migration: AletaBotLegacyMigration) {
  return buildNotificationDraftFromLegacySnapshot(migration);
}

export function convertLegacyCommandToIntentDraft(migration: AletaBotLegacyMigration) {
  return buildIntentDraftFromCommandCatalog(migration);
}

export function convertLegacyToDraft(migration: AletaBotLegacyMigration): ConvertedLegacyDraft {
  if (migration.legacyType === "party_notification" || migration.legacyType === "employee_notification") {
    return convertLegacyNotificationToDraft(migration);
  }
  return convertLegacyCommandToIntentDraft(migration);
}

export function validateConvertedDraft(draft: ConvertedLegacyDraft) {
  const issues: string[] = [];
  if (draft.kind === "notification") {
    if (!draft.query.outputColumns.length) issues.push("Query draft belum punya output columns.");
    if (draft.notification.category === "party" && !draft.query.recipientColumn) issues.push("Notifikasi pihak wajib punya recipient column.");
    if (draft.notification.isActive) issues.push("Draft hasil konversi tidak boleh langsung aktif.");
  } else {
    if (!draft.intent.key) issues.push("Intent draft wajib punya key.");
    if (!draft.intent.fallbackMessage) issues.push("Intent draft wajib punya fallback message.");
    if (draft.intent.audience === "party" && draft.intent.riskLevel === "high" && draft.intent.status === "active") {
      issues.push("Intent pihak high-risk tidak boleh langsung active.");
    }
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}
