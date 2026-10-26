import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { bacaSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { bacaGugatanSinggah } from "@/server/modules/aleta-ecourt/isi-gugatan-singgah";
import { bacaGugatanEcourt } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
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
 *
 * G2 (25 Okt 2026): saklar isi otomatis daftar bukti dan tanya-jawab kesimpulan (Super Admin, bawaan MATI) dibaca dari
 * pengaturan dan diteruskan ke bot; jawaban memuat `otomatis` (saklar yang berlaku). Saklar MATI = jawaban seperti sebelum G2.
 */
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
    if (!nomor) return ok({ ada: false, usulan: [], catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(q.get("lawan"), "Penggugat"), pelaku: sebutanAman(q.get("pelaku"), "Tergugat") };
    const majelisMasuk = String(q.get("majelis") || "");
    const majelis = /^(?:Majelis Hakim|Hakim|Hakim Tunggal)$/.test(majelisMasuk) ? majelisMasuk : undefined;
    // JJ2: bukti=1 = baca juga berkas bukti (daftar bukti, surat keterangan KUA); hanya diminta panel bila halamannya memuat variabel bukti.
    const denganBukti = q.get("bukti") === "1";
    const setelan = await bacaSetelanBerkas(db);
    const otomatis = { bukti: setelan.bukti, kesimpulan: setelan.kesimpulan };

    // 19 Okt: pembaca yang sama dengan agen draf putusan (bacaGugatanEcourt, isi-sipp-sumber.ts).
    const { hasil, dariSinggahan } = await bacaGugatanSinggah(nomor, sebutan, majelis, { denganBukti, otomatis, ulang: q.get("ulang") === "1" }, bacaGugatanEcourt);
    return ok(dariSinggahan ? { ...hasil, dariSinggahan: true } : hasil);
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
