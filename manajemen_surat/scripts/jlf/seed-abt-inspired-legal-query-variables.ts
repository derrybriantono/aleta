import { createAletaDatabase } from "../../src/server/db/client";

type GeneratedVariable = {
  key: string;
  label: string;
  description: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey: string;
  sqlPreview: string;
  queryKey: string;
  adminNote: string;
};

const TARGET_COUNT = 5_000;
const PREFIX = "jlf_abt_query";
const NOW = new Date().toISOString();

const ABT_ANALYSIS_NOTE =
  "Dibuat dari analisis abt_variabel.xls: data_sql dominan, banyak CASE WHEN, CONCAT, EXISTS, GROUP_CONCAT, join pihak, pejabat perkara, mediasi, ikrar talak, akta cerai, putusan, e-Court, dan placeholder legacy. Query ini hanya preview untuk review admin; eksekusi SIPP tetap lewat adapter read-only/query registry.";

const PARTY_SIDES = [
  {
    side: "penggugat",
    partyTable: "perkara_pihak1",
    partyKe: 1,
    singularDefault: "Penggugat",
    singularPetition: "Pemohon",
    pluralDefault: "para Penggugat",
    pluralPetition: "para Pemohon",
    counterparty: "Tergugat/Termohon",
    label: "Penggugat/Pemohon",
  },
  {
    side: "tergugat",
    partyTable: "perkara_pihak2",
    partyKe: 2,
    singularDefault: "Tergugat",
    singularPetition: "Termohon",
    pluralDefault: "para Tergugat",
    pluralPetition: "para Termohon",
    counterparty: "Penggugat/Pemohon",
    label: "Tergugat/Termohon",
  },
  {
    side: "intervensi",
    partyTable: "perkara_pihak3",
    partyKe: 3,
    singularDefault: "Pihak Intervensi",
    singularPetition: "Pihak Intervensi",
    pluralDefault: "para Pihak Intervensi",
    pluralPetition: "para Pihak Intervensi",
    counterparty: "Para Pihak",
    label: "Pihak Intervensi",
  },
  {
    side: "turut_tergugat",
    partyTable: "perkara_pihak4",
    partyKe: 4,
    singularDefault: "Turut Tergugat",
    singularPetition: "Turut Termohon",
    pluralDefault: "para Turut Tergugat",
    pluralPetition: "para Turut Termohon",
    counterparty: "Penggugat/Pemohon",
    label: "Turut Tergugat/Turut Termohon",
  },
] as const;

const IDENTITY_FIELDS = [
  { key: "nama_dengan_status", label: "Nama dengan Status Hukum", dataType: "text", transform: "format_nama_pihak" },
  { key: "identitas_formil", label: "Identitas Formil", dataType: "long_text", transform: "sanitize_text" },
  { key: "alamat_domisili", label: "Alamat Domisili", dataType: "long_text", transform: "format_alamat" },
  { key: "agama_pendidikan_pekerjaan", label: "Agama Pendidikan Pekerjaan", dataType: "long_text", transform: "sanitize_text" },
  { key: "umur_dan_tempat_lahir", label: "Umur dan Tempat Lahir", dataType: "text", transform: "sanitize_text" },
  { key: "nomor_identitas_masked", label: "Nomor Identitas Masked", dataType: "text", transform: "sanitize_text" },
  { key: "relasi_keluarga", label: "Relasi Keluarga", dataType: "long_text", transform: "sanitize_text" },
  { key: "status_kehadiran", label: "Status Kehadiran Sidang", dataType: "text", transform: "sanitize_text" },
] as const;

const OFFICIALS = [
  { key: "hakim", sourceType: "sipp_hakim", table: "perkara_hakim_pn", refTable: "hakim_pn", fk: "hakim_id", label: "Hakim", orderColumn: "urutan" },
  { key: "panitera", sourceType: "sipp_panitera", table: "perkara_panitera_pn", refTable: "panitera_pn", fk: "panitera_id", label: "Panitera Pengganti", orderColumn: "id" },
  { key: "jurusita", sourceType: "sipp_jurusita", table: "perkara_jurusita", refTable: "jurusita", fk: "jurusita_id", label: "Jurusita/JSP", orderColumn: "urutan" },
] as const;

const OFFICIAL_STYLES = [
  { key: "nama_aktif", label: "Nama Aktif", dataType: "text", transform: "format_nama_pihak" },
  { key: "jabatan_dalam_sidang", label: "Jabatan dalam Sidang", dataType: "text", transform: "sanitize_text" },
  { key: "redaksi_penetapan", label: "Redaksi Penetapan", dataType: "long_text", transform: "sanitize_text" },
  { key: "kelengkapan_susunan", label: "Kelengkapan Susunan", dataType: "long_text", transform: "sanitize_text" },
  { key: "daftar_nama", label: "Daftar Nama", dataType: "long_text", transform: "sanitize_text" },
] as const;

const HEARING_STYLES = [
  { key: "tanggal_sidang_terpilih", label: "Tanggal Sidang Terpilih", dataType: "date", transform: "tanggal_indonesia_panjang" },
  { key: "agenda_sidang", label: "Agenda Sidang", dataType: "text", transform: "sanitize_text" },
  { key: "redaksi_panggilan_sidang", label: "Redaksi Panggilan Sidang", dataType: "long_text", transform: "sanitize_text" },
  { key: "redaksi_buka_sidang", label: "Redaksi Pembukaan Sidang", dataType: "long_text", transform: "sanitize_text" },
  { key: "redaksi_tunda_sidang", label: "Redaksi Penundaan Sidang", dataType: "long_text", transform: "sanitize_text" },
  { key: "validasi_jadwal_sidang", label: "Validasi Jadwal Sidang", dataType: "long_text", transform: "sanitize_text" },
] as const;

const LEGAL_TEXT_PATTERNS = [
  { key: "jenis_gugatan_permohonan", label: "Jenis Gugatan atau Permohonan", sourceType: "sipp_perkara", dataType: "text" },
  { key: "penyebutan_para_pihak", label: "Penyebutan Para Pihak", sourceType: "sipp_perkara", dataType: "text" },
  { key: "frasa_kedudukan_hukum", label: "Frasa Kedudukan Hukum", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "redaksi_ecourt", label: "Redaksi e-Court", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "pertimbangan_pmh", label: "Pertimbangan PMH Majelis/Tunggal", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "pertimbangan_phs", label: "Pertimbangan PHS", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "redaksi_verstek", label: "Redaksi Verstek", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "redaksi_sidang_keliling", label: "Redaksi Sidang Keliling", sourceType: "sipp_perkara", dataType: "long_text" },
  { key: "kelengkapan_data_sipp", label: "Validasi Kelengkapan Data SIPP", sourceType: "sipp_perkara", dataType: "long_text" },
] as const;

const SPECIAL_TABLE_PATTERNS = [
  { key: "mediasi_hasil", label: "Hasil Mediasi", sourceType: "sipp_perkara", dataType: "long_text", table: "perkara_mediasi" },
  { key: "mediasi_redaksi", label: "Redaksi Mediasi", sourceType: "sipp_perkara", dataType: "long_text", table: "perkara_mediasi" },
  { key: "akta_cerai_keadaan_istri", label: "Keadaan Istri dalam Akta Cerai", sourceType: "sipp_putusan", dataType: "text", table: "perkara_akta_cerai" },
  { key: "akta_cerai_redaksi", label: "Redaksi Akta Cerai", sourceType: "sipp_putusan", dataType: "long_text", table: "perkara_akta_cerai" },
  { key: "ikrar_talak_redaksi", label: "Redaksi Ikrar Talak", sourceType: "sipp_putusan", dataType: "long_text", table: "perkara_ikrar_talak" },
  { key: "putusan_amar_ringkas", label: "Amar Putusan Ringkas", sourceType: "sipp_putusan", dataType: "long_text", table: "perkara_putusan" },
  { key: "putusan_status_bht", label: "Status BHT Putusan", sourceType: "sipp_putusan", dataType: "text", table: "perkara_putusan" },
  { key: "biaya_pembebanan", label: "Pembebanan Biaya Perkara", sourceType: "sipp_keuangan", dataType: "currency", table: "perkara_biaya" },
] as const;

function pad(value: number, length = 4) {
  return String(value).padStart(length, "0");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sql(value: string) {
  return value.trim().replace(/\n{3,}/g, "\n\n") + "\n";
}

function mysqlQuote(value: string) {
  return value.replace(/'/g, "''");
}

function sourceTypeForPattern(sourceType: string): string {
  return sourceType;
}

function buildPartyRoleSql(side: (typeof PARTY_SIDES)[number], variant: number) {
  const mode = variant % 5;
  const extraCondition = mode === 0
    ? "AND p.jenis_perkara_id IN (346, 347, 360, 362, 370)"
    : mode === 1
      ? "AND p.alur_perkara_id IN (15, 16, 122, 123)"
      : "";

  return sql(`
SELECT
  CASE
    WHEN MAX(pp.urutan) = 1 AND p.alur_perkara_id = 16 THEN '${side.singularPetition}'
    WHEN MAX(pp.urutan) > 1 AND p.alur_perkara_id = 16 THEN '${side.pluralPetition}'
    WHEN MAX(pp.urutan) = 1 AND p.jenis_perkara_id IN (346, 341) THEN '${side.singularPetition}'
    WHEN MAX(pp.urutan) > 1 AND p.jenis_perkara_id IN (346, 341) THEN '${side.pluralPetition}'
    WHEN MAX(pp.urutan) = 1 AND p.alur_perkara_id IN (122, 123) THEN ${side.partyKe === 1 ? "'Penuntut Umum'" : "'Terdakwa'"}
    WHEN MAX(pp.urutan) > 1 AND p.alur_perkara_id IN (122, 123) THEN ${side.partyKe === 1 ? "'para Penuntut Umum'" : "'para Terdakwa'"}
    WHEN MAX(pp.urutan) = 1 THEN '${side.singularDefault}'
    WHEN MAX(pp.urutan) > 1 THEN '${side.pluralDefault}'
    ELSE '${side.label}'
  END AS data
FROM ${side.partyTable} AS pp
JOIN perkara AS p ON p.perkara_id = pp.perkara_id
WHERE pp.perkara_id = #perkara_id#
  ${extraCondition}
GROUP BY pp.perkara_id, p.alur_perkara_id, p.jenis_perkara_id;`);
}

function buildPartyIdentitySql(side: (typeof PARTY_SIDES)[number], field: (typeof IDENTITY_FIELDS)[number], order: number, variant: number) {
  const nameExpression = "COALESCE(pp.nama, ph.nama, '')";
  const orderCondition = variant % 3 === 0 ? `pp.urutan = ${order}` : `pp.urutan BETWEEN ${order} AND ${order + (variant % 2)}`;
  const selectByField: Record<string, string> = {
    nama_dengan_status: `CONCAT(${nameExpression}, ' sebagai ', CASE WHEN p.alur_perkara_id = 16 THEN '${side.singularPetition}' ELSE '${side.singularDefault}' END)`,
    identitas_formil: `CONCAT(${nameExpression}, ', umur ', COALESCE(ph.umur, '-'), ' tahun, agama ', COALESCE(ag.nama, '-'), ', pekerjaan ', COALESCE(ph.pekerjaan, '-'), ', pendidikan ', COALESCE(tp.kode, '-'))`,
    alamat_domisili: `CONCAT('bertempat tinggal di ', COALESCE(pp.alamat, ph.alamat, '-'), CASE WHEN COALESCE(ph.kelurahan, '') != '' THEN CONCAT(', Kelurahan/Desa ', ph.kelurahan) ELSE '' END, CASE WHEN COALESCE(ph.kecamatan, '') != '' THEN CONCAT(', Kecamatan ', ph.kecamatan) ELSE '' END)`,
    agama_pendidikan_pekerjaan: `CONCAT('beragama ', COALESCE(ag.nama, '-'), ', pendidikan ', COALESCE(tp.kode, '-'), ', pekerjaan ', COALESCE(ph.pekerjaan, '-'))`,
    umur_dan_tempat_lahir: `CONCAT(COALESCE(ph.tempat_lahir, '-'), ', ', COALESCE(DATE_FORMAT(ph.tanggal_lahir, '%d-%m-%Y'), '-'), ', umur ', COALESCE(ph.umur, '-'), ' tahun')`,
    nomor_identitas_masked: `CASE WHEN COALESCE(ph.nomor_indentitas, '') = '' THEN 'nomor identitas belum tersedia' ELSE CONCAT(LEFT(ph.nomor_indentitas, 4), '********', RIGHT(ph.nomor_indentitas, 4)) END`,
    relasi_keluarga: `CONCAT('anak dari ', COALESCE(ph.nama_ayah, '-'), CASE WHEN COALESCE(ph.nama_ibu, '') != '' THEN CONCAT(' dan ', ph.nama_ibu) ELSE '' END)`,
    status_kehadiran: `CASE WHEN EXISTS (SELECT 1 FROM perkara_jadwal_sidang_detil AS jsd WHERE jsd.perkara_id = pp.perkara_id AND jsd.pihak_id = pp.pihak_id) THEN 'hadir/tercatat dalam detail sidang' ELSE 'kehadiran belum tercatat pada detail sidang' END`,
  };

  return sql(`
SELECT
  ${selectByField[field.key]} AS data
FROM ${side.partyTable} AS pp
JOIN perkara AS p ON p.perkara_id = pp.perkara_id
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
LEFT JOIN agama AS ag ON ag.id = ph.agama_id
LEFT JOIN tingkat_pendidikan AS tp ON tp.id = ph.pendidikan_id
WHERE pp.perkara_id = #perkara_id#
  AND ${orderCondition}
ORDER BY pp.urutan ASC
LIMIT 1;`);
}

function buildCounselSql(side: (typeof PARTY_SIDES)[number], order: number, variant: number) {
  const selectExpression = [
    "CONCAT('Kuasa ', CASE WHEN p.alur_perkara_id = 16 THEN '" + side.singularPetition + "' ELSE '" + side.singularDefault + "' END, ': ', COALESCE(pg.nama, '-'))",
    "CONCAT(COALESCE(pg.nama, '-'), ', berdasarkan surat kuasa tanggal ', COALESCE(DATE_FORMAT(pg.tanggal_kuasa, '%d-%m-%Y'), '-'))",
    "CONCAT('Nomor surat kuasa: ', COALESCE(pg.nomor_kuasa, '-'), ', tanggal ', COALESCE(DATE_FORMAT(pg.tanggal_kuasa, '%d-%m-%Y'), '-'))",
    "CASE WHEN COALESCE(pg.nama, '') = '' THEN 'Kuasa hukum belum tercatat' ELSE CONCAT('Kuasa hukum tercatat atas nama ', pg.nama) END",
    "CONCAT(COALESCE(pg.nama, '-'), ', pendidikan ', COALESCE(tp.kode, '-'), ', pekerjaan ', COALESCE(ph.pekerjaan, '-'))",
  ][variant % 5];

  return sql(`
SELECT
  ${selectExpression} AS data
FROM perkara_pengacara AS pg
JOIN perkara AS p ON p.perkara_id = pg.perkara_id
LEFT JOIN pihak AS ph ON ph.id = pg.pihak_id
LEFT JOIN tingkat_pendidikan AS tp ON tp.id = ph.pendidikan_id
WHERE pg.perkara_id = #perkara_id#
  AND pg.pihak_ke = ${side.partyKe}
  AND pg.urutan = ${order}
LIMIT 1;`);
}

function buildOfficialSql(official: (typeof OFFICIALS)[number], style: (typeof OFFICIAL_STYLES)[number], order: number, variant: number) {
  const refAlias = "r";
  const tableAlias = "po";
  const orderPredicate = official.key === "panitera" ? "1 = 1" : `${tableAlias}.${official.orderColumn} = ${order}`;
  const selectByStyle: Record<string, string> = {
    nama_aktif: `COALESCE(${refAlias}.nama_gelar, ${refAlias}.nama, ${tableAlias}.${official.key}_nama, '-')`,
    jabatan_dalam_sidang: `CONCAT('${official.label}', CASE WHEN COALESCE(${tableAlias}.aktif, 'Y') = 'Y' THEN ' aktif' ELSE ' tidak aktif' END, ' pada perkara')`,
    redaksi_penetapan: `CONCAT('${official.label} yang ditunjuk dalam perkara ini adalah ', COALESCE(${refAlias}.nama_gelar, ${refAlias}.nama, '-'), CASE WHEN EXISTS (SELECT 1 FROM perkara_efiling_id AS ei WHERE ei.perkara_id = ${tableAlias}.perkara_id AND COALESCE(ei.efiling_id, '') != '') THEN ', perkara terdaftar melalui e-Court' ELSE '' END)`,
    kelengkapan_susunan: `CASE WHEN COUNT(*) OVER() >= ${official.key === "hakim" ? 3 : 1} THEN CONCAT('Susunan ${official.label} telah tersedia') ELSE CONCAT('Susunan ${official.label} perlu dilengkapi') END`,
    daftar_nama: `GROUP_CONCAT(COALESCE(${refAlias}.nama_gelar, ${refAlias}.nama, '-') ORDER BY ${tableAlias}.${official.orderColumn} SEPARATOR '; ')`,
  };
  const needsGroup = style.key === "daftar_nama";

  return sql(`
SELECT
  ${selectByStyle[style.key]} AS data
FROM ${official.table} AS ${tableAlias}
LEFT JOIN ${official.refTable} AS ${refAlias} ON ${refAlias}.id = ${tableAlias}.${official.fk}
WHERE ${tableAlias}.perkara_id = #perkara_id#
  AND COALESCE(${tableAlias}.aktif, 'Y') = 'Y'
  AND ${orderPredicate}
${needsGroup ? `GROUP BY ${tableAlias}.perkara_id` : `ORDER BY ${tableAlias}.${official.orderColumn} ASC
LIMIT 1`};`);
}

function buildHearingSql(style: (typeof HEARING_STYLES)[number], order: number, variant: number) {
  const selectedPredicate = variant % 4 === 0 ? "js.id = #sidang_id#" : `js.urutan = ${order}`;
  const selectByStyle: Record<string, string> = {
    tanggal_sidang_terpilih: "js.tanggal_sidang",
    agenda_sidang: "COALESCE(js.agenda, js.agenda_sidang, '-')",
    redaksi_panggilan_sidang: "CONCAT('Para pihak dipanggil untuk hadir pada sidang ke-', COALESCE(js.urutan, '-'), ' tanggal ', COALESCE(DATE_FORMAT(js.tanggal_sidang, '%d-%m-%Y'), '-'), ' dengan agenda ', COALESCE(js.agenda, js.agenda_sidang, '-'))",
    redaksi_buka_sidang: "CONCAT('Sidang dibuka dan dinyatakan terbuka untuk umum pada hari ', COALESCE(DAYNAME(js.tanggal_sidang), '-'), ', tanggal ', COALESCE(DATE_FORMAT(js.tanggal_sidang, '%d-%m-%Y'), '-'), ', agenda ', COALESCE(js.agenda, js.agenda_sidang, '-'))",
    redaksi_tunda_sidang: "CASE WHEN COALESCE(js.ditunda, '') IN ('Y', '1') THEN CONCAT('Sidang ditunda dengan alasan ', COALESCE(js.alasan_ditunda, '-')) ELSE 'Sidang tidak tercatat sebagai sidang tunda' END",
    validasi_jadwal_sidang: "CASE WHEN js.tanggal_sidang IS NULL THEN 'Tanggal sidang belum tersedia' WHEN js.agenda IS NULL AND js.agenda_sidang IS NULL THEN 'Agenda sidang belum tersedia' ELSE 'Data jadwal sidang tersedia' END",
  };

  return sql(`
SELECT
  ${selectByStyle[style.key]} AS data
FROM perkara_jadwal_sidang AS js
WHERE js.perkara_id = #perkara_id#
  AND ${selectedPredicate}
ORDER BY js.tanggal_sidang ASC, js.urutan ASC
LIMIT 1;`);
}

function buildLegalTextSql(pattern: (typeof LEGAL_TEXT_PATTERNS)[number], variant: number) {
  const variantTag = `JLF-${pattern.key}-${pad(variant, 3)}`;
  const selectByPattern: Record<string, string> = {
    jenis_gugatan_permohonan: "CASE WHEN p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341) THEN 'Permohonan' ELSE 'Gugatan' END",
    penyebutan_para_pihak: "CASE WHEN p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341) THEN 'Pemohon dan Termohon' WHEN p.alur_perkara_id IN (122, 123) THEN 'Penuntut Umum dan Terdakwa' ELSE 'Penggugat dan Tergugat' END",
    frasa_kedudukan_hukum: "CONCAT('Dalam perkara ', COALESCE(p.jenis_perkara_nama, '-'), ', kedudukan hukum para pihak adalah ', CASE WHEN p.alur_perkara_id = 16 THEN 'Pemohon/Termohon' ELSE 'Penggugat/Tergugat' END)",
    redaksi_ecourt: "CASE WHEN EXISTS (SELECT 1 FROM perkara_efiling_id AS ei WHERE ei.perkara_id = p.perkara_id AND COALESCE(ei.efiling_id, '') != '') THEN CONCAT('Perkara terdaftar secara elektronik melalui e-Court dengan register Nomor #0001# tanggal #1061# [', '" + variantTag + "', ']') ELSE CONCAT('Perkara terdaftar dalam register kepaniteraan Nomor #0001# tanggal #1061# [', '" + variantTag + "', ']') END",
    pertimbangan_pmh: "CASE WHEN EXISTS (SELECT 1 FROM perkara_efiling_id AS ei WHERE ei.perkara_id = p.perkara_id AND COALESCE(ei.efiling_id, '') != '') THEN CONCAT('#7051# #8008# telah membaca surat #0053# #0046# yang didaftarkan secara elektronik; Menimbang, perlu ditetapkan #0690# untuk memeriksa perkara tersebut. [', '" + variantTag + "', ']') ELSE CONCAT('#7051# #8008# telah membaca surat #0053# #0046# yang terdaftar dalam register; Menimbang, perlu ditetapkan #0690# untuk memeriksa perkara tersebut. [', '" + variantTag + "', ']') END",
    pertimbangan_phs: "CONCAT('Menimbang, bahwa perkara ', COALESCE(p.jenis_perkara_nama, '-'), ' perlu ditetapkan hari sidangnya dengan memperhatikan kesiapan para pihak dan agenda persidangan. [', '" + variantTag + "', ']')",
    redaksi_verstek: "CASE WHEN EXISTS (SELECT 1 FROM perkara_jadwal_sidang_detil AS jsd WHERE jsd.perkara_id = p.perkara_id AND COALESCE(jsd.dihadiri_oleh, '') LIKE '%Tergugat%') THEN 'Pihak lawan tercatat hadir dalam data sidang' ELSE CONCAT('Pihak lawan tidak hadir, redaksi verstek perlu diperiksa berdasarkan relaas panggilan. [', '" + variantTag + "', ']') END",
    redaksi_sidang_keliling: "CASE WHEN COALESCE(p.proses_terakhir_text, '') LIKE '%sidang keliling%' THEN CONCAT('Perkara diperiksa dalam layanan sidang keliling; redaksi tempat sidang harus disesuaikan. [', '" + variantTag + "', ']') ELSE CONCAT('Tidak terdeteksi sidang keliling pada proses terakhir. [', '" + variantTag + "', ']') END",
    kelengkapan_data_sipp: "CONCAT(CASE WHEN COALESCE(p.nomor_perkara, '') = '' THEN 'Nomor perkara kosong; ' ELSE '' END, CASE WHEN COALESCE(p.jenis_perkara_nama, '') = '' THEN 'Jenis perkara kosong; ' ELSE '' END, CASE WHEN p.tanggal_pendaftaran IS NULL THEN 'Tanggal pendaftaran kosong; ' ELSE '' END, 'Review kelengkapan data perkara. [', '" + variantTag + "', ']')",
  };

  return sql(`
SELECT
  ${selectByPattern[pattern.key]} AS data
FROM perkara AS p
WHERE p.perkara_id = #perkara_id#
LIMIT 1;`);
}

function buildSpecialTableSql(pattern: (typeof SPECIAL_TABLE_PATTERNS)[number], variant: number) {
  const variantTag = `JLF-${pattern.key}-${pad(variant, 3)}`;
  const selectByPattern: Record<string, string> = {
    mediasi_hasil: "CASE WHEN hasil_mediasi = 'Y1' THEN 'berhasil dengan kesepakatan' WHEN hasil_mediasi = 'Y2' THEN 'berhasil dengan pencabutan' WHEN hasil_mediasi = 'S' THEN 'berhasil sebagian' WHEN hasil_mediasi = 'T' THEN 'tidak berhasil mencapai kesepakatan' WHEN hasil_mediasi = 'D' THEN 'tidak dapat dilaksanakan' ELSE 'hasil mediasi belum tersedia' END",
    mediasi_redaksi: "CONCAT('Mediator ', COALESCE(mediator_nama, '-'), ' melaporkan mediasi ', CASE WHEN hasil_mediasi IN ('Y1','Y2','S') THEN 'berhasil/berhasil sebagian' ELSE 'tidak berhasil atau belum terlaksana' END, '. [', '" + variantTag + "', ']')",
    akta_cerai_keadaan_istri: "CASE WHEN keadaan_istri = 1 THEN 'suci' WHEN keadaan_istri = 2 THEN 'haid' WHEN keadaan_istri = 3 THEN 'sedang hamil' ELSE 'keadaan istri perlu diperiksa' END",
    akta_cerai_redaksi: "CONCAT('Akta cerai diterbitkan dengan nomor ', COALESCE(nomor_akta_cerai, '-'), ', keadaan istri: ', CASE WHEN keadaan_istri = 1 THEN 'suci' WHEN keadaan_istri = 2 THEN 'haid' WHEN keadaan_istri = 3 THEN 'sedang hamil' ELSE 'belum jelas' END, '. [', '" + variantTag + "', ']')",
    ikrar_talak_redaksi: "CONCAT('Ikrar talak dilaksanakan pada tanggal ', COALESCE(DATE_FORMAT(tgl_ikrar_talak, '%d-%m-%Y'), '-'), ' di hadapan majelis/hakim yang berwenang. [', '" + variantTag + "', ']')",
    putusan_amar_ringkas: "CASE WHEN COALESCE(amar_putusan, '') = '' THEN 'Amar putusan belum tersedia' ELSE CONCAT(LEFT(amar_putusan, 900), CASE WHEN LENGTH(amar_putusan) > 900 THEN ' ...' ELSE '' END) END",
    putusan_status_bht: "CASE WHEN tanggal_bht IS NOT NULL THEN CONCAT('BHT tanggal ', DATE_FORMAT(tanggal_bht, '%d-%m-%Y')) WHEN tanggal_putusan IS NOT NULL THEN 'Putusan sudah diucapkan, status BHT perlu diperiksa' ELSE 'Data putusan belum tersedia' END",
    biaya_pembebanan: "COALESCE(jumlah, 0)",
  };

  const dateOrderColumn = pattern.table === "perkara_mediasi"
    ? "tanggal_mediasi"
    : pattern.table === "perkara_putusan"
      ? "tanggal_putusan"
      : "id";

  return sql(`
SELECT
  ${selectByPattern[pattern.key]} AS data
FROM ${pattern.table}
WHERE perkara_id = #perkara_id#
ORDER BY ${dateOrderColumn} DESC
LIMIT 1;`);
}

function buildBasQuestionSql(side: (typeof PARTY_SIDES)[number], order: number, variant: number) {
  const questionKinds = [
    "identitas pihak",
    "pokok gugatan/permohonan",
    "upaya perdamaian",
    "alat bukti",
    "keterangan saksi",
    "kesimpulan para pihak",
  ];
  const question = questionKinds[variant % questionKinds.length];
  return sql(`
SELECT
  CONCAT(
    'Pertanyaan BAS kepada ${side.label} urutan ${order}: Apakah Saudara membenarkan ',
    '${mysqlQuote(question)}',
    ' sebagaimana tercatat dalam perkara Nomor #0001#? Jawaban dicatat dan diverifikasi oleh majelis.'
  ) AS data
FROM perkara AS p
WHERE p.perkara_id = #perkara_id#
LIMIT 1;`);
}

function buildVariable(index: number): GeneratedVariable {
  const family = index % 10;
  const sequence = Math.floor(index / 10) + 1;

  if (family === 0) {
    const side = PARTY_SIDES[index % PARTY_SIDES.length];
    const keyPart = `kedudukan_hukum_${side.side}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `Kedudukan Hukum ${side.label} - Varian ${sequence}`,
      description: "Redaksi penyebutan hukum pihak berdasarkan alur dan jenis perkara, meniru pola CASE WHEN ABT.",
      dataType: "text",
      sourceType: "sipp_perkara",
      sourceKey: `abt_inspired.${side.side}.kedudukan_hukum.${sequence}`,
      transformKey: "sanitize_text",
      sqlPreview: buildPartyRoleSql(side, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 1) {
    const side = PARTY_SIDES[index % PARTY_SIDES.length];
    const field = IDENTITY_FIELDS[sequence % IDENTITY_FIELDS.length];
    const order = (sequence % 20) + 1;
    const keyPart = `identitas_${side.side}_${pad(order, 2)}_${field.key}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `${field.label} ${side.label} ${order}`,
      description: "Identitas pihak dengan join SIPP dan redaksi formil perkara.",
      dataType: field.dataType,
      sourceType: "sipp_pihak",
      sourceKey: `abt_inspired.${side.side}.${order}.${field.key}.${sequence}`,
      transformKey: field.transform,
      sqlPreview: buildPartyIdentitySql(side, field, order, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 2) {
    const side = PARTY_SIDES[index % 2];
    const order = (sequence % 8) + 1;
    const keyPart = `kuasa_${side.side}_${pad(order, 2)}_redaksi_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `Redaksi Kuasa ${side.label} ${order}`,
      description: "Data dan redaksi kuasa hukum pihak dari perkara_pengacara, mengikuti pola ABT kuasa pihak.",
      dataType: sequence % 3 === 0 ? "date" : "long_text",
      sourceType: "sipp_pihak",
      sourceKey: `abt_inspired.kuasa.${side.side}.${order}.redaksi.${sequence}`,
      transformKey: sequence % 3 === 0 ? "tanggal_indonesia_panjang" : "sanitize_text",
      sqlPreview: buildCounselSql(side, order, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 3) {
    const official = OFFICIALS[sequence % OFFICIALS.length];
    const style = OFFICIAL_STYLES[sequence % OFFICIAL_STYLES.length];
    const order = (sequence % 5) + 1;
    const keyPart = `${official.key}_${pad(order, 2)}_${style.key}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `${style.label} ${official.label} ${order}`,
      description: "Pejabat perkara aktif dengan redaksi hukum atau validasi susunan.",
      dataType: style.dataType,
      sourceType: official.sourceType,
      sourceKey: `abt_inspired.${official.key}.${order}.${style.key}.${sequence}`,
      transformKey: style.transform,
      sqlPreview: buildOfficialSql(official, style, order, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 4) {
    const style = HEARING_STYLES[sequence % HEARING_STYLES.length];
    const order = (sequence % 25) + 1;
    const keyPart = `bas_sidang_${pad(order, 2)}_${style.key}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `${style.label} ke-${order}`,
      description: "Redaksi BAS dan jadwal sidang, termasuk sidang terpilih dan validasi agenda.",
      dataType: style.dataType,
      sourceType: "sipp_jadwal_sidang",
      sourceKey: `abt_inspired.sidang.${order}.${style.key}.${sequence}`,
      transformKey: style.transform,
      sqlPreview: buildHearingSql(style, order, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 5) {
    const pattern = LEGAL_TEXT_PATTERNS[sequence % LEGAL_TEXT_PATTERNS.length];
    const keyPart = `redaksi_hukum_${pattern.key}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `${pattern.label} - Varian ${sequence}`,
      description: "Redaksi hukum administratif berbasis perkara, e-Court, PMH/PHS, atau validasi data.",
      dataType: pattern.dataType,
      sourceType: sourceTypeForPattern(pattern.sourceType),
      sourceKey: `abt_inspired.redaksi_hukum.${pattern.key}.${sequence}`,
      transformKey: "sanitize_text",
      sqlPreview: buildLegalTextSql(pattern, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 6) {
    const pattern = SPECIAL_TABLE_PATTERNS[sequence % SPECIAL_TABLE_PATTERNS.length];
    const keyPart = `${pattern.key}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `${pattern.label} - Varian ${sequence}`,
      description: "Data khusus perkara seperti mediasi, akta cerai, ikrar talak, putusan, BHT, atau biaya perkara.",
      dataType: pattern.dataType,
      sourceType: sourceTypeForPattern(pattern.sourceType),
      sourceKey: `abt_inspired.${pattern.table}.${pattern.key}.${sequence}`,
      transformKey: pattern.dataType === "currency" ? "rupiah" : "sanitize_text",
      sqlPreview: buildSpecialTableSql(pattern, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  if (family === 7) {
    const side = PARTY_SIDES[sequence % 2];
    const order = (sequence % 10) + 1;
    const keyPart = `bas_tanya_jawab_${side.side}_${pad(order, 2)}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `BAS Tanya Jawab ${side.label} ${order}`,
      description: "Template redaksi pertanyaan/jawaban BAS berbasis perkara, sebagai pengganti pola tanya_jawab ABT.",
      dataType: "long_text",
      sourceType: "jlf_bas_qa",
      sourceKey: `abt_inspired.bas_qa.${side.side}.${order}.${sequence}`,
      transformKey: "sanitize_text",
      sqlPreview: buildBasQuestionSql(side, order, sequence),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: `${ABT_ANALYSIS_NOTE} Source type JLF adalah jlf_bas_qa; SQL preview hanya menggambarkan konteks perkara untuk review.`,
    };
  }

  if (family === 8) {
    const side = PARTY_SIDES[sequence % PARTY_SIDES.length];
    const order = (sequence % 15) + 1;
    const keyPart = `validasi_pihak_${side.side}_${pad(order, 2)}_${pad(sequence)}`;
    return {
      key: `${PREFIX}_${keyPart}`,
      label: `Validasi Data ${side.label} ${order}`,
      description: "Validasi kelengkapan pihak untuk mencegah dokumen berisi data kosong/null.",
      dataType: "long_text",
      sourceType: "sipp_pihak",
      sourceKey: `abt_inspired.validation.${side.side}.${order}.${sequence}`,
      transformKey: "sanitize_text",
      sqlPreview: sql(`
SELECT
  CONCAT(
    CASE WHEN COALESCE(pp.nama, ph.nama, '') = '' THEN 'Nama kosong; ' ELSE '' END,
    CASE WHEN COALESCE(pp.alamat, ph.alamat, '') = '' THEN 'Alamat kosong; ' ELSE '' END,
    CASE WHEN COALESCE(ph.pekerjaan, '') = '' THEN 'Pekerjaan kosong; ' ELSE '' END,
    CASE WHEN COALESCE(ph.agama_id, '') = '' THEN 'Agama kosong; ' ELSE '' END,
    CASE WHEN COALESCE(pp.nama, ph.nama, '') != '' AND COALESCE(pp.alamat, ph.alamat, '') != '' THEN 'Data pokok ${side.label} urutan ${order} tersedia' ELSE 'Perlu review data ${side.label} urutan ${order}' END
  ) AS data
FROM ${side.partyTable} AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = #perkara_id#
  AND pp.urutan = ${order}
LIMIT 1;`),
      queryKey: `sipp.abt_inspired.${keyPart}`,
      adminNote: ABT_ANALYSIS_NOTE,
    };
  }

  const side = PARTY_SIDES[sequence % PARTY_SIDES.length];
  const keyPart = `ringkasan_perkara_legal_${side.side}_${pad(sequence)}`;
  return {
    key: `${PREFIX}_${keyPart}`,
    label: `Ringkasan Legal Perkara untuk ${side.label} - Varian ${sequence}`,
    description: "Ringkasan legal perkara yang menggabungkan jenis perkara, tahapan, e-Court, dan posisi pihak.",
    dataType: "long_text",
    sourceType: "sipp_perkara",
    sourceKey: `abt_inspired.ringkasan_legal.${side.side}.${sequence}`,
    transformKey: "sanitize_text",
    sqlPreview: sql(`
SELECT
  CONCAT(
    'Perkara ', COALESCE(p.nomor_perkara, '-'),
    ' adalah ', COALESCE(p.jenis_perkara_nama, '-'),
    ', tahapan ', COALESCE(p.tahapan_terakhir_text, '-'),
    ', proses ', COALESCE(p.proses_terakhir_text, '-'),
    CASE WHEN EXISTS (SELECT 1 FROM perkara_efiling_id AS ei WHERE ei.perkara_id = p.perkara_id AND COALESCE(ei.efiling_id, '') != '') THEN ', terdaftar melalui e-Court' ELSE ', terdaftar manual/konvensional' END,
    ', penyebutan pihak utama: ',
    CASE WHEN p.alur_perkara_id = 16 THEN '${side.singularPetition}' ELSE '${side.singularDefault}' END,
    '.'
  ) AS data
FROM perkara AS p
WHERE p.perkara_id = #perkara_id#
LIMIT 1;`),
    queryKey: `sipp.abt_inspired.${keyPart}`,
    adminNote: ABT_ANALYSIS_NOTE,
  };
}

function buildVariables() {
  const map = new Map<string, GeneratedVariable>();
  let index = 0;
  while (map.size < TARGET_COUNT) {
    const variable = buildVariable(index);
    variable.sqlPreview = sql(`
/* ${variable.queryKey}
   ${variable.label}
   Source key: ${variable.sourceKey}
   Catatan: preview SQL untuk review admin JLF, bukan raw SQL endpoint.
*/
${variable.sqlPreview}`);
    map.set(variable.key, variable);
    index += 1;
  }

  const variables = [...map.values()].slice(0, TARGET_COUNT);
  const sqlCount = new Set(variables.map((item) => item.sqlPreview)).size;
  if (sqlCount !== variables.length) {
    throw new Error(`Query preview tidak unik: ${sqlCount}/${variables.length}.`);
  }
  return variables;
}

async function main() {
  const db = await createAletaDatabase({ seed: false, runMigrations: false });
  const variables = buildVariables();
  let stored = 0;

  try {
    for (const variable of variables) {
      await db.prepare(
        `INSERT INTO jlf_variables (
           id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
           fallback_value, is_required, is_active, example_value, admin_note,
           sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key, sipp_query_preview_generated_at,
           created_by, updated_by, created_at, updated_at
         ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, '', 0, 1, '', ?, ?, 'needs_review', ?, ?, NULL, NULL, ?, ?)
         ON CONFLICT (key) DO UPDATE SET
           label = EXCLUDED.label,
           description = EXCLUDED.description,
           data_type = EXCLUDED.data_type,
           source_type = EXCLUDED.source_type,
           source_key = EXCLUDED.source_key,
           transform_key = EXCLUDED.transform_key,
           admin_note = EXCLUDED.admin_note,
           sipp_query_preview = EXCLUDED.sipp_query_preview,
           sipp_query_preview_status = EXCLUDED.sipp_query_preview_status,
           sipp_query_preview_key = EXCLUDED.sipp_query_preview_key,
           sipp_query_preview_generated_at = EXCLUDED.sipp_query_preview_generated_at,
           updated_at = EXCLUDED.updated_at`
      ).run(
        `jlf-var-${variable.key}`,
        variable.key,
        variable.label,
        variable.description,
        variable.dataType,
        variable.sourceType,
        variable.sourceKey,
        variable.transformKey,
        variable.adminNote,
        variable.sqlPreview,
        variable.queryKey,
        NOW,
        NOW,
        NOW
      );
      stored += 1;
    }

    const total = await db
      .prepare("SELECT COUNT(*) AS count FROM jlf_variables WHERE key LIKE ?")
      .get(`${PREFIX}_%`);
    const withPreview = await db
      .prepare("SELECT COUNT(*) AS count FROM jlf_variables WHERE key LIKE ? AND COALESCE(sipp_query_preview, '') != ''")
      .get(`${PREFIX}_%`);

    console.log(
      JSON.stringify(
        {
          requested: TARGET_COUNT,
          stored,
          totalAbtInspired: total,
          withPreview,
          status: "needs_review",
          generatedAt: NOW,
          note: "Seed ABT-inspired selesai. Query preview disimpan untuk review admin dan tidak dieksekusi dari client.",
        },
        null,
        2
      )
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[JLF] Gagal seed variabel ABT-inspired.", error);
  process.exit(1);
});
