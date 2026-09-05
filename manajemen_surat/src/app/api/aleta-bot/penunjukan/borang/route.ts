import { type NextRequest } from "next/server";

import { type RoleId } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { kapabilitasPeran, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import {
  antreanPerkara,
  bolehMenetapkan,
  sebutanJabatan,
} from "@/server/modules/aleta-ecourt/penunjukan-antrean";
import {
  URUTAN_PENGISIAN,
  bacaPetaMedan,
  borangSiap,
  hapusMedanBorang,
  simpanMedanBorang,
} from "@/server/modules/aleta-ecourt/penunjukan-pengisian";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Peta kolom formulir SIPP: apa yang boleh diisi, dan di mana kolomnya.
 *
 * ============================================================================
 * KESIAPAN DIJAWAB DI SERVER, BUKAN DISIMPULKAN EKSTENSI
 * ============================================================================
 *
 * Ekstensi hanya menggambar. Apakah satu formulir boleh diisi - petanya lengkap,
 * perannya berwenang, urutannya sudah tiba - dijawab di sini, dan diperiksa
 * lagi saat pengisiannya dicatat.
 *
 * Ekstensi berjalan di peramban pengguna dan dapat diubah siapa saja yang
 * memasangnya. Jawaban di sini kenyamanan, bukan penjagaan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const [aturan, kemampuan] = await Promise.all([
      bacaAturanPenunjukan(db),
      kapabilitasPeran(db, actor.roleId as RoleId),
    ]);

    // Kesiapan tiap formulir, dalam urutan yang memang harus dijalani.
    const daftar = [];
    for (const formulir of ["data-umum", ...URUTAN_PENGISIAN]) {
      const keadaan = await borangSiap(db, formulir);
      daftar.push({
        formulir,
        siap: keadaan.siap,
        alasan: keadaan.alasan,
        jumlahKolom: keadaan.medan.length,
      });
    }

    // Jabatan mana yang boleh mengerjakan penetapan mana - supaya papan dapat
    // menampilkan "Teruskan ke Panitera" alih-alih tombol Kerjakan yang akan
    // ditolak sesudah ditekan.
    const bolehJenis: Record<string, boolean> = {};
    const untukJabatan: Record<string, string> = {};
    for (const jenis of URUTAN_PENGISIAN) {
      bolehJenis[jenis] = bolehMenetapkan(String(actor.roleId ?? ""), jenis, aturan.penetapanBerjabatan);
      untukJabatan[jenis] = sebutanJabatan(jenis);
    }

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();

    return ok({
      ok: true,
      urutan: URUTAN_PENGISIAN,
      borang: daftar,
      medan: await bacaPetaMedan(db),
      bolehMengisi: kemampuan["penunjukan-otomatis"] === true,
      bolehJenis,
      untukJabatan,
      // Penerusan yang menunggu untuk perkara ini - dipakai papan menampilkan
      // "sudah diteruskan, menunggu Ketua" alih-alih menawarkan penerusan kedua.
      antrean: perkaraId ? await antreanPerkara(db, perkaraId) : [],
      // Bawaannya mati, dan yang membaca perlu tahu itu tanpa menebak dari
      // tombol yang tidak muncul.
      simpanOtomatis: aturan.simpanOtomatis,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_BORANG_READ_FAILED",
      feature: "penunjukan",
      entityId: "formulir",
    });
  }
}

/** Menyimpan atau menghapus satu penunjuk kolom. Hanya Super Admin dan Admin. */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pengguna = await resolveActorUserId(request);

    const body = (await request.json()) as {
      borang?: string;
      medan?: string;
      penunjuk?: string;
      jenis?: string;
      wajib?: boolean;
      catatan?: string;
      hapus?: boolean;
    };

    if (!pengguna) {
      return ok({ ok: false, alasan: "belum_masuk" });
    }

    if (body.hapus === true) {
      const hasil = await hapusMedanBorang(db, {
        actorUserId: pengguna,
        borang: String(body.borang || ""),
        medan: String(body.medan || ""),
      });
      return ok({ ok: true, medan: hasil });
    }

    const hasil = await simpanMedanBorang(db, {
      actorUserId: pengguna,
      borang: String(body.borang || ""),
      medan: String(body.medan || ""),
      penunjuk: String(body.penunjuk || ""),
      jenis: String(body.jenis || "teks"),
      wajib: body.wajib === true,
      catatan: String(body.catatan || ""),
    });

    return ok({ ok: true, medan: hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_BORANG_SAVE_FAILED",
      feature: "penunjukan",
      entityId: "formulir",
    });
  }
}
