import type { IterasiPenggunaan, PenggunaanToken } from "@/lib/aleta-ai/biaya";
import { penggunaanDariUsage } from "@/lib/aleta-ai/biaya";
import type { PermintaanAi } from "@/lib/aleta-ai/penyusun";
import type { AletaDatabase } from "@/server/db/client";
import { sidikKunci, tentukanSumberKunciAletaAi, type SumberKunciAi } from "@/server/modules/ai/kunci-claude";

/**
 * ============================================================================
 * ALETA Ai - KLIEN API CLAUDE (satu-satunya tempat yang menyentuh SDK)
 * ============================================================================
 *
 * KUNCI API
 *   Sumber (lihat ai/kunci-claude.ts): koneksi Claude yang dipilih untuk modul
 *   ALETA Ai di Pengaturan AI > koneksi Claude tersimpan pertama > env server
 *   ANTHROPIC_API_KEY. Kunci tidak pernah dikirim ke peramban, ditulis ke log,
 *   jejak, pesan galat, atau ekspor. Bila tidak ada sama sekali,
 *   ambilKlienAi() mengembalikan null dan seluruh fitur menjawab "ALETA Ai
 *   belum diaktifkan". Klien yang di-cache dibuat ulang saat sidik kunci
 *   berubah, jadi mengganti kunci di Pengaturan AI tidak perlu memulai ulang
 *   portal.
 *
 * ANTARMUKA KlienAi
 *   Mesin (mesin.ts) hanya mengenal antarmuka kecil ini, sehingga uji memakai
 *   klien TIRUAN yang disuntik lewat suntikKlienAi() dan tak pernah memanggil
 *   jaringan.
 *
 * ATURAN API (rujukan resmi claude-api TypeScript, 20 Okt 2026)
 *   - streaming: client.messages.stream(...) lalu .finalMessage()
 *   - effort lewat output_config.effort - SELALU eksplisit (bawaan Opus/Haiku
 *     5.5 = medium)
 *   - thinking adaptif: tidak mengirim `thinking` sama sekali (disabled dan
 *     budget_tokens menghasilkan 400 pada Opus/Sonnet/Haiku 5.5)
 *   - tidak mengirim temperature/top_p/top_k
 *   - Opus/Sonnet 5.5: client.beta.messages.stream dengan beta
 *     "server-side-fallback-2026-07-01" dan fallbacks: "default" (penolakan
 *     pengaman dicoba ulang server-side). Haiku 5.5 TIDAK mendukungnya.
 *   - stop_reason "refusal" dan "max_tokens" ditangani, bukan dibiarkan
 *   - usage: input_tokens, output_tokens, cache_creation_input_tokens,
 *     cache_read_input_tokens (+ usage.iterations saat fallback berjalan)
 *
 * Proxy keluar belum didukung di jalur streaming (outboundFetch menampung
 * seluruh respons); server harus dapat menjangkau api.anthropic.com langsung.
 */

export type BerhentiAi = "selesai" | "ditolak" | "batas" | "alat" | "lain";

/** Tahap 2a: satu permintaan alat dari model (stop_reason tool_use). */
export type PanggilanAlat = { id: string; name: string; input: unknown };

export type HasilAi = {
  teks: string;
  berhenti: BerhentiAi;
  /** Model yang menghasilkan jawaban (berbeda dari yang diminta bila fallback berjalan). */
  model: string;
  /** usage tingkat atas = hanya percobaan yang menghasilkan pesan akhir. */
  penggunaan: PenggunaanToken;
  /** Per percobaan (usage.iterations) bila API mengirimkannya; kosong bila tidak. */
  iterasi: IterasiPenggunaan[];
  kategoriTolak: string;
  dialihkan: boolean;
  /** Tahap 2a: isi pesan akhir APA ADANYA (dikirim balik pada putaran alat). */
  konten?: unknown[];
  /** Tahap 2a: alat yang diminta (berhenti = "alat"). */
  alat?: PanggilanAlat[];
};

export type OpsiAlir = {
  onTeks?: (delta: string) => void;
  sinyal?: AbortSignal;
};

export interface KlienAi {
  alirkan(permintaan: PermintaanAi, opsi?: OpsiAlir): Promise<HasilAi>;
  /** Hitung token masukan (count_tokens). Opsional; tanpa ini mesin memakai karakter/4. */
  hitungToken?(permintaan: PermintaanAi): Promise<number>;
}

export type KodeGalatAi = "kunci" | "laju" | "beban" | "permintaan" | "jaringan" | "dibatalkan" | "lain";

/** Galat yang aman ditampilkan: pesan sudah berbahasa Indonesia dan tidak memuat apa pun dari SDK. */
export class GalatKlienAi extends Error {
  constructor(
    readonly kode: KodeGalatAi,
    pesanPengguna: string
  ) {
    super(pesanPengguna);
    this.name = "GalatKlienAi";
  }
}

const PESAN_GALAT: Record<KodeGalatAi, string> = {
  kunci: "Layanan AI menolak kunci akses server. Hubungi admin ALETA.",
  laju: "Layanan AI sedang sibuk (batas permintaan tercapai). Coba lagi sebentar lagi.",
  beban: "Layanan AI sedang terlalu padat. Coba lagi sebentar lagi.",
  permintaan: "Layanan AI tidak dapat memproses permintaan ini. Coba ringkas atau bagi pertanyaannya.",
  jaringan: "Server belum dapat menghubungi layanan AI. Coba lagi sebentar lagi.",
  dibatalkan: "Permintaan dibatalkan.",
  lain: "Terjadi gangguan pada layanan AI. Coba lagi sebentar lagi.",
};

export function galatDariStatus(status: number | undefined): GalatKlienAi {
  if (status === 401 || status === 403) return new GalatKlienAi("kunci", PESAN_GALAT.kunci);
  if (status === 429) return new GalatKlienAi("laju", PESAN_GALAT.laju);
  if (status === 529 || status === 503 || status === 500 || status === 502 || status === 504) return new GalatKlienAi("beban", PESAN_GALAT.beban);
  if (status === 400 || status === 413 || status === 422) return new GalatKlienAi("permintaan", PESAN_GALAT.permintaan);
  return new GalatKlienAi("lain", PESAN_GALAT.lain);
}

export function jinakkanGalat(error: unknown): GalatKlienAi {
  if (error instanceof GalatKlienAi) return error;
  const e = (error ?? {}) as { name?: string; status?: number };
  if (e.name === "AbortError" || e.name === "APIUserAbortError") return new GalatKlienAi("dibatalkan", PESAN_GALAT.dibatalkan);
  if (typeof e.status === "number") return galatDariStatus(e.status);
  if (e.name === "APIConnectionError" || e.name === "APIConnectionTimeoutError") return new GalatKlienAi("jaringan", PESAN_GALAT.jaringan);
  return new GalatKlienAi("lain", PESAN_GALAT.lain);
}

export const BETA_FALLBACK = "server-side-fallback-2026-07-01";

function berhentiDari(stopReason: unknown): BerhentiAi {
  if (stopReason === "refusal") return "ditolak";
  if (stopReason === "max_tokens") return "batas";
  if (stopReason === "end_turn" || stopReason === "stop_sequence") return "selesai";
  if (stopReason === "tool_use") return "alat";
  return "lain";
}

type IterasiMentah = { type?: string; model?: string | null } & Record<string, unknown>;

/** Percobaan yang ditagih: pesan yang menghasilkan keluaran, dan pesan fallback yang melayani. */
export function iterasiDariUsage(usage: unknown, modelDiminta: string): IterasiPenggunaan[] {
  const daftar = (usage as { iterations?: unknown } | null)?.iterations;
  if (!Array.isArray(daftar)) return [];
  const hasil: IterasiPenggunaan[] = [];
  for (const mentah of daftar as IterasiMentah[]) {
    if (mentah?.type !== "message" && mentah?.type !== "fallback_message") continue;
    const p = penggunaanDariUsage(mentah);
    // Percobaan yang ditolak sebelum keluaran apa pun tidak ditagih (asumsi; cocokkan dengan
    // tagihan pertama). Yang ditolak di tengah aliran punya keluaran dan ditagih normal.
    if (mentah.type === "message" && p.keluar === 0) continue;
    hasil.push({ ...p, model: typeof mentah.model === "string" && mentah.model ? mentah.model : modelDiminta });
  }
  return hasil;
}

export function buatKlienAnthropic(apiKey: string): KlienAi {
  let klien: import("@anthropic-ai/sdk").default | null = null;

  async function ambil() {
    if (!klien) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      klien = new Anthropic({ apiKey, maxRetries: 2 });
    }
    return klien;
  }

  return {
    async alirkan(permintaan, opsi = {}) {
      try {
        const c = await ambil();
        const dasar = {
          model: permintaan.model,
          max_tokens: permintaan.maxTokens,
          system: permintaan.system,
          messages: permintaan.messages,
          output_config: { effort: permintaan.effort },
          ...(permintaan.tools?.length ? { tools: permintaan.tools } : {}),
        };
        const aliran = permintaan.fallback
          ? c.beta.messages.stream({ ...dasar, betas: [BETA_FALLBACK], fallbacks: "default" } as never, { signal: opsi.sinyal })
          : c.messages.stream(dasar as never, { signal: opsi.sinyal });

        let teks = "";
        for await (const kejadian of aliran as AsyncIterable<{ type: string; delta?: { type?: string; text?: string } }>) {
          if (kejadian.type === "content_block_delta" && kejadian.delta?.type === "text_delta" && kejadian.delta.text) {
            teks += kejadian.delta.text;
            opsi.onTeks?.(kejadian.delta.text);
          }
        }
        const akhir = (await aliran.finalMessage()) as {
          content?: unknown;
          stop_reason?: unknown;
          stop_details?: { category?: string | null } | null;
          model?: string;
          usage?: unknown;
        };
        const iterasi = iterasiDariUsage(akhir.usage, permintaan.model);
        const konten = Array.isArray(akhir.content) ? (akhir.content as unknown[]) : [];
        const alat = konten
          .filter((b): b is { type: "tool_use"; id: string; name: string; input: unknown } => (b as { type?: string })?.type === "tool_use")
          .map((b) => ({ id: String(b.id), name: String(b.name), input: b.input }));
        return {
          konten,
          alat,
          teks,
          berhenti: berhentiDari(akhir.stop_reason),
          model: typeof akhir.model === "string" && akhir.model ? akhir.model : permintaan.model,
          penggunaan: penggunaanDariUsage(akhir.usage),
          iterasi,
          kategoriTolak: String(akhir.stop_details?.category ?? ""),
          dialihkan: Array.isArray((akhir.usage as { iterations?: unknown[] } | undefined)?.iterations)
            ? ((akhir.usage as { iterations: Array<{ type?: string }> }).iterations).some((i) => i?.type === "fallback_message")
            : false,
        } satisfies HasilAi;
      } catch (error) {
        // Pesan SDK tidak pernah diteruskan: hanya kelas galatnya.
        throw jinakkanGalat(error);
      }
    },

    async hitungToken(permintaan) {
      const c = await ambil();
      const hasil = await c.messages.countTokens({
        model: permintaan.model,
        system: permintaan.system,
        messages: permintaan.messages,
        ...(permintaan.tools?.length ? { tools: permintaan.tools } : {}),
      } as never);
      return Number((hasil as { input_tokens?: number }).input_tokens ?? 0);
    },
  };
}

// ----------------------------------------------------------------------------
// Penyedia klien: suntikan (uji) atau env
// ----------------------------------------------------------------------------

let klienSuntik: KlienAi | null | undefined;
let klienKunci: { sidik: string; klien: KlienAi } | null = null;

/** Hanya untuk uji: undefined = pakai sumber kunci; null = paksa "tanpa kunci"; objek = klien tiruan. */
export function suntikKlienAi(klien: KlienAi | null | undefined) {
  klienSuntik = klien;
}

/** Hanya untuk uji: lupakan klien yang di-cache. */
export function lupakanKlienAi() {
  klienKunci = null;
}

/** Ada tidaknya kunci Claude (dari Pengaturan AI atau env). Tidak pernah mengembalikan isinya. */
export async function kunciApiTerpasang(db?: AletaDatabase | null): Promise<boolean> {
  return (await tentukanSumberKunciAletaAi(db)).sumber !== "belum";
}

/** Asal kunci untuk ditampilkan di layar Pengaturan: tanpa isi kunci. */
export type StatusKunciAi = { sumber: "pengaturan-ai" | "env" | "belum"; namaKoneksi?: string; alasan?: string };

export async function statusKunciAi(db?: AletaDatabase | null): Promise<StatusKunciAi> {
  const s: SumberKunciAi = await tentukanSumberKunciAletaAi(db);
  if (s.sumber === "pengaturan-ai") return { sumber: "pengaturan-ai", namaKoneksi: s.namaKoneksi };
  if (s.sumber === "belum" && s.alasan) return { sumber: "belum", alasan: s.alasan };
  return { sumber: s.sumber };
}

export async function ambilKlienAi(db?: AletaDatabase | null): Promise<KlienAi | null> {
  if (klienSuntik !== undefined) return klienSuntik;
  const sumber = await tentukanSumberKunciAletaAi(db);
  if (sumber.sumber === "belum") {
    klienKunci = null;
    return null;
  }
  const sidik = sidikKunci(sumber.kunci);
  if (!klienKunci || klienKunci.sidik !== sidik) klienKunci = { sidik, klien: buatKlienAnthropic(sumber.kunci) };
  return klienKunci.klien;
}
