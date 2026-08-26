import type { AletaBotQuery, AletaBotQueryCategory } from "@/lib/aleta-bot-types";

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

type QueryDraft = {
  id: string;
  name: string;
  category?: AletaBotQueryCategory;
  description: string;
  sqlText: string;
  outputColumns?: string[];
  recipientColumn?: string;
  isActive?: boolean;
};

const EMPLOYEE_OUTPUT_COLUMNS = [
  "target_unit",
  "nama_pegawai",
  "judul_notifikasi",
  "ringkasan",
  "jumlah",
  "nomor_perkara",
  "waktu",
];

const PARTY_OUTPUT_COLUMNS = [
  "nama_pihak",
  "nomor_perkara",
  "judul_notifikasi",
  "ringkasan",
  "telepon",
  "nomor_hp",
  "waktu",
];

const activeCaseFilter =
  "COALESCE(p.tahapan_terakhir_text, '') NOT LIKE '%Putus%' AND COALESCE(p.tahapan_terakhir_text, '') NOT LIKE '%Cabut%' AND COALESCE(p.tahapan_terakhir_text, '') NOT LIKE '%Coret%'";

const partyRelationSql = `
  SELECT perkara_id, pihak_id, nama FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak4
`;

function source(draft: QueryDraft): SeedQuery {
  const category = draft.category ?? "employee";
  return {
    id: draft.id,
    name: draft.name,
    category,
    description: draft.description,
    sqlText: draft.sqlText.trim(),
    outputColumns: draft.outputColumns ?? (category === "party" ? PARTY_OUTPUT_COLUMNS : EMPLOYEE_OUTPUT_COLUMNS),
    recipientColumn: draft.recipientColumn ?? (category === "party" ? "telepon" : ""),
    isActive: draft.isActive ?? false,
  };
}

export const SIPP_ADDITIONAL_QUERY_DEFINITIONS: SeedQuery[] = [
  source({
    id: "sipp-extra-pihak-perkara-aktif-ganda",
    name: "Pihak - Terhubung ke Beberapa Perkara Aktif",
    description:
      "Mendeteksi pihak yang tercatat pada lebih dari satu perkara yang belum selesai. Berguna untuk validasi target notifikasi dan pemetaan pihak.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  rel.nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COUNT(DISTINCT rel.perkara_id) AS jumlah,
  GROUP_CONCAT(DISTINCT p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  CONCAT(rel.nama_pihak, ' tercatat pada ', COUNT(DISTINCT rel.perkara_id), ' perkara yang belum selesai.') AS ringkasan,
  MAX(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal)) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE rel.pihak_id IS NOT NULL
  AND ${activeCaseFilter}
GROUP BY rel.pihak_id, rel.nama_pihak, ph.telepon
HAVING COUNT(DISTINCT rel.perkara_id) > 1
ORDER BY jumlah DESC, rel.nama_pihak
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-kuasa-banyak-perkara-aktif",
    name: "Kuasa Hukum - Banyak Perkara Aktif",
    description:
      "Mendeteksi kuasa hukum yang memegang banyak perkara aktif agar kepaniteraan dapat memeriksa beban perkara dan konsistensi nomor kontak.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  pg.nama AS nama_pegawai,
  'Kuasa hukum banyak perkara aktif' AS judul_notifikasi,
  COUNT(DISTINCT pg.perkara_id) AS jumlah,
  GROUP_CONCAT(DISTINCT p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  CONCAT(pg.nama, ' tercatat sebagai kuasa aktif pada ', COUNT(DISTINCT pg.perkara_id), ' perkara.') AS ringkasan,
  MAX(COALESCE(pg.diperbaharui_tanggal, pg.diinput_tanggal)) AS waktu
FROM perkara_pengacara pg
JOIN perkara p ON p.perkara_id = pg.perkara_id
WHERE COALESCE(pg.aktif, 'Y') = 'Y'
  AND ${activeCaseFilter}
GROUP BY pg.pengacara_id, pg.nama
HAVING COUNT(DISTINCT pg.perkara_id) >= 5
ORDER BY jumlah DESC, pg.nama
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-nomor-wa-dipakai-banyak-pihak",
    name: "Pihak - Nomor WhatsApp Dipakai Banyak Orang",
    description:
      "Mendeteksi nomor telepon yang dipakai oleh beberapa pihak agar notifikasi WhatsApp tidak salah penerima.",
    sqlText: `
SELECT
  'PTSP / Kepaniteraan' AS target_unit,
  TRIM(telepon) AS nomor_hp,
  COUNT(*) AS jumlah,
  GROUP_CONCAT(nama ORDER BY nama SEPARATOR ', ') AS nama_pihak,
  CONCAT('Nomor ', TRIM(telepon), ' dipakai oleh ', COUNT(*), ' data pihak: ', GROUP_CONCAT(nama ORDER BY nama SEPARATOR ', ')) AS ringkasan,
  MAX(COALESCE(diperbaharui_tanggal, diinput_tanggal)) AS waktu
FROM pihak
WHERE TRIM(COALESCE(telepon, '')) REGEXP '[0-9]{8,}'
GROUP BY TRIM(telepon)
HAVING COUNT(*) > 1
ORDER BY jumlah DESC, nomor_hp
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-email-dipakai-banyak-pihak",
    name: "Pihak - Email Dipakai Banyak Orang",
    description:
      "Mendeteksi email yang dipakai lebih dari satu pihak sebagai bahan validasi data layanan elektronik.",
    sqlText: `
SELECT
  'PTSP / Kepaniteraan' AS target_unit,
  LOWER(TRIM(email)) AS email,
  COUNT(*) AS jumlah,
  GROUP_CONCAT(nama ORDER BY nama SEPARATOR ', ') AS nama_pihak,
  CONCAT('Email ', LOWER(TRIM(email)), ' dipakai oleh ', COUNT(*), ' data pihak.') AS ringkasan,
  MAX(COALESCE(diperbaharui_tanggal, diinput_tanggal)) AS waktu
FROM pihak
WHERE TRIM(COALESCE(email, '')) LIKE '%@%'
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
ORDER BY jumlah DESC, email
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-ecourt-pihak-belum-terverifikasi",
    name: "e-Court - Pemetaan Pihak Belum Terverifikasi",
    description:
      "Mendeteksi pihak e-Court yang belum terverifikasi atau belum cocok dengan data pihak SIPP.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  COALESCE(ph.nama, CONCAT('SIPP pihak ID ', ep.sipp_pihak_id)) AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  ep.efiling_id AS nomor_perkara,
  ep.verifikasi_pihak AS jumlah,
  CONCAT('Pemetaan pihak e-Court efiling ', ep.efiling_id, ' belum terverifikasi atau tidak ditemukan di data pihak SIPP.') AS ringkasan,
  NULL AS waktu
FROM ecourt_pihak ep
LEFT JOIN pihak ph ON ph.id = ep.sipp_pihak_id
WHERE ep.verifikasi_pihak = 0 OR ph.id IS NULL
ORDER BY ep.efiling_id DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-ecourt-pendaftaran-tanpa-pihak",
    name: "e-Court - Pendaftaran Belum Punya Pihak Terverifikasi",
    description:
      "Mendeteksi antrian pendaftaran e-Court yang belum memiliki pihak terverifikasi pada tabel e-Court SIPP.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  eap.efiling_id AS nomor_perkara,
  eap.pendaftaran_id,
  eap.status_antrian,
  COUNT(ep.ecourt_pihak_id) AS jumlah,
  CONCAT('Antrian pendaftaran e-Court ', eap.efiling_id, ' belum memiliki pihak terverifikasi.') AS ringkasan,
  MAX(COALESCE(eap.diperbaharui_tanggal, eap.diinput_tanggal)) AS waktu
FROM ecourt_antrian_pendaftaran eap
LEFT JOIN ecourt_pihak ep ON ep.efiling_id = eap.efiling_id AND ep.verifikasi_pihak = 1
GROUP BY eap.efiling_id, eap.pendaftaran_id, eap.status_antrian
HAVING COUNT(ep.ecourt_pihak_id) = 0
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-ganda-dalam-satu-perkara",
    name: "Pihak - Duplikat Dalam Satu Perkara",
    description:
      "Mendeteksi pihak yang tercatat lebih dari sekali dalam perkara yang sama, termasuk penggugat, tergugat, turut, dan intervensi.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  rel.nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  COUNT(*) AS jumlah,
  CONCAT(rel.nama_pihak, ' muncul ', COUNT(*), ' kali pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  MAX(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal)) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE rel.pihak_id IS NOT NULL
GROUP BY rel.perkara_id, rel.pihak_id, rel.nama_pihak, ph.telepon, p.nomor_perkara
HAVING COUNT(*) > 1
ORDER BY jumlah DESC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-kuasa-tanpa-pihak-diwakili",
    name: "Kuasa Hukum - Pihak yang Diwakili Belum Cocok",
    description:
      "Mendeteksi kuasa aktif yang belum memiliki rujukan pihak yang diwakili atau rujukannya tidak ditemukan.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  pg.nama AS nama_pegawai,
  p.nomor_perkara,
  pg.pihak_id,
  pg.pihak_ke,
  1 AS jumlah,
  CONCAT('Kuasa ', pg.nama, ' pada perkara ', p.nomor_perkara, ' belum memiliki rujukan pihak yang valid.') AS ringkasan,
  COALESCE(pg.diperbaharui_tanggal, pg.diinput_tanggal) AS waktu
FROM perkara_pengacara pg
JOIN perkara p ON p.perkara_id = pg.perkara_id
LEFT JOIN pihak ph ON ph.id = pg.pihak_id
WHERE COALESCE(pg.aktif, 'Y') = 'Y'
  AND (pg.pihak_id IS NULL OR pg.pihak_id = 0 OR ph.id IS NULL)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-intervensi-baru-minggu-ini",
    name: "Pihak - Intervensi Baru Minggu Ini",
    category: "party",
    description:
      "Daftar pihak intervensi baru dalam tujuh hari terakhir untuk pemberitahuan awal atau validasi nomor WhatsApp.",
    sqlText: `
SELECT
  pp3.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Pihak intervensi baru' AS judul_notifikasi,
  CONCAT('Bapak/Ibu tercatat sebagai pihak intervensi pada perkara ', p.nomor_perkara, '. Petugas dapat menghubungi untuk validasi data.') AS ringkasan,
  COALESCE(pp3.diperbaharui_tanggal, pp3.diinput_tanggal, p.diinput_tanggal) AS waktu
FROM perkara_pihak3 pp3
JOIN perkara p ON p.perkara_id = pp3.perkara_id
LEFT JOIN pihak ph ON ph.id = pp3.pihak_id
WHERE DATE(COALESCE(pp3.diinput_tanggal, p.diinput_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-turut-tergugat-baru-minggu-ini",
    name: "Pihak - Turut Tergugat Baru Minggu Ini",
    category: "party",
    description:
      "Daftar turut tergugat baru dalam tujuh hari terakhir untuk pemberitahuan awal atau validasi nomor WhatsApp.",
    sqlText: `
SELECT
  pp4.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Turut tergugat baru' AS judul_notifikasi,
  CONCAT('Bapak/Ibu tercatat sebagai turut tergugat pada perkara ', p.nomor_perkara, '. Petugas dapat menghubungi untuk validasi data.') AS ringkasan,
  COALESCE(pp4.diperbaharui_tanggal, pp4.diinput_tanggal, p.diinput_tanggal) AS waktu
FROM perkara_pihak4 pp4
JOIN perkara p ON p.perkara_id = pp4.perkara_id
LEFT JOIN pihak ph ON ph.id = pp4.pihak_id
WHERE DATE(COALESCE(pp4.diinput_tanggal, p.diinput_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-kuasa-baru-minggu-ini",
    name: "Kuasa Hukum - Baru Minggu Ini",
    category: "party",
    description:
      "Daftar kuasa hukum baru dalam tujuh hari terakhir untuk validasi kontak dan pemberitahuan awal.",
    sqlText: `
SELECT
  pg.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Kuasa hukum baru' AS judul_notifikasi,
  CONCAT(pg.nama, ' tercatat sebagai kuasa hukum baru pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  COALESCE(pg.diperbaharui_tanggal, pg.diinput_tanggal) AS waktu
FROM perkara_pengacara pg
JOIN perkara p ON p.perkara_id = pg.perkara_id
LEFT JOIN pihak ph ON ph.id = pg.pengacara_id
WHERE COALESCE(pg.aktif, 'Y') = 'Y'
  AND DATE(COALESCE(pg.diinput_tanggal, p.diinput_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-verzet-baru-perlu-pemetaan-pihak",
    name: "Verzet - Perlu Pemetaan Pihak",
    description:
      "Mendeteksi perkara verzet baru agar majelis dan kepaniteraan dapat memeriksa pemetaan pihak serta jadwal awal.",
    sqlText: `
SELECT
  'Majelis / Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  'Verzet baru perlu pemetaan pihak' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara verzet ', p.nomor_perkara, ' perlu pemeriksaan pemetaan pihak dan jadwal awal.') AS ringkasan,
  COALESCE(v.diperbaharui_tanggal, v.diinput_tanggal, v.tanggal_pendaftaran_verzet) AS waktu
FROM perkara_verzet v
JOIN perkara p ON p.perkara_id = v.perkara_id
WHERE COALESCE(v.tanggal_pendaftaran_verzet, DATE(v.diinput_tanggal), p.tanggal_pendaftaran) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-rekonvensi-aktif-perlu-pemetaan",
    name: "Rekonvensi - Perlu Pemetaan Pihak",
    description:
      "Mendeteksi perkara rekonvensi baru/aktif agar kepaniteraan dapat memeriksa para pihak dan isi petitum rekonvensi.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  'Rekonvensi perlu pemetaan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki rekonvensi. Periksa pemetaan pihak dan isi petitum.') AS ringkasan,
  COALESCE(r.diperbaharui_tanggal, r.diinput_tanggal, r.tanggal_pendaftaran) AS waktu
FROM perkara_rekonvensi r
JOIN perkara p ON p.perkara_id = r.perkara_id
WHERE ${activeCaseFilter}
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pemohon-eksekusi-baru",
    name: "Eksekusi - Pemohon Baru",
    category: "party",
    description:
      "Daftar pemohon eksekusi baru untuk validasi nomor dan pemberitahuan tindak lanjut administrasi.",
    sqlText: `
SELECT
  COALESCE(ed.pemohon_nama, ed.pihak_nama, ph.nama) AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Pemohon eksekusi baru' AS judul_notifikasi,
  CONCAT('Permohonan eksekusi pada perkara ', p.nomor_perkara, ' sedang diproses administrasi.') AS ringkasan,
  COALESCE(ed.diperbaharui_tanggal, ed.diinput_tanggal, e.diinput_tanggal) AS waktu
FROM perkara_eksekusi_detil ed
JOIN perkara_eksekusi e ON e.id = ed.eksekusi_id
JOIN perkara p ON p.perkara_id = ed.perkara_id
LEFT JOIN pihak ph ON ph.id = COALESCE(NULLIF(ed.pemohon_id, 0), NULLIF(ed.pihak_id, 0))
WHERE DATE(COALESCE(ed.diinput_tanggal, e.diinput_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-eksekusi-teguran-belum-dilaksanakan",
    name: "Eksekusi - Teguran Belum Dilaksanakan",
    description:
      "Mendeteksi eksekusi yang sudah ada penetapan teguran tetapi pelaksanaan teguran belum terisi.",
    sqlText: `
SELECT
  'Jurusita / Kepaniteraan' AS target_unit,
  e.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Teguran eksekusi belum dilaksanakan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Eksekusi perkara ', p.nomor_perkara, ' sudah ada penetapan teguran tetapi pelaksanaannya belum tercatat.') AS ringkasan,
  COALESCE(e.diperbaharui_tanggal, e.diinput_tanggal, e.penetapan_teguran_eksekusi) AS waktu
FROM perkara_eksekusi e
JOIN perkara p ON p.perkara_id = e.perkara_id
WHERE e.penetapan_teguran_eksekusi IS NOT NULL
  AND e.pelaksanaan_teguran_eksekusi IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-eksekusi-lelang-belum-dilaksanakan",
    name: "Eksekusi - Lelang Belum Dilaksanakan",
    description:
      "Mendeteksi eksekusi lelang yang sudah ada perintah tetapi pelaksanaan belum terisi.",
    sqlText: `
SELECT
  'Jurusita / Kepaniteraan' AS target_unit,
  e.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Eksekusi lelang belum dilaksanakan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Eksekusi lelang perkara ', p.nomor_perkara, ' sudah diperintahkan tetapi belum ada tanggal pelaksanaan.') AS ringkasan,
  COALESCE(e.diperbaharui_tanggal, e.diinput_tanggal, e.penetapan_perintah_eksekusi_lelang) AS waktu
FROM perkara_eksekusi e
JOIN perkara p ON p.perkara_id = e.perkara_id
WHERE e.penetapan_perintah_eksekusi_lelang IS NOT NULL
  AND e.pelaksanaan_eksekusi_lelang IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-eksekusi-riil-belum-dilaksanakan",
    name: "Eksekusi - Riil Belum Dilaksanakan",
    description:
      "Mendeteksi eksekusi riil yang sudah ada perintah tetapi pelaksanaan belum terisi.",
    sqlText: `
SELECT
  'Jurusita / Kepaniteraan' AS target_unit,
  e.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Eksekusi riil belum dilaksanakan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Eksekusi riil perkara ', p.nomor_perkara, ' sudah diperintahkan tetapi belum ada tanggal pelaksanaan.') AS ringkasan,
  COALESCE(e.diperbaharui_tanggal, e.diinput_tanggal, e.penetapan_perintah_eksekusi_rill) AS waktu
FROM perkara_eksekusi e
JOIN perkara p ON p.perkara_id = e.perkara_id
WHERE e.penetapan_perintah_eksekusi_rill IS NOT NULL
  AND e.pelaksanaan_eksekusi_rill IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-ikrar-talak-belum-dijadwalkan",
    name: "Ikrar Talak - Belum Dijadwalkan",
    description:
      "Mendeteksi perkara ikrar talak yang sudah masuk data ikrar tetapi jadwal/penetapan sidang ikrar belum lengkap.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  'Ikrar talak belum dijadwalkan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki data ikrar talak tetapi jadwal sidang ikrar belum lengkap.') AS ringkasan,
  COALESCE(it.diperbaharui_tanggal, it.diinput_tanggal, p.diperbaharui_tanggal) AS waktu
FROM perkara_ikrar_talak it
JOIN perkara p ON p.perkara_id = it.perkara_id
WHERE it.tgl_ikrar_talak IS NULL
  AND (it.tanggal_penetapan_sidang_ikrar IS NULL OR it.tanggal_sidang_pertama IS NULL)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-ikrar-talak-belum-dicatat-hasil",
    name: "Ikrar Talak - Hasil Belum Dicatat",
    description:
      "Mendeteksi jadwal ikrar talak yang sudah lewat tetapi hasil/tanggal ikrar belum tercatat.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  'Hasil ikrar talak belum dicatat' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Sidang ikrar talak perkara ', p.nomor_perkara, ' sudah terjadwal/lewat tetapi hasilnya belum tercatat.') AS ringkasan,
  COALESCE(it.tanggal_sidang_pertama, it.diperbaharui_tanggal, it.diinput_tanggal) AS waktu
FROM perkara_ikrar_talak it
JOIN perkara p ON p.perkara_id = it.perkara_id
WHERE it.tanggal_sidang_pertama IS NOT NULL
  AND it.tanggal_sidang_pertama < CURDATE()
  AND it.tgl_ikrar_talak IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-permohonan-cabut-ecourt-baru",
    name: "e-Court - Permohonan Cabut Baru",
    description:
      "Mendeteksi antrian cabut e-Court baru agar admin e-Court dapat menindaklanjuti lebih cepat.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  ac.efiling_id AS nomor_perkara,
  ac.tahapan_id,
  ac.status_antrian,
  'Permohonan cabut e-Court baru' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Ada permohonan cabut e-Court pada efiling ', ac.efiling_id, ' dengan status antrian ', ac.status_antrian, '.') AS ringkasan,
  COALESCE(ac.diperbaharui_tanggal, ac.diinput_tanggal) AS waktu
FROM ecourt_antrian_cabut ac
WHERE DATE(COALESCE(ac.diinput_tanggal, ac.diperbaharui_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-data-pernikahan-perceraian-kosong",
    name: "Perceraian - Data Pernikahan Belum Lengkap",
    description:
      "Mendeteksi perkara cerai yang data pernikahan/KUA belum lengkap sebagai bahan koordinasi kepaniteraan dan layanan akta cerai.",
    sqlText: `
SELECT
  'Kepaniteraan / KUA' AS target_unit,
  p.nomor_perkara,
  'Data pernikahan belum lengkap' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' belum memiliki data pernikahan/KUA yang lengkap.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
LEFT JOIN perkara_data_pernikahan dp ON dp.perkara_id = p.perkara_id
WHERE (p.jenis_perkara_nama LIKE '%Cerai%' OR p.jenis_perkara_nama LIKE '%Talak%')
  AND (
    dp.perkara_id IS NULL
    OR dp.tgl_nikah IS NULL
    OR dp.tgl_nikah = '0000-00-00'
    OR TRIM(COALESCE(dp.no_kutipan_akta_nikah, '')) = ''
    OR TRIM(COALESCE(dp.kua_tempat_nikah, '')) = ''
  )
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-data-anak-pihak-belum-lengkap",
    name: "Pihak - Data Anak Belum Lengkap",
    description:
      "Mendeteksi data anak pihak yang masih kosong pada NIK, tanggal lahir, pengasuhan, atau nafkah.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  ap.nama_anak AS nama_pihak,
  'Data anak pihak belum lengkap' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Data anak ', ap.nama_anak, ' pada perkara ', p.nomor_perkara, ' belum lengkap.') AS ringkasan,
  COALESCE(ap.diperbaharui_tanggal, ap.diinput_tanggal) AS waktu
FROM perkara_anak_pihak ap
JOIN perkara p ON p.perkara_id = ap.perkara_id
WHERE TRIM(COALESCE(ap.nama_anak, '')) = ''
   OR TRIM(COALESCE(ap.nik, '')) = ''
   OR ap.tanggal_lahir IS NULL
   OR TRIM(COALESCE(ap.diasuh_oleh, '')) = ''
   OR ap.jumlah_nafkah IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-korban-anak-baru",
    name: "Pihak - Korban Anak Baru",
    description:
      "Mendeteksi data korban anak baru agar penanganan perkara dan perlindungan data dapat dipantau oleh petugas berwenang.",
    sqlText: `
SELECT
  'Kepaniteraan / Perlindungan Anak' AS target_unit,
  p.nomor_perkara,
  pk.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  'Korban anak baru' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki data korban anak baru yang perlu perhatian petugas.') AS ringkasan,
  COALESCE(pk.diperbaharui_tanggal, pk.diinput_tanggal) AS waktu
FROM perkara_pihak_korban pk
JOIN perkara p ON p.perkara_id = pk.perkara_id
LEFT JOIN pihak ph ON ph.id = pk.pihak_id
WHERE (pk.dewasa = 0 OR pk.umur < 18)
  AND DATE(COALESCE(pk.diinput_tanggal, p.diinput_tanggal)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-konsinyasi-pihak-perlu-konfirmasi",
    name: "Konsinyasi - Pihak Perlu Konfirmasi",
    description:
      "Mendeteksi penawaran konsinyasi yang belum dilaksanakan atau hasilnya belum lengkap.",
    sqlText: `
SELECT
  'Kepaniteraan / Jurusita' AS target_unit,
  p.nomor_perkara,
  k.nama_jurusita AS nama_pegawai,
  'Konsinyasi perlu konfirmasi' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Penawaran konsinyasi perkara ', p.nomor_perkara, ' perlu konfirmasi hasil/pelaksanaan.') AS ringkasan,
  COALESCE(k.tgl_pelaksanaan_penawaran, k.tanggal_penawaran, k.diinput_tanggal) AS waktu
FROM perkara_penawaran_konsinyasi k
JOIN perkara p ON p.perkara_id = k.perkara_id
WHERE COALESCE(k.is_dilaksanakan, 0) = 0
   OR TRIM(COALESCE(k.hasil_penawaran, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-wakaf-pihak-perlu-validasi",
    name: "Wakaf - Objek atau Pihak Perlu Validasi",
    description:
      "Mendeteksi perkara wakaf yang objek/nama wakafnya belum lengkap untuk validasi data layanan.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  w.nama AS nama_pihak,
  'Data wakaf perlu validasi' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara wakaf ', p.nomor_perkara, ' perlu validasi objek atau nama wakaf.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara_wakaf w
JOIN perkara p ON p.perkara_id = w.perkara_id
WHERE w.objek_wakaf_id IS NULL OR TRIM(COALESCE(w.nama, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-bentrok-ruangan-sidang",
    name: "Jadwal Sidang - Bentrok Ruangan",
    description:
      "Mendeteksi jadwal sidang yang memakai ruangan dan jam yang sama untuk lebih dari satu perkara.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  s.ruangan,
  s.tanggal_sidang AS waktu,
  s.jam_sidang,
  COUNT(*) AS jumlah,
  GROUP_CONCAT(p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  CONCAT('Ruangan ', s.ruangan, ' pada ', s.tanggal_sidang, ' jam ', COALESCE(s.jam_sidang, '-'), ' dipakai ', COUNT(*), ' jadwal.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang >= CURDATE()
  AND TRIM(COALESCE(s.ruangan, '')) <> ''
GROUP BY s.tanggal_sidang, s.jam_sidang, s.ruangan
HAVING COUNT(*) > 1
ORDER BY waktu ASC, s.jam_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-jadwal-sidang-tanpa-jam",
    name: "Jadwal Sidang - Jam Belum Diisi",
    description:
      "Mendeteksi jadwal sidang mendatang yang belum memiliki jam sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  p.nomor_perkara,
  s.tanggal_sidang AS waktu,
  s.agenda,
  'Jam sidang belum diisi' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' tanggal ', s.tanggal_sidang, ' belum memiliki jam sidang.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang >= CURDATE()
  AND (s.jam_sidang IS NULL OR TRIM(CAST(s.jam_sidang AS CHAR)) = '' OR CAST(s.jam_sidang AS CHAR) = '00:00:00')
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-jadwal-sidang-tanpa-ruangan",
    name: "Jadwal Sidang - Ruangan Belum Diisi",
    description:
      "Mendeteksi jadwal sidang mendatang yang belum memiliki ruangan sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  p.nomor_perkara,
  s.tanggal_sidang AS waktu,
  s.jam_sidang,
  s.agenda,
  'Ruangan sidang belum diisi' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' tanggal ', s.tanggal_sidang, ' belum memiliki ruangan.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang >= CURDATE()
  AND TRIM(COALESCE(s.ruangan, '')) = ''
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-agenda-sidang-terlalu-pendek",
    name: "Jadwal Sidang - Agenda Terlalu Singkat",
    description:
      "Mendeteksi agenda sidang yang terlalu pendek/kosong sehingga notifikasi ke pihak berpotensi tidak jelas.",
    sqlText: `
SELECT
  'Penjaga Sidang / Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  s.tanggal_sidang AS waktu,
  s.agenda,
  'Agenda sidang terlalu singkat' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Agenda sidang perkara ', p.nomor_perkara, ' masih terlalu singkat atau kosong.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang >= CURDATE()
  AND CHAR_LENGTH(TRIM(COALESCE(s.agenda, ''))) < 5
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-jadwal-diubah-mendadak",
    name: "Jadwal Sidang - Diubah Mendadak",
    description:
      "Mendeteksi jadwal sidang dekat yang berubah dalam 24 jam terakhir agar petugas dapat memastikan notifikasi pihak.",
    sqlText: `
SELECT
  'Penjaga Sidang / Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  s.tanggal_sidang AS waktu,
  s.jam_sidang,
  s.ruangan,
  'Jadwal sidang berubah mendadak' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' berubah mendadak untuk tanggal ', s.tanggal_sidang, '.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
  AND COALESCE(s.diperbaharui_tanggal, s.diinput_tanggal) >= DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY s.tanggal_sidang ASC, s.jam_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-perkara-aktif-tanpa-update-14-hari",
    name: "Perkara Aktif - Tidak Ada Update 14 Hari",
    description:
      "Mendeteksi perkara aktif yang belum diperbarui lebih dari 14 hari sebagai pengingat kontrol perkara.",
    sqlText: `
SELECT
  'Kepaniteraan / Majelis' AS target_unit,
  p.nomor_perkara,
  p.tahapan_terakhir_text,
  'Perkara aktif tanpa update 14 hari' AS judul_notifikasi,
  DATEDIFF(CURDATE(), DATE(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran))) AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' belum diperbarui selama ', DATEDIFF(CURDATE(), DATE(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran))), ' hari.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran) AS waktu
FROM perkara p
WHERE ${activeCaseFilter}
  AND DATE(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran)) < DATE_SUB(CURDATE(), INTERVAL 14 DAY)
ORDER BY waktu ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-perkara-tanpa-tahapan-terakhir",
    name: "Perkara - Tahapan Terakhir Kosong",
    description:
      "Mendeteksi perkara yang tahapan/proses terakhirnya kosong agar data monitoring perkara lebih rapi.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  'Tahapan/proses terakhir kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' belum memiliki tahapan atau proses terakhir yang jelas.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran) AS waktu
FROM perkara p
WHERE TRIM(COALESCE(p.tahapan_terakhir_text, '')) = ''
   OR TRIM(COALESCE(p.proses_terakhir_text, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-jadwal-detil-sidang-kosong",
    name: "Jadwal Sidang - Detail Agenda Kosong",
    description:
      "Mendeteksi jadwal sidang yang belum memiliki detail agenda pada tabel detail sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang / Kepaniteraan' AS target_unit,
  p.nomor_perkara,
  s.tanggal_sidang AS waktu,
  s.agenda,
  'Detail agenda sidang kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' belum memiliki detail agenda sidang.') AS ringkasan
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_jadwal_sidang_detil sd ON sd.perkara_id = s.perkara_id AND sd.sidang_id = s.id
WHERE s.tanggal_sidang >= CURDATE()
  AND sd.sidang_id IS NULL
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-transaksi-biaya-tanggal-mundur",
    name: "Keuangan - Transaksi Sebelum Tanggal Daftar",
    description:
      "Mendeteksi transaksi biaya perkara yang tanggalnya lebih awal dari tanggal pendaftaran perkara.",
    sqlText: `
SELECT
  'Kasir' AS target_unit,
  p.nomor_perkara,
  b.tanggal_transaksi AS waktu,
  b.uraian,
  b.jumlah,
  'Tanggal transaksi perlu diperiksa' AS judul_notifikasi,
  CONCAT('Transaksi biaya perkara ', p.nomor_perkara, ' bertanggal sebelum tanggal pendaftaran perkara.') AS ringkasan
FROM perkara_biaya b
JOIN perkara p ON p.perkara_id = b.perkara_id
WHERE b.tanggal_transaksi < p.tanggal_pendaftaran
ORDER BY b.tanggal_transaksi DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-saldo-biaya-negatif",
    name: "Keuangan - Saldo Perkara Negatif",
    description:
      "Mendeteksi perkara yang total transaksi biayanya menjadi negatif berdasarkan penerimaan dan pengeluaran.",
    sqlText: `
SELECT
  'Kasir' AS target_unit,
  p.nomor_perkara,
  SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE -b.jumlah END) AS jumlah,
  'Saldo perkara negatif' AS judul_notifikasi,
  CONCAT('Saldo biaya perkara ', p.nomor_perkara, ' terhitung negatif dan perlu diperiksa.') AS ringkasan,
  MAX(COALESCE(b.diperbaharui_tanggal, b.diinput_tanggal, b.tanggal_transaksi)) AS waktu
FROM perkara_biaya b
JOIN perkara p ON p.perkara_id = b.perkara_id
GROUP BY b.perkara_id, p.nomor_perkara
HAVING SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE -b.jumlah END) < 0
ORDER BY jumlah ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-virtual-account-belum-bayar",
    name: "e-Payment - Virtual Account Belum Dibayar",
    description:
      "Mendeteksi virtual account yang belum dibayar dan sudah melewati masa berlaku.",
    sqlText: `
SELECT
  'Kasir / Admin e-Court' AS target_unit,
  p.nomor_perkara,
  va.customer_name AS nama_pihak,
  va.telepon,
  va.telepon AS nomor_hp,
  va.nominal AS jumlah,
  'Virtual account belum dibayar' AS judul_notifikasi,
  CONCAT('Virtual account perkara ', COALESCE(p.nomor_perkara, va.perkara_id), ' belum dibayar atau sudah lewat masa berlaku.') AS ringkasan,
  COALESCE(va.expired_date, va.created_time) AS waktu
FROM epayment_virtual_account va
LEFT JOIN perkara p ON p.perkara_id = va.perkara_id
WHERE COALESCE(CAST(va.status_bayar AS CHAR), '') NOT IN ('1', 'PAID', 'paid', 'LUNAS', 'lunas')
  AND va.expired_date IS NOT NULL
  AND va.expired_date < NOW()
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-epayment-bayar-tanpa-perkara",
    name: "e-Payment - Pembayaran Tanpa Perkara",
    description:
      "Mendeteksi pembayaran/virtual account yang tidak lagi memiliki relasi perkara di SIPP.",
    sqlText: `
SELECT
  'Kasir / Admin e-Court' AS target_unit,
  va.perkara_id,
  va.customer_name AS nama_pihak,
  va.telepon,
  va.nominal AS jumlah,
  'Pembayaran tanpa perkara' AS judul_notifikasi,
  CONCAT('Virtual account ', va.va_id, ' memiliki perkara_id ', COALESCE(CAST(va.perkara_id AS CHAR), '-'), ' tetapi perkara tidak ditemukan.') AS ringkasan,
  COALESCE(va.created_time, va.expired_date) AS waktu
FROM epayment_virtual_account va
LEFT JOIN perkara p ON p.perkara_id = va.perkara_id
WHERE va.perkara_id IS NOT NULL
  AND p.perkara_id IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-sinkron-ecourt-terlambat",
    name: "e-Court - Sinkronisasi Terlambat",
    description:
      "Mendeteksi jenis data e-Court yang sinkronisasi terakhirnya sudah melewati satu hari.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  COALESCE(rs.jenis_data, CONCAT('Jenis data ', sl.jenis_data_id)) AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Sinkronisasi e-Court untuk ', COALESCE(rs.jenis_data, sl.jenis_data_id), ' terakhir pada ', sl.sink_timestamp, '.') AS ringkasan,
  sl.sink_timestamp AS waktu
FROM ecourt_sink_log sl
LEFT JOIN ecourt_ref_sink rs ON rs.jenis_data_id = sl.jenis_data_id
WHERE sl.sink_timestamp < DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY sl.sink_timestamp ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-antrian-pendaftaran-ecourt-menumpuk",
    name: "e-Court - Antrian Pendaftaran Menumpuk",
    description:
      "Mendeteksi status antrian pendaftaran e-Court yang jumlahnya banyak dan perlu dipantau admin.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  eap.status_antrian,
  COUNT(*) AS jumlah,
  'Antrian pendaftaran e-Court menumpuk' AS judul_notifikasi,
  CONCAT('Ada ', COUNT(*), ' antrian pendaftaran e-Court pada status ', eap.status_antrian, '.') AS ringkasan,
  MAX(COALESCE(eap.diperbaharui_tanggal, eap.diinput_tanggal)) AS waktu
FROM ecourt_antrian_pendaftaran eap
GROUP BY eap.status_antrian
HAVING COUNT(*) >= 20
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-antrian-cabut-ecourt-menumpuk",
    name: "e-Court - Antrian Cabut Menumpuk",
    description:
      "Mendeteksi status antrian cabut e-Court yang jumlahnya banyak dan perlu dipantau admin.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  ac.status_antrian,
  COUNT(*) AS jumlah,
  'Antrian cabut e-Court menumpuk' AS judul_notifikasi,
  CONCAT('Ada ', COUNT(*), ' antrian cabut e-Court pada status ', ac.status_antrian, '.') AS ringkasan,
  MAX(COALESCE(ac.diperbaharui_tanggal, ac.diinput_tanggal)) AS waktu
FROM ecourt_antrian_cabut ac
GROUP BY ac.status_antrian
HAVING COUNT(*) >= 10
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pesan-sipp-belum-terkirim",
    name: "Pesan SIPP - Belum Diterima Tujuan",
    description:
      "Mendeteksi pesan internal SIPP yang belum memiliki tanggal terima pada tujuan.",
    sqlText: `
SELECT
  'Admin SIPP' AS target_unit,
  ps.subjek AS judul_notifikasi,
  COUNT(pt.ke_userid) AS jumlah,
  CONCAT('Pesan SIPP "', ps.subjek, '" belum diterima oleh ', COUNT(pt.ke_userid), ' tujuan.') AS ringkasan,
  ps.tanggal_kirim AS waktu
FROM pesan ps
JOIN pesan_tujuan pt ON pt.pesan_id = ps.id
WHERE pt.tanggal_terima IS NULL
GROUP BY ps.id, ps.subjek, ps.tanggal_kirim
ORDER BY ps.tanggal_kirim DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-arsip-dipinjam-melewati-batas",
    name: "Arsip - Peminjaman Melewati Batas",
    description:
      "Mendeteksi arsip perkara yang dipinjam melewati batas waktu dan belum dikembalikan.",
    sqlText: `
SELECT
  'Arsip / Kepaniteraan' AS target_unit,
  a.nomor_perkara,
  ap.petugas_peminjam AS nama_pegawai,
  'Arsip dipinjam melewati batas' AS judul_notifikasi,
  DATEDIFF(CURDATE(), ap.batas_waktu) AS jumlah,
  CONCAT('Arsip perkara ', a.nomor_perkara, ' dipinjam oleh ', ap.petugas_peminjam, ' dan melewati batas ', ap.batas_waktu, '.') AS ringkasan,
  ap.batas_waktu AS waktu
FROM arsip_pinjam ap
JOIN arsip a ON a.id = ap.arsip_id
WHERE ap.tanggal_kembali IS NULL
  AND ap.batas_waktu IS NOT NULL
  AND ap.batas_waktu < CURDATE()
ORDER BY ap.batas_waktu ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-arsip-tanpa-lokasi",
    name: "Arsip - Lokasi Belum Lengkap",
    description:
      "Mendeteksi arsip perkara yang belum memiliki nomor ruang, lemari, rak, atau berkas.",
    sqlText: `
SELECT
  'Arsip / Kepaniteraan' AS target_unit,
  a.nomor_perkara,
  'Lokasi arsip belum lengkap' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Arsip perkara ', a.nomor_perkara, ' belum memiliki lokasi arsip lengkap.') AS ringkasan,
  COALESCE(a.diperbaharui_tanggal, a.diinput_tanggal, a.tanggal_masuk_arsip) AS waktu
FROM arsip a
WHERE TRIM(COALESCE(a.no_ruang, '')) = ''
   OR TRIM(COALESCE(a.no_lemari, '')) = ''
   OR TRIM(COALESCE(a.no_rak, '')) = ''
   OR TRIM(COALESCE(a.no_berkas, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-user-sipp-online-lama",
    name: "SIPP - User Online Terlalu Lama",
    description:
      "Mendeteksi sesi user SIPP yang terlihat online terlalu lama agar admin dapat memeriksa sesi menggantung.",
    sqlText: `
SELECT
  'Admin SIPP' AS target_unit,
  COALESCE(u.fullname, u.username, suo.userid) AS nama_pegawai,
  suo.host_address,
  TIMESTAMPDIFF(MINUTE, suo.login_time, COALESCE(suo.last_visit, NOW())) AS jumlah,
  'User SIPP online terlalu lama' AS judul_notifikasi,
  CONCAT(COALESCE(u.fullname, u.username, suo.userid), ' terlihat online selama ', TIMESTAMPDIFF(MINUTE, suo.login_time, COALESCE(suo.last_visit, NOW())), ' menit.') AS ringkasan,
  suo.login_time AS waktu
FROM sys_user_online suo
LEFT JOIN sys_users u ON u.userid = suo.userid
WHERE suo.login_time < DATE_SUB(NOW(), INTERVAL 8 HOUR)
ORDER BY suo.login_time ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-tidak-aktif-masih-ditugaskan",
    name: "Penugasan - Pegawai Tidak Aktif Masih Terpasang",
    description:
      "Mendeteksi penugasan aktif yang masih memiliki tanggal tidak aktif pada hakim, panitera, atau jurusita.",
    sqlText: `
SELECT
  tugas.target_unit,
  tugas.nama_pegawai,
  tugas.nomor_perkara,
  tugas.judul_notifikasi,
  1 AS jumlah,
  tugas.ringkasan,
  tugas.waktu
FROM (
  SELECT 'Majelis' AS target_unit, h.hakim_nama AS nama_pegawai, p.nomor_perkara, 'Hakim tidak aktif masih ditugaskan' AS judul_notifikasi, CONCAT('Hakim ', h.hakim_nama, ' masih aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal tidak aktif terisi.') AS ringkasan, h.tanggal_tidak_aktif AS waktu
  FROM perkara_hakim_pn h JOIN perkara p ON p.perkara_id = h.perkara_id
  WHERE h.aktif = 'Y' AND h.tanggal_tidak_aktif IS NOT NULL
  UNION ALL
  SELECT 'Kepaniteraan' AS target_unit, pp.panitera_nama AS nama_pegawai, p.nomor_perkara, 'Panitera tidak aktif masih ditugaskan' AS judul_notifikasi, CONCAT('Panitera ', pp.panitera_nama, ' masih aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal tidak aktif terisi.') AS ringkasan, pp.tanggal_tidak_aktif AS waktu
  FROM perkara_panitera_pn pp JOIN perkara p ON p.perkara_id = pp.perkara_id
  WHERE pp.aktif = 'Y' AND pp.tanggal_tidak_aktif IS NOT NULL
  UNION ALL
  SELECT 'Jurusita' AS target_unit, j.jurusita_nama AS nama_pegawai, p.nomor_perkara, 'Jurusita tidak aktif masih ditugaskan' AS judul_notifikasi, CONCAT('Jurusita ', j.jurusita_nama, ' masih aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal tidak aktif terisi.') AS ringkasan, j.tanggal_tidak_aktif AS waktu
  FROM perkara_jurusita j JOIN perkara p ON p.perkara_id = j.perkara_id
  WHERE j.aktif = 'Y' AND j.tanggal_tidak_aktif IS NOT NULL
) tugas
ORDER BY tugas.waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-penugasan-hakim-ganda-aktif",
    name: "Penugasan - Hakim Ganda Aktif Dalam Perkara",
    description:
      "Mendeteksi hakim yang tercatat lebih dari satu kali sebagai penugasan aktif dalam perkara yang sama.",
    sqlText: `
SELECT
  'Majelis' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  p.nomor_perkara,
  COUNT(*) AS jumlah,
  'Hakim ganda aktif dalam perkara' AS judul_notifikasi,
  CONCAT('Hakim ', h.hakim_nama, ' tercatat ', COUNT(*), ' kali aktif pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  MAX(COALESCE(h.diperbaharui_tanggal, h.diinput_tanggal, h.tanggal_penetapan)) AS waktu
FROM perkara_hakim_pn h
JOIN perkara p ON p.perkara_id = h.perkara_id
WHERE h.aktif = 'Y'
GROUP BY h.perkara_id, h.hakim_id, h.hakim_nama, p.nomor_perkara
HAVING COUNT(*) > 1
ORDER BY jumlah DESC, waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-penugasan-pegawai-nama-kosong",
    name: "Penugasan - Nama Petugas Kosong",
    description:
      "Mendeteksi penugasan hakim, panitera, atau jurusita aktif yang nama petugasnya kosong.",
    sqlText: `
SELECT
  tugas.target_unit,
  tugas.nama_pegawai,
  tugas.nomor_perkara,
  tugas.judul_notifikasi,
  1 AS jumlah,
  tugas.ringkasan,
  tugas.waktu
FROM (
  SELECT 'Majelis' AS target_unit, h.hakim_nama AS nama_pegawai, p.nomor_perkara, 'Nama hakim kosong' AS judul_notifikasi, CONCAT('Penugasan hakim perkara ', p.nomor_perkara, ' belum memiliki nama petugas.') AS ringkasan, COALESCE(h.diperbaharui_tanggal, h.diinput_tanggal) AS waktu
  FROM perkara_hakim_pn h JOIN perkara p ON p.perkara_id = h.perkara_id
  WHERE h.aktif = 'Y' AND TRIM(COALESCE(h.hakim_nama, '')) = ''
  UNION ALL
  SELECT 'Kepaniteraan' AS target_unit, pp.panitera_nama AS nama_pegawai, p.nomor_perkara, 'Nama panitera kosong' AS judul_notifikasi, CONCAT('Penugasan panitera perkara ', p.nomor_perkara, ' belum memiliki nama petugas.') AS ringkasan, COALESCE(pp.diperbaharui_tanggal, pp.diinput_tanggal) AS waktu
  FROM perkara_panitera_pn pp JOIN perkara p ON p.perkara_id = pp.perkara_id
  WHERE pp.aktif = 'Y' AND TRIM(COALESCE(pp.panitera_nama, '')) = ''
  UNION ALL
  SELECT 'Jurusita' AS target_unit, j.jurusita_nama AS nama_pegawai, p.nomor_perkara, 'Nama jurusita kosong' AS judul_notifikasi, CONCAT('Penugasan jurusita perkara ', p.nomor_perkara, ' belum memiliki nama petugas.') AS ringkasan, COALESCE(j.diperbaharui_tanggal, j.diinput_tanggal) AS waktu
  FROM perkara_jurusita j JOIN perkara p ON p.perkara_id = j.perkara_id
  WHERE j.aktif = 'Y' AND TRIM(COALESCE(j.jurusita_nama, '')) = ''
) tugas
ORDER BY tugas.waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-court-calendar-belum-terhubung-jadwal",
    name: "Court Calendar - Belum Cocok Dengan Jadwal Sidang",
    description:
      "Mendeteksi rencana court calendar yang belum cocok dengan jadwal sidang SIPP.",
    sqlText: `
SELECT
  'Majelis / Penjaga Sidang' AS target_unit,
  p.nomor_perkara,
  cc.rencana_tanggal AS waktu,
  cc.rencana_jam,
  cc.rencana_agenda,
  'Court calendar belum cocok dengan jadwal sidang' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Court calendar perkara ', p.nomor_perkara, ' belum ditemukan padanan jadwal sidangnya.') AS ringkasan
FROM perkara_court_calendar cc
JOIN perkara p ON p.perkara_id = cc.perkara_id
LEFT JOIN perkara_jadwal_sidang s ON s.perkara_id = cc.perkara_id
  AND s.tanggal_sidang = cc.rencana_tanggal
  AND (s.jam_sidang = cc.rencana_jam OR cc.rencana_jam IS NULL)
WHERE cc.rencana_tanggal >= CURDATE()
  AND s.id IS NULL
ORDER BY cc.rencana_tanggal ASC, cc.rencana_jam ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pengajuan-dirput-tertunda",
    name: "Direktori Putusan - Pengajuan Tertunda",
    description:
      "Mendeteksi pengajuan Direktori Putusan yang belum selesai/terkirim agar admin dapat memantau publikasi putusan.",
    sqlText: `
SELECT
  'Admin Publikasi Putusan' AS target_unit,
  dp.nomor_perkara,
  dp.status_pengajuan AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Pengajuan Direktori Putusan perkara ', dp.nomor_perkara, ' masih berstatus ', COALESCE(dp.status_pengajuan, 'belum ada status'), '.') AS ringkasan,
  COALESCE(dp.tgl_status_pengajuan, dp.tgl_surat_pengantar) AS waktu
FROM dirput_pengajuan dp
WHERE COALESCE(dp.status_pengajuan, '') NOT IN ('Diterima', 'Selesai', 'Berhasil', 'Terkirim', 'success', 'SUCCESS')
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-perubahan-data-pihak-24-jam",
    name: "Pihak - Data Berubah 24 Jam Terakhir",
    description:
      "Mendeteksi perubahan data pihak dalam 24 jam terakhir agar admin dapat memastikan notifikasi tidak memakai nomor lama.",
    sqlText: `
SELECT
  'Kepaniteraan / PTSP' AS target_unit,
  rel.nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Data pihak berubah 24 jam terakhir' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Data pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' berubah dalam 24 jam terakhir.') AS ringkasan,
  COALESCE(rel.diperbaharui_tanggal, rel.diinput_tanggal, ph.diperbaharui_tanggal, ph.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE COALESCE(rel.diperbaharui_tanggal, rel.diinput_tanggal, ph.diperbaharui_tanggal, ph.diinput_tanggal) >= DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
];

const PARTY_FOLLOWUP_QUERY_DEFINITIONS: SeedQuery[] = [
  source({
    id: "sipp-extra-pihak-lanjutan-kontak-kosong-aktif",
    name: "Pihak Lanjutan - Kontak Kosong Pada Perkara Aktif",
    category: "party",
    description: "Daftar pihak perkara aktif yang belum punya nomor WhatsApp/telepon.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Kontak pihak belum lengkap' AS judul_notifikasi,
  CONCAT('Pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' belum memiliki nomor WhatsApp/telepon.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(rel.diperbaharui_tanggal, rel.diinput_tanggal, p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.telepon, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-format-wa-perlu-rapi",
    name: "Pihak Lanjutan - Format WhatsApp Perlu Dirapikan",
    category: "party",
    description: "Mendeteksi nomor pihak perkara aktif yang formatnya berpotensi tidak bisa dikirim WhatsApp.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Format WhatsApp perlu dirapikan' AS judul_notifikasi,
  CONCAT('Nomor pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' perlu dicek: ', COALESCE(ph.telepon, '-')) AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(rel.diperbaharui_tanggal, rel.diinput_tanggal, ph.diperbaharui_tanggal, ph.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
  AND TRIM(ph.telepon) NOT REGEXP '^(0|62|\\+62)[0-9]{8,15}$'
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-alamat-kosong-aktif",
    name: "Pihak Lanjutan - Alamat Kosong Pada Perkara Aktif",
    category: "party",
    description: "Mendeteksi data pihak perkara aktif yang alamatnya belum lengkap.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Alamat pihak belum lengkap' AS judul_notifikasi,
  CONCAT('Alamat pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' belum lengkap.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(ph.diperbaharui_tanggal, ph.diinput_tanggal, rel.diperbaharui_tanggal, rel.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.alamat, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-email-kosong-ecourt",
    name: "Pihak Lanjutan - Email Belum Ada Untuk Layanan Elektronik",
    category: "party",
    description: "Mendeteksi pihak perkara aktif yang belum punya email sebagai bahan validasi layanan elektronik.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Email pihak belum lengkap' AS judul_notifikasi,
  CONCAT('Email pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' belum tersedia.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(ph.diperbaharui_tanggal, ph.diinput_tanggal, rel.diperbaharui_tanggal, rel.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.email, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-nomor-perlu-normalisasi",
    name: "Pihak Lanjutan - Nomor Perlu Normalisasi 62",
    category: "party",
    description: "Mendeteksi nomor pihak yang masih memakai awalan lokal atau karakter campuran sebelum dikirim ke WhatsApp.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Nomor perlu normalisasi' AS judul_notifikasi,
  CONCAT('Nomor ', COALESCE(ph.telepon, '-'), ' milik ', rel.nama_pihak, ' perlu dinormalisasi sebelum pengiriman WhatsApp.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(ph.diperbaharui_tanggal, ph.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
  AND (ph.telepon LIKE '%-%' OR ph.telepon LIKE '% %' OR ph.telepon LIKE '+62%')
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-nomor-sama-perkara-aktif",
    name: "Pihak Lanjutan - Nomor Sama Di Perkara Aktif",
    category: "party",
    description: "Mendeteksi nomor WhatsApp yang dipakai oleh beberapa pihak pada perkara aktif.",
    sqlText: `
SELECT
  GROUP_CONCAT(DISTINCT rel.nama_pihak ORDER BY rel.nama_pihak SEPARATOR ', ') AS nama_pihak,
  GROUP_CONCAT(DISTINCT p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  'Nomor dipakai beberapa pihak aktif' AS judul_notifikasi,
  CONCAT('Nomor ', TRIM(ph.telepon), ' dipakai oleh ', COUNT(DISTINCT rel.nama_pihak), ' nama pihak pada perkara aktif.') AS ringkasan,
  TRIM(ph.telepon) AS telepon,
  TRIM(ph.telepon) AS nomor_hp,
  MAX(COALESCE(ph.diperbaharui_tanggal, ph.diinput_tanggal)) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
GROUP BY TRIM(ph.telepon)
HAVING COUNT(DISTINCT rel.nama_pihak) > 1
ORDER BY COUNT(DISTINCT rel.nama_pihak) DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-update-7-hari",
    name: "Pihak Lanjutan - Data Berubah 7 Hari Terakhir",
    category: "party",
    description: "Mendeteksi data pihak yang berubah dalam tujuh hari terakhir.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Data pihak berubah minggu ini' AS judul_notifikasi,
  CONCAT('Data pihak ', rel.nama_pihak, ' pada perkara ', p.nomor_perkara, ' berubah dalam tujuh hari terakhir.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(rel.diperbaharui_tanggal, ph.diperbaharui_tanggal, rel.diinput_tanggal, ph.diinput_tanggal) AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak2
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak3
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak, diinput_tanggal, diperbaharui_tanggal FROM perkara_pihak4
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE COALESCE(rel.diperbaharui_tanggal, ph.diperbaharui_tanggal, rel.diinput_tanggal, ph.diinput_tanggal) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-perkara-baru-3-hari",
    name: "Pihak Lanjutan - Penerima Perkara Baru 3 Hari",
    category: "party",
    description: "Daftar pihak pada perkara yang didaftarkan dalam tiga hari terakhir.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Perkara baru terdaftar' AS judul_notifikasi,
  CONCAT('Perkara ', p.nomor_perkara, ' baru terdaftar. Pihak: ', rel.nama_pihak, '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.tanggal_pendaftaran AS waktu
FROM (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel
JOIN perkara p ON p.perkara_id = rel.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
ORDER BY p.tanggal_pendaftaran DESC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-sidang-besok-ada-wa",
    name: "Pihak Lanjutan - Sidang Besok Dengan WhatsApp",
    category: "party",
    description: "Target pengingat sidang besok untuk pihak yang sudah memiliki nomor WhatsApp.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Pengingat sidang besok' AS judul_notifikasi,
  CONCAT('Sidang perkara ', p.nomor_perkara, ' dijadwalkan besok pada agenda ', COALESCE(s.agenda, '-'), '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-sidang-besok-tanpa-wa",
    name: "Pihak Lanjutan - Sidang Besok Tanpa WhatsApp",
    category: "party",
    description: "Daftar pihak sidang besok yang belum punya nomor WhatsApp untuk diperbaiki petugas.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Sidang besok tanpa nomor WhatsApp' AS judul_notifikasi,
  CONCAT('Pihak ', rel.nama_pihak, ' sidang besok pada perkara ', p.nomor_perkara, ' tetapi nomor WhatsApp belum ada.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) = ''
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-mediasi-3-hari",
    name: "Pihak Lanjutan - Mediasi Dalam 3 Hari",
    category: "party",
    description: "Target pengingat mediasi dalam tiga hari ke depan untuk pihak perkara.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Pengingat mediasi dekat' AS judul_notifikasi,
  CONCAT('Mediasi perkara ', p.nomor_perkara, ' dijadwalkan pada ', s.tanggal_sidang, '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
  AND LOWER(COALESCE(s.agenda, '')) LIKE '%mediasi%'
ORDER BY s.tanggal_sidang ASC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-belum-ada-jadwal-14-hari",
    name: "Pihak Lanjutan - Perkara Aktif Belum Ada Jadwal 14 Hari",
    category: "party",
    description: "Mendeteksi pihak perkara aktif yang belum memiliki jadwal sidang baru dalam 14 hari terakhir.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Perkara aktif belum ada jadwal baru' AS judul_notifikasi,
  CONCAT('Perkara ', p.nomor_perkara, ' belum memiliki jadwal sidang baru dalam 14 hari terakhir.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  MAX(s.tanggal_sidang) AS waktu
FROM perkara p
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
LEFT JOIN perkara_jadwal_sidang s ON s.perkara_id = p.perkara_id
WHERE ${activeCaseFilter}
GROUP BY rel.nama_pihak, p.nomor_perkara, ph.telepon
HAVING MAX(s.tanggal_sidang) IS NULL OR MAX(s.tanggal_sidang) < DATE_SUB(CURDATE(), INTERVAL 14 DAY)
ORDER BY waktu ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-sidang-hari-ini-tanpa-wa",
    name: "Pihak Lanjutan - Sidang Hari Ini Tanpa WhatsApp",
    category: "party",
    description: "Daftar pihak yang sidang hari ini tetapi belum punya nomor WhatsApp.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Sidang hari ini tanpa WhatsApp' AS judul_notifikasi,
  CONCAT('Pihak ', rel.nama_pihak, ' sidang hari ini pada perkara ', p.nomor_perkara, ' tetapi nomor WhatsApp belum ada.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang = CURDATE()
  AND TRIM(COALESCE(ph.telepon, '')) = ''
ORDER BY p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-kuasa-aktif-berkontak",
    name: "Pihak Lanjutan - Kuasa Aktif Dengan Kontak",
    category: "party",
    description: "Daftar kuasa hukum aktif yang punya nomor kontak untuk notifikasi perkara.",
    sqlText: `
SELECT
  pg.nama AS nama_pihak,
  p.nomor_perkara,
  'Kuasa hukum aktif' AS judul_notifikasi,
  CONCAT('Kuasa hukum ', pg.nama, ' aktif pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  pg.telepon,
  pg.telepon AS nomor_hp,
  COALESCE(pg.diperbaharui_tanggal, pg.diinput_tanggal) AS waktu
FROM perkara_pengacara pg
JOIN perkara p ON p.perkara_id = pg.perkara_id
WHERE COALESCE(pg.aktif, 'Y') = 'Y'
  AND TRIM(COALESCE(pg.telepon, '')) <> ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-kuasa-tanpa-kontak",
    name: "Pihak Lanjutan - Kuasa Aktif Tanpa Kontak",
    category: "party",
    description: "Daftar kuasa hukum aktif yang belum punya nomor kontak.",
    sqlText: `
SELECT
  pg.nama AS nama_pihak,
  p.nomor_perkara,
  'Kuasa hukum tanpa kontak' AS judul_notifikasi,
  CONCAT('Kuasa hukum ', pg.nama, ' aktif pada perkara ', p.nomor_perkara, ' tetapi nomor kontak belum ada.') AS ringkasan,
  pg.telepon,
  pg.telepon AS nomor_hp,
  COALESCE(pg.diperbaharui_tanggal, pg.diinput_tanggal) AS waktu
FROM perkara_pengacara pg
JOIN perkara p ON p.perkara_id = pg.perkara_id
WHERE COALESCE(pg.aktif, 'Y') = 'Y'
  AND TRIM(COALESCE(pg.telepon, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-turut-tergugat-aktif",
    name: "Pihak Lanjutan - Turut Tergugat Aktif",
    category: "party",
    description: "Daftar pihak turut tergugat aktif untuk kebutuhan pemberitahuan perkara.",
    sqlText: `
SELECT
  pp3.nama AS nama_pihak,
  p.nomor_perkara,
  'Turut tergugat aktif' AS judul_notifikasi,
  CONCAT('Turut tergugat ', pp3.nama, ' tercatat pada perkara aktif ', p.nomor_perkara, '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(pp3.diperbaharui_tanggal, pp3.diinput_tanggal) AS waktu
FROM perkara_pihak3 pp3
JOIN perkara p ON p.perkara_id = pp3.perkara_id
LEFT JOIN pihak ph ON ph.id = pp3.pihak_id
WHERE ${activeCaseFilter}
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-intervensi-aktif",
    name: "Pihak Lanjutan - Intervensi Aktif",
    category: "party",
    description: "Daftar pihak intervensi aktif untuk kebutuhan validasi target notifikasi.",
    sqlText: `
SELECT
  pp4.nama AS nama_pihak,
  p.nomor_perkara,
  'Pihak intervensi aktif' AS judul_notifikasi,
  CONCAT('Pihak intervensi ', pp4.nama, ' tercatat pada perkara aktif ', p.nomor_perkara, '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(pp4.diperbaharui_tanggal, pp4.diinput_tanggal) AS waktu
FROM perkara_pihak4 pp4
JOIN perkara p ON p.perkara_id = pp4.perkara_id
LEFT JOIN pihak ph ON ph.id = pp4.pihak_id
WHERE ${activeCaseFilter}
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-perkara-lama-aktif",
    name: "Pihak Lanjutan - Perkara Lama Masih Aktif",
    category: "party",
    description: "Daftar pihak pada perkara aktif yang sudah berjalan lebih dari 180 hari.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Perkara lama masih aktif' AS judul_notifikasi,
  CONCAT('Perkara ', p.nomor_perkara, ' sudah berjalan ', DATEDIFF(CURDATE(), p.tanggal_pendaftaran), ' hari dan masih aktif.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.tanggal_pendaftaran AS waktu
FROM perkara p
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE ${activeCaseFilter}
  AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 180 DAY)
ORDER BY p.tanggal_pendaftaran ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-perkara-cabut-7-hari",
    name: "Pihak Lanjutan - Perkara Dicabut 7 Hari Terakhir",
    category: "party",
    description: "Daftar pihak pada perkara yang status/tahapannya menunjukkan pencabutan dalam tujuh hari terakhir.",
    sqlText: `
SELECT
  rel.nama_pihak,
  p.nomor_perkara,
  'Perkara dicabut' AS judul_notifikasi,
  CONCAT('Perkara ', p.nomor_perkara, ' terindikasi dicabut. Pihak: ', rel.nama_pihak, '.') AS ringkasan,
  ph.telepon,
  ph.telepon AS nomor_hp,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE COALESCE(p.tahapan_terakhir_text, '') LIKE '%Cabut%'
  AND COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pihak-lanjutan-nomor-bentrok-sidang-besok",
    name: "Pihak Lanjutan - Nomor Bentrok Sidang Besok",
    category: "party",
    description: "Mendeteksi nomor WhatsApp yang menjadi target beberapa pengingat sidang besok.",
    sqlText: `
SELECT
  GROUP_CONCAT(DISTINCT rel.nama_pihak ORDER BY rel.nama_pihak SEPARATOR ', ') AS nama_pihak,
  GROUP_CONCAT(DISTINCT p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  'Nomor menerima beberapa pengingat sidang besok' AS judul_notifikasi,
  CONCAT('Nomor ', TRIM(ph.telepon), ' menjadi target ', COUNT(DISTINCT p.perkara_id), ' pengingat sidang besok.') AS ringkasan,
  TRIM(ph.telepon) AS telepon,
  TRIM(ph.telepon) AS nomor_hp,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (
  SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak1
  UNION ALL SELECT perkara_id, pihak_id, nama AS nama_pihak FROM perkara_pihak2
) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
GROUP BY TRIM(ph.telepon), s.tanggal_sidang
HAVING COUNT(DISTINCT p.perkara_id) > 1
ORDER BY COUNT(DISTINCT p.perkara_id) DESC
LIMIT 200`,
  }),
];

const EMPLOYEE_FOLLOWUP_QUERY_DEFINITIONS: SeedQuery[] = [
  source({
    id: "sipp-extra-pegawai-lanjutan-hakim-sidang-hari-ini",
    name: "Pegawai Lanjutan - Hakim Sidang Hari Ini",
    description: "Daftar hakim yang memiliki jadwal sidang hari ini.",
    sqlText: `
SELECT
  'Hakim' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang hari ini' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Hakim ', h.hakim_nama, ' memiliki sidang hari ini pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE s.tanggal_sidang = CURDATE()
GROUP BY h.hakim_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY h.hakim_nama, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-hakim-sidang-besok",
    name: "Pegawai Lanjutan - Hakim Sidang Besok",
    description: "Daftar hakim yang memiliki jadwal sidang besok.",
    sqlText: `
SELECT
  'Hakim' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Hakim ', h.hakim_nama, ' memiliki sidang besok pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY h.hakim_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY h.hakim_nama, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-panitera-sidang-hari-ini",
    name: "Pegawai Lanjutan - Panitera Sidang Hari Ini",
    description: "Daftar panitera pengganti yang memiliki sidang hari ini.",
    sqlText: `
SELECT
  'Panitera Pengganti' AS target_unit,
  pp.panitera_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang hari ini' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Panitera ', pp.panitera_nama, ' memiliki sidang hari ini pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = CURDATE()
GROUP BY pp.panitera_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY pp.panitera_nama, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-panitera-sidang-besok",
    name: "Pegawai Lanjutan - Panitera Sidang Besok",
    description: "Daftar panitera pengganti yang memiliki sidang besok.",
    sqlText: `
SELECT
  'Panitera Pengganti' AS target_unit,
  pp.panitera_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Panitera ', pp.panitera_nama, ' memiliki sidang besok pada perkara ', p.nomor_perkara, '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY pp.panitera_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY pp.panitera_nama, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jurusita-sidang-besok",
    name: "Pegawai Lanjutan - Jurusita Sidang Besok",
    description: "Daftar jurusita/jurusita pengganti yang terkait perkara sidang besok.",
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  j.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Perkara sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Jurusita ', j.jurusita_nama, ' terkait perkara ', p.nomor_perkara, ' yang sidang besok.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_jurusita j ON j.perkara_id = p.perkara_id AND j.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY j.jurusita_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY j.jurusita_nama, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-beban-hakim-aktif",
    name: "Pegawai Lanjutan - Beban Perkara Aktif Hakim",
    description: "Rekap jumlah perkara aktif per hakim.",
    sqlText: `
SELECT
  'Hakim' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  '' AS nomor_perkara,
  'Beban perkara aktif hakim' AS judul_notifikasi,
  COUNT(DISTINCT p.perkara_id) AS jumlah,
  CONCAT('Hakim ', h.hakim_nama, ' memiliki ', COUNT(DISTINCT p.perkara_id), ' perkara aktif.') AS ringkasan,
  MAX(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal)) AS waktu
FROM perkara_hakim_pn h
JOIN perkara p ON p.perkara_id = h.perkara_id
WHERE h.aktif = 'Y' AND ${activeCaseFilter}
GROUP BY h.hakim_nama
ORDER BY jumlah DESC, h.hakim_nama
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-beban-panitera-aktif",
    name: "Pegawai Lanjutan - Beban Perkara Aktif Panitera",
    description: "Rekap jumlah perkara aktif per panitera pengganti.",
    sqlText: `
SELECT
  'Panitera Pengganti' AS target_unit,
  pp.panitera_nama AS nama_pegawai,
  '' AS nomor_perkara,
  'Beban perkara aktif panitera' AS judul_notifikasi,
  COUNT(DISTINCT p.perkara_id) AS jumlah,
  CONCAT('Panitera ', pp.panitera_nama, ' memiliki ', COUNT(DISTINCT p.perkara_id), ' perkara aktif.') AS ringkasan,
  MAX(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal)) AS waktu
FROM perkara_panitera_pn pp
JOIN perkara p ON p.perkara_id = pp.perkara_id
WHERE pp.aktif = 'Y' AND ${activeCaseFilter}
GROUP BY pp.panitera_nama
ORDER BY jumlah DESC, pp.panitera_nama
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-beban-jurusita-aktif",
    name: "Pegawai Lanjutan - Beban Perkara Aktif Jurusita",
    description: "Rekap jumlah perkara aktif per jurusita.",
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  j.jurusita_nama AS nama_pegawai,
  '' AS nomor_perkara,
  'Beban perkara aktif jurusita' AS judul_notifikasi,
  COUNT(DISTINCT p.perkara_id) AS jumlah,
  CONCAT('Jurusita ', j.jurusita_nama, ' memiliki ', COUNT(DISTINCT p.perkara_id), ' perkara aktif.') AS ringkasan,
  MAX(COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal)) AS waktu
FROM perkara_jurusita j
JOIN perkara p ON p.perkara_id = j.perkara_id
WHERE j.aktif = 'Y' AND ${activeCaseFilter}
GROUP BY j.jurusita_nama
ORDER BY jumlah DESC, j.jurusita_nama
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-ruangan-sidang-hari-ini",
    name: "Pegawai Lanjutan - Ruangan Sidang Hari Ini",
    description: "Rekap jumlah sidang per ruangan hari ini untuk penjaga sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  COALESCE(s.ruangan, 'Ruangan belum diisi') AS nama_pegawai,
  GROUP_CONCAT(p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  'Rekap ruangan sidang hari ini' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT(COALESCE(s.ruangan, 'Ruangan belum diisi'), ' memiliki ', COUNT(*), ' jadwal sidang hari ini.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang = CURDATE()
GROUP BY COALESCE(s.ruangan, 'Ruangan belum diisi'), s.tanggal_sidang
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-ruangan-sidang-besok",
    name: "Pegawai Lanjutan - Ruangan Sidang Besok",
    description: "Rekap jumlah sidang per ruangan besok untuk penjaga sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  COALESCE(s.ruangan, 'Ruangan belum diisi') AS nama_pegawai,
  GROUP_CONCAT(p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  'Rekap ruangan sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT(COALESCE(s.ruangan, 'Ruangan belum diisi'), ' memiliki ', COUNT(*), ' jadwal sidang besok.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY COALESCE(s.ruangan, 'Ruangan belum diisi'), s.tanggal_sidang
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jadwal-tanpa-hakim",
    name: "Pegawai Lanjutan - Jadwal Sidang Tanpa Hakim Aktif",
    description: "Mendeteksi jadwal sidang mendatang yang belum memiliki hakim aktif.",
    sqlText: `
SELECT
  'Majelis' AS target_unit,
  'Belum ada hakim aktif' AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang tanpa hakim aktif' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' belum memiliki hakim aktif.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE s.tanggal_sidang >= CURDATE()
GROUP BY p.perkara_id, p.nomor_perkara, s.tanggal_sidang
HAVING COUNT(h.hakim_id) = 0
ORDER BY s.tanggal_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jadwal-tanpa-panitera",
    name: "Pegawai Lanjutan - Jadwal Sidang Tanpa Panitera Aktif",
    description: "Mendeteksi jadwal sidang mendatang yang belum memiliki panitera aktif.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  'Belum ada panitera aktif' AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang tanpa panitera aktif' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' belum memiliki panitera aktif.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang >= CURDATE()
GROUP BY p.perkara_id, p.nomor_perkara, s.tanggal_sidang
HAVING COUNT(pp.panitera_id) = 0
ORDER BY s.tanggal_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-aktif-tanpa-hakim",
    name: "Pegawai Lanjutan - Perkara Aktif Tanpa Hakim",
    description: "Mendeteksi perkara aktif yang belum punya hakim aktif.",
    sqlText: `
SELECT
  'Majelis' AS target_unit,
  'Belum ada hakim aktif' AS nama_pegawai,
  p.nomor_perkara,
  'Perkara aktif tanpa hakim' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara aktif ', p.nomor_perkara, ' belum memiliki hakim aktif.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE ${activeCaseFilter}
GROUP BY p.perkara_id, p.nomor_perkara
HAVING COUNT(h.hakim_id) = 0
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-aktif-tanpa-panitera",
    name: "Pegawai Lanjutan - Perkara Aktif Tanpa Panitera",
    description: "Mendeteksi perkara aktif yang belum punya panitera aktif.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  'Belum ada panitera aktif' AS nama_pegawai,
  p.nomor_perkara,
  'Perkara aktif tanpa panitera' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara aktif ', p.nomor_perkara, ' belum memiliki panitera aktif.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE ${activeCaseFilter}
GROUP BY p.perkara_id, p.nomor_perkara
HAVING COUNT(pp.panitera_id) = 0
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-aktif-tanpa-jurusita",
    name: "Pegawai Lanjutan - Perkara Aktif Tanpa Jurusita",
    description: "Mendeteksi perkara aktif yang belum punya jurusita aktif.",
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  'Belum ada jurusita aktif' AS nama_pegawai,
  p.nomor_perkara,
  'Perkara aktif tanpa jurusita' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara aktif ', p.nomor_perkara, ' belum memiliki jurusita aktif.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
LEFT JOIN perkara_jurusita j ON j.perkara_id = p.perkara_id AND j.aktif = 'Y'
WHERE ${activeCaseFilter}
GROUP BY p.perkara_id, p.nomor_perkara
HAVING COUNT(j.jurusita_id) = 0
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-baru-hari-ini",
    name: "Pegawai Lanjutan - Perkara Baru Hari Ini",
    description: "Daftar perkara yang didaftarkan hari ini untuk monitoring kepaniteraan.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  COALESCE(pp.panitera_nama, 'Belum ada panitera') AS nama_pegawai,
  p.nomor_perkara,
  'Perkara baru hari ini' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' didaftarkan hari ini.') AS ringkasan,
  p.tanggal_pendaftaran AS waktu
FROM perkara p
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE p.tanggal_pendaftaran = CURDATE()
ORDER BY p.tanggal_pendaftaran DESC, p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-baru-minggu-ini",
    name: "Pegawai Lanjutan - Perkara Baru Minggu Ini",
    description: "Rekap perkara baru tujuh hari terakhir per panitera aktif.",
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  COALESCE(pp.panitera_nama, 'Belum ada panitera') AS nama_pegawai,
  GROUP_CONCAT(p.nomor_perkara ORDER BY p.nomor_perkara SEPARATOR ', ') AS nomor_perkara,
  'Perkara baru minggu ini' AS judul_notifikasi,
  COUNT(DISTINCT p.perkara_id) AS jumlah,
  CONCAT(COALESCE(pp.panitera_nama, 'Belum ada panitera'), ' terkait ', COUNT(DISTINCT p.perkara_id), ' perkara baru minggu ini.') AS ringkasan,
  MAX(p.tanggal_pendaftaran) AS waktu
FROM perkara p
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY COALESCE(pp.panitera_nama, 'Belum ada panitera')
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-perkara-aktif-tanpa-update-30-hari",
    name: "Pegawai Lanjutan - Perkara Aktif Tanpa Update 30 Hari",
    description: "Mendeteksi perkara aktif yang tidak berubah selama 30 hari untuk monitoring pimpinan.",
    sqlText: `
SELECT
  'Monitoring Perkara' AS target_unit,
  COALESCE(h.hakim_nama, pp.panitera_nama, 'Belum ada petugas') AS nama_pegawai,
  p.nomor_perkara,
  'Perkara aktif tanpa update 30 hari' AS judul_notifikasi,
  DATEDIFF(CURDATE(), COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran)) AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' belum ada update selama ', DATEDIFF(CURDATE(), COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran)), ' hari.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran) AS waktu
FROM perkara p
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE ${activeCaseFilter}
  AND COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal, p.tanggal_pendaftaran) < DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jadwal-7-hari-tanpa-jam",
    name: "Pegawai Lanjutan - Jadwal 7 Hari Tanpa Jam",
    description: "Mendeteksi jadwal sidang tujuh hari ke depan yang belum punya jam sidang.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  COALESCE(s.ruangan, 'Ruangan belum diisi') AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang tanpa jam' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' belum memiliki jam sidang.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND TRIM(COALESCE(s.jam_sidang, '')) = ''
ORDER BY s.tanggal_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jadwal-7-hari-tanpa-ruangan",
    name: "Pegawai Lanjutan - Jadwal 7 Hari Tanpa Ruangan",
    description: "Mendeteksi jadwal sidang tujuh hari ke depan yang belum punya ruangan.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  'Ruangan belum diisi' AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang tanpa ruangan' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' belum memiliki ruangan.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND TRIM(COALESCE(s.ruangan, '')) = ''
ORDER BY s.tanggal_sidang ASC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-tahapan-kosong",
    name: "Pegawai Lanjutan - Tahapan Perkara Kosong",
    description: "Mendeteksi perkara yang belum memiliki tahapan terakhir.",
    sqlText: `
SELECT
  'Monitoring Perkara' AS target_unit,
  COALESCE(pp.panitera_nama, h.hakim_nama, 'Belum ada petugas') AS nama_pegawai,
  p.nomor_perkara,
  'Tahapan perkara kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' belum memiliki tahapan terakhir.') AS ringkasan,
  COALESCE(p.diperbaharui_tanggal, p.diinput_tanggal) AS waktu
FROM perkara p
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE TRIM(COALESCE(p.tahapan_terakhir_text, '')) = ''
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-transaksi-biaya-hari-ini",
    name: "Pegawai Lanjutan - Transaksi Biaya Hari Ini",
    description: "Daftar transaksi biaya perkara hari ini untuk kasir.",
    sqlText: `
SELECT
  'Kasir' AS target_unit,
  'Kasir perkara' AS nama_pegawai,
  p.nomor_perkara,
  'Transaksi biaya hari ini' AS judul_notifikasi,
  SUM(b.jumlah) AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki transaksi biaya hari ini sebesar ', SUM(b.jumlah), '.') AS ringkasan,
  b.tanggal_transaksi AS waktu
FROM perkara_biaya b
JOIN perkara p ON p.perkara_id = b.perkara_id
WHERE b.tanggal_transaksi = CURDATE()
GROUP BY p.nomor_perkara, b.tanggal_transaksi
ORDER BY jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-transaksi-biaya-besar",
    name: "Pegawai Lanjutan - Transaksi Biaya Besar",
    description: "Mendeteksi transaksi biaya perkara besar dalam tujuh hari terakhir untuk pengecekan kasir.",
    sqlText: `
SELECT
  'Kasir' AS target_unit,
  'Kasir perkara' AS nama_pegawai,
  p.nomor_perkara,
  'Transaksi biaya besar' AS judul_notifikasi,
  b.jumlah,
  CONCAT('Transaksi biaya perkara ', p.nomor_perkara, ' bernilai ', b.jumlah, ' dan perlu dicek sesuai SOP.') AS ringkasan,
  b.tanggal_transaksi AS waktu
FROM perkara_biaya b
JOIN perkara p ON p.perkara_id = b.perkara_id
WHERE b.tanggal_transaksi >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND b.jumlah >= 10000000
ORDER BY b.jumlah DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-mediasi-hari-ini",
    name: "Pegawai Lanjutan - Mediasi Hari Ini",
    description: "Daftar perkara dengan agenda mediasi hari ini untuk hakim mediator/panitera.",
    sqlText: `
SELECT
  'Mediasi' AS target_unit,
  COALESCE(h.hakim_nama, pp.panitera_nama, 'Petugas mediasi') AS nama_pegawai,
  p.nomor_perkara,
  'Mediasi hari ini' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki agenda mediasi hari ini.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = CURDATE()
  AND LOWER(COALESCE(s.agenda, '')) LIKE '%mediasi%'
ORDER BY p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-mediasi-besok",
    name: "Pegawai Lanjutan - Mediasi Besok",
    description: "Daftar perkara dengan agenda mediasi besok untuk hakim mediator/panitera.",
    sqlText: `
SELECT
  'Mediasi' AS target_unit,
  COALESCE(h.hakim_nama, pp.panitera_nama, 'Petugas mediasi') AS nama_pegawai,
  p.nomor_perkara,
  'Mediasi besok' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Perkara ', p.nomor_perkara, ' memiliki agenda mediasi besok.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  AND LOWER(COALESCE(s.agenda, '')) LIKE '%mediasi%'
ORDER BY p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-sidang-ditunda-hari-ini",
    name: "Pegawai Lanjutan - Sidang Ditunda Hari Ini",
    description: "Mendeteksi jadwal sidang hari ini yang agendanya menunjukkan penundaan.",
    sqlText: `
SELECT
  'Monitoring Sidang' AS target_unit,
  COALESCE(h.hakim_nama, pp.panitera_nama, 'Petugas sidang') AS nama_pegawai,
  p.nomor_perkara,
  'Sidang ditunda hari ini' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Sidang perkara ', p.nomor_perkara, ' hari ini terindikasi ditunda.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
LEFT JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
LEFT JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = CURDATE()
  AND LOWER(COALESCE(s.agenda, '')) LIKE '%tunda%'
ORDER BY p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jadwal-hari-ini-belum-agenda",
    name: "Pegawai Lanjutan - Jadwal Hari Ini Agenda Kosong",
    description: "Mendeteksi sidang hari ini yang agendanya belum diisi.",
    sqlText: `
SELECT
  'Penjaga Sidang' AS target_unit,
  COALESCE(s.ruangan, 'Ruangan belum diisi') AS nama_pegawai,
  p.nomor_perkara,
  'Agenda sidang kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Agenda sidang perkara ', p.nomor_perkara, ' hari ini belum diisi.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
WHERE s.tanggal_sidang = CURDATE()
  AND TRIM(COALESCE(s.agenda, '')) = ''
ORDER BY p.nomor_perkara
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-jurusita-tanpa-tanggal-aktif",
    name: "Pegawai Lanjutan - Jurusita Aktif Tanggal Kosong",
    description: "Mendeteksi penugasan jurusita aktif yang tanggal penugasan/aktifnya kosong.",
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  j.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Tanggal penugasan jurusita kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Jurusita ', j.jurusita_nama, ' aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal aktif/penugasan belum lengkap.') AS ringkasan,
  COALESCE(j.diperbaharui_tanggal, j.diinput_tanggal) AS waktu
FROM perkara_jurusita j
JOIN perkara p ON p.perkara_id = j.perkara_id
WHERE j.aktif = 'Y'
  AND j.tanggal_aktif IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-panitera-tanpa-tanggal-aktif",
    name: "Pegawai Lanjutan - Panitera Aktif Tanggal Kosong",
    description: "Mendeteksi penugasan panitera aktif yang tanggal penugasan/aktifnya kosong.",
    sqlText: `
SELECT
  'Panitera Pengganti' AS target_unit,
  pp.panitera_nama AS nama_pegawai,
  p.nomor_perkara,
  'Tanggal penugasan panitera kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Panitera ', pp.panitera_nama, ' aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal aktif/penugasan belum lengkap.') AS ringkasan,
  COALESCE(pp.diperbaharui_tanggal, pp.diinput_tanggal) AS waktu
FROM perkara_panitera_pn pp
JOIN perkara p ON p.perkara_id = pp.perkara_id
WHERE pp.aktif = 'Y'
  AND pp.tanggal_aktif IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-extra-pegawai-lanjutan-hakim-tanpa-tanggal-aktif",
    name: "Pegawai Lanjutan - Hakim Aktif Tanggal Kosong",
    description: "Mendeteksi penugasan hakim aktif yang tanggal penugasan/aktifnya kosong.",
    sqlText: `
SELECT
  'Hakim' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  p.nomor_perkara,
  'Tanggal penugasan hakim kosong' AS judul_notifikasi,
  1 AS jumlah,
  CONCAT('Hakim ', h.hakim_nama, ' aktif pada perkara ', p.nomor_perkara, ' tetapi tanggal aktif/penugasan belum lengkap.') AS ringkasan,
  COALESCE(h.diperbaharui_tanggal, h.diinput_tanggal) AS waktu
FROM perkara_hakim_pn h
JOIN perkara p ON p.perkara_id = h.perkara_id
WHERE h.aktif = 'Y'
  AND h.tanggal_aktif IS NULL
ORDER BY waktu DESC
LIMIT 200`,
  }),
];

const IMPORTANT_EVENT_QUERY_DEFINITIONS: SeedQuery[] = [
  source({
    id: "sipp-event-pihak-jadwal-sidang-berubah",
    name: "Event Pihak - Perubahan Jadwal Sidang",
    category: "party",
    description: "Mengambil pihak perkara yang jadwal sidangnya baru diperbarui agar dapat dikirim notifikasi perubahan jadwal.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "hari_sidang", "tanggal_sidang", "ruangan", "agenda"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Perubahan jadwal sidang' AS judul_notifikasi,
  DAYNAME(s.tanggal_sidang) AS hari_sidang,
  s.tanggal_sidang AS tanggal_sidang,
  COALESCE(s.ruangan, 'Ruang sidang belum diisi') AS ruangan,
  COALESCE(s.agenda, 'Agenda belum diisi') AS agenda,
  CONCAT('Jadwal sidang perkara ', p.nomor_perkara, ' diperbarui menjadi ', DATE_FORMAT(s.tanggal_sidang, '%d-%m-%Y'), ', ruang ', COALESCE(s.ruangan, '-'), ', agenda ', COALESCE(s.agenda, '-'), '.') AS ringkasan,
  COALESCE(s.diperbaharui_tanggal, s.diinput_tanggal, s.tanggal_sidang) AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE s.tanggal_sidang >= CURDATE()
  AND COALESCE(s.diperbaharui_tanggal, s.diinput_tanggal, s.tanggal_sidang) >= DATE_SUB(NOW(), INTERVAL 2 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY waktu DESC, s.tanggal_sidang ASC
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pihak-sidang-ditunda",
    name: "Event Pihak - Sidang Ditunda",
    category: "party",
    description: "Mengambil pihak perkara dengan jadwal sidang yang ditandai ditunda atau memiliki alasan penundaan.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "tanggal_sidang", "ruangan", "agenda", "alasan_ditunda"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Sidang ditunda' AS judul_notifikasi,
  s.tanggal_sidang,
  COALESCE(s.ruangan, 'Ruang sidang belum diisi') AS ruangan,
  COALESCE(s.agenda, 'Agenda belum diisi') AS agenda,
  COALESCE(NULLIF(TRIM(s.alasan_ditunda), ''), 'Alasan penundaan belum diisi') AS alasan_ditunda,
  CONCAT('Sidang perkara ', p.nomor_perkara, ' pada ', DATE_FORMAT(s.tanggal_sidang, '%d-%m-%Y'), ' ditunda. Alasan: ', COALESCE(NULLIF(TRIM(s.alasan_ditunda), ''), 'belum diisi'), '.') AS ringkasan,
  COALESCE(s.diperbaharui_tanggal, s.diinput_tanggal, s.tanggal_sidang) AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE (UPPER(COALESCE(CAST(s.ditunda AS CHAR), '')) IN ('Y', '1', 'YA', 'TRUE') OR TRIM(COALESCE(s.alasan_ditunda, '')) <> '')
  AND COALESCE(s.diperbaharui_tanggal, s.diinput_tanggal, s.tanggal_sidang) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY waktu DESC
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pihak-perkara-putus-terbaru",
    name: "Event Pihak - Perkara Putus Terbaru",
    category: "party",
    description: "Mengambil pihak perkara yang putus dalam beberapa hari terakhir untuk pemberitahuan ringkas.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "tanggal_putusan", "status_putusan"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Perkara putus' AS judul_notifikasi,
  pt.tanggal_putusan,
  COALESCE(pt.status_putusan_nama, 'Status putusan belum diisi') AS status_putusan,
  CONCAT('Perkara ', p.nomor_perkara, ' telah putus pada ', DATE_FORMAT(pt.tanggal_putusan, '%d-%m-%Y'), '. Status: ', COALESCE(pt.status_putusan_nama, '-'), '.') AS ringkasan,
  COALESCE(pt.diperbaharui_tanggal, pt.diinput_tanggal, pt.tanggal_putusan) AS waktu
FROM perkara_putusan pt
JOIN perkara p ON p.perkara_id = pt.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE pt.tanggal_putusan >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY pt.tanggal_putusan DESC, p.nomor_perkara
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pihak-akta-cerai-siap",
    name: "Event Pihak - Akta Cerai Siap Diambil",
    category: "party",
    description: "Mengambil pihak perkara yang akta cerainya sudah terbit tetapi belum tercatat diserahkan.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "nomor_akta_cerai", "tanggal_akta_cerai", "file_name", "file_type", "file_path"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Akta cerai siap' AS judul_notifikasi,
  ac.nomor_akta_cerai,
  ac.tgl_akta_cerai AS tanggal_akta_cerai,
  COALESCE(NULLIF(TRIM(ac.akta_cerai_dok), ''), 'akta-cerai.pdf') AS file_name,
  'pdf' AS file_type,
  ac.akta_cerai_dok AS file_path,
  CONCAT('Akta cerai perkara ', p.nomor_perkara, ' nomor ', COALESCE(ac.nomor_akta_cerai, '-'), ' sudah tersedia dan belum tercatat diserahkan.') AS ringkasan,
  COALESCE(ac.diperbaharui_tanggal, ac.diinput_tanggal, ac.tgl_akta_cerai) AS waktu
FROM perkara_akta_cerai ac
JOIN perkara p ON p.perkara_id = ac.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE TRIM(COALESCE(ac.nomor_akta_cerai, '')) <> ''
  AND ac.tgl_penyerahan_akta_cerai IS NULL
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY waktu DESC
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pihak-sisa-panjar-setelah-putus",
    name: "Event Pihak - Sisa Panjar Setelah Putus",
    category: "party",
    description: "Mengambil perkara putus yang masih memiliki sisa panjar agar pihak dapat diberi informasi layanan kasir.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "sisa_panjar"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Sisa panjar perkara' AS judul_notifikasi,
  biaya.sisa AS sisa_panjar,
  CONCAT('Perkara ', p.nomor_perkara, ' masih memiliki sisa panjar Rp', FORMAT(biaya.sisa, 0), '. Silakan konfirmasi ke kasir/PTSP pengadilan.') AS ringkasan,
  biaya.waktu
FROM (
  SELECT b1.perkara_id, b1.sisa, COALESCE(b1.diperbaharui_tanggal, b1.diinput_tanggal, b1.tanggal_transaksi) AS waktu
  FROM perkara_biaya b1
  JOIN (SELECT perkara_id, MAX(id) AS id FROM perkara_biaya GROUP BY perkara_id) last_biaya ON last_biaya.id = b1.id
) biaya
JOIN perkara p ON p.perkara_id = biaya.perkara_id
JOIN perkara_putusan pt ON pt.perkara_id = p.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE biaya.sisa > 0
  AND pt.tanggal_putusan IS NOT NULL
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY biaya.sisa DESC, biaya.waktu DESC
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pegawai-panjar-habis",
    name: "Event Pegawai - Panjar Habis atau Nol",
    category: "employee",
    description: "Mengambil perkara aktif dengan saldo panjar terakhir nol atau minus untuk monitoring kasir/kepaniteraan.",
    sqlText: `
SELECT
  'Kasir' AS target_unit,
  'Kasir' AS nama_pegawai,
  p.nomor_perkara,
  'Panjar habis atau perlu diperiksa' AS judul_notifikasi,
  biaya.sisa AS jumlah,
  CONCAT('Saldo panjar terakhir perkara ', p.nomor_perkara, ' adalah Rp', FORMAT(biaya.sisa, 0), '. Mohon dicek tindak lanjut layanan kasir.') AS ringkasan,
  biaya.waktu
FROM (
  SELECT b1.perkara_id, b1.sisa, COALESCE(b1.diperbaharui_tanggal, b1.diinput_tanggal, b1.tanggal_transaksi) AS waktu
  FROM perkara_biaya b1
  JOIN (SELECT perkara_id, MAX(id) AS id FROM perkara_biaya GROUP BY perkara_id) last_biaya ON last_biaya.id = b1.id
) biaya
JOIN perkara p ON p.perkara_id = biaya.perkara_id
WHERE biaya.sisa <= 0
  AND ${activeCaseFilter}
ORDER BY biaya.waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-event-pihak-dokumen-panggilan-tersedia",
    name: "Event Pihak - Dokumen Panggilan Tersedia",
    category: "party",
    description: "Mengambil pihak yang memiliki dokumen relaas/panggilan terunggah pada pelaksanaan relaas.",
    outputColumns: [...PARTY_OUTPUT_COLUMNS, "file_name", "file_type", "file_path"],
    sqlText: `
SELECT
  rel.nama AS nama_pihak,
  ph.telepon,
  ph.telepon AS nomor_hp,
  p.nomor_perkara,
  'Dokumen panggilan tersedia' AS judul_notifikasi,
  COALESCE(NULLIF(TRIM(r.doc_relaas), ''), NULLIF(TRIM(r.doc_resi), ''), 'dokumen-panggilan.pdf') AS file_name,
  'pdf' AS file_type,
  COALESCE(NULLIF(TRIM(r.doc_relaas), ''), NULLIF(TRIM(r.doc_resi), '')) AS file_path,
  CONCAT('Dokumen panggilan/pemberitahuan perkara ', p.nomor_perkara, ' telah tersedia pada data SIPP.') AS ringkasan,
  COALESCE(r.diperbaharui_tanggal, r.diinput_tanggal, r.tanggal_relaas, r.tanggal_jursit_pos) AS waktu
FROM perkara_pelaksanaan_relaas r
JOIN perkara p ON p.perkara_id = r.perkara_id
JOIN (${partyRelationSql}) rel ON rel.perkara_id = p.perkara_id AND rel.pihak_id = r.pihak_id
LEFT JOIN pihak ph ON ph.id = rel.pihak_id
WHERE (TRIM(COALESCE(r.doc_relaas, '')) <> '' OR TRIM(COALESCE(r.doc_resi, '')) <> '')
  AND COALESCE(r.diperbaharui_tanggal, r.diinput_tanggal, r.tanggal_relaas, r.tanggal_jursit_pos) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND TRIM(COALESCE(ph.telepon, '')) <> ''
ORDER BY waktu DESC
LIMIT 300`,
  }),
  source({
    id: "sipp-event-pegawai-dokumen-panggilan-tersedia",
    name: "Event Pegawai - Dokumen Panggilan Tersedia",
    category: "employee",
    description: "Mengambil dokumen relaas/panggilan terbaru untuk monitoring jurusita dan kepaniteraan.",
    outputColumns: [...EMPLOYEE_OUTPUT_COLUMNS, "file_name", "file_type", "file_path"],
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  'Jurusita' AS nama_pegawai,
  p.nomor_perkara,
  'Dokumen panggilan tersedia' AS judul_notifikasi,
  1 AS jumlah,
  COALESCE(NULLIF(TRIM(r.doc_relaas), ''), NULLIF(TRIM(r.doc_resi), ''), 'dokumen-panggilan.pdf') AS file_name,
  'pdf' AS file_type,
  COALESCE(NULLIF(TRIM(r.doc_relaas), ''), NULLIF(TRIM(r.doc_resi), '')) AS file_path,
  CONCAT('Dokumen panggilan/pemberitahuan perkara ', p.nomor_perkara, ' telah tersedia dan perlu dipastikan pengarsipannya.') AS ringkasan,
  COALESCE(r.diperbaharui_tanggal, r.diinput_tanggal, r.tanggal_relaas, r.tanggal_jursit_pos) AS waktu
FROM perkara_pelaksanaan_relaas r
JOIN perkara p ON p.perkara_id = r.perkara_id
WHERE (TRIM(COALESCE(r.doc_relaas, '')) <> '' OR TRIM(COALESCE(r.doc_resi, '')) <> '')
  AND COALESCE(r.diperbaharui_tanggal, r.diinput_tanggal, r.tanggal_relaas, r.tanggal_jursit_pos) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-event-pegawai-delegasi-masuk-baru",
    name: "Event Pegawai - Delegasi Masuk Baru",
    category: "employee",
    description: "Mengambil delegasi masuk terbaru agar kepaniteraan dapat menindaklanjuti jadwal dan dokumen.",
    outputColumns: [...EMPLOYEE_OUTPUT_COLUMNS, "file_name", "file_type", "file_path"],
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  'Kepaniteraan' AS nama_pegawai,
  dm.nomor_perkara,
  'Delegasi masuk baru' AS judul_notifikasi,
  1 AS jumlah,
  dm.namadokumen AS file_name,
  dm.document_mime AS file_type,
  dm.namadokumen AS file_path,
  CONCAT('Delegasi masuk perkara ', dm.nomor_perkara, ' dari ', COALESCE(dm.pn_asal_text, 'satker asal'), ' untuk sidang ', COALESCE(DATE_FORMAT(dm.tgl_sidang, '%d-%m-%Y'), '-'), '.') AS ringkasan,
  COALESCE(dm.diperbaharui_tanggal, dm.diinput_tanggal, dm.tgl_delegasi) AS waktu
FROM delegasi_masuk dm
WHERE COALESCE(dm.diperbaharui_tanggal, dm.diinput_tanggal, dm.tgl_delegasi) >= DATE_SUB(NOW(), INTERVAL 14 DAY)
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-event-pegawai-delegasi-keluar-belum-kirim",
    name: "Event Pegawai - Delegasi Keluar Belum Terkirim",
    category: "employee",
    description: "Mengambil delegasi keluar yang belum terkirim atau status kirimnya belum selesai.",
    outputColumns: [...EMPLOYEE_OUTPUT_COLUMNS, "file_name", "file_type", "file_path"],
    sqlText: `
SELECT
  'Kepaniteraan' AS target_unit,
  'Kepaniteraan' AS nama_pegawai,
  dk.nomor_perkara,
  'Delegasi keluar belum terkirim' AS judul_notifikasi,
  1 AS jumlah,
  dk.namadokumen AS file_name,
  dk.document_mime AS file_type,
  dk.namadokumen AS file_path,
  CONCAT('Delegasi keluar perkara ', dk.nomor_perkara, ' ke ', COALESCE(dk.pn_tujuan_text, 'satker tujuan'), ' belum berstatus terkirim.') AS ringkasan,
  COALESCE(dk.diperbaharui_tanggal, dk.diinput_tanggal, dk.tgl_delegasi) AS waktu
FROM delegasi_keluar dk
WHERE COALESCE(CAST(dk.status_kirim AS CHAR), '') NOT IN ('1', 'terkirim', 'TERKIRIM', 'success', 'SUCCESS')
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-event-pegawai-ecourt-kelengkapan-pendaftaran",
    name: "Event Pegawai - e-Court Belum Lengkap",
    category: "employee",
    description: "Mengambil pendaftaran e-Court yang belum memiliki pihak terverifikasi atau masih perlu pemetaan.",
    sqlText: `
SELECT
  'Admin e-Court' AS target_unit,
  'Admin e-Court' AS nama_pegawai,
  eap.efiling_id AS nomor_perkara,
  'Kelengkapan e-Court perlu dicek' AS judul_notifikasi,
  COUNT(ep.ecourt_pihak_id) AS jumlah,
  CONCAT('Pendaftaran e-Court ', eap.efiling_id, ' belum lengkap atau belum memiliki pihak terverifikasi.') AS ringkasan,
  MAX(COALESCE(eap.diperbaharui_tanggal, eap.diinput_tanggal)) AS waktu
FROM ecourt_antrian_pendaftaran eap
LEFT JOIN ecourt_pihak ep ON ep.efiling_id = eap.efiling_id AND ep.verifikasi_pihak = 1
GROUP BY eap.efiling_id
HAVING COUNT(ep.ecourt_pihak_id) = 0
ORDER BY waktu DESC
LIMIT 200`,
  }),
  source({
    id: "sipp-event-reminder-hakim-sidang-besok",
    name: "Reminder Internal - Hakim Sidang Besok",
    category: "employee",
    description: "Pengingat internal untuk hakim yang memiliki jadwal sidang besok.",
    sqlText: `
SELECT
  'Hakim' AS target_unit,
  h.hakim_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Besok ada sidang perkara ', p.nomor_perkara, ' dengan agenda ', COALESCE(s.agenda, '-'), ' di ', COALESCE(s.ruangan, '-'), '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY h.hakim_nama, p.nomor_perkara, s.agenda, s.ruangan, s.tanggal_sidang
ORDER BY h.hakim_nama, s.tanggal_sidang
LIMIT 300`,
  }),
  source({
    id: "sipp-event-reminder-panitera-sidang-hari-ini",
    name: "Reminder Internal - Panitera Sidang Hari Ini",
    category: "employee",
    description: "Pengingat internal untuk panitera pengganti yang memiliki sidang hari ini.",
    sqlText: `
SELECT
  'Panitera Pengganti' AS target_unit,
  pp.panitera_nama AS nama_pegawai,
  p.nomor_perkara,
  'Jadwal sidang hari ini' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Hari ini ada sidang perkara ', p.nomor_perkara, ' dengan agenda ', COALESCE(s.agenda, '-'), ' di ', COALESCE(s.ruangan, '-'), '.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_panitera_pn pp ON pp.perkara_id = p.perkara_id AND pp.aktif = 'Y'
WHERE s.tanggal_sidang = CURDATE()
GROUP BY pp.panitera_nama, p.nomor_perkara, s.agenda, s.ruangan, s.tanggal_sidang
ORDER BY pp.panitera_nama, s.tanggal_sidang
LIMIT 300`,
  }),
  source({
    id: "sipp-event-reminder-jurusita-panggilan-besok",
    name: "Reminder Internal - Jurusita Panggilan Besok",
    category: "employee",
    description: "Pengingat internal untuk jurusita atas jadwal sidang besok yang dokumen panggilannya perlu dipastikan.",
    sqlText: `
SELECT
  'Jurusita' AS target_unit,
  j.jurusita_nama AS nama_pegawai,
  p.nomor_perkara,
  'Pengingat panggilan sidang besok' AS judul_notifikasi,
  COUNT(*) AS jumlah,
  CONCAT('Besok ada sidang perkara ', p.nomor_perkara, '. Mohon pastikan panggilan/pemberitahuan dan dokumen terkait sudah siap.') AS ringkasan,
  s.tanggal_sidang AS waktu
FROM perkara_jadwal_sidang s
JOIN perkara p ON p.perkara_id = s.perkara_id
JOIN perkara_jurusita j ON j.perkara_id = p.perkara_id AND j.aktif = 'Y'
WHERE s.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
GROUP BY j.jurusita_nama, p.nomor_perkara, s.tanggal_sidang
ORDER BY j.jurusita_nama, s.tanggal_sidang
LIMIT 300`,
  }),
];

SIPP_ADDITIONAL_QUERY_DEFINITIONS.push(
  ...PARTY_FOLLOWUP_QUERY_DEFINITIONS,
  ...EMPLOYEE_FOLLOWUP_QUERY_DEFINITIONS,
  ...IMPORTANT_EVENT_QUERY_DEFINITIONS
);
