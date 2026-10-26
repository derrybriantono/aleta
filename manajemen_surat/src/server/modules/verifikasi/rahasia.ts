import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Enkripsi rahasia authenticator saat disimpan (AES-256-GCM). Kuncinya
 * diturunkan (HKDF-SHA256) dari rahasia aplikasi yang sama dengan Better Auth:
 * BETTER_AUTH_SECRET, atau berkas data/.better-auth-secret. Basis data yang
 * bocor tanpa rahasia aplikasi tidak membuka rahasia authenticator siapa pun.
 *
 * Bentuk tersimpan: "v1.<iv base64url>.<tag base64url>.<isi base64url>".
 */
function rahasiaAplikasi(): string {
  const dariEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (dariEnv) return dariEnv;
  const berkas = path.join(process.cwd(), "data", ".better-auth-secret");
  try {
    if (fs.existsSync(berkas)) return fs.readFileSync(berkas, "utf8").trim();
  } catch {
    /* dibaca ulang di bawah */
  }
  throw new Error("Rahasia aplikasi tidak tersedia untuk mengenkripsi rahasia authenticator.");
}

function kunci(): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", rahasiaAplikasi(), "aleta-verifikasi", "authenticator-v1", 32));
}

export function enkripsiRahasia(teks: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", kunci(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), isi.toString("base64url")].join(".");
}

export function dekripsiRahasia(tersimpan: string): string {
  const [versi, iv, tag, isi] = String(tersimpan ?? "").split(".");
  if (versi !== "v1" || !iv || !tag || !isi) throw new Error("Rahasia authenticator tersimpan tidak dikenal.");
  const d = crypto.createDecipheriv("aes-256-gcm", kunci(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(isi, "base64url")), d.final()]).toString("utf8");
}

/** Hash satu arah untuk tiket dan kode (kode pendek ikut dikunci ke akunnya). */
export function hashKode(...bagian: string[]): string {
  return crypto.createHash("sha256").update(["aleta-verifikasi", ...bagian].join("\u0000")).digest("hex");
}
