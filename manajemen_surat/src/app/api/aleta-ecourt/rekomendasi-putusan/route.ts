import { type NextRequest } from "next/server";

import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { depsMatriksDalil } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
import { pastikanMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";
import { bersihBukti, bersihSaksi, depsPenilai } from "@/server/modules/aleta-ecourt/penilai-bukti";
import { rekomendasiPutusanPerkara, type MasukanPanelRekomendasi } from "@/server/modules/aleta-ecourt/rekomendasi-putusan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * REKOMENDASI PUTUSAN (R, 2 Nov 2026) - usulan untuk hakim menurut alat bukti tertulis & keterangan saksi, BUKAN keputusan
 * ============================================================================
 *
 *   GET  ?nomor=..&jenis=Cerai Gugat&lawan=Penggugat&pelaku=Tergugat[&tHadir=0|1][&pTidakHadirLagi=1][&acuan=YYYY-MM-DD]
 *        -> dari keterangan saksi & bukti TERSIMPAN di ABT.
 *   POST { nomor, jenis, jenisId?, lawan, pelaku, saksi?, bukti?, pihakBukti?, kehadiran?, huruf?, acuan?, tanggalNikah? }
 *        -> dari bahan yang SEDANG tersusun di panel (yang tidak dikirim dibaca dari ABT).
 * Hanya menghitung: tidak ada yang disimpan, dicetak, atau ditulis ke SIPP/ABT/e-Court (penilai A2 dipanggil dengan simpan: false).
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

const teks = (v: unknown, n: number) => String(v == null ? "" : v).trim().slice(0, n);
const tanggal = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(teks(v, 10)) ? teks(v, 10) : "");
const benar = (v: unknown): boolean | null => (v === true || v === "1" || v === "true" ? true : v === false || v === "0" || v === "false" ? false : null);

function kehadiranDari(o: Record<string, unknown> | null | undefined): MasukanPanelRekomendasi["kehadiran"] {
  if (!o || typeof o !== "object") return null;
  return { tPernahHadir: benar(o.tPernahHadir), verstekSipp: benar(o.verstekSipp), pTidakHadirLagi: benar(o.pTidakHadirLagi) };
}

export async function GET(request: NextRequest) {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    ({ db, actorUserId } = await siapkan(request));
    const q = request.nextUrl.searchParams;
    const nomor = teks(q.get("nomor"), 80);
    if (!nomor) return ok({ ada: false, rekomendasi: null, catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(q.get("lawan"), "Penggugat"), pelaku: sebutanAman(q.get("pelaku"), "Tergugat") };
    const m: MasukanPanelRekomendasi = {
      jenisPerkara: teks(q.get("jenis"), 120),
      jenisPerkaraId: Number(q.get("jenisId")) || null,
      kehadiran: kehadiranDari({ tPernahHadir: q.get("tHadir"), verstekSipp: q.get("verstek"), pTidakHadirLagi: q.get("pTidakHadirLagi") }),
      huruf: teks(q.get("huruf"), 12),
      acuan: tanggal(q.get("acuan")),
      tanggalNikah: tanggal(q.get("tanggalNikah")),
    };
    return ok(await rekomendasiPutusanPerkara(db, nomor, sebutan, m, deps(db)));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "REKOMENDASI_PUTUSAN_BACA_FAILED", feature: "aleta_ecourt", entityId: "rekomendasi-putusan" });
  }
}

export async function POST(request: NextRequest) {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    ({ db, actorUserId } = await siapkan(request));
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nomor = teks(body.nomor, 80);
    if (!nomor) return ok({ ada: false, rekomendasi: null, catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(String(body.lawan || ""), "Penggugat"), pelaku: sebutanAman(String(body.pelaku || ""), "Tergugat") };
    const pihakBukti = Array.isArray(body.pihakBukti) ? body.pihakBukti.filter((p): p is "P" | "T" => p === "P" || p === "T") : undefined;
    const m: MasukanPanelRekomendasi = {
      jenisPerkara: teks(body.jenis, 120),
      jenisPerkaraId: Number(body.jenisId) || null,
      saksi: bersihSaksi(body.saksi),
      bukti: bersihBukti(body.bukti),
      pihakBukti,
      kehadiran: kehadiranDari(body.kehadiran as Record<string, unknown>),
      huruf: teks(body.huruf, 12),
      acuan: tanggal(body.acuan),
      tanggalNikah: tanggal(body.tanggalNikah),
    };
    return ok(await rekomendasiPutusanPerkara(db, nomor, sebutan, m, deps(db)));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "REKOMENDASI_PUTUSAN_HITUNG_FAILED", feature: "aleta_ecourt", entityId: "rekomendasi-putusan" });
  }
}
