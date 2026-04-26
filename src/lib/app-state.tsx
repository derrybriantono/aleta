"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { authClient } from "@/lib/auth-client";
import { mergeAIFeatureFlags, type PartialAIFeatureFlags } from "@/lib/ai-feature-flags";
import {
  defaultAIConfig,
  defaultInstitutionIdentity,
  defaultWhatsAppWeb,
  moduleVisibility,
} from "@/lib/mock-data";
import { validateActingAssignmentRequest } from "@/core/organization/service";
import {
  getDefaultRoleForPosition,
  getAccessibleLetters,
  getAccessibleModules,
  getAccessiblePortalApps,
  getDashboardMetrics,
  getDisposition,
  getEffectivePositionId,
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
  type AIGlobalConfig,
  type DashboardMetric,
  type DispositionNode,
  type InstitutionIdentity,
  type LetterDetail,
  type ModuleConfig,
  type ModuleId,
  type ModuleVisibility,
  type OperationalSummaryItem,
  type PortalAppConfig,
  type PortalStateData,
  type SearchResult,
  type ThemeMode,
  type UserPersona,
  type WhatsAppWebConfig,
} from "@/lib/types";

const STORAGE_KEY = "portal-terpadu-pa-v2";

type CreateDispositionInput = {
  suratId: string;
  parentDispositionId: string | null;
  penerimaId: string;
  targetPositionId: string;
  instruksi: string;
  allowDownload: boolean;
  urgent: boolean;
  bypass: boolean;
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
  isActive?: boolean;
  profilePhotoUrl?: string;
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
  isActive?: boolean;
  profilePhotoUrl?: string;
};

type AssignActingAssignmentInput = {
  supervisorUserId: string;
  assigneeUserId: string;
  type: ActingAssignment["type"];
  startDate?: string;
  endDate?: string | null;
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

type UpdateAIConfigInput = Omit<Partial<AIGlobalConfig>, "featureFlags"> & {
  featureFlags?: PartialAIFeatureFlags;
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
  | { type: "sync-users"; payload: UserPersona[] }
  | { type: "sync-letters"; payload: LetterDetail[] }
  | { type: "sync-dispositions"; payload: DispositionNode[] }
  | { type: "set-module-visibility"; payload: ModuleVisibility[] }
  | { type: "upsert-user"; payload: UserPersona }
  | { type: "upsert-letter"; payload: LetterDetail }
  | { type: "upsert-disposition"; payload: DispositionNode }
  | { type: "sign-in"; userId: string }
  | { type: "sign-out" }
  | { type: "set-theme"; theme: ThemeMode }
  | { type: "set-ai-config"; payload: UpdateAIConfigInput }
  | { type: "set-whatsapp-web"; payload: Partial<WhatsAppWebConfig> }
  | { type: "set-institution-identity"; payload: Partial<InstitutionIdentity> }
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
  users: UserPersona[];
  letters: LetterDetail[];
  dispositions: DispositionNode[];
  accessiblePortalApps: PortalAppConfig[];
  accessibleModules: ModuleConfig[];
  accessibleLetters: LetterDetail[];
  pendingInbox: DispositionNode[];
  inboxNotificationCount: number;
  globalTaskCount: number;
  metrics: DashboardMetric[];
  operationalSummary: OperationalSummaryItem[];
  moduleVisibility: ModuleVisibility[];
  theme: ThemeMode;
  aiConfig: AIGlobalConfig;
  whatsAppWeb: WhatsAppWebConfig;
  institutionIdentity: InstitutionIdentity;
  signIn: (userId: string) => void;
  signOut: () => void;
  setTheme: (theme: ThemeMode) => void;
  setAIConfig: (payload: UpdateAIConfigInput) => Promise<MutationResult>;
  refreshAIConfig: () => Promise<void>;
  updateWhatsAppWeb: (payload: Partial<WhatsAppWebConfig>) => Promise<MutationResult>;
  updateInstitutionIdentity: (payload: Partial<InstitutionIdentity>) => Promise<MutationResult>;
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
  createDisposition: (payload: CreateDispositionInput) => void;
  forwardToLeadership: (payload: ForwardToLeadershipInput) => void;
  startDisposition: (dispositionId: string) => Promise<MutationResult>;
  completeDisposition: (payload: CompleteDispositionInput) => void;
  retryWhatsappDelivery: (payload: RetryWhatsappInput) => Promise<MutationResult>;
  getLetterById: (letterId: string) => LetterDetail | null;
  getDispositionById: (dispositionId: string) => DispositionNode | null;
  getLetterDispositionsById: (letterId: string) => DispositionNode[];
  getSearchResults: (query: string) => SearchResult[];
  getUsersByPosition: (positionId: string) => UserPersona[];
  markPendingInboxSeen: (dispositionIds?: string[]) => void;
};

const defaultState: PortalStateData = {
  currentUserId: null,
  users: [],
  letters: [],
  dispositions: [],
  moduleVisibility,
  theme: "dark",
  aiConfig: defaultAIConfig,
  whatsAppWeb: defaultWhatsAppWeb,
  institutionIdentity: defaultInstitutionIdentity,
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
    isActive: incoming.isActive,
    canBypassHierarchy: incoming.canBypassHierarchy ?? cached?.canBypassHierarchy ?? false,
    actingAssignment: incoming.actingAssignment ?? cached?.actingAssignment ?? null,
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
      return action.payload;
    case "sync-users":
      return {
        ...state,
        users: sortUsersByName(action.payload),
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
                  endDate: action.payload.type === "PLH" ? action.payload.endDate ?? null : null,
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
      const recipients = getLeadershipRecipients(state.users).filter((recipient) => recipient.id !== action.currentUserId);
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

export function PortalProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: PortalStateData;
}) {
  const [state, dispatch] = useReducer(portalReducer, initialState ?? defaultState);
  const [seenPendingDispositionIds, setSeenPendingDispositionIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(Boolean(initialState));

  useEffect(() => {
    if (initialState) {
      setIsHydrated(true);
      return;
    }

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
          users: defaultState.users,
          letters: defaultState.letters,
          dispositions: defaultState.dispositions,
          moduleVisibility: defaultState.moduleVisibility,
          theme: parsed.theme ?? defaultState.theme,
          aiConfig: {
            ...defaultState.aiConfig,
            ...(parsed.aiConfig ?? {}),
            featureFlags: mergeAIFeatureFlags(defaultState.aiConfig.featureFlags, parsed.aiConfig?.featureFlags),
          },
          whatsAppWeb: { ...defaultState.whatsAppWeb, ...(parsed.whatsAppWeb ?? {}) },
          institutionIdentity: {
            ...defaultState.institutionIdentity,
            ...(parsed.institutionIdentity ?? {}),
          },
        },
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, [initialState]);

  const persistState = useEffectEvent((nextState: PortalStateData) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentUserId: nextState.currentUserId,
        theme: nextState.theme,
        aiConfig: nextState.aiConfig,
        whatsAppWeb: nextState.whatsAppWeb,
        institutionIdentity: nextState.institutionIdentity,
      } satisfies Partial<PortalStateData>)
    );
  });

  useEffect(() => {
    if (!isHydrated || initialState) return;
    persistState(state);
  }, [initialState, isHydrated, state]);

  // ALETA Better Auth Synchronization
  const { data: session, isPending: isAuthPending } = authClient.useSession();

  useEffect(() => {
    if (!isHydrated || initialState || isAuthPending) return;

    if (session?.user) {
      if (state.currentUserId !== session.user.id) {
        dispatch({ type: "sign-in", userId: session.user.id });
      }
    } else if (session === null) {
      if (state.currentUserId) {
        dispatch({ type: "sign-out" });
      }
    }
  }, [session, isAuthPending, isHydrated, initialState, state.currentUserId]);


  async function requestBackendJson<T>(input: string, init?: RequestInit, _actorUserId?: string) {
    const headers = new Headers(init?.headers);
    const hasBody = init?.body !== undefined && init?.body !== null;

    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
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

  async function runSyncDataFromBackend(actorUserId?: string) {
    if (!actorUserId) return;
    setIsSyncing(true);
    setSyncError(null);

    const SYNC_TIMEOUT_MS = 30_000;
    const timeoutSignal = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Server tidak merespons dalam 30 detik. Periksa koneksi atau hubungi administrator.")),
        SYNC_TIMEOUT_MS
      )
    );

    try {
      const [usersPayload, lettersPayload, dispositionsPayload, aiConfigPayload, whatsAppPayload, institutionPayload, moduleVisibilityPayload] =
        await Promise.race([
          Promise.all([
            requestBackendJson<{ items: BackendUserRecord[] }>("/api/users", undefined, actorUserId),
            requestBackendJson<{ items: LetterDetail[] }>("/api/surat", undefined, actorUserId),
            requestBackendJson<{ items: DispositionNode[] }>("/api/disposisi", undefined, actorUserId),
            requestBackendJson<AIGlobalConfig>("/api/ai/settings", undefined, actorUserId),
            requestBackendJson<WhatsAppWebConfig>("/api/settings/whatsapp", undefined, actorUserId),
            requestBackendJson<InstitutionIdentity>("/api/settings/institution", undefined, actorUserId),
            requestBackendJson<{ items: ModuleVisibility[] }>("/api/settings/module-visibility", undefined, actorUserId),
          ]),
          timeoutSignal,
        ]);

      startTransition(() => {
        dispatch({
          type: "sync-users",
          payload: syncCachedUsers(state.users, usersPayload.items ?? []),
        });
        dispatch({ type: "sync-letters", payload: lettersPayload.items ?? [] });
        dispatch({ type: "sync-dispositions", payload: dispositionsPayload.items ?? [] });
        dispatch({ type: "set-ai-config", payload: aiConfigPayload });
        dispatch({ type: "set-whatsapp-web", payload: whatsAppPayload });
        dispatch({ type: "set-institution-identity", payload: institutionPayload });
        dispatch({ type: "set-module-visibility", payload: moduleVisibilityPayload.items ?? defaultState.moduleVisibility });
      });
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 401) {
        void authClient.signOut();
        dispatch({ type: "sign-out" });
      } else {
        const message =
          error instanceof Error ? error.message : "Gagal memuat data portal dari server.";
        setSyncError(message);
      }
    } finally {
      setIsSyncing(false);
    }
  }

  const syncDataFromBackend = useEffectEvent(runSyncDataFromBackend);

  useEffect(() => {
    if (!isHydrated || initialState || !state.currentUserId) return;
    void syncDataFromBackend(state.currentUserId);
  }, [initialState, isHydrated, state.currentUserId]);

  const currentUser = getUser(state.currentUserId, state.users);
  const accessiblePortalApps = getAccessiblePortalApps(currentUser);
  const accessibleModules = getAccessibleModules(currentUser, state.moduleVisibility);
  const accessibleLetters = getAccessibleLetters(currentUser, state.letters, state.dispositions);
  const pendingInbox = getPendingInbox(currentUser, state.dispositions, state.letters);
  const inboxNotificationCount = pendingInbox.filter(
    (item) => !seenPendingDispositionIds.includes(item.id)
  ).length;

  const newLetterCount = accessibleLetters.filter(l => l.type === "masuk" && l.status === "Baru").length;
  const failedWaCount = (accessibleLetters.reduce((c, l) => c + (l.whatsappDeliveries ?? []).filter(d => d.status === "Gagal").length, 0)) +
    (state.dispositions.reduce((c, d) => {
      const isRelevant = pendingInbox.some((item) => item.id === d.id) || d.pengirimId === state.currentUserId;
      return isRelevant ? c + (d.whatsappDeliveries ?? []).filter(v => v.status === "Gagal").length : c;
    }, 0));

  const globalTaskCount = pendingInbox.length + newLetterCount + failedWaCount;

  const metrics = getDashboardMetrics(currentUser, state.letters, state.dispositions);
  const operationalSummary = getOperationalSummary(currentUser, state.letters, state.dispositions);

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
        users: state.users,
        letters: state.letters,
        dispositions: state.dispositions,
        accessiblePortalApps,
        accessibleModules,
        accessibleLetters,
        pendingInbox,
        inboxNotificationCount,
        globalTaskCount,
        metrics,
        operationalSummary,
        moduleVisibility: state.moduleVisibility,
        theme: state.theme,
        aiConfig: state.aiConfig,
        whatsAppWeb: state.whatsAppWeb,
        institutionIdentity: state.institutionIdentity,
        signIn: (userId) => {
          setSeenPendingDispositionIds([]);
          dispatch({ type: "sign-in", userId });
        },
        signOut: () => {
          void authClient.signOut();
          setSeenPendingDispositionIds([]);
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

            startTransition(() => {
              dispatch({ type: "set-institution-identity", payload: result });
            });

            return { ok: true, message: "Identitas instansi berhasil disimpan." };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Identitas instansi gagal disimpan.",
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
                  userIdPengganti: payload.assigneeUserId,
                  jabatanIdTarget: targetPositionId,
                  tipe: payload.type,
                  tanggalMulai: payload.startDate,
                  tanggalSelesai: payload.type === "PLT" ? null : payload.endDate,
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
            // Log removed for production
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
              const formData = new FormData();
              formData.append("file", payload.documentFile);

              const uploadRes = await fetch("/api/uploads/pdf", {
                method: "POST",
                body: formData,
              });
              const uploadData = await uploadRes.json();
              if (uploadData.ok) {
                documentFilePath = uploadData.data.filePath;
              }
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
              const formData = new FormData();
              formData.append("file", payload.documentFile);

              const uploadRes = await fetch("/api/uploads/pdf", {
                method: "POST",
                body: formData,
              });
              const uploadData = await uploadRes.json();
              if (uploadData.ok) {
                documentFilePath = uploadData.data.filePath;
              }
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
        getSearchResults: (query) => searchPortal(query, currentUser, state.letters, state.dispositions, state.users),
        getUsersByPosition: (positionId) => getPositionUsers(positionId, state.users),
        markPendingInboxSeen: (dispositionIds) => {
          const idsToMark = dispositionIds ?? pendingInbox.map((item) => item.id);

          if (idsToMark.length === 0) return;

          setSeenPendingDispositionIds((current) => Array.from(new Set([...current, ...idsToMark])));
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
