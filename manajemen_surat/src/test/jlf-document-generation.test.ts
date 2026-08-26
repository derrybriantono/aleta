// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveVariablesForTemplate } from "@/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service";
import { renderStringTemplate } from "@/server/modules/judicia/legal-form/documents/jlf-template-render-service";
import { formatRupiah, formatTanggalIndonesiaPanjang } from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";
import { getGeneratedDocumentDownload } from "@/server/modules/judicia/legal-form/documents/jlf-document-generation-service";
import { addBasQaItem, createBasQaTemplate } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import type { UserPersona } from "@/lib/types";

describe("JLF document generation foundation", () => {
  let db: AletaDatabase | null = null;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });

  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("replaces legacy and modern placeholders in RTF-safe rendering", () => {
    const rendered = renderStringTemplate({
      content: "{\\rtf1 Perkara {{nomor_perkara}} untuk #0001#}",
      fileType: "rtf",
      values: [
        { key: "nomor_perkara", placeholder: "{{nomor_perkara}}", value: "123/Pdt.G/2026/PA.Mks" },
        { key: "nama_pihak", placeholder: "#0001#", value: "Ali" },
      ],
    });

    expect(rendered.renderedText).toContain("123/Pdt.G/2026/PA.Mks");
    expect(rendered.renderedText).toContain("Ali");
    expect(rendered.replacedPlaceholders).toEqual(["#0001#", "{{nomor_perkara}}"]);
  });

  it("formats Indonesian date and rupiah values", () => {
    expect(formatTanggalIndonesiaPanjang("2026-05-24")).toBe("24 Mei 2026");
    expect(formatRupiah(1250000)).toBe("Rp1.250.000");
  });

  it("marks required missing values as errors, optional missing values as warnings, and applies fallback", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const category = await db!.prepare("SELECT id FROM jlf_categories LIMIT 1").get<{ id: string }>();
    expect(category?.id).toBeTruthy();

    await db!.prepare(
      `INSERT INTO jlf_templates (
        id, category_id, name, slug, description, document_type, file_type, storage_path,
        original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'Template Resolver Test', 'template-resolver-test', '', 'legal_form', 'rtf', '', '', 'active', 0, 0, 0, ?, ?, ?, ?)`
    ).run("jlf-test-template", category!.id, actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    const variableRows = [
      ["jlf-test-var-required", "nama_wajib", "Nama Wajib", "static", "", "", 1],
      ["jlf-test-var-optional", "catatan_opsional", "Catatan Opsional", "static", "", "", 0],
      ["jlf-test-var-fallback", "nomor_fallback", "Nomor Fallback", "static", "", "Fallback OK", 1],
    ] as const;

    for (const [id, key, label, sourceType, sourceKey, fallbackValue, required] of variableRows) {
      await db!.prepare(
        `INSERT INTO jlf_variables (
          id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
          fallback_value, is_required, is_active, example_value, admin_note, created_by, updated_by, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, '', 'text', ?, ?, '', ?, ?, 1, '', '', ?, ?, ?, ?)`
      ).run(id, key, label, sourceType, sourceKey, fallbackValue, required, actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");
    }

    const mappingRows = [
      ["jlf-test-map-required", "jlf-test-var-required", "#0001#", 1],
      ["jlf-test-map-optional", "jlf-test-var-optional", "{{catatan_opsional}}", 0],
      ["jlf-test-map-fallback", "jlf-test-var-fallback", "{{nomor_fallback}}", 1],
    ] as const;

    for (const [id, variableId, placeholder, required] of mappingRows) {
      await db!.prepare(
        `INSERT INTO jlf_template_variables (
          id, template_id, variable_id, placeholder, is_required, sort_order, created_at, updated_at
        ) VALUES (?, 'jlf-test-template', ?, ?, ?, 0, ?, ?)`
      ).run(id, variableId, placeholder, required, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");
    }

    const resolved = await resolveVariablesForTemplate(db!, actor, {
      templateId: "jlf-test-template",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
    });

    expect(resolved.missingRequiredVariables.map((item) => item.key)).toContain("nama_wajib");
    expect(resolved.warnings.join(" ")).toContain("catatan_opsional");
    expect(resolved.variables.find((item) => item.key === "nomor_fallback")?.value).toBe("Fallback OK");
  });

  it("uses selected hearing context for hearing schedule variables", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const category = await db!.prepare("SELECT id FROM jlf_categories LIMIT 1").get<{ id: string }>();

    await db!.prepare(
      `INSERT INTO jlf_templates (
        id, category_id, name, slug, description, document_type, file_type, storage_path,
        original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'Template Sidang Test', 'template-sidang-test', '', 'bas', 'rtf', '', '', 'active', 0, 0, 0, ?, ?, ?, ?)`
    ).run("jlf-test-template-hearing", category!.id, actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    await db!.prepare(
      `INSERT INTO jlf_variables (
        id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
        fallback_value, is_required, is_active, example_value, admin_note, created_by, updated_by, created_at, updated_at
      ) VALUES (?, '0048', 'tanggal_sidang', 'Tanggal Sidang', '', 'text', 'sipp_jadwal_sidang', 'tanggal_sidang', '', '', 1, 1, '', '', ?, ?, ?, ?)`
    ).run("jlf-test-var-hearing-date", actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    await db!.prepare(
      `INSERT INTO jlf_template_variables (
        id, template_id, variable_id, placeholder, is_required, sort_order, created_at, updated_at
      ) VALUES (?, 'jlf-test-template-hearing', 'jlf-test-var-hearing-date', '#0048#', 1, 0, ?, ?)`
    ).run("jlf-test-map-hearing-date", "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    const resolved = await resolveVariablesForTemplate(db!, actor, {
      templateId: "jlf-test-template-hearing",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
      options: {
        caseBundle: {
          detail: { perkaraId: "perkara-test-123", nomor_perkara: "123/Pdt.G/2026/PA.Mks" },
          parties: [],
          schedule: [],
          lastHearing: null,
          nextHearing: null,
          judges: [],
          panitera: [],
          jurusita: [],
          mediator: [],
          decision: null,
        },
        selectedHearing: {
          tanggal_sidang: "2026-06-08",
          agenda: "Sidang Pertama",
        },
      },
    });

    expect(resolved.variables.find((item) => item.key === "tanggal_sidang")?.value).toBe("2026-06-08");
    expect(resolved.missingRequiredVariables).toHaveLength(0);
  });

  it("resolves legacy #0002# and qr_perkara as an authorized case QR payload", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const category = await db!.prepare("SELECT id FROM jlf_categories LIMIT 1").get<{ id: string }>();

    await db!.prepare(
      `INSERT INTO jlf_templates (
        id, category_id, name, slug, description, document_type, file_type, storage_path,
        original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'Template QR Test', 'template-qr-test', '', 'legal_form', 'rtf', '', '', 'active', 0, 0, 0, ?, ?, ?, ?)`
    ).run("jlf-test-template-qr", category!.id, actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    const qrVariable = await db!
      .prepare(`SELECT id FROM jlf_variables WHERE "key" = 'qr_perkara' LIMIT 1`)
      .get<{ id: string }>();
    expect(qrVariable?.id).toBeTruthy();

    await db!.prepare(
      `INSERT INTO jlf_template_variables (
        id, template_id, variable_id, placeholder, is_required, sort_order, created_at, updated_at
      ) VALUES (?, 'jlf-test-template-qr', ?, '#0002#', 0, 0, ?, ?)`
    ).run("jlf-test-map-qr", qrVariable!.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    const resolved = await resolveVariablesForTemplate(db!, actor, {
      templateId: "jlf-test-template-qr",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
    });

    const value = String(resolved.variables.find((item) => item.key === "qr_perkara")?.value ?? "");
    expect(value).toContain("jlf_case_link");
    expect(value).toContain("requires_login");
    expect(value).toContain("123%2FPdt.G%2F2026%2FPA.Mks");
  });

  it("can resolve Template Tanya Jawab/BAS as a variable source", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const category = await db!.prepare("SELECT id FROM jlf_categories LIMIT 1").get<{ id: string }>();
    const basTemplate = await createBasQaTemplate(db!, actor, {
      code: "Kode BAS Test",
      name: "BAS Test",
      caseType: "Cerai Gugat",
      paperSize: "A4",
    });
    await addBasQaItem(db!, actor, basTemplate.id, {
      question: "Kepada perkara {{nomor_perkara}}:",
      answer: "Jawaban dicatat;",
    });

    await db!.prepare(
      `INSERT INTO jlf_templates (
        id, category_id, name, slug, description, document_type, file_type, storage_path,
        original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'Template BAS Source Test', 'template-bas-source-test', '', 'bas', 'rtf', '', '', 'active', 0, 0, 0, ?, ?, ?, ?)`
    ).run("jlf-test-template-bas-source", category!.id, actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    await db!.prepare(
      `INSERT INTO jlf_variables (
        id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
        fallback_value, is_required, is_active, example_value, admin_note, created_by, updated_by, created_at, updated_at
      ) VALUES (?, NULL, 'section_tanya_jawab', 'Section Tanya Jawab', '', 'long_text', 'jlf_bas_qa', 'Kode BAS Test', '', '', 0, 1, '', '', ?, ?, ?, ?)`
    ).run("jlf-test-var-bas-source", actor.id, actor.id, "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    await db!.prepare(
      `INSERT INTO jlf_template_variables (
        id, template_id, variable_id, placeholder, is_required, sort_order, created_at, updated_at
      ) VALUES (?, 'jlf-test-template-bas-source', 'jlf-test-var-bas-source', '{{section_tanya_jawab}}', 0, 0, ?, ?)`
    ).run("jlf-test-map-bas-source", "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");

    const resolved = await resolveVariablesForTemplate(db!, actor, {
      templateId: "jlf-test-template-bas-source",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
    });

    const value = String(resolved.variables.find((item) => item.key === "section_tanya_jawab")?.value ?? "");
    expect(value).toContain("Kepada perkara 123/Pdt.G/2026/PA.Mks");
    expect(value).toContain("Jawaban dicatat");
  });

  it("rejects document download when the actor lacks JLF download permission", async () => {
    const noAccessActor: UserPersona = {
      id: "usr-no-jlf-access",
      username: "noaccess",
      password: "",
      name: "No Access",
      nip: "",
      email: "noaccess@example.test",
      whatsappNumber: "",
      roleId: "sekretaris",
      positionId: "pos-sekretaris",
      additionalRoleIds: [],
      isActive: true,
    };

    await expect(getGeneratedDocumentDownload(db!, noAccessActor, "jlf-doc-missing")).rejects.toThrow(
      "Anda tidak memiliki izin Judicia Legal Form"
    );
  });
});
