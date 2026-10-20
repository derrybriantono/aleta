import type { EventAi } from "@/server/modules/aleta-ai/mesin";

/**
 * Menjadikan generator peristiwa sebagai aliran SSE (`text/event-stream`):
 * satu `data: {json}` per peristiwa, dipisah baris kosong. Denyut `: ping`
 * tiap 15 detik menjaga sambungan lewat proxy selama model berpikir.
 * Bila pelanggan memutus, generator di-return() sehingga blok finally-nya
 * (melepas tahanan dana) tetap berjalan.
 */
export function aliranSse(generator: AsyncGenerator<EventAi, void, void>, ketikaPutus?: () => void): ReadableStream<Uint8Array> {
  const pengodean = new TextEncoder();
  let denyut: ReturnType<typeof setInterval> | null = null;
  const hentikanDenyut = () => {
    if (denyut) clearInterval(denyut);
    denyut = null;
  };

  return new ReadableStream<Uint8Array>({
    start(kendali) {
      denyut = setInterval(() => {
        try {
          kendali.enqueue(pengodean.encode(": ping\n\n"));
        } catch {
          hentikanDenyut();
        }
      }, 15_000);
    },
    async pull(kendali) {
      try {
        const { value, done } = await generator.next();
        if (done) {
          hentikanDenyut();
          kendali.close();
          return;
        }
        kendali.enqueue(pengodean.encode(`data: ${JSON.stringify(value)}\n\n`));
      } catch {
        hentikanDenyut();
        try {
          kendali.enqueue(pengodean.encode(`data: ${JSON.stringify({ jenis: "gagal", pesan: "Terjadi gangguan pada layanan AI. Coba lagi sebentar lagi." })}\n\n`));
          kendali.close();
        } catch {
          /* sudah ditutup */
        }
      }
    },
    async cancel() {
      hentikanDenyut();
      ketikaPutus?.();
      await generator.return(undefined);
    },
  });
}

export const HEADER_SSE = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
