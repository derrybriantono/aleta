import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

export function extractActorUserId(request: NextRequest, fallbackUserId?: string | null) {
  if (process.env.NODE_ENV === "test") {
    return (
      request.headers.get("x-aleta-user-id") ??
      request.nextUrl.searchParams.get("actorUserId") ??
      fallbackUserId ??
      ""
    );
  }

  return "";
}

export async function resolveActorUserId(request: NextRequest, fallbackUserId?: string | null) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return session?.user?.id ?? extractActorUserId(request, fallbackUserId);
  } catch {
    return extractActorUserId(request, fallbackUserId);
  }
}
