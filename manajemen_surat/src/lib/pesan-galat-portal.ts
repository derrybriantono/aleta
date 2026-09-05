/**
 * Membaca pesan dari jawaban galat rute portal.
 *
 * Bentuknya { ok: false, error: { message, details } } - error adalah OBYEK,
 * bukan teks. Merangkainya langsung ke dalam pesan menghasilkan
 * "[object Object]" di layar, yang lebih tidak berguna daripada tidak
 * menampilkan apa-apa.
 */
export function pesanGalatPortal(isi: unknown, cadangan: string) {
  if (isi && typeof isi === "object") {
    const badan = isi as { error?: unknown; message?: unknown; alasan?: unknown };

    if (badan.error && typeof badan.error === "object") {
      const pesan = (badan.error as { message?: unknown }).message;
      if (typeof pesan === "string" && pesan.trim()) return pesan;
    }

    for (const nilai of [badan.error, badan.message, badan.alasan]) {
      if (typeof nilai === "string" && nilai.trim()) return nilai;
    }
  }
  return cadangan;
}
