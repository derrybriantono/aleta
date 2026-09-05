import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayAntrianSidang,
  sinkronkanAntrianSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Antrian sidang hari berjalan.
 *
 * ============================================================================
 * ONLINE DAN OFFLINE SATU DERET
 * ============================================================================
 *
 * Antrian dapat diambil dua cara: lewat WhatsApp ALETA sebelum berangkat, atau
 * di mesin antrian ruang tunggu setelah tiba. Keduanya masuk DERET YANG SAMA,
 * diurut menurut waktu pengambilan - yang mengambil lebih dulu bernomor lebih
 * kecil, dari mana pun ia mengambilnya.
 *
 * Membuat dua deret terpisah berarti dua orang sama-sama memegang nomor 3, dan
 * yang dipanggil lebih dulu jadi soal siapa yang berdiri lebih dekat. Kolom
 * `online` karena itu hanya menandai ASAL pengambilan - keterangan, bukan
 * urutan.
 *
 * Nomornya dihitung dengan rumus yang sama persis dengan yang dipakai menjawab
 * WhatsApp, sehingga nomor di layar ruang tunggu tidak pernah berselisih
 * dengan nomor yang sudah diterima para pihak di ponselnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayAntrianSidang();
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        terbaca: false,
        peta: {},
      });
    }

    return ok({
      available: true,
      terbaca: hasil.data?.terbaca ?? false,
      alasan: hasil.data?.alasan ?? "",
      tanggal: hasil.data?.tanggal ?? [],
      jumlahDiambil: hasil.data?.jumlahDiambil ?? 0,
      peta: hasil.data?.peta ?? {},
      // Kehadiran rinci - siapa yang hadir dan siapa yang lebih dulu. Sempat
      // tertinggal di sini: bot mengirimkannya, layar menantikannya, dan rute
      // ini diam-diam membuangnya di tengah. Yang terlihat di layar hanyalah
      // keterangan yang tidak pernah muncul, tanpa satu pun galat.
      kehadiran: hasil.data?.kehadiran ?? {},
      // Riwayat panggilan - berapa kali tiap nomor sudah dipanggil hari ini.
      // Diteruskan bersama yang lain; medan yang ditambahkan di hulu lalu
      // tertinggal di sini menghasilkan keterangan yang tidak pernah muncul
      // tanpa satu pun galat, dan itu sudah terjadi sekali.
      panggilan: hasil.data?.panggilan ?? {},
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_SIDANG_FAILED",
      feature: "antrian",
      entityId: "antrian-sidang",
    });
  }
}

/**
 * Mendaftarkan jadwal sidang satu tanggal ke aplikasi antrian.
 *
 * ============================================================================
 * INI MENULIS KE APLIKASI LAIN
 * ============================================================================
 *
 * Yang ditulis tabel milik aplikasi antrian yang dipakai mesin di ruang
 * tunggu. Karena itu kemampuan yang dituntut BUKAN "panel" seperti membaca,
 * melainkan "permintaan" - kemampuan yang sama dengan menjalankan penarikan
 * e-Court, yaitu menyuruh ALETA mengerjakan sesuatu di luar dirinya. Uji
 * kering tetap menjadi perilaku bawaan di sisi bot.
 *
 * ALETA hanya MENAMBAH baris yang belum ada. Nomor antriannya sendiri tidak
 * ditulis: nomor lahir dari pengambilan, bukan dari pendaftaran, dan baris
 * baru masuk sebagai "belum diambil" sehingga tidak menggeser nomor siapa pun.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");

    const isi = (await request.json().catch(() => ({}))) as {
      tanggal?: string;
      terapkan?: boolean;
    };

    const tanggal = String(isi.tanggal || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return ok({ available: true, ok: false, alasan: "Tanggal wajib berbentuk YYYY-MM-DD." });
    }

    const hasil = await sinkronkanAntrianSidang({
      tanggal,
      terapkan: isi.terapkan === true,
      olehSiapa: actor.name || actor.id,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_SINKRON_FAILED",
      feature: "antrian",
      entityId: "antrian-sinkron",
    });
  }
}
