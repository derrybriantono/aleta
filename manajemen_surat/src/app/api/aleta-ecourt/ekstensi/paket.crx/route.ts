import { susunCrx } from "@/server/shared/crx";
import { kunciCrx, versiEkstensi, zipEkstensiAkar } from "@/server/shared/ekstensi-paket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berkas .crx yang diunduh Chrome saat memperbarui ekstensi.
 *
 * ============================================================================
 * DIBUNGKUS SAAT DIMINTA, BUKAN SAAT MEMBANGUN
 * ============================================================================
 *
 * Isinya disusun dari berkas ekstensi yang SAMA dengan yang disajikan sebagai
 * ZIP - tidak ada langkah pembungkusan terpisah yang dapat tertinggal. Selama
 * ini kekeliruan yang paling mahal justru datang dari dua salinan yang
 * seharusnya sama: peta kolom dan alamat rute yang berselisih tanpa suara.
 *
 * Membungkusnya saat diminta berarti versi yang diunduh Chrome SELALU sama
 * dengan yang dilaporkan updates.xml, tanpa siapa pun perlu mengingat urutan
 * membangun.
 *
 * ============================================================================
 * SENGAJA TANPA SESI
 * ============================================================================
 *
 * Sama seperti updates.xml: Chrome mengunduhnya tanpa membawa kuki. Menuntut
 * sesi berarti pembaruan tidak pernah berjalan, dan diamnya tidak terlihat.
 */
export async function GET() {
  const kunci = kunciCrx();
  if (!kunci) {
    return Response.json(
      { ok: false, message: "ALETA_EKSTENSI_CRX_KEY belum disetel di server." },
      { status: 503 }
    );
  }

  let crx: Buffer;
  try {
    crx = susunCrx(zipEkstensiAkar(), kunci);
  } catch (galat) {
    return Response.json(
      {
        ok: false,
        message: `Paket .crx tidak dapat disusun: ${galat instanceof Error ? galat.message : "sebab tidak diketahui"}`,
      },
      { status: 503 }
    );
  }

  const versi = versiEkstensi() || "0";
  return new Response(new Uint8Array(crx), {
    status: 200,
    headers: {
      "Content-Type": "application/x-chrome-extension",
      "Content-Disposition": `attachment; filename="aleta-ekstensi-sipp-${versi}.crx"`,
      "Content-Length": String(crx.length),
      "Cache-Control": "no-store",
    },
  });
}
