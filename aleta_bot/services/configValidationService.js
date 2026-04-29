const logService = require("./logService");

const requiredForProduction = [
  "ALETA_BOT_DB_HOST",
  "ALETA_BOT_DB_USER",
  "ALETA_BOT_DB_PASSWORD",
  "ALETA_BOT_DB_NAME",
  "ALETA_BOT_INTERNAL_TOKEN",
];

function validateStartupConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const missing = requiredForProduction.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message =
      nodeEnv === "production"
        ? `Konfigurasi produksi ALETA Bot belum lengkap: ${missing.join(", ")}.`
        : `Konfigurasi ALETA Bot belum lengkap untuk produksi: ${missing.join(", ")}. Mode development masih diizinkan.`;

    console.warn(`[ALETA Bot] ${message}`);
    void logService.logSystemEvent({
      eventType: "startup_config_warning",
      severity: nodeEnv === "production" ? "error" : "warning",
      message,
      metadata: { missing, nodeEnv },
    });
  }

  return {
    nodeEnv,
    missing,
    okForProduction: missing.length === 0,
  };
}

module.exports = {
  validateStartupConfig,
};
