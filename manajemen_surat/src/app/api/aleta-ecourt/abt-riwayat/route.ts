import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaRiwayat, catatRiwayat } from "@/server/modules/aleta-ecourt/abt-riwayat";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * JEJAK PERUBAHAN ABT
 * ============================================================================
 *
 * Riwayat perubahan ABT selama ini hanya ada di chrome.storage peramban yang
 * dipakai - hilang bila data peramban dibersihkan, tidak ada pada peramban
 * lain milik orang yang sama, dan tidak terlihat oleh siapa pun selain yang
 * menyuntingnya.
 *
 * Rute ini memberinya tempat yang bertahan. Salinan di peramban TETAP ada dan
 * tetap yang menggerakkan tombol Urungkan: ia lengkap, ada seketika, dan tetap
 * bekerja ketika peladen mati - dan justru saat sesuatu baru saja salah
 * diterapkanlah tombol itu paling dibutuhkan.
 *
 * ============================================================================
 * KEWENANGANNYA "panel", SAMA DENGAN YANG MENYUNTING
 * ============================================================================
 *
 * Yang mencatat di sini adalah ekstensi, atas perbuatan yang BARU SAJA
 * dikerjakan orang yang sama di halaman ABT. Menuntut kewenangan yang lebih
 * tinggi daripada yang dituntut untuk menyuntingnya berarti sebagian
 * penyuntingan tercatat dan sebagian tidak - dan jejak yang berlubang lebih
 * menyesatkan daripada tidak ada jejak, sebab yang membacanya menyangka
 * lubangnya berarti tidak ada perubahan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ ada: false, daftar: [], sebab: "Perkara tidak disebutkan." });

    const daftar = await bacaRiwayat(db, perkaraId);
    return ok({ ada: daftar.length > 0, daftar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_RIWAYAT_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-riwayat",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Ekstensi boleh mengirim beberapa sekaligus - satu penerapan usulan dapat
    // mengubah beberapa variabel sekaligus, dan mengirimkannya satu per satu
    // berarti sebagiannya hilang ketika jaringan putus di tengah.
    const daftarMentah = Array.isArray(badan.daftar) ? badan.daftar : [badan];

    const tercatat = [];
    for (const satu of daftarMentah.slice(0, 50)) {
      const isi = (satu ?? {}) as Record<string, unknown>;
      const baris = await catatRiwayat(db, String(actorUserId ?? ""), {
        perkaraId: String(isi.perkaraId ?? ""),
        nomorPerkara: String(isi.nomorPerkara ?? ""),
        kode: String(isi.kode ?? ""),
        nama: String(isi.nama ?? ""),
        sebelum: String(isi.sebelum ?? ""),
        sesudah: String(isi.sesudah ?? ""),
        cara: String(isi.cara ?? ""),
        pada: String(isi.pada ?? ""),
      });
      if (baris) tercatat.push(baris.id);
    }

    return ok({ ok: true, tercatat: tercatat.length });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_RIWAYAT_CATAT_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-riwayat",
    });
  }
}
