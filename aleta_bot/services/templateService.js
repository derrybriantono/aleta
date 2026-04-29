function extractPlaceholders(body) {
  const placeholders = new Set();
  String(body || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    placeholders.add(key);
    return "";
  });
  return [...placeholders];
}

function validateTemplate(template = {}, { outputColumns = [], requiredPlaceholders = [], category = "" } = {}) {
  const body = String(template.body || "");
  const placeholders = extractPlaceholders(body);
  const errors = [];
  const warnings = [];

  if (!template.key && !template.id) errors.push("template_key_required");
  if (!body.trim()) errors.push("template_body_required");

  for (const placeholder of requiredPlaceholders) {
    if (!placeholders.includes(placeholder)) {
      errors.push(`required_placeholder_missing_${placeholder}`);
    }
  }

  for (const placeholder of placeholders) {
    if (Array.isArray(outputColumns) && outputColumns.length > 0 && !outputColumns.includes(placeholder)) {
      warnings.push(`placeholder_not_in_query_output_${placeholder}`);
    }
  }

  if (category === "party" && !/ptsp|whatsapp|kontak|pesan otomatis|notifikasi/i.test(body)) {
    warnings.push("party_template_missing_external_disclaimer_or_contact");
  }

  return {
    valid: errors.length === 0,
    placeholders,
    errors,
    warnings,
  };
}

function renderTemplate(template = {}, values = {}) {
  return String(template.body || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Template placeholder tidak terisi: ${key}`);
    }
    return String(value);
  });
}

module.exports = {
  extractPlaceholders,
  validateTemplate,
  renderTemplate,
};
