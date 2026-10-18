import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaKontakEcourt, type HasilKontakEcourt } from "@/server/modules/aleta-ecourt/kontak-ecourt";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaTeksJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import { ambilBerkasGateway, getGatewayArsipRincian, postGatewayKontakEcourt } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KONTAK-EC (11 Okt 2026): EMAIL & HP/WA PIHAK DAN KUASA DARI e-COURT
 * ============================================================================
 *
 *   GET ?nomor=533/Pdt.G/2026/PA.Dgl[&nama=BUDI bin AHMAD][&teks=1][&ulang=1]
 *     -> { ada, orang[{jenis, pihakKe, urutan, nama, sipp{email,telepon}, usulan{email,hp}}], domisili, tanpaPemilik[], dokumen[], catatan[] }
 *
 * Untuk panel SIPP (blangko Data Pihak / Pengacara) - lihat
 * src/server/modules/aleta-ecourt/kontak-ecourt.ts. Hanya membaca; SIPP diisi
 * ekstensi atas klik petugas, Simpan ditekan petugas. Disinggahkan 30 menit.
 */
const SINGGAH_MS = 30 * 60 * 1000;
const singgah = new Map<string, { sampai: number; hasil: HasilKontakEcourt }>();
const tanpaOcr = { ocrAda: async () => false, ocrGambar: async () => "", halamanPdf: async () => [] as Buffer[] };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // 18 Okt 2026: matriks hak akses

    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") || "").trim().slice(0, 80);
    const nama = String(q.get("nama") || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const teks = q.get("teks") === "1";
    if (!nomor && !nama) return ok({ ada: false, orang: [], catatan: ["Nomor perkara dan nama kosong."] });
    const kunci = `${nomor}|${nama.toLowerCase()}|${teks ? 1 : 0}`;
    const lama = singgah.get(kunci);
    if (q.get("ulang") !== "1" && lama && lama.sampai > Date.now()) return ok({ ...lama.hasil, dariSinggahan: true });

    const hasil = await bacaKontakEcourt(
      { nomor, nama, teks },
      {
        rincian: async (n) => {
          const r = await getGatewayArsipRincian(n);
          return { ok: r.ok, dokumen: r.ok ? ((r.data.dokumen || []) as DokumenArsip[]) : [] };
        },
        ambilBerkas: async (key, format) => {
          const r = await ambilBerkasGateway(key, format);
          return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
        },
        halamanPdf: async (data) => {
          const isi = await bacaPdfDariBita(new Uint8Array(data), "berkas.pdf", 40);
          return isi.ada ? isi.halaman.map((h) => h.teks) : [];
        },
        bacaTeks: (data) => bacaTeksJawaban(data, tanpaOcr),
        kirimBot: async (muatan) => {
          const r = await postGatewayKontakEcourt(muatan);
          return r.ok ? r.data : null;
        },
      }
    );
    singgah.set(kunci, { sampai: Date.now() + SINGGAH_MS, hasil });
    if (singgah.size > 300) {
      for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
    }
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONTAK_ECOURT_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "kontak-pihak",
    });
  }
}
