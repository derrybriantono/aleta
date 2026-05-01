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

export function getAssignableActingUsers(
  supervisorUser: UserPersona | null | undefined,
  userSource: UserPersona[]
) {
  const supervisorPositionId = resolveEffectivePositionId(supervisorUser);
  if (!supervisorPositionId) return [];

  return userSource
    .filter((user) => user.isActive && isDirectSubordinatePosition(supervisorPositionId, user.positionId))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function validateActingAssignmentRequest({
  supervisorUser,
  assigneeUser,
  actingType,
  targetPositionId,
  startDate,
  endDate,
}: {
  supervisorUser: UserPersona | null | undefined;
  assigneeUser: UserPersona | null | undefined;
  actingType: ActingAssignment["type"];
  targetPositionId: string;
  startDate?: string;
  endDate?: string | null;
}) {
  if (!supervisorUser || !assigneeUser) {
    return { valid: false, message: "Atasan dan penerima penugasan harus dipilih." };
  }

  const supervisorPositionId = resolveEffectivePositionId(supervisorUser);
  if (!supervisorPositionId) {
    return { valid: false, message: "Jabatan atasan tidak dapat ditentukan." };
  }

  if (!isDirectSubordinatePosition(supervisorPositionId, assigneeUser.positionId)) {
    return { valid: false, message: "Penugasan hanya dapat diberikan kepada bawahan langsung dalam bagan organisasi." };
  }

  if (targetPositionId !== supervisorPositionId) {
    return { valid: false, message: "Jabatan yang diemban harus sama dengan jabatan atasan yang memberi penugasan." };
  }

  if (actingType === "PLH" && (!startDate || !endDate)) {
    return { valid: false, message: "PLH wajib memiliki rentang tanggal aktif yang lengkap." };
  }

  if (actingType === "PLH" && startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return { valid: false, message: "Tanggal akhir PLH harus sama atau setelah tanggal mulai." };
  }

  return { valid: true, message: "" };
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
