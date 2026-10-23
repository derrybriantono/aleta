import { sidikPaketEkstensi } from "@/server/shared/ekstensi-paket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Versi dan sidik paket ekstensi untuk pembaru otomatis.
 *
 * ============================================================================
 * SENGAJA TANPA SESI
 * ============================================================================
 *
 * Sama seperti updates.xml dan paket.crx: pembaruan tidak boleh bergantung pada
 * petugas yang sedang masuk ALETA - tanpa ini ekstensi yang belum login tidak
 * pernah menemukan versi baru, dan diamnya tidak terlihat. Yang dijawab hanya
 * nomor versi, SHA-256 dan ukuran paket - bukan data perkara, bukan akun.
 *
 * Sidik inilah yang diteruskan ekstensi ke pembantu lokal; pembantu mengunduh
 * paketnya LANGSUNG dari server dan menolak bila sidik hasil unduhan berbeda.
 */
export async function GET() {
  try {
    const { versi, sha256, ukuran } = sidikPaketEkstensi();
    if (!versi) {
      return Response.json({ ok: false, message: "Versi ekstensi tidak terbaca." }, { status: 503 });
    }
    return Response.json(
      { ok: true, versi, sha256, ukuran, versiPembantuMin: 1 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (galat) {
    return Response.json(
      { ok: false, message: `Paket tidak dapat disusun: ${galat instanceof Error ? galat.message : "sebab tidak diketahui"}` },
      { status: 503 }
    );
  }
}
