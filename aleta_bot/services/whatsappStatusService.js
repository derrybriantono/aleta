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
    state.lastQrString = null;
    if (metadata.phoneNumber) state.phoneNumber = metadata.phoneNumber;
  }
  if (status === "authenticated") state.lastAuthenticatedAt = state.updatedAt;
  if (status === "auth_failure") state.lastAuthFailureAt = state.updatedAt;
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
  return { ...state };
}

module.exports = {
  setStatus,
  getStatus,
};
