import { type QueryResultRow } from "pg";

import { canCreateIncomingLetter, canCreateOutgoingLetter } from "@/lib/permissions";
import { letterClassificationCatalog } from "@/lib/letter-taxonomy";
import { type LetterDetail, type WhatsAppDeliveryStatus } from "@/lib/types";
import { type AletaDatabase, type SqlInputValue, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { parseJsonArray, stringifyJson, toBooleanInt } from "@/server/shared/json";
import { getDispositionByIdFromDb } from "@/server/modules/dispositions/service";
import { requireActorUser, resolveTargetRecipientFromDb } from "@/server/modules/organization/service";
import { sendDispositionNotification, sendLetterNotification } from "@/server/modules/whatsapp/delivery";

type LetterRow = QueryResultRow & {
  id: string;
  type: LetterDetail["type"];
  nomor_surat: string;
  nomor_urut: string | null;
  tanggal_surat: string;
  tanggal_terima: string | null;
  tanggal_kirim: string | null;
  tanggal_administratif: string | null;
  pengirim: string;
  perihal: string;
  status: string;
  assigned_unit: string;
  confidentiality: LetterDetail["confidentiality"];
  current_disposition_id: string | null;
  ringkasan: string;
  asal_surat: string;
  tujuan_surat: string;
  klasifikasi_utama: string;
  kode_klasifikasi: string | null;
  lampiran_json: string;
  tags_json: string;
  klasifikasi_tags_json: string;
  viewer_mode: LetterDetail["viewerMode"];
  qr_code_label: string;
  document_aspect_ratio: number | null;
  document_file_name: string | null;
  document_size_mb: number | null;
  document_text_extract: string | null;
  document_file_path: string | null;
  target_position_id: string | null;
  target_user_id: string | null;
  created_by_user_id: string | null;
  deleted_at: string | null;
};

type DeliveryRow = QueryResultRow & {
  id: string;
  parent_id: string;
  recipient_name: string;
  recipient_whatsapp: string;
  status: WhatsAppDeliveryStatus;
  last_attempt_at: string;
};

export type CreateLetterRequest = {
  actorUserId: string;
  type: LetterDetail["type"];
  nomorUrut: string;
  nomorSurat: string;
  tanggalSurat: string;
  tanggal?: string; // Fallback alias dari frontend
  tanggalTerima?: string | null;
  tanggalKirim?: string | null;
  tanggalAdministratif?: string | null;
  pengirim: string;
  perihal: string;
  assignedUnit: string;
  confidentiality: LetterDetail["confidentiality"];
  kodeKlasifikasi?: string;
  klasifikasi?: string;
  klasifikasiTags: string[];
  ringkasan: string;
  asalSurat: string;
  tujuanSurat: string;
  lampiran: string[];
  tags: string[];
  viewerMode: LetterDetail["viewerMode"];
  targetPositionId: string;
  targetUserId?: string | null;
  documentAspectRatio?: number | null;
  documentFileName?: string | null;
  documentSizeMb?: number | null;
  documentTextExtract?: string | null;
  documentFilePath?: string | null;
  aiGenerated?: boolean;
};

export type UpdateLetterRequest = Partial<Omit<CreateLetterRequest, "actorUserId" | "type">> & {
  actorUserId: string;
  letterId: string;
};

export type LetterSearchFilters = {
  query?: string;
  type?: string;
  status?: string;
  year?: string;
  month?: string;
  quarter?: string;
  origin?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  classificationTags?: string[];
  includeDeleted?: boolean;
  limit?: number;
};

function placeholders(values: readonly SqlInputValue[]) {
  return values.map(() => "?").join(", ");
}

function buildSearchDocument(input: {
  nomorSurat: string;
  nomorUrut?: string | null;
  pengirim: string;
  perihal: string;
  asalSurat: string;
  tujuanSurat: string;
  klasifikasi?: string;
  kodeKlasifikasi?: string;
  ringkasan: string;
  tags: string[];
  klasifikasiTags: string[];
  lampiran: string[];
}) {
  return [
    input.perihal,
    input.nomorSurat,
    input.nomorUrut ?? "",
    input.pengirim,
    input.asalSurat,
    input.tujuanSurat,
    input.klasifikasi ?? "",
    input.kodeKlasifikasi ?? "",
    input.ringkasan,
    ...input.tags,
    ...input.klasifikasiTags,
    ...input.lampiran,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function hydrateLetters(db: AletaDatabase, rows: LetterRow[]) {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const params = placeholders(ids);

  const tagRows = await db.prepare(
    `SELECT letter_id, tag_value
     FROM letter_tags
     WHERE letter_id IN (${params})
     ORDER BY tag_value ASC`
  ).all<{ letter_id: string; tag_value: string }>(...ids);
  const classificationTagRows = await db.prepare(
    `SELECT letter_id, tag_value
     FROM letter_classification_tags
     WHERE letter_id IN (${params})
     ORDER BY tag_value ASC`
  ).all<{ letter_id: string; tag_value: string }>(...ids);
  const attachmentRows = await db.prepare(
    `SELECT letter_id, file_name
     FROM letter_attachments
     WHERE letter_id IN (${params})
     ORDER BY file_name ASC`
  ).all<{ letter_id: string; file_name: string }>(...ids);
  const deliveryRows = await db.prepare(
    `SELECT id, letter_id AS parent_id, recipient_name, recipient_whatsapp, status, last_attempt_at
     FROM letter_whatsapp_deliveries
     WHERE deleted_at IS NULL AND letter_id IN (${params})
     ORDER BY last_attempt_at ASC`
  ).all<DeliveryRow>(...ids);

  const creatorIds = Array.from(new Set(rows.map((row) => row.created_by_user_id).filter(Boolean))) as string[];
  const creatorParams = placeholders(creatorIds);
  const creatorRows = creatorIds.length > 0
    ? await db.prepare(`SELECT id, name FROM users WHERE id IN (${creatorParams})`).all<{ id: string; name: string }>(...creatorIds)
    : [];

  const tagsByLetter = tagRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.tag_value]);
    return map;
  }, new Map());
  const classificationTagsByLetter = classificationTagRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.tag_value]);
    return map;
  }, new Map());
  const attachmentsByLetter = attachmentRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.file_name]);
    return map;
  }, new Map());
  const deliveriesByLetter = deliveryRows.reduce<Map<string, LetterDetail["whatsappDeliveries"]>>((map, row) => {
    map.set(row.parent_id, [
      ...(map.get(row.parent_id) ?? []),
      {
        id: row.id,
        recipientName: row.recipient_name,
        recipientWhatsapp: row.recipient_whatsapp,
        status: row.status,
        lastAttemptAt: row.last_attempt_at,
      },
    ]);
    return map;
  }, new Map());
  const creatorMap = new Map(creatorRows.map((u) => [u.id, u.name]));

  return rows.map<LetterDetail>((row) => ({
    id: row.id,
    type: row.type,
    nomorSurat: row.nomor_surat,
    nomorUrut: row.nomor_urut ?? undefined,
    tanggal: row.tanggal_surat,
    tanggalAdministratif: row.tanggal_administratif ?? undefined,
    pengirim: row.pengirim,
    perihal: row.perihal,
    status: row.status as LetterDetail["status"],
    assignedUnit: row.assigned_unit,
    confidentiality: row.confidentiality,
    currentDispositionId: row.current_disposition_id ?? "",
    tags: tagsByLetter.get(row.id) ?? parseJsonArray<string>(row.tags_json),
    ringkasan: row.ringkasan,
    asalSurat: row.asal_surat,
    tujuanSurat: row.tujuan_surat,
    klasifikasi: row.klasifikasi_utama,
    lampiran: attachmentsByLetter.get(row.id) ?? parseJsonArray<string>(row.lampiran_json),
    viewerMode: row.viewer_mode,
    qrCodeLabel: row.qr_code_label,
    documentAspectRatio: row.document_aspect_ratio ?? undefined,
    documentFileName: row.document_file_name ?? undefined,
    documentSizeMb: row.document_size_mb ?? undefined,
    documentUrl: row.document_file_path ?? undefined,
    documentTextExtract: row.document_text_extract ?? undefined,
    kodeKlasifikasi: row.kode_klasifikasi ?? undefined,
    klasifikasiTags:
      classificationTagsByLetter.get(row.id) ?? parseJsonArray<string>(row.klasifikasi_tags_json),
    targetPositionId: row.target_position_id ?? undefined,
    targetUserId: row.target_user_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByUserName: row.created_by_user_id ? creatorMap.get(row.created_by_user_id) : undefined,
    whatsappDeliveries: deliveriesByLetter.get(row.id) ?? [],
    deletedState: row.deleted_at
      ? {
          deletedAt: row.deleted_at,
          deletedByUserId: "",
          deletedMode: "soft",
        }
      : undefined,
  }));
}

async function insertLetterCollections(
  db: AletaDatabase,
  letterId: string,
  {
    tags,
    classificationTags,
    lampiran,
  }: {
    tags: string[];
    classificationTags: string[];
    lampiran: string[];
  }
) {
  for (const tag of Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean)))) {
    await db.prepare("INSERT INTO letter_tags (letter_id, tag_value) VALUES (?, ?)").run(letterId, tag);
  }

  for (const tag of Array.from(
    new Set(classificationTags.map((item) => item.trim()).filter(Boolean))
  )) {
    await db
      .prepare("INSERT INTO letter_classification_tags (letter_id, tag_value) VALUES (?, ?)")
      .run(letterId, tag);
  }

  for (const attachment of Array.from(
    new Set(lampiran.map((item) => item.trim()).filter(Boolean))
  )) {
    await db.prepare("INSERT INTO letter_attachments (letter_id, file_name) VALUES (?, ?)").run(
      letterId,
      attachment
    );
  }
}

async function syncLetterSearchIndex(db: AletaDatabase, letterId: string, searchText: string) {
  await db.prepare(
    `UPDATE letters
     SET search_document = ?
     WHERE id = ?`
  ).run(searchText, letterId);
}

function buildSearchQuery(db: AletaDatabase, filters: LetterSearchFilters) {
  const clauses = [filters.includeDeleted ? "1 = 1" : "letters.deleted_at IS NULL"];
  const params: SqlInputValue[] = [];
  const referenceDate = "COALESCE(letters.tanggal_administratif, letters.tanggal_terima, letters.tanggal_kirim, letters.tanggal_surat)";

  if (filters.type && filters.type !== "Semua") {
    clauses.push("letters.type = ?");
    params.push(filters.type);
  }

  if (filters.status && filters.status !== "Semua") {
    clauses.push("letters.status = ?");
    params.push(filters.status);
  }

  if (filters.origin && filters.origin !== "Semua") {
    clauses.push("letters.asal_surat = ?");
    params.push(filters.origin);
  }

  if (filters.code && filters.code !== "Semua") {
    clauses.push("letters.kode_klasifikasi = ?");
    params.push(filters.code);
  }

  if (filters.year && filters.year !== "Semua") {
    clauses.push(`SUBSTRING(${referenceDate} FROM 1 FOR 4) = ?`);
    params.push(filters.year);
  }

  if (filters.month && filters.month !== "Semua") {
    clauses.push(`SUBSTRING(${referenceDate} FROM 6 FOR 2) = ?`);
    params.push(filters.month.padStart(2, "0"));
  }

  if (filters.quarter && filters.quarter !== "Semua") {
    const quarterMonths =
      filters.quarter === "TW 1"
        ? ["01", "02", "03"]
        : filters.quarter === "TW 2"
          ? ["04", "05", "06"]
          : filters.quarter === "TW 3"
            ? ["07", "08", "09"]
            : ["10", "11", "12"];
    clauses.push(
      `SUBSTRING(${referenceDate} FROM 6 FOR 2) IN (${placeholders(
        quarterMonths
      )})`
    );
    params.push(...quarterMonths);
  }

  if (filters.dateFrom) {
    clauses.push(`${referenceDate} >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`${referenceDate} <= ?`);
    params.push(filters.dateTo);
  }

  const tags = (filters.tags ?? []).filter(Boolean);
  if (tags.length > 0) {
    clauses.push(
      `letters.id IN (
        SELECT lt.letter_id
        FROM letter_tags lt
        WHERE lt.tag_value IN (${placeholders(tags)})
      )`
    );
    params.push(...tags);
  }

  const classificationTags = (filters.classificationTags ?? []).filter(Boolean);
  if (classificationTags.length > 0) {
    clauses.push(
      `letters.id IN (
        SELECT lct.letter_id
        FROM letter_classification_tags lct
        WHERE lct.tag_value IN (${placeholders(classificationTags)})
      )`
    );
    params.push(...classificationTags);
  }

  if (filters.query?.trim()) {
    if (db.supportsFullTextSearch()) {
      clauses.push("to_tsvector('simple', letters.search_document) @@ websearch_to_tsquery('simple', ?)");
      params.push(filters.query.trim());
    } else {
      const normalizedQuery = filters.query.trim().toLowerCase();
      clauses.push("LOWER(letters.search_document) LIKE ?");
      params.push(`%${normalizedQuery}%`);
    }
  }

  return {
    whereClause: clauses.join(" AND "),
    params,
  };
}

export async function getLetterByIdFromDb(
  db: AletaDatabase,
  letterId: string,
  options?: { includeDeleted?: boolean }
) {
  const row = await db.prepare(
    `SELECT *
     FROM letters
     WHERE id = ?
       AND (${options?.includeDeleted ? "1 = 1" : "deleted_at IS NULL"})`
  ).get<LetterRow>(letterId);

  return row ? (await hydrateLetters(db, [row]))[0] ?? null : null;
}

export async function searchLettersInDb(db: AletaDatabase, filters: LetterSearchFilters = {}) {
  const { whereClause, params } = buildSearchQuery(db, filters);
  const limit = Number.isFinite(filters.limit) ? Number(filters.limit) : 100;
  const rows = await db.prepare(
    `SELECT *
     FROM letters
     WHERE ${whereClause}
     ORDER BY COALESCE(tanggal_administratif, tanggal_terima, tanggal_kirim, tanggal_surat) DESC
     LIMIT ?`
  ).all<LetterRow>(...params, limit);

  return hydrateLetters(db, rows);
}

async function ensureClassificationExists(db: AletaDatabase, code: string) {
  if (!code.trim()) return;

  const existing = await db
    .prepare("SELECT code FROM classification_catalog WHERE code = ?")
    .get<{ code: string }>(code);

  if (existing) return;

  const catalogEntry = letterClassificationCatalog.find((item) => item.value === code);
  if (!catalogEntry) return;

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO classification_catalog (
        code, label, category, keywords_json, is_system, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      catalogEntry.value,
      catalogEntry.label,
      catalogEntry.category,
      stringifyJson(catalogEntry.keywords),
      1,
      now,
      now
    );
}

async function ensureOriginReferenceExists(db: AletaDatabase, originLabel: string) {
  const normalizedOrigin = originLabel.trim();
  if (!normalizedOrigin) return;

  const existing = await db
    .prepare("SELECT id FROM letter_origin_references WHERE LOWER(label) = LOWER(?)")
    .get<{ id: string }>(normalizedOrigin);

  if (existing) return;

  const now = new Date().toISOString();
  const originId = await nextPrefixedId(db, "letter_origin_references", "origin");
  await db.prepare(
    `INSERT INTO letter_origin_references (id, label, created_at)
     VALUES (?, ?, ?)`
  ).run(originId, normalizedOrigin, now);
}

export async function createLetterInDb(db: AletaDatabase, input: CreateLetterRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const canCreate =
    input.type === "masuk" ? canCreateIncomingLetter(actor) : canCreateOutgoingLetter(actor);

  if (!canCreate) {
    throw new ApiError(403, "Role aktif tidak memiliki izin untuk menambah surat pada tipe ini.");
  }

  if (!input.nomorUrut.trim() || !input.nomorSurat.trim() || !input.perihal.trim()) {
    throw new ApiError(400, "Nomor urut, nomor surat, dan perihal wajib diisi.");
  }

  const recipient = await resolveTargetRecipientFromDb(db, {
    targetPositionId: input.targetPositionId,
    targetUserId: input.targetUserId,
  });
  const now = new Date().toISOString();
  const tanggalSurat = input.tanggalSurat || input.tanggal;
  if (!tanggalSurat) {
    throw new ApiError(400, "Tanggal surat wajib diisi.");
  }

  const tanggalAdministratif =
    input.tanggalAdministratif ??
    (input.type === "masuk" ? input.tanggalTerima : input.tanggalKirim) ??
    tanggalSurat;
  const rootStatus = "Riwayat Awal Disposisi";
  const rootInstruction = input.aiGenerated
    ? "Riwayat awal disposisi dibuat dari draft AI yang sudah diverifikasi pengguna sebelum disimpan."
    : "Riwayat awal disposisi dibuat saat registrasi surat oleh petugas.";
  const qrCodeLabel = `Validasi internal ${actor.name} - ${new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(tanggalSurat))}`;

  await ensureClassificationExists(db, input.kodeKlasifikasi?.trim() ?? "");
  await ensureOriginReferenceExists(db, input.asalSurat);

  return withTransaction(db, async (tx) => {
    const letterId = await nextPrefixedId(tx, "letters", "srt");
    const rootDispositionId = await nextPrefixedId(tx, "dispositions", "dsp");
    const deliveryId = await nextPrefixedId(tx, "letter_whatsapp_deliveries", "wa-letter");
    const rootDeliveryId = await nextPrefixedId(tx, "disposition_whatsapp_deliveries", "wa-dsp");
    const searchDocument = buildSearchDocument({
      nomorSurat: input.nomorSurat,
      nomorUrut: input.nomorUrut,
      pengirim: input.pengirim,
      perihal: input.perihal,
      asalSurat: input.asalSurat,
      tujuanSurat: input.tujuanSurat,
      klasifikasi: input.klasifikasi,
      kodeKlasifikasi: input.kodeKlasifikasi,
      ringkasan: input.ringkasan,
      tags: input.tags,
      klasifikasiTags: input.klasifikasiTags,
      lampiran: input.lampiran,
    });

    await tx.prepare(
      `INSERT INTO letters (
        id, type, nomor_surat, nomor_urut, tanggal_surat, tanggal_terima, tanggal_kirim,
        tanggal_administratif, pengirim, perihal, status, assigned_unit, confidentiality,
        current_disposition_id, ringkasan, asal_surat, tujuan_surat, klasifikasi_utama,
        kode_klasifikasi, lampiran_json, tags_json, klasifikasi_tags_json, viewer_mode,
        qr_code_label, document_aspect_ratio, document_file_name, document_size_mb,
        document_text_extract, document_file_path, target_position_id, target_user_id,
        created_by_user_id, search_document, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      letterId,
      input.type,
      input.nomorSurat.trim(),
      input.nomorUrut.trim(),
      tanggalSurat,
      input.type === "masuk" ? input.tanggalTerima ?? tanggalAdministratif : null,
      input.type === "keluar" ? input.tanggalKirim ?? tanggalAdministratif : null,
      tanggalAdministratif,
      input.pengirim.trim(),
      input.perihal.trim(),
      "Dalam Disposisi",
      input.assignedUnit.trim(),
      input.confidentiality,
      rootDispositionId,
      input.ringkasan.trim(),
      input.asalSurat.trim(),
      input.tujuanSurat.trim(),
      input.klasifikasi?.trim() ?? "",
      input.kodeKlasifikasi?.trim() || null,
      stringifyJson(input.lampiran),
      stringifyJson(input.tags),
      stringifyJson(input.klasifikasiTags),
      input.viewerMode,
      qrCodeLabel,
      input.documentAspectRatio ?? 210 / 297,
      input.documentFileName ?? null,
      input.documentSizeMb ?? null,
      input.documentTextExtract ?? null,
      input.documentFilePath ?? null,
      input.targetPositionId,
      recipient.id,
      actor.id,
      searchDocument,
      null,
      now,
      now
    );

    await insertLetterCollections(tx, letterId, {
      tags: input.tags,
      classificationTags: input.klasifikasiTags,
      lampiran: input.lampiran,
    });

    await tx.prepare(
      `INSERT INTO letter_whatsapp_deliveries (
        id, letter_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      deliveryId,
      letterId,
      recipient.name,
      recipient.whatsappNumber,
      "Terkirim",
      now,
      null,
      now,
      now
    );

    await sendLetterNotification(tx, {
      letterId,
      deliveryId,
    });

    await tx.prepare(
      `INSERT INTO dispositions (
        id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi,
        parent_disposition_id, status, allow_download, approval_qr_code, created_at,
        urgent, bypass, routing_type, follow_up_note, follow_up_file_name, deleted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      rootDispositionId,
      letterId,
      actor.id,
      recipient.id,
      input.targetPositionId,
      rootInstruction,
      null,
      rootStatus,
      toBooleanInt(input.viewerMode === "download"),
      `QR-${rootDispositionId.toUpperCase()}`,
      now,
      toBooleanInt(input.confidentiality !== "Biasa"),
      0,
      "standard",
      null,
      null,
      null,
      now
    );

    await tx.prepare(
      `INSERT INTO disposition_whatsapp_deliveries (
        id, disposition_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      rootDeliveryId,
      rootDispositionId,
      recipient.name,
      recipient.whatsappNumber,
      "Terkirim",
      now,
      null,
      now,
      now
    );

    await sendDispositionNotification(tx, {
      dispositionId: rootDispositionId,
      deliveryId: rootDeliveryId,
    });

    await syncLetterSearchIndex(tx, letterId, searchDocument);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_LETTER",
      entityType: "letter",
      entityId: letterId,
      payload: {
        type: input.type,
        nomorSurat: input.nomorSurat,
        targetPositionId: input.targetPositionId,
        targetUserId: recipient.id,
        initialDispositionId: rootDispositionId,
      },
    });

    const letter = await getLetterByIdFromDb(tx, letterId);
    const initialDisposition = await getDispositionByIdFromDb(tx, rootDispositionId);
    if (!letter) {
      throw new ApiError(500, "Surat berhasil dibuat tetapi gagal diambil kembali dari database.");
    }

    return {
      letter,
      initialDisposition,
    };
  });
}

export async function updateLetterInDb(db: AletaDatabase, input: UpdateLetterRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const existing = await getLetterByIdFromDb(db, input.letterId);

  if (!existing) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  if (
    actor.roleId !== "admin" &&
    actor.roleId !== "super-admin" &&
    existing.createdByUserId !== actor.id
  ) {
    throw new ApiError(403, "Anda tidak memiliki izin untuk mengedit surat ini.");
  }

  const now = new Date().toISOString();

  if (input.kodeKlasifikasi !== undefined) {
    await ensureClassificationExists(db, input.kodeKlasifikasi.trim());
  }
  if (input.asalSurat !== undefined) {
    await ensureOriginReferenceExists(db, input.asalSurat);
  }

  return withTransaction(db, async (tx) => {
    const updates: Record<string, SqlInputValue> = {
      updated_at: now,
    };

    if (input.nomorSurat !== undefined) updates.nomor_surat = input.nomorSurat.trim();
    if (input.nomorUrut !== undefined) updates.nomor_urut = input.nomorUrut.trim();
    if (input.tanggalSurat !== undefined || input.tanggal !== undefined) {
      updates.tanggal_surat = input.tanggalSurat || input.tanggal || existing.tanggal;
    }
    if (input.tanggalAdministratif !== undefined)
      updates.tanggal_administratif = input.tanggalAdministratif;
    if (input.pengirim !== undefined) updates.pengirim = input.pengirim.trim();
    if (input.perihal !== undefined) updates.perihal = input.perihal.trim();
    if (input.assignedUnit !== undefined) updates.assigned_unit = input.assignedUnit.trim();
    if (input.confidentiality !== undefined) updates.confidentiality = input.confidentiality;
    if (input.asalSurat !== undefined) updates.asal_surat = input.asalSurat.trim();
    if (input.tujuanSurat !== undefined) updates.tujuan_surat = input.tujuanSurat.trim();
    if (input.klasifikasi !== undefined) updates.klasifikasi_utama = input.klasifikasi.trim();
    if (input.kodeKlasifikasi !== undefined) updates.kode_klasifikasi = input.kodeKlasifikasi.trim() || null;
    if (input.ringkasan !== undefined) updates.ringkasan = input.ringkasan.trim();
    if (input.viewerMode !== undefined) updates.viewer_mode = input.viewerMode;
    if (input.documentFilePath !== undefined) updates.document_file_path = input.documentFilePath;
    if (input.documentFileName !== undefined) updates.document_file_name = input.documentFileName;
    if (input.documentSizeMb !== undefined) updates.document_size_mb = input.documentSizeMb;
    if (input.documentTextExtract !== undefined)
      updates.document_text_extract = input.documentTextExtract;

    if (input.tags !== undefined) updates.tags_json = stringifyJson(input.tags);
    if (input.klasifikasiTags !== undefined)
      updates.klasifikasi_tags_json = stringifyJson(input.klasifikasiTags);
    if (input.lampiran !== undefined) updates.lampiran_json = stringifyJson(input.lampiran);

    const keys = Object.keys(updates);
    const sql = `UPDATE letters SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    const params = [...Object.values(updates), input.letterId];

    await tx.prepare(sql).run(...params);

    if (
      input.tags !== undefined ||
      input.klasifikasiTags !== undefined ||
      input.lampiran !== undefined
    ) {
      if (input.tags !== undefined)
        await tx.prepare("DELETE FROM letter_tags WHERE letter_id = ?").run(input.letterId);
      if (input.klasifikasiTags !== undefined)
        await tx
          .prepare("DELETE FROM letter_classification_tags WHERE letter_id = ?")
          .run(input.letterId);
      if (input.lampiran !== undefined)
        await tx.prepare("DELETE FROM letter_attachments WHERE letter_id = ?").run(input.letterId);

      await insertLetterCollections(tx, input.letterId, {
        tags: input.tags ?? existing.tags ?? [],
        classificationTags: input.klasifikasiTags ?? existing.klasifikasiTags ?? [],
        lampiran: input.lampiran ?? existing.lampiran ?? [],
      });
    }

    const updated = await getLetterByIdFromDb(tx, input.letterId);
    if (updated) {
      const searchDocument = buildSearchDocument({
        nomorSurat: updated.nomorSurat,
        nomorUrut: updated.nomorUrut ?? null,
        pengirim: updated.pengirim,
        perihal: updated.perihal,
        asalSurat: updated.asalSurat,
        tujuanSurat: updated.tujuanSurat,
        klasifikasi: updated.klasifikasi,
        kodeKlasifikasi: updated.kodeKlasifikasi ?? "",
        ringkasan: updated.ringkasan,
        tags: updated.tags,
        klasifikasiTags: updated.klasifikasiTags ?? [],
        lampiran: updated.lampiran,
      });
      await syncLetterSearchIndex(tx, input.letterId, searchDocument);
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_LETTER",
      entityType: "letter",
      entityId: input.letterId,
      payload: input,
    });

    return getLetterByIdFromDb(tx, input.letterId);
  });
}

export async function deleteLetterInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterId,
  }: {
    actorUserId: string;
    letterId: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const existing = await db.prepare(
    "SELECT id, deleted_at FROM letters WHERE id = ?"
  ).get<{ id: string; deleted_at: string | null }>(letterId);

  if (!existing) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  const now = new Date().toISOString();

  if (actor.roleId === "super-admin") {
    return withTransaction(db, async (tx) => {
      await tx.prepare("DELETE FROM letters WHERE id = ?").run(letterId);

      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "HARD_DELETE_LETTER",
        entityType: "letter",
        entityId: letterId,
      });

      return { mode: "hard" as const, deletedAt: now };
    });
  }

  if (actor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menghapus surat.");
  }

  return withTransaction(db, async (tx) => {
    await tx.prepare(
      `UPDATE letters
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, letterId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SOFT_DELETE_LETTER",
      entityType: "letter",
      entityId: letterId,
      payload: {
        previousDeletedAt: existing.deleted_at,
      },
    });

    return { mode: "soft" as const, deletedAt: now };
  });
}

export async function getLetterSummaryForStats(db: AletaDatabase, filters: LetterSearchFilters = {}) {
  const { whereClause, params } = buildSearchQuery(db, filters);

  return db.prepare(
    `SELECT id, type, status, asal_surat, klasifikasi_utama, kode_klasifikasi,
      COALESCE(tanggal_administratif, tanggal_terima, tanggal_kirim, tanggal_surat) AS tanggal_ref
     FROM letters
     WHERE ${whereClause}`
  ).all<{
    id: string;
    type: string;
    status: string;
    asal_surat: string;
    klasifikasi_utama: string;
    kode_klasifikasi: string | null;
    tanggal_ref: string;
  }>(...params);
}
