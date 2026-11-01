import { type NextRequest } from "next/server";

import { type StatusPembuktian } from "@/lib/penilai-bukti";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { depsMatriksDalil } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
import { pastikanMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";
import { bersihBukti, bersihSaksi, depsPenilai, nilaiPembuktianPerkara, tetapkanPembuktian } from "@/server/modules/aleta-ecourt/penilai-bukti";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENILAI PEMBUKTIAN (A2, 1 Nov 2026) - bahan musyawarah majelis, bukan putusan
 * ============================================================================
 *
 *   GET  ?nomor=..&lawan=Penggugat&pelaku=Tergugat
 *        -> penilaian dari keterangan saksi & bukti TERSIMPAN di ABT.
 *   POST { nomor, lawan, pelaku, saksi?:[{id,pihak,ke,baris:[{tanya,jawab}]}], bukti?:[{kode,pihak,jenis,teks}], pihakBukti?:["P","T"] }
 *        -> penilaian dari bahan yang SEDANG tersusun di panel (yang tidak dikirim dibaca dari ABT).
 *   POST { nomor, lawan, pelaku, tetapkan: { id, status | null, catatan? } }
 *        -> majelis/PP menetapkan status satu dalil (null = kembali ke hitungan aturan).
 *
 * Status per dalil disimpan ke matriks dalil (kolom pembuktian) untuk A1 dan panel. Permintaan tidak ditahan lebih dari ±6 detik
 * (matriks dalil: batasMs). Tidak menulis ke SIPP/ABT/e-Court.
 */
const BATAS_MATRIKS_MS = 6_000;

function deps(db: AletaDatabase) {
  return depsPenilai((n, sb) => pastikanMatriksDalil(db, n, sb, depsMatriksDalil(db), { batasMs: BATAS_MATRIKS_MS }));
}

async function siapkan(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  await pastikanKapabilitas(db, actorUserId, "panel");
  await pastikanAksi(db, actorUserId, "status.data-pihak");
  return { db, actorUserId };
}

export async function GET(request: NextRequest) {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    ({ db, actorUserId } = await siapkan(request));
    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, hasil: null, catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(q.get("lawan"), "Penggugat"), pelaku: sebutanAman(q.get("pelaku"), "Tergugat") };
    return ok(await nilaiPembuktianPerkara(db, nomor, sebutan, deps(db)));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENILAIAN_BUKTI_BACA_FAILED", feature: "aleta_ecourt", entityId: "penilaian-bukti" });
  }
}

export async function POST(request: NextRequest) {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    ({ db, actorUserId } = await siapkan(request));
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nomor = String(body.nomor || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, hasil: null, catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(String(body.lawan || ""), "Penggugat"), pelaku: sebutanAman(String(body.pelaku || ""), "Tergugat") };
    const t = body.tetapkan as { id?: unknown; status?: unknown; catatan?: unknown } | undefined;
    if (t && typeof t === "object") {
      await pastikanAksi(db, actorUserId, "putusan.draf");
      const id = String(t.id || "").slice(0, 40);
      const status = t.status === null || t.status === "" ? null : (String(t.status) as StatusPembuktian);
      const berhasil = await tetapkanPembuktian(db, nomor, id, status, String(actorUserId || "petugas"), String(t.catatan || ""));
      if (!berhasil) return ok({ ada: false, hasil: null, catatan: ["Status belum tersimpan: dalil atau perkara belum ada di matriks."] });
    }
    const pihakBukti = Array.isArray(body.pihakBukti) ? body.pihakBukti.filter((p): p is "P" | "T" => p === "P" || p === "T") : undefined;
    return ok(await nilaiPembuktianPerkara(db, nomor, sebutan, deps(db), { saksi: bersihSaksi(body.saksi), bukti: bersihBukti(body.bukti), pihakBukti }));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENILAIAN_BUKTI_HITUNG_FAILED", feature: "aleta_ecourt", entityId: "penilaian-bukti" });
  }
}
