import type { AletaDatabase } from "@/server/db/client";
import type { JlfVariableResolution } from "@/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service";
import { stringifyValueForDocument } from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";
import { nextPrefixedId } from "@/server/shared/ids";

export async function saveDocumentVariableSnapshots(
  db: AletaDatabase,
  generatedDocumentId: string,
  variables: JlfVariableResolution[]
) {
  const now = new Date().toISOString();
  for (const variable of variables) {
    const id = await nextPrefixedId(db, "jlf_document_variables_snapshot", "jlf-snap");
    await db.prepare(
      `INSERT INTO jlf_document_variables_snapshot (
        id, generated_document_id, variable_key, placeholder, resolved_value, source_type, warnings, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)`
    ).run(
      id,
      generatedDocumentId,
      variable.key,
      variable.placeholder,
      stringifyValueForDocument(variable.value),
      variable.source,
      JSON.stringify(variable.warnings ?? []),
      now
    );
  }
}

export async function listDocumentVariableSnapshots(db: AletaDatabase, generatedDocumentId: string) {
  const rows = await db.prepare(
    `SELECT id, generated_document_id, variable_key, placeholder, resolved_value, source_type, warnings, created_at
     FROM jlf_document_variables_snapshot
     WHERE generated_document_id = ?
     ORDER BY variable_key ASC`
  ).all<{
    id: string;
    generated_document_id: string;
    variable_key: string;
    placeholder: string;
    resolved_value: string;
    source_type: string;
    warnings: unknown;
    created_at: string;
  }>(generatedDocumentId);

  return rows.map((row) => ({
    id: row.id,
    generatedDocumentId: row.generated_document_id,
    variableKey: row.variable_key,
    placeholder: row.placeholder,
    resolvedValue: row.resolved_value,
    sourceType: row.source_type,
    warnings: row.warnings ?? [],
    createdAt: row.created_at,
  }));
}

export const JlfDocumentSnapshotService = {
  saveDocumentVariableSnapshots,
  listDocumentVariableSnapshots,
};
