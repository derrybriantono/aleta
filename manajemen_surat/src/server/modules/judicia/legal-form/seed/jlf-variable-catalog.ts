import { type AletaDatabase, type SqlInputValue, withTransaction } from "@/server/db/client";
import { resolveJlfFieldMode } from "@/lib/judicia-legal-form-abt";
import { LEGACY_AUTO_DEFINITIONS } from "@/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service";

const CREATED_AT = "2026-05-24T00:00:00.000Z";
const JLF_VARIABLE_INSERT_CHUNK_SIZE = 250;
const JLF_VARIABLE_INSERT_PLACEHOLDER = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

export const JLF_VARIABLE_CATALOG_SOURCE_TYPES = [
  "sipp_perkara",
  "sipp_pihak",
  "sipp_jadwal_sidang",
  "sipp_hakim",
  "sipp_panitera",
  "sipp_jurusita",
  "sipp_putusan",
  "sipp_keuangan",
  "jlf_manual",
  "jlf_temp",
  "jlf_bas_qa",
  "function",
  "qrcode",
  "ai",
  "static",
  "computed",
] as const;

export type JlfVariableCatalogSourceType = (typeof JLF_VARIABLE_CATALOG_SOURCE_TYPES)[number];

export type JlfSeedVariable = {
  key: string;
  label: string;
  dataType: string;
  sourceType: JlfVariableCatalogSourceType;
  sourceKey: string;
  transformKey?: string;
  legacyCode?: string | null;
  fallbackValue?: string;
  legacyAbtType?: string;
  fieldMode?: string;
  aiEnabled?: boolean;
  manualOverrideAllowed?: boolean;
  isRequired?: boolean;
  exampleValue?: string;
  description?: string;
  adminNote?: string;
};

type AbtCompatibleSlot = {
  key: string;
  label: string;
  dataType: string;
  sourceType: JlfVariableCatalogSourceType;
  sourceKey: string;
  transformKey?: string;
  tableHint: string;
  queryHint: string;
  abtType: string;
  sensitive?: boolean;
};

type FieldSpec = {
  key: string;
  label: string;
  dataType?: string;
  transformKey?: string;
  sensitive?: boolean;
  exampleValue?: string;
  legacyCode?: string;
  description?: string;
};

const ABT_COMPATIBLE_VARIABLE_TARGET = 6000;

function title(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeId(value: string) {
  return value.replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function variable(input: JlfSeedVariable): JlfSeedVariable {
  return {
    transformKey: "",
    legacyCode: null,
    fallbackValue: "",
    isRequired: false,
    exampleValue: "",
    description: input.description ?? `${input.label} untuk template dokumen JLF.`,
    adminNote: input.adminNote ?? "Seed katalog variabel JLF dari analisis struktur SIPP dan ABT; review mapping sebelum dipakai di template final.",
    ...input,
  };
}

const manualVariables: JlfSeedVariable[] = [
  variable({
    key: "qr_perkara",
    label: "QR Perkara",
    dataType: "qrcode",
    sourceType: "qrcode",
    sourceKey: "case_verification_payload",
    transformKey: "format_qr_payload",
    legacyCode: "0002",
    exampleValue: "QR aman menuju halaman verifikasi/login ALETA.",
    adminNote: "Mapping legacy #0002#; QR tidak mengekspos file/dokumen dan link tetap membutuhkan otorisasi.",
  }),
  variable({
    key: "nama_jurusita",
    label: "Nama Jurusita",
    dataType: "text",
    sourceType: "sipp_jurusita",
    sourceKey: "nama",
    legacyCode: "0003",
    exampleValue: "Nama jurusita aktif pada perkara.",
  }),
  variable({
    key: "permohonan_gugatan",
    label: "Permohonan/Gugatan",
    dataType: "text",
    sourceType: "computed",
    sourceKey: "jenis_permohonan_gugatan",
    legacyCode: "0053",
    exampleValue: "gugatan",
  }),
  variable({
    key: "kumulasi_gugatan_permohonan",
    label: "Kumulasi Gugatan/Permohonan",
    dataType: "text",
    sourceType: "computed",
    sourceKey: "kumulasi_gugatan_permohonan",
    legacyCode: "7060",
    adminNote: "Legacy ABT #7060#; perlu review karena logika kumulasi bisa berbeda antar jenis perkara.",
  }),
  variable({
    key: "nama_satker",
    label: "Nama Satker",
    dataType: "text",
    sourceType: "static",
    sourceKey: "Pengadilan Agama",
    legacyCode: "8008",
    exampleValue: "Pengadilan Agama Donggala",
    adminNote: "Legacy ABT #8008#; nilai final sebaiknya diambil dari konfigurasi satker/ALETA.",
  }),
  variable({
    key: "nama_satker_huruf_besar",
    label: "Nama Satker Huruf Besar",
    dataType: "text",
    sourceType: "computed",
    sourceKey: "nama_satker_uppercase",
    transformKey: "uppercase",
    legacyCode: "8010",
    exampleValue: "PENGADILAN AGAMA DONGGALA",
  }),
  variable({
    key: "tanggal_hari_ini",
    label: "Tanggal Hari Ini",
    dataType: "date",
    sourceType: "computed",
    sourceKey: "tanggal_hari_ini",
    transformKey: "tanggal_indonesia_panjang",
    exampleValue: "Senin, 25 Mei 2026",
  }),
  variable({
    key: "tahun_hari_ini",
    label: "Tahun Hari Ini",
    dataType: "number",
    sourceType: "computed",
    sourceKey: "tanggal_hari_ini",
    transformKey: "tahun",
    exampleValue: "2026",
  }),
  variable({
    key: "tempat_dokumen_dibuat",
    label: "Tempat Dokumen Dibuat",
    dataType: "text",
    sourceType: "jlf_manual",
    sourceKey: "tempat_dokumen_dibuat",
    fallbackValue: "Donggala",
  }),
  variable({
    key: "catatan_manual_dokumen",
    label: "Catatan Manual Dokumen",
    dataType: "long_text",
    sourceType: "jlf_manual",
    sourceKey: "catatan_manual_dokumen",
  }),
];

const caseFields: FieldSpec[] = [
  { key: "perkara_id", label: "ID Perkara SIPP", dataType: "number" },
  { key: "nomor_perkara", label: "Nomor Perkara", legacyCode: "0001", exampleValue: "317/Pdt.G/2026/PA.Dgl" },
  { key: "nomor_indeks", label: "Nomor Indeks" },
  { key: "nomor_urut_register", label: "Nomor Urut Register", dataType: "number" },
  { key: "nomor_urut_perkara", label: "Nomor Urut Perkara", dataType: "number" },
  { key: "tahun_perkara", label: "Tahun Perkara", dataType: "number", transformKey: "tahun_perkara" },
  { key: "kode_perkara", label: "Kode Perkara" },
  { key: "alur_perkara_id", label: "ID Alur Perkara", dataType: "number" },
  { key: "alur_perkara_nama", label: "Nama Alur Perkara" },
  { key: "jenis_acara", label: "Jenis Acara" },
  { key: "jenis_perkara_id", label: "ID Jenis Perkara", dataType: "number" },
  { key: "jenis_perkara_kode", label: "Kode Jenis Perkara" },
  { key: "jenis_perkara_nama", label: "Nama Jenis Perkara" },
  { key: "jenis_perkara_text", label: "Teks Jenis Perkara" },
  { key: "klasifikasi_perkara", label: "Klasifikasi Perkara" },
  { key: "tanggal_pendaftaran", label: "Tanggal Pendaftaran", dataType: "date", transformKey: "tanggal_indonesia_panjang", legacyCode: "0036" },
  { key: "tanggal_surat", label: "Tanggal Surat Gugatan/Permohonan", dataType: "date", transformKey: "tanggal_indonesia_panjang", legacyCode: "0017" },
  { key: "nomor_surat", label: "Nomor Surat Gugatan/Permohonan" },
  { key: "surat_dok", label: "Referensi Dokumen Surat", sensitive: true },
  { key: "para_pihak", label: "Para Pihak", dataType: "long_text", sensitive: true },
  { key: "pihak1_text", label: "Teks Pihak Pertama", dataType: "long_text", sensitive: true },
  { key: "pihak2_text", label: "Teks Pihak Kedua", dataType: "long_text", sensitive: true },
  { key: "pihak3_text", label: "Teks Pihak Ketiga", dataType: "long_text", sensitive: true },
  { key: "pihak4_text", label: "Teks Turut Tergugat", dataType: "long_text", sensitive: true },
  { key: "pengacara_pihak1", label: "Kuasa Hukum Pihak Pertama", dataType: "long_text", sensitive: true },
  { key: "pengacara_pihak2", label: "Kuasa Hukum Pihak Kedua", dataType: "long_text", sensitive: true },
  { key: "pengacara_pihak3", label: "Kuasa Hukum Pihak Ketiga", dataType: "long_text", sensitive: true },
  { key: "pengacara_pihak4", label: "Kuasa Hukum Turut Tergugat", dataType: "long_text", sensitive: true },
  { key: "posita", label: "Posita", dataType: "long_text", legacyCode: "5125", sensitive: true },
  { key: "petitum", label: "Petitum", dataType: "long_text", sensitive: true },
  { key: "nomor_dakwaan", label: "Nomor Dakwaan" },
  { key: "tanggal_dakwaan", label: "Tanggal Dakwaan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "dakwaan", label: "Dakwaan", dataType: "long_text", sensitive: true },
  { key: "pasal_dakwaan", label: "Pasal Dakwaan", dataType: "long_text" },
  { key: "tanggal_rencana_perdamaian", label: "Tanggal Rencana Perdamaian", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_pengesahan_perdamaian", label: "Tanggal Pengesahan Perdamaian", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_penyelesaian_mediasi", label: "Tanggal Penyelesaian Mediasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_penyelesaian_konsiliasi", label: "Tanggal Penyelesaian Konsiliasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "perkara_rujukan_id", label: "ID Perkara Rujukan", dataType: "number" },
  { key: "nomor_perkara_rujukan", label: "Nomor Perkara Rujukan" },
  { key: "tanggal_pendaftaran_rujukan", label: "Tanggal Pendaftaran Rujukan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "catatan_pendaftaran", label: "Catatan Pendaftaran", dataType: "long_text", sensitive: true },
  { key: "prodeo", label: "Status Prodeo", dataType: "boolean" },
  { key: "terdakwa_anak", label: "Terdakwa Anak", dataType: "boolean" },
  { key: "tahapan_terakhir_id", label: "ID Tahapan Terakhir", dataType: "number" },
  { key: "tahapan_terakhir_text", label: "Tahapan Terakhir" },
  { key: "proses_terakhir_id", label: "ID Proses Terakhir", dataType: "number" },
  { key: "proses_terakhir_text", label: "Proses Terakhir" },
  { key: "nilai_sengketa", label: "Nilai Sengketa", dataType: "currency", transformKey: "rupiah" },
  { key: "pihak_dipublikasikan", label: "Status Publikasi Pihak", dataType: "boolean" },
  { key: "tanggal_input_perkara", label: "Tanggal Input Perkara", dataType: "datetime", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_update_perkara", label: "Tanggal Update Perkara", dataType: "datetime", transformKey: "tanggal_indonesia_panjang" },
  { key: "umur_perkara_hari", label: "Umur Perkara (Hari)", dataType: "number", transformKey: "selisih_hari" },
  { key: "nomor_perkara_masked", label: "Nomor Perkara Masked", transformKey: "mask_nomor_perkara" },
  { key: "ringkasan_perkara", label: "Ringkasan Perkara", dataType: "long_text", sensitive: true },
];

const partyRoles = [
  { prefix: "penggugat", label: "Penggugat/Pemohon", table: "perkara_pihak1", legacyIdentity: "7047" },
  { prefix: "tergugat", label: "Tergugat/Termohon", table: "perkara_pihak2", legacyIdentity: "7048" },
  { prefix: "intervensi", label: "Pihak Intervensi", table: "perkara_pihak3", legacyIdentity: null },
  { prefix: "turut_tergugat", label: "Turut Tergugat", table: "perkara_pihak4", legacyIdentity: null },
  { prefix: "saksi", label: "Saksi", table: "perkara_pihak5", legacyIdentity: null },
] as const;

const partyFields: FieldSpec[] = [
  { key: "nama", label: "Nama" },
  { key: "nama_lengkap", label: "Nama Lengkap" },
  { key: "nama_dengan_alias", label: "Nama Dengan Alias" },
  { key: "alamat", label: "Alamat", sensitive: true },
  { key: "alamat_lengkap", label: "Alamat Lengkap", sensitive: true },
  { key: "identitas_lengkap", label: "Identitas Lengkap", dataType: "long_text", sensitive: true },
  { key: "identitas_ringkas", label: "Identitas Ringkas", dataType: "long_text", sensitive: true },
  { key: "jenis_identitas", label: "Jenis Identitas" },
  { key: "nomor_identitas", label: "Nomor Identitas", sensitive: true },
  { key: "nomor_identitas_masked", label: "Nomor Identitas Masked", transformKey: "mask_identity" },
  { key: "tempat_lahir", label: "Tempat Lahir", sensitive: true },
  { key: "tanggal_lahir", label: "Tanggal Lahir", dataType: "date", transformKey: "tanggal_indonesia_panjang", sensitive: true },
  { key: "umur", label: "Umur", dataType: "number", transformKey: "umur" },
  { key: "agama", label: "Agama" },
  { key: "pekerjaan", label: "Pekerjaan" },
  { key: "pendidikan", label: "Pendidikan" },
  { key: "jenis_kelamin", label: "Jenis Kelamin" },
  { key: "status_kawin", label: "Status Kawin" },
  { key: "warga_negara", label: "Warga Negara" },
  { key: "telepon_masked", label: "Telepon Masked", transformKey: "mask_phone" },
  { key: "email_masked", label: "Email Masked", transformKey: "mask_email" },
  { key: "kelurahan", label: "Kelurahan" },
  { key: "kecamatan", label: "Kecamatan" },
  { key: "kabupaten", label: "Kabupaten" },
  { key: "propinsi", label: "Provinsi" },
  { key: "nama_ayah", label: "Nama Ayah", sensitive: true },
  { key: "nama_ibu", label: "Nama Ibu", sensitive: true },
  { key: "urutan", label: "Urutan", dataType: "number" },
  { key: "kondisi_pihak", label: "Kondisi Pihak" },
  { key: "keterangan", label: "Keterangan", dataType: "long_text", sensitive: true },
];

const indexedPartyFields = partyFields.filter((field) =>
  ["nama", "alamat", "identitas_lengkap", "identitas_ringkas", "pekerjaan", "agama", "pendidikan", "umur", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "status_kawin", "nomor_identitas_masked", "telepon_masked", "email_masked", "kecamatan", "kabupaten", "propinsi"].includes(field.key)
);

const hearingFields: FieldSpec[] = [
  { key: "sidang_id", label: "ID Sidang", dataType: "number" },
  { key: "sidang_ke", label: "Sidang Ke", dataType: "number" },
  { key: "urutan", label: "Urutan Sidang", dataType: "number" },
  { key: "tanggal_sidang", label: "Tanggal Sidang", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "hari_sidang", label: "Hari Sidang", transformKey: "hari_indonesia" },
  { key: "jam_sidang", label: "Jam Sidang" },
  { key: "sampai_jam", label: "Sampai Jam" },
  { key: "agenda", label: "Agenda Sidang" },
  { key: "agenda_id", label: "ID Agenda Sidang" },
  { key: "ruangan", label: "Ruang Sidang" },
  { key: "ruangan_id", label: "ID Ruang Sidang", dataType: "number" },
  { key: "dihadiri_oleh", label: "Dihadiri Oleh" },
  { key: "ditunda", label: "Status Tunda", dataType: "boolean" },
  { key: "alasan_ditunda", label: "Alasan Ditunda", dataType: "long_text" },
  { key: "sifat_sidang", label: "Sifat Sidang" },
  { key: "sidang_keliling", label: "Sidang Keliling", dataType: "boolean" },
  { key: "keterangan_sidang", label: "Keterangan Sidang", dataType: "long_text" },
  { key: "edoc_bas", label: "Referensi e-Doc BAS", sensitive: true },
  { key: "sidang_terakhir_tanggal", label: "Tanggal Sidang Terakhir", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "sidang_berikutnya_tanggal", label: "Tanggal Sidang Berikutnya", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "agenda_sidang_terakhir", label: "Agenda Sidang Terakhir" },
  { key: "agenda_sidang_berikutnya", label: "Agenda Sidang Berikutnya" },
  { key: "daftar_jadwal_sidang", label: "Daftar Jadwal Sidang", dataType: "table", transformKey: "format_jadwal_sidang" },
];

const officialFields: FieldSpec[] = [
  { key: "nama", label: "Nama" },
  { key: "nama_gelar", label: "Nama Dengan Gelar" },
  { key: "nip", label: "NIP", sensitive: true },
  { key: "nip_masked", label: "NIP Masked", transformKey: "mask_identity" },
  { key: "kode", label: "Kode" },
  { key: "jabatan", label: "Jabatan" },
  { key: "pangkat", label: "Pangkat" },
  { key: "tanggal_penetapan", label: "Tanggal Penetapan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nomor_sk_penetapan", label: "Nomor SK Penetapan" },
  { key: "urutan", label: "Urutan", dataType: "number" },
  { key: "aktif", label: "Status Aktif", dataType: "boolean" },
  { key: "keterangan", label: "Keterangan", dataType: "long_text" },
];

const decisionFields: FieldSpec[] = [
  { key: "tanggal_putusan", label: "Tanggal Putusan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "hari_putusan", label: "Hari Putusan", transformKey: "hari_indonesia" },
  { key: "putusan_verstek", label: "Putusan Verstek" },
  { key: "sumber_hukum_id", label: "ID Sumber Hukum" },
  { key: "status_putusan_id", label: "ID Status Putusan", dataType: "number" },
  { key: "status_putusan_kode", label: "Kode Status Putusan" },
  { key: "status_putusan_nama", label: "Nama Status Putusan" },
  { key: "status_putusan_text", label: "Teks Status Putusan", dataType: "long_text" },
  { key: "amar_putusan", label: "Amar Putusan", dataType: "long_text", sensitive: true },
  { key: "amar_putusan_ringkas", label: "Amar Putusan Ringkas", dataType: "long_text", sensitive: true },
  { key: "catatan_putusan", label: "Catatan Putusan", dataType: "long_text", sensitive: true },
  { key: "tanggal_minutasi", label: "Tanggal Minutasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_bht", label: "Tanggal BHT", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "pemberitahuan_putusan", label: "Tanggal Pemberitahuan Putusan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "menerima_putusan_pihak1", label: "Tanggal Terima Putusan Pihak 1", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "menerima_putusan_pihak2", label: "Tanggal Terima Putusan Pihak 2", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "penerbitan_salinan_putusan", label: "Tanggal Penerbitan Salinan Putusan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "kirim_salinan_putusan_pihak1", label: "Tanggal Kirim Salinan Pihak 1", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "kirim_salinan_putusan_pihak2", label: "Tanggal Kirim Salinan Pihak 2", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_cabut", label: "Tanggal Cabut", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_gugur", label: "Tanggal Gugur", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nilai_ganti_kerugian", label: "Nilai Ganti Kerugian", dataType: "currency", transformKey: "rupiah" },
  { key: "nomor_akta_cerai", label: "Nomor Akta Cerai" },
  { key: "tanggal_akta_cerai", label: "Tanggal Akta Cerai", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nomor_seri_akta_cerai", label: "Nomor Seri Akta Cerai" },
  { key: "jenis_cerai", label: "Jenis Cerai" },
  { key: "perceraian_ke", label: "Perceraian Ke", dataType: "number" },
  { key: "tanggal_penyerahan_akta_cerai_pihak1", label: "Tanggal Penyerahan Akta Cerai Pihak 1", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_penyerahan_akta_cerai_pihak2", label: "Tanggal Penyerahan Akta Cerai Pihak 2", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_ikrar_talak", label: "Tanggal Ikrar Talak", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "amar_ikrar_talak", label: "Amar Ikrar Talak", dataType: "long_text", sensitive: true },
  { key: "status_penetapan_ikrar_talak", label: "Status Penetapan Ikrar Talak" },
];

const feeFields: FieldSpec[] = [
  { key: "panjar_perkara", label: "Panjar Perkara", dataType: "currency", transformKey: "rupiah" },
  { key: "jumlah_biaya", label: "Jumlah Biaya", dataType: "currency", transformKey: "rupiah" },
  { key: "sisa_biaya", label: "Sisa Biaya", dataType: "currency", transformKey: "rupiah" },
  { key: "tanggal_transaksi_biaya_terakhir", label: "Tanggal Transaksi Biaya Terakhir", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "uraian_biaya_terakhir", label: "Uraian Biaya Terakhir" },
  { key: "daftar_biaya_perkara", label: "Daftar Biaya Perkara", dataType: "table", transformKey: "format_table" },
  { key: "biaya_panggilan", label: "Biaya Panggilan", dataType: "currency", transformKey: "rupiah" },
  { key: "biaya_pemberitahuan", label: "Biaya Pemberitahuan", dataType: "currency", transformKey: "rupiah" },
  { key: "biaya_meterai", label: "Biaya Meterai", dataType: "currency", transformKey: "rupiah" },
  { key: "biaya_redaksi", label: "Biaya Redaksi", dataType: "currency", transformKey: "rupiah" },
  { key: "biaya_atk", label: "Biaya ATK", dataType: "currency", transformKey: "rupiah" },
  { key: "biaya_pnbp", label: "Biaya PNBP", dataType: "currency", transformKey: "rupiah" },
];

const mediationFields: FieldSpec[] = [
  { key: "penetapan_penunjukan_mediator", label: "Tanggal Penetapan Mediator", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nomor_sk_penetapan_mediator", label: "Nomor SK Penetapan Mediator" },
  { key: "mediator_text", label: "Mediator" },
  { key: "tanggal_mediasi", label: "Tanggal Mediasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "dimulai_mediasi", label: "Tanggal Mulai Mediasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "keputusan_mediasi", label: "Tanggal Keputusan Mediasi", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "hasil_mediasi", label: "Hasil Mediasi" },
  { key: "catatan_mediasi", label: "Catatan Mediasi", dataType: "long_text", sensitive: true },
  { key: "isi_kesepakatan_perdamaian", label: "Isi Kesepakatan Perdamaian", dataType: "long_text", sensitive: true },
  { key: "isi_akta_perdamaian", label: "Isi Akta Perdamaian", dataType: "long_text", sensitive: true },
];

const marriageFields: FieldSpec[] = [
  { key: "tanggal_nikah", label: "Tanggal Nikah", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_kutipan_akta_nikah", label: "Tanggal Kutipan Akta Nikah", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nomor_kutipan_akta_nikah", label: "Nomor Kutipan Akta Nikah" },
  { key: "kua_tempat_nikah", label: "KUA Tempat Nikah" },
  { key: "tanggal_menikah_itsbat", label: "Tanggal Menikah Itsbat", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tempat_menikah_itsbat", label: "Tempat Menikah Itsbat" },
  { key: "alasan_nikah", label: "Alasan Nikah", dataType: "long_text", sensitive: true },
  { key: "nominal_penghasilan", label: "Nominal Penghasilan", dataType: "currency", transformKey: "rupiah", sensitive: true },
];

const relaasFields: FieldSpec[] = [
  { key: "tanggal_relaas", label: "Tanggal Relaas", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "tanggal_jurusita_pos", label: "Tanggal Jurusita Pos", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "nomor_resi_pos", label: "Nomor Resi Pos" },
  { key: "status_pos", label: "Status Pos" },
  { key: "ketemu_pihak", label: "Keterangan Bertemu Pihak" },
  { key: "hasil_relaas", label: "Hasil Relaas", dataType: "long_text", sensitive: true },
  { key: "tanggal_pemberitahuan", label: "Tanggal Pemberitahuan", dataType: "date", transformKey: "tanggal_indonesia_panjang" },
  { key: "jenis_pemberitahuan", label: "Jenis Pemberitahuan" },
];

const basQaFields: FieldSpec[] = [
  { key: "bas_tanya_jawab_saksi", label: "BAS Tanya Jawab Saksi", dataType: "long_text" },
  { key: "bas_tanya_jawab_penggugat", label: "BAS Tanya Jawab Penggugat", dataType: "long_text" },
  { key: "bas_tanya_jawab_tergugat", label: "BAS Tanya Jawab Tergugat", dataType: "long_text" },
  { key: "bas_tanya_jawab_pemohon", label: "BAS Tanya Jawab Pemohon", dataType: "long_text" },
  { key: "bas_tanya_jawab_termohon", label: "BAS Tanya Jawab Termohon", dataType: "long_text" },
  { key: "bas_ringkasan_keterangan_saksi", label: "Ringkasan Keterangan Saksi", dataType: "long_text", sensitive: true },
  { key: "bas_daftar_pertanyaan", label: "Daftar Pertanyaan BAS", dataType: "table" },
  { key: "bas_daftar_jawaban", label: "Daftar Jawaban BAS", dataType: "table", sensitive: true },
];

const abtCompatibleFamilies = [
  { key: "putusan_cg", label: "Putusan Cerai Gugat" },
  { key: "putusan_ct", label: "Putusan Cerai Talak" },
  { key: "putusan_itsbat", label: "Putusan Itsbat Nikah" },
  { key: "putusan_dk", label: "Putusan Dispensasi Kawin" },
  { key: "putusan_waris", label: "Putusan Waris" },
  { key: "putusan_es", label: "Putusan Ekonomi Syariah" },
  { key: "putusan_jinayat", label: "Putusan Jinayat" },
  { key: "penetapan_cg", label: "Penetapan Cerai Gugat" },
  { key: "penetapan_ct", label: "Penetapan Cerai Talak" },
  { key: "penetapan_itsbat", label: "Penetapan Itsbat Nikah" },
  { key: "penetapan_dk", label: "Penetapan Dispensasi Kawin" },
  { key: "penetapan_wali", label: "Penetapan Perwalian" },
  { key: "bas_cg", label: "BAS Cerai Gugat" },
  { key: "bas_ct", label: "BAS Cerai Talak" },
  { key: "bas_itsbat", label: "BAS Itsbat Nikah" },
  { key: "bas_dk", label: "BAS Dispensasi Kawin" },
  { key: "bas_waris", label: "BAS Waris" },
  { key: "bas_jinayat", label: "BAS Jinayat" },
  { key: "jawaban_lisan_p", label: "Jawaban Lisan P" },
  { key: "jawaban_lisan_t", label: "Jawaban Lisan T" },
  { key: "replik_lisan_p", label: "Replik Lisan P" },
  { key: "duplik_lisan_t", label: "Duplik Lisan T" },
  { key: "saksi_p_cg", label: "Keterangan Saksi P Cerai Gugat" },
  { key: "saksi_t_ct", label: "Keterangan Saksi T Cerai Talak" },
  { key: "rel_pgl_p", label: "Relaas Panggilan Penggugat/Pemohon" },
  { key: "rel_pgl_t", label: "Relaas Panggilan Tergugat/Termohon" },
  { key: "rel_pbt_p", label: "Relaas Pemberitahuan Putusan Pihak Pertama" },
  { key: "rel_pbt_t", label: "Relaas Pemberitahuan Putusan Pihak Kedua" },
  { key: "mediasi_cg", label: "Mediasi Cerai Gugat" },
  { key: "mediasi_ct", label: "Mediasi Cerai Talak" },
  { key: "ikrar_talak", label: "Ikrar Talak" },
  { key: "akta_cerai", label: "Akta Cerai" },
  { key: "ecourt", label: "e-Court" },
  { key: "kepaniteraan", label: "Kepaniteraan" },
  { key: "ptsp", label: "PTSP" },
  { key: "kasir", label: "Kasir/Biaya Perkara" },
  { key: "posbakum", label: "Posbakum" },
  { key: "anonim_putusan", label: "Anonimisasi Putusan" },
  { key: "qr_perkara", label: "Kode QR Perkara" },
  { key: "arsip_final", label: "Arsip Dokumen Final" },
] as const;

function slotFromField(params: {
  prefix: string;
  labelPrefix: string;
  sourceType: JlfVariableCatalogSourceType;
  sourcePrefix?: string;
  field: FieldSpec;
  tableHint: string;
  queryHint: string;
  abtType: string;
}): AbtCompatibleSlot {
  const sourcePrefix = params.sourcePrefix ? `${params.sourcePrefix}.` : "";
  return {
    key: normalizeId(`${params.prefix}_${params.field.key}`),
    label: `${params.labelPrefix}${params.field.label}`,
    dataType: params.field.dataType ?? "text",
    sourceType: params.sourceType,
    sourceKey: `${sourcePrefix}${params.field.key}`,
    transformKey: params.field.transformKey,
    tableHint: params.tableHint,
    queryHint: params.queryHint,
    abtType: params.abtType,
    sensitive: params.field.sensitive,
  };
}

function buildAbtCompatibleSlots() {
  const slots: AbtCompatibleSlot[] = [
    ...caseFields.map((field) =>
      slotFromField({
        prefix: "perkara",
        labelPrefix: "Perkara - ",
        sourceType: "sipp_perkara",
        field,
        tableHint: "perkara",
        queryHint: "sipp.perkara.by_nomor",
        abtType: "data_sipp",
      })
    ),
    ...partyRoles.flatMap((role) =>
      partyFields.map((field) =>
        slotFromField({
          prefix: role.prefix,
          labelPrefix: `${role.label} - `,
          sourceType: "sipp_pihak",
          sourcePrefix: role.prefix,
          field,
          tableHint: `${role.table} + pihak`,
          queryHint: "sipp.pihak.list",
          abtType: "data_sipp",
        })
      )
    ),
    ...partyRoles.flatMap((role) =>
      [1, 2, 3].flatMap((index) =>
        indexedPartyFields.map((field) =>
          slotFromField({
            prefix: `${role.prefix}_${index}`,
            labelPrefix: `${role.label} ${index} - `,
            sourceType: "sipp_pihak",
            sourcePrefix: `${role.prefix}.${index}`,
            field,
            tableHint: `${role.table} + pihak urutan ${index}`,
            queryHint: "sipp.pihak.list",
            abtType: "data_sipp",
          })
        )
      )
    ),
    ...hearingFields.map((field) =>
      slotFromField({
        prefix: "sidang",
        labelPrefix: "Sidang - ",
        sourceType: "sipp_jadwal_sidang",
        field,
        tableHint: "perkara_jadwal_sidang",
        queryHint: "sipp.sidang.by_id",
        abtType: field.key.includes("daftar") ? "multi_sidang" : "data_sipp",
      })
    ),
    ...officialFields.flatMap((field) => [
      slotFromField({
        prefix: "hakim",
        labelPrefix: "Hakim - ",
        sourceType: "sipp_hakim",
        sourcePrefix: "hakim",
        field,
        tableHint: "perkara_hakim_pn + hakim_pn",
        queryHint: "sipp.hakim.majelis",
        abtType: "data_sipp",
      }),
      slotFromField({
        prefix: "panitera",
        labelPrefix: "Panitera - ",
        sourceType: "sipp_panitera",
        sourcePrefix: "panitera",
        field,
        tableHint: "perkara_panitera_pn + panitera_pn",
        queryHint: "sipp.panitera.pengganti",
        abtType: "data_sipp",
      }),
      slotFromField({
        prefix: "jurusita",
        labelPrefix: "Jurusita - ",
        sourceType: "sipp_jurusita",
        sourcePrefix: "jurusita",
        field,
        tableHint: "perkara_jurusita + jurusita",
        queryHint: "sipp.jurusita",
        abtType: "data_sipp",
      }),
    ]),
    ...decisionFields.map((field) =>
      slotFromField({
        prefix: "putusan",
        labelPrefix: "Putusan - ",
        sourceType: "sipp_putusan",
        field,
        tableHint: "perkara_putusan + perkara_akta_cerai + perkara_ikrar_talak",
        queryHint: "sipp.putusan",
        abtType: "data_sipp",
      })
    ),
    ...feeFields.map((field) =>
      slotFromField({
        prefix: "biaya",
        labelPrefix: "Biaya - ",
        sourceType: "sipp_keuangan",
        field,
        tableHint: "perkara_biaya + jenis_biaya",
        queryHint: "sipp.biaya",
        abtType: "data_sipp",
      })
    ),
    ...mediationFields.map((field) =>
      slotFromField({
        prefix: "mediasi",
        labelPrefix: "Mediasi - ",
        sourceType: "sipp_perkara",
        sourcePrefix: "mediasi",
        field,
        tableHint: "perkara_mediasi",
        queryHint: "sipp.mediator",
        abtType: "data_sipp",
      })
    ),
    ...marriageFields.map((field) =>
      slotFromField({
        prefix: "pernikahan",
        labelPrefix: "Pernikahan - ",
        sourceType: "sipp_perkara",
        sourcePrefix: "pernikahan",
        field,
        tableHint: "perkara_data_pernikahan + perkara_data_itsbat + perkara_alasan_nikah",
        queryHint: "sipp.perkara.by_nomor",
        abtType: "data_sipp",
      })
    ),
    ...relaasFields.map((field) =>
      slotFromField({
        prefix: "relaas",
        labelPrefix: "Relaas - ",
        sourceType: "sipp_jurusita",
        sourcePrefix: "relaas",
        field,
        tableHint: "perkara_pelaksanaan_relaas + perkara_pemberitahuan",
        queryHint: "sipp.jurusita",
        abtType: "data_sipp",
      })
    ),
    ...basQaFields.map((field) =>
      slotFromField({
        prefix: "tanya_jawab",
        labelPrefix: "Tanya Jawab - ",
        sourceType: "jlf_bas_qa",
        field,
        tableHint: "jlf_bas_qa_templates + jlf_bas_qa_items",
        queryHint: "jlf.bas_qa",
        abtType: "tanya_jawab",
      })
    ),
    ...["catatan", "keterangan_tambahan", "jawaban_manual", "pertanyaan_manual", "alasan_manual", "amar_manual"].map((key) => ({
      key: `manual_${key}`,
      label: `Manual - ${title(key)}`,
      dataType: "long_text",
      sourceType: "jlf_manual" as const,
      sourceKey: key,
      tableHint: "abt_data_teks",
      queryHint: "jlf.manual_values",
      abtType: "data_teks",
      sensitive: true,
    })),
    ...["tanggal_manual", "tanggal_surat_manual", "tanggal_sidang_manual", "tanggal_putusan_manual", "tanggal_pemberitahuan_manual"].map((key) => ({
      key: `manual_${key}`,
      label: `Manual - ${title(key)}`,
      dataType: "date",
      sourceType: "jlf_manual" as const,
      sourceKey: key,
      transformKey: "tanggal_indonesia_panjang",
      tableHint: "abt_data_tanggal",
      queryHint: "jlf.manual_values",
      abtType: "data_tanggal",
    })),
    ...["terbilang_panjar", "terbilang_biaya", "terbilang_nafkah", "terbilang_mutah", "terbilang_iddah", "terbilang_sengketa"].map((key) => ({
      key,
      label: `Terbilang - ${title(key.replace("terbilang_", ""))}`,
      dataType: "text",
      sourceType: "computed" as const,
      sourceKey: key,
      transformKey: "terbilang",
      tableHint: "abt_variabel_tipe.terbilang",
      queryHint: "computed",
      abtType: "terbilang",
    })),
    ...["tanggal_hari_sidang", "tanggal_hari_putusan", "tanggal_hari_penetapan", "tanggal_hari_pendaftaran"].map((key) => ({
      key,
      label: `Hari Tanggal - ${title(key.replace("tanggal_hari_", ""))}`,
      dataType: "date",
      sourceType: "computed" as const,
      sourceKey: key,
      transformKey: "tanggal_hari",
      tableHint: "abt_variabel_tipe.tanggal_hari",
      queryHint: "computed",
      abtType: "tanggal_hari",
    })),
    ...["tanggal_hijriah_sidang", "tanggal_hijriah_putusan", "tanggal_hijriah_penetapan"].map((key) => ({
      key,
      label: `Hijriah - ${title(key.replace("tanggal_hijriah_", ""))}`,
      dataType: "date",
      sourceType: "computed" as const,
      sourceKey: key,
      transformKey: "tanggal_hijriah_todo",
      tableHint: "abt_variabel_tipe.tanggal_hijriah",
      queryHint: "computed",
      abtType: "tanggal_hijriah",
    })),
  ];

  return slots;
}

function buildAbtCompatibleVariables() {
  const slots = buildAbtCompatibleSlots();
  const variables: JlfSeedVariable[] = [];

  for (const family of abtCompatibleFamilies) {
    for (const slot of slots) {
      if (variables.length >= ABT_COMPATIBLE_VARIABLE_TARGET) return variables;
      variables.push(
        variable({
          key: normalizeId(`abt_${family.key}_${slot.key}`),
          label: `${family.label} - ${slot.label}`,
          dataType: slot.dataType,
          sourceType: slot.sourceType,
          sourceKey: slot.sourceKey,
          transformKey: slot.transformKey,
          legacyAbtType: slot.abtType,
          fieldMode: resolveJlfFieldMode({
            legacyAbtType: slot.abtType,
            dataType: slot.dataType,
            sourceType: slot.sourceType,
            sourceKey: slot.sourceKey,
            transformKey: slot.transformKey,
          }),
          adminNote: `${slot.sensitive ? "Sensitif; tampilkan masked kecuali permission mengizinkan. " : ""}Kandidat kompatibilitas ABT berdasarkan abt_variabel.xls dan abt_variabel_tipe.xls. Tipe ABT: ${slot.abtType}. Sumber kandidat: ${slot.tableHint}. Query registry/adapter: ${slot.queryHint}. Raw SQL legacy tidak dipakai dan harus needs_review bila muncul pada mapping impor.`,
        })
      );
    }
  }

  return variables;
}

function variablesFromFields(params: {
  prefix?: string;
  labelPrefix?: string;
  sourceType: JlfVariableCatalogSourceType;
  sourcePrefix?: string;
  fields: FieldSpec[];
  tableHint: string;
  queryHint: string;
}) {
  const { prefix = "", labelPrefix = "", sourceType, sourcePrefix = "", fields, tableHint, queryHint } = params;
  return fields.map((field) => {
    const key = prefix ? `${prefix}_${field.key}` : field.key;
    const sourceKey = sourcePrefix ? `${sourcePrefix}.${field.key}` : field.key;
    return variable({
      key,
      label: `${labelPrefix}${field.label}`,
      dataType: field.dataType ?? "text",
      sourceType,
      sourceKey,
      transformKey: field.transformKey,
      legacyCode: field.legacyCode ?? null,
      exampleValue: field.exampleValue ?? "",
      adminNote: `${field.sensitive ? "Sensitif; tampilkan masked kecuali permission mengizinkan. " : ""}Sumber kandidat: ${tableHint}. Query registry: ${queryHint}.`,
    });
  });
}

function buildPartyVariables() {
  const results: JlfSeedVariable[] = [];
  for (const role of partyRoles) {
    results.push(
      ...partyFields.map((field) =>
        variable({
          key: `${role.prefix}_${field.key}`,
          label: `${role.label} - ${field.label}`,
          dataType: field.dataType ?? "text",
          sourceType: "sipp_pihak",
          sourceKey: `${role.prefix}.${field.key}`,
          transformKey: field.transformKey,
          legacyCode: field.key === "identitas_lengkap" ? role.legacyIdentity ?? null : null,
          adminNote: `${field.sensitive ? "Sensitif; tampilkan masked kecuali permission mengizinkan. " : ""}Sumber kandidat: ${role.table} + pihak. Query registry: sipp.pihak.list.`,
        })
      )
    );

    if (["penggugat", "tergugat", "saksi"].includes(role.prefix)) {
      for (let index = 1; index <= 5; index += 1) {
        for (const field of indexedPartyFields) {
          results.push(
            variable({
              key: `${role.prefix}_${index}_${field.key}`,
              label: `${role.label} ${index} - ${field.label}`,
              dataType: field.dataType ?? "text",
              sourceType: "sipp_pihak",
              sourceKey: `${role.prefix}.${index}.${field.key}`,
              transformKey: field.transformKey,
              adminNote: `${field.sensitive ? "Sensitif; tampilkan masked kecuali permission mengizinkan. " : ""}Sumber kandidat: ${role.table} urutan ${index} + pihak. Query registry: sipp.pihak.list.`,
            })
          );
        }
      }
    }
  }
  return results;
}

function buildOfficialVariables(prefix: string, label: string, sourceType: JlfVariableCatalogSourceType, tableHint: string, queryHint: string) {
  const aggregate = variablesFromFields({
    prefix,
    labelPrefix: `${label} - `,
    sourceType,
    sourcePrefix: prefix,
    fields: officialFields,
    tableHint,
    queryHint,
  });

  const indexed = [1, 2, 3, 4, 5].flatMap((index) =>
    officialFields.slice(0, 8).map((field) =>
      variable({
        key: `${prefix}_${index}_${field.key}`,
        label: `${label} ${index} - ${field.label}`,
        dataType: field.dataType ?? "text",
        sourceType,
        sourceKey: `${prefix}.${index}.${field.key}`,
        transformKey: field.transformKey,
        adminNote: `${field.sensitive ? "Sensitif; tampilkan masked kecuali permission mengizinkan. " : ""}Sumber kandidat: ${tableHint} urutan ${index}. Query registry: ${queryHint}.`,
      })
    )
  );

  return [...aggregate, ...indexed];
}

function buildCatalogInternal() {
  return [
    ...Object.entries(LEGACY_AUTO_DEFINITIONS).map(([legacyCode, definition]) =>
      variable({
        key: definition.key,
        label: definition.label,
        dataType: definition.dataType,
        sourceType: definition.sourceType as JlfVariableCatalogSourceType,
        sourceKey: definition.sourceKey,
        transformKey: definition.transformKey,
        legacyCode,
        fallbackValue: definition.fallbackValue,
        adminNote: `Auto registry dari fallback ABT legacy #${legacyCode}# agar bisa dicari dan diaudit di daftar variabel.`,
      })
    ),
    ...manualVariables,
    ...variablesFromFields({
      sourceType: "sipp_perkara",
      fields: caseFields,
      tableHint: "perkara",
      queryHint: "sipp.perkara.by_nomor",
    }),
    ...buildPartyVariables(),
    ...variablesFromFields({
      prefix: "sidang",
      labelPrefix: "Sidang Dipilih - ",
      sourceType: "sipp_jadwal_sidang",
      sourcePrefix: "",
      fields: hearingFields,
      tableHint: "perkara_jadwal_sidang",
      queryHint: "sipp.sidang.by_id",
    }),
    ...variablesFromFields({
      prefix: "sidang_terakhir",
      labelPrefix: "Sidang Terakhir - ",
      sourceType: "sipp_jadwal_sidang",
      sourcePrefix: "terakhir",
      fields: hearingFields.slice(0, 14),
      tableHint: "perkara_jadwal_sidang",
      queryHint: "sipp.sidang.last",
    }),
    ...variablesFromFields({
      prefix: "sidang_berikutnya",
      labelPrefix: "Sidang Berikutnya - ",
      sourceType: "sipp_jadwal_sidang",
      sourcePrefix: "berikutnya",
      fields: hearingFields.slice(0, 14),
      tableHint: "perkara_jadwal_sidang",
      queryHint: "sipp.sidang.next",
    }),
    ...buildOfficialVariables("hakim", "Majelis Hakim", "sipp_hakim", "perkara_hakim_pn + hakim_pn", "sipp.hakim.majelis"),
    ...buildOfficialVariables("panitera", "Panitera Pengganti", "sipp_panitera", "perkara_panitera_pn + panitera_pn", "sipp.panitera.pengganti"),
    ...buildOfficialVariables("jurusita", "Jurusita", "sipp_jurusita", "perkara_jurusita + jurusita", "sipp.jurusita"),
    ...buildOfficialVariables("mediator", "Mediator", "sipp_perkara", "perkara_mediator + mediator + perkara_mediasi", "sipp.mediator"),
    ...variablesFromFields({
      prefix: "putusan",
      labelPrefix: "Putusan - ",
      sourceType: "sipp_putusan",
      sourcePrefix: "",
      fields: decisionFields,
      tableHint: "perkara_putusan + perkara_akta_cerai + perkara_ikrar_talak",
      queryHint: "sipp.putusan",
    }),
    ...variablesFromFields({
      prefix: "biaya",
      labelPrefix: "Biaya - ",
      sourceType: "sipp_keuangan",
      sourcePrefix: "",
      fields: feeFields,
      tableHint: "perkara_biaya + jenis_biaya",
      queryHint: "sipp.biaya",
    }),
    ...variablesFromFields({
      prefix: "mediasi",
      labelPrefix: "Mediasi - ",
      sourceType: "sipp_perkara",
      sourcePrefix: "mediasi",
      fields: mediationFields,
      tableHint: "perkara_mediasi",
      queryHint: "sipp.mediator",
    }),
    ...variablesFromFields({
      prefix: "pernikahan",
      labelPrefix: "Data Pernikahan - ",
      sourceType: "sipp_perkara",
      sourcePrefix: "pernikahan",
      fields: marriageFields,
      tableHint: "perkara_data_pernikahan + perkara_data_itsbat + perkara_alasan_nikah",
      queryHint: "sipp.perkara.by_nomor",
    }),
    ...variablesFromFields({
      prefix: "relaas",
      labelPrefix: "Relaas - ",
      sourceType: "sipp_jurusita",
      sourcePrefix: "relaas",
      fields: relaasFields,
      tableHint: "perkara_pelaksanaan_relaas + perkara_pemberitahuan",
      queryHint: "sipp.jurusita",
    }),
    ...variablesFromFields({
      sourceType: "jlf_bas_qa",
      fields: basQaFields,
      tableHint: "jlf_bas_qa_templates + jlf_bas_qa_items",
      queryHint: "jlf.bas_qa",
    }),
    ...["cerai_gugat", "cerai_talak", "itsbat_nikah", "dispensasi_kawin", "waris", "jinayat", "mediasi"].flatMap((caseType) => [
      variable({
        key: `bas_${caseType}_pertanyaan_standar`,
        label: `BAS ${title(caseType)} - Pertanyaan Standar`,
        dataType: "long_text",
        sourceType: "jlf_bas_qa",
        sourceKey: `${caseType}.pertanyaan_standar`,
        adminNote: "Acuan dari template tanya jawab ABT; import final harus melalui dry-run dan review admin.",
      }),
      variable({
        key: `bas_${caseType}_jawaban_standar`,
        label: `BAS ${title(caseType)} - Jawaban Standar`,
        dataType: "long_text",
        sourceType: "jlf_bas_qa",
        sourceKey: `${caseType}.jawaban_standar`,
        adminNote: "Acuan dari template tanya jawab ABT; jawaban aktual perkara tidak diimport otomatis.",
      }),
    ]),
    ...buildAbtCompatibleVariables(),
  ];
}

export function buildJlfVariableCatalog() {
  const seen = new Map<string, JlfSeedVariable>();
  const seenLegacyCodes = new Set<string>();
  for (const item of buildCatalogInternal()) {
    if (seen.has(item.key)) continue;

    if (item.legacyCode) {
      if (seenLegacyCodes.has(item.legacyCode)) {
        seen.set(item.key, {
          ...item,
          legacyCode: null,
          adminNote: `${item.adminNote ?? ""} Legacy code #${item.legacyCode}# sudah dipakai variabel lain; item ini dipertahankan tanpa legacy_code agar seed tetap unik.`.trim(),
        });
        continue;
      }

      seenLegacyCodes.add(item.legacyCode);
    }

    seen.set(item.key, item);
  }
  return Array.from(seen.values());
}

export const JLF_VARIABLE_CATALOG_MIN_EXPECTED = 6800;
export const JLF_ABT_COMPATIBLE_VARIABLE_TARGET = ABT_COMPATIBLE_VARIABLE_TARGET;

function resolveLegacyCodeForSeed(
  legacyCodeOwners: Map<string, string>,
  variableKey: string,
  legacyCode: string | null | undefined
) {
  if (!legacyCode) return null;
  const existingKey = legacyCodeOwners.get(legacyCode);
  if (existingKey && existingKey !== variableKey) return null;
  return legacyCode;
}

export async function seedJlfVariableCatalog(db: AletaDatabase) {
  const catalog = buildJlfVariableCatalog();
  const existingLegacyRows = await db.queryAll<{ legacy_code: string | null; key: string }>(
    `SELECT legacy_code, "key" FROM jlf_variables WHERE legacy_code IS NOT NULL AND legacy_code <> ''`
  );
  const legacyCodeOwners = new Map(
    existingLegacyRows
      .filter((row): row is { legacy_code: string; key: string } => Boolean(row.legacy_code))
      .map((row) => [row.legacy_code, row.key])
  );

  await withTransaction(db, async (tx) => {
    const rows: SqlInputValue[][] = [];
    for (const item of catalog) {
      const legacyCode = resolveLegacyCodeForSeed(legacyCodeOwners, item.key, item.legacyCode);
      rows.push([
        `jlf-var-seed-${normalizeId(item.key)}`,
        legacyCode,
        item.key,
        item.label,
        item.description ?? "",
        item.dataType,
        item.sourceType,
        item.sourceKey,
        item.transformKey ?? "",
        item.fallbackValue ?? "",
        item.legacyAbtType ?? "",
        item.fieldMode ?? "",
        item.aiEnabled ? 1 : 0,
        item.manualOverrideAllowed === false ? 0 : 1,
        item.isRequired ? 1 : 0,
        1,
        item.exampleValue ?? "",
        item.adminNote ?? "",
        CREATED_AT,
        CREATED_AT
      ]);
      if (legacyCode) legacyCodeOwners.set(legacyCode, item.key);
    }

    for (let index = 0; index < rows.length; index += JLF_VARIABLE_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(index, index + JLF_VARIABLE_INSERT_CHUNK_SIZE);
      const placeholders = chunk.map(() => JLF_VARIABLE_INSERT_PLACEHOLDER).join(", ");
      const params = chunk.flat();
      await tx.run(
        `INSERT INTO jlf_variables (
          id, legacy_code, "key", label, description, data_type, source_type, source_key, transform_key,
          fallback_value, legacy_abt_type, field_mode, ai_enabled, manual_override_allowed,
          is_required, is_active, example_value, admin_note, created_at, updated_at
        ) VALUES ${placeholders}
        ON CONFLICT ("key") DO NOTHING`,
        params
      );
    }
  });

  return { total: catalog.length };
}
