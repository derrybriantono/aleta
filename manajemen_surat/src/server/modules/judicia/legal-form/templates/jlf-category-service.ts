import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logTemplateEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { nextPrefixedId } from "@/server/shared/ids";

type CategoryRow = QueryResultRow & {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean | number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    sortOrder: Number(row.sort_order) || 0,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function readCategoryById(db: AletaDatabase, id: string) {
  const row = await db.prepare(
    `SELECT id, name, slug, description, icon, sort_order, is_active, created_by, updated_by, created_at, updated_at, deleted_at
     FROM jlf_categories
     WHERE id = ? AND deleted_at IS NULL`
  ).get<CategoryRow>(id);

  return row ? mapCategory(row) : null;
}

export async function listCategories(db: AletaDatabase, actor: UserPersona, options: { includeInactive?: boolean } = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const rows = await db.prepare(
    `SELECT id, name, slug, description, icon, sort_order, is_active, created_by, updated_by, created_at, updated_at, deleted_at
     FROM jlf_categories
     WHERE deleted_at IS NULL ${options.includeInactive ? "" : "AND is_active = 1"}
     ORDER BY sort_order ASC, name ASC`
  ).all<CategoryRow>();

  return rows.map(mapCategory);
}

export async function createCategory(
  db: AletaDatabase,
  actor: UserPersona,
  input: { name: string; slug?: string; description?: string; icon?: string; sortOrder?: number; isActive?: boolean }
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_CREATE);

  const name = input.name.trim();
  if (!name) jlfBadRequest("Nama kategori wajib diisi.");

  const id = await nextPrefixedId(db, "jlf_categories", "jlf-cat");
  const now = new Date().toISOString();
  const slug = slugify(input.slug || name);
  if (!slug) jlfBadRequest("Slug kategori tidak valid.");

  await db.prepare(
    `INSERT INTO jlf_categories (
      id, name, slug, description, icon, sort_order, is_active, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    slug,
    input.description?.trim() ?? "",
    input.icon?.trim() ?? "book-open-text",
    input.sortOrder ?? 0,
    input.isActive === false ? 0 : 1,
    actor.id,
    actor.id,
    now,
    now
  );

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "CREATE_CATEGORY",
    entityId: id,
    metadata: { name, slug },
  });

  return readCategoryById(db, id);
}

export async function updateCategory(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: { name?: string; slug?: string; description?: string; icon?: string; sortOrder?: number; isActive?: boolean }
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);

  const existing = await readCategoryById(db, id);
  if (!existing) jlfNotFound("Kategori JLF tidak ditemukan.");

  const name = input.name?.trim();
  const slug = input.slug ? slugify(input.slug) : name ? slugify(name) : undefined;
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_categories
     SET name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         description = COALESCE(?, description),
         icon = COALESCE(?, icon),
         sort_order = COALESCE(?, sort_order),
         is_active = COALESCE(?, is_active),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    name || null,
    slug || null,
    input.description?.trim() ?? null,
    input.icon?.trim() ?? null,
    input.sortOrder ?? null,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    actor.id,
    now,
    id
  );

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "UPDATE_CATEGORY",
    entityId: id,
    metadata: { previous: existing, input },
  });

  return readCategoryById(db, id);
}

export async function archiveCategory(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_DELETE);

  const existing = await readCategoryById(db, id);
  if (!existing) jlfNotFound("Kategori JLF tidak ditemukan.");

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_categories
     SET is_active = 0, deleted_at = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(now, actor.id, now, id);

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "ARCHIVE_CATEGORY",
    entityId: id,
    metadata: { name: existing.name },
  });

  return { id, archived: true };
}

export async function reorderCategories(
  db: AletaDatabase,
  actor: UserPersona,
  input: Array<{ id: string; sortOrder: number }>
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);

  const now = new Date().toISOString();
  for (const item of input) {
    await db.prepare(
      `UPDATE jlf_categories
       SET sort_order = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).run(item.sortOrder, actor.id, now, item.id);
  }

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "REORDER_CATEGORIES",
    entityId: "jlf_categories",
    metadata: { count: input.length },
  });

  return listCategories(db, actor, { includeInactive: true });
}

export const JlfCategoryService = {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  reorderCategories,
};
