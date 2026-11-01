import { type NextRequest } from "next/server";

import { periksaNaskah, ringkasanRak } from "@/lib/rak-peraturan/indeks";
import { jenisInfo } from "@/lib/rak-peraturan/periksa";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Naskah putusan terpanjang yang diukur ±200 rb aksara; batas longgar supaya tidak menahan permintaan besar yang keliru. */
const BATAS_AKSARA = 1_500_000;
const BATAS_TEMUAN = 40;

/**
 * POST /api/aleta-ecourt/blangko-derry/periksa-kutipan  { teks } - BACA SAJA (P1 rak peraturan, 1 Nov 2026)
 *
 * Kutipan dasar hukum di naskah (teks polos yang sudah disiapkan panel) dicocokkan dengan rak peraturan terverifikasi:
 * pasal tidak ada, ayat/huruf tidak ada, bunyi kutipan tidak sesuai. Untuk "Periksa sebelum cetak" Blangko Derry sebagai
 * butir INFO - tidak menahan cetak, tidak mengubah naskah, tidak menulis apa pun. Diminta sekali per naskah yang disiapkan.
 * Indeks rak dibangun sekali per proses; pemeriksaan satu naskah linear (terukur di laporan P1).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = (await request.json().catch(() => null)) as { teks?: unknown } | null;
    const teks = typeof badan?.teks === "string" ? badan.teks : "";
    if (!teks.trim()) return badRequest("Naskah kosong.");
    if (teks.length > BATAS_AKSARA) return badRequest("Naskah terlalu panjang untuk diperiksa.");
    const semua = periksaNaskah(teks);
    const masalah = semua.filter((t) => !jenisInfo(t.jenis));
    // Yang pasti (pembandingnya terverifikasi) lebih dulu.
    masalah.sort((a, b) => Number(b.pasti) - Number(a.pasti) || a.letak - b.letak);
    const belum = semua.filter((t) => jenisInfo(t.jenis)).reduce((n, t) => n + t.jumlah, 0);
    return ok({
      temuan: masalah.slice(0, BATAS_TEMUAN).map((t) => ({ jenis: t.jenis, pasti: t.pasti, rujukan: t.rujukan, pesan: t.pesan, jumlah: t.jumlah })),
      lebih: Math.max(0, masalah.length - BATAS_TEMUAN),
      belumTerverifikasi: belum,
      rak: ringkasanRak(),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_PERIKSA_KUTIPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-periksa-kutipan",
    });
  }
}
