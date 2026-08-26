import { createAletaDatabase } from "../../src/server/db/client";
import { resolveJlfVariableQueryPreview } from "../../src/lib/judicia-legal-form-query-preview";

type SeedVariable = {
  key: string;
  label: string;
  description: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey: string;
  adminNote: string;
};

const TARGET_COUNT = 10_000;

const PARTY_ROLES = [
  { key: "penggugat", label: "Penggugat/Pemohon" },
  { key: "tergugat", label: "Tergugat/Termohon" },
  { key: "intervensi", label: "Pihak Intervensi" },
  { key: "turut_tergugat", label: "Turut Tergugat" },
  { key: "saksi", label: "Saksi" },
] as const;

const PARTY_FIELDS = [
  "nama",
  "nama_lengkap",
  "nama_dengan_alias",
  "alamat",
  "alamat_lengkap",
  "identitas_lengkap",
  "identitas_ringkas",
  "jenis_identitas",
  "nomor_identitas",
  "nomor_identitas_masked",
  "agama",
  "telepon_masked",
  "email_masked",
  "umur",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "kelurahan",
  "kecamatan",
  "kabupaten",
  "propinsi",
  "pekerjaan",
  "pendidikan",
  "warga_negara",
  "nama_ayah",
  "nama_ibu",
  "status_kawin",
  "pangkat",
  "jabatan",
  "nrp",
  "keterangan",
  "kondisi_pihak",
  "jenis_saksi",
  "saksi_pihak_ke",
  "kesatuan",
];

const OFFICIAL_SOURCES = [
  { sourceType: "sipp_hakim", role: "hakim", label: "Hakim" },
  { sourceType: "sipp_panitera", role: "panitera", label: "Panitera Pengganti" },
  { sourceType: "sipp_jurusita", role: "jurusita", label: "Jurusita" },
] as const;

const OFFICIAL_FIELDS = [
  "nama",
  "nama_gelar",
  "nip",
  "nip_masked",
  "kode",
  "jabatan",
  "pangkat",
  "tanggal_penetapan",
  "nomor_sk_penetapan",
  "urutan",
  "aktif",
  "keterangan",
];

const HEARING_FIELDS = [
  "sidang_id",
  "sidang_ke",
  "tanggal_sidang",
  "hari_sidang",
  "jam_sidang",
  "agenda",
  "ruangan",
  "dihadiri_oleh",
  "ditunda",
  "alasan_ditunda",
  "sifat_sidang",
  "keterangan_sidang",
];

const SPECIAL_PATTERNS = [
  { sourceKey: "derived.penyebutan_pihak1", keyPart: "penyebutan_pihak1", label: "Penyebutan Penggugat/Pemohon" },
  { sourceKey: "derived.penyebutan_pihak2", keyPart: "penyebutan_pihak2", label: "Penyebutan Tergugat/Termohon" },
  { sourceKey: "derived.status_ecourt", keyPart: "status_ecourt", label: "Status Redaksi e-Court" },
  { sourceKey: "derived.redaksi_ecourt", keyPart: "redaksi_ecourt", label: "Redaksi Pendaftaran e-Court" },
  { sourceKey: "kuasa.penggugat.1.tanggal_kuasa", keyPart: "kuasa_penggugat_tanggal", label: "Tanggal Kuasa Penggugat/Pemohon" },
  { sourceKey: "kuasa.penggugat.1.nomor_kuasa", keyPart: "kuasa_penggugat_nomor", label: "Nomor Kuasa Penggugat/Pemohon" },
  { sourceKey: "kuasa.tergugat.1.tanggal_kuasa", keyPart: "kuasa_tergugat_tanggal", label: "Tanggal Kuasa Tergugat/Termohon" },
  { sourceKey: "kuasa.tergugat.1.nomor_kuasa", keyPart: "kuasa_tergugat_nomor", label: "Nomor Kuasa Tergugat/Termohon" },
  { sourceKey: "mediasi.tanggal_mediasi", keyPart: "mediasi_tanggal", label: "Tanggal Mediasi" },
  { sourceKey: "mediasi.hasil_mediasi", keyPart: "mediasi_hasil", label: "Hasil Mediasi" },
  { sourceKey: "pernikahan.tanggal_nikah", keyPart: "pernikahan_tanggal", label: "Tanggal Nikah" },
  { sourceKey: "pernikahan.nomor_kutipan_akta_nikah", keyPart: "pernikahan_nomor_akta", label: "Nomor Kutipan Akta Nikah" },
];

const DECISION_FIELDS = [
  "tanggal_putusan",
  "amar_putusan",
  "amar_putusan_ringkas",
  "status_putusan_nama",
  "tanggal_minutasi",
  "tanggal_bht",
  "nomor_akta_cerai",
  "tanggal_akta_cerai",
  "nomor_seri_akta_cerai",
  "tanggal_ikrar_talak",
];

const FEE_FIELDS = [
  "panjar_perkara",
  "jumlah_biaya",
  "biaya_panggilan",
  "biaya_pemberitahuan",
  "biaya_meterai",
  "biaya_redaksi",
  "biaya_atk",
  "biaya_pnbp",
  "sisa_biaya",
  "daftar_biaya_perkara",
];

function pad(value: number, length = 5) {
  return String(value).padStart(length, "0");
}

function dataTypeFor(field: string) {
  if (field.includes("tanggal") || field.startsWith("tgl_")) return "date";
  if (field.includes("biaya") || field.includes("panjar") || field.includes("jumlah") || field.includes("sisa")) return "currency";
  if (field.includes("umur") || field === "urutan" || field === "sidang_ke") return "number";
  if (field.includes("identitas_lengkap") || field.includes("alamat_lengkap") || field.includes("amar_putusan") || field.includes("daftar_")) return "long_text";
  return "text";
}

function transformFor(field: string) {
  if (field.includes("tanggal")) return "tanggal_indonesia_panjang";
  if (field.includes("biaya") || field.includes("panjar") || field.includes("jumlah") || field.includes("sisa")) return "rupiah";
  if (field.includes("nama")) return "format_nama_pihak";
  if (field.includes("alamat")) return "format_alamat";
  return "";
}

function variable(keyPart: string, input: Omit<SeedVariable, "key">): SeedVariable {
  return {
    key: `jlf_extra_perkara_${keyPart}`.replace(/[^a-z0-9_]+/gi, "_").toLowerCase(),
    ...input,
  };
}

function buildVariables() {
  const variables: SeedVariable[] = [];

  for (const role of PARTY_ROLES) {
    for (let index = 1; index <= 45; index += 1) {
      for (const field of PARTY_FIELDS) {
        variables.push(
          variable(`${role.key}_${pad(index, 2)}_${field}`, {
            label: `${role.label} ${index} - ${field.replace(/_/g, " ")}`,
            description: `Variabel tambahan JLF untuk mengambil ${field.replace(/_/g, " ")} ${role.label.toLowerCase()} urutan ${index}.`,
            dataType: dataTypeFor(field),
            sourceType: "sipp_pihak",
            sourceKey: `${role.key}.${index}.${field}`,
            transformKey: transformFor(field),
            adminNote: "Seed tambahan terkait perkara. Query preview hanya untuk review admin; eksekusi SIPP tetap melalui adapter read-only.",
          })
        );
      }
    }
  }

  for (const source of OFFICIAL_SOURCES) {
    for (let index = 1; index <= 45; index += 1) {
      for (const field of OFFICIAL_FIELDS) {
        variables.push(
          variable(`${source.role}_${pad(index, 2)}_${field}`, {
            label: `${source.label} ${index} - ${field.replace(/_/g, " ")}`,
            description: `Variabel tambahan JLF untuk ${source.label.toLowerCase()} urutan ${index}.`,
            dataType: dataTypeFor(field),
            sourceType: source.sourceType,
            sourceKey: `${source.role}.${index}.${field}`,
            transformKey: transformFor(field),
            adminNote: "Seed tambahan terkait pejabat perkara. Query preview hanya untuk review admin.",
          })
        );
      }
    }
  }

  for (let index = 1; index <= 35; index += 1) {
    for (const field of HEARING_FIELDS) {
      variables.push(
        variable(`sidang_${pad(index, 2)}_${field}`, {
          label: `Sidang ${index} - ${field.replace(/_/g, " ")}`,
          description: `Variabel tambahan JLF untuk jadwal sidang urutan ${index}.`,
          dataType: dataTypeFor(field),
          sourceType: "sipp_jadwal_sidang",
          sourceKey: `sidang.${index}.${field}`,
          transformKey: transformFor(field),
          adminNote: "Seed tambahan jadwal sidang. User tetap memilih sidang saat generate bila dokumen membutuhkan sidang spesifik.",
        })
      );
    }
  }

  for (let index = 1; index <= 20; index += 1) {
    for (const field of DECISION_FIELDS) {
      variables.push(
        variable(`putusan_${pad(index, 2)}_${field}`, {
          label: `Putusan/Penetapan ${index} - ${field.replace(/_/g, " ")}`,
          description: `Variabel tambahan JLF untuk data putusan/penetapan terkait perkara.`,
          dataType: dataTypeFor(field),
          sourceType: "sipp_putusan",
          sourceKey: `${field}.${index}`,
          transformKey: transformFor(field),
          adminNote: "Seed tambahan putusan/penetapan. Review akses substansi perkara tetap mengikuti permission JLF.",
        })
      );
    }
  }

  for (let index = 1; index <= 15; index += 1) {
    for (const field of FEE_FIELDS) {
      variables.push(
        variable(`biaya_${pad(index, 2)}_${field}`, {
          label: `Biaya Perkara ${index} - ${field.replace(/_/g, " ")}`,
          description: "Variabel tambahan JLF untuk ringkasan biaya perkara.",
          dataType: dataTypeFor(field),
          sourceType: "sipp_keuangan",
          sourceKey: `${field}.${index}`,
          transformKey: transformFor(field),
          adminNote: "Seed tambahan biaya perkara. Tidak membuka akses substansi perkara tanpa permission.",
        })
      );
    }
  }

  for (let index = 1; variables.length < TARGET_COUNT; index += 1) {
    const pattern = SPECIAL_PATTERNS[(index - 1) % SPECIAL_PATTERNS.length];
    const sourceKey = pattern.sourceKey.includes("derived.")
      ? `${pattern.sourceKey}.${index}`
      : pattern.sourceKey.replace(".1.", `.${(index % 5) + 1}.`);
    variables.push(
      variable(`derived_${pad(index, 4)}_${pattern.keyPart}`, {
        label: `${pattern.label} - varian ${index}`,
        description: `Variabel naratif/derived JLF terkait perkara, terinspirasi konsep ABT tetapi memakai registry ALETA Judicia.`,
        dataType: sourceKey.includes("tanggal") ? "date" : "long_text",
        sourceType: "sipp_perkara",
        sourceKey,
        transformKey: sourceKey.includes("tanggal") ? "tanggal_indonesia_panjang" : "",
        adminNote: "Seed derived terkait perkara. Redaksi hukum wajib direview manusia sebelum dipakai production.",
      })
    );
  }

  return variables.slice(0, TARGET_COUNT);
}

async function main() {
  const db = await createAletaDatabase({ seed: false, runMigrations: false });
  const now = new Date().toISOString();
  const variables = buildVariables();
  let stored = 0;
  let needsReview = 0;

  try {
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview TEXT NOT NULL DEFAULT ''");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_status TEXT NOT NULL DEFAULT 'not_generated'");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_key TEXT NOT NULL DEFAULT ''");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_generated_at TEXT");

    for (let index = 0; index < variables.length; index += 1) {
      const item = variables[index];
      const id = `jlf-var-extra-perkara-${pad(index + 1, 5)}`;
      const preview = resolveJlfVariableQueryPreview({
        sourceType: item.sourceType,
        sourceKey: item.sourceKey,
        key: item.key,
        adminNote: item.adminNote,
      });
      const status = preview.sqlPreview?.includes("needs_review") ? "needs_review" : preview.status;
      if (status === "needs_review") needsReview += 1;

      await db.prepare(
        `INSERT INTO jlf_variables (
           id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
           fallback_value, is_required, is_active, example_value, admin_note,
           sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key, sipp_query_preview_generated_at,
           created_by, updated_by, created_at, updated_at
         ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, '', 0, 1, '', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
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
        id,
        item.key,
        item.label,
        item.description,
        item.dataType,
        item.sourceType,
        item.sourceKey,
        item.transformKey,
        item.adminNote,
        preview.sqlPreview ?? "",
        status,
        preview.queryKey ?? "",
        now,
        now,
        now
      );
      stored += 1;
    }

    const totalRow = await db.prepare("SELECT COUNT(*) AS count FROM jlf_variables WHERE key LIKE 'jlf_extra_perkara_%'").get<{ count: string | number }>();
    console.log(
      JSON.stringify(
        {
          requested: TARGET_COUNT,
          stored,
          totalExtraPerkaraVariables: Number(totalRow?.count ?? 0),
          needsReview,
          generatedAt: now,
          note: "Variabel tambahan disimpan ke JLF. Query preview hanya untuk review admin; SIPP tetap read-only melalui adapter.",
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
  console.error("[JLF] Gagal seed variabel perkara tambahan.", error);
  process.exit(1);
});
