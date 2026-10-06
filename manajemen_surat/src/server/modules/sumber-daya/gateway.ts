/**
 * Panggilan ke rute bot /internal/aleta-bot/sumber-daya - butir 3 (6 Okt 2026).
 *
 * Berkas sendiri (pola panggil-petugas/gateway.ts). Alamat dan token
 * internalnya dibaca dari env yang SAMA dengan gerbang bot lainnya.
 */

export type HasilBotSumberDaya = { ok: true; data: unknown } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function mintaSumberDayaBot(timeoutMs = 6000): Promise<HasilBotSumberDaya> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), timeoutMs);
  try {
    const kepala: Record<string, string> = {};
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/sumber-daya`, {
      headers: kepala,
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
            ? "ALETA Bot belum punya rute sumber daya - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return { ok: false, status: jawaban.status, error: String(isi.message || isi.error || `HTTP ${jawaban.status}`) };
    }
    return { ok: true, data: isi };
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
