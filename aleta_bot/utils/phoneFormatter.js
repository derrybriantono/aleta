function stripWhatsappSuffix(input) {
  return String(input || "").replace(/@(c|g)\.us$/i, "");
}

function normalizeIndonesianPhoneNumber(input) {
  const digits = stripWhatsappSuffix(input).replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  let normalized = digits;
  if (normalized.startsWith("0")) {
    normalized = `62${normalized.slice(1)}`;
  } else if (normalized.startsWith("8")) {
    normalized = `62${normalized}`;
  }

  if (!normalized.startsWith("62")) {
    return "";
  }

  if (!/^628\d+$/.test(normalized)) {
    return "";
  }

  if (normalized.length < 10 || normalized.length > 15) {
    return "";
  }

  return normalized;
}

function toWhatsappChatId(input) {
  const normalized = normalizeIndonesianPhoneNumber(input);
  return normalized ? `${normalized}@c.us` : "";
}

function validateWhatsappNumber(input) {
  const raw = String(input || "").trim();
  const normalized = normalizeIndonesianPhoneNumber(raw);

  if (!raw) {
    return { valid: false, normalized: "", chatId: "", reason: "empty_number" };
  }

  if (!normalized) {
    return { valid: false, normalized: "", chatId: "", reason: "invalid_indonesian_number" };
  }

  return {
    valid: true,
    normalized,
    chatId: `${normalized}@c.us`,
    reason: "",
  };
}

function validateWhatsappRecipient(input) {
  const raw = String(input || "").trim();

  if (!raw) {
    return { valid: false, type: "unknown", normalized: "", chatId: "", reason: "empty_recipient" };
  }

  if (/@g\.us$/i.test(raw)) {
    return { valid: true, type: "group", normalized: raw, chatId: raw, reason: "" };
  }

  const numberValidation = validateWhatsappNumber(raw);
  return {
    ...numberValidation,
    type: "contact",
  };
}

module.exports = {
  normalizeIndonesianPhoneNumber,
  toWhatsappChatId,
  validateWhatsappNumber,
  validateWhatsappRecipient,
};
