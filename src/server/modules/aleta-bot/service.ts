import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type AletaBotJob,
  type AletaBotEmployeeRecipient,
  type AletaBotLogEntry,
  type AletaBotLogLevel,
  type AletaBotLogType,
  type AletaBotNotification,
  type AletaBotNotificationCategory,
  type AletaBotNotificationLogEntry,
  type AletaBotQuery,
  type AletaBotQueryCatalogItem,
  type AletaBotQueryCategory,
  type AletaBotRuntimeState,
  type AletaBotSettings,
  type AletaBotSnapshot,
  type AletaBotTemplate,
} from "@/lib/aleta-bot-types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getWhatsAppSettingsFromDb } from "@/server/modules/settings/service";
import { whatsappService } from "@/server/modules/whatsapp/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

type SettingsRow = {
  bot_enabled: number;
  notifications_enabled: number;
  admin_whatsapp_number: string;
  message_delay_ms: number;
  retry_limit: number;
  dry_run_enabled: number;
  schedule_cron: string;
  test_target_number: string;
  security_notes: string;
  updated_at: string;
};

type TemplateRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  placeholders_json: string;
  editable: number;
  updated_at: string;
};

type JobRow = {
  id: string;
  name: string;
  description: string;
  enabled: number;
  schedule_cron: string;
  last_run_at: string | null;
  last_status: AletaBotJob["lastStatus"];
  last_message: string | null;
  updated_at: string;
};

type QueryRow = {
  id: string;
  name: string;
  category: AletaBotQueryCategory;
  description: string;
  sql_text: string;
  output_columns_json: string;
  recipient_column: string;
  is_active: number;
  last_tested_at: string | null;
  last_test_status: AletaBotQuery["lastTestStatus"];
  last_test_error: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  name: string;
  category: AletaBotNotificationCategory;
  description: string;
  query_id: string;
  template_id: string;
  recipient_source: AletaBotNotification["recipientSource"];
  recipient_mapping_json: string;
  schedule_config_json: string;
  is_active: number;
  delay_ms: number;
  retry_limit: number;
  last_run_at: string | null;
  last_status: AletaBotNotification["lastStatus"];
  last_message: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type EmployeeRecipientRow = {
  id: string;
  username: string;
  name: string;
  role_id: string;
  position_id: string;
  position_name: string | null;
  whatsapp_number: string;
};

type NotificationLogRow = {
  id: string;
  notification_id: string | null;
  query_id: string | null;
  recipient_number: string;
  recipient_name: string;
  category: AletaBotNotificationLogEntry["category"];
  message_preview: string;
  status: AletaBotNotificationLogEntry["status"];
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

type LogRow = {
  id: string;
  level: AletaBotLogLevel;
  event_type: AletaBotLogType;
  message: string;
  metadata_json: string;
  actor_user_id: string | null;
  created_at: string;
};

const DEFAULT_SETTINGS: Omit<AletaBotSettings, "updatedAt"> = {
  botEnabled: false,
  notificationsEnabled: false,
  adminWhatsappNumber: "",
  messageDelayMs: 1500,
  retryLimit: 2,
  dryRunEnabled: true,
  scheduleCron: "00 07 * * Monday-Friday",
  testTargetNumber: "",
  securityNotes: "Modul ALETA Bot hanya aktif untuk Super Admin. Gunakan dry-run sebelum pengiriman produksi.",
};

const DEFAULT_TEMPLATES: Array<Omit<AletaBotTemplate, "updatedAt">> = [
  {
    id: "perkara-baru",
    category: "notifikasi",
    title: "Notifikasi Perkara Baru",
    body:
      "Assalamu'alaikum.\n\nHalo, saya ALETA Bot. Perkara {{nomor_perkara}} atas nama {{nama_pihak}} telah terdaftar dengan agenda {{agenda}}.\n\nPesan ini adalah notifikasi otomatis.",
    placeholders: ["nomor_perkara", "nama_pihak", "agenda"],
    editable: true,
  },
  {
    id: "jadwal-sidang",
    category: "notifikasi",
    title: "Notifikasi Jadwal Sidang",
    body:
      "Assalamu'alaikum.\n\nPerkara {{nomor_perkara}} dijadwalkan sidang pada {{hari_sidang}}, {{tanggal_sidang}} di ruang {{ruangan}} dengan agenda {{agenda}}.",
    placeholders: ["nomor_perkara", "hari_sidang", "tanggal_sidang", "ruangan", "agenda"],
    editable: true,
  },
  {
    id: "akta-cerai",
    category: "notifikasi",
    title: "Notifikasi Akta Cerai",
    body:
      "Akta cerai untuk perkara {{nomor_perkara}} telah tersedia. Silakan mengikuti prosedur pengambilan pada layanan PTSP.",
    placeholders: ["nomor_perkara"],
    editable: true,
  },
  {
    id: "sisa-panjar",
    category: "notifikasi",
    title: "Notifikasi Sisa Panjar",
    body:
      "Informasi biaya perkara {{nomor_perkara}}: sisa panjar saat ini {{sisa_panjar}}. Mohon hubungi petugas bila memerlukan rincian.",
    placeholders: ["nomor_perkara", "sisa_panjar"],
    editable: true,
  },
  {
    id: "balasan-otomatis",
    category: "balasan",
    title: "Balasan Otomatis",
    body:
      "Halo, saya ALETA Bot. Ketik info lengkap, perkara, sidang hari ini, atau akta#nomor perkara untuk layanan informasi.",
    placeholders: [],
    editable: true,
  },
  {
    id: "fallback-error",
    category: "error",
    title: "Fallback Error",
    body: "Maaf, ALETA Bot belum dapat memproses permintaan tersebut. Silakan coba beberapa saat lagi.",
    placeholders: [],
    editable: true,
  },
  {
    id: "admin-test",
    category: "admin",
    title: "Pesan Admin Test",
    body: "Tes ALETA Bot berhasil pada {{waktu}}. Mode: {{mode}}.",
    placeholders: ["waktu", "mode"],
    editable: true,
  },
  {
    id: "pegawai-monitoring",
    category: "pegawai",
    title: "Notifikasi Pegawai / Monitoring",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n\n{{ringkasan}}\n\nSumber: ALETA Bot.",
    placeholders: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-layanan",
    category: "pihak",
    title: "Notifikasi Pihak / Layanan Perkara",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nPesan otomatis ALETA Bot.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
];

const DEFAULT_JOBS: Array<Omit<AletaBotJob, "lastRunAt" | "lastStatus" | "lastMessage" | "updatedAt">> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    description: "Diambil dari app.js sendKetuaPenerimaanPerkara dan notifikasi.getTotalPenerimaanPerkaraSemuaHakimLengkap.",
    enabled: false,
    scheduleCron: "50 07 1 * *",
  },
  {
    id: "panitera-bulanan",
    name: "Rekap Panitera Bulanan",
    description: "Diambil dari app.js sendPanitera dan kumpulan query BAS, relaas, PBT, minutasi, e-court, dan publikasi.",
    enabled: false,
    scheduleCron: "50 07 1 * *",
  },
  {
    id: "penjaga-sidang-hari-ini",
    name: "Penjaga Sidang Hari Ini",
    description: "Diambil dari app.js sendPenjagaSidangHariIni dan notifikasi.getDataJadwalSidangPerdata.",
    enabled: false,
    scheduleCron: "10 07 * * Monday-Friday",
  },
  {
    id: "penjaga-sidang-besok",
    name: "Penjaga Sidang Besok",
    description: "Diambil dari app.js sendPenjagaSidangBesok dan notifikasi.getDataJadwalBesok.",
    enabled: false,
    scheduleCron: "00 20 * * *",
  },
  {
    id: "kasir-harian",
    name: "Pengingat Kasir Harian",
    description: "Diambil dari app.js sendPengingatKasir untuk pengingat sisa panjar dan layanan kasir.",
    enabled: false,
    scheduleCron: "30 14 * * Monday-Thursday",
  },
  {
    id: "pihak-hari-sidang",
    name: "Notifikasi Pihak Hari Sidang",
    description: "Diambil dari app.js sendMessageHariSidang dan notifikasi.getDataPihakHariSidang.",
    enabled: false,
    scheduleCron: "00 07 * * *",
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Notifikasi Pihak Sebelum Sidang",
    description: "Diambil dari app.js sendMessageSebelumHariSidang dan notifikasi.getDataPihakSebelumHariSidang.",
    enabled: false,
    scheduleCron: "00 09 * * *",
  },
];

const DEFAULT_QUERIES: Array<
  Omit<
    AletaBotQuery,
    "usedByNotifications" | "lastTestedAt" | "lastTestStatus" | "lastTestError" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
  >
> = [
  {
    id: "legacy-ketua-penerimaan-perkara",
    name: "legacy.notifikasi.ketuaPenerimaanPerkara",
    category: "employee",
    description: "Gabungan getTotalPenerimaanPerkaraSemuaHakimLengkap, Mediasi, Panitera, dan Jurusita dari app.js.",
    sqlText:
      "legacy:notifikasi.getTotalPenerimaanPerkaraSemuaHakimLengkap,getTotalPenerimaanMediasiSemuaHakim,getTotalPenerimaanPerkaraSemuaPanitera,getTotalPenerimaanPerkaraSemuaJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-panitera-monitoring-bulanan",
    name: "legacy.notifikasi.paniteraMonitoringBulanan",
    category: "employee",
    description: "Monitoring BAS, minutasi, BHT, relaas, panjar, delegasi, e-doc, dan perkara tertunda untuk Panitera.",
    sqlText:
      "legacy:notifikasi.getDataBA,getDataPutusanBelumMinut,getDataBelumBhtPerdata,getDataBelumSerahHukum,getDataSaksiTidakLengkap,getDataSisaPanjarPn,getDataSisaPanjarBanding,getDataSisaPanjarKasasi,getStatistikDetail,getBelumPanggilan,getDataBanding,getDataKasasi,getDataPK,getDataEdocPetitum,getDataEdocAnonimisasi,getDataBelumDelegasi,getDataVerstek,getDataTundaMediasi",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-jadwal-sidang-internal",
    name: "legacy.notifikasi.jadwalSidangInternal",
    category: "employee",
    description: "Jadwal sidang dan mediasi hari ini/besok untuk penjaga sidang, hakim, dan panitera.",
    sqlText:
      "legacy:notifikasi.getDataJadwalSidangPerdata,getDataJadwalMediasi,getDataJadwalBesok,getDataJadwalMediasiBesok,getDataJadwalSidangPerdataHakim,getDataJadwalBesokHakim,getDataJadwalSidangPerdataPanitera,getDataJadwalBesokPaniteraNew",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "tanggal_sidang", "agenda"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-kasir-panjar",
    name: "legacy.notifikasi.kasirPanjar",
    category: "employee",
    description: "Pengingat sisa panjar, meterai/redaksi, dan penetapan untuk kasir/PTSP.",
    sqlText: "legacy:notifikasi.getDataSisaPanjarPn,getDataMeteraiRedaksiPsp,getDataDaftarPenetapan",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara", "sisa_panjar"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-status-sidang-pegawai",
    name: "legacy.notifikasi.statusSidangPegawai",
    category: "employee",
    description: "Status minutasi, upload putusan, antrian sidang, relaas, delegasi, dan panggilan untuk Hakim/Panitera/Jurusita.",
    sqlText:
      "legacy:notifikasi.getDataPutusanBelumMinutHakim,getDataUploadPutusanHakim,getDataLupaTundaHakim,getDataPutusanBelumMinutPanitera,getDataTundaMediasiPanitera,getDataAntrianSidangHakim,getDataAntrianSidangPanitera,getDataPutusJurusitaNew,getDataTundaJurusitaNew,getBelumPanggilanJurusita,getDataBelumDelegasiJurusita,getDataPemberitahuanPutusanBelumJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-pihak-baru",
    name: "legacy.notifikasi.pihakBaru",
    category: "party",
    description: "Data pihak, kuasa, turut tergugat, dan intervensi untuk notifikasi perkara baru.",
    sqlText: "legacy:notifikasi.getDataPihakBaru",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp", "perkara_id"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-hari-sidang",
    name: "legacy.notifikasi.pihakHariSidang",
    category: "party",
    description: "Pengingat hari sidang untuk pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPihakHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sebelum-sidang",
    name: "legacy.notifikasi.pihakSebelumHariSidang",
    category: "party",
    description: "Pengingat sebelum hari sidang untuk pihak perkara.",
    sqlText: "legacy:notifikasi.getDataPihakSebelumHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-tunda-cuti",
    name: "legacy.notifikasi.pihakTundaCuti",
    category: "party",
    description: "Notifikasi penundaan sidang/cuti.",
    sqlText: "legacy:notifikasi.getDataPihakTundaCuti",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-akta-cerai",
    name: "legacy.notifikasi.pihakAktaCerai",
    category: "party",
    description: "Notifikasi akta cerai untuk Penggugat/Pemohon dan Tergugat/Termohon.",
    sqlText: "legacy:notifikasi.getDataPihakAktaCerai",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sisa-panjar",
    name: "legacy.notifikasi.pihakSisaPanjar",
    category: "party",
    description: "Notifikasi sisa panjar atau kekurangan biaya perkara.",
    sqlText: "legacy:notifikasi.getDataPihakSisaPanjar,getDataHabisBiaya",
    outputColumns: ["nama_pihak", "nomor_perkara", "sisa_panjar", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-putusan",
    name: "legacy.notifikasi.pihakPutusan",
    category: "party",
    description: "Notifikasi putusan kepada pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPutusanPihak",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-query-command-router",
    name: "legacy.query.commandRouter",
    category: "system",
    description: "Router command chat publik dari query.js, dipakai untuk balasan otomatis.",
    sqlText: "legacy:query.getData",
    outputColumns: ["command", "nomor_perkara", "response_text"],
    recipientColumn: "",
    isActive: true,
  },
];

const DEFAULT_NOTIFICATIONS: Array<
  Omit<AletaBotNotification, "lastRunAt" | "lastStatus" | "lastMessage" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">
> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    category: "employee",
    description: "Notifikasi internal Ketua dari sendKetuaPenerimaanPerkara pada app.js.",
    queryId: "legacy-ketua-penerimaan-perkara",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["ketua"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "50 07 1 * *", trigger: "cron bulanan" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-monitoring-bulanan",
    name: "Monitoring Bulanan Panitera",
    category: "employee",
    description: "Rekap BAS, minutasi, BHT, relaas, panjar, delegasi, dan e-doc untuk Panitera.",
    queryId: "legacy-panitera-monitoring-bulanan",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "50 07 1 * *", trigger: "cron bulanan" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "penjaga-sidang-hari-ini",
    name: "Penjaga Sidang Hari Ini",
    category: "employee",
    description: "Jadwal sidang/mediasi hari ini dan panggilan belum lengkap untuk petugas sidang.",
    queryId: "legacy-jadwal-sidang-internal",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "10 07 * * Monday-Friday", trigger: "cron pagi hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "penjaga-sidang-besok",
    name: "Penjaga Sidang Besok",
    category: "employee",
    description: "Jadwal sidang dan mediasi besok untuk petugas sidang.",
    queryId: "legacy-jadwal-sidang-internal",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 20 * * *", trigger: "cron malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "kasir-harian",
    name: "Pengingat Kasir Harian",
    category: "employee",
    description: "Pengingat sisa panjar, meterai/redaksi, dan penetapan untuk kasir/PTSP.",
    queryId: "legacy-kasir-panjar",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { positionHints: ["kasir", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "30 14 * * Monday-Thursday", trigger: "cron siang" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "hakim-jadwal-sidang",
    name: "Pengingat Hakim",
    category: "employee",
    description: "Jadwal sidang/mediasi dan status minutasi/upload putusan untuk Hakim.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["hakim"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "15 07 * * Monday-Friday; 00 20 * * Sunday-Thursday", trigger: "cron pagi dan malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-jadwal-sidang",
    name: "Pengingat Panitera Sidang",
    category: "employee",
    description: "Jadwal sidang, tunda mediasi, BAS, dan minutasi untuk Panitera/Panitera Pengganti.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 07 * * Monday-Friday; 00 20 * * *", trigger: "cron pagi dan malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "jurusita-status-relaas",
    name: "Status Sidang dan Relaas Jurusita",
    category: "employee",
    description: "Status putus/tunda, panggilan, delegasi, dan pemberitahuan putusan untuk Jurusita.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["jurusita"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 12 * * Monday-Friday; 15 16 * * Monday-Friday; 00 09 * * Friday", trigger: "cron status dan relaas" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-baru",
    name: "Notifikasi Perkara Baru",
    category: "party",
    description: "Notifikasi pendaftaran perkara untuk pihak, kuasa, turut tergugat, dan intervensi.",
    queryId: "legacy-pihak-baru",
    templateId: "perkara-baru",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 17 * * Monday-Friday", trigger: "cron sore hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-hari-sidang",
    name: "Notifikasi Pihak Hari Sidang",
    category: "party",
    description: "Pengingat kepada pihak perkara pada hari sidang.",
    queryId: "legacy-pihak-hari-sidang",
    templateId: "jadwal-sidang",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 07 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Notifikasi Pihak Sebelum Sidang",
    category: "party",
    description: "Pengingat kepada pihak perkara sebelum jadwal sidang.",
    queryId: "legacy-pihak-sebelum-sidang",
    templateId: "jadwal-sidang",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 09 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-tunda-cuti",
    name: "Notifikasi Tunda/Cuti",
    category: "party",
    description: "Notifikasi penundaan sidang karena cuti atau jadwal khusus.",
    queryId: "legacy-pihak-tunda-cuti",
    templateId: "pihak-layanan",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 12 24 11 *", trigger: "cron khusus" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-akta-cerai",
    name: "Notifikasi Akta Cerai",
    category: "party",
    description: "Informasi akta cerai untuk pihak terkait.",
    queryId: "legacy-pihak-akta-cerai",
    templateId: "akta-cerai",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 16 * * *", trigger: "cron sore" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sisa-panjar",
    name: "Notifikasi Sisa Panjar/Biaya",
    category: "party",
    description: "Informasi sisa panjar atau biaya perkara kepada pihak.",
    queryId: "legacy-pihak-sisa-panjar",
    templateId: "sisa-panjar",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 19 * * *; 30 15 * * *", trigger: "cron sore" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-putusan",
    name: "Notifikasi Putusan",
    category: "party",
    description: "Informasi putusan kepada pihak, kuasa, turut tergugat, dan intervensi.",
    queryId: "legacy-pihak-putusan",
    templateId: "pihak-layanan",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "manual", cron: "", trigger: "manual/legacy app.js" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
];

export const ALETA_BOT_QUERY_CATALOG: AletaBotQueryCatalogItem[] = [
  {
    id: "query-get-data",
    sourceFile: "query.js",
    exportName: "getData",
    category: "balasan otomatis",
    description: "Router utama command chat: info lengkap, perkara, sidang, statistik, validasi, dan layanan publik.",
    riskLevel: "medium",
    testable: false,
  },
  {
    id: "notif-jadwal-sidang-perdata",
    sourceFile: "notifikasi.js",
    exportName: "getDataJadwalSidangPerdata",
    category: "jadwal sidang",
    description: "Mengambil jadwal sidang perdata untuk notifikasi harian internal.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-jadwal-besok",
    sourceFile: "notifikasi.js",
    exportName: "getDataJadwalBesok",
    category: "jadwal sidang",
    description: "Mengambil jadwal sidang besok untuk pengingat malam.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-pihak-hari-sidang",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakHariSidang",
    category: "pihak perkara",
    description: "Mengambil pihak/kuasa/turut/intervensi yang terkait sidang hari ini.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-pihak-sebelum-sidang",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakSebelumHariSidang",
    category: "pihak perkara",
    description: "Mengambil pihak yang perlu menerima pengingat sebelum hari sidang.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-akta-cerai",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakAktaCerai",
    category: "akta cerai",
    description: "Mengambil data pihak untuk notifikasi akta cerai.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-sisa-panjar",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakSisaPanjar",
    category: "biaya perkara",
    description: "Mengambil data pihak untuk notifikasi sisa panjar biaya perkara.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "formatter-phone-number",
    sourceFile: "formatter.js",
    exportName: "phoneNumberFormatter",
    category: "formatter",
    description: "Normalisasi nomor WhatsApp ke format chat id whatsapp-web.js.",
    riskLevel: "low",
    testable: true,
  },
  {
    id: "whatsapp-admin-id",
    sourceFile: "whatsapp.js",
    exportName: "adminId",
    category: "koneksi WhatsApp",
    description: "Nomor admin bot. Kini di-override dari konfigurasi portal bila tersedia.",
    riskLevel: "medium",
    testable: true,
  },
];

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeWhatsappNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function assertWhatsappNumber(input: string, label = "Nomor WhatsApp") {
  const normalized = normalizeWhatsappNumber(input);
  if (!/^62\d{8,15}$/.test(normalized)) {
    throw new ApiError(400, `${label} harus memakai format nomor Indonesia yang valid, contoh 628123456789.`);
  }
  return normalized;
}

function validateCronLike(input: string) {
  const value = input.trim();
  const parts = value.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new ApiError(400, "Format jadwal/cron tidak valid. Gunakan 5 atau 6 bagian cron.");
  }
  return value;
}

function validateScheduleConfig(input: AletaBotNotification["scheduleConfig"]) {
  const type = input.type === "event" || input.type === "manual" || input.type === "cron" ? input.type : "manual";
  const cron = String(input.cron ?? "").trim();
  if (type === "cron" && cron) {
    validateCronLike(cron.split(";")[0] ?? cron);
  }
  return {
    type,
    cron: cron.slice(0, 160),
    trigger: String(input.trigger ?? "").trim().slice(0, 160),
  };
}

function parseColumns(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTemplatePlaceholders(body: string) {
  return Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
}

function validateReadOnlyQuery(sqlText: string) {
  const trimmed = sqlText.trim();
  if (!trimmed) {
    throw new ApiError(400, "SQL/query tidak boleh kosong.");
  }
  if (trimmed.startsWith("legacy:")) return trimmed;

  const normalized = trimmed.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  if (!/^select\b/i.test(normalized)) {
    throw new ApiError(400, "Query dari UI hanya boleh berupa SELECT atau referensi legacy:.");
  }
  if (/\b(delete|drop|truncate|update|insert|alter|create|grant|revoke|execute|copy)\b/i.test(normalized)) {
    throw new ApiError(400, "Query mengandung perintah berbahaya dan diblokir.");
  }
  return trimmed;
}

function makeSampleRow(columns: string[]) {
  const sample: Record<string, string> = {};
  for (const column of columns) {
    if (/nomor|telepon|whatsapp|hp/i.test(column)) sample[column] = "628123456789";
    else if (/tanggal/i.test(column)) sample[column] = "27-04-2026";
    else if (/nama.*pegawai/i.test(column)) sample[column] = "Contoh Pegawai";
    else if (/nama/i.test(column)) sample[column] = "Contoh Pihak";
    else if (/perkara/i.test(column)) sample[column] = "123/Pdt.G/2026/PA.Dgl";
    else if (/panjar|biaya/i.test(column)) sample[column] = "Rp125.000";
    else sample[column] = `contoh_${column}`;
  }
  return sample;
}

function summarizeQueryPreview(query: AletaBotQuery) {
  const sampleRows = Array.from({ length: Math.min(2, 5) }, () => makeSampleRow(query.outputColumns));
  const hasRecipient = query.category !== "party" || Boolean(query.recipientColumn && query.outputColumns.includes(query.recipientColumn));
  return {
    columns: query.outputColumns,
    sampleRows,
    limit: 5,
    validForRecipient: hasRecipient,
    message: query.sqlText.startsWith("legacy:")
      ? "Referensi legacy tervalidasi. Eksekusi live SIPP diblokir dari portal; runtime lama tetap memakai fungsi legacy."
      : "Query SELECT tervalidasi untuk test terbatas. Preview dibatasi maksimal 5 baris.",
  };
}

function mapSettings(row: SettingsRow): AletaBotSettings {
  return {
    botEnabled: Boolean(row.bot_enabled),
    notificationsEnabled: Boolean(row.notifications_enabled),
    adminWhatsappNumber: row.admin_whatsapp_number,
    messageDelayMs: row.message_delay_ms,
    retryLimit: row.retry_limit,
    dryRunEnabled: Boolean(row.dry_run_enabled),
    scheduleCron: row.schedule_cron,
    testTargetNumber: row.test_target_number,
    securityNotes: row.security_notes,
    updatedAt: row.updated_at,
  };
}

function mapTemplate(row: TemplateRow): AletaBotTemplate {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    placeholders: parseJson<string[]>(row.placeholders_json, []),
    editable: Boolean(row.editable),
    updatedAt: row.updated_at,
  };
}

function mapJob(row: JobRow): AletaBotJob {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    scheduleCron: row.schedule_cron,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastMessage: row.last_message,
    updatedAt: row.updated_at,
  };
}

function mapQuery(row: QueryRow, usedByNotifications: string[] = []): AletaBotQuery {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    sqlText: row.sql_text,
    outputColumns: parseJson<string[]>(row.output_columns_json, []),
    recipientColumn: row.recipient_column,
    isActive: Boolean(row.is_active),
    usedByNotifications,
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastTestError: row.last_test_error,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow): AletaBotNotification {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    queryId: row.query_id,
    templateId: row.template_id,
    recipientSource: row.recipient_source,
    recipientMapping: parseJson<Record<string, unknown>>(row.recipient_mapping_json, {}),
    scheduleConfig: {
      ...parseJson<AletaBotNotification["scheduleConfig"]>(row.schedule_config_json, {
        type: "manual",
        cron: "",
        trigger: "",
      }),
    },
    isActive: Boolean(row.is_active),
    delayMs: row.delay_ms,
    retryLimit: row.retry_limit,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastMessage: row.last_message,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmployeeRecipient(row: EmployeeRecipientRow): AletaBotEmployeeRecipient {
  const whatsappNumber = normalizeWhatsappNumber(row.whatsapp_number);
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    roleId: row.role_id,
    positionId: row.position_id,
    positionName: row.position_name ?? "",
    whatsappNumber,
    whatsappChatId: whatsappNumber ? `${whatsappNumber}@c.us` : "",
  };
}

function mapNotificationLog(row: NotificationLogRow): AletaBotNotificationLogEntry {
  return {
    id: row.id,
    notificationId: row.notification_id,
    queryId: row.query_id,
    recipientNumber: row.recipient_number,
    recipientName: row.recipient_name,
    category: row.category,
    messagePreview: row.message_preview,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mapLog(row: LogRow): AletaBotLogEntry {
  return {
    id: row.id,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  };
}

async function requireSuperAdmin(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengakses modul ALETA Bot.");
  }

  return actor;
}

async function ensureAletaBotSeeded(db: AletaDatabase) {
  const now = new Date().toISOString();
  const settings = await db.prepare(`SELECT id FROM aleta_bot_settings WHERE id = 1`).get<{ id: number }>();
  if (!settings) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_settings (
          id, bot_enabled, notifications_enabled, admin_whatsapp_number, message_delay_ms,
          retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        DEFAULT_SETTINGS.botEnabled ? 1 : 0,
        DEFAULT_SETTINGS.notificationsEnabled ? 1 : 0,
        DEFAULT_SETTINGS.adminWhatsappNumber,
        DEFAULT_SETTINGS.messageDelayMs,
        DEFAULT_SETTINGS.retryLimit,
        DEFAULT_SETTINGS.dryRunEnabled ? 1 : 0,
        DEFAULT_SETTINGS.scheduleCron,
        DEFAULT_SETTINGS.testTargetNumber,
        DEFAULT_SETTINGS.securityNotes,
        now
      );
  }

  for (const template of DEFAULT_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_templates (id, category, title, body, placeholders_json, editable, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`
      )
      .run(
        template.id,
        template.category,
        template.title,
        template.body,
        JSON.stringify(template.placeholders),
        template.editable ? 1 : 0,
        now
      );
  }

  for (const job of DEFAULT_JOBS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_jobs (id, name, description, enabled, schedule_cron, last_status, updated_at)
         VALUES (?, ?, ?, ?, ?, 'idle', ?)
         ON CONFLICT (id) DO NOTHING`
      )
      .run(job.id, job.name, job.description, job.enabled ? 1 : 0, job.scheduleCron, now);
  }

  for (const query of DEFAULT_QUERIES) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_queries (
          id, name, category, description, sql_text, output_columns_json, recipient_column,
          is_active, last_test_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        query.id,
        query.name,
        query.category,
        query.description,
        query.sqlText,
        JSON.stringify(query.outputColumns),
        query.recipientColumn,
        query.isActive ? 1 : 0,
        now,
        now
      );
  }

  for (const notification of DEFAULT_NOTIFICATIONS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_notifications (
          id, name, category, description, query_id, template_id, recipient_source,
          recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
          last_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        notification.id,
        notification.name,
        notification.category,
        notification.description,
        notification.queryId,
        notification.templateId,
        notification.recipientSource,
        JSON.stringify(notification.recipientMapping),
        JSON.stringify(notification.scheduleConfig),
        notification.isActive ? 1 : 0,
        notification.delayMs,
        notification.retryLimit,
        now,
        now
      );
  }
}

async function appendAletaBotLog(
  db: AletaDatabase,
  input: {
    actorUserId?: string | null;
    level: AletaBotLogLevel;
    eventType: AletaBotLogType;
    message: string;
    metadata?: Record<string, unknown>;
  }
) {
  await db
    .prepare(
      `INSERT INTO aleta_bot_logs (id, level, event_type, message, metadata_json, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      await nextPrefixedId(db, "aleta_bot_logs", "abl"),
      input.level,
      input.eventType,
      input.message,
      JSON.stringify(input.metadata ?? {}),
      input.actorUserId ?? null,
      new Date().toISOString()
    );
}

export async function getAletaBotSettings(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const row = await db
    .prepare(
      `SELECT bot_enabled, notifications_enabled, admin_whatsapp_number, message_delay_ms,
        retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes, updated_at
       FROM aleta_bot_settings
       WHERE id = 1`
    )
    .get<SettingsRow>();

  if (!row) {
    throw new ApiError(500, "Konfigurasi ALETA Bot belum tersedia.");
  }

  return mapSettings(row);
}

async function getTemplates(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, category, title, body, placeholders_json, editable, updated_at
       FROM aleta_bot_templates
       ORDER BY category ASC, title ASC`
    )
    .all<TemplateRow>();

  return rows.map(mapTemplate);
}

async function getJobs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, name, description, enabled, schedule_cron, last_run_at, last_status, last_message, updated_at
       FROM aleta_bot_jobs
       ORDER BY name ASC`
    )
    .all<JobRow>();

  return rows.map(mapJob);
}

async function getNotifications(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, name, category, description, query_id, template_id, recipient_source,
        recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
        last_run_at, last_status, last_message, created_by, updated_by, created_at, updated_at
       FROM aleta_bot_notifications
       ORDER BY category ASC, name ASC`
    )
    .all<NotificationRow>();

  return rows.map(mapNotification);
}

async function getQueries(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const [rows, notificationRows] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, category, description, sql_text, output_columns_json, recipient_column,
          is_active, last_tested_at, last_test_status, last_test_error, created_by, updated_by, created_at, updated_at
         FROM aleta_bot_queries
         ORDER BY category ASC, name ASC`
      )
      .all<QueryRow>(),
    db
      .prepare(`SELECT query_id, name FROM aleta_bot_notifications ORDER BY name ASC`)
      .all<{ query_id: string; name: string }>(),
  ]);

  const usedBy = notificationRows.reduce<Record<string, string[]>>((groups, row) => {
    groups[row.query_id] = [...(groups[row.query_id] ?? []), row.name];
    return groups;
  }, {});

  return rows.map((row) => mapQuery(row, usedBy[row.id] ?? []));
}

async function getEmployeeRecipients(db: AletaDatabase) {
  const rows = await db
    .prepare(
      `SELECT users.id, users.username, users.name, users.role_id, users.position_id,
        positions.name AS position_name, users.whatsapp_number
       FROM users
       LEFT JOIN positions ON positions.id = users.position_id
       WHERE users.deleted_at IS NULL
         AND users.is_active = 1
         AND COALESCE(users.whatsapp_number, '') <> ''
       ORDER BY users.name ASC`
    )
    .all<EmployeeRecipientRow>();

  return rows.map(mapEmployeeRecipient).filter((row) => row.whatsappNumber && /^62\d{8,15}$/.test(row.whatsappNumber));
}

async function getNotificationLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, notification_id, query_id, recipient_number, recipient_name, category,
        message_preview, status, error_message, sent_at, created_at
       FROM aleta_bot_notification_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<NotificationLogRow>();

  return rows.map(mapNotificationLog);
}

async function getLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, level, event_type, message, metadata_json, actor_user_id, created_at
       FROM aleta_bot_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<LogRow>();

  return rows.map(mapLog);
}

function getRuntimeState(settings: AletaBotSettings, whatsappRuntimeStatus: string): AletaBotRuntimeState {
  if (whatsappRuntimeStatus === "failed") return "error";
  if (!settings.botEnabled) return "disabled";
  if (settings.dryRunEnabled) return "dry-run";
  return "active";
}

async function buildMetrics(db: AletaDatabase, jobs: AletaBotJob[], templates: AletaBotTemplate[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const sent = await db
    .prepare(
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_logs
       WHERE event_type = 'message' AND level = 'success' AND created_at >= ?`
    )
    .get<{ count: number }>(todayIso);
  const failed = await db
    .prepare(
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_logs
       WHERE event_type = 'message' AND level = 'error' AND created_at >= ?`
    )
    .get<{ count: number }>(todayIso);
  const lastNotification = await db
    .prepare(
      `SELECT created_at
       FROM aleta_bot_logs
       WHERE event_type = 'notification'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get<{ created_at: string }>();

  return {
    sentToday: sent?.count ?? 0,
    failedToday: failed?.count ?? 0,
    lastNotificationAt: lastNotification?.created_at ?? null,
    activeJobs: jobs.filter((job) => job.enabled).length,
    enabledTemplates: templates.filter((template) => template.editable).length,
  };
}

export async function getAletaBotSnapshot(db: AletaDatabase, actorUserId: string): Promise<AletaBotSnapshot> {
  await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const [settings, templates, jobs, notifications, queries, employeeRecipients, notificationLogs, logs, whatsappSnapshot] = await Promise.all([
    getAletaBotSettings(db),
    getTemplates(db),
    getJobs(db),
    getNotifications(db),
    getQueries(db),
    getEmployeeRecipients(db),
    getNotificationLogs(db),
    getLogs(db),
    whatsappService.getGatewaySnapshot(),
  ]);
  const metrics = await buildMetrics(db, jobs, templates);

  return {
    settings,
    runtimeState: getRuntimeState(settings, whatsappSnapshot.runtimeStatus),
    whatsapp: {
      runtimeStatus: whatsappSnapshot.runtimeStatus,
      internalStatus: whatsappSnapshot.internalStatus,
      qrCode: whatsappSnapshot.qrCode,
      linked: whatsappSnapshot.linked,
      phoneNumber: whatsappSnapshot.phoneNumber,
      sessionName: whatsappSnapshot.sessionName,
      savedStatus: whatsappSnapshot.savedStatus,
      lastConnectedAt: whatsappSnapshot.lastConnectedAt ?? null,
      lastErrorMessage: whatsappSnapshot.lastErrorMessage,
    },
    metrics,
    templates,
    jobs,
    notifications,
    queries,
    employeeRecipients,
    notificationLogs,
    queryCatalog: ALETA_BOT_QUERY_CATALOG,
    logs,
  };
}

async function writeAletaBotRuntimeConfig(
  db: AletaDatabase,
  settings: AletaBotSettings,
  whatsappSettings: Awaited<ReturnType<typeof getWhatsAppSettingsFromDb>>
) {
  const [templates, notifications, queries, employeeRecipients] = await Promise.all([
    getTemplates(db),
    getNotifications(db),
    getQueries(db),
    getEmployeeRecipients(db),
  ]);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: "manajemen_surat",
    botEnabled: settings.botEnabled,
    notificationsEnabled: settings.notificationsEnabled,
    adminWhatsappNumber: settings.adminWhatsappNumber,
    adminWhatsappChatId: settings.adminWhatsappNumber ? `${settings.adminWhatsappNumber}@c.us` : "",
    messageDelayMs: settings.messageDelayMs,
    retryLimit: settings.retryLimit,
    dryRunEnabled: settings.dryRunEnabled,
    scheduleCron: settings.scheduleCron,
    testTargetNumber: settings.testTargetNumber,
    templates,
    notifications: notifications.filter((notification) => notification.isActive),
    queries: queries.filter((query) => query.isActive),
    employeeRecipients,
    whatsapp: {
      phoneNumber: whatsappSettings.phoneNumber,
      sessionName: whatsappSettings.sessionName,
      status: whatsappSettings.status,
      lastConnectedAt: whatsappSettings.lastConnectedAt ?? null,
    },
  };
  const targets = [
    path.join(process.cwd(), "data", "aleta-bot-runtime.json"),
    path.resolve(process.cwd(), "..", "aleta_bot", "config", "aleta-runtime.json"),
  ];

  await Promise.all(
    targets.map(async (targetPath) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    })
  );
}

export async function updateAletaBotSettings(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: Partial<Omit<AletaBotSettings, "updatedAt">>;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);

  return withTransaction(db, async (tx) => {
    const current = await getAletaBotSettings(tx);
    const nextSettings: AletaBotSettings = {
      ...current,
      ...payload,
      adminWhatsappNumber:
        payload.adminWhatsappNumber === undefined
          ? current.adminWhatsappNumber
          : payload.adminWhatsappNumber.trim()
            ? assertWhatsappNumber(payload.adminWhatsappNumber, "Nomor admin WhatsApp")
            : "",
      testTargetNumber:
        payload.testTargetNumber === undefined
          ? current.testTargetNumber
          : payload.testTargetNumber.trim()
            ? assertWhatsappNumber(payload.testTargetNumber, "Nomor tujuan testing")
            : "",
      messageDelayMs:
        payload.messageDelayMs === undefined
          ? current.messageDelayMs
          : Math.min(60000, Math.max(0, Number(payload.messageDelayMs))),
      retryLimit:
        payload.retryLimit === undefined
          ? current.retryLimit
          : Math.min(10, Math.max(0, Number(payload.retryLimit))),
      scheduleCron:
        payload.scheduleCron === undefined ? current.scheduleCron : validateCronLike(payload.scheduleCron),
      securityNotes:
        payload.securityNotes === undefined ? current.securityNotes : payload.securityNotes.trim().slice(0, 800),
      updatedAt: new Date().toISOString(),
    };

    await tx
      .prepare(
        `UPDATE aleta_bot_settings
         SET bot_enabled = ?, notifications_enabled = ?, admin_whatsapp_number = ?,
           message_delay_ms = ?, retry_limit = ?, dry_run_enabled = ?, schedule_cron = ?,
           test_target_number = ?, security_notes = ?, updated_at = ?
         WHERE id = 1`
      )
      .run(
        nextSettings.botEnabled ? 1 : 0,
        nextSettings.notificationsEnabled ? 1 : 0,
        nextSettings.adminWhatsappNumber,
        nextSettings.messageDelayMs,
        nextSettings.retryLimit,
        nextSettings.dryRunEnabled ? 1 : 0,
        nextSettings.scheduleCron,
        nextSettings.testTargetNumber,
        nextSettings.securityNotes,
        nextSettings.updatedAt
      );

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "Konfigurasi ALETA Bot diperbarui dari portal.",
      metadata: {
        botEnabled: nextSettings.botEnabled,
        notificationsEnabled: nextSettings.notificationsEnabled,
        dryRunEnabled: nextSettings.dryRunEnabled,
      },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ALETA_BOT_SETTINGS",
      entityType: "aleta_bot_settings",
      entityId: "1",
      payload: {
        ...nextSettings,
        adminWhatsappNumber: nextSettings.adminWhatsappNumber ? "configured" : "",
        testTargetNumber: nextSettings.testTargetNumber ? "configured" : "",
      },
    });

    const whatsappSettings = await getWhatsAppSettingsFromDb(tx);
    await writeAletaBotRuntimeConfig(tx, nextSettings, whatsappSettings);

    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotTemplate(
  db: AletaDatabase,
  {
    actorUserId,
    templateId,
    body,
  }: {
    actorUserId: string;
    templateId: string;
    body: string;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const nextBody = body.trim();
  if (nextBody.length < 8 || nextBody.length > 4000) {
    throw new ApiError(400, "Template harus berisi 8-4000 karakter.");
  }

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const template = await tx
      .prepare(`SELECT id, editable FROM aleta_bot_templates WHERE id = ?`)
      .get<{ id: string; editable: number }>(templateId);

    if (!template) {
      throw new ApiError(404, "Template ALETA Bot tidak ditemukan.");
    }
    if (!template.editable) {
      throw new ApiError(400, "Template ini tidak bisa diedit dari portal.");
    }

    await tx
      .prepare(`UPDATE aleta_bot_templates SET body = ?, updated_at = ? WHERE id = ?`)
      .run(nextBody, new Date().toISOString(), templateId);
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "template",
      message: `Template ${templateId} diperbarui.`,
      metadata: { templateId },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ALETA_BOT_TEMPLATE",
      entityType: "aleta_bot_templates",
      entityId: templateId,
      payload: { templateId },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));

    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotQuery(
  db: AletaDatabase,
  {
    actorUserId,
    query,
  }: {
    actorUserId: string;
    query: Omit<Partial<AletaBotQuery>, "outputColumns"> &
      Pick<AletaBotQuery, "name" | "category" | "sqlText"> & {
        outputColumns?: string[] | string;
      };
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = new Date().toISOString();
  const id = query.id?.trim() || (await nextPrefixedId(db, "aleta_bot_queries", "abq"));
  const name = query.name.trim();
  if (!name) throw new ApiError(400, "Nama query wajib diisi.");
  const category = query.category;
  if (!["employee", "party", "system"].includes(category)) throw new ApiError(400, "Kategori query tidak valid.");
  const sqlText = validateReadOnlyQuery(query.sqlText);
  const outputColumns = parseColumns(query.outputColumns);
  if (outputColumns.length === 0) throw new ApiError(400, "Mapping kolom hasil query wajib diisi.");
  const recipientColumn = String(query.recipientColumn ?? "").trim();
  if (category === "party" && (!recipientColumn || !outputColumns.includes(recipientColumn))) {
    throw new ApiError(400, "Query kategori Pihak wajib memiliki kolom nomor tujuan yang ada di mapping kolom.");
  }

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_queries WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) throw new ApiError(400, "Nama query ALETA Bot sudah dipakai.");

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_queries WHERE id = ?`).get<{ id: string }>(id);
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_queries
           SET name = ?, category = ?, description = ?, sql_text = ?, output_columns_json = ?,
             recipient_column = ?, is_active = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          name,
          category,
          String(query.description ?? "").trim(),
          sqlText,
          JSON.stringify(outputColumns),
          recipientColumn,
          query.isActive === false ? 0 : 1,
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_queries (
            id, name, category, description, sql_text, output_columns_json, recipient_column,
            is_active, last_test_status, created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          category,
          String(query.description ?? "").trim(),
          sqlText,
          JSON.stringify(outputColumns),
          recipientColumn,
          query.isActive === false ? 0 : 1,
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "query",
      message: `Query ALETA Bot ${name} disimpan.`,
      metadata: { queryId: id, category },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_QUERY" : "CREATE_ALETA_BOT_QUERY",
      entityType: "aleta_bot_queries",
      entityId: id,
      payload: { name, category, outputColumns, recipientColumn },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotNotification(
  db: AletaDatabase,
  {
    actorUserId,
    notification,
  }: {
    actorUserId: string;
    notification: Partial<AletaBotNotification> & Pick<AletaBotNotification, "name" | "category" | "queryId" | "templateId">;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = new Date().toISOString();
  const id = notification.id?.trim() || (await nextPrefixedId(db, "aleta_bot_notifications", "abn"));
  const name = notification.name.trim();
  if (!name) throw new ApiError(400, "Nama notifikasi wajib diisi.");
  if (!["employee", "party"].includes(notification.category)) throw new ApiError(400, "Kategori notifikasi wajib Pegawai atau Pihak.");

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_notifications WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) throw new ApiError(400, "Nama notifikasi ALETA Bot sudah dipakai.");

    const query = (await getQueries(tx)).find((item) => item.id === notification.queryId);
    if (!query) throw new ApiError(404, "Sumber query notifikasi tidak ditemukan.");
    if (!query.isActive && notification.isActive) throw new ApiError(400, "Query nonaktif tidak bisa dipakai oleh notifikasi aktif.");

    const template = (await getTemplates(tx)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

    const placeholders = getTemplatePlaceholders(template.body);
    const allowedColumns = new Set([...query.outputColumns, "nama_pegawai", "judul_notifikasi", "ringkasan", "waktu", "mode"]);
    const missingPlaceholders = placeholders.filter((placeholder) => !allowedColumns.has(placeholder));
    if (missingPlaceholders.length > 0) {
      throw new ApiError(400, `Placeholder template tidak cocok dengan kolom query: ${missingPlaceholders.join(", ")}.`);
    }

    const recipientSource = notification.category === "employee" ? "users" : "query";
    if (notification.category === "party" && !query.recipientColumn) {
      throw new ApiError(400, "Notifikasi Pihak wajib memakai query dengan kolom nomor tujuan.");
    }
    if (notification.category === "employee") {
      const employeeRecipients = await getEmployeeRecipients(tx);
      if (employeeRecipients.length === 0 && notification.isActive) {
        throw new ApiError(400, "Tidak ada user aktif dengan nomor WhatsApp valid untuk notifikasi Pegawai.");
      }
    }

    const scheduleConfig = validateScheduleConfig(
      notification.scheduleConfig ?? {
        type: "manual",
        cron: "",
        trigger: "manual",
      }
    );
    const delayMs = Math.min(60000, Math.max(0, Number(notification.delayMs ?? 1500)));
    const retryLimit = Math.min(10, Math.max(0, Number(notification.retryLimit ?? 2)));
    const recipientMapping =
      notification.category === "employee"
        ? { ...(notification.recipientMapping ?? {}), source: "users.whatsapp_number" }
        : {
            ...(notification.recipientMapping ?? {}),
            recipientColumn: query.recipientColumn,
            fallbackColumns: ["nomor_hp", "nomor_whatsapp", "telepon"],
          };

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_notifications WHERE id = ?`).get<{ id: string }>(id);
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_notifications
           SET name = ?, category = ?, description = ?, query_id = ?, template_id = ?,
             recipient_source = ?, recipient_mapping_json = ?, schedule_config_json = ?,
             is_active = ?, delay_ms = ?, retry_limit = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          name,
          notification.category,
          String(notification.description ?? "").trim(),
          notification.queryId,
          notification.templateId,
          recipientSource,
          JSON.stringify(recipientMapping),
          JSON.stringify(scheduleConfig),
          notification.isActive ? 1 : 0,
          delayMs,
          retryLimit,
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_notifications (
            id, name, category, description, query_id, template_id, recipient_source,
            recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
            last_status, created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          notification.category,
          String(notification.description ?? "").trim(),
          notification.queryId,
          notification.templateId,
          recipientSource,
          JSON.stringify(recipientMapping),
          JSON.stringify(scheduleConfig),
          notification.isActive ? 1 : 0,
          delayMs,
          retryLimit,
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "notification",
      message: `Notifikasi ALETA Bot ${name} disimpan.`,
      metadata: { notificationId: id, category: notification.category, queryId: notification.queryId },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_NOTIFICATION" : "CREATE_ALETA_BOT_NOTIFICATION",
      entityType: "aleta_bot_notifications",
      entityId: id,
      payload: { name, category: notification.category, queryId: notification.queryId, templateId: notification.templateId },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

function renderTemplate(template: AletaBotTemplate, values: Record<string, string>) {
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
}

export async function runAletaBotAction(
  db: AletaDatabase,
  {
    actorUserId,
    action,
    payload,
  }: {
    actorUserId: string;
    action:
      | "sync-config"
      | "reconnect"
      | "logout"
      | "send-test"
      | "test-template"
      | "test-query"
      | "test-notification"
      | "test-connection";
    payload?: Record<string, unknown>;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const settings = await getAletaBotSettings(db);

  if (action === "sync-config") {
    await writeAletaBotRuntimeConfig(db, settings, await getWhatsAppSettingsFromDb(db));
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "Runtime config ALETA Bot disinkronkan ke file bridge.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "reconnect") {
    void whatsappService.initialize();
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "connection",
      message: "Reconnect WhatsApp Gateway diminta dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "logout") {
    await whatsappService.deactivate();
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "warning",
      eventType: "connection",
      message: "Sesi WhatsApp Gateway dinonaktifkan dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-connection") {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "connection",
      message: "Status koneksi WhatsApp diuji dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-template") {
    const templateId = String(payload?.templateId ?? "admin-test");
    const template = (await getTemplates(db)).find((item) => item.id === templateId);
    if (!template) {
      throw new ApiError(404, "Template tidak ditemukan.");
    }
    const preview = renderTemplate(template, {
      waktu: new Date().toLocaleString("id-ID"),
      mode: settings.dryRunEnabled ? "dry-run" : "live",
      nomor_perkara: "123/Pdt.G/2026/PA.Dgl",
      nama_pihak: "Contoh Pihak",
      agenda: "Mediasi",
      hari_sidang: "Senin",
      tanggal_sidang: "27-04-2026",
      ruangan: "Ruang Sidang 1",
      sisa_panjar: "Rp125.000",
    });
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "template",
      message: "Preview template ALETA Bot dibuat.",
      metadata: { templateId, preview },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview };
  }

  if (action === "send-test") {
    const to = assertWhatsappNumber(String(payload?.to ?? settings.testTargetNumber), "Nomor tujuan test");
    const message = String(payload?.message ?? "").trim();
    if (message.length < 3 || message.length > 1000) {
      throw new ApiError(400, "Pesan test harus berisi 3-1000 karakter.");
    }

    if (settings.dryRunEnabled) {
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "success",
        eventType: "message",
        message: "Dry-run pesan test ALETA Bot berhasil disimulasikan.",
        metadata: { to: "redacted", length: message.length },
      });
      return getAletaBotSnapshot(db, actor.id);
    }

    await whatsappService.sendMessage(to, message);
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "message",
      message: "Pesan test ALETA Bot dikirim melalui WhatsApp Gateway.",
      metadata: { to: "redacted", length: message.length },
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-query") {
    const queryId = String(payload?.queryId ?? "");
    const savedQuery = (await getQueries(db)).find((query) => query.id === queryId);
    if (savedQuery) {
      const now = new Date().toISOString();
      const previewPayload = summarizeQueryPreview(savedQuery);
      await db
        .prepare(
          `UPDATE aleta_bot_queries
           SET last_tested_at = ?, last_test_status = 'success', last_test_error = NULL
           WHERE id = ?`
        )
        .run(now, savedQuery.id);
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "success",
        eventType: "query",
        message: `Test query ${savedQuery.name} berhasil secara terbatas.`,
        metadata: { queryId, preview: previewPayload },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return { ...snapshot, preview: JSON.stringify(previewPayload, null, 2) };
    }

    const item = ALETA_BOT_QUERY_CATALOG.find((query) => query.id === queryId);
    if (!item) {
      throw new ApiError(404, "Query ALETA Bot tidak ditemukan.");
    }
    if (!item.testable) {
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "warning",
        eventType: "query",
        message: "Test query diblokir karena query membaca database produksi SIPP/MIS.",
        metadata: { queryId, sourceFile: item.sourceFile },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return {
        ...snapshot,
        preview: "Query ini terdaftar, tetapi eksekusi live diblokir di portal demi keamanan data produksi.",
      };
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "query",
      message: "Test query/utility ringan berhasil.",
      metadata: { queryId },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview: "Utility terdaftar dan aman untuk diuji dari portal." };
  }

  if (action === "test-notification") {
    const notificationId = String(payload?.notificationId ?? "");
    const notification = (await getNotifications(db)).find((item) => item.id === notificationId);
    if (!notification) throw new ApiError(404, "Notifikasi ALETA Bot tidak ditemukan.");
    const query = (await getQueries(db)).find((item) => item.id === notification.queryId);
    if (!query) throw new ApiError(404, "Query notifikasi tidak ditemukan.");
    const template = (await getTemplates(db)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

    const sample = makeSampleRow(query.outputColumns);
    sample.nama_pegawai = "Contoh Pegawai";
    sample.judul_notifikasi = notification.name;
    sample.ringkasan = notification.description || "Simulasi notifikasi ALETA Bot";
    sample.mode = settings.dryRunEnabled ? "dry-run" : "live";
    sample.waktu = new Date().toLocaleString("id-ID");
    const preview = renderTemplate(template, sample);

    let recipientNumber = "";
    let recipientName = "";
    if (notification.category === "employee") {
      const recipient = (await getEmployeeRecipients(db))[0];
      recipientNumber = recipient?.whatsappNumber ?? "";
      recipientName = recipient?.name ?? "Simulasi Pegawai";
    } else {
      recipientNumber = normalizeWhatsappNumber(sample[query.recipientColumn] ?? "");
      recipientName = sample.nama_pihak ?? "Simulasi Pihak";
    }

    const status: AletaBotNotificationLogEntry["status"] = recipientNumber ? "simulated" : "failed";
    const errorMessage = recipientNumber ? null : "Nomor penerima tidak tersedia/invalid pada simulasi.";
    await db
      .prepare(
        `INSERT INTO aleta_bot_notification_logs (
          id, notification_id, query_id, recipient_number, recipient_name, category,
          message_preview, status, error_message, sent_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        await nextPrefixedId(db, "aleta_bot_notification_logs", "abnl"),
        notification.id,
        query.id,
        recipientNumber,
        recipientName,
        notification.category,
        preview.slice(0, 1000),
        status,
        errorMessage,
        status === "simulated" ? new Date().toISOString() : null,
        new Date().toISOString()
      );
    await db
      .prepare(
        `UPDATE aleta_bot_notifications
         SET last_run_at = ?, last_status = ?, last_message = ?
         WHERE id = ?`
      )
      .run(new Date().toISOString(), status, errorMessage ?? "Simulasi notifikasi berhasil.", notification.id);
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: status === "failed" ? "error" : "success",
      eventType: "notification",
      message: `Test notifikasi ${notification.name} diproses dalam mode aman.`,
      metadata: { notificationId, queryId: query.id, status },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview };
  }

  throw new ApiError(400, "Aksi ALETA Bot tidak valid.");
}
