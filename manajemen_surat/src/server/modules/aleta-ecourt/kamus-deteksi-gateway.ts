/**
 * Panggilan ke rute bot kamus deteksi (/internal/aleta-bot/kamus-deteksi) -
 * 10 Oktober 2026, paket deteksi lengkap (P9, lapis database).
 *
 * Bot TIDAK pernah memanggil portal (lihat sinkron/penjadwal.ts), jadi lapis
 * database DIDORONG dari sini: setiap perubahan di layar Admin, dan berkala
 * dari instrumentation.ts. Bot menyimpan lapis terakhir di folder runtime-data
 * yang terpasang, sehingga bot yang hidup ulang tetap memakainya.
 *
 * Alamat dan token dibaca dari env yang SAMA dengan jadwal-sidang-gateway.ts.
 * Berkas sendiri supaya uji dapat menggantinya tanpa menyentuh fetch global.
 */

export type HasilBotKamus<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotKamus<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST" | "PUT"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBotKamus<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000));
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/kamus-deteksi${jalur}`, {
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
            ? "ALETA Bot belum punya rute kamus deteksi - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return { ok: false, status: jawaban.status, error: String(isi.message || isi.error || `HTTP ${jawaban.status}`) };
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
