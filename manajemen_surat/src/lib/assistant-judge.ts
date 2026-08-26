import type { AssistantJudgeConfig, AssistantJudgeLinkConfig, AssistantJudgeProviderId, RoleId, UserPersona } from "@/lib/types";

export const ASSISTANT_JUDGE_DEFAULT_VISIBLE_ROLES: RoleId[] = [
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "hakim",
];

export const ASSISTANT_JUDGE_ROLE_OPTIONS: Array<{
  roleId: RoleId;
  label: string;
  description: string;
}> = [
  { roleId: "super-admin", label: "Super Admin", description: "Selalu dapat melihat dan mengatur Asisten Hakim." },
  { roleId: "admin", label: "Admin", description: "Dapat melihat aplikasi jika diizinkan, tetapi tidak mengedit pengaturan." },
  { roleId: "ketua", label: "Ketua", description: "Akses pimpinan untuk dukungan kerja yudisial." },
  { roleId: "wakil-ketua", label: "Wakil Ketua", description: "Akses pimpinan untuk dukungan kerja yudisial." },
  { roleId: "hakim", label: "Hakim", description: "Akses utama untuk asisten AI yudisial." },
  { roleId: "panitera", label: "Panitera", description: "Tidak aktif secara default." },
  { roleId: "panitera-muda", label: "Panitera Muda", description: "Tidak aktif secara default." },
  { roleId: "panitera-pengganti", label: "Panitera Pengganti", description: "Tidak aktif secara default." },
  { roleId: "sekretaris", label: "Sekretaris", description: "Tidak aktif secara default." },
  { roleId: "kasubag", label: "Kasubag", description: "Tidak aktif secara default." },
  { roleId: "jurusita", label: "Jurusita", description: "Tidak aktif secara default." },
  { roleId: "pranata-komputer", label: "Pranata Komputer", description: "Tidak aktif secara default." },
  { roleId: "analis-keuangan", label: "Analis Keuangan", description: "Tidak aktif secara default." },
  { roleId: "analis-perkara", label: "Analis Perkara", description: "Tidak aktif secara default." },
  { roleId: "pelaksana", label: "Pelaksana", description: "Tidak aktif secara default." },
  { roleId: "pppk", label: "PPPK", description: "Tidak aktif secara default; dapat dibuka jika diberi penugasan yudisial pendukung." },
  { roleId: "pejabat-struktural", label: "Pejabat Struktural", description: "Mewakili role struktural yang ada di sistem." },
  { roleId: "staf", label: "Pegawai/Staf", description: "Mewakili pegawai operasional umum di sistem." },
];

export const ASSISTANT_JUDGE_KNOWN_ROLE_IDS = ASSISTANT_JUDGE_ROLE_OPTIONS.map((role) => role.roleId);

export const ASSISTANT_JUDGE_PROVIDER_ORDER: AssistantJudgeProviderId[] = ["chatgpt", "gemini", "claude"];

const defaultLinkAccess = {
  allowedRoles: ASSISTANT_JUDGE_DEFAULT_VISIBLE_ROLES,
  allowedUserIds: [] as string[],
  embeddedEnabled: true,
  openInNewTab: true,
};

export const DEFAULT_ASSISTANT_JUDGE_CONFIG: AssistantJudgeConfig = {
  enabled: true,
  visibleRoles: ASSISTANT_JUDGE_DEFAULT_VISIBLE_ROLES,
  links: {
    chatgpt: {
      id: "chatgpt",
      provider: "chatgpt",
      iconKey: "sparkles",
      sortOrder: 10,
      enabled: true,
      label: "ChatGPT - ALETA AI GPTs",
      url: "https://chatgpt.com/g/g-69489d7fc1ec819188ca25e141ce6735-aleta-ai-gpts-beta-v-1",
      description: "Asisten berbasis GPT untuk analisis, penyusunan pertimbangan, simulasi, dan drafting hukum.",
      ...defaultLinkAccess,
    },
    gemini: {
      id: "gemini",
      provider: "gemini",
      iconKey: "sparkles",
      sortOrder: 20,
      enabled: true,
      label: "Gemini - ALETA Gem",
      url: "https://gemini.google.com/gems/edit/49157741722f",
      description: "Asisten berbasis Gemini untuk membantu analisis, brainstorming, dan dukungan penyusunan dokumen.",
      ...defaultLinkAccess,
    },
    claude: {
      id: "claude",
      provider: "claude",
      iconKey: "scale",
      sortOrder: 30,
      enabled: true,
      label: "Claude - ALETA Project",
      url: "https://claude.ai/project/019d998c-d8d7-70fa-90f8-cfa2014cfcc0",
      description: "Asisten berbasis Claude untuk analisis panjang, evaluasi, dan penyusunan dokumen kompleks.",
      ...defaultLinkAccess,
    },
  },
};

export function createAssistantJudgeLinkId(label: string, existingIds: string[] = []) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "ai-link";
  const used = new Set(existingIds);
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function normalizeRoleList(value: unknown, fallback: RoleId[]) {
  const allowed = new Set<RoleId>(ASSISTANT_JUDGE_KNOWN_ROLE_IDS);
  const source = Array.isArray(value) ? value : fallback;
  const roles = source.filter((role): role is RoleId => allowed.has(role as RoleId));
  const next = new Set<RoleId>(roles);
  next.add("super-admin");
  return Array.from(next);
}

function normalizeUserIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeLinkConfig(
  linkId: string,
  input: Partial<AssistantJudgeLinkConfig> | undefined,
  fallback: AssistantJudgeLinkConfig | undefined,
  index: number
): AssistantJudgeLinkConfig {
  const fallbackAllowedRoles = fallback?.allowedRoles ?? ASSISTANT_JUDGE_DEFAULT_VISIBLE_ROLES;
  return {
    id: String(input?.id ?? fallback?.id ?? linkId).trim() || linkId,
    provider: String(input?.provider ?? fallback?.provider ?? linkId).trim() || linkId,
    enabled: input?.enabled ?? fallback?.enabled ?? false,
    label: String(input?.label ?? fallback?.label ?? "Asisten AI").trim(),
    url: String(input?.url ?? fallback?.url ?? "").trim(),
    description: String(input?.description ?? fallback?.description ?? "Asisten AI tambahan.").trim(),
    iconKey: String(input?.iconKey ?? fallback?.iconKey ?? "sparkles").trim() || "sparkles",
    sortOrder: Number.isFinite(Number(input?.sortOrder ?? fallback?.sortOrder))
      ? Number(input?.sortOrder ?? fallback?.sortOrder)
      : (index + 1) * 10,
    allowedRoles: normalizeRoleList(input?.allowedRoles, fallbackAllowedRoles),
    allowedUserIds: normalizeUserIdList(input?.allowedUserIds ?? fallback?.allowedUserIds),
    embeddedEnabled: input?.embeddedEnabled ?? fallback?.embeddedEnabled ?? true,
    openInNewTab: input?.openInNewTab ?? fallback?.openInNewTab ?? true,
    createdAt: input?.createdAt ?? fallback?.createdAt,
    updatedAt: input?.updatedAt ?? fallback?.updatedAt,
    createdBy: input?.createdBy ?? fallback?.createdBy,
    updatedBy: input?.updatedBy ?? fallback?.updatedBy,
  };
}

export function getAssistantJudgeOrderedLinks(config: AssistantJudgeConfig) {
  return Object.entries(config.links)
    .map(([id, link], index) => normalizeLinkConfig(id, link, DEFAULT_ASSISTANT_JUDGE_CONFIG.links[id], index))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.label.localeCompare(right.label));
}

export function getAssistantJudgeLinkIdentifier(link: AssistantJudgeLinkConfig) {
  return String(link.id ?? link.provider ?? link.label).trim();
}

export function getAssistantJudgeViewPath(link: AssistantJudgeLinkConfig) {
  return `/asisten-hakim/view/${encodeURIComponent(getAssistantJudgeLinkIdentifier(link))}`;
}

export function isAssistantJudgeEmbeddedEnabled(link: AssistantJudgeLinkConfig) {
  return link.embeddedEnabled !== false;
}

export function getAssistantJudgeOpenHref(link: AssistantJudgeLinkConfig) {
  return isAssistantJudgeEmbeddedEnabled(link) ? getAssistantJudgeViewPath(link) : link.url;
}

export function findAssistantJudgeLinkByIdentifier(config: AssistantJudgeConfig, identifier: string) {
  const normalizedIdentifier = String(identifier ?? "").trim();
  if (!normalizedIdentifier) return null;

  return (
    getAssistantJudgeOrderedLinks(config).find((link) =>
      [link.id, link.provider, link.label]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .includes(normalizedIdentifier)
    ) ?? null
  );
}

export function normalizeAssistantJudgeConfig(input?: Partial<AssistantJudgeConfig> | null): AssistantJudgeConfig {
  const visibleRoles = normalizeRoleList(input?.visibleRoles, DEFAULT_ASSISTANT_JUDGE_CONFIG.visibleRoles);
  const rawLinks = input?.links ?? DEFAULT_ASSISTANT_JUDGE_CONFIG.links;
  const mergedLinkEntries = new Map<string, Partial<AssistantJudgeLinkConfig>>();

  for (const providerId of ASSISTANT_JUDGE_PROVIDER_ORDER) {
    mergedLinkEntries.set(providerId, {
      ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links[providerId],
      ...(rawLinks as Record<string, Partial<AssistantJudgeLinkConfig> | undefined>)[providerId],
    });
  }

  for (const [linkId, link] of Object.entries(rawLinks as Record<string, Partial<AssistantJudgeLinkConfig>>)) {
    if (!linkId.trim()) continue;
    if (!mergedLinkEntries.has(linkId)) {
      mergedLinkEntries.set(linkId, link);
    }
  }

  const links: Record<string, AssistantJudgeLinkConfig> = {};
  Array.from(mergedLinkEntries.entries())
    .map(([linkId, link], index) => [linkId, normalizeLinkConfig(linkId, link, DEFAULT_ASSISTANT_JUDGE_CONFIG.links[linkId], index)] as const)
    .sort((left, right) => (left[1].sortOrder ?? 0) - (right[1].sortOrder ?? 0) || left[1].label.localeCompare(right[1].label))
    .forEach(([linkId, link]) => {
      links[link.id ?? linkId] = link;
    });

  return {
    enabled: input?.enabled ?? DEFAULT_ASSISTANT_JUDGE_CONFIG.enabled,
    visibleRoles,
    links,
    updatedAt: input?.updatedAt,
  };
}

export function canAccessAssistantJudgeLink(
  link: AssistantJudgeLinkConfig,
  roleId: RoleId | null | undefined,
  userId?: string | null
) {
  if (!link.enabled) return false;
  if (userId && link.allowedUserIds?.includes(userId)) return true;
  return Boolean(roleId && link.allowedRoles?.includes(roleId));
}

export function getVisibleAssistantJudgeLinks(
  config: AssistantJudgeConfig,
  roleId: RoleId | null | undefined,
  userId?: string | null
) {
  if (!config.enabled) return [];
  return getAssistantJudgeOrderedLinks(config).filter(
    (link) => canAccessAssistantJudgeLink(link, roleId, userId) && validateAssistantJudgeUrl(link.url).ok
  );
}

export function filterAssistantJudgeConfigForUser(config: AssistantJudgeConfig, user: Pick<UserPersona, "id" | "roleId">) {
  const normalized = normalizeAssistantJudgeConfig(config);
  const links = Object.fromEntries(
    getVisibleAssistantJudgeLinks(normalized, user.roleId, user.id).map((link) => [link.id ?? link.provider ?? link.label, link])
  );

  return {
    ...normalized,
    links,
  };
}

export function canAccessAssistantJudge(
  roleId: RoleId | null | undefined,
  config: AssistantJudgeConfig,
  userId?: string | null
) {
  if (!roleId || !config.enabled) return false;
  if (config.visibleRoles.includes(roleId)) return true;
  return getVisibleAssistantJudgeLinks(config, roleId, userId).length > 0;
}

export function validateAssistantJudgeUrl(url: string) {
  const value = url.trim();

  if (!value) {
    return { ok: false, message: "URL wajib diisi jika menu aktif.", warning: null };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, message: "URL harus memakai http:// atau https://.", warning: null };
    }

    const allowedHosts = ["chatgpt.com", "gemini.google.com", "claude.ai"];
    const isKnownHost = allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));

    return {
      ok: true,
      message: null,
      warning: isKnownHost ? null : "Domain URL di luar ChatGPT, Gemini, atau Claude. Pastikan link ini benar.",
    };
  } catch {
    return { ok: false, message: "Format URL tidak valid.", warning: null };
  }
}
