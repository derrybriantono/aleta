import { apiPath } from "@/lib/base-path";

import type { PeristiwaAlir } from "./kontrak";

export type Jawab<T> = { ok: true; data: T } | { ok: false; galat: string };

const GALAT_JARINGAN = "Server belum dapat dihubungi. Coba lagi sebentar lagi.";

async function bacaJawaban<T>(jawaban: Response): Promise<Jawab<T>> {
  const isi = (await jawaban.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!jawaban.ok || isi?.ok === false) {
    return { ok: false, galat: isi?.error?.message || "Permintaan belum berhasil." };
  }
  return { ok: true, data: (isi?.data ?? (isi as unknown as T)) as T };
}

export async function ambil<T>(alamat: string, init?: RequestInit): Promise<Jawab<T>> {
  try {
    const jawaban = await fetch(apiPath(alamat), { cache: "no-store", ...init });
    return await bacaJawaban<T>(jawaban);
  } catch {
    return { ok: false, galat: GALAT_JARINGAN };
  }
}

export function kirimJson<T>(alamat: string, metode: "POST" | "PUT" | "PATCH" | "DELETE", badan?: unknown) {
  return ambil<T>(alamat, {
    method: metode,
    headers: { "Content-Type": "application/json" },
    body: badan === undefined ? undefined : JSON.stringify(badan),
  });
}

/** Memecah teks SSE menjadi peristiwa JSON; baris yang bukan JSON diabaikan. */
export function uraiBlokSse(blok: string): PeristiwaAlir | null {
  const data = blok
    .split(/\r?\n/)
    .filter((baris) => baris.startsWith("data:"))
    .map((baris) => baris.slice(5).replace(/^ /, ""))
    .join("\n")
    .trim();
  if (!data || data === "[DONE]") return null;
  try {
    const nilai = JSON.parse(data) as PeristiwaAlir;
    return nilai && typeof nilai === "object" && "jenis" in nilai ? nilai : null;
  } catch {
    return null;
  }
}

/**
 * Mengirim pesan dan meneruskan tiap peristiwa SSE ke `padaPeristiwa`.
 * Mengembalikan galat bila sambungan putus sebelum ada peristiwa "selesai"/"gagal".
 */
export async function kirimPesanAlir(
  idPercakapan: string,
  badan: { teks: string; pemicu?: string },
  padaPeristiwa: (p: PeristiwaAlir) => void,
  sinyal?: AbortSignal
): Promise<{ selesai: boolean; galat?: string }> {
  let jawaban: Response;
  try {
    jawaban = await fetch(apiPath(`/api/aleta-ai/percakapan/${encodeURIComponent(idPercakapan)}/pesan`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(badan),
      signal: sinyal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return { selesai: false, galat: "dihentikan" };
    return { selesai: false, galat: GALAT_JARINGAN };
  }
  if (!jawaban.ok || !jawaban.body) {
    const isi = (await jawaban.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { selesai: false, galat: isi?.error?.message || "Permintaan belum berhasil." };
  }
  const pembaca = jawaban.body.getReader();
  const pengurai = new TextDecoder();
  let sisa = "";
  let akhir = false;
  const olah = (blok: string) => {
    const p = uraiBlokSse(blok);
    if (!p) return;
    if (p.jenis === "selesai" || p.jenis === "gagal") akhir = true;
    padaPeristiwa(p);
  };
  try {
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) break;
      sisa += pengurai.decode(value, { stream: true });
      let cocok = /\r?\n\r?\n/.exec(sisa);
      while (cocok) {
        const blok = sisa.slice(0, cocok.index);
        sisa = sisa.slice(cocok.index + cocok[0].length);
        olah(blok);
        cocok = /\r?\n\r?\n/.exec(sisa);
      }
    }
    if (sisa.trim()) olah(sisa);
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return { selesai: false, galat: "dihentikan" };
    return { selesai: akhir, galat: akhir ? undefined : "Sambungan terputus sebelum jawaban selesai." };
  }
  return akhir ? { selesai: true } : { selesai: false, galat: "Sambungan terputus sebelum jawaban selesai." };
}
