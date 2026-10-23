import { getAuth } from "@/lib/auth";

/** Sesi Better Auth pemanggil (id + akun), atau null. Tidak pernah melempar. */
export async function sesiPemanggil(headers: Headers): Promise<{ sessionId: string; userId: string } | null> {
  try {
    const s = await (await getAuth()).api.getSession({ headers });
    return s?.session?.id ? { sessionId: String(s.session.id), userId: String(s.user.id) } : null;
  } catch {
    return null;
  }
}
