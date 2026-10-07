import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import {
  getGatewayKeadaanSidang,
  postGatewayTundaSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penundaan sidang oleh panitera sidang.
 *
 * ============================================================================
 * INI MENULIS KE SIPP
 * ============================================================================
 *
 * Bukan membaca, bukan menyusun draf - MENULIS, ke `perkara_jadwal_sidang` dan
 * `perkara` pada basis data yang sedang dipakai petugas, beserta tiga baris
 * `sys_audittrail` yang harus terbaca persis sebagaimana petugas menuliskannya
 * sendiri dari SIPP.
 *
 * Tiga hal yang dijaga di lapisan ini:
 *
 *   1. KERING SEBAGAI BAWAAN. `kering: false` harus disebut dengan tegas.
 *      Permintaan yang lupa menyebutnya menghasilkan rencana yang dapat
 *      dibaca, bukan tulisan yang tidak dapat ditarik kembali.
 *   2. AKUN SIPP-nya DITURUNKAN DARI PERKARANYA - panitera sidang yang aktif
 *      pada `perkara_panitera_pn` - dan itulah yang muncul pada audit trail.
 *      ALETA tidak pernah menulis atas nama dirinya sendiri, dan tidak pernah
 *      pula menerima nama yang diketik orang. Keputusan pengguna 7 Okt 2026:
 *      tetap PP perkara itu walau yang menekan hakim/admin; PP yang tidak
 *      tercatat/ganda DITOLAK (tidak lagi jatuh ke akun cadangan). Penekan
 *      sebenarnya (akun ALETA + akun SIPP miliknya) dikirim untuk jejak ALETA.
 *   3. Kewenangannya "panel", sama dengan layar antrian sidang yang menjadi
 *      pintu masuknya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const jadwalId = String(request.nextUrl.searchParams.get("jadwalId") || "").trim();
    if (!jadwalId) {
      return ok({ available: true, ok: false, alasan: "Nomor jadwal sidang wajib diisi." });
    }

    const hasil = await getGatewayKeadaanSidang(jadwalId);
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_SIDANG_KEADAAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = (await request.json()) as Record<string, unknown>;
    // Penekan sebenarnya - HANYA untuk jejak ALETA; yang tercatat di SIPP PP.
    const akunPenekan = await akunSippPengguna(db, aktor.id).catch(() => null);

    // ========================================================================
    // AKUN SIPP TIDAK LAGI DITANYAKAN - IA DITURUNKAN DARI PERKARANYA
    // ========================================================================
    //
    // Sampai 2.22.0 rute ini MENOLAK permintaan yang tidak menyebut username,
    // dan layarnya menanyakannya. Itu keliru, dan kelirunya bukan soal
    // kenyamanan: penundaan ditulis atas nama PANITERA SIDANG perkara itu, dan
    // siapa panitera sidangnya sudah melekat pada perkaranya sejak penetapan -
    // aplikasi antrian sidang satker membacanya dari `perkara_panitera_pn`,
    // tidak pernah menanyakannya.
    //
    // Isian yang menanyakannya membuka pintu menulis atas nama orang lain, dan
    // tidak ada satu pun pemeriksaan yang akan menangkapnya: audit trail SIPP
    // hanya mencatat nama yang diberikan kepadanya.
    //
    // Yang dikirim tetap diteruskan sebagai CADANGAN - dipakai layanan hanya
    // bila perkaranya sungguh tidak punya panitera sidang aktif.
    const hasil = await postGatewayTundaSidang({
      jadwalId: badan.jadwalId,
      perkaraId: badan.perkaraId,
      alasanTunda: String(badan.alasanTunda || ""),
      tanggalBerikut: String(badan.tanggalBerikut || ""),
      jamBerikut: String(badan.jamBerikut || ""),
      jamSekarang: String(badan.jamSekarang || ""),
      agendaBerikut: String(badan.agendaBerikut || ""),
      jenisPengadilan: badan.jenisPengadilan,
      ruangId: badan.ruangId,
      // Butir 25 (5 Okt 2026): ruang sidang + sidang keliling sidang BERIKUTNYA.
      ruanganIdBerikut: badan.ruanganIdBerikut,
      sidangKelilingBerikut: typeof badan.sidangKelilingBerikut === "boolean" ? badan.sidangKelilingBerikut : undefined,
      dihadiriOleh: badan.dihadiriOleh,
      // Operator adalah orang portal yang menekan tombolnya - terpisah dari
      // akun SIPP yang namanya tercatat di audit trail (PP perkara). Keduanya
      // disimpan, supaya pertanyaan "siapa yang menjalankannya" tetap ada
      // jawabannya. olehUsername tidak lagi dikirim: bukan cadangan penginput.
      operator: actorUserId || "portal",
      operatorNama: String(aktor.name || aktor.email || ""),
      operatorAkunSipp: akunPenekan && akunPenekan.milik.length ? akunPenekan.milik.join(", ") : "",
      // Kering kecuali disebut tegas sebaliknya.
      kering: badan.kering !== false,
    });

    if (!hasil.ok) {
      return ok({
        // Bot menjawab (status ada) = bot hidup tetapi menolak / SIPP menolak;
        // `alasan` berisi kalimat sebabnya dari bot (pesanHasilSidang).
        available: Boolean(hasil.status),
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
        kode: hasil.kode,
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_SIDANG_TUNDA_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
