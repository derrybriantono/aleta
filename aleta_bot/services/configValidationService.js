const logService = require("./logService");

const requiredForProduction = [
  "ALETA_BOT_DB_HOST",
  "ALETA_BOT_DB_USER",
  "ALETA_BOT_DB_PASSWORD",
  "ALETA_BOT_DB_NAME",
  "ALETA_BOT_DB_SIPP_NAME",
  "ALETA_BOT_INTERNAL_TOKEN",
];

function normalizeDbName(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Memastikan database internal ALETA terpisah dari SIPP.
 *
 * TIDAK bergantung pada NODE_ENV. Penjagaan ini melempar galat di lingkungan
 * mana pun, karena akibat konfigurasi yang salah sama saja di semua tempat:
 * tabel ALETA mendarat di database perkara milik Mahkamah Agung.
 */
function validateDatabaseSeparation() {
  const internalDb = normalizeDbName(
    process.env.ALETA_BOT_INTERNAL_DB_NAME || process.env.ALETA_BOT_DB_NAME || "aleta_bot"
  );
  const sippDb = normalizeDbName(process.env.ALETA_BOT_DB_SIPP_NAME || "SIPP");
  const allowUnsafeSippSchemaWrite =
    String(process.env.ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE || "false").toLowerCase() === "true";

  const unsafe = internalDb && sippDb && internalDb === sippDb;
  const internalIsSipp = internalDb === "sipp";
  if (!allowUnsafeSippSchemaWrite && (unsafe || internalIsSipp)) {
    const message =
      "Konfigurasi database ALETA Bot tidak aman: database internal ALETA Bot tidak boleh sama dengan database SIPP. " +
      "Gunakan ALETA_BOT_DB_NAME=aleta_bot dan ALETA_BOT_DB_SIPP_NAME=SIPP.";

    // MENGHENTIKAN TANPA PEDULI NODE_ENV.
    //
    // Sebelumnya galat hanya dilempar bila NODE_ENV bernilai "production";
    // di luar itu cukup peringatan konsol, dan bot tetap menyala. Server yang
    // lupa menyetel NODE_ENV - hal yang lumrah pada pemasangan cepat - akan
    // melewati penjagaan ini dengan peringatan yang mudah tenggelam di antara
    // log lain.
    //
    // Akibatnya bukan sekadar salah tempat: tabel ALETA terbentuk di dalam
    // database perkara milik Mahkamah Agung, tumbuh sampai ratusan ribu baris,
    // dan ikut membesarkan setiap pencadangan SIPP. Kesalahan itu tidak pernah
    // menghasilkan pesan galat - bot berjalan normal, hanya menyimpan datanya
    // di tempat yang salah.
    //
    // Satu-satunya cara melewatinya sekarang adalah menyatakannya dengan
    // sengaja lewat ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE.
    throw new Error(message);
  }

  return { ok: true, message: "", internalDb, sippDb };
}

function validateStartupConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const missing = requiredForProduction.filter((key) => !process.env[key]);
  const databaseSeparation = validateDatabaseSeparation();

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
    databaseSeparation,
    okForProduction: missing.length === 0 && databaseSeparation.ok,
  };
}

module.exports = {
  validateStartupConfig,
};
