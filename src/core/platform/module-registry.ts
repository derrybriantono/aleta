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
];

export function getHybridModuleDefinition(moduleId: string) {
  return hybridModuleRegistry.find((module) => module.id === moduleId) ?? null;
}
