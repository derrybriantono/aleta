import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaIsiGugatan, sebutanAman, type HasilIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaTeksJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import {
  ambilBerkasGateway,
  getGatewayArsipRincian,
  postGatewayIsiGugatan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ISI DARI e-COURT KE ABT (10 Okt 2026, B2 + P4 + P7)
 * ============================================================================
 *
 *   GET ?nomor=533/Pdt.G/2026/PA.Dgl&lawan=Pemohon&pelaku=Termohon[&majelis=Hakim][&ulang=1]
 *     -> { ada, tuntutan[], anak[], jawab[], usulan[], kalimat[], diabaikan[], dokumen[], catatan[] }
 *
 * Membaca surat gugatan + jawaban/replik/duplik/kesimpulan dari arsip e-Court
 * ALETA (lihat src/server/modules/aleta-ecourt/isi-gugatan.ts) dan meminta bot
 * menimbangnya dengan kamus deteksi. Hanya membaca - tidak ada yang ditulis ke
 * ABT (penulisnya panel ABT sesudah petugas mencentang). Hasil disinggahkan
 * 30 menit per perkara supaya PDF/OCR tidak dibaca ulang tiap halaman dibuka.
 */
const SINGGAH_MS = 30 * 60 * 1000;
const singgah = new Map<string, { sampai: number; hasil: HasilIsiGugatan }>();

const tanpaOcr = { ocrAda: async () => false, ocrGambar: async () => "", halamanPdf: async () => [] as Buffer[] };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, usulan: [], catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(q.get("lawan"), "Penggugat"), pelaku: sebutanAman(q.get("pelaku"), "Tergugat") };
    const majelisMasuk = String(q.get("majelis") || "");
    const majelis = /^(?:Majelis Hakim|Hakim|Hakim Tunggal)$/.test(majelisMasuk) ? majelisMasuk : undefined;
    const kunci = `${nomor}|${sebutan.lawan}|${sebutan.pelaku}|${majelis || ""}`;
    const lama = singgah.get(kunci);
    if (q.get("ulang") !== "1" && lama && lama.sampai > Date.now()) return ok({ ...lama.hasil, dariSinggahan: true });

    const hasil = await bacaIsiGugatan(
      nomor,
      sebutan,
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
          const isi = await bacaPdfDariBita(new Uint8Array(data), "berkas.pdf", 80);
          return isi.ada ? isi.halaman.map((h) => h.teks) : [];
        },
        bacaTeks: (data, bolehOcr) => (bolehOcr ? bacaTeksJawaban(data) : bacaTeksJawaban(data, tanpaOcr)),
        kirimBot: async (muatan) => {
          const r = await postGatewayIsiGugatan(muatan);
          return r.ok ? r.data : null;
        },
      },
      majelis
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
      action: "ISI_GUGATAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "isi-gugatan",
    });
  }
}
