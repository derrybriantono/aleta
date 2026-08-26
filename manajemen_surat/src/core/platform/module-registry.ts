export type HybridModuleDefinition = {
  id: string;
  label: string;
  description: string;
  routePrefix: string;
  scope: "core" | "business";
  sharedUtilities: string[];
  intelligenceReady: boolean;
};

export const hybridModuleRegistry: HybridModuleDefinition[] = [
  {
    id: "manajemen-surat",
    label: "Manajemen Surat",
    description: "Sub-modul persuratan dengan registrasi, viewer, disposisi, dan monitoring notifikasi.",
    routePrefix: "/surat",
    scope: "business",
    sharedUtilities: ["organization-service", "aleta-intelligence-service", "notification-gateway"],
    intelligenceReady: true,
  },
  {
    id: "sop",
    label: "SOP",
    description: "Ruang prosedur kerja yang siap memakai AI dan knowledge base regulasi yang sama.",
    routePrefix: "/apps/perpustakaan",
    scope: "business",
    sharedUtilities: ["knowledge-base", "aleta-intelligence-service"],
    intelligenceReady: true,
  },
  {
    id: "akun",
    label: "Akun",
    description: "Pengelolaan identitas, jabatan, dan lifecycle akun secara terpusat.",
    routePrefix: "/admin/mapping-user-jabatan",
    scope: "core",
    sharedUtilities: ["organization-service", "audit-policy"],
    intelligenceReady: false,
  },
  {
    id: "dashboard",
    label: "Dashboard ALETA",
    description: "Hub utama ALETA yang menggabungkan kartu pintar, direktori instansi, dan kontrol global.",
    routePrefix: "/portal",
    scope: "core",
    sharedUtilities: ["module-registry", "organization-service", "aleta-intelligence-service"],
    intelligenceReady: true,
  },
  {
    id: "aleta-bot",
    label: "ALETA Bot",
    description: "Modul internal WhatsApp bot untuk notifikasi perkara, template pesan, query, log, dan manual test.",
    routePrefix: "/admin/aleta-bot",
    scope: "business",
    sharedUtilities: ["notification-gateway", "whatsapp-gateway", "audit-policy"],
    intelligenceReady: false,
  },
  {
    id: "judicia-legal-form",
    label: "ALETA Judicia (Legal Form)",
    description: "Modul Legal Form untuk dokumen perkara, template, variabel, SIPP read-only, dan workflow validasi.",
    routePrefix: "/judicia/legal-form",
    scope: "business",
    sharedUtilities: [
      "organization-service",
      "aleta-intelligence-service",
      "notification-gateway",
      "audit-policy",
    ],
    intelligenceReady: true,
  },
  {
    id: "aleta-sipp",
    label: "ALETA x SIPP",
    description: "Pusat pengetahuan SIPP untuk kamus tabel/kolom, query registry, variabel ABT/SIPP, penilaian, dan jadwal sidang.",
    routePrefix: "/aleta-sipp",
    scope: "business",
    sharedUtilities: [
      "organization-service",
      "aleta-intelligence-service",
      "audit-policy",
      "sipp-readonly-provider",
      "notification-gateway",
    ],
    intelligenceReady: true,
  },
  {
    id: "e-status",
    label: "E-Status",
    description: "Elektronik Sinkronisasi Status Perkawinan untuk validasi, batch, pengiriman, dan tracking data status perkawinan.",
    routePrefix: "/e-status",
    scope: "business",
    sharedUtilities: [
      "organization-service",
      "notification-gateway",
      "whatsapp-gateway",
      "audit-policy",
      "sipp-readonly-provider",
    ],
    intelligenceReady: true,
  },
];

export function getHybridModuleDefinition(moduleId: string) {
  return hybridModuleRegistry.find((module) => module.id === moduleId) ?? null;
}
