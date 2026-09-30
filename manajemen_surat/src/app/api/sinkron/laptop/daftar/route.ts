import { type NextRequest } from "next/server";

import { daftarBundel } from "@/server/modules/sinkron/cadangan-db";
import { periksaTokenLaptop, tolakLaptop } from "@/server/modules/sinkron/laptop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sinkron/laptop/daftar - bundel cadangan yang tersedia untuk
 * ditarik laptop (Authorization: Bearer <token laptop>). Hanya nama, ukuran,
 * SHA-256, dan apakah tersandi - tidak ada rahasia.
 */
export async function GET(request: NextRequest) {
  const h = await periksaTokenLaptop(request);
  if (!h.ok) return tolakLaptop(h);
  const bundel = (await daftarBundel()).filter((b) => b.berkas.length > 0);
  return Response.json(
    {
      ok: true,
      data: {
        bundel: bundel.map((b) => ({
          bundel: b.bundel,
          dibuat: b.dibuat,
          selesai: b.selesai,
          versiAplikasi: b.versiAplikasi,
          tersandi: b.tersandi,
          petunjukSandi: b.petunjukSandi,
          berkas: b.berkas,
          gagal: b.gagal,
        })),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
