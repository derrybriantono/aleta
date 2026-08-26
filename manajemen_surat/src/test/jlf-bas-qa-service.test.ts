// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  addBasQaItem,
  createBasQaTemplate,
  deleteBasQaItem,
  listBasQaTemplates,
  moveBasQaItem,
  updateBasQaItem,
} from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import { requireActorUser } from "@/server/modules/organization/service";

describe("JLF BAS question-answer templates", () => {
  let db: AletaDatabase | null = null;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 90_000);

  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("stores BAS QA templates in JLF settings and supports item ordering", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const template = await createBasQaTemplate(db!, actor, {
      code: "Kode Test",
      name: "Template Test",
      caseType: "Cerai Gugat",
      paperSize: "A4",
    });

    const first = await addBasQaItem(db!, actor, template.id, {
      question: "Pertanyaan pertama?",
      answer: "Jawaban pertama;",
    });
    const second = await addBasQaItem(db!, actor, template.id, {
      question: "Pertanyaan kedua?",
      answer: "",
    });

    await moveBasQaItem(db!, actor, template.id, second.id, "up");
    await updateBasQaItem(db!, actor, template.id, first.id, {
      answer: "Jawaban pertama diubah;",
    });

    const templates = await listBasQaTemplates(db!, actor);
    const saved = templates.find((item) => item.id === template.id);

    expect(saved?.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(saved?.items.find((item) => item.id === first.id)?.answer).toBe("Jawaban pertama diubah;");

    await deleteBasQaItem(db!, actor, template.id, second.id);
    const afterDelete = (await listBasQaTemplates(db!, actor)).find((item) => item.id === template.id);
    expect(afterDelete?.items.map((item) => item.order)).toEqual([1]);
  });
});
