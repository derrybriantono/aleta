import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewaySippPositaRapikan,
  getGatewaySippPositaSambung,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Merapikan posita satu perkara di SIPP.
 *
 * ============================================================================
 * INI JALUR TULIS - DAN ITU DISEBUT DI SINI, BUKAN DISAMARKAN
 * ============================================================================
 *
 * Hampir seluruh jalur ALETA ke SIPP hanya membaca. Yang ini menulis, dan ke
 * kolom yang berisi dalil gugatan penggugat. Karena itu ia melewati
 * pemeriksaan sesi dan kewenangan yang sama dengan jalur tulis lain, dan
 * kegagalannya dicatat sebagai kejadian tersendiri.
 *
 * Pagar isinya ada di sisi bot - sippPositaService - dan pagar itu mutlak:
 * teks tanpa ruang kosong harus persis sama sebelum dan sesudah. Perapian
 * hanya menyisipkan pemisah antar butir; ia tidak dapat menambah, mengurangi,
 * maupun mengubah satu huruf pun. Rute ini TIDAK mengendurkannya, dan tidak
 * pula mengulangnya - satu aturan di satu tempat.
 *
 * ============================================================================
 * YANG TIDAK DISIMPAN DI SINI
 * ============================================================================
 *
 * Isi positanya memuat nama, alamat, dan riwayat rumah tangga para pihak.
 * Rute ini tidak menyimpannya - tidak ke basis data portal, tidak ke disk.
 * Ia meneruskan, menerima keterangan berhasil beserta teks lamanya, lalu
 * melupakannya. Yang menyimpan teks lama hanya peramban petugas, sebagai
 * riwayat perubahan yang memang dimintanya.
 *
 * ============================================================================
 * TEKSNYA TIDAK DITERIMA DARI PERAMBAN - HANYA PERKARANYA
 * ============================================================================
 *
 * Bentuk pertama rute ini menerima posita yang sudah dirapikan di peramban.
 * Itu keliru pada dua arah sekaligus:
 *
 *   1. Yang dirapikan peramban innerText satu sel tabel - hasil peramban
 *      menggambar HTML, bukan isi kolom di basis data. Membandingkannya
 *      dengan kolom itu membandingkan dua hal yang berbeda sejak awal, dan
 *      pagar isinya menolak walau petugas tidak mengubah apa pun.
 *   2. Rute yang menerima teks posita adalah rute yang dapat dititipi posita
 *      karangan siapa pun yang dapat membuka alat pengembang peramban.
 *
 * Sekarang yang dikirim hanya nomor perkaranya. Bot membaca positanya
 * sendiri, merapikannya sendiri, dan membandingkan hasilnya dengan yang ia
 * baca - satu teks, satu sumber.
 *
 * ujiKering memperlihatkan hasilnya tanpa menulis apa pun. Pratinjau di panel
 * karena itu memperlihatkan yang BENAR-BENAR akan tersimpan, bukan tebakan
 * sisi peramban atas teks yang bukan teks aslinya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const body = await readJsonBody<{
      perkaraId?: unknown;
      ujiKering?: unknown;
      aksi?: unknown;
      indeks?: unknown;
    }>(request).catch(() => ({}) as Record<string, unknown>);
    const perkaraId = String(body.perkaraId || "").trim();
    if (!perkaraId) {
      return ok({ available: false, message: "Nomor perkara tidak terkirim." });
    }

    // ======================================================================
    // DUA AKSI, SATU RUTE - DAN ITU DISENGAJA
    // ======================================================================
    //
    // Keduanya menyentuh kolom yang sama, dipagari aturan yang sama, dan
    // dicatat sebagai kejadian yang sama bila gagal. Memecahnya menjadi dua
    // rute berarti dua tempat yang harus diingat bersama setiap kali
    // pagarnya berubah.
    if (String(body.aksi || "") === "sambung") {
      const indeks = Number(body.indeks);
      if (!Number.isInteger(indeks) || indeks < 0) {
        return ok({ available: false, message: "Urutan temuan tidak terkirim." });
      }
      const sambung = await getGatewaySippPositaSambung(perkaraId, indeks);
      if (!sambung.ok) {
        return ok({ available: false, message: sambung.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({
        available: true,
        message: "",
        tersentuh: sambung.data?.tersentuh ?? 0,
        disambung: sambung.data?.disambung ?? "",
        sisa: sambung.data?.sisa ?? 0,
      });
    }

    const hasil = await getGatewaySippPositaRapikan(perkaraId, body.ujiKering === true);
    if (!hasil.ok) {
      return ok({
        // Sebabnya diteruskan apa adanya. Yang paling penting di antaranya -
        // penolakan karena perapiannya sendiri mengubah isi - hanya berguna
        // bila disebutkan lengkap.
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: "",
      tersentuh: hasil.data?.tersentuh ?? 0,
      berubah: hasil.data?.berubah ?? false,
      disambung: hasil.data?.disambung ?? 0,
      // Pecahan yang tidak dapat diputuskan mesin - panel menanyakannya.
      ragu: hasil.data?.ragu ?? [],
      sebelum: hasil.data?.sebelum ?? "",
      sesudah: hasil.data?.sesudah ?? "",
      alasan: hasil.data?.alasan ?? "",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_POSITA_RAPIKAN_FAILED",
      feature: "abt_posita",
    });
  }
}
