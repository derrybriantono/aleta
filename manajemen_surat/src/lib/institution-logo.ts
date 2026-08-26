import { withBasePath, withoutBasePath } from "@/lib/base-path";

export const DEFAULT_INSTITUTION_LOGO_PATH = "/mahkamah-agung-logo.png";
export const INSTITUTION_LOGO_RENDER_VERSION = "transparent-bg-v1";
export const MAX_INSTITUTION_LOGO_DATA_URL_LENGTH = 800_000;
export const MAX_INSTITUTION_LOGO_FILE_SIZE = 2 * 1024 * 1024;

const supportedDataImagePattern = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
const absoluteHttpPattern = /^https?:\/\//i;
const internalInstitutionLogoRoutePattern = /^\/api\/public\/institution\/logo\/[^?#]+/;

export function normalizeInstitutionLogoUrl(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSupportedInstitutionLogoUrl(value: string) {
  const logoUrl = normalizeInstitutionLogoUrl(value);
  if (!logoUrl) return true;
  if (logoUrl.length > MAX_INSTITUTION_LOGO_DATA_URL_LENGTH) return false;
  if (supportedDataImagePattern.test(logoUrl)) return true;
  if (absoluteHttpPattern.test(logoUrl)) return true;
  return logoUrl.startsWith("/") && !logoUrl.startsWith("//");
}

export function getInstitutionLogoSrc(value: unknown) {
  const logoUrl = normalizeInstitutionLogoUrl(value);

  if (!logoUrl || !isSupportedInstitutionLogoUrl(logoUrl)) {
    return withBasePath(DEFAULT_INSTITUTION_LOGO_PATH);
  }

  if (logoUrl.startsWith("/") && !logoUrl.startsWith("//")) {
    const versionedLogoUrl = internalInstitutionLogoRoutePattern.test(withoutBasePath(logoUrl))
      ? `${logoUrl}${logoUrl.includes("?") ? "&" : "?"}v=${INSTITUTION_LOGO_RENDER_VERSION}`
      : logoUrl;

    return withBasePath(versionedLogoUrl);
  }

  return logoUrl;
}
