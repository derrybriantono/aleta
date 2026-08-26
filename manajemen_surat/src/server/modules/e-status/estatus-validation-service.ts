export type EStatusRecordForValidation = {
  id: string;
  nomorPerkara: string;
  jenisPerkara: string;
  kategoriPerubahan: string;
  statusHukum: string;
  tanggalPutusan: string | null;
  tanggalBht: string | null;
  tanggalIkrarTalak: string | null;
  nomorAktaCerai: string | null;
  amarRingkas: string;
  destinationAgencyId: string | null;
  alreadySent: number;
};

export type EStatusPartyForValidation = {
  partyRole: string;
  nama: string;
  nik: string;
  tanggalLahir: string | null;
  alamat: string;
  kabupatenKota: string;
  pasanganNama?: string;
  pasanganNik?: string;
};

export type EStatusValidationLevel = "info" | "warning" | "error" | "critical";

export type EStatusValidationResultInput = {
  code: string;
  level: EStatusValidationLevel;
  message: string;
  fieldPath?: string;
  ruleId?: string | null;
  isConfigurable?: boolean;
};

export type EStatusValidationRuleForEvaluation = {
  id: string;
  ruleCode: string;
  changeType: string;
  severity: EStatusValidationLevel;
  isBlocking: boolean;
  isActive: boolean;
};

export type EStatusDuplicateFinding = {
  code: string;
  message: string;
  groupKey: string;
  reason: string;
  level?: EStatusValidationLevel;
  fieldPath?: string;
};

export type EStatusReadinessReason = {
  code: string;
  label: string;
  penalty: number;
  severity: "info" | "warning" | "danger";
};

type ValidationOptions = {
  rules?: EStatusValidationRuleForEvaluation[];
  duplicateFindings?: EStatusDuplicateFinding[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isNikValid(value: string) {
  return !value || /^[0-9]{16}$/.test(value);
}

function isNegativeAmar(value: string) {
  const amar = normalize(value);
  return ["dicabut", "ditolak", "tidak dapat diterima", "niet ontvankelijke"].some((term) => amar.includes(term));
}

function hasActiveLegalRemedy(value: string) {
  const status = normalize(value);
  return ["banding aktif", "kasasi aktif", "pk aktif", "peninjauan kembali aktif", "upaya hukum aktif"].some((term) =>
    status.includes(term)
  );
}

function qualityScore(parties: EStatusPartyForValidation[]) {
  if (parties.length === 0) return 0;

  const fields = parties.flatMap((party) => [
    party.nama,
    party.nik,
    party.tanggalLahir ?? "",
    party.alamat,
    party.kabupatenKota,
  ]);
  const filled = fields.filter((field) => field.trim()).length;

  return Math.round((filled / fields.length) * 100);
}

function ruleApplies(rule: EStatusValidationRuleForEvaluation, changeType: string) {
  return rule.changeType === "ALL" || rule.changeType === changeType;
}

function buildRuleLookup(rules: EStatusValidationRuleForEvaluation[] | undefined, changeType: string) {
  const lookup = new Map<string, EStatusValidationRuleForEvaluation>();
  for (const rule of rules ?? []) {
    if (ruleApplies(rule, changeType)) {
      lookup.set(rule.ruleCode, rule);
    }
  }
  return lookup;
}

function calculateReadiness(
  record: EStatusRecordForValidation,
  parties: EStatusPartyForValidation[],
  duplicateFindings: EStatusDuplicateFinding[]
) {
  const reasons: EStatusReadinessReason[] = [];

  const add = (code: string, label: string, penalty: number, severity: EStatusReadinessReason["severity"] = "warning") => {
    reasons.push({ code, label, penalty, severity });
  };

  if (!record.nomorPerkara.trim()) add("CASE_NUMBER_MISSING", "Nomor perkara belum tersedia", 35, "danger");
  if (!record.tanggalPutusan) add("DECISION_DATE_MISSING", "Tanggal putusan/penetapan belum terbaca", 20, "danger");
  if (record.kategoriPerubahan === "PERCERAIAN" && !record.tanggalBht) {
    add("BHT_MISSING", "Tanggal BHT belum terbaca", 30, "danger");
  }
  if (record.kategoriPerubahan === "PERCERAIAN" && normalize(record.jenisPerkara).includes("cerai talak")) {
    if (!record.tanggalIkrarTalak && !record.nomorAktaCerai) {
      add("TALAK_IKRAR_OR_CERTIFICATE_MISSING", "Data ikrar talak/akta cerai perlu dipastikan", 15);
    }
  }
  if (record.kategoriPerubahan === "ITSBAT_NIKAH" && !normalize(record.amarRingkas).includes("dikabul")) {
    add("ITSBAT_GRANTED_NOT_DETECTED", "Amar dikabulkan belum terdeteksi", 30, "danger");
  }
  if (!record.destinationAgencyId) add("DESTINATION_AGENCY_MISSING", "Instansi tujuan belum dipilih", 10);
  if (parties.length < 2) add("PARTIES_INCOMPLETE", "Data pihak belum memuat minimal dua orang", 30, "danger");

  const missingNikCount = parties.filter((party) => !party.nik.trim()).length;
  if (missingNikCount > 0) add("NIK_MISSING", `${missingNikCount} pihak belum memiliki NIK`, Math.min(20, missingNikCount * 10));

  const invalidNikCount = parties.filter((party) => party.nik.trim() && !isNikValid(party.nik)).length;
  if (invalidNikCount > 0) add("NIK_INVALID", `${invalidNikCount} NIK tidak valid`, Math.min(20, invalidNikCount * 10));

  const incompleteAddressCount = parties.filter((party) => !party.alamat.trim() || !party.kabupatenKota.trim()).length;
  if (incompleteAddressCount > 0) {
    add("ADDRESS_INCOMPLETE", `${incompleteAddressCount} alamat belum sampai kabupaten/kota`, Math.min(16, incompleteAddressCount * 8));
  }

  if (parties.some((party) => !normalize(party.pasanganNama) && !normalize(party.pasanganNik))) {
    add("SPOUSE_DATA_INCOMPLETE", "Data pasangan belum lengkap untuk sebagian pihak", 8, "info");
  }

  if (duplicateFindings.length > 0) {
    add("DUPLICATE_DETECTED", "Ada indikasi data pernah masuk/terkirim sebelumnya", 30, "danger");
  }

  if (record.alreadySent) {
    add("ALREADY_SENT", "Data sudah pernah dikirim final", 40, "danger");
  }

  const penalty = reasons.reduce((total, reason) => total + reason.penalty, 0);
  return {
    readinessScore: Math.max(0, Math.min(100, 100 - penalty)),
    readinessReasons: reasons,
  };
}

export function validateEStatusRecord(
  record: EStatusRecordForValidation,
  parties: EStatusPartyForValidation[],
  options: ValidationOptions = {}
) {
  const results: EStatusValidationResultInput[] = [];
  const caseType = normalize(record.jenisPerkara);
  const changeType = record.kategoriPerubahan;
  const ruleLookup = buildRuleLookup(options.rules, changeType);
  const hasConfigRules = Boolean(options.rules);

  const pushRule = (
    code: string,
    fallbackLevel: EStatusValidationLevel,
    message: string,
    fieldPath?: string
  ) => {
    const rule = ruleLookup.get(code);
    if (hasConfigRules && (!rule || !rule.isActive)) return;
    results.push({
      code,
      level: rule?.severity ?? fallbackLevel,
      message,
      fieldPath,
      ruleId: rule?.id ?? null,
      isConfigurable: Boolean(rule),
    });
  };

  if (!record.nomorPerkara.trim()) {
    pushRule("CASE_NUMBER_REQUIRED", "critical", "Nomor perkara wajib tersedia.", "record.nomor_perkara");
  }

  if (!record.tanggalPutusan) {
    pushRule("DECISION_DATE_REQUIRED", "error", "Tanggal putusan/penetapan wajib tersedia.", "record.tanggal_putusan");
  }

  if (hasActiveLegalRemedy(record.statusHukum)) {
    pushRule("NO_ACTIVE_LEGAL_REMEDY", "critical", "Status perkara mengindikasikan upaya hukum aktif.", "record.status_hukum");
  }

  if (changeType === "PERCERAIAN") {
    if (!caseType.includes("cerai gugat") && !caseType.includes("cerai talak")) {
      pushRule(
        "DIV_CASE_TYPE_ALLOWED",
        "critical",
        "Jenis perkara perceraian harus Cerai Gugat atau Cerai Talak.",
        "record.jenis_perkara"
      );
    }
    if (!record.tanggalBht) {
      pushRule("DIV_BHT_EXISTS", "critical", "Tanggal BHT wajib tersedia sebelum data perceraian dapat dikirim.", "record.tanggal_bht");
    }
    if (isNegativeAmar(record.amarRingkas)) {
      pushRule(
        "DIV_AMAR_NOT_NEGATIVE",
        "critical",
        "Amar mengandung indikasi dicabut, ditolak, atau tidak dapat diterima.",
        "record.amar_ringkas"
      );
    }
    if (caseType.includes("cerai talak") && !record.tanggalIkrarTalak && !record.nomorAktaCerai) {
      pushRule(
        "DIV_TALAK_IKRAR_WARNING",
        "warning",
        "Cerai Talak belum memiliki tanggal ikrar talak atau nomor akta cerai yang terbaca.",
        "record.tanggal_ikrar_talak"
      );
    }
    if (!record.nomorAktaCerai) {
      pushRule("DIV_AKTA_CERAI_RECOMMENDED", "warning", "Nomor akta cerai belum terbaca.", "record.nomor_akta_cerai");
    }
  }

  if (changeType === "ITSBAT_NIKAH") {
    if (!caseType.includes("itsbat") && !caseType.includes("pengesahan nikah") && !caseType.includes("pengesahan perkawinan")) {
      pushRule(
        "ITSBAT_CASE_TYPE_ALLOWED",
        "critical",
        "Jenis perkara harus Itsbat Nikah atau Pengesahan Nikah/Perkawinan.",
        "record.jenis_perkara"
      );
    }
    if (!normalize(record.amarRingkas).includes("dikabul")) {
      pushRule("ITSBAT_GRANTED", "critical", "Amar/hasil itsbat harus menunjukkan permohonan dikabulkan.", "record.amar_ringkas");
    }
    if (!record.tanggalPutusan) {
      pushRule("ITSBAT_DECISION_FINAL", "error", "Tanggal penetapan itsbat wajib tersedia.", "record.tanggal_putusan");
    }
  }

  if (parties.length < 2) {
    pushRule(
      "MIN_TWO_PARTIES",
      changeType === "PERCERAIAN" ? "critical" : "error",
      "Minimal dua pihak harus terbaca untuk pencocokan status perkawinan.",
      "parties"
    );
  }

  parties.forEach((party, index) => {
    if (!party.nama.trim()) {
      pushRule(
        "PARTY_NAME_REQUIRED",
        "critical",
        `Nama pihak ${party.partyRole || index + 1} wajib tersedia.`,
        `parties[${index}].nama`
      );
    }
    if (!isNikValid(party.nik)) {
      pushRule(
        "NIK_FORMAT",
        "warning",
        `NIK pihak ${party.partyRole || index + 1} harus 16 digit numerik jika diisi.`,
        `parties[${index}].nik`
      );
    }
    if (!party.nik.trim()) {
      pushRule(
        "NIK_RECOMMENDED",
        "warning",
        `NIK pihak ${party.partyRole || index + 1} kosong. Data tetap dapat direview manual.`,
        `parties[${index}].nik`
      );
    }
    if (!party.alamat.trim() || !party.kabupatenKota.trim()) {
      pushRule(
        "ADDRESS_MINIMUM",
        "warning",
        `Alamat pihak ${party.partyRole || index + 1} sebaiknya memuat alamat dan kabupaten/kota.`,
        `parties[${index}].alamat`
      );
    }
  });

  if (!record.destinationAgencyId) {
    pushRule("DESTINATION_AGENCY_RECOMMENDED", "warning", "Instansi tujuan belum dipilih.", "record.destination_agency_id");
  }

  if (record.alreadySent) {
    pushRule(
      "NOT_ALREADY_SENT",
      "critical",
      "Data sudah pernah dikirim dalam batch final. Pengiriman ulang harus melalui revisi resmi.",
      "record.already_sent"
    );
  }

  for (const finding of options.duplicateFindings ?? []) {
    pushRule(finding.code, finding.level ?? "critical", finding.message, finding.fieldPath ?? "record.duplicate_status");
  }

  const hasCritical = results.some((result) => result.level === "critical");
  const hasError = results.some((result) => result.level === "error");
  const hasWarning = results.some((result) => result.level === "warning");
  const duplicateFindings = options.duplicateFindings ?? [];
  const { readinessScore, readinessReasons } = calculateReadiness(record, parties, duplicateFindings);
  const duplicateStatus = duplicateFindings.length > 0 ? "suspected" : "none";

  return {
    status: duplicateFindings.length > 0 ? "DUPLICATE" : hasCritical || hasError ? "INVALID" : hasWarning ? "NEEDS_REVIEW" : "VALID",
    qualityScore: qualityScore(parties),
    readinessScore,
    readinessReasons,
    duplicateStatus,
    duplicateGroupKey: duplicateFindings[0]?.groupKey ?? "",
    duplicateReason: duplicateFindings[0]?.reason ?? "",
    results,
  };
}
