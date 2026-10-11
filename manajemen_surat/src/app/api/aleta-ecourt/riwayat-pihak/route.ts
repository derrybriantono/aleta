import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayRiwayatPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import type { UserPersona } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat para pihak satu perkara: perceraian yang aktanya sudah terbit, dan
 * perkara lain yang melibatkan orang yang sama (permintaan 27 September 2026).
 *
 * ============================================================================
 * ALAMAT TERSENDIRI, DIBACA HANYA KETIKA BAGIAN PARA PIHAK DIBUKA
 * ============================================================================
 *
 * Bagian Para pihak di Status Perkara terciut sebagai bawaan - nama pihak data
 * pribadi. Riwayatnya lebih peka lagi: ia menyebut perkara lain orang itu.
 * Menempelkannya ke muatan status berarti ikut terkirim pada setiap perkara
 * yang dibuka siapa pun, termasuk yang hanya melihat jadwal sidang, dan ikut
 * memperlambat muatan yang sudah menjalankan puluhan kueri.
 *
 * Kewenangannya sama dengan Status Perkara sendiri ("panel"): yang boleh
 * membuka perkaranya boleh membaca riwayat pihaknya. NIK dan tanggal lahir
 * TIDAK pernah dikirim - yang dikirim hanya dasar pencocokannya ("NIK sama"),
 * bukan nilainya.
 *
 * ============================================================================
 * TIGA PENOLAKAN, TIGA TINDAKAN (telaah gabungan 2.40.0)
 * ============================================================================
 *
 * Dulu setiap jawaban gagal dari bot diteruskan sebagai available:false - yang
 * di portal berarti "bot tidak dapat dihubungi". Padahal bot yang MENOLAK
 * adalah bot yang sehat: petugas yang membaca "tidak terjangkau" memeriksa
 * layanan yang tidak bermasalah, sementara perkaranya yang tidak ada.
 *
 *   perkara_tidak_ada   bot terjangkau, perkara tidak ada di SIPP
 *   masukan_tidak_sah   bot terjangkau, nomor/ID perkaranya tidak sah
 *   gagal_membaca_sipp  bot terjangkau, SIPP-nya galat
 *   bot_tak_terjangkau  koneksi ditolak, habis waktu, atau rute belum ada di
 *                       bot versi lama (halaman HTML 404 - tanpa kode)
 *
 * Pembedanya `kode` penolakan JSON dari bot, bukan teks galatnya.
 *
 * ============================================================================
 * PEMBACAAN YANG BERHASIL TERCATAT DI JEJAK AUDIT
 * ============================================================================
 *
 * handleAdminRouteError hanya mencatat PENOLAKAN kewenangan. Riwayat pihak
 * justru yang perlu dapat ditelusuri ketika berhasil dibaca: siapa membaca
 * riwayat pihak perkara apa, dan kapan (created_at jejak itu sendiri).
 * Mekanismenya sama dengan rute berkas-zip dan eviden-skp/unduh. Yang dicatat
 * hanya PEMBACA dan PERKARANYA, beserta hitungan - bukan nama pihak, NIK, atau
 * tanggal lahir: jejak audit bukan salinan kedua data pribadi.
 */

const KODE_DITOLAK_BOT = new Set(["perkara_tidak_ada", "masukan_tidak_sah", "gagal_membaca_sipp"]);

type RingkasPihak = { ceraiBerakta?: unknown; jumlahTerkait?: unknown };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    pastikanAksiAktor(aktor as UserPersona, "status.data-pihak"); // HAK-PERAN 12 Okt: matriks peran

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    const nomorPerkara = String(request.nextUrl.searchParams.get("nomorPerkara") || "").trim();
    // Diperiksa di sini juga, bukan hanya di bot: masukan yang jelas salah
    // tidak perlu melintasi jaringan untuk ditolak.
    if (perkaraId && !/^[1-9]\d{0,17}$/.test(perkaraId)) {
      return ok({ available: true, ok: false, kode: "masukan_tidak_sah", alasan: "perkaraId tidak sah." });
    }
    if (!perkaraId && !nomorPerkara) {
      return ok({ available: true, ok: false, kode: "masukan_tidak_sah", alasan: "perkaraId atau nomorPerkara wajib diisi." });
    }

    const hasil = await getGatewayRiwayatPihak({ perkaraId, nomorPerkara });
    if (!hasil.ok) {
      // Bot yang menolak dengan kode yang dikenal adalah bot yang TERJANGKAU.
      if (hasil.kode && KODE_DITOLAK_BOT.has(hasil.kode)) {
        return ok({ available: true, ok: false, kode: hasil.kode, alasan: hasil.error });
      }
      return ok({
        available: false,
        ok: false,
        kode: "bot_tak_terjangkau",
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    const data = hasil.data as Record<string, unknown>;
    if (data.ok === true && db) {
      const perkara = (data.perkara ?? {}) as { perkaraId?: unknown; nomorPerkara?: unknown };
      const pihak = (Array.isArray(data.pihak) ? data.pihak : []) as RingkasPihak[];
      const nomor = String(perkara.nomorPerkara || nomorPerkara || perkaraId);
      try {
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId,
          action: "SIPP_RIWAYAT_PIHAK_BACA",
          entityType: "perkara",
          entityId: nomor,
          payload: {
            perkaraId: String(perkara.perkaraId || perkaraId),
            nomorPerkara: nomor,
            jumlahPihak: pihak.length,
            // Hitungan saja - cukup untuk menilai kepekaan yang terbaca, tanpa
            // menyalin siapa orangnya.
            pihakCeraiBerulang: pihak.filter((p) => Number(p.ceraiBerakta) >= 2).length,
            pihakBerperkaraTerkait: pihak.filter((p) => Number(p.jumlahTerkait) > 0).length,
            oleh: (aktor as { name?: string } | null)?.name || "",
            request: getRequestAuditMetadata(request),
          },
        });
      } catch {
        // Jejak yang gagal dicatat (termasuk nomor jejaknya) tidak membatalkan
        // jawaban yang sudah ada - yang hilang catatannya, bukan pekerjaannya.
      }
    }
    return ok({ available: true, ...data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_RIWAYAT_PIHAK_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
