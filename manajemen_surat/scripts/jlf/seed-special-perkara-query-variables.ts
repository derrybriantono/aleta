import { createAletaDatabase } from "../../src/server/db/client";
import { resolveJlfVariableQueryPreview } from "../../src/lib/judicia-legal-form-query-preview";

const SPECIAL_PATTERNS = [
  { sourceKey: "derived.penyebutan_pihak1", keyPart: "penyebutan_pihak1", label: "Penyebutan Penggugat/Pemohon atau Para Penggugat/Para Pemohon" },
  { sourceKey: "derived.penyebutan_pihak2", keyPart: "penyebutan_pihak2", label: "Penyebutan Tergugat/Termohon atau Para Tergugat/Para Termohon" },
  { sourceKey: "derived.pertimbangan_pmh", keyPart: "format_pertimbangan_pmh", label: "Format Pertimbangan PMH Majelis/Tunggal/e-Court" },
  { sourceKey: "derived.status_ecourt", keyPart: "status_ecourt", label: "Status Redaksi e-Court Perkara" },
  { sourceKey: "derived.redaksi_ecourt", keyPart: "redaksi_ecourt", label: "Redaksi Pendaftaran e-Court" },
  { sourceKey: "kuasa.penggugat.1.tanggal_kuasa", keyPart: "kuasa_penggugat_tanggal_kuasa", label: "Tanggal Kuasa Penggugat/Pemohon" },
  { sourceKey: "kuasa.penggugat.1.nomor_kuasa", keyPart: "kuasa_penggugat_nomor_kuasa", label: "Nomor Kuasa Penggugat/Pemohon" },
  { sourceKey: "kuasa.tergugat.1.tanggal_kuasa", keyPart: "kuasa_tergugat_tanggal_kuasa", label: "Tanggal Kuasa Tergugat/Termohon" },
  { sourceKey: "kuasa.tergugat.1.nomor_kuasa", keyPart: "kuasa_tergugat_nomor_kuasa", label: "Nomor Kuasa Tergugat/Termohon" },
  { sourceKey: "mediasi.hasil_mediasi", keyPart: "hasil_mediasi", label: "Hasil Mediasi Perkara" },
  { sourceKey: "pernikahan.nomor_kutipan_akta_nikah", keyPart: "nomor_kutipan_akta_nikah", label: "Nomor Kutipan Akta Nikah" },
  { sourceKey: "pernikahan.tanggal_nikah", keyPart: "tanggal_nikah", label: "Tanggal Nikah" },
];

function pad(value: number) {
  return String(value).padStart(4, "0");
}

async function main() {
  const db = await createAletaDatabase({ seed: false, runMigrations: false });
  const now = new Date().toISOString();
  let stored = 0;

  try {
    for (let index = 1; index <= 120; index += 1) {
      const pattern = SPECIAL_PATTERNS[(index - 1) % SPECIAL_PATTERNS.length];
      const sourceKey = pattern.sourceKey.startsWith("derived.")
        ? `${pattern.sourceKey}.${index}`
        : pattern.sourceKey.replace(".1.", `.${((index - 1) % 5) + 1}.`);
      const key = `jlf_extra_perkara_derived_${pad(index)}_${pattern.keyPart}`;
      const preview = resolveJlfVariableQueryPreview({
        sourceType: "sipp_perkara",
        sourceKey,
        key,
        adminNote: "Variabel derived khusus perkara. Redaksi hukum wajib direview manusia sebelum dipakai production.",
      });
      const status = preview.sqlPreview?.includes("needs_review") ? "needs_review" : preview.status;

      await db.prepare(
        `INSERT INTO jlf_variables (
           id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
           fallback_value, is_required, is_active, example_value, admin_note,
           sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key, sipp_query_preview_generated_at,
           created_by, updated_by, created_at, updated_at
         ) VALUES (?, NULL, ?, ?, ?, ?, 'sipp_perkara', ?, ?, '', 0, 1, '', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
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
        `jlf-var-extra-perkara-derived-${pad(index)}`,
        key,
        `${pattern.label} - Varian ${index}`,
        "Variabel derived tambahan dari konsep ABT yang disesuaikan untuk ALETA Judicia Legal Form.",
        sourceKey.includes("tanggal") ? "date" : "long_text",
        sourceKey,
        sourceKey.includes("tanggal") ? "tanggal_indonesia_panjang" : "",
        "Variabel derived khusus perkara. Output adalah bahan template dan wajib direview manusia.",
        preview.sqlPreview ?? "",
        status,
        preview.queryKey ?? "",
        now,
        now,
        now
      );
      stored += 1;
    }

    console.log(JSON.stringify({ stored, generatedAt: now }, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[JLF] Gagal seed variabel derived perkara.", error);
  process.exit(1);
});
