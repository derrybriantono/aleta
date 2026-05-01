import { type QueryResultRow } from "pg";

import {
  buildDerivedCourtIdentity,
  getCourtDirectoryEntryById,
  getCourtDirectoryEntryByName,
  searchCourtDirectory,
} from "@/lib/court-catalog";
import { normalizeAIFeatureFlags } from "@/lib/ai-feature-flags";
import {
  type InstitutionIdentity,
  type InstitutionIdentityEnrichmentConfidence,
  type InstitutionIdentityEnrichmentMetadata,
  type InstitutionIdentityEnrichmentSourceType,
  type InstitutionIdentityEnrichmentStatus,
} from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { requestStructuredDataFromProvider } from "@/server/modules/ai/provider-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";
import { parseJsonArray, stringifyJson } from "@/server/shared/json";

const IDENTITY_FIELDS = [
  "courtName",
  "courtShortName",
  "address",
  "phoneNumber",
  "mobilePhone",
  "email",
  "instagram",
  "facebook",
  "youtube",
  "website",
  "mapUrl",
] as const;

type IdentityField = (typeof IDENTITY_FIELDS)[number];
type IdentitySource = InstitutionIdentityEnrichmentSourceType;

type FieldSourceMap = Partial<Record<IdentityField, IdentitySource>>;
type FieldConfidenceMap = Partial<Record<IdentityField, number>>;

type EnrichmentCacheRow = QueryResultRow & {
  court_id: string;
  query_text: string | null;
  court_name: string;
  court_short_name: string;
  address: string;
  phone_number: string;
  mobile_phone: string;
  email: string;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  website: string | null;
  map_url: string | null;
  source_official_website: string | null;
  source_google_place: string | null;
  source_google_search: string | null;
  sources_json: string | null;
  fields_found_json: string | null;
  fields_missing_json: string | null;
  warnings_json: string | null;
  confidence: InstitutionIdentityEnrichmentConfidence | null;
  field_sources_json: string;
  field_confidence_json: string;
  enrichment_status: InstitutionIdentityEnrichmentStatus;
  last_enriched_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ScrapeResult = {
  identity: IdentityInput;
  sourceUrl?: string;
  sourceLabel?: string;
  fieldSources: FieldSourceMap;
  fieldConfidence: FieldConfidenceMap;
  warnings?: string[];
};

type ResolvedInstitutionIdentity = {
  identity: InstitutionIdentity;
  suggestedIdentity: InstitutionIdentity;
  confidence: InstitutionIdentityEnrichmentConfidence;
  sources: NonNullable<InstitutionIdentityEnrichmentMetadata["sources"]>;
  warnings: string[];
  fieldsFound: IdentityField[];
  fieldsMissing: IdentityField[];
  metadata: InstitutionIdentityEnrichmentMetadata;
  baseIdentity: InstitutionIdentity;
};

type JsonRecord = Record<string, unknown>;
type IdentityInput = Partial<Record<IdentityField, unknown>>;

const CATALOG_FIELD_CONFIDENCE: Record<IdentityField, number> = {
  courtName: 0.99,
  courtShortName: 0.96,
  address: 0.78,
  phoneNumber: 0.78,
  mobilePhone: 0.78,
  email: 0.78,
  instagram: 0.76,
  facebook: 0.76,
  youtube: 0.76,
  website: 0.88,
  mapUrl: 0.72,
};

const GOOGLE_PLACES_FIELD_CONFIDENCE: Record<IdentityField, number> = {
  courtName: 0.9,
  courtShortName: 0.82,
  address: 0.88,
  phoneNumber: 0.86,
  mobilePhone: 0.62,
  email: 0.3,
  instagram: 0.3,
  facebook: 0.3,
  youtube: 0.3,
  website: 0.86,
  mapUrl: 0.88,
};

const GOOGLE_SEARCH_FIELD_CONFIDENCE: Record<IdentityField, number> = {
  courtName: 0.82,
  courtShortName: 0.78,
  address: 0.55,
  phoneNumber: 0.45,
  mobilePhone: 0.35,
  email: 0.35,
  instagram: 0.35,
  facebook: 0.35,
  youtube: 0.35,
  website: 0.78,
  mapUrl: 0.45,
};

const OFFICIAL_FIELD_CONFIDENCE: Record<IdentityField, number> = {
  courtName: 0.9,
  courtShortName: 0.88,
  address: 0.94,
  phoneNumber: 0.92,
  mobilePhone: 0.91,
  email: 0.89,
  instagram: 0.9,
  facebook: 0.9,
  youtube: 0.9,
  website: 0.98,
  mapUrl: 0.8,
};

const AI_NORMALIZATION_CONFIDENCE: Record<IdentityField, number> = {
  courtName: 0.74,
  courtShortName: 0.74,
  address: 0.7,
  phoneNumber: 0.68,
  mobilePhone: 0.68,
  email: 0.68,
  instagram: 0.68,
  facebook: 0.68,
  youtube: 0.68,
  website: 0.68,
  mapUrl: 0.62,
};

function toSafeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function normalizeIdentityValue(value: unknown) {
  return toSafeString(value);
}

function normalizeInstitutionIdentity(source: IdentityInput | null | undefined): InstitutionIdentity {
  return {
    courtName: normalizeIdentityValue(source?.courtName),
    courtShortName: normalizeIdentityValue(source?.courtShortName),
    address: normalizeIdentityValue(source?.address),
    phoneNumber: normalizeIdentityValue(source?.phoneNumber),
    mobilePhone: normalizeIdentityValue(source?.mobilePhone),
    email: normalizeIdentityValue(source?.email),
    instagram: normalizeIdentityValue(source?.instagram),
    facebook: normalizeIdentityValue(source?.facebook),
    youtube: normalizeIdentityValue(source?.youtube),
    website: normalizeIdentityValue(source?.website),
    mapUrl: normalizeIdentityValue(source?.mapUrl),
  };
}

function sanitizeUserWarning(value: unknown) {
  const warning = toSafeString(value);
  if (!warning) return "";
  if (/trim is not a function|quota|rate-limit|rate limit|high demand|api\.google|generate_content|stack|typeerror/i.test(warning)) {
    return "Sebagian layanan AI/eksternal belum dapat dipakai saat ini. Sistem tetap memakai data lokal dan sumber resmi yang tersedia.";
  }
  return warning;
}

function normalizePhoneValue(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("62")) return compact;
  return compact;
}

function parseJsonRecord(value: unknown): JsonRecord {
  const rawValue = toSafeString(value);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([\da-f]+);/gi, (_, digits: string) => String.fromCharCode(Number.parseInt(digits, 16)));
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractContactSnippet(text: string) {
  const markers = ["hubungi kami", "kontak", "alamat", "telpon", "telepon", "whatsapp"];
  const lower = text.toLowerCase();
  const candidateSlices: Array<{ snippet: string; score: number }> = [];

  for (const marker of markers) {
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const index = lower.indexOf(marker, fromIndex);
      if (index === -1) {
        break;
      }

      const snippet = text.slice(index, Math.min(text.length, index + 1400));
      const score =
        (/(?:j(?:l|ln|alan)\.?|kab\.|kabupaten|kec\.|kecamatan|kota|prov\.|provinsi)/i.test(snippet) ? 6 : 0) +
        (/(?:telp|telpon|telepon)\s*[:\-]?\s*[+()0-9.\-\s]{7,32}/i.test(snippet) ? 5 : 0) +
        (/(?:whatsapp|wa)\s*[:\-]?\s*[+()0-9.\-\s]{7,32}/i.test(snippet) ? 4 : 0) +
        (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(snippet) ? 4 : 0);

      candidateSlices.push({ snippet, score });
      fromIndex = index + marker.length;
    }
  }

  const bestCandidate = candidateSlices.sort((left, right) => right.score - left.score)[0];
  if (bestCandidate && bestCandidate.score > 0) {
    return bestCandidate.snippet;
  }

  return text.slice(0, 1200);
}

function looksLikeValidAddress(value: string) {
  const normalized = value.trim();
  if (normalized.length < 12) return false;
  if (/^(dan|kontak|alamat dan kontak|hubungi kami)$/i.test(normalized)) return false;
  if (/(Kab|Kec|Kel|Prov)\.\s+[A-Za-z]{1,2}$/i.test(normalized)) return false;

  return /(?:j(?:l|ln|alan)\.?|kab\.|kabupaten|kec\.|kecamatan|kota|prov\.|provinsi|no\.|\d{2,})/i.test(normalized);
}

function extractStreetLikeAddress(text: string) {
  const addressTerminator = String.raw`\b(?:Telp|Telpon|Telepon|Fax|Email|Whatsapp|WA|Tautan|Jam Pelayanan)\b|$`;
  const directStreetMatch = text.match(
    new RegExp(`(J(?:l|ln|alan)\\.?[\\s\\S]{10,320}?)(?=${addressTerminator})`, "i")
  );
  if (directStreetMatch?.[1]) {
    return sanitizeAddress(directStreetMatch[1]);
  }

  const contextualStreetMatch = text.match(
    new RegExp(
      `Pengadilan[\\s\\S]{0,80}?(J(?:l|ln|alan)\\.?[\\s\\S]{10,320}?)(?=${addressTerminator})`,
      "i"
    )
  );
  if (contextualStreetMatch?.[1]) {
    return sanitizeAddress(contextualStreetMatch[1]);
  }

  return "";
}

function pickBestPhoneCandidate(matches: RegExpMatchArray | null, { preferMobile }: { preferMobile: boolean }) {
  if (!matches || matches.length === 0) return "";

  const candidates = Array.from(
    new Set(
      matches
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter((item) => item.length >= 8)
        .filter((item) => !/\d{2}[-/]\d{2}[-/]\d{2,4}/.test(item))
        .filter((item) => !/\d+\.\d{3,}/.test(item))
    )
  );

  const prioritized = candidates.find((item) => {
    const digits = item.replace(/\D/g, "");
    if (digits.length < 8) return false;
    return preferMobile ? digits.startsWith("08") || digits.startsWith("628") : digits.startsWith("0");
  });

  return normalizePhoneValue(prioritized ?? candidates[0] ?? "");
}

function extractLabelValue(text: string, labels: string[], terminators: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(
      `${label}\\s*[:\\-]?\\s*(.{6,240}?)(?=(?:${terminators.join("|")})\\s*[:\\-]?|$)`,
      "i"
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function sanitizeAddress(value: string) {
  return value
    .replace(/\bwebsite\b.*$/i, "")
    .replace(/\bfax\b.*$/i, "")
    .replace(/\bemail\b.*$/i, "")
    .replace(/\btelp(?:on)?\b.*$/i, "")
    .replace(/\bwhatsapp\b.*$/i, "")
    .replace(/\bsms\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPreferredSocialUrl(urls: string[], platform: "instagram" | "facebook" | "youtube") {
  const cleaned = Array.from(
    new Set(
      urls
        .map((item) => decodeHtmlEntities(item).replace(/[)>,]+$/g, "").trim())
        .filter(Boolean)
    )
  );

  const filtered = cleaned.filter((item) => {
    if (platform === "instagram") return !item.includes("/p/") && !item.includes("/reel/");
    if (platform === "facebook") return !item.includes("/share/") && !item.includes("sharer.php");
    if (platform === "youtube") {
      return item.includes("/channel/") || item.includes("/@") || item.includes("/c/") || item.includes("/user/");
    }
    return true;
  });

  return filtered[0] ?? "";
}

function extractSocialLinks(html: string) {
  const urlRegex = new RegExp("https?:\\/\\/[^\\s\\\"'<>]+", "gi");
  const urls = Array.from(new Set(html.match(urlRegex) ?? []));

  return {
    instagram: pickPreferredSocialUrl(urls.filter((item) => item.toLowerCase().includes("instagram.com")), "instagram"),
    facebook: pickPreferredSocialUrl(urls.filter((item) => /(facebook\.com|fb\.com)/i.test(item)), "facebook"),
    youtube: pickPreferredSocialUrl(urls.filter((item) => /(youtube\.com|youtu\.be)/i.test(item)), "youtube"),
  };
}

function extractEmails(html: string) {
  return Array.from(
    new Set(
      html
        .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)
        ?.map((item) => item.trim().toLowerCase())
        .filter((item) => !item.endsWith("@example.com")) ?? []
    )
  );
}

function extractIdentityFromOfficialHtml(html: string, sourceUrl: string): ScrapeResult {
  const text = htmlToText(html);
  const snippet = extractContactSnippet(text);
  const socials = extractSocialLinks(html);
  const emailCandidates = extractEmails(html);

  const labeledAddress = sanitizeAddress(
    extractLabelValue(snippet, ["alamat"], ["telp", "telpon", "telepon", "fax", "email", "website", "whatsapp", "sms"])
  );
  const streetAddress = extractStreetLikeAddress(snippet);
  const address = looksLikeValidAddress(labeledAddress)
    ? labeledAddress
    : looksLikeValidAddress(streetAddress)
      ? streetAddress
      : "";
  const phone = pickBestPhoneCandidate(
    snippet.match(/(?:telp|telpon|telepon)\s*[:\-]?\s*([+()0-9.\-\s]{7,32})/gi),
    { preferMobile: false }
  );
  const mobile = pickBestPhoneCandidate(
    snippet.match(/(?:sms\s*\/\s*whatsapp|whatsapp|wa)\s*[:\-]?\s*([+()0-9.\-\s]{7,32})/gi),
    { preferMobile: true }
  );
  const email = emailCandidates[0] ?? "";

  const identity = normalizeInstitutionIdentity({
    address,
    phoneNumber: phone,
    mobilePhone: mobile,
    email,
    instagram: socials.instagram,
    facebook: socials.facebook,
    youtube: socials.youtube,
    website: sourceUrl,
  });

  const fieldSources: FieldSourceMap = {};
  const fieldConfidence: FieldConfidenceMap = {};
  for (const field of IDENTITY_FIELDS) {
    if (normalizeIdentityValue(identity[field])) {
      fieldSources[field] = "official_website";
      fieldConfidence[field] = OFFICIAL_FIELD_CONFIDENCE[field];
    }
  }

  return {
    identity,
    sourceUrl,
    fieldSources,
    fieldConfidence,
  };
}

function mergeIdentityWithSource(
  target: InstitutionIdentity,
  targetSources: FieldSourceMap,
  targetConfidence: FieldConfidenceMap,
  sourceIdentity: IdentityInput,
  sourceName: IdentitySource,
  confidenceCatalog: Record<IdentityField, number>,
  { onlyFillEmpty = false, preserveCatalogName = false }: { onlyFillEmpty?: boolean; preserveCatalogName?: boolean } = {}
) {
  for (const field of IDENTITY_FIELDS) {
    const nextValue = normalizeIdentityValue(sourceIdentity[field]);
    if (!nextValue) continue;

    const currentValue = normalizeIdentityValue(target[field]);
    const shouldSkip =
      (onlyFillEmpty && currentValue) ||
      (preserveCatalogName &&
        (field === "courtName" || field === "courtShortName") &&
        targetSources[field] === "local" &&
        currentValue);

    if (shouldSkip) {
      continue;
    }

    target[field] = nextValue;
    targetSources[field] = sourceName;
    targetConfidence[field] = confidenceCatalog[field];
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "ALETA Identity Enrichment/1.0 (+https://localhost:3000)",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Gagal memuat ${url} (${response.status})`);
  }

  return response.text();
}

function extractContactPageUrls(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[1] ?? "").trim();
    const linkText = htmlToText(match[2] ?? "").toLowerCase();
    if (!href) continue;
    if (!/(hubungi|kontak|alamat|contact)/i.test(`${href} ${linkText}`)) continue;

    try {
      const resolved = new URL(href, base).toString();
      if (new URL(resolved).hostname !== base.hostname) continue;
      urls.push(resolved);
    } catch {
      continue;
    }
  }

  return Array.from(new Set(urls)).slice(0, 2);
}

async function enrichIdentityFromOfficialWebsite(baseIdentity: InstitutionIdentity): Promise<ScrapeResult> {
  const websiteUrl = normalizeIdentityValue(baseIdentity.website);
  if (!websiteUrl) {
    return {
      identity: {},
      fieldSources: {},
      fieldConfidence: {},
    };
  }

  const homepageHtml = await fetchText(websiteUrl);
  const mergedIdentity = normalizeInstitutionIdentity({});
  const mergedSources: FieldSourceMap = {};
  const mergedConfidence: FieldConfidenceMap = {};

  const homepageParsed = extractIdentityFromOfficialHtml(homepageHtml, websiteUrl);
  mergeIdentityWithSource(
    mergedIdentity,
    mergedSources,
    mergedConfidence,
    homepageParsed.identity,
    "official_website",
    OFFICIAL_FIELD_CONFIDENCE
  );

  const needsContactPage =
    !mergedIdentity.address ||
    (!mergedIdentity.phoneNumber && !mergedIdentity.mobilePhone) ||
    (!mergedIdentity.instagram && !mergedIdentity.facebook && !mergedIdentity.youtube && !mergedIdentity.email);

  if (needsContactPage) {
    const candidatePages = extractContactPageUrls(homepageHtml, websiteUrl).slice(0, 1);

    for (const pageUrl of candidatePages) {
      try {
        const html = await fetchText(pageUrl);
        const parsed = extractIdentityFromOfficialHtml(html, websiteUrl);
        mergeIdentityWithSource(
          mergedIdentity,
          mergedSources,
          mergedConfidence,
          parsed.identity,
          "official_website",
          OFFICIAL_FIELD_CONFIDENCE
        );
      } catch {
        // Ignore secondary page failures to keep enrichment controlled.
      }
    }
  }

  return {
    identity: mergedIdentity,
    sourceUrl: websiteUrl,
    fieldSources: mergedSources,
    fieldConfidence: mergedConfidence,
  };
}

function getGooglePlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ""
  );
}

function getGoogleSearchConfig() {
  return {
    apiKey:
      process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      "",
    searchEngineId:
      process.env.GOOGLE_CSE_ID?.trim() ||
      process.env.GOOGLE_SEARCH_ENGINE_ID?.trim() ||
      process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim() ||
      "",
  };
}

function isLikelyOfficialCourtWebsite(url: unknown, courtName: unknown) {
  const normalizedUrl = toSafeString(url);
  if (!normalizedUrl) return false;
  try {
    const parsed = new URL(normalizedUrl);
    const hostname = parsed.hostname.toLowerCase();
    const normalizedName = toSafeString(courtName).toLowerCase();

    return (
      hostname.endsWith(".go.id") &&
      (/(^|\.)((pa|pta|pn|pt)-|pengadilan|mahkamahagung|badilag)/i.test(hostname) ||
        normalizedName.includes("pengadilan") ||
        normalizedName.includes("mahkamah agung"))
    );
  } catch {
    return false;
  }
}

function buildSourceUrl(url: unknown) {
  const normalizedUrl = toSafeString(url);
  if (!normalizedUrl) return undefined;
  try {
    return new URL(normalizedUrl).toString();
  } catch {
    return undefined;
  }
}

async function enrichIdentityFromGooglePlaces(query: string): Promise<ScrapeResult> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return {
      identity: {},
      fieldSources: {},
      fieldConfidence: {},
      warnings: ["Google Places/Maps API key belum dikonfigurasi."],
    };
  }

  const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  textSearchUrl.searchParams.set("query", `${query} pengadilan Indonesia`);
  textSearchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(textSearchUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!searchResponse.ok) {
    throw new Error(`Google Places Text Search gagal (${searchResponse.status}).`);
  }

  const searchPayload = (await searchResponse.json().catch(() => null)) as
    | {
        status?: string;
        error_message?: string;
        results?: Array<{
          place_id?: string;
          name?: string;
          formatted_address?: string;
          business_status?: string;
          rating?: number;
          user_ratings_total?: number;
        }>;
      }
    | null;

  if (!searchPayload || (searchPayload.status && searchPayload.status !== "OK" && searchPayload.status !== "ZERO_RESULTS")) {
    throw new Error(searchPayload?.error_message ?? `Google Places mengembalikan status ${searchPayload?.status ?? "tidak diketahui"}.`);
  }

  const result = searchPayload.results?.find((item) => /pengadilan|mahkamah agung/i.test(item.name ?? "")) ?? searchPayload.results?.[0];
  if (!result?.place_id) {
    return {
      identity: {},
      fieldSources: {},
      fieldConfidence: {},
      warnings: ["Google Places tidak menemukan kandidat pengadilan yang cukup relevan."],
    };
  }

  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", result.place_id);
  detailsUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,international_phone_number,website,url,business_status");
  detailsUrl.searchParams.set("key", apiKey);

  const detailsResponse = await fetch(detailsUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!detailsResponse.ok) {
    throw new Error(`Google Places Details gagal (${detailsResponse.status}).`);
  }

  const detailsPayload = (await detailsResponse.json().catch(() => null)) as
    | {
        status?: string;
        error_message?: string;
        result?: {
          name?: string;
          formatted_address?: string;
          formatted_phone_number?: string;
          international_phone_number?: string;
          website?: string;
          url?: string;
          business_status?: string;
        };
      }
    | null;

  if (!detailsPayload || (detailsPayload.status && detailsPayload.status !== "OK")) {
    throw new Error(detailsPayload?.error_message ?? `Google Places Details mengembalikan status ${detailsPayload?.status ?? "tidak diketahui"}.`);
  }

  const details = detailsPayload.result ?? {};
  const identity = normalizeInstitutionIdentity({
    courtName: details.name || result.name || "",
    address: details.formatted_address || result.formatted_address || "",
    phoneNumber: details.formatted_phone_number || details.international_phone_number || "",
    website: buildSourceUrl(details.website),
    mapUrl: buildSourceUrl(details.url),
  });

  const fieldSources: FieldSourceMap = {};
  const fieldConfidence: FieldConfidenceMap = {};
  for (const field of IDENTITY_FIELDS) {
    if (normalizeIdentityValue(identity[field])) {
      fieldSources[field] = "google_places";
      fieldConfidence[field] = GOOGLE_PLACES_FIELD_CONFIDENCE[field];
    }
  }

  return {
    identity,
    sourceUrl: details.url,
    sourceLabel: details.name || result.name || "Google Places",
    fieldSources,
    fieldConfidence,
    warnings:
      details.business_status && details.business_status !== "OPERATIONAL"
        ? [`Google Places menandai status bisnis sebagai ${details.business_status}.`]
        : [],
  };
}

async function enrichIdentityFromGoogleSearch(query: string, courtName: string): Promise<ScrapeResult> {
  const { apiKey, searchEngineId } = getGoogleSearchConfig();
  if (!apiKey || !searchEngineId) {
    return {
      identity: {},
      fieldSources: {},
      fieldConfidence: {},
      warnings: ["Google Search/CSE belum dikonfigurasi."],
    };
  }

  const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("cx", searchEngineId);
  searchUrl.searchParams.set("num", "5");
  searchUrl.searchParams.set("q", `${query} pengadilan site:go.id`);

  const response = await fetch(searchUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`Google Custom Search gagal (${response.status}).`);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        items?: Array<{
          title?: string;
          link?: string;
          snippet?: string;
        }>;
      }
    | null;

  if (payload?.error?.message) {
    throw new Error(payload.error.message);
  }

  const officialItem = payload?.items?.find((item) => isLikelyOfficialCourtWebsite(item.link, courtName));
  if (!officialItem?.link) {
    return {
      identity: {},
      fieldSources: {},
      fieldConfidence: {},
      warnings: ["Google Search tidak menemukan website resmi .go.id yang cukup yakin."],
    };
  }

  const identity = normalizeInstitutionIdentity({
    website: buildSourceUrl(officialItem.link),
  });
  const fieldSources: FieldSourceMap = {};
  const fieldConfidence: FieldConfidenceMap = {};
  if (identity.website) {
    fieldSources.website = "google_search";
    fieldConfidence.website = GOOGLE_SEARCH_FIELD_CONFIDENCE.website;
  }

  return {
    identity,
    sourceUrl: officialItem.link,
    sourceLabel: officialItem.title || "Google Search",
    fieldSources,
    fieldConfidence,
  };
}

type AiNormalizedIdentity = {
  courtName?: string;
  courtShortName?: string;
  address?: string;
  phoneNumber?: string;
  mobilePhone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  website?: string;
  warnings?: string[];
};

function findActiveAIConnection(aiConfig: Awaited<ReturnType<typeof getAISettingsFromDb>>) {
  return (
    aiConfig.providers.find((provider) => provider.id === aiConfig.activeConnectionId) ??
    aiConfig.providers.find((provider) => provider.isActive) ??
    aiConfig.providers.find(
      (provider) => provider.providerId === aiConfig.providerId && provider.modelId === aiConfig.modelId
    ) ??
    null
  );
}

async function normalizeIdentityWithAI(
  db: AletaDatabase,
  identity: InstitutionIdentity,
  fieldSources: FieldSourceMap,
  sources: InstitutionIdentityEnrichmentMetadata["sources"],
  warnings: string[]
) {
  const aiConfig = await getAISettingsFromDb(db, { includeSecrets: true }).catch(() => null);
  if (!aiConfig?.enabled) {
    warnings.push("AI provider belum aktif; normalisasi hanya memakai hasil sumber terverifikasi.");
    return false;
  }

  const flags = normalizeAIFeatureFlags(aiConfig.featureFlags).institutionIdentity;
  if (!flags.enabled || !flags.aiNormalization) {
    warnings.push("Normalisasi AI identitas instansi sedang dinonaktifkan oleh administrator.");
    return false;
  }

  const activeProvider = findActiveAIConnection(aiConfig);
  if (!activeProvider?.apiKey?.trim()) {
    warnings.push("AI provider aktif belum memiliki API key; normalisasi AI dilewati.");
    return false;
  }

  const result = await requestStructuredDataFromProvider<AiNormalizedIdentity>({
    providerId: activeProvider.providerId ?? aiConfig.providerId,
    endpointUrl: activeProvider.endpointUrl,
    apiKey: activeProvider.apiKey,
    modelId: activeProvider.modelId ?? aiConfig.modelId,
    fallback: {},
    systemPrompt:
      "Anda membantu menormalisasi identitas pengadilan Indonesia dari data yang sudah ditemukan. Balas HANYA JSON. Jangan mengarang field baru. Kosongkan field jika tidak ada bukti dari input. Jangan memakai rating/review sebagai sumber identitas.",
    userPrompt: JSON.stringify({
      instruction:
        "Rapikan format nama, alamat, telepon, email, website, dan sosial media hanya dari nilai yang tersedia. Jangan menambah data di luar input.",
      identity,
      fieldSources,
      sources,
    }),
  });

  if (!result.ok) {
    console.warn("Institution identity AI normalization skipped", result.message ?? "provider tidak merespons valid");
    warnings.push(sanitizeUserWarning("Normalisasi AI belum dapat dipakai saat ini. Sistem tetap memakai data lokal dan sumber resmi yang tersedia."));
    return false;
  }

  const normalized = normalizeInstitutionIdentity(result.data);
  for (const field of IDENTITY_FIELDS) {
    const nextValue = normalizeIdentityValue(normalized[field]);
    if (!nextValue) continue;
    if (!fieldSources[field]) continue;

    identity[field] = nextValue;
  }

  if (Array.isArray(result.data.warnings)) {
    warnings.push(...result.data.warnings.filter((item) => typeof item === "string" && item.trim()));
  }

  return true;
}

function mapCacheRow(row: EnrichmentCacheRow) {
  const identity = normalizeInstitutionIdentity({
    courtName: row.court_name,
    courtShortName: row.court_short_name,
    address: row.address,
    phoneNumber: row.phone_number,
    mobilePhone: row.mobile_phone,
    email: row.email,
    instagram: row.instagram ?? "",
    facebook: row.facebook ?? "",
    youtube: row.youtube ?? "",
    website: row.website ?? "",
    mapUrl: row.map_url ?? "",
  });

  return {
    identity,
    metadata: {
      courtId: row.court_id,
      courtName: row.court_name,
      query: row.query_text ?? undefined,
      confidence: row.confidence ?? "low",
      sources: parseJsonArray<NonNullable<InstitutionIdentityEnrichmentMetadata["sources"]>[number]>(row.sources_json ?? "[]"),
      fieldsFound: parseJsonArray<keyof InstitutionIdentity>(row.fields_found_json ?? "[]"),
      fieldsMissing: parseJsonArray<keyof InstitutionIdentity>(row.fields_missing_json ?? "[]"),
      warnings: parseJsonArray<string>(row.warnings_json ?? "[]"),
      sourceOfficialWebsite: row.source_official_website ?? undefined,
      sourceGooglePlace: row.source_google_place ?? undefined,
      sourceGoogleSearch: row.source_google_search ?? undefined,
      lastEnrichedAt: row.last_enriched_at ?? undefined,
      enrichmentStatus: row.enrichment_status,
      fieldSources: parseJsonRecord(row.field_sources_json) as InstitutionIdentityEnrichmentMetadata["fieldSources"],
      fieldConfidence:
        parseJsonRecord(row.field_confidence_json) as InstitutionIdentityEnrichmentMetadata["fieldConfidence"],
      lastErrorMessage: row.last_error_message ?? undefined,
      fromCache: true,
    } satisfies InstitutionIdentityEnrichmentMetadata,
  };
}

function isCacheFresh(lastEnrichedAt?: string) {
  if (!lastEnrichedAt) return false;
  const enrichedAt = new Date(lastEnrichedAt);
  if (Number.isNaN(enrichedAt.getTime())) return false;
  return Date.now() - enrichedAt.getTime() < 1000 * 60 * 60 * 24 * 14;
}

function isSuspiciousSocialValue(value: string | undefined) {
  const normalized = normalizeIdentityValue(value);
  if (!normalized) return false;
  return /\/embed\/|\/share\/|sharer\.php|\/p\/|\/reel\//i.test(normalized);
}

function shouldReuseCachedEnrichment(cached: Awaited<ReturnType<typeof getCachedIdentityEnrichment>>) {
  if (!cached) return false;
  if (!isCacheFresh(cached.metadata.lastEnrichedAt)) return false;
  if (cached.metadata.enrichmentStatus === "failed") return false;
  if (cached.metadata.enrichmentStatus === "catalog_only") return false;
  if (cached.metadata.confidence === "low") return false;
  if (
    cached.metadata.enrichmentStatus === "partial" &&
    (!cached.identity.address || (!cached.identity.phoneNumber && !cached.identity.mobilePhone) || !cached.identity.website)
  ) {
    return false;
  }
  if (cached.identity.address && !looksLikeValidAddress(cached.identity.address)) return false;
  if (isSuspiciousSocialValue(cached.identity.instagram)) return false;
  if (isSuspiciousSocialValue(cached.identity.facebook)) return false;
  if (isSuspiciousSocialValue(cached.identity.youtube)) return false;
  return true;
}

async function getCachedIdentityEnrichment(db: AletaDatabase, courtId: string) {
  const row = await db
    .prepare(
      `SELECT court_id, court_name, court_short_name, address, phone_number, mobile_phone, email,
         query_text, instagram, facebook, youtube, website, map_url, source_official_website,
         source_google_place, source_google_search, sources_json, fields_found_json, fields_missing_json,
         warnings_json, confidence,
         field_sources_json, field_confidence_json, enrichment_status, last_enriched_at, last_error_message,
         created_at, updated_at
       FROM institution_identity_enrichments
       WHERE court_id = ?`
    )
    .get<EnrichmentCacheRow>(courtId);

  return row ? mapCacheRow(row) : null;
}

async function ensureInstitutionEnrichmentCacheColumns(db: AletaDatabase) {
  const statements = [
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS query_text TEXT`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS source_google_place TEXT`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS source_google_search TEXT`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS sources_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS fields_found_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS fields_missing_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS warnings_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE institution_identity_enrichments ADD COLUMN IF NOT EXISTS confidence TEXT NOT NULL DEFAULT 'low'`,
  ];

  for (const statement of statements) {
    await db.exec(statement);
  }
}

async function upsertIdentityEnrichmentCache(
  db: AletaDatabase,
  {
    courtId,
    courtName,
    identity,
    metadata,
    queryText,
  }: {
    courtId: string;
    courtName: string;
    identity: InstitutionIdentity;
    metadata: InstitutionIdentityEnrichmentMetadata;
    queryText?: string;
  }
) {
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO institution_identity_enrichments (
          court_id, query_text, court_name, court_short_name, address, phone_number, mobile_phone, email,
          instagram, facebook, youtube, website, map_url, source_official_website, source_google_place,
          source_google_search, sources_json, fields_found_json, fields_missing_json, warnings_json, confidence,
          field_sources_json, field_confidence_json, enrichment_status, last_enriched_at, last_error_message,
          created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(court_id) DO UPDATE SET
          query_text = excluded.query_text,
          court_name = excluded.court_name,
          court_short_name = excluded.court_short_name,
          address = excluded.address,
          phone_number = excluded.phone_number,
          mobile_phone = excluded.mobile_phone,
          email = excluded.email,
          instagram = excluded.instagram,
          facebook = excluded.facebook,
          youtube = excluded.youtube,
          website = excluded.website,
          map_url = excluded.map_url,
          source_official_website = excluded.source_official_website,
          source_google_place = excluded.source_google_place,
          source_google_search = excluded.source_google_search,
          sources_json = excluded.sources_json,
          fields_found_json = excluded.fields_found_json,
          fields_missing_json = excluded.fields_missing_json,
          warnings_json = excluded.warnings_json,
          confidence = excluded.confidence,
          field_sources_json = excluded.field_sources_json,
          field_confidence_json = excluded.field_confidence_json,
          enrichment_status = excluded.enrichment_status,
          last_enriched_at = excluded.last_enriched_at,
          last_error_message = excluded.last_error_message,
          updated_at = excluded.updated_at`
    )
    .run(
      courtId,
      queryText ?? metadata.query ?? courtName,
      courtName,
      identity.courtShortName,
      identity.address,
      identity.phoneNumber,
      identity.mobilePhone,
      identity.email,
      identity.instagram || null,
      identity.facebook || null,
      identity.youtube || null,
      identity.website || null,
      identity.mapUrl || null,
      metadata.sourceOfficialWebsite ?? null,
      metadata.sourceGooglePlace ?? null,
      metadata.sourceGoogleSearch ?? null,
      stringifyJson(metadata.sources ?? []),
      stringifyJson(metadata.fieldsFound ?? []),
      stringifyJson(metadata.fieldsMissing ?? []),
      stringifyJson(metadata.warnings ?? []),
      metadata.confidence ?? "low",
      stringifyJson(metadata.fieldSources ?? {}),
      JSON.stringify(metadata.fieldConfidence ?? {}),
      metadata.enrichmentStatus,
      metadata.lastEnrichedAt ?? null,
      metadata.lastErrorMessage ?? null,
      now,
      now
    );
}

function slugifyCacheKey(value: unknown) {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildCacheKey(courtId: unknown, query: unknown) {
  const normalizedCourtId = toSafeString(courtId);
  if (normalizedCourtId) return normalizedCourtId;
  return `query-${slugifyCacheKey(query) || "identity"}`;
}

function resolveCatalogEntry(courtId: unknown, query: unknown) {
  const normalizedCourtId = toSafeString(courtId);
  const normalizedQuery = toSafeString(query);
  if (normalizedCourtId && !normalizedCourtId.startsWith("ai-") && !normalizedCourtId.startsWith("query-")) {
    const byId = getCourtDirectoryEntryById(normalizedCourtId);
    if (byId) return byId;
  }

  return getCourtDirectoryEntryByName(normalizedQuery) ?? searchCourtDirectory(normalizedQuery)[0] ?? null;
}

function buildSourcesFromFieldSources(
  fieldSources: FieldSourceMap,
  {
    sourceOfficialWebsite,
    sourceGooglePlace,
    sourceGoogleSearch,
    usedAI,
    fromCache,
  }: {
    sourceOfficialWebsite?: string;
    sourceGooglePlace?: string;
    sourceGoogleSearch?: string;
    usedAI?: boolean;
    fromCache?: boolean;
  }
): NonNullable<InstitutionIdentityEnrichmentMetadata["sources"]> {
  const sourceTypes = new Set(Object.values(fieldSources));
  const sources: NonNullable<InstitutionIdentityEnrichmentMetadata["sources"]> = [];

  if (fromCache) {
    sources.push({ type: "cache", label: "Cache enrichment ALETA" });
  }
  if (sourceTypes.has("local")) {
    sources.push({ type: "local", label: "Katalog lokal ALETA" });
  }
  if (sourceTypes.has("google_places") || sourceGooglePlace) {
    sources.push({ type: "google_places", label: "Google Places/Maps", url: sourceGooglePlace });
  }
  if (sourceTypes.has("google_search") || sourceGoogleSearch) {
    sources.push({ type: "google_search", label: "Google Custom Search", url: sourceGoogleSearch });
  }
  if (sourceTypes.has("official_website") || sourceOfficialWebsite) {
    sources.push({ type: "official_website", label: "Website resmi pengadilan", url: sourceOfficialWebsite });
  }
  if (usedAI) {
    sources.push({ type: "ai", label: "AI provider aktif untuk normalisasi, bukan sumber tunggal" });
  }

  return sources;
}

function getFieldsFound(identity: InstitutionIdentity) {
  return IDENTITY_FIELDS.filter((field) => Boolean(normalizeIdentityValue(identity[field])));
}

function getConfidenceLevel(
  fieldConfidence: FieldConfidenceMap,
  fieldsFound: IdentityField[],
  sources: NonNullable<InstitutionIdentityEnrichmentMetadata["sources"]>
): InstitutionIdentityEnrichmentConfidence {
  const criticalFields: IdentityField[] = ["courtName", "address", "phoneNumber", "website"];
  const criticalFound = criticalFields.filter((field) => fieldsFound.includes(field)).length;
  const averageConfidence =
    fieldsFound.reduce((total, field) => total + (fieldConfidence[field] ?? 0), 0) / Math.max(fieldsFound.length, 1);
  const hasOfficialWebsite = sources.some((source) => source.type === "official_website");
  const hasGoogle = sources.some((source) => source.type === "google_places" || source.type === "google_search");

  if (hasOfficialWebsite && criticalFound >= 3 && averageConfidence >= 0.82) return "high";
  if ((hasOfficialWebsite || hasGoogle) && criticalFound >= 2 && averageConfidence >= 0.72) return "medium";
  return "low";
}

export async function resolveInstitutionIdentityEnrichment(
  db: AletaDatabase,
  {
    actorUserId,
    courtId,
    query,
    localIdentity,
    refresh,
  }: {
    actorUserId: string;
    courtId?: string;
    query: unknown;
    localIdentity?: IdentityInput;
    refresh?: boolean;
  }
): Promise<ResolvedInstitutionIdentity> {
  await requireActorUser(db, actorUserId);
  await ensureInstitutionEnrichmentCacheColumns(db);

  const initialQuery = normalizeIdentityValue(query) || normalizeIdentityValue(localIdentity?.courtName);
  const catalogEntry = resolveCatalogEntry(courtId, initialQuery);
  const normalizedQuery = initialQuery || catalogEntry?.courtName || "";
  if (normalizedQuery.length < 3) {
    throw new ApiError(400, "Nama pengadilan minimal 3 karakter sebelum menerapkan saran AI.");
  }

  const cacheKey = buildCacheKey(catalogEntry?.id ?? courtId, normalizedQuery);
  const derivedIdentity = catalogEntry?.identity ?? {
    ...buildDerivedCourtIdentity(normalizedQuery),
    website: "",
    mapUrl: "",
  };
  const baseIdentity = normalizeInstitutionIdentity({
    ...derivedIdentity,
    ...localIdentity,
    courtName: normalizeIdentityValue(localIdentity?.courtName) || derivedIdentity.courtName || normalizedQuery,
  });
  const cached = refresh ? null : await getCachedIdentityEnrichment(db, cacheKey);
  if (cached && shouldReuseCachedEnrichment(cached)) {
    const cachedIdentity = normalizeInstitutionIdentity(cached.identity);
    const cachedSources = buildSourcesFromFieldSources(cached.metadata.fieldSources ?? {}, {
      sourceOfficialWebsite: cached.metadata.sourceOfficialWebsite,
      sourceGooglePlace: cached.metadata.sourceGooglePlace,
      sourceGoogleSearch: cached.metadata.sourceGoogleSearch,
      fromCache: true,
    });
    const cachedFieldsFound = getFieldsFound(cachedIdentity);
    const cachedFieldsMissing = IDENTITY_FIELDS.filter((field) => !cachedFieldsFound.includes(field));
    const cachedWarnings = (cached.metadata.warnings ?? []).map(sanitizeUserWarning).filter(Boolean);
    return {
      identity: cachedIdentity,
      suggestedIdentity: cachedIdentity,
      confidence: cached.metadata.confidence ?? "low",
      sources: cachedSources,
      warnings: cachedWarnings,
      fieldsFound: cachedFieldsFound,
      fieldsMissing: cachedFieldsMissing,
      metadata: {
        ...cached.metadata,
        fromCache: true,
        confidence: cached.metadata.confidence ?? "low",
        sources: cachedSources,
        warnings: cachedWarnings,
        fieldsFound: cachedFieldsFound,
        fieldsMissing: cachedFieldsMissing,
      },
      baseIdentity,
    };
  }

  const finalIdentity = normalizeInstitutionIdentity(baseIdentity);
  const fieldSources: FieldSourceMap = {};
  const fieldConfidence: FieldConfidenceMap = {};

  for (const field of IDENTITY_FIELDS) {
    if (normalizeIdentityValue(finalIdentity[field])) {
      fieldSources[field] = "local";
      fieldConfidence[field] = CATALOG_FIELD_CONFIDENCE[field];
    }
  }

  let sourceOfficialWebsite = normalizeIdentityValue(baseIdentity.website) || undefined;
  let sourceGooglePlace: string | undefined;
  let sourceGoogleSearch: string | undefined;
  let lastErrorMessage: string | undefined;
  let usedAI = false;
  const warnings: string[] = [];
  const aiSettings = await getAISettingsFromDb(db).catch(() => null);
  const identityFlags = normalizeAIFeatureFlags(aiSettings?.featureFlags).institutionIdentity;
  const enrichmentFeatureEnabled = Boolean(
    aiSettings?.enabled && identityFlags.enabled && identityFlags.identityEnrichment
  );
  const hasGooglePlacesConfig = Boolean(getGooglePlacesApiKey());
  const googleSearchConfig = getGoogleSearchConfig();
  const hasGoogleSearchConfig = Boolean(googleSearchConfig.apiKey && googleSearchConfig.searchEngineId);
  if (!enrichmentFeatureEnabled) {
    warnings.push("Enrichment AI identitas instansi sedang dinonaktifkan oleh administrator. Sistem memakai katalog lokal dan input manual.");
  } else if (!identityFlags.googleDiscovery) {
    warnings.push("Discovery Google identitas instansi sedang dinonaktifkan oleh administrator.");
  } else if (!hasGooglePlacesConfig && !hasGoogleSearchConfig) {
    warnings.push("Sumber eksternal Google belum dikonfigurasi. Sistem menggunakan katalog lokal dan input manual.");
  }

  if (enrichmentFeatureEnabled && identityFlags.googleDiscovery) {
    try {
      const googlePlacesResult = await enrichIdentityFromGooglePlaces(normalizedQuery);
      warnings.push(...(googlePlacesResult.warnings ?? []));
      if (googlePlacesResult.sourceUrl) {
        sourceGooglePlace = googlePlacesResult.sourceUrl;
      }
      mergeIdentityWithSource(
        finalIdentity,
        fieldSources,
        fieldConfidence,
        googlePlacesResult.identity,
        "google_places",
        GOOGLE_PLACES_FIELD_CONFIDENCE,
        {
          onlyFillEmpty: true,
          preserveCatalogName: true,
        }
      );

      const googleWebsite = normalizeIdentityValue(googlePlacesResult.identity.website);
      if (googleWebsite && isLikelyOfficialCourtWebsite(googleWebsite, finalIdentity.courtName || normalizedQuery)) {
        sourceOfficialWebsite = googleWebsite;
        finalIdentity.website = finalIdentity.website || googleWebsite;
        fieldSources.website = fieldSources.website ?? "google_places";
        fieldConfidence.website = fieldConfidence.website ?? GOOGLE_PLACES_FIELD_CONFIDENCE.website;
      }
    } catch (error) {
      console.warn("Google Places enrichment failed", error instanceof Error ? error.message : error);
      warnings.push("Google Places/Maps belum dapat dipakai saat ini. Sistem tetap memakai sumber lokal dan resmi yang tersedia.");
    }
  }

  const stillNeedsWebsite = !sourceOfficialWebsite || !isLikelyOfficialCourtWebsite(sourceOfficialWebsite, finalIdentity.courtName || normalizedQuery);
  if (enrichmentFeatureEnabled && identityFlags.googleDiscovery && stillNeedsWebsite) {
    try {
      const googleSearchResult = await enrichIdentityFromGoogleSearch(normalizedQuery, finalIdentity.courtName || normalizedQuery);
      warnings.push(...(googleSearchResult.warnings ?? []));
      if (googleSearchResult.sourceUrl) {
        sourceGoogleSearch = googleSearchResult.sourceUrl;
      }
      const searchWebsite = normalizeIdentityValue(googleSearchResult.identity.website);
      if (searchWebsite) {
        sourceOfficialWebsite = searchWebsite;
      }
      mergeIdentityWithSource(
        finalIdentity,
        fieldSources,
        fieldConfidence,
        googleSearchResult.identity,
        "google_search",
        GOOGLE_SEARCH_FIELD_CONFIDENCE,
        {
          onlyFillEmpty: true,
          preserveCatalogName: true,
        }
      );
    } catch (error) {
      console.warn("Google Search enrichment failed", error instanceof Error ? error.message : error);
      warnings.push("Google Search belum dapat dipakai saat ini. Sistem tetap memakai sumber lokal dan resmi yang tersedia.");
    }
  }

  if (enrichmentFeatureEnabled && identityFlags.officialWebsiteExtraction && baseIdentity.website) {
    try {
      const officialResult = await enrichIdentityFromOfficialWebsite(baseIdentity);
      if (officialResult.sourceUrl) {
        sourceOfficialWebsite = officialResult.sourceUrl;
      }

      mergeIdentityWithSource(
        finalIdentity,
        fieldSources,
        fieldConfidence,
        officialResult.identity,
        "official_website",
        OFFICIAL_FIELD_CONFIDENCE,
        {
          preserveCatalogName: true,
        }
      );
    } catch (error) {
      console.warn("Official website enrichment failed", error instanceof Error ? error.message : error);
      warnings.push("Website resmi belum dapat dibaca saat ini. Data lokal tetap dipakai.");
    }
  }

  const discoveredWebsite = normalizeIdentityValue(finalIdentity.website);
  if (enrichmentFeatureEnabled && identityFlags.officialWebsiteExtraction && discoveredWebsite && discoveredWebsite !== baseIdentity.website) {
    try {
      const officialResult = await enrichIdentityFromOfficialWebsite({
        ...baseIdentity,
        website: discoveredWebsite,
      });
      if (officialResult.sourceUrl) {
        sourceOfficialWebsite = officialResult.sourceUrl;
      }
      mergeIdentityWithSource(
        finalIdentity,
        fieldSources,
        fieldConfidence,
        officialResult.identity,
        "official_website",
        OFFICIAL_FIELD_CONFIDENCE,
        {
          preserveCatalogName: true,
        }
      );
    } catch (error) {
      console.warn("Discovered official website enrichment failed", error instanceof Error ? error.message : error);
      warnings.push("Website resmi hasil discovery belum dapat dibaca saat ini.");
    }
  }

  if (enrichmentFeatureEnabled && identityFlags.aiNormalization) {
    try {
      usedAI = await normalizeIdentityWithAI(
        db,
        finalIdentity,
        fieldSources,
        buildSourcesFromFieldSources(fieldSources, {
          sourceOfficialWebsite,
          sourceGooglePlace,
          sourceGoogleSearch,
        }),
        warnings
      );
    } catch (error) {
      const technicalMessage = error instanceof Error ? error.message : "Enrichment identitas instansi gagal diproses.";
      console.warn("Institution identity enrichment source failed", technicalMessage);
      lastErrorMessage = "Sebagian sumber eksternal belum dapat diproses. Sistem tetap memakai data lokal dan sumber resmi yang tersedia.";
      warnings.push(lastErrorMessage);
    }
  }

  const addedFields = IDENTITY_FIELDS.filter(
    (field) =>
      !normalizeIdentityValue(baseIdentity[field]) &&
      normalizeIdentityValue(finalIdentity[field])
  );
  const externallyVerifiedFields = IDENTITY_FIELDS.filter((field) => {
    const source = fieldSources[field];
    return source && source !== "local" && source !== "cache" && source !== "ai";
  });
  const fieldsFound = getFieldsFound(finalIdentity);
  const fieldsMissing = IDENTITY_FIELDS.filter((field) => !fieldsFound.includes(field));
  const sources = buildSourcesFromFieldSources(fieldSources, {
    sourceOfficialWebsite,
    sourceGooglePlace,
    sourceGoogleSearch,
    usedAI,
  });
  const confidence = getConfidenceLevel(fieldConfidence, fieldsFound, sources);

  const enrichmentStatus: InstitutionIdentityEnrichmentStatus = lastErrorMessage
    ? addedFields.length > 0
      ? "partial"
      : "failed"
    : addedFields.length === 0 && externallyVerifiedFields.length === 0
      ? "catalog_only"
      : IDENTITY_FIELDS.some((field) => !normalizeIdentityValue(finalIdentity[field]))
        ? "partial"
        : "enriched";

  const metadata: InstitutionIdentityEnrichmentMetadata = {
    courtId: cacheKey,
    courtName: finalIdentity.courtName || normalizedQuery,
    query: normalizedQuery,
    confidence,
    sources,
    fieldsFound,
    fieldsMissing,
    warnings: Array.from(new Set(warnings.map(sanitizeUserWarning).filter(Boolean))),
    sourceOfficialWebsite,
    sourceGooglePlace,
    sourceGoogleSearch,
    lastEnrichedAt: new Date().toISOString(),
    enrichmentStatus,
    fieldSources,
    fieldConfidence,
    fromCache: false,
    lastErrorMessage,
  };

  await upsertIdentityEnrichmentCache(db, {
    courtId: cacheKey,
    courtName: finalIdentity.courtName || normalizedQuery,
    identity: finalIdentity,
    metadata,
    queryText: normalizedQuery,
  });

  return {
    identity: finalIdentity,
    suggestedIdentity: finalIdentity,
    confidence,
    sources,
    warnings: metadata.warnings ?? [],
    fieldsFound,
    fieldsMissing,
    metadata,
    baseIdentity,
  };
}

export function getInstitutionIdentityCompleteness(identity: InstitutionIdentity) {
  return IDENTITY_FIELDS.filter((field) => normalizeIdentityValue(identity[field])).length;
}

export function extractOfficialIdentityForTesting(html: string, sourceUrl: string) {
  return extractIdentityFromOfficialHtml(html, sourceUrl);
}

export function normalizeInstitutionIdentityForTesting(source: Partial<Record<keyof InstitutionIdentity, unknown>> | null | undefined) {
  return normalizeInstitutionIdentity(source);
}
