import { randomUUID } from "node:crypto";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { getJsonSetting, setSetting } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { COMPREHENSIVE_BAS_QA_TEMPLATES } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-seed-catalog";

const BAS_QA_SETTING_KEY = "jlf.bas_qa.templates";

export type JlfBasQaItem = {
  id: string;
  order: number;
  subjectType?: "umum" | "saksi" | "pihak" | "ahli";
  answerMode?: "manual" | "default" | "sipp";
  sourceKey?: string;
  question: string;
  answer: string;
};

export type JlfBasQaTemplate = {
  id: string;
  code: string;
  name: string;
  caseType: string;
  paperSize: string;
  isActive: boolean;
  items: JlfBasQaItem[];
  updatedAt: string;
};

type AuditMeta = { ipAddress?: string; userAgent?: string };

const defaultTemplates: JlfBasQaTemplate[] = COMPREHENSIVE_BAS_QA_TEMPLATES;

function cloneTemplates(templates: JlfBasQaTemplate[]) {
  return templates.map((template) => ({
    ...template,
    items: template.items.map((item) => ({ ...item })),
  }));
}

function nextId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeText(value: unknown, label: string, maxLength: number, required = true) {
  const normalized = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (required && !normalized) jlfBadRequest(`${label} wajib diisi.`);
  if (normalized.length > maxLength) jlfBadRequest(`${label} maksimal ${maxLength} karakter.`);
  return normalized;
}

function normalizeSubjectType(value: unknown): JlfBasQaItem["subjectType"] {
  const normalized = normalizeText(value, "Subjek", 40, false).toLowerCase();
  if (normalized === "saksi" || normalized === "pihak" || normalized === "ahli") return normalized;
  return "umum";
}

function normalizeAnswerMode(value: unknown): JlfBasQaItem["answerMode"] {
  const normalized = normalizeText(value, "Mode jawaban", 40, false).toLowerCase();
  if (normalized === "sipp" || normalized === "default") return normalized;
  return "manual";
}

function inferSubjectType(question: string): JlfBasQaItem["subjectType"] {
  const normalized = question.toLowerCase();
  if (/\bahli\b/.test(normalized)) return "ahli";
  if (/\bsaksi\b/.test(normalized)) return "saksi";
  if (/\bpenggugat\b|\bpemohon\b|\btergugat\b|\btermohon\b|\bpihak\b/.test(normalized)) return "pihak";
  return "umum";
}

function normalizeTemplates(value: unknown): JlfBasQaTemplate[] {
  if (!Array.isArray(value)) return cloneTemplates(defaultTemplates);

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      id: normalizeText(item.id, "ID template", 120),
      code: normalizeText(item.code, "Kode", 40),
      name: normalizeText(item.name, "Nama template", 160),
      caseType: normalizeText(item.caseType, "Jenis perkara", 120, false) || "Umum",
      paperSize: normalizeText(item.paperSize, "Ukuran kertas", 20, false) || "A4",
      isActive: item.isActive !== false,
      updatedAt: normalizeText(item.updatedAt, "Updated at", 80, false) || new Date().toISOString(),
      items: Array.isArray(item.items)
        ? item.items
            .filter((child): child is Record<string, unknown> => Boolean(child) && typeof child === "object" && !Array.isArray(child))
            .map((child, index) => ({
              id: normalizeText(child.id, "ID item", 120),
              order: Number.isFinite(Number(child.order)) ? Number(child.order) : index + 1,
              subjectType: child.subjectType === undefined
                ? inferSubjectType(normalizeText(child.question, "Pertanyaan", 400))
                : normalizeSubjectType(child.subjectType),
              answerMode: normalizeAnswerMode(child.answerMode),
              sourceKey: normalizeText(child.sourceKey, "Source key", 160, false),
              question: normalizeText(child.question, "Pertanyaan", 400),
              answer: normalizeText(child.answer, "Jawaban", 1000, false),
            }))
            .sort((left, right) => left.order - right.order)
            .map((child, index) => ({ ...child, order: index + 1 }))
        : [],
    }));
}

async function readTemplates(db: AletaDatabase) {
  return normalizeTemplates(await getJsonSetting(db, BAS_QA_SETTING_KEY, cloneTemplates(defaultTemplates)));
}

async function writeTemplates(db: AletaDatabase, actor: UserPersona, templates: JlfBasQaTemplate[]) {
  await setSetting(db, BAS_QA_SETTING_KEY, templates, {
    actorUserId: actor.id,
    description: "Template tanya jawab dan struktur BAS JLF.",
  });
}

function findTemplate(templates: JlfBasQaTemplate[], id: string) {
  const template = templates.find((item) => item.id === id);
  if (!template) jlfNotFound("Template Tanya Jawab/BAS tidak ditemukan.");
  return template;
}

function interpolatePlaceholders(text: string, values: Record<string, unknown>) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key] ?? values[key.replace(/\./g, "_")];
    return value === null || value === undefined || String(value).trim() === "" ? match : String(value);
  });
}

function readValuePath(values: Record<string, unknown>, sourceKey: string) {
  if (!sourceKey) return "";
  const direct = values[sourceKey] ?? values[sourceKey.replace(/\./g, "_")];
  if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct);

  let current: unknown = values;
  for (const segment of sourceKey.split(".")) {
    if (!current || typeof current !== "object") return "";
    const record = current as Record<string, unknown>;
    current = record[segment] ?? record[segment.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())];
  }
  return current === undefined || current === null ? "" : String(current);
}

function subjectLabel(subjectType: JlfBasQaItem["subjectType"]) {
  if (subjectType === "saksi") return "Saksi";
  if (subjectType === "pihak") return "Pihak";
  if (subjectType === "ahli") return "Ahli";
  return "";
}

function matchTemplateForSourceKey(templates: JlfBasQaTemplate[], sourceKey: string, caseType?: string) {
  const normalizedKey = sourceKey.trim().toLowerCase();
  const normalizedCaseType = caseType?.trim().toLowerCase();
  const activeTemplates = templates.filter((template) => template.isActive);

  if (normalizedKey) {
    const exact = activeTemplates.find((template) =>
      [template.id, template.code, template.name].some((value) => value.toLowerCase() === normalizedKey)
    );
    if (exact) return exact;
  }

  if (normalizedCaseType) {
    const byCaseType = activeTemplates.find((template) => template.caseType.toLowerCase().includes(normalizedCaseType));
    if (byCaseType) return byCaseType;
  }

  return activeTemplates[0] ?? templates[0] ?? null;
}

async function audit(
  db: AletaDatabase,
  actor: UserPersona,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
  auditMeta?: AuditMeta
) {
  await logAction(db, {
    userId: actor.id,
    action,
    entityType: "jlf_bas_qa_template",
    entityId,
    ipAddress: auditMeta?.ipAddress,
    userAgent: auditMeta?.userAgent,
    metadata,
  });
}

export async function listBasQaTemplates(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);
  return readTemplates(db);
}

export async function renderBasQaTemplateSection(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    sourceKey?: string;
    caseType?: string;
    values?: Record<string, unknown>;
  } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);
  const templates = await readTemplates(db);
  const template = matchTemplateForSourceKey(templates, input.sourceKey ?? "", input.caseType);
  if (!template) return "";

  const values = input.values ?? {};
  return template.items
    .sort((left, right) => left.order - right.order)
    .map((item) => {
      const question = interpolatePlaceholders(item.question, values);
      const sourceAnswer = item.answerMode === "sipp" ? readValuePath(values, item.sourceKey ?? "") : "";
      const answer = interpolatePlaceholders(item.answer || sourceAnswer, values);
      const prefix = subjectLabel(item.subjectType);
      const heading = prefix ? `${prefix}: ${question}` : question;
      return answer ? `${item.order}. ${heading}\n   Jawaban: ${answer}` : `${item.order}. ${heading}`;
    })
    .join("\n");
}

export async function createBasQaTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  input: { code: unknown; name: unknown; caseType?: unknown; paperSize?: unknown },
  auditMeta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const now = new Date().toISOString();
  const template: JlfBasQaTemplate = {
    id: nextId("jlf-bas-qa"),
    code: normalizeText(input.code, "Kode", 40),
    name: normalizeText(input.name, "Nama template", 160),
    caseType: normalizeText(input.caseType, "Jenis perkara", 120, false) || "Umum",
    paperSize: normalizeText(input.paperSize, "Ukuran kertas", 20, false) || "A4",
    isActive: true,
    updatedAt: now,
    items: [],
  };

  templates.push(template);
  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.template.create", template.id, { code: template.code }, auditMeta);
  return template;
}

export async function updateBasQaTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: { code?: unknown; name?: unknown; caseType?: unknown; paperSize?: unknown; isActive?: unknown },
  auditMeta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, id);
  template.code = input.code === undefined ? template.code : normalizeText(input.code, "Kode", 40);
  template.name = input.name === undefined ? template.name : normalizeText(input.name, "Nama template", 160);
  template.caseType = input.caseType === undefined ? template.caseType : normalizeText(input.caseType, "Jenis perkara", 120, false) || "Umum";
  template.paperSize = input.paperSize === undefined ? template.paperSize : normalizeText(input.paperSize, "Ukuran kertas", 20, false) || "A4";
  template.isActive = input.isActive === undefined ? template.isActive : input.isActive !== false;
  template.updatedAt = new Date().toISOString();

  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.template.update", template.id, { code: template.code }, auditMeta);
  return template;
}

export async function deleteBasQaTemplate(db: AletaDatabase, actor: UserPersona, id: string, auditMeta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_DELETE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, id);
  const next = templates.filter((item) => item.id !== id);
  await writeTemplates(db, actor, next);
  await audit(db, actor, "bas_qa.template.delete", template.id, { code: template.code }, auditMeta);
  return { deleted: true };
}

export async function addBasQaItem(
  db: AletaDatabase,
  actor: UserPersona,
  templateId: string,
  input: { question: unknown; answer?: unknown; subjectType?: unknown; answerMode?: unknown; sourceKey?: unknown },
  auditMeta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, templateId);
  const item: JlfBasQaItem = {
    id: nextId("jlf-bas-qa-item"),
    order: template.items.length + 1,
    subjectType: input.subjectType === undefined ? inferSubjectType(normalizeText(input.question, "Pertanyaan", 400)) : normalizeSubjectType(input.subjectType),
    answerMode: normalizeAnswerMode(input.answerMode),
    sourceKey: normalizeText(input.sourceKey, "Source key", 160, false),
    question: normalizeText(input.question, "Pertanyaan", 400),
    answer: normalizeText(input.answer, "Jawaban", 1000, false),
  };
  template.items.push(item);
  template.updatedAt = new Date().toISOString();
  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.item.create", template.id, { itemId: item.id }, auditMeta);
  return item;
}

export async function updateBasQaItem(
  db: AletaDatabase,
  actor: UserPersona,
  templateId: string,
  itemId: string,
  input: { question?: unknown; answer?: unknown; subjectType?: unknown; answerMode?: unknown; sourceKey?: unknown },
  auditMeta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, templateId);
  const item = template.items.find((candidate) => candidate.id === itemId);
  if (!item) jlfNotFound("Item Tanya Jawab/BAS tidak ditemukan.");
  item.question = input.question === undefined ? item.question : normalizeText(input.question, "Pertanyaan", 400);
  item.answer = input.answer === undefined ? item.answer : normalizeText(input.answer, "Jawaban", 1000, false);
  item.subjectType = input.subjectType === undefined ? item.subjectType : normalizeSubjectType(input.subjectType);
  item.answerMode = input.answerMode === undefined ? item.answerMode : normalizeAnswerMode(input.answerMode);
  item.sourceKey = input.sourceKey === undefined ? item.sourceKey : normalizeText(input.sourceKey, "Source key", 160, false);
  template.updatedAt = new Date().toISOString();
  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.item.update", template.id, { itemId: item.id }, auditMeta);
  return item;
}

export async function deleteBasQaItem(db: AletaDatabase, actor: UserPersona, templateId: string, itemId: string, auditMeta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, templateId);
  const item = template.items.find((candidate) => candidate.id === itemId);
  if (!item) jlfNotFound("Item Tanya Jawab/BAS tidak ditemukan.");
  template.items = template.items.filter((candidate) => candidate.id !== itemId).map((candidate, index) => ({ ...candidate, order: index + 1 }));
  template.updatedAt = new Date().toISOString();
  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.item.delete", template.id, { itemId }, auditMeta);
  return { deleted: true };
}

export async function moveBasQaItem(
  db: AletaDatabase,
  actor: UserPersona,
  templateId: string,
  itemId: string,
  direction: "up" | "down",
  auditMeta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);
  const templates = await readTemplates(db);
  const template = findTemplate(templates, templateId);
  const index = template.items.findIndex((item) => item.id === itemId);
  if (index < 0) jlfNotFound("Item Tanya Jawab/BAS tidak ditemukan.");
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex >= 0 && swapIndex < template.items.length) {
    [template.items[index], template.items[swapIndex]] = [template.items[swapIndex], template.items[index]];
  }
  template.items = template.items.map((item, nextIndex) => ({ ...item, order: nextIndex + 1 }));
  template.updatedAt = new Date().toISOString();
  await writeTemplates(db, actor, templates);
  await audit(db, actor, "bas_qa.item.move", template.id, { itemId, direction }, auditMeta);
  return template.items;
}

export const JlfBasQaService = {
  listBasQaTemplates,
  renderBasQaTemplateSection,
  createBasQaTemplate,
  updateBasQaTemplate,
  deleteBasQaTemplate,
  addBasQaItem,
  updateBasQaItem,
  deleteBasQaItem,
  moveBasQaItem,
};
