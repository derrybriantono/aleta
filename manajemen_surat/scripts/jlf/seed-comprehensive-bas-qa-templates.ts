import { createAletaDatabase } from "../../src/server/db/client";
import { COMPREHENSIVE_BAS_QA_TEMPLATES } from "../../src/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-seed-catalog";
import { getJsonSetting, setSetting } from "../../src/server/modules/judicia/legal-form/jlf-settings-service";

const BAS_QA_SETTING_KEY = "jlf.bas_qa.templates";

type BasQaTemplate = (typeof COMPREHENSIVE_BAS_QA_TEMPLATES)[number];

function isTemplate(value: unknown): value is BasQaTemplate {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getTemplateRank(template: BasQaTemplate) {
  const haystack = `${template.caseType} ${template.name} ${template.code}`.toLowerCase();
  if (/(verstek|ghaib|relas|panggilan|pemberitahuan)/.test(haystack)) return 0;
  if (/umum/.test(haystack)) return 1;
  if (/cerai gugat/.test(haystack)) return 2;
  if (/cerai talak|ikrar talak/.test(haystack)) return 3;
  if (/nafkah/.test(haystack)) return 4;
  if (/hadhanah|hak asuh|pengasuhan/.test(haystack)) return 5;
  if (/harta bersama/.test(haystack)) return 6;
  if (/itsbat|pengesahan perkawinan/.test(haystack)) return 7;
  if (/dispensasi/.test(haystack)) return 8;
  if (/wali adhal/.test(haystack)) return 9;
  if (/asal usul anak/.test(haystack)) return 10;
  if (/pembatalan/.test(haystack)) return 11;
  if (/poligami/.test(haystack)) return 12;
  if (/waris/.test(haystack)) return 13;
  if (/hibah|wasiat|wakaf|zakat|infak|sedekah/.test(haystack)) return 14;
  if (/ekonomi syariah/.test(haystack)) return 15;
  if (/perwalian|pengampuan/.test(haystack)) return 16;
  if (/mafqud|orang hilang/.test(haystack)) return 17;
  if (/persidangan|administrasi|mediasi/.test(haystack)) return 18;
  if (/validasi bas|berita acara/.test(haystack)) return 19;
  if (/putusan|penetapan/.test(haystack)) return 20;
  if (/eksekusi/.test(haystack)) return 21;
  if (/jinayat/.test(haystack)) return 22;
  return 99;
}

function sortTemplates(left: BasQaTemplate, right: BasQaTemplate) {
  return (
    getTemplateRank(left) - getTemplateRank(right) ||
    left.caseType.localeCompare(right.caseType) ||
    left.code.localeCompare(right.code) ||
    left.name.localeCompare(right.name)
  );
}

async function main() {
  const db = await createAletaDatabase({ seed: false, runMigrations: false });

  try {
    const existing = await getJsonSetting<unknown[]>(db, BAS_QA_SETTING_KEY, []);
    const merged = new Map<string, BasQaTemplate>();

    for (const template of existing) {
      if (isTemplate(template) && typeof template.id === "string") {
        merged.set(template.id, template);
      }
    }

    for (const template of COMPREHENSIVE_BAS_QA_TEMPLATES) {
      merged.set(template.id, template);
    }

    const templates = [...merged.values()].sort(sortTemplates);
    await setSetting(db, BAS_QA_SETTING_KEY, templates, {
      description: "Template tanya jawab dan struktur BAS JLF komprehensif untuk perkara Peradilan Agama.",
    });

    console.log(
      JSON.stringify(
        {
          existing: existing.length,
          seeded: COMPREHENSIVE_BAS_QA_TEMPLATES.length,
          total: templates.length,
          totalQuestions: templates.reduce((sum, template) => sum + template.items.length, 0),
          note: "Template BAS disimpan di jlf_settings. Template lama dengan ID berbeda tetap dipertahankan.",
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
  console.error("[JLF] Gagal seed template BAS komprehensif.", error);
  process.exit(1);
});
