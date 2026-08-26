export type JlfVariableQueryPreviewStatus = "registered" | "not_sipp" | "needs_review";

export type JlfVariableQueryPreview = {
  status: JlfVariableQueryPreviewStatus;
  queryKey: string | null;
  title: string;
  description: string;
  sqlPreview: string | null;
  outputPath: string;
  allowedParams: string[];
  readOnly: boolean;
  selectOnly: boolean;
  blockedReason: string | null;
  safetyNotes: string[];
};

type QueryPreviewDefinition = Omit<JlfVariableQueryPreview, "status" | "outputPath" | "selectOnly" | "blockedReason"> & {
  queryKey: string;
  defaultOutputPath: string;
  keywords: string[];
};

const SIPP_QUERY_PREVIEWS: Record<string, QueryPreviewDefinition> = {
  "sipp.perkara.by_nomor": {
    queryKey: "sipp.perkara.by_nomor",
    title: "Perkara berdasarkan nomor",
    description: "Mengambil ringkasan perkara dari adapter SIPP read-only berdasarkan nomor perkara.",
    sqlPreview: `SELECT p.perkara_id,
       p.nomor_perkara,
       p.jenis_perkara_nama,
       p.tanggal_pendaftaran,
       p.tahapan_terakhir_text,
       p.proses_terakhir_text
FROM perkara AS p
WHERE p.nomor_perkara = :nomor_perkara
LIMIT 1;`,
    defaultOutputPath: "perkara.nomor_perkara",
    allowedParams: ["nomor_perkara"],
    readOnly: true,
    safetyNotes: ["Preview ini tidak dieksekusi dari client.", "Parameter wajib melalui adapter/bridge terdaftar."],
    keywords: ["nomor_perkara", "perkara", "klasifikasi", "tanggal_daftar", "status_perkara"],
  },
  "sipp.perkara.search": {
    queryKey: "sipp.perkara.search",
    title: "Pencarian perkara",
    description: "Mencari perkara dengan limit aman melalui adapter SIPP, bukan raw SQL dari client.",
    sqlPreview: `SELECT p.perkara_id,
       p.nomor_perkara,
       p.jenis_perkara_nama,
       p.tanggal_pendaftaran,
       p.proses_terakhir_text
FROM perkara AS p
LEFT JOIN perkara_pihak1 AS pp ON pp.perkara_id = p.perkara_id
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE p.nomor_perkara LIKE :query
   OR ph.nama LIKE :query
ORDER BY p.tanggal_pendaftaran DESC
LIMIT :limit;`,
    defaultOutputPath: "perkara.search",
    allowedParams: ["query", "limit"],
    readOnly: true,
    safetyNotes: ["Limit pencarian wajib diterapkan.", "Input pencarian tidak boleh berisi SQL."],
    keywords: ["search", "cari", "nama_pihak", "keyword"],
  },
  "sipp.pihak.list": {
    queryKey: "sipp.pihak.list",
    title: "Daftar pihak perkara",
    description: "Mengambil daftar pihak pada perkara dari adapter SIPP read-only.",
    sqlPreview: `SELECT pp.perkara_id,
       pp.urutan,
       pp.jenis_pihak_id,
       COALESCE(pp.nama, ph.nama) AS nama,
       COALESCE(pp.alamat, ph.alamat) AS alamat,
       ph.pekerjaan,
       ph.tempat_lahir,
       ph.tanggal_lahir
FROM perkara_pihak1 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.urutan ASC;`,
    defaultOutputPath: "pihak.list",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Field sensitif harus dimasking di UI kecuali permission mengizinkan."],
    keywords: ["pihak", "para_pihak", "identitas"],
  },
  "sipp.pihak.penggugat": {
    queryKey: "sipp.pihak.penggugat",
    title: "Penggugat/Pemohon",
    description: "Mengambil pihak penggugat atau pemohon dari daftar pihak perkara.",
    sqlPreview: `SELECT pp.perkara_id,
       pp.urutan,
       pp.jenis_pihak_id,
       COALESCE(pp.nama, ph.nama) AS nama,
       COALESCE(pp.alamat, ph.alamat) AS alamat,
       ph.pekerjaan,
       ph.tempat_lahir,
       ph.tanggal_lahir
FROM perkara_pihak1 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.urutan ASC;`,
    defaultOutputPath: "pihak.penggugat.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Hasil lengkap hanya boleh tampil sesuai permission perkara."],
    keywords: ["penggugat", "pemohon", "nama_penggugat", "nama_pemohon"],
  },
  "sipp.pihak.tergugat": {
    queryKey: "sipp.pihak.tergugat",
    title: "Tergugat/Termohon",
    description: "Mengambil pihak tergugat atau termohon dari daftar pihak perkara.",
    sqlPreview: `SELECT pp.perkara_id,
       pp.urutan,
       pp.jenis_pihak_id,
       COALESCE(pp.nama, ph.nama) AS nama,
       COALESCE(pp.alamat, ph.alamat) AS alamat,
       ph.pekerjaan,
       ph.tempat_lahir,
       ph.tanggal_lahir
FROM perkara_pihak2 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.urutan ASC;`,
    defaultOutputPath: "pihak.tergugat.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Hasil lengkap hanya boleh tampil sesuai permission perkara."],
    keywords: ["tergugat", "termohon", "nama_tergugat", "nama_termohon"],
  },
  "sipp.saksi.list": {
    queryKey: "sipp.saksi.list",
    title: "Daftar saksi perkara",
    description: "Mengambil saksi perkara dari adapter SIPP read-only, termasuk saksi penggugat/pemohon jika tersedia.",
    sqlPreview: `SELECT pp.perkara_id,
       pp.urutan,
       pp.saksi_pihak_ke,
       COALESCE(pp.nama, ph.nama) AS nama,
       COALESCE(pp.alamat, ph.alamat) AS alamat,
       ph.pekerjaan,
       ph.agama_nama,
       ph.tanggal_lahir,
       pp.keterangan
FROM perkara_pihak5 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.saksi_pihak_ke ASC, pp.urutan ASC;`,
    defaultOutputPath: "saksi.list",
    allowedParams: ["perkara_id", "saksi_pihak_ke", "urutan"],
    readOnly: true,
    safetyNotes: ["Keterangan saksi adalah data sensitif dan harus dimasking di preview sesuai permission."],
    keywords: ["saksi", "keterangan_saksi", "perkara_pihak5"],
  },
  "sipp.sidang.list": {
    queryKey: "sipp.sidang.list",
    title: "Daftar jadwal sidang",
    description: "Mengambil jadwal sidang perkara agar user dapat memilih sidang yang dipakai dalam dokumen.",
    sqlPreview: `SELECT js.id AS sidang_id,
       js.perkara_id,
       js.urutan,
       js.tanggal_sidang,
       js.jam_sidang,
       js.agenda,
       js.dihadiri_oleh,
       prev.agenda AS agenda_sblmnya,
       prev.alasan_ditunda AS alasan_sblmnya,
       nxt.tanggal_sidang AS tanggal_ditunda
FROM perkara_jadwal_sidang AS js
LEFT JOIN perkara_jadwal_sidang AS prev ON prev.perkara_id = js.perkara_id AND prev.urutan = js.urutan - 1
LEFT JOIN perkara_jadwal_sidang AS nxt ON nxt.perkara_id = js.perkara_id AND nxt.urutan = js.urutan + 1
WHERE js.perkara_id = :perkara_id
ORDER BY js.urutan ASC, js.tanggal_sidang ASC, js.id ASC;`,
    defaultOutputPath: "sidang.list",
    allowedParams: ["perkara_id", "sidang_id", "sidang_urutan"],
    readOnly: true,
    safetyNotes: ["Resolver memakai sidang yang dipilih user, bukan menebak diam-diam."],
    keywords: ["sidang", "jadwal_sidang", "tanggal_sidang", "agenda"],
  },
  "sipp.sidang.by_id": {
    queryKey: "sipp.sidang.by_id",
    title: "Sidang terpilih",
    description: "Mengambil satu sidang tertentu yang dipilih user saat generate dokumen.",
    sqlPreview: `SELECT js.id AS sidang_id,
       js.perkara_id,
       js.urutan,
       js.tanggal_sidang,
       js.jam_sidang,
       js.agenda,
       js.dihadiri_oleh,
       prev.agenda AS agenda_sblmnya,
       prev.alasan_ditunda AS alasan_sblmnya,
       nxt.tanggal_sidang AS tanggal_ditunda
FROM perkara_jadwal_sidang AS js
LEFT JOIN perkara_jadwal_sidang AS prev ON prev.perkara_id = js.perkara_id AND prev.urutan = js.urutan - 1
LEFT JOIN perkara_jadwal_sidang AS nxt ON nxt.perkara_id = js.perkara_id AND nxt.urutan = js.urutan + 1
WHERE js.perkara_id = :perkara_id
  AND (js.id = :sidang_id OR js.urutan = :sidang_urutan)
LIMIT 1;`,
    defaultOutputPath: "sidang.terpilih.tanggal_sidang",
    allowedParams: ["perkara_id", "sidang_id", "sidang_urutan"],
    readOnly: true,
    safetyNotes: ["Parameter sidang_id berasal dari daftar jadwal SIPP yang sudah dipilih."],
    keywords: ["sidang_terpilih", "selected_hearing", "sidang_ke"],
  },
  "sipp.sidang.last": {
    queryKey: "sipp.sidang.last",
    title: "Sidang terakhir",
    description: "Mengambil sidang terakhir dari jadwal perkara.",
    sqlPreview: `SELECT js.id AS sidang_id,
       js.perkara_id,
       js.urutan,
       js.tanggal_sidang,
       js.agenda
FROM perkara_jadwal_sidang AS js
WHERE js.perkara_id = :perkara_id
ORDER BY js.tanggal_sidang DESC, js.urutan DESC
LIMIT 1;`,
    defaultOutputPath: "sidang.terakhir.tanggal_sidang",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Jika dokumen perlu sidang spesifik, gunakan sidang terpilih."],
    keywords: ["sidang_terakhir", "last_hearing"],
  },
  "sipp.sidang.next": {
    queryKey: "sipp.sidang.next",
    title: "Sidang berikutnya",
    description: "Mengambil sidang berikutnya dari jadwal perkara.",
    sqlPreview: `SELECT js.id AS sidang_id,
       js.perkara_id,
       js.urutan,
       js.tanggal_sidang,
       js.agenda
FROM perkara_jadwal_sidang AS js
WHERE js.perkara_id = :perkara_id
  AND js.tanggal_sidang >= CURRENT_DATE
ORDER BY js.tanggal_sidang ASC, js.urutan ASC
LIMIT 1;`,
    defaultOutputPath: "sidang.berikutnya.tanggal_sidang",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Tanggal pembanding diproses di adapter, bukan dari SQL client."],
    keywords: ["sidang_berikut", "next_hearing"],
  },
  "sipp.hakim.majelis": {
    queryKey: "sipp.hakim.majelis",
    title: "Majelis hakim",
    description: "Mengambil daftar hakim aktif pada perkara.",
    sqlPreview: `SELECT php.perkara_id,
       php.urutan,
       hp.id AS hakim_id,
       hp.nama_gelar AS nama,
       php.jabatan_hakim_nama AS jabatan
FROM perkara_hakim_pn AS php
JOIN hakim_pn AS hp ON hp.id = php.hakim_id
WHERE php.perkara_id = :perkara_id
ORDER BY php.urutan ASC;`,
    defaultOutputPath: "hakim.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Query aktual tetap dijalankan oleh adapter SIPP terkontrol."],
    keywords: ["hakim", "majelis", "ketua_majelis", "hakim_anggota"],
  },
  "sipp.panitera.pengganti": {
    queryKey: "sipp.panitera.pengganti",
    title: "Panitera pengganti",
    description: "Mengambil panitera pengganti aktif pada perkara.",
    sqlPreview: `SELECT ppp.perkara_id,
       pp.id AS panitera_id,
       pp.nama_gelar AS nama,
       ppp.aktif
FROM perkara_panitera_pn AS ppp
JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
WHERE ppp.perkara_id = :perkara_id
ORDER BY ppp.aktif DESC, ppp.id DESC;`,
    defaultOutputPath: "panitera.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Resolver dapat memilih data aktif atau daftar sesuai source_key."],
    keywords: ["panitera", "pp", "panitera_pengganti"],
  },
  "sipp.jurusita": {
    queryKey: "sipp.jurusita",
    title: "Jurusita",
    description: "Mengambil jurusita atau jurusita pengganti perkara.",
    sqlPreview: `SELECT pj.perkara_id,
       j.id AS jurusita_id,
       j.nama_gelar AS nama,
       pj.aktif
FROM perkara_jurusita AS pj
JOIN jurusita AS j ON j.id = pj.jurusita_id
WHERE pj.perkara_id = :perkara_id
ORDER BY pj.aktif DESC, pj.id DESC;`,
    defaultOutputPath: "jurusita.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Nama petugas ditampilkan sesuai kebutuhan dokumen dan permission."],
    keywords: ["jurusita", "jurusita_pengganti", "js", "jsp"],
  },
  "sipp.mediator": {
    queryKey: "sipp.mediator",
    title: "Mediator",
    description: "Mengambil data mediator perkara jika tersedia di SIPP.",
    sqlPreview: `SELECT m.perkara_id,
       m.mediator_id,
       m.mediator_text AS nama,
       COALESCE(m.dimulai_mediasi, m.penetapan_tanggal_mediasi) AS tanggal_mediasi,
       m.hasil_mediasi
FROM perkara_mediasi AS m
WHERE m.perkara_id = :perkara_id
ORDER BY COALESCE(m.dimulai_mediasi, m.penetapan_tanggal_mediasi) DESC
LIMIT 1;`,
    defaultOutputPath: "mediator.nama",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Jika struktur SIPP satker berbeda, adapter bridge yang menyesuaikan."],
    keywords: ["mediator", "mediasi"],
  },
  "sipp.putusan": {
    queryKey: "sipp.putusan",
    title: "Putusan/Penetapan",
    description: "Mengambil ringkasan putusan atau penetapan perkara.",
    sqlPreview: `SELECT pt.perkara_id,
       pt.tanggal_putusan,
       pt.amar_putusan,
       pt.status_putusan_nama,
       pt.tanggal_minutasi
FROM perkara_putusan AS pt
WHERE pt.perkara_id = :perkara_id
LIMIT 1;`,
    defaultOutputPath: "putusan.amar_putusan",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Isi putusan lengkap tidak ditampilkan ke user tanpa permission."],
    keywords: ["putusan", "penetapan", "amar", "minutasi", "akta_cerai"],
  },
  "sipp.biaya": {
    queryKey: "sipp.biaya",
    title: "Biaya perkara",
    description: "Mengambil ringkasan biaya perkara melalui adapter read-only.",
    sqlPreview: `SELECT pb.perkara_id,
       pb.tanggal_transaksi,
       pb.uraian,
       pb.jenis_transaksi,
       pb.jumlah,
       pb.sisa
FROM perkara_biaya AS pb
WHERE pb.perkara_id = :perkara_id
ORDER BY pb.tanggal_transaksi ASC, pb.id ASC;`,
    defaultOutputPath: "biaya.sisa",
    allowedParams: ["perkara_id"],
    readOnly: true,
    safetyNotes: ["Data biaya tidak otomatis membuka akses substansi perkara."],
    keywords: ["biaya", "keuangan", "panjar", "sisa_panjar"],
  },
  "sipp.satker.config": {
    queryKey: "sipp.satker.config",
    title: "Konfigurasi satker",
    description: "Mengambil konfigurasi satker yang aman dipakai dalam dokumen.",
    sqlPreview: `SELECT sc.name,
       sc.value AS data
FROM sys_config AS sc
WHERE sc.name = :name
LIMIT 1;`,
    defaultOutputPath: "satker.config.value",
    allowedParams: ["name"],
    readOnly: true,
    safetyNotes: ["Hanya nama konfigurasi allowlist yang boleh diminta adapter.", "Secret atau token tidak boleh diekspos sebagai variabel dokumen."],
    keywords: ["satker", "sys_config", "namapn", "nama_pn", "panseknama"],
  },
};

type QueryPreviewInput = {
  sourceType: string;
  sourceKey?: string | null;
  key?: string | null;
  adminNote?: string | null;
};

type QueryPreviewContext = {
  sourceType: string;
  sourceKey: string;
  key: string;
  adminNote: string;
  haystack: string;
  parts: string[];
  field: string;
  index: number;
  hasExplicitIndex: boolean;
};

type OfficialQueryConfig = {
  relationTable: string;
  relationAlias: string;
  masterTable: string;
  masterAlias: string;
  relationIdColumn: string;
  masterNameColumn: string;
  relationNameColumn: string;
  relationNipColumn: string;
  relationKodeColumn: string;
  relationJabatanColumn: string;
};

const SAFE_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/i;
const WRITE_SQL_PATTERN = /\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|merge|call|load|outfile|infile|lock|unlock)\b/i;
const SELECT_SQL_PATTERN = /^\s*(select|with)\b/i;
const SOURCE_PREFIXES = new Set([
  "perkara",
  "pihak",
  "penggugat",
  "pemohon",
  "tergugat",
  "termohon",
  "intervensi",
  "turut_tergugat",
  "saksi",
  "sidang",
  "hakim",
  "panitera",
  "jurusita",
  "putusan",
  "biaya",
  "mediasi",
  "mediator",
  "pernikahan",
  "relaas",
  "kuasa",
  "pengacara",
]);

const PERKARA_COLUMNS = new Set([
  "perkara_id",
  "jenis_acara",
  "alur_perkara_id",
  "tanggal_pendaftaran",
  "jenis_perkara_id",
  "jenis_perkara_kode",
  "jenis_perkara_nama",
  "jenis_perkara_text",
  "nomor_urut_register",
  "nomor_urut_perkara",
  "nomor_perkara",
  "nomor_indeks",
  "tanggal_surat",
  "nomor_surat",
  "surat_dok",
  "pihak1_text",
  "pengacara_pihak1",
  "pihak2_text",
  "pengacara_pihak2",
  "pihak3_text",
  "pengacara_pihak3",
  "pihak4_text",
  "pengacara_pihak4",
  "para_pihak",
  "pihak_dipublikasikan",
  "posita",
  "petitum",
  "petitum_dok",
  "nomor_dakwaan",
  "tanggal_dakwaan",
  "dakwaan",
  "pasal_dakwaan",
  "dakwaan_dok",
  "tanggal_rencana_perdamaian",
  "tanggal_pengesahan_perdamaian",
  "tanggal_penyelesaian_mediasi",
  "tanggal_penyelesaian_konsiliasi",
  "perkara_rujukan_id",
  "nomor_perkara_rujukan",
  "tanggal_pendaftaran_rujukan",
  "catatan_pendaftaran",
  "prodeo",
  "terdakwa_anak",
  "tahapan_terakhir_id",
  "tahapan_terakhir_text",
  "proses_terakhir_id",
  "proses_terakhir_text",
  "nilai_sengketa",
  "diinput_tanggal",
  "diperbaharui_tanggal",
  "diedit_tanggal",
]);

const PARTY_TABLES: Record<string, string> = {
  penggugat: "perkara_pihak1",
  pemohon: "perkara_pihak1",
  pihak1: "perkara_pihak1",
  tergugat: "perkara_pihak2",
  termohon: "perkara_pihak2",
  terdakwa: "perkara_pihak2",
  pihak2: "perkara_pihak2",
  intervensi: "perkara_pihak3",
  pihak3: "perkara_pihak3",
  turut_tergugat: "perkara_pihak4",
  pihak4: "perkara_pihak4",
  saksi: "perkara_pihak5",
  pihak5: "perkara_pihak5",
};

const PARTY_COLUMNS = new Set([
  "id",
  "perkara_id",
  "urutan",
  "pihak_id",
  "jenis_pihak_id",
  "nama",
  "alamat",
  "kondisi_pihak",
  "keterangan",
  "pangkat",
  "pangkat_id",
  "nrp",
  "jabatan",
  "kesatuan",
  "saksi_pihak_ke",
  "jenis_saksi",
]);

const PIHAK_COLUMNS = new Set([
  "id",
  "jenis_pihak_id",
  "jenis_indentitas",
  "nomor_indentitas",
  "nama",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "alamat",
  "kelurahan",
  "kecamatan",
  "kabupaten",
  "propinsi",
  "telepon",
  "email",
  "agama_nama",
  "status_kawin",
  "pekerjaan",
  "pendidikan",
  "warga_negara",
  "nama_ayah",
  "nama_ibu",
  "keterangan",
]);

const HEARING_COLUMNS = new Set([
  "id",
  "perkara_id",
  "urutan",
  "tanggal_sidang",
  "jam_sidang",
  "sampai_jam",
  "agenda_id",
  "agenda",
  "ruangan_id",
  "ruangan",
  "sidang_keliling",
  "dihadiri_oleh",
  "ditunda",
  "alasan_ditunda",
  "sifat_sidang",
  "keterangan",
  "edoc_bas",
]);

const PUTUSAN_COLUMNS = new Set([
  "tanggal_putusan",
  "putusan_verstek",
  "sumber_hukum_id",
  "status_putusan_id",
  "status_putusan_kode",
  "status_putusan_nama",
  "status_putusan_text",
  "tanggal_cabut",
  "tanggal_gugur",
  "amar_putusan",
  "catatan_putusan",
  "nilai_ganti_kerugian",
  "tanggal_minutasi",
  "pemberitahuan_putusan",
  "pemberitahuan_putusan_pihak1",
  "pemberitahuan_putusan_pihak2",
  "menerima_putusan_pihak1",
  "menerima_putusan_pihak2",
  "penerbitan_salinan_putusan",
  "kirim_salinan_putusan_pihak1",
  "kirim_salinan_putusan_pihak2",
  "tanggal_bht",
]);

const AKTA_CERAI_FIELD_MAP: Record<string, string> = {
  nomor_akta_cerai: "nomor_akta_cerai",
  tanggal_akta_cerai: "tgl_akta_cerai",
  nomor_seri_akta_cerai: "no_seri_akta_cerai",
  jenis_cerai: "jenis_cerai",
  perceraian_ke: "perceraian_ke",
  tanggal_penyerahan_akta_cerai_pihak1: "tgl_penyerahan_akta_cerai",
  tanggal_penyerahan_akta_cerai_pihak2: "tgl_penyerahan_akta_cerai_pihak2",
};

const IKRAR_FIELD_MAP: Record<string, string> = {
  tanggal_ikrar_talak: "tgl_ikrar_talak",
  amar_ikrar_talak: "amar_ikrar_talak",
  status_penetapan_ikrar_talak: "status_penetapan_ikrar_talak_id",
};

const MEDIASI_FIELD_MAP: Record<string, string> = {
  tanggal_mediasi: "COALESCE(pm.dimulai_mediasi, pm.penetapan_tanggal_mediasi)",
  mediator: "pm.mediator_text",
  nama_mediator: "pm.mediator_text",
  mediator_text: "pm.mediator_text",
  penetapan_penunjukan_mediator: "pm.penetapan_penunjukan_mediator",
  nomor_sk_penetapan_mediator: "pm.nomor_sk_penetapan_mediator",
  dimulai_mediasi: "pm.dimulai_mediasi",
  keputusan_mediasi: "pm.keputusan_mediasi",
  hasil_mediasi: "pm.hasil_mediasi",
  catatan_mediasi: "pm.catatan_mediasi",
  isi_kesepakatan_perdamaian: "pm.isi_kesepakatan_perdamaian",
  isi_akta_perdamaian: "pm.isi_akta_perdamaian",
};

const PERNIKAHAN_FIELD_MAP: Record<string, string> = {
  tanggal_nikah: "pdn.tgl_nikah",
  tgl_nikah: "pdn.tgl_nikah",
  tanggal_kutipan_akta_nikah: "pdn.tgl_kutipan_akta_nikah",
  nomor_kutipan_akta_nikah: "pdn.no_kutipan_akta_nikah",
  no_kutipan_akta_nikah: "pdn.no_kutipan_akta_nikah",
  kua_tempat_nikah: "pdn.kua_tempat_nikah",
};

function normalizeSqlIdentifier(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENTIFIER_PATTERN.test(normalized) ? normalized : "";
}

function column(alias: string, field: string, allowed: Set<string>) {
  const normalized = normalizeSqlIdentifier(field);
  if (!normalized || !allowed.has(normalized)) return `NULL /* needs_review: ${normalized || "unknown_column"} */`;
  return `${alias}.${normalized}`;
}

function makeContext(input: QueryPreviewInput): QueryPreviewContext {
  const sourceType = (input.sourceType || "").trim().toLowerCase();
  const sourceKey = (input.sourceKey || "").trim();
  const key = (input.key || "").trim();
  const adminNote = (input.adminNote || "").trim();
  const normalizedSourceKey = sourceKey.toLowerCase().replace(/[^a-z0-9_.]+/g, ".");
  const parts = normalizedSourceKey.split(".").filter(Boolean);
  const candidates = parts.filter((part) => !SOURCE_PREFIXES.has(part) && !/^\d+$/.test(part));
  const field = normalizeSqlIdentifier(candidates[candidates.length - 1] || sourceKey || key);
  const numericPart = parts.find((part) => /^\d+$/.test(part));
  const index = Math.max(1, Number.parseInt(numericPart || "1", 10) || 1);

  return {
    sourceType,
    sourceKey,
    key,
    adminNote,
    haystack: `${sourceType} ${sourceKey} ${key} ${adminNote}`.toLowerCase(),
    parts,
    field,
    index,
    hasExplicitIndex: Boolean(numericPart),
  };
}

function hasAnyIntent(ctx: QueryPreviewContext, values: string[]) {
  return values.some((value) => ctx.haystack.includes(value));
}

function buildReadOnlySelect(params: {
  expression: string;
  from: string;
  where: string[];
  orderBy?: string;
  limit?: number | null;
}) {
  const whereSql = params.where.map((condition, index) => `${index === 0 ? "WHERE" : "  AND"} ${condition}`).join("\n");
  const orderSql = params.orderBy ? `\nORDER BY ${params.orderBy}` : "";
  const limitSql = params.limit === null ? ";" : `\nLIMIT ${params.limit ?? 1};`;

  return `SELECT
  ${params.expression} AS data
FROM ${params.from}
${whereSql}${orderSql}${limitSql}`;
}

function buildPengacaraQuery(ctx: QueryPreviewContext) {
  const pihakKe = hasAnyIntent(ctx, ["pihak4", "turut"]) ? 4 : hasAnyIntent(ctx, ["pihak3", "intervensi"]) ? 3 : hasAnyIntent(ctx, ["pihak2", "tergugat", "termohon"]) ? 2 : 1;
  const field = hasAnyIntent(ctx, ["tanggal_kuasa", "tgl_kuasa"])
    ? "tanggal_kuasa"
    : hasAnyIntent(ctx, ["nomor_kuasa", "no_kuasa"])
      ? "nomor_kuasa"
      : hasAnyIntent(ctx, ["alamat"])
        ? "alamat"
        : hasAnyIntent(ctx, ["aktif_mulai"])
          ? "aktif_mulai"
          : hasAnyIntent(ctx, ["aktif_sampai"])
            ? "aktif_sampai"
            : hasAnyIntent(ctx, ["masa_aktif"])
              ? "masa_aktif"
              : "nama";

  return buildReadOnlySelect({
    expression: `pa.${field}`,
    from: "perkara_pengacara AS pa",
    where: [`pa.pihak_ke = ${pihakKe}`, `pa.urutan = ${ctx.index}`, "pa.perkara_id = :perkara_id"],
  });
}

function buildMediasiQuery(ctx: QueryPreviewContext) {
  const expression = MEDIASI_FIELD_MAP[ctx.field] ?? column("pm", ctx.field, new Set(Object.keys(MEDIASI_FIELD_MAP)));
  return buildReadOnlySelect({
    expression,
    from: "perkara_mediasi AS pm",
    where: ["pm.perkara_id = :perkara_id"],
  });
}

function buildPernikahanQuery(ctx: QueryPreviewContext) {
  const expression = PERNIKAHAN_FIELD_MAP[ctx.field] ?? "NULL /* needs_review: pernikahan_field */";
  return buildReadOnlySelect({
    expression,
    from: "perkara_data_pernikahan AS pdn",
    where: ["pdn.perkara_id = :perkara_id"],
  });
}

function buildPenyebutanPihak1Query() {
  return `SELECT
  CASE
    WHEN p1.urutan = 1 AND p1.alur_perkara_id = 15 AND p1.jenis_perkara_id = 346 THEN 'Pemohon'
    WHEN p1.urutan = 1 AND p1.alur_perkara_id = 15 THEN 'Penggugat'
    WHEN p1.urutan BETWEEN 2 AND 100 AND p1.alur_perkara_id = 15 THEN 'para Penggugat'
    WHEN p1.urutan = 1 AND p1.alur_perkara_id = 16 THEN 'Pemohon'
    WHEN p1.urutan BETWEEN 2 AND 100 AND p1.alur_perkara_id = 16 THEN 'para Pemohon'
    ELSE ''
  END AS data
FROM (
  SELECT pp1.perkara_id,
         MAX(pp1.urutan) AS urutan,
         p.alur_perkara_id,
         p.jenis_perkara_id
  FROM perkara_pihak1 AS pp1
  JOIN perkara AS p ON pp1.perkara_id = p.perkara_id
  WHERE pp1.perkara_id = :perkara_id
  GROUP BY pp1.perkara_id, p.alur_perkara_id, p.jenis_perkara_id
) AS p1;`;
}

function buildPenyebutanPihak2Query() {
  return `SELECT
  CASE
    WHEN p2.urutan = 1 AND p2.alur_perkara_id = 15 THEN 'Tergugat'
    WHEN p2.urutan BETWEEN 2 AND 100 AND p2.alur_perkara_id = 15 THEN 'para Tergugat'
    WHEN p2.urutan = 1 AND p2.alur_perkara_id = 16 THEN 'Termohon'
    WHEN p2.urutan BETWEEN 2 AND 100 AND p2.alur_perkara_id = 16 THEN 'para Termohon'
    ELSE ''
  END AS data
FROM (
  SELECT pp2.perkara_id,
         MAX(pp2.urutan) AS urutan,
         p.alur_perkara_id,
         p.jenis_perkara_id
  FROM perkara_pihak2 AS pp2
  JOIN perkara AS p ON pp2.perkara_id = p.perkara_id
  WHERE pp2.perkara_id = :perkara_id
  GROUP BY pp2.perkara_id, p.alur_perkara_id, p.jenis_perkara_id
) AS p2;`;
}

function buildEcourtStatusQuery() {
  return `SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM perkara_efiling_id AS pei
      WHERE pei.perkara_id = p.perkara_id
        AND COALESCE(pei.efiling_id, '') <> ''
    ) THEN 'didaftarkan secara elektronik melalui Aplikasi e-Court'
    ELSE 'terdaftar pada kepaniteraan pengadilan'
  END AS data
FROM perkara AS p
WHERE p.perkara_id = :perkara_id
LIMIT 1;`;
}

function buildPmhConsiderationQuery(ctx: QueryPreviewContext) {
  const variant = ctx.index;
  return `SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM perkara_efiling_id AS pei
      WHERE pei.perkara_id = h.perkara_id
        AND COALESCE(pei.efiling_id, '') <> ''
    ) AND MIN(h.jabatan_hakim_id) = 3 AND MIN(p.jenis_perkara_id) = 360 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang didaftarkan secara elektronik melalui Aplikasi e-Court dengan register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan #0690# yang susunannya tersebut di bawah ini;\\n',
        'Mengingat ketentuan administrasi perkara elektronik dan pedoman sidang terpadu yang berlaku. [JLF-PMH-${variant}]'
      )
    WHEN EXISTS (
      SELECT 1
      FROM perkara_efiling_id AS pei
      WHERE pei.perkara_id = h.perkara_id
        AND COALESCE(pei.efiling_id, '') <> ''
    ) AND MIN(h.jabatan_hakim_id) = 1 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang didaftarkan secara elektronik melalui Aplikasi e-Court dengan register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan #0690# yang susunannya tersebut di bawah ini;\\n',
        'Mengingat ketentuan administrasi perkara dan persidangan secara elektronik. [JLF-PMH-${variant}]'
      )
    WHEN MIN(h.jabatan_hakim_id) = 3 AND MIN(p.jenis_perkara_id) = 362 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang terdaftar dalam register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan #0690# sebagaimana tersebut di bawah ini;\\n',
        'Memperhatikan pedoman pemeriksaan dispensasi kawin dan ketentuan hukum terkait. [JLF-PMH-${variant}]'
      )
    WHEN MIN(h.jabatan_hakim_id) = 3 AND MIN(p.jenis_perkara_id) = 370 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang terdaftar dalam register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan #0690# yang namanya seperti tersebut di bawah ini;\\n',
        'Mengingat pedoman penyelesaian gugatan sederhana dan ekonomi syariah. [JLF-PMH-${variant}]'
      )
    WHEN MIN(h.jabatan_hakim_id) = 1 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang terdaftar dalam register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan #0690# yang susunannya tersebut di bawah ini. [JLF-PMH-${variant}]'
      )
    WHEN MIN(h.jabatan_hakim_id) = 3 THEN
      CONCAT(
        '#7051# #8008# telah membaca surat #0053# #0046# yang terdaftar dalam register Nomor #0001# tanggal #1061#;\\n',
        'Menimbang, bahwa perkara dapat diperiksa oleh #0690# sesuai penetapan dan ketentuan yang berlaku. [JLF-PMH-${variant}]'
      )
    ELSE 'CODE MASIH PERLU REVIEW JLF'
  END AS data
FROM perkara_hakim_pn AS h
JOIN perkara AS p ON h.perkara_id = p.perkara_id
WHERE h.aktif = 'Y'
  AND h.perkara_id = :perkara_id
GROUP BY h.perkara_id;`;
}

function buildPerkaraQuery(ctx: QueryPreviewContext) {
  if (hasAnyIntent(ctx, ["penyebutan_pihak1", "penyebutan_penggugat", "penyebutan_pemohon"])) return buildPenyebutanPihak1Query();
  if (hasAnyIntent(ctx, ["penyebutan_pihak2", "penyebutan_tergugat", "penyebutan_termohon"])) return buildPenyebutanPihak2Query();
  if (hasAnyIntent(ctx, ["pertimbangan_pmh", "format_pmh", "pmh_majelis_tunggal"])) return buildPmhConsiderationQuery(ctx);
  if (hasAnyIntent(ctx, ["status_ecourt", "redaksi_ecourt", "keterangan_ecourt"])) return buildEcourtStatusQuery();
  if (hasAnyIntent(ctx, ["pengacara", "kuasa"])) return buildPengacaraQuery(ctx);
  if (ctx.parts.includes("mediasi") || hasAnyIntent(ctx, ["mediator", "hasil_mediasi"])) return buildMediasiQuery(ctx);
  if (ctx.parts.includes("pernikahan") || hasAnyIntent(ctx, ["nikah", "kutipan_akta_nikah", "kua_"])) return buildPernikahanQuery(ctx);

  const fieldMap: Record<string, string> = {
    tahun_perkara: "YEAR(p.tanggal_pendaftaran)",
    kode_perkara: "p.jenis_perkara_kode",
    alur_perkara_nama: "p.jenis_acara",
    klasifikasi_perkara: "COALESCE(p.jenis_perkara_text, p.jenis_perkara_nama)",
    tanggal_input_perkara: "p.diinput_tanggal",
    tanggal_update_perkara: "COALESCE(p.diperbaharui_tanggal, p.diedit_tanggal)",
    umur_perkara_hari: "DATEDIFF(CURRENT_DATE, p.tanggal_pendaftaran)",
    nomor_perkara_masked: "p.nomor_perkara",
    ringkasan_perkara: "CONCAT_WS(' | ', p.nomor_perkara, p.jenis_perkara_nama, p.tahapan_terakhir_text)",
    status_perkara: "p.proses_terakhir_text",
  };
  const expression = fieldMap[ctx.field] ?? column("p", ctx.field, PERKARA_COLUMNS);

  return buildReadOnlySelect({
    expression,
    from: "perkara AS p",
    where: ["p.perkara_id = :perkara_id"],
  });
}

function resolvePartyTable(ctx: QueryPreviewContext) {
  for (const part of ctx.parts) {
    if (PARTY_TABLES[part]) return PARTY_TABLES[part];
  }
  if (hasAnyIntent(ctx, ["saksi"])) return "perkara_pihak5";
  if (hasAnyIntent(ctx, ["tergugat", "termohon", "terdakwa", "pihak2"])) return "perkara_pihak2";
  if (hasAnyIntent(ctx, ["intervensi", "pihak3"])) return "perkara_pihak3";
  if (hasAnyIntent(ctx, ["turut_tergugat", "pihak4"])) return "perkara_pihak4";
  return "perkara_pihak1";
}

function partyExpression(field: string) {
  const fieldMap: Record<string, string> = {
    nama: "COALESCE(pp.nama, ph.nama)",
    nama_lengkap: "COALESCE(pp.nama, ph.nama)",
    nama_dengan_alias: "COALESCE(pp.nama, ph.nama)",
    alamat: "COALESCE(pp.alamat, ph.alamat)",
    alamat_lengkap: "COALESCE(pp.alamat, ph.alamat)",
    identitas_lengkap: "CONCAT_WS(', ', COALESCE(pp.nama, ph.nama), ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_nama, ph.pekerjaan, COALESCE(pp.alamat, ph.alamat))",
    identitas_ringkas: "CONCAT_WS(', ', COALESCE(pp.nama, ph.nama), ph.pekerjaan, COALESCE(pp.alamat, ph.alamat))",
    jenis_identitas: "ph.jenis_indentitas",
    nomor_identitas: "ph.nomor_indentitas",
    nomor_identitas_masked: "ph.nomor_indentitas",
    agama: "ph.agama_nama",
    telepon_masked: "ph.telepon",
    email_masked: "ph.email",
    umur: "TIMESTAMPDIFF(YEAR, ph.tanggal_lahir, CURRENT_DATE)",
  };
  if (fieldMap[field]) return fieldMap[field];
  if (PARTY_COLUMNS.has(field)) return `pp.${field}`;
  if (PIHAK_COLUMNS.has(field)) return `ph.${field}`;
  return `NULL /* needs_review: ${field || "party_field"} */`;
}

function buildPartyQuery(ctx: QueryPreviewContext) {
  const table = resolvePartyTable(ctx);
  return buildReadOnlySelect({
    expression: partyExpression(ctx.field),
    from: `${table} AS pp\nLEFT JOIN pihak AS ph ON ph.id = pp.pihak_id`,
    where: ["pp.perkara_id = :perkara_id", `pp.urutan = ${ctx.index}`],
  });
}

function hearingExpression(field: string) {
  const fieldMap: Record<string, string> = {
    sidang_id: "js.id",
    sidang_ke: "js.urutan",
    urutan: "js.urutan",
    hari_sidang: "js.tanggal_sidang",
    tanggal_sidang: "js.tanggal_sidang",
    tanggal_ditunda: "nxt.tanggal_sidang",
    agenda_sblmnya: "prev.agenda",
    alasan_sblmnya: "prev.alasan_ditunda",
    agenda_ditunda: "nxt.agenda",
    alasan_ditunda: "js.alasan_ditunda",
    dihadiri_oleh: "js.dihadiri_oleh",
    ruangan: "js.ruangan",
    keterangan_sidang: "js.keterangan",
    sidang_terakhir_tanggal: "js.tanggal_sidang",
    sidang_berikutnya_tanggal: "js.tanggal_sidang",
    agenda_sidang_terakhir: "js.agenda",
    agenda_sidang_berikutnya: "js.agenda",
    daftar_jadwal_sidang: "CONCAT_WS(' | ', js.urutan, js.tanggal_sidang, js.jam_sidang, js.agenda)",
  };
  return fieldMap[field] ?? column("js", field, HEARING_COLUMNS);
}

function buildHearingQuery(ctx: QueryPreviewContext, queryKey: string) {
  const where = ["js.perkara_id = :perkara_id"];
  let orderBy = "js.urutan ASC, js.tanggal_sidang ASC, js.id ASC";
  let limit: number | null = 1;

  if (queryKey === "sipp.sidang.by_id") {
    where.push("(js.id = :sidang_id OR js.urutan = :sidang_urutan)");
  } else if (queryKey === "sipp.sidang.last") {
    orderBy = "js.urutan DESC, js.tanggal_sidang DESC, js.id DESC";
  } else if (queryKey === "sipp.sidang.next") {
    where.push("js.tanggal_sidang >= CURRENT_DATE");
  } else if (ctx.field === "daftar_jadwal_sidang") {
    limit = null;
  } else if (ctx.hasExplicitIndex) {
    where.push(`js.urutan = ${ctx.index}`);
  }

  return buildReadOnlySelect({
    expression: hearingExpression(ctx.field),
    from: "perkara_jadwal_sidang AS js\nLEFT JOIN perkara_jadwal_sidang AS prev ON prev.perkara_id = js.perkara_id AND prev.urutan = js.urutan - 1\nLEFT JOIN perkara_jadwal_sidang AS nxt ON nxt.perkara_id = js.perkara_id AND nxt.urutan = js.urutan + 1",
    where,
    orderBy,
    limit,
  });
}

function officialExpression(ctx: QueryPreviewContext, config: OfficialQueryConfig) {
  const relation = config.relationAlias;
  const master = config.masterAlias;
  const fieldMap: Record<string, string> = {
    nama: `COALESCE(${relation}.${config.relationNameColumn}, ${master}.nama_gelar, ${master}.${config.masterNameColumn})`,
    nama_gelar: `COALESCE(${master}.nama_gelar, ${relation}.${config.relationNameColumn}, ${master}.${config.masterNameColumn})`,
    nip: `COALESCE(${relation}.${config.relationNipColumn}, ${master}.nip)`,
    nip_masked: `COALESCE(${relation}.${config.relationNipColumn}, ${master}.nip)`,
    kode: `COALESCE(${relation}.${config.relationKodeColumn}, ${master}.kode)`,
    jabatan: `${relation}.${config.relationJabatanColumn}`,
    pangkat: `${master}.pangkat`,
    tanggal_penetapan: `${relation}.tanggal_penetapan`,
    nomor_sk_penetapan: `${relation}.nomor_sk_penetapan`,
    urutan: `${relation}.urutan`,
    aktif: `${relation}.aktif`,
    keterangan: `COALESCE(${relation}.keterangan, ${master}.keterangan)`,
  };
  return fieldMap[ctx.field] ?? `NULL /* needs_review: ${ctx.field || "official_field"} */`;
}

function buildOfficialQuery(ctx: QueryPreviewContext, config: OfficialQueryConfig) {
  const expression = officialExpression(ctx, config);
  const aggregateFields = new Set(["nama", "nama_gelar", "nip", "nip_masked", "kode", "jabatan", "pangkat"]);
  if (!ctx.hasExplicitIndex && aggregateFields.has(ctx.field)) {
    return buildReadOnlySelect({
      expression: `GROUP_CONCAT(${expression} ORDER BY ${config.relationAlias}.urutan ASC SEPARATOR ', ')`,
      from: `${config.relationTable} AS ${config.relationAlias}\nLEFT JOIN ${config.masterTable} AS ${config.masterAlias} ON ${config.masterAlias}.id = ${config.relationAlias}.${config.relationIdColumn}`,
      where: [`${config.relationAlias}.perkara_id = :perkara_id`],
      limit: null,
    });
  }

  return buildReadOnlySelect({
    expression,
    from: `${config.relationTable} AS ${config.relationAlias}\nLEFT JOIN ${config.masterTable} AS ${config.masterAlias} ON ${config.masterAlias}.id = ${config.relationAlias}.${config.relationIdColumn}`,
    where: [`${config.relationAlias}.perkara_id = :perkara_id`, ctx.hasExplicitIndex ? `${config.relationAlias}.urutan = ${ctx.index}` : `${config.relationAlias}.aktif = 'Y'`],
    orderBy: `${config.relationAlias}.aktif DESC, ${config.relationAlias}.urutan ASC`,
  });
}

function buildJurusitaOrRelaasQuery(ctx: QueryPreviewContext) {
  if (ctx.parts.includes("relaas") || hasAnyIntent(ctx, ["relaas", "pemberitahuan", "resi_pos"])) {
    const relaasMap: Record<string, string> = {
      tanggal_relaas: "pr.tanggal_relaas",
      tanggal_jurusita_pos: "pr.tanggal_jursit_pos",
      nomor_resi_pos: "pr.no_resi_pos",
      status_pos: "pr.status_pos",
      ketemu_pihak: "pr.ket_temu",
      hasil_relaas: "pr.ket_hasil_relaas",
    };
    if (ctx.field === "tanggal_pemberitahuan" || ctx.field === "jenis_pemberitahuan") {
      return buildReadOnlySelect({
        expression: ctx.field === "tanggal_pemberitahuan" ? "pbt.tanggal" : "pbt.jenis_pemberitahuan",
        from: "perkara_pemberitahuan AS pbt",
        where: ["pbt.perkara_id = :perkara_id"],
        orderBy: "pbt.tanggal DESC, pbt.id DESC",
      });
    }

    return buildReadOnlySelect({
      expression: relaasMap[ctx.field] ?? "NULL /* needs_review: relaas_field */",
      from: "perkara_pelaksanaan_relaas AS pr",
      where: ["pr.perkara_id = :perkara_id"],
      orderBy: "pr.tanggal_relaas DESC, pr.id DESC",
    });
  }

  return buildOfficialQuery(ctx, {
    relationTable: "perkara_jurusita",
    relationAlias: "pj",
    masterTable: "jurusita",
    masterAlias: "j",
    relationIdColumn: "jurusita_id",
    masterNameColumn: "nama",
    relationNameColumn: "jurusita_nama",
    relationNipColumn: "jurusita_nip",
    relationKodeColumn: "jurusita_kode",
    relationJabatanColumn: "keterangan",
  });
}

function buildDecisionQuery(ctx: QueryPreviewContext) {
  if (AKTA_CERAI_FIELD_MAP[ctx.field]) {
    return buildReadOnlySelect({
      expression: `ac.${AKTA_CERAI_FIELD_MAP[ctx.field]}`,
      from: "perkara_akta_cerai AS ac",
      where: ["ac.perkara_id = :perkara_id"],
    });
  }

  if (IKRAR_FIELD_MAP[ctx.field]) {
    return buildReadOnlySelect({
      expression: `it.${IKRAR_FIELD_MAP[ctx.field]}`,
      from: "perkara_ikrar_talak AS it",
      where: ["it.perkara_id = :perkara_id"],
    });
  }

  const fieldMap: Record<string, string> = {
    hari_putusan: "pt.tanggal_putusan",
    amar_putusan_ringkas: "pt.amar_putusan",
  };

  return buildReadOnlySelect({
    expression: fieldMap[ctx.field] ?? column("pt", ctx.field, PUTUSAN_COLUMNS),
    from: "perkara_putusan AS pt",
    where: ["pt.perkara_id = :perkara_id"],
    orderBy: "pt.tanggal_putusan DESC",
  });
}

function buildFeeQuery(ctx: QueryPreviewContext) {
  const aggregateMap: Record<string, string> = {
    panjar_perkara: "SUM(CASE WHEN pb.jenis_transaksi = 1 THEN pb.jumlah ELSE 0 END)",
    jumlah_biaya: "SUM(pb.jumlah)",
    biaya_panggilan: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%panggilan%' THEN pb.jumlah ELSE 0 END)",
    biaya_pemberitahuan: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%pemberitahuan%' THEN pb.jumlah ELSE 0 END)",
    biaya_meterai: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%meterai%' THEN pb.jumlah ELSE 0 END)",
    biaya_redaksi: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%redaksi%' THEN pb.jumlah ELSE 0 END)",
    biaya_atk: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%atk%' THEN pb.jumlah ELSE 0 END)",
    biaya_pnbp: "SUM(CASE WHEN LOWER(pb.uraian) LIKE '%pnbp%' THEN pb.jumlah ELSE 0 END)",
  };

  if (aggregateMap[ctx.field]) {
    return buildReadOnlySelect({
      expression: aggregateMap[ctx.field],
      from: "perkara_biaya AS pb",
      where: ["pb.perkara_id = :perkara_id"],
      limit: null,
    });
  }

  const fieldMap: Record<string, string> = {
    sisa_biaya: "pb.sisa",
    tanggal_transaksi_biaya_terakhir: "pb.tanggal_transaksi",
    uraian_biaya_terakhir: "pb.uraian",
    daftar_biaya_perkara: "CONCAT_WS(' | ', pb.tanggal_transaksi, pb.uraian, pb.jumlah, pb.sisa)",
  };

  return buildReadOnlySelect({
    expression: fieldMap[ctx.field] ?? column("pb", ctx.field, new Set(["tanggal_transaksi", "uraian", "jumlah", "sisa", "keterangan"])),
    from: "perkara_biaya AS pb",
    where: ["pb.perkara_id = :perkara_id"],
    orderBy: ctx.field === "daftar_biaya_perkara" ? "pb.tanggal_transaksi ASC, pb.id ASC" : "pb.tanggal_transaksi DESC, pb.id DESC",
    limit: ctx.field === "daftar_biaya_perkara" ? null : 1,
  });
}

function buildSatkerConfigQuery(ctx: QueryPreviewContext) {
  const configNameMap: Record<string, string> = {
    nama_satker: "NamaPN",
    nama_satker_huruf_besar: "NamaPN",
    alamat_satker: "AlamatPN",
    panitera: "PanSekNama",
    nama_panitera: "PanSekNama",
    pansek: "PanSekNama",
  };
  const requestedName = configNameMap[ctx.field] ?? ctx.sourceKey.split(".").pop() ?? ctx.key;
  const safeName = requestedName.replace(/[^a-zA-Z0-9_.-]+/g, "");
  return buildReadOnlySelect({
    expression: "sc.value",
    from: "sys_config AS sc",
    where: [`sc.name = '${safeName || "NamaPN"}'`],
  });
}

function buildDynamicSqlPreview(definition: QueryPreviewDefinition, input?: QueryPreviewInput) {
  if (!input) return definition.sqlPreview;

  const ctx = makeContext(input);
  switch (definition.queryKey) {
    case "sipp.perkara.by_nomor":
      return buildPerkaraQuery(ctx);
    case "sipp.pihak.list":
    case "sipp.pihak.penggugat":
    case "sipp.pihak.tergugat":
    case "sipp.saksi.list":
      return buildPartyQuery(ctx);
    case "sipp.sidang.list":
    case "sipp.sidang.by_id":
    case "sipp.sidang.last":
    case "sipp.sidang.next":
      return buildHearingQuery(ctx, definition.queryKey);
    case "sipp.hakim.majelis":
      return buildOfficialQuery(ctx, {
        relationTable: "perkara_hakim_pn",
        relationAlias: "php",
        masterTable: "hakim_pn",
        masterAlias: "hp",
        relationIdColumn: "hakim_id",
        masterNameColumn: "nama",
        relationNameColumn: "hakim_nama",
        relationNipColumn: "hakim_nip",
        relationKodeColumn: "hakim_kode",
        relationJabatanColumn: "jabatan_hakim_nama",
      });
    case "sipp.panitera.pengganti":
      return buildOfficialQuery(ctx, {
        relationTable: "perkara_panitera_pn",
        relationAlias: "ppp",
        masterTable: "panitera_pn",
        masterAlias: "ppn",
        relationIdColumn: "panitera_id",
        masterNameColumn: "nama",
        relationNameColumn: "panitera_nama",
        relationNipColumn: "panitera_nip",
        relationKodeColumn: "panitera_kode",
        relationJabatanColumn: "keterangan",
      });
    case "sipp.jurusita":
      return buildJurusitaOrRelaasQuery(ctx);
    case "sipp.mediator":
      return buildMediasiQuery(ctx);
    case "sipp.putusan":
      return buildDecisionQuery(ctx);
    case "sipp.biaya":
      return buildFeeQuery(ctx);
    case "sipp.satker.config":
      return buildSatkerConfigQuery(ctx);
    default:
      return definition.sqlPreview;
  }
}

function formatSqlPreviewForReview(sqlPreview: string | null) {
  return sqlPreview?.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "#$1#") ?? null;
}

function stripSqlQuotedStrings(sql: string) {
  return sql
    .replace(/'(?:''|\\'|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, "\"\"");
}

function hasSemicolonOutsideQuotedString(sql: string) {
  let quote: "'" | "\"" | "" = "";
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      if (char === "\\" && next) {
        index += 1;
        continue;
      }
      if (char === quote) {
        if (next === quote) {
          index += 1;
          continue;
        }
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (char === ";") return true;
  }
  return false;
}

export function validateJlfSelectOnlySql(sqlPreview: string | null | undefined) {
  const sql = (sqlPreview ?? "").trim();
  if (!sql) return { selectOnly: true, blockedReason: null };
  if (!SELECT_SQL_PATTERN.test(sql)) {
    return { selectOnly: false, blockedReason: "Preview SQL harus diawali SELECT atau WITH." };
  }
  const sqlWithoutTrailingTerminator = sql.replace(/;\s*$/, "");
  const scanText = stripSqlQuotedStrings(sqlWithoutTrailingTerminator);
  if (WRITE_SQL_PATTERN.test(scanText)) {
    return { selectOnly: false, blockedReason: "Preview SQL mengandung kata kerja modifikasi data/struktur." };
  }
  if (hasSemicolonOutsideQuotedString(sqlWithoutTrailingTerminator)) {
    return { selectOnly: false, blockedReason: "Preview SQL hanya boleh satu statement read-only." };
  }
  return { selectOnly: true, blockedReason: null };
}

function isSippSource(sourceType: string) {
  return sourceType.startsWith("sipp_");
}

function getDefinition(queryKey: string) {
  return SIPP_QUERY_PREVIEWS[queryKey] ?? null;
}

function toPreview(definition: QueryPreviewDefinition, outputPath: string, input?: QueryPreviewInput): JlfVariableQueryPreview {
  const sqlPreview = formatSqlPreviewForReview(buildDynamicSqlPreview(definition, input));
  const safety = validateJlfSelectOnlySql(sqlPreview);
  return {
    status: "registered",
    queryKey: definition.queryKey,
    title: definition.title,
    description: definition.description,
    sqlPreview,
    outputPath: outputPath || definition.defaultOutputPath,
    allowedParams: definition.allowedParams,
    readOnly: definition.readOnly && safety.selectOnly,
    selectOnly: safety.selectOnly,
    blockedReason: safety.blockedReason,
    safetyNotes: safety.blockedReason ? [...definition.safetyNotes, safety.blockedReason] : definition.safetyNotes,
  };
}

function detectQueryKey(sourceType: string, sourceKey: string, key = "", adminNote = "") {
  const normalizedSourceKey = sourceKey.trim().toLowerCase();
  if (getDefinition(normalizedSourceKey)) return normalizedSourceKey;

  const haystack = `${sourceType} ${sourceKey} ${key} ${adminNote}`.toLowerCase();
  if (haystack.includes("saksi") || haystack.includes("perkara_pihak5")) return "sipp.saksi.list";
  if (haystack.includes("satker") || haystack.includes("sys_config") || haystack.includes("namapn")) return "sipp.satker.config";

  for (const definition of Object.values(SIPP_QUERY_PREVIEWS)) {
    if (haystack.includes(definition.queryKey)) return definition.queryKey;
  }

  if (sourceType === "sipp_hakim") return "sipp.hakim.majelis";
  if (sourceType === "sipp_panitera") return "sipp.panitera.pengganti";
  if (sourceType === "sipp_jurusita") return "sipp.jurusita";
  if (sourceType === "sipp_putusan") return "sipp.putusan";
  if (sourceType === "sipp_keuangan") return "sipp.biaya";

  if (sourceType === "sipp_jadwal_sidang") {
    if (haystack.includes("terakhir") || haystack.includes("last")) return "sipp.sidang.last";
    if (haystack.includes("berikut") || haystack.includes("next")) return "sipp.sidang.next";
    if (haystack.includes("terpilih") || haystack.includes("selected") || haystack.includes("sidang_id")) return "sipp.sidang.by_id";
    return "sipp.sidang.list";
  }

  if (sourceType === "sipp_pihak") {
    if (haystack.includes("penggugat") || haystack.includes("pemohon")) return "sipp.pihak.penggugat";
    if (haystack.includes("tergugat") || haystack.includes("termohon")) return "sipp.pihak.tergugat";
    return "sipp.pihak.list";
  }

  if (sourceType === "sipp_perkara") {
    if (haystack.includes("search") || haystack.includes("cari")) return "sipp.perkara.search";
    if (haystack.includes("mediator") || haystack.includes("mediasi")) return "sipp.mediator";
    if (haystack.includes("putusan") || haystack.includes("penetapan") || haystack.includes("minutasi")) return "sipp.putusan";
    return "sipp.perkara.by_nomor";
  }

  for (const definition of Object.values(SIPP_QUERY_PREVIEWS)) {
    if (definition.keywords.some((keyword) => haystack.includes(keyword))) return definition.queryKey;
  }
  return null;
}

function notSippPreview(sourceType: string, sourceKey: string): JlfVariableQueryPreview {
  const labels: Record<string, string> = {
    jlf_manual: "Data manual JLF",
    jlf_temp: "Data sementara JLF",
    jlf_bas_qa: "Template Tanya Jawab/BAS",
    function: "Function resolver",
    qrcode: "QR code resolver",
    ai: "AI draft resolver",
    static: "Nilai statis",
    computed: "Computed resolver",
    abt_sql: "Query SQL ABT tersimpan",
  };

  return {
    status: "not_sipp",
    queryKey: null,
    title: labels[sourceType] ?? "Resolver non-SIPP",
    description: "Variabel ini tidak mengambil data langsung dari database SIPP.",
    sqlPreview: null,
    outputPath: sourceKey || "-",
    allowedParams: [],
    readOnly: true,
    selectOnly: true,
    blockedReason: null,
    safetyNotes: ["Tidak ada SQL SIPP untuk source type ini.", "Nilai tetap melewati resolver JLF dan audit sesuai aksi pengguna."],
  };
}

export function resolveJlfVariableQueryPreview(input: QueryPreviewInput): JlfVariableQueryPreview {
  const sourceType = (input.sourceType || "").trim().toLowerCase();
  const sourceKey = (input.sourceKey || "").trim();
  if (!isSippSource(sourceType)) return notSippPreview(sourceType, sourceKey);

  const queryKey = detectQueryKey(sourceType, sourceKey, input.key ?? "", input.adminNote ?? "");
  const definition = queryKey ? getDefinition(queryKey) : null;
  if (!definition) {
    return {
      status: "needs_review",
      queryKey: null,
      title: "Query SIPP belum terdaftar",
      description: "Source SIPP ini belum punya query registry yang jelas. Tambahkan query key terdaftar sebelum dipakai production.",
      sqlPreview: null,
      outputPath: sourceKey || "-",
      allowedParams: [],
      readOnly: true,
      selectOnly: false,
      blockedReason: "Query SIPP belum terdaftar.",
      safetyNotes: ["Jangan memakai raw SQL dari ABT/client.", "Tandai variabel sebagai needs_review sampai adapter aman tersedia."],
    };
  }

  return toPreview(definition, sourceKey || definition.defaultOutputPath, input);
}

export function listJlfSippQueryPreviewDefinitions() {
  return Object.values(SIPP_QUERY_PREVIEWS).map((definition) => toPreview(definition, definition.defaultOutputPath));
}
