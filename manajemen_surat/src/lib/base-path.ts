const absoluteUrlPattern = /^[a-z][a-z\d+\-.]*:/i;

export function getBasePath() {
  const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

  if (!rawBasePath || rawBasePath === "/") {
    return "";
  }

  const normalized = rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`;
  return normalized.replace(/\/+$/, "");
}

export function withBasePath(path: string) {
  const basePath = getBasePath();

  if (!path) {
    return basePath || "/";
  }

  if (absoluteUrlPattern.test(path) || path.startsWith("//")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!basePath || normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}

export function withoutBasePath(path: string) {
  const basePath = getBasePath();

  if (!path || !basePath || absoluteUrlPattern.test(path) || path.startsWith("//")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === basePath) {
    return "/";
  }

  if (normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath.slice(basePath.length) || "/";
  }

  return path;
}

export function apiPath(path: string) {
  return withBasePath(path);
}
