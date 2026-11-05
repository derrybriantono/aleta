import type { RingkasPdf } from "@/lib/aleta-abt-naskah";
import { PT_PER_MM, bacaItemPdf, susunBaris, type ItemTeks, type UkuranHalaman } from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";

/**
 * Ringkasan PDF untuk pembanding ALETA ABT lawan ABT (Tahap 5): jumlah halaman dan letak baris jabatan terakhir
 * (Hakim/Ketua/Panitera/Juru Sita) yang menandai blok tanda tangan. Pembacaan PDF memakai pembaca yang sama dengan
 * pembubuhan tanda tangan (pdfjs), jadi koordinatnya sebangun dengan letak gambar tanda tangan.
 * Ini ukuran sementara: ia belum pernah diukur terhadap PDF LibreOffice sungguhan (tidak ada LibreOffice di laptop pengembangan).
 */

const POLA_JABATAN = /^(ketua|hakim|wakil ketua|panitera|juru ?sita|jurusita)\b/i;

/** Murni (dapat diuji tanpa pdfjs). */
export function ringkasDariItem(halaman: UkuranHalaman[], item: ItemTeks[]): RingkasPdf {
  const baris = susunBaris(item);
  let letak: RingkasPdf["letakTandaTangan"] = null;
  for (const b of baris) {
    if (!POLA_JABATAN.test(b.teks.trim())) continue;
    const tinggi = halaman[b.halaman - 1]?.tinggi ?? 0;
    letak = { halaman: b.halaman, dariAtasMm: Math.round(((tinggi - b.y) / PT_PER_MM) * 10) / 10 };
  }
  return { jumlahHalaman: halaman.length, letakTandaTangan: letak };
}

export async function ringkasPdf(bita: Uint8Array): Promise<RingkasPdf> {
  const { halaman, item } = await bacaItemPdf(bita);
  return ringkasDariItem(halaman, item);
}
