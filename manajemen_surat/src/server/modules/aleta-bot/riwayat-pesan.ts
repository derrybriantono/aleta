import type { AletaDatabase, SqlInputValue } from "@/server/db/client";

/**
 * ============================================================================
 * RIWAYAT PENGIRIMAN PESAN - PENYARING, PENGURUT, DAN PEMBACANYA
 * ============================================================================
 *
 * Riwayat ini dibaca dua layar: Riwayat Pengiriman pada menu ALETA Bot (untuk
 * setiap pegawai yang punya akses) dan unduhan Excel/CSV/lembar cetak untuk
 * pelaporan ke pihak luar. Keduanya HARUS menyaring dan mengurut dengan cara
 * yang sama - daftar di layar yang berbeda dari daftar yang dicetak adalah
 * laporan yang tidak bisa dipercaya. Karena itu penyaringnya satu, di sini,
 * dan rutenya hanya memanggil.
 *
 * ============================================================================
 * KOLOM URUT DIPILIH DARI DAFTAR, BUKAN DARI PERMINTAAN
 * ============================================================================
 *
 * Nama kolom tidak boleh disisipkan ke SQL dari parameter apa pun. Yang
 * masuk ORDER BY hanya nama dari peta KOLOM_URUT; permintaan yang menyebut
 * kolom lain jatuh ke bawaan. Nilai penyaring selalu lewat parameter.
 */

export const STATUS_LABELS: Record<string, string> = {
  success: "Terkirim",
  failed: "Gagal",
  simulated: "Simulasi",
  pending: "Menunggu Antrean",
  processing: "Sedang Diproses",
  dead_letter: "Gagal Permanen",
  cancelled: "Dibatalkan",
  dry_run: "Simulasi",
  skipped: "Dilewati",
  sent: "Terkirim",
  delivered: "Sampai",
  read: "Dibaca",
};

export const CATEGORY_LABELS: Record<string, string> = {
  jadwal_sidang: "Jadwal Sidang",
  notifikasi_perkara: "Notifikasi Perkara",
  employee: "Notifikasi Pegawai",
  party: "Notifikasi Pihak",
  public_qa: "Pertanyaan Publik",
  system: "Sistem",
  manajemen_surat: "Manajemen Surat",
  letter: "Surat",
  letter_notification: "Surat",
  disposition: "Disposisi",
  disposition_notification: "Disposisi",
  disposition_deadline_reminder: "Tenggat Disposisi",
  kirim_saat_lengkap: "Kirim Saat Lengkap",
  verifikasi_nomor: "Verifikasi Nomor",
  ecourt: "e-Court",
  manual: "Kirim Manual",
};

export type PenerimaRiwayat = "" | "pegawai" | "pihak";
export type UrutanRiwayat =
  | "createdAt"
  | "sentAt"
  | "recipientName"
  | "recipientNumber"
  | "status"
  | "sourceFeature"
  | "category";
export type ArahUrut = "asc" | "desc";

export const KOLOM_URUT: Record<UrutanRiwayat, string> = {
  createdAt: "n.created_at",
  // Yang belum terkirim ikut diurut menurut waktu dibuatnya, bukan dibuang
  // ke ujung daftar sebagai NULL.
  sentAt: "COALESCE(n.sent_at, n.created_at)",
  recipientName: "n.recipient_name",
  recipientNumber: "n.recipient_number",
  status: "n.status",
  sourceFeature: "n.source_feature",
  category: "n.category",
};

export const LABEL_URUT: Record<UrutanRiwayat, string> = {
  createdAt: "Waktu diproses",
  sentAt: "Waktu terkirim",
  recipientName: "Nama penerima",
  recipientNumber: "Nomor WhatsApp",
  status: "Status",
  sourceFeature: "Jenis pesan",
  category: "Kategori",
};

export const LABEL_RENTANG: Record<string, string> = {
  today: "Hari ini",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  custom: "Tanggal tertentu",
  "": "Semua waktu",
};

export type ParameterRiwayat = {
  status: string;
  sourceFeature: string;
  sourceApp: string;
  entityType: string;
  entityId: string;
  search: string;
  dateRange: string;
  dateFrom: string;
  dateTo: string;
  penerima: PenerimaRiwayat;
  nomorPerkara: string;
  isiPesan: string;
  nomor: string;
  notificationKey: string;
  hanyaGagal: boolean;
  urut: UrutanRiwayat;
  arah: ArahUrut;
};

function teks(sp: URLSearchParams, kunci: string, maks = 200) {
  return (sp.get(kunci) ?? "").trim().slice(0, maks);
}

/**
 * Tanggal yang benar-benar ada, bukan sekadar berbentuk tanggal.
 *
 * Bentuknya saja tidak cukup: "2026-13-45" lolos pola tetapi bukan tanggal,
 * dan batas "hari berikutnya" dihitung dengan Date - yang menghasilkan
 * Invalid Date lalu MELEMPAR saat ditulis kembali. Satu isian tanggal yang
 * salah ketik akan memulangkan galat peladen, bukan daftar kosong.
 */
function tanggalSah(nilai: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return "";
  const tanggal = new Date(`${nilai}T00:00:00Z`);
  if (Number.isNaN(tanggal.getTime())) return "";
  // Menolak pula tanggal yang "dibetulkan sendiri" oleh Date, seperti
  // 31 Februari yang menjadi 2 atau 3 Maret.
  return tanggal.toISOString().slice(0, 10) === nilai ? nilai : "";
}

/** Membaca parameter dari URL, dengan nilai yang tidak dikenal dijatuhkan ke bawaan. */
export function bacaParameterRiwayat(sp: URLSearchParams): ParameterRiwayat {
  const urutMinta = teks(sp, "urut") || teks(sp, "sort");
  const arahMinta = (teks(sp, "arah") || teks(sp, "dir")).toLowerCase();
  const penerimaMinta = teks(sp, "penerima");
  const dateFrom = tanggalSah(teks(sp, "dateFrom"));
  const dateTo = tanggalSah(teks(sp, "dateTo"));
  let dateRange = teks(sp, "dateRange");
  if (!sp.has("dateRange")) dateRange = "7d";
  if (dateFrom || dateTo) dateRange = "custom";
  if (!["today", "7d", "30d", "custom", ""].includes(dateRange)) dateRange = "7d";

  return {
    status: teks(sp, "status"),
    sourceFeature: teks(sp, "sourceFeature"),
    sourceApp: teks(sp, "sourceApp"),
    entityType: teks(sp, "entityType"),
    entityId: teks(sp, "entityId"),
    search: teks(sp, "search"),
    dateRange,
    dateFrom,
    dateTo,
    penerima: penerimaMinta === "pegawai" || penerimaMinta === "pihak" ? penerimaMinta : "",
    nomorPerkara: teks(sp, "nomorPerkara"),
    isiPesan: teks(sp, "isiPesan"),
    nomor: teks(sp, "nomor").replace(/[^\d]/g, "").replace(/^0/, "62"),
    notificationKey: teks(sp, "notificationKey"),
    hanyaGagal: teks(sp, "hanyaGagal") === "1" || teks(sp, "hanyaGagal") === "true",
    urut: (Object.keys(KOLOM_URUT) as UrutanRiwayat[]).includes(urutMinta as UrutanRiwayat)
      ? (urutMinta as UrutanRiwayat)
      : "createdAt",
    arah: arahMinta === "asc" ? "asc" : "desc",
  };
}

function tanggalIso(tanggal: Date) {
  return tanggal.toISOString().slice(0, 10);
}

function hariBerikutnya(ymd: string) {
  const tanggal = new Date(`${ymd}T00:00:00Z`);
  tanggal.setUTCDate(tanggal.getUTCDate() + 1);
  return tanggalIso(tanggal);
}

export type PenyaringRiwayat = {
  /** Potongan WHERE yang seluruhnya diawali AND - ditempel setelah WHERE 1=1. */
  klausa: string;
  nilai: SqlInputValue[];
  orderBy: string;
  /** Keterangan penyaring yang aktif, untuk kepala laporan. */
  keterangan: string[];
};

/**
 * Menyusun WHERE dan ORDER BY dari parameter. Fungsi murni - tidak menyentuh
 * database - supaya dapat diuji tanpa satu pun baris riwayat.
 */
export function susunPenyaringRiwayat(p: ParameterRiwayat, sekarang: Date = new Date()): PenyaringRiwayat {
  const potongan: string[] = [];
  const nilai: SqlInputValue[] = [];
  const keterangan: string[] = [];

  // --- waktu --------------------------------------------------------------
  if (p.dateRange === "today") {
    potongan.push("AND n.created_at >= ?");
    nilai.push(tanggalIso(sekarang));
    keterangan.push("Waktu: hari ini");
  } else if (p.dateRange === "7d" || p.dateRange === "30d") {
    const batas = new Date(sekarang);
    batas.setDate(batas.getDate() - (p.dateRange === "7d" ? 7 : 30));
    potongan.push("AND n.created_at >= ?");
    nilai.push(tanggalIso(batas));
    keterangan.push(`Waktu: ${LABEL_RENTANG[p.dateRange]}`);
  } else if (p.dateRange === "custom") {
    if (p.dateFrom) {
      potongan.push("AND n.created_at >= ?");
      nilai.push(p.dateFrom);
    }
    if (p.dateTo) {
      potongan.push("AND n.created_at < ?");
      nilai.push(hariBerikutnya(p.dateTo));
    }
    if (p.dateFrom || p.dateTo) {
      keterangan.push(
        p.dateFrom && p.dateTo
          ? `Waktu: ${p.dateFrom} s.d. ${p.dateTo}`
          : p.dateFrom
            ? `Waktu: sejak ${p.dateFrom}`
            : `Waktu: sampai ${p.dateTo}`
      );
    }
  } else {
    keterangan.push("Waktu: semua");
  }

  // --- status -------------------------------------------------------------
  if (p.hanyaGagal) {
    potongan.push("AND n.status IN ('failed', 'dead_letter')");
    keterangan.push("Hanya yang gagal");
  } else if (p.status) {
    potongan.push("AND n.status = ?");
    nilai.push(p.status);
    keterangan.push(`Status: ${STATUS_LABELS[p.status] ?? p.status}`);
  }

  // --- jenis pesan --------------------------------------------------------
  if (p.sourceFeature) {
    const alias =
      p.sourceFeature === "disposition"
        ? ["disposition", "disposition_notification", "disposition_deadline_reminder"]
        : p.sourceFeature === "letter"
          ? ["letter", "letter_notification"]
          : [p.sourceFeature];
    const isian = alias.map(() => "?").join(", ");
    potongan.push(`AND (n.category IN (${isian}) OR n.source_feature IN (${isian}))`);
    nilai.push(...alias, ...alias);
    keterangan.push(`Jenis: ${CATEGORY_LABELS[p.sourceFeature] ?? p.sourceFeature}`);
  }

  if (p.sourceApp) {
    potongan.push("AND n.source_app = ?");
    nilai.push(p.sourceApp);
    keterangan.push(`Aplikasi: ${p.sourceApp}`);
  }

  if (p.entityType) {
    potongan.push("AND n.entity_type = ?");
    nilai.push(p.entityType);
  }

  if (p.entityId) {
    const pola = (kunci: string) => `%"${kunci}"%"${p.entityId}"%`;
    potongan.push(
      "AND (n.entity_id = ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ?)"
    );
    nilai.push(
      p.entityId,
      pola("entityId"),
      pola("entity_id"),
      pola("suratId"),
      pola("surat_id"),
      pola("letterId"),
      pola("dispositionId"),
      pola("disposition_id")
    );
    keterangan.push(`Surat/disposisi: ${p.entityId}`);
  }

  // --- penerima -----------------------------------------------------------
  //
  // Kategori 'employee'/'party' ditulis registri bot; pesan dari portal
  // menulis recipientType pada metadata. Keduanya diperiksa supaya pesan
  // dari jalur mana pun terhitung.
  if (p.penerima === "pegawai") {
    potongan.push("AND (n.category = 'employee' OR n.metadata_json LIKE ?)");
    nilai.push('%"recipientType":"employee"%');
    keterangan.push("Penerima: pegawai");
  } else if (p.penerima === "pihak") {
    potongan.push(
      "AND (n.category IN ('party', 'jadwal_sidang', 'notifikasi_perkara') OR n.metadata_json LIKE ?)"
    );
    nilai.push('%"recipientType":"party"%');
    keterangan.push("Penerima: pihak berperkara");
  }

  // --- pencarian ----------------------------------------------------------
  if (p.search) {
    potongan.push("AND (n.recipient_name LIKE ? OR n.recipient_number LIKE ?)");
    nilai.push(`%${p.search}%`, `%${p.search}%`);
    keterangan.push(`Cari: "${p.search}"`);
  }

  if (p.nomor) {
    potongan.push("AND n.recipient_number LIKE ?");
    nilai.push(`%${p.nomor}%`);
    keterangan.push(`Nomor: ${p.nomor}`);
  }

  if (p.nomorPerkara) {
    // Nomor perkara hidup di tiga tempat menurut jalurnya: entity_id
    // (jalur baru), metadata (registri), dan isi pesannya sendiri (semua).
    potongan.push(
      "AND (n.entity_id LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.message_preview LIKE ?)"
    );
    nilai.push(
      `%${p.nomorPerkara}%`,
      `%"nomorPerkara":"%${p.nomorPerkara}%`,
      `%"nomor_perkara":"%${p.nomorPerkara}%`,
      `%${p.nomorPerkara}%`
    );
    keterangan.push(`Nomor perkara memuat: ${p.nomorPerkara}`);
  }

  if (p.isiPesan) {
    potongan.push("AND n.message_preview LIKE ?");
    nilai.push(`%${p.isiPesan}%`);
    keterangan.push(`Isi pesan memuat: "${p.isiPesan}"`);
  }

  if (p.notificationKey) {
    potongan.push("AND (n.notification_id = ? OR n.metadata_json LIKE ?)");
    nilai.push(p.notificationKey, `%"notificationKey":"${p.notificationKey}"%`);
    keterangan.push(`Kunci pesan: ${p.notificationKey}`);
  }

  const kolom = KOLOM_URUT[p.urut] ?? KOLOM_URUT.createdAt;
  const arah = p.arah === "asc" ? "ASC" : "DESC";
  const orderBy = kolom === KOLOM_URUT.createdAt ? `${kolom} ${arah}` : `${kolom} ${arah}, n.created_at DESC`;

  return { klausa: potongan.join("\n        "), nilai, orderBy, keterangan };
}

// ============================================================================
// MEMBACA
// ============================================================================

export type BarisRiwayat = {
  id: string;
  notification_id: string | null;
  recipient_number: string;
  recipient_name: string;
  category: string;
  message_preview: string;
  status: string;
  error_message: string | null;
  source_app: string;
  source_feature: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  sent_at: string | null;
  created_at: string;
  position_name: string | null;
};

export type ButirRiwayat = {
  id: string;
  recipientName: string;
  recipientNumber: string;
  recipientNumberMasked: boolean;
  caseOrPosition: string;
  messagePreview: string;
  messageBody: string | null;
  status: string;
  statusLabel: string;
  sourceFeature: string;
  sourceFeatureLabel: string;
  sourceApp: string;
  notificationKey: string | null;
  penerima: "pegawai" | "pihak" | "";
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
};

export function maskNumber(number: string): string {
  if (!number || number.length < 7) return number;
  return number.slice(0, 3) + "****" + number.slice(-4);
}

export function sanitizeError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes("could not find chrome") || lower.includes("puppeteer")) {
    return "Chrome/Puppeteer belum tersedia di server. Admin teknis perlu memasang browser atau mengatur executable path.";
  }
  if (lower.includes("target closed")) {
    return "Browser WhatsApp tertutup. Coba hubungkan ulang WhatsApp Gateway dengan aman.";
  }
  if (lower.includes("session expired")) {
    return "Sesi WhatsApp berakhir. Silakan hubungkan ulang WhatsApp Gateway.";
  }
  if (lower.includes("protocol error")) {
    return "Terjadi gangguan komunikasi dengan browser WhatsApp.";
  }
  if (lower.includes("econnrefused") || lower.includes("enotfound")) {
    return "WhatsApp Bot belum dapat dihubungi.";
  }
  if (lower.includes("invalid phone") || lower.includes("invalid number") || lower.includes("not a wa")) {
    return "Nomor tidak valid.";
  }
  if (lower === "pesan_pegawai_dimatikan" || lower === "pesan_pihak_dimatikan") {
    return "Jenis pesan ini sedang dimatikan dari saklar per pesan.";
  }
  if (lower === "pengiriman_pegawai_dimatikan" || lower === "pengiriman_pihak_dimatikan") {
    return "Saluran pengiriman ini sedang dimatikan.";
  }
  return msg.slice(0, 200);
}

export function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function tebakPenerima(row: BarisRiwayat, metadata: Record<string, unknown>): "pegawai" | "pihak" | "" {
  const jenis = String(metadata.recipientType || metadata.recipient_type || "").toLowerCase();
  if (row.category === "employee" || jenis === "employee" || jenis === "pegawai") return "pegawai";
  if (
    ["party", "jadwal_sidang", "notifikasi_perkara"].includes(row.category) ||
    jenis === "party" ||
    jenis === "pihak"
  ) {
    return "pihak";
  }
  return row.position_name ? "pegawai" : "";
}

export function petakanBarisRiwayat(row: BarisRiwayat, isPrivileged: boolean): ButirRiwayat {
  const numberMasked = !isPrivileged;
  const metadata = parseMetadata(row.metadata_json);
  const sourceKey = row.source_feature || String(metadata.sourceFeature || metadata.source_feature || row.category);
  const entityType = row.entity_type || String(metadata.entityType || metadata.entity_type || "") || null;
  const entityId = row.entity_id || String(metadata.entityId || metadata.entity_id || "") || null;
  const caseOrPosition =
    String(
      metadata.nomorPerkara || metadata.nomor_perkara || metadata.recipientPosition || metadata.recipient_position || ""
    ).trim() ||
    row.position_name ||
    "—";
  return {
    id: row.id,
    recipientName: row.recipient_name || "—",
    recipientNumber: numberMasked ? maskNumber(row.recipient_number) : row.recipient_number,
    recipientNumberMasked: numberMasked,
    caseOrPosition,
    messagePreview: row.message_preview
      ? row.message_preview.slice(0, 160) + (row.message_preview.length > 160 ? "…" : "")
      : "—",
    messageBody: isPrivileged ? (row.message_preview ?? null) : null,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    sourceFeature: sourceKey,
    sourceFeatureLabel: CATEGORY_LABELS[sourceKey] ?? CATEGORY_LABELS[row.category] ?? sourceKey,
    sourceApp: row.source_app || "aleta_bot",
    notificationKey: row.notification_id || String(metadata.notificationKey || metadata.notification_key || "") || null,
    penerima: tebakPenerima(row, metadata),
    entityType,
    entityId,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? null,
    errorMessage: sanitizeError(row.error_message),
  };
}

export type HasilRiwayat = {
  items: ButirRiwayat[];
  total: number;
  ringkasan: { perStatus: Record<string, number>; terkirim: number; gagal: number; simulasi: number; lainnya: number };
  keterangan: string[];
};

/**
 * Membaca riwayat dengan penyaring dan urutan yang sama untuk layar,
 * unduhan, dan cetakan. Ringkasan per status dihitung atas SELURUH hasil
 * saringan, bukan halaman yang sedang tampil - laporan menyebut jumlah
 * yang sesungguhnya.
 */
export async function bacaRiwayatPesan(
  db: AletaDatabase,
  parameter: ParameterRiwayat,
  { isPrivileged, limit, offset }: { isPrivileged: boolean; limit: number; offset: number }
): Promise<HasilRiwayat> {
  const saring = susunPenyaringRiwayat(parameter);
  const dari = `
      FROM aleta_bot_notification_logs n
      LEFT JOIN users u ON u.whatsapp_number = n.recipient_number AND u.is_active = 1
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE 1=1
        ${saring.klausa}`;

  const rows = await db.queryAll<BarisRiwayat>(
    `SELECT
        n.id, n.notification_id, n.recipient_number, n.recipient_name, n.category,
        n.message_preview, n.status, n.error_message, n.source_app, n.source_feature,
        n.entity_type, n.entity_id, n.metadata_json, n.sent_at, n.created_at,
        p.name AS position_name
      ${dari}
      ORDER BY ${saring.orderBy}
      LIMIT ${Math.max(1, Math.floor(limit))} OFFSET ${Math.max(0, Math.floor(offset))}`,
    saring.nilai
  );

  const hitungan = await db.queryAll<{ status: string; jumlah: string | number }>(
    `SELECT n.status AS status, COUNT(*) AS jumlah
      FROM aleta_bot_notification_logs n
      WHERE 1=1
        ${saring.klausa}
      GROUP BY n.status`,
    saring.nilai
  );

  const perStatus: Record<string, number> = {};
  let total = 0;
  for (const baris of hitungan) {
    const jumlah = Number(baris.jumlah || 0);
    perStatus[baris.status] = jumlah;
    total += jumlah;
  }
  const jumlahUntuk = (...status: string[]) => status.reduce((jumlah, satu) => jumlah + (perStatus[satu] ?? 0), 0);
  const terkirim = jumlahUntuk("success", "sent", "delivered", "read");
  const gagal = jumlahUntuk("failed", "dead_letter");
  const simulasi = jumlahUntuk("simulated", "dry_run");

  return {
    items: rows.map((row) => petakanBarisRiwayat(row, isPrivileged)),
    total,
    ringkasan: { perStatus, terkirim, gagal, simulasi, lainnya: total - terkirim - gagal - simulasi },
    keterangan: saring.keterangan,
  };
}
