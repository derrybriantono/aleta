export const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
  enabled: "Aktif",
  disabled: "Tidak Aktif",
  connected: "Terhubung",
  disconnected: "Tidak Terhubung",
  initializing: "Menyiapkan Koneksi",
  waiting_qr: "Perlu Pindai QR",
  qr_needed: "Perlu Pindai QR",
  qr: "Perlu Pindai QR",
  authenticated: "Tersambung",
  ready: "Siap",
  failed: "Gagal",
  success: "Berhasil",
  error: "Bermasalah",
  warning: "Perlu Perhatian",
  browser_locked: "WhatsApp sedang dipakai proses lain",
  pending: "Menunggu",
  processing: "Diproses",
  sent: "Terkirim",
  skipped: "Dilewati",
  resolved: "Sudah Ditangani",
  completed: "Selesai",
  blocked: "Diblokir",
  paused: "Dijeda",
  running: "Berjalan",
  stopped: "Berhenti",
  idle: "Belum Berjalan",
  synced: "Tersinkron",
  needs_sync: "Perlu Diperbarui",
  dry_run: "Simulasi",
  "dry-run": "Simulasi",
  pilot: "Pilot",
  production: "Aktif Operasional",
  simulated: "Simulasi",
  pending_approval: "Menunggu Persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
  manual_dry_run: "Simulasi Manual",
  scheduler_dry_run: "Simulasi Penjadwal",
  scheduler_blocked: "Penjadwal Ditahan",
  manual_controlled: "Dijalankan Manual",
  active_registry: "Aktif di Daftar Pengiriman",
  legacy_disabled: "Jalur Lama Dinonaktifkan",
  registry_draft: "Draft Daftar Pengiriman",
  needs_manual_mapping: "Perlu Dicocokkan Manual",
  fallback: "Perlu Tinjauan",
  needs_more_info: "Butuh Informasi Tambahan",
  reviewed: "Sudah Ditinjau",
  ignored: "Diabaikan",
  converted_to_intent: "Sudah Dijadikan Kebutuhan",
  unknown: "Tidak Diketahui",
  online: "Online",
  offline: "Offline",
};

export function humanizeStatus(value: string | null | undefined, fallback = "Tidak Diketahui") {
  if (!value) return fallback;
  return STATUS_LABELS[value] ?? value;
}

export function humanizeErrorMessage(message: string | null | undefined, fallback = "Terjadi kendala. Silakan coba lagi.") {
  const normalized = (message ?? "").trim();
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();
  if (lower === "unauthorized") return "Anda belum login atau sesi Anda telah berakhir.";
  if (lower === "forbidden") return "Anda tidak memiliki izin untuk membuka halaman ini.";
  if (lower.includes("invalid payload")) return "Data yang dikirim belum lengkap atau tidak sesuai.";
  if (lower.includes("entity not found")) return "Data tidak ditemukan.";
  if (lower.includes("unexpected error")) return fallback;
  if (lower.includes("browser_locked")) return STATUS_LABELS.browser_locked;
  if (lower.includes("safe sending window")) return "Saat ini berada di luar jam aman pengiriman.";

  return normalized;
}
