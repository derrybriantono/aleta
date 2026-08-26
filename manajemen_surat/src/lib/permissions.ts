import {
  getResolvedActingAssignment,
  getPositionById,
  getRoleForPosition,
  resolveEffectivePositionId,
  resolveEffectiveRoleId,
} from "@/core/organization/service";
import {
  modules,
  portalApps,
  quickSearchSeeds,
  roles,
} from "@/lib/mock-data";
import {
  type DashboardMetric,
  type DispositionNode,
  type LetterDetail,
  type ModuleConfig,
  type ModuleVisibility,
  type OperationalSummaryItem,
  type PortalAppConfig,
  type Position,
  type RoleId,
  type SearchResult,
  type UserPersona,
} from "@/lib/types";

const adminRoleIds = new Set<RoleId>(["super-admin", "admin"]);
const leaderRoleIds = new Set<RoleId>(["ketua", "wakil-ketua"]);
const structuralAssignmentRoleIds = new Set<RoleId>([
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "hakim",
  "sekretaris",
  "panitera",
  "panitera-muda",
  "kasubag",
  "pejabat-struktural",
]);
const dispositionActionRoleIds = new Set<RoleId>([
  "ketua",
  "wakil-ketua",
  "sekretaris",
  "panitera",
  "panitera-muda",
  "kasubag",
  "pejabat-struktural",
]);
const leadershipPositionIds = new Set(["pos-ketua", "pos-wakil"]);

const emptyLetters: LetterDetail[] = [];
const emptyDispositions: DispositionNode[] = [];
const emptyUsers: UserPersona[] = [];
const emptyPositions: Position[] = [];
const emptyModuleVisibility: ModuleVisibility[] = [];

function getVisibleLetters(source: LetterDetail[] = emptyLetters) {
  return source.filter((letter) => !letter.deletedState);
}

function getVisibleLetterIds(source: LetterDetail[] = emptyLetters) {
  return new Set(getVisibleLetters(source).map((letter) => letter.id));
}

function getPositionMap(positionSource: Position[] = emptyPositions) {
  return new Map(positionSource.map((position) => [position.id, position]));
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

export function getRoleLabel(roleId: RoleId | null | undefined) {
  if (!roleId) return "-";

  return roles.find((role) => role.id === roleId)?.name ?? roleId;
}

export function getPosition(positionId: string, positionSource: Position[] = emptyPositions) {
  return getPositionById(positionId, positionSource);
}

export function getUser(userId: string | null | undefined, userSource: UserPersona[] = emptyUsers) {
  return userSource.find((persona) => persona.id === userId) ?? null;
}

export function getEffectiveRoleId(user: UserPersona | null | undefined) {
  return resolveEffectiveRoleId(user);
}

export function getEffectivePositionId(user: UserPersona | null | undefined) {
  return resolveEffectivePositionId(user);
}

export function getEffectivePosition(
  user: UserPersona | null | undefined,
  positionSource: Position[] = emptyPositions
) {
  const positionId = getEffectivePositionId(user);

  return positionId ? getPosition(positionId, positionSource) : null;
}

export function getUserRoleBadge(user: UserPersona | null | undefined) {
  if (!user) return "-";

  const actingAssignment = getResolvedActingAssignment(user);
  const roleLabel = getRoleLabel(getEffectiveRoleId(user));

  return actingAssignment ? `${actingAssignment.type} ${roleLabel}` : roleLabel;
}

export function getUserPositionLabel(
  user: UserPersona | null | undefined,
  positionSource: Position[] = emptyPositions
) {
  if (!user) return "-";

  const effectivePosition = getEffectivePosition(user, positionSource);
  const actingAssignment = getResolvedActingAssignment(user);

  if (!effectivePosition) return "-";

  return actingAssignment ? `${actingAssignment.type} ${effectivePosition.name}` : effectivePosition.name;
}

export function getUserAccessSummary(
  user: UserPersona | null | undefined,
  positionSource: Position[] = emptyPositions
) {
  if (!user) return "-";

  return `${getUserRoleBadge(user)} - ${getUserPositionLabel(user, positionSource)}`;
}

export function isPrivilegedAdmin(user: UserPersona | null | undefined) {
  const roleId = getEffectiveRoleId(user);

  return roleId ? adminRoleIds.has(roleId) : false;
}

export function canManageActingAssignments(user: UserPersona | null | undefined) {
  if (getResolvedActingAssignment(user) && user?.roleId !== "super-admin" && user?.roleId !== "admin") {
    return false;
  }

  const roleId = user?.roleId ?? null;

  return roleId ? structuralAssignmentRoleIds.has(roleId) : false;
}

export function canManageGlobalAI(user: UserPersona | null | undefined) {
  return getEffectiveRoleId(user) === "super-admin";
}

export function getDefaultRoleForPosition(positionId: string) {
  return getRoleForPosition(positionId);
}

export function isLeadershipRole(user: UserPersona | null | undefined) {
  const roleId = getEffectiveRoleId(user);

  return roleId ? leaderRoleIds.has(roleId) : false;
}

export function canUserAccessDispositionAction(user: UserPersona | null | undefined) {
  const roleId = getEffectiveRoleId(user);

  return roleId ? dispositionActionRoleIds.has(roleId) : false;
}

export function canUserForwardToLeadership(
  user: UserPersona | null | undefined,
  positionSource: Position[] = emptyPositions
) {
  return Boolean(getEffectivePosition(user, positionSource)?.canForwardToLeadership);
}

export function canUserRegisterLetters(user: UserPersona | null | undefined) {
  const effectivePositionId = getEffectivePositionId(user);

  return effectivePositionId === "pos-kasubag-umum" || effectivePositionId === "pos-staf-umum";
}

export function canCreateIncomingLetter(user: UserPersona | null | undefined) {
  const effectivePositionId = getEffectivePositionId(user);
  const roleId = getEffectiveRoleId(user);

  return roleId === "super-admin" || roleId === "admin" || effectivePositionId === "pos-kasubag-umum" || effectivePositionId === "pos-staf-umum";
}

export function canCreateOutgoingLetter(user: UserPersona | null | undefined) {
  const effectivePositionId = getEffectivePositionId(user);
  const roleId = getEffectiveRoleId(user);

  return (
    roleId === "super-admin" ||
    roleId === "admin" ||
    effectivePositionId === "pos-kasubag-umum" ||
    effectivePositionId === "pos-staf-umum" ||
    effectivePositionId === "pos-kasubag-kepegawaian" ||
    effectivePositionId === "pos-staf-kepegawaian"
  );
}

function collectDescendantPositionIds(
  positionId: string,
  positionSource: Position[] = emptyPositions
): Set<string> {
  const visited = new Set<string>();
  const positionMap = getPositionMap(positionSource);
  const queue = [...(positionMap.get(positionId)?.dispositionTargetPositionIds ?? [])];

  while (queue.length > 0) {
    const nextId = queue.shift();

    if (!nextId || visited.has(nextId)) continue;

    visited.add(nextId);

    const nextPosition = positionMap.get(nextId);
    if (!nextPosition) continue;

    queue.push(...(nextPosition.dispositionTargetPositionIds ?? []));
  }

  return visited;
}

export function getAllowedDispositionTargetPositions(
  user: UserPersona | null | undefined,
  options?: {
    bypass?: boolean;
    positionSource?: Position[];
  }
) {
  const positionSource = options?.positionSource ?? emptyPositions;
  const currentPositionId = getEffectivePositionId(user);

  if (!user || !currentPositionId) return [];

  if (isPrivilegedAdmin(user)) {
    return positionSource.filter((position) => position.id !== currentPositionId).sort(sortPositions);
  }

  const currentPosition = getPosition(currentPositionId, positionSource);
  if (!currentPosition) return [];

  const targetIds =
    options?.bypass && user.canBypassHierarchy
      ? collectDescendantPositionIds(currentPosition.id, positionSource)
      : new Set(currentPosition.dispositionTargetPositionIds ?? []);

  return positionSource.filter((position) => targetIds.has(position.id)).sort(sortPositions);
}

export function getLeadershipRecipients(
  userSource: UserPersona[] = emptyUsers,
  positionSource: Position[] = emptyPositions
) {
  return userSource
    .filter((persona) => persona.isActive && leadershipPositionIds.has(getEffectivePositionId(persona) ?? ""))
    .sort((left, right) => {
      const leftPosition = getEffectivePosition(left, positionSource);
      const rightPosition = getEffectivePosition(right, positionSource);

      if ((leftPosition?.levelHierarchy ?? 99) !== (rightPosition?.levelHierarchy ?? 99)) {
        return (leftPosition?.levelHierarchy ?? 99) - (rightPosition?.levelHierarchy ?? 99);
      }

      return left.name.localeCompare(right.name);
    });
}

export function isDispositionAssignedToUser(
  user: UserPersona | null | undefined,
  disposition: DispositionNode
) {
  if (!user) return false;
  if (isPrivilegedAdmin(user)) return true;

  const effectivePositionId = getEffectivePositionId(user);

  return disposition.penerimaId === user.id || disposition.targetPositionId === effectivePositionId;
}

export function authenticateUser(
  username: string,
  password: string,
  userSource: UserPersona[] = emptyUsers
) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim();

  return (
    userSource.find(
      (persona) =>
        persona.username.toLowerCase() === normalizedUsername &&
        persona.password === normalizedPassword &&
        persona.isActive
    ) ?? null
  );
}

export function getLetter(letterId: string, source: LetterDetail[] = emptyLetters) {
  return getVisibleLetters(source).find((letter) => letter.id === letterId) ?? null;
}

export function getDisposition(dispositionId: string, source: DispositionNode[] = emptyDispositions) {
  return source.find((item) => item.id === dispositionId) ?? null;
}

export function getDispositionChildren(
  dispositionId: string,
  source: DispositionNode[] = emptyDispositions
) {
  return source.filter((item) => item.parentDispositionId === dispositionId);
}

export function getLetterDispositions(suratId: string, source: DispositionNode[] = emptyDispositions) {
  return source
    .filter((item) => item.suratId === suratId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export function getAccessibleModules(
  user: UserPersona | null,
  visibility: ModuleVisibility[] = emptyModuleVisibility
) {
  if (!user) return [];

  const roleId = getEffectiveRoleId(user);
  const positionId = getEffectivePositionId(user);
  const roleVisibility = visibility.find((item) => item.roleId === roleId);

  return modules.filter((module) => {
    const roleAllowed = roleId ? module.roleIds.includes(roleId) : false;
    const positionAllowed = !module.positionIds || (positionId ? module.positionIds.includes(positionId) : false);
    const visibilityAllowed = module.id ? roleVisibility?.modules[module.id] ?? false : false;

    return roleAllowed && positionAllowed && visibilityAllowed;
  });
}

export function getAccessiblePortalApps(
  user: UserPersona | null,
  visibility: ModuleVisibility[] = emptyModuleVisibility
): PortalAppConfig[] {
  if (!user) return [];

  const roleId = getEffectiveRoleId(user);
  const roleVisibility = visibility.find((item) => item.roleId === roleId);

  return portalApps.filter((app) => {
    const roleAllowed = roleId ? app.roleIds.includes(roleId) : false;
    const visibilityAllowed = roleVisibility?.modules[app.id] ?? false;
    return roleAllowed && visibilityAllowed;
  });
}

export function getAccessibleLetters(
  user: UserPersona | null,
  letterSource: LetterDetail[] = emptyLetters,
  dispositionSource: DispositionNode[] = emptyDispositions,
  positionSource: Position[] = emptyPositions
) {
  if (!user) return [];

  const visibleLetters = getVisibleLetters(letterSource);
  const roleId = getEffectiveRoleId(user);
  const effectivePositionId = getEffectivePositionId(user);
  const effectivePosition = getEffectivePosition(user, positionSource);

  if (roleId && adminRoleIds.has(roleId)) {
    return visibleLetters;
  }

  return visibleLetters.filter((letter) => {
    const relatedDispositions = dispositionSource.filter((item) => item.suratId === letter.id);

    return relatedDispositions.some((item) => {
      const recipient = item.penerimaId === user.id;
      const sender = item.pengirimId === user.id;
      const samePosition = effectivePositionId ? item.targetPositionId === effectivePositionId : false;
      const sameUnit =
        getPosition(item.targetPositionId, positionSource)?.unitKerja === effectivePosition?.unitKerja;

      return recipient || sender || samePosition || sameUnit;
    });
  });
}

export function getDashboardMetrics(
  user: UserPersona | null,
  letterSource: LetterDetail[] = emptyLetters,
  dispositionSource: DispositionNode[] = emptyDispositions,
  positionSource: Position[] = emptyPositions
): DashboardMetric[] {
  const accessibleLetters = getAccessibleLetters(user, letterSource, dispositionSource, positionSource);
  const visibleLetterIds = getVisibleLetterIds(letterSource);
  const pendingDispositions = dispositionSource.filter(
    (item) => isDispositionAssignedToUser(user, item) && item.status !== "Selesai" && visibleLetterIds.has(item.suratId)
  );
  const completedCount = dispositionSource.filter(
    (item) => isDispositionAssignedToUser(user, item) && item.status === "Selesai" && visibleLetterIds.has(item.suratId)
  ).length;

  return [
    {
      id: "metric-1",
      label: "Surat Terlihat",
      value: `${accessibleLetters.length}`,
      hint: "Total surat yang tampil sesuai RBAC saat ini.",
    },
    {
      id: "metric-2",
      label: "Inbox Aktif",
      value: `${pendingDispositions.length}`,
      hint: "Disposisi yang masih menunggu telaah atau tindak lanjut.",
    },
    {
      id: "metric-3",
      label: "Tindak Lanjut Selesai",
      value: `${completedCount}`,
      hint: "Item yang sudah ditutup melalui closed-loop reporting.",
    },
  ];
}

export function getPendingInbox(
  user: UserPersona | null,
  dispositionSource: DispositionNode[] = emptyDispositions,
  letterSource: LetterDetail[] = emptyLetters
) {
  if (!user) return [];

  const visibleLetterIds = getVisibleLetterIds(letterSource);

  return dispositionSource
    .filter((item) => isDispositionAssignedToUser(user, item) && item.status !== "Selesai" && visibleLetterIds.has(item.suratId))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function getPositionUsers(positionId: string, userSource: UserPersona[] = emptyUsers) {
  return userSource
    .filter((persona) => getEffectivePositionId(persona) === positionId && persona.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getUnits(positionSource: Position[] = emptyPositions) {
  return [...new Set(positionSource.map((position) => position.unitKerja))];
}

export function searchPortal(
  query: string,
  user: UserPersona | null,
  letterSource: LetterDetail[] = emptyLetters,
  dispositionSource: DispositionNode[] = emptyDispositions,
  userSource: UserPersona[] = emptyUsers,
  positionSource: Position[] = emptyPositions
): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const accessibleLetters = getAccessibleLetters(user, letterSource, dispositionSource, positionSource);
  const visibleLetterIds = getVisibleLetterIds(letterSource);
  const effectiveRoleId = getEffectiveRoleId(user);
  const letterResults = accessibleLetters
    .filter((letter) =>
      [letter.perihal, letter.nomorSurat, letter.pengirim, ...letter.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    )
    .map<SearchResult>((letter) => ({
      id: `letter-${letter.id}`,
      type: "surat",
      title: letter.perihal,
      excerpt: `${letter.nomorSurat} - ${letter.pengirim} - ${letter.status}`,
      href: `/surat/${letter.id}`,
      keywords: [letter.nomorSurat, ...letter.tags],
    }));

  const dispositionResults = dispositionSource
    .filter((item) => {
      if (effectiveRoleId && adminRoleIds.has(effectiveRoleId)) return true;

      return isDispositionAssignedToUser(user, item) || item.pengirimId === user?.id;
    })
    .filter((item) => visibleLetterIds.has(item.suratId))
    .filter((item) => item.instruksi.toLowerCase().includes(normalized))
    .map<SearchResult>((item) => ({
      id: `disposition-${item.id}`,
      type: "disposisi",
      title: item.instruksi,
      excerpt: `${item.id} - ${item.status}`,
      href: `/disposisi/${item.id}`,
      keywords: [item.status],
    }));

  const userResults =
    effectiveRoleId && adminRoleIds.has(effectiveRoleId)
      ? userSource
          .filter((item) =>
            [item.name, item.email, getPosition(getEffectivePositionId(item) ?? "", positionSource)?.name ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(normalized)
          )
          .map<SearchResult>((item) => ({
            id: `user-${item.id}`,
            type: "pengguna",
            title: item.name,
            excerpt: `${getPosition(getEffectivePositionId(item) ?? "", positionSource)?.name ?? "-"} - ${item.email}`,
            href: "/admin/mapping-user-jabatan",
            keywords: [getPosition(getEffectivePositionId(item) ?? "", positionSource)?.name ?? ""],
          }))
      : [];

  const seeded = quickSearchSeeds.filter((item) => {
    const matches = [item.title, item.excerpt, ...item.keywords].join(" ").toLowerCase().includes(normalized);
    const adminOnlyUserSeed =
      item.type === "pengguna" && (!effectiveRoleId || !adminRoleIds.has(effectiveRoleId));

    return matches && !adminOnlyUserSeed;
  });

  return [...letterResults, ...dispositionResults, ...userResults, ...seeded].filter(
    (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index
  );
}

export function getInboxNotificationCount(
  user: UserPersona | null,
  letterSource: LetterDetail[] = emptyLetters,
  dispositionSource: DispositionNode[] = emptyDispositions,
  positionSource: Position[] = emptyPositions
) {
  if (!user) return 0;

  return getAccessibleLetters(user, letterSource, dispositionSource, positionSource).filter(
    (letter) => letter.type === "masuk" && letter.status === "Baru"
  ).length;
}

export function getOperationalSummary(
  user: UserPersona | null,
  letterSource: LetterDetail[] = emptyLetters,
  dispositionSource: DispositionNode[] = emptyDispositions,
  positionSource: Position[] = emptyPositions
): OperationalSummaryItem[] {
  if (!user) return [];

  const accessibleLetters = getAccessibleLetters(user, letterSource, dispositionSource, positionSource);
  const pendingInbox = getPendingInbox(user, dispositionSource, letterSource);
  const completedLetters = accessibleLetters.filter((letter) => letter.status === "Selesai");
  const roleId = getEffectiveRoleId(user);

  if (roleId && adminRoleIds.has(roleId)) {
    return [
      {
        id: "ops-admin-new",
        title: "Surat Baru Perlu Ditinjau",
        description: "Memusatkan surat masuk baru yang belum diproses untuk aksi cepat admin.",
        href: "/surat?type=masuk&status=Baru",
        badge: `${accessibleLetters.filter((letter) => letter.type === "masuk" && letter.status === "Baru").length} baru`,
      },
      {
        id: "ops-admin-inbox",
        title: "Inbox Disposisi Aktif",
        description: "Melihat disposisi yang masih berjalan dan belum ditutup.",
        href: "/surat?metric=inbox",
        badge: `${pendingInbox.length} tugas`,
      },
      {
        id: "ops-admin-complete",
        title: "Arsip Tindak Lanjut",
        description: "Akses cepat ke surat yang sudah selesai untuk validasi akhir.",
        href: "/surat?metric=completed",
        badge: `${completedLetters.length} selesai`,
      },
    ];
  }

  if (roleId && leaderRoleIds.has(roleId)) {
    return [
      {
        id: "ops-lead-inbox",
        title: "Inbox Arahan Pimpinan",
        description: "Daftar disposisi yang menunggu arahan atau persetujuan pimpinan.",
        href: "/surat?metric=inbox",
        badge: `${pendingInbox.length} tugas`,
      },
      {
        id: "ops-lead-priority",
        title: "Surat Prioritas Pimpinan",
        description: "Surat penting yang membutuhkan telaah cepat dari pimpinan.",
        href: "/surat?query=prioritas",
        badge: `${accessibleLetters.filter((letter) => letter.tags.some((tag) => tag.toLowerCase().includes("prioritas"))).length} prioritas`,
      },
      {
        id: "ops-lead-complete",
        title: "Tindak Lanjut Selesai",
        description: "Rekap pekerjaan yang sudah ditutup untuk monitoring progres.",
        href: "/surat?metric=completed",
        badge: `${completedLetters.length} selesai`,
      },
    ];
  }

  return [
    {
      id: "ops-user-new",
      title: "Surat Masuk Baru",
      description: "Fokus pada surat baru yang perlu segera dibaca dan diproses.",
      href: "/surat?type=masuk&status=Baru",
      badge: `${accessibleLetters.filter((letter) => letter.type === "masuk" && letter.status === "Baru").length} baru`,
    },
    {
      id: "ops-user-inbox",
      title: "Tugas Aktif Saya",
      description: "Masuk langsung ke daftar surat yang masih membutuhkan tindak lanjut.",
      href: "/surat?metric=inbox",
      badge: `${pendingInbox.length} aktif`,
    },
    {
      id: "ops-user-archive",
      title: "Arsip Selesai",
      description: "Meninjau pekerjaan yang sudah tuntas sebagai referensi kerja.",
      href: "/surat?metric=completed",
      badge: `${completedLetters.length} arsip`,
    },
  ];
}

export function findModuleByRoute(route: string): ModuleConfig | null {
  return (
    [...modules]
      .sort((left, right) => right.href.length - left.href.length)
      .find((module) => route.startsWith(module.href.split("/:")[0])) ?? null
  );
}
