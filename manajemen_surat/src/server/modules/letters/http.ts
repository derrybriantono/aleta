import { NextRequest } from "next/server";

import {
  LETTER_PAGE_SIZE_OPTIONS,
  type LetterPageSize,
  type LetterSearchFilters,
  type LetterSortBy,
  type LetterSortDirection,
} from "@/server/modules/letters/service";
import {
  getBooleanSearchParam,
  getNumberSearchParam,
  getSearchParam,
  getSearchParamArray,
} from "@/server/shared/request";

export function readLetterSearchFiltersFromRequest(request: NextRequest): LetterSearchFilters {
  const type = getSearchParam(request, "type");

  return {
    query: getSearchParam(request, "search") ?? getSearchParam(request, "query"),
    type: type === "all" || type === "semua" ? undefined : type,
    status: getSearchParam(request, "status"),
    workflowStatus: getSearchParam(request, "workflowStatus"),
    priority: getSearchParam(request, "priority"),
    year: getSearchParam(request, "year"),
    month: getSearchParam(request, "month"),
    quarter: getSearchParam(request, "quarter"),
    origin: getSearchParam(request, "origin"),
    code: getSearchParam(request, "code"),
    dateFrom: getSearchParam(request, "dateFrom"),
    dateTo: getSearchParam(request, "dateTo"),
    tags: getSearchParamArray(request, "tags"),
    classificationTags: getSearchParamArray(request, "classificationTags"),
    dispositionStatus: getSearchParam(request, "dispositionStatus"),
    unreadOnly: getBooleanSearchParam(request, "unreadOnly"),
    overdueOnly: getBooleanSearchParam(request, "overdueOnly"),
    dueTodayOnly: getBooleanSearchParam(request, "dueTodayOnly"),
    includeDeleted: getBooleanSearchParam(request, "includeDeleted"),
    limit: getNumberSearchParam(request, "limit"),
  };
}

export function readLetterPaginationFromRequest(request: NextRequest) {
  const pageValue = getNumberSearchParam(request, "page");
  const rawPageSize = getSearchParam(request, "pageSize");
  const page = pageValue && pageValue > 0 ? Math.floor(pageValue) : 1;
  let pageSize: LetterPageSize = 25;

  if (rawPageSize === "all") {
    pageSize = "all";
  } else {
    const numericPageSize = rawPageSize ? Number(rawPageSize) : undefined;
    if (numericPageSize && LETTER_PAGE_SIZE_OPTIONS.includes(numericPageSize as (typeof LETTER_PAGE_SIZE_OPTIONS)[number])) {
      pageSize = numericPageSize as LetterPageSize;
    }
  }

  return { page, pageSize };
}

export function readLetterSortFromRequest(request: NextRequest): {
  sortBy: LetterSortBy;
  sortDirection: LetterSortDirection;
} {
  const rawSortBy = getSearchParam(request, "sortBy");
  const rawSortDirection = getSearchParam(request, "sortDirection");
  const allowedSortBy = new Set<LetterSortBy>([
    "createdAt",
    "updatedAt",
    "tanggal",
    "tanggalSurat",
    "nomorAgenda",
    "nomorSurat",
    "asalTujuan",
    "status",
    "priority",
    "workflowStatus",
  ]);

  return {
    sortBy: rawSortBy && allowedSortBy.has(rawSortBy as LetterSortBy) ? (rawSortBy as LetterSortBy) : "tanggal",
    sortDirection: rawSortDirection === "asc" ? "asc" : "desc",
  };
}
