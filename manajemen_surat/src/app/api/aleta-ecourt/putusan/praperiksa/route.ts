import { type NextRequest } from "next/server";

import {
  nilaiPraperiksa,
  raporTanpaFakta,
  tanggalIso,
  type PendapatAi,
  type UsulanPutusan,
} from "@/lib/praperiksa-putusan";
import { teksDariHtml } from "@/lib/alasan-perkara-sipp";
import { pecahNaskahPutusan } from "@/lib/susunan-putusan";
import { readJsonBody } from "@/server/shared/request";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayPraperiksaFakta,
  mintaGatewayPraperiksaPendapat,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Praperiksa putusan - Tahap 2 rencana agen.
 *
 *   POST { nomorPerkara, tanggalPutusan, statusPutusan, verstek, mintaAi }
 *
 * ============================================================================
 * DIPANGGIL EKSTENSI TEPAT SEBELUM MENGISI BORANG
 * ============================================================================
 *
 * Ekstensi berdiri di halaman Putusan Akhir SIPP dan membawa tiga hal yang
 * hanya ada di sana: tanggal putusan yang diketik petugas, Status Putusan
 * yang terpilih, dan pilihan verstek. Rute ini mengambil draf ALETA
 * terbaru, meminta fakta SIPP dari bot, lalu menimbang seluruhnya di
 * src/lib/praperiksa-putusan.ts - di tempat yang dapat diuji.
 *
 * Jawabannya rapor: temuan bertingkat hentikan / perhatian / catatan.
 * Bila ada yang menahan, EKSTENSI yang berhenti; rute ini tidak menulis ke
 * mana pun dan tidak mengubah apa pun. Agen ini membaca.
 *
 * ============================================================================
 * PENDAPAT AI SESUDAH PEMERIKSAAN PASTI, DAN HANYA BILA TIDAK ADA YANG MENAHAN
 * ============================================================================
 *
 * Pertentangan yang dibuktikan dari SIPP sudah cukup untuk berhenti; meminta
 * pendapat model atasnya hanya menunda jawabannya. Pendapat diminta hanya
 * bila pemeriksaan pasti lolos, dan hasilnya tidak pernah menahan - ia
 * perhatian. Bot menyamarkan nama lebih dulu dan mengirim lewat jalur
 * "perkara"; bila jalurnya belum disetel, rapor menulis "pendapat AI
 * dilewati" beserta sebabnya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = await readJsonBody<{
      nomorPerkara?: string;
      tanggalPutusan?: string;
      statusPutusan?: string;
      verstek?: string;
      mintaAi?: boolean;
    }>(request);
    const nomorPerkara = String(badan?.nomorPerkara ?? "").trim();
    if (!nomorPerkara) return ok({ ada: false, sebab: "Nomor perkara belum disebut." });

    // Draf TERBARU - versi tertinggi, sama dengan isian-sipp: inilah yang
    // akan diisikan ekstensi, jadi inilah yang diperiksa.
    const draf = await db.queryOne<{ id: string; naskah: string; keadaan: string; versi: number }>(
      `SELECT id, naskah, keadaan, versi
         FROM aleta_putusan_draf
        WHERE nomor_perkara = ?
          AND keadaan <> 'dibatalkan'
        ORDER BY versi DESC
        LIMIT 1`,
      [nomorPerkara]
    );
    if (!draf) {
      return ok({
        ada: false,
        sebab: "Belum ada draf putusan ALETA untuk perkara ini, jadi tidak ada yang dapat diperiksa.",
      });
    }

    const bagian = pecahNaskahPutusan(draf.naskah);
    const usulan: UsulanPutusan = {
      nomorPerkara,
      tanggalPutusan: String(badan?.tanggalPutusan ?? ""),
      statusPutusan: String(badan?.statusPutusan ?? ""),
      verstek: String(badan?.verstek ?? ""),
      amar: bagian.amar ?? "",
      naskah: draf.naskah,
    };

    const fakta = await getGatewayPraperiksaFakta(nomorPerkara, tanggalIso(usulan.tanggalPutusan));
    if (!fakta.ok) {
      return ok({
        ada: true,
        drafId: draf.id,
        versi: draf.versi,
        keadaan: draf.keadaan,
        nomorPerkara,
        usulan: ringkasUsulan(usulan),
        fakta: null,
        ...raporTanpaFakta(fakta.error),
      });
    }

    let rapor = nilaiPraperiksa(fakta.data, usulan);

    let pendapat: PendapatAi | null = null;
    if (badan?.mintaAi !== false && !rapor.hentikan) {
      const jawaban = await mintaGatewayPraperiksaPendapat({
        nomorPerkara,
        petitum: teksDariHtml(fakta.data.petitum),
        amar: teksDariHtml(usulan.amar),
        pihak: fakta.data.pihak,
        anak: fakta.data.anak,
      });
      pendapat = jawaban.ok ? jawaban.data : { ok: false, alasan: jawaban.error };
      rapor = nilaiPraperiksa(fakta.data, usulan, { pendapat });
    } else if (rapor.hentikan) {
      pendapat = { ok: false, alasan: "Tidak diminta: sudah ada pertentangan yang menahan." };
      rapor = nilaiPraperiksa(fakta.data, usulan, { pendapat });
    }

    const jadwal = fakta.data.jadwal ?? [];
    return ok({
      ada: true,
      drafId: draf.id,
      versi: draf.versi,
      keadaan: draf.keadaan,
      nomorPerkara,
      usulan: ringkasUsulan(usulan),
      fakta: {
        jenisPerkara: fakta.data.jenisPerkara,
        jumlahSidang: jadwal.length,
        tanggalSidangTerakhir: jadwal.reduce((akhir, s) => (s.tanggalSidang > akhir ? s.tanggalSidang : akhir), ""),
        majelis: (fakta.data.majelis ?? []).map((x) => x.nama),
        jumlahPihak: (fakta.data.pihak ?? []).length,
        sudahPutus: Boolean(fakta.data.putusan?.ada),
        ecourt: fakta.data.ecourt?.terdaftar ?? null,
      },
      ...rapor,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_PRAPERIKSA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-praperiksa",
    });
  }
}

function ringkasUsulan(usulan: UsulanPutusan) {
  return {
    tanggalPutusan: tanggalIso(usulan.tanggalPutusan),
    tanggalMentah: String(usulan.tanggalPutusan ?? ""),
    statusPutusan: String(usulan.statusPutusan ?? ""),
    verstek: String(usulan.verstek ?? ""),
    adaAmar: Boolean(String(usulan.amar ?? "").trim()),
  };
}
