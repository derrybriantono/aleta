export type UserAdditionalRoleOption = {
  id: string;
  label: string;
  group: string;
  description: string;
};

export const USER_ADDITIONAL_ROLE_OPTIONS: UserAdditionalRoleOption[] = [
  { id: "kasir", label: "Kasir", group: "Keuangan Perkara", description: "Layanan pembayaran, pengembalian sisa panjar, dan informasi biaya perkara." },
  { id: "petugas_keuangan_perkara", label: "Petugas Keuangan Perkara", group: "Keuangan Perkara", description: "Tindak lanjut panjar, biaya panggilan, dan keuangan perkara." },
  { id: "bendahara_penerimaan", label: "Bendahara Penerimaan", group: "Keuangan", description: "Penerimaan negara, PNBP, dan administrasi setoran." },
  { id: "bendahara_pengeluaran", label: "Bendahara Pengeluaran", group: "Keuangan", description: "Belanja, pertanggungjawaban, dan administrasi pengeluaran." },
  { id: "penjaga_sidang", label: "Penjaga Sidang", group: "Persidangan", description: "Pemanggilan ruang sidang, ketertiban, dan dukungan jadwal sidang." },
  { id: "operator_antrian_sidang", label: "Operator Antrian Sidang", group: "Persidangan", description: "Pengelolaan nomor antrean, panggilan sidang, dan layar antrean." },
  { id: "operator_panggilan_sidang", label: "Operator Panggilan Sidang", group: "Persidangan", description: "Pengingat panggilan sidang, relaas, dan status panggilan." },
  { id: "petugas_akta_cerai", label: "Petugas Akta Cerai", group: "Kepaniteraan", description: "Penerbitan, penyerahan, dan informasi akta cerai." },
  { id: "petugas_pendaftaran_perkara", label: "Petugas Pendaftaran Perkara", group: "Kepaniteraan", description: "Pendaftaran perkara baru, verifikasi awal, dan nomor perkara." },
  { id: "petugas_validasi_ecourt", label: "Petugas Validasi e-Court", group: "Kepaniteraan", description: "Validasi pendaftaran e-Court dan kelengkapan dokumen elektronik." },
  { id: "petugas_ecourt", label: "Petugas e-Court", group: "Kepaniteraan", description: "Pendampingan layanan e-Court, e-Litigasi, dan dokumen elektronik." },
  { id: "petugas_gugatan_mandiri", label: "Petugas Gugatan Mandiri", group: "Kepaniteraan", description: "Pendampingan pembuatan gugatan/permohonan mandiri." },
  { id: "operator_sipp", label: "Operator SIPP", group: "Teknologi Perkara", description: "Input, pemeliharaan, dan pemantauan data perkara di SIPP." },
  { id: "operator_edoc", label: "Operator e-Doc", group: "Teknologi Perkara", description: "Upload dan pengecekan kelengkapan dokumen elektronik perkara." },
  { id: "petugas_minutasi", label: "Petugas Minutasi", group: "Kepaniteraan", description: "Monitoring minutasi dan kelengkapan berkas perkara." },
  { id: "arsiparis_perkara", label: "Arsiparis Perkara", group: "Kepaniteraan", description: "Pengarsipan berkas perkara dan serah terima arsip." },
  { id: "operator_delegasi", label: "Operator Delegasi", group: "Kepaniteraan", description: "Permintaan, penerimaan, dan pelaksanaan delegasi panggilan/pemberitahuan." },
  { id: "petugas_ptsp", label: "Petugas PTSP", group: "Layanan Publik", description: "Layanan terpadu satu pintu, informasi, dan penerimaan tamu." },
  { id: "petugas_meja_informasi", label: "Petugas Meja Informasi", group: "Layanan Publik", description: "Informasi perkara, jadwal, biaya, dan layanan umum." },
  { id: "petugas_pengaduan", label: "Petugas Pengaduan", group: "Layanan Publik", description: "Penerimaan dan tindak lanjut pengaduan masyarakat." },
  { id: "petugas_posbakum", label: "Petugas Posbakum", group: "Layanan Publik", description: "Koordinasi layanan bantuan hukum dan rujukan Posbakum." },
  { id: "resepsionis", label: "Resepsionis", group: "Layanan Publik", description: "Penerimaan tamu, pengarah layanan, dan informasi awal." },
  { id: "satpam_layanan", label: "Satpam Layanan", group: "Layanan Publik", description: "Pengamanan layanan, antrean, dan pengarah pengunjung." },
  { id: "petugas_surat_masuk_keluar", label: "Petugas Surat Masuk/Keluar", group: "Kesekretariatan", description: "Agenda, distribusi, dan monitoring surat dinas." },
  { id: "petugas_umum_rumah_tangga", label: "Petugas Umum/Rumah Tangga", group: "Kesekretariatan", description: "Dukungan umum, kebersihan, perlengkapan, dan rumah tangga kantor." },
  { id: "petugas_barang_persediaan", label: "Petugas Barang/Persediaan", group: "Kesekretariatan", description: "BMN, persediaan, dan perlengkapan operasional." },
  { id: "petugas_ti_helpdesk", label: "Petugas TI/Helpdesk", group: "Teknologi Informasi", description: "Dukungan aplikasi, jaringan, perangkat, dan layanan digital." },
  { id: "petugas_media_informasi", label: "Petugas Media Informasi", group: "Teknologi Informasi", description: "Website, media sosial, publikasi, dan informasi layanan." },
  { id: "operator_video_sidang", label: "Operator Video Sidang", group: "Persidangan", description: "Dukungan teleconference, audio, dan dokumentasi persidangan." },
  { id: "petugas_kebersihan_layanan", label: "Petugas Kebersihan Layanan", group: "Layanan Publik", description: "Kesiapan ruang layanan dan ruang tunggu pengunjung." },
];

export function normalizeAdditionalRoleId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function normalizeAdditionalRoleIds(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(
    new Set(
      raw
        .map((item) => normalizeAdditionalRoleId(String(item ?? "")))
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

export function getAdditionalRoleLabel(id: string) {
  const normalized = normalizeAdditionalRoleId(id);
  const option = USER_ADDITIONAL_ROLE_OPTIONS.find((item) => item.id === normalized);
  if (option) return option.label;
  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function getAdditionalRoleSearchText(ids: string[]) {
  return normalizeAdditionalRoleIds(ids)
    .map((id) => `${id} ${getAdditionalRoleLabel(id)}`)
    .join(" ");
}
