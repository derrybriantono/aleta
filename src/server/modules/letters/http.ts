import { NextRequest } from "next/server";

import { type LetterSearchFilters } from "@/server/modules/letters/service";
import {
  getBooleanSearchParam,
  getNumberSearchParam,
  getSearchParam,
  getSearchParamArray,
} from "@/server/shared/request";

export function readLetterSearchFiltersFromRequest(request: NextRequest): LetterSearchFilters {
  return {
    query: getSearchParam(request, "query"),
    type: getSearchParam(request, "type"),
    status: getSearchParam(request, "status"),
    year: getSearchParam(request, "year"),
    month: getSearchParam(request, "month"),
    quarter: getSearchParam(request, "quarter"),
    origin: getSearchParam(request, "origin"),
    code: getSearchParam(request, "code"),
    dateFrom: getSearchParam(request, "dateFrom"),
    dateTo: getSearchParam(request, "dateTo"),
    tags: getSearchParamArray(request, "tags"),
    classificationTags: getSearchParamArray(request, "classificationTags"),
    includeDeleted: getBooleanSearchParam(request, "includeDeleted"),
    limit: getNumberSearchParam(request, "limit"),
  };
}
