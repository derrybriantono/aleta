/**
 * Panggilan baca ke rute internal ALETA Bot untuk Pusat kesehatan dan penjaga
 * integritas. Berkas sendiri (pola sumber-daya/gateway.ts): alamat dan token
 * dibaca dari env yang SAMA dengan gerbang bot lainnya. Tidak menulis apa pun.
 */
export type HasilBotInternal<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotInternal<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number; ambil?: typeof fetch } = {}
): Promise<HasilBotInternal<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? 6000);
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await (pilihan.ambil ?? fetch)(`${alamatBot()}/internal/aleta-bot${jalur}`, {
      method: pilihan.method ?? "GET",
      headers: kepala,
      body: pilihan.body === undefined ? undefined : JSON.stringify(pilihan.body),
      signal: pengendali.signal,
      cache: "no-store",
    });
    const teks = await jawaban.text();
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(teks) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: jawaban.status,
        error: jawaban.status === 404 ? "ALETA Bot belum punya rute ini - bot perlu dimulai ulang dengan versi terbaru." : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return { ok: false, status: jawaban.status, error: String(isi.error || isi.message || isi.alasan || `HTTP ${jawaban.status}`) };
    }
    return { ok: true, data: isi as T };
  } catch (galat) {
    return {
      ok: false,
      error:
        galat instanceof Error && galat.name === "AbortError"
          ? "ALETA Bot tidak menjawab dalam batas waktu."
          : galat instanceof Error
            ? galat.message
            : "ALETA Bot belum dapat dihubungi.",
    };
  } finally {
    clearTimeout(penunda);
  }
}
