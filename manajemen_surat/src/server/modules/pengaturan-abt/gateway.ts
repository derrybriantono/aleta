/**
 * Panggilan ke rute bot Pengaturan SIPP & ABT (/internal/aleta-bot/abt-pengaturan)
 * - 16 Oktober 2026, Tahap H. Pola kamus-deteksi-gateway.ts: alamat & token dari
 * env yang sama, berkas sendiri supaya uji dapat menggantinya.
 */

export type HasilBotPengaturan<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; kode?: string; uji?: unknown };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotPengaturanAbt<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBotPengaturan<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 15000));
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/abt-pengaturan${jalur}`, {
      method: pilihan.method ?? "GET",
      headers: kepala,
      body: pilihan.body === undefined ? undefined : JSON.stringify(pilihan.body),
      signal: pengendali.signal,
      cache: "no-store",
    });
    const mentah = await jawaban.text();
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(mentah) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: jawaban.status,
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya fitur Pengaturan SIPP & ABT - bot perlu diperbarui."
            : `ALETA Bot menjawab bukan data (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return {
        ok: false,
        status: jawaban.status,
        kode: typeof isi.kode === "string" ? isi.kode : undefined,
        uji: isi.uji,
        error: String(isi.message || isi.error || `HTTP ${jawaban.status}`),
      };
    }
    return { ok: true, data: isi as T };
  } catch (galat) {
    return {
      ok: false,
      error:
        galat instanceof Error && galat.name === "AbortError"
          ? "ALETA Bot tidak menjawab dalam batas waktu."
          : "ALETA Bot belum dapat dihubungi.",
    };
  } finally {
    clearTimeout(penunda);
  }
}
