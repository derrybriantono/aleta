import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { susunLembarTanyaJawab } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { muatLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { bacaSaksiAbt } from "@/lib/keterangan-abt";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alat bantu tulis BAS - lembar tanya-jawab yang sudah terisi dari berkas.
 *
 * Dua bentuk pemakaian:
 *
 *   ?jenisPerkaraId=347            daftar kumpulan pertanyaan untuk jenis itu
 *   ?perkaraId=10096&kode=A1a      lembar tanya-jawab yang sudah terisi
 *
 * Yang pertama dipakai saat panitera memilih; yang kedua saat ia mulai menulis.
 * Keduanya digabung dalam satu rute karena keduanya menjawab pertanyaan yang
 * sama dari sudut berbeda - pertanyaan apa yang harus diajukan hari ini.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const jenisPerkaraId = String(getSearchParam(request, "jenisPerkaraId") ?? "").trim();
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const kode = String(getSearchParam(request, "kode") ?? "").trim();
    const nomorPerkara = String(getSearchParam(request, "nomor") ?? "").trim();

    if (jenisPerkaraId && !kode) {
      const katalog = await callAletaBotSippBridge("abt.katalogTanyaJawab", { jenisPerkaraId });
      return ok(katalog.ok ? katalog.data : { ada: false, sebab: katalog.error ?? "tidak terbaca", kumpulan: [] });
    }

    // Jawaban yang sudah tersimpan dibawa serta, sehingga lembar yang dibuka
    // kembali memperlihatkan apa yang sudah diketik panitera - bukan lembar
    // kosong yang membuatnya mengira pekerjaannya hilang.
    const saksiKe = Number(getSearchParam(request, "saksiKe") ?? "1") || 1;
    const tersimpan = await muatLembar(db, { perkaraId, kode, saksiKe });
    const jawabanTersimpan: Record<number, string> = {};
    for (const baris of tersimpan?.baris ?? []) jawabanTersimpan[baris.urutan] = baris.jawaban;

    const lembar = await susunLembarTanyaJawab({ perkaraId, kode, nomorPerkara, jawabanTersimpan });

    // Keterangan yang SUDAH terekam di ABT untuk saksi ini, sebagai rujukan.
    //
    // Ditampilkan berdampingan, TIDAK dituangkan ke kotak jawaban dengan
    // sendirinya. Urutan pertanyaan ABT tidak dijamin sama dengan katalog, dan
    // jawaban yang mendarat di bawah pertanyaan yang keliru terbaca masuk akal
    // justru saat ia paling salah - jadi yang memindahkannya harus panitera,
    // yang dapat membaca keduanya sekaligus.
    const berkas = await rakitBerkasPerkara(perkaraId, nomorPerkara);
    const rekamanAbt = bacaSaksiAbt(berkas.pemeriksaanSaksi.nilai).find((item) => item.saksiKe === saksiKe) ?? null;

    return ok({ ...lembar, saksiKe, tersimpan, rekamanAbt });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_TANYA_JAWAB_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-tanya-jawab",
    });
  }
}
