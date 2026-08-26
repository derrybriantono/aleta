const SECRET_KEY_PATTERN = /(password|passphrase|token|secret|api[_-]?key|authorization|cookie|session)/i;

const TECHNICAL_ERROR_PATTERNS = [
  /postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\//i,
  /\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|SELF_SIGNED_CERT|DEPTH_ZERO_SELF_SIGNED_CERT)\b/i,
  /\b(?:password|passphrase|token|secret|api[_-]?key|authorization|cookie|session)\b\s*[:=]/i,
  /(?:[A-Za-z]:\\|\/var\/|\/root\/|\/home\/|\/usr\/|\/etc\/|\/tmp\/|node_modules|\.next|\.env)/i,
  /\bat\s+.+\(.+:\d+:\d+\)/i,
  /\b(?:stack trace|traceback|syntaxerror|typeerror|referenceerror)\b/i,
  /\b(?:puppeteer|chromium|chrome|protocol error|target closed|fetch failed|socket hang up)\b/i,
];

function redactTechnicalFragments(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "postgres://[redacted]")
    .replace(/mysql:\/\/[^\s"'<>]+/gi, "mysql://[redacted]")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "mongodb://[redacted]")
    .replace(
      /\b(password|passphrase|token|secret|api[_-]?key|authorization|cookie|session)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      "$1=[redacted]"
    )
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path-redacted]")
    .replace(/(?:\/var|\/root|\/home|\/usr|\/etc|\/tmp)\/[^\s"'<>]+/g, "[path-redacted]")
    .slice(0, 500);
}

function looksTechnical(message: string) {
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitasi untuk pesan DIAGNOSTIK (uji koneksi, cek konfigurasi).
 *
 * Berbeda dari sanitizePublicErrorMessage yang mengganti pesan teknis dengan
 * kalimat umum: di sini sebab aslinya justru yang dibutuhkan. Menyembunyikannya
 * membuat tombol "Uji Koneksi" tidak ada gunanya — admin tidak bisa membedakan
 * API key salah, model tidak ada, API belum diaktifkan, atau server tanpa akses
 * internet, padahal penanganannya berbeda semua.
 *
 * Secret (API key, token, password, kredensial database) tetap disensor, dan
 * jejak API key Google/OpenAI/Anthropic dibuang walau muncul tanpa label.
 */
export function sanitizeDiagnosticErrorMessage(
  message: unknown,
  fallback = "Gagal tanpa keterangan dari penyedia layanan."
) {
  const raw = typeof message === "string" ? message.trim() : "";
  if (!raw) return fallback;

  const redacted = redactTechnicalFragments(raw)
    // Pola kunci yang lazim muncul mentah di pesan penyedia.
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "AIza[redacted]")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-[redacted]")
    .replace(/\bkey=[^\s&"']+/gi, "key=[redacted]");

  return redacted || fallback;
}

/**
 * Terjemahkan sebab teknis kegagalan koneksi penyedia AI menjadi saran tindakan.
 * Dikembalikan sebagai tambahan, bukan pengganti, agar pesan asli tetap terlihat.
 */
export function suggestAiConnectionFix(message: unknown) {
  const teks = String(typeof message === "string" ? message : "").toLowerCase();
  if (!teks) return "";

  // Urutan penting: yang spesifik diperiksa lebih dulu, karena semuanya
  // muncul di balik pesan umum "fetch failed" yang sama.
  if (
    /(menghubungi|menolak|tidak merespons|tidak valid).{0,40}proxy|proxy.{0,40}(menolak|tidak merespons|tidak valid)|407/.test(
      teks
    )
  ) {
    return "Proxy kantor tidak dapat dipakai. Periksa alamat dan port HTTPS_PROXY, pastikan proxy hidup, dan bila proxy meminta login tulis dalam bentuk http://user:sandi@host:port.";
  }
  if (/self.signed|self signed|unable to verify|cert_|certificate|depth_zero|altnames/.test(teks)) {
    return "Sertifikat HTTPS diganti di tengah jalan - biasanya karena proxy/firewall kantor menyadap TLS. Daftarkan sertifikat CA kantor lewat NODE_EXTRA_CA_CERTS pada container portal.";
  }
  if (/enotfound|eai_again|getaddrinfo/.test(teks)) {
    return "Nama domain penyedia tidak dapat diterjemahkan (DNS). Periksa pengaturan DNS container portal, atau isi HTTPS_PROXY bila jaringan kantor hanya boleh keluar lewat proxy.";
  }
  if (/etimedout|timeout|timed out|dalam \d+ ms|aborted|abort/.test(teks)) {
    return "Koneksi keluar dibiarkan menggantung sampai waktu habis - ciri khas paket ditahan firewall. Minta admin jaringan membuka akses keluar port 443 ke penyedia AI, atau isi HTTPS_PROXY.";
  }
  if (/econnrefused|econnreset|socket hang up|epipe|ehostunreach|enetunreach/.test(teks)) {
    return "Koneksi keluar ditolak atau diputus. Periksa firewall server dan pastikan port 443 ke penyedia AI diizinkan.";
  }
  if (/network|fetch failed/.test(teks)) {
    return "Server sepertinya tidak dapat menjangkau internet. Periksa akses keluar ke generativelanguage.googleapis.com (firewall/proxy jaringan kantor).";
  }
  if (/api key not valid|api_key_invalid|invalid api key|unauthorized|permission_denied|403/.test(teks)) {
    return "API key ditolak. Pastikan key benar, belum dihapus, dan tidak dibatasi ke domain/IP tertentu.";
  }
  if (/is not found for api version|not found|404|unsupported model|does not exist/.test(teks)) {
    return "Model tidak dikenali penyedia. Pilih model lain pada Pengaturan AI.";
  }
  if (/has not been used in project|api has not been enabled|service_disabled/.test(teks)) {
    return "Generative Language API belum diaktifkan pada project Google Anda. Aktifkan lebih dulu di Google Cloud Console.";
  }
  if (/quota|rate limit|resource_exhausted|429/.test(teks)) {
    return "Kuota atau batas laju penyedia terlampaui. Coba lagi nanti atau periksa tagihan/kuota project.";
  }
  return "";
}

export function sanitizePublicErrorMessage(message: unknown, fallback = "Terjadi kendala pada layanan ALETA. Silakan coba lagi.") {
  const raw = typeof message === "string" ? message.trim() : "";
  if (!raw) return fallback;

  const redacted = redactTechnicalFragments(raw);
  if (!looksTechnical(raw)) return redacted;

  const lower = raw.toLowerCase();
  // Bot tidak terhubung harus dikenali LEBIH DULU: pesannya sering hanya
  // "fetch failed"/ECONNREFUSED dan dulu salah dilaporkan sebagai gangguan AI.
  if (/aleta[ _-]?bot|127\.0\.0\.1:3003|localhost:3003|:3003\b/.test(lower)) {
    return "ALETA Bot belum dapat dihubungi. Pastikan container aleta_bot berjalan, lalu coba lagi.";
  }
  // \bai\b, bukan /ai/: tanpa batas kata, pola lama ikut cocok dengan "failed".
  if (/\bai\b|provider|gemini|openai|model|api[_-]?key/.test(lower)) {
    return "Layanan AI belum dapat memproses permintaan saat ini. Silakan coba lagi atau periksa pengaturan AI.";
  }
  if (/whatsapp|\bwa\b|gateway|puppeteer|chrom|protocol error|target closed/.test(lower)) {
    return "Layanan WhatsApp Gateway belum dapat memproses permintaan saat ini. Silakan coba hubungkan ulang atau periksa status gateway.";
  }
  if (/postgres|database|db|sql|econnrefused|getaddrinfo/.test(lower)) {
    return "Database ALETA belum dapat memproses permintaan saat ini. Silakan coba lagi atau periksa koneksi database.";
  }
  if (/upload|pdf|file|path|enoent|eacces|enospc/.test(lower)) {
    return "File belum dapat diproses. Silakan periksa file yang diunggah dan coba lagi.";
  }
  if (/backup|tar|archive|zip/.test(lower)) {
    return "Backup belum dapat dibuat saat ini. Silakan coba lagi atau periksa ruang penyimpanan server.";
  }

  return fallback;
}

export function sanitizePublicErrorDetails(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactTechnicalFragments(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizePublicErrorDetails(item, depth + 1));
  if (typeof value !== "object") return String(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitizePublicErrorDetails(item, depth + 1),
    ])
  );
}
