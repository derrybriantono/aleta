import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import type { HasilKuasaGugatan } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { bacaKuasaEcourt } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
import { bacaRegisterKuasa, usulanRegisterKuasa } from "@/server/modules/aleta-ecourt/register-kuasa";
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

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // 18 Okt 2026: matriks hak akses

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, usulan: [], catatan: ["Nomor perkara kosong."] });
    const ulang = request.nextUrl.searchParams.get("ulang") === "1";
    const lama = singgah.get(nomor);
    // 3 Nov 2026: register kuasa yang dicatat petugas di borang kuasa SIPP (aleta_register_kuasa, 0132) menjadi usulan
    // #8539# dan #0132# yang MENGALAHKAN dugaan dari kolom surat kuasa SIPP. Dibaca tiap permintaan (bukan dari singgahan 30 menit).
    const denganRegister = async (hasil: HasilKuasaGugatan) => {
      try {
        const reg = usulanRegisterKuasa(await bacaRegisterKuasa(db!, nomor));
        if (!reg.length) return hasil;
        const kode = new Set(reg.map((u) => u.kode));
        return { ...hasil, ada: true, usulan: [...hasil.usulan.filter((u) => !kode.has(u.kode)), ...reg] };
      } catch {
        return hasil; // tanpa register tercatat: usulan lama tetap
      }
    };
    if (!ulang && lama && lama.sampai > Date.now()) return ok({ ...(await denganRegister(lama.hasil)), dariSinggahan: true });

    // 19 Okt: pembaca yang sama dengan agen draf putusan (isi-sipp-sumber.ts).
    const hasil = await bacaKuasaEcourt(nomor);
    singgah.set(nomor, { sampai: Date.now() + SINGGAH_MS, hasil });
    if (singgah.size > 300) {
      for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
    }
    return ok(await denganRegister(hasil));
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
