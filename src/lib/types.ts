export type RoleId =
  | "super-admin"
  | "admin"
  | "ketua"
  | "wakil-ketua"
  | "hakim"
  | "sekretaris"
  | "panitera"
  | "pejabat-struktural"
  | "staf";

export type ModuleId =
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
  | "keuangan"
  | "aset"
  | "identity"
  | "notifikasi"
  | "ai-settings"
  | "admin-hub"
  | "whatsapp-settings";

export type PortalAppId =
  | "manajemen-surat"
  | "e-kepegawaian"
  | "e-keuangan"
  | "manajemen-aset"
  | "perpustakaan"
  | "audit-trail"
  | "gateway-notifikasi";

export type ThemeMode = "light" | "dark";
export type WhatsAppDeliveryStatus = "Terkirim" | "Gagal";

export type LetterType = "masuk" | "keluar";
export type LetterStatus = "Baru" | "Dalam Disposisi" | "Ditindaklanjuti" | "Selesai";
export type DispositionStatus =
  | "Riwayat Awal Disposisi"
  | "Menunggu Telaah"
  | "Diteruskan"
  | "Sedang Dikerjakan"
  | "Selesai";
export type ActingAssignmentType = "PLH" | "PLT";
export type DispositionRoutingType = "standard" | "leadership-notification";
export type AIModelId = string;
export type AILanguage = "id" | "en";
export type RegulationSource = "internal" | "external";
export type AIRecommendationType = "routing" | "instruction" | "regulation";
export type AIProviderId = string;
export type AIConnectionStatus = "idle" | "connected" | "failed";
export type WhatsAppWebConnectionStatus = "active" | "inactive" | "failed";

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
  isActive: boolean;
  canBypassHierarchy?: boolean;
  actingAssignment?: ActingAssignment | null;
}

export interface WhatsAppDelivery {
  id: string;
  recipientName: string;
  recipientWhatsapp: string;
  status: WhatsAppDeliveryStatus;
  lastAttemptAt: string;
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
  providers: AIProviderConfig[];
}

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  apiKey: string;
  endpointUrl?: string;
  models: string[];
  connectionStatus?: AIConnectionStatus;
  builtin?: boolean;
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
  email: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  website?: string;
  mapUrl?: string;
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

export interface PortalStateData {
  currentUserId: string | null;
  users: UserPersona[];
  letters: LetterDetail[];
  dispositions: DispositionNode[];
  moduleVisibility: ModuleVisibility[];
  theme: ThemeMode;
  aiConfig: AIGlobalConfig;
  whatsAppWeb: WhatsAppWebConfig;
  institutionIdentity: InstitutionIdentity;
}
