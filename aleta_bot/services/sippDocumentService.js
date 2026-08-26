// =============================================================================
// Resolusi dokumen SIPP (mis. petitum_dok / dokumen gugatan) untuk lampiran
// WhatsApp. Logika ini dulu berada di app.js; dipindahkan ke sini supaya bisa
// diuji dan didiagnosis TANPA menyalakan client WhatsApp.
//
// Dua strategi berurutan, sesuai perilaku asli:
//   1. Baca file langsung dari SIPP_DOCUMENT_ROOTS (butuh mount di container).
//   2. Bila tidak ada, unduh lewat SIPP_DOCUMENT_BASE_URL.
//
// Akses ke SIPP tetap READ-ONLY: modul ini hanya membaca berkas.
// =============================================================================
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const SIPP_DOCUMENT_ROOTS = String(
  process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS ||
  process.env.ALETA_BOT_SIPP_DOCUMENT_ROOT ||
  "/var/www/html/SIPP,/usr/src/app/SIPP"
)
  .split(/[;,]/)
  .map((item) => item.trim())
  .filter(Boolean);
const SIPP_DOCUMENT_BASE_URL = String(
  process.env.ALETA_BOT_SIPP_DOCUMENT_BASE_URL || "http://127.0.0.1/SIPP"
).replace(/\/+$/, "");
const ALLOWED_SIPP_DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".rtf", ".odt"]);

function sanitizeSippDocumentInput(documentPath) {
  const raw = String(documentPath || "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "null") {
    return { ok: false, reason: "Path dokumen kosong." };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsedUrl = new URL(raw);
      const extension = path.extname(parsedUrl.pathname).toLowerCase();
      if (!ALLOWED_SIPP_DOCUMENT_EXTENSIONS.has(extension)) {
        return { ok: false, reason: `Ekstensi dokumen tidak didukung: ${extension || "tanpa ekstensi"}.` };
      }
      return {
        ok: true,
        isUrl: true,
        url: parsedUrl.toString(),
        relativePath: decodeURIComponent(parsedUrl.pathname.split("/").filter(Boolean).join("/")),
        fileName: path.basename(parsedUrl.pathname),
      };
    } catch (error) {
      return { ok: false, reason: `URL dokumen tidak valid: ${error.message}` };
    }
  }

  const normalized = raw.replace(/\\/g, "/");
  if (normalized.includes("\0")) {
    return { ok: false, reason: "Path dokumen mengandung karakter tidak valid." };
  }

  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_SIPP_DOCUMENT_EXTENSIONS.has(extension)) {
    return { ok: false, reason: `Ekstensi dokumen tidak didukung: ${extension || "tanpa ekstensi"}.` };
  }

  const matchingRootFromRawPath = SIPP_DOCUMENT_ROOTS.find((root) => {
    const normalizedRoot = path.posix.normalize(String(root).replace(/\\/g, "/"));
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  });
  const isWindowsAbsolutePath = /^[A-Za-z]:\//.test(normalized);
  const isAbsolutePath = Boolean(matchingRootFromRawPath || isWindowsAbsolutePath);
  if (isAbsolutePath) {
    const absolutePath = path.resolve(normalized);
    const matchingRoot = matchingRootFromRawPath || SIPP_DOCUMENT_ROOTS.find((root) => {
      const resolvedRoot = path.resolve(root);
      return absolutePath === resolvedRoot || absolutePath.startsWith(`${resolvedRoot}${path.sep}`);
    });
    const relativePath = matchingRoot
      ? path.relative(path.resolve(matchingRoot), absolutePath).replace(/\\/g, "/")
      : path.basename(absolutePath);
    return {
      ok: true,
      isUrl: false,
      absolutePath,
      relativePath,
      fileName: path.basename(absolutePath),
    };
  }

  const relativePath = path.posix.normalize(normalized.replace(/^\/+/, ""));
  if (!relativePath || relativePath === "." || relativePath === ".." || relativePath.startsWith("../")) {
    return { ok: false, reason: "Path dokumen keluar dari folder SIPP." };
  }

  return {
    ok: true,
    isUrl: false,
    relativePath,
    fileName: path.basename(relativePath),
  };
}

function findReadableSippDocument(documentInfo) {
  const candidates = [];
  if (documentInfo.absolutePath) {
    candidates.push(documentInfo.absolutePath);
  }
  for (const root of SIPP_DOCUMENT_ROOTS) {
    candidates.push(path.resolve(root, ...documentInfo.relativePath.split("/")));
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch (_) {
      // Coba kandidat berikutnya.
    }
  }

  return null;
}

function buildSippDocumentUrl(relativePath) {
  if (!SIPP_DOCUMENT_BASE_URL || !relativePath) return "";
  const encodedPath = relativePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${SIPP_DOCUMENT_BASE_URL}/${encodedPath}`;
}

function checkRemoteDocument(url) {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false, reason: "Base URL dokumen SIPP belum tersedia." });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return resolve({ ok: false, reason: `URL dokumen tidak valid: ${error.message}` });
    }

    const transport = parsedUrl.protocol === "https:" ? https : http;
    const request = transport.request(parsedUrl, { method: "HEAD", timeout: 8000 }, (response) => {
      response.resume();
      const statusCode = response.statusCode || 0;
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (statusCode === 405) {
        return resolve({ ok: true });
      }
      if (statusCode < 200 || statusCode >= 400) {
        return resolve({ ok: false, reason: `HTTP ${statusCode} saat membaca dokumen SIPP.` });
      }
      if (contentType.includes("text/html")) {
        return resolve({ ok: false, reason: "URL dokumen mengarah ke halaman HTML, bukan file dokumen." });
      }
      return resolve({ ok: true });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, reason: "Timeout saat mengecek URL dokumen SIPP." });
    });
    request.on("error", (error) => resolve({ ok: false, reason: error.message }));
    request.end();
  });
}

/**
 * Diagnostik: jelaskan bagaimana sebuah path dokumen SIPP akan diselesaikan,
 * tanpa mengirim pesan apa pun. Dipakai scripts/check-sipp-document.js.
 */
async function describeSippDocument(documentPath) {
  const info = sanitizeSippDocumentInput(documentPath);
  if (!info.ok) {
    return { ok: false, stage: "validasi", reason: info.reason, roots: SIPP_DOCUMENT_ROOTS };
  }

  if (info.isUrl) {
    const remote = await checkRemoteDocument(info.url);
    return {
      ok: remote.ok,
      stage: "url",
      reason: remote.ok ? "" : remote.reason,
      fileName: info.fileName,
      resolvedFrom: info.url,
    };
  }

  const localPath = findReadableSippDocument(info);
  if (localPath) {
    let size = null;
    try {
      size = fs.statSync(localPath).size;
    } catch (_) {
      // Ukuran tidak wajib untuk diagnosis.
    }
    return { ok: true, stage: "lokal", fileName: info.fileName, resolvedFrom: localPath, size, roots: SIPP_DOCUMENT_ROOTS };
  }

  const remoteUrl = buildSippDocumentUrl(info.relativePath);
  const remote = await checkRemoteDocument(remoteUrl);
  return {
    ok: remote.ok,
    stage: remote.ok ? "url-fallback" : "gagal",
    reason: remote.ok ? "" : `${remote.reason} File juga tidak ditemukan di root lokal: ${SIPP_DOCUMENT_ROOTS.join(", ")}.`,
    fileName: info.fileName,
    resolvedFrom: remoteUrl,
    roots: SIPP_DOCUMENT_ROOTS,
  };
}

module.exports = {
  SIPP_DOCUMENT_ROOTS,
  SIPP_DOCUMENT_BASE_URL,
  ALLOWED_SIPP_DOCUMENT_EXTENSIONS,
  sanitizeSippDocumentInput,
  findReadableSippDocument,
  buildSippDocumentUrl,
  checkRemoteDocument,
  describeSippDocument,
};
