function asciiFallbackFileName(fileName: string) {
  return String(fileName || "download")
    .replace(/[\\/:*?"<>|\r\n]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180) || "download";
}

export function buildAttachmentContentDisposition(fileName: string) {
  const fallback = asciiFallbackFileName(fileName).replace(/"/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function getAttachmentSecurityHeaders() {
  return {
    "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
    pragma: "no-cache",
    expires: "0",
    "x-content-type-options": "nosniff",
    "x-download-options": "noopen",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
    "content-security-policy": "sandbox",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
}

export function getInlineFileSecurityHeaders() {
  return {
    "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
    pragma: "no-cache",
    expires: "0",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
    "content-security-policy": "frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
}
