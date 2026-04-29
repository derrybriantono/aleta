const crypto = require("crypto");

function stablePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9@._-]/g, "");
}

function buildIdempotencyKey({
  notificationKey,
  recipientNumber,
  perkaraId,
  nomorPerkara,
  eventDate,
  messageType,
  manualNonce,
} = {}) {
  if (manualNonce) {
    return `manual:${stablePart(manualNonce)}`;
  }

  const parts = [
    stablePart(notificationKey || "unknown-notification"),
    stablePart(perkaraId || nomorPerkara || "no-perkara"),
    stablePart(recipientNumber || "no-recipient"),
    stablePart(eventDate || "no-date"),
    stablePart(messageType || "message"),
  ];

  const source = parts.join("|");
  const digest = crypto.createHash("sha256").update(source).digest("hex").slice(0, 24);
  return `notif:${digest}`;
}

function buildManualIdempotencyKey({ recipientNumber, message, requestId } = {}) {
  const nonce = requestId || `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const digest = crypto
    .createHash("sha256")
    .update(`${recipientNumber || ""}|${message || ""}|${nonce}`)
    .digest("hex")
    .slice(0, 24);
  return `manual:${digest}`;
}

module.exports = {
  buildIdempotencyKey,
  buildManualIdempotencyKey,
};
