import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  ambilKunciPenetapanGateway,
  bacaKeadaanPenetapanGateway,
  getGatewayPenunjukanUsulan,
  kirimPenetapanTulisGateway,
  kirimPenetapanTulisRantaiGateway,
  lepasKunciPenetapanGateway,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  type JenisPenetapan,
  type Ketergantungan,
  type MasukanKerja,
  kerjakanPenetapan,
} from "@/server/modules/aleta-ecourt/kerjakan-penetapan";
import { bacaPengaturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { pastikanPejabatLangkah, pejabatSahUntukTanggal } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { periksaLiburPenetapan } from "@/server/modules/hari-libur/penjaga";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kerjakan penetapan satu perkara (PMH -> PPP -> PJS -> PHS) - satu pintu.
 * Bentuk badan dan jawaban: docs/penetapan/KERJAKAN-PENETAPAN.md.
 *
 * Operator dari sesi ALETA (badan yang menyebutnya diabaikan), kemampuan sama
 * dengan menulis penetapan ("penunjukan"). Kering sebagai bawaan: menulis
 * menuntut `kering:false` yang tegas. Tidak ada jalur bongkar di sini.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");
    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });

    const badan = (await request.json()) as Record<string, unknown>;
    const nomorPerkara = String(badan.nomorPerkara || "").trim();
    if (!nomorPerkara) return Response.json({ ok: false, alasan: "nomor_perkara_kosong" }, { status: 400 });
    const olehUsername = String(badan.olehUsername || "").trim();
    if (!olehUsername) return Response.json({ ok: false, alasan: "akun_sipp_belum_terbaca" }, { status: 400 });
    const mode = badan.mode === "manual" ? "manual" : "otomatis";

    const langkahMasuk = badan.langkah && typeof badan.langkah === "object" ? (badan.langkah as Record<string, unknown>) : null;
    const langkah: Partial<Record<JenisPenetapan, boolean>> | undefined = langkahMasuk
      ? { pmh: langkahMasuk.pmh === true, ppp: langkahMasuk.ppp === true, pjs: langkahMasuk.pjs === true, phs: langkahMasuk.phs === true }
      : undefined;

    const masuk: MasukanKerja = {
      nomorPerkara,
      perkaraId: Number(badan.perkaraId) > 0 ? Number(badan.perkaraId) : undefined,
      mode,
      pilihan: badan.pilihan && typeof badan.pilihan === "object" ? (badan.pilihan as MasukanKerja["pilihan"]) : {},
      langkah,
      // Menulis HARUS diminta tegas.
      kering: badan.kering !== false,
      olehUsername,
      operator,
      ip: alamatIpPeramban(request),
      kunciToken: String(badan.kunciToken || "") || undefined,
      tanyaJamKerja: badan.tanyaJamKerja === true,
      jamKerja: badan.jamKerja === "antrekan" || badan.jamKerja === "sekarang" ? badan.jamKerja : undefined,
    };

    const database = db;
    const dep: Ketergantungan = {
      bacaKeadaan: (acuan) => bacaKeadaanPenetapanGateway(acuan),
      ambilKunci: (p) => ambilKunciPenetapanGateway(p),
      lepasKunci: (p) => lepasKunciPenetapanGateway(p),
      bacaUsulan: async (nomor, pilihanMajelis) => {
        const pengaturan = await bacaPengaturanPenunjukan(database);
        return getGatewayPenunjukanUsulan({
          nomorPerkara: nomor,
          pengaturan: {
            aturan: pengaturan.aturan as unknown as Record<string, unknown>,
            hariSidang: pengaturan.hariSidang,
            paniteraMajelis: pengaturan.paniteraMajelis,
            susunanSk: pengaturan.susunanSk as unknown as Record<string, unknown>[],
            pilihanMajelis,
            andaian: [],
          },
        });
      },
      pastikanPejabat: async (tanggal, langkahTulis) => {
        if (!langkahTulis.some((x) => ["pmh", "ppp", "pjs"].includes(x.jenis))) return null;
        const baca = await pejabatSahUntukTanggal(database, tanggal);
        if (!baca.ok) return { alasan: "pemetaan_jabatan_tidak_terbaca" };
        for (const satu of langkahTulis) {
          const hasil = pastikanPejabatLangkah(baca.sah, satu.jenis, satu.pejabatUsername || "");
          if (!hasil.ok) return { alasan: hasil.alasan, jenis: hasil.jenis, username: hasil.username };
          if (hasil.username) satu.pejabatUsername = hasil.username;
        }
        return null;
      },
      periksaLibur: async (tanggal, langkahTulis) => {
        const libur = await periksaLiburPenetapan(database, tanggal, langkahTulis);
        return libur ? { alasan: libur.alasan, diminta: libur.diminta } : null;
      },
      tulisRantai: (p) => kirimPenetapanTulisRantaiGateway(p),
      tulisKering: (p) => kirimPenetapanTulisGateway({ ...p, kering: true }),
    };

    const hasil = await kerjakanPenetapan(dep, masuk);
    return Response.json(hasil, { status: 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_KERJAKAN_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
