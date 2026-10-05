/**
 * Panggilan ke rute bot /internal/aleta-bot/panggil - butir 33-36 (5 Okt 2026).
 *
 * Berkas sendiri (pola jadwal-sidang-gateway.ts): whatsapp-gateway-client.ts
 * terlalu besar dan disunting banyak tangan. Alamat dan token internalnya
 * dibaca dari env yang SAMA.
 */

export type HasilBotPanggil<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(
    /\/$/,
    ""
  );
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotPanggil<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBotPanggil<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(
    () => pengendali.abort(),
    pilihan.timeoutMs ?? Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000)
  );
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/panggil${jalur}`, {
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
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya rute panggil petugas - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    // Penolakan berbentuk JSON (400/409) tetap DATA - alasannya dibaca layar.
    if (!jawaban.ok && jawaban.status !== 400 && jawaban.status !== 409) {
      return {
        ok: false,
        status: jawaban.status,
        error: String(isi.error || isi.message || isi.alasan || `HTTP ${jawaban.status}`),
      };
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
