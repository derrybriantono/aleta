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
  lastErrorType: "",
  lastState: "",
  phoneNumber: "",
  initializingStartedAt: null,
  initializeTimeoutAt: null,
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
    state.initializingStartedAt = null;
    if (metadata.qrString) {
      state.lastQrString = metadata.qrString;
      state.lastQrGeneratedAt = state.updatedAt;
    }
  }
  if (status === "initializing") {
    state.initializingStartedAt = state.updatedAt;
    state.initializeTimeoutAt = null;
    state.lastQrString = null;
  }
  if (status === "initialize_timeout") {
    state.initializeTimeoutAt = state.updatedAt;
    state.initializingStartedAt = null;
  }
  if (status === "connected") {
    state.lastReadyAt = state.updatedAt;
    if (!state.sessionStartedAt) state.sessionStartedAt = state.updatedAt;
    state.lastQrString = null;
    state.initializingStartedAt = null;
    if (metadata.phoneNumber) state.phoneNumber = metadata.phoneNumber;
  }
  if (status === "authenticated") state.lastAuthenticatedAt = state.updatedAt;
  if (status === "auth_failure") {
    state.lastAuthFailureAt = state.updatedAt;
    state.authFailureCount += 1;
  }
  if (status === "disconnected") {
    state.lastDisconnectedAt = state.updatedAt;
    state.initializingStartedAt = null;
  }
  if (status === "browser_locked") {
    state.lastDisconnectedAt = state.updatedAt;
    state.initializingStartedAt = null;
  }
  if (status === "reconnecting") state.lastReconnectAttemptAt = state.updatedAt;

  if (metadata.state) state.lastState = metadata.state;
  if (metadata.errorMessage) {
    state.lastErrorAt = state.updatedAt;
    state.lastErrorMessage = metadata.errorMessage;
  }
  if (metadata.errorType) state.lastErrorType = metadata.errorType;

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
  const initializeAgeMs = state.initializingStartedAt
    ? Math.max(0, Date.now() - new Date(state.initializingStartedAt).getTime())
    : null;
  return { ...state, sessionAgeHours, initializeAgeMs };
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
