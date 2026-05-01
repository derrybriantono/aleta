import { NextRequest } from "next/server";

export function getSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);
  return value?.trim() ? value.trim() : undefined;
}

export function getSearchParamArray(request: NextRequest, key: string) {
  const values = request.nextUrl.searchParams.getAll(key);

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getBooleanSearchParam(request: NextRequest, key: string) {
  const value = getSearchParam(request, key);
  if (!value) return undefined;

  return value === "true" || value === "1";
}

export function getNumberSearchParam(request: NextRequest, key: string) {
  const value = getSearchParam(request, key);
  if (!value) return undefined;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export async function readJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}
