/**
 * Panggilan ke rute bot Jadwal Sidang (/internal/aleta-bot/jadwal-sidang) -
 * perbaikan 1 Oktober 2026, butir J1/J2/J7.
 *
 * Berkas sendiri, bukan tambahan pada whatsapp-gateway-client.ts: berkas itu
 * 4.500 baris dan disunting banyak tangan. Alamat dan token internalnya
 * dibaca dari env yang SAMA (ALETA_BOT_BASE_URL, ALETA_BOT_INTERNAL_*),
 * seperti sinkron/bot-dump.ts.
 */

import { cerminSetelahTulisan } from "@/server/modules/cermin/setelah-tulisan";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

export type HasilBot<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(
    /\/$/,
    ""
  );
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

function batasWaktu() {
  return Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000);
}

export async function panggilBotJadwalSidang<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBot<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? batasWaktu());
  // Performa muat 19 Okt: tulisan (skors, selesai, mediator, ...) membuang
  // singgahan jadwal sebelum dan sesudahnya - lihat singgah-singkat.ts.
  const menulis = (pilihan.method ?? "GET") !== "GET";
  if (menulis) tandaiTulisan();
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/jadwal-sidang${jalur}`, {
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
      // Halaman HTML 404 = bot lama yang belum punya rute ini (citra Docker
      // belum dibangun ulang). Disebut apa adanya, bukan "Unexpected token".
      return {
        ok: false,
        status: jawaban.status,
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya rute Jadwal Sidang ini - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    // Penolakan berbentuk JSON (400/409) tetap DATA - alasan penolakannya
    // yang dibaca layar ("Data Mediasi Sudah Tersimpan", dst.).
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
    if (menulis) {
      tandaiTulisan();
      // A3: tulisan masuk cermin seketika (lihat cermin/setelah-tulisan.ts).
      cerminSetelahTulisan(undefined, pilihan.body);
    }
  }
}
