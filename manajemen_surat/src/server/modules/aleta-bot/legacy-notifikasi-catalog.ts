import type { AletaBotQuery, AletaBotQueryCatalogItem, AletaBotQueryCategory } from "@/lib/aleta-bot-types";

type SeedQuery = Omit<
  AletaBotQuery,
  | "connectionKey"
  | "usedByNotifications"
  | "lastTestedAt"
  | "lastTestStatus"
  | "lastTestError"
  | "createdBy"
  | "updatedBy"
  | "createdAt"
  | "updatedAt"
>;

export const LEGACY_NOTIFIKASI_EXPORTS = [
  "getDataPenahanan",
  "getDataBA",
  "getDataPutusanBelumMinut",
  "getDataBelumBhtPidana",
  "getDataBelumBhtPerdata",
  "getDataBelumSerahHukum",
  "getDataTundaJadwalSidang",
  "getDataSaksiTidakLengkap",
  "getDataSaksiTidakLengkapLama",
  "getDataPutusanBelumBeritahuNew",
  "getDataJadwalSidangPidana",
  "getDataJadwalSidangPerdata",
  "getDataJadwalMediasi",
  "getDataJadwalMediasiBesok",
  "getDataSisaPanjarPn",
  "getDataSisaPanjarBanding",
  "getDataSisaPanjarKasasi",
  "getDataCourtCalendar",
  "getStatistik",
  "getBelumBhtBanding",
  "getBelumBhtKasasi",
  "getBelumPanggilan",
  "getBelumPanggilanHariSidang",
  "getBelumPanggilanSidangPertama",
  "getPanggilanTidakPatut",
  "getPanggilanPosTidakPatut",
  "getBelumPanggilanSebelumHariSidang",
  "getBelumEdocCourtCalendar",
  "getDataBanding",
  "getDataKasasi",
  "getDataPK",
  "getDataEdocPetitum",
  "getDataEdocDakwaan",
  "getDataEdocAnonimisasi",
  "getDataEdocPutusan",
  "getDataEdocAktaCerai",
  "getDataBelumDelegasi",
  "getDataPublikasi",
  "getDataPublikasiTahunBerjalan",
  "getDataVerstek",
  "getStatistikDetail",
  "getDataJadwalBesok",
  "getDataTundaMediasi",
  "getDataDirput",
  "getDataNomorKontakPihak1",
  "getDataNomorKontakPihak2",
  "getDataPutusHariIni",
  "getDataPutusJurusita",
  "getDataTundaJurusita",
  "getDataUploadPutusan",
  "getDataJadwalSidangPerdatalama",
  "getDataSisaPanjarPnLama",
  "getDataJadwalBesokPanitera",
  "getDataPutusLebih30Hari",
  "getDataSidangLebih30Hari",
  "getDataPemberitahuanPutusanBelum",
  "getDataBelumDelegasiKeluar",
  "getDataCeraiAnakBelum",
  "getDataLupaTunda",
  "getDataAktaCeraiTerbit",
  "getBhtPerceraian",
  "getDataKuaCerai",
  "getDataDaftarEcourt",
  "getDataJumlahAlasanCerai",
  "getDataDaftarProdeo",
  "getDataDaftarGhaib",
  "getDataDaftarSidkel",
  "getDataDaftarPenetapan",
  "getDataDaftarMediasi",
  "getDataJumlahMediasi",
  "getDataJumlahMediasiHakim",
  "getTotalPenerimaanPerkaraSemuaHakim",
  "getTotalPenerimaanPerkaraSemuaPanitera",
  "getTotalPenerimaanPerkaraSemuaJurusita",
  "getTotalPenerimaanPerkaraSemuaHakimLengkap",
  "getTotalPenerimaanPerkaraSemuaPaniteraLengkap",
  "getTotalPenerimaanPerkaraSemuaJurusitaLengkap",
  "getTotalPenerimaanMediasiSemuaHakim",
  "getTotalPenerimaanPerkaraSemuaHakimLengkapAll",
  "getTotalPenerimaanPerkaraSemuaPaniteraLengkapAll",
  "getTotalPenerimaanPerkaraSemuaJurusitaLengkapAll",
  "getTotalPenerimaanMediasiSemuaHakimAll",
  "getDataMeteraiRedaksiPsp",
  "getDataCapilCerai",
  "getDataBelumInputAlamat",
  "getDataNoHpEmailParaPihak",
  "getDataKodeJabatan",
  "getDataBelumValidasi",
  "getDataJadwalSidangPerdataHakim",
  "getDataJadwalMediasiHakim",
  "getDataJadwalBesokHakim",
  "getDataJadwalMediasiBesokHakim",
  "getDataBASHakim",
  "getDataEdocAnonimisasiHakim",
  "getDataUploadPutusanHakim",
  "getDataLupaTundaHakim",
  "getDataPutusanBelumMinutHakim",
  "getDataPerkaraAktifHakim",
  "getDataMediasiAktifHakim",
  "getTotalPenerimaanPerkaraHakim",
  "getTotalPenerimaanMediasiHakim",
  "getBelumPanggilanHakimHariIni",
  "getDataJadwalSidangPerdataPanitera",
  "getDataPerkaraAktifPanitera",
  "getTotalPenerimaanPerkaraPanitera",
  "getDataJadwalBesokPaniteraNew",
  "getDataTundaMediasiPanitera",
  "getDataBASPanitera",
  "getDataLupaTundaPanitera",
  "getDataPutusanBelumMinutPanitera",
  "getBelumPanggilanPaniteraHariIni",
  "getDataPerkaraAktifJurusita",
  "getTotalPenerimaanPerkaraJurusita",
  "getBelumPanggilanJurusita",
  "getBelumPanggilanPengingatJurusita",
  "getBelumPanggilanJurusitaHariIni",
  "getDataBelumDelegasiJurusita",
  "getDataBelumDelegasiKeluarJurusita",
  "getDataPutusanBelumBeritahuNewJurusita",
  "getDataPemberitahuanPutusanBelumJurusita",
  "getDataPutusJurusitaNew",
  "getDataTundaJurusitaNew",
  "getDataAntrianSidangHakim",
  "getDataAntrianSidangPanitera",
  "getDataKriteriaWaktuPutus",
  "getDataMinutasiBerkasPerkara",
  "getDataUploadPublikasiPutusan",
  "getDataPendaftaranPerkara",
  "getDataPenetapanMajelisHakim",
  "getDataPengimputanPenetapanMajelisHakim",
  "getDataPenunjukkanPp",
  "getDataPengimputanPenunjukkanPp",
  "getDataPenunjukkanJurusita",
  "getDataPengimputanPenunjukkanJurusita",
  "getDataPenetapanHariSidang",
  "getDataPengimputanPenetapanHariSidang",
  "getDataPengisianDataRelaas",
  "getDataMediasi",
  "getDataKepatuhanDataSaksi",
  "getDataPemberitahuanPutusanPenetapan",
  "getDataPengisianBht",
  "getDataPencatatanSisaPanjarBiaya",
  "getDataPengisianDataArsip",
  "getDataPenerimaanDelegasi",
  "getDataEdocPetitumTuntutan",
  "getDataEdocRelaas",
  "getDataEdocBas",
  "getDataEdocAc",
  "getDataAgendaSidangTerakhir",
  "getDataPermohonanPanggilanDelegasi",
  "getDataPengisianJenisPutusanVerstekContra",
  "getDataTriwulanEcourt",
  "getDataTriwulanMediasi",
  "getDataPihakTundaCuti",
  "getDataPihakBaru",
  "getDataPihakAktaCerai",
  "getDataHabisBiaya",
  "getDataPihakHariSidang",
  "getDataPihakSebelumHariSidang",
  "getDataPutusanPihak",
  "getDataPihakSisaPanjar",
] as const;

function slugLegacyExport(exportName: string) {
  return exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function humanizeLegacyExport(exportName: string) {
  return exportName
    .replace(/^get/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
}

const LEGACY_EXPORT_LABEL_OVERRIDES: Record<string, string> = {
  getDataBA: "Kepaniteraan - BAS Belum Diunggah",
  getDataPutusanBelumMinut: "Kepaniteraan - Putusan Belum Minutasi",
  getDataBelumBhtPidana: "Kepaniteraan - BHT Pidana Belum Diisi",
  getDataBelumBhtPerdata: "Kepaniteraan - BHT Perdata Belum Diisi",
  getDataBelumSerahHukum: "Kepaniteraan - Berkas Belum Diserahkan ke Hukum/Arsip",
  getDataTundaJadwalSidang: "Kepaniteraan - Jadwal Sidang Belum Ditunda",
  getDataSaksiTidakLengkap: "Kepaniteraan - Data Saksi Tidak Lengkap",
  getDataPutusanBelumBeritahuNew: "Jurusita - Pemberitahuan Putusan Belum Dilaksanakan",
  getDataJadwalSidangPidana: "Jadwal Sidang - Perkara Pidana",
  getDataJadwalSidangPerdata: "Jadwal Sidang - Perkara Perdata",
  getDataJadwalMediasi: "Jadwal Sidang - Mediasi Hari Ini",
  getDataJadwalMediasiBesok: "Jadwal Sidang - Mediasi Besok",
  getDataSisaPanjarPn: "Kasir - Sisa Panjar Tingkat Pertama",
  getDataSisaPanjarBanding: "Kasir - Sisa Panjar Banding",
  getDataSisaPanjarKasasi: "Kasir - Sisa Panjar Kasasi",
  getBelumPanggilan: "Jurusita - Panggilan Belum Lengkap",
  getBelumPanggilanHariSidang: "Jurusita - Panggilan Hari Sidang Belum Lengkap",
  getBelumPanggilanSidangPertama: "Jurusita - Panggilan Sidang Pertama Belum Lengkap",
  getPanggilanTidakPatut: "Jurusita - Panggilan Tidak Patut",
  getPanggilanPosTidakPatut: "Jurusita - Panggilan Pos Tidak Patut",
  getBelumPanggilanSebelumHariSidang: "Jurusita - Pengingat Panggilan Sebelum Hari Sidang",
  getBelumEdocCourtCalendar: "Dokumen Perkara - E-Doc Court Calendar Belum Lengkap",
  getDataBanding: "Kepaniteraan - Berkas Banding Belum Dikirim",
  getDataKasasi: "Kepaniteraan - Berkas Kasasi Belum Dikirim",
  getDataPK: "Kepaniteraan - Berkas PK Belum Dikirim",
  getDataEdocPetitum: "Dokumen Perkara - E-Doc Petitum Belum Ada",
  getDataEdocDakwaan: "Dokumen Perkara - E-Doc Dakwaan Belum Ada",
  getDataEdocAnonimisasi: "Dokumen Perkara - Putusan Belum Anonimisasi",
  getDataEdocPutusan: "Dokumen Perkara - E-Doc Putusan Belum Ada",
  getDataEdocAktaCerai: "Dokumen Perkara - E-Doc Akta Cerai Belum Ada",
  getDataBelumDelegasi: "Jurusita - Delegasi Masuk Belum Dilaksanakan",
  getDataBelumDelegasiKeluar: "Jurusita - Delegasi Keluar Belum Dilaksanakan",
  getDataPublikasi: "Dokumen Perkara - Publikasi Putusan Belum Lengkap",
  getDataPublikasiTahunBerjalan: "Dokumen Perkara - Publikasi Putusan Tahun Ini",
  getDataVerstek: "Kepaniteraan - Jenis Putusan Verstek Perlu Dicek",
  getStatistikDetail: "Monitoring - Statistik Detail Penanganan Perkara",
  getDataJadwalBesok: "Jadwal Sidang - Perkara Besok",
  getDataTundaMediasi: "Kepaniteraan - Mediasi Belum Ditunda",
  getDataDirput: "Dokumen Perkara - Direktori Putusan",
  getDataAktaCeraiTerbit: "Pihak Perkara - Akta Cerai Terbit",
  getBhtPerceraian: "Pihak Perkara - BHT Perceraian",
  getDataKuaCerai: "Instansi Mitra - Data Perceraian untuk KUA",
  getDataCapilCerai: "Instansi Mitra - Data Perceraian untuk Dukcapil",
  getDataNoHpEmailParaPihak: "Pihak Perkara - Kontak HP dan Email Para Pihak",
  getTotalPenerimaanPerkaraSemuaHakimLengkap: "Hakim - Rekap Penerimaan Perkara Bulanan",
  getTotalPenerimaanMediasiSemuaHakim: "Hakim - Rekap Mediasi Bulanan",
  getTotalPenerimaanPerkaraSemuaPaniteraLengkap: "Kepaniteraan - Rekap Penerimaan Perkara Semua Panitera",
  getTotalPenerimaanPerkaraSemuaJurusitaLengkap: "Jurusita - Rekap Penerimaan Perkara Semua Jurusita",
  getDataJadwalSidangPerdataHakim: "Hakim - Jadwal Sidang Perdata",
  getDataJadwalMediasiHakim: "Hakim - Jadwal Mediasi",
  getDataJadwalBesokHakim: "Hakim - Jadwal Sidang Besok",
  getDataJadwalMediasiBesokHakim: "Hakim - Jadwal Mediasi Besok",
  getDataBASHakim: "Hakim - BAS Belum Diunggah",
  getDataEdocAnonimisasiHakim: "Hakim - Putusan Belum Anonimisasi",
  getDataUploadPutusanHakim: "Hakim - Putusan Belum Diunggah",
  getDataLupaTundaHakim: "Hakim - Sidang Belum Ditunda",
  getDataPutusanBelumMinutHakim: "Hakim - Putusan Belum Minutasi",
  getDataPerkaraAktifHakim: "Hakim - Perkara Aktif",
  getDataMediasiAktifHakim: "Hakim - Mediasi Aktif",
  getTotalPenerimaanPerkaraHakim: "Hakim - Total Penerimaan Perkara",
  getTotalPenerimaanMediasiHakim: "Hakim - Total Mediasi",
  getBelumPanggilanHakimHariIni: "Hakim - Panggilan Hari Ini Belum Lengkap",
  getDataJadwalSidangPerdataPanitera: "Panitera - Jadwal Sidang Perdata",
  getDataPerkaraAktifPanitera: "Panitera - Perkara Aktif",
  getTotalPenerimaanPerkaraPanitera: "Panitera - Total Penerimaan Perkara",
  getDataJadwalBesokPaniteraNew: "Panitera - Jadwal Sidang Besok",
  getDataTundaMediasiPanitera: "Panitera - Mediasi Belum Ditunda",
  getDataBASPanitera: "Panitera - BAS Belum Diunggah",
  getDataLupaTundaPanitera: "Panitera - Sidang Belum Ditunda",
  getDataPutusanBelumMinutPanitera: "Panitera - Putusan Belum Minutasi",
  getBelumPanggilanPaniteraHariIni: "Panitera - Panggilan Hari Ini Belum Lengkap",
  getDataPerkaraAktifJurusita: "Jurusita - Perkara Aktif",
  getTotalPenerimaanPerkaraJurusita: "Jurusita - Total Penerimaan Perkara",
  getBelumPanggilanJurusita: "Jurusita - Panggilan Belum Lengkap per Petugas",
  getBelumPanggilanPengingatJurusita: "Jurusita - Pengingat Panggilan Belum Dilaksanakan",
  getBelumPanggilanJurusitaHariIni: "Jurusita - Panggilan Hari Ini Belum Lengkap",
  getDataBelumDelegasiJurusita: "Jurusita - Delegasi Masuk Belum Dilaksanakan per Petugas",
  getDataBelumDelegasiKeluarJurusita: "Jurusita - Delegasi Keluar Belum Dilaksanakan per Petugas",
  getDataPutusanBelumBeritahuNewJurusita: "Jurusita - Putusan Belum Diberitahukan",
  getDataPemberitahuanPutusanBelumJurusita: "Jurusita - Pemberitahuan Putusan Belum Dilaksanakan per Petugas",
  getDataPutusJurusitaNew: "Jurusita - Perkara Putus",
  getDataTundaJurusitaNew: "Jurusita - Sidang Ditunda",
  getDataAntrianSidangHakim: "Hakim - Antrian Sidang",
  getDataAntrianSidangPanitera: "Panitera - Antrian Sidang",
  getDataTriwulanEcourt: "Monitoring - Triwulan E-Court",
  getDataTriwulanMediasi: "Monitoring - Triwulan Mediasi",
  getDataPihakTundaCuti: "Pihak Perkara - Penundaan Sidang atau Cuti",
  getDataPihakBaru: "Pihak Perkara - Perkara Baru",
  getDataPihakAktaCerai: "Pihak Perkara - Akta Cerai",
  getDataHabisBiaya: "Pihak Perkara - Panjar Habis",
  getDataPihakHariSidang: "Pihak Perkara - Pengingat Hari Sidang",
  getDataPihakSebelumHariSidang: "Pihak Perkara - Pengingat Sebelum Sidang",
  getDataPutusanPihak: "Pihak Perkara - Putusan Perkara",
  getDataPihakSisaPanjar: "Pihak Perkara - Sisa Panjar",
};

const LEGACY_WORD_REPLACEMENTS: Record<string, string> = {
  BA: "BAS",
  Bht: "BHT",
  BAS: "BAS",
  BHT: "BHT",
  PK: "PK",
  PN: "Tingkat Pertama",
  Pn: "Tingkat Pertama",
  PP: "Panitera Pengganti",
  Pp: "Panitera Pengganti",
  PSP: "PSP",
  Psp: "PSP",
  EDoc: "E-Doc",
  Edoc: "E-Doc",
  Ecourt: "E-Court",
  KUA: "KUA",
  Kua: "KUA",
  Capil: "Dukcapil",
  Dirput: "Direktori Putusan",
  No: "Nomor",
  Hp: "HP",
};

function legacyAudiencePrefix(exportName: string) {
  if (/Kua|Capil/i.test(exportName)) return "Instansi Mitra";
  if (/pihak|aktaCerai|habisBiaya|nomorKontakPihak|noHpEmailParaPihak/i.test(exportName)) return "Pihak Perkara";
  if (/hakim/i.test(exportName)) return "Hakim";
  if (/panitera|BHT|BA|BAS|banding|kasasi|PK|minut|mediasi/i.test(exportName)) return "Kepaniteraan";
  if (/jurusita|relaas|panggilan|delegasi/i.test(exportName)) return "Jurusita";
  if (/panjar|biaya|meterai|PSP/i.test(exportName)) return "Kasir";
  if (/jadwal|sidang/i.test(exportName)) return "Jadwal Sidang";
  if (/edoc|upload|publikasi|putusan|dirput/i.test(exportName)) return "Dokumen Perkara";
  return "Monitoring";
}

function friendlyLegacyTopic(exportName: string) {
  const prefix = legacyAudiencePrefix(exportName);
  const withoutPrefix = exportName
    .replace(/^get(Total)?(Data)?/, "")
    .replace(new RegExp(prefix.replace("Kepaniteraan", "Panitera|Kepaniteraan"), "i"), "")
    .replace(/Hakim|Panitera|Jurusita|Pihak|Kua|Capil/gi, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
  const words = withoutPrefix
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => LEGACY_WORD_REPLACEMENTS[word] ?? word);
  const topic = words.join(" ").replace(/\bBelum BHT\b/i, "BHT Belum Diisi").trim();
  return topic || humanizeLegacyExport(exportName);
}

export function legacyNotifikasiLabel(exportName: string) {
  const override = LEGACY_EXPORT_LABEL_OVERRIDES[exportName];
  if (override) return override;
  return `${legacyAudiencePrefix(exportName)} - ${friendlyLegacyTopic(exportName)}`;
}

export function legacyNotifikasiDescription(exportName: string) {
  const label = legacyNotifikasiLabel(exportName);
  return `${label}. Data berasal dari notifikasi.js dan dapat dipakai untuk sumber data notifikasi ALETA Bot.`;
}

function inferLegacyQueryCategory(exportName: string): AletaBotQueryCategory {
  if (/pihak|aktaCerai|habisBiaya|kuaCerai|capilCerai|nomorKontakPihak|noHpEmailParaPihak/i.test(exportName)) {
    return "party";
  }
  return "employee";
}

function inferLegacyCatalogCategory(exportName: string) {
  if (/hakim/i.test(exportName)) return "pegawai hakim";
  if (/panitera/i.test(exportName)) return "pegawai panitera";
  if (/jurusita|relaas|panggilan/i.test(exportName)) return "pegawai jurusita";
  if (/pihak|aktaCerai|habisBiaya/i.test(exportName)) return "pihak perkara";
  if (/jadwal|mediasi|sidang/i.test(exportName)) return "jadwal sidang";
  if (/panjar|biaya|meterai/i.test(exportName)) return "biaya perkara";
  if (/edoc|upload|publikasi|putusan/i.test(exportName)) return "dokumen perkara";
  return "monitoring perkara";
}

function inferLegacyOutputColumns(category: AletaBotQueryCategory) {
  if (category === "party") return ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"];
  return ["nama_pegawai", "judul_notifikasi", "ringkasan", "waktu", "mode"];
}

export function legacyNotifikasiQueryId(exportName: string) {
  return `legacy-notifikasi-${slugLegacyExport(exportName)}`;
}

export const LEGACY_NOTIFIKASI_QUERY_DEFINITIONS: SeedQuery[] = LEGACY_NOTIFIKASI_EXPORTS.map((exportName) => {
  const category = inferLegacyQueryCategory(exportName);
  return {
    id: legacyNotifikasiQueryId(exportName),
    name: legacyNotifikasiLabel(exportName),
    category,
    description: legacyNotifikasiDescription(exportName),
    sqlText: `legacy:notifikasi.${exportName}`,
    outputColumns: inferLegacyOutputColumns(category),
    recipientColumn: category === "party" ? "telepon" : "",
    isActive: true,
  };
});

export const LEGACY_NOTIFIKASI_QUERY_CATALOG: AletaBotQueryCatalogItem[] = LEGACY_NOTIFIKASI_EXPORTS.map((exportName) => ({
  id: legacyNotifikasiQueryId(exportName),
  sourceFile: "notifikasi.js",
  exportName,
  category: inferLegacyCatalogCategory(exportName),
  description: legacyNotifikasiDescription(exportName),
  riskLevel: inferLegacyQueryCategory(exportName) === "party" ? "high" : "medium",
  testable: false,
}));
