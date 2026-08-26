import { validateReadOnlySql } from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";

export type AletaSippQuerySecurityStatus =
  | "SAFE_READ_ONLY"
  | "NEEDS_REVIEW"
  | "UNSAFE_RAW_SQL"
  | "MANUAL_ONLY";

export type AletaSippQueryParameter = {
  name: string;
  label: string;
  type: "text" | "date" | "number" | "boolean";
  required: boolean;
  example?: string;
};

export type AletaSippQueryDefinition = {
  queryId: string;
  queryKey: string;
  name: string;
  category: string;
  source: string;
  shortDescription: string;
  longDescription: string;
  tables: string[];
  outputColumns: string[];
  parameters: AletaSippQueryParameter[];
  originalSql: string;
  normalizedSql: string;
  securityStatus: AletaSippQuerySecurityStatus;
  allowedForAi: boolean;
  allowedForWhatsapp: boolean;
  allowedForPdf: boolean;
  roles: string[];
  riskNotes: string[];
};

export function validateAletaSippSelectOnlySql(sql: string) {
  const validation = validateReadOnlySql(sql);

  return {
    selectOnly: validation.selectOnly,
    blockedReason: validation.blockedReason,
    status: validation.status,
    normalizedSql: validation.normalizedSql,
  };
}

export const ALETA_SIPP_QUERY_REGISTRY: AletaSippQueryDefinition[] = [
  {
    queryId: "qry-sipp-perkara-by-nomor",
    queryKey: "QRY_SIPP_PERKARA_BY_NOMOR",
    name: "Cari Perkara Berdasarkan Nomor",
    category: "Perkara",
    source: "dibuat_baru_dari_struktur_database",
    shortDescription: "Mencari satu perkara dari nomor perkara yang diberikan user.",
    longDescription:
      "Query ini menjadi pintu masuk aman untuk mengambil `perkara_id`. Nomor perkara dicari pada tabel `perkara`, lalu modul lain memakai `perkara_id` untuk join ke pihak, sidang, putusan, majelis, panitera, jurusita, biaya, dan dokumen.",
    tables: ["perkara"],
    outputColumns: ["perkara_id", "nomor_perkara", "jenis_perkara_nama", "tanggal_pendaftaran"],
    parameters: [{ name: "nomor_perkara", label: "Nomor Perkara", type: "text", required: true, example: "123/Pdt.G/2026/PA.Bku" }],
    originalSql:
      "SELECT perkara_id, nomor_perkara, jenis_perkara_nama, tanggal_pendaftaran FROM perkara WHERE nomor_perkara = :nomor_perkara LIMIT 1",
    normalizedSql:
      "SELECT perkara_id, nomor_perkara, jenis_perkara_nama, tanggal_pendaftaran FROM perkara WHERE nomor_perkara = ? LIMIT 1",
    securityStatus: "SAFE_READ_ONLY",
    allowedForAi: true,
    allowedForWhatsapp: false,
    allowedForPdf: false,
    roles: ["superadmin", "admin", "ketua", "wakil", "panitera", "hakim", "operator_sipp"],
    riskNotes: ["Nomor perkara bukan data rahasia penuh, tetapi hasil query dapat mengarah ke data sensitif sehingga akses tetap berbasis role."],
  },
  {
    queryId: "qry-sipp-majelis-hakim-aktif",
    queryKey: "QRY_SIPP_MAJELIS_HAKIM_AKTIF",
    name: "Susunan Majelis Hakim Aktif",
    category: "Majelis Hakim",
    source: "dibuat_baru_dari_struktur_database",
    shortDescription: "Mengambil hakim aktif yang menangani suatu perkara.",
    longDescription:
      "Query ini membaca `perkara_hakim_pn` dan menghubungkannya ke `perkara`. Filter `aktif='Y'` dipakai agar pergantian majelis lama tidak ikut terbawa.",
    tables: ["perkara", "perkara_hakim_pn"],
    outputColumns: ["nomor_perkara", "hakim_id", "nama_hakim", "jabatan_hakim", "urutan", "aktif"],
    parameters: [{ name: "nomor_perkara", label: "Nomor Perkara", type: "text", required: true }],
    originalSql:
      "SELECT p.nomor_perkara, h.hakim_id, h.nama_hakim, h.jabatan_hakim, h.urutan, h.aktif FROM perkara p JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id WHERE p.nomor_perkara = :nomor_perkara AND h.aktif = 'Y' ORDER BY h.urutan",
    normalizedSql:
      "SELECT p.nomor_perkara, h.hakim_id, h.nama_hakim, h.jabatan_hakim, h.urutan, h.aktif FROM perkara p JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id WHERE p.nomor_perkara = ? AND h.aktif = 'Y' ORDER BY h.urutan",
    securityStatus: "SAFE_READ_ONLY",
    allowedForAi: true,
    allowedForWhatsapp: false,
    allowedForPdf: true,
    roles: ["superadmin", "admin", "ketua", "wakil", "panitera", "hakim", "panitera_pengganti"],
    riskNotes: ["Nama kolom hakim pada beberapa versi SIPP bisa berbeda; registry menyimpan status siap tetapi tetap diverifikasi terhadap backup aktif."],
  },
  {
    queryId: "qry-sipp-jadwal-sidang-hari-ini",
    queryKey: "QRY_SIPP_JADWAL_SIDANG_HARI_INI",
    name: "Jadwal Sidang Per Tanggal",
    category: "Persidangan",
    source: "antrian_sidang_dinormalisasi",
    shortDescription: "Mengambil jadwal sidang untuk tanggal tertentu sebagai dasar preview/PDF.",
    longDescription:
      "Query ini menggantikan pola aplikasi antrian lama untuk kebutuhan cetak jadwal. Hanya membaca `perkara_jadwal_sidang` dan `perkara`, dengan parameter tanggal dan ruang sidang opsional.",
    tables: ["perkara", "perkara_jadwal_sidang"],
    outputColumns: ["nomor_perkara", "tanggal_sidang", "jam_sidang", "agenda", "ruangan", "sidang_ke"],
    parameters: [
      { name: "tanggal_sidang", label: "Tanggal Sidang", type: "date", required: true, example: "2026-06-05" },
      { name: "ruangan", label: "Ruang Sidang", type: "text", required: false, example: "Ruang Sidang 1" },
    ],
    originalSql:
      "SELECT p.nomor_perkara, js.tanggal_sidang, js.jam_sidang, js.agenda, js.ruangan, js.urutan AS sidang_ke FROM perkara_jadwal_sidang js JOIN perkara p ON p.perkara_id = js.perkara_id WHERE js.tanggal_sidang = :tanggal_sidang AND (:ruangan IS NULL OR js.ruangan = :ruangan) ORDER BY js.ruangan, js.jam_sidang, p.nomor_perkara",
    normalizedSql:
      "SELECT p.nomor_perkara, js.tanggal_sidang, js.jam_sidang, js.agenda, js.ruangan, js.urutan AS sidang_ke FROM perkara_jadwal_sidang js JOIN perkara p ON p.perkara_id = js.perkara_id WHERE js.tanggal_sidang = ? AND (? IS NULL OR js.ruangan = ?) ORDER BY js.ruangan, js.jam_sidang, p.nomor_perkara",
    securityStatus: "SAFE_READ_ONLY",
    allowedForAi: true,
    allowedForWhatsapp: false,
    allowedForPdf: true,
    roles: ["superadmin", "admin", "ketua", "wakil", "panitera", "hakim", "panitera_pengganti", "jurusita", "ptsp"],
    riskNotes: ["Aplikasi antrian lama memiliki query UPDATE ke SIPP; versi ALETA x SIPP ini hanya memakai SELECT untuk jadwal/PDF."],
  },
  {
    queryId: "qry-sipp-para-pihak-perkara",
    queryKey: "QRY_SIPP_PARA_PIHAK_PERKARA",
    name: "Para Pihak Perkara",
    category: "Pihak",
    source: "dibuat_baru_dari_struktur_database",
    shortDescription: "Mengambil pihak 1 dan pihak 2 secara ringkas.",
    longDescription:
      "Query ini membaca nama/alamat ringkas dari `perkara_pihak1` dan `perkara_pihak2`. Hasilnya termasuk data sensitif sehingga tidak boleh dipakai WhatsApp publik.",
    tables: ["perkara", "perkara_pihak1", "perkara_pihak2"],
    outputColumns: ["nomor_perkara", "peran", "urutan", "nama", "alamat"],
    parameters: [{ name: "nomor_perkara", label: "Nomor Perkara", type: "text", required: true }],
    originalSql:
      "SELECT p.nomor_perkara, 'pihak1' AS peran, pp1.urutan, pp1.nama, pp1.alamat FROM perkara p JOIN perkara_pihak1 pp1 ON pp1.perkara_id = p.perkara_id WHERE p.nomor_perkara = :nomor_perkara UNION ALL SELECT p.nomor_perkara, 'pihak2' AS peran, pp2.urutan, pp2.nama, pp2.alamat FROM perkara p JOIN perkara_pihak2 pp2 ON pp2.perkara_id = p.perkara_id WHERE p.nomor_perkara = :nomor_perkara ORDER BY peran, urutan",
    normalizedSql:
      "SELECT p.nomor_perkara, 'pihak1' AS peran, pp1.urutan, pp1.nama, pp1.alamat FROM perkara p JOIN perkara_pihak1 pp1 ON pp1.perkara_id = p.perkara_id WHERE p.nomor_perkara = ? UNION ALL SELECT p.nomor_perkara, 'pihak2' AS peran, pp2.urutan, pp2.nama, pp2.alamat FROM perkara p JOIN perkara_pihak2 pp2 ON pp2.perkara_id = p.perkara_id WHERE p.nomor_perkara = ? ORDER BY peran, urutan",
    securityStatus: "SAFE_READ_ONLY",
    allowedForAi: true,
    allowedForWhatsapp: false,
    allowedForPdf: false,
    roles: ["superadmin", "admin", "ketua", "wakil", "panitera", "hakim", "panitera_pengganti"],
    riskNotes: ["Data pihak harus dimasking untuk role yang tidak berwenang."],
  },
  {
    queryId: "qry-sipp-monitoring-minutasi",
    queryKey: "QRY_SIPP_MONITORING_MINUTASI",
    name: "Monitoring Minutasi",
    category: "Penilaian SIPP",
    source: "sk_penilaian_sipp_2024_draft_mapping",
    shortDescription: "Draft query untuk memantau perkara putus yang belum lengkap minutasi.",
    longDescription:
      "Query ini perlu diverifikasi dengan indikator resmi SK Penilaian SIPP 2024. Status awal NEEDS_REVIEW karena rumus/batas hari harus dibaca dari SK dan kebijakan Badilag.",
    tables: ["perkara", "perkara_putusan", "perkara_proses"],
    outputColumns: ["nomor_perkara", "tanggal_putusan", "status_minutasi"],
    parameters: [
      { name: "tanggal_mulai", label: "Tanggal Mulai", type: "date", required: true },
      { name: "tanggal_selesai", label: "Tanggal Selesai", type: "date", required: true },
    ],
    originalSql:
      "SELECT p.nomor_perkara, pp.tanggal_putusan, pr.proses_nama AS status_minutasi FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id LEFT JOIN perkara_proses pr ON pr.perkara_id = p.perkara_id WHERE pp.tanggal_putusan BETWEEN :tanggal_mulai AND :tanggal_selesai",
    normalizedSql:
      "SELECT p.nomor_perkara, pp.tanggal_putusan, pr.proses_nama AS status_minutasi FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id LEFT JOIN perkara_proses pr ON pr.perkara_id = p.perkara_id WHERE pp.tanggal_putusan BETWEEN ? AND ?",
    securityStatus: "NEEDS_REVIEW",
    allowedForAi: true,
    allowedForWhatsapp: false,
    allowedForPdf: false,
    roles: ["superadmin", "admin", "ketua", "wakil", "panitera", "panitera_muda"],
    riskNotes: ["Rumus minutasi final harus mengikuti SK. Jika SK tidak memuat rumus eksplisit, indikator diberi catatan asumsi."],
  },
];

export function listAletaSippQueryDefinitions() {
  return ALETA_SIPP_QUERY_REGISTRY;
}

export function getAletaSippQueryDefinition(queryKey: string) {
  const definition = ALETA_SIPP_QUERY_REGISTRY.find((item) => item.queryKey === queryKey);
  if (!definition) throw new Error("Query ALETA x SIPP tidak terdaftar.");
  return definition;
}

export function assertAletaSippQueryIsSafeForExecution(definition: AletaSippQueryDefinition) {
  const safety = validateAletaSippSelectOnlySql(definition.normalizedSql);
  if (!safety.selectOnly || definition.securityStatus !== "SAFE_READ_ONLY") {
    throw new Error(safety.blockedReason ?? "Query belum berstatus SAFE_READ_ONLY.");
  }
}
