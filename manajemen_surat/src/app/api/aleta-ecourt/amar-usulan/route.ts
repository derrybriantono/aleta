import { type NextRequest } from "next/server";

import { susunAmar } from "@/lib/amar-dari-petitum";
import { getDatabase } from "@/server/db/client";
import { getGatewayPraperiksaFakta } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

/**
 * G2B 2.5 (30 Okt 2026): usulan amar berbutir dari petitum menurut status putusan, untuk kolom Amar borang Putusan Akhir SIPP
 * (ekstensi amar-petitum-sipp.js). BACA SAJA: petitum, pihak, dan tanggal daftar dari bot (fakta praperiksa); nama satker dari identitas
 * satker. Tidak menulis ke SIPP; yang mengisi kolom dan menekan Simpan adalah halaman petugas.
 *
 *   GET ?nomor=<nomor perkara>&status=<nama status SIPP>&verstek=1&sebagian=1&prodeo=1&biaya=<rupiah>
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") ?? "").trim();
    const status = String(q.get("status") ?? "").trim();
    if (!nomor) return ok({ ada: false, alasan: "Nomor perkara kosong." });
    const fakta = await getGatewayPraperiksaFakta(nomor);
    if (!fakta.ok || !fakta.data?.ok) return ok({ ada: false, alasan: "Data perkara belum terbaca dari SIPP." });
    const f = fakta.data;
    const satker = await bacaSatkerAktif(db).catch(() => null);
    const namaSatker = String(satker?.namaPengadilan ?? "").replace(/^\s*pengadilan\s+agama\s+/i, "").trim();
    const nama = (ke: number) => (f.pihak ?? []).filter((p) => Number(p.pihakKe) === ke).map((p) => String(p.nama || "").trim()).filter(Boolean);
    const biaya = Number(q.get("biaya"));
    const hasil = susunAmar({
      jenisPerkara: f.jenisPerkara || f.jenisPerkaraLengkap,
      nomorPerkara: f.nomorPerkara || nomor,
      status,
      sebagian: q.get("sebagian") === "1",
      verstek: q.get("verstek") === "1",
      petitum: f.petitum,
      namaPihak1: nama(1),
      namaPihak2: nama(2),
      prodeo: q.get("prodeo") === "1",
      satker: namaSatker || "...",
      tahunDaftar: Number(String(f.tanggalDaftar || "").slice(0, 4)) || null,
      biaya: Number.isFinite(biaya) && biaya > 0 ? biaya : null,
    });
    return ok({ ada: hasil.ok, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ECOURT_AMAR_USULAN_READ_FAILED", feature: "aleta_ecourt" });
  }
}
