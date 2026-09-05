export type RoleId =
  | "super-admin"
  | "admin"
  | "ketua"
  | "wakil-ketua"
  | "hakim"
  | "sekretaris"
  | "panitera"
  | "panitera-muda"
  | "panitera-pengganti"
  | "kasubag"
  | "jurusita"
  | "pranata-komputer"
  | "analis-keuangan"
  | "analis-perkara"
  | "pelaksana"
  | "pppk"
  | "pejabat-struktural"
  | "staf";

export type ModuleId =
  | "manajemen-surat"
  // Alat bantu tulis BAS untuk kepaniteraan.
  | "bas"
  | "aleta-ecourt"
  | "aleta-ecourt-admin"
  | "asisten-hakim"
  | "e-kepegawaian"
  | "sipp"
  | "aps-badilag"
  | "e-keuangan"
  | "manajemen-aset"
  | "perpustakaan"
  | "audit-trail"
  | "gateway-notifikasi"
  | "dashboard"
  | "penugasan"
  | "surat-masuk"
  | "surat-keluar"
  | "arsip"
  | "statistik"
  | "disposisi"
  | "search"
  | "mapping-user-jabatan"
  | "visibility-role"
  | "laporan"
  | "audit"
  | "kepegawaian"
  | "hr-settings"
  | "keuangan"
  | "aset"
  | "identity"
  | "panel-settings"
  | "public-access"
  | "notifikasi"
  | "notifikasi-wa"
  | "ai-settings"
  | "admin-hub"
  | "assistant-judge-settings"
  | "whatsapp-settings"
  | "system-updates"
  | "backup-system"
  | "database-viewer"
  | "aleta-bot"
  | "aleta-sipp"
  | "aleta-sipp-settings"
  | "judicia-legal-form"
  | "judicia-legal-form-settings"
  | "e-status"
  | "e-status-settings"
  | "feedback";

export type PortalAppId =
  | "manajemen-surat"
  | "aleta-bot"
  // Penghubung e-Court: satu untuk seluruh pegawai (unduh ekstensi dan
  // keadaan penghubung), satu untuk admin (pengaturannya).
  | "aleta-ecourt"
  | "aleta-ecourt-admin"
  | "aleta-sipp"
  | "judicia-legal-form"
  | "asisten-hakim"
  // Alat bantu tulis BAS untuk kepaniteraan.
  | "bas"
  | "e-kepegawaian"
  | "e-status"
  | "sipp"
  | "aps-badilag"
  | "e-keuangan"
  | "manajemen-aset"
  | "perpustakaan"
  | "audit-trail"
  | "gateway-notifikasi";

export type ExternalAppId = "sipp" | "aps-badilag";

export interface ExternalAppCredentialSummary {
  appId: ExternalAppId;
  username: string;
  usernameMasked: string;
  isEnabled: boolean;
  hasPassword: boolean;
  passwordUpdatedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifiedStatus?: string;
  lastLaunchAt?: string | null;
}

export interface ExternalAppCredentialInput {
  appId: ExternalAppId;
  username?: string;
  password?: string;
  isEnabled?: boolean;
  clearPassword?: boolean;
}

export type ThemeMode = "light" | "dark";
export type FooterMode = "auto" | "compact" | "full";
export type WhatsAppDeliveryStatus = "Diantrekan" | "Terkirim" | "Dibaca" | "Gagal";

export type LetterType = "masuk" | "keluar";
export type LetterStatus = "Baru" | "Dalam Disposisi" | "Selesai";
export type LetterWorkflowStatus = "draft" | "submitted" | "approved" | "sent" | "rejected";
export type LetterTemplateCategory =
  | "undangan"
  | "permintaan_data"
  | "balasan_surat"
  | "surat_tugas"
  | "lainnya";
export type DispositionStatus =
  | "Menunggu Tindak Lanjut"
  | "Sedang Dikerjakan"
  | "Diteruskan"
  | "Selesai"
  | "Dikembalikan";
export type ActingAssignmentType = "PLH" | "PLT";
export type DispositionRoutingType = "standard" | "leadership-notification";
export type AIModelId = string;
export type AILanguage = "id" | "en";
export type RegulationSource = "internal" | "external";
export type AIRecommendationType = "routing" | "instruction" | "regulation";
export type AIProviderId = string;
export type AIConnectionStatus = "idle" | "connected" | "failed";
export type AIModuleKey = "manajemen_surat" | "jlf" | "aleta_bot";
export type AIModuleConfigStatus = "global" | "custom" | "fallback";
export type WhatsAppWebConnectionStatus = "active" | "inactive" | "failed";
export type InstitutionIdentityEnrichmentStatus =
  | "catalog_only"
  | "cached"
  | "enriched"
  | "partial"
  | "failed";
export type InstitutionIdentityEnrichmentConfidence = "high" | "medium" | "low";
export type InstitutionIdentityEnrichmentSourceType =
  | "local"
  | "google_places"
  | "google_search"
  | "official_website"
  | "ai"
  | "cache";

export type AIFeatureModuleKey =
  | "oneStopDisposition"
  | "mailIntelligence"
  | "draftMetadata"
  | "institutionIdentity";

export interface OneStopDispositionAIFlags {
  enabled: boolean;
  recommendation: boolean;
  priorityDetection: boolean;
  targetSuggestion: boolean;
  instructionSuggestion: boolean;
  autofill: boolean;
  rationale: boolean;
  diagnostics: boolean;
}

export interface MailIntelligenceAIFlags {
  enabled: boolean;
  summary: boolean;
  findings: boolean;
  recommendedActions: boolean;
  relatedRegulations: boolean;
  riskNotes: boolean;
  diagnostics: boolean;
}

export interface DraftMetadataAIFlags {
  enabled: boolean;
  nomorSurat: boolean;
  tanggalSurat: boolean;
  tanggalTerima: boolean;
  asalSurat: boolean;
  perihal: boolean;
  kodeKlasifikasi: boolean;
  klasifikasiSurat: boolean;
  tagSurat: boolean;
  tagAsalSurat: boolean;
  ocrCheck: boolean;
  aiReviewNote: boolean;
}

export interface InstitutionIdentityAIFlags {
  enabled: boolean;
  courtNameSuggestion: boolean;
  identityEnrichment: boolean;
  googleDiscovery: boolean;
  officialWebsiteExtraction: boolean;
  aiNormalization: boolean;
  diagnostics: boolean;
}

export interface AIFeatureFlags {
  oneStopDisposition: OneStopDispositionAIFlags;
  mailIntelligence: MailIntelligenceAIFlags;
  draftMetadata: DraftMetadataAIFlags;
  institutionIdentity: InstitutionIdentityAIFlags;
}

export interface Role {
  id: RoleId;
  name: string;
  description: string;
}

export interface Position {
  id: string;
  name: string;
  unitKerja: string;
  levelHierarchy: number;
  reportsToPositionId?: string | null;
  dispositionTargetPositionIds?: string[];
  canForwardToLeadership?: boolean;
}

export interface ActingAssignment {
  type: ActingAssignmentType;
  roleId: RoleId;
  positionId: string;
  assignedByUserId?: string;
  authorizedByUserId?: string;
  startDate?: string;
  endDate?: string | null;
  assignedAt?: string;
}

export interface UserPersona {
  id: string;
  username: string;
  password: string;
  name: string;
  nip: string;
  email: string;
  whatsappNumber: string;
  profilePhotoUrl?: string;
  roleId: RoleId;
  positionId: string;
  additionalRoleIds?: string[];
  isActive: boolean;
  canBypassHierarchy?: boolean;
  actingAssignment?: ActingAssignment | null;
  externalCredentials?: ExternalAppCredentialSummary[];
}

export interface WhatsAppDelivery {
  id: string;
  recipientName: string;
  recipientWhatsapp: string;
  status: WhatsAppDeliveryStatus;
  lastAttemptAt: string;
  queueId?: string | null;
  gatewayStatus?: string | null;
  gatewayStage?: string | null;
  gatewayMessageId?: string | null;
  gatewayError?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  lastGatewaySyncAt?: string | null;
  sourceFeature?: string;
  errorMessage?: string;
}

export interface LetterDeleteState {
  deletedAt: string;
  deletedByUserId: string;
  deletedMode: "soft";
}

export interface ModuleConfig {
  id: ModuleId;
  label: string;
  description: string;
  href: string;
  icon: string;
  roleIds: RoleId[];
  positionIds?: string[];
  showInHub?: boolean;
  showInSidebar?: boolean;
  iconBgClass?: string;
  iconFgClass?: string;
  cardClass?: string;
  badgeLabel?: string;
}

export interface PanelSettings {
  footerMode: FooterMode;
  portalCards: PortalCardVisibility;
  publicAccess: PublicAccessSettings;
  externalApps: Record<ExternalAppId, ExternalAppLaunchSettings>;
  updatedAt?: string;
}

export interface PortalCardVisibility {
  workSummary: boolean;
  mainMenu: boolean;
  importantTasks: boolean;
}

export interface PublicAccessSettings {
  publicUrl: string;
  method: "domain" | "cloudflare-tunnel" | "vpn";
  notes: string;
}

export interface ExternalAppLaunchSettings {
  appId: ExternalAppId;
  enabled: boolean;
  baseUrl: string;
  loginPath: string;
  usernameField: string;
  passwordField: string;
  passwordMode: "plain" | "md5";
  notes: string;
}

export interface ModuleVisibility {
  roleId: RoleId;
  modules: Record<ModuleId, boolean>;
}

export interface PortalAppConfig {
  id: PortalAppId;
  label: string;
  description: string;
  href: string;
  icon: string;
  roleIds: RoleId[];
  badgeLabel?: string;
  iconBgClass?: string;
  iconFgClass?: string;
  cardClass?: string;
  isDummy?: boolean;
}

export type AssistantJudgeProviderId = string;

export interface AssistantJudgeLinkConfig {
  id?: string;
  provider?: string;
  enabled: boolean;
  label: string;
  url: string;
  description: string;
  iconKey?: string;
  sortOrder?: number;
  allowedRoles?: RoleId[];
  allowedUserIds?: string[];
  embeddedEnabled?: boolean;
  openInNewTab?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AssistantJudgeConfig {
  enabled: boolean;
  visibleRoles: RoleId[];
  links: Record<AssistantJudgeProviderId, AssistantJudgeLinkConfig>;
  updatedAt?: string;
}

export interface AuditPreview {
  id: string;
  action: string;
  entity: string;
  userNameSnapshot: string;
  userPositionSnapshot: string;
  ipAddress: string;
  timestamp: string;
}

export interface WhatsAppStatusPreview {
  id: string;
  sessionName: string;
  status: "Online" | "Terputus";
  lastConnected: string;
}

export interface LetterSummary {
  id: string;
  type: LetterType;
  nomorSurat: string;
  tanggal: string;
  pengirim: string;
  perihal: string;
  status: LetterStatus;
  assignedUnit: string;
  confidentiality: "Biasa" | "Penting" | "Rahasia";
  currentDispositionId: string;
  tags: string[];
}

export interface LetterDetail extends LetterSummary {
  nomorUrut?: string;
  createdAt?: string;
  updatedAt?: string;
  workflowStatus?: LetterWorkflowStatus;
  submittedAt?: string | null;
  submittedByUserId?: string | null;
  approvedAt?: string | null;
  approvedByUserId?: string | null;
  sentAt?: string | null;
  sentByUserId?: string | null;
  rejectedAt?: string | null;
  rejectedByUserId?: string | null;
  rejectionNote?: string | null;
  tanggalAdministratif?: string;
  kodeKlasifikasi?: string;
  klasifikasiTags?: string[];
  ringkasan: string;
  asalSurat: string;
  tujuanSurat: string;
  klasifikasi: string;
  lampiran: string[];
  viewerMode: "preview" | "download";
  qrCodeLabel: string;
  documentAspectRatio?: number;
  documentFileName?: string;
  documentSizeMb?: number;
  documentUrl?: string;
  documentTextExtract?: string;
  targetPositionId?: string;
  targetUserId?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  whatsappDeliveries: WhatsAppDelivery[];
  deletedState?: LetterDeleteState;
}

export interface LetterTemplate {
  id: string;
  name: string;
  category: LetterTemplateCategory;
  description: string;
  body: string;
  placeholders: string[];
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DispositionNode {
  id: string;
  suratId: string;
  pengirimId: string;
  penerimaId: string;
  targetPositionId: string;
  instruksi: string;
  parentDispositionId: string | null;
  status: DispositionStatus;
  allowDownload: boolean;
  approvalQrCode: string;
  createdAt: string;
  deadlineAt?: string | null;
  readAt?: string | null;
  readByUserId?: string | null;
  urgent: boolean;
  bypass: boolean;
  routingType?: DispositionRoutingType;
  followUpNote?: string;
  followUpFileName?: string;
  whatsappDeliveries?: WhatsAppDelivery[];
}

export interface SearchResult {
  id: string;
  type: "surat" | "disposisi" | "pengguna";
  title: string;
  excerpt: string;
  href: string;
  keywords: string[];
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
}

export interface OperationalSummaryItem {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
}

export interface AIGlobalConfig {
  enabled: boolean;
  modelId: AIModelId;
  primaryLanguage: AILanguage;
  providerId: AIProviderId;
  activeConnectionId?: string | null;
  providers: AIProviderConfig[];
  moduleConfigs: AIModuleConfig[];
  featureFlags: AIFeatureFlags;
  featureDispositionAi: boolean;
  featureMailIntelligence: boolean;
  featureDraftMetadata: boolean;
  featureManajemenSuratAi: boolean;
  featureDisposisiAi: boolean;
}

export interface AIModuleConfig {
  moduleKey: AIModuleKey | string;
  label: string;
  description?: string;
  enabled: boolean;
  inheritGlobal: boolean;
  providerId: AIProviderId;
  modelId: AIModelId;
  activeConnectionId?: string | null;
  activeConnectionLabel?: string | null;
  activeConnectionStatus?: AIConnectionStatus;
  configuredProviderId?: AIProviderId | null;
  configuredModelId?: AIModelId | null;
  configuredConnectionId?: string | null;
  fallbackProviderId?: AIProviderId;
  fallbackModelId?: AIModelId;
  fallbackConnectionId?: string | null;
  status: AIModuleConfigStatus;
  fallbackReason?: string;
  updatedAt?: string | null;
}

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  apiKey: string;
  maskedApiKey?: string;
  providerId?: AIProviderId;
  providerName?: string;
  modelId?: AIModelId;
  endpointUrl?: string;
  models: string[];
  connectionStatus?: AIConnectionStatus;
  builtin?: boolean;
  lastTestedAt?: string;
  lastConnectionMessage?: string;
  isActive?: boolean;
}

export interface WhatsAppWebConfig {
  phoneNumber: string;
  sessionName: string;
  status: WhatsAppWebConnectionStatus;
  lastConnectedAt?: string;
}

export interface InstitutionIdentity {
  courtName: string;
  courtShortName: string;
  address: string;
  phoneNumber: string;
  mobilePhone: string;
  csWhatsappNumber?: string;
  botWhatsappNumber?: string;
  email: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  website?: string;
  mapUrl?: string;
  logoUrl?: string;
}

export interface InstitutionIdentityEnrichmentMetadata {
  courtId: string;
  courtName: string;
  query?: string;
  confidence?: InstitutionIdentityEnrichmentConfidence;
  sources?: Array<{
    type: InstitutionIdentityEnrichmentSourceType;
    label: string;
    url?: string;
  }>;
  fieldsFound?: Array<keyof InstitutionIdentity>;
  fieldsMissing?: Array<keyof InstitutionIdentity>;
  warnings?: string[];
  sourceOfficialWebsite?: string;
  sourceGooglePlace?: string;
  sourceGoogleSearch?: string;
  lastEnrichedAt?: string;
  enrichmentStatus: InstitutionIdentityEnrichmentStatus;
  fieldSources?: Partial<Record<keyof InstitutionIdentity, InstitutionIdentityEnrichmentSourceType>>;
  fieldConfidence?: Partial<Record<keyof InstitutionIdentity, number>>;
  fromCache?: boolean;
  lastErrorMessage?: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  source: RegulationSource;
  jurisdiction: string;
  moduleIds: string[];
  keywords: string[];
  summary: string;
  citation: string;
  recommendedPositionIds?: string[];
}

export interface UniversalAIContext {
  moduleId: string;
  entityType: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, string | number | boolean | string[] | undefined>;
}

export interface AIRecommendedAction {
  id: string;
  type: AIRecommendationType;
  label: string;
  description: string;
  targetPositionIds?: string[];
}

export interface AletaAIInsight {
  summary: string;
  keyPoints: string[];
  regulations: KnowledgeBaseEntry[];
  actions: AIRecommendedAction[];
  rationale: string;
}

export type MailIntelligencePriorityLevel = "low" | "medium" | "high" | "urgent";
export type MailIntelligenceConfidenceLevel = "low" | "medium" | "high";
export type MailIntelligenceSource = "ai-live" | "heuristic" | "disabled" | "error";

export interface MailIntelligenceProviderMeta {
  connectionId: string | null;
  providerId: string;
  providerName: string;
  modelId: string;
  providerModelId: string;
  connectionLabel: string | null;
  connectionStatus: AIConnectionStatus;
  language: AILanguage;
  hasActiveApiKey: boolean;
  isLive: boolean;
}

export interface MailIntelligenceFollowUp {
  id: string;
  label: string;
  detail: string;
}

export interface MailIntelligencePayload {
  source: MailIntelligenceSource;
  provider: MailIntelligenceProviderMeta;
  summary: string;
  keyFindings: string[];
  priority: {
    level: MailIntelligencePriorityLevel;
    reason: string;
  };
  followUpSuggestions: MailIntelligenceFollowUp[];
  regulations: KnowledgeBaseEntry[];
  suggestedPositionIds: string[];
  suggestedPositionLabels: string[];
  verificationChecklist: string[];
  confidence: {
    score: number;
    level: MailIntelligenceConfidenceLevel;
    label: string;
  };
  rationale: string;
  message: string | null;
  generatedAt: string;
}

export type DispositionSuggestionSource = MailIntelligenceSource;
export type DispositionSuggestionPriorityLevel = MailIntelligencePriorityLevel;
export type DispositionSuggestionConfidenceLevel = MailIntelligenceConfidenceLevel;
export type DispositionSuggestionProviderMeta = MailIntelligenceProviderMeta;

export interface DispositionSuggestionFollowUp {
  id: string;
  label: string;
  detail: string;
}

export interface DispositionSuggestionAutofill {
  suggestedInstruction: string;
  suggestedTargetPositionId: string | null;
  suggestedTargetLabel: string;
  allowDownload: boolean | null;
  urgent: boolean | null;
}

export interface DispositionSuggestionPayload {
  source: DispositionSuggestionSource;
  provider: DispositionSuggestionProviderMeta;
  summary: string;
  keyFindings: string[];
  priority: {
    level: DispositionSuggestionPriorityLevel;
    reason: string;
  };
  suggestedInstruction: string;
  suggestedTargetPositionId: string | null;
  suggestedTargetLabel: string;
  autofill: DispositionSuggestionAutofill;
  followUpSuggestions: DispositionSuggestionFollowUp[];
  verificationChecklist: string[];
  regulations: KnowledgeBaseEntry[];
  confidence: {
    score: number;
    level: DispositionSuggestionConfidenceLevel;
    label: string;
  };
  rationale: string;
  message: string | null;
  generatedAt: string;
}

export interface PortalStateData {
  currentUserId: string | null;
  roles: Role[];
  users: UserPersona[];
  positions: Position[];
  letters: LetterDetail[];
  dispositions: DispositionNode[];
  moduleVisibility: ModuleVisibility[];
  theme: ThemeMode;
  aiConfig: AIGlobalConfig;
  whatsAppWeb: WhatsAppWebConfig;
  institutionIdentity: InstitutionIdentity;
  panelSettings: PanelSettings;
  assistantJudgeConfig: AssistantJudgeConfig;
}
