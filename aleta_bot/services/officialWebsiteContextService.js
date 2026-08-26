const axios = require("axios").default;

const { readRuntimeConfig } = require("../config/runtime-config");

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_CONTEXT_CHARS = 6000;
const MAX_PAGES = 3;
const cache = new Map();

const KEYWORD_GROUPS = {
  pendaftaran: ["daftar", "pendaftaran", "gugatan", "permohonan", "perkara", "prodeo", "ecourt", "e-court"],
  ecourt: ["ecourt", "e-court", "elektronik", "online", "elitigasi", "e-litigasi"],
  pengaduan: ["pengaduan", "lapor", "siwas", "whistle", "keluhan"],
  alamat: ["alamat", "kontak", "telepon", "lokasi", "ptsp", "layanan"],
  akta: ["akta", "cerai", "produk", "pengambilan"],
  putusan: ["putusan", "salinan", "penetapan", "direktori"],
  biaya: ["biaya", "panjar", "radius", "skum", "tarif"],
  jadwal: ["jadwal", "sidang", "persidangan"],
};

function normalizeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host.startsWith("127.") || host.startsWith("169.254.")) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function safeSameOriginUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) return "";
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (isPrivateHostname(url.hostname)) return "";
    if (/\.(pdf|docx?|xlsx?|zip|rar|jpg|jpeg|png|gif|webp|mp4|mp3)$/i.test(url.pathname)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractReadableText(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function buildKeywords(question, intent = {}) {
  const text = `${question || ""} ${intent.key || ""} ${intent.name || ""} ${intent.category || ""}`.toLowerCase();
  const keywords = new Set();
  for (const [group, values] of Object.entries(KEYWORD_GROUPS)) {
    if (text.includes(group) || values.some((value) => text.includes(value))) {
      values.forEach((value) => keywords.add(value));
    }
  }
  String(question || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .slice(0, 8)
    .forEach((word) => keywords.add(word));
  return [...keywords].slice(0, 16);
}

function extractCandidateLinks(html, baseUrl, keywords) {
  const links = [];
  const seen = new Set();
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    const href = match[1];
    const label = extractReadableText(match[2] || "");
    const url = safeSameOriginUrl(href, baseUrl);
    if (!url || seen.has(url)) continue;
    const haystack = `${url} ${label}`.toLowerCase();
    const score = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);
    if (score <= 0) continue;
    seen.add(url);
    links.push({ url, score });
  }
  return links
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES - 1)
    .map((item) => item.url);
}

async function fetchPage(url) {
  const parsed = new URL(url);
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error("Website identitas instansi tidak boleh mengarah ke alamat lokal/private.");
  }
  const response = await axios.get(url, {
    timeout: 7000,
    responseType: "text",
    maxContentLength: MAX_PAGE_BYTES,
    headers: {
      "user-agent": "ALETA-Bot/1.0 (+official-public-info)",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return String(response.data || "");
}

function compactRelevantText(text, keywords) {
  const cleaned = extractReadableText(text);
  if (!keywords.length) return cleaned.slice(0, MAX_CONTEXT_CHARS);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\s{2,}/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30);
  const relevant = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
  const picked = (relevant.length ? relevant : sentences).slice(0, 20).join("\n");
  return picked.slice(0, MAX_CONTEXT_CHARS);
}

async function buildOfficialWebsiteContext({ question = "", intent = {} } = {}) {
  const runtime = readRuntimeConfig();
  const identity = runtime.institutionIdentity || {};
  const websiteUrl = normalizeWebsiteUrl(identity.website);
  if (!websiteUrl) {
    return {
      available: false,
      reason: "website_not_configured",
      courtName: identity.courtName || "pengadilan",
      websiteUrl: "",
      contextText: "",
      pages: [],
    };
  }

  const cacheKey = `${websiteUrl}|${intent.key || ""}|${String(question || "").toLowerCase().slice(0, 160)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const keywords = buildKeywords(question, intent);
    const homepageHtml = await fetchPage(websiteUrl);
    const candidateLinks = extractCandidateLinks(homepageHtml, websiteUrl, keywords);
    const pageUrls = [websiteUrl, ...candidateLinks].slice(0, MAX_PAGES);
    const pages = [];
    for (const url of pageUrls) {
      const html = url === websiteUrl ? homepageHtml : await fetchPage(url);
      pages.push({
        url,
        text: compactRelevantText(html, keywords),
      });
    }
    const contextText = pages
      .map((page, index) => `Sumber ${index + 1}: ${page.url}\n${page.text}`)
      .join("\n\n")
      .slice(0, MAX_CONTEXT_CHARS);
    const value = {
      available: Boolean(contextText.trim()),
      reason: contextText.trim() ? "ok" : "empty_website_context",
      courtName: identity.courtName || identity.courtShortName || "pengadilan",
      websiteUrl,
      contextText,
      pages: pages.map((page) => page.url),
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    const value = {
      available: false,
      reason: "website_fetch_failed",
      errorMessage: String(error?.message || error || "Website resmi tidak dapat dibaca.").slice(0, 300),
      courtName: identity.courtName || identity.courtShortName || "pengadilan",
      websiteUrl,
      contextText: "",
      pages: [websiteUrl],
    };
    cache.set(cacheKey, { expiresAt: Date.now() + Math.min(CACHE_TTL_MS, 60 * 1000), value });
    return value;
  }
}

module.exports = {
  buildOfficialWebsiteContext,
  normalizeWebsiteUrl,
};
