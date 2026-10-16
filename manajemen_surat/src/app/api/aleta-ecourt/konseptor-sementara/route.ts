import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKonseptorSementara,
  simpanKonseptorSementara,
} from "@/server/modules/aleta-ecourt/konseptor-sementara";
import {
  bacaKeadaanKonseptor,
  bacaRingkasKemajuan,
  keadaanDariBot,
  perkaraBerchecklist,
} from "@/server/modules/aleta-ecourt/konseptor-langkah";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konseptor sementara - tunjukan tangan, seluruhnya milik ALETA.
 *
 * ============================================================================
 * SIPP TIDAK PERNAH DITULIS DARI SINI
 * ============================================================================
 *
 * Tunjukan tangan bukan fakta perkara. Menuliskannya ke jejak tahapan SIPP
 * akan membuat penunjukan terbaca sebagai pekerjaan yang sudah dikerjakan -
 * dan jejak itulah yang kemudian dibaca kembali sebagai "konseptornya siapa",
 * sehingga tunjukan yang keliru menjadi kebenaran yang tidak dapat dibantah.
 *
 * Kapabilitasnya sama dengan layar antrian sidang: yang boleh melihat jadwal
 * perkaranya adalah yang boleh menunjuk siapa yang menyusun putusannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const mentah = String(request.nextUrl.searchParams.get("perkaraId") || "");
    const daftar = mentah
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (daftar.length === 0) return ok({ ada: true, peta: {} });

    const peta = await bacaKonseptorSementara(db, daftar);
    // F1.6: ringkasan checklist ikut pada perkara yang punya tunjukan, supaya
    // Jadwal Sidang tidak memerlukan permintaan kedua. Gagal membacanya tidak
    // menghilangkan tunjukannya.
    //
    // Keputusan 17 Okt butir 35 & 38: keadaan perkara (eksepsi/rekonvensi/
    // putusan sela -> langkah bersyarat) dan konseptor yang SUDAH tercatat di
    // SIPP dibaca dari bot dalam SATU permintaan untuk seluruh daftar. Perkara
    // tanpa tunjukan tetapi berkonseptor SIPP (atau sudah punya centang)
    // mendapat checklist juga - di `checklist`, bukan di `peta`, sebab `peta`
    // berarti tunjukan tangan.
    const bertunjukan = Object.keys(peta);
    const checklist: Record<string, { kemajuan?: unknown; konseptorSipp: string[] }> = {};
    const keadaan = await bacaKeadaanKonseptor(daftar);
    let berchecklist = new Set<string>();
    try {
      berchecklist = await perkaraBerchecklist(db, daftar);
    } catch {
      /* tabel 0067 belum terpasang */
    }
    for (const pid of daftar) {
      if (peta[pid]) continue;
      const sipp = keadaan.peta[pid]?.konseptor ?? [];
      if (sipp.length || berchecklist.has(pid)) checklist[pid] = { konseptorSipp: sipp.map((k) => k.nama).filter(Boolean) };
    }
    const dinilai = [...bertunjukan, ...Object.keys(checklist)];
    if (dinilai.length > 0) {
      try {
        const kemajuan = await bacaRingkasKemajuan(db, dinilai, { keadaan: keadaan.terbaca ? keadaanDariBot(keadaan.peta) : undefined });
        for (const pid of bertunjukan) if (kemajuan[pid]) peta[pid] = { ...peta[pid], kemajuan: kemajuan[pid] };
        for (const pid of Object.keys(checklist)) if (kemajuan[pid]) checklist[pid].kemajuan = kemajuan[pid];
      } catch {
        /* tabel 0067 belum terpasang - tunjukan tetap terbaca */
      }
    }
    return ok({ ada: true, peta, checklist });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_SEMENTARA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-sementara",
    });
  }
}

type Masukan = {
  perkaraId?: string;
  nomorPerkara?: string;
  nama?: string;
  pengguna?: string;
  catatan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.konseptor"); // HAK-PERAN 12 Okt: matriks peran

    const masukan = (await request.json().catch(() => ({}))) as Masukan;

    const hasil = await simpanKonseptorSementara(db, {
      perkaraId: String(masukan.perkaraId ?? ""),
      nomorPerkara: String(masukan.nomorPerkara ?? ""),
      nama: String(masukan.nama ?? ""),
      pengguna: String(masukan.pengguna ?? ""),
      catatan: String(masukan.catatan ?? ""),
      // Dari sesi, tidak dapat diketik - lihat catatan pada simpanKonseptorSementara.
      oleh: aktor.name || String(actorUserId ?? "petugas"),
    });

    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_SEMENTARA_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-sementara",
    });
  }
}
