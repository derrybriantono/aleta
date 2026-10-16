import { type NextRequest } from "next/server";

import { anonimkanRtfBita, type OpsiAnonim } from "@/lib/anonimisasi-putusan";
import { getDatabase } from "@/server/db/client";
import { getGatewaySippEntitasAnonim } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Putusan khas di bawah 1 MB; batas base64 longgar. */
const BATAS_BASE64 = 28 * 1024 * 1024;

/**
 * ============================================================================
 * ANONIMISASI PUTUSAN MANDIRI (16 Okt 2026, F4.3)
 * ============================================================================
 *
 *   POST JSON { rtfBase64, nomorPerkara, opsi? }
 *   -> { ok, rtfBase64, ringkas, sisa, dilewati, potongan, tidakTerbaca }
 *
 * Menyamarkan RTF putusan TANPA rute main/anonim ABT: data pribadi perkara
 * dibaca dari SIPP lewat bot (baca saja), disamarkan di sini (anonimisasi-
 * putusan.ts), lalu yang dikirim ke peramban HANYA naskah yang sudah
 * disamarkan beserta hitungan per jenis - nilai mentah SIPP (NIK, telepon,
 * nama) tidak pernah meninggalkan server.
 *
 * Tidak menulis ke mana pun. Hak: kapabilitas "blangko-abt" (sama dengan
 * Cetak PDF Blangko ABT). Bila SIPP tidak terbaca, rute menolak (ok:false)
 * dan ekstensi jatuh kembali ke anonimisasi ABT - penyamaran yang hanya
 * memakai pola teks tanpa daftar nama SIPP terlalu mudah meloloskan nama.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<{ rtfBase64?: unknown; nomorPerkara?: unknown; opsi?: unknown }>(request).catch(
      () => ({}) as { rtfBase64?: unknown; nomorPerkara?: unknown; opsi?: unknown }
    );
    const rtfBase64 = String(body.rtfBase64 || "");
    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!rtfBase64) return ok({ ok: false, sebab: "Naskah putusan tidak terkirim." });
    if (rtfBase64.length > BATAS_BASE64) return ok({ ok: false, sebab: "Naskah putusan terlalu besar." });
    if (!nomorPerkara) return ok({ ok: false, sebab: "Nomor perkara belum disebut." });

    const bita = new Uint8Array(Buffer.from(rtfBase64, "base64"));
    if (!String.fromCharCode(...bita.subarray(0, 6)).startsWith("{\\rtf")) {
      return ok({ ok: false, sebab: "Naskah bukan RTF - penyamar ALETA hanya membaca RTF." });
    }

    const entitas = await getGatewaySippEntitasAnonim(nomorPerkara);
    if (!entitas.ok) {
      return ok({ ok: false, sebab: `Data para pihak di SIPP belum terbaca (${entitas.error}).` });
    }
    if (!entitas.data.pihak || entitas.data.pihak.length === 0) {
      return ok({ ok: false, sebab: "Nama para pihak perkara ini tidak terbaca di SIPP." });
    }

    const o = (body.opsi && typeof body.opsi === "object" ? body.opsi : {}) as Record<string, unknown>;
    const opsi: OpsiAnonim = {
      ...(o.ttl === false ? { ttl: false } : {}),
      ...(o.pekerjaan === false ? { pekerjaan: false } : {}),
      ...(o.alamat === false ? { alamat: false } : {}),
    };
    const hasil = anonimkanRtfBita(bita, entitas.data, opsi);
    return ok({
      ok: true,
      rtfBase64: Buffer.from(hasil.bita).toString("base64"),
      ringkas: hasil.ringkas,
      jumlah: hasil.ganti.length,
      // Sisa & yang dilewati memuat potongan naskah ASLI di sekitarnya - itulah yang
      // perlu dilihat petugas sebelum mengunggah; petugas ini sudah memegang naskah aslinya.
      sisa: hasil.sisa,
      dilewati: hasil.dilewati,
      potongan: hasil.potongan,
      tidakTerbaca: entitas.data.tidakTerbaca ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_ANONIM_MANDIRI_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-anonim-mandiri",
    });
  }
}
