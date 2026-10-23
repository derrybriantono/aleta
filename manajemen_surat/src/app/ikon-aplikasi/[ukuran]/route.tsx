import { ImageResponse } from "next/og";

/**
 * Ikon aplikasi ALETA (layar utama HP, daftar aplikasi, apple-touch-icon).
 * Digambar dari kode supaya tidak bergantung pada berkas logo instansi yang
 * tidak ikut repo. Huruf berada di tengah 60% kotak: aman untuk ikon "maskable"
 * Android yang dipotong bulat/membulat, dan untuk sudut membulat iOS.
 */
const UKURAN = [180, 192, 512] as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return UKURAN.map((u) => ({ ukuran: String(u) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ ukuran: string }> }) {
  const { ukuran } = await params;
  const sisi = Number(ukuran);
  if (!UKURAN.includes(sisi as (typeof UKURAN)[number])) {
    return new Response("Ukuran ikon tidak dikenal.", { status: 404 });
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#155375",
          color: "#fbf8f1",
          fontSize: Math.round(sisi * 0.2),
          fontWeight: 700,
          letterSpacing: Math.round(sisi * 0.01),
        }}
      >
        ALETA
      </div>
    ),
    { width: sisi, height: sisi }
  );
}
