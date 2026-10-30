import { type NextRequest } from "next/server";

import { hurufAlasan, kodeJenisSaksi, pihakMurtad, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aleta-ecourt/blangko-derry/set-saksi - BACA SAJA (F3.3)
 *   ?jenis=<nama jenis perkara SIPP>&nomor=&folder=<folder blangko Derry>
 *   &sebutanP=&sebutanT=&jumlahP=&huruf=<A-H>&perkaraId=
 *
 * Set pertanyaan saksi dasar yang cocok dengan jenis perkara dan huruf alasan
 * (lib/set-pertanyaan-saksi.ts), sudah diisi sebutan pihak. Huruf alasan dari
 * isian layar (huruf=) atau, bila kosong, dari isian #8503# perkara itu di ABT
 * lewat mesin variabel bot (abt.nilaiPenanda). Tidak menulis apa pun:
 * petugas memuatnya ke penyunting tanya jawab Blangko Derry, menyunting, lalu
 * menyimpan lewat ABT (tanyajawab_perkara_edit) seperti set ABT biasa.
 */
type JawabanNilai = { ok?: boolean; nilai?: Record<string, { status?: string; teks?: string }> };

const teks = (x: unknown) => String(x ?? "").trim();

async function hurufDariAbt(perkaraId: string): Promise<string> {
  try {
    const j = await callAletaBotSippBridge<JawabanNilai>("abt.nilaiPenanda", { perkaraId, sidangKe: 0, penanda: ["8503"] }, { timeoutMs: 15000 });
    if (!j.ok || !j.data?.ok) return "";
    return hurufAlasan(teks(j.data.nilai?.["8503"]?.teks));
  } catch {
    return "";
  }
}

/**
 * G1 30 Okt (jawaban pengguna butir 48): huruf H - pihak yang murtad dari agama pihak di SIPP (#0011# Agama #0046#, #0020# Agama
 * #0047#) lalu posita (#5125#), lewat mesin variabel bot (baca saja). Gagal dibaca = pihak "" (set Tergugat/Termohon disarankan).
 */
async function murtadDariAbt(perkaraId: string, sebutanP: string, sebutanT: string): Promise<{ pihak: "P" | "T" | ""; agama: string; sebab: string }> {
  try {
    const j = await callAletaBotSippBridge<JawabanNilai>("abt.nilaiPenanda", { perkaraId, sidangKe: 0, penanda: ["0011", "0020", "5125"] }, { timeoutMs: 15000 });
    if (!j.ok || !j.data?.ok) return { pihak: "", agama: "", sebab: "data perkara tidak terbaca" };
    const n = j.data.nilai || {};
    return pihakMurtad({ agamaP: teks(n["0011"]?.teks), agamaT: teks(n["0020"]?.teks), posita: teks(n["5125"]?.teks), sebutanP, sebutanT });
  } catch {
    return { pihak: "", agama: "", sebab: "data perkara tidak terbaca" };
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "saksi.susun"); // 18 Okt 2026: matriks hak akses
    const q = request.nextUrl.searchParams;
    let huruf = hurufAlasan(teks(q.get("huruf")));
    let sumberHuruf = huruf ? "isian" : "";
    const perkaraId = teks(q.get("perkaraId"));
    const jenis = kodeJenisSaksi(teks(q.get("jenis")), teks(q.get("nomor")), teks(q.get("folder")), teks(q.get("sebutanP")));
    if (!huruf && /^\d+$/.test(perkaraId) && (jenis === "cg" || jenis === "ct")) {
      huruf = await hurufDariAbt(perkaraId);
      if (huruf) sumberHuruf = "abt";
    }
    const murtad =
      huruf.includes("H") && /^\d+$/.test(perkaraId) && (jenis === "cg" || jenis === "ct")
        ? await murtadDariAbt(perkaraId, teks(q.get("sebutanP")) || (jenis === "ct" ? "Pemohon" : "Penggugat"), teks(q.get("sebutanT")) || (jenis === "ct" ? "Termohon" : "Tergugat"))
        : undefined;
    const hasil = tawarkanSetSaksi({
      namaJenis: teks(q.get("jenis")),
      nomor: teks(q.get("nomor")),
      folder: teks(q.get("folder")),
      huruf,
      sebutanP: teks(q.get("sebutanP")) || undefined,
      sebutanT: teks(q.get("sebutanT")) || undefined,
      jumlahP: Math.max(1, Math.min(20, Number(q.get("jumlahP")) || 1)),
      // Tahun akad nikah (opsional): huruf G sebelum 1990 memakai bunyi sighat lama.
      tahunNikah: /^(19|20)\d{2}$/.test(teks(q.get("tahunNikah"))) ? Number(teks(q.get("tahunNikah"))) : undefined,
      murtad,
    });
    return ok({ ...hasil, sumberHuruf });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_SET_SAKSI_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-set-saksi",
    });
  }
}
