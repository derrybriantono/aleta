import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Mode kembaran di sisi portal (ALETA berjalan di laptop selagi server mati).
 *
 * Penandanya SAMA dengan bot: ALETA_MODE=kembaran. Portal tidak pernah
 * menyentuh MySQL SIPP/ABT - seluruh antrean tulis, pemeriksaan bentrok, dan
 * dorong ke server ada di bot (rute /internal/aleta-bot/kembaran). Berkas ini
 * hanya: mengenali mode, membaca cap tarikan terakhir untuk pita, dan
 * memanggil rute bot itu.
 */

export function modeKembaran(env: Record<string, string | undefined> = process.env) {
  return String(env.ALETA_MODE || "").trim().toLowerCase() === "kembaran";
}

export type CapTarik = {
  tarikPada: string;
  bundel?: string;
  bundelDibuat?: string;
  versiAplikasi?: string;
  sumber?: string[];
};

export function jalurCapTarik(env: Record<string, string | undefined> = process.env) {
  return env.ALETA_KEMBARAN_CAP_TARIK || path.join(env.ALETA_KEMBARAN_DIR || "D:/Aplikasi/aleta/kembaran", "tarik.json");
}

/** Cap tarikan terakhir; null bila belum pernah ditarik atau berkasnya rusak. */
export async function bacaCapTarik(env: Record<string, string | undefined> = process.env): Promise<CapTarik | null> {
  try {
    const isi = JSON.parse(await readFile(jalurCapTarik(env), "utf8")) as CapTarik;
    return isi && typeof isi === "object" && isi.tarikPada ? isi : null;
  } catch {
    return null;
  }
}

/** "19 Okt 2026 07.15 WITA" - jam pengadilan. */
export function formatWaktuPengadilan(iso: string | undefined | null) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  const bagian = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(t))
    .reduce<Record<string, string>>((h, p) => ({ ...h, [p.type]: p.value }), {});
  return `${bagian.day} ${bagian.month} ${bagian.year} ${bagian.hour}.${bagian.minute} WITA`;
}

/** Kalimat pita. Waktu yang dipakai = saat DATA dibuat di server, bukan saat laptop menariknya. */
export function kalimatPita(cap: CapTarik | null) {
  if (!cap) return "Mode kembaran - data belum pernah ditarik dari server";
  const data = formatWaktuPengadilan(cap.bundelDibuat || cap.tarikPada);
  return `Mode kembaran - data per ${data || "waktu tidak diketahui"}`;
}

// ---------------------------------------------------------------------------
// Panggilan ke bot
// ---------------------------------------------------------------------------

export type HasilBotKembaran<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotKembaran<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBotKembaran<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? 20_000);
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/kembaran${jalur}`, {
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
      return { ok: false, status: jawaban.status, error: `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).` };
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

// ---------------------------------------------------------------------------
// Bentuk data untuk layar
// ---------------------------------------------------------------------------

export type BarisAntrean = {
  id: number;
  kelompok: string;
  urutan: number;
  dicatatPada: string;
  sumber: string;
  jenis: string;
  tabel: string;
  status: "menunggu" | "disetujui" | "ditolak" | "terkirim" | "gagal";
  hasil: "aman" | "bentrok" | "ditahan" | "tak_dapat_diperiksa" | null;
  aktor: string | null;
  operasi: string | null;
  sql: string;
  sqlTerpotong: boolean;
  terdampak: number | null;
  cuplikanStatus: string | null;
  nilai: Array<{ kolom: string; lama: unknown[]; baru: unknown }>;
  periksa: { pada: string; alasan: string[]; catatan: string[] } | null;
  berkas: { relatif: string | null; dari: string | null; ke: string | null; ukuran: number | null } | null;
  disetujuiOleh: string | null;
  disetujuiPada: string | null;
  dikirimPada: string | null;
  dikirimOleh: string | null;
  ditolakOleh: string | null;
  alasanTolak: string | null;
  galat: string | null;
  catatan: string | null;
};

export type AksiKembaran = "uji" | "periksa" | "setujui" | "tolak" | "kirim";

/** Isian aksi dari layar -> panggilan ke bot. Nama Super Admin dibawa sebagai `oleh`. */
export function susunPanggilanAksi(aksi: AksiKembaran, isi: Record<string, unknown>, oleh: string) {
  const ids = Array.isArray(isi.ids)
    ? (isi.ids as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 5000)
    : [];
  const kelompok = typeof isi.kelompok === "string" && isi.kelompok.trim() ? isi.kelompok.trim().slice(0, 64) : null;
  switch (aksi) {
    case "uji":
      return { jalur: "/uji", method: "GET" as const, body: undefined, timeoutMs: 40_000 };
    case "periksa":
      return { jalur: "/periksa", method: "POST" as const, body: { ids }, timeoutMs: 300_000 };
    case "setujui":
      return { jalur: "/setujui", method: "POST" as const, body: { ids, kelompok, oleh }, timeoutMs: 60_000 };
    case "tolak":
      return {
        jalur: "/tolak",
        method: "POST" as const,
        body: { ids, kelompok, oleh, alasan: typeof isi.alasan === "string" ? isi.alasan.slice(0, 300) : "" },
        timeoutMs: 60_000,
      };
    case "kirim":
      return { jalur: "/kirim", method: "POST" as const, body: { oleh }, timeoutMs: 900_000 };
  }
}
