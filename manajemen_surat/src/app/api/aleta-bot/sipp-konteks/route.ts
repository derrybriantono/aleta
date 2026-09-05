import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewaySippKonteks,
  postGatewayVerifikasiDecision,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { kapabilitasPeran, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { roles as daftarPeran } from "@/lib/mock-data";
import { type RoleId } from "@/lib/types";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konteks ALETA untuk satu perkara, dipanggil ekstensi peramban dari halaman SIPP.
 *
 * ============================================================================
 * KENAPA TIDAK PERLU CORS
 * ============================================================================
 *
 * SIPP dan portal dilayani dari host yang sama (192.168.10.10), hanya berbeda
 * jalur. Keduanya satu origin, sehingga permintaan dari halaman SIPP membawa
 * cookie sesi portal dengan sendirinya - tanpa CORS, tanpa token tambahan,
 * tanpa menyimpan kredensial apa pun di ekstensi.
 *
 * Bila suatu saat SIPP dipindah ke host lain, rute ini akan mulai ditolak
 * peramban. Itu perilaku yang benar: yang perlu diubah adalah penempatannya,
 * bukan melonggarkan pemeriksaan asal permintaan.
 *
 * ============================================================================
 * TETAP MENUNTUT SESI PORTAL
 * ============================================================================
 *
 * Tanpa login ALETA, rute ini menjawab 401 - persis seperti halaman portal
 * lain. Ekstensi lalu menampilkan ajakan masuk, bukan data.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return ok({ available: true, message: "", konteks: null, alasan: "nomor_perkara_kosong" });
    }

    // Nama SELALU dari akun yang login, tidak pernah dari permintaan.
    // Bila nama boleh dikirim pemanggil, siapa pun yang punya akun portal
    // dapat memunculkan tombol verifikasi atas nama hakim mana pun.
    const hasil = await getGatewaySippKonteks(nomor, actor.name);
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        konteks: null,
      });
    }

    // ========================================================================
    // SIAPA YANG SEDANG MEMBUKA PANEL INI
    // ========================================================================
    //
    // Panel melayang di atas halaman SIPP, dan SIPP punya akun sendiri yang
    // belum tentu orang yang sama. Menyebutkan nama dan jabatan yang sedang
    // dipakai di ALETA membuat perbedaan itu terlihat sebelum ada yang
    // terlanjur mengira keduanya satu.
    //
    // Namanya SELALU dari akun yang login, tidak pernah dari permintaan -
    // sama seperti nama yang dipakai memeriksa keanggotaan majelis di atas.
    const peran = daftarPeran.find((x) => x.id === actor.roleId);

    // ========================================================================
    // KEWENANGAN IKUT DIKIRIM, SUPAYA MENU YANG MUSTAHIL DIPAKAI TIDAK DIGAMBAR
    // ========================================================================
    //
    // Sebelumnya panel menggambar seluruh menu untuk semua orang, dan menu yang
    // tidak berwenang baru menolak SESUDAH ditekan. Bagi juru sita dan panitera
    // muda itu berarti tiga baris yang tidak pernah dapat mereka buka - ikut
    // memenuhi panel yang memang sudah padat.
    //
    // Ini KENYAMANAN, bukan penjagaan. Tiap rute tetap memeriksa ulang
    // kewenangannya sendiri sebelum menjawab: ekstensi berjalan di peramban
    // pengguna dan dapat diubah siapa saja yang memasangnya.
    //
    // Super Admin dan Admin selalu penuh - kapabilitasPeran menegakkannya di
    // dalam kode, bukan dari baris tabel, sehingga tidak ada pengalihan yang
    // dapat mengunci keduanya keluar dari menunya sendiri.
    const kapabilitas = await kapabilitasPeran(db, actor.roleId as RoleId);

    return ok({
      available: true,
      message: "",
      konteks: hasil.data ?? null,
      pengguna: {
        nama: actor.name,
        peran: peran ? peran.name : String(actor.roleId || ""),
      },
      kapabilitas,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KONTEKS_READ_FAILED",
      feature: "sipp_konteks",
      entityId: "konteks",
    });
  }
}

/**
 * Menyimpan keputusan verifikasi hakim dari halaman SIPP.
 *
 * ============================================================================
 * PENJAGAANNYA SAMA PERSIS DENGAN JALUR LAIN
 * ============================================================================
 *
 * Verifikasi dari SIPP tidak mendapat kelonggaran apa pun dibanding jalur
 * WhatsApp maupun halaman portal:
 *
 *   - Nama hakim SELALU dari akun yang login, tidak pernah dari permintaan
 *   - Keanggotaan majelis diperiksa ulang di bot, tepat sebelum menyimpan
 *   - Konfirmasi kedua tetap dituntut
 *
 * Yang berbeda hanya pintu masuknya. Tombol yang dipaksa muncul di halaman
 * SIPP pun tidak menghasilkan apa-apa bila hakimnya bukan majelis perkara itu.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const body = (await request.json()) as {
      documentKey?: string;
      keputusan?: string;
      konfirmasi?: boolean;
    };

    const keputusan =
      body.keputusan === "valid" || body.keputusan === "tidak_valid" ? body.keputusan : null;
    if (!keputusan) {
      return ok({ ok: false, alasan: "keputusan_tidak_dikenali" });
    }

    const hasil = await postGatewayVerifikasiDecision({
      nama: actor.name,
      documentKey: String(body.documentKey || ""),
      keputusan,
      konfirmasi: body.konfirmasi === true,
    });

    if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
    return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_VERIFIKASI_FAILED",
      feature: "sipp_konteks",
      entityId: "verifikasi",
    });
  }
}
