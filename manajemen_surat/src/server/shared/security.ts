import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function hashMd5(secret: string) {
  return createHash("md5").update(secret).digest("hex");
}

function getCredentialEncryptionKey() {
  const raw =
    process.env.ALETA_CREDENTIAL_ENCRYPTION_KEY ||
    process.env.ALETA_BOT_DB_SECRET_ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "";

  if (!raw) {
    return createHash("sha256").update("aleta-local-development-credential-key").digest();
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptCredentialSecret(value: string) {
  const secret = String(value || "");
  if (!secret) return "";

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCredentialEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptCredentialSecret(value: string) {
  const encryptedValue = String(value || "");
  if (!encryptedValue) return "";

  const [scheme, version, ivBase64, tagBase64, encryptedBase64] = encryptedValue.split(":");
  if (scheme !== "enc" || version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    return "";
  }

  // Gagal-tertutup, bukan melempar.
  //
  // Nilai tersimpan dapat menjadi tidak terbaca karena hal yang WAJAR: kunci
  // enkripsi diganti, basis data dipulihkan dari cadangan lama, atau barisnya
  // rusak. Semua itu harus berakhir sebagai "password tidak dapat dibaca" -
  // keterangan yang sudah disiapkan di pemanggilnya - bukan sebagai galat yang
  // meledak.
  //
  // Sebelumnya galatnya lolos ke atas, sehingga cabang penanganan yang sudah
  // ditulis di buildExternalAppLaunchHtml dan periksaKredensialSipp TIDAK
  // PERNAH terjangkau. Yang dilihat petugas hanyalah layar galat.
  try {
    const decipher = createDecipheriv("aes-256-gcm", getCredentialEncryptionKey(), Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskCredentialUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 3) return `${trimmed[0] ?? ""}**`;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

export function isLikelyConnectedApiKey(apiKey: string) {
  return apiKey.trim().length >= 12;
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
