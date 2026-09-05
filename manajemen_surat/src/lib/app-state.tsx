"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { authClient } from "@/lib/auth-client";
import { mergeAIFeatureFlags, type PartialAIFeatureFlags } from "@/lib/ai-feature-flags";
import { apiPath } from "@/lib/base-path";
import {
  DEFAULT_ASSISTANT_JUDGE_CONFIG,
  canAccessAssistantJudge,
  normalizeAssistantJudgeConfig,
} from "@/lib/assistant-judge";
import { DEFAULT_PANEL_SETTINGS, normalizePanelSettings } from "@/lib/panel-settings";
import { validateActingAssignmentRequest } from "@/core/organization/service";
import {
  getDefaultRoleForPosition,
  getAccessibleLetters,
  getAccessibleModules,
  getAccessiblePortalApps,
  getDashboardMetrics,
  getDisposition,
  getEffectivePositionId,
  getEffectiveRoleId,
  getLeadershipRecipients,
  getLetter,
  getLetterDispositions,
  getOperationalSummary,
  getPendingInbox,
  getPositionUsers,
  getUser,
  searchPortal,
} from "@/lib/permissions";
import {
  type ActingAssignment,
  type AIFeatureFlags,
  type AIGlobalConfig,
  type AssistantJudgeConfig,
  type DashboardMetric,
  type DispositionNode,
  type ExternalAppCredentialInput,
  type InstitutionIdentity,
  type LetterDetail,
  type ModuleConfig,
  type ModuleId,
  type ModuleVisibility,
  type OperationalSummaryItem,
  type PanelSettings,
  type PortalAppConfig,
  type PortalStateData,
  type Position,
  type Role,
  type RoleId,
  type SearchResult,
  type ThemeMode,
  type UserPersona,
  type WhatsAppWebConfig,
} from "@/lib/types";
import {
  buildTaskSources,
  finalizeTaskSource,
  summarizeTaskSources,
  type TaskItem,
  type TaskSourcesPayload,
} from "@/lib/task-sources";

const STORAGE_KEY = "portal-terpadu-pa-v2";
const SEEN_DISPOSITION_STORAGE_PREFIX = "aleta:seen-dispositions";

function getSeenDispositionStorageKey(userId: string | null | undefined) {
  return `${SEEN_DISPOSITION_STORAGE_PREFIX}:${userId ?? "anonymous"}`;
}

function readSeenDispositionIds(userId: string | null | undefined) {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(getSeenDispositionStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSeenDispositionIds(userId: string | null | undefined, ids: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getSeenDispositionStorageKey(userId), JSON.stringify(ids));
  } catch {
    // localStorage can be unavailable in private/restricted contexts; keep in-memory state working.
  }
}

type NotificationReadResponse = {
  items?: Array<{
    entityType?: string;
    entityId?: string;
    seenAt?: string;
  }>;
};

type MarkSeenItemInput = Pick<TaskItem, "entityType" | "entityId">;

type CreateDispositionInput = {
  suratId: string;
  parentDispositionId: string | null;
  penerimaId: string;
  targetPositionId: string;
  instruksi: string;
  allowDownload: boolean;
  urgent: boolean;
  bypass: boolean;
  deadlineAt?: string | null;
  routingType?: DispositionNode["routingType"];
};

type CompleteDispositionInput = {
  dispositionId: string;
  note: string;
  fileName: string;
};

type ForwardToLeadershipInput = {
  suratId: string;
};

type UpdateProfileInput = {
  email: string;
  password?: string;
  whatsappNumber?: string;
  profilePhotoUrl?: string;
};

type UpdateManagedUserInput = {
  username: string;
  password?: string;
  email: string;
  whatsappNumber: string;
  name: string;
  nip: string;
  positionId: string;
  additionalRoleIds?: string[];
  isActive?: boolean;
  profilePhotoUrl?: string;
  /** null = role otomatis dari jabatan; RoleId = override eksplisit seperti admin/super-admin/pppk. */
  roleOverride?: RoleId | null;
  externalCredentials?: ExternalAppCredentialInput[];
};

type RetryWhatsappInput =
  | {
      scope: "letter";
      entityId: string;
      deliveryId: string;
    }
  | {
      scope: "disposition";
      entityId: string;
      deliveryId: string;
    };

type ResetUserPasswordInput = {
  userId: string;
  password: string;
};

type CreateManagedUserInput = {
  username: string;
  password: string;
  email: string;
  whatsappNumber: string;
  name: string;
  nip: string;
  positionId: string;
  additionalRoleIds?: string[];
  isActive?: boolean;
  profilePhotoUrl?: string;
  /** null = role otomatis dari jabatan; RoleId = override eksplisit seperti admin/super-admin/pppk. */
  roleOverride?: RoleId | null;
  externalCredentials?: ExternalAppCredentialInput[];
};

type AssignActingAssignmentInput = {
  supervisorUserId: string;
  assigneeUserId: string;
  type: ActingAssignment["type"];
  startDate?: string;
  endDate?: string | null;
  reason?: string | null;
};

type CreateLetterInput = {
  type: LetterDetail["type"];
  nomorUrut: string;
  nomorSurat: string;
  tanggal: string;
  tanggalAdministratif: string;
  pengirim: string;
  perihal: string;
  assignedUnit: string;
  confidentiality: LetterDetail["confidentiality"];
  kodeKlasifikasi: string;
  klasifikasiTags: string[];
  ringkasan: string;
  asalSurat: string;
  tujuanSurat: string;
  klasifikasi: string;
  lampiran: string[];
  tags: string[];
  viewerMode: LetterDetail["viewerMode"];
  targetPositionId: string;
  targetUserId: string;
  documentFileName?: string;
  documentSizeMb?: number;
  documentTextExtract?: string;
  documentFile?: File;
  aiGenerated?: boolean;
};

type BackendUserRecord = Omit<UserPersona, "password"> & {
  password?: string;
};

type MutationResult = {
  ok: boolean;
  message: string;
};

type LetterWorkflowAction = "submit" | "approve" | "reject" | "mark-sent" | "return-draft";

type AIConfigStatePatch = Omit<Partial<AIGlobalConfig>, "featureFlags"> & {
  featureFlags?: PartialAIFeatureFlags;
};

type UpdateAIConfigInput = Omit<AIConfigStatePatch, "moduleConfigs"> & {
  featureFlags?: PartialAIFeatureFlags;
  moduleConfigs?: Array<{
    moduleKey: string;
    enabled?: boolean;
    inheritGlobal?: boolean;
    activeConnectionId?: string | null;
  }>;
  connection?: {
    id?: string;
    providerId: string;
    label?: string;
    modelId: string;
    apiKey?: string;
    endpointUrl?: string;
    builtin?: boolean;
    connectionStatus?: "idle" | "connected" | "failed";
    lastTestedAt?: string;
    lastConnectionMessage?: string;
  };
  deleteConnectionId?: string;
};

type PortalAction =
  | { type: "hydrate"; payload: PortalStateData }
  | { type: "sync-roles"; payload: Role[] }
  | { type: "sync-users"; payload: UserPersona[] }
  | { type: "sync-positions"; payload: Position[] }
  | { type: "sync-letters"; payload: LetterDetail[] }
  | { type: "sync-dispositions"; payload: DispositionNode[] }
  | { type: "set-module-visibility"; payload: ModuleVisibility[] }
  | { type: "upsert-user"; payload: UserPersona }
  | { type: "upsert-letter"; payload: LetterDetail }
  | { type: "upsert-disposition"; payload: DispositionNode }
  | { type: "sign-in"; userId: string }
  | { type: "sign-out" }
  | { type: "set-theme"; theme: ThemeMode }
  | { type: "set-ai-config"; payload: AIConfigStatePatch }
  | { type: "set-whatsapp-web"; payload: Partial<WhatsAppWebConfig> }
  | { type: "set-institution-identity"; payload: Partial<InstitutionIdentity> }
  | { type: "set-panel-settings"; payload: PanelSettings }
  | { type: "set-assistant-judge-config"; payload: AssistantJudgeConfig }
  | { type: "update-profile"; userId: string; payload: UpdateProfileInput }
  | { type: "update-managed-user"; userId: string; payload: UpdateManagedUserInput }
  | { type: "create-managed-user"; payload: CreateManagedUserInput }
  | { type: "assign-acting-assignment"; currentUserId: string; payload: AssignActingAssignmentInput }
  | { type: "clear-acting-assignment"; userId: string }
  | { type: "reset-user-password"; payload: ResetUserPasswordInput }
  | { type: "delete-letter"; currentUserId: string; currentRoleId: UserPersona["roleId"]; letterId: string }
  | { type: "toggle-module"; roleId: UserPersona["roleId"]; moduleId: ModuleId; enabled: boolean }
  | { type: "create-letter"; currentUserId: string; payload: CreateLetterInput }
  | { type: "create-disposition"; currentUserId: string; payload: CreateDispositionInput }
  | { type: "forward-to-leadership"; currentUserId: string; payload: ForwardToLeadershipInput }
  | { type: "start-disposition"; dispositionId: string }
  | { type: "complete-disposition"; payload: CompleteDispositionInput }
  | { type: "retry-whatsapp"; payload: RetryWhatsappInput };

type PortalContextValue = {
  isHydrated: boolean;
  isAuthPending: boolean;
  isSyncing: boolean;
  syncError: string | null;
  currentUserId: string | null;
  currentUser: UserPersona | null;
  roles: Role[];
  /** Seluruh pengguna, termasuk yang diblokir. Hanya untuk Manajemen Akun. */
  users: UserPersona[];
  /**
   * Pengguna yang masih aktif saja.
   *
   * Dipakai di Manajemen Surat dan modul lain: akun yang diblokir tidak boleh
   * lagi muncul nama maupun jabatannya, apalagi bisa dipilih sebagai tujuan
   * disposisi. Server juga menolak tujuan nonaktif, jadi ini menutup celahnya
   * di layar sekaligus - bukan hanya kosmetik.
   */
  activeUsers: UserPersona[];
  positions: Position[];
  letters: LetterDetail[];
  dispositions: DispositionNode[];
  accessiblePortalApps: PortalAppConfig[];
  accessibleModules: ModuleConfig[];
  accessibleLetters: LetterDetail[];
  pendingInbox: DispositionNode[];
  seenPendingDispositionIds: string[];
  taskSources: TaskSourcesPayload["sources"];
  taskSummary: TaskSourcesPayload["summary"];
  inboxNotificationCount: number;
  globalTaskCount: number;
  metrics: DashboardMetric[];
  operationalSummary: OperationalSummaryItem[];
  moduleVisibility: ModuleVisibility[];
  theme: ThemeMode;
  aiConfig: AIGlobalConfig;
  whatsAppWeb: WhatsAppWebConfig;
  institutionIdentity: InstitutionIdentity;
  panelSettings: PanelSettings;
  assistantJudgeConfig: AssistantJudgeConfig;
  signIn: (userId: string) => void;
  signOut: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setAIConfig: (payload: UpdateAIConfigInput) => Promise<MutationResult>;
  refreshAIConfig: () => Promise<void>;
  updateWhatsAppWeb: (payload: Partial<WhatsAppWebConfig>) => Promise<MutationResult>;
  updateInstitutionIdentity: (payload: Partial<InstitutionIdentity>) => Promise<MutationResult>;
  updatePanelSettings: (payload: Partial<PanelSettings>) => Promise<MutationResult>;
  updateAssistantJudgeConfig: (payload: AssistantJudgeConfig) => Promise<MutationResult>;
  updateProfile: (payload: UpdateProfileInput) => Promise<MutationResult>;
  updateManagedUser: (userId: string, payload: UpdateManagedUserInput) => Promise<MutationResult>;
  createManagedUser: (payload: CreateManagedUserInput) => Promise<MutationResult>;
  assignActingAssignment: (payload: AssignActingAssignmentInput) => Promise<MutationResult>;
  clearActingAssignment: (userId: string) => Promise<MutationResult>;
  resetUserPassword: (payload: ResetUserPasswordInput) => Promise<MutationResult>;
  deleteLetter: (letterId: string) => Promise<"soft" | "hard" | null>;
  softDeleteLetter: (letterId: string) => Promise<"soft" | null>;
  toggleModuleVisibility: (roleId: UserPersona["roleId"], moduleId: ModuleId, enabled: boolean) => void;
  createLetter: (payload: CreateLetterInput) => Promise<MutationResult>;
  updateLetter: (letterId: string, payload: Partial<CreateLetterInput>) => Promise<MutationResult>;
  transitionLetterWorkflow: (
    letterId: string,
    payload: { action: LetterWorkflowAction; rejectionNote?: string | null }
  ) => Promise<MutationResult>;
  createDisposition: (payload: CreateDispositionInput) => void;
  forwardToLeadership: (payload: ForwardToLeadershipInput) => void;
  markDispositionRead: (dispositionId: string) => Promise<MutationResult>;
  startDisposition: (dispositionId: string) => Promise<MutationResult>;
  completeDisposition: (payload: CompleteDispositionInput) => void;
  retryWhatsappDelivery: (payload: RetryWhatsappInput) => Promise<MutationResult>;
  getLetterById: (letterId: string) => LetterDetail | null;
  getDispositionById: (dispositionId: string) => DispositionNode | null;
  getLetterDispositionsById: (letterId: string) => DispositionNode[];
  getSearchResults: (query: string) => SearchResult[];
  getUsersByPosition: (positionId: string) => UserPersona[];
  markTaskItemsSeen: (items: MarkSeenItemInput[]) => void;
  markPendingInboxSeen: (dispositionIds?: string[]) => void;
};

const EMPTY_AI_FEATURE_FLAGS: AIFeatureFlags = {
  oneStopDisposition: {
    enabled: false,
    recommendation: false,
    priorityDetection: false,
    targetSuggestion: false,
    instructionSuggestion: false,
    autofill: false,
    rationale: false,
    diagnostics: false,
  },
  mailIntelligence: {
    enabled: false,
    summary: false,
    findings: false,
    recommendedActions: false,
    relatedRegulations: false,
    riskNotes: false,
    diagnostics: false,
  },
  draftMetadata: {
    enabled: false,
    nomorSurat: false,
    tanggalSurat: false,
    tanggalTerima: false,
    asalSurat: false,
    perihal: false,
    kodeKlasifikasi: false,
    klasifikasiSurat: false,
    tagSurat: false,
    tagAsalSurat: false,
    ocrCheck: false,
    aiReviewNote: false,
  },
  institutionIdentity: {
    enabled: false,
    courtNameSuggestion: false,
    identityEnrichment: false,
    googleDiscovery: false,
    officialWebsiteExtraction: false,
    aiNormalization: false,
    diagnostics: false,
  },
};

const EMPTY_AI_CONFIG: AIGlobalConfig = {
  enabled: false,
  modelId: "",
  primaryLanguage: "id",
  providerId: "",
  activeConnectionId: null,
  providers: [],
  moduleConfigs: [],
  featureFlags: EMPTY_AI_FEATURE_FLAGS,
  featureDispositionAi: false,
  featureMailIntelligence: false,
  featureDraftMetadata: false,
  featureManajemenSuratAi: false,
  featureDisposisiAi: false,
};

const EMPTY_WHATSAPP_WEB: WhatsAppWebConfig = {
  phoneNumber: "",
  sessionName: "",
  status: "inactive",
};

const EMPTY_INSTITUTION_IDENTITY: InstitutionIdentity = {
  courtName: "",
  courtShortName: "",
  address: "",
  phoneNumber: "",
  mobilePhone: "",
  csWhatsappNumber: "",
  botWhatsappNumber: "",
  email: "",
  instagram: "",
  facebook: "",
  youtube: "",
  website: "",
  mapUrl: "",
  logoUrl: "",
};

const defaultState: PortalStateData = {
  currentUserId: null,
  roles: [],
  users: [],
  positions: [],
  letters: [],
  dispositions: [],
  moduleVisibility: [],
  theme: "dark",
  aiConfig: EMPTY_AI_CONFIG,
  whatsAppWeb: EMPTY_WHATSAPP_WEB,
  institutionIdentity: EMPTY_INSTITUTION_IDENTITY,
  panelSettings: DEFAULT_PANEL_SETTINGS,
  assistantJudgeConfig: DEFAULT_ASSISTANT_JUDGE_CONFIG,
};

const PortalContext = createContext<PortalContextValue | null>(null);

function mergeById<T extends { id: string }>(base: T[], incoming?: T[]) {
  if (!incoming || incoming.length === 0) return base;

  const merged = new Map(base.map((item) => [item.id, item]));

  for (const item of incoming) {
    merged.set(item.id, { ...merged.get(item.id), ...item });
  }

  return Array.from(merged.values());
}

function sortUsersByName(userSource: UserPersona[]) {
  return [...userSource].sort((left, right) => left.name.localeCompare(right.name));
}

function buildCachedUser(
  incoming: BackendUserRecord,
  cacheSource: UserPersona[],
  passwordOverride?: string
): UserPersona {
  const cached = cacheSource.find((user) => user.id === incoming.id);

  return {
    id: incoming.id,
    username: incoming.username,
    password: passwordOverride ?? incoming.password ?? cached?.password ?? "",
    name: incoming.name,
    nip: incoming.nip,
    email: incoming.email,
    whatsappNumber: incoming.whatsappNumber,
    profilePhotoUrl: incoming.profilePhotoUrl ?? cached?.profilePhotoUrl,
    roleId: incoming.roleId,
    positionId: incoming.positionId,
    additionalRoleIds: incoming.additionalRoleIds ?? cached?.additionalRoleIds ?? [],
    isActive: incoming.isActive,
    canBypassHierarchy: incoming.canBypassHierarchy ?? cached?.canBypassHierarchy ?? false,
    actingAssignment: incoming.actingAssignment ?? cached?.actingAssignment ?? null,
    externalCredentials: incoming.externalCredentials ?? cached?.externalCredentials ?? [],
  };
}

function syncCachedUsers(cacheSource: UserPersona[], incoming: BackendUserRecord[]) {
  return sortUsersByName(incoming.map((user) => buildCachedUser(user, cacheSource)));
}

function buildDispositionId(nextIndex: number) {
  return `dsp-${String(nextIndex).padStart(3, "0")}`;
}

function buildLetterId(nextIndex: number) {
  return `srt-${String(nextIndex).padStart(3, "0")}`;
}

function buildUserId(nextIndex: number) {
  return `usr-${String(nextIndex).padStart(3, "0")}`;
}

function markDeliveryAsRetried<T extends { id: string; whatsappDeliveries?: { id: string; status: string; lastAttemptAt: string }[] }>(
  source: T[],
  entityId: string,
  deliveryId: string
) {
  return source.map((item) =>
    item.id === entityId
      ? {
          ...item,
          whatsappDeliveries: (item.whatsappDeliveries ?? []).map((delivery) =>
            delivery.id === deliveryId
              ? {
                  ...delivery,
                  status: "Terkirim" as const,
                  lastAttemptAt: new Date().toISOString(),
                }
              : delivery
          ),
        }
      : item
  );
}

function portalReducer(state: PortalStateData, action: PortalAction): PortalStateData {
  switch (action.type) {
    case "hydrate":
      return {
        ...defaultState,
        ...action.payload,
        roles: action.payload.roles ?? [],
        positions: action.payload.positions ?? [],
      };
    case "sync-roles":
      return {
        ...state,
        roles: action.payload,
      };
    case "sync-users":
      return {
        ...state,
        users: sortUsersByName(action.payload),
      };
    case "sync-positions":
      return {
        ...state,
        positions: action.payload,
      };
    case "sync-letters":
      return {
        ...state,
        letters: action.payload,
      };
    case "sync-dispositions":
      return {
        ...state,
        dispositions: action.payload,
      };
    case "set-module-visibility":
      return {
        ...state,
        moduleVisibility: action.payload,
      };
    case "upsert-user": {
      const nextUsers = state.users.some((user) => user.id === action.payload.id)
        ? state.users.map((user) => (user.id === action.payload.id ? action.payload : user))
        : state.users.concat(action.payload);

      return {
        ...state,
        users: sortUsersByName(nextUsers),
      };
    }
    case "upsert-letter": {
      const nextLetters = state.letters.some((item) => item.id === action.payload.id)
        ? state.letters.map((item) => (item.id === action.payload.id ? action.payload : item))
        : state.letters.concat(action.payload);

      return {
        ...state,
        letters: nextLetters,
      };
    }
    case "upsert-disposition": {
      const nextDispositions = state.dispositions.some((item) => item.id === action.payload.id)
        ? state.dispositions.map((item) => (item.id === action.payload.id ? action.payload : item))
        : state.dispositions.concat(action.payload);

      return {
        ...state,
        dispositions: nextDispositions,
      };
    }
    case "sign-in":
      return { ...state, currentUserId: action.userId };
    case "sign-out":
      return { ...state, currentUserId: null };
    case "set-theme":
      return { ...state, theme: action.theme };
    case "set-ai-config":
      return {
        ...state,
        aiConfig: {
          ...state.aiConfig,
          ...action.payload,
          featureFlags: mergeAIFeatureFlags(state.aiConfig.featureFlags, action.payload.featureFlags),
        },
      };
    case "set-whatsapp-web":
      return { ...state, whatsAppWeb: { ...state.whatsAppWeb, ...action.payload } };
    case "set-institution-identity":
      return {
        ...state,
        institutionIdentity: { ...state.institutionIdentity, ...action.payload },
      };
    case "set-panel-settings":
      return { ...state, panelSettings: normalizePanelSettings(action.payload) };
    case "set-assistant-judge-config":
      return { ...state, assistantJudgeConfig: normalizeAssistantJudgeConfig(action.payload) };
    case "update-profile":
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.userId
            ? {
                ...user,
                email: action.payload.email,
                password: action.payload.password?.trim() ? action.payload.password : user.password,
                whatsappNumber: action.payload.whatsappNumber ?? user.whatsappNumber,
                profilePhotoUrl: action.payload.profilePhotoUrl,
              }
            : user
        ),
      };
    case "update-managed-user":
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.userId
            ? {
                ...user,
                username: action.payload.username,
                password: action.payload.password?.trim() ? action.payload.password : user.password,
                email: action.payload.email,
                whatsappNumber: action.payload.whatsappNumber,
                name: action.payload.name,
                nip: action.payload.nip,
                roleId: getDefaultRoleForPosition(action.payload.positionId),
                positionId: action.payload.positionId,
                profilePhotoUrl: action.payload.profilePhotoUrl,
                canBypassHierarchy:
                  getDefaultRoleForPosition(action.payload.positionId) === "ketua" ||
                  getDefaultRoleForPosition(action.payload.positionId) === "wakil-ketua",
              }
            : user
        ),
      };
    case "create-managed-user": {
      const nextUserId = buildUserId(state.users.length + 1);
      const roleId = getDefaultRoleForPosition(action.payload.positionId);

      return {
        ...state,
        users: state.users.concat({
          id: nextUserId,
          username: action.payload.username,
          password: action.payload.password,
          email: action.payload.email,
          whatsappNumber: action.payload.whatsappNumber,
          name: action.payload.name,
          nip: action.payload.nip,
          profilePhotoUrl: action.payload.profilePhotoUrl,
          roleId,
          positionId: action.payload.positionId,
          isActive: true,
          canBypassHierarchy: roleId === "ketua" || roleId === "wakil-ketua",
          actingAssignment: null,
        }),
      };
    }
    case "assign-acting-assignment": {
      const supervisorUser = state.users.find((user) => user.id === action.payload.supervisorUserId);
      const assigneeUser = state.users.find((user) => user.id === action.payload.assigneeUserId);
      const targetPositionId = getEffectivePositionId(supervisorUser);

      if (!supervisorUser || !assigneeUser || !targetPositionId) {
        return state;
      }

      const validation = validateActingAssignmentRequest({
        supervisorUser,
        assigneeUser,
        actingType: action.payload.type,
        targetPositionId,
        startDate: action.payload.startDate,
        endDate: action.payload.endDate,
        reason: action.payload.reason,
      });

      if (!validation.valid) {
        return state;
      }

      return {
        ...state,
        users: state.users.map((user) =>
          user.id === assigneeUser.id
            ? {
                ...user,
                actingAssignment: {
                  type: action.payload.type,
                  roleId: getDefaultRoleForPosition(targetPositionId),
                  positionId: targetPositionId,
                  assignedByUserId: action.currentUserId,
                  authorizedByUserId: supervisorUser.id,
                  startDate: action.payload.startDate ?? new Date().toISOString(),
                  endDate: action.payload.endDate ?? null,
                  assignedAt: new Date().toISOString(),
                },
              }
            : user
        ),
      };
    }
    case "clear-acting-assignment":
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.userId
            ? {
                ...user,
                actingAssignment: null,
              }
            : user
        ),
      };
    case "reset-user-password":
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.userId ? { ...user, password: action.payload.password } : user
        ),
      };
    case "delete-letter": {
      if (action.currentRoleId === "super-admin") {
        return {
          ...state,
          letters: state.letters.filter((letter) => letter.id !== action.letterId),
          dispositions: state.dispositions.filter((item) => item.suratId !== action.letterId),
        };
      }

      return {
        ...state,
        letters: state.letters.map((letter) =>
          letter.id === action.letterId
            ? {
                ...letter,
                deletedState: {
                  deletedAt: new Date().toISOString(),
                  deletedByUserId: action.currentUserId,
                  deletedMode: "soft",
                },
              }
            : letter
        ),
      };
    }
    case "toggle-module":
      return {
        ...state,
        moduleVisibility: state.moduleVisibility.map((item) =>
          item.roleId === action.roleId
            ? {
                ...item,
                modules: { ...item.modules, [action.moduleId]: action.enabled },
              }
            : item
        ),
      };
    case "create-letter": {
      const nextLetterId = buildLetterId(state.letters.length + 1);
      const nextDispositionId = buildDispositionId(state.dispositions.length + 1);
      const creator = state.users.find((user) => user.id === action.currentUserId);
      const creatorPositionId = getEffectivePositionId(creator);
      const targetUser = state.users.find((user) => user.id === action.payload.targetUserId);

      if (!creator || !creatorPositionId || !targetUser) return state;

      const baseLetter: LetterDetail = {
        id: nextLetterId,
        type: action.payload.type,
        nomorUrut: action.payload.nomorUrut,
        nomorSurat: action.payload.nomorSurat,
        tanggal: action.payload.tanggal,
        tanggalAdministratif: action.payload.tanggalAdministratif,
        pengirim: action.payload.pengirim,
        perihal: action.payload.perihal,
        status: "Dalam Disposisi",
        assignedUnit: action.payload.assignedUnit,
        confidentiality: action.payload.confidentiality,
        currentDispositionId: nextDispositionId,
        tags: action.payload.tags,
        kodeKlasifikasi: action.payload.kodeKlasifikasi,
        klasifikasiTags: action.payload.klasifikasiTags,
        ringkasan: action.payload.ringkasan,
        asalSurat: action.payload.asalSurat,
        tujuanSurat: action.payload.tujuanSurat,
        klasifikasi: action.payload.klasifikasi,
        lampiran: action.payload.lampiran,
        viewerMode: action.payload.viewerMode,
        qrCodeLabel: `Validasi internal ${creator.name} - ${new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
        }).format(new Date(action.payload.tanggal))}`,
        documentAspectRatio: 210 / 297,
        documentFileName: action.payload.documentFileName,
        documentSizeMb: action.payload.documentSizeMb,
        documentTextExtract: action.payload.documentTextExtract,
        targetPositionId: action.payload.targetPositionId,
        targetUserId: action.payload.targetUserId,
        whatsappDeliveries: [
          {
            id: `wa-${nextLetterId}-primary`,
            recipientName: targetUser.name,
            recipientWhatsapp: targetUser.whatsappNumber,
            status: "Terkirim",
            lastAttemptAt: new Date().toISOString(),
          },
        ],
      };

      const rootDisposition: DispositionNode = {
        id: nextDispositionId,
        suratId: nextLetterId,
        pengirimId: action.currentUserId,
        penerimaId: action.payload.targetUserId,
        targetPositionId: action.payload.targetPositionId,
        instruksi: action.payload.aiGenerated
          ? "Disposisi awal dibuat dari draft AI dan telah diverifikasi pengguna sebelum disimpan."
          : "Disposisi awal dibuat saat registrasi surat oleh petugas.",
        parentDispositionId: null,
        status: "Menunggu Tindak Lanjut",
        allowDownload: action.payload.viewerMode === "download",
        approvalQrCode: `QR-${nextDispositionId.toUpperCase()}`,
        createdAt: new Date().toISOString(),
        deadlineAt: null,
        readAt: null,
        readByUserId: null,
        urgent: action.payload.confidentiality !== "Biasa",
        bypass: false,
        routingType: "standard",
        whatsappDeliveries: [
          {
            id: `wa-${nextDispositionId}`,
            recipientName: targetUser.name,
            recipientWhatsapp: targetUser.whatsappNumber,
            status: "Terkirim",
            lastAttemptAt: new Date().toISOString(),
          },
        ],
      };

      return {
        ...state,
        letters: state.letters.concat(baseLetter),
        dispositions: state.dispositions.concat(rootDisposition),
      };
    }
    case "create-disposition": {
      const nextDispositionId = buildDispositionId(state.dispositions.length + 1);
      const recipient = state.users.find((user) => user.id === action.payload.penerimaId);
      const nextDisposition: DispositionNode = {
        id: nextDispositionId,
        suratId: action.payload.suratId,
        pengirimId: action.currentUserId,
        penerimaId: action.payload.penerimaId,
        targetPositionId: action.payload.targetPositionId,
        instruksi: action.payload.instruksi,
        parentDispositionId: action.payload.parentDispositionId,
        status: "Menunggu Tindak Lanjut",
        allowDownload: action.payload.allowDownload,
        approvalQrCode: `QR-${nextDispositionId.toUpperCase()}`,
        createdAt: new Date().toISOString(),
        deadlineAt: action.payload.deadlineAt ?? null,
        readAt: null,
        readByUserId: null,
        urgent: action.payload.urgent,
        bypass: action.payload.bypass,
        routingType: action.payload.routingType ?? "standard",
        whatsappDeliveries: recipient
          ? [
              {
                id: `wa-${nextDispositionId}`,
                recipientName: recipient.name,
                recipientWhatsapp: recipient.whatsappNumber,
                status: "Terkirim",
                lastAttemptAt: new Date().toISOString(),
              },
            ]
          : [],
      };

      return {
        ...state,
        dispositions: state.dispositions
          .map((item) =>
            item.id === action.payload.parentDispositionId
              ? { ...item, status: "Diteruskan" as const }
              : item
          )
          .concat(nextDisposition),
        letters: state.letters.map((letter) =>
          letter.id === action.payload.suratId
            ? {
                ...letter,
                status: "Dalam Disposisi",
                currentDispositionId: nextDisposition.id,
                viewerMode: action.payload.allowDownload ? "download" : "preview",
              }
            : letter
        ),
      };
    }
    case "forward-to-leadership": {
      const letter = state.letters.find((item) => item.id === action.payload.suratId);
      if (!letter) return state;

      const activeDisposition = state.dispositions.find((item) => item.id === letter.currentDispositionId) ?? null;
      const recipients = getLeadershipRecipients(state.users, state.positions).filter((recipient) => recipient.id !== action.currentUserId);
      const openLeadershipRecipientIds = new Set(
        state.dispositions
          .filter(
            (item) =>
              item.suratId === letter.id &&
              item.routingType === "leadership-notification" &&
              item.status !== "Selesai"
          )
          .map((item) => item.penerimaId)
      );
      const recipientsToNotify = recipients.filter((recipient) => !openLeadershipRecipientIds.has(recipient.id));

      if (recipientsToNotify.length === 0) return state;

      let nextIndex = state.dispositions.length + 1;
      const newDispositions = recipientsToNotify.map<DispositionNode>((recipient) => {
        const id = buildDispositionId(nextIndex++);

        return {
          id,
          suratId: action.payload.suratId,
          pengirimId: action.currentUserId,
          penerimaId: recipient.id,
          targetPositionId: recipient.actingAssignment?.positionId ?? recipient.positionId,
          instruksi: "Notifikasi cepat: surat masuk menunggu arahan pimpinan untuk disposisi lanjutan.",
          parentDispositionId: activeDisposition?.id ?? letter.currentDispositionId,
          status: "Menunggu Tindak Lanjut",
          allowDownload: false,
          approvalQrCode: `QR-${id.toUpperCase()}`,
          createdAt: new Date().toISOString(),
          deadlineAt: null,
          readAt: null,
          readByUserId: null,
          urgent: true,
          bypass: false,
          routingType: "leadership-notification",
          whatsappDeliveries: [
            {
              id: `wa-${id}`,
              recipientName: recipient.name,
              recipientWhatsapp: recipient.whatsappNumber,
              status: "Terkirim",
              lastAttemptAt: new Date().toISOString(),
            },
          ],
        };
      });

      const lastDisposition = newDispositions[newDispositions.length - 1];

      return {
        ...state,
        dispositions: state.dispositions
          .map((item) =>
            item.id === activeDisposition?.id && item.status !== "Selesai"
              ? { ...item, status: "Diteruskan" as const }
              : item
          )
          .concat(newDispositions),
        letters: state.letters.map((item) =>
          item.id === letter.id
            ? {
                ...item,
                status: "Dalam Disposisi",
                currentDispositionId: lastDisposition.id,
                viewerMode: "preview",
              }
            : item
        ),
      };
    }
    case "start-disposition": {
      return {
        ...state,
        dispositions: state.dispositions.map((item) =>
          item.id === action.dispositionId && item.status === "Menunggu Tindak Lanjut"
            ? { ...item, status: "Sedang Dikerjakan" as const }
            : item
        ),
      };
    }
    case "complete-disposition": {
      const current = state.dispositions.find((item) => item.id === action.payload.dispositionId);
      if (!current) return state;

      const updatedDispositions = state.dispositions.map((item) =>
        item.id === action.payload.dispositionId
          ? {
              ...item,
              status: "Selesai" as const,
              followUpNote: action.payload.note,
              followUpFileName: action.payload.fileName,
            }
          : item
      );

      // Letter becomes Selesai only when all standard leaf nodes (no standard children) are Selesai.
      const standardLeafNodes = updatedDispositions.filter(
        (item) =>
          item.suratId === current.suratId &&
          item.routingType === "standard" &&
          !updatedDispositions.some(
            (child) =>
              child.parentDispositionId === item.id &&
              child.routingType === "standard" &&
              child.suratId === current.suratId
          )
      );
      const allLeafsDone = standardLeafNodes.length > 0 && standardLeafNodes.every((item) => item.status === "Selesai");

      return {
        ...state,
        dispositions: updatedDispositions,
        letters: allLeafsDone
          ? state.letters.map((letter) =>
              letter.id === current.suratId ? { ...letter, status: "Selesai" as const } : letter
            )
          : state.letters,
      };
    }
    case "retry-whatsapp":
      if (action.payload.scope === "letter") {
        return {
          ...state,
          letters: markDeliveryAsRetried(state.letters, action.payload.entityId, action.payload.deliveryId),
        };
      }

      return {
        ...state,
        dispositions: markDeliveryAsRetried(state.dispositions, action.payload.entityId, action.payload.deliveryId),
      };
    default:
      return state;
  }
}

class BackendRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

type UploadPdfResult = {
  filePath?: string;
  publicUrl?: string;
};

/**
 * Aplikasi portal yang tampil bagi SELAIN super-admin.
 *
 * Aplikasi yang tidak tercantum di sini tidak akan pernah terlihat pegawai
 * biasa, sekalipun roleIds-nya mencakup seluruh peran - dan tidak ada pesan apa
 * pun yang menjelaskan mengapa. Karena itu setiap aplikasi baru yang memang
 * ditujukan untuk pegawai harus ditambahkan ke sini, bukan hanya didaftarkan di
 * mock-data. Uji regresi menjaga keduanya tetap sejalan.
 */
export const DEFAULT_PORTAL_APP_IDS = new Set<string>([
  "manajemen-surat",
  "aleta-bot",
  "sipp",
  "aps-badilag",
  "asisten-hakim",
  "e-kepegawaian",
  "audit-trail",
  // Untuk seluruh pegawai: mengunduh ekstensi SIPP dan melihat keadaan
  // penghubung e-Court.
  "aleta-ecourt",
  // Alat bantu tulis BAS. Yang paling membutuhkannya justru panitera, bukan
  // super admin - jadi ia harus ada di daftar bawaan, bukan hanya terlihat
  // oleh peran yang melihat segalanya.
  "bas",
]);

export function PortalProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: PortalStateData;
}) {
  const [state, dispatch] = useReducer(portalReducer, initialState ?? defaultState);
  const [seenPendingDispositionIds, setSeenPendingDispositionIds] = useState<string[]>([]);
  const [taskSourcesSnapshot, setTaskSourcesSnapshot] = useState<TaskSourcesPayload | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(Boolean(initialState));
  const syncGenerationRef = useRef(0);

  useEffect(() => {
    if (initialState) return;

    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsHydrated(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as Partial<PortalStateData>;
        dispatch({
          type: "hydrate",
          payload: {
            currentUserId: parsed.currentUserId ?? defaultState.currentUserId,
            roles: defaultState.roles,
            users: defaultState.users,
            positions: defaultState.positions,
            letters: defaultState.letters,
            dispositions: defaultState.dispositions,
            moduleVisibility: defaultState.moduleVisibility,
            theme: parsed.theme ?? defaultState.theme,
            aiConfig: defaultState.aiConfig,
            whatsAppWeb: defaultState.whatsAppWeb,
            institutionIdentity: defaultState.institutionIdentity,
            panelSettings: defaultState.panelSettings,
            assistantJudgeConfig: defaultState.assistantJudgeConfig,
          },
        });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialState]);

  const persistState = useEffectEvent((nextState: PortalStateData) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentUserId: nextState.currentUserId,
        theme: nextState.theme,
      } satisfies Partial<PortalStateData>)
    );
  });

  useEffect(() => {
    if (!isHydrated || initialState) return;
    persistState(state);
  }, [initialState, isHydrated, state]);

  // ALETA Better Auth Synchronization
  const { data: session, isPending: isAuthPending } = authClient.useSession();

  async function requestBackendJson<T>(input: string, init?: RequestInit, _actorUserId?: string) {
    const headers = new Headers(init?.headers);
    const hasBody = init?.body !== undefined && init?.body !== null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);
    const upstreamSignal = init?.signal;
    const handleUpstreamAbort = () => controller.abort();

    if (upstreamSignal?.aborted) {
      controller.abort();
    } else {
      upstreamSignal?.addEventListener("abort", handleUpstreamAbort, { once: true });
    }

    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(apiPath(input), {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted && !upstreamSignal?.aborted) {
        throw new BackendRequestError(
          "Permintaan ALETA melewati batas waktu. Periksa koneksi server lalu coba lagi.",
          408
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: T; error?: { message?: string } }
      | null;

    if (!response.ok || !payload?.ok) {
      throw new BackendRequestError(
        payload?.error?.message ?? "Permintaan ALETA ke backend gagal diproses.",
        response.status
      );
    }

    return payload.data as T;
  }

  const resolvePortalSessionFallback = useEffectEvent(async () => {
    try {
      const payload = await requestBackendJson<{ userId: string; isActive: boolean }>("/api/portal/session");
      return payload?.isActive ? payload.userId : null;
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 401) {
        return null;
      }

      console.warn("[ALETA] Fallback sesi portal belum dapat diverifikasi.", error);
      return null;
    }
  });

  useEffect(() => {
    if (!isHydrated || initialState || isAuthPending) return;

    if (session?.user) {
      if (state.currentUserId !== session.user.id) {
        dispatch({ type: "sign-in", userId: session.user.id });
      }
    } else if (session === null) {
      let cancelled = false;

      void resolvePortalSessionFallback().then((fallbackUserId) => {
        if (cancelled) return;

        if (fallbackUserId) {
          if (state.currentUserId !== fallbackUserId) {
            dispatch({ type: "sign-in", userId: fallbackUserId });
          }
          return;
        }

        if (state.currentUserId) {
          dispatch({ type: "sign-out" });
        }
      });

      return () => {
        cancelled = true;
      };
    }
  }, [session, isAuthPending, isHydrated, initialState, state.currentUserId]);

  async function uploadPdfDocument(documentFile: File) {
    const formData = new FormData();
    formData.append("file", documentFile);

    const response = await fetch(apiPath("/api/uploads/pdf"), {
      method: "POST",
      body: formData,
      credentials: "include",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: UploadPdfResult; error?: { message?: string } }
      | null;
    const documentFilePath = payload?.data?.filePath ?? payload?.data?.publicUrl;

    if (!response.ok || !payload?.ok || !documentFilePath) {
      throw new BackendRequestError(
        payload?.error?.message ?? "Unggah PDF belum berhasil diproses.",
        response.status
      );
    }

    return documentFilePath;
  }

  function withSyncTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  function getFulfilledValue<T>(result: PromiseSettledResult<T>) {
    return result.status === "fulfilled" ? result.value : undefined;
  }

  async function syncSecondaryPortalData(actorUserId: string, syncGeneration: number) {
    const results = await withSyncTimeout(
      Promise.allSettled([
        requestBackendJson<{ items: LetterDetail[] }>("/api/surat?pageSize=100", undefined, actorUserId),
        requestBackendJson<{ items: DispositionNode[] }>("/api/disposisi", undefined, actorUserId),
        requestBackendJson<AIGlobalConfig>("/api/ai/settings", undefined, actorUserId),
        requestBackendJson<WhatsAppWebConfig>("/api/settings/whatsapp", undefined, actorUserId),
        requestBackendJson<InstitutionIdentity>("/api/settings/institution", undefined, actorUserId),
        requestBackendJson<PanelSettings>("/api/settings/panel", undefined, actorUserId),
        requestBackendJson<AssistantJudgeConfig>("/api/settings/assistant-judge", undefined, actorUserId),
      ]),
      30_000,
      "Sebagian data portal belum selesai dimuat. Data akan dicoba lagi saat halaman dimuat ulang."
    ).catch((error) => {
      if (error instanceof BackendRequestError && error.status === 401 && syncGenerationRef.current === syncGeneration) {
        void authClient.signOut();
        dispatch({ type: "sign-out" });
        return null;
      }

      console.warn("[ALETA] Sinkronisasi data non-kritis belum selesai; portal tetap dapat digunakan.");
      return null;
    });

    if (!results || syncGenerationRef.current !== syncGeneration) {
      return;
    }

    const unauthorized = results.some(
      (result) => result.status === "rejected" && result.reason instanceof BackendRequestError && result.reason.status === 401
    );

    if (unauthorized) {
      void authClient.signOut();
      dispatch({ type: "sign-out" });
      return;
    }

    const [
      lettersResult,
      dispositionsResult,
      aiConfigResult,
      whatsAppResult,
      institutionResult,
      panelSettingsResult,
      assistantJudgeResult,
    ] = results;
    const lettersPayload = getFulfilledValue(lettersResult);
    const dispositionsPayload = getFulfilledValue(dispositionsResult);
    const aiConfigPayload = getFulfilledValue(aiConfigResult);
    const whatsAppPayload = getFulfilledValue(whatsAppResult);
    const institutionPayload = getFulfilledValue(institutionResult);
    const panelSettingsPayload = getFulfilledValue(panelSettingsResult);
    const assistantJudgePayload = getFulfilledValue(assistantJudgeResult);

    startTransition(() => {
      if (lettersPayload) {
        dispatch({ type: "sync-letters", payload: lettersPayload.items ?? [] });
      }
      if (dispositionsPayload) {
        dispatch({ type: "sync-dispositions", payload: dispositionsPayload.items ?? [] });
      }
      if (aiConfigPayload) {
        dispatch({ type: "set-ai-config", payload: aiConfigPayload });
      }
      if (whatsAppPayload) {
        dispatch({ type: "set-whatsapp-web", payload: whatsAppPayload });
      }
      if (institutionPayload) {
        dispatch({ type: "set-institution-identity", payload: institutionPayload });
      }
      if (panelSettingsPayload) {
        dispatch({ type: "set-panel-settings", payload: panelSettingsPayload });
      }
      if (assistantJudgePayload) {
        dispatch({ type: "set-assistant-judge-config", payload: assistantJudgePayload });
      }
    });
  }

  async function runSyncDataFromBackend(actorUserId?: string) {
    if (!actorUserId) return;
    const syncGeneration = syncGenerationRef.current + 1;
    syncGenerationRef.current = syncGeneration;
    const hasCachedActor = Boolean(getUser(actorUserId, state.users));
    setIsSyncing(!hasCachedActor);
    setSyncError(null);

    try {
      const [
        rolesPayload,
        usersPayload,
        moduleVisibilityPayload,
        positionsPayload,
      ] = await withSyncTimeout(
        Promise.all([
          requestBackendJson<{ items: Role[] }>("/api/roles", undefined, actorUserId),
          requestBackendJson<{ items: BackendUserRecord[] }>("/api/users", undefined, actorUserId),
          requestBackendJson<{ items: ModuleVisibility[] }>("/api/settings/module-visibility", undefined, actorUserId),
          requestBackendJson<{ items: Position[] }>("/api/positions", undefined, actorUserId),
        ]),
        12_000,
        "Server tidak merespons saat memuat sesi dan hak akses portal. Periksa koneksi atau hubungi administrator."
      );

      if (syncGenerationRef.current !== syncGeneration) {
        return;
      }

      startTransition(() => {
        dispatch({ type: "sync-roles", payload: rolesPayload.items ?? [] });
        dispatch({
          type: "sync-users",
          payload: syncCachedUsers(state.users, usersPayload.items ?? []),
        });
        dispatch({ type: "set-module-visibility", payload: moduleVisibilityPayload.items ?? [] });
        dispatch({ type: "sync-positions", payload: positionsPayload.items ?? [] });
      });

      void syncSecondaryPortalData(actorUserId, syncGeneration);
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 401) {
        void authClient.signOut();
        dispatch({ type: "sign-out" });
      } else {
        const message =
          error instanceof Error ? error.message : "Gagal memuat data portal dari server.";
        if (hasCachedActor) {
          console.warn("[ALETA] Refresh data sesi/RBAC belum selesai; cache lokal sementara dipakai.");
        } else {
          setSyncError(message);
        }
      }
    } finally {
      if (syncGenerationRef.current === syncGeneration) {
        setIsSyncing(false);
      }
    }
  }

  const syncDataFromBackend = useEffectEvent(runSyncDataFromBackend);

  useEffect(() => {
    if (!isHydrated || initialState || !state.currentUserId) return;
    const currentUserId = state.currentUserId;
    const timer = window.setTimeout(() => {
      void syncDataFromBackend(currentUserId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialState, isHydrated, state.currentUserId]);

  const currentUser = getUser(state.currentUserId, state.users);
  const currentRoleId = getEffectiveRoleId(currentUser);
  // Mode default portal: selain Super Admin, grid aplikasi hanya menampilkan
  // aplikasi inti berikut (tetap dipotong lagi oleh hak akses role & Akses Menu).
  const accessiblePortalApps = getAccessiblePortalApps(currentUser, state.moduleVisibility)
    .filter((app) => {
      if (currentRoleId === "super-admin") return true;
      return DEFAULT_PORTAL_APP_IDS.has(app.id);
    })
    .filter((app) => {
      if (app.id !== "asisten-hakim") return true;
      return canAccessAssistantJudge(currentRoleId, state.assistantJudgeConfig, currentUser?.id);
    });
  const accessibleModules = getAccessibleModules(currentUser, state.moduleVisibility);
  const accessibleLetters = getAccessibleLetters(currentUser, state.letters, state.dispositions, state.positions);
  const pendingInbox = getPendingInbox(currentUser, state.dispositions, state.letters);
  const fallbackTaskSources = useMemo(
    () =>
      buildTaskSources({
        accessibleLetters,
        dispositions: state.dispositions,
        pendingInbox,
        currentUserId: currentUser?.id,
        seenDispositionIds: seenPendingDispositionIds,
      }),
    [accessibleLetters, currentUser?.id, pendingInbox, seenPendingDispositionIds, state.dispositions]
  );
  const taskSources = taskSourcesSnapshot?.sources ?? fallbackTaskSources;
  const taskSummary = taskSourcesSnapshot?.summary ?? summarizeTaskSources(fallbackTaskSources);

  const newLetterCount = accessibleLetters.filter(l => l.type === "masuk" && l.status === "Baru").length;
  const failedWaCount = (accessibleLetters.reduce((c, l) => c + (l.whatsappDeliveries ?? []).filter(d => d.status === "Gagal").length, 0)) +
    (state.dispositions.reduce((c, d) => {
      const isRelevant = pendingInbox.some((item) => item.id === d.id) || d.pengirimId === state.currentUserId;
      return isRelevant ? c + (d.whatsappDeliveries ?? []).filter(v => v.status === "Gagal").length : c;
    }, 0));

  const globalTaskCount = taskSummary.total;
  const inboxNotificationCount = globalTaskCount;

  useEffect(() => {
    if (!isHydrated) return;
    const localIds = readSeenDispositionIds(currentUser?.id);
    const timer = window.setTimeout(() => {
      setSeenPendingDispositionIds(localIds);
      setTaskSourcesSnapshot(null);
    }, 0);

    if (!currentUser?.id || process.env.NODE_ENV === "test") {
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();

    fetch(apiPath("/api/notifications/reads?entityType=disposition"), {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as { ok?: boolean; data?: NotificationReadResponse } | null;
      })
      .then((payload) => {
        if (!payload?.ok) return;
        const dbIds =
          payload.data?.items
            ?.filter((item) => item.entityType === "disposition" && typeof item.entityId === "string")
            .map((item) => item.entityId as string) ?? [];
        const next = Array.from(new Set([...localIds, ...dbIds]));
        setSeenPendingDispositionIds(next);
        writeSeenDispositionIds(currentUser.id, next);
      })
      .catch((error) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        console.warn("[ALETA] Gagal memuat read-state notifikasi dari backend; localStorage dipakai sebagai fallback.");
      });

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentUser?.id, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !currentUser?.id || process.env.NODE_ENV === "test") return;

    const controller = new AbortController();

    fetch(apiPath("/api/tasks?limit=50"), {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as { ok?: boolean; data?: TaskSourcesPayload } | null;
      })
      .then((payload) => {
        if (!payload?.ok || !payload.data) return;
        setTaskSourcesSnapshot(payload.data);
      })
      .catch((error) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setTaskSourcesSnapshot(null);
        console.warn("[ALETA] Gagal memuat task source server; fallback lokal tetap dipakai.");
      });

    return () => controller.abort();
  }, [currentUser?.id, isHydrated]);

  const metrics = getDashboardMetrics(currentUser, state.letters, state.dispositions, state.positions);
  const operationalSummary = getOperationalSummary(currentUser, state.letters, state.dispositions, state.positions);

  const markTaskItemsSeen = (items: MarkSeenItemInput[]) => {
    const uniqueItems = Array.from(
      new Map(
        items
          .filter((item) => item.entityType && item.entityId)
          .map((item) => [`${item.entityType}:${item.entityId}`, item])
      ).values()
    );

    if (uniqueItems.length === 0) return;

    const dispositionIds = uniqueItems
      .filter((item) => item.entityType === "disposition")
      .map((item) => item.entityId);

    if (dispositionIds.length > 0) {
      setSeenPendingDispositionIds((current) => {
        const next = Array.from(new Set([...current, ...dispositionIds]));
        writeSeenDispositionIds(currentUser?.id, next);
        return next;
      });
    }

    setTaskSourcesSnapshot((current) => {
      if (!current) return current;
      const seenKeys = new Set(uniqueItems.map((item) => `${item.entityType}:${item.entityId}`));
      const sources = current.sources.map((source) =>
        finalizeTaskSource({
          appId: source.appId,
          appName: source.appName,
          appHref: source.appHref,
          tasks: source.tasks.map((task) =>
            seenKeys.has(`${task.entityType}:${task.entityId}`) ? { ...task, seen: true } : task
          ),
        })
      );

      return {
        summary: summarizeTaskSources(sources),
        sources,
      };
    });

    void fetch(apiPath("/api/notifications/mark-seen"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        items: uniqueItems,
      }),
    }).catch(() => {
      console.warn("[ALETA] Gagal menyimpan read-state notifikasi ke backend; localStorage tetap dipakai.");
    });
  };

  useEffect(() => {
    if (!isHydrated) return;

    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [isHydrated, state.theme]);

  return (
    <PortalContext.Provider
      value={{
        isHydrated,
        isAuthPending,
        isSyncing,
        syncError,
        currentUserId: state.currentUserId,
        currentUser,
        roles: state.roles,
        users: state.users,
        activeUsers: state.users.filter((user) => user.isActive),
        positions: state.positions ?? [],
        letters: state.letters,
        dispositions: state.dispositions,
        accessiblePortalApps,
        accessibleModules,
        accessibleLetters,
        pendingInbox,
        seenPendingDispositionIds,
        taskSources,
        taskSummary,
        inboxNotificationCount,
        globalTaskCount,
        metrics,
        operationalSummary,
        moduleVisibility: state.moduleVisibility,
        theme: state.theme,
        aiConfig: state.aiConfig,
        whatsAppWeb: state.whatsAppWeb,
        institutionIdentity: state.institutionIdentity,
        panelSettings: state.panelSettings,
        assistantJudgeConfig: state.assistantJudgeConfig,
        signIn: (userId) => {
          setSeenPendingDispositionIds([]);
          setTaskSourcesSnapshot(null);
          dispatch({ type: "sign-in", userId });
        },
        signOut: async () => {
          try {
            await authClient.signOut();
          } catch (error) {
            console.warn("[ALETA] Logout session auth belum dapat dikonfirmasi oleh server.", error);
          }
          setSeenPendingDispositionIds([]);
          setTaskSourcesSnapshot(null);
          dispatch({ type: "sign-out" });
        },
        setTheme: (theme) => dispatch({ type: "set-theme", theme }),
        setAIConfig: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengubah konfigurasi AI." };
          }

          try {
            const result = await requestBackendJson<AIGlobalConfig>(
              "/api/ai/settings",
              {
                method: "PUT",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "set-ai-config", payload: result });
            });

            return { ok: true, message: "Konfigurasi AI berhasil disimpan ke backend." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Konfigurasi AI gagal disimpan.",
            };
          }
        },
        refreshAIConfig: async () => {
          if (!currentUser) {
            return;
          }

          const result = await requestBackendJson<AIGlobalConfig>("/api/ai/settings", undefined, currentUser.id);
          startTransition(() => {
            dispatch({ type: "set-ai-config", payload: result });
          });
        },
        updateWhatsAppWeb: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengubah pengaturan WhatsApp." };
          }

          try {
            const result = await requestBackendJson<WhatsAppWebConfig>(
              "/api/settings/whatsapp",
              {
                method: "PUT",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "set-whatsapp-web", payload: result });
            });

            return { ok: true, message: "Pengaturan WhatsApp berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Pengaturan WhatsApp gagal disimpan.",
            };
          }
        },
        updateInstitutionIdentity: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengubah identitas instansi." };
          }

          try {
            const result = await requestBackendJson<InstitutionIdentity>(
              "/api/settings/institution",
              {
                method: "PUT",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            dispatch({ type: "set-institution-identity", payload: result });

            return { ok: true, message: "Identitas instansi berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Identitas instansi gagal disimpan.",
            };
          }
        },
        updatePanelSettings: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengubah pengaturan panel." };
          }

          try {
            const result = await requestBackendJson<PanelSettings>(
              "/api/settings/panel",
              {
                method: "PUT",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "set-panel-settings", payload: result });
            });

            return { ok: true, message: "Pengaturan panel berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Pengaturan panel gagal disimpan.",
            };
          }
        },
        updateAssistantJudgeConfig: async (payload) => {
          if (currentRoleId !== "super-admin") {
            return { ok: false, message: "Hanya Super Admin yang dapat mengubah pengaturan Asisten Hakim." };
          }

          try {
            const result = await requestBackendJson<AssistantJudgeConfig>(
              "/api/settings/assistant-judge",
              {
                method: "PUT",
                body: JSON.stringify(normalizeAssistantJudgeConfig(payload)),
              },
              currentUser?.id
            );

            startTransition(() => {
              dispatch({ type: "set-assistant-judge-config", payload: result });
            });

            return { ok: true, message: "Pengaturan Asisten Hakim berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Pengaturan Asisten Hakim gagal disimpan.",
            };
          }
        },
        updateProfile: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk memperbarui profil." };
          }

          try {
            const result = await requestBackendJson<{ user: BackendUserRecord }>(
              `/api/users/${currentUser.id}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  email: payload.email,
                  password: payload.password,
                  whatsappNumber: payload.whatsappNumber,
                  profilePhotoUrl: payload.profilePhotoUrl,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({
                type: "upsert-user",
                payload: buildCachedUser(result.user, state.users, payload.password?.trim() ? payload.password.trim() : currentUser.password),
              });
            });

            return { ok: true, message: "Profil berhasil diperbarui dan tersimpan di PostgreSQL." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Profil gagal diperbarui.",
            };
          }
        },
        updateManagedUser: async (userId, payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk memperbarui akun." };
          }

          try {
            const result = await requestBackendJson<{ user: BackendUserRecord }>(
              `/api/users/${userId}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({
                type: "upsert-user",
                payload: buildCachedUser(
                  result.user,
                  state.users,
                  payload.password?.trim() ? payload.password.trim() : undefined
                ),
              });
            });

            return { ok: true, message: "Data akun berhasil diperbarui dan disimpan ke PostgreSQL." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Data akun gagal diperbarui.",
            };
          }
        },
        createManagedUser: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk membuat akun baru." };
          }

          try {
            const result = await requestBackendJson<{ user: BackendUserRecord }>(
              "/api/users",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({
                type: "upsert-user",
                payload: buildCachedUser(result.user, state.users, payload.password),
              });
            });

            return { ok: true, message: "Akun baru berhasil dibuat dan tersimpan permanen di PostgreSQL." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Akun baru gagal dibuat.",
            };
          }
        },
        assignActingAssignment: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengelola penugasan." };
          }

          const supervisorUser = state.users.find((user) => user.id === payload.supervisorUserId);
          const assigneeUser = state.users.find((user) => user.id === payload.assigneeUserId);
          const targetPositionId = getEffectivePositionId(supervisorUser);
          const validation = validateActingAssignmentRequest({
            supervisorUser,
            assigneeUser,
            actingType: payload.type,
            targetPositionId: targetPositionId ?? "",
            startDate: payload.startDate,
            endDate: payload.endDate,
            reason: payload.reason,
          });

          if (!validation.valid) {
            return { ok: false, message: validation.message };
          }

          try {
            await requestBackendJson(
              "/api/acting-assignments",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  supervisorUserId: payload.supervisorUserId,
                  userIdPengganti: payload.assigneeUserId,
                  jabatanIdTarget: targetPositionId,
                  tipe: payload.type,
                  tanggalMulai: payload.startDate,
                  tanggalSelesai: payload.endDate,
                  reason: payload.reason,
                }),
              },
              currentUser.id
            );

            await runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Penugasan PLH/PLT berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Penugasan PLH/PLT gagal disimpan.",
            };
          }
        },
        clearActingAssignment: async (userId) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengelola penugasan." };
          }

          try {
            const assignments = await requestBackendJson<
              {
                items: Array<{
                  id: string;
                  userIdPengganti: string;
                }>;
              }
            >("/api/acting-assignments", undefined, currentUser.id);

            const activeAssignment = assignments.items.find((item) => item.userIdPengganti === userId);
            if (!activeAssignment) {
              return { ok: false, message: "Penugasan aktif untuk user ini tidak ditemukan." };
            }

            await requestBackendJson(
              "/api/acting-assignments",
              {
                method: "DELETE",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  assignmentId: activeAssignment.id,
                }),
              },
              currentUser.id
            );

            await runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Penugasan PLH/PLT berhasil dinonaktifkan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Penugasan PLH/PLT gagal dinonaktifkan.",
            };
          }
        },
        resetUserPassword: async (payload) => {
          if (!currentUser) {
            return { ok: false, message: "Silakan login ulang untuk mengubah password akun." };
          }

          try {
            const result = await requestBackendJson<{ user: BackendUserRecord }>(
              `/api/users/${payload.userId}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  password: payload.password,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({
                type: "upsert-user",
                payload: buildCachedUser(result.user, state.users, payload.password),
              });
            });

            return { ok: true, message: "Password akun berhasil diperbarui di PostgreSQL." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Password akun gagal diperbarui.",
            };
          }
        },
        deleteLetter: async (letterId) => {
          if (!currentUser) return null;
          const mode = currentUser.roleId === "super-admin" ? "hard" : currentUser.roleId === "admin" ? "soft" : null;
          if (!mode) return null;

          try {
            await requestBackendJson(
              `/api/surat/${letterId}`,
              {
                method: "DELETE",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  mode,
                }),
              },
              currentUser.id
            );

            dispatch({
              type: "delete-letter",
              currentUserId: currentUser.id,
              currentRoleId: currentUser.roleId,
              letterId,
            });

            return mode;
          } catch (error) {
            if (typeof window !== "undefined") {
              window.alert(error instanceof Error ? error.message : "Surat belum berhasil dihapus.");
            }
            return null;
          }
        },
        softDeleteLetter: async (letterId) => {
          if (!currentUser || currentUser.roleId !== "super-admin") return null;

          try {
            await requestBackendJson(
              `/api/surat/${letterId}`,
              {
                method: "DELETE",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  mode: "soft",
                }),
              },
              currentUser.id
            );

            dispatch({
              type: "delete-letter",
              currentUserId: currentUser.id,
              currentRoleId: "admin",
              letterId,
            });

            return "soft";
          } catch (error) {
            if (typeof window !== "undefined") {
              window.alert(error instanceof Error ? error.message : "Surat belum berhasil diarsipkan.");
            }
            return null;
          }
        },
        toggleModuleVisibility: (roleId, moduleId, enabled) => {
          if (!currentUser) return;

          void (async () => {
            try {
              const result = await requestBackendJson<{ items: ModuleVisibility[] }>(
                "/api/settings/module-visibility",
                {
                  method: "PUT",
                  body: JSON.stringify({
                    roleId,
                    moduleId,
                    enabled,
                  }),
                },
                currentUser.id
              );

              startTransition(() => {
                dispatch({ type: "set-module-visibility", payload: result.items ?? defaultState.moduleVisibility });
              });
            } catch {
              // Ignore UI toggle failures silently to avoid reverting unrelated work.
            }
          })();
        },
        createLetter: async (payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            let documentFilePath = "";

            if (payload.documentFile) {
              documentFilePath = await uploadPdfDocument(payload.documentFile);
            }

            const { documentFile, ...restPayload } = payload;
            const apiPayload = {
              ...restPayload,
              tanggalSurat: payload.tanggal, // Konversi ke nama field backend
            };

            const result = await requestBackendJson<{
              letter: LetterDetail;
              initialDisposition: DispositionNode | null;
            }>(
              "/api/surat",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...apiPayload,
                  documentFilePath,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-letter", payload: result.letter });
              if (result.initialDisposition) {
                dispatch({ type: "upsert-disposition", payload: result.initialDisposition });
              }
            });

            void runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Surat berhasil diregistrasi dan disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Gagal registrasi surat.",
            };
          }
        },
        updateLetter: async (letterId, payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            let documentFilePath = "";

            if (payload.documentFile) {
              documentFilePath = await uploadPdfDocument(payload.documentFile);
            }

            const { documentFile, ...restPayload } = payload;
            const apiPayload = {
              ...restPayload,
              tanggalSurat: payload.tanggal, // Konversi ke nama field backend jika ada
            };

            const result = await requestBackendJson<LetterDetail>(
              `/api/surat/${letterId}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...apiPayload,
                  documentFilePath: documentFilePath || undefined,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-letter", payload: result });
            });

            return { ok: true, message: "Perubahan surat berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Gagal memperbarui surat.",
            };
          }
        },
        transitionLetterWorkflow: async (letterId, payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };

          try {
            const result = await requestBackendJson<LetterDetail>(
              `/api/surat/${letterId}/workflow`,
              {
                method: "POST",
                body: JSON.stringify(payload),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-letter", payload: result });
            });

            return { ok: true, message: "Status workflow surat keluar berhasil diperbarui." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Gagal memperbarui workflow surat keluar.",
            };
          }
        },
        createDisposition: async (payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            const result = await requestBackendJson<DispositionNode>(
              "/api/disposisi",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-disposition", payload: result });
            });

            // Re-sync letters to update status
            void runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Disposisi berhasil dikirim." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Gagal mengirim disposisi." };
          }
        },
        forwardToLeadership: async (payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            const result = await requestBackendJson<{ items: DispositionNode[] }>(
              "/api/disposisi/forward",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  suratId: payload.suratId,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              result.items.forEach((item) => {
                dispatch({ type: "upsert-disposition", payload: item });
              });
            });

            return { ok: true, message: "Surat berhasil diteruskan ke Pimpinan." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Gagal meneruskan ke Pimpinan." };
          }
        },
        markDispositionRead: async (dispositionId) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            const result = await requestBackendJson<DispositionNode>(
              "/api/disposisi/read",
              {
                method: "POST",
                body: JSON.stringify({ dispositionId }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-disposition", payload: result });
            });

            return { ok: true, message: "Disposisi ditandai sudah dibaca." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Gagal menandai disposisi dibaca." };
          }
        },
        startDisposition: async (dispositionId) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            const result = await requestBackendJson<DispositionNode>(
              "/api/disposisi/start",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  dispositionId,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-disposition", payload: result });
            });

            return { ok: true, message: "Disposisi dimulai." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Gagal memulai disposisi." };
          }
        },
        completeDisposition: async (payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };
          try {
            const result = await requestBackendJson<DispositionNode>(
              "/api/disposisi/complete",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            startTransition(() => {
              dispatch({ type: "upsert-disposition", payload: result });
            });

            void runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Disposisi berhasil diselesaikan." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Gagal menyelesaikan disposisi." };
          }
        },
        retryWhatsappDelivery: async (payload) => {
          if (!currentUser) return { ok: false, message: "Sesi habis." };

          try {
            await requestBackendJson(
              "/api/whatsapp/retry",
              {
                method: "POST",
                body: JSON.stringify({
                  actorUserId: currentUser.id,
                  ...payload,
                }),
              },
              currentUser.id
            );

            void runSyncDataFromBackend(currentUser.id);

            return { ok: true, message: "Retry WhatsApp berhasil dijalankan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Retry WhatsApp gagal dijalankan.",
            };
          }
        },
        getLetterById: (letterId) => getLetter(letterId, state.letters),
        getDispositionById: (dispositionId) => getDisposition(dispositionId, state.dispositions),
        getLetterDispositionsById: (letterId) => getLetterDispositions(letterId, state.dispositions),
        getSearchResults: (query) => searchPortal(query, currentUser, state.letters, state.dispositions, state.users, state.positions),
        getUsersByPosition: (positionId) => getPositionUsers(positionId, state.users),
        markTaskItemsSeen,
        markPendingInboxSeen: (dispositionIds) => {
          const idsToMark = dispositionIds ?? pendingInbox.map((item) => item.id);

          if (idsToMark.length === 0) return;

          markTaskItemsSeen(idsToMark.map((entityId) => ({ entityType: "disposition", entityId })));
        },
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);

  if (!context) {
    throw new Error("usePortal must be used within PortalProvider");
  }

  return context;
}
