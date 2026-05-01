import type { AssistantJudgeConfig, AssistantJudgeProviderId, RoleId } from "@/lib/types";

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
  { roleId: "sekretaris", label: "Sekretaris", description: "Tidak aktif secara default." },
  { roleId: "pejabat-struktural", label: "Pejabat Struktural", description: "Mewakili role struktural yang ada di sistem." },
  { roleId: "staf", label: "Pegawai/Staf", description: "Mewakili pegawai operasional umum di sistem." },
];

export const ASSISTANT_JUDGE_PROVIDER_ORDER: AssistantJudgeProviderId[] = ["chatgpt", "gemini", "claude"];

export const DEFAULT_ASSISTANT_JUDGE_CONFIG: AssistantJudgeConfig = {
  enabled: true,
  visibleRoles: ASSISTANT_JUDGE_DEFAULT_VISIBLE_ROLES,
  links: {
    chatgpt: {
      enabled: true,
      label: "ChatGPT - ALETA AI GPTs",
      url: "https://chatgpt.com/g/g-69489d7fc1ec819188ca25e141ce6735-aleta-ai-gpts-beta-v-1",
      description: "Asisten berbasis GPT untuk analisis, penyusunan pertimbangan, simulasi, dan drafting hukum.",
    },
    gemini: {
      enabled: true,
      label: "Gemini - ALETA Gem",
      url: "https://gemini.google.com/gem/1F12iv0QalywN2nwJ2dWzBlKUUEWsZZxn?usp=sharing",
      description: "Asisten berbasis Gemini untuk membantu analisis, brainstorming, dan dukungan penyusunan dokumen.",
    },
    claude: {
      enabled: true,
      label: "Claude - ALETA Project",
      url: "https://claude.ai/project/019d998c-d8d7-70fa-90f8-cfa2014cfcc0",
      description: "Asisten berbasis Claude untuk analisis panjang, evaluasi, dan penyusunan dokumen kompleks.",
    },
  },
};

export function normalizeAssistantJudgeConfig(input?: Partial<AssistantJudgeConfig> | null): AssistantJudgeConfig {
  const visibleRoles = new Set<RoleId>([
    "super-admin",
    ...((input?.visibleRoles ?? DEFAULT_ASSISTANT_JUDGE_CONFIG.visibleRoles).filter(Boolean) as RoleId[]),
  ]);

  return {
    enabled: input?.enabled ?? DEFAULT_ASSISTANT_JUDGE_CONFIG.enabled,
    visibleRoles: Array.from(visibleRoles),
    links: {
      chatgpt: { ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links.chatgpt, ...(input?.links?.chatgpt ?? {}) },
      gemini: { ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links.gemini, ...(input?.links?.gemini ?? {}) },
      claude: { ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links.claude, ...(input?.links?.claude ?? {}) },
    },
    updatedAt: input?.updatedAt,
  };
}

export function canAccessAssistantJudge(roleId: RoleId | null | undefined, config: AssistantJudgeConfig) {
  if (!roleId || !config.enabled) return false;
  return config.visibleRoles.includes(roleId);
}

export function validateAssistantJudgeUrl(url: string) {
  const value = url.trim();

  if (!value) {
    return { ok: false, message: "URL wajib diisi jika provider aktif.", warning: null };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      return { ok: false, message: "URL harus memakai https://.", warning: null };
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
