import { positions } from "@/lib/mock-data";
import { type ActingAssignment, type Position, type RoleId, type UserPersona } from "@/lib/types";

const positionRoleMap: Record<string, RoleId> = {
  "pos-ketua": "ketua",
  "pos-wakil": "wakil-ketua",
  "pos-hakim": "hakim",
  "pos-sekretaris": "sekretaris",
  "pos-panitera": "panitera",
  "pos-panitera-muda-hukum": "pejabat-struktural",
  "pos-panitera-muda-gugatan": "pejabat-struktural",
  "pos-panitera-muda-permohonan": "pejabat-struktural",
  "pos-panitera-pengganti": "staf",
  "pos-analis-perkara": "staf",
  "pos-kasubag-umum": "pejabat-struktural",
  "pos-kasubag-kepegawaian": "pejabat-struktural",
  "pos-pranata-komputer": "staf",
  "pos-arsiparis": "staf",
  "pos-analis-keuangan": "staf",
  "pos-bendahara": "staf",
  "pos-pranata-humas": "staf",
  "pos-staf-umum": "staf",
  "pos-ptsp": "staf",
  "pos-pengadministrasi-umum": "staf",
  "pos-staf-kepegawaian": "staf",
  "pos-analis-kepegawaian": "staf",
  "pos-jurusita": "staf",
  "pos-jurusita-pengganti": "staf",
};

export type OrganizationTreeNode = {
  position: Position;
  definitiveUsers: UserPersona[];
  actingUsers: UserPersona[];
  children: OrganizationTreeNode[];
};

export type ActingAssignmentRuleApplied =
  | "court_leadership_deputy"
  | "court_leadership_judge"
  | "general_structural"
  | "functional_bkn_fallback"
  | "blocked";

export type ActingAssignmentEligibility = {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  priority: number;
  ruleApplied: ActingAssignmentRuleApplied;
};

export type ActingAssignmentCandidateEvaluation = {
  user: UserPersona;
  eligibility: ActingAssignmentEligibility;
};

export type ActingAssignmentValidationResult =
  | {
      valid: true;
      message: "";
      eligibility: ActingAssignmentEligibility;
    }
  | {
      valid: false;
      message: string;
      statusCodeHint?: number;
      eligibility?: ActingAssignmentEligibility;
    };

const courtLeadershipPositionNames = new Set([
  "ketua",
  "ketua pengadilan",
  "wakil ketua",
  "wakil ketua pengadilan",
]);

const courtLeadershipPositionIds = new Set(["pos-ketua", "pos-wakil"]);
const courtJudgeRoles = new Set<RoleId>(["hakim"]);
const deputyLeadershipRoles = new Set<RoleId>(["wakil-ketua"]);
const pltMaxMonths = 3;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizePositionName(position: Position | string | null | undefined) {
  return normalizeText(typeof position === "string" ? position : position?.name);
}

export function normalizeRoleName(role: RoleId | string | null | undefined) {
  return normalizeText(role);
}

function sortPositions(left: Position, right: Position) {
  if (left.levelHierarchy !== right.levelHierarchy) {
    return left.levelHierarchy - right.levelHierarchy;
  }

  if (left.unitKerja !== right.unitKerja) {
    return left.unitKerja.localeCompare(right.unitKerja);
  }

  return left.name.localeCompare(right.name);
}

export function getRoleForPosition(positionId: string): RoleId {
  return positionRoleMap[positionId] ?? "staf";
}

export function isCourtLeadershipTarget(targetPosition: Position | null | undefined) {
  if (!targetPosition) return false;

  return (
    courtLeadershipPositionIds.has(targetPosition.id) ||
    courtLeadershipPositionNames.has(normalizePositionName(targetPosition))
  );
}

export function isJudgeCandidate(
  user: UserPersona | null | undefined,
  positionSource: Position[] = positions
) {
  if (!user || !courtJudgeRoles.has(user.roleId)) return false;

  const candidatePosition = getPositionById(user.positionId, positionSource);
  return Boolean(candidatePosition && normalizePositionName(candidatePosition).includes("hakim"));
}

export function isActiveInternalEmployee(user: UserPersona | null | undefined) {
  return Boolean(user?.isActive);
}

export function isSameUnit(
  candidatePosition: Position | null | undefined,
  targetPosition: Position | null | undefined
) {
  if (!candidatePosition || !targetPosition) return false;

  return normalizeText(candidatePosition.unitKerja) === normalizeText(targetPosition.unitKerja);
}

export function isActingAssignmentActive(
  assignment: ActingAssignment | null | undefined,
  referenceDate: Date = new Date()
) {
  if (!assignment) return false;

  const currentTime = referenceDate.getTime();
  const startTime = assignment.startDate ? new Date(assignment.startDate).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = assignment.endDate ? new Date(assignment.endDate).getTime() : Number.POSITIVE_INFINITY;

  return currentTime >= startTime && currentTime <= endTime;
}

export function getResolvedActingAssignment(
  user: UserPersona | null | undefined,
  referenceDate: Date = new Date()
) {
  return isActingAssignmentActive(user?.actingAssignment, referenceDate) ? user?.actingAssignment ?? null : null;
}

export function resolveEffectivePositionId(
  user: UserPersona | null | undefined,
  referenceDate: Date = new Date()
) {
  return getResolvedActingAssignment(user, referenceDate)?.positionId ?? user?.positionId ?? null;
}

export function resolveEffectiveRoleId(user: UserPersona | null | undefined, referenceDate: Date = new Date()) {
  return getResolvedActingAssignment(user, referenceDate)?.roleId ?? user?.roleId ?? null;
}

export function getPositionById(positionId: string, positionSource: Position[] = positions) {
  return positionSource.find((position) => position.id === positionId) ?? null;
}

export function getDirectSubordinatePositions(positionId: string, positionSource: Position[] = positions) {
  return positionSource
    .filter((position) => position.reportsToPositionId === positionId)
    .sort(sortPositions);
}

export function isDirectSubordinatePosition(
  supervisorPositionId: string,
  subordinatePositionId: string,
  positionSource: Position[] = positions
) {
  return getPositionById(subordinatePositionId, positionSource)?.reportsToPositionId === supervisorPositionId;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() < day) {
    next.setDate(0);
  }

  return next;
}

function parseDateInput(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSenioritySortKey(user: UserPersona) {
  return user.nip || user.name;
}

export function validateActingAssignmentPeriod({
  actingType,
  startDate,
  endDate,
}: {
  actingType: ActingAssignment["type"];
  startDate?: string;
  endDate?: string | null;
}) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);

  if (actingType !== "PLH" && actingType !== "PLT") {
    return { valid: false, message: "Tipe penugasan harus PLH atau PLT." };
  }

  if (!start || !end) {
    return { valid: false, message: `${actingType} wajib memiliki rentang tanggal aktif yang lengkap.` };
  }

  if (end < start) {
    return { valid: false, message: `Tanggal akhir ${actingType} harus sama atau setelah tanggal mulai.` };
  }

  if (actingType === "PLT" && end > addMonths(start, pltMaxMonths)) {
    return { valid: false, message: "Durasi PLT paling lama 3 bulan untuk satu periode penugasan." };
  }

  return { valid: true, message: "" };
}

export function hasOverlappingAssignment(
  candidate: UserPersona | null | undefined,
  {
    referenceDate = new Date(),
  }: {
    referenceDate?: Date;
  } = {}
) {
  return Boolean(getResolvedActingAssignment(candidate, referenceDate));
}

export function getActingAssignmentEligibility(
  candidate: UserPersona | null | undefined,
  targetPosition: Position | null | undefined,
  actingType: ActingAssignment["type"],
  {
    positionSource = positions,
    supervisorUser = null,
    referenceDate = new Date(),
  }: {
    positionSource?: Position[];
    supervisorUser?: UserPersona | null;
    referenceDate?: Date;
  } = {}
): ActingAssignmentEligibility {
  const blocked = (
    reason: string,
    warnings: string[] = []
  ): ActingAssignmentEligibility => ({
    eligible: false,
    reasons: [reason],
    warnings,
    priority: 999,
    ruleApplied: "blocked",
  });

  if (!candidate || !targetPosition) {
    return blocked("Kandidat dan jabatan target harus tersedia.");
  }

  if (!isActiveInternalEmployee(candidate)) {
    return blocked("Kandidat tidak aktif atau sudah diblokir/nonaktif.");
  }

  if (candidate.id === supervisorUser?.id) {
    return blocked("Pejabat definitif tidak boleh menunjuk dirinya sendiri sebagai PLH/PLT.");
  }

  if (candidate.positionId === targetPosition.id) {
    return blocked("Kandidat sudah memegang jabatan definitif yang sama dengan jabatan target.");
  }

  if (hasOverlappingAssignment(candidate, { referenceDate })) {
    return blocked("Kandidat sedang memiliki penugasan PLH/PLT aktif lain.");
  }

  const candidatePosition = getPositionById(candidate.positionId, positionSource);
  if (!candidatePosition) {
    return blocked("Jabatan definitif kandidat tidak ditemukan.");
  }

  const leadershipTarget = isCourtLeadershipTarget(targetPosition);
  const leadershipWarnings =
    leadershipTarget && !isSameUnit(candidatePosition, targetPosition)
      ? ["Data satuan kerja belum terpisah dari unit organisasi; kandidat dianggap internal satu pengadilan berdasarkan data user aktif."]
      : [];

  if (leadershipTarget && targetPosition.id === "pos-ketua" && deputyLeadershipRoles.has(candidate.roleId)) {
    return {
      eligible: true,
      reasons: ["Wakil Ketua aktif menjadi prioritas PLH/PLT Ketua Pengadilan."],
      warnings: leadershipWarnings,
      priority: 10,
      ruleApplied: "court_leadership_deputy",
    };
  }

  if (leadershipTarget && isJudgeCandidate(candidate, positionSource)) {
    return {
      eligible: true,
      reasons: ["Hakim aktif dalam satuan kerja pengadilan dapat menjadi kandidat PLH/PLT pimpinan pengadilan."],
      warnings: [
        ...leadershipWarnings,
        "Data jenjang fungsional/senioritas belum lengkap; sistem memakai fallback deterministik berbasis NIP/nama.",
      ],
      priority: targetPosition.id === "pos-wakil" ? 10 : 20,
      ruleApplied: "court_leadership_judge",
    };
  }

  if (isDirectSubordinatePosition(targetPosition.id, candidate.positionId, positionSource)) {
    return {
      eligible: true,
      reasons: ["Kandidat merupakan bawahan langsung jabatan target dalam bagan organisasi."],
      warnings: [],
      priority: 50,
      ruleApplied: "general_structural",
    };
  }

  if (
    candidate.roleId === "pejabat-struktural" &&
    isSameUnit(candidatePosition, targetPosition) &&
    candidatePosition.levelHierarchy > targetPosition.levelHierarchy
  ) {
    return {
      eligible: true,
      reasons: ["Kandidat struktural berada pada jenjang organisasi di bawah jabatan target."],
      warnings: ["Validasi detail pangkat/jenjang belum tersedia; gunakan audit manual bila diperlukan."],
      priority: 70,
      ruleApplied: "functional_bkn_fallback",
    };
  }

  if (!leadershipTarget && isJudgeCandidate(candidate, positionSource)) {
    return blocked("Hakim tidak otomatis eligible untuk jabatan non-pimpinan pengadilan.");
  }

  return blocked("Kandidat tidak sesuai jalur jabatan untuk PLH/PLT target.");
}

export function getEligibleCandidatesForActingAssignment(
  targetPosition: Position | null | undefined,
  actingType: ActingAssignment["type"],
  {
    userSource,
    positionSource = positions,
    supervisorUser = null,
    includeIneligible = false,
    referenceDate = new Date(),
  }: {
    userSource: UserPersona[];
    positionSource?: Position[];
    supervisorUser?: UserPersona | null;
    includeIneligible?: boolean;
    referenceDate?: Date;
  }
): ActingAssignmentCandidateEvaluation[] {
  return userSource
    .map((user) => ({
      user,
      eligibility: getActingAssignmentEligibility(user, targetPosition, actingType, {
        positionSource,
        supervisorUser,
        referenceDate,
      }),
    }))
    .filter((item) => includeIneligible || item.eligibility.eligible)
    .sort((left, right) => {
      if (left.eligibility.eligible !== right.eligibility.eligible) {
        return left.eligibility.eligible ? -1 : 1;
      }

      if (left.eligibility.priority !== right.eligibility.priority) {
        return left.eligibility.priority - right.eligibility.priority;
      }

      const leftSeniority = getSenioritySortKey(left.user);
      const rightSeniority = getSenioritySortKey(right.user);
      if (leftSeniority !== rightSeniority) {
        return leftSeniority.localeCompare(rightSeniority);
      }

      return left.user.name.localeCompare(right.user.name);
    });
}

export function getAssignableActingUsers(
  supervisorUser: UserPersona | null | undefined,
  userSource: UserPersona[],
  actingType: ActingAssignment["type"] = "PLH",
  positionSource: Position[] = positions
) {
  const supervisorPositionId = resolveEffectivePositionId(supervisorUser);
  if (!supervisorPositionId) return [];

  const targetPosition = getPositionById(supervisorPositionId, positionSource);

  return getEligibleCandidatesForActingAssignment(targetPosition, actingType, {
    userSource,
    positionSource,
    supervisorUser,
  }).map((item) => item.user);
}

export function validateActingAssignmentRequest({
  supervisorUser,
  assigneeUser,
  actingType,
  targetPositionId,
  startDate,
  endDate,
  reason,
  positionSource = positions,
}: {
  supervisorUser: UserPersona | null | undefined;
  assigneeUser: UserPersona | null | undefined;
  actingType: ActingAssignment["type"];
  targetPositionId: string;
  startDate?: string;
  endDate?: string | null;
  reason?: string | null;
  positionSource?: Position[];
}): ActingAssignmentValidationResult {
  if (!supervisorUser || !assigneeUser) {
    return { valid: false, message: "Atasan dan penerima penugasan harus dipilih." };
  }

  const supervisorPositionId = resolveEffectivePositionId(supervisorUser);
  if (!supervisorPositionId) {
    return { valid: false, message: "Jabatan atasan tidak dapat ditentukan." };
  }

  if (targetPositionId !== supervisorPositionId) {
    return { valid: false, message: "Jabatan yang diemban harus sama dengan jabatan atasan yang memberi penugasan." };
  }

  const periodValidation = validateActingAssignmentPeriod({ actingType, startDate, endDate });
  if (!periodValidation.valid) {
    return { valid: false, message: periodValidation.message };
  }

  if (!reason?.trim()) {
    return { valid: false, message: `${actingType} wajib menyertakan alasan penugasan.` };
  }

  const targetPosition = getPositionById(targetPositionId, positionSource);
  const eligibility = getActingAssignmentEligibility(assigneeUser, targetPosition, actingType, {
    positionSource,
    supervisorUser,
  });

  if (!eligibility.eligible) {
    const statusCodeHint = eligibility.reasons.some((reason) => reason.includes("jalur jabatan") || reason.includes("non-pimpinan"))
      ? 403
      : 400;
    return {
      valid: false,
      message: eligibility.reasons[0] ?? "Kandidat tidak eligible untuk penugasan PLH/PLT.",
      statusCodeHint,
      eligibility,
    };
  }

  return { valid: true, message: "", eligibility };
}

export function getOrganizationRoots(positionSource: Position[] = positions) {
  return positionSource.filter((position) => !position.reportsToPositionId).sort(sortPositions);
}

export function getPositionDefinitiveUsers(positionId: string, userSource: UserPersona[]) {
  return userSource
    .filter((user) => user.isActive && user.positionId === positionId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getPositionActingUsers(positionId: string, userSource: UserPersona[]) {
  return userSource
    .filter((user) => user.isActive && resolveEffectivePositionId(user) === positionId && user.positionId !== positionId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildOrganizationTree(
  userSource: UserPersona[],
  positionSource: Position[] = positions
): OrganizationTreeNode[] {
  const buildNode = (position: Position): OrganizationTreeNode => ({
    position,
    definitiveUsers: getPositionDefinitiveUsers(position.id, userSource),
    actingUsers: getPositionActingUsers(position.id, userSource),
    children: getDirectSubordinatePositions(position.id, positionSource).map(buildNode),
  });

  return getOrganizationRoots(positionSource).map(buildNode);
}
