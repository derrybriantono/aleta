import { type NextRequest } from "next/server";

import { DAFTAR_JENIS_TUGAS, DEFINISI_TUGAS, FORMAT_BERKAS, LABEL_TUJUAN } from "@/lib/aleta-ai/tugas";
import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { bacaTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { ALAT_BANTU, pelariSandbox } from "@/server/modules/aleta-ai/sandbox";
import { ambilAlihTugas, buatTugas, cekHakTugas, daftarTugas, jalankanTugas, pastikanLajuTugas } from "@/server/modules/aleta-ai/tugas";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 3 - TUGAS (cowork).
 *   GET  -> {tugas:[...milik sendiri], jenis:[{jenis,label,boleh,alasan,tujuan}], format, alatBantu:{aktif,daftar}}
 *   POST {jenis, nomorPerkara?, instruksi?, format?, judul?, mulai?=true} -> {id}
 *        Hak per peran x jenis DITEGAKKAN DI SERVER (403). mulai=true langsung
 *        menjalankan tugas DI LATAR: menutup peramban tidak menghentikannya.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const timpaan = await bacaTimpaanKemampuan(db);
    return ok({
      tugas: await daftarTugas(db, pelaku),
      jenis: DAFTAR_JENIS_TUGAS.map((j) => {
        const hak = cekHakTugas(pelaku, j, timpaan);
        return { jenis: j, label: DEFINISI_TUGAS[j].label, boleh: hak.boleh, alasan: hak.boleh ? "" : hak.pesan, tujuan: DEFINISI_TUGAS[j].tujuanKirim.map((t) => ({ tujuan: t, label: LABEL_TUJUAN[t] })) };
      }),
      format: FORMAT_BERKAS,
      alatBantu: { aktif: pelariSandbox() !== null, daftar: ALAT_BANTU.map((a) => ({ id: a.id, label: a.label })) },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await pastikanLajuTugas(db, pelaku);
    const { id } = await buatTugas(db, pelaku, badan);
    if (badan.mulai !== false) {
      const tugas = await ambilAlihTugas(db, pelaku, id);
      void jalankanTugas(db, pelaku, tugas).catch(() => undefined);
    }
    return created({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
