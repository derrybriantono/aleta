const logService = require("./logService");

const state = {
  status: "unknown",
  lastQrAt: null,
  lastQrString: null,
  lastQrGeneratedAt: null,
  lastReadyAt: null,
  lastAuthenticatedAt: null,
  lastAuthFailureAt: null,
  lastDisconnectedAt: null,
  lastReconnectAttemptAt: null,
  lastErrorAt: null,
  lastErrorMessage: "",
  lastState: "",
  phoneNumber: "",
  sessionStartedAt: null,
  lastMessageSentAt: null,
  authFailureCount: 0,
  updatedAt: new Date().toISOString(),
};

function setStatus(status, eventType, metadata = {}) {
  state.status = status;
  state.updatedAt = new Date().toISOString();

  if (status === "qr_needed") {
    state.lastQrAt = state.updatedAt;
    if (metadata.qrString) {
      state.lastQrString = metadata.qrString;
      state.lastQrGeneratedAt = state.updatedAt;
    }
  }
  if (status === "connected") {
    state.lastReadyAt = state.updatedAt;
    if (!state.sessionStartedAt) state.sessionStartedAt = state.updatedAt;
    state.lastQrString = null;
    if (metadata.phoneNumber) state.phoneNumber = metadata.phoneNumber;
  }
  if (status === "authenticated") state.lastAuthenticatedAt = state.updatedAt;
  if (status === "auth_failure") {
    state.lastAuthFailureAt = state.updatedAt;
    state.authFailureCount += 1;
  }
  if (status === "disconnected") state.lastDisconnectedAt = state.updatedAt;
  if (status === "reconnecting") state.lastReconnectAttemptAt = state.updatedAt;

  if (metadata.state) state.lastState = metadata.state;
  if (metadata.errorMessage) {
    state.lastErrorAt = state.updatedAt;
    state.lastErrorMessage = metadata.errorMessage;
  }

  logService.logWhatsappEvent({
    eventType: eventType || status,
    severity: metadata.severity || (status === "auth_failure" || status === "disconnected" ? "warning" : "info"),
    message: metadata.message || `WhatsApp status changed to ${status}`,
    metadata,
  });

  return getStatus();
}

function getStatus() {
  const sessionAgeHours = state.sessionStartedAt
    ? Math.max(0, Math.round(((Date.now() - new Date(state.sessionStartedAt).getTime()) / 3_600_000) * 10) / 10)
    : null;
  return { ...state, sessionAgeHours };
}

function recordMessageSent() {
  state.lastMessageSentAt = new Date().toISOString();
  state.updatedAt = state.lastMessageSentAt;
  return getStatus();
}

module.exports = {
  setStatus,
  getStatus,
  recordMessageSent,
};
