import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKuasaGugatan,
  type BarisKuasaSipp,
  type DokumenArsip,
  type HasilKuasaGugatan,
} from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaTeksJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import {
  ambilBerkasGateway,
  getGatewayAbtUsulan,
  getGatewayArsipRincian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KUASA HUKUM DARI SURAT GUGATAN e-COURT (9 Okt 2026, butir 1-4 KUASA)
 * ============================================================================
 *
 *   GET ?nomor=533/Pdt.G/2026/PA.Dgl
 *     -> { ada, usulan: [#0156#, #0184#, #8538#, #8537#], gugatan, sumber, catatan[] }
 *
 * Surat gugatan yang diunggah kuasa ke e-Court sudah diarsipkan ALETA Bot.
 * Rute ini membacanya (lapisan teks Word/PDF, OCR bila pindaian - pembaca
 * yang sama dengan penanda eksepsi/rekonvensi) lalu memetik tanggal surat
 * kuasa, nama kantor, alamat kantor, dan advokatnya (src/lib/kuasa-gugatan.ts).
 * Kuasa yang tercatat di SIPP ikut dibaca lewat bot sebagai cadangan.
 *
 * Hanya membaca - tidak ada yang ditulis ke ABT di sini (penulisnya panel
 * ABT, lewat abt/edit_data, sesudah petugas mencentang). Hasil disinggahkan
 * 30 menit per nomor perkara supaya OCR tidak diulang tiap halaman dibuka.
 */
const SINGGAH_MS = 30 * 60 * 1000;
const singgah = new Map<string, { sampai: number; hasil: HasilKuasaGugatan }>();

const tanpaOcr = { ocrAda: async () => false, ocrGambar: async () => "", halamanPdf: async () => [] as Buffer[] };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, usulan: [], catatan: ["Nomor perkara kosong."] });
    const ulang = request.nextUrl.searchParams.get("ulang") === "1";
    const lama = singgah.get(nomor);
    if (!ulang && lama && lama.sampai > Date.now()) return ok({ ...lama.hasil, dariSinggahan: true });

    const hasil = await bacaKuasaGugatan(nomor, {
      rincian: async (n) => {
        const r = await getGatewayArsipRincian(n);
        return { ok: r.ok, dokumen: r.ok ? ((r.data.dokumen || []) as DokumenArsip[]) : [] };
      },
      ambilBerkas: async (key, format) => {
        const r = await ambilBerkasGateway(key, format);
        return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      },
      bacaTeks: (data, bolehOcr) => (bolehOcr ? bacaTeksJawaban(data) : bacaTeksJawaban(data, tanpaOcr)),
      sipp: async (n) => {
        const r = await getGatewayAbtUsulan({ nomorPerkara: n, sumber: "sipp" });
        const s = (r.ok ? r.data.sipp : null) as { ok?: boolean; kuasaSipp?: BarisKuasaSipp[]; tanggalDaftar?: string } | null;
        if (!s || s.ok === false) return null;
        return { kuasaSipp: Array.isArray(s.kuasaSipp) ? s.kuasaSipp : [], tanggalDaftar: String(s.tanggalDaftar || "") };
      },
    });
    singgah.set(nomor, { sampai: Date.now() + SINGGAH_MS, hasil });
    if (singgah.size > 300) {
      for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
    }
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KUASA_GUGATAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "kuasa-gugatan",
    });
  }
}
